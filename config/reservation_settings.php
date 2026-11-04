<?php
/*
 * Whether the website takes table bookings: the Online reservations switch on
 * Content Management, in both panels. Closing asks why and for how long. A
 * closing with an end time opens again by itself once that time comes (checked
 * on the next look, so no timer is needed), so bookings are never left shut by
 * mistake. The website shows guests the reason and when bookings open again;
 * the note and who changed it are for the staff only.
 *
 * Times are Manila time: the database session runs at +08:00 (database.php).
 */

require_once __DIR__ . '/site_settings.php';
require_once __DIR__ . '/notices.php';

const ONLINE_CLOSE_REASONS = [
    'fully-booked' => 'Fully booked',
    'private-event' => 'Private event',
    'tournament' => 'Tournament',
    'maintenance' => 'Maintenance',
    'other' => 'Other',
];
const ONLINE_CLOSE_NOTE_MAX = 160;
// How long a closing lasts: an hour, until closing time today, until the hall
// next opens, or until someone opens it again.
const ONLINE_CLOSE_UNTIL = ['hour', 'closing', 'opening', 'manual'];

function ensureReservationSettingsTable($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS reservation_settings (
            id TINYINT UNSIGNED PRIMARY KEY,
            online_reservations_open TINYINT(1) NOT NULL DEFAULT 1,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $pdo->exec('INSERT IGNORE INTO reservation_settings (id, online_reservations_open) VALUES (1, 1)');

    $columns = [
        'closed_reason' => 'VARCHAR(40) NULL',
        'closed_note' => 'VARCHAR(200) NULL',
        'closed_until' => 'DATETIME NULL',
        'changed_by' => 'VARCHAR(80) NULL',
        'changed_role' => 'VARCHAR(20) NULL',
        'changed_at' => 'DATETIME NULL',
    ];
    $existing = $pdo->query('SHOW COLUMNS FROM reservation_settings')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($columns as $name => $type) {
        if (!in_array($name, $existing, true)) {
            $pdo->exec("ALTER TABLE reservation_settings ADD COLUMN $name $type");
        }
    }
}

// A closing whose time is up opens here. No one opened it, so `changed_by` is
// left empty and `changed_at` is the time it was due ("opened automatically").
function reopenOnlineReservationsWhenDue($pdo) {
    $pdo->exec(
        "UPDATE reservation_settings
         SET online_reservations_open = 1, changed_by = NULL, changed_role = NULL, changed_at = closed_until,
             closed_reason = NULL, closed_note = NULL, closed_until = NULL
         WHERE id = 1 AND online_reservations_open = 0 AND closed_until IS NOT NULL AND closed_until <= NOW()"
    );
}

function onlineReservationsAreOpen($pdo) {
    reopenOnlineReservationsWhenDue($pdo);
    $setting = $pdo->query('SELECT online_reservations_open FROM reservation_settings WHERE id = 1')->fetchColumn();
    return $setting === false || (bool) $setting;
}

// From closing until opening the hall is shut, and online bookings with it:
// the switch cannot open them then, and a booking sent then is refused.
function hallIsClosedNow($pdo) {
    $hours = readOpeningHours($pdo);
    $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Manila'));
    $minutes = (int) $now->format('G') * 60 + (int) $now->format('i');
    return $minutes >= siteMinutesOfDay($hours['close']) || $minutes < siteMinutesOfDay($hours['open']);
}

// "9:00 AM": when online bookings can open again after the night.
function hallOpeningLabel($pdo) {
    return siteClockLabel(readOpeningHours($pdo)['open']);
}

// "2026-10-26 22:00:00" (Manila) as "2026-10-26T22:00:00+08:00", or null.
function manilaIsoTime($value) {
    return $value ? str_replace(' ', 'T', (string) $value) . '+08:00' : null;
}

/**
 * The switch as the website and the panels read it. The reason and the time it
 * opens again are public; the note and who changed it go to signed-in staff only.
 */
function reservationSettingsResponse($pdo, $forStaff) {
    reopenOnlineReservationsWhenDue($pdo);
    $row = $pdo->query(
        'SELECT online_reservations_open, closed_reason, closed_note, closed_until, changed_by, changed_role,
                changed_at, updated_at
         FROM reservation_settings WHERE id = 1'
    )->fetch(PDO::FETCH_ASSOC) ?: [];
    $open = (bool) ($row['online_reservations_open'] ?? true);
    $reason = $open ? null : ($row['closed_reason'] ?? null);

    $settings = [
        'onlineReservationsOpen' => $open,
        'closedReason' => $reason,
        'closedReasonLabel' => $reason ? (ONLINE_CLOSE_REASONS[$reason] ?? null) : null,
        'closedUntil' => $open ? null : manilaIsoTime($row['closed_until'] ?? null),
        'updatedAt' => $row['updated_at'] ?? null,
    ];
    if ($forStaff) {
        $settings['closedNote'] = $open ? '' : (string) ($row['closed_note'] ?? '');
        $settings['changedBy'] = $row['changed_by'] ?? null;
        $settings['changedRole'] = $row['changed_role'] ?? null;
        $settings['changedAt'] = manilaIsoTime($row['changed_at'] ?? null);
    }
    return $settings;
}

/**
 * When a closing chosen as `$choice` ends, as a Manila time; null for "until
 * someone opens it again", false when that choice makes no sense now (closing
 * time today has already passed).
 */
function onlineCloseUntil($pdo, $choice) {
    $zone = new DateTimeZone('Asia/Manila');
    $now = new DateTimeImmutable('now', $zone);
    $hours = readOpeningHours($pdo);
    $on = fn($day, $time) => new DateTimeImmutable($day->format('Y-m-d') . ' ' . $time, $zone);

    if ($choice === 'manual') return null;
    if ($choice === 'hour') return $now->modify('+1 hour');
    if ($choice === 'closing') {
        $closing = $on($now, $hours['close']);
        return $closing > $now ? $closing : false;
    }
    if ($choice === 'opening') {
        $opening = $on($now, $hours['open']);
        return $opening > $now ? $opening : $on($now->modify('+1 day'), $hours['open']);
    }
    return false;
}

// "10:00 PM", or "Oct 27, 10:00 AM" when it is not today.
function onlineCloseTimeLabel(DateTimeImmutable $time) {
    $today = (new DateTimeImmutable('now', $time->getTimezone()))->format('Y-m-d');
    return $time->format('Y-m-d') === $today ? $time->format('g:i A') : $time->format('M j, g:i A');
}

// The admin's bell hears when an employee opens or closes online bookings.
function tellAdminOfBookingSwitch($pdo, $staff, $message) {
    if (($staff['role'] ?? '') !== 'employee') return;
    try {
        addStaffNotice(
            $pdo,
            'online-booking-switch-' . time() . '-' . bin2hex(random_bytes(3)),
            'online-booking-switch',
            $message,
            ['username' => $staff['username']],
            ['admin']
        );
    } catch (Throwable $error) {
        error_log('Online booking switch notice failed: ' . $error->getMessage());
    }
}
