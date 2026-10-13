import { useState } from "react";
import ProductGrid from "./ProductGrid";
import CartPanel from "./CartPanel";
import TableBillsPanel from "./TableBillsPanel";
import OpenBillsBar from "./OpenBillsBar";
import BillDetailsModal from "./BillDetailsModal";

export default function SalesBillingDesk({
  cats,
  catFilter,
  search,
  filteredProducts,
  cart,
  activeBill,
  bills = [],
  openBills = [],
  tables = [],
  subtotal,
  total,
  method,
  waitingCount,
  servedCount,
  unsyncedCount,
  stockAlert,
  unpaidTableCharges = [],
  onAddTableCharge,
  onSearchChange,
  onSetCategory,
  onAddToCart,
  onUpdateQty,
  getQueuedQty,
  onSetMethod,
  onProcessPayment,
  onOpenBill,
  onSwitchBill,
  onCloseBill,
  onUpdateBill,
}) {
  // "new" for a new bill, "edit" for the bill being rung up, or null.
  const [billModal, setBillModal] = useState(null);
  const alertOutsideCart =
    stockAlert && !cart.some((item) => item.id === stockAlert.productId);

  const saveBill = (details) => {
    if (billModal === "edit" && activeBill) onUpdateBill(activeBill.id, details);
    else onOpenBill(details);
    setBillModal(null);
  };

  return (
    <>
      <OpenBillsBar
        bills={openBills}
        activeBillId={activeBill?.id ?? null}
        onSwitch={onSwitchBill}
        onNewBill={() => setBillModal("new")}
      />

      <div className="sales-pos-layout">
        <div className="sales-pos-products">
          <TableBillsPanel
            charges={unpaidTableCharges}
            bills={bills}
            activeBill={activeBill}
            onAddToBill={onAddTableCharge}
          />

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

          {alertOutsideCart && (
            <div className="sales-stock-alert" role="alert">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{stockAlert.message}</span>
            </div>
          )}

          <ProductGrid products={filteredProducts} cart={cart} onAddToCart={onAddToCart} />
        </div>

        {/* A fresh panel per bill, so a half-typed quantity never carries over to another table. */}
        <CartPanel
          key={activeBill?.id ?? "no-bill"}
          cart={cart}
          activeBill={activeBill}
          subtotal={subtotal}
          total={total}
          method={method}
          waitingCount={waitingCount}
          servedCount={servedCount}
          unsyncedCount={unsyncedCount}
          stockAlert={stockAlert}
          onUpdateQty={onUpdateQty}
          getQueuedQty={getQueuedQty}
          onSetMethod={onSetMethod}
          onProcessPayment={onProcessPayment}
          onEditBill={() => setBillModal("edit")}
          onCloseBill={onCloseBill}
        />
      </div>

      {billModal && (
        <BillDetailsModal
          bill={billModal === "edit" ? activeBill : null}
          tables={tables}
          bills={bills}
          onSave={saveBill}
          onClose={() => setBillModal(null)}
        />
      )}
    </>
  );
}
