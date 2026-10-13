<?php
// The lists every staff screen shares (pool tables, equipment, tournaments),
// kept one row per item, each with a version number.
//
// A screen never sends a whole list to replace the stored one. It sends only
// the items it changed, each with the version it last saw:
//   { "upsert": [ { "item": {...}, "version": 3 }, { "item": {...}, "version": 0 } ],
//     "remove": [ { "id": "12", "version": 2 } ],
//     "confirmRemoval": [ "12" ] }
// Version 0 means a new item. If any item was changed elsewhere since that
// screen read it, nothing is saved (409 "conflict") and the screen reloads the
// list. Removing many items at once needs those ids in confirmRemoval, which
// only an explicit delete on screen sends (409 "confirm-removal" otherwise).

// More than this many removals, or more than half the list, in one save needs confirming.
const COLLECTION_BULK_REMOVAL = 5;
const COLLECTION_MAX_CHANGES = 200;
// Ids of removed items sent to screens, so an old copy cannot bring one back.
const COLLECTION_REMOVED_IDS_SENT = 500;

class CollectionRefusal extends RuntimeException
{
    public int $status;
    public string $refusalCode;
    public array $extra;

    public function __construct(int $status, string $code, string $message, array $extra = [])
    {
        parent::__construct($message);
        $this->status = $status;
        $this->refusalCode = $code;
        $this->extra = $extra;
    }
}

function sendCollectionRefusal(CollectionRefusal $refusal): void
{
    http_response_code($refusal->status);
    echo json_encode(array_merge(
        ['success' => false, 'code' => $refusal->refusalCode, 'message' => $refusal->getMessage()],
        $refusal->extra
    ));
    exit();
}

function collectionSpec(string $name): array
{
    $specs = [
        'tables' => [
            'name' => 'tables', 'table' => 'pool_table_items', 'id' => 'item_id', 'json' => 'item_json',
            'ordered' => true, 'tombstones' => true, 'maxBytes' => 20000, 'label' => 'table',
        ],
        'equipment' => [
            'name' => 'equipment', 'table' => 'equipment_items', 'id' => 'item_id', 'json' => 'item_json',
            'ordered' => true, 'tombstones' => true, 'maxBytes' => 20000, 'label' => 'equipment item',
        ],
        'events' => [
            'name' => 'events', 'table' => 'tournament_events', 'id' => 'id', 'json' => 'event_data',
            'ordered' => false, 'tombstones' => false, 'maxBytes' => 65000, 'label' => 'tournament',
        ],
    ];
    if (!isset($specs[$name])) throw new InvalidArgumentException("Unknown list $name");
    return $specs[$name];
}

function columnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $stmt->execute([$table, $column]);
    return (int) $stmt->fetchColumn() > 0;
}

function tableExistsHere(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
    $stmt->execute([$table]);
    return (int) $stmt->fetchColumn() > 0;
}

