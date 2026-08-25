import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  DISCOVERY_LAYOUT_KEYS,
  DISCOVERY_LAYOUT_MAX,
  applyDiscoveryLayout,
  buildDiscoveryLayout,
  layoutForRoute,
  layoutMatchesSettings,
  normalizeDiscoveryLayouts,
  CHAT_HISTORY_LIMITS,
  CHAT_HISTORY_MAX_TEXT,
  MENTION_SOUND_GAP_MS,
  appendChatEntry,
  buildChatHistoryExport,
  dropChatMessage,
  formatChatTime,
  floatingPreviewPosition,
  advanceSessionWatchTime,
  sessionWatchCandidateState,
  selectSessionWatchOwner,
  sessionWatchElapsed,
  formatSessionWatchTime,
  isPriorityPerson,
  parsePeopleList,
  pruneChatHistory,
  searchChatHistory,
  shouldPlayMentionSound,
  COMPOSER_RECALL_LIMIT,
  appendComposerRecall,
  composerRecallAt,
  isComposerRecallGesture,
  VIEWER_HUB_CARDS,
  earnedState,
  VIEWER_HUB_STALE_MS,
  viewerHubCards,
  viewerHubSummary,
  isAdPreflightScript,
  SETTINGS_SCHEMA,
  approximateStorageBytes,
  describeStorageFailures,
  formatBytes,
  settingsFocusSelector,
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
  compactPresence,
  mergePresence,
  presenceOffer,
  PRESENCE_TTL_MS,
  evictStickerLibrary,
  STICKER_LIBRARY_LIMIT,
  normalizeSettings,
  chatWidthAfterDrag,
  applyViewingPreset,
  colorContrastRatio,
  customAccentTokens,
  normalizeCustomAccent,
  STICKER_PREFERENCES_SCHEMA,
  FAVORITES_PER_SCOPE_LIMIT,
  favoriteScope,
  favoritesForChannel,
  isStickerFavorite,
  toggleStickerFavorite,
  moveStickerFavorite,
  routeKind,
  streamerStatsProfileUrl,
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
  emoteReach,
  ownedEmoteGroups,
  appendMergedMessage,
  completionWouldBounce,
  dropMergedChannel,
  formatUptime,
  formatVodRetention,
  vodExpiry,
  VOD_RETENTION_DAYS,
  MAX_UPTIME_MS,
  insertionPlanFor,
  recordApplyCost,
  applyCostSummary,
  findKeywordSpans,
  findShortcutConflict,
  planStorageCommit,
  topmostOverlayLayer,
  OVERLAY_LAYERS,
  HIDEABLE_ELEMENTS,
  HIDEABLE_GROUPS,
  normalizeHiddenElements,
  qualityRank,
  bestQualityOption,
  qualitySessionValue,
  pluralForm,
  sanitizeErrorMessage,
  monetizationKind,
  rankEmoteUsage,
  recentEmoteUsage,
  visibleWindow,
  EMOTE_WINDOW_SIZE,
  cardSlugFromPath,
  emoteTriggerAt,
  rankEmoteCompletions,
  CLAIM_ACTION,
  CLAIM_RECHECK_MS,
  CLAIM_RESET_HOUR,
  decideRewardClaim,
  nextClaimResetAt,
  nextRewardCheckAt,
  parseClaimCountdown,
  updateNotice,
  normalizeVersion,
  rankSettingsMatches,
  observedChannelPath,
  diagnosticSettingsDiff,
  normalizeMediaPreferences,
  normalizeChannelLayouts,
} from '../src/core.mjs';

test('settings focus returns to the exact option after a re-render', { tag: 'unit' }, () => {
  const attributes = new Map([
    ['data-set', 'appearance.theme'],
    ['data-value', 'slate'],
  ]);
  const control = { getAttribute: (name) => attributes.has(name) ? attributes.get(name) : null };
  assert.equal(settingsFocusSelector(control), '[data-set="appearance.theme"][data-value="slate"]');
});

// The dialog is open and the reward is ready — the only state that clicks.
const READY = { enabled: true, hasTrigger: true, dialogOpen: true, hasAction: true, actionDisabled: false, now: 1_000_000 };
/** A local wall-clock instant, so the reset arithmetic is read as a person reads it. */
const at = (hour, minute = 0, day = 12) => new Date(2026, 7, day, hour, minute, 0, 0).getTime();
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

test('a reward is claimed only when Kick itself says it is ready', { tag: 'unit' }, () => {
  assert.equal(decideRewardClaim(READY).action, 'claim');

  // Every way Kick says no. A disabled button is a refusal, and the whole
  // safety of this feature is that it is obeyed rather than worked around.
  assert.equal(decideRewardClaim({ ...READY, actionDisabled: true }).action, 'wait');
  assert.equal(decideRewardClaim({ ...READY, hasAction: false }).action, 'wait');
  assert.equal(decideRewardClaim({ ...READY, hasTrigger: false }).action, 'absent');
  assert.equal(decideRewardClaim({ ...READY, enabled: false }).action, 'absent');
  // Unknown input must never resolve to a click.
  assert.equal(decideRewardClaim().action, 'absent');
  assert.equal(decideRewardClaim({ enabled: true, hasTrigger: true, dialogOpen: true }).action, 'wait');
});

test('the setting is what gates it, not the presence of a button', { tag: 'unit' }, () => {
  // Off means the dialog is never even opened, on a page that is showing a
  // ready reward — the strongest form of the guarantee.
  assert.deepEqual(decideRewardClaim({ ...READY, enabled: false }), { action: 'absent', reason: 'off' });
  assert.deepEqual(decideRewardClaim({ ...READY, enabled: false, dialogOpen: false }), { action: 'absent', reason: 'off' });
});

test('one stored time decides whether to look, and nothing else', { tag: 'unit' }, () => {
  const base = { enabled: true, hasTrigger: true, dialogOpen: false, now: at(15) };
  assert.equal(decideRewardClaim(base).action, 'open', 'no schedule yet, so look now');
  assert.deepEqual(decideRewardClaim({ ...base, nextCheckAt: at(15, 1) }), { action: 'cooling', reason: 'not-due' });
  assert.equal(decideRewardClaim({ ...base, nextCheckAt: at(14, 59) }).action, 'open');
  // Exactly due counts as due, so a schedule can never stall one tick short.
  assert.equal(decideRewardClaim({ ...base, nextCheckAt: at(15) }).action, 'open');
});

test('the rollover is the next 8pm, today or tomorrow', { tag: 'unit' }, () => {
  assert.equal(nextClaimResetAt(at(15)), at(CLAIM_RESET_HOUR), 'afternoon waits for tonight');
  assert.equal(nextClaimResetAt(at(19, 59)), at(CLAIM_RESET_HOUR), 'a minute before, still tonight');
  // On the boundary the rollover has happened, so the next one is tomorrow —
  // otherwise a claim made at exactly 8pm would schedule itself into the past.
  assert.equal(nextClaimResetAt(at(20)), at(CLAIM_RESET_HOUR, 0, 13));
  assert.equal(nextClaimResetAt(at(23, 30)), at(CLAIM_RESET_HOUR, 0, 13), 'late night waits for tomorrow');
  assert.equal(nextClaimResetAt(at(2)), at(CLAIM_RESET_HOUR), 'after midnight is still today’s rollover');
});

test('a claimed reward sleeps to the rollover instead of being re-checked', { tag: 'unit' }, () => {
  // The trigger stays in Kick's header after a claim, so without this the
  // dialog would reopen every ten minutes for the rest of the day.
  assert.equal(nextRewardCheckAt({ outcome: 'claimed', now: at(21, 5) }), at(CLAIM_RESET_HOUR, 0, 13));
  assert.equal(nextRewardCheckAt({ outcome: 'claimed', now: at(9) }), at(CLAIM_RESET_HOUR));
});

test('a reward already collected by hand also sleeps to the rollover', { tag: 'unit' }, () => {
  // What an already-taken reward looks like: the dialog renders, but there is
  // no action to press and nothing counting down. Re-checking that all day is
  // exactly the polling this replaces.
  assert.equal(
    nextRewardCheckAt({ outcome: 'not-ready', now: at(14), minutesRemaining: null, dialogText: 'Come back tomorrow' }),
    at(CLAIM_RESET_HOUR),
  );
  // An *empty* dialog is a render race, not an answer — that one is retried.
  assert.equal(
    nextRewardCheckAt({ outcome: 'not-ready', now: at(14), minutesRemaining: null, dialogText: '   ' }),
    at(14) + CLAIM_RECHECK_MS,
  );
});

test('Kick’s own countdown sets the next check, not a fixed interval', { tag: 'unit' }, () => {
  // "Watch 54 more minutes" → look again in 55, not in 10.
  const soon = nextRewardCheckAt({ outcome: 'not-ready', now: at(15), minutesRemaining: 54 });
  assert.equal(soon, at(15, 55));
  assert.ok(soon - at(15) > CLAIM_RECHECK_MS, 'and that is longer than the fallback poll');

  // Never past the rollover, which also absorbs a nonsense figure.
  assert.equal(nextRewardCheckAt({ outcome: 'not-ready', now: at(19, 30), minutesRemaining: 600 }), at(CLAIM_RESET_HOUR));
  assert.equal(nextRewardCheckAt({ outcome: 'not-ready', now: at(15), minutesRemaining: 99_999 }), at(CLAIM_RESET_HOUR));
});

test('the whole nightly cycle: claim, sleep to 8pm, wake, claim near 9pm', { tag: 'unit' }, () => {
  // This is the shape the schedule exists to produce, end to end.
  const claimed = nextRewardCheckAt({ outcome: 'claimed', now: at(21, 30) });
  assert.equal(clock(claimed), clock(at(CLAIM_RESET_HOUR, 0, 13)), 'sleeps to tomorrow’s rollover');

  // It wakes at the rollover and Kick says roughly an hour of watch time is
  // still needed, so the next look lands near nine — without "9pm" appearing
  // anywhere: the rollover schedules the wake, the countdown schedules the claim.
  const woke = at(CLAIM_RESET_HOUR, 0, 13);
  const afterCountdown = nextRewardCheckAt({ outcome: 'not-ready', now: woke, minutesRemaining: 60 });
  assert.equal(clock(afterCountdown), clock(at(21, 1, 13)));

  // And at that point the reward is ready, so it is claimed and sleeps again.
  assert.equal(decideRewardClaim({ ...READY, now: afterCountdown, nextCheckAt: afterCountdown }).action, 'claim');

  // Across the whole day that is three dialog openings, not one every ten
  // minutes — which would be well over a hundred.
  const pollCount = (24 * 60) / (CLAIM_RECHECK_MS / 60_000);
  assert.ok(pollCount > 100, `the fixed-interval alternative would be ${pollCount} openings a day`);
});

test('the countdown Kick renders is read back, and nothing else is', { tag: 'unit' }, () => {
  assert.equal(parseClaimCountdown('Watch 54 more minutes to claim'), 54);
  assert.equal(parseClaimCountdown('watch 1 more minute to claim'), 1);
  assert.equal(parseClaimCountdown('  Watch   7   more   minutes to claim  '), 7);
  for (const text of ['Claim', '', null, undefined, 'Watch more minutes to claim', 'Watch soon']) {
    assert.equal(parseClaimCountdown(text), null, `${String(text)} carries no countdown`);
  }
});

test('the action button is recognised by every verb the reward uses', { tag: 'unit' }, () => {
  // It is a roulette reveal, so the label varies by reward.
  for (const label of ['Claim', 'Open', 'Spin', 'Reveal', 'Collect', '  claim ', 'Claim reward']) {
    assert.ok(CLAIM_ACTION.test(label), `${JSON.stringify(label)} is an action button`);
  }
  // And not by anything else in the same dialog.
  for (const label of ['Cancel', 'Close', 'Reclaim', 'Claimed', 'Watch 54 more minutes to claim', '']) {
    assert.ok(!CLAIM_ACTION.test(label), `${JSON.stringify(label)} is not an action button`);
  }
});

