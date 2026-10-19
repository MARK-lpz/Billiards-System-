<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/ledger.php';

// Table bills: a finished table session waiting to be paid in Sales / POS, and
// the ones already paid, on every device, so a session ended at one counter
// can be paid at another. A bill changes when it is paid, one version at a time
// (see config/ledger.php), so two counters cannot both take the same bill.

function cleanTableCharge($charge) {
    if (!is_array($charge)) return 'Each table bill must be an object.';
    if (!in_array($charge['status'] ?? '', ['unpaid', 'paid'], true)) return 'A table bill is either unpaid or paid.';
    if (trim((string) (is_scalar($charge['tableName'] ?? null) ? $charge['tableName'] : '')) === '') return 'Each table bill needs its table.';
    return $charge;
}

$pdo = getDBConnection();
serveLedger($pdo, 'charges', ['read' => ['admin', 'employee'], 'validate' => 'cleanTableCharge']);
