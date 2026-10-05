/**
 * A table session costs its booked time: the hours chosen when it started plus
 * any time added later. It does not count up minute by minute, so the price only
 * changes when staff add or undo time.
 */
export const getSessionTotal = (table) =>
  Math.round((Number(table?.durationMinutes || 60) / 60) * Number(table?.rate || 0) * 100) / 100;

/** When an occupied table's booked time runs out, in milliseconds; null if not running. */
export const getSessionEnd = (table) =>
  table?.status === "occupied" && table.startTime
    ? Number(table.startTime) + Number(table.durationMinutes || 60) * 60000
    : null;

/** Whole minutes played so far, never more than the booked time. */
export const getPlayedMinutes = (table, now = Date.now()) => {
  if (!table?.startTime) return 0;
  const booked = Number(table.durationMinutes || 60);
  return Math.min(booked, Math.max(0, Math.floor((now - Number(table.startTime)) / 60000)));
};

// Whole pesos without decimals (₱30), anything else with centavos (₱37.50).
export const formatPeso = (amount) => {
  const value = Number(amount || 0);
  const digits = Number.isInteger(value) ? 0 : 2;
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
};
