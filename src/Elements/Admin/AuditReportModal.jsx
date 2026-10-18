import { useEffect, useRef, useState } from "react";
import "../../styles/Admin/Reports.css";
import { printElement } from "../../utils/printElement";
import {
  ORIENTATIONS,
  PAPER_MARGIN_MM,
  PAPER_SIZES,
  pagePrintCss,
  paperDimensions,
  readPaperChoice,
  savePaperChoice,
} from "../../utils/reportPaper";
import { MONTHS, PERIOD_TYPES, countRangeDays, describePeriod, normalizeRange } from "../../utils/salesReport";
import {
  AUDIT_FILTERS,
  auditDayLabel,
  auditFilterLabel,
  auditLevel,
  auditTypeLabel,
  filterAuditLogs,
  getPeriodAuditLogs,
  summarizeAuditLogs,
} from "../../utils/auditReport";

const PX_PER_MM = 96 / 25.4;

const today = () => new Date().toLocaleDateString("en-CA");

/**
 * The Audit Trail as a printable report: staff pick the period (a day, a month,
 * a year or a range of dates) and which activity (the page's filters), and see
 * it as the sheet it prints on: its totals by kind, by staff and by level, then
 * every event, oldest first. The paper size and Portrait or Landscape are the
 * same choice as the sales report's.
 */
export default function AuditReportModal({ logs = [], initialFilter = "all", onClose }) {
  const stageRef = useRef(null);
  const paperRef = useRef(null);
  const [paper, setPaper] = useState(readPaperChoice);
  const [stageWidth, setStageWidth] = useState(0);
  const [period, setPeriod] = useState(() => {
    const date = today();
    return { type: "daily", date, month: date.slice(5, 7), year: date.slice(0, 4), from: `${date.slice(0, 7)}-01`, to: date };
  });
  const [filter, setFilter] = useState(initialFilter);
  // When the report was opened, printed on it.
  const [generatedAt] = useState(() => new Date().toLocaleString("en-PH"));

  const years = [
    ...new Set([period.year, today().slice(0, 4), ...logs.map((log) => String(log.date || "").slice(0, 4)).filter(Boolean)]),
  ].sort((first, second) => Number(second) - Number(first));
  const reportLogs = getPeriodAuditLogs(filterAuditLogs(logs, filter), period);
  const summary = summarizeAuditLogs(reportLogs);
  const periodLabel = describePeriod(period);
  const showing = filter === "all" ? "All activity" : auditFilterLabel(filter);
  const rangeDays = countRangeDays(period.from, period.to);
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

  const update = (changes) => setPeriod((current) => ({ ...current, ...changes }));

  // Either end can be typed in any order; the range is kept valid as it changes.
  const updateRange = (changes) =>
    setPeriod((current) => ({ ...current, ...normalizeRange({ from: current.from, to: current.to, ...changes }, today()) }));

  const choose = (changes) => {
    const next = { ...paper, ...changes };
    setPaper(next);
    savePaperChoice(next);
  };

  const handlePrint = () =>
    printElement(paperRef.current, {
      title: `Audit Trail Report - ${periodLabel}`,
      bodyClass: "srp-print-body",
      extraCss: pagePrintCss(paper),
    });

  const summaryTables = [
    ["By kind", "Kind", summary.byType],
    ["By staff", "Staff", summary.byStaff],
    ["By level", "Level", summary.byLevel],
  ];

  return (
    <>
      <div className="modal show d-block sales-report-modal" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="audit-report-title">
        <div className="modal-dialog modal-dialog-centered sales-report-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="audit-report-title">
                <i className="bi bi-printer"></i>
                Audit Trail Report · {periodLabel}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            {/* What the report covers, then the paper; the sheet scrolls under them */}
            <div className="srp-preview-bar">
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
                  <label className="reports-toolbar-label" htmlFor="audit-report-date">Date</label>
                  <input
                    id="audit-report-date"
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
                  <label className="reports-toolbar-label" htmlFor="audit-report-month">Month</label>
                  <select
                    id="audit-report-month"
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
                    <label className="reports-toolbar-label" htmlFor="audit-report-from">From</label>
                    <input
                      id="audit-report-from"
                      type="date"
                      className="reports-toolbar-select"
                      value={period.from}
                      max={today()}
                      onChange={(event) => event.target.value && updateRange({ from: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="reports-toolbar-label" htmlFor="audit-report-to">To</label>
                    <input
                      id="audit-report-to"
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
                  <label className="reports-toolbar-label" htmlFor="audit-report-year">Year</label>
                  <select
                    id="audit-report-year"
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

              <div>
                <label className="reports-toolbar-label" htmlFor="audit-report-filter">Show</label>
                <select
                  id="audit-report-filter"
                  className="reports-toolbar-select"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  {AUDIT_FILTERS.map((item) => (
                    <option key={item.id} value={item.id}>{item.id === "all" ? "All activity" : item.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="reports-toolbar-label" htmlFor="audit-report-paper">Paper size</label>
                <select
                  id="audit-report-paper"
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
                    aria-label={`Preview: Audit Trail Report, ${periodLabel}`}
                  >
                    <div className="srp-head">
                      <div>
                        <div className="srp-brand">BREAK &amp; CHILL BILLIARD HALL</div>
                        <h2 className="srp-title">Audit Trail Report</h2>
                        <div className="srp-muted">
                          {periodLabel} · {showing}
                        </div>
                      </div>
                      <div className="srp-muted srp-generated">Generated {generatedAt}</div>
                    </div>

                    <h3 className="srp-section">Summary · {summary.total} {summary.total === 1 ? "event" : "events"}</h3>
                    {summary.total > 0 && (
                      <div className="arp-summary">
                        {summaryTables.map(([title, column, rows]) => (
                          <table key={title} className="srp-table" aria-label={title}>
                            <thead>
                              <tr>
                                <th scope="col">{column}</th>
                                <th scope="col" className="srp-num">Events</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(([name, count]) => (
                                <tr key={name}>
                                  <td className="arp-cap">{name}</td>
                                  <td className="srp-num">{count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ))}
                      </div>
                    )}

                    <h3 className="srp-section">Events ({reportLogs.length})</h3>
                    {reportLogs.length === 0 ? (
                      <p className="srp-muted srp-none">No activity recorded for {periodLabel}.</p>
                    ) : (
                      <div className="srp-scroll">
                        <table className="srp-table">
                          <thead>
                            <tr>
                              <th scope="col">Date</th>
                              <th scope="col">Time</th>
                              <th scope="col">Staff</th>
                              <th scope="col">Kind</th>
                              <th scope="col">Action</th>
                              <th scope="col">Details</th>
                              <th scope="col">Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportLogs.map((log) => {
                              const level = auditLevel(log);
                              return (
                                <tr key={log.id}>
                                  <td className="srp-nowrap">{auditDayLabel(log.date)}</td>
                                  <td className="srp-nowrap">{log.time}</td>
                                  <td>{log.staff}</td>
                                  <td>{auditTypeLabel(log.type)}</td>
                                  <td className="arp-cap">{log.action}</td>
                                  <td className="arp-detail">{log.detail}</td>
                                  <td>
                                    <strong className={`arp-level arp-level-${level}`}>{level}</strong>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-success" onClick={handlePrint}>
                <i className="bi bi-printer"></i>
                Print
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
