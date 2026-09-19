export const REFERENCE_MIN_DIGITS = 10;
export const REFERENCE_MAX_DIGITS = 15;
export const VERIFY_DIGITS = 4;

export const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");

export const sanitizeReference = (value) => onlyDigits(value).slice(0, REFERENCE_MAX_DIGITS);

export const sanitizeVerifyDigits = (value) => onlyDigits(value).slice(0, VERIFY_DIGITS);

export const closingDigitsOf = (reference) => onlyDigits(reference).slice(-VERIFY_DIGITS);

export const maskReference = (reference) => {
  const digits = onlyDigits(reference);
  if (!digits) return "";
  return `${digits.slice(0, -VERIFY_DIGITS)} ${"•".repeat(VERIFY_DIGITS)}`.trim();
};

export const validateReference = (value, usedReferences = []) => {
  const digits = onlyDigits(value);
  const spent = new Set(usedReferences.map((entry) => onlyDigits(entry)).filter(Boolean));

  if (!digits) {
    return {
      digits,
      isValid: false,
      error: null,
      warning: "No reference number yet. Ask the customer to show the GCash receipt before approving this payment.",
    };
  }

  if (spent.has(digits)) {
    return {
      digits,
      isValid: false,
      error: "This reference number was already used on an earlier sale. Ask the customer for the correct receipt.",
      warning: null,
    };
  }

  if (digits.length < REFERENCE_MIN_DIGITS) {
    return {
      digits,
      isValid: false,
      error: `Reference numbers are at least ${REFERENCE_MIN_DIGITS} digits. ${digits.length} entered so far.`,
      warning: null,
    };
  }

  if (digits.length > REFERENCE_MAX_DIGITS) {
    return {
      digits,
      isValid: false,
      error: `Reference numbers are at most ${REFERENCE_MAX_DIGITS} digits.`,
      warning: null,
    };
  }

  return { digits, isValid: true, error: null, warning: null };
};

export const checkClosingDigits = (reference, entered) => {
  const expected = closingDigitsOf(reference);
  const typed = sanitizeVerifyDigits(entered);
  const isComplete = typed.length === VERIFY_DIGITS;
  const matches = isComplete && expected.length === VERIFY_DIGITS && typed === expected;

  return { expected, typed, isComplete, matches, mismatch: isComplete && !matches };
};
