import { useState } from "react";
import "../../styles/Admin/Reservations.css";
import ReservationsTable from "../../Elements/Admin/ReservationsTable";
import ReservationModal from "../../Elements/Admin/ReservationModal";
import {
  getAvailableReservationTables,
  hasReservationConflict,
} from "../../utils/reservations";
import { isValidSmsNumber } from "../../utils/phone";

export default function Reservations({ reservations, setReservations, tables }) {
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

  const update = (id, changes) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
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
      update(editId, payload);
    } else {
      setReservations(prev => [...prev, { id: Date.now(), ...payload, status: "pending", source: "admin" }]);
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
