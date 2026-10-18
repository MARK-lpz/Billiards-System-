/**
 * Products about to expire, as the admin's bell lists them: from 5 days before
 * the expiry date, again from 3 days before (more urgent), and once it has
 * passed. Only products with stock left: an empty shelf has nothing to expire.
 */

export const SEEN_EXPIRY_KEY = "seenExpiryAlerts";
export const EXPIRY_ALERT_DAYS = 5;
export const EXPIRY_URGENT_DAYS = 3;

/** Whole days from `today` to `date` (both YYYY-MM-DD): 0 today, -1 yesterday. */
export const daysUntil = (date, today) =>
  Math.round((new Date(`${date}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);

/** "soon" (4-5 days), "urgent" (3 days to today) or "expired"; null when not yet. */
export const expiryStageOf = (product, today) => {
  const expiry = String(product?.expiryDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return null;
  const days = daysUntil(expiry, today);
  if (Number.isNaN(days) || days > EXPIRY_ALERT_DAYS) return null;
  if (days < 0) return "expired";
  return days <= EXPIRY_URGENT_DAYS ? "urgent" : "soon";
};

/** The short label for how long is left: "Expired", "Today", "1 day left", "5 days left". */
export const describeDaysLeft = (days) =>
  days < 0 ? "Expired" : days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} left`;

// One alert per product, stage and date, so reaching 3 days counts as new, and so
// does a restocked product nearing its new date.
export const expiryAlertKey = (alert) => `${alert.product.id}:${alert.stage}:${alert.product.expiryDate}`;

/** Expired first, then the fewest days left, then by name. */
export const getExpiryAlerts = (products = [], today) =>
  products
    .filter((product) => (Number(product.stock) || 0) > 0)
    .map((product) => ({ product, stage: expiryStageOf(product, today) }))
    .filter((alert) => alert.stage)
    .map((alert) => ({ ...alert, days: daysUntil(alert.product.expiryDate, today) }))
    .sort((first, second) => first.days - second.days || String(first.product.name).localeCompare(String(second.product.name)));
