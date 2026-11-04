import useSeenLowStock from "../Admin/useSeenLowStock";
import { getStockAlarm, stockAlarmKey } from "../../utils/productShelf";
import { getTodayDate } from "../../utils/reservations";

const SEEN_STOCK_ALARM_KEY = "seenStockAlarm";
// The kinds the bell counts; expiring soon is only on the Stock Alarm page.
const ALERTED = ["expired", "low", "fresh"];

/**
 * The employee's stock alarm (utils/productShelf.js getStockAlarm), kept for
 * the Stock Alarm page, the dashboard's card, the sidebar and the bell alike,
 * with the alarms already seen on this device: opening one in either clears it
 * in all. `now`: ms.
 */
export default function useStockAlarm(products, now) {
  const today = getTodayDate(new Date(now));
  const alarm = getStockAlarm(products, today, now);
  const keys = ALERTED.flatMap((kind) => alarm[kind].map((entry) => stockAlarmKey(kind, entry)));
  const [seen, markSeen] = useSeenLowStock(keys, SEEN_STOCK_ALARM_KEY);
  const isNew = (kind, entry) => ALERTED.includes(kind) && !seen.has(stockAlarmKey(kind, entry));
  const markKindSeen = (kind) => markSeen(alarm[kind].map((entry) => stockAlarmKey(kind, entry)));

  return { alarm, today, now, isNew, markSeen, markKindSeen, markAllSeen: () => markSeen(keys) };
}
