import { apiFetch, refusalError } from "./apiFetch";

const EVENT_API_URL = import.meta.env.VITE_EVENT_API_URL || (
  !import.meta.env.DEV && window.location.hostname.endsWith("breakandchill.com")
    ? "https://app.breakandchill.com/api/events.php"
    : "/api/events.php"
);

const parseResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw refusalError(response, data, fallbackMessage);
  }

  return data;
};

// The tournaments and each one's version (see useServerList.js).
export const fetchRemoteEvents = async () => {
  const response = await apiFetch(EVENT_API_URL);
  const data = await parseResponse(response, "Unable to load tournaments.");
  return {
    items: Array.isArray(data.events) ? data.events : [],
    versions: data.versions && typeof data.versions === "object" ? data.versions : {},
  };
};

// Only the tournaments changed here: { upsert, remove, confirmRemoval }.
export const saveRemoteEventChanges = async (changes) => {
  const response = await apiFetch(EVENT_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  const data = await parseResponse(response, "Unable to save tournaments.");
  return { versions: data.versions || {} };
};

export const registerRemoteTournamentParticipant = async ({ eventId, participant }) => {
  const response = await apiFetch(EVENT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, participant }),
  });
  const data = await parseResponse(response, "Unable to register for the tournament.");
  return data.event;
};
