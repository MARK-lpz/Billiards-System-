export default function QuickActions() {
  return (
    <div className="content-card">
      <div className="card-header">
        <h2 className="card-title">Quick Actions</h2>
      </div>
      <div className="quick-actions-grid">
        <button className="action-btn">
          <i className="bi bi-clock-history"></i>
          <span>Clock In/Out</span>
        </button>
        <button className="action-btn">
          <i className="bi bi-clipboard-check"></i>
          <span>Report Issue</span>
        </button>
        <button className="action-btn">
          <i className="bi bi-person-plus"></i>
          <span>Request Break</span>
        </button>
        <button className="action-btn">
          <i className="bi bi-calendar2-week"></i>
          <span>View Schedule</span>
        </button>
      </div>
    </div>
  );
}