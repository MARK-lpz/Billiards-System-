import { useSiteSettings } from "./useSiteSettings";
import { gcashQrUrl } from "../../utils/siteSettings";

/**
 * The hall's GCash for payments at the counter: the same account the website
 * takes payments to, set in Admin > Website. `ready` once its QR is there;
 * until then `note` says why GCash can't be taken ("" while still loading).
 */
export function useCounterGcash() {
  const { settings, loaded, failed } = useSiteSettings();
  const gcash = settings.gcash || {};
  const qrUrl = gcashQrUrl(gcash);
  const ready = loaded && Boolean(gcash.ready) && Boolean(qrUrl);

  let note = "";
  if (!ready && loaded) {
    note = "GCash is not set up yet. The admin adds the hall's GCash QR in Admin > Website. Take cash for now.";
  } else if (!ready && failed) {
    note = "The hall's GCash QR could not be loaded. Check the internet, or take cash.";
  }

  return { gcash, qrUrl, ready, note };
}
