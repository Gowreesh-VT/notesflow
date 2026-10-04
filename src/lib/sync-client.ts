import { syncOnce, type SyncResponse } from "./sync";
import { useSyncStore } from "@/store/sync";
import { useWorkspace } from "@/store/workspace";

const EMPTY = { items: [], lists: [], folders: [], tombstones: [] };

class SyncHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function post(body: unknown): Promise<SyncResponse> {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 401) throw new SyncHttpError(401, "Your session expired. Sign in again.");
  if (!response.ok)
    throw new SyncHttpError(response.status, "The server could not sync right now.");
  return (await response.json()) as SyncResponse;
}

/**
 * Called when a signed-in user is known. First sign-in on a device keeps the local data (it is pushed to the
 * account). A different account than the one this device last synced with starts clean, so data never leaks
 * between accounts on a shared device.
 */
export function adoptUser(userId: string): void {
  const sync = useSyncStore.getState();
  if (sync.userId === userId) return;
  if (sync.userId !== null) useWorkspace.getState().setData(EMPTY);
  useSyncStore.setState({ userId, cursor: 0, lastPushAt: 0, status: "idle", error: null });
}

let running: Promise<void> | null = null;
let rerun = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Syncs now. Overlapping calls share one run; changes made meanwhile trigger one follow-up run. */
export function runSync(): Promise<void> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    do {
      rerun = false;
      await syncRound();
    } while (
      rerun &&
      useSyncStore.getState().status !== "error" &&
      useSyncStore.getState().status !== "offline"
    );
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncRound(): Promise<void> {
  const sync = useSyncStore;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    sync.setState({ status: "offline" });
    return;
  }
  sync.setState({ status: "syncing", error: null });
  try {
    const workspace = useWorkspace;
    const result = await syncOnce({
      getData: () => {
        const { items, lists, folders, tombstones } = workspace.getState();
        return { items, lists, folders, tombstones };
      },
      setData: (partial) => workspace.getState().setData(partial),
      dropTombstones: (t) => workspace.getState().dropTombstones(t),
      getState: () => ({ cursor: sync.getState().cursor, lastPushAt: sync.getState().lastPushAt }),
      setState: (s) => sync.setState(s),
      post,
    });
    sync.setState({
      status: "synced",
      lastSyncedAt: Date.now(),
      error: null,
      ...(result.conflicts ? { conflictsResolved: result.conflicts, conflictsAt: Date.now() } : {}),
    });
  } catch (error) {
    if (error instanceof TypeError || navigator.onLine === false) {
      sync.setState({ status: "offline", error: null });
    } else {
      sync.setState({
        status: "error",
        error: error instanceof Error ? error.message : "Sync failed.",
      });
    }
  }
}

/** Debounced sync request, used after local edits. */
export function requestSync(delayMs = 2000): void {
  clearTimeout(timer);
  timer = setTimeout(() => void runSync(), delayMs);
}

/** Forgets everything stored for the account on this device. */
export function wipeLocalAccountData(): void {
  clearTimeout(timer);
  useWorkspace.getState().setData(EMPTY);
  useSyncStore.getState().reset();
}
