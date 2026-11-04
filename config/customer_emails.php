<?php
/*
 * Emails to customers about their website booking or tournament sign-up, from
 * the hall's Gmail (config/mail.php), beside the texts (config/customer_texts.php):
 * the same moments and the same words, for a customer who gave an email on the
 * form. The email is optional, so the text stays the way every customer hears.
 *
 *   received   when the website sends a booking or a sign-up (api/customer_messages.php)
 *   decided    a booking approved, turned down or cancelled (textReservationDecision);
 *              an entry fee confirmed or turned down, or the tournament called
 *              off (textTournamentDecision)
 *   sent back  a GCash payment sent back (textRefundSent)
 *
 * A booking's email is kept on the booking; a paid sign-up's on its payment.
 *
 * Each email is kept in customer_emails, like the texts: once per moment,
 * booking and address. While Gmail is not set up, or a cap is reached, it is
 * kept as "queued" and nothing is sent. Callers wrap it in textSafely().
 */
require_once __DIR__ . '/mail.php';

// Caps, so a script hammering an endpoint cannot flood someone's inbox or use
// up the Gmail account's daily sending. Emails over the cap are still kept.
const EMAILS_PER_ADDRESS_PER_DAY = 5;
const EMAILS_PER_HOUR_TOTAL = 60;

const CUSTOMER_EMAIL_SUBJECTS = [
    'reservation' => 'We received your reservation',
    'reservation-approved' => 'Your reservation is approved',
    'reservation-rejected' => 'Your reservation was not approved',
    'reservation-cancelled' => 'Your reservation was cancelled',
    'refund-sent' => 'Your GCash payment was sent back',
    'tournament' => 'We received your registration',
    'tournament-accepted' => 'Your tournament entry is confirmed',
    'tournament-rejected' => 'Your tournament entry was not confirmed',
    'tournament-removed' => 'Your tournament entry was not confirmed',
    'tournament-cancelled' => 'The tournament is cancelled',
];

function ensureCustomerEmailsTable(PDO $pdo): void
{
    static $ready = false;
    if ($ready) return;
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS customer_emails (
            id VARCHAR(80) NOT NULL PRIMARY KEY,
            email VARCHAR(160) NOT NULL,
            customer_name VARCHAR(160) NULL,
            context VARCHAR(40) NOT NULL,
            reference_id VARCHAR(80) NULL,
            subject VARCHAR(200) NOT NULL,
            message VARCHAR(1000) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'queued',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sent_at DATETIME NULL,
            INDEX customer_emails_status (status, created_at),
            INDEX customer_emails_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $ready = true;
}

// The email's HTML: the hall's name, what happened, then the message itself.
// Inline styles only, as mail apps ignore style sheets.
function customerEmailHtml(string $heading, string $text): string
{
    $heading = htmlspecialchars($heading, ENT_QUOTES, 'UTF-8');
    $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    return <<<HTML
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
  <h2 style="margin:0 0 4px;font-size:20px;color:#001233">Break &amp; Chill Billiard Hall</h2>
  <p style="margin:0 0 20px;color:#6b7280;font-size:14px">{$heading}</p>
  <p style="margin:0 0 20px;padding:14px;border-radius:10px;background:#f3f4f6;font-size:15px;line-height:1.5">{$text}</p>
  <p style="font-size:13px;color:#6b7280">You get this email because you added it to your booking or registration on the Break &amp; Chill website. We text the same updates to your mobile number.</p>
</div>
HTML;
}

/**
 * Emails one update about a booking (when Gmail is set up and under the caps)
 * and keeps it. `text` is the customer's text message, worded for an email
 * here. Once per context, reference and address: asking again returns the
 * first one. Returns { id, status }, or null when there is no valid address.
 */
function queueCustomerEmail(PDO $pdo, string $email, string $customerName, string $context, string $referenceId, string $text): ?array
{
    $email = normalizeEmail($email);
    if ($email === '' || !isset(CUSTOMER_EMAIL_SUBJECTS[$context])) return null;
    ensureCustomerEmailsTable($pdo);

    $existing = $pdo->prepare('SELECT id, status FROM customer_emails WHERE context = ? AND reference_id = ? AND email = ? LIMIT 1');
    $existing->execute([$context, $referenceId, $email]);
    if ($previous = $existing->fetch(PDO::FETCH_ASSOC)) {
        return ['id' => $previous['id'], 'status' => $previous['status']];
    }

    $heading = CUSTOMER_EMAIL_SUBJECTS[$context];
    $subject = "Break & Chill: $heading";
    $text = str_replace('show this text', 'show this email', $text);

    $status = 'queued';
    if (mailIsConfigured()) {
        $limits = $pdo->prepare(
            "SELECT
                SUM(email = ? AND created_at > NOW() - INTERVAL 1 DAY) AS forAddress,
                SUM(created_at > NOW() - INTERVAL 1 HOUR) AS lastHour
             FROM customer_emails
             WHERE status = 'sent' AND created_at > NOW() - INTERVAL 1 DAY"
        );
        $limits->execute([$email]);
        $counts = $limits->fetch(PDO::FETCH_ASSOC);
        if ((int) $counts['forAddress'] < EMAILS_PER_ADDRESS_PER_DAY && (int) $counts['lastHour'] < EMAILS_PER_HOUR_TOTAL) {
            $status = sendMail($email, $subject, $text, customerEmailHtml($heading, $text)) ? 'sent' : 'failed';
        }
    }

    $id = uniqid('mail-', true);
    $pdo->prepare(
        'INSERT INTO customer_emails (id, email, customer_name, context, reference_id, subject, message, status, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(? = "sent", NOW(), NULL))'
    )->execute([$id, $email, $customerName, $context, $referenceId, $subject, $text, $status, $status]);

    return ['id' => $id, 'status' => $status];
}

// The email a website booking was made with, or '' (desk bookings have none to use).
function reservationEmail(PDO $pdo, string $reservationId): string
{
    $stmt = $pdo->prepare("SELECT email FROM reservations WHERE id = ? AND source = 'online' LIMIT 1");
    $stmt->execute([$reservationId]);
    return (string) ($stmt->fetchColumn() ?: '');
}
