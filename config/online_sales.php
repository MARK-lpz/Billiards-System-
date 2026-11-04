<?php
require_once __DIR__ . '/ledger.php';
require_once __DIR__ . '/online_payments.php';

/*
 * A website GCash payment the hall kept, as a sale, so the Sales Report counts it
 * with the rest. The sale is written when staff accept the payment, on that day.
 * Money sent back after that is a sale below zero, on the day it left; a payment
 * turned down before it was accepted never was a sale, so nothing comes off.
 *
 * The bill at the end of a session takes the payment off and sells only what is
 * left, so a payment is never counted twice.
 *
 * A payment's sale keeps one id for good, worked out from the payment itself.
 * Writing it again changes nothing, so a missed sale can be added later and
 * findMissingOnlineSales can be run any number of times.
 */

// A number, as the screens sort sales by it: the moment the payment was sent, in
// ms, with its last digits taken from the payment so two in one second differ.
function onlineSaleId(string $key, int $sentAtMs): int
{
    return intdiv($sentAtMs, 1000) * 1000 + (crc32($key) % 1000);
}

function manilaMoment(int $ms): DateTime
{
    return (new DateTime('@' . intdiv($ms, 1000)))->setTimezone(new DateTimeZone('Asia/Manila'));
}

function saleExists(PDO $pdo, $saleId): bool
{
    openLedger($pdo, 'sales');
    $stmt = $pdo->prepare('SELECT 1 FROM sales_ledger WHERE item_id = ?');
    $stmt->execute([(string) $saleId]);
    return (bool) $stmt->fetchColumn();
}

function writeSales(PDO $pdo, array $sales, array $staff): int
{
    $result = changeLedger(
        $pdo,
        openLedger($pdo, 'sales'),
        ['upsert' => array_map(fn($sale) => ['item' => $sale, 'version' => 0], $sales)],
        ['staff' => $staff, 'validate' => fn($sale) => $sale]
    );
    return count((array) $result['versions']);
}

