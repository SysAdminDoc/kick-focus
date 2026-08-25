import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettings } from '../src/settings.mjs';
import {
  DEFAULT_SETTINGS,
  DISCOVERY_LAYOUT_ROUTES,
  DISCOVERY_ROUTE_LABELS,
  HIDEABLE_ELEMENTS,
  HIDEABLE_GROUPS,
  STORAGE_STORES,
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
  'storageHealth', 'TELEMETRY_HOSTS', 'tr', 'trf', 'VERSION', 'VIEWER_HUB_REASONS',
  'VIEWER_HUB_REWARD_WORDS', 'VIEWER_HUB_TITLES', 'viewerHubCards', 'viewerHubSummary',
].sort();

function makeHost() {
  const reads = new Set();
  const state = {
    stickerPreferences: { library: new Map(), hidden: new Set(), groups: [] },
  };
  const values = {
    state,
    BUNDLE_BYTE_CEILING: 1_000_000,
    BUNDLE_BYTES: 850_000,
    INJECTION_BYTE_BUDGET: 925_000,
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

test('the settings factory declares every page-owned dependency through its host', { tag: 'unit' }, () => {
  const { host, reads } = makeHost();
  const surface = createSettings(host);
  assert.deepEqual([...reads].sort(), EXPECTED_HOST_KEYS);
  assert.deepEqual(Object.keys(surface), [
    'NAV_ITEMS', 'uiIcon', 'stickerLibrarySummary', 'renderViewerHubCards', 'renderSettingsPage',
  ]);
  assert.equal(typeof surface.renderSettingsPage, 'function');
});

test('the extracted surface still composes navigation, icons, summaries, and viewer cards', { tag: 'unit' }, () => {
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

/**
 * A host complete enough to render all seven pages and hand back their markup.
 *
 * `makeHost` above deliberately answers every unknown key with a stub, which is
 * what makes the dependency-declaration test above exact. That same stub cannot
 * render a page: the renderers read real settings off `state`, so this builds
 * one from `DEFAULT_SETTINGS` and captures what `setMarkup` is handed.
 */
function makeRenderHost() {
  const rendered = new Map();
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
    shadow: { querySelector: () => page, querySelectorAll: () => [], activeElement: null },
    currentPage: 'layout',
    settingsQuery: '',
    settingsIndex: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    channelNotes: {},
    adStack: {},
    chatComfort: { seen: new Set(), sounded: new Set() },
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
    INJECTION_BYTE_BUDGET: 925_000,
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
    NAV_ITEMS: [],
    escapeHtml: (value) => String(value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    tr: (value) => String(value),
    trf: (value, fields = {}) => String(value).replace(/\{(\w+)\}/g, (_m, key) => String(fields[key] ?? '')),
    plural: (count, one, other) => (count === 1 ? one : other),
    setMarkup: (node, markup) => rendered.set(state.currentPage, markup),
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
    assessAdStack: () => ({ summary: '' }),
    assessApiDrift: () => ({ summary: '' }),
    collectViewerFacts: () => ({}),
    viewerHubCards: () => [{ id: 'points', state: 'unavailable', reason: 'signed-out' }],
    viewerHubSummary: () => '',
    VIEWER_HUB_TITLES: { points: 'Channel points' },
    VIEWER_HUB_REASONS: { 'signed-out': 'Sign in to read this.', 'not-read': 'Not read.' },
    VIEWER_HUB_REWARD_WORDS: {},
    errorLogRows: () => [],
    localizeInterface: () => {},
  };
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
  return { rendered, pages };
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

test('every settings control takes its accessible name from the row it sits in', { tag: 'unit' }, () => {
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
