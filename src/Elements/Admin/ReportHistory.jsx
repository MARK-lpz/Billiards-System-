import { useEffect, useState } from "react";
import Pagination from "../Global/Pagination";
import useClock from "../Global/useClock";
import { fetchResolvedIssues } from "../../utils/issueApi";
import {
  RESOLVED_REPORT_RETENTION_MONTHS,
  formatReportDate,
  getIssueSummary,
  getReportRemovalDate,
  getResolvedAt,
} from "../../utils/issues";

const PAGE_SIZE = 15;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const sameId = (first, second) => String(first ?? "") === String(second ?? "");

// "week" for the last 7 days, then "2026-10" for each month before that.
const groupKeyOf = (issue, now) => {
  const resolvedAt = getResolvedAt(issue);
  if (resolvedAt === null) return "undated";
  if (now - resolvedAt < WEEK_MS) return "week";
  const date = new Date(resolvedAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const groupLabel = (key) => {
  if (key === "week") return "This week";
  if (key === "undated") return "Undated";
  return new Date(`${key}-01T00:00:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
};

const issueTableId = (issue) => issue?.issue?.tableId ?? issue?.issueTableId ?? null;

const shortDate = (date) => date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

// The same page the server would give, worked out from the reports on this
// device; used when the server cannot be reached.
const pageFromDevice = ({ reports, page, tableId, type, now }) => {
  const matching = reports
    .filter((issue) => tableId === "" || sameId(issueTableId(issue), tableId))
    .filter((issue) => !type || getIssueSummary(issue).type === type)
    .sort((first, second) => (getResolvedAt(second) ?? 0) - (getResolvedAt(first) ?? 0));
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const shownPage = Math.min(page, pageCount);
  const groupCounts = {};
  matching.forEach((issue) => {
    const key = groupKeyOf(issue, now);
    groupCounts[key] = (groupCounts[key] || 0) + 1;
  });
  return {
    issues: matching.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE),
    total: matching.length,
    page: shownPage,
    perPage: PAGE_SIZE,
    pageCount,
    groupCounts,
    types: [...new Set(reports.map((issue) => getIssueSummary(issue).type))].sort(),
  };
};

/**
 * Report History: resolved reports as a compact list, grouped by when they were
 * resolved (this week, then month by month), a page at a time, with filters for
 * the table and the kind of report. The server keeps them for a set number of
 * months; `localReports` (this device's copy) stands in if it cannot be reached.
 * `refreshKey` changes whenever a report is resolved, so the list reloads.
 */
export default function ReportHistory({ tables = [], localReports = [], refreshKey, onView, onTotal }) {
  const now = useClock(60000);
  const [page, setPage] = useState(1);
  const [tableId, setTableId] = useState("");
  const [type, setType] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
  // { key, status: "done" | "error", data } for the latest request answered.
  const [result, setResult] = useState(null);

  const requestKey = JSON.stringify({ page, tableId, type, refreshKey });

  useEffect(() => {
    let cancelled = false;
    fetchResolvedIssues({ page, perPage: PAGE_SIZE, tableId, type })
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, status: "done", data });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, status: "error", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [page, tableId, type, requestKey]);

  const offline = result?.status === "error";
  const data = offline ? pageFromDevice({ reports: localReports, page, tableId, type, now }) : result?.data || null;
  const loading = !result || result.key !== requestKey;
  const total = data?.total ?? null;

  useEffect(() => {
    if (total !== null) onTotal?.(total);
  }, [total, onTotal]);

  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const toggleGroup = (key) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Rows on this page, grouped in order of when they were resolved.
  const groups = [];
  (data?.issues || []).forEach((issue) => {
    const key = groupKeyOf(issue, now);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.issues.push(issue);
    else groups.push({ key, issues: [issue] });
  });

  const filtered = tableId !== "" || Boolean(type);
  const tableOptions = [...tables].sort((first, second) => Number(first.id) - Number(second.id));

  return (
    <div className="report-history">
      <p className="equipment-retention-note">
        <i className="bi bi-info-circle" aria-hidden="true"></i>
        Resolved reports stay here for {RESOLVED_REPORT_RETENTION_MONTHS} months, then are removed automatically. Open
        reports stay until they are resolved.
      </p>

      <div className="report-history-filters">
        <label>
          <span>Table</span>
          <select className="report-history-select" value={tableId} onChange={changeFilter(setTableId)} aria-label="Filter by table">
            <option value="">All tables</option>
            {tableOptions.map((table) => (
              <option key={table.id} value={String(table.id)}>
                {table.name || `Table ${table.id}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Report</span>
          <select className="report-history-select" value={type} onChange={changeFilter(setType)} aria-label="Filter by kind of report">
            <option value="">All kinds</option>
            {(data?.types || []).map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            className="report-history-clear"
            onClick={() => {
              setTableId("");
              setType("");
              setPage(1);
            }}
          >
            <i className="bi bi-x-circle"></i> Clear filters
          </button>
        )}
        {loading && data && (
          <span className="report-history-loading" role="status">
            <i className="bi bi-arrow-repeat"></i> Updating…
          </span>
        )}
      </div>

      {offline && (
        <p className="report-history-offline" role="status">
          <i className="bi bi-wifi-off" aria-hidden="true"></i>
          Couldn&apos;t reach the server, so this shows the reports saved on this device.
        </p>
      )}

      {!data ? (
        <div className="reported-issues-empty">
          <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
          <strong>Loading report history…</strong>
        </div>
      ) : data.total === 0 ? (
        <div className="reported-issues-empty">
          <i className="bi bi-clock-history" aria-hidden="true"></i>
          <strong>{filtered ? "No resolved reports match these filters" : "No resolved reports"}</strong>
          <span>
            {filtered
              ? "Try another table or kind of report."
              : `Reports you resolve are kept here for ${RESOLVED_REPORT_RETENTION_MONTHS} months.`}
          </span>
        </div>
      ) : (
        <>
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            const count = Number(data.groupCounts?.[group.key]) || group.issues.length;
            return (
              <section key={group.key} className="report-history-group">
                <button
                  type="button"
                  className="report-history-group-head"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!isCollapsed}
                >
                  <i className={`bi ${isCollapsed ? "bi-chevron-right" : "bi-chevron-down"}`} aria-hidden="true"></i>
                  <strong>{groupLabel(group.key)}</strong>
                  <span>
                    {count} {count === 1 ? "report" : "reports"}
                  </span>
                </button>

                {!isCollapsed && (
                  <table className="report-history-table">
                    <thead>
                      <tr>
                        <th scope="col">Resolved</th>
                        <th scope="col">Report</th>
                        <th scope="col">Table</th>
                        <th scope="col">Equipment</th>
                        <th scope="col">Reported</th>
                        <th scope="col">Removed</th>
                        <th scope="col" aria-label="Actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.issues.map((issue) => {
                        const summary = getIssueSummary(issue);
                        const removal = getReportRemovalDate(issue);
                        return (
                          <tr key={issue.id}>
                            <td data-label="Resolved">
                              <strong>{formatReportDate(getResolvedAt(issue)) || "—"}</strong>
                              {issue.resolvedBy && <small>by {issue.resolvedBy}</small>}
                            </td>
                            <td data-label="Report" className="report-history-report">
                              <strong>{summary.type}</strong>
                              <small title={summary.description}>{summary.description}</small>
                            </td>
                            <td data-label="Table">{summary.table}</td>
                            <td data-label="Equipment">{summary.equipmentName || "—"}</td>
                            <td data-label="Reported">
                              {summary.time}
                              <small>by {summary.reporter}</small>
                            </td>
                            <td data-label="Removed">{removal ? shortDate(removal) : "—"}</td>
                            <td className="report-history-actions">
                              <button type="button" className="report-history-view" onClick={() => onView(issue)}>
                                <i className="bi bi-eye"></i> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}

          <Pagination
            page={data.page}
            pageCount={data.pageCount}
            pageStart={(data.page - 1) * data.perPage}
            pageSize={data.perPage}
            total={data.total}
            goToPage={(next) => setPage(Math.max(1, Math.min(next, data.pageCount)))}
          />
        </>
      )}
    </div>
  );
}
