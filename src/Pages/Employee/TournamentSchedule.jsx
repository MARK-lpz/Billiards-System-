import { useEffect, useMemo, useState } from "react";
import "../../styles/Employee/TournamentSchedule.css";
import { registerRemoteTournamentParticipant } from "../../utils/eventApi";
import { useNotifications } from "../../Elements/Global/useNotifications";
import useClock from "../../Elements/Global/useClock";
import RegistrationBell from "../../Elements/Employee/RegistrationBell";
import ParticipantModal from "../../Elements/Employee/ParticipantModal";
import {
  SEEN_REGISTRATIONS_KEY,
  findRegistration,
  getRegistrations,
  readSeenRegistrations,
  registrationKey,
} from "../../utils/tournamentRegistrations";
import {
  describeDaysAway,
  formatEventWhen,
  getDateTile,
  groupStaffEvents,
  hasEventDayPassed,
  wasRescheduled,
} from "../../utils/eventUpdates";

const WALK_IN_TAG = "Walk-in";

const statusOf = (event) => `${event?.status || "upcoming"}`.toLowerCase();

// Registration follows the server's rule (upcoming or running), and closes once
// the tournament's day is over even if no one marked it completed.
const acceptsRegistration = (event, now) =>
  Boolean(event) && ["upcoming", "active"].includes(statusOf(event)) && !hasEventDayPassed(event, now);

const emptyWalkIn = { name: "", team: "" };

const TABS = [
  { key: "upcoming", label: "Upcoming", empty: "No upcoming tournaments. New ones from the admin show up here." },
  { key: "past", label: "Past", empty: "No past tournaments yet." },
  { key: "cancelled", label: "Cancelled", empty: "No cancelled tournaments." },
];

