/**
 * What is on sale and what is not.
 *
 * The Archive keeps the hall's previous goods. A product the admin archives
 * keeps its record but leaves the Inventory list, the Sales / POS and the
 * table orders; it can be restored. Expired pieces taken off the shelf are
 * kept there too, as records on their product (`writeOffs`), with what they
 * cost.
 *
 * A product past its expiry date stays listed but is not sold: the POS and the
 * table orders refuse it until it is restocked with new stock, and a restock
 * takes the expired pieces off the shelf first.
 */
import { getExpiryAlerts } from "./expiryAlerts";
import { formatExpiryDate } from "./inventoryValidation";
import { getLowStock } from "./lowStock";

// A product added this many days ago or less is new to the front desk.
export const NEW_PRODUCT_DAYS = 7;
// The most expired-stock records kept on one product, newest first.
const MAX_WRITE_OFFS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// Products are added with Date.now() as their id; older sample ones have 1, 2, 3.
const TIMESTAMP_ID_FROM = Date.UTC(2020, 0, 1);
const TIMESTAMP_ID_UNTIL = Date.UTC(2200, 0, 1);

export const ARCHIVE_REASONS = {
  discontinued: "No longer sold",
  expiring: "Pulled before expiry",
  expired: "Expired",
};

const stockOf = (product) => Math.max(0, Number(product?.stock) || 0);
const hasDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
const byName = (first, second) => String(first.name || "").localeCompare(String(second.name || ""));

export const isArchived = (product) => Boolean(product?.archivedAt);

/** The products still in the Inventory: everything but the Archive. */
export const getShelfProducts = (products = []) => products.filter((product) => !isArchived(product));

/** The archived products, the latest archived first. */
export const getArchivedProducts = (products = []) =>
  products.filter(isArchived).sort((first, second) => String(second.archivedAt).localeCompare(String(first.archivedAt)));

/** Past its expiry date (from the day after it), so no longer sold. `today`: YYYY-MM-DD. */
export const isExpired = (product, today) => hasDate(product?.expiryDate) && product.expiryDate < today;

/** Why it cannot be sold now, or "" when it can (stock aside). */
export const getNotForSaleReason = (product, today) => {
  if (isArchived(product)) return `${product.name} is in the Archive and is no longer sold.`;
  if (isExpired(product, today)) {
    return `${product.name} expired on ${formatExpiryDate(product.expiryDate)}. Expired stock cannot be sold.`;
  }
  return "";
};

/** When it was added (ms), or null for a product from before that was kept. */
export const addedAtOf = (product) => {
  const added = Date.parse(product?.addedAt || "");
  if (Number.isFinite(added)) return added;
  const id = Number(product?.id);
  return Number.isFinite(id) && id >= TIMESTAMP_ID_FROM && id < TIMESTAMP_ID_UNTIL ? id : null;
};

/** Added within the last NEW_PRODUCT_DAYS days, newest first. `now`: ms. */
export const getNewProducts = (products = [], now) =>
  getShelfProducts(products)
    .map((product) => ({ product, addedAt: addedAtOf(product) }))
    .filter(({ addedAt }) => addedAt !== null && addedAt <= now + 60000 && now - addedAt < NEW_PRODUCT_DAYS * DAY_MS)
    .sort((first, second) => second.addedAt - first.addedAt);

/** Expired products with pieces still on the shelf, the oldest date first. */
export const getExpiredOnShelf = (products = [], today) =>
  getShelfProducts(products)
    .filter((product) => isExpired(product, today) && stockOf(product) > 0)
    .sort((first, second) => first.expiryDate.localeCompare(second.expiryDate) || byName(first, second));

/**
 * What the front desk keeps an eye on, from the products still in the Inventory,
 * each entry { product, ... }: `fresh` (new, with addedAt), `low` (getLowStock:
 * out first, with state), `soon` (expiring within 5 days, getExpiryAlerts) and
 * `expired` (still on the shelf). An expired product is only under `expired`.
 */
export const getStockAlarm = (products = [], today, now) => {
  const shelf = getShelfProducts(products);
  const expired = getExpiredOnShelf(shelf, today);
  const expiredIds = new Set(expired.map((product) => product.id));
  return {
    fresh: getNewProducts(shelf, now),
    low: getLowStock(shelf.filter((product) => !expiredIds.has(product.id))),
    soon: getExpiryAlerts(shelf, today).filter((alert) => alert.stage !== "expired"),
    expired: expired.map((product) => ({ product })),
  };
};

// One key per alarm (`kind`: a key of getStockAlarm), so a product running out
// after being low, or nearing a new date after a restock, counts as new again.
export const stockAlarmKey = (kind, { product, state }) => {
  if (kind === "fresh") return `new:${product.id}`;
  if (kind === "low") return `low:${product.id}:${state}`;
  return `${kind}:${product.id}:${product.expiryDate}`;
};

