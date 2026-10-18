<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/site_settings.php';

// The website's settings (see config/site_settings.php). Anyone may read them,
// since the website shows them; only the admin changes them, one section at a time.

function siteSettingsResponse($pdo) {
    $settings = readSiteSettings($pdo);
    $settings['gcash']['ready'] = gcashIsReady($settings);
    return ['success' => true, 'settings' => $settings, 'savedAt' => readSiteSettingTimes($pdo)];
}

$pdo = getDBConnection();
ensureSiteSettingsTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(siteSettingsResponse($pdo));
    exit();
}

if ($method !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$admin = requireStaff($pdo, ['admin']);
$data = json_decode(file_get_contents('php://input'), true) ?: [];
$section = (string) ($data['section'] ?? '');
if (!in_array($section, SITE_SETTING_SECTIONS, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown website section.']);
    exit();
}

[$values, $error] = cleanSiteSection($section, $data['values'] ?? []);
if ($error !== '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $error]);
    exit();
}

$stmt = $pdo->prepare(
    'INSERT INTO site_settings (section, setting_data, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_data = VALUES(setting_data), updated_by = VALUES(updated_by), updated_at = NOW()'
);
$stmt->execute([$section, json_encode($values), $admin['username']]);

echo json_encode(siteSettingsResponse($pdo));
