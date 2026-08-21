import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettings } from '../src/settings.mjs';

const EXPECTED_HOST_KEYS = [
  'activeLocale', 'AD_HOSTS', 'applyCostSummary', 'applyStickerLibrarySearch', 'assessAdStack', 'assessApiDrift',
  'BUNDLE_BYTE_CEILING', 'BUNDLE_BYTES', 'channelPath', 'chatKeywordsForChannel', 'COLLECTIBLE_FACTS',
  'collectViewerFacts', 'companionInfo', 'compatibilitySummary', 'countChangedStickers', 'describeStickerChange',
  'describeStorageFailures', 'DISCOVERY_LAYOUT_ROUTES', 'DISCOVERY_ROUTE_LABELS', 'emoteAccessLabel',
  'emoteLockState', 'emoteReach', 'errorLogRows', 'escapeHtml', 'favoriteCount', 'formatBytes', 'gmGet',
  'HIDEABLE_ELEMENTS', 'HIDEABLE_GROUPS', 'INJECTION', 'isFavorited', 'lastCrashSummary', 'layoutMatchesSettings',
  'liveStatusSummary', 'localizedStorageFailure', 'localizeInterface', 'MULTISTREAM_MAX', 'ownedEmoteGroups',
  'plural', 'PRE_IMPORT_BACKUP_KEY', 'protectionRows', 'rankSettingsMatches', 'refreshViewerCollectibles',
  'remoteBlocklistSummary', 'renderChatHistoryResults', 'rewardStatusSummary', 'setMarkup', 'settingsFocusSelector',
  'startChannelEmoteImport', 'state', 'STICKER_LIBRARY_LIMIT', 'stickerChangedSinceCapture', 'storageDiagnostics',
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
    'layout', 'appearance', 'content', 'accessibility', 'viewer', 'about',
  ]);
  assert.match(surface.uiIcon('shield'), /<svg[^>]+><path/);
  assert.equal(surface.stickerLibrarySummary(), '0 recorded · 0 favorites · 0 removed · 0 custom groups');
  assert.match(surface.renderViewerHubCards(), /data-kf-hub-card="points"/);
  assert.match(surface.renderViewerHubCards(), /Sign in to read this\./);
});
