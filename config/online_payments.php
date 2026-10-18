<?php
/*
 * GCash payments sent from the website: a table reservation, or a paid
 * tournament's entry fee. The money goes straight to the hall's own GCash, so
 * nothing here can freeze it: "held" means the hall has not accepted it yet,
 * and a payment that is not accepted is listed for the staff to send back.
 *
 *   held        sent, not yet accepted (its booking or player waits for staff)
 *   accepted    staff found it in the hall's GCash; the hall keeps it
 *   refund_due  turned down, or the hall called it off: staff send it back to
 *               the GCash number it came from
 *   refunded    sent back (the GCash reference of the refund is kept), or
 *               handed back in cash at the hall
 *
 * The customer's receipt screenshot is kept beside it, in backend/Receipts
 * under a random name. The web never serves that folder (its .htaccess refuses
 * every request); signed-in staff get a receipt through api/payments.php only,
 * since it shows the customer's name and number. A receipt is deleted
 * RECEIPT_KEEP_DAYS after the booking's or tournament's day, once its payment
 * is settled.
 *
 * GCash paid at the counter (Sales / POS, or a table's checkout) is kept here
 * too, as kind "pos": accepted at once, with no receipt, since staff found it
 * in the hall's GCash app before approving. It is not in the staff's list of
 * payments; it is here so a reference is used only once, at the counter or on
 * the website, and for the day's GCash check (listGcashDay).
 */

const RECEIPT_DIR = __DIR__ . '/../Receipts';
const RECEIPT_MAX_BYTES = 3 * 1024 * 1024;
const RECEIPT_MIN_SIDE = 200;
const RECEIPT_MAX_SIDE = 8000;
const RECEIPT_KEEP_DAYS = 30;
const RECEIPT_FILE_PATTERN = '/^[a-f0-9]{32}\.(jpg|png|webp)$/';
const RECEIPT_CONTENT_TYPES = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
// Same as REFERENCE_MIN_DIGITS / REFERENCE_MAX_DIGITS in the app's paymentReference.js.
const PAYMENT_REFERENCE_MIN = 10;
const PAYMENT_REFERENCE_MAX = 15;
// Settled payments stay in the staff's list this long; open ones always do.
const PAYMENT_LIST_DAYS = 60;
// A booking in one of these keeps its payment; one turned down before that sends it back.
const PAYMENT_KEEP_STATUSES = ['approved', 'reserved', 'arrived', 'seated', 'completed'];
const PAYMENT_DROP_STATUSES = ['rejected', 'cancelled', 'expired'];
// Times are read by the database itself, so they are right whatever time zone it keeps.
const PAYMENT_COLUMNS = '*, UNIX_TIMESTAMP(created_at) AS created_unix, UNIX_TIMESTAMP(decided_at) AS decided_unix,
    UNIX_TIMESTAMP(refunded_at) AS refunded_unix';

/** A refused payment step: the status to answer with and the message to show. */
class PaymentRefusal extends RuntimeException
{
    public int $status;

