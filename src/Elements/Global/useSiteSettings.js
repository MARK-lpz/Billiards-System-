import { useContext } from "react";
import { SiteSettingsContext } from "./SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS } from "../../utils/siteSettings";

const OUTSIDE_PROVIDER = { settings: DEFAULT_SITE_SETTINGS, savedAt: {}, loaded: false, failed: false, applySaved: () => {} };

/**
 * The website's settings (see SiteSettingsProvider): { settings, savedAt,
 * loaded, failed, applySaved }. `loaded` is false until the server has answered
 * once; `failed` says the first try did not reach it.
 */
export function useSiteSettings() {
  return useContext(SiteSettingsContext) || OUTSIDE_PROVIDER;
}
