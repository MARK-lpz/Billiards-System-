import { findTableReservation } from './reservations';

const RESERVATION_API_URL = import.meta.env.VITE_RESERVATION_API_URL || (
  !import.meta.env.DEV && window.location.hostname === 'breakandchill.com'
    ? 'https://app.breakandchill.com/api/reservations.php'
    : '/api/reservations.php'
);

const request = async (method, reservation) => {
  const response = await fetch(RESERVATION_API_URL, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reservation),
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to save reservation.');
  }

  return data.reservation;
};

export const createRemoteReservation = (reservation) => request('POST', reservation);
export const updateRemoteReservation = (reservation) => request('PUT', reservation);

/**
 * Moves the booking a table is held for to `status`, here and on the server,
 * when it is currently one of `from`. Only the booking the table itself carries
 * is touched, never another booking on the same table.
 */
export const saveTableReservationStatus = ({ table, reservations = [], setReservations, from, status }) => {
  const reservation = findTableReservation(table, reservations);
  if (!reservation || String(reservation.id) !== String(table?.reservationId) || !from.includes(reservation.status)) {
    return;
  }

  const nextReservation = { ...reservation, status };
  setReservations?.((prev) =>
    prev.map((entry) => (String(entry.id) === String(reservation.id) ? nextReservation : entry))
  );
  updateRemoteReservation(nextReservation).catch((error) => {
    console.warn('Unable to sync reservation status', error);
  });
};

export const fetchRemoteReservations = async () => {
  const response = await fetch(RESERVATION_API_URL);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to load reservations.');
  }

  return Array.isArray(data.reservations) ? data.reservations : [];
};
