import { numberFieldValue, readNumberField } from "../../utils/numberField";

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
              <div className="inventory-product-number-note">
                <i className="bi bi-hash"></i>
                <span>Product No. is assigned automatically when the product is added.</span>
              </div>

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

              <div className="mb-3">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {["Food", "Drinks/Liquor", "Equipment", "Other"].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label">Price per piece (₱)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={numberFieldValue(form.price)}
                    onChange={e => setForm({ ...form, price: readNumberField(e) })}
                    min="0"
                    placeholder="0"
                  />
                  <small className="form-text text-muted">Selling price for one piece.</small>
                </div>
                <div className="col-4">
                  <label className="form-label">Stock (pcs)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={numberFieldValue(form.stock)}
                    onChange={e => setForm({ ...form, stock: readNumberField(e) })}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="col-4">
                  <label className="form-label">Min Stock (pcs)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={numberFieldValue(form.minStock)}
                    onChange={e => setForm({ ...form, minStock: readNumberField(e) })}
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Expiry Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.expiryDate || ""}
                  onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                />
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
