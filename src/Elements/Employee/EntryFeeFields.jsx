import "../../styles/TournamentFees.css";
import { sanitizeReference } from "../../utils/paymentReference";
import { ENTRY_FEE_METHODS, checkEntryFee, getCounterMethods } from "../../utils/tournamentFees";
import { formatPeso } from "../../utils/onlinePayments";

const UNPAID = { id: "unpaid", short: "Not paid yet", icon: "bi-hourglass" };

/**
 * How a player pays a tournament's entry fee at the counter: the ways the admin
 * left on for it (cash, GCash with its reference), and "Not paid yet" when
 * `allowUnpaid` (a walk-in who pays later). `value` is { method, reference }.
 */
export default function EntryFeeFields({ event, value, onChange, allowUnpaid = false, usedReferences = [], idPrefix }) {
  const methods = [
    ...ENTRY_FEE_METHODS.filter((method) => getCounterMethods(event).includes(method.id)),
    ...(allowUnpaid ? [UNPAID] : []),
  ];
  const check = checkEntryFee(event, value, usedReferences);

  return (
    <fieldset className="entry-fee-fields">
      <legend className="form-label">
        Entry fee <strong>{formatPeso(event.entryFee)}</strong>
      </legend>
      <div className="entry-fee-options" role="radiogroup">
        {methods.map((method) => (
          <label key={method.id} className={`entry-fee-option${value.method === method.id ? " is-on" : ""}`}>
            <input
              type="radio"
              name={`${idPrefix}-method`}
              value={method.id}
              checked={value.method === method.id}
              onChange={() => onChange({ ...value, method: method.id })}
            />
            <i className={`bi ${method.icon}`} aria-hidden="true"></i>
            {method.short}
          </label>
        ))}
      </div>

      {value.method === "gcash" && (
        <div className="entry-fee-reference">
          <label className="form-label" htmlFor={`${idPrefix}-reference`}>GCash reference number</label>
          <input
            id={`${idPrefix}-reference`}
            className={`form-control${check.error && value.reference ? " form-input-error" : ""}`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="From the player's GCash receipt"
            value={value.reference}
            onChange={(change) => onChange({ ...value, reference: sanitizeReference(change.target.value) })}
          />
          <small className="form-text text-muted">Find this payment in the hall&apos;s GCash app before saving.</small>
        </div>
      )}

      {value.method === "unpaid" && (
        <p className="entry-fee-note">
          <i className="bi bi-info-circle" aria-hidden="true"></i>
          The player is marked unpaid. Open them on the list to take the fee later.
        </p>
      )}
      {value.method !== "unpaid" && check.error && value.reference && (
        <p className="tourna-walkin-error" role="alert">{check.error}</p>
      )}
    </fieldset>
  );
}
