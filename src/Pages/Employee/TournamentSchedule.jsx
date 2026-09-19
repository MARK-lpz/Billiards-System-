import { useMemo, useState } from "react";
import "../../styles/Employee/TournamentSchedule.css";
import { registerRemoteTournamentParticipant } from "../../utils/eventApi";
import { useNotifications } from "../../Elements/Global/useNotifications";

const WALK_IN_TAG = "Walk-in";

// Registration follows the same rule the server enforces.
const acceptsRegistration = (event) =>
  ["upcoming", "active"].includes(`${event?.status || "upcoming"}`.toLowerCase());

const emptyWalkIn = { name: "", team: "" };

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

export default function TournamentSchedule({ events = [], setEvents, tables = [] }) {
  const { addNotification } = useNotifications();
  // Falling back to the first event keeps this valid without syncing in an effect.
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInForm, setWalkInForm] = useState(emptyWalkIn);
  const [walkInError, setWalkInError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedId) || events[0] || null,
    [events, selectedId]
  );

  const registrationOpen = acceptsRegistration(selectedEvent);
  const trimmedName = walkInForm.name.trim();
  const trimmedTeam = walkInForm.team.trim();
  const participantLabel = trimmedTeam
    ? `${trimmedName} (${trimmedTeam}, ${WALK_IN_TAG})`
    : `${trimmedName} (${WALK_IN_TAG})`;
  const alreadyRegistered = (selectedEvent?.participants || []).some(
    (entry) => `${entry}`.toLowerCase() === participantLabel.toLowerCase()
  );
  const canSubmitWalkIn = Boolean(trimmedName) && !alreadyRegistered && !submitting;

  const closeWalkIn = () => {
    setWalkInOpen(false);
    setWalkInForm(emptyWalkIn);
    setWalkInError("");
  };

  const submitWalkIn = async (formEvent) => {
    formEvent.preventDefault();
    if (!canSubmitWalkIn || !selectedEvent || !registrationOpen) return;

    setSubmitting(true);
    setWalkInError("");

    try {
      const updatedEvent = await registerRemoteTournamentParticipant({
        eventId: selectedEvent.id,
        participant: participantLabel,
      });

      if (setEvents) {
        setEvents((previous) =>
          previous.map((event) => (event.id === selectedEvent.id ? updatedEvent : event))
        );
      }

      addNotification({
        message: `${trimmedName} registered as a walk-in for ${selectedEvent.name}.`,
      });
      closeWalkIn();
    } catch (error) {
      setWalkInError(error?.message || "Unable to register this walk-in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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
              <div className="tourna-detail-head-actions">
                <span className={`tourna-badge ${(selectedEvent.status || "upcoming").toLowerCase()}`}>
                  {formatStatusLabel(selectedEvent.status)}
                </span>
                {registrationOpen && (
                  <button
                    type="button"
                    className="tourna-walkin-btn"
                    onClick={() => {
                      setWalkInForm(emptyWalkIn);
                      setWalkInError("");
                      setWalkInOpen(true);
                    }}
                  >
                    <i className="bi bi-person-walking me-2"></i>
                    Register Walk-in
                  </button>
                )}
              </div>
            </div>

            {!registrationOpen && (
              <p className="tourna-closed-note">
                <i className="bi bi-lock-fill me-2"></i>
                Registration is closed for this tournament.
              </p>
            )}

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

      {walkInOpen && selectedEvent && (
        <>
          <div className="modal-backdrop show" onClick={closeWalkIn} />
          <div className="modal show" style={{ display: "flex" }} onClick={closeWalkIn}>
            <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
              <div className="modal-content">
                <form onSubmit={submitWalkIn}>
                  <div className="modal-header">
                    <div>
                      <h5 className="modal-title">Register Walk-in Player</h5>
                      <p className="tourna-modal-subtitle">{selectedEvent.name}</p>
                    </div>
                    <button type="button" className="btn-close btn-close-white" onClick={closeWalkIn}></button>
                  </div>

                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label" htmlFor="walkin-name">Player name</label>
                      <input
                        id="walkin-name"
                        className="form-control"
                        placeholder="Full name"
                        autoComplete="off"
                        value={walkInForm.name}
                        onChange={(event) => setWalkInForm((prev) => ({ ...prev, name: event.target.value }))}
                        autoFocus
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="walkin-team">Team name (optional)</label>
                      <input
                        id="walkin-team"
                        className="form-control"
                        placeholder="Leave blank for solo players"
                        autoComplete="off"
                        value={walkInForm.team}
                        onChange={(event) => setWalkInForm((prev) => ({ ...prev, team: event.target.value }))}
                      />
                    </div>

                    {trimmedName && (
                      <p className="tourna-walkin-preview">
                        Saved as <strong>{participantLabel}</strong>
                      </p>
                    )}
                    {alreadyRegistered && (
                      <p className="tourna-walkin-error" role="alert">
                        This player is already registered for the tournament.
                      </p>
                    )}
                    {walkInError && (
                      <p className="tourna-walkin-error" role="alert">{walkInError}</p>
                    )}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={closeWalkIn}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-success" disabled={!canSubmitWalkIn}>
                      {submitting ? "Registering..." : "Register Walk-in"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
