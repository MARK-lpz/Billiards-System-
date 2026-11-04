<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/collection.php';
require_once '../config/notices.php';
require_once '../config/site_settings.php';
require_once '../config/online_payments.php';
require_once '../config/online_sales.php';
require_once '../config/customer_texts.php';
require_once '../config/website_requests.php';
require_once '../config/reservation_settings.php';

function readJsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function ensureReservationsTable($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS reservations (
            id VARCHAR(80) PRIMARY KEY,
            customer_name VARCHAR(160) NOT NULL,
            phone VARCHAR(40) NOT NULL,
            email VARCHAR(160) NULL,
            reservation_date DATE NOT NULL,
            reservation_time TIME NOT NULL,
            party_size INT NOT NULL DEFAULT 1,
            duration_minutes INT NOT NULL DEFAULT 60,
            table_id BIGINT NOT NULL,
            table_name VARCHAR(120) NOT NULL,
            notes TEXT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            source VARCHAR(30) NOT NULL DEFAULT 'online',
            requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX reservations_schedule (reservation_date, reservation_time, table_id),
            INDEX reservations_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $columnStmt = $pdo->prepare(
        "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'table_id'"
    );
    $columnStmt->execute();
    $tableIdType = strtolower((string) $columnStmt->fetchColumn());

    if ($tableIdType === 'int') {
        $pdo->exec('ALTER TABLE reservations MODIFY table_id BIGINT NOT NULL');
    }

    // Payment details: a website booking's GCash, or what was taken at the desk.
    // payment_refund says how a desk booking's payment was given back (cash or gcash).
    foreach ([
        'payment_method' => "ALTER TABLE reservations ADD COLUMN payment_method VARCHAR(20) NULL",
        'payment_reference' => "ALTER TABLE reservations ADD COLUMN payment_reference VARCHAR(40) NULL",
        'payment_amount' => "ALTER TABLE reservations ADD COLUMN payment_amount DECIMAL(10,2) NOT NULL DEFAULT 0",
        'payment_refund' => "ALTER TABLE reservations ADD COLUMN payment_refund VARCHAR(10) NULL",
    ] as $column => $sql) {
        $paymentColumnStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = ?"
        );
        $paymentColumnStmt->execute([$column]);
        if (!(int) $paymentColumnStmt->fetchColumn()) {
            $pdo->exec($sql);
        }
    }

    $durationColumnStmt = $pdo->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'duration_minutes'"
    );
    $durationColumnStmt->execute();
    if (!(int) $durationColumnStmt->fetchColumn()) {
        $pdo->exec('ALTER TABLE reservations ADD COLUMN duration_minutes INT NOT NULL DEFAULT 60 AFTER party_size');
    }
}

