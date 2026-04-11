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
import TodaySchedule from "../../Elements/Admin/Schedule";
import WeeklyPerformance from "../../Elements/Admin/WeeklyPerformance";

// Employee Elements
import EmployeeStats from "../../Elements/Employee/EmployeeStats";
import QuickActions from "../../Elements/Employee/QuickAction";

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

export default function Dashboard({ onLogout, onReload, tables, setTables, logs, theme, setTheme }) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Mock data for modules (replace with actual API calls later)
  const [products, setProducts] = useState([
    { id: 1, name: "Coca Cola", category: "Beverage", price: 25, stock: 50, minStock: 10, unit: "pcs" },
    { id: 2, name: "Chips", category: "Food", price: 15, stock: 30, minStock: 10, unit: "pcs" },
    { id: 3, name: "Cue Chalk", category: "Equipment", price: 50, stock: 20, minStock: 5, unit: "pcs" },
  ]);

  const [transactions, setTransactions] = useState([]);
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

  // Render module based on activeNav
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

            <EmployeeStats />

            <div className="employee-content-grid">
              <div className="employee-left-column">
                <TaskList />
                <ActiveTables tables={tables} onViewPoolTables={() => handleNavChange('pool-tables')} />
              </div>

              <div className="employee-right-column">
                <TodaySchedule />
                <QuickActions />
                <WeeklyPerformance />
              </div>
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