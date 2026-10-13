<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';

// Resolved reports are history for this long, then deleted; open ones are kept until resolved.
const RESOLVED_ISSUE_RETENTION_MONTHS = 3;
// How many resolved reports the shared feed carries (the open ones always all come back).
const RESOLVED_ISSUES_PER_READ = 200;
// Report History pages.
const HISTORY_PAGE_SIZE_DEFAULT = 15;
const HISTORY_PAGE_SIZE_MAX = 50;

function readJsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function hasColumn($pdo, $column) {
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_issues' AND COLUMN_NAME = ?"
    );
    $stmt->execute([$column]);
    return (int) $stmt->fetchColumn() > 0;
}

function hasIndex($pdo, $index) {
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_issues' AND INDEX_NAME = ?"
    );
    $stmt->execute([$index]);
    return (int) $stmt->fetchColumn() > 0;
}

// The fields Report History filters and sorts on, kept as columns beside the
// report itself (issue_data), so they can be searched without opening every report.
function issueColumns(array $data) {
    $issue = is_array($data['issue'] ?? null) ? $data['issue'] : [];
    $text = function ($value, $length) {
        $value = trim((string) ($value ?? ''));
        return $value === '' ? null : mb_substr($value, 0, $length);
    };
    return [
        'issue_type' => $text($issue['type'] ?? $data['issueType'] ?? $data['action'] ?? null, 80),
        'table_id' => $text($issue['tableId'] ?? $data['issueTableId'] ?? null, 40),
        'table_name' => $text($issue['table'] ?? $data['issueTable'] ?? null, 80),
        'equipment_id' => $text($issue['equipmentId'] ?? $data['issueEquipmentId'] ?? null, 80),
        'equipment_name' => $text($issue['equipmentName'] ?? $data['issueEquipmentName'] ?? null, 120),
        'reported_by' => $text($data['staff'] ?? null, 80),
    ];
}

