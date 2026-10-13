/**
 * Products at or under their minimum stock, as the admin's bell lists them.
 * Same rule as the Inventory page: at or under Min Stock is low, none left is out.
 */

export const SEEN_LOW_STOCK_KEY = "seenLowStockAlerts";

export const stockStateOf = (product) => {
  const stock = Number(product?.stock) || 0;
  const minStock = Number(product?.minStock) || 0;
  if (stock <= 0) return "out";
  if (stock <= minStock) return "low";
  return null;
};

// One alert per product and state, so running out after being low counts as new.
export const lowStockKey = (alert) => `${alert.product.id}:${alert.state}`;

/** Out of stock first, then the lowest against its minimum, then by name. */
export const getLowStock = (products = []) =>
  products
    .map((product) => ({ product, state: stockStateOf(product) }))
    .filter((alert) => alert.state)
    .sort((first, second) => {
      if (first.state !== second.state) return first.state === "out" ? -1 : 1;
      const share = (alert) => (Number(alert.product.stock) || 0) / Math.max(Number(alert.product.minStock) || 0, 1);
      return share(first) - share(second) || String(first.product.name).localeCompare(String(second.product.name));
    });
