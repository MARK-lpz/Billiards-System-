import { useState } from "react";
import "../../styles/Admin/PoolTables.css";
import PoolTableStats from "../../Elements/Admin/PoolTableStats.jsx";
import PoolTableCard from "../../Elements/Admin/PoolTableCards";
import PoolTableModal from "../../Elements/Admin/PoolTableModal";
import WalkInModal from "../../Elements/Admin/WalkInModal";
import { useNotifications } from "../../Elements/Global/useNotifications";

export default function PoolTables({ tables, setTables }) {
  const { addNotification } = useNotifications();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", rate: 15 });
  const [editId, setEditId] = useState(null);
  const [walkIn, setWalkIn] = useState({ tableId: null, customer: "" });

  const startWalkIn = () => {
    const customer = walkIn.customer || "Walk-in Customer";
    const table = tables.find(t => t.id === walkIn.tableId);
    setTables(prev => prev.map(t =>
      t.id === walkIn.tableId ? { ...t, status: "occupied", startTime: Date.now(), customer } : t
    ));
    addNotification({
      message: `${table?.name || 'Table'} started walk-in session for ${customer}`,
    });
    setModal(null);
    setWalkIn({ tableId: null, customer: "" });
  };

  const endSession = (id) => {
    const table = tables.find(t => t.id === id);
    setTables(prev => prev.map(t =>
      t.id === id ? { ...t, status: "available", startTime: null, customer: "" } : t
    ));
    addNotification({
      message: `${table?.name || 'Table'} session ended`,
    });
  };

  const reserve = (id) => {
    const table = tables.find(t => t.id === id);
    setTables(prev => prev.map(t => 
      t.id === id ? { ...t, status: "reserved", startTime: null } : t
    ));
    addNotification({
      message: `${table?.name || 'Table'} reserved`,
    });
  };

  const checkIn = (id) => {
    const table = tables.find(t => t.id === id);
    setTables(prev => prev.map(t => 
      t.id === id ? { ...t, status: "occupied", startTime: Date.now() } : t
    ));
    addNotification({
      message: `${table?.name || 'Table'} checked in`,
    });
  };

  const cancelReserve = (id) => {
    setTables(prev => prev.map(t => 
      t.id === id ? { ...t, status: "available", startTime: null, customer: "" } : t
    ));
  };

  const deleteTable = (id) => {
    if (window.confirm("Delete this table?")) {
      setTables(prev => prev.filter(t => t.id !== id));
    }
  };

  const openWalkInModal = (tableId) => {
    setWalkIn({ tableId, customer: "" });
    setModal("walkin");
  };

  const openEditModal = (table) => {
    setForm({ name: table.name, rate: table.rate });
    setEditId(table.id);
    setModal("form");
  };

  const openAddModal = () => {
    setForm({ name: "", rate: 15 });
    setEditId(null);
    setModal("form");
  };

  const saveTable = () => {
    if (editId) {
      setTables(prev => prev.map(t => 
        t.id === editId ? { ...t, ...form } : t
      ));
    } else {
      setTables(prev => [...prev, { 
        id: Date.now(), 
        ...form, 
        status: "available", 
        startTime: null, 
        customer: "" 
      }]);
    }
    setModal(null);
    setEditId(null);
    setForm({ name: "", rate: 15 });
  };

  const stats = {
    available: tables.filter(t => t.status === "available").length,
    occupied: tables.filter(t => t.status === "occupied").length,
    reserved: tables.filter(t => t.status === "reserved").length,
    total: tables.length,
  };

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

      <PoolTableStats stats={stats} />

      {/* Tables Grid */}
      <div className="pool-tables-grid">
        {tables.map(table => (
          <PoolTableCard
            key={table.id}
            table={table}
            onReserve={() => reserve(table.id)}
            onWalkIn={() => openWalkInModal(table.id)}
            onEndSession={() => endSession(table.id)}
            onCheckIn={() => checkIn(table.id)}
            onCancelReserve={() => cancelReserve(table.id)}
            onEdit={() => openEditModal(table)}
            onDelete={() => deleteTable(table.id)}
          />
        ))}
      </div>

      {/* Walk-in Modal */}
      {modal === "walkin" && (
        <WalkInModal
          customer={walkIn.customer}
          onCustomerChange={(value) => setWalkIn({ ...walkIn, customer: value })}
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
          onClose={() => setModal(null)}
          onSave={saveTable}
        />
      )}
    </div>
  );
}