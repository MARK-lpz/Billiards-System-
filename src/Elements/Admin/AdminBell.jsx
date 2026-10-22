import Notification from "../Global/Notification";
import useTimeUpSection from "../Global/useTimeUpSection";
import useSeenLowStock from "./useSeenLowStock";
import { getLowStock, lowStockKey } from "../../utils/lowStock";
import { formatEventWhen } from "../../utils/eventUpdates";
import { formatHoursLabel } from "../../utils/reservations";
import { formatPeso } from "../../utils/tableSession";
import { PAYMENT_CHECK_ALERT_MINUTES, SEEN_PAYMENT_CHECKS_KEY, getLatePaymentChecks, paymentCheckKey } from "../../utils/paymentChecks";
import {
  EXPIRY_ALERT_DAYS,
  SEEN_EXPIRY_KEY,
  describeDaysLeft,
  expiryAlertKey,
  getExpiryAlerts,
} from "../../utils/expiryAlerts";
import { formatExpiryDate } from "../../utils/inventoryValidation";
import useRefundsSection from "../Global/useRefundsSection";

// The other notices the admin gets, under the low stock, all added by the server:
// new online reservations, an account's password reset by texted code (who,
// never the password), an employee changing their own password or reset number
// on their Profile, and the GCash details changed by an employee. The front
// desk's approvals, rejections and cancellations are in the Audit Trail; the
// admin's own actions are toasts (see NotifContext).
const OTHER_TYPES = new Set(["general", "online-reservation", "password-reset", "login-locked", "account-change", "website-gcash"]);
const ACCOUNT_TYPES = new Set(["password-reset", "login-locked", "account-change"]);
const isOtherNotice = (notice) => !notice.type || OTHER_TYPES.has(notice.type);

const describeExpiry = ({ product, days }) => {
  const date = formatExpiryDate(product.expiryDate);
  if (days < 0) return `expired on ${date}`;
  if (days === 0) return "expires today";
  return `expires ${days === 1 ? "tomorrow" : `in ${days} days`} (${date})`;
};

/**
 * The admin's bell (see Global/Notification.jsx). On top, tables whose time is
 * up and not yet ended (see useTimeUpSection); then online bookings whose GCash
 * payment has waited PAYMENT_CHECK_ALERT_MINUTES or more for the front desk to
 * check it (opening one goes to Reservations, on the pending ones); then
 * products about to expire (5 days before, again at 3, and once expired), each
 * with View and Delete; then stock running low: every product at or under its
 * minimum (out of stock first). Opening a product goes to Inventory, at that
 * product; Delete opens its delete check there. Each list follows what it is
 * about, so a table ended, a payment checked or a product restocked leaves it.
 * Under them, the admin's other notices.
 * `now` (ms) comes from the dashboard's clock; `today` (YYYY-MM-DD) too, so the
 * alerts move on at midnight.
 */
