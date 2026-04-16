export default function EmployeeStats() {
  return (
    <div className="employee-stats">

      <div className="stat-card-employee">
        <div className="stat-icon-wrapper stat-green">
          <i className="bi bi-check-circle"></i>
        </div>
        <div className="stat-content">
          <p className="stat-label">Tasks Completed</p>
          <p className="stat-value">12</p>
        </div>
      </div>

      <div className="stat-card-employee">
        <div className="stat-icon-wrapper stat-orange">
          <i className="bi bi-list-task"></i>
        </div>
        <div className="stat-content">
          <p className="stat-label">Pending Tasks</p>
          <p className="stat-value">5</p>
        </div>
      </div>

    </div>
  );
}