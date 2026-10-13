<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/collection.php';
require_once '../config/media.php';

// Tournaments: the website lists them and registers players (POST); only the
// admin's screen changes them, one tournament at a time (see
// config/collection.php).

function readJsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

// Short text staff write for players (a reason), trimmed to a safe length.
function cleanEventText($value, $limit = 200) {
    $text = trim((string) ($value ?? ''));
    return trim(function_exists('mb_substr') ? mb_substr($text, 0, $limit) : substr($text, 0, $limit));
}

// Promo pictures and videos (uploaded through event_media.php): only files in
// the Media folder, at most 8, the first being the cover. A path from before
// the folder moved (uploads/events/) is kept as its Media/ one.
function normalizeEventMedia($media) {
    $items = [];
    foreach (is_array($media) ? $media : [] as $item) {
        if (!is_array($item)) continue;
        $path = (string) ($item['path'] ?? '');
        if (!preg_match('#^(?:Media/|uploads/events/)(' . MEDIA_FILE_PATTERN . ')$#', $path, $match)) continue;
        $name = $match[1];
        $type = in_array($match[2], ['mp4', 'webm'], true) ? 'video' : 'image';
        $entry = ['id' => substr($name, 0, 32), 'path' => MEDIA_PATH_PREFIX . $name, 'type' => $type];
        foreach (['width', 'height'] as $side) {
            if (isset($item[$side]) && (int) $item[$side] > 0) $entry[$side] = (int) $item[$side];
        }
        $items[$entry['id']] = $entry;
        if (count($items) === 8) break;
    }
    return array_values($items);
}

function normalizeEvent($event) {
    if (!is_array($event)) {
        return null;
    }

    $id = trim((string) ($event['id'] ?? ''));
    $name = trim((string) ($event['name'] ?? ''));
    if ($id === '' || $name === '') {
        return null;
    }

    $status = strtolower(trim((string) ($event['status'] ?? 'upcoming')));
    if (!in_array($status, ['upcoming', 'active', 'completed', 'cancelled'], true)) {
        $status = 'upcoming';
    }

    $participants = array_values(array_filter(
        is_array($event['participants'] ?? null) ? $event['participants'] : [],
        fn($participant) => is_string($participant) && trim($participant) !== ''
    ));

    // The schedule before staff moved the event, so the website can show both.
    $previous = $event['rescheduledFrom'] ?? null;
    $rescheduledFrom = is_array($previous)
        ? [
            'date' => cleanEventText($previous['date'] ?? '', 20),
            'time' => cleanEventText($previous['time'] ?? '', 10),
        ]
        : null;

    return [
        'id' => $id,
        'name' => $name,
        'date' => trim((string) ($event['date'] ?? '')),
        'time' => trim((string) ($event['time'] ?? '')),
        'prize' => max(0, (float) ($event['prize'] ?? 0)),
        'entryFee' => max(0, (float) ($event['entryFee'] ?? 0)),
        'status' => $status,
        'gameType' => trim((string) ($event['gameType'] ?? '8-ball')),
        'tables' => array_values(is_array($event['tables'] ?? null) ? $event['tables'] : []),
        'participants' => $participants,
        'cancelledAt' => cleanEventText($event['cancelledAt'] ?? '', 40),
        'cancelReason' => cleanEventText($event['cancelReason'] ?? ''),
        'rescheduledFrom' => $rescheduledFrom,
        'rescheduledAt' => cleanEventText($event['rescheduledAt'] ?? '', 40),
        'rescheduleReason' => cleanEventText($event['rescheduleReason'] ?? ''),
        'media' => normalizeEventMedia($event['media'] ?? []),
    ];
}

$pdo = getDBConnection();
$spec = openCollection($pdo, 'events');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query('SELECT id, event_data, version FROM tournament_events ORDER BY updated_at DESC');
    $events = [];
    $versions = [];
    foreach ($stmt->fetchAll() as $row) {
        $event = json_decode($row['event_data'], true) ?: [];
        $event['id'] = $row['id'];
        $event = normalizeEvent($event);
        if (!$event) continue;
        $events[] = $event;
        $versions[$event['id']] = (int) $row['version'];
    }

    echo json_encode(['success' => true, 'events' => $events, 'versions' => (object) $versions]);
    exit();
}

$data = readJsonBody();

if ($method === 'PUT') {
    $staff = requireStaff($pdo, ['admin']);
    try {
        $result = changeCollection($pdo, $spec, $data, [
            'staff' => $staff,
            'validate' => fn($event) => normalizeEvent($event) ?? 'Each tournament needs an id and a name.',
            'canCreate' => true,
            'canRemove' => false,
        ]);
    } catch (CollectionRefusal $refusal) {
        sendCollectionRefusal($refusal);
    }

    echo json_encode(['success' => true, 'versions' => $result['versions']]);
    exit();
}

if ($method === 'POST') {
    $eventId = trim((string) ($data['eventId'] ?? ''));
    $participant = trim((string) ($data['participant'] ?? ''));
    if ($eventId === '' || $participant === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'An event and participant are required.']);
        exit();
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT event_data, version FROM tournament_events WHERE id = ? FOR UPDATE');
        $stmt->execute([$eventId]);
        $stored = $stmt->fetch(PDO::FETCH_ASSOC);
        $storedEvent = $stored ? $stored['event_data'] : null;
        if (!$storedEvent) {
            throw new RuntimeException('Tournament not found.');
        }

        $event = normalizeEvent(array_merge(json_decode($storedEvent, true) ?: [], ['id' => $eventId]));
        if (!$event || !in_array($event['status'], ['upcoming', 'active'], true)) {
            throw new RuntimeException('Tournament registration is closed.');
        }
        // Open through the event's own day, as on the website, but not after it.
        $today = (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
        if ($event['date'] !== '' && $event['date'] < $today) {
            throw new RuntimeException('Tournament registration is closed.');
        }

        // "Juan Cruz (Team Cue)" and "juan cruz" are the same player: told, not added twice.
        $playerKey = fn($label) => strtolower(trim(preg_replace('/\s*\(.*\)\s*$/', '', $label)));
        foreach ($event['participants'] as $existing) {
            if ($playerKey($existing) === $playerKey($participant)) {
                throw new RuntimeException('This player is already registered for this tournament.');
            }
        }
        $event['participants'][] = $participant;

        // A new version, so a staff screen holding the old list cannot undo the registration.
        $update = $pdo->prepare('UPDATE tournament_events SET event_data = ?, version = version + 1 WHERE id = ?');
        $update->execute([json_encode($event), $eventId]);
        $pdo->commit();

        echo json_encode(['success' => true, 'event' => $event, 'version' => (int) $stored['version'] + 1]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $known = [
            'Tournament not found.' => 400,
            'Tournament registration is closed.' => 400,
            'This player is already registered for this tournament.' => 409,
        ];
        $message = isset($known[$error->getMessage()]) ? $error->getMessage() : 'Unable to save tournament registration.';
        http_response_code($known[$message] ?? 500);
        echo json_encode(['success' => false, 'message' => $message]);
    }
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
