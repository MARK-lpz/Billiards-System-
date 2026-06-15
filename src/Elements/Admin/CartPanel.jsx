import { useEffect, useState } from "react";

export default function CartPanel({
  cart,
  subtotal,
  total,
  method,
  pendingCount,
  servedCount,
  unsyncedCount,
  onUpdateQty,
  onSetMethod,
  onProcessPayment,
}) {
  const [qtyDrafts, setQtyDrafts] = useState({});

  const fmtPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  useEffect(() => {
    setQtyDrafts((prev) =>
      Object.fromEntries(
        cart
          .filter((item) => prev[item.id] !== undefined)
          .map((item) => [item.id, prev[item.id]])
      )
    );
  }, [cart]);

  const commitQty = (item) => {
    const draft = qtyDrafts[item.id];
    if (draft === undefined) return;

    const parsedQty = Number.parseInt(draft, 10);
    onUpdateQty(item.id, Number.isNaN(parsedQty) ? item.qty : parsedQty);

    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };

  return (
    <div className="cart-panel">
      <div className="card cart-card">
        <div className="card-body">
          <div className="cart-header">
            <i className="bi bi-cart3 me-2"></i>
            Running Bill
            {cart.length > 0 && <span className="cart-count">{cart.length}</span>}
          </div>

          <div className="cart-service-strip">
            <div className="cart-service-pill">
              <span className="cart-service-label">Pending</span>
              <strong>{pendingCount}</strong>
            </div>
            <div className="cart-service-pill">
              <span className="cart-service-label">Served</span>
              <strong>{servedCount}</strong>
            </div>
            <div className={`cart-service-pill ${unsyncedCount > 0 ? "attention" : ""}`}>
              <span className="cart-service-label">Inventory</span>
              <strong>{unsyncedCount > 0 ? unsyncedCount : "Auto"}</strong>
            </div>
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <i className="bi bi-cart3"></i>
              <p>Build the running bill with inventory items and table services.</p>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="cart-item"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div className="cart-item-details">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-type">{item.category || "Uncategorized"}</div>
                    <div className="cart-item-price">{fmtPeso(item.price)} each</div>
                    <div className="cart-item-meta">
                      {item.syncedQty === item.qty
                        ? "Sent to inventory automatically"
                        : `${Math.max(0, item.qty - (item.syncedQty || 0))} syncing to inventory`}
                    </div>
                  </div>

                  <div className="cart-item-qty">
                    <button type="button" className="qty-btn" onClick={() => onUpdateQty(item.id, item.qty - 1)}>
                      <i className="bi bi-dash"></i>
                    </button>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      className="qty-input"
                      value={qtyDrafts[item.id] ?? String(item.qty)}
                      onChange={(event) =>
                        setQtyDrafts((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      onBlur={() => commitQty(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitQty(item);
                        }
                      }}
                    />

                    <button type="button" className="qty-btn" onClick={() => onUpdateQty(item.id, item.qty + 1)}>
                      <i className="bi bi-plus"></i>
                    </button>
                  </div>

                  <div className="cart-item-total">{fmtPeso(item.price * item.qty)}</div>

                  <button
                    type="button"
                    onClick={() => onUpdateQty(item.id, 0)}
                    aria-label={`Remove ${item.name}`}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      fontSize: "14px",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="cart-footer">
            <div className="cart-totals">
              <div className="cart-subtotal-row">
                <span>Subtotal</span>
                <span>{fmtPeso(subtotal)}</span>
              </div>

              <div className="cart-total">
                <span>Total</span>
                <span className="cart-total-amount">{fmtPeso(total)}</span>
              </div>
            </div>

            <div className="payment-methods">
              <button
                className={`payment-method-btn ${method === "cash" ? "active" : ""}`}
                onClick={() => onSetMethod("cash")}
              >
                <i className="bi bi-cash me-2"></i>
                Cash
              </button>

              <button
                className={`payment-method-btn ${method === "ewallet" ? "active" : ""}`}
                onClick={() => onSetMethod("ewallet")}
              >
                <i className="bi bi-phone me-2"></i>
                eWallet
              </button>
            </div>

            {method === "ewallet" && (
              <div className="gcash-qr-panel">
                <div className="gcash-qr-copy">
                  <strong>GCash QR Payment</strong>
                  <span>Let the customer scan before confirming payment.</span>
                </div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`GCash Break & Chill amount ${total.toFixed(2)}`)}`}
                  alt="GCash payment QR code"
                />
              </div>
            )}

            <button className="process-payment-btn" onClick={onProcessPayment} disabled={cart.length === 0}>
              <i className="bi bi-credit-card me-2"></i>
              Send Total To Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
