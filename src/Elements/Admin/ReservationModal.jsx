import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";

export default function ReservationModal({ form, setForm, editId, tables, onClose, onSave }) {
  const phoneWarning = getSmsWarning(form.phone);
  const phoneIsValid = !form.phone.trim() || isValidSmsNumber(form.phone);

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content reservations-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-calendar-check me-2"></i>
                {editId ? "Edit Reservation" : "New Reservation"}
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={onClose}
              ></button>
            </div>
            
            <div className="modal-body">
              {/* Customer Name */}
              <div className="mb-3">
                <label className="form-label">Customer Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Full name"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: sanitizePhoneInput(e.target.value) })}
                  placeholder="09XXXXXXXXX"
                  inputMode="numeric"
                  maxLength="11"
                />
                {phoneWarning && (
                  <div className="reservations-field-warning">{phoneWarning}</div>
                )}
              </div>

              {/* Date & Time */}
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label">Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={form.date} 
                    onChange={e => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label">Time</label>
                  <input 
                    type="time" 
                    className="form-control" 
                    value={form.time} 
                    onChange={e => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>

              {/* Table & Pax */}
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label">Table</label>
                  <select 
                    className="form-select" 
                    value={form.tableId}
                    onChange={e => setForm({ ...form, tableId: e.target.value })}
                  >
                    <option value="">Select table...</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label">Number of Pax</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={form.partySize}
                    onChange={e => setForm({ ...form, partySize: Number(e.target.value) })}
                    min="1"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="mb-3">
                <label className="form-label">Notes (optional)</label>
                <textarea 
                  className="form-control" 
                  value={form.notes} 
                  onChange={e => setForm({ ...form, notes: e.target.value })} 
                  placeholder="Any special requests..."
                  rows="3"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={onSave}
                disabled={
                  !form.customerName.trim() ||
                  !phoneIsValid ||
                  !form.date ||
                  !form.time ||
                  !form.tableId
                }
              >
                <i className="bi bi-check-circle me-2"></i>
                {editId ? "Save Changes" : "Create Reservation"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
