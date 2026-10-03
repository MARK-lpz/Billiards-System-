import { useEffect, useState } from "react";
// The GCash verification look the POS already uses, in dark and light mode.
import "../../styles/Admin/CartPanel.css";
import {
  VERIFY_DIGITS,
  checkClosingDigits,
  maskReference,
  onlyDigits,
  sanitizeVerifyDigits,
} from "../../utils/paymentReference";
import { describeReservationTime, hasReservationEnded } from "../../utils/reservations";

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (date) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date || "Date not set"
    : parsed.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
};

/**
 * The front desk approves an online reservation only after finding the guest's
 * GCash payment. The reference the guest typed is shown with its last digits
 * hidden, and the employee types those digits from the payment they found in the
 * Break & Chill GCash account, so approving takes a real look at the money.
 */
export default function PaymentCheckModal({ booking, busy = false, onApprove, onReject, onClose }) {
  const [verifyDigits, setVerifyDigits] = useState("");
  const [paidWithoutReference, setPaidWithoutReference] = useState(false);
  const [confirmingReject, setConfirmingReject] = useState(false);

  const reference = onlyDigits(booking.paymentReference);
  const hasReference = reference.length > VERIFY_DIGITS;
  const amount = Number(booking.paymentAmount || 0);
  const verification = checkClosingDigits(reference, verifyDigits);
  const ended = hasReservationEnded(booking);
  const paymentConfirmed = hasReference ? verification.matches : paidWithoutReference;
  const canApprove = paymentConfirmed && !ended && !busy;

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  return (
    <>
      <div className="modal show" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="payment-check-title">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="payment-check-title">
                <i className="bi bi-shield-check"></i>
                Check GCash Payment
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose} disabled={busy}></button>
            </div>

            <div className="modal-body">
              <p className="payment-confirmation-copy">
                Approve this online reservation only after you find the customer&apos;s payment in the Break &amp; Chill
                GCash account.
              </p>

              <div className="payment-review-summary">
                {[
                  ["Customer", booking.customerName],
                  ["Contact", booking.phone || "Not given"],
                  ["Table", booking.tableName || `Table ${booking.tableId}`],
                  ["Date", formatDate(booking.date)],
                  ["Time", describeReservationTime(booking) || "No time set"],
                ].map(([label, value]) => (
                  <div className="payment-review-row" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <div className="payment-review-total">
                  <span>Amount to find</span>
                  <strong>{amount > 0 ? peso(amount) : "Not recorded"}</strong>
                </div>
              </div>

              {confirmingReject ? (
                <div className="payment-final-confirmation payment-check-step" role="alert">
                  <i className="bi bi-exclamation-triangle"></i>
                  <div>
                    <strong>Reject this reservation?</strong>
                    <span>
                      Use this when the payment cannot be found. The table time is freed for other guests, and this
                      cannot be undone.
                    </span>
                  </div>
                </div>
              ) : hasReference ? (
                <div className="payment-verify-panel">
                  <div className="payment-verify-heading">
                    <i className="bi bi-search"></i>
                    <div>
                      <strong>Find the payment in GCash</strong>
                      <span>
                        Look for a payment{amount > 0 ? ` of ${peso(amount)}` : ""} whose reference starts with the digits
                        below, then type the last {VERIFY_DIGITS} digits of that reference.
                      </span>
                    </div>
                  </div>

                  <div className="payment-verify-reference">
                    <span>Reference from the customer</span>
                    <strong>{maskReference(reference)}</strong>
                  </div>

                  <label className="payment-field-label" htmlFor="payment-check-digits">
                    Last {VERIFY_DIGITS} digits in GCash
                  </label>
                  <input
                    id="payment-check-digits"
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
                    autoFocus
                  />

                  {verification.mismatch && (
                    <p className="payment-field-error" role="alert">
                      These digits do not match the customer&apos;s reference. Check that you found the right payment. If
                      there is none, reject the reservation.
                    </p>
                  )}
                  {verification.matches && (
                    <p className="payment-verify-success" role="status">
                      <i className="bi bi-check-circle-fill"></i> Payment found. You can approve this reservation.
                    </p>
                  )}
                  {!verification.isComplete && (
                    <p className="payment-method-note">Approval stays locked until the digits match.</p>
                  )}
                </div>
              ) : (
                <div className="payment-verify-panel">
                  <div className="payment-verify-heading">
                    <i className="bi bi-exclamation-circle"></i>
                    <div>
                      <strong>No GCash reference recorded</strong>
                      <span>
                        This reservation was saved without a GCash reference. Approve it only if you have confirmed the
                        payment another way.
                      </span>
                    </div>
                  </div>
                  <label className="payment-check-confirm">
                    <input
                      type="checkbox"
                      checked={paidWithoutReference}
                      onChange={(event) => setPaidWithoutReference(event.target.checked)}
                      disabled={busy}
                    />
                    <span>I confirmed this customer has paid{amount > 0 ? ` ${peso(amount)}` : ""}.</span>
                  </label>
                </div>
              )}

              {ended && !confirmingReject && (
                <p className="payment-field-error payment-check-ended" role="alert">
                  This reservation&apos;s time has already ended, so it can no longer be approved. Reject it instead.
                </p>
              )}
            </div>

            <div className="modal-footer">
              {confirmingReject ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setConfirmingReject(false)} disabled={busy}>
                    No, Go Back
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => onReject(booking)} disabled={busy}>
                    <i className="bi bi-x-circle"></i>
                    {busy ? "Saving..." : "Yes, Reject"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmingReject(true)} disabled={busy}>
                    <i className="bi bi-x-circle"></i>
                    Not Paid, Reject
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => onApprove(booking, hasReference ? verification.expected : "")}
                    disabled={!canApprove}
                  >
                    <i className="bi bi-check-circle"></i>
                    {busy ? "Saving..." : "Approve Reservation"}
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
