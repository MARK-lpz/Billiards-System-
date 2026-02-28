export default function StatCards({ stats }) {
  return (
    <div className="stat-cards">
      {["available", "occupied", "reserved"].map((type, i) => (
        <div key={type} className="stat-card">
          <div>
            <p className="stat-label">{type.charAt(0).toUpperCase() + type.slice(1)}</p>
            <p className={`stat-number stat-${["green", "red", "yellow"][i]}`}>
              {stats[type]}
            </p>
          </div>
          <div className={`stat-icon-box stat-icon-${["green", "red", "yellow"][i]}`}>
            <i className="bi bi-circle-fill stat-dot"></i>
          </div>
        </div>
      ))}
    </div>
  );
}