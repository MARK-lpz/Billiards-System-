import { useState, useEffect } from "react";
import "../../styles/Employee/Employeedashboard.css";
import Sidebar from "../../Elements/Employee/SidebarEmp";
import PoolTableStats from "../../Elements/Admin/PoolTableStats";
import PoolTableCard from "../../Elements/Admin/PoolTableCards";
import Notification from "../../Elements/Global/Notification";
import LoadingBar from "../../Elements/Global/Loading";
import Menu from "../../Elements/Global/Menu";
import TournamentSchedule from "./TournamentSchedule";
import QuickActions from "./QuickAction";
import SalesPOS from "./SalesPos";
import ReservationDesk from "./ReservationDesk";
import { appendAuditLog } from "../../utils/audit";
import { useNotifications } from "../../Elements/Global/useNotifications";

const getCurrentTimestamp = () => Date.now();

export default function EmployeeDashboard({
  onLogout,
  onReload,
  tables,
  setTables,
  setLogs,
  products,
  setProducts,
  equipment,
  setEquipment,
  transactions,
  setTransactions,
  reservations,
  setReservations,
  events,
  theme,
  setTheme,
}) {
  const { addNotification, queueAdminNotification } = useNotifications();
  // Must match a sidebar nav id, otherwise nothing is highlighted on load and
  // the page header has no entry to read its title from.
  const [activeNav, setActiveNav] = useState("Pool Tables");
  const [search, setSearch] = useState("");
  const [timers, setTimers] = useState({});
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

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
          const durationMs = Number(t.durationMinutes || 60) * 60000;
          const rawElapsed = Math.max(0, getCurrentTimestamp() - t.startTime);
          const elapsed = Math.min(rawElapsed, durationMs);
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
    total: tables.length,
  };

  const filtered = [...tables].filter((table) => {
    const matchesSearch = `table ${table.id} ${table.status}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || table.status === statusFilter;

    return matchesSearch && matchesStatus;
  }).sort((left, right) => Number(left.id) - Number(right.id));

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
    updateTable(id, {
      status: "occupied",
      startTime: getCurrentTimestamp(),
      customer: "Walk-in Customer",
      durationMinutes: Number(table?.durationMinutes || 60),
      addedMinutes: 0,
    });
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
      addNotification({ message: `Walk-in session started for ${getTableLabel(table)}.` });
    }
  };

  const handleEndSession = (id) => {
    const table = tables.find((t) => t.id === id);
    if (table?.startTime) {
      const elapsed = Math.min(
        getCurrentTimestamp() - table.startTime,
        Number(table.durationMinutes || 60) * 60000
      );
      const hours = Math.ceil(elapsed / 3600000);
      const cost = hours * table.rate;
      if (window.confirm(`Session: ${timers[id]}\nTotal: ₱${cost}\n\nEnd session?`)) {
        updateTable(id, { status: "available", startTime: null, customer: "", addedMinutes: 0 });
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
          addNotification({ message: `${getTableLabel(table)} session ended.` });
        }
      }
    }
  };

  const handleAddTime = (id, minutes) => {
    const table = tables.find((entry) => entry.id === id);
    if (!table) return;

    const extension = Number(minutes);
    if (!Number.isInteger(extension) || extension < 1) return;

    updateTable(id, {
      durationMinutes: Number(table.durationMinutes || 60) + extension,
      addedMinutes: Number(table.addedMinutes || 0) + extension,
    });
    addNotification({ message: `${getTableLabel(table)} extended by ${extension} minutes.` });
  };

  const handleUndoTime = (id, minutes) => {
    const table = tables.find((entry) => entry.id === id);
    if (!table) return;

    const requestedMinutes = Number(minutes);
    if (!Number.isInteger(requestedMinutes) || requestedMinutes < 1) return;

    const minutesToRemove = Math.min(requestedMinutes, Number(table.addedMinutes || 0));
    if (!minutesToRemove) return;

    updateTable(id, {
      durationMinutes: Math.max(0, Number(table.durationMinutes || 60) - minutesToRemove),
      addedMinutes: Math.max(0, Number(table.addedMinutes || 0) - minutesToRemove),
    });
    addNotification({ message: `${minutesToRemove} minutes removed from ${getTableLabel(table)}.` });
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
      addNotification({ message: `Reservation for ${getTableLabel(table)} was cancelled.` });
      queueAdminNotification({
        type: "reservation-cancellation",
        message: `Cancellation request: ${table?.customer || 'Customer'} reservation for ${getTableLabel(table)} was cancelled by an employee.`,
        data: { tableId: id },
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
        return (
          <QuickActions
            tables={tables}
            setTables={setTables}
            setLogs={setLogs}
            equipment={equipment}
            setEquipment={setEquipment}
          />
        );

      case "dashboard":
      default:
        return (
          <>
            <PoolTableStats
              stats={stats}
              activeStatus={statusFilter}
              onFilterChange={setStatusFilter}
            />
            <h2 className="section-title">Pool Tables</h2>
            <div className="pool-tables-grid employee-table-grid">
              {filtered.map((table) => (
                <PoolTableCard
                  key={table.id}
                  table={table}
                  onWalkIn={() => handleWalkIn(table.id)}
                  onEndSession={() => handleEndSession(table.id)}
                  onCheckIn={() => handleWalkIn(table.id)}
                  onCancelReserve={() => handleCancel(table.id)}
                  onAddTime={(minutes) => handleAddTime(table.id, minutes)}
                  onUndoTime={(minutes) => handleUndoTime(table.id, minutes)}
                />
              ))}
            </div>
          </>
        );
    }
  };

  const selfHeaded = ["sales", "quick-actions", "reservations"];

  const pageMeta = {
    "Pool Tables": {
      title: "Pool Table Dashboard",
      subtitle: "",
    },
    tournaments: {
      title: "Tournament Schedule",
      subtitle: "View tournaments and events created from the admin side",
    },
  };

  // A nav id with no entry here, such as the profile view opened from the menu,
  // still has to render a header. Falling back to nothing crashed the dashboard.
  const currentPage = pageMeta[activeNav] || pageMeta["Pool Tables"];

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
