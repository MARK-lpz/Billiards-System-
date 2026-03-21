export default function EquipmentModal({ form, setForm, editId, onClose, onSave }) {
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
                onClick={onClose}
              ></button>
            </div>
            
            <div className="modal-body">
              {/* Equipment Name */}
              <div className="mb-3">
                <label className="form-label">Equipment Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  placeholder="e.g. Cue Stick #3"
                />
              </div>

              {/* Type */}
              <div className="mb-3">
                <label className="form-label">Type</label>
                <select 
                  className="form-select" 
                  value={form.type} 
                  onChange={e => setForm({ ...form, type: e.target.value })}
                >
                  {["Cue Stick", "Ball Set", "Chalk", "Rack", "Bridge", "Other"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Condition & Status */}
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label">Condition</label>
                  <select 
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
                <div className="col-6">
                  <label className="form-label">Status</label>
                  <select 
                    className="form-select" 
                    value={form.status} 
                    onChange={e => setForm({ ...form, status: e.target.value })}
                  >
                    {["active", "repair", "lost"].map(s => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Last Maintenance */}
              <div className="mb-3">
                <label className="form-label">Last Maintenance Date</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={form.lastMaintenance} 
                  onChange={e => setForm({ ...form, lastMaintenance: e.target.value })}
                />
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
                onClick={onSave}
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