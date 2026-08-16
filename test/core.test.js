import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  isAdPreflightScript,
  SETTINGS_SCHEMA,
  approximateStorageBytes,
  describeStorageFailures,
  formatBytes,
  recordStorageResult,
  FILTER_MIN_SAMPLE,
  assessAdStack,
  assessApiDrift,
  chatBadgesToRender,
  countChangedStickers,
  describeStickerChange,
  preferredStickerAccess,
  recordStickerObservation,
  stickerChangedSinceCapture,
  multistreamLayoutLink,
  parseMultistreamLink,
  normalizeChannelPath,
  classifyRequest,
  describeInjection,
  detectContentLabels,
  filterDecision,
  isPlaybackUrl,
  neutralizePlaybackPayload,
  nextApplyDelay,
  normalizeStickerPreferences,
  platformStickerKey,
  mergePresence,
  presenceOffer,
  PRESENCE_TTL_MS,
  evictStickerLibrary,
  STICKER_LIBRARY_LIMIT,
  normalizeSettings,
  STICKER_PREFERENCES_SCHEMA,
  FAVORITES_PER_SCOPE_LIMIT,
  favoriteScope,
  favoritesForChannel,
  isStickerFavorite,
  toggleStickerFavorite,
  moveStickerFavorite,
  routeKind,
  sanitizeDiagnosticUrl,
  validateRemoteBlocklist,
  validateImportedSettings,
  TELEMETRY_HOSTS,
  TELEMETRY_NO_CANCEL_HOSTS,
  cancellableTelemetryHosts,
  STORAGE_STORES,
  buildSettingsExport,
  normalizeEmoteUsage,
  recordEmoteUse,
  USAGE_GLOBAL_LIMIT,
  normalizeBlocklistUrl,
  observationsFromChatEmotes,
  mergeMultistream,
  MULTISTREAM_MAX,
  normalizeShortcut,
  emoteTooltipText,
  insertionPlanFor,
  recordApplyCost,
  applyCostSummary,
  findKeywordSpans,
  findShortcutConflict,
  planStorageCommit,
  topmostOverlayLayer,
  OVERLAY_LAYERS,
  pluralForm,
  sanitizeErrorMessage,
  monetizationKind,
  rankEmoteUsage,
  recentEmoteUsage,
  visibleWindow,
  EMOTE_WINDOW_SIZE,
} from '../src/core.mjs';

const usageStore = (global = {}, channels = {}) => ({ global, channels });
const use = (name, count, lastAt) => ({ name, count, firstAt: 1, lastAt });

test('the recent shelf orders by when an emote was last sent, not how often', { tag: 'unit' }, () => {
  const counts = usageStore({
    a: use('Alpha', 100, 1_000),
    b: use('Beta', 2, 9_000),
    c: use('Gamma', 50, 5_000),
  });

  assert.deepEqual(recentEmoteUsage(counts).map((entry) => entry.name), ['Beta', 'Gamma', 'Alpha']);
  // The frequency shelf is the other answer, and must stay the other answer:
  // the two sections exist precisely because they disagree.
  assert.deepEqual(rankEmoteUsage(counts).map((entry) => entry.name), ['Alpha', 'Gamma', 'Beta']);
});

test('the recent shelf prefers this channel record and falls back to the rollup', { tag: 'unit' }, () => {
  const counts = usageStore(
    { a: use('Alpha', 10, 9_000), b: use('Beta', 10, 8_000) },
    { xqc: { a: use('Alpha', 1, 1_000) } },
  );
  // Sent here long ago, sent elsewhere recently: in this chat, Beta is newer.
  assert.deepEqual(recentEmoteUsage(counts, { channel: 'xqc' }).map((entry) => entry.name), ['Beta', 'Alpha']);
  // An emote never sent here keeps its rollup timestamp rather than vanishing.
  assert.deepEqual(recentEmoteUsage(counts, { channel: 'nobody' }).map((entry) => entry.name), ['Alpha', 'Beta']);
});

test('an entry with no timestamp never reaches a list ordered by timestamp', { tag: 'unit' }, () => {
  // What an imported file that predates the field looks like.
  const counts = usageStore({ a: use('Alpha', 5, 0), b: use('Beta', 1, 3_000) });
  assert.deepEqual(recentEmoteUsage(counts).map((entry) => entry.name), ['Beta']);
  assert.deepEqual(recentEmoteUsage(usageStore()), []);
  assert.deepEqual(recentEmoteUsage(null), []);
  assert.deepEqual(recentEmoteUsage(counts, { limit: 0 }), []);
});

test('ties in the recent shelf resolve the same way every render', { tag: 'unit' }, () => {
  const counts = usageStore({
    b: use('Beta', 1, 5_000),
    a: use('Alpha', 1, 5_000),
    c: use('Gamma', 9, 5_000),
  });
  // Same instant: heavier use first, then a stable id order — never insertion
  // order, or the shelf would reshuffle itself between identical renders.
  assert.deepEqual(recentEmoteUsage(counts).map((entry) => entry.id), ['c', 'a', 'b']);
  assert.deepEqual(recentEmoteUsage(counts).map((entry) => entry.id), recentEmoteUsage(counts).map((entry) => entry.id));
});

test('a list shorter than the window is rendered whole, with no spacers', { tag: 'unit' }, () => {
  const entries = Array.from({ length: 12 }, (_v, index) => index);
  const slice = visibleWindow(entries, 0, 240);
  assert.deepEqual(slice, { start: 0, end: 12, items: entries, before: 0, after: 0 });
  assert.equal(slice.items, entries, 'no copy is made when the whole list fits');
});

test('a library at the cap renders one window and accounts for the rest', { tag: 'unit' }, () => {
  const entries = Array.from({ length: 2400 }, (_v, index) => index);

  const top = visibleWindow(entries, 0);
  assert.equal(top.items.length, EMOTE_WINDOW_SIZE);
  assert.equal(top.start, 0, 'at the top the window does not run off the front');
  assert.equal(top.before, 0);
  assert.equal(top.after, 2400 - EMOTE_WINDOW_SIZE);

  // Scrolled into the middle: the window leads the anchor so scrolling back a
  // row does not immediately fall out of it.
  const middle = visibleWindow(entries, 1200);
  assert.equal(middle.start, 1200 - EMOTE_WINDOW_SIZE / 4);
  assert.equal(middle.items.length, EMOTE_WINDOW_SIZE);
  assert.equal(middle.before + middle.items.length + middle.after, entries.length,
    'every entry is either rendered or accounted for by a spacer');
  assert.deepEqual(middle.items[0], middle.start);

  // At the very bottom the window stops at the end rather than past it.
  const bottom = visibleWindow(entries, 2399);
  assert.equal(bottom.end, 2400);
  assert.equal(bottom.start, 2400 - EMOTE_WINDOW_SIZE);
  assert.equal(bottom.after, 0);
});

test('a nonsense anchor or size cannot produce a window outside the list', { tag: 'unit' }, () => {
  const entries = Array.from({ length: 500 }, (_v, index) => index);
  for (const anchor of [-100, Number.NaN, Number.POSITIVE_INFINITY, 10_000, undefined]) {
    const slice = visibleWindow(entries, anchor);
    assert.ok(slice.start >= 0 && slice.end <= entries.length, `anchor ${String(anchor)} stays in range`);
    assert.equal(slice.before + slice.items.length + slice.after, entries.length);
  }
  for (const size of [0, -5, Number.NaN, undefined]) {
    const slice = visibleWindow(entries, 0, size);
    assert.ok(slice.items.length > 0 && slice.items.length <= entries.length, `size ${String(size)} yields a real window`);
  }
  assert.deepEqual(visibleWindow(null, 0), { start: 0, end: 0, items: [], before: 0, after: 0 });
});

test('sanitizeErrorMessage strips query strings and long tokens for the local error log', { tag: 'unit' }, () => {
  assert.equal(sanitizeErrorMessage('Failed at https://kick.com/api/v1/log?token=abc123'), 'Failed at https://kick.com/api/v1/log');
  assert.equal(sanitizeErrorMessage('id abcdefghijklmnopqrstuvwxyz0123456789ABCD done'), 'id … done');
  assert.equal(sanitizeErrorMessage(new Error('boom').message), 'boom');
  assert.equal(sanitizeErrorMessage(null), '');
  assert.ok(sanitizeErrorMessage('x'.repeat(500)).length <= 300);
});

test('pluralForm follows CLDR locale rules, including the es/pt "many" category English lacks', { tag: 'unit' }, () => {
  assert.equal(pluralForm(1, { one: 'emote', other: 'emotes' }, 'en'), 'emote');
  assert.equal(pluralForm(3, { one: 'emote', other: 'emotes' }, 'en'), 'emotes');
  assert.equal(new Intl.PluralRules('en').select(1000000), 'other'); // English never "many"

  for (const locale of ['es', 'pt']) {
    const rules = new Intl.PluralRules(locale);
    const manyCount = [1000000, 2000000, 1000000000].find((n) => rules.select(n) === 'many');
    assert.ok(manyCount, `${locale} should expose a "many" category a hand n===1 rule misses`);
    assert.equal(pluralForm(manyCount, { one: 'x', many: 'muchos', other: 'otros' }, locale), 'muchos');
  }
  // A missing category form falls back to `other`; a bad locale does too.
  assert.equal(pluralForm(5, { one: 'a', other: 'b' }, 'es'), 'b');
  assert.equal(pluralForm(1, { other: 'b' }, 'en'), 'b');
});

test('normalizeShortcut canonicalizes case and spacing, rejecting empty and overlong', { tag: 'unit' }, () => {
  assert.equal(normalizeShortcut('ctrl + k', 'X'), 'Ctrl+K');
  assert.equal(normalizeShortcut('  shift+ALT+p ', 'X'), 'Shift+Alt+P');
  assert.equal(normalizeShortcut('f', 'X'), 'F');
  assert.equal(normalizeShortcut('', 'FB'), 'FB');
  assert.equal(normalizeShortcut(123, 'FB'), 'FB');
  assert.equal(normalizeShortcut('a'.repeat(40), 'FB'), 'FB');
});

test('shortcut reassignment rejects a value already bound to another action (README claim)', { tag: 'unit' }, () => {
  const shortcuts = { focus: 'F', chat: 'C', settings: 'Alt+K' };
  assert.equal(findShortcutConflict(shortcuts, 'chat', 'F'), 'focus');
  assert.equal(findShortcutConflict(shortcuts, 'chat', 'f'), 'focus'); // case-insensitive
  assert.equal(findShortcutConflict(shortcuts, 'focus', 'F'), ''); // reassigning to own value is fine
  assert.equal(findShortcutConflict(shortcuts, 'chat', 'Z'), ''); // a free key conflicts with nothing
  assert.equal(findShortcutConflict(null, 'chat', 'F'), '');
});

test('a roll-call collects open tabs, expires stale answers, and offers only what fits', { tag: 'unit' }, () => {
  const now = 1_000_000;
  const fresh = now - 1000;
  const stale = now - PRESENCE_TTL_MS - 1;

  assert.deepEqual(mergePresence([
    { slug: 'xqc', ts: fresh },
    { slug: 'adin_ross', ts: fresh },
  ], now), ['adin_ross', 'xqc']);

  // A tab that closed, crashed, or slept stops appearing on its own — there is
  // no goodbye message to miss.
  assert.deepEqual(mergePresence([{ slug: 'gone', ts: stale }], now), []);

  // The same channel in two tabs counts once, keeping the fresher timestamp.
  assert.deepEqual(mergePresence([{ slug: 'xqc', ts: stale }, { slug: 'xqc', ts: fresh }], now), ['xqc']);

  // Answers arrive over a channel any script on the origin can post to, so a
  // slug is validated exactly as the grid validates it.
  assert.deepEqual(mergePresence([
    { slug: '../evil', ts: fresh },
    { slug: '<script>', ts: fresh },
    { slug: 'a'.repeat(80), ts: fresh },
    { slug: '', ts: fresh },
    { slug: 'ok', ts: 'soon' },
    { slug: 'ok2', ts: now + PRESENCE_TTL_MS * 2 }, // a clock far in the future
    'not-an-object',
    null,
  ], now), []);
  assert.deepEqual(mergePresence(null, now), []);

  // The offer excludes what the grid already holds, case-insensitively.
  assert.deepEqual(presenceOffer(['xqc', 'adin_ross', 'trainwreck'], ['XQC']), ['adin_ross', 'trainwreck']);
  // And never offers more than the remaining room.
  assert.deepEqual(presenceOffer(['a', 'b', 'c'], ['x', 'y'], 4), ['a', 'b']);
  assert.deepEqual(presenceOffer(['a'], ['x'], 1), []);
  assert.deepEqual(presenceOffer(null, null), []);
});

