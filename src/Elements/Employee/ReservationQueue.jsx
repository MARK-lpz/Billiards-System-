// ReservationQueue.jsx
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "../Global/ConfirmDialog";
import Pagination from "../Global/Pagination";
import usePagination from "../Global/usePagination";
import { PAGE_SIZE } from "../../utils/pagination";
import { describeReservationTime, getArrivalWindow, hasReservationEnded } from "../../utils/reservations";
import { getReservationIssues, getReservationMode } from "../../utils/reservationIssues";
import PaymentStatusChip from "../Global/PaymentStatusChip";
import RefundChoice from "../Global/RefundChoice";
import { describeRefund, findReservationPayment, formatPayer, formatPeso, needsRefundChoice } from "../../utils/onlinePayments";

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
  // Approves or rejects a pending walk-in booking: (booking, "approved" | "rejected").
  onDecide,
  // The website's GCash payments (an online booking's), and sending one back: (payment, booking).
  payments = [],
  onRefund,
  // A booking opened from the bell: the list opens at its page, marked and in view.
  highlightId = null,
}) {
  // Cancelling or rejecting cannot be undone, so the click only arms the confirmation.
  const [cancelTarget, setCancelTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  // For a cancelled booking whose payment was accepted: "refund" or "keep".
  const [refundChoice, setRefundChoice] = useState("");
  const paymentOf = (booking) => (booking.source === "online" ? findReservationPayment(payments, booking.id) : null);
  const openCancel = (booking) => {
    setRefundChoice("");
    setCancelTarget(booking);
  };
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
  const confirmCancel = (booking, choice) => {
    const asked = needsRefundChoice(paymentOf(booking));
    onBookingStatus(booking.id, "cancelled", asked ? { refundPayment: choice === "refund" } : {});
    setCancelTarget(null);
  };
  const confirmReject = (booking) => {
    onDecide(booking, "rejected");
    setRejectTarget(null);
  };

  // What is wrong with each booking right now, judged on the same clock.
  // A website payment waiting to be sent back needs the desk too, whatever its booking's state.
  const checkBooking = (booking) => {
    const checked = getReservationIssues({ booking, tables, reservations: allReservations, now: new Date(now) });
    const payment = paymentOf(booking);
    if (payment?.status !== "refund_due") return checked;
    return {
      ...checked,
      issues: [
        ...checked.issues,
        { level: "warning", text: `Send ${formatPeso(payment.amount)} back to ${formatPayer(payment)} by GCash, then mark it sent back.` },
      ],
    };
  };
  const needsAttention = allReservations.filter((booking) => checkBooking(booking).issues.length > 0);
  const [sortOrder, setSortOrder] = useState("newest");
  const rows = sortBookings(reservationFilter === "issues" ? needsAttention : reservations, sortOrder);
  const isHighlighted = (booking) => highlightId !== null && String(booking.id) === String(highlightId);
  const highlightIndex = rows.findIndex(isHighlighted);
  const pagination = usePagination(rows, PAGE_SIZE, highlightIndex >= 0 ? Math.floor(highlightIndex / PAGE_SIZE) + 1 : 1);
  const highlightedRow = useRef(null);

  useEffect(() => {
    highlightedRow.current?.scrollIntoView?.({ block: "center" });
  }, [highlightId]);

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
        : "Booked at the hall. Approve it to hold the table."
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
                  const tooLate = booking.status === "pending" && hasReservationEnded(booking, new Date(now));
                  const payment = paymentOf(booking);
                  const worst = issues.some((issue) => issue.level === "error")
                    ? "error"
                    : issues.length
                      ? "warning"
                      : "";

                  return (
                    <tr
                      key={booking.id}
                      ref={isHighlighted(booking) ? highlightedRow : undefined}
                      className={[worst ? `rd-row--${worst}` : "", isHighlighted(booking) ? "rd-row--focus" : ""].filter(Boolean).join(" ") || undefined}
                    >
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
                        {payment && (
                          <div className="rd-pay-status">
                            <PaymentStatusChip payment={payment} short />
                          </div>
                        )}
                      </td>
                      <td className="rd-table-notes">
                        <div>{getNote(booking)}</div>
                        {payment?.status === "refunded" && <div className="rd-pay-note">{describeRefund(payment)}</div>}
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
                          {payment?.status === "refund_due" && (
                            <button type="button" className="rd-primary-btn" onClick={() => onRefund(payment, booking)}>
                              <i className="bi bi-arrow-counterclockwise"></i>
                              Send Back
                            </button>
                          )}

                          {/* The desk approves both kinds: an online booking once its
                              GCash payment is found, a walk-in one on the spot. */}
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
                            <>
                              {/* Too late to hold a table once its time is over. */}
                              <button
                                type="button"
                                className="rd-primary-btn"
                                onClick={() => onDecide(booking, "approved")}
                                disabled={tooLate}
                                title={tooLate ? "Its time has passed. Reject it instead." : undefined}
                              >
                                <i className="bi bi-check2-circle"></i>
                                Approve
                              </button>
                              <button
                                type="button"
                                className="rd-secondary-btn"
                                onClick={() => setRejectTarget(booking)}
                              >
                                Reject
                              </button>
                            </>
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
                              onClick={() => openCancel(booking)}
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
          confirmDisabled={needsRefundChoice(paymentOf(cancelTarget)) && !refundChoice}
          onConfirm={() => confirmCancel(cancelTarget, refundChoice)}
          onClose={() => setCancelTarget(null)}
        >
          <RefundChoice payment={paymentOf(cancelTarget)} value={refundChoice} onChange={setRefundChoice} />
        </ConfirmDialog>
      )}

      {rejectTarget && (
        <ConfirmDialog
          title="Reject this reservation?"
          message={
            <>
              <strong>{rejectTarget.customerName}</strong>&apos;s request for {rejectTarget.tableName} on{" "}
              {rejectTarget.date}
              {rejectTarget.time ? ` at ${rejectTarget.time}` : ""} will be turned down and the slot freed for
              someone else.
            </>
          }
          detail="This cannot be undone. The booking moves to history and has to be created again if the customer still wants it."
          confirmLabel="Yes, Reject Reservation"
          cancelLabel="Keep Reservation"
          onConfirm={() => confirmReject(rejectTarget)}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </section>
  );
}
