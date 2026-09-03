const RESERVATION_SETTINGS_API_URL = import.meta.env.VITE_RESERVATION_SETTINGS_API_URL || (
  !import.meta.env.DEV && window.location.hostname === "breakandchill.com"
    ? "https://app.breakandchill.com/api/reservation-settings.php"
    : "/api/reservation-settings.php"
);

const parseResponse = async (response, fallbackMessage) => {
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || fallbackMessage);
  }

  return data.settings;
};

export const fetchReservationSettings = async () => {
  const response = await fetch(RESERVATION_SETTINGS_API_URL);
  return parseResponse(response, "Unable to load online reservation settings.");
};

export const updateReservationSettings = async ({ onlineReservationsOpen }) => {
  const response = await fetch(RESERVATION_SETTINGS_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ onlineReservationsOpen }),
  });

  return parseResponse(response, "Unable to update online reservation settings.");
};
