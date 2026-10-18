<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/collection.php';
require_once '../config/notices.php';
require_once '../config/site_settings.php';

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

    // Payment details for online GCash reservations.
    foreach ([
        'payment_method' => "ALTER TABLE reservations ADD COLUMN payment_method VARCHAR(20) NULL",
        'payment_reference' => "ALTER TABLE reservations ADD COLUMN payment_reference VARCHAR(40) NULL",
        'payment_amount' => "ALTER TABLE reservations ADD COLUMN payment_amount DECIMAL(10,2) NOT NULL DEFAULT 0",
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

function ensureReservationSettingsTable($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS reservation_settings (
            id TINYINT UNSIGNED PRIMARY KEY,
            online_reservations_open TINYINT(1) NOT NULL DEFAULT 1,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO reservation_settings (id, online_reservations_open) VALUES (1, 1)'
    );
    $stmt->execute();
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

function onlineReservationsAreOpen($pdo) {
    $stmt = $pdo->query(
        'SELECT online_reservations_open FROM reservation_settings WHERE id = 1'
    );
    $setting = $stmt->fetchColumn();

    return $setting === false || (bool) $setting;
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

$pdo = getDBConnection();
ensureReservationsTable($pdo);
ensureReservationSettingsTable($pdo);
ensureTournamentEventsTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    expirePastReservations($pdo);
    // requestedAtMs: when the booking was sent, read by the database itself, so it
    // is right whatever time zone the database keeps (the admin's payment reminder).
    $stmt = $pdo->query(
        'SELECT id, customer_name AS customerName, phone, email, reservation_date AS date,
                TIME_FORMAT(reservation_time, "%H:%i") AS time, party_size AS partySize,
                duration_minutes AS durationMinutes,
                table_id AS tableId, table_name AS tableName, notes, status, source,
                payment_method AS paymentMethod, payment_reference AS paymentReference,
                payment_amount AS paymentAmount,
                requested_at AS requestedAt,
                UNIX_TIMESTAMP(requested_at) * 1000 AS requestedAtMs
         FROM reservations ORDER BY requested_at DESC'
    );
    echo json_encode(['success' => true, 'reservations' => $stmt->fetchAll()]);
    exit();
}

$data = normalizeReservation(readJsonBody());
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
        'message' => 'Online reservations are temporarily closed by the owner. Please check back later.',
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
        'SELECT reservation_date AS date, TIME_FORMAT(reservation_time, "%H:%i") AS time, table_id AS tableId
         FROM reservations WHERE id = ?'
    );
    $stmt->execute([$data['id']]);
    $stored = $stmt->fetch();
    $movesSlot = !$stored
        || $stored['date'] !== $data['date']
        || $stored['time'] !== $data['time']
        || (int) $stored['tableId'] !== (int) $data['tableId'];
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
    try {
        $stmt->execute([
            $data['id'], $data['customerName'], $data['phone'], $data['email'],
            $data['date'], $data['time'], $data['partySize'], $data['durationMinutes'], $data['tableId'],
            $data['tableName'], $data['notes'], $data['status'], $data['source'],
            $data['paymentMethod'], $data['paymentReference'], $data['paymentAmount'],
        ]);
    } catch (PDOException $error) {
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
    if (!$staff) {
        try {
            addOnlineReservationNotice($pdo, $data);
        } catch (Throwable $error) {
            error_log('Online reservation notice failed: ' . $error->getMessage());
        }
    }

    echo json_encode(['success' => true, 'reservation' => $data]);
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
    echo json_encode(['success' => true, 'reservation' => $data]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
