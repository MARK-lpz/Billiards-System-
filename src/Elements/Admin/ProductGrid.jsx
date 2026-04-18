export default function ProductGrid({ products, cart, onAddToCart }) {
  const getCategoryColor = (category) => {
    const colors = {
      Beverage: "#60a5fa",
      Food: "#10b981",
      Equipment: "#fbbf24",
    };
    return colors[category] || "#9ca3af";
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
        const categoryColor = getCategoryColor(product.category);
        const lowStock = product.stock <= 5;

        return (
          <div
            key={product.id}
            className={`product-card ${inCart ? "in-cart" : ""} ${lowStock ? "low-stock" : ""}`}
            onClick={() => onAddToCart(product)}
          >
            {inCart && <div className="product-cart-badge">{inCart.qty}</div>}

            <div
              className="product-category"
              style={{
                backgroundColor: `${categoryColor}15`,
                color: categoryColor,
              }}
            >
              {product.category}
            </div>

            <div className="product-name">{product.name}</div>
            <div className="product-price">₱{Number(product.price).toFixed(2)}</div>

            <div className="product-stock">
              <i className="bi bi-box me-1"></i>
              Stock: {product.stock} {product.unit}
            </div>

            {lowStock && <div className="product-low-badge">Low Stock</div>}
          </div>
        );
      })}
    </div>
  );
}
