<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/notices.php';

$pdo = getDBConnection();

// Who this tab is signed in as, or 401 once the session has ended.
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $staff = requireStaff($pdo);
    echo json_encode(["success" => true, "user" => $staff]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit();
}

// Get JSON input
$data = json_decode(file_get_contents("php://input"), true);

// Logout ends this tab's session on the server too.
if (($data['action'] ?? '') === 'logout') {
    endAuthSession($pdo);
    echo json_encode(["success" => true]);
    exit();
}

$username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';

// Validate
if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Username and password are required"]);
    exit();
}

$profileColumns = [
    'email' => "ALTER TABLE users ADD COLUMN email varchar(120) NULL",
    'full_name' => "ALTER TABLE users ADD COLUMN full_name varchar(120) NULL",
    'phone' => "ALTER TABLE users ADD COLUMN phone varchar(40) NULL"
];
foreach ($profileColumns as $column => $sql) {
    $columnStmt = $pdo->prepare("SHOW COLUMNS FROM users LIKE ?");
    $columnStmt->execute([$column]);
    if (!$columnStmt->fetch()) {
        $pdo->exec($sql);
    }
}

// Locked after too many wrong passwords (config/auth.php): refused without
// checking this one, so guessing gets nowhere until the lock is over.
$waitMinutes = signInLockMinutes($pdo, $username);
if ($waitMinutes > 0) {
    http_response_code(429);
    echo json_encode(["success" => false, "code" => "locked", "message" => signInLockMessage($waitMinutes)]);
    exit();
}

$stmt = $pdo->prepare("SELECT id, username, role, email, full_name, phone, password FROM users WHERE username = ?");
$stmt->execute([$username]);
$user = $stmt->fetch();
if ($user) {
    $passwordOk = checkPassword($pdo, (int) $user['id'], $user['password'], $password);
} else {
    // As slow as a real check, so the answer does not tell whether the name exists.
    password_verify($password, PASSWORD_TIMING_HASH);
    $passwordOk = false;
}

if (!$passwordOk) {
    $locked = recordSignInFailure($pdo, $username);
    // The admin's bell hears of a lock: someone may be guessing a password.
    try {
        if ($user && in_array('user', $locked, true)) {
            addStaffNotice(
                $pdo,
                'login-locked-' . $user['id'] . '-' . time(),
                'login-locked',
                "Sign-in for {$user['username']} ({$user['role']}) is locked for " . LOGIN_LOCK_MINUTES . " minutes after "
                    . LOGIN_MAX_PER_ACCOUNT . " wrong passwords. If it was not them, someone may be guessing it: set a new password in Accounts.",
                ['username' => $user['username']],
                ['admin']
            );
        }
        if (in_array('ip', $locked, true)) {
            $address = signInKeys($username)['ip'];
            addStaffNotice(
                $pdo,
                'login-locked-ip-' . md5($address) . '-' . time(),
                'login-locked',
                LOGIN_MAX_PER_ADDRESS . " wrong passwords from one address ({$address}) in " . LOGIN_WINDOW_MINUTES
                    . " minutes. Sign-ins from it are locked for " . LOGIN_LOCK_MINUTES . " minutes.",
                ['address' => $address],
                ['admin']
            );
        }
    } catch (Throwable $error) {
        error_log('Sign-in lock notice failed: ' . $error->getMessage());
    }

    http_response_code($locked ? 429 : 401);
    echo json_encode($locked
        ? ["success" => false, "code" => "locked", "message" => signInLockMessage(LOGIN_LOCK_MINUTES)]
        : ["success" => false, "message" => "Invalid username or password"]);
    exit();
}

clearSignInFailures($pdo, $username);

echo json_encode([
    "success" => true,
    "message" => "Login successful",
    // Sent back on every staff request; see config/auth.php.
    "token" => createAuthSession($pdo, (int) $user['id']),
    "user" => [
        "id"       => $user['id'],
        "username" => $user['username'],
        "role"     => $user['role'],
        "email"    => $user['email'],
        "full_name" => $user['full_name'],
        "phone"    => $user['phone']
    ]
]);
?>
