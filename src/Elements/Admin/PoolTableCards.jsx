import { useState, useEffect } from "react";

export default function PoolTableCard({ 
  table, 
  onWalkIn, 
  onEndSession, 
  onCheckIn, 
  onCancelReserve, 
  onAddTime,
  onUndoTime,
  onEdit,
  onDelete 
}) {
  const isOccupied = table.status === "occupied";
  const isReserved = table.status === "reserved";
  const isAvailable = table.status === "available";
  const isCleaning = table.status === "cleaning";
  const isMaintenance = table.status === "maintenance";
  const statusLabel = {
    available: "Ready for use",
    occupied: "Occupied",
    reserved: "Reserved",
    cleaning: "Cleaning",
    maintenance: "Under maintenance",
  };

  const [now, setNow] = useState(() => Date.now());
  const [extensionMinutes, setExtensionMinutes] = useState("30");
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [showTimePresets, setShowTimePresets] = useState(false);

  useEffect(() => {
    if (!table.startTime || !isOccupied) return;
    const durationMs = Number(table.durationMinutes || 60) * 60 * 1000;
    const endAt = table.startTime + durationMs;
    const tick = () => {
      const currentTime = Date.now();
      setNow(Math.min(currentTime, endAt));
      return currentTime >= endAt;
    };

    if (tick()) return;
    const interval = setInterval(() => {
      if (tick()) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [table.startTime, table.durationMinutes, isOccupied]);

  const plannedSeconds = Math.max(0, Number(table.durationMinutes || 60) * 60);
  const adjustmentMinutes = Number(extensionMinutes);
  const isValidAdjustment = Number.isInteger(adjustmentMinutes) && adjustmentMinutes > 0;
  const elapsedSeconds = table.startTime
    ? Math.min(plannedSeconds || Infinity, Math.max(0, Math.floor((now - table.startTime) / 1000)))
    : 0;
  const remainingSeconds = plannedSeconds ? Math.max(0, plannedSeconds - elapsedSeconds) : null;
  const isEndingSoon = isOccupied && remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 600;
  const isOvertime = isOccupied && plannedSeconds > 0 && elapsedSeconds >= plannedSeconds;
  const charge = elapsedSeconds > 0 ? ((elapsedSeconds / 3600) * table.rate).toFixed(2) : "0.00";

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`pool-table-card pool-table-${table.status}`}>
      {/* Header */}
      <div className="pool-table-card-header">
        <div className="pool-table-name">{table.name}</div>
        <div className="pool-table-rate">₱{table.rate}/hr</div>
      </div>

      {/* Timer and Charge (for occupied tables) */}
      {isOccupied && (
        <div className="pool-table-timer-section">
          <div className="pool-table-timer">
            <i className="bi bi-clock me-2"></i>
            {formatTime(elapsedSeconds)}
          </div>
          <div className="pool-table-charge">₱{parseFloat(charge).toLocaleString()}</div>
        </div>
      )}

      {isOccupied && remainingSeconds !== null && (
        <div className={`pool-table-time-alert ${isOvertime ? "danger" : isEndingSoon ? "warning" : ""}`}>
          <i className={`bi ${isOvertime || isEndingSoon ? "bi-exclamation-triangle" : "bi-hourglass-split"} me-2`}></i>
          {isOvertime ? "Session time ended - timer stopped" : `${formatTime(remainingSeconds)} remaining`}
        </div>
      )}

      {/* Status Badge */}
      <div className="pool-table-status">
        <div className={`pool-status-dot pool-status-${table.status}`}></div>
        <span className="pool-status-text">{statusLabel[table.status] || table.status}</span>
      </div>

      {/* Customer Name */}
      {table.customer && (
        <div className="pool-table-customer">
          <i className="bi bi-person-fill me-2"></i>
          {table.customer}
        </div>
      )}

      {isReserved && (table.reservationDate || table.reservationTime) && (
        <div className="pool-table-reservation-slot">
          <i className="bi bi-calendar-check me-2" aria-hidden="true"></i>
          <span>
            Reserved for {table.reservationDate || "selected date"}
            {table.reservationTime ? ` at ${table.reservationTime}` : ""}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pool-table-actions">
        {isAvailable && (
          <button className="btn btn-sm btn-outline-success" onClick={onWalkIn}>
            <i className="bi bi-person-plus me-1"></i>
            Walk-in
          </button>
        )}

        {isOccupied && (
          <>
            <div className="pool-table-extension-control">
              <button
                className="btn btn-sm btn-outline-warning"
                onClick={() => setIsTimeModalOpen(true)}
              >
                <i className="bi bi-stopwatch me-1"></i>
                Manage Time
              </button>
            </div>
            <button className="btn btn-sm btn-danger pool-table-end-btn" onClick={onEndSession}>
              <i className="bi bi-stop-circle me-1"></i>
              End Session
            </button>
          </>
        )}

        {isReserved && (
          <>
            <button className="btn btn-sm btn-warning" onClick={onCheckIn}>
              <i className="bi bi-check-circle me-1"></i>
              Check In
            </button>
            <button className="btn btn-sm btn-outline-danger" onClick={onCancelReserve}>
              <i className="bi bi-x-circle me-1"></i>
              Cancel
            </button>
          </>
        )}

        {(isCleaning || isMaintenance) && (
          <button className="btn btn-sm btn-secondary pool-table-maintenance-btn" disabled>
            <i className={`${isCleaning ? "bi bi-stars" : "bi bi-tools"} me-1`}></i>
            {isCleaning ? "Cleaning" : "Maintenance"}
          </button>
        )}

        <button className="btn btn-sm btn-outline-secondary pool-table-edit-btn" onClick={onEdit}>
          <i className="bi bi-pencil"></i>
        </button>
        {onDelete && (
          <button className="btn btn-sm btn-outline-secondary pool-table-delete-btn" onClick={onDelete}>
            <i className="bi bi-trash"></i>
          </button>
        )}
      </div>

      {isTimeModalOpen && (
        <div
          className="pool-time-modal"
          role="dialog"
          aria-labelledby={`time-modal-title-${table.id}`}
        >
            <div className="pool-time-modal-header">
              <h3 id={`time-modal-title-${table.id}`}>Adjust {table.name} Time</h3>
              <button
                type="button"
                className="pool-time-close"
                aria-label="Close time adjustment"
                onClick={() => setIsTimeModalOpen(false)}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <label className="pool-time-input-label" htmlFor={`time-minutes-${table.id}`}>Time adjustment (minutes)</label>
              <div className="pool-time-combobox">
              <input
                id={`time-minutes-${table.id}`}
                className="pool-time-input"
                type="text"
                inputMode="numeric"
                value={extensionMinutes}
                onChange={(event) => setExtensionMinutes(event.target.value)}
              />
              <button
                type="button"
                className="pool-time-preset-toggle"
                aria-label="Show time presets"
                aria-expanded={showTimePresets}
                onClick={() => setShowTimePresets((isOpen) => !isOpen)}
              >
                <i className={`bi bi-chevron-${showTimePresets ? "up" : "down"}`}></i>
              </button>
              {showTimePresets && (
                <div className="pool-time-presets" role="listbox">
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
            <p className="pool-time-modal-note">Choose a preset or enter the number of minutes to add or undo.</p>
            <div className="pool-time-modal-actions">
              <button
                type="button"
                className="btn pool-time-add-button"
                disabled={!isValidAdjustment}
                onClick={() => {
                  onAddTime(adjustmentMinutes);
                  setIsTimeModalOpen(false);
                }}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Add Time
              </button>
              <button
                type="button"
                className="btn pool-time-undo-button"
                disabled={!isValidAdjustment || !Number(table.addedMinutes || 0)}
                onClick={() => {
                  onUndoTime(adjustmentMinutes);
                  setIsTimeModalOpen(false);
                }}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i>
                Undo Time
              </button>
            </div>
        </div>
      )}
    </div>
  );
}
