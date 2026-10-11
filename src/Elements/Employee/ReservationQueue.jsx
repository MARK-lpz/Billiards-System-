// ReservationQueue.jsx
import { useEffect, useState } from "react";
import ConfirmDialog from "../Global/ConfirmDialog";
import { describeReservationTime, getArrivalWindow } from "../../utils/reservations";

const HISTORY_STATUSES = new Set(["completed", "cancelled", "rejected", "expired"]);

export default function ReservationQueue({
  reservations,
  allReservations = reservations,
  reservationFilter,
  setReservationFilter,
  onBookingStatus,
  onCheckPayment,
}) {
  // Cancelling cannot be undone, so the click only arms the confirmation.
  const [cancelTarget, setCancelTarget] = useState(null);
  // The clock Mark Arrived is judged by. Booking times are whole minutes, so it
  // ticks at the start of each minute and the button turns on right on time.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer;
    const tickAtNextMinute = () => {
      timer = window.setTimeout(() => {
        setNow(Date.now());
        tickAtNextMinute();
      }, 60_000 - (Date.now() % 60_000) + 50);
    };
    tickAtNextMinute();

    return () => window.clearTimeout(timer);
  }, []);

  // Takes the booking as an argument rather than reading `cancelTarget` from
  // the closure: the React Compiler narrows a closed-over `cancelTarget.id` into
  // a render-time memo check, which throws while the target is still null.
  const confirmCancel = (booking) => {
    onBookingStatus(booking.id, "cancelled");
    setCancelTarget(null);
  };

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
                {reservations.map((booking) => {
                  const arrival = getArrivalWindow(booking, new Date(now));

                  return (
                    <tr key={booking.id}>
                      <td>
                        <div className="rd-table-customer">{booking.customerName}</div>
                        {booking.phone ? (
                          <div className="rd-table-sub">{booking.phone}</div>
                        ) : null}
                      </td>
                      <td>
                        <div className="rd-table-datetime">{booking.date}</div>
                        <span className="rd-table-sub">{describeReservationTime(booking) || "No time set"}</span>
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
                          ? booking.source === "online"
                            ? "Paid online by GCash. Check the payment to approve."
                            : "Waiting for admin approval"
                          : booking.source === "existing"
                            ? "Imported from table status"
                            : booking.source === "online"
                              ? "Online reservation"
                              : "Front desk booking")}
                      </td>
                      <td>
                        <div className="rd-actions">
                          {/* Online bookings are paid by GCash, so the desk can approve
                              them once the payment is found; other pending ones stay
                              with the admin. */}
                          {booking.status === "pending" && booking.source === "online" && (
                            <button
                              type="button"
                              className="rd-primary-btn"
                              onClick={() => onCheckPayment(booking)}
                            >
                              <i className="bi bi-shield-check"></i>
                              Check Payment
                            </button>
                          )}

                          {booking.status === "pending" && booking.source !== "online" && (
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
                              {/* Only from the reserved time until the grace period ends */}
                              <button
                                type="button"
                                className="rd-secondary-btn"
                                onClick={() => onBookingStatus(booking.id, "arrived")}
                                disabled={!arrival.open}
                                title={arrival.note || undefined}
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
                              onClick={() => setCancelTarget(booking)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        {(booking.status === "approved" || booking.status === "reserved") && arrival.note && (
                          <span className={`rd-arrival-note ${arrival.open ? "is-open" : ""}`}>
                            <i className={`bi ${arrival.open ? "bi-hourglass-split" : "bi-clock"}`} aria-hidden="true"></i>
                            {arrival.note}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel this reservation?"
          message={
            <>
              <strong>{cancelTarget.customerName}</strong> on {cancelTarget.tableName} for {cancelTarget.date}
              {cancelTarget.time ? ` at ${cancelTarget.time}` : ""} will be cancelled and the slot freed for
              someone else.
            </>
          }
          detail="This cannot be undone. The booking moves to history and has to be created again if the customer still wants it."
          confirmLabel="Yes, Cancel Reservation"
          cancelLabel="Keep Reservation"
          onConfirm={() => confirmCancel(cancelTarget)}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </section>
  );
}
