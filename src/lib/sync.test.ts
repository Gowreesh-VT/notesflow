import { describe, expect, it } from "vitest";
import {
  applyRecords,
  collectChanges,
  sanitizeRecord,
  syncOnce,
  type SyncData,
  type SyncDeps,
  type SyncRecord,
  type SyncResponse,
  type SyncState,
} from "./sync";
import { EMPTY_CRITERIA } from "./filters";
import { INBOX_ID, type Item, type SavedFilter, type TaskList } from "./types";

const item = (id: string, patch: Partial<Item> = {}): Item => ({
  id,
  kind: "task",
  title: id,
  body: "",
  listId: INBOX_ID,
  createdAt: 1,
  updatedAt: 10,
  deletedAt: null,
  pinned: false,
  status: "open",
  completedAt: null,
  priority: "none",
  due: null,
  subtasks: [],
  sectionId: null,
  ...patch,
});

const list = (id: string, patch: Partial<TaskList> = {}): TaskList => ({
  id,
  name: id,
  sections: [],
  folderId: null,
  createdAt: 1,
  updatedAt: 10,
  ...patch,
});

const empty = (): SyncData => ({
  items: [],
  lists: [],
  folders: [],
  filters: [],
  tombstones: [],
});
const rec = (
  collection: SyncRecord["collection"],
  data: { id: string; updatedAt: number },
): SyncRecord => ({
  collection,
  id: data.id,
  updatedAt: data.updatedAt,
  deleted: false,
  data,
});
const del = (collection: SyncRecord["collection"], id: string, updatedAt: number): SyncRecord => ({
  collection,
  id,
  updatedAt,
  deleted: true,
  data: null,
});

describe("sanitizeRecord", () => {
  it("accepts well-formed records and normalises their data", () => {
    const record = sanitizeRecord({
      collection: "item",
      id: "a",
      updatedAt: 5,
      deleted: false,
      data: { ...item("a"), priority: "bogus", extra: "dropped" },
    });
    expect(record?.data).toMatchObject({ id: "a", priority: "none" });
    expect(record?.data).not.toHaveProperty("extra");
  });

  it("rejects malformed records", () => {
    expect(sanitizeRecord(null)).toBeNull();
    expect(sanitizeRecord({ collection: "nope", id: "a", updatedAt: 1, data: {} })).toBeNull();
    expect(
      sanitizeRecord({ collection: "item", id: "", updatedAt: 1, data: item("a") }),
    ).toBeNull();
    expect(
      sanitizeRecord({ collection: "item", id: "a", updatedAt: 0, data: item("a") }),
    ).toBeNull();
    expect(
      sanitizeRecord({ collection: "item", id: "a", updatedAt: 1, data: item("b") }),
    ).toBeNull();
    expect(
      sanitizeRecord({
        collection: "item",
        id: "a",
        updatedAt: 1,
        data: { kind: "task", title: " " },
      }),
    ).toBeNull();
  });

  it("accepts deletions without data", () => {
    expect(sanitizeRecord({ collection: "list", id: "l", updatedAt: 3, deleted: true })).toEqual(
      del("list", "l", 3),
    );
  });
});

describe("collectChanges", () => {
  it("includes records updated since the cutoff and every tombstone", () => {
    const data: SyncData = {
      items: [item("old", { updatedAt: 5 }), item("new", { updatedAt: 20 })],
      lists: [list("l", { updatedAt: 30 })],
      folders: [],
      filters: [],
      tombstones: [{ collection: "item", id: "gone", at: 7 }],
    };
    const changes = collectChanges(data, 20);
    expect(changes.map((c) => `${c.collection}:${c.id}:${c.deleted}`)).toEqual([
      "item:new:false",
      "list:l:false",
      "item:gone:true",
    ]);
  });
});

