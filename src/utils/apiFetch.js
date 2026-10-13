import { getAuthToken } from "./session";

// Every request to the API goes through here. A signed-in tab adds its token
// (the server only lets staff change things with one); the website has none
// and uses only what is open to everyone. When the server says the sign-in has
// ended (401), the app is told so it can show the login screen again.
export const SESSION_ENDED_EVENT = "bc:session-ended";

export const apiFetch = async (url, options = {}) => {
  const token = getAuthToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers["X-Auth-Token"] = token;

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && token) {
    window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT));
  }
  return response;
};

// A refused request as an Error that keeps the server's status, code and details.
export const refusalError = (response, data, fallbackMessage) => {
  const error = new Error(data?.message || fallbackMessage);
  error.status = response.status;
  error.code = data?.code || "";
  error.conflicts = Array.isArray(data?.conflicts) ? data.conflicts.map(String) : [];
  return error;
};
