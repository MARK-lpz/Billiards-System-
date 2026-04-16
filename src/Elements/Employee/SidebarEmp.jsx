
import { useEffect, useRef, useState } from 'react';

const navItems = [
  { icon: "bi-speedometer2", label: "Dashboard", id: "dashboard" },
  { icon: "bi-cart", label: "Sales POS", id: "sales" },
  { icon: "bi-clipboard-check", label: "Quick Actions", id: "quick-actions" },
  { icon: "bi-people", label: "Customers", id: "customers" },
];

export default function Sidebar({ activeNav, setActiveNav, onNavChange, onReload }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const logoRef = useRef(null);

  useEffect(() => {
    const img = logoRef.current;
    if (img?.complete) {
      const timer = window.setTimeout(() => setImageLoaded(true), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);

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
        <div className="sidebar-logo-img-container">
          {!imageLoaded && (
            <div className="sidebar-logo-loading">
              <i className="bi bi-arrow-clockwise"></i>
            </div>
          )}
          <img
            ref={logoRef}
            src="/Logo.png"
            alt="Break & Chill"
            className={`sidebar-logo-img ${imageLoaded ? 'loaded' : ''}`}
            onClick={onReload}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)} // Show image even on error
            style={{ cursor: 'pointer' }}
            title="Reload"
          />
        </div>

        <div className="sidebar-logo-text">
          <span className="sidebar-brand">BREAK &amp; CHILL</span>
          <span className="sidebar-sub">Billiard Hall</span>
          <span className="sidebar-sub">Employee Panel </span>  
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