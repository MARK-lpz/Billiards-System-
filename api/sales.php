<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/ledger.php';

// Every sale made in Sales / POS and at a table's checkout, on every device:
// what the Sales Report and each counter's history read. Staff read and add
// sales; a sale is never changed once made (see config/ledger.php).

function cleanSale($sale) {
    if (!is_array($sale)) return 'Each sale must be an object.';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($sale['date'] ?? ''))) return 'Each sale needs its date.';
    if (!is_numeric($sale['total'] ?? null)) return 'Each sale needs its total.';
    if (!is_array($sale['items'] ?? null)) return 'Each sale needs its items.';
    return $sale;
}

$pdo = getDBConnection();
serveLedger($pdo, 'sales', ['read' => ['admin', 'employee'], 'validate' => 'cleanSale']);
