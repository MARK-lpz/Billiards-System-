// ReservationDesk.jsx
import { useEffect, useMemo, useState } from "react";
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
import {
  createRemoteReservation,
  updateRemoteReservation,
} from "../../utils/reservationApi";

const todayStr = () => new Date().toLocaleDateString("en-CA");
const createId = () => Date.now() + Math.floor(Math.random() * 1000);
const HISTORY_STATUSES = new Set(["completed", "cancelled", "rejected", "expired"]);

const normalizeTableName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getTableNumber = (name) => {
  const match = normalizeTableName(name).match(/table\s*(\d+)$/i);
  return match ? Number(match[1]) : null;
};

const isBookingTable = (table, booking) =>
  String(table.id) === String(booking.tableId ?? booking.table) ||
  normalizeTableName(table.name) === normalizeTableName(booking.tableName) ||
  (getTableNumber(table.name) !== null &&
    getTableNumber(table.name) === getTableNumber(booking.tableName));

export default function ReservationDesk({
  tables = [],
  setTables,
  reservations = [],
  setReservations,
  setLogs,
}) {
  const { addNotification, queueAdminNotification } = useNotifications();
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
    if (reservationFilter === "all") {
      return reservations.filter((booking) => !HISTORY_STATUSES.has(booking.status));
    }
    if (reservationFilter === "approved") {
      return reservations.filter((booking) => ["approved", "reserved"].includes(booking.status));
    }
    if (reservationFilter === "history") {
      return reservations.filter((booking) => HISTORY_STATUSES.has(booking.status));
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

  useEffect(() => {
    setTables((previousTables) => {
      let changed = false;
      const nextTables = previousTables.map((table) => {
        const booking = reservations.find(
          (entry) =>
            ["approved", "reserved", "arrived"].includes(entry.status) &&
            isBookingTable(table, entry)
        );

        if (!booking || !["available", "reserved"].includes(table.status)) {
          return table;
        }

        const nextTable = {
          ...table,
          status: "reserved",
          customer: booking.customerName,
          reservationDate: booking.date,
          reservationTime: booking.time,
        };

        if (JSON.stringify(nextTable) !== JSON.stringify(table)) changed = true;
        return nextTable;
      });

      return changed ? nextTables : previousTables;
    });
  }, [reservations, setTables]);

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

    try {
      const savedBooking = await createRemoteReservation(booking);
      setReservations((prev) => [savedBooking, ...prev]);

      addLog({
        action: "Created reservation",
        detail: `${savedBooking.customerName} submitted a reservation request for ${savedBooking.tableName} on ${savedBooking.date} ${savedBooking.time || ""}`.trim(),
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
          currentStatus: "pending",
          date: savedBooking.date,
          time: savedBooking.time,
        },
        table: { id: savedBooking.tableId, name: savedBooking.tableName, previousStatus: table?.status, currentStatus: table?.status },
      });
      addNotification({
        message: `${savedBooking.customerName} reservation request saved for ${savedBooking.tableName} on ${savedBooking.date} at ${savedBooking.time}.`,
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
      window.alert(error.message || "Unable to save the reservation.");
    }
  };

  const handleBookingStatus = async (bookingId, nextStatus) => {
    const booking = reservations.find((entry) => entry.id === bookingId);
    if (!booking) return;

    const nextBooking = { ...booking, status: nextStatus };

    try {
      await updateRemoteReservation(nextBooking);
    } catch (error) {
      window.alert(error.message || "Unable to update this reservation.");
      return;
    }

    setReservations((prev) =>
      prev.map((entry) =>
        entry.id === bookingId ? nextBooking : entry
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
      updateBookingTable(booking, {
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
      const currentTable = tables.find((table) => isBookingTable(table, booking));
      if (currentTable?.status === "occupied" && currentTable.customer === booking.customerName) {
        updateBookingTable(booking, {
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

      <ReservationQueue
        reservations={visibleReservations}
        allReservations={reservations}
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
