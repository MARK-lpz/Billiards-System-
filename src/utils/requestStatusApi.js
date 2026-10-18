import { apiFetch } from "./apiFetch";

const REQUEST_STATUS_API_URL = import.meta.env.VITE_REQUEST_STATUS_API_URL || (
  !import.meta.env.DEV && window.location.hostname === "breakandchill.com"
    ? "https://app.breakandchill.com/api/request_status.php"
    : "/api/request_status.php"
);

/**
 * Where the customer's own requests stand, by the keys this browser kept:
 * [{ key, found, kind, ... }] (see api/request_status.php). Sent as POST so
 * the keys stay out of the server's access log.
 */
export const fetchRequestStatuses = async (keys) => {
  const response = await apiFetch(REQUEST_STATUS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "Unable to check your requests.");
  return Array.isArray(data.requests) ? data.requests : [];
};
