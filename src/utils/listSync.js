// Helpers for the lists the staff screens share through the server (pool
// tables, equipment, inventory products, tournaments). The server keeps each item with a version;
// a screen sends only what it changed, each item with the version it last saw,
// so it can never overwrite a list it did not read, nor an item someone else
// changed in the meantime. See backend/config/collection.php.

const idOf = (item) => (item && item.id !== undefined && item.id !== null ? String(item.id) : "");

// The server's copy as last read: id -> the item as JSON.
export const snapshotOf = (items) => new Map(items.map((item) => [idOf(item), JSON.stringify(item)]));

/**
 * What this screen changed since the server's copy it last read:
 * { upsert: [{ item, version }], remove: [{ id, version }] }. Version 0 is a new
 * item. A screen that may not add or remove items leaves those out.
 */
export const diffList = (snapshot, list, versions, { canCreate = true, canRemove = true } = {}) => {
  const upsert = [];
  const remove = [];
  const seen = new Set();

  list.forEach((item) => {
    const id = idOf(item);
    if (!id || seen.has(id)) return;
    seen.add(id);
    if (!snapshot.has(id)) {
      if (canCreate) upsert.push({ item, version: 0 });
      return;
    }
    if (snapshot.get(id) !== JSON.stringify(item)) upsert.push({ item, version: Number(versions[id]) || 0 });
  });

  if (canRemove) {
    snapshot.forEach((_json, id) => {
      if (!seen.has(id)) remove.push({ id, version: Number(versions[id]) || 0 });
    });
  }

  return { upsert, remove };
};

export const hasChanges = (changes) => changes.upsert.length > 0 || changes.remove.length > 0;

/**
 * One screen's change to an item, made again on the latest copy: each field it
 * changed takes its value, the rest stay as the latest has them. Fields in
 * `add` (a stock count) take the difference instead, so two counters selling
 * the same product at once both take theirs off. Null when the item is gone.
 */
export const mergeChanges = (before, mine, latest, { add = [] } = {}) => {
  if (!before || !mine || !latest) return null;
  const merged = { ...latest };
  Object.keys(mine).forEach((key) => {
    if (JSON.stringify(mine[key]) === JSON.stringify(before[key])) return;
    merged[key] = add.includes(key)
      ? Math.max(0, (Number(latest[key]) || 0) + (Number(mine[key]) || 0) - (Number(before[key]) || 0))
      : mine[key];
  });
  return merged;
};

// Several items removed in one save need confirming to the server (it refuses
// a mass removal otherwise). Only an explicit delete on screen confirms, by
// calling confirmRemoval just before taking the items off the list.
const confirmedRemovals = new Map();

export const confirmRemoval = (listName, ids) => {
  const confirmed = confirmedRemovals.get(listName) || new Set();
  ids.forEach((id) => confirmed.add(String(id)));
  confirmedRemovals.set(listName, confirmed);
};

// The removals in this save that were confirmed; each confirmation is used once.
export const takeConfirmedRemovals = (listName, ids) => {
  const confirmed = confirmedRemovals.get(listName);
  if (!confirmed) return [];
  const taken = ids.filter((id) => confirmed.has(id));
  taken.forEach((id) => confirmed.delete(id));
  return taken;
};

// A note for the staff on screen (shown as a toast by SyncNotices).
export const SYNC_NOTICE_EVENT = "bc:sync-notice";

export const announceSyncNotice = (notice) => {
  window.dispatchEvent(new CustomEvent(SYNC_NOTICE_EVENT, { detail: notice }));
};
