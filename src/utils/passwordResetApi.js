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


const post = async (payload, fallbackMessage) => {
  const response = await fetch(RESET_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(response, fallbackMessage);
};

/**
 * "sms-code" once an SMS provider key is set on the server, otherwise
 * "disabled": reset never happens without a texted code.
 */
export const fetchResetMode = async () => {
  const response = await fetch(`${RESET_API_URL}?mode=1`);
  const data = await parseResponse(response, "Unable to load password reset options.");
  return data.mode === "sms-code" ? "sms-code" : "disabled";
};

export const sendResetCode = async ({ username, role, phone }) =>
  post({ action: "send-code", username, role, phone }, "Unable to send the code right now.");

export const resetPassword = async ({ username, role, phone, code, newPassword }) =>
  (await post({ action: "reset", username, role, phone, code, newPassword }, "Unable to reset the password right now.")).reset;

export const fetchPasswordResets = async () => {
  const response = await fetch(RESET_API_URL);
  const data = await parseResponse(response, "Unable to load password reset history.");
  return Array.isArray(data.resets) ? data.resets : [];
};
