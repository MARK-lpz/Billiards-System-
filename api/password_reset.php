<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/sms.php';

const RESET_CODE_MINUTES = 10;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_CODE_RESEND_SECONDS = 60;
const RESET_CODE_MAX_PER_HOUR = 5;

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit();
}

function ensureResetTables(PDO $pdo): void
{
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

    // Only a hash of each texted code is kept, never the code itself.
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS password_reset_codes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            code_hash VARCHAR(255) NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX password_reset_codes_user (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

/**
 * Finds the account only when username, role and registered mobile number all
 * match. Every mismatch gets the same reply, so this cannot be used to find
 * out which usernames or numbers exist.
 */
function findVerifiedUser(PDO $pdo, string $username, string $role, string $mobile): ?array
{
    $stmt = $pdo->prepare('SELECT id, username, role, phone FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    $matches = $user
        && strtolower((string) $user['role']) === $role
        && $mobile !== ''
        && normalizeMobileNumber((string) $user['phone']) === $mobile;

    return $matches ? $user : null;
}

function identityFailure(string $role): void
{
    respond(401, [
        'success' => false,
        'message' => "That username and mobile number do not match an $role account.",
    ]);
}

$pdo = getDBConnection();
ensureResetTables($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Tells the login screen whether reset is available at all.
    if (isset($_GET['mode'])) {
        respond(200, ['success' => true, 'mode' => smsIsConfigured() ? 'sms-code' : 'disabled']);
    }

    // Admin reads the history: who reset, and when. Never a password.
    $stmt = $pdo->query(
        'SELECT id, username, role, reset_at AS resetAt
         FROM password_reset_log
         ORDER BY reset_at DESC
         LIMIT 100'
    );
    respond(200, ['success' => true, 'resets' => $stmt->fetchAll()]);
}

if ($method !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Method not allowed']);
}

$data = json_decode(file_get_contents('php://input'), true) ?: [];
$action = (string) ($data['action'] ?? 'reset');
$username = trim((string) ($data['username'] ?? ''));
$role = ($data['role'] ?? 'employee') === 'admin' ? 'admin' : 'employee';
$mobile = normalizeMobileNumber((string) ($data['phone'] ?? ''));

if ($username === '' || $mobile === '') {
    respond(400, [
        'success' => false,
        'message' => 'Enter your username and your registered mobile number in 09XXXXXXXXX format.',
    ]);
}

if ($action === 'send-code') {
    if (!smsIsConfigured()) {
        respond(409, ['success' => false, 'message' => 'Text message codes are not switched on yet.']);
    }

    $user = findVerifiedUser($pdo, $username, $role, $mobile);
    if (!$user) {
        identityFailure($role);
    }

    // Limits keep one person from flooding a phone or running up the SMS bill.
    $recent = $pdo->prepare(
        'SELECT
            SUM(created_at > NOW() - INTERVAL ' . RESET_CODE_RESEND_SECONDS . ' SECOND) AS lastMinute,
            COUNT(*) AS lastHour
         FROM password_reset_codes
         WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 HOUR'
    );
    $recent->execute([$user['id']]);
    $counts = $recent->fetch();
    if ((int) $counts['lastMinute'] > 0) {
        respond(429, ['success' => false, 'message' => 'A code was just sent. Please wait a minute before asking for another.']);
    }
    if ((int) $counts['lastHour'] >= RESET_CODE_MAX_PER_HOUR) {
        respond(429, ['success' => false, 'message' => 'Too many codes were requested. Please try again in an hour.']);
    }

    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

    // Only the newest code works, so an older text can never be reused.
    $pdo->prepare('UPDATE password_reset_codes SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL')
        ->execute([$user['id']]);
    $pdo->prepare(
        'INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
         VALUES (?, ?, NOW() + INTERVAL ' . RESET_CODE_MINUTES . ' MINUTE)'
    )->execute([$user['id'], password_hash($code, PASSWORD_DEFAULT)]);
    $codeId = (int) $pdo->lastInsertId();

    $message = "Break & Chill: Your password reset code is $code. It expires in " . RESET_CODE_MINUTES
        . ' minutes. Do not share this code with anyone.';

    if (!sendSms($mobile, $message)) {
        // A code that never arrived must not count against the limits.
        $pdo->prepare('DELETE FROM password_reset_codes WHERE id = ?')->execute([$codeId]);
        respond(502, ['success' => false, 'message' => 'The text message could not be sent right now. Please try again.']);
    }

    respond(200, [
        'success' => true,
        'message' => 'A 6-digit code was sent to your mobile number.',
        'expiresInMinutes' => RESET_CODE_MINUTES,
    ]);
}

if ($action !== 'reset') {
    respond(400, ['success' => false, 'message' => 'Unknown password reset action.']);
}

// Knowing a username and mobile number is not proof of identity: both are easy
// for coworkers to learn. Reset only ever happens with the texted code, so
// without an SMS provider it is switched off rather than left open.
if (!smsIsConfigured()) {
    respond(403, ['success' => false, 'message' => 'Password reset by text message is not switched on yet.']);
}

$newPassword = (string) ($data['newPassword'] ?? '');
if (mb_strlen($newPassword) < 6) {
    respond(400, ['success' => false, 'message' => 'Password must be at least 6 characters.']);
}

$user = findVerifiedUser($pdo, $username, $role, $mobile);
if (!$user) {
    identityFailure($role);
}

$code = preg_replace('/\D/', '', (string) ($data['code'] ?? ''));
if (strlen($code) !== 6) {
    respond(400, ['success' => false, 'message' => 'Enter the 6-digit code from the text message.']);
}

$stmt = $pdo->prepare(
    'SELECT id, code_hash, attempts FROM password_reset_codes
     WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1'
);
$stmt->execute([$user['id']]);
$codeRow = $stmt->fetch();

if (!$codeRow) {
    respond(400, ['success' => false, 'message' => 'This code has expired. Please ask for a new one.']);
}
if ((int) $codeRow['attempts'] >= RESET_CODE_MAX_ATTEMPTS) {
    respond(429, ['success' => false, 'message' => 'Too many wrong codes. Please ask for a new one.']);
}
if (!password_verify($code, $codeRow['code_hash'])) {
    $pdo->prepare('UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = ?')->execute([$codeRow['id']]);
    $left = RESET_CODE_MAX_ATTEMPTS - ((int) $codeRow['attempts'] + 1);
    respond(401, [
        'success' => false,
        'message' => $left > 0
            ? "That code is not correct. $left " . ($left === 1 ? 'try' : 'tries') . ' left.'
            : 'Too many wrong codes. Please ask for a new one.',
    ]);
}

$pdo->beginTransaction();
try {
    $pdo->prepare('UPDATE users SET password = MD5(?) WHERE id = ?')->execute([$newPassword, $user['id']]);
    $pdo->prepare('INSERT INTO password_reset_log (user_id, username, role) VALUES (?, ?, ?)')
        ->execute([$user['id'], $user['username'], $user['role']]);
    $pdo->prepare('UPDATE password_reset_codes SET used_at = NOW() WHERE id = ?')->execute([$codeRow['id']]);
    $pdo->commit();
} catch (Throwable $error) {
    $pdo->rollBack();
    respond(500, ['success' => false, 'message' => 'Unable to reset the password right now.']);
}

respond(200, [
    'success' => true,
    'message' => 'Password updated. You can now sign in with your new password.',
    'reset' => [
        'username' => $user['username'],
        'role' => $user['role'],
        'resetAt' => date('c'),
    ],
]);
