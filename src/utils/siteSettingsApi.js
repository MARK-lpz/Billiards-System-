import { apiFetch } from "./apiFetch";

// The website's settings (Admin > Website): read by anyone, saved by the admin.
const SITE_SETTINGS_API_URL = import.meta.env.VITE_SITE_SETTINGS_API_URL || (
  !import.meta.env.DEV && window.location.hostname === "breakandchill.com"
    ? "https://app.breakandchill.com/api/site_settings.php"
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
  return { settings: data.settings, savedAt: data.savedAt || {} };
};

export const fetchSiteSettings = async () =>
  parseResponse(await apiFetch(SITE_SETTINGS_API_URL), "Unable to load the website settings.");

/** Saves one section ("gcash", "business", "announcement" or "hours"); resolves with every section. */
export const saveSiteSection = async (section, values) =>
  parseResponse(
    await apiFetch(SITE_SETTINGS_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, values }),
    }),
    "Unable to save. Please try again."
  );
