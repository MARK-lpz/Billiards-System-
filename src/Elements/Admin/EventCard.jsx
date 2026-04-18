const formatAssignedTables = (assignedTables = [], tables = []) => {
  const labels = (assignedTables || [])
    .map((assigned) => {
      const matched = (tables || []).find((table) => table.id === assigned || table.name === assigned);
      if (matched?.name) return matched.name;
      if (typeof assigned === "string" && assigned.toLowerCase().startsWith("table ")) return assigned;
      if (typeof assigned === "number" && assigned < 1000) return `Table ${assigned}`;
      return null;
    })
    .filter(Boolean);

  return labels.length ? labels.join(", ") : "Not assigned";
};

export default function EventCard({ event, tables = [], onEdit, onMarkComplete }) {
  return (
    <div className={`card events-card ${event.status === "upcoming" ? "events-card-upcoming" : ""}`}>
      <div className="card-body">
        {/* Event Header */}
        <div className="events-card-header">
          <div>
            <h5 className="events-name">
              <i className="bi bi-trophy-fill me-2"></i>
              {event.name}
            </h5>
            <p className="events-datetime">
              <i className="bi bi-calendar3 me-2"></i>
              {event.date} at {event.time}
            </p>
          </div>
          <span className={`badge events-badge-${event.status}`}>
            {event.status}
          </span>
        </div>

        {/* Event Info Grid */}
        <div className="events-info-grid">
          <div className="events-info-box">
            <div className="events-info-label">Tables Assigned</div>
            <div className="events-info-value">
              {formatAssignedTables(event.tables, tables)}
            </div>
          </div>
          <div className="events-info-box">
            <div className="events-info-label">Participants</div>
            <div className="events-info-value">{event.participants.length} registered</div>
          </div>
          <div className="events-info-box">
            <div className="events-info-label">Prize Pool</div>
            <div className="events-info-value events-prize">
              ₱{event.prize.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Participants List */}
        {event.participants.length > 0 && (
          <div className="events-participants">
            <div className="events-participants-label">Participants</div>
            <div className="events-participants-list">
              {event.participants.map((p, i) => (
                <span key={i} className="events-participant-badge">
                  <i className="bi bi-person-fill me-1"></i>
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions (for upcoming events only) */}
        {event.status === "upcoming" && (
          <div className="events-actions">
            <button className="btn btn-sm btn-success" onClick={onEdit}>
              <i className="bi bi-pencil-square me-1"></i>
              Edit Event
            </button>
            <button className="btn btn-sm btn-info" onClick={onMarkComplete}>
              <i className="bi bi-check-circle me-1"></i>
              Mark Complete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
