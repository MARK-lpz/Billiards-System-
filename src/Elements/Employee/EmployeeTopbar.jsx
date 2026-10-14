const formatClock = (now) => new Date(now).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/**
 * The bar across the top of every employee page: the drawer button (small
 * screens only), the panel and page name, a clock, and the page's icons
 * (bell and menu) passed as children.
 */
export default function EmployeeTopbar({ page, now, navOpen, onToggleNav, children }) {
  return (
    <header className="employee-topbar">
      <button
        type="button"
        className="header-icon-btn employee-nav-toggle"
        onClick={onToggleNav}
        aria-label="Open menu"
        aria-expanded={navOpen}
      >
        <i className="bi bi-list"></i>
      </button>

      <div className="employee-topbar-crumbs">
        <span className="employee-topbar-icon">
          <i className={`bi ${page.icon}`}></i>
        </span>
        <div className="employee-topbar-text">
          <span className="employee-topbar-section">Employee Panel</span>
          <span className="employee-topbar-page">{page.label}</span>
        </div>
      </div>

      <div className="employee-topbar-right">
        <span className="employee-topbar-clock">
          <i className="bi bi-clock" aria-hidden="true"></i>
          {formatClock(now)}
        </span>
        <div className="header-icons">{children}</div>
      </div>
    </header>
  );
}
