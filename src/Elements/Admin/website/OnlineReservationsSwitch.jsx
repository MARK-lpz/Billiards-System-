import { useState } from "react";
import ConfirmDialog from "../../Global/ConfirmDialog";
import FieldError from "../../Global/FieldError";
import useClock from "../../Global/useClock";
import { useSiteSettings } from "../../Global/useSiteSettings";
import { appendAuditLog } from "../../../utils/audit";
import { DEFAULT_RESERVATION_HOURS, formatClock, isOutsideReservationHours } from "../../../utils/reservations";
import {
  CLOSE_NOTE_MAX,
  CLOSE_REASONS,
  closeUntilOptions,
  describeClosingForGuests,
  formatSwitchTime,
} from "../../../utils/onlineBookingSwitch";
import { readTextField } from "../../../utils/textField";

const reasonLabel = (value) => CLOSE_REASONS.find((reason) => reason.value === value)?.label || "";

// Under the switch: "Closed by ella · 2:15 PM", or "Opened again automatically · 10:00 PM".
const describeChange = (open, status) => {
  if (!status?.changedAt) return "";
  const when = formatSwitchTime(status.changedAt);
  if (open && !status.changedBy) return `Opened again automatically · ${when}`;
  return `${open ? "Opened" : "Closed"} by ${status.changedBy} · ${when}`;
};

