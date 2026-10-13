import { useEffect, useState } from "react";
import FieldError from "../Global/FieldError";
import useFormErrors from "../Global/useFormErrors";
import useClock from "../Global/useClock";
import { getBorrowErrors } from "../../utils/formValidation";
import { closedAt, isClosedToday, isOut } from "../../utils/borrowLog";
import { EQUIPMENT_TYPES, getEquipmentTable, getSpareEquipment } from "../../utils/equipment";

const defaultBorrowForm = {
  itemType: "Cue Stick",
  itemCode: "",
  borrower: "",
  notes: "",
};

const FIELDS = ["itemType", "itemCode", "borrower"];
const MAX_NOTES = 120;

const sameName = (first, second) =>
  String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();

/**
 * Log Borrow. Kept in its own component so that, keyed by the modal, a saved
 * borrow starts a fresh form with no errors showing.
 */
function BorrowForm({ equipment, tables, records, reportedItemIds, available, onSave, onReportIssue }) {
  const [form, setForm] = useState(defaultBorrowForm);
  const { errors, item } = getBorrowErrors({ form, equipment, tables, records, reportedItemIds });
  const { errorFor, touch, canSave } = useFormErrors(errors);

  const fieldProps = (field, className) => ({
    id: `borrow-${field}`,
    onBlur: () => touch(field),
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `borrow-${field}-error` : undefined,
    className: `${className}${errorFor(field) ? " form-input-error" : ""}`,
  });

  // Picking a registered item brings its type along, so the two always agree.
  const chooseItem = (value) => {
    const match = equipment.find((entry) => sameName(entry.name, value));
    setForm((previous) => ({
      ...previous,
      itemCode: value,
      itemType: match && EQUIPMENT_TYPES.includes(match.type) ? match.type : previous.itemType,
    }));
  };

  const availableOfType = available.filter((entry) => entry.type === form.itemType);

  const submit = (event) => {
    event.preventDefault();
    if (!canSave(FIELDS, "borrow-")) return;
    onSave({
      itemId: item.id,
      itemType: item.type,
      itemCode: item.name,
      borrower: form.borrower.trim().replace(/\s+/g, " "),
      notes: form.notes.trim(),
    });
  };

  return (
    <form onSubmit={submit} className="qa-form-stack" noValidate>
      <p className="qa-borrow-copy">
        For spare equipment lent from the counter. Each table&apos;s own cue sticks and ball set stay with it.
      </p>
      <div className="qa-form-row">
        <select
          aria-label="Item type"
          value={form.itemType}
          onChange={(event) => setForm({ ...form, itemType: event.target.value })}
          {...fieldProps("itemType", "form-select")}
        >
          {EQUIPMENT_TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
        <input
          placeholder="Item name or code"
          aria-label="Item name or code"
          maxLength={40}
          list="qa-spare-equipment"
          autoComplete="off"
          value={form.itemCode}
          onChange={(event) => chooseItem(event.target.value)}
          {...fieldProps("itemCode", "form-control")}
        />
        <datalist id="qa-spare-equipment">
          {availableOfType.map((entry) => {
            const table = getEquipmentTable(entry, tables);
            return (
              <option key={entry.id} value={entry.name}>
                {table ? `Spare for ${table.name || `Table ${table.id}`}` : "Unassigned spare"}
              </option>
            );
          })}
        </datalist>
      </div>
      <FieldError id="borrow-itemType-error" message={errorFor("itemType")} />
      <FieldError id="borrow-itemCode-error" message={errorFor("itemCode")} />
      <small className="qa-borrow-hint">
        {availableOfType.length
          ? `${availableOfType.length} spare ${form.itemType.toLowerCase()}${availableOfType.length === 1 ? "" : "s"} free to lend.`
          : `No spare ${form.itemType.toLowerCase()} is free to lend right now.`}
      </small>
      <input
        placeholder="Borrower / player name"
        aria-label="Borrower"
        maxLength={40}
        value={form.borrower}
        onChange={(event) => setForm({ ...form, borrower: event.target.value })}
        {...fieldProps("borrower", "form-control")}
      />
      <FieldError id="borrow-borrower-error" message={errorFor("borrower")} />
      <input
        className="form-control"
        placeholder="Notes (optional)"
        aria-label="Notes"
        maxLength={MAX_NOTES}
        value={form.notes}
        onChange={(event) => setForm({ ...form, notes: event.target.value })}
      />
      <button type="submit" className="btn btn-success">
        <i className="bi bi-box-arrow-up-right"></i> Log Borrow
      </button>
      <button type="button" className="qa-link-btn" onClick={() => onReportIssue()}>
        <i className="bi bi-exclamation-diamond"></i> Something broken? Report an issue instead.
      </button>
    </form>
  );
}

/**
 * Spare equipment lent out from the counter (a table's own set stays with the
 * table), and when it comes back. A return asks how the item came back, and a
 * damaged one goes on to Report Issue. The log opens on what is still out;
 * returns show under their own tab for the day they came back.
 */
export default function BorrowLogModal({
  records = [],
  equipment = [],
  tables = [],
  reportedItemIds = new Set(),
  onBorrow,
  onReturn,
  onReportIssue,
  onClose,
}) {
  const [formKey, setFormKey] = useState(0);
  const [returningId, setReturningId] = useState(null);
  // "out" or "returned".
  const [tab, setTab] = useState("out");
  const now = useClock(60000);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const outNames = records.filter((record) => record.status === "borrowed").map((record) => record.itemCode);
  const available = getSpareEquipment(equipment, tables).filter(
    (item) =>
      item.status === "active" &&
      item.condition !== "damaged" &&
      !reportedItemIds.has(String(item.id)) &&
      !outNames.some((name) => sameName(name, item.name))
  );

  const outRecords = records.filter(isOut);
  // Latest return first.
  const returnedToday = records
    .filter((record) => isClosedToday(record, now))
    .sort((first, second) => closedAt(second) - closedAt(first));
  const shown = tab === "out" ? outRecords : returnedToday;

  // A new loan shows under Out now.
  const saveBorrow = (details) => {
    onBorrow(details);
    setFormKey((key) => key + 1);
    setTab("out");
  };

  const logReturn = (id, damaged) => {
    setReturningId(null);
    onReturn(id, { damaged });
  };

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className="modal show" style={{ display: "flex" }} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
          <div className="modal-content qa-borrow-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-arrow-left-right"></i> Borrow / Return
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              <BorrowForm
                key={formKey}
                equipment={equipment}
                tables={tables}
                records={records}
                reportedItemIds={reportedItemIds}
                available={available}
                onSave={saveBorrow}
                onReportIssue={onReportIssue}
              />

              <div className="qa-equipment-log">
                <div className="qa-log-head">
                  <div className="qa-equipment-heading">Borrow / Return Log</div>
                  <div className="qa-log-tabs" role="tablist" aria-label="Borrow / Return Log">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === "out"}
                      className={`qa-log-tab${tab === "out" ? " is-active" : ""}`}
                      onClick={() => setTab("out")}
                    >
                      Out now <span className="qa-log-tab-count">{outRecords.length}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === "returned"}
                      className={`qa-log-tab${tab === "returned" ? " is-active" : ""}`}
                      onClick={() => setTab("returned")}
                    >
                      Returned today <span className="qa-log-tab-count">{returnedToday.length}</span>
                    </button>
                  </div>
                </div>
                {shown.length === 0 ? (
                  <div className="qa-empty qa-empty--compact">
                    <i className={`bi ${tab === "out" ? "bi-box-seam" : "bi-check2-circle"} qa-empty-icon`}></i>
                    <p className="qa-empty-text">
                      {tab === "out" ? "Nothing is out right now." : "Nothing has come back yet today."}
                    </p>
                  </div>
                ) : (
                  <div className="qa-equipment-list">
                    {shown.map((record) => (
                      <div key={record.id} className="qa-equipment-item">
                        <div className="qa-equipment-info">
                          <div className="qa-equipment-name">
                            {record.itemType} • {record.itemCode}
                          </div>
                          <div className="qa-equipment-meta">
                            {record.status === "borrowed"
                              ? `Borrowed by ${record.borrower} at ${record.borrowedAt}`
                              : record.status === "returned"
                                ? `${record.borrower} returned it at ${record.returnedAt}`
                                : `Damage logged at ${record.loggedAt}`}
                          </div>
                          {record.notes ? <div className="qa-equipment-meta">{record.notes}</div> : null}
                        </div>

                        <div className="qa-equipment-actions">
                          <span className={`qa-badge qa-badge--${record.status}`}>{record.status}</span>
                          {record.returnCondition === "damaged" && (
                            <span className="qa-badge qa-badge--damaged">damaged</span>
                          )}
                          {record.status === "borrowed" && returningId !== record.id && (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => setReturningId(record.id)}>
                              Log Return
                            </button>
                          )}
                        </div>

                        {record.status === "borrowed" && returningId === record.id && (
                          <div className="qa-return-check" role="group" aria-label={`How did ${record.itemCode} come back?`}>
                            <span>How did it come back?</span>
                            <button type="button" className="qa-return-btn qa-return-btn--good" onClick={() => logReturn(record.id, false)}>
                              <i className="bi bi-check-circle"></i> Good
                            </button>
                            <button type="button" className="qa-return-btn qa-return-btn--damaged" onClick={() => logReturn(record.id, true)}>
                              <i className="bi bi-exclamation-triangle"></i> Damaged
                            </button>
                            <button
                              type="button"
                              className="qa-return-btn qa-return-btn--cancel"
                              aria-label="Cancel the return"
                              onClick={() => setReturningId(null)}
                            >
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {tab === "returned" && (
                  <p className="qa-log-note">
                    <i className="bi bi-info-circle" aria-hidden="true"></i> Only today&apos;s returns are listed. Earlier
                    ones stay in the activity log.
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
