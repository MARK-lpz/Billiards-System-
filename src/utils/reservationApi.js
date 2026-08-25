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

export const fetchRemoteReservations = async () => {
  const response = await fetch(RESERVATION_API_URL);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to load reservations.');
  }

  return Array.isArray(data.reservations) ? data.reservations : [];
};
