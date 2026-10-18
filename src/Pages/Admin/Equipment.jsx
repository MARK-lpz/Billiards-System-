import { useEffect, useMemo, useState } from "react";
import "../../styles/Admin/Equipments.css";
import EquipmentModal from "../../Elements/Admin/EquipmentModal";
import DeleteEquipmentModal from "../../Elements/Admin/DeleteEquipmentModal";
import ReplaceEquipmentModal from "../../Elements/Admin/ReplaceEquipmentModal";
import EquipmentHistory from "../../Elements/Admin/EquipmentHistory";
import { useNotifications } from "../../Elements/Global/useNotifications";
import useClock from "../../Elements/Global/useClock";
import { resolveRemoteIssue } from "../../utils/issueApi";
import { saveEquipmentHistory } from "../../utils/equipmentApi";
import { confirmRemoval } from "../../utils/listSync";
import { getSignedInUser } from "../../utils/session";
import ReportHistory from "../../Elements/Admin/ReportHistory";
import {
  getResolvedAt,
  getIssueSummary,
  isExpiredReport,
  isOpenIssue,
  isResolvedEntry,
  isResolvedIssue,
} from "../../utils/issues";
import { getEquipmentErrors } from "../../utils/formValidation";
import {
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_TYPE_ICONS,
  REQUIRED_TABLE_EQUIPMENT,
  describeGap,
  formatEquipmentDate,
  getEquipmentGaps,
  getEquipmentTable,
  getIssueEquipmentId,
  getIssueTableId,
  getTableEquipment,
  getTableSpares,
  getUnassignedSpares,
  isRemovableEquipment,
  suggestEquipmentName,
} from "../../utils/equipment";

const todayString = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const resolvedTimestamp = () => new Date().toISOString();

// Who is resolving a report, kept with it for the history.
const currentResolver = () => getSignedInUser()?.username || "Admin";

const emptyEquipmentForm = {
  name: "",
  type: "Cue Stick",
  tableId: null,
  spare: false,
  condition: "good",
  previousMaintenance: "",
  lastMaintenance: "",
  status: "active",
};

const TABLE_STATUS_LABELS = {
  available: "Ready for use",
  occupied: "Occupied",
  reserved: "Reserved",
  cleaning: "Cleaning",
  maintenance: "Under maintenance",
};

