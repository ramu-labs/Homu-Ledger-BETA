// IndexedDB-backed pending-write queue for the offline rollout.
//
// Phase 3 of pragmatic-offline. When the user taps "Add" while offline (or
// the network drops mid-request), the action's FormData is serialised and
// stored here. components/sync-replay.tsx watches 'online' /
// visibilitychange and drains the queue back through the matching server
// actions. The server's partial unique index on (household_id, client_op_id)
// — landed in Phase 2 (v1.35.0) — makes the replay safely idempotent.
//
// Deliberately a thin direct-IDB wrapper rather than a dep (idb-keyval,
// dexie, etc) — the queue's whole API surface is ~5 methods and zero deps
// is one less moving piece during the cache-invalidation / SW-update story.

export type QueueOpAction = "addTransaction" | "addWallet" | "addCategory";

export type QueuedOp = {
  /** Local primary key + the value sent to the server as client_op_id. */
  id: string;
  action: QueueOpAction;
  /** Plain string map — FormData entries copied into a serialisable form.
   *  Photo blobs are excluded by the caller, since uploads land in Storage
   *  directly and the action just receives the resulting path. */
  payload: Record<string, string>;
  createdAt: number;
  /** How many replay attempts have run + failed. Used by sync-replay for
   *  exponential backoff and the "won't keep retrying forever" guard. */
  attempts: number;
  /** Last network/server error message — surfaced in the diagnostics UI
   *  (future Phase 3b). Not user-visible today. */
  lastError?: string;
};

const DB_NAME = "homu-sync";
const DB_VERSION = 1;
const STORE = "ops";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    // SSR / server-action context — every method here is a no-op on the
    // server. Callers must only invoke the queue from client components.
    return Promise.reject(new Error("indexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // Use `id` as the in-line key. Insertion order is preserved by
        // IDB's cursor-on-key traversal, so the replay loop drains FIFO.
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

// ── Pub/sub for the status pill and any future diagnostics UI. ────────
const listeners = new Set<() => void>();

/** Subscribe to queue change events. Returns an unsubscribe function. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Listener errors must not break enqueue/replay.
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────

/** Persist a new op and notify subscribers. */
export async function enqueue(op: Omit<QueuedOp, "attempts">): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, "readwrite").put({ ...op, attempts: 0 });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  emit();
}

/** Read every pending op, FIFO by insertion order. */
export async function getAll(): Promise<QueuedOp[]> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return [];
  }
  return new Promise<QueuedOp[]>((resolve, reject) => {
    const req = tx(db, "readonly").getAll();
    req.onsuccess = () => resolve((req.result as QueuedOp[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a single op by id (called after a successful replay). */
export async function remove(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  emit();
}

/** Bump attempts + record the last error after a failed replay. */
export async function recordFailure(id: string, error: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const store = tx(db, "readwrite");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as QueuedOp | undefined;
      if (!existing) {
        resolve();
        return;
      }
      const updated: QueuedOp = {
        ...existing,
        attempts: existing.attempts + 1,
        lastError: error,
      };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
  emit();
}

/** Snapshot count without loading every payload. */
export async function count(): Promise<number> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return 0;
  }
  return new Promise<number>((resolve, reject) => {
    const req = tx(db, "readonly").count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