test('emote keys carry a platform prefix, and every store migrates together losslessly', { tag: 'unit' }, () => {
  assert.equal(platformStickerKey('id:37226'), 'kick:id:37226');
  assert.equal(platformStickerKey('name:kekw|src:https://files.kick.com/emotes/1/fullsize'),
    'kick:name:kekw|src:https://files.kick.com/emotes/1/fullsize');
  // Idempotent, so a half-migrated store heals instead of splitting in two.
  assert.equal(platformStickerKey('kick:id:37226'), 'kick:id:37226');
  assert.equal(platformStickerKey(platformStickerKey('id:1')), 'kick:id:1');
  // An emote *named* like a platform is untouched, because a raw key always
  // begins id: or name:.
  assert.equal(platformStickerKey('twitch:id:9'), 'twitch:id:9');
  assert.equal(platformStickerKey(''), '');
  assert.equal(platformStickerKey(null), '');

  // The migration: a schema-7 store where all four key spaces must move as one,
  // or a favorite silently stops matching its library entry.
  const legacy = {
    schema: 7,
    library: [
      { key: 'id:1', id: '1', name: 'One', src: 'https://files.kick.com/emotes/1/fullsize', access: 'available' },
      { key: 'id:2', id: '2', name: 'Two', src: 'https://files.kick.com/emotes/2/fullsize', access: 'observed' },
    ],
    favorites: [{ key: 'id:1', channel: '', order: 0 }],
    hidden: ['id:3'],
    groups: [{ id: 'grp', name: 'Group' }],
    assignments: [{ key: 'id:2', groupId: 'grp' }],
  };
  const migrated = normalizeStickerPreferences(legacy);
  assert.equal(migrated.schema, 8);
  assert.deepEqual(migrated.library.map((entry) => entry.key), ['kick:id:1', 'kick:id:2']);
  assert.deepEqual(migrated.favorites.map((entry) => entry.key), ['kick:id:1']);
  assert.deepEqual(migrated.hidden, ['kick:id:3']);
  assert.deepEqual(migrated.assignments, [{ key: 'kick:id:2', groupId: 'grp' }]);
  // Nothing was dropped, and the favorite still resolves against the library.
  assert.equal(migrated.library.length, legacy.library.length);
  assert.ok(migrated.library.some((entry) => entry.key === migrated.favorites[0].key),
    'the migrated favorite must still match a migrated library entry');

  // Re-normalising migrated data changes nothing.
  assert.deepEqual(normalizeStickerPreferences(migrated), migrated);

  // The longest legitimate key survives: it is built and capped at 320 before
  // the prefix, so the key-length ceiling has to allow for the prefix too.
  const longest = `name:${'x'.repeat(40)}|src:https://files.kick.com/emotes/${'9'.repeat(240)}/fullsize`.slice(0, 320);
  assert.equal(longest.length, 320);
  const long = normalizeStickerPreferences({ schema: 7, hidden: [longest] });
  assert.deepEqual(long.hidden, [`kick:${longest}`], 'a 320-character key must not be dropped by the migration');
});

test('keyword spans are case-insensitive, sorted, merged, and capped', { tag: 'unit' }, () => {
  assert.deepEqual(findKeywordSpans('Free GIVEAWAY tonight, giveaway!', ['giveaway']), [
    { start: 5, end: 13 }, { start: 23, end: 31 },
  ]);
  // Two keywords that overlap become one span, never nested highlights.
  assert.deepEqual(findKeywordSpans('big raid incoming', ['big raid', 'raid']), [{ start: 0, end: 8 }]);
  // Touching spans merge too.
  assert.deepEqual(findKeywordSpans('abcd', ['ab', 'cd']), [{ start: 0, end: 4 }]);
  // Sorted by position regardless of keyword order.
  assert.deepEqual(findKeywordSpans('x drop y raid', ['raid', 'drop']), [{ start: 2, end: 6 }, { start: 9, end: 13 }]);
  // The cap bounds a chat that has scrolled for hours.
  assert.equal(findKeywordSpans('a '.repeat(50), ['a'], 7).length, 7);
  // Nothing to find, or nothing to look for, is an empty list — not a throw.
  assert.deepEqual(findKeywordSpans('', ['a']), []);
  assert.deepEqual(findKeywordSpans('hello', []), []);
  assert.deepEqual(findKeywordSpans('hello', ['', '  ', null]), []);
  assert.deepEqual(findKeywordSpans(null, ['a']), []);
  assert.deepEqual(findKeywordSpans('hello', 'not-a-list'), []);
});

test('apply-cycle cost accumulates as plain numbers with a sliding recent average', { tag: 'unit' }, () => {
  let stats = recordApplyCost({}, 12);
  stats = recordApplyCost(stats, 4);
  stats = recordApplyCost(stats, 30);
  assert.equal(stats.count, 3);
  assert.equal(stats.last, 30);
  assert.equal(stats.max, 30);
  assert.equal(stats.total, 46);
  assert.deepEqual(stats.recent, [12, 4, 30]);
  assert.equal(applyCostSummary(stats), '3 runs · last 30 ms · recent avg 15 ms · max 30 ms');

  // A slow first paint must not dominate forever: the recent window slides.
  for (let i = 0; i < 25; i += 1) stats = recordApplyCost(stats, 2);
  assert.equal(stats.recent.length, 20);
  assert.match(applyCostSummary(stats), /recent avg 2 ms · max 30 ms/);

  // Garbage in leaves the record untouched rather than poisoning the average.
  assert.deepEqual(recordApplyCost(stats, NaN), stats);
  assert.deepEqual(recordApplyCost(stats, -1), stats);
  assert.equal(recordApplyCost(null, 5).count, 1);
  assert.equal(applyCostSummary({}), 'No apply cycle has run yet.');
  assert.equal(applyCostSummary(null), 'No apply cycle has run yet.');
  // Sub-10ms values keep one decimal, so a fast cycle is not rounded to 0.
  assert.match(applyCostSummary(recordApplyCost({}, 0.44)), /last 0\.4 ms/);
});

test('an emote insertion plan carries the plain name and never the wire token', { tag: 'unit' }, () => {
  const collisions = [{ name: 'PogChamp', winner: { setName: 'bigchannel' }, shadowed: [], sets: ['a', 'b'] }];

  const plain = insertionPlanFor({ name: 'KEKW', id: 4821 }, [], 'observed');
  assert.equal(plain.ok, true);
  assert.equal(plain.text, 'KEKW');
  assert.equal(plain.sendable, true);
  assert.equal(plain.warning, '');
  // The id must not appear anywhere in the plan — emitting `[emote:4821:KEKW]`
  // is exactly the entitlement bypass this boundary exists to prevent.
  assert.equal(JSON.stringify(plan_has_no_id(plain)), 'true');

  // A descriptor that already holds a wire token is refused, not repaired into
  // something that looks close enough.
  for (const name of ['[emote:1:KEKW]', 'two words', 'colon:name', 'bad[bracket', '', '   ']) {
    const refused = insertionPlanFor({ name }, [], 'observed');
    assert.equal(refused.ok, false, `${JSON.stringify(name)} must be refused`);
    assert.equal(refused.text, '');
  }
  assert.equal(insertionPlanFor(null, [], 'observed').ok, false);
  assert.equal(insertionPlanFor({ name: 'a'.repeat(65) }, [], 'observed').ok, false);

  // Subscriber-only: the public name still copies, but the plan says plainly
  // that typing it will not produce the emote.
  const locked = insertionPlanFor({ name: 'SubOnly' }, [], 'locked');
  assert.equal(locked.ok, true);
  assert.equal(locked.text, 'SubOnly');
  assert.equal(locked.sendable, false);
  assert.match(locked.warning, /subscriber-only/);

  // Shadowed: name which emote a typed name actually sends.
  const shadowed = insertionPlanFor({ name: 'PogChamp' }, collisions, 'channel');
  assert.equal(shadowed.text, 'PogChamp');
  assert.match(shadowed.warning, /shadows PogChamp — typing it sends bigchannel/);
  // A collision with no recorded winner still warns without inventing one.
  assert.match(insertionPlanFor({ name: 'PogChamp' }, [{ name: 'PogChamp' }], 'channel').warning, /may send a different emote/);
  // Locked outranks shadowed: "you cannot send this" is the more useful fact.
  assert.match(insertionPlanFor({ name: 'PogChamp' }, collisions, 'locked').warning, /subscriber-only/);
});

/** No field of a plan may carry the emote id, in any form. */
function plan_has_no_id(plan) {
  return !JSON.stringify(plan).includes('4821');
}

test('the chat emote hover card names the set, access, capture and shadowing winner', { tag: 'unit' }, () => {
  const collisions = [{ name: 'PogChamp', winner: { setName: 'bigchannel' }, shadowed: [], sets: ['a', 'b'] }];
  const entry = {
    name: 'PogChamp', nativeGroups: ['Seen in chat'], access: 'observed', firstSeen: Date.UTC(2026, 0, 15),
  };
  assert.deepEqual(emoteTooltipText(entry, collisions, false), [
    'PogChamp',
    // Not "Seen in chat · Seen in chat": a chat-discovered emote's only set name
    // is its access label, and printing both stutters.
    'Seen in chat',
    'First seen 2026-01-15',
    // Naming the winner is the point: "shadowed" alone does not say which
    // emote a typed name actually sends.
    'Name shadowed — typing it sends bigchannel',
    'Click to save',
  ]);

  // Already saved: the last line changes, so the card reports state rather than
  // offering an action that has already happened.
  assert.equal(emoteTooltipText(entry, collisions, true).at(-1), 'Saved — click to open in the library');

  // A real Kick set name is kept alongside the access level.
  assert.equal(
    emoteTooltipText({ name: 'x', nativeGroups: ['Global'], access: 'available' }, [], false)[1],
    'Global · Seen available',
  );

  // No collision for this name: name, access, first-seen, action — no warning.
  assert.deepEqual(emoteTooltipText({ ...entry, name: 'Clean' }, collisions, false), [
    'Clean', 'Seen in chat', 'First seen 2026-01-15', 'Click to save',
  ]);

  // Entries recorded before first-seen provenance existed simply omit the line.
  assert.deepEqual(emoteTooltipText({ name: 'Old', nativeGroups: [], access: 'locked' }, [], false), [
    'Old', 'Subscriber-only', 'Click to save',
  ]);

  // Nothing nameable, nothing shown — this is what keeps an unrelated injected
  // image from getting a card.
  assert.deepEqual(emoteTooltipText(null, collisions, false), []);
  assert.deepEqual(emoteTooltipText({ name: '' }, collisions, false), []);
  assert.deepEqual(emoteTooltipText({ nativeGroups: ['x'] }, collisions, false), []);
  // A malformed collision entry must not throw or match.
  assert.equal(emoteTooltipText(entry, [null, 'nope'], false).length, 4);
  // A collision with no recorded winner still warns, without naming one.
  assert.equal(
    emoteTooltipText(entry, [{ name: 'PogChamp' }], false).at(-2),
    'Name shadowed by another set',
  );
});

test('a multi-store write is sized and serialized before any of it is committed', { tag: 'unit' }, () => {
  const plan = planStorageCommit([['a', { x: 1 }], ['b', [1, 2, 3]]]);
  assert.equal(plan.ok, true);
  assert.equal(plan.staged.length, 2);
  assert.equal(plan.bytes, 'a'.length + JSON.stringify({ x: 1 }).length + 'b'.length + JSON.stringify([1, 2, 3]).length);

  // Over budget: nothing is staged, so there is no partial plan to commit.
  const tooBig = planStorageCommit([['a', 'x'.repeat(100)]], 10);
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.reason, 'over-budget');
  assert.deepEqual(tooBig.staged, []);

  // A value that cannot serialize is caught here rather than at write time,
  // where earlier stores would already be committed.
  const cyclic = { name: 'loop' };
  cyclic.self = cyclic;
  const bad = planStorageCommit([['ok', 1], ['bad', cyclic]]);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'unserializable');
  assert.equal(bad.key, 'bad');
  assert.deepEqual(bad.staged, []);

  // undefined does not serialize, and must not be mistaken for an empty write.
  assert.equal(planStorageCommit([['k', undefined]]).ok, false);
  assert.equal(planStorageCommit('not an array').ok, false);
  assert.equal(planStorageCommit([['', 1]]).ok, false);
  assert.equal(planStorageCommit([]).ok, true);
});

