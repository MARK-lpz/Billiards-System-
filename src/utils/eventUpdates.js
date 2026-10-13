
import { getTodayDate } from "./reservations";

const DAY_MS = 24 * 60 * 60 * 1000;

const CANCELLED_NOTICE_DAYS = 7;

export const MAX_EVENT_REASON_LENGTH = 200;

export const formatEventWhen = (date, time) => {
  const day = date ? new Date(`${date}T00:00:00`) : null;
  const clock = time ? new Date(`2000-01-01T${time}`) : null;
  const dayLabel =
    day && !Number.isNaN(day.getTime())
      ? day.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : date || "";
  const timeLabel =
    clock && !Number.isNaN(clock.getTime())
      ? clock.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })
      : time || "";
  return [dayLabel, timeLabel].filter(Boolean).join(" · ") || "Schedule to be announced";
};

// The big month and day shown beside a tournament.
export const getDateTile = (date) => {
  const day = date ? new Date(`${date}T00:00:00`) : null;
  if (!day || Number.isNaN(day.getTime())) return { month: "TBA", day: "--" };
  return {
    month: day.toLocaleDateString("en-PH", { month: "short" }).toUpperCase(),
    day: String(day.getDate()),
  };
};

const statusOf = (event) => String(event?.status || "upcoming").toLowerCase();

export const wasRescheduled = (event) =>
  Boolean(event?.rescheduledFrom) &&
  (event.rescheduledFrom.date !== event.date || event.rescheduledFrom.time !== event.time);

export const getEventScheduleError = (date, time, now = new Date()) => {
  if (!date) return "";
  if (date < getTodayDate(now)) return "This date has already passed. Please choose today or a later date.";
  if (!time) return "";

  const start = new Date(`${date}T${time}`);
  return !Number.isNaN(start.getTime()) && start <= now
    ? "This time has already passed today. Please choose a later time."
    : "";
};

export const getScheduleChange = (original, form) => {
  if (!original) return null;
  const moved = (original.date || "") !== (form.date || "") || (original.time || "") !== (form.time || "");
  return moved ? { from: { date: original.date || "", time: original.time || "" }, to: { date: form.date, time: form.time } } : null;
};

const endOfEventDay = (event) => {
  const day = event?.date ? new Date(`${event.date}T23:59:59`) : null;
  return day && !Number.isNaN(day.getTime()) ? day.getTime() : null;
};

/** True once the tournament's day is over (false when it has no date yet). */
export const hasEventDayPassed = (event, now = Date.now()) => {
  const dayEnd = endOfEventDay(event);
  return dayEnd !== null && dayEnd < now;
};

// "Today", "Tomorrow" or "In 5 days", counted in calendar days ("" once past).
export const describeDaysAway = (date, now = Date.now()) => {
  const day = date ? new Date(`${date}T00:00:00`) : null;
  if (!day || Number.isNaN(day.getTime())) return "";
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / DAY_MS);
  if (days < 0) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
};

export const getEventNotices = (events = [], now = Date.now()) =>
  events
    .filter((event) => {
      const status = statusOf(event);
      const isCancelled = status === "cancelled";
      if (!isCancelled && !(["upcoming", "active"].includes(status) && wasRescheduled(event))) return false;

      const dayEnd = endOfEventDay(event);
      if (dayEnd !== null) return dayEnd >= now;

      const cancelledAt = Date.parse(event.cancelledAt || "");
      return isCancelled && Number.isFinite(cancelledAt) && now - cancelledAt <= CANCELLED_NOTICE_DAYS * DAY_MS;
    })
    .map((event) => ({ event, type: statusOf(event) === "cancelled" ? "cancelled" : "rescheduled" }))
    .sort((first, second) => String(first.event.date || "9999").localeCompare(String(second.event.date || "9999")));

const bySchedule = (first, second) =>
  `${first.date || "9999"}T${first.time || ""}`.localeCompare(`${second.date || "9999"}T${second.time || ""}`);

export const getOpenEvents = (events = [], now = Date.now()) =>
  events
    .filter((event) => ["upcoming", "active"].includes(statusOf(event)))
    .filter((event) => !hasEventDayPassed(event, now))
    .sort(bySchedule);

/**
 * The staff's view of the schedule: what is still to come (soonest first), what
 * is over (latest first; a tournament whose day has passed counts even if it was
 * never marked completed), and what was cancelled (latest first), kept apart so
 * a cancelled tournament never sits among the ones still to be played.
 */
export const groupStaffEvents = (events = [], now = Date.now()) => {
  const cancelled = events.filter((event) => statusOf(event) === "cancelled");
  const upcoming = getOpenEvents(events, now);
  const upcomingIds = new Set(upcoming.map((event) => event.id));
  const past = events.filter((event) => statusOf(event) !== "cancelled" && !upcomingIds.has(event.id));
  return {
    upcoming,
    past: [...past].sort((first, second) => bySchedule(second, first)),
    cancelled: [...cancelled].sort((first, second) => bySchedule(second, first)),
  };
};
