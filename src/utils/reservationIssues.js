import {
  ACTIVE_STATUSES,
  RESERVATION_GRACE_MINUTES,
  describeReservationTime,
  formatReservationDate,
  formatTimeOfDay,
  getOccupiedTableRange,
  getReservationRange,
} from "./reservations";
import { isValidSmsNumber } from "./phone";

/**
 * Checks on each booking at the front desk: what is wrong with it now, and why
 * its guest cannot be seated yet. They use the same rules as the booking forms
 * and the server, so the desk sees a problem before a button refuses it.
 */

export const MAX_PARTY_SIZE = 12;

const normalizeTableName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getTableNumber = (name) => {
  const match = normalizeTableName(name).match(/table\s*(\d+)$/i);
  return match ? Number(match[1]) : null;
};

const sameName = (first, second) =>
  String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();

export const isBookingTable = (table, booking) =>
  String(table.id) === String(booking.tableId ?? booking.table) ||
  normalizeTableName(table.name) === normalizeTableName(booking.tableName) ||
  (getTableNumber(table.name) !== null && getTableNumber(table.name) === getTableNumber(booking.tableName));

export const isGuestPlaying = (table, booking) =>
  table?.status === "occupied" && sameName(table.customer, booking.customerName);

/** How a booking was made: on the website (online) or in person at the desk (walk-in). */
export const getReservationMode = (booking) =>
  String(booking?.source || "").toLowerCase() === "online"
    ? { key: "online", label: "Online", icon: "bi-globe2", detail: "Booked on the website" }
    : { key: "walkin", label: "Walk-in", icon: "bi-person-walking", detail: "Booked at the front desk" };

/** The desk's check on a customer's name: letters, 2 to 40 of them. */
export const getCustomerNameError = (value) => {
  const name = String(value || "").trim();
  if (!name) return "Enter the customer's name.";
  if (name.length < 2) return "The name needs at least 2 letters.";
  if (name.length > 40) return "Keep the name to 40 characters or fewer.";
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) return "Use letters only in the name (spaces, periods, apostrophes and hyphens are fine).";
  return "";
};

export const getPartySizeError = (value) => {
  const size = Number(value);
  if (String(value ?? "").trim() === "" || !Number.isInteger(size) || size < 1) {
    return "Enter how many guests are coming (a whole number, at least 1).";
  }
  if (size > MAX_PARTY_SIZE) return `One table fits up to ${MAX_PARTY_SIZE} guests. Book another table for the rest.`;
  return "";
};

// Why a booking's guest cannot be seated at its table now, or "" when they can.
// Seating takes the table over, so one in use would lose its session and bill.
export const getSeatingBlock = (table, booking) => {
  if (!table || ["available", "reserved"].includes(table.status)) return "";

  const tableName = table.name || booking.tableName;
  if (table.status === "occupied") {
    return `${tableName} is still occupied by ${table.customer || "another customer"}. End that session first, or seat ${booking.customerName} at another table.`;
  }
  if (table.status === "maintenance") return `${tableName} is under maintenance and cannot be used yet.`;
  return `${tableName} is still being cleaned. Set it back to available in Actions first.`;
};

/**
 * `issues`: what needs the desk's attention on this booking, each an "error"
 * (something is wrong or blocked) or a "warning" (worth a look).
 * `seatBlock`: why Assign Table / Seat Customer cannot be used now, or "".
 * `seatHint`: the same reason when nothing else on the row already says it.
 */
