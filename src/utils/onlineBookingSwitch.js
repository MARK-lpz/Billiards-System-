import { DEFAULT_RESERVATION_HOURS } from "./reservations";

// The Online reservations switch (backend/config/reservation_settings.php):
// why it was closed and until when, as the staff choose it and as guests read it.

export const CLOSE_REASONS = [
  { value: "fully-booked", label: "Fully booked", icon: "bi-calendar-x" },
  { value: "private-event", label: "Private event", icon: "bi-door-closed" },
  { value: "tournament", label: "Tournament", icon: "bi-trophy" },
  { value: "maintenance", label: "Maintenance", icon: "bi-tools" },
  { value: "other", label: "Other", icon: "bi-three-dots" },
];

export const CLOSE_NOTE_MAX = 160;

// What guests are told; "Other" (its note is for the staff) says no more than "paused".
const GUEST_REASONS = {
  "fully-booked": "Online reservations are paused: we're fully booked.",
  "private-event": "Online reservations are paused for a private event.",
  tournament: "Online reservations are paused for a tournament.",
  maintenance: "Online reservations are paused for maintenance.",
};

const MANILA = "Asia/Manila";

const manilaDay = (date) => date.toLocaleDateString("en-CA", { timeZone: MANILA });

const manilaMinutes = (date) => {
  const [hours, minutes] = date
    .toLocaleTimeString("en-GB", { timeZone: MANILA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
};

const minutesOf = (time) => {
  const [hours, minutes] = String(time).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const clock = (date) => date.toLocaleTimeString("en-PH", { timeZone: MANILA, hour: "numeric", minute: "2-digit" });

/** "2:15 PM" today, "Tomorrow, 10:00 AM", or "Oct 28, 10:00 AM", Manila time. */
export const formatSwitchTime = (value, now = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (manilaDay(date) === manilaDay(now)) return clock(date);
  if (manilaDay(date) === manilaDay(tomorrow)) return `Tomorrow, ${clock(date)}`;
  return `${date.toLocaleDateString("en-PH", { timeZone: MANILA, month: "short", day: "numeric" })}, ${clock(date)}`;
};

// A Manila wall-clock time today (or `dayOffset` days on) as a Date.
const manilaTimeOn = (now, time, dayOffset = 0) => {
  const minutesFromNow = minutesOf(time) - manilaMinutes(now) + dayOffset * 24 * 60;
  const date = new Date(now.getTime() + minutesFromNow * 60 * 1000);
  date.setSeconds(0, 0);
  return date;
};

/**
 * The "until" choices for closing, with the time each ends, worked out the way
 * the server does it: one hour; closing time today (left out once it has
 * passed); the next opening; or until someone opens it again.
 */
export const closeUntilOptions = (hours = DEFAULT_RESERVATION_HOURS, now = new Date()) => {
  const inAnHour = new Date(now.getTime() + 60 * 60 * 1000);
  const closing = manilaTimeOn(now, hours.close);
  const openingToday = manilaTimeOn(now, hours.open);
  const opening = openingToday > now ? openingToday : manilaTimeOn(now, hours.open, 1);
  return [
    { value: "hour", label: "For 1 hour", at: inAnHour },
    ...(closing > now ? [{ value: "closing", label: "Until closing time", at: closing }] : []),
    { value: "opening", label: "Until the hall opens", at: opening },
    { value: "manual", label: "Until someone opens it again", at: null },
  ];
};

// "at 2:15 PM", "tomorrow at 10:00 AM" or "on Oct 28 at 10:00 AM".
const whenPhrase = (value, now = new Date()) => {
  const date = new Date(value);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (manilaDay(date) === manilaDay(now)) return `at ${clock(date)}`;
  if (manilaDay(date) === manilaDay(tomorrow)) return `tomorrow at ${clock(date)}`;
  return `on ${date.toLocaleDateString("en-PH", { timeZone: MANILA, month: "short", day: "numeric" })} at ${clock(date)}`;
};

/** What the website tells guests while online reservations are closed. */
export const describeClosingForGuests = (status = {}) => {
  const why = GUEST_REASONS[status.closedReason] || "Online reservations are paused for a while.";
  const until = status.closedUntil && !Number.isNaN(new Date(status.closedUntil).getTime());
  return `${why} ${until ? `They open again ${whenPhrase(status.closedUntil)}.` : "Please check back later."}`;
};
