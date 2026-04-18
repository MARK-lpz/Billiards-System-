export default function TableCard({ table, timer, onWalkIn, onEndSession, onCancel }) {
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

      <div className="table-actions">
        {table.status === "available" && (
          <button className="btn-walkin" onClick={() => onWalkIn(table.id)}>
            Walk-in
          </button>
        )}
        {table.status === "occupied" && (
          <button className="btn-end-session" onClick={() => onEndSession(table.id)}>
            End Session
          </button>
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
    </div>
  );
}
