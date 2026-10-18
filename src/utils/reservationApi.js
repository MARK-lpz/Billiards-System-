import { findTableReservation } from './reservations';
import { apiFetch } from "./apiFetch";

const RESERVATION_API_URL = import.meta.env.VITE_RESERVATION_API_URL || (
  !import.meta.env.DEV && window.location.hostname === 'breakandchill.com'
    ? 'https://app.breakandchill.com/api/reservations.php'
    : '/api/reservations.php'
);

// `extra`: what goes with the request but is not part of the booking, such as
// whether to give a cancelled booking's GCash payment back (`refundPayment`).
// Resolves with the server's whole answer.
const send = async (method, reservation, extra = {}) => {
  const response = await apiFetch(RESERVATION_API_URL, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...reservation, ...extra }),
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to save reservation.');
  }

  return data;
};

const request = async (method, reservation, extra = {}) => (await send(method, reservation, extra)).reservation;

export const createRemoteReservation = (reservation) => request('POST', reservation);

/**
 * A booking from the website: { reservation, statusKey }. The key is what the
 * customer's browser follows the booking by (utils/myRequests.js); null if the
 * server gave none.
 */
export const createWebsiteReservation = async (reservation) => {
  const data = await send('POST', reservation);
  return { reservation: data.reservation, statusKey: data.statusKey || null };
};
export const updateRemoteReservation = (reservation, extra = {}) => request('PUT', reservation, extra);

/**
 * Moves the booking a table is held for to `status`, here and on the server,
 * when it is currently one of `from`. Only the booking the table itself carries
 * is touched, never another booking on the same table.
 */
// `extra` goes with the save (see request); `onSaved` runs once the server took it.
export const saveTableReservationStatus = ({ table, reservations = [], setReservations, from, status, extra = {}, onSaved }) => {
  const reservation = findTableReservation(table, reservations);
  if (!reservation || String(reservation.id) !== String(table?.reservationId) || !from.includes(reservation.status)) {
    return;
  }

  const nextReservation = { ...reservation, status };
  setReservations?.((prev) =>
    prev.map((entry) => (String(entry.id) === String(reservation.id) ? nextReservation : entry))
  );
  updateRemoteReservation(nextReservation, extra)
    .then(() => onSaved?.(nextReservation))
    .catch((error) => {
      console.warn('Unable to sync reservation status', error);
    });
};

export const fetchRemoteReservations = async () => {
  const response = await apiFetch(RESERVATION_API_URL);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to load reservations.');
  }

  return Array.isArray(data.reservations) ? data.reservations : [];
};
