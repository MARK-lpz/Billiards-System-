/**
 * What players are told about a tournament that was cancelled or moved. Staff
 * record it in Events; the public website and the registration form show it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// A cancellation without a date stays on the website this long.
const CANCELLED_NOTICE_DAYS = 7;

export const MAX_EVENT_REASON_LENGTH = 200;

/** "Sat, Oct 18, 2026 · 7:00 PM", or whichever part is set. */
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

const statusOf = (event) => String(event?.status || "upcoming").toLowerCase();

/** True when staff moved the event to a different day or time after posting it. */
export const wasRescheduled = (event) =>
  Boolean(event?.rescheduledFrom) &&
  (event.rescheduledFrom.date !== event.date || event.rescheduledFrom.time !== event.time);

/** The schedule change staff are about to save, or null when date and time stay the same. */
export const getScheduleChange = (original, form) => {
  if (!original) return null;
  const moved = (original.date || "") !== (form.date || "") || (original.time || "") !== (form.time || "");
  return moved ? { from: { date: original.date || "", time: original.time || "" }, to: { date: form.date, time: form.time } } : null;
};

const endOfEventDay = (event) => {
  const day = event?.date ? new Date(`${event.date}T23:59:59`) : null;
  return day && !Number.isNaN(day.getTime()) ? day.getTime() : null;
};

/**
 * The notices the website shows, soonest first: every cancelled or rescheduled
 * tournament whose day has not passed yet. A cancellation with no date is shown
 * for a week after it was made.
 */
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

/** Tournaments still open for registration whose day has not passed, soonest first. */
export const getOpenEvents = (events = [], now = Date.now()) =>
  events
    .filter((event) => ["upcoming", "active"].includes(statusOf(event)))
    .filter((event) => {
      const dayEnd = endOfEventDay(event);
      return dayEnd === null || dayEnd >= now;
    })
    .sort((first, second) => String(first.date || "9999").localeCompare(String(second.date || "9999")));
