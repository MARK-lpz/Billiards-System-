/**
 * The Audit Trail's filters and levels, shared by the page (its list, a page
 * at a time) and the printable report (AuditReportModal), so both name and
 * count the same events the same way.
 */
import { inPeriod } from "./salesReport";

const touchesCustomer = (log) => Boolean(log.customer?.previous || log.customer?.current);

export const AUDIT_FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "customer", label: "Customer Changes", match: touchesCustomer },
  { id: "employee", label: "Employee Activity", match: (log) => log.staff === "Employee" },
  { id: "reservation", label: "Reservations", match: (log) => log.type === "reservation" },
  { id: "table", label: "Tables", match: (log) => log.type === "table" },
  { id: "issue", label: "Issues", match: (log) => log.type === "issue" },
];

const findFilter = (id) => AUDIT_FILTERS.find((filter) => filter.id === id) || AUDIT_FILTERS[0];

export const auditFilterLabel = (id) => findFilter(id).label;

export const filterAuditLogs = (logs = [], id = "all") => logs.filter(findFilter(id).match);

export const countAuditLogs = (logs = []) => ({
  total: logs.length,
  issues: logs.filter((log) => log.type === "issue").length,
  reservations: logs.filter((log) => log.type === "reservation").length,
  customer: logs.filter(touchesCustomer).length,
  employee: logs.filter((log) => log.staff === "Employee").length,
});

const timeOf = (log) => {
  const time = new Date(log.timestamp).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/** Newest first, as the page lists them (issue reports from the server are mixed in by time). */
export const sortNewestFirst = (logs = []) => [...logs].sort((first, second) => timeOf(second) - timeOf(first));

/** The period's events, oldest first, the way a report reads. */
export const getPeriodAuditLogs = (logs = [], period) =>
  logs.filter((log) => inPeriod(String(log.date || "").slice(0, 10), period)).sort((first, second) => timeOf(first) - timeOf(second));

/** The level shown on an event: a rejected booking reads "reject", the rest their own severity. */
export const auditLevel = (log) => {
  const action = String(log.action || "").toLowerCase();
  const status = String(log.reservation?.currentStatus || log.reservation?.status || "").toLowerCase();
  if (log.type === "reservation" && (action.includes("rejected") || status === "rejected")) return "reject";
  return log.severity || "info";
};

const TYPE_LABELS = { auth: "Sign-in" };

/** "Sign-in", "Reservation", "Equipment"... */
export const auditTypeLabel = (type) => {
  const key = String(type || "other");
  return TYPE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
};

/** "Oct 18, 2026" from the event's own day. */
export const auditDayLabel = (date) => {
  const day = new Date(`${String(date || "").slice(0, 10)}T00:00:00`);
  return Number.isNaN(day.getTime())
    ? date || ""
    : day.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const countBy = (logs, keyOf) => {
  const counts = new Map();
  logs.forEach((log) => {
    const key = keyOf(log);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].sort((first, second) => second[1] - first[1] || String(first[0]).localeCompare(String(second[0])));
};

/** The report's totals: how many events, and how many of each kind, by whom and at which level. */
export const summarizeAuditLogs = (logs = []) => ({
  total: logs.length,
  byType: countBy(logs, (log) => auditTypeLabel(log.type)),
  byStaff: countBy(logs, (log) => log.staff || "System"),
  byLevel: countBy(logs, auditLevel),
});
