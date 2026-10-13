import { useState } from "react";
import "../../styles/Employee/Employeedashboard.css";
import Sidebar from "../../Elements/Employee/SidebarEmp";
import PoolTableStats from "../../Elements/Admin/PoolTableStats";
import PoolTableCard from "../../Elements/Admin/PoolTableCards";
import WalkInModal from "../../Elements/Admin/WalkInModal";
import EndSessionModal from "../../Elements/Admin/EndSessionModal";
import CancelReservationModal from "../../Elements/Admin/CancelReservationModal";
import TimeUpAlert from "../../Elements/Global/TimeUpAlert";
import Toast from "../../Elements/Global/Toast";
import EmployeeBell from "../../Elements/Employee/EmployeeBell";
import LoadingBar from "../../Elements/Global/Loading";
import Menu from "../../Elements/Global/Menu";
import Settings from "../Settings";
import TournamentSchedule from "./TournamentSchedule";
import QuickActions from "./QuickAction";
import SalesPOS from "./SalesPos";
import ReservationDesk from "./ReservationDesk";
import { appendAuditLog } from "../../utils/audit";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { findTableReservation, formatHoursLabel, getExtensionBlock } from "../../utils/reservations";
import { saveTableReservationStatus } from "../../utils/reservationApi";
import { formatPeso, getPlayedMinutes, getSessionTotal } from "../../utils/tableSession";
import { ENDED_SESSION_FIELDS, createTableCharge, describeEndedCharge, endedChargeToast } from "../../utils/tableCharges";
import { getCheckInBlock, hasTableReservation } from "../../utils/tableHolds";
import useClock from "../../Elements/Global/useClock";

