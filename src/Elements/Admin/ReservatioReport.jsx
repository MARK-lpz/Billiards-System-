export default function ReservationReport({ reservations }) {
  const statuses = ["pending", "approved", "completed", "rejected"];

  const getStatusColor = (status) => {
    if (status === "approved" || status === "completed") return "green";
    if (status === "rejected") return "red";
    return "yellow";
  };

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-4">
        {statuses.map(status => (
          <div key={status} className="col-md-3">
            <div className={`card reports-stat-card reports-stat-${getStatusColor(status)}`}>
              <div className="card-body">
                <i className="bi bi-calendar-check reports-stat-icon"></i>
                <div className="reports-stat-value">
                  {reservations.filter(r => r.status === status).length}
                </div>
                <div className="reports-stat-label">{status.charAt(0).toUpperCase() + status.slice(1)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reservations Table */}
      <div className="card reports-card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table reports-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Table</th>
                  <th>Pax</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map(r => (
                  <tr key={r.id}>
                    <td className="reports-table-name">{r.customer}</td>
                    <td>{r.date}</td>
                    <td>{r.time}</td>
                    <td>Table {r.table}</td>
                    <td>{r.pax}</td>
                    <td>
                      <span className={`badge reports-badge-${r.status}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="reports-table-notes">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}