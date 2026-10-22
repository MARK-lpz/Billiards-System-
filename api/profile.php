<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/ledger.php';
require_once '../config/notices.php';

// The signed-in staff member's own Profile page, admin and employee alike: their
// details, their picture and what they did lately, never anyone else's. The
// username and role stay the admin's to change, in Accounts (api/users.php).
//
//   GET                                                   -> { profile }
//   POST { action: "details", fullName, email, phone, currentPassword }
//   POST { action: "password", currentPassword, newPassword }
//   POST { action: "photo", photo: "data:image/webp;base64,..." | null }
//
// A new mobile number (where password reset codes are texted) or a new password
// needs the current password first, so a screen left signed in cannot be used to
// take the account over. Wrong passwords count toward the same lock as signing in.
// Pictures are kept in staff_photos, beside the accounts; like the accounts, they
// are not in backups (see api/backup.php).

// A staff picture is redrawn small in the browser (see utils/profilePhoto.js).
const PROFILE_PHOTO_MAX_BYTES = 300 * 1024;
const PROFILE_PHOTO_MIN_SIDE = 64;
const PROFILE_PHOTO_MAX_SIDE = 1024;
// Entries shown under "My recent activity".
const PROFILE_ACTIVITY_LIMIT = 5;

function refuse(int $status, string $message, string $field = '', string $code = ''): void
{
    http_response_code($status);
    echo json_encode(array_filter(
        ['success' => false, 'message' => $message, 'field' => $field, 'code' => $code],
        fn($value) => $value !== ''
    ));
    exit();
}

function ensureStaffPhotos(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS staff_photos (
            user_id INT NOT NULL PRIMARY KEY,
            photo MEDIUMTEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

// What this account itself did, from the Audit Trail, newest first by the time
// it was done, not by when it reached the server: a browser's older entries went
// up all at once on its first sign-in. Only entries made as this account's role
// count, since that browser may also have held another role's entries.
function recentActivity(PDO $pdo, string $username, string $role): array
{
    $spec = openLedger($pdo, 'audit');
    $stmt = $pdo->prepare(
        "SELECT item_json FROM `{$spec['table']}`
         WHERE created_by = ? AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(item_json, '\$.staff'))) = ?
         ORDER BY JSON_UNQUOTE(JSON_EXTRACT(item_json, '\$.timestamp')) DESC, seq DESC
         LIMIT " . PROFILE_ACTIVITY_LIMIT
    );
    $stmt->execute([$username, $role]);
    $activity = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $json) {
        $entry = json_decode($json, true);
        if (!is_array($entry)) continue;
        $activity[] = [
            'id' => ledgerItemId($entry['id'] ?? ''),
            'action' => mb_substr(is_scalar($entry['action'] ?? null) ? (string) $entry['action'] : '', 0, 120),
            'detail' => mb_substr(is_scalar($entry['detail'] ?? null) ? (string) $entry['detail'] : '', 0, 240),
            'timestamp' => is_scalar($entry['timestamp'] ?? null) ? (string) $entry['timestamp'] : '',
        ];
    }
    return $activity;
}

