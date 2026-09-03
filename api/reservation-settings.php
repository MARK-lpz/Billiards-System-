<?php
require_once '../config/cors.php';
require_once '../config/database.php';

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

function reservationSettingsResponse($pdo) {
    $stmt = $pdo->query(
        'SELECT online_reservations_open, updated_at FROM reservation_settings WHERE id = 1'
    );
    $settings = $stmt->fetch();

    return [
        'onlineReservationsOpen' => (bool) ($settings['online_reservations_open'] ?? true),
        'updatedAt' => $settings['updated_at'] ?? null,
    ];
}

$pdo = getDBConnection();
ensureReservationSettingsTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(['success' => true, 'settings' => reservationSettingsResponse($pdo)]);
    exit();
}

if ($method !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true) ?: [];
if (!array_key_exists('onlineReservationsOpen', $data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Online reservation availability is required']);
    exit();
}

$onlineReservationsOpen = filter_var(
    $data['onlineReservationsOpen'],
    FILTER_VALIDATE_BOOLEAN,
    FILTER_NULL_ON_FAILURE
);

if ($onlineReservationsOpen === null) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Online reservation availability must be true or false']);
    exit();
}

$stmt = $pdo->prepare(
    'UPDATE reservation_settings
     SET online_reservations_open = ?
     WHERE id = 1'
);
$stmt->execute([(int) $onlineReservationsOpen]);

echo json_encode(['success' => true, 'settings' => reservationSettingsResponse($pdo)]);
?>
