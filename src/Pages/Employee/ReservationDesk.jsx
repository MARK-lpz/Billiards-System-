// ReservationDesk.jsx
import { useMemo, useState } from "react";
import "../../styles/Employee/ReservationDesk.css";
import ReservationStats from "../../Elements/Employee/ReservationStats";
import ReservationQueue from "../../Elements/Employee/ReservationQueue";
import ReservationModal from "../../Elements/Employee/ReservationModal.jsx";
import {
  getAvailableReservationTables,
  getReservationValidationMessage,
  hasReservationConflict,
} from "../../utils/reservations";
import { isValidSmsNumber } from "../../utils/phone";
import { appendAuditLog } from "../../utils/audit";
import { useNotifications } from "../../Elements/Global/useNotifications";

const todayStr = () => new Date().toLocaleDateString("en-CA");
const createId = () => Date.now() + Math.floor(Math.random() * 1000);

export default function ReservationDesk({
  tables = [],
  setTables,
  reservations = [],
  setReservations,
  setLogs,
}) {
  const { addNotification } = useNotifications();
  const [reservationFilter, setReservationFilter] = useState("all");
  const [activeModal, setActiveModal] = useState(null);
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
    if (reservationFilter === "all") return reservations;
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

  const handleReservationSubmit = (e) => {
    e.preventDefault();
    const tableId = Number(reservationForm.tableId);
    if (!reservationForm.customerName.trim() || !tableId) return;

    if (reservationForm.phone.trim() && !isValidSmsNumber(reservationForm.phone)) {
      window.alert("Please enter a valid SMS number in 09XXXXXXXXX format.");
      return;
    }

    const reservationValidationMessage = getReservationValidationMessage(
      reservationForm.date,
      reservationForm.time
    );
    if (reservationValidationMessage) {
      window.alert(reservationValidationMessage);
      return;
    }

    const candidate = {
      tableId,
      date: reservationForm.date,
      time: reservationForm.time,
    };

    if (reservationForm.date && reservationForm.time && hasReservationConflict(reservations, candidate)) {
      const tableName = tables.find((entry) => entry.id === tableId)?.name || `Table ${tableId}`;
      window.alert(`${tableName} is already reserved for ${reservationForm.date} at ${reservationForm.time}.`);
      return;
    }

    const table = tables.find((entry) => entry.id === tableId);
    const booking = {
      id: createId(),
      customerName: reservationForm.customerName.trim(),
      phone: reservationForm.phone.trim(),
      partySize: Number(reservationForm.partySize) || 1,
      date: reservationForm.date,
      time: reservationForm.time,
      tableId,
      tableName: table?.name || `Table ${tableId}`,
      status: "pending",
      source: "new",
    };

    setReservations((prev) => [booking, ...prev]);

    addLog({
      action: "Created reservation",
      detail: `${booking.customerName} submitted a reservation request for ${booking.tableName} on ${booking.date} ${booking.time || ""}`.trim(),
      customer: {
        previous: null,
        current: {
          name: booking.customerName,
          phone: booking.phone,
          partySize: booking.partySize,
        },
      },
      reservation: {
        id: booking.id,
        previousStatus: null,
        currentStatus: "pending",
        date: booking.date,
        time: booking.time,
      },
      table: { id: booking.tableId, name: booking.tableName, previousStatus: table?.status, currentStatus: table?.status },
    });
    addNotification({
      message: `${booking.customerName} reservation request saved for ${booking.tableName} on ${booking.date} at ${booking.time}.`,
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
  };

  const handleBookingStatus = (bookingId, nextStatus) => {
    const booking = reservations.find((entry) => entry.id === bookingId);
    if (!booking) return;

    setReservations((prev) =>
      prev.map((entry) =>
        entry.id === bookingId ? { ...entry, status: nextStatus } : entry
      )
    );

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

    if (nextStatus === "seated") {
      updateTable(booking.tableId, {
        status: "occupied",
        customer: booking.customerName,
        startTime: Date.now(),
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
      const currentTable = tables.find((table) => table.id === booking.tableId);
      if (currentTable?.status === "occupied" && currentTable.customer === booking.customerName) {
        updateTable(booking.tableId, {
          status: "available",
          customer: "",
          startTime: null,
        });
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
            className="rd-secondary-btn"
            onClick={() => setActiveModal("walkin")}
          >
            <i className="bi bi-person-walking me-2"></i>
            Accept Walk-In
          </button>

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

      <ReservationQueue
        reservations={visibleReservations}
        reservationFilter={reservationFilter}
        setReservationFilter={setReservationFilter}
        onBookingStatus={handleBookingStatus}
      />

      {activeModal && (
        <ReservationModal
          mode={activeModal}
          walkInForm={walkInForm}
          setWalkInForm={setWalkInForm}
          reservationForm={reservationForm}
          setReservationForm={setReservationForm}
          availableTables={availableTables}
          reservationTables={reservationTables}
          onClose={closeModal}
          onWalkInSubmit={handleWalkInSubmit}
          onReservationSubmit={handleReservationSubmit}
        />
      )}
    </div>
  );
}
