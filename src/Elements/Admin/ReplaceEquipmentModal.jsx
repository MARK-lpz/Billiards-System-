import { useState } from "react";
import FieldError from "../Global/FieldError";
import useFormErrors from "../Global/useFormErrors";
import { getReplaceErrors } from "../../utils/formValidation";
import { EQUIPMENT_HISTORY_RETENTION_MONTHS } from "../../utils/equipment";

const FIELDS = ["name", "date"];

/**
 * Mark Replaced: the new item that takes `item`'s place (same table, type and
 * use), in service from `date`. The old one goes to the Removed list as
 * replaced. `onSave({ name, date })`.
 */
export default function ReplaceEquipmentModal({ item, where, equipment = [], today, hasReport = false, onSave, onClose }) {
  const [form, setForm] = useState({ name: item.name, date: today });
  const errors = getReplaceErrors({ form, item, equipment, today });
  const { errorFor, touch, canSave } = useFormErrors(errors);
  const fieldProps = (field) => ({
    id: `replace-${field}`,
    onBlur: () => touch(field),
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `replace-${field}-error` : undefined,
    className: `form-control${errorFor(field) ? " form-input-error" : ""}`,
  });

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content equipment-modal equipment-replace-modal">
            <div className="modal-header">
              <h5 className="modal-title">Replace Equipment</h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              <p className="equipment-replace-copy">
                The new {item.type.toLowerCase()} takes the place of <strong>{item.name}</strong> at {where}, in service and
                in good condition.
              </p>

              <div className="mb-3">
                <label className="form-label" htmlFor="replace-name">New item&apos;s name</label>
                <input
                  type="text"
                  value={form.name}
                  maxLength={80}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  {...fieldProps("name")}
                />
                <FieldError id="replace-name-error" message={errorFor("name")} />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="replace-date">Put in service on</label>
                <input
                  type="date"
                  max={today}
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  {...fieldProps("date")}
                />
                <FieldError id="replace-date-error" message={errorFor("date")} />
              </div>

              <p className="equipment-replace-note">
                <i className="bi bi-archive" aria-hidden="true"></i>
                <span>
                  {item.name} will be listed under Removed as replaced for {EQUIPMENT_HISTORY_RETENTION_MONTHS} months.
                  {hasReport ? " Its open report will be marked resolved." : ""}
                </span>
              </p>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => canSave(FIELDS, "replace-") && onSave({ name: form.name.trim(), date: form.date })}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
