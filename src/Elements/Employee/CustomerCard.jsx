import { fmt, LOYALTY_TIERS } from "./constants.js";

export default function CustomerCard({ customer, onClick, onDelete }) {
  const tier =
    LOYALTY_TIERS.slice().reverse().find((t) => customer.visits >= t.minVisits) ||
    LOYALTY_TIERS[0];

  return (
    <div className="cust-card" onClick={() => onClick(customer)}>
      <button
        type="button"
        className="cust-remove-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(customer.id);
        }}
        aria-label={`Remove ${customer.name}`}
      >
        <i className="bi bi-x-lg"></i>
      </button>

      <div className="cust-card-top">
        <div className="cust-avatar">{customer.name.charAt(0)}</div>

        <div className="cust-main-info">
          <div className="cust-name">{customer.name}</div>
          <div className="cust-phone">{customer.phone}</div>
        </div>

        <div
          className="cust-tier-badge"
          style={{
            background: tier.bg,
            color: tier.color,
            border: `1px solid ${tier.color}40`,
          }}
        >
          {tier.tier}
        </div>
      </div>

      <div className="cust-card-stats">
        <div className="cust-stat">
          <div className="cust-stat-val" style={{ color: "var(--blue)" }}>
            {customer.visits}
          </div>
          <div className="cust-stat-lbl">Visits</div>
        </div>

        <div className="cust-stat">
          <div className="cust-stat-val" style={{ color: "var(--green)" }}>
            {fmt(customer.totalSpent)}
          </div>
          <div className="cust-stat-lbl">Total Spent</div>
        </div>

        <div className="cust-stat">
          <div className="cust-stat-val" style={{ color: "var(--muted)" }}>
            {fmt(customer.totalSpent / Math.max(customer.visits, 1))}
          </div>
          <div className="cust-stat-lbl">Avg/Visit</div>
        </div>
      </div>

      <div className="cust-last-visit">Last visit: {customer.lastVisit}</div>

      {customer.notes && <div className="cust-notes">{customer.notes}</div>}
    </div>
  );
}