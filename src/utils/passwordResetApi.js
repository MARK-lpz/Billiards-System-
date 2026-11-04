import { apiFetch } from "./apiFetch";
import { SITE_HOST, APP_API_BASE } from "./siteAddress";
const RESET_API_URL = import.meta.env.VITE_PASSWORD_RESET_API_URL || (
  !import.meta.env.DEV && window.location.hostname.endsWith(SITE_HOST)
    ? `${APP_API_BASE}password_reset.php`
    : "/api/password_reset.php"
);

const parseResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
};


const post = async (payload, fallbackMessage) => {
  const response = await apiFetch(RESET_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(response, fallbackMessage);
};

/**
 * The ways the server can send a code: "email" (from the hall's Gmail) once
 * its app password is set, "sms" once the SMS key is. Empty when neither is:
 * reset never happens without a code.
 */
export const fetchResetChannels = async () => {
  const response = await apiFetch(`${RESET_API_URL}?mode=1`);
  const data = await parseResponse(response, "Unable to load password reset options.");
  return Array.isArray(data.channels) ? data.channels.filter((channel) => channel === "email" || channel === "sms") : [];
};

// The server finds whether the account is an admin's or an employee's.
// `channel`: "email" (to `email`, the one in the Profile) or "sms" (to `phone`).
export const sendResetCode = async ({ username, channel, email, phone }) =>
  post({ action: "send-code", username, channel, email, phone }, "Unable to send the code right now.");

export const resetPassword = async ({ username, channel, email, phone, code, newPassword }) =>
  (await post(
    { action: "reset", username, channel, email, phone, code, newPassword },
    "Unable to reset the password right now."
  )).reset;

export const fetchPasswordResets = async () => {
  const response = await apiFetch(RESET_API_URL);
  const data = await parseResponse(response, "Unable to load password reset history.");
  return Array.isArray(data.resets) ? data.resets : [];
};