test('a quota failure part-way through an import leaves the prior state intact', { tag: 'unit' }, () => {
  // The store the runtime writes into, plus a backend that starts failing after
  // the second key — the shape of a quota ceiling reached mid-import.
  const store = new Map([['settings', 'old-settings'], ['library', 'old-library']]);
  let writes = 0;
  const write = (key, value) => {
    writes += 1;
    if (writes > 2) return false;
    store.set(key, value);
    return true;
  };

  const commit = (entries) => {
    const plan = planStorageCommit(entries);
    if (!plan.ok) return plan;
    const previous = plan.staged.map(([key]) => [key, store.has(key) ? store.get(key) : undefined]);
    const written = [];
    for (const [key, value] of plan.staged) {
      if (write(key, value)) { written.push(key); continue; }
      for (const [prevKey, prevValue] of previous) {
        if (!written.includes(prevKey)) continue;
        if (prevValue === undefined) store.delete(prevKey);
        else store.set(prevKey, prevValue);
      }
      return { ok: false, reason: 'write-failed', key };
    }
    return { ok: true };
  };

  const result = commit([['settings', 'new-settings'], ['library', 'new-library'], ['notes', 'new-notes']]);
  assert.equal(result.ok, false);
  assert.equal(result.key, 'notes');
  // Not half-applied: both stores that did get written are back to their old
  // values, and the key that never existed was not created.
  assert.equal(store.get('settings'), 'old-settings');
  assert.equal(store.get('library'), 'old-library');
  assert.equal(store.has('notes'), false);
});

test('the reset alertdialog owns focus and Escape while it is open, not the settings shell', { tag: 'unit' }, () => {
  // The defect: the prompt is nested inside the settings shell, so the trap
  // scoped to settings and Tab walked the obscured page behind the dialog,
  // while Escape closed all of Settings instead of only the prompt.
  const withPrompt = topmostOverlayLayer({ settings: true, resetConfirm: true });
  assert.equal(withPrompt.layer, 'resetConfirm');
  assert.equal(withPrompt.selector, '.kf-confirm-card');

  // Cancelling the prompt hands both back to the settings shell, not to nothing.
  const afterCancel = topmostOverlayLayer({ settings: true, resetConfirm: false });
  assert.equal(afterCancel.layer, 'settings');
  assert.equal(afterCancel.selector, '[data-kf-settings-shell]');
});

test('every overlay ranks the same way for Tab and for Escape', { tag: 'unit' }, () => {
  // These two ladders were written separately and disagreed: the trap ranked the
  // command menu above settings, Escape ranked settings above the command menu.
  assert.equal(topmostOverlayLayer({ command: true, settings: true }).layer, 'command');
  assert.equal(topmostOverlayLayer({ multistream: true, command: true, settings: true }).layer, 'multistream');
  // Multi-stream outranks even the prompt: its cross-origin player frames cannot
  // be focus-managed at all, so containment at the host is the only control.
  assert.equal(topmostOverlayLayer({ multistream: true, resetConfirm: true, settings: true }).layer, 'multistream');
  assert.equal(topmostOverlayLayer({}), null);
  assert.equal(topmostOverlayLayer({ settings: false }), null);
  assert.equal(topmostOverlayLayer(null), null);
  // Only an explicit `true` opens a layer, so a stray truthy element reference
  // cannot promote a hidden overlay to the top of the ladder.
  assert.equal(topmostOverlayLayer({ settings: 'yes' }), null);
  // Every layer names a selector the interface actually mounts.
  assert.equal(OVERLAY_LAYERS.length, 4);
  for (const [layer, selector] of OVERLAY_LAYERS) {
    assert.ok(layer && typeof selector === 'string' && selector.length > 1, `${layer} needs a selector`);
  }
});

test('multi-stream merge survives two tabs adding different channels', { tag: 'unit' }, () => {
  // Tab A boots with [x], adds a. Tab B boots with [x] (stale), adds b after A wrote.
  const afterA = mergeMultistream({ streams: ['x'] }, { streams: ['x', 'a'] }, ['a'], []);
  assert.deepEqual(afterA.streams, ['x', 'a']);
  const afterB = mergeMultistream(afterA, { streams: ['x', 'b'] }, ['b'], []);
  assert.deepEqual([...afterB.streams].sort(), ['a', 'b', 'x']); // A's add survived B's write
});

test('multi-stream merge applies this tab removal without dropping another tab add', { tag: 'unit' }, () => {
  const merged = mergeMultistream({ streams: ['x', 'a'] }, { streams: ['x'] }, [], ['x']);
  assert.deepEqual(merged.streams, ['a']);
});

test('multi-stream merge preserves this tab order and caps at the max', { tag: 'unit' }, () => {
  const reordered = mergeMultistream({ streams: ['a', 'b'] }, { streams: ['b', 'a'] }, [], []);
  assert.deepEqual(reordered.streams, ['b', 'a']);
  const many = Array.from({ length: MULTISTREAM_MAX + 3 }, (_, index) => `c${index}`);
  assert.equal(mergeMultistream({ streams: [] }, { streams: [] }, many, []).streams.length, MULTISTREAM_MAX);
});

test('chat-frame emotes become CDN-scoped observations, deduped by id', { tag: 'unit' }, () => {
  const url = (id) => `https://files.kick.com/emotes/${id}/fullsize`;
  const observations = observationsFromChatEmotes([
    { type: 'emote', id: '37226', name: 'PogChamp' },
    { type: 'emote', id: '37226', name: 'PogChamp' }, // duplicate id -> collapses
    { type: 'emote', id: '', name: 'NoId' },          // no id -> dropped
    { type: 'emote', id: '999', name: '' },           // no name -> dropped
    { type: 'text', value: 'hello' },                 // not an emote -> ignored
  ], url);
  assert.equal(observations.length, 1);
  assert.deepEqual(observations[0], {
    key: 'id:37226', id: '37226', name: 'PogChamp',
    src: 'https://files.kick.com/emotes/37226/fullsize',
    nativeGroups: ['Seen in chat'], access: 'observed',
  });
  // BTTV #5925: an emote whose src is not on Kick's CDN is refused, so another
  // extension's injected images can never be ingested.
  assert.equal(observationsFromChatEmotes([{ id: '1', name: 'X' }], () => 'https://evil.example/emotes/1.png').length, 0);
  assert.equal(observationsFromChatEmotes('nope', url).length, 0);
});

test('a blocklist URL is accepted only when it is a well-formed https URL', { tag: 'unit' }, () => {
  assert.equal(normalizeBlocklistUrl('https://example.com/list.json'), 'https://example.com/list.json');
  assert.equal(normalizeBlocklistUrl('  https://example.com/list.json  '), 'https://example.com/list.json');
  assert.equal(normalizeBlocklistUrl('http://example.com/list.json'), ''); // not https
  assert.equal(normalizeBlocklistUrl('javascript:alert(1)'), '');
  assert.equal(normalizeBlocklistUrl('data:text/plain,hi'), '');
  assert.equal(normalizeBlocklistUrl('not a url'), '');
  assert.equal(normalizeBlocklistUrl(''), '');
  assert.equal(normalizeBlocklistUrl(`https://example.com/${'x'.repeat(3000)}`), ''); // too long
  // It survives the full settings normalizer round-trip.
  assert.equal(normalizeSettings({ content: { blocklistUrl: 'http://evil/list' } }).content.blocklistUrl, '');
  assert.equal(normalizeSettings({ content: { blocklistUrl: 'https://ok/list' } }).content.blocklistUrl, 'https://ok/list');
});

test('the store registry keeps the library on reset but marks every private store for clearing', { tag: 'unit' }, () => {
  const byKey = Object.fromEntries(STORAGE_STORES.map((store) => [store.key, store]));
  // The library is the one irreplaceable store: backed up, but never reset.
  assert.equal(byKey['kick-focus:sticker-preferences'].backup, true);
  assert.equal(byKey['kick-focus:sticker-preferences'].reset, false);
  for (const key of [
    'kick-focus:emote-usage', 'kick-focus:multistream', 'kick-focus:channel-layouts',
    'kick-focus:favorite-channels', 'kick-focus:not-interested-channels',
    'kick-focus:chat-keywords', 'kick-focus:channel-notes', 'kick-focus:media-preferences',
  ]) {
    assert.equal(byKey[key].reset, true, `${key} must be cleared on reset`);
    assert.equal(byKey[key].backup, true, `${key} must be in the backup`);
  }
});

test('the export payload carries every store the registry marks for backup', { tag: 'unit' }, () => {
  const probe = buildSettingsExport({
    settings: { schema: 1, layout: { density: 'compact' } },
    stickers: { schema: 5 }, usage: { global: {}, channels: {} }, multistream: { streams: [] },
    channelLayouts: { '/xqc': { focus: true } }, favoriteChannels: ['/xqc'],
    dismissedChannels: ['/foo'], chatKeywords: { '/xqc': ['spam'] },
    channelNotes: { '/xqc': 'note' }, mediaPreferences: { 'volume:/xqc': 0.5 },
  });
  for (const store of STORAGE_STORES.filter((entry) => entry.backup)) {
    if (store.field === 'settings') assert.ok('layout' in probe, 'settings are spread at the root');
    else assert.ok(store.field in probe, `${store.field} present in export`);
  }
});

test('import drops prototype-pollution keys in every store and never touches Object.prototype', { tag: 'unit' }, () => {
  // Raw JSON (not an object literal, which would set the prototype instead of an
  // own key) so the pollution keys actually travel through JSON.parse as data.
  const malicious = '{"layout":{"density":"compact"},"channelNotes":{"__proto__":{"polluted":"yes"},"/xqc":"ok"},"mediaPreferences":{"constructor":1,"volume:/xqc":0.5}}';
  const result = validateImportedSettings(malicious);
  assert.ok(result.ok);
  assert.equal({}.polluted, undefined);
  assert.ok(!Object.hasOwn(result.channelNotes, '__proto__'));
  assert.equal(result.channelNotes['/xqc'], 'ok');
  assert.ok(!Object.hasOwn(result.mediaPreferences, 'constructor'));
  assert.equal(result.mediaPreferences['volume:/xqc'], 0.5);
});

test('import round-trips the previously omitted stores with their bounds enforced', { tag: 'unit' }, () => {
  const payload = buildSettingsExport({
    settings: { schema: 1 },
    favoriteChannels: ['/xqc', 'https://evil.com/haxor', '/xqc'],
    dismissedChannels: ['/foo'],
    chatKeywords: { '/xqc': ['SPAM', 'spam', '  '] },
    channelNotes: { '/xqc': 'x'.repeat(2000) },
    channelLayouts: { '/xqc': { focus: true, bogus: 1 } },
    mediaPreferences: { 'volume:/xqc': 0.5, 'bad key': 1 },
  });
  const result = validateImportedSettings(JSON.stringify(payload));
  assert.ok(result.ok);
  assert.deepEqual(result.favoriteChannels, ['/xqc']); // off-site URL dropped, duplicate deduped
  assert.deepEqual(result.chatKeywords['/xqc'], ['spam']); // lowercased, deduped, blanks gone
  assert.equal(result.channelNotes['/xqc'].length, 1000); // capped
  assert.deepEqual(result.channelLayouts['/xqc'], { focus: true, theater: false, chatHidden: false, sidebarHidden: false });
  assert.ok(!('bad key' in result.mediaPreferences)); // malformed key rejected
});

test('emote usage global rollup is capped on both read and write', { tag: 'unit' }, () => {
  const oversized = { global: {}, channels: {} };
  for (let i = 0; i < USAGE_GLOBAL_LIMIT + 500; i += 1) {
    oversized.global[`e${i}`] = { name: `E${i}`, count: (i % 50) + 1, firstAt: 1, lastAt: i + 1 };
  }
  assert.ok(Object.keys(normalizeEmoteUsage(oversized).global).length <= USAGE_GLOBAL_LIMIT);
  let counts = { global: {}, channels: {} };
  for (let i = 0; i < USAGE_GLOBAL_LIMIT + 100; i += 1) {
    counts = recordEmoteUse(counts, { channel: '', id: `id${i}`, name: `N${i}`, at: i + 1 });
  }
  assert.ok(Object.keys(counts.global).length <= USAGE_GLOBAL_LIMIT);
});

test('litix.io stays in the telemetry set but out of the network-layer cancel list', { tag: 'unit' }, () => {
  // Blocking litix.io hard triggers a retry storm; the page realm answers it
  // empty-200 instead, so it must never reach the DNR/webRequest cancel set.
  assert.ok(TELEMETRY_HOSTS.includes('litix.io'));
  assert.ok(TELEMETRY_NO_CANCEL_HOSTS.includes('litix.io'));
  assert.ok(!cancellableTelemetryHosts().includes('litix.io'));
  for (const host of TELEMETRY_HOSTS) {
    if (!TELEMETRY_NO_CANCEL_HOSTS.includes(host)) assert.ok(cancellableTelemetryHosts().includes(host));
  }
});

