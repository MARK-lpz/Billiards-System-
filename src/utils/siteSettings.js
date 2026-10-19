/**
 * What the admin sets for the website (Admin > Website; api/site_settings.php):
 * the GCash account customers pay into, the hall's address and contacts, an
 * announcement, the opening hours, and the home page's showcase slides, booking
 * steps and footer line. Until the server answers, and for anything never
 * saved, these defaults hold, which is how the site was before.
 */
import { eventMediaUrl } from "./eventMedia";
import { DEFAULT_RESERVATION_HOURS } from "./reservations";

export const DEFAULT_SITE_SETTINGS = {
  gcash: { accountName: "", number: "", qr: null, ready: false },
  business: { address: "", mapsUrl: "", phone: "", facebookUrl: "" },
  announcement: { enabled: false, message: "", startDate: "", endDate: "" },
  hours: DEFAULT_RESERVATION_HOURS,
  // A slide without its own photo shows the table's felt instead (see slidePictureUrl).
  showcase: {
    slides: [
      {
        id: "brand-1",
        title: "Play. Compete. Unwind.",
        text: "Break & Chill is your place for casual games, serious practice, and tournament play.",
        image: null,
        position: "center",
      },
      {
        id: "brand-2",
        title: "Your Next Game Starts Here",
        text: "Enjoy a focused billiards space built for players, teams, and friendly competition.",
        image: null,
        position: "bottom",
      },
    ],
  },
  bookingSteps: {
    heading: "Your table in three shots.",
    steps: [
      { title: "Pick a table and time", text: "Choose the date, an open table, your start time, and how many hours you want to play." },
      { title: "Pay with GCash", text: "Send the payment and enter the reference number from your receipt to hold the table." },
      {
        title: "Get confirmed",
        text: "The front desk checks your payment and approves the booking. Your table is waiting when you arrive.",
      },
    ],
  },
  footer: { tagline: "Games, tournaments, and good breaks." },
};

export const ANNOUNCEMENT_MAX_LENGTH = 200;

// The same limits the server keeps (config/site_settings.php).
export const SHOWCASE_SLIDES_MAX = 5;
export const SLIDE_TITLE_MAX_LENGTH = 60;
export const SLIDE_TEXT_MAX_LENGTH = 160;
export const STEPS_HEADING_MAX_LENGTH = 60;
export const STEP_TITLE_MAX_LENGTH = 40;
export const STEP_TEXT_MAX_LENGTH = 160;
export const FOOTER_TAGLINE_MAX_LENGTH = 80;

// Which part of a slide's photo stays in view where the slide crops it (CSS object-position).
export const SLIDE_POSITIONS = [
  { value: "center", label: "Middle" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left side" },
  { value: "right", label: "Right side" },
];

/** A slide's photo, or "" when it has none: the slide then shows the felt. */
export const slidePictureUrl = (slide) => (slide?.image?.path ? eventMediaUrl(slide.image) : "");

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

/** The hall's date (YYYY-MM-DD, Manila) at `ms`, the day announcements go by. */
export const dayInManila = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/** A Messenger link (m.me) or a Facebook page: its name, icon and link label. */
export const facebookLinkKind = (url) =>
  /^https:\/\/m\.me\//i.test(String(url || ""))
    ? { name: "Messenger", icon: "bi-messenger", label: "Message us on Messenger" }
    : { name: "Facebook", icon: "bi-facebook", label: "Break and Chill on Facebook" };

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
