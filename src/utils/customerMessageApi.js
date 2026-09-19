const MESSAGE_API_URL = import.meta.env.VITE_CUSTOMER_MESSAGE_API_URL || (
  !import.meta.env.DEV && window.location.hostname.endsWith("breakandchill.com")
    ? "https://app.breakandchill.com/api/customer_messages.php"
    : "/api/customer_messages.php"
);

/**
 * Queues the confirmation for the customer's number. It is stored server side so
 * staff can see exactly what each customer was told, and so an SMS gateway can
 * pick the queue up later without changing any of this code.
 */
export const queueCustomerMessage = async ({ phone, customerName, context, referenceId, message }) => {
  const response = await fetch(MESSAGE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, customerName, context, referenceId, message }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to queue the confirmation message.");
  }

  return data.queued;
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
