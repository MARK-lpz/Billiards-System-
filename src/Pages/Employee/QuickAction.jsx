import { useState } from "react";
import "../../styles/Employee/QuickActions.css";

export default function QuickActions({ tables = [] }) {
  const [modal, setModal] = useState(null); // 'report' | 'schedule'
  const [issueForm, setIssueForm] = useState({ type: "", description: "", tableNumber: "" });
  const [submitted, setSubmitted] = useState(false);

  const reservations = tables.filter((t) => t.status === "reserved" || t.status === "occupied");

  const handleSubmitIssue = (e) => {
    e.preventDefault();
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
  };

  return (
    <div className="qa-page">
      {/* Page Header */}
      <div>
        <h1 className="qa-title">Quick Actions</h1>
        <p className="qa-subtitle">Employee tools and player reservations</p>
      </div>

      {/* Action Buttons Card */}
      <div className="qa-card">
        <div className="qa-grid">
          <button className="qa-btn" onClick={() => setModal("report")}>
            <i className="bi bi-clipboard-check qa-btn-icon"></i>
            <span className="qa-btn-label">REPORT ISSUE</span>
          </button>
          <button className="qa-btn" onClick={() => setModal("schedule")}>
            <i className="bi bi-calendar2-week qa-btn-icon"></i>
            <span className="qa-btn-label">VIEW RESERVATIONS</span>
          </button>
        </div>
      </div>

      {/* ── Modals (reusing global modal classes) ── */}
      {modal && (
        <>
          {/* Backdrop */}
          <div className="modal-backdrop show" onClick={closeModal} />

          <div className="modal show" style={{ display: "flex" }}>
            <div className="modal-dialog">
              <div className="modal-content">

                {/* ── Report Issue Modal ── */}
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

                {/* ── View Reservations Modal ── */}
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
                                {t.status === "occupied" ? "Occupied" : "Reserved"}
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

              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}