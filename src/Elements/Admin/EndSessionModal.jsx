import { useEffect } from "react";
import "../../styles/Admin/PoolTables.css";
import { formatHoursLabel } from "../../utils/reservations";
import { formatPeso, getPlayedMinutes, getSessionTotal } from "../../utils/tableSession";

/**
 * Asks before a running session is ended, showing the time played and the
 * total. The admin's Pool Tables and the employee dashboard both use it, so
 * every desk gets the same warning. `endingAt` is when End Session was pressed,
 * so the total shown is the one charged.
 */
export default function EndSessionModal({ table, endingAt, onClose, onConfirm }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const bookedMinutes = Number(table.durationMinutes || 60);
  const playedMinutes = getPlayedMinutes(table, endingAt);

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="end-session-title">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content pool-end-modal">
            <div className="modal-header">
              <h5 className="modal-title" id="end-session-title">
                <i className="bi bi-exclamation-triangle me-2"></i>
                End Session Warning
              </h5>
              <button
                type="button"
                className="pool-modal-close"
                aria-label="Close end session warning"
                onClick={onClose}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p className="pool-end-copy">
                Ending {table.name} will clear the active timer and mark the table as available.
              </p>
              <p className="pool-end-copy">
                Played {formatHoursLabel(playedMinutes)} of {formatHoursLabel(bookedMinutes)}. Total:{" "}
                <strong>{formatPeso(getSessionTotal(table))}</strong>
                {playedMinutes < bookedMinutes && ` for the full booked time`}
              </p>
              <p className="pool-end-copy">
                The bill goes to Sales / POS, where the customer pays it together with any food and drinks.
              </p>
              <div className="pool-end-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={onConfirm}>
                  <i className="bi bi-stop-circle me-2"></i>
                  Confirm End Session
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
