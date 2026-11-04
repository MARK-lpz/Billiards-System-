<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/ledger.php';

// The staff accounts, for the admin's Account Management only.
//
//   GET                                            -> { users }
//   POST { username, password, role, ... }         -> { user }   a new account
//   POST { action: "archive" | "restore", id }     -> { user }
//   POST { action: "delete", id, confirm }         -> { id }     confirm: the username, typed
//   PUT  { id, username, password?, role?, ... }   -> { user }
//
// Any account but your own can be archived or deleted, as long as an active
// admin is left. An archived account keeps its name and its history but cannot
// sign in, and is signed out at once.
// Only an archived account with nothing saved under its name (no sale, table
// bill or Audit Trail entry) can be deleted: one with records stays archived,
// so its name is never given to someone else. A new password from the admin
// signs the account out everywhere (the admin's own: everywhere but here).
// A role is changed by another admin only, never your own, and there is always
// an admin left; the account is signed out, to sign in to its new panel.

function ensureUserProfileColumns($pdo) {
    $columns = [
        'email' => "ALTER TABLE users ADD COLUMN email varchar(120) NULL",
        'full_name' => "ALTER TABLE users ADD COLUMN full_name varchar(120) NULL",
        'phone' => "ALTER TABLE users ADD COLUMN phone varchar(40) NULL"
    ];

    foreach ($columns as $column => $sql) {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM users LIKE ?");
        $stmt->execute([$column]);
        if (!$stmt->fetch()) {
            $pdo->exec($sql);
        }
    }
}

function readJsonBody() {
    return json_decode(file_get_contents("php://input"), true) ?: [];
}

function refuse($status, $message) {
    http_response_code($status);
    echo json_encode(["success" => false, "message" => $message]);
    exit();
}

// The same rules as getUsernameError in the frontend's formValidation.js, plus
// the check only the server can make for sure: no other account has the name.
// $checkName is false when an account keeps the name it already has, so an
// older name that breaks the rules can still have its password changed.
function checkAccountFields($pdo, $username, $phone, $id = 0, $checkName = true) {
    if ($checkName && !preg_match('/^[A-Za-z0-9._-]{3,30}$/', $username)) {
        refuse(400, "Usernames are 3 to 30 letters, numbers, dots, dashes or underscores, with no spaces.");
    }
    if ($phone !== '' && !preg_match('/^09\d{9}$/', $phone)) {
        refuse(400, "Enter the mobile number in 09XXXXXXXXX format, or leave it blank.");
    }
    $stmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id <> ? LIMIT 1");
    $stmt->execute([$username, $id]);
    if ($stmt->fetch()) {
        refuse(409, "{$username} is already taken. Choose another username.");
    }
}

// How many sales, table bills and Audit Trail entries each username (in lower
// case) saved or last changed: the server keeps who was signed in for each. Only
// $username's when it is given.
function accountRecordCounts($pdo, $username = null) {
    $counts = [];
    foreach (['sales' => 'sales', 'charges' => 'bills', 'audit' => 'activity'] as $ledger => $kind) {
        $table = openLedger($pdo, $ledger)['table'];
        $stmt = $pdo->prepare(
            "SELECT LOWER(name) AS name, COUNT(*) AS total FROM (
                SELECT created_by AS name FROM `$table`
                UNION ALL
                SELECT updated_by FROM `$table` WHERE updated_by <> created_by
             ) AS saved
             WHERE name IS NOT NULL AND name <> ''" . ($username === null ? '' : ' AND LOWER(name) = LOWER(?)') . "
             GROUP BY LOWER(name)"
        );
        $stmt->execute($username === null ? [] : [$username]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $counts[$row['name']][$kind] = (int) $row['total'];
        }
    }
    return $counts;
}

// "12 sales, 1 table bill", for a refusal.
function describeRecords($records) {
    $labels = ['sales' => ['sale', 'sales'], 'bills' => ['table bill', 'table bills'], 'activity' => ['Audit Trail entry', 'Audit Trail entries']];
    $parts = [];
    foreach ($labels as $kind => [$one, $many]) {
        $count = $records[$kind] ?? 0;
        if ($count > 0) $parts[] = $count . ' ' . ($count === 1 ? $one : $many);
    }
    return implode(', ', $parts);
}

