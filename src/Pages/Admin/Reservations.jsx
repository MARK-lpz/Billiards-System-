import { useEffect, useState } from "react";
import "../../styles/Admin/Reservations.css";
import ReservationsTable from "../../Elements/Admin/ReservationsTable";
import ReservationModal from "../../Elements/Admin/ReservationModal";
import {
  getAvailableReservationTables,
  hasReservationConflict,
} from "../../utils/reservations";
import { isValidSmsNumber } from "../../utils/phone";
import { appendAuditLog } from "../../utils/audit";

export default function Reservations({ reservations, setReservations, tables, setTables, setLogs }) {
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    date: "", 
    time: "", 
    tableId: "",
    partySize: 2,
    notes: "" 
  });
  const [editId, setEditId] = useState(null);

  const availableTables = getAvailableReservationTables({
    tables,
    reservations,
    date: form.date,
    time: form.time,
    excludeId: editId,
  });

  const filtered = filter === "all" ? reservations : reservations.filter(r => r.status === filter);

  const logReservationEvent = ({ action, detail, reservation, previousStatus, nextStatus, severity = "info" }) => {
    appendAuditLog(setLogs, {
      type: "reservation",
      staff: "Admin",
      action,
      detail,
      severity,
      entity: "reservation",
      customer: {
        previous: reservation?.customerName
          ? {
              name: reservation.customerName,
              phone: reservation.phone || "",
              partySize: reservation.partySize || reservation.pax || 0,
            }
          : null,
        current: reservation?.customerName
          ? {
              name: reservation.customerName,
              phone: reservation.phone || "",
              partySize: reservation.partySize || reservation.pax || 0,
            }
          : null,
      },
      table: reservation?.tableId
        ? {
            id: Number(reservation.tableId ?? reservation.table),
            name: reservation.tableName || `Table ${reservation.tableId ?? reservation.table}`,
            previousStatus: previousStatus === "approved" ? "reserved" : "available",
            currentStatus: nextStatus === "approved" ? "reserved" : "available",
          }
        : null,
      reservation: reservation
        ? {
            id: reservation.id,
            previousStatus,
            currentStatus: nextStatus,
            date: reservation.date,
            time: reservation.time,
          }
        : null,
    });
  };

  const setTableStateForReservation = (reservation, nextStatus, previousStatus = reservation?.status) => {
    if (!setTables || !reservation?.tableId) return;

    const tableId = Number(reservation.tableId ?? reservation.table);
    if (!tableId) return;

    if (nextStatus === "approved") {
      setTables((prev) =>
        prev.map((table) =>
          table.id === tableId
            ? {
                ...table,
                status: "reserved",
                startTime: null,
                customer: reservation.customerName || reservation.customer || "",
              }
            : table
        )
      );
      return;
    }

    if (previousStatus === "approved" && ["rejected", "completed", "pending"].includes(nextStatus)) {
      setTables((prev) =>
        prev.map((table) => {
          if (table.id !== tableId) return table;

          const sameCustomer = (reservation.customerName || reservation.customer || "") === (table.customer || "");
          const canRelease = table.status === "reserved" || sameCustomer;

          return canRelease
            ? { ...table, status: "available", startTime: null, customer: "" }
            : table;
        })
      );
    }
  };

  const update = (id, changes) => {
    const currentReservation = reservations.find((reservation) => reservation.id === id);
    if (!currentReservation) return;

    const nextReservation = { ...currentReservation, ...changes };
    const nextStatus = changes.status ?? currentReservation.status;

    setReservations((prev) =>
      prev.map((reservation) => (reservation.id === id ? nextReservation : reservation))
    );

    setTableStateForReservation(nextReservation, nextStatus, currentReservation.status);
    if (changes.status && changes.status !== currentReservation.status) {
      logReservationEvent({
        action: `Reservation ${changes.status}`,
        detail: `${currentReservation.customerName} reservation for ${currentReservation.tableName} moved from ${currentReservation.status} to ${changes.status}`,
        reservation: nextReservation,
        previousStatus: currentReservation.status,
        nextStatus,
        severity: changes.status === "rejected" ? "medium" : "info",
      });
    }
  };

  const handleSave = () => {
    if (form.phone.trim() && !isValidSmsNumber(form.phone)) {
      window.alert("Please enter a valid SMS number in 09XXXXXXXXX format.");
      return;
    }

    const tableId = Number(form.tableId);
    const tableName = tables.find((table) => table.id === tableId)?.name || `Table ${tableId}`;
    const candidate = {
      tableId,
      date: form.date,
      time: form.time,
    };

    if (form.date && form.time && hasReservationConflict(reservations, candidate, editId)) {
      window.alert(`${tableName} already has a reservation at ${form.time} on ${form.date}.`);
      return;
    }

    const payload = {
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      date: form.date,
      time: form.time,
      tableId,
      tableName,
      partySize: Number(form.partySize) || 1,
      notes: form.notes.trim(),
    };

    if (editId) {
      const currentReservation = reservations.find((reservation) => reservation.id === editId);
      const previousTableId = Number(currentReservation?.tableId ?? currentReservation?.table);

      if (
        currentReservation?.status === "approved" &&
        previousTableId &&
        previousTableId !== payload.tableId &&
        setTables
      ) {
        setTables((prev) =>
          prev.map((table) =>
            table.id === previousTableId &&
            (table.status === "reserved" || table.customer === (currentReservation.customerName || ""))
              ? { ...table, status: "available", startTime: null, customer: "" }
              : table
          )
        );
      }

      update(editId, payload);
      logReservationEvent({
        action: "Reservation updated",
        detail: `${payload.customerName} reservation updated for ${payload.tableName} on ${payload.date} ${payload.time}`,
        reservation: { ...currentReservation, ...payload },
        previousStatus: currentReservation?.status || "pending",
        nextStatus: currentReservation?.status || "pending",
      });
    } else {
      setReservations(prev => [...prev, { id: Date.now(), ...payload, status: "pending", source: "admin" }]);
      logReservationEvent({
        action: "Reservation created",
        detail: `${payload.customerName} reservation created for ${payload.tableName} on ${payload.date} ${payload.time}`,
        reservation: { id: Date.now(), ...payload },
        previousStatus: null,
        nextStatus: "pending",
      });
    }
    setModal(null);
    setEditId(null);
  };

  const openEdit = (r) => {
    setForm({
      customerName: r.customerName || r.customer || "",
      phone: r.phone || "",
      date: r.date || "",
      time: r.time || "",
      tableId: String(r.tableId ?? r.table ?? ""),
      partySize: r.partySize ?? r.pax ?? 2,
      notes: r.notes || "",
    });
    setEditId(r.id);
    setModal("form");
  };

  const openNew = () => {
    setForm({ customerName: "", phone: "", date: "", time: "", tableId: "", partySize: 2, notes: "" });
    setEditId(null);
    setModal("form");
  };

  const statusFilters = ["all", "pending", "approved", "rejected", "completed"];

  const counts = statusFilters.reduce((acc, s) => {
    acc[s] = s === "all" ? reservations.length : reservations.filter(r => r.status === s).length;
    return acc;
  }, {});

  useEffect(() => {
    if (!setTables) return;

    const approvedMap = new Map(
      reservations
        .filter((reservation) => reservation.status === "approved")
        .map((reservation) => [Number(reservation.tableId ?? reservation.table), reservation])
    );

    setTables((prev) => {
      let changed = false;

      const nextTables = prev.map((table) => {
        const approvedReservation = approvedMap.get(table.id);

        if (!approvedReservation) return table;
        if (!["available", "reserved"].includes(table.status)) return table;

        const nextCustomer = approvedReservation.customerName || approvedReservation.customer || "";
        if (table.status === "reserved" && table.customer === nextCustomer) {
          return table;
        }

        changed = true;
        return {
          ...table,
          status: "reserved",
          startTime: null,
          customer: nextCustomer,
        };
      });

      return changed ? nextTables : prev;
    });
  }, [reservations, setTables]);

  return (
    <div className="reservations-container">
      {/* Header */}
      <div className="reservations-header">
        <div>
          <h1 className="reservations-title">Reservations</h1>
          <p className="reservations-subtitle">View and manage all table reservations</p>
        </div>
        <button className="btn btn-success reservations-add-btn" onClick={openNew}>
          <i className="bi bi-plus-circle me-2"></i>
          New Reservation
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="reservations-filters">
        {statusFilters.map(f => (
          <button
            key={f}
            className={`reservations-filter-btn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f} <span className="reservations-filter-count">({counts[f]})</span>
          </button>
        ))}
      </div>

      <ReservationsTable
        reservations={filtered}
        onUpdate={update}
        onEdit={openEdit}
      />

      {modal === "form" && (
        <ReservationModal
          form={form}
          setForm={setForm}
          editId={editId}
          tables={availableTables}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
