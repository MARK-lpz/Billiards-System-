import { useState } from "react";
import { numberFieldValue, readNumberField } from "../../utils/numberField";
import { MAX_EVENT_REASON_LENGTH, formatEventWhen } from "../../utils/eventUpdates";
import { getTodayDate } from "../../utils/reservations";
import FieldError from "../Global/FieldError";
import useFormErrors from "../Global/useFormErrors";
import EventMediaField from "./EventMediaField";

const FIELDS = ["name", "prize", "entryFee", "tables"];

export default function EventsModal({
  form,
  setForm,
  tables = [],
  isEdit = false,
  scheduleChange = null,
  scheduleError = "",
  // From getEventErrors (formValidation.js): name, prize, entryFee, tables.
  errors = {},
  onClose,
  onSave,
}) {
  const { errorFor, touch, canSave } = useFormErrors(errors);
  // Promo files still uploading; Save waits for them.
  const [uploads, setUploads] = useState([]);
  const uploading = uploads.filter((upload) => upload.status !== "error").length;
  const setMedia = (update) => setForm((previous) => ({ ...previous, media: update(previous.media || []) }));
  const fieldProps = (field) => ({
    id: `event-${field}`,
    onBlur: () => touch(field),
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `event-${field}-error` : undefined,
    className: `form-control${errorFor(field) ? " form-input-error" : ""}`,
  });

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content events-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-trophy me-2"></i>
                {isEdit ? "Edit Tournament Event" : "Create Tournament Event"}
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={onClose}
              ></button>
            </div>
            
            <div className="modal-body">
              {/* Event Name */}
              <div className="mb-3">
                <label className="form-label" htmlFor="event-name">Event Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Monthly 8-Ball Tournament"
                  maxLength={100}
                  {...fieldProps("name")}
                />
                <FieldError id="event-name-error" message={errorFor("name")} />
              </div>

              {/* Game Type - NEW */}
              <div className="mb-3">
                <label className="form-label">Game Type</label>
                <select 
                  className="form-select" 
                  value={form.gameType || '8-ball'} 
                  onChange={e => setForm({ ...form, gameType: e.target.value })}
                >
                  <option value="8-ball">8-Ball</option>
                  <option value="9-ball">9-Ball</option>
                  <option value="10-ball">10-Ball</option>
                  <option value="straight-pool">Straight Pool</option>
                  <option value="one-pocket">One Pocket</option>
                  <option value="bank-pool">Bank Pool</option>
                  <option value="rotation">Rotation</option>
                  <option value="cutthroat">Cutthroat</option>
                </select>
              </div>

              {/* Date & Time */}
              <div className="mb-3">
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className={`form-control ${scheduleError ? "events-input-error" : ""}`}
                      min={getTodayDate()}
                      value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })}
                      aria-invalid={Boolean(scheduleError)}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Time</label>
                    <input
                      type="time"
                      className={`form-control ${scheduleError && form.time ? "events-input-error" : ""}`}
                      value={form.time}
                      onChange={e => setForm({ ...form, time: e.target.value })}
                    />
                  </div>
                </div>
                {scheduleError && (
                  <div className="events-field-warning" role="alert">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {scheduleError}
                  </div>
                )}
              </div>

              {/* Moving an existing event: players see the old and new schedule on the website */}
              {isEdit && scheduleChange && (
                <div className="events-reschedule-note">
                  <div className="events-reschedule-head">
                    <i className="bi bi-calendar2-week"></i>
                    <span>This reschedules the event</span>
                  </div>
                  <div className="events-reschedule-dates">
                    <span className="events-reschedule-old">{formatEventWhen(scheduleChange.from.date, scheduleChange.from.time)}</span>
                    <i className="bi bi-arrow-right"></i>
                    <span className="events-reschedule-new">{formatEventWhen(scheduleChange.to.date, scheduleChange.to.time)}</span>
                  </div>
                  <span className="events-reschedule-hint">The website will mark it as Rescheduled and show both dates.</span>
                  <label className="form-label" htmlFor="event-reschedule-reason">
                    Reason for players (optional)
                  </label>
                  <input
                    id="event-reschedule-reason"
                    type="text"
                    className="form-control"
                    maxLength={MAX_EVENT_REASON_LENGTH}
                    value={form.rescheduleReason || ""}
                    onChange={e => setForm({ ...form, rescheduleReason: e.target.value })}
                    placeholder="e.g. The hall is closed for maintenance that day"
                  />
                </div>
              )}

              {/* Prize Pool */}
              <div className="mb-3">
                <label className="form-label" htmlFor="event-prize">Prize Pool (₱)</label>
                <input
                  type="number"
                  value={numberFieldValue(form.prize)}
                  onChange={e => setForm({ ...form, prize: readNumberField(e) })}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  {...fieldProps("prize")}
                />
                <FieldError id="event-prize-error" message={errorFor("prize")} />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="event-entryFee">Entry Fee (₱)</label>
                <input
                  type="number"
                  value={numberFieldValue(form.entryFee)}
                  onChange={e => setForm({ ...form, entryFee: readNumberField(e) })}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  {...fieldProps("entryFee")}
                />
                {errorFor("entryFee") ? (
                  <FieldError id="event-entryFee-error" message={errorFor("entryFee")} />
                ) : (
                  <small className="form-text text-muted">Players pay this through GCash when they register. Leave at 0 for a free tournament.</small>
                )}
              </div>

              {/* Pictures and videos for the website */}
              <div className="mb-3">
                <EventMediaField media={form.media || []} setMedia={setMedia} uploads={uploads} setUploads={setUploads} />
              </div>

              {/* Table Assignment */}
              <div className="mb-3">
                <label className="form-label">Assign Tables</label>
                <div className="d-flex flex-wrap gap-3" id="event-tables" tabIndex={-1}>
                  {tables.length > 0 ? (
                    tables.map((table) => {
                      const tableId = typeof table === 'object' ? table.id || table.name || table : table;
                      const label = typeof table === 'object' ? table.name || table.label || tableId : tableId;
                      const selected = form.tables?.includes(tableId);

                      return (
                        <button
                          key={tableId}
                          type="button"
                          className={`btn btn-outline-secondary btn-sm ${selected ? 'active' : ''}`}
                          onClick={() => {
                            const newTables = selected
                              ? form.tables.filter((t) => t !== tableId)
                              : [...(form.tables || []), tableId];
                            setForm({ ...form, tables: newTables });
                          }}
                        >
                          {label}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-muted small">No tables available</div>
                  )}
                </div>
                {/* Shown as soon as a clash is picked: the table buttons have no blur step. */}
                <FieldError id="event-tables-error" message={errors.tables} />
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
                onClick={() => canSave(FIELDS, "event-") && onSave()}
                disabled={Boolean(scheduleError) || uploading > 0}
                title={uploading > 0 ? "Wait for the pictures and videos to finish uploading" : undefined}
              >
                <i className="bi bi-check-circle me-2"></i>
                {uploading > 0 ? `Uploading ${uploading}…` : isEdit ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
