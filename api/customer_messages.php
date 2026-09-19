<?php
require_once '../config/cors.php';
require_once '../config/database.php';

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

if ($method === 'POST') {
    $phone = preg_replace('/\D/', '', (string) ($data['phone'] ?? ''));
    $message = trim((string) ($data['message'] ?? ''));
    $context = trim((string) ($data['context'] ?? 'general'));
    $customerName = trim((string) ($data['customerName'] ?? ''));
    $referenceId = trim((string) ($data['referenceId'] ?? ''));

    if (!preg_match('/^09\d{9}$/', $phone)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'A valid 09XXXXXXXXX mobile number is required.']);
        exit();
    }

    if ($message === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'A message is required.']);
        exit();
    }

    if (!in_array($context, ['reservation', 'tournament', 'general'], true)) {
        $context = 'general';
    }

    $id = uniqid('msg-', true);
    $stmt = $pdo->prepare(
        'INSERT INTO customer_messages (id, phone, customer_name, context, reference_id, message, status)
         VALUES (?, ?, ?, ?, ?, ?, "queued")'
    );
    $stmt->execute([$id, $phone, $customerName, $context, $referenceId, mb_substr($message, 0, 1000)]);

    echo json_encode([
        'success' => true,
        'queued' => [
            'id' => $id,
            'phone' => $phone,
            'context' => $context,
            'message' => $message,
            'status' => 'queued',
        ],
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
