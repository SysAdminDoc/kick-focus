import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSettings } from '../src/settings.mjs';
import {
  DEFAULT_SETTINGS,
  DISCOVERY_LAYOUT_ROUTES,
  DISCOVERY_ROUTE_LABELS,
  HIDEABLE_ELEMENTS,
  HIDEABLE_GROUPS,
  STORAGE_STORES,
  VIEWER_HUB_REASONS,
  VIEWER_HUB_REWARD_WORDS,
  VIEWER_HUB_TITLES,
} from '../src/core.mjs';
import { COLLECTIBLE_FACTS } from '../src/api.mjs';

const EXPECTED_HOST_KEYS = [
  'activeLocale', 'AD_HOSTS', 'applyCostSummary', 'applyStickerLibrarySearch', 'assessAdStack', 'assessApiDrift',
  'BUNDLE_BYTE_CEILING', 'BUNDLE_BYTES', 'INJECTION_BYTE_BUDGET', 'LIBRARY_SEED_BYTES', 'channelPath', 'chatKeywordsForChannel', 'COLLECTIBLE_FACTS',
  'collectViewerFacts', 'companionInfo', 'compatibilitySummary', 'countChangedStickers', 'describeStickerChange',
  'describeLibrarySeed', 'describeStorageFailures', 'DISCOVERY_LAYOUT_ROUTES', 'DISCOVERY_ROUTE_LABELS', 'emoteAccessLabel',
  'emoteLockState', 'emoteReach', 'errorLogRows', 'escapeHtml', 'favoriteCount', 'formatBytes', 'formatSessionWatchTime', 'gmGet',
  'HIDEABLE_ELEMENTS', 'HIDEABLE_GROUPS', 'INJECTION', 'isFavorited', 'lastCrashSummary', 'layoutMatchesSettings',
  'liveStatusSummary', 'localizedStorageFailure', 'localizeInterface', 'MULTISTREAM_MAX', 'ownedEmoteGroups',
  'plural', 'PRE_IMPORT_BACKUP_KEY', 'protectionRows', 'rankSettingsMatches', 'refreshViewerCollectibles',
  'remoteBlocklistSummary', 'renderChatHistoryResults', 'rewardStatusSummary', 'setMarkup', 'settingsFocusSelector',
  'startChannelEmoteImport', 'state', 'STICKER_GROUP_LIMIT', 'STICKER_LIBRARY_LIMIT', 'stickerChangedSinceCapture', 'storageDiagnostics',
  'storageHealth', 'syncEmoteReturnControl', 'TELEMETRY_HOSTS', 'tr', 'trf', 'VERSION', 'VIEWER_HUB_REASONS',
  'resettableSection', 'undoSlotLabel', 'VIEWER_HUB_REWARD_WORDS', 'VIEWER_HUB_TITLES', 'viewerHubCards', 'viewerHubSummary',
].sort();

const RUNTIME_SOURCE = readFileSync(new URL('../src/runtime.js', import.meta.url), 'utf8');