function ensureTournamentEventsTable($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tournament_events (
            id VARCHAR(80) NOT NULL PRIMARY KEY,
            event_data LONGTEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX tournament_events_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

function normalizeDateValue($value) {
    $value = trim((string) $value);
    $date = DateTime::createFromFormat('Y-m-d', $value)
        ?: DateTime::createFromFormat('d/m/Y', $value)
        ?: DateTime::createFromFormat('m/d/Y', $value);

    return $date ? $date->format('Y-m-d') : $value;
}

function normalizeTimeValue($value) {
    $value = trim(strtolower((string) $value));
    $time = DateTime::createFromFormat('H:i', $value)
        ?: DateTime::createFromFormat('H:i:s', $value)
        ?: DateTime::createFromFormat('g:i a', $value);

    return $time ? $time->format('H:i') : $value;
}

function normalizeReservation($reservation) {
    return [
        'id' => (string) ($reservation['id'] ?? ''),
        'customerName' => trim($reservation['customerName'] ?? $reservation['customer_name'] ?? ''),
        'phone' => trim($reservation['phone'] ?? ''),
        'email' => trim($reservation['email'] ?? ''),
        'date' => normalizeDateValue($reservation['date'] ?? $reservation['reservation_date'] ?? ''),
        'time' => normalizeTimeValue($reservation['time'] ?? $reservation['reservation_time'] ?? ''),
        'partySize' => max(1, (int) ($reservation['partySize'] ?? $reservation['party_size'] ?? 1)),
        // At most a day; a website booking must also fit the opening hours (checked on saving).
        'durationMinutes' => max(1, min(1440, (int) ($reservation['durationMinutes'] ?? $reservation['duration_minutes'] ?? 60))),
        'tableId' => (int) ($reservation['tableId'] ?? $reservation['table_id'] ?? 0),
        'tableName' => trim($reservation['tableName'] ?? $reservation['table_name'] ?? ''),
        'notes' => trim($reservation['notes'] ?? ''),
        'status' => $reservation['status'] ?? 'pending',
        'source' => $reservation['source'] ?? 'online',
        'paymentMethod' => trim($reservation['paymentMethod'] ?? $reservation['payment_method'] ?? ''),
        // Digits only: a GCash reference is never arithmetic, so it stays a string.
        'paymentReference' => preg_replace('/\D/', '', (string) ($reservation['paymentReference'] ?? $reservation['payment_reference'] ?? '')),
        'paymentAmount' => max(0, (float) ($reservation['paymentAmount'] ?? $reservation['payment_amount'] ?? 0)),
        'requestedAt' => $reservation['requestedAt'] ?? $reservation['requested_at'] ?? null,
    ];
}

function isValidReservation($reservation) {
    return $reservation['id'] !== ''
        && $reservation['customerName'] !== ''
        && $reservation['phone'] !== ''
        && $reservation['date'] !== ''
        && $reservation['time'] !== ''
        && $reservation['tableId'] > 0
        && $reservation['tableName'] !== '';
}

// A guest who has not checked in this long after their reserved time is a
// no-show: the booking expires and the table is freed. Checked-in bookings are
// 'seated' or 'arrived', so they never expire. Keep in step with the frontend's
// RESERVATION_GRACE_MINUTES.
const RESERVATION_GRACE_MINUTES = 30;

function expirePastReservations($pdo) {
    $cutoff = new DateTime('now', new DateTimeZone('Asia/Manila'));
    $cutoff->modify('-' . RESERVATION_GRACE_MINUTES . ' minutes');
    $stmt = $pdo->prepare(
        "UPDATE reservations
         SET status = 'expired'
         WHERE status IN ('approved', 'reserved')
           AND TIMESTAMP(reservation_date, reservation_time) < ?"
    );
    $stmt->execute([$cutoff->format('Y-m-d H:i:s')]);
}

// A booked guest can be checked in ("arrived") only from the reserved time until
// the grace period ends: before that they are not due, after it they are a
// no-show. Same window as getArrivalWindow in the frontend's reservations.js.
function isWithinArrivalWindow($date, $time) {
    $zone = new DateTimeZone('Asia/Manila');
    $start = DateTime::createFromFormat('Y-m-d H:i', $date . ' ' . $time, $zone);
    if ($start === false) {
        return true;
    }
    $graceEnd = clone $start;
    $graceEnd->modify('+' . RESERVATION_GRACE_MINUTES . ' minutes');
    $now = new DateTime('now', $zone);
    return $now >= $start && $now <= $graceEnd;
}

// When a table someone is playing on stays busy, or null when it is free for
// this booking. Read from the table status the desks share (tables.php). A
// session past its booked end that has not been ended still has a player, so
// it counts until now. Same rule as getOccupiedTableRange in reservations.js.
function getOccupiedTableEnd($pdo, $reservation) {
    $tables = readCollection($pdo, openCollection($pdo, 'tables'))['items'];

    $zone = new DateTimeZone('Asia/Manila');
    $candidateStart = DateTime::createFromFormat('Y-m-d H:i', $reservation['date'] . ' ' . $reservation['time'], $zone);
    if ($candidateStart === false) {
        return null;
    }
    $candidateEnd = clone $candidateStart;
    $candidateEnd->modify('+' . $reservation['durationMinutes'] . ' minutes');

    foreach ($tables as $table) {
        if ((int) ($table['id'] ?? 0) !== (int) $reservation['tableId']) {
            continue;
        }
        if (($table['status'] ?? '') !== 'occupied' || empty($table['startTime'])) {
            return null;
        }

        $sessionStart = new DateTime('@' . intdiv((int) $table['startTime'], 1000));
        $sessionStart->setTimezone($zone);
        $sessionEnd = clone $sessionStart;
        $sessionEnd->modify('+' . max(1, (int) ($table['durationMinutes'] ?? 60)) . ' minutes');
        $now = new DateTime('now', $zone);
        if ($sessionEnd < $now) {
            $sessionEnd = $now;
        }

        return $candidateStart < $sessionEnd && $sessionStart < $candidateEnd ? $sessionEnd : null;
    }

    return null;
}

function hasScheduleConflict($pdo, $reservation) {
    $candidateStart = new DateTime($reservation['date'] . ' ' . $reservation['time']);
    $candidateEnd = clone $candidateStart;
    $candidateEnd->modify('+' . $reservation['durationMinutes'] . ' minutes');

    $stmt = $pdo->prepare(
        "SELECT id
         FROM reservations
         WHERE table_id = ?
           AND reservation_date = ?
           AND status IN ('pending', 'approved', 'reserved', 'arrived', 'seated')
           AND TIMESTAMP(reservation_date, reservation_time) < ?
           AND DATE_ADD(TIMESTAMP(reservation_date, reservation_time), INTERVAL duration_minutes MINUTE) > ?
           AND id <> ?
         LIMIT 1"
    );
    $stmt->execute([
        $reservation['tableId'],
        $reservation['date'],
        $candidateEnd->format('Y-m-d H:i:s'),
        $candidateStart->format('Y-m-d H:i:s'),
        $reservation['id'],
    ]);

    return (bool) $stmt->fetchColumn();
}

function getTournamentReservationConflict($pdo, $reservation) {
    $stmt = $pdo->query('SELECT event_data FROM tournament_events');
    $requestedTableName = strtolower(trim((string) $reservation['tableName']));
    $candidateStart = new DateTime($reservation['date'] . ' ' . $reservation['time']);
    $candidateEnd = clone $candidateStart;
    $candidateEnd->modify('+' . $reservation['durationMinutes'] . ' minutes');

    foreach ($stmt->fetchAll() as $row) {
        $event = json_decode($row['event_data'], true) ?: [];
        $status = strtolower(trim((string) ($event['status'] ?? 'upcoming')));
        if (
            normalizeDateValue($event['date'] ?? '') !== $reservation['date']
            || !in_array($status, ['upcoming', 'active'], true)
        ) {
            continue;
        }

        $eventTime = normalizeTimeValue($event['time'] ?? '');
        $eventStart = $eventTime ? new DateTime($reservation['date'] . ' ' . $eventTime) : null;
        if (!$eventStart || $candidateEnd <= $eventStart) {
            continue;
        }

        foreach (is_array($event['tables'] ?? null) ? $event['tables'] : [] as $assignedTable) {
            $matchesTableId = is_numeric($assignedTable) && (int) $assignedTable === (int) $reservation['tableId'];
            $matchesTableName = is_string($assignedTable)
                && strtolower(trim($assignedTable)) === $requestedTableName;
            if ($matchesTableId || $matchesTableName) {
                return [
                    'name' => trim((string) ($event['name'] ?? 'tournament')),
                    'time' => $eventStart->format('H:i'),
                ];
            }
        }
    }

    return null;
}

// What a booking costs at its table's own rate, never the request's; 0 when the
// table has no rate, null when it is no longer in the list.
function bookingAmount($pdo, $tableId, $minutes) {
    foreach (readCollection($pdo, openCollection($pdo, 'tables'))['items'] as $table) {
        if ((int) ($table['id'] ?? 0) === (int) $tableId) {
            return round((float) ($table['rate'] ?? 0) * $minutes / 60, 2);
        }
    }
    return null;
}

// A booking made at the hall is paid first, in full: whole hours inside the
// opening hours, cash or GCash, for what the table costs. The amount staff
// collected is checked against the server's, so a rate changed meanwhile is
// noticed before the booking stands. Leaves the method and reference clean.
function checkDeskBooking($pdo, array &$data, $hours) {
    if (!in_array($data['paymentMethod'], ['cash', 'gcash'], true)) {
        throw new PaymentRefusal(400, 'Take the payment first: choose cash or GCash.');
    }
    if ($data['durationMinutes'] < 60 || $data['durationMinutes'] % 60 !== 0) {
        throw new PaymentRefusal(400, 'A booking is for whole hours, at least 1.');
    }
    $hoursError = bookingHoursError($data, $hours);
    if ($hoursError !== '') throw new PaymentRefusal(400, $hoursError);

    $amount = bookingAmount($pdo, $data['tableId'], $data['durationMinutes']);
    if ($amount === null) throw new PaymentRefusal(409, 'That table is no longer in the list. Please choose another table.');
    if ($amount <= 0) throw new PaymentRefusal(409, "{$data['tableName']} has no rate yet. Set its rate in Pool Tables first.");
    if (abs($amount - $data['paymentAmount']) >= 0.01) {
        throw new PaymentRefusal(409, "{$data['tableName']} now costs ₱" . number_format($amount, 2) . ' for this booking. Check the total, then take the payment again.');
    }

    if ($data['paymentMethod'] === 'cash') {
        $data['paymentReference'] = '';
        return;
    }
    $data['paymentReference'] = cleanPaymentReference($data['paymentReference']);
    if ($data['paymentReference'] === '') {
        throw new PaymentRefusal(400, 'The GCash reference must be ' . PAYMENT_REFERENCE_MIN . ' to ' . PAYMENT_REFERENCE_MAX . ' digits.');
    }
}

// How a cancelled desk booking's payment goes back: { method, reference, paidBy },
// or null when there is nothing to give back here (a website booking's payment
// follows its booking in config/online_payments.php).
function readDeskRefund($pdo, $reservationId, array $body) {
    $stmt = $pdo->prepare('SELECT source, payment_method, payment_amount, payment_refund FROM reservations WHERE id = ?');
    $stmt->execute([$reservationId]);
    $stored = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$stored || $stored['source'] === 'online' || (float) $stored['payment_amount'] <= 0) return null;
    if ($stored['payment_refund'] !== null) throw new PaymentRefusal(409, 'This payment was already given back.');

    $method = (string) ($body['refundMethod'] ?? '');
    if ($method === 'cash') return ['method' => 'cash', 'reference' => '', 'paidBy' => $stored['payment_method']];
    if ($method !== 'gcash' || $stored['payment_method'] !== 'gcash') {
        throw new PaymentRefusal(400, 'Say how the payment was given back.');
    }
    $reference = cleanPaymentReference($body['refundReference'] ?? '');
    if ($reference === '') {
        throw new PaymentRefusal(400, 'Type the reference number of the GCash refund (' . PAYMENT_REFERENCE_MIN . ' to ' . PAYMENT_REFERENCE_MAX . ' digits).');
    }
    return ['method' => 'gcash', 'reference' => $reference, 'paidBy' => 'gcash'];
}

// Runs inside the caller's transaction. GCash taken at the desk is marked sent
// back too, so the day's GCash check shows what left the hall's account.
function applyDeskRefund($pdo, $reservationId, array $refund, $by) {
    $pdo->prepare('UPDATE reservations SET payment_refund = ? WHERE id = ?')->execute([$refund['method'], $reservationId]);
    if ($refund['paidBy'] !== 'gcash') return;

    $stmt = $pdo->prepare("SELECT id FROM online_payments WHERE kind = 'pos' AND ref_id = ? LIMIT 1");
    $stmt->execute(['reservation-' . $reservationId]);
    $paymentId = $stmt->fetchColumn();
    if ($paymentId === false) return;
    movePayment($pdo, $paymentId, 'accepted', 'refund_due', $by);
    markPaymentRefunded($pdo, $paymentId, $refund['method'], $refund['reference'], $by);
}

$pdo = getDBConnection();
ensureReservationsTable($pdo);
ensureReservationSettingsTable($pdo);
ensureTournamentEventsTable($pdo);
ensureOnlinePaymentsTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    expirePastReservations($pdo);

    // The website (no sign-in) sees only which tables are taken when, to offer
    // the free times: never who booked, their number, email, notes or GCash
    // details. A sign-in that has ended gets 401, not this list, so a staff
    // screen is sent back to the login instead of losing its bookings' details.
    $staff = currentStaff($pdo);
    if (!$staff && readAuthToken() !== '') {
        requireStaff($pdo);
    }
    if (!$staff) {
        // From yesterday (Manila), so a booking near midnight is still counted.
        $from = (new DateTime('now', new DateTimeZone('Asia/Manila')))->modify('-1 day')->format('Y-m-d');
        $stmt = $pdo->prepare(
            "SELECT id, reservation_date AS date, TIME_FORMAT(reservation_time, '%H:%i') AS time,
                    duration_minutes AS durationMinutes, table_id AS tableId, table_name AS tableName, status
             FROM reservations
             WHERE status IN ('pending', 'approved', 'reserved', 'arrived', 'seated')
               AND reservation_date >= ?
             ORDER BY reservation_date, reservation_time"
        );
        $stmt->execute([$from]);
        echo json_encode(['success' => true, 'reservations' => $stmt->fetchAll()]);
        exit();
    }

    // requestedAtMs: when the booking was sent, read by the database itself, so it
    // is right whatever time zone the database keeps (the admin's payment reminder).
    $stmt = $pdo->query(
        'SELECT id, customer_name AS customerName, phone, email, reservation_date AS date,
                TIME_FORMAT(reservation_time, "%H:%i") AS time, party_size AS partySize,
                duration_minutes AS durationMinutes,
                table_id AS tableId, table_name AS tableName, notes, status, source,
                payment_method AS paymentMethod, payment_reference AS paymentReference,
                payment_amount AS paymentAmount, payment_refund AS paymentRefund,
                requested_at AS requestedAt,
                UNIX_TIMESTAMP(requested_at) * 1000 AS requestedAtMs
         FROM reservations ORDER BY requested_at DESC'
    );
    echo json_encode(['success' => true, 'reservations' => $stmt->fetchAll()]);
    exit();
}

