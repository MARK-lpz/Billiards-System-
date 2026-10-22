import { useCallback, useEffect, useState } from "react";
import { fetchMyProfile } from "../../utils/profileApi";

/**
 * The signed-in staff member's own profile (backend/api/profile.php), shared by
 * the Profile page and the picture in the top bar: { profile, failed, reload,
 * applySaved }. `profile` is null until the server has answered once;
 * `applySaved` takes the profile a save answered with.
 */
export default function useMyProfile() {
  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(
    () =>
      fetchMyProfile().then(
        (answer) => {
          setProfile(answer);
          setFailed(false);
        },
        (error) => {
          console.warn("Unable to load the profile", error);
          setFailed(true);
        },
      ),
    [],
  );

  // Loaded once with the dashboard, for the top bar; the Profile page reloads it.
  useEffect(() => {
    let active = true;
    fetchMyProfile().then(
      (answer) => active && setProfile(answer),
      (error) => {
        console.warn("Unable to load the profile", error);
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return { profile, failed, reload, applySaved: setProfile };
}