test('a colon only triggers completion where it starts a token', { tag: 'unit' }, () => {
  assert.deepEqual(emoteTriggerAt(':pep'), { query: 'pep', length: 4 });
  assert.deepEqual(emoteTriggerAt('hello :pep'), { query: 'pep', length: 4 });
  assert.deepEqual(emoteTriggerAt('hello :PepeH'), { query: 'PepeH', length: 6 });

  // One letter matches most of a library, so it is not worth a list.
  assert.equal(emoteTriggerAt(':p'), null);
  assert.equal(emoteTriggerAt(':'), null);

  // A colon inside a word is not a trigger — a URL is the case that matters,
  // because a completion list over someone pasting a link is pure noise.
  assert.equal(emoteTriggerAt('https:'), null);
  assert.equal(emoteTriggerAt('https://kick.com/xqc'), null);
  assert.equal(emoteTriggerAt('time is 10:30'), null);
  // And the trigger has to be at the caret, not somewhere behind it.
  assert.equal(emoteTriggerAt(':pep hello'), null);
  assert.equal(emoteTriggerAt(''), null);
  assert.equal(emoteTriggerAt(null), null);
});

test('a name that starts with the query outranks one that merely contains it', { tag: 'unit' }, () => {
  // Chatterino #1962: typing the start of an emote name surfaced everything
  // containing those letters ahead of the emote actually named that way.
  const candidates = [
    { key: 'k:1', id: '1', name: 'MonkaPepe' },
    { key: 'k:2', id: '2', name: 'PepeHands' },
    { key: 'k:3', id: '3', name: 'Pepega' },
    { key: 'k:4', id: '4', name: 'FeelsPepeMan' },
  ];
  // Prefix matches first (shorter name breaking the tie), then the substring
  // matches, again shortest first.
  assert.deepEqual(rankEmoteCompletions('pep', candidates).map((entry) => entry.name),
    ['Pepega', 'PepeHands', 'MonkaPepe', 'FeelsPepeMan']);
  // Prefix beats substring even when the substring match is far more used.
  const usage = { global: { 1: { count: 900 } }, channels: {} };
  assert.equal(rankEmoteCompletions('pep', candidates, { usage })[0].name, 'Pepega');
});

test('completions are ordered by what this user actually sends, here first', { tag: 'unit' }, () => {
  const candidates = [
    { key: 'k:1', id: '1', name: 'PepeLaugh' },
    { key: 'k:2', id: '2', name: 'PepeHands' },
    { key: 'k:3', id: '3', name: 'PepeD' },
  ];
  const usage = {
    global: { 1: { count: 5 }, 2: { count: 90 } },
    channels: { xqc: { 1: { count: 40 } } },
  };
  // In this channel, PepeLaugh; anywhere else, the one used far more overall.
  assert.deepEqual(rankEmoteCompletions('pepe', candidates, { usage, channel: 'xqc' }).map((entry) => entry.name),
    ['PepeLaugh', 'PepeHands', 'PepeD']);
  assert.deepEqual(rankEmoteCompletions('pepe', candidates, { usage }).map((entry) => entry.name),
    ['PepeHands', 'PepeLaugh', 'PepeD']);
  // A favorite outranks both, because it is the one the user marked by hand.
  assert.equal(rankEmoteCompletions('pepe', candidates, { usage, channel: 'xqc', favorites: new Set(['k:3']) })[0].name, 'PepeD');
});

test('two emotes with the same name resolve deterministically, never by luck', { tag: 'unit' }, () => {
  // Chatterino #3440: the same name published by two providers. Both are
  // offered — they are different images — and the order cannot flap.
  const candidates = [
    { key: 'kick:id:20', id: '20', name: 'Clap' },
    { key: 'kick:id:10', id: '10', name: 'Clap' },
    { key: 'kick:id:30', id: '30', name: 'ClapPepe' },
  ];
  const first = rankEmoteCompletions('clap', candidates).map((entry) => entry.key);
  assert.deepEqual(first, ['kick:id:20', 'kick:id:10', 'kick:id:30'],
    'equal names keep input order; the longer name sorts last');
  assert.deepEqual(rankEmoteCompletions('clap', candidates).map((entry) => entry.key), first);

  // One entry per storage key: the same emote seen twice is offered once.
  const duplicated = [...candidates, { key: 'kick:id:20', id: '20', name: 'Clap' }];
  assert.equal(rankEmoteCompletions('clap', duplicated).length, 3);
});

test('only a name chat would treat as one token is ever offered', { tag: 'unit' }, () => {
  const candidates = [
    { key: 'k:1', id: '1', name: 'GoodName' },
    { key: 'k:2', id: '2', name: '[emote:123:GoodName]' },
    { key: 'k:3', id: '3', name: 'good name' },
    { key: 'k:4', id: '4', name: '' },
    { key: 'k:5', id: '5' },
    'not-an-object',
  ];
  assert.deepEqual(rankEmoteCompletions('good', candidates).map((entry) => entry.name), ['GoodName']);
  assert.deepEqual(rankEmoteCompletions('', candidates), []);
  assert.deepEqual(rankEmoteCompletions('good', null), []);
  assert.deepEqual(rankEmoteCompletions('good', candidates, { limit: 0 }), []);
});

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

test('a discovery card yields a channel only when it actually points at one', { tag: 'unit' }, () => {
  assert.equal(cardSlugFromPath('/xqc'), 'xqc');
  assert.equal(cardSlugFromPath('/xqc/videos'), 'xqc');
  assert.equal(cardSlugFromPath('/xqc?ref=browse'), 'xqc');
  assert.equal(cardSlugFromPath('/xqc#chat'), 'xqc');
  assert.equal(cardSlugFromPath('https://kick.com/xqc'), 'xqc');
  assert.equal(cardSlugFromPath('https://www.kick.com/xqc/videos'), 'xqc');

  // Kick's own surfaces wear the same card markup; none of them is a channel.
  for (const path of ['/browse', '/category/just-chatting', '/search?query=x', '/following', '/drops', '/videos/abc']) {
    assert.equal(cardSlugFromPath(path), '', `${path} is not a channel`);
  }

  // The return value feeds a grid of embedded players, so a foreign host and a
  // path-shaped attack both have to come back empty.
  for (const path of ['https://evil.example/xqc', 'https://kick.com.evil.net/xqc', '//evil.example/xqc',
    '/../admin', '/-leading', '/a b', '', null, undefined, '/']) {
    assert.equal(cardSlugFromPath(path), '', `${String(path)} yields no channel`);
  }

  // Kick accepts an all-digit channel name, so this must not be mistaken for an
  // id and thrown away.
  assert.equal(cardSlugFromPath('/1337'), '1337');
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

  // Compaction is what bounds the stored array. Every tab opens the presence
  // channel at boot and only the tab that opens the grid ever reset it, so a
  // tab left on a channel page grew one entry per answer to every roll-call
  // anybody else made, for as long as it stayed open.
  const noisy = [];
  for (let round = 0; round < 200; round += 1) {
    noisy.push({ slug: 'xqc', ts: fresh + round });
    noisy.push({ slug: 'adin_ross', ts: fresh + round });
    noisy.push({ slug: '../evil', ts: fresh + round });
  }
  const compact = compactPresence(noisy, now);
  assert.equal(compact.length, 2, `600 answers compacted to ${compact.length} entries`);
  assert.deepEqual(compact.map((entry) => entry.slug), ['adin_ross', 'xqc']);
  // The newest timestamp survives, so the entry expires from the latest answer.
  assert.equal(compact.find((entry) => entry.slug === 'xqc').ts, fresh + 199);
  // And compacting is idempotent, so pushing onto an already-compacted array
  // cannot grow it.
  assert.deepEqual(compactPresence(compact, now), compact);
  assert.deepEqual(mergePresence(noisy, now), compactPresence(noisy, now).map((entry) => entry.slug));

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
  assert.match(shadowed.warning, /shadows PogChamp\. Typing it sends bigchannel/);
  // A collision with no recorded winner still warns without inventing one.
  assert.match(insertionPlanFor({ name: 'PogChamp' }, [{ name: 'PogChamp' }], 'channel').warning, /may send a different emote/);
  // Locked outranks shadowed: "you cannot send this" is the more useful fact.
  assert.match(insertionPlanFor({ name: 'PogChamp' }, collisions, 'locked').warning, /subscriber-only/);
});

/** No field of a plan may carry the emote id, in any form. */
function plan_has_no_id(plan) {
  return !JSON.stringify(plan).includes('4821');
}

test('an emote says where it can be sent, or says nothing at all', { tag: 'unit' }, () => {
  // Reach is not access. Measured 2026-08-16 by posting each kind into a real
  // chatroom: a free channel emote is refused outside its channel
  // (FOREIGN_CHANNEL_EMOTE_ERROR), an owned subscriber emote is accepted
  // everywhere. Kick's own interface states neither.
  assert.deepEqual(emoteReach({ usableEverywhere: true }), { text: 'Works in every chat', channel: '' });
  assert.deepEqual(emoteReach({ usableEverywhere: false, sourceSlug: 'xqc' }), {
    // The channel is returned separately: interpolating it here would produce a
    // string no dictionary can match, and the i18n gate only scans literals.
    text: 'Only works in {channel}’s chat',
    channel: 'xqc',
  });
  assert.deepEqual(emoteReach({ usableEverywhere: false }), { text: 'Only works in its own channel', channel: '' });

  // An emote the account cannot send says nothing about reach. Kick's flag still
  // reads platform-wide — that is what a subscriber emote is to a subscriber —
  // and printing it beside "Subscriber-only" told someone who cannot send it at
  // all that it works everywhere. Seen on real account data before it shipped.
  assert.deepEqual(emoteReach({ usableEverywhere: true, usableHere: false }), { text: '', channel: '' });

  // Not established — a chat-only observation, or a record written before this
  // was known. Silence is the honest answer; a guess would read as measurement.
  assert.equal(emoteReach({ name: 'seen-in-chat-only' }).text, '');
  assert.equal(emoteReach(null).text, '');

  // The hover card carries it, so chat and the library cannot disagree.
  assert.deepEqual(
    emoteTooltipText({ name: 'xqcLK', nativeGroups: ['xqc'], access: 'channel', usableEverywhere: false, sourceSlug: 'xqc' }, [], false),
    ['xqcLK', 'xqc · Channel-only', 'Only works in xqc’s chat', 'Click to save'],
  );
});

test('owned emotes are grouped by source without mistaking local reach for ownership', { tag: 'unit' }, () => {
  const groups = ownedEmoteGroups([
    { key: 'kick:3', name: 'GlobalB', access: 'available', usableEverywhere: true, nativeGroups: ['Collectibles'] },
    { key: 'kick:2', name: 'ChannelB', access: 'available', usableEverywhere: true, sourceSlug: 'peyx', nativeGroups: ['Peyx'] },
    { key: 'kick:1', name: 'ChannelA', access: 'available', usableEverywhere: true, sourceSlug: 'peyx', nativeGroups: ['Peyx'] },
    { key: 'kick:4', name: 'LocalFree', access: 'channel', usableEverywhere: false, sourceSlug: 'peyx' },
    { key: 'kick:5', name: 'Locked', access: 'locked', usableEverywhere: true, sourceSlug: 'xqc' },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.label), ['Collectibles', 'peyx']);
  assert.deepEqual(groups[1].entries.map((entry) => entry.name), ['ChannelA', 'ChannelB']);
  assert.equal(groups.flatMap((group) => group.entries).some((entry) => entry.name === 'LocalFree'), false);
  assert.deepEqual(ownedEmoteGroups(null), []);
});

