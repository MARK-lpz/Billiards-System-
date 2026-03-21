export default function EventsStats({ stats }) {
  return (
    <div className="row g-3 mb-4">
      <div className="col-md-4">
        <div className="card events-stat-card events-stat-blue">
          <div className="card-body">
            <div className="events-stat-value">{stats.upcoming}</div>
            <div className="events-stat-label">Upcoming Events</div>
          </div>
        </div>
      </div>
      <div className="col-md-4">
        <div className="card events-stat-card events-stat-green">
          <div className="card-body">
            <div className="events-stat-value">{stats.completed}</div>
            <div className="events-stat-label">Completed</div>
          </div>
        </div>
      </div>
      <div className="col-md-4">
        <div className="card events-stat-card events-stat-yellow">
          <div className="card-body">
            <div className="events-stat-value">{stats.totalParticipants}</div>
            <div className="events-stat-label">Total Participants</div>
          </div>
        </div>
      </div>
    </div>
  );
}