import { formatHoursLabel } from "../../utils/reservations";
import { formatClockTime } from "../../utils/tableCharges";

const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Ended table sessions waiting to be paid. Staff add one to the running bill so
 * the customer pays table time and food in one payment, on one receipt.
 */
export default function TableBillsPanel({ charges = [], cart = [], onAddToBill }) {
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
            const onBill = cart.some((item) => item.chargeId === charge.id);

            return (
              <div key={charge.id} className={`table-bill-card ${onBill ? "on-bill" : ""}`}>
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
                </div>

                <div className="table-bill-side">
                  <strong className="table-bill-amount">{fmtPeso(charge.amountDue)}</strong>
                  <button
                    type="button"
                    className="table-bill-btn"
                    onClick={() => onAddToBill(charge)}
                    disabled={onBill}
                  >
                    <i className={`bi ${onBill ? "bi-check2" : "bi-plus-lg"}`}></i>
                    {onBill ? "On Bill" : "Add to Bill"}
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
