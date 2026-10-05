import { useEffect, useRef, useState } from "react";
import { downloadExcel } from "../../utils/exportExcel";
import { printElement } from "../../utils/printElement";
import {
  PERIOD_TYPES,
  buildSalesReportRows,
  describeItems,
  describePeriod,
  formatPesoAmount as peso,
  methodLabel,
  receiptNumber,
} from "../../utils/salesReport";

// A wide report prints across the page.
const REPORT_PRINT_CSS = "@page { size: A4 landscape; margin: 10mm; }";

const formatDay = (date) => {
  const day = new Date(`${date}T00:00:00`);
  return Number.isNaN(day.getTime()) ? date || "" : day.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

/**
 * The whole sales report for one period as tables: a summary, a breakdown by day
 * or month, and every sale. It can be printed or downloaded as Excel.
 */
export default function SalesReportModal({ period, transactions, summary, breakdown, onClose }) {
  const paperRef = useRef(null);
  // When the report was opened, printed on it and in the Excel file.
  const [generatedAt] = useState(() => new Date().toLocaleString("en-PH"));
  const periodLabel = describePeriod(period);
  const typeLabel = PERIOD_TYPES.find((entry) => entry.key === period.type)?.label || "";

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleDownload = () => {
    downloadExcel({
      fileName: `${typeLabel} Sales Report ${periodLabel}`,
      sheetName: periodLabel.slice(0, 31),
      rows: buildSalesReportRows({ period, transactions, summary, breakdown, generatedAt }),
    });
  };

  const summaryItems = [
    ["Revenue", peso(summary.revenue)],
    ["Transactions", summary.count],
    ["Cash", peso(summary.cash)],
    ["GCash", peso(summary.gcash)],
    ["Table time", peso(summary.tableTime)],
    ["Food & items", peso(summary.items)],
    ["Average sale", peso(summary.average)],
  ];

  return (
    <>
      <div className="modal show d-block sales-report-modal" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="sales-report-title">
        <div className="modal-dialog modal-dialog-centered sales-report-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="sales-report-title">
                <i className="bi bi-table"></i>
                {typeLabel} Sales Report · {periodLabel}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              <div className="srp-paper" ref={paperRef}>
                <div className="srp-head">
                  <div>
                    <div className="srp-brand">BREAK &amp; CHILL BILLIARD HALL</div>
                    <h2 className="srp-title">{typeLabel} Sales Report</h2>
                    <div className="srp-muted">{periodLabel}</div>
                  </div>
                  <div className="srp-muted srp-generated">Generated {generatedAt}</div>
                </div>

                <div className="srp-scroll srp-summary">
                  <table className="srp-table">
                    <tbody>
                      <tr>
                        {summaryItems.map(([label]) => (
                          <th key={label} scope="col">{label}</th>
                        ))}
                      </tr>
                      <tr>
                        {summaryItems.map(([label, value]) => (
                          <td key={label}>{value}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {breakdown && (
                  <>
                    <h3 className="srp-section">{breakdown.title}</h3>
                    <div className="srp-scroll">
                      <table className="srp-table">
                        <thead>
                          <tr>
                            <th scope="col">{breakdown.firstColumn}</th>
                            <th scope="col" className="srp-num">Sales</th>
                            <th scope="col" className="srp-num">Cash</th>
                            <th scope="col" className="srp-num">GCash</th>
                            <th scope="col" className="srp-num">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdown.rows.map((row) => (
                            <tr key={row.key} className={row.count ? "" : "srp-empty-row"}>
                              <td>{row.label}</td>
                              <td className="srp-num">{row.count}</td>
                              <td className="srp-num">{peso(row.cash)}</td>
                              <td className="srp-num">{peso(row.gcash)}</td>
                              <td className="srp-num">{peso(row.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th scope="row">TOTAL</th>
                            <td className="srp-num">{summary.count}</td>
                            <td className="srp-num">{peso(summary.cash)}</td>
                            <td className="srp-num">{peso(summary.gcash)}</td>
                            <td className="srp-num">{peso(summary.revenue)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}

                <h3 className="srp-section">Transactions ({transactions.length})</h3>
                {transactions.length === 0 ? (
                  <p className="srp-muted srp-none">No sales recorded for {periodLabel}.</p>
                ) : (
                  <div className="srp-scroll">
                    <table className="srp-table">
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col">Time</th>
                          <th scope="col">Receipt</th>
                          <th scope="col">Cashier</th>
                          <th scope="col">Items</th>
                          <th scope="col">Paid by</th>
                          <th scope="col">Reference</th>
                          <th scope="col" className="srp-num">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="srp-nowrap">{formatDay(tx.date)}</td>
                            <td className="srp-nowrap">{tx.time}</td>
                            <td className="srp-nowrap">{receiptNumber(tx)}</td>
                            <td>{tx.cashier}</td>
                            <td className="srp-items">{describeItems(tx)}</td>
                            <td>{methodLabel(tx.method)}</td>
                            <td className="srp-nowrap">{tx.paymentDetails?.referenceNumber || "—"}</td>
                            <td className="srp-num">{peso(tx.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row" colSpan={7}>TOTAL</th>
                          <td className="srp-num">{peso(summary.revenue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => printElement(paperRef.current, { title: `Sales Report - ${periodLabel}`, bodyClass: "srp-print-body", extraCss: REPORT_PRINT_CSS })}
              >
                <i className="bi bi-printer"></i>
                Print
              </button>
              <button type="button" className="btn btn-success" onClick={handleDownload} disabled={!transactions.length}>
                <i className="bi bi-file-earmark-excel"></i>
                Download Excel
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
