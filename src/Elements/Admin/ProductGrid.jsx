export default function ProductGrid({ products, cart, onAddToCart }) {
  const getCategoryColor = (category) => {
    const colors = {
      Beverage: '#60a5fa',
      Food: '#10b981',
      Equipment: '#fbbf24'
    };
    return colors[category] || '#9ca3af';
  };

  return (
    <div className="product-grid">
      {products.map(p => {
        const inCart = cart.find(i => i.id === p.id);
        const categoryColor = getCategoryColor(p.category);

        return (
          <div
            key={p.id}
            className={`product-card ${inCart ? 'in-cart' : ''}`}
            onClick={() => onAddToCart(p)}
          >
            {inCart && (
              <div className="product-cart-badge">{inCart.qty}</div>
            )}

            <div
              className="product-category"
              style={{
                backgroundColor: `${categoryColor}15`,
                color: categoryColor
              }}
            >
              {p.category}
            </div>

            <div className="product-name">{p.name}</div>
            <div className="product-price">₱{p.price}</div>
            <div className="product-stock">
              <i className="bi bi-box me-1"></i>
              Stock: {p.stock} {p.unit}
            </div>
          </div>
        );
      })}
    </div>
  );
}