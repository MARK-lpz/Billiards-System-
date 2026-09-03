import { useEffect, useMemo, useState } from "react";
import "../../styles/Admin/Equipments.css";
import EquipmentModal from "../../Elements/Admin/EquipmentModal";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { resolveRemoteIssue } from "../../utils/issueApi";

const todayString = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const emptyEquipmentForm = {
  name: "",
  type: "Cue Stick",
  condition: "good",
  previousMaintenance: "",
  lastMaintenance: "",
  status: "active",
};

const ISSUE_ACTION_KEYWORDS = ["reported issue", "reported damaged equipment", "customer complaint"];

const isOpenIssue = (entry) => {
  const action = `${entry?.action || ""}`.toLowerCase();
  const detail = `${entry?.detail || ""}`.toLowerCase();
  const isResolved = entry?.issueStatus === "resolved" || entry?.issue?.status === "resolved" || Boolean(entry?.resolvedAt);

  if (isResolved || action.includes("updated table status")) return false;
  if (ISSUE_ACTION_KEYWORDS.some((keyword) => action.includes(keyword))) return true;

  return ["issue", "damage", "complaint", "malfunction"].some(
    (keyword) => action.includes(keyword) || detail.includes(keyword)
  );
};

const getIssueSummary = (issue) => ({
  type: issue?.issue?.type || issue?.issueType || issue?.action || "Issue Report",
  reporter: issue?.staff || "Employee",
  time: issue?.time || "Just now",
  table: issue?.issue?.table || issue?.issueTable || "Not specified",
  equipmentId: issue?.issue?.equipmentId || issue?.issueEquipmentId || null,
  equipmentName: issue?.issue?.equipmentName || issue?.issueEquipmentName || "",
  description: issue?.issue?.description || issue?.issueDescription || issue?.detail || "No details provided.",
});

