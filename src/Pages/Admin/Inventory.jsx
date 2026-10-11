import { useState } from "react";
import "../../styles/Admin/Inventory.css";
import InventoryModal from "../../Elements/Admin/InventoryModal.jsx";
import InventoryStats from "../../Elements/Admin/InventoryStats";
import InventoryTable from "../../Elements/Admin/InventoryTable";
import { useNotifications } from "../../Elements/Global/useNotifications";
import ConfirmDialog from "../../Elements/Global/ConfirmDialog";
import { numberFieldValue } from "../../utils/numberField";
import { getNextProductNumber, normalizeProductNumbers } from "../../utils/productNumbers";
import { getProductErrors, getRestockError } from "../../utils/inventoryValidation";
import { getTodayDate } from "../../utils/reservations";

export default function Inventory({ products, setProducts }) {
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
  const [filter, setFilter] = useState("all");
  // Deleting cannot be undone, so the trash button only arms this confirmation.
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Adding a product or restocking asks once more before it changes the stock.
  // The form is kept, so "Go back" returns to it with everything still typed in.
  const [saveTarget, setSaveTarget] = useState(null);
  // The table always shows one number per product, even for a list saved before
  // the numbers were fixed (App also repairs the stored list when it loads).
  const numberedProducts = normalizeProductNumbers(products);
  const editedProduct = editId ? numberedProducts.find((item) => item.id === editId) || null : null;
  // What is wrong with the open form, if anything; nothing is saved until it is fixed.
  const formErrors =
    modal === "form"
      ? getProductErrors({ form, products: numberedProducts, editId, original: editedProduct, today: getTodayDate() })
      : {};
  const restockError = modal === "restock" ? getRestockError(form.restockAmount, editedProduct?.stock) : "";
  // A restock box still at 0 is not an error yet, only not filled in.
  const showRestockError = Boolean(restockError) && Number(form.restockAmount) !== 0;

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
      setProducts(prev => prev.map(p => p.id === editId ? { ...p, ...cleaned } : p));
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

  const restockProduct = (id, amount) => {
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, stock: (Number(p.stock) || 0) + amount } : p
    ));
    const product = products.find((item) => item.id === id);
    addNotification({ message: `${product?.name || "Product"} restocked by ${amount} pcs.` });
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
    setForm({ ...product, restockAmount: 0 });
    setEditId(product.id);
    setModal("restock");
  };

  const handleRestock = () => {
    if (!getRestockError(form.restockAmount, editedProduct?.stock)) {
      restockProduct(editId, Number(form.restockAmount));
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
    if (restockError) return;
    const product = editedProduct;
    setSaveTarget({ type: "restock", product: product || form, amount: Number(form.restockAmount) });
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
      return {
        title: "Restock Product?",
        message: `Add ${target.amount} pcs to ${name}${product.productNumber ? ` (#${product.productNumber})` : ""}?`,
        detail: `Stock goes from ${stock} to ${stock + target.amount} pcs.`,
        confirmLabel: "Yes, Restock",
        icon: "bi-box-seam",
      };
    }

    const price = `₱${(Number(product.price) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const expiry = product.expiryDate
      ? new Date(`${product.expiryDate}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
      : "no expiry date";
    return {
      title: "Add Product?",
      message: `Add ${name} to inventory as Product #${target.productNumber}?`,
      detail: `${product.category} · ${price} per piece · ${stock} pcs in stock (low-stock alert at ${Number(product.minStock) || 0} pcs) · ${expiry}. It shows up in the Sales / POS right away.`,
      confirmLabel: "Yes, Add Product",
      icon: "bi-plus-circle",
    };
  };

  const saveDialog = saveTarget ? describeSave(saveTarget) : null;

  const filteredProducts = numberedProducts.filter(p => {
    if (filter === "all") return true;
    if (filter === "low-stock") return p.stock <= p.minStock;
    return p.category === filter;
  });

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
        <button className="btn btn-success inventory-add-btn" onClick={openAddModal}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Product
        </button>
      </div>

      <InventoryStats stats={stats} />

      {/* Filter Tabs */}
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
      </div>

      <InventoryTable
        products={filteredProducts}
        onEdit={openEditModal}
        onDelete={requestDelete}
        onRestock={openRestockModal}
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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={requestRestock}
                  disabled={Boolean(restockError)}
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
          detail={`It still has ${Number(deleteTarget.stock) || 0} pcs in stock. Once deleted it disappears from the Sales / POS, and this cannot be undone.`}
          confirmLabel="Yes, Delete"
          cancelLabel="Keep it"
          onConfirm={() => confirmDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
