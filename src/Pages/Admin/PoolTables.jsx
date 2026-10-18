import { useState } from "react";
import "../../styles/Admin/PoolTables.css";
import PoolTableStats from "../../Elements/Admin/PoolTableStats.jsx";
import PoolTableCard from "../../Elements/Admin/PoolTableCards";
import PoolTableModal from "../../Elements/Admin/PoolTableModal";
import WalkInModal from "../../Elements/Admin/WalkInModal";
import TableOrderModal from "../../Elements/Admin/TableOrderModal";
import useTableOrders from "../../Elements/Admin/useTableOrders";
import CancelReservationModal from "../../Elements/Admin/CancelReservationModal";
import { useOnlinePayments } from "../../Elements/Global/useOnlinePayments";
import ConfirmDialog from "../../Elements/Global/ConfirmDialog";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { findTableReservation, formatHoursLabel, getExtensionBlock, getTodayDate } from "../../utils/reservations";
import { getPoolTableErrors } from "../../utils/formValidation";
import { saveTableReservationStatus } from "../../utils/reservationApi";
import { getCheckInBlock, hasTableReservation } from "../../utils/tableHolds";
import useClock from "../../Elements/Global/useClock";

const UPCOMING_BOOKING = new Set(["pending", "approved", "reserved", "arrived"]);

// Why a table cannot be deleted now, or "": deleting it would lose a running
// session and its bill, or leave bookings pointing at a table that is gone.
const getDeleteBlock = (table, reservations, today) => {
  const name = table.name || "This table";
  if (table.status === "occupied") return `Someone is playing on ${name}. End the session first.`;
  const upcoming = reservations.filter(
    (reservation) =>
      UPCOMING_BOOKING.has(reservation.status) &&
      Number(reservation.tableId ?? reservation.table) === Number(table.id) &&
      String(reservation.date || "") >= today
  ).length;
  if (upcoming || table.status === "reserved") {
    return `${name} has ${upcoming > 1 ? `${upcoming} upcoming bookings` : "an upcoming booking"}. Move or cancel ${upcoming > 1 ? "them" : "it"} in Reservations first.`;
  }
  return "";
};

