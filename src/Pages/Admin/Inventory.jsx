import { useState } from "react";
import "../../styles/Admin/Inventory.css";
import InventoryModal from "../../Elements/Admin/InventoryModal.jsx";
import InventoryStats from "../../Elements/Admin/InventoryStats";
import InventoryTable from "../../Elements/Admin/InventoryTable";

export default function Inventory({ products, setProducts }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ 
    sku: "",
    name: "", 
    category: "Food", 
    supplier: "",
    location: "",
    expiryDate: "",
    price: 0, 
    stock: 0, 
    minStock: 10, 
    unit: "pcs" 
  });
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState("all");

  const save = () => {
    if (editId) {
      setProducts(prev => prev.map(p => p.id === editId ? { ...p, ...form } : p));
    } else {
      setProducts(prev => [...prev, { id: Date.now(), ...form }]);
    }
    setModal(null);
    setEditId(null);
  };

  const deleteProduct = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const restockProduct = (id, amount) => {
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, stock: p.stock + amount } : p
    ));
  };

  const openEditModal = (product) => {
    setForm(product);
    setEditId(product.id);
    setModal("form");
  };

  const openAddModal = () => {
    setForm({ sku: "", name: "", category: "Food", supplier: "", location: "", expiryDate: "", price: 0, stock: 0, minStock: 10, unit: "pcs" });
    setEditId(null);
    setModal("form");
  };

  const openRestockModal = (product) => {
    setForm({ ...product, restockAmount: 0 });
    setEditId(product.id);
    setModal("restock");
  };

  const handleRestock = () => {
    if (form.restockAmount > 0) {
      restockProduct(editId, Number(form.restockAmount));
    }
    setModal(null);
    setEditId(null);
  };

  const filteredProducts = products.filter(p => {
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
        onDelete={deleteProduct}
        onRestock={openRestockModal}
      />

      {/* Add/Edit Modal */}
      {modal === "form" && (
        <InventoryModal
          form={form}
          setForm={setForm}
          editId={editId}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {/* Restock Modal */}
      {modal === "restock" && (
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
                  <strong>{form.name}</strong> - Current Stock: {form.stock} {form.unit}
                </p>
                <div className="mb-3">
                  <label className="form-label">Restock Amount</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={form.restockAmount || 0} 
                    onChange={e => setForm({ ...form, restockAmount: e.target.value })}
                    min="1"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-success" onClick={handleRestock}>
                  <i className="bi bi-check-circle me-2"></i>
                  Restock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {modal && <div className="modal-backdrop show"></div>}
    </div>
  );
}
