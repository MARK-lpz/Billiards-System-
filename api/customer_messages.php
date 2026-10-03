<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/sms.php';

// Caps on real texts, so a script hammering this endpoint cannot run up the
// SMS bill or flood someone's phone. Messages over the cap are still saved.
const TEXTS_PER_NUMBER_PER_DAY = 5;
const TEXTS_PER_HOUR_TOTAL = 100;

function ensureCustomerMessagesTable($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS customer_messages (
            id VARCHAR(80) NOT NULL PRIMARY KEY,
            phone VARCHAR(20) NOT NULL,
            customer_name VARCHAR(160) NULL,
            context VARCHAR(40) NOT NULL,
            reference_id VARCHAR(80) NULL,
            message VARCHAR(1000) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'queued',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sent_at DATETIME NULL,
            INDEX customer_messages_status (status, created_at),
            INDEX customer_messages_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

$pdo = getDBConnection();
ensureCustomerMessagesTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

// Staff read the queue: what was sent to which customer, and when.
if ($method === 'GET') {
    $status = trim((string) ($_GET['status'] ?? ''));

    if ($status !== '' && in_array($status, ['queued', 'sent', 'failed'], true)) {
        $stmt = $pdo->prepare(
            'SELECT id, phone, customer_name AS customerName, context, reference_id AS referenceId,
                    message, status, created_at AS createdAt, sent_at AS sentAt
             FROM customer_messages WHERE status = ? ORDER BY created_at DESC LIMIT 200'
        );
        $stmt->execute([$status]);
    } else {
        $stmt = $pdo->query(
            'SELECT id, phone, customer_name AS customerName, context, reference_id AS referenceId,
                    message, status, created_at AS createdAt, sent_at AS sentAt
             FROM customer_messages ORDER BY created_at DESC LIMIT 200'
        );
    }

    echo json_encode(['success' => true, 'messages' => $stmt->fetchAll()]);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true) ?: [];

function fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

// Letters, spaces, ' and - only: a name can never carry a link, a domain or a
// phone number into a text that goes out under the Break & Chill name.
function safeName(string $name): string
{
    $clean = trim(preg_replace('/\s+/u', ' ', preg_replace("/[^\\p{L}\\s'-]/u", '', $name)));
    return $clean === '' ? 'there' : mb_substr($clean, 0, 40);
}

function paymentLine(float $amount, string $reference): string
{
    if ($amount <= 0) {
        return 'No entry fee.';
    }
    $digits = preg_replace('/\D/', '', $reference);
    $ref = strlen($digits) >= 10 && strlen($digits) <= 15 ? ", ref $digits" : '';
    return 'GCash PHP ' . number_format($amount, 2) . " paid$ref.";
}

function prettyDate(string $date): string
{
    $time = strtotime($date);
    return $time ? date('M j, Y', $time) : $date;
}

function prettyTime(string $clock): string
{
    $time = strtotime("2000-01-01 $clock");
    return $time ? date('g:i A', $time) : $clock;
}

if ($method === 'POST') {
    /*
     * The text is always built here from a record that is really in the
     * database, never taken from the request. Otherwise this endpoint would
     * let anyone send any text to any number, billed to the owner and signed
     * "Break & Chill".
     */
    $context = (string) ($data['context'] ?? '');
    $referenceId = trim((string) ($data['referenceId'] ?? ''));

    if ($referenceId === '') {
        fail(400, 'A reservation or tournament is required.');
    }

    if ($context === 'reservation') {
        $stmt = $pdo->prepare(
            'SELECT id, customer_name, phone, reservation_date, reservation_time, duration_minutes, table_id,
                    payment_reference, payment_amount
             FROM reservations WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$referenceId]);
        $record = $stmt->fetch();
        if (!$record) {
            fail(404, 'That reservation was not found.');
        }

        $phone = normalizeMobileNumber((string) $record['phone']);
        $customerName = safeName((string) $record['customer_name']);
        $table = (int) $record['table_id'] > 0 ? 'Table ' . (int) $record['table_id'] : 'your table';
        $startClock = substr((string) $record['reservation_time'], 0, 5);
        $minutes = max(1, (int) ($record['duration_minutes'] ?? 60));
        $endStamp = strtotime("2000-01-01 $startClock") + $minutes * 60;
        $hours = $minutes % 60 === 0
            ? ($minutes / 60) . ($minutes === 60 ? ' hr' : ' hrs')
            : "$minutes mins";
        $text = "Hi $customerName, Break & Chill received your reservation: $table, "
            . prettyDate((string) $record['reservation_date']) . ', '
            . prettyTime($startClock) . ' - ' . date('g:i A', $endStamp) . " ($hours). "
            . paymentLine((float) $record['payment_amount'], (string) $record['payment_reference'])
            . ' Staff will review it. Please show this text when you arrive.';
    } elseif ($context === 'tournament') {
        $stmt = $pdo->prepare('SELECT event_data FROM tournament_events WHERE id = ? LIMIT 1');
        $stmt->execute([$referenceId]);
        $stored = $stmt->fetchColumn();
        $event = $stored ? (json_decode($stored, true) ?: []) : [];
        if (!$event || !in_array(strtolower((string) ($event['status'] ?? '')), ['upcoming', 'active'], true)) {
            fail(404, 'That tournament is not open for registration.');
        }

        // Only someone actually on the participant list gets a confirmation.
        $participant = trim((string) ($data['participant'] ?? ''));
        $participants = is_array($event['participants'] ?? null) ? $event['participants'] : [];
        if ($participant === '' || !in_array($participant, $participants, true)) {
            fail(404, 'That player is not registered for this tournament.');
        }

        $phone = normalizeMobileNumber((string) ($data['phone'] ?? ''));
        // "Ana Cruz (Team Name)" greets Ana Cruz.
        $customerName = safeName(preg_replace('/\s*\(.*\)\s*$/', '', $participant));
        $eventName = mb_substr(trim((string) ($event['name'] ?? 'the tournament')), 0, 40);
        $when = trim(
            (!empty($event['date']) ? ' on ' . prettyDate((string) $event['date']) : '')
            . (!empty($event['time']) ? ' at ' . prettyTime((string) $event['time']) : '')
        );
        $text = "Hi $customerName, Break & Chill received your registration for $eventName"
            . ($when !== '' ? " $when" : '') . '. '
            . paymentLine((float) ($event['entryFee'] ?? 0), (string) ($data['paymentReference'] ?? ''))
            . ' Staff will review it. Please show this text when you arrive.';
    } else {
        fail(400, 'Unknown message type.');
    }

    if ($phone === '') {
        fail(400, 'A valid 09XXXXXXXXX mobile number is required.');
    }

    // One confirmation per booking or per player per tournament: sending
    // again returns the first one instead of texting twice.
    $existing = $pdo->prepare(
        'SELECT id, message, status FROM customer_messages
         WHERE context = ? AND reference_id = ? AND phone = ? LIMIT 1'
    );
    $existing->execute([$context, $referenceId, $phone]);
    if ($previous = $existing->fetch()) {
        echo json_encode([
            'success' => true,
            'confirmation' => ['id' => $previous['id'], 'text' => $previous['message'], 'status' => $previous['status']],
        ]);
        exit();
    }

    $status = 'queued';
    if (smsIsConfigured()) {
        $limits = $pdo->prepare(
            "SELECT
                SUM(phone = ? AND created_at > NOW() - INTERVAL 1 DAY) AS forNumber,
                SUM(created_at > NOW() - INTERVAL 1 HOUR) AS lastHour
             FROM customer_messages
             WHERE status = 'sent' AND created_at > NOW() - INTERVAL 1 DAY"
        );
        $limits->execute([$phone]);
        $counts = $limits->fetch();
        $underLimit = (int) $counts['forNumber'] < TEXTS_PER_NUMBER_PER_DAY
            && (int) $counts['lastHour'] < TEXTS_PER_HOUR_TOTAL;

        if ($underLimit) {
            $status = sendSms($phone, $text) ? 'sent' : 'failed';
        }
    }

    $id = uniqid('msg-', true);
    $pdo->prepare(
        'INSERT INTO customer_messages (id, phone, customer_name, context, reference_id, message, status, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, IF(? = "sent", NOW(), NULL))'
    )->execute([$id, $phone, $customerName, $context, $referenceId, $text, $status, $status]);

    echo json_encode([
        'success' => true,
        'confirmation' => ['id' => $id, 'text' => $text, 'status' => $status],
    ]);
    exit();
}

// Staff mark a message as sent once it has gone out.
if ($method === 'PUT') {
    $id = trim((string) ($data['id'] ?? ''));
    $status = trim((string) ($data['status'] ?? 'sent'));

    if ($id === '' || !in_array($status, ['queued', 'sent', 'failed'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'A message id and a valid status are required.']);
        exit();
    }

    $stmt = $pdo->prepare(
        'UPDATE customer_messages SET status = ?, sent_at = IF(? = "sent", NOW(), sent_at) WHERE id = ?'
    );
    $stmt->execute([$status, $status, $id]);

    echo json_encode(['success' => true]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
