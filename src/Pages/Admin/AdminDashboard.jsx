import { useState } from "react";

// Styles
import "../../styles/Admin/Dashboard.css";

// Global Elements
import LoadingBar from "../../Elements/Global/Loading";
import AdminBell from "../../Elements/Admin/AdminBell";
import Menu from "../../Elements/Global/Menu";
import TimeUpAlert from "../../Elements/Global/TimeUpAlert";
import Toast from "../../Elements/Global/Toast";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { formatHoursLabel, getExtensionBlock } from "../../utils/reservations";
import { saveTableReservationStatus } from "../../utils/reservationApi";
import { ENDED_SESSION_FIELDS, createTableCharge, describeEndedCharge, endedChargeToast } from "../../utils/tableCharges";

// Admin Elements
import Sidebar from "../../Elements/Admin/Sidebar";
import TaskList from "../../Elements/Admin/TaskList";
import ActiveTables from "../../Elements/Admin/ActiveTables";

// Employee Elements
import EmployeeStats from "../../Elements/Employee/EmployeeStats";

// Admin Modules (Pages)
import SalesPOS from "./SalesPOS";
import Reservations from "./Reservations";
import Reports from "./Reports";
import PoolTables from "./PoolTables";
import Inventory from "./Inventory";
import Events from "./Events";
import Equipment from "./Equipment";
import AccountManagement from "./AccountManagement";
import AuditTrail from "./AuditTrail";
import AdminProfile from "./AdminProfile";
import Settings from "../Settings";

// Read only from click handlers, never while rendering.
const getCurrentTimestamp = () => Date.now();

const ISSUE_ACTION_KEYWORDS = ["reported issue", "reported damaged equipment", "customer complaint"];
const isResolvedIssue = (entry) =>
  entry?.issueStatus === "resolved" || entry?.issue?.status === "resolved" || Boolean(entry?.resolvedAt);

const isIssueEntry = (entry) => {
  const action = `${entry.action || ""}`.toLowerCase();
  const detail = `${entry.detail || ""}`.toLowerCase();

  if (action.includes("updated table status")) return false;

  if (ISSUE_ACTION_KEYWORDS.some((keyword) => action.includes(keyword))) {
    return true;
  }

  return ["issue", "damage", "complaint", "malfunction"].some(
    (keyword) => action.includes(keyword) || detail.includes(keyword)
  );
};

