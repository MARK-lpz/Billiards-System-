import { useEffect, useState } from "react";
import { nowStr, readStorage, todayStr } from "./salesPosConfig";
import { appendAuditLog } from "../../utils/audit";
import { useNotifications } from "../Global/useNotifications";

export default function useSalesPOS({
  products,
  setProducts,
  transactions,
  setTransactions,
  setLogs,
  cashierLabel,
  storageKeyPrefix,
}) {
  const { addNotification } = useNotifications();
  const [cart, setCart] = useState(() => readStorage(`${storageKeyPrefix}:cart`, []));
  const [method, setMethod] = useState(() => readStorage(`${storageKeyPrefix}:method`, "cash"));
  const [receipt, setReceipt] = useState(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [tab, setTab] = useState("billing");
  const [orderTickets, setOrderTickets] = useState(() => readStorage(`${storageKeyPrefix}:tickets`, []));

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKeyPrefix}:cart`, JSON.stringify(cart));
      localStorage.setItem(`${storageKeyPrefix}:method`, JSON.stringify(method));
      localStorage.setItem(`${storageKeyPrefix}:tickets`, JSON.stringify(orderTickets));
    } catch (error) {
      console.warn("Unable to persist POS state", error);
    }
  }, [cart, method, orderTickets, storageKeyPrefix]);

  const cats = ["All", ...new Set(products.map((product) => product.category).filter(Boolean))];
  const filteredProducts = products.filter((product) => {
    const matchSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = catFilter === "All" || product.category === catFilter;
    return matchSearch && matchCategory && product.stock > 0;
  });

  const inventoryCartItems = cart.filter((item) => item.inventoryItem);
  const unsyncedItems = inventoryCartItems
    .map((item) => ({ ...item, unsyncedQty: Math.max(0, item.qty - (item.syncedQty || 0)) }))
    .filter((item) => item.unsyncedQty > 0);
  const unsyncedCount = unsyncedItems.reduce((sum, item) => sum + item.unsyncedQty, 0);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discAmt = 0;
  const total = Number(subtotal.toFixed(2));

  const pendingItemsCount = orderTickets.reduce(
    (sum, ticket) => sum + ticket.items.filter((item) => !item.served).length,
    0
  );
  const servedItemsCount = orderTickets.reduce(
    (sum, ticket) => sum + ticket.items.filter((item) => item.served).length,
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

  const queueInventoryItems = (itemsToQueue) => {
    if (!itemsToQueue.length) return;

    const ticketId = Date.now();
    const newTicket = {
      id: ticketId,
      createdAt: nowStr(),
      date: todayStr(),
      status: "pending",
      items: itemsToQueue.map((item) => ({
        id: `${item.id}-${ticketId}`,
        productId: item.id,
        name: item.name,
        qty: item.unsyncedQty,
        price: item.price,
        served: false,
      })),
    };

    syncInventoryDeduction(itemsToQueue);
    setOrderTickets((prev) => [newTicket, ...prev]);
    setCart((prev) =>
      prev.map((item) => {
        const queued = itemsToQueue.find((entry) => entry.id === item.id);
        return queued ? { ...item, syncedQty: (item.syncedQty || 0) + queued.unsyncedQty } : item;
      })
    );
  };

  const restoreInventoryItems = (productId, qtyToRestore) => {
    let remaining = qtyToRestore;

    setOrderTickets((prev) =>
      prev
        .map((ticket) => {
          if (!remaining) return ticket;

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
        .filter(Boolean)
    );

    const restoredQty = qtyToRestore - remaining;
    if (!restoredQty) return 0;

    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, stock: product.stock + restoredQty } : product
      )
    );

    return restoredQty;
  };

  const addToCart = (product) => {
    const existing = cart.find((item) => item.id === product.id);
    const syncedQty = existing?.syncedQty || 0;
    const maxAllowed = getMaxAllowedQty(product.id, syncedQty);

    if (existing && existing.qty >= maxAllowed) return;
    if (!existing && product.stock <= 0) return;

    setCart((prev) => {
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
      }

      return [...prev, { ...product, qty: 1, syncedQty: 0, inventoryItem: true, isExtra: false }];
    });

    queueInventoryItems([{ ...(existing || product), unsyncedQty: 1 }]);
  };

  const updateQty = (id, qty) => {
    const item = cart.find((entry) => entry.id === id);
    if (!item) return;

    if (!item.inventoryItem) {
      const nextQty = Math.max(0, qty);
      setCart((prev) => {
        if (nextQty <= 0) return prev.filter((entry) => entry.id !== id);
        return prev.map((entry) => (entry.id === id ? { ...entry, qty: nextQty } : entry));
      });
      return;
    }

    const clampedQty = Math.max(0, Math.min(qty, getMaxAllowedQty(item.id, item.syncedQty || 0)));
    const delta = clampedQty - item.qty;
    if (!delta) return;

    if (delta > 0) {
      setCart((prev) => prev.map((entry) => (entry.id === id ? { ...entry, qty: clampedQty } : entry)));
      queueInventoryItems([{ ...item, unsyncedQty: delta }]);
      return;
    }

    const restoredQty = restoreInventoryItems(item.id, Math.abs(delta));
    const nextQty = item.qty - restoredQty;
    const nextSyncedQty = Math.max(0, (item.syncedQty || 0) - restoredQty);

    setCart((prev) => {
      if (nextQty <= 0) return prev.filter((entry) => entry.id !== id);
      return prev.map((entry) =>
        entry.id === id ? { ...entry, qty: nextQty, syncedQty: nextSyncedQty } : entry
      );
    });
  };

  const sendOrderToInventory = () => {
    queueInventoryItems(unsyncedItems);
  };

  const setItemServed = (ticketId, itemId) => {
    setOrderTickets((prev) =>
      prev.map((ticket) => {
        if (ticket.id !== ticketId) return ticket;
        const items = ticket.items.map((item) => (item.id === itemId ? { ...item, served: !item.served } : item));
        const status = items.every((item) => item.served) ? "served" : "pending";
        return { ...ticket, items, status };
      })
    );
  };

  const markTicketServed = (ticketId) => {
    setOrderTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, status: "served", items: ticket.items.map((item) => ({ ...item, served: true })) }
          : ticket
      )
    );
  };

  const processPayment = () => {
    if (!cart.length) return;

    const tx = {
      id: Date.now(),
      date: todayStr(),
      time: nowStr(),
      cashier: cashierLabel,
      items: cart.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
        category: item.category,
        isExtra: Boolean(item.isExtra),
      })),
      extraCharges: [],
      subtotal,
      discLabel: "No Discount",
      discAmt,
      total,
      method,
      status: "completed",
    };

    setTransactions((prev) => [tx, ...prev]);
    appendAuditLog(setLogs, {
      type: "sale",
      staff: cashierLabel,
      action: "Processed sale",
      detail: `${cart.length} line items paid via ${method} for ₱${total.toFixed(2)}`,
      entity: "payment",
      payment: {
        transactionId: tx.id,
        total,
        subtotal,
        discount: discAmt,
        method,
      },
      customer: null,
    });
    addNotification({
      message: `${cashierLabel} processed a ${method === "cash" ? "cash" : "GCash"} sale for ₱${total.toFixed(2)}.`,
    });
    setReceipt(tx);
    setCart([]);
    setMethod("cash");
  };

  return {
    cart,
    method,
    receipt,
    search,
    catFilter,
    tab,
    orderTickets,
    cats,
    filteredProducts,
    subtotal,
    discAmt,
    total,
    unsyncedCount,
    pendingItemsCount,
    servedItemsCount,
    setReceipt,
    setSearch,
    setCatFilter,
    setTab,
    setMethod,
    addToCart,
    updateQty,
    sendOrderToInventory,
    setItemServed,
    markTicketServed,
    processPayment,
  };
}
