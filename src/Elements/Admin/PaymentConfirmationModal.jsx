import { useMemo, useState } from "react";

export default function PaymentConfirmationModal({ cart, total, method, onCancel, onConfirm }) {
  const [cashReceived, setCashReceived] = useState(String(total));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [finalConfirmationOpen, setFinalConfirmationOpen] = useState(false);

  const fmtPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const receivedAmount = useMemo(() => Number(cashReceived), [cashReceived]);
  const cashIsValid = Number.isFinite(receivedAmount) && receivedAmount >= total;
  const change = cashIsValid ? receivedAmount - total : 0;
  const canConfirm = method === "cash" ? cashIsValid : referenceNumber.trim().length >= 4;

  const requestFinalConfirmation = () => {
    if (!canConfirm) return;

    setFinalConfirmationOpen(true);
  };

  const confirm = () => {
    onConfirm({
      cashReceived: method === "cash" ? receivedAmount : null,
      change: method === "cash" ? change : null,
      referenceNumber: method === "ewallet" ? referenceNumber.trim() : null,
    });
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content payment-confirmation-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-credit-card"></i>
                Review Payment
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onCancel}></button>
            </div>

            <div className="modal-body">
              <p className="payment-confirmation-copy">
                Confirm the order and payment method before completing this sale.
              </p>
              <div className="payment-review-summary">
                {cart.map((item) => (
                  <div className="payment-review-row" key={item.id}>
                    <span>{item.name} x {item.qty}</span>
                    <strong>{fmtPeso(item.price * item.qty)}</strong>
                  </div>
                ))}
                <div className="payment-review-total">
                  <span>Total via {method === "cash" ? "Cash" : "GCash"}</span>
                  <strong>{fmtPeso(total)}</strong>
                </div>
              </div>

              {!finalConfirmationOpen && <div className="payment-details-section">
                <div className="payment-details-heading">
                  <span>Payment details</span>
                  <strong>{method === "cash" ? "Cash" : "GCash"}</strong>
                </div>

                {method === "cash" ? (
                  <>
                    <label className="payment-field-label" htmlFor="cash-received">
                      Amount received
                    </label>
                    <div className="payment-cash-input">
                      <span>₱</span>
                      <input
                        id="cash-received"
                        type="number"
                        min={total}
                        step="0.01"
                        inputMode="decimal"
                        value={cashReceived}
                        onChange={(event) => setCashReceived(event.target.value)}
                        autoFocus
                      />
                    </div>
                    {!cashIsValid && (
                      <p className="payment-field-error">The cash received must cover the total amount.</p>
                    )}
                    <div className="payment-change-row">
                      <span>Change</span>
                      <strong>{fmtPeso(change)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="payment-field-label" htmlFor="gcash-reference">
                      GCash reference number
                    </label>
                    <input
                      id="gcash-reference"
                      type="text"
                      className="payment-reference-input"
                      placeholder="Enter the completed payment reference"
                      value={referenceNumber}
                      onChange={(event) => setReferenceNumber(event.target.value)}
                      autoFocus
                    />
                    <p className="payment-method-note">Verify the customer payment before confirming the sale.</p>
                  </>
                )}
              </div>}

              {finalConfirmationOpen && (
                <div className="payment-final-confirmation" role="alert">
                  <i className="bi bi-question-circle"></i>
                  <div>
                    <strong>Complete this payment?</strong>
                    <span>This will record the sale and clear the running bill.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {finalConfirmationOpen ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setFinalConfirmationOpen(false)}>
                    No, Go Back
                  </button>
                  <button type="button" className="btn btn-success" onClick={confirm}>
                    <i className="bi bi-check-circle"></i>
                    Yes, Complete Payment
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-success" onClick={requestFinalConfirmation} disabled={!canConfirm}>
                    Continue
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
