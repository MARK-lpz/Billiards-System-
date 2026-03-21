import "../../styles/Admin/Audit.css";

export default function AuditTrail({ logs }) {
  const typeIcon = { 
    auth: "bi-shield-lock", 
    sale: "bi-currency-dollar", 
    reservation: "bi-calendar-check", 
    inventory: "bi-box-seam", 
    table: "bi-circle" 
  };

  return (
    <div className="audit-trail-container">
      <div className="audit-trail-header">
        <h1 className="audit-trail-title">Audit Trail</h1>
        <p className="audit-trail-subtitle">System activity log and staff tracking</p>
      </div>

      {/* Stats Grid */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card audit-stat-card audit-stat-blue">
            <div className="card-body">
              <i className="bi bi-list-check audit-stat-icon"></i>
              <div className="audit-stat-value">{logs.length}</div>
              <div className="audit-stat-label">Total Events</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card audit-stat-card audit-stat-yellow">
            <div className="card-body">
              <i className="bi bi-shield-lock audit-stat-icon"></i>
              <div className="audit-stat-value">{logs.filter(l => l.type === "auth").length}</div>
              <div className="audit-stat-label">Auth Events</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card audit-stat-card audit-stat-green">
            <div className="card-body">
              <i className="bi bi-currency-dollar audit-stat-icon"></i>
              <div className="audit-stat-value">{logs.filter(l => l.type === "sale").length}</div>
              <div className="audit-stat-label">Sale Events</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card audit-stat-card audit-stat-blue">
            <div className="card-body">
              <i className="bi bi-list-check audit-stat-icon"></i>
              <div className="audit-stat-value">{logs.filter(l => !["auth","sale"].includes(l.type)).length}</div>
              <div className="audit-stat-label">Other Events</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="card audit-log-card">
        <div className="card-body">
          <h6 className="audit-log-header">System Activity Log</h6>
          <div className="audit-log-list">
            {logs.map((log, i) => (
              <div key={log.id} className={`audit-log-item ${i < logs.length - 1 ? 'audit-log-item-border' : ''}`}>
                <div className="audit-log-time">{log.time}</div>
                <i className={`bi ${typeIcon[log.type] || "bi-list-check"} audit-log-icon`}></i>
                <span className={`badge audit-badge audit-badge-${log.type}`}>{log.type}</span>
                <div className="audit-log-content">
                  <div className="audit-log-staff-action">
                    <span className="audit-log-staff">{log.staff}</span>
                    <span className="audit-log-action"> — {log.action}</span>
                  </div>
                  <div className="audit-log-detail">{log.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}