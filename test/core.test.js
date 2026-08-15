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
  classifyRequest,
  describeInjection,
  detectContentLabels,
  filterDecision,
  isPlaybackUrl,
  neutralizePlaybackPayload,
  nextApplyDelay,
  normalizeStickerPreferences,
  normalizeSettings,
  routeKind,
  sanitizeDiagnosticUrl,
  validateRemoteBlocklist,
  validateImportedSettings,
} from '../src/core.mjs';

test('normalization clamps values and keeps core ad defense enabled', () => {
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

test('v2 migrates the former desktop defaults without overwriting custom layout choices', () => {
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

test('sticker preferences keep pins, removals, and view modes bounded and local', () => {
  const value = normalizeStickerPreferences({
    pinned: ['id:1', ' id:1 ', 'id:2', ''],
    hidden: ['id:2', 'id:3'],
    view: 'pinned',
    showHidden: true,
  });
  assert.deepEqual(value.pinned, ['id:1']);
  assert.deepEqual(value.hidden, ['id:2', 'id:3']);
  assert.equal(value.view, 'pinned');
  assert.equal(value.showHidden, true);

  assert.equal(normalizeStickerPreferences({ view: 'unexpected' }).view, 'all');
  assert.equal(normalizeStickerPreferences(null).showHidden, false);
  assert.equal(normalizeStickerPreferences({ pinned: Array.from({ length: 2401 }, (_, index) => `id:${index}`) }).pinned.length, 2400);
});

test('sticker library keeps portable metadata, custom groups, and one assignment per sticker', () => {
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
      { key: 'id:200', id: '200', name: 'External', src: 'https://tracker.example/emotes/200/fullsize' },
      { key: 'id:300', id: '300', name: 'Protocol relative', src: '//tracker.example/emotes/300/fullsize' },
    ],
  });
  assert.equal(value.schema, 3);
  assert.equal(value.view, 'group');
  assert.equal(value.groups.length, 2);
  assert.deepEqual(value.assignments, [{ key: 'id:100', groupId: 'reactions' }]);
  assert.equal(value.library.length, 2);
  assert.equal(value.library[0].access, 'locked');
  assert.deepEqual(value.library[0].nativeGroups, ['Global']);
  assert.equal(value.library[1].access, 'observed');
  assert.equal(normalizeStickerPreferences({ view: 'group', activeGroup: 'missing' }).view, 'all');
});

test('route classifier covers every audited desktop surface', () => {
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

test('ad hosts and optional telemetry are separated from first-party playback', () => {
  assert.equal(classifyRequest('https://imasdk.googleapis.com/pal/sdkloader/pal.js').category, 'advertising');
  assert.equal(classifyRequest('https://pubads.g.doubleclick.net/adsid/integrator.json').blocked, true);
  assert.equal(classifyRequest('https://4g1csfd6d0egt72a3mo5kgi77.litix.io/', { reduceTelemetry: true }).category, 'telemetry');
  assert.equal(classifyRequest('https://4g1csfd6d0egt72a3mo5kgi77.litix.io/', { reduceTelemetry: false }).blocked, false);
  assert.equal(classifyRequest('https://web.kick.com/api/v1/stream/123/playback', { reduceTelemetry: true }).blocked, false);
});

test('diagnostic URLs never preserve query strings or long identifiers', () => {
  const value = sanitizeDiagnosticUrl('https://web.kick.com/api/v1/stream/01a00174-9260-7c4d-958b-e555d56d4566/playback?token=secret');
  assert.equal(value, 'web.kick.com/api/v1/stream/:id/playback');
  assert.equal(value.includes('secret'), false);
});

test('content labels distinguish casino, mature, promoted, and drops surfaces', () => {
  assert.deepEqual(detectContentLabels('LIVE Slots & Casino 18+ Sponsored Kick Drops'), {
    casino: true,
    mature: true,
    promoted: true,
    drops: true,
  });
});

test('settings import reports malformed and future schemas', () => {
  assert.equal(validateImportedSettings('{oops').ok, false);
  assert.match(validateImportedSettings('{"schema":99}').error, /newer/);
  assert.equal(validateImportedSettings('{"layout":{"chatWidth":410}}').value.layout.chatWidth, 410);
});

test('settings import names whatever it could not keep', () => {
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

test('settings import round-trips the sticker library without treating it as an unknown section', () => {
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
  assert.deepEqual(imported.stickers.assignments, [{ key: 'id:100', groupId: 'memes' }]);
  assert.equal(imported.notes.some((note) => /unknown section "stickers"/.test(note)), false);
  assert.match(validateImportedSettings('{"schema":1,"stickers":{"schema":99}}').error, /Sticker schema 99/);
});

test('remote blocklists accept data-only entries and reject executable or unknown fields', () => {
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

test('filtering fails open when it would hide most of a grid', () => {
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

test('filter ceiling ignores samples too small to judge', () => {
  // A channel page may legitimately show two cards, both filtered.
  assert.equal(filterDecision(FILTER_MIN_SAMPLE - 1, FILTER_MIN_SAMPLE - 1).apply, true);
  assert.equal(filterDecision(0, 0).apply, true);
  assert.equal(filterDecision(1, 1).apply, true);
});

test('filter decision tolerates nonsense counts', () => {
  assert.equal(filterDecision(-3, 5).apply, true);
  assert.equal(filterDecision(10, 999).apply, false);
  assert.equal(filterDecision(undefined, undefined).apply, true);
  assert.equal(filterDecision(10, 999).hidden, 10);
});

test('apply delay is capped so a busy page cannot starve the work', () => {
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

test('structured card evidence outranks prose', () => {
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

test('label detection falls back to text only without structured evidence', () => {
  const fallback = detectContentLabels('Slots & Casino 18+', {});
  assert.equal(fallback.casino, true);
  assert.equal(fallback.mature, true);

  // A localized display name still classifies via the slug.
  assert.equal(detectContentLabels('Tragamonedas', { categories: ['slots'] }).casino, true);

  // Badges present but none matching means the card is genuinely unlabelled.
  assert.equal(detectContentLabels('casino talk', { badges: ['LIVE'], categories: ['irl'] }).casino, false);
});

test('the ceiling yields to an explicit category page', () => {
  // Browsing /category/slots with the casino filter on should empty the page:
  // that is the filter working, not a labelling failure.
  const category = filterDecision(24, 24, { route: 'category' });
  assert.equal(category.apply, true);
  assert.equal(category.reason, 'category-route');

  // The same ratio anywhere else still suspends.
  assert.equal(filterDecision(24, 24, { route: 'browse' }).apply, false);
  assert.equal(filterDecision(24, 24).apply, false);
});

test('playback payloads have their ad flags cleared', () => {
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

test('playback rewriting leaves unrelated or clean payloads alone', () => {
  assert.equal(neutralizePlaybackPayload('not json').changed, false);
  assert.equal(neutralizePlaybackPayload('').changed, false);
  assert.equal(neutralizePlaybackPayload('[1,2,3]').changed, false);
  // Already ad-free: nothing to do, so the body is not rebuilt.
  assert.equal(neutralizePlaybackPayload('{"video_session":{"auto_ads_enabled":false}}').changed, false);
  assert.equal(neutralizePlaybackPayload('{"video_player":{"player":{}}}').changed, false);
});

test('playback URLs are recognised across endpoint shapes', () => {
  assert.equal(isPlaybackUrl('https://web.kick.com/api/v1/stream/abc-123/playback'), true);
  assert.equal(isPlaybackUrl('https://web.kick.com/api/v2/channels/x/playback?foo=1'), true);
  assert.equal(isPlaybackUrl('/stream/abc/playback'), true);
  assert.equal(isPlaybackUrl('https://kick.com/api/v1/channels/xqc'), false);
  assert.equal(isPlaybackUrl('https://stream.kick.com/playbackish/x.m3u8'), false);
  assert.equal(isPlaybackUrl(''), false);
});

test('injection timing is described from what the page already contained', () => {
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

test('ad stack drift is reported instead of passing silently', () => {
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

test('failed writes are named and recovered writes clear themselves', () => {
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

test('storage size is reported largest-first in units a person reads', () => {
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

test('imported keys hidden by the prototype chain are reported, not swallowed', () => {
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

test('ad preflight scripts are matched exactly, not by hostname alone', () => {
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

test('the multi-stream grid dedupes, caps, and keeps audio pointed somewhere', async () => {
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

test('pausing and muting the grid are separate controls', async () => {
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

test('suspended tiles unload, but never the one carrying audio', async () => {
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
