import { useEffect, useState } from "react";
import "../../styles/Admin/SalesPOS.css";
import "../../styles/Admin/CartPanel.css";
import "../../styles/Admin/RecentTransac.css";
import ProductGrid from "../Admin/ProductGrid";
import CartPanel from "../Admin/CartPanel";
import ReceiptModal from "../Admin/ReceiptModal";

const DISCOUNTS = [
  { id: "none", label: "No Discount", pct: 0 },
  { id: "senior", label: "Senior (20%)", pct: 20 },
  { id: "pwd", label: "PWD (20%)", pct: 20 },
  { id: "promo", label: "Promo (10%)", pct: 10 },
  { id: "staff", label: "Staff (15%)", pct: 15 },
];

const defaultExtraForm = {
  name: "",
  amount: "",
  category: "Rental",
};

const fmtPeso = (value) =>
  `\u20B1${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const todayStr = () => new Date().toLocaleDateString("en-CA");

const nowStr = () =>
  new Date().toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

const readStorage = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

export default function SalesPOSModule({
  products,
  setProducts,
  transactions,
  setTransactions,
  cashierLabel = "Staff A",
  storageKeyPrefix = "shared-pos",
}) {
  const [cart, setCart] = useState(() => readStorage(`${storageKeyPrefix}:cart`, []));
  const [method, setMethod] = useState(() => readStorage(`${storageKeyPrefix}:method`, "cash"));
  const [receipt, setReceipt] = useState(null);
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState(() => readStorage(`${storageKeyPrefix}:discount`, "none"));
  const [discountAllowed, setDiscountAllowed] = useState(() =>
    readStorage(`${storageKeyPrefix}:discountAllowed`, false)
  );
  const [catFilter, setCatFilter] = useState("All");
  const [tab, setTab] = useState("billing");
  const [extraForm, setExtraForm] = useState(defaultExtraForm);
  const [orderTickets, setOrderTickets] = useState(() => readStorage(`${storageKeyPrefix}:tickets`, []));

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKeyPrefix}:cart`, JSON.stringify(cart));
      localStorage.setItem(`${storageKeyPrefix}:method`, JSON.stringify(method));
      localStorage.setItem(`${storageKeyPrefix}:discount`, JSON.stringify(discount));
      localStorage.setItem(`${storageKeyPrefix}:discountAllowed`, JSON.stringify(discountAllowed));
      localStorage.setItem(`${storageKeyPrefix}:tickets`, JSON.stringify(orderTickets));
    } catch (error) {
      console.warn("Unable to persist POS state", error);
    }
  }, [cart, method, discount, discountAllowed, orderTickets, storageKeyPrefix]);

  const cats = ["All", ...new Set(products.map((p) => p.category).filter(Boolean))];

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = catFilter === "All" || p.category === catFilter;
    return matchSearch && matchCategory && p.stock > 0;
  });

  const inventoryCartItems = cart.filter((item) => item.inventoryItem);
  const extraChargeItems = cart.filter((item) => item.isExtra);
  const unsyncedItems = inventoryCartItems
    .map((item) => ({ ...item, unsyncedQty: Math.max(0, item.qty - (item.syncedQty || 0)) }))
    .filter((item) => item.unsyncedQty > 0);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discPct = discountAllowed ? DISCOUNTS.find((d) => d.id === discount)?.pct || 0 : 0;
  const discAmt = Number(((subtotal * discPct) / 100).toFixed(2));
  const total = Number((subtotal - discAmt).toFixed(2));

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

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      const syncedQty = existing?.syncedQty || 0;
      const maxAllowed = getMaxAllowedQty(product.id, syncedQty);

      if (existing) {
        if (existing.qty >= maxAllowed) return prev;

        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }

      if (product.stock <= 0) return prev;

      return [
        ...prev,
        {
          ...product,
          qty: 1,
          syncedQty: 0,
          inventoryItem: true,
          isExtra: false,
        },
      ];
    });
  };

  const updateQty = (id, qty) => {
    setCart((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (!item) return prev;

      let nextQty = qty;

      if (item.inventoryItem) {
        const maxAllowed = getMaxAllowedQty(item.id, item.syncedQty || 0);
        nextQty = Math.max(item.syncedQty || 0, Math.min(qty, maxAllowed));
      }

      if (!item.inventoryItem) {
        nextQty = Math.max(0, qty);
      }

      if (nextQty <= 0) {
        return prev.filter((entry) => entry.id !== id);
      }

      return prev.map((entry) =>
        entry.id === id ? { ...entry, qty: nextQty } : entry
      );
    });
  };

  const addExtraCharge = () => {
    const name = extraForm.name.trim();
    const amount = Number(extraForm.amount);
    if (!name || !amount || amount <= 0) return;

    setCart((prev) => [
      ...prev,
      {
        id: `extra-${Date.now()}`,
        name,
        price: amount,
        qty: 1,
        category: extraForm.category || "Extra Charge",
        inventoryItem: false,
        isExtra: true,
      },
    ]);

    setExtraForm(defaultExtraForm);
  };

  const syncInventoryDeduction = (itemsToDeduct) => {
    if (!itemsToDeduct.length) return;

    setProducts((prev) =>
      prev.map((product) => {
        const matched = itemsToDeduct.find((item) => item.id === product.id);
        return matched
          ? { ...product, stock: Math.max(0, product.stock - matched.unsyncedQty) }
          : product;
      })
    );
  };

  const sendOrderToInventory = () => {
    if (!unsyncedItems.length) return;

    const ticketId = Date.now();
    const newTicket = {
      id: ticketId,
      createdAt: nowStr(),
      date: todayStr(),
      status: "pending",
      items: unsyncedItems.map((item) => ({
        id: `${item.id}-${ticketId}`,
        productId: item.id,
        name: item.name,
        qty: item.unsyncedQty,
        price: item.price,
        served: false,
      })),
    };

    syncInventoryDeduction(unsyncedItems);
    setOrderTickets((prev) => [newTicket, ...prev]);
    setCart((prev) =>
      prev.map((item) => {
        const pending = unsyncedItems.find((entry) => entry.id === item.id);
        return pending ? { ...item, syncedQty: item.qty } : item;
      })
    );
  };

  const setItemServed = (ticketId, itemId) => {
    setOrderTickets((prev) =>
      prev.map((ticket) => {
        if (ticket.id !== ticketId) return ticket;

        const items = ticket.items.map((item) =>
          item.id === itemId ? { ...item, served: !item.served } : item
        );
        const status = items.every((item) => item.served) ? "served" : "pending";
        return { ...ticket, items, status };
      })
    );
  };

  const markTicketServed = (ticketId) => {
    setOrderTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              status: "served",
              items: ticket.items.map((item) => ({ ...item, served: true })),
            }
          : ticket
      )
    );
  };

  const processPayment = () => {
    if (!cart.length) return;

    const remainingUnsynced = inventoryCartItems
      .map((item) => ({ ...item, unsyncedQty: Math.max(0, item.qty - (item.syncedQty || 0)) }))
      .filter((item) => item.unsyncedQty > 0);

    syncInventoryDeduction(remainingUnsynced);

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
      extraCharges: extraChargeItems.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
      })),
      subtotal,
      discLabel:
        discountAllowed && discAmt > 0
          ? DISCOUNTS.find((entry) => entry.id === discount)?.label || "Discount"
          : "No Discount",
      discAmt,
      total,
      method,
      status: "completed",
    };

    setTransactions((prev) => [tx, ...prev]);
    setReceipt(tx);
    setCart([]);
    setDiscount("none");
    setDiscountAllowed(false);
    setMethod("cash");
  };

  const renderTransactions = () => (
    <div className="order-history-layout order-history-layout--single">
      <div className="order-history-section">
        <div className="order-history-section-header completed">
          <span className="order-dot" style={{ background: "var(--green, #22c55e)" }} />
          <span>Transaction History ({transactions.length})</span>
        </div>

        {transactions.length === 0 ? (
          <div className="order-history-empty">No transactions yet.</div>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="order-history-card completed-card">
              <div className="order-history-card-header">
                <span className="order-history-cashier">
                  <i className="bi bi-receipt me-2"></i>
                  #{String(tx.id).slice(-5)}
                </span>

                <span className="order-history-total">{fmtPeso(tx.total)}</span>
              </div>

              <div className="order-history-meta">
                <i className={`bi ${tx.method === "cash" ? "bi-cash" : "bi-phone"} me-1`}></i>
                {tx.method === "cash" ? "Cash" : "eWallet"}
                {tx.time ? ` \u2022 ${tx.time}` : ""}
                {tx.date ? ` \u2022 ${tx.date}` : ""}
              </div>

              {tx.discAmt > 0 && (
                <div className="order-history-discount">
                  <i className="bi bi-tag me-1"></i>
                  {tx.discLabel} \u2022 saved {fmtPeso(tx.discAmt)}
                </div>
              )}

              <div className="order-history-items">
                {tx.items?.map((item, index) => (
                  <span key={`${tx.id}-${index}`} className="order-history-item-pill">
                    {item.name} \u00D7{item.qty}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="order-queue-page">
      <div className="order-queue-stats">
        <div className="order-queue-stat order-queue-stat--pending">
          <span className="order-queue-stat-value">{pendingItemsCount}</span>
          <span className="order-queue-stat-label">Pending Items</span>
        </div>
        <div className="order-queue-stat order-queue-stat--served">
          <span className="order-queue-stat-value">{servedItemsCount}</span>
          <span className="order-queue-stat-label">Served Items</span>
        </div>
        <div className="order-queue-stat">
          <span className="order-queue-stat-value">{orderTickets.length}</span>
          <span className="order-queue-stat-label">Order Tickets</span>
        </div>
      </div>

      {orderTickets.length === 0 ? (
        <div className="order-history-empty">No order tickets yet. Send food or drink items from the running bill.</div>
      ) : (
        <div className="order-ticket-list">
          {orderTickets.map((ticket) => {
            const pendingCount = ticket.items.filter((item) => !item.served).length;

            return (
              <div key={ticket.id} className={`order-ticket-card ${ticket.status === "served" ? "served" : "pending"}`}>
                <div className="order-ticket-header">
                  <div>
                    <div className="order-ticket-title">Order #{String(ticket.id).slice(-5)}</div>
                    <div className="order-ticket-meta">
                      Sent {ticket.createdAt} \u2022 {ticket.date}
                    </div>
                  </div>

                  <div className="order-ticket-actions">
                    <span className={`order-ticket-badge ${ticket.status}`}>
                      {ticket.status === "served" ? "All served" : `${pendingCount} pending`}
                    </span>
                    {ticket.status !== "served" && (
                      <button
                        type="button"
                        className="order-ticket-btn"
                        onClick={() => markTicketServed(ticket.id)}
                      >
                        Mark Ticket Served
                      </button>
                    )}
                  </div>
                </div>

                <div className="order-ticket-items">
                  {ticket.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`order-ticket-item ${item.served ? "served" : "pending"}`}
                      onClick={() => setItemServed(ticket.id, item.id)}
                    >
                      <div>
                        <div className="order-ticket-item-name">
                          {item.name} \u00D7{item.qty}
                        </div>
                        <div className="order-ticket-item-price">{fmtPeso(item.price * item.qty)}</div>
                      </div>
                      <span>{item.served ? "Served" : "Pending"}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="sales-pos-container">
      <div className="sales-pos-header">
        <h1 className="sales-pos-title">Sales / POS</h1>
        <p className="sales-pos-subtitle">
          Billing assistance, order taking, inventory routing, and payment handoff in one workspace.
        </p>
      </div>

      <div className="sales-pos-summary-grid">
        <div className="sales-summary-card">
          <span className="sales-summary-label">Running Bill</span>
          <span className="sales-summary-value">{fmtPeso(total)}</span>
          <span className="sales-summary-meta">{cart.length} line items in the active bill</span>
        </div>
        <div className="sales-summary-card sales-summary-card--amber">
          <span className="sales-summary-label">Awaiting Inventory</span>
          <span className="sales-summary-value">{unsyncedItems.reduce((sum, item) => sum + item.unsyncedQty, 0)}</span>
          <span className="sales-summary-meta">Food, drinks, or rentals not yet sent</span>
        </div>
        <div className="sales-summary-card sales-summary-card--blue">
          <span className="sales-summary-label">Order Queue</span>
          <span className="sales-summary-value">{pendingItemsCount}</span>
          <span className="sales-summary-meta">Pending items waiting to be served</span>
        </div>
      </div>

      <div className="pos-subtabs">
        <button
          type="button"
          className={`pos-subtab-btn ${tab === "billing" ? "active" : ""}`}
          onClick={() => setTab("billing")}
        >
          Billing Desk
        </button>

        <button
          type="button"
          className={`pos-subtab-btn ${tab === "orders" ? "active" : ""}`}
          onClick={() => setTab("orders")}
        >
          Order Queue ({pendingItemsCount})
        </button>

        <button
          type="button"
          className={`pos-subtab-btn ${tab === "recent" ? "active" : ""}`}
          onClick={() => setTab("recent")}
        >
          Transaction History ({transactions.length})
        </button>
      </div>

      {tab === "billing" && (
        <div className="sales-pos-layout">
          <div className="sales-pos-products">
            <div className="sales-pos-search">
              <i className="bi bi-search"></i>
              <input
                type="text"
                placeholder="Search food, drinks, or rentals..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {cats.length > 1 && (
              <div className="cat-pills">
                {cats.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-pill ${catFilter === cat ? "active" : ""}`}
                    onClick={() => setCatFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <ProductGrid products={filtered} cart={cart} onAddToCart={addToCart} />
          </div>

          <CartPanel
            cart={cart}
            subtotal={subtotal}
            discAmt={discAmt}
            total={total}
            method={method}
            discount={discount}
            discounts={DISCOUNTS}
            discountAllowed={discountAllowed}
            extraForm={extraForm}
            pendingCount={pendingItemsCount}
            servedCount={servedItemsCount}
            unsyncedCount={unsyncedItems.reduce((sum, item) => sum + item.unsyncedQty, 0)}
            onUpdateQty={updateQty}
            onSetMethod={setMethod}
            onSetDiscount={setDiscount}
            onToggleDiscount={() => {
              setDiscountAllowed((prev) => !prev);
              if (discountAllowed) setDiscount("none");
            }}
            onProcessPayment={processPayment}
            onSendOrder={sendOrderToInventory}
            onExtraFormChange={(field, value) => setExtraForm((prev) => ({ ...prev, [field]: value }))}
            onAddExtraCharge={addExtraCharge}
          />
        </div>
      )}

      {tab === "orders" && renderOrders()}
      {tab === "recent" && renderTransactions()}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

