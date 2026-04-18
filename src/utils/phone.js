export const sanitizePhoneInput = (value = "") => value.replace(/\D/g, "").slice(0, 11);

export const isValidSmsNumber = (value = "") => /^09\d{9}$/.test(value);

export const getSmsWarning = (value = "") =>
  value.trim() && !isValidSmsNumber(value)
    ? "Enter a valid SMS number in 09XXXXXXXXX format."
    : "";
