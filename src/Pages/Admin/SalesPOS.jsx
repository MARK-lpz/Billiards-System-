import { useState } from "react";
import "../../styles/Admin/SalesPOS.css";
import "../../styles/Admin/CartPanel.css";
import "../../styles/Admin/RecentTransac.css";
import ProductGrid from "../../Elements/Admin/ProductGrid";
import CartPanel from "../../Elements/Admin/CartPanel";
import ReceiptModal from "../../Elements/Admin/ReceiptModal";

export default function SalesPOS({ products, setProducts, transactions, setTransactions }) {
  const [cart, setCart] = useState([]);
  const [method, setMethod] = useState("cash");
  const [receipt, setReceipt] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) && p.stock > 0
  );

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const addToCart = (p) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id);
      if (existing) {
        return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.id !== id));
    } else {
      setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
    }
  };

  const processPayment = () => {
    const tx = {
      id: Date.now(),
      date: "2026-03-08",
      cashier: "Staff A",
      items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      total,
      method
    };

    setTransactions(prev => [tx, ...prev]);
    
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(i => i.id === p.id);
      return cartItem ? { ...p, stock: p.stock - cartItem.qty } : p;
    }));

    setReceipt(tx);
    setCart([]);
  };

  return (
    <div className="sales-pos-container">
      {/* Header */}
      <div className="sales-pos-header">
        <h1 className="sales-pos-title">Sales / POS</h1>
        <p className="sales-pos-subtitle">Process transactions and manage sales</p>
      </div>

      <div className="sales-pos-layout">
        {/* Left: Product Grid */}
        <div className="sales-pos-products">
          <div className="sales-pos-search">
            <i className="bi bi-search"></i>
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <ProductGrid
            products={filtered}
            cart={cart}
            onAddToCart={addToCart}
          />
        </div>

        {/* Right: Cart Panel */}
        <CartPanel
          cart={cart}
          total={total}
          method={method}
          transactions={transactions}
          onUpdateQty={updateQty}
          onSetMethod={setMethod}
          onProcessPayment={processPayment}
        />
      </div>

      {/* Receipt Modal */}
      {receipt && (
        <ReceiptModal
          receipt={receipt}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}