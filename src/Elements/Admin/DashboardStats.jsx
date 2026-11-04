import { formatPesoAmount, getPeriodTransactions, summarizeSales } from "../../utils/salesReport";
import { getTodayDate } from "../../utils/reservations";
import DashboardStatCards from "../Global/DashboardStatCards";

// Counted the way each page counts them, so the dashboard and the page agree:
// Inventory's "Out of Stock", Events' players, Sales Reports' daily revenue and
// the Reservations list's "All" (everything not yet history).
const HISTORY_STATUSES = new Set(["completed", "rejected", "cancelled", "expired"]);
const ACTIVE_EVENT_STATUSES = new Set(["upcoming", "active"]);

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * The admin dashboard's numbers, under the title band: out of stock, players
 * in the events still to come, today's sales and the open reservations. Each
 * one opens its page (`onOpen(navId)`).
 */
export default function DashboardStats({ products = [], events = [], transactions = [], reservations = [], now, onOpen }) {
  const today = getTodayDate(new Date(now));

  const outOfStock = products.filter((product) => Number(product.stock) === 0).length;
  const runningLow = products.filter(
    (product) => Number(product.stock) > 0 && Number(product.stock) <= Number(product.minStock)
  ).length;

  const activeEvents = events.filter((event) => ACTIVE_EVENT_STATUSES.has(String(event.status || "upcoming").toLowerCase()));
  const participants = activeEvents.reduce(
    (sum, event) => sum + (Array.isArray(event.participants) ? event.participants.length : 0),
    0
  );

  const todaySales = summarizeSales(getPeriodTransactions(transactions, { type: "daily", date: today }));
  const monthSales = summarizeSales(
    getPeriodTransactions(transactions, { type: "monthly", month: today.slice(5, 7), year: today.slice(0, 4) })
  );

  const openReservations = reservations.filter((reservation) => !HISTORY_STATUSES.has(reservation.status));
  const reservationsToday = openReservations.filter((reservation) => reservation.date === today).length;
  const waitingCheck = openReservations.filter((reservation) => reservation.status === "pending").length;

  const stats = [
    {
      id: "out-of-stock",
      page: { id: "inventory", label: "Inventory" },
      icon: "bi-box-seam",
      tone: outOfStock ? "red" : "green",
      value: outOfStock,
      label: "Out of stock",
      note: runningLow ? `${plural(runningLow, "product")} running low` : "Nothing else running low",
    },
    {
      id: "participants",
      page: { id: "events", label: "Events" },
      icon: "bi-people",
      tone: "purple",
      value: participants,
      label: "Participants",
      note: activeEvents.length ? `in ${plural(activeEvents.length, "upcoming event")}` : "No upcoming events",
    },
    {
      id: "sales-today",
      page: { id: "reports", label: "Sales Reports" },
      icon: "bi-cash-stack",
      tone: "green",
      value: formatPesoAmount(todaySales.revenue),
      label: "Total sales today",
      note: `${plural(todaySales.count, "sale")} · ${formatPesoAmount(monthSales.revenue)} this month`,
    },
    {
      id: "reservations",
      page: { id: "reservations", label: "Reservations" },
      icon: "bi-calendar-check",
      tone: waitingCheck ? "amber" : "blue",
      value: openReservations.length,
      label: "Reservations",
      note: `${reservationsToday} today${waitingCheck ? ` · ${waitingCheck} to check` : ""}`,
    },
  ];

  return <DashboardStatCards stats={stats} label="Today at a glance" onOpen={onOpen} />;
}
