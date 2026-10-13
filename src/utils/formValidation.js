// Checks for the staff and guest forms, one validator per form. Each returns
// { field: message } (empty when the form can be saved) or a single message.
// Inventory has its own (inventoryValidation.js); reservations use reservations.js.
import { formatReservationTime } from "./reservations";
import { EQUIPMENT_STATUS_LABELS, getDedicatedTable } from "./equipment";

const sameText = (first, second) =>
  String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();

const peso = (amount) => `₱${amount.toLocaleString("en-PH")}`;
const hasAtMostTwoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

/** A required piece of text: not blank, not too long. */
export const getTextError = (value, label, maxLength = 60) => {
  const text = String(value ?? "").trim();
  if (!text) return `Enter the ${label}.`;
  if (text.length > maxLength) return `Keep the ${label} to ${maxLength} characters or fewer.`;
  return "";
};

/** An amount of money: a number, at most 2 decimals, within [min, max]. */
export const getMoneyError = (value, label, { min = 0, max, allowZero = true } = {}) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `Enter the ${label} as a number.`;
  if (amount < min || (!allowZero && amount === 0)) {
    return allowZero ? `The ${label} cannot be negative.` : `Enter a ${label} above ${peso(min)}.`;
  }
  if (max !== undefined && amount > max) return `The ${label} can be at most ${peso(max)}.`;
  if (!hasAtMostTwoDecimals(amount)) return `Use at most 2 decimal places for the ${label}.`;
  return "";
};

// ---------------------------------------------------------------- Pool tables

export const MAX_TABLE_RATE = 10000;

/** Add / Edit Table: { name, rate, durationMinutes }. */
export const getPoolTableErrors = ({ form, tables = [], editId = null }) => {
  const errors = {};
  const nameError = getTextError(form.name, "table name", 30);
  if (nameError) errors.name = nameError;
  else if (tables.some((table) => table.id !== editId && sameText(table.name, form.name))) {
    errors.name = `${String(form.name).trim()} already exists. Give this table another name.`;
  }

  const rateError = getMoneyError(form.rate, "hourly rate", { min: 0, max: MAX_TABLE_RATE, allowZero: false });
  if (rateError) errors.rate = rateError;

  const minutes = Number(form.durationMinutes);
  if (!Number.isInteger(minutes)) errors.durationMinutes = "Enter the session length in whole minutes.";
  else if (minutes < 15) errors.durationMinutes = "A session is at least 15 minutes.";
  else if (minutes > 720) errors.durationMinutes = "A session can be at most 720 minutes (12 hours).";

  return errors;
};

// The most one Manage Time change may add or undo, so a typo (600 for 60) is caught.
export const MAX_TIME_ADJUSTMENT = 480;

/** Manage Time on a running table: why `value` cannot be added or undone, or "". */
export const getTimeAdjustmentError = (value) => {
  if (String(value ?? "").trim() === "") return "Enter how many minutes.";
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return "Enter the minutes as a number.";
  if (!Number.isInteger(minutes)) return "Use whole minutes.";
  if (minutes < 1) return "Enter at least 1 minute.";
  if (minutes > MAX_TIME_ADJUSTMENT) return `Change at most ${MAX_TIME_ADJUSTMENT} minutes (8 hours) at a time.`;
  return "";
};

// ---------------------------------------------------------------- Events

export const MAX_PRIZE = 1000000;
export const MAX_ENTRY_FEE = 100000;

const isActiveEvent = (event) => ["upcoming", "active"].includes(String(event?.status || "upcoming").toLowerCase());
const ACTIVE_BOOKING = new Set(["pending", "approved", "reserved", "arrived", "seated"]);

/**
 * Create / Edit Tournament: { name, prize, entryFee, tables }. A tournament holds
 * its tables all day, so a table that already has a booking or another
 * tournament that day cannot be given to it.
 */