test('uptime counts from Kick own start time and refuses implausible values', { tag: 'unit' }, () => {
  const now = Date.UTC(2026, 7, 16, 12, 0, 0);
  assert.equal(formatUptime(now - 45_000, now), '0:45');
  assert.equal(formatUptime(now - 5 * 60_000 - 7000, now), '5:07');
  // Past an hour the minutes pad, so the clock stops jumping between widths.
  assert.equal(formatUptime(now - (3 * 3600 + 4 * 60 + 9) * 1000, now), '3:04:09');
  assert.equal(formatUptime(now - 3600_000, now), '1:00:00');

  // Nothing to report rather than a zero or a NaN clock.
  assert.equal(formatUptime(0, now), '');
  assert.equal(formatUptime(undefined, now), '');
  assert.equal(formatUptime(Number.NaN, now), '');

  // A start in the future is bad data, not a negative duration.
  assert.equal(formatUptime(now + 60_000, now), '');

  // A stale start_time on a re-used livestream record would otherwise render a
  // clock counting into the hundreds of hours, which reads as a bug here rather
  // than as bad data from Kick.
  assert.equal(formatUptime(now - MAX_UPTIME_MS - 1, now), '');
  assert.notEqual(formatUptime(now - MAX_UPTIME_MS + 1000, now), '');
});

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
    'Name shadowed. Typing it sends bigchannel',
    'Click to save',
  ]);

  // Already saved: the last line changes, so the card reports state rather than
  // offering an action that has already happened.
  assert.equal(emoteTooltipText(entry, collisions, true).at(-1), 'Saved. Click to open in the library');

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

test('a blocklist URL carrying credentials is refused, not carried', { tag: 'unit' }, () => {
  // On a userscript-only install this value goes out through GM_xmlhttpRequest
  // under @connect *, so credentials in it are credentials sent to whatever host
  // the URL names. The four extension copies of this rule refused them and this
  // one did not, which also meant the settings panel could show a configured
  // feed while the companion reported none.
  assert.equal(normalizeBlocklistUrl('https://user:pass@example.com/list.json'), '');
  assert.equal(normalizeBlocklistUrl('https://user@example.com/list.json'), '');
  assert.equal(normalizeBlocklistUrl('https://:pass@example.com/list.json'), '');

  // The fragment never reaches the server, and leaving it on made the redirect
  // recheck in the companion compare two strings that could differ for nothing.
  assert.equal(normalizeBlocklistUrl('https://example.com/list.json#frag'), 'https://example.com/list.json');
  assert.equal(normalizeBlocklistUrl('https://example.com/list.json?a=1'), 'https://example.com/list.json?a=1');

  // Everything the rule already refused, still refused.
  for (const hostile of ['http://example.com/l.json', 'javascript:alert(1)', 'data:application/json,{}',
    'file:///etc/passwd', 'not a url', '', `https://example.com/${'a'.repeat(2100)}`]) {
    assert.equal(normalizeBlocklistUrl(hostile), '', `accepted ${JSON.stringify(hostile.slice(0, 40))}`);
  }
  assert.equal(normalizeBlocklistUrl('  https://example.com/list.json  '), 'https://example.com/list.json');
});

test('an imported file cannot switch on a subscription to a host the user has not seen', { tag: 'unit' }, () => {
  // Every other field in a settings file is local. This one becomes a repeating
  // outbound request under the userscript's @connect * grant, so a shared
  // "settings pack" was a way to point somebody's browser at your server and
  // have the UI say only "Settings imported."
  const hostile = JSON.stringify({
    schema: SETTINGS_SCHEMA,
    content: { blocklistSubscription: true, blocklistUrl: 'https://attacker.example/list.json' },
  });

  const guarded = validateImportedSettings(hostile, { currentBlocklistUrl: '', currentBlocklistSubscription: false });
  assert.ok(guarded.ok);
  assert.equal(guarded.value.content.blocklistSubscription, false, 'the file armed a fetch to an unknown host');
  // The URL still lands, so the user can read it and turn it on deliberately.
  assert.equal(guarded.value.content.blocklistUrl, 'https://attacker.example/list.json');
  assert.ok(guarded.notes.some((note) => note.includes('attacker.example')),
    `no note named the host: ${JSON.stringify(guarded.notes)}`);

  // Importing the same file again is the whole attack. The first import writes
  // the file's URL into settings by design, so a guard that trusted "the URL
  // already in settings" would see its own address the second time, call it
  // familiar, and arm with no note. Trust is a *subscribed* URL, not a stored
  // one, so this stays refused however many times it is run.
  let current = { url: guarded.value.content.blocklistUrl, subscribed: guarded.value.content.blocklistSubscription };
  for (let attempt = 2; attempt <= 4; attempt += 1) {
    const again = validateImportedSettings(hostile, {
      currentBlocklistUrl: current.url,
      currentBlocklistSubscription: current.subscribed,
    });
    assert.equal(again.value.content.blocklistSubscription, false,
      `import ${attempt} of the same file armed the subscription`);
    assert.ok(again.notes.some((note) => note.includes('attacker.example')),
      `import ${attempt} armed nothing but also said nothing`);
    current = { url: again.value.content.blocklistUrl, subscribed: again.value.content.blocklistSubscription };
  }

  // A profile that is already subscribed to that host re-imports losslessly:
  // this is the ordinary export and restore, and the user has already agreed.
  const sameHost = validateImportedSettings(hostile, {
    currentBlocklistUrl: 'https://attacker.example/list.json',
    currentBlocklistSubscription: true,
  });
  assert.equal(sameHost.value.content.blocklistSubscription, true);
  assert.ok(!sameHost.notes.some((note) => note.includes('switched off')));

  // A URL stored but not subscribed to is not an approval.
  const storedNotSubscribed = validateImportedSettings(hostile, {
    currentBlocklistUrl: 'https://attacker.example/list.json',
    currentBlocklistSubscription: false,
  });
  assert.equal(storedNotSubscribed.value.content.blocklistSubscription, false);

  // And the undo path restores a state the user was already in.
  const restored = validateImportedSettings(hostile, { currentBlocklistUrl: '', trusted: true });
  assert.equal(restored.value.content.blocklistSubscription, true);

  // A file that leaves the subscription off is not a beacon and needs no note.
  const off = validateImportedSettings(JSON.stringify({
    schema: SETTINGS_SCHEMA,
    content: { blocklistSubscription: false, blocklistUrl: 'https://attacker.example/list.json' },
  }), { currentBlocklistUrl: '' });
  assert.equal(off.value.content.blocklistSubscription, false);
  assert.ok(!off.notes.some((note) => note.includes('switched off')));
});

test('a subscription cannot outlive the URL it points at', { tag: 'unit' }, () => {
  // Refusing credentials blanks a URL somebody already had saved. Leaving the
  // switch on beside an empty field pinned the sync in a permanent error state
  // with nothing on screen to explain it, so the switch goes with the URL.
  const migrated = normalizeSettings({
    content: { blocklistSubscription: true, blocklistUrl: 'https://user:pass@feeds.example/list.json' },
  });
  assert.equal(migrated.content.blocklistUrl, '');
  assert.equal(migrated.content.blocklistSubscription, false, 'a subscription survived its URL being rejected');

  // A URL that still normalises keeps its subscription.
  const kept = normalizeSettings({
    content: { blocklistSubscription: true, blocklistUrl: 'https://feeds.example/list.json' },
  });
  assert.equal(kept.content.blocklistUrl, 'https://feeds.example/list.json');
  assert.equal(kept.content.blocklistSubscription, true);

  // Anything the rule refuses takes the switch with it, not just credentials.
  assert.equal(
    normalizeSettings({ content: { blocklistSubscription: true, blocklistUrl: 'not a url' } })
      .content.blocklistSubscription,
    false,
  );

  // But an *absent* URL is not a rejected one. `updateSetting` sends the whole
  // settings object back through normalizeSettings on every change, and the
  // panel lists the switch above the URL field, so a rule that cleared the flag
  // whenever the URL was empty made the ordinary top-to-bottom sequence
  // impossible: the switch snapped back to Off under the pointer and the feed
  // could never be turned on at all. This walks that sequence.
  let live = normalizeSettings({});
  assert.equal(live.content.blocklistSubscription, false, 'a fresh profile is not subscribed');
  live = normalizeSettings({ ...live, content: { ...live.content, blocklistSubscription: true } });
  assert.equal(live.content.blocklistSubscription, true, 'the switch would not stay on with the field still empty');
  live = normalizeSettings({ ...live, content: { ...live.content, blocklistUrl: 'https://feeds.example/l.json' } });
  assert.equal(live.content.blocklistSubscription, true, 'pasting the URL turned the switch back off');
  assert.equal(live.content.blocklistUrl, 'https://feeds.example/l.json');

  // Whitespace is still a user part-way through typing, not a rejection.
  assert.equal(
    normalizeSettings({ content: { blocklistSubscription: true, blocklistUrl: '   ' } })
      .content.blocklistSubscription,
    true,
  );
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
  assert.equal(normalizeSettings({ layout: { chat: 'left' } }).layout.chat, 'left');
  assert.equal(normalizeSettings({ layout: { chat: 'upside-down' } }).layout.chat, 'right');
});

test('chat separator drag grows away from the player on either side', { tag: 'unit' }, () => {
  assert.equal(chatWidthAfterDrag('right', 410, 900, 830), 480);
  assert.equal(chatWidthAfterDrag('left', 410, 340, 410), 480);
  assert.equal(chatWidthAfterDrag('right', 500, 900, 700), 520);
  assert.equal(chatWidthAfterDrag('left', 340, 340, 200), 320);
});

test('custom accents stay visible across every dark theme surface', { tag: 'unit' }, () => {
  assert.equal(normalizeCustomAccent('#2a0030'), '#FF5CA8', 'a dark picker value must not erase focus rings');
  assert.equal(normalizeCustomAccent('#38d7d0'), '#38D7D0');
  assert.equal(normalizeCustomAccent('not-a-color'), '#FF5CA8');
  const tokens = customAccentTokens('#38d7d0');
  assert.deepEqual(tokens, { hex: '#38D7D0', rgb: '56, 215, 208', onAccent: '#000000' });
  // This list used to be three near-black values, and the reasoning written
  // beside it was backwards: it called them "the darkest surface per theme" and
  // treated that as the hard case. A bright accent has its easiest contrast
  // against black. The hard cases are the raised panels and hover states the
  // accent is also drawn on, so those are what the gate has to sample. Values
  // are the --kf-panel-high and --kf-surface-hover tokens from SITE_CSS.
  for (const surface of ['#000000', '#18201b', '#171f1a', '#0e1110', '#111613', '#1c2934', '#263544']) {
    assert.ok(colorContrastRatio(tokens.hex, surface) >= 3,
      `an accepted accent must clear 3:1 against ${surface}, got ${colorContrastRatio(tokens.hex, surface).toFixed(2)}`);
    assert.ok(colorContrastRatio(normalizeCustomAccent('#2a0030'), surface) >= 3,
      `the safe fallback must clear 3:1 against ${surface}`);
  }
  // The CSS half is a fallback beside the JS gate, not a replacement, so the
  // ink the tokens carry has to remain the better of the two choices on its own.
  assert.ok(colorContrastRatio(tokens.hex, tokens.onAccent) >= colorContrastRatio(tokens.hex, '#FFFFFF'));
  const middle = customAccentTokens('#787878');
  assert.equal(middle.onAccent, '#000000');
  assert.ok(colorContrastRatio(middle.hex, middle.onAccent) >= 4.5);

  const normalized = normalizeSettings({ appearance: { accent: 'custom', customAccent: '#2a0030' } });
  assert.equal(normalized.appearance.accent, 'custom');
  assert.equal(normalized.appearance.customAccent, '#FF5CA8');

  // A worked example of what the old near-black-only list let through: this
  // violet clears 3:1 on all three of those surfaces and lands at 2.22:1 on
  // Slate's hover surface, where the focus ring is drawn.
  assert.equal(normalizeCustomAccent('#6a4fd8'), '#FF5CA8',
    'an accent that disappears on a raised surface must not be accepted');
});

