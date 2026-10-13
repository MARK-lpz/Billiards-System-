<?php
require_once '../config/media.php';

// Sends one tournament picture or video from backend/Media to the website and
// the staff app: api/media.php?file=<name>. Open to everyone, like the
// website. Only names event_media.php gives out are served (32 hex characters
// and a picture or video extension), never anything else in the folder.

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    exit();
}

$name = (string) ($_GET['file'] ?? '');
$path = MEDIA_DIR . '/' . $name;
if (!preg_match('/^' . MEDIA_FILE_PATTERN . '$/', $name, $match) || !is_file($path)) {
    http_response_code(404);
    exit();
}

// The file goes out as it is: no output buffer or compression in between.
@ini_set('zlib.output_compression', '0');
while (ob_get_level()) ob_end_clean();

$size = (int) filesize($path);
$etag = '"' . md5($name . filemtime($path) . $size) . '"';
header('Content-Type: ' . MEDIA_CONTENT_TYPES[$match[1]]);
header('X-Content-Type-Options: nosniff');
// A name is never used for another file, so a browser may keep it for good.
header('Cache-Control: public, max-age=31536000, immutable');
header('ETag: ' . $etag);
header('Accept-Ranges: bytes');
if (trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit();
}

// Videos are played, and skipped through, a part at a time ("Range: bytes=a-b").
$start = 0;
$end = $size - 1;
if (preg_match('/^bytes=(\d*)-(\d*)$/', trim($_SERVER['HTTP_RANGE'] ?? ''), $range) && ($range[1] !== '' || $range[2] !== '')) {
    if ($range[1] === '') {
        $start = max(0, $size - (int) $range[2]); // the last N bytes
    } else {
        $start = (int) $range[1];
        if ($range[2] !== '') $end = min((int) $range[2], $size - 1);
    }
    if ($start > $end || $start >= $size) {
        http_response_code(416);
        header("Content-Range: bytes */$size");
        exit();
    }
    http_response_code(206);
    header("Content-Range: bytes $start-$end/$size");
}

header('Content-Length: ' . ($end - $start + 1));
if ($method === 'HEAD') exit();

$handle = fopen($path, 'rb');
fseek($handle, $start);
$left = $end - $start + 1;
while ($left > 0 && !feof($handle)) {
    $chunk = fread($handle, min(65536, $left));
    if ($chunk === false || $chunk === '') break;
    echo $chunk;
    $left -= strlen($chunk);
    flush();
}
fclose($handle);
