<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/collection.php';

// The pool tables and their live status (who is playing, until when), shared by
// the admin and employee screens and read by the website for availability.
// Saved one table at a time (see config/collection.php); any staff member can
// update a table, only the admin can add or delete one.

function cleanPoolTable($table) {
    if (!is_array($table)) {
        return 'Each table must be an object.';
    }
    if (trim((string) ($table['name'] ?? '')) === '') {
        return 'Each table needs a name.';
    }
    return $table;
}

$pdo = getDBConnection();
$spec = openCollection($pdo, 'tables');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $list = readCollection($pdo, $spec);
    echo json_encode(['success' => true, 'tables' => $list['items'], 'versions' => $list['versions']]);
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
        $result = changeCollection($pdo, $spec, $payload, [
            'staff' => $staff,
            'validate' => 'cleanPoolTable',
            'canCreate' => $staff['role'] === 'admin',
            'canRemove' => $staff['role'] === 'admin',
            'createRefusal' => 'Only the admin can add tables.',
            'removeRefusal' => 'Only the admin can delete tables.',
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