// Ending a session takes its payment, which the dashboard handles (`onEndSession`)
// so the time's up pop-up on any page can end one the same way.
export default function PoolTables({
  tables,
  setTables,
  reservations = [],
  setReservations,
  products = [],
  setProducts,
  setLogs,
  onEndSession,
}) {
  const { addNotification, showToast } = useNotifications();
  // A website booking's GCash payment moves with it on the server; asked again after a cancel.
  const { refresh: refreshPayments } = useOnlinePayments();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", rate: 15, durationMinutes: 60 });
  const [editId, setEditId] = useState(null);
  const [walkInTableId, setWalkInTableId] = useState(null);
  // The table whose Order pop-up is open; gone once its session ends.
  const [orderTableId, setOrderTableId] = useState(null);
  const orderTable = tables.find(t => t.id === orderTableId && t.status === "occupied") || null;
  const tableOrders = useTableOrders({ tables, setTables, products, setProducts, setLogs, staff: "Admin" });
  // The reserved table whose Cancel pop-up is open; gone if it is no longer reserved.
  const [cancelTableId, setCancelTableId] = useState(null);
  const cancelTable = tables.find(t => t.id === cancelTableId && t.status === "reserved") || null;
  const [statusFilter, setStatusFilter] = useState("all");
  // Deleting cannot be undone, so the trash button only arms this confirmation.
  const [deleteTarget, setDeleteTarget] = useState(null);
  // What is wrong with the open Add / Edit Table form, if anything.
  const tableErrors = modal === "form" ? getPoolTableErrors({ form, tables, editId }) : {};

  // The session runs as long as the customer said they would stay.
  const startWalkIn = ({ customer, minutes }) => {
    const table = tables.find(t => t.id === walkInTableId);
    setTables(prev => prev.map(t =>
      t.id === walkInTableId
        ? { ...t, status: "occupied", startTime: Date.now(), customer, durationMinutes: minutes, addedMinutes: 0 }
        : t
    ));
    addNotification({
      message: `${table?.name || 'Table'} started a ${formatHoursLabel(minutes)} walk-in session for ${customer}`,
    });
    setModal(null);
    setWalkInTableId(null);
  };

  const checkIn = (id) => {
    const table = tables.find(t => t.id === id);
    // The button is off when blocked, but the page may have sat open past the grace period.
    const block = getCheckInBlock({ table, reservations, now: new Date() });
    if (block) {
      showToast({ tone: "error", icon: "bi-calendar-x", title: `Can't check in at ${table?.name || "this table"}`, message: block });
      return;
    }
// A reserved guest plays the hours they booked, not the table's default.
    const bookedMinutes = Number(findTableReservation(table, reservations)?.durationMinutes);
    setTables(prev => prev.map(t => 
      t.id === id
        ? { ...t, status: "occupied", startTime: Date.now(), durationMinutes: bookedMinutes > 0 ? bookedMinutes : Number(t.durationMinutes || 60), addedMinutes: 0 }
        : t
    ));
    // Seated, so the booking is not expired as a no-show while the guest plays.
    saveTableReservationStatus({ table, reservations, setReservations, from: ["approved", "reserved", "arrived"], status: "seated" });
    addNotification({
      message: `${table?.name || 'Table'} checked in`,
    });
  };

  // Runs once the Cancel pop-up is confirmed. The booking itself is cancelled
  // too, or the reservations sync would mark the table reserved again.
  // `extra`: whether to give a website booking's accepted GCash payment back.
  const cancelReserve = (id, extra = {}) => {
    const table = tables.find(t => t.id === id);
    if (!table) return;

    saveTableReservationStatus({
      table,
      reservations,
      setReservations,
      from: ["approved", "reserved", "arrived"],
      status: "cancelled",
      extra,
      onSaved: refreshPayments,
    });
    addNotification({ message: `Reservation for ${table.name || 'Table'} was cancelled.` });
    setTables(prev => prev.map(t =>
      t.id === id
        ? {
            ...t,
            status: "available",
            startTime: null,
            customer: "",
            addedMinutes: 0,
            reservationId: null,
            reservationDate: "",
            reservationTime: "",
          }
        : t
    ));
  };

  const addTime = (id, minutes) => {
    const extension = Number(minutes);
    if (!Number.isInteger(extension) || extension < 1) return;

    const table = tables.find(t => t.id === id);
    // More time must end before the table's next booking.
    const extensionBlock = getExtensionBlock({ table, reservations, minutes: extension });
    if (extensionBlock) {
      showToast({ tone: "error", icon: "bi-calendar-x", title: "Time not added", message: extensionBlock });
      return;
    }
    setTables(prev => prev.map(t =>
      t.id === id
        ? { ...t, durationMinutes: Number(t.durationMinutes || 60) + extension, addedMinutes: Number(t.addedMinutes || 0) + extension }
        : t
    ));
    addNotification({
      message: `${table?.name || 'Table'} extended by ${extension} minutes`,
    });
  };

  const undoTime = (id, minutes) => {
    const requestedMinutes = Number(minutes);
    if (!Number.isInteger(requestedMinutes) || requestedMinutes < 1) return;

    const table = tables.find(t => t.id === id);
    const addedMinutes = Number(table?.addedMinutes || 0);
    const minutesToRemove = Math.min(requestedMinutes, addedMinutes);
    if (!minutesToRemove) return;

    setTables(prev => prev.map(t =>
      t.id === id
        ? {
            ...t,
            durationMinutes: Math.max(0, Number(t.durationMinutes || 60) - minutesToRemove),
            addedMinutes: Math.max(0, Number(t.addedMinutes || 0) - minutesToRemove),
          }
        : t
    ));
    addNotification({
      message: `${table?.name || 'Table'} time reduced by ${minutesToRemove} minutes`,
    });
  };

  const requestDelete = (id) => {
    const table = tables.find(t => t.id === id);
    if (!table) return;
    const block = getDeleteBlock(table, reservations, getTodayDate());
    if (block) {
      showToast({ tone: "error", icon: "bi-exclamation-octagon", title: `${table.name || "Table"} cannot be deleted`, message: block });
      return;
    }
    setDeleteTarget(table);
  };

  // Takes the table as an argument for the React Compiler reason noted in Inventory.jsx.
  const deleteTable = (table) => {
    setTables(prev => prev.filter(t => t.id !== table.id));
    addNotification({ message: `${table.name || "Table"} was deleted.` });
    setDeleteTarget(null);
  };

  const openWalkInModal = (tableId) => {
    setWalkInTableId(tableId);
    setModal("walkin");
  };

  const openEditModal = (table) => {
    setForm({ name: table.name, rate: table.rate, durationMinutes: table.durationMinutes || 60 });
    setEditId(table.id);
    setModal("form");
  };

  const openAddModal = () => {
    setForm({ name: "", rate: 15, durationMinutes: 60 });
    setEditId(null);
    setModal("form");
  };

  const saveTable = () => {
    if (Object.keys(tableErrors).length) return;
    // Stored clean: a trimmed name and numbers, whatever the inputs held.
    const cleaned = { name: form.name.trim(), rate: Number(form.rate), durationMinutes: Number(form.durationMinutes) };
    if (editId) {
      setTables(prev => prev.map(t => 
        t.id === editId ? { ...t, ...cleaned } : t
      ));
    } else {
      setTables(prev => [...prev, { 
        id: Date.now(), 
        ...cleaned, 
        status: "available", 
        startTime: null, 
        customer: "",
        addedMinutes: 0,
      }]);
    }
    setModal(null);
    setEditId(null);
    setForm({ name: "", rate: 15, durationMinutes: 60 });
  };

  // Reserved covers tables held now and those booked for later, which stay
  // Available (and count there too) until their booking comes due.
  const clock = useClock();
  const isReservedTable = (table) => hasTableReservation(table, reservations, new Date(clock));
  const stats = {
    available: tables.filter(t => t.status === "available").length,
    occupied: tables.filter(t => t.status === "occupied").length,
    reserved: tables.filter(isReservedTable).length,
    total: tables.length,
  };

  const visibleTables = [...(statusFilter === "all"
    ? tables
    : statusFilter === "reserved"
      ? tables.filter(isReservedTable)
      : tables.filter((table) => table.status === statusFilter)
  )].sort((left, right) => Number(left.id) - Number(right.id));

  const renderTableCard = (table) => (
    <PoolTableCard
      key={table.id}
      table={table}
      reservations={reservations}
      onWalkIn={() => openWalkInModal(table.id)}
      onEndSession={() => onEndSession?.(table.id)}
      onOrder={() => setOrderTableId(table.id)}
      onCheckIn={() => checkIn(table.id)}
      onCancelReserve={() => setCancelTableId(table.id)}
      onAddTime={(minutes) => addTime(table.id, minutes)}
      onUndoTime={(minutes) => undoTime(table.id, minutes)}
      onEdit={() => openEditModal(table)}
      onDelete={() => requestDelete(table.id)}
    />
  );

  return (
    <div className="pool-tables-container">
      {/* Header */}
      <div className="pool-tables-header">
        <div>
          <h1 className="pool-tables-title">Pool Tables</h1>
          <p className="pool-tables-subtitle">Manage and monitor all billiard tables</p>
        </div>
        <button className="btn btn-success pool-tables-add-btn" onClick={openAddModal}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Table
        </button>
      </div>

      <PoolTableStats
        stats={stats}
        activeStatus={statusFilter}
        onFilterChange={setStatusFilter}
      />

      <div className="pool-tables-grid">
        {visibleTables.map(renderTableCard)}
      </div>

      {/* Walk-in Modal */}
      {modal === "walkin" && (
        <WalkInModal
          table={tables.find(t => t.id === walkInTableId)}
          reservations={reservations}
          onClose={() => setModal(null)}
          onStart={startWalkIn}
        />
      )}

      {/* Add/Edit Table Modal */}
      {modal === "form" && (
        <PoolTableModal
          form={form}
          setForm={setForm}
          editId={editId}
          errors={tableErrors}
          onClose={() => setModal(null)}
          onSave={saveTable}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this table?"
          message={<><strong>{deleteTarget.name}</strong> will be removed from Pool Tables, the dashboards and the booking pages.</>}
          detail="This cannot be undone. Past sales and bills that mention it are kept."
          confirmLabel="Yes, Delete Table"
          cancelLabel="Keep Table"
          onConfirm={() => deleteTable(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {orderTable && (
        <TableOrderModal
          table={orderTable}
          products={products}
          onPlace={(draft) => tableOrders.placeOrder(orderTable, draft)}
          onTakeOff={(lineId) => tableOrders.takeOffOrder(orderTable, lineId)}
          onClose={() => setOrderTableId(null)}
        />
      )}

      {cancelTable && (
        <CancelReservationModal
          table={cancelTable}
          reservations={reservations}
          onClose={() => setCancelTableId(null)}
          onConfirm={(extra) => {
            cancelReserve(cancelTable.id, extra);
            setCancelTableId(null);
          }}
        />
      )}
    </div>
  );
}
