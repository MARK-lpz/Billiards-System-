const ISSUE_ACTION_KEYWORDS = ["reported issue", "reported damaged equipment", "customer complaint"];

export const isIssueEntry = (entry) => {
  const action = `${entry?.action || ""}`.toLowerCase();
  const detail = `${entry?.detail || ""}`.toLowerCase();

  if (action.includes("updated table status")) return false;
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
  time: issue?.time || "Just now",
  table: issue?.issue?.table || issue?.issueTable || "Not specified",
  equipmentId: issue?.issue?.equipmentId || issue?.issueEquipmentId || null,
  equipmentName: issue?.issue?.equipmentName || issue?.issueEquipmentName || "",
  description: issue?.issue?.description || issue?.issueDescription || issue?.detail || "No details provided.",
});
