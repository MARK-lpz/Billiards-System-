// ReservationQueue.jsx
const HISTORY_STATUSES = new Set(["completed", "cancelled", "rejected", "expired"]);

export default function ReservationQueue({
  reservations,
  allReservations = reservations,
  reservationFilter,
  setReservationFilter,
  onBookingStatus,
}) {
  const filterCounts = {
    all: allReservations.filter((booking) => !HISTORY_STATUSES.has(booking.status)).length,
    pending: allReservations.filter((booking) => booking.status === "pending").length,
    approved: allReservations.filter((booking) =>
      ["approved", "reserved"].includes(booking.status)
    ).length,
    arrived: allReservations.filter((booking) => booking.status === "arrived").length,
    history: allReservations.filter((booking) => HISTORY_STATUSES.has(booking.status)).length,
  };

  const getStatusLabel = (status) => {
    if (status === "pending") return "Pending Approval";
    if (status === "approved" || status === "reserved") return "Approved";
    if (status === "arrived") return "Arrived";
    if (status === "seated") return "Assigned";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    if (status === "rejected") return "Rejected";
    if (status === "expired") return "Expired";
    return status;
  };

  const getStatusClass = (status) => {
    if (status === "pending") return "rd-badge-pending";
    if (status === "approved" || status === "reserved") return "rd-badge-approved";
    if (status === "arrived") return "rd-badge-approved";
    if (status === "seated" || status === "completed") return "rd-badge-completed";
    if (["cancelled", "rejected"].includes(status)) return "rd-badge-rejected";
    if (status === "expired") return "rd-badge-expired";
    return "rd-badge-pending";
  };

  return (
    <section className="rd-queue-section">
      <div className="rd-filters">
        {[
          ["all", "All"],
          ["pending", "Pending"],
          ["approved", "Approved"],
          ["arrived", "Arrived"],
          ["history", "History"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`rd-filter-btn ${reservationFilter === value ? "active" : ""}`}
            onClick={() => setReservationFilter(value)}
          >
            {label}
            <span className="rd-filter-count">({filterCounts[value]})</span>
          </button>
        ))}
      </div>

      <div className="rd-table-card">
        {reservations.length ? (
          <div className="rd-table-wrap">
            <table className="rd-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Date &amp; Time</th>
                  <th>Table</th>
                  <th>Pax</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <div className="rd-table-customer">{booking.customerName}</div>
                      {booking.phone ? (
                        <div className="rd-table-sub">{booking.phone}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="rd-table-datetime">{booking.date}</div>
                      <span className="rd-table-sub">{booking.time || "No time set"}</span>
                    </td>
                    <td className="rd-table-name">{booking.tableName}</td>
                    <td className="rd-table-pax">{booking.partySize}</td>
                    <td>
                      <span className={`rd-status ${getStatusClass(booking.status)}`}>
                        {getStatusLabel(booking.status)}
                      </span>
                    </td>
                    <td className="rd-table-notes">
                      {booking.notes || (booking.status === "pending"
                        ? "Waiting for admin approval"
                        : booking.source === "existing"
                          ? "Imported from table status"
                          : booking.source === "online"
                            ? "Online reservation"
                            : "Front desk booking")}
                    </td>
                    <td>
                      <div className="rd-actions">
                        {booking.status === "pending" && (
                          <button
                            type="button"
                            className="rd-secondary-btn"
                            disabled
                          >
                            Waiting Approval
                          </button>
                        )}

                        {(booking.status === "approved" || booking.status === "reserved") && (
                          <>
                            <button
                              type="button"
                              className="rd-secondary-btn"
                              onClick={() => onBookingStatus(booking.id, "arrived")}
                            >
                              Mark Arrived
                            </button>
                            <button
                              type="button"
                              className="rd-primary-btn"
                              onClick={() => onBookingStatus(booking.id, "seated")}
                            >
                              Assign Table
                            </button>
                          </>
                        )}

                        {booking.status === "arrived" && (
                          <button
                            type="button"
                            className="rd-primary-btn"
                            onClick={() => onBookingStatus(booking.id, "seated")}
                          >
                            Seat Customer
                          </button>
                        )}

                        {booking.status === "seated" && (
                          <button
                            type="button"
                            className="rd-secondary-btn"
                            onClick={() => onBookingStatus(booking.id, "completed")}
                          >
                            Complete
                          </button>
                        )}

                        {["pending", "approved", "reserved", "arrived"].includes(booking.status) && (
                          <button
                            type="button"
                            className="rd-danger-btn"
                            onClick={() => onBookingStatus(booking.id, "cancelled")}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rd-empty">
            <i className="bi bi-inbox"></i>
            <p>{reservationFilter === "history" ? "No reservation history yet" : "No active reservations found"}</p>
          </div>
        )}
      </div>
    </section>
  );
}
