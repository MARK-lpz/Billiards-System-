import { useEffect, useState } from "react";

const ISSUE_ACTION_KEYWORDS = ["reported issue", "reported damaged equipment", "customer complaint"];

const isResolvedIssue = (entry) =>
  entry?.issueStatus === "resolved" || entry?.issue?.status === "resolved" || Boolean(entry?.resolvedAt);

const isIssueEntry = (entry) => {
  const action = `${entry.action || ""}`.toLowerCase();
  const detail = `${entry.detail || ""}`.toLowerCase();

  if (action.includes("updated table status")) return false;

  if (ISSUE_ACTION_KEYWORDS.some((keyword) => action.includes(keyword))) {
    return true;
  }

  return ["issue", "damage", "complaint", "malfunction"].some(
    (keyword) => action.includes(keyword) || detail.includes(keyword)
  );
};

const getSeverity = (entry) => {
  const text = `${entry.action || ""} ${entry.detail || ""}`.toLowerCase();

  if (text.includes("damage") || text.includes("malfunction")) {
    return { label: "High", className: "priority-high" };
  }

  if (text.includes("complaint") || text.includes("maintenance")) {
    return { label: "Medium", className: "priority-medium" };
  }

  return { label: "Low", className: "priority-low" };
};

const getIssueLogs = (logs = []) =>
  logs
    .filter((entry) => isIssueEntry(entry) && !isResolvedIssue(entry))
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    .slice(0, 4);

export default function TaskList({ logs = [], setLogs, onOpenEquipment }) {
  const issueLogs = getIssueLogs(logs);
  const [selectedIssue, setSelectedIssue] = useState(null);

  useEffect(() => {
    if (!selectedIssue) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedIssue(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIssue]);

  const issueSummary = selectedIssue
    ? {
        title: selectedIssue.issue?.type || selectedIssue.issueType || selectedIssue.action || "Issue Report",
        reporter: selectedIssue.staff || "Staff",
        time: selectedIssue.time || "Just now",
        table: selectedIssue.issue?.table || selectedIssue.issueTable || "Not specified",
        description: selectedIssue.issue?.description || selectedIssue.issueDescription || selectedIssue.detail || "No details provided.",
      }
    : null;

  const handleResolveIssue = () => {
    if (!selectedIssue || !setLogs) return;

    setLogs((prev) =>
      prev.map((entry) =>
        entry.id === selectedIssue.id
          ? {
              ...entry,
              issueStatus: "resolved",
              resolvedAt: new Date().toISOString(),
              issue: entry.issue ? { ...entry.issue, status: "resolved" } : { status: "resolved" },
            }
          : entry
      )
    );

    setSelectedIssue(null);
  };

  return (
    <>
      <div className="content-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Reported Issues</h2>
            <p className="card-subtitle">Recent issue reports from staff</p>
          </div>
          <span className="view-all-btn issue-count-pill">{issueLogs.length}</span>
        </div>

        <div className="task-list">
          {issueLogs.length === 0 ? (
            <div className="issue-empty-state">
              <i className="bi bi-shield-check"></i>
              <p>No reported issues right now.</p>
            </div>
          ) : (
            issueLogs.map((entry) => {
              const severity = getSeverity(entry);

              return (
                <button
                  key={entry.id}
                  type="button"
                  className="task-item issue-item issue-item-btn"
                  onClick={() => {
                    if (onOpenEquipment) {
                      onOpenEquipment(entry);
                      return;
                    }
                    setSelectedIssue(entry);
                  }}
                >
                  <div className="task-checkbox task-checkbox--icon">
                    <i className="bi bi-exclamation-diamond"></i>
                  </div>

                  <div className="task-info">
                    <p className="task-name">{entry.action || "Issue Report"}</p>
                    <span className="task-time">{entry.detail || "No details provided."}</span>
                    <span className="task-meta">{`${entry.staff || "Staff"} | ${entry.time || "Just now"}`}</span>
                  </div>

                  <span className={`task-priority ${severity.className}`}>{severity.label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selectedIssue && (
        <>
          <div className="modal-backdrop show" onClick={() => setSelectedIssue(null)} />

          <div
            className="modal show"
            style={{ display: "flex" }}
            onClick={() => setSelectedIssue(null)}
          >
            <div
              className="modal-dialog modal-dialog-centered"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-content issue-detail-modal">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title">Issue Details</h5>
                    <p className="issue-detail-subtitle">Review the full issue report from staff.</p>
                  </div>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setSelectedIssue(null)}
                  ></button>
                </div>

                <div className="modal-body issue-detail-body">
                  <div className="issue-detail-top">
                    <div className="issue-detail-icon">
                      <i className="bi bi-exclamation-diamond"></i>
                    </div>
                    <span className={`task-priority ${getSeverity(selectedIssue).className}`}>
                      {getSeverity(selectedIssue).label}
                    </span>
                  </div>

                  <div className="issue-detail-grid">
                    <div className="issue-detail-item">
                      <span className="issue-detail-label">Issue Type</span>
                      <strong>{issueSummary.title}</strong>
                    </div>
                    <div className="issue-detail-item">
                      <span className="issue-detail-label">Reported By</span>
                      <strong>{issueSummary.reporter}</strong>
                    </div>
                    <div className="issue-detail-item">
                      <span className="issue-detail-label">Time</span>
                      <strong>{issueSummary.time}</strong>
                    </div>
                    <div className="issue-detail-item">
                      <span className="issue-detail-label">Table</span>
                      <strong>{issueSummary.table}</strong>
                    </div>
                  </div>

                  <div className="issue-detail-section">
                    <span className="issue-detail-label">Description</span>
                    <p>{issueSummary.description}</p>
                  </div>
                </div>

                <div className="modal-footer">
                  {setLogs ? (
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleResolveIssue}
                    >
                      Mark Resolved
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedIssue(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