function ensureIssuesTable($pdo) {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS employee_issues (
            id VARCHAR(80) NOT NULL PRIMARY KEY,
            issue_data TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX employee_issues_status_updated (status, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    // Tables made before these columns existed get them now.
    $columns = [
        'resolved_at' => 'DATETIME NULL',
        'resolved_by' => 'VARCHAR(80) NULL',
        'issue_type' => 'VARCHAR(80) NULL',
        'table_id' => 'VARCHAR(40) NULL',
        'table_name' => 'VARCHAR(80) NULL',
        'equipment_id' => 'VARCHAR(80) NULL',
        'equipment_name' => 'VARCHAR(120) NULL',
        'reported_by' => 'VARCHAR(80) NULL',
    ];
    $added = false;
    foreach ($columns as $column => $definition) {
        if (!hasColumn($pdo, $column)) {
            $pdo->exec("ALTER TABLE employee_issues ADD COLUMN $column $definition");
            $added = true;
        }
    }
    if (!hasIndex($pdo, 'employee_issues_history')) {
        $pdo->exec('CREATE INDEX employee_issues_history ON employee_issues (status, resolved_at)');
    }
    if (!hasIndex($pdo, 'employee_issues_table')) {
        $pdo->exec('CREATE INDEX employee_issues_table ON employee_issues (table_id)');
    }

    // Reports saved before the columns existed: fill them in from the report itself.
    if ($added) {
        $rows = $pdo->query('SELECT id, issue_data FROM employee_issues WHERE issue_type IS NULL')->fetchAll();
        $update = $pdo->prepare(
            'UPDATE employee_issues SET issue_type = ?, table_id = ?, table_name = ?, equipment_id = ?,
                    equipment_name = ?, reported_by = ?, updated_at = updated_at
             WHERE id = ?'
        );
        foreach ($rows as $row) {
            $fields = issueColumns(json_decode($row['issue_data'], true) ?: []);
            $update->execute(array_merge(array_values($fields), [$row['id']]));
        }
    }
}

// Deletes resolved reports older than the retention period. A report resolved
// before resolved_at existed counts from its last update (when it was resolved).
function deleteExpiredIssues($pdo) {
    $pdo->exec(
        "DELETE FROM employee_issues
         WHERE status = 'resolved'
           AND COALESCE(resolved_at, updated_at) < (NOW() - INTERVAL " . RESOLVED_ISSUE_RETENTION_MONTHS . " MONTH)"
    );
}

const ISSUE_SELECT = 'id, issue_data, status, created_at AS createdAt, updated_at AS updatedAt,
                      COALESCE(resolved_at, updated_at) AS resolvedAt, resolved_by AS resolvedBy';

// One stored row as the app reads it: the report as sent, plus where it stands.
function issueFromRow(array $row) {
    $issue = json_decode($row['issue_data'], true) ?: [];
    $isResolved = $row['status'] === 'resolved';
    $fields = [
        'id' => $row['id'],
        'issueStatus' => $isResolved ? 'resolved' : 'open',
        'remoteIssue' => true,
        'createdAt' => $row['createdAt'],
        'updatedAt' => $row['updatedAt'],
    ];
    if ($isResolved) {
        $fields['resolvedAt'] = $row['resolvedAt'];
        if (!empty($row['resolvedBy'])) {
            $fields['resolvedBy'] = $row['resolvedBy'];
        }
    } else {
        unset($issue['resolvedAt'], $issue['resolvedBy']);
    }
    return array_merge($issue, $fields);
}

$pdo = getDBConnection();
ensureIssuesTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];
// Staff only: the website never reads or sends reports.
requireStaff($pdo);

if ($method === 'GET') {
    deleteExpiredIssues($pdo);
    $status = trim((string) ($_GET['status'] ?? ''));

    // Report History: one page of resolved reports, latest resolved first,
    // optionally for one table or one kind of report.
    if ($status === 'resolved') {
        $perPage = (int) ($_GET['perPage'] ?? HISTORY_PAGE_SIZE_DEFAULT);
        $perPage = max(5, min(HISTORY_PAGE_SIZE_MAX, $perPage ?: HISTORY_PAGE_SIZE_DEFAULT));
        $page = max(1, (int) ($_GET['page'] ?? 1));

        $where = ["status = 'resolved'"];
        $params = [];
        $tableId = trim((string) ($_GET['tableId'] ?? ''));
        if ($tableId !== '') {
            $where[] = 'table_id = ?';
            $params[] = $tableId;
        }
        $type = trim((string) ($_GET['type'] ?? ''));
        if ($type !== '') {
            $where[] = 'issue_type = ?';
            $params[] = $type;
        }
        $whereSql = implode(' AND ', $where);

        $count = $pdo->prepare("SELECT COUNT(*) FROM employee_issues WHERE $whereSql");
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $pageCount = max(1, (int) ceil($total / $perPage));
        $page = min($page, $pageCount);

        $rows = $pdo->prepare(
            'SELECT ' . ISSUE_SELECT . " FROM employee_issues WHERE $whereSql
             ORDER BY COALESCE(resolved_at, updated_at) DESC, id DESC
             LIMIT $perPage OFFSET " . (($page - 1) * $perPage)
        );
        $rows->execute($params);

        // How many reports each group holds across every page: the last 7 days,
        // then each month before that.
        $groups = $pdo->prepare(
            "SELECT
                CASE WHEN COALESCE(resolved_at, updated_at) >= (NOW() - INTERVAL 7 DAY) THEN 'week'
                     ELSE DATE_FORMAT(COALESCE(resolved_at, updated_at), '%Y-%m') END AS groupKey,
                COUNT(*) AS total
             FROM employee_issues WHERE $whereSql
             GROUP BY groupKey"
        );
        $groups->execute($params);
        $groupCounts = [];
        foreach ($groups->fetchAll() as $group) {
            $groupCounts[$group['groupKey']] = (int) $group['total'];
        }

        // What the filters can offer: every kind of report and table in the history.
        $types = $pdo->query(
            "SELECT DISTINCT issue_type FROM employee_issues
             WHERE status = 'resolved' AND issue_type IS NOT NULL ORDER BY issue_type"
        )->fetchAll(PDO::FETCH_COLUMN);

        echo json_encode([
            'success' => true,
            'issues' => array_map('issueFromRow', $rows->fetchAll()),
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'pageCount' => $pageCount,
            'groupCounts' => (object) $groupCounts,
            'types' => $types,
            'serverTime' => $pdo->query('SELECT NOW()')->fetchColumn(),
            'resolvedRetentionMonths' => RESOLVED_ISSUE_RETENTION_MONTHS,
        ]);
        exit();
    }

    // The shared feed: every open report, however old, so none is pushed out by
    // newer resolved ones; then the latest resolved ones.
    $open = $pdo->query(
        'SELECT ' . ISSUE_SELECT . " FROM employee_issues WHERE status <> 'resolved' ORDER BY created_at DESC"
    )->fetchAll();
    $resolved = $status === 'open' ? [] : $pdo->query(
        'SELECT ' . ISSUE_SELECT . " FROM employee_issues WHERE status = 'resolved'
         ORDER BY COALESCE(resolved_at, updated_at) DESC LIMIT " . RESOLVED_ISSUES_PER_READ
    )->fetchAll();

    $rows = array_merge($open, $resolved);
    usort($rows, fn($first, $second) => strcmp($second['createdAt'], $first['createdAt']));

    echo json_encode([
        'success' => true,
        'issues' => array_map('issueFromRow', $rows),
        'resolvedRetentionMonths' => RESOLVED_ISSUE_RETENTION_MONTHS,
    ]);
    exit();
}

$data = readJsonBody();
$id = trim((string) ($data['id'] ?? ''));

if ($id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'An issue id is required']);
    exit();
}

if ($method === 'POST') {
    $action = trim((string) ($data['action'] ?? ''));
    if ($action === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Issue details are required']);
        exit();
    }

    $data['issueStatus'] = 'open';
    $fields = issueColumns($data);
    $stmt = $pdo->prepare(
        'INSERT INTO employee_issues
            (id, issue_data, status, issue_type, table_id, table_name, equipment_id, equipment_name, reported_by)
         VALUES (?, ?, "open", ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE issue_data = VALUES(issue_data), status = "open", resolved_at = NULL,
            resolved_by = NULL, issue_type = VALUES(issue_type), table_id = VALUES(table_id),
            table_name = VALUES(table_name), equipment_id = VALUES(equipment_id),
            equipment_name = VALUES(equipment_name), reported_by = VALUES(reported_by)'
    );
    $stmt->execute(array_merge([$id, json_encode($data)], array_values($fields)));

    echo json_encode(['success' => true, 'issue' => $data]);
    exit();
}

if ($method === 'PUT') {
    $resolvedBy = mb_substr(trim((string) ($data['resolvedBy'] ?? '')), 0, 80);
    $stmt = $pdo->prepare(
        'UPDATE employee_issues
         SET status = "resolved", resolved_at = COALESCE(resolved_at, NOW()),
             resolved_by = COALESCE(resolved_by, NULLIF(?, ""))
         WHERE id = ?'
    );
    $stmt->execute([$resolvedBy, $id]);
    echo json_encode(['success' => true]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
