// Checks for the inventory forms, so a typo never reaches the stock list or the
// Sales / POS: a blank or repeated name, a negative or fractional count, a price
// of zero, an expiry date already past, too close to sell or in the wrong
// century, more stock than the hall keeps of one product.

import { EXPIRY_ALERT_DAYS, daysUntil } from "./expiryAlerts";

export const MAX_PRICE = 100000;
// The most pieces of one product in stock (products.php refuses more too).
export const MAX_STOCK = 1000;
export const MAX_RESTOCK = MAX_STOCK;
const MAX_NAME_LENGTH = 60;
// A date typed as 20266 instead of 2026 is far past any real shelf life.
const MAX_EXPIRY_YEARS_AHEAD = 10;
// New stock needs this many days left at least: stock that expires today or
// tomorrow would be off the shelf before it sells.
export const MIN_EXPIRY_DAYS = 2;

const peso = (amount) => `₱${amount.toLocaleString("en-PH")}`;
const pieces = (count) => `${count.toLocaleString("en-PH")} pcs`;

const hasAtMostTwoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

// One message per count field (stock, min stock): whole pieces, never below zero.
const getCountError = (value, label) => {
  const count = Number(value);
  if (!Number.isFinite(count)) return `Enter the ${label} as a number.`;
  if (count < 0) return `${label[0].toUpperCase()}${label.slice(1)} cannot be negative.`;
  if (!Number.isInteger(count)) return `${label[0].toUpperCase()}${label.slice(1)} is counted in whole pieces.`;
  if (count > MAX_STOCK) return `${label[0].toUpperCase()}${label.slice(1)} can be at most ${pieces(MAX_STOCK)}.`;
  return "";
};

/** "Oct 15, 2026", for the expiry date in messages and locked fields. */
export const formatExpiryDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

/** The earliest expiry date new stock may have (YYYY-MM-DD), for the date pickers' `min`. */
export const getEarliestExpiry = (today) => {
  const [year, month, day] = String(today).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + MIN_EXPIRY_DAYS)).toISOString().slice(0, 10);
};

/**
 * What is wrong with the expiry date of stock being added, or "" (a blank date
 * is fine): not a date, years off, already past, or too close to sell (today or
 * tomorrow, under MIN_EXPIRY_DAYS).
 */
export const getExpiryError = (value, today) => {
  const expiry = String(value || "");
  if (!expiry) return "";
  const date = new Date(`${expiry}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || Number.isNaN(date.getTime())) return "Enter a valid expiry date.";
  if (date.getFullYear() > new Date(`${today}T00:00:00`).getFullYear() + MAX_EXPIRY_YEARS_AHEAD) {
    return "Check the year: that is more than 10 years from now.";
  }
  const days = daysUntil(expiry, today);
  const when = formatExpiryDate(expiry);
  if (days < 0) {
    const ago = days === -1 ? "yesterday" : `${-days} days ago`;
    return `This expired ${ago} (${when}). Expired stock cannot be added.`;
  }
  if (days < MIN_EXPIRY_DAYS) {
    return `This expires ${days === 0 ? "today" : "tomorrow"} (${when}), too soon to sell. Pick ${formatExpiryDate(getEarliestExpiry(today))} or later.`;
  }
  return "";
};

/**
 * A date that can be saved but is close: within EXPIRY_ALERT_DAYS, so the
 * stock shows as expiring soon on the Stock Alarm right away. "" otherwise.
 */
export const getExpiryWarning = (value, today) => {
  const expiry = String(value || "");
  if (!expiry || getExpiryError(expiry, today)) return "";
  const days = daysUntil(expiry, today);
  return days <= EXPIRY_ALERT_DAYS
    ? `Expires in ${days} days (${formatExpiryDate(expiry)}). It shows as expiring soon on the Stock Alarm right away: sell it first.`
    : "";
};

/** Why a price cannot be saved, or "" when it can. `name`: "original price" or "retail price". */
const getPriceError = (value, name) => {
  // A product added before original prices were kept has none yet: asked for, like an empty box.
  const price = Number(value ?? 0);
  if (!Number.isFinite(price)) return `Enter the ${name} as a number.`;
  if (price <= 0) return `Enter the ${name} (above ₱0).`;
  if (price > MAX_PRICE) return `The ${name} can be at most ${peso(MAX_PRICE)}.`;
  if (!hasAtMostTwoDecimals(price)) return "Use at most 2 decimal places (centavos).";
  return "";
};

/**
 * What is wrong with the Add / Edit Product form, field by field: { name,
 * originalPrice, price, stock, minStock, expiryDate }. `originalPrice` is what the
 * hall paid for one piece; `price` is the retail price it is sold at. An empty
 * object means it can be saved. Editing only changes the two prices, so only
 * those are checked then.
 */
export const getProductErrors = ({ form, products = [], editId = null, today }) => {
  const errors = {};
  const editing = editId !== null;

  const name = String(form.name || "").trim();
  if (editing) {
    // Name, category, stock, min stock and expiry date are not edited here.
  } else if (!name) {
    errors.name = "Enter the product name.";
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Keep the name to ${MAX_NAME_LENGTH} characters or fewer.`;
  } else {
    const duplicate = products.find(
      (product) => product.id !== editId && String(product.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      const label = `${duplicate.name}${duplicate.productNumber ? ` (#${duplicate.productNumber})` : ""}`;
      errors.name = duplicate.archivedAt
        ? `${label} is in the Archive. Restore it from there instead of adding it again.`
        : `${label} is already in the inventory. Restock it instead of adding it again.`;
    }
  }

  const originalPriceError = getPriceError(form.originalPrice, "original price");
  if (originalPriceError) errors.originalPrice = originalPriceError;
  const priceError = getPriceError(form.price, "retail price");
  if (priceError) errors.price = priceError;

  if (!editing) {
    const stockError = getCountError(form.stock, "stock");
    if (stockError) errors.stock = stockError;
    const minStockError = getCountError(form.minStock, "min stock");
    if (minStockError) errors.minStock = minStockError;
    const expiryError = getExpiryError(form.expiryDate, today);
    if (expiryError) errors.expiryDate = expiryError;
  }

  return errors;
};

/** Why a restock amount cannot be added, or "" when it can. */
export const getRestockError = (amount, currentStock = 0) => {
  if (amount === "" || amount === null || amount === undefined) return "Enter how many pieces to add.";
  const count = Number(amount);
  if (!Number.isFinite(count)) return "Enter the amount as a number.";
  if (count <= 0) return "Enter at least 1 piece.";
  if (!Number.isInteger(count)) return "Restock in whole pieces.";
  if ((Number(currentStock) || 0) >= MAX_STOCK) return `Stock is already at the ${pieces(MAX_STOCK)} maximum.`;
  if (count > MAX_RESTOCK) return `Add at most ${pieces(MAX_RESTOCK)} at a time.`;
  if ((Number(currentStock) || 0) + count > MAX_STOCK) {
    return `That brings the stock over ${pieces(MAX_STOCK)}. The most you can add is ${pieces(Math.max(0, MAX_STOCK - (Number(currentStock) || 0)))}.`;
  }
  return "";
};
