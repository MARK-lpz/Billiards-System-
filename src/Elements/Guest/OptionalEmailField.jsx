import { MAX_GUEST_EMAIL } from "../../utils/formValidation";

// The website forms' optional email: left blank, the customer gets texts only;
// given, the same updates are emailed too (backend config/customer_emails.php).
// `warning` comes from getOptionalEmailError and replaces the note under it.
export default function OptionalEmailField({ id, value, onChange, warning = "", name = "email" }) {
  const noteId = `${id}-note`;

  return (
    <div className="form-field-full">
      <label className="label" htmlFor={id}>Email (optional)</label>
      <input
        id={id}
        name={name}
        type="email"
        className={`field-input ${warning ? "is-invalid" : ""}`}
        value={value}
        onChange={onChange}
        placeholder="you@gmail.com"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={MAX_GUEST_EMAIL}
        aria-invalid={Boolean(warning)}
        aria-describedby={noteId}
      />
      {warning ? (
        <p className="field-warning" id={noteId}>{warning}</p>
      ) : (
        <p className="field-helper" id={noteId}>We email the same updates here too. Leave it blank to get texts only.</p>
      )}
    </div>
  );
}
