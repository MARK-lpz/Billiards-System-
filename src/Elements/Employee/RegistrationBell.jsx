import { useState } from "react";
import "../../styles/Notification.css";
import { formatEventWhen } from "../../utils/eventUpdates";

/**
 * The Tournament Schedule's bell: only players registered for tournaments still
 * to come. New ones (not opened on this device yet) are counted on the badge;
 * opening one shows that player's details.
 */
export default function RegistrationBell({ registrations = [], seen, onOpen, onMarkAllSeen }) {
  const [show, setShow] = useState(false);
  const unreadCount = registrations.filter((registration) => !seen.has(registration.key)).length;

  const open = (registration) => {
    setShow(false);
    onOpen(registration);
  };

  return (
    <div className="dropdown-container">
      <button
        type="button"
        className="header-icon-btn"
        onClick={() => setShow(!show)}
        aria-label={unreadCount ? `Player registrations, ${unreadCount} new` : "Player registrations"}
        title="Player registrations"
      >
        <i className="bi bi-bell"></i>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {show && (
        <>
          <div className="notification-overlay" onClick={() => setShow(false)} />
          <div className="dropdown-menu notification-dropdown registration-dropdown">
            <div className="dropdown-header">
              <h3>Player Registrations</h3>
              {unreadCount > 0 && (
                <button type="button" className="mark-read-btn" onClick={onMarkAllSeen}>
                  Mark all as seen
                </button>
              )}
            </div>

            <div className="notification-list">
              {registrations.length === 0 ? (
                <div className="notification-empty">
                  <i className="bi bi-people"></i>
                  <p>No players registered for upcoming tournaments yet.</p>
                </div>
              ) : (
                registrations.map((registration) => {
                  const isNew = !seen.has(registration.key);
                  return (
                    <button
                      key={registration.key}
                      type="button"
                      className={`menu-item registration-item ${isNew ? "unread" : ""}`}
                      onClick={() => open(registration)}
                    >
                      <i
                        className={`bi ${registration.walkIn ? "bi-person-walking" : "bi-globe2"} registration-item-icon`}
                        aria-hidden="true"
                      ></i>
                      <span className="notification-content">
                        <span className="notification-message">
                          <strong>{registration.name}</strong> registered for {registration.event.name}
                        </span>
                        <span className="notification-time">
                          {registration.walkIn ? "Walk-in" : "Online"}
                          {registration.team ? ` · ${registration.team}` : ""} ·{" "}
                          {formatEventWhen(registration.event.date, registration.event.time)}
                        </span>
                      </span>
                      {isNew && <span className="notification-dot" aria-label="New" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
