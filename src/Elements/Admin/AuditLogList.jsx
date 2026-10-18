import Pagination from "../Global/Pagination";
import { auditDayLabel, auditLevel } from "../../utils/auditReport";

const typeIcon = {
  auth: "bi-shield-lock",
  sale: "bi-cash-stack",
  reservation: "bi-calendar-check",
  inventory: "bi-box-seam",
  table: "bi-grid-3x3-gap",
  issue: "bi-exclamation-diamond",
  other: "bi-list-check",
};

const severityClass = {
  high: "audit-severity-high",
  medium: "audit-severity-medium",
  reject: "audit-severity-reject",
  info: "audit-severity-info",
  low: "audit-severity-low",
};

const getSeverityDisplay = (log) => {
  const level = auditLevel(log);
  return { label: level, className: severityClass[level] || severityClass.info };
};

// `logs` is the page shown; `pagination` (usePagination's shape) moves between pages;
// `onPrint` opens the printable report.
export default function AuditLogList({
  filter,
  filters,
  logs,
  pagination,
  onFilterChange,
  onSelectLog,
  onPrint,
}) {
  return (
    <div className="card audit-log-card">
      <div className="card-body">
        <div className="audit-log-topbar">
          <div className="audit-log-title-row">
            <h6 className="audit-log-header">System Activity Log</h6>
            {onPrint && (
              <button type="button" className="reports-export-btn audit-report-open" onClick={onPrint}>
                <i className="bi bi-printer me-2" aria-hidden="true"></i>
                Print Report
              </button>
            )}
          </div>
          <div className="audit-filter-row">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`audit-filter-btn ${filter === item.id ? "active" : ""}`}
                aria-pressed={filter === item.id}
                onClick={() => onFilterChange(item.id)}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>
        </div>

        <div className="audit-log-list">
          {logs.length === 0 ? (
            <div className="audit-log-empty">
              <i className="bi bi-inbox"></i>
              <p>No audit events found for this filter.</p>
            </div>
          ) : (
            logs.map((log, index) => {
              const severity = getSeverityDisplay(log);

              return (
                <button
                  key={log.id}
                  type="button"
                  className={`audit-log-item audit-log-button ${
                    index < logs.length - 1 ? "audit-log-item-border" : ""
                  }`}
                  onClick={() => onSelectLog(log)}
                >
                  <div className="audit-log-time">
                    <span className="audit-log-date">{auditDayLabel(log.date)}</span>
                    {log.time}
                  </div>
                  <i className={`bi ${typeIcon[log.type] || typeIcon.other} audit-log-icon`}></i>
                  <span className={`badge audit-badge audit-badge-${log.type || "other"}`}>
                    {log.type || "other"}
                  </span>
                  <div className="audit-log-content">
                    <div className="audit-log-staff-action">
                      <span className="audit-log-staff">{log.staff}</span>
                      <span className="audit-log-action">- {log.action}</span>
                      <span className={`audit-severity-pill ${severity.className}`}>
                        {severity.label}
                      </span>
                    </div>
                    <div className="audit-log-detail">{log.detail}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {pagination && <Pagination {...pagination} />}
      </div>
    </div>
  );
}
