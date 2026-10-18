import { useEffect, useState } from "react";
import { fetchRequestStatuses } from "../../utils/requestStatusApi";
import {
  describeRequest,
  forgetRequest,
  readSavedRequests,
  readSeenRequests,
  rememberRequestSeen,
  saveRequest,
} from "../../utils/myRequests";

// Asked again this often while the page is open (and at once when it comes back into view).
const POLL_MS = 20000;

// Read from initializers and handlers only, never while rendering.
const nowMs = () => Date.now();

/**
 * The customer's own bookings and tournament sign-ups kept in this browser,
 * each with where it stands now (asked from the server every POLL_MS):
 * { requests: [{ key, kind, label, savedAt, view, info }], unseen, add,
 * markSeen, forget }. `info` is describeRequest()'s, or null until the server
 * answers. `unseen` are decided ones the customer has not seen yet.
 */
export function useMyRequests() {
  const [saved, setSaved] = useState(() => readSavedRequests(nowMs()));
  // key -> what the server said ({ found, ... }).
  const [views, setViews] = useState({});
  const [seen, setSeen] = useState(readSeenRequests);
  const keyList = saved.map((entry) => entry.key).join(",");

  useEffect(() => {
    if (!keyList) return undefined;
    let active = true;

    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const answers = await fetchRequestStatuses(keyList.split(","));
        if (!active) return;
        // A key the server no longer knows is forgotten here too.
        const gone = answers.filter((answer) => !answer.found).map((answer) => answer.key);
        if (gone.length) {
          gone.forEach((key) => forgetRequest(key, nowMs()));
          setSaved(readSavedRequests(nowMs()));
        }
        setViews((current) => {
          const next = { ...current };
          answers.forEach((answer) => {
            if (answer.found) next[answer.key] = answer;
          });
          return JSON.stringify(next) === JSON.stringify(current) ? current : next;
        });
      } catch (error) {
        console.warn("Unable to check your requests", error);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "hidden") load();
    };

    load();
    const timer = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [keyList]);

  const requests = saved.map((entry) => {
    const view = views[entry.key] || null;
    return { ...entry, view, info: view ? describeRequest(view) : null };
  });
  const unseen = requests.filter(
    (request) => request.info && request.info.tone !== "waiting" && seen[request.key] !== request.info.signature
  );

  return {
    requests,
    unseen,
    // A request the website just sent: { key, kind, label }.
    add: (entry) => {
      saveRequest(entry, nowMs());
      setSaved(readSavedRequests(nowMs()));
    },
    markSeen: (request) => {
      if (!request.info) return;
      rememberRequestSeen(request.key, request.info.signature);
      setSeen(readSeenRequests());
    },
    forget: (key) => {
      forgetRequest(key, nowMs());
      setSaved(readSavedRequests(nowMs()));
      setSeen(readSeenRequests());
    },
  };
}
