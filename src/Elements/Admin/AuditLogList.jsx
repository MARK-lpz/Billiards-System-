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
  info: "audit-severity-info",
  low: "audit-severity-low",
};

export default function AuditLogList({
  filter,
  filters,
  logs,
  onFilterChange,
  onSelectLog,
}) {
  return (
    <div className="card audit-log-card">
      <div className="card-body">
        <div className="audit-log-topbar">
          <h6 className="audit-log-header">System Activity Log</h6>
          <div className="audit-filter-row">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`audit-filter-btn ${filter === item.id ? "active" : ""}`}
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
            logs.map((log, index) => (
              <button
                key={log.id}
                type="button"
                className={`audit-log-item audit-log-button ${
                  index < logs.length - 1 ? "audit-log-item-border" : ""
                }`}
                onClick={() => onSelectLog(log)}
              >
                <div className="audit-log-time">{log.time}</div>
                <i className={`bi ${typeIcon[log.type] || typeIcon.other} audit-log-icon`}></i>
                <span className={`badge audit-badge audit-badge-${log.type || "other"}`}>
                  {log.type || "other"}
                </span>
                <div className="audit-log-content">
                  <div className="audit-log-staff-action">
                    <span className="audit-log-staff">{log.staff}</span>
                    <span className="audit-log-action">- {log.action}</span>
                    <span className={`audit-severity-pill ${severityClass[log.severity] || severityClass.info}`}>
                      {log.severity || "info"}
                    </span>
                  </div>
                  <div className="audit-log-detail">{log.detail}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
