<?php
require_once '../config/cors.php';
require_once '../config/database.php';

function readJsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function ensureNotificationsTable($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(80) NOT NULL,
            recipient VARCHAR(20) NOT NULL,
            type VARCHAR(80) NOT NULL,
            message VARCHAR(1000) NOT NULL,
            notification_data TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            read_at DATETIME NULL,
            dismissed_at DATETIME NULL,
            PRIMARY KEY (id, recipient),
            INDEX notifications_recipient_created (recipient, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

function validRecipient($recipient) {
    return in_array($recipient, ['admin', 'employee'], true);
}

$pdo = getDBConnection();
ensureNotificationsTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $recipient = $_GET['recipient'] ?? '';
    if (!validRecipient($recipient)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'A valid recipient is required']);
        exit();
    }

    $stmt = $pdo->prepare(
        'SELECT id, type, message, notification_data AS data, created_at AS createdAt, read_at AS readAt
         FROM notifications
         WHERE recipient = ? AND dismissed_at IS NULL
         ORDER BY created_at DESC
         LIMIT 100'
    );
    $stmt->execute([$recipient]);
    $notifications = array_map(function ($notification) {
        $notification['data'] = $notification['data'] ? json_decode($notification['data'], true) : null;
        $notification['unread'] = !$notification['readAt'];
        $notification['time'] = 'Just now';
        return $notification;
    }, $stmt->fetchAll());

    echo json_encode(['success' => true, 'notifications' => $notifications]);
    exit();
}

if ($method === 'POST') {
    $data = readJsonBody();
    $id = trim($data['id'] ?? '');
    $message = trim($data['message'] ?? '');
    $type = trim($data['type'] ?? 'general') ?: 'general';
    $recipients = array_values(array_filter($data['recipients'] ?? [], 'validRecipient'));

    if ($id === '' || $message === '' || !$recipients) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Notification id, message, and recipients are required']);
        exit();
    }

    $payload = isset($data['data']) ? json_encode($data['data']) : null;
    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO notifications (id, recipient, type, message, notification_data)
         VALUES (?, ?, ?, ?, ?)'
    );
    foreach (array_unique($recipients) as $recipient) {
        $stmt->execute([$id, $recipient, $type, $message, $payload]);
    }

    echo json_encode(['success' => true]);
    exit();
}

if ($method === 'PUT') {
    $data = readJsonBody();
    $id = trim($data['id'] ?? '');
    $recipient = $data['recipient'] ?? '';
    $action = $data['action'] ?? '';

    if ($id === '' || !validRecipient($recipient) || !in_array($action, ['read', 'dismiss'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid notification update']);
        exit();
    }

    $column = $action === 'read' ? 'read_at' : 'dismissed_at';
    $stmt = $pdo->prepare("UPDATE notifications SET $column = NOW() WHERE id = ? AND recipient = ?");
    $stmt->execute([$id, $recipient]);

    echo json_encode(['success' => true]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
