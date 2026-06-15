import { useState, useEffect } from "react";

export default function PoolTableCard({ 
  table, 
  onWalkIn, 
  onEndSession, 
  onCheckIn, 
  onCancelReserve, 
  onAddTime,
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
            <button className="btn btn-sm btn-outline-warning" onClick={onAddTime}>
              <i className="bi bi-plus-circle me-1"></i>
              Add 30 min
            </button>
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
    </div>
  );
}