function profileOf(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('SELECT id, username, role, email, full_name, phone, created_at FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) refuse(404, 'This account no longer exists. Please sign in again.');

    ensureStaffPhotos($pdo);
    $photo = $pdo->prepare('SELECT photo FROM staff_photos WHERE user_id = ?');
    $photo->execute([$userId]);

    return [
        'id' => (int) $user['id'],
        'username' => (string) $user['username'],
        'role' => strtolower((string) $user['role']),
        'fullName' => (string) ($user['full_name'] ?? ''),
        'email' => (string) ($user['email'] ?? ''),
        'phone' => (string) ($user['phone'] ?? ''),
        'memberSince' => $user['created_at'] ?? null,
        'photo' => $photo->fetchColumn() ?: null,
        'activity' => recentActivity($pdo, (string) $user['username'], strtolower((string) $user['role'])),
    ];
}

function sendProfile(PDO $pdo, int $userId): void
{
    echo json_encode(['success' => true, 'profile' => profileOf($pdo, $userId)]);
    exit();
}

// Stops the request unless $password is this account's. A wrong one counts
// toward the sign-in lock (config/auth.php), so it cannot be guessed here instead.
function confirmCurrentPassword(PDO $pdo, array $staff, string $password): void
{
    $wait = signInLockMinutes($pdo, $staff['username']);
    if ($wait > 0) refuse(429, signInLockMessage($wait), 'currentPassword', 'locked');
    if ($password === '') refuse(400, 'Enter your current password.', 'currentPassword');

    $stmt = $pdo->prepare('SELECT password FROM users WHERE id = ?');
    $stmt->execute([$staff['id']]);
    if (checkPassword($pdo, $staff['id'], $stmt->fetchColumn() ?: '', $password)) return;

    $locked = in_array('user', recordSignInFailure($pdo, $staff['username']), true);
    refuse(
        $locked ? 429 : 400,
        $locked ? signInLockMessage(LOGIN_LOCK_MINUTES) : 'Your current password is not right.',
        'currentPassword',
        $locked ? 'locked' : ''
    );
}

// The admin hears when an employee changes what their sign-in depends on.
function tellAdmin(PDO $pdo, array $staff, string $what): void
{
    if ($staff['role'] !== 'employee') return;
    try {
        addStaffNotice(
            $pdo,
            'account-change-' . $staff['id'] . '-' . time() . '-' . bin2hex(random_bytes(3)),
            'account-change',
            "{$staff['username']} changed their {$what} from their Profile.",
            ['username' => $staff['username']],
            ['admin']
        );
    } catch (Throwable $error) {
        error_log('Profile notice failed: ' . $error->getMessage());
    }
}

/** The picture as sent, once it is checked to be a real JPG, PNG or WebP of a sensible size. */
function readPhotoDataUrl($dataUrl): string
{
    $dataUrl = (string) $dataUrl;
    if (!preg_match('#^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$#', $dataUrl, $match)) {
        refuse(400, 'Choose a picture (JPG, PNG or WebP).', 'photo');
    }
    if (strlen($match[2]) > intdiv(PROFILE_PHOTO_MAX_BYTES * 4, 3) + 8) {
        refuse(413, 'This picture is too large. Choose another one.', 'photo');
    }
    $bytes = base64_decode($match[2], true);
    $info = $bytes ? @getimagesizefromstring($bytes) : false;
    if (!$info || ($info['mime'] ?? '') !== "image/{$match[1]}") {
        refuse(400, 'This picture could not be opened. Choose a JPG, PNG or WebP picture.', 'photo');
    }
    if (min($info[0], $info[1]) < PROFILE_PHOTO_MIN_SIDE) {
        refuse(400, 'This picture is too small. Choose a clearer one.', 'photo');
    }
    if (max($info[0], $info[1]) > PROFILE_PHOTO_MAX_SIDE) {
        refuse(413, 'This picture is too large. Choose another one.', 'photo');
    }
    return $dataUrl;
}

$pdo = getDBConnection();
$staff = requireStaff($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') sendProfile($pdo, $staff['id']);

if ($method !== 'POST') refuse(405, 'Method not allowed');

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) refuse(400, 'The changes could not be read.');
$action = (string) ($data['action'] ?? '');

if ($action === 'details') {
    $fullName = trim((string) ($data['fullName'] ?? ''));
    $email = trim((string) ($data['email'] ?? ''));
    $phone = trim((string) ($data['phone'] ?? ''));

    if ($fullName === '') refuse(400, 'Enter your full name.', 'fullName');
    if (mb_strlen($fullName) > 120) refuse(400, 'Keep your full name to 120 characters or fewer.', 'fullName');
    if ($email !== '' && (mb_strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL))) {
        refuse(400, 'Enter a valid email address, or leave it blank.', 'email');
    }
    if ($phone !== '' && !preg_match('/^09\d{9}$/', $phone)) {
        refuse(400, 'Enter the mobile number in 09XXXXXXXXX format, or leave it blank.', 'phone');
    }

    $stmt = $pdo->prepare('SELECT phone FROM users WHERE id = ?');
    $stmt->execute([$staff['id']]);
    $phoneChanged = $phone !== (string) $stmt->fetchColumn();
    if ($phoneChanged) confirmCurrentPassword($pdo, $staff, (string) ($data['currentPassword'] ?? ''));

    $pdo->prepare('UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?')
        ->execute([$fullName, $email, $phone, $staff['id']]);
    if ($phoneChanged) tellAdmin($pdo, $staff, 'mobile number for password resets');
    sendProfile($pdo, $staff['id']);
}

if ($action === 'password') {
    $current = (string) ($data['currentPassword'] ?? '');
    $new = (string) ($data['newPassword'] ?? '');
    if (mb_strlen($new) < PASSWORD_MIN_LENGTH) {
        refuse(400, 'Use at least ' . PASSWORD_MIN_LENGTH . ' characters for the new password.', 'newPassword');
    }
    confirmCurrentPassword($pdo, $staff, $current);
    if ($new === $current) refuse(400, 'Choose a password different from your current one.', 'newPassword');

    ensurePasswordColumn($pdo);
    $pdo->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([hashPassword($new), $staff['id']]);
    clearSignInFailures($pdo, $staff['username']);
    // Every other place this account is signed in has to sign in again.
    $pdo->prepare('DELETE FROM auth_sessions WHERE user_id = ? AND token_hash <> ?')
        ->execute([$staff['id'], hash('sha256', readAuthToken())]);
    tellAdmin($pdo, $staff, 'password');
    sendProfile($pdo, $staff['id']);
}

if ($action === 'photo') {
    ensureStaffPhotos($pdo);
    $photo = $data['photo'] ?? null;
    if ($photo === null || $photo === '') {
        $pdo->prepare('DELETE FROM staff_photos WHERE user_id = ?')->execute([$staff['id']]);
    } else {
        $pdo->prepare(
            'INSERT INTO staff_photos (user_id, photo) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE photo = VALUES(photo)'
        )->execute([$staff['id'], readPhotoDataUrl($photo)]);
    }
    sendProfile($pdo, $staff['id']);
}

refuse(400, 'Unknown profile change.');
