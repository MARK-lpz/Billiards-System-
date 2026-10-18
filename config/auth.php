<?php
// Staff sign-in sessions. log_in.php hands out a random token when a password
// is right; the staff app sends it back on every staff request in the
// X-Auth-Token header. Only a hash of the token is stored, so a copy of the
// database cannot be used to sign in. A screen without a valid token (signed
// out, timed out, or never signed in) can still use what the public website
// uses, and nothing else.

// Signed out after this long with no request (a shift's tab polls every few
// seconds, so this only ends a session left closed or idle), and after this long
// in any case.
const AUTH_IDLE_HOURS = 12;
const AUTH_MAX_DAYS = 7;
// last_seen_at is only rewritten this often, not on every 3-second poll.
const AUTH_TOUCH_SECONDS = 300;

function ensureAuthSessions(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS auth_sessions (
            token_hash CHAR(64) NOT NULL PRIMARY KEY,
            user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX auth_sessions_user (user_id),
            INDEX auth_sessions_seen (last_seen_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

// A new session for a user whose password was just checked; returns the token.
function createAuthSession(PDO $pdo, int $userId): string
{
    ensureAuthSessions($pdo);
    // Sessions past their time are cleared here, on sign-in, not on every request.
    $pdo->exec(
        'DELETE FROM auth_sessions
         WHERE last_seen_at < (NOW() - INTERVAL ' . AUTH_IDLE_HOURS . ' HOUR)
            OR created_at < (NOW() - INTERVAL ' . AUTH_MAX_DAYS . ' DAY)'
    );
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('INSERT INTO auth_sessions (token_hash, user_id) VALUES (?, ?)')
        ->execute([hash('sha256', $token), $userId]);
    return $token;
}

function readAuthToken(): string
{
    $token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
    if ($token === '' && preg_match('/^Bearer\s+(\S+)$/i', $_SERVER['HTTP_AUTHORIZATION'] ?? '', $match)) {
        $token = $match[1];
    }
    return preg_match('/^[a-f0-9]{64}$/', $token) ? $token : '';
}

// The signed-in staff member ({id, username, role}) or null. The role is read
// from the account each time, so a changed role counts at once.
function currentStaff(PDO $pdo): ?array
{
    static $resolved = false;
    static $staff = null;
    if ($resolved) return $staff;
    $resolved = true;

    $token = readAuthToken();
    if ($token === '') return null;

    ensureAuthSessions($pdo);
    $stmt = $pdo->prepare(
        'SELECT s.token_hash, s.last_seen_at, u.id, u.username, LOWER(u.role) AS role,
                (s.last_seen_at < (NOW() - INTERVAL ' . AUTH_TOUCH_SECONDS . ' SECOND)) AS stale
         FROM auth_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?
           AND s.last_seen_at >= (NOW() - INTERVAL ' . AUTH_IDLE_HOURS . ' HOUR)
           AND s.created_at >= (NOW() - INTERVAL ' . AUTH_MAX_DAYS . ' DAY)'
    );
    $stmt->execute([hash('sha256', $token)]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !in_array($row['role'], ['admin', 'employee'], true)) return null;

    if ((int) $row['stale']) {
        $pdo->prepare('UPDATE auth_sessions SET last_seen_at = NOW() WHERE token_hash = ?')->execute([$row['token_hash']]);
    }

    $staff = ['id' => (int) $row['id'], 'username' => $row['username'], 'role' => $row['role']];
    return $staff;
}

// Stops the request unless a signed-in staff member with one of $roles sent it.
function requireStaff(PDO $pdo, array $roles = ['admin', 'employee']): array
{
    $staff = currentStaff($pdo);
    if (!$staff) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'code' => 'signed-out',
            'message' => 'Your sign-in has ended. Please sign in again.',
        ]);
        exit();
    }
    if (!in_array($staff['role'], $roles, true)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'code' => 'not-allowed',
            'message' => in_array('admin', $roles, true) && count($roles) === 1
                ? 'Only the admin can do this.'
                : 'Your account cannot do this.',
        ]);
        exit();
    }
    return $staff;
}

