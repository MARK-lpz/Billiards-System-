export default function PoolTableStats({ stats }) {
  return (
    <div className="pool-table-stats">
      <div className="pool-stat-pill pool-stat-green">
        <div className="pool-stat-dot"></div>
        <div className="pool-stat-value">{stats.available}</div>
        <div className="pool-stat-label">Available</div>
      </div>
      <div className="pool-stat-pill pool-stat-red">
        <div className="pool-stat-dot"></div>
        <div className="pool-stat-value">{stats.occupied}</div>
        <div className="pool-stat-label">Occupied</div>
      </div>
      <div className="pool-stat-pill pool-stat-yellow">
        <div className="pool-stat-dot"></div>
        <div className="pool-stat-value">{stats.reserved}</div>
        <div className="pool-stat-label">Reserved</div>
      </div>
    </div>
  );
}