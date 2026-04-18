import { useEffect, useMemo, useState } from "react";
import "../../styles/Employee/TournamentSchedule.css";

const formatDisplayDate = (value) => {
  if (!value) return "Date not set";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatDisplayTime = (value) => {
  if (!value) return "Time not set";

  const parsed = new Date(`2000-01-01T${value}`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatStatusLabel = (value) => {
  if (!value) return "Upcoming";
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatGameType = (value) => {
  if (!value) return "Tournament";
  return value
    .split("-")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
};

const resolveAssignedTables = (assignedTables = [], tables = []) => {
  const labels = (assignedTables || [])
    .map((assigned) => {
      const matched = (tables || []).find((table) => table.id === assigned || table.name === assigned);
      if (matched?.name) return matched.name;
      if (typeof assigned === "string" && assigned.toLowerCase().startsWith("table ")) return assigned;
      if (typeof assigned === "number" && assigned < 1000) return `Table ${assigned}`;
      return null;
    })
    .filter(Boolean);

  return [...new Set(labels)];
};

export default function TournamentSchedule({ events = [], tables = [] }) {
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? null);

  useEffect(() => {
    if (!events.length) {
      setSelectedId(null);
      return;
    }

    if (!events.some((event) => event.id === selectedId)) {
      setSelectedId(events[0].id);
    }
  }, [events, selectedId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedId) || events[0] || null,
    [events, selectedId]
  );

  const stats = {
    scheduled: events.length,
    active: events.filter((event) => event.status !== "completed").length,
    totalParticipants: events.reduce((sum, event) => sum + (event.participants?.length || 0), 0),
  };

  const assignedTables = selectedEvent ? resolveAssignedTables(selectedEvent.tables, tables) : [];

  if (!events.length) {
    return (
      <div className="tourna-shell">
        <div className="tourna-empty-card">
          <i className="bi bi-trophy"></i>
          <h2>No tournament schedules yet</h2>
          <p>Events and tournaments created from the admin side will appear here automatically.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tourna-shell">
      <div className="tourna-stats">
        <div className="tourna-stat-card">
          <span className="tourna-stat-label">Scheduled Events</span>
          <strong>{stats.scheduled}</strong>
        </div>
        <div className="tourna-stat-card">
          <span className="tourna-stat-label">Active Schedule</span>
          <strong>{stats.active}</strong>
        </div>
        <div className="tourna-stat-card">
          <span className="tourna-stat-label">Total Players</span>
          <strong>{stats.totalParticipants}</strong>
        </div>
      </div>

      <div className="tourna-layout">
        <div className="tourna-list">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              className={`tourna-card ${selectedEvent?.id === event.id ? "active" : ""}`}
              onClick={() => setSelectedId(event.id)}
            >
              <div className="tourna-card-top">
                <span className={`tourna-badge ${(event.status || "upcoming").toLowerCase()}`}>
                  {formatStatusLabel(event.status)}
                </span>
                <span className="tourna-card-time">{formatDisplayTime(event.time)}</span>
              </div>

              <div className="tourna-card-title">{event.name}</div>
              <div className="tourna-card-date">{formatDisplayDate(event.date)}</div>

              <div className="tourna-card-meta">
                <span>{formatGameType(event.gameType)}</span>
                <span>{event.participants?.length || 0} registered</span>
              </div>
            </button>
          ))}
        </div>

        {selectedEvent && (
          <div className="tourna-detail-card">
            <div className="tourna-detail-head">
              <div>
                <p className="tourna-detail-kicker">Schedule Details</p>
                <h2>{selectedEvent.name}</h2>
              </div>
              <span className={`tourna-badge ${(selectedEvent.status || "upcoming").toLowerCase()}`}>
                {formatStatusLabel(selectedEvent.status)}
              </span>
            </div>

            <div className="tourna-detail-grid">
              <div className="tourna-detail-item">
                <span>Date</span>
                <strong>{formatDisplayDate(selectedEvent.date)}</strong>
              </div>
              <div className="tourna-detail-item">
                <span>Time</span>
                <strong>{formatDisplayTime(selectedEvent.time)}</strong>
              </div>
              <div className="tourna-detail-item">
                <span>Game Type</span>
                <strong>{formatGameType(selectedEvent.gameType)}</strong>
              </div>
              <div className="tourna-detail-item">
                <span>Prize Pool</span>
                <strong>₱{Number(selectedEvent.prize || 0).toLocaleString("en-PH")}</strong>
              </div>
              <div className="tourna-detail-item">
                <span>Registered Players</span>
                <strong>{selectedEvent.participants?.length || 0}</strong>
              </div>
              <div className="tourna-detail-item">
                <span>Status</span>
                <strong>{formatStatusLabel(selectedEvent.status)}</strong>
              </div>
            </div>

            <div className="tourna-detail-section">
              <span className="tourna-section-label">Assigned Tables</span>
              {assignedTables.length ? (
                <div className="tourna-table-tags">
                  {assignedTables.map((table) => (
                    <span key={table} className="tourna-table-tag">
                      {table}
                    </span>
                  ))}
                </div>
              ) : (
                <p>No tables assigned yet.</p>
              )}
            </div>

            <div className="tourna-detail-section">
              <span className="tourna-section-label">Participants</span>
              {selectedEvent.participants?.length ? (
                <div className="tourna-player-list">
                  {selectedEvent.participants.map((participant, index) => (
                    <span key={`${selectedEvent.id}-${index}`} className="tourna-player-badge">
                      {participant}
                    </span>
                  ))}
                </div>
              ) : (
                <p>No registered players yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
