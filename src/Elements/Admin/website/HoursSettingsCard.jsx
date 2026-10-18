import SiteCard from "./SiteCard";
import useSiteSectionDraft from "./useSiteSectionDraft";
import useClock from "../../Global/useClock";
import {
  addMinutesToTime,
  formatHoursLabel,
  formatOpeningHours,
  formatReservationDate,
  formatReservationTime,
} from "../../../utils/reservations";

// Every half hour of the day, the steps the opening hours are set in.
const HALF_HOURS = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`);
const toMinutes = (time) => {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
};
// Bookings still to come that the new hours would leave outside.
const UPCOMING = new Set(["pending", "approved", "reserved"]);

/**
 * When the hall is open. Online bookings must start at or after opening and
 * end by closing (the website and the server both hold to it), the website is
 * closed for booking outside them, and the staff booking forms use the closing
 * time as their cutoff. Same-day hours only: closing is after opening.
 */
export default function HoursSettingsCard({ reservations = [], setLogs }) {
  const draft = useSiteSectionDraft({
    section: "hours",
    label: "opening hours",
    fieldLabels: { open: "opening time", close: "closing time" },
    setLogs,
  });
  const { open, close } = draft.draft;
  const length = toMinutes(close) - toMinutes(open);
  const valid = length >= 60;
  const today = new Date(useClock(60000)).toLocaleDateString("en-CA");

  const outside = valid
    ? reservations.filter((booking) => {
        if (!UPCOMING.has(booking.status) || !booking.date || booking.date < today || !booking.time) return false;
        const start = toMinutes(booking.time);
        return start < toMinutes(open) || start + Number(booking.durationMinutes || 60) > toMinutes(close);
      })
    : [];

  return (
    <SiteCard
      icon="bi-clock"
      title="Opening hours"
      description="Online bookings must start and end inside these hours. Outside them, the website is closed for booking."
      chip={{ tone: "on", label: formatOpeningHours(draft.saved) }}
      draft={{ ...draft, dirty: draft.dirty && valid }}
    >
      <div className="website-fields">
        <div className="website-fields-row">
          <label className="website-field">
            Opens at
            <select value={open} onChange={(event) => draft.update("open", event.target.value)}>
              {HALF_HOURS.map((time) => (
                <option key={time} value={time}>
                  {formatReservationTime(time)}
                </option>
              ))}
            </select>
          </label>
          <label className="website-field">
            Closes at
            <select value={close} onChange={(event) => draft.update("close", event.target.value)}>
              {HALF_HOURS.map((time) => (
                <option key={time} value={time}>
                  {formatReservationTime(time)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!valid ? (
          <p className="website-note error" role="alert">
            <i className="bi bi-x-circle-fill" aria-hidden="true"></i>
            Closing must be at least 1 hour after opening, on the same day.
          </p>
        ) : (
          <div className="website-preview" aria-label="What customers see">
            <span className="website-preview-label">Customers see</span>
            <p>
              Open {formatOpeningHours({ open, close })} ({formatHoursLabel(length)}). The last online booking starts at{" "}
              {formatReservationTime(addMinutesToTime(close, -60))}.
            </p>
          </div>
        )}

        {outside.length > 0 && (
          <p className="website-note warning">
            <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
            <span>
              {outside.length} upcoming {outside.length === 1 ? "booking falls" : "bookings fall"} outside these hours. They stay
              booked; contact the {outside.length === 1 ? "customer" : "customers"} if the time has to change:{" "}
              {outside
                .slice(0, 3)
                .map((booking) => `${booking.customerName} (${formatReservationDate(booking.date)}, ${formatReservationTime(booking.time)})`)
                .join("; ")}
              {outside.length > 3 ? `; and ${outside.length - 3} more` : ""}.
            </span>
          </p>
        )}
      </div>
    </SiteCard>
  );
}