// The accounts as the page lists them (only $id's when it is given), newest
// first. archivedAgo and lastSignInAgo are seconds by the database's own clock
// (null: not archived, no sign-in known), so no time zone can skew them. A sign-in
// from before last_login_at was kept is read from the sessions still open.
function readAccounts($pdo, $id = 0) {
    ensureAuthSessions($pdo);
    $stmt = $pdo->prepare(
        "SELECT u.id, u.username, u.role, u.email, u.full_name AS fullName, u.phone, u.created_at,
                TIMESTAMPDIFF(SECOND, u.archived_at, NOW()) AS archivedAgo,
                TIMESTAMPDIFF(SECOND, COALESCE(u.last_login_at,
                    (SELECT MAX(s.created_at) FROM auth_sessions s WHERE s.user_id = u.id)), NOW()) AS lastSignInAgo
         FROM users u" . ($id ? " WHERE u.id = ?" : "") . " ORDER BY u.id DESC"
    );
    $stmt->execute($id ? [$id] : []);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $records = accountRecordCounts($pdo, $id && $users ? $users[0]['username'] : null);

    return array_map(function ($user) use ($records) {
        $saved = $records[strtolower((string) $user['username'])] ?? [];
        return [
            "id" => (int) $user['id'],
            "username" => $user['username'],
            "role" => $user['role'],
            "email" => $user['email'],
            "fullName" => $user['fullName'],
            "phone" => $user['phone'],
            "created_at" => $user['created_at'],
            "archived" => $user['archivedAgo'] !== null,
            "archivedAgo" => $user['archivedAgo'] === null ? null : (int) $user['archivedAgo'],
            "lastSignInAgo" => $user['lastSignInAgo'] === null ? null : (int) $user['lastSignInAgo'],
            "records" => [
                "sales" => $saved['sales'] ?? 0,
                "bills" => $saved['bills'] ?? 0,
                "activity" => $saved['activity'] ?? 0
            ]
        ];
    }, $users);
}

function sendAccount($pdo, $id) {
    echo json_encode(["success" => true, "user" => readAccounts($pdo, $id)[0] ?? null]);
    exit();
}

$pdo = getDBConnection();
ensureUserProfileColumns($pdo);
ensureAccountStatusColumns($pdo);
// Accounts are listed and changed from the admin's Account Management only.
$staff = requireStaff($pdo, ['admin']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(["success" => true, "users" => readAccounts($pdo)]);
    exit();
}

$data = $method === 'POST' || $method === 'PUT' ? readJsonBody() : [];
$action = (string) ($data['action'] ?? '');

if ($method === 'POST' && in_array($action, ['archive', 'restore', 'delete'], true)) {
    $id = (int) ($data['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT id, username, LOWER(role) AS role, archived_at FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $account = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$account) {
        refuse(404, "That account no longer exists. Reload the page and try again.");
    }
    if ($id === $staff['id']) {
        refuse(403, "You cannot archive or delete your own account. Another admin can.");
    }
    $name = $account['username'];
    // An admin is archived only while another active admin is left.
    if ($action === 'archive' && $account['role'] === 'admin') {
        $admins = $pdo->prepare("SELECT COUNT(*) FROM users WHERE LOWER(role) = 'admin' AND archived_at IS NULL AND id <> ?");
        $admins->execute([$id]);
        if ((int) $admins->fetchColumn() === 0) {
            refuse(409, "Keep at least one admin. Make another account an admin first.");
        }
    }

    if ($action === 'archive') {
        if ($account['archived_at'] === null) {
            $pdo->prepare("UPDATE users SET archived_at = NOW() WHERE id = ?")->execute([$id]);
        }
        // Signed out at once, wherever they are signed in.
        endUserSessions($pdo, $id);
        sendAccount($pdo, $id);
    }

    if ($action === 'restore') {
        $pdo->prepare("UPDATE users SET archived_at = NULL WHERE id = ?")->execute([$id]);
        sendAccount($pdo, $id);
    }

    if ($account['archived_at'] === null) {
        refuse(409, "Archive {$name} first. Only an archived account can be deleted.");
    }
    if ((string) ($data['confirm'] ?? '') !== $name) {
        refuse(400, "Type the username {$name} exactly to delete it.");
    }
    $records = accountRecordCounts($pdo, $name)[strtolower($name)] ?? [];
    if (array_sum($records) > 0) {
        refuse(409, "{$name} has records (" . describeRecords($records) . "), so the account stays archived. Only an account with no records can be deleted.");
    }

    // What only this account had goes with it. Its name in the history stays,
    // like the Password Resets list.
    endUserSessions($pdo, $id);
    foreach (['staff_preferences', 'staff_photos', 'password_reset_codes'] as $table) {
        $exists = $pdo->prepare("SHOW TABLES LIKE ?");
        $exists->execute([$table]);
        if ($exists->fetch()) {
            $pdo->prepare("DELETE FROM `$table` WHERE user_id = ?")->execute([$id]);
        }
    }
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);
    clearSignInFailures($pdo, $name);

    echo json_encode(["success" => true, "id" => $id]);
    exit();
}

