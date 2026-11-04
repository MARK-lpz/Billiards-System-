import useClock from "../Global/useClock";
import { useSiteSettings } from "../Global/useSiteSettings";
import { describeClosedHours, isOutsideReservationHours } from "../../utils/reservations";
import { describeClosingForGuests } from "../../utils/onlineBookingSwitch";

/**
 * Whether a table can be booked online right now, for the public pages' Reserve
 * buttons: { now, reservationsClosed, reservationClosedMessage, reserveLabel,
 * reserveTitle, bookingMode }. Closed from closing until opening (not only
 * until midnight), while the admin has online bookings off, and until the
 * GCash account is set, since bookings are paid by GCash. `bookingMode` is how
 * tables are booked right now: "online", online but not at this hour
 * ("later"), or only at the "hall". `paused` is a closing with the switch
 * (Admin > Website), news on the Announcements page and the home page:
 * { message, id } (`id` changes with each closing), or null. `now` is refreshed
 * every minute, so all of it follows the clock.
 */
export function useReservationState(onlineReservationsOpen = true, onlineReservationsStatus = {}) {
  const now = useClock(60_000);
  const { settings, loaded } = useSiteSettings();
  const { hours, business, gcash } = settings;
  const paymentUnavailable = loaded && !gcash.ready;
  const afterHours = isOutsideReservationHours(new Date(now), hours);
  const reservationsClosed = afterHours || !onlineReservationsOpen || paymentUnavailable;
  const { updatedAt, closedReason, closedUntil } = onlineReservationsStatus;
  const paused = onlineReservationsOpen
    ? null
    : { message: describeClosingForGuests(onlineReservationsStatus), id: [updatedAt, closedReason, closedUntil].join("|") };
  const reservationClosedMessage = paused
    ? paused.message
    : paymentUnavailable
      ? `Online booking is not available yet. Please book at the hall${business.phone ? ` or call ${business.phone}` : ""}.`
      : describeClosedHours(hours);

  return {
    now,
    reservationsClosed,
    reservationClosedMessage,
    reserveLabel: reservationsClosed ? "Reservations Closed" : "Reserve a Table",
    reserveTitle: reservationsClosed ? reservationClosedMessage : "Reserve a table",
    bookingMode: !onlineReservationsOpen || paymentUnavailable ? "hall" : afterHours ? "later" : "online",
    paused,
  };
}