const condIcon = {
  good: "bi-check-circle-fill",
  fair: "bi-exclamation-triangle-fill",
  damaged: "bi-x-circle-fill",
};

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default function Equipment({
  equipment,
  setEquipment,
  tables = [],
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
  // "tables": equipment and open reports, table by table. "spares": spares given to no table.
  // "history": resolved reports. "removed": equipment deleted or replaced.
  const [view, setView] = useState("tables");
  // null shows everything; a status, or "reports" for tables with an open report.
  const [filter, setFilter] = useState(null);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [sideNotice, setSideNotice] = useState(null);
  // Broken items waiting on "are you sure?" before they are deleted: one, or several from Select.
  const [deleteTargets, setDeleteTargets] = useState(null);
  // The item for replacement whose new one is being entered.
  const [replaceTarget, setReplaceTarget] = useState(null);
  // Select mode: tick several broken items, then delete them together.
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // How many items the Removed list holds once it has loaded; bumped to reload it.
  const [removedTotal, setRemovedTotal] = useState(null);
  const [removedKey, setRemovedKey] = useState(0);

  // An issue opened from another screen shows straight away, with no effect needed.
  const activeIssue = issueModal ?? selectedIssue ?? null;

  const reportedIssues = useMemo(
    () => logs.filter(isOpenIssue).sort((a, b) => Number(b.id || 0) - Number(a.id || 0)),
    [logs]
  );
  // Resolved reports still within their months as history, the latest resolved first.
  // How many resolved reports the server holds, once Report History has loaded.
  const [historyTotal, setHistoryTotal] = useState(null);
  const now = useClock(60000);
  const resolvedIssues = useMemo(
    () =>
      logs
        .filter((entry) => isResolvedIssue(entry) && !isExpiredReport(entry, now))
        .sort((a, b) => (getResolvedAt(b) ?? 0) - (getResolvedAt(a) ?? 0)),
    [logs, now]
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

  const openIssue = (issue, resolveNow = false) => {
    setConfirmResolve(resolveNow);
    setIssueModal(issue);
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
              resolvedBy: currentResolver(),
              issue: entry.issue ? { ...entry.issue, status: "resolved" } : { status: "resolved" },
            }
          : entry
      )
    );
  };

  const syncRemoteResolution = (issue) => {
    if (!issue?.remoteIssue) return;

    resolveRemoteIssue(issue.id, currentResolver()).catch((error) => {
      console.warn("Unable to resolve shared issue", error);
      addNotification({ tone: "error", message: "The issue was resolved locally but could not update the shared feed." });
    });
  };

  // The page's own notice says it; a toast on top would say it twice.
  const announce = (title, message) => {
    setSideNotice({ title, message });
  };

  const completeMaintenance = (id, relatedIssue = null) => {
    const equipmentItem = equipment.find((item) => String(item.id) === String(id));

    setEquipment((prev) =>
      prev.map((item) =>
        String(item.id) === String(id)
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

    announce(
      "Problem Resolved",
      relatedIssue
        ? `Problem resolved: ${getIssueSummary(relatedIssue).type}.`
        : `${equipmentItem?.name || "Equipment"} maintenance completed.`
    );
    closeIssueModal();
  };

  const resolveIssue = () => {
    if (!activeIssue || !setLogs) return;

    markLogResolved(activeIssue.id);
    syncRemoteResolution(activeIssue);
    announce("Problem Resolved", `Problem resolved: ${getIssueSummary(activeIssue).type}.`);
    closeIssueModal();
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

  // Back in service after a repair, with the service date logged.
  const markRepaired = (id) => {
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

    announce("Repair Completed", `${item?.name || "Equipment"} was repaired and is back in service.`);
  };

  const openEquipmentForm = (item) => {
    setForm({ ...emptyEquipmentForm, ...item, tableId: item.tableId ?? null, spare: Boolean(item.spare) });
    setEditId(item.id);
    setModal("form");
  };

  // A new item, already set to the table (and type) it is being added for, in use or as a spare.
  // `pool` is the list its suggested name must not repeat (without items just deleted).
  const openNewEquipment = ({ table = null, type = "Cue Stick", spare = false, pool = equipment } = {}) => {
    setForm({
      ...emptyEquipmentForm,
      type,
      tableId: table ? table.id : null,
      spare: Boolean(table) && spare,
      name: table ? suggestEquipmentName({ table, type, equipment: pool, spare }) : "",
    });
    setEditId(null);
    setModal("form");
  };

  // What is wrong with the open Register / Edit form, if anything.
  const equipmentErrors =
    modal === "form" ? getEquipmentErrors({ form, equipment, editId, today: todayString(), tables }) : {};

  const save = () => {
    if (Object.keys(equipmentErrors).length) return;
    const table = tables.find((entry) => String(entry.id) === String(form.tableId)) || null;
    const spare = Boolean(table) && Boolean(form.spare);
    const cleaned = { ...form, name: form.name.trim(), tableId: table ? table.id : null, spare };
    const where = table ? (spare ? ` as a spare for ${table.name}` : ` for ${table.name}`) : " as an unassigned spare";
    if (editId) {
      // Taken off its table, it leaves By Table, so say on screen where it went.
      const wasOnTable = Boolean(getEquipmentTable(equipment.find((item) => item.id === editId), tables));
      setEquipment((prev) => prev.map((item) => (item.id === editId ? { ...item, ...cleaned } : item)));
      if (wasOnTable && !table) {
        announce("Moved to Unassigned", `${cleaned.name} is now an unassigned spare, listed under the Unassigned tab.`);
      } else {
        addNotification({ message: `${cleaned.name} equipment details updated.` });
      }
    } else {
      setEquipment((prev) => [...prev, { ...cleaned, id: Date.now() }]);
      if (table) addNotification({ message: `${cleaned.name} registered${where}.` });
      else announce("Spare Registered", `${cleaned.name} registered${where}, listed under the Unassigned tab.`);
    }
    setModal(null);
    setEditId(null);
  };

  const stats = {
    active: equipment.filter((item) => item.status === "active").length,
    repair: equipment.filter((item) => item.status === "repair").length,
    replacement: equipment.filter((item) => item.status === "replacement").length,
  };

  const issueContext = { tables, equipment };
  const issueForItem = (item) =>
    reportedIssues.find((issue) => String(getIssueEquipmentId(issue)) === String(item.id)) || null;

  const tableNameOf = (item) => {
    const table = getEquipmentTable(item, tables);
    return table ? table.name || `Table ${table.id}` : "";
  };

  // Where an item is kept: its table, the table's spares, or the counter's.
  const whereOf = (item) => {
    const name = tableNameOf(item);
    if (!name) return "the unassigned spares";
    return item.spare ? `${name}'s spares` : name;
  };

  // What the Removed list keeps about an item taken off.
  const historyEntry = (item, details) => ({
    equipmentId: String(item.id),
    name: item.name,
    type: item.type,
    tableId: tableNameOf(item) ? String(item.tableId) : null,
    tableName: tableNameOf(item),
    spare: !tableNameOf(item) || Boolean(item.spare),
    condition: item.condition,
    status: item.status,
    doneBy: currentResolver(),
    ...details,
  });

  const recordRemoval = (entries) => {
    saveEquipmentHistory(entries)
      .then(() => setRemovedKey((key) => key + 1))
      .catch((error) => {
        console.warn("Unable to save removed equipment", error);
        addNotification({ tone: "error", message: "The equipment was updated, but the Removed list could not be saved to the server." });
      });
  };

  // Open reports about items being taken off are resolved with them; returns how many.
  const resolveReportsFor = (items) => {
    const reports = items.map(issueForItem).filter(Boolean);
    reports.forEach((report) => {
      markLogResolved(report.id);
      syncRemoteResolution(report);
    });
    return reports.length;
  };

  const leaveSelectMode = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id) =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });

  // Takes the items as an argument (not from `deleteTargets`), as Inventory does,
  // so the React Compiler never reads them while the targets are still null.
  const deleteEquipment = (items, { reason, useSpareId, registerNew }) => {
    const ids = new Set(items.map((item) => String(item.id)));
    const single = items.length === 1 ? items[0] : null;
    const standIn = useSpareId ? equipment.find((entry) => String(entry.id) === String(useSpareId)) || null : null;
    // Deleted on purpose here, so the server takes several at once (see listSync.js).
    confirmRemoval("equipment", [...ids]);
    setEquipment((prev) =>
      prev
        .filter((entry) => !ids.has(String(entry.id)))
        .map((entry) => (standIn && String(entry.id) === String(standIn.id) ? { ...entry, spare: false } : entry))
    );

    const reportCount = resolveReportsFor(items);
    recordRemoval(items.map((item) => historyEntry(item, { action: "deleted", reason })));
    setDeleteTargets(null);
    leaveSelectMode();

    const spare = Boolean(single) && (!tableNameOf(single) || Boolean(single.spare));
    const reportNote = !reportCount
      ? ""
      : single
        ? " Its open report was marked resolved."
        : ` ${plural(reportCount, "open report")} ${reportCount === 1 ? "was" : "were"} marked resolved.`;
    announce(
      single ? (spare ? "Spare Deleted" : "Equipment Deleted") : `${items.length} Items Deleted`,
      `${single ? `${single.name} was` : `${items.length} items were`} deleted (${reason}).` +
        `${standIn ? ` ${standIn.name} is now used at ${tableNameOf(single)}.` : ""}${reportNote}`
    );

    // A new one for the table, named as if the deleted item were already gone.
    if (registerNew && single) {
      openNewEquipment({
        table: getEquipmentTable(single, tables),
        type: single.type,
        pool: equipment.filter((entry) => !ids.has(String(entry.id))),
      });
    }
  };

  // The new item takes the old one's place (same table, type and use); the old one goes to Removed.
  const replaceEquipment = (item, { name, date }) => {
    const fresh = {
      ...emptyEquipmentForm,
      id: Date.now(),
      name,
      type: item.type,
      tableId: item.tableId ?? null,
      spare: Boolean(item.spare),
      lastMaintenance: date,
    };
    setEquipment((prev) => prev.map((entry) => (String(entry.id) === String(item.id) ? fresh : entry)));

    const reportCount = resolveReportsFor([item]);
    recordRemoval([historyEntry(item, { action: "replaced", replacedBy: name })]);
    setReplaceTarget(null);
    announce(
      "Replacement Completed",
      `${item.name} was replaced by ${name}, now in service.${reportCount ? " Its open report was marked resolved." : ""}`
    );
  };

  // Spares given to no table have a tab of their own.
  const unassignedSpares = getUnassignedSpares(equipment, tables);
  const unassignedIds = new Set(unassignedSpares.map((item) => String(item.id)));
  const spareSection = {
    key: "spare",
    table: null,
    title: "Unassigned Spares",
    items: unassignedSpares,
    spares: [],
    issues: [],
    shownItems: unassignedSpares,
    shownSpares: [],
  };

  // One section per table with its dedicated equipment, its spares and open
  // reports, then reports tied to no table (a general complaint, say).
  const sections = [
    ...[...tables]
      .sort((first, second) => Number(first.id) - Number(second.id))
      .map((table) => ({
        key: `table-${table.id}`,
        table,
        title: table.name || `Table ${table.id}`,
        items: getTableEquipment(equipment, table.id),
        spares: getTableSpares(equipment, table.id),
        issues: reportedIssues.filter((issue) => String(getIssueTableId(issue, issueContext)) === String(table.id)),
      })),
    {
      key: "general",
      table: null,
      title: "Other Reports",
      items: [],
      spares: [],
      issues: reportedIssues.filter((issue) => getIssueTableId(issue, issueContext) === null),
    },
  ];

  const tablesWithGaps = sections.filter((section) => section.table && getEquipmentGaps(section.items).length).length;

  const byFilter = (items) => (filter && filter !== "reports" ? items.filter((item) => item.status === filter) : items);
  const visibleSections = sections
    .map((section) => ({
      ...section,
      shownItems: byFilter(section.items),
      shownSpares: byFilter(section.spares),
    }))
    .filter((section) => {
      if (filter === "reports") return section.issues.length > 0;
      if (filter) return section.shownItems.length > 0 || section.shownSpares.length > 0;
      return section.key !== "general" || section.issues.length > 0;
    });

  const toggleFilter = (next) => setFilter((previous) => (previous === next ? null : next));

  // The filter is for By Table; spares off any table that match it are pointed to.
  const unassignedMatches = filter && filter !== "reports" ? byFilter(unassignedSpares).length : 0;

  // Select mode works on the broken items on show in this tab (after the filter).
  const equipmentView = view === "tables" || view === "spares";
  const viewEquipment =
    view === "spares" ? unassignedSpares : equipment.filter((item) => !unassignedIds.has(String(item.id)));
  const removableCount = viewEquipment.filter(isRemovableEquipment).length;
  const selectableItems = (
    view === "spares"
      ? unassignedSpares
      : visibleSections.flatMap((section) => [...section.shownItems, ...section.shownSpares])
  ).filter(isRemovableEquipment);
  const selectedItems = equipment.filter((item) => selectedIds.has(String(item.id)) && isRemovableEquipment(item));

  const showView = (next) => {
    leaveSelectMode();
    setView(next);
  };

  const summaryCards = [
    { key: "active", tone: "green", value: stats.active, label: "In Service" },
    { key: "repair", tone: "red", value: stats.repair, label: "For Repair" },
    { key: "replacement", tone: "yellow", value: stats.replacement, label: "For Replacement" },
    { key: "reports", tone: "blue", value: reportedIssues.length, label: "Open Reports" },
  ];
  const filterLabel = (summaryCards.find((card) => card.key === filter)?.label || "").toLowerCase();

  const renderReport = (issue) => {
    const summary = getIssueSummary(issue);

    return (
      <div key={issue.id} className="equipment-report-row">
        <i className="bi bi-exclamation-diamond-fill equipment-report-icon" aria-hidden="true"></i>
        <div className="equipment-report-copy">
          <strong>
            {summary.type}
            {summary.equipmentName ? ` · ${summary.equipmentName}` : ""}
          </strong>
          <p>{summary.description}</p>
          <span>
            Reported by {summary.reporter} · {summary.time}
          </span>
        </div>
        <div className="equipment-report-actions">
          <button type="button" className="btn btn-secondary" onClick={() => openIssue(issue)}>
            <i className="bi bi-eye"></i>
            View
          </button>
          {setLogs && (
            <button type="button" className="btn btn-success" onClick={() => openIssue(issue, true)}>
              <i className="bi bi-check-circle"></i>
              {summary.equipmentId ? "Complete Maintenance" : "Mark Resolved"}
            </button>
          )}
        </div>
      </div>
    );
  };

  // `spare` gives a spare's dashed edge; `tagged` marks it Spare among a table's own set.
  const renderCard = (item, { spare = false, tagged = spare } = {}) => {
    const conditionClass = ["good", "fair"].includes(item.condition) ? item.condition : "damaged";
    const relatedIssue = issueForItem(item);
    const removable = isRemovableEquipment(item);
    const selected = selectedIds.has(String(item.id));
    const selectState = selecting && removable ? (selected ? "is-selected" : "is-selectable") : "";

    return (
      <div
        key={item.id}
        className={`card equipment-card equipment-card--${item.status} ${spare ? "equipment-card--spare" : ""} ${selectState}`}
      >
        <div className="card-body">
          <div className="equipment-card-header">
            <div className="equipment-card-title">
              <span className="equipment-type-icon" aria-hidden="true">
                <i className={`bi ${EQUIPMENT_TYPE_ICONS[item.type] || "bi-box-seam"}`}></i>
              </span>
              <div>
                <h6 className="equipment-name">{item.name}</h6>
                <p className="equipment-type">
                  {item.type}
                  {tagged && <span className="equipment-spare-tag">Spare</span>}
                </p>
              </div>
            </div>
            <span className={`badge equipment-badge-${item.status}`}>
              {EQUIPMENT_STATUS_LABELS[item.status] || item.status}
            </span>
          </div>

          <dl className="equipment-facts">
            <div>
              <dt>Condition</dt>
              <dd className={`equipment-condition equipment-condition-${conditionClass}`}>
                <i className={`bi ${condIcon[conditionClass]}`} aria-hidden="true"></i>
                {item.condition}
              </dd>
            </div>
            <div>
              <dt>Previous maintenance</dt>
              <dd>{formatEquipmentDate(item.previousMaintenance)}</dd>
            </div>
            <div>
              <dt>Latest maintenance</dt>
              <dd>{formatEquipmentDate(item.lastMaintenance)}</dd>
            </div>
          </dl>

          <div className="equipment-actions">
            {relatedIssue ? (
              <button type="button" className="equipment-report-linked" onClick={() => openIssue(relatedIssue)}>
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
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => openEquipmentForm(item)}
              aria-label={`Edit ${item.name}`}
              title="Edit, or move to another table"
            >
              <i className="bi bi-pencil"></i>
            </button>
            {removable &&
              (selecting ? (
                <label className="equipment-select-check">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelected(item.id)}
                    aria-label={`Select ${item.name}`}
                  />
                  Select
                </label>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm equipment-delete-btn"
                  onClick={() => setDeleteTargets([item])}
                  aria-label={`Delete ${item.name}`}
                  title="Delete this broken equipment"
                >
                  <i className="bi bi-trash3"></i>
                  Delete
                </button>
              ))}
          </div>

          <div className="equipment-service-actions">
            {item.status === "active" && (
              <>
                <button type="button" className="equipment-service-btn repair" onClick={() => sendEquipmentTo(item.id, "repair")}>
                  <i className="bi bi-tools"></i>
                  For Repair
                </button>
                <button type="button" className="equipment-service-btn replace" onClick={() => sendEquipmentTo(item.id, "replacement")}>
                  <i className="bi bi-arrow-repeat"></i>
                  For Replacement
                </button>
              </>
            )}

            {item.status === "repair" && (
              <>
                <button type="button" className="equipment-service-btn done" onClick={() => markRepaired(item.id)}>
                  <i className="bi bi-check-circle"></i>
                  Mark Repaired
                </button>
                <button type="button" className="equipment-service-btn replace" onClick={() => sendEquipmentTo(item.id, "replacement")}>
                  <i className="bi bi-arrow-repeat"></i>
                  Needs Replacement
                </button>
              </>
            )}

            {item.status === "replacement" && (
              <button type="button" className="equipment-service-btn done" onClick={() => setReplaceTarget(item)}>
                <i className="bi bi-check-circle"></i>
                Mark Replaced
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (section) => {
    const { table } = section;
    const gaps = table ? getEquipmentGaps(section.items) : [];

    return (
      <section key={section.key} className={`equipment-section ${gaps.length ? "has-gaps" : ""}`}>
        <div className="equipment-section-header">
          <div className="equipment-section-title">
            <i
              className={`bi ${table ? "bi-grid-3x3-gap-fill" : section.key === "spare" ? "bi-box-seam" : "bi-chat-square-text"}`}
              aria-hidden="true"
            ></i>
            <h2>{section.title}</h2>
            {table && (
              <span className={`equipment-table-status equipment-table-status--${table.status}`}>
                {TABLE_STATUS_LABELS[table.status] || table.status}
              </span>
            )}
            {section.key !== "general" && (
              <span className="equipment-section-count">
                {plural(section.items.length, "item")}
                {section.spares.length > 0 ? ` · ${plural(section.spares.length, "spare")}` : ""}
              </span>
            )}
            {section.issues.length > 0 && (
              <span className="equipment-section-alert">{plural(section.issues.length, "open report")}</span>
            )}

            {/* Every table needs a working cue stick and ball set */}
            {table && (
              <div className="equipment-coverage">
                {REQUIRED_TABLE_EQUIPMENT.map((type) => {
                  const gap = gaps.find((entry) => entry.type === type);
                  const ofType = section.items.filter((item) => item.type === type);
                  const out = ofType.filter((item) => item.status !== "active").length;

                  return gap ? (
                    <button
                      key={type}
                      type="button"
                      className="equipment-coverage-chip is-missing"
                      onClick={() => openNewEquipment({ table, type })}
                      title={`Register a ${type.toLowerCase()} for ${section.title}`}
                    >
                      <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
                      {describeGap(gap)}
                      <span>Add</span>
                    </button>
                  ) : (
                    <span key={type} className="equipment-coverage-chip">
                      <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                      {type} ×{ofType.length - out}
                      {out > 0 ? ` (${out} out of service)` : ""}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          {section.key !== "general" && (
            <div className="equipment-section-adds">
              <button
                type="button"
                className="equipment-section-add"
                onClick={() => openNewEquipment({ table, type: gaps[0]?.type || "Cue Stick" })}
              >
                <i className="bi bi-plus-lg"></i>
                {table ? `Add to ${section.title}` : "Add Spare"}
              </button>
              {table && (
                <button
                  type="button"
                  className="equipment-section-add equipment-section-add--spare"
                  onClick={() => openNewEquipment({ table, type: "Cue Stick", spare: true })}
                  title={`Register a spare kept for ${section.title}`}
                >
                  <i className="bi bi-box-seam"></i>
                  Add Spare
                </button>
              )}
            </div>
          )}
        </div>

        {section.issues.length > 0 && <div className="equipment-report-list">{section.issues.map(renderReport)}</div>}

        {!section.shownItems.length &&
          section.key !== "general" &&
          !(filter && section.shownSpares.length) && (
            <p className="equipment-section-empty">
              {table
                ? `No equipment is dedicated to ${section.title} yet.`
                : "No unassigned spares. Items not given to a table are listed here."}
            </p>
          )}

        {/* The table's own equipment, then its spares (tagged) in the same rows */}
        {section.shownItems.length + section.shownSpares.length > 0 && (
          <div className="equipment-grid">
            {section.shownItems.map((item) =>
              renderCard(item, { spare: section.key === "spare", tagged: false })
            )}
            {section.shownSpares.map((item) => renderCard(item, { spare: true }))}
          </div>
        )}
      </section>
    );
  };

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
          <p className="equipment-subtitle">
            Each table&apos;s dedicated equipment, its condition, and the issues employees report
          </p>
        </div>
        <div className="equipment-header-actions">
          <div className="equipment-view-toggle" role="tablist" aria-label="Equipment page view">
            <button
              type="button"
              role="tab"
              aria-selected={view === "tables"}
              className={`equipment-view-tab ${view === "tables" ? "active" : ""}`}
              onClick={() => showView("tables")}
            >
              <i className="bi bi-grid-3x3-gap me-2"></i>
              By Table
              <span>{reportedIssues.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "spares"}
              className={`equipment-view-tab ${view === "spares" ? "active" : ""}`}
              onClick={() => showView("spares")}
            >
              <i className="bi bi-box-seam me-2"></i>
              Unassigned
              <span>{unassignedSpares.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "history"}
              className={`equipment-view-tab ${view === "history" ? "active" : ""}`}
              onClick={() => showView("history")}
            >
              <i className="bi bi-clock-history me-2"></i>
              Report History
              <span>{historyTotal ?? resolvedIssues.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "removed"}
              className={`equipment-view-tab ${view === "removed" ? "active" : ""}`}
              onClick={() => showView("removed")}
            >
              <i className="bi bi-archive me-2"></i>
              Removed
              {removedTotal !== null && <span>{removedTotal}</span>}
            </button>
          </div>
          {equipmentView && (selecting || removableCount > 0) && (
            <button
              type="button"
              className={`equipment-select-btn ${selecting ? "active" : ""}`}
              aria-pressed={selecting}
              onClick={() => (selecting ? leaveSelectMode() : setSelecting(true))}
            >
              <i className={`bi ${selecting ? "bi-x-lg" : "bi-check2-square"}`}></i>
              {selecting ? "Cancel Select" : "Select Broken"}
              {!selecting && <span>{removableCount}</span>}
            </button>
          )}
          <button className="btn btn-success equipment-add-btn" onClick={() => openNewEquipment()}>
            <i className="bi bi-plus-circle me-2"></i>
            Register Equipment
          </button>
        </div>
      </div>

      {view === "tables" && (
        <>
          {/* Summary: each card filters the tables below */}
          <div className="equipment-summary-grid">
            {summaryCards.map((card) => (
              <button
                key={card.key}
                type="button"
                aria-pressed={filter === card.key}
                title={filter === card.key ? "Show everything" : `Show only: ${card.label.toLowerCase()}`}
                className={`card equipment-stat-card equipment-stat-${card.tone} equipment-stat-clickable ${
                  filter === card.key ? "selected" : ""
                }`}
                onClick={() => toggleFilter(card.key)}
              >
                <div className="card-body">
                  <div className="equipment-stat-value">{card.value}</div>
                  <div className="equipment-stat-label">{card.label}</div>
                </div>
              </button>
            ))}
          </div>

          {tablesWithGaps > 0 && !filter && (
            <div className="equipment-gap-banner" role="note">
              <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
              <span>
                {plural(tablesWithGaps, "table")} {tablesWithGaps === 1 ? "is" : "are"} missing a working cue stick or
                ball set. Use the yellow Add buttons below to register one.
              </span>
            </div>
          )}

          {unassignedMatches > 0 && (
            <div className="equipment-unassigned-note" role="note">
              <i className="bi bi-box-seam" aria-hidden="true"></i>
              <span>
                {plural(unassignedMatches, "unassigned spare")} {unassignedMatches === 1 ? "is" : "are"} also{" "}
                {filterLabel}.
              </span>
              <button type="button" onClick={() => showView("spares")}>
                Show in Unassigned
              </button>
            </div>
          )}
        </>
      )}

      {equipmentView && selecting && (
        <div className="equipment-select-bar" role="region" aria-label="Select broken equipment">
          <strong>
            {selectedItems.length ? `${plural(selectedItems.length, "item")} selected` : "Tick the broken items to delete"}
          </strong>
          <button
            type="button"
            className="equipment-select-link"
            onClick={() => setSelectedIds(new Set(selectableItems.map((item) => String(item.id))))}
            disabled={!selectableItems.length}
          >
            Select all broken ({selectableItems.length})
          </button>
          {selectedItems.length > 0 && (
            <button type="button" className="equipment-select-link" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          )}
          <span className="equipment-select-bar-gap" aria-hidden="true"></span>
          <button type="button" className="equipment-select-cancel" onClick={leaveSelectMode}>
            Cancel
          </button>
          <button
            type="button"
            className="equipment-select-delete"
            onClick={() => setDeleteTargets(selectedItems)}
            disabled={!selectedItems.length}
          >
            <i className="bi bi-trash3"></i>
            Delete{selectedItems.length ? ` ${selectedItems.length}` : ""}
          </button>
        </div>
      )}

      {view === "tables" &&
        (visibleSections.length ? (
          <div className="equipment-sections">{visibleSections.map(renderSection)}</div>
        ) : (
          <div className="equipment-empty-state">
            <i className="bi bi-funnel" aria-hidden="true"></i>
            <strong>Nothing matches this filter</strong>
            <span>
              {filter === "reports"
                ? "No open reports. Reports employees send show up under their table."
                : `No equipment${unassignedMatches ? " at the tables" : ""} is ${filterLabel}.`}{" "}
              Tap the card again to show everything.
            </span>
          </div>
        ))}

      {/* Spares given to no table, with Add Spare */}
      {view === "spares" && <div className="equipment-sections">{renderSection(spareSection)}</div>}

      {/* Resolved reports, a page at a time, grouped by when they were resolved */}
      {view === "history" && (
        <ReportHistory
          tables={tables}
          localReports={resolvedIssues}
          refreshKey={`${resolvedIssues.length}:${resolvedIssues[0]?.id ?? ""}`}
          onView={(issue) => openIssue(issue)}
          onTotal={setHistoryTotal}
        />
      )}

      {/* Deleted and replaced equipment, kept for a few months */}
      {view === "removed" && <EquipmentHistory refreshKey={removedKey} onTotal={setRemovedTotal} />}

      {/* Equipment Modal */}
      {modal === "form" && (
        <EquipmentModal
          form={form}
          setForm={setForm}
          editId={editId}
          errors={equipmentErrors}
          today={todayString()}
          tables={[...tables].sort((first, second) => Number(first.id) - Number(second.id))}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {deleteTargets && (
        <DeleteEquipmentModal
          key={deleteTargets.map((item) => item.id).join(",")}
          items={deleteTargets}
          equipment={equipment}
          tables={tables}
          reportFor={issueForItem}
          onConfirm={(choice) => deleteEquipment(deleteTargets, choice)}
          onClose={() => setDeleteTargets(null)}
        />
      )}

      {replaceTarget && (
        <ReplaceEquipmentModal
          key={replaceTarget.id}
          item={replaceTarget}
          where={whereOf(replaceTarget)}
          equipment={equipment}
          today={todayString()}
          hasReport={Boolean(issueForItem(replaceTarget))}
          onSave={(details) => replaceEquipment(replaceTarget, details)}
          onClose={() => setReplaceTarget(null)}
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
                    <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={closeIssueModal}></button>
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
