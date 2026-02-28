const navItems = [
  { icon: "bi-speedometer2", label: "Dashboard", id: "dashboard" },
  { icon: "bi-circle", label: "Pool Tables", id: "tables" },
  { icon: "bi-calendar-check", label: "My Reservations", id: "reservations" },
];

export default function Sidebar({ activeNav, setActiveNav }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/Logo.png" alt="Break & Chill" className="sidebar-logo-img" />
        <div className="sidebar-logo-text">
          <span className="sidebar-brand">BREAK &amp; CHILL</span>
          <span className="sidebar-sub">Billiard Hall</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeNav === item.id ? "nav-active" : ""}`}
            onClick={() => setActiveNav(item.id)}
          >
            <i className={`bi ${item.icon} nav-icon`}></i>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}