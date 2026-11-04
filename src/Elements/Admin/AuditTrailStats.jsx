// Each card shows its events in the Activity Log below (`filter`, utils/auditReport.js);
// `active` is the filter the log shows now, or null when another view is open.
export default function AuditTrailStats({ counts, active = null, onSelect }) {
  const stats = [
    {
      className: "audit-stat-blue",
      icon: "bi-list-check",
      value: counts.total,
      label: "Overall Transactions",
      filter: "all",
    },
    {
      className: "audit-stat-yellow",
      icon: "bi-people",
      value: counts.customer,
      label: "Customer Transactions",
      filter: "customer",
    },
    {
      className: "audit-stat-green",
      icon: "bi-calendar-check",
      value: counts.reservations,
      label: "Reservation Transactions",
      filter: "reservation",
    },
    {
      className: "audit-stat-red",
      icon: "bi-exclamation-triangle",
      value: counts.issues,
      label: "Issue Reports",
      filter: "issue",
    },
  ];

  return (
    <div className="row g-3 mb-4">
      {stats.map((stat) => {
        const selected = active === stat.filter;
        // A second click on a card goes back to everything.
        const next = selected ? "all" : stat.filter;
        return (
          <div className="col-md-3" key={stat.label}>
            <button
              type="button"
              aria-pressed={selected}
              title={next === "all" ? "Show all activity" : `Show only: ${stat.label.toLowerCase()}`}
              className={`card audit-stat-card audit-stat-clickable ${stat.className} ${selected ? "selected" : ""}`}
              onClick={() => onSelect(next)}
            >
              <div className="card-body">
                <i className={`bi ${stat.icon} audit-stat-icon`}></i>
                <div className="audit-stat-value">{stat.value}</div>
                <div className="audit-stat-label">{stat.label}</div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
