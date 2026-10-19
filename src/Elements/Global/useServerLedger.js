import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { announceSyncNotice } from "../../utils/listSync";

// When the server could not be reached, the change is sent again after this.
const RETRY_MS = 5000;
// Sent at most this many at a time (the server takes 200).
const SAVE_BATCH = 100;

const idOf = (item) => (item && item.id !== undefined && item.id !== null ? String(item.id) : "");
const plainName = (item) => item?.name || "An item";

// Made or changed on this screen, and not on the server yet? `known` is what the
// server holds as far as the screen knows (id -> { json, version }).
const unsent = (item, known, refused, include) => {
  const id = idOf(item);
  if (!id || refused.has(id) || !include(item)) return false;
  return known.get(id)?.json !== JSON.stringify(item);
};

/**
 * Keeps a list that keeps growing (sales, table bills, the audit log) the same
 * on every device, through the server (see backend/config/ledger.php):
 * - At sign-in it reads the server's list once, then every few seconds only
 *   what changed since. What another device added or changed shows here, except
 *   an item this screen changed and has not sent yet.
 * - What this screen adds or changes is sent, only that, each item with the
 *   version it read. Whatever this browser held before the server kept these
 *   lists is sent the same way, once, so nothing kept here is lost.
 * - When the server has a different copy (another counter took the same table
 *   bill first), the server's copy is shown and a note says so.
 * - A screen that may add to the list but not read it (an employee and the
 *   audit log) sends its entries, then forgets them.
 * `include` picks the items that belong on the server; `sortKey` (newest is
 * highest) orders the list after another device's items are added.
 */
