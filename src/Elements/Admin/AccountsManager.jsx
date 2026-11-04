import { useState } from "react";
import { MIN_PASSWORD_LENGTH, isPasswordTooShort } from "../../utils/passwordRules";
import { getSmsWarning, normalizeMobileNumber, sanitizePhoneInput } from "../../utils/phone";

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// "just now", "5 minutes ago", "3 days ago", from the seconds the server counted.
const formatAgo = (seconds) => {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${plural(minutes, "minute", "minutes")} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${plural(hours, "hour", "hours")} ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${plural(days, "day", "days")} ago`;
  return `${plural(Math.floor(days / 30), "month", "months")} ago`;
};

const hasSignedIn = (account) => account.lastSignInAgo !== null && account.lastSignInAgo !== undefined;
const roleOf = (account) => (String(account.role || "").toLowerCase() === "admin" ? "admin" : "employee");

// "12 sales, 1 table bill": what was saved under the account's name.
const describeRecords = ({ sales = 0, bills = 0, activity = 0 } = {}) =>
  [
    sales && plural(sales, "sale", "sales"),
    bills && plural(bills, "table bill", "table bills"),
    activity && plural(activity, "Audit Trail entry", "Audit Trail entries"),
  ]
    .filter(Boolean)
    .join(", ");

// Admins first, then employees, each by name.
const byRoleThenName = (a, b) =>
  (roleOf(a) === "admin" ? 0 : 1) - (roleOf(b) === "admin" ? 0 : 1) ||
  String(a.username).localeCompare(String(b.username), undefined, { sensitivity: "base" });

/**
 * Every staff account in one place: the form to make one or change one
 * (username, mobile number, password, role), and the list, Active or
 * Archived, admins first. Any account but your own (`selfId`) can be archived;
 * an archived one restored, or deleted when nothing was saved under its name
 * (see AccountManagement.jsx).
 */
export default function AccountsManager({
  accounts,
  form,
  message,
  selfId = "",
  onChange,
  onClear,
  onEdit,
  onSubmit,
  onArchive,
  onRestore,
  onDelete,
  busy = false,
}) {
  const [view, setView] = useState("active");
  const passwordTooShort = isPasswordTooShort(form.password);
  const phoneWarning = getSmsWarning(form.phone);
  const isSelf = (account) => String(account.id) === String(selfId);
  const editingSelf = Boolean(form.id) && String(form.id) === String(selfId);
  const activeAccounts = accounts.filter((account) => !account.archived).sort(byRoleThenName);
  const archivedAccounts = accounts.filter((account) => account.archived).sort(byRoleThenName);
  const shown = view === "archived" ? archivedAccounts : activeAccounts;
  const editedName = form.username.trim() || "this account";

  const submitLabel = form.id ? "Save Changes" : form.role === "admin" ? "Create Admin" : "Create Employee";

  return (
    <section className="card account-management-card">
      <div className="card-body">
        <div className="account-management-header">
          <div>
            <h2 className="audit-log-header">Accounts</h2>
            <p>
              Every staff account, admins and employees. Only you can change their passwords; the mobile number lets
              them reset it by text if they forget it. Archive an account to stop it signing in.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>
            {form.id ? "New Account" : "Clear"}
          </button>
        </div>

        <form className="account-form account-form--all" onSubmit={onSubmit}>
          <input
            aria-label="Username"
            placeholder="Username"
            value={form.username}
            onChange={(event) => onChange("username", event.target.value)}
          />
          <input
            aria-label="Mobile number for password resets"
            placeholder="Mobile no. for password resets"
            type="tel"
            inputMode="numeric"
            maxLength={11}
            value={form.phone}
            aria-invalid={Boolean(phoneWarning)}
            onChange={(event) => onChange("phone", sanitizePhoneInput(event.target.value))}
          />
          <input
            aria-label="Password"
            placeholder={form.id ? `New password (optional, min ${MIN_PASSWORD_LENGTH})` : `Password (min ${MIN_PASSWORD_LENGTH})`}
            type="password"
            value={form.password}
            minLength={MIN_PASSWORD_LENGTH}
            aria-invalid={passwordTooShort}
            onChange={(event) => onChange("password", event.target.value)}
          />
          <select
            aria-label="Role"
            value={form.role}
            disabled={editingSelf}
            title={editingSelf ? "You cannot change your own role. Another admin can." : undefined}
            onChange={(event) => onChange("role", event.target.value)}
          >
            <option value="employee">Role: Employee</option>
            <option value="admin">Role: Admin</option>
          </select>
          <button type="submit" className="btn btn-success" disabled={passwordTooShort}>
            <i className={`bi ${form.id ? "bi-check2-circle" : form.role === "admin" ? "bi-shield-lock" : "bi-person-plus"} me-2`}></i>
            {submitLabel}
          </button>
        </form>

        {form.id && (
          <p className="account-message">
            <i className="bi bi-pencil me-1"></i>
            Editing <strong>{editedName}</strong>
            {editingSelf ? " (your account: only another admin can change your role)" : ""}. Press New Account to
            make another one instead.
          </p>
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
            Password must be at least {MIN_PASSWORD_LENGTH} characters ({form.password.length}/{MIN_PASSWORD_LENGTH}).
          </p>
        )}

        {form.id && form.password && (
          <p className="account-message">
            <i className="bi bi-box-arrow-right me-1"></i>
            {editingSelf
              ? "Saving a new password signs you out on your other devices."
              : `Saving a new password signs ${editedName} out on every device.`}
          </p>
        )}

        {message && <p className="account-message">{message}</p>}

        <div className="audit-filter-row account-tabs" role="group" aria-label="Show accounts">
          {[
            ["active", "Active", activeAccounts.length],
            ["archived", "Archived", archivedAccounts.length],
          ].map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={`audit-filter-btn ${view === key ? "active" : ""}`}
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        <div className="account-list">
          {shown.length === 0 && (
            <p className="account-message account-list-empty">
              {view === "archived" ? "No archived accounts." : "No accounts yet."}
            </p>
          )}
          {shown.map((account) => {
            const records = describeRecords(account.records);
            const role = roleOf(account);
            const self = isSelf(account);
            const editing = String(form.id) === String(account.id);
            const details = account.archived
              ? [`Archived ${formatAgo(account.archivedAgo ?? 0)}`, records ? `${records}: stays archived` : "No records: can be deleted"]
              : [
                  normalizeMobileNumber(account.phone) || "No reset mobile number set",
                  hasSignedIn(account) ? `Last signed in ${formatAgo(account.lastSignInAgo)}` : "No sign-in recorded yet",
                ];
            return (
              <div
                key={account.id || account.username}
                className={`account-row ${account.archived ? "is-archived" : ""} ${editing ? "is-editing" : ""}`}
              >
                <div className="account-row-main">
                  <div className="account-row-name">
                    <strong>{account.username}</strong>
                    <em className={`account-role-badge is-${role}`}>{role === "admin" ? "Admin" : "Employee"}</em>
                    {self && <em className="account-role-badge is-self">You</em>}
                  </div>
                  <span>{details.join(" · ")}</span>
                </div>
                <div className="account-row-actions">
                  {account.archived ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        title="Restore"
                        aria-label={`Restore ${account.username}`}
                        disabled={busy}
                        onClick={() => onRestore(account)}
                      >
                        <i className="bi bi-arrow-counterclockwise"></i>
                      </button>
                      {!records && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary is-danger"
                          title="Delete"
                          aria-label={`Delete ${account.username}`}
                          disabled={busy}
                          onClick={() => onDelete(account)}
                        >
                          <i className="bi bi-trash3"></i>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        title="Edit"
                        aria-label={`Edit ${account.username}`}
                        onClick={() => onEdit(account)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      {!self && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary is-danger"
                          title="Archive"
                          aria-label={`Archive ${account.username}`}
                          disabled={busy}
                          onClick={() => onArchive(account)}
                        >
                          <i className="bi bi-archive"></i>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
