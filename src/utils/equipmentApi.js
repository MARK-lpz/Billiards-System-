import { apiFetch, refusalError } from "./apiFetch";

const EQUIPMENT_API_URL = import.meta.env.VITE_EQUIPMENT_API_URL || (
  !import.meta.env.DEV && window.location.hostname === "breakandchill.com"
    ? "https://app.breakandchill.com/api/equipment.php"
    : "/api/equipment.php"
);

// The shared list and each item's version (see useServerList.js).
export const fetchRemoteEquipment = async () => {
  const response = await apiFetch(EQUIPMENT_API_URL);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw refusalError(response, data, "Unable to load equipment.");
  }

  return {
    items: Array.isArray(data.equipment) ? data.equipment : [],
    versions: data.versions && typeof data.versions === "object" ? data.versions : {},
  };
};

// Only the items changed here: { upsert, remove, confirmRemoval }.
export const saveRemoteEquipmentChanges = async (changes) => {
  const response = await apiFetch(EQUIPMENT_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw refusalError(response, data, "Unable to save equipment.");
  }
  return { versions: data.versions || {} };
};

// The Removed list: items deleted (with why) or replaced, newest first.
export const fetchEquipmentHistory = async () => {
  const response = await apiFetch(`${EQUIPMENT_API_URL}?history=1`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load the removed equipment.");
  }

  return {
    history: Array.isArray(data.history) ? data.history : [],
    retentionMonths: Number(data.retentionMonths) || 3,
  };
};

export const saveEquipmentHistory = async (history) => {
  const response = await apiFetch(EQUIPMENT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to save the removed equipment.");
  }
};
