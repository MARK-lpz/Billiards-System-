export default function AuditTrailStats({ counts }) {
  const stats = [
    {
      className: "audit-stat-blue",
      icon: "bi-list-check",
      value: counts.total,
      label: "Total Events",
    },
    {
      className: "audit-stat-yellow",
      icon: "bi-people",
      value: counts.customer,
      label: "Customer Changes",
    },
    {
      className: "audit-stat-green",
      icon: "bi-calendar-check",
      value: counts.reservations,
      label: "Reservation Events",
    },
    {
      className: "audit-stat-red",
      icon: "bi-exclamation-triangle",
      value: counts.issues,
      label: "Issue Reports",
    },
  ];

  return (
    <div className="row g-3 mb-4">
      {stats.map((stat) => (
        <div className="col-md-3" key={stat.label}>
          <div className={`card audit-stat-card ${stat.className}`}>
            <div className="card-body">
              <i className={`bi ${stat.icon} audit-stat-icon`}></i>
              <div className="audit-stat-value">{stat.value}</div>
              <div className="audit-stat-label">{stat.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
