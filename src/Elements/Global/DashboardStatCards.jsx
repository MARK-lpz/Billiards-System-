/**
 * A row of number cards under a dashboard's title band, one card per stat
 * ({ id, page, icon, tone, value, label, note, title? }). Each opens its page
 * (`onOpen(id)`). Used by the admin and the employee dashboards alike.
 * With `activeId`, the cards pick what shows under them instead (the
 * employee's Stock Alarm): the picked one is pressed.
 */
export default function DashboardStatCards({ stats = [], label, onOpen, activeId }) {
  const picking = activeId !== undefined;
  return (
    <section className="dash-stats" aria-label={label}>
      {stats.map((stat) => (
        <button
          key={stat.id}
          type="button"
          className={`dash-stat tone-${stat.tone}${picking && stat.page.id === activeId ? " is-active" : ""}`}
          onClick={() => onOpen?.(stat.page.id)}
          title={stat.title || `Open ${stat.page.label}`}
          aria-pressed={picking ? stat.page.id === activeId : undefined}
        >
          <span className="dash-stat-icon" aria-hidden="true">
            <i className={`bi ${stat.icon}`}></i>
          </span>
          <span className="dash-stat-text">
            <span className="dash-stat-label">{stat.label}</span>
            <strong className="dash-stat-value">{stat.value}</strong>
            <span className="dash-stat-note">{stat.note}</span>
          </span>
        </button>
      ))}
    </section>
  );
}
