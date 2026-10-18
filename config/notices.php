<?php
/*
 * The staff bells' notices, kept in the notifications table (api/notifications.php
 * serves them). Only the server and signed-in staff add to it: something that
 * happens on the website, such as a new online booking, is added here by the API
 * that saved it, so nobody outside can put a message in front of the staff.
 */

const NOTICE_RECIPIENTS = ['admin', 'employee'];

// A notice read or dismissed this many days ago is removed, and any notice,
// read or not, once it is NOTICE_MAX_DAYS old.
const NOTICE_KEEP_DAYS = 30;
const NOTICE_MAX_DAYS = 90;

function ensureNotificationsTable($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(80) NOT NULL,
            recipient VARCHAR(20) NOT NULL,
            type VARCHAR(80) NOT NULL,
            message VARCHAR(1000) NOT NULL,
            notification_data TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            read_at DATETIME NULL,
            dismissed_at DATETIME NULL,
            PRIMARY KEY (id, recipient),
            INDEX notifications_recipient_created (recipient, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

function isNoticeRecipient($recipient) {
    return in_array($recipient, NOTICE_RECIPIENTS, true);
}

/** One notice for each of `$recipients`; a notice id is only ever added once. */
function addStaffNotice($pdo, $id, $type, $message, $data = null, $recipients = NOTICE_RECIPIENTS) {
    ensureNotificationsTable($pdo);
    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO notifications (id, recipient, type, message, notification_data)
         VALUES (?, ?, ?, ?, ?)'
    );
    $payload = $data === null ? null : json_encode($data);
    foreach (array_unique(array_filter($recipients, 'isNoticeRecipient')) as $recipient) {
        $stmt->execute([substr($id, 0, 80), $recipient, $type, mb_substr($message, 0, 1000), $payload]);
    }
    pruneOldNotices($pdo);
}

/**
 * Removes the notices read or dismissed more than NOTICE_KEEP_DAYS ago, and all
 * older than NOTICE_MAX_DAYS (one nobody opened would otherwise stay for good),
 * so the table does not keep growing. It runs as notices are added, the only
 * time it grows. A failed clean-up never stops a notice from being added.
 */
function pruneOldNotices($pdo) {
    try {
        $pdo->exec(
            'DELETE FROM notifications
             WHERE COALESCE(read_at, dismissed_at) < NOW() - INTERVAL ' . (int) NOTICE_KEEP_DAYS . ' DAY
                OR created_at < NOW() - INTERVAL ' . (int) NOTICE_MAX_DAYS . ' DAY'
        );
    } catch (Throwable $error) {
        error_log('Old notices were not removed: ' . $error->getMessage());
    }
}

/** "1 hour", "2 hours 30 min", "45 min": the app's own wording. */
function noticeHoursLabel($minutes) {
    $total = max(0, (int) round($minutes));
    $hours = intdiv($total, 60);
    $rest = $total % 60;
    $parts = [];
    if ($hours) $parts[] = $hours . ($hours === 1 ? ' hour' : ' hours');
    if ($rest) $parts[] = "$rest min";
    return $parts ? implode(' ', $parts) : '0 min';
}

/**
 * Tells both bells about a booking just sent from the website: "New online
 * reservation: Ana requested Table 3 on October 17, 2026, 3:00 PM - 4:00 PM (1 hour)."
 */
function addOnlineReservationNotice($pdo, $reservation) {
    $minutes = (int) ($reservation['durationMinutes'] ?? 60);
    $start = DateTime::createFromFormat('Y-m-d H:i', ($reservation['date'] ?? '') . ' ' . ($reservation['time'] ?? ''));
    $when = $start
        ? $start->format('F j, Y, g:i A') . ' - ' . (clone $start)->modify("+$minutes minutes")->format('g:i A')
            . ' (' . noticeHoursLabel($minutes) . ')'
        : trim(($reservation['date'] ?? '') . ' ' . ($reservation['time'] ?? ''));

    addStaffNotice(
        $pdo,
        'online-reservation-' . $reservation['id'],
        'online-reservation',
        "New online reservation: {$reservation['customerName']} requested {$reservation['tableName']} on $when.",
        ['reservationId' => $reservation['id'], 'tableId' => $reservation['tableId']]
    );
}
