<?php
/*
 * What the admin sets for the website (Admin > Website): the GCash account
 * customers pay into, the hall's address and contacts, an announcement, the
 * opening hours, and the home page's words and pictures (the showcase slides,
 * the booking steps and the footer line). Kept in site_settings, one row per
 * section. A section never saved reads as its default, which is how the site
 * was before.
 */
require_once __DIR__ . '/media.php';

const SITE_SETTING_SECTIONS = ['gcash', 'business', 'announcement', 'hours', 'showcase', 'bookingSteps', 'footer'];
const SITE_ANNOUNCEMENT_MAX = 200;

// The showcase's own slides (open tournaments get theirs on their own, first).
const SITE_SLIDES_MAX = 5;
const SITE_SLIDE_TITLE_MAX = 60;
const SITE_SLIDE_TEXT_MAX = 160;
// Which part of the photo stays in view when the slide crops it.
const SITE_SLIDE_POSITIONS = ['center', 'top', 'bottom', 'left', 'right'];

// Always three steps: each sits on a numbered ball (1, 2, 3).
const SITE_BOOKING_STEPS = 3;
const SITE_STEPS_HEADING_MAX = 60;
const SITE_STEP_TITLE_MAX = 40;
const SITE_STEP_TEXT_MAX = 160;

const SITE_FOOTER_MAX = 80;

function siteSettingDefaults() {
    return [
        'gcash' => ['accountName' => '', 'number' => '', 'qr' => null],
        'business' => ['address' => '', 'mapsUrl' => '', 'phone' => '', 'facebookUrl' => ''],
        'announcement' => ['enabled' => false, 'message' => '', 'startDate' => '', 'endDate' => ''],
        'hours' => ['open' => '10:00', 'close' => '22:00'],
        // No photo: the slide uses the site's own picture.
        'showcase' => ['slides' => [
            ['id' => 'brand-1', 'title' => 'Play. Compete. Unwind.', 'text' => 'Break & Chill is your place for casual games, serious practice, and tournament play.', 'image' => null, 'position' => 'center'],
            ['id' => 'brand-2', 'title' => 'Your Next Game Starts Here', 'text' => 'Enjoy a focused billiards space built for players, teams, and friendly competition.', 'image' => null, 'position' => 'bottom'],
        ]],
        'bookingSteps' => ['heading' => 'Your table in three shots.', 'steps' => [
            ['title' => 'Pick a table and time', 'text' => 'Choose the date, an open table, your start time, and how many hours you want to play.'],
            ['title' => 'Pay with GCash', 'text' => 'Send the payment and enter the reference number from your receipt to hold the table.'],
            ['title' => 'Get confirmed', 'text' => 'The front desk checks your payment and approves the booking. Your table is waiting when you arrive.'],
        ]],
        'footer' => ['tagline' => 'Games, tournaments, and good breaks.'],
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

/** The QR or slide picture is in the Media folder (uploaded through event_media.php). */
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
    $settings = readSiteSettings($pdo);
    $paths = [$settings['gcash']['qr']['path'] ?? ''];
    foreach ((is_array($settings['showcase']['slides'] ?? null) ? $settings['showcase']['slides'] : []) as $slide) {
        $paths[] = is_array($slide) ? ($slide['image']['path'] ?? '') : '';
    }
    $files = [];
    foreach ($paths as $path) {
        if (is_string($path) && $path !== '') $files[] = basename($path);
    }
    return $files;
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

    if ($section === 'showcase') {
        $slides = is_array($values['slides'] ?? null) ? array_values($values['slides']) : [];
        if (!$slides) return [null, 'Keep at least one slide.'];
        if (count($slides) > SITE_SLIDES_MAX) return [null, 'The showcase takes up to ' . SITE_SLIDES_MAX . ' slides.'];
        $clean = [];
        $ids = [];
        foreach ($slides as $index => $slide) {
            $number = $index + 1;
            $slide = is_array($slide) ? $slide : [];
            $title = cleanSiteText($slide['title'] ?? '', SITE_SLIDE_TITLE_MAX);
            if ($title === '') return [null, "Give slide $number a title."];
            $path = $slide['image']['path'] ?? null;
            if ($path !== null && $path !== '' && !siteMediaFileExists($path)) {
                return [null, "The photo of slide $number was not found. Please upload it again (JPG, PNG or WebP)."];
            }
            // The website keys each slide by its id; a missing or repeated one gets a new id.
            $id = (string) ($slide['id'] ?? '');
            if (!preg_match('/^[a-z0-9-]{1,32}$/', $id) || isset($ids[$id])) $id = 'slide-' . bin2hex(random_bytes(4));
            $ids[$id] = true;
            $clean[] = [
                'id' => $id,
                'title' => $title,
                'text' => cleanSiteText($slide['text'] ?? '', SITE_SLIDE_TEXT_MAX),
                'image' => $path ? ['path' => $path, 'type' => 'image'] : null,
                'position' => in_array($slide['position'] ?? '', SITE_SLIDE_POSITIONS, true) ? $slide['position'] : 'center',
            ];
        }
        return [['slides' => $clean], ''];
    }

    if ($section === 'bookingSteps') {
        $heading = cleanSiteText($values['heading'] ?? '', SITE_STEPS_HEADING_MAX);
        if ($heading === '') return [null, 'Write the heading above the steps.'];
        $steps = is_array($values['steps'] ?? null) ? array_values($values['steps']) : [];
        if (count($steps) !== SITE_BOOKING_STEPS) return [null, 'The booking steps are always ' . SITE_BOOKING_STEPS . '.'];
        $clean = [];
        foreach ($steps as $index => $step) {
            $step = is_array($step) ? $step : [];
            $title = cleanSiteText($step['title'] ?? '', SITE_STEP_TITLE_MAX);
            $text = cleanSiteText($step['text'] ?? '', SITE_STEP_TEXT_MAX);
            if ($title === '' || $text === '') return [null, 'Give step ' . ($index + 1) . ' a title and a text.'];
            $clean[] = ['title' => $title, 'text' => $text];
        }
        return [['heading' => $heading, 'steps' => $clean], ''];
    }

    if ($section === 'footer') {
        // May be left empty: the footer then shows the name and the hours only.
        return [['tagline' => cleanSiteText($values['tagline'] ?? '', SITE_FOOTER_MAX)], ''];
    }

    return [null, 'Unknown website section.'];
}
