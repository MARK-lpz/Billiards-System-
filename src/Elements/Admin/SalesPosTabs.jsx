export default function SalesPosTabs({ tab, pendingItemsCount, transactionCount, onChange }) {
  return (
    <div className="pos-subtabs">
      <button
        type="button"
        className={`pos-subtab-btn ${tab === "billing" ? "active" : ""}`}
        onClick={() => onChange("billing")}
      >
        Billing Desk
      </button>

      <button
        type="button"
        className={`pos-subtab-btn ${tab === "orders" ? "active" : ""}`}
        onClick={() => onChange("orders")}
      >
        Order Queue ({pendingItemsCount})
      </button>

      <button
        type="button"
        className={`pos-subtab-btn ${tab === "recent" ? "active" : ""}`}
        onClick={() => onChange("recent")}
      >
        Transaction History ({transactionCount})
      </button>
    </div>
  );
}
