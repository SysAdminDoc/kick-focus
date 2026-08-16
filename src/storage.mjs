// ---------------------------------------------------------------------------
// Library storage providers
//
// The emote library is the one store that grows without a natural bound, and it
// lives behind a synchronous read: boot needs it before the first render, and
// `localStorage` is the only backend that can answer synchronously. IndexedDB
// holds orders of magnitude more but only answers asynchronously.
//
// So neither one alone is the store. What ships is a proxy over both: a bounded
// *seed* written synchronously so boot is unchanged, and the complete record
// written to IndexedDB, which is read back a moment later and merged in. The
// arithmetic that makes that lossless is pure and lives here, where it is tested
// without a browser; the database calls themselves are thin enough to be proven
// by the live gate against real IndexedDB.
//
// Dexie is deliberately not used. It is a dependency, this file is 200 lines,
// and the schema is two object stores.
// ---------------------------------------------------------------------------

export const LIBRARY_DB_NAME = 'kick-focus';
export const LIBRARY_DB_VERSION = 1;
export const LIBRARY_STORE = 'library';
export const BLOB_STORE = 'blobs';

/**
 * How many library entries the synchronous seed carries.
 *
 * Enough that a picker opened immediately after boot is already useful, small
 * enough that the seed cannot be what fills a 5MB localStorage quota. The rest
 * arrives when the database answers, which is within a frame or two.
 */
export const LIBRARY_SEED_LIMIT = 400;

/**
 * Providers are scored, and the highest available one wins. `localStorage`
 * scores far below anything else because it is the floor: always present,
 * always last, never chosen over a real database.
 */
export const PROVIDER_SCORES = Object.freeze({ indexeddb: 100, localstorage: -1000 });

// Named for this file rather than `isRecord`: every bundled module shares one
// scope in the artifact, so a second top-level `isRecord` is a SyntaxError.
const isStoredRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const SEED_MARKER = 'librarySeedTotal';

function withoutMarker(value) {
  if (!isStoredRecord(value) || !(SEED_MARKER in value)) return value;
  const copy = { ...value };
  delete copy[SEED_MARKER];
  return copy;
}

/**
 * Split a stored value into what goes in the synchronous seed and what goes in
 * the database.
 *
 * Everything except the library is small and travels whole in both. The library
 * is ordered newest-first for the seed, so the entries a seed has to drop are
 * the ones least likely to be reached for in the moment before the full record
 * loads — not an arbitrary prefix of whatever order it happened to be in.
 */
export function planLibraryPersist(value, { seedLimit = LIBRARY_SEED_LIMIT } = {}) {
  const source = isStoredRecord(value) ? withoutMarker(value) : {};
  const library = Array.isArray(source.library) ? source.library : [];
  const limit = Math.max(0, Math.floor(Number(seedLimit)) || 0);
  const ordered = [...library].sort((a, b) => (Number(b?.lastSeen) || 0) - (Number(a?.lastSeen) || 0));
  return {
    full: { ...source, library },
    seed: { ...source, library: ordered.slice(0, limit), [SEED_MARKER]: library.length },
    truncated: Math.max(0, library.length - limit),
  };
}

/** Whether a synchronously-read value is only part of the library. */
export function isSeedPartial(value) {
  if (!isStoredRecord(value)) return false;
  const total = Number(value[SEED_MARKER]);
  if (!Number.isFinite(total)) return false;
  return total > (Array.isArray(value.library) ? value.library.length : 0);
}

/**
 * Fold the database's fuller record back into the seed the page is already
 * using, without losing either side.
 *
 * The seed is written on every change and the database write is queued behind
 * it, so for anything outside the library the seed is the newer copy. Inside the
 * library the two are reconciled per entry, newest `lastSeen` winning, which
 * covers the one case that actually loses data otherwise: a write that reached
 * the seed and had not yet reached the database when the page was closed.
 */
export function mergeHydratedLibrary(seed, hydrated) {
  const base = isStoredRecord(seed) ? seed : {};
  if (!isStoredRecord(hydrated)) return withoutMarker(base);
  const merged = new Map();
  for (const entry of Array.isArray(hydrated.library) ? hydrated.library : []) {
    const key = typeof entry?.key === 'string' ? entry.key : '';
    if (key) merged.set(key, entry);
  }
  for (const entry of Array.isArray(base.library) ? base.library : []) {
    const key = typeof entry?.key === 'string' ? entry.key : '';
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing || (Number(entry.lastSeen) || 0) >= (Number(existing.lastSeen) || 0)) merged.set(key, entry);
  }
  return withoutMarker({ ...hydrated, ...base, library: [...merged.values()] });
}

/** Promisify one IDBRequest. */
function request(source) {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error || new Error('idb-request-failed'));
  });
}

