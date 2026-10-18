<?php
/*
 * What the admin sets for the website (Admin > Website): the GCash account
 * customers pay into, the hall's address and contacts, an announcement, and the
 * opening hours. Kept in site_settings, one row per section. A section never
 * saved reads as its default, which is how the site was before.
 */
require_once __DIR__ . '/media.php';

const SITE_SETTING_SECTIONS = ['gcash', 'business', 'announcement', 'hours'];
const SITE_ANNOUNCEMENT_MAX = 200;

function siteSettingDefaults() {
    return [
        'gcash' => ['accountName' => '', 'number' => '', 'qr' => null],
        'business' => ['address' => '', 'mapsUrl' => '', 'phone' => '', 'facebookUrl' => ''],
        'announcement' => ['enabled' => false, 'message' => '', 'startDate' => '', 'endDate' => ''],
        'hours' => ['open' => '10:00', 'close' => '22:00'],
    ];
}

function ensureSiteSettingsTable($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS site_settings (
            section VARCHAR(40) PRIMARY KEY,
            setting_data TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by VARCHAR(80) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

/** Every section, saved values over the defaults. */
function readSiteSettings($pdo) {
    ensureSiteSettingsTable($pdo);
    $settings = siteSettingDefaults();
    foreach ($pdo->query('SELECT section, setting_data FROM site_settings')->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $stored = json_decode((string) $row['setting_data'], true);
        if (!isset($settings[$row['section']]) || !is_array($stored)) continue;
        $settings[$row['section']] = array_merge(
            $settings[$row['section']],
            array_intersect_key($stored, $settings[$row['section']])
        );
    }
    return $settings;
}

/** When each saved section was last saved, in ms (the database's clock). */
function readSiteSettingTimes($pdo) {
    ensureSiteSettingsTable($pdo);
    $times = [];
    foreach ($pdo->query('SELECT section, UNIX_TIMESTAMP(updated_at) * 1000 AS savedAt FROM site_settings')->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $times[$row['section']] = (float) $row['savedAt'];
    }
    return $times;
}

/** The QR picture is in the Media folder (uploaded through event_media.php). */
function siteMediaFileExists($path) {
    return is_string($path)
        && preg_match('#^' . preg_quote(MEDIA_PATH_PREFIX, '#') . '(' . MEDIA_FILE_PATTERN . ')$#', $path, $match)
        && preg_match('/\.(jpg|png|webp)$/', $match[1])
        && is_file(MEDIA_DIR . '/' . $match[1]);
}

/** Customers can pay online only once the QR and the account name are set. */
function gcashIsReady($settings) {
    $gcash = $settings['gcash'] ?? [];
    return trim((string) ($gcash['accountName'] ?? '')) !== '' && siteMediaFileExists($gcash['qr']['path'] ?? null);
}

/** The Media files the settings use, so the clean-up of unused uploads keeps them. */
function siteSettingMediaFiles($pdo) {
    $path = readSiteSettings($pdo)['gcash']['qr']['path'] ?? '';
    return is_string($path) && $path !== '' ? [basename($path)] : [];
}

function readOpeningHours($pdo) {
    return readSiteSettings($pdo)['hours'];
}

function siteMinutesOfDay($time) {
    [$hours, $minutes] = array_map('intval', explode(':', $time) + [0, 0]);
    return $hours * 60 + $minutes;
}

function siteClockLabel($time) {
    return DateTime::createFromFormat('H:i', $time)->format('g:i A');
}

/**
 * Why a website booking falls outside the opening hours, or '' when it fits:
 * it starts at or after opening and ends by closing, on the same day.
 */
function bookingHoursError($booking, $hours) {
    $start = siteMinutesOfDay($booking['time']);
    $end = $start + (int) $booking['durationMinutes'];
    if ($start >= siteMinutesOfDay($hours['open']) && $end <= siteMinutesOfDay($hours['close'])) return '';
    return 'Break & Chill is open ' . siteClockLabel($hours['open']) . ' to ' . siteClockLabel($hours['close'])
        . '. Please book a time that starts and ends inside those hours.';
}

// ---------------------------------------------------------------- checking what the admin saves

// One line of plain text: no control characters, trimmed to $limit.
function cleanSiteText($value, $limit) {
    $text = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) ($value ?? '')) ?? '');
    return function_exists('mb_substr') ? mb_substr($text, 0, $limit) : substr($text, 0, $limit);
}

// 09XXXXXXXXX from 09..., 639... or +639...; '' when it is not a PH mobile number.
function cleanSiteMobile($value) {
    $digits = preg_replace('/\D/', '', (string) $value);
    if (preg_match('/^639\d{9}$/', $digits)) $digits = '0' . substr($digits, 2);
    return preg_match('/^09\d{9}$/', $digits) ? $digits : '';
}

