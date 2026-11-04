/**
 * A tournament's player limit and entry fee, as the admin set them up
 * (api/events.php): how many players it takes (`maxPlayers`, 0 for no limit),
 * how the fee may be paid (`paymentMethods`), and the fees taken at the
 * counter (`entryFees`, staff only). Fees paid on the website are online
 * payments (utils/onlinePayments.js); each player's status reads both.
 */
import { findPlayerPayment } from "./onlinePayments";
import { validateReference } from "./paymentReference";

export const MAX_TOURNAMENT_PLAYERS = 512;

export const ENTRY_FEE_METHODS = [
  { id: "online", label: "GCash on the website", short: "GCash online", icon: "bi-globe2" },
  { id: "cash", label: "Cash at the counter", short: "Cash", icon: "bi-cash-coin" },
  { id: "gcash", label: "GCash at the counter", short: "GCash", icon: "bi-phone" },
];

const ALL_METHODS = ENTRY_FEE_METHODS.map((method) => method.id);
const methodOf = (id) => ENTRY_FEE_METHODS.find((method) => method.id === id);

const normalize = (text) => String(text || "").trim().toLowerCase().replace(/\s+/g, " ");

// "Juan Cruz (Team Cue, Walk-in)" -> "Juan Cruz".
export const playerNameOf = (label) => String(label || "").replace(/\s*\(.*\)\s*$/, "").trim();

export const hasEntryFee = (event) => Number(event?.entryFee) > 0;

// ── Players ───────────────────────────────────────────────────────────
export const getMaxPlayers = (event) => Math.max(0, Math.floor(Number(event?.maxPlayers) || 0));
export const countPlayers = (event) => (event?.participants || []).length;

export const isEventFull = (event) => {
  const max = getMaxPlayers(event);
  return max > 0 && countPlayers(event) >= max;
};

/** "12 / 16 players", or "12 players" with no limit. */
export const describePlayers = (event) => {
  const count = countPlayers(event);
  const max = getMaxPlayers(event);
  return max ? `${count} / ${max} players` : `${count} ${count === 1 ? "player" : "players"}`;
};

/** A few places left: 3 or fewer, and not full. */
export const isAlmostFull = (event) => {
  const max = getMaxPlayers(event);
  const left = max - countPlayers(event);
  return max > 0 && left > 0 && left <= 3;
};

/** "4 slots left", "Full", or "" with no limit. */
export const describeSlots = (event) => {
  const max = getMaxPlayers(event);
  if (!max) return "";
  const left = Math.max(0, max - countPlayers(event));
  return left ? `${left} ${left === 1 ? "slot" : "slots"} left` : "Full";
};

// ── How the fee is paid ──────────────────────────────────────────────
/** The ways the admin left on; all of them for a tournament set up before there was a choice. */
export const getPaymentMethods = (event) => {
  const chosen = Array.isArray(event?.paymentMethods) ? ALL_METHODS.filter((id) => event.paymentMethods.includes(id)) : [];
  return chosen.length ? chosen : ALL_METHODS;
};

/** Cash and GCash at the counter, whichever this tournament takes. */
export const getCounterMethods = (event) =>
  hasEntryFee(event) ? getPaymentMethods(event).filter((id) => id !== "online") : [];

/** Players may sign up on the website: free, or paid by GCash there. */
export const takesWebsiteSignUp = (event) => !hasEntryFee(event) || getPaymentMethods(event).includes("online");

/** The counter may sign up walk-ins: free, or the fee is taken at the counter. */
export const takesCounterSignUp = (event) => !hasEntryFee(event) || getCounterMethods(event).length > 0;

/** "GCash on the website · Cash at the counter" */
export const describePaymentMethods = (event) => getPaymentMethods(event).map((id) => methodOf(id).label).join(" · ");

/**
 * How a player pays, said for the website: "GCash online · Cash or GCash in
 * person", "Cash in person", ... ("" for a free tournament).
 */
export const describeWebsitePayment = (event) => {
  if (!hasEntryFee(event)) return "";
  const hall = getCounterMethods(event).map((id) => (id === "cash" ? "Cash" : "GCash"));
  return [
    getPaymentMethods(event).includes("online") ? "GCash online" : "",
    hall.length ? `${hall.join(" or ")} in person` : "",
  ]
    .filter(Boolean)
    .join(" · ");
};

/** The fee may also be paid in cash in person (for "Prefer to pay in cash?" on the website). */
export const takesCashAtHall = (event) => getCounterMethods(event).includes("cash");

