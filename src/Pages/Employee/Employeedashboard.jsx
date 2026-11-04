import { useState } from "react";
import "../../styles/Employee/Employeedashboard.css";
import Sidebar from "../../Elements/Employee/SidebarEmp";
import PoolTableStats from "../../Elements/Admin/PoolTableStats";
import PoolTableCard from "../../Elements/Admin/PoolTableCards";
import WalkInModal from "../../Elements/Admin/WalkInModal";
import TableCheckout from "../../Elements/Admin/TableCheckout";
import TableOrderModal from "../../Elements/Admin/TableOrderModal";
import useTableOrders from "../../Elements/Admin/useTableOrders";
import CancelReservationModal from "../../Elements/Admin/CancelReservationModal";
import TableBookingsModal from "../../Elements/Admin/TableBookingsModal";
import ActiveTables from "../../Elements/Admin/ActiveTables";
import EmployeeDashboardStats from "../../Elements/Employee/EmployeeDashboardStats";
import useStockAlarm from "../../Elements/Employee/useStockAlarm";
import { getShelfProducts } from "../../utils/productShelf";
import { useOnlinePayments } from "../../Elements/Global/useOnlinePayments";
import TimeUpAlert from "../../Elements/Global/TimeUpAlert";
import Toast from "../../Elements/Global/Toast";
import EmployeeBell from "../../Elements/Employee/EmployeeBell";
import useSeenRegistrations from "../../Elements/Employee/useSeenRegistrations";
import LoadingBar from "../../Elements/Global/Loading";
import Menu from "../../Elements/Global/Menu";
import Settings from "../Settings";
import Profile from "../Profile";
import TournamentSchedule from "./TournamentSchedule";
import QuickActions from "./QuickAction";
import SalesPOS from "./SalesPos";
import ReservationDesk from "./ReservationDesk";
import StockAlarm from "./StockAlarm";
import TableHistory from "../../Elements/Global/TableHistory";
import Website from "../Admin/Website";
import { appendAuditLog } from "../../utils/audit";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { findTableReservation, formatHoursLabel, getExtensionBlock } from "../../utils/reservations";
import { saveTableReservationStatus } from "../../utils/reservationApi";
import { ENDED_SESSION_FIELDS } from "../../utils/tableCharges";
import { getCheckInBlock, getTableBookings, hasTableReservation } from "../../utils/tableHolds";
import useBookingPayment from "../../Elements/Global/useBookingPayment";
import useClock from "../../Elements/Global/useClock";
import useStaffShell from "../../Elements/Global/useStaffShell";
import useMyProfile from "../../Elements/Global/useMyProfile";
import { ProfileButton } from "../../Elements/Global/ProfileAvatar";
import EmployeeTopbar from "../../Elements/Employee/EmployeeTopbar";
import { navItems } from "../../Elements/Employee/employeeNav";

const getCurrentTimestamp = () => Date.now();

// The parts of the website the front desk sees: the GCash details to check
// (only the admin changes them) and the slides it keeps up to date.
const EMPLOYEE_WEBSITE_SECTIONS = ["gcash", "showcase"];

// Pages the top bar can name that are not in the sidebar.
const extraPages = {
  profile: { icon: "bi-person", label: "Profile" },
  settings: { icon: "bi-gear", label: "Settings" },
};

