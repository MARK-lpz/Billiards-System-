<?php
/*
 * Template for config/mail.local.php, the file that holds the real Gmail app
 * password. Copy this file to mail.local.php (same folder) and fill it in
 * there. mail.local.php is in .gitignore, so it never reaches the public
 * repository; keep it that way, and keep the password out of this example.
 *
 * The app password: in the hall's Google account, turn on 2-Step Verification,
 * then go to myaccount.google.com/apppasswords, make one (e.g. "Break & Chill"),
 * and copy the 16 letters here. It is not the Gmail password itself, and it can
 * be deleted there at any time to stop the system sending.
 *
 * On the hosting, upload mail.local.php by hand (File Manager / FTP): it does
 * not travel with git.
 */
return [
    // The Gmail address the reset codes come from. Leave empty to switch email off.
    'gmail' => '',
    // The 16-letter app password (spaces are fine). Leave empty to switch email off.
    'app_password' => '',
    // Optional: the name shown beside the address in the inbox.
    'from_name' => 'Break & Chill Billiard Hall',
    // Optional: only if the hosting blocks port 587. Use these two together.
    // 'smtp_port' => 465,
    // 'smtp_secure' => 'ssl',
];
