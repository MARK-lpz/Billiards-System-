<?php
/*
 * Texts to customers (by SMS, see config/sms.php), each kept in
 * customer_messages: what went to which number, and whether it went out.
 *
 * Every text is built from records that are really in the database, never
 * taken from a request: otherwise anyone could send any text to any number,
 * billed to the owner and signed "Break & Chill".
 *
 *   received   when the website sends a booking or a tournament sign-up
 *              (api/customer_messages.php)
 *   decided    when staff approve, turn down or cancel a website booking,
 *              confirm or turn down a tournament entry fee, or the admin
 *              cancels the tournament (textReservationDecision,
 *              textTournamentDecision)
 *   sent back  when staff send a GCash payment back (textRefundSent)
 *
 * While SMS is not set up, or a cap is reached, the text is kept as "queued"
 * and nothing is sent. A text never stops what it is about: callers wrap it
 * in textSafely().
 */
require_once __DIR__ . '/sms.php';

// Caps on real texts, so a script hammering an endpoint cannot run up the SMS
// bill or flood someone's phone. Texts over the cap are still kept.
const TEXTS_PER_NUMBER_PER_DAY = 5;
const TEXTS_PER_HOUR_TOTAL = 100;

function ensureCustomerMessagesTable(PDO $pdo): void
{
    static $ready = false;
    if ($ready) return;
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS customer_messages (
            id VARCHAR(80) NOT NULL PRIMARY KEY,
            phone VARCHAR(20) NOT NULL,
            customer_name VARCHAR(160) NULL,
            context VARCHAR(40) NOT NULL,
            reference_id VARCHAR(80) NULL,
            message VARCHAR(1000) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'queued',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sent_at DATETIME NULL,
            INDEX customer_messages_status (status, created_at),
            INDEX customer_messages_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $ready = true;
}

// Letters, spaces, ' and - only: a name can never carry a link, a domain or a
// phone number into a text that goes out under the Break & Chill name.
function safeName(string $name): string
{
    $clean = trim(preg_replace('/\s+/u', ' ', preg_replace("/[^\\p{L}\\s'-]/u", '', $name)));
    return $clean === '' ? 'there' : mb_substr($clean, 0, 40);
}

function paymentLine(float $amount, string $reference): string
{
    if ($amount <= 0) {
        return 'No entry fee.';
    }
    $digits = preg_replace('/\D/', '', $reference);
    $ref = strlen($digits) >= 10 && strlen($digits) <= 15 ? ", ref $digits" : '';
    return 'GCash PHP ' . number_format($amount, 2) . " paid$ref.";
}

function prettyDate(string $date): string
{
    $time = strtotime($date);
    return $time ? date('M j, Y', $time) : $date;
}

function prettyTime(string $clock): string
{
    $time = strtotime("2000-01-01 $clock");
    return $time ? date('g:i A', $time) : $clock;
}

function textPeso(float $amount): string
{
    return 'PHP ' . number_format($amount, 2);
}

// 09181112222 as 0918 111 2222.
function textNumber(string $number): string
{
    $digits = preg_replace('/\D/', '', $number);
    return strlen($digits) === 11 ? substr($digits, 0, 4) . ' ' . substr($digits, 4, 3) . ' ' . substr($digits, 7) : $digits;
}

/**
 * Sends one text (when SMS is set up and under the caps) and keeps it. Once
 * per context, reference and number: asking again returns the first one
 * instead of texting twice. Returns { id, text, status }, or null when the
 * number is not a mobile number.
 */
function queueCustomerText(PDO $pdo, string $phone, string $customerName, string $context, string $referenceId, string $text): ?array
{
    $phone = normalizeMobileNumber($phone);
    if ($phone === '') return null;
    ensureCustomerMessagesTable($pdo);

    $existing = $pdo->prepare(
        'SELECT id, message, status FROM customer_messages
         WHERE context = ? AND reference_id = ? AND phone = ? LIMIT 1'
    );
    $existing->execute([$context, $referenceId, $phone]);
    if ($previous = $existing->fetch(PDO::FETCH_ASSOC)) {
        return ['id' => $previous['id'], 'text' => $previous['message'], 'status' => $previous['status']];
    }

    $status = 'queued';
    if (smsIsConfigured()) {
        $limits = $pdo->prepare(
            "SELECT
                SUM(phone = ? AND created_at > NOW() - INTERVAL 1 DAY) AS forNumber,
                SUM(created_at > NOW() - INTERVAL 1 HOUR) AS lastHour
             FROM customer_messages
             WHERE status = 'sent' AND created_at > NOW() - INTERVAL 1 DAY"
        );
        $limits->execute([$phone]);
        $counts = $limits->fetch(PDO::FETCH_ASSOC);
        $underLimit = (int) $counts['forNumber'] < TEXTS_PER_NUMBER_PER_DAY
            && (int) $counts['lastHour'] < TEXTS_PER_HOUR_TOTAL;

        if ($underLimit) {
            $status = sendSms($phone, $text) ? 'sent' : 'failed';
        }
    }

    $id = uniqid('msg-', true);
    $pdo->prepare(
        'INSERT INTO customer_messages (id, phone, customer_name, context, reference_id, message, status, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, IF(? = "sent", NOW(), NULL))'
    )->execute([$id, $phone, $customerName, $context, $referenceId, $text, $status, $status]);

    return ['id' => $id, 'text' => $text, 'status' => $status];
}

/** Runs a text step; a text that fails is logged and never stops the change it is about. */
function textSafely(callable $step): void
{
    try {
        $step();
    } catch (Throwable $error) {
        error_log('Customer text not sent: ' . $error->getMessage());
    }
}

// What happens to a payment that is not kept, for the end of a text.
function refundLine(?array $payment): string
{
    if (!$payment) return '';
    $amount = textPeso((float) $payment['amount']);
    $to = textNumber((string) ($payment['payerNumber'] ?? ''));
    if ($payment['status'] === 'refund_due') {
        return " Your GCash $amount will be sent back" . ($to !== '' ? " to $to" : '') . '.';
    }
    return '';
}

/**
 * A website booking was approved, turned down or cancelled: tells the customer.
 * `payment` is its GCash payment as it stands now (see online_payments.php),
 * or null. Bookings made at the desk are not texted.
 */
function textReservationDecision(PDO $pdo, string $reservationId, string $nextStatus, ?array $payment): void
{
    $stmt = $pdo->prepare(
        'SELECT id, customer_name, phone, reservation_date, TIME_FORMAT(reservation_time, "%H:%i") AS start_clock,
                duration_minutes, table_id, table_name, source
         FROM reservations WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$reservationId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || $row['source'] !== 'online') return;

    $name = safeName((string) $row['customer_name']);
    $table = trim((string) $row['table_name']) !== '' ? trim((string) $row['table_name'])
        : ((int) $row['table_id'] > 0 ? 'Table ' . (int) $row['table_id'] : 'your table');
    $minutes = max(1, (int) $row['duration_minutes']);
    $end = date('g:i A', strtotime('2000-01-01 ' . $row['start_clock']) + $minutes * 60);
    $when = "$table, " . prettyDate((string) $row['reservation_date']) . ', ' . prettyTime((string) $row['start_clock']) . " - $end";

    if (in_array($nextStatus, ['approved', 'reserved'], true)) {
        $context = 'reservation-approved';
        $paid = $payment && $payment['status'] === 'accepted' ? ' Your GCash ' . textPeso((float) $payment['amount']) . ' is accepted.' : '';
        $text = "Hi $name, Break & Chill approved your reservation: $when.$paid Please show this text when you arrive.";
    } elseif ($nextStatus === 'rejected') {
        $context = 'reservation-rejected';
        $text = "Hi $name, sorry, Break & Chill could not approve your reservation for $when." . refundLine($payment);
    } elseif ($nextStatus === 'cancelled') {
        $context = 'reservation-cancelled';
        $text = "Hi $name, your Break & Chill reservation for $when was cancelled." . refundLine($payment);
    } else {
        return;
    }

    queueCustomerText($pdo, (string) $row['phone'], $name, $context, (string) $row['id'], $text);
}

/**
 * A tournament entry fee paid on the website was decided: `what` is
 * "accepted", "rejected" (staff did not find it), "removed" (the admin took
 * the player off the list) or "cancelled" (the tournament is called off).
 * `payment` is as readPayment() gives it.
 */
function textTournamentDecision(PDO $pdo, array $payment, string $what): void
{
    $stmt = $pdo->prepare('SELECT event_data FROM tournament_events WHERE id = ? LIMIT 1');
    $stmt->execute([(string) $payment['refId']]);
    $event = json_decode((string) $stmt->fetchColumn(), true) ?: [];
    $eventName = mb_substr(trim((string) ($event['name'] ?? '')) ?: 'the tournament', 0, 40);
    $when = trim(
        (!empty($event['date']) ? ' on ' . prettyDate((string) $event['date']) : '')
        . (!empty($event['time']) ? ' at ' . prettyTime((string) $event['time']) : '')
    );
    $when = $when === '' ? '' : " $when";
    $name = safeName((string) $payment['customerName']);
    $fee = textPeso((float) $payment['amount']);

    if ($what === 'accepted') {
        $text = "Hi $name, your entry to $eventName$when is confirmed. Your GCash $fee is accepted. Please show this text when you arrive.";
    } elseif ($what === 'rejected') {
        $text = "Hi $name, sorry, Break & Chill could not confirm your entry to $eventName$when." . refundLine($payment);
    } elseif ($what === 'removed') {
        $text = "Hi $name, your entry to $eventName$when was not confirmed." . refundLine($payment);
    } elseif ($what === 'cancelled') {
        $text = "Hi $name, $eventName$when is cancelled." . refundLine($payment);
    } else {
        return;
    }

    queueCustomerText($pdo, (string) $payment['phone'], $name, "tournament-$what", (string) $payment['id'], $text);
}

/** A payment was sent back by GCash: tells the customer, with the refund's reference. Cash is handed over at the hall. */
function textRefundSent(PDO $pdo, array $payment): void
{
    if (($payment['refundMethod'] ?? '') !== 'gcash') return;
    $name = safeName((string) $payment['customerName']);
    $to = textNumber((string) $payment['payerNumber']);
    $text = "Hi $name, Break & Chill sent back your GCash " . textPeso((float) $payment['amount'])
        . ($to !== '' ? " to $to" : '') . ' (ref ' . $payment['refundReference'] . ').';
    queueCustomerText($pdo, (string) $payment['phone'], $name, 'refund-sent', (string) $payment['id'], $text);
}
