import { useEffect, useState } from "react";
import FieldError from "../Global/FieldError";
import useFormErrors from "../Global/useFormErrors";
import { MAX_BILL_NAME, buildBillLabel, findTableBill, getBillErrors } from "../../utils/posBills";

const FIELDS = ["tableId", "customer"];

const STATUS_LABELS = {
  occupied: "playing",
  reserved: "reserved",
  available: "free",
  maintenance: "maintenance",
};

/** Opens a new bill, or changes who an open bill is for (`bill` is set when editing). */
export default function BillDetailsModal({ bill = null, tables = [], bills = [], onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    tableId: bill?.tableId !== null && bill?.tableId !== undefined ? String(bill.tableId) : "",
    customer: bill?.customer || "",
  }));
  const errors = getBillErrors({ form, tables, bills, editId: bill?.id ?? null });
  const { errorFor, touch, canSave } = useFormErrors(errors);

  // Table time already on the bill belongs to that table, so it cannot be moved.
  const tableLocked = Boolean(bill?.cart.some((item) => item.isTableCharge));
  const table = tables.find((entry) => String(entry.id) === form.tableId) || null;
  const preview = buildBillLabel({
    tableName: table ? table.name : "",
    customer: form.customer,
    bills,
    excludeId: bill?.id ?? null,
  });

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // The player's name comes along with the table, unless staff already typed one.
  const chooseTable = (tableId) => {
    const previous = tables.find((entry) => String(entry.id) === form.tableId);
    const next = tables.find((entry) => String(entry.id) === tableId);
    const keepName = form.customer.trim() && form.customer !== (previous?.customer || "");
    setForm({ tableId, customer: keepName ? form.customer : next?.customer || "" });
  };

  const fieldProps = (field, className) => ({
    id: `bill-${field}`,
    onBlur: () => touch(field),
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `bill-${field}-error` : undefined,
    className: `${className}${errorFor(field) ? " form-input-error" : ""}`,
  });

  const save = () => {
    if (!canSave(FIELDS, "bill-")) return;
    // A bill keeps its table even when that table is no longer in the list.
    const keptTable =
      bill && bill.tableId !== null && String(bill.tableId) === form.tableId
        ? { id: bill.tableId, name: bill.tableName }
        : null;
    onSave({ table: table || keptTable, customer: form.customer.trim() });
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content bill-details-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className={`bi ${bill ? "bi-pencil-square" : "bi-receipt"} me-2`}></i>
                {bill ? "Edit Bill" : "Open a New Bill"}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              <p className="bill-details-copy">
                Each bill is paid on its own receipt, so every table can order and pay separately.
              </p>

              <div className="mb-3">
                <label className="form-label" htmlFor="bill-tableId">Bill for</label>
                <select
                  value={form.tableId}
                  onChange={(event) => chooseTable(event.target.value)}
                  disabled={tableLocked}
                  {...fieldProps("tableId", "form-select")}
                >
                  <option value="">Walk-in (no table)</option>
                  {tables.map((entry) => {
                    const openBill = findTableBill(bills, entry.id, bill?.id ?? null);
                    const status = STATUS_LABELS[entry.status] || entry.status || "";
                    const note = openBill ? "bill already open" : status;

                    return (
                      <option
                        key={entry.id}
                        value={String(entry.id)}
                        disabled={
                          Boolean(openBill) ||
                          (entry.status === "maintenance" && String(entry.id) !== String(bill?.tableId))
                        }
                      >
                        {entry.name}
                        {entry.customer ? ` · ${entry.customer}` : ""}
                        {note ? ` (${note})` : ""}
                      </option>
                    );
                  })}
                </select>
                <FieldError id="bill-tableId-error" message={errorFor("tableId")} />
                {tableLocked && (
                  <div className="form-blocked-note">
                    <i className="bi bi-lock-fill" aria-hidden="true"></i>
                    <span>This bill has table time on it, so its table can't be changed.</span>
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="bill-customer">
                  Customer name <span className="bill-details-optional">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.customer}
                  onChange={(event) => setForm({ ...form, customer: event.target.value })}
                  placeholder={table ? "Who is playing on this table?" : "e.g. Maria"}
                  maxLength={MAX_BILL_NAME + 10}
                  autoComplete="off"
                  {...fieldProps("customer", "form-control")}
                />
                <FieldError id="bill-customer-error" message={errorFor("customer")} />
              </div>

              <div className="bill-details-preview">
                <span>Shows as</span>
                <strong>{preview}</strong>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-success" onClick={save}>
                <i className="bi bi-check-circle me-2"></i>
                {bill ? "Save Bill" : "Open Bill"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
