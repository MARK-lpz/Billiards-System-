import { useState } from "react";

// Styles
import "../../styles/Admin/Dashboard.css";

// Global Elements
import LoadingBar from "../../Elements/Global/Loading";
import Notification from "../../Elements/Global/Notification";
import Menu from "../../Elements/Global/Menu";

// Admin Elements
import Sidebar from "../../Elements/Admin/Sidebar";
import TaskList from "../../Elements/Admin/TaskList";
import ActiveTables from "../../Elements/Admin/ActiveTables";

// Employee Elements
import EmployeeStats from "../../Elements/Employee/EmployeeStats";

// Admin Modules (Pages)
import QRGenerator from "./QrGenerator";
import SalesPOS from "./SalesPOS";
import Reservations from "./Reservations";
import Reports from "./Reports";
import PoolTables from "./PoolTables";
import Inventory from "./Inventory";
import Events from "./Events";
import Equipment from "./Equipment";
import AuditTrail from "./AuditTrail";

export default function Dashboard({ onLogout, onReload, tables, setTables, logs, products, setProducts, transactions, setTransactions, theme, setTheme }) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [reservations, setReservations] = useState([]);
  const [events, setEvents] = useState([]);
  const [equipment, setEquipment] = useState([
    { id: 1, name: "Cue Stick #1", type: "Cue Stick", condition: "good", lastMaintenance: "2026-03-01", status: "active" },
    { id: 2, name: "Ball Set #1", type: "Ball Set", condition: "fair", lastMaintenance: "2026-02-15", status: "active" },
  ]);

  const handleReload = () => {
    setLoading(true);
    if (onReload) onReload();
    setTimeout(() => setLoading(false), 300);
  };

  const handleNavChange = (navId) => {
    setLoading(true);
    setTimeout(() => {
      setActiveNav(navId);
      setLoading(false);
    }, 300);
  };

  const renderModule = () => {
    switch(activeNav) {
      case 'qr-generator':
        return <QRGenerator />;
      
      case 'sales-pos':
        return <SalesPOS 
          products={products} 
          setProducts={setProducts}
          transactions={transactions}
          setTransactions={setTransactions}
        />;
      
      case 'reservations':
        return <Reservations 
          reservations={reservations}
          setReservations={setReservations}
          tables={tables}
        />;
      
      case 'reports':
        return <Reports 
          transactions={transactions}
          reservations={reservations}
          products={products}
        />;
      
      case 'pool-tables':
        return <PoolTables 
          tables={tables}
          setTables={setTables}
        />;
      
      case 'inventory':
        return <Inventory 
          products={products}
          setProducts={setProducts}
        />;
      
      case 'events':
        return <Events 
          events={events}
          setEvents={setEvents}
          tables={tables}
        />;
      
      case 'equipment':
        return <Equipment 
          equipment={equipment}
          setEquipment={setEquipment}
        />;
      
      case 'audit-trail':
        return <AuditTrail logs={logs} />;
      
      case 'dashboard':
      default:
        return (
          <>
            <div className="page-header">
              <div className="page-header-text">
                <h1 className="page-title">Admin Dashboard</h1>
                <p className="page-subtitle">Welcome back! Manage your business operations</p>
              </div>
              
              <div className="header-right">
                <div className="search-wrapper">
                  <i className="bi bi-search search-icon"></i>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search tasks or tables..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="header-icons">
                  <button
                    type="button"
                    className="theme-toggle-btn"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  <Notification />
                  <Menu 
                    onLogout={onLogout}
                    onProfile={() => handleNavChange('profile')}
                  />
                </div>
              </div>
            </div>

            {/* Stats — full width */}
            <EmployeeStats />

            {/* Main grid — 50/50 equal columns */}
            <div className="admin-dashboard-grid">
              <ActiveTables tables={tables} onViewPoolTables={() => handleNavChange('pool-tables')} />
              <TaskList />
            </div>
          </>
        );
    }
  };

  return (
    <>
      <LoadingBar loading={loading} />
      <div className="dashboard-layout">
        <Sidebar 
          activeNav={activeNav} 
          setActiveNav={setActiveNav}
          onNavChange={handleNavChange}
          onReload={handleReload}
        />

        <main className="main-content">
          {renderModule()}
        </main>
      </div>
    </>
  );
}