const formatDisplayDate = (value) => {
  if (!value) return "Date not set";

  const parsed = new Date(`${value}T00:00:00`);
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

const formatPeso = (amount) => `₱${Number(amount || 0).toLocaleString("en-PH")}`;

const formatGameType = (value) => {
  if (!value) return "Tournament";
  return value
    .split("-")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
};

// The badge a tournament wears here. One whose day has passed without being
// marked completed reads "Ended".
const getStatusBadge = (event, now) => {
  const status = statusOf(event);
  if (status === "cancelled") return { tone: "cancelled", label: "Cancelled" };
  if (status === "completed") return { tone: "completed", label: "Completed" };
  if (hasEventDayPassed(event, now)) return { tone: "ended", label: "Ended" };
  if (status === "active") return { tone: "active", label: "Ongoing" };
  return { tone: "upcoming", label: "Upcoming" };
};

// A reason typed by the admin, ending in a full stop so the next sentence reads apart.
const asSentence = (text) => {
  const trimmed = String(text || "").trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const formatCancelledOn = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    : "";
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
  // Refreshed every minute, so a tournament moves to Past once its day is over.
  const now = useClock(60000);
  const [tab, setTab] = useState("upcoming");
  const [selectedId, setSelectedId] = useState(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInForm, setWalkInForm] = useState(emptyWalkIn);
  const [walkInError, setWalkInError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Registrations opened on this device, and the player shown in the pop-up
  // ({ eventId, label, fromBell }).
  const [seen, setSeen] = useState(() => readSeenRegistrations(events));
  const [openPlayer, setOpenPlayer] = useState(null);

  useEffect(() => {
    try {
      // The latest 500 are plenty to tell new players from ones already seen.
      localStorage.setItem(SEEN_REGISTRATIONS_KEY, JSON.stringify([...seen].slice(-500)));
    } catch (error) {
      console.warn("Unable to keep the seen registrations", error);
    }
  }, [seen]);

  const groups = useMemo(() => groupStaffEvents(events, now), [events, now]);
  const registrations = useMemo(() => getRegistrations(events, now), [events, now]);
  // Looked up from the live list, so the pop-up follows changes and closes if the player is removed.
  const playerShown = openPlayer ? findRegistration(events, openPlayer.eventId, openPlayer.label) : null;

  const markSeen = (keys) =>
    setSeen((previous) => (keys.every((key) => previous.has(key)) ? previous : new Set([...previous, ...keys])));

  const showPlayer = (eventId, label, fromBell) => {
    markSeen([registrationKey(eventId, label)]);
    setOpenPlayer({ eventId, label, fromBell });
  };

  // From the bell: show the tournament the player signed up for.
  const openPlayersTournament = () => {
    const eventId = openPlayer.eventId;
    const tabWithEvent = TABS.find((entry) => groups[entry.key].some((event) => event.id === eventId))?.key;
    if (tabWithEvent) setTab(tabWithEvent);
    setSelectedId(eventId);
    setOpenPlayer(null);
  };
  const shown = groups[tab];
  // Falling back to the first in the tab keeps this valid without syncing in an effect.
  const selectedEvent = shown.find((event) => event.id === selectedId) || shown[0] || null;

  const registrationOpen = acceptsRegistration(selectedEvent, now);
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

  const nextEvent = groups.upcoming[0] || null;
  const stats = {
    upcoming: groups.upcoming.length,
    players: groups.upcoming.reduce((sum, event) => sum + (event.participants?.length || 0), 0),
  };

  const assignedTables = selectedEvent ? resolveAssignedTables(selectedEvent.tables, tables) : [];

  // The page's own header: its bell is only about players registering.
  const header = (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">Tournament Schedule</h1>
        <p className="page-subtitle">View tournaments and events created from the admin side</p>
      </div>
      <div className="header-right">
        <div className="header-icons">
          <RegistrationBell
            registrations={registrations}
            seen={seen}
            onOpen={(registration) => showPlayer(registration.event.id, registration.label, true)}
            onMarkAllSeen={() => markSeen(registrations.map((registration) => registration.key))}
          />
        </div>
      </div>
    </div>
  );

  if (!events.length) {
    return (
      <>
        {header}
        <div className="tourna-shell">
          <div className="tourna-empty-card">
            <i className="bi bi-trophy"></i>
            <h2>No tournament schedules yet</h2>
            <p>Events and tournaments created from the admin side will appear here automatically.</p>
          </div>
        </div>
      </>
    );
  }

  const renderNotice = (event) => {
    const status = statusOf(event);
    if (status === "cancelled") {
      const on = formatCancelledOn(event.cancelledAt);
      return (
        <p className="tourna-staff-notice tourna-staff-notice--cancelled">
          <i className="bi bi-x-octagon-fill" aria-hidden="true"></i>
          <span>
            Cancelled{on ? ` on ${on}` : ""}. This tournament will no longer take place, and registration is closed.
            {event.cancelReason ? ` Reason: ${asSentence(event.cancelReason)}` : ""}
          </span>
        </p>
      );
    }
    if (status === "completed") {
      return (
        <p className="tourna-closed-note">
          <i className="bi bi-lock-fill me-2"></i>
          Registration is closed for this tournament.
        </p>
      );
    }
    if (hasEventDayPassed(event, now)) {
      return (
        <p className="tourna-closed-note">
          <i className="bi bi-lock-fill me-2"></i>
          This tournament&apos;s date has passed, so registration is closed.
        </p>
      );
    }
    if (wasRescheduled(event)) {
      return (
        <p className="tourna-staff-notice tourna-staff-notice--moved">
          <i className="bi bi-calendar2-week" aria-hidden="true"></i>
          <span>
            Rescheduled from {formatEventWhen(event.rescheduledFrom.date, event.rescheduledFrom.time)}.
            {event.rescheduleReason ? ` Reason: ${asSentence(event.rescheduleReason)}` : ""} Tell players who ask about the
            old date.
          </span>
        </p>
      );
    }
    return null;
  };

  return (
    <>
      {header}
      <div className="tourna-shell">
        <div className="tourna-stats">
          <div className="tourna-stat-card">
            <span className="tourna-stat-label">Upcoming</span>
            <strong>{stats.upcoming}</strong>
          </div>
          <div className="tourna-stat-card">
            <span className="tourna-stat-label">Players Registered</span>
            <strong>{stats.players}</strong>
          </div>
          <div className="tourna-stat-card tourna-stat-card--next">
            <span className="tourna-stat-label">Next Tournament</span>
            {nextEvent ? (
              <span className="tourna-next">
                <strong>{nextEvent.name}</strong>
                <small>
                  {formatEventWhen(nextEvent.date, nextEvent.time)}
                  {describeDaysAway(nextEvent.date, now) ? ` · ${describeDaysAway(nextEvent.date, now)}` : ""}
                </small>
              </span>
            ) : (
              <span className="tourna-next">
                <small>None scheduled</small>
              </span>
            )}
          </div>
        </div>

        <div className="tourna-tabs" role="tablist" aria-label="Tournament schedule">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              className={`tourna-tab tourna-tab--${entry.key}${tab === entry.key ? " is-active" : ""}`}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
              <span className="tourna-tab-count">{groups[entry.key].length}</span>
            </button>
          ))}
        </div>

        <div className="tourna-layout">
          <div className="tourna-list">
            {shown.length === 0 ? (
              <div className="tourna-list-empty">
                <i className="bi bi-calendar-x" aria-hidden="true"></i>
                <p>{TABS.find((entry) => entry.key === tab).empty}</p>
              </div>
            ) : (
              shown.map((event) => {
                const tile = getDateTile(event.date);
                const badge = getStatusBadge(event, now);
                const moved = badge.tone === "upcoming" || badge.tone === "active" ? wasRescheduled(event) : false;
                const countdown = tab === "upcoming" ? describeDaysAway(event.date, now) : "";
                const players = event.participants?.length || 0;

                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`tourna-card tourna-card--${badge.tone}${selectedEvent?.id === event.id ? " active" : ""}`}
                    onClick={() => setSelectedId(event.id)}
                    aria-pressed={selectedEvent?.id === event.id}
                  >
                    <span className="tourna-date-tile" aria-hidden="true">
                      <span>{tile.month}</span>
                      <strong>{tile.day}</strong>
                    </span>

                    <span className="tourna-card-body">
                      <span className="tourna-card-top">
                        <span className="tourna-card-title">{event.name}</span>
                        <span className="tourna-card-badges">
                          {moved && <span className="tourna-badge rescheduled">Rescheduled</span>}
                          <span className={`tourna-badge ${badge.tone}`}>{badge.label}</span>
                        </span>
                      </span>

                      <span className={`tourna-card-date${badge.tone === "cancelled" ? " is-struck" : ""}`}>
                        {formatEventWhen(event.date, event.time)}
                        {countdown && <span className="tourna-countdown">{countdown}</span>}
                      </span>

                      <span className="tourna-card-meta">
                        <span>{formatGameType(event.gameType)}</span>
                        <span>
                          {players} {players === 1 ? "player" : "players"} registered
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {selectedEvent && (
            <div className="tourna-detail-card">
              <div className="tourna-detail-head">
                <div>
                  <p className="tourna-detail-kicker">Schedule Details</p>
                  <h2>{selectedEvent.name}</h2>
                </div>
                <div className="tourna-detail-head-actions">
                  <span className={`tourna-badge ${getStatusBadge(selectedEvent, now).tone}`}>
                    {getStatusBadge(selectedEvent, now).label}
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

              {renderNotice(selectedEvent)}

              <div className="tourna-detail-grid">
                <div className="tourna-detail-item">
                  <span>Date</span>
                  <strong className={statusOf(selectedEvent) === "cancelled" ? "is-struck" : ""}>
                    {formatDisplayDate(selectedEvent.date)}
                  </strong>
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
                  <strong>{formatPeso(selectedEvent.prize)}</strong>
                </div>
                <div className="tourna-detail-item">
                  <span>Entry Fee</span>
                  <strong>{Number(selectedEvent.entryFee) > 0 ? formatPeso(selectedEvent.entryFee) : "Free"}</strong>
                </div>
                <div className="tourna-detail-item">
                  <span>Registered Players</span>
                  <strong>{selectedEvent.participants?.length || 0}</strong>
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
                    {selectedEvent.participants.map((participant, index) => {
                      const isNew =
                        registrations.some((entry) => entry.key === registrationKey(selectedEvent.id, participant)) &&
                        !seen.has(registrationKey(selectedEvent.id, participant));
                      return (
                        <button
                          key={`${selectedEvent.id}-${index}`}
                          type="button"
                          className={`tourna-player-badge${isNew ? " is-new" : ""}`}
                          onClick={() => showPlayer(selectedEvent.id, participant, false)}
                          title="See this player's registration"
                        >
                          {participant}
                          {isNew && <span className="tourna-player-new">New</span>}
                        </button>
                      );
                    })}
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

        {playerShown && (
          <ParticipantModal
            key={playerShown.key}
            registration={playerShown}
            onClose={() => setOpenPlayer(null)}
            onOpenTournament={openPlayer.fromBell ? openPlayersTournament : null}
          />
        )}
      </div>
    </>
  );
}
