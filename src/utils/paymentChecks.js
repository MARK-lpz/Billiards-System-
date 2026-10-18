// How long an online booking's GCash payment may wait for the front desk to
// check it before the admin hears of it too.
export const PAYMENT_CHECK_ALERT_MINUTES = 10;

// The late payment checks the admin has opened in the bell.
export const SEEN_PAYMENT_CHECKS_KEY = "seenPaymentChecks";

// When a booking was sent: the database's time (requestedAtMs), else the time its id was made from.
const sentAt = (booking) => {
  const fromServer = Number(booking.requestedAtMs);
  if (fromServer > 0) return fromServer;
  const fromId = Number(String(booking.id).split("-")[0]);
  return fromId > 0 ? fromId : null;
};

export const paymentCheckKey = ({ booking }) => `payment:${booking.id}`;

/**
 * Online bookings still waiting for their payment to be checked ("Check payment"
 * at the Reservation Desk) PAYMENT_CHECK_ALERT_MINUTES or longer, the longest
 * waiting first: { booking, waitingMinutes }.
 */
export const getLatePaymentChecks = (reservations = [], now) =>
  reservations
    .filter((booking) => booking.status === "pending" && booking.source === "online" && sentAt(booking) !== null)
    .map((booking) => ({ booking, waitingMinutes: Math.floor((now - sentAt(booking)) / 60000) }))
    .filter((entry) => entry.waitingMinutes >= PAYMENT_CHECK_ALERT_MINUTES)
    .sort((first, second) => second.waitingMinutes - first.waitingMinutes);
