import { apiFetch } from "./apiFetch";
import { SITE_HOST, APP_API_BASE } from "./siteAddress";

// The staff bells' notices (api/notifications.php).
export const NOTIFICATION_API_URL = import.meta.env.VITE_NOTIFICATION_API_URL || (
  !import.meta.env.DEV && window.location.hostname === SITE_HOST
    ? `${APP_API_BASE}notifications.php`
    : "/api/notifications.php"
);

/**
 * Sends a notice to another role's bell (e.g. the front desk to the admin).
 * `id` is used once: sending the same id again adds nothing. Throws when the
 * server did not take it.
 */
export const sendNotice = async ({ id, type, message, data = null, recipients = ["admin"] }) => {
  const response = await apiFetch(NOTIFICATION_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, type, message, data, recipients }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || "The notice could not be sent.");
};
