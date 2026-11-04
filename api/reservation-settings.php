<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/reservation_settings.php';

// The Online reservations switch (see config/reservation_settings.php).
//   GET  -> { settings }: anyone; signed-in staff also get the note and who changed it.
//   PUT  { onlineReservationsOpen: true }
//   PUT  { onlineReservationsOpen: false, reason, note, until }  (staff)

function refuseSwitch($status, $message) {
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

$pdo = getDBConnection();
ensureReservationSettingsTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(['success' => true, 'settings' => reservationSettingsResponse($pdo, currentStaff($pdo) !== null)]);
    exit();
}

// Opened and closed from Content Management, the admin's or the employee's.
$staff = requireStaff($pdo, ['admin', 'employee']);

if ($method !== 'PUT') refuseSwitch(405, 'Method not allowed');

$data = json_decode(file_get_contents('php://input'), true) ?: [];
if (!array_key_exists('onlineReservationsOpen', $data)) {
    refuseSwitch(400, 'Online reservation availability is required');
}

$open = filter_var($data['onlineReservationsOpen'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
if ($open === null) refuseSwitch(400, 'Online reservation availability must be true or false');

if ($open) {
    if (hallIsClosedNow($pdo)) {
        refuseSwitch(409, 'The hall is closed now. Online reservations can be opened from ' . hallOpeningLabel($pdo) . '.');
    }
    $pdo->prepare(
        'UPDATE reservation_settings
         SET online_reservations_open = 1, closed_reason = NULL, closed_note = NULL, closed_until = NULL,
             changed_by = ?, changed_role = ?, changed_at = NOW()
         WHERE id = 1'
    )->execute([$staff['username'], $staff['role']]);
    tellAdminOfBookingSwitch($pdo, $staff, "{$staff['username']} (employee) opened online reservations again.");
} else {
    $reason = (string) ($data['reason'] ?? '');
    $note = trim(preg_replace('/\s+/', ' ', (string) ($data['note'] ?? '')));
    $choice = (string) ($data['until'] ?? '');

    if (!array_key_exists($reason, ONLINE_CLOSE_REASONS)) refuseSwitch(400, 'Choose why online reservations are closing.');
    if (mb_strlen($note) > ONLINE_CLOSE_NOTE_MAX) {
        refuseSwitch(400, 'Keep the note to ' . ONLINE_CLOSE_NOTE_MAX . ' characters or fewer.');
    }
    if ($reason === 'other' && $note === '') refuseSwitch(400, 'Say why in the note.');
    if (!in_array($choice, ONLINE_CLOSE_UNTIL, true)) refuseSwitch(400, 'Choose how long online reservations stay closed.');
    $until = onlineCloseUntil($pdo, $choice);
    if ($until === false) refuseSwitch(400, 'Closing time today has passed. Choose another option.');

    $pdo->prepare(
        'UPDATE reservation_settings
         SET online_reservations_open = 0, closed_reason = ?, closed_note = ?, closed_until = ?,
             changed_by = ?, changed_role = ?, changed_at = NOW()
         WHERE id = 1'
    )->execute([
        $reason,
        $note === '' ? null : $note,
        $until ? $until->format('Y-m-d H:i:s') : null,
        $staff['username'],
        $staff['role'],
    ]);

    tellAdminOfBookingSwitch(
        $pdo,
        $staff,
        "{$staff['username']} (employee) closed online reservations: " . ONLINE_CLOSE_REASONS[$reason]
            . ($note !== '' ? " (\"$note\")" : '')
            . ($until ? '. They open again at ' . onlineCloseTimeLabel($until) . '.' : '. They stay closed until someone opens them again.')
    );
}

echo json_encode(['success' => true, 'settings' => reservationSettingsResponse($pdo, true)]);
