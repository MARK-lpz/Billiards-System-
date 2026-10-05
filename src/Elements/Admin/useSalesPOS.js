import { useEffect, useState } from "react";
import { nowStr, readStorage, todayStr } from "./salesPosConfig";
import { appendAuditLog } from "../../utils/audit";
import { useNotifications } from "../Global/useNotifications";
import { toTableChargeLine } from "../../utils/tableCharges";

const isCompletedTicket = (ticket) =>
  ticket.status === "served" || ticket.items.every((item) => item.served);

const toServedTicket = (ticket) => ({
  ...ticket,
  status: "served",
  servedAt: ticket.servedAt || nowStr(),
  items: ticket.items.map((item) => ({ ...item, served: true })),
});

const getPendingTickets = (storageKeyPrefix) =>
  readStorage(`${storageKeyPrefix}:tickets`, []).filter((ticket) => !isCompletedTicket(ticket));

const getServedTickets = (storageKeyPrefix) => {
  const savedTickets = readStorage(`${storageKeyPrefix}:served-tickets`, []);
  const savedTicketIds = new Set(savedTickets.map((ticket) => ticket.id));
  const migratedTickets = readStorage(`${storageKeyPrefix}:tickets`, [])
    .filter(isCompletedTicket)
    .filter((ticket) => !savedTicketIds.has(ticket.id))
    .map(toServedTicket);

  return [...migratedTickets, ...savedTickets];
};