// An https link on one of $hosts (and, for google.com, under /maps).
function isSiteLink($url, $hosts) {
    $parts = parse_url((string) $url);
    if (!$parts || strtolower($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['pass'])) return false;
    $host = strtolower($parts['host'] ?? '');
    if (!in_array($host, $hosts, true)) return false;
    if (in_array($host, ['google.com', 'www.google.com'], true)) return strpos($parts['path'] ?? '', '/maps') === 0;
    return true;
}

const SITE_MAPS_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'maps.google.com', 'www.google.com', 'google.com', 'g.page'];
const SITE_FACEBOOK_HOSTS = ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.com', 'www.fb.com', 'fb.me', 'm.me'];

function isSiteDate($value) {
    $date = DateTime::createFromFormat('Y-m-d', (string) $value);
    return $date && $date->format('Y-m-d') === $value;
}

/**
 * The section as it will be saved, or an error to show the admin:
 * [$values, ''] or [null, 'message'].
 */
function cleanSiteSection($section, $values) {
    $values = is_array($values) ? $values : [];

    if ($section === 'gcash') {
        $name = cleanSiteText($values['accountName'] ?? '', 60);
        $rawNumber = trim((string) ($values['number'] ?? ''));
        $number = cleanSiteMobile($rawNumber);
        if ($rawNumber !== '' && $number === '') return [null, 'Enter the GCash number as a mobile number, 09XXXXXXXXX.'];
        $path = $values['qr']['path'] ?? null;
        if ($path !== null && $path !== '' && !siteMediaFileExists($path)) {
            return [null, 'The QR picture was not found. Please upload it again (PNG, JPG or WebP).'];
        }
        return [[
            'accountName' => $name,
            'number' => $number,
            'qr' => $path ? ['path' => $path, 'type' => 'image'] : null,
        ], ''];
    }

    if ($section === 'business') {
        $address = cleanSiteText($values['address'] ?? '', 200);
        $mapsUrl = trim((string) ($values['mapsUrl'] ?? ''));
        $phone = cleanSiteText($values['phone'] ?? '', 20);
        $facebookUrl = trim((string) ($values['facebookUrl'] ?? ''));
        if ($mapsUrl !== '' && !isSiteLink($mapsUrl, SITE_MAPS_HOSTS)) {
            return [null, 'Use the Share link from Google Maps (it starts with https://maps.app.goo.gl/ or https://www.google.com/maps/).'];
        }
        if ($facebookUrl !== '' && !isSiteLink($facebookUrl, SITE_FACEBOOK_HOSTS)) {
            return [null, 'Use the link of the Facebook page (https://www.facebook.com/...) or of Messenger (https://m.me/...).'];
        }
        if ($phone !== '' && (!preg_match('/^[0-9 +()\-]+$/', $phone) || strlen(preg_replace('/\D/', '', $phone)) < 7)) {
            return [null, 'Enter the contact number with digits only, e.g. 0917 123 4567 or (02) 8123 4567.'];
        }
        return [['address' => $address, 'mapsUrl' => $mapsUrl, 'phone' => $phone, 'facebookUrl' => $facebookUrl], ''];
    }

    if ($section === 'announcement') {
        $enabled = filter_var($values['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $message = cleanSiteText($values['message'] ?? '', SITE_ANNOUNCEMENT_MAX);
        $startDate = trim((string) ($values['startDate'] ?? ''));
        $endDate = trim((string) ($values['endDate'] ?? ''));
        if ($enabled && $message === '') return [null, 'Write the announcement before turning it on.'];
        foreach ([$startDate, $endDate] as $date) {
            if ($date !== '' && !isSiteDate($date)) return [null, 'Pick the dates from the calendar.'];
        }
        if ($startDate !== '' && $endDate !== '' && $endDate < $startDate) return [null, 'The last day cannot be before the first day.'];
        return [['enabled' => $enabled, 'message' => $message, 'startDate' => $startDate, 'endDate' => $endDate], ''];
    }

    if ($section === 'hours') {
        $open = (string) ($values['open'] ?? '');
        $close = (string) ($values['close'] ?? '');
        $slot = '/^([01]\d|2[0-3]):(00|30)$/';
        if (!preg_match($slot, $open) || !preg_match($slot, $close)) {
            return [null, 'Choose the opening and closing times on the hour or half hour.'];
        }
        if (siteMinutesOfDay($close) - siteMinutesOfDay($open) < 60) {
            return [null, 'Closing must be at least 1 hour after opening, on the same day.'];
        }
        return [['open' => $open, 'close' => $close], ''];
    }

    return [null, 'Unknown website section.'];
}
