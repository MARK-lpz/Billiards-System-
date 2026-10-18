import { useState } from "react";
import { REFERENCE_MAX_DIGITS, sanitizeReference, validateReference } from "../../utils/paymentReference";
import { useSiteSettings } from "../Global/useSiteSettings";
import { formatMobile, gcashQrUrl } from "../../utils/siteSettings";
import { getSmsWarning, sanitizePhoneInput } from "../../utils/phone";
import { prepareReceipt } from "../../utils/receiptImage";

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The screenshot of the GCash receipt: picked, shrunk in the browser, shown back
// before it is sent with the booking (utils/receiptImage.js).
function ReceiptPicker({ receipt, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await prepareReceipt(file));
    } catch (pickError) {
      setError(pickError.message || "This picture could not be used. Please try another screenshot.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gcash-receipt">
      <span className="label gcash-reference-label" id="gcash-receipt-label">
        Screenshot of your GCash receipt
      </span>
      {receipt ? (
        <div className="gcash-receipt-picked">
          <img src={receipt.dataUrl} alt="Your GCash receipt" className="gcash-receipt-thumb" />
          <div className="gcash-receipt-actions">
            <span className="gcash-reference-ok">
              <i className="bi bi-check-circle" aria-hidden="true"></i> Receipt attached
            </span>
            <label className={`gcash-copy gcash-receipt-change ${disabled || busy ? "is-disabled" : ""}`}>
              <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
              {busy ? "Reading..." : "Change"}
              <input type="file" accept="image/*" className="gcash-receipt-input" onChange={pick} disabled={disabled || busy} />
            </label>
            <button type="button" className="gcash-copy" onClick={() => onChange(null)} disabled={disabled || busy}>
              <i className="bi bi-x-lg" aria-hidden="true"></i> Remove
            </button>
          </div>
        </div>
      ) : (
        <label className={`gcash-receipt-drop ${disabled || busy ? "is-disabled" : ""}`} aria-labelledby="gcash-receipt-label">
          <i className="bi bi-image" aria-hidden="true"></i>
          <span>{busy ? "Reading the picture..." : "Attach the screenshot"}</span>
          <small>JPG or PNG, showing the amount and the reference number.</small>
          <input type="file" accept="image/*" className="gcash-receipt-input" onChange={pick} disabled={disabled || busy} />
        </label>
      )}
      {error && <p className="field-warning" role="alert">{error}</p>}
    </div>
  );
}

/**
 * The GCash step of a booking or a paid registration: what is paid for (the
 * values of `lines`, on one line), the
 * hall's own GCash QR and account (Admin > Website), and what the customer
 * sends back: the reference, the GCash number they paid from and a screenshot
 * of the receipt (`payerNumber` / `receipt`, each with its change handler).
 * `heldNote` says the payment is held until the hall accepts it. Until the
 * admin has set the QR and account name, it says online payment is not
 * available (the form it sits in stops too).
 */
export default function GcashPayment({
  title = "GCash Payment",
  lines = [],
  total = 0,
  reference = "",
  onReferenceChange,
  payerNumber = "",
  onPayerNumberChange,
  receipt = null,
  onReceiptChange,
  heldNote = "",
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
        <span className="gcash-panel-total">
          Total <strong>{peso(total)}</strong>
        </span>
      </div>
      {/* What is paid for, on one line (the step's own summary has the rest). */}
      {lines.length > 0 && <p className="gcash-breakdown">{lines.map((line) => line.value).join(" · ")}</p>}

      <div className="gcash-steps">
        <figure className="gcash-qr-figure">
          <img className="gcash-qr" src={qrUrl} alt={`GCash QR code of ${gcash.accountName}`} width="124" />
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
          <p className="gcash-pay-line">
            Send exactly <strong>{peso(total)}</strong>, then type the reference and attach the receipt below.
          </p>
          {/* The full steps, folded: the line above is enough for most. */}
          <details className="gcash-how">
            <summary>How to pay</summary>
            <ol className="gcash-step-list">
              <li>
                Open GCash and scan this QR. On this phone, tap Save QR, then in GCash use Scan QR, Upload QR
                {gcash.number ? ", or send to the number above" : ""}.
              </li>
              <li>Check that the name is {gcash.accountName}, then send exactly {peso(total)}.</li>
              <li>Take a screenshot of your GCash receipt.</li>
              <li>Type its reference number below and attach the screenshot, so we can match your payment.</li>
            </ol>
          </details>
        </div>
      </div>

      <div className="gcash-fields">
        <div>
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
            placeholder="From your GCash receipt"
            value={reference}
            disabled={disabled}
            aria-invalid={Boolean(check.error)}
            onChange={(event) => onReferenceChange?.(sanitizeReference(event.target.value))}
          />
          {/* The empty-reference warning is worded for staff (Sales / POS); the customer is told by the line above. */}
          {check.error ? (
            <p className="field-warning" role="alert">{check.error}</p>
          ) : (
            check.digits && (
              <div className="gcash-reference-meter">
                <span>{check.digits.length} digits</span>
                {check.isValid && (
                  <span className="gcash-reference-ok">
                    <i className="bi bi-check-circle"></i> Looks right
                  </span>
                )}
              </div>
            )
          )}
        </div>

        {onPayerNumberChange && (
          <div>
            <label className="label gcash-reference-label" htmlFor="gcash-payer-input">
              GCash number you paid from
            </label>
            <input
              id="gcash-payer-input"
              className={`field-input gcash-reference-input ${getSmsWarning(payerNumber) ? "is-invalid" : ""}`}
              type="text"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={11}
              placeholder="09XX XXX XXXX"
              value={payerNumber}
              disabled={disabled}
              onChange={(event) => onPayerNumberChange(sanitizePhoneInput(event.target.value))}
            />
            {getSmsWarning(payerNumber) && <p className="field-warning">{getSmsWarning(payerNumber)}</p>}
          </div>
        )}
      </div>

      {onReceiptChange && <ReceiptPicker receipt={receipt} onChange={onReceiptChange} disabled={disabled} />}

      {/* Also why the number paid from is asked: a payment not accepted goes back there. */}
      {heldNote && (
        <div className="gcash-held-note">
          <i className="bi bi-shield-check" aria-hidden="true"></i>
          <p>{heldNote}</p>
        </div>
      )}
    </div>
  );
}
