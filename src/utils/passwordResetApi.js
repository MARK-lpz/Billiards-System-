const RESET_API_URL = import.meta.env.VITE_PASSWORD_RESET_API_URL || (
  !import.meta.env.DEV && window.location.hostname.endsWith("breakandchill.com")
    ? "https://app.breakandchill.com/api/password_reset.php"
    : "/api/password_reset.php"
);

const parseResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
};

/**
 * Employees reset their own password. The new password is sent straight to the
 * server and is never written to local storage or shown to anyone else.
 */
export const resetEmployeePassword = async ({ username, email, newPassword }) => {
  const response = await fetch(RESET_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, newPassword }),
  });

  const data = await parseResponse(response, "Unable to reset the password right now.");
  return data.reset;
};

/** History for the admin: who reset and when, never the password itself. */
export const fetchPasswordResets = async () => {
  const response = await fetch(RESET_API_URL);
  const data = await parseResponse(response, "Unable to load password reset history.");
  return Array.isArray(data.resets) ? data.resets : [];
};
