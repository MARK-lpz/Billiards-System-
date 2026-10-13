import { useState } from "react";
import { getSignedInUser } from "../../utils/session";
import { isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { getTextError } from "../../utils/formValidation";
import FieldError from "../../Elements/Global/FieldError";
import useFormErrors from "../../Elements/Global/useFormErrors";

const DEFAULT_PROFILE = {
  fullName: "System Administrator",
  phone: "",
  branch: "Break & Chill Main Branch",
  position: "Admin",
};

const FIELDS = ["fullName", "phone", "branch", "position"];

const getProfileErrors = (profile) => {
  const errors = {};
  const fullName = getTextError(profile.fullName, "full name");
  if (fullName) errors.fullName = fullName;
  if (profile.phone && !isValidSmsNumber(profile.phone)) {
    errors.phone = "Enter the mobile number in 09XXXXXXXXX format, or leave it blank.";
  }
  const branch = getTextError(profile.branch, "branch");
  if (branch) errors.branch = branch;
  const position = getTextError(profile.position, "position", 40);
  if (position) errors.position = position;
  return errors;
};

export default function AdminProfile() {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("adminProfile") || "null");
      const user = getSignedInUser();
      return {
        ...DEFAULT_PROFILE,
        fullName: saved?.fullName || user?.full_name || user?.username || DEFAULT_PROFILE.fullName,
        phone: saved?.phone || user?.phone || "",
        branch: saved?.branch || DEFAULT_PROFILE.branch,
        position: saved?.position || user?.role || DEFAULT_PROFILE.position,
      };
    } catch {
      return DEFAULT_PROFILE;
    }
  });
  const [saved, setSaved] = useState(false);
  const errors = getProfileErrors(profile);
  const { errorFor, touch, canSave } = useFormErrors(errors);
  const fieldProps = (field) => ({
    id: `profile-${field}`,
    onBlur: () => touch(field),
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `profile-${field}-error` : undefined,
    className: errorFor(field) ? "form-input-error" : undefined,
  });

  const updateField = (field, value) => {
    setSaved(false);
    setProfile((prev) => ({ ...prev, [field]: field === "phone" ? sanitizePhoneInput(value) : value }));
  };

  const saveProfile = () => {
    if (!canSave(FIELDS, "profile-")) return;
    const cleaned = Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, String(value).trim()]));
    setProfile(cleaned);
    localStorage.setItem("adminProfile", JSON.stringify(cleaned));
    setSaved(true);
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div>
          <h1 className="page-title">Admin Profile</h1>
          <p className="page-subtitle">Essential account details for identification.</p>
        </div>
      </div>

      <div className="profile-grid">
        <div className="profile-card">
          <div className="profile-avatar">
            <i className="bi bi-person-badge"></i>
          </div>
          <h2>{profile.fullName || "Admin"}</h2>
          <p>{profile.position || "Admin"}</p>
          <span>{profile.phone || "No phone recorded"}</span>
        </div>

        <div className="profile-form-card">
          <div className="profile-form-grid">
            <label>
              <span>Full Name</span>
              <input value={profile.fullName} maxLength={80} onChange={(event) => updateField("fullName", event.target.value)} {...fieldProps("fullName")} />
              <FieldError id="profile-fullName-error" message={errorFor("fullName")} />
            </label>
            <label>
              <span>Phone</span>
              <input
                value={profile.phone}
                inputMode="numeric"
                maxLength={11}
                placeholder="09XXXXXXXXX"
                onChange={(event) => updateField("phone", event.target.value)}
                {...fieldProps("phone")}
              />
              <FieldError id="profile-phone-error" message={errorFor("phone")} />
            </label>
            <label>
              <span>Branch</span>
              <input value={profile.branch} maxLength={80} onChange={(event) => updateField("branch", event.target.value)} {...fieldProps("branch")} />
              <FieldError id="profile-branch-error" message={errorFor("branch")} />
            </label>
            <label>
              <span>Position</span>
              <input value={profile.position} maxLength={60} onChange={(event) => updateField("position", event.target.value)} {...fieldProps("position")} />
              <FieldError id="profile-position-error" message={errorFor("position")} />
            </label>
          </div>

          <button type="button" className="btn btn-success profile-save-btn" onClick={saveProfile}>
            <i className="bi bi-check-circle me-2"></i>
            Save Profile
          </button>
          {saved && <p className="profile-saved">Profile saved.</p>}
        </div>
      </div>
    </div>
  );
}
