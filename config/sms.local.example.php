<?php
/*
 * Template for config/sms.local.php, the file that holds the real Semaphore
 * key. Copy this file to sms.local.php (same folder) and fill it in there.
 * sms.local.php is in .gitignore, so it never reaches the public repository;
 * keep it that way, and keep the key out of this example.
 *
 * On the hosting, upload sms.local.php by hand (File Manager / FTP): it does
 * not travel with git.
 */
return [
    // From semaphore.co → Account → API. Leave empty to switch SMS off.
    'api_key' => '',
    // Optional: a sender name approved in your Semaphore account.
    'sender_name' => '',
];
