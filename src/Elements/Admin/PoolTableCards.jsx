export default function PoolTableCard({ 
  table, 
  onReserve, 
  onWalkIn, 
  onEndSession, 
  onCheckIn, 
  onCancelReserve, 
  onEdit 
}) {
  const isOccupied = table.status === "occupied";
  const isReserved = table.status === "reserved";
  const isAvailable = table.status === "available";
  const isMaintenance = table.status === "maintenance";

  const charge = table.timer > 0 ? ((table.timer / 3600) * table.rate).toFixed(2) : "0.00";

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
            {formatTime(table.timer)}
          </div>
          <div className="pool-table-charge">₱{parseFloat(charge).toLocaleString()}</div>
        </div>
      )}

      {/* Status Badge */}
      <div className="pool-table-status">
        <div className={`pool-status-dot pool-status-${table.status}`}></div>
        <span className="pool-status-text">{table.status}</span>
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
          <>
            <button className="btn btn-sm btn-success" onClick={onReserve}>
              <i className="bi bi-calendar-check me-1"></i>
              Reserve
            </button>
            <button className="btn btn-sm btn-outline-success" onClick={onWalkIn}>
              <i className="bi bi-person-plus me-1"></i>
              Walk-in
            </button>
          </>
        )}

        {isOccupied && (
          <button className="btn btn-sm btn-danger pool-table-end-btn" onClick={onEndSession}>
            <i className="bi bi-stop-circle me-1"></i>
            End Session
          </button>
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

        {isMaintenance && (
          <button className="btn btn-sm btn-secondary pool-table-maintenance-btn" disabled>
            <i className="bi bi-tools me-1"></i>
            Maintenance
          </button>
        )}

        <button className="btn btn-sm btn-outline-secondary pool-table-edit-btn" onClick={onEdit}>
          <i className="bi bi-pencil"></i>
        </button>
      </div>
    </div>
  );
}