export default function Dashboard({
  onLogout,
  onReload,
  tables,
  setTables,
  logs,
  setLogs,
  products,
  setProducts,
  equipment,
  setEquipment,
  transactions,
  setTransactions,
  tableCharges = [],
  setTableCharges,
  reservations,
  setReservations,
  events,
  setEvents,
  theme,
  setTheme,
  onlineReservationsOpen,
  isUpdatingOnlineReservations,
  onOnlineReservationsChange,
}) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [selectedEquipmentIssue, setSelectedEquipmentIssue] = useState(null);
  // What the bell opened, for the page it leads to (a product in Inventory).
  // Cleared by any other navigation.
  const [focus, setFocus] = useState(null);
  const { addNotification, showToast } = useNotifications();

  // Used by the time's up pop-up, which shows on every admin page, not only on
  // Pool Tables, so it cannot rely on that page's own handlers.
  const addTableTime = (id, minutes) => {
    const table = tables.find((entry) => entry.id === id);
    // More time must end before the table's next booking.
    const extensionBlock = getExtensionBlock({ table, reservations, minutes });
    if (extensionBlock) {
      showToast({ tone: "error", icon: "bi-calendar-x", title: "Time not added", message: extensionBlock });
      return;
    }
    setTables((previous) =>
      previous.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              durationMinutes: Number(entry.durationMinutes || 60) + minutes,
              addedMinutes: Number(entry.addedMinutes || 0) + minutes,
            }
          : entry
      )
    );
    addNotification({ message: `${table?.name || "Table"} extended by ${formatHoursLabel(minutes)}.` });
  };

  // The session's bill goes to Sales / POS, where it is paid with any food and drinks.
  const endTableSession = (id) => {
    const table = tables.find((entry) => entry.id === id);
    const charge = createTableCharge({ table, reservations, tableCharges, endedBy: "Admin", now: getCurrentTimestamp() });
    setTables((previous) =>
      previous.map((entry) => (entry.id === id ? { ...entry, ...ENDED_SESSION_FIELDS } : entry))
    );
    saveTableReservationStatus({ table, reservations, setReservations, from: ["seated"], status: "completed" });
    if (!charge) return;
    setTableCharges?.((previous) => [charge, ...previous]);
    addNotification({ message: describeEndedCharge(charge) });
    showToast(endedChargeToast(charge));
  };

  const reportedIssuesCount = logs.filter((entry) => isIssueEntry(entry) && !isResolvedIssue(entry)).length;

  const availableTablesCount = tables.filter((table) => table.status === "available").length;

  // Pending tasks and the Reported Issues panel use the same unresolved-report source.
  const pendingTasksCount = reportedIssuesCount;

  const handleReload = () => {
    setLoading(true);
    if (onReload) onReload();
    setTimeout(() => setLoading(false), 300);
  };

  const handleNavChange = (navId, nextFocus = null) => {
    setFocus(nextFocus);
    setLoading(true);
    setTimeout(() => {
      setActiveNav(navId);
      setLoading(false);
    }, 300);
  };

  const openEquipmentIssue = (issue) => {
    setSelectedEquipmentIssue(issue);
    handleNavChange("equipment");
  };

  const renderModule = () => {
    switch(activeNav) {
      case 'sales-pos':
        return <SalesPOS 
          tables={tables}
          products={products} 
          setProducts={setProducts}
          transactions={transactions}
          setTransactions={setTransactions}
          tableCharges={tableCharges}
          setTableCharges={setTableCharges}
          setLogs={setLogs}
        />;
      
      case 'reservations':
        return <Reservations 
          reservations={reservations}
          setReservations={setReservations}
          tables={tables}
          setTables={setTables}
          tableCharges={tableCharges}
          setTableCharges={setTableCharges}
          setLogs={setLogs}
          onlineReservationsOpen={onlineReservationsOpen}
          isUpdatingOnlineReservations={isUpdatingOnlineReservations}
          onOnlineReservationsChange={onOnlineReservationsChange}
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
          reservations={reservations}
          setReservations={setReservations}
          tableCharges={tableCharges}
          setTableCharges={setTableCharges}
        />;
      
      case 'inventory':
        return <Inventory
          key={focus?.key || "inventory"}
          focusProductId={focus?.nav === "inventory" ? focus.productId : null}
          products={products}
          setProducts={setProducts}
        />;
      
      case 'events':
        return <Events
          events={events}
          setEvents={setEvents}
          tables={tables}
          reservations={reservations}
        />;
      
      case 'equipment':
        return <Equipment 
          equipment={equipment}
          tables={tables}
          setEquipment={setEquipment}
          logs={logs}
          setLogs={setLogs}
          selectedIssue={selectedEquipmentIssue}
          onSelectedIssueHandled={() => setSelectedEquipmentIssue(null)}
        />;

      case 'audit-trail':
        return <AuditTrail logs={logs} setLogs={setLogs} />;

      case 'accounts':
        return <AccountManagement setLogs={setLogs} />;

      case 'profile':
        return <AdminProfile />;

      case 'settings':
        return (
          <Settings
            theme={theme}
            setTheme={setTheme}
            canManageBackups
            onRestored={onReload}
          />
        );
      
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
                <div className="header-icons">
                  <AdminBell
                    products={products}
                    onOpenProduct={(productId) =>
                      handleNavChange("inventory", { nav: "inventory", productId, key: `product-${Date.now()}` })
                    }
                  />
                  <Menu 
                    onLogout={onLogout}
                    onProfile={() => handleNavChange('profile')}
                    onSettings={() => handleNavChange('settings')}
                  />
                </div>
              </div>
            </div>

            {/* Stats — full width */}
            <EmployeeStats
              availableTables={availableTablesCount}
              pendingTasks={pendingTasksCount}
            />

            {/* Main grid — 50/50 equal columns */}
            <div className="admin-dashboard-grid">
              <ActiveTables tables={tables} onViewPoolTables={() => handleNavChange('pool-tables')} />
              <TaskList logs={logs} setLogs={setLogs} onOpenEquipment={openEquipmentIssue} />
            </div>
          </>
        );
    }
  };

  return (
    <>
      <LoadingBar loading={loading} />
      <TimeUpAlert tables={tables} reservations={reservations} onAddTime={addTableTime} onEndSession={endTableSession} />
      {/* "Open POS" on a bill's note; hidden when already there. */}
      <Toast
        actions={{
          "open-pos": activeNav === "sales-pos" ? null : { label: "Open POS", onClick: () => handleNavChange("sales-pos") },
        }}
      />
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
