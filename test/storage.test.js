import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BLOB_STORE,
  LIBRARY_SEED_BYTES,
  LIBRARY_SEED_LIMIT,
  LIBRARY_STORE,
  PROVIDER_SCORES,
  createLibraryStore,
  describeLibrarySeed,
  isSeedPartial,
  mergeHydratedLibrary,
  planLibraryPersist,
  utf8ByteLength,
} from '../src/storage.mjs';

const entry = (key, lastSeen, extra = {}) => ({ key, name: key, src: `https://files.kick.com/emotes/${key}`, lastSeen, ...extra });
const libraryOf = (count, from = 0) => Array.from({ length: count }, (_v, index) => entry(`kick:id:${from + index}`, from + index));

const preferences = (library) => ({
  schema: 10,
  favorites: [{ key: 'kick:id:3', scope: 'global' }],
  order: ['kick:id:7', 'kick:id:3'],
  hidden: ['kick:id:5'],
  view: 'all',
  showHidden: false,
  activeGroup: 'g1',
  groups: [{ id: 'g1', name: 'Faces' }],
  assignments: [{ key: 'kick:id:7', groupId: 'g1' }],
  library,
});

/**
 * A minimal IndexedDB, only as real as the store's use of it: two object
 * stores, get/put/clear, and requests that settle asynchronously. Enough to
 * drive the seed/promote cycle end to end; the real database is exercised by
 * the live gate, which runs against Chromium's.
 */
