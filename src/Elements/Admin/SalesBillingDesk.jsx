import ProductGrid from "./ProductGrid";
import CartPanel from "./CartPanel";

export default function SalesBillingDesk({
  cats,
  catFilter,
  search,
  filteredProducts,
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
  onSearchChange,
  onSetCategory,
  onAddToCart,
  onUpdateQty,
  onSetMethod,
  onSetDiscount,
  onToggleDiscount,
  onProcessPayment,
  onExtraFormChange,
  onAddExtraCharge,
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
        discAmt={discAmt}
        total={total}
        method={method}
        discount={discount}
        discounts={discounts}
        discountAllowed={discountAllowed}
        extraForm={extraForm}
        pendingCount={pendingCount}
        servedCount={servedCount}
        unsyncedCount={unsyncedCount}
        onUpdateQty={onUpdateQty}
        onSetMethod={onSetMethod}
        onSetDiscount={onSetDiscount}
        onToggleDiscount={onToggleDiscount}
        onProcessPayment={onProcessPayment}
        onExtraFormChange={(field, value) => onExtraFormChange(field, value)}
        onAddExtraCharge={onAddExtraCharge}
      />
    </div>
  );
}
