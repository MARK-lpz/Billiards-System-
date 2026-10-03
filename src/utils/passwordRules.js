// Shared with the login screen, so a password saved here can always be used to log in.
export const MIN_PASSWORD_LENGTH = 6;

export const isPasswordTooShort = (password) =>
  password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
