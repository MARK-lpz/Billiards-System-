import { useEffect, useRef, useState } from "react";
import "../styles/Profile.css";
import ProfileAvatar from "../Elements/Global/ProfileAvatar";
import ProfileDetails from "../Elements/Global/ProfileDetails";
import ProfileAccount from "../Elements/Global/ProfileAccount";
import { appendAuditLog } from "../utils/audit";
import { preparePhoto } from "../utils/profilePhoto";
import { saveMyPhoto } from "../utils/profileApi";

const ROLE_LABELS = { admin: "Admin", employee: "Employee" };

const parseServerTime = (value) => new Date(String(value || "").replace(" ", "T"));

const formatMemberSince = (value) => {
  const date = parseServerTime(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

const sameDay = (a, b) => a.toDateString() === b.toDateString();

// "Today, 2:14 PM", "Yesterday, 9:05 AM" or "Oct 18, 2:14 PM".
const formatWhen = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return `Today, ${time}`;
  if (sameDay(date, yesterday)) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
};

/** The picture, name, role and username, with the picture changed or removed here. */
function IdentityCard({ profile, onSaved }) {
  const fileInput = useRef(null);
  const [photo, setPhoto] = useState({ busy: false, error: "" });
  const roleLabel = ROLE_LABELS[profile.role] || profile.role;
  const memberSince = formatMemberSince(profile.memberSince);

  const savePhoto = async (prepare) => {
    setPhoto({ busy: true, error: "" });
    try {
      onSaved(await saveMyPhoto(await prepare()));
      setPhoto({ busy: false, error: "" });
    } catch (error) {
      setPhoto({ busy: false, error: error.message });
    }
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    // Cleared so the same file can be chosen again after an error.
    event.target.value = "";
    if (file) savePhoto(() => preparePhoto(file));
  };

  return (
    <aside className={`profile-id-card role-${profile.role}`}>
      <div className="profile-photo-wrap">
        <ProfileAvatar profile={profile} className="profile-photo" />
        <button
          type="button"
          className="profile-photo-btn"
          onClick={() => fileInput.current?.click()}
          disabled={photo.busy}
          aria-label={profile.photo ? "Change picture" : "Add a picture"}
          title={profile.photo ? "Change picture" : "Add a picture"}
        >
          <i className={`bi ${photo.busy ? "bi-hourglass-split" : "bi-camera"}`} aria-hidden="true"></i>
        </button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
      </div>

      <h2 className="profile-name">{profile.fullName || profile.username}</h2>
      <span className="profile-role-badge">
        <i className={`bi ${profile.role === "admin" ? "bi-shield-fill-check" : "bi-person-badge"}`} aria-hidden="true"></i>
        {roleLabel}
      </span>
      <p className="profile-username">@{profile.username}</p>

      {photo.error && <p className="profile-message error" role="alert">{photo.error}</p>}
      {!profile.photo && !photo.error && <p className="profile-photo-hint">Add a picture so the team knows it is you.</p>}
      {profile.photo && (
        <button type="button" className="profile-link" onClick={() => savePhoto(async () => null)} disabled={photo.busy}>
          Remove picture
        </button>
      )}

      {memberSince && (
        <div className="profile-since">
          <span>Member since</span>
          <strong>{memberSince}</strong>
        </div>
      )}
    </aside>
  );
}

/**
 * The signed-in staff member's own page, admin and employee alike, in three
 * columns where the page is wide enough (two, then one, on narrower screens):
 * the picture card; personal details and account & security; their recent
 * activity. `myProfile` is the dashboard's useMyProfile(), so a new picture
 * shows in the top bar at once. `onOpenAccounts` and `onOpenAuditTrail` are the
 * admin's only.
 */
export default function Profile({ myProfile, setLogs, staffLabel, onOpenAccounts, onOpenAuditTrail }) {
  const { profile, failed, reload, applySaved } = myProfile;

  // The activity list is read again each time the page opens.
  useEffect(() => {
    reload();
  }, [reload]);

  if (!profile) {
    return (
      <div className="profile-page">
        <div className="profile-section profile-loading" role="status">
          {failed ? (
            <>
              <p>Your profile could not be loaded.</p>
              <button type="button" className="profile-btn-ghost" onClick={reload}>
                <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
                Try again
              </button>
            </>
          ) : (
            <p>Loading your profile...</p>
          )}
        </div>
      </div>
    );
  }

  const logChange = (action, detail) =>
    appendAuditLog(setLogs, { type: "auth", staff: staffLabel, action, detail, entity: "user", entityId: String(profile.id) });

  return (
    <div className="profile-page">
      <div className="profile-layout">
        <IdentityCard profile={profile} onSaved={applySaved} />

        <div className="profile-main">
          <ProfileDetails
            profile={profile}
            onSaved={(saved, phoneChanged) => {
              applySaved(saved);
              logChange(
                "Updated own profile",
                `${saved.username} updated their profile details${phoneChanged ? " and their mobile number for password resets" : ""}.`,
              );
            }}
          />
          <ProfileAccount
            profile={profile}
            onOpenAccounts={onOpenAccounts}
            onPasswordChanged={(saved) => {
              applySaved(saved);
              logChange("Changed own password", `${saved.username} changed their password from their Profile.`);
            }}
          />
        </div>

        <section className="profile-section profile-activity-card" aria-labelledby="profile-activity-title">
          <div className="profile-section-head">
            <i className="bi bi-clock-history" aria-hidden="true"></i>
            <div>
              <h2 id="profile-activity-title">My recent activity</h2>
              <p>The last things you did in the system.</p>
            </div>
          </div>
          {profile.activity.length ? (
            <ul className="profile-activity">
              {profile.activity.map((entry) => (
                <li key={entry.id}>
                  <span className="profile-activity-dot" aria-hidden="true"></span>
                  <div className="profile-activity-text">
                    <strong>{entry.action || "Activity"}</strong>
                    {entry.detail && <span>{entry.detail}</span>}
                  </div>
                  <time dateTime={entry.timestamp}>{formatWhen(entry.timestamp)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty-state">Nothing yet. What you do in the system shows here.</p>
          )}
          {onOpenAuditTrail && (
            <button type="button" className="profile-link profile-activity-all" onClick={onOpenAuditTrail}>
              View all in Audit Trail
              <i className="bi bi-arrow-right" aria-hidden="true"></i>
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
