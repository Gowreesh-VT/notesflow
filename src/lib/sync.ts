import {
  parseCountdown,
  parseFilter,
  parseFolder,
  parseHabit,
  parseItem,
  parseList,
} from "./backup";
import { parsePreferences } from "./preferences";
import type {
  Countdown,
  Folder,
  Habit,
  Item,
  Preferences,
  SavedFilter,
  SyncCollection,
  TaskList,
  Tombstone,
} from "./types";

/** One synced record as sent over the wire. `data` is null for deletions. */
export type SyncRecord = {
  collection: SyncCollection;
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: unknown;
};

export type SyncData = {
  items: Item[];
  lists: TaskList[];
  folders: Folder[];
  filters: SavedFilter[];
  habits: Habit[];
  countdowns: Countdown[];
  settings: Preferences[];
  tombstones: Tombstone[];
};

export type SyncState = { cursor: number; lastPushAt: number };

export const COLLECTIONS: SyncCollection[] = [
  "item",
  "list",
  "folder",
  "filter",
  "habit",
  "countdown",
  "setting",
];

const PARSERS = {
  item: parseItem,
  list: parseList,
  folder: parseFolder,
  filter: parseFilter,
  habit: parseHabit,
  countdown: parseCountdown,
  setting: parsePreferences,
} as const;

/** The SyncData array that holds each collection. */
const FIELDS = {
  item: "items",
  list: "lists",
  folder: "folders",
  filter: "filters",
  habit: "habits",
  countdown: "countdowns",
  setting: "settings",
} as const satisfies Record<SyncCollection, keyof SyncData>;

const isCollection = (value: unknown): value is SyncCollection =>
  COLLECTIONS.includes(value as SyncCollection);

/**
 * Validates a record from the network (or a client) and normalises its data with the same sanitisers the backup
 * importer uses. Returns null for anything malformed. New fields on items/lists/folders must be added to those
 * sanitisers in backup.ts (saved filters: parseFilter), otherwise they are dropped here.
 */
export function sanitizeRecord(raw: unknown, now = Date.now()): SyncRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const collection = r.collection;
  if (!isCollection(collection)) return null;
  if (typeof r.id !== "string" || r.id.length === 0 || r.id.length > 128) return null;
  if (typeof r.updatedAt !== "number" || !Number.isFinite(r.updatedAt) || r.updatedAt <= 0)
    return null;

  if (r.deleted === true) {
    return { collection, id: r.id, updatedAt: r.updatedAt, deleted: true, data: null };
  }

  const parsed = PARSERS[collection](r.data, now);
  if (!parsed || parsed.id !== r.id) return null;
  return { collection, id: r.id, updatedAt: r.updatedAt, deleted: false, data: parsed };
}

/** Everything changed at or after `since` (local clock), plus deletions, ready to push. */
export function collectChanges(data: SyncData, since: number): SyncRecord[] {
  const records: SyncRecord[] = [];
  for (const collection of COLLECTIONS) {
    for (const record of data[FIELDS[collection]]) {
      if (record.updatedAt >= since) {
        records.push({
          collection,
          id: record.id,
          updatedAt: record.updatedAt,
          deleted: false,
          data: record,
        });
      }
    }
  }
  for (const tombstone of data.tombstones) {
    records.push({
      collection: tombstone.collection,
      id: tombstone.id,
      updatedAt: tombstone.at,
      deleted: true,
      data: null,
    });
  }
  return records;
}

function mergeCollection<T extends { id: string; updatedAt: number }>(
  local: T[],
  incoming: SyncRecord[],
  tombstones: Tombstone[],
  collection: SyncCollection,
  since: number,
): { next: T[]; changed: boolean; conflicts: number } {
  const byId = new Map(local.map((x) => [x.id, x]));
  let changed = false;
  let conflicts = 0;

  for (const record of incoming) {
    if (record.collection !== collection) continue;
    const existing = byId.get(record.id);
    const deletedLocallyAt = tombstones.find(
      (t) => t.collection === collection && t.id === record.id,
    )?.at;
    // Both this device (after its last push) and another device changed the record: last write wins. A local
    // edit stamped exactly at the last push time was already pushed, so it is not a conflict.
    if (existing && existing.updatedAt > since && record.updatedAt !== existing.updatedAt) {
      conflicts++;
    }

    if (record.deleted) {
      if (existing && existing.updatedAt <= record.updatedAt) {
        byId.delete(record.id);
        changed = true;
      }
    } else {
      if (deletedLocallyAt !== undefined && deletedLocallyAt >= record.updatedAt) continue;
      if (!existing || record.updatedAt > existing.updatedAt) {
        byId.set(record.id, record.data as T);
        changed = true;
      }
    }
  }

  return { next: changed ? [...byId.values()] : local, changed, conflicts };
}

/** Last-write-wins merge of records from the server into local data. Returns the same arrays if nothing changed. */
export function applyRecords(
  data: SyncData,
  records: SyncRecord[],
  since = Infinity,
): { data: SyncData; changed: boolean; conflicts: number } {
  const valid = records.flatMap((r) => sanitizeRecord(r) ?? []);
  // Keep the original (possibly large) updatedAt values: sanitizeRecord preserves them.
  const next: SyncData = { ...data };
  const merged = COLLECTIONS.map((collection) => {
    const field = FIELDS[collection];
    const result = mergeCollection<{ id: string; updatedAt: number }>(
      data[field],
      valid,
      data.tombstones,
      collection,
      since,
    );
    (next as Record<string, unknown>)[field] = result.next;
    return result;
  });
  return {
    data: next,
    changed: merged.some((m) => m.changed),
    conflicts: merged.reduce((sum, m) => sum + m.conflicts, 0),
  };
}

export type SyncResponse = { cursor: number; records: SyncRecord[]; hasMore: boolean };

export type SyncDeps = {
  getData: () => SyncData;
  setData: (partial: Partial<SyncData>) => void;
  dropTombstones: (acknowledged: Tombstone[]) => void;
  getState: () => SyncState;
  setState: (state: SyncState) => void;
  post: (body: { cursor: number; changes: SyncRecord[] }) => Promise<SyncResponse>;
};

const MAX_PAGES = 20;

/** Pushes local changes, then pulls everything new from the server. Throws if the network call fails. */
export async function syncOnce(
  deps: SyncDeps,
): Promise<{ pushed: number; pulled: number; conflicts: number }> {
  const state = deps.getState();
  const snapshot = deps.getData();
  const changes = collectChanges(snapshot, state.lastPushAt);
  const sentTombstones = [...snapshot.tombstones];

  let cursor = state.cursor;
  let pulled = 0;
  let conflicts = 0;
  let outgoing = changes;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await deps.post({ cursor, changes: outgoing });
    outgoing = [];
    const merged = applyRecords(deps.getData(), response.records, state.lastPushAt);
    conflicts += merged.conflicts;
    if (merged.changed) {
      deps.setData({
        items: merged.data.items,
        lists: merged.data.lists,
        folders: merged.data.folders,
        filters: merged.data.filters,
        habits: merged.data.habits,
        countdowns: merged.data.countdowns,
        settings: merged.data.settings,
      });
    }
    cursor = response.cursor;
    pulled += response.records.length;
    if (!response.hasMore) break;
  }

  deps.dropTombstones(sentTombstones);
  const newest = changes.reduce((max, c) => Math.max(max, c.updatedAt), state.lastPushAt);
  deps.setState({ cursor, lastPushAt: newest });
  return { pushed: changes.length, pulled, conflicts };
}