function endAuthSession(PDO $pdo): void
{
    $token = readAuthToken();
    if ($token === '') return;
    ensureAuthSessions($pdo);
    $pdo->prepare('DELETE FROM auth_sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
}

// ---------------------------------------------------------------- passwords

// Passwords are kept with password_hash (bcrypt). Accounts made before were
// kept as MD5: they still sign in, and are moved to password_hash the first
// time their password is given, so nobody has to reset anything.

// For a new or changed password. Older, shorter ones still sign in.
const PASSWORD_MIN_LENGTH = 8;

// Checked against when the username does not exist, so the answer takes as long
// either way and does not tell whether an account has that name.
const PASSWORD_TIMING_HASH = '$2y$10$fLZazz7KWjnpYC/.n9nA3uBKC2XYiToDIDHlIdccAeSH6yz7.4JnS';

function hashPassword(string $password): string
{
    return password_hash($password, PASSWORD_DEFAULT);
}

// The password column was made for MD5 (32 characters); a password_hash needs
// 60 or more. Widened once, before the first one is written. Run outside a
// transaction: ALTER TABLE ends one.
function ensurePasswordColumn(PDO $pdo): void
{
    static $checked = false;
    if ($checked) return;
    $checked = true;

    $column = $pdo->query("SHOW COLUMNS FROM users LIKE 'password'")->fetch(PDO::FETCH_ASSOC);
    if (!$column || !preg_match('/^(?:var)?char\((\d+)\)/i', (string) $column['Type'], $match) || (int) $match[1] >= 255) {
        return;
    }
    $pdo->exec('ALTER TABLE users MODIFY password VARCHAR(255) ' . ($column['Null'] === 'YES' ? 'NULL' : 'NOT NULL'));
}

/**
 * Whether $password is the account's ($stored is its users.password). A match
 * against an old MD5, or a hash made with older settings, is replaced by a new
 * password_hash on the spot.
 */
function checkPassword(PDO $pdo, int $userId, ?string $stored, string $password): bool
{
    $stored = (string) $stored;
    if (preg_match('/^[a-f0-9]{32}$/i', $stored)) {
        if (!hash_equals(strtolower($stored), md5($password))) return false;
    } elseif (!password_verify($password, $stored)) {
        return false;
    } elseif (!password_needs_rehash($stored, PASSWORD_DEFAULT)) {
        return true;
    }

    ensurePasswordColumn($pdo);
    $pdo->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([hashPassword($password), $userId]);
    return true;
}

// ---------------------------------------------------------------- failed sign-ins

// Too many wrong passwords for one username, or from one address, within
// LOGIN_WINDOW_MINUTES lock it for LOGIN_LOCK_MINUTES. While locked, the
// password is not even checked, so guessing gets nowhere.
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_LOCK_MINUTES = 15;
const LOGIN_MAX_PER_ACCOUNT = 5;
const LOGIN_MAX_PER_ADDRESS = 20;

function ensureLoginThrottle(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS login_failures (
            id INT AUTO_INCREMENT PRIMARY KEY,
            key_type VARCHAR(10) NOT NULL,
            key_value VARCHAR(120) NOT NULL,
            failed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX login_failures_key (key_type, key_value, failed_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS login_locks (
            key_type VARCHAR(10) NOT NULL,
            key_value VARCHAR(120) NOT NULL,
            locked_until DATETIME NOT NULL,
            PRIMARY KEY (key_type, key_value)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

// The sign-in's keys: the username as typed (any case), and the address it came from.
function signInKeys(string $username): array
{
    $name = function_exists('mb_strtolower') ? mb_strtolower(trim($username)) : strtolower(trim($username));
    return [
        'user' => substr($name, 0, 120),
        'ip' => substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 120),
    ];
}

/** Minutes until this username and address may try again; 0 when they may now. */
function signInLockMinutes(PDO $pdo, string $username): int
{
    ensureLoginThrottle($pdo);
    $pdo->exec('DELETE FROM login_locks WHERE locked_until <= NOW()');
    $pdo->exec('DELETE FROM login_failures WHERE failed_at < (NOW() - INTERVAL ' . LOGIN_WINDOW_MINUTES . ' MINUTE)');

    $seconds = 0;
    $stmt = $pdo->prepare('SELECT TIMESTAMPDIFF(SECOND, NOW(), locked_until) FROM login_locks WHERE key_type = ? AND key_value = ?');
    foreach (signInKeys($username) as $type => $value) {
        $stmt->execute([$type, $value]);
        $seconds = max($seconds, (int) $stmt->fetchColumn());
    }
    return $seconds > 0 ? (int) ceil($seconds / 60) : 0;
}

/**
 * Counts a wrong password. Returns which keys it just locked (['user'], ['ip'],
 * both or none), so the caller can say so and tell the admin.
 */
function recordSignInFailure(PDO $pdo, string $username): array
{
    ensureLoginThrottle($pdo);
    $limits = ['user' => LOGIN_MAX_PER_ACCOUNT, 'ip' => LOGIN_MAX_PER_ADDRESS];
    $insert = $pdo->prepare('INSERT INTO login_failures (key_type, key_value) VALUES (?, ?)');
    $count = $pdo->prepare(
        'SELECT COUNT(*) FROM login_failures WHERE key_type = ? AND key_value = ?
           AND failed_at >= (NOW() - INTERVAL ' . LOGIN_WINDOW_MINUTES . ' MINUTE)'
    );
    $locked = [];
    foreach (signInKeys($username) as $type => $value) {
        $insert->execute([$type, $value]);
        $count->execute([$type, $value]);
        if ((int) $count->fetchColumn() < $limits[$type]) continue;
        $pdo->prepare(
            'INSERT INTO login_locks (key_type, key_value, locked_until)
             VALUES (?, ?, NOW() + INTERVAL ' . LOGIN_LOCK_MINUTES . ' MINUTE)
             ON DUPLICATE KEY UPDATE locked_until = VALUES(locked_until)'
        )->execute([$type, $value]);
        // A fresh count once the lock is over.
        $pdo->prepare('DELETE FROM login_failures WHERE key_type = ? AND key_value = ?')->execute([$type, $value]);
        $locked[] = $type;
    }
    return $locked;
}

// After a right password, a reset by text, or the admin setting a new password:
// the username starts again with no failures and no lock.
function clearSignInFailures(PDO $pdo, string $username): void
{
    ensureLoginThrottle($pdo);
    $name = signInKeys($username)['user'];
    $pdo->prepare("DELETE FROM login_failures WHERE key_type = 'user' AND key_value = ?")->execute([$name]);
    $pdo->prepare("DELETE FROM login_locks WHERE key_type = 'user' AND key_value = ?")->execute([$name]);
}

function signInLockMessage(int $minutes): string
{
    return 'Too many failed sign-in attempts. Please try again in ' . $minutes . ' minute' . ($minutes === 1 ? '' : 's') . '.';
}
