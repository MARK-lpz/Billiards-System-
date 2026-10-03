export const sanitizePhoneInput = (value = "") => value.replace(/\D/g, "").slice(0, 11);

export const isValidSmsNumber = (value = "") => /^09\d{9}$/.test(value);

// Same rule as normalizeMobileNumber() in backend/config/sms.php: turns
// 639XXXXXXXXX or +639XXXXXXXXX into 09XXXXXXXXX, anything else into "".
export const normalizeMobileNumber = (value = "") => {
  const digits = String(value ?? "").replace(/\D/g, "");
  const local = /^639\d{9}$/.test(digits) ? `0${digits.slice(2)}` : digits;
  return isValidSmsNumber(local) ? local : "";
};

export const getSmsWarning = (value = "") =>
  value.trim() && !isValidSmsNumber(value)
    ? "Enter a valid SMS number in 09XXXXXXXXX format."
    : "";
