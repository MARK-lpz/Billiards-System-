import { useState, useEffect } from "react";
import "../../styles/Employee/Employeedashboard.css";
import Sidebar from "../../Elements/Employee/SidebarEmp";
import StatCards from "../../Elements/Global/StatCards";
import TableCard from "../../Elements/Global/TableCard";
import Notification from "../../Elements/Global/Notification";
import LoadingBar from "../../Elements/Global/Loading";
import Menu from "../../Elements/Global/Menu";
import CustomerManagement from "./CustomerManagement";
import QuickActions from "./QuickAction";
import SalesPOS from "./SalesPos";


export default function EmployeeDashboard({
  onLogout,
  onReload,
  tables,
  setTables,
  setLogs,
  products,
  setProducts,
  transactions,
  setTransactions,
  theme,
  setTheme,
  customers,
  setCustomers,
}) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [timers, setTimers] = useState({});
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    const interval = setInterval(() => {
      const newTimers = {};
      tables.forEach((t) => {
        if (t.status === "occupied" && t.startTime) {
          const elapsed = Date.now() - t.startTime;
          const h = Math.floor(elapsed / 3600000);
          const m = Math.floor((elapsed % 3600000) / 60000);
          newTimers[t.id] = h > 0 ? `${h}h ${m}min` : `${m} min`;
        }
      });
      setTimers(newTimers);
    }, 1000);
    return () => clearInterval(interval);
  }, [tables]);

  const stats = {
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    reserved: tables.filter((t) => t.status === "reserved").length,
  };

  const filtered = tables.filter((t) =>
    `table ${t.id} ${t.status}`.toLowerCase().includes(search.toLowerCase())
  );

  const getTableLabel = (table) => table?.name || `T${table?.id}`;

  const addLog = (entry) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "table",
        staff: "Employee",
        ...entry,
      },
    ]);
  };

  const updateTable = (id, updates) =>
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

  const handleReserve = (id) => {
    const table = tables.find((t) => t.id === id);
    updateTable(id, { status: "reserved", startTime: null });
    if (table) addLog({ action: "Reserved table", detail: `${getTableLabel(table)} reserved by employee` });
  };

  const handleWalkIn = (id) => {
    const table = tables.find((t) => t.id === id);
    updateTable(id, { status: "occupied", startTime: Date.now(), customer: "Walk-in Customer" });
    if (table) addLog({ action: "Started walk-in session", detail: `Walk-in started for ${getTableLabel(table)}` });
  };

  const handleEndSession = (id) => {
    const table = tables.find((t) => t.id === id);
    if (table?.startTime) {
      const hours = Math.ceil((Date.now() - table.startTime) / 3600000);
      const cost = hours * table.rate;
      if (window.confirm(`Session: ${timers[id]}\nTotal: $${cost}\n\nEnd session?`)) {
        updateTable(id, { status: "available", startTime: null, customer: "" });
        if (table) addLog({ action: "Ended session", detail: `Ended session for ${getTableLabel(table)} (₱${cost})` });
      }
    }
  };

  const handleCancel = (id) => {
    const table = tables.find((t) => t.id === id);
    if (window.confirm("Cancel reservation?")) {
      updateTable(id, { status: "available", startTime: null, customer: "" });
      if (table) addLog({ action: "Cancelled reservation", detail: `Cancelled reservation for ${getTableLabel(table)}` });
    }
  };

  const renderModule = () => {
    switch (activeNav) {
      case "sales":
        return (
          <SalesPOS
            products={products}
            setProducts={setProducts}
            transactions={transactions}
            setTransactions={setTransactions}
          />
        );

      case "customers":
        return (
          <CustomerManagement
            customers={customers}
            setCustomers={setCustomers}
          />
        );

      case "quick-actions":
        return <QuickActions tables={tables} />;

      case "dashboard":
      default:
        return (
          <>
            <StatCards stats={stats} />
            <h2 className="section-title">Pool Tables</h2>
            <div className="tables-grid">
              {filtered.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  timer={timers[table.id]}
                  onReserve={handleReserve}
                  onWalkIn={handleWalkIn}
                  onEndSession={handleEndSession}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          </>
        );
    }
  };

  const selfHeaded = ["sales", "quick-actions", "customers"];

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
          {!selfHeaded.includes(activeNav) && (
            <div className="page-header">
              <div className="page-header-text">
                <h1 className="page-title">Employee Dashboard</h1>
                <p className="page-subtitle">Welcome back! Manage tables and assist customers</p>
              </div>

              <div className="header-right">
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

                <div className="header-icons">
                  <button
                    type="button"
                    className="theme-toggle-btn"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </button>
                  <Notification />
                  <Menu
                    onLogout={onLogout}
                    onProfile={() => handleNavChange("profile")}
                  />
                </div>
              </div>
            </div>
          )}

          {renderModule()}
        </main>
      </div>
    </>
  );
}