/**
 * Open the database, creating the two stores.
 *
 * Blobs live in their own store rather than beside the records: a record read
 * pulls every value in its store into memory, so keeping images next to the
 * library would make the common read as expensive as the whole cache.
 */
export function openLibraryDatabase(factory) {
  const idb = factory || globalThis.indexedDB;
  if (!idb) return Promise.resolve(null);
  return new Promise((resolve) => {
    let open;
    try {
      open = idb.open(LIBRARY_DB_NAME, LIBRARY_DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(LIBRARY_STORE)) db.createObjectStore(LIBRARY_STORE);
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
    };
    open.onsuccess = () => resolve(open.result);
    // Private-browsing modes and blocked upgrades both land here. Neither is an
    // error worth surfacing: the seed is a working store on its own.
    open.onerror = () => resolve(null);
    open.onblocked = () => resolve(null);
  });
}

/**
 * One store fronting both backends.
 *
 * `host` supplies the synchronous pair the page already has (`readFallback` /
 * `writeFallback`) so this never reaches for `localStorage` itself — which is
 * what lets the userscript build keep using GM storage as the seed.
 */
export function createLibraryStore(host) {
  const {
    readFallback,
    writeFallback,
    indexedDB: factory = null,
    seedLimit = LIBRARY_SEED_LIMIT,
    onError = () => {},
  } = host;

  let database = null;
  let opened = false;
  let queued = null;
  let draining = null;

  const provider = () => (database ? 'indexeddb' : 'localstorage');
  const score = () => PROVIDER_SCORES[provider()];

  async function connect() {
    if (opened) return database;
    opened = true;
    database = await openLibraryDatabase(factory);
    return database;
  }

  /** What boot reads: synchronous, and complete enough to render. */
  function readSync() {
    return readFallback();
  }

  /**
   * Read the full record and merge it into the seed. Returns the merged value,
   * or null when there is nothing more than the seed already had.
   */
  async function hydrate() {
    const db = await connect();
    if (!db) return null;
    try {
      const transaction = db.transaction(LIBRARY_STORE, 'readonly');
      const stored = await request(transaction.objectStore(LIBRARY_STORE).get('preferences'));
      if (!isStoredRecord(stored)) return null;
      return mergeHydratedLibrary(readFallback(), stored);
    } catch (error) {
      onError('hydrate', error);
      return null;
    }
  }

  /**
   * Write both halves. The seed goes first and synchronously, so a tab closed
   * in the next millisecond still has it; the database write is queued behind
   * it and coalesced, because the library is rewritten on every observation.
   */
  function write(value) {
    const plan = planLibraryPersist(value, { seedLimit });
    const ok = writeFallback(plan.seed);
    queued = plan.full;
    void flush();
    return { ok, truncated: plan.truncated, provider: provider() };
  }

  /**
   * Drain the queue, and hand back the drain already running if there is one.
   *
   * Returning early while a write was in flight would make `await flush()` mean
   * "someone else is writing" rather than "the queue is empty" — which is not
   * something a caller can act on, and is exactly what a shutdown flush needs.
   */
  function flush() {
    if (draining) return draining;
    if (queued === null) return Promise.resolve();
    draining = drain().finally(() => { draining = null; });
    return draining;
  }

  async function drain() {
    const db = await connect();
    if (!db) { queued = null; return; }
    try {
      while (queued !== null) {
        const value = queued;
        queued = null;
        const transaction = db.transaction(LIBRARY_STORE, 'readwrite');
        await request(transaction.objectStore(LIBRARY_STORE).put(value, 'preferences'));
      }
    } catch (error) {
      // A quota failure here is survivable: the seed already took the write.
      onError('write', error);
      queued = null;
    }
  }

  async function putBlob(key, blob) {
    const db = await connect();
    if (!db || !key) return false;
    try {
      const transaction = db.transaction(BLOB_STORE, 'readwrite');
      await request(transaction.objectStore(BLOB_STORE).put(blob, key));
      return true;
    } catch (error) {
      onError('put-blob', error);
      return false;
    }
  }

  async function getBlob(key) {
    const db = await connect();
    if (!db || !key) return null;
    try {
      const transaction = db.transaction(BLOB_STORE, 'readonly');
      return await request(transaction.objectStore(BLOB_STORE).get(key)) ?? null;
    } catch (error) {
      onError('get-blob', error);
      return null;
    }
  }

  /** Drop everything this store owns, for the factory reset. */
  async function clear() {
    const db = await connect();
    if (!db) return false;
    try {
      const transaction = db.transaction([LIBRARY_STORE, BLOB_STORE], 'readwrite');
      await Promise.all([
        request(transaction.objectStore(LIBRARY_STORE).clear()),
        request(transaction.objectStore(BLOB_STORE).clear()),
      ]);
      return true;
    } catch (error) {
      onError('clear', error);
      return false;
    }
  }

  return { readSync, hydrate, write, flush, putBlob, getBlob, clear, provider, score };
}