export default function useSalesPOS({
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
  const [cart, setCart] = useState(() => readStorage(`${storageKeyPrefix}:cart`, []));
  const [method, setMethod] = useState(() => readStorage(`${storageKeyPrefix}:method`, "cash"));
  const [receipt, setReceipt] = useState(null);
  const [paymentReviewOpen, setPaymentReviewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [tab, setTab] = useState("billing");
  const [orderTickets, setOrderTickets] = useState(() => getPendingTickets(storageKeyPrefix));
  const [servedOrderTickets, setServedOrderTickets] = useState(() => getServedTickets(storageKeyPrefix));
  // The order ticket of the bill being rung up, which new items are added to.
  const [activeTicketId, setActiveTicketId] = useState(() => readStorage(`${storageKeyPrefix}:active-ticket`, null));
  const [stockAlert, setStockAlert] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKeyPrefix}:cart`, JSON.stringify(cart));
      localStorage.setItem(`${storageKeyPrefix}:method`, JSON.stringify(method));
      localStorage.setItem(`${storageKeyPrefix}:tickets`, JSON.stringify(orderTickets));
      localStorage.setItem(`${storageKeyPrefix}:served-tickets`, JSON.stringify(servedOrderTickets));
      localStorage.setItem(`${storageKeyPrefix}:active-ticket`, JSON.stringify(activeTicketId));
    } catch (error) {
      console.warn("Unable to persist POS state", error);
    }
  }, [cart, method, orderTickets, servedOrderTickets, activeTicketId, storageKeyPrefix]);

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
  const isStaleTableLine = (item) => item.isTableCharge && !unpaidChargeIds.has(item.chargeId);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discAmt = 0;
  const total = Number(subtotal.toFixed(2));

  const pendingItemsCount = orderTickets.reduce(
    (sum, ticket) => sum + ticket.items.filter((item) => !item.served).length,
    0
  );
  const servedItemsCount = servedOrderTickets.reduce(
    (sum, ticket) => sum + ticket.items.reduce((itemTotal, item) => itemTotal + item.qty, 0),
    0
  );

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

  // Everything added to one running bill goes on one order ticket, so the queue
  // shows one receipt per order instead of a ticket for every item tapped. A new
  // ticket starts once the bill is paid or its ticket has been fully served.
  const queueInventoryItems = (itemsToQueue) => {
    if (!itemsToQueue.length) return;

    const stamp = Date.now();
    const openTicket = orderTickets.find((ticket) => ticket.id === activeTicketId);
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
        const newTicket = { id: ticketId, createdAt: nowStr(), date: todayStr(), status: "pending", items: itemsToQueue.map(toLine) };
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
    setActiveTicketId(ticketId);
    setCart((prev) =>
      prev.map((item) => {
        const queued = itemsToQueue.find((entry) => entry.id === item.id);
        return queued ? { ...item, syncedQty: (item.syncedQty || 0) + queued.unsyncedQty } : item;
      })
    );
  };

  // The bill's own ticket when it has one, so taking an item off this bill never
  // cancels another customer's order. Bills from before tickets were grouped
  // have no ticket of their own, so every ticket is searched for them.
  const isBillTicket = (ticket) =>
    orderTickets.some((entry) => entry.id === activeTicketId) ? ticket.id === activeTicketId : true;

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

  const addTableChargeToBill = (charge) => {
    if (!unpaidChargeIds.has(charge.id) || cart.some((item) => item.chargeId === charge.id)) return;

    setStockAlert(null);
    setCart((prev) => [...prev, toTableChargeLine(charge)]);
  };

  // Takes off any table already paid at the other counter. Returns the bill
  // that is left, and says which tables were taken off.
  const dropStaleTableLines = () => {
    const staleLines = cart.filter(isStaleTableLine);
    if (!staleLines.length) return cart;

    const nextCart = cart.filter((item) => !isStaleTableLine(item));
    setCart(nextCart);
    setStockAlert({
      productId: null,
      message: `${staleLines.map((item) => item.name.split(" · ")[0]).join(", ")} ${
        staleLines.length === 1 ? "was" : "were"
      } already paid at another counter, so ${staleLines.length === 1 ? "it was" : "they were"} taken off this bill.`,
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

    setStockAlert(null);

    setCart((prev) => {
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
      }

      return [...prev, { ...product, qty: 1, syncedQty: 0, inventoryItem: true, isExtra: false }];
    });

    queueInventoryItems([{ ...(existing || product), unsyncedQty: 1 }]);
  };

  // `allowServed` is passed only after staff confirm taking an already served
  // item off the bill; without it, only items still waiting can be removed.
  const updateQty = (id, qty, { allowServed = false } = {}) => {
    const item = cart.find((entry) => entry.id === id);
    if (!item) return 0;

    const requestedQty = Number.isFinite(Number(qty)) ? Math.max(0, Math.floor(Number(qty))) : item.qty;

    if (!item.inventoryItem) {
      // A table charge is one whole session: it is either on the bill or taken off.
      const nextQty = item.isTableCharge ? Math.min(requestedQty, 1) : requestedQty;
      setCart((prev) => {
        if (nextQty <= 0) return prev.filter((entry) => entry.id !== id);
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
    if (!cart.length) {
      setPaymentReviewOpen(false);
      return;
    }

    const paidAt = new Date().toISOString();
    const txId = Date.now();
    const billCharges = cart
      .filter((item) => item.isTableCharge)
      .map((item) => tableCharges.find((charge) => charge.id === item.chargeId))
      .filter(Boolean)
      .map((charge) => ({ ...charge, status: "paid", paidVia: method, paidAt, paidBy: cashierLabel, transactionId: txId }));
    const customers = [...new Set(billCharges.map((charge) => charge.customer).filter(Boolean))];

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
      })),
      // The full session details, so the receipt can show time in, time out and hours.
      tableCharges: billCharges,
      tableName: billCharges.map((charge) => charge.tableName).join(", "),
      customerName: customers.join(", "),
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

    setTransactions((prev) => [tx, ...prev]);
    appendAuditLog(setLogs, {
      type: "sale",
      staff: cashierLabel,
      action: "Processed sale",
      detail: `${cart.length} line items${
        billCharges.length ? ` (incl. ${tx.tableName} table time)` : ""
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
      message: `${cashierLabel} processed a ${method === "cash" ? "cash" : "GCash"} sale for ₱${total.toFixed(2)}.`,
    });
    setReceipt(tx);
    setCart([]);
    // The bill is closed, so the next customer's items start a new ticket.
    setActiveTicketId(null);
    setMethod("cash");
    setPaymentReviewOpen(false);
  };

  return {
    cart,
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
    unsyncedCount,
    pendingItemsCount,
    servedItemsCount,
    stockAlert,
    setReceipt,
    setPaymentReviewOpen,
    setSearch,
    setCatFilter,
    setTab,
    setMethod,
    addToCart,
    addTableChargeToBill,
    updateQty,
    getQueuedQty,
    sendOrderToInventory,
    setItemServed,
    markTicketServed,
    processPayment,
    confirmPayment,
  };
}
