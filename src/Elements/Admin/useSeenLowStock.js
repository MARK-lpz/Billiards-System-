import { useEffect, useState } from "react";
import { SEEN_LOW_STOCK_KEY } from "../../utils/lowStock";

/**
 * The low-stock alerts already opened on this device. Only alerts still showing
 * are kept, so a product restocked and running low again later counts as new.
 * Returns [seen, markSeen(keys)].
 */
export default function useSeenLowStock(currentKeys) {
  const [seen, setSeen] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SEEN_LOW_STOCK_KEY) || "[]");
      return new Set(Array.isArray(stored) ? stored : []);
    } catch {
      return new Set();
    }
  });
  const showing = currentKeys.join("|");

  useEffect(() => {
    const still = new Set(showing ? showing.split("|") : []);
    try {
      localStorage.setItem(SEEN_LOW_STOCK_KEY, JSON.stringify([...seen].filter((key) => still.has(key))));
    } catch (error) {
      console.warn("Unable to keep the seen low-stock alerts", error);
    }
  }, [seen, showing]);

  const markSeen = (keys) =>
    setSeen((previous) => (keys.every((key) => previous.has(key)) ? previous : new Set([...previous, ...keys])));

  return [seen, markSeen];
}
