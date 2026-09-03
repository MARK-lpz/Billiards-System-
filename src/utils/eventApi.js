const EVENT_API_URL = import.meta.env.VITE_EVENT_API_URL || (
  !import.meta.env.DEV && window.location.hostname.endsWith("breakandchill.com")
    ? "https://app.breakandchill.com/api/events.php"
    : "/api/events.php"
);

const parseResponse = async (response, fallbackMessage) => {
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
};

export const fetchRemoteEvents = async () => {
  const response = await fetch(EVENT_API_URL);
  const data = await parseResponse(response, "Unable to load tournaments.");
  return Array.isArray(data.events) ? data.events : [];
};

export const saveRemoteEvents = async (events) => {
  const response = await fetch(EVENT_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });
  await parseResponse(response, "Unable to save tournaments.");
};

export const registerRemoteTournamentParticipant = async ({ eventId, participant }) => {
  const response = await fetch(EVENT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, participant }),
  });
  const data = await parseResponse(response, "Unable to register for the tournament.");
  return data.event;
};
