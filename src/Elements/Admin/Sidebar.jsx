import { useEffect, useRef, useState } from 'react';
import { navItems } from "./adminNav";

export default function Sidebar({ activeNav, setActiveNav, onNavChange, onReload, collapsed = false, onToggleCollapsed }) {
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
    <aside className="sidebar admin-sidebar">
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
          <span className="sidebar-sub">Admin Panel </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeNav === item.id ? "nav-active" : ""}`}
            onClick={() => handleNavClick(item.id)}
            title={collapsed ? item.label : undefined}
            aria-current={activeNav === item.id ? "page" : undefined}
          >
            <i className={`bi ${item.icon} nav-icon`}></i>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {onToggleCollapsed && (
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          title={collapsed ? "Expand menu" : "Collapse menu"}
        >
          <i className={`bi ${collapsed ? "bi-chevron-double-right" : "bi-chevron-double-left"}`}></i>
          <span className="nav-label">Collapse</span>
        </button>
      )}
    </aside>
  );
}
