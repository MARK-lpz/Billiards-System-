import { useState } from "react";
import "./styles/Dashboard.css";

const initialTables = [
  { id: 1, status: "available", rate: 15, timer: null },
  { id: 2, status: "occupied", rate: 15, timer: "45 min" },
  { id: 3, status: "available", rate: 15, timer: null },
  { id: 4, status: "reserved", rate: 15, timer: null },
  { id: 5, status: "available", rate: 15, timer: null },
  { id: 6, status: "occupied", rate: 15, timer: "1h 20min" },
  { id: 7, status: "available", rate: 15, timer: null },
  { id: 8, status: "available", rate: 15, timer: null },
  { id: 9, status: "occupied", rate: 15, timer: "30 min" },
  { id: 10, status: "available", rate: 15, timer: null },
  { id: 11, status: "reserved", rate: 15, timer: null },
  { id: 12, status: "available", rate: 15, timer: null },
];

const navItems = [
  { icon: "bi-speedometer2", label: "Dashboard", id: "dashboard" },
  { icon: "bi-circle", label: "Pool Tables", id: "tables" },
  { icon: "bi-calendar-check", label: "My Reservations", id: "reservations" },
  { icon: "bi-currency-dollar", label: "Pricing", id: "pricing" },
  { icon: "bi-person", label: "Profile", id: "profile" },
];

export default function Dashboard({ onLogout }) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [tables, setTables] = useState(initialTables);

  const available = tables.filter((t) => t.status === "available").length;
  const occupied = tables.filter((t) => t.status === "occupied").length;
  const reserved = tables.filter((t) => t.status === "reserved").length;

  const filtered = tables.filter((t) => {
    const q = search.toLowerCase();
    return `table ${t.id}`.includes(q) || t.status.includes(q);
  });

  const handleReserve = (id) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === id && t.status === "available" ? { ...t, status: "reserved" } : t
      )
    );
  };

  const handleWalkIn = (id) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === id && t.status === "available"
          ? { ...t, status: "occupied", timer: "0 min" }
          : t
      )
    );
  };

  const getStatusClass = (status) => {
    if (status === "available") return "status-available";
    if (status === "occupied") return "status-occupied";
    return "status-reserved";
  };

  const getCardClass = (status) => {
    if (status === "available") return "table-card card-available";
    if (status === "occupied") return "table-card card-occupied";
    return "table-card card-reserved";
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
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

        <button className="logout-btn" onClick={onLogout}>
          <i className="bi bi-box-arrow-right logout-icon"></i>
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Find and reserve your perfect table</p>
        </div>

        {/* Stat Cards */}
        <div className="stat-cards">
          <div className="stat-card">
            <div>
              <p className="stat-label">Available</p>
              <p className="stat-number stat-green">{available}</p>
            </div>
            <div className="stat-icon-box stat-icon-green">
              <i className="bi bi-circle-fill stat-dot"></i>
            </div>
          </div>

          <div className="stat-card">
            <div>
              <p className="stat-label">Occupied</p>
              <p className="stat-number stat-red">{occupied}</p>
            </div>
            <div className="stat-icon-box stat-icon-red">
              <i className="bi bi-circle-fill stat-dot"></i>
            </div>
          </div>

          <div className="stat-card">
            <div>
              <p className="stat-label">Reserved</p>
              <p className="stat-number stat-yellow">{reserved}</p>
            </div>
            <div className="stat-icon-box stat-icon-yellow">
              <i className="bi bi-circle-fill stat-dot"></i>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="search-wrapper">
          <i className="bi bi-search search-icon"></i>
          <input
            type="text"
            className="search-input"
            placeholder="Search tables or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tables Grid */}
        <h2 className="section-title">Available Pool Tables</h2>
        <div className="tables-grid">
          {filtered.map((table) => (
            <div key={table.id} className={getCardClass(table.status)}>
              <div className="table-card-header">
                <h3 className="table-name">Table {table.id}</h3>
                <div className="table-rate-wrapper">
                  <i className="bi bi-currency-dollar rate-icon"></i>
                  <span className="table-rate">${table.rate}/hr</span>
                  {table.timer && (
                    <span className="table-timer">
                      <i className="bi bi-clock timer-icon"></i>
                      {table.timer}
                    </span>
                  )}
                </div>
              </div>

              <div className="table-status-row">
                <span className={`status-badge ${getStatusClass(table.status)}`}>
                  <i className="bi bi-circle-fill status-dot"></i>
                  {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                </span>
              </div>

              <div className="table-actions">
                <button
                  className={`btn-reserve ${table.status !== "available" ? "btn-disabled" : ""}`}
                  onClick={() => handleReserve(table.id)}
                  disabled={table.status !== "available"}
                >
                  Reserve
                </button>
                <button
                  className={`btn-walkin ${table.status !== "available" ? "btn-disabled" : ""}`}
                  onClick={() => handleWalkIn(table.id)}
                  disabled={table.status !== "available"}
                >
                  Walk-in
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}