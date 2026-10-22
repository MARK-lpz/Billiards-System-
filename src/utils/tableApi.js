import { apiFetch, refusalError } from "./apiFetch";
import { SITE_HOST, APP_API_BASE } from "./siteAddress";

const TABLE_API_URL = import.meta.env.VITE_TABLE_API_URL || (
  !import.meta.env.DEV && window.location.hostname === SITE_HOST
    ? `${APP_API_BASE}tables.php`
    : "/api/tables.php"
);

// The tables and each one's version (see useServerList.js).
export const fetchRemoteTables = async () => {
  const response = await apiFetch(TABLE_API_URL);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw refusalError(response, data, "Unable to load table status.");
  }

  return {
    items: Array.isArray(data.tables) ? data.tables : [],
    versions: data.versions && typeof data.versions === "object" ? data.versions : {},
  };
};

// Only the tables changed here: { upsert, remove, confirmRemoval }.
export const saveRemoteTableChanges = async (changes) => {
  const response = await apiFetch(TABLE_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw refusalError(response, data, "Unable to save table status.");
  }
  return { versions: data.versions || {} };
};
