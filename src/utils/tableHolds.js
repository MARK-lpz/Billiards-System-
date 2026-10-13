import { RESERVATION_GRACE_MINUTES, findTableReservation, getReservationRange } from "./reservations";
import { getReservationIssues, isBookingTable } from "./reservationIssues";

/**
 * When a booked table shows as Reserved. It used to turn Reserved the moment a
 * booking was approved, even one days away, which kept walk-ins off the table
 * until then. Now a booking holds its table only from shortly before its start
 * until the guest checks in, or until the grace period runs out (a no-show).
 * Before that the table stays open, and walk-ins there are already cut short
 * of the booking (getWalkInLimit).
 */

export const RESERVATION_HOLD_MINUTES = 30;

const MINUTE = 60 * 1000;
const HOLDING_STATUSES = new Set(["approved", "reserved", "arrived"]);

const hasValue = (value) => value !== null && value !== undefined && value !== "";

// A booking names its table by id; only one without an id is matched by name.
const isTableOf = (table, booking) => {
  const bookedTable = booking.tableId ?? booking.table;
  return hasValue(bookedTable) ? String(bookedTable) === String(table.id) : isBookingTable(table, booking);
};

// From when to when (ms) a booking holds its table, or null when its time can't be read.
const getHoldWindow = (booking) => {
  const range = getReservationRange(booking);
  if (!range) return null;

  return {
    from: range.start.getTime() - RESERVATION_HOLD_MINUTES * MINUTE,
    // A guest who has arrived keeps the table for their booking; one who has not
    // loses it when the grace period ends, as the server expires them then.
    until:
      booking.status === "arrived"
        ? range.end.getTime()
        : range.start.getTime() + RESERVATION_GRACE_MINUTES * MINUTE,
  };
};

/** Whether a booking holds its table at `now`. One with no readable time holds it, as before. */
export const isHoldingTable = (booking, now = new Date()) => {
  if (!HOLDING_STATUSES.has(booking?.status)) return false;

  const span = getHoldWindow(booking);
  return !span || (now.getTime() >= span.from && now.getTime() <= span.until);
};

/**
 * A table's confirmed bookings that are still ahead or holding it now, earliest
 * first, each with `holdsFrom`: the moment the table turns Reserved for it.
 */
export const getUpcomingBookings = (table, reservations = [], now = new Date()) =>
  reservations
    .filter((booking) => booking && HOLDING_STATUSES.has(booking.status) && isTableOf(table, booking))
    .map((booking) => ({ booking, span: getHoldWindow(booking) }))
    .filter(({ span }) => !span || now.getTime() <= span.until)
    .sort((first, second) => (first.span?.from ?? 0) - (second.span?.from ?? 0))
    .map(({ booking, span }) => ({ ...booking, holdsFrom: span ? new Date(span.from) : null }));

/**
 * Whether a table belongs under the Reserved filter: held right now, or booked
 * for later while it stays open for walk-ins until then.
 */
export const hasTableReservation = (table, reservations = [], now = new Date()) =>
  table.status === "reserved" || getUpcomingBookings(table, reservations, now).length > 0;

/** The booking a table is held for right now (the earliest, if two overlap), or null. */
export const getTableHold = (table, reservations = [], now = new Date()) =>
  reservations
    .filter((booking) => booking && isTableOf(table, booking) && isHoldingTable(booking, now))
    .sort((first, second) => (getReservationRange(first)?.start ?? 0) - (getReservationRange(second)?.start ?? 0))[0] ||
  null;

const RELEASED_FIELDS = {
  status: "available",
  startTime: null,
  customer: "",
  reservationId: null,
  reservationDate: "",
  reservationTime: "",
};

/**
 * Tables with each booking's hold applied: a free table is marked Reserved once
 * its booking is due, and a Reserved one goes back to free when its booking is
 * not due yet, is over, or was cancelled. A table in use, being cleaned or under
 * maintenance is left alone. Returns the same array when nothing changes.
 */
export const applyTableHolds = (tables, reservations = [], now = new Date()) => {
  let changed = false;

  const nextTables = tables.map((table) => {
    if (!["available", "reserved"].includes(table.status)) return table;

    const hold = getTableHold(table, reservations, now);
    if (hold) {
      const details = {
        status: "reserved",
        startTime: null,
        customer: hold.customerName || hold.customer || "",
        reservationId: hold.id,
        reservationDate: hold.date || "",
        reservationTime: hold.time || "",
      };
      const alreadyHeld =
        table.status === "reserved" &&
        !table.startTime &&
        String(table.reservationId) === String(hold.id) &&
        table.customer === details.customer &&
        table.reservationDate === details.reservationDate &&
        table.reservationTime === details.reservationTime;
      if (alreadyHeld) return table;

      changed = true;
      return { ...table, ...details };
    }

    // Reserved for a booking that does not hold it now. A Reserved table tied to
    // no booking at all (sample data) is left as it is.
    const heldForBooking =
      table.status === "reserved" &&
      (hasValue(table.reservationId) ||
        hasValue(table.reservationDate) ||
        hasValue(table.reservationTime) ||
        Boolean(findTableReservation(table, reservations)));
    if (!heldForBooking) return table;

    changed = true;
    return { ...table, ...RELEASED_FIELDS };
  });

  return changed ? nextTables : tables;
};

/**
 * Why the guest a Reserved table is held for cannot be checked in now, or "".
 * The same rule as Assign Table on the Reservations desk: not on another day,
 * and not once the grace period has run out.
 */
export const getCheckInBlock = ({ table, reservations = [], now = new Date() }) => {
  if (table?.status !== "reserved") return "";

  const booking = findTableReservation(table, reservations);
  if (!booking) return "";
  return getReservationIssues({ booking, tables: [table], reservations, now }).seatBlock;
};
