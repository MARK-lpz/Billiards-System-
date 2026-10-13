<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

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

// Check user with MD5 password
$stmt = $pdo->prepare("SELECT id, username, role, email, full_name, phone FROM users WHERE username = ? AND password = MD5(?)");
$stmt->execute([$username, $password]);
$user = $stmt->fetch();

if ($user) {
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
} else {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Invalid username or password"]);
}
?>
