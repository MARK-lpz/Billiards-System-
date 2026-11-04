<?php
/*
 * Each staff account's own preferences: the color theme and comfortable or
 * compact spacing. They are kept with the account, not in one browser, so they
 * follow the person to any computer they sign in on. Sent at sign-in
 * (api/log_in.php) and changed from Settings (api/profile.php). Like the
 * accounts, they are not in backups (see api/backup.php).
 */

const STAFF_THEMES = ['dark', 'light'];
const STAFF_DENSITIES = ['comfortable', 'compact'];

function ensureStaffPreferences(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS staff_preferences (
            user_id INT NOT NULL PRIMARY KEY,
            preferences TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

/**
 * Only the known preferences with a sensible value: `theme` is one of
 * STAFF_THEMES, `density` one of STAFF_DENSITIES. Anything else, such as the
 * start page an earlier version kept, is dropped.
 */
function cleanStaffPreferences($sent): array
{
    $clean = [];
    if (!is_array($sent)) return $clean;
    if (in_array($sent['theme'] ?? null, STAFF_THEMES, true)) {
        $clean['theme'] = $sent['theme'];
    }
    if (in_array($sent['density'] ?? null, STAFF_DENSITIES, true)) {
        $clean['density'] = $sent['density'];
    }
    return $clean;
}

function readStaffPreferences(PDO $pdo, int $userId): array
{
    ensureStaffPreferences($pdo);
    $stmt = $pdo->prepare('SELECT preferences FROM staff_preferences WHERE user_id = ?');
    $stmt->execute([$userId]);
    $json = $stmt->fetchColumn();
    return cleanStaffPreferences($json ? json_decode($json, true) : []);
}

/** Saves `$changes` over what the account already had; returns the result. */
function saveStaffPreferences(PDO $pdo, int $userId, array $changes): array
{
    $preferences = cleanStaffPreferences(array_merge(readStaffPreferences($pdo, $userId), $changes));
    $pdo->prepare(
        'INSERT INTO staff_preferences (user_id, preferences) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE preferences = VALUES(preferences)'
    )->execute([$userId, json_encode($preferences)]);
    return $preferences;
}
