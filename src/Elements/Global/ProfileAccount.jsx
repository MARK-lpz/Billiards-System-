import { useState } from "react";
import FieldError from "./FieldError";
import useFormErrors from "./useFormErrors";
import { MIN_PASSWORD_LENGTH } from "../../utils/passwordRules";
import { changeMyPassword } from "../../utils/profileApi";

const ROLE_LABELS = { admin: "Admin", employee: "Employee" };
const FIELDS = ["currentPassword", "newPassword", "confirmPassword"];
const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

const getPasswordErrors = (form) => {
  const errors = {};
  if (!form.currentPassword) errors.currentPassword = "Enter your current password.";
  if (form.newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`;
  } else if (form.newPassword === form.currentPassword) {
    errors.newPassword = "Choose a password different from your current one.";
  }
  if (form.confirmPassword !== form.newPassword) errors.confirmPassword = "The two new passwords do not match.";
  return errors;
};

function PasswordForm({ onChanged, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [refusal, setRefusal] = useState(null);
  const [busy, setBusy] = useState(false);
  const { errorFor, touch, canSave } = useFormErrors(getPasswordErrors(form));

  const messageFor = (field) => errorFor(field) || (refusal?.field === field ? refusal.message : "");
  const fieldProps = (field, autoComplete) => ({
    id: `profile-pw-${field}`,
    type: "password",
    value: form[field],
    autoComplete,
    onChange: (event) => {
      setRefusal(null);
      setForm((previous) => ({ ...previous, [field]: event.target.value }));
    },
    onBlur: () => touch(field),
    "aria-invalid": Boolean(messageFor(field)),
    "aria-describedby": messageFor(field) ? `profile-pw-${field}-error` : undefined,
    className: messageFor(field) ? "form-input-error" : undefined,
  });

  const save = async (event) => {
    event.preventDefault();
    if (busy || !canSave(FIELDS, "profile-pw-")) return;
    setBusy(true);
    try {
      onChanged(await changeMyPassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }));
    } catch (error) {
      setRefusal({ field: error.field, message: error.message });
      if (error.field) document.getElementById(`profile-pw-${error.field}`)?.focus();
      setBusy(false);
    }
  };

  return (
    <form className="profile-form profile-password-form" onSubmit={save} noValidate>
      <label className="profile-field profile-field-wide">
        <span>Current password</span>
        <input autoFocus {...fieldProps("currentPassword", "current-password")} />
        <FieldError id="profile-pw-currentPassword-error" message={messageFor("currentPassword")} />
      </label>
      <label className="profile-field">
        <span>New password <em>(at least {MIN_PASSWORD_LENGTH} characters)</em></span>
        <input {...fieldProps("newPassword", "new-password")} />
        <FieldError id="profile-pw-newPassword-error" message={messageFor("newPassword")} />
      </label>
      <label className="profile-field">
        <span>Confirm new password</span>
        <input {...fieldProps("confirmPassword", "new-password")} />
        <FieldError id="profile-pw-confirmPassword-error" message={messageFor("confirmPassword")} />
      </label>
      {refusal && !refusal.field && <p className="profile-message error profile-field-wide" role="alert">{refusal.message}</p>}
      <div className="profile-form-actions profile-field-wide">
        <button type="submit" className="settings-btn primary" disabled={busy}>
          <i className={`bi ${busy ? "bi-hourglass-split" : "bi-shield-check"}`} aria-hidden="true"></i>
          {busy ? "Changing..." : "Change password"}
        </button>
        <button type="button" className="profile-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

/**
 * Account & security: the username and role (the admin's to change, in
 * Accounts) and the password, changed here with the current one. Every other
 * place the account is signed in then has to sign in again.
 */
export default function ProfileAccount({ profile, onOpenAccounts, onPasswordChanged }) {
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState("");
  const isAdmin = profile.role === "admin";

  return (
    <section className="profile-section" aria-labelledby="profile-account-title">
      <div className="profile-section-head">
        <i className="bi bi-shield-lock" aria-hidden="true"></i>
        <div>
          <h2 id="profile-account-title">Account &amp; security</h2>
          <p>
            {isAdmin
              ? "Only you know your password."
              : "Only the admin can change your username or role. Only you know your password."}
          </p>
        </div>
      </div>

      <dl className="profile-rows">
        <div>
          <dt>Username</dt>
          <dd>{profile.username}</dd>
          {isAdmin && onOpenAccounts && (
            <button type="button" className="profile-btn-ghost profile-row-action" onClick={onOpenAccounts}>
              <i className="bi bi-people" aria-hidden="true"></i>
              Open Accounts
            </button>
          )}
        </div>
        <div>
          <dt>Role</dt>
          <dd>{ROLE_LABELS[profile.role] || profile.role}</dd>
        </div>
        <div>
          <dt>Password</dt>
          <dd className="profile-password-dots" aria-label="Hidden">••••••••</dd>
          {!changing && (
            <button
              type="button"
              className="profile-btn-ghost profile-row-action"
              onClick={() => {
                setNote("");
                setChanging(true);
              }}
            >
              <i className="bi bi-key" aria-hidden="true"></i>
              Change password
            </button>
          )}
        </div>
      </dl>

      {changing && (
        <PasswordForm
          onCancel={() => setChanging(false)}
          onChanged={(saved) => {
            onPasswordChanged(saved);
            setChanging(false);
            setNote("Password changed. Any other device signed in with your account has to sign in again.");
          }}
        />
      )}
      {note && <p className="profile-message success" role="status">{note}</p>}
    </section>
  );
}
