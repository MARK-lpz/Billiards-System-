import { useEffect, useState } from "react";
import { SEEN_REGISTRATIONS_KEY, readSeenRegistrations } from "../../utils/tournamentRegistrations";

/**
 * The player registrations already opened on this device, shared by the
 * employee's bell and the Tournament Schedule (both keep it in localStorage).
 * `alsoSeen` counts as seen from the start, e.g. the player a bell just opened.
 * Returns [seen, markSeen(keys)].
 */
export default function useSeenRegistrations(events, alsoSeen = []) {
  const [seen, setSeen] = useState(() => {
    const initial = readSeenRegistrations(events);
    alsoSeen.forEach((key) => initial.add(key));
    return initial;
  });

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
