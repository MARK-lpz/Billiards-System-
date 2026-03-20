export default function WeeklyPerformance() {
  return (
    <div className="content-card">
      <div className="card-header">
        <h2 className="card-title">This Week</h2>
      </div>
      <div className="performance-stats">
        <div className="performance-item">
          <span className="performance-label">Total Hours</span>
          <span className="performance-value">32.5 hrs</span>
        </div>
        <div className="performance-item">
          <span className="performance-label">Tasks Completed</span>
          <span className="performance-value">67</span>
        </div>
        <div className="performance-item">
          <span className="performance-label">Attendance</span>
          <span className="performance-value">100%</span>
        </div>
      </div>
    </div>
  );
}