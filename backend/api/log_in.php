<?php
require_once '../config/cors.php';
require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit();
}

// Get JSON input
$data = json_decode(file_get_contents("php://input"), true);
$username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';

// Validate
if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Username and password are required"]);
    exit();
}

$pdo = getDBConnection();

// Check user with MD5 password
$stmt = $pdo->prepare("SELECT id, username, role FROM users WHERE username = ? AND password = MD5(?)");
$stmt->execute([$username, $password]);
$user = $stmt->fetch();

if ($user) {
    echo json_encode([
        "success" => true,
        "message" => "Login successful",
        "user" => [
            "id"       => $user['id'],
            "username" => $user['username'],
            "role"     => $user['role']
        ]
    ]);
} else {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Invalid username or password"]);
}
?>