test('viewing presets change layout and style without touching content choices', { tag: 'unit' }, () => {
  const starting = normalizeSettings({
    layout: { hidden: ['player-clip'] },
    content: { hideCasino: true, hiddenChannels: ['/quiet-channel'] },
    accessibility: { reduceMotion: true },
  });
  const cinema = applyViewingPreset(starting, 'cinema');
  assert.equal(cinema.layout.sidebar, 'hidden');
  assert.equal(cinema.layout.chat, 'hidden');
  assert.equal(cinema.appearance.theme, 'oled');
  assert.deepEqual(cinema.layout.hidden, ['player-clip']);
  assert.equal(cinema.content.hideCasino, true);
  assert.deepEqual(cinema.content.hiddenChannels, ['/quiet-channel']);
  assert.equal(cinema.accessibility.reduceMotion, true);
  assert.deepEqual(applyViewingPreset(starting, 'unknown'), starting);
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

  // Measured on a signed-in channel page 2026-08-16: these two are the only
  // spend surfaces Poor mode left standing. Neither is a control — the balance
  // is a <span> whose text is just the number, and the shop is a panel — so
  // both are identified by test id and nothing else.
  assert.equal(monetizationKind({ testId: 'kicks-value', text: '0' }), 'currency');
  assert.equal(monetizationKind({ testId: 'gift-shop-panel' }), 'gift');

  // The balance's sibling is the free channel-points counter, which reads the
  // same way and must not be swept up with it.
  assert.equal(monetizationKind({ testId: 'channel-points-value', text: '80' }), '');
  assert.equal(monetizationKind({ testId: 'channel-points-button' }), '');

  // Poor mode must leave free/community actions intact and never classify a
  // chat sentence just because it happens to mention a purchase word.
  assert.equal(monetizationKind({ text: 'Follow', testId: 'follow-button' }), '');
  assert.equal(monetizationKind({ text: 'Claim Your Daily Reward' }), '');
  // Kick shipped Unban Request around 2026-08-07: a banned reader's composer is
  // replaced by this control, and it is the only way back into that chat. Poor
  // mode hides exactly what this classifier tags, so the whole guarantee that
  // Kick Focus cannot take it away is that none of its spellings classify.
  assert.equal(monetizationKind({ text: 'Request Unban' }), '');
  assert.equal(monetizationKind({ text: 'Request unban', testId: 'request-unban-button' }), '');
  assert.equal(monetizationKind({ ariaLabel: 'Request an unban from this channel' }), '');
  assert.equal(monetizationKind({ text: 'Send unban request' }), '');
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
  assert.equal(normalizeStickerPreferences({ view: 'recent' }).view, 'recent');
});

test('an emote asset is pinned to Kick by the URL parser, not by how the string starts', { tag: 'unit' }, () => {
  // A relative path was returned unparsed whenever it did not begin "//". For a
  // special scheme the URL parser reads a backslash as a slash, so "/\host/..."
  // is protocol-relative as well and a browser resolved it straight to that
  // host. An imported library could point every emote at an outside origin, and
  // opening the library would fetch each one.
  const BS = String.fromCharCode(92);
  const src = (value) => normalizeStickerPreferences({
    schema: 1,
    library: [{ key: 'id:1', id: '1', name: 'Pack', src: value }],
  }).library[0]?.src ?? '(dropped)';

  for (const hostile of [
    '/' + BS + 'tracker.example/emotes/1.png',
    '/' + BS + BS + 'tracker.example/emotes/1.png',
    '//tracker.example/emotes/1.png',
    'https://tracker.example/emotes/1.png',
    'https://kick.com@tracker.example/emotes/1.png',
    'javascript:alert(1)//emotes/',
  ]) {
    assert.equal(src(hostile), '(dropped)', `${JSON.stringify(hostile)} must not survive`);
  }

  // A relative path that is not root-relative stays refused. Resolving one
  // would rewrite it to an absolute kick.com URL, freezing a stored library to
  // today's asset host, which is the opposite of why paths are kept as paths.
  for (const relative of ['./emotes/x.png', '../emotes/x.png', 'emotes/x.png']) {
    assert.equal(src(relative), '(dropped)', `${relative} must not be rewritten to an absolute URL`);
  }

  // What the cleaner exists to keep still gets through, and a path stays a path.
  assert.equal(src('/emotes/1/fullsize'), '/emotes/1/fullsize');
  assert.equal(src('https://files.kick.com/emotes/1/fullsize'), 'https://files.kick.com/emotes/1/fullsize');
  // The kick.com host itself resolves to an origin match rather than a prefix one.
  assert.equal(src('https://kick.com/emotes/1/fullsize'), 'https://kick.com/emotes/1/fullsize');
  // The marker may sit in the query rather than the path; that shape was stored
  // before this function learned to parse and must not start being dropped.
  assert.equal(src('https://files.kick.com/asset.png?src=/emotes/1.png'),
    'https://files.kick.com/asset.png?src=/emotes/1.png');
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
  assert.equal(routeKind('/settings/profile'), 'settings');
  assert.equal(routeKind('/collectibles'), 'collectibles');
  assert.equal(routeKind('/subscriptions'), 'subscriptions');
  assert.equal(routeKind('/category/just-chatting'), 'category');
  assert.equal(routeKind('/search?query=music'), 'search');
  assert.equal(routeKind('/lordkebun'), 'channel');
  assert.equal(routeKind('/creator-dashboard'), 'other');
});

test('StreamerStats profile links accept channel slugs and reject path injection', { tag: 'unit' }, () => {
  assert.equal(streamerStatsProfileUrl('xQc'), 'https://streamerstats.com/kick/channels/xQc');
  assert.equal(streamerStatsProfileUrl('channel_name-2'), 'https://streamerstats.com/kick/channels/channel_name-2');
  assert.equal(streamerStatsProfileUrl('../login'), '');
  assert.equal(streamerStatsProfileUrl('channel/name'), '');
  assert.equal(streamerStatsProfileUrl(''), '');
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
  const malformed = validateImportedSettings('{oops');
  assert.equal(malformed.ok, false);
  assert.equal(malformed.errorKey, 'That file is not valid JSON.');
  const future = validateImportedSettings('{"schema":99}');
  assert.match(future.error, /newer/);
  assert.equal(future.errorKey, 'Settings schema {schema} is newer than this build supports.');
  assert.deepEqual(future.errorValues, { schema: 99 });
  assert.equal(validateImportedSettings('{"layout":{"chatWidth":410}}').value.layout.chatWidth, 410);
  assert.equal(validateImportedSettings('{"layout":{"chatWidth":410}}').settings.layout.chatWidth, 410);
  assert.equal(validateImportedSettings('{}').ok, false);
  assert.match(validateImportedSettings('{}').error, /does not contain/);
  assert.equal(validateImportedSettings('{"schema":1}').ok, false);
});

test('settings import names whatever it could not keep', { tag: 'unit' }, () => {
  // A value outside the supported range is clamped, and the change is stated
  // rather than silently applied.
  const clamped = validateImportedSettings('{"schema":1,"layout":{"chatWidth":9000}}');
  assert.equal(clamped.ok, true);
  assert.equal(clamped.value.layout.chatWidth, 520);
  assert.ok(clamped.notes.some((note) => /Adjusted "layout.chatWidth"/.test(note)));
  assert.deepEqual(clamped.noteDetails.find((note) => note.values?.path === 'layout.chatWidth'), {
    key: 'Adjusted "{path}" to a supported value.',
    values: { path: 'layout.chatWidth' },
  });

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
  assert.deepEqual(clean.noteDetails, []);
});

test('this build’s own export imports back without a single note', { tag: 'unit' }, () => {
  // The export spreads the whole settings record, so it carries lastSeenVersion
  // alongside schema. That key was missing from the importer's known set, and a
  // plain round trip therefore accused the app's own file of holding an unknown
  // section. The notes are the only signal that an import lost something, so a
  // false one costs more than a missing one.
  const exported = buildSettingsExport({ settings: normalizeSettings({}) });
  assert.ok(Object.hasOwn(exported, 'lastSeenVersion'), 'the export is expected to carry this key');
  const round = validateImportedSettings(JSON.stringify(exported));
  assert.equal(round.ok, true);
  assert.deepEqual(round.notes, [], 'a round trip of an untouched export must be silent');
  assert.deepEqual(round.noteDetails, []);
});

test('a schema stamp that is not a number reads as unversioned', { tag: 'unit' }, () => {
  // Number('abc') is NaN, and NaN fails both `> SETTINGS_SCHEMA` and
  // `< SETTINGS_SCHEMA`, so a junk stamp used to clear the "too new" refusal and
  // skip the upgrade note as well, importing as though it were already current.
  for (const stamp of ['abc', '5abc', 'NaN', '', '   ', {}, [], true, null]) {
    const result = validateImportedSettings(JSON.stringify({ schema: stamp, layout: { chatWidth: 410 } }));
    assert.equal(result.ok, true, `schema ${JSON.stringify(stamp)} should still import`);
    assert.ok(
      result.notes.some((note) => /Upgraded from an unversioned file/.test(note)),
      `schema ${JSON.stringify(stamp)} should report as unversioned, got ${JSON.stringify(result.notes)}`,
    );
  }

  // A real number still takes the numbered upgrade path, and still refuses a
  // stamp from a build newer than this one.
  assert.ok(validateImportedSettings('{"schema":1,"layout":{"chatWidth":410}}').notes
    .some((note) => /Upgraded from schema 1 to schema/.test(note)));
  assert.equal(validateImportedSettings('{"schema":99}').ok, false);
  assert.equal(validateImportedSettings('{"schema":"99"}').ok, false, 'a numeric string stamp is still a version');

  // The same hole existed on the emote library's own stamp.
  const sticker = validateImportedSettings('{"schema":1,"stickers":{"schema":"abc","library":[]}}');
  assert.equal(sticker.ok, true);
  assert.ok(sticker.notes.some((note) => /Upgraded emotes to schema/.test(note)));

  // Infinity is not junk, it is a number bigger than anything this build reads.
  // A stamp of 1e999 parses to it, and treating that as "no stamp" would turn a
  // refusal into a silent import.
  for (const stamp of ['Infinity', '1e999']) {
    assert.equal(validateImportedSettings(JSON.stringify({ schema: stamp })).ok, false,
      `schema ${stamp} must still be refused as newer than this build`);
  }
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
  assert.equal(imported.settings, null, 'a stickers-only file must not replace the live settings profile');
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
  assert.ok(/^1 emote/.test(note), 'expected singular phrasing for one dropped entry');
});

test('hidden channels normalize and round-trip through settings', { tag: 'unit' }, () => {
  // A channel path or URL is normalized to a clean path.
  assert.equal(normalizeChannelPath('xQc'), '/xqc');
  assert.equal(normalizeChannelPath('https://kick.com/Creator/'), '/creator');
  assert.equal(normalizeChannelPath('/already-clean'), '/already-clean');
  assert.equal(normalizeChannelPath(''), '');
  assert.equal(observedChannelPath('/xqc/'), '/xqc');
  assert.equal(observedChannelPath('/XQC'), '/xqc');
  assert.equal(observedChannelPath('/'), '');
  assert.equal(observedChannelPath('https://kick.com/Creator/'), '/creator');

  // Settings normalization caps the list and deduplicates.
  const settings = normalizeSettings({
    content: { hiddenChannels: ['/a', '/b', '/a', 42, '/c'] },
  });
  assert.deepEqual(settings.content.hiddenChannels, ['/a', '/b', '/c']);
});

test('a diagnostic settings diff names changed keys and not hidden-channel slugs', { tag: 'unit' }, () => {
  const empty = diagnosticSettingsDiff(DEFAULT_SETTINGS);
  assert.deepEqual(empty, {});
  const diff = diagnosticSettingsDiff({
    content: { hideCasino: true, hiddenChannels: ['/xqc', '/alpha'], blocklistUrl: 'https://example.com/list.json' },
    appearance: { theme: 'oled' },
  });
  assert.equal(diff.content.hideCasino, true);
  assert.equal(diff.content.hiddenChannels, 2);
  assert.equal(diff.content.blocklistUrl, true);
  assert.equal(diff.appearance.theme, 'oled');
  assert.equal('hiddenChannels' in (diff.content || {}) && typeof diff.content.hiddenChannels === 'number', true);
  assert.ok(!JSON.stringify(diff).includes('xqc'));
});

