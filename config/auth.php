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
