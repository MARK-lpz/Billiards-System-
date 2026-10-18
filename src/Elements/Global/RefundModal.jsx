import { useEffect, useState } from "react";
import "../../styles/Admin/CartPanel.css";
import "../../styles/OnlinePayments.css";
import { markPaymentRefunded } from "../../utils/paymentsApi";
import { REFERENCE_MAX_DIGITS, REFERENCE_MIN_DIGITS, sanitizeReference } from "../../utils/paymentReference";
import { formatPayer, formatPeso } from "../../utils/onlinePayments";

/**
 * Sending a website GCash payment back. Staff send it from the hall's GCash
 * app (or hand it back in cash at the hall), then record it here with the
 * refund's reference. `forWhat` says what it was paid for; `onDone(payment)`
 * gets the payment as the server saved it.
 */
export default function RefundModal({ payment, forWhat = "", onDone, onClose }) {
  const [method, setMethod] = useState("gcash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const digits = sanitizeReference(reference);
  const referenceOk = digits.length >= REFERENCE_MIN_DIGITS;
  const canSave = !busy && (method === "cash" || referenceOk);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(payment.payerNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const { payment: saved } = await markPaymentRefunded({ id: payment.id, method, refundReference: digits });
      onDone(saved);
    } catch (saveError) {
      setError(saveError.message || "Unable to save the refund. Please try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal show" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="refund-title" style={{ display: "flex" }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="refund-title">
                <i className="bi bi-arrow-counterclockwise"></i>
                Send the Payment Back
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose} disabled={busy}></button>
            </div>

            <div className="modal-body">
              <p className="payment-confirmation-copy">
                Send this back from the Break &amp; Chill GCash app (or give it back in cash at the hall), then record it here.
              </p>

              <div className="payment-review-summary">
                {[
                  ["Customer", payment.customerName],
                  ...(forWhat ? [["Paid for", forWhat]] : []),
                  ["Their GCash reference", payment.reference || "Not given"],
                ].map(([label, value]) => (
                  <div className="payment-review-row" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <div className="payment-review-total">
                  <span>Amount to send back</span>
                  <strong>{formatPeso(payment.amount)}</strong>
                </div>
              </div>

              <div className="refund-send-to">
                <span>Send it to this GCash number</span>
                <strong>{formatPayer(payment) || "Not given"}</strong>
                {payment.payerNumber && (
                  <button type="button" className="refund-copy" onClick={copyNumber}>
                    <i className={`bi ${copied ? "bi-check2" : "bi-copy"}`} aria-hidden="true"></i>
                    {copied ? "Copied" : "Copy"}
                  </button>
                )}
              </div>

              <fieldset className="pay-choice">
                <legend>How was it given back?</legend>
                <label className={`pay-choice-option ${method === "gcash" ? "is-chosen" : ""}`}>
                  <input type="radio" name="refund-method" checked={method === "gcash"} onChange={() => setMethod("gcash")} disabled={busy} />
                  <span>
                    <strong>Sent back by GCash</strong>
                    <small>Type the reference number from the GCash receipt of the refund.</small>
                  </span>
                </label>
                <label className={`pay-choice-option ${method === "cash" ? "is-chosen" : ""}`}>
                  <input type="radio" name="refund-method" checked={method === "cash"} onChange={() => setMethod("cash")} disabled={busy} />
                  <span>
                    <strong>Given back in cash at the hall</strong>
                    <small>No reference needed.</small>
                  </span>
                </label>
              </fieldset>

              {method === "gcash" && (
                <>
                  <label className="payment-field-label" htmlFor="refund-reference">
                    Reference number of the refund
                  </label>
                  <input
                    id="refund-reference"
                    type="text"
                    className="payment-verify-input refund-reference-input"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={REFERENCE_MAX_DIGITS}
                    placeholder="From the GCash receipt of the refund"
                    value={reference}
                    onChange={(event) => setReference(sanitizeReference(event.target.value))}
                    disabled={busy}
                  />
                  {!referenceOk && (
                    <p className="payment-method-note">
                      {REFERENCE_MIN_DIGITS} to {REFERENCE_MAX_DIGITS} digits. {digits.length} entered.
                    </p>
                  )}
                </>
              )}

              {error && (
                <p className="payment-field-error" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                Not Yet
              </button>
              <button type="button" className="btn btn-success" onClick={save} disabled={!canSave}>
                <i className="bi bi-check2-all"></i>
                {busy ? "Saving..." : "Mark as Sent Back"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