test('stored channel keys are canonicalized on the way in', { tag: 'unit' }, () => {
  const layouts = normalizeChannelLayouts({ '/XQC/': { focus: true }, '/xqc': { theater: true } });
  assert.equal(Object.keys(layouts).length, 1);
  assert.equal(layouts['/xqc'].theater, true);
  const media = normalizeMediaPreferences({
    'volume:/XQC/': { volume: 0.4, muted: false },
    'quality:/Alpha': '720',
    'ladder:global': '1080,720',
    'volume:/': 0.1,
  });
  assert.deepEqual(media['volume:/xqc'], { volume: 0.4, muted: false });
  assert.equal(media['quality:/alpha'], '720');
  assert.equal(media['ladder:global'], '1080,720');
  assert.equal('volume:/' in media, false);
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
  assert.equal(both.messageKey, 'Kick Focus could not save your {list}. Browser storage is full or blocked, so those changes exist only until you reload.');

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
  assert.match(validateImportedSettings('{"multistream":5}').error, /boards must be a JSON object/);

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

test('the hideable catalog is internally consistent and every entry is reachable', { tag: 'unit' }, () => {
  const ids = HIDEABLE_ELEMENTS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique — they key both the CSS and the settings value');
  const probes = HIDEABLE_ELEMENTS.map((entry) => entry.probe);
  assert.equal(new Set(probes).size, probes.length, 'two entries sharing a probe would hide each other');
  const groups = new Set(HIDEABLE_GROUPS.map((group) => group.id));
  for (const entry of HIDEABLE_ELEMENTS) {
    assert.ok(groups.has(entry.group), `${entry.id} is in group ${entry.group}, which the grid does not render`);
    assert.ok(entry.label && entry.probe, `${entry.id} needs both a label and a probe`);
    // The id reaches CSS as an attribute-selector token, and a space would
    // silently split it into two tokens that match nothing.
    assert.match(entry.id, /^[a-z][a-z0-9-]*$/, `${entry.id} is not a safe attribute token`);
  }
});

test('hidden-element ids are validated, deduped, and stored in catalog order', { tag: 'unit' }, () => {
  assert.deepEqual(normalizeHiddenElements(null), []);
  assert.deepEqual(normalizeHiddenElements('player-clip'), [], 'a bare string is not a list');
  assert.deepEqual(normalizeHiddenElements(['player-clip', 'player-clip']), ['player-clip']);
  assert.deepEqual(normalizeHiddenElements(['nope', 42, null, { id: 'player-pip' }]), [],
    'an id this build cannot find would sit in the settings file forever');
  // Clicked in one order, stored in another, so two backups of the same
  // configuration are the same bytes.
  assert.deepEqual(
    normalizeHiddenElements(['sidebar-drops', 'player-pip', ' player-clip ']),
    ['player-pip', 'player-clip', 'sidebar-drops'],
  );
  const settings = normalizeSettings({ layout: { hidden: ['sidebar-home', 'bogus'] } });
  assert.deepEqual(settings.layout.hidden, ['sidebar-home']);
  assert.deepEqual(DEFAULT_SETTINGS.layout.hidden, [], 'nothing is hidden until asked for by name');
});

test('quality labels rank by height then frame rate, and Auto never wins', { tag: 'unit' }, () => {
  assert.ok(qualityRank('1080p60') > qualityRank('1080p'), 'frame rate breaks a height tie');
  assert.ok(qualityRank('1080p') > qualityRank('720p60'), 'height outranks frame rate');
  assert.ok(qualityRank('720p60') > qualityRank('480p'));
  assert.ok(qualityRank('480p') > qualityRank('360p'));
  assert.ok(qualityRank('360p') > qualityRank('160p'));
  assert.ok(qualityRank('Source') > qualityRank('1080p60'), 'a source rung is above every encoded one');

  // Auto is the absence of a choice, not the top of the ladder. Ranking it
  // highest would make "always start at the highest quality" mean "do nothing".
  assert.equal(qualityRank('Auto'), 0);
  assert.equal(qualityRank('Auto (1080p60)'), 0);
  assert.ok(qualityRank('160p') > qualityRank('Auto'));

  // Unrankable scores below Auto so it can never be written to the player.
  assert.equal(qualityRank('whatever Kick ships next'), -1);
  assert.equal(qualityRank(''), -1);
  assert.equal(qualityRank(null), -1);
});

test('the best option is picked from what Kick actually offered, or nothing at all', { tag: 'unit' }, () => {
  assert.equal(bestQualityOption(['Auto', '1080p60', '720p60', '480p', '360p', '160p']), '1080p60');
  assert.equal(bestQualityOption([' 720p60 ']), '720p60', 'the stored label is trimmed, not the raw text node');
  // A channel that only offers Auto, and a menu that has not rendered its
  // options yet, both mean "leave Kick's own choice alone".
  assert.equal(bestQualityOption(['Auto']), '');
  assert.equal(bestQualityOption([]), '');
  assert.equal(bestQualityOption(undefined), '');
  assert.equal(bestQualityOption(['mystery']), '', 'an unrecognized label is never guessed at');
});

test('the session key gets the bare height Kick writes, never the menu label', { tag: 'unit' }, () => {
  // Measured against a live channel on 2026-08-16 by picking each rung and
  // reading `sessionStorage['stream_quality']` back. Writing the label instead
  // — which is what this build did before — hands the player a value it does
  // not recognize, so these five are the whole contract.
  assert.equal(qualitySessionValue('1080p60'), '1080');
  assert.equal(qualitySessionValue('720p60'), '720');
  assert.equal(qualitySessionValue('360p'), '360');
  assert.equal(qualitySessionValue('160p'), '160');
  assert.equal(qualitySessionValue('Auto'), '0');

  // Nothing is written for a label that decodes to no plausible height: the
  // alias rungs are synthetic ranks, not measurements.
  assert.equal(qualitySessionValue('Source'), '');
  assert.equal(qualitySessionValue('mystery'), '');
  assert.equal(qualitySessionValue(''), '');
  assert.equal(qualitySessionValue(null), '');
});

/**
 * An update that changes behaviour without a word is the pattern Kick itself was
 * criticised for when ads appeared unannounced in May 2026. The interesting
 * cases here are the two that must stay silent: this build cannot honestly say
 * what changed for someone it has never seen before.
 */
test('an update is announced, a first install is not', { tag: 'unit' }, () => {
  assert.equal(updateNotice('', '1.22.0'), null, 'a profile with no recorded version has seen nothing');
  assert.equal(updateNotice(null, '1.22.0'), null, 'neither has one that predates the field');
  assert.equal(updateNotice('1.22.0', '1.22.0'), null, 'the same build is not an update');

  const upgrade = updateNotice('1.21.0', '1.22.0');
  assert.equal(upgrade.from, '1.21.0');
  assert.equal(upgrade.to, '1.22.0');
  assert.ok(upgrade.summary.length > 20, 'the version being moved to is the one described');

  // A downgrade is worth knowing about too — running an older build than last
  // time is a surprise, not a non-event.
  const downgrade = updateNotice('1.22.0', '1.21.0');
  assert.equal(downgrade.from, '1.22.0');
  assert.equal(downgrade.to, '1.21.0');
});

test('a stored version is validated before it is compared or shown', { tag: 'unit' }, () => {
  // It is read back out of a settings file a user can hand-edit or import, and
  // it reaches the interface, so it is treated as untrusted input.
  for (const junk of ['../evil', '<img onerror=1>', 'v1.2.3', '1.2.3.4.5', 'x'.repeat(40), '99999.0']) {
    assert.equal(normalizeVersion(junk), '', `${junk} was accepted`);
    assert.equal(updateNotice(junk, '1.22.0'), null, `${junk} produced a notice`);
  }
  assert.equal(normalizeVersion('1.21.0'), '1.21.0');
  assert.equal(normalizeVersion('  1.21.0  '), '1.21.0', 'surrounding whitespace is tolerated');
});

test('a version with no note still records itself rather than repeating', { tag: 'unit' }, () => {
  const notice = updateNotice('1.20.0', '1.21.0', { });
  assert.equal(notice.to, '1.21.0');
  assert.equal(notice.summary, '', 'a version nobody wrote a note for says nothing');
  assert.deepEqual(notice.defaults, []);
});

test('normalizeSettings carries the recorded version and refuses a junk one', { tag: 'unit' }, () => {
  assert.equal(normalizeSettings({ lastSeenVersion: '1.21.0' }).lastSeenVersion, '1.21.0');
  assert.equal(normalizeSettings({ lastSeenVersion: '../evil' }).lastSeenVersion, '');
  assert.equal(normalizeSettings({}).lastSeenVersion, '', 'a fresh profile has seen nothing');
});

/**
 * Settings search. FrankerFaceZ is the only project in this field that has
 * solved cross-page settings search, and its shape is a lowercased term blob per
 * row plus a substring test — no index, no fuzzy matching. These pin the
 * ordering, which is the part a substring test does not give you for free.
 */
const SEARCH_ROWS = [
  { page: 'layout', pageTitle: 'Layout', title: 'Chat width', description: 'How wide the chat column is.', terms: 'Chat width\nHow wide the chat column is.' },
  { page: 'content', pageTitle: 'Content & Ads', title: 'Organize chat stickers', description: 'Collect emotes seen in chat.', terms: 'Organize chat stickers\nCollect emotes seen in chat.' },
  { page: 'appearance', pageTitle: 'Appearance', title: 'Theme', description: 'Choose the overall surface treatment for chat and the shell.', terms: 'Theme\nChoose the overall surface treatment for chat and the shell.' },
];

test('a title match outranks a description-only match, and a prefix outranks both', { tag: 'unit' }, () => {
  const found = rankSettingsMatches('chat', SEARCH_ROWS);
  assert.deepEqual(found.map((row) => row.title), ['Chat width', 'Organize chat stickers', 'Theme'],
    'prefix of a title, then inside a title, then description only');
});

test('a one-letter query opens nothing, because it matches most of the panel', { tag: 'unit' }, () => {
  assert.deepEqual(rankSettingsMatches('c', SEARCH_ROWS), []);
  assert.deepEqual(rankSettingsMatches('', SEARCH_ROWS), []);
  assert.deepEqual(rankSettingsMatches('   ', SEARCH_ROWS), []);
  assert.equal(rankSettingsMatches('ch', SEARCH_ROWS).length > 0, true, 'two letters is the floor');
});

test('search matches a translated term as well as its English source', { tag: 'unit' }, () => {
  // The interface is assembled in English and translated afterwards, so the
  // index carries both — otherwise a Spanish reader could never find a row by
  // the words actually on their screen.
  const bilingual = [{
    page: 'appearance', pageTitle: 'Appearance', title: 'Theme', description: 'Surface treatment.',
    terms: 'Theme\nSurface treatment.\nTema\nTratamiento de la superficie.',
  }];
  assert.equal(rankSettingsMatches('tema', bilingual).length, 1, 'the translation finds it');
  assert.equal(rankSettingsMatches('theme', bilingual).length, 1, 'the English key still finds it');
  assert.equal(rankSettingsMatches('nothing', bilingual).length, 0);
});

test('search results are capped and deterministic', { tag: 'unit' }, () => {
  const many = Array.from({ length: 60 }, (_, index) => ({
    page: 'layout', pageTitle: 'Layout', title: `Chat setting ${String(index).padStart(2, '0')}`, description: '', terms: `Chat setting ${index}`,
  }));
  assert.equal(rankSettingsMatches('chat', many, 40).length, 40);
  const once = rankSettingsMatches('chat', many, 5).map((row) => row.title);
  const twice = rankSettingsMatches('chat', many, 5).map((row) => row.title);
  assert.deepEqual(once, twice, 'two identical queries cannot return different orders');
});


test('a VOD expires 7 days out, or 30 when the channel is verified', { tag: 'unit' }, () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 7, 18, 12, 0, 0);
  const started = now - 2 * day;

  const unverified = vodExpiry(started, false, now);
  assert.equal(unverified.days, VOD_RETENTION_DAYS.unverified);
  assert.equal(unverified.expiresAt, started + 7 * day);
  assert.equal(unverified.remaining, 5 * day);
  assert.equal(unverified.expired, false);

  const verified = vodExpiry(started, true, now);
  assert.equal(verified.days, VOD_RETENTION_DAYS.verified);
  assert.equal(verified.remaining, 28 * day);
});

