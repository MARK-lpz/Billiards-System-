<?php
// The sites allowed to call this API from a browser. The customer site
// (breakandchill.online) calls it on app.breakandchill.online; the staff app is
// on the same address as the API, so it needs no entry. The frontend has the
// same address in src/utils/siteAddress.js. The Vite dev addresses (the .com
// names are for development only, from this computer's hosts file) are allowed
// only when the API itself runs on this computer (Laragon), never on the hosting.
$allowedOrigins = [
    'https://breakandchill.online',
    'https://app.breakandchill.online',
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
