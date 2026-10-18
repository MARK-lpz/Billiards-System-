import { findTableReservation, formatHoursLabel } from "./reservations";
import { formatPeso, getPlayedMinutes, getSessionTotal } from "./tableSession";
import { getTableOrders, getTablePayments, getUnpaidOrderLines, sumOrders } from "./tableOrders";

/**
 * A table charge is the bill for one table session: the table time and the food
 * and drinks ordered at the table, less what was paid online or in Sales / POS
 * while the customer kept playing. Ending a session from Pool Tables takes what
 * is left there and then; one ended from a booking waits in Sales / POS.
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
  orders: [],
  payments: [],
};

export const formatClockTime = (timestamp) =>
  new Date(Number(timestamp)).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

/**
 * The bill for a session, as of `now`. An online booking was paid in full
 * through GCash before the customer came, so that amount is taken off and only
 * added time is left to pay; a booking is credited once, never twice. What was
 * paid while playing is taken off too: table time by amount, orders line by line.
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
  const payments = getTablePayments(table).map(({ transactionId, amount, time, method, at }) => ({
    transactionId,
    amount: Number(amount || 0),
    time: Number(time || 0),
    method,
    at,
  }));
  const paidEarlier = roundPeso(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const paidTime = payments.reduce((sum, payment) => sum + payment.time, 0);
  // The online payment covered table time only; the orders are paid in full.
  const timeDue = roundPeso(Math.max(0, sessionTotal - prepaidAmount - paidTime));
  const orders = getTableOrders(table).map(({ id, productId, name, category, price, qty, paidQty }) => ({
    id,
    productId,
    name,
    category,
    price: Number(price),
    qty: Number(qty),
    paidQty: Number(paidQty || 0),
  }));
  const ordersTotal = sumOrders(orders);
  const ordersDue = sumOrders(getUnpaidOrderLines(orders));
  const amountDue = roundPeso(timeDue + ordersDue);

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
    payments,
    paidEarlier,
    timeDue,
    orders,
    ordersTotal,
    ordersDue,
    amountDue,
    // Nothing is left to collect when the booking, or payments while playing,
    // already covered the whole stay.
    status: amountDue > 0 ? "unpaid" : "paid",
    paidVia: amountDue > 0 ? null : paidEarlier > 0 ? "earlier" : "online",
    endedBy,
  };
};

/** The notice staff see when a session ends, pointing them to where it is paid. */
export const describeEndedCharge = (charge) =>
  charge.amountDue > 0
    ? `${charge.tableName} session ended. ${formatPeso(charge.amountDue)} is waiting for payment in Sales / POS.`
    : charge.paidEarlier > 0
      ? `${charge.tableName} session ended. Already paid while playing (${formatPeso(charge.paidEarlier)}).`
      : `${charge.tableName} session ended. Already paid online (${formatPeso(charge.sessionTotal)}).`;

/** The pop-up note for an ended session (Toast.jsx); a bill still to pay links to Sales / POS. */
export const endedChargeToast = (charge) => ({
  icon: "bi-receipt",
  title: charge.amountDue > 0 ? "Bill sent to Sales / POS" : "Session ended",
  message: describeEndedCharge(charge),
  action: charge.amountDue > 0 ? "open-pos" : null,
});

/** "Juan · 2 hours · 1:00 PM - 3:05 PM" */
export const describeChargeSession = (charge) =>
  `${charge.customer} · ${formatHoursLabel(charge.bookedMinutes)} · ${formatClockTime(charge.startTime)} - ${formatClockTime(charge.endTime)}`;

// Bills from before orders were added to them held table time only.
const getTimeDue = (charge) => charge.timeDue ?? charge.amountDue;

/** A table charge's time as a line on the running bill. It is one session, so its quantity stays 1. */
export const toTableChargeLine = (charge) => ({
  id: `charge-${charge.id}`,
  chargeId: charge.id,
  name: `${charge.tableName} · Table Time`,
  category: "Pool Table",
  price: getTimeDue(charge),
  qty: 1,
  inventoryItem: false,
  isExtra: false,
  isTableCharge: true,
  detail: describeChargeSession(charge),
});

/** What was ordered at the table, as lines on the same bill. Their stock was
 * taken when they were ordered, so they are not inventory items here. */
export const toChargeOrderLines = (charge) =>
  getUnpaidOrderLines(charge.orders || []).map((line) => ({
    id: `charge-${charge.id}-${line.id}`,
    chargeId: charge.id,
    name: line.name,
    category: line.category,
    price: line.price,
    qty: line.qty,
    inventoryItem: false,
    isExtra: false,
    fromTableCharge: true,
    detail: `Ordered at ${charge.tableName}`,
  }));