const getCurrentTimestamp = () => Date.now();

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
  theme,
  setTheme,
}) {
  const { addNotification, queueAdminNotification, showToast } = useNotifications();
  // Must match a sidebar nav id, otherwise nothing is highlighted on load and
  // the page header has no entry to read its title from.
  const [activeNav, setActiveNav] = useState("Pool Tables");
  const [loading, setLoading] = useState(false);
  // What the bell opened, for the page it leads to: a booking on the Reservation
  // Desk, or a player on the Tournament Schedule. Cleared by any other navigation.
  const [focus, setFocus] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  // The table a walk-in is being started on, while staff enter how long they stay.
  const [walkInTableId, setWalkInTableId] = useState(null);
  // The table whose End Session warning is open, and when End Session was pressed.
  const [endingTableId, setEndingTableId] = useState(null);
  const [endingAt, setEndingAt] = useState(null);
  // Gone once the session is over, e.g. ended from the time's up pop-up meanwhile.
  const endingTable = tables.find((t) => t.id === endingTableId && t.startTime) || null;
  // The reserved table whose Cancel pop-up is open; gone if it is no longer reserved.
  const [cancelTableId, setCancelTableId] = useState(null);
  const cancelTable = tables.find((t) => t.id === cancelTableId && t.status === "reserved") || null;

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

  // Reserved covers tables held now and those booked for later, which stay
  // Available (and count there too) until their booking comes due.
  const clock = useClock();
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

  // The booked time is paid in full, even when the customer leaves early.
  // Played time is worked out on the click, so it is right in the first second.
  const describeSessionEnd = (table) => {
    const bookedMinutes = Number(table.durationMinutes || 60);
    const playedMinutes = getPlayedMinutes(table, getCurrentTimestamp());
    return {
      cost: getSessionTotal(table),
      booked: formatHoursLabel(bookedMinutes),
      played: formatHoursLabel(playedMinutes),
    };
  };

  // The session's bill goes to Sales / POS, where it is paid with any food and drinks.
  const endSession = (id) => {
    const table = tables.find((t) => t.id === id);
    if (!table?.startTime) return;

    const { cost, booked, played } = describeSessionEnd(table);
    const charge = createTableCharge({ table, reservations, tableCharges, endedBy: "Employee", now: getCurrentTimestamp() });
    updateTable(id, ENDED_SESSION_FIELDS);
    saveTableReservationStatus({ table, reservations, setReservations, from: ["seated"], status: "completed" });
    if (charge) setTableCharges?.((prev) => [charge, ...prev]);
    addLog({
      action: "Ended session",
      detail: `Ended session for ${getTableLabel(table)} (${formatPeso(cost)} for ${played} of ${booked})`,
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
        amountDue: charge?.amountDue ?? cost,
        source: "table-session",
      },
    });
    addNotification({ message: charge ? describeEndedCharge(charge) : `${getTableLabel(table)} session ended.` });
    if (charge) showToast(endedChargeToast(charge));
  };

  // The card's End Session asks first, in the same warning the admin's Pool
  // Tables shows; the time's up pop-up already shows the total.
  const handleEndSession = (id) => {
    const table = tables.find((t) => t.id === id);
    if (!table?.startTime) return;

    setEndingAt(getCurrentTimestamp());
    setEndingTableId(id);
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
  // too, or the reservations sync would mark the table reserved again.
  const cancelReservation = (id) => {
    const table = tables.find((t) => t.id === id);
    if (!table) return;

    updateTable(id, ENDED_SESSION_FIELDS);
    saveTableReservationStatus({ table, reservations, setReservations, from: ["approved", "reserved", "arrived"], status: "cancelled" });
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
      message: `Cancellation request: ${table.customer || "Customer"} reservation for ${getTableLabel(table)} was cancelled by an employee.`,
      data: { tableId: id },
    });
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
            tables={tables}
            focusPlayer={focus?.nav === "tournaments" ? focus : null}
          />
        );

      case "settings":
        return <Settings theme={theme} setTheme={setTheme} showHeader={false} />;

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
            setLogs={setLogs}
          />
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
                  reservations={reservations}
                  onWalkIn={() => setWalkInTableId(table.id)}
                  onEndSession={() => handleEndSession(table.id)}
                  onCheckIn={() => handleCheckIn(table.id)}
                  onCancelReserve={() => setCancelTableId(table.id)}
                  onAddTime={(minutes) => handleAddTime(table.id, minutes)}
                  onUndoTime={(minutes) => handleUndoTime(table.id, minutes)}
                />
              ))}
            </div>

            {walkInTableId !== null && (
              <WalkInModal
                table={tables.find((t) => t.id === walkInTableId)}
                reservations={reservations}
                onClose={() => setWalkInTableId(null)}
                onStart={startWalkIn}
              />
            )}

            {endingTable && (
              <EndSessionModal
                table={endingTable}
                endingAt={endingAt}
                onClose={() => setEndingTableId(null)}
                onConfirm={() => {
                  endSession(endingTable.id);
                  setEndingTableId(null);
                }}
              />
            )}

            {cancelTable && (
              <CancelReservationModal
                table={cancelTable}
                onClose={() => setCancelTableId(null)}
                onConfirm={() => {
                  cancelReservation(cancelTable.id);
                  setCancelTableId(null);
                }}
              />
            )}
          </>
        );
    }
  };

  // These pages draw their own header (Tournaments: a bell just for player registrations).
  const selfHeaded = ["sales", "quick-actions", "reservations", "tournaments"];

  const pageMeta = {
    "Pool Tables": {
      title: "Pool Table Dashboard",
      subtitle: "",
    },
    tournaments: {
      title: "Tournament Schedule",
      subtitle: "View tournaments and events created from the admin side",
    },
    settings: {
      title: "Settings",
      subtitle: "Choose how the system looks on this device",
    },
  };

  // A nav id with no entry here, such as the profile view opened from the menu,
  // still has to render a header. Falling back to nothing crashed the dashboard.
  const currentPage = pageMeta[activeNav] || pageMeta["Pool Tables"];

  return (
    <>
      <LoadingBar loading={loading} />
      {/* Shown on every page, so a finished table is noticed even from the POS. */}
      <TimeUpAlert tables={tables} reservations={reservations} onAddTime={handleAddTime} onEndSession={endSession} />
      {/* "Open POS" on a bill's note; hidden when already there. */}
      <Toast
        actions={{
          "open-pos": activeNav === "sales" ? null : { label: "Open POS", onClick: () => handleNavChange("sales") },
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
          {!selfHeaded.includes(activeNav) && (
            <div className="page-header">
              <div className="page-header-text">
                <h1 className="page-title">{currentPage.title}</h1>
                <p className="page-subtitle">{currentPage.subtitle}</p>
              </div>

              <div className="header-right">
                <div className="header-icons">
                  <EmployeeBell
                    events={events}
                    reservations={reservations}
                    onOpenReservation={(reservationId) =>
                      handleNavChange("reservations", { nav: "reservations", reservationId, key: `booking-${Date.now()}` })
                    }
                    onOpenRegistration={(player) =>
                      handleNavChange("tournaments", { nav: "tournaments", ...player, key: `player-${Date.now()}` })
                    }
                  />
                  <Menu
                    onLogout={onLogout}
                    onProfile={() => handleNavChange("profile")}
                    onSettings={() => handleNavChange("settings")}
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
