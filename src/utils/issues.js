const ISSUE_ACTION_KEYWORDS = ["reported issue", "reported damaged equipment", "customer complaint"];

export const isIssueEntry = (entry) => {
  const action = `${entry?.action || ""}`.toLowerCase();
  const detail = `${entry?.detail || ""}`.toLowerCase();

  // Status changes and the borrow log are not reports, even when one mentions damage
  // ("... returned by Ana (damaged)"); a damaged return is reported through Report Issue.
  if (["updated table status", "borrowed equipment", "returned equipment"].some((logged) => action.includes(logged))) {
    return false;
  }
  if (ISSUE_ACTION_KEYWORDS.some((keyword) => action.includes(keyword))) return true;

  return ["issue", "damage", "complaint", "malfunction"].some(
    (keyword) => action.includes(keyword) || detail.includes(keyword)
  );
};

export const isResolvedEntry = (entry) =>
  entry?.issueStatus === "resolved" || entry?.issue?.status === "resolved" || Boolean(entry?.resolvedAt);

export const isOpenIssue = (entry) => isIssueEntry(entry) && !isResolvedEntry(entry);

export const isResolvedIssue = (entry) => isIssueEntry(entry) && isResolvedEntry(entry);

export const getIssueSummary = (issue) => ({
  type: issue?.issue?.type || issue?.issueType || issue?.action || "Issue Report",
  reporter: issue?.staff || "Employee",
  // The date as well as the time once it is known ("Oct 12, 2026, 10:32 PM").
  time: formatReportDate(issue?.timestamp || issue?.createdAt) || issue?.time || "Just now",
  table: issue?.issue?.table || issue?.issueTable || "Not specified",
  equipmentId: issue?.issue?.equipmentId || issue?.issueEquipmentId || null,
  equipmentName: issue?.issue?.equipmentName || issue?.issueEquipmentName || "",
  description: issue?.issue?.description || issue?.issueDescription || issue?.detail || "No details provided.",
});

// ---------------------------------------------------------------- Clearing out old reports

// Resolved reports stay as history for this long, then are removed (issues.php deletes
// them on the server too). Open reports stay until someone resolves them.
export const RESOLVED_REPORT_RETENTION_MONTHS = 3;

// A server DATETIME ("2026-10-13 14:05:00") or ISO time, in milliseconds, or null.
const toMillis = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value).replace(" ", "T")).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

/** When a resolved report was resolved: as the server or this device recorded it. */
export const getResolvedAt = (entry) =>
  toMillis(entry?.resolvedAt) ?? toMillis(entry?.updatedAt) ?? toMillis(entry?.timestamp);

/** When a resolved report leaves the history, or null if it is open (or has no date). */
export const getReportRemovalDate = (entry) => {
  const resolvedAt = isResolvedIssue(entry) ? getResolvedAt(entry) : null;
  if (resolvedAt === null) return null;
  const removal = new Date(resolvedAt);
  removal.setMonth(removal.getMonth() + RESOLVED_REPORT_RETENTION_MONTHS);
  return removal;
};

/** True for a resolved report past its time in the history. */
export const isExpiredReport = (entry, now = Date.now()) => {
  const removal = getReportRemovalDate(entry);
  return removal !== null && removal.getTime() <= now;
};

/** "Oct 12, 2026, 10:32 PM" for a report's own times, or "" without one. */
export const formatReportDate = (value) => {
  const millis = typeof value === "number" ? value : toMillis(value);
  return millis === null
    ? ""
    : new Date(millis).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};
