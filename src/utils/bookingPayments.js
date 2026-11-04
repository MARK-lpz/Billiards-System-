/**
 * A booking made at the hall is paid first, in full: the table's rate times the
 * hours, in cash or by GCash, through Sales / POS's own payment window. The
 * money is a sale on the day it was taken, so the Sales Report counts it there,
 * and the bill at the end of the session takes it off (tableCharges.js).
 *
 * Cancelling asks what happens to it. A sale is never changed once made, so
 * money given back is a sale of its own, below zero, on the day it left.
 */
import { needsRefundChoice } from "./onlinePayments";
import { REFERENCE_MIN_DIGITS } from "./paymentReference";
import { describeReservationTime, formatHoursLabel, formatReservationDate } from "./reservations";

const todayStr = () => new Date().toLocaleDateString("en-CA");
const nowStr = () => new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

const roundPeso = (value) => Math.round(value * 100) / 100;

export const getBookingTotal = (table, minutes) =>
  roundPeso(((Number(table?.rate) || 0) * (Number(minutes) || 0)) / 60);

/** Money taken at the desk for this booking (a website booking's GCash is an online payment). */
export const isDeskPaid = (booking) =>
  String(booking?.source || "").toLowerCase() !== "online" && Number(booking?.paymentAmount) > 0;

const paidInCash = (booking) => booking?.paymentMethod === "cash";
const refundLabel = (method) => (method === "cash" ? "in cash" : "by GCash");

/** "in cash" or "by GCash". */
export const describePaidBy = (booking) => refundLabel(paidInCash(booking) ? "cash" : "gcash");

/** For the status chip (PaymentStatusChip.jsx); null for a booking with no desk payment. */
export const deskPaymentState = (booking) => {
  if (!isDeskPaid(booking)) return null;
  if (booking.paymentRefund) {
    return { label: "Payment given back", short: "Given back", tone: "refunded", icon: "bi-check2-all" };
  }
  const paidBy = paidInCash(booking) ? "Cash" : "GCash";
  return { label: `Paid · ${paidBy}`, short: `Paid · ${paidBy}`, tone: "accepted", icon: "bi-check-circle-fill" };
};

const bookingSale = ({ booking, lineName, total, method, paymentDetails, saleId, cashier }) => ({
  id: Number(saleId),
  date: todayStr(),
  time: nowStr(),
  cashier,
  items: [
    {
      name: lineName,
      qty: 1,
      price: total,
      category: "Pool Table",
      isExtra: false,
      isTableCharge: true,
      detail: `${formatReservationDate(booking.date)}, ${describeReservationTime(booking)}`,
    },
  ],
  billLabel: `${booking.tableName} · ${booking.customerName}`,
  tableName: booking.tableName,
  customerName: booking.customerName,
  extraCharges: [],
  subtotal: total,
  discLabel: "No Discount",
  discAmt: 0,
  total,
  method,
  paymentDetails,
  status: "completed",
  source: "reservation",
  reservationId: booking.id,
});

/** The booking's payment as a sale: `method` and `details` as the payment window gives them. */
export const createBookingSale = ({ booking, method, details, saleId, cashier }) =>
  bookingSale({
    booking,
    lineName: `${booking.tableName} · Reservation (${formatHoursLabel(booking.durationMinutes)})`,
    total: Number(booking.paymentAmount),
    method,
    paymentDetails: details,
    saleId,
    cashier,
  });

/** Money given back for a cancelled booking, as a sale below zero. */
export const createBookingRefundSale = ({ booking, refundMethod, refundReference = "", saleId, cashier }) =>
  bookingSale({
    booking,
    lineName: `${booking.tableName} · Reservation refund`,
    total: -Number(booking.paymentAmount),
    method: refundMethod === "cash" ? "cash" : "ewallet",
    paymentDetails: refundMethod === "cash" ? {} : { referenceNumber: refundReference },
    saleId,
    cashier,
  });

// ── What happens to the money when a booking is cancelled ────────────
// `how` is "refund" or "keep" for a website booking's accepted payment, and
// "cash", "gcash" or "keep" for one taken at the desk. `reference` is the GCash
// refund's. The cancel windows keep this and send toRefundExtra's answer.
export const NO_REFUND_CHOICE = { how: "", reference: "" };

const asksDesk = (booking) => isDeskPaid(booking) && !booking.paymentRefund;

/** Cancelling this booking has to say what happens to its payment. */
export const asksRefund = (booking, payment) => asksDesk(booking) || needsRefundChoice(payment);

/** The question is answered (or there is none). */
export const refundChoiceReady = (booking, payment, choice) => {
  if (!asksRefund(booking, payment)) return true;
  if (choice.how === "gcash") return choice.reference.length >= REFERENCE_MIN_DIGITS;
  return Boolean(choice.how);
};

/** What goes with the cancel (see utils/reservationApi.js). */
export const toRefundExtra = (booking, payment, choice) => {
  if (!asksRefund(booking, payment)) return {};
  if (!asksDesk(booking)) return { refundPayment: choice.how === "refund" };
  if (choice.how === "keep") return { refundPayment: false };
  return {
    refundPayment: true,
    refundMethod: choice.how,
    ...(choice.how === "gcash" ? { refundReference: choice.reference } : {}),
  };
};

/** " The payment is kept." and the like, for the Audit Trail. "" when nothing was asked. */
export const describeRefundExtra = (booking, extra) => {
  if (!("refundPayment" in extra)) return "";
  if (!isDeskPaid(booking)) {
    return extra.refundPayment ? " The GCash payment is listed to send back." : " The GCash payment is kept.";
  }
  return extra.refundPayment ? ` The payment was given back ${refundLabel(extra.refundMethod)}.` : " The payment is kept.";
};
