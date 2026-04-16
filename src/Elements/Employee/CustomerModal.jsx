import { useState } from "react";

export default function CustomerModal({ customer, onSave, onDelete, onClose }) {
  const isEdit = !!customer;
  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [notes, setNotes] = useState(customer?.notes || "");

  const handleSave = () => {
    if (!name.trim()) return;

    if (isEdit) {
      onSave({
        ...customer,
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
      });
    } else {
      onSave({
        id: Date.now(),
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        visits: 0,
        totalSpent: 0,
        lastVisit: "—",
        loyalty: "Bronze",
      });
    }
  };

  return (
    <>
      {/* Backdrop (separate layer) */}
      <div className="modal-backdrop show" onClick={onClose}></div>

      {/* Modal */}
      <div className="modal show" style={{ display: "flex" }}>
        <div className="modal-dialog">
          <div className="modal-content">

            {/* Header */}
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-person"></i>
                {isEdit ? "Edit Customer" : "New Customer"}
              </h5>
              <button className="btn-close" onClick={onClose} type="button" />
            </div>

            {/* Body */}
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Full Name</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. Juan Cruz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Phone Number</label>
                <input
                  className="form-control"
                  type="tel"
                  placeholder="e.g. 09171234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control"
                  placeholder="e.g. Prefers Table 3..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer">
              {isEdit && (
                <button
                  className="btn btn-danger"
                  onClick={() => onDelete(customer.id)}
                  type="button"
                >
                  <i className="bi bi-trash"></i> Delete
                </button>
              )}

              <button
                className="btn btn-secondary"
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!name.trim()}
                type="button"
              >
                {isEdit ? "Save Changes" : "Add Customer"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}