export default function useServerLedger({
  name,
  list,
  setList,
  fetchChanges,
  saveChanges,
  enabled = true,
  canRead = true,
  include = () => true,
  sortKey = null,
  pollMs = 3000,
  describe = plainName,
}) {
  // What the server holds, as far as this screen knows: id -> { json, version }.
  const known = useRef(new Map());
  // The sequence number read up to (null before the first read), and the epoch it is in.
  const cursor = useRef(null);
  const epoch = useRef("");
  // The sign-in a read or a save in progress belongs to, or 0.
  const saving = useRef(0);
  const reading = useRef(0);
  // Items the server refused, not sent again until the next sign-in.
  const refused = useRef(new Set());
  // Bumped at each sign-in and sign-out: an answer to an older request is dropped.
  const generation = useRef(0);
  const listRef = useRef(list);
  const options = useRef({});
  // Bumped after the first read and after each save, so changes made meanwhile are sent.
  const [syncTick, setSyncTick] = useState(0);

  // Read by the callbacks below; kept current before any of them can run.
  useLayoutEffect(() => {
    listRef.current = list;
    options.current = { name, setList, fetchChanges, saveChanges, canRead, include, sortKey, describe };
  });

  const isUnsent = (item) => unsent(item, known.current, refused.current, options.current.include);

  // Shows what the server sent: new items added, changed ones replaced, except
  // an item changed here and not sent yet (its save settles it, with the
  // version it was changed from).
  const showServerItems = (items, versions) => {
    const local = new Map(listRef.current.map((item) => [idOf(item), item]));
    const incoming = new Map();
    items.forEach((item) => {
      const id = idOf(item);
      if (!id) return;
      const mine = local.get(id);
      if (mine && known.current.has(id) && unsent(mine, known.current, refused.current, options.current.include)) return;
      known.current.set(id, { json: JSON.stringify(item), version: Number(versions[id]) || 1 });
      incoming.set(id, item);
    });
    if (!incoming.size) return;

    const key = options.current.sortKey;
    options.current.setList((current) => {
      const waiting = new Map(incoming);
      let changed = false;
      const next = current.map((item) => {
        const server = waiting.get(idOf(item));
        if (!server) return item;
        waiting.delete(idOf(item));
        if (JSON.stringify(item) === JSON.stringify(server)) return item;
        changed = true;
        return server;
      });
      // The server sends the oldest first; the lists show the newest first.
      const added = [...waiting.values()].reverse();
      if (!changed && !added.length) return current;
      const merged = [...added, ...next];
      if (!key || !added.length) return merged;
      const rank = (item) => Number(key(item)) || 0;
      return merged.sort((first, second) => rank(second) - rank(first));
    });
  };

  // Signed in or out (maybe as someone else): start again with nothing known.
  useEffect(() => {
    generation.current += 1;
    known.current = new Map();
    cursor.current = null;
    epoch.current = "";
    refused.current = new Set();
    saving.current = 0;
    reading.current = 0;
    setSyncTick((tick) => tick + 1);
  }, [enabled, canRead]);

  useEffect(() => {
    if (!enabled || !canRead) return undefined;
    let cancelled = false;

    // Reads what changed since the last read: everything, the first time.
    const readChanges = async () => {
      const asked = generation.current;
      const first = cursor.current === null;
      let after = first ? 0 : cursor.current;
      let pageEpoch = null;
      const items = [];
      const versions = {};

      for (;;) {
        const page = await options.current.fetchChanges({ after, start: first });
        if (asked !== generation.current) return;
        if (pageEpoch === null) pageEpoch = page.epoch;
        // Restored from a backup while this was reading: read again next time.
        if (page.epoch !== pageEpoch) return;
        // Restored since the last read: everything is read again, from the start.
        if (!first && page.epoch !== epoch.current) {
          cursor.current = null;
          known.current = new Map();
          return;
        }
        items.push(...page.items);
        Object.assign(versions, page.versions);
        after = page.cursor;
        if (!page.more) break;
      }

      showServerItems(items, versions);
      cursor.current = after;
      epoch.current = pageEpoch;
      if (first) setSyncTick((tick) => tick + 1);
    };

    const poll = async () => {
      if (saving.current || reading.current) return;
      const mine = generation.current;
      reading.current = mine;
      try {
        await readChanges();
      } catch (error) {
        if (!cancelled) console.warn(`Unable to sync shared ${options.current.name}`, error);
      } finally {
        if (reading.current === mine) reading.current = 0;
      }
      // A change made while reading waited; it goes now.
      if (!cancelled && cursor.current !== null && listRef.current.some(isUnsent)) setSyncTick((tick) => tick + 1);
    };

    poll();
    const interval = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // The poll restarts only when switched on or off, or at a sign-in or sign-out.
  }, [enabled, canRead, pollMs]);

  useEffect(() => {
    if (!enabled || saving.current || reading.current) return;
    // A screen that reads the list sends nothing before its first read: the
    // server may already have what this browser holds.
    if (canRead && cursor.current === null) return;

    const seen = new Set();
    const batch = [];
    for (const item of list) {
      const id = idOf(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (isUnsent(item)) batch.push(item);
      if (batch.length >= SAVE_BATCH) break;
    }
    if (!batch.length) return;

    const asked = generation.current;
    saving.current = asked;
    const sent = batch.map((item) => ({ item, version: known.current.get(idOf(item))?.version || 0 }));
    const { name: listName, saveChanges: send, describe: label } = options.current;

    send({ upsert: sent })
      .then(({ versions, conflicts, rejected }) => {
        if (asked !== generation.current) return;
        const answered = new Set([...conflicts, ...rejected].map(({ id }) => String(id)));
        sent.forEach(({ item }) => {
          const id = idOf(item);
          const version = Number(versions[id]);
          if (version) known.current.set(id, { json: JSON.stringify(item), version });
          // Neither kept nor refused: not sent again and again.
          else if (!answered.has(id)) refused.current.add(id);
        });
        rejected.forEach(({ id, message }) => {
          refused.current.add(String(id));
          console.warn(`The server did not keep ${listName} item ${id}: ${message}`);
        });

        // The server has another copy: it is shown instead.
        const theirs = new Map();
        conflicts.forEach(({ id, item, version }) => {
          const conflictId = String(id);
          if (item && typeof item === "object") {
            known.current.set(conflictId, { json: JSON.stringify(item), version: Number(version) || 1 });
            theirs.set(conflictId, item);
          } else {
            refused.current.add(conflictId);
          }
        });
        if (theirs.size) {
          options.current.setList((current) => current.map((item) => theirs.get(idOf(item)) || item));
          const names = [...theirs.keys()].map((id) => label(sent.find(({ item }) => idOf(item) === id)?.item || theirs.get(id)));
          announceSyncNotice({
            title: "Not saved: changed on another screen",
            message: `${names.join(", ")} ${names.length === 1 ? "was" : "were"} changed on another screen first, so this change was not saved. The latest is shown now.`,
          });
        }

        // A screen that may not read the list keeps only what is still to send.
        if (!canRead) {
          const savedJson = new Map(
            sent.map(({ item }) => [idOf(item), known.current.get(idOf(item))?.json]).filter(([, json]) => json)
          );
          options.current.setList((current) =>
            current.filter((item) => savedJson.get(idOf(item)) !== JSON.stringify(item))
          );
        }

        saving.current = 0;
        setSyncTick((tick) => tick + 1);
      })
      .catch((error) => {
        if (saving.current === asked) saving.current = 0;
        if (asked !== generation.current) return;
        // Signed out: the app shows the login screen (see apiFetch.js).
        if (error.status === 401) return;
        // The server could not be reached, or failed: sent again shortly.
        if (!error.status || error.status >= 500) {
          console.warn(`Unable to save shared ${listName}`, error);
          window.setTimeout(() => setSyncTick((tick) => tick + 1), RETRY_MS);
          return;
        }
        // Refused: not sent again until the next sign-in.
        batch.forEach((item) => refused.current.add(idOf(item)));
        announceSyncNotice({ title: "Not saved", message: error.message });
      });
  }, [enabled, canRead, list, syncTick]);
}
