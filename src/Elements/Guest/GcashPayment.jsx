import { useState } from "react";
import { REFERENCE_MAX_DIGITS, sanitizeReference, validateReference } from "../../utils/paymentReference";
import { useSiteSettings } from "../Global/useSiteSettings";
import { formatMobile, gcashQrUrl } from "../../utils/siteSettings";

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The GCash step of a booking or a paid registration: what is paid for, the
 * hall's own GCash QR and account (Admin > Website), and the reference the
 * customer types back. Until the admin has set the QR and account name, it says
 * online payment is not available (the form it sits in stops too).
 */
export default function GcashPayment({
  title = "GCash Payment",
  lines = [],
  total = 0,
  reference = "",
  onReferenceChange,
  disabled = false,
}) {
  const { settings, loaded } = useSiteSettings();
  const { gcash, business } = settings;
  const [copied, setCopied] = useState(false);
  const check = validateReference(reference);
  const qrUrl = gcashQrUrl(gcash);

  if (!loaded || !gcash.ready) {
    return (
      <div className="gcash-panel gcash-unavailable" role="status">
        <div className="gcash-panel-head">
          <i className="bi bi-phone" aria-hidden="true"></i>
          <strong>{title}</strong>
        </div>
        <p>
          {!loaded
            ? "Loading the payment details..."
            : `Online payment is not available yet. Please pay at the hall${business.phone ? ` or call ${business.phone}` : ""}.`}
        </p>
      </div>
    );
  }

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(gcash.number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

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
        <figure className="gcash-qr-figure">
          <img className="gcash-qr" src={qrUrl} alt={`GCash QR code of ${gcash.accountName}`} width="190" />
          {/* On a phone the QR cannot be scanned from its own screen: save it, then upload it in GCash. */}
          <a className="gcash-qr-save" href={qrUrl} download="break-and-chill-gcash-qr" target="_blank" rel="noreferrer">
            <i className="bi bi-download" aria-hidden="true"></i>
            Save QR
          </a>
        </figure>
        <div className="gcash-pay-to">
          <dl className="gcash-account">
            <div>
              <dt>Pay to</dt>
              <dd>{gcash.accountName}</dd>
            </div>
            {gcash.number && (
              <div>
                <dt>GCash number</dt>
                <dd>
                  <span>{formatMobile(gcash.number)}</span>
                  <button type="button" className="gcash-copy" onClick={copyNumber}>
                    <i className={`bi ${copied ? "bi-check2" : "bi-copy"}`} aria-hidden="true"></i>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </dd>
              </div>
            )}
          </dl>
          <ol className="gcash-step-list">
            <li>
              Open GCash and scan this QR. On this phone, tap Save QR, then in GCash use Scan QR, Upload QR
              {gcash.number ? ", or send to the number above" : ""}.
            </li>
            <li>Check that the name is {gcash.accountName}, then send exactly {peso(total)}.</li>
            <li>Copy the reference number from your GCash receipt.</li>
            <li>Type it below so we can match your payment.</li>
          </ol>
        </div>
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

      {/* The empty-reference warning is worded for staff (Sales / POS); the customer gets their own. */}
      {check.error ? (
        <p className="field-warning" role="alert">{check.error}</p>
      ) : !check.digits ? (
        <p className="gcash-reference-hint subtle">After you pay, type the reference number from your GCash receipt here.</p>
      ) : (
        <p className="gcash-reference-hint subtle">
          Keep your GCash receipt. Staff check this reference before confirming.
        </p>
      )}
    </div>
  );
}
