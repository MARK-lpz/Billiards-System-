/**
 * What the admin sets for the website (Admin > Website; api/site_settings.php):
 * the GCash account customers pay into, the hall's address and contacts, an
 * announcement, and the opening hours. Until the server answers, and for
 * anything never saved, these defaults hold, which is how the site was before.
 */
import { eventMediaUrl } from "./eventMedia";
import { DEFAULT_RESERVATION_HOURS } from "./reservations";

export const DEFAULT_SITE_SETTINGS = {
  gcash: { accountName: "", number: "", qr: null, ready: false },
  business: { address: "", mapsUrl: "", phone: "", facebookUrl: "" },
  announcement: { enabled: false, message: "", startDate: "", endDate: "" },
  hours: DEFAULT_RESERVATION_HOURS,
};

export const ANNOUNCEMENT_MAX_LENGTH = 200;

/** Every section, what the server sent over the defaults. */
export const mergeSiteSettings = (settings) =>
  Object.fromEntries(
    Object.entries(DEFAULT_SITE_SETTINGS).map(([section, defaults]) => [
      section,
      { ...defaults, ...(settings?.[section] || {}) },
    ])
  );

/** Where the GCash QR picture is served from, or "" when none is set. */
export const gcashQrUrl = (gcash) => (gcash?.qr?.path ? eventMediaUrl(gcash.qr) : "");

/** "0917 123 4567" from "09171234567". */
export const formatMobile = (number) => {
  const digits = String(number || "").replace(/\D/g, "");
  return digits.length === 11 ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : String(number || "");
};

/** A tel: link for a contact number as the admin typed it. */
export const telLink = (phone) => {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
};

/**
 * Whether the announcement shows on `today` (YYYY-MM-DD): turned on, written,
 * and inside its dates (either may be left open).
 */
export const isAnnouncementShowing = (announcement, today) =>
  Boolean(
    announcement?.enabled &&
      String(announcement.message || "").trim() &&
      (!announcement.startDate || announcement.startDate <= today) &&
      (!announcement.endDate || announcement.endDate >= today)
  );

/** True when at least one way to reach or find the hall is set. */
export const hasBusinessInfo = (business) =>
  Boolean(business && (business.address || business.mapsUrl || business.phone || business.facebookUrl));