test('an unknown tier is a silence, never a default', { tag: 'unit' }, () => {
  const now = Date.UTC(2026, 7, 18, 12, 0, 0);
  const started = now - 2 * 24 * 60 * 60 * 1000;
  // The whole point of the item: 7 and 30 are four-fold apart, so guessing is
  // not a rounder answer, it is a confident wrong deadline.
  for (const unknown of [undefined, null, 0, 1, '', 'verified', 'unverified', {}]) {
    assert.equal(vodExpiry(started, unknown, now), null, `tier ${JSON.stringify(unknown)} must not resolve`);
  }
  assert.equal(vodExpiry(0, true, now), null);
  assert.equal(vodExpiry(NaN, true, now), null);
  // A recording dated in the future is two clocks disagreeing, not extra life.
  assert.equal(vodExpiry(now + 3 * 24 * 60 * 60 * 1000, true, now), null);
});

test('an expired VOD reports as expired and formats as nothing', { tag: 'unit' }, () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 7, 18, 12, 0, 0);
  const expiry = vodExpiry(now - 9 * day, false, now);
  assert.equal(expiry.expired, true);
  assert.ok(expiry.remaining < 0);
  assert.equal(formatVodRetention(expiry.remaining), '');
});

test('the retention label narrows its unit as the deadline approaches', { tag: 'unit' }, () => {
  const hour = 3600_000;
  assert.equal(formatVodRetention(6 * 24 * hour), '6d');
  assert.equal(formatVodRetention(48 * hour), '2d');
  // Below two days it is hours, so "1d" never stands for anything from 24 to 47.
  assert.equal(formatVodRetention(47 * hour), '47h');
  assert.equal(formatVodRetention(hour), '1h');
  assert.equal(formatVodRetention(59 * 60_000), '59m');
  assert.equal(formatVodRetention(30_000), '1m');
  assert.equal(formatVodRetention(0), '');
  assert.equal(formatVodRetention(-1), '');
  assert.equal(formatVodRetention(NaN), '');
});


test('the merged buffer keeps arrival order and caps from the front', { tag: 'unit' }, () => {
  let entries = [];
  for (let i = 0; i < 5; i += 1) {
    entries = appendMergedMessage(entries, { slug: i % 2 ? 'beta' : 'alpha', id: String(i), text: `m${i}`, sender: 'x', at: i }, 3);
  }
  // Ordered by arrival, not by any sender clock: nine channels have nine
  // clocks, and the reader wants the order they would have seen.
  assert.deepEqual(entries.map((entry) => entry.text), ['m2', 'm3', 'm4']);
  assert.deepEqual(entries.map((entry) => entry.slug), ['alpha', 'beta', 'alpha']);
});

test('a replayed message is not shown twice, but two channels may share an id', { tag: 'unit' }, () => {
  let entries = appendMergedMessage([], { slug: 'alpha', id: '7', text: 'hello', sender: 'a', at: 1 });
  entries = appendMergedMessage(entries, { slug: 'alpha', id: '7', text: 'hello', sender: 'a', at: 2 });
  assert.equal(entries.length, 1, 'Kick replays recent history on reconnect');
  // Ids are only unique within a channel, so the same id from another channel
  // is a different message and must not be swallowed.
  entries = appendMergedMessage(entries, { slug: 'beta', id: '7', text: 'hello', sender: 'b', at: 3 });
  assert.equal(entries.length, 2);
});

test('the merged buffer refuses junk rather than propagating it', { tag: 'unit' }, () => {
  assert.deepEqual(appendMergedMessage([], null), []);
  assert.deepEqual(appendMergedMessage([], { slug: '', text: 'x' }), []);
  assert.deepEqual(appendMergedMessage([], { slug: 'alpha', text: '' }), []);
  // Every field lands as a string, so a hostile payload cannot smuggle an
  // object into markup.
  const [entry] = appendMergedMessage([], { slug: 'alpha', id: 1, text: 'hi', sender: {}, color: 5, at: 'soon' });
  assert.equal(entry.id, '');
  assert.equal(entry.sender, '');
  assert.equal(entry.color, '');
  assert.equal(entry.at, 0);
});

test('dropping a channel removes only its messages', { tag: 'unit' }, () => {
  let entries = [];
  entries = appendMergedMessage(entries, { slug: 'alpha', id: '1', text: 'a', at: 1 });
  entries = appendMergedMessage(entries, { slug: 'beta', id: '2', text: 'b', at: 2 });
  entries = appendMergedMessage(entries, { slug: 'alpha', id: '3', text: 'c', at: 3 });
  const left = dropMergedChannel(entries, 'alpha');
  assert.deepEqual(left.map((entry) => entry.text), ['b']);
  assert.deepEqual(dropMergedChannel(entries, 'gamma').length, 3, 'a channel that was never there changes nothing');
});


test('the completion list never offers an emote Kick is on record as refusing', { tag: 'unit' }, () => {
  const here = 'alpha';
  const candidates = [
    { key: 'k:1', id: '1', name: 'poggers', usableHere: true, usableEverywhere: true },
    // Subscriber emote the account does not own -> SUBSCRIBERS_ONLY_EMOTE_ERROR.
    { key: 'k:2', id: '2', name: 'pogchamp', usableHere: false, usableEverywhere: true },
    // Free channel emote from another channel -> FOREIGN_CHANNEL_EMOTE_ERROR.
    { key: 'k:3', id: '3', name: 'pogtastic', usableEverywhere: false, sourceSlug: 'beta' },
    // The same kind of emote, but in its own channel, where it does work.
    { key: 'k:4', id: '4', name: 'pogging', usableEverywhere: false, sourceSlug: 'alpha' },
  ];
  const offered = rankEmoteCompletions('pog', candidates, { channel: here }).map((entry) => entry.name);
  assert.deepEqual(offered.sort(), ['poggers', 'pogging']);
});

test('an unknown reach is still offered, because an anonymous read cannot know', { tag: 'unit' }, () => {
  // The signed-out case: Kick returns the same shape for an emote the account
  // owns and one it never will, so filtering on uncertainty would empty the
  // list for every signed-out user.
  const candidates = [
    { key: 'k:1', id: '1', name: 'poggers' },
    { key: 'k:2', id: '2', name: 'pogchamp', usableHere: null },
    { key: 'k:3', id: '3', name: 'pogtastic', usableEverywhere: false },
  ];
  const offered = rankEmoteCompletions('pog', candidates, { channel: 'alpha' }).map((entry) => entry.name);
  assert.deepEqual(offered.sort(), ['pogchamp', 'poggers', 'pogtastic'],
    'nothing is hidden without a positive refusal on record');
});

test('completionWouldBounce answers only from positive knowledge', { tag: 'unit' }, () => {
  assert.equal(completionWouldBounce({ usableHere: false }, 'alpha'), true);
  assert.equal(completionWouldBounce({ usableEverywhere: false, sourceSlug: 'beta' }, 'alpha'), true);
  // Case is Kick's, not the user's.
  assert.equal(completionWouldBounce({ usableEverywhere: false, sourceSlug: 'Alpha' }, 'alpha'), false);
  assert.equal(completionWouldBounce({ usableEverywhere: false, sourceSlug: 'beta' }, ''), false);
  assert.equal(completionWouldBounce({ usableEverywhere: false }, 'alpha'), false);
  assert.equal(completionWouldBounce({ usableEverywhere: true }, 'alpha'), false);
  assert.equal(completionWouldBounce({}, 'alpha'), false);
  assert.equal(completionWouldBounce(null, 'alpha'), false);
});

test('the viewer hub always renders every card, in the same order', { tag: 'unit' }, () => {
  // A hub that drops a card when its source is missing changes shape under the
  // reader, and the missing card is the one worth explaining.
  const cards = viewerHubCards({}, 1000);
  assert.deepEqual(cards.map((entry) => entry.id), VIEWER_HUB_CARDS.map((entry) => entry.id));
  assert.ok(cards.every((entry) => entry.state === 'unavailable' && entry.reason === 'not-read'));
});

test('an absent reading never arrives as a zero', { tag: 'unit' }, () => {
  // The whole reason this module exists. A viewer with no points and a viewer
  // whose points could not be read must not look the same.
  const absent = viewerHubCards({
    points: { onChannel: true, value: null, observedAt: 900 },
    collectibles: { owned: undefined, observedAt: 900 },
    drops: { navPresent: true, onRoute: true, campaigns: null, observedAt: 900 },
    level: { dialogOpen: true, value: NaN, observedAt: 900 },
  }, 1000);
  for (const entry of absent) {
    assert.equal(entry.value, null, `${entry.id} produced a value from nothing`);
    assert.notEqual(entry.state, 'ready', `${entry.id} claims to be ready with nothing to show`);
  }

  // And the other half of the same rule: a measured zero is a real answer and
  // survives, which is why the guard is "absent", not "falsy".
  const zero = viewerHubCards({
    points: { onChannel: true, value: 0, observedAt: 900 },
    collectibles: { owned: 0, copies: 0, observedAt: 900 },
  }, 1000);
  assert.equal(zero.find((entry) => entry.id === 'points').value, 0);
  assert.equal(zero.find((entry) => entry.id === 'points').state, 'ready');
  assert.equal(zero.find((entry) => entry.id === 'collectibles').value, 0);
});

test('every card fails on its own', { tag: 'unit' }, () => {
  // One source going down must cost one card, not the hub.
  const cards = viewerHubCards({
    points: { onChannel: true, value: 4200, observedAt: 900 },
    collectibles: { failed: true },
    // A fact that throws the moment it is read: the builder must contain it.
    drops: { get navPresent() { throw new Error('nope'); } },
    level: { dialogOpen: false },
  }, 1000);
  const by = Object.fromEntries(cards.map((entry) => [entry.id, entry]));
  assert.equal(by.points.state, 'ready');
  assert.equal(by.points.value, 4200);
  assert.equal(by.collectibles.state, 'error');
  assert.equal(by.drops.state, 'error');
  assert.equal(by.drops.reason, 'threw');
  assert.equal(by.level.state, 'unavailable');
  assert.equal(by.level.reason, 'dialog-closed');
});

test('an anonymous page says so, and says it per card', { tag: 'unit' }, () => {
  // Signed out, Kick renders no reward control, no points control, no Drops
  // entry, and answers the collectible read with 403. Each is its own sentence.
  const cards = viewerHubCards({
    reward: { trigger: false },
    points: { onChannel: true, value: null, observedAt: 900 },
    collectibles: { denied: true },
    drops: { navPresent: false },
    level: { dialogOpen: false },
    streak: { dialogOpen: false },
    watch: { elapsedMs: 65_000, active: false, observedAt: 1000 },
  }, 1000);
  const reasons = Object.fromEntries(cards.filter((entry) => entry.id !== 'watch').map((entry) => [entry.id, entry.reason]));
  assert.deepEqual(reasons, {
    reward: 'anonymous',
    points: 'anonymous',
    collectibles: 'anonymous',
    drops: 'anonymous',
    level: 'dialog-closed',
    streak: 'dialog-closed',
  });
  assert.ok(cards.filter((entry) => entry.id !== 'watch').every((entry) => entry.state === 'unavailable'));
  const local = cards.find((entry) => entry.id === 'watch');
  assert.equal(local.state, 'ready');
  assert.equal(local.source, 'local');
  assert.equal(local.value, 65_000);
  assert.deepEqual(viewerHubSummary(cards), {
    ready: 1, total: 7, errors: 0, stale: 0, fromDom: [], fromApi: [], fromLocal: ['watch'],
  });
});

