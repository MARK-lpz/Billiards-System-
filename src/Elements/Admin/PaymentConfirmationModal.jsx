import { useMemo, useState } from "react";

import {
  REFERENCE_MAX_DIGITS,
  VERIFY_DIGITS,
  checkClosingDigits,
  maskReference,
  sanitizeReference,
  sanitizeVerifyDigits,
  validateReference,
} from "../../utils/paymentReference";

const verifiedTimestamp = () => new Date().toISOString();

export default function PaymentConfirmationModal({
  cart,
  total,
  method,
  usedReferences = [],
  onCancel,
  onConfirm,
}) {
  const [cashReceived, setCashReceived] = useState(String(total));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [verifyDigits, setVerifyDigits] = useState("");
  const [finalConfirmationOpen, setFinalConfirmationOpen] = useState(false);

  const isEwallet = method === "ewallet";

  const fmtPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const receivedAmount = useMemo(() => Number(cashReceived), [cashReceived]);
  const cashIsValid = Number.isFinite(receivedAmount) && receivedAmount >= total;
  const change = cashIsValid ? receivedAmount - total : 0;

  const referenceCheck = useMemo(
    () => validateReference(referenceNumber, usedReferences),
    [referenceNumber, usedReferences]
  );
  const referenceDigits = referenceCheck.digits;
  const referenceIsValid = referenceCheck.isValid;
  const referenceError = referenceCheck.error;
  const referenceWarning = referenceCheck.warning;
  const referenceIsEmpty = referenceDigits.length === 0;

  const verification = checkClosingDigits(referenceDigits, verifyDigits);
  const expectedClosingDigits = verification.expected;
  const maskedReference = maskReference(referenceDigits);
  const verifyIsComplete = verification.isComplete;
  const verifyMatches = verification.matches;
  const verifyMismatch = verification.mismatch;

  const canContinue = isEwallet ? referenceIsValid : cashIsValid;
  const canComplete = isEwallet ? referenceIsValid && verifyMatches : cashIsValid;

  const handleReferenceChange = (event) => {
    setReferenceNumber(sanitizeReference(event.target.value));
    setVerifyDigits("");
  };

  const handleVerifyChange = (event) => {
    setVerifyDigits(sanitizeVerifyDigits(event.target.value));
  };

  const requestFinalConfirmation = () => {
    if (!canContinue) return;

    setVerifyDigits("");
    setFinalConfirmationOpen(true);
  };

  const backToDetails = () => {
    setVerifyDigits("");
    setFinalConfirmationOpen(false);
  };

  const confirm = () => {
    if (!canComplete) return;

    onConfirm({
      cashReceived: isEwallet ? null : receivedAmount,
      change: isEwallet ? null : change,
      referenceNumber: isEwallet ? referenceDigits : null,
      referenceVerified: isEwallet ? true : null,
      referenceClosingDigits: isEwallet ? expectedClosingDigits : null,
      referenceVerifiedAt: isEwallet ? verifiedTimestamp() : null,
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
                {finalConfirmationOpen && isEwallet ? "Approve Payment" : "Review Payment"}
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
                    <span>{item.isTableCharge ? item.name : `${item.name} x ${item.qty}`}</span>
                    <strong>{fmtPeso(item.price * item.qty)}</strong>
                  </div>
                ))}
                <div className="payment-review-total">
                  <span>Total via {isEwallet ? "GCash" : "Cash"}</span>
                  <strong>{fmtPeso(total)}</strong>
                </div>
              </div>

              {!finalConfirmationOpen && <div className="payment-details-section">
                <div className="payment-details-heading">
                  <span>Payment details</span>
                  <strong>{isEwallet ? "GCash" : "Cash"}</strong>
                </div>

                {isEwallet ? (
                  <>
                    <label className="payment-field-label" htmlFor="gcash-reference">
                      GCash reference number
                    </label>
                    <input
                      id="gcash-reference"
                      type="text"
                      className={`payment-reference-input ${referenceError ? "is-invalid-reference" : ""} ${
                        referenceIsEmpty ? "is-warning-reference" : ""
                      }`}
                      placeholder="Enter the reference on the customer receipt"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={REFERENCE_MAX_DIGITS}
                      value={referenceNumber}
                      onChange={handleReferenceChange}
                      aria-invalid={Boolean(referenceError)}
                      aria-describedby="gcash-reference-help"
                      autoFocus
                    />
                    <div className="payment-reference-meter">
                      <span>{referenceDigits.length} digits</span>
                      {referenceIsValid && (
                        <span className="payment-reference-ok">
                          <i className="bi bi-check-circle"></i> Format accepted
                        </span>
                      )}
                      {referenceIsEmpty && <span className="payment-reference-required">Required</span>}
                    </div>
                    {referenceError ? (
                      <p className="payment-field-error" id="gcash-reference-help" role="alert">
                        {referenceError}
                      </p>
                    ) : referenceWarning ? (
                      <p className="payment-field-warning" id="gcash-reference-help" role="alert">
                        <i className="bi bi-exclamation-triangle-fill"></i>
                        <span>{referenceWarning}</span>
                      </p>
                    ) : (
                      <p className="payment-method-note" id="gcash-reference-help">
                        Digits only. The next step asks you to verify the last {VERIFY_DIGITS} digits against the
                        customer receipt.
                      </p>
                    )}
                  </>
                ) : (
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
                )}
              </div>}

              {finalConfirmationOpen && isEwallet && (
                <div className="payment-verify-panel">
                  <div className="payment-verify-heading">
                    <i className="bi bi-shield-check"></i>
                    <div>
                      <strong>Verify the reference number</strong>
                      <span>
                        Look at the customer GCash receipt and type the last {VERIFY_DIGITS} digits of the reference
                        number.
                      </span>
                    </div>
                  </div>

                  <div className="payment-verify-reference">
                    <span>Recorded reference</span>
                    <strong>{maskedReference}</strong>
                  </div>

                  <label className="payment-field-label" htmlFor="gcash-verify">
                    Last {VERIFY_DIGITS} digits on the customer receipt
                  </label>
                  <input
                    id="gcash-verify"
                    type="text"
                    className={`payment-verify-input ${verifyMismatch ? "is-invalid-reference" : ""} ${
                      verifyMatches ? "is-valid-reference" : ""
                    }`}
                    placeholder={"0".repeat(VERIFY_DIGITS)}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={VERIFY_DIGITS}
                    value={verifyDigits}
                    onChange={handleVerifyChange}
                    aria-invalid={verifyMismatch}
                    autoFocus
                  />

                  {verifyMismatch && (
                    <p className="payment-field-error" role="alert">
                      These digits do not match the reference you recorded. Check the receipt, or go back and correct
                      the reference number.
                    </p>
                  )}
                  {verifyMatches && (
                    <p className="payment-verify-success" role="status">
                      <i className="bi bi-check-circle-fill"></i> Reference verified. You can approve this payment.
                    </p>
                  )}
                  {!verifyIsComplete && (
                    <p className="payment-method-note">
                      Approval stays locked until the digits match the recorded reference.
                    </p>
                  )}
                </div>
              )}

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
                  <button type="button" className="btn btn-secondary" onClick={backToDetails}>
                    No, Go Back
                  </button>
                  <button type="button" className="btn btn-success" onClick={confirm} disabled={!canComplete}>
                    <i className="bi bi-check-circle"></i>
                    {isEwallet ? "Approve Payment" : "Yes, Complete Payment"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-success" onClick={requestFinalConfirmation} disabled={!canContinue}>
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
