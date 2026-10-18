import { appendAuditLog } from "../../utils/audit";
import { formatPeso } from "../../utils/tableSession";
import {
  addOrderLines,
  getTableOrderLabel,
  getTableOrders,
  serveAllOrderLines,
  setOrderLineServed,
  sumOrders,
  takeOffOrderLine,
  unpaidQty,
} from "../../utils/tableOrders";
import { useNotifications } from "../Global/useNotifications";

// Read only from click handlers, never while rendering.
const getCurrentTimestamp = () => Date.now();

/**
 * Taking food and drink orders at a pool table, from its card's Order pop-up,
 * and marking them served from the Sales / POS Order Queue. Stock is taken
 * when an item is ordered and given back if a waiting item is taken off.
 */
export default function useTableOrders({ tables = [], setTables, products = [], setProducts, setLogs, staff }) {
  const { addNotification, showToast } = useNotifications();

  // Only while the same session is still running: the other counter may have
  // ended it meanwhile, and its orders went with that bill.
  const findSession = (table) =>
    tables.find(
      (entry) => entry.id === table?.id && entry.status === "occupied" && entry.startTime === table?.startTime
    ) || null;

  const updateOrders = (table, update) =>
    setTables?.((prev) =>
      prev.map((entry) =>
        entry.id === table.id && entry.startTime === table.startTime
          ? { ...entry, orders: update(getTableOrders(entry)) }
          : entry
      )
    );

  const changeStock = (changes) =>
    setProducts?.((prev) =>
      prev.map((product) => {
        const change = changes.find((entry) => String(entry.productId) === String(product.id));
        return change ? { ...product, stock: Math.max(0, Number(product.stock || 0) + change.qty) } : product;
      })
    );

  /** Adds `draft` ({ productId: qty }) to the table's orders. True when it went through. */
  const placeOrder = (table, draft) => {
    const session = findSession(table);
    if (!session) {
      showToast({ tone: "error", icon: "bi-x-circle", title: "Order not added", message: `${table?.name || "This table"}'s session has already ended.` });
      return false;
    }

    const items = Object.entries(draft)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ product: products.find((product) => String(product.id) === productId), qty }));
    if (!items.length) return false;

    // Checked again on the click: the stock may have changed while the pop-up was open.
    const short = items.find(({ product, qty }) => !product || Number(product.stock || 0) < qty);
    if (short) {
      showToast({
        tone: "error",
        icon: "bi-box-seam",
        title: "Order not added",
        message: short.product
          ? `Only ${Math.max(0, Number(short.product.stock || 0))} ${short.product.name} left in stock.`
          : "One of the items is no longer in Inventory.",
      });
      return false;
    }

    const now = getCurrentTimestamp();
    const lines = addOrderLines([], items, { now, by: staff });
    const label = getTableOrderLabel(session);
    const summary = lines.map((line) => `${line.name} ×${line.qty}`).join(", ");
    const total = sumOrders(lines);

    changeStock(items.map(({ product, qty }) => ({ productId: product.id, qty: -qty })));
    updateOrders(session, (orders) => addOrderLines(orders, items, { now, by: staff }));
    appendAuditLog(setLogs, {
      type: "sale",
      staff,
      action: "Took table order",
      detail: `${label}: ${summary} (${formatPeso(total)})`,
      entity: "order",
      table: { id: session.id, name: session.name },
    });
    addNotification({ message: `${label} ordered ${summary} (${formatPeso(total)}).` });
    return true;
  };

  /** Takes one waiting, unpaid item off an order and returns it to stock. */
  const takeOffOrder = (table, lineId) => {
    const session = findSession(table);
    const line = getTableOrders(session).find((entry) => entry.id === lineId);
    if (!session || !line || line.served || unpaidQty(line) < 1) return;

    changeStock([{ productId: line.productId, qty: 1 }]);
    updateOrders(session, (orders) => takeOffOrderLine(orders, lineId, 1));
    appendAuditLog(setLogs, {
      type: "sale",
      staff,
      action: "Removed table order item",
      detail: `${getTableOrderLabel(session)}: 1 ${line.name} taken off and returned to stock`,
      entity: "order",
      table: { id: session.id, name: session.name },
    });
  };

  // From the Order Queue, which always shows the table's current session.
  const findTable = (tableId) => tables.find((entry) => entry.id === tableId && entry.status === "occupied") || null;

  const toggleServed = (tableId, lineId) => {
    const table = findTable(tableId);
    const line = getTableOrders(table).find((entry) => entry.id === lineId);
    if (!line) return;
    updateOrders(table, (orders) => setOrderLineServed(orders, lineId, !line.served));
  };

  const serveAll = (tableId) => {
    const table = findTable(tableId);
    if (table) updateOrders(table, serveAllOrderLines);
  };

  return { placeOrder, takeOffOrder, toggleServed, serveAll };
}
