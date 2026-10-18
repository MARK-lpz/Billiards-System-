<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/notices.php';

function readJsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

// The most notices one update changes at once (Mark all as read).
const MAX_NOTICES_PER_UPDATE = 200;

$pdo = getDBConnection();
ensureNotificationsTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $staff = requireStaff($pdo);
    $recipient = $_GET['recipient'] ?? '';
    if (!isNoticeRecipient($recipient)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'A valid recipient is required']);
        exit();
    }

    if ($recipient !== $staff['role']) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'These notifications are for another role.']);
        exit();
    }

    // createdAtMs: when it was added, read by the database itself, so the bell
    // shows the right time whatever time zone the database keeps.
    $stmt = $pdo->prepare(
        'SELECT id, type, message, notification_data AS data, created_at AS createdAt,
                UNIX_TIMESTAMP(created_at) * 1000 AS createdAtMs, read_at AS readAt
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

// Only signed-in staff send notices (e.g. the front desk to the admin). The
// website sends none: a new online booking is announced by reservations.php.
if ($method === 'POST') {
    requireStaff($pdo);
    $data = readJsonBody();
    $id = trim($data['id'] ?? '');
    $message = trim($data['message'] ?? '');
    $type = trim($data['type'] ?? 'general') ?: 'general';
    $recipients = array_values(array_filter($data['recipients'] ?? [], 'isNoticeRecipient'));

    if ($id === '' || $message === '' || !$recipients) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Notification id, message, and recipients are required']);
        exit();
    }

    addStaffNotice($pdo, $id, $type, $message, $data['data'] ?? null, $recipients);
    echo json_encode(['success' => true]);
    exit();
}

// Marks notices read or dismissed: one (`id`) or many at once (`ids`), so Mark all
// as read is one request.
if ($method === 'PUT') {
    $staff = requireStaff($pdo);
    $data = readJsonBody();
    $ids = isset($data['ids']) && is_array($data['ids']) ? $data['ids'] : [$data['id'] ?? ''];
    $ids = array_values(array_unique(array_filter(array_map(fn ($id) => trim((string) $id), $ids), 'strlen')));
    $recipient = $data['recipient'] ?? '';
    $action = $data['action'] ?? '';

    if (!$ids || count($ids) > MAX_NOTICES_PER_UPDATE || !isNoticeRecipient($recipient) || !in_array($action, ['read', 'dismiss'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid notification update']);
        exit();
    }

    if ($recipient !== $staff['role']) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'These notifications are for another role.']);
        exit();
    }

    $column = $action === 'read' ? 'read_at' : 'dismissed_at';
    $placeholders = implode(', ', array_fill(0, count($ids), '?'));
    // The first time counts: reading a notice again keeps when it was first read.
    $stmt = $pdo->prepare("UPDATE notifications SET $column = NOW() WHERE recipient = ? AND $column IS NULL AND id IN ($placeholders)");
    $stmt->execute([$recipient, ...$ids]);

    echo json_encode(['success' => true, 'updated' => $stmt->rowCount()]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