/**
 * The stock alarm's most pressing line, { tone, icon, text }: expired stock on
 * the shelf, then out of stock, then low, then new products not seen yet
 * (`freshUnseen`), or that all is well. Over the Stock Alarm page's cards.
 */
export const getStockHeadline = (alarm, freshUnseen = 0) => {
  const plural = (count, one) => `${count} ${one}${count === 1 ? "" : "s"}`;
  const outCount = alarm.low.filter((entry) => entry.state === "out").length;
  if (alarm.expired.length) {
    return {
      tone: "danger",
      icon: "bi-exclamation-octagon-fill",
      text: `${plural(alarm.expired.length, "expired product")} still on the shelf. Do not sell ${alarm.expired.length === 1 ? "it" : "them"}.`,
    };
  }
  if (outCount) return { tone: "danger", icon: "bi-x-octagon-fill", text: `${plural(outCount, "product")} out of stock.` };
  if (alarm.low.length) return { tone: "warning", icon: "bi-exclamation-triangle-fill", text: `${plural(alarm.low.length, "product")} running low.` };
  if (freshUnseen) return { tone: "info", icon: "bi-stars", text: `${plural(freshUnseen, "new product")} added.` };
  return { tone: "ok", icon: "bi-check-circle-fill", text: "All good: nothing expired or running low." };
};

/** What the front desk tells the admin about one alarm, for the admin's bell. */
export const describeStockReport = (kind, { product, state, days }) => {
  const label = `${product.name}${product.productNumber ? ` (#${product.productNumber})` : ""}`;
  const pieces = `${stockOf(product)} ${product.unit || "pcs"}`;
  if (kind === "expired") return `Front desk: ${label} expired on ${formatExpiryDate(product.expiryDate)}. ${pieces} set aside, not sold.`;
  if (kind === "soon") {
    return `Front desk: ${label} expires on ${formatExpiryDate(product.expiryDate)} (${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}). ${pieces} left to sell.`;
  }
  if (state === "out") return `Front desk: ${label} is out of stock. Please restock.`;
  return `Front desk: ${label} is running low: ${pieces} left (alert at ${Number(product.minStock) || 0}). Please restock.`;
};

/**
 * Where one product on sale stands, for the front desk's stock list: "expired"
 * (pieces past their date), "out", "low", "soon" (expiring within 5 days) or
 * "ok". `today`: YYYY-MM-DD.
 */
export const shelfStateOf = (product, today) => {
  const stock = stockOf(product);
  if (stock > 0 && isExpired(product, today)) return "expired";
  if (stock <= 0) return "out";
  if (stock <= (Number(product.minStock) || 0)) return "low";
  if (getExpiryAlerts([product], today).length) return "soon";
  return "ok";
};

/**
 * Takes a product's expired pieces off the shelf, kept in the Archive as a
 * record: its stock goes to 0. `at`: ms; `by`: who did it.
 */
export const removeExpiredStock = (product, { at, by, note = "" }) => {
  const qty = stockOf(product);
  if (!qty) return product;
  const record = {
    id: `wo-${at}-${product.id}`,
    at: new Date(at).toISOString(),
    qty,
    expiryDate: product.expiryDate || "",
    unitCost: Number(product.originalPrice) || 0,
    unitPrice: Number(product.price) || 0,
    by,
    ...(note ? { note } : {}),
  };
  const kept = Array.isArray(product.writeOffs) ? product.writeOffs : [];
  return { ...product, stock: 0, writeOffs: [record, ...kept].slice(0, MAX_WRITE_OFFS) };
};

/** Moves a product to the Archive. `reason`: a key of ARCHIVE_REASONS. */
export const archiveProduct = (product, { at, by, reason }) => ({
  ...product,
  archivedAt: new Date(at).toISOString(),
  archivedBy: by,
  archiveReason: reason,
});

/** Brings an archived product back to the Inventory, as it was. */
export const restoreProduct = (product, { at, by }) => {
  const restored = { ...product, restoredAt: new Date(at).toISOString(), restoredBy: by };
  delete restored.archivedAt;
  delete restored.archivedBy;
  delete restored.archiveReason;
  return restored;
};

/** Every expired-stock record, the latest first, each with its product. */
export const getWriteOffs = (products = []) =>
  products
    .flatMap((product) => (Array.isArray(product.writeOffs) ? product.writeOffs : []).map((record) => ({ ...record, product })))
    .sort((first, second) => String(second.at).localeCompare(String(first.at)));

/** What a record's pieces cost the hall, or null when the original price was never kept. */
export const writeOffCost = (record) => {
  const unitCost = Number(record?.unitCost) || 0;
  return unitCost > 0 ? (Number(record.qty) || 0) * unitCost : null;
};
