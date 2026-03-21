export default function EventCard({ 
  event, 
  addPInput, 
  onAddPInputChange, 
  onAddParticipant, 
  onMarkComplete 
}) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onAddParticipant();
    }
  };

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
              {event.tables.length > 0 ? "Table " + event.tables.join(", ") : "Not assigned"}
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
            <input
              type="text"
              className="form-control events-participant-input"
              value={addPInput}
              onChange={(e) => onAddPInputChange(e.target.value)}
              placeholder="Add participant name..."
              onKeyDown={handleKeyDown}
            />
            <button className="btn btn-sm btn-success" onClick={onAddParticipant}>
              <i className="bi bi-person-plus me-1"></i>
              Add
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