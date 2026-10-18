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
import { checkGcashReference, recordCounterGcash } from "../../utils/paymentsApi";
import { formatMobile } from "../../utils/siteSettings";
import { useCounterGcash } from "../Global/useCounterGcash";

const verifiedTimestamp = () => new Date().toISOString();
// Read only from click handlers, never while rendering.
const newSaleKey = () => `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const OFFLINE_MESSAGE =
  "Could not reach the server to check this GCash payment. Check the internet and try again, or take cash instead.";

// More change than this is almost surely a typo in the cash received.
const MAX_CHANGE = 10000;

export default function PaymentConfirmationModal({
  cart,
  total,
  method,
  billLabel = "",
  usedReferences = [],
  onCancel,
  onConfirm,
}) {
  const [cashReceived, setCashReceived] = useState(String(total));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [verifyDigits, setVerifyDigits] = useState("");
  const [finalConfirmationOpen, setFinalConfirmationOpen] = useState(false);
  // "checking" (the reference, on Continue) or "saving" (on Approve).
  const [busy, setBusy] = useState("");
  // What the server said about the reference, or that it could not be reached.
  const [serverError, setServerError] = useState("");
  const counterGcash = useCounterGcash();

  const isEwallet = method === "ewallet";

  const fmtPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const receivedAmount = useMemo(() => Number(cashReceived), [cashReceived]);
  // A slip of the keyboard (an extra zero) should not go through as a huge change.
  const cashError =
    String(cashReceived).trim() === "" || !Number.isFinite(receivedAmount)
      ? "Enter the cash received."
      : receivedAmount < total
        ? "The cash received must cover the total amount."
        : Math.abs(receivedAmount * 100 - Math.round(receivedAmount * 100)) > 1e-6
          ? "Use at most 2 decimal places (centavos)."
          : receivedAmount - total > MAX_CHANGE
            ? `That leaves ${fmtPeso(receivedAmount - total)} in change. Check the amount received.`
            : "";
  const cashIsValid = !cashError;
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

  const canContinue = isEwallet ? referenceIsValid && counterGcash.ready && !busy : cashIsValid;
  const canComplete = isEwallet ? referenceIsValid && verifyMatches && !busy : cashIsValid;

  const handleReferenceChange = (event) => {
    setReferenceNumber(sanitizeReference(event.target.value));
    setVerifyDigits("");
    setServerError("");
  };

  const handleVerifyChange = (event) => {
    setVerifyDigits(sanitizeVerifyDigits(event.target.value));
  };

  // A GCash reference is checked on the server first: used once only, here,
  // on another screen or on the website.
  const requestFinalConfirmation = async () => {
    if (!canContinue) return;

    if (isEwallet) {
      setBusy("checking");
      setServerError("");
      try {
        const { used, message } = await checkGcashReference(referenceDigits);
        if (used) {
          setServerError(message);
          return;
        }
      } catch (error) {
        setServerError(error.status ? error.message : OFFLINE_MESSAGE);
        return;
      } finally {
        setBusy("");
      }
    }

    setVerifyDigits("");
    setFinalConfirmationOpen(true);
  };

  const backToDetails = () => {
    setVerifyDigits("");
    setServerError("");
    setFinalConfirmationOpen(false);
  };

  // GCash is kept on the server before the sale is recorded, so the same
  // reference can never pay twice. If it can't be kept, nothing is recorded.
  const confirm = async () => {
    if (!canComplete) return;

    const details = {
      cashReceived: isEwallet ? null : receivedAmount,
      change: isEwallet ? null : change,
      referenceNumber: isEwallet ? referenceDigits : null,
      referenceVerified: isEwallet ? true : null,
      referenceClosingDigits: isEwallet ? expectedClosingDigits : null,
      referenceVerifiedAt: isEwallet ? verifiedTimestamp() : null,
    };
    if (!isEwallet) {
      onConfirm(details);
      return;
    }

    setBusy("saving");
    setServerError("");
    try {
      const saved = await recordCounterGcash({
        reference: referenceDigits,
        amount: total,
        label: billLabel || "Counter sale",
        saleKey: newSaleKey(),
      });
      onConfirm({ ...details, gcashPaymentId: saved?.id || null });
    } catch (error) {
      setBusy("");
      setServerError(error.status ? error.message : OFFLINE_MESSAGE);
    }
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
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="Close"
                onClick={onCancel}
                disabled={busy === "saving"}
              ></button>
            </div>

            <div className="modal-body">
              <p className="payment-confirmation-copy">
                {billLabel ? (
                  <>
                    Paying <strong>{billLabel}</strong> only. Other open bills stay as they are.
                  </>
                ) : (
                  "Confirm the order and payment method before completing this sale."
                )}
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
                    {counterGcash.ready ? (
                      <div className="counter-gcash">
                        <img
                          className="counter-gcash-qr"
                          src={counterGcash.qrUrl}
                          alt={`GCash QR code of ${counterGcash.gcash.accountName}`}
                        />
                        <div className="counter-gcash-info">
                          <span className="counter-gcash-label">Let the customer scan and pay exactly</span>
                          <strong className="counter-gcash-amount">{fmtPeso(total)}</strong>
                          <dl className="counter-gcash-account">
                            <div>
                              <dt>Name</dt>
                              <dd>{counterGcash.gcash.accountName}</dd>
                            </div>
                            {counterGcash.gcash.number && (
                              <div>
                                <dt>Number</dt>
                                <dd>{formatMobile(counterGcash.gcash.number)}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      </div>
                    ) : (
                      <p className="payment-field-warning" role="alert">
                        <i className="bi bi-exclamation-triangle-fill"></i>
                        <span>{counterGcash.note || "Loading the hall's GCash QR..."}</span>
                      </p>
                    )}

                    <label className="payment-field-label" htmlFor="gcash-reference">
                      GCash reference number
                    </label>
                    <input
                      id="gcash-reference"
                      type="text"
                      className={`payment-reference-input ${referenceError ? "is-invalid-reference" : ""} ${
                        referenceIsEmpty ? "is-warning-reference" : ""
                      }`}
                      placeholder="From the customer's GCash receipt"
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
                    {referenceError || serverError ? (
                      <p className="payment-field-error" id="gcash-reference-help" role="alert">
                        {referenceError || serverError}
                      </p>
                    ) : referenceWarning ? (
                      <p className="payment-field-warning" id="gcash-reference-help" role="alert">
                        <i className="bi bi-exclamation-triangle-fill"></i>
                        <span>{referenceWarning}</span>
                      </p>
                    ) : (
                      <p className="payment-method-note" id="gcash-reference-help">
                        Digits only. Next, you find this payment in the Break &amp; Chill GCash app and type the last{" "}
                        {VERIFY_DIGITS} digits of its reference.
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
                    {cashError && <p className="payment-field-error" role="alert">{cashError}</p>}
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
                      <strong>Find the payment in the Break &amp; Chill GCash app</strong>
                      <span>
                        Look for {fmtPeso(total)} received just now and type the last {VERIFY_DIGITS} digits of its
                        reference. The customer&apos;s screen alone is not proof: a receipt can be edited.
                      </span>
                    </div>
                  </div>

                  <div className="payment-verify-reference">
                    <span>Amount to find</span>
                    <strong>{fmtPeso(total)}</strong>
                  </div>
                  <div className="payment-verify-reference">
                    <span>Reference from the customer</span>
                    <strong>{maskedReference}</strong>
                  </div>

                  <label className="payment-field-label" htmlFor="gcash-verify">
                    Last {VERIFY_DIGITS} digits in the Break &amp; Chill GCash app
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
                      These digits do not match the customer&apos;s receipt. Make sure the payment you found is this
                      one, or go back and correct the reference number.
                    </p>
                  )}
                  {verifyMatches && !serverError && (
                    <p className="payment-verify-success" role="status">
                      <i className="bi bi-check-circle-fill"></i> It matches. You can approve this payment.
                    </p>
                  )}
                  {!verifyIsComplete && (
                    <p className="payment-method-note">Approval stays locked until the digits match.</p>
                  )}
                  {serverError && (
                    <p className="payment-field-error" role="alert">
                      {serverError}
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
                  <button type="button" className="btn btn-secondary" onClick={backToDetails} disabled={busy === "saving"}>
                    No, Go Back
                  </button>
                  <button type="button" className="btn btn-success" onClick={confirm} disabled={!canComplete}>
                    <i className="bi bi-check-circle"></i>
                    {busy === "saving" ? "Saving..." : isEwallet ? "Approve Payment" : "Yes, Complete Payment"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-success" onClick={requestFinalConfirmation} disabled={!canContinue}>
                    {busy === "checking" ? "Checking..." : "Continue"}
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
