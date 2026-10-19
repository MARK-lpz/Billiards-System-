import { apiFetch, refusalError } from "./apiFetch";

/**
 * The lists that keep growing, read in steps (see useServerLedger.js and
 * backend/config/ledger.php): sales, table bills and the audit log. Staff
 * only: the staff app is on the same address as the API.
 */
const ledgerApi = (url, label) => ({
  // What changed after `after`: { items, versions, cursor, more, epoch }.
  // `start` is this screen's first read.
  fetchChanges: async ({ after = 0, start = false } = {}) => {
    const response = await apiFetch(`${url}?after=${encodeURIComponent(after)}${start ? "&start=1" : ""}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw refusalError(response, data, `Unable to load ${label}.`);
    }
    return {
      items: Array.isArray(data.items) ? data.items : [],
      versions: data.versions && typeof data.versions === "object" ? data.versions : {},
      cursor: Number(data.cursor) || 0,
      more: Boolean(data.more),
      epoch: String(data.epoch || ""),
    };
  },

  // Only what was made or changed here: { upsert: [{ item, version }] }.
  // Returns { versions, conflicts: [{ id, item, version }], rejected: [{ id, message }] }.
  saveChanges: async (changes) => {
    const response = await apiFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw refusalError(response, data, `Unable to save ${label}.`);
    }
    return {
      versions: data.versions && typeof data.versions === "object" ? data.versions : {},
      conflicts: Array.isArray(data.conflicts) ? data.conflicts : [],
      rejected: Array.isArray(data.rejected) ? data.rejected : [],
    };
  },
});

export const salesLedger = ledgerApi(import.meta.env.VITE_SALES_API_URL || "/api/sales.php", "the sales");
export const tableChargeLedger = ledgerApi(import.meta.env.VITE_TABLE_CHARGES_API_URL || "/api/table_charges.php", "the table bills");
export const auditLedger = ledgerApi(import.meta.env.VITE_AUDIT_API_URL || "/api/audit_log.php", "the audit log");
