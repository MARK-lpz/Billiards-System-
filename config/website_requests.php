<?php
/*
 * Lets the website show a customer where their own booking or tournament
 * sign-up stands (waiting, approved, turned down, money sent back) without a
 * sign-in. When the website sends one, it gets back a key: "req-<id>.<secret>".
 * The customer's browser keeps it; only the secret's SHA-256 is kept here, and
 * only someone holding the key can read that request (api/request_status.php).
 * A key says nothing about anyone else's bookings.
 */

const REQUEST_KEY_PATTERN = '/^(req-[a-f0-9]{16})\.([a-f0-9]{32})$/';
// A browser asks about at most this many at once.
const REQUEST_STATUS_MAX = 10;
// Kept this long; the browser forgets them sooner.
const REQUEST_KEEP_DAYS = 120;

function ensureWebsiteRequestsTable(PDO $pdo): void
{
    static $ready = false;
    if ($ready) return;
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS website_requests (
            id VARCHAR(24) NOT NULL PRIMARY KEY,
            key_hash CHAR(64) NOT NULL,
            kind VARCHAR(20) NOT NULL,
            ref_id VARCHAR(80) NOT NULL,
            participant VARCHAR(200) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX website_requests_ref (kind, ref_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $ready = true;
}

/**
 * A key for a request the website just sent: kind "reservation" (ref = the
 * booking's id) or "tournament" (ref = the tournament's id, with the player's
 * name as it is on the list). Run after the request is saved, outside its
 * transaction (the table may be made here).
 */
function createWebsiteRequest(PDO $pdo, string $kind, string $refId, string $participant = ''): string
{
    ensureWebsiteRequestsTable($pdo);
    $pdo->exec('DELETE FROM website_requests WHERE created_at < NOW() - INTERVAL ' . REQUEST_KEEP_DAYS . ' DAY');
    $id = 'req-' . bin2hex(random_bytes(8));
    $secret = bin2hex(random_bytes(16));
    $pdo->prepare('INSERT INTO website_requests (id, key_hash, kind, ref_id, participant) VALUES (?, ?, ?, ?, ?)')
        ->execute([$id, hash('sha256', $secret), $kind, $refId, $participant]);
    return "$id.$secret";
}

// The payment's part, for its own customer: never the receipt, and only the
// end of the number it goes back to.
function requestPaymentView(?array $row): ?array
{
    if (!$row) return null;
    $payer = preg_replace('/\D/', '', (string) $row['payer_number']);
    return [
        'status' => (string) $row['status'],
        'amount' => (float) $row['amount'],
        'refundMethod' => (string) ($row['refund_method'] ?? ''),
        'refundReference' => (string) ($row['refund_reference'] ?? ''),
        'sentToEnding' => strlen($payer) >= 4 ? substr($payer, -4) : '',
    ];
}

function describeWebsiteRequest(PDO $pdo, array $request): ?array
{
    if ($request['kind'] === 'reservation') {
        $stmt = $pdo->prepare(
            'SELECT reservation_date AS date, TIME_FORMAT(reservation_time, "%H:%i") AS time, duration_minutes,
                    table_name, status
             FROM reservations WHERE id = ?'
        );
        $stmt->execute([$request['ref_id']]);
        $booking = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$booking) return null;
        $payment = $pdo->prepare(
            "SELECT status, amount, refund_method, refund_reference, payer_number FROM online_payments
             WHERE kind = 'reservation' AND ref_id = ? LIMIT 1"
        );
        $payment->execute([$request['ref_id']]);
        return [
            'kind' => 'reservation',
            'tableName' => (string) $booking['table_name'],
            'date' => (string) $booking['date'],
            'time' => (string) $booking['time'],
            'durationMinutes' => (int) $booking['duration_minutes'],
            'status' => (string) $booking['status'],
            'payment' => requestPaymentView($payment->fetch(PDO::FETCH_ASSOC) ?: null),
        ];
    }

    if ($request['kind'] === 'tournament') {
        $stmt = $pdo->prepare('SELECT event_data FROM tournament_events WHERE id = ?');
        $stmt->execute([$request['ref_id']]);
        $stored = $stmt->fetchColumn();
        if ($stored === false) return null;
        $event = json_decode((string) $stored, true) ?: [];
        $players = array_map(fn($player) => trim((string) $player), is_array($event['participants'] ?? null) ? $event['participants'] : []);
        $payment = $pdo->prepare(
            "SELECT status, amount, refund_method, refund_reference, payer_number FROM online_payments
             WHERE kind = 'tournament' AND ref_id = ? AND participant = ? ORDER BY created_at DESC LIMIT 1"
        );
        $payment->execute([$request['ref_id'], $request['participant']]);
        return [
            'kind' => 'tournament',
            'eventName' => (string) ($event['name'] ?? ''),
            'date' => (string) ($event['date'] ?? ''),
            'time' => (string) ($event['time'] ?? ''),
            'eventStatus' => (string) ($event['status'] ?? ''),
            'participant' => (string) $request['participant'],
            'onList' => in_array(trim((string) $request['participant']), $players, true),
            'payment' => requestPaymentView($payment->fetch(PDO::FETCH_ASSOC) ?: null),
        ];
    }

    return null;
}

/**
 * Where each request stands, for keys the website kept: [{ key, found, ... }].
 * A key that is not one, or whose secret does not match, is just not found.
 */
function readWebsiteRequests(PDO $pdo, array $keys): array
{
    ensureWebsiteRequestsTable($pdo);
    $lookup = $pdo->prepare('SELECT id, key_hash, kind, ref_id, participant FROM website_requests WHERE id = ?');
    $answers = [];
    foreach ($keys as $key) {
        $key = (string) $key;
        $view = null;
        if (preg_match(REQUEST_KEY_PATTERN, $key, $match)) {
            $lookup->execute([$match[1]]);
            $request = $lookup->fetch(PDO::FETCH_ASSOC);
            if ($request && hash_equals($request['key_hash'], hash('sha256', $match[2]))) {
                $view = describeWebsiteRequest($pdo, $request);
            }
        }
        $answers[] = $view ? ['key' => $key, 'found' => true] + $view : ['key' => $key, 'found' => false];
    }
    return $answers;
}
