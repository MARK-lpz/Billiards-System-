import { useEffect, useState } from "react";
import "../../styles/Employee/QuickActions.css";
import { createAuditEntry } from "../../utils/audit";
import { createRemoteIssue } from "../../utils/issueApi";
import { isOpenIssue } from "../../utils/issues";
import { useNotifications } from "../../Elements/Global/useNotifications";
import ReportIssueModal from "../../Elements/Employee/ReportIssueModal";
import BorrowLogModal from "../../Elements/Employee/BorrowLogModal";
import SpareEquipmentModal from "../../Elements/Employee/SpareEquipmentModal";
import { BORROW_LOG_KEY, pruneBorrowLog, readBorrowLog } from "../../utils/borrowLog";
import {
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_TYPE_ICONS,
  describeGap,
  getEquipmentGaps,
  getIssueEquipmentId,
  getIssueTableId,
  getSpareEquipment,
  getTableEquipment,
} from "../../utils/equipment";

const tableStatusOptions = [
  {
    value: "cleaning",
    label: "Cleaning",
    icon: "bi bi-stars",
    helper: "Temporarily unavailable while staff prepare the table.",
    tone: "cleaning",
  },
  {
    value: "maintenance",
    label: "Under maintenance",
    icon: "bi bi-tools",
    helper: "Unavailable until repair or inspection is completed.",
    tone: "maintenance",
  },
  {
    value: "available",
    label: "Ready for use",
    icon: "bi bi-check-circle",
    helper: "Open for walk-ins and reservations again.",
    tone: "ready",
  },
];

// "Table 1 Cue Stick" reads as "Cue Stick" on Table 1's own card.
const shortItemName = (name = "", tableName = "") => {
  const prefix = `${tableName} `.toLowerCase();
  return tableName && name.toLowerCase().startsWith(prefix) && name.length > prefix.length
    ? name.slice(prefix.length)
    : name;
};

const formatStatus = (status) =>
  ({
    available: "Ready for use",
    occupied: "Occupied",
    reserved: "Reserved",
    cleaning: "Cleaning",
    maintenance: "Under maintenance",
  })[status] || status;

const formatPesoRate = (value) => `₱${Number(value || 0)}/hr`;

