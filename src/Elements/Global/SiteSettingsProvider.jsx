import { useCallback, useEffect, useState } from "react";
import { SiteSettingsContext } from "./SiteSettingsContext";
import { fetchSiteSettings } from "../../utils/siteSettingsApi";
import { DEFAULT_SITE_SETTINGS, mergeSiteSettings } from "../../utils/siteSettings";

// The settings change rarely, so a minute is soon enough; a tab out of sight
// does not ask, and asks at once when it is back.
const REFRESH_MS = 60000;

/**
 * Gives the whole app the website's settings (Admin > Website): the customer
 * pages show them, and the booking rules on every screen follow the opening
 * hours. `applySaved` takes what the server answered to a save, so the admin
 * sees it at once.
 */
export function SiteSettingsProvider({ children }) {
  // `failed`: the first load did not reach the server (it keeps trying).
  const [state, setState] = useState({ settings: DEFAULT_SITE_SETTINGS, savedAt: {}, savedBy: {}, loaded: false, failed: false });

  const applySaved = useCallback(({ settings, savedAt, savedBy }) => {
    const next = { settings: mergeSiteSettings(settings), savedAt: savedAt || {}, savedBy: savedBy || {}, loaded: true, failed: false };
    setState((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const answer = await fetchSiteSettings();
        if (active) applySaved(answer);
      } catch (error) {
        console.warn("Unable to load the website settings", error);
        if (active) setState((previous) => (previous.loaded || previous.failed ? previous : { ...previous, failed: true }));
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "hidden") load();
    };

    load();
    const interval = setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [applySaved]);

  return (
    <SiteSettingsContext.Provider value={{ ...state, applySaved }}>{children}</SiteSettingsContext.Provider>
  );
}