$body = readJsonBody();
$data = normalizeReservation($body);
if (!isValidReservation($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Complete reservation details are required']);
    exit();
}

// Staff book and change bookings signed in. The website (no sign-in) can only
// ask for a new online booking: always pending, and never over an existing one.
$staff = currentStaff($pdo);
if ($method === 'PUT' || ($method === 'POST' && $data['source'] !== 'online')) {
    $staff = requireStaff($pdo);
}
if ($method === 'POST' && !$staff) {
    $data['status'] = 'pending';
    $exists = $pdo->prepare('SELECT 1 FROM reservations WHERE id = ?');
    $exists->execute([$data['id']]);
    if ($exists->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This booking was already sent. Please start a new one.']);
        exit();
    }
}

if ($method === 'POST' && $data['source'] === 'online' && !onlineReservationsAreOpen($pdo)) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Online reservations are temporarily closed by the hall. Please check back later.',
    ]);
    exit();
}

if ($method === 'POST' && $data['source'] === 'online' && hallIsClosedNow($pdo)) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Break & Chill is closed now. Online reservations open again at ' . hallOpeningLabel($pdo) . '.'
            . ' If you already sent a GCash payment, please contact the hall with its reference number.',
    ]);
    exit();
}

// The website's own booking rules, kept here too since the form can be skipped:
// it is paid by GCash, so only once the admin has set the GCash account
// (Admin > Website), and it must fit the opening hours.
if ($method === 'POST' && !$staff) {
    $site = readSiteSettings($pdo);
    if (!gcashIsReady($site)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Online payment is not set up yet. Please book at the hall.']);
        exit();
    }
    $hoursError = bookingHoursError($data, $site['hours']);
    if ($hoursError !== '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => $hoursError]);
        exit();
    }

    // Optional: when given, the booking's updates are emailed too (config/customer_emails.php).
    if ($data['email'] !== '') {
        $email = normalizeEmail($data['email']);
        if ($email === '' || strlen($email) > 120) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Check your email address, or leave it blank.']);
            exit();
        }
        $data['email'] = $email;
    }

    // The payment: its reference, the GCash number it came from (where it goes
    // back if the booking is not approved) and a screenshot of the receipt.
    $payment = [
        'reference' => cleanPaymentReference($data['paymentReference']),
        'payerNumber' => cleanPayerNumber($body['payerNumber'] ?? ''),
    ];
    try {
        if ($payment['reference'] === '') {
            throw new PaymentRefusal(400, 'Please type the reference number from your GCash receipt (10 to 15 digits).');
        }
        if ($payment['payerNumber'] === '') {
            throw new PaymentRefusal(400, 'Please type the GCash number you paid from, in 09XXXXXXXXX format.');
        }
        $payment['image'] = readReceiptDataUrl($body['receipt'] ?? '');
    } catch (PaymentRefusal $refusal) {
        http_response_code($refusal->status);
        echo json_encode(['success' => false, 'message' => $refusal->getMessage()]);
        exit();
    }

    // What the booking costs, from the table's own rate rather than the request.
    $amount = bookingAmount($pdo, $data['tableId'], $data['durationMinutes']);
    if ($amount > 0) $data['paymentAmount'] = $amount;
    $data['paymentMethod'] = 'gcash';
    $data['paymentReference'] = $payment['reference'];
}

