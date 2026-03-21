export default function InventoryModal({ form, setForm, editId, onClose, onSave }) {
  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content inventory-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-box-seam me-2"></i>
                {editId ? "Edit Product" : "Add Product"}
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={onClose}
              ></button>
            </div>
            
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Product Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  placeholder="e.g. Coca Cola"
                />
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label">Category</label>
                  <select 
                    className="form-select" 
                    value={form.category} 
                    onChange={e => setForm({ ...form, category: e.target.value })}
                  >
                    {["Food", "Beverage", "Equipment", "Other"].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label">Unit</label>
                  <select 
                    className="form-select" 
                    value={form.unit} 
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                  >
                    {["pcs", "box", "bottle", "can", "pack"].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label">Price (₱)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={form.price} 
                    onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                    min="0"
                  />
                </div>
                <div className="col-4">
                  <label className="form-label">Stock</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={form.stock} 
                    onChange={e => setForm({ ...form, stock: Number(e.target.value) })}
                    min="0"
                  />
                </div>
                <div className="col-4">
                  <label className="form-label">Min Stock</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={form.minStock} 
                    onChange={e => setForm({ ...form, minStock: Number(e.target.value) })}
                    min="0"
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-success" onClick={onSave}>
                <i className="bi bi-check-circle me-2"></i>
                {editId ? "Update" : "Add"} Product
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}