import { useState } from "react";

export default function TableCard({
  table,
  timer,
  sessionInfo,
  onWalkIn,
  onEndSession,
  onAddTime,
  onUndoTime,
  onCancel,
}) {
  const [extensionMinutes, setExtensionMinutes] = useState("30");
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [showTimePresets, setShowTimePresets] = useState(false);
  const adjustmentMinutes = Number(extensionMinutes);
  const isValidAdjustment = Number.isInteger(adjustmentMinutes) && adjustmentMinutes > 0;
  const statusLabel = {
    available: "Ready for use",
    occupied: "Occupied",
    reserved: "Reserved",
    cleaning: "Cleaning",
    maintenance: "Under maintenance",
  };

  const getClass = (status) => ({
    card: `table-card card-${status}`,
    status: `status-${status}`,
  });

  const classes = getClass(table.status);

  return (
    <div className={classes.card}>
      <div className="table-card-header">
        <h3 className="table-name">{table.name || 'Table'}</h3>
        <div className="table-rate-wrapper">
          <i className="bi bi-cash-coin rate-icon"></i>
          <span className="table-rate">₱{table.rate}/hr</span>
          {timer && (
            <span className="table-timer">
              <i className="bi bi-clock timer-icon"></i>
              {timer}
            </span>
          )}
        </div>
      </div>

      <div className="table-status-row">
        <span className={`status-badge ${classes.status}`}>
          <i className="bi bi-circle-fill status-dot"></i>
          {statusLabel[table.status] || table.status}
        </span>
      </div>

      {table.status === "occupied" && sessionInfo && (
        <div className={`table-session-alert ${sessionInfo.ended ? "ended" : sessionInfo.endingSoon ? "warning" : ""}`}>
          <i className={`bi ${sessionInfo.ended || sessionInfo.endingSoon ? "bi-exclamation-triangle" : "bi-hourglass-split"}`}></i>
          <span>{sessionInfo.ended ? "Session time ended - timer stopped" : `${sessionInfo.remaining} remaining`}</span>
        </div>
      )}

      <div className="table-actions">
        {table.status === "available" && (
          <button className="btn-walkin" onClick={() => onWalkIn(table.id)}>
            Walk-in
          </button>
        )}
        {table.status === "occupied" && (
          <>
            <div className="table-extension-control">
              <button
                className="btn-add-time"
                onClick={() => setIsTimeModalOpen(true)}
              >
                <i className="bi bi-stopwatch"></i>
                Manage Time
              </button>
            </div>
            <button className="btn-end-session" onClick={() => onEndSession(table.id)}>
              End Session
            </button>
          </>
        )}
        {table.status === "reserved" && (
          <>
            <button className="btn-walkin" onClick={() => onWalkIn(table.id)}>
              Check In
            </button>
            <button className="btn-cancel" onClick={() => onCancel(table.id)}>
              Cancel
            </button>
          </>
        )}
      </div>

      {isTimeModalOpen && (
        <div
          className="table-time-modal"
          role="dialog"
          aria-labelledby={`employee-time-modal-title-${table.id}`}
        >
            <div className="table-time-modal-header">
              <h3 id={`employee-time-modal-title-${table.id}`}>Adjust {table.name} Time</h3>
              <button type="button" className="table-time-close" aria-label="Close" onClick={() => setIsTimeModalOpen(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <label className="table-time-input-label" htmlFor={`employee-time-minutes-${table.id}`}>Time adjustment (minutes)</label>
              <div className="table-time-combobox">
              <input
                id={`employee-time-minutes-${table.id}`}
                className="table-time-input"
                type="text"
                inputMode="numeric"
                value={extensionMinutes}
                onChange={(event) => setExtensionMinutes(event.target.value)}
              />
              <button
                type="button"
                className="table-time-preset-toggle"
                aria-label="Show time presets"
                aria-expanded={showTimePresets}
                onClick={() => setShowTimePresets((isOpen) => !isOpen)}
              >
                <i className={`bi bi-chevron-${showTimePresets ? "up" : "down"}`}></i>
              </button>
              {showTimePresets && (
                <div className="table-time-presets" role="listbox">
                  {[
                    ["20", "20 min"],
                    ["30", "30 min"],
                    ["60", "1 hour"],
                  ].map(([value, label]) => (
                    <button key={value} type="button" role="option" onClick={() => {
                      setExtensionMinutes(value);
                      setShowTimePresets(false);
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="table-time-modal-note">Choose a preset or enter the number of minutes to add or undo.</p>
            <div className="table-time-modal-actions">
              <button type="button" className="btn-add-time" disabled={!isValidAdjustment} onClick={() => {
                onAddTime(table.id, adjustmentMinutes);
                setIsTimeModalOpen(false);
              }}>
                <i className="bi bi-plus-circle"></i>
                Add Time
              </button>
              <button type="button" className="btn-undo-time" disabled={!isValidAdjustment || !Number(table.addedMinutes || 0)} onClick={() => {
                onUndoTime(table.id, adjustmentMinutes);
                setIsTimeModalOpen(false);
              }}>
                <i className="bi bi-arrow-counterclockwise"></i>
                Undo Time
              </button>
            </div>
        </div>
      )}
    </div>
  );
}
