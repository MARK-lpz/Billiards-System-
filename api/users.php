<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

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

$pdo = getDBConnection();
ensureUserProfileColumns($pdo);
// Accounts are listed and changed from the admin's Account Management only.
requireStaff($pdo, ['admin']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, username, role, email, full_name AS fullName, phone, created_at FROM users ORDER BY id DESC");
    echo json_encode(["success" => true, "users" => $stmt->fetchAll()]);
    exit();
}

if ($method === 'POST') {
    $data = readJsonBody();
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

    if (mb_strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Password must be at least 6 characters"]);
        exit();
    }

    checkAccountFields($pdo, $username, $phone);

    $stmt = $pdo->prepare("INSERT INTO users (username, password, role, email, full_name, phone) VALUES (?, MD5(?), ?, ?, ?, ?)");
    $stmt->execute([$username, $password, $role, $email, $fullName, $phone]);
    $id = $pdo->lastInsertId();

    echo json_encode([
        "success" => true,
        "user" => [
            "id" => (int) $id,
            "username" => $username,
            "role" => $role,
            "email" => $email,
            "fullName" => $fullName,
            "phone" => $phone
        ]
    ]);
    exit();
}

if ($method === 'PUT') {
    $data = readJsonBody();
    $id = (int) ($data['id'] ?? 0);
    $username = trim($data['username'] ?? '');
    $requestedRole = $data['role'] ?? 'employee';
    $role = in_array($requestedRole, ['admin', 'employee'], true) ? $requestedRole : 'employee';
    $email = trim($data['email'] ?? '');
    $fullName = trim($data['fullName'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $password = $data['password'] ?? '';

    if (!$id || $username === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "User id and username are required"]);
        exit();
    }

    // Same minimum as the login screen, so no account can be given a password
    // that the login form would then refuse.
    if ($password !== '' && mb_strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "New password must be at least 6 characters"]);
        exit();
    }

    $stmt = $pdo->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $storedUsername = $stmt->fetchColumn();
    if ($storedUsername === false) {
        refuse(404, "That account no longer exists. Reload the page and try again.");
    }
    checkAccountFields($pdo, $username, $phone, $id, $storedUsername !== $username);

    if ($password !== '') {
        $stmt = $pdo->prepare("UPDATE users SET username = ?, password = MD5(?), role = ?, email = ?, full_name = ?, phone = ? WHERE id = ?");
        $stmt->execute([$username, $password, $role, $email, $fullName, $phone, $id]);
    } else {
        $stmt = $pdo->prepare("UPDATE users SET username = ?, role = ?, email = ?, full_name = ?, phone = ? WHERE id = ?");
        $stmt->execute([$username, $role, $email, $fullName, $phone, $id]);
    }

    echo json_encode([
        "success" => true,
        "user" => [
            "id" => $id,
            "username" => $username,
            "role" => $role,
            "email" => $email,
            "fullName" => $fullName,
            "phone" => $phone
        ]
    ]);
    exit();
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Method not allowed"]);
?>
