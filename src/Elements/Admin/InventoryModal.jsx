import { useState } from "react";
import { numberFieldValue, readNumberField } from "../../utils/numberField";
import { formatExpiryDate } from "../../utils/inventoryValidation";

// In the order they appear, so a failed save can jump to the first one.
const FIELDS = ["name", "price", "stock", "minStock", "expiryDate"];

/**
 * Add / Edit Product. `errors` comes from getProductErrors (inventoryValidation.js).
 * A field's problem shows once that field has been left, or for every field once
 * Add is pressed, so a fresh form does not open covered in red.
 *
 * Once a product is in the inventory, editing changes only the price. Name,
 * category and min stock stay as they were added; stock and the expiry date
 * change through Restock (and stock goes down through sales).
 */
export default function InventoryModal({ form, setForm, editId, errors = {}, onClose, onSave }) {
  const locked = Boolean(editId);
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const errorFor = (field) => ((attempted || touched[field]) && errors[field]) || "";
  const touch = (field) => setTouched((previous) => ({ ...previous, [field]: true }));
  const fieldProps = (field) => ({
    id: `inventory-${field}`,
    onBlur: () => touch(field),
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `inventory-${field}-error` : undefined,
  });
  const inputClass = (field, base = "form-control") => `${base}${errorFor(field) ? " inventory-input-error" : ""}`;
  // A field fixed once the product was added: shown, but not changed here.
  const lockedProps = locked ? { readOnly: true, "aria-readonly": true, className: "form-control inventory-locked" } : {};
  const lockIcon = locked ? <i className="bi bi-lock-fill inventory-lock-icon" aria-label="Cannot be changed"></i> : null;
  const errorText = (field) =>
    errorFor(field) ? (
      <div id={`inventory-${field}-error`} className="inventory-field-error" role="alert">
        <i className="bi bi-exclamation-circle me-1" aria-hidden="true"></i>
        {errorFor(field)}
      </div>
    ) : null;

  const save = () => {
    const firstError = FIELDS.find((field) => errors[field]);
    if (firstError) {
      setAttempted(true);
      document.getElementById(`inventory-${firstError}`)?.focus();
      return;
    }
    onSave();
  };

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
              {locked ? (
                <div className="inventory-lock-note">
                  <i className="bi bi-lock-fill"></i>
                  <span>
                    Only the price can be changed here. Name, category and min stock stay as they were added; stock and
                    expiry date change through Restock.
                  </span>
                </div>
              ) : (
                <div className="inventory-product-number-note">
                  <i className="bi bi-hash"></i>
                  <span>Product No. is assigned automatically when the product is added.</span>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label" htmlFor="inventory-name">Product Name{lockIcon}</label>
                <input
                  type="text"
                  className={inputClass("name")}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Coca Cola"
                  maxLength={80}
                  {...fieldProps("name")}
                  {...lockedProps}
                />
                {errorText("name")}
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="inventory-category">Category{lockIcon}</label>
                <select
                  id="inventory-category"
                  className={`form-select${locked ? " inventory-locked" : ""}`}
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  disabled={locked}
                >
                  {["Food", "Drinks/Liquor", "Equipment", "Other"].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label" htmlFor="inventory-price">Price per piece (₱)</label>
                  <input
                    type="number"
                    className={inputClass("price")}
                    value={numberFieldValue(form.price)}
                    onChange={e => setForm({ ...form, price: readNumberField(e) })}
                    min="0"
                    step="0.01"
                    placeholder="0"
                    {...fieldProps("price")}
                  />
                  {errorText("price") || <small className="form-text text-muted">Selling price for one piece.</small>}
                </div>
                <div className="col-4">
                  <label className="form-label" htmlFor="inventory-stock">Stock (pcs){lockIcon}</label>
                  <input
                    type="number"
                    className={inputClass("stock")}
                    value={numberFieldValue(form.stock)}
                    onChange={e => setForm({ ...form, stock: readNumberField(e) })}
                    min="0"
                    step="1"
                    placeholder="0"
                    {...fieldProps("stock")}
                    {...lockedProps}
                  />
                  {errorText("stock")}
                </div>
                <div className="col-4">
                  <label className="form-label" htmlFor="inventory-minStock">Min Stock (pcs){lockIcon}</label>
                  <input
                    type="number"
                    className={inputClass("minStock")}
                    value={numberFieldValue(form.minStock)}
                    onChange={e => setForm({ ...form, minStock: readNumberField(e) })}
                    min="0"
                    step="1"
                    placeholder="0"
                    {...fieldProps("minStock")}
                    {...lockedProps}
                  />
                  {errorText("minStock")}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="inventory-expiryDate">Expiry Date{lockIcon}</label>
                {locked ? (
                  <input
                    id="inventory-expiryDate"
                    type="text"
                    value={form.expiryDate ? formatExpiryDate(form.expiryDate) : "No expiry date"}
                    {...lockedProps}
                  />
                ) : (
                  <input
                    type="date"
                    className={inputClass("expiryDate")}
                    value={form.expiryDate || ""}
                    onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                    {...fieldProps("expiryDate")}
                  />
                )}
                {errorText("expiryDate")}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-success" onClick={save}>
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