function fakeIndexedDB({ failOpen = false, failWrite = false } = {}) {
  const stores = new Map([[LIBRARY_STORE, new Map()], [BLOB_STORE, new Map()]]);
  const settle = (result, error) => {
    const req = { result, error: error || null, onsuccess: null, onerror: null };
    queueMicrotask(() => (error ? req.onerror?.() : req.onsuccess?.()));
    return req;
  };
  const counts = { transactions: 0 };
  const database = {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore: (name) => stores.set(name, new Map()),
    transaction: (names) => (counts.transactions += 1) && ({
      objectStore: (name) => ({
        get: (key) => settle(stores.get(name).get(key)),
        put: (value, key) => (failWrite
          ? settle(undefined, new Error('QuotaExceededError'))
          : settle(stores.get(name).set(key, value) && key)),
        clear: () => settle(stores.get(name).clear()),
      }),
      __names: names,
    }),
  };
  return {
    __stores: stores,
    __counts: counts,
    open: () => {
      const req = { result: database, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      queueMicrotask(() => (failOpen ? req.onerror?.() : req.onsuccess?.()));
      return req;
    },
  };
}

function makeStore(overrides = {}) {
  let fallback = overrides.initial ?? {};
  const errors = [];
  const idb = overrides.idb === undefined ? fakeIndexedDB() : overrides.idb;
  const store = createLibraryStore({
    readFallback: () => fallback,
    writeFallback: (seed) => { fallback = seed; return true; },
    indexedDB: idb,
    seedLimit: overrides.seedLimit,
    onError: (stage, error) => errors.push([stage, error?.message]),
  });
  return { store, idb, errors, seed: () => fallback };
}

test('the seed carries everything small and the newest slice of the library', { tags: ['unit'] }, () => {
  const value = preferences(libraryOf(1000));
  const plan = planLibraryPersist(value, { seedLimit: 50 });

  assert.equal(plan.seed.library.length, 50);
  assert.equal(plan.truncated, 950);
  assert.equal(plan.full.library.length, 1000);
  // Newest first, so what a seed drops is what the user is least likely to
  // reach for in the moment before the database answers.
  assert.deepEqual(plan.seed.library.map((item) => item.lastSeen), Array.from({ length: 50 }, (_v, i) => 999 - i));
  // Everything that is not the library travels whole in both.
  for (const field of ['favorites', 'order', 'hidden', 'groups', 'assignments', 'view', 'activeGroup', 'schema']) {
    assert.deepEqual(plan.seed[field], value[field], `${field} is complete in the seed`);
    assert.deepEqual(plan.full[field], value[field], `${field} is complete in the record`);
  }
  assert.equal(isSeedPartial(plan.seed), true);
  assert.equal(isSeedPartial(plan.full), false);
});

test('an oversized library is trimmed by bytes, not only by entry count', { tags: ['unit'] }, () => {
  // Every field of a library record is length-bounded on its own, and at all of
  // those ceilings at once one entry serialises to about 3.4 KB — so the 400
  // the count allows is 1.3 MB of localStorage sitting beside an injected
  // userscript that has its own ~1 MB ceiling. The count is the ordinary cap;
  // this is the one that holds when the entries are not ordinary.
  const fat = Array.from({ length: 400 }, (_v, index) => ({
    key: `kick:name:${'k'.repeat(340)}${index}`,
    id: 'i'.repeat(120),
    name: '表'.repeat(80),
    src: `https://files.kick.com/emotes/${'s'.repeat(440)}${index}`,
    nativeGroups: Array.from({ length: 20 }, (_g, group) => `${group}`.padEnd(80, 'g')),
    access: 'available',
    wasName: 'w'.repeat(80),
    wasSrc: `https://files.kick.com/emotes/${'q'.repeat(440)}${index}`,
    lastSeen: index,
  }));
  const plan = planLibraryPersist(preferences(fat));
  const bytes = new TextEncoder().encode(JSON.stringify(plan.seed)).byteLength;
  assert.ok(bytes <= LIBRARY_SEED_BYTES, `seed is ${bytes} B, over the ${LIBRARY_SEED_BYTES} B budget`);
  assert.ok(plan.seed.library.length > 0, 'the budget trimmed the seed to nothing');
  assert.ok(plan.seed.library.length < 400, 'the byte budget did not trim anything');
  // Still the newest entries, and still reported as partial.
  assert.equal(plan.seed.library[0].lastSeen, 399);
  assert.equal(isSeedPartial(plan.seed), true);
  assert.equal(plan.truncated, 400 - plan.seed.library.length);
  // The full record is untouched: only the synchronous seed is bounded.
  assert.equal(plan.full.library.length, 400);
  assert.deepEqual(mergeHydratedLibrary(plan.seed, plan.full).library.length, 400);

  // One entry too big for the budget on its own leaves an empty seed rather
  // than an oversized one, and the database still holds the record.
  const huge = planLibraryPersist(preferences([{ ...fat[0], name: 'x'.repeat(80), src: `https://files.kick.com/emotes/${'z'.repeat(460)}` }]), { seedBytes: 200 });
  assert.equal(huge.seed.library.length, 0);
  assert.equal(huge.full.library.length, 1);
});

/**
 * A record shaped like the ones Kick actually returns, not like the short
 * synthetic keys the rest of this file uses.
 *
 * This matters because the previous version of the test below measured a
 * ~107 B entry, called it realistic, and concluded the byte budget was never
 * reached. A real record is roughly twice that, so the budget binds long before
 * the 400-entry count does — and when the budget dropped to 50 KB the only
 * thing that changed was the assertion.
 */
const realisticEntry = (index) => ({
  key: `kick:${1730000 + index}`,
  id: String(1730000 + index),
  name: `channelEmote${index}`,
  src: `https://files.kick.com/emotes/${1730000 + index}/fullsize`,
  nativeGroups: ['SomeChannelName'],
  access: 'available',
  channel: 'somechannelname',
  lastSeen: index,
});

test('the byte budget, not the entry count, is what bounds a realistic library', { tags: ['unit'] }, () => {
  const one = utf8ByteLength(JSON.stringify(realisticEntry(0)));
  assert.ok(one > 150 && one < 400, `a realistic record measured ${one} B, so this test is no longer modelling one`);

  const plan = planLibraryPersist(preferences(Array.from({ length: LIBRARY_SEED_LIMIT }, (_v, i) => realisticEntry(i))));
  const bytes = utf8ByteLength(JSON.stringify(plan.seed));
  assert.ok(bytes <= LIBRARY_SEED_BYTES, `seed is ${bytes} B, over the ${LIBRARY_SEED_BYTES} B budget`);

  // The count limit is unreachable at this budget, and saying so out loud is
  // the point: LIBRARY_SEED_LIMIT is documentation, LIBRARY_SEED_BYTES is the
  // limit. If a future budget makes both reachable, this assertion is the one
  // that should be revisited deliberately rather than relaxed.
  assert.ok(plan.seed.library.length < LIBRARY_SEED_LIMIT,
    `the budget stopped binding: ${plan.seed.library.length} of ${LIBRARY_SEED_LIMIT} entries fit`);
  // Enough of the library survives to be worth painting. Well under this and
  // the seed stops being a useful first paint at all.
  assert.ok(plan.seed.library.length >= 150,
    `only ${plan.seed.library.length} realistic emotes fit in ${LIBRARY_SEED_BYTES} B`);
  assert.equal(plan.truncated, LIBRARY_SEED_LIMIT - plan.seed.library.length);
  assert.equal(isSeedPartial(plan.seed), true);
  assert.equal(plan.full.library.length, LIBRARY_SEED_LIMIT, 'the database still holds every entry');
});

test('a stored seed carries the number the panel needs, with no write to learn it', { tags: ['unit'] }, () => {
  // The runtime learns the trim from a write. A user who opens settings without
  // touching an emote never triggers one, so the number has to be readable from
  // what is already on disk. This is the contract readStoredLibrarySeed uses.
  const plan = planLibraryPersist(preferences(libraryOf(400)), { seedLimit: 100 });
  assert.equal(isSeedPartial(plan.seed), true);
  const total = Number(plan.seed.librarySeedTotal);
  assert.equal(total, 400);
  assert.equal(total - plan.seed.library.length, plan.truncated);
  assert.deepEqual(
    describeLibrarySeed({ truncated: total - plan.seed.library.length, total }).values,
    { held: 100, total: 400 },
  );

  // And a complete seed carries the marker without claiming a trim.
  const whole = planLibraryPersist(preferences(libraryOf(12)));
  assert.equal(isSeedPartial(whole.seed), false);
  assert.equal(Number(whole.seed.librarySeedTotal), 12);
});

test('a trimmed seed says so, and a complete one stays silent', { tags: ['unit'] }, () => {
  assert.equal(describeLibrarySeed({ truncated: 0, total: 400 }), null);
  assert.equal(describeLibrarySeed(), null);
  assert.equal(describeLibrarySeed({ truncated: -5, total: 10 }), null, 'a negative count is not a trim');

  const note = describeLibrarySeed({ truncated: 156, total: 400 });
  assert.equal(note.truncated, 156);
  assert.equal(note.held, 244);
  assert.deepEqual(note.values, { held: 244, total: 400 });
  // Translated as a template and filled afterwards: a sentence carrying two
  // counts can never match a dictionary key.
  assert.match(note.messageKey, /\{held\}/);
  assert.match(note.messageKey, /\{total\}/);
});

test('browser storage budgets count UTF-8 bytes instead of UTF-16 code units', { tags: ['unit'] }, () => {
  const value = 'plain é 🧪 表';
  assert.equal(utf8ByteLength(value), Buffer.byteLength(value, 'utf8'));
  assert.ok(utf8ByteLength(value) > value.length, 'the probe must distinguish bytes from characters');
});

test('a library that fits leaves nothing behind and is not marked partial', { tags: ['unit'] }, () => {
  const value = preferences(libraryOf(12));
  const plan = planLibraryPersist(value, { seedLimit: LIBRARY_SEED_LIMIT });
  assert.equal(plan.truncated, 0);
  assert.equal(isSeedPartial(plan.seed), false);
  assert.deepEqual(mergeHydratedLibrary(plan.seed, plan.full), value);
});

test('the round trip through both halves is lossless, at any size', { tags: ['unit'] }, () => {
  // The migration invariant: whatever is split across the two backends comes
  // back as exactly what went in, including the library's order.
  for (const size of [0, 1, 399, 400, 401, 2400]) {
    const value = preferences(libraryOf(size));
    const plan = planLibraryPersist(value);
    const restored = mergeHydratedLibrary(plan.seed, plan.full);
    assert.deepEqual(restored, value, `${size} entries survive the split`);
    assert.deepEqual(restored.library.map((item) => item.key), value.library.map((item) => item.key),
      `${size} entries keep their order`);
  }
});

test('a write that only reached the seed is not lost to an older database record', { tags: ['unit'] }, () => {
  // The case that actually loses data otherwise: the seed was written, the tab
  // closed before the queued database write ran, and the next boot reads both.
  const stored = preferences([entry('kick:id:1', 100), entry('kick:id:2', 100)]);
  const seed = {
    ...preferences([entry('kick:id:2', 500, { name: 'RenamedTwo' }), entry('kick:id:9', 500)]),
    librarySeedTotal: 3,
  };
  const merged = mergeHydratedLibrary(seed, stored);

  assert.deepEqual(merged.library.map((item) => item.key).sort(), ['kick:id:1', 'kick:id:2', 'kick:id:9']);
  assert.equal(merged.library.find((item) => item.key === 'kick:id:2').name, 'RenamedTwo', 'the newer entry wins');
  assert.equal(merged.library.find((item) => item.key === 'kick:id:1').lastSeen, 100, 'the database-only entry survives');
  assert.equal('librarySeedTotal' in merged, false, 'the seed marker never reaches the store');
});

test('with no database the seed is the store, and nothing throws', { tags: ['unit'] }, async () => {
  const { store, seed } = makeStore({ idb: null, seedLimit: 10 });
  assert.equal(store.provider(), 'localstorage');
  assert.equal(store.score(), PROVIDER_SCORES.localstorage);

  const value = preferences(libraryOf(40));
  const result = store.write(value);
  assert.equal(result.ok, true);
  assert.equal(result.truncated, 30);
  assert.equal(seed().library.length, 10, 'the seed stays bounded so it cannot fill the quota');
  assert.equal(await store.hydrate(), null);
  assert.equal(await store.putBlob('k', 'blob'), false);
  assert.equal(await store.getBlob('k'), null);
});

test('a database that refuses to open falls back rather than failing', { tags: ['unit'] }, async () => {
  // Private browsing and a blocked upgrade both land here.
  const { store, errors } = makeStore({ idb: fakeIndexedDB({ failOpen: true }) });
  store.write(preferences(libraryOf(5)));
  await store.flush();
  assert.equal(await store.hydrate(), null);
  assert.equal(store.provider(), 'localstorage');
  assert.deepEqual(errors, [], 'an unavailable database is not an error to report');
});

test('the full record goes to the database and comes back merged', { tags: ['unit'] }, async () => {
  const { store, idb, seed } = makeStore({ seedLimit: 10 });
  const value = preferences(libraryOf(300));
  store.write(value);
  await store.flush();

  assert.equal(store.provider(), 'indexeddb');
  assert.equal(store.score(), PROVIDER_SCORES.indexeddb);
  assert.equal(seed().library.length, 10, 'the synchronous half stays small');
  assert.equal(idb.__stores.get(LIBRARY_STORE).get('preferences').library.length, 300);

  const merged = await store.hydrate();
  assert.equal(merged.library.length, 300, 'boot gets the whole library back');
  // The stored record now also carries who wrote it and their sequence, which
  // is what lets a second tab tell a state it has seen from one it has not.
  // Asserted rather than stripped: the stamp is part of the record, and a
  // write that stopped carrying it would put the overwrite bug back.
  assert.deepEqual(merged, { ...value, commit: { writer: 'unknown', sequence: 1 } });
});

test('rapid writes coalesce instead of queueing one transaction each', { tags: ['unit'] }, async () => {
  const { store, idb } = makeStore({ seedLimit: 5 });
  // The library is rewritten on every emote observed in chat, so a busy channel
  // is hundreds of writes a minute against one record.
  for (let index = 0; index < 20; index += 1) store.write(preferences(libraryOf(index + 1)));
  await store.flush();
  assert.ok(idb.__counts.transactions <= 3,
    `coalesced to ${idb.__counts.transactions} transactions, not 20`);
  assert.equal(idb.__stores.get(LIBRARY_STORE).get('preferences').library.length, 20, 'the last write is the one stored');
});

test('blobs live in their own store, so a library read does not pull images', { tags: ['unit'] }, async () => {
  const { store, idb } = makeStore();
  assert.equal(await store.putBlob('kick:id:1', 'pretend-bytes'), true);
  assert.equal(await store.getBlob('kick:id:1'), 'pretend-bytes');
  assert.equal(await store.getBlob('missing'), null);
  assert.equal(await store.getBlob(''), null);
  assert.equal(idb.__stores.get(LIBRARY_STORE).size, 0, 'the library store is untouched by blob writes');
  assert.equal(idb.__stores.get(BLOB_STORE).size, 1);

  await store.clear();
  assert.equal(idb.__stores.get(BLOB_STORE).size, 0);
  assert.equal(idb.__stores.get(LIBRARY_STORE).size, 0);
});

test('a failing write is reported and does not wedge the queue', { tags: ['unit'] }, async () => {
  const { store, errors, seed } = makeStore({ idb: fakeIndexedDB({ failWrite: true }), seedLimit: 5 });
  store.write(preferences(libraryOf(50)));
  await store.flush();
  assert.equal(errors[0]?.[0], 'write');
  assert.match(errors[0][1], /Quota/);
  // The seed still took it, so nothing was actually lost.
  assert.equal(seed().library.length, 5);
  // And the store still accepts the next write rather than staying stuck.
  store.write(preferences(libraryOf(60)));
  await store.flush();
  assert.equal(errors.length, 2);
});

test('junk in either half is handled rather than propagated', { tags: ['unit'] }, () => {
  assert.deepEqual(planLibraryPersist(null).seed.library, []);
  assert.deepEqual(planLibraryPersist({ library: 'not-an-array' }).full.library, []);
  assert.deepEqual(mergeHydratedLibrary(null, null), {});
  assert.deepEqual(mergeHydratedLibrary({ library: [{ name: 'no key' }] }, { library: [] }).library, []);
  assert.equal(isSeedPartial(null), false);
  assert.equal(isSeedPartial({ library: [] }), false);
});

/**
 * Two tabs, one origin, one shared record.
 *
 * A store instance is a tab. They share the synchronous half the way two tabs
 * of the same site share `localStorage`, which is the whole reason the bug
 * exists: every commit rewrites the entire value, so a tab holding state from
 * before your last change writes that state back and your change is gone with
 * nothing to notice by.
 */
function makeSharedPair(overrides = {}) {
  let shared = overrides.initial ?? {};
  const errors = [];
  const open = (writer) => createLibraryStore({
    readFallback: () => shared,
    writeFallback: (seed) => { shared = seed; return true; },
    indexedDB: overrides.idb === undefined ? fakeIndexedDB() : overrides.idb,
    seedLimit: overrides.seedLimit ?? 50,
    onError: (stage, error) => errors.push([stage, error?.message]),
    writer,
  });
  return { open, errors, shared: () => shared };
}

test('a tab holding stale state is refused rather than allowed to erase a newer change', { tags: ['unit'] }, () => {
  const { open, shared } = makeSharedPair();
  const first = open('tab-a');
  const second = open('tab-b');

  // Both tabs read the same starting point, so both believe they are current.
  first.readSync();
  second.readSync();

  // Tab A saves. Tab B's held state now predates it and knows nothing of it.
  assert.equal(first.write(preferences(libraryOf(3))).foreign, false, 'the first write is uncontested');
  assert.equal(shared().library.length, 3);

  const refused = second.write(preferences(libraryOf(1)));
  assert.equal(refused.foreign, true, 'the stale write is reported as contested');
  assert.equal(refused.ok, false, 'and it does not land');
  assert.equal(shared().library.length, 3, 'tab A’s change is still there');
});

test('a tab that re-reads first is current again and its write lands', { tags: ['unit'] }, () => {
  // The reconcile path: read what the other tab wrote, apply your own change
  // on top, and commit that. This is the mechanism the picker uses after a
  // refused commit, checked here without a browser.
  const { open, shared } = makeSharedPair();
  const first = open('tab-a');
  const second = open('tab-b');
  first.readSync();
  second.readSync();

  first.write(preferences(libraryOf(3)));
  assert.equal(second.write(preferences(libraryOf(1))).foreign, true);

  second.readSync();
  const retried = second.write(preferences(libraryOf(7)));
  assert.equal(retried.foreign, false, 'after catching up the write is uncontested');
  assert.equal(retried.ok, true);
  assert.equal(shared().library.length, 7);
});

test('a tab writing repeatedly never contends with itself', { tags: ['unit'] }, () => {
  // The library is rewritten on every emote observed in chat, so a busy
  // channel is hundreds of writes a minute from one tab. None of them may be
  // reported as a conflict, or the reconcile path would run constantly.
  const { open } = makeSharedPair();
  const only = open('tab-a');
  only.readSync();
  for (let index = 1; index <= 25; index += 1) {
    assert.equal(only.write(preferences(libraryOf(index))).foreign, false, `write ${index} contended with itself`);
  }
});

test('upgrading from a build with no stamp protects both tabs from the first write onward', { tags: ['unit'] }, () => {
  // Whatever is in storage on upgrade carries no stamp, and an unstamped
  // record is indistinguishable from no record at all — so it cannot be
  // treated as contested, or every upgrading user's first save would be
  // refused. Protection begins where it can: boot reads, the first write
  // stamps, and from that moment a second tab holding the pre-stamp state is
  // caught. This asserts that boundary rather than pretending it is earlier.
  const { open, shared } = makeSharedPair({ initial: preferences(libraryOf(4)) });
  const first = open('tab-a');
  const second = open('tab-b');
  first.readSync();
  second.readSync();

  assert.equal(first.write(preferences(libraryOf(9))).foreign, false, 'the upgrade write is not refused');
  assert.equal(shared().library.length, 9);

  // Tab B still holds the unstamped state it read. From here it is caught.
  const refused = second.write(preferences(libraryOf(1)));
  assert.equal(refused.foreign, true, 'the pre-stamp tab is caught once a stamp exists');
  assert.equal(shared().library.length, 9, 'tab A’s change survives');
});

test('a closed tab leaves nothing that blocks the survivor', { tags: ['unit'] }, () => {
  // Tab closure is just a store that stops being written to. The survivor must
  // not be permanently contested by a stamp nobody will ever advance again.
  const { open, shared } = makeSharedPair();
  const closing = open('tab-a');
  const survivor = open('tab-b');
  closing.readSync();
  survivor.readSync();
  closing.write(preferences(libraryOf(5)));
  // Tab A is gone. Tab B catches up once and then owns the record.
  survivor.readSync();
  assert.equal(survivor.write(preferences(libraryOf(6))).foreign, false);
  assert.equal(survivor.write(preferences(libraryOf(8))).foreign, false, 'and stays uncontested afterwards');
  assert.equal(shared().library.length, 8);
});