describe("applyRecords", () => {
  it("adds new records and keeps the same arrays when nothing changes", () => {
    const data = empty();
    const added = applyRecords(data, [rec("item", item("a"))]);
    expect(added.changed).toBe(true);
    expect(added.data.items.map((i) => i.id)).toEqual(["a"]);

    const same = applyRecords(added.data, [rec("item", item("a"))]);
    expect(same.changed).toBe(false);
    expect(same.data.items).toBe(added.data.items);
  });

  it("last write wins in both directions", () => {
    const data = { ...empty(), items: [item("a", { title: "local", updatedAt: 50 })] };
    const older = applyRecords(data, [rec("item", item("a", { title: "remote", updatedAt: 40 }))]);
    expect(older.data.items[0].title).toBe("local");
    const newer = applyRecords(data, [rec("item", item("a", { title: "remote", updatedAt: 60 }))]);
    expect(newer.data.items[0].title).toBe("remote");
  });

  it("applies deletions only when they are newer than the local copy", () => {
    const data = {
      ...empty(),
      items: [item("a", { updatedAt: 50 })],
      lists: [list("l", { updatedAt: 10 })],
    };
    const kept = applyRecords(data, [del("item", "a", 40)]);
    expect(kept.data.items).toHaveLength(1);
    const removed = applyRecords(data, [del("item", "a", 60), del("list", "l", 20)]);
    expect(removed.data.items).toHaveLength(0);
    expect(removed.data.lists).toHaveLength(0);
  });

  it("does not resurrect something the user deleted later than the incoming change", () => {
    const data: SyncData = { ...empty(), tombstones: [{ collection: "item", id: "a", at: 100 }] };
    expect(applyRecords(data, [rec("item", item("a", { updatedAt: 90 }))]).changed).toBe(false);
    expect(applyRecords(data, [rec("item", item("a", { updatedAt: 110 }))]).changed).toBe(true);
  });

  it("ignores invalid records", () => {
    const result = applyRecords(empty(), [
      { collection: "item", id: "x", updatedAt: 1, deleted: false, data: 5 },
    ]);
    expect(result.changed).toBe(false);
  });
});

describe("syncOnce", () => {
  const harness = (initial: SyncData, state: SyncState, responses: SyncResponse[]) => {
    let data = initial;
    let syncState = state;
    const posts: { cursor: number; changes: SyncRecord[] }[] = [];
    const dropped: unknown[] = [];
    const deps: SyncDeps = {
      getData: () => data,
      setData: (partial) => {
        data = { ...data, ...partial };
      },
      dropTombstones: (t) => {
        dropped.push(...t);
        data = { ...data, tombstones: data.tombstones.filter((x) => !t.includes(x)) };
      },
      getState: () => syncState,
      setState: (s) => {
        syncState = s;
      },
      post: async (body) => {
        posts.push(body);
        const next = responses.shift();
        if (!next) throw new Error("unexpected extra request");
        return next;
      },
    };
    return { deps, posts, dropped, data: () => data, state: () => syncState };
  };

  it("pushes local changes and tombstones, pulls remote records and advances the cursor", async () => {
    const t = harness(
      {
        ...empty(),
        items: [item("local", { updatedAt: 100 })],
        tombstones: [{ collection: "list", id: "x", at: 90 }],
      },
      { cursor: 5, lastPushAt: 50 },
      [{ cursor: 9, hasMore: false, records: [rec("item", item("remote", { updatedAt: 70 }))] }],
    );
    const result = await syncOnce(t.deps);
    expect(result).toEqual({ pushed: 2, pulled: 1, conflicts: 0 });
    expect(t.posts[0].cursor).toBe(5);
    expect(t.posts[0].changes.map((c) => c.id)).toEqual(["local", "x"]);
    expect(
      t
        .data()
        .items.map((i) => i.id)
        .sort(),
    ).toEqual(["local", "remote"]);
    expect(t.data().tombstones).toEqual([]);
    expect(t.state()).toEqual({ cursor: 9, lastPushAt: 100 });
  });

  it("follows hasMore pages and only pushes on the first request", async () => {
    const t = harness(
      { ...empty(), items: [item("a", { updatedAt: 100 })] },
      { cursor: 0, lastPushAt: 0 },
      [
        { cursor: 1, hasMore: true, records: [rec("item", item("r1", { updatedAt: 5 }))] },
        { cursor: 2, hasMore: false, records: [rec("item", item("r2", { updatedAt: 6 }))] },
      ],
    );
    await syncOnce(t.deps);
    expect(t.posts).toHaveLength(2);
    expect(t.posts[0].changes).toHaveLength(1);
    expect(t.posts[1]).toEqual({ cursor: 1, changes: [] });
    expect(t.state().cursor).toBe(2);
  });

  it("leaves state and tombstones untouched when the request fails", async () => {
    const t = harness(
      { ...empty(), tombstones: [{ collection: "item", id: "x", at: 1 }] },
      { cursor: 3, lastPushAt: 1 },
      [],
    );
    await expect(syncOnce(t.deps)).rejects.toThrow("unexpected extra request");
    expect(t.state()).toEqual({ cursor: 3, lastPushAt: 1 });
    expect(t.data().tombstones).toHaveLength(1);
  });
});

