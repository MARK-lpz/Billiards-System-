import "../../styles/Admin/PoolTables.css";

export default function PoolTableStats({ stats, activeStatus, onFilterChange }) {
  const toggleFilter = (status) => {
    onFilterChange?.(activeStatus === status ? "all" : status);
  };

  return (
    <div className="pool-table-stats">
      <button
        type="button"
        className={`pool-stat-pill pool-stat-blue ${activeStatus === "all" ? "is-active" : ""}`}
        onClick={() => onFilterChange?.("all")}
        aria-pressed={activeStatus === "all"}
      >
        <div className="pool-stat-dot"></div>
        <div className="pool-stat-value">{stats.total}</div>
        <div className="pool-stat-label">All</div>
      </button>
      <button
        type="button"
        className={`pool-stat-pill pool-stat-green ${activeStatus === "available" ? "is-active" : ""}`}
        onClick={() => toggleFilter("available")}
        aria-pressed={activeStatus === "available"}
      >
        <div className="pool-stat-dot"></div>
        <div className="pool-stat-value">{stats.available}</div>
        <div className="pool-stat-label">Available</div>
      </button>
      <button
        type="button"
        className={`pool-stat-pill pool-stat-red ${activeStatus === "occupied" ? "is-active" : ""}`}
        onClick={() => toggleFilter("occupied")}
        aria-pressed={activeStatus === "occupied"}
      >
        <div className="pool-stat-dot"></div>
        <div className="pool-stat-value">{stats.occupied}</div>
        <div className="pool-stat-label">Occupied</div>
      </button>
      <button
        type="button"
        className={`pool-stat-pill pool-stat-yellow ${activeStatus === "reserved" ? "is-active" : ""}`}
        onClick={() => toggleFilter("reserved")}
        aria-pressed={activeStatus === "reserved"}
      >
        <div className="pool-stat-dot"></div>
        <div className="pool-stat-value">{stats.reserved}</div>
        <div className="pool-stat-label">Reserved</div>
      </button>
    </div>
  );
}
