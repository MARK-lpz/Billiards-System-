import { initialsOf } from "../../utils/profilePhoto";

/** The staff member's picture, their initials when they have none, or a plain icon until it loads. */
export default function ProfileAvatar({ profile, className = "" }) {
  if (!profile) {
    return (
      <span className={`profile-avatar ${className}`} aria-hidden="true">
        <i className="bi bi-person"></i>
      </span>
    );
  }
  if (profile.photo) {
    return <img className={`profile-avatar ${className}`} src={profile.photo} alt="" />;
  }
  return (
    <span className={`profile-avatar ${className}`} aria-hidden="true">
      {initialsOf(profile.fullName || profile.username)}
    </span>
  );
}

/**
 * The picture in the top bar, beside the bell: it opens the Profile page. A dot
 * on it means there is no mobile number yet, so a forgotten password could not
 * be reset by text (see ProfileDetails).
 */
export function ProfileButton({ profile, onOpen }) {
  const name = profile?.fullName || profile?.username;
  const needsPhone = Boolean(profile) && !profile.phone;
  const label = name ? `My profile (${name})` : "My profile";
  return (
    <button
      type="button"
      className="header-icon-btn topbar-profile-btn"
      onClick={onOpen}
      aria-label={needsPhone ? `${label}: add your mobile number` : label}
      title={needsPhone ? "My profile: add your mobile number" : "My profile"}
    >
      <ProfileAvatar profile={profile} />
      {needsPhone && <span className="topbar-profile-dot" aria-hidden="true"></span>}
    </button>
  );
}
