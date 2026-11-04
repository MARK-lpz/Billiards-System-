<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/sms.php';
require_once '../config/mail.php';
require_once '../config/notices.php';

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

    // Only a hash of each code sent is kept, never the code itself.
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
 * The ways a code can be sent, in the order the login screen offers them:
 * "email" (the hall's Gmail, config/mail.php) and "sms" (Semaphore).
 */
function resetChannels(): array
{
    $channels = [];
    if (mailIsConfigured()) {
        $channels[] = 'email';
    }
    if (smsIsConfigured()) {
        $channels[] = 'sms';
    }
    return $channels;
}

/**
 * Finds the staff account (admin or employee: the form does not ask which)
 * only when the username and the registered email or mobile number (`$contact`,
 * by `$channel`) both match. Every mismatch gets the same reply, so this cannot
 * be used to find out which usernames, addresses or numbers exist, or whose
 * account is the admin's. An archived account never matches: it cannot sign in,
 * so there is no password of its to reset.
 */
function findVerifiedUser(PDO $pdo, string $username, string $channel, string $contact): ?array
{
    ensureAccountStatusColumns($pdo);
    $stmt = $pdo->prepare('SELECT id, username, role, phone, email, archived_at FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    if (!$user) {
        return null;
    }

    $registered = $channel === 'email'
        ? normalizeEmail((string) ($user['email'] ?? ''))
        : normalizeMobileNumber((string) $user['phone']);
    $matches = in_array(strtolower((string) $user['role']), ['admin', 'employee'], true)
        && $user['archived_at'] === null
        && $contact !== ''
        && $registered === $contact;

    return $matches ? $user : null;
}

function identityFailure(string $channel): void
{
    respond(401, [
        'success' => false,
        'message' => $channel === 'email'
            ? 'That username and email do not match a staff account.'
            : 'That username and mobile number do not match a staff account.',
    ]);
}

// "ju•••@gmail.com", for the reply once the code is on its way.
function maskEmail(string $email): string
{
    [$name, $domain] = explode('@', $email, 2);
    return mb_substr($name, 0, 2) . '•••@' . $domain;
}

// The email's HTML: the code large, then how long it lasts. Inline styles
// only, as mail apps ignore style sheets.
function resetCodeEmailHtml(string $username, string $code): string
{
    $name = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
    $minutes = RESET_CODE_MINUTES;
    return <<<HTML
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
  <h2 style="margin:0 0 4px;font-size:20px;color:#001233">Break &amp; Chill Billiard Hall</h2>
  <p style="margin:0 0 20px;color:#6b7280;font-size:14px">Password reset</p>
  <p style="font-size:15px">Hi {$name}, here is your code to reset your password:</p>
  <p style="margin:20px 0;padding:14px;border-radius:10px;background:#f3f4f6;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#001233">{$code}</p>
  <p style="font-size:14px">It expires in {$minutes} minutes. Do not share this code with anyone, not even the staff.</p>
  <p style="font-size:13px;color:#6b7280">If you did not ask to reset your password, ignore this email: your password stays the same.</p>
</div>
HTML;
}

$pdo = getDBConnection();
ensureResetTables($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Tells the login screen whether reset is available at all.
    if (isset($_GET['mode'])) {
        $channels = resetChannels();
        respond(200, ['success' => true, 'mode' => $channels ? 'code' : 'disabled', 'channels' => $channels]);
    }

    // Admin reads the history: who reset, and when. Never a password.
    requireStaff($pdo, ['admin']);
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
// By email (to the account's registered address) or by text (to its number);
// a page from before email codes sends no channel, only a phone.
$channel = ($data['channel'] ?? 'sms') === 'email' ? 'email' : 'sms';
$byEmail = $channel === 'email';
$contact = $byEmail
    ? normalizeEmail((string) ($data['email'] ?? ''))
    : normalizeMobileNumber((string) ($data['phone'] ?? ''));

if ($username === '' || $contact === '') {
    respond(400, [
        'success' => false,
        'message' => $byEmail
            ? 'Enter your username and the email address saved in your Profile.'
            : 'Enter your username and your registered mobile number in 09XXXXXXXXX format.',
    ]);
}

// Knowing a username and an address or number is not proof of identity: they
// are easy for coworkers to learn. Reset only ever happens with the code sent
// there, so a way that is not set up is switched off rather than left open.
if (!in_array($channel, resetChannels(), true)) {
    respond(409, [
        'success' => false,
        'message' => $byEmail ? 'Codes by email are not switched on yet.' : 'Text message codes are not switched on yet.',
    ]);
}

if ($action === 'send-code') {
    $user = findVerifiedUser($pdo, $username, $channel, $contact);
    if (!$user) {
        identityFailure($channel);
    }

    // Limits keep one person from flooding an inbox or phone, or running up the SMS bill.
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

    $sent = $byEmail
        ? sendMail(
            $contact,
            "Your Break & Chill password reset code: $code",
            "Hi {$user['username']},\n\n$message\n\nIf you did not ask to reset your password, ignore this email:"
                . " your password stays the same.\n\nBreak & Chill Billiard Hall",
            resetCodeEmailHtml((string) $user['username'], $code)
        )
        : sendSms($contact, $message);

    if (!$sent) {
        // A code that never arrived must not count against the limits.
        $pdo->prepare('DELETE FROM password_reset_codes WHERE id = ?')->execute([$codeId]);
        respond(502, [
            'success' => false,
            'message' => $byEmail
                ? 'The email could not be sent right now. Please try again.'
                : 'The text message could not be sent right now. Please try again.',
        ]);
    }

    respond(200, [
        'success' => true,
        'message' => $byEmail
            ? 'A 6-digit code was sent to ' . maskEmail($contact) . '.'
            : 'A 6-digit code was sent to your mobile number.',
        'expiresInMinutes' => RESET_CODE_MINUTES,
    ]);
}

if ($action !== 'reset') {
    respond(400, ['success' => false, 'message' => 'Unknown password reset action.']);
}

$newPassword = (string) ($data['newPassword'] ?? '');
if (mb_strlen($newPassword) < PASSWORD_MIN_LENGTH) {
    respond(400, ['success' => false, 'message' => 'Password must be at least ' . PASSWORD_MIN_LENGTH . ' characters.']);
}

$user = findVerifiedUser($pdo, $username, $channel, $contact);
if (!$user) {
    identityFailure($channel);
}

$code = preg_replace('/\D/', '', (string) ($data['code'] ?? ''));
if (strlen($code) !== 6) {
    respond(400, [
        'success' => false,
        'message' => $byEmail ? 'Enter the 6-digit code from the email.' : 'Enter the 6-digit code from the text message.',
    ]);
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

// Before the transaction: widening the column (once) would end it.
ensurePasswordColumn($pdo);
$pdo->beginTransaction();
try {
    $pdo->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([hashPassword($newPassword), $user['id']]);
    $pdo->prepare('INSERT INTO password_reset_log (user_id, username, role) VALUES (?, ?, ?)')
        ->execute([$user['id'], $user['username'], $user['role']]);
    $logId = $pdo->lastInsertId();
    $pdo->prepare('UPDATE password_reset_codes SET used_at = NOW() WHERE id = ?')->execute([$codeRow['id']]);
    $pdo->commit();
} catch (Throwable $error) {
    $pdo->rollBack();
    respond(500, ['success' => false, 'message' => 'Unable to reset the password right now.']);
}
// A lock from wrong guesses ends with the new password.
clearSignInFailures($pdo, $user['username']);

// The admin's bell is told THAT it happened (who, and how), never the password.
try {
    addStaffNotice(
        $pdo,
        'password-reset-' . $logId,
        'password-reset',
        "{$user['username']} ({$user['role']}) reset their own password with a code "
            . ($byEmail ? 'emailed to their registered email.' : 'texted to their registered number.'),
        ['username' => $user['username'], 'role' => $user['role'], 'channel' => $channel],
        ['admin']
    );
} catch (Throwable $error) {
    error_log('Password reset notice failed: ' . $error->getMessage());
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
