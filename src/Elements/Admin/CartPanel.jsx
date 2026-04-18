export default function CartPanel({
  cart,
  subtotal,
  discAmt,
  total,
  method,
  discount,
  discounts,
  discountAllowed,
  extraForm,
  pendingCount,
  servedCount,
  unsyncedCount,
  onUpdateQty,
  onSetMethod,
  onSetDiscount,
  onToggleDiscount,
  onProcessPayment,
  onSendOrder,
  onExtraFormChange,
  onAddExtraCharge,
}) {
  const fmtPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

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
              <span className="cart-service-label">To Inventory</span>
              <strong>{unsyncedCount}</strong>
            </div>
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <i className="bi bi-cart3"></i>
              <p>Build the running bill with orders, rentals, and extra charges.</p>
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
                    <div className="cart-item-price">{fmtPeso(item.price)} each</div>
                    <div className="cart-item-meta">
                      {item.isExtra
                        ? `${item.category || "Extra charge"} • Manual charge`
                        : item.syncedQty === item.qty
                          ? "Sent to inventory"
                          : `${Math.max(0, item.qty - (item.syncedQty || 0))} waiting to send`}
                    </div>
                  </div>

                  <div className="cart-item-qty">
                    <button className="qty-btn" onClick={() => onUpdateQty(item.id, item.qty - 1)}>
                      <i className="bi bi-dash"></i>
                    </button>

                    <span className="qty-value">{item.qty}</span>

                    <button className="qty-btn" onClick={() => onUpdateQty(item.id, item.qty + 1)}>
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
            <div className="extra-charge-box">
              <div className="extra-charge-title">
                <i className="bi bi-plus-circle me-1"></i>
                Add Extra Charge
              </div>

              <div className="extra-charge-grid">
                <input
                  className="discount-select"
                  placeholder="Charge name"
                  value={extraForm.name}
                  onChange={(event) => onExtraFormChange("name", event.target.value)}
                />

                <input
                  className="discount-select"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={extraForm.amount}
                  onChange={(event) => onExtraFormChange("amount", event.target.value)}
                />

                <select
                  className="discount-select"
                  value={extraForm.category}
                  onChange={(event) => onExtraFormChange("category", event.target.value)}
                >
                  <option value="Rental">Rental</option>
                  <option value="Service">Service</option>
                  <option value="Adjustment">Adjustment</option>
                </select>

                <button type="button" className="cart-secondary-btn" onClick={onAddExtraCharge}>
                  Add Charge
                </button>
              </div>
            </div>

            {discounts && (
              <div className="discount-section">
                <button type="button" className={`discount-toggle ${discountAllowed ? "active" : ""}`} onClick={onToggleDiscount}>
                  <i className="bi bi-tag me-1"></i>
                  {discountAllowed ? "Discount Allowed" : "Discount Locked"}
                </button>

                <select
                  className="discount-select"
                  value={discount}
                  onChange={(event) => onSetDiscount(event.target.value)}
                  disabled={cart.length === 0 || !discountAllowed}
                >
                  {discounts.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="cart-totals">
              {discAmt > 0 ? (
                <>
                  <div className="cart-subtotal-row">
                    <span>Subtotal</span>
                    <span>{fmtPeso(subtotal)}</span>
                  </div>

                  <div className="cart-discount-row">
                    <span>
                      <i className="bi bi-scissors me-1"></i>
                      {discounts?.find((entry) => entry.id === discount)?.label || "Discount"}
                    </span>

                    <span className="discount-amount">-{fmtPeso(discAmt)}</span>
                  </div>

                  <div className="cart-total cart-total--highlighted">
                    <span>Total</span>
                    <span className="cart-total-amount">{fmtPeso(total)}</span>
                  </div>
                </>
              ) : (
                <div className="cart-total">
                  <span>Total</span>
                  <span className="cart-total-amount">{fmtPeso(total)}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              className="cart-secondary-btn cart-secondary-btn--full"
              onClick={onSendOrder}
              disabled={unsyncedCount === 0}
            >
              <i className="bi bi-send-check me-2"></i>
              Send Order To Inventory
            </button>

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
