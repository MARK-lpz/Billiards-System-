import useClock from "./useClock";
import useSeenLowStock from "../Admin/useSeenLowStock";
import { formatHoursLabel } from "../../utils/reservations";
import { formatPeso } from "../../utils/tableSession";
import { createTableCharge, formatClockTime } from "../../utils/tableCharges";
import { SEEN_TIME_UP_KEYS, getTimeUpTables } from "../../utils/timeUp";

const minutesAgo = (minutes) =>
  minutes < 1 ? "just now" : `${formatHoursLabel(minutes)} ago`;

/**
 * The bell's "Tables" section, for the admin's and the employee's bells: every
 * table whose time is up and whose session has not been ended. It stays after
 * the time's up pop-up is closed, and leaves once time is added or the session
 * ends. Opening one goes to Pool Tables; End Session opens its bill.
 * `role` ("admin" | "employee") keeps each bell's opened alerts apart.
 * Returns { section, markAllSeen }.
 */
export default function useTimeUpSection({ role, tables = [], reservations = [], onOpenTables, onEndSession }) {
  const now = useClock(15000);
  const timeUp = getTimeUpTables(tables, now);
  const [seen, markSeen] = useSeenLowStock(timeUp.map((entry) => entry.key), SEEN_TIME_UP_KEYS[role]);
  const isNew = (entry) => !seen.has(entry.key);

  const section = {
    key: "time-up",
    title: "Tables",
    icon: "bi-alarm",
    newCount: timeUp.filter(isNew).length,
    empty: "No table has run out of time.",
    items: timeUp.map((entry) => {
      const { table, endsAt, key } = entry;
      const tableName = table.name || `Table ${table.id}`;
      // Table time and orders, less what was paid online or while playing, as the pop-up shows.
      const due = createTableCharge({ table, reservations, tableCharges: [], endedBy: "", now: endsAt }).amountDue;
      const open = () => {
        markSeen([key]);
        onOpenTables();
      };
      return {
        key,
        unread: isNew(entry),
        icon: "bi-alarm-fill staff-bell-icon--danger",
        title: (
          <>
            <strong>{tableName}</strong>: time is up for {table.customer || "the customer"}
          </>
        ),
        meta: `Ended ${formatClockTime(endsAt)} (${minutesAgo(Math.floor((now - endsAt) / 60000))}) · ${
          due > 0 ? `${formatPeso(due)} to collect` : "Paid"
        }`,
        state: { label: "Time's up", tone: "danger" },
        onOpen: open,
        actions: [
          { label: "View", icon: "bi-box-arrow-up-right", onClick: open },
          {
            label: "End Session",
            icon: "bi-stop-circle",
            tone: "danger",
            onClick: () => {
              markSeen([key]);
              onEndSession(table.id);
            },
          },
        ],
      };
    }),
  };

  return { section, markAllSeen: () => markSeen(timeUp.map((entry) => entry.key)) };
}