test('session watch time advances only across active playback and formats as a clock', { tag: 'unit' }, () => {
  let record = advanceSessionWatchTime({}, 1000, true);
  assert.deepEqual(record, { elapsedMs: 0, activeSince: 1000 });
  assert.equal(sessionWatchElapsed(record, 61_500), 60_500);
  record = advanceSessionWatchTime(record, 61_500, false);
  assert.deepEqual(record, { elapsedMs: 60_500, activeSince: 0 });
  assert.equal(sessionWatchElapsed(record, 90_000), 60_500, 'paused time kept advancing');
  record = advanceSessionWatchTime(record, 90_000, true);
  assert.equal(sessionWatchElapsed(record, 3_750_000), 3_720_500);
  assert.equal(formatSessionWatchTime(0), '0:00');
  assert.equal(formatSessionWatchTime(60_500), '1:00');
  assert.equal(formatSessionWatchTime(3_720_500), '1:02:00');
});

test('session watch playback requires one visible channel-player owner', { tag: 'unit' }, () => {
  const base = {
    route: 'channel',
    documentVisible: true,
    connected: true,
    visible: true,
    intersectsViewport: true,
    playerSurface: true,
    width: 1280,
    height: 720,
    playing: true,
  };
  assert.deepEqual(sessionWatchCandidateState(base), {
    owner: true,
    active: true,
    score: 1_000_921_600,
  });
  for (const [label, change] of [
    ['paused', { playing: false }],
    ['hidden document', { documentVisible: false }],
  ]) {
    const state = sessionWatchCandidateState({ ...base, ...change });
    assert.equal(state.owner, true, `${label} should keep player ownership`);
    assert.equal(state.active, false, `${label} should add no watch time`);
  }
  for (const [label, change] of [
    ['hidden', { visible: false }],
    ['preload', { preload: true }],
    ['preview', { preview: true }],
    ['muted background', { background: true, muted: true }],
    ['detached', { connected: false }],
    ['off-channel', { route: 'discovery' }],
  ]) {
    assert.deepEqual(sessionWatchCandidateState({ ...base, ...change }), {
      owner: false,
      active: false,
      score: -1,
    }, `${label} media should be ineligible`);
  }
});

test('session watch owner ranking ignores autoplay and changes ownership without double-counting', { tag: 'unit' }, () => {
  const owner = selectSessionWatchOwner([
    {
      id: 'preview', route: 'channel', documentVisible: true, connected: true,
      visible: true, intersectsViewport: true, playerSurface: false,
      preview: true, muted: true, playing: true, width: 960, height: 540,
    },
    {
      id: 'main', route: 'channel', documentVisible: true, connected: true,
      visible: true, intersectsViewport: true, playerSurface: true,
      muted: false, playing: false, width: 640, height: 360,
    },
  ]);
  assert.equal(owner?.id, 'main', 'a paused main player keeps ownership over an autoplay preview');

  let record = advanceSessionWatchTime({}, 1_000, true);
  record = advanceSessionWatchTime(record, 2_000, true);
  record = advanceSessionWatchTime(record, 3_000, false);
  assert.deepEqual(record, { elapsedMs: 2_000, activeSince: 0 },
    'an active owner swap stays continuous and an inactive owner banks the interval once');
});

test('level and streak are only read while Kick has the reward dialog open', { tag: 'unit' }, () => {
  // Neither is persisted to fill the gap: a level kept from yesterday is a
  // number that looks live and is not.
  const closed = viewerHubCards({ level: { dialogOpen: false, value: 12 }, streak: { dialogOpen: false, value: 3 } }, 1000);
  assert.deepEqual(closed.filter((entry) => ['level', 'streak'].includes(entry.id)).map((entry) => entry.value), [null, null]);

  const open = viewerHubCards({
    level: { dialogOpen: true, value: 12, observedAt: 990 },
    streak: { dialogOpen: true, value: 3, observedAt: 990 },
  }, 1000);
  const by = Object.fromEntries(open.map((entry) => [entry.id, entry]));
  assert.equal(by.level.value, 12);
  assert.equal(by.streak.value, 3);
  assert.equal(by.level.source, 'dom');

  // Open, but Kick rendered no figure: that is "not shown", not zero.
  const empty = viewerHubCards({ level: { dialogOpen: true, value: null, observedAt: 990 } }, 1000);
  assert.equal(empty.find((entry) => entry.id === 'level').reason, 'not-shown');
});

test('the reward card distinguishes claimed, waiting, and available', { tag: 'unit' }, () => {
  const at = 10_000_000;
  const rolledOver = at - 3_600_000;
  const base = { trigger: true, previousResetAt: rolledOver, observedAt: at - 1000 };

  const claimed = viewerHubCards({ reward: { ...base, lastClaimAt: rolledOver + 60_000 } }, at);
  assert.equal(claimed.find((entry) => entry.id === 'reward').value, 'claimed');

  // Claimed, but before the rollover: that reward is yesterday's and the card
  // must not report today's as taken.
  const yesterday = viewerHubCards({ reward: { ...base, lastClaimAt: rolledOver - 60_000 } }, at);
  assert.equal(yesterday.find((entry) => entry.id === 'reward').value, 'available');

  const waiting = viewerHubCards({ reward: { ...base, nextCheckAt: at + 600_000 } }, at);
  assert.equal(waiting.find((entry) => entry.id === 'reward').value, 'waiting');
});

test('a reading that stopped updating is shown as an old one, not as current', { tag: 'unit' }, () => {
  const now = 5_000_000;
  const fresh = viewerHubCards({ points: { onChannel: true, value: 7, observedAt: now - 1000 } }, now);
  assert.equal(fresh.find((entry) => entry.id === 'points').stale, false);

  const old = viewerHubCards({ points: { onChannel: true, value: 7, observedAt: now - VIEWER_HUB_STALE_MS - 1 } }, now);
  const card = old.find((entry) => entry.id === 'points');
  assert.equal(card.stale, true);
  // Still shown: an old reading is a fact about the reading, not a reason to
  // blank a number the viewer can see on Kick's own page.
  assert.equal(card.value, 7);
  assert.equal(viewerHubSummary(old).stale, 1);
});

test('the hub summary tells DOM-derived values from API-derived ones', { tag: 'unit' }, () => {
  const now = 5_000_000;
  const cards = viewerHubCards({
    points: { onChannel: true, value: 7, observedAt: now },
    collectibles: { owned: 21, copies: 34, observedAt: now },
    reward: { trigger: true, previousResetAt: now - 1000, lastClaimAt: now - 500, observedAt: now },
  }, now);
  const summary = viewerHubSummary(cards);
  assert.equal(summary.ready, 3);
  assert.deepEqual(summary.fromApi, ['collectibles']);
  assert.deepEqual(summary.fromDom.sort(), ['points', 'reward']);
  assert.deepEqual(summary.fromLocal, []);
  // A card with no reading names no source, so "where did this come from" can
  // never be answered for a value that does not exist.
  assert.ok(cards.filter((entry) => entry.state !== 'ready').every((entry) => entry.source === 'none'));
});

test('a hub still loading says loading, per card, rather than empty', { tag: 'unit' }, () => {
  const cards = viewerHubCards({
    collectibles: { loading: true },
    points: { loading: true },
  }, 1000);
  const by = Object.fromEntries(cards.map((entry) => [entry.id, entry]));
  assert.equal(by.collectibles.state, 'loading');
  assert.equal(by.points.state, 'loading');
  assert.equal(by.collectibles.value, null);
});

test('an earned state is marked only when Kick itself says one is waiting', { tag: 'unit' }, () => {
  const at = 10_000_000;
  const rolledOver = at - 3_600_000;
  const base = { trigger: true, previousResetAt: rolledOver, observedAt: at - 1000 };

  const waiting = earnedState(viewerHubCards({ reward: base }, at));
  assert.deepEqual(waiting, { kind: 'reward-ready', label: 'Daily reward ready' });

  // Already taken, still counting down, and signed out: three different reasons
  // there is nothing to mark, and all three mark nothing.
  assert.equal(earnedState(viewerHubCards({ reward: { ...base, lastClaimAt: rolledOver + 60_000 } }, at)), null);
  assert.equal(earnedState(viewerHubCards({ reward: { ...base, nextCheckAt: at + 600_000 } }, at)), null);
  assert.equal(earnedState(viewerHubCards({ reward: { trigger: false } }, at)), null);
  assert.equal(earnedState(viewerHubCards({}, at)), null);
});

test('nothing but the reward is ever marked as earned', { tag: 'unit' }, () => {
  // No streak flourish, no collectible confetti, no progress toward anything.
  // A number that Kick reports and does not call earned is just a number.
  const at = 10_000_000;
  const cards = viewerHubCards({
    collectibles: { owned: 40, copies: 120, observedAt: at },
    points: { onChannel: true, value: 99_999, observedAt: at },
    streak: { dialogOpen: true, value: 30, observedAt: at },
    level: { dialogOpen: true, value: 60, observedAt: at },
  }, at);
  assert.equal(earnedState(cards), null);
  assert.equal(earnedState(null), null);
});

test('chat history is bounded by age, rows, and bytes at once', { tag: 'unit' }, () => {
  const now = 10_000_000;
  const limits = { rows: 5, bytes: 100_000, ageMs: 60_000 };
  const rows = [
    { id: 'old', author: 'a', text: 'an hour ago', at: now - 3_600_000 },
    ...Array.from({ length: 8 }, (whole, index) => ({ id: `m${index}`, author: 'a', text: `line ${index}`, at: now - index })),
  ];
  const pruned = pruneChatHistory(rows, limits, now);
  assert.equal(pruned.length, 5);
  assert.ok(!pruned.some((row) => row.id === 'old'), 'an expired message survived the row cap');

  // Bytes, on a list well inside the row cap: one wall of text is enough.
  const heavy = Array.from({ length: 4 }, (whole, index) => ({ id: `h${index}`, author: 'a', text: 'x'.repeat(500), at: now }));
  const byBytes = pruneChatHistory(heavy, { rows: 100, bytes: 1200, ageMs: 60_000 }, now);
  assert.ok(byBytes.length < heavy.length, 'the byte cap dropped nothing');
  assert.ok(byBytes.length >= 1, 'the byte cap emptied the store instead of trimming it');
  // The newest survives, which is the half of "trim" that matters.
  assert.equal(byBytes[byBytes.length - 1].id, 'h3');
});

test('composer recall is a five-message memory ring and only Shift+Up enters it', { tag: 'unit' }, () => {
  assert.equal(DEFAULT_SETTINGS.content.chatComposerRecall, false);
  let messages = [];
  for (let index = 0; index < COMPOSER_RECALL_LIMIT + 2; index += 1) {
    messages = appendComposerRecall(messages, `sent ${index}`);
  }
  assert.deepEqual(messages, ['sent 2', 'sent 3', 'sent 4', 'sent 5', 'sent 6']);
  assert.equal(composerRecallAt(messages, 0), 'sent 6');
  assert.equal(composerRecallAt(messages, 4), 'sent 2');
  assert.equal(composerRecallAt(messages, 5), 'sent 6');
  assert.deepEqual(appendComposerRecall(messages, '/w friend private'), messages);
  assert.deepEqual(appendComposerRecall(messages, 'private composer', true), messages);
  assert.equal(isComposerRecallGesture({ key: 'ArrowUp', shiftKey: true }), true);
  assert.equal(isComposerRecallGesture({ key: 'ArrowUp', shiftKey: false }), false);
  assert.equal(isComposerRecallGesture({ key: 'ArrowUp', shiftKey: true, ctrlKey: true }), false);
  assert.equal(normalizeSettings({ content: { chatComposerRecall: true } }).content.chatComposerRecall, true);
});

