import { useState } from "react";
import { formatReservationDate, formatReservationTime } from "../../utils/reservations";
import { getTableBookings, getUpcomingBookings } from "../../utils/tableHolds";
import TableBookingsModal from "./TableBookingsModal";

// "3:00 PM" today, or "Oct 31, 3:00 PM" on another day.
const describeWhen = (booking, today) =>
  booking.date === today
    ? formatReservationTime(booking.time)
    : `${formatReservationDate(booking.date).replace(/, \d{4}$/, "")}, ${formatReservationTime(booking.time)}`;

/**
 * Every pool table on the dashboard, seen from above in its status color, with
 * the next confirmed booking on it (the same ones Pool Tables shows). The title
 * opens Pool Tables; a table opens its reservations in a pop-up. `now` is the
 * dashboard's clock, so a booking drops off once it has passed.
 */
export default function ActiveTables({ tables = [], reservations = [], now, onViewPoolTables, onViewReservations }) {
  // The table whose reservations are open in the pop-up.
  const [shownId, setShownId] = useState(null);
  const clock = new Date(now);
  const today = clock.toLocaleDateString("en-CA");
  const activeCount = tables.filter((t) => t.status === "occupied").length;
  const reservedCount = tables.filter((t) => t.status === "reserved").length;
  const availableCount = tables.filter((t) => t.status === "available").length;
  const bookingsOf = new Map(tables.map((table) => [table.id, getUpcomingBookings(table, reservations, clock)]));
  const bookedToday = [...bookingsOf.values()].flat().filter((booking) => booking.date === today).length;
  const shownTable = tables.find((table) => table.id === shownId) || null;

  return (
    <>
      <div className="content-card active-tables-card">
        <div className="card-header active-tables-header">
          <button type="button" className="active-tables-link" onClick={onViewPoolTables} title="Open Pool Tables">
            <h2 className="card-title">Active Tables</h2>
            <i className="bi bi-arrow-right" aria-hidden="true"></i>
          </button>
          <span className="badge">{activeCount} Active</span>
        </div>
        <div className="active-tables-grid">
          {tables.map((table) => {
            const [next, ...later] = bookingsOf.get(table.id) || [];
            const tableName = table.name || `T${table.id}`;
            return (
              <button
                key={table.id}
                type="button"
                className={`mini-table-card ${table.status}`}
                onClick={() => setShownId(table.id)}
                aria-label={`${tableName}, ${table.status}${next ? `, next booking ${describeWhen(next, today)}` : ", no bookings"}. Show its reservations.`}
              >
                <span className="table-number">{tableName}</span>
                <span className="table-status">
                  {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                </span>
                {next ? (
                  <span className="mini-table-booking">
                    <i className="bi bi-calendar-event" aria-hidden="true"></i>
                    <span className="mini-table-booking-text">
                      {describeWhen(next, today)} · {next.customerName}
                    </span>
                    {later.length > 0 && <span className="mini-table-booking-more">+{later.length}</span>}
                  </span>
                ) : (
                  <span className="mini-table-booking is-empty">No bookings</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="active-table-summary" style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <span>{availableCount} Available</span>
          <span>{activeCount} Occupied</span>
          <span>{reservedCount} Reserved</span>
          <span>{bookedToday} Booked today</span>
        </div>
      </div>

      {/* Outside the card: the card lifts on hover, which would carry a fixed pop-up with it. */}
      {shownTable && (
        <TableBookingsModal
          table={shownTable}
          bookings={getTableBookings(shownTable, reservations, clock)}
          now={now}
          onClose={() => setShownId(null)}
          onOpenReservations={() => {
            setShownId(null);
            onViewReservations?.();
          }}
        />
      )}
    </>
  );
}
