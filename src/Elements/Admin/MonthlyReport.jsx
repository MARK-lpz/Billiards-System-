import { downloadExcel } from "../../utils/exportExcel";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const peso = (value) => `₱${Number(value || 0).toLocaleString()}`;

const methodLabel = (method) => (method === "cash" ? "Cash" : method === "ewallet" ? "GCash" : method || "—");

export default function MonthlyReport({
  transactions = [],
  total = 0,
  month = "",
  year = "",
  years = [],
  onMonthChange,
  onYearChange,
}) {
  const cashSales = transactions.filter(t => t.method === "cash").reduce((s, t) => s + t.total, 0);
  const ewalletSales = transactions.filter(t => t.method === "ewallet").reduce((s, t) => s + t.total, 0);
  const periodLabel = `${MONTHS[Number(month) - 1] || "All"} ${year}`.trim();

  const handleDownload = () => {
    const rows = [
      ["Break & Chill Billiards"],
      ["Monthly Sales Report"],
      ["Period", periodLabel],
      ["Generated", new Date().toLocaleString("en-PH")],
      [],
      ["Summary"],
      ["Monthly Revenue", Number(total)],
      ["Total Transactions", transactions.length],
      ["Cash Sales", Number(cashSales)],
      ["GCash Sales", Number(ewalletSales)],
      [],
      ["Transactions"],
      ["Date", "Time", "Transaction No.", "Cashier", "Payment Method", "Reference No.", "Items", "Subtotal", "Discount", "Total"],
      ...transactions.map((tx) => [
        tx.date || "",
        tx.time || "",
        String(tx.id ?? ""),
        tx.cashier || "",
        methodLabel(tx.method),
        tx.paymentDetails?.referenceNumber || "",
        (tx.items || []).map((item) => `${item.name} x${item.qty}`).join(", "),
        Number(tx.subtotal || 0),
        Number(tx.discAmt || 0),
        Number(tx.total || 0),
      ]),
      [],
      ["", "", "", "", "", "", "TOTAL", "", "", Number(total)],
    ];

    downloadExcel({
      fileName: `Monthly Sales Report ${periodLabel}`,
      sheetName: periodLabel,
      rows,
    });
  };

  return (
    <div>
      {/* Period picker and export */}
      <div className="reports-toolbar">
        <div className="reports-toolbar-fields">
          <div>
            <label className="reports-toolbar-label" htmlFor="report-month">Month</label>
            <select
              id="report-month"
              className="reports-toolbar-select"
              value={month}
              onChange={(event) => onMonthChange?.(event.target.value)}
            >
              {MONTHS.map((name, index) => (
                <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="reports-toolbar-label" htmlFor="report-year">Year</label>
            <select
              id="report-year"
              className="reports-toolbar-select"
              value={year}
              onChange={(event) => onYearChange?.(event.target.value)}
            >
              {years.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="reports-export-btn"
          onClick={handleDownload}
          disabled={!transactions.length}
          title={transactions.length ? `Download ${periodLabel} as Excel` : "No sales to export for this month"}
        >
          <i className="bi bi-file-earmark-excel me-2"></i>
          Download Excel
        </button>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-green">
            <div className="card-body">
              <i className="bi bi-currency-dollar reports-stat-icon"></i>
              <div className="reports-stat-value">{peso(total)}</div>
              <div className="reports-stat-label">Revenue for {periodLabel}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-blue">
            <div className="card-body">
              <i className="bi bi-receipt reports-stat-icon"></i>
              <div className="reports-stat-value">{transactions.length}</div>
              <div className="reports-stat-label">Total Transactions</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-yellow">
            <div className="card-body">
              <i className="bi bi-cash reports-stat-icon"></i>
              <div className="reports-stat-value">{peso(cashSales)}</div>
              <div className="reports-stat-label">Cash Sales</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-blue">
            <div className="card-body">
              <i className="bi bi-phone reports-stat-icon"></i>
              <div className="reports-stat-value">{peso(ewalletSales)}</div>
              <div className="reports-stat-label">eWallet Sales</div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="card reports-card">
        <div className="card-body">
          <h6 className="reports-card-title">Transactions for {periodLabel}</h6>
          {transactions.length ? (
            <div className="reports-list">
              {transactions.map(tx => (
                <div key={tx.id} className="reports-transaction-item">
                  <div className="reports-transaction-header">
                    <span className="reports-transaction-id">
                      #{tx.id} · <span className="reports-transaction-cashier">{tx.date} — {tx.cashier}</span>
                    </span>
                    <span className="reports-transaction-total">{peso(tx.total)}</span>
                  </div>
                  <div className="reports-transaction-details">
                    {tx.items.map(i => `${i.name} ×${i.qty}`).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="reports-empty-note">No sales recorded for {periodLabel}.</p>
          )}
        </div>
      </div>
    </div>
  );
}