test('following preview placement prefers the rail edge and clamps to the viewport', { tag: 'unit' }, () => {
  assert.deepEqual(
    floatingPreviewPosition(
      { left: 12, right: 228, top: 640, height: 40 },
      { width: 320, height: 214 },
      { width: 1280, height: 720 },
    ),
    { left: 240, top: 494, side: 'right' },
  );
  assert.deepEqual(
    floatingPreviewPosition(
      { left: 1080, right: 1268, top: 2, height: 40 },
      { width: 320, height: 214 },
      { width: 1280, height: 720 },
    ),
    { left: 748, top: 12, side: 'left' },
  );
});

test('a whisper, an unidentifiable message, and a repeat are all refused', { tag: 'unit' }, () => {
  const now = 1000;
  let rows = [];
  rows = appendChatEntry(rows, { id: 'a', author: 'someone', text: 'hello', at: now }, CHAT_HISTORY_LIMITS, now);
  assert.equal(rows.length, 1);

  // A private message has no business in a searchable log.
  rows = appendChatEntry(rows, { id: 'w', author: 'someone', text: 'private', whisper: true, at: now }, CHAT_HISTORY_LIMITS, now);
  // No id means no deletion can ever reach it again.
  rows = appendChatEntry(rows, { id: '', author: 'someone', text: 'anonymous', at: now }, CHAT_HISTORY_LIMITS, now);
  rows = appendChatEntry(rows, { id: 'a', author: 'someone', text: 'hello', at: now }, CHAT_HISTORY_LIMITS, now);
  assert.equal(rows.length, 1, 'a whisper, an id-less message, or a repeat was stored');

  // Text is normalized and bounded rather than refused.
  rows = appendChatEntry(rows, { id: 'b', author: 'x'.repeat(200), text: `  spaced\n\ttext  ${'y'.repeat(900)}`, at: now }, CHAT_HISTORY_LIMITS, now);
  const stored = rows.find((row) => row.id === 'b');
  assert.equal(stored.text.length, CHAT_HISTORY_MAX_TEXT);
  assert.ok(stored.text.startsWith('spaced text'));
  assert.equal(stored.author.length, 40);
});

test('a message Kick deleted leaves the history immediately', { tag: 'unit' }, () => {
  // The one rule this feature cannot bend: a local record must not outlive a
  // moderator's decision.
  const now = 2000;
  let rows = [];
  for (const id of ['a', 'b', 'c']) rows = appendChatEntry(rows, { id, author: id, text: `msg ${id}`, at: now }, CHAT_HISTORY_LIMITS, now);
  rows = dropChatMessage(rows, 'b');
  assert.deepEqual(rows.map((row) => row.id), ['a', 'c']);
  // An unknown or empty id changes nothing rather than clearing the store.
  assert.equal(dropChatMessage(rows, 'nope').length, 2);
  assert.equal(dropChatMessage(rows, '').length, 2);
});

test('history search answers newest first, over text and author', { tag: 'unit' }, () => {
  const now = 3000;
  let rows = [];
  rows = appendChatEntry(rows, { id: '1', author: 'ana', text: 'good morning', at: now - 300 }, CHAT_HISTORY_LIMITS, now);
  rows = appendChatEntry(rows, { id: '2', author: 'bo', text: 'morning all', at: now - 200 }, CHAT_HISTORY_LIMITS, now);
  rows = appendChatEntry(rows, { id: '3', author: 'cy', text: 'goodbye', at: now - 100 }, CHAT_HISTORY_LIMITS, now);

  assert.deepEqual(searchChatHistory(rows, 'morning').map((row) => row.id), ['2', '1']);
  assert.deepEqual(searchChatHistory(rows, 'ANA').map((row) => row.id), ['1']);
  assert.deepEqual(searchChatHistory(rows, '').map((row) => row.id), ['3', '2', '1']);
  assert.deepEqual(searchChatHistory(rows, 'nothing here'), []);
  assert.equal(searchChatHistory(rows, '', 2).length, 2);
});

test('the people list takes names and refuses everything else', { tag: 'unit' }, () => {
  assert.deepEqual(parsePeopleList('@Ana, bo\ncy_1'), ['ana', 'bo', 'cy_1']);
  assert.deepEqual(parsePeopleList('ana, ANA, @ana'), ['ana'], 'the same person was listed three times');
  assert.deepEqual(parsePeopleList('has space, <script>, , -leading'), []);
  assert.deepEqual(parsePeopleList(null), []);
  assert.equal(parsePeopleList(Array.from({ length: 60 }, (whole, i) => `n${i}`).join(',')).length, 40);

  assert.equal(isPriorityPerson(['ana'], '@Ana'), true);
  assert.equal(isPriorityPerson(['ana'], 'anaconda'), false);
  assert.equal(isPriorityPerson([], 'ana'), false);
  assert.equal(isPriorityPerson(['ana'], ''), false);
});

test('the sound stays quiet unless every condition is met', { tag: 'unit' }, () => {
  const base = { enabled: true, matched: true, own: false, hidden: false, now: 100_000, lastPlayedAt: 0 };
  assert.equal(shouldPlayMentionSound(base), true);
  assert.equal(shouldPlayMentionSound({ ...base, enabled: false }), false);
  assert.equal(shouldPlayMentionSound({ ...base, matched: false }), false);
  // Your own message matching your own highlight is not a mention.
  assert.equal(shouldPlayMentionSound({ ...base, own: true }), false);
  // A backgrounded tab would queue a pile of them for the moment it is focused.
  assert.equal(shouldPlayMentionSound({ ...base, hidden: true }), false);
  // Rate limited: a busy channel must not become a smoke alarm.
  assert.equal(shouldPlayMentionSound({ ...base, lastPlayedAt: base.now - 1000 }), false);
  assert.equal(shouldPlayMentionSound({ ...base, lastPlayedAt: base.now - MENTION_SOUND_GAP_MS }), true);
  assert.equal(shouldPlayMentionSound({}), false);
});

test('the export is readable, names the channel, and carries only what was stored', { tag: 'unit' }, () => {
  const now = Date.UTC(2026, 7, 19, 12, 0, 0);
  const rows = [{ id: '1', author: 'ana', text: 'hello', at: now }];
  const text = buildChatHistoryExport(rows, 'somechannel');
  assert.match(text, /somechannel/);
  assert.match(text, /1 messages/);
  assert.match(text, /ana: hello/);
  assert.equal(text.split('\n').length, 2);
  assert.match(buildChatHistoryExport([], ''), /this session, 0 messages/);
});

test('a chat time is a local clock, and nothing at all for a time that is not one', { tag: 'unit' }, () => {
  assert.match(formatChatTime(Date.UTC(2026, 7, 19, 12, 34), 'en-GB'), /^\d{2}:\d{2}$/);
  assert.equal(formatChatTime(null), '');
  assert.equal(formatChatTime(NaN), '');
  assert.equal(formatChatTime('nope'), '');
});

test('every default setting survives normalization, in every group', { tag: 'unit' }, () => {
  // The trap this exists for, hit 2026-08-19: `normalizeSettings` rebuilds the
  // settings object key by key, so a setting added to DEFAULT_SETTINGS and not
  // added here is simply dropped. Every reader then sees `undefined`, which
  // reads as "off" for a switch and throws for a list — and the throw landed
  // inside the apply cycle, taking every later step of that cycle with it.
  const normalized = normalizeSettings({});
  for (const [group, values] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof values !== 'object' || values === null) continue;
    for (const key of Object.keys(values)) {
      assert.ok(key in normalized[group], `${group}.${key} is a default that normalizeSettings drops`);
      assert.notEqual(normalized[group][key], undefined, `${group}.${key} normalizes to undefined`);
    }
  }
});

test('a saved layout carries the discovery settings and nothing else', { tag: 'unit' }, () => {
  const settings = normalizeSettings({});
  settings.layout.density = 'compact';
  settings.content.hideCasino = true;
  // Something a layout must never carry: a layout is restored into live
  // settings, so an unbounded key set is a path from an imported file to any
  // setting in the build.
  settings.content.blocklistUrl = 'https://example.com/list.json';

  const layout = buildDiscoveryLayout('  Dense   browse ', settings, ['browse', 'not-a-route']);
  assert.equal(layout.name, 'Dense browse');
  assert.deepEqual(layout.routes, ['browse']);
  assert.equal(layout.values['layout.density'], 'compact');
  assert.equal(layout.values['content.hideCasino'], true);
  assert.ok(!('content.blocklistUrl' in layout.values));
  assert.deepEqual(Object.keys(layout.values).sort(), [...DISCOVERY_LAYOUT_KEYS].sort());
  assert.equal(buildDiscoveryLayout('', settings, []).name, 'Saved view');
});

test('stored layouts are cleaned by type, de-duplicated, and capped', { tag: 'unit' }, () => {
  const settings = normalizeSettings({});
  const cleaned = normalizeDiscoveryLayouts([
    // A string where a boolean belongs: dropped at that key rather than pushed
    // into live settings.
    { name: 'mixed', values: { 'layout.density': 'compact', 'layout.wideGrid': 'yes' } },
    { name: 'MIXED', values: { 'layout.density': 'compact' } },
    { name: '   ', values: { 'layout.density': 'compact' } },
    { name: 'unknown keys only', values: { 'content.blocklistUrl': 'https://example.com' } },
    'not an object',
    { name: 'routes', routes: ['browse', 'nope', 'home'], values: { 'layout.density': 'compact' } },
  ], settings);

  assert.deepEqual(cleaned.map((entry) => entry.name), ['mixed', 'routes']);
  assert.deepEqual(cleaned[0].values, { 'layout.density': 'compact' });
  assert.deepEqual(cleaned[1].routes, ['browse', 'home']);

  const many = Array.from({ length: DISCOVERY_LAYOUT_MAX + 6 }, (whole, index) => ({
    name: `layout ${index}`, values: { 'layout.density': 'compact' },
  }));
  assert.equal(normalizeDiscoveryLayouts(many, settings).length, DISCOVERY_LAYOUT_MAX);
  assert.deepEqual(normalizeDiscoveryLayouts(null, settings), []);
});

test('applying a layout moves only what differs, and says what it moved', { tag: 'unit' }, () => {
  const settings = normalizeSettings({});
  const layout = { name: 'dense', routes: ['browse'], values: { 'layout.density': 'compact', 'content.hideCasino': true } };

  const changed = applyDiscoveryLayout(settings, layout);
  assert.deepEqual(changed.sort(), ['content.hideCasino', 'layout.density']);
  assert.equal(settings.layout.density, 'compact');
  assert.equal(settings.content.hideCasino, true);

  // Applying it again moves nothing, so the interface can say so rather than
  // claiming a change that did not happen.
  assert.deepEqual(applyDiscoveryLayout(settings, layout), []);
  assert.deepEqual(applyDiscoveryLayout(settings, null), []);
  assert.equal(layoutMatchesSettings(layout, settings), true);
  settings.layout.density = 'cozy';
  assert.equal(layoutMatchesSettings(layout, settings), false);
  assert.equal(layoutMatchesSettings({ name: 'empty', values: {} }, settings), false);
});

test('a route gets the first layout that claims it, and no other route does', { tag: 'unit' }, () => {
  const first = { name: 'a', routes: ['browse'], values: { 'layout.density': 'compact' } };
  const second = { name: 'b', routes: ['browse', 'home'], values: { 'layout.density': 'cozy' } };
  assert.equal(layoutForRoute([first, second], 'browse').name, 'a');
  assert.equal(layoutForRoute([first, second], 'home').name, 'b');
  assert.equal(layoutForRoute([first, second], 'channel'), null);
  assert.equal(layoutForRoute([first, second], ''), null);
  assert.equal(layoutForRoute([{ name: 'c', routes: [], values: {} }], 'browse'), null);
});
