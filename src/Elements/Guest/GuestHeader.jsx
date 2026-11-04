import { useState } from "react";
import { useMyRequests } from "./useMyRequests";
import MyRequestsPanel from "./MyRequestsPanel";

// The public pages, in the menu's order (their views in App.jsx).
const PAGES = [
  { view: "guest", label: "Home" },
  { view: "tournaments", label: "Tournaments" },
  { view: "announcements", label: "Announcements" },
  { view: "about", label: "About us" },
];

/**
 * The header every public page shares: the hall's sign (back home), My
 * bookings once this browser has one, and Reserve a Table; under it the pages,
 * each a name over a short lit bar (the open one's yellow), Announcements with
 * how many this browser has not seen (`newsCount`). Under the header, the
 * visitor's own news: a booking or sign-up that was decided.
 *
 * `page` is the open page's view, `onNavigate(view)` opens another, and
 * `reservation` is useReservationState()'s.
 */
export default function GuestHeader({ page, onNavigate, onOpenReservation, reservation, newsCount = 0 }) {
  // This visitor's own bookings and sign-ups (kept in this browser).
  const myRequests = useMyRequests();
  const [requestsOpen, setRequestsOpen] = useState(false);
  const { reservationsClosed, reserveLabel, reserveTitle } = reservation;

  // Opening My bookings counts as seeing what is new there.
  const openMyRequests = () => {
    myRequests.unseen.forEach((request) => myRequests.markSeen(request));
    setRequestsOpen(true);
  };

  // The open page's name takes it back to its top.
  const openPage = (view) => {
    if (view !== page) {
      onNavigate(view);
      return;
    }
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <>
      {requestsOpen && (
        <MyRequestsPanel requests={myRequests.requests} onForget={myRequests.forget} onClose={() => setRequestsOpen(false)} />
      )}
      <header className="guest-template-header">
        <div className="guest-header-bar">
          <button type="button" className="guest-template-brand" onClick={() => openPage("guest")} aria-label="Break and Chill, home">
            <img src="/Logo.png" alt="" />
            <span>
              <strong>BREAK &amp; CHILL</strong>
              <small>Billiard Hall</small>
            </span>
          </button>
          <div className="guest-template-actions">
            {myRequests.requests.length > 0 && (
              <button
                type="button"
                className="guest-template-link guest-my-requests-btn"
                onClick={openMyRequests}
                aria-label={`My bookings${myRequests.unseen.length ? `, ${myRequests.unseen.length} new` : ""}`}
              >
                <i className="bi bi-receipt" aria-hidden="true"></i>
                <span className="guest-template-link-text">My bookings</span>
                {myRequests.unseen.length > 0 && <span className="guest-my-requests-dot" aria-hidden="true"></span>}
              </button>
            )}
            <button
              type="button"
              className="guest-template-register"
              onClick={onOpenReservation}
              disabled={reservationsClosed}
              title={reserveTitle}
            >
              {reserveLabel}
            </button>
          </div>
        </div>

        <nav className="guest-nav" aria-label="Pages">
          {PAGES.map(({ view, label }) => {
            const count = view === "announcements" && view !== page ? newsCount : 0;
            return (
              <button
                key={view}
                type="button"
                className={`guest-nav-link${view === page ? " is-active" : ""}`}
                onClick={() => openPage(view)}
                aria-current={view === page ? "page" : undefined}
                aria-label={count > 0 ? `${label}, ${count} new` : undefined}
              >
                <span className="guest-nav-name">
                  {label}
                  {count > 0 && (
                    <span className="guest-nav-count" aria-hidden="true">
                      {count}
                    </span>
                  )}
                </span>
                <span className="guest-nav-bar" aria-hidden="true"></span>
              </button>
            );
          })}
        </nav>
      </header>

      {myRequests.unseen.length > 0 && (
        <div className="guest-notices" role="status">
          {myRequests.unseen.map((request) => (
            <div key={request.key} className={`guest-notice is-request is-${request.info.tone}`}>
              <i className={`bi ${request.info.icon}`} aria-hidden="true"></i>
              <p>
                <strong>{request.info.title}:</strong> {request.info.label}. {request.info.detail}
              </p>
              <button type="button" className="guest-notice-link" onClick={() => myRequests.markSeen(request)}>
                Got it
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
