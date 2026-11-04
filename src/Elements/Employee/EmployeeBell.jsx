import Notification from "../Global/Notification";
import { noticeTime } from "../../utils/notices";
import { useNotifications } from "../Global/useNotifications";
import useClock from "../Global/useClock";
import useTimeUpSection from "../Global/useTimeUpSection";
import { getRegistrations } from "../../utils/tournamentRegistrations";
import { formatEventWhen } from "../../utils/eventUpdates";
import useRefundsSection from "../Global/useRefundsSection";
import { useOnlinePayments } from "../Global/useOnlinePayments";
import { findPlayerPayment } from "../../utils/onlinePayments";
import { stockAlarmKey } from "../../utils/productShelf";
import { formatExpiryDate } from "../../utils/inventoryValidation";

// The notices the website sends the staff when a guest books online.
const ONLINE_RESERVATION = "online-reservation";
const SHOWN_PER_KIND = 20;
// The stock alarms the bell lists, most pressing first (useStockAlarm).
const STOCK_KINDS = ["expired", "low", "fresh"];

// One stock alarm in the bell: what happened to the product, and its state.
const describeStockAlarm = (kind, entry) => {
  const { product } = entry;
  const unit = product.unit || "pcs";
  const name = <strong>{product.name}</strong>;
  if (kind === "expired") {
    return {
      icon: "bi-calendar-x-fill staff-bell-icon--danger",
      title: <>{name} expired on {formatExpiryDate(product.expiryDate)}</>,
      state: { label: "Do not sell", tone: "danger" },
    };
  }
  if (kind === "low") {
    const out = entry.state === "out";
    return {
      icon: out ? "bi-x-octagon-fill staff-bell-icon--danger" : "bi-exclamation-triangle-fill staff-bell-icon--warning",
      title: out ? <>{name} is out of stock</> : <>{name} is low: {Number(product.stock) || 0} {unit} left</>,
      state: out ? { label: "Out of stock", tone: "danger" } : { label: "Low stock", tone: "action" },
    };
  }
  return { icon: "bi-stars", title: <>{name} was added to the Sales / POS</>, state: null };
};

// Where each booking stands now, shown beside its notice.
const BOOKING_STATES = {
  pending: { label: "Check payment", tone: "action" },
  approved: { label: "Approved", tone: "done" },
  reserved: { label: "Approved", tone: "done" },
  arrived: { label: "Arrived", tone: "done" },
  seated: { label: "Seated", tone: "done" },
  completed: { label: "Completed", tone: "done" },
  rejected: { label: "Rejected", tone: "closed" },
  cancelled: { label: "Cancelled", tone: "closed" },
  expired: { label: "Expired", tone: "closed" },
};

/**
 * The employee's bell (see Global/Notification.jsx). It is about what the front
 * desk acts on: tables whose time is up and not yet ended (see
 * useTimeUpSection), online reservations (opening one goes to the Reservation
 * Desk, at that booking), players registering for tournaments (opening one
 * goes to the Tournament Schedule, at that player) and the stock alarm:
 * products expired, running low or newly added (opening one goes to the
 * Stock Alarm page, at its list). The players have no bell of
 * their own on that page: this is the one. `seen` / `markSeen` are the players
 * already opened, shared with that page (the dashboard keeps them), and
 * `stockAlarm` (useStockAlarm) is shared with the dashboard the same way.
 * Other notices are not listed for employees for now; pass `others` to
 * Notification to add some.
 */
export default function EmployeeBell({
  events = [],
  tables = [],
  reservations = [],
  seen,
  markSeen,
  onOpenTables,
  onEndSession,
  onOpenReservation,
  onOpenRegistration,
  stockAlarm,
  onOpenStockAlarm,
}) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const now = useClock(60000);
  const timeUp = useTimeUpSection({ role: "employee", tables, reservations, onOpenTables, onEndSession });
  // Website payments to send back: a booking's opens the Reservation Desk at it,
  // an entry fee the Tournament Schedule at its tournament.
  const refunds = useRefundsSection({
    events,
    onOpen: (payment) =>
      payment.kind === "reservation"
        ? onOpenReservation(payment.refId)
        : onOpenRegistration({ eventId: payment.refId, label: payment.participant, key: `refund-${payment.id}` }),
  });
  const { payments } = useOnlinePayments();

  const bookings = notifications.filter((notice) => notice.type === ONLINE_RESERVATION);
  const allRegistrations = getRegistrations(events, now);
  const isNewPlayer = (registration) => !seen.has(registration.key);
  // New players first, then the rest in the schedule's order.
  const registrations = [...allRegistrations.filter(isNewPlayer), ...allRegistrations.filter((entry) => !isNewPlayer(entry))];
  const unreadBookings = bookings.filter((notice) => notice.unread).length;

  // Unseen stock alarms first, then the rest, each kind in its own order.
  const stockEntries = STOCK_KINDS.flatMap((kind) => stockAlarm.alarm[kind].map((entry) => ({ kind, entry })));
  const isNewStock = ({ kind, entry }) => stockAlarm.isNew(kind, entry);
  const stockShown = [...stockEntries.filter(isNewStock), ...stockEntries.filter((item) => !isNewStock(item))];

  const stateOf = (notice) => {
    const booking = reservations.find((entry) => String(entry.id) === String(notice.data?.reservationId));
    return booking ? BOOKING_STATES[booking.status] || null : null;
  };

  const sections = [
    timeUp.section,
    refunds.section,
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
        state: stateOf(notice),
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
        meta: `${registration.walkIn ? "Walk-in" : "Online"}${registration.team ? ` · ${registration.team}` : ""}${registration.skill ? ` · ${registration.skill}` : ""} · ${formatEventWhen(registration.event.date, registration.event.time)}`,
        // An entry fee paid online that no one has checked yet.
        state:
          findPlayerPayment(payments, registration.event.id, registration.label)?.status === "held"
            ? { label: "Check payment", tone: "action" }
            : null,
        onOpen: () => {
          markSeen([registration.key]);
          onOpenRegistration({ eventId: registration.event.id, label: registration.label, key: registration.key });
        },
      })),
    },
    {
      key: "stock",
      title: "Stock alarm",
      icon: "bi-box-seam",
      newCount: stockEntries.filter(isNewStock).length,
      empty: "Nothing expired, running low or newly added.",
      items: stockShown.slice(0, SHOWN_PER_KIND).map((item) => {
        const { kind, entry } = item;
        const { product } = entry;
        const key = stockAlarmKey(kind, entry);
        return {
          key,
          unread: isNewStock(item),
          ...describeStockAlarm(kind, entry),
          meta: [product.productNumber && `#${product.productNumber}`, product.category, `${Number(product.stock) || 0} ${product.unit || "pcs"} in stock`]
            .filter(Boolean)
            .join(" · "),
          onOpen: () => {
            stockAlarm.markSeen([key]);
            onOpenStockAlarm(kind);
          },
        };
      }),
    },
  ];

  return (
    <Notification
      sections={sections}
      onMarkAllSeen={() => {
        timeUp.markAllSeen();
        refunds.markAllSeen();
        if (unreadBookings) markAllAsRead();
        markSeen(allRegistrations.map((registration) => registration.key));
        stockAlarm.markAllSeen();
      }}
    />
  );
}
