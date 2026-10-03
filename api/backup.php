<?php
require_once '../config/cors.php';
require_once '../config/database.php';

/*
 * Whole-system backup and restore for the shared (server) data.
 *
 * Only these tables are ever read or written. Table names are never taken from
 * the uploaded file, so a crafted backup cannot reach any other table.
 *
 * Deliberately left out: `users` and `password_reset_log`. A backup is a file
 * the admin downloads and keeps, and it must never carry employee password
 * hashes. Restoring also never touches who can log in.
 */
const BACKUP_TABLES = [
    'reservations',
    'reservation_settings',
    'pool_table_status',
    'tournament_events',
    'employee_issues',
    'notifications',
    'customer_messages',
];

const BACKUP_FORMAT = 'break-and-chill-backup';
const BACKUP_VERSION = 1;

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Method not allowed.']);
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    respond(400, ['success' => false, 'message' => 'The request could not be read.']);
}

$action = $data['action'] ?? '';
$username = trim((string) ($data['username'] ?? ''));
$password = (string) ($data['password'] ?? '');

if ($username === '' || $password === '') {
    respond(400, ['success' => false, 'message' => 'Enter your admin password to continue.']);
}

$pdo = getDBConnection();

// Every endpoint here is otherwise open, and a restore replaces the whole
// database, so both actions need the admin to prove who they are right now.
$check = $pdo->prepare("SELECT id FROM users WHERE username = ? AND password = MD5(?) AND LOWER(role) = 'admin'");
$check->execute([$username, $password]);
if (!$check->fetch()) {
    respond(403, ['success' => false, 'message' => 'That admin password is not correct.']);
}

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
    $stmt->execute([$table]);
    return (int) $stmt->fetchColumn() > 0;
}

function tableColumns(PDO $pdo, string $table): array
{
    $stmt = $pdo->prepare('SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position');
    $stmt->execute([$table]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

if ($action === 'export') {
    $tables = [];
    foreach (BACKUP_TABLES as $table) {
        // A table that was never created yet simply has nothing to back up.
        $tables[$table] = tableExists($pdo, $table)
            ? $pdo->query("SELECT * FROM `$table`")->fetchAll()
            : [];
    }

    respond(200, [
        'success' => true,
        'server' => [
            'format' => BACKUP_FORMAT,
            'version' => BACKUP_VERSION,
            'tables' => $tables,
        ],
    ]);
}

if ($action === 'restore') {
    $server = $data['server'] ?? null;
    if (!is_array($server) || ($server['format'] ?? '') !== BACKUP_FORMAT || !is_array($server['tables'] ?? null)) {
        respond(400, ['success' => false, 'message' => 'This is not a Break & Chill backup file.']);
    }
    if ((int) ($server['version'] ?? 0) > BACKUP_VERSION) {
        respond(400, ['success' => false, 'message' => 'This backup was made by a newer version of the system.']);
    }

    $restored = [];
    $skipped = [];

    try {
        $pdo->beginTransaction();

        foreach (BACKUP_TABLES as $table) {
            if (!array_key_exists($table, $server['tables'])) {
                $skipped[] = $table;
                continue;
            }
            if (!tableExists($pdo, $table)) {
                $skipped[] = $table;
                continue;
            }

            $rows = $server['tables'][$table];
            if (!is_array($rows)) {
                throw new RuntimeException("The $table section of the backup is damaged.");
            }

            // Only columns that exist today are written, so a backup taken
            // before a column was added still restores cleanly.
            $columns = tableColumns($pdo, $table);

            // DELETE rather than TRUNCATE: TRUNCATE commits implicitly in
            // MySQL and would make the rollback below impossible.
            $pdo->exec("DELETE FROM `$table`");

            foreach ($rows as $row) {
                if (!is_array($row)) {
                    throw new RuntimeException("The $table section of the backup is damaged.");
                }

                $usable = array_values(array_intersect($columns, array_keys($row)));
                if (!$usable) {
                    continue;
                }

                $values = array_map(
                    fn($column) => is_array($row[$column]) ? json_encode($row[$column]) : $row[$column],
                    $usable
                );
                $columnList = implode(', ', array_map(fn($column) => "`$column`", $usable));
                $placeholders = implode(', ', array_fill(0, count($usable), '?'));

                $insert = $pdo->prepare("INSERT INTO `$table` ($columnList) VALUES ($placeholders)");
                $insert->execute($values);
            }

            $restored[$table] = count($rows);
        }

        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        // Nothing was changed, so the system is exactly as it was before.
        respond(500, [
            'success' => false,
            'message' => 'Restore failed and nothing was changed. ' . $error->getMessage(),
        ]);
    }

    respond(200, ['success' => true, 'restored' => $restored, 'skipped' => $skipped]);
}

respond(400, ['success' => false, 'message' => 'Unknown backup action.']);