describe("conflicts", () => {
  it("counts records changed both here (since the last push) and elsewhere", () => {
    const note = (id: string, updatedAt: number) => ({
      id,
      kind: "note",
      title: id,
      body: "",
      listId: INBOX_ID,
      createdAt: 1,
      updatedAt,
    });
    const record = (id: string, updatedAt: number) => ({
      collection: "item" as const,
      id,
      updatedAt,
      deleted: false,
      data: note(id, updatedAt),
    });
    const data = {
      items: [note("edited", 50), note("old", 5)] as unknown as Item[],
      lists: [],
      folders: [],
      filters: [],
      tombstones: [],
    };
    // "edited" changed here after the last push (40) and elsewhere; "old" only changed elsewhere.
    expect(applyRecords(data, [record("edited", 60), record("old", 70)], 40).conflicts).toBe(1);
    expect(applyRecords(data, [record("edited", 50)], 40).conflicts).toBe(0);
    // "edited" (50) was already pushed (last push = 50); a later change from elsewhere is not a conflict.
    expect(applyRecords(data, [record("edited", 60)], 50).conflicts).toBe(0);
  });
});

describe("saved filters", () => {
  const filter = (id: string, updatedAt = 10): SavedFilter => ({
    id,
    name: id,
    criteria: { ...EMPTY_CRITERIA, priorities: ["high"] },
    createdAt: 1,
    updatedAt,
  });

  it("sanitises filter records and rejects nameless ones", () => {
    const record = sanitizeRecord({
      collection: "filter",
      id: "f",
      updatedAt: 5,
      deleted: false,
      data: { ...filter("f"), criteria: { priorities: ["high", "bogus"] }, extra: 1 },
    });
    expect(record?.data).toEqual(filter("f"));
    expect(
      sanitizeRecord({
        collection: "filter",
        id: "f",
        updatedAt: 5,
        data: { ...filter("f"), name: " " },
      }),
    ).toBeNull();
  });

  it("pushes, pulls and deletes filters like other records", () => {
    const data: SyncData = {
      ...empty(),
      filters: [filter("mine", 30)],
      tombstones: [{ collection: "filter", id: "gone", at: 40 }],
    };
    expect(collectChanges(data, 20).map((c) => `${c.collection}:${c.id}:${c.deleted}`)).toEqual([
      "filter:mine:false",
      "filter:gone:true",
    ]);

    const pulled = applyRecords(empty(), [rec("filter", filter("remote", 50))]);
    expect(pulled.data.filters).toEqual([filter("remote", 50)]);
    const deleted = applyRecords(pulled.data, [del("filter", "remote", 60)]);
    expect(deleted.data.filters).toEqual([]);
    expect(deleted.changed).toBe(true);
  });

  it("round-trips filters through syncOnce", async () => {
    let data: SyncData = { ...empty(), filters: [filter("local", 100)] };
    const sent: SyncRecord[] = [];
    await syncOnce({
      getData: () => data,
      setData: (partial) => {
        data = { ...data, ...partial };
      },
      dropTombstones: () => {},
      getState: () => ({ cursor: 0, lastPushAt: 0 }),
      setState: () => {},
      post: async (body) => {
        sent.push(...body.changes);
        return { cursor: 1, hasMore: false, records: [rec("filter", filter("remote", 70))] };
      },
    });
    expect(sent.map((c) => c.id)).toEqual(["local"]);
    expect(data.filters.map((f) => f.id).sort()).toEqual(["local", "remote"]);
  });
});
