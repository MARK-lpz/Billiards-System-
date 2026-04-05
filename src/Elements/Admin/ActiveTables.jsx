export default function ActiveTables({ tables = [], onViewPoolTables }) {
  const activeCount = tables.filter((t) => t.status === "occupied").length;
  const reservedCount = tables.filter((t) => t.status === "reserved").length;
  const availableCount = tables.filter((t) => t.status === "available").length;

  return (
    <div
      className="content-card active-tables-card"
      role="button"
      tabIndex={0}
      onClick={onViewPoolTables}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onViewPoolTables?.();
        }
      }}
    >
      <div className="card-header active-tables-header">
        <h2 className="card-title">Active Tables</h2>
        <span className="badge">{activeCount} Active</span>
      </div>
      <div className="active-tables-grid">
        {tables.slice(0, 6).map((table) => (
          <div key={table.id} className={`mini-table-card ${table.status}`}>
            <span className="table-number">{table.name || `T${table.id}`}</span>
            <span className="table-status">
              {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
            </span>
          </div>
        ))}
      </div>
      <div className="active-table-summary" style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <span>{availableCount} Available</span>
        <span>{activeCount} Occupied</span>
        <span>{reservedCount} Reserved</span>
      </div>
    </div>
  );
}