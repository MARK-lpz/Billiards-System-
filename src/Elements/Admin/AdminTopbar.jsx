const formatClock = (now) => new Date(now).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/**
 * The bar across the top of every admin page: the drawer button (small
 * screens only), the panel and page name, a clock, and the page's icons
 * (bell and menu) passed as children.
 */
export default function AdminTopbar({ page, now, navOpen, onToggleNav, children }) {
  return (
    <header className="admin-topbar">
      <button
        type="button"
        className="header-icon-btn admin-nav-toggle"
        onClick={onToggleNav}
        aria-label="Open menu"
        aria-expanded={navOpen}
      >
        <i className="bi bi-list"></i>
      </button>

      <div className="admin-topbar-crumbs">
        <span className="admin-topbar-icon">
          <i className={`bi ${page.icon}`}></i>
        </span>
        <div className="admin-topbar-text">
          <span className="admin-topbar-section">Admin Panel</span>
          <span className="admin-topbar-page">{page.label}</span>
        </div>
      </div>

      <div className="admin-topbar-right">
        <span className="admin-topbar-clock">
          <i className="bi bi-clock" aria-hidden="true"></i>
          {formatClock(now)}
        </span>
        <div className="header-icons">{children}</div>
      </div>
    </header>
  );
}
