import { useEffect, useState } from "react";
import "../../styles/TableHistory.css";
import { fetchTableHistory } from "../../utils/tableHistoryApi";
import { describePaidBy } from "../../utils/bookingPayments";
import { describeReservationTime, formatHoursLabel, formatReservationDate, getTodayDate } from "../../utils/reservations";
import { formatPesoAmount, methodLabel } from "../../utils/salesReport";
import { formatClockTime } from "../../utils/tableCharges";
import { countOrderItems } from "../../utils/tableOrders";
import { formatMobile } from "../../utils/siteSettings";
import { normalizeAuditLogs } from "../../utils/audit";
import { auditTypeLabel, sortNewestFirst } from "../../utils/auditReport";
import { normalizeText } from "../../utils/auditSearch";

const DAY_MS = 24 * 60 * 60 * 1000;

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
];

// The narrowing chips over each tab; `match` reads one item.
const SALE_FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "paid", label: "Paid", match: (charge) => charge.status === "paid" },
  { id: "unpaid", label: "Unpaid", match: (charge) => charge.status !== "paid" },
  { id: "cash", label: "Cash", match: (charge) => charge.paidVia === "cash" },
  { id: "gcash", label: "GCash", match: (charge) => charge.paidVia === "ewallet" },
  { id: "online", label: "Paid with booking", match: (charge) => charge.paidVia === "online" || charge.prepaid?.amount > 0 },
  { id: "orders", label: "With orders", match: (charge) => (charge.orders || []).length > 0 },
];
const UPCOMING_BOOKING = new Set(["pending", "approved", "reserved", "arrived", "seated"]);
const BOOKING_FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "completed", label: "Completed", match: (booking) => booking.status === "completed" },
  { id: "upcoming", label: "Not done yet", match: (booking) => UPCOMING_BOOKING.has(booking.status) },
  { id: "cancelled", label: "Cancelled / rejected", match: (booking) => ["cancelled", "rejected"].includes(booking.status) },
  { id: "noshow", label: "No-show", match: (booking) => booking.status === "expired" },
  { id: "online", label: "Booked online", match: (booking) => booking.source === "online" },
];

// Every typed word somewhere in the item's text.
const matchesWords = (words, parts) => {
  if (!words.length) return true;
  const text = normalizeText(parts.filter(Boolean).join(" "));
  return words.every((word) => text.includes(word));
};
const saleText = (charge) => [
  charge.customer,
  charge.endedBy,
  charge.paidBy,
  charge.paidVia,
  charge.prepaid?.reference,
  ...(charge.orders || []).map((line) => line.name),
  ...(charge.payments || []).map((payment) => payment.method),
];
const bookingText = (booking) => [booking.customerName, booking.phone, booking.source, booking.status, booking.paymentReference, booking.notes];
const logText = (log) => [log.staff, log.action, log.detail, log.type, auditTypeLabel(log.type)];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// An Audit Trail event about this table: saved with it, or naming it ("Table 1", not "Table 10").
const touchesTable = (log, row) => {
  if (log.table && (String(log.table.id) === String(row.id) || normalizeText(log.table.name) === normalizeText(row.name))) return true;
  return new RegExp(`\\b${escapeRegex(normalizeText(row.name))}(?![\\d])`).test(normalizeText(`${log.action} ${log.detail}`));
};

