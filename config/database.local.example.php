<?php
/*
 * Template for config/database.local.php, the file that holds the real
 * database login. Copy this file to database.local.php (same folder) and fill
 * it in there. database.local.php is in .gitignore, so it never reaches the
 * public repository; keep it that way, and keep real values out of this example.
 *
 * On the hosting, upload database.local.php by hand (File Manager / FTP) with
 * the hosting's MySQL details: it does not travel with git.
 *
 * Without database.local.php (and without the DB_HOST, DB_NAME, DB_USER and
 * DB_PASS environment variables), config/database.php uses Laragon's defaults:
 * localhost, billiards_system, root, no password.
 */
return [
    'host' => 'localhost',
    'name' => 'billiards_system',
    'user' => 'root',
    // Laragon's root has no password. On the hosting, the one from its MySQL Databases page.
    'pass' => '',
];
