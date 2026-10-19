<?php

$dbLocalFile = __DIR__ . '/database.local.php';
$dbLocal = is_file($dbLocalFile) ? require $dbLocalFile : [];
if (!is_array($dbLocal)) {
    $dbLocal = [];
}
define('DB_HOST', getenv('DB_HOST') ?: (string) ($dbLocal['host'] ?? 'localhost'));
define('DB_NAME', getenv('DB_NAME') ?: (string) ($dbLocal['name'] ?? 'billiards_system'));
define('DB_USER', getenv('DB_USER') ?: (string) ($dbLocal['user'] ?? 'root'));
define('DB_PASS', getenv('DB_PASS') !== false ? (string) getenv('DB_PASS') : (string) ($dbLocal['pass'] ?? ''));
unset($dbLocalFile, $dbLocal);

function getDBConnection() {
    try {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8",
            DB_USER,
            DB_PASS
        );
        // Philippine time for NOW() and every saved date, on Laragon and on the
        // hosting alike (a hosting's MySQL often runs on UTC).
        $pdo->exec("SET time_zone = '+08:00'");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Database connection failed"]);
        exit();
    }
}
?>