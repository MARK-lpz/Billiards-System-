<?php
require_once '../config/cors.php';
require_once '../config/database.php';

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

$pdo = getDBConnection();
ensureUserProfileColumns($pdo);

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
