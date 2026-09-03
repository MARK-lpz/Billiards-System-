<?php
require_once '../config/cors.php';
require_once '../config/database.php';

function readJsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function ensureTournamentEventsTable($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tournament_events (
            id VARCHAR(80) NOT NULL PRIMARY KEY,
            event_data LONGTEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX tournament_events_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
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
    if (!in_array($status, ['upcoming', 'active', 'completed'], true)) {
        $status = 'upcoming';
    }

    $participants = array_values(array_filter(
        is_array($event['participants'] ?? null) ? $event['participants'] : [],
        fn($participant) => is_string($participant) && trim($participant) !== ''
    ));

    return [
        'id' => $id,
        'name' => $name,
        'date' => trim((string) ($event['date'] ?? '')),
        'time' => trim((string) ($event['time'] ?? '')),
        'prize' => max(0, (float) ($event['prize'] ?? 0)),
        'status' => $status,
        'gameType' => trim((string) ($event['gameType'] ?? '8-ball')),
        'tables' => array_values(is_array($event['tables'] ?? null) ? $event['tables'] : []),
        'participants' => $participants,
    ];
}

$pdo = getDBConnection();
ensureTournamentEventsTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query('SELECT id, event_data FROM tournament_events ORDER BY updated_at DESC');
    $events = array_values(array_filter(array_map(function ($row) {
        $event = json_decode($row['event_data'], true) ?: [];
        $event['id'] = $row['id'];
        return normalizeEvent($event);
    }, $stmt->fetchAll())));

    echo json_encode(['success' => true, 'events' => $events]);
    exit();
}

$data = readJsonBody();

if ($method === 'PUT') {
    $events = $data['events'] ?? null;
    if (!is_array($events)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'A valid event list is required.']);
        exit();
    }

    $stmt = $pdo->prepare(
        'INSERT INTO tournament_events (id, event_data) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE event_data = VALUES(event_data)'
    );

    foreach ($events as $event) {
        $normalizedEvent = normalizeEvent($event);
        if (!$normalizedEvent) {
            continue;
        }
        $stmt->execute([$normalizedEvent['id'], json_encode($normalizedEvent)]);
    }

    echo json_encode(['success' => true]);
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
        $stmt = $pdo->prepare('SELECT event_data FROM tournament_events WHERE id = ? FOR UPDATE');
        $stmt->execute([$eventId]);
        $storedEvent = $stmt->fetchColumn();
        if (!$storedEvent) {
            throw new RuntimeException('Tournament not found.');
        }

        $event = normalizeEvent(array_merge(json_decode($storedEvent, true) ?: [], ['id' => $eventId]));
        if (!$event || !in_array($event['status'], ['upcoming', 'active'], true)) {
            throw new RuntimeException('Tournament registration is closed.');
        }

        if (!in_array($participant, $event['participants'], true)) {
            $event['participants'][] = $participant;
        }

        $update = $pdo->prepare('UPDATE tournament_events SET event_data = ? WHERE id = ?');
        $update->execute([json_encode($event), $eventId]);
        $pdo->commit();

        echo json_encode(['success' => true, 'event' => $event]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $message = $error->getMessage() === 'Tournament not found.' || $error->getMessage() === 'Tournament registration is closed.'
            ? $error->getMessage()
            : 'Unable to save tournament registration.';
        http_response_code($message === 'Unable to save tournament registration.' ? 500 : 400);
        echo json_encode(['success' => false, 'message' => $message]);
    }
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
