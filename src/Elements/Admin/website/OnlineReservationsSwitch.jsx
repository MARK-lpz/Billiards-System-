import { useState } from "react";
import { useSiteSettings } from "../../Global/useSiteSettings";
import { appendAuditLog } from "../../../utils/audit";

/**
 * Whether the website takes table bookings, on the Website page of both panels
 * (it was on Admin > Reservations). It changes at once, with no Save, and the
 * website follows within seconds. Open still waits for the GCash details
 * before anyone can book, which the line under it says.
 */
export default function OnlineReservationsSwitch({ open, updating, onChange, staff, setLogs }) {
  const { settings } = useSiteSettings();
  const [error, setError] = useState("");
  const gcashReady = Boolean(settings.gcash?.ready);

  const toggle = async () => {
    if (!onChange || updating) return;
    const next = !open;
    setError("");
    try {
      await onChange(next);
      appendAuditLog(setLogs, {
        type: "settings",
        staff,
        action: next ? "Opened online reservations" : "Closed online reservations",
        detail: next ? "Online reservations: open to the public." : "Online reservations: temporarily closed.",
        entity: "website",
      });
    } catch (failure) {
      setError(failure?.message || "Could not change it. Please try again.");
    }
  };

  return (
    <div className="website-booking-switch">
      <div className={`online-reservations-status ${open ? "is-open" : "is-closed"}`}>
        <span>
          <strong>Online reservations</strong>
          <small>{!open ? "Temporarily closed" : gcashReady ? "Open to the public" : "On, but waits for the GCash details"}</small>
        </span>
        <button
          type="button"
          className="online-reservations-toggle"
          role="switch"
          aria-checked={open}
          aria-label={open ? "Close online reservations" : "Open online reservations"}
          disabled={updating}
          onClick={toggle}
        >
          <span aria-hidden="true"></span>
        </button>
      </div>
      {error && (
        <span className="website-booking-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
