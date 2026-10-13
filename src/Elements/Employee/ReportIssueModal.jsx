import { useEffect, useState } from "react";
import FieldError from "../Global/FieldError";
import useFormErrors from "../Global/useFormErrors";
import { getIssueSummary } from "../../utils/issues";
import {
  getDedicatedTable,
  getEquipmentTable,
  getIssueEquipmentId,
  getSpareEquipment,
  getTableEquipment,
  getTableSpares,
  getUnassignedSpares,
} from "../../utils/equipment";

const ISSUE_TYPES = {
  equipment: "Equipment Problem",
  table: "Table Damage",
  lighting: "Lighting Problem",
  customer: "Customer Complaint",
  other: "Other",
};

const MIN_ISSUE_DESCRIPTION = 10;
const MAX_ISSUE_DESCRIPTION = 500;
const FIELDS = ["type", "tableId", "equipmentId", "description"];

const sameId = (first, second) => String(first) === String(second);

/**
 * Report an issue: a problem with a table's dedicated equipment, with the table
 * itself, or anything else. Opened from a table card it starts on that table
 * (and on one item, from the item's flag button).
 */
export default function ReportIssueModal({ tables = [], equipment = [], openIssues = [], preset = {}, onSubmit, onClose }) {
  const [form, setForm] = useState(() => ({
    type: preset.equipmentId ? "equipment" : preset.type || "",
    tableId: preset.tableId != null ? String(preset.tableId) : "",
    equipmentId: preset.equipmentId != null ? String(preset.equipmentId) : "",
    description: "",
  }));

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const table = tables.find((entry) => sameId(entry.id, form.tableId)) || null;
  const item = equipment.find((entry) => sameId(entry.id, form.equipmentId)) || null;
  // A spare may have been lent to another table, so only an item in use on a table is held to it.
  const itemTable = item ? getDedicatedTable(item, tables) : null;
  const isEquipment = form.type === "equipment";
  // A table's items: its own set, then its spares.
  const itemsOf = (tableId) => [...getTableEquipment(equipment, tableId), ...getTableSpares(equipment, tableId)];
  // The chosen table's items first, then every other spare; with no table, every table's.
  const tableItems = table ? itemsOf(table.id) : [];
  const spareItems = table
    ? getSpareEquipment(equipment, tables).filter((entry) => !tableItems.includes(entry))
    : getUnassignedSpares(equipment, tables);
  const sameItemReport = item
    ? openIssues.find((issue) => sameId(getIssueEquipmentId(issue), item.id)) || null
    : null;

  const errors = {};
  if (!form.type) errors.type = "Choose what kind of issue this is.";
  if (form.type === "table" && !table) errors.tableId = "Choose the table that is damaged.";
  if (isEquipment) {
    if (!item) errors.equipmentId = "Choose the equipment that has the problem.";
    else if (table && itemTable && !sameId(itemTable.id, table.id)) {
      errors.equipmentId = `${item.name} is dedicated to ${itemTable.name}. Choose ${itemTable.name} above, or another item.`;
    } else if (sameItemReport) {
      errors.equipmentId = `${item.name} already has an open report (${getIssueSummary(sameItemReport).time}). The admin has it; no need to report it again.`;
    }
  }
  const description = form.description.trim();
  if (description.length < MIN_ISSUE_DESCRIPTION) {
    errors.description = `Describe the issue in at least ${MIN_ISSUE_DESCRIPTION} characters so the admin knows what to fix.`;
  }

  const { errorFor, touch, canSave } = useFormErrors(errors);
  const fieldProps = (field, className) => ({
    id: `issue-${field}`,
    onBlur: () => touch(field),
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `issue-${field}-error` : undefined,
    className: `${className}${errorFor(field) ? " form-input-error" : ""}`,
  });

  // Picking an item brings its table along, so the two always agree.
  const chooseItem = (equipmentId) => {
    const next = equipment.find((entry) => sameId(entry.id, equipmentId));
    const nextTable = next ? getEquipmentTable(next, tables) : null;
    setForm((previous) => ({
      ...previous,
      equipmentId,
      tableId: nextTable && !previous.tableId ? String(nextTable.id) : previous.tableId,
    }));
  };

  // A table problem takes the table out of service; equipment and complaints do not.
  const blocksTable = Boolean(table) && ["table", "lighting", "other"].includes(form.type);
  const submit = (event) => {
    event.preventDefault();
    if (!canSave(FIELDS, "issue-")) return;
    onSubmit({ type: form.type, typeLabel: ISSUE_TYPES[form.type], table, item, description, blocksTable });
  };

  const optionLabel = (entry) =>
    `${entry.name} (${entry.type})${entry.spare ? " · spare" : ""}${entry.status !== "active" ? " · out of service" : ""}`;

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className="modal show" style={{ display: "flex" }} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
          <div className="modal-content qa-report-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-clipboard-check"></i> Report Issue
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <form onSubmit={submit} noValidate>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label" htmlFor="issue-type">Issue type</label>
                  <select
                    value={form.type}
                    onChange={(event) => setForm({ ...form, type: event.target.value })}
                    {...fieldProps("type", "form-select")}
                  >
                    <option value="">Select issue type...</option>
                    {Object.entries(ISSUE_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <FieldError id="issue-type-error" message={errorFor("type")} />
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="issue-tableId">
                    Table{form.type === "table" ? "" : " (optional)"}
                  </label>
                  <select
                    value={form.tableId}
                    onChange={(event) => setForm({ ...form, tableId: event.target.value })}
                    {...fieldProps("tableId", "form-select")}
                  >
                    <option value="">{form.type === "table" ? "Select the table..." : "No particular table"}</option>
                    {tables.map((entry) => (
                      <option key={entry.id} value={String(entry.id)}>{entry.name || `Table ${entry.id}`}</option>
                    ))}
                  </select>
                  <FieldError id="issue-tableId-error" message={errorFor("tableId")} />
                  {blocksTable && table.status === "occupied" && (
                    <small className="form-text qa-table-block-note">
                      <i className="bi bi-exclamation-triangle-fill"></i> {table.name} is in use, so it stays occupied. Mark
                      it under maintenance after the session ends.
                    </small>
                  )}
                  {blocksTable && table.status !== "occupied" && (
                    <small className="form-text qa-table-block-note">
                      <i className="bi bi-exclamation-triangle-fill"></i> {table.name} will be marked under maintenance and
                      blocked from online reservations until staff set it back to ready.
                      {table.status === "reserved" &&
                        ` It is reserved${table.customer ? ` for ${table.customer}` : ""}: move that booking to another table in Reservations.`}
                    </small>
                  )}
                  {table && isEquipment && (
                    <small className="form-text text-muted">
                      {table.name} stays open; the admin repairs or replaces the item.
                    </small>
                  )}
                </div>

                {isEquipment && (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="issue-equipmentId">Equipment</label>
                    <select
                      value={form.equipmentId}
                      onChange={(event) => chooseItem(event.target.value)}
                      {...fieldProps("equipmentId", "form-select")}
                    >
                      <option value="">Select equipment...</option>
                      {table ? (
                        <>
                          <optgroup label={`${table.name}'s equipment`}>
                            {tableItems.map((entry) => (
                              <option key={entry.id} value={String(entry.id)}>{optionLabel(entry)}</option>
                            ))}
                          </optgroup>
                          {spareItems.length > 0 && (
                            <optgroup label="Other spares">
                              {spareItems.map((entry) => (
                                <option key={entry.id} value={String(entry.id)}>{optionLabel(entry)}</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      ) : (
                        <>
                          {tables.map((entry) => {
                            const items = itemsOf(entry.id);
                            return items.length ? (
                              <optgroup key={entry.id} label={entry.name || `Table ${entry.id}`}>
                                {items.map((piece) => (
                                  <option key={piece.id} value={String(piece.id)}>{optionLabel(piece)}</option>
                                ))}
                              </optgroup>
                            ) : null;
                          })}
                          {spareItems.length > 0 && (
                            <optgroup label="Unassigned spares">
                              {spareItems.map((entry) => (
                                <option key={entry.id} value={String(entry.id)}>{optionLabel(entry)}</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      )}
                    </select>
                    <FieldError id="issue-equipmentId-error" message={errorFor("equipmentId")} />
                    {table && !tableItems.length && (
                      <small className="form-text text-muted">
                        No equipment is dedicated to {table.name} yet; ask the admin to register it.
                      </small>
                    )}
                  </div>
                )}

                <div>
                  <label className="form-label" htmlFor="issue-description">Description</label>
                  <textarea
                    rows={4}
                    maxLength={MAX_ISSUE_DESCRIPTION}
                    placeholder="What is wrong? (e.g. cracked tip, missing 8-ball, torn cloth near the corner pocket)"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    {...fieldProps("description", "form-control")}
                  />
                  <FieldError id="issue-description-error" message={errorFor("description")} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  <i className="bi bi-send"></i> Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
