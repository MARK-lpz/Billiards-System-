import { useEffect, useState } from "react";
import "../../styles/Admin/PoolTables.css";
import { WALK_IN_DURATIONS, formatHoursLabel, getWalkInLimit } from "../../utils/reservations";
import { formatPeso } from "../../utils/tableSession";

const MINUTE_MS = 60 * 1000;
const SHORTEST_WALK_IN = WALK_IN_DURATIONS[0];
const LONGEST_WALK_IN = WALK_IN_DURATIONS[WALK_IN_DURATIONS.length - 1];

const clock = (ms) =>
  new Date(ms).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });

/**
 * Starts a walk-in session. Staff say how long the customer will stay, so the
 * timer ends when planned instead of after the table's default session.
 */
export default function WalkInModal({ table, reservations = [], onClose, onStart }) {
  const [customer, setCustomer] = useState("");
  // The table's default session is the starting choice when it is one of the
  // choices; otherwise 1 hour.
  const [minutes, setMinutes] = useState(() => {
    const tableDefault = Number(table?.durationMinutes);
    return String(WALK_IN_DURATIONS.includes(tableDefault) ? tableDefault : 60);
  });
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

  const { maxMinutes, nextBooking } = getWalkInLimit({ table, reservations, now: new Date(now) });
  // Only the choices that end before the table's next booking.
  const durationOptions = WALK_IN_DURATIONS.filter((option) => option <= maxMinutes);
  const canStart = durationOptions.length > 0;
  // The choice made, or the longest one still free when a booking cuts it short.
  const chosenMinutes =
    durationOptions.filter((option) => option <= Number(minutes)).pop() ?? durationOptions[0] ?? 0;
  const tableName = table?.name || "This table";
  const limitedByBooking = Boolean(nextBooking) && maxMinutes < LONGEST_WALK_IN;
  const total = (Number(table?.rate || 0) * chosenMinutes) / 60;

  const start = () => {
    if (!canStart) return;
    onStart({ customer: customer.trim() || "Walk-in Customer", minutes: chosenMinutes });
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
                  value={canStart ? String(chosenMinutes) : ""}
                  onChange={(event) => setMinutes(event.target.value)}
                  disabled={!canStart}
                >
                  {!canStart && <option value="">No time free on this table</option>}
                  {durationOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatHoursLabel(option)} (until {clock(now + option * MINUTE_MS)})
                    </option>
                  ))}
                </select>
                {limitedByBooking && canStart && (
                  <p className="walkin-note">
                    <i className="bi bi-calendar-check"></i>
                    Up to {formatHoursLabel(durationOptions[durationOptions.length - 1])}: {tableName} is reserved at {nextBooking.label}.
                  </p>
                )}
              </div>

              {canStart ? (
                <div className="walkin-summary">
                  <span>
                    <i className="bi bi-flag"></i>
                    Session ends at <strong>{clock(now + chosenMinutes * MINUTE_MS)}</strong>
                  </span>
                  <span className="walkin-summary-total">
                    {formatPeso(total)} for {formatHoursLabel(chosenMinutes)}
                  </span>
                </div>
              ) : (
                <p className="walkin-warning" role="alert">
                  <i className="bi bi-exclamation-triangle"></i>
                  {nextBooking?.startsIn <= 0
                    ? `${tableName} is booked right now (from ${nextBooking.label}). Please seat this walk-in at another table.`
                    : `${tableName} is reserved at ${nextBooking?.label}, less than ${formatHoursLabel(SHORTEST_WALK_IN)} from now. Please seat this walk-in at another table.`}
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
