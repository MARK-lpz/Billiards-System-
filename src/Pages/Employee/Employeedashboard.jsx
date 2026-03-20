import { useState, useEffect } from "react";
import "../../styles/Employee/Employeedashboard.css";
import Sidebar from "../../Elements/Employee/SidebarEmp";
import StatCards from "../../Elements/Global/StatCards";
import TableCard from "../../Elements/Global/TableCard";
import Notification from "../../Elements/Global/Notification";
import LoadingBar from "../../Elements/Global/Loading";
import Menu from "../../Elements/Global/Menu";

const initialTables = [
  { id: 1, status: "available", rate: 15, startTime: null },
  { id: 2, status: "occupied", rate: 15, startTime: Date.now() - 2700000 },
  { id: 3, status: "available", rate: 15, startTime: null },
  { id: 4, status: "reserved", rate: 15, startTime: null },
  { id: 5, status: "available", rate: 15, startTime: null },
  { id: 6, status: "occupied", rate: 15, startTime: Date.now() - 4800000 },
  { id: 7, status: "available", rate: 15, startTime: null },
  { id: 8, status: "available", rate: 15, startTime: null },
  { id: 9, status: "occupied", rate: 15, startTime: Date.now() - 1800000 },
  { id: 10, status: "available", rate: 15, startTime: null },
  { id: 11, status: "reserved", rate: 15, startTime: null },
  { id: 12, status: "available", rate: 15, startTime: null },
];

const notifications = [
  { id: 1, message: "Your shift starts in 30 minutes", time: "5 min ago", unread: true },
  { id: 2, message: "Table 3 needs cleaning", time: "15 min ago", unread: true },
  { id: 3, message: "Break time scheduled", time: "1 hour ago", unread: false },
];

export default function EmployeeDashboard({ onLogout }) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [tables, setTables] = useState(initialTables);
  const [timers, setTimers] = useState({});
  const [loading, setLoading] = useState(false);

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

  const updateTable = (id, updates) =>
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

  const handleReserve = (id) => updateTable(id, { status: "reserved", startTime: null });
  const handleWalkIn = (id) => updateTable(id, { status: "occupied", startTime: Date.now() });

  const handleEndSession = (id) => {
    const table = tables.find((t) => t.id === id);
    if (table?.startTime) {
      const hours = Math.ceil((Date.now() - table.startTime) / 3600000);
      const cost = hours * table.rate;
      if (window.confirm(`Session: ${timers[id]}\nTotal: $${cost}\n\nEnd session?`)) {
        updateTable(id, { status: "available", startTime: null });
      }
    }
  };

  const handleCancel = (id) => {
    if (window.confirm("Cancel reservation?")) {
      updateTable(id, { status: "available", startTime: null });
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
        />

        <main className="main-content">
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
                <Notification notifications={notifications} />
                <Menu 
                  onLogout={onLogout}
                  onProfile={() => handleNavChange('profile')}
                />
              </div>
            </div>
          </div>

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
        </main>
      </div>
    </>
  );
}