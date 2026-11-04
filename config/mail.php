<?php
/*
 * Email settings for the password reset code: sent from the hall's Gmail
 * account with PHPMailer (lib/PHPMailer), through Gmail's own mail server.
 *
 * NEVER put the Gmail app password in this file: it is committed and the
 * repository is public. It goes in config/mail.local.php instead, which git
 * ignores: copy mail.local.example.php to mail.local.php on each computer and
 * on the hosting, and fill it in there (or set the MAIL_USERNAME and
 * MAIL_PASSWORD environment variables).
 *
 * While either is empty, codes by email are switched off. With both in place,
 * "Email" appears on the login screen's Reset Password. No other change is needed.
 */
$mailLocalFile = __DIR__ . '/mail.local.php';
$mailLocal = is_file($mailLocalFile) ? require $mailLocalFile : [];
if (!is_array($mailLocal)) {
    $mailLocal = [];
}

// The Gmail address the codes come from.
define('MAIL_USERNAME', getenv('MAIL_USERNAME') ?: trim((string) ($mailLocal['gmail'] ?? '')));
// A Gmail app password (16 letters, shown with spaces), not the account's own password.
define('MAIL_PASSWORD', getenv('MAIL_PASSWORD') ?: str_replace(' ', '', (string) ($mailLocal['app_password'] ?? '')));
// The name shown beside the address in the inbox.
define('MAIL_FROM_NAME', getenv('MAIL_FROM_NAME') ?: (trim((string) ($mailLocal['from_name'] ?? '')) ?: 'Break & Chill Billiard Hall'));

// Gmail's mail server. The host is only changed for testing against a local
// stand-in. The port can be set in mail.local.php too, for a hosting that
// blocks 587. MAIL_SMTP_SECURE: "tls" (port 587), "ssl" (port 465) or "none"
// (a local test server only).
define('MAIL_SMTP_HOST', getenv('MAIL_SMTP_HOST') ?: 'smtp.gmail.com');
define('MAIL_SMTP_PORT', (int) (getenv('MAIL_SMTP_PORT') ?: ($mailLocal['smtp_port'] ?? 587)));
define('MAIL_SMTP_SECURE', getenv('MAIL_SMTP_SECURE') ?: ($mailLocal['smtp_secure'] ?? 'tls'));
unset($mailLocalFile, $mailLocal);

function mailIsConfigured(): bool
{
    return MAIL_USERNAME !== '' && MAIL_PASSWORD !== '';
}

/**
 * An email address in lower case for comparing, or '' when it is not one.
 */
function normalizeEmail(string $value): string
{
    $email = strtolower(trim($value));
    return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '';
}

/**
 * Sends one email, as plain text and, when given, as HTML too. Returns true
 * only when the mail server accepted it.
 */
function sendMail(string $to, string $subject, string $text, string $html = ''): bool
{
    if (!mailIsConfigured()) {
        return false;
    }

    require_once __DIR__ . '/../lib/PHPMailer/Exception.php';
    require_once __DIR__ . '/../lib/PHPMailer/PHPMailer.php';
    require_once __DIR__ . '/../lib/PHPMailer/SMTP.php';

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = MAIL_SMTP_HOST;
        $mail->Port = MAIL_SMTP_PORT;
        $mail->SMTPAuth = true;
        $mail->Username = MAIL_USERNAME;
        $mail->Password = MAIL_PASSWORD;
        if (MAIL_SMTP_SECURE === 'none') {
            $mail->SMTPSecure = '';
            $mail->SMTPAutoTLS = false;
        } else {
            $mail->SMTPSecure = MAIL_SMTP_SECURE === 'ssl'
                ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
                : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        }
        $mail->Timeout = 15;
        $mail->CharSet = 'UTF-8';

        // Gmail sends only as the account that signed in.
        $mail->setFrom(MAIL_USERNAME, MAIL_FROM_NAME);
        $mail->addAddress($to);
        $mail->Subject = $subject;
        if ($html !== '') {
            $mail->isHTML(true);
            $mail->Body = $html;
            $mail->AltBody = $text;
        } else {
            $mail->Body = $text;
        }

        $mail->send();
        return true;
    } catch (Throwable $error) {
        // PHPMailer's reason (never the password), for the hosting's error log.
        error_log('Email could not be sent: ' . ($mail->ErrorInfo ?: $error->getMessage()));
        return false;
    }
}
