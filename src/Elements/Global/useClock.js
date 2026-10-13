import { useEffect, useState } from "react";

/** The current time in ms, refreshed every `intervalMs`, for what changes with the clock. */
export default function useClock(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
