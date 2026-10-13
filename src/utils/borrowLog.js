/**
 * The counter's Borrow / Return log, kept on this device. Items still out stay
 * until they come back; returned ones show for the rest of the day they came
 * back and are then dropped (each borrow and return is also in the activity log).
 */

export const BORROW_LOG_KEY = "equipmentBorrowLog";

const startOfDay = (now) => {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

// When a record was closed. Older records only carry their borrow time (the id).
export const closedAt = (record) => Number(record.returnedOn ?? record.id) || 0;

export const isOut = (record) => record.status === "borrowed";

export const isClosedToday = (record, now) => !isOut(record) && closedAt(record) >= startOfDay(now);

/** The log without returns from before today. */
export const pruneBorrowLog = (records = [], now) =>
  records.filter((record) => isOut(record) || isClosedToday(record, now));

export const readBorrowLog = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(BORROW_LOG_KEY) || "[]");
    return Array.isArray(stored) ? pruneBorrowLog(stored, Date.now()) : [];
  } catch {
    return [];
  }
};