    public function __construct(int $status, string $message)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function ensureOnlinePaymentsTable(PDO $pdo): void
{
    static $ready = false;
    if ($ready) return;
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS online_payments (
            id VARCHAR(40) NOT NULL PRIMARY KEY,
            kind VARCHAR(20) NOT NULL,
            ref_id VARCHAR(80) NOT NULL,
            participant VARCHAR(200) NOT NULL DEFAULT '',
            customer_name VARCHAR(160) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            payer_number VARCHAR(20) NOT NULL,
            reference VARCHAR(20) NOT NULL,
            amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            receipt_file VARCHAR(60) NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'held',
            decided_by VARCHAR(80) NULL,
            decided_at DATETIME NULL,
            refund_method VARCHAR(10) NULL,
            refund_reference VARCHAR(20) NULL,
            refunded_by VARCHAR(80) NULL,
            refunded_at DATETIME NULL,
            keep_until DATE NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY online_payments_reference (reference),
            INDEX online_payments_ref (kind, ref_id),
            INDEX online_payments_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $ready = true;
}

function manilaToday(): string
{
    return (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
}

/** The digits of a GCash reference, or "" when it is not 10 to 15 of them. */
function cleanPaymentReference($value): string
{
    $digits = preg_replace('/\D/', '', (string) $value);
    $length = strlen($digits);
    return $length >= PAYMENT_REFERENCE_MIN && $length <= PAYMENT_REFERENCE_MAX ? $digits : '';
}

/** A GCash (mobile) number as 09XXXXXXXXX, or "" when it is not one. */
function cleanPayerNumber($value): string
{
    $digits = preg_replace('/\D/', '', (string) $value);
    if (preg_match('/^639\d{9}$/', $digits)) $digits = '0' . substr($digits, 2);
    return preg_match('/^09\d{9}$/', $digits) ? $digits : '';
}

/**
 * The receipt screenshot sent as a data URL ("data:image/webp;base64,..."),
 * checked to be a real JPG, PNG or WebP picture of a sensible size.
 * Returns ['bytes' => ..., 'ext' => ...].
 */
function readReceiptDataUrl($dataUrl): array
{
    $dataUrl = (string) $dataUrl;
    if (!preg_match('#^data:image/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$#', $dataUrl, $match)) {
        throw new PaymentRefusal(400, 'Please attach a screenshot of your GCash receipt (a JPG, PNG or WebP picture).');
    }
    if (strlen($match[1]) > intdiv(RECEIPT_MAX_BYTES * 4, 3) + 8) {
        throw new PaymentRefusal(413, 'The receipt picture is too large. Please send a smaller screenshot (up to 3 MB).');
    }
    $bytes = base64_decode($match[1], true);
    if ($bytes === false || $bytes === '') {
        throw new PaymentRefusal(400, 'The receipt picture could not be read. Please attach it again.');
    }
    if (strlen($bytes) > RECEIPT_MAX_BYTES) {
        throw new PaymentRefusal(413, 'The receipt picture is too large. Please send a smaller screenshot (up to 3 MB).');
    }

    $info = @getimagesizefromstring($bytes);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) {
        throw new PaymentRefusal(400, 'The receipt is not a picture we can open. Please attach a JPG, PNG or WebP screenshot.');
    }
    if (min($info[0], $info[1]) < RECEIPT_MIN_SIDE) {
        throw new PaymentRefusal(400, 'The receipt picture is too small to read. Please attach the full screenshot.');
    }
    if (max($info[0], $info[1]) > RECEIPT_MAX_SIDE) {
        throw new PaymentRefusal(400, 'The receipt picture is too large. Please send a smaller screenshot.');
    }
    return ['bytes' => $bytes, 'ext' => $types[$info[2]]];
}

/** The private Receipts folder, made on first use with the files that keep the web out. */
function ensureReceiptDir(): bool
{
    if (!is_dir(RECEIPT_DIR) && !mkdir(RECEIPT_DIR, 0750, true) && !is_dir(RECEIPT_DIR)) {
        return false;
    }
    $htaccess = RECEIPT_DIR . '/.htaccess';
    if (!is_file($htaccess)) {
        file_put_contents($htaccess, implode("\n", [
            '# GCash receipt screenshots. Only api/payments.php reads them, for signed-in staff.',
            '<IfModule mod_authz_core.c>',
            '  Require all denied',
            '</IfModule>',
            '<IfModule !mod_authz_core.c>',
            '  Order allow,deny',
            '  Deny from all',
            '</IfModule>',
            '',
        ]));
    }
    if (!is_file(RECEIPT_DIR . '/index.html')) file_put_contents(RECEIPT_DIR . '/index.html', '');
    return true;
}

/** Saves a checked receipt under a new random name; returns that name. */
function storeReceipt(array $image): string
{
    $name = bin2hex(random_bytes(16)) . '.' . $image['ext'];
    if (!ensureReceiptDir() || file_put_contents(RECEIPT_DIR . '/' . $name, $image['bytes'], LOCK_EX) === false) {
        throw new PaymentRefusal(500, 'Your receipt could not be saved. Please try again.');
    }
    return $name;
}

function deleteReceipt($name): void
{
    $name = (string) $name;
    if (preg_match(RECEIPT_FILE_PATTERN, $name)) @unlink(RECEIPT_DIR . '/' . $name);
}

/** The path of a stored receipt, or null when the name is not one or the file is gone. */
function receiptPath($name): ?string
{
    $name = (string) $name;
    if (!preg_match(RECEIPT_FILE_PATTERN, $name)) return null;
    $path = RECEIPT_DIR . '/' . $name;
    return is_file($path) ? $path : null;
}

/**
 * Records a payment the website just took, as held. Runs inside the caller's
 * transaction (the booking or registration is saved in the same one). A GCash
 * reference is only ever used once.
 */
function createHeldPayment(PDO $pdo, array $payment): array
{
    $today = manilaToday();
    $playDate = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($payment['playDate'] ?? '')) ? $payment['playDate'] : $today;
    $keepUntil = (new DateTime(max($today, $playDate)))->modify('+' . RECEIPT_KEEP_DAYS . ' days')->format('Y-m-d');
    $id = 'pay-' . bin2hex(random_bytes(8));

    try {
        $pdo->prepare(
            'INSERT INTO online_payments
               (id, kind, ref_id, participant, customer_name, phone, payer_number, reference, amount, receipt_file, status, keep_until)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $id,
            $payment['kind'],
            (string) $payment['refId'],
            (string) ($payment['participant'] ?? ''),
            (string) $payment['customerName'],
            (string) $payment['phone'],
            (string) $payment['payerNumber'],
            (string) $payment['reference'],
            max(0, (float) $payment['amount']),
            $payment['receiptFile'],
            'held',
            $keepUntil,
        ]);
    } catch (PDOException $error) {
        if ($error->getCode() === '23000') {
            throw new PaymentRefusal(409, 'This GCash reference number was already used. Please check the reference on your receipt.');
        }
        throw $error;
    }
    return readPayment($pdo, $id);
}

