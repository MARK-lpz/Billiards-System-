import { getSessionEnd } from "./tableSession";

// What staff have opened in the bell's Tables section, per role (see useTimeUpSection).
export const SEEN_TIME_UP_KEYS = { admin: "seenTimeUpAdmin", employee: "seenTimeUpEmployee" };

// One alert per run-out: adding time and running out again counts as a new one.
export const timeUpKey = (table) => `${table.id}:${table.startTime}:${table.durationMinutes}`;

/**
 * The tables whose booked time is up but whose session has not been ended, the
 * longest over first: { table, endsAt, key }.
 */
export const getTimeUpTables = (tables = [], now) =>
  tables
    .map((table) => ({ table, endsAt: getSessionEnd(table), key: timeUpKey(table) }))
    .filter((entry) => entry.endsAt !== null && entry.endsAt <= now)
    .sort((first, second) => first.endsAt - second.endsAt);