export default function Equipment({
  equipment,
  setEquipment,
  logs = [],
  setLogs,
  selectedIssue,
  onSelectedIssueHandled,
}) {
  const { addNotification } = useNotifications();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyEquipmentForm);
  const [editId, setEditId] = useState(null);
  const [issueModal, setIssueModal] = useState(null);
  const [showIssueList, setShowIssueList] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [sideNotice, setSideNotice] = useState("");

  const reportedIssues = useMemo(
    () => logs.filter(isOpenIssue).sort((a, b) => Number(b.id || 0) - Number(a.id || 0)),
    [logs]
  );

  useEffect(() => {
    if (selectedIssue) {
      setConfirmResolve(false);
      setIssueModal(selectedIssue);
    }
  }, [selectedIssue]);

  useEffect(() => {
    if (!sideNotice) return undefined;

    const timeoutId = window.setTimeout(() => setSideNotice(""), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [sideNotice]);

  const closeIssueModal = () => {
    setConfirmResolve(false);
    setIssueModal(null);
    onSelectedIssueHandled?.();
  };

  const save = () => {
    if (editId) {
      setEquipment(prev => prev.map(e => e.id === editId ? { ...e, ...form } : e));
      addNotification({ message: `${form.name} equipment details updated.` });
    } else {
      setEquipment(prev => [...prev, { id: Date.now(), ...form }]);
      addNotification({ message: `${form.name} registered as equipment.` });
    }
    setModal(null);
    setEditId(null);
  };

  const completeMaintenance = (id, relatedIssue = null) => {
    const equipmentItem = equipment.find((item) => item.id === id);
    setEquipment((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              previousMaintenance: item.lastMaintenance || item.previousMaintenance || "",
              lastMaintenance: todayString(),
              condition: "good",
              status: "active",
            }
          : item
      )
    );
    if (relatedIssue && setLogs) {
      setLogs((previous) =>
        previous.map((entry) =>
          entry.id === relatedIssue.id
            ? {
                ...entry,
                issueStatus: "resolved",
                resolvedAt: new Date().toISOString(),
                issue: entry.issue ? { ...entry.issue, status: "resolved" } : { status: "resolved" },
              }
            : entry
        )
      );
      if (relatedIssue.remoteIssue) {
        resolveRemoteIssue(relatedIssue.id).catch((error) => {
          console.warn("Unable to resolve shared issue", error);
          addNotification({ message: "The issue was resolved locally but could not update the shared feed." });
        });
      }
    }
    const resolvedMessage = relatedIssue
      ? `Problem resolved: ${getIssueSummary(relatedIssue).type}.`
      : `${equipmentItem?.name || "Equipment"} maintenance completed.`;
    addNotification({ message: resolvedMessage });
    setSideNotice(resolvedMessage);
    closeIssueModal();
  };

  const resolveIssue = () => {
    if (!issueModal || !setLogs) return;

    setLogs((previous) =>
      previous.map((entry) =>
        entry.id === issueModal.id
          ? {
              ...entry,
              issueStatus: "resolved",
              resolvedAt: new Date().toISOString(),
              issue: entry.issue ? { ...entry.issue, status: "resolved" } : { status: "resolved" },
            }
          : entry
      )
    );
    if (issueModal.remoteIssue) {
      resolveRemoteIssue(issueModal.id).catch((error) => {
        console.warn("Unable to resolve shared issue", error);
        addNotification({ message: "The issue was resolved locally but could not update the shared feed." });
      });
    }
    const resolvedMessage = `Problem resolved: ${getIssueSummary(issueModal).type}.`;
    addNotification({ message: resolvedMessage });
    setSideNotice(resolvedMessage);
    closeIssueModal();
  };

  const condIcon = { 
    good: "bi-check-circle-fill", 
    fair: "bi-exclamation-triangle-fill", 
    damaged: "bi-x-circle-fill" 
  };

  const stats = {
    active: equipment.filter(e => e.status === "active").length,
    repair: equipment.filter(e => e.status === "repair").length,
  };

  return (
    <div className="equipment-container">
      {sideNotice && (
        <div className="equipment-side-notice" role="status">
          <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
          <div>
            <strong>Problem Resolved</strong>
            <span>{sideNotice}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="equipment-header">
        <div>
          <h1 className="equipment-title">Equipment Monitoring</h1>
          <p className="equipment-subtitle">Track billiard equipment condition and maintenance</p>
        </div>
        <div className="equipment-header-actions">
          <button
            type="button"
            className="btn equipment-reports-btn"
            onClick={() => setShowIssueList(true)}
          >
            <i className="bi bi-exclamation-diamond me-2"></i>
            Reported Issues
            <span>{reportedIssues.length}</span>
          </button>
          <button 
            className="btn btn-success equipment-add-btn" 
            onClick={() => { 
              setForm(emptyEquipmentForm); 
              setEditId(null); 
              setModal("form"); 
            }}
          >
            <i className="bi bi-plus-circle me-2"></i>
            Register Equipment
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="row g-3 mb-4 equipment-summary-stats">
        <div className="col-md-6">
          <div className="card equipment-stat-card equipment-stat-green">
            <div className="card-body">
              <div className="equipment-stat-value">{stats.active}</div>
              <div className="equipment-stat-label">Active</div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card equipment-stat-card equipment-stat-red">
            <div className="card-body">
              <div className="equipment-stat-value">{stats.repair}</div>
              <div className="equipment-stat-label">For Repair</div>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment Grid */}
      <div className="equipment-grid">
        {equipment.map(e => {
          const conditionClass = e.condition === "good" ? "good" : e.condition === "fair" ? "fair" : "damaged";
          const statusClass = e.status === "repair" ? "repair" : "";
          
          return (
            <div key={e.id} className={`card equipment-card ${statusClass}`}>
              <div className="card-body">
                {/* Header */}
                <div className="equipment-card-header">
                  <div>
                    <h6 className="equipment-name">{e.name}</h6>
                    <p className="equipment-type">{e.type}</p>
                  </div>
                  <span className={`badge equipment-badge-${e.status}`}>
                    {e.status}
                  </span>
                </div>

                {/* Info Grid */}
                <div className="equipment-info-grid">
                    <div className="equipment-info-box">
                    <div className="equipment-info-label">Condition</div>
                    <div className={`equipment-condition equipment-condition-${conditionClass}`}>
                      <i className={`bi ${condIcon[e.condition]}`}></i>
                      <span>{e.condition}</span>
                    </div>
                  </div>
                  <div className="equipment-info-box">
                    <div className="equipment-info-label">Previous Maintenance</div>
                    <div className="equipment-maintenance">
                      {e.previousMaintenance || "Not recorded"}
                    </div>
                  </div>
                  <div className="equipment-info-box">
                    <div className="equipment-info-label">Latest Maintenance</div>
                    <div className="equipment-maintenance">
                      {e.lastMaintenance || "Not recorded"}
                    </div>
                    </div>
                  </div>

                  {/* Actions */}
                {(() => {
                  const relatedIssue = reportedIssues.find(
                    (issue) => String(getIssueSummary(issue).equipmentId) === String(e.id)
                  );

                  return (
                    <div className="equipment-actions">
                      {relatedIssue ? (
                        <button
                          type="button"
                          className="equipment-report-linked"
                          onClick={() => setIssueModal(relatedIssue)}
                        >
                            <i className="bi bi-exclamation-diamond"></i>
                            Reported issue
                        </button>
                      ) : (
                        <span className="equipment-no-report">
                          <i className="bi bi-shield-check"></i>
                          No reported issue
                        </span>
                      )}
                  <button 
                    className="btn btn-sm btn-outline-secondary" 
                    onClick={() => { 
                      setForm(e); 
                      setEditId(e.id); 
                      setModal("form"); 
                    }}
                  >
                    <i className="bi bi-pencil"></i>
                  </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Equipment Modal */}
      {modal === "form" && (
        <EquipmentModal
          form={form}
          setForm={setForm}
          editId={editId}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {showIssueList && (
        <>
          <div className="modal-backdrop show" onClick={() => setShowIssueList(false)} />
          <div className="modal show" style={{ display: "flex" }} onClick={() => setShowIssueList(false)}>
            <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
              <div className="modal-content equipment-issue-modal">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title">Reported Equipment Issues</h5>
                    <p className="equipment-issue-modal-subtitle">Issues submitted by employees for review and maintenance.</p>
                  </div>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowIssueList(false)}></button>
                </div>
                <div className="modal-body equipment-issue-list-modal">
                  {reportedIssues.length ? reportedIssues.map((issue) => {
                    const summary = getIssueSummary(issue);
                    return (
                      <button
                        key={issue.id}
                        type="button"
                        className="equipment-issue-row"
                        onClick={() => {
                          setShowIssueList(false);
                          setConfirmResolve(false);
                          setIssueModal(issue);
                        }}
                      >
                        <i className="bi bi-exclamation-diamond equipment-issue-row-icon" aria-hidden="true"></i>
                        <span className="equipment-issue-row-copy">
                          <strong>{summary.type}</strong>
                          <span>{summary.table}</span>
                          <small>{summary.reporter} · {summary.time}</small>
                        </span>
                        <i className="bi bi-chevron-right equipment-issue-row-arrow" aria-hidden="true"></i>
                      </button>
                    );
                  }) : (
                    <div className="equipment-issue-empty">
                      <i className="bi bi-shield-check" aria-hidden="true"></i>
                      <span>No employee issues need equipment review.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {issueModal && (() => {
        const summary = getIssueSummary(issueModal);
        const resolveLabel = summary.equipmentId ? "Complete Maintenance" : "Mark Resolved";
        const resolveIssueAction = summary.equipmentId
          ? () => completeMaintenance(summary.equipmentId, issueModal)
          : resolveIssue;
        return (
          <>
            <div className="modal-backdrop show" onClick={closeIssueModal} />
            <div className="modal show" style={{ display: "flex" }} onClick={closeIssueModal}>
              <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
                <div className="modal-content equipment-issue-modal">
                  <div className="modal-header">
                    <div>
                      <h5 className="modal-title">Employee Issue Report</h5>
                      <p className="equipment-issue-modal-subtitle">Review the report before recording maintenance or resolving it.</p>
                    </div>
                    <button type="button" className="btn-close btn-close-white" onClick={closeIssueModal}></button>
                  </div>
                  <div className="modal-body">
                    <div className="equipment-issue-modal-alert">
                      <i className="bi bi-exclamation-diamond" aria-hidden="true"></i>
                      <strong>{summary.type}</strong>
                    </div>
                    <div className="equipment-issue-modal-grid">
                      <div><span>Reported by</span><strong>{summary.reporter}</strong></div>
                      <div><span>Reported time</span><strong>{summary.time}</strong></div>
                      <div><span>Related table</span><strong>{summary.table}</strong></div>
                      <div><span>Affected equipment</span><strong>{summary.equipmentName || "Not specified"}</strong></div>
                    </div>
                    <div className="equipment-issue-description">
                      <span>Description</span>
                      <p>{summary.description}</p>
                    </div>
                  </div>
                  <div className="modal-footer">
                    {confirmResolve ? (
                      <div className="equipment-resolve-confirmation">
                        <span>Are you sure this issue is resolved?</span>
                        <button type="button" className="btn btn-secondary" onClick={() => setConfirmResolve(false)}>No</button>
                        <button type="button" className="btn btn-success" onClick={resolveIssueAction}>Yes, Resolve</button>
                      </div>
                    ) : (
                      <>
                        <button type="button" className="btn btn-secondary" onClick={closeIssueModal}>Close</button>
                        {setLogs && (
                          <button type="button" className="btn btn-success" onClick={() => setConfirmResolve(true)}>
                            {resolveLabel}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
