import { formatEventWhen } from "./eventUpdates";
import { describeReservationTime, formatReservationDate } from "./reservations";

/*
 * The customer's own table bookings and tournament sign-ups, kept in this
 * browser by the key the server gave for each, so the website can show where
 * each stands (api/request_status.php). Nothing kept here names the customer.
 */

export const MY_REQUESTS_KEY = "bcMyRequests";
export const SEEN_REQUESTS_KEY = "bcMyRequestsSeen";
const MAX_SAVED = 10;
const KEEP_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^req-[a-f0-9]{16}\.[a-f0-9]{32}$/;

// Storage can be off (a private window, blocked site data): then nothing is kept.
const readJson = (name, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(name) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (name, value) => {
  try {
    localStorage.setItem(name, JSON.stringify(value));
  } catch {
    // Not kept; this visit still shows it.
  }
};

/** Kept requests, newest first: [{ key, kind, label, savedAt }]. Ones older than KEEP_DAYS are dropped. */
export const readSavedRequests = (now) => {
  const list = readJson(MY_REQUESTS_KEY, []);
  return (Array.isArray(list) ? list : []).filter(
    (entry) =>
      entry &&
      KEY_PATTERN.test(String(entry.key)) &&
      (entry.kind === "reservation" || entry.kind === "tournament") &&
      now - Number(entry.savedAt || 0) < KEEP_DAYS * DAY_MS
  );
};

/** Keeps a request the website just sent; `label` is shown until the server answers. */
export const saveRequest = ({ key, kind, label }, now) => {
  if (!KEY_PATTERN.test(String(key))) return;
  const list = [{ key, kind, label: String(label || ""), savedAt: now }, ...readSavedRequests(now).filter((entry) => entry.key !== key)];
  writeJson(MY_REQUESTS_KEY, list.slice(0, MAX_SAVED));
};

export const forgetRequest = (key, now) => {
  writeJson(MY_REQUESTS_KEY, readSavedRequests(now).filter((entry) => entry.key !== key));
  const seen = readSeenRequests();
  delete seen[key];
  writeJson(SEEN_REQUESTS_KEY, seen);
};

/** What the customer has already seen of each request: { key: signature }. */
export const readSeenRequests = () => {
  const seen = readJson(SEEN_REQUESTS_KEY, {});
  return seen && typeof seen === "object" && !Array.isArray(seen) ? seen : {};
};

export const rememberRequestSeen = (key, signature) => {
  writeJson(SEEN_REQUESTS_KEY, { ...readSeenRequests(), [key]: signature });
};

const peso = (amount) =>
  `₱${Number(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// What happened to a payment that was not kept.
const moneyBack = (payment) => {
  if (!payment) return "";
  const ending = payment.sentToEnding;
  if (payment.status === "refund_due") {
    return `Your GCash ${peso(payment.amount)} will be sent back${ending ? ` to your number ending ${ending}` : ""}.`;
  }
  if (payment.status === "refunded" && payment.refundMethod === "gcash") {
    return `${peso(payment.amount)} was sent back to your GCash${ending ? ` ending ${ending}` : ""}${
      payment.refundReference ? ` (ref ${payment.refundReference})` : ""
    }.`;
  }
  if (payment.status === "refunded") return `${peso(payment.amount)} was given back in cash at the hall.`;
  return "";
};

const TONE_ICONS = {
  waiting: "bi-hourglass-split",
  approved: "bi-check-circle-fill",
  done: "bi-check2-all",
  declined: "bi-x-circle-fill",
};

const STILL_CHECKING = " This updates by itself.";

/** Where a reservation stands, from what api/request_status.php says of it. */
const describeReservation = (view) => {
  const label = `${view.tableName} · ${formatReservationDate(view.date)} · ${describeReservationTime(view)}`;
  const back = moneyBack(view.payment);
  switch (view.status) {
    case "approved":
    case "reserved":
      return { label, tone: "approved", title: "Approved", detail: "See you there! Show your booking text or this page when you arrive." };
    case "arrived":
    case "seated":
      return { label, tone: "done", title: "Checked in", detail: "Enjoy your game!" };
    case "completed":
      return { label, tone: "done", title: "Done", detail: "Thanks for playing at Break & Chill." };
    case "rejected":
      return { label, tone: "declined", title: "Not approved", detail: back || "Message us if you have questions." };
    case "cancelled":
      return { label, tone: "declined", title: "Cancelled", detail: back || "Message us if you have questions." };
    case "expired":
      return { label, tone: "declined", title: "Expired", detail: "The booking time passed without a check-in." };
    default:
      return {
        label,
        tone: "waiting",
        title: "Waiting for approval",
        detail: `Break & Chill is checking your GCash payment.${STILL_CHECKING}`,
      };
  }
};

/** Where a tournament sign-up stands. */
const describeTournament = (view) => {
  const label = `${view.eventName || "Tournament"} · ${formatEventWhen(view.date, view.time)}`;
  const payment = view.payment;
  const back = moneyBack(payment);
  if (view.eventStatus === "cancelled") {
    return { label, tone: "declined", title: "Tournament cancelled", detail: back || "Watch for the next one on our page." };
  }
  if (payment?.status === "held") {
    return {
      label,
      tone: "waiting",
      title: "Waiting for payment check",
      detail: `Break & Chill is checking your GCash entry fee.${STILL_CHECKING}`,
    };
  }
  if (payment && payment.status !== "accepted") {
    return { label, tone: "declined", title: "Not confirmed", detail: back || "Message us if you have questions." };
  }
  if (!view.onList) {
    return { label, tone: "declined", title: "Not on the list", detail: "Message us if you have questions." };
  }
  if (view.eventStatus === "completed") {
    return { label, tone: "done", title: "Tournament finished", detail: "Thanks for playing at Break & Chill." };
  }
  return {
    label,
    tone: "approved",
    title: payment ? "Confirmed" : "Registered",
    detail: payment ? "Your entry fee is accepted. See you there!" : "You are on the player list. See you there!",
  };
};

/**
 * What to show for a request: { label, tone (waiting | approved | done |
 * declined), icon, title, detail, signature }. The signature changes when the
 * customer has something new to see.
 */
export const describeRequest = (view) => {
  const info = view.kind === "tournament" ? describeTournament(view) : describeReservation(view);
  return { ...info, icon: TONE_ICONS[info.tone], signature: `${info.title}|${info.detail}` };
};

/** Before the server has answered: what was just sent. */
export const describeJustSent = (kind, label, paid = true) =>
  kind === "tournament" && !paid
    ? { label, tone: "approved", icon: TONE_ICONS.approved, title: "Registered", detail: "You are on the player list. See you there!", signature: "" }
    : {
        label,
        tone: "waiting",
        icon: TONE_ICONS.waiting,
        title: kind === "tournament" ? "Waiting for payment check" : "Waiting for approval",
        detail: `Break & Chill is checking your GCash ${kind === "tournament" ? "entry fee" : "payment"}.${STILL_CHECKING}`,
        signature: "",
      };
