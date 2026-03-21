export default function CartPanel({ 
  cart, 
  total, 
  method, 
  transactions, 
  onUpdateQty, 
  onSetMethod, 
  onProcessPayment 
}) {
  return (
    <div className="cart-panel">
      {/* Cart */}
      <div className="card cart-card">
        <div className="card-body">
          <div className="cart-header">
            <i className="bi bi-cart3 me-2"></i>
            Cart
            {cart.length > 0 && (
              <span className="cart-count">{cart.length}</span>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <i className="bi bi-cart3"></i>
              <p>Click items to add to cart</p>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-details">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">₱{item.price} each</div>
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
                </div>
              ))}
            </div>
          )}

          <div className="cart-footer">
            <div className="cart-total">
              <span>Total</span>
              <span className="cart-total-amount">₱{total.toLocaleString()}</span>
            </div>

            <div className="payment-methods">
              <button
                className={`payment-method-btn ${method === 'cash' ? 'active' : ''}`}
                onClick={() => onSetMethod('cash')}
              >
                <i className="bi bi-cash me-2"></i>
                Cash
              </button>
              <button
                className={`payment-method-btn ${method === 'ewallet' ? 'active' : ''}`}
                onClick={() => onSetMethod('ewallet')}
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

      {/* Recent Transactions */}
      <div className="card recent-transactions-card">
        <div className="card-body">
          <h6 className="recent-transactions-title">Recent Transactions</h6>
          <div className="recent-transactions-list">
            {transactions.slice(0, 4).map(tx => (
              <div key={tx.id} className="recent-transaction-item">
                <div className="recent-transaction-header">
                  <span className="recent-transaction-id">#{tx.id}</span>
                  <span className="recent-transaction-total">₱{tx.total.toLocaleString()}</span>
                </div>
                <div className="recent-transaction-items">
                  {tx.items.map(i => i.name).join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}