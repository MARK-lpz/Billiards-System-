import { apiFetch, refusalError } from "./apiFetch";
import { SITE_HOST, APP_API_BASE } from "./siteAddress";

// The signed-in staff member's own profile (backend/api/profile.php).
const PROFILE_API_URL = import.meta.env.VITE_PROFILE_API_URL || (
  !import.meta.env.DEV && window.location.hostname.endsWith(SITE_HOST)
    ? `${APP_API_BASE}profile.php`
    : "/api/profile.php"
);

// A refusal keeps the server's `field`, so the form can show it under that field.
const read = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    const error = refusalError(response, data, fallbackMessage);
    error.field = data.field || "";
    throw error;
  }
  return data.profile;
};

const post = async (payload, fallbackMessage) =>
  read(
    await apiFetch(PROFILE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    fallbackMessage,
  );

export const fetchMyProfile = async () =>
  read(await apiFetch(PROFILE_API_URL), "Your profile could not be loaded.");

export const saveMyDetails = ({ fullName, email, phone, currentPassword = "" }) =>
  post({ action: "details", fullName, email, phone, currentPassword }, "Your details could not be saved.");

export const changeMyPassword = ({ currentPassword, newPassword }) =>
  post({ action: "password", currentPassword, newPassword }, "Your password could not be changed.");

/** `photo` is a data URL from preparePhoto (utils/profilePhoto.js), or null to remove it. */
export const saveMyPhoto = (photo) =>
  post({ action: "photo", photo }, "Your picture could not be saved.");
