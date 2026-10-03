import { MIN_PASSWORD_LENGTH, isPasswordTooShort } from "../../utils/passwordRules";
import { getSmsWarning, sanitizePhoneInput } from "../../utils/phone";

export default function AdminCredentialsManager({
  accounts,
  form,
  message,
  onChange,
  onSelect,
  onSubmit,
}) {
  const passwordTooShort = isPasswordTooShort(form.password);
  const phoneWarning = getSmsWarning(form.phone);

  return (
    <section className="card account-management-card">
      <div className="card-body">
        <div className="account-management-header">
          <div>
            <h2 className="audit-log-header">Admin Credentials</h2>
            <p>Update an existing admin username, mobile number or password. Admin accounts cannot be created here.</p>
          </div>
        </div>

        {accounts.length ? (
          <form className="account-form account-form--credentials" onSubmit={onSubmit}>
            <select value={form.id || ""} onChange={(event) => onSelect(event.target.value)}>
              <option value="">Select admin account...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.username}</option>
              ))}
            </select>
            <input
              required
              placeholder="Username"
              value={form.username}
              onChange={(event) => onChange("username", event.target.value)}
            />
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              placeholder="Mobile no. for password resets"
              value={form.phone}
              aria-invalid={Boolean(phoneWarning)}
              onChange={(event) => onChange("phone", sanitizePhoneInput(event.target.value))}
            />
            <input
              type="password"
              placeholder={`New password (optional, min ${MIN_PASSWORD_LENGTH})`}
              value={form.password}
              minLength={MIN_PASSWORD_LENGTH}
              aria-invalid={passwordTooShort}
              onChange={(event) => onChange("password", event.target.value)}
            />
            <button type="submit" className="btn btn-success" disabled={!form.id || passwordTooShort}>
              <i className="bi bi-key me-2"></i>
              Update Admin Credentials
            </button>
          </form>
        ) : (
          <p className="account-message">No admin account is available to update.</p>
        )}

        {phoneWarning && (
          <p className="account-message account-message--warning" role="alert">
            <i className="bi bi-exclamation-circle me-1"></i>
            {phoneWarning}
          </p>
        )}

        {passwordTooShort && (
          <p className="account-message account-message--warning" role="alert">
            <i className="bi bi-exclamation-circle me-1"></i>
            New password must be at least {MIN_PASSWORD_LENGTH} characters ({form.password.length}/{MIN_PASSWORD_LENGTH}).
          </p>
        )}

        {message && <p className="account-message">{message}</p>}
      </div>
    </section>
  );
}
