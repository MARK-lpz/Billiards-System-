/**
 * Open bills in Sales / POS. Each table (or walk-in customer) keeps its own
 * running bill and is paid on its own receipt, so staff can take orders for
 * several tables at once and come back to any of them later.
 */

export const MAX_BILL_NAME = 40;

const sameText = (first, second) =>
  String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();

const sameTable = (first, second) => first !== null && first !== undefined && String(first) === String(second);

/** "Table 1 · Juan", "Walk-in · Maria", or the next free "Walk-in 2". */
export const buildBillLabel = ({ tableName = "", customer = "", bills = [], excludeId = null }) => {
  const name = customer.trim();
  if (tableName) return name ? `${tableName} · ${name}` : tableName;
  if (name) return `Walk-in · ${name}`;

  const taken = new Set(bills.filter((bill) => bill.id !== excludeId).map((bill) => bill.label));
  let number = 1;
  while (taken.has(`Walk-in ${number}`)) number += 1;
  return `Walk-in ${number}`;
};

/** A new, empty bill. `table` is a pool table (or just its id and name) or null for a walk-in. */
export const createBill = ({ id, table = null, customer = "", bills = [], openedAt = "" }) => {
  const tableName = table ? table.name || `Table ${table.id}` : "";
  return {
    id,
    tableId: table ? table.id : null,
    tableName,
    customer: customer.trim(),
    label: buildBillLabel({ tableName, customer, bills }),
    cart: [],
    openedAt,
  };
};

export const findTableBill = (bills, tableId, excludeId = null) =>
  bills.find((bill) => bill.id !== excludeId && sameTable(bill.tableId, tableId)) || null;

export const findChargeBill = (bills, chargeId) =>
  bills.find((bill) => bill.cart.some((item) => item.chargeId === chargeId)) || null;

/** Errors for the Open / Edit Bill form, keyed by field (as useFormErrors expects). */
export const getBillErrors = ({ form, tables = [], bills = [], editId = null }) => {
  const errors = {};
  const customer = form.customer.trim();
  const table = form.tableId === "" ? null : tables.find((entry) => String(entry.id) === String(form.tableId));
  // A bill already on a table keeps it, even if that table has since gone into maintenance.
  const keepsTable = sameTable(bills.find((bill) => bill.id === editId)?.tableId, form.tableId);

  if (form.tableId !== "" && !keepsTable) {
    const openBill = findTableBill(bills, form.tableId, editId);
    if (!table) errors.tableId = "Choose a table from the list.";
    else if (openBill) errors.tableId = `${table.name} already has an open bill (${openBill.label}). Pick it from Open Bills instead.`;
    else if (table.status === "maintenance") errors.tableId = `${table.name} is under maintenance.`;
  }

  if (customer.length > MAX_BILL_NAME) {
    errors.customer = `Keep the name to ${MAX_BILL_NAME} characters or fewer.`;
  } else if (customer && !/^[\p{L}\p{N}][\p{L}\p{N} .,'&()#-]*$/u.test(customer)) {
    errors.customer = "Use letters, numbers, spaces and . , ' - & # ( ) only.";
  } else if (!table && customer) {
    const label = buildBillLabel({ customer });
    const duplicate = bills.find((bill) => bill.id !== editId && sameText(bill.label, label));
    if (duplicate) errors.customer = `There is already an open bill for ${duplicate.label}. Add a last name or a number.`;
  }

  return errors;
};
