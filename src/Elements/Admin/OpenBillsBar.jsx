const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Every bill still open, one per table or walk-in customer. Tapping one brings it
 * up in the Running Bill, so staff can go back to any table's order.
 */
export default function OpenBillsBar({ bills = [], activeBillId, onSwitch, onNewBill }) {
  return (
    <div className="open-bills-bar">
      <div className="open-bills-header">
        <span className="open-bills-title">
          <i className="bi bi-receipt"></i>
          Open Bills
          <span className={`open-bills-count ${bills.length ? "has-bills" : ""}`}>{bills.length}</span>
        </span>
        <button type="button" className="open-bills-new-btn" onClick={onNewBill}>
          <i className="bi bi-plus-lg"></i>
          New Bill
        </button>
      </div>

      {bills.length === 0 ? (
        <p className="open-bills-empty">
          No open bills. Open one for a table, or tap an item below to start a walk-in bill.
        </p>
      ) : (
        <div className="open-bills-list" role="group" aria-label="Open bills">
          {bills.map((bill) => {
            const isActive = bill.id === activeBillId;

            return (
              <button
                key={bill.id}
                type="button"
                className={`open-bill-chip ${isActive ? "is-active" : ""}`}
                aria-pressed={isActive}
                onClick={() => onSwitch(bill.id)}
              >
                <span className="open-bill-name">
                  <i className={`bi ${bill.tableId !== null ? "bi-grid-3x3-gap-fill" : "bi-person-fill"}`}></i>
                  <span>{bill.label}</span>
                </span>
                <span className="open-bill-meta">
                  <strong>{fmtPeso(bill.total)}</strong>
                  <span>
                    {bill.lineCount} {bill.lineCount === 1 ? "item" : "items"}
                  </span>
                  {bill.waitingQty > 0 && <span className="open-bill-waiting">{bill.waitingQty} waiting</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
