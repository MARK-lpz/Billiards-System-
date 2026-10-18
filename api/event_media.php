<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/media.php';
require_once '../config/site_settings.php';

// Pictures and videos that promote a tournament (shown on the website's
// slideshow and Tournaments page). Files are kept in backend/Media (see
// config/media.php) under a random name, the tournament stores "Media/<name>",
// and api/media.php sends them to the website.
// The admin's Website page uploads the GCash QR and the showcase photos here too.
// A file nothing uses is removed a day after it was uploaded (a form closed
// without saving, or a picture taken off a tournament).

const EVENT_MEDIA_DIR = MEDIA_DIR;
const EVENT_MEDIA_PATH = MEDIA_PATH_PREFIX;
const EVENT_MEDIA_TYPES = [
    'image/jpeg' => ['jpg', 'image'],
    'image/png' => ['png', 'image'],
    'image/webp' => ['webp', 'image'],
    'image/gif' => ['gif', 'image'],
    'video/mp4' => ['mp4', 'video'],
    'video/x-m4v' => ['mp4', 'video'],
    'video/webm' => ['webm', 'video'],
];
const EVENT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const EVENT_VIDEO_MAX_BYTES = 40 * 1024 * 1024;
const EVENT_MEDIA_PER_EVENT = 8;
const EVENT_MEDIA_STORAGE_BYTES = 1536 * 1024 * 1024;
const EVENT_MEDIA_UNUSED_GRACE_SECONDS = 24 * 60 * 60;

function respond($status, $body) {
    http_response_code($status);
    echo json_encode($body);
    exit();
}

// "8M" from php.ini, in bytes.
function iniBytes($value) {
    $value = trim((string) $value);
    if ($value === '' || $value === '-1') return PHP_INT_MAX;
    $number = (float) $value;
    switch (strtolower(substr($value, -1))) {
        case 'g': return (int) ($number * 1024 * 1024 * 1024);
        case 'm': return (int) ($number * 1024 * 1024);
        case 'k': return (int) ($number * 1024);
        default: return (int) $number;
    }
}

// The most this server takes in one upload, whatever the app allows.
function serverUploadLimit() {
    return min(iniBytes(ini_get('upload_max_filesize')), iniBytes(ini_get('post_max_size')));
}

function limits() {
    $server = serverUploadLimit();
    return [
        'imageMaxBytes' => min(EVENT_IMAGE_MAX_BYTES, $server),
        'videoMaxBytes' => min(EVENT_VIDEO_MAX_BYTES, $server),
        'perEvent' => EVENT_MEDIA_PER_EVENT,
    ];
}

function megabytes($bytes) {
    return rtrim(rtrim(number_format($bytes / (1024 * 1024), 1), '0'), '.') . ' MB';
}

// The folder for uploads, made on first use. Files are only ever saved with a
// picture or video extension picked here, so nothing in it can run as a script;
// the empty index.html keeps the folder from being listed.
function ensureMediaDir() {
    if (!is_dir(EVENT_MEDIA_DIR) && !mkdir(EVENT_MEDIA_DIR, 0755, true) && !is_dir(EVENT_MEDIA_DIR)) {
        return false;
    }
    if (!is_file(EVENT_MEDIA_DIR . '/index.html')) file_put_contents(EVENT_MEDIA_DIR . '/index.html', '');
    $htaccess = EVENT_MEDIA_DIR . '/.htaccess';
    if (!is_file($htaccess)) {
        file_put_contents($htaccess, implode("\n", [
            '# Uploaded tournament pictures and videos: never guessed as another type.',
            '<IfModule mod_headers.c>',
            '  Header set X-Content-Type-Options "nosniff"',
            '</IfModule>',
            '',
        ]));
    }
    return true;
}

// The picture and video files in the Media folder.
function storedMediaFiles() {
    $files = [];
    foreach (scandir(EVENT_MEDIA_DIR) ?: [] as $entry) {
        if (preg_match('/^' . MEDIA_FILE_PATTERN . '$/', $entry)) $files[] = EVENT_MEDIA_DIR . '/' . $entry;
    }
    return $files;
}

// Every media file name a saved tournament, or the website's settings, still uses.
function usedMediaFiles($pdo) {
    $used = [];
    try {
        $rows = $pdo->query('SELECT event_data FROM tournament_events')->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $error) {
        return null; // No tournaments table yet: nothing can be judged unused.
    }
    foreach ($rows as $json) {
        $event = json_decode($json, true);
        foreach ((is_array($event['media'] ?? null) ? $event['media'] : []) as $item) {
            if (is_array($item) && isset($item['path'])) $used[basename((string) $item['path'])] = true;
        }
    }
    // The website's GCash QR and showcase photos (Admin > Website) live in Media too.
    try {
        foreach (siteSettingMediaFiles($pdo) as $name) $used[$name] = true;
    } catch (Throwable $error) {
        return null; // The settings cannot be read: nothing can be judged unused.
    }
    return $used;
}

