import FieldError from "../Global/FieldError";
import useFormErrors from "../Global/useFormErrors";
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_TYPES } from "../../utils/equipment";

const FIELDS = ["name", "tableId", "previousMaintenance", "lastMaintenance"];

/** Register / Edit Equipment. `errors` comes from getEquipmentErrors (formValidation.js). */
export default function EquipmentModal({ form, setForm, editId, errors = {}, today, tables = [], onClose, onSave }) {
  const { errorFor, touch, canSave } = useFormErrors(errors);
  const fieldProps = (field, className = "form-control") => ({
    id: `equipment-${field}`,
    onBlur: () => touch(field),
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `equipment-${field}-error` : undefined,
    className: `${className}${errorFor(field) ? " form-input-error" : ""}`,
  });

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content equipment-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                {editId ? "Edit Equipment" : "Register Equipment"}
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="Close"
                onClick={onClose}
              ></button>
            </div>

            <div className="modal-body">
              {/* Equipment Name */}
              <div className="mb-3">
                <label className="form-label" htmlFor="equipment-name">Equipment Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Table 1 Cue Stick"
                  maxLength={80}
                  {...fieldProps("name")}
                />
                <FieldError id="equipment-name-error" message={errorFor("name")} />
              </div>

              <div className="equipment-form-grid mb-3">
                <div>
                  <label className="form-label" htmlFor="equipment-type">Type</label>
                  <select
                    id="equipment-type"
                    className="form-select"
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                  >
                    {EQUIPMENT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* The table this item stays with, or the counter's spares */}
                <div>
                  <label className="form-label" htmlFor="equipment-tableId">Dedicated to</label>
                  <select
                    value={form.tableId ?? ""}
                    onChange={e => setForm({ ...form, tableId: e.target.value === "" ? null : e.target.value })}
                    {...fieldProps("tableId", "form-select")}
                  >
                    <option value="">Spare (not assigned to a table)</option>
                    {tables.map(table => (
                      <option key={table.id} value={String(table.id)}>{table.name || `Table ${table.id}`}</option>
                    ))}
                  </select>
                  <FieldError id="equipment-tableId-error" message={errorFor("tableId")} />
                </div>
              </div>

              {/* On a table: part of its set, or one of its spares */}
              {form.tableId !== null && form.tableId !== "" && (
                <div className="mb-3">
                  <label className="form-label" htmlFor="equipment-spare">Use at the table</label>
                  <select
                    id="equipment-spare"
                    className="form-select"
                    value={form.spare ? "spare" : "set"}
                    onChange={e => setForm({ ...form, spare: e.target.value === "spare" })}
                  >
                    <option value="set">In use on the table (part of its set)</option>
                    <option value="spare">Spare for this table</option>
                  </select>
                </div>
              )}

              {/* Condition & Status */}
              <div className="equipment-form-grid mb-3">
                <div>
                  <label className="form-label" htmlFor="equipment-condition">Condition</label>
                  <select
                    id="equipment-condition"
                    className="form-select"
                    value={form.condition}
                    onChange={e => setForm({ ...form, condition: e.target.value })}
                  >
                    {["good", "fair", "damaged"].map(c => (
                      <option key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="equipment-status">Status</label>
                  <select
                    id="equipment-status"
                    className="form-select"
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                  >
                    {Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="equipment-form-grid">
                <div>
                  <label className="form-label" htmlFor="equipment-previousMaintenance">Previous Maintenance</label>
                  <input
                    type="date"
                    max={today}
                    value={form.previousMaintenance || ""}
                    onChange={e => setForm({ ...form, previousMaintenance: e.target.value })}
                    {...fieldProps("previousMaintenance")}
                  />
                  <FieldError id="equipment-previousMaintenance-error" message={errorFor("previousMaintenance")} />
                </div>
                <div>
                  <label className="form-label" htmlFor="equipment-lastMaintenance">Latest Maintenance</label>
                  <input
                    type="date"
                    max={today}
                    value={form.lastMaintenance || ""}
                    onChange={e => setForm({ ...form, lastMaintenance: e.target.value })}
                    {...fieldProps("lastMaintenance")}
                  />
                  <FieldError id="equipment-lastMaintenance-error" message={errorFor("lastMaintenance")} />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => canSave(FIELDS, "equipment-") && onSave()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