function readPayment(PDO $pdo, string $id): ?array
{
    $stmt = $pdo->prepare('SELECT ' . PAYMENT_COLUMNS . ' FROM online_payments WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? paymentForStaff($row) : null;
}

/** A payment as the staff app gets it. The receipt itself is fetched on its own. */
function paymentForStaff(array $row): array
{
    $at = fn($seconds) => $seconds !== null && $seconds !== '' ? (int) $seconds * 1000 : null;
    return [
        'id' => $row['id'],
        'kind' => $row['kind'],
        'refId' => (string) $row['ref_id'],
        'participant' => (string) $row['participant'],
        'customerName' => (string) $row['customer_name'],
        'phone' => (string) $row['phone'],
        'payerNumber' => (string) $row['payer_number'],
        'reference' => (string) $row['reference'],
        'amount' => (float) $row['amount'],
        'hasReceipt' => receiptPath($row['receipt_file']) !== null,
        'status' => (string) $row['status'],
        'decidedBy' => (string) ($row['decided_by'] ?? ''),
        'decidedAt' => $at($row['decided_unix'] ?? null),
        'refundMethod' => (string) ($row['refund_method'] ?? ''),
        'refundReference' => (string) ($row['refund_reference'] ?? ''),
        'refundedBy' => (string) ($row['refunded_by'] ?? ''),
        'refundedAt' => $at($row['refunded_unix'] ?? null),
        'createdAt' => $at($row['created_unix'] ?? null),
    ];
}

/**
 * The website's open payments, and settled ones from the last PAYMENT_LIST_DAYS
 * days, newest first. Counter sales are left out: they need nothing more.
 */
function listPaymentsForStaff(PDO $pdo): array
{
    $stmt = $pdo->prepare(
        'SELECT ' . PAYMENT_COLUMNS . " FROM online_payments
         WHERE kind <> 'pos'
           AND (status IN ('held', 'refund_due') OR created_at >= (NOW() - INTERVAL " . PAYMENT_LIST_DAYS . " DAY))
         ORDER BY created_at DESC
         LIMIT 500"
    );
    $stmt->execute();
    return array_map('paymentForStaff', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

/** Where a GCash reference was used already ({kind, at} in ms), or null. */
function findReferenceUse(PDO $pdo, string $reference): ?array
{
    $stmt = $pdo->prepare('SELECT kind, UNIX_TIMESTAMP(created_at) AS created_unix FROM online_payments WHERE reference = ?');
    $stmt->execute([$reference]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? ['kind' => (string) $row['kind'], 'at' => (int) $row['created_unix'] * 1000] : null;
}

/** Why a reference cannot be used again, for the staff at the counter. */
function describeReferenceUse(array $use): string
{
    $where = [
        'pos' => 'a sale at the counter',
        'reservation' => 'a table booking on the website',
        'tournament' => 'a tournament sign-up on the website',
    ][$use['kind']] ?? 'another payment';
    $when = (new DateTime('@' . intdiv($use['at'], 1000)))->setTimezone(new DateTimeZone('Asia/Manila'))->format('M j, Y g:i A');
    return "This GCash reference was already used on $where ($when). Ask the customer for the receipt of this payment.";
}

/**
 * A GCash payment taken at the counter, which staff found in the hall's GCash
 * app: `sale` is { reference, amount, label (the bill, e.g. "Table 3"),
 * saleKey }. Kept as accepted; refused (409) if the reference was used before,
 * here or on the website.
 */
function recordCounterPayment(PDO $pdo, array $sale, string $by): array
{
    $reference = cleanPaymentReference($sale['reference'] ?? '');
    if ($reference === '') {
        throw new PaymentRefusal(400, 'The GCash reference must be ' . PAYMENT_REFERENCE_MIN . ' to ' . PAYMENT_REFERENCE_MAX . ' digits.');
    }
    $amount = round((float) ($sale['amount'] ?? 0), 2);
    if ($amount <= 0 || $amount > 1000000) {
        throw new PaymentRefusal(400, 'The amount of this sale is not valid.');
    }
    $label = trim(preg_replace('/\s+/u', ' ', (string) ($sale['label'] ?? '')) ?? '');
    $label = $label === '' ? 'Counter sale' : (function_exists('mb_substr') ? mb_substr($label, 0, 160) : substr($label, 0, 160));
    $saleKey = (string) ($sale['saleKey'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $saleKey)) $saleKey = 'sale-' . bin2hex(random_bytes(6));

    $use = findReferenceUse($pdo, $reference);
    if ($use) throw new PaymentRefusal(409, describeReferenceUse($use));

    $id = 'pos-' . bin2hex(random_bytes(8));
    try {
        $pdo->prepare(
            "INSERT INTO online_payments
               (id, kind, ref_id, participant, customer_name, phone, payer_number, reference, amount, receipt_file,
                status, decided_by, decided_at, keep_until)
             VALUES (?, 'pos', ?, '', ?, '', '', ?, ?, NULL, 'accepted', ?, NOW(), ?)"
        )->execute([$id, $saleKey, $label, $reference, $amount, $by, manilaToday()]);
    } catch (PDOException $error) {
        // Taken a moment ago, on another screen or on the website.
        if ($error->getCode() === '23000') {
            $use = findReferenceUse($pdo, $reference);
            throw new PaymentRefusal(409, $use ? describeReferenceUse($use) : 'This GCash reference was already used.');
        }
        throw $error;
    }
    return readPayment($pdo, $id);
}

/**
 * What reached and left the hall's GCash on `day` (Y-m-d, Manila), to check
 * against the history in the GCash app: `received` (counter sales and website
 * payments, whatever became of them since) and `sentBack` (refunds sent by
 * GCash), each oldest first.
 */
function listGcashDay(PDO $pdo, string $day): array
{
    $start = new DateTime($day . ' 00:00:00', new DateTimeZone('Asia/Manila'));
    $range = [$start->getTimestamp(), (clone $start)->modify('+1 day')->getTimestamp()];

    $received = $pdo->prepare(
        'SELECT ' . PAYMENT_COLUMNS . ' FROM online_payments
         WHERE created_at >= FROM_UNIXTIME(?) AND created_at < FROM_UNIXTIME(?)
         ORDER BY created_at, id'
    );
    $received->execute($range);
    $sentBack = $pdo->prepare(
        'SELECT ' . PAYMENT_COLUMNS . " FROM online_payments
         WHERE refund_method = 'gcash' AND refunded_at >= FROM_UNIXTIME(?) AND refunded_at < FROM_UNIXTIME(?)
         ORDER BY refunded_at, id"
    );
    $sentBack->execute($range);

    return [
        'received' => array_map('paymentForStaff', $received->fetchAll(PDO::FETCH_ASSOC)),
        'sentBack' => array_map('paymentForStaff', $sentBack->fetchAll(PDO::FETCH_ASSOC)),
    ];
}

/** Moves a payment from one status to the next, only if it is still in the first. */
function movePayment(PDO $pdo, string $id, string $from, string $to, string $by): bool
{
    $stmt = $pdo->prepare(
        'UPDATE online_payments SET status = ?, decided_by = ?, decided_at = NOW() WHERE id = ? AND status = ?'
    );
    $stmt->execute([$to, $by, $id, $from]);
    return $stmt->rowCount() > 0;
}

/**
 * A reservation's payment follows its booking. While held: kept once the
 * booking is approved (or goes on from there), sent back if it is turned down,
 * cancelled or runs out first. Once accepted: sent back only when staff cancel
 * the booking and say so (`$refund`), not for a no-show.
 */
function settleReservationPayment(PDO $pdo, string $reservationId, string $nextStatus, ?bool $refund, string $by): ?array
{
    $stmt = $pdo->prepare("SELECT id, status FROM online_payments WHERE kind = 'reservation' AND ref_id = ? LIMIT 1");
    $stmt->execute([$reservationId]);
    $payment = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$payment) return null;

    $next = null;
    if ($payment['status'] === 'held') {
        if (in_array($nextStatus, PAYMENT_KEEP_STATUSES, true)) $next = 'accepted';
        elseif (in_array($nextStatus, PAYMENT_DROP_STATUSES, true)) $next = 'refund_due';
    } elseif ($payment['status'] === 'accepted' && $refund === true && in_array($nextStatus, ['rejected', 'cancelled'], true)) {
        $next = 'refund_due';
    }
    if ($next !== null) movePayment($pdo, $payment['id'], $payment['status'], $next, $by);
    return readPayment($pdo, $payment['id']);
}

/**
 * After the admin saves a tournament: when it is cancelled, every payment for
 * it is sent back; otherwise a held payment whose player was taken off the list
 * is. Returns what was moved: [{ payment, why: "cancelled" | "removed" }].
 */
function settleTournamentPayments(PDO $pdo, array $event, string $by): array
{
    $stmt = $pdo->prepare(
        "SELECT id, status, participant FROM online_payments
         WHERE kind = 'tournament' AND ref_id = ? AND status IN ('held', 'accepted')"
    );
    $stmt->execute([(string) $event['id']]);
    $players = array_map('trim', is_array($event['participants'] ?? null) ? $event['participants'] : []);
    $moved = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $payment) {
        $cancelled = ($event['status'] ?? '') === 'cancelled';
        $dropped = $payment['status'] === 'held' && !in_array(trim($payment['participant']), $players, true);
        if (($cancelled || $dropped) && movePayment($pdo, $payment['id'], $payment['status'], 'refund_due', $by)) {
            $moved[] = ['payment' => readPayment($pdo, $payment['id']), 'why' => $cancelled ? 'cancelled' : 'removed'];
        }
    }
    return $moved;
}

/**
 * Staff sent a payment back: by GCash (with the refund's reference) or in cash
 * at the hall.
 */
function markPaymentRefunded(PDO $pdo, string $id, string $method, string $reference, string $by): array
{
    if (!in_array($method, ['gcash', 'cash'], true)) {
        throw new PaymentRefusal(400, 'Say how the payment was given back.');
    }
    $reference = $method === 'gcash' ? cleanPaymentReference($reference) : '';
    if ($method === 'gcash' && $reference === '') {
        throw new PaymentRefusal(400, 'Type the reference number of the GCash refund (10 to 15 digits).');
    }
    $stmt = $pdo->prepare(
        "UPDATE online_payments
         SET status = 'refunded', refund_method = ?, refund_reference = ?, refunded_by = ?, refunded_at = NOW()
         WHERE id = ? AND status = 'refund_due'"
    );
    $stmt->execute([$method, $reference ?: null, $by, $id]);
    $payment = readPayment($pdo, $id);
    if (!$payment) throw new PaymentRefusal(404, 'That payment was not found.');
    if ($stmt->rowCount() === 0) throw new PaymentRefusal(409, 'This payment is not waiting to be sent back.');
    return $payment;
}

/** Deletes receipts kept past their day, once their payment is settled. */
function cleanupOldReceipts(PDO $pdo): void
{
    $stmt = $pdo->prepare(
        "SELECT id, receipt_file FROM online_payments
         WHERE receipt_file IS NOT NULL AND keep_until < ? AND status IN ('accepted', 'refunded')
         LIMIT 100"
    );
    $stmt->execute([manilaToday()]);
    $clear = $pdo->prepare('UPDATE online_payments SET receipt_file = NULL WHERE id = ?');
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        deleteReceipt($row['receipt_file']);
        $clear->execute([$row['id']]);
    }
}
