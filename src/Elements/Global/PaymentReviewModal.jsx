import { useEffect, useState } from "react";
import "../../styles/Admin/CartPanel.css";
import "../../styles/OnlinePayments.css";
import ReceiptImage from "./ReceiptImage";
import PaymentStatusChip from "./PaymentStatusChip";
import { VERIFY_DIGITS, checkClosingDigits, maskReference, onlyDigits, sanitizeVerifyDigits } from "../../utils/paymentReference";
import { describeRefund, formatPayer, formatPeso } from "../../utils/onlinePayments";

/**
 * One website GCash payment: what it was for, the amount, the number it came
 * from and the customer's receipt screenshot. A held one can be accepted
 * (`onAccept`) once staff type the last digits of its reference from the
 * payment they found in the hall's GCash app, as for a booking, or turned down
 * (`onReject`, worded by `rejectText`). One to send back offers `onRefund`.
 */
export default function PaymentReviewModal({
  payment,
  lines = [],
  busy = false,
  error = "",
  rejectText = "",
  onAccept,
  onReject,
  onRefund,
  onClose,
}) {
  const [verifyDigits, setVerifyDigits] = useState("");
  const [confirmingReject, setConfirmingReject] = useState(false);
  const checking = payment.status === "held" && Boolean(onAccept);
  const reference = onlyDigits(payment.reference);
  const verification = checkClosingDigits(reference, verifyDigits);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  return (
    <>
      <div className="modal show" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="payment-review-title" style={{ display: "flex" }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="payment-review-title">
                <i className={`bi ${checking ? "bi-shield-check" : "bi-phone"}`}></i>
                {checking ? "Check GCash Payment" : "GCash Payment"}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose} disabled={busy}></button>
            </div>

            <div className="modal-body">
              {checking && (
                <p className="payment-confirmation-copy">
                  Accept it only after you find the payment in the Break &amp; Chill GCash app. The screenshot helps you
                  find it, but a screenshot can be edited.
                </p>
              )}

              <div className="payment-review-summary">
                {[
                  ...lines,
                  ["Paid from", formatPayer(payment) || "Not given"],
                  ["Status", <PaymentStatusChip key="status" payment={payment} />],
                ].map(([label, value]) => (
                  <div className="payment-review-row" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <div className="payment-review-total">
                  <span>{checking ? "Amount to find" : "Amount"}</span>
                  <strong>{formatPeso(payment.amount)}</strong>
                </div>
              </div>

              <ReceiptImage payment={payment} />

              {confirmingReject ? (
                <div className="payment-final-confirmation payment-check-step" role="alert">
                  <i className="bi bi-exclamation-triangle"></i>
                  <div>
                    <strong>Turn this payment down?</strong>
                    <span>{rejectText || "Use this when the payment cannot be found. It is listed to send back."}</span>
                  </div>
                </div>
              ) : checking ? (
                <div className="payment-verify-panel">
                  <div className="payment-verify-heading">
                    <i className="bi bi-search"></i>
                    <div>
                      <strong>Find the payment in GCash</strong>
                      <span>
                        Look for {formatPeso(payment.amount)} whose reference starts with the digits below, then type the last{" "}
                        {VERIFY_DIGITS} digits of that reference.
                      </span>
                    </div>
                  </div>
                  <div className="payment-verify-reference">
                    <span>Reference from the customer</span>
                    <strong>{maskReference(reference)}</strong>
                  </div>
                  <label className="payment-field-label" htmlFor="payment-review-digits">
                    Last {VERIFY_DIGITS} digits in GCash
                  </label>
                  <input
                    id="payment-review-digits"
                    type="text"
                    className={`payment-verify-input ${verification.mismatch ? "is-invalid-reference" : ""} ${
                      verification.matches ? "is-valid-reference" : ""
                    }`}
                    placeholder={"0".repeat(VERIFY_DIGITS)}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={VERIFY_DIGITS}
                    value={verifyDigits}
                    onChange={(event) => setVerifyDigits(sanitizeVerifyDigits(event.target.value))}
                    aria-invalid={verification.mismatch}
                    disabled={busy}
                  />
                  {verification.mismatch && (
                    <p className="payment-field-error" role="alert">
                      These digits do not match the customer&apos;s reference. Check that you found the right payment.
                    </p>
                  )}
                  {verification.matches && (
                    <p className="payment-verify-success" role="status">
                      <i className="bi bi-check-circle-fill"></i> Payment found. You can accept it.
                    </p>
                  )}
                </div>
              ) : (
                <p className="pay-review-history">
                  {payment.status === "refunded"
                    ? describeRefund(payment)
                    : payment.status === "accepted"
                      ? `Accepted${payment.decidedBy ? ` by ${payment.decidedBy}` : ""}. Reference ${payment.reference}.`
                      : payment.status === "refund_due"
                        ? `Turned down${payment.decidedBy ? ` by ${payment.decidedBy}` : ""}: send ${formatPeso(payment.amount)} back to ${formatPayer(payment)}.`
                        : `Reference ${payment.reference}. Not checked yet.`}
                </p>
              )}

              {error && (
                <p className="payment-field-error" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="modal-footer">
              {confirmingReject ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setConfirmingReject(false)} disabled={busy}>
                    No, Go Back
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => onReject(payment)} disabled={busy}>
                    <i className="bi bi-x-circle"></i>
                    {busy ? "Saving..." : "Yes, Turn It Down"}
                  </button>
                </>
              ) : checking ? (
                <>
                  {onReject && (
                    <button type="button" className="btn btn-danger" onClick={() => setConfirmingReject(true)} disabled={busy}>
                      <i className="bi bi-x-circle"></i>
                      Not Paid, Reject
                    </button>
                  )}
                  <button type="button" className="btn btn-success" onClick={() => onAccept(payment)} disabled={!verification.matches || busy}>
                    <i className="bi bi-check-circle"></i>
                    {busy ? "Saving..." : "Accept Payment"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Close
                  </button>
                  {payment.status === "refund_due" && onRefund && (
                    <button type="button" className="btn btn-success" onClick={() => onRefund(payment)}>
                      <i className="bi bi-arrow-counterclockwise"></i>
                      Send It Back
                    </button>
                  )}
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
