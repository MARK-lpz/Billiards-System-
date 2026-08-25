<?php
require_once '../config/cors.php';
require_once '../config/database.php';

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
        'tableId' => (int) ($reservation['tableId'] ?? $reservation['table_id'] ?? 0),
        'tableName' => trim($reservation['tableName'] ?? $reservation['table_name'] ?? ''),
        'notes' => trim($reservation['notes'] ?? ''),
        'status' => $reservation['status'] ?? 'pending',
        'source' => $reservation['source'] ?? 'online',
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

function expirePastReservations($pdo) {
    $now = new DateTime('now', new DateTimeZone('Asia/Manila'));
    $stmt = $pdo->prepare(
        "UPDATE reservations
         SET status = 'expired'
         WHERE status IN ('approved', 'reserved')
           AND TIMESTAMP(reservation_date, reservation_time) < ?"
    );
    $stmt->execute([$now->format('Y-m-d H:i:s')]);
}

$pdo = getDBConnection();
ensureReservationsTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    expirePastReservations($pdo);
    $stmt = $pdo->query(
        'SELECT id, customer_name AS customerName, phone, email, reservation_date AS date,
                TIME_FORMAT(reservation_time, "%H:%i") AS time, party_size AS partySize,
                table_id AS tableId, table_name AS tableName, notes, status, source,
                requested_at AS requestedAt
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

if ($method === 'POST') {
    $stmt = $pdo->prepare(
        'INSERT INTO reservations
          (id, customer_name, phone, email, reservation_date, reservation_time, party_size, table_id, table_name, notes, status, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           customer_name = VALUES(customer_name), phone = VALUES(phone), email = VALUES(email),
           reservation_date = VALUES(reservation_date), reservation_time = VALUES(reservation_time),
           party_size = VALUES(party_size), table_id = VALUES(table_id), table_name = VALUES(table_name),
           notes = VALUES(notes), status = VALUES(status), source = VALUES(source)'
    );
    try {
        $stmt->execute([
            $data['id'], $data['customerName'], $data['phone'], $data['email'],
            $data['date'], $data['time'], $data['partySize'], $data['tableId'],
            $data['tableName'], $data['notes'], $data['status'], $data['source'],
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

    echo json_encode(['success' => true, 'reservation' => $data]);
    exit();
}

if ($method === 'PUT') {
    $stmt = $pdo->prepare(
        'UPDATE reservations
         SET customer_name = ?, phone = ?, email = ?, reservation_date = ?, reservation_time = ?,
             party_size = ?, table_id = ?, table_name = ?, notes = ?, status = ?, source = ?
         WHERE id = ?'
    );
    $stmt->execute([
        $data['customerName'], $data['phone'], $data['email'], $data['date'], $data['time'],
        $data['partySize'], $data['tableId'], $data['tableName'], $data['notes'],
        $data['status'], $data['source'], $data['id'],
    ]);
    echo json_encode(['success' => true, 'reservation' => $data]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
