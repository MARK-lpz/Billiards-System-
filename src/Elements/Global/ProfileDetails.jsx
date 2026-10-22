import { useState } from "react";
import FieldError from "./FieldError";
import useFormErrors from "./useFormErrors";
import { getTextError } from "../../utils/formValidation";
import { isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { saveMyDetails } from "../../utils/profileApi";

const FIELDS = ["fullName", "phone", "email", "currentPassword"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatPhone = (phone) => (phone.length === 11 ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : phone);

const getDetailsErrors = (form, phoneChanged) => {
  const errors = {};
  const fullName = getTextError(form.fullName, "full name", 120);
  if (fullName) errors.fullName = fullName;
  if (form.phone && !isValidSmsNumber(form.phone)) {
    errors.phone = "Enter the mobile number in 09XXXXXXXXX format, or leave it blank.";
  }
  const email = form.email.trim();
  if (email && (email.length > 120 || !EMAIL_PATTERN.test(email))) {
    errors.email = "Enter a valid email address, or leave it blank.";
  }
  if (phoneChanged && !form.currentPassword) errors.currentPassword = "Enter your current password.";
  return errors;
};

function DetailsForm({ profile, onSaved, onCancel }) {
  const [form, setForm] = useState({ fullName: profile.fullName, phone: profile.phone, email: profile.email, currentPassword: "" });
  const [refusal, setRefusal] = useState(null);
  const [busy, setBusy] = useState(false);
  const phoneChanged = form.phone !== profile.phone;
  const { errorFor, touch, canSave } = useFormErrors(getDetailsErrors(form, phoneChanged));

  const messageFor = (field) => errorFor(field) || (refusal?.field === field ? refusal.message : "");
  const fieldProps = (field) => ({
    id: `profile-${field}`,
    onBlur: () => touch(field),
    "aria-invalid": Boolean(messageFor(field)),
    "aria-describedby": messageFor(field) ? `profile-${field}-error` : undefined,
    className: messageFor(field) ? "form-input-error" : undefined,
  });
  const update = (field, value) => {
    setRefusal(null);
    setForm((previous) => ({ ...previous, [field]: field === "phone" ? sanitizePhoneInput(value) : value }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy || !canSave(FIELDS, "profile-")) return;
    setBusy(true);
    try {
      const saved = await saveMyDetails({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone,
        currentPassword: phoneChanged ? form.currentPassword : "",
      });
      onSaved(saved, phoneChanged);
    } catch (error) {
      setRefusal({ field: error.field, message: error.message });
      if (error.field) document.getElementById(`profile-${error.field}`)?.focus();
      setBusy(false);
    }
  };

  return (
    <form className="profile-form" onSubmit={save} noValidate>
      <label className="profile-field profile-field-wide">
        <span>Full name</span>
        <input autoFocus value={form.fullName} maxLength={120} autoComplete="name" onChange={(event) => update("fullName", event.target.value)} {...fieldProps("fullName")} />
        <FieldError id="profile-fullName-error" message={messageFor("fullName")} />
      </label>
      <label className="profile-field">
        <span>Mobile no. <em>(gets your password reset codes)</em></span>
        <input
          value={form.phone}
          inputMode="numeric"
          maxLength={11}
          placeholder="09XXXXXXXXX"
          autoComplete="tel"
          onChange={(event) => update("phone", event.target.value)}
          {...fieldProps("phone")}
        />
        <FieldError id="profile-phone-error" message={messageFor("phone")} />
      </label>
      <label className="profile-field">
        <span>Email <em>(optional)</em></span>
        <input value={form.email} maxLength={120} type="email" autoComplete="email" onChange={(event) => update("email", event.target.value)} {...fieldProps("email")} />
        <FieldError id="profile-email-error" message={messageFor("email")} />
      </label>
      {phoneChanged && (
        <label className="profile-field profile-field-wide">
          <span>Current password <em>(needed to change your mobile no.)</em></span>
          <input
            type="password"
            value={form.currentPassword}
            autoComplete="current-password"
            onChange={(event) => update("currentPassword", event.target.value)}
            {...fieldProps("currentPassword")}
          />
          <FieldError id="profile-currentPassword-error" message={messageFor("currentPassword")} />
        </label>
      )}
      {refusal && !refusal.field && <p className="profile-message error profile-field-wide" role="alert">{refusal.message}</p>}
      <div className="profile-form-actions profile-field-wide">
        <button type="submit" className="settings-btn primary" disabled={busy}>
          <i className={`bi ${busy ? "bi-hourglass-split" : "bi-check-circle"}`} aria-hidden="true"></i>
          {busy ? "Saving..." : "Save changes"}
        </button>
        <button type="button" className="profile-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

/** Personal details: shown as a list, edited in place. */
export default function ProfileDetails({ profile, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const startEditing = () => {
    setNote("");
    setEditing(true);
  };

  return (
    <section className="profile-section" aria-labelledby="profile-details-title">
      <div className="profile-section-head">
        <i className="bi bi-person-vcard" aria-hidden="true"></i>
        <div>
          <h2 id="profile-details-title">Personal details</h2>
          <p>Your name and how to reach you.</p>
        </div>
        {!editing && (
          <button type="button" className="profile-btn-ghost" onClick={startEditing}>
            <i className="bi bi-pencil" aria-hidden="true"></i>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <DetailsForm
          profile={profile}
          onCancel={() => setEditing(false)}
          onSaved={(saved, phoneChanged) => {
            onSaved(saved, phoneChanged);
            setEditing(false);
            setNote(phoneChanged ? "Saved. Password reset codes now go to your new mobile number." : "Saved.");
          }}
        />
      ) : (
        <>
          <dl className="profile-rows">
            <div>
              <dt>Full name</dt>
              <dd>
                {profile.fullName || (
                  <button type="button" className="profile-link profile-add-link" onClick={startEditing}>
                    <i className="bi bi-plus-lg" aria-hidden="true"></i>
                    Add your name
                  </button>
                )}
              </dd>
            </div>
            <div>
              <dt>Mobile no.</dt>
              <dd>{profile.phone ? formatPhone(profile.phone) : <span className="profile-empty">Not set: you cannot reset your password by text</span>}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{profile.email || <span className="profile-empty">Not set</span>}</dd>
            </div>
          </dl>
          {note && <p className="profile-message success" role="status">{note}</p>}
        </>
      )}
    </section>
  );
}