test('normalization clamps values and keeps core ad defense enabled', { tag: 'unit' }, () => {
  const value = normalizeSettings({
    layout: { chatWidth: 900, sidebar: 'wild' },
    content: { blockAds: false },
    accessibility: { captionOpacity: -5 },
  });
  assert.equal(value.layout.chatWidth, 520);
  assert.equal(value.layout.sidebar, DEFAULT_SETTINGS.layout.sidebar);
  assert.equal(value.content.blockAds, true);
  assert.equal(value.content.rememberVolume, true);
  assert.equal(value.content.rememberVodPosition, true);
  assert.equal(value.content.organizeChatStickers, true);
  assert.equal(value.layout.playerContainVideo, true);
  assert.equal(value.appearance.language, 'auto');
  assert.equal(normalizeSettings({ appearance: { language: 'xx' } }).appearance.language, 'auto');
  assert.equal(value.accessibility.captionOpacity, 0);
});

test('v2 migrates the former desktop defaults without overwriting custom layout choices', { tag: 'unit' }, () => {
  const migrated = normalizeSettings({ schema: 1, layout: { sidebar: 'compact', chatWidth: 380 } });
  // Track the constant, not a literal: this assertion is about the migration,
  // and pinning the number makes every later schema bump look like a failure.
  assert.equal(migrated.schema, SETTINGS_SCHEMA);
  assert.equal(migrated.layout.sidebar, 'auto');
  assert.equal(migrated.layout.chatWidth, 410);

  const custom = normalizeSettings({ schema: 1, layout: { sidebar: 'hidden', chatWidth: 455 } });
  assert.equal(custom.layout.sidebar, 'hidden');
  assert.equal(custom.layout.chatWidth, 455);
});

test('Poor mode is opt-in and identifies only spending controls', { tag: 'unit' }, () => {
  assert.equal(DEFAULT_SETTINGS.content.hideMonetization, false);
  assert.equal(normalizeSettings({ content: { hideMonetization: true } }).content.hideMonetization, true);
  assert.equal(normalizeSettings({ content: { hideMonetization: 'yes' } }).content.hideMonetization, false);

  assert.equal(monetizationKind({ testId: 'sub-button' }), 'subscribe');
  assert.equal(monetizationKind({ text: 'Subscribe' }), 'subscribe');
  assert.equal(monetizationKind({ testId: 'gift-sub-button' }), 'gift');
  assert.equal(monetizationKind({ text: 'Gift Dubs' }), 'gift');
  assert.equal(monetizationKind({ testId: 'gift-shop-button' }), 'gift');
  assert.equal(monetizationKind({ testId: 'kicks-top-nav' }), 'currency');
  assert.equal(monetizationKind({ testId: 'get-kicks' }), 'currency');
  assert.equal(monetizationKind({ ariaLabel: 'Expand leaderboard' }), 'leaderboard');

  // Poor mode must leave free/community actions intact and never classify a
  // chat sentence just because it happens to mention a purchase word.
  assert.equal(monetizationKind({ text: 'Follow', testId: 'follow-button' }), '');
  assert.equal(monetizationKind({ text: 'Claim Your Daily Reward' }), '');
  assert.equal(monetizationKind({ text: 'Someone gifted five subs in chat' }), '');
  assert.equal(monetizationKind({ text: 'Subscription settings' }), '');
});

test('emote preferences keep favorites, removals, and view modes bounded and local', { tag: 'unit' }, () => {
  // Schema 4 and earlier stored a flat `pinned` array. Position in it was the
  // order, so it migrates to ordered global favorites with nothing lost.
  const value = normalizeStickerPreferences({
    pinned: ['id:1', ' id:1 ', 'id:2', ''],
    hidden: ['id:2', 'id:3'],
    view: 'pinned',
    showHidden: true,
  });
  assert.deepEqual(value.favorites, [{ key: 'kick:id:1', channel: '', order: 0 }]);
  assert.deepEqual(value.hidden, ['kick:id:2', 'kick:id:3']);
  assert.equal(value.view, 'pinned');
  assert.equal(value.showHidden, true);

  // A longer legacy list keeps its order across the migration.
  const ordered = normalizeStickerPreferences({ pinned: ['id:9', 'id:7', 'id:8'] });
  assert.deepEqual(ordered.favorites.map((entry) => entry.key), ['kick:id:9', 'kick:id:7', 'kick:id:8']);
  assert.deepEqual(ordered.favorites.map((entry) => entry.order), [0, 1, 2]);

  assert.equal(normalizeStickerPreferences({ view: 'unexpected' }).view, 'all');
  assert.equal(normalizeStickerPreferences(null).showHidden, false);
  assert.equal(
    normalizeStickerPreferences({ pinned: Array.from({ length: 200 }, (_, index) => `id:${index}`) }).favorites.length,
    FAVORITES_PER_SCOPE_LIMIT,
  );
});

test('favorites are scoped per channel with a global fallback', { tag: 'unit' }, () => {
  const favorites = normalizeStickerPreferences({
    favorites: [
      { key: 'id:g1', channel: '', order: 0 },
      { key: 'id:g2', channel: '', order: 1 },
      { key: 'id:x1', channel: 'xqc', order: 0 },
    ],
  }).favorites;

  // On the channel: its own first, then the globals it has not overridden.
  assert.deepEqual(favoritesForChannel(favorites, 'xqc'), ['kick:id:x1', 'kick:id:g1', 'kick:id:g2']);
  // Anywhere else, only the globals — a channel favorite stays on its channel.
  assert.deepEqual(favoritesForChannel(favorites, 'someone-else'), ['kick:id:g1', 'kick:id:g2']);
  assert.deepEqual(favoritesForChannel(favorites, ''), ['kick:id:g1', 'kick:id:g2']);

  assert.equal(isStickerFavorite(favorites, 'kick:id:x1', 'xqc'), true);
  assert.equal(isStickerFavorite(favorites, 'kick:id:x1', 'other'), false);
  assert.equal(isStickerFavorite(favorites, 'kick:id:g1', 'other'), true);

  // The same emote favorited in both scopes appears once, not twice.
  const both = normalizeStickerPreferences({
    favorites: [{ key: 'id:a', channel: '', order: 0 }, { key: 'id:a', channel: 'xqc', order: 0 }],
  }).favorites;
  assert.deepEqual(favoritesForChannel(both, 'xqc'), ['kick:id:a']);

  // Scope names are validated like any other slug.
  assert.equal(favoriteScope('XQC'), 'xqc');
  assert.equal(favoriteScope('../evil'), '');
  assert.equal(favoriteScope(undefined), '');
  assert.deepEqual(favoritesForChannel(undefined, 'xqc'), []);
});

test('favorites can be reordered explicitly, within their own scope only', { tag: 'unit' }, () => {
  let favorites = normalizeStickerPreferences({
    favorites: [
      { key: 'a', channel: '', order: 0 },
      { key: 'b', channel: '', order: 1 },
      { key: 'c', channel: '', order: 2 },
      { key: 'z', channel: 'xqc', order: 0 },
    ],
  }).favorites;

  favorites = moveStickerFavorite(favorites, 'c', '', -1);
  assert.deepEqual(favoritesForChannel(favorites, ''), ['a', 'c', 'b']);
  favorites = moveStickerFavorite(favorites, 'a', '', 1);
  assert.deepEqual(favoritesForChannel(favorites, ''), ['c', 'a', 'b']);

  // Reordering a global must not disturb a channel scope.
  assert.deepEqual(favoritesForChannel(favorites, 'xqc'), ['z', 'c', 'a', 'b']);

  // Moving past either end is a no-op, not a wrap or a throw.
  const atTop = moveStickerFavorite(favorites, 'c', '', -1);
  assert.deepEqual(favoritesForChannel(atTop, ''), ['c', 'a', 'b']);
  const atEnd = moveStickerFavorite(favorites, 'b', '', 1);
  assert.deepEqual(favoritesForChannel(atEnd, ''), ['c', 'a', 'b']);

  // An unknown key changes nothing.
  assert.deepEqual(favoritesForChannel(moveStickerFavorite(favorites, 'nope', '', -1), ''), ['c', 'a', 'b']);
});

test('toggling a favorite touches one scope and respects the ceiling', { tag: 'unit' }, () => {
  let favorites = [];

  favorites = toggleStickerFavorite(favorites, 'a', '');
  favorites = toggleStickerFavorite(favorites, 'b', 'xqc');
  assert.deepEqual(favoritesForChannel(favorites, 'xqc'), ['b', 'a']);
  assert.deepEqual(favoritesForChannel(favorites, ''), ['a']);

  // Removing the channel-scoped one leaves the global untouched.
  favorites = toggleStickerFavorite(favorites, 'b', 'xqc');
  assert.deepEqual(favoritesForChannel(favorites, 'xqc'), ['a']);
  assert.deepEqual(favoritesForChannel(favorites, ''), ['a']);

  // New favorites append rather than displacing an existing order.
  favorites = toggleStickerFavorite(favorites, 'c', '');
  assert.deepEqual(favoritesForChannel(favorites, ''), ['a', 'c']);

  // The per-scope ceiling holds, and hitting it never drops what is there.
  let full = [];
  for (let index = 0; index < FAVORITES_PER_SCOPE_LIMIT + 10; index += 1) {
    full = toggleStickerFavorite(full, `k${index}`, '');
  }
  assert.equal(favoritesForChannel(full, '').length, FAVORITES_PER_SCOPE_LIMIT);
  assert.equal(favoritesForChannel(full, '')[0], 'k0');

  // The ceiling is per scope, so a channel still gets its own allowance.
  const scoped = toggleStickerFavorite(full, 'chan', 'xqc');
  assert.equal(scoped.filter((entry) => entry.channel === 'xqc').length, 1);
});

test('a hidden emote can never be favorited, in any scope', { tag: 'unit' }, () => {
  // Hidden wins, or the shelf keeps offering an emote the user just removed.
  const value = normalizeStickerPreferences({
    hidden: ['id:gone'],
    favorites: [
      { key: 'id:gone', channel: '', order: 0 },
      { key: 'id:gone', channel: 'xqc', order: 0 },
      { key: 'id:kept', channel: '', order: 1 },
    ],
  });
  assert.deepEqual(value.favorites.map((entry) => entry.key), ['kick:id:kept']);
  assert.deepEqual(favoritesForChannel(value.favorites, 'xqc'), ['kick:id:kept']);
});

test('sticker library keeps portable metadata, catalog access, custom groups, and one assignment per sticker', { tag: 'unit' }, () => {
  const value = normalizeStickerPreferences({
    schema: 3,
    view: 'group',
    activeGroup: 'reactions',
    groups: [
      { id: 'reactions', name: 'Reactions' },
      { id: 'duplicate-name', name: ' reactions ' },
      { id: 'bad id!', name: 'Invalid id is cleaned' },
    ],
    assignments: [
      { key: 'id:100', groupId: 'reactions' },
      { key: 'id:100', groupId: 'badid' },
      { key: 'id:200', groupId: 'missing' },
    ],
    library: [
      { key: 'id:100', id: '100', name: 'Wave', src: 'https://files.kick.com/emotes/100/fullsize', nativeGroups: ['Global', ' Global '], access: 'locked' },
      { key: 'id:101', id: '101', name: 'Chat find', src: 'https://files.kick.com/emotes/101/fullsize', nativeGroups: ['Seen in chat'], access: 'observed' },
      { key: 'id:102', id: '102', name: 'Channel find', src: 'https://files.kick.com/emotes/102/fullsize', nativeGroups: ['somechannel'], access: 'channel' },
      { key: 'id:200', id: '200', name: 'External', src: 'https://tracker.example/emotes/200/fullsize' },
      { key: 'id:300', id: '300', name: 'Protocol relative', src: '//tracker.example/emotes/300/fullsize' },
    ],
  });
  assert.equal(value.schema, STICKER_PREFERENCES_SCHEMA);
  assert.equal(value.view, 'group');
  assert.equal(value.groups.length, 2);
  assert.deepEqual(value.assignments, [{ key: 'kick:id:100', groupId: 'reactions' }]);
  assert.equal(value.library.length, 3);
  assert.equal(value.library[0].access, 'locked');
  assert.deepEqual(value.library[0].nativeGroups, ['Global']);
  assert.equal(value.library[1].access, 'observed');
  assert.equal(value.library[2].access, 'channel');
  assert.equal(normalizeStickerPreferences({ view: 'group', activeGroup: 'missing' }).view, 'all');
});

