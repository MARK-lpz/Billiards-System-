import { apiFetch } from "./apiFetch";
import { SITE_HOST, APP_API_BASE } from "./siteAddress";

// The website's settings (Admin > Website): read by anyone, saved by the staff
// (an employee only the GCash details and the slides).
const SITE_SETTINGS_API_URL = import.meta.env.VITE_SITE_SETTINGS_API_URL || (
  !import.meta.env.DEV && window.location.hostname === SITE_HOST
    ? `${APP_API_BASE}site_settings.php`
    : "/api/site_settings.php"
);

const parseResponse = async (response, fallbackMessage) => {
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok || !data?.success) throw new Error(data?.message || fallbackMessage);
  // `savedBy` ({ section: { name, role } }) comes to signed-in staff only.
  return { settings: data.settings, savedAt: data.savedAt || {}, savedBy: data.savedBy || {} };
};

export const fetchSiteSettings = async () =>
  parseResponse(await apiFetch(SITE_SETTINGS_API_URL), "Unable to load the website settings.");

/**
 * Saves one section ("gcash", "business", "announcement", "hours", "showcase",
 * "bookingSteps" or "footer"); resolves with every section.
 */
export const saveSiteSection = async (section, values) =>
  parseResponse(
    await apiFetch(SITE_SETTINGS_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, values }),
    }),
    "Unable to save. Please try again."
  );