export const getEventErrors = ({ form, events = [], tables = [], reservations = [] }) => {
  const errors = {};
  const nameError = getTextError(form.name, "event name", 80);
  if (nameError) errors.name = nameError;
  else if (
    form.date &&
    events.some((event) => event.id !== form.id && isActiveEvent(event) && event.date === form.date && sameText(event.name, form.name))
  ) {
    errors.name = `There is already a "${String(form.name).trim()}" on that date.`;
  }

  const prizeError = getMoneyError(form.prize, "prize pool", { max: MAX_PRIZE });
  if (prizeError) errors.prize = prizeError;
  const feeError = getMoneyError(form.entryFee, "entry fee", { max: MAX_ENTRY_FEE });
  if (feeError) errors.entryFee = feeError;

  if (form.date && (form.tables || []).length) {
    const nameOf = (tableId) => tables.find((table) => table.id === tableId || table.name === tableId)?.name || `Table ${tableId}`;
    const sameTable = (tableId, other) =>
      String(other) === String(tableId) || sameText(other, nameOf(tableId));
    const problems = [];
    (form.tables || []).forEach((tableId) => {
      const booking = reservations.find(
        (reservation) =>
          ACTIVE_BOOKING.has(reservation.status) &&
          reservation.date === form.date &&
          (sameTable(tableId, reservation.tableId ?? reservation.table) || sameText(reservation.tableName, nameOf(tableId)))
      );
      if (booking) {
        problems.push(`${nameOf(tableId)} is booked that day (${booking.customerName}${booking.time ? ` at ${formatReservationTime(booking.time)}` : ""})`);
        return;
      }
      const other = events.find(
        (event) =>
          event.id !== form.id &&
          isActiveEvent(event) &&
          event.date === form.date &&
          (event.tables || []).some((assigned) => sameTable(tableId, assigned))
      );
      if (other) problems.push(`${nameOf(tableId)} is already given to ${other.name || "another tournament"}`);
    });
    if (problems.length) errors.tables = `${problems.join("; ")}. Choose other tables or another date.`;
  }

  return errors;
};

// ---------------------------------------------------------------- Equipment

/** Register / Edit Equipment: { name, previousMaintenance, lastMaintenance }. */
export const getEquipmentErrors = ({ form, equipment = [], editId = null, today, tables = [] }) => {
  const errors = {};
  const nameError = getTextError(form.name, "equipment name");
  if (nameError) errors.name = nameError;
  else if (equipment.some((item) => item.id !== editId && sameText(item.name, form.name))) {
    errors.name = `${String(form.name).trim()} is already registered. Use a different name or number (e.g. Cue Stick #4).`;
  }

  // An item is dedicated to one table that still exists, or kept as a spare.
  const tableId = form.tableId ?? "";
  if (tableId !== "" && tableId !== null && !tables.some((table) => String(table.id) === String(tableId))) {
    errors.tableId = "That table is no longer in the list. Choose another table or keep it as a spare.";
  }

  const previous = String(form.previousMaintenance || "");
  const latest = String(form.lastMaintenance || "");
  if (previous && previous > today) errors.previousMaintenance = "This date has not happened yet.";
  if (latest && latest > today) errors.lastMaintenance = "This date has not happened yet.";
  if (!errors.previousMaintenance && !errors.lastMaintenance && previous && latest && previous > latest) {
    errors.previousMaintenance = "The previous maintenance must be on or before the latest one.";
  }

  return errors;
};

/** Replace Equipment: { name, date } of the new item taking `item`'s place. */
export const getReplaceErrors = ({ form, item, equipment = [], today }) => {
  const errors = {};
  const nameError = getTextError(form.name, "new item's name", 80);
  if (nameError) errors.name = nameError;
  else if (equipment.some((entry) => String(entry.id) !== String(item?.id) && sameText(entry.name, form.name))) {
    errors.name = `${String(form.name).trim()} is already registered. Use a different name or number.`;
  }

  const date = String(form.date || "");
  if (!date) errors.date = "Enter the date the new one was put in service.";
  else if (date > today) errors.date = "This date has not happened yet.";

  return errors;
};

/**
 * Borrow / Return, Log Borrow: { itemType, itemCode, borrower }. Only a spare in
 * service can be lent: a table's own set stays with it, and an item that is out,
 * reported, damaged or under repair stays at the counter. `item` is the
 * registered item the name matched, if any.
 */
