const MESSAGE_API_URL = import.meta.env.VITE_CUSTOMER_MESSAGE_API_URL || (
  !import.meta.env.DEV && window.location.hostname.endsWith("breakandchill.com")
    ? "https://app.breakandchill.com/api/customer_messages.php"
    : "/api/customer_messages.php"
);

/**
 * Asks the server to confirm a saved booking by text. Only the booking is
 * named here; the server writes the message itself from its own records, so
 * this can never be used to text arbitrary words to arbitrary numbers.
 *
 * Resolves to { text, status }: "sent" once texted, "queued" while SMS is not
 * switched on (or a sending limit was reached), "failed" if the provider refused.
 */
export const sendCustomerConfirmation = async ({ context, referenceId, phone, participant, paymentReference }) => {
  const response = await fetch(MESSAGE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context, referenceId, phone, participant, paymentReference }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to send the confirmation message.");
  }

  return data.confirmation;
};

export const fetchCustomerMessages = async (status = "") => {
  const url = status ? `${MESSAGE_API_URL}?status=${encodeURIComponent(status)}` : MESSAGE_API_URL;
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load customer messages.");
  }

  return Array.isArray(data.messages) ? data.messages : [];
};
