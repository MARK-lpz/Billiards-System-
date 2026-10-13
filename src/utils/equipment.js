/**
 * Equipment dedicated to each pool table (its own cue sticks, ball set, and so
 * on), shared by the admin's Equipment Monitoring and the employee's Actions
 * page. A table can also keep spares (`spare: true`), held back for when its
 * own set is out; an item with no table is an unassigned spare at the counter.
 */

export const EQUIPMENT_TYPES = ["Cue Stick", "Ball Set", "Chalk", "Rack", "Bridge", "Other"];

// What every table needs to be played on.
export const REQUIRED_TABLE_EQUIPMENT = ["Cue Stick", "Ball Set"];

export const EQUIPMENT_STATUS_LABELS = {
  active: "In service",
  repair: "For repair",
  replacement: "For replacement",
  lost: "Lost",
};

export const EQUIPMENT_TYPE_ICONS = {
  "Cue Stick": "bi-slash-lg",
  "Ball Set": "bi-circle-fill",
  Chalk: "bi-square-fill",
  Rack: "bi-triangle",
  Bridge: "bi-signpost",
  Other: "bi-box-seam",
};

const hasValue = (value) => value !== null && value !== undefined && value !== "";

const normalizeName = (name) => String(name || "").trim().toLowerCase().replace(/\s+/g, " ");

/** The table an item is dedicated to, or null for a spare (or a table since removed). */
export const getEquipmentTable = (item, tables = []) =>
  hasValue(item?.tableId) ? tables.find((table) => String(table.id) === String(item.tableId)) || null : null;

const onTable = (item, tableId) => hasValue(item.tableId) && String(item.tableId) === String(tableId);

/** The set in use on a table (not its spares). */
export const getTableEquipment = (equipment = [], tableId) =>
  equipment.filter((item) => !item.spare && onTable(item, tableId));

/** The spares kept for a table. */
export const getTableSpares = (equipment = [], tableId) =>
  equipment.filter((item) => item.spare && onTable(item, tableId));

/** Spares with no table: never assigned, or their table was removed. */
export const getUnassignedSpares = (equipment = [], tables = []) =>
  equipment.filter((item) => !getEquipmentTable(item, tables));

/** Every spare, a table's or unassigned. */
export const getSpareEquipment = (equipment = [], tables = []) =>
  equipment.filter((item) => item.spare || !getEquipmentTable(item, tables));

/** The table an item is in use on (null for any spare). */
export const getDedicatedTable = (item, tables = []) => (item?.spare ? null : getEquipmentTable(item, tables));

/**
 * What a table is missing to be played on: a required type with nothing of it
 * in service. `owned` is how many it has of that type at all (out for repair,
 * say), so the message can tell "none" from "none working".
 */
export const getEquipmentGaps = (items = []) =>
  REQUIRED_TABLE_EQUIPMENT.map((type) => {
    const ofType = items.filter((item) => item.type === type);
    return { type, owned: ofType.length, inService: ofType.filter((item) => item.status === "active").length };
  }).filter((gap) => gap.inService === 0);

/** Why an item is taken off the list; asked before it is deleted. */
export const EQUIPMENT_REMOVAL_REASONS = ["Beyond repair", "Lost", "Stolen", "Retired"];

/** How many months the Removed list keeps an item (as the server does). */
export const EQUIPMENT_HISTORY_RETENTION_MONTHS = 3;

/** Damaged, out of service or lost: an item that can be deleted. */
export const isRemovableEquipment = (item) =>
  item?.condition === "damaged" || ["repair", "replacement", "lost"].includes(item?.status);

/** A table's working spares of the same type as `item`, any of which could take its place. */
export const getStandInSpares = (equipment = [], item) =>
  getTableSpares(equipment, item?.tableId).filter(
    (spare) => spare.type === item.type && spare.status === "active" && spare.condition !== "damaged"
  );

/**
 * Tables that deleting `items` together leaves with no working cue stick or
 * ball set, as { tableId, tableName, type }, once per table and type.
 */
export const getRemovalGaps = (equipment = [], items = [], tables = []) => {
  const removing = new Set(items.map((item) => String(item.id)));
  const gaps = [];
  items.forEach((item) => {
    const table = getDedicatedTable(item, tables);
    if (!table || !REQUIRED_TABLE_EQUIPMENT.includes(item.type)) return;
    if (gaps.some((gap) => String(gap.tableId) === String(table.id) && gap.type === item.type)) return;
    const workingLeft = getTableEquipment(equipment, table.id).filter(
      (entry) => entry.type === item.type && entry.status === "active" && !removing.has(String(entry.id))
    ).length;
    if (!workingLeft) gaps.push({ tableId: table.id, tableName: table.name || `Table ${table.id}`, type: item.type });
  });
  return gaps;
};

export const describeGap = (gap) =>
  gap.owned ? `No ${gap.type.toLowerCase()} in service` : `No ${gap.type.toLowerCase()} assigned`;

/**
 * A free name for a new item on a table: "Table 1 Ball Set", then "Table 1 Ball Set 2",
 * and so on ("Table 1 Spare Cue Stick" for one of its spares).
 */
export const suggestEquipmentName = ({ table, type, equipment = [], spare = false }) => {
  const base = `${table ? `${table.name || `Table ${table.id}`}${spare ? " Spare" : ""}` : "Spare"} ${type}`;
  const taken = new Set(equipment.map((item) => normalizeName(item.name)));
  if (!taken.has(normalizeName(base))) return base;

  let number = 2;
  while (taken.has(normalizeName(`${base} ${number}`))) number += 1;
  return `${base} ${number}`;
};

/** "Mar 1, 2026", from a "2026-03-01" maintenance date. */
export const formatEquipmentDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

// ---------------------------------------------------------------- Issue reports

const issueField = (issue, field, legacy) => issue?.issue?.[field] ?? issue?.[legacy] ?? null;

/**
 * The table a report is about: the table it names, or else the table its
 * equipment is dedicated to. Older reports named the table only by name.
 */
export const getIssueTableId = (issue, { tables = [], equipment = [] } = {}) => {
  const tableId = issueField(issue, "tableId", "issueTableId");
  if (hasValue(tableId) && tables.some((table) => String(table.id) === String(tableId))) return tableId;

  const tableName = normalizeName(issueField(issue, "table", "issueTable"));
  const byName = tableName ? tables.find((table) => normalizeName(table.name) === tableName) : null;
  if (byName) return byName.id;

  const equipmentId = issueField(issue, "equipmentId", "issueEquipmentId");
  const item = hasValue(equipmentId) ? equipment.find((entry) => String(entry.id) === String(equipmentId)) : null;
  return getEquipmentTable(item, tables)?.id ?? null;
};

export const getIssueEquipmentId = (issue) => issueField(issue, "equipmentId", "issueEquipmentId");
