import "../../styles/OnlinePayments.css";
import "../../styles/StaffReservation.css";
import { describePaidBy, isDeskPaid } from "../../utils/bookingPayments";
import { formatPayer, formatPeso } from "../../utils/onlinePayments";
import { REFERENCE_MAX_DIGITS, REFERENCE_MIN_DIGITS, sanitizeReference } from "../../utils/paymentReference";

/**
 * Asked when staff cancel a booking that came with a payment. A website
 * booking's GCash the hall already accepted needs an answer; one still held is
 * only explained, since it goes back on its own. Money taken at the desk
 * (`booking`) is given back there and then. `value` is { how, reference }, see
 * NO_REFUND_CHOICE in bookingPayments.js.
 */
export default function RefundChoice({ payment, booking = null, value, onChange }) {
  const choose = (how) => onChange({ ...value, how });

  if (isDeskPaid(booking) && !booking.paymentRefund) {
    const byGcash = booking.paymentMethod !== "cash";
    const reference = sanitizeReference(value.reference);
    return (
      <fieldset className="pay-choice">
        <legend>
          The customer paid {formatPeso(booking.paymentAmount)} {describePaidBy(booking)}. What happens to it?
        </legend>
        {byGcash && (
          <label className={`pay-choice-option ${value.how === "gcash" ? "is-chosen" : ""}`}>
            <input type="radio" name="refund-choice" checked={value.how === "gcash"} onChange={() => choose("gcash")} />
            <span>
              <strong>Send it back by GCash</strong>
              <small>Send it from the hall&apos;s GCash app, then type the refund&apos;s reference. It comes off today&apos;s sales.</small>
            </span>
          </label>
        )}
        {value.how === "gcash" && (
          <input
            className="form-control pay-choice-reference"
            inputMode="numeric"
            autoComplete="off"
            maxLength={REFERENCE_MAX_DIGITS}
            placeholder={`Refund reference (${REFERENCE_MIN_DIGITS} to ${REFERENCE_MAX_DIGITS} digits)`}
            aria-label="Reference number of the GCash refund"
            value={reference}
            onChange={(event) => onChange({ ...value, reference: sanitizeReference(event.target.value) })}
          />
        )}
        <label className={`pay-choice-option ${value.how === "cash" ? "is-chosen" : ""}`}>
          <input type="radio" name="refund-choice" checked={value.how === "cash"} onChange={() => choose("cash")} />
          <span>
            <strong>Give it back in cash</strong>
            <small>Hand it to the customer now. It comes off today&apos;s sales.</small>
          </span>
        </label>
        <label className={`pay-choice-option ${value.how === "keep" ? "is-chosen" : ""}`}>
          <input type="radio" name="refund-choice" checked={value.how === "keep"} onChange={() => choose("keep")} />
          <span>
            <strong>Keep it</strong>
            <small>For a no-show or a late cancel.</small>
          </span>
        </label>
      </fieldset>
    );
  }

  if (payment?.status === "held") {
    return (
      <p className="pay-choice-note">
        <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
        Its {formatPeso(payment.amount)} GCash payment was never accepted, so it will be listed to send back to{" "}
        {formatPayer(payment)}.
      </p>
    );
  }
  if (payment?.status !== "accepted") return null;

  return (
    <fieldset className="pay-choice">
      <legend>
        The customer paid {formatPeso(payment.amount)} by GCash. What happens to it?
      </legend>
      <label className={`pay-choice-option ${value.how === "refund" ? "is-chosen" : ""}`}>
        <input type="radio" name="refund-choice" checked={value.how === "refund"} onChange={() => choose("refund")} />
        <span>
          <strong>Send it back</strong>
          <small>To {formatPayer(payment)}. It stays on the list until staff mark it sent.</small>
        </span>
      </label>
      <label className={`pay-choice-option ${value.how === "keep" ? "is-chosen" : ""}`}>
        <input type="radio" name="refund-choice" checked={value.how === "keep"} onChange={() => choose("keep")} />
        <span>
          <strong>Keep it</strong>
          <small>For a no-show or a late cancel.</small>
        </span>
      </label>
    </fieldset>
  );
}
