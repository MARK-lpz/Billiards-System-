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

/** The picture in the top bar, beside the bell: it opens the Profile page. */
export function ProfileButton({ profile, onOpen }) {
  const name = profile?.fullName || profile?.username;
  return (
    <button
      type="button"
      className="header-icon-btn topbar-profile-btn"
      onClick={onOpen}
      aria-label={name ? `My profile (${name})` : "My profile"}
      title="My profile"
    >
      <ProfileAvatar profile={profile} />
    </button>
  );
}