// The list's storage, created (and filled once from the old one-blob storage)
// on first use. Returns its spec.
function openCollection(PDO $pdo, string $name): array
{
    $spec = collectionSpec($name);
    $table = $spec['table'];

    if ($name === 'events') {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS tournament_events (
                id VARCHAR(80) NOT NULL PRIMARY KEY,
                event_data LONGTEXT NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX tournament_events_updated_at (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
        if (!columnExists($pdo, $table, 'version')) {
            $pdo->exec('ALTER TABLE tournament_events ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1');
        }
        if (!columnExists($pdo, $table, 'updated_by')) {
            $pdo->exec('ALTER TABLE tournament_events ADD COLUMN updated_by VARCHAR(80) NULL');
        }
        return $spec;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS `$table` (
            item_id VARCHAR(64) NOT NULL PRIMARY KEY,
            item_json LONGTEXT NOT NULL,
            version INT UNSIGNED NOT NULL DEFAULT 1,
            position INT NOT NULL DEFAULT 0,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by VARCHAR(80) NULL,
            deleted_at DATETIME NULL,
            INDEX `{$table}_live` (deleted_at, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    migrateLegacyList($pdo, $spec);
    return $spec;
}

// What the old storage held: [items, removed ids].
function readLegacyList(PDO $pdo, string $name): array
{
    if ($name === 'tables' && tableExistsHere($pdo, 'pool_table_status')) {
        $json = $pdo->query('SELECT tables_json FROM pool_table_status WHERE id = 1')->fetchColumn();
        $items = $json ? json_decode($json, true) : [];
        return [is_array($items) ? $items : [], []];
    }
    if ($name === 'equipment' && tableExistsHere($pdo, 'equipment_status')) {
        $row = $pdo->query('SELECT * FROM equipment_status WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
        $items = $row ? json_decode($row['equipment_json'] ?? '[]', true) : [];
        $removed = $row && !empty($row['removed_ids']) ? json_decode($row['removed_ids'], true) : [];
        return [is_array($items) ? $items : [], is_array($removed) ? $removed : []];
    }
    return [[], []];
}

// Copies the old one-blob list into rows, once. The old storage is left as it
// was (backups made before this change restore into it; see backup.php).
function migrateLegacyList(PDO $pdo, array $spec): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS sync_collections (
            name VARCHAR(40) NOT NULL PRIMARY KEY,
            migrated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $done = $pdo->prepare('SELECT 1 FROM sync_collections WHERE name = ?');
    $done->execute([$spec['name']]);
    if ($done->fetchColumn()) return;

    $pdo->beginTransaction();
    try {
        // A second request arriving now waits on this row, then finds it done.
        $mark = $pdo->prepare('INSERT IGNORE INTO sync_collections (name) VALUES (?)');
        $mark->execute([$spec['name']]);
        if ($mark->rowCount() === 0) {
            $pdo->rollBack();
            return;
        }

        [$items, $removedIds] = readLegacyList($pdo, $spec['name']);
        $table = $spec['table'];
        $insert = $pdo->prepare("INSERT IGNORE INTO `$table` (item_id, item_json, version, position, updated_by) VALUES (?, ?, 1, ?, 'moved from the old list')");
        $position = 0;
        $seen = [];
        foreach ($items as $item) {
            if (!is_array($item) || !isset($item['id']) || !is_scalar($item['id'])) continue;
            $id = trim((string) $item['id']);
            if ($id === '' || strlen($id) > 64 || isset($seen[$id])) continue;
            $seen[$id] = true;
            $insert->execute([$id, json_encode($item), $position++]);
        }
        $tombstone = $pdo->prepare("INSERT IGNORE INTO `$table` (item_id, item_json, version, position, updated_by, deleted_at) VALUES (?, '{}', 1, 0, 'moved from the old list', NOW())");
        foreach ($removedIds as $id) {
            if (!is_scalar($id)) continue;
            $id = trim((string) $id);
            if ($id !== '' && strlen($id) <= 64 && !isset($seen[$id])) $tombstone->execute([$id]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

// After a restore from a backup made before this storage existed: empty the
// rows and fill them again from the restored old list on next use.
function remigrateCollection(PDO $pdo, string $name): void
{
    $spec = collectionSpec($name);
    if (!$spec['tombstones']) return;
    $pdo->prepare('DELETE FROM sync_collections WHERE name = ?')->execute([$name]);
    if (tableExistsHere($pdo, $spec['table'])) $pdo->exec("DELETE FROM `{$spec['table']}`");
}

// Live items in order, their versions by id, and the latest removed ids.
function readCollection(PDO $pdo, array $spec): array
{
    $table = $spec['table'];
    $idColumn = $spec['id'];
    $jsonColumn = $spec['json'];
    $live = $spec['tombstones'] ? 'WHERE deleted_at IS NULL' : '';
    $order = $spec['ordered'] ? 'ORDER BY position, item_id' : 'ORDER BY updated_at DESC';

    $items = [];
    $versions = [];
    foreach ($pdo->query("SELECT `$idColumn` AS id, `$jsonColumn` AS json, version FROM `$table` $live $order")->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $item = json_decode($row['json'], true);
        if (!is_array($item)) continue;
        $items[] = $item;
        $versions[(string) $row['id']] = (int) $row['version'];
    }

    $removedIds = [];
    if ($spec['tombstones']) {
        $removedIds = $pdo->query(
            "SELECT item_id FROM `$table` WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT " . COLLECTION_REMOVED_IDS_SENT
        )->fetchAll(PDO::FETCH_COLUMN);
    }

    return ['items' => $items, 'versions' => (object) $versions, 'removedIds' => array_map('strval', $removedIds)];
}

// Applies one save. $rules:
//   staff      the signed-in staff member (for updated_by)
//   validate   fn(array $item): array|string  the item to store, or why it is refused
//   canCreate  may this screen add items
//   canRemove  may this screen remove items
//   createRefusal / removeRefusal  the message when it may not
// Returns ['versions' => [id => new version], 'items' => [stored items]].
function changeCollection(PDO $pdo, array $spec, array $payload, array $rules): array
{
    if (isset($payload['tables']) || isset($payload['equipment']) || isset($payload['events'])) {
        // A whole list from a screen running the old version of the app.
        throw new CollectionRefusal(409, 'outdated', 'This screen is running an old version. Reload the page, then make the change again.');
    }

    $upserts = $payload['upsert'] ?? [];
    $removals = $payload['remove'] ?? [];
    $confirmed = array_map('strval', array_filter(is_array($payload['confirmRemoval'] ?? null) ? $payload['confirmRemoval'] : [], 'is_scalar'));
    if (!is_array($upserts) || !is_array($removals)) {
        throw new CollectionRefusal(400, 'invalid', 'The changes could not be read.');
    }
    if (count($upserts) + count($removals) > COLLECTION_MAX_CHANGES) {
        throw new CollectionRefusal(400, 'invalid', 'Too many changes in one save.');
    }
    if (!$upserts && !$removals) return ['versions' => (object) [], 'items' => []];

    $idOf = function ($value) {
        if (!is_scalar($value)) return '';
        $id = trim((string) $value);
        return strlen($id) <= 64 ? $id : '';
    };

    // Each change checked on its own first; nothing is read or written yet.
    $wanted = [];
    foreach ($upserts as $change) {
        $item = is_array($change) ? ($change['item'] ?? null) : null;
        $id = is_array($item) ? $idOf($item['id'] ?? null) : '';
        if ($id === '') throw new CollectionRefusal(400, 'invalid', "Each {$spec['label']} needs an id.");
        if (isset($wanted[$id])) throw new CollectionRefusal(400, 'invalid', "The same {$spec['label']} was sent twice.");
        $stored = $rules['validate']($item);
        if (is_string($stored)) throw new CollectionRefusal(400, 'invalid', $stored);
        $json = json_encode($stored);
        if ($json === false || strlen($json) > $spec['maxBytes']) {
            throw new CollectionRefusal(400, 'invalid', "A {$spec['label']} is too large to save.");
        }
        $wanted[$id] = ['item' => $stored, 'json' => $json, 'version' => (int) ($change['version'] ?? 0)];
    }
    $removing = [];
    foreach ($removals as $change) {
        $id = is_array($change) ? $idOf($change['id'] ?? null) : '';
        if ($id === '' || isset($wanted[$id]) || isset($removing[$id])) {
            throw new CollectionRefusal(400, 'invalid', "Each {$spec['label']} to remove needs an id, once.");
        }
        $removing[$id] = (int) ($change['version'] ?? 0);
    }
    if ($removing && !$spec['tombstones']) {
        throw new CollectionRefusal(400, 'invalid', "A {$spec['label']} cannot be removed here.");
    }

    $table = $spec['table'];
    $idColumn = $spec['id'];
    $jsonColumn = $spec['json'];
    $by = mb_substr((string) ($rules['staff']['username'] ?? ''), 0, 80);

    $pdo->beginTransaction();
    try {
        // The whole list is locked while it is checked and changed: lists are small.
        $deleted = $spec['tombstones'] ? 'deleted_at' : 'NULL';
        $rows = [];
        foreach ($pdo->query("SELECT `$idColumn` AS id, `$jsonColumn` AS json, version, $deleted AS deleted_at FROM `$table` FOR UPDATE")->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $rows[(string) $row['id']] = $row;
        }
        $liveCount = count(array_filter($rows, fn($row) => $row['deleted_at'] === null));

        $conflicts = [];
        $creating = [];
        foreach ($wanted as $id => $change) {
            $row = $rows[$id] ?? null;
            if ($change['version'] === 0) {
                // New: the id must be unused, and never one that was removed.
                if ($row) $conflicts[] = $id;
                else $creating[] = $id;
            } elseif (!$row || $row['deleted_at'] !== null || (int) $row['version'] !== $change['version']) {
                $conflicts[] = $id;
            }
        }
        foreach ($removing as $id => $version) {
            $row = $rows[$id] ?? null;
            if (!$row || $row['deleted_at'] !== null || (int) $row['version'] !== $version) $conflicts[] = $id;
        }

        if ($creating && empty($rules['canCreate'])) {
            throw new CollectionRefusal(403, 'not-allowed', $rules['createRefusal'] ?? 'Your account cannot add these.');
        }
        if ($removing && empty($rules['canRemove'])) {
            throw new CollectionRefusal(403, 'not-allowed', $rules['removeRefusal'] ?? 'Your account cannot remove these.');
        }
        if ($conflicts) {
            // As strings: PHP turns numeric ids used as keys into numbers.
            throw new CollectionRefusal(409, 'conflict', 'Someone changed this on another screen first. The latest list was loaded; make the change again if it is still needed.', ['conflicts' => array_map('strval', array_values($conflicts))]);
        }

        // Many removals at once only from an explicit delete on screen.
        $removeCount = count($removing);
        if ($removeCount >= 2 && ($removeCount > COLLECTION_BULK_REMOVAL || $removeCount * 2 > $liveCount)) {
            $unconfirmed = array_diff(array_keys($removing), $confirmed);
            if ($unconfirmed) {
                throw new CollectionRefusal(409, 'confirm-removal', "This save would remove $removeCount of the $liveCount {$spec['label']}s at once, so nothing was changed. Delete them from the list on screen instead.", ['count' => $removeCount]);
            }
        }

        $versions = [];
        $position = 0;
        if ($spec['ordered']) {
            $position = (int) $pdo->query("SELECT COALESCE(MAX(position), -1) + 1 FROM `$table`")->fetchColumn();
        }
        foreach ($wanted as $id => $change) {
            $row = $rows[$id] ?? null;
            if (!$row) {
                if ($spec['ordered']) {
                    $pdo->prepare("INSERT INTO `$table` (item_id, item_json, version, position, updated_by) VALUES (?, ?, 1, ?, ?)")
                        ->execute([$id, $change['json'], $position++, $by]);
                } else {
                    $pdo->prepare("INSERT INTO `$table` (`$idColumn`, `$jsonColumn`, version, updated_by) VALUES (?, ?, 1, ?)")
                        ->execute([$id, $change['json'], $by]);
                }
                $versions[$id] = 1;
                continue;
            }
            // Sent unchanged: nothing to write, and its version stays.
            if (json_encode(json_decode($row['json'], true)) === $change['json']) {
                $versions[$id] = (int) $row['version'];
                continue;
            }
            $pdo->prepare("UPDATE `$table` SET `$jsonColumn` = ?, version = version + 1, updated_by = ? WHERE `$idColumn` = ?")
                ->execute([$change['json'], $by, $id]);
            $versions[$id] = (int) $row['version'] + 1;
        }
        foreach ($removing as $id => $version) {
            $pdo->prepare("UPDATE `$table` SET deleted_at = NOW(), version = version + 1, updated_by = ? WHERE item_id = ?")
                ->execute([$by, $id]);
            $versions[$id] = $version + 1;
        }

        $pdo->commit();
        return ['versions' => (object) $versions, 'items' => array_values(array_map(fn($change) => $change['item'], $wanted))];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
