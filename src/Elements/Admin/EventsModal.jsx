export default function EventsModal({ form, setForm, tables = [], isEdit = false, onClose, onSave }) {
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
                <label className="form-label">Event Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  placeholder="e.g. Monthly 8-Ball Tournament"
                />
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

              {/* Prize Pool */}
              <div className="mb-3">
                <label className="form-label">Prize Pool (₱)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={form.prize} 
                  onChange={e => setForm({ ...form, prize: Number(e.target.value) })}
                  min="0"
                  placeholder="10000"
                />
              </div>

              {/* Table Assignment */}
              <div className="mb-3">
                <label className="form-label">Assign Tables</label>
                <div className="d-flex flex-wrap gap-3">
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
                <i className="bi bi-check-circle me-2"></i>
                {isEdit ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
