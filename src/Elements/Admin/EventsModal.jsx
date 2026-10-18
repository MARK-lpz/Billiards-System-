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
        <div className="modal-dialog modal-dialog-centered events-modal-dialog">
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

            {/* Two columns on a wide screen: the event itself on the left, what
                the website shows and the tables it holds on the right. */}
            <div className="modal-body events-modal-body">
              <section className="events-modal-panel" aria-labelledby="events-modal-details">
                <h6 className="events-modal-heading" id="events-modal-details">
                  <i className="bi bi-card-text" aria-hidden="true"></i>
                  Event details
                </h6>

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

                <div className="mb-3">
                  <label className="form-label" htmlFor="event-gameType">Game Type</label>
                  <select
                    id="event-gameType"
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

                <div className="mb-3">
                  <div className="events-modal-pair">
                    <div>
                      <label className="form-label" htmlFor="event-date">Date</label>
                      <input
                        id="event-date"
                        type="date"
                        className={`form-control ${scheduleError ? "events-input-error" : ""}`}
                        min={getTodayDate()}
                        value={form.date}
                        onChange={e => setForm({ ...form, date: e.target.value })}
                        aria-invalid={Boolean(scheduleError)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="event-time">Time</label>
                      <input
                        id="event-time"
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

                {/* Prize Pool and Entry Fee */}
                <div className="events-modal-pair">
                  <div>
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
                  <div>
                    <label className="form-label" htmlFor="event-entryFee">Entry Fee (₱)</label>
                    <input
                      type="number"
                      value={numberFieldValue(form.entryFee)}
                      onChange={e => setForm({ ...form, entryFee: readNumberField(e) })}
                      min="0"
                      step="0.01"
                      placeholder="0"
                      {...fieldProps("entryFee")}
                      aria-describedby={errorFor("entryFee") ? "event-entryFee-error" : "event-entryFee-help"}
                    />
                    <FieldError id="event-entryFee-error" message={errorFor("entryFee")} />
                  </div>
                </div>
                <small className="form-text text-muted events-modal-help" id="event-entryFee-help">
                  Players pay the entry fee through GCash when they register. Leave it at 0 for a free tournament.
                </small>
              </section>

              <div className="events-modal-side">
                {/* Pictures and videos for the website */}
                <section className="events-modal-panel">
                  <EventMediaField media={form.media || []} setMedia={setMedia} uploads={uploads} setUploads={setUploads} />
                </section>

                {/* Table Assignment */}
                <section className="events-modal-panel" aria-labelledby="events-modal-tables">
                  <h6 className="events-modal-heading" id="events-modal-tables">
                    <i className="bi bi-grid-3x3-gap" aria-hidden="true"></i>
                    Assign Tables
                    {form.tables?.length > 0 && <span className="event-media-count">{form.tables.length} picked</span>}
                  </h6>
                  <div className="events-modal-tables" id="event-tables" tabIndex={-1}>
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
                            aria-pressed={Boolean(selected)}
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
                </section>
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
