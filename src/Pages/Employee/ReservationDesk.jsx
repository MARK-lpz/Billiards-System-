// ReservationDesk.jsx
import { useMemo, useState } from "react";
import "../../styles/Employee/ReservationDesk.css";
import ReservationStats from "../../Elements/Employee/ReservationStats";
import ReservationQueue from "../../Elements/Employee/ReservationQueue";
import ReceiptModal from "../../Elements/Admin/ReceiptModal";
import PaymentCheckModal from "../../Elements/Employee/PaymentCheckModal.jsx";
import {
  RESERVATION_GRACE_MINUTES,
  describeReservationTime,
  getArrivalWindow,
  hasReservationEnded,
} from "../../utils/reservations";
import {
  getReservationIssues,
  isBookingTable,
  isGuestPlaying,
} from "../../utils/reservationIssues";
import { appendAuditLog } from "../../utils/audit";
import { describeRefundExtra } from "../../utils/bookingPayments";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { updateRemoteReservation } from "../../utils/reservationApi";
import { ENDED_SESSION_FIELDS, createTableCharge, endedChargeToast } from "../../utils/tableCharges";
import RefundModal from "../../Elements/Global/RefundModal";
import StaffReservationModal from "../../Elements/Global/StaffReservationModal";
import useBookingPayment from "../../Elements/Global/useBookingPayment";
import { useOnlinePayments } from "../../Elements/Global/useOnlinePayments";
import { describeRefund, findReservationPayment, formatPayer, formatPeso } from "../../utils/onlinePayments";

const getCurrentTimestamp = () => Date.now();
const HISTORY_STATUSES = new Set(["completed", "cancelled", "rejected", "expired"]);