$deskBooking = $method === 'POST' && $staff && $data['source'] !== 'online';
if ($deskBooking) {
    try {
        checkDeskBooking($pdo, $data, readSiteSettings($pdo)['hours']);
    } catch (PaymentRefusal $refusal) {
        http_response_code($refusal->status);
        echo json_encode(['success' => false, 'message' => $refusal->getMessage()]);
        exit();
    }
}

if ($method === 'POST') {
    $tournament = getTournamentReservationConflict($pdo, $data);
    if ($tournament !== null) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => "This table is reserved for {$tournament['name']} from {$tournament['time']}. Please choose another table or time.",
        ]);
        exit();
    }
}

// A new booking, or one moved to another table or time, must not land on a
// table someone is still playing on. Status changes on a booking that stays put
// are not checked: its own guest may be the one at the table.
$movesSlot = $method === 'POST';
if ($method === 'PUT') {
    $stmt = $pdo->prepare(
        'SELECT reservation_date AS date, TIME_FORMAT(reservation_time, "%H:%i") AS time,
                duration_minutes AS durationMinutes, table_id AS tableId, status, payment_amount AS paymentAmount
         FROM reservations WHERE id = ?'
    );
    $stmt->execute([$data['id']]);
    $stored = $stmt->fetch();
    $storedStatus = $stored ? (string) $stored['status'] : '';
    $movesTime = !$stored
        || $stored['date'] !== $data['date']
        || $stored['time'] !== $data['time']
        || (int) $stored['durationMinutes'] !== (int) $data['durationMinutes'];
    $movesTable = $stored && (int) $stored['tableId'] !== (int) $data['tableId'];
    $movesSlot = $movesTime || $movesTable;

    // What was paid stays what it paid for: the same hours, at the same price.
    if ($stored && (float) $stored['paymentAmount'] > 0) {
        $paidRefusal = '';
        if ((int) $stored['durationMinutes'] !== (int) $data['durationMinutes']) {
            $paidRefusal = 'The hours of a paid booking stay as paid. To change them, cancel it and book again.';
        } elseif ($movesTable) {
            $amount = bookingAmount($pdo, $data['tableId'], $data['durationMinutes']);
            if ($amount === null || abs($amount - (float) $stored['paymentAmount']) >= 0.01) {
                $paidRefusal = "{$data['tableName']} costs a different amount for this booking. To move to it, cancel the booking and book again.";
            }
        }
        if ($paidRefusal !== '') {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => $paidRefusal]);
            exit();
        }
    }

    // A booking given a new time must fit the opening hours; one that stays on
    // its own time keeps it, even if the hours changed since.
    if ($movesTime) {
        $hoursError = bookingHoursError($data, readSiteSettings($pdo)['hours']);
        if ($hoursError !== '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $hoursError]);
            exit();
        }
    }
}
if ($movesSlot && in_array($data['status'], ['pending', 'approved', 'reserved'], true)) {
    $occupiedUntil = getOccupiedTableEnd($pdo, $data);
    if ($occupiedUntil !== null) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => "{$data['tableName']} is in use until about " . $occupiedUntil->format('g:i A')
                . '. Please choose another table or a later time.',
        ]);
        exit();
    }
}

