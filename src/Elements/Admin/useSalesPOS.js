import { useEffect, useState } from "react";
import { nowStr, readStorage, todayStr } from "./salesPosConfig";
import { appendAuditLog } from "../../utils/audit";
import { useNotifications } from "../Global/useNotifications";
import {
  createTableCharge,
  getLiveChargeId,
  toChargeOrderLines,
  toLiveReceiptCharge,
  toLiveTableLines,
  toTableChargeLine,
} from "../../utils/tableCharges";
import { unpaidQty } from "../../utils/tableOrders";
import { buildBillLabel, createBill, findChargeBill } from "../../utils/posBills";

// One shared empty list, so "no bill picked" does not hand out a new array every render.
const NO_ITEMS = [];

// The single running bill from before bills were split per table.
const LEGACY_BILL_ID = "bill-legacy";

const newBillId = () => `bill-${Date.now()}`;

const isCompletedTicket = (ticket) =>
  ticket.status === "served" || ticket.items.every((item) => item.served);

const toServedTicket = (ticket) => ({
  ...ticket,
  status: "served",
  servedAt: ticket.servedAt || nowStr(),
  items: ticket.items.map((item) => ({ ...item, served: true })),
});

const getLegacyBill = (storageKeyPrefix) => {
  if (readStorage(`${storageKeyPrefix}:bills`, null)) return null;

  const cart = readStorage(`${storageKeyPrefix}:cart`, []);
  return cart.length ? { ...createBill({ id: LEGACY_BILL_ID }), cart } : null;
};

const getOpenBills = (storageKeyPrefix) => {
  const legacyBill = getLegacyBill(storageKeyPrefix);
  return legacyBill ? [legacyBill] : readStorage(`${storageKeyPrefix}:bills`, []);
};

const getActiveBillId = (storageKeyPrefix) =>
  getLegacyBill(storageKeyPrefix) ? LEGACY_BILL_ID : readStorage(`${storageKeyPrefix}:active-bill`, null);

// Tickets from before bills were split go with the old single bill: its own
// ticket when it had one, or else every waiting ticket, as it was searched then.
const getPendingTickets = (storageKeyPrefix) => {
  const tickets = readStorage(`${storageKeyPrefix}:tickets`, []).filter((ticket) => !isCompletedTicket(ticket));
  const legacyBill = getLegacyBill(storageKeyPrefix);
  if (!legacyBill) return tickets;

  const legacyTicketId = readStorage(`${storageKeyPrefix}:active-ticket`, null);
  const hasOwnTicket = tickets.some((ticket) => ticket.id === legacyTicketId);
  return tickets.map((ticket) =>
    ticket.billId || (hasOwnTicket && ticket.id !== legacyTicketId)
      ? ticket
      : { ...ticket, billId: LEGACY_BILL_ID, billLabel: legacyBill.label }
  );
};

const getServedTickets = (storageKeyPrefix) => {
  const savedTickets = readStorage(`${storageKeyPrefix}:served-tickets`, []);
  const savedTicketIds = new Set(savedTickets.map((ticket) => ticket.id));
  const migratedTickets = readStorage(`${storageKeyPrefix}:tickets`, [])
    .filter(isCompletedTicket)
    .filter((ticket) => !savedTicketIds.has(ticket.id))
    .map(toServedTicket);

  return [...migratedTickets, ...savedTickets];
};

const sumBill = (cart) => Number(cart.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2));

// Read only from click handlers, never while rendering.
const getCurrentTimestamp = () => Date.now();

