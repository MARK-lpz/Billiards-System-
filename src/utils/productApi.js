import { apiFetch, refusalError } from "./apiFetch";

const PRODUCT_API_URL = import.meta.env.VITE_PRODUCT_API_URL || "/api/products.php";

// The inventory and each product's version (see useServerList.js). Staff only:
// the staff app is on the same address as the API.
export const fetchRemoteProducts = async () => {
  const response = await apiFetch(PRODUCT_API_URL);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw refusalError(response, data, "Unable to load the inventory.");
  }

  return {
    items: Array.isArray(data.products) ? data.products : [],
    versions: data.versions && typeof data.versions === "object" ? data.versions : {},
    // No product was ever saved on the server (a new system).
    fresh: data.fresh === true,
  };
};

// Only the products changed here: { upsert, remove, confirmRemoval }.
export const saveRemoteProductChanges = async (changes) => {
  const response = await apiFetch(PRODUCT_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw refusalError(response, data, "Unable to save the inventory.");
  }
  return { versions: data.versions || {} };
};
