import { REFERENCE_MAX_DIGITS, sanitizeReference, validateReference } from "../../utils/paymentReference";

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function GcashPayment({
  title = "GCash Payment",
  lines = [],
  total = 0,
  reference = "",
  onReferenceChange,
  disabled = false,
}) {
  const check = validateReference(reference);
  const qrSource = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(
    `GCash Break and Chill amount ${Number(total || 0).toFixed(2)}`
  )}`;

  return (
    <div className="gcash-panel">
      <div className="gcash-panel-head">
        <i className="bi bi-phone" aria-hidden="true"></i>
        <strong>{title}</strong>
      </div>

      <div className="gcash-breakdown">
        {lines.map((line) => (
          <div className="gcash-line" key={line.label}>
            <span>{line.label}</span>
            <span>{line.value}</span>
          </div>
        ))}
        <div className="gcash-line gcash-total">
          <span>Total to pay</span>
          <strong>{peso(total)}</strong>
        </div>
      </div>

      <div className="gcash-steps">
        <img className="gcash-qr" src={qrSource} alt="GCash payment QR code" width="190" height="190" />
        <ol className="gcash-step-list">
          <li>Open GCash and scan this QR code.</li>
          <li>Send exactly {peso(total)}.</li>
          <li>Copy the reference number from your GCash receipt.</li>
          <li>Type it below so we can match your payment.</li>
        </ol>
      </div>

      <label className="label gcash-reference-label" htmlFor="gcash-reference-input">
        GCash reference number
      </label>
      <input
        id="gcash-reference-input"
        className={`field-input gcash-reference-input ${check.error ? "is-invalid" : ""}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={REFERENCE_MAX_DIGITS}
        placeholder="Enter the reference on your GCash receipt"
        value={reference}
        disabled={disabled}
        aria-invalid={Boolean(check.error)}
        onChange={(event) => onReferenceChange?.(sanitizeReference(event.target.value))}
      />

      <div className="gcash-reference-meter">
        <span>{check.digits.length} digits</span>
        {check.isValid && (
          <span className="gcash-reference-ok">
            <i className="bi bi-check-circle"></i> Looks right
          </span>
        )}
      </div>

      {check.error ? (
        <p className="field-warning" role="alert">{check.error}</p>
      ) : check.warning ? (
        <p className="gcash-reference-hint">
          <i className="bi bi-exclamation-triangle-fill"></i> {check.warning}
        </p>
      ) : (
        <p className="gcash-reference-hint subtle">
          Keep your GCash receipt. Staff check this reference before confirming.
        </p>
      )}
    </div>
  );
}
