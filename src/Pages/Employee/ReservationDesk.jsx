// ReservationDesk.jsx
import { useMemo, useState } from "react";
import "../../styles/Employee/ReservationDesk.css";
import ReservationStats from "../../Elements/Employee/ReservationStats";
import ReservationQueue from "../../Elements/Employee/ReservationQueue";
import ReservationModal from "../../Elements/Employee/ReservationModal.jsx";
import PaymentCheckModal from "../../Elements/Employee/PaymentCheckModal.jsx";
import {
  RESERVATION_GRACE_MINUTES,
  describeReservationTime,
  getArrivalWindow,
  getAvailableReservationTables,
  getChosenTableError,
  getReservationValidationMessage,
  hasReservationConflict,
} from "../../utils/reservations";
import {
  getCustomerNameError,
  getPartySizeError,
  getReservationIssues,
  isBookingTable,
  isGuestPlaying,
} from "../../utils/reservationIssues";
import { isValidSmsNumber } from "../../utils/phone";
import { appendAuditLog } from "../../utils/audit";
import { useNotifications } from "../../Elements/Global/useNotifications";
import {
  createRemoteReservation,
  updateRemoteReservation,
} from "../../utils/reservationApi";
import { ENDED_SESSION_FIELDS, createTableCharge, describeEndedCharge, endedChargeToast } from "../../utils/tableCharges";

