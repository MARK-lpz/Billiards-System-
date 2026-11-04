import DashboardStatCards from "../Global/DashboardStatCards";
import { groupStaffEvents } from "../../utils/eventUpdates";
import { formatReservationTime, getReservationRange, getTodayDate } from "../../utils/reservations";

// Counted the way the employee's pages count them: the Tournament Schedule's
// upcoming players, and the Reservation Desk's "All" (everything not yet history).
const HISTORY_STATUSES = new Set(["completed", "rejected", "cancelled", "expired"]);
// Booked but not at the hall yet: what "Next at" looks for.
const STILL_TO_COME = new Set(["pending", "approved", "reserved"]);
const DAY_MS = 24 * 60 * 60 * 1000;

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// "Sat, Oct 31", from a booking's "2026-10-31".
const formatShortDay = (date) => {
  const day = new Date(`${date}T00:00:00`);
  return Number.isNaN(day.getTime())
    ? date
    : day.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
};

const RESERVATIONS_PAGE = { id: "reservations", label: "Reservations" };

/**
 * The employee dashboard's numbers, under the title band: the players in the
 * tournaments still to come, then the open reservations by when they are for
 * (today, tomorrow, after that), then the Stock Alarm (`stockAlarm`, see
 * useStockAlarm): every alarm, red while something is expired or out. Each
 * one opens its page (`onOpen(navId)`).
 */
export default function EmployeeDashboardStats({ events = [], reservations = [], now, onOpen, stockAlarm = null }) {
  const clock = new Date(now);
  const today = getTodayDate(clock);
  const tomorrow = getTodayDate(new Date(clock.getTime() + DAY_MS));

  const upcomingEvents = groupStaffEvents(events, clock.getTime()).upcoming;
  const players = upcomingEvents.reduce((sum, event) => sum + (event.participants?.length || 0), 0);

  const open = reservations.filter((booking) => !HISTORY_STATUSES.has(booking.status));
  const bookedToday = open.filter((booking) => booking.date === today);
  const bookedTomorrow = open.filter((booking) => booking.date === tomorrow);
  const bookedLater = open.filter((booking) => String(booking.date || "") > tomorrow);

  // Today's next guest still to come, by start time.
  const nextToday = bookedToday
    .filter((booking) => STILL_TO_COME.has(booking.status))
    .map((booking) => ({ booking, start: getReservationRange(booking)?.start }))
    .filter(({ start }) => start && start.getTime() > clock.getTime())
    .sort((first, second) => first.start - second.start)[0]?.booking;
  const nextLaterDate = bookedLater.map((booking) => booking.date).sort()[0];

  // A website booking waits here until its GCash payment is checked.
  const withToCheck = (bookings, note) => {
    const toCheck = bookings.filter((booking) => booking.status === "pending").length;
    return {
      tone: toCheck ? "amber" : "blue",
      note: toCheck ? `${note} · ${toCheck} to check` : note,
    };
  };

  // The Stock Alarm's count, and what it is made of.
  const stockCard = () => {
    const { alarm, isNew } = stockAlarm;
    const freshUnseen = alarm.fresh.filter((entry) => isNew("fresh", entry)).length;
    const outCount = alarm.low.filter((entry) => entry.state === "out").length;
    // Each part kept on one line (a no-break space), so a narrow card breaks between them.
    const parts = [
      alarm.expired.length && `${alarm.expired.length}\u00a0expired`,
      alarm.low.length && `${alarm.low.length}\u00a0low`,
      alarm.soon.length && `${alarm.soon.length}\u00a0expiring`,
      alarm.fresh.length && `${alarm.fresh.length}\u00a0new`,
    ].filter(Boolean);
    return {
      id: "stock-alarm",
      page: { id: "stock-alarm", label: "Stock Alarm" },
      icon: "bi-box-seam",
      tone:
        alarm.expired.length || outCount ? "red" : alarm.low.length || alarm.soon.length ? "amber" : freshUnseen ? "blue" : "green",
      value: alarm.expired.length + alarm.low.length + alarm.soon.length + alarm.fresh.length,
      label: "Stock Alarm",
      note: parts.length ? parts.join(" · ") : "All good",
    };
  };

  const stats = [
    {
      id: "participants",
      page: { id: "tournaments", label: "Tournament Schedule" },
      icon: "bi-people",
      tone: "purple",
      value: players,
      label: "Participants",
      note: upcomingEvents.length ? `in ${plural(upcomingEvents.length, "upcoming tournament")}` : "No upcoming tournaments",
    },
    {
      id: "reservations-today",
      page: RESERVATIONS_PAGE,
      icon: "bi-calendar-day",
      value: bookedToday.length,
      label: "Reservations today",
      ...withToCheck(
        bookedToday,
        nextToday
          ? `Next at ${formatReservationTime(nextToday.time)}`
          : bookedToday.length
            ? "No one else still to come"
            : "None booked"
      ),
    },
    {
      id: "reservations-tomorrow",
      page: RESERVATIONS_PAGE,
      icon: "bi-calendar-plus",
      value: bookedTomorrow.length,
      label: "Tomorrow",
      ...withToCheck(bookedTomorrow, formatShortDay(tomorrow)),
    },
    {
      id: "reservations-later",
      page: RESERVATIONS_PAGE,
      icon: "bi-calendar-week",
      value: bookedLater.length,
      label: "Later",
      ...withToCheck(bookedLater, nextLaterDate ? `Next on ${formatShortDay(nextLaterDate)}` : "None booked yet"),
    },
    ...(stockAlarm ? [stockCard()] : []),
  ];

  return <DashboardStatCards stats={stats} label="Reservations, players and stock at a glance" onOpen={onOpen} />;
}
