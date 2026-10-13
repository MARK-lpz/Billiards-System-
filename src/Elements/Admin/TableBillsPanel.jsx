import { formatHoursLabel } from "../../utils/reservations";
import { formatClockTime } from "../../utils/tableCharges";
import { findChargeBill, getChargeTarget } from "../../utils/posBills";

const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Ended table sessions waiting to be paid. Staff add one to a bill so the
 * customer pays table time and food in one payment, on one receipt. Each goes
 * to its own table's bill, never onto another table's.
 */
export default function TableBillsPanel({ charges = [], bills = [], activeBill = null, onAddToBill }) {
  return (
    <div className="table-bills-panel">
      <div className="table-bills-header">
        <span>
          <i className="bi bi-grid-3x3-gap-fill"></i>
          Pool Table Bills
        </span>
        <span className={`table-bills-count ${charges.length ? "has-bills" : ""}`}>
          {charges.length ? `${charges.length} waiting` : "None waiting"}
        </span>
      </div>

      {charges.length === 0 ? (
        <p className="table-bills-empty">When a table session ends, its bill shows up here to be paid.</p>
      ) : (
        <div className="table-bills-list">
          {charges.map((charge) => {
            const chargeBill = findChargeBill(bills, charge.id);
            const target = chargeBill ? null : getChargeTarget({ charge, bills, activeBill });
            const destination = chargeBill
              ? `On ${chargeBill.label}`
              : target
                ? `Adds to ${target.label}`
                : `Opens a new bill for ${charge.tableName}`;

            return (
              <div key={charge.id} className={`table-bill-card ${chargeBill ? "on-bill" : ""}`}>
                <div className="table-bill-main">
                  <div className="table-bill-title">
                    <strong>{charge.tableName}</strong>
                    <span>{charge.customer}</span>
                  </div>
                  <div className="table-bill-meta">
                    {formatHoursLabel(charge.bookedMinutes)} · {formatClockTime(charge.startTime)} -{" "}
                    {formatClockTime(charge.endTime)}
                  </div>
                  {charge.prepaid && (
                    <div className="table-bill-prepaid">
                      {fmtPeso(charge.prepaid.amount)} already paid online · only the added time is due
                    </div>
                  )}
                  <div className="table-bill-destination">
                    <i className={`bi ${chargeBill ? "bi-check2-circle" : "bi-arrow-return-right"}`}></i>
                    {destination}
                  </div>
                </div>

                <div className="table-bill-side">
                  <strong className="table-bill-amount">{fmtPeso(charge.amountDue)}</strong>
                  <button
                    type="button"
                    className="table-bill-btn"
                    onClick={() => onAddToBill(charge)}
                    disabled={Boolean(chargeBill)}
                  >
                    <i className={`bi ${chargeBill ? "bi-check2" : "bi-plus-lg"}`}></i>
                    {chargeBill ? "On Bill" : "Add to Bill"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
