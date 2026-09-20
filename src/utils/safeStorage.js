/**
 * Some browsers refuse localStorage outright: Brave with shields set to block
 * all cookies, Chrome with third-party storage blocked, private windows, and
 * any site the user has told the browser not to let store anything. Touching
 * it then throws a SecurityError, and because the app reads storage while
 * rendering, that one throw takes the whole page down to a blank screen.
 *
 * Storage is a convenience here, never the source of truth, so a browser that
 * refuses it should cost the user their saved theme, not the entire app. This
 * swaps in a store that lives for the tab and lets every existing
 * `localStorage.getItem(...)` call site keep working untouched.
 */
const memoryStore = new Map();

const memoryStorage = {
  getItem: (key) => (memoryStore.has(String(key)) ? memoryStore.get(String(key)) : null),
  setItem: (key, value) => {
    memoryStore.set(String(key), String(value));
  },
  removeItem: (key) => {
    memoryStore.delete(String(key));
  },
  clear: () => {
    memoryStore.clear();
  },
  key: (index) => [...memoryStore.keys()][index] ?? null,
  get length() {
    return memoryStore.size;
  },
};

// Reading alone is not enough of a test: some browsers allow the read and
// refuse the write, so the probe has to do both.
const storageIsUsable = () => {
  try {
    const probeKey = "__break_and_chill_storage_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
};

export const installStorageFallback = () => {
  if (typeof window === "undefined" || storageIsUsable()) return false;

  try {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => memoryStorage,
    });
    console.warn(
      "This browser is blocking site storage, so settings will not be remembered after you close the tab."
    );
    return true;
  } catch {
    // Nothing further can be done; the call sites still guard their own reads.
    return false;
  }
};
