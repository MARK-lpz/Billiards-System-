// Checks for the inventory forms, so a typo never reaches the stock list or the
// Sales / POS: a blank or repeated name, a negative or fractional count, a price
// of zero, an expiry date already past or in the wrong century.

export const MAX_PRICE = 100000;
export const MAX_STOCK = 99999;
export const MAX_RESTOCK = 10000;
const MAX_NAME_LENGTH = 60;
// A date typed as 20266 instead of 2026 is far past any real shelf life.
const MAX_EXPIRY_YEARS_AHEAD = 10;

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

/**
 * What is wrong with the Add / Edit Product form, field by field: { name, price,
 * stock, minStock, expiryDate }. An empty object means it can be saved.
 * `original` is the product being edited, if any: an expiry date it already had
 * is kept even once it has passed, so an expired product can still be edited.
 */
export const getProductErrors = ({ form, products = [], editId = null, original = null, today }) => {
  const errors = {};

  const name = String(form.name || "").trim();
  if (!name) {
    errors.name = "Enter the product name.";
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Keep the name to ${MAX_NAME_LENGTH} characters or fewer.`;
  } else {
    const duplicate = products.find(
      (product) => product.id !== editId && String(product.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      errors.name = `${duplicate.name}${duplicate.productNumber ? ` (#${duplicate.productNumber})` : ""} is already in the inventory. Restock it instead of adding it again.`;
    }
  }

  const price = Number(form.price);
  if (!Number.isFinite(price)) errors.price = "Enter the price as a number.";
  else if (price <= 0) errors.price = "Enter a price above ₱0.";
  else if (price > MAX_PRICE) errors.price = `The price can be at most ${peso(MAX_PRICE)}.`;
  else if (!hasAtMostTwoDecimals(price)) errors.price = "Use at most 2 decimal places (centavos).";

  const stockError = getCountError(form.stock, "stock");
  if (stockError) errors.stock = stockError;
  const minStockError = getCountError(form.minStock, "min stock");
  if (minStockError) errors.minStock = minStockError;

  const expiry = String(form.expiryDate || "");
  if (expiry) {
    const date = new Date(`${expiry}T00:00:00`);
    const keptFromBefore = Boolean(original) && original.expiryDate === expiry;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || Number.isNaN(date.getTime())) {
      errors.expiryDate = "Enter a valid expiry date.";
    } else if (date.getFullYear() > new Date(`${today}T00:00:00`).getFullYear() + MAX_EXPIRY_YEARS_AHEAD) {
      errors.expiryDate = "Check the year: that is more than 10 years from now.";
    } else if (expiry < today && !keptFromBefore) {
      errors.expiryDate = "This date has already passed. An expired product cannot be stocked.";
    }
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
  if (count > MAX_RESTOCK) return `Add at most ${pieces(MAX_RESTOCK)} at a time.`;
  if ((Number(currentStock) || 0) + count > MAX_STOCK) {
    return `That brings the stock over ${pieces(MAX_STOCK)}. The most you can add is ${pieces(Math.max(0, MAX_STOCK - (Number(currentStock) || 0)))}.`;
  }
  return "";
};
