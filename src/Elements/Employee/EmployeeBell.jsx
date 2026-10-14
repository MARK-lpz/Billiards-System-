import Notification from "../Global/Notification";
import { ONLINE_RESERVATION_NOTICE, getBookingState, noticeTime } from "../../utils/notices";
import { useNotifications } from "../Global/useNotifications";
import useClock from "../Global/useClock";
import useSeenRegistrations from "./useSeenRegistrations";
import { getRegistrations } from "../../utils/tournamentRegistrations";
import { formatEventWhen } from "../../utils/eventUpdates";

const SHOWN_PER_KIND = 20;

/**
 * The employee's bell (see Global/Notification.jsx). It is about the two things
 * the front desk acts on: online reservations (opening one goes to the
 * Reservation Desk, at that booking) and players registering for tournaments
 * (opening one goes to the Tournament Schedule, at that player). Other notices
 * are not listed for employees for now; pass `others` to Notification to add some.
 */
export default function EmployeeBell({ events = [], reservations = [], onOpenReservation, onOpenRegistration }) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const now = useClock(60000);
  const [seen, markSeen] = useSeenRegistrations(events);

  const bookings = notifications.filter((notice) => notice.type === ONLINE_RESERVATION_NOTICE);
  const allRegistrations = getRegistrations(events, now);
  const isNewPlayer = (registration) => !seen.has(registration.key);
  // New players first, then the rest in the schedule's order.
  const registrations = [...allRegistrations.filter(isNewPlayer), ...allRegistrations.filter((entry) => !isNewPlayer(entry))];
  const unreadBookings = bookings.filter((notice) => notice.unread).length;

  const sections = [
    {
      key: "bookings",
      title: "Online reservations",
      icon: "bi-calendar2-check",
      newCount: unreadBookings,
      empty: "No online reservations yet.",
      items: bookings.slice(0, SHOWN_PER_KIND).map((notice) => ({
        key: notice.id,
        unread: notice.unread,
        icon: "bi-globe2",
        title: notice.message,
        meta: noticeTime(notice),
        state: getBookingState(notice, reservations),
        onOpen: () => {
          if (notice.unread) markAsRead(notice.id);
          onOpenReservation(notice.data?.reservationId ?? null);
        },
      })),
    },
    {
      key: "players",
      title: "Tournament players",
      icon: "bi-trophy",
      newCount: allRegistrations.filter(isNewPlayer).length,
      empty: "No players registered for upcoming tournaments yet.",
      items: registrations.slice(0, SHOWN_PER_KIND).map((registration) => ({
        key: registration.key,
        unread: isNewPlayer(registration),
        icon: registration.walkIn ? "bi-person-walking" : "bi-globe2",
        title: (
          <>
            <strong>{registration.name}</strong> registered for {registration.event.name}
          </>
        ),
        meta: `${registration.walkIn ? "Walk-in" : "Online"}${registration.team ? ` · ${registration.team}` : ""} · ${formatEventWhen(registration.event.date, registration.event.time)}`,
        onOpen: () => {
          markSeen([registration.key]);
          onOpenRegistration({ eventId: registration.event.id, label: registration.label, key: registration.key });
        },
      })),
    },
  ];

  return (
    <Notification
      sections={sections}
      onMarkAllSeen={() => {
        if (unreadBookings) markAllAsRead();
        markSeen(allRegistrations.map((registration) => registration.key));
      }}
    />
  );
}
