/**
 * The backup file brings together the two places this system keeps data:
 *
 *  - server: shared tables in MySQL (reservations, tournaments, issues...)
 *  - browser: records that only ever live in this computer's browser storage
 *    (inventory, sales, equipment, customers, audit log). These are the ones
 *    lost when a browser is cleared, so a backup without them is not a backup.
 *
 * Kept free of React and fetch so it can be checked on its own.
 */
export const BACKUP_FORMAT = "break-and-chill-backup";
export const BACKUP_VERSION = 1;

// Business records only. Sessions, the saved theme, notifications, POS carts
// and anything account or password related are deliberately left out.
export const BROWSER_SECTIONS = [
  { key: "products", label: "Inventory products" },
  { key: "transactions", label: "Sales transactions" },
  { key: "equipment", label: "Equipment" },
  { key: "customers", label: "Customers" },
  { key: "activityLogs", label: "Audit log entries" },
  { key: "poolTables", label: "Pool tables (this device)" },
  { key: "reservations", label: "Reservations (this device)" },
  { key: "events", label: "Tournaments (this device)" },
];

export const SERVER_SECTIONS = [
  { key: "reservations", label: "Reservations" },
  { key: "tournament_events", label: "Tournaments" },
  { key: "pool_table_status", label: "Pool table status" },
  { key: "reservation_settings", label: "Reservation settings" },
  { key: "employee_issues", label: "Reported issues" },
  { key: "notifications", label: "Notifications" },
  { key: "customer_messages", label: "Customer messages" },
];

const countOf = (value) => {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value === null || value === undefined ? 0 : 1;
};

export const collectBrowserData = (storage) => {
  const browser = {};

  BROWSER_SECTIONS.forEach(({ key }) => {
    const raw = storage.getItem(key);
    if (raw === null) return;

    try {
      browser[key] = JSON.parse(raw);
    } catch {
      // A value that is not valid JSON is kept as-is rather than dropped.
      browser[key] = raw;
    }
  });

  return browser;
};

export const buildBackupFile = ({ server, browser, createdBy, now = new Date() }) => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  createdAt: now.toISOString(),
  createdBy: createdBy || "",
  server,
  browser,
});

export const backupFileName = (now = new Date(), label = "") => {
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `break-and-chill-backup${label ? `-${label}` : ""}_${stamp}.json`;
};

/**
 * Reads an uploaded file and refuses anything that is not one of our backups
 * before a single record is overwritten. Returns a summary for the admin to
 * check what they are about to restore.
 */
export const parseBackupFile = (text) => {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not a backup. It could not be read as a backup file." };
  }

  if (!data || typeof data !== "object" || data.format !== BACKUP_FORMAT) {
    return { ok: false, error: "This is not a Break & Chill backup file." };
  }

  if (Number(data.version) > BACKUP_VERSION) {
    return { ok: false, error: "This backup was made by a newer version of the system and cannot be restored here." };
  }

  const serverTables = data.server?.tables;
  if (!serverTables || typeof serverTables !== "object") {
    return { ok: false, error: "The server part of this backup is missing or damaged." };
  }

  const browser = data.browser && typeof data.browser === "object" ? data.browser : {};

  return {
    ok: true,
    backup: data,
    summary: {
      createdAt: data.createdAt || "",
      createdBy: data.createdBy || "",
      server: SERVER_SECTIONS.map(({ key, label }) => ({
        key,
        label,
        count: countOf(serverTables[key]),
        present: key in serverTables,
      })),
      browser: BROWSER_SECTIONS.map(({ key, label }) => ({
        key,
        label,
        count: countOf(browser[key]),
        present: key in browser,
      })),
    },
  };
};

/**
 * Writes the browser part back. Sections missing from the backup are left
 * alone, so an older backup never wipes data it never knew about.
 */
export const applyBrowserData = (storage, browser = {}) => {
  const restored = [];

  BROWSER_SECTIONS.forEach(({ key }) => {
    if (!(key in browser)) return;
    const value = browser[key];
    storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    restored.push(key);
  });

  return restored;
};
