import { getSessionTotal } from "./tableSession";

/**
 * Food and drinks ordered at a pool table during a session. They are kept on the
 * table itself, so every counter sees them, and are billed with the table time
 * when the session ends.
 *
 * A line: { id, productId, name, category, price, qty, served, orderedAt, orderedBy }
 */

// The most of one product a single order can add.
export const MAX_ORDER_QTY = 99;

const roundPeso = (value) => Math.round(value * 100) / 100;

/** This session's orders. Lines from before it started (a session ended some
 * other way) are not this customer's. */
export const getTableOrders = (table) =>
  Array.isArray(table?.orders) && table.startTime
    ? table.orders.filter((line) => Number(line.orderedAt || 0) >= Number(table.startTime))
    : [];

export const sumOrders = (orders = []) =>
  roundPeso(orders.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.qty || 0), 0));

/** How many of a line are not paid yet: some may have been paid while playing. */
export const unpaidQty = (line) => Math.max(0, Number(line.qty || 0) - Number(line.paidQty || 0));

/** The part of each line still to pay, leaving out lines paid in full. */
export const getUnpaidOrderLines = (orders = []) =>
  orders.filter((line) => unpaidQty(line) > 0).map((line) => ({ ...line, qty: unpaidQty(line) }));

/** This session's payments taken in Sales / POS while the customer kept playing. */
export const getTablePayments = (table) =>
  Array.isArray(table?.payments) && table.startTime
    ? table.payments.filter((payment) => Number(payment.at || 0) >= Number(table.startTime))
    : [];

export const countOrderItems = (orders = []) => orders.reduce((sum, line) => sum + Number(line.qty || 0), 0);

export const countWaitingItems = (orders = []) => countOrderItems(orders.filter((line) => !line.served));

/** Table time plus everything ordered so far: what the session costs now. */
export const getTableBillTotal = (table) => roundPeso(getSessionTotal(table) + sumOrders(getTableOrders(table)));

/** "Table 1 · Juan" */
export const getTableOrderLabel = (table) => {
  const name = table?.name || `Table ${table?.id}`;
  return table?.customer ? `${name} · ${table.customer}` : name;
};

/**
 * The orders with `items` ({ product, qty }) added. A product still waiting at
 * the same price is counted up; one already served gets a new line, since that
 * is a new round to bring out.
 */
export const addOrderLines = (orders, items, { now, by }) => {
  const next = [...orders];
  items.forEach(({ product, qty }, index) => {
    const price = Number(product.price || 0);
    const at = next.findIndex(
      (line) => String(line.productId) === String(product.id) && !line.served && Number(line.price) === price
    );
    if (at === -1) {
      next.push({
        id: `ord-${now}-${index}`,
        productId: product.id,
        name: product.name,
        category: product.category || "",
        price,
        qty,
        served: false,
        orderedAt: now,
        orderedBy: by,
      });
    } else {
      next[at] = { ...next[at], qty: next[at].qty + qty };
    }
  });
  return next;
};

/** Takes `qty` off one line; the line goes once nothing is left on it. */
export const takeOffOrderLine = (orders, lineId, qty) =>
  orders.flatMap((line) => {
    if (line.id !== lineId) return [line];
    return line.qty - qty > 0 ? [{ ...line, qty: line.qty - qty }] : [];
  });

export const setOrderLineServed = (orders, lineId, served) =>
  orders.map((line) => (line.id === lineId ? { ...line, served } : line));

export const serveAllOrderLines = (orders) => orders.map((line) => (line.served ? line : { ...line, served: true }));

const TABLE_TICKET_PREFIX = "table-";

export const isTableTicketId = (ticketId) => String(ticketId).startsWith(TABLE_TICKET_PREFIX);

/**
 * A table's orders as a ticket in the Sales / POS Order Queue, or null when
 * nothing there is waiting. It lists the whole session's orders, served ones
 * included, like a POS ticket does until it is fully served.
 */
export const toTableTicket = (table) => {
  const orders = table?.status === "occupied" ? getTableOrders(table) : [];
  if (!orders.some((line) => !line.served)) return null;

  const firstOrder = new Date(Math.min(...orders.map((line) => Number(line.orderedAt))));
  return {
    id: `${TABLE_TICKET_PREFIX}${table.id}-${table.startTime}`,
    tableId: table.id,
    fromTable: true,
    billLabel: getTableOrderLabel(table),
    createdAt: firstOrder.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }),
    date: firstOrder.toLocaleDateString("en-CA"),
    status: "pending",
    items: orders.map(({ id, productId, name, qty, price, served }) => ({ id, productId, name, qty, price, served })),
  };
};