function makeHost() {
  const reads = new Set();
  const state = {
    stickerPreferences: { library: new Map(), hidden: new Set(), groups: [] },
  };
  const values = {
    state,
    BUNDLE_BYTE_CEILING: 1_000_000,
    BUNDLE_BYTES: 850_000,
    INJECTION_BYTE_BUDGET: 950_000,
    LIBRARY_SEED_BYTES: 50_000,
    STICKER_GROUP_LIMIT: 40,
    STICKER_LIBRARY_LIMIT: 2400,
    countChangedStickers: () => 0,
    favoriteCount: () => 0,
    escapeHtml: (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    tr: (value) => String(value),
    trf: (value, fields = {}) => String(value).replace(/\{(\w+)\}/g, (_match, key) => String(fields[key] ?? '')),
    collectViewerFacts: () => ({}),
    viewerHubCards: () => [{ id: 'points', state: 'unavailable', reason: 'signed-out' }],
    VIEWER_HUB_TITLES: { points: 'Channel points' },
    VIEWER_HUB_REASONS: { 'signed-out': 'Sign in to read this.', 'not-read': 'Not read.' },
    VIEWER_HUB_REWARD_WORDS: {},
  };
  const host = new Proxy(values, {
    get(target, key) {
      reads.add(String(key));
      return key in target ? target[key] : () => '';
    },
  });
  return { host, reads };
}

test('the settings factory declares every page-owned dependency through its host', { tags: ['unit'] }, () => {
  const { host, reads } = makeHost();
  const surface = createSettings(host);
  assert.deepEqual([...reads].sort(), EXPECTED_HOST_KEYS);
  assert.deepEqual(Object.keys(surface), [
    'NAV_ITEMS', 'uiIcon', 'stickerLibrarySummary', 'renderViewerHubCards', 'renderSettingsPage',
  ]);
  assert.equal(typeof surface.renderSettingsPage, 'function');
});

test('the runtime supplies every collaborator the settings factory declares', { tags: ['unit'] }, () => {
  const block = RUNTIME_SOURCE.match(/const settingsSurface = createSettings\(\{([\s\S]*?)\n\}\);/);
  assert.ok(block, 'the runtime settings host object could not be found');
  const supplied = [...block[1].matchAll(/^\s{2}([A-Za-z_$][\w$]*),$/gm)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(supplied, EXPECTED_HOST_KEYS);
});

test('the extracted surface still composes navigation, icons, summaries, and viewer cards', { tags: ['unit'] }, () => {
  const { host } = makeHost();
  const surface = createSettings(host);
  assert.deepEqual(surface.NAV_ITEMS.map(([id]) => id), [
    'layout', 'appearance', 'content', 'emotes', 'accessibility', 'viewer', 'about',
  ]);
  assert.match(surface.uiIcon('shield'), /<svg[^>]+><path/);
  assert.match(surface.uiIcon('smile'), /<svg[^>]+><circle/);
  assert.equal(surface.stickerLibrarySummary(), '0 recorded · 0 favorites · 0 removed · 0 custom groups');
  assert.match(surface.renderViewerHubCards(), /data-kf-hub-card="points"/);
  assert.match(surface.renderViewerHubCards(), /Sign in to read this\./);
});

test('About status cards carry success, warning, and neutral semantics', { tags: ['unit'] }, () => {
  const healthy = makeRenderHost().rendered.get('about');
  assert.match(healthy, /Script health<\/span><strong>Active<\/strong>/);
  assert.match(healthy, /data-status="good"><span>Site compatibility<\/span><strong[^>]*>Healthy<\/strong>/);
  assert.match(healthy, /data-status="neutral"><span>Protection layer<\/span><strong>Page only<\/strong>/);

  const degraded = makeRenderHost({
    state: { compatibility: { healthy: false, missing: ['chat'] } },
    values: { INJECTION: { summary: 'after the page began rendering', grade: 'late' } },
  }).rendered.get('about');
  assert.match(degraded, /data-status="warning"><span>Site compatibility<\/span><strong[^>]*>Needs attention<\/strong>/);
  assert.match(degraded, /class="kf-action-row kf-action-warning"/);
});

/**
 * A host complete enough to render all seven pages and hand back their markup.
 *
 * `makeHost` above deliberately answers every unknown key with a stub, which is
 * what makes the dependency-declaration test above exact. That same stub cannot
 * render a page: the renderers read real settings off `state`, so this builds
 * one from `DEFAULT_SETTINGS` and captures what `setMarkup` is handed.
 */
function makeRenderHost({ state: stateOverrides = {}, values: valueOverrides = {}, scratch = null, pageList = [] } = {}) {
  const rendered = new Map();
  const navButtons = ['layout', 'appearance', 'content', 'emotes', 'accessibility', 'viewer', 'about'].map((id) => ({
    dataset: { page: id },
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    scrollIntoView() {},
  }));
  const shell = { dataset: {} };
  const reset = { disabled: false, title: '' };
  const page = {
    dataset: {},
    scrollTop: 0,
    contains: () => false,
    querySelector: () => page,
    querySelectorAll: () => [],
    addEventListener: () => {},
    scrollIntoView: () => {},
    focus: () => {},
    setAttribute: () => {},
    removeAttribute: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  };
  const state = {
    shadow: {
      querySelector: (selector) => {
        if (selector === '[data-kf-settings-shell]') return shell;
        if (selector === '[data-action="reset-page"]') return reset;
        const pageMatch = String(selector).match(/^\[data-page="([^"]+)"\]$/);
        if (pageMatch) return navButtons.find((button) => button.dataset.page === pageMatch[1]) || null;
        return page;
      },
      querySelectorAll: (selector) => (selector === '[data-page]' ? navButtons : []),
      activeElement: null,
    },
    currentPage: 'layout',
    settingsQuery: '',
    settingsIndex: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    channelNotes: {},
    adStack: {},
    chatComfort: { seen: new Set(), sounded: new Set(), rows: [], query: '', composerRecall: [], composerRecallIndex: -1 },
    discoveryLayouts: [],
    filter: {},
    shortcutCapture: null,
    shortcutError: '',
    updateNotice: null,
    compatibility: { healthy: true },
    diagnostics: { apply: [], blocked: 0, lastMatch: '', shells: 0 },
    live: { apiDrift: [], catalog: null, collisions: [], inventory: null, rarity: null },
    multistream: { streams: [] },
    remoteBlocklist: { status: 'off' },
    runtime: {
      suspended: false,
      emoteCatalogError: '', emoteCatalogLoading: false, emoteCatalogSlug: '', emoteCatalogStatus: '',
      stickerLibraryBulkGroup: '', stickerLibraryFilter: 'all', stickerLibraryQuery: '',
      stickerLibrarySelection: new Set(),
    },
    stickerPreferences: { library: new Map(), hidden: new Set(), groups: [], assignments: new Map() },
  };
  const values = {
    state,
    BUNDLE_BYTE_CEILING: 1_000_000,
    BUNDLE_BYTES: 850_000,
    INJECTION_BYTE_BUDGET: 950_000,
    LIBRARY_SEED_BYTES: 50_000,
    STICKER_GROUP_LIMIT: 40,
    STICKER_LIBRARY_LIMIT: 2400,
    VERSION: '0.0.0-test',
    AD_HOSTS: [],
    // The real catalogs, not stubs: a grid built from an empty list would let
    // this gate pass over pages that render nothing.
    COLLECTIBLE_FACTS,
    DISCOVERY_LAYOUT_ROUTES,
    DISCOVERY_ROUTE_LABELS,
    HIDEABLE_ELEMENTS,
    HIDEABLE_GROUPS,
    STORAGE_STORES,
    TELEMETRY_HOSTS: [],
    INJECTION: { summary: 'at document-start' },
    NAV_ITEMS: pageList,
    escapeHtml: (value) => String(value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    tr: (value) => String(value),
    trf: (value, fields = {}) => String(value).replace(/\{(\w+)\}/g, (_m, key) => String(fields[key] ?? '')),
    plural: (count, one, other) => (count === 1 ? one : other),
    setMarkup: (node, markup) => {
      // The scratch element the search index renders into is not the page, so it
      // is recorded separately rather than overwriting the page's own markup.
      if (scratch && node === scratch) scratch.markup = markup;
      else { rendered.set(state.currentPage, markup); state.lastMarkup = markup; }
    },
    storageHealth: { failures: {}, lastError: '', librarySeed: { truncated: 0, total: 0 } },
    storageDiagnostics: () => ({ total: 0, breakdown: [] }),
    describeStorageFailures: () => null,
    describeLibrarySeed: () => null,
    activeLocale: () => 'en',
    channelPath: () => '',
    chatKeywordsForChannel: () => [],
    companionInfo: () => ({ active: false, version: '' }),
    compatibilitySummary: () => '',
    countChangedStickers: () => 0,
    favoriteCount: () => 0,
    formatBytes: (bytes) => `${bytes} B`,
    applyCostSummary: () => 'No apply cycle has run yet.',
    applyStickerLibrarySearch: () => {},
    assessAdStack: () => ({ status: 'unknown', drifted: false, summary: '' }),
    assessApiDrift: () => ({ drifted: false, summary: '' }),
    collectViewerFacts: () => ({}),
    // Faithful to what core returns: every card carries a source, and a stub
    // that omits one renders data-kf-source="undefined" into the page.
    viewerHubCards: () => [{ id: 'points', source: 'dom', state: 'unavailable', reason: 'anonymous' }],
    viewerHubSummary: () => ({ ready: 0, total: 1, stale: 0, errors: 0, fromDom: [], fromApi: [], fromLocal: [] }),
    // The real catalogs, like the others above. Hand-written stubs covered one
    // card id, so a page rendering a second one printed "undefined" as its
    // title and this proved nothing about the rest of the hub.
    VIEWER_HUB_TITLES,
    VIEWER_HUB_REASONS,
    VIEWER_HUB_REWARD_WORDS,
    errorLogRows: () => [],
    localizeInterface: () => {},
  };
  // Scenario overrides are applied after the defaults are built, one level
  // deep, so a scenario can replace `runtime` wholesale or patch a single field
  // of it without restating the rest.
  for (const [key, value] of Object.entries(stateOverrides)) {
    const patchable = value && typeof value === 'object' && !Array.isArray(value)
      && !(value instanceof Set) && !(value instanceof Map);
    state[key] = patchable ? { ...state[key], ...value } : value;
  }
  Object.assign(values, valueOverrides);

  const host = new Proxy(values, {
    get(target, key) {
      if (key in target) return target[key];
      // Unknown collaborators answer with an empty array: it interpolates to
      // the empty string like a missing value should, and still supports the
      // map/reduce/join a renderer does to a list.
      return () => [];
    },
  });
  const surface = createSettings(host);
  const pages = ['layout', 'appearance', 'content', 'emotes', 'accessibility', 'viewer', 'about'];
  for (const id of pages) {
    state.currentPage = id;
    surface.renderSettingsPage();
  }
  return { rendered, pages, state, surface, host, navButtons, reset, shell };
}

/** Attribute values are escaped and headings are not, so compare decoded text. */
function decodeEntities(value) {
  return String(value)
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"').replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

/** Every `<div class="kf-row…">` in a page, with its heading and its markup. */
function settingRows(markup) {
  return String(markup).split('<div class="kf-row').slice(1).map((chunk) => ({
    title: decodeEntities((chunk.match(/<h3>([^<]*)/) || [, ''])[1]),
    markup: chunk,
  }));
}

test('every settings control takes its accessible name from the row it sits in', { tags: ['unit'] }, () => {
  const { rendered, pages } = makeRenderHost();
  assert.deepEqual([...rendered.keys()], pages, 'a page rendered nothing at all');

  let checked = 0;
  for (const [id, markup] of rendered) {
    // The substitution token must never survive into markup: a control rendered
    // outside a `row` would otherwise announce itself as "__KF_ROW_LABEL__".
    assert.equal(markup.includes('__KF_ROW_LABEL__'), false,
      `the ${id} page shipped an unsubstituted row label`);
    // A renderer that quietly produced nothing would satisfy every assertion
    // below it, so each page has to have actually rendered something.
    assert.ok(markup.length > 900, `the ${id} page rendered only ${markup.length} characters`);

    for (const row of settingRows(markup)) {
      if (!row.title) continue;
      // The row's own setting controls only. A row can also hold chips, a
      // preview, or a free-text field, and each of those carries a name of its
      // own that is correctly not the heading.
      // `toggle` and `range` carry data-set and aria-label on one element;
      // `segmented` puts the name on the role="group" wrapper and data-set on
      // its child buttons, so matching on data-set alone skipped every
      // segmented control, which is half of what this test exists to check.
      const tags = [
        ...row.markup.matchAll(/<[^>]*\bdata-set="[^"]*"[^>]*>/g),
        ...row.markup.matchAll(/<div class="kf-segmented"[^>]*>/g),
      ];
      for (const [tag] of tags) {
        const raw = (tag.match(/aria-label="([^"]*)"/) || [])[1];
        const label = raw === undefined ? undefined : decodeEntities(raw);
        if (label === undefined) continue;
        checked += 1;
        // WCAG 2.5.3: the accessible name has to contain the visible label, or
        // a voice-control user cannot say the words they can see. These used to
        // be built from the dotted setting path, so the row headed "Refresh
        // interval" answered to "Blocklist Refresh Hours".
        assert.ok(label.includes(row.title),
          `${id}: the row "${row.title}" has a control named "${label}"`);
      }
    }
  }
  assert.ok(checked >= 65, `only ${checked} named controls were reachable (70 today), so this gate is not covering the panel`);
});


/**
 * The states each page has to survive, not just the one a fresh profile is in.
 *
 * Every renderer here branches on stored data, on runtime state, and on things
 * having gone wrong, and none of those branches were rendered by anything: the
 * page was measured at 49% branch coverage while reading as "covered", because
 * one pass over seven default pages touches the happy path of each and nothing
 * else. Each scenario below is a state a real profile reaches.
 */
const SCENARIOS = [
  ['a fresh profile', {}],
  ['a used profile', {
    state: {
      channelNotes: { xqc: 'remember the setup stream' },
      discoveryLayouts: [{ id: 'l1', name: 'Evenings', routes: ['home'], settings: {} }],
      multistream: { streams: ['alpha', 'beta'], focus: 'alpha' },
      settings: {
        ...structuredClone(DEFAULT_SETTINGS),
        layout: { ...DEFAULT_SETTINGS.layout, hidden: [HIDEABLE_ELEMENTS[0].id] },
        content: { ...DEFAULT_SETTINGS.content, blocklistSubscription: true, blocklistUrl: 'https://feeds.example/l.json', hiddenChannels: ['/spamchannel'] },
      },
      remoteBlocklist: { status: 'ok', source: 'https://feeds.example/l.json', fetchedAt: 1, channels: new Set(['spam']) },
      stickerPreferences: {
        library: new Map([['kick:1', { key: 'kick:1', name: 'PogU', src: 'https://files.kick.com/e/1', access: 'available', nativeGroups: ['Global'], sourceSlug: 'xqc', firstSeen: 1, lastSeen: 2 }]]),
        hidden: new Set(['kick:2']),
        groups: [{ id: 'g1', name: 'Favourites' }],
        assignments: new Map([['kick:1', 'g1']]),
      },
    },
    values: {
      favoriteCount: () => 3,
      countChangedStickers: () => 2,
      chatKeywordsForChannel: () => ['raid', 'clip'],
      channelPath: () => '/xqc',
      companionInfo: () => ({ active: true, version: '1.0.0' }),
      storageDiagnostics: () => ({ total: 12_345, breakdown: [['library', 9000], ['settings', 3345]] }),
      // errorLogRows returns table-row markup, not records. A stub that
      // returns records renders "[object Object]" into the page.
      errorLogRows: () => '<tr><td>00:00:01</td><td>apply cycle</td><td>something</td></tr>',
    },
  }],
  ['things going wrong', {
    state: {
      compatibility: { healthy: false, missing: ['chat'] },
      live: { apiDrift: [{ endpoint: 'channel', at: 1 }], catalog: null, collisions: [], inventory: null, rarity: null },
      runtime: { emoteCatalogError: 'Kick refused the catalog', suspended: true },
      remoteBlocklist: { status: 'error', source: 'https://feeds.example/l.json' },
    },
    values: {
      storageHealth: { failures: { settings: 'QuotaExceededError' }, lastError: 'QuotaExceededError', librarySeed: { truncated: 40, total: 240 } },
      describeStorageFailures: () => ({ message: 'Settings could not be saved.', keys: ['settings'] }),
      describeLibrarySeed: () => ({ truncated: 40, held: 200, messageKey: 'The first paint reads {held} of your {total} emotes.', values: { held: 200, total: 240 } }),
      assessAdStack: () => ({ summary: 'The ad stack changed shape.', drifted: true }),
      assessApiDrift: () => ({ summary: 'One endpoint changed shape.', drifted: true }),
      compatibilitySummary: () => 'chat is missing',
    },
  }],
  ['every switch the other way', {
    state: {
      // A panel is a wall of two-state controls, and rendering only the
      // defaults renders exactly one side of each. Flipping every boolean is
      // the cheapest way to make the other side of every one of them run.
      settings: (() => {
        const flipped = structuredClone(DEFAULT_SETTINGS);
        for (const section of Object.keys(flipped)) {
          if (!flipped[section] || typeof flipped[section] !== 'object') continue;
          for (const [key, value] of Object.entries(flipped[section])) {
            if (typeof value === 'boolean') flipped[section][key] = !value;
          }
        }
        return flipped;
      })(),
    },
  }],
  ['the library, mid-edit', {
    state: {
      runtime: {
        stickerLibraryFilter: 'removed',
        stickerLibraryQuery: 'pog',
        stickerLibraryBulkGroup: 'g1',
        stickerLibrarySelection: new Set(['kick:1']),
        emoteCatalogLoading: true,
        emoteCatalogSlug: 'xqc',
        emoteCatalogStatus: 'Reading Kick\u2019s catalog',
      },
      stickerPreferences: {
        library: new Map([
          ['kick:1', { key: 'kick:1', name: 'PogU', src: 'https://files.kick.com/e/1', access: 'available', nativeGroups: ['Global'], sourceSlug: 'xqc', firstSeen: 1, lastSeen: 2 }],
          ['kick:2', { key: 'kick:2', name: 'Sadge', src: 'https://files.kick.com/e/2', access: 'locked', nativeGroups: [], sourceSlug: '', firstSeen: 1, lastSeen: 2, wasName: 'Sad' }],
        ]),
        hidden: new Set(['kick:2']),
        groups: [{ id: 'g1', name: 'Favourites' }, { id: 'g2', name: 'Reactions' }],
        assignments: new Map([['kick:1', 'g1']]),
      },
    },
    values: {
      favoriteCount: () => 1,
      countChangedStickers: () => 1,
      // The library sort puts favorites first and removed last, so without a
      // favorite the comparator only ever runs one of its three branches.
      isFavorited: (key) => key === 'kick:1',
    },
  }],
  ['a signed-in emote account', {
    state: {
      runtime: { stickerLibraryFilter: 'mine' },
      live: {
        apiDrift: [], collisions: [{ name: 'PogU', winner: { setName: 'xqc' }, shadowed: [{ setName: 'Global' }] }],
        rarity: { matched: ['a', 'b'], unmatched: ['c'], total: 3 },
        // The real rarity shape, so the panel that reports it renders instead
        // of throwing: a partial stub here would have proved nothing.
        catalog: { account: { authenticated: true, ownedEmotes: 12, ownedSets: ['xqc', 'trainwreck'] } },
        inventory: { copies: 42, distinct: 21, duplicates: 21, duplicateRate: 0.5 },
      },
      stickerPreferences: {
        library: new Map([
          ['kick:1', { key: 'kick:1', name: 'PogU', src: 'https://files.kick.com/e/1', access: 'available', nativeGroups: ['Global'], sourceSlug: 'xqc', firstSeen: 1, lastSeen: 2 }],
        ]),
        hidden: new Set(),
        groups: [],
        assignments: new Map(),
      },
    },
    values: {
      ownedEmoteGroups: (library) => [
        { id: 'global', label: 'Global collection', source: '', entries: library },
        { id: 'xqc', label: 'xqc', source: 'xqc', entries: library },
      ],
    },
  }],
  ['an inventory Kick will not count', {
    state: {
      live: {
        apiDrift: [], collisions: [], rarity: null,
        catalog: { account: { authenticated: true, ownedEmotes: 0, ownedSets: [] } },
        // Kick's response carries no per-item quantity here, so the duplicate
        // rate is unavailable rather than zero, and the copy has to say so.
        inventory: { distinct: 7, copies: 0, duplicates: 0, duplicateRate: null },
      },
    },
  }],
  ['a signed-in viewer', {
    values: {
      // 'ready' is the state the renderer reads a value in; anything else is a
      // reason. Using the wrong word would have made this test assert nothing.
      viewerHubCards: () => [
        { id: 'points', state: 'ready', value: 1200, source: 'dom', stale: false, observedAt: 0 },
        { id: 'watch', state: 'ready', value: 41_000, source: 'local', stale: false, observedAt: 0 },
      ],
      // The real shape hubSourceSummary reads, not a guess at it: a summary
      // missing these lists throws rather than rendering a worse sentence.
      viewerHubSummary: () => ({
        ready: 2, total: 2, stale: 0, errors: 0,
        fromDom: ['points'], fromApi: [], fromLocal: ['watch'],
      }),
      collectViewerFacts: () => ({ points: 1200 }),
    },
  }],
];

function scenario(name) {
  const found = SCENARIOS.find(([label]) => label === name);
  assert.ok(found, `no scenario named ${name}`);
  return found[1];
}

function renderAllScenarios() {
  return SCENARIOS.map(([name, options]) => [name, makeRenderHost(options)]);
}

test('every settings page renders in every state a real profile reaches', { tags: ['unit'] }, () => {
  for (const [name, { rendered, pages }] of renderAllScenarios()) {
    assert.deepEqual([...rendered.keys()], pages, `${name}: a page rendered nothing at all`);
    for (const [id, markup] of rendered) {
      assert.ok(markup.length > 900, `${name}: the ${id} page rendered only ${markup.length} characters`);
      assert.equal(markup.includes('__KF_ROW_LABEL__'), false, `${name}: the ${id} page shipped an unsubstituted row label`);
      assert.equal(markup.includes('undefined'), false, `${name}: the ${id} page rendered the word undefined`);
      assert.equal(markup.includes('[object Object]'), false, `${name}: the ${id} page rendered an object as text`);
      assert.equal(/\bNaN\b/.test(markup), false, `${name}: the ${id} page rendered NaN`);
    }
  }
});

test('no page ships a placeholder it never filled in', { tags: ['unit'] }, () => {
  // trf substitutes {name} style fields. One that is never supplied leaves the
  // brace form in the markup, which is the shape of a sentence with a hole in
  // it — and it renders as literal text rather than failing.
  for (const [name, { rendered }] of renderAllScenarios()) {
    for (const [id, markup] of rendered) {
      const text = markup.replace(/<[^>]*>/g, ' ');
      const leftovers = [...text.matchAll(/\{[a-z][A-Za-z0-9_]*\}/g)].map((match) => match[0]);
      assert.deepEqual(leftovers, [], `${name}: the ${id} page shipped an unfilled placeholder`);
    }
  }
});

test('every control writes to a setting that exists', { tags: ['unit'] }, () => {
  // A data-set path is what updateSetting is handed. A typo there is silent:
  // updateSetting returns early on an unknown key, so the control renders,
  // responds, announces a save, and changes nothing at all.
  const seen = new Set();
  for (const [name, { rendered }] of renderAllScenarios()) {
    for (const [id, markup] of rendered) {
      for (const match of markup.matchAll(/data-set="([^"]+)"/g)) {
        const path = match[1];
        seen.add(path);
        const [section, key, ...rest] = path.split('.');
        assert.equal(rest.length, 0, `${name}: ${id} has a nested setting path: ${path}`);
        assert.ok(section in DEFAULT_SETTINGS, `${name}: ${id} writes to an unknown section: ${path}`);
        assert.ok(key in DEFAULT_SETTINGS[section], `${name}: ${id} writes to an unknown setting: ${path}`);
      }
    }
  }
  // A floor, so a renderer that stopped emitting controls cannot pass this by
  // having nothing to check.
  assert.ok(seen.size >= 40, `only ${seen.size} distinct settings are reachable from the panel`);
});

test('a page says what is wrong rather than rendering as though it were fine', { tags: ['unit'] }, () => {
  const fresh = new Map(makeRenderHost().rendered);
  const broken = new Map(makeRenderHost(scenario('things going wrong')).rendered);

  // The About page is where storage failures, drift and compatibility live.
  assert.notEqual(broken.get('about'), fresh.get('about'),
    'the About page reads the same whether or not saving is failing');
  assert.match(broken.get('about'), /could not be saved|QuotaExceeded/i,
    'a failing write is not reported on the page that reports storage');

  // And the emotes page has to surface a refused catalog rather than an empty
  // grid that looks like "you have no emotes".
  assert.notEqual(broken.get('emotes'), fresh.get('emotes'),
    'a refused emote catalog renders identically to an empty one');
});

test('a used profile renders more than an empty one, on the pages that hold data', { tags: ['unit'] }, () => {
  const fresh = new Map(makeRenderHost().rendered);
  const used = new Map(makeRenderHost(scenario('a used profile')).rendered);
  for (const id of ['emotes', 'about']) {
    assert.notEqual(used.get(id), fresh.get(id),
      `the ${id} page ignores stored data entirely, so its empty state is its only state`);
  }
});

test('a signed-in viewer hub reads differently from an anonymous one', { tags: ['unit'] }, () => {
  const anonymous = new Map(makeRenderHost().rendered).get('viewer');
  const signedIn = new Map(makeRenderHost(scenario('a signed-in viewer')).rendered).get('viewer');
  assert.notEqual(signedIn, anonymous, 'the Viewer page renders the same signed in or out');
  assert.match(anonymous, /signed-in account only/, 'an anonymous hub does not explain itself');
  assert.match(signedIn, /1,200|1200/, 'a signed-in reading never reaches the page');
});

/**
 * Just enough document for the settings search index.
 *
 * `settingsSearchIndex` renders every page into a scratch element and walks the
 * result for row headings, so with no `document` it throws on its first line
 * and the whole search feature — the index, the ranking, and the results
 * markup — is unreachable offline. It was the largest uncovered block here.
 *
 * Deliberately not a DOM: it answers the three calls that function makes,
 * against the markup it was just handed. Anything richer belongs in the live
 * gate, which has a real engine.
 */
function installScratchDocument() {
  const scratch = { markup: '' };
  const textOf = (chunk, tag) => {
    const match = chunk.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return match ? decodeEntities(match[1]).trim() : '';
  };
  scratch.querySelectorAll = (selector) => {
    const rows = [];
    for (const cls of selector.split(',').map((part) => part.trim().replace(/^\./, ''))) {
      for (const chunk of scratch.markup.split(`<div class="${cls}`).slice(1)) {
        rows.push({
          querySelector: (tag) => {
            const text = textOf(chunk, tag.replace(/[^a-z0-9]/gi, ''));
            return text ? { textContent: text } : null;
          },
        });
      }
    }
    return rows;
  };
  const had = 'document' in globalThis;
  const previous = globalThis.document;
  globalThis.document = { createElement: () => scratch };
  // Restoring an absent global means deleting it, not assigning undefined:
  // the second leaves an own property behind that `in` still finds.
  return {
    scratch,
    restore: () => {
      if (had) globalThis.document = previous;
      else delete globalThis.document;
    },
  };
}

const NAV = [
  ['layout', 'Layout'], ['appearance', 'Appearance'], ['content', 'Content & Ads'],
  ['emotes', 'Emotes'], ['accessibility', 'Accessibility'], ['viewer', 'Viewer'], ['about', 'About'],
];

test('the settings search indexes every page and ranks what it finds', { tags: ['unit'] }, () => {
  const { scratch, restore } = installScratchDocument();
  try {
    const { state, surface, host, navButtons, reset, shell } = makeRenderHost({ scratch, pageList: NAV });
    assert.equal(host.NAV_ITEMS.length, 7, 'the index is being built from an empty page list');

    state.settingsQuery = 'chat';
    state.settingsIndex = null;
    surface.renderSettingsPage();
    const hits = state.lastMarkup;
    assert.ok(hits.length > 200, 'searching rendered nothing at all');
    assert.match(hits, /chat/i, 'a query matching many rows produced no visible match');
    assert.ok(navButtons.every((button) => button.attributes['aria-current'] === 'false'),
      'search results left a page selected in the navigation');
    assert.equal(reset.disabled, true, 'search results inherited the previous page reset action');
    assert.equal(shell.dataset.kfCurrentPage, 'search');

    // The index is cached, because rebuilding it renders five pages and that
    // would otherwise happen on every keystroke.
    assert.ok(Array.isArray(state.settingsIndex) && state.settingsIndex.length > 10,
      'the index was not built, so the search is ranking nothing');
    const cached = state.settingsIndex;
    state.settingsQuery = 'chat';
    surface.renderSettingsPage();
    assert.equal(state.settingsIndex, cached, 'the index was rebuilt on a second search');

    // A query that matches nothing has to say so rather than render an empty
    // panel that reads like a broken page.
    state.settingsQuery = 'zzzzzznotathing';
    surface.renderSettingsPage();
    assert.notEqual(state.lastMarkup, hits, 'a query with no matches renders the same as one with matches');

    // A one-letter query opens nothing on purpose: it matches most of the panel.
    state.settingsQuery = 'c';
    surface.renderSettingsPage();
    assert.ok(state.lastMarkup.length > 0);
  } finally {
    restore();
  }
});

test('every setting that exists has a control that reaches it', { tags: ['unit'] }, () => {
  // The other direction from the test above. That one catches a control
  // writing to a setting that is not there; this catches a setting that
  // normalizes correctly, round-trips through export and import, and has no
  // control anywhere — a preference a user can never actually change.
  const reachable = new Set();
  for (const [, { rendered }] of renderAllScenarios()) {
    for (const [, markup] of rendered) {
      for (const match of markup.matchAll(/data-set="([^"]+)"/g)) reachable.add(match[1]);
    }
  }

  // Two are bookkeeping rather than preferences: the schema stamp an import
  // reads, and the version this profile last saw an update note for. Neither
  // is something to offer a control for.
  const NOT_A_PREFERENCE = new Set(['schema', 'lastSeenVersion']);

  // Two more are lists rather than switches, so their controls are not
  // data-set attributes. Each is named with the control that writes it, and
  // asserted to still be there, so an allowlist entry cannot outlive the
  // control it excuses.
  const LIST_CONTROLS = new Map([
    ['layout.hidden', 'data-action="toggle-hidden-element"'],
    ['content.hiddenChannels', 'data-action="remove-hidden-channel"'],
  ]);
  const everyPage = [...renderAllScenarios().flatMap(([, { rendered }]) => [...rendered.values()])].join('');
  for (const [path, marker] of LIST_CONTROLS) {
    assert.ok(everyPage.includes(marker),
      `${path} is allowlisted because ${marker} writes it, and that control is no longer rendered`);
  }

  const unreachable = [];
  for (const [section, values] of Object.entries(DEFAULT_SETTINGS)) {
    if (NOT_A_PREFERENCE.has(section)) continue;
    if (!values || typeof values !== 'object') continue;
    for (const key of Object.keys(values)) {
      const path = `${section}.${key}`;
      if (NOT_A_PREFERENCE.has(key) || reachable.has(path) || LIST_CONTROLS.has(path)) continue;
      unreachable.push(path);
    }
  }

  assert.deepEqual(unreachable, [], 'these settings normalize and persist but no control can change them');
});

test('every page renders through the translator, on every page', { tags: ['unit'] }, () => {
  // The harness stubs `tr` as the identity, so nothing here had ever been
  // rendered in a locale other than English and a page that bypassed the
  // translator entirely would have looked identical.
  //
  // The panel is translated by a DOM walker after render, not by tr() at
  // render time, so this cannot assert that headings come out translated. What
  // it can assert is the property the walker depends on: the strings a walker
  // can never reach — the ones written into attributes and into markup by
  // script — do go through tr/trf, and a page rendered with a marking
  // translator shows it.
  const marked = makeRenderHost({ values: { tr: (value) => `«${String(value)}»`, trf: (value, fields = {}) => `«${String(value).replace(/\{(\w+)\}/g, (_m, key) => String(fields[key] ?? ''))}»` } });
  const plain = makeRenderHost();

  let translatedPages = 0;
  for (const id of marked.pages) {
    const localized = marked.rendered.get(id);
    const english = plain.rendered.get(id);
    assert.notEqual(localized, english, `the ${id} page renders identically in every language`);
    assert.ok(localized.includes('«'), `the ${id} page passes nothing through the translator`);
    translatedPages += 1;

    // And the marker must not leak into an attribute value that is a machine
    // token rather than prose: a translated data-set path would stop matching
    // a setting.
    for (const match of localized.matchAll(/data-(set|action|page)="([^"]*)"/g)) {
      assert.ok(!match[2].includes('«'), `the ${id} page translated a machine token: ${match[0]}`);
    }
  }
  assert.equal(translatedPages, 7);
});
