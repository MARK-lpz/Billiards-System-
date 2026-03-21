export default function PoolTableModal({ form, setForm, editId, onClose, onSave }) {
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
                <label className="form-label">Table Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  placeholder="e.g. Table 10"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Hourly Rate (₱)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={form.rate} 
                  onChange={e => setForm({ ...form, rate: Number(e.target.value) })}
                  min="0"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-success" onClick={onSave}>
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