const formatToday = (now) =>
  new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export default function EmployeeDashboard({
  onLogout,
  onReload,
  tables,
  setTables,
  logs = [],
  setLogs,
  products,
  setProducts,
  equipment,
  transactions,
  setTransactions,
  tableCharges = [],
  setTableCharges,
  reservations,
  setReservations,
  events,
  // Shows at once what the front desk's own tournament requests changed (a
  // walk-in signed up, a cancelled one hidden); the server's copy follows.
  setEvents,
  theme,
  setTheme,
  density,
  setDensity,
  // The Online reservations switch, on the Website page.
  onlineReservationsOpen,
  onlineReservationsStatus,
  isUpdatingOnlineReservations,
  onOnlineReservationsChange,
}) {
  const { addNotification, showToast } = useNotifications();
  // A website booking's GCash payment moves with it on the server; asked again after a cancel.
  const { refresh: refreshPayments } = useOnlinePayments();
  const { recordBookingRefund } = useBookingPayment({ staff: "Employee", setReservations, setTransactions, setLogs });
  const { collapsed: sidebarCollapsed, toggleCollapsed: toggleSidebarCollapsed, navOpen, setNavOpen, shellClassName } =
    useStaffShell("employee-sidebar-collapsed");
  // The employee's own profile: the Profile page and the picture in the top bar.
  const myProfile = useMyProfile();
  // Must match a sidebar nav id, otherwise nothing is highlighted on load and
  // the page header has no entry to read its title from.
  const [activeNav, setActiveNav] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  // What the bell opened, for the page it leads to: a booking on the Reservation
  // Desk, or a player on the Tournament Schedule. Cleared by any other navigation.
  const [focus, setFocus] = useState(null);
  // Tournament players already opened on this device: one list for the bell and
  // the Tournament Schedule, so opening a player in either clears it in both.
  const [seenPlayers, markPlayersSeen] = useSeenRegistrations(events);
  // The products still in the Inventory (archived ones are the admin's only),
  // and what the stock alarm says about them, for its page, the sidebar and the bell.
  const shelfProducts = getShelfProducts(products);
  const [statusFilter, setStatusFilter] = useState("all");
  // The table a walk-in is being started on, while staff enter how long they stay.
  const [walkInTableId, setWalkInTableId] = useState(null);
  // The session being ended and paid ({ tableId, startTime, at }), from a table
  // card or from the time's up pop-up on any page.
  const [checkout, setCheckout] = useState(null);
  // The table whose Order pop-up is open; gone once its session ends.
  const [orderTableId, setOrderTableId] = useState(null);
  const orderTable = tables.find((t) => t.id === orderTableId && t.status === "occupied") || null;
  const tableOrders = useTableOrders({ tables, setTables, products: shelfProducts, setProducts, setLogs, staff: "Employee" });
  // The reserved table whose Cancel pop-up is open; gone if it is no longer reserved.
  const [cancelTableId, setCancelTableId] = useState(null);
  const cancelTable = tables.find((t) => t.id === cancelTableId && t.status === "reserved") || null;
  // The table whose reservations are open in the pop-up.
  const [bookingsTableId, setBookingsTableId] = useState(null);
  const bookingsTable = tables.find((t) => t.id === bookingsTableId) || null;

  const handleReload = () => {
    setLoading(true);
    if (onReload) onReload();
    setTimeout(() => setLoading(false), 300);
  };

  const handleNavChange = (navId, nextFocus = null) => {
    setNavOpen(false);
    setFocus(nextFocus);
    setLoading(true);
    setTimeout(() => {
      setActiveNav(navId);
      setLoading(false);
    }, 300);
  };

  // Reserved covers tables held now and those booked for later, which stay
  // Available (and count there too) until their booking comes due.
  const clock = useClock();
  const stockAlarm = useStockAlarm(shelfProducts, clock);
  // Expired and low products wait on the Stock Alarm until the admin acts: the
  // sidebar counts them, red while any is expired or out.
  const stockAttention = stockAlarm.alarm.expired.length + stockAlarm.alarm.low.length;
  const stockUrgent = stockAlarm.alarm.expired.length > 0 || stockAlarm.alarm.low.some((entry) => entry.state === "out");
  const isReservedTable = (table) => hasTableReservation(table, reservations, new Date(clock));
  const stats = {
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    reserved: tables.filter(isReservedTable).length,
    total: tables.length,
  };

  const filtered = [...tables].filter(
    (table) =>
      statusFilter === "all" ||
      (statusFilter === "reserved" ? isReservedTable(table) : table.status === statusFilter)
  ).sort((left, right) => Number(left.id) - Number(right.id));

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

  // The session runs as long as the customer said they would stay.
  const startWalkIn = ({ customer, minutes }) => {
    const table = tables.find((t) => t.id === walkInTableId);
    setWalkInTableId(null);
    if (!table) return;

    updateTable(table.id, {
      status: "occupied",
      startTime: getCurrentTimestamp(),
      customer,
      durationMinutes: minutes,
      addedMinutes: 0,
    });
    addLog({
      action: "Started walk-in session",
      detail: `Walk-in started for ${getTableLabel(table)}: ${customer} for ${formatHoursLabel(minutes)}`,
      customer: {
        previous: table.customer ? { name: table.customer } : null,
        current: { name: customer },
      },
      table: {
        id: table.id,
        name: getTableLabel(table),
        previousStatus: table.status,
        currentStatus: "occupied",
      },
    });
    addNotification({ message: `${formatHoursLabel(minutes)} walk-in session started for ${getTableLabel(table)}.` });
  };

  // A reserved guest keeps their name and plays the hours they booked.
  const handleCheckIn = (id) => {
    const table = tables.find((t) => t.id === id);
    if (!table) return;

    // The button is off when blocked, but the page may have sat open past the grace period.
    const block = getCheckInBlock({ table, reservations, now: new Date(getCurrentTimestamp()) });
    if (block) {
      showToast({ tone: "error", icon: "bi-calendar-x", title: `Can't check in at ${getTableLabel(table)}`, message: block });
      return;
    }

    const bookedMinutes = Number(findTableReservation(table, reservations)?.durationMinutes);
    const customer = table.customer || "Reserved Customer";
    updateTable(id, {
      status: "occupied",
      startTime: getCurrentTimestamp(),
      customer,
      durationMinutes: bookedMinutes > 0 ? bookedMinutes : Number(table.durationMinutes || 60),
      addedMinutes: 0,
    });
    // Seated, so the booking is not expired as a no-show while the guest plays.
    saveTableReservationStatus({ table, reservations, setReservations, from: ["approved", "reserved", "arrived"], status: "seated" });
    addLog({
      action: "Checked in reservation",
      detail: `${customer} checked in at ${getTableLabel(table)}`,
      customer: {
        previous: table.customer ? { name: table.customer } : null,
        current: { name: customer },
      },
      table: {
        id: table.id,
        name: getTableLabel(table),
        previousStatus: table.status,
        currentStatus: "occupied",
      },
    });
    addNotification({ message: `${customer} checked in at ${getTableLabel(table)}.` });
  };

  // Ending a session shows its bill (table time and orders) and takes the
  // payment, the same way from a card and from the time's up pop-up.
  const handleEndSession = (id) => {
    const table = tables.find((t) => t.id === id);
    if (!table?.startTime) return;

    setCheckout({ tableId: id, startTime: table.startTime, at: getCurrentTimestamp() });
  };

  const handleAddTime = (id, minutes) => {
    const table = tables.find((entry) => entry.id === id);
    if (!table) return;

    const extension = Number(minutes);
    if (!Number.isInteger(extension) || extension < 1) return;
    // More time must end before the table's next booking.
    const extensionBlock = getExtensionBlock({ table, reservations, minutes: extension });
    if (extensionBlock) {
      showToast({ tone: "error", icon: "bi-calendar-x", title: "Time not added", message: extensionBlock });
      return;
    }

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

  // Runs once the Cancel pop-up is confirmed. The booking itself is cancelled
  // too, or the reservations sync would mark the table reserved again. `extra`:
  // whether to give the booking's payment back.
  const cancelReservation = (id, extra = {}) => {
    const table = tables.find((t) => t.id === id);
    if (!table) return;

    updateTable(id, ENDED_SESSION_FIELDS);
    saveTableReservationStatus({
      table,
      reservations,
      setReservations,
      from: ["approved", "reserved", "arrived"],
      status: "cancelled",
      extra,
      onSaved: (saved) => {
        refreshPayments();
        recordBookingRefund(saved, extra);
      },
    });
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
    // The admin finds it in the Audit Trail (above), not in the bell.
    addNotification({ message: `Reservation for ${getTableLabel(table)} was cancelled.` });
  };

  const renderModule = () => {
    switch (activeNav) {
      case "sales":
        return (
          <SalesPOS
            tables={tables}
            setTables={setTables}
            reservations={reservations}
            products={shelfProducts}
            setProducts={setProducts}
            transactions={transactions}
            setTransactions={setTransactions}
            tableCharges={tableCharges}
            setTableCharges={setTableCharges}
            setLogs={setLogs}
          />
        );

      case "tournaments":
        return (
          <TournamentSchedule
            key={focus?.key || "tournaments"}
            events={events}
            setEvents={setEvents}
            setLogs={setLogs}
            transactions={transactions}
            setTransactions={setTransactions}
            tables={tables}
            focusPlayer={focus?.nav === "tournaments" ? focus : null}
            seen={seenPlayers}
            markSeen={markPlayersSeen}
          />
        );

      case "settings":
        return (
          <Settings
            theme={theme}
            setTheme={setTheme}
            density={density}
            setDensity={setDensity}
            showHeader={false}
          />
        );

      case "profile":
        return <Profile myProfile={myProfile} setLogs={setLogs} staffLabel="Employee" />;

      case "content-management":
        return (
          <Website
            reservations={reservations}
            setLogs={setLogs}
            only={EMPLOYEE_WEBSITE_SECTIONS}
            staff="Employee"
            bookings={{
              open: onlineReservationsOpen,
              status: onlineReservationsStatus,
              updating: isUpdatingOnlineReservations,
              onChange: onOnlineReservationsChange,
            }}
          />
        );

      case "reservations":
        return (
          <ReservationDesk
            key={focus?.key || "reservations"}
            focusReservationId={focus?.nav === "reservations" ? focus.reservationId : null}
            tables={tables}
            setTables={setTables}
            reservations={reservations}
            setReservations={setReservations}
            tableCharges={tableCharges}
            setTableCharges={setTableCharges}
            events={events}
            transactions={transactions}
            setTransactions={setTransactions}
            setLogs={setLogs}
          />
        );

      case "stock-alarm":
        return (
          <StockAlarm
            key={focus?.key || "stock-alarm"}
            products={shelfProducts}
            stockAlarm={stockAlarm}
            setLogs={setLogs}
            initialTab={focus?.nav === "stock-alarm" ? focus.stockTab : null}
          />
        );

      case "history":
        return (
          <TableHistory tables={tables} reservations={reservations} tableCharges={tableCharges} now={clock} />
        );

      case "quick-actions":
        return (
          <QuickActions
            tables={tables}
            setTables={setTables}
            logs={logs}
            setLogs={setLogs}
            equipment={equipment}
          />
        );

      // Laid out like the admin's Pool Tables: the status filter, then the
      // tables, without adding, editing or deleting a table.
      case "pool-tables":
        return (
          <>
            <PoolTableStats
              stats={stats}
              activeStatus={statusFilter}
              onFilterChange={setStatusFilter}
            />

            <div className="pool-tables-grid employee-table-grid">
              {filtered.map((table) => (
                <PoolTableCard
                  key={table.id}
                  table={table}
                  reservations={reservations}
                  onWalkIn={() => setWalkInTableId(table.id)}
                  onEndSession={() => handleEndSession(table.id)}
                  onCheckIn={() => handleCheckIn(table.id)}
                  onCancelReserve={() => setCancelTableId(table.id)}
                  onAddTime={(minutes) => handleAddTime(table.id, minutes)}
                  onUndoTime={(minutes) => handleUndoTime(table.id, minutes)}
                  onOrder={() => setOrderTableId(table.id)}
                  onShowBookings={() => setBookingsTableId(table.id)}
                />
              ))}
            </div>

            {bookingsTable && (
              <TableBookingsModal
                table={bookingsTable}
                bookings={getTableBookings(bookingsTable, reservations, new Date(clock))}
                now={clock}
                onClose={() => setBookingsTableId(null)}
                onOpenReservations={() => {
                  setBookingsTableId(null);
                  handleNavChange("reservations");
                }}
              />
            )}

            {walkInTableId !== null && (
              <WalkInModal
                table={tables.find((t) => t.id === walkInTableId)}
                reservations={reservations}
                onClose={() => setWalkInTableId(null)}
                onStart={startWalkIn}
              />
            )}

            {orderTable && (
              <TableOrderModal
                table={orderTable}
                products={shelfProducts}
                onPlace={(draft) => tableOrders.placeOrder(orderTable, draft)}
                onTakeOff={(lineId) => tableOrders.takeOffOrder(orderTable, lineId)}
                onClose={() => setOrderTableId(null)}
              />
            )}

            {cancelTable && (
              <CancelReservationModal
                table={cancelTable}
                reservations={reservations}
                onClose={() => setCancelTableId(null)}
                onConfirm={(extra) => {
                  cancelReservation(cancelTable.id, extra);
                  setCancelTableId(null);
                }}
              />
            )}
          </>
        );

      case "dashboard":
      default:
        return (
          <>
            <section className="page-header employee-hero">
              <div className="page-header-text employee-hero-text">
                <span className="employee-hero-eyebrow">{formatToday(clock)}</span>
                <h1 className="page-title">Employee Dashboard</h1>
                <p className="page-subtitle">The hall today: players, reservations, stock and every table</p>
              </div>
            </section>

            {/* Players, reservations by day, then the Stock Alarm; each opens its page */}
            <EmployeeDashboardStats
              events={events}
              reservations={reservations}
              now={clock}
              onOpen={(navId) => handleNavChange(navId)}
              stockAlarm={stockAlarm}
            />

            {/* The title opens Pool Tables; a table opens its reservations */}
            <ActiveTables
              tables={tables}
              reservations={reservations}
              now={clock}
              onViewPoolTables={() => handleNavChange("pool-tables")}
              onViewReservations={() => handleNavChange("reservations")}
            />
          </>
        );
    }
  };

  const currentPage = navItems.find((item) => item.id === activeNav) || extraPages[activeNav] || navItems[0];
  const moduleSlug = String(currentPage.label).toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <>
      <LoadingBar loading={loading} />
      {/* Shown on every page, so a finished table is noticed even from the POS. */}
      <TimeUpAlert tables={tables} reservations={reservations} onAddTime={handleAddTime} onEndSession={handleEndSession} />
      {checkout && (
        <TableCheckout
          key={`${checkout.tableId}-${checkout.at}`}
          checkout={checkout}
          tables={tables}
          setTables={setTables}
          reservations={reservations}
          setReservations={setReservations}
          tableCharges={tableCharges}
          setTableCharges={setTableCharges}
          transactions={transactions}
          setTransactions={setTransactions}
          setLogs={setLogs}
          cashierLabel="Employee"
          onClose={() => setCheckout(null)}
        />
      )}
      {/* "Open POS" on a bill's note; hidden when already there. */}
      <Toast
        actions={{
          "open-pos": activeNav === "sales" ? null : { label: "Open POS", onClick: () => handleNavChange("sales") },
        }}
      />
      <div className={`${shellClassName} employee-shell`}>
        <Sidebar
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          onNavChange={handleNavChange}
          onReload={handleReload}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
          badges={
            stockAttention
              ? {
                  "stock-alarm": {
                    count: stockAttention,
                    tone: stockUrgent ? "danger" : "warning",
                    label: `${stockAttention} ${stockAttention === 1 ? "product needs" : "products need"} attention`,
                  },
                }
              : {}
          }
        />
        {navOpen && <div className="employee-nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}

        <div className="employee-workspace">
          <EmployeeTopbar
            page={currentPage}
            now={clock}
            navOpen={navOpen}
            onToggleNav={() => setNavOpen((open) => !open)}
          >
            <EmployeeBell
              events={events}
              tables={tables}
              reservations={reservations}
              onOpenTables={() => handleNavChange("pool-tables")}
              onEndSession={handleEndSession}
              seen={seenPlayers}
              markSeen={markPlayersSeen}
              onOpenReservation={(reservationId) =>
                handleNavChange("reservations", { nav: "reservations", reservationId, key: `booking-${Date.now()}` })
              }
              onOpenRegistration={(player) =>
                handleNavChange("tournaments", { nav: "tournaments", ...player, key: `player-${Date.now()}` })
              }
              stockAlarm={stockAlarm}
              onOpenStockAlarm={(stockTab) =>
                handleNavChange("stock-alarm", { nav: "stock-alarm", stockTab, key: `stock-${Date.now()}` })
              }
            />
            <ProfileButton profile={myProfile.profile} onOpen={() => handleNavChange("profile")} />
            <Menu
              onLogout={onLogout}
              onProfile={() => handleNavChange("profile")}
              onSettings={() => handleNavChange("settings")}
            />
          </EmployeeTopbar>

          <main className={`main-content employee-module employee-module-${moduleSlug}`}>
            {renderModule()}
          </main>
        </div>
      </div>
    </>
  );
}
