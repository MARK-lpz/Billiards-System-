// ReservationStats.jsx
export default function ReservationStats({ summary }) {
  return (
    <div className="rd-stats-row">
      {[
        [summary.walkIns, "green", "Active Walk-Ins"],
        [summary.reserved, "yellow", "Reserved Today"],
        [summary.assigned, "blue", "Assigned Tables"],
        [summary.openTables, "muted", "Open Tables"],
      ].map(([value, tone, label]) => (
        <div key={label} className="rd-stat-card">
          <div className={`rd-stat-value rd-stat-value--${tone}`}>{value}</div>
          <div className="rd-stat-label">{label}</div>
        </div>
      ))}
    </div>
  );
}
