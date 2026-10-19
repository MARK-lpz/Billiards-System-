<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/collection.php';

// The inventory: each product, its price and its stock, shared by every staff
// screen (see config/collection.php). Only the admin adds, edits or deletes a
// product; a sale or a table's order at any counter changes only its stock.
// The website never reads it.

function cleanProduct($product) {
    if (!is_array($product)) return 'Each product must be an object.';
    if (trim((string) (is_scalar($product['name'] ?? null) ? $product['name'] : '')) === '') return 'Each product needs a name.';
    foreach (['price', 'stock'] as $field) {
        if (array_key_exists($field, $product) && (!is_numeric($product[$field]) || $product[$field] < 0)) {
            return "A product's $field must be a number, not below zero.";
        }
    }
    return $product;
}

// True when the only change to a stored product is its stock.
function onlyStockChanged(array $stored, array $item): bool {
    unset($stored['stock'], $item['stock']);
    return $stored == $item;
}

$pdo = getDBConnection();
$spec = openCollection($pdo, 'products');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requireStaff($pdo);
    $list = readCollection($pdo, $spec);
    // `fresh`: no product was ever saved here, so a screen that cannot add them
    // keeps its own list rather than taking the empty one.
    echo json_encode([
        'success' => true,
        'products' => $list['items'],
        'versions' => $list['versions'],
        'fresh' => !$list['items'] && !$list['removedIds'],
    ]);
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

    // An employee's screen sends a product only for its stock. Checked against
    // the version it read: if that is no longer the stored one, the save is a
    // conflict below anyway.
    if ($staff['role'] !== 'admin' && is_array($payload['upsert'] ?? null)) {
        $read = $pdo->prepare('SELECT item_json, version FROM inventory_items WHERE item_id = ? AND deleted_at IS NULL');
        foreach ($payload['upsert'] as $change) {
            $item = is_array($change) ? ($change['item'] ?? null) : null;
            if (!is_array($item) || !is_scalar($item['id'] ?? null)) continue;
            $read->execute([trim((string) $item['id'])]);
            $row = $read->fetch(PDO::FETCH_ASSOC);
            if (!$row || (int) $row['version'] !== (int) ($change['version'] ?? 0)) continue;
            $stored = json_decode($row['item_json'], true);
            if (is_array($stored) && !onlyStockChanged($stored, $item)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'code' => 'not-allowed', 'message' => "Only the admin can change a product's details."]);
                exit();
            }
        }
    }

    try {
        $result = changeCollection($pdo, $spec, $payload, [
            'staff' => $staff,
            'validate' => 'cleanProduct',
            'canCreate' => $staff['role'] === 'admin',
            'canRemove' => $staff['role'] === 'admin',
            'createRefusal' => 'Only the admin can add products.',
            'removeRefusal' => 'Only the admin can delete products.',
        ]);
    } catch (CollectionRefusal $refusal) {
        sendCollectionRefusal($refusal);
    }

    echo json_encode(['success' => true, 'versions' => $result['versions']]);
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
