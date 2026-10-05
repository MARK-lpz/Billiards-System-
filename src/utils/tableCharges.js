import { findTableReservation, formatHoursLabel } from "./reservations";
import { formatPeso, getPlayedMinutes, getSessionTotal } from "./tableSession";

/**
 * A table charge is the bill for one finished table session. Ending a session
 * records one, and the customer pays it in Sales / POS together with any food
 * and drinks, so both end up on the same receipt.
 */

export const TABLE_CHARGES_STORAGE_KEY = "tableCharges";

// Only a booking whose GCash payment was checked by staff counts as paid.
const PREPAID_STATUSES = ["approved", "reserved", "arrived", "seated"];

const sameName = (first, second) =>
  String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();

const roundPeso = (value) => Math.round(value * 100) / 100;

/** What a table goes back to when its session ends. The booking link is cleared
 * too, so the next walk-in at this table is not taken for that booking. */
export const ENDED_SESSION_FIELDS = {
  status: "available",
  startTime: null,
  customer: "",
  addedMinutes: 0,
  reservationId: null,
  reservationDate: "",
  reservationTime: "",
};

export const formatClockTime = (timestamp) =>
  new Date(Number(timestamp)).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

/**
 * The bill for a session that is ending now. An online booking was paid in full
 * through GCash before the customer came, so that amount is taken off and only
 * added time is left to pay. A booking is credited once, never twice.
 */
export const createTableCharge = ({ table, reservations = [], tableCharges = [], endedBy, now }) => {
  if (!table?.startTime) return null;

  const sessionTotal = getSessionTotal(table);
  const reservation = findTableReservation(table, reservations);
  const alreadyCredited =
    reservation && tableCharges.some((charge) => String(charge.prepaid?.reservationId) === String(reservation.id));
  const paidOnline =
    Boolean(reservation) &&
    reservation.source === "online" &&
    Number(reservation.paymentAmount) > 0 &&
    PREPAID_STATUSES.includes(reservation.status) &&
    sameName(reservation.customerName, table.customer) &&
    !alreadyCredited;
  const prepaidAmount = paidOnline ? Math.min(sessionTotal, Number(reservation.paymentAmount)) : 0;
  const amountDue = roundPeso(sessionTotal - prepaidAmount);

  return {
    id: `table-${table.id}-${now}`,
    tableId: table.id,
    tableName: table.name || `Table ${table.id}`,
    customer: table.customer || "Walk-in",
    rate: Number(table.rate || 0),
    startTime: Number(table.startTime),
    endTime: now,
    bookedMinutes: Number(table.durationMinutes || 60),
    addedMinutes: Number(table.addedMinutes || 0),
    playedMinutes: getPlayedMinutes(table, now),
    sessionTotal,
    prepaid: paidOnline
      ? {
          amount: prepaidAmount,
          reservationId: reservation.id,
          reference: reservation.paymentReference ? `••••${String(reservation.paymentReference).slice(-4)}` : "",
        }
      : null,
    amountDue,
    // Nothing is left to collect when the booking already covered the whole stay.
    status: amountDue > 0 ? "unpaid" : "paid",
    paidVia: amountDue > 0 ? null : "online",
    endedBy,
  };
};

/** The notice staff see when a session ends, pointing them to where it is paid. */
export const describeEndedCharge = (charge) =>
  charge.amountDue > 0
    ? `${charge.tableName} session ended. ${formatPeso(charge.amountDue)} is waiting for payment in Sales / POS.`
    : `${charge.tableName} session ended. Already paid online (${formatPeso(charge.sessionTotal)}).`;

/** "Juan · 2 hours · 1:00 PM - 3:05 PM" */
export const describeChargeSession = (charge) =>
  `${charge.customer} · ${formatHoursLabel(charge.bookedMinutes)} · ${formatClockTime(charge.startTime)} - ${formatClockTime(charge.endTime)}`;

/** A table charge as a line on the running bill. It is one session, so its quantity stays 1. */
export const toTableChargeLine = (charge) => ({
  id: `charge-${charge.id}`,
  chargeId: charge.id,
  name: `${charge.tableName} · Table Time`,
  category: "Pool Table",
  price: charge.amountDue,
  qty: 1,
  inventoryItem: false,
  isExtra: false,
  isTableCharge: true,
  detail: describeChargeSession(charge),
});
