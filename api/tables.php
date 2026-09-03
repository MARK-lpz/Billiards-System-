<?php
require_once '../config/cors.php';
require_once '../config/database.php';

function ensureTableStatusStore($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS pool_table_status (
            id TINYINT PRIMARY KEY,
            tables_json LONGTEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

$pdo = getDBConnection();
ensureTableStatusStore($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query('SELECT tables_json FROM pool_table_status WHERE id = 1');
    $storedTables = $stmt->fetchColumn();
    $tables = $storedTables ? json_decode($storedTables, true) : [];

    echo json_encode(['success' => true, 'tables' => is_array($tables) ? $tables : []]);
    exit();
}

if ($method === 'PUT') {
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $tables = $payload['tables'] ?? null;

    if (!is_array($tables)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'A valid table list is required.']);
        exit();
    }

    $stmt = $pdo->prepare(
        'INSERT INTO pool_table_status (id, tables_json) VALUES (1, ?)
         ON DUPLICATE KEY UPDATE tables_json = VALUES(tables_json)'
    );
    $stmt->execute([json_encode($tables)]);

    echo json_encode(['success' => true]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
