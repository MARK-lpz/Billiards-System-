import { downloadExcel } from "../../utils/exportExcel";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const methodLabel = (method) => (method === "cash" ? "Cash" : method === "ewallet" ? "GCash" : method || "—");

const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function YearlySalesReport({ transactions = [], year, years, onYearChange }) {
  const currentDate = new Date();
  const currentYear = String(currentDate.getFullYear());
  const currentMonthIndex = currentDate.getMonth();
  const monthData = MONTHS.map((month, index) => {
    const monthPrefix = `${year}-${String(index + 1).padStart(2, "0")}`;
    const monthTransactions = transactions.filter((transaction) => transaction.date?.startsWith(monthPrefix));

    return {
      month,
      transactionCount: monthTransactions.length,
      total: monthTransactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0),
      isCurrentMonth: year === currentYear && index === currentMonthIndex,
    };
  });
  const yearlyTotal = monthData.reduce((sum, month) => sum + month.total, 0);
  const transactionCount = monthData.reduce((sum, month) => sum + month.transactionCount, 0);
  const cashSales = transactions
    .filter((transaction) => transaction.method === "cash")
    .reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
  const ewalletSales = transactions
    .filter((transaction) => transaction.method === "ewallet")
    .reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
  const highestMonthTotal = Math.max(...monthData.map((month) => month.total), 1);

  const handleDownload = () => {
    const rows = [
      ["Break & Chill Billiards"],
      ["Yearly Sales Report"],
      ["Period", String(year)],
      ["Generated", new Date().toLocaleString("en-PH")],
      [],
      ["Summary"],
      ["Yearly Revenue", Number(yearlyTotal)],
      ["Total Transactions", transactionCount],
      ["Cash Sales", Number(cashSales)],
      ["GCash Sales", Number(ewalletSales)],
      [],
      ["Monthly Breakdown"],
      ["Month", "Transactions", "Total"],
      ...monthData.map((month) => [month.month, month.transactionCount, Number(month.total)]),
      ["TOTAL", transactionCount, Number(yearlyTotal)],
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
    ];

    downloadExcel({
      fileName: `Yearly Sales Report ${year}`,
      sheetName: `Year ${year}`,
      rows,
    });
  };

  return (
    <div className="yearly-sales-report">
      <div className="yearly-sales-toolbar">
        <div>
          <h2>Yearly Sales</h2>
          <p>
            Revenue and completed transactions for {year}.
            {year === currentYear ? ` Current month: ${MONTHS[currentMonthIndex]}.` : ""}
          </p>
        </div>
        <div className="yearly-sales-toolbar-actions">
          <label className="yearly-sales-select">
            <span>Report year</span>
            <select value={year} onChange={(event) => onYearChange(event.target.value)}>
              {years.map((availableYear) => (
                <option key={availableYear} value={availableYear}>{availableYear}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="reports-export-btn"
            onClick={handleDownload}
            disabled={!transactionCount}
            title={transactionCount ? `Download ${year} as Excel` : "No sales to export for this year"}
          >
            <i className="bi bi-file-earmark-excel me-2"></i>
            Download Excel
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-green">
            <div className="card-body">
              <i className="bi bi-graph-up-arrow reports-stat-icon"></i>
              <div className="reports-stat-value">{fmtPeso(yearlyTotal)}</div>
              <div className="reports-stat-label">Yearly Revenue</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-blue">
            <div className="card-body">
              <i className="bi bi-receipt reports-stat-icon"></i>
              <div className="reports-stat-value">{transactionCount}</div>
              <div className="reports-stat-label">Transactions</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-yellow">
            <div className="card-body">
              <i className="bi bi-cash reports-stat-icon"></i>
              <div className="reports-stat-value">{fmtPeso(cashSales)}</div>
              <div className="reports-stat-label">Cash Sales</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card reports-stat-card reports-stat-blue">
            <div className="card-body">
              <i className="bi bi-phone reports-stat-icon"></i>
              <div className="reports-stat-value">{fmtPeso(ewalletSales)}</div>
              <div className="reports-stat-label">GCash Sales</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card reports-card yearly-sales-card">
        <div className="card-body">
          <h6 className="reports-card-title">Monthly Sales Breakdown</h6>
          <div className="yearly-sales-list">
            {monthData.map((month) => (
              <div className={`yearly-sales-row ${month.isCurrentMonth ? "current" : ""}`} key={month.month}>
                <span className="yearly-sales-month">
                  {month.month}
                  {month.isCurrentMonth && <span className="yearly-sales-current-label">Current</span>}
                </span>
                <div className="yearly-sales-bar-track" aria-label={`${month.month}: ${fmtPeso(month.total)}`}>
                  <span
                    className="yearly-sales-bar"
                    style={{ width: `${(month.total / highestMonthTotal) * 100}%` }}
                  />
                </div>
                <span className="yearly-sales-count">{month.transactionCount} sale{month.transactionCount === 1 ? "" : "s"}</span>
                <strong className="yearly-sales-total">{fmtPeso(month.total)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
