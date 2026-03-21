export default function WalkInModal({ customer, onCustomerChange, onClose, onStart }) {
  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content pool-tables-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-person-plus me-2"></i>
                Walk-in Customer
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Customer Name (optional)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={customer} 
                  onChange={e => onCustomerChange(e.target.value)} 
                  placeholder="Walk-in Customer"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-success" onClick={onStart}>
                <i className="bi bi-play-circle me-2"></i>
                Start Session
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}