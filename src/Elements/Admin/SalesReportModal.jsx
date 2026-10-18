import { useEffect, useRef, useState } from "react";
import { downloadExcel } from "../../utils/exportExcel";
import { printElement } from "../../utils/printElement";
import {
  ORIENTATIONS,
  PAPER_MARGIN_MM,
  PAPER_SIZES,
  excelPageSetup,
  pagePrintCss,
  paperDimensions,
  readPaperChoice,
  savePaperChoice,
} from "../../utils/reportPaper";
import {
  buildSalesReportRows,
  describeItems,
  describePeriod,
  formatPesoAmount as peso,
  methodLabel,
  receiptNumber,
  reportTypeLabel,
} from "../../utils/salesReport";

const PX_PER_MM = 96 / 25.4;

const formatDay = (date) => {
  const day = new Date(`${date}T00:00:00`);
  return Number.isNaN(day.getTime()) ? date || "" : day.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

/**
 * Print / Download for one period's sales report: the report as the sheet it
 * prints on (a summary, a breakdown by day or month, and every sale). Staff pick
 * the paper size and Portrait or Landscape; the sheet takes that shape (shrunk
 * to fit), and Print and Download Excel use the same paper.
 */
export default function SalesReportModal({ period, transactions, summary, breakdown, onClose }) {
  const stageRef = useRef(null);
  const paperRef = useRef(null);
  const [paper, setPaper] = useState(readPaperChoice);
  const [stageWidth, setStageWidth] = useState(0);
  // When the report was opened, printed on it and in the Excel file.
  const [generatedAt] = useState(() => new Date().toLocaleString("en-PH"));
  const periodLabel = describePeriod(period);
  const typeLabel = reportTypeLabel(period);
  const { width, height } = paperDimensions(paper);
  // The whole sheet fits the pop-up's width: the same layout as on paper, only smaller.
  const zoom = stageWidth ? Math.min(1, stageWidth / (width * PX_PER_MM)) : 1;

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    // The room inside the desk's padding.
    const measure = () => {
      const style = getComputedStyle(stage);
      setStageWidth(stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const choose = (changes) => {
    const next = { ...paper, ...changes };
    setPaper(next);
    savePaperChoice(next);
  };

  const handlePrint = () =>
    printElement(paperRef.current, {
      title: `Sales Report - ${periodLabel}`,
      bodyClass: "srp-print-body",
      extraCss: pagePrintCss(paper),
    });

  const handleDownload = () =>
    downloadExcel({
      fileName: `${typeLabel} Sales Report ${periodLabel}`,
      sheetName: periodLabel.slice(0, 31),
      rows: buildSalesReportRows({ period, transactions, summary, breakdown, generatedAt }),
      pageSetup: excelPageSetup(paper),
    });

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
                <i className="bi bi-printer"></i>
                {typeLabel} Sales Report · {periodLabel}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            {/* The paper, above the sheet so it stays in view while the sheet scrolls */}
            <div className="srp-preview-bar">
              <div>
                <label className="reports-toolbar-label" htmlFor="srp-paper-size">Paper size</label>
                <select
                  id="srp-paper-size"
                  className="reports-toolbar-select"
                  value={paper.size}
                  onChange={(event) => choose({ size: event.target.value })}
                >
                  {PAPER_SIZES.map((size) => (
                    <option key={size.key} value={size.key}>{size.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="reports-toolbar-label">Orientation</span>
                <div className="sales-report-types" role="group" aria-label="Orientation">
                  {ORIENTATIONS.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      className={`sales-report-type ${paper.orientation === entry.key ? "active" : ""}`}
                      aria-pressed={paper.orientation === entry.key}
                      onClick={() => choose({ orientation: entry.key })}
                    >
                      <i className={`bi bi-file-earmark srp-orientation-icon srp-orientation-icon--${entry.key}`} aria-hidden="true"></i>
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-body">
              <div className="srp-stage" ref={stageRef}>
                <div className="srp-stage-zoom" style={{ zoom }}>
                  <div
                    className={`srp-paper srp-paper--${paper.orientation}`}
                    ref={paperRef}
                    style={{ "--paper-w": `${width}mm`, "--paper-h": `${height}mm`, "--paper-margin": `${PAPER_MARGIN_MM}mm` }}
                    aria-label={`Preview: ${typeLabel} Sales Report, ${periodLabel}`}
                  >
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
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handlePrint}>
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
