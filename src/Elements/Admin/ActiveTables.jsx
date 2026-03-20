export default function ActiveTables() {
  return (
    <div className="content-card">
      <div className="card-header">
        <h2 className="card-title">Active Tables</h2>
        <span className="badge">8 Active</span>
      </div>
      <div className="active-tables-grid">
        <div className="mini-table-card occupied">
          <span className="table-number">T1</span>
          <span className="table-status">Occupied</span>
        </div>
        <div className="mini-table-card occupied">
          <span className="table-number">T2</span>
          <span className="table-status">Occupied</span>
        </div>
        <div className="mini-table-card available">
          <span className="table-number">T3</span>
          <span className="table-status">Available</span>
        </div>
        <div className="mini-table-card occupied">
          <span className="table-number">T4</span>
          <span className="table-status">Occupied</span>
        </div>
        <div className="mini-table-card reserved">
          <span className="table-number">T5</span>
          <span className="table-status">Reserved</span>
        </div>
        <div className="mini-table-card available">
          <span className="table-number">T6</span>
          <span className="table-status">Available</span>
        </div>
      </div>
    </div>
  );
}