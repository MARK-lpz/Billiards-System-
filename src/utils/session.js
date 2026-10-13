// The signed-in account is kept per browser tab (sessionStorage), not shared by
// every tab (localStorage). An admin and an employee can each work in their own
// tab, and reloading a tab keeps the account that tab logged in with. Closing
// the tab signs it out.

const USER_KEY = "user";
const TOKEN_KEY = "authToken";
// Set when the server ended this tab's sign-in, so the login screen can say why.
const ENDED_KEY = "signInEnded";

// The account used to be saved for all tabs at once; that copy is dropped so it
// can never be picked up again.
const clearSharedCopy = () => {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: nothing was saved there either.
  }
};

export const getSignedInUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

// The token log_in.php gave this tab; staff requests send it (see apiFetch.js).
export const getAuthToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

export const saveSignedInUser = (user, token) => {
  clearSharedCopy();
  try {
    sessionStorage.removeItem(ENDED_KEY);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.warn("Unable to keep the sign-in for this tab", error);
  }
};

export const noteSignInEnded = () => {
  try {
    sessionStorage.setItem(ENDED_KEY, "1");
  } catch {
    // Storage blocked: the login screen simply shows no note.
  }
};

// Whether the server ended this tab's last sign-in; cleared on the next sign-in.
export const hasSignInEndedNote = () => {
  try {
    return sessionStorage.getItem(ENDED_KEY) === "1";
  } catch {
    return false;
  }
};

export const clearSignedInUser = () => {
  clearSharedCopy();
  try {
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: there is nothing to remove.
  }
};
