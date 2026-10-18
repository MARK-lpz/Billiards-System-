<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/notices.php';
require_once '../config/site_settings.php';

// The website's settings (see config/site_settings.php). Anyone may read them,
// since the website shows them; the staff change them, one section at a time:
// the admin any section, an employee the GCash details and the slides
// (SITE_EMPLOYEE_SECTIONS). Who saved each section last is told to staff only.

function siteSettingsResponse($pdo) {
    $settings = readSiteSettings($pdo);
    $settings['gcash']['ready'] = gcashIsReady($settings);
    $answer = ['success' => true, 'settings' => $settings, 'savedAt' => readSiteSettingTimes($pdo)];
    if (currentStaff($pdo)) $answer['savedBy'] = readSiteSettingSavers($pdo);
    return $answer;
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

$staff = requireStaff($pdo, ['admin', 'employee']);
$data = json_decode(file_get_contents('php://input'), true) ?: [];
$section = (string) ($data['section'] ?? '');
if (!in_array($section, SITE_SETTING_SECTIONS, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown website section.']);
    exit();
}
if ($staff['role'] !== 'admin' && !in_array($section, SITE_EMPLOYEE_SECTIONS, true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'code' => 'not-allowed', 'message' => 'Only the admin can change this part of the website.']);
    exit();
}

[$values, $error] = cleanSiteSection($section, $data['values'] ?? []);
if ($error !== '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $error]);
    exit();
}

$before = readSiteSettings($pdo)[$section];
$stmt = $pdo->prepare(
    'INSERT INTO site_settings (section, setting_data, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_data = VALUES(setting_data), updated_by = VALUES(updated_by), updated_at = NOW()'
);
$stmt->execute([$section, json_encode($values), $staff['username']]);

// The GCash account is where customers' money goes, so the admin's bell hears
// when an employee changes it (what changed, never only in one browser's log).
if ($section === 'gcash' && $staff['role'] !== 'admin') {
    $changed = gcashChanges($before, $values);
    if ($changed) {
        try {
            addStaffNotice(
                $pdo,
                'website-gcash-' . time() . '-' . bin2hex(random_bytes(3)),
                'website-gcash',
                "{$staff['username']} (employee) changed the GCash details customers pay into: " . implode(', ', $changed)
                    . '. Check them in Website > GCash.',
                ['section' => 'gcash', 'changed' => $changed, 'username' => $staff['username']],
                ['admin']
            );
        } catch (Throwable $error) {
            error_log('GCash change notice failed: ' . $error->getMessage());
        }
    }
}

echo json_encode(siteSettingsResponse($pdo));
