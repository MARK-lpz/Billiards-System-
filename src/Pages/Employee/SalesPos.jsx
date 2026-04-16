import { useState } from "react";
import "../../styles/Admin/SalesPOS.css";
import "../../styles/Admin/CartPanel.css";
import "../../styles/Admin/RecentTransac.css";
import ProductGrid from "../../Elements/Admin/ProductGrid";
import CartPanel from "../../Elements/Admin/CartPanel";
import ReceiptModal from "../../Elements/Admin/ReceiptModal";

const DISCOUNTS = [
  { id: "none", label: "No Discount", pct: 0 },
  { id: "senior", label: "Senior (20%)", pct: 20 },
  { id: "pwd", label: "PWD (20%)", pct: 20 },
  { id: "promo", label: "Promo (10%)", pct: 10 },
  { id: "staff", label: "Staff (15%)", pct: 15 },
];

const todayStr = () => new Date().toLocaleDateString("en-CA");

const nowStr = () =>
  new Date().toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function SalesPOS({
  products,
  setProducts,
  transactions,
  setTransactions,
}) {
  const [cart, setCart] = useState([]);
  const [method, setMethod] = useState("cash");
  const [receipt, setReceipt] = useState(null);
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState("none");
  const [catFilter, setCatFilter] = useState("All");
  const [tab, setTab] = useState("pos");

  const cats = [
    "All",
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = catFilter === "All" || p.category === catFilter;
    return matchSearch && matchCategory && p.stock > 0;
  });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discPct = DISCOUNTS.find((d) => d.id === discount)?.pct || 0;
  const discAmt = Number(((subtotal * discPct) / 100).toFixed(2));
  const total = Number((subtotal - discAmt).toFixed(2));

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }

      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    setCart((prev) => {
      if (qty <= 0) {
        return prev.filter((item) => item.id !== id);
      }

      return prev.map((item) =>
        item.id === id ? { ...item, qty } : item
      );
    });
  };

  const processPayment = () => {
    if (!cart.length) return;

    const tx = {
      id: Date.now(),
      date: todayStr(),
      time: nowStr(),
      cashier: "Staff A",
      items: cart.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
      })),
      subtotal,
      discLabel:
        DISCOUNTS.find((d) => d.id === discount)?.label || "No Discount",
      discAmt,
      total,
      method,
      status: "completed",
    };

    setTransactions((prev) => [tx, ...prev]);

    setProducts((prev) =>
      prev.map((p) => {
        const cartItem = cart.find((i) => i.id === p.id);
        return cartItem ? { ...p, stock: p.stock - cartItem.qty } : p;
      })
    );

    setReceipt(tx);
    setCart([]);
    setDiscount("none");
    setMethod("cash");
  };

  const renderTransactions = () => (
    <div className="order-history-layout">
      <div className="order-history-section">
        <div className="order-history-section-header completed">
          <span
            className="order-dot"
            style={{ background: "var(--green, #22c55e)" }}
          />
          <span>Transaction History ({transactions.length})</span>
        </div>

        {transactions.length === 0 ? (
          <div className="order-history-empty">No transactions yet.</div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="order-history-card completed-card"
            >
              <div className="order-history-card-header">
                <span className="order-history-cashier">
                  <i className="bi bi-receipt me-2"></i>
                  #{String(tx.id).slice(-5)}
                </span>

                <span className="order-history-total">
                  ₱
                  {Number(tx.total).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="order-history-meta">
                <i
                  className={`bi ${
                    tx.method === "cash" ? "bi-cash" : "bi-phone"
                  } me-1`}
                ></i>
                {tx.method === "cash" ? "Cash" : "eWallet"}
                {tx.time ? ` • ${tx.time}` : ""}
                {tx.date ? ` • ${tx.date}` : ""}
              </div>

              {tx.discAmt > 0 && (
                <div className="order-history-discount">
                  <i className="bi bi-tag me-1"></i>
                  {tx.discLabel} • saved ₱{Number(tx.discAmt).toFixed(2)}
                </div>
              )}

              <div className="order-history-items">
                {tx.items?.map((item, index) => (
                  <span key={index} className="order-history-item-pill">
                    {item.name} ×{item.qty}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="sales-pos-container">
      <div className="sales-pos-header">
        <h1 className="sales-pos-title">Sales / POS</h1>
        <p className="sales-pos-subtitle">
          Process transactions and manage sales
        </p>
      </div>

      <div className="pos-subtabs">
        <button
          type="button"
          className={`pos-subtab-btn ${tab === "pos" ? "active" : ""}`}
          onClick={() => setTab("pos")}
        >
          Point of Sale
        </button>

        <button
          type="button"
          className={`pos-subtab-btn ${tab === "recent" ? "active" : ""}`}
          onClick={() => setTab("recent")}
        >
          Transaction History ({transactions.length})
        </button>
      </div>

      {tab === "pos" && (
        <div className="sales-pos-layout">
          <div className="sales-pos-products">
            <div className="sales-pos-search">
              <i className="bi bi-search"></i>
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

            <ProductGrid
              products={filtered}
              cart={cart}
              onAddToCart={addToCart}
            />
          </div>

          <CartPanel
            cart={cart}
            subtotal={subtotal}
            discAmt={discAmt}
            total={total}
            method={method}
            discount={discount}
            discounts={DISCOUNTS}
            onUpdateQty={updateQty}
            onSetMethod={setMethod}
            onSetDiscount={setDiscount}
            onProcessPayment={processPayment}
          />
        </div>
      )}

      {tab === "recent" && renderTransactions()}

      {receipt && (
        <ReceiptModal
          receipt={receipt}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
