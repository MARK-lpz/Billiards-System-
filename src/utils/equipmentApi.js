const EQUIPMENT_API_URL = import.meta.env.VITE_EQUIPMENT_API_URL || (
  !import.meta.env.DEV && window.location.hostname === "breakandchill.com"
    ? "https://app.breakandchill.com/api/equipment.php"
    : "/api/equipment.php"
);

// The shared list, and the ids of items deleted from it (so an old copy kept on
// a device cannot bring them back).
export const fetchRemoteEquipment = async () => {
  const response = await fetch(EQUIPMENT_API_URL);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load equipment.");
  }

  return {
    equipment: Array.isArray(data.equipment) ? data.equipment : [],
    removedIds: Array.isArray(data.removedIds) ? data.removedIds.map(String) : [],
  };
};

export const saveRemoteEquipment = async (equipment, removedIds = []) => {
  const response = await fetch(EQUIPMENT_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ equipment, removedIds }),
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to save equipment.");
  }
};

// The Removed list: items deleted (with why) or replaced, newest first.
export const fetchEquipmentHistory = async () => {
  const response = await fetch(`${EQUIPMENT_API_URL}?history=1`);
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
  const response = await fetch(EQUIPMENT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to save the removed equipment.");
  }
};