/** Why, a note for the staff, and until when: asked before online bookings close. */
function CloseForm({ form, setForm, options }) {
  const chosenUntil = options.find((option) => option.value === form.until);
  const update = (field, value) => setForm((previous) => ({ ...previous, [field]: value, error: "" }));

  return (
    <div className="close-bookings-form">
      <fieldset className="close-bookings-field">
        <legend>Why?</legend>
        <div className="close-bookings-reasons">
          {CLOSE_REASONS.map((reason) => (
            <label key={reason.value} className={`close-bookings-chip${form.reason === reason.value ? " is-chosen" : ""}`}>
              <input
                type="radio"
                name="close-bookings-reason"
                value={reason.value}
                checked={form.reason === reason.value}
                onChange={() => update("reason", reason.value)}
              />
              <i className={`bi ${reason.icon}`} aria-hidden="true"></i>
              <span>{reason.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="close-bookings-field close-bookings-note">
        <span className="close-bookings-label">
          Note for the staff <em>{form.reason === "other" ? "(required, not shown to customers)" : "(optional, not shown to customers)"}</em>
        </span>
        <input
          className="form-control"
          value={form.note}
          maxLength={CLOSE_NOTE_MAX}
          placeholder="e.g. Birthday party on tables 1 to 6"
          onChange={(event) => update("note", readTextField(event))}
        />
      </label>

      <fieldset className="close-bookings-field">
        <legend>Until when?</legend>
        <div className="close-bookings-untils">
          {options.map((option) => (
            <label key={option.value} className={`close-bookings-until${form.until === option.value ? " is-chosen" : ""}`}>
              <input
                type="radio"
                name="close-bookings-until"
                value={option.value}
                checked={form.until === option.value}
                onChange={() => update("until", option.value)}
              />
              <span>{option.label}</span>
              {option.at && <small>{formatSwitchTime(option.at, form.now)}</small>}
            </label>
          ))}
        </div>
      </fieldset>

      {form.reason && (
        <p className="close-bookings-preview">
          <i className="bi bi-globe2" aria-hidden="true"></i>
          <span>
            {`The website will say: “${describeClosingForGuests({
              closedReason: form.reason,
              closedUntil: chosenUntil?.at?.toISOString(),
            })}”`}
          </span>
        </p>
      )}
      <FieldError id="close-bookings-error" message={form.error} />
    </div>
  );
}

/**
 * Whether the website takes table bookings, on Content Management in both
 * panels. Opening happens at once. Closing asks why and until when first: the
 * website tells guests both, and a closing with an end time opens again by
 * itself (backend/config/reservation_settings.php). Who changed it last shows
 * under it; the admin's bell hears when an employee does. Open still waits for
 * the GCash details before anyone can book, which the line in it says. From
 * closing until opening the hall is shut, and online bookings with it: the
 * switch can still close them (say, at night for tomorrow's event) but not
 * open them, and the server refuses that too.
 */
export default function OnlineReservationsSwitch({ open, status = {}, updating, onChange, staff, setLogs }) {
  const { settings } = useSiteSettings();
  const now = useClock(60000);
  const [error, setError] = useState("");
  // The close form while its dialog is up: { reason, note, until, error, now }.
  const [closing, setClosing] = useState(null);
  const gcashReady = Boolean(settings.gcash?.ready);
  const hallClosed = isOutsideReservationHours(new Date(now), settings.hours);
  const opensAt = formatClock((settings.hours || DEFAULT_RESERVATION_HOURS).open);
  const openingLocked = !open && hallClosed;
  const options = closing ? closeUntilOptions(settings.hours, closing.now) : [];

  const log = (action, detail) => appendAuditLog(setLogs, { type: "settings", staff, action, detail, entity: "website" });

  const reopen = async () => {
    try {
      await onChange(true);
      log("Opened online reservations", "Online reservations: open to the public.");
    } catch (failure) {
      setError(failure?.message || "Could not change it. Please try again.");
    }
  };

  const confirmClose = async () => {
    const note = closing.note.trim();
    const until = options.find((option) => option.value === closing.until);
    try {
      await onChange(false, { reason: closing.reason, note, until: closing.until });
      log(
        "Closed online reservations",
        `Online reservations closed: ${reasonLabel(closing.reason)}${note ? ` ("${note}")` : ""}. ${
          until?.at ? `They open again at ${formatSwitchTime(until.at)}.` : "They stay closed until someone opens them again."
        }`,
      );
      setClosing(null);
    } catch (failure) {
      setClosing((previous) => previous && { ...previous, error: failure?.message || "Could not close it. Please try again." });
    }
  };

  const toggle = () => {
    if (!onChange || updating || openingLocked) return;
    setError("");
    if (!open) {
      reopen();
      return;
    }
    const now = new Date();
    const choices = closeUntilOptions(settings.hours, now);
    setClosing({
      reason: "",
      note: "",
      until: choices.some((option) => option.value === "closing") ? "closing" : "opening",
      error: "",
      now,
    });
  };

  const closedLine = [reasonLabel(status.closedReason) || "Temporarily closed", status.closedUntil && `until ${formatSwitchTime(status.closedUntil)}`]
    .filter(Boolean)
    .join(" · ");
  const change = describeChange(open, status);
  const noteNeeded = closing?.reason === "other" && !closing.note.trim();

  return (
    <div className="website-booking-switch">
      <div className={`online-reservations-status ${open ? "is-open" : "is-closed"}`}>
        <span>
          <strong>Online reservations</strong>
          <small>
            {!open
              ? closedLine
              : hallClosed
                ? `Hall closed · bookings open at ${opensAt}`
                : gcashReady
                  ? "Open to the public"
                  : "On, but waits for the GCash details"}
          </small>
        </span>
        <button
          type="button"
          className="online-reservations-toggle"
          role="switch"
          aria-checked={open}
          aria-label={open ? "Close online reservations" : "Open online reservations"}
          title={openingLocked ? `The hall is closed. This can be turned on from ${opensAt}.` : undefined}
          disabled={updating || openingLocked}
          onClick={toggle}
        >
          <span aria-hidden="true"></span>
        </button>
      </div>
      {change && (
        <span className="website-booking-change">
          {change}
          {!open && status.closedNote ? ` · “${status.closedNote}”` : ""}
        </span>
      )}
      {openingLocked && (
        <span className="website-booking-change">The hall is closed, so this can be turned on from {opensAt}.</span>
      )}
      {error && (
        <span className="website-booking-error" role="alert">
          {error}
        </span>
      )}

      {closing && (
        <ConfirmDialog
          title="Close online reservations?"
          icon="bi-calendar-x"
          message="Customers can't book tables on the website while it's closed. Bookings already made stay as they are."
          confirmLabel={updating ? "Closing..." : "Close bookings"}
          cancelLabel="Cancel"
          confirmDisabled={updating || !closing.reason || noteNeeded}
          onConfirm={confirmClose}
          onClose={() => !updating && setClosing(null)}
        >
          <CloseForm form={closing} setForm={setClosing} options={options} />
        </ConfirmDialog>
      )}
    </div>
  );
}