if (hasScheduleConflict($pdo, $data)) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'This table is already occupied or reserved during the selected time. Please choose another table or time.',
    ]);
    exit();
}

if ($method === 'POST') {
    $stmt = $pdo->prepare(
        'INSERT INTO reservations
          (id, customer_name, phone, email, reservation_date, reservation_time, party_size, duration_minutes, table_id, table_name, notes, status, source, payment_method, payment_reference, payment_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           customer_name = VALUES(customer_name), phone = VALUES(phone), email = VALUES(email),
           reservation_date = VALUES(reservation_date), reservation_time = VALUES(reservation_time),
           party_size = VALUES(party_size), duration_minutes = VALUES(duration_minutes), table_id = VALUES(table_id), table_name = VALUES(table_name),
           notes = VALUES(notes), status = VALUES(status), source = VALUES(source),
           payment_method = VALUES(payment_method), payment_reference = VALUES(payment_reference),
           payment_amount = VALUES(payment_amount)'
    );
    // A booking and its payment are saved together, or neither is: a website
    // booking's held payment, or GCash taken at the desk.
    $receiptFile = null;
    try {
        if (!$staff) $receiptFile = storeReceipt($payment['image']);
        $pdo->beginTransaction();
        $stmt->execute([
            $data['id'], $data['customerName'], $data['phone'], $data['email'],
            $data['date'], $data['time'], $data['partySize'], $data['durationMinutes'], $data['tableId'],
            $data['tableName'], $data['notes'], $data['status'], $data['source'],
            $data['paymentMethod'], $data['paymentReference'], $data['paymentAmount'],
        ]);
        if (!$staff) {
            createHeldPayment($pdo, [
                'kind' => 'reservation',
                'refId' => $data['id'],
                'customerName' => $data['customerName'],
                'phone' => $data['phone'],
                'payerNumber' => $payment['payerNumber'],
                'reference' => $payment['reference'],
                'amount' => $data['paymentAmount'],
                'receiptFile' => $receiptFile,
                'playDate' => $data['date'],
            ]);
        }
        if ($deskBooking && $data['paymentMethod'] === 'gcash') {
            recordCounterPayment($pdo, [
                'reference' => $data['paymentReference'],
                'amount' => $data['paymentAmount'],
                'label' => "{$data['tableName']} · {$data['customerName']}",
                'saleKey' => 'reservation-' . $data['id'],
            ], (string) $staff['username']);
        }
        $pdo->commit();
    } catch (PaymentRefusal $refusal) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        deleteReceipt($receiptFile);
        http_response_code($refusal->status);
        echo json_encode(['success' => false, 'message' => $refusal->getMessage()]);
        exit();
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        deleteReceipt($receiptFile);
        error_log('Reservation save failed: ' . $error->getMessage());
        http_response_code(500);
        $message = $error->getCode() === '22007'
            ? 'Please select a valid reservation date and time.'
            : 'The reservation server could not save your request. Please try again.';
        echo json_encode(['success' => false, 'message' => $message]);
        exit();
    }

    // A booking from the website: the staff bells hear of it from here, since the
    // website itself cannot post notices. A missed notice never fails the booking.
    // It also gets a key, so the customer's browser can follow the booking
    // (api/request_status.php). Without one the booking still stands.
    $statusKey = null;
    if (!$staff) {
        try {
            addOnlineReservationNotice($pdo, $data);
        } catch (Throwable $error) {
            error_log('Online reservation notice failed: ' . $error->getMessage());
        }
        try {
            $statusKey = createWebsiteRequest($pdo, 'reservation', (string) $data['id']);
        } catch (Throwable $error) {
            error_log('Reservation status key failed: ' . $error->getMessage());
        }
    }

    echo json_encode(['success' => true, 'reservation' => $data] + ($statusKey ? ['statusKey' => $statusKey] : []));
    exit();
}

