import { useMemo, useState } from "react";
import "../../styles/Admin/Audit.css";
import AuditDetailModal from "../../Elements/Admin/AuditDetailModal";
import AuditLogList from "../../Elements/Admin/AuditLogList";
import AuditReportModal from "../../Elements/Admin/AuditReportModal";
import AuditTrailStats from "../../Elements/Admin/AuditTrailStats";
import { normalizeAuditLogs } from "../../utils/audit";
import { AUDIT_FILTERS, countAuditLogs, filterAuditLogs, sortNewestFirst } from "../../utils/auditReport";
import { PAGE_SIZE, paginate } from "../../utils/pagination";

export default function AuditTrail({ logs = [] }) {
  const normalizedLogs = useMemo(() => sortNewestFirst(normalizeAuditLogs(logs)), [logs]);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  const counts = useMemo(() => countAuditLogs(normalizedLogs), [normalizedLogs]);

  const filteredLogs = useMemo(() => filterAuditLogs(normalizedLogs, filter), [filter, normalizedLogs]);

  const filters = useMemo(
    () => AUDIT_FILTERS.map(({ id, label }) => ({ id, label, count: filterAuditLogs(normalizedLogs, id).length })),
    [normalizedLogs]
  );

  // A page at a time; another filter starts again at its first page.
  const { pageCount, currentPage, pageStart, items: pageLogs } = paginate(filteredLogs, page);
  const changeFilter = (next) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <div className="audit-trail-container">
      <div className="audit-trail-header">
        <h1 className="audit-trail-title">Audit Trail</h1>
        <p className="audit-trail-subtitle">
          Record and track all admin and employee activity across the system
        </p>
      </div>

      <AuditTrailStats counts={counts} />

      <AuditLogList
        filter={filter}
        filters={filters}
        logs={pageLogs}
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

      <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />

      {reportOpen && <AuditReportModal logs={normalizedLogs} initialFilter={filter} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
