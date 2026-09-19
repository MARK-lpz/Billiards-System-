import { useEffect, useMemo, useState } from "react";
import "../../styles/Admin/Equipments.css";
import EquipmentModal from "../../Elements/Admin/EquipmentModal";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { resolveRemoteIssue } from "../../utils/issueApi";
import { getIssueSummary, isOpenIssue, isResolvedEntry, isResolvedIssue } from "../../utils/issues";

const todayString = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const resolvedTimestamp = () => new Date().toISOString();

const emptyEquipmentForm = {
  name: "",
  type: "Cue Stick",
  condition: "good",
  previousMaintenance: "",
  lastMaintenance: "",
  status: "active",
};

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
  const [view, setView] = useState("equipment");
  const [issueFilter, setIssueFilter] = useState("pending");
  const [equipmentFilter, setEquipmentFilter] = useState(null);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [sideNotice, setSideNotice] = useState(null);

  // An issue opened from another screen shows straight away, with no effect needed.
  const activeIssue = issueModal ?? selectedIssue ?? null;

  const reportedIssues = useMemo(
    () => logs.filter(isOpenIssue).sort((a, b) => Number(b.id || 0) - Number(a.id || 0)),
    [logs]
  );

  useEffect(() => {
    if (!sideNotice) return undefined;

    const timeoutId = window.setTimeout(() => setSideNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [sideNotice]);

  const closeIssueModal = () => {
    setConfirmResolve(false);
    setIssueModal(null);
    onSelectedIssueHandled?.();
  };

  const markLogResolved = (issueId) => {
    if (!setLogs) return;

    setLogs((previous) =>
      previous.map((entry) =>
        entry.id === issueId
          ? {
              ...entry,
              issueStatus: "resolved",
              resolvedAt: resolvedTimestamp(),
              issue: entry.issue ? { ...entry.issue, status: "resolved" } : { status: "resolved" },
            }
          : entry
      )
    );
  };

  const syncRemoteResolution = (issue) => {
    if (!issue?.remoteIssue) return;

    resolveRemoteIssue(issue.id).catch((error) => {
      console.warn("Unable to resolve shared issue", error);
      addNotification({ message: "The issue was resolved locally but could not update the shared feed." });
    });
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

    if (relatedIssue) {
      markLogResolved(relatedIssue.id);
      syncRemoteResolution(relatedIssue);
    }

    const resolvedMessage = relatedIssue
      ? `Problem resolved: ${getIssueSummary(relatedIssue).type}.`
      : `${equipmentItem?.name || "Equipment"} maintenance completed.`;
    addNotification({ message: resolvedMessage });
    setSideNotice({ title: "Problem Resolved", message: resolvedMessage });
    closeIssueModal();
  };

  const resolveIssue = () => {
    if (!activeIssue || !setLogs) return;

    markLogResolved(activeIssue.id);
    syncRemoteResolution(activeIssue);

    const resolvedMessage = `Problem resolved: ${getIssueSummary(activeIssue).type}.`;
    addNotification({ message: resolvedMessage });
    setSideNotice({ title: "Problem Resolved", message: resolvedMessage });
    closeIssueModal();
  };

  const announce = (title, message) => {
    addNotification({ message });
    setSideNotice({ title, message });
  };

  // Take an item out of service, either to be fixed or to be swapped out.
  const sendEquipmentTo = (id, nextStatus) => {
    const item = equipment.find((entry) => entry.id === id);
    setEquipment((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status: nextStatus } : entry)));

    const isRepair = nextStatus === "repair";
    announce(
      isRepair ? "Sent for Repair" : "Marked for Replacement",
      `${item?.name || "Equipment"} ${isRepair ? "was sent for repair" : "is queued for replacement"}.`
    );
  };

  // Put it back in service and log the service date.
  const returnEquipmentToService = (id, kind) => {
    const item = equipment.find((entry) => entry.id === id);
    setEquipment((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              previousMaintenance: entry.lastMaintenance || entry.previousMaintenance || "",
              lastMaintenance: todayString(),
              condition: "good",
              status: "active",
            }
          : entry
      )
    );

    const repaired = kind === "repair";
    announce(
      repaired ? "Repair Completed" : "Replacement Completed",
      `${item?.name || "Equipment"} ${repaired ? "was repaired" : "was replaced"} and is back in service.`
    );
  };

  const openEquipmentForm = (item) => {
    setForm(item);
    setEditId(item.id);
    setModal("form");
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

  const condIcon = {
    good: "bi-check-circle-fill",
    fair: "bi-exclamation-triangle-fill",
    damaged: "bi-x-circle-fill"
  };

  const stats = {
    active: equipment.filter(e => e.status === "active").length,
    repair: equipment.filter(e => e.status === "repair").length,
    replacement: equipment.filter(e => e.status === "replacement").length,
  };

  const resolvedIssues = useMemo(
    () => logs.filter(isResolvedIssue).sort((a, b) => Number(b.id || 0) - Number(a.id || 0)),
    [logs]
  );
  const showingResolved = issueFilter === "resolved";
  const visibleIssues = showingResolved ? resolvedIssues : reportedIssues;

  // Equipment can also be "lost", so these filters toggle off rather than
  // always keeping one selected. Otherwise lost items could never be seen.
  const toggleEquipmentFilter = (status) =>
    setEquipmentFilter((previous) => (previous === status ? null : status));

  const visibleEquipment = equipmentFilter
    ? equipment.filter((item) => item.status === equipmentFilter)
    : equipment;

  // The summary cards describe whichever view is showing.
  const summaryCards = view === "issues"
    ? [
        {
          tone: "yellow",
          value: reportedIssues.length,
          label: "Pending",
          selected: issueFilter === "pending",
          hint: "Show pending reports",
          onSelect: () => setIssueFilter("pending"),
        },
        {
          tone: "green",
          value: resolvedIssues.length,
          label: "Resolved",
          selected: issueFilter === "resolved",
          hint: "Show resolved reports",
          onSelect: () => setIssueFilter("resolved"),
        },
      ]
    : [
        {
          tone: "green",
          value: stats.active,
          label: "Active",
          selected: equipmentFilter === "active",
          hint: equipmentFilter === "active" ? "Show all equipment" : "Show only active equipment",
          onSelect: () => toggleEquipmentFilter("active"),
        },
        {
          tone: "red",
          value: stats.repair,
          label: "For Repair",
          selected: equipmentFilter === "repair",
          hint: equipmentFilter === "repair" ? "Show all equipment" : "Show only equipment for repair",
          onSelect: () => toggleEquipmentFilter("repair"),
        },
        {
          tone: "yellow",
          value: stats.replacement,
          label: "For Replacement",
          selected: equipmentFilter === "replacement",
          hint:
            equipmentFilter === "replacement"
              ? "Show all equipment"
              : "Show only equipment waiting for replacement",
          onSelect: () => toggleEquipmentFilter("replacement"),
        },
      ];

  return (
    <div className="equipment-container">
      {sideNotice && (
        <div className="equipment-side-notice" role="status">
          <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
          <div>
            <strong>{sideNotice.title}</strong>
            <span>{sideNotice.message}</span>
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
          <div className="equipment-view-toggle" role="tablist" aria-label="Equipment page view">
            <button
              type="button"
              role="tab"
              aria-selected={view === "issues"}
              className={`equipment-view-tab ${view === "issues" ? "active" : ""}`}
              onClick={() => setView("issues")}
            >
              <i className="bi bi-exclamation-diamond me-2"></i>
              Reported Issues
              <span>{reportedIssues.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "equipment"}
              className={`equipment-view-tab ${view === "equipment" ? "active" : ""}`}
              onClick={() => setView("equipment")}
            >
              <i className="bi bi-box-seam me-2"></i>
              Equipment
              <span>{equipment.length}</span>
            </button>
          </div>
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
      <div className={`row g-3 mb-4 equipment-summary-stats ${summaryCards.length > 2 ? "is-three" : ""}`}>
        {summaryCards.map((card) => {
          const body = (
            <div className="card-body">
              <div className="equipment-stat-value">{card.value}</div>
              <div className="equipment-stat-label">{card.label}</div>
            </div>
          );
          const cardClass = `card equipment-stat-card equipment-stat-${card.tone}`;

          return (
            <div className={summaryCards.length > 2 ? "col-md-4" : "col-md-6"} key={card.label}>
              <button
                type="button"
                aria-pressed={card.selected}
                title={card.hint}
                className={`${cardClass} equipment-stat-clickable ${card.selected ? "selected" : ""}`}
                onClick={card.onSelect}
              >
                {body}
              </button>
            </div>
          );
        })}
      </div>

      {/* Reported issue cards */}
      {view === "issues" && (
        visibleIssues.length ? (
          <div className="reported-issues-grid">
            {visibleIssues.map((issue) => {
              const summary = getIssueSummary(issue);
              const cardResolveLabel = summary.equipmentId ? "Complete Maintenance" : "Mark Resolved";

              return (
                <div
                  key={issue.id}
                  className={`card reported-issue-card ${showingResolved ? "is-resolved" : ""}`}
                >
                  <div className="card-body">
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

                    <div className="reported-issue-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setConfirmResolve(false);
                          setIssueModal(issue);
                        }}
                      >
                        <i className="bi bi-eye me-1"></i>
                        View Report
                      </button>
                      {showingResolved ? (
                        <span className="reported-issue-resolved-tag">
                          <i className="bi bi-check-circle-fill"></i>
                          Resolved
                        </span>
                      ) : setLogs && (
                        <button
                          type="button"
                          className="btn btn-success"
                          onClick={() => {
                            setConfirmResolve(true);
                            setIssueModal(issue);
                          }}
                        >
                          <i className="bi bi-check-circle me-1"></i>
                          {cardResolveLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="reported-issues-empty">
            <i className={`bi ${showingResolved ? "bi-clock-history" : "bi-shield-check"}`} aria-hidden="true"></i>
            <strong>{showingResolved ? "Nothing resolved yet" : "No reported issues"}</strong>
            <span>
              {showingResolved
                ? "Reports you resolve are kept here as history."
                : "Reports sent by employees show up here for review."}
            </span>
          </div>
        )
      )}

      {/* Equipment Grid */}
      {view === "equipment" && (
        visibleEquipment.length ? (
      <div className="equipment-grid">
        {visibleEquipment.map(e => {
          const conditionClass = e.condition === "good" ? "good" : e.condition === "fair" ? "fair" : "damaged";
          const statusClass = e.status === "repair" ? "repair" : "";
          const relatedIssue = reportedIssues.find(
            (issue) => String(getIssueSummary(issue).equipmentId) === String(e.id)
          );

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
                <div className="equipment-actions">
                  {relatedIssue ? (
                    <button
                      type="button"
                      className="equipment-report-linked"
                      onClick={() => {
                        setConfirmResolve(false);
                        setIssueModal(relatedIssue);
                      }}
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
                    onClick={() => openEquipmentForm(e)}
                  >
                    <i className="bi bi-pencil"></i>
                  </button>
                </div>

                <div className="equipment-service-actions">
                  {e.status === "active" && (
                    <>
                      <button type="button" className="equipment-service-btn repair" onClick={() => sendEquipmentTo(e.id, "repair")}>
                        <i className="bi bi-tools"></i>
                        For Repair
                      </button>
                      <button type="button" className="equipment-service-btn replace" onClick={() => sendEquipmentTo(e.id, "replacement")}>
                        <i className="bi bi-arrow-repeat"></i>
                        For Replacement
                      </button>
                    </>
                  )}

                  {e.status === "repair" && (
                    <>
                      <button type="button" className="equipment-service-btn done" onClick={() => returnEquipmentToService(e.id, "repair")}>
                        <i className="bi bi-check-circle"></i>
                        Mark Repaired
                      </button>
                      <button type="button" className="equipment-service-btn replace" onClick={() => sendEquipmentTo(e.id, "replacement")}>
                        <i className="bi bi-arrow-repeat"></i>
                        Needs Replacement
                      </button>
                    </>
                  )}

                  {e.status === "replacement" && (
                    <button type="button" className="equipment-service-btn done" onClick={() => returnEquipmentToService(e.id, "replacement")}>
                      <i className="bi bi-check-circle"></i>
                      Mark Replaced
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
        ) : (
          <div className="equipment-empty-state">
            <i className="bi bi-funnel" aria-hidden="true"></i>
            <strong>Nothing matches this filter</strong>
            <span>
              No equipment is marked {equipmentFilter === "active" ? "active" : `for ${equipmentFilter}`}. Tap the
              card again to show everything.
            </span>
          </div>
        )
      )}

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

      {activeIssue && (() => {
        const summary = getIssueSummary(activeIssue);
        const resolveLabel = summary.equipmentId ? "Complete Maintenance" : "Mark Resolved";
        const resolveIssueAction = summary.equipmentId
          ? () => completeMaintenance(summary.equipmentId, activeIssue)
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
                        {isResolvedEntry(activeIssue) ? (
                          <span className="reported-issue-resolved-tag">
                            <i className="bi bi-check-circle-fill"></i>
                            Already resolved
                          </span>
                        ) : setLogs && (
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
