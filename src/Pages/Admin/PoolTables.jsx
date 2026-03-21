import { useState, useEffect } from "react";
import "../../styles/Admin/PoolTables.css";
import PoolTableStats from "../../Elements/Admin/PoolTableStats.jsx";
import PoolTableCard from "../../Elements/Admin/PoolTableCard";
import PoolTableModal from "../../Elements/Admin/PoolTableModal";
import WalkInModal from "../../Elements/Admin/WalkInModal";

export default function PoolTables({ tables, setTables }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", rate: 15 });
  const [editId, setEditId] = useState(null);
  const [walkIn, setWalkIn] = useState({ tableId: null, customer: "" });

  // Timer effect - increments every second for running tables
  useEffect(() => {
    const interval = setInterval(() => {
      setTables(prev => prev.map(t => 
        t.running ? { ...t, timer: t.timer + 1 } : t
      ));
    }, 1000);
    return () => clearInterval(interval);
  }, [setTables]);

  const startWalkIn = () => {
    const customer = walkIn.customer || "Walk-in Customer";
    setTables(prev => prev.map(t =>
      t.id === walkIn.tableId ? { ...t, status: "occupied", running: true, customer } : t
    ));
    setModal(null);
    setWalkIn({ tableId: null, customer: "" });
  };

  const endSession = (id) => {
    setTables(prev => prev.map(t =>
      t.id === id ? { ...t, running: false, timer: 0, status: "available", customer: "" } : t
    ));
  };

  const reserve = (id) => {
    setTables(prev => prev.map(t => 
      t.id === id ? { ...t, status: "reserved" } : t
    ));
  };

  const checkIn = (id) => {
    setTables(prev => prev.map(t => 
      t.id === id ? { ...t, status: "occupied", running: true } : t
    ));
  };

  const cancelReserve = (id) => {
    setTables(prev => prev.map(t => 
      t.id === id ? { ...t, status: "available" } : t
    ));
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
        timer: 0, 
        running: false, 
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