// `focusReservationId`: a booking opened from the employee's bell. A pending
// online one opens its payment check; any other is shown, marked, in the list.
export default function ReservationDesk({
  focusReservationId = null,
  tables = [],
  setTables,
  reservations = [],
  setReservations,
  tableCharges = [],
  setTableCharges,
  events = [],
  transactions = [],
  setTransactions,
  setLogs,
}) {
  const { addNotification, showToast } = useNotifications();
  // The website's GCash payments: each online booking's, with its receipt.
  const { payments, applySaved: applySavedPayment, refresh: refreshPayments } = useOnlinePayments();
  const { createPaidBooking, recordBookingRefund } = useBookingPayment({
    staff: "Employee",
    setReservations,
    setTransactions,
    setLogs,
  });
  // The payment being sent back ({ payment, booking }).
  const [refundTarget, setRefundTarget] = useState(null);
  // Problems are shown in the app, not in the browser's own alert box.
  const showError = (title, message) =>
    showToast({ tone: "error", icon: "bi-exclamation-octagon-fill", title, message });
  const focusBooking =
    focusReservationId === null ? null : reservations.find((booking) => String(booking.id) === String(focusReservationId)) || null;
  const focusNeedsCheck = focusBooking?.status === "pending" && focusBooking.source === "online";
  const [reservationFilter, setReservationFilter] = useState(() =>
    focusBooking && HISTORY_STATUSES.has(focusBooking.status) ? "history" : "all"
  );
  const [bookingOpen, setBookingOpen] = useState(false);
  // A new booking's receipt, shown right after it is paid.
  const [receipt, setReceipt] = useState(null);
  // The online booking whose GCash payment is being checked.
  const [paymentCheckTarget, setPaymentCheckTarget] = useState(() => (focusNeedsCheck ? focusBooking : null));
  const [paymentCheckBusy, setPaymentCheckBusy] = useState(false);
  const availableTables = useMemo(
    () => tables.filter((table) => table.status === "available"),
    [tables]
  );

  const summary = useMemo(
    () => ({
      walkIns: tables.filter((table) => table.status === "occupied").length,
      reserved: reservations.filter((booking) =>
        ["approved", "reserved", "arrived"].includes(booking.status)
      ).length,
      assigned: reservations.filter((booking) => booking.status === "seated").length,
      openTables: availableTables.length,
    }),
    [availableTables.length, reservations, tables]
  );

  const visibleReservations = useMemo(() => {
    if (reservationFilter === "all") {
      return reservations.filter((booking) => !HISTORY_STATUSES.has(booking.status));
    }
    if (reservationFilter === "approved") {
      return reservations.filter((booking) => ["approved", "reserved"].includes(booking.status));
    }
    if (reservationFilter === "history") {
      return reservations.filter((booking) => HISTORY_STATUSES.has(booking.status));
    }
    // ReservationQueue narrows this to the bookings with a problem.
    if (reservationFilter === "issues") {
      return reservations.filter((booking) => !HISTORY_STATUSES.has(booking.status));
    }
    return reservations.filter((booking) => booking.status === reservationFilter);
  }, [reservationFilter, reservations]);

  const addLog = (payload) => {
    appendAuditLog(setLogs, {
      type: "reservation",
      staff: "Employee",
      entity: "reservation",
      severity: payload.severity || "info",
      ...payload,
    });
  };

  const updateBookingTable = (booking, updates) => {
    setTables((prev) =>
      prev.map((table) =>
        isBookingTable(table, booking) ? { ...table, ...updates } : table
      )
    );
  };

  // Paid in the booking window; what goes wrong stays there.
  const createBooking = async (paid) => {
    const sale = await createPaidBooking(paid);
    setBookingOpen(false);
    setReceipt(sale);
  };

  // The server is asked first, so the desk never shows a change it refused.
  // `extra` goes with it (whether to give a cancelled booking's payment back).
  const saveBookingStatus = async (booking, nextStatus, extra = {}) => {
    const nextBooking = { ...booking, status: nextStatus };

    try {
      await updateRemoteReservation(nextBooking, extra);
    } catch (error) {
      showError("Reservation not updated", error.message || "Unable to update this reservation.");
      return false;
    }
    // A website booking's payment moved with it on the server (accepted, or to send back).
    if (booking.source === "online") refreshPayments();

    setReservations((prev) =>
      prev.map((entry) =>
        entry.id === booking.id ? nextBooking : entry
      )
    );
    return true;
  };

  const bookingAudit = (booking, nextStatus) => ({
    customer: {
      previous: { name: booking.customerName, phone: booking.phone },
      current: nextStatus === "rejected" ? null : { name: booking.customerName, phone: booking.phone },
    },
    reservation: { id: booking.id, previousStatus: booking.status, currentStatus: nextStatus, date: booking.date, time: booking.time },
  });

  // Uses the latest copy of the booking, so a reservation the admin already
  // decided on while this window was open is not overwritten.
  const getPendingBooking = (booking) => {
    const current = reservations.find((entry) => entry.id === booking.id);
    if (current?.status === "pending") return current;

    showError("Already handled", "This reservation was already handled, so nothing was changed.");
    setPaymentCheckTarget(null);
    return null;
  };

  const approveOnlineBooking = async (checkedBooking, closingDigits) => {
    const booking = getPendingBooking(checkedBooking);
    if (!booking) return;

    setPaymentCheckBusy(true);
    const saved = await saveBookingStatus(booking, "approved");
    setPaymentCheckBusy(false);
    if (!saved) return;

    const table = tables.find((entry) => isBookingTable(entry, booking));
    const paymentNote = closingDigits
      ? `GCash payment found (reference ending ${closingDigits})`
      : "Payment confirmed without a GCash reference";

    addLog({
      action: "Approved online reservation",
      detail: `${booking.customerName}'s booking for ${booking.tableName} on ${booking.date}, ${describeReservationTime(booking)}, was approved. ${paymentNote}.`,
      ...bookingAudit(booking, "approved"),
      table: { id: booking.tableId, name: booking.tableName, previousStatus: table?.status, currentStatus: "reserved" },
    });
    // The admin finds approvals, rejections and cancellations in the Audit Trail, not the bell.
    addNotification({ message: `${booking.customerName}'s payment was verified. ${booking.tableName} is reserved.` });
    setPaymentCheckTarget(null);
  };

  const rejectOnlineBooking = async (checkedBooking) => {
    const booking = getPendingBooking(checkedBooking);
    if (!booking) return;

    setPaymentCheckBusy(true);
    const saved = await saveBookingStatus(booking, "rejected");
    setPaymentCheckBusy(false);
    if (!saved) return;

    const table = tables.find((entry) => isBookingTable(entry, booking));
    const payment = findReservationPayment(payments, booking.id);
    addLog({
      action: "Rejected online reservation",
      detail: `${booking.customerName}'s booking for ${booking.tableName} on ${booking.date}, ${describeReservationTime(booking)}, was rejected because the GCash payment could not be found.${
        payment ? ` Its ${formatPeso(payment.amount)} is listed to send back to ${formatPayer(payment)}.` : ""
      }`,
      severity: "reject",
      ...bookingAudit(booking, "rejected"),
      table: { id: booking.tableId, name: booking.tableName, previousStatus: table?.status, currentStatus: table?.status },
    });
    addNotification({ message: `${booking.customerName}'s reservation was rejected. ${booking.tableName} is free for that time again.` });
    setPaymentCheckTarget(null);
  };

  // A website payment staff sent back (the booking was turned down or cancelled).
  const finishRefund = (saved) => {
    const booking = refundTarget?.booking;
    applySavedPayment(saved);
    addLog({
      action: "Sent back online payment",
      detail: `${saved.customerName}'s ${formatPeso(saved.amount)} GCash payment${
        booking ? ` for ${booking.tableName} on ${booking.date}` : ""
      } went back to ${formatPayer(saved)}. ${describeRefund(saved)}`,
      ...(booking ? bookingAudit(booking, booking.status) : {}),
    });
    addNotification({ message: `${saved.customerName}'s ${formatPeso(saved.amount)} is marked as sent back.` });
    setRefundTarget(null);
  };

  // A pending booking that was not made online (no GCash to check): the desk
  // approves or rejects it on the spot, as the admin can.
  const decideWalkInBooking = async (listedBooking, decision) => {
    const booking = getPendingBooking(listedBooking);
    if (!booking) return;
    // The button is off once the time is over, but the page may have sat open past it.
    if (decision === "approved" && hasReservationEnded(booking)) {
      showError("Too late to approve", `${booking.customerName}'s time (${describeReservationTime(booking)}) has already ended. Reject it instead.`);
      return;
    }

    if (!(await saveBookingStatus(booking, decision))) return;

    const approved = decision === "approved";
    const table = tables.find((entry) => isBookingTable(entry, booking));
    addLog({
      action: approved ? "Approved reservation" : "Rejected reservation",
      detail: `${booking.customerName}'s walk-in booking for ${booking.tableName} on ${booking.date}, ${describeReservationTime(booking)}, was ${decision} at the front desk.`,
      ...(approved ? {} : { severity: "reject" }),
      ...bookingAudit(booking, decision),
      table: { id: booking.tableId, name: booking.tableName, previousStatus: table?.status, currentStatus: approved ? "reserved" : table?.status },
    });
    addNotification({
      message: approved
        ? `${booking.customerName}'s reservation was approved. ${booking.tableName} is reserved.`
        : `${booking.customerName}'s reservation was rejected. ${booking.tableName} is free for that time again.`,
    });
  };

  // `extra`: for a cancelled booking that was paid for, whether to give the
  // payment back (toRefundExtra in bookingPayments.js).
  const handleBookingStatus = async (bookingId, nextStatus, extra = {}) => {
    const booking = reservations.find((entry) => entry.id === bookingId);
    if (!booking) return;

    // If the guest was already checked in from the table card, only the booking is updated.
    const bookingTable = tables.find((entry) => isBookingTable(entry, booking));
    const alreadyPlaying = nextStatus === "seated" && isGuestPlaying(bookingTable, booking);
    // Checked again on click: the buttons are off when blocked, but the page may
    // have sat open while the table or the clock moved on.
    const seatingBlock =
      nextStatus === "seated" && !alreadyPlaying
        ? getReservationIssues({ booking, tables, reservations, now: new Date() }).seatBlock
        : "";
    if (seatingBlock) {
      showError(`Can't seat ${booking.customerName} yet`, seatingBlock);
      return;
    }

    // The button is off outside the window, but the page may have sat open past it.
    if (nextStatus === "arrived") {
      const arrival = getArrivalWindow(booking);
      if (!arrival.open) {
        showError(
          "Not in the check-in window",
          `${booking.customerName} can be marked arrived only from the reserved time until ${RESERVATION_GRACE_MINUTES} minutes after it. ${arrival.note}.`
        );
        return;
      }
    }

    if (!(await saveBookingStatus(booking, nextStatus, extra))) return;
    recordBookingRefund(booking, extra);

    if (nextStatus === "arrived") {
      addLog({
        action: "Checked reservation",
        detail: `${booking.customerName} has arrived for ${booking.tableName}`,
        customer: { previous: { name: booking.customerName, phone: booking.phone }, current: { name: booking.customerName, phone: booking.phone } },
        reservation: { id: booking.id, previousStatus: booking.status, currentStatus: "arrived", date: booking.date, time: booking.time },
        table: { id: booking.tableId, name: booking.tableName, previousStatus: "reserved", currentStatus: "reserved" },
      });
      addNotification({ message: `${booking.customerName} arrived for ${booking.tableName}.` });
      return;
    }

    if (nextStatus === "seated" && alreadyPlaying) {
      addNotification({ message: `${booking.customerName} is already playing at ${booking.tableName}.` });
      return;
    }

    if (nextStatus === "seated") {
      updateBookingTable(booking, {
        status: "occupied",
        customer: booking.customerName,
        startTime: Date.now(),
        // A guest paid for the hours they picked, so the timer runs that long
        // instead of the table's default session.
        ...(Number(booking.durationMinutes) > 0
          ? { durationMinutes: Number(booking.durationMinutes), addedMinutes: 0 }
          : {}),
      });
      addLog({
        action: "Assigned reserved table",
        detail: `${booking.customerName} seated at ${booking.tableName}`,
        customer: { previous: { name: booking.customerName, phone: booking.phone }, current: { name: booking.customerName, phone: booking.phone } },
        reservation: { id: booking.id, previousStatus: booking.status, currentStatus: "seated", date: booking.date, time: booking.time },
        table: { id: booking.tableId, name: booking.tableName, previousStatus: "reserved", currentStatus: "occupied" },
      });
      addNotification({ message: `${booking.customerName} was seated at ${booking.tableName}.` });
      return;
    }

    if (nextStatus === "cancelled" || nextStatus === "completed") {
      const currentTable = tables.find((table) => isBookingTable(table, booking));
      if (currentTable?.status === "occupied" && currentTable.customer === booking.customerName) {
        // Completing a seated booking ends its table session, so its bill goes to Sales / POS.
        const charge =
          nextStatus === "completed"
            ? createTableCharge({ table: currentTable, reservations, tableCharges, endedBy: "Employee", now: getCurrentTimestamp() })
            : null;
        updateBookingTable(booking, ENDED_SESSION_FIELDS);
        if (charge) {
          setTableCharges?.((prev) => [charge, ...prev]);
          showToast(endedChargeToast(charge));
        }
      }
      addLog({
        action: nextStatus === "cancelled" ? "Cancelled booking" : "Completed booking",
        detail: `${booking.customerName} ${nextStatus} for ${booking.tableName}.${describeRefundExtra(booking, extra)}`,
        customer: {
          previous: { name: booking.customerName, phone: booking.phone },
          current: nextStatus === "completed" ? { name: booking.customerName, phone: booking.phone } : null,
        },
        reservation: { id: booking.id, previousStatus: booking.status, currentStatus: nextStatus, date: booking.date, time: booking.time },
        table: { id: booking.tableId, name: booking.tableName, previousStatus: currentTable?.status, currentStatus: currentTable?.status === "occupied" ? "available" : currentTable?.status },
      });
      addNotification({ message: `${booking.customerName} booking was ${nextStatus}.` });
    }
  };

  return (
    <div className="rd-page">
      <div className="rd-header">
        <div>
          <h1 className="rd-title">Walk-In & Reservation Desk</h1>
          <p className="rd-subtitle">
            Handle front desk walk-ins, check reservations, assign tables, and update booking status.
          </p>
        </div>

        <div className="rd-top-actions">
          <button
            type="button"
            className="rd-primary-btn"
            onClick={() => setBookingOpen(true)}
          >
            <i className="bi bi-calendar-plus me-2"></i>
            New Reservation
          </button>
        </div>
      </div>

      <ReservationStats summary={summary} />

      {focusReservationId !== null && !focusBooking && (
        <p className="rd-focus-missing" role="status">
          <i className="bi bi-info-circle" aria-hidden="true"></i>
          That online reservation is no longer in the list. It may have been removed; the latest bookings are below.
        </p>
      )}

      <ReservationQueue
        reservations={visibleReservations}
        allReservations={reservations}
        tables={tables}
        reservationFilter={reservationFilter}
        setReservationFilter={setReservationFilter}
        onBookingStatus={handleBookingStatus}
        onCheckPayment={setPaymentCheckTarget}
        onDecide={decideWalkInBooking}
        payments={payments}
        onRefund={(payment, booking) => setRefundTarget({ payment, booking })}
        highlightId={focusBooking ? focusBooking.id : null}
      />

      {paymentCheckTarget && (
        <PaymentCheckModal
          key={paymentCheckTarget.id}
          booking={paymentCheckTarget}
          payment={findReservationPayment(payments, paymentCheckTarget.id)}
          busy={paymentCheckBusy}
          onApprove={approveOnlineBooking}
          onReject={rejectOnlineBooking}
          onClose={() => setPaymentCheckTarget(null)}
        />
      )}

      {refundTarget && (
        <RefundModal
          key={refundTarget.payment.id}
          payment={refundTarget.payment}
          forWhat={`${refundTarget.booking.tableName}, ${refundTarget.booking.date} (${describeReservationTime(refundTarget.booking)})`}
          onDone={finishRefund}
          onClose={() => setRefundTarget(null)}
        />
      )}

      {bookingOpen && (
        <StaffReservationModal
          tables={tables}
          reservations={reservations}
          events={events}
          transactions={transactions}
          onCreate={createBooking}
          onClose={() => setBookingOpen(false)}
        />
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
