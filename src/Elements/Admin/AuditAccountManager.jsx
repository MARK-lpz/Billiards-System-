import { MIN_PASSWORD_LENGTH, isPasswordTooShort } from "../../utils/passwordRules";
import { getSmsWarning, normalizeMobileNumber, sanitizePhoneInput } from "../../utils/phone";

export default function AuditAccountManager({
  accounts,
  accountForm,
  accountMessage,
  onChange,
  onClear,
  onEdit,
  onSubmit,
}) {
  const passwordTooShort = isPasswordTooShort(accountForm.password);
  const phoneWarning = getSmsWarning(accountForm.phone);

  return (
    <div className="card account-management-card">
      <div className="card-body">
        <div className="account-management-header">
          <div>
            <h2 className="audit-log-header">Employee Accounts</h2>
            <p>Create an employee account, or update a username, mobile number and password. The mobile number lets an employee reset their own password by text.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>
            Clear
          </button>
        </div>

        <form className="account-form" onSubmit={onSubmit}>
          <input
            placeholder="Username"
            value={accountForm.username}
            onChange={(event) => onChange("username", event.target.value)}
          />
          <input
            placeholder="Mobile no. for password resets"
            type="tel"
            inputMode="numeric"
            maxLength={11}
            value={accountForm.phone}
            aria-invalid={Boolean(phoneWarning)}
            onChange={(event) => onChange("phone", sanitizePhoneInput(event.target.value))}
          />
          <input
            placeholder={accountForm.id ? `New password (optional, min ${MIN_PASSWORD_LENGTH})` : `Password (min ${MIN_PASSWORD_LENGTH})`}
            type="password"
            value={accountForm.password}
            minLength={MIN_PASSWORD_LENGTH}
            aria-invalid={passwordTooShort}
            onChange={(event) => onChange("password", event.target.value)}
          />
          <button type="submit" className="btn btn-success" disabled={passwordTooShort}>
            <i className="bi bi-person-plus me-2"></i>
            {accountForm.id ? "Update Employee" : "Create Employee"}
          </button>
        </form>

        {phoneWarning && (
          <p className="account-message account-message--warning" role="alert">
            <i className="bi bi-exclamation-circle me-1"></i>
            {phoneWarning}
          </p>
        )}

        {passwordTooShort && (
          <p className="account-message account-message--warning" role="alert">
            <i className="bi bi-exclamation-circle me-1"></i>
            Password must be at least {MIN_PASSWORD_LENGTH} characters ({accountForm.password.length}/{MIN_PASSWORD_LENGTH}).
          </p>
        )}

        {accountMessage && <p className="account-message">{accountMessage}</p>}

        <div className="account-list">
          {accounts.map((account) => (
            <div key={account.id || account.username} className="account-row">
              <div>
                <strong>{account.username}</strong>
                <span>
                  {normalizeMobileNumber(account.phone) || "No reset mobile number set"}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => onEdit(account)}
              >
                <i className="bi bi-pencil"></i>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
