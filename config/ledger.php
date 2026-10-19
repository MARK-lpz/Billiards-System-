<?php
require_once __DIR__ . '/collection.php';

// The lists that keep growing (sales, the audit log, table bills), kept one row
// per item with a version, like config/collection.php. They are read in steps
// instead of whole: every write takes the list's next sequence number, so a
// screen asks only for what changed after the last number it saw.
//
//   GET ?after=<number>[&start=1]
//     -> { items, versions: {id: version}, cursor, more, epoch }
//   PUT { "upsert": [ { "item": {...}, "version": 0 }, ... ] }
//     -> { versions: {id: version}, conflicts: [ {id, item, version} ], rejected: [ {id, message} ] }
//
// Version 0 is a new item. One the server already has, unchanged, counts as
// saved: a screen sending it again after a lost answer, or a second browser
// holding the same copy. A different item under a known id, or a change made to
// an older version, is a conflict: nothing is written and the server's copy is
// sent back. Each item is checked on its own, so one bad item never holds back
// the rest. `epoch` changes when a backup is restored: a screen holding another
// epoch reads the whole list again.

const LEDGER_PAGE = 500;
const LEDGER_MAX_CHANGES = 200;

function ledgerSpec(string $name): array
{
    $specs = [
        'sales' => [
            'name' => 'sales', 'table' => 'sales_ledger', 'label' => 'sale',
            // A receipt carries every table session it paid for.
            'maxBytes' => 60000, 'editable' => false,
        ],
        'audit' => [
            'name' => 'audit', 'table' => 'audit_ledger', 'label' => 'audit entry',
            // An entry that mentions a problem is marked resolved on it.
            'maxBytes' => 20000, 'editable' => true,
        ],
        'charges' => [
            'name' => 'charges', 'table' => 'table_charge_ledger', 'label' => 'table bill',
            'maxBytes' => 60000, 'editable' => true,
            'state' => fn(array $item) => is_scalar($item['status'] ?? null) ? mb_substr((string) $item['status'], 0, 20) : null,
            // A screen's first read leaves out bills paid days ago: they are on
            // their sale's receipt, and only waiting bills are worked on.
            'startWhere' => "NOT (item_state = 'paid' AND updated_at < NOW() - INTERVAL 3 DAY)",
        ],
    ];
    if (!isset($specs[$name])) throw new InvalidArgumentException("Unknown ledger $name");
    return $specs[$name];
}

function ledgerNames(): array
{
    return ['sales', 'audit', 'charges'];
}