export default function AdminBell({
  products = [],
  tables = [],
  reservations = [],
  now,
  today,
  onOpenProduct,
  onOpenTables,
  onEndSession,
  onOpenReservations,
  onOpenEvents,
  onOpenAccounts,
  onOpenWebsite,
  events = [],
}) {
  const timeUp = useTimeUpSection({ role: "admin", tables, reservations, onOpenTables, onEndSession });
  // Website payments to send back: a booking's opens Reservations (its history),
  // an entry fee the Events page, where each is sent back from.
  const refunds = useRefundsSection({
    events,
    onOpen: (payment) => (payment.kind === "reservation" ? onOpenReservations("history") : onOpenEvents()),
  });

  const lateChecks = getLatePaymentChecks(reservations, now);
  const [seenChecks, markChecksSeen] = useSeenLowStock(lateChecks.map(paymentCheckKey), SEEN_PAYMENT_CHECKS_KEY);
  const isNewCheck = (entry) => !seenChecks.has(paymentCheckKey(entry));

  // Opening an other notice: a booking goes to Reservations (on Pending while
  // its payment still needs checking); a password reset, a sign-in locked
  // after wrong passwords, or an employee's own password or reset number
  // changed, to Accounts, where a new password can be set; the GCash details
  // changed by an employee, to Website on its GCash tab.
  // Anything else is only marked read.
  const openerOf = (notice) => {
    if (notice.type === "online-reservation") {
      const booking = reservations.find((entry) => String(entry.id) === String(notice.data?.reservationId));
      return () => onOpenReservations(booking?.status === "pending" ? "pending" : "all");
    }
    if (notice.type === "website-gcash") return onOpenWebsite ? () => onOpenWebsite("gcash") : null;
    return ACCOUNT_TYPES.has(notice.type) ? onOpenAccounts : null;
  };

  const alerts = getLowStock(products);
  const [seen, markSeen] = useSeenLowStock(alerts.map(lowStockKey));
  const isNew = (alert) => !seen.has(lowStockKey(alert));
  // New alerts first, then the rest, each in stock order.
  const shown = [...alerts.filter(isNew), ...alerts.filter((alert) => !isNew(alert))];

  const expiring = getExpiryAlerts(products, today);
  const [seenExpiry, markExpirySeen] = useSeenLowStock(expiring.map(expiryAlertKey), SEEN_EXPIRY_KEY);
  const isNewExpiry = (alert) => !seenExpiry.has(expiryAlertKey(alert));

  const sections = [
    timeUp.section,
    refunds.section,
    {
      key: "payment-checks",
      title: "Payment checks",
      icon: "bi-phone",
      newCount: lateChecks.filter(isNewCheck).length,
      empty: `No GCash payment has waited ${PAYMENT_CHECK_ALERT_MINUTES} minutes to be checked.`,
      items: lateChecks.map((entry) => {
        const { booking, waitingMinutes } = entry;
        const amount = Number(booking.paymentAmount) || 0;
        return {
          key: paymentCheckKey(entry),
          unread: isNewCheck(entry),
          icon: "bi-hourglass-split staff-bell-icon--warning",
          title: (
            <>
              <strong>{booking.customerName}</strong>&apos;s GCash payment has waited {formatHoursLabel(waitingMinutes)} to be checked
            </>
          ),
          meta: `${booking.tableName || `Table ${booking.tableId}`} · ${formatEventWhen(booking.date, booking.time)}${
            amount > 0 ? ` · ${formatPeso(amount)}` : ""
          }`,
          state: { label: "Check payment", tone: "action" },
          onOpen: () => {
            markChecksSeen([paymentCheckKey(entry)]);
            onOpenReservations("pending");
          },
        };
      }),
    },
    {
      key: "expiry",
      title: "Expiring soon",
      icon: "bi-calendar-x",
      newCount: expiring.filter(isNewExpiry).length,
      empty: `No product expires within ${EXPIRY_ALERT_DAYS} days.`,
      items: expiring.map((alert) => {
        const { product, stage, days } = alert;
        const unit = product.unit || "pcs";
        const open = (action) => {
          markExpirySeen([expiryAlertKey(alert)]);
          onOpenProduct(product.id, action);
        };
        return {
          key: expiryAlertKey(alert),
          unread: isNewExpiry(alert),
          icon: stage === "soon" ? "bi-hourglass-split staff-bell-icon--warning" : "bi-calendar-x-fill staff-bell-icon--danger",
          title: (
            <>
              <strong>{product.name}</strong> {describeExpiry(alert)}
            </>
          ),
          meta: `${product.productNumber ? `#${product.productNumber} · ` : ""}${product.category ? `${product.category} · ` : ""}${Number(product.stock) || 0} ${unit} in stock`,
          state: { label: describeDaysLeft(days), tone: stage === "soon" ? "action" : "danger" },
          onOpen: () => open(),
          actions: [
            { label: "View", icon: "bi-box-arrow-up-right", onClick: () => open() },
            { label: "Delete product", icon: "bi-trash3", tone: "danger", onClick: () => open("delete") },
          ],
        };
      }),
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
      others={{ title: "Other notices", filter: isOtherNotice, openerOf, empty: "No other notices." }}
      onMarkAllSeen={() => {
        timeUp.markAllSeen();
        refunds.markAllSeen();
        markChecksSeen(lateChecks.map(paymentCheckKey));
        markSeen(alerts.map(lowStockKey));
        markExpirySeen(expiring.map(expiryAlertKey));
      }}
    />
  );
}
