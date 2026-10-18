/**
 * GCash payments sent from the website (a table booking, or a paid
 * tournament's entry fee), as the staff see them (api/payments.php). The money
 * reaches the hall's GCash at once, so "held" only means the hall has not
 * accepted it yet: one that is not accepted is listed for staff to send back.
 *
 *   held        waiting for staff to find it and accept it
 *   accepted    found; the hall keeps it
 *   refund_due  turned down, or the hall called it off: send it back
 *   refunded    sent back (by GCash, or in cash at the hall)
 */
import { formatMobile } from "./siteSettings";

export const PAYMENT_STATES = {
  held: { label: "Payment held", short: "Held", tone: "held", icon: "bi-hourglass-split" },
  accepted: { label: "Payment accepted", short: "Accepted", tone: "accepted", icon: "bi-check-circle-fill" },
  refund_due: { label: "Send back", short: "Send back", tone: "refund", icon: "bi-arrow-counterclockwise" },
  refunded: { label: "Sent back", short: "Sent back", tone: "refunded", icon: "bi-check2-all" },
};

export const paymentState = (payment) => PAYMENT_STATES[payment?.status] || null;

export const formatPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatPayer = (payment) => formatMobile(payment?.payerNumber || "");

const normalize = (text) => String(text || "").trim().toLowerCase().replace(/\s+/g, " ");

/** The payment that came with a website booking, or null (a desk booking has none). */
export const findReservationPayment = (payments = [], reservationId) =>
  payments.find((payment) => payment.kind === "reservation" && String(payment.refId) === String(reservationId)) || null;

/** A tournament's entry fees paid on the website, newest first. */
export const getTournamentPayments = (payments = [], eventId) =>
  payments.filter((payment) => payment.kind === "tournament" && String(payment.refId) === String(eventId));

/** The entry fee one player paid on the website, or null. */
export const findPlayerPayment = (payments = [], eventId, label) =>
  getTournamentPayments(payments, eventId).find((payment) => normalize(payment.participant) === normalize(label)) || null;

/** Payments waiting to be sent back, the oldest first. */
export const getRefundsDue = (payments = []) =>
  payments
    .filter((payment) => payment.status === "refund_due")
    .sort((first, second) => (first.decidedAt || first.createdAt || 0) - (second.decidedAt || second.createdAt || 0));

/**
 * Cancelling a booking whose payment the hall already accepted asks whether to
 * give it back (a hall that cancels does; a no-show or late cancel may not). A
 * payment still held goes back on its own, since it was never accepted.
 */
export const needsRefundChoice = (payment) => payment?.status === "accepted";

export const refundKey = (payment) => `refund:${payment.id}`;

// The refunds the bells have already shown as new on this device.
export const SEEN_REFUNDS_KEY = "seenRefundsDue";

/** "Sent back by GCash (ref 1234 5678 9012 3) by ella" and the like. */
export const describeRefund = (payment) => {
  if (payment?.status !== "refunded") return "";
  const how = payment.refundMethod === "cash" ? "Given back in cash at the hall" : "Sent back by GCash";
  const reference = payment.refundReference ? ` (ref ${payment.refundReference})` : "";
  return `${how}${reference}${payment.refundedBy ? ` by ${payment.refundedBy}` : ""}.`;
};