// A table's lines on a sale: its time (the reports count it as table time) and
// each order not paid yet (counted as items).
const toSaleLines = (charge, chargeId = charge.id) => [
  {
    name: `${charge.tableName} · Table Time`,
    qty: 1,
    price: getTimeDue(charge),
    category: "Pool Table",
    isExtra: false,
    isTableCharge: true,
    chargeId,
  },
  ...getUnpaidOrderLines(charge.orders || []).map((line) => ({
    name: line.name,
    qty: line.qty,
    price: line.price,
    category: line.category,
    isExtra: false,
    fromTableCharge: true,
    chargeId,
  })),
];

/**
 * The sale for sessions paid at Pool Tables: the one being ended (`charge`), or
 * several on one receipt (`charges`), plus tables joined to the receipt that keep
 * playing (`live`: { table, charge }), whose bill so far is paid like it would be
 * in Sales / POS.
 */
export const createTableSale = ({
  charge,
  charges = charge ? [charge] : [],
  live = [],
  method,
  paymentDetails = {},
  cashier,
  id,
  date,
  time,
}) => {
  const playing = live.map((entry) => ({ ...entry, chargeId: getLiveChargeId(entry.table) }));
  const items = [
    ...charges.flatMap((entry) => toSaleLines(entry)),
    // Time already paid while playing leaves no time line, as on a Sales / POS bill.
    ...playing.flatMap((entry) =>
      toSaleLines(entry.charge, entry.chargeId).filter((line) => !line.isTableCharge || line.price > 0)
    ),
  ];
  const all = [...charges, ...playing.map((entry) => entry.charge)];
  const total = roundPeso(all.reduce((sum, entry) => sum + entry.amountDue, 0));
  const names = all.map((entry) => entry.tableName);
  const customer = all[0]?.customer;
  return {
    id,
    date,
    time,
    cashier,
    items,
    tableCharges: [...charges, ...playing.map((entry) => toLiveReceiptCharge(entry.table, entry.chargeId))],
    billLabel: customer && customer !== "Walk-in" ? `${names.join(" + ")} · ${customer}` : names.join(" + "),
    tableName: names.join(", "),
    customerName: [...new Set(all.map((entry) => entry.customer).filter(Boolean))].join(", "),
    extraCharges: [],
    subtotal: total,
    discLabel: "No Discount",
    discAmt: 0,
    total,
    method,
    paymentDetails,
    status: "completed",
    source: "pool-table",
  };
};

/**
 * A table that keeps playing after its bill so far was paid: the payment is
 * recorded on it (time by amount, every order line in full), as Sales / POS
 * records one.
 */
export const recordTablePayment = (table, { charge, transactionId, method, at, by }) => ({
  ...table,
  payments: [
    ...(table.payments || []),
    { transactionId, amount: charge.amountDue, time: charge.timeDue, method, at, by },
  ],
  orders: (table.orders || []).map((line) =>
    Number(line.orderedAt || 0) >= Number(table.startTime) ? { ...line, paidQty: Number(line.qty || 0) } : line
  ),
});

/** The id that ties a playing table's lines on a Sales / POS bill together. */
export const getLiveChargeId = (table) => `live-${table.id}-${table.startTime}`;

/**
 * What a table still playing owes, as lines on a Sales / POS bill: its unpaid
 * time and each order not yet paid. Paying them records the payment on the
 * table and the customer keeps playing. Each line can come off on its own; it
 * just stays unpaid on the table.
 */
export const toLiveTableLines = (table, charge) => {
  const chargeId = getLiveChargeId(table);
  const liveTable = { tableId: table.id, startTime: table.startTime };
  const time =
    charge.timeDue > 0
      ? [
          {
            id: `${chargeId}-time`,
            chargeId,
            liveTable,
            tableName: charge.tableName,
            name: `${charge.tableName} · Table Time`,
            category: "Pool Table",
            price: charge.timeDue,
            qty: 1,
            inventoryItem: false,
            isExtra: false,
            isTableCharge: true,
            detail: `${charge.customer} · still playing · ${formatHoursLabel(charge.bookedMinutes)} from ${formatClockTime(charge.startTime)}`,
          },
        ]
      : [];
  const orders = getUnpaidOrderLines(charge.orders).map((line) => ({
    id: `${chargeId}-${line.id}`,
    chargeId,
    liveTable,
    liveLineId: line.id,
    tableName: charge.tableName,
    name: line.name,
    category: line.category,
    price: line.price,
    qty: line.qty,
    inventoryItem: false,
    isExtra: false,
    fromTableCharge: true,
    detail: `Ordered at ${charge.tableName} · still playing`,
  }));
  return [...time, ...orders];
};

/**
 * The receipt's note of a table paid while still playing: who, since when, and
 * until when the booked time runs (the lines paid are the sale's own items).
 */
export const toLiveReceiptCharge = (table, chargeId) => ({
  id: chargeId,
  tableId: table.id,
  tableName: table.name || `Table ${table.id}`,
  customer: table.customer || "Walk-in",
  rate: Number(table.rate || 0),
  startTime: Number(table.startTime),
  endsAt: Number(table.startTime) + Number(table.durationMinutes || 60) * 60000,
  bookedMinutes: Number(table.durationMinutes || 60),
  playing: true,
});
