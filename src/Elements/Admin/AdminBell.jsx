import Notification from "../Global/Notification";
import useSeenLowStock from "./useSeenLowStock";
import { getLowStock, lowStockKey } from "../../utils/lowStock";

// The other notices the admin still gets, under the low stock: new online
// reservations, and the admin's own actions and server warnings (both sent
// without a type). Not the front desk's approvals, rejections and cancellations,
// nor the old password requests.
const isOtherNotice = (notice) => !notice.type || notice.type === "general" || notice.type === "online-reservation";

/**
 * The admin's bell (see Global/Notification.jsx). On top, stock running low:
 * every product at or under its minimum (out of stock first); opening one goes
 * to Inventory, at that product. It follows the stock as it changes, so a
 * restocked product leaves it. Under it, the admin's other notices.
 */
export default function AdminBell({ products = [], onOpenProduct }) {
  const alerts = getLowStock(products);
  const [seen, markSeen] = useSeenLowStock(alerts.map(lowStockKey));
  const isNew = (alert) => !seen.has(lowStockKey(alert));
  // New alerts first, then the rest, each in stock order.
  const shown = [...alerts.filter(isNew), ...alerts.filter((alert) => !isNew(alert))];

  const sections = [
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
      onMarkAllSeen={() => markSeen(alerts.map(lowStockKey))}
    />
  );
}
