export default function ReservationFilters({ counts, filter, filters, onChange, search = "", onSearchChange }) {
  return (
    <div className="reservations-filter-bar">
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

      <div className="reservations-search">
        <i className="bi bi-search" aria-hidden="true"></i>
        <input
          type="search"
          className="reservations-search-input"
          placeholder="Search name, table, date, or status..."
          aria-label="Search reservations"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
        {search && (
          <button
            type="button"
            className="reservations-search-clear"
            onClick={() => onSearchChange?.("")}
            aria-label="Clear search"
            title="Clear search"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        )}
      </div>
    </div>
  );
}
