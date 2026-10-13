export default function ProductGrid({ products, cart, onAddToCart }) {
  // Each category's color on the navy theme, and the deeper shade of it that the
  // light theme uses for the text (the pale one is too faint on white).
  const getCategoryColor = (category) => {
    const colors = {
      Beverage: ["#60a5fa", "#1d4ed8"],
      Food: ["#10b981", "#065f46"],
      Equipment: ["#fbbf24", "#b45309"],
    };
    return colors[category] || ["#9ca3af", "#475569"];
  };

  if (!products.length) {
    return (
      <div className="product-grid">
        <div className="product-card product-card-empty">
          <div className="product-name">No products found</div>
          <div className="product-stock">Try a different search or category.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => {
        const inCart = cart.find((item) => item.id === product.id);
        const [categoryColor, categoryInk] = getCategoryColor(product.category);
        const stockLeft = Number(product.stock) || 0;
        const minStock = Number(product.minStock) > 0 ? Number(product.minStock) : 5;
        const outOfStock = stockLeft <= 0;
        const lowStock = !outOfStock && stockLeft <= minStock;

        return (
          <div
            key={product.id}
            className={`product-card ${inCart ? "in-cart" : ""} ${
              outOfStock ? "out-of-stock" : lowStock ? "low-stock" : ""
            }`}
            onClick={() => onAddToCart(product)}
            aria-disabled={outOfStock}
            title={outOfStock ? `${product.name} is out of stock. Restock it in Inventory.` : undefined}
          >
            {inCart && <div className="product-cart-badge">{inCart.qty}</div>}

            <div
              className="product-category"
              style={{
                backgroundColor: `${categoryColor}15`,
                "--category-color": categoryColor,
                "--category-ink": categoryInk,
              }}
            >
              {product.category}
            </div>

            <div className="product-name">{product.name}</div>
            <div className="product-price">₱{Number(product.price).toFixed(2)}</div>

            <div className={`product-stock ${outOfStock ? "is-out" : lowStock ? "is-low" : ""}`}>
              <i
                className={`bi ${
                  outOfStock ? "bi-x-circle-fill" : lowStock ? "bi-exclamation-triangle-fill" : "bi-box"
                } me-1`}
              ></i>
              Stock: {stockLeft} pcs
            </div>

            {outOfStock ? (
              <div className="product-out-badge">Out of Stock</div>
            ) : lowStock ? (
              <div className="product-low-badge">Low Stock</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
