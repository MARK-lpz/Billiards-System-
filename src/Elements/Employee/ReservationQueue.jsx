// ReservationQueue.jsx
export default function ReservationQueue({
  reservations,
  reservationFilter,
  setReservationFilter,
  onBookingStatus,
}) {
  const filterCounts = {
    all: reservations.length,
    reserved: reservations.filter((booking) => booking.status === "reserved").length,
    arrived: reservations.filter((booking) => booking.status === "arrived").length,
    seated: reservations.filter((booking) =>
      ["seated", "completed"].includes(booking.status)
    ).length,
  };

  const getStatusLabel = (status) => {
    if (status === "reserved") return "Reserved";
    if (status === "arrived") return "Arrived";
    if (status === "seated" || status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    return status;
  };

  const getStatusClass = (status) => {
    if (status === "reserved") return "rd-badge-pending";
    if (status === "arrived") return "rd-badge-approved";
    if (status === "seated" || status === "completed") return "rd-badge-completed";
    if (status === "cancelled") return "rd-badge-rejected";
    return "rd-badge-pending";
  };

  return (
    <section className="rd-queue-section">
      <div className="rd-filters">
        {[
          ["all", "All"],
          ["reserved", "Reserved"],
          ["arrived", "Arrived"],
          ["seated", "Completed"],
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
                      {booking.source === "existing"
                        ? "Imported from table status"
                        : "Front desk booking"}
                    </td>
                    <td>
                      <div className="rd-actions">
                        {booking.status === "reserved" && (
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

                        {(booking.status === "seated" || booking.status === "completed") && (
                          <button
                            type="button"
                            className="rd-secondary-btn"
                            onClick={() => onBookingStatus(booking.id, "completed")}
                          >
                            Complete
                          </button>
                        )}

                        {!["cancelled", "completed", "seated"].includes(booking.status) && (
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
            <p>No reservations found</p>
          </div>
        )}
      </div>
    </section>
  );
}
