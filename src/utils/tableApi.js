const TABLE_API_URL = import.meta.env.VITE_TABLE_API_URL || (
  !import.meta.env.DEV && window.location.hostname === "breakandchill.com"
    ? "https://app.breakandchill.com/api/tables.php"
    : "/api/tables.php"
);

export const fetchRemoteTables = async () => {
  const response = await fetch(TABLE_API_URL);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load table status.");
  }

  return Array.isArray(data.tables) ? data.tables : [];
};

export const saveRemoteTables = async (tables) => {
  const response = await fetch(TABLE_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tables }),
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to save table status.");
  }
};
