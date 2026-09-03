import ProductGrid from "./ProductGrid";
import CartPanel from "./CartPanel";

export default function SalesBillingDesk({
  cats,
  catFilter,
  search,
  filteredProducts,
  cart,
  subtotal,
  total,
  method,
  pendingCount,
  servedCount,
  unsyncedCount,
  stockAlert,
  onSearchChange,
  onSetCategory,
  onAddToCart,
  onUpdateQty,
  onSetMethod,
  onProcessPayment,
}) {
  return (
    <div className="sales-pos-layout">
      <div className="sales-pos-products">
        <div className="sales-pos-search">
          <i className="bi bi-search"></i>
          <input
            type="text"
            placeholder="Search food, drinks, or rentals..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        {cats.length > 1 && (
          <div className="cat-pills">
            {cats.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cat-pill ${catFilter === cat ? "active" : ""}`}
                onClick={() => onSetCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <ProductGrid products={filteredProducts} cart={cart} onAddToCart={onAddToCart} />
      </div>

      <CartPanel
        cart={cart}
        subtotal={subtotal}
        total={total}
        method={method}
        pendingCount={pendingCount}
        servedCount={servedCount}
        unsyncedCount={unsyncedCount}
        stockAlert={stockAlert}
        onUpdateQty={onUpdateQty}
        onSetMethod={onSetMethod}
        onProcessPayment={onProcessPayment}
      />
    </div>
  );
}