function FilterChips({ filters, value, onChange, items, label }) {
  return (
    <div className="th-filters" role="group" aria-label={label}>
      {filters.map((filter) => {
        const count = items.filter(filter.match).length;
        if (filter.id !== "all" && filter.id !== value && count === 0) return null;
        return (
          <button
            key={filter.id}
            type="button"
            className={`th-filter${value === filter.id ? " is-active" : ""}`}
            aria-pressed={value === filter.id}
            onClick={() => onChange(filter.id)}
          >
            {filter.label} <span>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function ActivityItem({ log, today, onOpen }) {
  return (
    <li>
      <button type="button" className="th-item th-activity" onClick={() => onOpen?.(log)} disabled={!onOpen}>
        <div className="th-when">
          <strong>{describeDay(String(log.date).slice(0, 10), today)}</strong>
          <span>{log.time}</span>
        </div>
        <div className="th-who">
          <strong>
            {log.action} <span className="th-activity-by">by {log.staff}</span>
          </strong>
          <span>{log.detail}</span>
        </div>
        <div className="th-money">
          <span className="th-chip tone-blue">{auditTypeLabel(log.type)}</span>
        </div>
      </button>
    </li>
  );
}

const BOOKING_STATES = {
  pending: { label: "Payment to check", tone: "amber" },
  approved: { label: "Confirmed", tone: "green" },
  reserved: { label: "Table held", tone: "gold" },
  arrived: { label: "Arrived", tone: "blue" },
  seated: { label: "Playing", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
  rejected: { label: "Rejected", tone: "red" },
  expired: { label: "No-show", tone: "grey" },
};

// "2026-10-30" moved by whole days (noon, so a clock change never skips one).
const shiftDay = (date, days) => getTodayDate(new Date(new Date(`${date}T12:00:00`).getTime() + days * DAY_MS));

const getRange = (period, today, day) => {
  if (period === "yesterday") return { from: shiftDay(today, -1), to: shiftDay(today, -1) };
  if (period === "week") return { from: shiftDay(today, -6), to: today };
  if (period === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (period === "day" && day) return { from: day, to: day };
  return { from: today, to: today };
};

const describeDay = (date, today) =>
  date === today ? "Today" : date === shiftDay(today, -1) ? "Yesterday" : formatReservationDate(date);

const endDay = (charge) => getTodayDate(new Date(Number(charge.endTime)));
const tableKey = (id) => String(Number(id));
const saleTotal = (charge) => Number(charge.sessionTotal || 0) + Number(charge.ordersTotal || 0);

const sumSales = (charges) =>
  charges.reduce(
    (sum, charge) => ({
      time: sum.time + Number(charge.sessionTotal || 0),
      orders: sum.orders + Number(charge.ordersTotal || 0),
      unpaid: sum.unpaid + (charge.status === "paid" ? 0 : Number(charge.amountDue || 0)),
    }),
    { time: 0, orders: 0, unpaid: 0 }
  );

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// How a session's bill was settled: the chip, and the details under it.
const describePayment = (charge) => {
  const notes = [];
  if (charge.prepaid?.amount > 0) notes.push(`${formatPesoAmount(charge.prepaid.amount)} paid with the booking`);
  if (charge.paidEarlier > 0) notes.push(`${formatPesoAmount(charge.paidEarlier)} paid while playing`);
  if (charge.status !== "paid") {
    notes.push(`${formatPesoAmount(charge.amountDue)} waiting in Sales / POS`);
    return { label: "Unpaid", tone: "amber", notes };
  }
  if (charge.paidBy) {
    notes.push(`Paid by ${charge.paidBy}${charge.paidAt ? `, ${formatClockTime(new Date(charge.paidAt).getTime())}` : ""}`);
  }
  const how =
    charge.paidVia === "earlier" ? "Paid while playing" : charge.paidVia === "online" ? "Paid with booking" : charge.paidVia ? `Paid · ${methodLabel(charge.paidVia)}` : "Paid";
  return { label: how, tone: "green", notes };
};

function SaleItem({ charge, today }) {
  const orders = charge.orders || [];
  const items = countOrderItems(orders);
  const added = Number(charge.addedMinutes || 0);
  const payment = describePayment(charge);
  const meta = [charge.endedBy ? `Ended by ${charge.endedBy}` : "", ...payment.notes].filter(Boolean);

  return (
    <li className="th-item">
      <div className="th-when">
        <strong>{describeDay(endDay(charge), today)}</strong>
        <span>
          {formatClockTime(charge.startTime)} - {formatClockTime(charge.endTime)}
        </span>
      </div>
      <div className="th-who">
        <strong>{charge.customer || "Walk-in"}</strong>
        <span>
          {formatHoursLabel(charge.bookedMinutes)}
          {added > 0 ? ` (incl. ${formatHoursLabel(added)} added)` : ""} · Table time {formatPesoAmount(charge.sessionTotal)}
        </span>
        <span>
          {items
            ? `Orders ${formatPesoAmount(charge.ordersTotal)}: ${orders.map((line) => `${line.name} ×${line.qty}`).join(", ")}`
            : "No orders"}
        </span>
      </div>
      <div className="th-money">
        <strong>{formatPesoAmount(saleTotal(charge))}</strong>
        <span className={`th-chip tone-${payment.tone}`}>{payment.label}</span>
      </div>
      {meta.length > 0 && <p className="th-meta">{meta.join(" · ")}</p>}
    </li>
  );
}

function BookingItem({ booking, today }) {
  const state = BOOKING_STATES[booking.status] || { label: booking.status, tone: "grey" };
  const contact = [formatMobile(booking.phone), booking.source === "online" ? "Booked online" : "Booked at the desk"].filter(Boolean);
  const paid = Number(booking.paymentAmount || 0);

  return (
    <li className="th-item">
      <div className="th-when">
        <strong>{describeDay(booking.date, today)}</strong>
        <span>{describeReservationTime(booking) || booking.time}</span>
      </div>
      <div className="th-who">
        <strong>{booking.customerName}</strong>
        <span>{contact.join(" · ")}</span>
        {paid > 0 && (
          <span>
            {formatPesoAmount(paid)}{" "}
            {booking.status === "pending"
              ? "sent by GCash, not checked yet"
              : booking.paymentRefund
                ? "given back"
                : `paid ${describePaidBy(booking)}`}
          </span>
        )}
      </div>
      <div className="th-money">
        <span className={`th-chip tone-${state.tone}`}>{state.label}</span>
      </div>
    </li>
  );
}

/**
 * History: what each table took and who booked it, a day or a stretch of days
 * at a time. A table's sales are its ended sessions (table time and what was
 * ordered at it, paid or still waiting in Sales / POS); its reservations are
 * the bookings for those days, whatever became of them. Each list narrows by
 * chips and by the words typed in Search. Reading only.
 *
 * `logs` (the admin's Audit Trail) adds an Activity tab: everything the
 * Audit Trail recorded about the table on those days; `onOpenLog` opens one.
 */
export default function TableHistory({ tables = [], reservations = [], tableCharges = [], now, logs = null, onOpenLog }) {
  const today = getTodayDate(new Date(now));
  const [period, setPeriod] = useState("today");
  const [day, setDay] = useState("");
  const [shownKey, setShownKey] = useState(null);
  const [tab, setTab] = useState("sales");
  const [saleFilter, setSaleFilter] = useState("all");
  const [bookingFilter, setBookingFilter] = useState("all");
  const [activityType, setActivityType] = useState("all");
  const [search, setSearch] = useState("");
  const words = normalizeText(search).split(" ").filter(Boolean);
  // The server's bills for the days shown; the screens' own list leaves out
  // bills paid days ago.
  const [loaded, setLoaded] = useState({ range: "", charges: [], more: false, error: "" });

  const { from, to } = getRange(period, today, day);
  const rangeKey = `${from}|${to}`;
  const loading = loaded.range !== rangeKey;

  useEffect(() => {
    let cancelled = false;
    const range = `${from}|${to}`;
    fetchTableHistory({ from, to }).then(
      ({ charges, more }) => {
        if (!cancelled) setLoaded({ range, charges, more, error: "" });
      },
      (error) => {
        if (!cancelled) setLoaded({ range, charges: [], more: false, error: error.message });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  // This screen's copy wins: it has a bill just ended or paid here.
  const byId = new Map();
  const inRange = (charge) => {
    const ended = endDay(charge);
    return ended >= from && ended <= to;
  };
  if (!loading) loaded.charges.filter(inRange).forEach((charge) => byId.set(String(charge.id), charge));
  tableCharges.filter(inRange).forEach((charge) => byId.set(String(charge.id), charge));
  const charges = [...byId.values()].sort((first, second) => Number(second.endTime) - Number(first.endTime));
  const bookings = reservations
    .filter((booking) => booking.date >= from && booking.date <= to)
    .sort((first, second) => `${second.date} ${second.time}`.localeCompare(`${first.date} ${first.time}`));

  // Every table, plus any removed since that still has sales or bookings here.
  const rows = new Map(
    tables.map((table) => [
      tableKey(table.id),
      { key: tableKey(table.id), id: table.id, name: table.name || `Table ${table.id}`, table, sales: [], bookings: [] },
    ])
  );
  const rowOf = (id, name) => {
    const key = tableKey(id);
    if (key === "NaN") return null;
    if (!rows.has(key)) rows.set(key, { key, id, name: name || `Table ${id}`, table: null, sales: [], bookings: [] });
    return rows.get(key);
  };
  charges.forEach((charge) => rowOf(charge.tableId, charge.tableName)?.sales.push(charge));
  bookings.forEach((booking) => rowOf(booking.tableId ?? booking.table, booking.tableName)?.bookings.push(booking));
  const list = [...rows.values()].sort((first, second) => Number(first.id) - Number(second.id));
  const shown = list.find((row) => row.key === shownKey) || list[0] || null;

  const all = sumSales(charges);
  const shownSales = shown ? sumSales(shown.sales) : null;

  // The picked table's lists, as narrowed by the chips and the search.
  const saleMatch = SALE_FILTERS.find((filter) => filter.id === saleFilter)?.match || (() => true);
  const bookingMatch = BOOKING_FILTERS.find((filter) => filter.id === bookingFilter)?.match || (() => true);
  const searchedSales = shown ? shown.sales.filter((charge) => matchesWords(words, saleText(charge))) : [];
  const searchedBookings = shown ? shown.bookings.filter((booking) => matchesWords(words, bookingText(booking))) : [];
  const visibleSales = searchedSales.filter(saleMatch);
  const visibleBookings = searchedBookings.filter(bookingMatch);
  const tableLogs =
    logs && shown
      ? sortNewestFirst(normalizeAuditLogs(logs)).filter((log) => {
          const day = String(log.date || "").slice(0, 10);
          return day >= from && day <= to && touchesTable(log, shown);
        })
      : [];
  const activityFilters = [
    { id: "all", label: "All", match: () => true },
    ...[...new Set(tableLogs.map((log) => log.type || "other"))].map((type) => ({
      id: type,
      label: auditTypeLabel(type),
      match: (log) => (log.type || "other") === type,
    })),
  ];
  const searchedLogs = tableLogs.filter((log) => matchesWords(words, logText(log)));
  const visibleLogs = searchedLogs.filter(activityFilters.find((filter) => filter.id === activityType)?.match || (() => true));
  const narrowed = words.length > 0;

  return (
    <div className="th-page">
      <div className="th-toolbar">
        <div className="th-periods" role="group" aria-label="Days to show">
          {PERIODS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`th-period${period === entry.id ? " is-active" : ""}`}
              aria-pressed={period === entry.id}
              onClick={() => setPeriod(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <label className="th-day">
          <span>Or a day</span>
          <input
            type="date"
            className={period === "day" ? "is-active" : ""}
            max={today}
            value={period === "day" ? day : ""}
            onChange={(event) => {
              setDay(event.target.value);
              setPeriod(event.target.value ? "day" : "today");
            }}
          />
        </label>
        <label className="th-search">
          <i className="bi bi-search" aria-hidden="true"></i>
          <input
            type="search"
            aria-label="Search this table's history"
            placeholder={logs ? "Search customer, order, staff, reference…" : "Search customer, order, reference…"}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <section className="th-summary" aria-label="All tables for these days">
        <div className="th-summary-cell">
          <span className="th-summary-label">Sessions</span>
          <strong className="th-summary-value">{charges.length}</strong>
        </div>
        <div className="th-summary-cell">
          <span className="th-summary-label">Table time</span>
          <strong className="th-summary-value">{formatPesoAmount(all.time)}</strong>
        </div>
        <div className="th-summary-cell">
          <span className="th-summary-label">Orders</span>
          <strong className="th-summary-value">{formatPesoAmount(all.orders)}</strong>
        </div>
        <div className="th-summary-cell is-total">
          <span className="th-summary-label">Total sales</span>
          <strong className="th-summary-value">{formatPesoAmount(all.time + all.orders)}</strong>
          {all.unpaid > 0 && <span className="th-summary-note">{formatPesoAmount(all.unpaid)} still unpaid</span>}
        </div>
        <div className="th-summary-cell">
          <span className="th-summary-label">Reservations</span>
          <strong className="th-summary-value">{bookings.length}</strong>
        </div>
      </section>

      {loading ? (
        <p className="th-note" role="status">
          <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
          Loading the table bills for these days…
        </p>
      ) : loaded.error ? (
        <p className="th-note is-warning" role="status">
          <i className="bi bi-wifi-off" aria-hidden="true"></i>
          Only the bills on this device are shown. {loaded.error}
        </p>
      ) : loaded.more ? (
        <p className="th-note is-warning" role="status">
          <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
          Too many bills to show them all, so the oldest are left out. Choose fewer days.
        </p>
      ) : null}

      {shown ? (
        <div className="th-layout">
          <nav className="th-tables" aria-label="Tables">
            {list.map((row) => {
              const total = sumSales(row.sales);
              return (
                <button
                  key={row.key}
                  type="button"
                  className={`th-table${row.key === shown.key ? " is-active" : ""}`}
                  aria-current={row.key === shown.key ? "true" : undefined}
                  onClick={() => setShownKey(row.key)}
                >
                  <span className={`th-table-felt is-${row.table?.status || "removed"}`} aria-hidden="true"></span>
                  <span className="th-table-text">
                    <span className="th-table-name">{row.name}</span>
                    <span className="th-table-meta">
                      {plural(row.sales.length, "sale")} · {plural(row.bookings.length, "booking")}
                    </span>
                  </span>
                  <span className="th-table-total">{formatPesoAmount(total.time + total.orders)}</span>
                </button>
              );
            })}
          </nav>

          <section className="th-detail" aria-labelledby="th-detail-title">
            <header className="th-detail-head">
              <div>
                <h2 className="card-title th-detail-title" id="th-detail-title">
                  {shown.name}
                </h2>
                <p className="th-detail-sub">
                  {shown.table ? `${formatPesoAmount(shown.table.rate)}/hr` : "No longer on Pool Tables"}
                  {from === to ? ` · ${describeDay(from, today)}` : ` · ${formatReservationDate(from)} - ${formatReservationDate(to)}`}
                </p>
              </div>
              <dl className="th-detail-totals">
                <div>
                  <dt>Table time</dt>
                  <dd>{formatPesoAmount(shownSales.time)}</dd>
                </div>
                <div>
                  <dt>Orders</dt>
                  <dd>{formatPesoAmount(shownSales.orders)}</dd>
                </div>
                <div className="is-total">
                  <dt>Total sales</dt>
                  <dd>{formatPesoAmount(shownSales.time + shownSales.orders)}</dd>
                </div>
              </dl>
            </header>

            <div className="th-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "sales"}
                className={`th-tab${tab === "sales" ? " is-active" : ""}`}
                onClick={() => setTab("sales")}
              >
                <i className="bi bi-receipt" aria-hidden="true"></i>
                Sales and orders
                <span className="th-tab-count">{shown.sales.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "reservations"}
                className={`th-tab${tab === "reservations" ? " is-active" : ""}`}
                onClick={() => setTab("reservations")}
              >
                <i className="bi bi-calendar-check" aria-hidden="true"></i>
                Reservations
                <span className="th-tab-count">{shown.bookings.length}</span>
              </button>
              {logs && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "activity"}
                  className={`th-tab${tab === "activity" ? " is-active" : ""}`}
                  onClick={() => setTab("activity")}
                >
                  <i className="bi bi-list-check" aria-hidden="true"></i>
                  Activity
                  <span className="th-tab-count">{tableLogs.length}</span>
                </button>
              )}
            </div>

            {tab === "sales" && (
              <>
                <FilterChips filters={SALE_FILTERS} value={saleFilter} onChange={setSaleFilter} items={searchedSales} label="Show sales" />
                {visibleSales.length ? (
                  <ul className="th-list">
                    {visibleSales.map((charge) => (
                      <SaleItem key={charge.id} charge={charge} today={today} />
                    ))}
                  </ul>
                ) : (
                  <p className="th-empty">
                    <i className="bi bi-receipt" aria-hidden="true"></i>
                    {loading
                      ? "Loading…"
                      : shown.sales.length
                        ? "No sales match the search or filter."
                        : `No sessions ended on ${shown.name} on these days.`}
                  </p>
                )}
              </>
            )}

            {tab === "reservations" && (
              <>
                <FilterChips filters={BOOKING_FILTERS} value={bookingFilter} onChange={setBookingFilter} items={searchedBookings} label="Show reservations" />
                {visibleBookings.length ? (
                  <ul className="th-list">
                    {visibleBookings.map((booking) => (
                      <BookingItem key={booking.id} booking={booking} today={today} />
                    ))}
                  </ul>
                ) : (
                  <p className="th-empty">
                    <i className="bi bi-calendar2" aria-hidden="true"></i>
                    {shown.bookings.length
                      ? "No reservations match the search or filter."
                      : `No reservations for ${shown.name} on these days.`}
                  </p>
                )}
              </>
            )}

            {tab === "activity" && logs && (
              <>
                <FilterChips filters={activityFilters} value={activityType} onChange={setActivityType} items={searchedLogs} label="Show activity" />
                {visibleLogs.length ? (
                  <ul className="th-list">
                    {visibleLogs.map((log) => (
                      <ActivityItem key={log.id} log={log} today={today} onOpen={onOpenLog} />
                    ))}
                  </ul>
                ) : (
                  <p className="th-empty">
                    <i className="bi bi-list-check" aria-hidden="true"></i>
                    {tableLogs.length
                      ? "No activity matches the search or filter."
                      : `The Audit Trail has nothing about ${shown.name} on these days.`}
                  </p>
                )}
              </>
            )}
            {narrowed && (
              <p className="th-search-note">
                <i className="bi bi-search" aria-hidden="true"></i>
                Showing what matches &ldquo;{search.trim()}&rdquo;.{" "}
                <button type="button" onClick={() => setSearch("")}>Clear search</button>
              </p>
            )}
          </section>
        </div>
      ) : (
        <p className="th-empty">
          <i className="bi bi-grid" aria-hidden="true"></i>
          No tables yet. They are added in the admin&apos;s Pool Tables.
        </p>
      )}
    </div>
  );
}
