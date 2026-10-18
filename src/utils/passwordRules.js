// For a new or changed password, the same as the server's PASSWORD_MIN_LENGTH
// (config/auth.php). The login screen does not hold older, shorter passwords to it.
export const MIN_PASSWORD_LENGTH = 8;

export const isPasswordTooShort = (password) =>
  password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
