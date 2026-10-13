// ReservationQueue.jsx
import { useEffect, useState } from "react";
import ConfirmDialog from "../Global/ConfirmDialog";
import Pagination from "../Global/Pagination";
import usePagination from "../Global/usePagination";
import { describeReservationTime, getArrivalWindow } from "../../utils/reservations";
import { getReservationIssues, getReservationMode } from "../../utils/reservationIssues";

const HISTORY_STATUSES = new Set(["completed", "cancelled", "rejected", "expired"]);

const SORT_OPTIONS = [
  { value: "newest", label: "Newest", icon: "bi-sort-down" },
  { value: "oldest", label: "Oldest", icon: "bi-sort-up" },
];

// When a booking is for, in ms, or null when its date can't be read.
const getScheduleTime = (booking) => {
  const at = new Date(`${booking.date}T${booking.time || "00:00"}:00`).getTime();
  return Number.isNaN(at) ? null : at;
};

// When a booking was made: the server's requestedAt, else the time its id was made from.
const getBookedTime = (booking) => {
  const at = Date.parse(String(booking.requestedAt || "").replace(" ", "T"));
  if (!Number.isNaN(at)) return at;
  const fromId = Number(String(booking.id).split("-")[0]);
  return Number.isFinite(fromId) ? fromId : 0;
};

/**
 * Newest or oldest first by the booking's date and time (the Date & Time
 * column); two at the same time go by when they were made. A booking with no
 * readable date goes last either way.
 */
const sortBookings = (bookings, order) => {
  const direction = order === "oldest" ? 1 : -1;
  return [...bookings].sort((first, second) => {
    const firstAt = getScheduleTime(first);
    const secondAt = getScheduleTime(second);
    if (firstAt === null || secondAt === null) return (firstAt === null) - (secondAt === null);
    return direction * (firstAt - secondAt || getBookedTime(first) - getBookedTime(second));
  });
};

export default function ReservationQueue({
  reservations,
  allReservations = reservations,
  tables = [],
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

  // What is wrong with each booking right now, judged on the same clock.
  const checkBooking = (booking) =>
    getReservationIssues({ booking, tables, reservations: allReservations, now: new Date(now) });
  const needsAttention = allReservations.filter((booking) => checkBooking(booking).issues.length > 0);
  const [sortOrder, setSortOrder] = useState("newest");
  const rows = sortBookings(reservationFilter === "issues" ? needsAttention : reservations, sortOrder);
  const pagination = usePagination(rows);

  // A new filter or order starts again from the first page.
  const changeFilter = (value) => {
    setReservationFilter(value);
    pagination.goToPage(1);
  };
  const changeSort = (value) => {
    setSortOrder(value);
    pagination.goToPage(1);
  };

  const filterCounts = {
    all: allReservations.filter((booking) => !HISTORY_STATUSES.has(booking.status)).length,
    pending: allReservations.filter((booking) => booking.status === "pending").length,
    approved: allReservations.filter((booking) =>
      ["approved", "reserved"].includes(booking.status)
    ).length,
    arrived: allReservations.filter((booking) => booking.status === "arrived").length,
    issues: needsAttention.length,
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

  const getNote = (booking) =>
    booking.notes ||
    (booking.status === "pending"
      ? booking.source === "online"
        ? "Paid online by GCash. Check the payment to approve."
        : "Waiting for admin approval"
      : booking.source === "existing"
        ? "Imported from table status"
        : getReservationMode(booking).detail);

  return (
    <section className="rd-queue-section">
      <div className="rd-queue-toolbar">
        <div className="rd-filters">
          {[
            ["all", "All"],
            ["pending", "Pending"],
            ["approved", "Approved"],
            ["arrived", "Arrived"],
            ["issues", "Needs Attention"],
            ["history", "History"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`rd-filter-btn ${reservationFilter === value ? "active" : ""} ${
                value === "issues" && filterCounts.issues > 0 ? "rd-filter-btn--alert" : ""
              }`}
              onClick={() => changeFilter(value)}
            >
              {value === "issues" && <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i>}
              {label}
              <span className="rd-filter-count">({filterCounts[value]})</span>
            </button>
          ))}
        </div>

        <div className="rd-sort" role="group" aria-label="Sort reservations by date and time">
          <span className="rd-sort-label">Date &amp; time:</span>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`rd-sort-btn ${sortOrder === option.value ? "is-active" : ""}`}
              aria-pressed={sortOrder === option.value}
              onClick={() => changeSort(option.value)}
            >
              <i className={`bi ${option.icon}`} aria-hidden="true"></i>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rd-table-card">
        {rows.length ? (
          <div className="rd-table-wrap">
            <table className="rd-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Date &amp; Time</th>
                  <th>Table</th>
                  <th>Pax</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.items.map((booking) => {
                  const arrival = getArrivalWindow(booking, new Date(now));
                  const mode = getReservationMode(booking);
                  const { issues, seatBlock, seatHint } = checkBooking(booking);
                  const worst = issues.some((issue) => issue.level === "error")
                    ? "error"
                    : issues.length
                      ? "warning"
                      : "";

                  return (
                    <tr key={booking.id} className={worst ? `rd-row--${worst}` : undefined}>
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
                        <span className={`rd-mode rd-mode--${mode.key}`} title={mode.detail}>
                          <i className={`bi ${mode.icon}`} aria-hidden="true"></i>
                          {mode.label}
                        </span>
                      </td>
                      <td>
                        <span className={`rd-status ${getStatusClass(booking.status)}`}>
                          {getStatusLabel(booking.status)}
                        </span>
                      </td>
                      <td className="rd-table-notes">
                        <div>{getNote(booking)}</div>
                        {issues.length > 0 && (
                          <ul className="rd-issues" aria-label={`Problems with ${booking.customerName}'s booking`}>
                            {issues.map((issue) => (
                              <li key={issue.text} className={`rd-issue rd-issue--${issue.level}`}>
                                <i
                                  className={`bi ${issue.level === "error" ? "bi-x-octagon-fill" : "bi-exclamation-triangle-fill"}`}
                                  aria-hidden="true"
                                ></i>
                                <span>{issue.text}</span>
                              </li>
                            ))}
                          </ul>
                        )}
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
                                disabled={Boolean(seatBlock)}
                                title={seatBlock || undefined}
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
                              disabled={Boolean(seatBlock)}
                              title={seatBlock || undefined}
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
                        {seatHint && (
                          <span className="rd-seat-note">
                            <i className="bi bi-lock-fill" aria-hidden="true"></i>
                            {seatHint}
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
            <i className={`bi ${reservationFilter === "issues" ? "bi-check2-circle" : "bi-inbox"}`}></i>
            <p>
              {reservationFilter === "history"
                ? "No reservation history yet"
                : reservationFilter === "issues"
                  ? "Nothing needs attention. Every active booking checks out."
                  : "No active reservations found"}
            </p>
          </div>
        )}
      </div>

      <Pagination {...pagination} />

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
