import { numberFieldValue, readNumberField } from "../../utils/numberField";
import FieldError from "../Global/FieldError";
import useFormErrors from "../Global/useFormErrors";

const FIELDS = ["name", "rate", "durationMinutes"];

/** Add / Edit Table. `errors` comes from getPoolTableErrors (formValidation.js). */
export default function PoolTableModal({ form, setForm, editId, errors = {}, onClose, onSave }) {
  const { errorFor, touch, canSave } = useFormErrors(errors);
  const fieldProps = (field) => ({
    id: `pool-table-${field}`,
    onBlur: () => touch(field),
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `pool-table-${field}-error` : undefined,
    className: `form-control${errorFor(field) ? " form-input-error" : ""}`,
  });

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content pool-tables-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-circle me-2"></i>
                {editId ? "Edit Table" : "Add Table"}
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label" htmlFor="pool-table-name">Table Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Table 10"
                  maxLength={40}
                  {...fieldProps("name")}
                />
                <FieldError id="pool-table-name-error" message={errorFor("name")} />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="pool-table-rate">Hourly Rate (₱)</label>
                <input
                  type="number"
                  value={numberFieldValue(form.rate)}
                  onChange={e => setForm({ ...form, rate: readNumberField(e) })}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  {...fieldProps("rate")}
                />
                <FieldError id="pool-table-rate-error" message={errorFor("rate")} />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="pool-table-durationMinutes">Default Session Minutes</label>
                <input
                  type="number"
                  value={numberFieldValue(form.durationMinutes)}
                  onChange={e => setForm({ ...form, durationMinutes: readNumberField(e) })}
                  min="15"
                  step="15"
                  placeholder="60"
                  {...fieldProps("durationMinutes")}
                />
                <FieldError id="pool-table-durationMinutes-error" message={errorFor("durationMinutes")} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-success" onClick={() => canSave(FIELDS, "pool-table-") && onSave()}>
                <i className="bi bi-check-circle me-2"></i>
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
