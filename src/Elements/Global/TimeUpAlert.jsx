import { useEffect, useState } from "react";
import { formatHoursLabel } from "../../utils/reservations";
import { formatPeso, getSessionEnd, getSessionTotal } from "../../utils/tableSession";

const clock = (ms) =>
  new Date(ms).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });

// One alert per run-out: adding time and running out again counts as a new one.
const alertKey = (table) => `${table.id}:${table.startTime}:${table.durationMinutes}`;

/**
 * Tells staff, on whatever page they are on, that a table's booked time is up.
 * The session is not ended for them: the table stays occupied until they add
 * time or end it here, so a customer who wants more time can simply get it.
 */
export default function TimeUpAlert({ tables = [], onAddTime, onEndSession }) {
  const [now, setNow] = useState(() => Date.now());
  // Alerts closed with "Later"; the card still shows the timer has stopped.
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const finished = tables
    .map((table) => ({ table, endsAt: getSessionEnd(table), key: alertKey(table) }))
    .filter((entry) => entry.endsAt !== null && entry.endsAt <= now && !dismissed.includes(entry.key))
    .sort((first, second) => first.endsAt - second.endsAt);
  const current = finished[0];
  const currentKey = current?.key;

  const dismiss = (key) => setDismissed((previous) => [...previous, key]);

  useEffect(() => {
    if (!currentKey) return;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setDismissed((previous) => [...previous, currentKey]);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [currentKey]);

  if (!current) return null;

  const { table, endsAt, key } = current;
  const tableName = table.name || `Table ${table.id}`;
  const customer = table.customer || "The customer";
  const otherCount = finished.length - 1;

  return (
    <>
      <div className="modal show time-up-layer" role="alertdialog" aria-modal="true" aria-labelledby="time-up-title">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="time-up-title">
                <i className="bi bi-alarm"></i>
                Time&apos;s Up: {tableName}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Remind me later" title="Later" onClick={() => dismiss(key)}></button>
            </div>

            <div className="modal-body">
              <p className="time-up-copy">
                {customer}&apos;s {formatHoursLabel(Number(table.durationMinutes || 60))} on {tableName} ended at{" "}
                {clock(endsAt)}.
              </p>
              <div className="time-up-total">
                <span>Amount to collect</span>
                <strong>{formatPeso(getSessionTotal(table))}</strong>
              </div>
              <p className="time-up-hint">
                The table stays occupied until you add time or end the session.
                {otherCount > 0 && ` ${otherCount} more ${otherCount === 1 ? "table has" : "tables have"} also run out.`}
              </p>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => onAddTime(table.id, 30)}>
                <i className="bi bi-plus-circle"></i>
                30 min
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => onAddTime(table.id, 60)}>
                <i className="bi bi-plus-circle"></i>
                1 hour
              </button>
              <button type="button" className="btn btn-danger" onClick={() => onEndSession(table.id)}>
                <i className="bi bi-stop-circle"></i>
                End Session
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show time-up-layer"></div>
    </>
  );
}