const getCurrentTimestamp = () => Date.now();
const todayStr = () => new Date().toLocaleDateString("en-CA");
const createId = () => Date.now() + Math.floor(Math.random() * 1000);
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
  setLogs,
}) {
  const { addNotification, queueAdminNotification, showToast } = useNotifications();
  // Problems are shown in the app, not in the browser's own alert box.
  const showError = (title, message) =>
    showToast({ tone: "error", icon: "bi-exclamation-octagon-fill", title, message });
  const focusBooking =
    focusReservationId === null ? null : reservations.find((booking) => String(booking.id) === String(focusReservationId)) || null;
  const focusNeedsCheck = focusBooking?.status === "pending" && focusBooking.source === "online";
  const [reservationFilter, setReservationFilter] = useState(() =>
    focusBooking && HISTORY_STATUSES.has(focusBooking.status) ? "history" : "all"
  );
  const [activeModal, setActiveModal] = useState(null);
  // The online booking whose GCash payment is being checked.
  const [paymentCheckTarget, setPaymentCheckTarget] = useState(() => (focusNeedsCheck ? focusBooking : null));
  const [paymentCheckBusy, setPaymentCheckBusy] = useState(false);
  const [walkInForm, setWalkInForm] = useState({ customerName: "", tableId: "" });
  const [reservationForm, setReservationForm] = useState({
    customerName: "",
    phone: "",
    partySize: 2,
    date: todayStr(),
    time: "",
    tableId: "",
  });
  const availableTables = useMemo(
    () => tables.filter((table) => table.status === "available"),
    [tables]
  );

  const reservationTables = useMemo(
    () =>
      getAvailableReservationTables({
        tables,
        reservations,
        date: reservationForm.date,
        time: reservationForm.time,
      }),
    [reservationForm.date, reservationForm.time, reservations, tables]
  );

  // The picked table must be free at that time: not occupied, reserved or under maintenance.
  const reservationTableError =
    activeModal === "reservation"
      ? getChosenTableError({
          tables,
          reservations,
          tableId: reservationForm.tableId,
          date: reservationForm.date,
          time: reservationForm.time,
        })
      : "";
  const chosenTableName =
    tables.find((table) => String(table.id) === String(reservationForm.tableId))?.name || "";

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

  const updateTable = (tableId, updates) => {
    setTables((prev) =>
      prev.map((table) =>
        table.id === tableId ? { ...table, ...updates } : table
      )
    );
  };

  const updateBookingTable = (booking, updates) => {
    setTables((prev) =>
      prev.map((table) =>
        isBookingTable(table, booking) ? { ...table, ...updates } : table
      )
    );
  };

const closeModal = () => setActiveModal(null);

  const handleWalkInSubmit = (e) => {
    e.preventDefault();
    const tableId = Number(walkInForm.tableId);
    if (!walkInForm.customerName.trim() || !tableId) return;
    const table = tables.find((entry) => entry.id === tableId);

    updateTable(tableId, {
      status: "occupied",
      customer: walkInForm.customerName.trim(),
      startTime: Date.now(),
    });

    addLog({
      action: "Accepted walk-in",
      detail: `${walkInForm.customerName.trim()} started on Table ${tableId}`,
      customer: { previous: null, current: { name: walkInForm.customerName.trim() } },
      table: { id: tableId, name: table?.name || `Table ${tableId}`, previousStatus: table?.status, currentStatus: "occupied" },
    });
    addNotification({ message: `Walk-in started at ${table?.name || `Table ${tableId}`}.` });

    setWalkInForm({ customerName: "", tableId: "" });
    closeModal();
  };

  const handleReservationSubmit = async (e) => {
    e.preventDefault();
    const tableId = Number(reservationForm.tableId);
    if (!reservationForm.customerName.trim() || !tableId) return;

    const nameError = getCustomerNameError(reservationForm.customerName);
    if (nameError) {
      showError("Check the customer name", nameError);
      return;
    }

    if (!isValidSmsNumber(reservationForm.phone)) {
      showError("Check the mobile number", "Please enter the customer's mobile number in 09XXXXXXXXX format.");
      return;
    }

    const partySizeError = getPartySizeError(reservationForm.partySize);
    if (partySizeError) {
      showError("Check the party size", partySizeError);
      return;
    }

    const reservationValidationMessage = getReservationValidationMessage(
      reservationForm.date,
      reservationForm.time
    );
    if (reservationValidationMessage) {
      showError("Check the date and time", reservationValidationMessage);
      return;
    }

    if (reservationTableError) {
      showError("Choose another table", reservationTableError);
      return;
    }

    const candidate = {
      tableId,
      date: reservationForm.date,
      time: reservationForm.time,
    };

    if (reservationForm.date && reservationForm.time && hasReservationConflict(reservations, candidate)) {
      const tableName = tables.find((entry) => entry.id === tableId)?.name || `Table ${tableId}`;
      showError("Table already booked", `${tableName} is already reserved for ${reservationForm.date} at ${reservationForm.time}.`);
      return;
    }

    const table = tables.find((entry) => entry.id === tableId);
    const booking = {
      id: createId(),
      customerName: reservationForm.customerName.trim(),
      phone: reservationForm.phone.trim(),
      partySize: Number(reservationForm.partySize),
      date: reservationForm.date,
      time: reservationForm.time,
      tableId,
      tableName: table?.name || `Table ${tableId}`,
      // Booked in person at the front desk, so staff confirm it on the spot: no
      // admin approval, which would leave a lone employee unable to serve anyone.
      status: "approved",
      source: "new",
    };

    try {
      const savedBooking = await createRemoteReservation(booking);
      setReservations((prev) => [savedBooking, ...prev]);

      addLog({
        action: "Created reservation",
        detail: `${savedBooking.customerName} was booked at the front desk for ${savedBooking.tableName} on ${savedBooking.date} ${savedBooking.time || ""}`.trim(),
        customer: {
          previous: null,
          current: {
            name: savedBooking.customerName,
            phone: savedBooking.phone,
            partySize: savedBooking.partySize,
          },
        },
        reservation: {
          id: savedBooking.id,
          previousStatus: null,
          currentStatus: "approved",
          date: savedBooking.date,
          time: savedBooking.time,
        },
        table: { id: savedBooking.tableId, name: savedBooking.tableName, previousStatus: table?.status, currentStatus: table?.status },
      });
      addNotification({
        message: `${savedBooking.customerName} is booked for ${savedBooking.tableName} on ${savedBooking.date} at ${savedBooking.time}.`,
      });

      setReservationForm({
        customerName: "",
        phone: "",
        partySize: 2,
        date: todayStr(),
        time: "",
        tableId: "",
      });

      closeModal();
    } catch (error) {
      showError("Reservation not saved", error.message || "Unable to save the reservation.");
    }
  };

  // The server is asked first, so the desk never shows a change it refused.
  const saveBookingStatus = async (booking, nextStatus) => {
    const nextBooking = { ...booking, status: nextStatus };

    try {
      await updateRemoteReservation(nextBooking);
    } catch (error) {
      showError("Reservation not updated", error.message || "Unable to update this reservation.");
      return false;
    }

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
    addNotification({ message: `${booking.customerName}'s payment was verified. ${booking.tableName} is reserved.` });
    // The admin used to be the only one approving, so they are told it happened.
    queueAdminNotification({
      type: "reservation-approved",
      message: `Front desk approved ${booking.customerName}'s online reservation for ${booking.tableName} on ${booking.date} after finding the GCash payment.`,
      data: { reservationId: booking.id, tableId: booking.tableId },
    });
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
    addLog({
      action: "Rejected online reservation",
      detail: `${booking.customerName}'s booking for ${booking.tableName} on ${booking.date}, ${describeReservationTime(booking)}, was rejected because the GCash payment could not be found.`,
      severity: "reject",
      ...bookingAudit(booking, "rejected"),
      table: { id: booking.tableId, name: booking.tableName, previousStatus: table?.status, currentStatus: table?.status },
    });
    addNotification({ message: `${booking.customerName}'s reservation was rejected. ${booking.tableName} is free for that time again.` });
    queueAdminNotification({
      type: "reservation-rejected",
      message: `Front desk rejected ${booking.customerName}'s online reservation for ${booking.tableName} on ${booking.date}: the GCash payment could not be found.`,
      data: { reservationId: booking.id, tableId: booking.tableId },
    });
    setPaymentCheckTarget(null);
  };

  const handleBookingStatus = async (bookingId, nextStatus) => {
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

    if (!(await saveBookingStatus(booking, nextStatus))) return;

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
        // An online guest paid for the hours they picked, so the timer runs that
        // long instead of the table's default session.
        ...(booking.source === "online" && Number(booking.durationMinutes) > 0
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
          addNotification({ message: describeEndedCharge(charge) });
          showToast(endedChargeToast(charge));
        }
      }
      addLog({
        action: nextStatus === "cancelled" ? "Cancelled booking" : "Completed booking",
        detail: `${booking.customerName} ${nextStatus} for ${booking.tableName}`,
        customer: {
          previous: { name: booking.customerName, phone: booking.phone },
          current: nextStatus === "completed" ? { name: booking.customerName, phone: booking.phone } : null,
        },
        reservation: { id: booking.id, previousStatus: booking.status, currentStatus: nextStatus, date: booking.date, time: booking.time },
        table: { id: booking.tableId, name: booking.tableName, previousStatus: currentTable?.status, currentStatus: currentTable?.status === "occupied" ? "available" : currentTable?.status },
      });
      addNotification({ message: `${booking.customerName} booking was ${nextStatus}.` });

      if (nextStatus === "cancelled") {
        queueAdminNotification({
          type: "reservation-cancellation",
          message: `Cancellation request: ${booking.customerName}'s booking for ${booking.tableName} on ${booking.date} at ${booking.time}.`,
          data: { reservationId: booking.id, tableId: booking.tableId },
        });
      }
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
            onClick={() => setActiveModal("reservation")}
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
        highlightId={focusBooking ? focusBooking.id : null}
      />

      {paymentCheckTarget && (
        <PaymentCheckModal
          key={paymentCheckTarget.id}
          booking={paymentCheckTarget}
          busy={paymentCheckBusy}
          onApprove={approveOnlineBooking}
          onReject={rejectOnlineBooking}
          onClose={() => setPaymentCheckTarget(null)}
        />
      )}

      {activeModal && (
        <ReservationModal
          mode={activeModal}
          walkInForm={walkInForm}
          setWalkInForm={setWalkInForm}
          reservationForm={reservationForm}
          setReservationForm={setReservationForm}
          availableTables={availableTables}
          reservationTables={reservationTables}
          tableError={reservationTableError}
          chosenTableName={chosenTableName}
          onClose={closeModal}
          onWalkInSubmit={handleWalkInSubmit}
          onReservationSubmit={handleReservationSubmit}
        />
      )}
    </div>
  );
}
