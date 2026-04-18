import { useEffect, useState } from "react";
import "../../styles/Employee/QuickActions.css";

const defaultBorrowForm = {
  itemType: "Cue Stick",
  itemCode: "",
  borrower: "",
  notes: "",
};

const defaultDamageForm = {
  itemType: "Cue Stick",
  itemCode: "",
  issue: "",
  notes: "",
};

const tableStatusOptions = [
  {
    value: "cleaning",
    label: "Cleaning",
    icon: "bi bi-stars",
    helper: "Temporarily unavailable while staff prepare the table.",
    tone: "cleaning",
  },
  {
    value: "maintenance",
    label: "Under maintenance",
    icon: "bi bi-tools",
    helper: "Unavailable until repair or inspection is completed.",
    tone: "maintenance",
  },
  {
    value: "available",
    label: "Ready for use",
    icon: "bi bi-check-circle",
    helper: "Open for walk-ins and reservations again.",
    tone: "ready",
  },
];

const formatStatus = (status) =>
  ({
    available: "Ready for use",
    occupied: "Occupied",
    reserved: "Reserved",
    cleaning: "Cleaning",
    maintenance: "Under maintenance",
  })[status] || status;

export default function QuickActions({ tables = [], setTables, setLogs }) {
  const [modal, setModal] = useState(null);
  const [issueForm, setIssueForm] = useState({ type: "", description: "", tableNumber: "" });
  const [borrowForm, setBorrowForm] = useState(defaultBorrowForm);
  const [damageForm, setDamageForm] = useState(defaultDamageForm);
  const [equipmentRecords, setEquipmentRecords] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const reservations = tables.filter((t) => t.status === "reserved" || t.status === "occupied");
  const operationalTables = [...tables].sort((a, b) => a.id - b.id);
  const tableStatusSummary = {
    cleaning: tables.filter((table) => table.status === "cleaning").length,
    maintenance: tables.filter((table) => table.status === "maintenance").length,
    ready: tables.filter((table) => table.status === "available").length,
  };

  useEffect(() => {
    if (!modal) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal]);

  const addLog = (action, detail) => {
    if (!setLogs) return;
    setLogs((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "employee-action",
        staff: "Employee",
        action,
        detail,
      },
    ]);
  };

  const handleSubmitIssue = (e) => {
    e.preventDefault();
    addLog(
      "Reported issue",
      `${issueForm.type || "General issue"}${issueForm.tableNumber ? ` for ${issueForm.tableNumber}` : ""}`
    );
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setModal(null);
      setIssueForm({ type: "", description: "", tableNumber: "" });
    }, 2000);
  };

  const closeModal = () => {
    setModal(null);
    setSubmitted(false);
    setIssueForm({ type: "", description: "", tableNumber: "" });
    setBorrowForm(defaultBorrowForm);
    setDamageForm(defaultDamageForm);
  };

  const handleBorrowSubmit = (e) => {
    e.preventDefault();

    const newRecord = {
      id: Date.now(),
      itemType: borrowForm.itemType,
      itemCode: borrowForm.itemCode.trim() || "Uncoded item",
      borrower: borrowForm.borrower.trim() || "Walk-in Player",
      notes: borrowForm.notes.trim(),
      status: "borrowed",
      borrowedAt: new Date().toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setEquipmentRecords((prev) => [newRecord, ...prev]);
    addLog("Borrowed equipment", `${newRecord.itemType} ${newRecord.itemCode} borrowed by ${newRecord.borrower}`);
    setBorrowForm(defaultBorrowForm);
  };

  const handleDamageSubmit = (e) => {
    e.preventDefault();

    const damagedRecord = {
      id: Date.now(),
      itemType: damageForm.itemType,
      itemCode: damageForm.itemCode.trim() || "Uncoded item",
      borrower: "N/A",
      notes: damageForm.notes.trim() || damageForm.issue.trim(),
      status: "damaged",
      loggedAt: new Date().toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      issue: damageForm.issue.trim(),
    };

    setEquipmentRecords((prev) => [damagedRecord, ...prev]);
    addLog("Reported damaged equipment", `${damagedRecord.itemType} ${damagedRecord.itemCode} marked damaged`);
    setDamageForm(defaultDamageForm);
  };

  const handleReturn = (id) => {
    const record = equipmentRecords.find((entry) => entry.id === id);
    if (!record) return;

    setEquipmentRecords((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "returned",
              returnedAt: new Date().toLocaleTimeString("en-PH", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : entry
      )
    );

    addLog("Returned equipment", `${record.itemType} ${record.itemCode} returned by ${record.borrower}`);
  };

  const handleTableStatusUpdate = (tableId, nextStatus) => {
    if (!setTables) return;

    const table = tables.find((entry) => entry.id === tableId);
    if (!table || table.status === nextStatus) return;

    setTables((prev) =>
      prev.map((entry) =>
        entry.id === tableId
          ? {
              ...entry,
              status: nextStatus,
              startTime: nextStatus === "occupied" ? entry.startTime : null,
              customer: nextStatus === "occupied" ? entry.customer : "",
            }
          : entry
      )
    );

    addLog("Updated table status", `${table.name || `Table ${table.id}`} marked as ${formatStatus(nextStatus)}`);
  };

  return (
    <div className="qa-page">
      <div>
        <h1 className="qa-title">Actions</h1>
        <p className="qa-subtitle">Employee tools for reservations, issues, equipment monitoring, and table readiness</p>
      </div>

      <div className="qa-card">
        <div className="qa-grid qa-grid--top">
          <button className="qa-btn" onClick={() => setModal("report")}>
            <i className="bi bi-clipboard-check qa-btn-icon"></i>
            <span className="qa-btn-label">REPORT ISSUE</span>
          </button>
          <button className="qa-btn" onClick={() => setModal("schedule")}>
            <i className="bi bi-calendar2-week qa-btn-icon"></i>
            <span className="qa-btn-label">VIEW RESERVATIONS</span>
          </button>
          <button className="qa-btn" onClick={() => setModal("equipment")}>
            <i className="bi bi-tools qa-btn-icon"></i>
            <span className="qa-btn-label">EQUIPMENT MONITOR</span>
          </button>
        </div>

        <div className="qa-module">
          <div className="qa-module-header">
            <div>
              <div className="qa-module-title">Table Status Update</div>
              <p className="qa-module-subtitle">
                Operations can quickly mark each table as cleaning, under maintenance, or ready for use.
              </p>
            </div>

            <div className="qa-summary">
              <div className="qa-summary-pill qa-summary-pill--cleaning">
                <span className="qa-summary-value">{tableStatusSummary.cleaning}</span>
                <span className="qa-summary-label">Cleaning</span>
              </div>
              <div className="qa-summary-pill qa-summary-pill--maintenance">
                <span className="qa-summary-value">{tableStatusSummary.maintenance}</span>
                <span className="qa-summary-label">Maintenance</span>
              </div>
              <div className="qa-summary-pill qa-summary-pill--ready">
                <span className="qa-summary-value">{tableStatusSummary.ready}</span>
                <span className="qa-summary-label">Ready</span>
              </div>
            </div>
          </div>

          <div className="qa-table-grid">
            {operationalTables.map((table) => (
              <div key={table.id} className={`qa-table-card qa-table-card--${table.status}`}>
                <div className="qa-table-card-top">
                  <div>
                    <div className="qa-table-name">{table.name || `Table ${table.id}`}</div>
                    <div className="qa-table-meta">
                      Rate: ${table.rate}/hr
                      {table.customer ? ` • ${table.customer}` : ""}
                    </div>
                  </div>

                  <span className={`qa-badge qa-badge--${table.status}`}>
                    {formatStatus(table.status)}
                  </span>
                </div>

                <div className="qa-status-actions">
                  {tableStatusOptions.map((option) => {
                    const isActive = table.status === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`qa-status-btn qa-status-btn--${option.tone} ${isActive ? "is-active" : ""}`}
                        onClick={() => handleTableStatusUpdate(table.id, option.value)}
                        disabled={isActive}
                        title={option.helper}
                      >
                        <i className={option.icon}></i>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="qa-status-note">
                  <i className="bi bi-info-circle"></i>
                  <span>
                    {table.status === "cleaning" || table.status === "maintenance"
                      ? "Player assignment and active timers are cleared for operational handling."
                      : "Table is available for the next reservation or walk-in session."}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal && (
        <>
          <div className="modal-backdrop show" onClick={closeModal} />

          <div className="modal show" style={{ display: "flex" }} onClick={closeModal}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content">
                {modal === "report" && (
                  <>
                    <div className="modal-header">
                      <h5 className="modal-title">
                        <i className="bi bi-clipboard-check"></i> Report Issue
                      </h5>
                      <button className="btn-close" onClick={closeModal} />
                    </div>

                    <div className="modal-body">
                      {submitted ? (
                        <div className="qa-success">
                          <i className="bi bi-check-circle-fill qa-success-icon"></i>
                          <p className="qa-success-text">Issue reported successfully!</p>
                        </div>
                      ) : (
                        <form onSubmit={handleSubmitIssue}>
                          <div className="mb-3">
                            <label className="form-label">Issue Type</label>
                            <select
                              required
                              className="form-select"
                              value={issueForm.type}
                              onChange={(e) => setIssueForm({ ...issueForm, type: e.target.value })}
                            >
                              <option value="">Select issue type...</option>
                              <option value="equipment">Equipment Malfunction</option>
                              <option value="table">Table Damage</option>
                              <option value="lighting">Lighting Problem</option>
                              <option value="customer">Customer Complaint</option>
                              <option value="other">Other</option>
                            </select>
                          </div>

                          <div className="mb-3">
                            <label className="form-label">Table Number</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g. Table 3"
                              value={issueForm.tableNumber}
                              onChange={(e) => setIssueForm({ ...issueForm, tableNumber: e.target.value })}
                            />
                          </div>

                          <div className="mb-3">
                            <label className="form-label">Description</label>
                            <textarea
                              required
                              className="form-control"
                              rows={4}
                              placeholder="Describe the issue in detail..."
                              value={issueForm.description}
                              onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                            />
                          </div>

                          <div className="modal-footer" style={{ padding: "0", border: "none", marginTop: "8px" }}>
                            <button type="button" className="btn btn-secondary" onClick={closeModal}>
                              Cancel
                            </button>
                            <button type="submit" className="btn btn-success">
                              Submit Report
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </>
                )}

                {modal === "schedule" && (
                  <>
                    <div className="modal-header">
                      <h5 className="modal-title">
                        <i className="bi bi-calendar2-week"></i> Player Reservations
                      </h5>
                      <button className="btn-close" onClick={closeModal} />
                    </div>

                    <div className="modal-body">
                      {reservations.length === 0 ? (
                        <div className="qa-empty">
                          <i className="bi bi-calendar-x qa-empty-icon"></i>
                          <p className="qa-empty-text">No current reservations or active sessions.</p>
                        </div>
                      ) : (
                        <div className="qa-reservation-list">
                          {reservations.map((t) => (
                            <div key={t.id} className="qa-reservation-item">
                              <div className="qa-reservation-info">
                                <span className="qa-reservation-table">{t.name || `Table ${t.id}`}</span>
                                <span className="qa-reservation-customer">{t.customer || "Walk-in"}</span>
                              </div>
                              <span className={`qa-badge qa-badge--${t.status}`}>
                                {formatStatus(t.status)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="modal-footer">
                      <button className="btn btn-secondary" onClick={closeModal}>Close</button>
                    </div>
                  </>
                )}

                {modal === "equipment" && (
                  <>
                    <div className="modal-header">
                      <h5 className="modal-title">
                        <i className="bi bi-tools"></i> Equipment Monitoring
                      </h5>
                      <button className="btn-close" onClick={closeModal} />
                    </div>

                    <div className="modal-body">
                      <div className="qa-equipment-grid">
                        <div className="qa-equipment-card">
                          <div className="qa-equipment-heading">Track Borrowed Equipment</div>
                          <form onSubmit={handleBorrowSubmit} className="qa-form-stack">
                            <select
                              className="form-select"
                              value={borrowForm.itemType}
                              onChange={(e) => setBorrowForm({ ...borrowForm, itemType: e.target.value })}
                            >
                              <option>Cue Stick</option>
                              <option>Ball Set</option>
                              <option>Bridge Stick</option>
                              <option>Chalk</option>
                            </select>
                            <input
                              className="form-control"
                              placeholder="Item code or description"
                              value={borrowForm.itemCode}
                              onChange={(e) => setBorrowForm({ ...borrowForm, itemCode: e.target.value })}
                            />
                            <input
                              className="form-control"
                              placeholder="Borrower / player name"
                              value={borrowForm.borrower}
                              onChange={(e) => setBorrowForm({ ...borrowForm, borrower: e.target.value })}
                            />
                            <input
                              className="form-control"
                              placeholder="Notes (optional)"
                              value={borrowForm.notes}
                              onChange={(e) => setBorrowForm({ ...borrowForm, notes: e.target.value })}
                            />
                            <button type="submit" className="btn btn-success">
                              Log Borrow
                            </button>
                          </form>
                        </div>

                        <div className="qa-equipment-card">
                          <div className="qa-equipment-heading">Report Damaged Equipment</div>
                          <form onSubmit={handleDamageSubmit} className="qa-form-stack">
                            <select
                              className="form-select"
                              value={damageForm.itemType}
                              onChange={(e) => setDamageForm({ ...damageForm, itemType: e.target.value })}
                            >
                              <option>Cue Stick</option>
                              <option>Ball Set</option>
                              <option>Bridge Stick</option>
                              <option>Table Accessory</option>
                            </select>
                            <input
                              className="form-control"
                              placeholder="Item code or description"
                              value={damageForm.itemCode}
                              onChange={(e) => setDamageForm({ ...damageForm, itemCode: e.target.value })}
                            />
                            <input
                              className="form-control"
                              placeholder="Damage issue"
                              value={damageForm.issue}
                              onChange={(e) => setDamageForm({ ...damageForm, issue: e.target.value })}
                            />
                            <textarea
                              className="form-control"
                              rows={3}
                              placeholder="Additional notes"
                              value={damageForm.notes}
                              onChange={(e) => setDamageForm({ ...damageForm, notes: e.target.value })}
                            />
                            <button type="submit" className="btn btn-danger">
                              Report Damage
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="qa-equipment-log">
                        <div className="qa-equipment-heading">Borrow / Return Log</div>
                        {equipmentRecords.length === 0 ? (
                          <div className="qa-empty qa-empty--compact">
                            <i className="bi bi-box-seam qa-empty-icon"></i>
                            <p className="qa-empty-text">No equipment records yet.</p>
                          </div>
                        ) : (
                          <div className="qa-equipment-list">
                            {equipmentRecords.map((record) => (
                              <div key={record.id} className="qa-equipment-item">
                                <div className="qa-equipment-info">
                                  <div className="qa-equipment-name">
                                    {record.itemType} • {record.itemCode}
                                  </div>
                                  <div className="qa-equipment-meta">
                                    {record.status === "borrowed"
                                      ? `Borrowed by ${record.borrower} at ${record.borrowedAt}`
                                      : record.status === "returned"
                                        ? `Returned at ${record.returnedAt}`
                                        : `Damage logged at ${record.loggedAt}`}
                                  </div>
                                  {record.notes ? (
                                    <div className="qa-equipment-meta">{record.notes}</div>
                                  ) : null}
                                </div>

                                <div className="qa-equipment-actions">
                                  <span className={`qa-badge qa-badge--${record.status}`}>
                                    {record.status}
                                  </span>
                                  {record.status === "borrowed" ? (
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleReturn(record.id)}
                                    >
                                      Log Return
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button className="btn btn-secondary" onClick={closeModal}>Close</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