export const getReservationIssues = ({ booking, tables = [], reservations = [], now = new Date() }) => {
  const issues = [];
  let seatBlock = "";
  let seatHint = "";
  if (!booking || !ACTIVE_STATUSES.has(booking.status)) return { issues, seatBlock, seatHint };

  const add = (level, text) => issues.push({ level, text });
  // `explained`: an issue or the check-in note already tells staff why.
  const blockSeat = (text, explained = false) => {
    if (seatBlock) return;
    seatBlock = text;
    seatHint = explained ? "" : text;
  };

  const guest = booking.customerName || "The guest";
  const imported = booking.source === "existing";
  const range = getReservationRange(booking);
  const table = tables.find((entry) => isBookingTable(entry, booking)) || null;
  const tableName = table?.name || booking.tableName || "Its table";
  const today = now.toLocaleDateString("en-CA");
  const playing = isGuestPlaying(table, booking);

  // The booking's own details.
  if (!range && !imported) add("error", "The date or time can't be read, so this booking can't be scheduled. Ask the admin to correct it.");
  if (!imported && !isValidSmsNumber(String(booking.phone || ""))) {
    add("warning", "No valid mobile number (09XXXXXXXXX), so the guest gets no text updates.");
  }
  if (getPartySizeError(booking.partySize)) {
    add(
      "warning",
      Number(booking.partySize) > MAX_PARTY_SIZE
        ? `A party of ${booking.partySize} is more than one table fits (${MAX_PARTY_SIZE}).`
        : "The party size is missing."
    );
  }

  // Its table.
  if (!table) {
    const text = `${booking.tableName || "Its table"} is no longer in the table list. Move this booking to another table.`;
    add("error", text);
    blockSeat(text, true);
  } else if (table.status === "maintenance" && !playing) {
    const text = `${tableName} is under maintenance. Move this booking to another table.`;
    add("error", text);
    blockSeat(text, true);
  }

  // Another booking on the same table at the same time.
  const clash =
    range &&
    reservations.find((other) => {
      if (!other || other.id === booking.id || !ACTIVE_STATUSES.has(other.status)) return false;
      if (Number(other.tableId ?? other.table) !== Number(booking.tableId ?? booking.table)) return false;
      const otherRange = getReservationRange(other);
      return otherRange && otherRange.start < range.end && range.start < otherRange.end;
    });
  if (clash) {
    add("error", `Double-booked: ${clash.customerName} also has ${tableName}, ${describeReservationTime(clash)}. Move one of them.`);
  }

  if (booking.status === "seated") {
    if (table && !playing) {
      add("warning", `${tableName} no longer shows ${guest} playing. Mark this booking complete if they have left.`);
    }
    return { issues, seatBlock, seatHint };
  }

  if (booking.status === "pending") {
    if (range && range.end <= now) {
      add("error", `Its time (${describeReservationTime(booking)}) passed without approval. Reject it to clear the slot.`);
    } else if (range && range.start <= now) {
      add("error", `Its time started at ${formatTimeOfDay(range.start)} and it is still not approved. Check the payment now.`);
    } else if (range && booking.date === today && range.start - now <= 60 * 60 * 1000) {
      add("warning", `Starts at ${formatTimeOfDay(range.start)}. Check the payment before the guest arrives.`);
    }
    if (booking.source === "online" && !String(booking.paymentReference || "").trim()) {
      add("warning", "No GCash reference was sent. Find the payment by amount and name.");
    }
    return { issues, seatBlock, seatHint };
  }

  // Approved and arrived bookings: when the guest can be seated.
  if (range) {
    const graceEnd = new Date(range.start.getTime() + RESERVATION_GRACE_MINUTES * 60 * 1000);
    const endedText = booking.date < today ? `${formatReservationDate(booking.date)}, ${formatTimeOfDay(range.end)}` : formatTimeOfDay(range.end);

    if (booking.date > today) {
      blockSeat(`This booking is for ${formatReservationDate(booking.date)}. Seat ${guest} on that day.`, true);
    } else if (booking.status === "arrived" && range.end <= now) {
      const text = `Its booked time ended at ${endedText} before ${guest} was seated. Start a walk-in instead, or cancel it.`;
      add("error", text);
      blockSeat(text, true);
    } else if (booking.status !== "arrived" && now > graceEnd) {
      add("error", `No-show: ${guest} did not check in by ${formatTimeOfDay(graceEnd)}${booking.date < today ? ` on ${formatReservationDate(booking.date)}` : ""}. Cancel it to free ${tableName}.`);
      blockSeat(`The grace period ended at ${formatTimeOfDay(graceEnd)}, so this booking can no longer be seated.`, true);
    }
  }

  // Someone else on the table.
  if (table && !playing && range && booking.date === today && range.end > now) {
    const block = getSeatingBlock(table, booking);
    const due = booking.status === "arrived" || range.start <= now;

    if (block && table.status !== "maintenance") {
      const session = getOccupiedTableRange(table, now);
      const player = table.customer || "Another customer";
      const before = issues.length;
      if (due) add("error", block);
      else if (session?.overrun) {
        add("warning", `${player}'s time on ${tableName} ran out at ${formatTimeOfDay(session.bookedEnd)}, but the session is still open. End it before ${formatTimeOfDay(range.start)}.`);
      } else if (session && session.end > range.start) {
        add("warning", `${player} is on ${tableName} until ${formatTimeOfDay(session.end)}, past this booking's ${formatTimeOfDay(range.start)} start.`);
      }
      blockSeat(block, issues.length > before);
    } else if (!due && table.status === "reserved" && table.customer && !sameName(table.customer, booking.customerName)) {
      // Seated early, this guest would take the table someone else booked first.
      blockSeat(`${tableName} is held for ${table.customer} right now. Seat ${guest} at ${formatTimeOfDay(range.start)}.`);
    }
  }

  return { issues, seatBlock, seatHint };
};
