export default function CartPanel({
  cart,
  subtotal,
  discAmt,
  total,
  method,
  discount,
  discounts,
  onUpdateQty,
  onSetMethod,
  onSetDiscount,
  onProcessPayment,
}) {
  return (
    <div className="cart-panel">
      <div className="card cart-card">
        <div className="card-body">
          <div className="cart-header">
            <i className="bi bi-cart3 me-2"></i>
            Cart
            {cart.length > 0 && <span className="cart-count">{cart.length}</span>}
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <i className="bi bi-cart3"></i>
              <p>Click items to add to cart</p>
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
                    <div className="cart-item-price">
                      ₱{Number(item.price).toFixed(2)} each
                    </div>
                  </div>

                  <div className="cart-item-qty">
                    <button
                      className="qty-btn"
                      onClick={() => onUpdateQty(item.id, item.qty - 1)}
                    >
                      <i className="bi bi-dash"></i>
                    </button>

                    <span className="qty-value">{item.qty}</span>

                    <button
                      className="qty-btn"
                      onClick={() => onUpdateQty(item.id, item.qty + 1)}
                    >
                      <i className="bi bi-plus"></i>
                    </button>
                  </div>

                  <div className="cart-item-total">
                    ₱{(item.price * item.qty).toFixed(2)}
                  </div>

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
            {discounts && (
              <div className="discount-section">
                <label className="discount-label">
                  <i className="bi bi-tag me-1"></i>
                  Discount
                </label>

                <select
                  className="discount-select"
                  value={discount}
                  onChange={(e) => onSetDiscount(e.target.value)}
                  disabled={cart.length === 0}
                >
                  {discounts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
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
                    <span>
                      ₱
                      {Number(subtotal).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="cart-discount-row">
                    <span>
                      <i className="bi bi-scissors me-1"></i>
                      {discounts?.find((d) => d.id === discount)?.label || "Discount"}
                    </span>

                    <span className="discount-amount">
                      -₱{Number(discAmt).toFixed(2)}
                    </span>
                  </div>

                  <div className="cart-total cart-total--highlighted">
                    <span>Total</span>
                    <span className="cart-total-amount">
                      ₱
                      {Number(total).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="cart-total">
                  <span>Total</span>
                  <span className="cart-total-amount">
                    ₱
                    {Number(total).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
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

            <button
              className="process-payment-btn"
              onClick={onProcessPayment}
              disabled={cart.length === 0}
            >
              <i className="bi bi-credit-card me-2"></i>
              Process Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
