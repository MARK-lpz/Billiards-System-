import { useState } from "react";
import SalesReportModal from "./SalesReportModal";
import {
  MONTHS,
  PERIOD_TYPES,
  describePeriod,
  formatPesoAmount as peso,
  getPeriodTransactions,
  getSalesBreakdown,
  summarizeSales,
} from "../../utils/salesReport";

const today = () => new Date().toLocaleDateString("en-CA");

/**
 * Daily, monthly and yearly sales in one report. Staff pick the period here and
 * see its totals; View Report opens the full report as tables in a pop-up.
 */
export default function SalesReport({ transactions = [] }) {
  const [period, setPeriod] = useState(() => {
    const date = today();
    return { type: "daily", date, month: date.slice(5, 7), year: date.slice(0, 4) };
  });
  const [reportOpen, setReportOpen] = useState(false);

  const years = [
    ...new Set([period.year, today().slice(0, 4), ...transactions.map((tx) => String(tx.date || "").slice(0, 4)).filter(Boolean)]),
  ].sort((first, second) => Number(second) - Number(first));

  const periodTransactions = getPeriodTransactions(transactions, period);
  const summary = summarizeSales(periodTransactions);
  const breakdown = getSalesBreakdown(periodTransactions, period);
  const periodLabel = describePeriod(period);

  const update = (changes) => setPeriod((current) => ({ ...current, ...changes }));

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

          {period.type !== "daily" && (
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

        <button type="button" className="reports-export-btn sales-report-open" onClick={() => setReportOpen(true)}>
          <i className="bi bi-table me-2"></i>
          View Report
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

      <div className="card reports-card">
        <div className="card-body sales-report-hint">
          {summary.count ? (
            <p>
              <strong>{summary.count}</strong> {summary.count === 1 ? "sale" : "sales"} for {periodLabel}: {peso(summary.tableTime)} table time and{" "}
              {peso(summary.items)} food &amp; items, an average of {peso(summary.average)} per sale. Open <strong>View Report</strong> for
              the full table{breakdown ? ` with the ${breakdown.title.toLowerCase()}` : ""}, then print it or download it as Excel.
            </p>
          ) : (
            <p className="reports-empty-note">No sales recorded for {periodLabel}.</p>
          )}
        </div>
      </div>

      {reportOpen && (
        <SalesReportModal
          period={period}
          transactions={periodTransactions}
          summary={summary}
          breakdown={breakdown}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