// What a sale says it was for: a table booking, or a tournament's entry fee.
function describeOnlineSale(PDO $pdo, array $payment): array
{
    if ($payment['kind'] === 'tournament') {
        $stmt = $pdo->prepare('SELECT event_data FROM tournament_events WHERE id = ?');
        $stmt->execute([$payment['refId']]);
        $event = json_decode((string) $stmt->fetchColumn(), true) ?: [];
        $eventName = trim((string) ($event['name'] ?? 'Tournament'));
        $player = trim((string) preg_replace('/\s*\(.*\)\s*$/', '', $payment['participant'])) ?: $payment['customerName'];
        return [
            'line' => "Entry fee · $eventName",
            'detail' => '',
            'category' => 'Tournament',
            'isTableCharge' => false,
            'billLabel' => "$player · $eventName",
            'tableName' => '',
            'customerName' => $player,
        ];
    }

    $stmt = $pdo->prepare(
        'SELECT table_name, reservation_date, TIME_FORMAT(reservation_time, "%H:%i") AS start_clock, duration_minutes
         FROM reservations WHERE id = ?'
    );
    $stmt->execute([$payment['refId']]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $table = trim((string) ($booking['table_name'] ?? '')) ?: 'Table';
    $detail = '';
    $hours = '';
    if ($booking) {
        $minutes = max(1, (int) $booking['duration_minutes']);
        $start = new DateTime($booking['reservation_date'] . ' ' . $booking['start_clock']);
        $end = (clone $start)->modify("+$minutes minutes");
        $detail = $start->format('M j, Y, g:i A') . ' - ' . $end->format('g:i A');
        $hours = ' (' . ($minutes % 60 === 0 ? ($minutes === 60 ? '1 hour' : ($minutes / 60) . ' hours') : "$minutes minutes") . ')';
    }
    return [
        'line' => "$table · Reservation$hours",
        'detail' => $detail,
        'category' => 'Pool Table',
        'isTableCharge' => true,
        'billLabel' => "$table · {$payment['customerName']}",
        'tableName' => $table,
        'customerName' => $payment['customerName'],
    ];
}

function buildOnlineSale(int $id, array $about, float $total, int $atMs, string $method, array $details, string $cashier, string $paymentId): array
{
    $at = manilaMoment($atMs);
    return [
        'id' => $id,
        'date' => $at->format('Y-m-d'),
        'time' => $at->format('h:i A'),
        'cashier' => $cashier,
        'items' => [[
            'name' => $about['line'],
            'qty' => 1,
            'price' => $total,
            'category' => $about['category'],
            'isExtra' => false,
            'isTableCharge' => $about['isTableCharge'],
            'detail' => $about['detail'],
        ]],
        'billLabel' => $about['billLabel'],
        'tableName' => $about['tableName'],
        'customerName' => $about['customerName'],
        'extraCharges' => [],
        'subtotal' => $total,
        'discLabel' => 'No Discount',
        'discAmt' => 0,
        'total' => $total,
        'method' => $method,
        'paymentDetails' => $details,
        'status' => 'completed',
        'source' => 'online',
        'onlinePaymentId' => $paymentId,
    ];
}

function onlinePaymentSale(PDO $pdo, array $payment): array
{
    return buildOnlineSale(
        onlineSaleId($payment['id'], (int) $payment['createdAt']),
        describeOnlineSale($pdo, $payment),
        (float) $payment['amount'],
        (int) ($payment['decidedAt'] ?: $payment['createdAt']),
        'ewallet',
        ['referenceNumber' => $payment['reference'], 'referenceVerified' => true],
        $payment['decidedBy'] ?: 'Website',
        $payment['id']
    );
}

function onlineRefundSale(PDO $pdo, array $payment): array
{
    $about = describeOnlineSale($pdo, $payment);
    $about['line'] = $payment['kind'] === 'tournament' ? "Entry fee refund · {$about['billLabel']}" : "{$about['tableName']} · Reservation refund";
    $byCash = $payment['refundMethod'] === 'cash';
    return buildOnlineSale(
        onlineSaleId($payment['id'] . '-refund', (int) $payment['createdAt']),
        $about,
        -(float) $payment['amount'],
        (int) ($payment['refundedAt'] ?: $payment['createdAt']),
        $byCash ? 'cash' : 'ewallet',
        $byCash ? [] : ['referenceNumber' => $payment['refundReference']],
        $payment['refundedBy'] ?: 'Website',
        $payment['id']
    );
}

function isOnlinePayment(array $payment): bool
{
    return in_array($payment['kind'], ['reservation', 'tournament'], true);
}

/** Once a payment is accepted. Run again, it changes nothing. */
function recordOnlineSale(PDO $pdo, ?array $payment, array $staff): void
{
    if (!$payment || !isOnlinePayment($payment) || $payment['status'] !== 'accepted') return;
    $sale = onlinePaymentSale($pdo, $payment);
    if (!saleExists($pdo, $sale['id'])) writeSales($pdo, [$sale], $staff);
}

/** Once a payment was sent back: only money that was a sale comes off the sales. */
function recordOnlineRefundSale(PDO $pdo, ?array $payment, array $staff): void
{
    if (!$payment || !isOnlinePayment($payment) || $payment['status'] !== 'refunded') return;
    if (!saleExists($pdo, onlineSaleId($payment['id'], (int) $payment['createdAt']))) return;
    $refund = onlineRefundSale($pdo, $payment);
    if (!saleExists($pdo, $refund['id'])) writeSales($pdo, [$refund], $staff);
}

// A sale that could not be written must not undo what staff just decided:
// findMissingOnlineSales finds it later.
function saleSafely(callable $write): void
{
    try {
        $write();
    } catch (Throwable $error) {
        error_log('Online payment sale not recorded: ' . $error->getMessage());
    }
}

/**
 * The sales missing for money the hall kept: payments accepted before sales were
 * written for them, any that failed to write, and website bookings older than
 * the payments list (their booking is all there is). Money sent back before then
 * was never a sale, so it needs nothing either way.
 */
function findMissingOnlineSales(PDO $pdo): array
{
    openLedger($pdo, 'sales');
    $known = array_flip($pdo->query('SELECT item_id FROM sales_ledger')->fetchAll(PDO::FETCH_COLUMN));
    $missing = [];
    $paidBookings = [];

    $stmt = $pdo->query('SELECT ' . PAYMENT_COLUMNS . " FROM online_payments WHERE kind <> 'pos'");
    foreach (array_map('paymentForStaff', $stmt->fetchAll(PDO::FETCH_ASSOC)) as $payment) {
        if ($payment['kind'] === 'reservation') $paidBookings[$payment['refId']] = true;
        if (!isOnlinePayment($payment) || !$payment['createdAt']) continue;

        $saleId = onlineSaleId($payment['id'], (int) $payment['createdAt']);
        if ($payment['status'] === 'accepted' && !isset($known[$saleId])) {
            $missing[] = onlinePaymentSale($pdo, $payment);
        } elseif ($payment['status'] === 'refunded' && isset($known[$saleId])) {
            $refund = onlineRefundSale($pdo, $payment);
            if (!isset($known[$refund['id']])) $missing[] = $refund;
        }
    }

    if (!tableExistsHere($pdo, 'reservations')) return $missing;
    $stmt = $pdo->query(
        "SELECT id, customer_name, payment_reference, payment_amount, UNIX_TIMESTAMP(requested_at) AS requested_unix
         FROM reservations
         WHERE source = 'online' AND payment_amount > 0
           AND status IN ('approved', 'reserved', 'arrived', 'seated', 'completed', 'expired')"
    );
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $booking) {
        $bookingId = (string) $booking['id'];
        if (isset($paidBookings[$bookingId])) continue;
        $sentAt = (int) $booking['requested_unix'] * 1000;
        $saleId = onlineSaleId("reservation-$bookingId", $sentAt);
        if (isset($known[$saleId])) continue;
        $payment = ['kind' => 'reservation', 'refId' => $bookingId, 'customerName' => (string) $booking['customer_name'], 'participant' => ''];
        $missing[] = buildOnlineSale(
            $saleId,
            describeOnlineSale($pdo, $payment),
            (float) $booking['payment_amount'],
            $sentAt,
            'ewallet',
            ['referenceNumber' => (string) $booking['payment_reference'], 'referenceVerified' => true],
            'Website',
            ''
        );
    }
    return $missing;
}

/** { count, total, months: [{ month: "2026-10", count, total }] }, oldest month first. */
function summarizeMissingSales(array $sales): array
{
    $months = [];
    foreach ($sales as $sale) {
        $month = substr($sale['date'], 0, 7);
        $months[$month] = $months[$month] ?? ['month' => $month, 'count' => 0, 'total' => 0.0];
        $months[$month]['count']++;
        $months[$month]['total'] = round($months[$month]['total'] + $sale['total'], 2);
    }
    ksort($months);
    return [
        'count' => count($sales),
        'total' => round(array_sum(array_column($sales, 'total')), 2),
        'months' => array_values($months),
    ];
}

/** Adds them all; how many were kept. A sale the ledger already has changes nothing. */
function addMissingOnlineSales(PDO $pdo, array $staff): int
{
    $added = 0;
    foreach (array_chunk(findMissingOnlineSales($pdo), LEDGER_MAX_CHANGES) as $batch) {
        $added += writeSales($pdo, $batch, $staff);
    }
    return $added;
}
