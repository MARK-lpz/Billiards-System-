import { useRef } from "react";
import { formatHoursLabel } from "../../utils/reservations";
import { formatClockTime } from "../../utils/tableCharges";
import { printElement } from "../../utils/printElement";

const printReceipt = (paper) => printElement(paper, { title: "Receipt", bodyClass: "rcpt-print-body" });

const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatReceiptDate = (date) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date || ""
    : parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const ReceiptRow = ({ label, value, className = "" }) => (
  <div className={`rcpt-row ${className}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

/**
 * The receipt for one payment: table time and anything bought, in one place.
 * `justPaid` shows it as the confirmation right after paying; from Transaction
 * History it opens as a copy that can be printed again.
 */
export default function ReceiptModal({ receipt, onClose, justPaid = true }) {
  const paperRef = useRef(null);
  const tableCharges = receipt.tableCharges || [];
  const items = (receipt.items || []).filter((item) => !item.isTableCharge);
  const details = receipt.paymentDetails || {};
  const isCash = receipt.method === "cash";
  // The same number Transaction History shows for this sale.
  const receiptNo = String(receipt.id).slice(-5);

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content receipt-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className={`bi ${justPaid ? "bi-check-circle" : "bi-receipt"}`}></i>
                {justPaid ? "Payment Successful" : `Receipt #${receiptNo}`}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              <div className="rcpt-paper" ref={paperRef}>
                <div className="rcpt-brand">BREAK &amp; CHILL</div>
                <div className="rcpt-muted rcpt-center">Billiard Hall</div>
                <div className="rcpt-muted rcpt-center">Official Receipt</div>

                <div className="rcpt-rule" />
                <ReceiptRow label="Receipt No." value={`#${receiptNo}`} />
                <ReceiptRow label="Date" value={formatReceiptDate(receipt.date)} />
                <ReceiptRow label="Time" value={receipt.time} />
                <ReceiptRow label="Cashier" value={receipt.cashier || "Staff"} />
                {receipt.customerName ? <ReceiptRow label="Customer" value={receipt.customerName} /> : null}
                {receipt.tableName && !tableCharges.length ? <ReceiptRow label="Table" value={receipt.tableName} /> : null}

                {tableCharges.length > 0 && (
                  <>
                    <div className="rcpt-rule" />
                    <div className="rcpt-section">Pool Table</div>
                    {tableCharges.map((charge) => (
                      <div key={charge.id} className="rcpt-line">
                        <ReceiptRow label={charge.tableName} value={fmtPeso(charge.sessionTotal)} className="rcpt-strong" />
                        <div className="rcpt-muted">
                          Time in {formatClockTime(charge.startTime)} · Time out {formatClockTime(charge.endTime)}
                        </div>
                        <div className="rcpt-muted">
                          {formatHoursLabel(charge.bookedMinutes)} × {fmtPeso(charge.rate)}/hr
                          {charge.addedMinutes > 0 ? ` (incl. ${formatHoursLabel(charge.addedMinutes)} added)` : ""}
                        </div>
                        {charge.prepaid && (
                          <ReceiptRow
                            label={`Less: paid online${charge.prepaid.reference ? ` (GCash ${charge.prepaid.reference})` : ""}`}
                            value={`-${fmtPeso(charge.prepaid.amount)}`}
                            className="rcpt-muted"
                          />
                        )}
                      </div>
                    ))}
                  </>
                )}

                {items.length > 0 && (
                  <>
                    <div className="rcpt-rule" />
                    <div className="rcpt-section">Items</div>
                    {items.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="rcpt-line">
                        <ReceiptRow
                          label={`${item.name}${item.isExtra ? " (Extra)" : ""}`}
                          value={fmtPeso(item.price * item.qty)}
                        />
                        <div className="rcpt-muted">
                          {item.qty} × {fmtPeso(item.price)}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div className="rcpt-rule" />
                <ReceiptRow label="Subtotal" value={fmtPeso(receipt.subtotal ?? receipt.total)} />
                {receipt.discAmt > 0 && (
                  <ReceiptRow label={receipt.discLabel} value={`-${fmtPeso(receipt.discAmt)}`} />
                )}
                <ReceiptRow label="TOTAL" value={fmtPeso(receipt.total)} className="rcpt-total" />

                <div className="rcpt-rule" />
                <ReceiptRow label="Paid by" value={isCash ? "Cash" : "GCash"} />
                {details.cashReceived !== null && details.cashReceived !== undefined && (
                  <>
                    <ReceiptRow label="Cash received" value={fmtPeso(details.cashReceived)} />
                    <ReceiptRow label="Change" value={fmtPeso(details.change)} />
                  </>
                )}
                {details.referenceNumber && (
                  <>
                    <ReceiptRow label="GCash reference" value={details.referenceNumber} />
                    {details.referenceVerified && <ReceiptRow label="Reference check" value={`Verified by ${receipt.cashier}`} />}
                  </>
                )}

                <div className="rcpt-rule" />
                <div className="rcpt-muted rcpt-center">Thank you for playing at Break &amp; Chill!</div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => printReceipt(paperRef.current)}>
                <i className="bi bi-printer"></i>
                Print
              </button>
              <button type="button" className="btn btn-success" onClick={onClose}>
                <i className="bi bi-check-circle"></i>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
