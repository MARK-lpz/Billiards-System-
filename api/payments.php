<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/online_payments.php';
require_once '../config/customer_texts.php';

// The website's GCash payments, for signed-in staff only (see
// config/online_payments.php):
//   GET                      the open and recent payments
//   GET ?receipt=<id>        one payment's receipt screenshot
//   GET ?reference=<digits>  whether a GCash reference was used already
//   GET ?day=<Y-m-d>         that day's GCash in and out, for the GCash check
//   POST action "counter"    GCash paid at the counter (Sales / POS, or a
//                            table's checkout), found in the hall's GCash app
//   POST action "accept"     a tournament entry fee was found: keep it
//   POST action "reject"     a tournament entry fee was not found: the player
//                            is taken off the tournament and it is sent back
//   POST action "refunded"   a payment was sent back (by GCash or in cash)
// A reservation's payment follows its booking instead (api/reservations.php).

function respond($status, $body) {
    http_response_code($status);
    echo json_encode($body);
    exit();
}

$pdo = getDBConnection();
$staff = requireStaff($pdo);
ensureOnlinePaymentsTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && isset($_GET['receipt'])) {
    $stmt = $pdo->prepare('SELECT receipt_file FROM online_payments WHERE id = ?');
    $stmt->execute([(string) $_GET['receipt']]);
    $name = (string) $stmt->fetchColumn();
    $path = receiptPath($name);
    if ($path === null) {
        respond(404, ['success' => false, 'message' => 'This receipt is no longer kept.']);
    }

    @ini_set('zlib.output_compression', '0');
    while (ob_get_level()) ob_end_clean();
    header('Content-Type: ' . RECEIPT_CONTENT_TYPES[pathinfo($name, PATHINFO_EXTENSION)]);
    header('X-Content-Type-Options: nosniff');
    // A customer's receipt: never kept by the browser or anything in between.
    header('Cache-Control: private, no-store');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit();
}

if ($method === 'GET' && isset($_GET['reference'])) {
    $reference = cleanPaymentReference($_GET['reference']);
    if ($reference === '') {
        respond(400, ['success' => false, 'message' => 'The GCash reference must be ' . PAYMENT_REFERENCE_MIN . ' to ' . PAYMENT_REFERENCE_MAX . ' digits.']);
    }
    $use = findReferenceUse($pdo, $reference);
    respond(200, ['success' => true, 'used' => $use !== null, 'message' => $use ? describeReferenceUse($use) : '']);
}

if ($method === 'GET' && isset($_GET['day'])) {
    $day = (string) $_GET['day'];
    $parsed = DateTime::createFromFormat('!Y-m-d', $day);
    if (!$parsed || $parsed->format('Y-m-d') !== $day) {
        respond(400, ['success' => false, 'message' => 'Pick a day.']);
    }
    respond(200, ['success' => true, 'day' => $day] + listGcashDay($pdo, $day));
}

if ($method === 'GET') {
    cleanupOldReceipts($pdo);
    respond(200, ['success' => true, 'payments' => listPaymentsForStaff($pdo)]);
}

if ($method !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Method not allowed']);
}

$data = json_decode(file_get_contents('php://input'), true) ?: [];
$action = (string) ($data['action'] ?? '');
$id = trim((string) ($data['id'] ?? ''));
$by = (string) $staff['username'];

try {
    if ($action === 'counter') {
        $payment = recordCounterPayment($pdo, [
            'reference' => $data['reference'] ?? '',
            'amount' => $data['amount'] ?? 0,
            'label' => $data['label'] ?? '',
            'saleKey' => $data['saleKey'] ?? '',
        ], $by);
        respond(200, ['success' => true, 'payment' => $payment]);
    }

    if ($action === 'refunded') {
        $payment = markPaymentRefunded($pdo, $id, (string) ($data['method'] ?? ''), (string) ($data['refundReference'] ?? ''), $by);
        textSafely(fn() => textRefundSent($pdo, $payment));
        respond(200, ['success' => true, 'payment' => $payment]);
    }

    if ($action !== 'accept' && $action !== 'reject') {
        respond(400, ['success' => false, 'message' => 'Unknown payment action.']);
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT kind, ref_id, participant, status FROM online_payments WHERE id = ? FOR UPDATE');
    $stmt->execute([$id]);
    $payment = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$payment) throw new PaymentRefusal(404, 'That payment was not found.');
    // A booking's payment is settled by approving or rejecting the booking.
    if ($payment['kind'] !== 'tournament') throw new PaymentRefusal(400, 'Approve or reject the reservation instead.');
    if ($payment['status'] !== 'held') throw new PaymentRefusal(409, 'This payment was already checked.');

    $event = null;
    $version = null;
    if ($action === 'reject') {
        // The player leaves the tournament, so their place is free again.
        $eventStmt = $pdo->prepare('SELECT event_data, version FROM tournament_events WHERE id = ? FOR UPDATE');
        $eventStmt->execute([$payment['ref_id']]);
        $stored = $eventStmt->fetch(PDO::FETCH_ASSOC);
        if ($stored) {
            $event = json_decode($stored['event_data'], true) ?: [];
            $players = is_array($event['participants'] ?? null) ? $event['participants'] : [];
            $kept = array_values(array_filter($players, fn($player) => trim((string) $player) !== trim($payment['participant'])));
            $version = (int) $stored['version'];
            if (count($kept) !== count($players)) {
                $event['participants'] = $kept;
                $pdo->prepare('UPDATE tournament_events SET event_data = ?, version = version + 1 WHERE id = ?')
                    ->execute([json_encode($event), $payment['ref_id']]);
                $version++;
            }
            $event['id'] = $payment['ref_id'];
        }
    }

    movePayment($pdo, $id, 'held', $action === 'accept' ? 'accepted' : 'refund_due', $by);
    $pdo->commit();
    $saved = readPayment($pdo, $id);
    textSafely(fn() => textTournamentDecision($pdo, $saved, $action === 'accept' ? 'accepted' : 'rejected'));
    respond(200, ['success' => true, 'payment' => $saved, 'event' => $event, 'version' => $version]);
} catch (PaymentRefusal $refusal) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond($refusal->status, ['success' => false, 'message' => $refusal->getMessage()]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Payment action failed: ' . $error->getMessage());
    respond(500, ['success' => false, 'message' => 'Unable to save this payment. Please try again.']);
}
