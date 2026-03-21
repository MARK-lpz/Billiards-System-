import { useState } from "react";
import "../../styles/Admin/Reservations.css";
import ReservationsTable from "../../Elements/Admin/ReservationsTable";
import ReservationModal from "../../Elements/Admin/ReservationModal";

export default function Reservations({ reservations, setReservations, tables }) {
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ 
    customer: "", 
    date: "", 
    time: "", 
    table: 1, 
    pax: 2, 
    notes: "" 
  });
  const [editId, setEditId] = useState(null);

  const filtered = filter === "all" ? reservations : reservations.filter(r => r.status === filter);

  const update = (id, changes) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
  };

  const handleSave = () => {
    if (editId) {
      update(editId, form);
    } else {
      setReservations(prev => [...prev, { id: Date.now(), ...form, status: "pending" }]);
    }
    setModal(null);
    setEditId(null);
  };

  const openEdit = (r) => {
    setForm(r);
    setEditId(r.id);
    setModal("form");
  };

  const openNew = () => {
    setForm({ customer: "", date: "", time: "", table: 1, pax: 2, notes: "" });
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
          tables={tables}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}