import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * "My bookings": every booking and tournament sign-up sent from this browser,
 * with where each stands. Opening it counts as seeing them all.
 */
export default function MyRequestsPanel({ requests, onForget, onClose }) {
  const closeButton = useRef(null);
  // Read by the Escape key; kept current, so the panel is not set up again on each update.
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  // Focus starts on Close when the panel opens, and Escape closes it.
  useEffect(() => {
    closeButton.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <div className="my-requests-backdrop" onClick={onClose}>
      <section
        className="my-requests-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-requests-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="my-requests-head">
          <h2 id="my-requests-title">My bookings</h2>
          <button type="button" className="my-requests-close" onClick={onClose} aria-label="Close" ref={closeButton}>
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </header>
        <p className="my-requests-intro">
          Table bookings and tournament sign-ups sent from this phone or computer. They update by themselves.
        </p>

        {requests.length ? (
          <ul className="my-requests-list">
            {requests.map((request) => {
              const info = request.info;
              const tone = info?.tone || "waiting";
              return (
                <li key={request.key} className={`my-request is-${tone}`}>
                  <div className="my-request-top">
                    <span className="my-request-kind">
                      <i className={`bi ${request.kind === "tournament" ? "bi-trophy" : "bi-calendar2-check"}`} aria-hidden="true"></i>
                      {request.kind === "tournament" ? "Tournament" : "Table booking"}
                    </span>
                    <span className={`my-request-chip is-${tone}`}>
                      {info && <i className={`bi ${info.icon}`} aria-hidden="true"></i>}
                      {info ? info.title : "Checking..."}
                    </span>
                  </div>
                  <strong className="my-request-label">{info?.label || request.label}</strong>
                  {request.view?.participant && <span className="my-request-player">Player: {request.view.participant}</span>}
                  {info?.detail && <p className="my-request-detail">{info.detail}</p>}
                  <button type="button" className="my-request-forget" onClick={() => onForget(request.key)}>
                    Remove from this device
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="my-requests-empty">Nothing here yet.</p>
        )}
      </section>
    </div>
  );
}
