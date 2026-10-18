import { useEffect, useRef, useState } from "react";
import "../../styles/Admin/Inventory.css";
import InventoryModal from "../../Elements/Admin/InventoryModal.jsx";
import InventoryStats from "../../Elements/Admin/InventoryStats";
import InventoryTable from "../../Elements/Admin/InventoryTable";
import { useNotifications } from "../../Elements/Global/useNotifications";
import ConfirmDialog from "../../Elements/Global/ConfirmDialog";
import { numberFieldValue } from "../../utils/numberField";
import { getNextProductNumber, normalizeProductNumbers } from "../../utils/productNumbers";
import { formatExpiryDate, getExpiryError, getProductErrors, getRestockError } from "../../utils/inventoryValidation";
import { searchInventory } from "../../utils/inventorySearch";
import { getTodayDate } from "../../utils/reservations";
import { daysUntil, describeDaysLeft, expiryStageOf } from "../../utils/expiryAlerts";

// `focusProductId`: a product opened from the admin's bell, shown marked (under
// Low Stock while it is still low). `focusAction` "delete": its Delete button in
// the bell was pressed, so its delete check opens straight away.
export default function Inventory({ products, setProducts, focusProductId = null, focusAction = null }) {
  const { addNotification } = useNotifications();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    name: "",
    category: "Food",
    expiryDate: "",
    price: 0,
    stock: 0,
    minStock: 10,
    unit: "pcs"
  });
  const [editId, setEditId] = useState(null);
  const focusProduct =
    focusProductId === null ? null : products.find((product) => String(product.id) === String(focusProductId)) || null;
  const [filter, setFilter] = useState(() =>
    focusProduct && Number(focusProduct.stock) <= Number(focusProduct.minStock) ? "low-stock" : "all"
  );
  // What is typed in the search box (see utils/inventorySearch.js).
  const [search, setSearch] = useState("");
  const searchBox = useRef(null);
  // Deleting cannot be undone, so the trash button only arms this confirmation.
  const [deleteTarget, setDeleteTarget] = useState(() => (focusAction === "delete" ? focusProduct : null));
  // Adding a product or restocking asks once more before it changes the stock.
  // The form is kept, so "Go back" returns to it with everything still typed in.
  const [saveTarget, setSaveTarget] = useState(null);
  // The table always shows one number per product, even for a list saved before
  // the numbers were fixed (App also repairs the stored list when it loads).
  const numberedProducts = normalizeProductNumbers(products);
  const editedProduct = editId ? numberedProducts.find((item) => item.id === editId) || null : null;
  const today = getTodayDate();
  // What is wrong with the open form, if anything; nothing is saved until it is fixed.
  const formErrors = modal === "form" ? getProductErrors({ form, products: numberedProducts, editId, today }) : {};
  const restockError = modal === "restock" ? getRestockError(form.restockAmount, editedProduct?.stock) : "";
  // A restock box still at 0 is not an error yet, only not filled in.
  const showRestockError = Boolean(restockError) && Number(form.restockAmount) !== 0;
  // The new stock's expiry date: blank keeps the product's date as it is.
  const restockExpiryError = modal === "restock" ? getExpiryError(form.restockExpiry, today) : "";
  // Stock already on the shelf that expires before the new stock does: the
  // product shows one date, so after the restock that older date is no longer shown.
  const restocked = editedProduct || form;
  const heldStock = Number(restocked.stock) || 0;
  const olderStockNote =
    modal === "restock" && heldStock > 0 && restocked.expiryDate && form.restockExpiry && !restockExpiryError
      && form.restockExpiry > restocked.expiryDate
      ? restocked.expiryDate < today
        ? `The ${heldStock} pcs already in stock expired on ${formatExpiryDate(restocked.expiryDate)}. Take those off the shelf: after this restock the product shows the new date.`
        : `The ${heldStock} pcs already in stock expire sooner, on ${formatExpiryDate(restocked.expiryDate)}. Sell those first: after this restock the product shows the new date.`
      : "";

  const save = () => {
    if (Object.keys(formErrors).length) return;
    // Stored clean: a trimmed name and numbers, whatever the inputs held.
    const cleaned = {
      ...form,
      name: form.name.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      minStock: Number(form.minStock),
    };
    if (editId) {
      // Only the price is taken from the form: everything else stays as stored,
      // so a sale or restock made while the form was open is kept.
      setProducts(prev => prev.map(p => p.id === editId ? { ...p, price: cleaned.price } : p));
      addNotification({ message: `${cleaned.name} inventory details updated.` });
    } else {
      // The number comes from the latest list and is set after the form, so a
      // leftover field can never hand a new product an existing number.
      setProducts(prev => {
        const numbered = normalizeProductNumbers(prev);
        return [...numbered, { ...cleaned, id: Date.now(), productNumber: getNextProductNumber(numbered) }];
      });
      addNotification({ message: `${cleaned.name} added to inventory.` });
    }
    setModal(null);
    setEditId(null);
  };

  const deleteProduct = (id) => {
    const product = products.find((item) => item.id === id);
    setProducts(prev => prev.filter(p => p.id !== id));
    addNotification({ message: `${product?.name || "Product"} removed from inventory.` });
  };

  const requestDelete = (id) => setDeleteTarget(numberedProducts.find((item) => item.id === id) || null);

  // Takes the product as an argument rather than reading `deleteTarget` from the
  // closure: the React Compiler narrows a closed-over `deleteTarget.id` into a
  // render-time check, which throws while the target is still null.
  const confirmDelete = (product) => {
    deleteProduct(product.id);
    setDeleteTarget(null);
  };

  // `expiryDate`: the new stock's, which becomes the product's; blank keeps its date.
  const restockProduct = (id, amount, expiryDate = "") => {
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, stock: (Number(p.stock) || 0) + amount, ...(expiryDate ? { expiryDate } : {}) } : p
    ));
    const product = products.find((item) => item.id === id);
    addNotification({
      message: `${product?.name || "Product"} restocked by ${amount} pcs${expiryDate ? ` (expires ${formatExpiryDate(expiryDate)})` : ""}.`,
    });
  };

  const openEditModal = (product) => {
    setForm(product);
    setEditId(product.id);
    setModal("form");
  };

  const openAddModal = () => {
    setForm({ name: "", category: "Food", expiryDate: "", price: 0, stock: 0, minStock: 10, unit: "pcs" });
    setEditId(null);
    setModal("form");
  };

  const openRestockModal = (product) => {
    setForm({ ...product, restockAmount: 0, restockExpiry: "" });
    setEditId(product.id);
    setModal("restock");
  };

  const handleRestock = () => {
    if (!getRestockError(form.restockAmount, editedProduct?.stock) && !getExpiryError(form.restockExpiry, today)) {
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
    if (restockError || restockExpiryError) return;
    const product = editedProduct;
    setSaveTarget({
      type: "restock",
      product: product || form,
      amount: Number(form.restockAmount),
      expiryDate: form.restockExpiry || "",
    });
  };

  // Takes the target as an argument for the same React Compiler reason as confirmDelete.
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
      return {
        title: "Restock Product?",
        message: `Add ${target.amount} pcs to ${name}${product.productNumber ? ` (#${product.productNumber})` : ""}?`,
        detail: `Stock goes from ${stock} to ${stock + target.amount} pcs.${expiryLine}`,
        confirmLabel: "Yes, Restock",
        icon: "bi-box-seam",
      };
    }

    const price = `₱${(Number(product.price) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const expiry = product.expiryDate ? `expires ${formatExpiryDate(product.expiryDate)}` : "no expiry date";
    return {
      title: "Add Product?",
      message: `Add ${name} to inventory as Product #${target.productNumber}?`,
      detail: `${product.category} · ${price} per piece · ${stock} pcs in stock (low-stock alert at ${Number(product.minStock) || 0} pcs) · ${expiry}. It shows up in the Sales / POS right away. Afterwards only its price can be edited; stock and expiry date change through Restock.`,
      confirmLabel: "Yes, Add Product",
      icon: "bi-plus-circle",
    };
  };

  const saveDialog = saveTarget ? describeSave(saveTarget) : null;

  // For the delete check of a product about to expire (or expired): when it does.
  const describeDeleteExpiry = (product) => {
    if (!expiryStageOf(product, today)) return "";
    const days = daysUntil(product.expiryDate, today);
    const date = formatExpiryDate(product.expiryDate);
    return days < 0 ? `It expired on ${date}. ` : `It expires on ${date} (${describeDaysLeft(days).toLowerCase()}). `;
  };

  const tabProducts = numberedProducts.filter(p => {
    if (filter === "all") return true;
    if (filter === "low-stock") return p.stock <= p.minStock;
    return p.category === filter;
  });
  // The tab and the search together: both have to fit.
  const found = searchInventory(tabProducts, search, today);
  const tabLabel = filter === "all" ? "products" : filter === "low-stock" ? "low stock products" : `${filter} products`;

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
    total: products.length,
    lowStock: products.filter(p => p.stock <= p.minStock).length,
    totalValue: products.reduce((sum, p) => sum + (p.price * p.stock), 0),
    outOfStock: products.filter(p => p.stock === 0).length,
  };

  const categories = ["all", "low-stock", ...new Set(products.map(p => p.category))];

  return (
    <div className="inventory-container">
      {/* Header */}
      <div className="inventory-header">
        <div>
          <h1 className="inventory-title">Inventory Management</h1>
          <p className="inventory-subtitle">Track and manage product stock levels</p>
        </div>
      </div>

      <InventoryStats stats={stats} />

      {focusProductId !== null && !focusProduct && (
        <p className="inventory-focus-missing" role="status">
          <i className="bi bi-info-circle" aria-hidden="true"></i>
          That product is no longer in the inventory. It may have been deleted.
        </p>
      )}

      {/* Filter tabs, then the search and Add Product on the right */}
      <div className="inventory-filters mb-4">
        {categories.map(cat => (
          <button
            key={cat}
            className={`btn btn-sm inventory-filter-btn ${filter === cat ? "active" : ""}`}
            onClick={() => setFilter(cat)}
          >
            {cat === "all" ? "All Products" : cat === "low-stock" ? "Low Stock" : cat}
          </button>
        ))}
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

      <InventoryTable
        products={found.results}
        searchTerms={found.terms}
        emptyMessage={
          search.trim() ? (
            <>
              No {tabLabel} match &ldquo;{search.trim()}&rdquo;.{" "}
              <button type="button" className="inventory-empty-clear" onClick={() => setSearch("")}>
                Clear search
              </button>
            </>
          ) : (
            `No ${tabLabel} yet.`
          )
        }
        onEdit={openEditModal}
        onDelete={requestDelete}
        onRestock={openRestockModal}
        highlightId={focusProduct ? focusProduct.id : null}
        today={today}
      />

      {/* Add/Edit Modal */}
      {modal === "form" && !saveTarget && (
        <InventoryModal
          form={form}
          setForm={setForm}
          editId={editId}
          errors={formErrors}
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
                </p>
                <div className="mb-3">
                  <label className="form-label" htmlFor="inventory-restock">Restock Amount</label>
                  <input
                    id="inventory-restock"
                    type="number"
                    className={`form-control${showRestockError ? " inventory-input-error" : ""}`}
                    value={numberFieldValue(form.restockAmount)}
                    onChange={e => setForm({ ...form, restockAmount: e.target.value })}
                    min="1"
                    step="1"
                    placeholder="0"
                    aria-invalid={showRestockError}
                    aria-describedby={showRestockError ? "inventory-restock-error" : undefined}
                  />
                  {showRestockError && (
                    <div id="inventory-restock-error" className="inventory-field-error" role="alert">
                      <i className="bi bi-exclamation-circle me-1" aria-hidden="true"></i>
                      {restockError}
                    </div>
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
                    min={today}
                    aria-invalid={Boolean(restockExpiryError)}
                    aria-describedby="inventory-restock-expiry-help"
                  />
                  {restockExpiryError ? (
                    <div id="inventory-restock-expiry-help" className="inventory-field-error" role="alert">
                      <i className="bi bi-exclamation-circle me-1" aria-hidden="true"></i>
                      {restockExpiryError}
                    </div>
                  ) : (
                    <small id="inventory-restock-expiry-help" className="form-text text-muted">
                      {restocked.expiryDate
                        ? `Now ${formatExpiryDate(restocked.expiryDate)}${restocked.expiryDate < today ? " (expired)" : ""}. Leave blank to keep it.`
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
                  disabled={Boolean(restockError || restockExpiryError)}
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

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Product?"
          message={`Delete ${deleteTarget.name}${deleteTarget.productNumber ? ` (#${deleteTarget.productNumber})` : ""} from inventory?`}
          detail={`${describeDeleteExpiry(deleteTarget)}It still has ${Number(deleteTarget.stock) || 0} pcs in stock. Once deleted it disappears from the Sales / POS, and this cannot be undone.`}
          confirmLabel="Yes, Delete"
          cancelLabel="Keep it"
          onConfirm={() => confirmDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