if ($method === 'POST') {
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    $requestedRole = $data['role'] ?? 'employee';
    $role = in_array($requestedRole, ['admin', 'employee'], true) ? $requestedRole : 'employee';
    $email = trim($data['email'] ?? '');
    $fullName = trim($data['fullName'] ?? '');
    $phone = trim($data['phone'] ?? '');

    if ($username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Username and password are required"]);
        exit();
    }

    if (mb_strlen($password) < PASSWORD_MIN_LENGTH) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Password must be at least " . PASSWORD_MIN_LENGTH . " characters"]);
        exit();
    }

    checkAccountFields($pdo, $username, $phone);

    // Kept with password_hash, never as the password itself (see config/auth.php).
    ensurePasswordColumn($pdo);
    $stmt = $pdo->prepare("INSERT INTO users (username, password, role, email, full_name, phone) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$username, hashPassword($password), $role, $email, $fullName, $phone]);
    sendAccount($pdo, (int) $pdo->lastInsertId());
}

if ($method === 'PUT') {
    $id = (int) ($data['id'] ?? 0);
    $username = trim($data['username'] ?? '');
    $email = trim($data['email'] ?? '');
    $fullName = trim($data['fullName'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $password = $data['password'] ?? '';

    if (!$id || $username === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "User id and username are required"]);
        exit();
    }

    // A new password meets today's minimum; an older, shorter one still signs in.
    if ($password !== '' && mb_strlen($password) < PASSWORD_MIN_LENGTH) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "New password must be at least " . PASSWORD_MIN_LENGTH . " characters"]);
        exit();
    }

    $stmt = $pdo->prepare("SELECT username, LOWER(role) AS role, archived_at FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $stored = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$stored) {
        refuse(404, "That account no longer exists. Reload the page and try again.");
    }
    $storedUsername = $stored['username'];
    if ($stored['archived_at'] !== null) {
        refuse(409, "{$storedUsername} is archived. Restore the account first to change it.");
    }
    // A role not sent stays as it is.
    $requestedRole = $data['role'] ?? null;
    $role = in_array($requestedRole, ['admin', 'employee'], true) ? $requestedRole : $stored['role'];
    $roleChanged = $role !== $stored['role'];
    if ($roleChanged && $id === $staff['id']) {
        refuse(403, "You cannot change your own role. Another admin can.");
    }
    if ($roleChanged && $stored['role'] === 'admin') {
        $admins = $pdo->prepare("SELECT COUNT(*) FROM users WHERE LOWER(role) = 'admin' AND archived_at IS NULL AND id <> ?");
        $admins->execute([$id]);
        if ((int) $admins->fetchColumn() === 0) {
            refuse(409, "Keep at least one admin. Make another account an admin first.");
        }
    }
    checkAccountFields($pdo, $username, $phone, $id, $storedUsername !== $username);

    if ($password !== '') {
        ensurePasswordColumn($pdo);
        $stmt = $pdo->prepare("UPDATE users SET username = ?, password = ?, role = ?, email = ?, full_name = ?, phone = ? WHERE id = ?");
        $stmt->execute([$username, hashPassword($password), $role, $email, $fullName, $phone, $id]);
        // A new password from the admin also lifts a lock from wrong guesses.
        clearSignInFailures($pdo, $storedUsername);
        clearSignInFailures($pdo, $username);
    } else {
        $stmt = $pdo->prepare("UPDATE users SET username = ?, role = ?, email = ?, full_name = ?, phone = ? WHERE id = ?");
        $stmt->execute([$username, $role, $email, $fullName, $phone, $id]);
    }
    // A new password or role signs the account out everywhere (the admin's own
    // new password: everywhere but here), to sign in again to the right panel.
    if ($password !== '' || $roleChanged) {
        endUserSessions($pdo, $id, $id === $staff['id']);
    }

    sendAccount($pdo, $id);
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Method not allowed"]);
?>
