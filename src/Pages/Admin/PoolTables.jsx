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
  const [form, setForm] = useState({ name: "", rate: 15, durationMinutes: 60 });
  const [editId, setEditId] = useState(null);
  const [walkIn, setWalkIn] = useState({ tableId: null, customer: "" });
  const [endingTable, setEndingTable] = useState(null);
  const [endingExtensionMinutes, setEndingExtensionMinutes] = useState("30");
  const [statusFilter, setStatusFilter] = useState("all");

  const startWalkIn = () => {
    const customer = walkIn.customer || "Walk-in Customer";
    const table = tables.find(t => t.id === walkIn.tableId);
    setTables(prev => prev.map(t =>
      t.id === walkIn.tableId
        ? { ...t, status: "occupied", startTime: Date.now(), customer, durationMinutes: Number(t.durationMinutes || 60), addedMinutes: 0 }
        : t
    ));
    addNotification({
      message: `${table?.name || 'Table'} started walk-in session for ${customer}`,
    });
    setModal(null);
    setWalkIn({ tableId: null, customer: "" });
  };

  const requestEndSession = (id) => {
    setEndingExtensionMinutes("30");
    setEndingTable(tables.find(t => t.id === id) || null);
  };

  const endSession = () => {
    if (!endingTable) return;
    const table = endingTable;
    setTables(prev => prev.map(t =>
      t.id === table.id ? { ...t, status: "available", startTime: null, customer: "", addedMinutes: 0 } : t
    ));
    addNotification({
      message: `${table?.name || 'Table'} session ended`,
    });
    setEndingTable(null);
  };

  const checkIn = (id) => {
    const table = tables.find(t => t.id === id);
    setTables(prev => prev.map(t => 
      t.id === id ? { ...t, status: "occupied", startTime: Date.now(), durationMinutes: Number(t.durationMinutes || 60), addedMinutes: 0 } : t
    ));
    addNotification({
      message: `${table?.name || 'Table'} checked in`,
    });
  };

  const cancelReserve = (id) => {
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
        customer: "",
        durationMinutes: Number(form.durationMinutes || 60),
        addedMinutes: 0,
      }]);
    }
    setModal(null);
    setEditId(null);
    setForm({ name: "", rate: 15, durationMinutes: 60 });
  };

  const stats = {
    available: tables.filter(t => t.status === "available").length,
    occupied: tables.filter(t => t.status === "occupied").length,
    reserved: tables.filter(t => t.status === "reserved").length,
    total: tables.length,
  };

  const visibleTables = [...(statusFilter === "all"
    ? tables
    : tables.filter((table) => table.status === statusFilter)
  )].sort((left, right) => Number(left.id) - Number(right.id));

  const renderTableCard = (table) => (
    <PoolTableCard
      key={table.id}
      table={table}
      onWalkIn={() => openWalkInModal(table.id)}
      onEndSession={() => requestEndSession(table.id)}
      onCheckIn={() => checkIn(table.id)}
      onCancelReserve={() => cancelReserve(table.id)}
      onAddTime={(minutes) => addTime(table.id, minutes)}
      onUndoTime={(minutes) => undoTime(table.id, minutes)}
      onEdit={() => openEditModal(table)}
      onDelete={() => deleteTable(table.id)}
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

      {endingTable && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content pool-end-modal">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  End Session Warning
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEndingTable(null)}></button>
              </div>
              <div className="modal-body">
                <p className="pool-end-copy">
                  Ending {endingTable.name} will clear the active timer and mark the table as available.
                </p>
                <div className="pool-end-actions">
                  <input
                    aria-label="Extension time in minutes"
                    className="pool-extension-select"
                    type="number"
                    min="1"
                    step="1"
                    value={endingExtensionMinutes}
                    onChange={(event) => setEndingExtensionMinutes(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-warning"
                    onClick={() => {
                      addTime(endingTable.id, Number(endingExtensionMinutes));
                      setEndingTable(null);
                    }}
                  >
                    <i className="bi bi-plus-circle me-2"></i>
                    Add Selected Time
                  </button>
                  <button type="button" className="btn btn-danger" onClick={endSession}>
                    <i className="bi bi-stop-circle me-2"></i>
                    Confirm End Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {endingTable && <div className="modal-backdrop show"></div>}
    </div>
  );
}
