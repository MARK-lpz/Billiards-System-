import { useEffect, useState } from "react";
import { SEEN_REGISTRATIONS_KEY, readSeenRegistrations } from "../../utils/tournamentRegistrations";

/**
 * The player registrations already opened on this device, kept in localStorage.
 * The employee dashboard holds it once and hands it to both the bell and the
 * Tournament Schedule, so opening a player in either clears it in both.
 * Returns [seen, markSeen(keys)].
 */
export default function useSeenRegistrations(events) {
  const [seen, setSeen] = useState(() => readSeenRegistrations(events));

  useEffect(() => {
    try {
      // The latest 500 are plenty to tell new players from ones already seen.
      localStorage.setItem(SEEN_REGISTRATIONS_KEY, JSON.stringify([...seen].slice(-500)));
    } catch (error) {
      console.warn("Unable to keep the seen registrations", error);
    }
  }, [seen]);

  const markSeen = (keys) =>
    setSeen((previous) => (keys.every((key) => previous.has(key)) ? previous : new Set([...previous, ...keys])));

  return [seen, markSeen];
}