test('eviction protects available, favorited, and assigned emotes and drops oldest chat-only first', { tag: 'unit' }, () => {
  const at = (day) => Date.UTC(2026, 0, day);
  const entry = (key, access, lastSeen) => ({
    key, id: key.slice(3), name: key, src: `https://files.kick.com/emotes/${key.slice(3)}/fullsize`,
    nativeGroups: [], access, firstSeen: lastSeen, lastSeen,
  });
  const library = [
    entry('id:available-old', 'available', at(1)), // available: never evicted, even though oldest
    entry('id:observed-old', 'observed', at(2)),   // oldest observed -> first to go
    entry('id:favorited', 'observed', at(3)),      // observed but favorited -> protected
    entry('id:assigned', 'observed', at(4)),       // observed but assigned -> protected
    entry('id:locked-old', 'locked', at(5)),       // locked evicts only after observed
    entry('id:observed-new', 'observed', at(9)),   // newest observed -> kept over the old one
  ];
  const protectedKeys = new Set(['id:favorited', 'id:assigned']);
  const { library: kept, evicted } = evictStickerLibrary(library, 5, protectedKeys);
  assert.equal(evicted, 1);
  assert.deepEqual(kept.map((item) => item.key).sort(), [
    'id:assigned', 'id:available-old', 'id:favorited', 'id:locked-old', 'id:observed-new',
  ]);
  // The oldest chat-only entry is the one that went; nothing protected did.
  assert.ok(!kept.some((item) => item.key === 'kick:id:observed-old'));
});

test('a full library evicts an old observed entry rather than dropping the new one', { tag: 'unit' }, () => {
  // The R-06 precondition: at the cap, a newly-seen emote must be recorded.
  const base = (n) => ({
    key: `id:${n}`, id: String(n), name: `E${n}`, src: `https://files.kick.com/emotes/${n}/fullsize`,
    nativeGroups: ['Seen in chat'], access: 'observed', firstSeen: 1, lastSeen: n,
  });
  const full = Array.from({ length: STICKER_LIBRARY_LIMIT }, (_, index) => base(index + 1));
  const withNew = [...full, base(STICKER_LIBRARY_LIMIT + 1000)]; // freshest lastSeen
  const value = normalizeStickerPreferences({ schema: STICKER_PREFERENCES_SCHEMA, library: withNew });
  assert.equal(value.library.length, STICKER_LIBRARY_LIMIT);
  assert.ok(value.library.some((item) => item.key === `kick:id:${STICKER_LIBRARY_LIMIT + 1000}`), 'the new emote survives');
  assert.ok(!value.library.some((item) => item.key === 'kick:id:1'), 'the oldest observed emote is evicted');
});

test('removed keys are never re-materialised into the library on normalize', { tag: 'unit' }, () => {
  const value = normalizeStickerPreferences({
    schema: STICKER_PREFERENCES_SCHEMA,
    hidden: ['id:gone'],
    library: [
      { key: 'id:gone', id: 'gone', name: 'Gone', src: 'https://files.kick.com/emotes/gone/fullsize', nativeGroups: [], access: 'observed' },
      { key: 'id:kept', id: 'kept', name: 'Kept', src: 'https://files.kick.com/emotes/kept/fullsize', nativeGroups: [], access: 'observed' },
    ],
  });
  assert.deepEqual(value.library.map((item) => item.key), ['kick:id:kept']);
});

test('the emote preferences migrate losslessly from every historical schema to the current schema', { tag: 'unit' }, () => {
  const cdn = (id) => `https://files.kick.com/emotes/${id}/fullsize`;
  const day = Date.UTC(2026, 0, 10);

  // Schema 1: a flat pinned list, no library, no scope. Position was the order.
  const s1 = normalizeStickerPreferences({ schema: 1, pinned: ['id:1', 'id:2'] });
  assert.equal(s1.schema, STICKER_PREFERENCES_SCHEMA);
  assert.deepEqual(s1.favorites, [
    { key: 'kick:id:1', channel: '', order: 0 },
    { key: 'kick:id:2', channel: '', order: 1 },
  ]);

  // Schema 3: pinned + groups + assignments + a library without provenance.
  const s3 = normalizeStickerPreferences({
    schema: 3,
    pinned: ['id:5'],
    groups: [{ id: 'g1', name: 'Faves' }],
    assignments: [{ key: 'id:5', groupId: 'g1' }],
    library: [{ key: 'id:5', id: '5', name: 'Old', src: cdn(5), nativeGroups: ['Set'], access: 'available' }],
  });
  assert.equal(s3.favorites[0].key, 'kick:id:5');
  assert.equal(s3.favorites[0].channel, ''); // pinned migrates to global
  assert.deepEqual(s3.groups, [{ id: 'g1', name: 'Faves' }]);
  assert.deepEqual(s3.assignments, [{ key: 'kick:id:5', groupId: 'g1' }]);
  assert.equal(s3.library[0].firstSeen, 0); // pre-schema-4 entry: unknown, not faked

  // Schema 4: pinned + a library carrying first-seen and Kick-edit provenance.
  const s4 = normalizeStickerPreferences({
    schema: 4,
    pinned: ['id:7'],
    library: [{
      key: 'id:7', id: '7', name: 'New', src: cdn(7), nativeGroups: ['S'], access: 'available',
      firstSeen: day, lastSeen: day, wasName: 'Older', wasSrc: cdn('7v1'),
    }],
  });
  assert.equal(s4.favorites[0].key, 'kick:id:7');
  assert.equal(s4.library[0].firstSeen, day);       // provenance preserved
  assert.equal(s4.library[0].wasName, 'Older');     // Kick-rename record preserved
  assert.equal(s4.library[0].wasSrc, cdn('7v1'));   // Kick-reart record preserved

  // Schema 5: scoped, ordered favorites survive a round-trip unchanged.
  const s5 = normalizeStickerPreferences({
    schema: 5,
    favorites: [{ key: 'id:9', channel: 'xqc', order: 0 }, { key: 'id:8', channel: '', order: 0 }],
  });
  assert.deepEqual(s5.favorites, [
    { key: 'kick:id:9', channel: 'xqc', order: 0 },
    { key: 'kick:id:8', channel: '', order: 0 },
  ]);

  // Schema 6 adds an honest channel-only catalog state. It stays portable and
  // is never upgraded to sendable merely because the artwork is public.
  const s6 = normalizeStickerPreferences({
    schema: 6,
    library: [{ key: 'id:10', id: '10', name: 'Local', src: cdn(10), nativeGroups: ['channel'], access: 'channel' }],
  });
  assert.equal(s6.library[0].access, 'channel');

  // A corrupted intermediate is caught: provenance that no longer differs from
  // the current name must NOT be carried as a phantom rename.
  const clean = normalizeStickerPreferences({
    schema: 4,
    library: [{ key: 'id:7', id: '7', name: 'Same', src: cdn(7), nativeGroups: [], access: 'available', wasName: 'Same' }],
  });
  assert.ok(!('wasName' in clean.library[0]), 'wasName equal to name must not be recorded');
});

test('emote library preserves the source and follow-gate evidence used by click-to-save', { tag: 'unit' }, () => {
  const value = normalizeStickerPreferences({
    schema: 6,
    library: [{
      key: 'id:88',
      id: '88',
      name: 'FollowWave',
      src: 'https://files.kick.com/emotes/88/fullsize',
      nativeGroups: ['chessbrah'],
      access: 'locked',
      sourceSlug: 'chessbrah',
      requiresFollow: true,
      followed: false,
      subscribersOnly: false,
    }],
  });
  assert.equal(value.schema, STICKER_PREFERENCES_SCHEMA);
  assert.equal(value.library[0].sourceSlug, 'chessbrah');
  assert.equal(value.library[0].requiresFollow, true);
  assert.equal(value.library[0].followed, false);
  assert.equal(value.library[0].subscribersOnly, false);
});

test('route classifier covers every audited desktop surface', { tag: 'unit' }, () => {
  assert.equal(routeKind('https://kick.com/'), 'home');
  assert.equal(routeKind('/browse'), 'browse');
  assert.equal(routeKind('/browse/categories'), 'categories');
  assert.equal(routeKind('/browse/clips'), 'clips');
  assert.equal(routeKind('/following'), 'following');
  assert.equal(routeKind('/following/channels'), 'following');
  assert.equal(routeKind('/drops/campaigns'), 'drops');
  assert.equal(routeKind('/category/just-chatting'), 'category');
  assert.equal(routeKind('/search?query=music'), 'search');
  assert.equal(routeKind('/lordkebun'), 'channel');
  assert.equal(routeKind('/creator-dashboard'), 'other');
});

test('ad hosts and optional telemetry are separated from first-party playback', { tag: 'unit' }, () => {
  assert.equal(classifyRequest('https://imasdk.googleapis.com/pal/sdkloader/pal.js').category, 'advertising');
  assert.equal(classifyRequest('https://pubads.g.doubleclick.net/adsid/integrator.json').blocked, true);
  assert.equal(classifyRequest('https://4g1csfd6d0egt72a3mo5kgi77.litix.io/', { reduceTelemetry: true }).category, 'telemetry');
  assert.equal(classifyRequest('https://4g1csfd6d0egt72a3mo5kgi77.litix.io/', { reduceTelemetry: false }).blocked, false);
  assert.equal(classifyRequest('https://web.kick.com/api/v1/stream/123/playback', { reduceTelemetry: true }).blocked, false);
});

test('diagnostic URLs never preserve query strings or long identifiers', { tag: 'unit' }, () => {
  const value = sanitizeDiagnosticUrl('https://web.kick.com/api/v1/stream/01a00174-9260-7c4d-958b-e555d56d4566/playback?token=secret');
  assert.equal(value, 'web.kick.com/api/v1/stream/:id/playback');
  assert.equal(value.includes('secret'), false);
});

test('content labels distinguish casino, mature, promoted, and drops surfaces', { tag: 'unit' }, () => {
  assert.deepEqual(detectContentLabels('LIVE Slots & Casino 18+ Sponsored Kick Drops'), {
    casino: true,
    mature: true,
    promoted: true,
    drops: true,
  });
});

test('settings import reports malformed and future schemas', { tag: 'unit' }, () => {
  assert.equal(validateImportedSettings('{oops').ok, false);
  assert.match(validateImportedSettings('{"schema":99}').error, /newer/);
  assert.equal(validateImportedSettings('{"layout":{"chatWidth":410}}').value.layout.chatWidth, 410);
});

test('settings import names whatever it could not keep', { tag: 'unit' }, () => {
  // A value outside the supported range is clamped, and the change is stated
  // rather than silently applied.
  const clamped = validateImportedSettings('{"schema":1,"layout":{"chatWidth":9000}}');
  assert.equal(clamped.ok, true);
  assert.equal(clamped.value.layout.chatWidth, 520);
  assert.ok(clamped.notes.some((note) => /Adjusted "layout.chatWidth"/.test(note)));

  // Settings and sections this build does not have are reported, not ignored.
  const unknown = validateImportedSettings('{"schema":1,"layout":{"nonsense":1},"mystery":{}}');
  assert.ok(unknown.notes.some((note) => /layout.nonsense/.test(note)));
  assert.ok(unknown.notes.some((note) => /unknown section "mystery"/.test(note)));

  // An older or unversioned file is upgraded, and says so.
  assert.ok(validateImportedSettings('{"layout":{"chatWidth":410}}').notes
    .some((note) => /Upgraded from an unversioned file/.test(note)));

  // A clean, current file produces no noise.
  const clean = validateImportedSettings(JSON.stringify({ schema: SETTINGS_SCHEMA, layout: { chatWidth: 410 } }));
  assert.deepEqual(clean.notes, []);
});

test('settings import round-trips the sticker library without treating it as an unknown section', { tag: 'unit' }, () => {
  const imported = validateImportedSettings(JSON.stringify({
    schema: 1,
    stickers: {
      schema: 2,
      pinned: ['id:100'],
      hidden: [],
      groups: [{ id: 'memes', name: 'Memes' }],
      assignments: [{ key: 'id:100', groupId: 'memes' }],
      library: [{ key: 'id:100', id: '100', name: 'Wave', src: 'https://files.kick.com/emotes/100/fullsize', nativeGroups: ['Global'], access: 'available' }],
    },
  }));
  assert.equal(imported.ok, true);
  assert.equal(imported.stickers.library.length, 1);
  assert.deepEqual(imported.stickers.assignments, [{ key: 'kick:id:100', groupId: 'memes' }]);
  assert.equal(imported.notes.some((note) => /unknown section "stickers"/.test(note)), false);
  assert.match(validateImportedSettings('{"schema":1,"stickers":{"schema":99}}').error, /Emote schema 99/);
});

