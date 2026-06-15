import { useEffect, useState } from "react";

const DEFAULT_PROFILE = {
  fullName: "System Administrator",
  gmail: "",
  phone: "",
  branch: "Break & Chill Main Branch",
  position: "Admin",
};

export default function AdminProfile() {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("adminProfile") || "null");
      const user = JSON.parse(localStorage.getItem("user") || "null");
      return {
        ...DEFAULT_PROFILE,
        fullName: saved?.fullName || user?.full_name || user?.username || DEFAULT_PROFILE.fullName,
        gmail: saved?.gmail || user?.email || "",
        phone: saved?.phone || user?.phone || "",
        branch: saved?.branch || DEFAULT_PROFILE.branch,
        position: saved?.position || user?.role || DEFAULT_PROFILE.position,
      };
    } catch {
      return DEFAULT_PROFILE;
    }
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile.gmail) return;
    try {
      const gmails = JSON.parse(localStorage.getItem("registeredAdminGmails") || "[]");
      const next = Array.from(new Set([...gmails, profile.gmail].filter(Boolean)));
      localStorage.setItem("registeredAdminGmails", JSON.stringify(next));
    } catch (error) {
      console.warn("Unable to sync admin Gmail", error);
    }
  }, [profile.gmail]);

  const updateField = (field, value) => {
    setSaved(false);
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = () => {
    localStorage.setItem("adminProfile", JSON.stringify(profile));
    setSaved(true);
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div>
          <h1 className="page-title">Admin Profile</h1>
          <p className="page-subtitle">Gmail and essential account details for admin recovery and identification.</p>
        </div>
      </div>

      <div className="profile-grid">
        <div className="profile-card">
          <div className="profile-avatar">
            <i className="bi bi-person-badge"></i>
          </div>
          <h2>{profile.fullName || "Admin"}</h2>
          <p>{profile.position || "Admin"}</p>
          <span>{profile.gmail || "No Gmail recorded"}</span>
        </div>

        <div className="profile-form-card">
          <div className="profile-form-grid">
            <label>
              <span>Full Name</span>
              <input value={profile.fullName} onChange={(event) => updateField("fullName", event.target.value)} />
            </label>
            <label>
              <span>Gmail</span>
              <input type="email" value={profile.gmail} onChange={(event) => updateField("gmail", event.target.value)} />
            </label>
            <label>
              <span>Phone</span>
              <input value={profile.phone} onChange={(event) => updateField("phone", event.target.value)} />
            </label>
            <label>
              <span>Branch</span>
              <input value={profile.branch} onChange={(event) => updateField("branch", event.target.value)} />
            </label>
            <label>
              <span>Position</span>
              <input value={profile.position} onChange={(event) => updateField("position", event.target.value)} />
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
