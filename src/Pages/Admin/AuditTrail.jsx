import { useMemo, useState } from "react";
import "../../styles/Admin/Audit.css";
import AuditDetailModal from "../../Elements/Admin/AuditDetailModal";
import AuditLogList from "../../Elements/Admin/AuditLogList";
import AuditReportModal from "../../Elements/Admin/AuditReportModal";
import AuditTrailStats from "../../Elements/Admin/AuditTrailStats";
import AuditSearchBox from "../../Elements/Admin/AuditSearchBox";
import TableHistory from "../../Elements/Global/TableHistory";
import useClock from "../../Elements/Global/useClock";
import { normalizeAuditLogs } from "../../utils/audit";
import { AUDIT_FILTERS, countAuditLogs, filterAuditLogs, sortNewestFirst } from "../../utils/auditReport";
import { parseAuditQuery, searchAuditLogs } from "../../utils/auditSearch";
import { PAGE_SIZE, paginate } from "../../utils/pagination";

const VIEWS = [
  { id: "log", label: "Activity Log", icon: "bi-list-check" },
  { id: "tables", label: "Table History", icon: "bi-grid-3x3-gap" },
];

/**
 * Everything staff did, newest first: searched (utils/auditSearch.js), then
 * narrowed by a filter, a page at a time. Table History shows each table's
 * sales, orders, reservations and its own events, by day.
 */
export default function AuditTrail({ logs = [], tables = [], reservations = [], tableCharges = [] }) {
  const normalizedLogs = useMemo(() => sortNewestFirst(normalizeAuditLogs(logs)), [logs]);
  // "Today" and "this week" in the search follow the clock.
  const now = useClock(60000);
  const [view, setView] = useState("log");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  const counts = useMemo(() => countAuditLogs(normalizedLogs), [normalizedLogs]);
  const query = useMemo(() => parseAuditQuery(search, new Date(now)), [search, now]);
  const searchedLogs = useMemo(() => searchAuditLogs(normalizedLogs, query), [normalizedLogs, query]);

  const filteredLogs = useMemo(() => filterAuditLogs(searchedLogs, filter), [filter, searchedLogs]);

  const filters = useMemo(
    () => AUDIT_FILTERS.map(({ id, label }) => ({ id, label, count: filterAuditLogs(searchedLogs, id).length })),
    [searchedLogs]
  );

  // A page at a time; another filter or search starts again at its first page.
  const { pageCount, currentPage, pageStart, items: pageLogs } = paginate(filteredLogs, page);
  const changeFilter = (next) => {
    setFilter(next);
    setPage(1);
  };
  const changeSearch = (next) => {
    setSearch(next);
    setPage(1);
  };
  // A card's number counts the whole log, so it opens the Activity Log
  // without a search, and the list holds as many events as the card says.
  const showStat = (next) => {
    setView("log");
    setSearch("");
    changeFilter(next);
  };

  return (
    <div className="audit-trail-container">
      <div className="audit-trail-header">
        <h1 className="audit-trail-title">Audit Trail</h1>
        <p className="audit-trail-subtitle">
          Record and track all admin and employee activity across the system
        </p>
      </div>

      <AuditTrailStats counts={counts} active={view === "log" ? filter : null} onSelect={showStat} />

      <div className="audit-views" role="tablist" aria-label="Audit Trail">
        {VIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={view === entry.id}
            className={`audit-view-btn${view === entry.id ? " is-active" : ""}`}
            onClick={() => setView(entry.id)}
          >
            <i className={`bi ${entry.icon}`} aria-hidden="true"></i>
            {entry.label}
          </button>
        ))}
      </div>

      {view === "tables" ? (
        <TableHistory
          tables={tables}
          reservations={reservations}
          tableCharges={tableCharges}
          now={now}
          logs={logs}
          onOpenLog={setSelectedLog}
        />
      ) : (
        <AuditLogList
          filter={filter}
          filters={filters}
          logs={pageLogs}
          search={<AuditSearchBox value={search} onChange={changeSearch} query={query} count={searchedLogs.length} />}
          highlight={query.highlight}
          pagination={{
            page: currentPage,
            pageCount,
            pageStart,
            pageSize: PAGE_SIZE,
            total: filteredLogs.length,
            goToPage: (next) => setPage(Math.min(Math.max(1, next), pageCount)),
          }}
          onFilterChange={changeFilter}
          onSelectLog={setSelectedLog}
          onPrint={() => setReportOpen(true)}
        />
      )}

      <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />

      {/* The report prints what the search found, when there is a search. */}
      {reportOpen && <AuditReportModal logs={searchedLogs} initialFilter={filter} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
