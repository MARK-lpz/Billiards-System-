import Notification from "../Global/Notification";
import { useNotifications } from "../Global/useNotifications";
import useSeenLowStock from "./useSeenLowStock";
import { getLowStock, lowStockKey } from "../../utils/lowStock";
import { ONLINE_RESERVATION_NOTICE, getBookingState, noticeTime } from "../../utils/notices";

const BOOKINGS_SHOWN = 20;

// The other notices the admin still gets, under the sections: the admin's own
// actions and server warnings (both sent without a type). Not the front desk's
// approvals, rejections and cancellations, nor the old password requests.
const isOtherNotice = (notice) => !notice.type || notice.type === "general";

/**
 * The admin's bell (see Global/Notification.jsx). On top, guests' online
 * reservations; opening one goes to Reservations, at that booking. Then stock
 * running low: every product at or under its minimum (out of stock first);
 * opening one goes to Inventory, at that product. It follows the stock as it
 * changes, so a restocked product leaves it. Under them, the admin's other notices.
 */
export default function AdminBell({ products = [], reservations = [], onOpenProduct, onOpenReservation }) {
  const { notifications, markAsRead } = useNotifications();
  const bookings = notifications.filter((notice) => notice.type === ONLINE_RESERVATION_NOTICE);
  const unreadBookings = bookings.filter((notice) => notice.unread).length;

  const alerts = getLowStock(products);
  const [seen, markSeen] = useSeenLowStock(alerts.map(lowStockKey));
  const isNew = (alert) => !seen.has(lowStockKey(alert));
  // New alerts first, then the rest, each in stock order.
  const shown = [...alerts.filter(isNew), ...alerts.filter((alert) => !isNew(alert))];

  const sections = [
    {
      key: "bookings",
      title: "Online reservations",
      icon: "bi-calendar2-check",
      newCount: unreadBookings,
      empty: "No online reservations yet.",
      items: bookings.slice(0, BOOKINGS_SHOWN).map((notice) => ({
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
      key: "low-stock",
      title: "Low stock",
      icon: "bi-box-seam",
      newCount: alerts.filter(isNew).length,
      empty: "Every product is above its minimum stock.",
      items: shown.map((alert) => {
        const { product, state } = alert;
        const unit = product.unit || "pcs";
        return {
          key: lowStockKey(alert),
          unread: isNew(alert),
          icon: state === "out" ? "bi-x-octagon-fill staff-bell-icon--danger" : "bi-exclamation-triangle-fill staff-bell-icon--warning",
          title: (
            <>
              <strong>{product.name}</strong> {state === "out" ? "is out of stock" : `is low: ${Number(product.stock) || 0} ${unit} left`}
            </>
          ),
          meta: `${product.productNumber ? `#${product.productNumber} · ` : ""}${product.category ? `${product.category} · ` : ""}alert at ${Number(product.minStock) || 0} ${unit}`,
          state: state === "out" ? { label: "Out of stock", tone: "danger" } : { label: "Low stock", tone: "action" },
          onOpen: () => {
            markSeen([lowStockKey(alert)]);
            onOpenProduct(product.id);
          },
        };
      }),
    },
  ];

  return (
    <Notification
      sections={sections}
      others={{ title: "Other notices", filter: isOtherNotice, empty: "No other notices." }}
      onMarkAllSeen={() => {
        markSeen(alerts.map(lowStockKey));
        // Only the bookings: Notification marks the other notices itself.
        bookings.filter((notice) => notice.unread).forEach((notice) => markAsRead(notice.id));
      }}
    />
  );
}