// Removes files no tournament uses once they are a day old; returns the bytes still stored.
function cleanUnusedMedia($pdo) {
    $used = usedMediaFiles($pdo);
    $stored = 0;
    foreach (storedMediaFiles() as $file) {
        $unused = $used !== null && !isset($used[basename($file)]);
        if ($unused && filemtime($file) < time() - EVENT_MEDIA_UNUSED_GRACE_SECONDS) {
            @unlink($file);
            continue;
        }
        $stored += (int) filesize($file);
    }
    return $stored;
}

$method = $_SERVER['REQUEST_METHOD'];
// Added from the admin's Events page only.
requireStaff(getDBConnection(), ['admin']);

if ($method === 'GET') {
    respond(200, ['success' => true, 'limits' => limits()]);
}

if ($method !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Method not allowed']);
}

$limits = limits();

// A body over post_max_size arrives empty, so it is told apart by its length.
$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if (empty($_FILES) && $contentLength > iniBytes(ini_get('post_max_size'))) {
    respond(413, ['success' => false, 'message' => 'This file is larger than the server accepts (' . megabytes(serverUploadLimit()) . ').']);
}

$upload = $_FILES['file'] ?? null;
if (!is_array($upload) || is_array($upload['error'] ?? null)) {
    respond(400, ['success' => false, 'message' => 'Choose one picture or video to upload.']);
}

$error = (int) $upload['error'];
if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
    respond(413, ['success' => false, 'message' => 'This file is larger than the server accepts (' . megabytes(serverUploadLimit()) . ').']);
}
if ($error === UPLOAD_ERR_NO_FILE || (int) $upload['size'] === 0) {
    respond(400, ['success' => false, 'message' => 'The file is empty. Choose another picture or video.']);
}
if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name'])) {
    respond(500, ['success' => false, 'message' => 'The upload did not finish. Please try again.']);
}

// The file's real type, from its contents (not its name or what the browser said).
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = $finfo ? (string) finfo_file($finfo, $upload['tmp_name']) : '';
if ($finfo) finfo_close($finfo);
if (!isset(EVENT_MEDIA_TYPES[$mime])) {
    respond(415, ['success' => false, 'message' => 'Use a JPG, PNG, WebP or GIF picture, or an MP4 or WebM video.']);
}
[$extension, $kind] = EVENT_MEDIA_TYPES[$mime];

$size = (int) $upload['size'];
$max = $kind === 'image' ? $limits['imageMaxBytes'] : $limits['videoMaxBytes'];
if ($size > $max) {
    respond(413, ['success' => false, 'message' => ($kind === 'image' ? 'Pictures' : 'Videos') . ' can be up to ' . megabytes($max) . '.']);
}

$width = null;
$height = null;
if ($kind === 'image') {
    $dimensions = @getimagesize($upload['tmp_name']);
    if (!$dimensions || $dimensions[0] < 1 || $dimensions[1] < 1) {
        respond(415, ['success' => false, 'message' => 'This picture could not be read. Save it again as JPG or PNG and retry.']);
    }
    [$width, $height] = $dimensions;
}

if (!ensureMediaDir()) {
    respond(500, ['success' => false, 'message' => 'The server has no folder to keep uploads in.']);
}

$pdo = getDBConnection();
$stored = cleanUnusedMedia($pdo);
if ($stored + $size > EVENT_MEDIA_STORAGE_BYTES) {
    respond(507, ['success' => false, 'message' => 'Storage for tournament media is full. Remove pictures or videos from past tournaments first.']);
}

$name = bin2hex(random_bytes(16)) . '.' . $extension;
if (!move_uploaded_file($upload['tmp_name'], EVENT_MEDIA_DIR . '/' . $name)) {
    respond(500, ['success' => false, 'message' => 'The file could not be saved on the server.']);
}
@chmod(EVENT_MEDIA_DIR . '/' . $name, 0644);

respond(200, [
    'success' => true,
    'media' => array_filter([
        'id' => pathinfo($name, PATHINFO_FILENAME),
        'path' => EVENT_MEDIA_PATH . $name,
        'type' => $kind,
        'width' => $width,
        'height' => $height,
    ], fn($value) => $value !== null),
]);
?>
