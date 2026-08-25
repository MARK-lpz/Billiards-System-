const HISTORY_STATUSES = new Set(["completed", "rejected", "cancelled", "expired"]);

export default function ReservationsTable({ reservations, onUpdate, onEdit, emptyMessage }) {
  return (
    <div className="card reservations-table-card">
      <div className="card-body">
        <div className="table-responsive">
          <table className="table reservations-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Date & Time</th>
                <th>Table</th>
                <th>Pax</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="reservations-empty">
                    <i className="bi bi-inbox"></i>
                    <p>{emptyMessage || "No reservations found"}</p>
                  </td>
                </tr>
              ) : (
                reservations.map(r => {
                  const isHistorical = HISTORY_STATUSES.has(r.status);

                  return (
                  <tr key={r.id}>
                    <td className="reservations-customer">{r.customerName || r.customer}</td>
                    <td className="reservations-datetime">
                      {r.date}
                      <br />
                      <span className="reservations-time">{r.time}</span>
                    </td>
                    <td>{r.tableName || `Table ${r.tableId ?? r.table}`}</td>
                    <td>{r.partySize ?? r.pax} pax</td>
                    <td>
                      <span className={`badge reservations-badge-${r.status}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="reservations-notes">{r.notes || "—"}</td>
                    <td>
                      <div className="reservations-actions">
                        {r.status === "pending" && (
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => onUpdate(r.id, { status: "approved" })}
                            >
                              <i className="bi bi-check-circle me-1"></i>
                              Approve
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => onUpdate(r.id, { status: "rejected" })}
                            >
                              <i className="bi bi-x-circle me-1"></i>
                              Reject
                            </button>
                          </>
                        )}
                        {r.status === "approved" && (
                          <>
                            <button
                              className="btn btn-sm btn-info"
                              onClick={() => onUpdate(r.id, { status: "completed" })}
                            >
                              <i className="bi bi-check-circle me-1"></i>
                              Complete
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => onUpdate(r.id, { status: "rejected" })}
                            >
                              <i className="bi bi-x-circle me-1"></i>
                              Cancel
                            </button>
                          </>
                        )}
                        {!isHistorical && (
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => onEdit(r)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
