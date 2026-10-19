<?php
// The sites allowed to call this API from a browser. The customer site
// (breakandchill.com) calls it on app.breakandchill.com; the staff app is on
// the same address as the API, so it needs no entry. The Vite dev addresses
// are allowed only when the API itself runs on this computer (Laragon), never
// on the hosting.
$allowedOrigins = [
    'https://breakandchill.com',
    'https://app.breakandchill.com',
];
$apiHost = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
if (in_array($apiHost, ['localhost', '127.0.0.1'], true)) {
    $allowedOrigins = array_merge($allowedOrigins, [
        'http://localhost:5173',
        'http://breakandchill.com:5173',
        'http://app.breakandchill.com:5173',
    ]);
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}

header("Access-Control-Allow-Methods: POST, GET, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Auth-Token");
header("Content-Type: application/json");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>
