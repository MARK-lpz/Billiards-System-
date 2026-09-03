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
  const action = String(log.action || "").toLowerCase();
  const status = String(log.reservation?.currentStatus || log.reservation?.status || "").toLowerCase();

  if (log.type === "reservation" && (action.includes("rejected") || status === "rejected")) {
    return { label: "reject", className: severityClass.reject };
  }

  const severity = log.severity || "info";
  return { label: severity, className: severityClass[severity] || severityClass.info };
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
                  <div className="audit-log-time">{log.time}</div>
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
      </div>
    </div>
  );
}
