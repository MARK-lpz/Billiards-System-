import "../../styles/OnlinePayments.css";
import { formatPayer, formatPeso } from "../../utils/onlinePayments";

/**
 * Asked when staff cancel a booking that came with a GCash payment. One the
 * hall already accepted needs an answer (`value` "refund" or "keep"); one still
 * held is only explained, since it goes back on its own.
 */
export default function RefundChoice({ payment, value, onChange }) {
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
      <label className={`pay-choice-option ${value === "refund" ? "is-chosen" : ""}`}>
        <input type="radio" name="refund-choice" checked={value === "refund"} onChange={() => onChange("refund")} />
        <span>
          <strong>Send it back</strong>
          <small>To {formatPayer(payment)}. It stays on the list until staff mark it sent.</small>
        </span>
      </label>
      <label className={`pay-choice-option ${value === "keep" ? "is-chosen" : ""}`}>
        <input type="radio" name="refund-choice" checked={value === "keep"} onChange={() => onChange("keep")} />
        <span>
          <strong>Keep it</strong>
          <small>For a no-show or a late cancel.</small>
        </span>
      </label>
    </fieldset>
  );
}
