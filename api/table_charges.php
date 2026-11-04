<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/ledger.php';

// Table bills: a finished table session waiting to be paid in Sales / POS, and
// the ones already paid, on every device, so a session ended at one counter
// can be paid at another. A bill changes when it is paid, one version at a time
// (see config/ledger.php), so two counters cannot both take the same bill.
//
// History (the employee's History page) reads days of bills on their own:
//   GET ?history=1&from=YYYY-MM-DD&to=YYYY-MM-DD -> { success, charges, more }
// every session that ended on those days (Manila), paid or not. The list the
// screens keep leaves out bills paid days ago, so it cannot answer this.

const TABLE_HISTORY_MAX_DAYS = 93;
const TABLE_HISTORY_MAX_BILLS = 5000;

function cleanTableCharge($charge) {
    if (!is_array($charge)) return 'Each table bill must be an object.';
    if (!in_array($charge['status'] ?? '', ['unpaid', 'paid'], true)) return 'A table bill is either unpaid or paid.';
    if (trim((string) (is_scalar($charge['tableName'] ?? null) ? $charge['tableName'] : '')) === '') return 'Each table bill needs its table.';
    return $charge;
}

function historyDay($value, DateTimeZone $zone) {
    $day = DateTime::createFromFormat('!Y-m-d', (string) $value, $zone);
    return $day && $day->format('Y-m-d') === $value ? $day : null;
}

function sendTableChargeHistory(PDO $pdo, $from, $to) {
    $zone = new DateTimeZone('Asia/Manila');
    $first = historyDay($from, $zone);
    $last = historyDay($to, $zone);
    if (!$first || !$last || $last < $first) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Choose the days to show.']);
        exit();
    }
    if ($first->diff($last)->days + 1 > TABLE_HISTORY_MAX_DAYS) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Show at most ' . TABLE_HISTORY_MAX_DAYS . ' days at a time.']);
        exit();
    }

    $spec = openLedger($pdo, 'charges');
    $startMs = $first->getTimestamp() * 1000;
    $endMs = (clone $last)->modify('+1 day')->getTimestamp() * 1000;
    // A bill is written when its session ends, so the day it was written narrows
    // the rows; a day either side covers a database kept in another time zone.
    // The session's own end (endTime) decides.
    $stmt = $pdo->prepare(
        "SELECT item_json FROM `{$spec['table']}` WHERE created_at >= ? AND created_at < ? ORDER BY seq DESC LIMIT " . (TABLE_HISTORY_MAX_BILLS + 1)
    );
    $stmt->execute([
        (clone $first)->modify('-1 day')->format('Y-m-d H:i:s'),
        (clone $last)->modify('+2 days')->format('Y-m-d H:i:s'),
    ]);

    $charges = [];
    $rows = 0;
    foreach ($stmt as $row) {
        if (++$rows > TABLE_HISTORY_MAX_BILLS) break;
        $item = json_decode($row['item_json'], true);
        if (!is_array($item)) continue;
        $end = (float) ($item['endTime'] ?? 0);
        if ($end >= $startMs && $end < $endMs) $charges[] = $item;
    }
    echo json_encode(['success' => true, 'charges' => $charges, 'more' => $rows > TABLE_HISTORY_MAX_BILLS]);
    exit();
}

$pdo = getDBConnection();
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['history'])) {
    requireStaff($pdo, ['admin', 'employee']);
    sendTableChargeHistory($pdo, (string) ($_GET['from'] ?? ''), (string) ($_GET['to'] ?? ''));
}
serveLedger($pdo, 'charges', ['read' => ['admin', 'employee'], 'validate' => 'cleanTableCharge']);
