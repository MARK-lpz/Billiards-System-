import { saveMyPreferences } from "./profileApi";
import { getSignedInUser, updateSignedInUser } from "./session";

// The signed-in account's own preferences (backend/config/preferences.php):
// { theme: "dark" | "light", density: "comfortable" | "compact" }, each one
// missing until it is first chosen in Settings. log_in.php sends them with the
// account, so they apply as the panel opens, on any computer.
export const getMyPreferences = () => getSignedInUser()?.preferences || {};

/** Saves `changes` to the account and to this tab's copy; resolves with all of them. */
export const savePreferences = async (changes) => {
  const profile = await saveMyPreferences(changes);
  const preferences = profile?.preferences || {};
  updateSignedInUser({ preferences });
  return preferences;
};
