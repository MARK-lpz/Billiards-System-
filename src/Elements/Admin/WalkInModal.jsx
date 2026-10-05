import { useEffect, useState } from "react";
import "../../styles/Admin/PoolTables.css";
import { MAX_WALK_IN_HOURS, formatHoursLabel, getWalkInLimit } from "../../utils/reservations";
import { formatPeso } from "../../utils/tableSession";

const HOUR_MS = 60 * 60 * 1000;

const clock = (ms) =>
  new Date(ms).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });

/**
 * Starts a walk-in session. Staff say how many hours the customer will stay, so
 * the timer ends when planned instead of after the table's default session.
 */
export default function WalkInModal({ table, reservations = [], onClose, onStart }) {
  const [customer, setCustomer] = useState("");
  // The table's default session, in hours, is the starting choice.
  const [hours, setHours] = useState(() => String(Math.max(1, Math.round(Number(table?.durationMinutes || 60) / 60))));
  const [now, setNow] = useState(() => Date.now());

  // Keeps the "until" times true while the window stays open.
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const { maxHours, nextBooking } = getWalkInLimit({ table, reservations, now: new Date(now) });
  const canStart = maxHours >= 1;
  const chosenHours = Math.min(Math.max(1, Number(hours) || 1), Math.max(1, maxHours));
  const hourOptions = Array.from({ length: maxHours }, (_, index) => index + 1);
  const tableName = table?.name || "This table";
  const limitedByBooking = Boolean(nextBooking) && maxHours < MAX_WALK_IN_HOURS;
  const total = Number(table?.rate || 0) * chosenHours;

  const start = () => {
    if (!canStart) return;
    onStart({ customer: customer.trim() || "Walk-in Customer", minutes: chosenHours * 60 });
  };

  return (
    <>
      <div className="modal show" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="walkin-title">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="walkin-title">
                <i className="bi bi-person-plus me-2"></i>
                Walk-in Customer · {tableName}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label" htmlFor="walkin-customer">Customer Name (optional)</label>
                <input
                  id="walkin-customer"
                  type="text"
                  className="form-control"
                  value={customer}
                  onChange={(event) => setCustomer(event.target.value)}
                  placeholder="Walk-in Customer"
                  autoFocus
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="walkin-hours">How long will they stay?</label>
                <select
                  id="walkin-hours"
                  className="form-select"
                  value={canStart ? String(chosenHours) : ""}
                  onChange={(event) => setHours(event.target.value)}
                  disabled={!canStart}
                >
                  {!canStart && <option value="">No time free on this table</option>}
                  {hourOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatHoursLabel(option * 60)} (until {clock(now + option * HOUR_MS)})
                    </option>
                  ))}
                </select>
                {limitedByBooking && canStart && (
                  <p className="walkin-note">
                    <i className="bi bi-calendar-check"></i>
                    Up to {formatHoursLabel(maxHours * 60)}: {tableName} is reserved at {nextBooking.label}.
                  </p>
                )}
              </div>

              {canStart ? (
                <div className="walkin-summary">
                  <span>
                    <i className="bi bi-flag"></i>
                    Session ends at <strong>{clock(now + chosenHours * HOUR_MS)}</strong>
                  </span>
                  <span className="walkin-summary-total">
                    {formatPeso(total)} for {formatHoursLabel(chosenHours * 60)}
                  </span>
                </div>
              ) : (
                <p className="walkin-warning" role="alert">
                  <i className="bi bi-exclamation-triangle"></i>
                  {nextBooking?.startsIn <= 0
                    ? `${tableName} is booked right now (from ${nextBooking.label}). Please seat this walk-in at another table.`
                    : `${tableName} is reserved at ${nextBooking?.label}, less than an hour from now. Please seat this walk-in at another table.`}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-success" onClick={start} disabled={!canStart}>
                <i className="bi bi-play-circle me-2"></i>
                Start Session
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
