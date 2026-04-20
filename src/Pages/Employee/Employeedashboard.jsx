import { useState, useEffect } from "react";
import "../../styles/Employee/Employeedashboard.css";
import Sidebar from "../../Elements/Employee/SidebarEmp";
import StatCards from "../../Elements/Global/StatCards";
import TableCard from "../../Elements/Global/TableCard";
import Notification from "../../Elements/Global/Notification";
import LoadingBar from "../../Elements/Global/Loading";
import Menu from "../../Elements/Global/Menu";
import TournamentSchedule from "./TournamentSchedule";
import QuickActions from "./QuickAction";
import SalesPOS from "./SalesPos";
import ReservationDesk from "./ReservationDesk";
import { appendAuditLog } from "../../utils/audit";


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
  reservations,
  setReservations,
  events,
  theme,
  setTheme,
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
    appendAuditLog(setLogs, {
      type: "table",
      staff: "Employee",
      entity: "table",
      ...entry,
    });
  };

  const updateTable = (id, updates) =>
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

  const handleWalkIn = (id) => {
    const table = tables.find((t) => t.id === id);
    updateTable(id, { status: "occupied", startTime: Date.now(), customer: "Walk-in Customer" });
    if (table) {
      addLog({
        action: "Started walk-in session",
        detail: `Walk-in started for ${getTableLabel(table)}`,
        customer: {
          previous: table.customer ? { name: table.customer } : null,
          current: { name: "Walk-in Customer" },
        },
        table: {
          id: table.id,
          name: getTableLabel(table),
          previousStatus: table.status,
          currentStatus: "occupied",
        },
      });
    }
  };

  const handleEndSession = (id) => {
    const table = tables.find((t) => t.id === id);
    if (table?.startTime) {
      const hours = Math.ceil((Date.now() - table.startTime) / 3600000);
      const cost = hours * table.rate;
      if (window.confirm(`Session: ${timers[id]}\nTotal: ₱${cost}\n\nEnd session?`)) {
        updateTable(id, { status: "available", startTime: null, customer: "" });
        if (table) {
          addLog({
            action: "Ended session",
            detail: `Ended session for ${getTableLabel(table)} (₱${cost})`,
            customer: {
              previous: table.customer ? { name: table.customer } : null,
              current: null,
            },
            table: {
              id: table.id,
              name: getTableLabel(table),
              previousStatus: table.status,
              currentStatus: "available",
            },
            payment: {
              total: cost,
              source: "table-session",
            },
          });
        }
      }
    }
  };

  const handleCancel = (id) => {
    const table = tables.find((t) => t.id === id);
    if (window.confirm("Cancel reservation?")) {
      updateTable(id, { status: "available", startTime: null, customer: "" });
      if (table) {
        addLog({
          action: "Cancelled reservation",
          detail: `Cancelled reservation for ${getTableLabel(table)}`,
          customer: {
            previous: table.customer ? { name: table.customer } : null,
            current: null,
          },
          table: {
            id: table.id,
            name: getTableLabel(table),
            previousStatus: table.status,
            currentStatus: "available",
          },
        });
      }
    }
  };

  const renderModule = () => {
    switch (activeNav) {
      case "sales":
        return (
          <SalesPOS
            tables={tables}
            products={products}
            setProducts={setProducts}
            transactions={transactions}
            setTransactions={setTransactions}
            setLogs={setLogs}
          />
        );

      case "tournaments":
        return <TournamentSchedule events={events} tables={tables} />;

      case "reservations":
        return (
          <ReservationDesk
            tables={tables}
            setTables={setTables}
            reservations={reservations}
            setReservations={setReservations}
            setLogs={setLogs}
          />
        );

      case "quick-actions":
        return <QuickActions tables={tables} setTables={setTables} setLogs={setLogs} />;

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

  const selfHeaded = ["sales", "quick-actions", "reservations"];

  const pageMeta = {
    dashboard: {
      title: "Employee Dashboard",
      subtitle: "Welcome back! Manage tables and assist customers",
    },
    tournaments: {
      title: "Tournament Schedule",
      subtitle: "View tournaments and events created from the admin side",
    },
  };

  const currentPage = pageMeta[activeNav] || pageMeta.dashboard;

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
                <h1 className="page-title">{currentPage.title}</h1>
                <p className="page-subtitle">{currentPage.subtitle}</p>
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