/** The first way this tournament takes at the counter, or "unpaid" when there is none. */
export const firstCounterMethod = (event) => getCounterMethods(event)[0] || "unpaid";

/**
 * Whether a fee taken at the counter, as chosen ({ method, reference }), can be
 * saved: { ready, error, entryFee }. `entryFee` is what the server is sent.
 */
export const checkEntryFee = (event, value, usedReferences = []) => {
  if (value.method === "unpaid") return { ready: true, error: "", entryFee: { method: "unpaid" } };
  if (!getCounterMethods(event).includes(value.method)) {
    return { ready: false, error: "Choose how the entry fee was paid.", entryFee: null };
  }
  if (value.method === "cash") return { ready: true, error: "", entryFee: { method: "cash" } };
  const check = validateReference(value.reference, usedReferences);
  return {
    ready: check.isValid,
    error: check.error || (check.digits ? "" : "Type the reference number from the player's GCash receipt."),
    entryFee: check.isValid ? { method: "gcash", reference: check.digits } : null,
  };
};

// ── Each player's fee ────────────────────────────────────────────────
export const findEntryFee = (event, label) =>
  (Array.isArray(event?.entryFees) ? event.entryFees : []).find((fee) => normalize(fee.participant) === normalize(label)) || null;

const ONLINE_STATES = {
  held: { key: "check", label: "To check", tone: "amber" },
  accepted: { key: "paid", label: "Paid · GCash online", tone: "green" },
  refund_due: { key: "refund", label: "Refund due", tone: "red" },
  refunded: { key: "refunded", label: "Refunded", tone: "grey" },
};

/**
 * Where one player's entry fee stands: { key, label, tone, method, amount,
 * fee, payment }. `key` is free, paid, check (paid online, not checked yet),
 * refund, refunded or unpaid.
 */
export const getPlayerFee = (event, label, payments = []) => {
  if (!hasEntryFee(event)) return { key: "free", label: "Free", tone: "grey", amount: 0 };
  const payment = findPlayerPayment(payments, event.id, label);
  if (payment && ONLINE_STATES[payment.status]) {
    return { ...ONLINE_STATES[payment.status], method: "online", amount: Number(payment.amount) || 0, payment };
  }
  const fee = findEntryFee(event, label);
  if (fee) {
    return { key: "paid", label: `Paid · ${methodOf(fee.method)?.short || "Counter"}`, tone: "green", method: fee.method, amount: Number(fee.amount) || 0, fee };
  }
  return { key: "unpaid", label: "Unpaid", tone: "red", amount: 0 };
};

/** What a tournament has collected so far, and how many still owe or wait to be checked. */
export const summarizeEntryFees = (event, payments = []) => {
  const summary = { collected: 0, byMethod: { online: 0, cash: 0, gcash: 0 }, paid: 0, unpaid: 0, check: 0, refund: 0 };
  if (!hasEntryFee(event)) return summary;
  (event.participants || []).forEach((label) => {
    const fee = getPlayerFee(event, label, payments);
    if (fee.key === "paid") {
      summary.paid += 1;
      summary.collected += fee.amount;
      summary.byMethod[fee.method] = (summary.byMethod[fee.method] || 0) + fee.amount;
    } else if (fee.key in summary) {
      summary[fee.key] += 1;
    }
  });
  return summary;
};

// ── The sale for a fee taken at the counter ──────────────────────────
const todayStr = () => new Date().toLocaleDateString("en-CA");
const nowStr = () => new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

/**
 * The fee as a sale, so the Sales Report and the counter's history count it
 * like any other: one "Entry fee" line, paid in cash or by GCash.
 */
export const createEntryFeeSale = ({ event, participant, method, reference = "", saleId, cashier }) => {
  const fee = Number(event.entryFee) || 0;
  const name = playerNameOf(participant);
  return {
    id: Number(saleId),
    date: todayStr(),
    time: nowStr(),
    cashier,
    items: [{ name: `Entry fee · ${event.name}`, qty: 1, price: fee, category: "Tournament", isExtra: false }],
    billLabel: `${name} · ${event.name}`,
    tableName: "",
    customerName: name,
    extraCharges: [],
    subtotal: fee,
    discLabel: "No Discount",
    discAmt: 0,
    total: fee,
    method: method === "gcash" ? "ewallet" : "cash",
    paymentDetails:
      method === "gcash" ? { referenceNumber: reference, referenceVerified: true } : { cashReceived: fee, change: 0 },
    status: "completed",
    source: "tournament",
  };
};
