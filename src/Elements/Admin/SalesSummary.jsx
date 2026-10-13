const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SalesSummary({ openBillsCount, openBillsTotal, unsyncedCount, pendingItemsCount }) {
  return (
    <div className="sales-pos-summary-grid">
      <div className="sales-summary-card">
        <span className="sales-summary-label">Open Bills</span>
        <span className="sales-summary-value">{openBillsCount}</span>
        <span className="sales-summary-meta">
          {openBillsCount ? `${fmtPeso(openBillsTotal)} on open bills, not yet paid` : "No bills waiting for payment"}
        </span>
      </div>

      <div className="sales-summary-card sales-summary-card--amber">
        <span className="sales-summary-label">Inventory Sync</span>
        <span className="sales-summary-value">{unsyncedCount > 0 ? unsyncedCount : "Auto"}</span>
        <span className="sales-summary-meta">
          {unsyncedCount > 0 ? "Items are still syncing to inventory" : "Orders are sent immediately to inventory"}
        </span>
      </div>

      <div className="sales-summary-card sales-summary-card--blue">
        <span className="sales-summary-label">Order Queue</span>
        <span className="sales-summary-value">{pendingItemsCount}</span>
        <span className="sales-summary-meta">Pending items waiting to be served</span>
      </div>
    </div>
  );
}
