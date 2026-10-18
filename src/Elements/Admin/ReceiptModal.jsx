import { useRef } from "react";
import { formatHoursLabel } from "../../utils/reservations";
import { formatClockTime } from "../../utils/tableCharges";
import { printElement } from "../../utils/printElement";

const printReceipt = (paper, title) => printElement(paper, { title, bodyClass: "rcpt-print-body" });

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

const receiptNumber = (id) => String(id).slice(-5);

/**
 * The receipt for one payment: table time and anything bought, in one place.
 * `justPaid` shows it as the confirmation right after paying; from Transaction
 * History it opens as a copy that can be printed again.
 *
 * A table's block shows its whole session once it has ended: the time, every
 * order, and what was paid before (online, or while playing). A table paid while
 * still playing shows only what this payment covered. `sessionOnly` is the
 * summary of a session ended with nothing left to pay. It is not a sale, so it
 * says it is not a receipt; the receipts are the payments it lists.
 */
export default function ReceiptModal({ receipt, onClose, justPaid = true }) {
  const paperRef = useRef(null);
  const tableCharges = receipt.tableCharges || [];
  // What was ordered at a table is listed in that table's block.
  const items = (receipt.items || []).filter((item) => !item.isTableCharge && !item.fromTableCharge);
  const tableLines = (charge) => (receipt.items || []).filter((item) => item.chargeId === charge.id);
  const details = receipt.paymentDetails || {};
  const isCash = receipt.method === "cash";
  const sessionOnly = Boolean(receipt.sessionOnly);
  // The same number Transaction History shows for this sale.
  const receiptNo = receiptNumber(receipt.id);
  // A summary's sums: the whole stay (time and orders), and what was paid for it before.
  const stayTotal = tableCharges.reduce(
    (sum, charge) => sum + Number(charge.sessionTotal || 0) + (charge.orders || []).reduce((sub, line) => sub + line.price * line.qty, 0),
    0
  );
  const paidBefore = tableCharges.reduce(
    (sum, charge) =>
      sum + Number(charge.prepaid?.amount || 0) + (charge.payments || []).reduce((sub, payment) => sub + Number(payment.amount || 0), 0),
    0
  );

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content receipt-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className={`bi ${justPaid && !sessionOnly ? "bi-check-circle" : "bi-receipt"}`}></i>
                {sessionOnly ? "Session Ended" : justPaid ? "Payment Successful" : `Receipt #${receiptNo}`}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              <div className="rcpt-paper" ref={paperRef}>
                <div className="rcpt-brand">BREAK &amp; CHILL</div>
                <div className="rcpt-muted rcpt-center">Billiard Hall</div>
                {sessionOnly ? (
                  <>
                    <div className="rcpt-muted rcpt-center">Session Summary</div>
                    <div className="rcpt-muted rcpt-center">Not an official receipt</div>
                  </>
                ) : (
                  <div className="rcpt-muted rcpt-center">Official Receipt</div>
                )}

                <div className="rcpt-rule" />
                {!sessionOnly && <ReceiptRow label="Receipt No." value={`#${receiptNo}`} />}
                <ReceiptRow label="Date" value={formatReceiptDate(receipt.date)} />
                <ReceiptRow label="Time" value={receipt.time} />
                <ReceiptRow label="Cashier" value={receipt.cashier || "Staff"} />
                {receipt.customerName ? <ReceiptRow label="Customer" value={receipt.customerName} /> : null}
                {receipt.tableName && !tableCharges.length ? <ReceiptRow label="Table" value={receipt.tableName} /> : null}

                {tableCharges.length > 0 && (
                  <>
                    <div className="rcpt-rule" />
                    <div className="rcpt-section">Pool Table</div>
                    {tableCharges.map((charge) =>
                      charge.playing ? (
                        // Paid while still playing: what this payment covered.
                        <div key={charge.id} className="rcpt-line">
                          <ReceiptRow
                            label={charge.tableName}
                            value={fmtPeso(
                              tableLines(charge)
                                .filter((item) => item.isTableCharge)
                                .reduce((sum, item) => sum + item.price, 0)
                            )}
                            className="rcpt-strong"
                          />
                          <div className="rcpt-muted">
                            Time in {formatClockTime(charge.startTime)} · Still playing (until {formatClockTime(charge.endsAt)})
                          </div>
                          <div className="rcpt-muted">
                            {formatHoursLabel(charge.bookedMinutes)} × {fmtPeso(charge.rate)}/hr
                          </div>
                          {tableLines(charge)
                            .filter((item) => item.fromTableCharge)
                            .map((item, index) => (
                              <ReceiptRow
                                key={`${item.name}-${index}`}
                                label={`${item.name} ×${item.qty}`}
                                value={fmtPeso(item.price * item.qty)}
                              />
                            ))}
                        </div>
                      ) : (
                        <div key={charge.id} className="rcpt-line">
                          <ReceiptRow label={charge.tableName} value={fmtPeso(charge.sessionTotal)} className="rcpt-strong" />
                          <div className="rcpt-muted">
                            Time in {formatClockTime(charge.startTime)} · Time out {formatClockTime(charge.endTime)}
                          </div>
                          <div className="rcpt-muted">
                            {formatHoursLabel(charge.bookedMinutes)} × {fmtPeso(charge.rate)}/hr
                            {charge.addedMinutes > 0 ? ` (incl. ${formatHoursLabel(charge.addedMinutes)} added)` : ""}
                          </div>
                          {(charge.orders || []).map((line) => (
                            <ReceiptRow key={line.id} label={`${line.name} ×${line.qty}`} value={fmtPeso(line.price * line.qty)} />
                          ))}
                          {charge.prepaid && (
                            <ReceiptRow
                              label={`Less: paid online${charge.prepaid.reference ? ` (GCash ${charge.prepaid.reference})` : ""}`}
                              value={`-${fmtPeso(charge.prepaid.amount)}`}
                              className="rcpt-muted"
                            />
                          )}
                          {(charge.payments || []).map((payment) => (
                            <ReceiptRow
                              key={payment.transactionId}
                              label={`Less: paid while playing (#${receiptNumber(payment.transactionId)}, ${payment.method === "cash" ? "Cash" : "GCash"})`}
                              value={`-${fmtPeso(payment.amount)}`}
                              className="rcpt-muted"
                            />
                          ))}
                        </div>
                      )
                    )}
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
                {sessionOnly ? (
                  <>
                    <ReceiptRow label="Session total" value={fmtPeso(stayTotal)} />
                    <ReceiptRow label="Paid before ending" value={`-${fmtPeso(paidBefore)}`} />
                  </>
                ) : (
                  <ReceiptRow label="Subtotal" value={fmtPeso(receipt.subtotal ?? receipt.total)} />
                )}
                {receipt.discAmt > 0 && (
                  <ReceiptRow label={receipt.discLabel} value={`-${fmtPeso(receipt.discAmt)}`} />
                )}
                <ReceiptRow label={sessionOnly ? "LEFT TO PAY" : "TOTAL"} value={fmtPeso(receipt.total)} className="rcpt-total" />

                <div className="rcpt-rule" />
                <ReceiptRow
                  label={sessionOnly ? "Status" : "Paid by"}
                  value={sessionOnly ? "Paid in full before ending" : isCash ? "Cash" : "GCash"}
                />
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
              <button type="button" className="btn btn-secondary" onClick={() => printReceipt(paperRef.current, sessionOnly ? "Session Summary" : "Receipt")}>
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
