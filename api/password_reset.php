<?php
require_once '../config/cors.php';
require_once '../config/database.php';

function ensureResetLogTable($pdo) {
    // Deliberately stores no password of any kind: only the fact that a reset happened.
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS password_reset_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            username VARCHAR(50) NOT NULL,
            role VARCHAR(20) NOT NULL,
            reset_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX password_reset_log_reset_at (reset_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

$pdo = getDBConnection();
ensureResetLogTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

// Admin reads the history: who reset, and when. Never a password.
if ($method === 'GET') {
    $stmt = $pdo->query(
        'SELECT id, username, role, reset_at AS resetAt
         FROM password_reset_log
         ORDER BY reset_at DESC
         LIMIT 100'
    );

    echo json_encode(['success' => true, 'resets' => $stmt->fetchAll()]);
    exit();
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true) ?: [];
$username = trim((string) ($data['username'] ?? ''));
$email = strtolower(trim((string) ($data['email'] ?? '')));
$newPassword = (string) ($data['newPassword'] ?? '');

if ($username === '' || $email === '' || $newPassword === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Username, registered email and new password are required.']);
    exit();
}

if (strlen($newPassword) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters.']);
    exit();
}

$stmt = $pdo->prepare('SELECT id, username, role, email FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
$user = $stmt->fetch();

// The same reply for a wrong username and a wrong email, so this cannot be used
// to discover which accounts exist.
$identityFailed = !$user
    || $user['role'] !== 'employee'
    || $user['email'] === null
    || strtolower(trim((string) $user['email'])) !== $email;

if ($identityFailed) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'That username and registered email do not match an employee account.',
    ]);
    exit();
}

$pdo->beginTransaction();
try {
    $update = $pdo->prepare('UPDATE users SET password = MD5(?) WHERE id = ?');
    $update->execute([$newPassword, $user['id']]);

    $log = $pdo->prepare('INSERT INTO password_reset_log (user_id, username, role) VALUES (?, ?, ?)');
    $log->execute([$user['id'], $user['username'], $user['role']]);

    $pdo->commit();
} catch (Throwable $error) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to reset the password right now.']);
    exit();
}

echo json_encode([
    'success' => true,
    'message' => 'Password updated. You can now sign in with your new password.',
    'reset' => [
        'username' => $user['username'],
        'role' => $user['role'],
        'resetAt' => date('c'),
    ],
]);
?>
