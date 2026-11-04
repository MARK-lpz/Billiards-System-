import { useEffect, useRef, useState } from "react";
import "../../styles/Admin/Inventory.css";
import InventoryModal from "../../Elements/Admin/InventoryModal.jsx";
import InventoryStats from "../../Elements/Admin/InventoryStats";
import InventoryTable from "../../Elements/Admin/InventoryTable";
import InventoryArchive, { InventoryArchiveStats } from "../../Elements/Admin/InventoryArchive";
import { useNotifications } from "../../Elements/Global/useNotifications";
import ConfirmDialog from "../../Elements/Global/ConfirmDialog";
import { numberFieldValue, numberKeys } from "../../utils/numberField";
import { getNextProductNumber, normalizeProductNumbers } from "../../utils/productNumbers";
import {
  MAX_STOCK,
  formatExpiryDate,
  getEarliestExpiry,
  getExpiryError,
  getExpiryWarning,
  getProductErrors,
  getRestockError,
} from "../../utils/inventoryValidation";
import { searchInventory } from "../../utils/inventorySearch";
import { getTodayDate } from "../../utils/reservations";
import { daysUntil, describeDaysLeft, expiryStageOf, getExpiryAlerts } from "../../utils/expiryAlerts";
import {
  archiveProduct,
  getArchivedProducts,
  getExpiredOnShelf,
  getShelfProducts,
  getWriteOffs,
  isArchived,
  isExpired,
  removeExpiredStock,
  restoreProduct,
  writeOffCost,
} from "../../utils/productShelf";
import { appendAuditLog } from "../../utils/audit";

