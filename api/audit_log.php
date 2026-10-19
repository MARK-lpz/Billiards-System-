<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/ledger.php';

// The Audit Trail: what each staff member did, on every device. Every staff
// member's screen adds its entries; only the admin reads them. An entry changes
// only when a problem it mentions is marked resolved, one version at a time
// (see config/ledger.php). Reported issues are not here: api/issues.php keeps
// them.

function cleanAuditEntry($entry) {
    if (!is_array($entry)) return 'Each entry must be an object.';
    $said = trim((string) (is_scalar($entry['action'] ?? null) ? $entry['action'] : '') . (is_scalar($entry['detail'] ?? null) ? $entry['detail'] : ''));
    if ($said === '') return 'Each entry needs what was done.';
    return $entry;
}

$pdo = getDBConnection();
serveLedger($pdo, 'audit', ['read' => ['admin'], 'validate' => 'cleanAuditEntry']);
