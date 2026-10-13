import { useEffect, useState } from "react";
import FieldError from "../Global/FieldError";
import useFormErrors from "../Global/useFormErrors";
import {
  EQUIPMENT_HISTORY_RETENTION_MONTHS,
  EQUIPMENT_REMOVAL_REASONS,
  EQUIPMENT_STATUS_LABELS,
  getEquipmentTable,
  getRemovalGaps,
  getStandInSpares,
} from "../../utils/equipment";

const FIELDS = ["reason"];

const tableLabel = (table) => (table ? table.name || `Table ${table.id}` : "");

// Where an item is kept, and who else sees it, for the pop-up's wording.
const describeItem = (item, tables) => {
  const table = getEquipmentTable(item, tables);
  const spare = !table || Boolean(item.spare);
  return {
    table,
    spare,
    home: spare ? (table ? `${tableLabel(table)}'s spares` : "the unassigned spares") : tableLabel(table),
    seenBy: spare ? "the employees' spare list" : "its table card on the employees' Actions page",
  };
};

/**
 * Delete one broken item, or several picked in Select mode. Asks why (kept in
 * the Removed list), warns when a table is left without a working cue stick or
 * ball set and, for one item in use on a table, what takes its place: one of
 * the table's working spares, a new one registered now, or nothing yet.
 * `onConfirm({ reason, useSpareId, registerNew })`.
 */
export default function DeleteEquipmentModal({ items = [], equipment = [], tables = [], reportFor, onConfirm, onClose }) {
  const single = items.length === 1;
  const only = describeItem(items[0], tables);
  const gaps = getRemovalGaps(equipment, items, tables);
  const reportCount = items.filter((item) => reportFor(item)).length;

  // In its place: only for one item in use on a table.
  const standIns = single && !only.spare ? getStandInSpares(equipment, items[0]) : [];
  const choices =
    single && !only.spare
      ? [
          ...standIns.map((spare) => ({ value: `spare:${spare.id}`, label: `Use ${spare.name} (a spare) at ${tableLabel(only.table)}` })),
          { value: "register", label: `Register a new ${items[0].type.toLowerCase()} for ${tableLabel(only.table)}` },
          { value: "none", label: "Nothing for now" },
        ]
      : [];
  const defaultChoice = gaps.length ? choices[0]?.value || "none" : "none";

  const [reason, setReason] = useState(() => (items.every((item) => item.status === "lost") ? "Lost" : ""));
  const [after, setAfter] = useState(defaultChoice);
  const errors = reason ? {} : { reason: "Choose why it is being removed." };
  const { errorFor, touch, canSave } = useFormErrors(errors);

  // Escape is the fastest way out of a pop-up opened by accident.
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const title = single ? (only.spare ? "Delete this spare?" : "Delete this equipment?") : `Delete ${items.length} items?`;
  const confirmLabel = single ? (only.spare ? "Yes, Delete Spare" : "Yes, Delete Equipment") : `Yes, Delete ${items.length} Items`;

  const detail = [
    ...gaps.map((gap) =>
      choices.length
        ? `${gap.tableName} will have no working ${gap.type.toLowerCase()} left.`
        : `${gap.tableName} will have no working ${gap.type.toLowerCase()} left; register a new one with Add to ${gap.tableName}.`
    ),
    reportCount
      ? single
        ? "Its open report will be marked resolved."
        : `${reportCount} open ${reportCount === 1 ? "report" : "reports"} will be marked resolved.`
      : "",
    `${single ? "It" : "They"} will be listed under Removed for ${EQUIPMENT_HISTORY_RETENTION_MONTHS} months. This cannot be undone.`,
  ]
    .filter(Boolean)
    .join(" ");

  const confirm = () => {
    if (!canSave(FIELDS, "equipment-delete-")) return;
    onConfirm({
      reason,
      useSpareId: after.startsWith("spare:") ? after.slice("spare:".length) : null,
      registerNew: after === "register",
    });
  };

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className="modal show" style={{ display: "flex" }} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
          <div className="modal-content equipment-delete-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-trash3" aria-hidden="true"></i>
                {title}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              {single ? (
                <p className="confirm-dialog-copy">
                  <strong>{items[0].name}</strong> will be removed from {only.home} for everyone, including {only.seenBy}.
                </p>
              ) : (
                <>
                  <p className="confirm-dialog-copy">These items will be removed for everyone:</p>
                  <ul className="equipment-delete-list">
                    {items.map((item) => {
                      const about = describeItem(item, tables);
                      return (
                        <li key={item.id}>
                          <strong>{item.name}</strong>
                          <small>
                            {about.spare ? (about.table ? `Spare for ${tableLabel(about.table)}` : "Unassigned spare") : tableLabel(about.table)}
                            {" · "}
                            {EQUIPMENT_STATUS_LABELS[item.status] || item.status}
                            {item.condition === "damaged" ? " · Damaged" : ""}
                          </small>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <div className="equipment-delete-field">
                <label className="form-label" htmlFor="equipment-delete-reason">
                  Why {single ? "is it" : "are they"} being removed?
                </label>
                <select
                  id="equipment-delete-reason"
                  className={`form-select${errorFor("reason") ? " form-input-error" : ""}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  onBlur={() => touch("reason")}
                  aria-invalid={Boolean(errorFor("reason"))}
                  aria-describedby={errorFor("reason") ? "equipment-delete-reason-error" : undefined}
                >
                  <option value="">Choose a reason</option>
                  {EQUIPMENT_REMOVAL_REASONS.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
                <FieldError id="equipment-delete-reason-error" message={errorFor("reason")} />
              </div>

              {choices.length > 0 && (
                <fieldset className="equipment-delete-field equipment-delete-after">
                  <legend className="form-label">In its place</legend>
                  {choices.map((choice) => (
                    <label key={choice.value} className={`equipment-choice ${after === choice.value ? "is-chosen" : ""}`}>
                      <input
                        type="radio"
                        name="equipment-delete-after"
                        value={choice.value}
                        checked={after === choice.value}
                        onChange={() => setAfter(choice.value)}
                      />
                      <span>{choice.label}</span>
                    </label>
                  ))}
                </fieldset>
              )}

              <p className="confirm-dialog-detail">{detail}</p>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Keep {single ? "it" : "them"}
              </button>
              <button type="button" className="btn btn-danger" onClick={confirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