// The ledger's table and its sequence, created on first use. Returns its spec.
function openLedger(PDO $pdo, string $name): array
{
    $spec = ledgerSpec($name);
    $table = $spec['table'];
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS `$table` (
            item_id VARCHAR(64) NOT NULL PRIMARY KEY,
            item_json MEDIUMTEXT NOT NULL,
            version INT UNSIGNED NOT NULL DEFAULT 1,
            seq BIGINT UNSIGNED NOT NULL,
            item_state VARCHAR(20) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by VARCHAR(80) NULL,
            updated_by VARCHAR(80) NULL,
            UNIQUE KEY `{$table}_seq` (seq)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS ledger_counters (
            name VARCHAR(40) NOT NULL PRIMARY KEY,
            seq BIGINT UNSIGNED NOT NULL DEFAULT 0,
            epoch VARCHAR(32) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $pdo->prepare('INSERT IGNORE INTO ledger_counters (name, seq, epoch) VALUES (?, 0, ?)')
        ->execute([$spec['name'], bin2hex(random_bytes(8))]);
    return $spec;
}

// After a restore: each ledger's sequence continues after its restored rows,
// under a new epoch, so every screen reads the restored lists again.
function restartLedgers(PDO $pdo): void
{
    foreach (ledgerNames() as $name) {
        $spec = ledgerSpec($name);
        $top = (int) $pdo->query("SELECT COALESCE(MAX(seq), 0) FROM `{$spec['table']}`")->fetchColumn();
        $pdo->prepare('UPDATE ledger_counters SET seq = ?, epoch = ? WHERE name = ?')
            ->execute([$top, bin2hex(random_bytes(8)), $name]);
    }
}

// What changed after `after`, oldest first, a page at a time. `start` is a
// screen's first read (the spec's startWhere applies).
function readLedger(PDO $pdo, array $spec, int $after, bool $start): array
{
    $counter = $pdo->prepare('SELECT seq, epoch FROM ledger_counters WHERE name = ?');
    $counter->execute([$spec['name']]);
    $row = $counter->fetch(PDO::FETCH_ASSOC);
    $top = (int) ($row['seq'] ?? 0);
    $epoch = (string) ($row['epoch'] ?? '');

    // Read the number first: every row up to it was written by then.
    $conditions = ['seq > ?', 'seq <= ?'];
    $params = [max(0, $after), $top];
    if ($start && !empty($spec['startWhere'])) $conditions[] = "({$spec['startWhere']})";
    $limit = LEDGER_PAGE + 1;
    $stmt = $pdo->prepare(
        "SELECT item_id, item_json, version, seq FROM `{$spec['table']}` WHERE " . implode(' AND ', $conditions) . " ORDER BY seq LIMIT $limit"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $more = count($rows) > LEDGER_PAGE;
    if ($more) array_pop($rows);

    $items = [];
    $versions = [];
    foreach ($rows as $entry) {
        $item = json_decode($entry['item_json'], true);
        if (!is_array($item)) continue;
        $items[] = $item;
        $versions[(string) $entry['item_id']] = (int) $entry['version'];
    }

    return [
        'items' => $items,
        'versions' => (object) $versions,
        'cursor' => $more ? (int) end($rows)['seq'] : max($top, $after),
        'more' => $more,
        'epoch' => $epoch,
    ];
}

// An item's id as the screens write it. An audit entry's id is the time plus a
// fraction (1760868000123.4567): written the way JSON writes it, not cut to
// PHP's 14 digits, so it stays the id the screen knows it by.
function ledgerItemId($value): string
{
    if (is_float($value)) return (string) json_encode($value);
    return is_scalar($value) ? trim((string) $value) : '';
}

// Applies one save. $rules: staff (for created_by / updated_by) and validate,
// fn(array $item): array|string, the item to keep or why it is refused.
function changeLedger(PDO $pdo, array $spec, array $payload, array $rules): array
{
    $upserts = $payload['upsert'] ?? [];
    if (!is_array($upserts)) throw new CollectionRefusal(400, 'invalid', 'The changes could not be read.');
    if (count($upserts) > LEDGER_MAX_CHANGES) throw new CollectionRefusal(400, 'invalid', 'Too many changes in one save.');

    $rejected = [];
    $wanted = [];
    foreach ($upserts as $change) {
        $item = is_array($change) ? ($change['item'] ?? null) : null;
        $id = ledgerItemId(is_array($item) ? ($item['id'] ?? null) : null);
        if ($id === '' || strlen($id) > 64) {
            $rejected[] = ['id' => $id, 'message' => "Each {$spec['label']} needs an id."];
            continue;
        }
        if (isset($wanted[$id])) {
            $rejected[] = ['id' => $id, 'message' => "The same {$spec['label']} was sent twice."];
            continue;
        }
        $stored = $rules['validate']($item);
        if (is_string($stored)) {
            $rejected[] = ['id' => $id, 'message' => $stored];
            continue;
        }
        $json = json_encode($stored);
        if ($json === false || strlen($json) > $spec['maxBytes']) {
            $rejected[] = ['id' => $id, 'message' => "This {$spec['label']} is too large to save."];
            continue;
        }
        $wanted[$id] = ['item' => $stored, 'json' => $json, 'version' => (int) ($change['version'] ?? 0)];
    }

    $versions = [];
    $conflicts = [];
    if (!$wanted) return ['versions' => (object) [], 'conflicts' => [], 'rejected' => $rejected];

    $table = $spec['table'];
    $by = mb_substr((string) ($rules['staff']['username'] ?? ''), 0, 80);
    $stateOf = $spec['state'] ?? fn(array $item) => null;

    $pdo->beginTransaction();
    try {
        // Writers take the sequence one at a time, so numbers are handed out
        // in the order the rows become readable.
        $counter = $pdo->prepare('SELECT seq FROM ledger_counters WHERE name = ? FOR UPDATE');
        $counter->execute([$spec['name']]);
        $seq = (int) $counter->fetchColumn();
        $startSeq = $seq;

        $read = $pdo->prepare("SELECT item_json, version FROM `$table` WHERE item_id = ? FOR UPDATE");
        $insert = $pdo->prepare("INSERT INTO `$table` (item_id, item_json, version, seq, item_state, created_by, updated_by) VALUES (?, ?, 1, ?, ?, ?, ?)");
        $update = $pdo->prepare("UPDATE `$table` SET item_json = ?, version = version + 1, seq = ?, item_state = ?, updated_by = ? WHERE item_id = ?");

        foreach ($wanted as $id => $change) {
            $read->execute([$id]);
            $row = $read->fetch(PDO::FETCH_ASSOC);
            $id = (string) $id;
            if (!$row) {
                // New, or one the server no longer has (a restore): kept as sent.
                $insert->execute([$id, $change['json'], ++$seq, $stateOf($change['item']), $by, $by]);
                $versions[$id] = 1;
                continue;
            }
            $storedItem = json_decode($row['item_json'], true);
            if (json_encode($storedItem) === $change['json']) {
                $versions[$id] = (int) $row['version'];
                continue;
            }
            if (!$spec['editable'] || $change['version'] !== (int) $row['version']) {
                $conflicts[] = ['id' => $id, 'item' => $storedItem, 'version' => (int) $row['version']];
                continue;
            }
            $update->execute([$change['json'], ++$seq, $stateOf($change['item']), $by, $id]);
            $versions[$id] = (int) $row['version'] + 1;
        }

        if ($seq !== $startSeq) {
            $pdo->prepare('UPDATE ledger_counters SET seq = ? WHERE name = ?')->execute([$seq, $spec['name']]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }

    return ['versions' => (object) $versions, 'conflicts' => $conflicts, 'rejected' => $rejected];
}

// GET and PUT for one ledger, the same for every one of them. $access:
//   read      the roles that may read the list (every staff member may add to it)
//   validate  fn(array $item): array|string
function serveLedger(PDO $pdo, string $name, array $access): void
{
    $spec = openLedger($pdo, $name);
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        requireStaff($pdo, $access['read']);
        $page = readLedger($pdo, $spec, (int) ($_GET['after'] ?? 0), !empty($_GET['start']));
        echo json_encode(array_merge(['success' => true], $page));
        exit();
    }

    if ($method === 'PUT') {
        $staff = requireStaff($pdo);
        $payload = json_decode(file_get_contents('php://input'), true);
        if (!is_array($payload)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'The changes could not be read.']);
            exit();
        }
        try {
            $result = changeLedger($pdo, $spec, $payload, ['staff' => $staff, 'validate' => $access['validate']]);
        } catch (CollectionRefusal $refusal) {
            sendCollectionRefusal($refusal);
        }
        // Someone who may only add to the list is not shown what it holds.
        if (!in_array($staff['role'], $access['read'], true)) {
            $result['conflicts'] = array_map(fn($conflict) => ['id' => $conflict['id']], $result['conflicts']);
        }
        echo json_encode(array_merge(['success' => true], $result));
        exit();
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}
