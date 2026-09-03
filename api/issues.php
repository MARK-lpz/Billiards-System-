<?php
require_once '../config/cors.php';
require_once '../config/database.php';

function readJsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
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
}

$pdo = getDBConnection();
ensureIssuesTable($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query(
        'SELECT id, issue_data, status, created_at AS createdAt, updated_at AS updatedAt
         FROM employee_issues
         ORDER BY created_at DESC
         LIMIT 100'
    );

    $issues = array_map(function ($row) {
        $issue = json_decode($row['issue_data'], true) ?: [];
        return array_merge($issue, [
            'id' => $row['id'],
            'issueStatus' => $row['status'] === 'resolved' ? 'resolved' : 'open',
            'remoteIssue' => true,
            'createdAt' => $row['createdAt'],
            'updatedAt' => $row['updatedAt'],
        ]);
    }, $stmt->fetchAll());

    echo json_encode(['success' => true, 'issues' => $issues]);
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
    $stmt = $pdo->prepare(
        'INSERT INTO employee_issues (id, issue_data, status)
         VALUES (?, ?, "open")
         ON DUPLICATE KEY UPDATE issue_data = VALUES(issue_data), status = "open"'
    );
    $stmt->execute([$id, json_encode($data)]);

    echo json_encode(['success' => true, 'issue' => $data]);
    exit();
}

if ($method === 'PUT') {
    $stmt = $pdo->prepare('UPDATE employee_issues SET status = "resolved" WHERE id = ?');
    $stmt->execute([$id]);
    echo json_encode(['success' => true]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