test('sticker import names dropped entries rather than reporting a bare count', { tag: 'unit' }, () => {
  // Two valid entries plus one missing its asset URL: the dropped one is named.
  const result = validateImportedSettings(JSON.stringify({
    schema: 1,
    stickers: {
      schema: 2,
      pinned: [],
      hidden: [],
      groups: [],
      assignments: [],
      library: [
        { key: 'id:1', id: '1', name: 'GoodOne', src: 'https://files.kick.com/emotes/1/fullsize', nativeGroups: [], access: 'available' },
        { key: 'id:2', id: '2', name: 'MissingSrc', nativeGroups: [], access: 'available' },
        { key: 'id:3', id: '3', name: 'AlsoGood', src: 'https://files.kick.com/emotes/3/fullsize', nativeGroups: [], access: 'available' },
      ],
    },
  }));
  assert.equal(result.ok, true);
  assert.equal(result.stickers.library.length, 2);
  // The note names what was dropped, not just the count.
  const note = result.notes.find((n) => /could not be kept/.test(n));
  assert.ok(note, 'expected a note naming the dropped sticker');
  assert.ok(note.includes('MissingSrc'), `expected "MissingSrc" in the note: ${note}`);
  assert.ok(/^1 sticker/.test(note), 'expected singular phrasing for one dropped entry');
});

test('hidden channels normalize and round-trip through settings', { tag: 'unit' }, () => {
  // A channel path or URL is normalized to a clean path.
  assert.equal(normalizeChannelPath('xQc'), '/xqc');
  assert.equal(normalizeChannelPath('https://kick.com/Creator/'), '/creator');
  assert.equal(normalizeChannelPath('/already-clean'), '/already-clean');
  assert.equal(normalizeChannelPath(''), '');

  // Settings normalization caps the list and deduplicates.
  const settings = normalizeSettings({
    content: { hiddenChannels: ['/a', '/b', '/a', 42, '/c'] },
  });
  assert.deepEqual(settings.content.hiddenChannels, ['/a', '/b', '/c']);
});

