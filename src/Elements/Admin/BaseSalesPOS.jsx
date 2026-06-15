import ReceiptModal from "./ReceiptModal";
import SalesBillingDesk from "./SalesBillingDesk";
import SalesOrderQueue from "./SalesOrderQueue";
import SalesPosTabs from "./SalesPosTabs";
import SalesSummary from "./SalesSummary";
import SalesTransactionHistory from "./SalesTransactionHistory";
import useSalesPOS from "./useSalesPOS";

export default function BaseSalesPOS({
  products,
  setProducts,
  transactions,
  setTransactions,
  setLogs,
  cashierLabel = "Staff A",
  storageKeyPrefix = "shared-pos",
}) {
  const salesPos = useSalesPOS({
    products,
    setProducts,
    transactions,
    setTransactions,
    setLogs,
    cashierLabel,
    storageKeyPrefix,
  });

  return (
    <div className="sales-pos-container">
      <div className="sales-pos-header">
        <h1 className="sales-pos-title">Sales / POS</h1>
        <p className="sales-pos-subtitle">
          Billing assistance, order taking, inventory routing, and payment handoff in one workspace.
        </p>
      </div>

      <SalesSummary
        total={salesPos.total}
        cartCount={salesPos.cart.length}
        unsyncedCount={salesPos.unsyncedCount}
        pendingItemsCount={salesPos.pendingItemsCount}
      />

      <SalesPosTabs
        tab={salesPos.tab}
        pendingItemsCount={salesPos.pendingItemsCount}
        transactionCount={transactions.length}
        onChange={salesPos.setTab}
      />

      {salesPos.tab === "billing" && (
        <SalesBillingDesk
          cats={salesPos.cats}
          catFilter={salesPos.catFilter}
          search={salesPos.search}
          filteredProducts={salesPos.filteredProducts}
          cart={salesPos.cart}
          subtotal={salesPos.subtotal}
          total={salesPos.total}
          method={salesPos.method}
          pendingCount={salesPos.pendingItemsCount}
          servedCount={salesPos.servedItemsCount}
          unsyncedCount={salesPos.unsyncedCount}
          onSearchChange={salesPos.setSearch}
          onSetCategory={salesPos.setCatFilter}
          onAddToCart={salesPos.addToCart}
          onUpdateQty={salesPos.updateQty}
          onSetMethod={salesPos.setMethod}
          onProcessPayment={salesPos.processPayment}
        />
      )}

      {salesPos.tab === "orders" && (
        <SalesOrderQueue
          orderTickets={salesPos.orderTickets}
          pendingItemsCount={salesPos.pendingItemsCount}
          servedItemsCount={salesPos.servedItemsCount}
          onMarkTicketServed={salesPos.markTicketServed}
          onSetItemServed={salesPos.setItemServed}
        />
      )}

      {salesPos.tab === "recent" && <SalesTransactionHistory transactions={transactions} />}
      {salesPos.receipt && <ReceiptModal receipt={salesPos.receipt} onClose={() => salesPos.setReceipt(null)} />}
    </div>
  );
}