const STAFF = "Admin";
const pieces = (count) => `${(Number(count) || 0).toLocaleString("en-PH")} pcs`;
const toPeso = (value) => `₱${(Number(value) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const labelOf = (product) => `${product.name}${product.productNumber ? ` (#${product.productNumber})` : ""}`;
// Read only from click handlers, never while rendering.
const getCurrentTimestamp = () => Date.now();

// `focusProductId`: a product opened from the admin's bell, shown marked (under
// Low Stock while it is still low, Expired while its expired stock is on the
// shelf). `focusAction` "remove-expired": that button in the bell was pressed,
// so its check opens straight away ("delete", from an older bell, archives).
export default function Inventory({ products, setProducts, setLogs, focusProductId = null, focusAction = null }) {
  const { addNotification } = useNotifications();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    name: "",
    category: "Food",
    expiryDate: "",
    originalPrice: 0,
    price: 0,
    stock: 0,
    minStock: 10,
    unit: "pcs"
  });
  const [editId, setEditId] = useState(null);
  const today = getTodayDate();
  const focusProduct =
    focusProductId === null ? null : products.find((product) => String(product.id) === String(focusProductId)) || null;
  const focusExpired = Boolean(focusProduct) && isExpired(focusProduct, today) && Number(focusProduct.stock) > 0;
  const [filter, setFilter] = useState(() => {
    if (!focusProduct) return "all";
    if (isArchived(focusProduct)) return "archive";
    if (focusExpired) return "expired";
    return Number(focusProduct.stock) <= Number(focusProduct.minStock) ? "low-stock" : "all";
  });
  // What is typed in the search box (see utils/inventorySearch.js).
  const [search, setSearch] = useState("");
  const searchBox = useRef(null);
  // A step that changes a product's place (archive, restore, delete for good,
  // remove expired stock) only arms this check: { type, product }.
  const [pending, setPending] = useState(() => {
    if (!focusProduct || isArchived(focusProduct)) return null;
    if (focusAction === "remove-expired" && focusExpired) return { type: "remove-expired", product: focusProduct };
    if (focusAction === "delete" || focusAction === "archive") return { type: "archive", product: focusProduct };
    return null;
  });
  // The products ticked on a shelf tab, to archive together (their ids).
  const [selectedIds, setSelectedIds] = useState([]);
  // Adding a product or restocking asks once more before it changes the stock.
  // The form is kept, so "Go back" returns to it with everything still typed in.
  const [saveTarget, setSaveTarget] = useState(null);
  // The table always shows one number per product, even for a list saved before
  // the numbers were fixed (App also repairs the stored list when it loads).
  const numberedProducts = normalizeProductNumbers(products);
  const shelf = getShelfProducts(numberedProducts);
  const archived = getArchivedProducts(numberedProducts);
  const expiredOnShelf = getExpiredOnShelf(shelf, today);
  // Every product past its date, its stock removed or not: the Expired tab.
  const expiredCount = shelf.filter((p) => isExpired(p, today)).length;
  // Stock that expires within 5 days, not yet past it (the Expiring Soon card): its tab.
  const isExpiringSoon = (p) => (Number(p.stock) || 0) > 0 && ["soon", "urgent"].includes(expiryStageOf(p, today));
  const expiringCount = shelf.filter(isExpiringSoon).length;
  // Expiring products' pieces, and what they sell for while they still can.
  const expiringTotals = (list) => ({
    pcs: list.reduce((sum, p) => sum + (Number(p.stock) || 0), 0),
    value: list.reduce((sum, p) => sum + (Number(p.price) || 0) * (Number(p.stock) || 0), 0),
  });
  // Expired products' pieces, and what they cost (the original prices that were kept).
  const expiredTotals = (list) => ({
    pcs: list.reduce((sum, p) => sum + (Number(p.stock) || 0), 0),
    loss: list.reduce((sum, p) => sum + (writeOffCost({ qty: Number(p.stock) || 0, unitCost: p.originalPrice }) || 0), 0),
  });
  const editedProduct = editId ? numberedProducts.find((item) => item.id === editId) || null : null;
  // What is wrong with the open form, if anything; nothing is saved until it is fixed.
  const formErrors = modal === "form" ? getProductErrors({ form, products: numberedProducts, editId, today }) : {};
  // New stock expires no sooner than this; a date only days after it can be
  // saved but is pointed out (getExpiryWarning).
  const earliestExpiry = getEarliestExpiry(today);
  const formExpiryWarning = modal === "form" && !editId ? getExpiryWarning(form.expiryDate, today) : "";
  // The product being restocked, as stored (the form while it loads).
  const restocked = editedProduct || form;
  const heldStock = Number(restocked.stock) || 0;
  // An expired product's pieces come off the shelf with the restock, so the new
  // stock starts from 0 and needs a new expiry date.
  const restockingExpired = modal === "restock" && isExpired(restocked, today);
  const restockBase = restockingExpired ? 0 : heldStock;
  const restockError = modal === "restock" ? getRestockError(form.restockAmount, restockBase) : "";
  // A restock box still at 0 is not an error yet, only not filled in.
  const showRestockError = Boolean(restockError) && Number(form.restockAmount) !== 0;
  // The new stock's expiry date: blank keeps the product's date as it is.
  const restockExpiryError = modal === "restock" ? getExpiryError(form.restockExpiry, today) : "";
  const restockExpiryWarning = modal === "restock" ? getExpiryWarning(form.restockExpiry, today) : "";
  const restockExpiryMissing = restockingExpired && !form.restockExpiry;
  // Stock already on the shelf that expires before the new stock does: the
  // product shows one date, so after the restock that older date is no longer shown.
  const olderStockNote =
    modal !== "restock" || heldStock <= 0
      ? ""
      : restockingExpired
        ? `The ${heldStock} pcs in stock expired on ${formatExpiryDate(restocked.expiryDate)}. They come off the shelf with this restock and are kept in the Archive as expired stock.`
        : restocked.expiryDate && form.restockExpiry && !restockExpiryError && form.restockExpiry > restocked.expiryDate
          ? `The ${heldStock} pcs already in stock expire sooner, on ${formatExpiryDate(restocked.expiryDate)}. Sell those first: after this restock the product shows the new date.`
          : "";

  const log = (action, detail, product, severity = "info") =>
    appendAuditLog(setLogs, {
      type: "inventory",
      staff: STAFF,
      action,
      detail,
      severity,
      entity: "product",
      entityId: String(product.id),
    });

  const save = () => {
    if (Object.keys(formErrors).length) return;
    // Stored clean: a trimmed name and numbers, whatever the inputs held.
    const cleaned = {
      ...form,
      name: form.name.trim(),
      originalPrice: Number(form.originalPrice),
      price: Number(form.price),
      stock: Number(form.stock),
      minStock: Number(form.minStock),
    };
    if (editId) {
      // Only the two prices are taken from the form: everything else stays as
      // stored, so a sale or restock made while the form was open is kept.
      setProducts(prev => prev.map(p => p.id === editId ? { ...p, originalPrice: cleaned.originalPrice, price: cleaned.price } : p));
      addNotification({ message: `${cleaned.name} inventory details updated.` });
      log("Updated product prices", `${labelOf(editedProduct || cleaned)}: bought at ${toPeso(cleaned.originalPrice)}, sold at ${toPeso(cleaned.price)}`, editedProduct || cleaned);
    } else {
      // The number comes from the latest list and is set after the form, so a
      // leftover field can never hand a new product an existing number. When
      // it was added makes it New on the front desk's Stock alarm.
      const now = getCurrentTimestamp();
      const productNumber = getNextProductNumber(normalizeProductNumbers(products));
      setProducts(prev => {
        const numbered = normalizeProductNumbers(prev);
        return [
          ...numbered,
          { ...cleaned, id: now, productNumber: getNextProductNumber(numbered), addedAt: new Date(now).toISOString(), addedBy: STAFF },
        ];
      });
      addNotification({ message: `${cleaned.name} added to inventory.` });
      log("Added product", `${cleaned.name} (#${productNumber}) added with ${pieces(cleaned.stock)} at ${toPeso(cleaned.price)}`, { id: now });
    }
    setModal(null);
    setEditId(null);
  };

  // `expiryDate`: the new stock's, which becomes the product's; blank keeps its
  // date. An expired product's pieces come off the shelf first, kept as a record.
  const restockProduct = (id, amount, expiryDate = "") => {
    const at = getCurrentTimestamp();
    const product = numberedProducts.find((item) => item.id === id);
    const expiredPieces = product && isExpired(product, today) ? Number(product.stock) || 0 : 0;
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const base = isExpired(p, today) ? removeExpiredStock(p, { at, by: STAFF, note: "Replaced by a restock" }) : p;
      return { ...base, stock: (Number(base.stock) || 0) + amount, ...(expiryDate ? { expiryDate } : {}) };
    }));
    const expiry = expiryDate ? ` (expires ${formatExpiryDate(expiryDate)})` : "";
    const removed = expiredPieces ? ` The ${pieces(expiredPieces)} that expired were taken off the shelf.` : "";
    addNotification({ message: `${product?.name || "Product"} restocked by ${amount} pcs${expiry}.${removed}` });
    if (product) log("Restocked product", `${labelOf(product)}: ${amount} pcs added${expiry}.${removed}`, product);
  };

  const openEditModal = (product) => {
    setForm(product);
    setEditId(product.id);
    setModal("form");
  };

  const openAddModal = () => {
    setForm({ name: "", category: "Food", expiryDate: "", originalPrice: 0, price: 0, stock: 0, minStock: 10, unit: "pcs" });
    setEditId(null);
    setModal("form");
  };

  const openRestockModal = (product) => {
    setForm({ ...product, restockAmount: 0, restockExpiry: "" });
    setEditId(product.id);
    setModal("restock");
  };

  const restockBlocked = Boolean(restockError || restockExpiryError || restockExpiryMissing);

  const handleRestock = () => {
    if (!restockBlocked) {
      restockProduct(editId, Number(form.restockAmount), form.restockExpiry || "");
    }
    setModal(null);
    setEditId(null);
  };

  // Editing an existing product saves straight away; a new product is checked first.
  const requestSave = () => {
    if (Object.keys(formErrors).length) return;
    if (editId) {
      save();
      return;
    }
    setSaveTarget({ type: "add", product: form, productNumber: getNextProductNumber(numberedProducts) });
  };

  const requestRestock = () => {
    if (restockBlocked) return;
    setSaveTarget({
      type: "restock",
      product: restocked,
      amount: Number(form.restockAmount),
      expiryDate: form.restockExpiry || "",
    });
  };

  // Takes the target as an argument rather than reading it from the closure:
  // the React Compiler narrows a closed-over `target.type` into a render-time
  // check, which throws while the target is still null.
  const confirmSave = (target) => {
    if (target.type === "add") save();
    else handleRestock();
    setSaveTarget(null);
  };

  const describeSave = (target) => {
    const { product } = target;
    const name = product.name?.trim() || "this unnamed product";
    const stock = Number(product.stock) || 0;

    if (target.type === "restock") {
      const current = product.expiryDate ? formatExpiryDate(product.expiryDate) : "";
      const next = target.expiryDate ? formatExpiryDate(target.expiryDate) : "";
      const expiryLine =
        next && next !== current
          ? ` Expiry date ${current ? `changes from ${current} to` : "becomes"} ${next}.`
          : current
            ? ` Expiry date stays ${current}.`
            : "";
      const expired = isExpired(product, today) && stock > 0;
      const soon = getExpiryWarning(target.expiryDate, today) ? " It shows as expiring soon on the Stock Alarm right away." : "";
      return {
        title: "Restock Product?",
        message: `Add ${target.amount} pcs to ${name}${product.productNumber ? ` (#${product.productNumber})` : ""}?`,
        detail: expired
          ? `The ${stock} expired pcs come off the shelf (kept in the Archive), and stock becomes ${target.amount} pcs.${expiryLine}${soon}`
          : `Stock goes from ${stock} to ${stock + target.amount} pcs.${expiryLine}${soon}`,
        confirmLabel: "Yes, Restock",
        icon: "bi-box-seam",
      };
    }

    const expiry = product.expiryDate ? `expires ${formatExpiryDate(product.expiryDate)}` : "no expiry date";
    const soon = getExpiryWarning(product.expiryDate, today) ? " It also shows as expiring soon there right away." : "";
    return {
      title: "Add Product?",
      message: `Add ${name} to inventory as Product #${target.productNumber}?`,
      detail: `${product.category} · bought at ${toPeso(product.originalPrice)}, sold at ${toPeso(product.price)} per piece · ${stock} pcs in stock (low-stock alert at ${Number(product.minStock) || 0} pcs) · ${expiry}. It shows up in the Sales / POS right away at the retail price, and as New on the front desk's Stock alarm.${soon} Afterwards only its prices can be edited; stock and expiry date change through Restock.`,
      confirmLabel: "Yes, Add Product",
      icon: "bi-plus-circle",
    };
  };

  const saveDialog = saveTarget ? describeSave(saveTarget) : null;

  // ---- Archive, restore, delete for good, remove expired stock.

  const requestRestore = (product) => {
    const clash = shelf.find((item) => String(item.name || "").trim().toLowerCase() === String(product.name || "").trim().toLowerCase());
    if (clash) {
      addNotification({
        tone: "error",
        message: `${labelOf(clash)} is already in the Inventory with the same name, so ${product.name} cannot be restored.`,
      });
      return;
    }
    setPending({ type: "restore", product });
  };

  // Takes the step as an argument for the same React Compiler reason as confirmSave.
  // "archive-expired" (expired ones) and "archive-expiring" (ones expiring soon) carry
  // `products`, archived together, instead of one `product`.
  const confirmPending = ({ type, product, products: chosen }) => {
    const at = getCurrentTimestamp();
    if (type === "archive-expired" || type === "archive-expiring") {
      const ids = new Set(chosen.map((item) => item.id));
      setProducts(prev => prev.map(p => {
        if (!ids.has(p.id)) return p;
        const expired = isExpired(p, today);
        const base = expired && Number(p.stock) > 0 ? removeExpiredStock(p, { at, by: STAFF, note: "Removed when archived" }) : p;
        return archiveProduct(base, { at, by: STAFF, reason: expired ? "expired" : isExpiringSoon(p) ? "expiring" : "discontinued" });
      }));
      const others = chosen.length > 1;
      chosen.forEach((item) => {
        const expiredPieces = isExpired(item, today) ? Number(item.stock) || 0 : 0;
        log(
          "Archived product",
          expiredPieces || type === "archive-expired"
            ? `${labelOf(item)} moved to the Archive${others ? " with the other expired products" : ""}${expiredPieces ? `; its ${pieces(expiredPieces)} that expired were taken off the shelf` : ""}`
            : `${labelOf(item)} moved to the Archive before it expires (${formatExpiryDate(item.expiryDate)})${others ? ", with the other expiring products" : ""}; its ${pieces(item.stock)} were kept with it`,
          item
        );
      });
      addNotification({
        message: chosen.length === 1
          ? `${chosen[0].name} moved to the Archive.`
          : `${chosen.length} ${type === "archive-expired" ? "expired" : "expiring"} products moved to the Archive.`,
      });
      setSelectedIds([]);
      setPending(null);
      return;
    }
    const id = product.id;
    const expiredPieces = isExpired(product, today) ? Number(product.stock) || 0 : 0;
    if (type === "archive") {
      setProducts(prev => prev.map(p => {
        if (p.id !== id) return p;
        const expired = isExpired(p, today) && Number(p.stock) > 0;
        const base = expired ? removeExpiredStock(p, { at, by: STAFF, note: "Removed when archived" }) : p;
        return archiveProduct(base, { at, by: STAFF, reason: expired ? "expired" : isExpiringSoon(p) ? "expiring" : "discontinued" });
      }));
      addNotification({ message: `${product.name} moved to the Archive.` });
      log(
        "Archived product",
        `${labelOf(product)} moved to the Archive${expiredPieces ? `; its ${pieces(expiredPieces)} that expired were taken off the shelf` : ` with ${pieces(product.stock)}`}`,
        product
      );
    } else if (type === "remove-expired") {
      setProducts(prev => prev.map(p => (p.id === id && isExpired(p, today) ? removeExpiredStock(p, { at, by: STAFF }) : p)));
      const cost = writeOffCost({ qty: expiredPieces, unitCost: product.originalPrice });
      addNotification({ message: `${pieces(expiredPieces)} of expired ${product.name} taken off the shelf.` });
      log(
        "Removed expired stock",
        `${pieces(expiredPieces)} of ${labelOf(product)} that expired on ${formatExpiryDate(product.expiryDate)} were taken off the shelf${cost === null ? "" : ` (${toPeso(cost)} at the original price)`}`,
        product,
        "medium"
      );
    } else if (type === "pull-out") {
      const pulled = Number(product.stock) || 0;
      setProducts(prev => prev.map(p => (p.id === id && isExpiringSoon(p) ? removeExpiredStock(p, { at, by: STAFF, note: "Pulled out before it expired" }) : p)));
      const cost = writeOffCost({ qty: pulled, unitCost: product.originalPrice });
      addNotification({ message: `${pieces(pulled)} of ${product.name} pulled off the shelf.` });
      log(
        "Pulled out stock",
        `${pieces(pulled)} of ${labelOf(product)} were pulled off the shelf before they expire on ${formatExpiryDate(product.expiryDate)}${cost === null ? "" : ` (${toPeso(cost)} at the original price)`}`,
        product,
        "medium"
      );
    } else if (type === "restore") {
      setProducts(prev => prev.map(p => (p.id === id ? restoreProduct(p, { at, by: STAFF }) : p)));
      addNotification({ message: `${product.name} is back in the Inventory.` });
      log("Restored product", `${labelOf(product)} restored from the Archive with ${pieces(product.stock)}`, product);
    } else if (type === "delete") {
      setProducts(prev => prev.filter(p => p.id !== id));
      addNotification({ message: `${product.name} deleted permanently.` });
      log("Deleted product", `${labelOf(product)} deleted permanently from the Archive`, product, "medium");
    }
    setPending(null);
  };

  // For the archive check of a product about to expire (or expired): when it does.
  const describeExpiry = (product) => {
    if (!expiryStageOf(product, today)) return "";
    const days = daysUntil(product.expiryDate, today);
    const date = formatExpiryDate(product.expiryDate);
    return days < 0 ? `It expired on ${date}. ` : `It expires on ${date} (${describeDaysLeft(days).toLowerCase()}). `;
  };

  const describePending = ({ type, product, products: chosen }) => {
    if (type === "archive-expired") {
      const { pcs, loss } = expiredTotals(chosen);
      const count = chosen.length;
      const names = chosen.slice(0, 6).map((item) => `${item.name} (${pieces(Number(item.stock) || 0)})`).join(" · ");
      return {
        title: `Archive ${count} expired ${count === 1 ? "product" : "products"}?`,
        message: `${names}${count > 6 ? ` and ${count - 6} more` : ""}`,
        detail: `${pcs ? `${pieces(pcs)} come off the shelf as expired stock${loss ? ` (${toPeso(loss)} at the original price)` : ""}. ` : ""}They leave the Inventory and the Sales / POS. You can restore each one from the Archive anytime.`,
        confirmLabel: `Yes, Archive ${count}`,
        confirmClassName: "btn-primary",
        icon: "bi-archive",
      };
    }
    if (type === "archive-expiring") {
      const count = chosen.length;
      const one = count === 1;
      const { pcs, value } = expiringTotals(chosen);
      const names = chosen
        .slice(0, 6)
        .map((item) => `${item.name} (${pieces(Number(item.stock) || 0)}, ${describeDaysLeft(daysUntil(item.expiryDate, today)).toLowerCase()})`)
        .join(" · ");
      return {
        title: `Archive ${count} expiring ${one ? "product" : "products"}?`,
        message: `${names}${count > 6 ? ` and ${count - 6} more` : ""}`,
        detail: `${one ? "Its" : "Their"} ${pieces(pcs)} stay recorded with ${one ? "it" : "them"}${value ? ` (${toPeso(value)} at the retail price)` : ""}. ${one ? "It leaves" : "They leave"} the Inventory and the Sales / POS before ${one ? "it expires" : "they expire"}. You can restore ${one ? "it" : "each one"} from the Archive anytime.`,
        confirmLabel: `Yes, Archive ${count}`,
        confirmClassName: "btn-primary",
        icon: "bi-archive",
      };
    }
    const stock = Number(product.stock) || 0;
    const expired = isExpired(product, today) && stock > 0;
    if (type === "archive") {
      return {
        title: "Archive Product?",
        message: `Move ${labelOf(product)} to the Archive?`,
        detail: `${expired
          ? `It expired on ${formatExpiryDate(product.expiryDate)}: its ${stock} pcs come off the shelf and are kept as expired stock. `
          : `${describeExpiry(product)}Its ${stock} pcs stay recorded with it. `}It leaves the Inventory list and the Sales / POS. You can restore it from the Archive anytime.`,
        confirmLabel: "Yes, Archive",
        confirmClassName: "btn-primary",
        icon: "bi-archive",
      };
    }
    if (type === "remove-expired") {
      const cost = writeOffCost({ qty: stock, unitCost: product.originalPrice });
      return {
        title: "Remove Expired Stock?",
        message: `Take the ${stock} pcs of ${labelOf(product)} off the shelf?`,
        detail: `They expired on ${formatExpiryDate(product.expiryDate)} and cannot be sold. They are kept in the Archive as expired stock${cost === null ? "" : ` (${toPeso(cost)} at the original price)`}. ${product.name} stays in the Inventory with 0 pcs until it is restocked with new stock.`,
        confirmLabel: "Yes, Remove",
        icon: "bi-calendar-x",
      };
    }
    if (type === "pull-out") {
      const cost = writeOffCost({ qty: stock, unitCost: product.originalPrice });
      return {
        title: "Pull Out Stock?",
        message: `Take the ${stock} pcs of ${labelOf(product)} off the shelf now?`,
        detail: `${describeExpiry(product)}For stock that is spoiled or cannot be sold anymore. They are kept in the Archive with the expired stock${cost === null ? "" : ` (${toPeso(cost)} at the original price)`}. ${product.name} stays in the Inventory with 0 pcs until it is restocked with new stock.`,
        confirmLabel: "Yes, Pull Out",
        icon: "bi-box-arrow-right",
      };
    }
    if (type === "restore") {
      return {
        title: "Restore Product?",
        message: `Bring ${labelOf(product)} back to the Inventory?`,
        detail: `It shows in the Sales / POS again with its ${stock} pcs.${isExpired(product, today) ? ` It expired on ${formatExpiryDate(product.expiryDate)}, so restock it with new stock before it can be sold.` : ""}`,
        confirmLabel: "Yes, Restore",
        confirmClassName: "btn-success",
        icon: "bi-arrow-counterclockwise",
      };
    }
    const records = Array.isArray(product.writeOffs) ? product.writeOffs.length : 0;
    return {
      title: "Delete Permanently?",
      message: `Delete ${labelOf(product)} for good?`,
      detail: `It is removed from the Archive${records ? `, together with its ${records} expired stock ${records === 1 ? "record" : "records"}` : ""}. This cannot be undone.`,
      confirmLabel: "Yes, Delete",
      icon: "bi-trash",
    };
  };

  const pendingDialog = pending ? describePending(pending) : null;

  // ---- What the tab and the search show.

  const inArchive = filter === "archive";
  const tabProducts = inArchive
    ? archived
    : shelf.filter(p => {
        if (filter === "all") return true;
        if (filter === "low-stock") return p.stock <= p.minStock;
        if (filter === "expiring") return isExpiringSoon(p);
        if (filter === "expired") return isExpired(p, today);
        return p.category === filter;
      });
  // The tab and the search together: both have to fit.
  const found = searchInventory(tabProducts, search, today);
  const tabLabel = inArchive
    ? "archived products"
    : filter === "all" ? "products"
    : filter === "low-stock" ? "low stock products"
    : filter === "expiring" ? "products expiring soon"
    : filter === "expired" ? "expired products"
    : `${filter} products`;
  // The Archive's expired stock records follow the search too, by their product.
  const writeOffs = getWriteOffs(numberedProducts);
  const searchedIds = search.trim() ? new Set(searchInventory(numberedProducts, search, today).results.map((p) => p.id)) : null;
  const shownWriteOffs = searchedIds ? writeOffs.filter((record) => searchedIds.has(record.product.id)) : writeOffs;
  // The Expiring Soon and Expired tabs: the products shown can be ticked and archived
  // together (only what is shown counts, so a search narrows it), or all of them.
  const expiringTab = filter === "expiring";
  const expiredTab = filter === "expired";
  const selectable = expiringTab || expiredTab;
  const selectedSet = new Set(selectedIds);
  const selectedShown = selectable ? found.results.filter((p) => selectedSet.has(p.id)) : [];
  const allShownSelected = selectable && found.results.length > 0 && selectedShown.length === found.results.length;
  const shownExpiredTotals = expiredTab ? expiredTotals(found.results) : null;
  const shownExpiringTotals = expiringTab ? expiringTotals(found.results) : null;
  const toggleSelected = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  const toggleAllShown = () => setSelectedIds(allShownSelected ? [] : found.results.map((p) => p.id));
  // A new tab starts with nothing ticked.
  const showTab = (tab) => {
    setFilter(tab);
    setSelectedIds([]);
  };

  // "/" jumps to the search box from anywhere on the page, unless typing elsewhere
  // or a pop-up is open.
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector(".modal.show")) return;
      event.preventDefault();
      searchBox.current?.focus();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const stats = {
    total: shelf.length,
    lowStock: shelf.filter(p => p.stock <= p.minStock).length,
    // Expired stock is not sold, so it is worth nothing on the shelf.
    totalValue: shelf.filter(p => !isExpired(p, today)).reduce((sum, p) => sum + (p.price * p.stock), 0),
    outOfStock: shelf.filter(p => p.stock === 0).length,
    expiringSoon: getExpiryAlerts(shelf, today).filter((alert) => alert.stage !== "expired").length,
    expired: expiredOnShelf.length,
  };

  const archiveTotals = {
    products: archived.length,
    expiredPieces: writeOffs.reduce((sum, record) => sum + (Number(record.qty) || 0), 0),
    loss: writeOffs.reduce((sum, record) => sum + (writeOffCost(record) || 0), 0),
  };

  const categories = ["all", "low-stock", "expiring", "expired", ...new Set(shelf.map(p => p.category))];
  const emptyMessage = (label) =>
    search.trim() ? (
      <>
        No {label} match &ldquo;{search.trim()}&rdquo;.{" "}
        <button type="button" className="inventory-empty-clear" onClick={() => setSearch("")}>
          Clear search
        </button>
      </>
    ) : (
      `No ${label} yet.`
    );

  return (
    <div className="inventory-container">
      {/* Header */}
      <div className="inventory-header">
        <div>
          <h1 className="inventory-title">Inventory Management</h1>
          <p className="inventory-subtitle">Track and manage product stock levels</p>
        </div>
      </div>

      {inArchive ? <InventoryArchiveStats totals={archiveTotals} /> : <InventoryStats stats={stats} />}

      {focusProductId !== null && !focusProduct && (
        <p className="inventory-focus-missing" role="status">
          <i className="bi bi-info-circle" aria-hidden="true"></i>
          That product is no longer in the inventory. It may have been deleted.
        </p>
      )}

      {/* Expired stock still on the shelf: the POS refuses it, so it has to go. */}
      {!inArchive && filter !== "expired" && expiredOnShelf.length > 0 && (
        <div className="inventory-expired-alert" role="alert">
          <i className="bi bi-calendar-x-fill" aria-hidden="true"></i>
          <span>
            <strong>
              {expiredOnShelf.length} expired {expiredOnShelf.length === 1 ? "product is" : "products are"} still in stock:
            </strong>{" "}
            {expiredOnShelf
              .slice(0, 3)
              .map((p) => `${p.name} (${pieces(p.stock)}, ${formatExpiryDate(p.expiryDate)})`)
              .join(", ")}
            {expiredOnShelf.length > 3 ? ` and ${expiredOnShelf.length - 3} more` : ""}. The Sales / POS will not sell them: archive
            them, remove the expired stock, or restock with new stock.
          </span>
          <button type="button" onClick={() => showTab("expired")}>
            Show expired
          </button>
          <button
            type="button"
            className="inventory-expired-archive"
            onClick={() => setPending({ type: "archive-expired", products: expiredOnShelf })}
          >
            <i className="bi bi-archive" aria-hidden="true"></i>
            Archive all {expiredOnShelf.length}
          </button>
        </div>
      )}

      {/* Filter tabs and the Archive, then the search and Add Product on the right */}
      <div className="inventory-filters mb-4">
        {categories.map(cat => (
          <button
            key={cat}
            className={`btn btn-sm inventory-filter-btn ${filter === cat ? "active" : ""}`}
            onClick={() => showTab(cat)}
          >
            {cat === "all" ? "All Products" : cat === "low-stock" ? "Low Stock" : cat === "expiring" ? "Expiring Soon" : cat === "expired" ? "Expired" : cat}
            {cat === "expiring" && expiringCount > 0 && <span className="inventory-archive-count is-expiring">{expiringCount}</span>}
            {cat === "expired" && expiredCount > 0 && <span className="inventory-archive-count is-expired">{expiredCount}</span>}
          </button>
        ))}
        <button
          className={`btn btn-sm inventory-filter-btn inventory-archive-tab ${inArchive ? "active" : ""}`}
          onClick={() => showTab("archive")}
          title="Previous goods: archived products and expired stock taken off the shelf"
        >
          <i className="bi bi-archive" aria-hidden="true"></i>
          Archive
          <span className="inventory-archive-count">{archived.length}</span>
        </button>
        {/* Together at the right end, or together on a row of their own when the tabs fill this one */}
        <div className="inventory-toolbar-end">
          <div className="inventory-search">
            <i className="bi bi-search" aria-hidden="true"></i>
            <input
              ref={searchBox}
              type="search"
              className="inventory-search-input"
              placeholder="Search name, #no., category, or: low, expired, <50"
              aria-label="Search products"
              aria-describedby="inventory-search-help"
              title="Words in any order. Also: low, out of stock, in stock, expired, expiring, <50 (price), stock<10. Press / to search."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearch("");
              }}
            />
            {search ? (
              <button type="button" className="inventory-search-clear" onClick={() => setSearch("")} aria-label="Clear search" title="Clear search">
                <i className="bi bi-x-lg"></i>
              </button>
            ) : (
              <kbd className="inventory-search-key" aria-hidden="true">/</kbd>
            )}
          </div>
          <button className="btn btn-success inventory-add-btn" onClick={openAddModal}>
            <i className="bi bi-plus-circle me-2"></i>
            Add Product
          </button>
        </div>
        {search.trim() && (
          <div className="inventory-search-meta" id="inventory-search-help" role="status">
            <span className="inventory-search-count">
              {found.results.length} of {tabProducts.length} {tabLabel}
            </span>
            {found.filters.map((label) => (
              <span key={label} className="inventory-search-chip">
                <i className="bi bi-funnel" aria-hidden="true"></i>
                {label}
              </span>
            ))}
            {found.typos && (
              <span className="inventory-search-chip is-typo">
                <i className="bi bi-magic" aria-hidden="true"></i>
                Close matches included
              </span>
            )}
          </div>
        )}
      </div>

      {inArchive ? (
        <InventoryArchive
          products={found.results}
          writeOffs={shownWriteOffs}
          searchTerms={found.terms}
          emptyMessage={emptyMessage}
          today={today}
          highlightId={focusProduct ? focusProduct.id : null}
          onRestore={requestRestore}
          onDelete={(product) => setPending({ type: "delete", product })}
        />
      ) : (
        <>
          {/* The Expired tab: what is shown, and archiving it together (ticked or all) */}
          {expiredTab && found.results.length > 0 && (
            <div className="inventory-expired-bar">
              <span className="inventory-expired-bar-summary">
                <i className="bi bi-calendar-x-fill" aria-hidden="true"></i>
                <strong>{found.results.length} expired</strong>
                {` · ${pieces(shownExpiredTotals.pcs)}`}
                {shownExpiredTotals.loss > 0 ? ` · ${toPeso(shownExpiredTotals.loss)} loss at the original price` : ""}
              </span>
              <label className="inventory-select-all">
                <input
                  type="checkbox"
                  checked={allShownSelected}
                  ref={(box) => {
                    if (box) box.indeterminate = selectedShown.length > 0 && !allShownSelected;
                  }}
                  onChange={toggleAllShown}
                />
                Select all
              </label>
              <button
                type="button"
                disabled={selectedShown.length === 0}
                onClick={() => setPending({ type: "archive-expired", products: selectedShown })}
              >
                <i className="bi bi-archive" aria-hidden="true"></i>
                Archive selected ({selectedShown.length})
              </button>
              <button
                type="button"
                className="is-all"
                onClick={() => setPending({ type: "archive-expired", products: found.results })}
              >
                <i className="bi bi-archive-fill" aria-hidden="true"></i>
                Archive all ({found.results.length})
              </button>
            </div>
          )}
          {/* The Expiring Soon tab: sell them first, or archive them (ticked or all) */}
          {expiringTab && found.results.length > 0 && (
            <div className="inventory-expiring-bar">
              <span className="inventory-expiring-bar-summary">
                <i className="bi bi-hourglass-split" aria-hidden="true"></i>
                <strong>{found.results.length} expiring soon</strong>
                {` · ${pieces(shownExpiringTotals.pcs)}`}
                {shownExpiringTotals.value > 0 ? ` · ${toPeso(shownExpiringTotals.value)} at the retail price` : ""}
                <span className="inventory-expiring-bar-hint">Sell these first, pull out what is spoiled, or archive them before they expire.</span>
              </span>
              <label className="inventory-select-all">
                <input
                  type="checkbox"
                  checked={allShownSelected}
                  ref={(box) => {
                    if (box) box.indeterminate = selectedShown.length > 0 && !allShownSelected;
                  }}
                  onChange={toggleAllShown}
                />
                Select all
              </label>
              <button
                type="button"
                disabled={selectedShown.length === 0}
                onClick={() => setPending({ type: "archive-expiring", products: selectedShown })}
              >
                <i className="bi bi-archive" aria-hidden="true"></i>
                Archive selected ({selectedShown.length})
              </button>
              <button
                type="button"
                className="is-all"
                onClick={() => setPending({ type: "archive-expiring", products: found.results })}
              >
                <i className="bi bi-archive-fill" aria-hidden="true"></i>
                Archive all ({found.results.length})
              </button>
            </div>
          )}
          <InventoryTable
            products={found.results}
            searchTerms={found.terms}
            emptyMessage={emptyMessage(tabLabel)}
            onEdit={openEditModal}
            onArchive={(product) => setPending({ type: "archive", product })}
            onRemoveExpired={(product) => setPending({ type: "remove-expired", product })}
            onPullOut={(product) => setPending({ type: "pull-out", product })}
            onRestock={openRestockModal}
            highlightId={focusProduct ? focusProduct.id : null}
            today={today}
            selectedIds={selectable ? selectedSet : null}
            onToggleSelect={toggleSelected}
          />
        </>
      )}

      {/* Add/Edit Modal */}
      {modal === "form" && !saveTarget && (
        <InventoryModal
          form={form}
          setForm={setForm}
          editId={editId}
          errors={formErrors}
          expiryWarning={formExpiryWarning}
          minExpiry={earliestExpiry}
          onClose={() => setModal(null)}
          onSave={requestSave}
        />
      )}

      {/* Restock Modal */}
      {modal === "restock" && !saveTarget && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inventory-modal">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-box-seam me-2"></i>
                  Restock Product
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setModal(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-light mb-3">
                  <strong>{form.name}</strong> - Current Stock: {form.stock} pcs
                  {restockingExpired && heldStock > 0 && <span className="inventory-restock-expired"> (expired)</span>}
                </p>
                <div className="mb-3">
                  <label className="form-label" htmlFor="inventory-restock">Restock Amount</label>
                  <input
                    id="inventory-restock"
                    type="number"
                    className={`form-control${showRestockError ? " inventory-input-error" : ""}`}
                    value={numberFieldValue(form.restockAmount)}
                    onChange={e => setForm({ ...form, restockAmount: e.target.value })}
                    {...numberKeys()}
                    min="1"
                    max={Math.max(1, MAX_STOCK - restockBase)}
                    step="1"
                    placeholder="0"
                    aria-invalid={showRestockError}
                    aria-describedby="inventory-restock-help"
                  />
                  {showRestockError ? (
                    <div id="inventory-restock-help" className="inventory-field-error" role="alert">
                      <i className="bi bi-exclamation-circle me-1" aria-hidden="true"></i>
                      {restockError}
                    </div>
                  ) : (
                    <small id="inventory-restock-help" className="form-text text-muted">
                      {restockBase >= MAX_STOCK
                        ? `Already at the ${pieces(MAX_STOCK)} maximum.`
                        : `Up to ${pieces(MAX_STOCK - restockBase)} more: at most ${pieces(MAX_STOCK)} in stock.`}
                    </small>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="inventory-restock-expiry">Expiry Date of the New Stock</label>
                  <input
                    id="inventory-restock-expiry"
                    type="date"
                    className={`form-control${restockExpiryError ? " inventory-input-error" : ""}`}
                    value={form.restockExpiry || ""}
                    onChange={e => setForm({ ...form, restockExpiry: e.target.value })}
                    min={earliestExpiry}
                    required={restockingExpired}
                    aria-invalid={Boolean(restockExpiryError)}
                    aria-describedby="inventory-restock-expiry-help"
                  />
                  {restockExpiryError ? (
                    <div id="inventory-restock-expiry-help" className="inventory-field-error" role="alert">
                      <i className="bi bi-exclamation-circle me-1" aria-hidden="true"></i>
                      {restockExpiryError}
                    </div>
                  ) : restockExpiryWarning ? (
                    <div id="inventory-restock-expiry-help" className="inventory-field-warning" role="status">
                      <i className="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
                      {restockExpiryWarning}
                    </div>
                  ) : (
                    <small id="inventory-restock-expiry-help" className="form-text text-muted">
                      {restockingExpired
                        ? `Required: the current date, ${formatExpiryDate(restocked.expiryDate)}, has passed.`
                        : restocked.expiryDate
                          ? `Now ${formatExpiryDate(restocked.expiryDate)}. Leave blank to keep it.`
                          : "No expiry date now. Leave blank if it does not expire."}
                    </small>
                  )}
                </div>
                {olderStockNote && (
                  <div className="inventory-restock-note" role="status">
                    <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
                    <span>{olderStockNote}</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={requestRestock}
                  disabled={restockBlocked}
                >
                  <i className="bi bi-check-circle me-2"></i>
                  Restock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {modal && !saveTarget && <div className="modal-backdrop show"></div>}

      {saveTarget && saveDialog && (
        <ConfirmDialog
          title={saveDialog.title}
          message={saveDialog.message}
          detail={saveDialog.detail}
          confirmLabel={saveDialog.confirmLabel}
          cancelLabel="Go back"
          confirmClassName="btn-success"
          icon={saveDialog.icon}
          onConfirm={() => confirmSave(saveTarget)}
          onClose={() => setSaveTarget(null)}
        />
      )}

      {pending && pendingDialog && (
        <ConfirmDialog
          title={pendingDialog.title}
          message={pendingDialog.message}
          detail={pendingDialog.detail}
          confirmLabel={pendingDialog.confirmLabel}
          cancelLabel="Keep it"
          confirmClassName={pendingDialog.confirmClassName}
          icon={pendingDialog.icon}
          onConfirm={() => confirmPending(pending)}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
