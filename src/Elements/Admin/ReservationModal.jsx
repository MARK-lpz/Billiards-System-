export default function ReservationModal({ form, setForm, editId, tables, onClose, onSave }) {
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
                  value={form.customer} 
                  onChange={e => setForm({ ...form, customer: e.target.value })} 
                  placeholder="Full name"
                />
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
                    value={form.table} 
                    onChange={e => setForm({ ...form, table: Number(e.target.value) })}
                  >
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
                    value={form.pax} 
                    onChange={e => setForm({ ...form, pax: Number(e.target.value) })}
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
              <button type="button" className="btn btn-success" onClick={onSave}>
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