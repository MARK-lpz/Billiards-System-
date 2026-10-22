/**
 * The addresses on the hosting: the customer site, and the staff app with the
 * API beside it (app. in front). To move to another domain, change SITE_HOST
 * here and the two origins in backend/config/cors.php.
 *
 * On this computer (npm run dev) the staff app opens as
 * app.breakandchill.com:5173 instead: a name for development only, which the
 * hosts file sends to 127.0.0.1.
 */
export const SITE_HOST = "breakandchill.online";
export const APP_HOST = `app.${SITE_HOST}`;
const DEV_APP_HOST = "app.breakandchill.com";

/** Where the customer site reaches the API on the hosting. */
export const APP_API_BASE = `https://${APP_HOST}/api/`;

/** True when this page is the staff app, on the hosting or in development. */
export const isStaffHost = (hostname) =>
  hostname === APP_HOST || (import.meta.env.DEV && hostname === DEV_APP_HOST);
