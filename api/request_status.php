<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/online_payments.php';
require_once '../config/website_requests.php';

// The website asks where its customer's own bookings and tournament sign-ups
// stand, by the keys it was given when it sent them (see
// config/website_requests.php). No sign-in: the key is the proof.
//   POST { keys: ["req-<id>.<secret>", ...] }  -> { requests: [...] }
// POST, so the keys stay out of the server's access log.

function respond($status, $body) {
    http_response_code($status);
    echo json_encode($body);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Method not allowed']);
}

$data = json_decode(file_get_contents('php://input'), true) ?: [];
$keys = is_array($data['keys'] ?? null) ? array_values(array_unique(array_map('strval', $data['keys']))) : null;
if ($keys === null || count($keys) === 0 || count($keys) > REQUEST_STATUS_MAX) {
    respond(400, ['success' => false, 'message' => 'Send 1 to ' . REQUEST_STATUS_MAX . ' request keys.']);
}

try {
    $pdo = getDBConnection();
    ensureOnlinePaymentsTable($pdo);
    respond(200, ['success' => true, 'requests' => readWebsiteRequests($pdo, $keys)]);
} catch (Throwable $error) {
    error_log('Request status failed: ' . $error->getMessage());
    respond(500, ['success' => false, 'message' => 'Unable to check your requests right now.']);
}
