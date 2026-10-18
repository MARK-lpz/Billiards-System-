import { useCallback, useEffect, useMemo, useState } from "react";
import { OnlinePaymentsContext } from "./OnlinePaymentsContext";
import { fetchOnlinePayments } from "../../utils/paymentsApi";

// As often as the reservations are synced, so a new payment shows with its booking.
const REFRESH_MS = 3000;

/**
 * Gives the staff screens the website's GCash payments (utils/onlinePayments.js),
 * read from the server while staff are signed in (`enabled`). `applySaved`
 * takes a payment the server just answered with, so the change shows at once;
 * `refresh` asks again now (after a booking's payment moved with it).
 */
export function OnlinePaymentsProvider({ enabled, children }) {
  const [state, setState] = useState({ payments: [], loaded: false });
  // Bumped by refresh(), which asks the server again at once.
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const payments = await fetchOnlinePayments();
        if (!active) return;
        setState((previous) =>
          previous.loaded && JSON.stringify(previous.payments) === JSON.stringify(payments) ? previous : { payments, loaded: true }
        );
      } catch (error) {
        console.warn("Unable to load the GCash payments", error);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "hidden") load();
    };

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, asked]);

  const applySaved = useCallback((payment) => {
    if (!payment?.id) return;
    setState((previous) => {
      const known = previous.payments.some((entry) => entry.id === payment.id);
      return {
        ...previous,
        payments: known
          ? previous.payments.map((entry) => (entry.id === payment.id ? payment : entry))
          : [payment, ...previous.payments],
      };
    });
  }, []);

  const refresh = useCallback(() => setAsked((count) => count + 1), []);

  const value = useMemo(
    () => ({ payments: enabled ? state.payments : [], loaded: enabled && state.loaded, applySaved, refresh }),
    [enabled, state, applySaved, refresh]
  );

  return <OnlinePaymentsContext.Provider value={value}>{children}</OnlinePaymentsContext.Provider>;
}
