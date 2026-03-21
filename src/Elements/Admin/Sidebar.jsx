const navItems = [
  { icon: "bi-speedometer2", label: "Dashboard", id: "dashboard" },
  { icon: "bi-circle", label: "Pool Tables", id: "pool-tables" },
  { icon: "bi-calendar-check", label: "Reservations", id: "reservations" },
  { icon: "bi-cart", label: "Sales / POS", id: "sales-pos" },
  { icon: "bi-box", label: "Inventory", id: "inventory" },
  { icon: "bi-trophy", label: "Events", id: "events" },
  { icon: "bi-tools", label: "Equipment", id: "equipment" },
  { icon: "bi-file-text", label: "Reports", id: "reports" },
  { icon: "bi-list-check", label: "Audit Trail", id: "audit-trail" },
  { icon: "bi-qr-code", label: "QR Generator", id: "qr-generator" },
];

export default function Sidebar({ activeNav, setActiveNav, onNavChange }) {
  const handleNavClick = (id) => {
    if (onNavChange) {
      onNavChange(id);
    } else {
      setActiveNav(id);
    }
  };

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
            onClick={() => handleNavClick(item.id)}
          >
            <i className={`bi ${item.icon} nav-icon`}></i>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}