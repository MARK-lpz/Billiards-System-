import { useMemo, useState } from "react";

import ReceiptModal from "./ReceiptModal";
import PaymentConfirmationModal from "./PaymentConfirmationModal";
import SalesBillingDesk from "./SalesBillingDesk";
import SalesOrderQueue from "./SalesOrderQueue";
import SalesPosTabs from "./SalesPosTabs";
import SalesSummary from "./SalesSummary";
import SalesTransactionHistory from "./SalesTransactionHistory";
import useSalesPOS from "./useSalesPOS";
import useTableOrders from "./useTableOrders";
import { isTableTicketId, toTableTicket } from "../../utils/tableOrders";

export default function BaseSalesPOS({
  tables = [],
  setTables,
  reservations = [],
  products,
  setProducts,
  transactions,
  setTransactions,
  tableCharges = [],
  setTableCharges,
  setLogs,
  cashierLabel = "Staff A",
  storageKeyPrefix = "shared-pos",
}) {
  // A past sale opened from Transaction History, to see or reprint its receipt.
  const [viewedReceipt, setViewedReceipt] = useState(null);
  const salesPos = useSalesPOS({
    tables,
    setTables,
    reservations,
    products,
    setProducts,
    setTransactions,
    tableCharges,
    setTableCharges,
    setLogs,
    cashierLabel,
    storageKeyPrefix,
  });

  // Orders taken at the pool tables wait in the same queue as the ones rung up
  // here. They live on the table, so both counters see them and either can
  // mark them served.
  const tableOrders = useTableOrders({ tables, setTables, products, setProducts, setLogs, staff: cashierLabel });
  const tableTickets = tables.map(toTableTicket).filter(Boolean);
  const queueTickets = [...tableTickets, ...salesPos.orderTickets];
  const pendingItemsCount =
    salesPos.pendingItemsCount +
    tableTickets.reduce((sum, ticket) => sum + ticket.items.filter((item) => !item.served).length, 0);
  const tableIdOf = (ticketId) => tableTickets.find((ticket) => ticket.id === ticketId)?.tableId;

  const markTicketServed = (ticketId) =>
    isTableTicketId(ticketId) ? tableOrders.serveAll(tableIdOf(ticketId)) : salesPos.markTicketServed(ticketId);
  const setItemServed = (ticketId, itemId) =>
    isTableTicketId(ticketId) ? tableOrders.toggleServed(tableIdOf(ticketId), itemId) : salesPos.setItemServed(ticketId, itemId);

  const usedReferences = useMemo(
    () =>
      transactions
        .map((tx) => tx.paymentDetails?.referenceNumber)
        .filter(Boolean),
    [transactions]
  );

  // From an order in the queue back to its table's bill.
  const goToBill = (billId) => {
    salesPos.switchBill(billId);
    salesPos.setTab("billing");
  };

  return (
    <div className="sales-pos-container">
      <div className="sales-pos-header">
        <h1 className="sales-pos-title">Sales / POS</h1>
        <p className="sales-pos-subtitle">
          Billing assistance, order taking, inventory routing, and payment handoff in one workspace.
        </p>
      </div>

      <SalesSummary
        runningBill={salesPos.activeBill}
        runningTotal={salesPos.total}
        savedBillsCount={salesPos.savedBillsCount}
        unsyncedCount={salesPos.unsyncedCount}
        pendingItemsCount={pendingItemsCount}
      />

      <SalesPosTabs
        tab={salesPos.tab}
        pendingItemsCount={pendingItemsCount}
        transactionCount={transactions.length + salesPos.servedOrderTickets.length}
        onChange={salesPos.setTab}
      />

      {salesPos.tab === "billing" && (
        <SalesBillingDesk
          cats={salesPos.cats}
          catFilter={salesPos.catFilter}
          search={salesPos.search}
          filteredProducts={salesPos.filteredProducts}
          cart={salesPos.cart}
          activeBill={salesPos.activeBill}
          bills={salesPos.bills}
          savedBillsCount={salesPos.savedBillsCount}
          tables={tables}
          total={salesPos.total}
          method={salesPos.method}
          waitingCount={salesPos.billWaitingQty}
          unsyncedCount={salesPos.unsyncedCount}
          stockAlert={salesPos.stockAlert}
          unpaidTableCharges={salesPos.unpaidTableCharges}
          onAddTableCharge={salesPos.addTableChargeToBill}
          liveTableBills={salesPos.liveTableBills}
          onAddLiveTable={salesPos.addLiveTableToBill}
          onSearchChange={salesPos.setSearch}
          onSetCategory={salesPos.setCatFilter}
          onAddToCart={salesPos.addToCart}
          onUpdateQty={salesPos.updateQty}
          getQueuedQty={salesPos.getQueuedQty}
          onSetMethod={salesPos.setMethod}
          onProcessPayment={salesPos.processPayment}
          onCloseBill={salesPos.closeBill}
          describeBillRemoval={salesPos.describeBillRemoval}
          onRemoveBill={salesPos.removeBill}
          onUpdateBill={salesPos.updateBillDetails}
        />
      )}

      {salesPos.tab === "orders" && (
        <SalesOrderQueue
          orderTickets={queueTickets}
          pendingItemsCount={pendingItemsCount}
          servedItemsCount={salesPos.servedItemsCount}
          onMarkTicketServed={markTicketServed}
          onSetItemServed={setItemServed}
          openBillIds={salesPos.activeBill ? [salesPos.activeBill.id] : []}
          onOpenBill={goToBill}
        />
      )}

      {salesPos.tab === "recent" && (
        <SalesTransactionHistory
          transactions={transactions}
          servedOrderTickets={salesPos.servedOrderTickets}
          onViewReceipt={setViewedReceipt}
        />
      )}
      {salesPos.paymentReviewOpen && (
        <PaymentConfirmationModal
          cart={salesPos.cart}
          total={salesPos.total}
          method={salesPos.method}
          billLabel={salesPos.activeBill?.label}
          usedReferences={usedReferences}
          onCancel={() => salesPos.setPaymentReviewOpen(false)}
          onConfirm={salesPos.confirmPayment}
        />
      )}
      {salesPos.receipt && <ReceiptModal receipt={salesPos.receipt} onClose={() => salesPos.setReceipt(null)} />}
      {viewedReceipt && !salesPos.receipt && (
        <ReceiptModal receipt={viewedReceipt} justPaid={false} onClose={() => setViewedReceipt(null)} />
      )}
    </div>
  );
}
