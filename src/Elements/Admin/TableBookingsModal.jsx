import { useEffect } from "react";
import { describeReservationTime, formatReservationDate } from "../../utils/reservations";
import { formatMobile } from "../../utils/siteSettings";

const STATUSES = {
  pending: { label: "Payment to check", tone: "amber" },
  approved: { label: "Confirmed", tone: "green" },
  reserved: { label: "Table held", tone: "gold" },
  arrived: { label: "Arrived", tone: "blue" },
};

const TABLE_STATUSES = {
  available: "Available now",
  occupied: "In use now",
  reserved: "Held for a booking now",
  cleaning: "Being cleaned",
  maintenance: "Under maintenance",
};

// "Today", "Tomorrow" or "Oct 31, 2026".
const describeDay = (date, now) => {
  const today = now.toLocaleDateString("en-CA");
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString("en-CA");
  if (date === today) return "Today";
  if (date === tomorrow) return "Tomorrow";
  return formatReservationDate(date);
};

/**
 * One table's reservations still to come, opened from a table on the
 * dashboard: when, who, how they booked and where each one stands. Reading
 * only; "Open Reservations" is where they are approved, moved or cancelled.
 */
export default function TableBookingsModal({ table, bookings = [], now, onClose, onOpenReservations }) {
  const tableName = table.name || `Table ${table.id}`;
  const clock = new Date(now);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div
        className="modal show table-bookings-modal"
        style={{ display: "flex" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-bookings-title"
        onClick={onClose}
      >
        <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="table-bookings-title">
                <i className="bi bi-calendar-event" aria-hidden="true"></i>
                {tableName} · Reservations
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              <p className="table-bookings-now">
                <span className={`table-bookings-state is-${table.status}`}>{TABLE_STATUSES[table.status] || table.status}</span>
                {table.status === "occupied" && table.customer ? <span>{table.customer} is playing</span> : null}
              </p>

              {bookings.length ? (
                <ul className="table-bookings-list">
                  {bookings.map((booking) => {
                    const status = STATUSES[booking.status] || { label: booking.status, tone: "blue" };
                    const details = [
                      formatMobile(booking.phone),
                      booking.source === "online" ? "Booked online" : "Booked at the desk",
                    ].filter(Boolean);
                    return (
                      <li key={booking.id} className="table-bookings-item">
                        <div className="table-bookings-when">
                          <strong>{describeDay(booking.date, clock)}</strong>
                          <span>{describeReservationTime(booking) || booking.time}</span>
                        </div>
                        <div className="table-bookings-who">
                          <strong>{booking.customerName}</strong>
                          <span>{details.join(" · ")}</span>
                        </div>
                        <span className={`table-bookings-chip tone-${status.tone}`}>{status.label}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="table-bookings-empty">
                  <i className="bi bi-calendar2" aria-hidden="true"></i>
                  No reservations coming up on {tableName}.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-success" onClick={onOpenReservations}>
                <i className="bi bi-calendar-check" aria-hidden="true"></i>
                Open Reservations
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
