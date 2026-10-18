import { useEffect, useState } from "react";
import "../../styles/Admin/PoolTables.css";
import { formatPeso } from "../../utils/tableSession";
import { MAX_ORDER_QTY, countOrderItems, getTableOrders, sumOrders, unpaidQty } from "../../utils/tableOrders";

/**
 * Takes a food and drink order for a table that is playing, without leaving
 * Pool Tables. What is ordered is added to the table's bill and paid with the
 * table time when the session ends; it also shows in the Sales / POS Order Queue.
 */
export default function TableOrderModal({ table, products = [], onPlace, onTakeOff, onClose }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  // The new order: { productId: qty }.
  const [draft, setDraft] = useState({});

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const tableName = table.name || `Table ${table.id}`;
  const orders = getTableOrders(table);
  const categories = ["All", ...new Set(products.map((product) => product.category).filter(Boolean))];
  const query = search.trim().toLowerCase();
  const shown = products.filter(
    (product) =>
      (category === "All" || product.category === category) && String(product.name).toLowerCase().includes(query)
  );

  const stockOf = (product) => Math.max(0, Number(product.stock) || 0);
  const draftLines = products
    .filter((product) => draft[product.id] > 0)
    .map((product) => ({ ...product, qty: draft[product.id] }));
  const draftCount = countOrderItems(draftLines);
  const draftTotal = sumOrders(draftLines);

  const setQty = (product, qty) =>
    setDraft((prev) => ({ ...prev, [product.id]: Math.max(0, Math.min(qty, stockOf(product), MAX_ORDER_QTY)) }));

  const place = () => {
    if (onPlace(draft)) setDraft({});
  };

  return (
    <>
      <div className="modal show" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="table-order-title">
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content table-order-modal">
            <div className="modal-header">
              <h5 className="modal-title" id="table-order-title">
                <i className="bi bi-cup-hot"></i>
                Order · {tableName}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              <p className="table-order-for">
                <i className="bi bi-person-fill"></i>
                {table.customer || "Walk-in Customer"} · added to this table&apos;s bill, paid when the session ends
              </p>

              <div className="table-order-filters">
                <input
                  type="search"
                  className="form-control table-order-search"
                  placeholder="Search food and drinks"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search products"
                  autoFocus
                />
                <div className="table-order-cats" role="group" aria-label="Category">
                  {categories.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      className={`table-order-cat ${category === entry ? "active" : ""}`}
                      aria-pressed={category === entry}
                      onClick={() => setCategory(entry)}
                    >
                      {entry}
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-order-products">
                {shown.length === 0 ? (
                  <p className="table-order-empty">No products match. Try another search or category.</p>
                ) : (
                  shown.map((product) => {
                    const stock = stockOf(product);
                    const qty = draft[product.id] || 0;
                    return (
                      <div key={product.id} className={`table-order-product ${stock === 0 ? "is-out" : ""} ${qty ? "is-picked" : ""}`}>
                        <div className="table-order-product-info">
                          <span className="table-order-product-name">{product.name}</span>
                          <span className="table-order-product-meta">
                            {formatPeso(product.price)} · {stock === 0 ? "Out of stock" : `${stock} left`}
                          </span>
                        </div>
                        <div className="table-order-stepper">
                          <button type="button" onClick={() => setQty(product, qty - 1)} disabled={!qty} aria-label={`One less ${product.name}`}>
                            <i className="bi bi-dash"></i>
                          </button>
                          <span aria-live="polite">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(product, qty + 1)}
                            disabled={qty >= Math.min(stock, MAX_ORDER_QTY)}
                            aria-label={`One more ${product.name}`}
                          >
                            <i className="bi bi-plus"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {orders.length > 0 && (
                <div className="table-order-placed">
                  <div className="table-order-placed-head">
                    <span>Already ordered</span>
                    <strong>{formatPeso(sumOrders(orders))}</strong>
                  </div>
                  {orders.map((line) => {
                    const paid = unpaidQty(line) === 0;
                    // Only a waiting item not yet paid can come off: a served one
                    // was handed over, a paid one is on a receipt.
                    const blocked = line.served ? "Already served" : paid ? "Already paid" : "";
                    return (
                      <div key={line.id} className="table-order-placed-line">
                        <span className="table-order-placed-name">
                          {line.name} ×{line.qty}
                        </span>
                        <span className="table-order-tags">
                          {line.paidQty > 0 && (
                            <span className="table-order-status paid">{paid ? "Paid" : `${line.paidQty} paid`}</span>
                          )}
                          <span className={`table-order-status ${line.served ? "served" : "waiting"}`}>
                            {line.served ? "Served" : "Waiting"}
                          </span>
                        </span>
                        <span className="table-order-placed-price">{formatPeso(line.price * line.qty)}</span>
                        <button
                          type="button"
                          className="table-order-remove"
                          onClick={() => onTakeOff(line.id)}
                          disabled={Boolean(blocked)}
                          aria-label={`Take one ${line.name} off`}
                          title={blocked || "Take one off and return it to stock"}
                        >
                          <i className="bi bi-dash-circle"></i>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer table-order-footer">
              <span className="table-order-summary">
                {draftCount ? (
                  <>
                    New order: <strong>{draftCount} {draftCount === 1 ? "item" : "items"}</strong> · {formatPeso(draftTotal)}
                  </>
                ) : (
                  "Pick items with + to start an order."
                )}
              </span>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-success" onClick={place} disabled={!draftCount}>
                <i className="bi bi-plus-circle"></i>
                Add to {tableName}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