test('remote blocklists accept data-only entries and reject executable or unknown fields', { tag: 'unit' }, () => {
  const valid = validateRemoteBlocklist({
    schema: 1,
    channels: ['https://kick.com/Creator-One/', '/creator-two'],
    categories: ['Slots & Casino', 'just-chatting'],
    keywords: ['giveaway', '  raid  '],
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value.channels, ['/creator-one', '/creator-two']);
  assert.deepEqual(valid.value.categories, ['slots-casino', 'just-chatting']);
  assert.deepEqual(valid.value.keywords, ['giveaway', 'raid']);
  assert.equal(validateRemoteBlocklist({ channels: [], execute: 'nope' }).ok, false);
  assert.equal(validateRemoteBlocklist({ channels: [42] }).ok, false);
});

test('filtering fails open when it would hide most of a grid', { tag: 'unit' }, () => {
  // A grid that is mostly promotional is far more likely to be a labelling
  // change than the truth, so nothing is hidden and the caller is told why.
  const suspended = filterDecision(12, 7);
  assert.equal(suspended.apply, false);
  assert.equal(suspended.reason, 'ratio');
  assert.equal(suspended.hidden, 7);
  assert.equal(suspended.total, 12);

  // Ordinary filtering is untouched.
  assert.equal(filterDecision(12, 2).apply, true);

  // Exactly at the ceiling still applies; only exceeding it suspends.
  assert.equal(filterDecision(12, 3).apply, true);
  assert.equal(filterDecision(12, 4).apply, false);
});

test('filter ceiling ignores samples too small to judge', { tag: 'unit' }, () => {
  // A channel page may legitimately show two cards, both filtered.
  assert.equal(filterDecision(FILTER_MIN_SAMPLE - 1, FILTER_MIN_SAMPLE - 1).apply, true);
  assert.equal(filterDecision(0, 0).apply, true);
  assert.equal(filterDecision(1, 1).apply, true);
});

test('filter decision tolerates nonsense counts', { tag: 'unit' }, () => {
  assert.equal(filterDecision(-3, 5).apply, true);
  assert.equal(filterDecision(10, 999).apply, false);
  assert.equal(filterDecision(undefined, undefined).apply, true);
  assert.equal(filterDecision(10, 999).hidden, 10);
});

test('apply delay is capped so a busy page cannot starve the work', { tag: 'unit' }, () => {
  // Fresh request: the caller's debounce is honoured.
  assert.equal(nextApplyDelay(80, 0), 80);

  // Under continuous mutations the wait shrinks and eventually hits zero, which
  // is what stops Kick's constantly-changing DOM from resetting the timer forever.
  assert.equal(nextApplyDelay(80, 450), 50);
  assert.equal(nextApplyDelay(80, 500), 0);
  assert.equal(nextApplyDelay(80, 9000), 0);

  // A shorter request is never lengthened.
  assert.equal(nextApplyDelay(0, 0), 0);
  assert.equal(nextApplyDelay(10, 100), 10);
  assert.equal(nextApplyDelay(undefined, undefined), 0);
});

test('structured card evidence outranks prose', { tag: 'unit' }, () => {
  // The failure this replaces: ordinary titles reading as promotional content.
  const beat = detectContentLabels('DJ set - Drop the beat! | Music', {
    categories: ['music'],
    badges: ['LIVE', 'English', '4.2K'],
  });
  assert.equal(beat.drops, false);
  assert.equal(beat.casino, false);

  const frames = detectContentLabels('fixing dropped frames again', {
    categories: ['just-chatting'],
    badges: ['LIVE'],
  });
  assert.equal(frames.drops, false);

  // Talking about a casino is not being one.
  const talking = detectContentLabels('I lost it all at the casino, story time', {
    categories: ['just-chatting'],
    badges: ['LIVE'],
  });
  assert.equal(talking.casino, false);

  // Kick's own slug is authoritative, whatever the title says.
  const real = detectContentLabels('big wins tonight', {
    categories: ['slots'],
    badges: ['LIVE', '18+'],
  });
  assert.equal(real.casino, true);
  assert.equal(real.mature, true);
});

test('label detection falls back to text only without structured evidence', { tag: 'unit' }, () => {
  const fallback = detectContentLabels('Slots & Casino 18+', {});
  assert.equal(fallback.casino, true);
  assert.equal(fallback.mature, true);

  // A localized display name still classifies via the slug.
  assert.equal(detectContentLabels('Tragamonedas', { categories: ['slots'] }).casino, true);

  // Badges present but none matching means the card is genuinely unlabelled.
  assert.equal(detectContentLabels('casino talk', { badges: ['LIVE'], categories: ['irl'] }).casino, false);
});

test('the ceiling yields to an explicit category page', { tag: 'unit' }, () => {
  // Browsing /category/slots with the casino filter on should empty the page:
  // that is the filter working, not a labelling failure.
  const category = filterDecision(24, 24, { route: 'category' });
  assert.equal(category.apply, true);
  assert.equal(category.reason, 'category-route');

  // The same ratio anywhere else still suspends.
  assert.equal(filterDecision(24, 24, { route: 'browse' }).apply, false);
  assert.equal(filterDecision(24, 24).apply, false);
});

test('playback payloads have their ad flags cleared', { tag: 'unit' }, () => {
  const payload = JSON.stringify({
    playback_url: { live: 'https://stream.kick.com/x.m3u8' },
    video_session: { auto_ads_enabled: true, id: 'abc' },
    video_player: {
      google_ads_sdk: { initiate_sdk: true },
      pal_sdk: { initiate_sdk: true },
      player: { player_name: 'ivs' },
    },
  });

  const result = neutralizePlaybackPayload(payload);
  assert.equal(result.changed, true);
  const parsed = JSON.parse(result.text);
  assert.equal(parsed.video_session.auto_ads_enabled, false);
  assert.equal('google_ads_sdk' in parsed.video_player, false);
  assert.equal('pal_sdk' in parsed.video_player, false);

  // Analytics SDKs are a privacy choice, so they follow the telemetry setting
  // rather than being removed from everyone.
  const withMux = JSON.stringify({ video_player: { mux_sdk: {}, google_ads_sdk: {} } });
  const adsOnly = JSON.parse(neutralizePlaybackPayload(withMux).text);
  assert.equal('mux_sdk' in adsOnly.video_player, true);
  assert.equal('google_ads_sdk' in adsOnly.video_player, false);
  const alsoTelemetry = JSON.parse(neutralizePlaybackPayload(withMux, { reduceTelemetry: true }).text);
  assert.equal('mux_sdk' in alsoTelemetry.video_player, false);

  // Playback itself must survive untouched, or the stream stops working.
  assert.equal(parsed.playback_url.live, 'https://stream.kick.com/x.m3u8');
  assert.equal(parsed.video_session.id, 'abc');
  assert.equal(parsed.video_player.player.player_name, 'ivs');
});

test('playback rewriting leaves unrelated or clean payloads alone', { tag: 'unit' }, () => {
  assert.equal(neutralizePlaybackPayload('not json').changed, false);
  assert.equal(neutralizePlaybackPayload('').changed, false);
  assert.equal(neutralizePlaybackPayload('[1,2,3]').changed, false);
  // Already ad-free: nothing to do, so the body is not rebuilt.
  assert.equal(neutralizePlaybackPayload('{"video_session":{"auto_ads_enabled":false}}').changed, false);
  assert.equal(neutralizePlaybackPayload('{"video_player":{"player":{}}}').changed, false);
});

test('playback URLs are recognised across endpoint shapes', { tag: 'unit' }, () => {
  assert.equal(isPlaybackUrl('https://web.kick.com/api/v1/stream/abc-123/playback'), true);
  assert.equal(isPlaybackUrl('https://web.kick.com/api/v2/channels/x/playback?foo=1'), true);
  assert.equal(isPlaybackUrl('/stream/abc/playback'), true);
  assert.equal(isPlaybackUrl('https://kick.com/api/v1/channels/xqc'), false);
  assert.equal(isPlaybackUrl('https://stream.kick.com/playbackish/x.m3u8'), false);
  assert.equal(isPlaybackUrl(''), false);
});

test('injection timing is described from what the page already contained', { tag: 'unit' }, () => {
  // Ideal: nothing has parsed yet.
  assert.equal(describeInjection({ readyState: 'loading', scriptCount: 0, hasBody: false }).grade, 'first');

  // Chromium managers commonly land after the page's own scripts.
  const contended = describeInjection({ readyState: 'loading', scriptCount: 3, hasBody: false });
  assert.equal(contended.grade, 'contended');
  assert.match(contended.summary, /after 3 page scripts/);
  assert.match(describeInjection({ readyState: 'loading', scriptCount: 1 }).summary, /after 1 page script$/);

  // A body already present means rendering started without us.
  assert.equal(describeInjection({ readyState: 'loading', scriptCount: 0, hasBody: true }).grade, 'late');
  assert.equal(describeInjection({ readyState: 'interactive' }).grade, 'late');
  assert.equal(describeInjection({}).grade, 'first');
});

test('ad stack drift is reported instead of passing silently', { tag: 'unit' }, () => {
  // Nothing seen yet says so, rather than implying health.
  assert.equal(assessAdStack({ sawPlayback: false }).status, 'unknown');

  // The shape this build was written against.
  const known = assessAdStack({ sawPlayback: true, playbackSdkKeys: ['google_ads_sdk', 'pal_sdk', 'mux_sdk'] });
  assert.equal(known.status, 'known');
  assert.equal(known.drifted, false);

  // A key we have never seen means Kick changed something.
  const drifted = assessAdStack({ sawPlayback: true, playbackSdkKeys: ['google_ads_sdk', 'brand_new_sdk'] });
  assert.equal(drifted.drifted, true);
  assert.match(drifted.summary, /brand_new_sdk/);

  // Playback with no known keys is the ambiguous case that must be surfaced,
  // because it looks exactly like a clean page.
  const absent = assessAdStack({ sawPlayback: true, playbackSdkKeys: [] });
  assert.equal(absent.status, 'absent');
  assert.equal(absent.drifted, true);
});

test('emote access merging handles a first observation and never downgrades access', { tag: 'unit' }, () => {
  assert.equal(preferredStickerAccess(undefined, 'observed'), 'observed');
  assert.equal(preferredStickerAccess(undefined, 'channel'), 'channel');
  assert.equal(preferredStickerAccess('available', 'observed'), 'available');
  assert.equal(preferredStickerAccess('channel', 'locked'), 'channel');
  assert.equal(preferredStickerAccess('observed', 'available'), 'available');
  assert.equal(preferredStickerAccess('unknown', 'unknown'), 'locked');
});

test('the emote library records when Kick changes an emote under the user', { tag: 'unit' }, () => {
  const day1 = Date.UTC(2026, 0, 10);
  const day2 = Date.UTC(2026, 5, 20);
  const day3 = Date.UTC(2026, 7, 1);
  const base = { key: 'id:1', id: '1', name: 'LULW', src: 'https://files.kick.com/emotes/1/fullsize', nativeGroups: [], access: 'available' };

  // First capture stamps both ends and flags nothing.
  const first = recordStickerObservation(null, base, day1);
  assert.equal(first.firstSeen, day1);
  assert.equal(first.lastSeen, day1);
  assert.equal(stickerChangedSinceCapture(first), false);
  assert.equal(describeStickerChange(first), '');

  // Seeing it again moves lastSeen only.
  const again = recordStickerObservation(first, base, day2);
  assert.equal(again.firstSeen, day1);
  assert.equal(again.lastSeen, day2);
  assert.equal(stickerChangedSinceCapture(again), false);

  // A rename records the *original* name and says so with the first-seen date.
  const renamed = recordStickerObservation(again, { ...base, name: 'LULWremaster' }, day3);
  assert.equal(renamed.wasName, 'LULW');
  assert.equal(renamed.firstSeen, day1);
  assert.equal(stickerChangedSinceCapture(renamed), true);
  assert.match(describeStickerChange(renamed), /renamed from "LULW"/);
  assert.match(describeStickerChange(renamed), /2026-01-10/);

  // A second rename keeps the true original, not the previous value.
  const renamedAgain = recordStickerObservation(renamed, { ...base, name: 'LULW3' }, day3);
  assert.equal(renamedAgain.wasName, 'LULW');

  // Renaming back to the original clears the flag rather than leaving it stuck.
  const restored = recordStickerObservation(renamedAgain, base, day3);
  assert.equal(restored.wasName, undefined);
  assert.equal(stickerChangedSinceCapture(restored), false);

  // A replaced asset is the case Kick support answered with "clear your cache".
  const reart = recordStickerObservation(again, { ...base, src: 'https://files.kick.com/emotes/1/v2' }, day3);
  assert.equal(reart.wasSrc, 'https://files.kick.com/emotes/1/fullsize');
  assert.match(describeStickerChange(reart), /artwork replaced/);

  // Both at once reads as one sentence.
  const both = recordStickerObservation(again, { ...base, name: 'New', src: 'https://files.kick.com/emotes/1/v2' }, day3);
  assert.match(describeStickerChange(both), /renamed from "LULW" and artwork replaced/);

  // An entry carried over from schema 3 has no first-seen date. Stamping it
  // with today would claim knowledge the record does not have, so it stays 0
  // and only lastSeen advances.
  const migrated = recordStickerObservation({ ...base, firstSeen: 0, lastSeen: 0 }, base, day3);
  assert.equal(migrated.firstSeen, 0);
  assert.equal(migrated.lastSeen, day3);
  assert.equal(describeStickerChange({ ...migrated, wasName: 'Old' }), 'Kick has renamed from "Old" since first capture.');

  assert.equal(countChangedStickers([first, renamed, reart]), 2);
  assert.equal(countChangedStickers(new Map([['a', first]])), 0);
  assert.equal(countChangedStickers(undefined), 0);
});

test('emote history survives the export round-trip and rejects impossible dates', { tag: 'unit' }, () => {
  const seen = Date.UTC(2026, 2, 3);
  const imported = validateImportedSettings(JSON.stringify({
    schema: SETTINGS_SCHEMA,
    stickers: {
      schema: 4,
      library: [
        {
          key: 'id:9', id: '9', name: 'Now', src: 'https://files.kick.com/emotes/9/v2',
          nativeGroups: [], access: 'available',
          firstSeen: seen, lastSeen: seen + 1000,
          wasName: 'Before', wasSrc: 'https://files.kick.com/emotes/9/fullsize',
        },
        // A hand-edited or clock-skewed file must not produce a date the record
        // cannot support: a wrong date is worse than none.
        {
          key: 'id:10', id: '10', name: 'Junk', src: 'https://files.kick.com/emotes/10/fullsize',
          nativeGroups: [], access: 'available',
          firstSeen: 1, lastSeen: 'yesterday',
        },
      ],
    },
  }));
  assert.equal(imported.ok, true);

  const kept = imported.stickers.library.find((entry) => entry.key === 'kick:id:9');
  assert.equal(kept.firstSeen, seen);
  assert.equal(kept.lastSeen, seen + 1000);
  assert.equal(kept.wasName, 'Before');
  assert.equal(stickerChangedSinceCapture(kept), true);

  const junk = imported.stickers.library.find((entry) => entry.key === 'kick:id:10');
  assert.equal(junk.firstSeen, 0);
  assert.equal(junk.lastSeen, 0);

  // A stale wasName equal to the current name is not a change and is dropped.
  const noop = validateImportedSettings(JSON.stringify({
    stickers: { schema: 4, library: [{ key: 'id:11', id: '11', name: 'Same', src: 'https://files.kick.com/emotes/11/fullsize', wasName: 'Same' }] },
  }));
  assert.equal(noop.stickers.library[0].wasName, undefined);
});

test('a layout link carries channel names and nothing else, and is revalidated on the way in', { tag: 'unit' }, () => {
  const link = multistreamLayoutLink(['xQc', 'Adin_Ross']);
  assert.equal(link, 'https://kick.com/?kf-multi=xQc%2CAdin_Ross');
  assert.deepEqual(parseMultistreamLink(link), ['xQc', 'Adin_Ross']);

  // A link is untrusted input regardless of who sent it: every slug goes back
  // through the same validation the grid uses.
  assert.deepEqual(
    parseMultistreamLink('https://kick.com/?kf-multi=good,../evil,<script>,ok_2'),
    ['good', 'ok_2'],
  );
  // Duplicates collapse and the nine-tile ceiling still applies.
  assert.deepEqual(parseMultistreamLink('https://kick.com/?kf-multi=a,A,a'), ['a']);
  assert.equal(parseMultistreamLink(`https://kick.com/?kf-multi=${Array.from({ length: 30 }, (_, i) => `c${i}`).join(',')}`).length, 9);

  // Nothing usable opens nothing, rather than opening something unexpected.
  assert.deepEqual(parseMultistreamLink('https://kick.com/'), []);
  assert.deepEqual(parseMultistreamLink('https://kick.com/?kf-multi='), []);
  assert.deepEqual(parseMultistreamLink('not a url at all'), []);
  assert.deepEqual(parseMultistreamLink(`https://kick.com/?kf-multi=${'x'.repeat(2000)}`), []);
  assert.equal(multistreamLayoutLink([]), '');
  assert.equal(multistreamLayoutLink(['../nope']), '');
});

test('chat badges fill the gap Kick leaves without duplicating what it drew', { tag: 'unit' }, () => {
  const collectible = 'https://ext.cdn.kick.com/chat/badges/collectible-gold.svg';
  const sub = 'https://ext.cdn.kick.com/chat/badges/sub.svg';

  // Kick already drew the subscriber badge; only the collectible is ours.
  const render = chatBadgesToRender(
    [
      { type: 'subscriber', text: 'Subscriber', image: sub },
      { type: 'collectible', text: 'Golden', image: collectible },
    ],
    [sub],
  );
  assert.equal(render.length, 1);
  assert.equal(render[0].label, 'Golden');
  assert.equal(render[0].image, collectible);

  // A badge with no image cannot be matched against the DOM, so it is kept and
  // will render as text rather than an empty box.
  const textOnly = chatBadgesToRender([{ type: 'og', text: 'OG' }], [sub]);
  assert.deepEqual(textOnly, [{ label: 'OG', image: '' }]);

  // `type` stands in when `text` is absent, and an entry with neither is dropped
  // rather than drawing a blank badge.
  assert.equal(chatBadgesToRender([{ type: 'vip' }])[0].label, 'vip');
  assert.deepEqual(chatBadgesToRender([{ image: collectible }]), []);
  assert.deepEqual(chatBadgesToRender([{}, null, 'nope']), []);

  // A payload repeating a badge must not draw it twice.
  assert.equal(chatBadgesToRender([
    { text: 'OG', image: collectible },
    { text: 'OG', image: collectible },
  ]).length, 1);

  // Nothing to draw when Kick already drew everything, and junk input is empty.
  assert.deepEqual(chatBadgesToRender([{ text: 'Sub', image: sub }], new Set([sub])), []);
  assert.deepEqual(chatBadgesToRender(undefined), []);
});

test('API drift is accumulated and reported instead of silently falling back', { tag: 'unit' }, () => {
  // No drift is the normal case.
  const clean = assessApiDrift([]);
  assert.equal(clean.drifted, false);

  // A shape change names the endpoint and reason.
  const drifted = assessApiDrift([
    { endpoint: 'channel', reason: 'shape-changed', at: Date.now() },
    { endpoint: 'emotes', reason: 'shape-changed', detail: 'not-an-array', at: Date.now() },
  ]);
  assert.equal(drifted.drifted, true);
  assert.equal(drifted.count, 2);
  assert.match(drifted.summary, /channel/);
  assert.match(drifted.summary, /emotes/);

  // Duplicate endpoint+reason pairs are collapsed.
  const deduped = assessApiDrift([
    { endpoint: 'channel', reason: 'shape-changed', at: 1 },
    { endpoint: 'channel', reason: 'shape-changed', at: 2 },
  ]);
  assert.equal(deduped.count, 1);
});

test('failed writes are named and recovered writes clear themselves', { tag: 'unit' }, () => {
  let registry = {};

  // A failure names the data in the user's words, not the storage key.
  registry = recordStorageResult(registry, 'kick-focus:sticker-preferences', false, 1);
  assert.match(describeStorageFailures(registry).message, /emote library/);

  // Repeated failures of the same key warn once, counting the attempts, so a
  // library that fails on every keystroke does not produce a wall of warnings.
  registry = recordStorageResult(registry, 'kick-focus:sticker-preferences', false, 2);
  assert.equal(Object.keys(registry).length, 1);
  assert.equal(describeStorageFailures(registry).total, 2);

  // A second, different key reads as a broader problem and lists both.
  registry = recordStorageResult(registry, 'kick-focus:channel-notes', false, 3);
  const both = describeStorageFailures(registry);
  assert.deepEqual(both.labels, ['channel notes', 'emote library']);
  assert.match(both.message, /channel notes and emote library/);

  // Recovery retires the entry rather than leaving a stale warning up.
  registry = recordStorageResult(registry, 'kick-focus:sticker-preferences', true, 4);
  assert.match(describeStorageFailures(registry).message, /channel notes/);
  registry = recordStorageResult(registry, 'kick-focus:channel-notes', true, 5);
  assert.equal(describeStorageFailures(registry), null);
});

test('storage size is reported largest-first in units a person reads', { tag: 'unit' }, () => {
  const report = approximateStorageBytes({
    'kick-focus:settings': { a: 1 },
    'kick-focus:sticker-preferences': { library: new Array(400).fill('collectiblesGoldenLULW') },
  });
  assert.equal(report.breakdown[0].key, 'kick-focus:sticker-preferences');
  assert.equal(report.breakdown[0].label, 'emote library');
  assert.ok(report.total > report.breakdown[1].bytes);

  // A value that cannot be serialised must not take the diagnostics down.
  const circular = {};
  circular.self = circular;
  assert.equal(approximateStorageBytes({ 'kick-focus:settings': circular }).total, 0);

  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.00 MB');
});

test('imported keys hidden by the prototype chain are reported, not swallowed', { tag: 'unit' }, () => {
  const payload = JSON.parse('{"schema":2,"layout":{"__proto__":{"polluted":true},"constructor":1,"toString":"x","density":"compact"}}');
  const result = validateImportedSettings(JSON.stringify(payload));
  assert.equal(result.ok, true);
  for (const key of ['__proto__', 'constructor', 'toString']) {
    assert.ok(
      result.notes.some((note) => note.includes(`layout.${key}`)),
      `expected "${key}" to be reported as ignored`,
    );
  }
  // Reporting only — normalizeSettings rebuilds from defaults, so nothing leaks.
  assert.equal(({}).polluted, undefined);
  assert.equal(result.value.layout.density, 'compact');
});

test('ad preflight scripts are matched exactly, not by hostname alone', { tag: 'unit' }, () => {
  const origin = 'https://kick.com';

  // The three Kick actually waits on before it will request playback.
  assert.equal(isAdPreflightScript('https://imasdk.googleapis.com/pal/sdkloader/pal.js', origin), true);
  assert.equal(isAdPreflightScript('https://platform.datazoom.io/beacon/v1/config', origin), true);
  assert.equal(isAdPreflightScript('/om/omweb-v1.js', origin), true);
  assert.equal(isAdPreflightScript('https://kick.com/om/omweb-v1.js', origin), true);

  // Same host, different script: removing it would break the IMA path this
  // build deliberately leaves alone.
  assert.equal(isAdPreflightScript('https://imasdk.googleapis.com/js/sdkloader/ima3.js', origin), false);
  // The same-origin rule must not match another origin serving that path.
  assert.equal(isAdPreflightScript('https://evil.example.com/om/omweb-v1.js', origin), false);
  assert.equal(isAdPreflightScript('', origin), false);
  assert.equal(isAdPreflightScript(null, origin), false);
  assert.equal(isAdPreflightScript('not a url at all', 'also not a url'), false);
});

test('the multi-stream grid dedupes, caps, and keeps audio pointed somewhere', { tag: 'unit' }, async () => {
  const {
    MULTISTREAM_MAX, addMultistreamChannel, multistreamColumns,
    normalizeMultistream, removeMultistreamChannel, saveMultistreamLayout,
  } = await import('../src/core.mjs');

  let grid = normalizeMultistream({ streams: ['xqc', 'XQC', 'trainwreck', 'bad slug!'] });
  assert.deepEqual(grid.streams, ['xqc', 'trainwreck'], 'case-insensitive dedupe, invalid dropped');
  // Audio and chat must always point at a stream that exists.
  assert.equal(grid.focus, 'xqc');
  assert.equal(grid.chat, 'xqc');

  const added = addMultistreamChannel(grid, 'adin');
  assert.equal(added.ok, true);
  assert.deepEqual(added.value.streams, ['xqc', 'trainwreck', 'adin']);

  // Failure says why. "I clicked add and nothing happened" is the failure mode.
  assert.match(addMultistreamChannel(added.value, 'XQC').error, /already in the grid/);
  assert.match(addMultistreamChannel(added.value, 'not valid!').error, /not a Kick channel/);

  const full = normalizeMultistream({ streams: Array.from({ length: MULTISTREAM_MAX }, (_, i) => `chan${i}`) });
  assert.equal(full.streams.length, MULTISTREAM_MAX);
  assert.match(addMultistreamChannel(full, 'onemore').error, new RegExp(String(MULTISTREAM_MAX)));
  // The cap holds even when the stored value was hand-edited past it.
  assert.equal(normalizeMultistream({ streams: Array.from({ length: 40 }, (_, i) => `c${i}`) }).streams.length, MULTISTREAM_MAX);

  // Removing the focused stream must not leave the grid silent and chatless.
  const removed = removeMultistreamChannel(added.value, 'xqc');
  assert.deepEqual(removed.streams, ['trainwreck', 'adin']);
  assert.equal(removed.focus, 'trainwreck');
  assert.equal(removed.chat, 'trainwreck');
  assert.equal(removeMultistreamChannel(removed, 'trainwreck').focus, 'adin');
  assert.equal(removeMultistreamChannel(normalizeMultistream({ streams: ['solo'] }), 'solo').focus, '');

  const saved = saveMultistreamLayout(added.value, '  Sunday   crew  ');
  assert.equal(saved.ok, true);
  assert.equal(saved.value.layouts[0].name, 'Sunday crew');
  // Saving the same name replaces rather than duplicating.
  assert.equal(saveMultistreamLayout(saved.value, 'Sunday crew').value.layouts.length, 1);
  assert.match(saveMultistreamLayout(added.value, '   ').error, /Name this layout/);
  assert.match(saveMultistreamLayout(normalizeMultistream({}), 'Empty').error, /at least one stream/);

  // A lone tile on the last row looks broken; these counts avoid it.
  assert.equal(multistreamColumns(1), 1);
  assert.equal(multistreamColumns(4), 2);
  assert.equal(multistreamColumns(9), 3);
  assert.equal(multistreamColumns(0), 1);
});

test('adding a channel never recreates a tile that is already playing', { tag: 'unit' }, async () => {
  const { planMultistreamTiles, normalizeMultistream, addMultistreamChannel } = await import('../src/core.mjs');

  // Replacing an <iframe> restarts its stream, so the nine already playing must
  // keep their exact elements when a tenth is added.
  const before = ['xqc', 'adin', 'trainwesx'];
  const after = addMultistreamChannel(normalizeMultistream({ streams: before }), 'newone');
  const plan = planMultistreamTiles(before, after.value.streams);
  assert.deepEqual(plan.reuse, before, 'every existing tile must be reused');
  assert.deepEqual(plan.create, ['newone']);
  assert.deepEqual(plan.remove, [], 'adding a channel must never remove a tile');

  // Removing one drops exactly that tile and disturbs nothing else.
  const removed = planMultistreamTiles(['a', 'b', 'c'], ['a', 'c']);
  assert.deepEqual(removed.reuse, ['a', 'c']);
  assert.deepEqual(removed.create, []);
  assert.deepEqual(removed.remove, ['b']);

  // Reordering is not a reason to rebuild anything.
  const reordered = planMultistreamTiles(['a', 'b', 'c'], ['c', 'a', 'b']);
  assert.deepEqual(reordered.create, []);
  assert.deepEqual(reordered.remove, []);
  assert.deepEqual(reordered.order, ['c', 'a', 'b'], 'order follows the request');

  // A repeated slug must not plan two tiles for one channel.
  assert.deepEqual(planMultistreamTiles([], ['a', 'a']).create, ['a']);

  // Junk in either list never produces a tile.
  assert.deepEqual(planMultistreamTiles(undefined, undefined).create, []);
  assert.deepEqual(planMultistreamTiles(['a'], [null, '', 42]).remove, ['a']);

  // The invariant that matters, stated directly: nothing is ever in both.
  for (const [have, want] of [[['a', 'b'], ['b', 'c']], [[], ['a']], [['a'], []]]) {
    const result = planMultistreamTiles(have, want);
    const overlap = result.reuse.filter((slug) => result.remove.includes(slug));
    assert.deepEqual(overlap, [], 'a reused tile must never also be removed');
  }
});

test('exactly one tile is ever unmuted, across every reachable grid state', { tag: 'unit' }, async () => {
  const { normalizeMultistream, multistreamTileMuted } = await import('../src/core.mjs');

  // The rule is load-bearing: a nine-way grid that gets it wrong is nine
  // simultaneous audio streams. Assert it as a property, not one example.
  const streams = ['a', 'b', 'c', 'd'];
  for (const focus of streams) {
    for (const paused of [false, true]) {
      for (const muted of [false, true]) {
        const grid = normalizeMultistream({ streams, focus, paused, muted });
        const unmuted = grid.streams.filter((slug) => !multistreamTileMuted(grid, slug));
        const expected = paused || muted ? 0 : 1;
        assert.equal(
          unmuted.length,
          expected,
          `focus=${focus} paused=${paused} muted=${muted} produced ${unmuted.length} unmuted tiles`,
        );
        if (expected === 1) assert.equal(unmuted[0], grid.focus, 'the unmuted tile must be the focused one');
      }
    }
  }

  // An empty grid is silent rather than throwing.
  const empty = normalizeMultistream({ streams: [] });
  assert.equal(empty.streams.filter((slug) => !multistreamTileMuted(empty, slug)).length, 0);
});

test('pausing and muting the grid are separate controls', { tag: 'unit' }, async () => {
  const { normalizeMultistream, multistreamTileMuted } = await import('../src/core.mjs');

  const grid = normalizeMultistream({ streams: ['a', 'b', 'c'], focus: 'b' });
  assert.equal(grid.paused, false);
  assert.equal(grid.muted, false);

  // Exactly one tile carries audio, and it is the focused one.
  assert.equal(multistreamTileMuted(grid, 'b'), false);
  assert.equal(grid.streams.filter((s) => !multistreamTileMuted(grid, s)).length, 1);

  // Mute-all silences every tile without moving focus or chat — silencing the
  // grid must not also change which chat you are reading.
  const muted = normalizeMultistream({ ...grid, muted: true });
  assert.equal(muted.streams.every((s) => multistreamTileMuted(muted, s)), true);
  assert.equal(muted.focus, 'b');
  assert.equal(muted.chat, grid.chat);

  // Pause implies silence regardless of the mute flag.
  const paused = normalizeMultistream({ ...grid, paused: true });
  assert.equal(paused.streams.every((s) => multistreamTileMuted(paused, s)), true);

  // Both flags survive a persist/reload round-trip.
  const restored = normalizeMultistream(JSON.parse(JSON.stringify(normalizeMultistream({ ...grid, paused: true, muted: true }))));
  assert.equal(restored.paused, true);
  assert.equal(restored.muted, true);

  // Nonsense values fall back to playing rather than trapping the grid paused.
  const junk = normalizeMultistream({ streams: ['a'], paused: 'yes', muted: 1 });
  assert.equal(junk.paused, false);
  assert.equal(junk.muted, false);
});

test('suspended tiles unload, but never the one carrying audio', { tag: 'unit' }, async () => {
  const { normalizeMultistream, multistreamTileActive } = await import('../src/core.mjs');
  const grid = normalizeMultistream({ streams: ['a', 'b', 'c'], focus: 'b' });

  // Nothing suspended: every tile is loaded.
  assert.equal(grid.streams.every((s) => multistreamTileActive(grid, s, new Set())), true);

  // A suspended tile unloads.
  assert.equal(multistreamTileActive(grid, 'a', new Set(['a'])), false);
  assert.equal(multistreamTileActive(grid, 'c', new Set(['a'])), true);

  // The focused tile is exempt even when suspension covers everything —
  // cutting the audio someone is listening to costs more than it saves.
  assert.equal(multistreamTileActive(grid, 'b', new Set(['a', 'b', 'c'])), true);

  // Pause-all outranks the exemption: an explicit stop means stop.
  const paused = normalizeMultistream({ ...grid, paused: true });
  assert.equal(paused.streams.every((s) => multistreamTileActive(paused, s, new Set())), false);

  // Tolerates an array or nothing at all rather than throwing mid-render.
  assert.equal(multistreamTileActive(grid, 'a', ['a']), false);
  assert.equal(multistreamTileActive(grid, 'a', undefined), true);
  assert.equal(multistreamTileActive(null, 'a', new Set()), true);
});

test('export carries usage counts and layouts, and import validates them', { tag: 'unit' }, async () => {
  const { normalizeEmoteUsage } = await import('../src/core.mjs');

  // A full round-trip of everything the About page claims is stored.
  const payload = {
    schema: SETTINGS_SCHEMA,
    layout: { chatWidth: 410 },
    usage: { global: { '37226': { name: 'KEKW', count: 4, firstAt: 1, lastAt: 9 } }, channels: { xqc: { '37226': { name: 'KEKW', count: 3, lastAt: 9 } } } },
    multistream: { streams: ['a', 'b'], focus: 'b', layouts: [{ name: 'Crew', streams: ['a', 'b'] }] },
  };
  const result = validateImportedSettings(JSON.stringify(payload));
  assert.equal(result.ok, true);
  assert.equal(result.usage.global['37226'].count, 4);
  assert.equal(result.usage.channels.xqc['37226'].count, 3);
  assert.deepEqual(result.multistream.streams, ['a', 'b']);
  assert.equal(result.multistream.layouts[0].name, 'Crew');

  // Neither section is mistaken for junk any more.
  assert.equal(result.notes.some((n) => /unknown section "usage"/.test(n)), false);
  assert.equal(result.notes.some((n) => /unknown section "multistream"/.test(n)), false);

  // Wrong types are rejected with a message rather than crashing the import.
  assert.match(validateImportedSettings('{"usage":[]}').error, /usage counts must be a JSON object/);
  assert.match(validateImportedSettings('{"multistream":5}').error, /layouts must be a JSON object/);

  // Hostile counts are rebuilt, not merged: bad ids, negative and absurd
  // counts, and prototype keys are all dropped.
  const hostile = normalizeEmoteUsage({
    global: {
      'ok-1': { name: 'fine', count: 3 },
      'bad id!': { name: 'x', count: 1 },
      '__proto__': { name: 'x', count: 1 },
      'neg': { name: 'x', count: -5 },
      'huge': { name: 'x', count: 1e12 },
    },
    channels: { 'bad chan!': { a: { count: 1 } } },
  });
  assert.deepEqual(Object.keys(hostile.global).sort(), ['huge', 'ok-1']);
  assert.equal(hostile.global.huge.count, 1_000_000, 'counts are clamped');
  assert.deepEqual(Object.keys(hostile.channels), []);
  assert.equal(({}).count, undefined, 'no prototype pollution');

  // An import that drops entries says so instead of reporting a clean success.
  const lossy = validateImportedSettings(JSON.stringify({
    schema: SETTINGS_SCHEMA,
    multistream: { streams: Array.from({ length: 40 }, (_, i) => `c${i}`) },
  }));
  assert.ok(lossy.notes.some((n) => /multi-stream grid to 9 supported channels/.test(n)));
});