const createIssueId = () => `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const clockNow = () => new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
const currentTime = () => Date.now();

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Why a table's status cannot be changed here, or "". A running session or a
// booking would be wiped (timer, bill, reserved guest), so those are handled
// where they belong: End Session on the table card, or the booking itself.
const getStatusChangeBlock = (table) => {
  if (table.status === "occupied") return "In play. End the session on Pool Tables first.";
  if (table.status === "reserved") {
    return `Reserved${table.customer ? ` for ${table.customer}` : ""}. Check in or cancel the booking first.`;
  }
  return "";
};

export default function QuickActions({ tables = [], setTables, logs = [], setLogs, equipment = [] }) {
  const { addNotification, showToast } = useNotifications();
  // "report" (with `reportPreset`), "borrow" or "spare".
  const [modal, setModal] = useState(null);
  const [reportPreset, setReportPreset] = useState({});
  const [borrowRecords, setBorrowRecords] = useState(readBorrowLog);

  useEffect(() => {
    try {
      localStorage.setItem(BORROW_LOG_KEY, JSON.stringify(borrowRecords));
    } catch (error) {
      console.warn("Unable to keep the borrow log", error);
    }
  }, [borrowRecords]);

  const operationalTables = [...tables].sort((a, b) => Number(a.id) - Number(b.id));
  const spareEquipment = getSpareEquipment(equipment, tables);
  const openIssues = logs.filter(isOpenIssue);
  const issueContext = { tables, equipment };
  const openIssuesFor = (tableId) =>
    openIssues.filter((issue) => String(getIssueTableId(issue, issueContext)) === String(tableId));
  const reportedItemIds = new Set(openIssues.map((issue) => String(getIssueEquipmentId(issue))));
  const borrowedCount = borrowRecords.filter((record) => record.status === "borrowed").length;
  // Spares out on loan right now, by name, and who has them.
  const lentOut = new Map(
    borrowRecords
      .filter((record) => record.status === "borrowed")
      .map((record) => [String(record.itemCode || "").trim().toLowerCase(), record.borrower])
  );

  const summary = {
    ready: tables.filter((table) => table.status === "available").length,
    cleaning: tables.filter((table) => table.status === "cleaning").length,
    maintenance: tables.filter((table) => table.status === "maintenance").length,
    reports: openIssues.length,
  };

  const openReport = (preset = {}) => {
    setReportPreset(preset);
    setModal("report");
  };
  const closeModal = () => setModal(null);

  const addLog = (action, detail, extra = {}) => {
    const entry = createAuditEntry({
      id: extra.id,
      type: extra.type || "other",
      staff: "Employee",
      action,
      detail,
      entity: extra.entity || "operation",
      severity: extra.severity || "info",
      issue: extra.issue || null,
      table: extra.table || null,
      customer: extra.customer || null,
      extra,
    });
    if (setLogs) {
      setLogs((previous) => [entry, ...previous]);
    }
    addNotification({ message: `${action}: ${detail}` });
    return entry;
  };

  const handleReport = ({ type, typeLabel, table, item, description, blocksTable }) => {
    // A table someone is playing on stays occupied: taking it out of service now
    // would hide the running session and its bill. Staff mark it after the session.
    const takesTableOut = blocksTable && table.status !== "occupied";
    const nextTableStatus = takesTableOut ? "maintenance" : table?.status;

    const issueEntry = addLog(
      "Reported issue",
      `${typeLabel}${table ? ` for ${table.name}` : ""}${item ? ` (${item.name})` : ""}: ${description}`,
      {
        id: createIssueId(),
        type: "issue",
        entity: "issue",
        severity: type === "customer" ? "medium" : "high",
        issueType: typeLabel,
        issueTable: table?.name || "",
        issueTableId: table?.id ?? null,
        issueEquipmentId: item?.id ?? null,
        issueEquipmentName: item?.name || "",
        issueDescription: description,
        issue: {
          type: typeLabel,
          table: table?.name || "",
          tableId: table?.id ?? null,
          equipmentId: item?.id ?? null,
          equipmentName: item?.name || "",
          description,
        },
        tableBlocked: takesTableOut,
        table: table
          ? { id: table.id, name: table.name, previousStatus: table.status, currentStatus: nextTableStatus }
          : null,
      }
    );

    if (takesTableOut && setTables) {
      setTables((previous) =>
        previous.map((entry) => (entry.id === table.id ? { ...entry, status: "maintenance" } : entry))
      );
      addNotification({ message: `${table.name} is now under maintenance and can no longer be reserved online.` });
    }

    createRemoteIssue(issueEntry).catch((error) => {
      console.warn("Unable to send issue to the shared feed", error);
      addNotification({ tone: "error", message: "Issue saved locally, but could not reach the shared admin feed." });
    });

    closeModal();
    showToast({
      icon: "bi-send-check",
      title: "Issue reported",
      message: `${typeLabel}${item ? ` on ${item.name}` : table ? ` at ${table.name}` : ""} was sent to the admin.${
        takesTableOut ? ` ${table.name} is now under maintenance.` : ""
      }`,
    });
  };

  const handleBorrow = (details) => {
    const now = currentTime();
    const record = { id: now, ...details, status: "borrowed", borrowedAt: clockNow() };
    setBorrowRecords((previous) => [record, ...pruneBorrowLog(previous, now)]);
    addLog("Borrowed equipment", `${record.itemType} ${record.itemCode} borrowed by ${record.borrower}`, {
      type: "inventory",
      entity: "equipment",
      customer: { previous: null, current: { name: record.borrower } },
    });
    showToast({
      icon: "bi-box-arrow-up-right",
      title: "Borrow logged",
      message: `${record.itemCode} is out with ${record.borrower}.`,
    });
  };

  // A damaged return goes on to Report Issue, so the admin hears about it.
  const handleReturn = (id, { damaged = false } = {}) => {
    const record = borrowRecords.find((entry) => entry.id === id);
    if (!record || record.status !== "borrowed") return;

    const now = currentTime();
    setBorrowRecords((previous) =>
      pruneBorrowLog(
        previous.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "returned",
                returnedAt: clockNow(),
                returnedOn: now,
                returnCondition: damaged ? "damaged" : "good",
              }
            : entry
        ),
        now
      )
    );
    addLog(
      "Returned equipment",
      `${record.itemType} ${record.itemCode} returned by ${record.borrower}${damaged ? " (damaged)" : ""}`,
      {
        type: "inventory",
        entity: "equipment",
        severity: damaged ? "medium" : "info",
        customer: { previous: { name: record.borrower }, current: { name: record.borrower } },
      }
    );

    if (!damaged) {
      showToast({ icon: "bi-box-arrow-in-down-left", title: "Return logged", message: `${record.itemCode} is back at the counter.` });
      return;
    }
    const item = equipment.find((entry) => record.itemId != null && String(entry.id) === String(record.itemId));
    openReport(item ? { equipmentId: item.id, type: "equipment" } : { type: "equipment" });
    showToast({
      tone: "error",
      icon: "bi-exclamation-triangle",
      title: "Returned damaged",
      message: `Describe what happened to ${record.itemCode} so the admin can fix it.`,
    });
  };

  const handleTableStatusUpdate = (tableId, nextStatus) => {
    if (!setTables) return;

    const table = tables.find((entry) => entry.id === tableId);
    if (!table || table.status === nextStatus || getStatusChangeBlock(table)) return;

    setTables((prev) =>
      prev.map((entry) =>
        entry.id === tableId
          ? {
              ...entry,
              status: nextStatus,
              startTime: nextStatus === "occupied" ? entry.startTime : null,
              customer: nextStatus === "occupied" ? entry.customer : "",
            }
          : entry
      )
    );

    addLog("Updated table status", `${table.name || `Table ${table.id}`} marked as ${formatStatus(nextStatus)}`, {
      type: "table",
      entity: "table",
      table: {
        id: table.id,
        name: table.name || `Table ${table.id}`,
        previousStatus: table.status,
        currentStatus: nextStatus,
      },
      customer: table.customer
        ? {
            previous: { name: table.customer },
            current: nextStatus === "available" ? null : { name: table.customer },
          }
        : null,
    });
  };

  // One line per item: its state, and a flag to report it (off once reported).
  const renderItem = (item, table = null) => {
    const tableId = table?.id ?? null;
    const reported = reportedItemIds.has(String(item.id));
    const lentTo = item.spare || !table ? lentOut.get(item.name.trim().toLowerCase()) : null;
    const state = reported
      ? { label: "Reported", tone: "reported" }
      : lentTo
        ? { label: `Lent to ${lentTo}`, tone: "lent" }
        : item.status !== "active"
        ? { label: EQUIPMENT_STATUS_LABELS[item.status] || item.status, tone: "out" }
        : { label: item.condition || "good", tone: item.condition === "good" ? "good" : item.condition === "fair" ? "fair" : "out" };

    return (
      <li key={item.id} className="qa-item">
        <i className={`bi ${EQUIPMENT_TYPE_ICONS[item.type] || "bi-box-seam"} qa-item-icon`} aria-hidden="true"></i>
        <span className="qa-item-name" title={`${item.name} (${item.type})`}>
          {shortItemName(item.name, table?.name)}
        </span>
        <span className={`qa-item-state qa-item-state--${state.tone}`}>{state.label}</span>
        <button
          type="button"
          className="qa-item-report"
          onClick={() => openReport({ tableId, equipmentId: item.id, type: "equipment" })}
          disabled={reported}
          aria-label={`Report a problem with ${item.name}`}
          title={reported ? "Already reported; the admin has it." : "Report a problem with this item"}
        >
          <i className="bi bi-flag-fill"></i>
        </button>
      </li>
    );
  };

  return (
    <div className="qa-page">
      <div className="qa-page-header">
        <div>
          <h1 className="qa-title">Actions</h1>
          <p className="qa-subtitle">Table readiness, each table&apos;s dedicated equipment, and issue reports</p>
        </div>
        <div className="qa-header-actions">
          <button type="button" className="qa-action-btn qa-action-btn--primary" onClick={() => openReport()}>
            <i className="bi bi-exclamation-diamond"></i>
            Report Issue
          </button>
          <button type="button" className="qa-action-btn" onClick={() => setModal("borrow")}>
            <i className="bi bi-arrow-left-right"></i>
            Borrow / Return
            {borrowedCount > 0 && <span className="qa-action-count">{borrowedCount} out</span>}
          </button>
          <button type="button" className="qa-action-btn" onClick={() => setModal("spare")}>
            <i className="bi bi-box-seam"></i>
            Spare Equipment
            <span className="qa-action-count qa-action-count--muted">{spareEquipment.length}</span>
          </button>
        </div>
      </div>

      <div className="qa-summary qa-summary--page">
        <div className="qa-summary-pill qa-summary-pill--ready">
          <span className="qa-summary-value">{summary.ready}</span>
          <span className="qa-summary-label">Ready</span>
        </div>
        <div className="qa-summary-pill qa-summary-pill--cleaning">
          <span className="qa-summary-value">{summary.cleaning}</span>
          <span className="qa-summary-label">Cleaning</span>
        </div>
        <div className="qa-summary-pill qa-summary-pill--maintenance">
          <span className="qa-summary-value">{summary.maintenance}</span>
          <span className="qa-summary-label">Maintenance</span>
        </div>
        <div className="qa-summary-pill qa-summary-pill--reports">
          <span className="qa-summary-value">{summary.reports}</span>
          <span className="qa-summary-label">Open Reports</span>
        </div>
      </div>

      <div className="qa-card">
        <div className="qa-module-header">
          <div>
            <div className="qa-module-title">Tables &amp; Equipment</div>
            <p className="qa-module-subtitle">
              Set each table&apos;s status, check the equipment dedicated to it, and report anything wrong.
            </p>
          </div>
        </div>

        <div className="qa-table-grid">
          {operationalTables.map((table) => {
            const statusBlock = getStatusChangeBlock(table);
            const items = getTableEquipment(equipment, table.id);
            const gaps = getEquipmentGaps(items);
            const reports = openIssuesFor(table.id);

            return (
              <div key={table.id} className={`qa-table-card qa-table-card--${table.status}`}>
                <div className="qa-table-card-top">
                  <div className="qa-table-heading">
                    <span className="qa-table-name">{table.name || `Table ${table.id}`}</span>
                    <span className="qa-table-meta" title={table.customer || undefined}>
                      {formatPesoRate(table.rate)}
                      {table.customer ? ` • ${table.customer}` : ""}
                    </span>
                  </div>

                  <span className={`qa-badge qa-badge--${table.status}`}>{formatStatus(table.status)}</span>
                </div>

                <div className="qa-status-actions" role="group" aria-label={`Set ${table.name || `Table ${table.id}`} status`}>
                  {tableStatusOptions.map((option) => {
                    const isActive = table.status === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`qa-status-btn qa-status-btn--${option.tone} ${isActive ? "is-active" : ""}`}
                        onClick={() => handleTableStatusUpdate(table.id, option.value)}
                        disabled={isActive || Boolean(statusBlock)}
                        aria-pressed={isActive}
                        title={statusBlock || option.helper}
                      >
                        <i className={option.icon} aria-hidden="true"></i>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>

                {statusBlock && (
                  <div className="qa-status-note form-blocked-note">
                    <i className="bi bi-lock"></i>
                    <span>{statusBlock}</span>
                  </div>
                )}

                <div className="qa-equipment-block">
                  <div className="qa-equipment-block-head">
                    <span>
                      <i className="bi bi-tools" aria-hidden="true"></i>
                      Equipment
                    </span>
                    {reports.length > 0 && (
                      <span className="qa-open-reports">{plural(reports.length, "open report")}</span>
                    )}
                  </div>

                  {items.length ? (
                    <ul className="qa-item-list">{items.map((item) => renderItem(item, table))}</ul>
                  ) : (
                    <div className="qa-item-gap">
                      <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
                      No equipment yet. Tell the admin.
                    </div>
                  )}

                  {items.length > 0 &&
                    gaps.map((gap) => (
                      <div key={gap.type} className="qa-item-gap">
                        <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
                        {describeGap(gap)}. Tell the admin.
                      </div>
                    ))}
                </div>

                <button
                  type="button"
                  className="qa-report-btn"
                  onClick={() => openReport({ tableId: table.id })}
                  title={`Report a problem at ${table.name || `Table ${table.id}`}`}
                >
                  <i className="bi bi-exclamation-diamond" aria-hidden="true"></i>
                  Report Issue
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {modal === "spare" && (
        <SpareEquipmentModal
          tables={operationalTables}
          equipment={equipment}
          renderItem={renderItem}
          onBorrow={() => setModal("borrow")}
          onClose={closeModal}
        />
      )}

      {modal === "report" && (
        <ReportIssueModal
          tables={operationalTables}
          equipment={equipment}
          openIssues={openIssues}
          preset={reportPreset}
          onSubmit={handleReport}
          onClose={closeModal}
        />
      )}

      {modal === "borrow" && (
        <BorrowLogModal
          records={borrowRecords}
          equipment={equipment}
          tables={tables}
          reportedItemIds={reportedItemIds}
          onBorrow={handleBorrow}
          onReturn={handleReturn}
          onReportIssue={() => openReport()}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
