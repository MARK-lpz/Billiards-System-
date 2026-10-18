import { apiFetch } from "./apiFetch";

// The website's GCash payments, for signed-in staff (api/payments.php).
const PAYMENTS_API_URL = import.meta.env.VITE_PAYMENTS_API_URL || (
  !import.meta.env.DEV && window.location.hostname === "breakandchill.com"
    ? "https://app.breakandchill.com/api/payments.php"
    : "/api/payments.php"
);

const send = async (body, fallbackMessage) => {
  const response = await apiFetch(PAYMENTS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || fallbackMessage);
  return data;
};

export const fetchOnlinePayments = async () => {
  const response = await apiFetch(PAYMENTS_API_URL);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "Unable to load the GCash payments.");
  return Array.isArray(data.payments) ? data.payments : [];
};

/**
 * One payment's receipt screenshot, as a picture URL for this page only (the
 * caller revokes it). The server sends it to signed-in staff only.
 */
export const fetchReceiptUrl = async (paymentId) => {
  const response = await apiFetch(`${PAYMENTS_API_URL}?receipt=${encodeURIComponent(paymentId)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || "Unable to load the receipt.");
    error.status = response.status;
    throw error;
  }
  return URL.createObjectURL(await response.blob());
};

/** A tournament entry fee was found in the hall's GCash: keep it. Resolves with { payment }. */
export const acceptTournamentPayment = (id) => send({ action: "accept", id }, "Unable to accept this payment.");

/**
 * A tournament entry fee was not found: the player leaves the tournament and
 * the fee is listed to send back. Resolves with { payment, event, version }.
 */
export const rejectTournamentPayment = (id) => send({ action: "reject", id }, "Unable to reject this payment.");

/** A payment was sent back: method "gcash" (with the refund's reference) or "cash". Resolves with { payment }. */
export const markPaymentRefunded = ({ id, method, refundReference }) =>
  send({ action: "refunded", id, method, refundReference }, "Unable to save the refund.");

// A refused or failed request as an Error that keeps the server's status (none
// when the server could not be reached at all).
const readOrThrow = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    const error = new Error(data.message || fallbackMessage);
    error.status = response.status;
    throw error;
  }
  return data;
};

/** Whether a GCash reference was used already, at the counter or on the website: { used, message }. */
export const checkGcashReference = async (reference) => {
  const response = await apiFetch(`${PAYMENTS_API_URL}?reference=${encodeURIComponent(reference)}`);
  const data = await readOrThrow(response, "Unable to check this reference.");
  return { used: Boolean(data.used), message: data.message || "" };
};

/**
 * GCash paid at the counter, found in the hall's GCash app: kept on the server
 * so its reference can't be used again. Resolves with the saved payment; a
 * reference used before is refused with status 409.
 */
export const recordCounterGcash = async ({ reference, amount, label, saleKey }) => {
  const response = await apiFetch(PAYMENTS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "counter", reference, amount, label, saleKey }),
  });
  const data = await readOrThrow(response, "Unable to record this GCash payment.");
  return data.payment || null;
};

/** One day's GCash in and out ({ received, sentBack }), for the GCash check in Reports. */
export const fetchGcashDay = async (day) => {
  const response = await apiFetch(`${PAYMENTS_API_URL}?day=${encodeURIComponent(day)}`);
  const data = await readOrThrow(response, "Unable to load that day's GCash payments.");
  return {
    received: Array.isArray(data.received) ? data.received : [],
    sentBack: Array.isArray(data.sentBack) ? data.sentBack : [],
  };
};