if ($method === 'PUT' && $data['status'] === 'arrived') {
    // Judged on the stored booking, not the times the request sends.
    $stmt = $pdo->prepare(
        'SELECT status, reservation_date AS date, TIME_FORMAT(reservation_time, "%H:%i") AS time
         FROM reservations WHERE id = ?'
    );
    $stmt->execute([$data['id']]);
    $stored = $stmt->fetch();
    if ($stored && in_array($stored['status'], ['approved', 'reserved'], true)
        && !isWithinArrivalWindow($stored['date'], $stored['time'])) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'This guest can be marked arrived only from the reserved time until '
                . RESERVATION_GRACE_MINUTES . ' minutes after it.',
        ]);
        exit();
    }
}

if ($method === 'PUT') {
    $refund = array_key_exists('refundPayment', $body) ? filter_var($body['refundPayment'], FILTER_VALIDATE_BOOLEAN) : null;
    // A desk booking's payment goes back as the booking is cancelled, or neither happens.
    $deskRefund = null;
    try {
        if ($refund === true && $storedStatus !== $data['status'] && in_array($data['status'], ['rejected', 'cancelled'], true)) {
            $deskRefund = readDeskRefund($pdo, $data['id'], $body);
        }
        $pdo->beginTransaction();
        $stmt = $pdo->prepare(
            'UPDATE reservations
             SET customer_name = ?, phone = ?, email = ?, reservation_date = ?, reservation_time = ?,
                 party_size = ?, duration_minutes = ?, table_id = ?, table_name = ?, notes = ?, status = ?, source = ?
             WHERE id = ?'
        );
        $stmt->execute([
            $data['customerName'], $data['phone'], $data['email'], $data['date'], $data['time'],
            $data['partySize'], $data['durationMinutes'], $data['tableId'], $data['tableName'], $data['notes'],
            $data['status'], $data['source'], $data['id'],
        ]);
        if ($deskRefund) {
            applyDeskRefund($pdo, $data['id'], $deskRefund, (string) $staff['username']);
            $data['paymentRefund'] = $deskRefund['method'];
        }
        $pdo->commit();
    } catch (PaymentRefusal $refusal) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code($refusal->status);
        echo json_encode(['success' => false, 'message' => $refusal->getMessage()]);
        exit();
    }

    // A website booking's payment follows it: kept once approved, sent back if
    // it is turned down, or if staff cancel it and say to (`refundPayment`).
    $settledPayment = null;
    if ($storedStatus !== $data['status']) {
        $settledPayment = settleReservationPayment($pdo, $data['id'], $data['status'], $refund, (string) $staff['username']);
        saleSafely(fn() => recordOnlineSale($pdo, $settledPayment, $staff));
        // A website customer is texted once it is decided.
        textSafely(fn() => textReservationDecision($pdo, (string) $data['id'], $data['status'], $settledPayment));
    }
    echo json_encode(['success' => true, 'reservation' => $data, 'payment' => $settledPayment]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
