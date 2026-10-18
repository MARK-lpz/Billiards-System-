import useSeenLowStock from "../Admin/useSeenLowStock";
import { useOnlinePayments } from "./useOnlinePayments";
import { formatEventWhen } from "../../utils/eventUpdates";
import { SEEN_REFUNDS_KEY, formatPayer, formatPeso, getRefundsDue, refundKey } from "../../utils/onlinePayments";

/**
 * The bells' "GCash to send back" list: website payments that were turned down
 * (or whose booking or tournament was called off), oldest first, until staff
 * mark them sent back. Each opens where it is sent back from: `onOpen(payment)`.
 * `events` names the tournament an entry fee was for. Returns { section,
 * markAllSeen } for Global/Notification.jsx, like useTimeUpSection.
 */
export default function useRefundsSection({ events = [], onOpen }) {
  const { payments } = useOnlinePayments();
  const refunds = getRefundsDue(payments);
  const [seen, markSeen] = useSeenLowStock(refunds.map(refundKey), SEEN_REFUNDS_KEY);
  const isNew = (payment) => !seen.has(refundKey(payment));

  const describeFor = (payment) => {
    if (payment.kind !== "tournament") return "Table booking";
    const event = events.find((entry) => String(entry.id) === String(payment.refId));
    return event ? `Entry fee, ${event.name} (${formatEventWhen(event.date, event.time)})` : "Tournament entry fee";
  };

  return {
    section: {
      key: "refunds",
      title: "GCash to send back",
      icon: "bi-arrow-counterclockwise",
      newCount: refunds.filter(isNew).length,
      empty: "No GCash payment is waiting to be sent back.",
      items: refunds.map((payment) => ({
        key: refundKey(payment),
        unread: isNew(payment),
        icon: "bi-arrow-counterclockwise staff-bell-icon--warning",
        title: (
          <>
            Send <strong>{formatPeso(payment.amount)}</strong> back to <strong>{payment.customerName}</strong>
          </>
        ),
        meta: `${describeFor(payment)} · to ${formatPayer(payment)}`,
        state: { label: "Send back", tone: "action" },
        onOpen: () => {
          markSeen([refundKey(payment)]);
          onOpen(payment);
        },
      })),
    },
    markAllSeen: () => markSeen(refunds.map(refundKey)),
  };
}
