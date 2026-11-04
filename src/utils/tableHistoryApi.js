import { apiFetch } from "./apiFetch";

const TABLE_CHARGES_API_URL = import.meta.env.VITE_TABLE_CHARGES_API_URL || "/api/table_charges.php";

/**
 * The table bills of every session that ended from `from` to `to` ("2026-10-30",
 * Manila days), paid or not: { charges, more }. `more` is true when there were
 * too many to send them all (the oldest are left out).
 */
export const fetchTableHistory = async ({ from, to }) => {
  const query = new URLSearchParams({ history: "1", from, to });
  const response = await apiFetch(`${TABLE_CHARGES_API_URL}?${query}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || "The table history could not be loaded.");
  }
  return { charges: Array.isArray(data.charges) ? data.charges : [], more: Boolean(data.more) };
};