export const getBorrowErrors = ({ form, equipment = [], tables = [], records = [], reportedItemIds = new Set() }) => {
  const errors = {};
  const code = String(form.itemCode || "").trim();
  const item = code ? equipment.find((entry) => sameText(entry.name, code)) || null : null;
  // A table's own set stays with it; its spares can be lent.
  const itemTable = item ? getDedicatedTable(item, tables) : null;
  const stillOut = item
    ? records.find((record) => record.status === "borrowed" && sameText(record.itemCode, item.name))
    : null;

  if (!code) errors.itemCode = "Enter the spare to lend. Pick one from the list.";
  else if (!item) {
    errors.itemCode = `"${code}" is not a registered spare. Pick one from the list, or ask the admin to register it in Equipment.`;
  } else if (itemTable) {
    errors.itemCode = `${item.name} is dedicated to ${itemTable.name} and stays with it. Lend a spare instead.`;
  } else if (item.status !== "active") {
    errors.itemCode = `${item.name} is marked ${(EQUIPMENT_STATUS_LABELS[item.status] || item.status).toLowerCase()}. It can't be lent until the admin puts it back in service.`;
  } else if (item.condition === "damaged") {
    errors.itemCode = `${item.name} is marked damaged. Lend another spare.`;
  } else if (reportedItemIds.has(String(item.id))) {
    errors.itemCode = `${item.name} has an open issue report. It can't be lent until the admin resolves it.`;
  } else if (stillOut) {
    errors.itemCode = `${item.name} is still out with ${stillOut.borrower} (since ${stillOut.borrowedAt}). Log its return first.`;
  } else if (item.type !== form.itemType) {
    errors.itemType = `${item.name} is a ${item.type}, not a ${form.itemType}. Change the type or pick another item.`;
  }

  const borrower = String(form.borrower || "").trim();
  if (!borrower) errors.borrower = "Enter the name of the player borrowing it.";
  else if (borrower.length < 2) errors.borrower = "The name needs at least 2 letters.";
  else if (borrower.length > 40) errors.borrower = "Keep the name to 40 characters or fewer.";
  else if (!/^[\p{L}][\p{L} .'-]*$/u.test(borrower)) {
    errors.borrower = "Use letters only in the name (spaces, periods, apostrophes and hyphens are fine).";
  }

  return { errors, item };
};

// ---------------------------------------------------------------- Accounts

/** Why a username cannot be used, or "". Letters, numbers, dot, dash and underscore only. */
export const getUsernameError = (value, accounts = [], editId = null) => {
  const username = String(value || "").trim();
  if (!username) return "Enter a username.";
  if (username.length < 3) return "A username needs at least 3 characters.";
  if (username.length > 30) return "Keep the username to 30 characters or fewer.";
  if (!/^[A-Za-z0-9._-]+$/.test(username)) return "Use only letters, numbers, dots, dashes and underscores (no spaces).";
  if (accounts.some((account) => String(account.id) !== String(editId) && sameText(account.username, username))) {
    return `${username} is already taken. Choose another username.`;
  }
  return "";
};

// ---------------------------------------------------------------- Guest players

/** A player's first or last name: letters, spaces, dots, dashes and apostrophes. */
export const getPersonNameError = (value, label) => {
  const name = String(value || "").trim();
  if (!name) return `Enter your ${label}.`;
  if (name.length < 2) return `Your ${label} needs at least 2 letters.`;
  if (name.length > 40) return `Keep your ${label} to 40 characters or fewer.`;
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) return `Use letters only in your ${label}.`;
  return "";
};

export const MIN_PLAYER_AGE = 10;
export const MAX_PLAYER_AGE = 80;

export const getAgeError = (value) => {
  if (String(value ?? "").trim() === "") return "Enter your age.";
  const age = Number(value);
  if (!Number.isInteger(age)) return "Enter your age in whole years.";
  if (age < MIN_PLAYER_AGE || age > MAX_PLAYER_AGE) return `Players must be ${MIN_PLAYER_AGE} to ${MAX_PLAYER_AGE} years old.`;
  return "";
};
