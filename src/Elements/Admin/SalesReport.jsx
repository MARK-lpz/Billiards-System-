import { useState } from "react";
import SalesReportModal from "./SalesReportModal";
import {
  MONTHS,
  PERIOD_TYPES,
  countRangeDays,
  describeItems,
  describePeriod,
  formatPesoAmount as peso,
  getPeriodTransactions,
  getSalesBreakdown,
  methodLabel,
  normalizeRange,
  receiptNumber,
  summarizeSales,
} from "../../utils/salesReport";

const today = () => new Date().toLocaleDateString("en-CA");

const formatDay = (date) => {
  const day = new Date(`${date}T00:00:00`);
  return Number.isNaN(day.getTime()) ? date || "" : day.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

/**
 * Daily, monthly, yearly and date-range sales in one report. Staff pick the period here
 * and see it on the page: its totals, a breakdown by day or month, and every sale.
 * Print / Download opens the report as the sheet it prints on (SalesReportModal), with
 * the paper size and orientation.
 */
export default function SalesReport({ transactions = [] }) {
  const [period, setPeriod] = useState(() => {
    const date = today();
    return { type: "daily", date, month: date.slice(5, 7), year: date.slice(0, 4), from: `${date.slice(0, 7)}-01`, to: date };
  });
  const [printOpen, setPrintOpen] = useState(false);

  const years = [
    ...new Set([period.year, today().slice(0, 4), ...transactions.map((tx) => String(tx.date || "").slice(0, 4)).filter(Boolean)]),
  ].sort((first, second) => Number(second) - Number(first));

  const periodTransactions = getPeriodTransactions(transactions, period);
  const summary = summarizeSales(periodTransactions);
  const breakdown = getSalesBreakdown(periodTransactions, period);

  const update = (changes) => setPeriod((current) => ({ ...current, ...changes }));

  // Either end can be typed in any order; the range is kept valid as it changes.
  const updateRange = (changes) =>
    setPeriod((current) => ({ ...current, ...normalizeRange({ from: current.from, to: current.to, ...changes }, today()) }));

  const rangeDays = countRangeDays(period.from, period.to);
  const periodLabel = describePeriod(period);

  const stats = [
    { label: `Revenue · ${periodLabel}`, value: peso(summary.revenue), icon: "bi-currency-dollar", tone: "green" },
    { label: "Transactions", value: summary.count, icon: "bi-receipt", tone: "blue" },
    { label: "Cash Sales", value: peso(summary.cash), icon: "bi-cash", tone: "yellow" },
    { label: "GCash Sales", value: peso(summary.gcash), icon: "bi-phone", tone: "blue" },
  ];

  return (
    <div className="sales-report">
      <div className="reports-toolbar">
        <div className="reports-toolbar-fields">
          <div>
            <span className="reports-toolbar-label">Report</span>
            <div className="sales-report-types" role="group" aria-label="Report period">
              {PERIOD_TYPES.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  className={`sales-report-type ${period.type === type.key ? "active" : ""}`}
                  aria-pressed={period.type === type.key}
                  onClick={() => update({ type: type.key })}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {period.type === "daily" && (
            <div>
              <label className="reports-toolbar-label" htmlFor="sales-report-date">Date</label>
              <input
                id="sales-report-date"
                type="date"
                className="reports-toolbar-select"
                value={period.date}
                max={today()}
                onChange={(event) => event.target.value && update({ date: event.target.value })}
              />
            </div>
          )}

          {period.type === "monthly" && (
            <div>
              <label className="reports-toolbar-label" htmlFor="sales-report-month">Month</label>
              <select
                id="sales-report-month"
                className="reports-toolbar-select"
                value={period.month}
                onChange={(event) => update({ month: event.target.value })}
              >
                {MONTHS.map((name, index) => (
                  <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {period.type === "range" && (
            <>
              <div>
                <label className="reports-toolbar-label" htmlFor="sales-report-from">From</label>
                <input
                  id="sales-report-from"
                  type="date"
                  className="reports-toolbar-select"
                  value={period.from}
                  max={today()}
                  onChange={(event) => event.target.value && updateRange({ from: event.target.value })}
                />
              </div>
              <div>
                <label className="reports-toolbar-label" htmlFor="sales-report-to">To</label>
                <input
                  id="sales-report-to"
                  type="date"
                  className="reports-toolbar-select"
                  value={period.to}
                  max={today()}
                  onChange={(event) => event.target.value && updateRange({ to: event.target.value })}
                />
              </div>
              <span className="sales-report-range-days">
                {rangeDays} {rangeDays === 1 ? "day" : "days"}
              </span>
            </>
          )}

          {(period.type === "monthly" || period.type === "yearly") && (
            <div>
              <label className="reports-toolbar-label" htmlFor="sales-report-year">Year</label>
              <select
                id="sales-report-year"
                className="reports-toolbar-select"
                value={period.year}
                onChange={(event) => update({ year: event.target.value })}
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button type="button" className="reports-export-btn sales-report-open" onClick={() => setPrintOpen(true)}>
          <i className="bi bi-printer me-2"></i>
          Print / Download
        </button>
      </div>

      <div className="row g-3 mb-4">
        {stats.map((stat) => (
          <div className="col-md-3" key={stat.label}>
            <div className={`card reports-stat-card reports-stat-${stat.tone}`}>
              <div className="card-body">
                <i className={`bi ${stat.icon} reports-stat-icon`}></i>
                <div className="reports-stat-value">{stat.value}</div>
                <div className="reports-stat-label">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {breakdown && (
        <div className="card reports-card mb-4">
          <div className="card-body">
            <div className="reports-card-title">{breakdown.title}</div>
            <div className="table-responsive">
              <table className="table reports-table sales-report-table">
                <thead>
                  <tr>
                    <th scope="col">{breakdown.firstColumn}</th>
                    <th scope="col" className="reports-num">Sales</th>
                    <th scope="col" className="reports-num">Cash</th>
                    <th scope="col" className="reports-num">GCash</th>
                    <th scope="col" className="reports-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.rows.map((row) => (
                    <tr key={row.key} className={row.count ? "" : "sales-report-quiet-row"}>
                      <td className="reports-table-name">{row.label}</td>
                      <td className="reports-num">{row.count}</td>
                      <td className="reports-num">{peso(row.cash)}</td>
                      <td className="reports-num">{peso(row.gcash)}</td>
                      <td className="reports-num reports-table-price">{peso(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td className="reports-num">{summary.count}</td>
                    <td className="reports-num">{peso(summary.cash)}</td>
                    <td className="reports-num">{peso(summary.gcash)}</td>
                    <td className="reports-num">{peso(summary.revenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card reports-card">
        <div className="card-body">
          <div className="sales-report-card-head">
            <div className="reports-card-title">Transactions ({periodTransactions.length})</div>
            {summary.count > 0 && (
              <div className="sales-report-split">
                Table time <strong>{peso(summary.tableTime)}</strong> · Food &amp; items <strong>{peso(summary.items)}</strong> ·
                Average sale <strong>{peso(summary.average)}</strong>
              </div>
            )}
          </div>
          {periodTransactions.length === 0 ? (
            <p className="reports-empty-note">No sales recorded for {periodLabel}.</p>
          ) : (
            <div className="table-responsive">
              <table className="table reports-table sales-report-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Time</th>
                    <th scope="col">Receipt</th>
                    <th scope="col">Cashier</th>
                    <th scope="col">Items</th>
                    <th scope="col">Paid by</th>
                    <th scope="col">Reference</th>
                    <th scope="col" className="reports-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {periodTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="sales-report-nowrap">{formatDay(tx.date)}</td>
                      <td className="sales-report-nowrap">{tx.time}</td>
                      <td className="sales-report-nowrap">{receiptNumber(tx)}</td>
                      <td>{tx.cashier}</td>
                      <td className="reports-table-name sales-report-items">{describeItems(tx)}</td>
                      <td>{methodLabel(tx.method)}</td>
                      <td className="sales-report-nowrap">{tx.paymentDetails?.referenceNumber || "—"}</td>
                      <td className="reports-num reports-table-price">{peso(tx.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={7}>Total</th>
                    <td className="reports-num">{peso(summary.revenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {printOpen && (
        <SalesReportModal
          period={period}
          transactions={periodTransactions}
          summary={summary}
          breakdown={breakdown}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </div>
  );
}
