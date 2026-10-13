<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/collection.php';

// The equipment list (each item and the table it is dedicated to), shared by the
// admin's Equipment Monitoring and the employees' Actions page. Every staff
// screen reads it; only the admin's changes it, one item at a time (see
// config/collection.php). A deleted item's id stays known, so a screen still
// holding an old copy of the list cannot bring it back.

// The Removed list: each item deleted (and why) or replaced, kept for this many
// months like resolved reports, then removed automatically.
const EQUIPMENT_HISTORY_RETENTION_MONTHS = 3;
const EQUIPMENT_HISTORY_READ_LIMIT = 300;
const EQUIPMENT_HISTORY_PER_SAVE = 100;
const EQUIPMENT_REMOVAL_REASONS = ['Beyond repair', 'Lost', 'Stolen', 'Retired'];

function ensureEquipmentHistory($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS equipment_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            equipment_id VARCHAR(64) NOT NULL,
            equipment_name VARCHAR(150) NOT NULL,
            equipment_type VARCHAR(60) NULL,
            table_id VARCHAR(32) NULL,
            table_name VARCHAR(100) NULL,
            spare TINYINT(1) NOT NULL DEFAULT 0,
            action VARCHAR(20) NOT NULL,
            reason VARCHAR(40) NULL,
            item_condition VARCHAR(20) NULL,
            item_status VARCHAR(20) NULL,
            replaced_by VARCHAR(150) NULL,
            done_by VARCHAR(80) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX equipment_history_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

// Trimmed text cut to the column's length, or null when blank.
function historyText($value, $length) {
    if (!is_scalar($value)) return null;
    $text = trim((string) $value);
    return $text === '' ? null : mb_substr($text, 0, $length);
}

// One entry ready to save, or a message saying what is wrong with it.
function historyRow($entry) {
    if (!is_array($entry)) return 'Each entry must be an object.';
    $action = $entry['action'] ?? '';
    $row = [
        'equipment_id' => historyText($entry['equipmentId'] ?? null, 64),
        'equipment_name' => historyText($entry['name'] ?? null, 150),
        'equipment_type' => historyText($entry['type'] ?? null, 60),
        'table_id' => historyText($entry['tableId'] ?? null, 32),
        'table_name' => historyText($entry['tableName'] ?? null, 100),
        'spare' => empty($entry['spare']) ? 0 : 1,
        'action' => $action,
        'reason' => historyText($entry['reason'] ?? null, 40),
        'item_condition' => historyText($entry['condition'] ?? null, 20),
        'item_status' => historyText($entry['status'] ?? null, 20),
        'replaced_by' => historyText($entry['replacedBy'] ?? null, 150),
        'done_by' => historyText($entry['doneBy'] ?? null, 80),
    ];

    if ($row['equipment_id'] === null || $row['equipment_name'] === null) return 'Each entry needs the item\'s id and name.';
    if ($action === 'deleted' && !in_array($row['reason'], EQUIPMENT_REMOVAL_REASONS, true)) {
        return 'A deleted item needs a reason: ' . implode(', ', EQUIPMENT_REMOVAL_REASONS) . '.';
    }
    if ($action === 'replaced' && $row['replaced_by'] === null) return 'A replaced item needs the name of its replacement.';
    if (!in_array($action, ['deleted', 'replaced'], true)) return 'The action must be "deleted" or "replaced".';
    if ($action === 'replaced') $row['reason'] = null;

    return $row;
}

function historyFromRow(array $row) {
    return [
        'id' => (int) $row['id'],
        'equipmentId' => $row['equipment_id'],
        'name' => $row['equipment_name'],
        'type' => $row['equipment_type'],
        'tableId' => $row['table_id'],
        'tableName' => $row['table_name'],
        'spare' => (bool) $row['spare'],
        'action' => $row['action'],
        'reason' => $row['reason'],
        'condition' => $row['item_condition'],
        'status' => $row['item_status'],
        'replacedBy' => $row['replaced_by'],
        'doneBy' => $row['done_by'],
        'createdAt' => $row['created_at'],
    ];
}

// Every item needs an id and a name; anything else would break the lists.
function cleanEquipmentItem($item) {
    if (!is_array($item) || trim((string) ($item['name'] ?? '')) === '') {
        return 'Each equipment item needs an id and a name.';
    }
    return $item;
}

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
// Staff only: the website never reads equipment, and only the admin changes it.
$staff = requireStaff($pdo, $method === 'GET' ? ['admin', 'employee'] : ['admin']);
$spec = openCollection($pdo, 'equipment');
ensureEquipmentHistory($pdo);

// The Removed list, newest first. Entries past their months go first.
if ($method === 'GET' && isset($_GET['history'])) {
    $pdo->exec(
        'DELETE FROM equipment_history
         WHERE created_at < (NOW() - INTERVAL ' . EQUIPMENT_HISTORY_RETENTION_MONTHS . ' MONTH)'
    );
    $rows = $pdo->query(
        'SELECT * FROM equipment_history ORDER BY created_at DESC, id DESC LIMIT ' . EQUIPMENT_HISTORY_READ_LIMIT
    )->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'history' => array_map('historyFromRow', $rows),
        'retentionMonths' => EQUIPMENT_HISTORY_RETENTION_MONTHS,
    ]);
    exit();
}

// Adds entries to the Removed list: { history: [ { equipmentId, name, action, reason | replacedBy, ... } ] }.
if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $entries = $payload['history'] ?? null;

    if (!is_array($entries) || !$entries || count($entries) > EQUIPMENT_HISTORY_PER_SAVE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Send between 1 and ' . EQUIPMENT_HISTORY_PER_SAVE . ' history entries.']);
        exit();
    }

    $rows = [];
    foreach ($entries as $entry) {
        $row = historyRow($entry);
        if (is_string($row)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $row]);
            exit();
        }
        $rows[] = $row;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO equipment_history
            (equipment_id, equipment_name, equipment_type, table_id, table_name, spare, action, reason,
             item_condition, item_status, replaced_by, done_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $pdo->beginTransaction();
    foreach ($rows as $row) $stmt->execute(array_values($row));
    $pdo->commit();

    echo json_encode(['success' => true, 'saved' => count($rows)]);
    exit();
}

if ($method === 'GET') {
    $list = readCollection($pdo, $spec);
    echo json_encode([
        'success' => true,
        'equipment' => $list['items'],
        'versions' => $list['versions'],
        'removedIds' => $list['removedIds'],
    ]);
    exit();
}

if ($method === 'PUT') {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'The changes could not be read.']);
        exit();
    }

    try {
        $result = changeCollection($pdo, $spec, $payload, [
            'staff' => $staff,
            'validate' => 'cleanEquipmentItem',
            'canCreate' => true,
            'canRemove' => true,
        ]);
    } catch (CollectionRefusal $refusal) {
        sendCollectionRefusal($refusal);
    }

    echo json_encode(['success' => true, 'versions' => $result['versions']]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
