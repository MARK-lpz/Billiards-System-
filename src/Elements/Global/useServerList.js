import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { announceSyncNotice, diffList, hasChanges, snapshotOf, takeConfirmedRemovals } from "../../utils/listSync";

const POLL_MS = 3000;
// When the server could not be reached, the change is sent again after this.
const RETRY_MS = 5000;

const sameJson = (first, second) => JSON.stringify(first) === JSON.stringify(second);
const plainName = (item) => item?.name || (item?.id !== undefined ? `Item ${item.id}` : "An item");

/**
 * Keeps a list the staff screens share (pool tables, equipment, tournaments)
 * in step with the server's copy:
 * - It reads the server's copy every few seconds and shows it, unless this
 *   screen has changes of its own still to send.
 * - When this screen changes the list (and `canSave`), it sends only the items
 *   it changed, each with the version it read (see utils/listSync.js). If the
 *   server refuses (someone changed the same item first, a mass removal nobody
 *   confirmed, or this account may not), the server's copy is shown again and a
 *   note says why.
 * The very first read of an empty list keeps this screen's own, which is how
 * a new system gets its first tables.
 */
export default function useServerList({
  name,
  list,
  setList,
  fetchList,
  saveChanges,
  enabled = true,
  canSave = false,
  canCreate = true,
  canRemove = true,
  describe = plainName,
}) {
  // The server's copy as last read (id -> JSON), or null until it has been read.
  const snapshot = useRef(null);
  const versions = useRef({});
  const saving = useRef(false);
  const listRef = useRef(list);
  const options = useRef({});
  // Bumped after the first read and after each save, so changes made meanwhile are sent.
  const [syncTick, setSyncTick] = useState(0);

  // Read by the callbacks below; kept current before any of them can run.
  useLayoutEffect(() => {
    listRef.current = list;
    options.current = { name, setList, fetchList, saveChanges, canSave, canCreate, canRemove, describe };
  });

  // Shows the server's copy. Unless `force`, not while this screen still has
  // changes of its own to send. Returns the items shown, or null.
  const showServerCopy = async (force) => {
    const { items, versions: serverVersions } = await options.current.fetchList();
    if (saving.current && !force) return null;

    const first = snapshot.current === null;
    if (first && !items.length) {
      snapshot.current = new Map();
      versions.current = {};
      return items;
    }
    // A screen that saves keeps its unsent changes; one that only reads shows the server's.
    if (!first && !force && options.current.canSave) {
      const { canCreate: mayCreate, canRemove: mayRemove } = options.current;
      const pending = diffList(snapshot.current, listRef.current, versions.current, { canCreate: mayCreate, canRemove: mayRemove });
      if (hasChanges(pending)) return null;
    }

    snapshot.current = snapshotOf(items);
    versions.current = { ...serverVersions };
    if (!sameJson(listRef.current, items)) options.current.setList(items);
    return items;
  };

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    // Signed in again (maybe as someone else): nothing is sent before a fresh read.
    snapshot.current = null;
    versions.current = {};

    const poll = async () => {
      if (saving.current) return;
      const first = snapshot.current === null;
      try {
        const shown = await showServerCopy(false);
        if (!cancelled && first && shown) setSyncTick((tick) => tick + 1);
      } catch (error) {
        if (!cancelled) console.warn(`Unable to sync shared ${options.current.name}`, error);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // showServerCopy only reads refs, so the poll restarts only when switched on or off.
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !canSave || snapshot.current === null || saving.current) return;
    const { name: listName, saveChanges: send, canCreate: mayCreate, canRemove: mayRemove, describe: label } = options.current;
    const changes = diffList(snapshot.current, list, versions.current, { canCreate: mayCreate, canRemove: mayRemove });
    if (!hasChanges(changes)) return;

    const before = new Map(snapshot.current);
    const confirmRemoval = takeConfirmedRemovals(listName, changes.remove.map((entry) => entry.id));
    saving.current = true;

    send({ ...changes, confirmRemoval })
      .then(({ versions: saved }) => {
        if (!snapshot.current) return;
        changes.upsert.forEach(({ item }) => {
          const id = String(item.id);
          snapshot.current.set(id, JSON.stringify(item));
          versions.current[id] = Number(saved?.[id]) || versions.current[id];
        });
        changes.remove.forEach(({ id }) => {
          snapshot.current.delete(id);
          delete versions.current[id];
        });
        saving.current = false;
        setSyncTick((tick) => tick + 1);
      })
      .catch(async (error) => {
        // Signed out: the app shows the login screen (see apiFetch.js).
        if (error.status === 401) {
          saving.current = false;
          return;
        }
        // The server could not be reached: the change stays on this screen and
        // is sent again shortly.
        if (!error.status) {
          console.warn(`Unable to save shared ${listName}`, error);
          saving.current = false;
          window.setTimeout(() => setSyncTick((tick) => tick + 1), RETRY_MS);
          return;
        }

        // Refused: show the server's copy again, and say why when it matters.
        let latest = [];
        try {
          latest = (await showServerCopy(true)) || [];
        } catch (reloadError) {
          console.warn(`Unable to reload shared ${listName}`, reloadError);
        }
        saving.current = false;

        if (error.code === "conflict") {
          const latestById = new Map(latest.map((item) => [String(item.id), JSON.stringify(item)]));
          const mine = new Map(changes.upsert.map(({ item }) => [String(item.id), item]));
          // Someone else made the very same change: nothing to tell.
          const lost = error.conflicts.filter((id) => !mine.has(id) || latestById.get(id) !== JSON.stringify(mine.get(id)));
          if (!lost.length) return;
          const names = lost.map((id) => label(mine.get(id) || JSON.parse(before.get(id) || "null")));
          announceSyncNotice({
            title: "Not saved: changed on another screen",
            message: `${names.join(", ")} ${names.length === 1 ? "was" : "were"} changed on another screen first, so this change was not saved. The latest is shown now; make the change again if it is still needed.`,
          });
          return;
        }
        announceSyncNotice({ title: "Not saved", message: error.message });
      });
  }, [enabled, canSave, list, syncTick]);
}
