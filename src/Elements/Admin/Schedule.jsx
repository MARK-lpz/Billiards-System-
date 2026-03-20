export default function TodaySchedule() {
  return (
    <div className="content-card">
      <div className="card-header">
        <h2 className="card-title">Today's Schedule</h2>
      </div>
      <div className="schedule-list">
        <div className="schedule-item current">
          <div className="schedule-time">
            <i className="bi bi-clock"></i>
            <span>2:00 PM - 6:00 PM</span>
          </div>
          <p className="schedule-task">Floor Service</p>
          <span className="schedule-badge current-badge">Current</span>
        </div>

        <div className="schedule-item">
          <div className="schedule-time">
            <i className="bi bi-clock"></i>
            <span>6:00 PM - 6:30 PM</span>
          </div>
          <p className="schedule-task">Break Time</p>
        </div>

        <div className="schedule-item">
          <div className="schedule-time">
            <i className="bi bi-clock"></i>
            <span>6:30 PM - 10:00 PM</span>
          </div>
          <p className="schedule-task">Closing Duties</p>
        </div>
      </div>
    </div>
  );
}