import { useMemo, useState } from "react";
import "../../styles/Admin/Audit.css";
import AuditDetailModal from "../../Elements/Admin/AuditDetailModal";
import AuditLogList from "../../Elements/Admin/AuditLogList";
import AuditTrailStats from "../../Elements/Admin/AuditTrailStats";
import { normalizeAuditLogs } from "../../utils/audit";

export default function AuditTrail({ logs = [] }) {
  const normalizedLogs = useMemo(() => normalizeAuditLogs(logs), [logs]);
  const [filter, setFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState(null);

  const counts = useMemo(
    () => ({
      total: normalizedLogs.length,
      issues: normalizedLogs.filter((log) => log.type === "issue").length,
      reservations: normalizedLogs.filter((log) => log.type === "reservation").length,
      customer: normalizedLogs.filter((log) => log.customer?.previous || log.customer?.current).length,
      employee: normalizedLogs.filter((log) => log.staff === "Employee").length,
    }),
    [normalizedLogs]
  );

  const filteredLogs = useMemo(() => {
    if (filter === "all") return normalizedLogs;
    if (filter === "customer") {
      return normalizedLogs.filter((log) => log.customer?.previous || log.customer?.current);
    }
    if (filter === "employee") {
      return normalizedLogs.filter((log) => log.staff === "Employee");
    }
    return normalizedLogs.filter((log) => log.type === filter);
  }, [filter, normalizedLogs]);

  const filters = useMemo(
    () => [
      { id: "all", label: "All", count: counts.total },
      { id: "customer", label: "Customer Changes", count: counts.customer },
      { id: "employee", label: "Employee Activity", count: counts.employee },
      { id: "reservation", label: "Reservations", count: counts.reservations },
      {
        id: "table",
        label: "Tables",
        count: normalizedLogs.filter((log) => log.type === "table").length,
      },
      { id: "issue", label: "Issues", count: counts.issues },
    ],
    [counts, normalizedLogs]
  );

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
        logs={filteredLogs}
        onFilterChange={setFilter}
        onSelectLog={setSelectedLog}
      />

      <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
