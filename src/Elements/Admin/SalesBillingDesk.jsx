import { useState } from "react";
import ProductGrid from "./ProductGrid";
import CartPanel from "./CartPanel";
import TableBillsPanel from "./TableBillsPanel";
import BillDetailsModal from "./BillDetailsModal";

export default function SalesBillingDesk({
  cats,
  catFilter,
  search,
  filteredProducts,
  cart,
  activeBill,
  bills = [],
  savedBillsCount = 0,
  tables = [],
  total,
  method,
  waitingCount,
  unsyncedCount,
  stockAlert,
  unpaidTableCharges = [],
  onAddTableCharge,
  liveTableBills = [],
  onAddLiveTable,
  onSearchChange,
  onSetCategory,
  onAddToCart,
  onUpdateQty,
  getQueuedQty,
  onSetMethod,
  onProcessPayment,
  onCloseBill,
  describeBillRemoval,
  onRemoveBill,
  onUpdateBill,
}) {
  // Whether the running bill's details (who it is for) are being edited.
  const [editingBill, setEditingBill] = useState(false);
  const alertOutsideCart =
    stockAlert && !cart.some((item) => item.id === stockAlert.productId);

  const saveBill = (details) => {
    if (activeBill) onUpdateBill(activeBill.id, details);
    setEditingBill(false);
  };

  return (
    <>
      <div className="sales-pos-layout">
        <div className="sales-pos-products">
          <TableBillsPanel
            charges={unpaidTableCharges}
            liveBills={liveTableBills}
            bills={bills}
            activeBill={activeBill}
            onAddToBill={onAddTableCharge}
            onAddLive={onAddLiveTable}
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
          total={total}
          method={method}
          waitingCount={waitingCount}
          unsyncedCount={unsyncedCount}
          stockAlert={stockAlert}
          savedBillsCount={savedBillsCount}
          onUpdateQty={onUpdateQty}
          getQueuedQty={getQueuedQty}
          onSetMethod={onSetMethod}
          onProcessPayment={onProcessPayment}
          onEditBill={() => setEditingBill(true)}
          onCloseBill={onCloseBill}
          describeBillRemoval={describeBillRemoval}
          onRemoveBill={onRemoveBill}
        />
      </div>

      {editingBill && activeBill && (
        <BillDetailsModal
          bill={activeBill}
          tables={tables}
          bills={bills}
          onSave={saveBill}
          onClose={() => setEditingBill(false)}
        />
      )}
    </>
  );
}
