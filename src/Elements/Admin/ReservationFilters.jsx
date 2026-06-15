export default function ReservationFilters({ counts, filter, filters, onChange }) {
  return (
    <div className="reservations-filters">
      {filters.map((item) => (
        <button
          key={item}
          className={`reservations-filter-btn ${filter === item ? "active" : ""}`}
          onClick={() => onChange(item)}
        >
          {item} <span className="reservations-filter-count">({counts[item]})</span>
        </button>
      ))}
    </div>
  );
}
