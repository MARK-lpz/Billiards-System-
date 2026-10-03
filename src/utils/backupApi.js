const BACKUP_API_URL = import.meta.env.VITE_BACKUP_API_URL || (
  !import.meta.env.DEV && window.location.hostname.endsWith("breakandchill.com")
    ? "https://app.breakandchill.com/api/backup.php"
    : "/api/backup.php"
);

const post = async (payload) => {
  const response = await fetch(BACKUP_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || "The server could not complete the backup request.");
  }

  return data;
};

export const exportServerBackup = async ({ username, password }) =>
  (await post({ action: "export", username, password })).server;

export const restoreServerBackup = async ({ username, password, server }) =>
  post({ action: "restore", username, password, server });