export default function useSalesPOS({
  tables = [],
  setTables,
  reservations = [],
  products,
  setProducts,
  setTransactions,
  tableCharges = [],
  setTableCharges,
  setLogs,
  cashierLabel,
  storageKeyPrefix,
}) {
  const { addNotification } = useNotifications();
  // Every open bill, one per table or walk-in customer, each with its own items.
  const [bills, setBills] = useState(() => getOpenBills(storageKeyPrefix));
  // The bill being rung up. None is picked after a payment, so the next item
  // tapped starts a new bill instead of landing on another table's.
  const [activeBillId, setActiveBillId] = useState(() => getActiveBillId(storageKeyPrefix));
  const [method, setMethod] = useState(() => readStorage(`${storageKeyPrefix}:method`, "cash"));
  const [receipt, setReceipt] = useState(null);
  const [paymentReviewOpen, setPaymentReviewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [tab, setTab] = useState("billing");
  const [orderTickets, setOrderTickets] = useState(() => getPendingTickets(storageKeyPrefix));
  const [servedOrderTickets, setServedOrderTickets] = useState(() => getServedTickets(storageKeyPrefix));
  const [stockAlert, setStockAlert] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKeyPrefix}:bills`, JSON.stringify(bills));
      localStorage.setItem(`${storageKeyPrefix}:active-bill`, JSON.stringify(activeBillId));
      localStorage.setItem(`${storageKeyPrefix}:method`, JSON.stringify(method));
      localStorage.setItem(`${storageKeyPrefix}:tickets`, JSON.stringify(orderTickets));
      localStorage.setItem(`${storageKeyPrefix}:served-tickets`, JSON.stringify(servedOrderTickets));
      // The single bill's keys, now carried by the open bills above.
      localStorage.removeItem(`${storageKeyPrefix}:cart`);
      localStorage.removeItem(`${storageKeyPrefix}:active-ticket`);
    } catch (error) {
      console.warn("Unable to persist POS state", error);
    }
  }, [bills, activeBillId, method, orderTickets, servedOrderTickets, storageKeyPrefix]);

  // One running bill at a time. Bills saved before that (one per table) are kept
  // and come up one after another as each is paid, so nothing on them is lost.
  const activeBill = bills.find((bill) => bill.id === activeBillId) || bills[0] || null;
  const currentBillId = activeBill?.id ?? null;
  const savedBillsCount = Math.max(0, bills.length - 1);
  const cart = activeBill ? activeBill.cart : NO_ITEMS;

  const updateBillCart = (billId, update) =>
    setBills((prev) =>
      prev.map((bill) =>
        bill.id === billId ? { ...bill, cart: typeof update === "function" ? update(bill.cart) : update } : bill
      )
    );
  const setCart = (update) => updateBillCart(currentBillId, update);

  const openNewBill = ({ table = null, customer = "" } = {}) => {
    const bill = createBill({ id: newBillId(), table, customer, bills, openedAt: nowStr() });
    setBills((prev) => [...prev, bill]);
    setActiveBillId(bill.id);
    setStockAlert(null);
    return bill;
  };

  // Tapping an item with no bill picked starts a walk-in bill, as the one bill did before.
  const ensureActiveBill = () => activeBill || openNewBill();

  const cats = ["All", ...new Set(products.map((product) => product.category).filter(Boolean))];
  const filteredProducts = products.filter((product) => {
    const matchSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = catFilter === "All" || product.category === catFilter;
    return matchSearch && matchCategory;
  });

  const inventoryCartItems = cart.filter((item) => item.inventoryItem);
  const unsyncedItems = inventoryCartItems
    .map((item) => ({ ...item, unsyncedQty: Math.max(0, item.qty - (item.syncedQty || 0)) }))
    .filter((item) => item.unsyncedQty > 0);
  const unsyncedCount = unsyncedItems.reduce((sum, item) => sum + item.unsyncedQty, 0);

  // Ended table sessions still to be paid. Admin and employee each have their own
  // bill, so one could already have been paid at the other counter.
  const unpaidTableCharges = tableCharges.filter((charge) => charge.status === "unpaid");
  const unpaidChargeIds = new Set(unpaidTableCharges.map((charge) => charge.id));
  // Tables still playing, with what each owes now. They can pay part way through
  // and keep playing; the payment is recorded on the table.
  const liveCharges = tables
    .filter((table) => table.status === "occupied" && table.startTime)
    .map((table) => ({
      chargeId: getLiveChargeId(table),
      table,
      charge: createTableCharge({ table, reservations, tableCharges, endedBy: cashierLabel, now: Number(table.startTime) }),
    }));
  const liveTableBills = liveCharges.filter((entry) => entry.charge.amountDue > 0);
  const liveById = new Map(liveCharges.map((entry) => [entry.chargeId, entry]));

  // A playing table's line is still owed: same session, and its time or order
  // not paid meanwhile (here, at the other counter, or by ending the session).
  const isLiveLineDue = (item) => {
    const live = liveById.get(item.chargeId);
    if (!live) return false;
    if (item.isTableCharge) return live.charge.timeDue + 0.001 >= item.price;
    const line = live.charge.orders.find((entry) => entry.id === item.liveLineId);
    return Boolean(line) && unpaidQty(line) >= item.qty;
  };

  // A table's bill is its time and what was ordered at the table; both go if it
  // was paid elsewhere. A playing table's lines go together once any is not owed.
  const staleLiveIds = new Set(
    cart.filter((item) => item.liveTable && !isLiveLineDue(item)).map((item) => item.chargeId)
  );
  const isStaleTableLine = (item) =>
    item.liveTable
      ? staleLiveIds.has(item.chargeId)
      : (item.isTableCharge || item.fromTableCharge) && !unpaidChargeIds.has(item.chargeId);

  const subtotal = sumBill(cart);
  const discAmt = 0;
  const total = subtotal;

  const pendingItemsCount = orderTickets.reduce(
    (sum, ticket) => sum + ticket.items.filter((item) => !item.served).length,
    0
  );
  const servedItemsCount = servedOrderTickets.reduce(
    (sum, ticket) => sum + ticket.items.reduce((itemTotal, item) => itemTotal + item.qty, 0),
    0
  );

  /** How many items on a bill are still waiting to be served. */
  const getBillWaitingQty = (billId) =>
    orderTickets
      .filter((ticket) => ticket.billId === billId)
      .flatMap((ticket) => ticket.items)
      .filter((line) => !line.served)
      .reduce((sum, line) => sum + line.qty, 0);


  const billWaitingQty = activeBill ? getBillWaitingQty(activeBill.id) : 0;

  const getMaxAllowedQty = (productId, syncedQty = 0) => {
    const product = products.find((entry) => entry.id === productId);
    return (product?.stock || 0) + syncedQty;
  };

  const syncInventoryDeduction = (itemsToDeduct) => {
    if (!itemsToDeduct.length) return;

    setProducts((prev) =>
      prev.map((product) => {
        const matched = itemsToDeduct.find((item) => item.id === product.id);
        return matched ? { ...product, stock: Math.max(0, product.stock - matched.unsyncedQty) } : product;
      })
    );
  };

  // Everything added to one bill goes on one order ticket, named after the bill,
  // so the queue shows one order per table instead of a ticket for every item
  // tapped. A new ticket starts once the bill's ticket has been fully served.
  const queueInventoryItems = (itemsToQueue, bill = activeBill) => {
    if (!itemsToQueue.length || !bill) return;

    const stamp = Date.now();
    const openTicket = orderTickets.find((ticket) => ticket.billId === bill.id);
    const ticketId = openTicket ? openTicket.id : stamp;
    const toLine = (item) => ({
      id: `${item.id}-${stamp}`,
      productId: item.id,
      name: item.name,
      qty: item.unsyncedQty,
      price: item.price,
      served: false,
    });

    syncInventoryDeduction(itemsToQueue);
    setOrderTickets((prev) => {
      const current = prev.find((ticket) => ticket.id === ticketId);
      if (!current) {
        const newTicket = {
          id: ticketId,
          billId: bill.id,
          billLabel: bill.label,
          createdAt: nowStr(),
          date: todayStr(),
          status: "pending",
          items: itemsToQueue.map(toLine),
        };
        return [newTicket, ...prev];
      }

      // The same product still waiting is counted up; a product already served
      // gets a fresh line, since that is a new round for the kitchen.
      const items = [...current.items];
      itemsToQueue.forEach((item) => {
        const index = items.findIndex((line) => line.productId === item.id && !line.served);
        if (index === -1) items.push(toLine(item));
        else items[index] = { ...items[index], qty: items[index].qty + item.unsyncedQty };
      });

      return prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, items, status: "pending" } : ticket));
    });
    updateBillCart(bill.id, (prev) =>
      prev.map((item) => {
        const queued = itemsToQueue.find((entry) => entry.id === item.id);
        return queued ? { ...item, syncedQty: (item.syncedQty || 0) + queued.unsyncedQty } : item;
      })
    );
  };

  // Only this bill's tickets, so taking an item off one table's bill never
  // cancels another table's order.
  const isBillTicket = (ticket) => ticket.billId === currentBillId;

  /** How many of a product on this bill are still waiting to be served. */
  const getQueuedQty = (productId) =>
    orderTickets
      .filter(isBillTicket)
      .flatMap((ticket) => ticket.items)
      .filter((line) => line.productId === productId && !line.served)
      .reduce((sum, line) => sum + line.qty, 0);

  // Worked out from the current tickets before anything is set. It used to be
  // counted inside a state updater, which React may run later, so the count came
  // back as 0 and the X button left the item on the bill.
  const restoreInventoryItems = (productId, qtyToRestore) => {
    let remaining = qtyToRestore;

    const nextTickets = orderTickets
      .map((ticket) => {
        if (!remaining || !isBillTicket(ticket)) return ticket;

        const items = ticket.items
          .map((item) => {
            if (!remaining || item.productId !== productId || item.served) return item;

            const qtyRemoved = Math.min(item.qty, remaining);
            remaining -= qtyRemoved;
            return item.qty === qtyRemoved ? null : { ...item, qty: item.qty - qtyRemoved };
          })
          .filter(Boolean);

        if (!items.length) return null;

        return {
          ...ticket,
          items,
          status: items.every((item) => item.served) ? "served" : "pending",
        };
      })
      .filter(Boolean);

    const restoredQty = qtyToRestore - remaining;
    if (!restoredQty) return 0;

    // Taking off the last waiting item leaves a ticket with only served items,
    // which belongs in history like any other fully served order.
    const finishedTickets = nextTickets.filter((ticket) => ticket.status === "served");
    setOrderTickets(nextTickets.filter((ticket) => ticket.status !== "served"));
    if (finishedTickets.length) {
      setServedOrderTickets((prev) => [...finishedTickets.map(toServedTicket), ...prev]);
    }

    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, stock: product.stock + restoredQty } : product
      )
    );

    return restoredQty;
  };

  const switchBill = (billId) => {
    setActiveBillId(billId);
    setStockAlert(null);
    setPaymentReviewOpen(false);
  };

  // A bill can be closed only once nothing is left on it; one with items is paid instead.
  const closeBill = (billId) => {
    const bill = bills.find((entry) => entry.id === billId);
    if (!bill || bill.cart.length) return false;

    setBills((prev) => prev.filter((entry) => entry.id !== billId));
    if (currentBillId === billId) setActiveBillId(null);
    return true;
  };

  /** What removing a whole bill would do, for its confirmation: { waiting, served, tables }. */
  const describeBillRemoval = (billId) => {
    const bill = bills.find((entry) => entry.id === billId);
    if (!bill) return null;
    const waitingLines = orderTickets
      .filter((ticket) => ticket.billId === billId)
      .flatMap((ticket) => ticket.items)
      .filter((line) => !line.served);
    const waitingOf = (productId) =>
      waitingLines.filter((line) => line.productId === productId).reduce((sum, line) => sum + line.qty, 0);
    const served = bill.cart
      .filter((item) => item.inventoryItem)
      .map((item) => ({ name: item.name, qty: Math.max(0, (item.syncedQty || 0) - waitingOf(item.id)) }))
      .filter((item) => item.qty > 0);
    return {
      waiting: waitingLines.reduce((sum, line) => sum + line.qty, 0),
      served,
      tables: [
        ...new Set(bill.cart.filter((item) => item.isTableCharge).map((item) => item.tableName || item.name.split(" · ")[0])),
      ],
    };
  };

  /**
   * Takes a whole bill off without payment (Remove Transaction). What is still
   * waiting leaves the Order Queue and goes back to stock; what was served was
   * handed over, so its stock is not returned. A table's time and orders simply
   * come off: they stay unpaid on Pool Table Bills. Recorded in the Audit Trail.
   */
  const removeBill = (billId) => {
    const bill = bills.find((entry) => entry.id === billId);
    const removal = describeBillRemoval(billId);
    if (!bill || !removal) return;

    const billTickets = orderTickets.filter((ticket) => ticket.billId === billId);
    const restock = new Map();
    billTickets
      .flatMap((ticket) => ticket.items)
      .filter((line) => !line.served)
      .forEach((line) => restock.set(line.productId, (restock.get(line.productId) || 0) + line.qty));
    // What was served stays in the queue's history; what was waiting is cancelled.
    const servedPart = billTickets
      .map((ticket) => ({ ...ticket, items: ticket.items.filter((line) => line.served) }))
      .filter((ticket) => ticket.items.length)
      .map(toServedTicket);

    setOrderTickets((prev) => prev.filter((ticket) => ticket.billId !== billId));
    if (servedPart.length) setServedOrderTickets((prev) => [...servedPart, ...prev]);
    if (restock.size) {
      setProducts((prev) =>
        prev.map((product) => (restock.has(product.id) ? { ...product, stock: product.stock + restock.get(product.id) } : product))
      );
    }
    setBills((prev) => prev.filter((entry) => entry.id !== billId));
    if (currentBillId === billId) setActiveBillId(null);
    setStockAlert(null);
    setPaymentReviewOpen(false);

    const amount = sumBill(bill.cart);
    appendAuditLog(setLogs, {
      type: "sale",
      staff: cashierLabel,
      action: "Removed transaction",
      detail: [
        `${bill.label}: removed unpaid (₱${amount.toFixed(2)}): ${bill.cart.map((item) => `${item.name} ×${item.qty}`).join(", ")}.`,
        removal.waiting ? `${removal.waiting} waiting returned to stock.` : "",
        removal.served.length
          ? `Already served, not charged: ${removal.served.map((item) => `${item.name} ×${item.qty}`).join(", ")}.`
          : "",
        removal.tables.length ? `${removal.tables.join(", ")} left unpaid on Pool Table Bills.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      entity: "payment",
      customer: null,
    });
    addNotification({ message: `${cashierLabel} removed the running bill for ${bill.label} (₱${amount.toFixed(2)}, unpaid).` });
  };

  /** Changes who a bill is for. Its waiting orders take the new name too. */
  const updateBillDetails = (billId, { table = null, customer = "" }) => {
    const bill = bills.find((entry) => entry.id === billId);
    if (!bill) return;

    const tableName = table ? table.name || `Table ${table.id}` : "";
    const label = buildBillLabel({ tableName, customer, bills, excludeId: billId });
    setBills((prev) =>
      prev.map((entry) =>
        entry.id === billId
          ? { ...entry, tableId: table ? table.id : null, tableName, customer: customer.trim(), label }
          : entry
      )
    );
    setOrderTickets((prev) => prev.map((ticket) => (ticket.billId === billId ? { ...ticket, billLabel: label } : ticket)));
  };

  /**
   * Puts a table's bill on the running bill: it starts one for that table, joins
   * a walk-in or empty one (which then takes the table's name), or adds to that
   * table's own. Another table's running bill with items on it is paid first, so
   * each table keeps a receipt of its own; tables paying together are joined in
   * End Session at Pool Tables.
   */
  const placeOnRunningBill = ({ tableId, tableName, customer, lines }) => {
    const sameTable = activeBill && String(activeBill.tableId) === String(tableId);
    if (activeBill && activeBill.tableId !== null && !sameTable && activeBill.cart.length) {
      setStockAlert({
        productId: null,
        message: `The Running Bill is for ${activeBill.label}. Pay it first; to pay tables together, join them in End Session at Pool Tables.`,
      });
      return;
    }

    const bill = activeBill || openNewBill({ table: { id: tableId, name: tableName }, customer });
    if (activeBill && !sameTable) {
      const keepName = activeBill.tableId === null && activeBill.customer;
      updateBillDetails(activeBill.id, { table: { id: tableId, name: tableName }, customer: keepName || customer });
    }
    setStockAlert(null);
    setActiveBillId(bill.id);
    updateBillCart(bill.id, (prev) => [...prev, ...lines]);
  };

  const addTableChargeToBill = (charge) => {
    if (!unpaidChargeIds.has(charge.id) || findChargeBill(bills, charge.id)) return;

    placeOnRunningBill({
      tableId: charge.tableId,
      tableName: charge.tableName,
      customer: charge.customer === "Walk-in" ? "" : charge.customer,
      lines: [toTableChargeLine(charge), ...toChargeOrderLines(charge)],
    });
  };

  /** Puts what a playing table owes now on a bill, to be paid without ending its session. */
  const addLiveTableToBill = (table) => {
    const current = tables.find(
      (entry) => entry.id === table.id && entry.status === "occupied" && entry.startTime === table.startTime
    );
    if (!current) return;
    const chargeId = getLiveChargeId(current);
    if (findChargeBill(bills, chargeId)) return;
    const charge = createTableCharge({ table: current, reservations, tableCharges, endedBy: cashierLabel, now: getCurrentTimestamp() });
    if (charge.amountDue <= 0) return;

    placeOnRunningBill({
      tableId: current.id,
      tableName: charge.tableName,
      customer: current.customer && current.customer !== "Walk-in Customer" ? current.customer : "",
      lines: toLiveTableLines(current, charge),
    });
  };

  // Takes off any table already paid at the other counter. Returns the bill
  // that is left, and says which tables were taken off.
  const dropStaleTableLines = () => {
    const staleLines = cart.filter(isStaleTableLine);
    if (!staleLines.length) return cart;

    const nextCart = cart.filter((item) => !isStaleTableLine(item));
    const staleTables = staleLines.filter((item) => item.isTableCharge && !item.liveTable);
    const staleLive = [...new Set(staleLines.filter((item) => item.liveTable).map((item) => item.tableName))];
    const one = (list, single, many) => (list.length === 1 ? single : many);
    setCart(nextCart);
    setStockAlert({
      productId: null,
      message: [
        staleTables.length
          ? `${staleTables.map((item) => item.name.split(" · ")[0]).join(", ")} ${one(staleTables, "was", "were")} already paid at another counter, so ${one(staleTables, "it was", "they were")} taken off this bill.`
          : "",
        staleLive.length
          ? `${staleLive.join(", ")} changed since ${one(staleLive, "it was", "they were")} added (paid, ended, or an order changed), so ${one(staleLive, "it was", "they were")} taken off this bill. Add ${one(staleLive, "it", "them")} again from Pool Table Bills.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
    return nextCart;
  };

  const addToCart = (product) => {
    const existing = cart.find((item) => item.id === product.id);
    const syncedQty = existing?.syncedQty || 0;
    const maxAllowed = getMaxAllowedQty(product.id, syncedQty);

    if (existing && existing.qty >= maxAllowed) {
      setStockAlert({
        productId: product.id,
        message: `${product.name} is out of stock. Only ${maxAllowed} pcs can be added to this bill.`,
      });
      return;
    }
    if (!existing && product.stock <= 0) {
      setStockAlert({
        productId: product.id,
        message: `${product.name} is out of stock.`,
      });
      return;
    }

    const bill = ensureActiveBill();
    setStockAlert(null);

    updateBillCart(bill.id, (prev) => {
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
      }

      return [...prev, { ...product, qty: 1, syncedQty: 0, inventoryItem: true, isExtra: false }];
    });

    queueInventoryItems([{ ...(existing || product), unsyncedQty: 1 }], bill);
  };

  // `allowServed` is passed only after staff confirm taking an already served
  // item off the bill; without it, only items still waiting can be removed.
  const updateQty = (id, qty, { allowServed = false } = {}) => {
    const item = cart.find((entry) => entry.id === id);
    if (!item) return 0;

    const requestedQty = Number.isFinite(Number(qty)) ? Math.max(0, Math.floor(Number(qty))) : item.qty;

    // What was ordered at a table belongs to that ended session's bill; it comes
    // off with the table time, not on its own. A playing table's lines come off
    // one by one: they simply stay unpaid on the table.
    if (item.fromTableCharge && !item.liveTable) return item.qty;

    if (!item.inventoryItem) {
      // A table charge is one whole session: it is either on the bill or taken off,
      // together with the orders that came with it.
      const nextQty = item.isTableCharge ? Math.min(requestedQty, 1) : requestedQty;
      setCart((prev) => {
        if (nextQty <= 0) {
          return prev.filter(
            (entry) =>
              entry.id !== id &&
              !(item.isTableCharge && !item.liveTable && entry.fromTableCharge && entry.chargeId === item.chargeId)
          );
        }
        return prev.map((entry) => (entry.id === id ? { ...entry, qty: nextQty } : entry));
      });
      setStockAlert(null);
      return nextQty;
    }

    const maxAllowedQty = getMaxAllowedQty(item.id, item.syncedQty || 0);
    const clampedQty = Math.min(requestedQty, maxAllowedQty);

    if (requestedQty > maxAllowedQty) {
      setStockAlert({
        productId: item.id,
        message:
          maxAllowedQty === 0
            ? `${item.name} is out of stock. Remove it from the bill or restock it first.`
            : `Low stock: only ${maxAllowedQty} pcs of ${item.name} are available. Quantity was adjusted.`,
      });
    } else {
      setStockAlert(null);
    }

    const delta = clampedQty - item.qty;
    if (!delta) return clampedQty;

    if (delta > 0) {
      setCart((prev) => prev.map((entry) => (entry.id === id ? { ...entry, qty: clampedQty } : entry)));
      queueInventoryItems([{ ...item, unsyncedQty: delta }]);
      return clampedQty;
    }

    const decrease = Math.abs(delta);
    const restoredQty = restoreInventoryItems(item.id, decrease);
    // Served items were handed over, so their stock is not returned.
    const servedRemoved = allowServed ? decrease - restoredQty : 0;
    if (!allowServed && restoredQty < decrease) {
      setStockAlert({
        productId: item.id,
        message: `${decrease - restoredQty} ${item.name} already served. Use the − or × button to take served items off the bill.`,
      });
    }

    const nextQty = item.qty - restoredQty - servedRemoved;
    const nextSyncedQty = Math.max(0, Math.min(nextQty, (item.syncedQty || 0) - restoredQty));

    setCart((prev) => {
      if (nextQty <= 0) return prev.filter((entry) => entry.id !== id);
      return prev.map((entry) =>
        entry.id === id ? { ...entry, qty: nextQty, syncedQty: nextSyncedQty } : entry
      );
    });
    return nextQty;
  };

  const sendOrderToInventory = () => {
    queueInventoryItems(unsyncedItems);
  };

  const moveTicketToHistory = (ticket) => {
    const servedTicket = toServedTicket(ticket);

    setOrderTickets((prev) => prev.filter((entry) => entry.id !== ticket.id));
    setServedOrderTickets((prev) => [servedTicket, ...prev]);
  };

  const setItemServed = (ticketId, itemId) => {
    const ticket = orderTickets.find((entry) => entry.id === ticketId);
    if (!ticket) return;

    const items = ticket.items.map((item) => (item.id === itemId ? { ...item, served: !item.served } : item));
    if (items.every((item) => item.served)) {
      moveTicketToHistory({ ...ticket, items });
      return;
    }

    setOrderTickets((prev) =>
      prev.map((entry) => (entry.id === ticketId ? { ...entry, items, status: "pending" } : entry))
    );
  };

  const markTicketServed = (ticketId) => {
    const ticket = orderTickets.find((entry) => entry.id === ticketId);
    if (!ticket) return;

    moveTicketToHistory(ticket);
  };

  const processPayment = () => {
    if (!dropStaleTableLines().length) return;

    setPaymentReviewOpen(true);
  };

  const confirmPayment = (paymentDetails = {}) => {
    // Checked again here: the other counter may have taken the table's payment
    // while this one was still on the review screen.
    if (cart.some(isStaleTableLine)) {
      dropStaleTableLines();
      setPaymentReviewOpen(false);
      return;
    }
    if (!activeBill || !cart.length) {
      setPaymentReviewOpen(false);
      return;
    }

    const paidAt = new Date().toISOString();
    const txId = Date.now();
    const billCharges = cart
      .filter((item) => item.isTableCharge && !item.liveTable)
      .map((item) => tableCharges.find((charge) => charge.id === item.chargeId))
      .filter(Boolean)
      .map((charge) => ({ ...charge, status: "paid", paidVia: method, paidAt, paidBy: cashierLabel, transactionId: txId }));
    // Tables paid while still playing: what each line paid, recorded on the table.
    const liveGroups = [...new Set(cart.filter((item) => item.liveTable).map((item) => item.chargeId))].map((chargeId) => {
      const lines = cart.filter((item) => item.chargeId === chargeId);
      return {
        chargeId,
        table: liveById.get(chargeId).table,
        amount: sumBill(lines),
        time: lines.filter((item) => item.isTableCharge).reduce((sum, item) => sum + item.price, 0),
        orders: lines.filter((item) => item.fromTableCharge).map((item) => ({ lineId: item.liveLineId, qty: item.qty })),
      };
    });
    const liveReceiptCharges = liveGroups.map((group) => toLiveReceiptCharge(group.table, group.chargeId));
    const customers = [...new Set([...billCharges, ...liveReceiptCharges].map((charge) => charge.customer).filter(Boolean))];
    const paidTables = [...billCharges, ...liveReceiptCharges].map((charge) => charge.tableName);

    const tx = {
      id: txId,
      date: todayStr(),
      time: nowStr(),
      cashier: cashierLabel,
      items: cart.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
        category: item.category,
        isExtra: Boolean(item.isExtra),
        ...(item.isTableCharge ? { isTableCharge: true, chargeId: item.chargeId } : {}),
        ...(item.fromTableCharge ? { fromTableCharge: true, chargeId: item.chargeId } : {}),
      })),
      // The full session details, so the receipt can show time in, time out and hours.
      tableCharges: [...billCharges, ...liveReceiptCharges],
      billLabel: activeBill.label,
      tableName: paidTables.join(", ") || activeBill.tableName,
      customerName: customers.join(", ") || activeBill.customer,
      extraCharges: [],
      subtotal,
      discLabel: "No Discount",
      discAmt,
      total,
      method,
      paymentDetails,
      status: "completed",
    };

    if (billCharges.length) {
      const paidCharges = new Map(billCharges.map((charge) => [charge.id, charge]));
      setTableCharges?.((prev) => prev.map((charge) => paidCharges.get(charge.id) || charge));
    }
    if (liveGroups.length) {
      const paidAtMs = getCurrentTimestamp();
      setTables?.((prev) =>
        prev.map((table) => {
          const group = liveGroups.find(
            (entry) => entry.table.id === table.id && entry.table.startTime === table.startTime
          );
          if (!group) return table;
          return {
            ...table,
            payments: [
              ...(table.payments || []),
              { transactionId: txId, amount: group.amount, time: group.time, method, at: paidAtMs, by: cashierLabel },
            ],
            orders: (table.orders || []).map((line) => {
              const paid = group.orders.find((entry) => entry.lineId === line.id);
              return paid ? { ...line, paidQty: Number(line.paidQty || 0) + paid.qty } : line;
            }),
          };
        })
      );
    }

    setTransactions((prev) => [tx, ...prev]);
    appendAuditLog(setLogs, {
      type: "sale",
      staff: cashierLabel,
      action: "Processed sale",
      detail: `${activeBill.label}: ${cart.length} line items${
        billCharges.length ? ` (incl. ${billCharges.map((charge) => charge.tableName).join(", ")} table time)` : ""
      }${
        liveGroups.length
          ? ` (incl. ${liveGroups.map((group) => group.table.name).join(", ")}, paid while still playing)`
          : ""
      } paid via ${method} for ₱${total.toFixed(2)}`,
      entity: "payment",
      payment: {
        transactionId: tx.id,
        total,
        subtotal,
        discount: discAmt,
        method,
        ...paymentDetails,
      },
      customer: null,
    });
    addNotification({
      message: `${cashierLabel} processed a ${method === "cash" ? "cash" : "GCash"} sale for ₱${total.toFixed(2)} (${activeBill.label}).`,
    });
    setReceipt(tx);
    // Only this bill is closed. The other tables' bills stay open, and any of this
    // bill's food not yet served stays in the queue, marked as paid.
    setOrderTickets((prev) => prev.map((ticket) => (ticket.billId === activeBill.id ? { ...ticket, billPaid: true } : ticket)));
    setBills((prev) => prev.filter((bill) => bill.id !== activeBill.id));
    setActiveBillId(null);
    setMethod("cash");
    setPaymentReviewOpen(false);
  };

  return {
    cart,
    activeBill,
    savedBillsCount,
    method,
    receipt,
    paymentReviewOpen,
    search,
    catFilter,
    tab,
    orderTickets,
    servedOrderTickets,
    cats,
    filteredProducts,
    subtotal,
    discAmt,
    total,
    unpaidTableCharges,
    liveTableBills,
    unsyncedCount,
    pendingItemsCount,
    servedItemsCount,
    billWaitingQty,
    stockAlert,
    bills,
    setReceipt,
    setPaymentReviewOpen,
    setSearch,
    setCatFilter,
    setTab,
    setMethod,
    openNewBill,
    switchBill,
    closeBill,
    describeBillRemoval,
    removeBill,
    updateBillDetails,
    addToCart,
    addTableChargeToBill,
    addLiveTableToBill,
    updateQty,
    getQueuedQty,
    sendOrderToInventory,
    setItemServed,
    markTicketServed,
    processPayment,
    confirmPayment,
  };
}
