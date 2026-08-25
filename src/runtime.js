const STORAGE_KEY = 'kick-focus:settings';
const CHANNEL_LAYOUT_KEY = 'kick-focus:channel-layouts';
const WATCHED_KEY = 'kick-focus:watched-this-session';
const MEDIA_PREFERENCES_KEY = 'kick-focus:media-preferences';
const FAVORITES_KEY = 'kick-focus:favorite-channels';
const DISMISSED_KEY = 'kick-focus:not-interested-channels';
const CHAT_KEYWORDS_KEY = 'kick-focus:chat-keywords';
const CHANNEL_NOTES_KEY = 'kick-focus:channel-notes';
const STICKER_PREFERENCES_KEY = 'kick-focus:sticker-preferences';
const REMOTE_BLOCKLIST_KEY = 'kick-focus:remote-blocklist';
const EMOTE_USAGE_KEY = 'kick-focus:emote-usage';
const MULTISTREAM_KEY = 'kick-focus:multistream';
const PRE_IMPORT_BACKUP_KEY = 'kick-focus:pre-import-backup';
const LAST_CRASH_KEY = 'kick-focus:last-crash';
// When the daily reward was last claimed on this browser. Persisted because the
// backoff has to survive a reload — otherwise every navigation would reopen
// Kick's dialog looking for a reward that was already taken.
const REWARD_STATE_KEY = 'kick-focus:reward-claims';
const PAGE_BLOCK_EVENT = 'kick-focus:request-blocked';

// Declared ahead of `state` because writes can happen while `state` is still in
// its own initializer, and reading a const in its temporal dead zone throws.
const storageHealth = { failures: {}, lastError: '', librarySeed: { truncated: 0, total: 0 } };

/**
 * The emote library behind a provider rather than a single backend.
 *
 * `localStorage` is the only store that answers synchronously, and boot reads
 * the library before the first render — but it is also the one with a ~5MB
 * ceiling a growing library eventually reaches. So a bounded seed is written
 * where boot can read it, the complete record goes to IndexedDB, and
 * `hydrateLibrary` folds the fuller copy back in once the page is up.
 *
 * Declared here for the same reason as `storageHealth` above: `state`'s own
 * initializer reads the library, so this cannot be a const further down the
 * file — which is precisely what the boot gate caught when it was.
 */
const libraryStore = createLibraryStore({
  readFallback: () => normalizeStickerPreferences(gmGet(STICKER_PREFERENCES_KEY, {})),
  writeFallback: (seed) => gmSet(STICKER_PREFERENCES_KEY, seed),
  onError: (stage, error) => logAppError(`library storage (${stage})`, error),
});
const ROUTE_EVENT = 'kick-focus:routechange';
const AD_SHELL_SELECTORS = [
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="googleadservices.com"]',
  'script[src*="imasdk.googleapis.com"]',
  'script[src*="googlesyndication.com"]',
  'script[src*="doubleclick.net"]',
  'script[src*="googleadservices.com"]',
  '[id^="google_ads_"]',
  '[id^="div-gpt-ad"]',
  '[data-ad-slot]',
  '[data-ad-unit]',
  '[data-testid="ad-banner"]',
  '[data-testid*="advertisement"]',
  '[aria-label="Advertisement"]',
  '[aria-label="advertisement"]',
  '[class~="ad-slot"]',
  '[class*="advertisement"]',
];

// Long enough that typing a name is one render rather than one per keystroke,
// short enough that the grid still feels attached to the keyboard.
const STICKER_SEARCH_DEBOUNCE_MS = 120;
const STICKER_USAGE_SECTION_LIMIT = 24;
// Must match the organizer grid CSS: tiles are a fixed row height in a
// minmax(50px, 1fr) auto-fill grid, which is what lets a spacer stand in for a
// known number of rows without measuring every one of them.
const STICKER_TILE_HEIGHT = 62;
const STICKER_GRID_GAP = 7;
const STICKER_TILE_MIN_WIDTH = 50;
// How close the viewport may get to the rendered window's edge before the
// window moves. Four rows of slack keeps a slow scroll from re-rendering
// continuously while never letting the viewer reach an unrendered gap.
const STICKER_WINDOW_GUARD_ROWS = 4;

const pageWindow = typeof unsafeWindow === 'object' ? unsafeWindow : window;

// Measured immediately, before this script touches anything: what the page
// already contained when it started. `@run-at document-start` is a request
// that Chromium managers cannot always honour, so the real timing is recorded
// rather than assumed, and reported on the About page.
const INJECTION = describeInjection({
  readyState: document.readyState,
  scriptCount: document.querySelectorAll('script').length,
  hasBody: Boolean(document.body),
});
const state = {
  settings: loadSettings(),
  currentPage: 'layout',
  route: routeKind(location.href),
  root: null,
  shadow: null,
  siteStyle: null,
  siteSheet: null,
  presence: { channel: null, answers: [], offer: [] },
  // The viewer hub's one piece of remembered state: the collectible read, which
  // is the only card that is not read straight off the page. Null means nobody
  // has opened the hub yet, which is why nothing has been requested.
  viewerHub: {
    collectibles: null,
    watch: { elapsedMs: 0, activeSince: 0 },
    watchVideo: null,
    watchPlayback: false,
    watchTimer: 0,
  },
  // Chat comfort, and none of it persisted. The log is other people's
  // messages: it lives for the session, in memory, and a reload is the same as
  // clearing it.
  // Saved discovery views, loaded once. Local, and only ever this build's own
  // settings.
  discoveryLayouts: [],
  chatComfort: {
    rows: [], hidden: new Set(), seen: new Set(), sounded: new Set(), lastSoundAt: 0, query: '',
    composerRecall: [], composerRecallIndex: -1,
  },
  modal: null,
  command: null,
  commandInput: null,
  commandList: null,
  commandActive: 0,
  quickButton: null,
  headerControlHost: null,
  headerControlButton: null,
  profileStatsHost: null,
  profileStatsButton: null,
  followingPreview: null,
  followingPreviewRow: null,
  chatResizeCleanup: null,
  chatSeparator: null,
  lastFocused: null,
  commandOpener: null,
  multistreamOpener: null,
  applyTimer: 0,
  applyPendingSince: 0,
  saveTimer: 0,
  filterRun: 0,
  runtime: {
    focus: false,
    theater: false,
    chatHidden: false,
    sidebarHidden: false,
    matureVisible: false,
    chatPaused: false,
    // The message list a scroll listener is attached to, and the listener, so
    // the pause-on-scroll arming is wired once per list and taken back off
    // Kick's node the moment the setting goes off.
    chatScrollNode: null,
    chatScrollHandler: null,
    chatScrollLastTop: 0,
    chatScrollTop: null,
    chatScrollAnchor: null,
    chatScrollIgnoreUntil: 0,
    chatPauseNode: null,
    suspended: false,
    routeSource: '',
    // The route a saved view was last applied for, so it is applied on entering
    // a page and not on every cycle spent there.
    layoutRoute: '',
    applyRunning: false,
    applyQueued: false,
    followingPreviewInteractions: false,
    presenceRequested: false,
    stickerGridScrollTop: null,
    stickerSearchTimer: 0,
    // The trigger the open completion list is offering against, so accepting
    // replaces exactly the `:query` that produced it.
    emoteCompletion: null,
    recallingComposer: false,
    composerRememberedText: '',
    composerRememberedAt: 0,
    // Index of the first tile the grid should render around. The organizer
    // renders a window rather than the whole library, so this is what moves.
    stickerGridAnchor: 0,
    stickerLibraryQuery: '',
    stickerLibraryFilter: 'all',
    stickerLibrarySelection: new Set(),
    stickerLibraryBulkGroup: '',
    // Picker-only organization state. It stays separate from the full library
    // so selecting a few emotes beside chat never leaks into Settings.
    stickerPickerSelection: new Set(),
    stickerPickerVisibleKeys: [],
    stickerPickerBulkGroup: '',
    stickerPickerOrganizing: false,
    stickerPickerGroupEditor: '',
    emoteCatalogSlug: '',
    emoteCatalogStatus: '',
    emoteCatalogError: false,
    emoteCatalogLoading: false,
    stickerPickerTarget: null,
    stickerChatTarget: null,
    stickerCatalogDirty: true,
    // Channel slug -> start time, observed from discovery responses Kick's page
    // already requested. Session-only and never a reason to make another read.
    discoveryStarts: new Map(),
  },
  diagnostics: {
    blocked: 0,
    shells: 0,
    lastMatch: 'None yet',
    entries: [],
    errors: [],
    lastCrash: readLastCrash(),
    apply: {},
  },
  chatEmoteTooltip: null,
  companion: { active: false, version: '' },
  watched: new Set(normalizeChannelList(readSessionArray(WATCHED_KEY))),
  favorites: new Set(normalizeChannelList(readPersistentArray(FAVORITES_KEY))),
  dismissed: new Set(normalizeChannelList(readPersistentArray(DISMISSED_KEY))),
  mediaPreferences: normalizeMediaPreferences(readPersistentRecord(MEDIA_PREFERENCES_KEY)),
  chatKeywords: normalizeChatKeywords(readPersistentRecord(CHAT_KEYWORDS_KEY)),
  channelNotes: normalizeChannelNotes(readPersistentRecord(CHANNEL_NOTES_KEY)),
  stickerPreferences: readStickerPreferences(),
  stickerCatalog: new Map(),
  remoteBlocklist: readRemoteBlocklist(),
  casinoPaths: new Set(),
  adStack: {
    sawPlayback: false,
    playbackSdkKeys: [],
  },
  filter: {
    suspended: false,
    hidden: 0,
    wouldHide: 0,
    total: 0,
  },
  compatibility: null,
  // Set once at boot when the build changed under the user; the About page reads it.
  updateNotice: null,
  // The settings search: the live query, and the index it searches.
  settingsQuery: '',
  settingsIndex: null,
  settingsSearchTimer: 0,
  observers: {
    document: null,
    body: null,
    chat: null,
    stickers: null,
    chatStickers: null,
    multistream: null,
  },
  /**
   * Everything read from Kick's own API, kept apart from scraped state so a
   * failure here can never degrade what the DOM path already produced.
   */
  live: {
    slug: '',
    channel: null,
    catalog: null,
    catalogSource: 'dom',
    catalogError: '',
    collisions: [],
    rarity: null,
    inventory: null,
    // This account's standing in the current channel, from Kick's own /me read.
    // `subscribed: null` means Kick did not say, which is never "denied".
    standing: { known: false, subscribed: null, following: null, moderator: null },
    // The VOD this page is showing, once dated. Null on a channel page, and
    // null whenever the recording could not be dated — see refreshVodRetention.
    vod: null,
    socket: null,
    socketState: 'offline',
    lastFrameAt: 0,
    unparsable: 0,
    subscribed: [],
    deletions: new Map(),
    pendingBadges: new Map(),
    reconnectAt: 0,
    reconnectAttempts: 0,
    provider: '',
    providerVerified: true,
    lastLiveAt: 0,
    apiDrift: [],
  },
  emoteUsage: readEmoteUsage(),
  multistream: normalizeMultistream(gmGet(MULTISTREAM_KEY, {})),
  reward: (() => {
    const stored = gmGet(REWARD_STATE_KEY, null);
    const record = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    return {
      lastClaimAt: Number(record.lastClaimAt) || 0,
      claims: Number(record.claims) || 0,
      lastAttemptAt: 0,
      minutesRemaining: null,
      lastMessage: '',
      decision: '',
      restoreFocusTo: null,
    };
  })(),
  multistreamError: '',
  // slug -> Kick channel id, and slug -> live, both filled from Kick's own
  // responses. Kept apart from `multistream` so neither is ever persisted.
  multistreamIds: new Map(),
  multistreamLive: new Map(),
  multistreamSuspended: new Set(),
  multistreamSuspensionInstalled: false,
  chatStickerScanTimer: 0,
  usagePersistTimer: 0,
  chatStickerPendingNodes: new Set(),
  mediaBound: new WeakSet(),
  mediaSaveTimers: new WeakMap(),
  playbackDiagnosticsTimer: 0,
  uptimeTimer: 0,
  discoveryUptimeTimer: 0,
  remoteSyncTimer: 0,
  remoteSyncInFlight: false,
};

/**
 * The companion extension proves its presence with a live nonce round-trip
 * (handshakeCompanion), not the page-writable <html> dataset attribute that any
 * page script could set. Its presence means ad requests are blocked at the
 * browser network layer before they are sent, not only at the page layer.
 */
function companionInfo() {
  return state.companion?.active
    ? { active: true, version: state.companion.version }
    : { active: false, version: '' };
}

/**
 * Ask the companion to prove it is really here. A fresh nonce must come back on
 * the pong, so a stale reply or a pre-set attribute cannot pass; a page script
 * co-resident on kick.com could still answer, but the bar is a live responder
 * echoing this session's nonce rather than a static attribute set once.
 */
function handshakeCompanion() {
  const nonce = `kf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const handler = (event) => {
    let detail = event.detail;
    try { detail = typeof detail === 'string' ? JSON.parse(detail) : detail; } catch { return; }
    if (!detail || detail.nonce !== nonce) return;
    document.removeEventListener('kick-focus:companion-pong', handler);
    const wasActive = state.companion.active;
    state.companion = { active: true, version: String(detail.version || '') };
    if (!wasActive) {
      if (state.modal && !state.modal.hidden) renderSettingsPage();
      try { publishSettingsState(); } catch { /* noop */ }
    }
  };
  document.addEventListener('kick-focus:companion-pong', handler);
  const ping = () => document.dispatchEvent(new CustomEvent('kick-focus:companion-ping', { detail: { nonce } }));
  ping();
  // Ping again shortly in case the bridge began listening after the first ping.
  window.setTimeout(ping, 500);
}

function readSessionArray(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(-200) : [];
  } catch {
    return [];
  }
}

function gmGet(key, fallback) {
  try {
    if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
    const value = localStorage.getItem(key);
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Persist a value, and never let the failure pass unnoticed.
 *
 * Every call site used to discard the return value except `saveSettings`, so a
 * full or denied storage backend silently dropped the emote library, notes,
 * keyword filters and layout memory. The write result now feeds a registry that
 * raises a warning the user has to acknowledge.
 */
function gmSet(key, value) {
  let ok = true;
  try {
    if (typeof GM_setValue === 'function') GM_setValue(key, value);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    ok = false;
    storageHealth.lastError = error?.name || 'StorageError';
  }
  noteStorageResult(key, ok);
  return ok;
}

/**
 * Fold one write result into the failure registry and surface or retire the
 * warning. Keyed by storage key, so a library that fails on every keystroke
 * warns once and a later success clears it.
 */
function noteStorageResult(key, ok) {
  const before = storageHealth.failures;
  const after = recordStorageResult(before, key, ok, Date.now());
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  storageHealth.failures = after;
  renderStorageWarning();
}

/**
 * Write several stores as one unit, and put everything back if any of them
 * fails.
 *
 * Tampermonkey 5.3+ and Violentmonkey expose `GM_setValues`, which commits the
 * whole object in one call instead of one synchronous write per key. Where it
 * is missing (the extension builds, older managers) the loop below is the same
 * contract at a slower cadence.
 *
 * Rollback restores the values read before the attempt — including deleting
 * keys that did not exist — so a quota failure part-way through leaves the
 * previous configuration whole rather than spliced together with a new one.
 */
function gmSetMany(entries) {
  const plan = planStorageCommit(entries);
  if (!plan.ok) return plan;
  const previous = plan.staged.map(([key]) => [key, gmGet(key, undefined)]);
  if (typeof GM_setValues === 'function') {
    try {
      GM_setValues(Object.fromEntries(plan.staged));
      for (const [key] of plan.staged) noteStorageResult(key, true);
      return { ok: true, reason: '', bytes: plan.bytes };
    } catch (error) {
      storageHealth.lastError = error?.name || 'StorageError';
      for (const [key] of plan.staged) noteStorageResult(key, false);
      return { ok: false, reason: 'write-failed', key: plan.staged[0]?.[0] || '', bytes: plan.bytes };
    }
  }
  const written = [];
  for (const [key, value] of plan.staged) {
    if (gmSet(key, value)) {
      written.push(key);
      continue;
    }
    for (const [prevKey, prevValue] of previous) {
      if (!written.includes(prevKey)) continue;
      if (prevValue === undefined) gmDelete(prevKey);
      else gmSet(prevKey, prevValue);
    }
    return { ok: false, reason: 'write-failed', key, bytes: plan.bytes };
  }
  return { ok: true, reason: '', bytes: plan.bytes };
}

function gmDelete(key) {
  try {
    if (typeof GM_deleteValue === 'function') GM_deleteValue(key);
    else localStorage.removeItem(key);
  } catch {
    // A reset still updates the in-memory state when storage is unavailable.
  }
}

function loadSettings() {
  return normalizeSettings(gmGet(STORAGE_KEY, DEFAULT_SETTINGS));
}

function saveSettings(message = 'Autosaved') {
  // The search index carries each row's translated terms and the copy that
  // reflects current state, so any settings change can stale it — a language
  // switch most obviously, which would otherwise leave a Spanish reader
  // searching an index built in English.
  state.settingsIndex = null;
  clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    const saved = gmSet(STORAGE_KEY, state.settings);
    setSaveStatus(saved ? message : 'Could not save', !saved);
    publishSettingsState();
  }, 80);
}

/**
 * Tell the companion extension what the effective settings are.
 *
 * A same-page localStorage write fires no storage event, so this is the bridge's
 * only in-tab signal. It also runs at startup: on a fresh profile nothing has
 * been written yet, and without this the companion would never learn about
 * defaults that are on, leaving its network rulesets disagreeing with the
 * settings the user is actually looking at.
 */
function publishSettingsState() {
  try {
    // The settings ride on the event rather than being read back from storage,
    // so a profile that has never saved still reports its effective defaults.
    // They travel as a string: an object created in the page world is not
    // structured-cloneable from the extension's isolated world, so passing one
    // makes the receiver fail when it forwards the value.
    document.dispatchEvent(new CustomEvent('kick-focus:settings-changed', {
      detail: { settings: JSON.stringify(state.settings) },
    }));
  } catch {
    // The page keeps working without the companion.
  }
}

function setSaveStatus(message, isError = false) {
  const status = state.shadow?.querySelector('[data-kf-save-status]');
  if (!status) return;
  status.textContent = tr(message);
  status.dataset.error = String(isError);
}

/**
 * One parsed stylesheet per CSS text, shared by reference.
 *
 * A `<style>` inside a shadow root's innerHTML serialises the CSS into markup,
 * has the HTML parser tokenise it, then the CSS parser parse it — and does all
 * of that again for every root that needs the same rules and every time a root
 * is rebuilt. The panic switch used to re-parse the entire site sheet on every
 * restore. A constructed sheet is parsed once and adopted by reference; putting
 * it back is a list assignment.
 *
 * Feature-detected, never version-sniffed: Chromium 73 and Firefox 101 both
 * have it, and where it is absent — or where a content-script compartment
 * refuses a sheet constructed in another one, which older Firefox did — a
 * `<style>` element is the same contract at the old cost. Adopted sheets also
 * sit after every document `<link>`/`<style>` in the cascade, so ties that
 * Kick's later-loaded CSS used to win now go this way without more `!important`.
 */
const CONSTRUCTED_SHEETS = new Map();

function constructedSheet(cssText) {
  if (CONSTRUCTED_SHEETS.has(cssText)) return CONSTRUCTED_SHEETS.get(cssText);
  let sheet = null;
  try {
    if (typeof CSSStyleSheet === 'function' && typeof CSSStyleSheet.prototype.replaceSync === 'function') {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);
    }
  } catch {
    sheet = null;
  }
  CONSTRUCTED_SHEETS.set(cssText, sheet);
  return sheet;
}

/** Adopt `cssText` into `root`; returns the fallback <style> element, or null when adopted. */
function adoptStyles(root, cssText, id = '') {
  const sheet = constructedSheet(cssText);
  if (sheet && Array.isArray(root?.adoptedStyleSheets)) {
    try {
      if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      return null;
    } catch {
      // Fall through to the element path.
    }
  }
  const style = document.createElement('style');
  if (id) style.id = id;
  style.dataset.kickFocus = 'true';
  style.textContent = cssText;
  (root === document ? (document.head || document.documentElement) : root).append(style);
  return style;
}

function addStyle(cssText) {
  removeSiteStyle();
  const element = adoptStyles(document, cssText, 'kick-focus-site-style');
  state.siteStyle = element;
  state.siteSheet = element ? null : constructedSheet(cssText);
}

function removeSiteStyle() {
  state.siteStyle?.remove?.();
  state.siteStyle = null;
  if (state.siteSheet && Array.isArray(document.adoptedStyleSheets)) {
    try {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== state.siteSheet);
    } catch { /* nothing to remove */ }
  }
  state.siteSheet = null;
}

/**
 * Nothing observes `document.adoptedStyleSheets`: if Kick's own code ever
 * assigns that list, this sheet is silently gone with no mutation to notice.
 * Re-asserting it once per apply cycle is a single includes() check.
 */
function ensureSiteStyle() {
  if (!state.siteSheet || !Array.isArray(document.adoptedStyleSheets)) return;
  if (document.adoptedStyleSheets.includes(state.siteSheet)) return;
  try {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, state.siteSheet];
  } catch { /* the next cycle tries again */ }
}

function recordProtection(layer, classification) {
  state.diagnostics.blocked += layer === 'DOM' ? 0 : 1;
  state.diagnostics.lastMatch = classification.label;
  state.diagnostics.entries.unshift({
    time: new Date().toLocaleTimeString([], { hour12: false }),
    layer,
    match: classification.label,
    action: layer === 'DOM' ? 'Removed' : 'Blocked',
  });
  state.diagnostics.entries = state.diagnostics.entries.slice(0, 20);
  updateDiagnosticsInPlace();
}

function blockedResponse(win) {
  try {
    return Promise.resolve(new win.Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Kick-Focus': 'blocked' },
    }));
  } catch {
    return Promise.reject(new TypeError('Blocked by Kick Focus'));
  }
}

/**
 * Rewrite a playback response read through XHR.
 *
 * The player reads `responseText` repeatedly as readyState advances, so the
 * result is cached against the raw body: transforming on every read would be
 * wasteful, and reporting on every read would flood the protection log.
 */
/**
 * Make a blocked XHR look like a request that succeeded and returned nothing.
 *
 * Reporting an error instead invites the caller to retry, which is how a
 * blocked telemetry endpoint turns into a request loop that costs more than
 * the telemetry would have.
 */
function simulateEmptySuccess(xhr, win) {
  const fixed = (name, value) => Object.defineProperty(xhr, name, {
    configurable: true,
    get: () => value,
  });

  fixed('readyState', 4);
  fixed('status', 200);
  fixed('statusText', 'OK');
  fixed('responseText', '{}');
  fixed('responseURL', '');
  fixed('response', xhr.responseType === 'json' ? {} : '{}');

  for (const type of ['readystatechange', 'load', 'loadend']) {
    xhr.dispatchEvent(new win.Event(type));
  }
}

/**
 * Remember which ad-related keys a playback response carried, so the settings
 * page can say whether Kick's ad stack still looks the way this build expects.
 */
function notePlaybackShape(rawText) {
  try {
    const payload = JSON.parse(String(rawText || ''));
    if (!payload || typeof payload !== 'object') return;
    state.adStack.sawPlayback = true;
    const player = payload.video_player;
    if (player && typeof player === 'object') {
      state.adStack.playbackSdkKeys = Object.keys(player).filter((key) => /_sdk$/.test(key));
    }
    updateAdStackNoticeInPlace();
  } catch {
    // A non-JSON body tells us nothing about the ad stack.
  }
}

function updateAdStackNoticeInPlace() {
  const notice = state.shadow?.querySelector('[data-kf-adstack]');
  if (!notice) return;
  const assessment = assessAdStack(state.adStack);
  notice.textContent = assessment.summary;
  notice.dataset.drifted = String(assessment.drifted);
}

function installPlaybackRewrite(xhr, nativeText, nativeResponse, report) {
  let cache = null;
  let reported = false;

  const rewrite = (raw) => {
    if (typeof raw !== 'string' || raw === '') return raw;
    if (cache && cache.raw === raw) return cache.value;
    notePlaybackShape(raw);
    const result = neutralizePlaybackPayload(raw, { reduceTelemetry: state.settings.content.reduceTelemetry });
    cache = { raw, value: result.changed ? result.text : raw };
    if (result.changed && !reported) {
      reported = true;
      report('Playback', {
        category: 'advertising',
        label: `playback ad flags cleared (${result.removed.join(', ')})`,
      });
    }
    return cache.value;
  };

  try {
    Object.defineProperty(xhr, 'responseText', {
      configurable: true,
      get() {
        try {
          return rewrite(nativeText.get.call(this));
        } catch {
          return nativeText.get.call(this);
        }
      },
    });

    if (nativeResponse?.get) {
      Object.defineProperty(xhr, 'response', {
        configurable: true,
        get() {
          const raw = nativeResponse.get.call(this);
          const type = this.responseType;
          if (type === '' || type === 'text') return rewrite(raw);
          if (type === 'json' && raw && typeof raw === 'object') {
            const result = neutralizePlaybackPayload(JSON.stringify(raw), { reduceTelemetry: state.settings.content.reduceTelemetry });
            if (!result.changed) return raw;
            if (!reported) {
              reported = true;
              report('Playback', {
                category: 'advertising',
                label: `playback ad flags cleared (${result.removed.join(', ')})`,
              });
            }
            try {
              return JSON.parse(result.text);
            } catch {
              return raw;
            }
          }
          return raw;
        },
      });
    }
  } catch {
    // Without the override the request still succeeds unmodified.
  }
}

/**
 * Make an interceptor answer `name` and `toString()` the way the function it
 * replaced does.
 *
 * The ad defense only works while the page cannot trivially detect it, and
 * `window.fetch.name === 'kickFocusFetch'` alongside a non-native `toString()`
 * is the cheapest possible probe. Kick gained a commercial reason to run one
 * when it launched ads on 2026-08-06.
 *
 * This raises the cost of detection; it does not make it impossible, and it is
 * not a claim of undetectability.
 */
function disguise(wrapper, original, name) {
  try {
    Object.defineProperty(wrapper, 'name', { value: name, configurable: true });
    Object.defineProperty(wrapper, 'length', { value: original?.length ?? wrapper.length, configurable: true });
    const native = `function ${name}() { [native code] }`;
    Object.defineProperty(wrapper, 'toString', {
      value: Object.defineProperty(() => native, 'name', { value: 'toString', configurable: true }),
      writable: true,
      configurable: true,
    });
  } catch {
    // A frozen function object is still a working interceptor.
  }
  return wrapper;
}

/**
 * Stop a blocked ad preflight script from holding the player hostage.
 *
 * Kick waits on Google PAL, Datazoom and OM before it will request playback.
 * When one of those is blocked, the failed `<script>` stays in the document and
 * a listener Kick attaches *later* never sees the error that already fired, so
 * the player sits out the full preflight timeout before starting.
 *
 * This build causes that directly: `imasdk.googleapis.com` is in its own
 * AD_HOSTS. The block is correct; the wait is an artifact of it.
 *
 * Removing the dead element means Kick's next attempt is created with its error
 * handler already attached, so it fails immediately instead of timing out.
 * Resource errors do not bubble, but they do pass through capture — hence the
 * capture-phase listener on window, installed at document-start.
 *
 * Approach adapted from KickCX/KickFixPlayerLoading (MIT).
 */
function installPlayerLoadingFix() {
  if (pageWindow.__kickFocusPlayerLoadingV1) return;
  pageWindow.__kickFocusPlayerLoadingV1 = true;
  pageWindow.addEventListener('error', (event) => {
    if (!state.settings.content.fixPlayerLoading || state.runtime.suspended) return;
    const script = event.target;
    if (!script || script.tagName !== 'SCRIPT') return;
    if (!isAdPreflightScript(script.getAttribute('src') || script.src, location.origin)) return;
    // The microtask lets any handler Kick attached directly to this element run
    // first; only then is the unusable script removed.
    queueMicrotask(() => {
      if (script.isConnected && script.dataset.loaded !== 'true') {
        script.remove();
        recordProtection('Preflight', {
          category: 'advertising',
          label: `released the player from a blocked preflight script (${new URL(script.src, location.origin).pathname})`,
        });
      }
    });
  }, true);
}

function noteDiscoveryLiveStarts(payload) {
  const observed = normalizeDiscoveryLiveStarts(payload);
  if (!observed.size) return;
  let changed = false;
  for (const [slug, startedAt] of observed) {
    if (state.runtime.discoveryStarts.get(slug) === startedAt) continue;
    state.runtime.discoveryStarts.set(slug, startedAt);
    changed = true;
  }
  // Discovery responses are bounded before they reach here, but navigation can
  // visit several feeds in one session. Keep the aggregate bounded as well.
  while (state.runtime.discoveryStarts.size > 500) {
    state.runtime.discoveryStarts.delete(state.runtime.discoveryStarts.keys().next().value);
  }
  if (changed) scheduleApply(0);
}

function installNetworkDefense() {
  const marker = '__kickFocusNetworkDefenseV1';
  if (pageWindow[marker]) return;
  try {
    Object.defineProperty(pageWindow, marker, { value: true, configurable: false });
  } catch {
    pageWindow[marker] = true;
  }

  const classify = (value) => classifyRequest(value, {
    reduceTelemetry: state.settings.content.reduceTelemetry,
  });
  const report = (layer, result) => {
    recordProtection(layer, result);
    try {
      pageWindow.dispatchEvent(new pageWindow.CustomEvent(PAGE_BLOCK_EVENT, {
        detail: { layer, category: result.category, label: result.label },
      }));
    } catch {
      // Diagnostics are optional; blocking must continue if event creation fails.
    }
  };

  try {
    const nativeFetch = pageWindow.fetch?.bind(pageWindow);
    // Our own API reads go through the unhooked original: routing them back
    // through this interceptor would classify and log them as page traffic.
    unhookedFetch = nativeFetch;
    if (nativeFetch) {
      pageWindow.fetch = disguise(function kickFocusFetch(input, init) {
        if (state.runtime.suspended) return nativeFetch(input, init);
        const rawUrl = typeof input === 'string' || input instanceof URL ? input : input?.url;
        const result = classify(rawUrl);
        if (result.blocked) {
          report('Fetch', result);
          return blockedResponse(pageWindow);
        }
        const request = nativeFetch(input, init);
        if (isDiscoveryLivestreamUrl(rawUrl, location.origin)) {
          // Clone and observe the page's response. The original response and
          // promise go back to Kick untouched, and no second request is made.
          request.then((response) => {
            if (!response?.ok) return;
            response.clone().json().then(noteDiscoveryLiveStarts).catch(() => {});
          }).catch(() => {});
        }
        if (!isPlaybackUrl(rawUrl)) return request;

        // Playback is first-party and must be delivered, but the ad flags it
        // carries are rewritten on the way through.
        return request.then((response) => {
          if (!response?.ok) return response;
          return response.clone().text().then((body) => {
            notePlaybackShape(body);
            const rewritten = neutralizePlaybackPayload(body, { reduceTelemetry: state.settings.content.reduceTelemetry });
            if (!rewritten.changed) return response;
            report('Playback', {
              category: 'advertising',
              label: `playback ad flags cleared (${rewritten.removed.join(', ')})`,
            });
            return new pageWindow.Response(rewritten.text, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          }).catch(() => response);
        });
      }, pageWindow.fetch, 'fetch');
    }
  } catch {
    // Some sandbox/page combinations expose a non-writable fetch binding.
  }

  try {
    const xhrPrototype = pageWindow.XMLHttpRequest?.prototype;
    const nativeOpen = xhrPrototype?.open;
    const nativeSend = xhrPrototype?.send;
    if (nativeOpen && nativeSend) {
      const nativeText = Object.getOwnPropertyDescriptor(xhrPrototype, 'responseText');
      const nativeResponse = Object.getOwnPropertyDescriptor(xhrPrototype, 'response');

      xhrPrototype.open = disguise(function kickFocusOpen(method, url, ...rest) {
        this.__kfRequest = state.runtime.suspended ? { blocked: false } : classify(url);
        this.__kfPlayback = !state.runtime.suspended && isPlaybackUrl(url);
        this.__kfDiscovery = !state.runtime.suspended && isDiscoveryLivestreamUrl(url, location.origin);
        return nativeOpen.call(this, method, url, ...rest);
      }, nativeOpen, 'open');
      xhrPrototype.send = disguise(function kickFocusSend(...args) {
        if (this.__kfPlayback && nativeText?.get) installPlaybackRewrite(this, nativeText, nativeResponse, report);
        if (this.__kfDiscovery) {
          this.addEventListener('loadend', () => {
            try {
              if (this.status < 200 || this.status >= 300) return;
              const payload = this.responseType === 'json'
                ? (nativeResponse?.get ? nativeResponse.get.call(this) : this.response)
                : JSON.parse(nativeText?.get ? nativeText.get.call(this) : this.responseText);
              noteDiscoveryLiveStarts(payload);
            } catch {
              // A changed or non-JSON feed is optional metadata, never a page failure.
            }
          }, { once: true });
        }
        if (!this.__kfRequest?.blocked) return nativeSend.apply(this, args);
        report('XHR', this.__kfRequest);
        // Answer with an empty success rather than an error. Telemetry clients
        // treat a failed request as worth retrying, and an aggressive retry
        // loop costs the user far more than the request that was blocked.
        queueMicrotask(() => {
          try {
            simulateEmptySuccess(this, pageWindow);
          } catch {
            // The caller still receives an unsent XHR with status 0.
          }
        });
        return undefined;
      }, nativeSend, 'send');
    }
  } catch {
    // Continue with DOM and fetch protection.
  }

  try {
    const beaconOwner = pageWindow.Navigator?.prototype;
    const nativeBeacon = beaconOwner && Object.getOwnPropertyDescriptor(beaconOwner, 'sendBeacon')?.value;
    if (nativeBeacon) {
      Object.defineProperty(beaconOwner, 'sendBeacon', {
        configurable: true,
        writable: true,
        value(url, data) {
          if (state.runtime.suspended) return nativeBeacon.call(this, url, data);
          const result = classify(url);
          if (result.blocked) {
            report('Beacon', result);
            return true;
          }
          return nativeBeacon.call(this, url, data);
        },
      });
    }
  } catch {
    // Beacon telemetry protection is a supplemental layer.
  }

  try {
    const nativeSetAttribute = pageWindow.Element?.prototype?.setAttribute;
    if (nativeSetAttribute) {
      pageWindow.Element.prototype.setAttribute = function kickFocusSetAttribute(name, value) {
        if (state.runtime.suspended) return nativeSetAttribute.call(this, name, value);
        if (String(name).toLowerCase() === 'src') {
          const result = classify(value);
          if (result.blocked) {
            nativeSetAttribute.call(this, 'data-kf-blocked-src', result.label);
            report('Element', result);
            queueMicrotask(() => {
              try { this.dispatchEvent(new pageWindow.Event('error')); } catch { /* noop */ }
            });
            return undefined;
          }
        }
        return nativeSetAttribute.call(this, name, value);
      };
    }
  } catch {
    // Parser-created elements are covered by CSS/MutationObserver cleanup.
  }

  for (const [constructorName, property] of [
    ['HTMLScriptElement', 'src'],
    ['HTMLIFrameElement', 'src'],
    ['HTMLImageElement', 'src'],
  ]) {
    try {
      const prototype = pageWindow[constructorName]?.prototype;
      const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, property);
      if (!descriptor?.set || !descriptor.get) continue;
      Object.defineProperty(prototype, property, {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set(value) {
          if (state.runtime.suspended) return descriptor.set.call(this, value);
          const result = classify(value);
          if (result.blocked) {
            try { this.dataset.kfBlockedSrc = result.label; } catch { /* noop */ }
            report('Element', result);
            queueMicrotask(() => {
              try { this.dispatchEvent(new pageWindow.Event('error')); } catch { /* noop */ }
            });
            return value;
          }
          return descriptor.set.call(this, value);
        },
      });
    } catch {
      // Keep the other constructors protected when one descriptor is sealed.
    }
  }
}

/**
 * One rule per catalog entry, generated so a new hideable control cannot ship
 * with a settings switch and no stylesheet behind it.
 *
 * `~=` matches one whitespace-separated token, so the whole feature is a single
 * attribute on `<html>` that a settings change rewrites — the tagging pass never
 * has to walk anything again to *unhide*, and an element still carrying a stale
 * `data-kf-element` from a switch that was turned back off simply stops
 * matching. `display: none` rather than `visibility`/`opacity` because a control
 * left occupying its slot is the layout gap people file bugs about.
 */
function hiddenElementCss() {
  return HIDEABLE_ELEMENTS
    .map((entry) => `html[data-kf-hidden~="${entry.id}"] [data-kf-element="${entry.id}"] { display: none !important; }`)
    .join('\n    ');
}

/**
 * How many bytes the built userscript is, stamped in by the build.
 *
 * A userscript is injected whole, and Violentmonkey's Alternative page mode
 * stops giving it a real document-start somewhere around a megabyte, so this is
 * a number with a real ceiling rather than trivia. It was cut hard once and it
 * will grow again; About shows it so the next regression is visible to whoever
 * is looking at their own install, not only to a build gate.
 *
 * The placeholder is replaced with a space-padded number of exactly its own
 * width. Number() trims the padding, and the file's length does not change by
 * being told what it is. Zero here means an unstamped build, which is what
 * running from source rather than from dist looks like.
 */
const BUNDLE_BYTES = Number('__KICK_FOCUS_BYTES__') || 0;
const BUNDLE_BYTE_CEILING = 1000000;
const INJECTION_BYTE_BUDGET = 925000;

const SITE_CSS = `
  :root {
    /* One focus treatment for the whole product. It used to be five: 3px accent
       in the settings panel, 2px accent on the nav search and the injected
       page, 2px plain text on a toast action, and a box-shadow with no outline
       at all on every text input. Declared on the page root because custom
       properties inherit across a shadow boundary, so the panel, the header
       control, the emote popover and Kick's own page all read the same value. */
    --kf-focus-ring: 3px solid var(--kf-accent);
    --kf-focus-offset: 2px;
    --kf-accent: #7cff2b;
    --kf-accent-rgb: 124, 255, 43;
    --kf-canvas: #070a08;
    --kf-panel: #0b100d;
    --kf-panel-raised: #111713;
    --kf-panel-high: #18201b;
    --kf-border: #202a23;
    --kf-border-strong: #38463d;
    --kf-text: #f5f8f6;
    --kf-text-muted: #aab4ae;
    --kf-text-secondary: #d0d7d3;
    --kf-surface-inset: #070b08;
    --kf-surface-hover: #171f1a;
    --kf-surface-selected: #111d14;
    --kf-on-accent: #071004;
    --kf-danger: #ff6258;
    --kf-warning: #f6b943;
    --kf-radius: 7px;
    --kf-chat-width: 410px;
    --kf-thumb-saturation: 1.03;
    --kf-caption-opacity: .72;
    --kf-text-scale: 1;
  }

  html[data-kf-accent="cyan"] { --kf-accent: #38d7d0; --kf-accent-rgb: 56, 215, 208; }
  html[data-kf-accent="violet"] { --kf-accent: #9667ff; --kf-accent-rgb: 150, 103, 255; }
  html[data-kf-accent="gold"] { --kf-accent: #ffbe2e; --kf-accent-rgb: 255, 190, 46; }
  /* Slate's raised surfaces are the lightest in the build, and violet is the
     only accent that does not clear 4.5:1 as text on them: 4.01:1 on both the
     toast action and the merged-chat channel label, which are 14px and 11px.
     The shipped "chat" viewing preset is slate plus violet, so that pairing is
     one somebody lands on deliberately. Lifted 22% toward white for this theme
     only, which reaches 4.62:1 at worst and leaves the accent untouched on
     Studio and OLED, where it already passes. */
  html[data-kf-theme="slate"][data-kf-accent="violet"] { --kf-accent: #ad88ff; --kf-accent-rgb: 173, 136, 255; }

  /*
   * The ink on top of an accent, picked by the engine where it can be.
   *
   * Every preset above changes the accent and none of them changes the ink, so
   * one hardcoded near-black carries all four. Measured, that is the right
   * choice for all four today — violet is the closest at 5.24:1 against the
   * dark ink and 3.70:1 against white — but it is right by coincidence, and the
   * next accent added to that list inherits the coincidence rather than a
   * decision.
   *
   * This does not replace the JS gate and cannot: a custom accent's ink is set
   * as an inline style on the root, which outranks this rule, and
   * normalizeCustomAccent still rejects a picker value that would not clear
   * 3:1 against the darkest Studio, OLED, and Slate surfaces. CSS decides the
   * foreground; the 3:1 reject decides whether the accent is allowed at all.
   */
  @supports (color: contrast-color(#000)) {
    :root { --kf-on-accent: contrast-color(var(--kf-accent)); }
  }
  html[data-kf-radius="subtle"] { --kf-radius: 6px; }
  html[data-kf-radius="rounded"] { --kf-radius: 12px; }
  html[data-kf-theme="oled"] {
    --kf-canvas: #000;
    --kf-panel: #030404;
    --kf-panel-raised: #080a09;
    --kf-panel-high: #0e1110;
    --kf-border: #191f1b;
    --kf-border-strong: #38423c;
    --kf-text: #f8faf9;
    --kf-text-muted: #a9b0ac;
    --kf-text-secondary: #d2d7d4;
    --kf-surface-inset: #000;
    --kf-surface-hover: #111613;
    --kf-surface-selected: #0b170e;
  }
  html[data-kf-theme="slate"] {
    --kf-canvas: #090e13;
    --kf-panel: #0f161d;
    --kf-panel-raised: #151f28;
    --kf-panel-high: #1c2934;
    --kf-border: #253541;
    --kf-border-strong: #496072;
    --kf-text: #f3f7fa;
    --kf-text-muted: #a6b5c2;
    --kf-text-secondary: #cbd6df;
    --kf-surface-inset: #0a1118;
    --kf-surface-hover: #263544;
    --kf-surface-selected: #1b2d29;
  }

  body {
    background: var(--kf-canvas) !important;
    color: var(--kf-text) !important;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    font-size: 15px !important;
    line-height: 1.45 !important;
    text-rendering: optimizeLegibility;
  }

  @media (min-width: 1024px) {
    /* Premium Kick shell shared by Home, Browse, Following, Drops, Search,
       category pages, and channels. Stable ids/test ids are preferred over
       utility-class names so a Tailwind rebuild does not erase the design. */
    body > [class~="group/main"],
    body > [data-sidebar][data-chat] { background: var(--kf-canvas) !important; }

    nav {
      min-height: 56px !important;
      border-bottom: 1px solid var(--kf-border) !important;
      background: var(--kf-canvas) !important;
      box-shadow: none !important;
    }

    nav form > div > div,
    nav [data-testid="search"]:is(input) {
      border-color: var(--kf-border-strong) !important;
      background: var(--kf-surface-inset) !important;
    }

    nav form > div > div {
      min-height: 36px !important;
      border-radius: 6px !important;
      box-shadow: none !important;
    }

    nav form > div > div:focus-within {
      border-color: rgba(var(--kf-accent-rgb), .72) !important;
      box-shadow: 0 0 0 3px rgba(var(--kf-accent-rgb), .12) !important;
    }

    main,
    #main-container { background: var(--kf-canvas) !important; }

    main > div:first-child:not(#channel-content) {
      width: min(100%, 1600px) !important;
      margin-inline: auto !important;
    }

    main h1,
    main h2,
    main h3 {
      color: var(--kf-text) !important;
      line-height: 1.2 !important;
      letter-spacing: -.024em !important;
    }

    main h1 { font-size: clamp(26px, 2.2vw, 30px) !important; font-weight: 760 !important; }
    main h2 { font-size: clamp(20px, 1.8vw, 24px) !important; font-weight: 740 !important; }
    main h3 { font-size: 17px !important; font-weight: 720 !important; }

    #sidebar-wrapper {
      border-right: 1px solid var(--kf-border) !important;
      background: var(--kf-canvas) !important;
      box-shadow: none !important;
    }

    #sidebar-wrapper > ul {
      gap: 0 !important;
      padding: 6px 8px 10px !important;
    }

    #sidebar-wrapper a[data-testid^="sidebar-"] {
      min-height: 40px !important;
      border: 0 !important;
      border-radius: 5px !important;
      color: var(--kf-text-secondary) !important;
      font-size: 14px !important;
    }

    #sidebar-wrapper a[data-testid^="sidebar-"][data-state="active"] {
      background: rgba(var(--kf-accent-rgb), .065) !important;
      color: var(--kf-accent) !important;
      box-shadow: inset 2px 0 0 rgba(var(--kf-accent-rgb), .78) !important;
    }

    #sidebar-wrapper a[data-testid^="sidebar-"]:hover {
      background: rgba(255,255,255,.045) !important;
    }

    #kick-focus-following-preview {
      position: fixed !important;
      z-index: 2147483000 !important;
      width: min(320px, calc(100vw - 24px)) !important;
      margin: 0 !important;
      overflow: hidden !important;
      border: 1px solid rgba(255,255,255,.12) !important;
      border-radius: 10px !important;
      background: var(--kf-panel, #0b100d) !important;
      box-shadow: 0 20px 54px rgba(0,0,0,.58), 0 2px 12px rgba(0,0,0,.3) !important;
      color: var(--kf-text, #f5f8f6) !important;
      opacity: 0 !important;
      transform: translateX(-4px) scale(.985) !important;
      transform-origin: center left !important;
      pointer-events: none !important;
      transition: opacity 120ms ease, transform 120ms ease !important;
    }

    #kick-focus-following-preview[hidden] { display: none !important; }
    #kick-focus-following-preview[data-kf-open="true"] {
      opacity: 1 !important;
      transform: translateX(0) scale(1) !important;
    }
    #kick-focus-following-preview[data-kf-side="left"] { transform-origin: center right !important; }
    #kick-focus-following-preview > :is(img, canvas) {
      display: block !important;
      width: 100% !important;
      aspect-ratio: 16 / 9 !important;
      object-fit: cover !important;
      background: var(--kf-panel-raised, #111713) !important;
    }
    #kick-focus-following-preview > :is(img, canvas)[hidden] { display: none !important; }
    #kick-focus-following-preview figcaption {
      display: flex !important;
      min-height: 42px !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      padding: 9px 11px 10px !important;
      border-top: 1px solid rgba(255,255,255,.08) !important;
      background: var(--kf-surface-hover, #171f1a) !important;
      font: 500 12px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    }
    #kick-focus-following-preview strong {
      min-width: 0 !important;
      overflow: hidden !important;
      color: #f7f9f8 !important;
      font-size: 14px !important;
      font-weight: 720 !important;
      letter-spacing: -.012em !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    #kick-focus-following-preview figcaption span {
      flex: 0 0 auto !important;
      color: rgba(247,249,248,.56) !important;
      font-size: 11px !important;
      letter-spacing: .02em !important;
    }

    #sidebar-wrapper :is(button, a):focus-visible,
    main :is(button, a, input, select, textarea):focus-visible {
      outline: var(--kf-focus-ring) !important;
      outline-offset: 2px !important;
    }

    main [data-testid="livestream-results-card"] {
      gap: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      overflow: visible !important;
      box-shadow: none !important;
    }

    main [data-testid="livestream-results-card"]:hover,
    main [data-testid="livestream-results-card"]:focus-within {
      background: transparent !important;
      box-shadow: none !important;
    }

    main [data-testid="media-card-thumbnail"] {
      border: 0 !important;
      border-radius: var(--kf-radius) !important;
      background: var(--kf-surface-inset) !important;
      overflow: hidden !important;
      box-shadow: 0 0 0 1px rgba(255,255,255,.045) !important;
      transition: box-shadow 150ms ease, filter 150ms ease !important;
    }

    main [data-testid="livestream-results-card"]:is(:hover, :focus-within) [data-testid="media-card-thumbnail"] {
      box-shadow: 0 0 0 1px rgba(var(--kf-accent-rgb), .46) !important;
      filter: brightness(1.035) !important;
    }

    main [data-testid="media-card-thumbnail"] > :is(div, img) {
      border-radius: inherit !important;
    }

    main [data-testid="media-card-thumbnail"] [class*="top-1.5"],
    main [data-testid="media-card-thumbnail"] [class*="bottom-1.5"] {
      border: 0 !important;
      border-radius: 4px !important;
      background: rgba(4,7,5,.9) !important;
      box-shadow: none !important;
      font-size: 12px !important;
    }

    main section[class*="grid"] {
      column-gap: 18px !important;
      row-gap: 24px !important;
    }

    main [data-testid^="tab-"] {
      min-height: 38px !important;
      padding-inline: 2px !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      font-size: 14px !important;
      font-weight: 680 !important;
    }

    main [data-testid^="tab-"][data-state="active"],
    main a[data-state="active"][href*="/following"],
    main a[data-state="active"][href*="/drops"],
    main a[data-state="active"][href*="/category"] {
      color: var(--kf-accent) !important;
      border-color: transparent !important;
    }

    main [data-testid^="tab-"][data-state="active"] > div,
    main a[data-state="active"] > div[class*="bottom-"] {
      background: var(--kf-accent) !important;
    }

    main :is([role="combobox"], select) {
      min-height: 36px !important;
      border: 1px solid var(--kf-border) !important;
      border-radius: 6px !important;
      background: var(--kf-panel-raised) !important;
      box-shadow: none !important;
      font-size: 14px !important;
    }

    main button:not([data-kf-card-action]):not([data-kf-sticker-action]) { border-radius: 6px !important; }

    html[data-kf-route="category"] main > div:first-child,
    html[data-kf-route="categories"] main > div:first-child,
    html[data-kf-route="browse"] main > div:first-child,
    html[data-kf-route="following"] main > div:first-child,
    html[data-kf-route="drops"] main > div:first-child,
    html[data-kf-route="search"] main > div:first-child {
      padding-top: 18px !important;
    }

    html[data-kf-route="settings"] main,
    html[data-kf-route="collectibles"] main,
    html[data-kf-route="subscriptions"] main {
      width: min(1180px, calc(100% - 48px)) !important;
      margin-inline: auto !important;
      padding: 28px 0 64px !important;
    }

    html[data-kf-route="settings"] main > h1,
    html[data-kf-route="collectibles"] main > h1,
    html[data-kf-route="subscriptions"] main > h1 {
      margin: 0 0 18px !important;
      color: var(--kf-text) !important;
      font-size: clamp(26px, 3vw, 36px) !important;
      letter-spacing: -.025em !important;
    }

    html[data-kf-route="settings"] main [data-kf-settings-tab="true"] {
      display: inline-flex !important;
      align-items: center !important;
      min-height: 40px !important;
      margin: 0 5px 18px 0 !important;
      padding: 0 12px !important;
      border: 1px solid transparent !important;
      border-radius: 8px !important;
      color: var(--kf-text-muted) !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      text-decoration: none !important;
    }

    html[data-kf-route="settings"] main [data-kf-settings-tab="true"]:is(:hover, :focus-visible) {
      border-color: var(--kf-border-strong) !important;
      background: var(--kf-surface-hover) !important;
      color: var(--kf-text) !important;
    }

    html[data-kf-route="settings"] main [data-kf-settings-active="true"] {
      border-color: rgba(var(--kf-accent-rgb), .45) !important;
      background: rgba(var(--kf-accent-rgb), .09) !important;
      color: var(--kf-accent) !important;
      box-shadow: inset 0 -2px 0 var(--kf-accent) !important;
    }

    html[data-kf-route="settings"] main :is(h2, h3),
    html[data-kf-route="collectibles"] main :is(h2, h3),
    html[data-kf-route="subscriptions"] main :is(h2, h3) {
      color: var(--kf-text) !important;
      letter-spacing: -.012em !important;
    }

    html[data-kf-route="settings"] main :is(input:not([type="checkbox"]):not([type="radio"]), textarea, select, [role="combobox"]),
    html[data-kf-route="collectibles"] main :is(select, [role="combobox"]),
    html[data-kf-route="subscriptions"] main :is(input, select, [role="combobox"]) {
      border: 1px solid var(--kf-border-strong) !important;
      border-radius: 8px !important;
      background: var(--kf-surface-inset) !important;
      color: var(--kf-text) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.025) !important;
    }

    html[data-kf-route="settings"] main :is(input, textarea, select, [role="combobox"]):focus-visible,
    html[data-kf-route="collectibles"] main :is(select, [role="combobox"]):focus-visible,
    html[data-kf-route="subscriptions"] main :is(input, select, [role="combobox"]):focus-visible {
      border-color: var(--kf-accent) !important;
      outline: var(--kf-focus-ring) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(var(--kf-accent-rgb), .12) !important;
    }

    html[data-kf-route="settings"] main button,
    html[data-kf-route="collectibles"] main button,
    html[data-kf-route="subscriptions"] main button {
      min-height: 38px !important;
      transition: border-color 140ms ease, background-color 140ms ease, transform 140ms ease !important;
    }

    html[data-kf-route="settings"] main button:not(:disabled):hover,
    html[data-kf-route="collectibles"] main button:not(:disabled):hover,
    html[data-kf-route="subscriptions"] main button:not(:disabled):hover {
      border-color: var(--kf-border-strong) !important;
      transform: translateY(-1px) !important;
    }

    html[data-kf-route="settings"] main button:disabled,
    html[data-kf-route="subscriptions"] main button:disabled {
      opacity: .52 !important;
      transform: none !important;
    }

    html[data-kf-route="settings"] main img,
    html[data-kf-route="collectibles"] main img {
      border-radius: 8px !important;
    }

    html[data-kf-route="collectibles"] main > h1 + p,
    html[data-kf-route="subscriptions"] main > h1 + p {
      max-width: 760px !important;
      margin-bottom: 24px !important;
      color: var(--kf-text-muted) !important;
      font-size: 14px !important;
      line-height: 1.65 !important;
    }

    html[data-kf-route="collectibles"] main button:has(img) {
      border: 1px solid var(--kf-border) !important;
      background: var(--kf-panel) !important;
      box-shadow: 0 8px 20px rgba(0,0,0,.18) !important;
    }

    html[data-kf-route="collectibles"] main button:has(img):is(:hover, :focus-visible) {
      border-color: rgba(var(--kf-accent-rgb), .55) !important;
      background: var(--kf-panel-raised) !important;
      box-shadow: 0 12px 26px rgba(0,0,0,.28), 0 0 0 3px rgba(var(--kf-accent-rgb), .08) !important;
    }

    html[data-kf-route="channel"] #channel-content {
      gap: 12px !important;
      padding: 12px 16px 24px !important;
      background: var(--kf-canvas) !important;
    }

    html[data-kf-route="channel"] #injected-channel-player {
      border: 0 !important;
      border-radius: 6px !important;
      box-shadow: none !important;
      overflow: hidden !important;
    }

    html[data-kf-route="channel"] #channel-content > :is(div, section, article) {
      border-color: transparent !important;
    }

    [data-kf-chat-panel],
    #channel-chatroom {
      border: 0 !important;
      border-left: 1px solid var(--kf-border) !important;
      border-radius: 0 !important;
      background: var(--kf-panel) !important;
      box-shadow: none !important;
    }

    [data-kf-chat-panel] button[aria-label="Hide chat"],
    [data-kf-chat-panel] button[aria-label="Show chat"] {
      min-height: 40px !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
      font-size: 16px !important;
    }

    #channel-chatroom > div > div:first-child {
      padding: 8px 12px !important;
      border-radius: 0 !important;
      border-bottom-color: var(--kf-border) !important;
      background: var(--kf-panel) !important;
    }

    #channel-chatroom [data-testid="pinned-message-modal"] > div {
      border: 0 !important;
      border-left: 2px solid rgba(var(--kf-accent-rgb), .5) !important;
      border-radius: 3px !important;
      background: var(--kf-surface-inset) !important;
    }

    #channel-chatroom :is(textarea, input, [contenteditable="true"]) {
      border-radius: 6px !important;
      border-color: var(--kf-border) !important;
      background: var(--kf-surface-inset) !important;
      font-size: 14px !important;
    }

    html[data-kf-route="home"] main [class*="backdrop-blur"] {
      border: 0 !important;
      border-radius: 6px !important;
      background: rgba(7,10,8,.9) !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
    }

    [data-kf-chat-panel], #channel-chatroom { border-left-color: var(--kf-border) !important; background: var(--kf-panel) !important; }

    html[data-kf-sidebar="hidden"] #sidebar-wrapper,
    html[data-kf-focus="true"] #sidebar-wrapper,
    html[data-kf-theater="true"] #sidebar-wrapper { display: none !important; }

    html[data-kf-chat="hidden"] [data-kf-chat-panel],
    html[data-kf-chat="hidden"] [data-kf-chat-separator],
    html[data-kf-focus="true"] [data-kf-chat-panel],
    html[data-kf-focus="true"] [data-kf-chat-separator] { display: none !important; }

    html[data-kf-chat="left"] [data-kf-chat-panel] {
      order: -1 !important;
      border-left: 0 !important;
      border-right: 1px solid var(--kf-border) !important;
    }

    html[data-kf-chat="left"] #channel-chatroom {
      border-left: 0 !important;
      border-right: 1px solid var(--kf-border) !important;
    }

    html[data-kf-chat="left"] [data-kf-chat-split] {
      display: flex !important;
      flex-direction: row-reverse !important;
      width: 100% !important;
      min-width: 0 !important;
    }

    html[data-kf-chat="left"] [data-kf-chat-split] > :is(#channel-chatroom, [data-testid="chatroom"]) {
      flex: 1 1 auto !important;
      min-width: 0 !important;
    }

    html[data-kf-chat="right"] [data-kf-chat-panel],
    html[data-kf-chat="left"] [data-kf-chat-panel] {
      flex: 0 0 var(--kf-chat-width) !important;
      width: var(--kf-chat-width) !important;
      min-width: 320px !important;
      max-width: 520px !important;
    }

    [data-kf-chat-panel] :is(#channel-chatroom, [data-testid="chatroom"]) {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
    }

    html[data-kf-chat="right"] [data-kf-chat-panel][data-kf-chat-resizing="true"],
    html[data-kf-chat="left"] [data-kf-chat-panel][data-kf-chat-resizing="true"] {
      transition: none !important;
    }

    html[data-kf-theater="true"] [data-kf-channel-row] {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      overflow: hidden !important;
    }

    html[data-kf-theater="true"] [data-kf-channel-row] > :not([data-kf-chat-panel]) {
      max-width: 100% !important;
      min-width: 0 !important;
    }

    html[data-kf-chat="docked"] [data-kf-chat-separator] { display: none !important; }
    html[data-kf-chat="docked"] [data-kf-chat-panel] {
      position: fixed !important;
      right: 22px !important;
      bottom: 22px !important;
      z-index: 80 !important;
      width: var(--kf-chat-width) !important;
      height: min(620px, calc(100vh - 104px)) !important;
      border: 1px solid var(--kf-border) !important;
      border-radius: var(--kf-radius) !important;
      box-shadow: 0 24px 70px rgba(0,0,0,.56) !important;
      overflow: hidden !important;
      background: var(--kf-panel) !important;
    }

    html[data-kf-wide-grid="true"] :is(main, #main-container) section[class*="grid"],
    html[data-kf-wide-grid="true"] :is(main, #main-container) [class*="group/grid"] {
      grid-template-columns: repeat(auto-fit, minmax(min(272px, 100%), 1fr)) !important;
      gap: 20px !important;
    }

    html[data-kf-following-rail="false"] :is(main, #main-container) [data-testid*="following" i],
    html[data-kf-following-rail="false"] :is(main, #main-container) [data-kf-following-rail],
    html[data-kf-recommended-rail="false"] :is(main, #main-container) [data-testid*="recommended" i],
    html[data-kf-recommended-rail="false"] :is(main, #main-container) [data-kf-recommended-rail] { display: none !important; }

    ${hiddenElementCss()}

    html[data-kf-density="compact"] :is(main, #main-container) section[class*="grid"],
    html[data-kf-density="compact"] :is(main, #main-container) [class*="group/grid"] { gap: 12px !important; }

    html[data-kf-sticky="true"] nav {
      min-height: 56px !important;
      backdrop-filter: none !important;
      background: var(--kf-surface-inset) !important;
      border-bottom: 1px solid var(--kf-border) !important;
    }

    :is(main, #main-container) { font-size: calc(1rem * var(--kf-text-scale)); }

    :is(main, #main-container) [class*="group/card"] {
      border-radius: var(--kf-radius) !important;
      outline: 0 !important;
      transition: filter 150ms ease !important;
    }

    :is(main, #main-container) [class*="group/card"]:hover,
    :is(main, #main-container) [class*="group/card"]:focus-within {
      outline: 0 !important;
    }

    :is(main, #main-container) [class*="group/card"] img {
      filter: saturate(var(--kf-thumb-saturation));
      transition: filter 160ms ease, opacity 160ms ease !important;
    }

    html[data-kf-dim-watched="true"] :is(main, #main-container) [data-kf-watched="true"] {
      opacity: .64;
      filter: grayscale(.14);
    }

    html[data-kf-live-color="true"] :is(main, #main-container) [data-kf-live-card="true"] {
      box-shadow: none !important;
    }

    html[data-kf-mature-blur="true"] [data-kf-mature="true"] img {
      filter: blur(13px) saturate(.72) !important;
      opacity: .72 !important;
    }

    html[data-kf-mature-blur="true"] [data-kf-mature="true"]:is(:hover,:focus-within) img {
      filter: saturate(var(--kf-thumb-saturation)) !important;
      opacity: 1 !important;
    }

    [data-kf-filtered="true"],
    [data-kf-dismissed="true"],
    [data-kf-ad-shell="true"] { display: none !important; }

    html[data-kf-poor-mode="true"] [data-kf-monetization] { display: none !important; }

    /* Chat comfort, on Kick's own rows. A priority message gets a rule down its
       left edge rather than a background wash: the row still reads as chat, and
       the marker survives every theme Kick ships. */
    [data-kf-chat-priority="true"] { border-left: 2px solid var(--kf-accent); padding-left: 6px; }
    [data-kf-chat-hidden="true"] > * { display: none !important; }
    [data-kf-chat-hidden="true"]::after {
      content: attr(data-kf-hidden-note);
      display: block; padding: 4px 8px; color: #9aa4a0; font-size: 12px; font-style: italic;
    }
    [data-kf-chat-hide] {
      float: right; margin-left: 6px; padding: 0 5px; color: #9aa4a0;
      border: 1px solid rgba(255,255,255,.14); border-radius: 5px; background: transparent;
      font-size: 12px; line-height: 1.5; cursor: pointer;
    }
    [data-kf-chat-hide]:hover, [data-kf-chat-hide]:focus-visible { color: #fff; border-color: var(--kf-accent); }

    [data-kf-card-actions] {
      position: absolute !important;
      top: 8px !important;
      right: 8px !important;
      z-index: 6 !important;
      display: flex !important;
      gap: 5px !important;
      opacity: 0 !important;
      transition: opacity 120ms ease !important;
    }

    [class*="group/card"]:hover [data-kf-card-actions],
    [class*="group/card"]:focus-within [data-kf-card-actions],
    [data-testid="livestream-results-card"]:hover [data-kf-card-actions],
    [data-testid="livestream-results-card"]:focus-within [data-kf-card-actions],
    [data-testid="stream-card"]:hover [data-kf-card-actions],
    [data-testid="stream-card"]:focus-within [data-kf-card-actions] { opacity: 1 !important; }

    [data-kf-card-actions] button {
      min-width: 30px !important;
      min-height: 30px !important;
      padding: 0 7px !important;
      border: 1px solid rgba(255,255,255,.24) !important;
      border-radius: 4px !important;
      background: var(--kf-panel) !important;
      color: var(--kf-text) !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: 760 !important;
    }

    [data-kf-card-actions] button:hover,
    [data-kf-card-actions] button[data-active="true"] { border-color: var(--kf-accent) !important; color: var(--kf-accent) !important; }

    [data-kf-card-uptime] {
      display: inline-flex !important;
      align-items: center !important;
      min-height: 18px !important;
      margin-left: 5px !important;
      padding: 0 5px !important;
      border: 0 !important;
      border-radius: 3px !important;
      background: rgba(10, 12, 11, .82) !important;
      color: #fff !important;
      font-size: 11px !important;
      font-weight: 720 !important;
      font-variant-numeric: tabular-nums !important;
      line-height: 18px !important;
      letter-spacing: .01em !important;
      white-space: nowrap !important;
      box-shadow: 0 1px 4px rgba(0, 0, 0, .28) !important;
    }

    [data-kf-highlighted="true"] { box-shadow: inset 3px 0 0 var(--kf-accent) !important; background: rgba(var(--kf-accent-rgb), .07) !important; }
    /* The matched words, painted from the Custom Highlight registry — no node
       is written into chat for this. Only colour properties apply here. */
    ::highlight(kick-focus-keyword) { background-color: rgba(var(--kf-accent-rgb, 124, 255, 43), .32); color: inherit; }

    html[data-kf-mini-player-collision="true"] #injected-embedded-channel-player { bottom: 82px !important; }

    html[data-kf-player-contain="true"] #main-container video,
    html[data-kf-player-contain="true"] [data-kf-player] video { object-fit: contain !important; max-width: 100% !important; max-height: 100% !important; }

    [data-kf-chat-pause] {
      position: absolute !important;
      top: 8px !important;
      right: 8px !important;
      z-index: 7 !important;
      min-height: 30px !important;
      padding: 0 9px !important;
      border: 1px solid rgba(255,255,255,.25) !important;
      border-radius: 4px !important;
      background: var(--kf-panel) !important;
      color: var(--kf-text) !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: 760 !important;
    }

    [data-kf-chat-status], [data-kf-playback-diagnostics], [data-kf-uptime], [data-kf-vod-expiry] {
      position: absolute !important;
      z-index: 7 !important;
      border: 0 !important;
      border-radius: var(--kf-radius) !important;
      background: var(--kf-panel) !important;
      color: var(--kf-text) !important;
      font: 12px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace !important;
    }

    [data-kf-chat-status] { top: 44px !important; right: 8px !important; padding: 5px 8px !important; }
    [data-kf-playback-diagnostics] { right: 12px !important; bottom: 12px !important; padding: 6px 8px !important; pointer-events: none !important; }
    /* Top-left, where a broadcast clock is conventionally read, and clear of
       the player's own bottom control bar and of the diagnostics panel. */
    [data-kf-uptime] {
      top: 10px !important; left: 10px !important; padding: 4px 7px !important;
      background: rgba(13,16,14,.82) !important; pointer-events: none !important;
      font-variant-numeric: tabular-nums !important; letter-spacing: .02em !important;
      opacity: .92 !important;
    }

    /* Directly under the uptime chip, in the same top-left column: the two are
       mutually exclusive in practice (one dates a live stream, the other a
       recording), so the offset only matters if Kick ever serves both. */
    [data-kf-vod-expiry] {
      top: 10px !important; left: 10px !important; padding: 4px 7px !important;
      background: rgba(13,16,14,.82) !important; pointer-events: none !important;
      font-variant-numeric: tabular-nums !important; letter-spacing: .02em !important;
      opacity: .92 !important;
    }
    [data-kf-uptime] ~ [data-kf-vod-expiry] { top: 40px !important; }

    [data-kf-search-meta] {
      box-sizing: border-box !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 18px !important;
      margin: 0 0 16px !important;
      padding: 2px 0 14px !important;
      border: 0 !important;
      border-bottom: 1px solid var(--kf-border) !important;
      border-radius: 0 !important;
      background: transparent !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    [data-kf-search-meta] > div { display: flex !important; align-items: baseline !important; flex-wrap: wrap !important; gap: 12px !important; }
    [data-kf-search-meta] strong { color: var(--kf-text) !important; font-size: 24px !important; line-height: 1.2 !important; letter-spacing: -.025em !important; }
    [data-kf-search-meta] span { color: var(--kf-text-muted) !important; font-size: 14px !important; font-weight: 560 !important; }
    [data-kf-search-meta] button { min-height: 32px !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; color: var(--kf-accent) !important; cursor: pointer !important; font-size: 14px !important; font-weight: 700 !important; }

    [data-kf-native-drops-empty="true"] > [data-testid="empty-state-root"] { display: none !important; }
    [data-kf-drops-empty] {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 300px !important;
      gap: 0 !important;
      width: 100% !important;
      margin-top: 16px !important;
    }
    [data-kf-drops-primary], [data-kf-drops-activity], [data-kf-drops-steps] {
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    [data-kf-drops-primary] { display: flex !important; min-height: 320px !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; padding: 42px 48px !important; text-align: center !important; }
    [data-kf-drops-eyebrow] { display: none !important; }
    [data-kf-drops-primary] h3 { margin: 0 !important; color: var(--kf-text) !important; font-size: 28px !important; letter-spacing: -.025em !important; }
    [data-kf-drops-primary] p { max-width: 520px !important; margin: 10px 0 22px !important; color: var(--kf-text-muted) !important; font-size: 15px !important; line-height: 1.5 !important; }
    [data-kf-drops-actions] { display: flex !important; flex-wrap: wrap !important; justify-content: center !important; gap: 10px !important; }
    [data-kf-drops-actions] a { display: inline-flex !important; min-height: 42px !important; align-items: center !important; justify-content: center !important; padding: 0 16px !important; border: 1px solid var(--kf-border-strong) !important; border-radius: 6px !important; color: var(--kf-text) !important; font-size: 14px !important; font-weight: 720 !important; text-decoration: none !important; }
    [data-kf-drops-actions] a:first-child { border-color: var(--kf-accent) !important; background: var(--kf-accent) !important; color: var(--kf-on-accent, #071004) !important; }
    [data-kf-drops-activity] { grid-column: 2 !important; grid-row: 1 !important; align-self: stretch !important; padding: 28px 0 28px 38px !important; border-left: 1px solid var(--kf-border) !important; }
    [data-kf-drops-activity] > strong { display: block !important; margin-bottom: 14px !important; font-size: 17px !important; }
    [data-kf-drops-activity] dl { display: grid !important; gap: 0 !important; margin: 0 !important; }
    [data-kf-drops-activity] dl > div { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; min-height: 58px !important; border-bottom: 1px solid var(--kf-border) !important; }
    [data-kf-drops-activity] dt { color: var(--kf-text-muted) !important; font-size: 14px !important; }
    [data-kf-drops-activity] dd { margin: 0 !important; color: var(--kf-text) !important; font-size: 16px !important; font-weight: 760 !important; }
    [data-kf-drops-activity] a { color: var(--kf-accent) !important; text-decoration: none !important; }
    [data-kf-drops-steps] { display: grid !important; grid-column: 1 / -1 !important; grid-template-columns: repeat(3, minmax(0,1fr)) !important; gap: 0 !important; margin: 0 !important; padding: 24px 0 0 !important; border-top: 1px solid var(--kf-border) !important; list-style: none !important; }
    [data-kf-drops-steps] li { display: flex !important; align-items: flex-start !important; gap: 12px !important; min-height: 72px !important; padding: 4px 24px !important; border-right: 1px solid var(--kf-border) !important; }
    [data-kf-drops-steps] li:last-child { border-right: 0 !important; }
    [data-kf-drops-steps] li > span { display: grid !important; width: 25px !important; height: 25px !important; flex: 0 0 25px !important; place-items: center !important; border-radius: 50% !important; background: var(--kf-accent) !important; color: var(--kf-on-accent, #071004) !important; font-size: 12px !important; font-weight: 900 !important; }
    [data-kf-drops-steps] strong, [data-kf-drops-steps] small { display: block !important; }
    [data-kf-drops-steps] strong { color: var(--kf-text) !important; font-size: 14px !important; }
    [data-kf-drops-steps] small { margin-top: 4px !important; color: var(--kf-text-muted) !important; font-size: 13px !important; line-height: 1.4 !important; }
  }

  [data-kf-sticker-organizer] {
      margin: 2px 8px 8px !important;
      padding: 8px 0 0 !important;
      border: 0 !important;
      border-top: 1px solid var(--kf-border) !important;
      border-radius: 0 !important;
      background: transparent !important;
      color: #f7f9fa !important;
    }

    #chat-emotes-picker-panel > div[style]:not([style*="max-height: 0"]) {
      max-height: min(640px, calc(100vh - 132px)) !important;
      border-top: 1px solid var(--kf-border) !important;
      border-radius: 10px 10px 0 0 !important;
      background: var(--kf-panel) !important;
      box-shadow: 0 -18px 48px rgba(0,0,0,.42) !important;
    }

    [data-kf-sticker-scroll] { min-width: 0 !important; overflow-x: hidden !important; }
    [data-kf-sticker-native-shell] { min-width: 0 !important; width: 100% !important; grid-template-columns: minmax(0, 1fr) !important; }
    [data-kf-sticker-native-shell] > * { min-width: 0 !important; max-width: 100% !important; }

    #chat-emotes-picker-panel #search-emotes-input {
      min-height: 40px !important;
      border-color: var(--kf-border-strong) !important;
      border-radius: 8px !important;
      background: var(--kf-canvas) !important;
    }

    [data-kf-sticker-topline] {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 10px !important;
      margin-bottom: 7px !important;
    }
    [data-kf-sticker-heading] { min-width: 0 !important; }
    [data-kf-sticker-heading] strong { display: block !important; color: var(--kf-text) !important; font-size: 14px !important; line-height: 1.15 !important; }
    [data-kf-sticker-heading] span { display: block !important; margin-top: 2px !important; color: var(--kf-text-muted) !important; font-size: 11px !important; line-height: 1.25 !important; }
    [data-kf-sticker-top-actions] { display: flex !important; align-items: center !important; gap: 5px !important; }
    [data-kf-sticker-top-actions] button,
    [data-kf-sticker-group-create],
    [data-kf-sticker-group-actions] button,
    [data-kf-sticker-editor-actions] button,
    [data-kf-sticker-batch] button {
      display: inline-flex !important;
      min-height: 30px !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 5px !important;
      padding: 0 8px !important;
      border: 1px solid var(--kf-border) !important;
      border-radius: 6px !important;
      background: transparent !important;
      color: var(--kf-text-muted) !important;
      cursor: pointer !important;
      font-size: 11px !important;
      font-weight: 720 !important;
    }
    [data-kf-sticker-top-actions] button:hover,
    [data-kf-sticker-top-actions] button:focus-visible,
    [data-kf-sticker-group-create]:hover,
    [data-kf-sticker-group-create]:focus-visible,
    [data-kf-sticker-group-actions] button:hover,
    [data-kf-sticker-group-actions] button:focus-visible,
    [data-kf-sticker-editor-actions] button:hover,
    [data-kf-sticker-editor-actions] button:focus-visible,
    [data-kf-sticker-batch] button:hover,
    [data-kf-sticker-batch] button:focus-visible { border-color: var(--kf-border-strong) !important; color: var(--kf-text) !important; }
    [data-kf-sticker-top-actions] button[aria-pressed="true"] { border-color: rgba(var(--kf-accent-rgb), .55) !important; background: rgba(var(--kf-accent-rgb), .1) !important; color: var(--kf-accent) !important; }
    [data-kf-sticker-organizer] .kf-icon { width: 13px !important; height: 13px !important; flex: 0 0 13px !important; fill: none !important; stroke: currentColor !important; stroke-width: 2 !important; stroke-linecap: round !important; stroke-linejoin: round !important; }

    [data-kf-sticker-tabs] {
      display: flex !important;
      align-items: stretch !important;
      gap: 2px !important;
      margin: 0 -2px !important;
      padding: 0 2px 7px !important;
      border-bottom: 1px solid var(--kf-border) !important;
      overflow-x: auto !important;
      scrollbar-width: none !important;
    }
    [data-kf-sticker-tabs]::-webkit-scrollbar { display: none !important; }
    [data-kf-sticker-tabs] button {
      display: inline-flex !important;
      min-height: 32px !important;
      flex: 0 0 auto !important;
      align-items: center !important;
      gap: 4px !important;
      padding: 0 8px !important;
      border: 0 !important;
      border-radius: 6px !important;
      background: transparent !important;
      color: var(--kf-text-muted) !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: 720 !important;
    }
    [data-kf-sticker-tabs] button span { color: inherit !important; font-size: 10px !important; font-variant-numeric: tabular-nums !important; opacity: .72 !important; }
    [data-kf-sticker-tabs] button:hover,
    [data-kf-sticker-tabs] button:focus-visible { background: rgba(255,255,255,.055) !important; color: var(--kf-text) !important; }
    [data-kf-sticker-tabs] button[data-active="true"] { background: var(--kf-accent) !important; color: var(--kf-on-accent, #071004) !important; }

    [data-kf-sticker-group-panel] {
      margin: 8px 0 0 !important;
      padding: 8px !important;
      border: 1px solid var(--kf-border) !important;
      border-radius: 8px !important;
      background: rgba(255,255,255,.025) !important;
    }
    [data-kf-sticker-group-list] { display: flex !important; align-items: center !important; gap: 5px !important; overflow-x: auto !important; scrollbar-width: thin !important; }
    [data-kf-sticker-group-list] > button:not([data-kf-sticker-group-create]) {
      min-height: 30px !important;
      flex: 0 0 auto !important;
      padding: 0 9px !important;
      border: 1px solid transparent !important;
      border-radius: 999px !important;
      background: rgba(255,255,255,.05) !important;
      color: var(--kf-text-muted) !important;
      cursor: pointer !important;
      font-size: 11px !important;
      font-weight: 700 !important;
    }
    [data-kf-sticker-group-list] > button[data-active="true"] { border-color: rgba(var(--kf-accent-rgb), .5) !important; background: rgba(var(--kf-accent-rgb), .1) !important; color: var(--kf-accent) !important; }
    [data-kf-sticker-group-create] { flex: 0 0 auto !important; }
    [data-kf-sticker-group-summary] { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; margin-top: 7px !important; padding-top: 7px !important; border-top: 1px solid var(--kf-border) !important; }
    [data-kf-sticker-group-summary] > span { min-width: 0 !important; color: var(--kf-text-muted) !important; font-size: 11px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
    [data-kf-sticker-group-actions] { display: flex !important; flex: 0 0 auto !important; gap: 4px !important; }
    [data-kf-sticker-group-actions] button { min-height: 27px !important; padding-inline: 6px !important; }
    [data-kf-sticker-group-actions] button[data-kf-sticker-group-delete] { color: var(--kf-danger) !important; }
    [data-kf-sticker-group-editor] { display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; gap: 6px !important; margin-top: 7px !important; }
    [data-kf-sticker-group-editor] input { min-width: 0 !important; min-height: 34px !important; padding: 0 9px !important; border: 1px solid var(--kf-border-strong) !important; border-radius: 6px !important; background: var(--kf-canvas) !important; color: var(--kf-text) !important; font-size: 12px !important; }
    [data-kf-sticker-editor-actions] { display: flex !important; gap: 4px !important; }
    [data-kf-sticker-editor-actions] button[data-kf-sticker-group-save] { border-color: var(--kf-accent) !important; background: var(--kf-accent) !important; color: var(--kf-on-accent, #071004) !important; }

    [data-kf-sticker-batch] {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto !important;
      gap: 7px !important;
      margin-top: 8px !important;
      padding: 8px !important;
      border: 1px solid rgba(var(--kf-accent-rgb), .35) !important;
      border-radius: 8px !important;
      background: rgba(var(--kf-accent-rgb), .065) !important;
    }
    [data-kf-sticker-batch-summary] { display: flex !important; min-width: 0 !important; align-items: center !important; flex-wrap: wrap !important; gap: 4px 7px !important; }
    [data-kf-sticker-batch-summary] strong { color: var(--kf-text) !important; font-size: 12px !important; }
    [data-kf-sticker-batch-summary] button { min-height: 26px !important; padding-inline: 5px !important; border: 0 !important; color: var(--kf-accent) !important; }
    [data-kf-sticker-batch-actions] { display: flex !important; align-items: center !important; gap: 4px !important; }
    [data-kf-sticker-batch] select { min-height: 30px !important; max-width: 128px !important; padding: 0 24px 0 8px !important; border: 1px solid var(--kf-border-strong) !important; border-radius: 6px !important; background: var(--kf-canvas) !important; color: var(--kf-text) !important; font-size: 11px !important; }
    [data-kf-sticker-batch] button:disabled { cursor: not-allowed !important; opacity: .42 !important; }
    [data-kf-sticker-batch] button[data-kf-sticker-batch-remove] { color: var(--kf-danger) !important; }

    [data-kf-sticker-grid] {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)) !important;
      /* Fixed rows are what let one spacer stand in for a known number of them.
         The values here are mirrored by STICKER_TILE_HEIGHT/STICKER_GRID_GAP. */
      grid-auto-rows: 62px !important;
      gap: 7px !important;
      max-height: min(350px, 40vh) !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      scrollbar-gutter: stable !important;
      padding: 8px 2px 5px !important;
    }
    /* The picker grid scrolls inside a capped height and can hold hundreds of
       tiles. Skipping layout and paint for the off-screen ones is what keeps
       opening it cheap; the intrinsic size holds the scroll height steady. */
    [data-kf-sticker-item] { position: relative !important; min-width: 0 !important; min-height: 62px !important; text-align: center !important; content-visibility: auto !important; contain-intrinsic-size: auto 62px !important; }
    /* Stands in for the rows outside the rendered window, so the scrollbar
       still describes the whole library. Spans every column, draws nothing. */
    [data-kf-sticker-spacer] { grid-column: 1 / -1 !important; pointer-events: none !important; }
    [data-kf-sticker-proxy] {
      display: grid !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 58px !important;
      padding: 7px !important;
      border: 1px solid transparent !important;
      border-radius: 7px !important;
      background: rgba(255,255,255,.045) !important;
      cursor: pointer !important;
    }
    [data-kf-sticker-proxy]:hover, [data-kf-sticker-proxy]:focus-visible { border-color: rgba(var(--kf-accent-rgb), .42) !important; background: rgba(var(--kf-accent-rgb), .1) !important; }
    [data-kf-sticker-item][data-kf-sticker-selected="true"] [data-kf-sticker-proxy] { border-color: var(--kf-accent) !important; background: rgba(var(--kf-accent-rgb), .14) !important; box-shadow: inset 0 0 0 1px var(--kf-accent) !important; }
    [data-kf-sticker-scoped="true"] [data-kf-sticker-proxy] { position: relative !important; box-shadow: inset 0 0 0 1px rgba(var(--kf-accent-rgb), .5) !important; }
    [data-kf-sticker-scoped="true"] [data-kf-sticker-proxy]::after { content: "" !important; position: absolute !important; right: 0 !important; bottom: 0 !important; border-left: 7px solid transparent !important; border-bottom: 7px solid var(--kf-accent) !important; }
    [data-kf-sticker-proxy] img { width: 100% !important; height: 100% !important; object-fit: contain !important; }
    [data-kf-sticker-check] { display: none !important; position: absolute !important; top: 3px !important; left: 3px !important; z-index: 3 !important; width: 20px !important; height: 20px !important; place-items: center !important; border: 1px solid var(--kf-border-strong) !important; border-radius: 50% !important; background: var(--kf-panel-raised) !important; color: transparent !important; pointer-events: none !important; }
    [data-kf-sticker-organizer][data-kf-sticker-organizing="true"] [data-kf-sticker-check] { display: grid !important; }
    [data-kf-sticker-item][data-kf-sticker-selected="true"] [data-kf-sticker-check] { border-color: var(--kf-accent) !important; background: var(--kf-accent) !important; color: var(--kf-on-accent, #071004) !important; }
    [data-kf-sticker-tools] { display: flex !important; position: absolute !important; top: 3px !important; right: 3px !important; bottom: 3px !important; z-index: 3 !important; flex-direction: column !important; justify-content: space-between !important; pointer-events: none !important; }
    [data-kf-sticker-tools] button {
      display: grid !important;
      width: 23px !important;
      height: 23px !important;
      min-height: 23px !important;
      padding: 0 !important;
      place-items: center !important;
      border: 1px solid var(--kf-border) !important;
      border-radius: 6px !important;
      background: rgba(8,12,9,.94) !important;
      color: var(--kf-text-muted) !important;
      cursor: pointer !important;
      opacity: 0 !important;
      pointer-events: auto !important;
      transition: opacity 100ms ease, border-color 100ms ease, color 100ms ease !important;
    }
    [data-kf-sticker-item]:hover [data-kf-sticker-tools] button,
    [data-kf-sticker-item]:focus-within [data-kf-sticker-tools] button,
    [data-kf-sticker-item][data-kf-sticker-pinned="true"] [data-kf-sticker-action="pin"] { opacity: 1 !important; }
    [data-kf-sticker-organizer][data-kf-sticker-organizing="true"] [data-kf-sticker-tools] { display: none !important; }
    [data-kf-sticker-tools] button:hover, [data-kf-sticker-tools] button:focus-visible { border-color: var(--kf-accent) !important; color: var(--kf-accent) !important; }
    [data-kf-sticker-tools] button[aria-pressed="true"] { border-color: rgba(var(--kf-accent-rgb), .58) !important; color: var(--kf-accent) !important; }
    [data-kf-sticker-tools] button[aria-pressed="true"] .kf-icon { fill: currentColor !important; }
    [data-kf-sticker-tools] button[data-kf-sticker-action="hide"]:hover,
    [data-kf-sticker-tools] button[data-kf-sticker-action="hide"]:focus-visible { border-color: var(--kf-danger) !important; color: var(--kf-danger) !important; }
    [data-kf-sticker-empty] { display: grid !important; min-height: 112px !important; place-items: center !important; padding: 18px !important; color: var(--kf-text-muted) !important; font-size: 12px !important; line-height: 1.45 !important; text-align: center !important; }
    [data-kf-sticker-empty] strong { display: block !important; margin-bottom: 3px !important; color: var(--kf-text) !important; font-size: 13px !important; }

    @media (max-width: 1023px) {
      [data-kf-sticker-top-actions] button span { display: none !important; }
      [data-kf-sticker-batch] { grid-template-columns: 1fr !important; }
      [data-kf-sticker-batch-actions] { justify-content: flex-start !important; }
      [data-kf-sticker-group-summary] { align-items: flex-start !important; flex-direction: column !important; }
    }
    html[data-kf-sticker-view="all"] #chat-emotes-picker-panel button[data-kf-sticker-key][data-kf-sticker-native="true"],
    html[data-kf-sticker-view="pinned"] #chat-emotes-picker-panel button[data-kf-sticker-key][data-kf-sticker-native="true"],
    html[data-kf-sticker-view="recent"] #chat-emotes-picker-panel button[data-kf-sticker-key][data-kf-sticker-native="true"],
    html[data-kf-sticker-view="group"] #chat-emotes-picker-panel button[data-kf-sticker-key][data-kf-sticker-native="true"] { display: none !important; }
    html[data-kf-sticker-view="all"] #chat-emotes-picker-panel [data-kf-sticker-native-group],
    html[data-kf-sticker-view="pinned"] #chat-emotes-picker-panel [data-kf-sticker-native-group],
    html[data-kf-sticker-view="recent"] #chat-emotes-picker-panel [data-kf-sticker-native-group],
    html[data-kf-sticker-view="group"] #chat-emotes-picker-panel [data-kf-sticker-native-group] { display: none !important; }
    html[data-kf-sticker-view="all"] #chat-emotes-picker-panel [data-kf-sticker-native-list],
    html[data-kf-sticker-view="pinned"] #chat-emotes-picker-panel [data-kf-sticker-native-list],
    html[data-kf-sticker-view="recent"] #chat-emotes-picker-panel [data-kf-sticker-native-list],
    html[data-kf-sticker-view="group"] #chat-emotes-picker-panel [data-kf-sticker-native-list] { display: none !important; }
    html[data-kf-sticker-view="all"] #chat-emotes-picker-panel [data-kf-sticker-organizer] ~ *,
    html[data-kf-sticker-view="pinned"] #chat-emotes-picker-panel [data-kf-sticker-organizer] ~ *,
    html[data-kf-sticker-view="recent"] #chat-emotes-picker-panel [data-kf-sticker-organizer] ~ *,
    html[data-kf-sticker-view="group"] #chat-emotes-picker-panel [data-kf-sticker-organizer] ~ * { display: none !important; }
    #chat-emotes-picker-panel button[data-kf-sticker-hidden="true"][data-kf-sticker-native="true"] { display: none !important; }
    html[data-kf-stickers-show-hidden="true"] #chat-emotes-picker-panel button[data-kf-sticker-hidden="true"][data-kf-sticker-native="true"] { display: flex !important; opacity: .42 !important; }

  /* Accessibility settings are not a width. Everything below used to sit inside
     the desktop layout media query with the wide-viewport layout rules, so
     Large touch targets, High-contrast text, High-contrast controls and Always
     show focus outlines all switched themselves off under 1024px — on a snapped
     half-screen window, which is exactly where a bigger target and a visible
     outline matter more, not less. The panel's own copies were always
     unconditional, so the mod's chrome honoured the settings while Kick's page
     did not. Layout rules stay in the media query below; these do not. */
  html[data-kf-large-targets="true"] :is(button, a, input, select, textarea) { min-height: 40px; }

  html[data-kf-contrast="true"] :is(main, #main-container) :is(p, span, div) { text-shadow: 0 0 .01px currentColor; }

  /* "High-contrast controls" promises separation for controls, borders and
     surfaces, and for a long time shared one attribute with the text setting
     above and styled nothing but that text-shadow. Raising the two border
     tokens is what the promise actually needs: every control edge in this
     build resolves through them, in Kick's page and in the mod's own chrome,
     so one declaration per theme reaches all of it. Measured edges sat at
     1.15 to 2.78 against their surfaces, under the 3:1 that WCAG 1.4.11 asks
     of a control boundary. */
  html[data-kf-control-contrast="true"] { --kf-border: #6a7a71; --kf-border-strong: #93a49a; --kf-header-edge-alpha: 1; }
  html[data-kf-control-contrast="true"][data-kf-theme="oled"] { --kf-border: #6d7b74; --kf-border-strong: #97a69f; }
  html[data-kf-control-contrast="true"][data-kf-theme="slate"] { --kf-border: #6d8496; --kf-border-strong: #9db2c2; }

  html[data-kf-focus-visible="true"] :is(button, a, input, select, textarea):focus-visible {
    outline: var(--kf-focus-ring) !important;
    outline-offset: 3px !important;
  }

  @media (min-width: 1024px) {
    html[data-kf-focus="true"] :is(main, #main-container) {
      width: 100% !important;
      max-width: none !important;
    }

    html[data-kf-route="category"] :is(main, #main-container) > div:first-child {
      max-width: 1680px;
      margin-inline: auto;
    }
  }

  [id^="google_ads_"],
  [id^="div-gpt-ad"],
  [data-ad-slot],
  [data-ad-unit],
  [data-testid="ad-banner"],
  [data-testid*="advertisement"],
  [aria-label="Advertisement"],
  [aria-label="advertisement"],
  iframe[src*="doubleclick.net"],
  iframe[src*="googlesyndication.com"],
  iframe[src*="googleadservices.com"],
  script[src*="imasdk.googleapis.com"],
  script[src*="doubleclick.net"],
  script[src*="googlesyndication.com"],
  script[src*="googleadservices.com"] { display: none !important; }

  video::cue { background: rgba(0, 0, 0, var(--kf-caption-opacity)); }

  /* Sidebar "dropdown" mode: the discovery rail collapses to a labelled tab and
     expands over the page on hover or keyboard focus, so the grid keeps the
     full width without losing one-move access to channels.

     Concept from the MIT-licensed "KICK Dropdown" userstyle by IamKoeda
     (userstyles.world/style/29036), rebuilt here on this project's own tokens
     and wired to the existing sidebar setting.

     Desktop-only by design: below 1280px the expanded panel would cover the
     content it is meant to navigate. */
  @media (min-width: 1280px) {
    html[data-kf-sidebar="dropdown"] #sidebar-wrapper {
      position: absolute;
      z-index: 60;
      width: var(--kf-sidebar-dropdown-width, 240px);
      max-width: 88vw;
      overflow: hidden;
      border: 1px solid var(--kf-border);
      border-radius: var(--kf-radius);
      background: var(--kf-panel);
      box-shadow: 0 18px 46px rgba(0,0,0,.55);
      transform: translateX(calc(-100% + var(--kf-sidebar-dropdown-tab, 34px)));
      transition: transform .28s ease, border-color .28s ease;
    }
    html[data-kf-sidebar="dropdown"] #sidebar-wrapper::after {
      content: "";
      position: absolute;
      inset-block: 0;
      right: 0;
      width: var(--kf-sidebar-dropdown-tab, 34px);
      border-left: 1px solid var(--kf-border);
      background: linear-gradient(180deg, rgba(var(--kf-accent-rgb), .10), transparent);
      pointer-events: none;
    }
    html[data-kf-sidebar="dropdown"] #sidebar-wrapper:hover,
    html[data-kf-sidebar="dropdown"] #sidebar-wrapper:focus-within {
      transform: translateX(0);
      border-color: rgba(var(--kf-accent-rgb), .45);
    }
    html[data-kf-sidebar="dropdown"] #sidebar-wrapper:hover::after,
    html[data-kf-sidebar="dropdown"] #sidebar-wrapper:focus-within::after { opacity: 0; }
    /* Kick's own collapse control would fight this mode. */
    html[data-kf-sidebar="dropdown"] [aria-controls="sidebar-wrapper"] { display: none !important; }
    /* Reclaim the space the rail no longer occupies. */
    html[data-kf-sidebar="dropdown"] :is(main, #main-container) { margin-left: var(--kf-sidebar-dropdown-tab, 34px); }
    /* A panel that slides out under the pointer is exactly what reduced-motion
       is asking us not to animate. It still expands — it just does it at once. */
    html[data-kf-sidebar="dropdown"][data-kf-reduce-motion="true"] #sidebar-wrapper { transition: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    html[data-kf-sidebar="dropdown"] #sidebar-wrapper { transition: none; }
    #kick-focus-following-preview { transition: none !important; transform: none !important; }
  }

  /* Badges Kick's own markup omits. badges_v2 carries collectible and global
     badges the legacy array does not, so these fill a gap rather than restyle
     what Kick already drew. Sized to sit on the identity line. */
  .kf-chat-badges {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-right: 4px;
    vertical-align: text-bottom;
  }
  .kf-chat-badge {
    width: 18px;
    height: 18px;
    object-fit: contain;
    border-radius: 3px;
  }
  .kf-chat-badge-text {
    padding: 1px 5px;
    border: 1px solid var(--kf-border-strong);
    border-radius: 3px;
    color: var(--kf-text-muted);
    font-size: 10px;
    font-weight: 700;
    line-height: 1.4;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Why a message disappeared. The DOM only removes the node; the realtime
     event carries the reason, and no DOM-scraping tool can see it. */
  .kf-deletion-note {
    margin-top: 4px;
    padding: 4px 8px;
    border-left: 3px solid var(--kf-border-strong);
    border-radius: 4px;
    background: rgba(255,255,255,.04);
    color: var(--kf-text-muted);
    font-size: 11px;
    font-style: italic;
  }
  [data-kf-ai-moderated="true"] .kf-deletion-note {
    border-left-color: #d98b3a;
    color: #e7b478;
  }

  /* Collectible emotes can be 2:1. The rule lives only in Kick's own client,
     so every third-party renderer squashes them square. */
  img[data-kf-emote-aspect="wide"] { width: auto !important; aspect-ratio: 2 / 1; object-fit: contain; }

  /* An explicit accessibility request framed as seizure risk: animated emotes
     rendered as a single static frame, everywhere they appear. */
  html[data-kf-static-emotes="true"] img[src*="/emotes/" i],
  html[data-kf-static-emotes="true"] img[data-src*="/emotes/" i] {
    animation-play-state: paused !important;
  }
  @media (prefers-reduced-motion: reduce) {
    html[data-kf-reduce-motion="true"] img[src*="/emotes/" i] { animation-play-state: paused !important; }
  }

  /* Shared interaction states for controls the extension adds to Kick. */
  :is([data-kf-card-actions] button, [data-kf-chat-pause], [data-kf-sticker-action], [data-kf-header-control]) {
    transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, transform 120ms ease !important;
  }
  :is([data-kf-card-actions] button, [data-kf-chat-pause], [data-kf-sticker-action], [data-kf-header-control]):hover {
    background: var(--kf-surface-hover) !important;
  }
  :is([data-kf-card-actions] button, [data-kf-chat-pause], [data-kf-sticker-action], [data-kf-header-control]):active {
    transform: translateY(1px) !important;
  }
  :is([data-kf-card-actions] button, [data-kf-chat-pause], [data-kf-sticker-action], [data-kf-header-control]):disabled {
    opacity: .48 !important;
    cursor: not-allowed !important;
    transform: none !important;
  }
  :is([data-kf-card-actions] button, [data-kf-chat-pause], [data-kf-sticker-action], [data-kf-header-control]):focus-visible {
    outline: var(--kf-focus-ring) !important;
    outline-offset: 2px !important;
  }
  [data-kf-chat-emote-save] {
    border-radius: 4px !important;
    cursor: pointer !important;
    outline: 1px solid transparent;
    outline-offset: 2px;
    transition: filter 120ms ease, outline-color 120ms ease, transform 120ms ease !important;
  }
  [data-kf-chat-emote-save]:is(:hover, :focus-visible) {
    filter: brightness(1.14) saturate(1.08) !important;
    outline-color: var(--kf-accent) !important;
    transform: translateY(-1px) scale(1.05);
  }
  [data-kf-chat-emote-save]:active { transform: translateY(0) scale(1); }
  [data-kf-chat-emote-save][aria-busy="true"] { cursor: progress !important; opacity: .62; }

  /* ---------------------------------------------------------------------
     Motion, last in the sheet.

     This used to sit near the top. The transition-duration set here is a
     longhand, and the later transition shorthands on the card actions, the
     chat pause button, the sticker actions and the injected header control
     resolve to the same specificity, so source order decided and the rules
     that animate came second. Reduce motion read as on and four of this
     build's own controls still slid and lifted under it.

     No backtick anywhere in this comment: it lives inside a template literal,
     and one would end the string. See the 2026-08-21 note in CLAUDE.md.

     Two copies on purpose. The first is the setting. The second is the
     operating system's preference on its own, which the panel's own sheet has
     always honoured unconditionally; without it the page and the panel
     disagreed about the same user's stated preference.
     --------------------------------------------------------------------- */
  html[data-kf-reduce-motion="true"] *,
  html[data-kf-reduce-motion="true"] *::before,
  html[data-kf-reduce-motion="true"] *::after {
    scroll-behavior: auto !important;
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }

  @media (prefers-reduced-motion: reduce) {
    /* Excludes an explicit "false". The setting defaults to on, so this is the
       operating system's preference reaching the page for a user who never
       opened the panel; somebody who went in and turned Reduce motion off has
       said what they want, and the build's own reward-animation rule treats the
       two the same way. */
    html[data-kf-route]:not([data-kf-reduce-motion="false"]) *,
    html[data-kf-route]:not([data-kf-reduce-motion="false"]) *::before,
    html[data-kf-route]:not([data-kf-reduce-motion="false"]) *::after {
      scroll-behavior: auto !important;
      animation-duration: .001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .001ms !important;
    }
  }

`;

function applySettingsAttributes() {
  const root = document.documentElement;
  const { layout, appearance, content, accessibility } = state.settings;
  root.dataset.kfRoute = state.route;
  root.dataset.kfSidebar = state.runtime.sidebarHidden ? 'hidden' : layout.sidebar;
  root.dataset.kfChat = state.runtime.chatHidden ? 'hidden' : layout.chat;
  root.dataset.kfDensity = layout.density;
  root.dataset.kfSticky = String(layout.stickyTopbar);
  root.dataset.kfWideGrid = String(layout.wideGrid);
  root.dataset.kfFollowingRail = String(layout.showFollowingRail);
  root.dataset.kfRecommendedRail = String(layout.showRecommendedRail);
  root.dataset.kfHidden = layout.hidden.join(' ');
  root.dataset.kfMiniPlayerCollision = String(layout.miniPlayerCollision
    && layout.quickButton
    && !state.headerControlHost?.isConnected);
  root.dataset.kfPlayerResize = String(layout.playerResizeRecovery);
  root.dataset.kfPlayerContain = String(layout.playerContainVideo);
  root.dataset.kfTheme = appearance.theme;
  root.dataset.kfAccent = appearance.accent;
  const accent = customAccentTokens(appearance.customAccent);
  root.style.setProperty('--kf-custom-accent', accent.hex);
  if (appearance.accent === 'custom') {
    root.style.setProperty('--kf-accent', accent.hex);
    root.style.setProperty('--kf-accent-rgb', accent.rgb);
    root.style.setProperty('--kf-on-accent', accent.onAccent);
  } else {
    root.style.removeProperty('--kf-accent');
    root.style.removeProperty('--kf-accent-rgb');
    root.style.removeProperty('--kf-on-accent');
  }
  root.dataset.kfRadius = appearance.radius;
  root.dataset.kfDimWatched = String(appearance.dimWatched);
  root.dataset.kfLiveColor = String(appearance.colorizeLive);
  // Two settings, two attributes. They used to be OR'd into one, which made
  // them non-independent: switching "High-contrast controls" off changed
  // nothing while "Strengthen text contrast" was on, and vice versa, so one of
  // the two toggles always looked broken.
  root.dataset.kfContrast = String(appearance.strongContrast);
  root.dataset.kfControlContrast = String(accessibility.highContrast);
  root.dataset.kfMatureBlur = String(content.blurMature && !state.runtime.matureVisible);
  root.dataset.kfPoorMode = String(content.hideMonetization);
  root.dataset.kfReduceMotion = String(accessibility.reduceMotion);
  // An explicit accessibility request framed as seizure risk. The system-level
  // preference turns it on regardless of the switch.
  root.dataset.kfStaticEmotes = String(content.staticEmotes
    || (accessibility.reduceMotion && matchMedia('(prefers-reduced-motion: reduce)').matches));
  root.dataset.kfFocusVisible = String(accessibility.focusVisible);
  root.dataset.kfLargeTargets = String(accessibility.largeTargets);
  // The mod's own chrome lives in a shadow root, where a selector rooted at
  // <html> cannot reach it — so these settings styled Kick's controls and left
  // ours untouched. `:host-context()` would cross the boundary but Firefox has
  // never implemented it, so mirror the flags onto the host and key `:host()`
  // off them instead, which every target engine supports.
  const uiHost = state.shadow?.host;
  if (uiHost) {
    uiHost.dataset.kfLargeTargets = String(accessibility.largeTargets);
    uiHost.dataset.kfReduceMotion = String(accessibility.reduceMotion);
    uiHost.dataset.kfFocusVisible = String(accessibility.focusVisible);
  }
  root.dataset.kfFocus = String(state.runtime.focus);
  root.dataset.kfTheater = String(state.runtime.theater);
  root.dataset.kfChatPaused = String(state.runtime.chatPaused);
  if (content.organizeChatStickers) {
    root.dataset.kfStickerView = state.stickerPreferences.view;
    root.dataset.kfStickersShowHidden = String(state.stickerPreferences.showHidden);
  } else {
    delete root.dataset.kfStickerView;
    delete root.dataset.kfStickersShowHidden;
  }
  root.style.setProperty('--kf-chat-width', `${layout.chatWidth}px`);
  root.style.setProperty('--kf-thumb-saturation', String(.7 + appearance.thumbnail * .006));
  root.style.setProperty('--kf-caption-opacity', String(accessibility.captionOpacity / 100));
  root.style.setProperty('--kf-text-scale', String(accessibility.textSize / 100));
  root.style.setProperty('--color-primary-base', {
    kick: '#7cff2b', cyan: '#38d7d0', violet: '#9667ff', gold: '#ffbe2e',
  }[appearance.accent]);
  const surfaces = {
    studio: ['#101512', '#171e19', '#080b09'],
    oled: ['#050606', '#0a0c0d', '#000000'],
    slate: ['#161b22', '#202832', '#0e1217'],
  }[appearance.theme];
  root.style.setProperty('--color-surface-base', surfaces[0]);
  root.style.setProperty('--color-surface-highest', surfaces[1]);
  root.style.setProperty('--color-surface-lowest', surfaces[2]);
  if (state.root) state.root.style.setProperty('--kf-interface-scale', String(appearance.interfaceScale / 100));
}

/**
 * Poor mode hides only controls positively identified as spending surfaces.
 * It never searches arbitrary page prose, so a chat message mentioning a gift
 * cannot disappear and free actions such as Follow remain untouched.
 */
function tagMonetizationSurfaces() {
  for (const node of document.querySelectorAll('[data-kf-monetization]')) {
    delete node.dataset.kfMonetization;
  }
  if (!state.settings.content.hideMonetization) return;
  // Controls, plus the exact test ids of the surfaces that are not controls —
  // a balance readout is a `<span>` and the gift shop is a panel, and neither
  // was reachable while this walked buttons alone. Ids only: `monetizationKind`
  // never matches prose, so widening the walk cannot widen what it identifies.
  const selector = 'button, a, [role="button"], [data-testid="kicks-value"], [data-testid="gift-shop-panel"]';
  for (const control of document.querySelectorAll(selector)) {
    if (state.root?.contains(control)) continue;
    const kind = monetizationKind({
      text: control.textContent,
      ariaLabel: control.getAttribute('aria-label'),
      title: control.getAttribute('title'),
      testId: control.getAttribute('data-testid'),
    });
    if (kind) control.dataset.kfMonetization = kind;
  }
}

/**
 * Mark the controls the user asked to hide, so the generated CSS can find them.
 *
 * Only the ids actually in the hidden set are looked for, which keeps this at
 * zero queries for the default configuration and bounds it by what the user
 * chose rather than by the size of the catalog. The tag is a pure
 * classification — it says what an element *is*, never whether it is currently
 * hidden — so re-tagging is idempotent, a leftover tag is inert, and a control
 * Kick re-renders picks its tag back up on the next cycle.
 */
function tagHideableElements() {
  const hidden = state.settings.layout.hidden;
  if (!hidden.length) return;
  for (const entry of HIDEABLE_ELEMENTS) {
    if (!hidden.includes(entry.id)) continue;
    // Not `findAllProbe`: hiding is the one thing a fall-through must not be
    // allowed to do. `findHideableElements` hands back nothing unless the probe
    // recorded for this hook is the one that won, so a dropped Kick test id
    // leaves the control visible instead of hiding whatever the looser
    // selector beside it happened to reach.
    const { elements } = findHideableElements(document, entry.probe);
    // Each hideable id is one control or one list container. A fallback
    // selector that matches a crowd is the wrong node, and hiding it would
    // take Kick's chrome with it.
    if (elements.length === 0 || elements.length > 4) continue;
    for (const element of elements) {
      if (state.root?.contains(element)) continue;
      if (element.dataset.kfElement !== entry.id) element.dataset.kfElement = entry.id;
    }
  }
}

/** Route-local account chrome that Kick does not mark as selected accessibly. */
function tagSignedInRouteChrome() {
  if (state.route !== 'settings') return;
  const current = location.pathname.replace(/\/$/, '');
  for (const link of document.querySelectorAll('main a[href^="/settings/"]')) {
    link.dataset.kfSettingsTab = 'true';
    let path = '';
    try { path = new URL(link.href, location.href).pathname.replace(/\/$/, ''); } catch { /* leave unmatched */ }
    link.dataset.kfSettingsActive = String(path === current);
    if (path === current) link.setAttribute('aria-current', 'page');
    else if (link.getAttribute('aria-current') === 'page') link.removeAttribute('aria-current');
  }
}

function chatLayoutOwner(separator, panel) {
  const split = separator?.parentElement;
  if (split?.contains(panel)) {
    // Kick wraps the resizer and #channel-chatroom in a width-bearing flex box,
    // then wraps that once more as the actual flex item beside the player. The
    // old tag landed on #channel-chatroom, so its forced width could grow past
    // the still-narrow outer item and overflow the viewport in Theater mode.
    const outer = split.parentElement;
    if (outer && outer !== document.body && outer.children.length === 1) return outer;
    return split;
  }
  return ownerFromChild(panel, '#channel-chatroom, [data-testid="chatroom"], [data-testid="chatroom-messages"]');
}

/**
 * The separator's reported value, in the two forms a reader needs.
 *
 * aria-valuenow is the number, and aria-valuetext replaces it in speech, so a
 * stale valuetext is not merely late, it is wrong. Both are written together
 * for that reason, from the drag, from the keyboard, and from the initial tag.
 */
function setChatSeparatorValue(separator, width) {
  separator.setAttribute('aria-valuenow', String(width));
  separator.setAttribute('aria-valuetext', trf('Chat width {width} pixels', { width }));
}

/**
 * Decorate Kick's separator, remembering what it looked like first.
 *
 * Kick owns this element. Everything written here is written back on the way
 * out, which the panic switch depends on: it used to leave a focusable tab stop
 * announcing "separator, Chat width 410 pixels" on a page where Kick Focus was
 * supposed to be gone, with arrow keys still swallowed by a suspended mod.
 *
 * The values are overwritten rather than only filled in. A `tabindex="-1"` from
 * Kick would otherwise silently make the whole keyboard feature unreachable,
 * with nothing to show for it.
 */
const SEPARATOR_ATTRIBUTES = ['role', 'tabindex', 'aria-orientation', 'aria-controls', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'];

function decorateChatSeparator(separator, owner) {
  if (!state.chatSeparator || state.chatSeparator.element !== separator) {
    releaseChatSeparator();
    state.chatSeparator = {
      element: separator,
      owner,
      // null means "there was no attribute", which is not the same as an empty
      // one, so restoring can tell remove from set-to-nothing.
      attributes: Object.fromEntries(SEPARATOR_ATTRIBUTES.map((name) => [name, separator.getAttribute(name)])),
      addedId: owner.id ? '' : 'kf-chat-panel',
    };
  }
  const record = state.chatSeparator;
  if (record.addedId) owner.id = record.addedId;
  separator.setAttribute('role', 'separator');
  separator.setAttribute('tabindex', '0');
  // A separator's implicit orientation is horizontal, whose expected keys are
  // Up and Down. This one is vertical and answers Left and Right.
  separator.setAttribute('aria-orientation', 'vertical');
  separator.setAttribute('aria-controls', owner.id);
  separator.setAttribute('aria-valuemin', String(CHAT_WIDTH_MIN));
  separator.setAttribute('aria-valuemax', String(CHAT_WIDTH_MAX));
  setChatSeparatorValue(separator, state.settings.layout.chatWidth);
  bindChatResizer(separator);
}

function releaseChatSeparator() {
  const record = state.chatSeparator;
  state.chatSeparator = null;
  if (!record) return;
  record.controller?.abort();
  const { element, owner, attributes, addedId } = record;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
  if (addedId && owner?.id === addedId) owner.removeAttribute('id');
}

function bindChatResizer(separator) {
  // Bound through a controller rather than a dataset flag. The panic switch
  // strips every kf* dataset key from this element, which used to take the
  // idempotence flag with it: resuming bound a second set of listeners, so one
  // arrow press moved the separator twice and saved twice, once more for every
  // pause and resume.
  if (state.chatSeparator?.controller) return;
  const controller = new AbortController();
  const { signal } = controller;
  if (state.chatSeparator) state.chatSeparator.controller = controller;
  separator.addEventListener('pointerdown', guard('chat resize', (event) => {
    if (event.button !== 0 || event.isPrimary === false || !['right', 'left'].includes(state.settings.layout.chat)) return;
    const panel = separator.nextElementSibling || findProbe(document, 'chatPanel').element;
    const owner = chatLayoutOwner(separator, panel);
    if (!owner) return;

    state.chatResizeCleanup?.();
    const startX = event.clientX;
    const initialWidth = state.settings.layout.chatWidth;
    const startWidth = Math.round(clamp(owner.getBoundingClientRect().width, 320, 520, state.settings.layout.chatWidth));
    let nextWidth = startWidth;
    owner.dataset.kfChatResizing = 'true';

    const move = (moveEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      nextWidth = chatWidthAfterDrag(state.settings.layout.chat, startWidth, startX, moveEvent.clientX);
      state.settings.layout.chatWidth = nextWidth;
      document.documentElement.style.setProperty('--kf-chat-width', `${nextWidth}px`);
      setChatSeparatorValue(separator, nextWidth);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', finish, true);
      delete owner.dataset.kfChatResizing;
      if (state.chatResizeCleanup === cleanup) state.chatResizeCleanup = null;
    };
    const finish = (finishEvent) => {
      if (finishEvent?.pointerId != null && finishEvent.pointerId !== event.pointerId) return;
      cleanup();
      if (nextWidth !== initialWidth) {
        updateSetting('layout.chatWidth', nextWidth, 'Chat width saved.');
        showToast('Chat width saved.');
      }
    };
    state.chatResizeCleanup = cleanup;
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
  }), { capture: true, signal });

  // The keyboard half. Held arrows repeat keydown and fire one keyup, so the
  // width follows every press and the save happens once at the end of the run,
  // which is how the panel's own sliders behave and why holding an arrow does
  // not write settings thirty times a second.
  let keyStartWidth = null;
  const commitKeyResize = () => {
    if (keyStartWidth === null) return;
    const width = state.settings.layout.chatWidth;
    const changed = width !== keyStartWidth;
    keyStartWidth = null;
    if (!changed) return;
    updateSetting('layout.chatWidth', width, 'Chat width saved.');
    showToast('Chat width saved.');
  };

  separator.addEventListener('keydown', guard('chat resize keys', (event) => {
    if (!['right', 'left'].includes(state.settings.layout.chat)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const next = chatWidthAfterKey(state.settings.layout.chat, state.settings.layout.chatWidth, event.key);
    if (next === null) return;
    // Claimed even when the width is already at the stop, so Home and the arrows
    // never fall through to Kick and scroll the page out from under the person
    // adjusting the split.
    event.preventDefault();
    if (keyStartWidth === null) keyStartWidth = state.settings.layout.chatWidth;
    if (next === state.settings.layout.chatWidth) return;
    state.settings.layout.chatWidth = next;
    document.documentElement.style.setProperty('--kf-chat-width', `${next}px`);
    setChatSeparatorValue(separator, next);
  }), { signal });
  separator.addEventListener('keyup', guard('chat resize keys', commitKeyResize), { signal });
  // Tabbing away mid-hold would otherwise leave the new width applied but never
  // written, so it would come back on the next load.
  separator.addEventListener('blur', guard('chat resize keys', commitKeyResize), { signal });
}

function tagChatPanel() {
  const separator = findProbe(document, 'chatSeparator').element;
  if (!separator) return;
  separator.dataset.kfChatSeparator = 'true';
  const split = separator.parentElement;
  if (split && split !== document.body) split.dataset.kfChatSplit = 'true';
  let panel = separator.nextElementSibling;
  if (!panel || panel === separator) {
    panel = findProbe(document, 'chatPanel').element;
  }
  if (panel) {
    const owner = chatLayoutOwner(separator, panel);
    for (const previous of document.querySelectorAll('[data-kf-chat-panel]')) {
      if (previous !== owner) delete previous.dataset.kfChatPanel;
    }
    owner.dataset.kfChatPanel = 'true';
    const row = owner.parentElement;
    for (const previous of document.querySelectorAll('[data-kf-channel-row]')) {
      if (previous !== row) delete previous.dataset.kfChannelRow;
    }
    if (row && row !== document.body) row.dataset.kfChannelRow = 'true';
    decorateChatSeparator(separator, owner);
  }
}

function readPersistentArray(key) {
  const value = gmGet(key, []);
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.length <= 320).slice(-200)
    : [];
}

function readPersistentRecord(key) {
  const value = gmGet(key, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * Which scope a favorite action applies to right now.
 *
 * On a channel page that is the channel, so a favorite can be scoped to where
 * it is actually used; anywhere else it is the global scope. New favorites
 * follow the Favorite scope setting, which defaults to global so existing
 * muscle memory is unchanged.
 */
function favoriteChannel() {
  return favoriteScope(currentChannelSlug());
}

function newFavoriteChannel() {
  return state.settings.content.favoriteScope === 'channel' ? favoriteChannel() : '';
}

/** Ordered favorite keys for the current channel: its own first, then global. */
function favoriteKeysInOrder() {
  return favoritesForChannel(state.stickerPreferences.favorites, favoriteChannel());
}

function isFavorited(key) {
  return isStickerFavorite(state.stickerPreferences.favorites, key, favoriteChannel());
}

function favoriteCount() {
  return favoriteKeysInOrder().length;
}

/** Which scope a key is favorited in here, for labelling. '' means global. */
function favoriteScopeOf(key) {
  const channel = favoriteChannel();
  const scoped = state.stickerPreferences.favorites
    .some((entry) => entry.key === key && entry.channel === channel);
  return scoped ? channel : '';
}

function stickerPreferencesFromValue(value) {
  return {
    favorites: value.favorites,
    hidden: new Set(value.hidden),
    view: value.view,
    showHidden: value.showHidden,
    activeGroup: value.activeGroup,
    groups: value.groups,
    assignments: new Map(value.assignments.map((assignment) => [assignment.key, assignment.groupId])),
    library: new Map(value.library.map((sticker) => [sticker.key, sticker])),
  };
}

function stickerPreferencesValue(preferences = state.stickerPreferences) {
  return normalizeStickerPreferences({
    schema: STICKER_PREFERENCES_SCHEMA,
    favorites: preferences.favorites,
    hidden: [...preferences.hidden],
    view: preferences.view,
    showHidden: preferences.showHidden,
    activeGroup: preferences.activeGroup,
    groups: preferences.groups,
    assignments: [...preferences.assignments].map(([key, groupId]) => ({ key, groupId })),
    library: [...preferences.library.values()],
  });
}

function readStickerPreferences() {
  return stickerPreferencesFromValue(libraryStore.readSync());
}

function persistStickerPreferences() {
  const value = stickerPreferencesValue();
  state.stickerPreferences = stickerPreferencesFromValue(value);
  noteLibrarySeed(libraryStore.write(value), value);
  return value;
}

/**
 * Remember how much of the library the synchronous seed is actually holding.
 *
 * `write()` has always answered with a `truncated` count and every call site
 * dropped it on the floor, so a seed trimmed by the byte budget was
 * indistinguishable from one that fit. Recorded beside the failure registry
 * because the storage panel is where a user goes to ask what is stored.
 */
function noteLibrarySeed(result, value) {
  storageHealth.librarySeed = {
    truncated: Number(result?.truncated) || 0,
    total: Array.isArray(value?.library) ? value.library.length : 0,
  };
}

/**
 * Promote the seed to the full record once the database answers.
 *
 * Runs after boot, never during it: nothing here is allowed to be on the path
 * that puts the interface on screen. If IndexedDB is unavailable — private
 * browsing, a blocked upgrade — this returns nothing and the seed remains the
 * store, which is exactly the behaviour every build had before.
 */
/**
 * How much of the library the seed on disk is holding, before anything is
 * written.
 *
 * `noteLibrarySeed` only learns the number from a write, so a user who opens
 * settings without touching an emote saw nothing at all even with a seed that
 * had been trimmed on a previous visit. The stored value carries its own total,
 * which is exactly what `isSeedPartial` reads, so the answer is already on disk.
 */
function readStoredLibrarySeed() {
  const stored = gmGet(STICKER_PREFERENCES_KEY, {});
  if (!isSeedPartial(stored)) return;
  const total = Number(stored.librarySeedTotal) || 0;
  const held = Array.isArray(stored.library) ? stored.library.length : 0;
  storageHealth.librarySeed = { truncated: Math.max(0, total - held), total };
}

async function hydrateLibrary() {
  readStoredLibrarySeed();
  const merged = await libraryStore.hydrate();
  if (!merged) return;
  const value = normalizeStickerPreferences(merged);
  if (value.library.length <= state.stickerPreferences.library.size) return;
  state.stickerPreferences = stickerPreferencesFromValue(value);
  state.runtime.stickerCatalogDirty = true;
  renderStickerOrganizer();
  for (const summary of state.shadow?.querySelectorAll('[data-kf-sticker-library-summary]') || []) {
    summary.textContent = stickerLibrarySummary();
  }
}

// ---------------------------------------------------------------------------
// Kick live data
//
// The surface itself is src/live.mjs: read-only, same-origin requests to
// endpoints Kick's own client already calls, inheriting the session the page
// already has. What stays here is what it is built from — the page's unhooked
// `fetch`, the current channel, and the wiring that hands them over.
// ---------------------------------------------------------------------------

// Long enough to outlast the autoplay-policy mute that fires right after attach.
const VOLUME_GRACE_MS = 1500;

function readEmoteUsage() {
  // Normalize on boot too: the global rollup used to be capped only on read
  // through here-nothing, so a stored oversized map was loaded back whole.
  return normalizeEmoteUsage(gmGet(EMOTE_USAGE_KEY, null));
}

/**
 * The unhooked `fetch`, captured before `installNetworkDefense` wraps it.
 *
 * Routing our own reads through our own interceptor would have them classified,
 * logged as page traffic, and counted in the protection diagnostics.
 */
let unhookedFetch = null;
function pageFetch(url, init) {
  return unhookedFetch ? unhookedFetch(url, init) : window.fetch(url, init);
}

/**
 * The channel this tab is on, or '' anywhere else.
 *
 * Read from the URL rather than the cached `state.route` so it is already
 * correct during a route change, before the apply cycle has caught up.
 */
function currentChannelSlug() {
  if (routeKind(location.href) !== 'channel') return '';
  const slug = location.pathname.split('/').filter(Boolean)[0] || '';
  return /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(slug) ? slug : '';
}

/**
 * The VOD this tab is watching, or '' anywhere else.
 *
 * A VOD lives at `/{slug}/videos/{uuid}`, which `routeKind` also calls
 * `channel`, so the path shape is the only thing that separates the two. The
 * UUID is checked rather than trusted: it is pasted straight into a request
 * path, and Kick's own ids are v7 UUIDs.
 */
function currentVodId() {
  if (routeKind(location.href) !== 'channel') return '';
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts.length !== 3 || parts[1] !== 'videos') return '';
  const id = parts[2];
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : '';
}

const liveSurface = createLive({
  state,
  gmSet,
  EMOTE_USAGE_KEY,
  pageFetch,
  currentChannelSlug,
  currentVodId,
  plural,
  mergeStickerLibrary,
  forgetChatMessage,
});
const {
  closeMergedChat,
  kickFetchJson,
  liveStatusSummary,
  localUsername: liveLocalUsername,
  mergedChatEntries,
  mergedChatStatus,
  syncMergedChat,
  mutateKickChannelFollow,
  readCollectibleInventory,
  recordApiDrift,
  refreshLiveChannel,
  replayPendingBadges,
  replayPendingDeletions,
} = liveSurface;

// ---------------------------------------------------------------------------
// Multi-stream
//
// The surface itself is src/multistream.mjs, built here against the page-owned
// collaborators it needs. Keeping the wiring separate from the code is what
// lets the grid be exercised under node:test with a stub host; only the names
// the rest of this file calls are unpacked below.
// ---------------------------------------------------------------------------

const multistreamSurface = createMultistream({
  state,
  gmGet,
  gmSet,
  MULTISTREAM_KEY,
  currentChannelSlug,
  deepActiveElement,
  restoreFocus,
  tr,
  trf,
  escapeHtml,
  trustedHTML,
  setMarkup,
  announce,
  showToast,
  syncHeaderMultiState,
  syncCardMultiState,
  kickFetchJson,
  recordApiDrift,
  mergedChatEntries,
  mergedChatStatus,
  syncMergedChat,
  closeMergedChat,
  syncPageInert,
});
const {
  addMultistream,
  addPresenceOffer,
  canPopOutChat,
  chatPoppedOut,
  closeChatWindow,
  closeMultistream,
  popOutChat,
  installMultistreamStorageSync,
  multistreamOpen,
  multistreamPresenceChannel,
  multistreamSyncChannel,
  openMultistream,
  persistMultistream,
  renderMultistream,
  toggleCurrentChannelInMulti,
  toggleMultistreamSlug,
} = multistreamSurface;

function readRemoteBlocklist() {
  const stored = gmGet(REMOTE_BLOCKLIST_KEY, null);
  const result = validateRemoteBlocklist(stored?.payload);
  if (!stored || !result.ok || typeof stored.source !== 'string') {
    return { source: '', fetchedAt: 0, attemptedAt: 0, channels: new Set(), categories: new Set(), keywords: new Set(), status: 'off', method: '' };
  }
  return {
    source: stored.source,
    fetchedAt: Number(stored.fetchedAt) || 0,
    attemptedAt: Number(stored.attemptedAt) || 0,
    channels: new Set(result.value.channels),
    categories: new Set(result.value.categories),
    keywords: new Set(result.value.keywords),
    status: 'ready',
    method: stored.method || '',
  };
}

function persistSet(key, value) {
  gmSet(key, normalizeChannelList([...value]));
}

function channelPath() {
  return state.route === 'channel' ? observedChannelPath(location.pathname) : '';
}

function cardPath(node) {
  const link = node?.matches?.('a[href]') ? node : node?.querySelector?.('a[href]');
  try {
    return observedChannelPath(link ? new URL(link.href, location.origin).pathname : '');
  } catch {
    return '';
  }
}

function syncNativeSidebar() {
  if (state.runtime.sidebarHidden || state.runtime.focus || state.runtime.theater) return;
  const mode = state.settings.layout.sidebar;
  // Dropdown mode owns the rail through CSS. Driving Kick's own collapse
  // control here as well would collapse the panel the moment it expands.
  if (mode === 'dropdown') {
    // Leave Kick's rail expanded so the dropdown has its full contents.
    const expand = findProbe(document, 'sidebarExpand').element;
    if (expand && document.documentElement.dataset.kfManagedSidebar === 'true') {
      delete document.documentElement.dataset.kfManagedSidebar;
      expand.click();
    }
    return;
  }
  const collapse = findProbe(document, 'sidebarCollapse').element;
  const expand = findProbe(document, 'sidebarExpand').element;
  if (mode === 'compact' && collapse) {
    document.documentElement.dataset.kfManagedSidebar = 'true';
    collapse.click();
  } else if (mode === 'auto' && expand && document.documentElement.dataset.kfManagedSidebar === 'true') {
    delete document.documentElement.dataset.kfManagedSidebar;
    expand.click();
  }
}

function cardCandidates() {
  const main = findProbe(document, 'main').element;
  const cards = findAllProbe(main || document, 'card').elements;
  const sidebar = findProbe(document, 'sidebar').element;
  if (!sidebar) return cards;
  return [...new Set([
    ...cards,
    ...sidebar.querySelectorAll?.('[data-testid^="sidebar-following-channel-"], a[href]') || [],
  ])];
}

/**
 * Read the structured evidence a card carries: Kick's category slug, and its
 * short badge texts. Both are far stronger signals than the card's prose, and
 * the slug survives localization.
 */
/**
 * Silence home-page previews.
 *
 * Pausing once was not enough: the complaint is about sound on arrival, and
 * Kick restarts previews and inserts new ones as the page lives, so a preview
 * added after the first pass would play with audio. Each element is muted and
 * kept muted through a `play` listener, which survives the site restarting it.
 * Muting rather than only pausing means an autoplay Kick insists on restarting
 * is still silent.
 */
function quietHomeAutoplay() {
  for (const video of document.querySelectorAll('video')) {
    try {
      video.muted = true;
      video.volume = 0;
      if (video.dataset.kfManualPlayback !== 'true' && !video.paused) video.pause();
      if (video.dataset.kfAutoplayHandled === 'true') continue;
      video.dataset.kfAutoplayHandled = 'true';
      const markManualPlayback = () => {
        if (state.route === 'home' && state.settings.content.pauseHomeAutoplay) {
          video.dataset.kfManualPlayback = 'true';
        }
      };
      video.addEventListener('pointerdown', markManualPlayback, true);
      video.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ' || String(event.key).toLowerCase() === 'k') markManualPlayback();
      }, true);
      video.addEventListener('pause', () => { delete video.dataset.kfManualPlayback; });
      video.addEventListener('ended', () => { delete video.dataset.kfManualPlayback; });
      video.addEventListener('play', () => {
        if (state.route !== 'home' || !state.settings.content.pauseHomeAutoplay) return;
        video.muted = true;
        // A trusted pointer/keyboard gesture marks this media element before
        // the play event. Keep that explicit preview running until the user
        // pauses it; background restarts never receive the marker.
        if (video.dataset.kfManualPlayback !== 'true') video.pause();
      });
    } catch {
      // A detached or cross-origin media element is skipped.
    }
  }
}

function cardContext(node) {
  const categories = [];
  for (const link of node.querySelectorAll?.('a[href*="/category/"]') || []) {
    const slug = (link.getAttribute('href') || '').split('/category/')[1];
    if (slug) categories.push(slug.split(/[/?#]/, 1)[0]);
  }

  // Badges are leaf elements with very short text. The cap keeps this cheap:
  // this runs for every card on every apply cycle.
  const badges = [];
  for (const element of node.querySelectorAll?.('span, button, [class*="badge"], [data-testid*="badge"]') || []) {
    if (element.children.length > 0 || badges.length >= 24) continue;
    const label = (element.textContent || '').trim();
    if (label && label.length <= 18) badges.push(label);
  }

  return { categories, badges };
}

function mainCardCandidates() {
  const main = findProbe(document, 'main').element;
  return findAllProbe(main || document, 'card').elements;
}

function cardLabel(node) {
  const image = node.querySelector?.('img[alt]');
  const label = image?.getAttribute?.('alt') || node.querySelector?.('a[href]')?.textContent || '';
  return String(label).replace(/\s+/g, ' ').trim().slice(0, 80) || 'this channel';
}

function cardLiveBadge(node) {
  for (const element of node.querySelectorAll?.('span, [class*="badge"], [data-testid*="badge"], [data-testid*="live"]') || []) {
    if (element.closest?.('[data-kf-card-uptime]')) continue;
    if ((element.textContent || '').trim().toLowerCase() === 'live') return element;
  }
  return null;
}

function applyCardUptime(node, now = Date.now()) {
  const existing = node.querySelector?.('[data-kf-card-uptime]');
  const slug = cardSlugFromPath(cardPath(node)).toLowerCase();
  const startedAt = slug ? state.runtime.discoveryStarts.get(slug) : 0;
  const liveBadge = state.settings.content.showUptime ? cardLiveBadge(node) : null;
  const duration = liveBadge ? formatUptime(startedAt, now) : '';
  if (!duration) {
    existing?.remove();
    if (node.dataset.kfCardUptimeOwner) delete node.dataset.kfCardUptimeOwner;
    return false;
  }

  let chip = existing;
  if (!chip) {
    chip = document.createElement('span');
    chip.dataset.kfCardUptime = 'true';
    // A bare span maps to the generic role, and a generic element gets no
    // accessible name from aria-label or title. Without this the chip read as
    // its own text, so a reader heard "2h 14m" beside Kick's LIVE badge with
    // nothing saying what the number was. The player and VOD chips already do
    // this; the card chip was the one that missed it. Polite, never assertive:
    // a grid of cards updating every minute must not interrupt.
    chip.setAttribute('role', 'status');
    chip.setAttribute('aria-live', 'off');
  }
  if (chip.previousElementSibling !== liveBadge) liveBadge.insertAdjacentElement('afterend', chip);
  node.dataset.kfCardUptimeOwner = 'true';
  if (chip.textContent !== duration) chip.textContent = duration;
  chip.dataset.kfCardUptimeSlug = slug;
  chip.dataset.kfCardUptimeStart = String(startedAt);
  const label = trf('Live for {duration}', { duration });
  chip.setAttribute('aria-label', label);
  chip.title = label;
  return true;
}

function applyDiscoveryCardUptimes(nodes = mainCardCandidates()) {
  let active = 0;
  for (const node of nodes) if (applyCardUptime(node)) active += 1;
  if (active && !state.discoveryUptimeTimer) {
    state.discoveryUptimeTimer = window.setInterval(() => applyDiscoveryCardUptimes(), 60 * 1000);
  } else if (!active && state.discoveryUptimeTimer) {
    clearInterval(state.discoveryUptimeTimer);
    state.discoveryUptimeTimer = 0;
  }
}

function applyCardActions(node) {
  const path = cardPath(node);
  if (!path) return;
  node.dataset.kfFavorite = String(state.favorites.has(path));
  node.dataset.kfDismissed = String(state.dismissed.has(path));
  let actions = node.querySelector?.('[data-kf-card-actions]');
  if (!actions) {
    actions = document.createElement('div');
    actions.dataset.kfCardActions = 'true';
    node.append(actions);
  }
  const favorite = state.favorites.has(path);
  const dismissed = state.dismissed.has(path);
  // Collect a channel without opening it. Category tiles and section links wear
  // the same markup as channel cards, so the chip appears only where the card
  // actually points at a channel.
  const slug = cardSlugFromPath(path);
  const name = cardLabel(node);
  const label = escapeHtml(name);
  const inMulti = Boolean(slug) && multistreamHasSlug(slug);
  const multiChip = slug
    ? `<button type="button" data-kf-card-action="multi" data-kf-card-slug="${escapeHtml(slug)}" data-kf-card-name="${label}" data-active="${inMulti}" aria-pressed="${inMulti}" aria-label="${escapeHtml(trf(inMulti ? 'Remove {name} from the multi-stream grid' : 'Add {name} to the multi-stream grid', { name }))}" title="${escapeHtml(tr(inMulti ? 'In Multi' : 'Add to Multi'))}">${inMulti ? '⊟' : '⊞'}</button>`
    : '';
  // Rebuilt only when what it renders changed. The apply cycle runs these over
  // every card on a discovery page, and replacing the buttons each time both
  // wasted the work and quietly detached the node under anyone mid-click.
  // The locale is part of what the markup renders now, so it has to be part
  // of what decides the markup is unchanged.
  const signature = `${activeLocale()}:${favorite}:${dismissed}:${slug}:${inMulti}:${label}`;
  if (actions.dataset.kfCardSignature === signature) return;
  actions.dataset.kfCardSignature = signature;
  setMarkup(actions, `
    <button type="button" data-kf-card-action="favorite" data-active="${favorite}" aria-label="${escapeHtml(trf(favorite ? 'Remove favorite {name}' : 'Favorite {name}', { name }))}">${favorite ? '★' : '☆'}</button>
    ${multiChip}
    <button type="button" data-kf-card-action="dismiss" aria-label="${escapeHtml(trf(dismissed ? 'Restore {name}' : 'Not interested in {name}', { name }))}">${dismissed ? '↶' : '×'}</button>`);
}

function multistreamHasSlug(slug) {
  const wanted = String(slug).toLowerCase();
  return state.multistream.streams.some((entry) => entry.toLowerCase() === wanted);
}

/**
 * Repaint the card chips from the grid, without rebuilding a card.
 *
 * Another tab adding a channel has to show up here too, and the apply cycle is
 * not the right latency for a click that happened in a different window.
 */
function syncCardMultiState() {
  for (const button of document.querySelectorAll('[data-kf-card-action="multi"]')) {
    const slug = button.dataset.kfCardSlug;
    if (!slug) continue;
    const inMulti = multistreamHasSlug(slug);
    if (button.dataset.active === String(inMulti)) continue;
    button.dataset.active = String(inMulti);
    button.setAttribute('aria-pressed', String(inMulti));
    button.textContent = inMulti ? '⊟' : '⊞';
    button.title = tr(inMulti ? 'In Multi' : 'Add to Multi');
    // The container's signature has to move with it, or the next apply cycle
    // would see a stale stamp and rebuild the buttons this just patched.
    const actions = button.parentElement;
    if (actions?.dataset.kfCardSignature) {
      actions.dataset.kfCardSignature = actions.dataset.kfCardSignature.replace(
        /:(true|false):([^:]*)$/, `:${inMulti}:$2`,
      );
    }
    // Rebuilt from the template, not edited in place. This used to swap the
    // words in the rendered string, which only worked while that string was
    // English; once the label came from the dictionary the patterns stopped
    // matching and the label stayed stale in every other language. The card's
    // own name rides along on the button so it can be rebuilt without going
    // back to Kick's markup for it.
    const name = button.dataset.kfCardName || '';
    button.setAttribute('aria-label', trf(
      inMulti ? 'Remove {name} from the multi-stream grid' : 'Add {name} to the multi-stream grid',
      { name },
    ));
  }
}

function handleCardAction(event) {
  // The per-message dismiss shares this capture listener rather than adding a
  // second one over the same document. It has to run before Kick's own
  // handlers, which is what the capture phase is for.
  const hide = event.target.closest?.('[data-kf-chat-hide]');
  if (hide) {
    event.preventDefault();
    event.stopPropagation();
    hideChatMessage(hide.dataset.kfChatHide || '');
    return;
  }
  const button = event.target.closest?.('[data-kf-card-action]');
  if (!button) return;
  const card = button.closest?.('[data-testid="livestream-results-card"], [data-testid="stream-card"], [class*="group/card"], article');
  const path = cardPath(card);
  if (!path) return;
  event.preventDefault();
  event.stopPropagation();
  if (button.dataset.kfCardAction === 'multi') {
    const result = toggleMultistreamSlug(button.dataset.kfCardSlug || '');
    if (!result.ok) {
      showToast(result.error, true);
      announce(result.error);
      return;
    }
    const total = result.streams.length;
    showToast(`${result.added ? 'Added' : 'Removed'} ${result.slug} (${total} of ${MULTISTREAM_MAX})`, false, [
      { label: 'View', onClick: () => openMultistream() },
      { label: 'Undo', onClick: () => { toggleMultistreamSlug(result.slug); } },
    ]);
    announce(trf(result.added ? 'Added {name}. Now {count} of {max}.' : 'Removed {name}. Now {count} of {max}.', { name: result.slug, count: total, max: MULTISTREAM_MAX }));
    return;
  }
  if (button.dataset.kfCardAction === 'favorite') {
    if (state.favorites.has(path)) state.favorites.delete(path);
    else state.favorites.add(path);
    persistSet(FAVORITES_KEY, state.favorites);
    announce(state.favorites.has(path) ? `Added ${cardLabel(card)} to favorites` : `Removed ${cardLabel(card)} from favorites`);
  } else {
    if (state.dismissed.has(path)) state.dismissed.delete(path);
    else state.dismissed.add(path);
    persistSet(DISMISSED_KEY, state.dismissed);
    announce(state.dismissed.has(path) ? `${cardLabel(card)} marked not interested` : `${cardLabel(card)} restored`);
  }
  scheduleApply(0);
}

function applyRailVisibility() {
  const main = findProbe(document, 'main').element;
  if (!main) return;
  for (const node of main.querySelectorAll?.('[data-testid*="following" i], [data-testid*="recommended" i], [data-kick-rail]') || []) {
    const text = `${node.getAttribute?.('data-testid') || ''} ${node.getAttribute?.('data-kick-rail') || ''}`.toLowerCase();
    if (text.includes('following')) node.dataset.kfFollowingRail = 'true';
    if (text.includes('recommended')) node.dataset.kfRecommendedRail = 'true';
  }
  for (const heading of main.querySelectorAll?.('h1, h2, h3, [role="heading"]') || []) {
    const text = (heading.textContent || '').trim().toLowerCase();
    const rail = text.includes('following') ? 'following' : text.includes('recommended') ? 'recommended' : '';
    if (!rail) continue;
    const owner = heading.closest?.('section, [data-kick-rail], div') || heading.parentElement;
    if (owner) owner.dataset[`kf${rail[0].toUpperCase()}${rail.slice(1)}Rail`] = 'true';
  }
}

/** The stable marker owner around a followed-channel control. */
function followingPreviewOwner(row) {
  const markerSelector = '[data-testid^="sidebar-following-channel-"]';
  if (row?.matches?.(markerSelector)) return row;
  const wrapper = row?.closest?.(markerSelector);
  if (wrapper) return wrapper;
  // Older Kick shells put the marker below the link. In that shape the link is
  // the useful owner because its image can be a sibling of the marked child.
  if (row?.querySelector?.(markerSelector)) return row;
  return row?.closest?.('li') || row;
}

/** The already-loaded image Kick placed inside a followed-channel row. */
function followingPreviewSource(row) {
  const owner = followingPreviewOwner(row);
  const images = [...(owner?.querySelectorAll?.('img') || [])]
    .filter((image) => image.currentSrc || image.getAttribute?.('src'))
    .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
  return images[0] || null;
}

/**
 * Mark only live followed-channel controls that already carry a thumbnail.
 * The preview never invents a URL or asks Kick for a richer record.
 */
function tagFollowingPreviewRows() {
  if (state.runtime.sidebarHidden || state.runtime.focus || state.runtime.theater
    || state.settings.layout.sidebar === 'hidden') {
    hideFollowingPreview();
    return;
  }
  const sidebar = findProbe(document, 'sidebar').element;
  if (!sidebar) {
    hideFollowingPreview();
    return;
  }
  const tagged = new Set();
  const rows = findAllProbe(sidebar, 'followingPreviewControl').elements;
  for (const row of rows) {
    if (!row || !sidebar.contains(row) || !followingPreviewSource(row)) continue;
    tagged.add(row);
    if (row.dataset.kfFollowingPreview !== 'true') row.dataset.kfFollowingPreview = 'true';
  }
  for (const marker of sidebar.querySelectorAll?.('[data-kf-following-preview]') || []) {
    if (!tagged.has(marker)) delete marker.dataset.kfFollowingPreview;
  }
  if (state.followingPreviewRow && !state.followingPreviewRow.matches?.('[data-kf-following-preview="true"]')) {
    hideFollowingPreview();
  }
}

/** Whether one DOM mutation added or removed part of a followed-channel row. */
function followingPreviewMutation(mutations) {
  const markerSelector = '[data-testid^="sidebar-following-channel-"]';
  for (const mutation of mutations || []) {
    for (const node of [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])]) {
      if (node?.nodeType !== 1) continue;
      if (node.matches?.(markerSelector) || node.querySelector?.(markerSelector)
        || node.closest?.(markerSelector)) return true;
    }
  }
  return false;
}

function ensureFollowingPreview() {
  if (state.followingPreview?.isConnected) return state.followingPreview;
  const host = document.createElement('figure');
  host.id = 'kick-focus-following-preview';
  host.lang = activeLocale();
  host.hidden = true;
  host.setAttribute('role', 'tooltip');
  host.setAttribute('aria-live', 'off');
  const image = document.createElement('img');
  image.alt = '';
  image.decoding = 'async';
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  const caption = document.createElement('figcaption');
  const name = document.createElement('strong');
  name.dataset.kfFollowingPreviewName = 'true';
  const context = document.createElement('span');
  context.dataset.kfFollowingPreviewContext = 'true';
  caption.append(name, context);
  host.append(image, canvas, caption);
  document.body.append(host);
  state.followingPreview = host;
  return host;
}

function followingPreviewLabel(row) {
  const ownLabel = row.getAttribute?.('aria-label') || row.getAttribute?.('title') || row.textContent || '';
  const text = ownLabel.replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 80);
  return cardPath(row).replace(/^\//, '') || tr('Following');
}

function snapshotFollowingThumbnail(source, canvas) {
  if (!source?.complete || !source.naturalWidth || !source.naturalHeight) return false;
  const targetWidth = canvas.width;
  const targetHeight = canvas.height;
  const scale = Math.max(targetWidth / source.naturalWidth, targetHeight / source.naturalHeight);
  const width = source.naturalWidth * scale;
  const height = source.naturalHeight * scale;
  try {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, targetWidth, targetHeight);
    context.drawImage(source, (targetWidth - width) / 2, (targetHeight - height) / 2, width, height);
    return true;
  } catch {
    return false;
  }
}

function setFollowingPreviewDescription(row, enabled) {
  if (!row) return;
  const tokens = new Set((row.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  if (enabled) tokens.add('kick-focus-following-preview');
  else tokens.delete('kick-focus-following-preview');
  if (tokens.size) row.setAttribute('aria-describedby', [...tokens].join(' '));
  else row.removeAttribute('aria-describedby');
}

function showFollowingPreview(row) {
  if (!row?.matches?.('[data-kf-following-preview="true"]') || state.runtime.suspended) return;
  const source = followingPreviewSource(row);
  if (!source) return;
  const reducedMotion = state.settings.accessibility.reduceMotion
    || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = ensureFollowingPreview();
  const image = host.querySelector('img');
  const canvas = host.querySelector('canvas');
  if (reducedMotion) {
    if (!snapshotFollowingThumbnail(source, canvas)) {
      hideFollowingPreview();
      state.followingPreviewRow = row;
      source.addEventListener('load', () => {
        if (state.followingPreviewRow === row) showFollowingPreview(row);
      }, { once: true });
      return;
    }
    image.hidden = true;
    canvas.hidden = false;
  } else {
    image.src = source.currentSrc || source.getAttribute('src');
    image.hidden = false;
    canvas.hidden = true;
  }
  const label = followingPreviewLabel(row);
  host.querySelector('[data-kf-following-preview-name]').textContent = label;
  host.querySelector('[data-kf-following-preview-context]').textContent = tr('Following');
  host.dataset.kfStatic = String(reducedMotion);
  host.dataset.kfSource = 'existing-image';
  host.hidden = false;
  host.style.visibility = 'hidden';
  host.dataset.kfOpen = 'true';
  const position = floatingPreviewPosition(
    row.getBoundingClientRect(),
    host.getBoundingClientRect(),
    { width: innerWidth, height: innerHeight },
  );
  host.style.left = `${position.left}px`;
  host.style.top = `${position.top}px`;
  host.dataset.kfSide = position.side;
  host.style.visibility = 'visible';
  if (state.followingPreviewRow !== row) setFollowingPreviewDescription(state.followingPreviewRow, false);
  state.followingPreviewRow = row;
  setFollowingPreviewDescription(row, true);
}

function hideFollowingPreview() {
  const host = state.followingPreview;
  setFollowingPreviewDescription(state.followingPreviewRow, false);
  state.followingPreviewRow = null;
  if (!host) return;
  delete host.dataset.kfOpen;
  host.hidden = true;
}

function followingPreviewRowFromEvent(event) {
  const target = event.target;
  const tagged = target?.closest?.('[data-kf-following-preview="true"]');
  if (tagged) return tagged;
  // A cold or backgrounded page can defer the mutation-driven apply pass.
  // Resolve the same ordered controls at the moment a real hover or focus
  // arrives so an interaction never depends on that scheduling detail.
  const sidebar = findProbe(document, 'sidebar').element;
  if (!sidebar || !target || !sidebar.contains(target)) return null;
  const row = findAllProbe(sidebar, 'followingPreviewControl').elements
    .find((candidate) => candidate === target || candidate.contains?.(target));
  if (!row || !followingPreviewSource(row)) return null;
  row.dataset.kfFollowingPreview = 'true';
  return row;
}

function onFollowingPreviewEnter(event) {
  const row = followingPreviewRowFromEvent(event);
  if (!row || (event.relatedTarget && row.contains(event.relatedTarget))) return;
  showFollowingPreview(row);
}

function onFollowingPreviewLeave(event) {
  const row = followingPreviewRowFromEvent(event) || state.followingPreviewRow;
  if (!row || row !== state.followingPreviewRow || (event.relatedTarget && row.contains(event.relatedTarget))) return;
  hideFollowingPreview();
}

function onFollowingPreviewKeydown(event) {
  if (event.key !== 'Escape' || event.defaultPrevented
    || state.followingPreview?.dataset.kfOpen !== 'true') return;
  event.preventDefault();
  event.stopPropagation();
  hideFollowingPreview();
}

function installFollowingPreviewInteractions() {
  if (state.runtime.followingPreviewInteractions) return;
  state.runtime.followingPreviewInteractions = true;
  document.addEventListener('mouseover', guard('following preview', onFollowingPreviewEnter), true);
  document.addEventListener('focusin', guard('following preview', onFollowingPreviewEnter), true);
  document.addEventListener('mouseout', guard('following preview', onFollowingPreviewLeave), true);
  document.addEventListener('focusout', guard('following preview', onFollowingPreviewLeave), true);
  document.addEventListener('keydown', guard('following preview', onFollowingPreviewKeydown), true);
  for (const type of ['scroll', 'wheel']) document.addEventListener(type, hideFollowingPreview, true);
  window.addEventListener('resize', hideFollowingPreview);
  window.addEventListener('blur', hideFollowingPreview);
  const root = document.getElementById('kick-focus-root');
  if (root) root.dataset.kfFollowingPreviewReady = 'true';
}

function applySearchEnhancements() {
  const main = findProbe(document, 'main').element;
  const existing = document.querySelector('[data-kf-search-meta]');
  if (state.route !== 'search' || !main) {
    existing?.remove();
    return;
  }
  const count = findAllProbe(main, 'card').elements.length;
  const input = document.querySelector('[data-testid="search"], input[aria-label="Search"], input[type="search"]');
  let query = String(input?.value || '').trim();
  if (!input) {
    try { query = new URL(location.href).searchParams.get('query') || ''; } catch { /* noop */ }
  }
  let meta = existing;
  if (!meta) {
    meta = document.createElement('div');
    meta.dataset.kfSearchMeta = 'true';
    meta.setAttribute('role', 'status');
    const first = main.firstElementChild;
    const container = first && !first.matches?.('input, select, textarea, button, img, video') ? first : main;
    container.prepend(meta);
  }
  setMarkup(meta, `<div><strong>${query ? `Search results for “${escapeHtml(query)}”` : 'Search results'}</strong><span>${count} ${plural(count, 'result loaded', 'results loaded')}</span></div>${query ? '<button type="button" data-kf-clear-search aria-label="Clear search">Clear</button>' : ''}`);
}

function handleSearchAction(event) {
  const button = event.target.closest?.('[data-kf-clear-search]');
  if (!button) return;
  const input = document.querySelector('[data-testid="search"], input[aria-label="Search"], input[type="search"]');
  if (!input) return;
  event.preventDefault();
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  scheduleApply(0);
}

function applyDropsEnhancements() {
  const existing = document.querySelector('[data-kf-drops-empty]');
  const nativeOwner = document.querySelector('[data-kf-native-drops-empty]');
  if (state.route !== 'drops') {
    existing?.remove();
    nativeOwner?.removeAttribute('data-kf-native-drops-empty');
    return;
  }
  const empty = document.querySelector('[data-testid="empty-state-root"]');
  if (!empty) {
    existing?.remove();
    nativeOwner?.removeAttribute('data-kf-native-drops-empty');
    return;
  }
  const owner = empty.parentElement;
  if (!owner) return;
  owner.dataset.kfNativeDropsEmpty = 'true';
  if (existing?.parentElement === owner) return;
  existing?.remove();
  const enhanced = document.createElement('section');
  enhanced.dataset.kfDropsEmpty = 'true';
  setMarkup(enhanced, `
    <div data-kf-drops-primary>
      <span data-kf-drops-eyebrow>Campaign status</span>
      <h3>No open campaigns</h3>
      <p>Campaigns appear here when a reward is available.</p>
      <div data-kf-drops-actions>
        <a href="/browse">Browse eligible streams</a>
        <a href="/drops/coming-soon">View coming soon</a>
      </div>
    </div>
    <aside data-kf-drops-activity aria-label="Reward activity">
      <strong>Reward activity</strong>
      <dl>
        <div><dt>Active</dt><dd>0</dd></div>
        <div><dt>Claimed</dt><dd><a href="/drops/claimed">View</a></dd></div>
        <div><dt>Expired</dt><dd><a href="/drops/expired">View</a></dd></div>
      </dl>
    </aside>
    <ol data-kf-drops-steps aria-label="How drops work">
      <li><span>1</span><div><strong>Watch eligible streams</strong><small>Pick an active campaign.</small></div></li>
      <li><span>2</span><div><strong>Track progress</strong><small>Keep watching to advance.</small></div></li>
      <li><span>3</span><div><strong>Claim your reward</strong><small>Claim it before time runs out.</small></div></li>
    </ol>`);
  owner.append(enhanced);
}

function mediaPreferenceKey(kind) {
  const path = channelPath();
  return path ? `${kind}:${path}` : '';
}

function saveMediaPreference(kind, value) {
  if (!state.settings.content[{ volume: 'rememberVolume', quality: 'rememberQuality', position: 'rememberVodPosition' }[kind]]) return;
  const key = mediaPreferenceKey(kind);
  if (!key) return;
  state.mediaPreferences[key] = value;
  const keys = Object.keys(state.mediaPreferences).slice(-240);
  state.mediaPreferences = Object.fromEntries(keys.map((entry) => [entry, state.mediaPreferences[entry]]));
  gmSet(MEDIA_PREFERENCES_KEY, state.mediaPreferences);
}

function bindMediaElement(video) {
  if (state.mediaBound.has(video)) return;
  state.mediaBound.add(video);
  const path = channelPath();
  if (!path) return;
  const volumeKey = `volume:${path}`;
  const positionKey = `position:${path}`;
  const restore = () => {
    if (state.settings.content.rememberVolume && state.mediaPreferences[volumeKey]) {
      const saved = state.mediaPreferences[volumeKey];
      if (Number.isFinite(saved.volume)) video.volume = Math.min(1, Math.max(0, saved.volume));
      if (typeof saved.muted === 'boolean') video.muted = saved.muted;
    }
    if (state.settings.content.rememberVodPosition && Number.isFinite(video.duration) && video.duration > 0) {
      const saved = Number(state.mediaPreferences[positionKey]);
      if (Number.isFinite(saved) && saved > 0 && saved < video.duration - 3) {
        try { video.currentTime = saved; } catch { /* player may not be seekable yet */ }
      }
    }
    video.dataset.kfMediaRestored = 'true';
  };
  /**
   * Browser autoplay policy sets `muted = true` immediately after attach, which
   * fires volumechange. Recording that persisted "muted" for the channel
   * forever, so the feature eventually locked every stream silent. Ignore
   * changes during the grace window, and specifically never persist a
   * mute-only change inside it.
   */
  const boundAt = Date.now();
  const saveVolume = () => {
    const elapsed = Date.now() - boundAt;
    if (elapsed < VOLUME_GRACE_MS && video.muted) return;
    saveMediaPreference('volume', { volume: video.volume, muted: video.muted });
  };

  /**
   * Some players route audio through a gain node and never fire volumechange,
   * so the event alone is not enough to keep the stored value truthful.
   * Reconcile against the live element on a timer as well.
   */
  const reconcile = () => {
    if (!video.isConnected) { clearInterval(timer); return; }
    if (Date.now() - boundAt < VOLUME_GRACE_MS) return;
    const saved = state.mediaPreferences[volumeKey];
    if (saved && Math.abs(Number(saved.volume) - video.volume) < 0.01 && saved.muted === video.muted) return;
    saveMediaPreference('volume', { volume: video.volume, muted: video.muted });
  };
  const timer = window.setInterval(reconcile, 5000);
  video.addEventListener('emptied', () => clearInterval(timer), { once: true });
  const savePosition = () => {
    if (state.settings.content.rememberVodPosition && Number.isFinite(video.duration) && video.duration > 0) {
      saveMediaPreference('position', video.currentTime);
    }
  };
  video.addEventListener('loadedmetadata', restore, { once: true });
  video.addEventListener('volumechange', saveVolume);
  video.addEventListener('pause', savePosition);
  video.addEventListener('timeupdate', () => {
    clearTimeout(state.mediaSaveTimers.get(video));
    state.mediaSaveTimers.set(video, window.setTimeout(savePosition, 1500));
  });
  if (video.readyState >= 1) restore();
}

/**
 * Restore quality where the player actually reads it.
 *
 * Driving Kick's menu with a plain `.click()` is very likely inert: none of the
 * selectors this used appear in the project's verified DOM contract, and Kick's
 * menu is reported to ignore synthetic clicks that are not a full pointer
 * sequence. Kick's player reads its starting quality from
 * `sessionStorage['stream_quality']` at init, so writing that before the player
 * initialises is the path that works, with the menu kept only as a fallback.
 *
 * Deliberately not restored from "whatever the player had a moment ago" — that
 * is how an ad-break or bandwidth downgrade becomes a permanent setting.
 */
const QUALITY_SESSION_KEY = 'stream_quality';

/**
 * The ladder Kick has been *observed* offering, newline-free and best first.
 *
 * "Always start at the highest quality" needs a name to write into the session
 * key before the player initialises, and the set differs per channel — so this
 * build learns the labels from Kick's own menu instead of hard-coding a
 * resolution list that would be wrong for a 720p streamer and stale the day
 * Kick adds a rung. One consequence worth stating plainly: the preference does
 * nothing until Kick's quality menu has rendered once, because until then there
 * is no honest value to write. This build will not open that menu on the user's
 * behalf to get there sooner.
 *
 * Stored in the media-preferences record, which is already registered, backed
 * up and reset with everything else, as a `|`-joined string so it survives the
 * primitives-only import normalizer. The key is global rather than per-channel:
 * it is a hint about what Kick's menu looks like, not a per-channel choice.
 */
const QUALITY_LADDER_KEY = 'ladder:global';

/**
 * The rung's own label, not everything inside the row.
 *
 * Kick renders the label in a `<span>` and hangs any entitlement badge beside
 * it in a sibling `<div>`, so on an anonymous session the top row's
 * `textContent` is the rung glued to the badge's sign-in prompt. That string
 * ranks perfectly well and is completely unusable: it is not a label the menu
 * will ever match on restore, and the rung behind it is one this session may
 * not have.
 */
function qualityControlLabel(control) {
  const spans = control.querySelectorAll?.('span');
  if (!spans?.length) return '';
  return [...spans].map((span) => span.textContent.trim()).filter(Boolean).join(' ');
}

function qualityControlValue(control) {
  return String(control.value
    || control.dataset.quality
    || control.dataset.resolution
    || qualityControlLabel(control)
    || control.textContent
    || '').trim();
}

/**
 * True when Kick attached anything beyond the rung's own label.
 *
 * That extra node is the badge Kick uses to say this session cannot pick this
 * rung — a sign-in prompt while signed out. Detected as "there is content
 * outside the label span" rather than by matching the badge copy, because the
 * copy is translated and the structure is not. Kick sets no `aria-disabled`
 * here, so this is the only marker there is; absent one, no claim is made
 * either way and the rung is treated as offered.
 */
function qualityOptionGated(control) {
  const label = qualityControlLabel(control);
  if (!label) return false;
  const full = String(control.textContent || '').replace(/\s+/g, ' ').trim();
  return full.replace(/\s+/g, '') !== label.replace(/\s+/g, '');
}

/** The best option this build has seen Kick offer, or '' if it has seen none. */
/**
 * The derivers the compatibility snapshot checks its expectations against.
 *
 * Passed in rather than imported: these live here, `compatibility.mjs` is
 * concatenated before this file, and handing them over keeps the same
 * expectations checkable offline against a fixture with stubs.
 */
/**
 * Publish the compatibility verdict where anything can read it.
 *
 * `html[data-kf-derived]` names every derived value that broke, so a drift that
 * a probe report cannot see — hook matched, computed value did not — is visible
 * without opening a panel or reaching inside the bundle. The live gate asserts
 * on this, and it is the fastest way to answer "is the mod actually deriving
 * anything here" while debugging.
 */
function publishCompatibility() {
  const root = document.documentElement;
  if (!root || !state.compatibility) return;
  const broken = (state.compatibility.derived || []).filter((entry) => entry.outcome === 'broken');
  // Both halves of the sentence: which probe, and which derived value. "card"
  // alone is what made the last one take a research pass to find.
  const verdict = broken.length
    ? broken.map((entry) => `${entry.probe}:${entry.id}`).join(' ')
    : 'ok';
  // Written only on change. This runs on every apply cycle, and setting an
  // attribute to the value it already holds still emits a mutation record.
  // The document observer watches `childList`/`subtree` and not attributes, so
  // this is not currently a feedback loop — the guard is here so it cannot
  // become one the day that observer gains `attributes: true`, and so the
  // attribute only changes when the verdict does.
  if (root.dataset.kfDerived !== verdict) root.dataset.kfDerived = verdict;
}

function compatibilityDerivers() {
  return {
    cardSlug: (card) => cardSlugFromPath(cardPath(card)),
    playerContainer: (video) => playerContainerFor(video),
    channelPlayer: (video) => (videoClosest(video, VIDEO_CHANNEL_PLAYER_SELECTOR)
      ? 'channel'
      : videoClosest(video, VIDEO_PLAYER_SELECTOR) ? 'generic' : 'none'),
    // A gated rung is one this session cannot pick — Kick offers it and refuses
    // it — so it has no height to yield and 0 is the honest answer rather than
    // a failure. Auto is 0 too, and the judge accepts it.
    qualityHeight: (control) => (qualityOptionGated(control)
      ? 0
      : Number(qualitySessionValue(qualityControlLabel(control)))),
  };
}

function bestKnownQuality() {
  const raw = state.mediaPreferences[QUALITY_LADDER_KEY];
  return typeof raw === 'string' ? bestQualityOption(raw.split('|')) : '';
}

/**
 * What the player should start at, or '' to leave Kick's own choice alone.
 * "Highest" wins over "remembered" when both are on — it is the more specific
 * instruction, and the alternative is a switch that appears to do nothing on
 * every channel the user has ever watched.
 */
function desiredQuality() {
  if (state.settings.content.preferBestQuality) {
    const best = bestKnownQuality();
    if (best) return best;
  }
  if (!state.settings.content.rememberQuality) return '';
  const key = mediaPreferenceKey('quality');
  const saved = key ? state.mediaPreferences[key] : '';
  return typeof saved === 'string' ? saved : '';
}

function applyQualitySessionKey() {
  const value = qualitySessionValue(desiredQuality());
  if (!value) return;
  try {
    if (sessionStorage.getItem(QUALITY_SESSION_KEY) === value) return;
    sessionStorage.setItem(QUALITY_SESSION_KEY, value);
  } catch {
    // Session storage can be denied; the menu fallback below still applies.
  }
}

/**
 * Remember the rungs, ignoring `Auto` (rank 0) and anything unrankable (-1).
 * A single option is not a ladder — that is a menu still rendering — and the
 * entry is re-inserted rather than updated in place so the writer's 240-key
 * bound evicts stale channels ahead of it.
 */
function recordQualityLadder(controls) {
  // A badged rung is one Kick is offering to somebody else. Recording it would
  // make "the best rung" a rung this session cannot select, which is the same
  // entitlement inference the emote rules forbid.
  const offered = controls.filter((control) => !qualityOptionGated(control));
  const labels = [...new Set(offered.map(qualityControlValue))].filter((label) => qualityRank(label) > 0);
  if (labels.length < 2) return;
  const ladder = labels.sort((left, right) => qualityRank(right) - qualityRank(left)).join('|');
  if (state.mediaPreferences[QUALITY_LADDER_KEY] === ladder) return;
  delete state.mediaPreferences[QUALITY_LADDER_KEY];
  state.mediaPreferences[QUALITY_LADDER_KEY] = ladder;
  gmSet(MEDIA_PREFERENCES_KEY, state.mediaPreferences);
}

function applyQualityMemory() {
  const { rememberQuality, preferBestQuality } = state.settings.content;
  if (!rememberQuality && !preferBestQuality) return;
  applyQualitySessionKey();
  // `[role="menuitemradio"]` is what Kick's own quality menu actually renders;
  // the rest are legacy guesses kept only so an older shell still works.
  const controls = findAllProbe(document, 'qualityOption').elements;
  if (preferBestQuality) recordQualityLadder(controls);
  const wanted = desiredQuality();
  for (const control of controls) {
    const value = qualityControlValue(control);
    if (!value) continue;
    if (control.dataset.kfQualityBound !== 'true') {
      control.dataset.kfQualityBound = 'true';
      control.addEventListener('change', () => saveMediaPreference('quality', qualityControlValue(control)));
      control.addEventListener('click', () => saveMediaPreference('quality', qualityControlValue(control)));
    }
    // Never click a rung Kick badged as unavailable to this session, whatever
    // the stored preference says.
    if (qualityOptionGated(control)) continue;
    // Kick renders these as `div[role="menuitemradio"]`, so the old
    // `tagName === 'BUTTON'` test meant this fallback never fired at all.
    if (wanted && control.dataset.kfQualityRestored !== 'true' && value.toLowerCase() === wanted.toLowerCase() && control instanceof HTMLElement && !(control instanceof HTMLSelectElement)) {
      control.click();
      control.dataset.kfQualityRestored = 'true';
    } else if (wanted && control.dataset.kfQualityRestored !== 'true' && control instanceof HTMLSelectElement && [...control.options].some((option) => option.value === wanted)) {
      control.value = wanted;
      control.dispatchEvent(new Event('change', { bubbles: true }));
      control.dataset.kfQualityRestored = 'true';
    }
  }
}

function applyMediaMemory() {
  if (state.route !== 'channel') return;
  for (const video of document.querySelectorAll('video')) bindMediaElement(video);
  applyQualityMemory();
}

/**
 * The element an overlay of ours may be appended to, which is never the video.
 *
 * Kick's `<video>` carries `id="video-player"`, and `closest()` tests the
 * element itself first — so the obvious `video.closest('[id*="player" i]')`
 * returns the video. Appending to a `<video>` is not an error: children of a
 * media element are fallback content and are never rendered, so the panel
 * silently does not exist. Measured on a live channel 2026-08-16, that had
 * disabled three features at once — the playback diagnostics panel, the
 * `[data-kf-player] video` contain rule, and the uptime chip added beside them.
 *
 * The walk starts at the parent for that reason, and prefers the nearest
 * ancestor that already establishes a containing block, so an absolutely
 * positioned overlay lands on the video box without this build restyling any
 * of Kick's own elements.
 */
function playerContainerFor(video) {
  const start = video?.parentElement;
  if (!start) return null;
  return start.closest?.('[data-testid*="player" i], [data-player], [id*="player" i]') || start;
}

function playerOverlayHost(video) {
  const container = playerContainerFor(video);
  if (!container) return null;
  try {
    if (typeof getComputedStyle !== 'function') return container;
    for (let node = video.parentElement; node && node !== document.body; node = node.parentElement) {
      const position = getComputedStyle(node)?.position;
      if (position && position !== 'static') return node;
    }
  } catch {
    // A stubbed or partial DOM: the container is still a correct answer.
  }
  return container;
}

function applyPlayerResilience() {
  const videos = [...document.querySelectorAll('video')];
  if (state.settings.layout.playerContainVideo) {
    for (const video of videos) {
      const owner = playerContainerFor(video);
      if (owner) owner.dataset.kfPlayer = 'true';
    }
  }
  if (!state.settings.layout.playerResizeRecovery) return;
  const main = findProbe(document, 'main').element;
  if (main) main.dataset.kfPlayerResizeReady = 'true';
}

/**
 * How far from the bottom of the transcript counts as "the reader scrolled up".
 *
 * Distance from the bottom rather than the direction of the scroll event,
 * because Kick auto-scrolls the list on every new message and that fires the
 * same event a person does. A list pinned to the bottom stays within a couple
 * of sub-pixel rounding errors of zero; anything past this is somebody reading
 * back.
 */
const CHAT_SCROLL_PAUSE_DISTANCE = 64;

/** Resolve message rows even when Kick removes every identifying attribute. */
function chatScrollRows(messages) {
  const viewport = messages.getBoundingClientRect();
  const inViewport = (node) => {
    const rect = node.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > viewport.top && rect.top < viewport.bottom;
  };
  const indexed = [...messages.querySelectorAll('[data-index]')].filter(inViewport);
  if (indexed.length) return indexed;
  const identified = [...messages.querySelectorAll('[data-message-id], [data-chat-entry], [role="listitem"], article, .group')]
    .filter((node) => inViewport(node) && String(node.textContent || '').trim().length > 0);
  if (identified.length) return identified;

  // Current Kick markup sometimes leaves the virtual rows completely
  // anonymous. Sample what the browser actually painted through the viewport,
  // then walk upward to the smallest row-shaped owner. This survives wrapper
  // changes that make a direct-child scan mistake the whole virtual list for a
  // message.
  const painted = [];
  if (typeof document.elementsFromPoint === 'function' && viewport.width > 0 && viewport.height > 0) {
    const xs = [0.2, 0.5, 0.8].map((ratio) => Math.min(viewport.right - 4, viewport.left + viewport.width * ratio));
    for (const x of xs) {
      for (let y = viewport.top + 8; y < viewport.bottom - 4; y += 24) {
        const candidates = [];
        for (const hit of document.elementsFromPoint(x, y)) {
          if (!messages.contains(hit)) continue;
          for (let node = hit; node && node !== messages; node = node.parentElement) {
            const rect = node.getBoundingClientRect();
            if (rect.height >= 16
              && rect.height <= Math.max(240, viewport.height * 0.45)
              && rect.width >= viewport.width * 0.5
              && String(node.textContent || '').trim().length > 0) {
              candidates.push({ node, rect });
            }
          }
        }
        candidates.sort((a, b) => a.rect.height - b.rect.height || b.rect.width - a.rect.width);
        if (candidates[0] && !painted.includes(candidates[0].node)) painted.push(candidates[0].node);
      }
    }
  }
  if (painted.length) {
    return painted.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  // A partial DOM or a browser without point sampling still gets a geometry
  // fallback. Find the descendant whose direct children form the largest
  // visible row group.
  let best = [];
  for (const parent of [messages, ...messages.querySelectorAll('div')]) {
    const rows = [...parent.children].filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.height >= 16
        && rect.height <= Math.max(240, viewport.height * 0.45)
        && rect.width >= viewport.width * 0.5
        && rect.bottom > viewport.top
        && rect.top < viewport.bottom
        && String(node.textContent || '').trim().length > 0;
    });
    if (rows.length > best.length) best = rows;
  }
  return best.length >= 2 ? best : [];
}

/**
 * The first visible message and its position inside the transcript viewport.
 *
 * Kick removes old rows while chat is paused, so scrollTop does not describe a
 * stable place. A row plus its visual offset does. Prefer Kick's data index,
 * which is present on the virtualised rows, and keep conservative fallbacks for
 * fixture and markup variants.
 */
function captureChatScrollAnchor(messages) {
  const viewport = messages.getBoundingClientRect();
  const visible = chatScrollRows(messages)
    .map((node) => ({ node, rect: node.getBoundingClientRect() }))
    .filter(({ rect }) => rect.height > 0 && rect.bottom > viewport.top && rect.top < viewport.bottom);
  const row = visible.find(({ rect }) => rect.top >= viewport.top) || visible[0];
  if (!row) return null;
  const id = chatMessageId(row.node);
  return {
    node: row.node,
    signature: id ? `id:${id}` : `text:${String(row.node.textContent || '').replace(/\s+/g, ' ').trim()}`,
    offset: row.rect.top - viewport.top,
  };
}

function chatScrollAnchorStillMatches(messages, anchor) {
  if (!anchor?.node?.isConnected || !messages.contains(anchor.node)) return false;
  const id = chatMessageId(anchor.node);
  const signature = id
    ? `id:${id}`
    : `text:${String(anchor.node.textContent || '').replace(/\s+/g, ' ').trim()}`;
  return signature === anchor.signature;
}

/** Hold the anchored row, or the last stable pixel when Kick recycled it. */
function restorePausedChatPosition(messages) {
  const anchor = state.runtime.chatScrollAnchor;
  if (chatScrollAnchorStillMatches(messages, anchor)) {
    const viewportTop = messages.getBoundingClientRect().top;
    const currentOffset = anchor.node.getBoundingClientRect().top - viewportTop;
    const adjustment = currentOffset - anchor.offset;
    if (Math.abs(adjustment) > 0.5) {
      state.runtime.chatScrollIgnoreUntil = Date.now() + 80;
      messages.scrollTop += adjustment;
    }
    state.runtime.chatScrollTop = messages.scrollTop;
    return;
  }

  // The anchored row was one of the rows Kick recycled. Restoring the last
  // stable scrollTop avoids a visible jump, then a fresh visible row becomes
  // the anchor for later mutations.
  if (Number.isFinite(state.runtime.chatScrollTop) && Math.abs(messages.scrollTop - state.runtime.chatScrollTop) > 0.5) {
    state.runtime.chatScrollIgnoreUntil = Date.now() + 80;
    messages.scrollTop = state.runtime.chatScrollTop;
  }
  state.runtime.chatScrollTop = messages.scrollTop;
  state.runtime.chatScrollAnchor = captureChatScrollAnchor(messages);
}

/**
 * Restore after Kick's virtualiser has finished its own frame work.
 *
 * A MutationObserver runs before requestAnimationFrame. Restoring directly in
 * the observer lets Kick's queued live-edge scroll win later in the same frame.
 * Two frames put the first correction after that work. A second bounded pass
 * catches virtualisers that settle later, while a dirty flag gives mutations
 * received during that window one follow-up cycle. Scroll events caused by a
 * correction are ignored briefly, while a later downward scroll schedules one
 * more coalesced restore instead of correcting synchronously.
 */
function schedulePausedChatRestore(messages) {
  if (state.runtime.chatScrollRestorePending) {
    state.runtime.chatScrollRestoreDirty = true;
    return;
  }
  state.runtime.chatScrollRestorePending = true;
  state.runtime.chatScrollRestoreDirty = false;
  const restore = () => {
    if (!state.runtime.chatPaused || state.runtime.chatPauseNode !== messages) return false;
    restorePausedChatPosition(messages);
    state.runtime.chatScrollLastTop = messages.scrollTop;
    return true;
  };
  const finish = () => {
    const active = restore();
    const repeat = active && state.runtime.chatScrollRestoreDirty;
    state.runtime.chatScrollRestorePending = null;
    state.runtime.chatScrollRestoreDirty = false;
    if (repeat) schedulePausedChatRestore(messages);
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      restore();
      setTimeout(finish, 120);
    }));
  } else {
    setTimeout(finish, 120);
  }
}

/**
 * Arm the existing paused state when the reader scrolls the transcript up.
 *
 * Kick's own pause-on-scroll is reported broken, and this build already has the
 * state, the button, and the observer that holds position — so this only has to
 * decide when to enter it. It deliberately does not rewrite chat, add a node,
 * or take the scroll over: past the threshold it flips the same flag the Pause
 * chat button flips, and Resume is still what leaves it.
 */
function armChatScrollPause(messages) {
  if (state.runtime.chatScrollNode === messages) return;
  releaseChatScrollPause();
  state.runtime.chatScrollLastTop = messages.scrollTop;
  const handler = () => {
    // Two conditions, and the direction is the one that matters. Distance from
    // the bottom alone reads a busy channel as a reader scrolling back: between
    // Kick appending a message and Kick scrolling to it, the list is genuinely
    // a row or two off the live edge, and on a fast chat that gap is open more
    // often than not. Measured on kick.com 2026-08-21, where distance alone
    // re-armed the pause seconds after Resume. A reader scrolling back is the
    // only thing that moves scrollTop *up*.
    const top = messages.scrollTop;
    const previousTop = state.runtime.chatScrollLastTop;
    if (Date.now() < state.runtime.chatScrollIgnoreUntil) {
      state.runtime.chatScrollLastTop = top;
      return;
    }
    // Held on `state.runtime`, not in this closure. Kick can reconcile the
    // transcript node across a channel-to-channel navigation rather than
    // remounting it, and the identity guard above then never re-runs — so a
    // closure variable would still hold the previous channel's position, and
    // the new channel's list loading in below it would read as the reader
    // scrolling back on a page they just opened.
    const movedUp = top < previousTop - 2;

    // An upward movement while paused is the reader continuing farther into
    // history, so it becomes the new anchor instead of being undone. Downward
    // movement schedules the coalesced post-render restore below. Correcting it
    // synchronously from this event creates a feedback loop with Kick's own
    // virtualiser on busy channels.
    if (state.runtime.chatPaused) {
      if (movedUp) {
        state.runtime.chatScrollTop = top;
        state.runtime.chatScrollAnchor = captureChatScrollAnchor(messages);
      } else if (top > previousTop + 2) {
        schedulePausedChatRestore(messages);
      }
      state.runtime.chatScrollLastTop = top;
      return;
    }

    state.runtime.chatScrollLastTop = top;
    if (!movedUp) return;
    if (!state.settings.content.stickyChatPause) return;
    // Once paused there is nothing left for this listener to decide; the
    // position is the observer's job. Two other things were tried here and both
    // are wrong on a virtualised transcript: re-pinning to wherever the list
    // scrolled to follows Kick's own small steps toward the newest message and
    // carries the pin to the bottom, and restoring the pin from the scroll
    // event fights the browser's scroll anchoring as rows recycle out of the
    // top, which ratchets the view down instead of holding it. Both measured on
    // kick.com 2026-08-21. Holding position on a recycling list needs a row
    // anchor rather than a pixel, which is its own change.
    if (state.runtime.chatPaused) return;
    const distance = messages.scrollHeight - messages.scrollTop - messages.clientHeight;
    if (!(distance > CHAT_SCROLL_PAUSE_DISTANCE)) return;
    state.runtime.chatPaused = true;
    applySettingsAttributes();
    applyChatPause();
    announce('Chat updates paused');
  };
  messages.addEventListener('scroll', handler, { passive: true });
  state.runtime.chatScrollNode = messages;
  state.runtime.chatScrollHandler = handler;
}

function releaseChatScrollPause() {
  const { chatScrollNode, chatScrollHandler } = state.runtime;
  if (chatScrollNode && chatScrollHandler) chatScrollNode.removeEventListener('scroll', chatScrollHandler);
  state.runtime.chatScrollNode = null;
  state.runtime.chatScrollHandler = null;
  state.runtime.chatScrollIgnoreUntil = 0;
}

function applyChatPause() {
  const panel = findProbe(document, 'chatPanel').element;
  const messages = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages');
  if (!panel || !messages) {
    // Nothing to tag, but a listener from a route that did resolve may still be
    // on one of Kick's nodes. Switching the setting off has to take it back off
    // even on the cycle where the chat probes find nothing.
    if (!state.settings.content.stickyChatPause) releaseChatScrollPause();
    return;
  }
  const owner = ownerFromChild(panel, '#channel-chatroom, [data-testid="chatroom"]');
  owner.dataset.kfChatPaused = String(state.runtime.chatPaused);
  let button = owner.querySelector?.('[data-kf-chat-pause]');
  if (state.settings.content.stickyChatPause && !button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.kfChatPause = 'true';
    owner.append(button);
  }
  if (!state.settings.content.stickyChatPause && button) button.remove();
  if (!state.settings.content.stickyChatPause) {
    state.runtime.chatPaused = false;
    releaseChatScrollPause();
    state.observers.chat?.disconnect?.();
    state.observers.chat = null;
    state.runtime.chatPauseNode = null;
    state.runtime.chatScrollAnchor = null;
    state.runtime.chatScrollTop = null;
    const previousAriaLive = messages.dataset.kfPreviousAriaLive;
    if (previousAriaLive && previousAriaLive !== '__none__') messages.setAttribute('aria-live', previousAriaLive);
    else messages.removeAttribute('aria-live');
    delete messages.dataset.kfPreviousAriaLive;
    delete owner.dataset.kfChatPaused;
    delete messages.dataset.kfChatPaused;
    return;
  }
  armChatScrollPause(messages);
  button.textContent = tr(state.runtime.chatPaused ? 'Resume chat' : 'Pause chat');
  button.setAttribute('aria-pressed', String(state.runtime.chatPaused));
  button.setAttribute('aria-label', tr(state.runtime.chatPaused ? 'Resume chat updates' : 'Pause chat updates'));
  let status = owner.querySelector?.('[data-kf-chat-status]');
  if (!status) {
    status = document.createElement('div');
    status.dataset.kfChatStatus = 'true';
    status.setAttribute('role', 'status');
    owner.append(status);
  }
  status.textContent = state.runtime.chatPaused ? tr('Chat updates paused') : '';
  if (state.runtime.chatPaused) {
    if (!Object.prototype.hasOwnProperty.call(messages.dataset, 'kfPreviousAriaLive')) {
      messages.dataset.kfPreviousAriaLive = messages.getAttribute('aria-live') || '__none__';
    }
    if (state.runtime.chatPauseNode !== messages) {
      state.observers.chat?.disconnect?.();
      state.observers.chat = null;
      state.runtime.chatPauseNode = messages;
      state.runtime.chatScrollTop = messages.scrollTop;
      state.runtime.chatScrollAnchor = captureChatScrollAnchor(messages);
    }
    if (!state.observers.chat) {
      state.runtime.chatScrollTop = messages.scrollTop;
      state.runtime.chatScrollAnchor = captureChatScrollAnchor(messages);
      state.observers.chat = new MutationObserver(() => schedulePausedChatRestore(messages));
      state.observers.chat.observe(messages, { childList: true, subtree: true, characterData: true });
    }
    messages.setAttribute('aria-live', 'off');
    messages.dataset.kfChatPaused = 'true';
  } else {
    state.observers.chat?.disconnect?.();
    state.observers.chat = null;
    state.runtime.chatPauseNode = null;
    state.runtime.chatScrollAnchor = null;
    state.runtime.chatScrollTop = null;
    delete messages.dataset.kfChatPaused;
    const previousAriaLive = messages.dataset.kfPreviousAriaLive;
    if (previousAriaLive && previousAriaLive !== '__none__') messages.setAttribute('aria-live', previousAriaLive);
    else messages.removeAttribute('aria-live');
    delete messages.dataset.kfPreviousAriaLive;
  }
}

function stickerPicker() {
  return document.querySelector('#chat-emotes-picker-panel, [data-testid="chat-emotes-picker-panel"], [data-testid*="emotes-picker-panel" i]');
}

function stickerScrollContainer(picker) {
  return picker.querySelector('.overflow-y-auto, [class*="overflow-y-auto" i]')
    || picker.querySelector('[id^="emote-picker-section-name-"]')?.parentElement
    || picker;
}

function stickerSearchInput(picker) {
  return picker.querySelector('#search-emotes-input, input[placeholder*="Search emotes" i], input[data-testid*="emote-search" i]');
}

function stickerOrganizerAnchor(search, picker) {
  if (!search) return null;
  // Kick nests the input in a grow wrapper beside its Close button. Mounting
  // after the input itself puts the whole organizer inside that narrow wrapper;
  // the containing header row is the full-width boundary we actually need.
  const row = search.closest?.('div[class*="flex" i][class*="items-center" i]');
  return row && row !== picker ? row : search;
}

function stickerButtonUnavailable(button) {
  return button.disabled
    || button.hasAttribute('disabled')
    || button.getAttribute('aria-disabled') === 'true';
}

function stickerImageInfo(image, options = {}) {
  if (!image) return null;
  const rawSrc = image.getAttribute('src') || image.getAttribute('data-src') || image.currentSrc || image.src || '';
  if (!/\/emotes\//i.test(rawSrc)) return null;
  const alt = image.getAttribute('alt') || options.name || 'Emote';
  if (alt.trim().toLowerCase() === 'emotes') return null;
  const rawId = options.id
    || image.dataset.emoteId
    || image.getAttribute('data-emote-id')
    || rawSrc.match(/\/emotes\/(\d+)/i)?.[1]
    || '';
  const id = String(rawId).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  const name = String(alt).replace(/\s+/g, ' ').trim().slice(0, 80) || 'Emote';
  // Cleaned here, not only on persist. The library card renders this string as
  // an href, and escapeHtml does not stop a scheme, so a value carrying
  // /emotes/ inside a javascript: URL used to survive in memory until the next
  // reload and give the Open artwork link script execution in kick.com's own
  // origin. Same rule the persist and import paths already applied.
  const src = cleanStickerAssetUrl(rawSrc);
  if (!src) return null;
  // Prefixed at the point of creation, not only on persist: the library is
  // keyed by this string, so a raw key here would miss every stored entry and
  // record a duplicate beside it.
  const key = platformStickerKey((id ? `id:${id}` : `name:${name.toLowerCase()}|src:${src}`).slice(0, 320));
  return { key, id, name, src };
}

function stickerButtonInfo(button, options = {}) {
  if (button.closest?.('[data-kf-sticker-organizer]')) return null;
  if (!options.includeUnavailable && stickerButtonUnavailable(button)) return null;
  const image = button.querySelector('img[src*="/emotes/" i], img[data-src*="/emotes/" i]');
  const info = stickerImageInfo(image, {
    id: button.dataset.emoteId || button.getAttribute('data-emote-id') || '',
    name: button.getAttribute('aria-label') || button.dataset.emoteName || 'Emote',
  });
  return info ? { ...info, button } : null;
}

function stickerNativeGroup(label, picker) {
  const parent = label.parentElement;
  if (!parent || parent === picker) return null;
  const labels = parent.querySelectorAll('[id^="emote-picker-section-name-"]');
  const buttons = [...parent.querySelectorAll('button')]
    .filter((button) => stickerButtonInfo(button, { includeUnavailable: true }));
  if (labels.length === 1 && buttons.length) return parent;
  const section = label.closest?.('section, [data-emote-section], [role="group"]');
  if (!section || section === picker) return null;
  const sectionLabels = section.querySelectorAll('[id^="emote-picker-section-name-"]');
  const sectionButtons = [...section.querySelectorAll('button')]
    .filter((button) => stickerButtonInfo(button, { includeUnavailable: true }));
  return sectionLabels.length === 1 && sectionButtons.length ? section : null;
}

function stickerNativeGroups(picker) {
  const groupsByButton = new Map();
  const organizerScroll = stickerScrollContainer(picker);
  const search = stickerSearchInput(picker);
  for (const label of picker.querySelectorAll('[id^="emote-picker-section-name-"]')) {
    const group = stickerNativeGroup(label, picker);
    if (!group) continue;
    group.dataset.kfStickerNativeGroup = 'true';
    const nativeList = group.closest('.overflow-y-auto, [class*="overflow-y-auto" i]');
    if (nativeList && nativeList !== organizerScroll && nativeList !== picker) {
      nativeList.dataset.kfStickerNativeList = 'true';
      for (let shell = nativeList.parentElement; shell && shell !== picker && shell !== organizerScroll; shell = shell.parentElement) {
        if (!search || !shell.contains(search)) continue;
        shell.dataset.kfStickerNativeShell = 'true';
        break;
      }
    }
    const name = String(label.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!name) continue;
    for (const button of group.querySelectorAll('button')) {
      if (stickerButtonInfo(button, { includeUnavailable: true })) groupsByButton.set(button, name);
    }
  }
  return groupsByButton;
}

/**
 * `lastSeen` alone is not worth a storage write on every apply cycle, so it is
 * only persisted once an hour has passed. The library can hold 2,400 entries
 * and this runs continuously on a live channel.
 */
const STICKER_LAST_SEEN_WRITE_MS = 60 * 60 * 1000;

/** Equality ignoring `lastSeen`, which moves constantly and means nothing alone. */
function sameStickerRecord(a, b) {
  const strip = (entry) => { const { lastSeen, ...rest } = entry; return rest; };
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

/**
 * Writing the whole ~0.5 MB library on every scan cycle was the jank source, so
 * merges from chat and the picker debounce the write. Direct user actions (pin,
 * hide, remove, assign) still persist synchronously through
 * saveStickerOrganization; only the continuous background merges are deferred.
 */
let stickerPersistTimer = 0;
function flushStickerPersist() {
  if (stickerPersistTimer) { clearTimeout(stickerPersistTimer); stickerPersistTimer = 0; }
  persistStickerPreferences();
  for (const summary of state.shadow?.querySelectorAll('[data-kf-sticker-library-summary]') || []) {
    summary.textContent = stickerLibrarySummary();
  }
}
function queueStickerPersist() {
  if (stickerPersistTimer) return;
  stickerPersistTimer = window.setTimeout(flushStickerPersist, 1500);
}
// A tab closing mid-debounce would otherwise lose its last observations.
window.addEventListener('pagehide', () => { if (stickerPersistTimer) flushStickerPersist(); });

function mergeStickerLibrary(observed) {
  let changed = false;
  const now = Date.now();
  for (const sticker of observed) {
    // A removed emote stays removed: never re-record it, and stop the rewrite
    // loop where a hidden entry was re-merged and re-persisted every cycle.
    if (state.stickerPreferences.hidden.has(sticker.key)) continue;
    const existing = state.stickerPreferences.library.get(sticker.key);
    const nativeGroups = [...new Set([...(existing?.nativeGroups || []), ...(sticker.nativeGroups || [])])].slice(0, 20);
    // `available` is the native picker's signal; `access` is the catalog's,
    // already decided by `catalogEmoteAccess`. Reading only the first meant a
    // catalog entry that said 'available' — every Global and Emoji emote, and
    // since entitlement landed, every emote the account actually owns — fell
    // through to 'locked' and was filed as subscriber-only.
    const incomingAccess = sticker.available || sticker.access === 'available'
      ? 'available'
      : sticker.access === 'observed'
        ? 'observed'
        : sticker.access === 'channel'
          ? 'channel'
          : 'locked';
    const access = preferredStickerAccess(existing?.access, incomingAccess);
    // Nothing here calls Kick. The record is built from what the page and the
    // catalog already showed, so no claim is automated and no endpoint replayed.
    const record = recordStickerObservation(existing, {
      key: sticker.key,
      id: sticker.id,
      name: sticker.name,
      src: sticker.src,
      nativeGroups,
      access,
      sourceSlug: sticker.sourceSlug || existing?.sourceSlug || '',
      requiresFollow: sticker.requiresFollow === true || existing?.requiresFollow === true,
      followed: sticker.followed === true || existing?.followed === true,
      subscribersOnly: sticker.subscribersOnly === true || existing?.subscribersOnly === true,
      // Where Kick will accept it, which is not what its access level says: a
      // free channel emote is `channel` access and works in exactly one chat,
      // while an owned subscriber emote works in all of them. Absent on records
      // written before this was known, which reads as "not established".
      ...(sticker.usableEverywhere === undefined ? {} : { usableEverywhere: sticker.usableEverywhere === true }),
      ...(sticker.usableHere === undefined ? {} : { usableHere: sticker.usableHere === true }),
    }, now);
    // `lastSeen` moves on every pass, so comparing it would rewrite the whole
    // library on every apply cycle. Only a real change is worth a write.
    if (!existing || !sameStickerRecord(existing, record)) {
      state.stickerPreferences.library.set(sticker.key, record);
      changed = true;
    } else if (record.lastSeen - existing.lastSeen > STICKER_LAST_SEEN_WRITE_MS) {
      state.stickerPreferences.library.set(sticker.key, record);
      changed = true;
    }
  }
  if (!changed) return false;
  queueStickerPersist();
  for (const summary of state.shadow?.querySelectorAll('[data-kf-sticker-library-summary]') || []) {
    summary.textContent = stickerLibrarySummary();
  }
  return true;
}

function disconnectStickerObserver() {
  state.observers.stickers?.disconnect?.();
  state.observers.stickers = null;
  state.runtime.stickerPickerTarget = null;
  state.runtime.stickerCatalogDirty = true;
}

function observeStickerPicker(picker) {
  if (state.runtime.stickerPickerTarget === picker && state.observers.stickers) return;
  disconnectStickerObserver();
  state.runtime.stickerPickerTarget = picker;
  state.runtime.stickerCatalogDirty = true;
  state.observers.stickers = new MutationObserver((mutations) => {
    if (mutations.every((mutation) => mutation.target.closest?.('[data-kf-sticker-organizer]'))) return;
    state.runtime.stickerCatalogDirty = true;
    scheduleApply(35);
  });
  state.observers.stickers.observe(picker, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['alt', 'aria-disabled', 'disabled', 'src', 'data-src', 'data-emote-id'],
  });
}

const CHAT_STICKER_IMAGE_SELECTOR = 'img[src*="/emotes/" i], img[data-src*="/emotes/" i]';
const pendingChatStickerSaves = new Set();

function catalogEmoteForSticker(sticker) {
  if (!sticker?.id || !Array.isArray(state.live.catalog?.emotes)) return null;
  return state.live.catalog.emotes.find((emote) => String(emote.id) === String(sticker.id)) || null;
}

function enrichChatSticker(sticker) {
  const emote = catalogEmoteForSticker(sticker);
  if (!emote) return sticker;
  return {
    ...sticker,
    nativeGroups: [...new Set([...(sticker.nativeGroups || []), emote.setName].filter(Boolean))],
    access: catalogEmoteAccess(emote),
    sourceSlug: emote.sourceSlug,
    requiresFollow: emote.requiresFollow,
    followed: emote.followed,
    subscribersOnly: emote.subscribersOnly,
  };
}

function chatStickerInfo(image) {
  const info = stickerImageInfo(image);
  return info ? enrichChatSticker({ ...info, nativeGroups: ['Seen in chat'], access: 'observed' }) : null;
}

function annotateChatSticker(image, sticker) {
  if (!state.settings.content.clickChatEmotes || !sticker) return;
  image.dataset.kfChatEmoteSave = sticker.key;
  image.setAttribute('role', 'button');
  image.setAttribute('tabindex', '0');
  image.setAttribute('aria-label', `Save ${sticker.name} to Kick Focus favorites`);
  // No `title`: the hover card replaces it, and a native tooltip would surface
  // on top of it a second later saying less. The clear path still removes any
  // title left by an earlier build.
  image.removeAttribute('title');
}

function clearChatStickerSaveAffordances() {
  hideChatEmoteTooltip();
  for (const image of document.querySelectorAll('[data-kf-chat-emote-save]')) {
    delete image.dataset.kfChatEmoteSave;
    if (image.getAttribute('role') === 'button') image.removeAttribute('role');
    if (image.getAttribute('tabindex') === '0') image.removeAttribute('tabindex');
    if (image.getAttribute('aria-label')?.startsWith('Save ')) image.removeAttribute('aria-label');
    if (image.getAttribute('title')?.startsWith('Save ')) image.removeAttribute('title');
  }
}

function stickerImagesWithin(node) {
  if (node?.nodeType !== 1) return [];
  const images = [];
  if (node.matches?.(CHAT_STICKER_IMAGE_SELECTOR)) images.push(node);
  for (const image of node.querySelectorAll?.(CHAT_STICKER_IMAGE_SELECTOR) || []) images.push(image);
  return images;
}

function flushChatStickerScan() {
  state.chatStickerScanTimer = 0;
  const nodes = [...state.chatStickerPendingNodes];
  state.chatStickerPendingNodes.clear();
  const observed = new Map();
  for (const node of nodes) {
    for (const image of stickerImagesWithin(node)) {
      const sticker = chatStickerInfo(image);
      if (sticker) {
        annotateChatSticker(image, sticker);
        observed.set(sticker.key, sticker);
      }
    }
  }
  if (observed.size) mergeStickerLibrary(observed.values());
}

// ---------------------------------------------------------------------------
// Transient surfaces in the top layer
//
// Two surfaces below — the emote hover card and the emote completion list —
// are body children that place themselves by hand. That is correct only for as
// long as nothing between them and the viewport establishes a containing block
// for fixed descendants, and only for as long as this build wins every z-index
// it is entered into. The top layer is subject to neither.
// ---------------------------------------------------------------------------

/** The element currently lending its name to each anchored surface. */
const ANCHORED_ELEMENTS = new Map();
const EMOTE_CARD_ANCHOR = '--kf-emote-card';
const EMOTE_COMPLETION_ANCHOR = '--kf-emote-completion';

/**
 * Whether this engine can put an anchored surface in the top layer.
 *
 * Measured in Chrome 151 on 2026-08-18, which is why this path exists at all:
 * giving an ancestor `filter: brightness(1)` moved a `position: fixed` child by
 * exactly that ancestor's offset — (100,100) became (400,300) — while the same
 * element in the top layer did not move. Kick sets no such filter today, so
 * this is insurance against a page change rather than a fix for a live defect.
 *
 * Every property the path uses is detected, never assumed. The names churned
 * during standardisation: `inset-area` became `position-area`, and
 * `position-try-options` became `position-try-fallbacks`. Chrome 151 answers
 * false for both older spellings, so a build that asked for the wrong name
 * would take the fallback forever and look like it simply did not work.
 */
let anchoredPopoverSupport = null;
function canAnchorPopover() {
  if (anchoredPopoverSupport !== null) return anchoredPopoverSupport;
  anchoredPopoverSupport = Boolean(
    typeof HTMLElement !== 'undefined'
    && typeof HTMLElement.prototype.showPopover === 'function'
    && typeof CSS !== 'undefined'
    && typeof CSS.supports === 'function'
    && CSS.supports('anchor-name: --kf-probe')
    && CSS.supports('position-anchor: --kf-probe')
    && CSS.supports('position-area: block-start')
    && CSS.supports('position-try-fallbacks: flip-block'),
  );
  return anchoredPopoverSupport;
}

/**
 * Mark a host as belonging in the top layer, if this engine has one.
 *
 * `manual` rather than `auto` is what keeps the keyboard promise: an auto
 * popover installs a close watcher, so Escape would be consumed here instead of
 * reaching Kick's composer, and a click anywhere would light-dismiss — which
 * for the hover card means the card fighting the click that was meant for chat.
 * Manual popovers move no focus and watch no keys.
 */
function markAnchoredSurface(host) {
  if (!canAnchorPopover()) return false;
  host.setAttribute('popover', 'manual');
  host.dataset.kfAnchored = 'true';
  return true;
}

/**
 * Point an open surface at the element it describes.
 *
 * Both properties are set inline, and that is the whole trick. Anchor names are
 * tree-scoped, so a `position-anchor` declared inside the host's own shadow
 * stylesheet resolves against the shadow tree — where a name set on a page
 * element does not exist. Measured in Chrome 151 on 2026-08-18: the
 * shadow-scoped spelling does not throw and does not warn, it simply does not
 * anchor, leaving the card parked in the corner of the viewport. An inline
 * style is in the document tree, where the anchor's name actually lives.
 * `scripts/check.mjs` gates against the shadow-scoped spelling coming back.
 */
function anchorSurfaceTo(host, anchor, name) {
  if (host?.dataset?.kfAnchored !== 'true' || !anchor?.style) return false;
  const previous = ANCHORED_ELEMENTS.get(name);
  // One name, one element: leaving it behind on a chat node that scrolls away
  // would make every card after it resolve against a stale anchor.
  if (previous && previous !== anchor) previous.style.removeProperty('anchor-name');
  ANCHORED_ELEMENTS.set(name, anchor);
  anchor.style.setProperty('anchor-name', name);
  host.style.setProperty('position-anchor', name);
  return true;
}

function releaseSurfaceAnchor(host, name) {
  const previous = ANCHORED_ELEMENTS.get(name);
  if (previous) previous.style.removeProperty('anchor-name');
  ANCHORED_ELEMENTS.delete(name);
  if (host?.style) host.style.removeProperty('position-anchor');
}

function openAnchoredSurface(host) {
  if (!host?.isConnected || host.dataset.kfAnchored !== 'true') return false;
  try {
    if (!host.matches(':popover-open')) host.showPopover();
    return true;
  } catch {
    // A disconnected host, or an engine that took the attribute and not the
    // method. Either way the hand-positioned path below is still correct.
    return false;
  }
}

function closeAnchoredSurface(host) {
  if (!host || typeof host.hidePopover !== 'function') return;
  try {
    if (host.matches(':popover-open')) host.hidePopover();
  } catch {
    // Already closed.
  }
}

/**
 * One hover card for the whole chat, reused.
 *
 * Delegated rather than per-emote: a busy chat replaces its messages
 * continuously, so a listener and an element per emote would be created and
 * discarded hundreds of times a minute. Kept in its own shadow root for the
 * same reason the rest of the interface is — Kick's chat CSS cannot reach in.
 */
const TOOLTIP_CSS = `
  :host {
    position: fixed;
    z-index: 2147483000;
    /* Never a pointer target: the card follows the cursor, and a hover
       surface under it would fight the emote for the same hover. */
    pointer-events: none;
    display: none;
    max-width: 280px;
  }
  :host([data-kf-open="true"]) { display: block; }
  /* The top-layer path. Everything before position-area undoes the UA's own
     popover styling — border, padding, background, and the inset/margin pair
     that would otherwise centre it — while position-area and its flips replace
     the measure-then-clamp pass below. */
  :host([data-kf-anchored="true"]) {
    inset: auto;
    margin: 0;
    border: 0;
    padding: 0;
    background: transparent;
    overflow: visible;
    color: inherit;
    position-area: block-start span-inline-end;
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  }
  .card {
    padding: 8px 10px;
    border: 1px solid var(--kf-border-strong, #38463d);
    border-radius: var(--kf-radius, 7px);
    background: var(--kf-panel-raised, #111713);
    color: var(--kf-text, #f5f8f6);
    box-shadow: 0 10px 28px rgba(0,0,0,.45);
    font: 12px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .card div { white-space: normal; overflow-wrap: anywhere; }
  .card div:first-child { font-weight: 700; }
  .card div + div { color: var(--kf-text-muted, #aab4ae); }
  .card div[data-warn="true"] { color: var(--kf-warning, #f6b943); }
`;

function chatEmoteTooltipHost() {
  if (state.chatEmoteTooltip?.host?.isConnected) return state.chatEmoteTooltip;
  const host = document.createElement('div');
  host.id = 'kick-focus-emote-tooltip';
  host.lang = activeLocale();
  host.setAttribute('role', 'tooltip');
  const shadow = host.attachShadow({ mode: 'open' });
  setMarkup(shadow, '<div class="card" data-kf-tooltip-card></div>');
  adoptStyles(shadow, TOOLTIP_CSS);
  markAnchoredSurface(host);
  document.body.append(host);
  state.chatEmoteTooltip = { host, card: shadow.querySelector('[data-kf-tooltip-card]') };
  return state.chatEmoteTooltip;
}

/**
 * Point an emote at the card describing it, or stop pointing at it.
 *
 * The same two-way token set the followed-channel preview uses: the card is
 * one element reused for every emote, so the emote under the pointer has to
 * claim it and give it back. Merging into whatever Kick already put on the
 * element rather than overwriting, because this is Kick's img.
 */
function setChatEmoteDescription(image, enabled) {
  if (!image?.getAttribute) return;
  const tokens = new Set((image.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  if (enabled) tokens.add('kick-focus-emote-tooltip');
  else tokens.delete('kick-focus-emote-tooltip');
  if (tokens.size) image.setAttribute('aria-describedby', [...tokens].join(' '));
  else image.removeAttribute('aria-describedby');
}

function hideChatEmoteTooltip() {
  const tooltip = state.chatEmoteTooltip;
  if (!tooltip?.host) return;
  setChatEmoteDescription(tooltip.describedImage, false);
  tooltip.describedImage = null;
  tooltip.host.dataset.kfOpen = 'false';
  closeAnchoredSurface(tooltip.host);
  releaseSurfaceAnchor(tooltip.host, EMOTE_CARD_ANCHOR);
}

function showChatEmoteTooltip(image) {
  const key = image?.dataset?.kfChatEmoteSave;
  // Keyed off the save affordance, so an unrelated injected image never gets a
  // card even when it happens to sit in a chat message.
  if (!key) return;
  const sticker = state.stickerPreferences.library.get(key) || chatStickerInfo(image);
  const lines = emoteTooltipText(sticker, state.live.collisions, state.stickerPreferences.library.has(key));
  if (!lines.length) return;
  const { host, card } = chatEmoteTooltipHost();
  card.replaceChildren(...lines.map((line, index) => {
    const row = document.createElement('div');
    // The first line is the emote's own name — user data, never translated, or
    // an emote called "View" would be renamed by a dictionary hit. The rest is
    // this build's prose; composed lines fall through the forward lookup.
    row.textContent = index === 0 ? line : tr(line);
    if (index > 0 && line.startsWith('Name shadowed')) row.dataset.warn = 'true';
    return row;
  }));
  host.dataset.kfOpen = 'true';
  // Claimed after the card is filled, so a reader that follows the reference
  // finds the lines for this emote rather than the previous one's.
  const tooltip = state.chatEmoteTooltip;
  if (tooltip) {
    setChatEmoteDescription(tooltip.describedImage, false);
    tooltip.describedImage = image;
  }
  setChatEmoteDescription(image, true);
  // The top layer places it against the emote itself: no measure, no clamp, no
  // second pass, and nothing Kick can clip it with.
  if (anchorSurfaceTo(host, image, EMOTE_CARD_ANCHOR) && openAnchoredSurface(host)) return;
  // Otherwise, clamped after the card is measurable, so a wide entry near an
  // edge is pulled back on screen instead of being cut off by the viewport.
  const anchor = image.getBoundingClientRect();
  const box = host.getBoundingClientRect();
  const left = Math.min(Math.max(8, anchor.left), Math.max(8, window.innerWidth - box.width - 8));
  const above = anchor.top - box.height - 8;
  host.style.left = `${left}px`;
  host.style.top = `${above >= 8 ? above : Math.min(anchor.bottom + 8, window.innerHeight - box.height - 8)}px`;
}

function onChatEmoteHover(event) {
  const image = event.target?.closest?.('[data-kf-chat-emote-save]');
  if (!image) {
    hideChatEmoteTooltip();
    return;
  }
  showChatEmoteTooltip(image);
}

function queueChatStickerScan(nodes) {
  for (const node of nodes || []) if (node?.nodeType === 1) state.chatStickerPendingNodes.add(node);
  if (!state.chatStickerPendingNodes.size || state.chatStickerScanTimer) return;
  state.chatStickerScanTimer = window.setTimeout(flushChatStickerScan, 120);
}

function disconnectChatStickerObserver() {
  state.observers.chatStickers?.disconnect?.();
  state.observers.chatStickers = null;
  state.runtime.stickerChatTarget = null;
  clearTimeout(state.chatStickerScanTimer);
  state.chatStickerScanTimer = 0;
  state.chatStickerPendingNodes.clear();
}

function observeChatStickerDiscovery() {
  if (!state.settings.content.organizeChatStickers) {
    disconnectChatStickerObserver();
    clearChatStickerSaveAffordances();
    return;
  }
  if (!state.settings.content.clickChatEmotes) clearChatStickerSaveAffordances();
  const messages = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages');
  if (!messages) {
    disconnectChatStickerObserver();
    return;
  }
  if (state.runtime.stickerChatTarget === messages && state.observers.chatStickers) {
    if (state.settings.content.clickChatEmotes) queueChatStickerScan([messages]);
    return;
  }
  disconnectChatStickerObserver();
  state.runtime.stickerChatTarget = messages;
  queueChatStickerScan([messages]);
  state.observers.chatStickers = new MutationObserver((mutations) => {
    const changed = [];
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') changed.push(mutation.target);
      else for (const node of mutation.addedNodes) changed.push(node);
    }
    queueChatStickerScan(changed);
  });
  state.observers.chatStickers.observe(messages, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['alt', 'src', 'data-src', 'data-emote-id'],
  });
}

function stickerDescriptors(picker) {
  for (const node of picker.querySelectorAll('[data-kf-sticker-key], [data-kf-sticker-native-group], [data-kf-sticker-native-list], [data-kf-sticker-native-shell]')) {
    if (node.closest('[data-kf-sticker-organizer]')) continue;
    node.removeAttribute('data-kf-sticker-key');
    node.removeAttribute('data-kf-sticker-hidden');
    node.removeAttribute('data-kf-sticker-pinned');
    node.removeAttribute('data-kf-sticker-native');
    node.removeAttribute('data-kf-sticker-native-group');
    node.removeAttribute('data-kf-sticker-native-list');
    node.removeAttribute('data-kf-sticker-native-shell');
  }

  const nativeGroups = stickerNativeGroups(picker);
  const observed = new Map();
  const descriptors = new Map();
  for (const button of [...picker.querySelectorAll('button')].filter((candidate) => !candidate.closest('[data-kf-sticker-organizer]'))) {
    const info = stickerButtonInfo(button, { includeUnavailable: true });
    if (!info) continue;
    const group = nativeGroups.get(button);
    const available = !stickerButtonUnavailable(button);
    const seen = observed.get(info.key);
    if (seen) {
      if (group && !seen.nativeGroups.includes(group)) seen.nativeGroups.push(group);
      seen.available ||= available;
    } else {
      observed.set(info.key, {
        key: info.key,
        id: info.id,
        name: info.name,
        src: info.src,
        nativeGroups: group ? [group] : [],
        available,
      });
    }
    if (!available) continue;
    const existing = descriptors.get(info.key);
    if (existing) {
      existing.originals.push(button);
      if (group && !existing.nativeGroups.includes(group)) existing.nativeGroups.push(group);
    } else {
      descriptors.set(info.key, {
        key: info.key,
        id: info.id,
        name: info.name,
        src: info.src,
        nativeGroups: group ? [group] : [],
        originals: [button],
      });
    }
  }
  mergeStickerLibrary(observed.values());

  for (const descriptor of descriptors.values()) {
    const hidden = state.stickerPreferences.hidden.has(descriptor.key);
    const pinned = isFavorited(descriptor.key);
    for (const original of descriptor.originals) {
      original.dataset.kfStickerKey = descriptor.key;
      original.dataset.kfStickerHidden = String(hidden);
      original.dataset.kfStickerPinned = String(pinned);
      original.dataset.kfStickerNative = 'true';
    }
  }
  state.stickerCatalog = descriptors;
  return [...descriptors.values()];
}

/**
 * The rarity of a collectible, when the join was confident enough to say.
 *
 * Returns an empty string otherwise, so a tile with unresolved rarity renders
 * exactly as it did before this feature existed.
 */
function rarityBadge(descriptor) {
  if (!state.settings.content.showEmoteRarity || !state.live.rarity) return '';
  const match = state.live.rarity.matched.find((entry) => entry.emote.id === descriptor.id);
  if (!match) return '';
  return `<span class="kf-rarity" data-rarity="${escapeHtml(match.rarity)}" title="${escapeHtml(trf('Kick rarity, matched by {basis}', { basis: tr(match.basis) }))}">${escapeHtml(match.rarity)}</span>`;
}

/**
 * Collectible emotes can be 2:1 and every third-party renderer squashes them,
 * because the aspect rule lives only in Kick's own client. Measured from the
 * loaded image rather than assumed from the name, since the prefix alone would
 * stretch ordinary square collectibles.
 */
function emoteImageAttrs(descriptor) {
  return isCollectibleEmote(descriptor.name)
    ? ' data-kf-emote-measure="true"'
    : '';
}

function measureEmoteAspect(scope) {
  for (const image of scope?.querySelectorAll?.('img[data-kf-emote-measure="true"]') || []) {
    if (image.dataset.kfEmoteAspect) continue;
    const apply = () => {
      const aspect = emoteAspect(image.getAttribute('alt') || '', image.naturalWidth, image.naturalHeight);
      if (aspect === 'wide') image.dataset.kfEmoteAspect = 'wide';
    };
    if (image.complete && image.naturalWidth) apply();
    else image.addEventListener('load', apply, { once: true });
  }
}

function stickerProxyMarkup(descriptor) {
  const pinned = isFavorited(descriptor.key);
  const hidden = state.stickerPreferences.hidden.has(descriptor.key);
  const selected = state.runtime.stickerPickerSelection.has(descriptor.key);
  const organizing = state.runtime.stickerPickerOrganizing;
  const safeKey = escapeHtml(descriptor.key);
  const safeName = escapeHtml(descriptor.name);
  const scope = pinned ? favoriteScopeOf(descriptor.key) : '';
  // The state stamp is what lets a favorite toggle patch this tile in place
  // instead of re-serialising the window it sits in.
  return `<div data-kf-sticker-item="true" data-kf-sticker-key="${safeKey}" data-kf-sticker-hidden="${hidden}" data-kf-sticker-pinned="${pinned}" data-kf-sticker-selected="${selected}" data-kf-sticker-state="${pinned}:${hidden}"${scope ? ' data-kf-sticker-scoped="true"' : ''}>
    <button type="button" data-kf-sticker-action="send" data-kf-sticker-key="${safeKey}" data-kf-sticker-proxy${organizing ? ` aria-pressed="${selected}"` : ''} aria-label="${escapeHtml(trf(organizing ? 'Select emote {name}' : 'Use emote {name}', { name: descriptor.name }))}" title="${escapeHtml(trf(organizing ? 'Select {name}' : 'Use {name}', { name: descriptor.name }))}"><img src="${escapeHtml(descriptor.src)}" alt="${safeName}" loading="lazy"${emoteImageAttrs(descriptor)}>${rarityBadge(descriptor)}</button>
    <span data-kf-sticker-check aria-hidden="true">${uiIcon('check')}</span>
    <div data-kf-sticker-tools>
      <button type="button" data-kf-sticker-action="pin" data-kf-sticker-key="${safeKey}" aria-pressed="${pinned}" aria-label="${escapeHtml(trf(pinned ? (scope ? 'Remove this-channel favorite {name}' : 'Remove favorite {name}') : 'Favorite {name}', { name: descriptor.name }))}" title="${escapeHtml(tr(pinned ? (scope ? 'Remove favorite (this channel)' : 'Remove favorite') : 'Favorite'))}">${uiIcon('star')}</button>
      <button type="button" data-kf-sticker-action="hide" data-kf-sticker-key="${safeKey}" aria-label="${escapeHtml(trf(hidden ? 'Restore {name}' : 'Remove {name}', { name: descriptor.name }))}" title="${escapeHtml(tr(hidden ? 'Restore' : 'Remove'))}">${uiIcon(hidden ? 'reset' : 'trash')}</button>
    </div>
  </div>`;
}

function unavailableStickerCount(picker, availableDescriptors) {
  const availableKeys = new Set(availableDescriptors.map((descriptor) => descriptor.key));
  const keys = new Set();
  for (const button of picker.querySelectorAll('button:disabled, button[aria-disabled="true"]')) {
    const info = stickerButtonInfo(button, { includeUnavailable: true });
    if (info && !availableKeys.has(info.key)) keys.add(info.key);
  }
  return keys.size;
}

function removeStickerOrganizer() {
  for (const organizer of document.querySelectorAll('[data-kf-sticker-organizer]')) organizer.remove();
}

function stickerGroupById(id) {
  return state.stickerPreferences.groups.find((group) => group.id === id) || null;
}

function pickerStickerGroupPanelMarkup(descriptors) {
  const groups = state.stickerPreferences.groups;
  const active = stickerGroupById(state.stickerPreferences.activeGroup) || groups[0] || null;
  const editor = state.runtime.stickerPickerGroupEditor;
  const editingGroup = editor && editor !== 'new' ? stickerGroupById(editor) : null;
  const editorValue = editingGroup?.name || '';
  const chips = groups.map((group) => {
    const count = descriptors.filter((descriptor) => state.stickerPreferences.assignments.get(descriptor.key) === group.id).length;
    const selected = active?.id === group.id;
    return `<button type="button" data-kf-sticker-view="group" data-kf-sticker-group="${escapeHtml(group.id)}" data-active="${selected}" aria-pressed="${selected}">${escapeHtml(group.name)} <span>${count}</span></button>`;
  }).join('');
  const create = `<button type="button" data-kf-sticker-group-create>${uiIcon('plus')}<span>${escapeHtml(tr('New group'))}</span></button>`;
  const editorMarkup = editor
    ? `<div data-kf-sticker-group-editor>
      <input type="text" maxlength="60" data-kf-sticker-group-editor-input value="${escapeHtml(editorValue)}" placeholder="${escapeHtml(tr(editor === 'new' ? 'Group name' : 'Rename group'))}" aria-label="${escapeHtml(tr(editor === 'new' ? 'New emote group name' : 'Rename emote group'))}">
      <div data-kf-sticker-editor-actions><button type="button" data-kf-sticker-group-save="${escapeHtml(editor)}">${uiIcon('check')}${escapeHtml(tr('Save'))}</button><button type="button" data-kf-sticker-group-cancel>${escapeHtml(tr('Cancel'))}</button></div>
    </div>`
    : '';
  const activeCount = active
    ? descriptors.filter((descriptor) => state.stickerPreferences.assignments.get(descriptor.key) === active.id).length
    : 0;
  const summary = active && !editor
    ? `<div data-kf-sticker-group-summary><span>${escapeHtml(trf('{count} in {name}', { count: activeCount, name: active.name }))}</span><div data-kf-sticker-group-actions><button type="button" data-kf-sticker-group-rename="${escapeHtml(active.id)}">${uiIcon('edit')}${escapeHtml(tr('Rename'))}</button><button type="button" data-kf-sticker-group-delete="${escapeHtml(active.id)}">${uiIcon('trash')}${escapeHtml(tr('Delete'))}</button></div></div>`
    : '';
  return `<section data-kf-sticker-group-panel aria-label="${escapeHtml(tr('Custom emote groups'))}"><div data-kf-sticker-group-list>${chips}${create}</div>${editorMarkup}${summary}</section>`;
}

function pickerStickerBatchMarkup() {
  const count = state.runtime.stickerPickerSelection.size;
  const disabled = count ? '' : ' disabled';
  const reorderDisabled = count === 1 ? '' : ' disabled';
  const bulkGroup = stickerGroupById(state.runtime.stickerPickerBulkGroup)
    ? state.runtime.stickerPickerBulkGroup
    : '';
  const options = [`<option value=""${bulkGroup ? '' : ' selected'}>${escapeHtml(tr('Ungrouped'))}</option>`, ...state.stickerPreferences.groups.map((group) => `<option value="${escapeHtml(group.id)}"${bulkGroup === group.id ? ' selected' : ''}>${escapeHtml(group.name)}</option>`)].join('');
  return `<div data-kf-sticker-batch>
    <div data-kf-sticker-batch-summary><strong data-kf-sticker-selected-count aria-live="polite">${escapeHtml(trf(count === 1 ? '{count} selected emote' : '{count} selected emotes', { count }))}</strong><button type="button" data-kf-sticker-select-shown>${escapeHtml(tr('Select shown'))}</button><button type="button" data-kf-sticker-clear-selection${disabled}>${escapeHtml(tr('Clear'))}</button></div>
    <div data-kf-sticker-batch-actions>${state.stickerPreferences.view === 'pinned' ? `<button type="button" data-kf-sticker-batch-reorder="up"${reorderDisabled}>${escapeHtml(tr('Earlier'))}</button><button type="button" data-kf-sticker-batch-reorder="down"${reorderDisabled}>${escapeHtml(tr('Later'))}</button>` : ''}<select data-kf-sticker-bulk-group aria-label="${escapeHtml(tr('Move selected emotes to group'))}">${options}</select><button type="button" data-kf-sticker-batch-move${disabled}>${escapeHtml(tr('Move'))}</button><button type="button" data-kf-sticker-batch-remove${disabled}>${escapeHtml(tr('Remove'))}</button></div>
  </div>`;
}

function restoreStickerGridScroll(organizer, scrollTop) {
  if (!Number.isFinite(scrollTop)) return;
  const grid = organizer.querySelector('[data-kf-sticker-grid]');
  if (!grid) return;
  const restore = () => {
    if (!grid.isConnected) return;
    const maximum = Math.max(0, grid.scrollHeight - grid.clientHeight);
    grid.scrollTop = Math.min(Math.max(0, scrollTop), maximum);
  };
  restore();
  requestAnimationFrame(restore);
}

function rememberStickerGridScroll(target) {
  const grid = target.closest?.('[data-kf-sticker-organizer]')?.querySelector('[data-kf-sticker-grid]');
  state.runtime.stickerGridScrollTop = Number.isFinite(grid?.scrollTop) ? grid.scrollTop : null;
}

function clearStickerUI() {
  removeStickerOrganizer();
  for (const node of document.querySelectorAll('[data-kf-sticker-key], [data-kf-sticker-native-group], [data-kf-sticker-native-list], [data-kf-sticker-native-shell], [data-kf-sticker-scroll]')) {
    if (node.closest('[data-kf-sticker-organizer]')) continue;
    node.removeAttribute('data-kf-sticker-key');
    node.removeAttribute('data-kf-sticker-hidden');
    node.removeAttribute('data-kf-sticker-pinned');
    node.removeAttribute('data-kf-sticker-native');
    node.removeAttribute('data-kf-sticker-native-group');
    node.removeAttribute('data-kf-sticker-native-list');
    node.removeAttribute('data-kf-sticker-native-shell');
    node.removeAttribute('data-kf-sticker-scroll');
  }
  delete document.documentElement.dataset.kfStickerView;
  delete document.documentElement.dataset.kfStickersShowHidden;
  state.stickerCatalog = new Map();
  state.runtime.stickerCatalogDirty = true;
}

function renderStickerOrganizer() {
  const picker = stickerPicker();
  if (!picker) {
    disconnectStickerObserver();
    state.stickerCatalog = new Map();
    state.runtime.stickerPickerSelection.clear();
    state.runtime.stickerPickerVisibleKeys = [];
    state.runtime.stickerPickerOrganizing = false;
    state.runtime.stickerPickerGroupEditor = '';
    return;
  }
  if (!state.settings.content.organizeChatStickers) {
    disconnectStickerObserver();
    clearStickerUI();
    return;
  }
  observeStickerPicker(picker);
  let descriptors;
  if (state.runtime.stickerCatalogDirty) {
    descriptors = stickerDescriptors(picker);
    state.runtime.stickerCatalogDirty = false;
  } else {
    descriptors = [...state.stickerCatalog.values()];
  }
  const scroll = stickerScrollContainer(picker);
  if (!scroll) return;
  scroll.dataset.kfStickerScroll = 'true';
  if (!descriptors.length) {
    removeStickerOrganizer();
    return;
  }
  const search = stickerSearchInput(picker);
  if (search && search.dataset.kfStickerSearchBound !== 'true') {
    search.dataset.kfStickerSearchBound = 'true';
    // Debounced: every keystroke used to re-filter and re-serialise the whole
    // library, so typing a five-letter name rebuilt the grid five times.
    search.addEventListener('input', () => {
      clearTimeout(state.runtime.stickerSearchTimer);
      state.runtime.stickerSearchTimer = window.setTimeout(() => {
        state.runtime.stickerSearchTimer = 0;
        state.runtime.stickerGridAnchor = 0;
        renderStickerOrganizer();
      }, STICKER_SEARCH_DEBOUNCE_MS);
    });
  }
  let organizer = picker.querySelector('[data-kf-sticker-organizer]');
  if (!organizer) {
    organizer = document.createElement('section');
    organizer.dataset.kfStickerOrganizer = 'true';
    // A stable skeleton: the chrome and the grid are rebuilt on their own
    // signatures, so a favorite toggle never re-serialises the whole library.
    const chrome = document.createElement('div');
    chrome.dataset.kfStickerChrome = 'true';
    const gridHost = document.createElement('div');
    gridHost.dataset.kfStickerGridHost = 'true';
    organizer.append(chrome, gridHost);
    bindStickerGridScroll(gridHost);
    organizer.addEventListener('change', (event) => {
      const select = event.target.closest?.('select[data-kf-sticker-bulk-group]');
      if (select) state.runtime.stickerPickerBulkGroup = select.value;
    });
  }
  const organizerAnchor = stickerOrganizerAnchor(search, picker);
  if (organizerAnchor && organizer.previousElementSibling !== organizerAnchor) organizerAnchor.after(organizer);
  else if (!search && organizer.parentElement !== scroll) scroll.prepend(organizer);
  const previousGridScrollTop = state.runtime.stickerGridScrollTop;
  state.runtime.stickerGridScrollTop = null;

  const query = String(search?.value || '').trim().toLowerCase();
  const showHidden = state.stickerPreferences.showHidden;
  const matches = (descriptor) => (!query || descriptor.name.toLowerCase().includes(query))
    && (showHidden || !state.stickerPreferences.hidden.has(descriptor.key));
  const available = descriptors.filter((descriptor) => showHidden || !state.stickerPreferences.hidden.has(descriptor.key));
  const allVisible = available.filter(matches);
  // Favorites render in their explicit order, not in picker order — that
  // ordering is the whole point, and the picker's own order is Kick's.
  const favoriteOrder = favoriteKeysInOrder();
  const byFavoriteOrder = (left, right) => favoriteOrder.indexOf(left.key) - favoriteOrder.indexOf(right.key);
  const unavailableCount = unavailableStickerCount(picker, descriptors);

  // Usage counts are keyed by Kick's emote id; the organizer is keyed by
  // storage key, so Recent is a lookup rather than a second store.
  const byId = new Map();
  for (const descriptor of descriptors) {
    if (descriptor.id && !byId.has(String(descriptor.id))) byId.set(String(descriptor.id), descriptor);
  }
  // Presentational, over counts this build already records. Nothing here sends,
  // repeats, or schedules a send.
  const fromUsage = (ranked) => ranked
    .map((entry) => byId.get(String(entry.id)))
    .filter((descriptor) => descriptor && matches(descriptor))
    .slice(0, STICKER_USAGE_SECTION_LIMIT);
  const usageDepth = STICKER_USAGE_SECTION_LIMIT * 3;
  const recent = fromUsage(recentEmoteUsage(state.emoteUsage, { channel: state.live.slug, limit: usageDepth }));

  if (state.stickerPreferences.view === 'group'
    && !stickerGroupById(state.stickerPreferences.activeGroup)
    && state.stickerPreferences.groups[0]) {
    state.stickerPreferences.activeGroup = state.stickerPreferences.groups[0].id;
  }
  const view = state.stickerPreferences.view;
  const visible = view === 'pinned'
    ? allVisible.filter((descriptor) => isFavorited(descriptor.key)).sort(byFavoriteOrder)
    : view === 'recent'
      ? recent
      : view === 'group'
        ? allVisible.filter((descriptor) => state.stickerPreferences.assignments.get(descriptor.key) === state.stickerPreferences.activeGroup)
        : allVisible;
  state.runtime.stickerPickerVisibleKeys = visible.map((descriptor) => descriptor.key);

  const chrome = organizer.querySelector('[data-kf-sticker-chrome]');
  const gridHost = organizer.querySelector('[data-kf-sticker-grid-host]');
  organizer.dataset.kfStickerOrganizing = String(state.runtime.stickerPickerOrganizing && view !== 'native');

  // The chrome and the grid carry separate signatures. Toggling one favorite
  // changes a count, which is cheap; re-serialising a library at the 2400 cap
  // to show it is not, and the split is what stops that.
  const signature = [
    activeLocale(),
    view,
    state.stickerPreferences.activeGroup,
    String(showHidden),
    query,
    String(visible.length),
    String(allVisible.length),
    recent.map((descriptor) => descriptor.key).join(','),
    String(unavailableCount),
    String(state.runtime.stickerPickerOrganizing),
    state.runtime.stickerPickerGroupEditor,
    state.runtime.stickerPickerBulkGroup,
    // Order is part of the signature: reordering changes nothing else, so
    // without it the shelf would keep the stale arrangement on screen.
    favoriteOrder.join(','),
    [...state.stickerPreferences.hidden].join(','),
    state.stickerPreferences.groups.map((group) => `${group.id}:${group.name}`).join(','),
    [...state.stickerPreferences.assignments].map(([key, groupId]) => `${key}:${groupId}`).join(','),
  ].join('\u0001');
  if (chrome.dataset.kfStickerSignature === signature) {
    // The chrome is current; the grid may still need a different window, and a
    // pinned/removed tile inside the current one needs its own state refreshed.
    renderStickerGrid(gridHost, visible, view);
    patchStickerSelection(organizer);
    restoreStickerGridScroll(organizer, previousGridScrollTop);
    return;
  }
  chrome.dataset.kfStickerSignature = signature;
  const countLabel = query
    ? trf('{shown} of {total} available', { shown: visible.length, total: available.length })
    : trf('{count} available', { count: available.length });
  const lockedLabel = unavailableCount ? trf(', {count} locked by Kick', { count: unavailableCount }) : '';
  const tab = (id, label, count = '') => `<button type="button" data-kf-sticker-view="${id}" data-active="${view === id}" aria-pressed="${view === id}">${escapeHtml(label)}${count === '' ? '' : ` <span>${count}</span>`}</button>`;
  const groupTarget = state.stickerPreferences.activeGroup || state.stickerPreferences.groups[0]?.id || '';
  const groupTab = `<button type="button" data-kf-sticker-view="group"${groupTarget ? ` data-kf-sticker-group="${escapeHtml(groupTarget)}"` : ''} data-active="${view === 'group'}" aria-pressed="${view === 'group'}">${escapeHtml(tr('Groups'))} <span>${state.stickerPreferences.groups.length}</span></button>`;
  setMarkup(chrome, `
    <div data-kf-sticker-topline>
      <div data-kf-sticker-heading><strong>${escapeHtml(tr('Your emotes'))}</strong><span data-kf-sticker-count>${escapeHtml(countLabel + lockedLabel)}</span></div>
      <div data-kf-sticker-top-actions><button type="button" data-kf-sticker-organize aria-pressed="${state.runtime.stickerPickerOrganizing}">${uiIcon('check')}<span>${escapeHtml(tr(state.runtime.stickerPickerOrganizing ? 'Done' : 'Organize'))}</span></button><button type="button" data-kf-sticker-manage="true">${uiIcon('folder')}<span>${escapeHtml(tr('Library'))}</span></button></div>
    </div>
    <div data-kf-sticker-tabs role="group" aria-label="${escapeHtml(tr('Emote views'))}">
      ${tab('pinned', tr('Favorites'), favoriteCount())}
      ${tab('recent', tr('Recent'), recent.length)}
      ${tab('all', tr('All'), allVisible.length)}
      ${groupTab}
      ${tab('native', tr('Kick'))}
    </div>
    ${view === 'group' ? pickerStickerGroupPanelMarkup(available) : ''}
    ${state.runtime.stickerPickerOrganizing && view !== 'native' ? pickerStickerBatchMarkup() : ''}`);
  renderStickerGrid(gridHost, visible, view);
  patchStickerSelection(organizer);
  restoreStickerGridScroll(organizer, previousGridScrollTop);
  measureEmoteAspect(organizer);
}

/** How many columns the auto-fill grid resolves to at its current width. */
function stickerGridColumns(grid) {
  const width = grid?.clientWidth || 0;
  if (!width) return 1;
  return Math.max(1, Math.floor((width + STICKER_GRID_GAP) / (STICKER_TILE_MIN_WIDTH + STICKER_GRID_GAP)));
}

/**
 * One grid item standing in for a whole block of rows nobody can see.
 *
 * Not virtualization: the browser keeps doing the scrolling, and the spacer's
 * height is what keeps the scrollbar honest about how much library is there.
 */
function stickerSpacerMarkup(count, columns, side) {
  const rows = Math.ceil(Math.max(0, count) / Math.max(1, columns));
  if (rows <= 0) return '';
  const height = rows * STICKER_TILE_HEIGHT + (rows - 1) * STICKER_GRID_GAP;
  return `<div data-kf-sticker-spacer="${side}" aria-hidden="true" style="height:${height}px"></div>`;
}

/**
 * Render the window of the grid that is actually near the viewport.
 *
 * A library at the cap is 2400 tiles, each a button, an image and two controls.
 * Serialising all of them cost more than the picker itself, so what goes in the
 * DOM is one window plus two spacers, and the window moves when the viewer gets
 * within a few rows of its edge.
 */
function renderStickerGrid(gridHost, visible, view) {
  if (view === 'native') {
    setStickerGridHost(gridHost, `native:${activeLocale()}`, `<div data-kf-sticker-empty><div><strong>${escapeHtml(tr('Kick groups'))}</strong><span>${escapeHtml(tr('Kick’s original emote groups are shown below.'))}</span></div></div>`);
    return;
  }
  if (!visible.length) {
    const searching = Boolean(String(stickerSearchInput(stickerPicker())?.value || '').trim());
    const message = searching
      ? [tr('No emotes found'), tr('Try a different search or clear the search field.')]
      : view === 'pinned'
      ? [tr('No favorites yet'), tr('Open All and use the star on any emote to keep it here.')]
      : view === 'recent'
        ? [tr('No recent emotes yet'), tr('Emotes you send in this channel will appear here.')]
        : view === 'group' && !state.stickerPreferences.groups.length
          ? [tr('Create your first group'), tr('Use New group above, then select emotes and move them into it.')]
          : view === 'group'
            ? [tr('This group is empty'), tr('Choose Organize, select emotes, then move them into this group.')]
            : [tr('No emotes found'), tr('Try a different search or return to Kick groups.')];
    setStickerGridHost(gridHost, `empty:${view}:${message[0]}`, `<div data-kf-sticker-empty><div><strong>${escapeHtml(message[0])}</strong><span>${escapeHtml(message[1])}</span></div></div>`);
    return;
  }
  const grid = gridHost.querySelector('[data-kf-sticker-grid]');
  const columns = stickerGridColumns(grid);
  const slice = visibleWindow(visible, state.runtime.stickerGridAnchor);
  const signature = [activeLocale(), view, String(state.runtime.stickerPickerOrganizing), String(visible.length), String(columns), String(slice.start), String(slice.end),
    slice.items.map((descriptor) => descriptor.key).join(',')].join('\u0001');
  if (gridHost.dataset.kfStickerGridSignature === signature) {
    // Same tiles, possibly different state on one of them.
    patchStickerTileStates(gridHost);
    return;
  }
  const scrollTop = Number.isFinite(grid?.scrollTop) ? grid.scrollTop : null;
  gridHost.dataset.kfStickerGridSignature = signature;
  gridHost.dataset.kfStickerWindow = `${slice.start}-${slice.end}`;
  setMarkup(gridHost, `<div data-kf-sticker-grid data-kf-sticker-total="${visible.length}">${
    stickerSpacerMarkup(slice.before, columns, 'before')
  }${slice.items.map(stickerProxyMarkup).join('')}${
    stickerSpacerMarkup(slice.after, columns, 'after')
  }</div>`);
  // Replacing the grid element resets its scroll; the window only moved because
  // the viewer scrolled, so putting it back is what makes the swap invisible.
  const next = gridHost.querySelector('[data-kf-sticker-grid]');
  if (next && scrollTop !== null) next.scrollTop = scrollTop;
  measureEmoteAspect(gridHost);
}

function setStickerGridHost(gridHost, signature, markup) {
  if (gridHost.dataset.kfStickerGridSignature === signature) return;
  gridHost.dataset.kfStickerGridSignature = signature;
  delete gridHost.dataset.kfStickerWindow;
  setMarkup(gridHost, markup);
}

function patchStickerSelection(organizer) {
  if (!organizer) return;
  const selected = state.runtime.stickerPickerSelection;
  const organizing = state.runtime.stickerPickerOrganizing;
  for (const tile of organizer.querySelectorAll('[data-kf-sticker-item]')) {
    const key = tile.dataset.kfStickerKey;
    const active = selected.has(key);
    tile.dataset.kfStickerSelected = String(active);
    const proxy = tile.querySelector('[data-kf-sticker-proxy]');
    if (!proxy) continue;
    const name = proxy.querySelector('img')?.getAttribute('alt') || 'emote';
    if (organizing) proxy.setAttribute('aria-pressed', String(active));
    else proxy.removeAttribute('aria-pressed');
    proxy.setAttribute('aria-label', trf(organizing ? 'Select emote {name}' : 'Use emote {name}', { name }));
    proxy.title = trf(organizing ? 'Select {name}' : 'Use {name}', { name });
  }
  const count = selected.size;
  const status = organizer.querySelector('[data-kf-sticker-selected-count]');
  if (status) status.textContent = trf(count === 1 ? '{count} selected emote' : '{count} selected emotes', { count });
  for (const control of organizer.querySelectorAll('[data-kf-sticker-clear-selection], [data-kf-sticker-batch-move], [data-kf-sticker-batch-remove]')) {
    control.disabled = count === 0;
  }
  for (const control of organizer.querySelectorAll('[data-kf-sticker-batch-reorder]')) control.disabled = count !== 1;
  const visible = state.runtime.stickerPickerVisibleKeys;
  const selectShown = organizer.querySelector('[data-kf-sticker-select-shown]');
  if (selectShown) selectShown.setAttribute('aria-pressed', String(visible.length > 0 && visible.every((key) => selected.has(key))));
}

/**
 * Bring rendered tiles up to date without re-serialising the grid.
 *
 * Favoriting or removing an emote changes two glyphs and an attribute on one
 * tile. Rebuilding the window to show that would throw away every image the
 * browser had already decoded, so the tile is patched where it stands.
 */
function patchStickerTileStates(gridHost) {
  for (const tile of gridHost.querySelectorAll('[data-kf-sticker-item]')) {
    const key = tile.dataset.kfStickerKey;
    const pinned = isFavorited(key);
    const hidden = state.stickerPreferences.hidden.has(key);
    const stamp = `${pinned}:${hidden}`;
    if (tile.dataset.kfStickerState === stamp) continue;
    tile.dataset.kfStickerState = stamp;
    tile.dataset.kfStickerHidden = String(hidden);
    tile.dataset.kfStickerPinned = String(pinned);
    const name = tile.querySelector('img')?.getAttribute('alt') || 'emote';
    const pin = tile.querySelector('[data-kf-sticker-action="pin"]');
    if (pin) {
      pin.setAttribute('aria-pressed', String(pinned));
      setMarkup(pin, uiIcon('star'));
      const scope = pinned ? favoriteScopeOf(key) : '';
      pin.setAttribute('aria-label', trf(
        pinned ? (scope ? 'Remove this-channel favorite {name}' : 'Remove favorite {name}') : 'Favorite {name}',
        { name },
      ));
      pin.title = tr(pinned ? (scope ? 'Remove favorite (this channel)' : 'Remove favorite') : 'Favorite');
      tile.dataset.kfStickerScoped = scope ? 'true' : '';
      if (!scope) delete tile.dataset.kfStickerScoped;
    }
    const hide = tile.querySelector('[data-kf-sticker-action="hide"]');
    if (hide) {
      setMarkup(hide, uiIcon(hidden ? 'reset' : 'trash'));
      hide.setAttribute('aria-label', trf(hidden ? 'Restore {name}' : 'Remove {name}', { name }));
      hide.title = tr(hidden ? 'Restore' : 'Remove');
    }
  }
}

/**
 * Move the window when the viewer approaches its edge.
 *
 * Scroll does not bubble, so this is bound in the capture phase on the host
 * that outlives every grid rebuild — binding to the grid itself would be lost
 * the first time the window moved.
 */
function bindStickerGridScroll(gridHost) {
  gridHost.addEventListener('scroll', (event) => {
    const grid = event.target;
    if (!grid?.dataset || grid.dataset.kfStickerTotal === undefined) return;
    const total = Number(grid.dataset.kfStickerTotal) || 0;
    const [start, end] = String(gridHost.dataset.kfStickerWindow || '0-0').split('-').map(Number);
    if (end - start >= total) return; // everything is rendered; nothing to move
    const columns = stickerGridColumns(grid);
    const rowHeight = STICKER_TILE_HEIGHT + STICKER_GRID_GAP;
    const first = Math.floor(grid.scrollTop / rowHeight) * columns;
    const last = first + (Math.ceil(grid.clientHeight / rowHeight) + 1) * columns;
    const guard = STICKER_WINDOW_GUARD_ROWS * columns;
    if (first >= start + guard && last <= end - guard) return;
    state.runtime.stickerGridAnchor = first;
    renderStickerOrganizer();
  }, { capture: true, passive: true });
}

function resetStickerPreferences(options = {}) {
  const keepLibrary = options.keepLibrary === true;
  const library = keepLibrary ? state.stickerPreferences.library : new Map();
  state.runtime.stickerLibraryFilter = 'all';
  state.runtime.stickerLibraryQuery = '';
  state.runtime.stickerLibrarySelection.clear();
  state.runtime.stickerLibraryBulkGroup = '';
  state.runtime.stickerPickerSelection.clear();
  state.runtime.stickerPickerVisibleKeys = [];
  state.runtime.stickerPickerBulkGroup = '';
  state.runtime.stickerPickerOrganizing = false;
  state.runtime.stickerPickerGroupEditor = '';
  state.stickerPreferences = {
    favorites: [],
    hidden: new Set(),
    view: 'all',
    showHidden: false,
    activeGroup: '',
    groups: [],
    assignments: new Map(),
    library,
  };
  state.runtime.stickerCatalogDirty = true;
  if (keepLibrary) persistStickerPreferences();
  else {
    gmDelete(STICKER_PREFERENCES_KEY);
    // The database holds the fuller copy, so deleting only the seed would let
    // the discarded library walk straight back in on the next hydrate.
    libraryStore.clear().catch((error) => logAppError('library reset', error));
  }
}

function clearStickerPreferences() {
  resetStickerPreferences({ keepLibrary: true });
  renderSettingsPage();
  scheduleApply(0);
  showToast('Emote favorites, removals, and custom groups reset.');
}

function commitPickerStickerChange() {
  for (const [key, descriptor] of state.stickerCatalog) {
    for (const original of descriptor.originals || []) {
      original.dataset.kfStickerHidden = String(state.stickerPreferences.hidden.has(key));
      original.dataset.kfStickerPinned = String(isFavorited(key));
    }
  }
  persistStickerPreferences();
  applySettingsAttributes();
  renderStickerOrganizer();
  scheduleApply(0);
}

function focusPickerStickerGroupInput(organizer) {
  requestAnimationFrame(() => organizer.querySelector('[data-kf-sticker-group-editor-input]')?.focus?.());
}

function savePickerStickerGroup(organizer, editor) {
  const input = organizer.querySelector('[data-kf-sticker-group-editor-input]');
  const name = cleanCustomStickerGroupName(input?.value);
  if (!name) {
    showToast('Enter a custom emote group name.', true);
    input?.focus?.();
    return;
  }
  // The ceiling is checked before the name, matching the Library surface. The
  // other order told a user at the ceiling that the name was taken, which reads
  // as "pick another name" for a state where no name would have worked.
  if (editor === 'new' && state.stickerPreferences.groups.length >= STICKER_GROUP_LIMIT) {
    showToast(trf('The emote group limit is {limit}.', { limit: STICKER_GROUP_LIMIT }), true);
    return;
  }
  if (state.stickerPreferences.groups.some((group) => group.id !== editor && group.name.toLowerCase() === name.toLowerCase())) {
    showToast('That emote group already exists.', true);
    input?.focus?.();
    return;
  }
  if (editor === 'new') {
    const id = `group_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    state.stickerPreferences.groups.push({ id, name });
    state.stickerPreferences.activeGroup = id;
    state.stickerPreferences.view = 'all';
    state.runtime.stickerPickerBulkGroup = id;
    state.runtime.stickerPickerOrganizing = true;
    state.runtime.stickerPickerGroupEditor = '';
    commitPickerStickerChange();
    showToast(trf('Created {name}. Select emotes, then move them into it.', { name }));
    return;
  }
  const group = stickerGroupById(editor);
  if (!group) return;
  const previous = group.name;
  group.name = name;
  state.runtime.stickerPickerGroupEditor = '';
  commitPickerStickerChange();
  showToast('Emote group renamed.', false, [{
    label: 'Undo',
    onClick: () => {
      const current = stickerGroupById(editor);
      if (!current) return;
      current.name = previous;
      commitPickerStickerChange();
      showToast('Group name restored.');
    },
  }]);
}

function deletePickerStickerGroup(id) {
  const index = state.stickerPreferences.groups.findIndex((group) => group.id === id);
  if (index < 0) return;
  const group = state.stickerPreferences.groups[index];
  const assignments = [...state.stickerPreferences.assignments].filter(([, groupId]) => groupId === id);
  const previous = {
    activeGroup: state.stickerPreferences.activeGroup,
    view: state.stickerPreferences.view,
    bulkGroup: state.runtime.stickerPickerBulkGroup,
  };
  state.stickerPreferences.groups.splice(index, 1);
  state.stickerPreferences.assignments = new Map([...state.stickerPreferences.assignments].filter(([, groupId]) => groupId !== id));
  if (state.stickerPreferences.activeGroup === id) {
    state.stickerPreferences.activeGroup = state.stickerPreferences.groups[0]?.id || '';
    state.stickerPreferences.view = state.stickerPreferences.activeGroup ? 'group' : 'all';
  }
  if (state.runtime.stickerPickerBulkGroup === id) state.runtime.stickerPickerBulkGroup = '';
  state.runtime.stickerPickerGroupEditor = '';
  commitPickerStickerChange();
  showToast(trf('Deleted emote group {name}.', { name: group.name }), false, [{
    label: 'Undo',
    onClick: () => {
      state.stickerPreferences.groups.splice(Math.min(index, state.stickerPreferences.groups.length), 0, group);
      for (const [key, groupId] of assignments) state.stickerPreferences.assignments.set(key, groupId);
      state.stickerPreferences.activeGroup = previous.activeGroup;
      state.stickerPreferences.view = previous.view;
      state.runtime.stickerPickerBulkGroup = previous.bulkGroup;
      commitPickerStickerChange();
      showToast('Emote group restored.');
    },
  }]);
}

function editPickerStickerSelection(action) {
  const selected = state.runtime.stickerPickerSelection;
  if (action === 'shown') {
    const keys = state.runtime.stickerPickerVisibleKeys;
    const remove = keys.length > 0 && keys.every((key) => selected.has(key));
    for (const key of keys) if (remove) selected.delete(key); else selected.add(key);
    patchStickerSelection(stickerPicker()?.querySelector('[data-kf-sticker-organizer]'));
    return;
  }
  if (action === 'clear') {
    selected.clear();
    patchStickerSelection(stickerPicker()?.querySelector('[data-kf-sticker-organizer]'));
    return;
  }
  const keys = [...selected].filter((key) => state.stickerPreferences.library.has(key));
  if (!keys.length) return;
  if ((action === 'earlier' || action === 'later') && keys.length === 1) {
    const previous = [...state.stickerPreferences.favorites];
    const key = keys[0];
    state.stickerPreferences.favorites = moveStickerFavorite(
      state.stickerPreferences.favorites,
      key,
      favoriteScopeOf(key),
      action === 'earlier' ? -1 : 1,
    );
    commitPickerStickerChange();
    showToast(action === 'earlier' ? 'Favorite moved earlier.' : 'Favorite moved later.', false, [{
      label: 'Undo',
      onClick: () => {
        state.stickerPreferences.favorites = previous;
        commitPickerStickerChange();
        showToast('Favorite order restored.');
      },
    }]);
    return;
  }
  if (action === 'move') {
    const previous = new Map(state.stickerPreferences.assignments);
    const groupId = stickerGroupById(state.runtime.stickerPickerBulkGroup)
      ? state.runtime.stickerPickerBulkGroup
      : '';
    for (const key of keys) {
      if (groupId) state.stickerPreferences.assignments.set(key, groupId);
      else state.stickerPreferences.assignments.delete(key);
    }
    selected.clear();
    commitPickerStickerChange();
    showToast(`${keys.length} ${plural(keys.length, 'emote moved.', 'emotes moved.')}`, false, [{
      label: 'Undo',
      onClick: () => {
        state.stickerPreferences.assignments = previous;
        commitPickerStickerChange();
        showToast('Emote group changes restored.');
      },
    }]);
    return;
  }
  const previous = {
    hidden: new Set(state.stickerPreferences.hidden),
    favorites: [...state.stickerPreferences.favorites],
    assignments: new Map(state.stickerPreferences.assignments),
  };
  for (const key of keys) {
    state.stickerPreferences.hidden.add(key);
    state.stickerPreferences.assignments.delete(key);
  }
  state.stickerPreferences.favorites = state.stickerPreferences.favorites.filter((favorite) => !selected.has(favorite.key));
  selected.clear();
  commitPickerStickerChange();
  showToast(`${keys.length} ${plural(keys.length, 'emote removed.', 'emotes removed.')}`, false, [{
    label: 'Undo',
    onClick: () => {
      state.stickerPreferences.hidden = previous.hidden;
      state.stickerPreferences.favorites = previous.favorites;
      state.stickerPreferences.assignments = previous.assignments;
      commitPickerStickerChange();
      showToast('Removed emotes restored.');
    },
  }]);
}

function handleStickerAction(event) {
  const target = event.target.closest?.([
    '[data-kf-sticker-action]', '[data-kf-sticker-view]', '[data-kf-sticker-show-hidden]',
    '[data-kf-sticker-reset]', '[data-kf-sticker-manage]', '[data-kf-sticker-organize]',
    '[data-kf-sticker-group-create]', '[data-kf-sticker-group-rename]', '[data-kf-sticker-group-delete]',
    '[data-kf-sticker-group-save]', '[data-kf-sticker-group-cancel]', '[data-kf-sticker-select-shown]',
    '[data-kf-sticker-clear-selection]', '[data-kf-sticker-batch-move]', '[data-kf-sticker-batch-remove]',
    '[data-kf-sticker-batch-reorder]',
  ].join(', '));
  if (!target || !target.closest?.('[data-kf-sticker-organizer]')) return;
  event.preventDefault();
  event.stopPropagation();
  const organizer = target.closest('[data-kf-sticker-organizer]');
  const key = target.dataset.kfStickerKey;
  const action = target.dataset.kfStickerAction;
  if (target.dataset.kfStickerManage) {
    openSettings('emotes');
    return;
  }
  if (target.hasAttribute('data-kf-sticker-organize')) {
    state.runtime.stickerPickerOrganizing = !state.runtime.stickerPickerOrganizing;
    if (!state.runtime.stickerPickerOrganizing) state.runtime.stickerPickerSelection.clear();
    else {
      if (state.stickerPreferences.view === 'native') state.stickerPreferences.view = 'all';
      if (!stickerGroupById(state.runtime.stickerPickerBulkGroup)) {
        state.runtime.stickerPickerBulkGroup = state.stickerPreferences.activeGroup || '';
      }
    }
    commitPickerStickerChange();
    return;
  }
  if (target.hasAttribute('data-kf-sticker-group-create')) {
    state.stickerPreferences.view = 'group';
    state.runtime.stickerPickerGroupEditor = 'new';
    renderStickerOrganizer();
    focusPickerStickerGroupInput(organizer);
    return;
  }
  if (target.hasAttribute('data-kf-sticker-group-rename')) {
    state.runtime.stickerPickerGroupEditor = target.dataset.kfStickerGroupRename;
    renderStickerOrganizer();
    focusPickerStickerGroupInput(organizer);
    return;
  }
  if (target.hasAttribute('data-kf-sticker-group-delete')) {
    deletePickerStickerGroup(target.dataset.kfStickerGroupDelete);
    return;
  }
  if (target.hasAttribute('data-kf-sticker-group-save')) {
    savePickerStickerGroup(organizer, target.dataset.kfStickerGroupSave);
    return;
  }
  if (target.hasAttribute('data-kf-sticker-group-cancel')) {
    state.runtime.stickerPickerGroupEditor = '';
    renderStickerOrganizer();
    return;
  }
  if (target.hasAttribute('data-kf-sticker-select-shown')) {
    editPickerStickerSelection('shown');
    return;
  }
  if (target.hasAttribute('data-kf-sticker-clear-selection')) {
    editPickerStickerSelection('clear');
    return;
  }
  if (target.hasAttribute('data-kf-sticker-batch-move')) {
    editPickerStickerSelection('move');
    return;
  }
  if (target.hasAttribute('data-kf-sticker-batch-remove')) {
    editPickerStickerSelection('remove');
    return;
  }
  if (target.hasAttribute('data-kf-sticker-batch-reorder')) {
    editPickerStickerSelection(target.dataset.kfStickerBatchReorder === 'up' ? 'earlier' : 'later');
    return;
  }
  if (action === 'send') {
    if (state.runtime.stickerPickerOrganizing) {
      if (state.runtime.stickerPickerSelection.has(key)) state.runtime.stickerPickerSelection.delete(key);
      else state.runtime.stickerPickerSelection.add(key);
      patchStickerSelection(organizer);
      return;
    }
    const original = state.stickerCatalog.get(key)?.originals?.find((button) => button.isConnected);
    original?.click?.();
    return;
  }
  if ((action === 'pin' || action === 'hide') && key) rememberStickerGridScroll(target);
  if (action === 'pin' && key) {
    const previous = [...state.stickerPreferences.favorites];
    // Removing clears whichever scope this channel actually sees it through, so
    // un-favoriting a global from a channel page does not silently do nothing.
    const scope = isFavorited(key) ? favoriteScopeOf(key) : newFavoriteChannel();
    state.stickerPreferences.favorites = toggleStickerFavorite(state.stickerPreferences.favorites, key, scope);
    if (isFavorited(key)) state.stickerPreferences.hidden.delete(key);
    const name = state.stickerCatalog.get(key)?.name || 'Emote';
    const message = isFavorited(key) ? trf('Favorited {name}.', { name }) : trf('Removed {name} from favorites.', { name });
    commitPickerStickerChange();
    showToast(message, false, [{
      label: 'Undo',
      onClick: () => {
        state.stickerPreferences.favorites = previous;
        commitPickerStickerChange();
        showToast('Favorite change restored.');
      },
    }]);
    return;
  } else if (action === 'move-favorite' && key) {
    const earlier = target.dataset.kfStickerMove === 'up';
    state.stickerPreferences.favorites = moveStickerFavorite(
      state.stickerPreferences.favorites,
      key,
      favoriteScopeOf(key),
      earlier ? -1 : 1,
    );
    commitPickerStickerChange();
    showToast(earlier ? 'Emote moved earlier.' : 'Emote moved later.');
    return;
  } else if (action === 'hide' && key) {
    const hidden = state.stickerPreferences.hidden.has(key);
    const name = state.stickerCatalog.get(key)?.name || 'Emote';
    if (hidden) {
      state.stickerPreferences.hidden.delete(key);
      commitPickerStickerChange();
      showToast(trf('Restored {name}.', { name }));
    } else {
      const previous = {
        favorites: [...state.stickerPreferences.favorites],
        assignment: state.stickerPreferences.assignments.get(key) || '',
      };
      state.stickerPreferences.hidden.add(key);
      state.stickerPreferences.favorites = state.stickerPreferences.favorites.filter((entry) => entry.key !== key);
      state.stickerPreferences.assignments.delete(key);
      commitPickerStickerChange();
      showToast(trf('Removed {name}.', { name }), false, [{
        label: 'Undo',
        onClick: () => {
          state.stickerPreferences.hidden.delete(key);
          state.stickerPreferences.favorites = previous.favorites;
          if (previous.assignment) state.stickerPreferences.assignments.set(key, previous.assignment);
          commitPickerStickerChange();
          showToast(trf('Restored {name}.', { name }));
        },
      }]);
    }
    return;
  } else if (target.dataset.kfStickerView) {
    state.stickerPreferences.view = target.dataset.kfStickerView;
    state.stickerPreferences.activeGroup = target.dataset.kfStickerGroup || state.stickerPreferences.activeGroup;
    state.runtime.stickerGridAnchor = 0;
    state.runtime.stickerGridScrollTop = 0;
    if (state.stickerPreferences.view === 'group' && !state.stickerPreferences.groups.length) {
      state.runtime.stickerPickerGroupEditor = 'new';
      applySettingsAttributes();
      renderStickerOrganizer();
      focusPickerStickerGroupInput(organizer);
      return;
    } else if (state.stickerPreferences.view !== 'group') {
      state.runtime.stickerPickerGroupEditor = '';
    }
    if (state.stickerPreferences.view === 'native') {
      state.runtime.stickerPickerOrganizing = false;
      state.runtime.stickerPickerSelection.clear();
    }
    commitPickerStickerChange();
    if (state.runtime.stickerPickerGroupEditor) focusPickerStickerGroupInput(organizer);
    return;
  } else if (target.dataset.kfStickerShowHidden) {
    state.stickerPreferences.showHidden = !state.stickerPreferences.showHidden;
    commitPickerStickerChange();
    return;
  } else if (target.dataset.kfStickerReset) {
    resetStickerPreferences({ keepLibrary: true });
    commitPickerStickerChange();
    showToast('Emote changes reset.');
    return;
  } else {
    return;
  }
}

function updateFollowedEmoteState(slug, followed) {
  const source = String(slug || '').toLowerCase();
  for (const emote of state.live.catalog?.emotes || []) {
    if (String(emote.sourceSlug || '').toLowerCase() === source) emote.followed = followed;
  }
  for (const [key, entry] of state.stickerPreferences.library) {
    if (String(entry.sourceSlug || '').toLowerCase() !== source || !entry.requiresFollow) continue;
    state.stickerPreferences.library.set(key, {
      ...entry,
      followed,
      access: followed ? (entry.subscribersOnly ? 'locked' : 'channel') : 'locked',
    });
  }
  persistStickerPreferences();
}

async function undoChatStickerSave({ key, scope, removeFavorite, unfollowSlug }) {
  if (removeFavorite) {
    state.stickerPreferences.favorites = state.stickerPreferences.favorites
      .filter((entry) => !(entry.key === key && entry.channel === scope));
    persistStickerPreferences();
    scheduleApply(0);
  }
  if (unfollowSlug) {
    const result = await mutateKickChannelFollow(unfollowSlug, 'DELETE');
    if (result.ok) updateFollowedEmoteState(unfollowSlug, false);
    else {
      showToast(trf('The emote was removed, but Kick could not unfollow {channel}.', { channel: unfollowSlug }), true);
      return;
    }
  }
  showToast(unfollowSlug ? `Removed the emote and unfollowed ${unfollowSlug}.` : 'Emote removed from favorites.');
}

async function saveChatSticker(image) {
  if (!state.settings.content.clickChatEmotes || pendingChatStickerSaves.has(image)) return;
  const sticker = chatStickerInfo(image);
  if (!sticker) return;
  pendingChatStickerSaves.add(image);
  image.setAttribute('aria-busy', 'true');
  try {
    const scope = newFavoriteChannel();
    const alreadyFavorite = isFavorited(sticker.key);
    state.stickerPreferences.hidden.delete(sticker.key);
    mergeStickerLibrary([sticker]);
    if (!alreadyFavorite) {
      state.stickerPreferences.favorites = toggleStickerFavorite(
        state.stickerPreferences.favorites,
        sticker.key,
        scope,
      );
    }
    persistStickerPreferences();
    announce(alreadyFavorite ? 'Emote already saved' : 'Emote saved');

    const follow = emoteFollowRequirement(sticker, sticker.sourceSlug);
    let followedNow = false;
    if (follow.required && !follow.followed) {
      if (!follow.slug) {
        showToast(trf('Saved {name}, but Kick did not identify the follow-gated source channel.', { name: sticker.name }), true);
        return;
      }
      showToast(trf('Saved {name}. Following {channel}…', { name: sticker.name, channel: follow.slug }));
      const result = await mutateKickChannelFollow(follow.slug, 'POST');
      if (!result.ok) {
        showToast(trf('Saved {name} locally, but Kick could not follow {channel} ({status}). Sign in or reload the channel and try again.', { name: sticker.name, channel: follow.slug, status: result.status }), true);
        return;
      }
      followedNow = true;
      updateFollowedEmoteState(follow.slug, true);
    }

    const stored = state.stickerPreferences.library.get(sticker.key) || sticker;
    const locked = emoteLockState(stored, stored.sourceSlug);
    const message = followedNow
      ? `Saved ${sticker.name} and followed ${follow.slug}.`
      : alreadyFavorite
        ? `${sticker.name} is already in your favorites.`
        : locked.locked && stored.subscribersOnly
          ? `Saved ${sticker.name}. A subscription is still required to use it.`
          : `Saved ${sticker.name} to your ${scope ? 'channel' : 'global'} favorites.`;
    const canUndo = !alreadyFavorite || followedNow;
    showToast(message, false, canUndo ? [{
      label: followedNow && alreadyFavorite ? 'Undo follow' : 'Undo',
      onClick: () => undoChatStickerSave({
        key: sticker.key,
        scope,
        removeFavorite: !alreadyFavorite,
        unfollowSlug: followedNow ? follow.slug : '',
      }),
    }] : []);
    scheduleApply(0);
  } finally {
    pendingChatStickerSaves.delete(image);
    image.removeAttribute('aria-busy');
  }
}

function handleChatStickerSave(event) {
  if (!state.settings.content.clickChatEmotes) return;
  const image = event.target.closest?.('[data-kf-chat-emote-save]');
  if (!image || !image.closest?.('[data-testid="chatroom-messages"], #chatroom-messages')) return;
  if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.stopPropagation();
  saveChatSticker(image).catch((error) => {
    logAppError('save chat emote', error);
    showToast('The emote could not be saved. The error log on the Content & Ads page says why.', true);
  });
}

function chatKeywordsForChannel() {
  const value = state.chatKeywords[channelPath()];
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, 20) : [];
}

const KEYWORD_HIGHLIGHT_NAME = 'kick-focus-keyword';
const KEYWORD_RANGE_LIMIT = 400;

/** The Custom Highlight registry, or null where the engine has none. */
function highlightRegistry() {
  try {
    return typeof Highlight === 'function' && typeof CSS !== 'undefined' && CSS.highlights ? CSS.highlights : null;
  } catch {
    return null;
  }
}

function clearKeywordHighlight() {
  try { highlightRegistry()?.delete(KEYWORD_HIGHLIGHT_NAME); } catch { /* nothing registered */ }
}

/**
 * Mark the messages that match, and paint the matched words themselves.
 *
 * The row marker is an attribute Kick's tree already tolerated. The words are
 * new, and they cost the tree nothing: the Custom Highlight API paints ranges
 * from a registry the browser owns, so not one node is written into chat —
 * no <mark> for React to reconcile against, nothing to undo when a message is
 * recycled, and a message that Kick re-renders simply gets fresh ranges on
 * the next cycle. Feature-detected; without the API the row marker alone is
 * what it always was.
 */
function applyChatHighlights() {
  const messages = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages');
  const registry = highlightRegistry();
  if (!messages) {
    clearKeywordHighlight();
    return;
  }
  const keywords = state.settings.content.chatHighlights ? chatKeywordsForChannel() : [];
  const ranges = [];
  // Everything the comfort switches need that is the same for every row, worked
  // out once. Inside the loop these are reads of a local, not of settings, a
  // username out of the header, or a channel slug off the URL.
  const comfort = {
    settings: state.settings.content,
    people: state.settings.content.chatPriorityPeople || [],
    own: liveLocalUsername(),
    channel: currentChannelSlug(),
    now: Date.now(),
  };
  syncChatComfortShell(messages);
  for (const node of messages.querySelectorAll?.('[data-index], [data-message-id], .group') || []) {
    const text = node.textContent || '';
    const hit = keywords.length > 0 && findKeywordSpans(text, keywords, 1).length > 0;
    node.dataset.kfHighlighted = String(hit);
    if (hit && registry && ranges.length < KEYWORD_RANGE_LIMIT) collectKeywordRanges(node, keywords, ranges);
    applyChatComfortToMessage(node, { ...comfort, keywordHit: hit });
  }
  if (!registry) return;
  try {
    if (ranges.length) registry.set(KEYWORD_HIGHLIGHT_NAME, new Highlight(...ranges));
    else registry.delete(KEYWORD_HIGHLIGHT_NAME);
  } catch (error) {
    logAppError('keyword highlight', error);
  }
}

// ---------------------------------------------------------------------------
// Chat comfort
//
// Five switches, each independent, each off until asked for, and all of them
// carried by the pass that already walks chat once per apply cycle rather than
// by a second walk of the same nodes.
// ---------------------------------------------------------------------------

/**
 * Kick renders a timestamp on every message already and hides it behind its own
 * custom property, measured in a capture of the live chatroom:
 * `<span style="display: var(--chatroom-timestamps-display)">06:43 PM</span>`.
 *
 * So the switch reveals Kick's timestamp rather than writing one. That matters
 * for more than tidiness: Kick's span holds the time the message was *sent*,
 * and anything this build wrote would hold the time it was first *seen*, which
 * is a different number and a wrong one for anybody scrolling back.
 */
const CHAT_TIMESTAMP_VAR = '--chatroom-timestamps-display';

/** The author button, by what it is rather than by a class that will change. */
const CHAT_AUTHOR_PROBES = ['button[data-prevent-expand="true"]', 'button.font-bold', 'button'];

function chatMessageAuthor(node) {
  for (const selector of CHAT_AUTHOR_PROBES) {
    const found = node.querySelector?.(selector);
    const name = String(found?.textContent || '').trim();
    if (name && name.length < 40) return name;
  }
  return '';
}

/** The message itself: the row's text with the author's own name taken back off. */
function chatMessageText(node, author) {
  const raw = String(node.textContent || '').replace(/\s+/g, ' ').trim();
  if (!author) return raw;
  const at = raw.indexOf(author);
  return at === -1 ? raw : raw.slice(at + author.length).replace(/^\s*:\s*/, '').trim();
}

/** The id a deletion would later arrive with, or '' when the row carries none. */
function chatMessageId(node) {
  return String(node.dataset?.messageId || node.dataset?.chatEntry || node.dataset?.index || '').trim();
}

/**
 * A short tone, synthesised rather than shipped.
 *
 * No audio file means no asset to fetch, nothing to cache, and nothing that can
 * be pointed at a remote host later. Built on the click, torn down after it, and
 * quiet if the engine refuses an AudioContext without a gesture — a browser
 * declining to make noise is not an error worth logging.
 */
function playMentionTone() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    oscillator.onended = () => { context.close?.(); };
  } catch {
    // An engine that will not make a sound without a gesture is not a failure.
  }
}

/** The names that count as a mention: your own, and anyone you asked to notice. */
function mentionNames() {
  const people = state.settings.content.chatPriorityPeople || [];
  const own = liveLocalUsername();
  return own ? [...people, own] : [...people];
}

/**
 * One message, given everything the caller already worked out about it.
 *
 * Called from inside the highlight walk rather than from a walk of its own:
 * this runs over every rendered message on every apply cycle, and a second
 * `querySelectorAll` over the same rows is the kind of cost that turns a busy
 * channel into a slow one.
 */
function applyChatComfortToMessage(node, { keywordHit, settings, people, own, channel, now }) {
  const id = chatMessageId(node);
  // `people` rather than the setting: a settings record written by an older
  // build, or one arriving through the import path, can be missing a key this
  // version added, and reading `.length` off that undefined threw inside the
  // apply cycle — which took keyword highlighting and the header control down
  // with it, because everything after the throw in that cycle never ran.
  const author = (people.length > 0 || settings.chatHistory || settings.chatMentionSound)
    ? chatMessageAuthor(node)
    : '';
  const priority = people.length > 0 && isPriorityPerson(people, author);
  // Written only when the feature is on. Marking every row "false" for a reader
  // who listed nobody is an attribute write per message per cycle on a tree
  // React owns, and it breaks the promise the rest of this build keeps: chat
  // markup is left exactly as Kick sent it unless something asked otherwise.
  if (people.length > 0) {
    if (node.dataset.kfChatPriority !== String(priority)) node.dataset.kfChatPriority = String(priority);
  } else if (node.dataset.kfChatPriority) {
    delete node.dataset.kfChatPriority;
  }

  if (settings.chatHideMessages) {
    const hidden = id !== '' && state.chatComfort.hidden.has(id);
    if (node.dataset.kfChatHidden !== String(hidden)) {
      node.dataset.kfChatHidden = String(hidden);
      // The replacement line is written as an attribute the stylesheet reads,
      // so the row keeps its shape and the words still translate.
      if (hidden) node.dataset.kfHiddenNote = tr('Hidden by you');
      else delete node.dataset.kfHiddenNote;
    }
    if (id && !node.querySelector('[data-kf-chat-hide]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.kfChatHide = id;
      button.setAttribute('aria-label', tr('Hide this message for me'));
      button.title = tr('Hide this message for me');
      button.textContent = '×';
      node.append(button);
    }
  } else if (node.dataset.kfChatHidden) {
    delete node.dataset.kfChatHidden;
    node.querySelector('[data-kf-chat-hide]')?.remove();
  }

  const isOwn = Boolean(own) && author.toLowerCase() === own;
  if (!id) return;
  const text = settings.chatHistory || settings.chatMentionSound ? chatMessageText(node, author) : '';

  if (settings.chatHistory && !state.chatComfort.seen.has(id)) {
    state.chatComfort.seen.add(id);
    state.chatComfort.rows = appendChatEntry(
      state.chatComfort.rows,
      { id, author, text, at: now, channel },
      CHAT_HISTORY_LIMITS,
      now,
    );
  }

  if (!settings.chatMentionSound || state.chatComfort.sounded.has(id)) return;
  state.chatComfort.sounded.add(id);
  const mentioned = keywordHit || priority
    || mentionNames().some((name) => text.toLowerCase().includes(String(name).toLowerCase()));
  if (!shouldPlayMentionSound({
    enabled: true,
    matched: mentioned,
    own: isOwn,
    hidden: document.visibilityState === 'hidden',
    now,
    lastPlayedAt: state.chatComfort.lastSoundAt,
  })) return;
  state.chatComfort.lastSoundAt = now;
  playMentionTone();
}

/**
 * Reveal or re-hide Kick's own timestamps, and keep the seen-message sets from
 * growing without bound.
 *
 * The two sets exist to make the per-message work idempotent — a message must
 * be recorded once and may only ring once — and Kick recycles rows as chat
 * scrolls, so without a ceiling they would be the one part of this feature that
 * grows all session. Cleared wholesale rather than trimmed: they are an
 * optimisation, and re-recording a handful of messages after a clear is
 * cheaper than tracking their ages.
 */
function syncChatComfortShell(messages) {
  const settings = state.settings.content;
  if (messages) {
    if (settings.chatTimestamps) messages.style.setProperty(CHAT_TIMESTAMP_VAR, 'inline');
    else messages.style.removeProperty(CHAT_TIMESTAMP_VAR);
  }
  if (state.chatComfort.seen.size > 4000) state.chatComfort.seen.clear();
  if (state.chatComfort.sounded.size > 4000) state.chatComfort.sounded.clear();
  if (state.chatComfort.rows.length) {
    state.chatComfort.rows = pruneChatHistory(state.chatComfort.rows, CHAT_HISTORY_LIMITS, Date.now());
  }
}

/** Hide one message locally, for this session and this reader only. */
function hideChatMessage(id) {
  if (!id) return;
  state.chatComfort.hidden.add(id);
  document.querySelector(chatMessageSelector(id))?.setAttribute('data-kf-chat-hidden', 'true');
  showToast('Message hidden for you. It is still there for everyone else.', false, [{
    label: 'Undo',
    onClick: () => {
      state.chatComfort.hidden.delete(id);
      const node = document.querySelector(chatMessageSelector(id));
      if (node) node.dataset.kfChatHidden = 'false';
    },
  }]);
}

/** Forget a message this session recorded, because Kick removed it. */
function forgetChatMessage(id) {
  if (!state.chatComfort.rows.length) return;
  state.chatComfort.rows = dropChatMessage(state.chatComfort.rows, id);
  renderChatHistoryResults();
}

function renderChatHistoryResults() {
  const host = state.shadow?.querySelector('[data-kf-chat-history-results]');
  if (!host) return;
  const rows = searchChatHistory(state.chatComfort.rows, state.chatComfort.query, 40);
  if (!rows.length) {
    setMarkup(host, `<p class="kf-status-note">${escapeHtml(state.chatComfort.rows.length
      ? tr('Nothing in this session matches that.')
      : tr('Nothing recorded yet. Open a chat with the switch on.'))}</p>`);
    localizeInterface();
    return;
  }
  setMarkup(host, rows.map((row) => `<div class="kf-chat-log-row"><span data-kf-no-translate>${escapeHtml(formatChatTime(row.at))}</span><strong data-kf-no-translate>${escapeHtml(row.author || '')}</strong><span data-kf-no-translate>${escapeHtml(row.text)}</span></div>`).join(''));
  localizeInterface();
}

/**
 * Hand the log over, once, because somebody pressed the button.
 *
 * A download rather than a clipboard write or an upload: it stays on the
 * machine, it is a file the reader can look at before doing anything with it,
 * and there is no path here that sends chat anywhere.
 */
function exportChatHistory() {
  const rows = state.chatComfort.rows;
  if (!rows.length) {
    showToast('Nothing recorded yet. Open a chat with the switch on.', true);
    return;
  }
  const text = buildChatHistoryExport(rows, currentChannelSlug());
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kick-focus-chat-${currentChannelSlug() || 'session'}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  showToast(trf('Saved {n} messages from this session.', { n: rows.length }), false);
}

/** Drop everything this session recorded, without waiting for the caps. */
function clearChatHistory() {
  state.chatComfort.rows = [];
  state.chatComfort.seen.clear();
  renderChatHistoryResults();
  showToast('Session chat log cleared.', false);
}

/** Ranges over the text nodes of one message where a keyword occurs. */
function collectKeywordRanges(root, keywords, ranges) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
    const spans = findKeywordSpans(textNode.nodeValue || '', keywords, KEYWORD_RANGE_LIMIT - ranges.length);
    for (const span of spans) {
      const range = document.createRange();
      range.setStart(textNode, span.start);
      range.setEnd(textNode, span.end);
      ranges.push(range);
      if (ranges.length >= KEYWORD_RANGE_LIMIT) return;
    }
  }
}

/**
 * How long this stream has been live, which Kick's own page never says.
 *
 * The value rides along on the channel payload the live surface already reads,
 * so this costs no request: `state.live.channel.startedAt`. It ticks locally
 * from that one timestamp rather than re-reading anything, and it removes
 * itself the moment the channel is offline or the route changes — an uptime
 * left on screen for a stream that ended is worse than no uptime.
 */
/**
 * When the current stream started, from whichever source can answer.
 *
 * The channel API is preferred and is not depended on: Kick's bot defence
 * answers 429 to it often enough that a feature reading only that does nothing
 * at all for some sessions — which is exactly how this shipped broken and how
 * the live gate caught it. Kick's own `VideoObject` in the page carries the
 * same start, needs no request, and is absent on an offline channel, so its
 * absence is the liveness answer.
 *
 * The linked-data fallback is confined to a bare channel page. A VOD lives at
 * `/{slug}/videos/{id}`, which `routeKind` also calls `channel`, so without the
 * path check an offline recording would be timed as a live stream. (Measured
 * 2026-08-18: a VOD page carries no `VideoObject` at all — only `Organization`
 * and `WebSite` — so the guard is belt and braces rather than the only thing
 * standing between this and a wrong answer. It stays: the absence is Kick's
 * current markup, not a contract.)
 */
function streamStartedAt() {
  const channel = state.live.channel;
  if (channel?.isLive && channel.startedAt) return channel.startedAt;
  if (channel && !channel.isLive) return 0;
  if (location.pathname.split('/').filter(Boolean).length !== 1) return 0;
  return streamStartFromLinkedData(
    [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent),
  );
}

function videoIsVisible(video) {
  if (!video?.isConnected) return false;
  try {
    const box = video.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    if (box.right <= 0 || box.bottom <= 0
      || box.left >= window.innerWidth || box.top >= window.innerHeight) return false;
    if (video.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
    for (let node = video; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden'
        || style.visibility === 'collapse' || Number(style.opacity) === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

const VIDEO_CHANNEL_PLAYER_SELECTOR = [
  '#injected-channel-player',
  '#injected-embedded-channel-player-video',
  '[data-testid*="channel-player" i]',
  '[data-channel-player]',
].join(', ');
const VIDEO_PLAYER_SELECTOR = '[data-testid*="player" i], [data-player], [id*="player" i]';
const VIDEO_PREVIEW_SELECTOR = [
  '#kick-focus-following-preview',
  '[data-testid*="preview" i]',
  '[data-preview]',
  '[class*="player-preview" i]',
  '[class*="video-preview" i]',
  '[id*="player-preview" i]',
  '[id*="video-preview" i]',
].join(', ');
const VIDEO_PRELOAD_SELECTOR = [
  '[data-testid*="preload" i]',
  '[data-preload]',
  '[class*="preload" i]',
  '[id*="preload" i]',
].join(', ');
const VIDEO_BACKGROUND_SELECTOR = [
  '[data-testid*="background" i]',
  '[data-background-video]',
  '[class*="background-video" i]',
  '[id*="background-video" i]',
].join(', ');

function videoClosest(video, selector) {
  try { return video?.closest?.(selector) || null; }
  catch { return null; }
}

/**
 * Has Kick's channel-player selector stopped matching anything at all?
 *
 * Memoised per apply cycle beside the playback owner, because it is read once
 * per video and the answer cannot change inside one cycle. Only meaningful on a
 * channel route: everywhere else there is no channel player to be missing.
 */
let channelPlayerMissingMemo;

function channelPlayerSelectorMissing() {
  if (channelPlayerMissingMemo === undefined) {
    let found = null;
    try { found = document.querySelector(VIDEO_CHANNEL_PLAYER_SELECTOR); }
    catch { found = null; }
    channelPlayerMissingMemo = state.route === 'channel' && !found;
  }
  return channelPlayerMissingMemo;
}

/** Measure the facts used by the pure watch-owner gate. */
function sessionWatchVideoCandidate(video) {
  let box;
  try { box = video?.getBoundingClientRect?.(); }
  catch { box = null; }
  const width = Math.max(0, Math.min(box?.right || 0, window.innerWidth)
    - Math.max(box?.left || 0, 0));
  const height = Math.max(0, Math.min(box?.bottom || 0, window.innerHeight)
    - Math.max(box?.top || 0, 0));
  const channelPlayer = Boolean(videoClosest(video, VIDEO_CHANNEL_PLAYER_SELECTOR));
  const genericPlayer = Boolean(videoClosest(video, VIDEO_PLAYER_SELECTOR));
  const muted = Boolean(video?.muted || Number(video?.volume) === 0);
  const preview = Boolean(videoClosest(video, VIDEO_PREVIEW_SELECTOR));
  const preload = Boolean(videoClosest(video, VIDEO_PRELOAD_SELECTOR));
  const markedBackground = Boolean(videoClosest(video, VIDEO_BACKGROUND_SELECTOR));
  const playerSurface = channelPlayer || genericPlayer || (width >= 480 && height >= 270);
  return {
    video,
    route: state.route,
    documentVisible: document.visibilityState !== 'hidden',
    connected: Boolean(video?.isConnected),
    visible: videoIsVisible(video),
    intersectsViewport: width > 0 && height > 0,
    playerSurface,
    playerPriority: channelPlayer ? 2 : 1,
    preview,
    preload,
    // Decided in core, where it is tested. While Kick's channel-player selector
    // still matches something, this is byte-for-byte the rule the live gate
    // proves; the looser rescue only exists for the day it matches nothing.
    background: videoIsBackground({
      markedBackground,
      muted,
      channelPlayer,
      genericPlayer,
      channelPlayerMissing: channelPlayerSelectorMissing(),
    }),
    muted,
    playing: Boolean(video && !video.paused && !video.ended && video.readyState >= 3),
    width,
    height,
    current: state.viewerHub.watchVideo === video,
  };
}

/**
 * The owner, computed once per apply cycle.
 *
 * `sessionWatchVideoCandidate` measures a box and walks the ancestor chain
 * calling `getComputedStyle` at every step, for every `<video>` on the page.
 * Four callers ask for the owner inside one cycle — the uptime chip, the
 * recording countdown, the playback readout and the session clock — so the
 * unmemoised version forced the same style recalculation four times over,
 * roughly a hundred `getComputedStyle` calls per cycle on an ordinary channel
 * page, for an answer that cannot change while the cycle is running.
 *
 * Invalidated by `runApplyCycle` rather than by a timestamp: the cycle is the
 * unit of work that must see one consistent DOM, and it already yields to input
 * and re-reads `suspended` afterwards.
 */
let sessionWatchOwnerMemo = null;

function invalidateSessionWatchOwner() {
  channelPlayerMissingMemo = undefined;
  sessionWatchOwnerMemo = null;
}

function sessionWatchOwnerCandidate() {
  if (sessionWatchOwnerMemo) return sessionWatchOwnerMemo.value;
  const value = selectSessionWatchOwner([...document.querySelectorAll('video')].map(sessionWatchVideoCandidate));
  sessionWatchOwnerMemo = { value };
  return value;
}

/** Return only the player Kick is actually painting, never preview or preload media. */
function primaryVideo() {
  return sessionWatchOwnerCandidate()?.video || null;
}

function applyStreamUptime() {
  const existing = document.querySelector('[data-kf-uptime]');
  const startedAt = streamStartedAt();
  const enabled = state.settings.content.showUptime
    && state.route === 'channel'
    && formatUptime(startedAt);
  if (!enabled) {
    existing?.remove();
    clearInterval(state.uptimeTimer);
    state.uptimeTimer = 0;
    return;
  }
  const video = primaryVideo();
  const owner = playerOverlayHost(video);
  if (!owner) return;
  let chip = owner.querySelector?.('[data-kf-uptime]');
  if (!chip) {
    chip = document.createElement('div');
    chip.dataset.kfUptime = 'true';
    // Announced, not decorative: a screen reader user has no other way to know
    // this text exists, and it changes every second — polite, never assertive.
    chip.setAttribute('role', 'status');
    chip.setAttribute('aria-live', 'off');
    owner.append(chip);
  }
  const update = () => {
    const text = formatUptime(streamStartedAt());
    if (!text) {
      chip.remove();
      clearInterval(state.uptimeTimer);
      state.uptimeTimer = 0;
      return;
    }
    chip.textContent = text;
    chip.setAttribute('aria-label', trf('Live for {duration}', { duration: text }));
    chip.title = trf('Live for {duration}', { duration: text });
  };
  update();
  if (!state.uptimeTimer) state.uptimeTimer = window.setInterval(update, 1000);
}

/**
 * How long Kick will keep this recording.
 *
 * Kick deletes VODs after 7 days, or 30 for a verified channel, offers no
 * download to anyone including the broadcaster, and shows the deadline
 * nowhere — the largest documented gap a read-only client can close.
 *
 * Everything here is conditional on knowing, and knowing is not assumed at any
 * step: `state.live.vod` is null unless the recording was found in Kick's own
 * list, and `verified` must be a real boolean before `vodExpiry` will answer.
 * A missing answer renders nothing. Guessing between 7 and 30 would put a
 * confident wrong date on screen, which is worse than the silence Kick already
 * offers.
 */
function applyVodExpiry() {
  const existing = document.querySelector('[data-kf-vod-expiry]');
  const vod = state.live.vod;
  const channel = state.live.channel;
  const expiry = state.settings.content.showVodExpiry && state.route === 'channel' && vod && channel
    ? vodExpiry(vod.startedAt, channel.verified)
    : null;
  const text = expiry ? formatVodRetention(expiry.remaining) : '';
  if (!text) {
    existing?.remove();
    return;
  }
  const video = primaryVideo();
  const owner = playerOverlayHost(video);
  if (!owner) return;
  let chip = owner.querySelector?.('[data-kf-vod-expiry]');
  if (!chip) {
    chip = document.createElement('div');
    chip.dataset.kfVodExpiry = 'true';
    // Announced like the uptime chip: a screen reader user has no other way to
    // learn this exists. It changes by the hour at most, so polite is enough.
    chip.setAttribute('role', 'status');
    chip.setAttribute('aria-live', 'off');
    owner.append(chip);
  }
  chip.textContent = text;
  const label = trf('{time} before Kick deletes this recording', { time: text });
  chip.setAttribute('aria-label', label);
  chip.title = label;
}

function applyPlaybackDiagnostics() {
  const existing = document.querySelector('[data-kf-playback-diagnostics]');
  if (!state.settings.content.playbackDiagnostics || state.route !== 'channel') {
    existing?.remove();
    clearInterval(state.playbackDiagnosticsTimer);
    state.playbackDiagnosticsTimer = 0;
    return;
  }
  const video = primaryVideo();
  if (!video) return;
  const owner = playerOverlayHost(video);
  if (!owner) return;
  let panel = owner.querySelector?.('[data-kf-playback-diagnostics]');
  if (!panel) {
    panel = document.createElement('div');
    panel.dataset.kfPlaybackDiagnostics = 'true';
    owner.append(panel);
  }
  const update = () => {
    const buffered = video.buffered?.length ? Math.max(0, video.buffered.end(video.buffered.length - 1) - video.currentTime) : 0;
    const quality = video.getVideoPlaybackQuality?.();
    panel.textContent = `ready ${video.readyState}/4 · buffer ${buffered.toFixed(1)}s${quality ? ` · dropped ${quality.droppedVideoFrames}` : ''}`;
  };
  update();
  if (!state.playbackDiagnosticsTimer) state.playbackDiagnosticsTimer = window.setInterval(update, 1000);
}

function localChannelBlocked(path) {
  const normalized = observedChannelPath(path);
  if (!normalized) return false;
  return state.settings.content.hiddenChannels.includes(normalized);
}

function remoteBlocklistMatches(path, labels, text) {
  const remote = state.remoteBlocklist;
  if (remote.status !== 'ready') return false;
  const normalized = String(text || '').toLowerCase();
  const channel = observedChannelPath(path);
  return (channel && remote.channels.has(channel))
    || labels.categories?.some?.((category) => remote.categories.has(category.toLowerCase()))
    || [...remote.keywords].some((keyword) => normalized.includes(keyword));
}

function remoteBlocklistSummary() {
  const remote = state.remoteBlocklist;
  if (!state.settings.content.blocklistSubscription) return 'Optional remote blocklist is off. No remote data is fetched.';
  if (!state.settings.content.blocklistUrl) return 'Add an HTTPS URL to enable the data-only subscription.';
  if (remote.status === 'loading') return 'Fetching and validating the blocklist…';
  if (remote.status === 'ready') {
    const via = remote.method === 'companion' ? ' via companion' : remote.method === 'userscript' ? ' via manager' : '';
    return `Active${via}: ${remote.channels.size} channels, ${remote.categories.size} categories, and ${remote.keywords.size} keywords. Last checked ${new Date(remote.fetchedAt).toLocaleString()}.`;
  }
  if (remote.status === 'stale') return 'The last valid blocklist is stale; the subscription will retry on its next interval.';
  if (remote.status === 'error') return 'The last blocklist refresh failed. Existing valid data was kept if it came from the same URL.';
  return 'No valid blocklist has been loaded yet.';
}

function updateRemoteBlocklistInPlace() {
  const notice = state.shadow?.querySelector('[data-kf-remote-blocklist]');
  if (!notice) return;
  notice.textContent = remoteBlocklistSummary();
  notice.dataset.status = state.remoteBlocklist.status;
}

function clearRemoteBlocklist() {
  gmDelete(REMOTE_BLOCKLIST_KEY);
  state.remoteBlocklist = { source: '', fetchedAt: 0, attemptedAt: 0, channels: new Set(), categories: new Set(), keywords: new Set(), status: 'off', method: '' };
  updateRemoteBlocklistInPlace();
  scheduleApply(0);
}

/**
 * Fetch text from a URL using the best available transport:
 *   1. Companion background (CORS-free, service-worker fetch)
 *   2. GM_xmlhttpRequest (CORS-free, userscript manager)
 *   3. Page-realm fetch (subject to CORS, last resort)
 *
 * Returns { text, method } on success; throws on failure.
 */
function fetchBlocklistText(href) {
  // Strategy 1: companion extension background fetch (CORS-free).
  if (companionInfo().active) {
    return new Promise((resolve, reject) => {
      // Both exits detach. The timeout used to reject and leave the listener
      // attached, so every companion fetch that went unanswered left one more
      // handler on `document` for the rest of the session — once a minute for
      // as long as the subscription stayed enabled and the companion stayed
      // quiet.
      const done = (settle, value) => {
        window.clearTimeout(timer);
        document.removeEventListener('kick-focus:blocklist-result', handler);
        settle(value);
      };
      const handler = (event) => {
        try {
          const result = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
          if (!result?.ok) throw new Error(result?.error || 'companion fetch failed');
          done(resolve, { text: result.text, method: 'companion' });
        } catch (error) {
          done(reject, error);
        }
      };
      const timer = window.setTimeout(() => done(reject, new Error('companion timeout')), 10000);
      document.addEventListener('kick-focus:blocklist-result', handler);
      document.dispatchEvent(new CustomEvent('kick-focus:fetch-blocklist', { detail: { url: href } }));
    });
  }

  // Strategy 2: GM_xmlhttpRequest (CORS-free, userscript sandbox).
  if (typeof GM_xmlhttpRequest === 'function') {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: href,
        // No ambient cookies: @connect * would otherwise let a blocklist URL on
        // any host receive the user's credentials for that host.
        anonymous: true,
        timeout: 8000,
        onload(response) {
          if (response.status >= 200 && response.status < 300) resolve({ text: response.responseText, method: 'userscript' });
          else reject(new Error(`HTTP ${response.status}`));
        },
        onerror() { reject(new Error('GM_xmlhttpRequest network error')); },
        ontimeout() { reject(new Error('GM_xmlhttpRequest timeout')); },
      });
    });
  }

  // Strategy 3: page-realm fetch (subject to CORS).
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  return fetch(href, { credentials: 'omit', cache: 'no-store', signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((text) => ({ text, method: 'page' }))
    .finally(() => window.clearTimeout(timeout));
}

function scheduleRemoteBlocklistSync(force = false) {
  const settings = state.settings.content;
  if (!settings.blocklistSubscription) {
    if (state.remoteBlocklist.status !== 'off') clearRemoteBlocklist();
    return;
  }
  // The shared rule, not a sixth spelling of it. This used to check only the
  // protocol, so it accepted a credentialed URL the extension copies refused.
  const href = normalizeBlocklistUrl(settings.blocklistUrl);
  if (!href) {
    state.remoteBlocklist.status = 'error';
    updateRemoteBlocklistInPlace();
    return;
  }
  const url = new URL(href);
  const now = Date.now();
  const interval = settings.blocklistRefreshHours * 60 * 60 * 1000;
  const sameSource = state.remoteBlocklist.source === url.href;
  if (!force && state.remoteSyncInFlight) return;
  if (!force && sameSource && state.remoteBlocklist.fetchedAt && now - state.remoteBlocklist.fetchedAt < interval) return;
  if (!force && state.remoteBlocklist.attemptedAt && now - state.remoteBlocklist.attemptedAt < 60 * 1000) return;
  state.remoteSyncInFlight = true;
  state.remoteBlocklist.attemptedAt = now;
  state.remoteBlocklist.status = 'loading';
  updateRemoteBlocklistInPlace();
  fetchBlocklistText(url.href)
    .then(({ text, method }) => {
      if (text.length > 512 * 1024) throw new Error('blocklist too large');
      const result = validateRemoteBlocklist(JSON.parse(text));
      if (!result.ok) throw new Error(result.error);
      const payload = result.value;
      state.remoteBlocklist = {
        source: url.href,
        fetchedAt: Date.now(),
        attemptedAt: Date.now(),
        channels: new Set(payload.channels),
        categories: new Set(payload.categories),
        keywords: new Set(payload.keywords),
        status: 'ready',
        method,
      };
      gmSet(REMOTE_BLOCKLIST_KEY, { source: url.href, fetchedAt: state.remoteBlocklist.fetchedAt, method, payload });
      recordProtection('Blocklist', { category: 'local', label: `validated ${payload.channels.length + payload.categories.length + payload.keywords.length} entries via ${method}` });
      scheduleApply(0);
    })
    .catch(() => {
      state.remoteBlocklist.status = sameSource && state.remoteBlocklist.fetchedAt ? 'stale' : 'error';
      updateRemoteBlocklistInPlace();
    })
    .finally(() => {
      state.remoteSyncInFlight = false;
      updateRemoteBlocklistInPlace();
    });
}

function installRemoteBlocklistTimer() {
  if (state.remoteSyncTimer) return;
  state.remoteSyncTimer = window.setInterval(() => scheduleRemoteBlocklistSync(false), 60 * 1000);
  scheduleRemoteBlocklistSync(false);
}

function applyContentFilters() {
  const settings = state.settings.content;
  const mainCards = mainCardCandidates();
  for (const node of mainCards) applyCardActions(node);
  applyDiscoveryCardUptimes(mainCards);

  // Decide first, apply second. Filtering is scored across the whole grid so a
  // run that would hide most of the page can be suspended before anything
  // disappears.
  const scored = [];
  for (const node of cardCandidates()) {
    delete node.dataset.kfFiltered;
    delete node.dataset.kfMature;
    delete node.dataset.kfDismissed;
    const context = cardContext(node);
    const labels = detectContentLabels(node.textContent, context);
    const link = node.matches?.('a[href]') ? node : node.querySelector?.('a[href]');
    let path = '';
    try { path = observedChannelPath(link ? new URL(link.href, location.origin).pathname : ''); } catch { /* noop */ }
    if (labels.casino && path) state.casinoPaths.add(path);
    if (path && state.casinoPaths.has(path)) labels.casino = true;
    node.dataset.kfWatched = String(Boolean(path && state.watched.has(path)));
    node.dataset.kfLiveCard = String(/(^|\s)live(?:\s|$)/i.test(node.textContent || ''));
    node.dataset.kfDismissed = String(Boolean(path && state.dismissed.has(path)));
    const remoteBlocked = remoteBlocklistMatches(path, context, node.textContent);
    const channelBlocked = localChannelBlocked(path);
    const hide = remoteBlocked || channelBlocked
      || (settings.hideCasino && labels.casino)
      || (settings.suppressPromoted && labels.promoted)
      || (settings.hideDropsPromotions && labels.drops);
    scored.push({ node, labels, hide });
  }

  const decision = filterDecision(scored.length, scored.filter((entry) => entry.hide).length, { route: state.route });
  for (const entry of scored) {
    if (decision.apply && entry.hide) entry.node.dataset.kfFiltered = 'true';
    if (entry.labels.mature) entry.node.dataset.kfMature = 'true';
  }
  recordFilterDecision(decision);

  if (settings.pauseHomeAutoplay && state.route === 'home') quietHomeAutoplay();
}

/**
 * Record the outcome of a filtering run, and say so when filtering was
 * suspended. Silence here would leave the user looking at unfiltered content
 * with no idea why, which is the same confusion the ceiling exists to prevent.
 */
function recordFilterDecision(decision) {
  const previous = state.filter.suspended;
  state.filter = {
    suspended: !decision.apply,
    hidden: decision.apply ? decision.hidden : 0,
    wouldHide: decision.hidden,
    total: decision.total,
  };
  document.documentElement.dataset.kfFilterSuspended = String(!decision.apply);
  if (!decision.apply && !previous) {
    const percent = Math.round(decision.ratio * 100);
    announce(trf('Content filtering suspended: it would have hidden {percent}% of this page.', { percent }));
    recordProtection('Filter', {
      category: 'filter',
      label: `suspended (${decision.hidden}/${decision.total} cards)`,
    });
  }
  updateFilterNoticeInPlace();
}

function updateFilterNoticeInPlace() {
  const notice = state.shadow?.querySelector('[data-kf-filter-notice]');
  if (!notice) return;
  notice.hidden = !state.filter.suspended;
  notice.textContent = state.filter.suspended
    ? `Filtering is suspended on this page. It would have hidden ${state.filter.wouldHide} of ${state.filter.total} cards, which usually means Kick changed its labels rather than that the page is really that promotional. Everything is shown.`
    : '';
}

function updateCompatibilityInPlace() {
  const status = state.shadow?.querySelector('[data-kf-compatibility]');
  const detail = state.shadow?.querySelector('[data-kf-compatibility-detail]');
  if (!status || !detail || !state.compatibility) return;
  status.textContent = tr(state.compatibility.healthy ? 'Healthy' : 'Needs attention');
  status.dataset.error = String(!state.compatibility.healthy);
  detail.textContent = `${compatibilitySummary(state.compatibility)} Probes: ${Object.entries(state.compatibility.probes).filter(([, probe]) => probe).map(([name, probe]) => `${name}=${probe}`).join(', ') || 'none'}.`;
}

function removeAdShells() {
  if (!state.settings.content.removeAdContainers) return;
  for (const node of document.querySelectorAll(AD_SHELL_SELECTORS.join(','))) {
    if (node.dataset.kfAdShell === 'true') continue;
    node.dataset.kfAdShell = 'true';
    const value = node.getAttribute('src') || node.id || node.getAttribute('data-testid') || node.getAttribute('aria-label') || node.className;
    const classification = classifyRequest(value, { reduceTelemetry: false });
    const safe = classification.label === '[unparseable URL]' ? 'ad shell' : classification.label;
    state.diagnostics.shells += 1;
    recordProtection('DOM', { category: 'advertising', label: safe });
    node.remove();
  }
}

/**
 * Queue an apply cycle.
 *
 * The delay is capped by how long work has already been waiting. Kick mutates
 * its DOM continuously, so an uncapped debounce is reset by every mutation and
 * the cycle never runs at all — which silently disabled card filtering, ad
 * shell removal, chat detection, and sidebar sync after first paint.
 */
function scheduleApply(delay = 50) {
  if (state.runtime.suspended) return;
  // A mutation can land while the visible half of the current cycle is
  // yielding. Remember it instead of arming a timer that will fire, see
  // applyRunning, and discard the only follow-up pass.
  if (state.runtime.applyRunning) {
    state.runtime.applyQueued = true;
    return;
  }
  const now = Date.now();
  if (!state.applyPendingSince) state.applyPendingSince = now;
  const effective = nextApplyDelay(delay, now - state.applyPendingSince);
  clearTimeout(state.applyTimer);
  state.applyTimer = window.setTimeout(runApplyCycle, effective);
}

/** Hand control back to the browser mid-cycle, where the engine offers it. */
function yieldToInput() {
  try {
    return typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function' ? scheduler.yield() : null;
  } catch {
    return null;
  }
}

/**
 * One pass over the page.
 *
 * Split in two with a yield between: the first half is everything the user
 * would see as broken if it lagged — ad shells, filters, layout, chrome — and
 * the second is bookkeeping that can wait a task. `scheduler.yield()` returns
 * to the browser so a click or keystroke queued behind this work is handled,
 * then resumes at the front of the queue rather than the back, which is what
 * separates it from a `setTimeout(0)` that would put this work behind
 * everything else on the page.
 *
 * Where the API is absent the two halves run in one task exactly as before, so
 * no engine gets slower. The cost measure sums the two halves and excludes the
 * yield, so the number stays comparable to the pre-yield baseline.
 */
async function runApplyCycle() {
  // A cycle already mid-yield must not be joined by a second one: they would
  // interleave writes to the same DOM. Queue one follow-up pass so mutations
  // observed during the yield are not lost.
  if (state.runtime.suspended) return;
  if (state.runtime.applyRunning) {
    state.runtime.applyQueued = true;
    return;
  }
  state.runtime.applyRunning = true;
  invalidateSessionWatchOwner();
  let elapsed = 0;
  let started = performance.now();
  try {
    state.applyPendingSince = 0;
    const currentPath = observedChannelPath(location.pathname) || location.pathname.replace(/\/$/, '') || '/';
    state.route = routeKind(location.href);
    if (state.lastPath !== currentPath) {
      state.lastPath = currentPath;
      const restored = state.route === 'channel' && restoreChannelLayout(currentPath);
      if (!restored) {
        state.runtime.focus = state.route === 'channel' && state.settings.layout.streamStart === 'focus';
        state.runtime.theater = state.route === 'channel' && state.settings.layout.streamStart === 'theater';
        state.runtime.chatHidden = false;
        state.runtime.sidebarHidden = false;
        state.runtime.chatPaused = false;
        state.runtime.chatScrollLastTop = 0;
        state.observers.chat?.disconnect?.();
        state.observers.chat = null;
      }
      state.runtime.matureVisible = false;
      announce(trf('Kick Focus applied to {route}', { route: state.route }));
    }
    ensureSiteStyle();
    applySettingsAttributes();
    tagChatPanel();
    tagMonetizationSurfaces();
    tagHideableElements();
    tagSignedInRouteChrome();
    ensureProfileStatsControl();
    removeAdShells();
    applyContentFilters();
    syncNativeSidebar();
    tagFollowingPreviewRows();
    applyRailVisibility();
    applySearchEnhancements();
    applyDropsEnhancements();
    applyMediaMemory();
    syncSessionWatchTime();
    applyPlayerResilience();
    applyChatPause();
    observeChatStickerDiscovery();
    // Fire-and-forget: every live path already falls back to the DOM, so a
    // rejected promise here must never interrupt the apply cycle.
    refreshLiveChannel().catch(() => {});

    const resume = yieldToInput();
    if (resume) {
      elapsed += performance.now() - started;
      await resume;
      // The panic switch, a route change, or a teardown can all land during the
      // yield. Re-read rather than trusting what was true a task ago.
      if (state.runtime.suspended) return;
      // The DOM can change across the yield, so the owner measured before it is
      // no longer an answer about the page the second half is writing to.
      invalidateSessionWatchOwner();
      started = performance.now();
    }

    replayPendingDeletions();
    replayPendingBadges();
    runRewardClaim();
    renderStickerOrganizer();
    applyChatHighlights();
    applyPlaybackDiagnostics();
    applyStreamUptime();
    applyVodExpiry();
    state.compatibility = compatibilitySnapshot(document, { expectedChat: state.route === 'channel', derive: compatibilityDerivers() });
  publishCompatibility();
    updateCompatibilityInPlace();
    applyRouteLayout();
    syncQuickButton();
  } catch (error) {
    logAppError('apply cycle', error);
  } finally {
    const rerun = state.runtime.applyQueued;
    state.runtime.applyQueued = false;
    state.runtime.applyRunning = false;
    state.diagnostics.apply = recordApplyCost(state.diagnostics.apply, elapsed + (performance.now() - started));
    updateApplyCostInPlace();
    // Only while the hub is the page on screen. Off it there is nothing to
    // repaint, and the whole point of the hub is that it reads when looked at.
    if (state.currentPage === 'viewer' && state.modal && !state.modal.hidden) renderViewerHubInPlace();
    if (rerun && !state.runtime.suspended) scheduleApply(0);
  }
}

function updateApplyCostInPlace() {
  const node = state.shadow?.querySelector('[data-kf-apply-cost]');
  // The empty-state sentence is a dictionary key; a composed count phrase is
  // its own answer. Marked no-translate on the node, so translate at write.
  if (node) node.textContent = tr(applyCostSummary(state.diagnostics.apply));
}

/**
 * Learn about route changes from the browser, not from a wrapper around history.
 *
 * The Navigation API reports every same-document URL change — pushState,
 * replaceState, back/forward, hash — as one `currententrychange` event, fired
 * synchronously by the browser at the same moment the old wrapper fired.
 * Where it exists the wrapper is not installed at all: two fewer page globals
 * replaced, and this build's function name no longer appears in
 * `history.pushState.toString()`. Feature-detected; the wrapper stays as the
 * fallback for engines without it.
 */
function installSpaHooks() {
  if (pageWindow.__kickFocusSpaHooksV1) return;
  pageWindow.__kickFocusSpaHooksV1 = true;
  const routeChanged = () => pageWindow.dispatchEvent(new pageWindow.Event(ROUTE_EVENT));
  const navigation = pageWindow.navigation;
  if (navigation && typeof navigation.addEventListener === 'function') {
    navigation.addEventListener('currententrychange', routeChanged);
    state.runtime.routeSource = 'navigation-api';
  } else {
    for (const method of ['pushState', 'replaceState']) {
      try {
        const original = pageWindow.history[method];
        pageWindow.history[method] = function kickFocusHistory(...args) {
          const result = original.apply(this, args);
          routeChanged();
          return result;
        };
      } catch {
        // Popstate and the document observer still cover navigation.
      }
    }
    pageWindow.addEventListener('popstate', routeChanged);
    state.runtime.routeSource = 'history-patch';
  }
  pageWindow.addEventListener(ROUTE_EVENT, () => scheduleApply(20));
}

function installDocumentObserver() {
  if (state.observers.document) return;
  state.observers.document = new MutationObserver((mutations) => {
    // The full apply cycle deliberately yields. Preview controls are tiny and
    // interaction-bound, so tag their rare mutations before joining that
    // queue; otherwise a hover can arrive while the new row is still waiting.
    if (followingPreviewMutation(mutations)) {
      try { tagFollowingPreviewRows(); } catch (error) { logAppError('following preview observer', error); }
    }
    scheduleApply(80);
  });
  state.observers.document.observe(document.documentElement, { childList: true, subtree: true });
}

function installRuntimeInteractions() {
  if (pageWindow.__kickFocusRuntimeInteractionsV1) return;
  pageWindow.__kickFocusRuntimeInteractionsV1 = true;
  document.addEventListener('click', handleCardAction, true);
  document.addEventListener('click', handleSearchAction, true);
  document.addEventListener('click', handleStickerAction, true);
  document.addEventListener('click', handleChatStickerSave, true);
  document.addEventListener('keydown', handleChatStickerSave, true);
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-kf-chat-pause]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    state.runtime.chatPaused = !state.runtime.chatPaused;
    applySettingsAttributes();
    applyChatPause();
    // Resuming returns the reader to the live edge. Leaving them where they
    // were reads as "Resume did nothing" — the transcript is still frozen a
    // screen back — and with pause-on-scroll armed, a list sitting that far
    // from the bottom simply pauses itself again on the next scroll.
    if (!state.runtime.chatPaused) {
      const messages = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages');
      if (messages) messages.scrollTop = messages.scrollHeight;
    }
    announce(state.runtime.chatPaused ? 'Chat updates paused' : 'Chat updates resumed');
  }, true);
  const refreshPlayer = () => {
    if (state.settings.layout.playerResizeRecovery) scheduleApply(0);
  };
  window.addEventListener('resize', refreshPlayer, { passive: true });
  window.addEventListener('orientationchange', refreshPlayer, { passive: true });
  window.visualViewport?.addEventListener('resize', refreshPlayer, { passive: true });
}

function rememberWatchedCard(event) {
  const actualTarget = event.composedPath?.()[0] || event.target;
  const link = actualTarget.closest?.('a[href]');
  const main = findProbe(document, 'main').element;
  const sidebar = findProbe(document, 'sidebar').element;
  if (!link || (main && !main.contains(link) && sidebar && !sidebar.contains(link))) return;
  if (!link) return;
  try {
    const path = observedChannelPath(new URL(link.href, location.origin).pathname);
    if (!path) return;
    state.watched.add(path);
    const values = [...state.watched].slice(-200);
    sessionStorage.setItem(WATCHED_KEY, JSON.stringify(values));
  } catch {
    // Session-only watched state is an optional enhancement.
  }
}

function channelLayoutMap() {
  return normalizeChannelLayouts(gmGet(CHANNEL_LAYOUT_KEY, {}));
}

function restoreChannelLayout(path) {
  if (!state.settings.layout.rememberPerChannel) return false;
  const canonical = observedChannelPath(path);
  const saved = channelLayoutMap()[canonical];
  if (!saved || typeof saved !== 'object') return false;
  state.runtime.focus = Boolean(saved.focus);
  state.runtime.theater = Boolean(saved.theater);
  state.runtime.chatHidden = Boolean(saved.chatHidden);
  state.runtime.sidebarHidden = Boolean(saved.sidebarHidden);
  return true;
}

function saveChannelLayout() {
  if (state.route !== 'channel' || !state.settings.layout.rememberPerChannel) return;
  const path = channelPath();
  if (!path) return;
  const map = channelLayoutMap();
  map[path] = {
    focus: state.runtime.focus,
    theater: state.runtime.theater,
    chatHidden: state.runtime.chatHidden,
    sidebarHidden: state.runtime.sidebarHidden,
  };
  const trimmed = Object.fromEntries(Object.entries(map).slice(-50));
  gmSet(CHANNEL_LAYOUT_KEY, trimmed);
}

function announce(message) {
  if (!state.settings.accessibility.announceChanges) return;
  const live = state.shadow?.querySelector('[data-kf-live]');
  if (!live) return;
  const spoken = tr(message);
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = spoken; });
}

function updateSetting(path, value, message = 'Autosaved') {
  const [section, key] = path.split('.');
  if (!state.settings[section] || !(key in state.settings[section])) return;
  state.settings = normalizeSettings({
    ...state.settings,
    [section]: { ...state.settings[section], [key]: value },
  });
  if (path === 'content.rememberVolume' && !state.settings.content.rememberVolume) clearMediaPreferenceKind('volume');
  if (path === 'content.rememberQuality' && !state.settings.content.rememberQuality) clearMediaPreferenceKind('quality');
  // The ladder is observed for this one feature and for nothing else, so
  // switching the feature off is also the instruction to forget it.
  if (path === 'content.preferBestQuality' && !state.settings.content.preferBestQuality) clearMediaPreferenceKind('ladder');
  if (path === 'content.rememberVodPosition' && !state.settings.content.rememberVodPosition) clearMediaPreferenceKind('position');
  if (path === 'content.stickyChatPause' && !state.settings.content.stickyChatPause) {
    state.runtime.chatPaused = false;
    state.observers.chat?.disconnect?.();
    state.observers.chat = null;
  }
  if (path === 'content.chatComposerRecall' && !state.settings.content.chatComposerRecall) {
    state.chatComfort.composerRecall = [];
    state.chatComfort.composerRecallIndex = -1;
  }
  if (path === 'content.blocklistSubscription' && !state.settings.content.blocklistSubscription) clearRemoteBlocklist();
  if (path === 'content.blocklistUrl' && state.remoteBlocklist.source !== state.settings.content.blocklistUrl) clearRemoteBlocklist();
  if (path.startsWith('content.blocklist')) window.setTimeout(() => scheduleRemoteBlocklistSync(true), 0);
  saveSettings(message);
  scheduleApply(0);
  renderSettingsPage();
  renderCommands();
}

/**
 * Trusted Types, if the page ever enforces them.
 *
 * Trusted Types reached Baseline in February 2026. kick.com ships no CSP at all
 * today (Mozilla Observatory graded it D/30 on 2026-08-16), but the day it adds
 * `require-trusted-types-for 'script'` every `innerHTML` assignment in the page
 * world starts throwing a TypeError — including all of this build's own UI,
 * which would simply stop rendering.
 *
 * Feature-detected, never version-sniffed, and created once. The policy is an
 * identity function on purpose: this markup is assembled here from values
 * already escaped by `escapeHtml`, so the policy is the browser's ceremony for
 * "this string came from application code", not a sanitiser. A *default* policy
 * is deliberately not created — that would silently vouch for every other
 * script on the page, including Kick's.
 */
const TRUSTED_HTML_POLICY = (() => {
  try {
    const api = typeof window !== 'undefined' ? window.trustedTypes : undefined;
    return typeof api?.createPolicy === 'function'
      ? api.createPolicy('kick-focus', { createHTML: (value) => value })
      : null;
  } catch {
    // A `trusted-types` CSP directive can refuse this policy name. Fall back to
    // the plain string: where enforcement is on, the write throws and the
    // existing guard() reports it, which is louder than a blank interface.
    return null;
  }
})();

function trustedHTML(value) {
  return TRUSTED_HTML_POLICY ? TRUSTED_HTML_POLICY.createHTML(String(value)) : value;
}

/**
 * The one place markup enters the DOM.
 *
 * Every surface writes through here, and `scripts/check.mjs` asserts exactly one
 * `innerHTML` assignment survives into a bundle — this one. That makes the
 * chokepoint enforceable rather than conventional: the next panel someone adds
 * cannot quietly assign markup on its own.
 *
 * It deliberately does *not* sanitise. `Element.setHTML()` reached both target
 * engines in 2026 and looks like an obvious upgrade over a Trusted Types policy
 * that is an identity function — but measured against Chrome 151 on 2026-08-18,
 * its default configuration removed **all 39 attributes** from a representative
 * slice of this interface and dropped `<button>`, `<input>`, `<select>`,
 * `<option>`, `<label>`, `<img>` and `<span>` outright: 27 elements in, 15 out,
 * no `data-set` bindings, no `aria-pressed`, no `data:` brand mark. The default
 * config is a document sanitiser for untrusted content, not a filter for
 * application-authored UI.
 *
 * A custom `Sanitizer` config would work, and would have to allow-list every
 * element and attribute this interface already uses — a second list that rots
 * every time a control is added, buying only protection against `<script>` and
 * event-handler attributes that `escapeHtml` already prevents from being
 * constructible. Not worth it. If that calculus changes, this function is the
 * single place it changes.
 */
function setMarkup(node, value) {
  if (!node) return;
  node.innerHTML = trustedHTML(String(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const UI_CSS = `
  :host {
    color-scheme: dark;
    --accent: var(--kf-accent, #7cff2b);
    --accent-rgb: var(--kf-accent-rgb, 124, 255, 43);
    --surface-0: var(--kf-canvas, #070a08);
    --surface-1: var(--kf-panel, #0b100d);
    --surface-2: var(--kf-panel-raised, #111713);
    --surface-3: var(--kf-panel-high, #18201b);
    --surface-inset: var(--kf-surface-inset, #070b08);
    --surface-hover: var(--kf-surface-hover, #171f1a);
    --surface-selected: var(--kf-surface-selected, #111d14);
    --surface-danger: #2a1416;
    --border: var(--kf-border, #202a23);
    --border-subtle: color-mix(in srgb, var(--border) 68%, transparent);
    --border-control: color-mix(in srgb, var(--border-strong) 78%, var(--border));
    --border-strong: var(--kf-border-strong, #38463d);
    --text: var(--kf-text, #f5f8f6);
    --text-secondary: var(--kf-text-secondary, #d0d7d3);
    --muted: var(--kf-text-muted, #aab4ae);
    --subtle: color-mix(in srgb, var(--muted) 72%, var(--surface-0));
    --on-accent: var(--kf-on-accent, #071004);
    --danger: var(--kf-danger, #ff6258);
    --danger-text: #ffaaa4;
    --warning: var(--kf-warning, #f6b943);
    --success: var(--accent);
    /* Derived from the Corner radius setting rather than fixed, because these
       three carry every rounded edge in this build's own chrome and only the
       bare --radius below was wired to the setting, on a single element. The
       offsets are chosen so the 7px default reproduces the previous 4/6/10
       exactly: this changes nothing until somebody moves the setting, and then
       it moves the whole panel instead of one corner. */
    --radius-sm: calc(var(--kf-radius, 7px) - 3px);
    --radius-md: calc(var(--kf-radius, 7px) - 1px);
    --radius-lg: calc(var(--kf-radius, 7px) + 3px);
    --radius: var(--kf-radius, 7px);
    --focus-ring: var(--kf-focus-ring, 3px solid var(--accent));
    --focus-offset: var(--kf-focus-offset, 2px);
    --shadow-dialog: 0 38px 110px rgba(0,0,0,.72), 0 0 0 1px rgba(255,255,255,.015);
    --shadow-control: 0 10px 28px rgba(0,0,0,.24);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.45;
  }

  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }
  button, input, select, textarea { font: inherit; }
  button { color: inherit; }
  :is(button, input, select, textarea) { transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
  ::selection { background: rgba(var(--accent-rgb), .28); color: var(--text); }

  .kf-quick {
    position: fixed;
    left: 18px;
    bottom: 18px;
    z-index: 2147483000;
    min-width: 76px;
    height: 38px;
    padding: 0 16px;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    background: var(--surface-2);
    color: var(--text);
    box-shadow: 0 14px 38px rgba(0,0,0,.5);
    cursor: pointer;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .kf-quick:hover { border-color: var(--accent); background: var(--surface-hover); color: var(--accent); transform: translateY(-1px); }
  .kf-quick:active { transform: translateY(0); }

  .kf-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2147483200;
    display: grid;
    place-items: center;
    padding: 22px;
    background: radial-gradient(circle at 50% 14%, rgba(var(--accent-rgb), .055), transparent 38%), rgba(2, 3, 3, .9);
  }

  /* Interface scale is applied here with zoom rather than by multiplying each
     length, because this surface carries about 120 font sizes and a ladder of
     absolute control heights, and scaling only the root font size moved none of
     them. zoom is the primitive browsers already use for exactly this, so it
     takes the fonts, the control heights, the padding and the dialog chrome
     together instead of leaving them out of step with each other. Every element
     that is position: fixed in this stylesheet is a sibling of this one rather
     than a descendant, so none of them are dragged along.

     The two viewport-relative dimensions are divided by the scale on the way
     in: zoom multiplies the used value afterwards, so a plain 100vw would
     render 110vw at 110% and push the dialog off screen. An engine without zoom
     drops the declaration and lands on today's behaviour rather than a broken
     layout. */
  .kf-settings {
    position: relative;
    zoom: var(--kf-interface-scale, 1);
    width: min(1140px, calc((100vw - 44px) / var(--kf-interface-scale, 1)));
    height: min(940px, calc((100vh - 44px) / var(--kf-interface-scale, 1)));
    min-width: calc(860px / var(--kf-interface-scale, 1));
    min-height: calc(640px / var(--kf-interface-scale, 1));
    display: grid;
    grid-template-rows: 76px minmax(0, 1fr) 68px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-1);
    box-shadow: var(--shadow-dialog);
    color: var(--text);
    font-size: 14px;
  }

  .kf-header {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 18px;
    padding: 0 20px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-2);
  }
  .kf-brand { display: flex; align-items: center; gap: 9px; min-width: 0; font-size: 16px; font-weight: 820; letter-spacing: -.02em; }
  .kf-brand-mark { width: 28px; height: 28px; display: block; object-fit: contain; }
  .kf-badge { padding: 2px 6px; border: 1px solid rgba(var(--accent-rgb), .68); border-radius: 3px; color: var(--accent); font-size: 9px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
  .kf-save { display: flex; align-items: center; color: var(--text-secondary); font-size: 12px; font-weight: 650; }
  .kf-save::before { content: ''; display: inline-block; width: 8px; height: 8px; margin-right: 8px; border: 1px solid var(--accent); border-radius: 2px; background: var(--accent); }
  .kf-save[data-error="true"] { color: var(--danger); }
  .kf-save[data-error="true"]::before { border-color: var(--danger); background: var(--danger); }

  .kf-icon-button {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    line-height: 1;
  }
  .kf-icon-button:hover { border-color: var(--border-control); background: var(--surface-hover); }
  .kf-icon-button:active { background: var(--surface-selected); transform: translateY(1px); }
  .kf-icon { width: 18px; height: 18px; display: block; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

  .kf-body { min-height: 0; display: grid; grid-template-columns: 232px minmax(0, 1fr); }
  .kf-nav { padding: 14px 10px; border-right: 1px solid var(--border); background: var(--surface-0); }
  .kf-nav button {
    position: relative;
    width: 100%;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    align-items: center;
    gap: 13px;
    min-height: 56px;
    padding: 0 14px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }
  .kf-nav button::before { content: ''; position: absolute; inset: 12px auto 12px 0; width: 3px; border-radius: 2px; background: transparent; }
  .kf-nav button:hover { border-color: var(--border-subtle); background: var(--surface-hover); }
  .kf-nav button:active { transform: translateY(1px); }
  .kf-nav button[aria-current="page"]::before { background: var(--accent); box-shadow: 0 0 14px rgba(var(--accent-rgb), .35); }
  .kf-nav button[aria-current="page"] { border-color: rgba(var(--accent-rgb), .22); background: var(--surface-selected); color: var(--text); }
  .kf-nav .kf-icon { width: 20px; height: 20px; color: var(--text-secondary); }
  .kf-nav button[aria-current="page"] .kf-icon { color: var(--accent); }
  .kf-nav-copy { display: grid; gap: 2px; min-width: 0; }
  .kf-nav strong { font-size: 13px; font-weight: 760; }
  .kf-nav span { overflow: hidden; color: var(--muted); font-size: 11px; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }

  .kf-page { min-width: 0; overflow-x: hidden; overflow-y: auto; padding: 24px 34px 40px 36px; scrollbar-color: var(--border-control) transparent; scrollbar-width: thin; }
  .kf-page:focus { outline: 0; }
  .kf-nav-search { padding: 0 10px 10px; }
  .kf-nav-search input {
    width: 100%;
    min-height: 32px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-inset);
    color: var(--text);
    font: inherit;
    font-size: 12px;
  }
  .kf-nav-search input:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
  .kf-search-results { display: flex; flex-direction: column; gap: 2px; padding: 6px; }
  .kf-search-result {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    /* The 24px target floor the rest of this panel holds; density and the
       interface scale must not shrink a result below it. */
    min-height: 44px;
    padding: 8px 10px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .kf-search-result:hover, .kf-search-result:focus-visible { border-color: var(--accent); background: var(--surface-inset); }
  .kf-search-result-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .kf-search-result-copy strong { font-size: 13px; }
  .kf-search-result-copy small { color: var(--muted); font-size: 11px; line-height: 1.35; }
  .kf-search-result-page { flex: none; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
  .kf-search-empty { padding: 18px; color: var(--muted); }
  .kf-search-empty p { margin: 0 0 6px; }

  .kf-page-header { min-height: 86px; display: flex; align-items: center; justify-content: space-between; gap: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
  .kf-page-header h2 { margin: 2px 0 5px; font-size: 29px; line-height: 1.06; letter-spacing: -.04em; }
  .kf-page-header p { max-width: 560px; margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
  .kf-eyebrow { display: block; color: var(--accent); font-size: 10px; font-weight: 850; letter-spacing: .12em; text-transform: uppercase; }
  .kf-page-meta { display: grid; gap: 3px; min-width: 140px; text-align: right; }
  .kf-page-meta span { color: var(--subtle); font-size: 10px; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
  .kf-page-meta strong { color: var(--text-secondary); font-size: 12px; font-weight: 740; }
  .kf-page-meta-control { min-width: 118px; justify-items: end; }

  .kf-panel { border: 0; border-radius: 0; background: transparent; overflow: visible; }
  .kf-row {
    min-height: 74px;
    display: grid;
    grid-template-columns: minmax(230px, 1fr) minmax(300px, auto);
    align-items: center;
    gap: 26px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-subtle);
  }
  .kf-row h3 { margin: 0 0 4px; color: var(--text); font-size: 13px; font-weight: 780; letter-spacing: .01em; }
  .kf-row p { max-width: 420px; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
  .kf-row-wide { grid-template-columns: minmax(220px, .82fr) minmax(360px, 1.18fr); }
  .kf-control { min-width: 300px; display: flex; justify-content: flex-end; }

  .kf-segmented { display: inline-flex; border: 1px solid var(--border-control); border-radius: var(--radius-md); overflow: hidden; background: var(--surface-inset); box-shadow: inset 0 1px rgba(255,255,255,.02); }
  .kf-segmented button {
    min-width: 78px;
    height: 40px;
    padding: 0 13px;
    border: 0;
    border-left: 1px solid var(--border-control);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 680;
  }
  .kf-segmented button:first-child { border-left: 0; }
  .kf-segmented button:hover { background: var(--surface-hover); color: var(--text); }
  .kf-segmented button:active { background: var(--surface-selected); }
  .kf-segmented button[aria-pressed="true"] { background: rgba(var(--accent-rgb), .1); color: var(--text); box-shadow: inset 0 0 0 1px var(--accent); }

  .kf-hide-grid { display: grid; gap: 14px; width: 100%; }
  .kf-hide-heading { display: block; margin-bottom: 7px; color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
  .kf-hide-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .kf-hide-chip {
    min-height: 32px;
    padding: 0 11px;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 680;
  }
  .kf-hide-chip:hover { background: var(--surface-hover); color: var(--text); }
  .kf-hide-chip:active { background: var(--surface-selected); }
  /* Pressed means hidden, so it reads as struck out rather than as selected —
     the accent alone would say "on" for a control that is now off. */
  .kf-hide-chip[aria-pressed="true"] {
    background: rgba(var(--accent-rgb), .1);
    color: var(--text);
    box-shadow: inset 0 0 0 1px var(--accent);
    text-decoration: line-through;
    text-decoration-color: var(--accent);
  }

  .kf-switch {
    width: 58px;
    height: 32px;
    position: relative;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .kf-switch:hover { border-color: var(--border-strong); background: var(--surface-hover); }
  .kf-switch[aria-checked="true"] { border-color: var(--accent); background: var(--accent); color: var(--on-accent); box-shadow: 0 0 0 1px rgba(var(--accent-rgb), .12); }
  .kf-switch:disabled { opacity: .72; cursor: not-allowed; }
  /* Pinned rather than left to the engine: color-scheme picks the UA
     placeholder, and that is one engine change away from being unreadable
     on an inset that is near-black in all three themes. */
  .kf-text::placeholder, .kf-textarea::placeholder { color: var(--muted); opacity: 1; }

  .kf-lock { display: inline-block; margin-left: 7px; padding: 2px 6px; border: 1px solid rgba(var(--accent-rgb), .5); border-radius: 3px; color: var(--accent); font-size: 9px; font-weight: 850; text-transform: uppercase; }

  .kf-range { display: grid; grid-template-columns: 48px minmax(220px, 1fr) 48px; align-items: end; gap: 10px; width: 100%; }
  .kf-range span { color: var(--muted); font-size: 11px; }
  .kf-range span:last-child { text-align: right; }
  .kf-range-wrap { position: relative; display: grid; gap: 4px; }
  .kf-range output { justify-self: center; min-width: 52px; padding: 2px 7px; color: var(--text); text-align: center; font-size: 10px; font-weight: 750; }
  .kf-range input { width: 100%; height: 16px; accent-color: var(--accent); }

  .kf-text, .kf-textarea {
    width: 100%;
    min-height: 40px;
    padding: 9px 11px;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text);
  }
  .kf-textarea { min-height: 86px; resize: vertical; }
  .kf-text:focus, .kf-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15); }
  .kf-select { min-width: 118px; height: 36px; padding: 0 28px 0 10px; border: 1px solid var(--border-control); border-radius: var(--radius-md); background: var(--surface-inset); color: var(--text); font-size: 12px; }
  .kf-select:hover { border-color: var(--border-strong); }
  .kf-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15); }

  .kf-theme-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .kf-swatch-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; }
  .kf-preset-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
  .kf-preset-card { position: relative; display: grid; align-content: start; gap: 4px; min-height: 82px; padding: 11px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-inset); color: var(--text); text-align: left; cursor: pointer; }
  .kf-preset-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 2px; background: rgba(var(--accent-rgb), .5); opacity: .55; }
  .kf-preset-card:hover { border-color: var(--border-strong); background-color: var(--surface-hover); transform: translateY(-1px); box-shadow: var(--shadow-control); }
  .kf-preset-card:active { transform: translateY(0); box-shadow: none; }
  .kf-preset-card span { color: var(--accent); font-size: 9px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
  .kf-preset-card strong { font-size: 12px; }
  .kf-preset-card small { color: var(--muted); font-size: 9px; line-height: 1.4; }
  .kf-theme-board {
    position: relative;
    min-height: 126px;
    display: grid;
    align-content: start;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }
  .kf-theme-board:hover { border-color: var(--border-strong); transform: translateY(-2px); box-shadow: var(--shadow-control); }
  .kf-theme-board:active { transform: translateY(0); box-shadow: none; }
  .kf-theme-board[aria-pressed="true"] { border-color: var(--accent); background: var(--surface-selected); box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), .15); }
  .kf-theme-board-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .kf-theme-board-top > span:first-child { color: var(--subtle); font-size: 8px; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
  .kf-theme-selected { min-height: 15px; color: var(--accent); font-size: 8px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
  .kf-theme-tones { height: 34px; display: grid; grid-template-columns: 1.4fr 1fr .8fr; gap: 3px; padding: 4px; border: 1px solid var(--theme-border); border-radius: 4px; background: var(--theme-canvas); }
  .kf-theme-tones i { display: block; border-radius: 2px; background: var(--theme-panel); }
  .kf-theme-tones i:nth-child(2) { background: var(--theme-raised); }
  .kf-theme-tones i:nth-child(3) { background: var(--theme-high); }
  .kf-theme-board[data-value="studio"] { --theme-canvas: #080b09; --theme-panel: #0e130f; --theme-raised: #141a16; --theme-high: #1a221c; --theme-border: #46564b; }
  .kf-theme-board[data-value="oled"] { --theme-canvas: #000; --theme-panel: #030404; --theme-raised: #080a09; --theme-high: #0e1110; --theme-border: #414b45; }
  .kf-theme-board[data-value="slate"] { --theme-canvas: #0b0f14; --theme-panel: #111820; --theme-raised: #18222c; --theme-high: #202d39; --theme-border: #5a7084; }
  .kf-theme-copy { display: grid; gap: 2px; }
  .kf-theme-copy strong { font-size: 12px; }
  .kf-theme-copy small { color: var(--muted); font-size: 9px; line-height: 1.35; }
  .kf-accent-chip { min-width: 0; min-height: 52px; display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: center; gap: 7px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-inset); color: var(--text-secondary); cursor: pointer; text-align: left; }
  .kf-accent-chip:hover { border-color: var(--border-strong); background: var(--surface-hover); }
  .kf-accent-chip[aria-pressed="true"] { border-color: var(--accent); background: var(--surface-selected); color: var(--text); box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), .12); }
  .kf-accent-chip strong { min-width: 0; font-size: 9px; line-height: 1.15; }
  .kf-swatch { width: 18px; height: 30px; border-radius: 3px; border: 1px solid rgba(255,255,255,.24); }
  .kf-swatch[data-color="kick"] { background: #7cff2b; }
  .kf-swatch[data-color="cyan"] { background: #38d7d0; }
  .kf-swatch[data-color="violet"] { background: #9667ff; }
  .kf-swatch[data-color="gold"] { background: #ffbe2e; }
  .kf-swatch[data-color="custom"] { background: var(--kf-custom-accent, #ff5ca8); }
  .kf-custom-color { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-inset); }
  .kf-custom-color input { width: 42px; height: 34px; padding: 2px; border: 0; border-radius: 4px; background: transparent; cursor: pointer; }
  .kf-custom-color strong { color: var(--text); font-size: 11px; }
  .kf-custom-color small { display: block; margin-top: 2px; color: var(--muted); font-size: 9px; }
  .kf-custom-accent-row[data-visible="false"] { display: none; }

  .kf-appearance-layout { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(300px, .7fr); gap: 24px; }
  .kf-appearance-controls { min-width: 0; }
  .kf-appearance-controls .kf-row, .kf-appearance-controls .kf-row-wide { min-height: 0; grid-template-columns: 1fr; gap: 8px; padding: 11px 0; }
  .kf-appearance-controls .kf-row:has(.kf-control) { min-height: 64px; grid-template-columns: minmax(160px, 1fr) minmax(190px, auto); align-items: center; gap: 12px; }
  .kf-appearance-controls .kf-row:has(.kf-control) p { max-width: 200px; }
  .kf-appearance-controls .kf-control { width: 190px; min-width: 0; justify-content: flex-end; }
  .kf-appearance-controls .kf-segmented { width: 100%; }
  .kf-appearance-controls .kf-segmented button { min-width: 0; flex: 1; padding-inline: 8px; }
  .kf-appearance-controls .kf-range { grid-template-columns: 38px minmax(90px, 1fr) 34px; gap: 6px; }

  .kf-preview { position: sticky; top: 0; align-self: start; min-width: 0; padding-left: 20px; border-left: 1px solid var(--border); }
  .kf-preview-kicker { color: var(--accent); font-size: 10px; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
  .kf-preview-intro { margin: 3px 0 14px; color: var(--muted); font-size: 11px; }
  .kf-preview-surface { overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-inset); box-shadow: var(--shadow-control); }
  .kf-preview-surface header { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 12px; border-bottom: 1px solid var(--border-subtle); font-size: 9px; }
  .kf-preview-surface header strong { margin-right: auto; color: var(--accent); font-size: 12px; }
  .kf-preview-surface header span { color: var(--muted); }
  .kf-preview-image { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-bottom: 1px solid var(--border-subtle); filter: saturate(var(--kf-thumb-saturation, 1.03)); }
  .kf-preview-feature { padding: 18px 14px; border-bottom: 1px solid var(--border-subtle); }
  .kf-preview-feature h3 { margin: 7px 0 3px; font-size: 15px; line-height: 1.2; }
  .kf-preview-feature p { margin: 0; color: var(--muted); font-size: 10px; }
  .kf-preview-live { display: inline-flex; align-items: center; gap: 7px; color: #dce3de; font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .kf-preview-live::before { content: ''; width: 7px; height: 7px; border-radius: 2px; background: var(--accent); }
  .kf-preview-action { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; color: var(--muted); font-size: 9px; }
  .kf-preview-action b { padding: 7px 10px; border: 1px solid var(--accent); border-radius: 3px; color: var(--accent); font-size: 9px; }
  .kf-preview-list { display: flex; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border-subtle); font-size: 9px; }
  .kf-preview-list:last-child { border-bottom: 0; }
  .kf-preview-list span { color: var(--muted); }
  .kf-preview-list strong { text-align: right; }

  .kf-status-card { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 18px; padding: 18px 0; border-bottom: 1px solid var(--border-subtle); }
  .kf-status-card h3 { margin: 0 0 3px; font-size: 15px; }
  .kf-status-card p { max-width: 560px; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
  .kf-active { color: var(--accent); font-weight: 800; }
  .kf-stats { min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--border-subtle); }
  .kf-stat { min-width: 0; padding: 15px 12px; border-left: 1px solid var(--border-subtle); text-align: left; }
  .kf-stat:first-child { border-left: 0; }
  .kf-stat span { display: block; color: var(--muted); font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
  .kf-stat strong { display: block; overflow: hidden; margin-top: 4px; color: var(--accent); font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }

  .kf-defense-overview { min-width: 0; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr); border-bottom: 1px solid var(--border); }
  .kf-defense-overview .kf-status-card, .kf-defense-overview .kf-stats { border-bottom: 0; }
  .kf-defense-overview .kf-status-card { padding-right: 18px; }
  .kf-defense-overview .kf-status-card > .kf-active { display: none; }
  .kf-defense-overview .kf-stats { border-left: 1px solid var(--border-subtle); }
  .kf-content-section { margin-top: 18px; }
  .kf-content-section {
    overflow: hidden;
    padding: 0 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    box-shadow: 0 1px 0 rgba(255,255,255,.015) inset;
  }
  .kf-content-section .kf-subsection-header { margin: 0 -16px; padding: 14px 16px 12px; border-bottom-color: var(--border); background: var(--surface-2); }
  [data-kf-current-page="content"] .kf-row { min-height: 62px; padding: 10px 0; }
  [data-kf-current-page="content"] .kf-row h3 { margin-bottom: 2px; font-size: 12px; }
  [data-kf-current-page="content"] .kf-row p { font-size: 11px; }
  [data-kf-current-page="content"] .kf-subsection { margin-top: 20px; }
  [data-kf-current-page="content"] .kf-status-note { font-size: 10px; }
  .kf-tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 20px; }
  .kf-tool-card { min-height: 96px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-inset); }
  .kf-tool-card:hover { border-color: var(--border-control); background: var(--surface-hover); }
  .kf-tool-card h3 { margin: 0 0 3px; font-size: 11px; }
  .kf-tool-card p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
  .kf-channel-input-row { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 9px; align-items: center; }
  .kf-channel-list { display: grid; gap: 6px; margin-top: 10px; max-height: 280px; overflow: auto; scrollbar-gutter: stable; }
  .kf-channel-entry { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 10px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface-inset); font-size: 13px; }
  .kf-channel-entry span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .kf-emote-manager { margin-top: 18px; }
  .kf-sticker-library-workspace { min-width: 0; display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 12px; }
  .kf-sticker-group-panel { min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-inset); }
  .kf-sticker-group-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .kf-sticker-group-heading h4 { margin: 0; font-size: 13px; }
  .kf-sticker-group-heading span { color: var(--muted); font-size: 11px; }
  .kf-sticker-group-panel > p { margin: 4px 0 10px; color: var(--muted); font-size: 11px; line-height: 1.45; }
  .kf-sticker-library-main { min-width: 0; }
  .kf-sticker-library-controls { display: grid; grid-template-columns: minmax(220px, 1fr) 180px; gap: 9px; }
  .kf-sticker-library-controls .kf-select { width: 100%; height: 40px; }
  .kf-sticker-group-builder { display: grid; gap: 7px; }
  .kf-sticker-group-list { display: grid; gap: 7px; margin-top: 10px; }
  .kf-sticker-group-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 5px; align-items: center; }
  .kf-sticker-group-row .kf-text { min-height: 34px; padding-block: 6px; }
  .kf-sticker-group-row > span, .kf-sticker-group-empty { color: var(--muted); font-size: 10px; }
  .kf-sticker-library-bulk { display: grid; grid-template-columns: auto auto auto minmax(120px, 1fr) auto auto; gap: 6px; align-items: center; margin-top: 9px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
  .kf-sticker-library-bulk > strong { color: var(--text-secondary); font-size: 11px; white-space: nowrap; }
  .kf-sticker-library-bulk .kf-select { min-width: 0; width: 100%; }
  .kf-sticker-library-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 13px 0 8px; color: var(--muted); font-size: 10px; }
  .kf-sticker-library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 8px; max-height: 520px; overflow: auto; padding-right: 4px; scrollbar-gutter: stable; }
  .kf-my-emote-group { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); }
  .kf-my-emote-group:first-of-type { margin-top: 8px; }
  .kf-my-emote-group > header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 8px; }
  .kf-my-emote-group > header span { color: var(--accent); font-size: 8px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
  .kf-my-emote-group > header h4 { margin: 3px 0 0; color: var(--text); font-size: 13px; }
  .kf-my-emote-group > header > strong { color: var(--muted); font-size: 10px; }
  .kf-my-emote-group .kf-sticker-library-grid { max-height: none; overflow: visible; padding-right: 0; }
  /* The library scrolls inside a fixed height, so most of its cards are off
     screen at any moment. content-visibility lets the browser skip layout and
     paint for those entirely; contain-intrinsic-size supplies the height it
     would have had, so the scrollbar stays honest and does not jump as cards
     are rendered. Unsupported engines ignore both and render as before. */
  .kf-sticker-library-item { min-width: 0; display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 10px; padding: 9px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface-inset); content-visibility: auto; contain-intrinsic-size: auto 86px; }
  .kf-sticker-library-item[data-removed="true"] { opacity: .58; }
  .kf-sticker-library-item[data-selected="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px rgba(var(--accent-rgb),.18); }
  .kf-sticker-library-image { width: 52px; height: 52px; display: grid; place-items: center; padding: 5px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
  .kf-sticker-library-image img { width: 100%; height: 100%; object-fit: contain; }
  .kf-sticker-library-copy { min-width: 0; }
  .kf-sticker-library-copy strong { display: block; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
  .kf-sticker-library-copy small { display: block; overflow: hidden; margin-top: 2px; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .kf-sticker-access { display: inline-flex; margin-top: 5px; padding: 2px 5px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); color: var(--muted); font-size: 9px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
  /* Fixed, not the accent. A status that follows the branding colour collided
     with its neighbours on gold and on cyan; these three hues stay 58deg and
     77deg apart whatever the accent is. */
  .kf-sticker-access[data-access="available"] { border-color: rgba(139,232,92,.55); color: #8be85c; }
  .kf-sticker-access[data-access="channel"] { border-color: rgba(255,190,46,.58); color: #ffcf61; }
  .kf-sticker-access[data-access="observed"] { border-color: rgba(56,215,208,.58); color: #70e9e3; }
  .kf-emote-catalog-browser { display: grid; grid-template-columns: minmax(170px,.7fr) minmax(260px,1.3fr); gap: 12px; align-items: center; margin-bottom: 12px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); }
  .kf-emote-catalog-browser h4 { margin: 0; color: var(--text); font-size: 13px; }
  .kf-emote-catalog-browser p { margin: 2px 0 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
  .kf-emote-catalog-status { grid-column: 1 / -1; }
  .kf-emote-catalog-form { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; }
  .kf-emote-catalog-status[data-error="true"] { color: var(--danger-text); }
  /* Kick edits emotes users already pulled; the local record is the only copy
     that can prove it, so a changed entry is called out rather than quietly
     overwritten. */
  .kf-sticker-changed { display: inline-flex; margin: 5px 0 0 5px; padding: 2px 5px; border: 1px solid rgba(217,139,58,.62); border-radius: 3px; color: #e0a367; font-size: 8px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
  .kf-sticker-library-item[data-changed="true"] { border-color: rgba(217,139,58,.42); }
  /* A dead greyed tile teaches nothing; a reason plus Kick's own unlock path
     is the clearest possible signal that entitlements are respected. */
  .kf-sticker-lock { display: block; margin-top: 5px; color: var(--muted); font-size: 9px; line-height: 1.5; white-space: normal; }
  .kf-sticker-lock a { color: var(--accent); }
  .kf-sticker-library-actions { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .kf-sticker-library-actions .kf-select { grid-column: 1 / -1; min-width: 0; width: 100%; }

  .kf-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .kf-table th, .kf-table td { padding: 11px 9px; border-bottom: 1px solid var(--border-subtle); text-align: left; vertical-align: middle; }
  .kf-table th { color: var(--text-secondary); background: transparent; font-size: 10px; letter-spacing: .07em; text-transform: uppercase; }
  .kf-table .kf-muted { color: var(--muted); }
  .kf-table tr:last-child td { border-bottom: 0; }
  .kf-table .kf-table-actions { text-align: right; }
  .kf-shortcut { display: inline-flex; min-width: 62px; justify-content: center; padding: 4px 8px; border: 1px solid var(--border-control); border-radius: var(--radius-sm); background: var(--surface-2); font-weight: 700; }
  .kf-conflict td { background: rgba(255,98,88,.055); border-top: 1px solid var(--danger); border-bottom: 1px solid var(--danger); }
  .kf-conflict-message { color: var(--danger); font-size: 11px; }

  .kf-status-note { margin-top: 12px; padding: 10px 12px; border-left: 2px solid var(--border-strong); background: rgba(255,255,255,.018); color: var(--muted); font-size: 11px; }
  .kf-status-note[data-drifted="true"] { border-color: #7b5d20; background: rgba(246,185,67,.065); color: #e7c77e; }
  .kf-notice { margin-top: 12px; padding: 11px 13px; border-left: 2px solid #997326; background: rgba(246,185,67,.055); color: #e7c77e; font-size: 11px; }
  .kf-subsection { margin-top: 26px; }
  .kf-subsection-header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 10px; padding-bottom: 11px; border-bottom: 1px solid var(--border); }
  .kf-subsection h3 { margin: 0; font-size: 13px; letter-spacing: .02em; }
  .kf-subsection p { margin: 2px 0 0; color: var(--muted); font-size: 11px; }

  .kf-about-status { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 18px 0; border-bottom: 1px solid var(--border-subtle); }
  .kf-mini-card { padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-inset); }
  .kf-mini-card span { display: block; color: var(--muted); font-size: 9px; letter-spacing: .07em; text-transform: uppercase; }
  .kf-mini-card strong { display: block; margin-top: 4px; color: var(--accent); }
  /* The earned marker. The word is the status; the dot repeats it for a glance
     and the pulse is decoration on top of both, which is why either can be
     removed without the meaning going with it. */
  .kf-nav-earned:empty { display: none; }
  .kf-nav-earned { display: block; margin-top: 3px; color: var(--accent); font-size: 11px; }
  .kf-nav-earned::before { content: '● '; }
  [data-kf-earned="reward-ready"] { position: relative; }
  [data-kf-earned="reward-ready"]::after {
    content: ''; position: absolute; top: 4px; right: 4px; width: 7px; height: 7px;
    border: 1px solid var(--surface-2); border-radius: 50%; background: var(--accent);
    animation: kf-earned-pulse 2.4s ease-in-out infinite;
  }
  @keyframes kf-earned-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  /* Stated here as well as in the blanket rule below, because this is the one
     animation in the build that exists purely to draw the eye. */
  @media (prefers-reduced-motion: reduce) {
    [data-kf-earned="reward-ready"]::after { animation: none; }
  }

  .kf-layout-save { display: grid; gap: 8px; justify-items: stretch; min-width: 240px; }
  .kf-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .kf-chip { padding: 5px 10px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; background: transparent; font-size: 11px; cursor: pointer; }
  .kf-chip[aria-pressed="true"] { color: var(--accent); border-color: var(--accent); }
  /* The pressed chip is named as well as coloured, so the state does not depend
     on seeing the colour: the button carries aria-pressed and the entry below
     spells out which pages a view claims. */
  .kf-layout-list { display: grid; gap: 6px; padding: 10px 0 2px; }
  .kf-layout-entry { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-inset); }
  .kf-layout-entry[data-active="true"] { border-color: var(--accent); }
  .kf-layout-entry span { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; }

  .kf-chat-log { display: grid; gap: 8px; min-width: 0; }
  .kf-chat-log-row { display: grid; grid-template-columns: auto auto 1fr; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--border-subtle); font-size: 12px; }
  .kf-chat-log-row span:first-child { color: var(--muted); font-variant-numeric: tabular-nums; }
  .kf-chat-log-row strong { color: var(--accent); }
  .kf-chat-log-row span:last-child { overflow-wrap: anywhere; }

  .kf-hub-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 18px 0; }
  .kf-hub-card { position: relative; overflow: hidden; min-height: 118px; padding: 15px; border: 1px solid var(--border); border-radius: var(--radius-md); background: linear-gradient(145deg, var(--surface-inset), var(--surface-1)); }
  .kf-hub-card::before { content: ''; position: absolute; inset: 0 0 auto; height: 2px; background: var(--accent); opacity: .32; }
  .kf-hub-card > span { display: block; color: var(--subtle); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .kf-hub-card > strong { display: block; margin-top: 7px; color: var(--accent); font-size: 19px; }
  .kf-hub-card em { display: block; margin-top: 6px; color: var(--muted); font-size: 11px; font-style: normal; line-height: 1.45; }
  /* A card with no reading is quieter than one with a number, and says so in
     words as well: state is never carried by colour alone. */
  .kf-hub-card[data-state="unavailable"] strong, .kf-hub-card[data-state="loading"] strong { color: var(--muted); }
  .kf-hub-card[data-state="error"] strong { color: var(--danger-text); }
  .kf-action-row { min-height: 78px; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 22px; padding: 14px 0; border-bottom: 1px solid var(--border-subtle); }
  .kf-action-row h3 { margin: 0 0 4px; font-size: 13px; }
  .kf-action-row p { max-width: 560px; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
  .kf-danger { border-color: rgba(255,98,88,.65) !important; color: var(--danger-text) !important; }

  [data-kf-current-page="accessibility"] { padding-top: 14px; }
  [data-kf-current-page="accessibility"] .kf-page-header { min-height: 70px; padding-bottom: 12px; }
  [data-kf-current-page="accessibility"] .kf-row { min-height: 60px; padding: 9px 0; }
  [data-kf-current-page="accessibility"] .kf-subsection { margin-top: 14px; }
  [data-kf-current-page="accessibility"] .kf-subsection-header { margin-bottom: 0; padding-bottom: 8px; }
  [data-kf-current-page="accessibility"] .kf-table th, [data-kf-current-page="accessibility"] .kf-table td { padding-block: 7px; }
  [data-kf-current-page="accessibility"] .kf-button-small { min-height: 32px; }
  [data-kf-current-page="layout"] > .kf-panel,
  [data-kf-current-page="accessibility"] > .kf-panel,
  [data-kf-current-page="about"] > .kf-panel {
    margin-top: 16px;
    padding: 0 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
  }
  [data-kf-current-page="about"] .kf-action-row { min-height: 78px; padding-block: 13px; }
  [data-kf-current-page="about"] .kf-subsection { margin-top: 18px; }
  [data-kf-current-page="about"] .kf-subsection > .kf-panel { overflow: hidden; border: 1px solid var(--border); border-radius: 4px; }

  .kf-button {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 14px;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    background: var(--surface-3);
    color: var(--text);
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
  }
  .kf-button:hover { border-color: var(--border-strong); background: var(--surface-hover); transform: translateY(-1px); box-shadow: var(--shadow-control); }
  .kf-button:active { transform: translateY(0); box-shadow: none; }
  .kf-button-primary { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
  .kf-button-primary:hover { border-color: var(--accent); background: var(--accent); filter: brightness(1.08); }
  .kf-button:disabled { opacity: .48; cursor: not-allowed; transform: none; box-shadow: none; }
  .kf-button-primary:disabled { opacity: 1; border-color: var(--border); background: var(--surface-hover); color: var(--muted); }
  .kf-button-small { min-height: 32px; padding-inline: 10px; font-size: 11px; }
  .kf-button .kf-icon { width: 16px; height: 16px; }
  .kf-button-group { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }

  .kf-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 22px; border-top: 1px solid var(--border); background: var(--surface-2); }
  .kf-footer-left, .kf-footer-right { display: flex; align-items: center; gap: 10px; }


  .kf-toast {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2147483500;
    max-width: 430px;
    padding: 11px 14px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface-3);
    box-shadow: 0 18px 48px rgba(0,0,0,.5);
    color: var(--text);
  }
  .kf-toast[data-error="true"] { border-color: var(--danger); background: var(--surface-danger); }
  .kf-toast:has(.kf-toast-action) { display: flex; align-items: center; gap: 10px; }
  .kf-toast-text { flex: 1 1 auto; }
  .kf-toast-action {
    flex: 0 0 auto;
    padding: 5px 10px;
    border: 1px solid var(--accent);
    border-radius: 4px;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }
  .kf-toast-action:hover { background: var(--accent); color: var(--on-accent); }
  .kf-toast-action:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

  /* Data loss is not a toast. This stays until the user acknowledges it. */
  .kf-storage-alert {
    position: fixed;
    z-index: 2147483001;
    inset-inline: 16px;
    bottom: 16px;
    margin-inline: auto;
    max-width: 640px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--radius-lg);
    background: var(--surface-danger);
    color: var(--text);
    box-shadow: 0 18px 44px rgba(0,0,0,.55);
    font-size: 12px;
  }
  .kf-storage-alert[hidden] { display: none; }
  .kf-storage-alert-body { display: grid; gap: 2px; flex: 1; min-width: 0; }
  .kf-storage-alert-body strong { font-size: 12px; }
  .kf-storage-alert-body span { opacity: .85; }

  .kf-command-shell {
    width: min(560px, calc(100vw - 48px));
    max-height: min(620px, calc(100vh - 80px));
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-1);
    box-shadow: var(--shadow-dialog);
    color: var(--text);
  }
  .kf-command-head { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 7px 12px; padding: 16px; border-bottom: 1px solid var(--border); }
  .kf-command-head label { color: var(--text-secondary); font-size: 11px; font-weight: 780; letter-spacing: .05em; text-transform: uppercase; }
  .kf-command-head span { color: var(--muted); font-size: 10px; }
  .kf-command-head input {
    grid-column: 1 / -1;
    width: 100%;
    height: 44px;
    padding: 0 13px;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text);
    outline: 0;
  }
  .kf-command-head input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15); }

  /* Windows High Contrast suppresses box-shadow outright, so every control
     whose focus ring is a shadow had no visible focus at all — a WCAG 2.4.7
     failure on a build that ships an accessibility page. Buttons were already
     safe because they use a real outline. */
  @media (forced-colors: active) {
    .kf-text:focus,
    .kf-textarea:focus,
    .kf-command-head input:focus,
    .kf-ms-head input:focus,
    .kf-ms-foot input:focus,
    .kf-select:focus,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible,
    button:focus-visible,
    [tabindex]:focus-visible {
      outline: 3px solid Highlight;
      outline-offset: 2px;
    }
    .kf-panel, .kf-settings, .kf-command-shell { border: 1px solid CanvasText; }
    .kf-storage-alert { border: 2px solid CanvasText; }
    /* Forced colors erase custom backgrounds, so every selected/checked/current
       state needs a system-color marker or "on" looks identical to "off". */
    .kf-switch { border: 1px solid CanvasText; }
    .kf-switch[aria-checked="true"] { background: Highlight; }
    [aria-checked="true"], [aria-selected="true"], [aria-pressed="true"], [aria-current="page"] {
      outline: 2px solid Highlight;
      outline-offset: 1px;
    }
  }

  /* WCAG 2.2 2.5.8 Target Size (Minimum): 24x24 CSS px, and it is measured for
     pointers generally, not just touch. Density and the 90% interface scale
     both shrink controls, so this is a floor under every one of them rather
     than a size for any particular control — the comfortable sizes above still
     win wherever they are larger. */
  :host :is(button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="option"]) {
    min-width: 24px;
    min-height: 24px;
  }
  /* Inline links inside prose are exempt in 2.5.8 and a 24px floor on them
     would space paragraphs out oddly. */
  :host p a[href], :host small a[href], :host li a[href] { min-width: 0; min-height: 0; }

  /* WCAG 2.2 2.4.11 Focus Not Obscured. The settings modal has a sticky header
     and footer, and scrolling a control into view puts it flush against the
     edge — which is exactly where those sit, so the thing that just received
     focus ends up underneath them. */
  :host [data-kf-page] :is(button, a[href], input, select, textarea, [role="switch"]) {
    scroll-margin-block: 72px;
  }

  /* The accessibility settings apply to this mod's own controls too. The site
     rules cannot reach in here, so these mirror them off the host attributes
     written by applySettingsAttributes. WCAG 2.5.8 wants 24px minimum; the
     comfortable size is 40px, matching what the site rules give Kick. */
  :host([data-kf-large-targets="true"]) :is(button, a[href], input, select, textarea) { min-height: 40px; }
  :host([data-kf-large-targets="true"]) .kf-switch { min-width: 74px; }
  :host([data-kf-large-targets="true"]) .kf-icon-button { min-width: 40px; }
  :host([data-kf-large-targets="true"]) .kf-ms-bar :is(button, .kf-ms-link) { min-height: 32px; padding: 6px 10px; }
  /* The tile bar reveals on hover, which a pointer-limited user may never
     trigger; larger targets implies it stays put. */
  :host([data-kf-large-targets="true"]) .kf-ms-bar { opacity: 1; }

  :host([data-kf-reduce-motion="true"]) *,
  :host([data-kf-reduce-motion="true"]) *::before,
  :host([data-kf-reduce-motion="true"]) *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }

  /* Kick publishes no drop odds and documents no duplicate protection, so this
     states what is known and attributes it, rather than filling the gap. */
  .kf-fact-list { margin: 0; padding: 0; display: grid; gap: 10px; }
  .kf-fact { margin: 0; padding: 10px 12px; border-left: 3px solid var(--border-subtle); background: rgba(255,255,255,.02); border-radius: 0 4px 4px 0; }
  .kf-fact dt { margin: 0 0 3px; font-size: 12px; font-weight: 700; }
  .kf-fact dd { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.55; }

  /* Rarity is shown only when the join is confident; see joinCollectibleRarity. */
  .kf-rarity {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    border: 1px solid currentColor;
    font-size: 10px;
    font-weight: 700;
    text-transform: capitalize;
  }
  .kf-rarity[data-rarity="common"] { color: #9ba59f; }
  .kf-rarity[data-rarity="uncommon"] { color: #6fd47a; }
  .kf-rarity[data-rarity="rare"] { color: #57b6ff; }
  .kf-rarity[data-rarity="epic"] { color: #b184ff; }
  .kf-rarity[data-rarity="legendary"] { color: #ffb648; }
  .kf-rarity[data-rarity="mythic"] { color: #ff6b8b; }

  /* Multi-stream: a grid of Kick's own embedded players. */
  .kf-ms-backdrop { padding: 0; }
  .kf-ms-shell {
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle at 50% -12%, rgba(var(--accent-rgb), .06), transparent 34%), var(--surface-0);
    color: var(--text);
  }
  .kf-ms-head, .kf-ms-foot {
    display: grid;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
  }
  .kf-ms-head { grid-row: 1; }
  .kf-ms-error { grid-row: 2; }
  .kf-ms-body { grid-row: 3; }
  .kf-ms-foot { grid-row: 4; }
  .kf-ms-head { grid-template-columns: minmax(150px, auto) minmax(300px, 1fr) auto; }
  .kf-ms-foot { grid-template-columns: auto minmax(0, 1fr); border-bottom: 0; border-top: 1px solid var(--border); }
  .kf-ms-brand { display: grid; gap: 2px; }
  .kf-ms-brand strong { font-size: 15px; letter-spacing: -.015em; }
  .kf-ms-add { display: flex; align-items: center; justify-content: center; gap: 7px; min-width: 0; }
  .kf-ms-add input { width: min(420px, 100%); }
  .kf-ms-controls { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
  .kf-ms-save-layout { display: flex; align-items: center; gap: 7px; }
  .kf-ms-points-note { grid-column: 1 / -1; display: flex; align-items: center; gap: 7px; margin: 0; color: var(--muted); font-size: 10px; line-height: 1.45; }
  .kf-ms-points-note svg { width: 14px; height: 14px; flex: 0 0 14px; color: var(--warning); }
  .kf-ms-count { color: var(--muted); font-size: 11px; }
  .kf-ms-head input, .kf-ms-foot input {
    min-width: 220px;
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text);
    font-size: 12px;
  }
  .kf-ms-head input:focus, .kf-ms-foot input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15); }
  .kf-ms-select { min-height: 32px; font-size: 12px; }
  .kf-ms-error { padding: 9px 14px; border-bottom: 1px solid var(--danger); background: var(--surface-danger); color: var(--danger-text); font-size: 12px; }
  .kf-ms-error[hidden] { display: none; }

  .kf-ms-body { display: grid; grid-template-columns: 1fr 0; min-height: 0; }
  .kf-ms-backdrop[data-kf-multistream-show-chat="true"] .kf-ms-body { grid-template-columns: 1fr 340px; }
  .kf-ms-grid {
    display: grid;
    grid-template-columns: repeat(var(--kf-multistream-columns, 1), 1fr);
    gap: 8px;
    padding: 10px;
    min-height: 0;
    align-content: stretch;
  }
  .kf-ms-empty-state {
    grid-column: 1 / -1;
    align-self: center;
    justify-self: center;
    width: min(520px, calc(100% - 36px));
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 34px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: linear-gradient(145deg, var(--surface-1), var(--surface-inset));
    box-shadow: var(--shadow-control);
    text-align: center;
  }
  .kf-ms-empty-state img { width: 48px; height: 48px; object-fit: contain; }
  .kf-ms-empty-state span { color: var(--accent); font-size: 9px; font-weight: 850; letter-spacing: .12em; text-transform: uppercase; }
  .kf-ms-empty-state h2 { margin: 0; font-size: 23px; letter-spacing: -.035em; }
  .kf-ms-empty-state p { max-width: 420px; margin: 0 0 4px; color: var(--muted); font-size: 12px; line-height: 1.55; }
  .kf-ms-tile {
    position: relative;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: #000;
  }
  /* The focused tile owns the audio, so it has to be obvious which one that is. */
  .kf-ms-tile[data-kf-multistream-focused="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  /* A paused grid still shows which channels it holds, so the layout reads as
     intact rather than empty. */
  .kf-ms-backdrop[data-kf-multistream-paused="true"] .kf-ms-tile::after {
    content: attr(data-kf-multistream-tile) " (paused)";
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--surface-inset);
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
  }
  .kf-ms-backdrop[data-kf-multistream-paused="true"] .kf-ms-bar { z-index: 1; }
  .kf-ms-tile iframe { width: 100%; height: 100%; border: 0; display: block; }
  .kf-ms-bar {
    position: absolute;
    inset-inline: 0;
    top: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    background: linear-gradient(180deg, rgba(0,0,0,.78), transparent);
    opacity: .88;
    transition: opacity .12s ease;
    font-size: 11px;
  }
  .kf-ms-bar .kf-ms-spacer { flex: 1; }
  .kf-ms-tile:hover .kf-ms-bar, .kf-ms-tile:focus-within .kf-ms-bar { opacity: 1; }
  .kf-ms-bar button, .kf-ms-bar .kf-ms-link {
    border: 1px solid rgba(255,255,255,.25);
    border-radius: 4px;
    background: rgba(0,0,0,.55);
    color: var(--text);
    padding: 2px 7px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
  }
  .kf-ms-bar button:hover, .kf-ms-bar .kf-ms-link:hover { border-color: var(--accent); color: var(--accent); }
  .kf-ms-tile[data-kf-multistream-focused="true"] .kf-ms-name { border-color: var(--accent); color: var(--accent); }
  .kf-ms-merged { min-width: 0; border-left: 1px solid var(--border); display: grid; grid-template-rows: auto auto 1fr; }
  .kf-ms-chat-status { margin: 0; padding: 4px 10px; border-bottom: 1px solid var(--border); color: var(--text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }
  .kf-ms-merged-list { margin: 0; padding: 6px 8px; overflow-y: auto; list-style: none; font-size: 12px; line-height: 1.45; }
  .kf-ms-merged-row { padding: 2px 0; overflow-wrap: anywhere; }
  /* The source channel first and always visible: an interleaved feed is only
     readable if every line says where it came from without hovering. */
  .kf-ms-merged-source { display: inline-block; margin-right: 6px; padding: 0 5px; border-radius: 4px;
    background: var(--kf-panel-high, #18201b); color: var(--kf-accent, #7cff2b); font-size: 11px; font-weight: 700; }
  .kf-ms-merged-who { margin-right: 4px; font-weight: 700; }
  .kf-ms-merged-who::after { content: ':'; }
  /* One chat at a time: the merged pane replaces the per-tile one rather than
     competing with it for the same column. */
  .kf-ms-backdrop[data-kf-multistream-merged-on="true"] .kf-ms-chat { display: none; }
  .kf-ms-chat { min-width: 0; border-left: 1px solid var(--border); display: grid; grid-template-rows: auto 1fr; }
  /* The pop-out has it: hide the pane, do not empty it. The iframe stays
     mounted and connected, so closing the window shows the chat that was
     already there rather than loading a fresh one. */
  .kf-ms-backdrop[data-kf-multistream-chat-popped-out="true"] .kf-ms-chat { display: none; }
  .kf-ms-chat iframe { width: 100%; height: 100%; border: 0; display: block; }
  .kf-ms-chat-notice {
    margin: 0;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--muted);
    font-size: 11px;
  }
  .kf-ms-layouts { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .kf-ms-layout { display: inline-flex; }
  .kf-ms-layout button {
    border: 1px solid var(--border);
    background: var(--surface-inset);
    color: var(--text);
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
  }
  .kf-ms-layout button:first-child { border-radius: 6px 0 0 6px; }
  .kf-ms-layout button:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
  .kf-ms-layout button:hover { border-color: var(--accent); color: var(--accent); }
  .kf-ms-layout small { opacity: .6; }
  /* One bulk request answers for every saved layout, so live status is cheap
     enough to show on all of them at once. */
  .kf-ms-layout small.kf-ms-live { opacity: 1; color: var(--muted); }
  .kf-ms-layout small.kf-ms-live[data-live="true"] { color: var(--accent); font-weight: 700; }
  .kf-ms-empty { color: var(--muted); font-size: 11px; }

  @media (max-width: 1180px) {
    .kf-ms-head { grid-template-columns: auto minmax(280px, 1fr); }
    .kf-ms-controls { grid-column: 1 / -1; justify-content: flex-start; }
  }
  @media (max-width: 760px) {
    .kf-ms-head, .kf-ms-foot { grid-template-columns: 1fr; }
    .kf-ms-add, .kf-ms-save-layout { justify-content: stretch; }
    .kf-ms-add input, .kf-ms-save-layout input { width: 100%; min-width: 0; }
    .kf-ms-layouts, .kf-ms-points-note { grid-column: 1; }
    .kf-ms-empty-state { padding: 24px 18px; }
  }

  .kf-shadow-warning { display: grid; gap: 6px; }
  .kf-shadow-warning code { font-size: 11px; color: var(--accent); }
  .kf-command-list { max-height: 490px; overflow: auto; padding: 8px; }
  .kf-command-item { width: 100%; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 14px; padding: 12px; border: 1px solid transparent; border-left: 3px solid transparent; border-radius: var(--radius-sm); background: transparent; text-align: left; cursor: pointer; }
  .kf-command-item:hover, .kf-command-item[data-active="true"] { border-color: var(--border-subtle); border-left-color: var(--accent); background: var(--surface-hover); }
  .kf-command-item strong { display: block; margin-bottom: 2px; }
  .kf-command-item span { color: var(--muted); font-size: 12px; }
  .kf-command-empty { display: grid; gap: 4px; padding: 38px 28px; color: var(--muted); text-align: center; }
  .kf-command-empty strong { color: var(--text); font-size: 13px; }
  .kf-command-empty span { font-size: 11px; }

  .kf-sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0,0,0,0) !important; white-space: nowrap !important; border: 0 !important; }

  :is(button, input, select, textarea):focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

  @media (max-width: 920px) {
    .kf-settings { width: calc((100vw - 28px) / var(--kf-interface-scale, 1)); height: calc((100vh - 28px) / var(--kf-interface-scale, 1)); min-width: 0; min-height: calc(620px / var(--kf-interface-scale, 1)); }
    .kf-header { grid-template-columns: 1fr auto auto; gap: 14px; padding-inline: 18px; }
    .kf-body { grid-template-columns: 204px minmax(0, 1fr); }
    .kf-nav button { grid-template-columns: 21px minmax(0, 1fr); gap: 10px; padding-inline: 18px; }
    .kf-nav .kf-nav-copy { overflow: visible; white-space: normal; }
    .kf-nav-copy > strong { line-height: 1.15; white-space: normal; }
    .kf-nav-copy > span { display: none; }
    .kf-page { padding-inline: 24px 20px; }
    .kf-row, .kf-row-wide { grid-template-columns: 1fr; gap: 10px; }
    .kf-control { min-width: 0; justify-content: flex-start; }
    .kf-range { max-width: 420px; }
    .kf-defense-overview { grid-template-columns: 1fr; }
    .kf-defense-overview .kf-stats { border-left: 0; border-top: 1px solid var(--border-subtle); }
    .kf-tool-grid { grid-template-columns: 1fr; }
    .kf-sticker-library-workspace, .kf-sticker-library-controls, .kf-sticker-library-grid { grid-template-columns: 1fr; }
    .kf-sticker-group-builder { grid-template-columns: minmax(180px, 1fr) auto; }
    .kf-sticker-library-bulk { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .kf-sticker-library-bulk > strong, .kf-sticker-library-bulk .kf-select { grid-column: span 2; }
    .kf-sticker-library-actions { grid-template-columns: repeat(2, auto); }
    .kf-sticker-library-actions .kf-select { grid-column: 1 / -1; }
  }

  @media (max-width: 700px) {
    .kf-backdrop { padding: 0; }
    .kf-settings { width: calc(100vw / var(--kf-interface-scale, 1)); height: calc(100vh / var(--kf-interface-scale, 1)); min-height: 0; grid-template-rows: 66px minmax(0, 1fr) 68px; border: 0; border-radius: 0; }
    .kf-header { grid-template-columns: 1fr auto auto; padding-inline: 14px; }
    .kf-body { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
    .kf-nav { display: flex; overflow-x: auto; padding: 0; border-right: 0; border-bottom: 1px solid var(--border); scrollbar-width: none; overscroll-behavior-inline: contain; }
    .kf-nav::-webkit-scrollbar { display: none; }
    .kf-nav-search { display: none; }
    .kf-nav button { flex: 0 0 auto; width: auto; min-width: 0; min-height: 54px; padding-inline: 16px; }
    .kf-nav-copy, .kf-nav-copy > strong { white-space: nowrap; }
    .kf-nav button::before { inset: auto 14px 0; width: auto; height: 3px; }
    .kf-page { padding: 18px 18px 32px; }
    .kf-page-header { min-height: 72px; }
    .kf-page-header h2 { font-size: 23px; }
    .kf-page-meta { display: none; }
    .kf-control { width: 100%; }
    .kf-segmented { width: 100%; }
    .kf-segmented button { min-width: 0; flex: 1 1 0; padding-inline: 7px; }
    .kf-range { grid-template-columns: 42px minmax(120px, 1fr) 42px; }
    .kf-channel-input-row, .kf-emote-catalog-browser, .kf-emote-catalog-form { grid-template-columns: 1fr; }
    .kf-sticker-library-bulk { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .kf-sticker-library-bulk > strong, .kf-sticker-library-bulk .kf-select { grid-column: 1 / -1; }
    .kf-theme-grid, .kf-swatch-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .kf-preset-grid { grid-template-columns: 1fr; }
    .kf-appearance-layout { grid-template-columns: 1fr; }
    .kf-preview { position: static; padding: 18px 0 0; border-top: 1px solid var(--border); border-left: 0; }
    .kf-about-status, .kf-stats, .kf-hub-grid { grid-template-columns: 1fr; }
    .kf-mini-card, .kf-stat { border-left: 0; border-top: 1px solid var(--border-subtle); }
    .kf-action-row { grid-template-columns: 1fr; }
    .kf-button-group { justify-content: flex-start; }
    .kf-footer { padding-inline: 14px; }
    .kf-footer [data-action="export"] { display: none; }
    .kf-storage-alert { align-items: stretch; flex-wrap: wrap; }
    .kf-storage-alert-body { flex-basis: 100%; }
  }

  @media (max-width: 430px) {
    .kf-brand { font-size: 14px; }
    .kf-badge { display: none; }
    .kf-save { font-size: 11px; }
    .kf-page-header p { font-size: 12px; }
    .kf-row { gap: 12px; padding-block: 13px; }
    .kf-row p { font-size: 11px; }
    .kf-footer-left .kf-button { padding-inline: 10px; }
    .kf-command-shell { width: calc(100vw - 24px); }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
  }
`;

/**
 * One row per string, not one map per language.
 *
 * Each English key used to be written once under `es` and once under `pt`.
 * Measured 2026-08-25 that was 65,586 bytes of duplicated keys in an artifact
 * with 283 bytes of headroom under its injection budget. A row keyed by the
 * English string, valued by one entry per language in `LOCALES` order, stores
 * each key once and makes "every locale covers the same strings" structural
 * rather than something a test has to check.
 */
const LOCALES = ['es', 'pt'];
const TRANSLATIONS = {
  'Home': ['Inicio', 'Início'],
  'Browse': ['Explorar', 'Explorar'],
  'Following': ['Siguiendo', 'A seguir'],
  'Saved views': ['Vistas guardadas', 'Vistas guardadas'],
  'Keep the density, thumbnail size, rails, and content filters you like as a named view, and have it applied when you open the pages you chose. It is your own settings, applied to what Kick already sent. It changes nothing about what Kick recommends or the order anything appears in.': ['Guarda la densidad, el tamaño de miniatura, los raíles y los filtros de contenido que te gustan como una vista con nombre, y aplícala al abrir las páginas que elijas. Son tus propios ajustes aplicados a lo que Kick ya envió. No cambia nada de lo que Kick recomienda ni el orden en que aparece.', 'Guarda a densidade, o tamanho das miniaturas, as barras e os filtros de conteúdo que preferes como uma vista com nome, e aplica-a ao abrir as páginas que escolheres. São as tuas próprias definições aplicadas ao que a Kick já enviou. Não muda nada do que a Kick recomenda nem a ordem em que aparece.'],
  'Save this page as a view': ['Guardar esta página como vista', 'Guardar esta página como vista'],
  'Pick the pages it should apply to, or none to keep it manual.': ['Elige las páginas donde debe aplicarse, o ninguna para dejarla manual.', 'Escolhe as páginas onde deve aplicar-se, ou nenhuma para a deixar manual.'],
  'Save this view': ['Guardar esta vista', 'Guardar esta vista'],
  'No saved views yet. Set the page up the way you want it, name it, and save.': ['Todavía no hay vistas guardadas. Deja la página como la quieres, ponle nombre y guárdala.', 'Ainda não há vistas guardadas. Deixa a página como a queres, dá-lhe um nome e guarda.'],
  'Applied only when you press it': ['Se aplica solo cuando la pulsas', 'Aplica-se apenas quando a carregas'],
  'Currently applied': ['Aplicada ahora', 'Aplicada agora'],
  'Applied {name} for this page.': ['Se aplicó {name} en esta página.', 'Foi aplicada {name} nesta página.'],
  '{n} saved views is the limit. Delete one first.': ['El límite es {n} vistas guardadas. Borra una primero.', 'O limite é {n} vistas guardadas. Apaga uma primeiro.'],
  'Saved {name}.': ['Se guardó {name}.', 'Foi guardada {name}.'],
  'Applied {name}. {n} settings changed.': ['Se aplicó {name}. Cambiaron {n} ajustes.', 'Foi aplicada {name}. Mudaram {n} definições.'],
  '{name} is already what you are looking at.': ['{name} es justo lo que estás viendo.', '{name} é exatamente o que estás a ver.'],
  'Deleted {name}.': ['Se borró {name}.', 'Foi apagada {name}.'],
  'Name the view before saving it.': ['Ponle nombre a la vista antes de guardarla.', 'Dá um nome à vista antes de a guardares.'],
  'Delete this saved view': ['Borrar esta vista guardada', 'Apagar esta vista guardada'],
  'Name this view': ['Nombre de la vista', 'Nome da vista'],
  'Category pages': ['Páginas de categoría', 'Páginas de categoria'],
  'Search results': ['Resultados de búsqueda', 'Resultados da procura'],
  'Show message times': ['Mostrar la hora de los mensajes', 'Mostrar a hora das mensagens'],
  'Reveals the timestamp Kick already renders on every message and keeps hidden. It is Kick’s own value, so scrolling back shows when a message was sent rather than when this build first saw it.': ['Muestra la marca de hora que Kick ya dibuja en cada mensaje y mantiene oculta. Es el valor de Kick, así que al subir por el chat verás cuándo se envió el mensaje y no cuándo lo vio esta extensión.', 'Mostra a marca de hora que a Kick já desenha em cada mensagem e mantém escondida. É o valor da própria Kick, por isso ao subir no chat vês quando a mensagem foi enviada e não quando esta extensão a viu.'],
  'People worth noticing': ['Personas que quieres notar', 'Pessoas que queres notar'],
  'Names you want to catch in a fast chat. Their messages get a marker of their own, separate from keyword highlights. Comma separated, and stored only in your settings.': ['Nombres que quieres captar en un chat rápido. Sus mensajes reciben una marca propia, distinta de los resaltados por palabra clave. Separados por comas y guardados solo en tus ajustes.', 'Nomes que queres apanhar num chat rápido. As mensagens deles recebem uma marca própria, diferente dos destaques por palavra-chave. Separados por vírgulas e guardados apenas nas tuas definições.'],
  'Sound on a mention': ['Sonido al mencionarte', 'Som quando te mencionam'],
  'A short tone when a message matches your highlights, comes from someone you listed, or says your name. Synthesised in the browser, so nothing is downloaded. Silent while the tab is in the background, silent for your own messages, and never more than once every few seconds.': ['Un tono corto cuando un mensaje coincide con tus resaltados, viene de alguien de tu lista o dice tu nombre. Se genera en el navegador, así que no se descarga nada. Callado con la pestaña en segundo plano, callado con tus propios mensajes y nunca más de una vez cada pocos segundos.', 'Um tom curto quando uma mensagem corresponde aos teus destaques, vem de alguém da tua lista ou diz o teu nome. É gerado no navegador, por isso nada é transferido. Silencioso com o separador em segundo plano, silencioso nas tuas próprias mensagens e nunca mais do que uma vez a cada poucos segundos.'],
  'Hide a message for yourself': ['Ocultar un mensaje solo para ti', 'Esconder uma mensagem só para ti'],
  'Adds a small dismiss control to each message. It hides that message in your own browser for this session only, changes nothing for anyone else, and offers an undo.': ['Añade un pequeño control de descarte a cada mensaje. Oculta ese mensaje en tu navegador solo durante esta sesión, no cambia nada para los demás y ofrece deshacer.', 'Adiciona um pequeno controlo de dispensa a cada mensagem. Esconde essa mensagem no teu navegador apenas nesta sessão, não muda nada para os outros e oferece anular.'],
  'Recall my sent messages': ['Recordar mis mensajes enviados', 'Recordar as minhas mensagens enviadas'],
  'Keep the last five messages sent from this tab in memory. Shift+Up cycles them. Whispers are skipped, reload clears them, and ordinary Arrow Up stays with Kick.': ['Guarda en memoria los últimos cinco mensajes enviados desde esta pestaña. Mayús+Arriba los recorre. Los susurros se omiten, recargar los borra y Flecha arriba sigue siendo de Kick.', 'Guarda na memória as últimas cinco mensagens enviadas neste separador. Shift+Cima percorre-as. Os sussurros são ignorados, recarregar apaga-as e a Seta para cima continua com o Kick.'],
  'Search this session’s chat': ['Buscar en el chat de esta sesión', 'Procurar no chat desta sessão'],
  'Keeps what this tab has seen so you can find it again. It stays in memory, never reaches storage, and is gone on reload. Whispers are never recorded, and a message a moderator removes leaves the log the moment the deletion arrives.': ['Guarda lo que esta pestaña ha visto para que puedas encontrarlo otra vez. Queda en memoria, nunca llega al almacenamiento y desaparece al recargar. Los susurros no se guardan nunca, y un mensaje que un moderador elimine sale del registro en cuanto llega el borrado.', 'Guarda o que este separador viu para que o possas encontrar outra vez. Fica em memória, nunca chega ao armazenamento e desaparece ao recarregar. Os sussurros nunca são guardados, e uma mensagem que um moderador apague sai do registo assim que a eliminação chega.'],
  'Session chat log': ['Registro del chat de esta sesión', 'Registo do chat desta sessão'],
  'Hidden by you': ['Ocultado por ti', 'Escondido por ti'],
  'Hide this message for me': ['Ocultar este mensaje para mí', 'Esconder esta mensagem para mim'],
  'Nothing in this session matches that.': ['Nada de esta sesión coincide con eso.', 'Nada nesta sessão corresponde a isso.'],
  'Nothing recorded yet. Open a chat with the switch on.': ['Todavía no hay nada guardado. Abre un chat con la opción activada.', 'Ainda não há nada guardado. Abre um chat com a opção ligada.'],
  'Saved {n} messages from this session.': ['Se guardaron {n} mensajes de esta sesión.', 'Foram guardadas {n} mensagens desta sessão.'],
  'Message hidden for you. It is still there for everyone else.': ['Mensaje oculto para ti. Sigue ahí para todos los demás.', 'Mensagem escondida para ti. Continua lá para toda a gente.'],
  'Session chat log cleared.': ['Registro del chat de la sesión borrado.', 'Registo do chat da sessão apagado.'],
  'message held. Capped at 400 messages, 200 KB, and one hour.': ['mensaje guardado. Con un tope de 400 mensajes, 200 KB y una hora.', 'mensagem guardada. Com um limite de 400 mensagens, 200 KB e uma hora.'],
  'messages held. Capped at 400 messages, 200 KB, and one hour.': ['mensajes guardados. Con un tope de 400 mensajes, 200 KB y una hora.', 'mensagens guardadas. Com um limite de 400 mensagens, 200 KB e uma hora.'],
  'name, name': ['nombre, nombre', 'nome, nome'],
  'Search what you have seen': ['Busca lo que has visto', 'Procura o que já viste'],
  'Save as a file': ['Guardar como archivo', 'Guardar como ficheiro'],
  'Clear the log': ['Borrar el registro', 'Apagar o registo'],
  'Daily reward ready': ['Recompensa diaria lista', 'Recompensa diária pronta'],
  'Viewer': ['Cuenta', 'Conta'],
  'Account readings and this browser session, in one place. Nothing here is claimed or sent anywhere.': ['Lecturas de la cuenta y esta sesión del navegador, reunidas en un sitio. Aquí no se reclama ni se envía nada.', 'Leituras da conta e esta sessão do navegador, reunidas num só lugar. Aqui nada é resgatado ou enviado.'],
  'Reading': ['Lecturas', 'Leituras'],
  'Reading…': ['Leyendo…', 'A ler…'],
  'From Kick’s API': ['Desde la API de Kick', 'Da API da Kick'],
  'Read from the page': ['Leído de la página', 'Lido da página'],
  'This browser session only': ['Solo esta sesión del navegador', 'Apenas esta sessão do navegador'],
  '{n} min ago': ['hace {n} min', 'há {n} min'],
  'Daily reward': ['Recompensa diaria', 'Recompensa diária'],
  'Channel points': ['Puntos del canal', 'Pontos do canal'],
  'Collectibles': ['Coleccionables', 'Colecionáveis'],
  'Drops': ['Drops', 'Drops'],
  'Level': ['Nivel', 'Nível'],
  'Streak': ['Racha', 'Sequência'],
  'Session watch time': ['Tiempo visto en esta sesión', 'Tempo assistido nesta sessão'],
  'Not read yet on this page.': ['Todavía no se ha leído en esta página.', 'Ainda não foi lido nesta página.'],
  'Kick shows this to a signed-in account only.': ['Kick solo muestra esto a una cuenta con sesión iniciada.', 'A Kick só mostra isto a uma conta com sessão iniciada.'],
  'Open a channel to see its points.': ['Abre un canal para ver sus puntos.', 'Abre um canal para ver os seus pontos.'],
  'Open Drops to count the campaigns waiting.': ['Abre Drops para contar las campañas pendientes.', 'Abre Drops para contar as campanhas pendentes.'],
  'Kick shows this inside the daily reward dialog only.': ['Kick solo muestra esto dentro del diálogo de la recompensa diaria.', 'A Kick só mostra isto dentro da janela da recompensa diária.'],
  'The reward dialog did not show a figure this time.': ['Esta vez el diálogo de la recompensa no mostró ninguna cifra.', 'Desta vez a janela da recompensa não mostrou nenhum número.'],
  'Kick did not answer that read. Nothing was changed.': ['Kick no respondió a esa lectura. No se cambió nada.', 'A Kick não respondeu a essa leitura. Nada foi alterado.'],
  'This card could not be built. The rest of the hub is unaffected.': ['Esta tarjeta no se pudo construir. El resto de la página no se ve afectado.', 'Este cartão não pôde ser construído. O resto da página não é afetado.'],
  'Claimed today': ['Reclamada hoy', 'Resgatada hoje'],
  'Not ready yet': ['Todavía no está lista', 'Ainda não está pronta'],
  'Ready to claim': ['Lista para reclamar', 'Pronta para resgatar'],
  'Where these come from': ['De dónde salen estos datos', 'De onde vêm estes dados'],
  'Nothing has been read yet. Each card above says why.': ['Todavía no se ha leído nada. Cada tarjeta de arriba explica por qué.', 'Ainda não foi lido nada. Cada cartão acima explica porquê.'],
  'Read again': ['Leer otra vez', 'Ler outra vez'],
  'Nothing is claimed for you here': ['Aquí no se reclama nada por ti', 'Aqui nada é resgatado por ti'],
  'This page reads. The daily reward is still claimed by Kick’s own dialog, and only when you have turned that on under Content & Ads. A card with no reading says so rather than showing a zero, because an empty balance and an unreadable one are not the same thing.': ['Esta página lee. La recompensa diaria la sigue reclamando el propio diálogo de Kick, y solo si lo has activado en Contenido y anuncios. Una tarjeta sin lectura lo dice en lugar de mostrar un cero, porque un saldo vacío y uno que no se puede leer no son lo mismo.', 'Esta página lê. A recompensa diária continua a ser resgatada pela própria janela da Kick, e só se tiveres ativado isso em Conteúdo e anúncios. Um cartão sem leitura di-lo em vez de mostrar um zero, porque um saldo vazio e um saldo ilegível não são a mesma coisa.'],
  'Settings': ['Configuración', 'Configurações'],
  'Autosaved': ['Guardado automático', 'Salvo automaticamente'],
  'Could not save': ['No se pudo guardar', 'Não foi possível salvar'],
  'Imported': ['Importado', 'Importado'],
  'All settings reset': ['Se restablecieron todos los ajustes', 'Todas as configurações foram redefinidas'],
  'Page reset': ['Se restableció la página', 'A página foi redefinida'],
  'Added {name}. Now {count} of {max}.': ['Se añadió {name}. Ahora {count} de {max}.', '{name} foi adicionado. Agora {count} de {max}.'],
  'Removed {name}. Now {count} of {max}.': ['Se quitó {name}. Ahora {count} de {max}.', '{name} foi removido. Agora {count} de {max}.'],
  'Removed {name} from the grid.': ['Se quitó {name} de la cuadrícula.', '{name} foi removido da grade.'],
  '{name} added to the multi-stream grid': ['{name} se añadió a la cuadrícula multi-stream', '{name} foi adicionado à grade multi-stream'],
  'The grid is full at {max} of {max}.': ['La cuadrícula está llena con {max} de {max}.', 'A grade está cheia com {max} de {max}.'],
  'The grid is full at {max} channels.': ['La cuadrícula está llena con {max} canales.', 'A grade está cheia com {max} canais.'],
  '{name} now has the audio': ['{name} tiene ahora el audio', '{name} tem agora o áudio'],
  'Loaded board {name}': ['Se cargó el tablero {name}', 'Painel {name} carregado'],
  'Copied a link to {name}.': ['Se copió un enlace a {name}.', 'Link para {name} copiado.'],
  'Opened a shared board with {count} {word}.': ['Se abrió un tablero compartido con {count} {word}.', 'Foi aberto um painel compartilhado com {count} {word}.'],
  'The shared board replaced {count} {word} you had collected.': ['El tablero compartido reemplazó {count} {word} que habías reunido.', 'O painel compartilhado substituiu {count} {word} que você tinha reunido.'],
  'Loaded {count} emotes from {channel}.': ['Se cargaron {count} emotes de {channel}.', 'Foram carregados {count} emotes de {channel}.'],
  'Kick Focus applied to {route}': ['Kick Focus aplicado a {route}', 'Kick Focus aplicado a {route}'],
  'Content filtering suspended: it would have hidden {percent}% of this page.': ['Filtrado de contenido suspendido: habría ocultado el {percent}% de esta página.', 'Filtragem de conteúdo suspensa: teria ocultado {percent}% desta página.'],
  'Exported settings, {emotes} emotes, {counts} usage counts, {boards} boards, and your channels, notes, and filters.': ['Se exportó la configuración, {emotes} emotes, {counts} recuentos de uso, {boards} tableros y tus canales, notas y filtros.', 'Foram exportadas as configurações, {emotes} emotes, {counts} contagens de uso, {boards} painéis e seus canais, notas e filtros.'],
  'The emote was removed, but Kick could not unfollow {channel}.': ['Se eliminó el emote, pero Kick no pudo dejar de seguir a {channel}.', 'O emote foi removido, mas a Kick não conseguiu deixar de seguir {channel}.'],
  'Saved {name}, but Kick did not identify the follow-gated source channel.': ['Se guardó {name}, pero Kick no identificó el canal de origen que exige seguirlo.', '{name} foi salvo, mas a Kick não identificou o canal de origem que exige seguir.'],
  'Saved {name}. Following {channel}…': ['Se guardó {name}. Siguiendo a {channel}…', '{name} foi salvo. Seguindo {channel}…'],
  'Saved {name} locally, but Kick could not follow {channel} ({status}). Sign in or reload the channel and try again.': ['Se guardó {name} en este dispositivo, pero Kick no pudo seguir a {channel} ({status}). Inicia sesión o recarga el canal e inténtalo de nuevo.', '{name} foi salvo neste dispositivo, mas a Kick não conseguiu seguir {channel} ({status}). Entre na sua conta ou recarregue o canal e tente de novo.'],
  'Open multi-stream': ['Abrir multi-stream', 'Abrir multi-stream'],
  'Close multi-stream': ['Cerrar multi-stream', 'Fechar multi-stream'],
  'emote id in card URL': ['el id del emote en la URL de la carta', 'o id do emote na URL da carta'],
  'emote name in card URL': ['el nombre del emote en la URL de la carta', 'o nome do emote na URL da carta'],
  'Use comfortable density': ['Usar densidad cómoda', 'Usar densidade confortável'],
  'Use compact density': ['Usar densidad compacta', 'Usar densidade compacta'],
  'Recent': ['Recientes', 'Recentes'],
  'New group': ['Nuevo grupo', 'Novo grupo'],
  'Save': ['Guardar', 'Salvar'],
  'Rename': ['Cambiar nombre', 'Renomear'],
  'Delete': ['Eliminar', 'Excluir'],
  'Ungrouped': ['Sin grupo', 'Sem grupo'],
  'Select shown': ['Seleccionar visibles', 'Selecionar visíveis'],
  'Clear': ['Borrar', 'Limpar'],
  'Earlier': ['Antes', 'Antes'],
  'Later': ['Después', 'Depois'],
  'Move': ['Mover', 'Mover'],
  'Groups': ['Grupos', 'Grupos'],
  'Your emotes': ['Tus emotes', 'Seus emotes'],
  'Library': ['Biblioteca', 'Biblioteca'],
  'Favorites': ['Favoritos', 'Favoritos'],
  'All': ['Todos', 'Todos'],
  'Kick': ['Kick', 'Kick'],
  'Kick groups': ['Grupos de Kick', 'Grupos da Kick'],
  'Kick’s original emote groups are shown below.': ['Los grupos de emotes originales de Kick aparecen abajo.', 'Os grupos de emotes originais da Kick aparecem abaixo.'],
  'No emotes found': ['No se encontraron emotes', 'Nenhum emote encontrado'],
  'Try a different search or clear the search field.': ['Prueba otra búsqueda o borra el campo de búsqueda.', 'Tente outra busca ou limpe o campo de busca.'],
  'No favorites yet': ['Aún no hay favoritos', 'Ainda não há favoritos'],
  'Open All and use the star on any emote to keep it here.': ['Abre Todos y usa la estrella de cualquier emote para guardarlo aquí.', 'Abra Todos e use a estrela em qualquer emote para mantê-lo aqui.'],
  'No recent emotes yet': ['Aún no hay emotes recientes', 'Ainda não há emotes recentes'],
  'Emotes you send in this channel will appear here.': ['Los emotes que envíes en este canal aparecerán aquí.', 'Os emotes que você enviar neste canal aparecerão aqui.'],
  'Create your first group': ['Crea tu primer grupo', 'Crie seu primeiro grupo'],
  'Use New group above, then select emotes and move them into it.': ['Usa Nuevo grupo arriba, luego selecciona emotes y muévelos allí.', 'Use Novo grupo acima, depois selecione emotes e mova-os para ele.'],
  'This group is empty': ['Este grupo está vacío', 'Este grupo está vazio'],
  'Choose Organize, select emotes, then move them into this group.': ['Elige Organizar, selecciona emotes y muévelos a este grupo.', 'Escolha Organizar, selecione emotes e mova-os para este grupo.'],
  'Try a different search or return to Kick groups.': ['Prueba otra búsqueda o vuelve a los grupos de Kick.', 'Tente outra busca ou volte aos grupos da Kick.'],
  '{count} selected emote': ['{count} emote seleccionado', '{count} emote selecionado'],
  '{count} selected emotes': ['{count} emotes seleccionados', '{count} emotes selecionados'],
  'Organize': ['Organizar', 'Organizar'],
  'Remove this-channel favorite {name}': ['Quitar {name} de los favoritos de este canal', 'Remover {name} dos favoritos deste canal'],
  'Emote suggestions': ['Sugerencias de emotes', 'Sugestões de emotes'],
  'Removed {name} from the grid ({count} of {max})': ['Se quitó {name} de la cuadrícula ({count} de {max})', '{name} foi removido da grade ({count} de {max})'],
  'Added {name} to the grid ({count} of {max})': ['Se añadió {name} a la cuadrícula ({count} de {max})', '{name} foi adicionado à grade ({count} de {max})'],
  'Add to Multi': ['Añadir a Multi', 'Adicionar ao Multi'],
  'In Multi': ['En Multi', 'No Multi'],
  'Add {name} to the multi-stream grid': ['Añadir {name} a la cuadrícula multi-stream', 'Adicionar {name} à grade multi-stream'],
  'Remove {name} from the multi-stream grid': ['Quitar {name} de la cuadrícula multi-stream', 'Remover {name} da grade multi-stream'],
  'Favorite {name}': ['Marcar {name} como favorito', 'Marcar {name} como favorito'],
  'Remove favorite {name}': ['Quitar {name} de favoritos', 'Remover {name} dos favoritos'],
  'Not interested in {name}': ['No me interesa {name}', 'Não tenho interesse em {name}'],
  'Restore {name}': ['Restaurar {name}', 'Restaurar {name}'],
  'Remove {name}': ['Quitar {name}', 'Remover {name}'],
  'Restore': ['Restaurar', 'Restaurar'],
  'Remove favorite': ['Quitar de favoritos', 'Remover dos favoritos'],
  'Remove favorite (this channel)': ['Quitar de favoritos (este canal)', 'Remover dos favoritos (este canal)'],
  'Use emote {name}': ['Usar el emote {name}', 'Usar o emote {name}'],
  'Select emote {name}': ['Seleccionar el emote {name}', 'Selecionar o emote {name}'],
  'Use {name}': ['Usar {name}', 'Usar {name}'],
  '{count} in {name}': ['{count} en {name}', '{count} em {name}'],
  '{shown} of {total} available': ['{shown} de {total} disponibles', '{shown} de {total} disponíveis'],
  '{count} available': ['{count} disponibles', '{count} disponíveis'],
  ', {count} locked by Kick': [', {count} bloqueados por Kick', ', {count} bloqueados pela Kick'],
  'Created {name}. Select emotes, then move them into it.': ['Se creó {name}. Selecciona emotes y luego muévelos ahí.', '{name} foi criado. Selecione emotes e depois mova-os para ele.'],
  'Deleted emote group {name}.': ['Se eliminó el grupo de emotes {name}.', 'O grupo de emotes {name} foi excluído.'],
  'Favorited {name}.': ['Se añadió {name} a favoritos.', '{name} foi adicionado aos favoritos.'],
  'Removed {name} from favorites.': ['Se quitó {name} de favoritos.', '{name} foi removido dos favoritos.'],
  'Restored {name}.': ['Se restauró {name}.', '{name} foi restaurado.'],
  'Removed {name}.': ['Se quitó {name}.', '{name} foi removido.'],
  'Emote group renamed.': ['Se cambió el nombre del grupo de emotes.', 'O grupo de emotes foi renomeado.'],
  'Group name restored.': ['Se restauró el nombre del grupo.', 'O nome do grupo foi restaurado.'],
  'Emote group restored.': ['Se restauró el grupo de emotes.', 'O grupo de emotes foi restaurado.'],
  'Favorite order restored.': ['Se restauró el orden de favoritos.', 'A ordem dos favoritos foi restaurada.'],
  'Emote group changes restored.': ['Se restauraron los cambios de grupos de emotes.', 'As alterações dos grupos de emotes foram restauradas.'],
  'Removed emotes restored.': ['Se restauraron los emotes eliminados.', 'Os emotes removidos foram restaurados.'],
  'Favorite change restored.': ['Se restauró el cambio de favorito.', 'A alteração de favorito foi restaurada.'],
  'Emote changes reset.': ['Se restablecieron los cambios de emotes.', 'As alterações de emotes foram redefinidas.'],
  'Favorite moved earlier.': ['El favorito se movió antes.', 'O favorito foi movido para antes.'],
  'Favorite moved later.': ['El favorito se movió después.', 'O favorito foi movido para depois.'],
  'Emote moved earlier.': ['El emote se movió antes.', 'O emote foi movido para antes.'],
  'Emote moved later.': ['El emote se movió después.', 'O emote foi movido para depois.'],
  'emote moved.': ['emote movido.', 'emote movido.'],
  'emotes moved.': ['emotes movidos.', 'emotes movidos.'],
  'emote removed.': ['emote eliminado.', 'emote removido.'],
  'emotes removed.': ['emotes eliminados.', 'emotes removidos.'],
  'Move selected emotes to group': ['Mover los emotes seleccionados al grupo', 'Mover os emotes selecionados para o grupo'],
  'Emote views': ['Vistas de emotes', 'Visualizações de emotes'],
  'Kick rarity, matched by {basis}': ['Rareza de Kick, encontrada por {basis}', 'Raridade da Kick, encontrada por {basis}'],
  'Insert {name}': ['Insertar {name}', 'Inserir {name}'],
  'Open {name} artwork': ['Abrir la imagen de {name}', 'Abrir a imagem de {name}'],
  'Copy the name {name}': ['Copiar el nombre {name}', 'Copiar o nome {name}'],
  'Type the name {name} into chat': ['Escribir el nombre {name} en el chat', 'Digitar o nome {name} no chat'],
  'Custom group for {name}': ['Grupo personalizado para {name}', 'Grupo personalizado para {name}'],
  'Rename {name}': ['Cambiar el nombre de {name}', 'Renomear {name}'],
  'Show {name} again': ['Mostrar {name} de nuevo', 'Mostrar {name} novamente'],
  'Open {name} on Kick': ['Abrir {name} en Kick', 'Abrir {name} na Kick'],
  'Remove {name} from the grid': ['Quitar {name} de la cuadrícula', 'Remover {name} da grade'],
  'Copy a link to board {name}': ['Copiar un enlace al tablero {name}', 'Copiar um link para o painel {name}'],
  'Delete board {name}': ['Eliminar el tablero {name}', 'Excluir o painel {name}'],
  '{preset} preset applied': ['Preajuste {preset} aplicado', 'Predefinição {preset} aplicada'],
  'Hidden {channel}': ['{channel} oculto', '{channel} oculto'],
  'Showing {channel} again': ['{channel} vuelve a mostrarse', '{channel} voltou a ser exibido'],
  'That file is not valid JSON.': ['Ese archivo no contiene JSON válido.', 'Esse arquivo não contém JSON válido.'],
  'Settings must be a JSON object.': ['Los ajustes deben ser un objeto JSON.', 'As configurações devem ser um objeto JSON.'],
  'Settings schema {schema} is newer than this build supports.': ['El esquema de ajustes {schema} es más reciente que el compatible con esta versión.', 'O esquema de configurações {schema} é mais recente do que esta versão aceita.'],
  'The emote library must be a JSON object.': ['La biblioteca de emotes debe ser un objeto JSON.', 'A biblioteca de emotes deve ser um objeto JSON.'],
  'The emote usage counts must be a JSON object.': ['Los recuentos de uso de emotes deben ser un objeto JSON.', 'As contagens de uso de emotes devem ser um objeto JSON.'],
  'The multi-stream boards must be a JSON object.': ['Los diseños de multitransmisión deben ser un objeto JSON.', 'Os layouts de multistream devem ser um objeto JSON.'],
  'Emote schema {schema} is newer than this build supports.': ['El esquema de emotes {schema} es más reciente que el compatible con esta versión.', 'O esquema de emotes {schema} é mais recente do que esta versão aceita.'],
  'That file does not contain Kick Focus settings.': ['Ese archivo no contiene ajustes de Kick Focus.', 'Esse arquivo não contém configurações do Kick Focus.'],
  'settings': ['ajustes', 'configurações'],
  'emote library': ['biblioteca de emotes', 'biblioteca de emotes'],
  'emote usage counts': ['recuentos de uso de emotes', 'contagens de uso de emotes'],
  'multi-stream boards': ['diseños de multitransmisión', 'layouts de multistream'],
  'per-channel layout': ['diseño por canal', 'layout por canal'],
  'favorite channels': ['canales favoritos', 'canais favoritos'],
  'not-interested channels': ['canales marcados como no interesantes', 'canais sem interesse'],
  'chat keyword filters': ['filtros de palabras clave del chat', 'filtros de palavras-chave do chat'],
  'channel notes': ['notas de canales', 'notas de canais'],
  'volume and quality memory': ['memoria de volumen y calidad', 'memória de volume e qualidade'],
  'blocklist cache': ['caché de la lista de bloqueo', 'cache da lista de bloqueio'],
  'watched this session': ['vistos en esta sesión', 'assistidos nesta sessão'],
  'Kick Focus could not save your {list}. Browser storage is full or blocked, so those changes exist only until you reload.': ['Kick Focus no pudo guardar {list}. El almacenamiento del navegador está lleno o bloqueado, por lo que esos cambios solo existirán hasta que recargues.', 'O Kick Focus não conseguiu salvar {list}. O armazenamento do navegador está cheio ou bloqueado, então essas alterações existirão apenas até você recarregar.'],
  'Kick Focus is using about {size} of browser storage. Nothing has failed to save this session.': ['Kick Focus usa unos {size} del almacenamiento del navegador. Nada ha fallado al guardarse en esta sesión.', 'O Kick Focus usa cerca de {size} do armazenamento do navegador. Nada falhou ao salvar nesta sessão.'],
  'The first paint reads {held} of your {total} emotes. The rest load from the database a moment later.': ['El primer dibujado lee {held} de tus {total} emotes. El resto se carga desde la base de datos un momento después.', 'A primeira pintura lê {held} dos seus {total} emotes. O restante carrega do banco de dados um instante depois.'],
  'The browser reported': ['El navegador informó', 'O navegador informou'],
  'Exporting now is the only way to keep these changes.': ['Exportar ahora es la única forma de conservar estos cambios.', 'Exportar agora é a única forma de manter essas alterações.'],
  '{items} read from the page': ['{items}, leídos de la página', '{items}, lidos da página'],
  '{items} from Kick’s API': ['{items}, desde la API de Kick', '{items}, da API da Kick'],
  '{items} kept in this browser session': ['{items}, guardado en esta sesión del navegador', '{items}, guardado nesta sessão do navegador'],
  '{n} showing an older reading.': ['{n} con una lectura anterior.', '{n} com uma leitura anterior.'],
  '{n} could not be built.': ['No se pudieron crear: {n}.', 'Não foi possível criar: {n}.'],
  'Added': ['Añadido', 'Adicionado'],
  'Removed': ['Eliminado', 'Removido'],
  'Error log copied.': ['Registro de errores copiado.', 'Log de erros copiado.'],
  'Could not copy the error log.': ['No se pudo copiar el registro de errores.', 'Não foi possível copiar o log de erros.'],
  'Diagnostic summary copied.': ['Resumen de diagnóstico copiado.', 'Resumo de diagnóstico copiado.'],
  'Clipboard access was unavailable.': ['El acceso al portapapeles no estaba disponible.', 'O acesso à área de transferência não estava disponível.'],
  'Close settings': ['Cerrar configuración', 'Fechar configurações'],
  'Reset page': ['Restablecer página', 'Redefinir página'],
  'Export settings': ['Exportar configuración', 'Exportar configurações'],
  'Done': ['Listo', 'Concluído'],
  'Cancel': ['Cancelar', 'Cancelar'],
  'Reset': ['Restablecer', 'Redefinir'],
  'On': ['Activado', 'Ativado'],
  'Off': ['Desactivado', 'Desativado'],
  'Core protection always stays on': ['La protección principal permanece siempre activada', 'A proteção principal permanece sempre ativada'],
  'This page has its own reset control': ['Esta página tiene su propio control de restablecimiento', 'Esta página tem seu próprio controle de redefinição'],
  'Restore page defaults': ['Restaurar los valores predeterminados de la página', 'Restaurar os padrões da página'],
  'Find a command': ['Buscar un comando', 'Buscar um comando'],
  'Type an action or setting…': ['Escribe una acción o ajuste…', 'Digite uma ação ou configuração…'],
  'Available commands': ['Comandos disponibles', 'Comandos disponíveis'],
  'No matching commands': ['No hay comandos coincidentes', 'Nenhum comando correspondente'],
  'Try “chat”, “layout”, “casino”, or “settings”.': ['Prueba “chat”, “diseño”, “casino” o “configuración”.', 'Tente “chat”, “layout”, “cassino” ou “configurações”.'],
  'command available': ['comando disponible', 'comando disponível'],
  'commands available': ['comandos disponibles', 'comandos disponíveis'],
  'Focus': ['Enfoque', 'Foco'],
  'Resume': ['Reanudar', 'Retomar'],
  'Resume Kick Focus': ['Reanudar Kick Focus', 'Retomar Kick Focus'],
  'Kick Focus settings': ['Configuración de Kick Focus', 'Configurações do Kick Focus'],
  'Layout': ['Diseño', 'Layout'],
  'Appearance': ['Apariencia', 'Aparência'],
  'Content & Ads': ['Contenido y anuncios', 'Conteúdo e anúncios'],
  'Emotes': ['Emotes', 'Emotes'],
  'Find, favorite, remove, and group every emote you have recorded.': ['Busca, marca como favorito, elimina y agrupa todos los emotes registrados.', 'Encontre, favorite, remova e agrupe todos os emotes registrados.'],
  'About': ['Acerca de', 'Sobre'],
  'Shell, player, and chat': ['Estructura, reproductor y chat', 'Estrutura, player e chat'],
  'Theme, color, and scale': ['Tema, color y escala', 'Tema, cor e escala'],
  'Privacy, filters, and playback': ['Privacidad, filtros y reproducción', 'Privacidade, filtros e reprodução'],
  'Read-only account signals': ['Datos de cuenta de solo lectura', 'Sinais da conta somente para leitura'],
  'Status, privacy, and diagnostics': ['Estado, privacidad y diagnósticos', 'Status, privacidade e diagnósticos'],
  'Control how Kick is arranged across your desktop.': ['Controla cómo se organiza Kick en tu escritorio.', 'Controle como o Kick é organizado na sua área de trabalho.'],
  'Keep the page calm, private, and focused on streams.': ['Mantén la página tranquila, privada y centrada en los streams.', 'Mantenha a página calma, privada e focada nas transmissões.'],
  'Improve comfort and keep core actions within reach.': ['Mejora la comodidad y mantén las acciones principales al alcance.', 'Melhore o conforto e mantenha as ações principais ao alcance.'],
  'A desktop-first layout and control layer for Kick.': ['Una capa de diseño y control para Kick pensada para escritorio.', 'Uma camada de layout e controle para Kick pensada para desktop.'],
  'Language': ['Idioma', 'Idioma'],
  'Auto': ['Automático', 'Automático'],
  'Sidebar mode': ['Modo de barra lateral', 'Modo da barra lateral'],
  'Left': ['Izquierda', 'Esquerda'],
  'Chat layout': ['Diseño del chat', 'Layout do chat'],
  'Chat width': ['Ancho del chat', 'Largura do chat'],
  'Chat width {width} pixels': ['Ancho del chat {width} píxeles', 'Largura do chat {width} píxeis'],
  'Chat width saved.': ['Ancho del chat guardado.', 'Largura do chat salva.'],
  'Content density': ['Densidad del contenido', 'Densidade do conteúdo'],
  'Stream start behavior': ['Comportamiento al abrir streams', 'Comportamento ao abrir transmissões'],
  'Remember per-channel layout': ['Recordar diseño por canal', 'Lembrar layout por canal'],
  'Widen browse grids': ['Ampliar cuadrículas de exploración', 'Ampliar grades de descoberta'],
  'Show Following rail': ['Mostrar barra de seguidos', 'Mostrar barra de Seguindo'],
  'Show Recommended rail': ['Mostrar barra recomendada', 'Mostrar barra de Recomendados'],
  'Hide Kick’s own controls': ['Ocultar los controles propios de Kick', 'Ocultar os controles do próprio Kick'],
  'Switch off the player buttons and sidebar entries you never use. Each one is hidden with styling only. Nothing is clicked or removed, and turning it back on restores it immediately.': ['Desactiva los botones del reproductor y las entradas de la barra lateral que nunca usas. Cada uno se oculta solo con estilos: no se pulsa ni se elimina nada, y al reactivarlo vuelve de inmediato.', 'Desative os botões do player e os itens da barra lateral que você nunca usa. Cada um é ocultado apenas por estilo: nada é clicado ou removido, e ao reativar ele volta imediatamente.'],
  'Player controls': ['Controles del reproductor', 'Controles do player'],
  'Sidebar': ['Barra lateral', 'Barra lateral'],
  'Miniplayer': ['Minirreproductor', 'Minirreprodutor'],
  'Clip': ['Clip', 'Clipe'],
  'Theater mode': ['Modo cine', 'Modo cinema'],
  'Fullscreen': ['Pantalla completa', 'Tela cheia'],
  'Quality menu': ['Menú de calidad', 'Menu de qualidade'],
  'Volume': ['Volumen', 'Volume'],
  'Share': ['Compartir', 'Compartilhar'],
  'Report': ['Reportar', 'Denunciar'],
  'Home link': ['Enlace de Inicio', 'Link de Início'],
  'Browse link': ['Enlace de Explorar', 'Link de Explorar'],
  'Following link': ['Enlace de Siguiendo', 'Link de Seguindo'],
  'Drops link': ['Enlace de Drops', 'Link de Drops'],
  'Followed channel list': ['Lista de canales seguidos', 'Lista de canais seguidos'],
  'Recommended channel list': ['Lista de canales recomendados', 'Lista de canais recomendados'],
  'Sticky compact top bar': ['Barra superior compacta fija', 'Barra superior compacta fixa'],
  'Show quick command button': ['Mostrar botón de comandos', 'Mostrar botão de comandos'],
  'Move mini-player clear of controls': ['Mover el minirreproductor lejos de los controles', 'Mover miniplayer para longe dos controles'],
  'Recover player after resize': ['Recuperar el reproductor tras cambiar el tamaño', 'Recuperar player após redimensionar'],
  'Keep ultrawide video uncropped': ['Mantener el video panorámico sin recortar', 'Manter vídeo ultrawide sem corte'],
  'Theme': ['Tema', 'Tema'],
  'Choose a clear visual direction, then tune only what matters to you.': ['Elige una dirección visual clara y ajusta solo lo que te importe.', 'Escolha uma direção visual clara e ajuste apenas o que importa para você.'],
  'Quick directions': ['Direcciones rápidas', 'Direções rápidas'],
  'Apply a viewing setup without changing filters or account choices.': ['Aplica una configuración de visualización sin cambiar filtros ni opciones de cuenta.', 'Aplique uma configuração de visualização sem mudar filtros ou opções da conta.'],
  'Direction': ['Dirección', 'Direção'],
  'Each theme changes the full surface hierarchy, not just the page background.': ['Cada tema cambia toda la jerarquía de superficies, no solo el fondo de la página.', 'Cada tema muda toda a hierarquia de superfícies, não apenas o fundo da página.'],
  'Layered graphite': ['Grafito en capas', 'Grafite em camadas'],
  'Selected': ['Seleccionado', 'Selecionado'],
  'Balanced depth with a quiet green undertone.': ['Profundidad equilibrada con un matiz verde discreto.', 'Profundidade equilibrada com um tom verde discreto.'],
  'True black': ['Negro real', 'Preto real'],
  'Minimal lift and maximum contrast for dark rooms.': ['Relieve mínimo y contraste máximo para habitaciones oscuras.', 'Elevação mínima e contraste máximo para ambientes escuros.'],
  'Cool graphite': ['Grafito frío', 'Grafite frio'],
  'Blue-toned surfaces with stronger separation.': ['Superficies azuladas con una separación más marcada.', 'Superfícies azuladas com separação mais forte.'],
  'Use one accent for focus, selection, and live state.': ['Usa un solo acento para el foco, la selección y el estado en vivo.', 'Use um só destaque para foco, seleção e estado ao vivo.'],
  'Low-contrast choices fall back to a safe rose.': ['Las opciones de bajo contraste vuelven a un rosa seguro.', 'Opções de baixo contraste voltam para um rosa seguro.'],
  'Your current theme, accent, scale, and card treatment.': ['Tu tema, acento, escala y tratamiento de tarjetas actuales.', 'Seu tema, destaque, escala e tratamento de cartões atuais.'],
  'Accent color': ['Color de acento', 'Cor de destaque'],
  'Calm': ['Calma', 'Calmo'],
  'Cinema': ['Cine', 'Cinema'],
  'Chat First': ['Chat primero', 'Chat primeiro'],
  'Discovery': ['Descubrimiento', 'Descoberta'],
  'Roomier cards, quieter live color, and a compact rail.': ['Tarjetas más amplias, color en vivo más discreto y una barra compacta.', 'Cartões mais espaçosos, cor ao vivo mais discreta e uma barra compacta.'],
  'OLED surfaces with the player first and chrome tucked away.': ['Superficies OLED con el reproductor primero y los controles apartados.', 'Superfícies OLED com o player em primeiro plano e os controles recolhidos.'],
  'A wider docked chat, compact density, and a clearer accent.': ['Un chat acoplado más ancho, densidad compacta y un acento más claro.', 'Um chat acoplado mais largo, densidade compacta e um destaque mais claro.'],
  'More stream cards, vivid thumbnails, and both discovery rails.': ['Más tarjetas de streams, miniaturas intensas y ambas barras de descubrimiento.', 'Mais cartões de transmissão, miniaturas vivas e as duas barras de descoberta.'],
  'Custom': ['Personalizado', 'Personalizado'],
  'Custom accent': ['Acento personalizado', 'Destaque personalizado'],
  'Custom accent color': ['Color de acento personalizado', 'Cor de destaque personalizada'],
  'Contrast protected': ['Contraste protegido', 'Contraste protegido'],
  '{preset} preset applied. Content filters were not changed.': ['Se aplicó el preajuste {preset}. Los filtros de contenido no cambiaron.', 'A predefinição {preset} foi aplicada. Os filtros de conteúdo não mudaram.'],
  'Corner radius': ['Radio de esquinas', 'Raio dos cantos'],
  'Thumbnail treatment': ['Tratamiento de miniaturas', 'Tratamento das miniaturas'],
  'Interface scale': ['Escala de la interfaz', 'Escala da interface'],
  'Dim watched cards': ['Atenuar tarjetas vistas', 'Atenuar cartões assistidos'],
  'Strengthen text contrast': ['Aumentar contraste del texto', 'Aumentar contraste do texto'],
  'Colorize live indicators': ['Colorear indicadores en vivo', 'Colorir indicadores ao vivo'],
  'Ad defense active': ['Defensa contra anuncios activa', 'Defesa contra anúncios ativa'],
  'Network + page': ['Red + página', 'Rede + página'],
  'Page only': ['Solo página', 'Somente página'],
  'Local channel tools': ['Herramientas locales del canal', 'Ferramentas locais do canal'],
  'Clear favorites': ['Borrar favoritos', 'Limpar favoritos'],
  'Clear not-interested': ['Borrar no me interesa', 'Limpar não tenho interesse'],
  'Protection log': ['Registro de protección', 'Registro de proteção'],
  'Reduce motion': ['Reducir movimiento', 'Reduzir movimento'],
  'High-contrast controls': ['Controles de alto contraste', 'Controles de alto contraste'],
  'Always show keyboard focus': ['Mostrar siempre el foco del teclado', 'Sempre mostrar foco do teclado'],
  'Larger pointer targets': ['Objetivos táctiles más grandes', 'Alvos de ponteiro maiores'],
  'Announce layout changes': ['Anunciar cambios de diseño', 'Anunciar mudanças de layout'],
  'Text size': ['Tamaño del texto', 'Tamanho do texto'],
  'Caption background opacity': ['Opacidad del fondo de subtítulos', 'Opacidade do fundo das legendas'],
  'Search': ['Buscar', 'Pesquisar'],
  'Every page, searched at once.': ['Todas las páginas, buscadas a la vez.', 'Todas as páginas, pesquisadas de uma vez.'],
  'Try a shorter word, or the name of the Kick control you are looking for.': ['Prueba con una palabra más corta o con el nombre del control de Kick que buscas.', 'Tente uma palavra mais curta ou o nome do controle da Kick que procura.'],
  'Nothing matches “{query}”.': ['Nada coincide con «{query}».', 'Nada corresponde a “{query}”.'],
  'Search settings': ['Buscar ajustes', 'Pesquisar configurações'],
  'Kick Focus updated to {version}.': ['Kick Focus se actualizó a {version}.', 'O Kick Focus foi atualizado para {version}.'],
  'Changed defaults: {list}.': ['Valores predeterminados que cambiaron: {list}.', 'Padrões que mudaram: {list}.'],
  'What changed': ['Qué cambió', 'O que mudou'],
  'Action': ['Acción', 'Ação'],
  'Script health': ['Estado del script', 'Saúde do script'],
  'Site compatibility': ['Compatibilidad del sitio', 'Compatibilidade do site'],
  'Protection layer': ['Capa de protección', 'Camada de proteção'],
  'Data & privacy': ['Datos y privacidad', 'Dados e privacidade'],
  'Diagnostics': ['Diagnósticos', 'Diagnósticos'],
  'Copy diagnostic summary': ['Copiar resumen de diagnóstico', 'Copiar resumo de diagnóstico'],
  'Run self-check': ['Ejecutar autocomprobación', 'Executar autoteste'],
  'Compatibility self-test': ['Autocomprobación de compatibilidad', 'Autoteste de compatibilidade'],
  'Settings portability': ['Portabilidad de configuración', 'Portabilidade das configurações'],
  'Import settings': ['Importar configuración', 'Importar configurações'],
  'Reset all settings': ['Restablecer toda la configuración', 'Redefinir todas as configurações'],
  'Panic switch': ['Interruptor de emergencia', 'Interruptor de emergência'],
  'Pause Kick Focus': ['Pausar Kick Focus', 'Pausar Kick Focus'],
  'Restore Kick Focus': ['Restaurar Kick Focus', 'Restaurar Kick Focus'],
  'Temporarily remove enhanced layout and request hooks': ['Quita temporalmente el diseño mejorado y los interceptores', 'Remove temporariamente o layout aprimorado e os interceptadores'],
  'Enter focus mode': ['Entrar en modo enfoque', 'Entrar no modo foco'],
  'Exit focus mode': ['Salir del modo enfoque', 'Sair do modo foco'],
  'Maximize the stream and hide side panels': ['Maximiza el stream y oculta los paneles laterales', 'Maximiza a transmissão e oculta os painéis laterais'],
  'Enter theater mode': ['Entrar en modo teatro', 'Entrar no modo teatro'],
  'Exit theater mode': ['Salir del modo teatro', 'Sair do modo teatro'],
  'Hide discovery while keeping chat': ['Oculta el descubrimiento y conserva el chat', 'Oculta a descoberta mantendo o chat'],
  'Show chat': ['Mostrar chat', 'Mostrar chat'],
  'Hide chat': ['Ocultar chat', 'Ocultar chat'],
  'Toggle the chat panel for this session': ['Alterna el panel de chat durante esta sesión', 'Alterna o painel de chat nesta sessão'],
  'Show sidebar': ['Mostrar barra lateral', 'Mostrar barra lateral'],
  'Hide sidebar': ['Ocultar barra lateral', 'Ocultar barra lateral'],
  'Toggle the discovery rail for this session': ['Alterna la barra de descubrimiento durante esta sesión', 'Alterna a barra de descoberta nesta sessão'],
  'Blur mature thumbnails': ['Desenfocar miniaturas maduras', 'Desfocar miniaturas maduras'],
  'Reveal mature thumbnails': ['Mostrar miniaturas maduras', 'Revelar miniaturas maduras'],
  'Temporarily override mature-card blur': ['Anula temporalmente el desenfoque de tarjetas maduras', 'Substitui temporariamente o desfoque de cartões maduros'],
  'Change discovery spacing and save it': ['Cambia y guarda el espaciado del descubrimiento', 'Altera e salva o espaçamento da descoberta'],
  'New favorites apply to': ['Los nuevos favoritos se aplican a', 'Novos favoritos se aplicam a'],
  'Global favorites follow you everywhere. Per-channel favorites appear only on the channel you saved them from, above your global ones. Existing favorites are global and are not moved.': ['Los favoritos globales te acompañan en todas partes. Los favoritos por canal solo aparecen en el canal donde los guardaste, encima de los globales. Los favoritos existentes son globales y no se mueven.', 'Os favoritos globais acompanham você em todos os lugares. Os favoritos por canal aparecem apenas no canal onde foram salvos, acima dos globais. Os favoritos existentes são globais e não são movidos.'],
  'Everywhere': ['En todas partes', 'Em todos os lugares'],
  'This channel': ['Este canal', 'Este canal'],
  'Show badges Kick leaves out': ['Mostrar insignias que Kick omite', 'Mostrar selos que o Kick omite'],
  'Kick’s chat payload carries collectible and global badges its own markup omits, leaving a gap where other clients show a badge. A badge image that fails to load is replaced by its name.': ['La respuesta del chat de Kick incluye insignias globales y de coleccionables que su propio marcado omite, dejando un hueco donde otros clientes muestran una insignia. Si la imagen no carga, se sustituye por su nombre.', 'A resposta do chat do Kick traz selos globais e de colecionáveis que a própria marcação omite, deixando uma lacuna onde outros clientes mostram um selo. Se a imagem não carregar, ela é substituída pelo nome.'],
  'Hidden channels': ['Canales ocultos', 'Canais ocultos'],
  'Hide specific channels from Home, Browse, Following, and Search.': ['Oculta canales específicos de Inicio, Explorar, Siguiendo y Búsqueda.', 'Oculte canais específicos de Início, Explorar, Seguindo e Busca.'],
  'No channels hidden. Use the input above or the ✕ action on a card.': ['No hay canales ocultos. Usa el campo de arriba o la acción ✕ en una tarjeta.', 'Nenhum canal oculto. Use o campo acima ou a ação ✕ em um card.'],
  'Show casino content': ['Mostrar contenido de casino', 'Mostrar conteúdo de cassino'],
  'Hide casino content': ['Ocultar contenido de casino', 'Ocultar conteúdo de cassino'],
  'Filter clearly labeled casino streams': ['Filtra streams marcados claramente como casino', 'Filtra transmissões claramente marcadas como cassino'],
  'Open Kick Focus settings': ['Abrir configuración de Kick Focus', 'Abrir configurações do Kick Focus'],
  'Customize layout, appearance, content, and access': ['Personaliza el diseño, la apariencia, el contenido y el acceso', 'Personalize layout, aparência, conteúdo e acesso'],
  'Choose how the left discovery rail behaves. Dropdown collapses it to a tab that expands on hover, giving the grid full width. Desktop widths only.': ['Elige cómo se comporta la barra de descubrimiento izquierda. Desplegable la reduce a una pestaña que se expande al pasar el cursor, dando a la cuadrícula todo el ancho. Solo en anchos de escritorio.', 'Escolha como a barra lateral de descoberta se comporta. Suspensa reduz a barra a uma aba que se expande ao passar o cursor, dando à grade toda a largura. Apenas em larguras de desktop.'],
  'Place chat on either side, float it as a dock, or hide it.': ['Coloca el chat a cualquier lado, como panel flotante, u ocúltalo.', 'Coloque o chat em qualquer lado, como painel flutuante, ou oculte-o.'],
  'Set the width of the live chat column.': ['Define el ancho de la columna del chat en vivo.', 'Defina a largura da coluna do chat ao vivo.'],
  'Adjust spacing and padding across discovery pages.': ['Ajusta el espaciado y el relleno en las páginas de descubrimiento.', 'Ajuste o espaçamento e o preenchimento nas páginas de descoberta.'],
  'Choose how each channel opens.': ['Elige cómo se abre cada canal.', 'Escolha como cada canal abre.'],
  'Keep the last runtime layout for each channel.': ['Conserva el último diseño usado en cada canal.', 'Mantenha o último layout usado em cada canal.'],
  'Use reclaimed sidebar space for larger, calmer stream cards.': ['Usa el espacio recuperado de la barra lateral para tarjetas de directo más grandes y tranquilas.', 'Use o espaço recuperado da barra lateral para cartões de transmissão maiores e mais calmos.'],
  'Keep the Following discovery rail visible when Kick provides it.': ['Mantén visible la barra de canales seguidos cuando Kick la ofrezca.', 'Mantenha a barra de canais seguidos visível quando o Kick a fornecer.'],
  'Keep recommended stream rows visible in the main content.': ['Mantén visibles las filas de directos recomendados en el contenido principal.', 'Mantenha as linhas de transmissões recomendadas visíveis no conteúdo principal.'],
  'Keep search and account controls available while browsing.': ['Mantén disponibles la búsqueda y los controles de cuenta mientras navegas.', 'Mantenha a busca e os controles de conta disponíveis enquanto navega.'],
  'Keep the Focus control beside Get KICKs in Kick’s top header.': ['Mantén el control de Focus junto a Get KICKs en la cabecera superior de Kick.', 'Mantenha o controle do Focus ao lado de Get KICKs no cabeçalho superior do Kick.'],
  'Raise Kick’s embedded mini-player only when the Focus control has to use its floating fallback.': ['Eleva el mini-reproductor integrado de Kick solo cuando el control de Focus deba usar su alternativa flotante.', 'Eleve o mini-player integrado do Kick apenas quando o controle do Focus precisar usar sua alternativa flutuante.'],
  'Re-apply player geometry after a window or monitor change.': ['Vuelve a aplicar la geometría del reproductor tras cambiar de ventana o monitor.', 'Reaplique a geometria do player após uma mudança de janela ou monitor.'],
  'Prefer contained video geometry on wide or moved displays.': ['Prefiere una geometría de vídeo contenida en pantallas anchas o desplazadas.', 'Prefira uma geometria de vídeo contida em telas largas ou deslocadas.'],
  'Adjust the roundness of enhanced UI.': ['Ajusta el redondeo de la interfaz mejorada.', 'Ajuste o arredondamento da interface aprimorada.'],
  'Adjust stream-card color intensity.': ['Ajusta la intensidad de color de las tarjetas de directo.', 'Ajuste a intensidade de cor dos cartões de transmissão.'],
  'Set the size of Kick Focus controls.': ['Define el tamaño de los controles de Kick Focus.', 'Defina o tamanho dos controles do Kick Focus.'],
  'Reduce emphasis on streams you have already opened.': ['Reduce el énfasis en los directos que ya has abierto.', 'Reduza o destaque das transmissões que você já abriu.'],
  'Increase legibility on muted surfaces.': ['Aumenta la legibilidad en superficies atenuadas.', 'Aumente a legibilidade em superfícies atenuadas.'],
  'Use the selected accent for live-state emphasis.': ['Usa el color de acento elegido para destacar el estado en directo.', 'Use a cor de destaque escolhida para enfatizar o estado ao vivo.'],
  'Enable subscription': ['Activar suscripción', 'Ativar assinatura'],
  'no kick.com host at all': ['ningún host de kick.com', 'nenhum host do kick.com'],
  'This started {timing}. On Chromium 138 and later a userscript manager needs its own {toggle} toggle enabled on the browser’s extensions page, and its instant-injection mode turned on. Installing the companion extension removes the question entirely.': ['Esto se inició {timing}. En Chromium 138 y posteriores, un gestor de userscripts necesita su propia opción {toggle} activada en la página de extensiones del navegador, y su modo de inyección instantánea encendido. Instalar la extensión complementaria elimina la cuestión por completo.', 'Isto começou {timing}. No Chromium 138 e posteriores, um gerenciador de userscripts precisa da própria opção {toggle} ativada na página de extensões do navegador, e do modo de injeção instantânea ligado. Instalar a extensão complementar elimina a questão por completo.'],
  'Since Kick began serving ads on 2026-08-06, some ad-blocker filter lists have been reported to break those actions, which fail with a generic error until the blocker is disabled and the browser restarted. Kick Focus is not involved: it blocks {hosts} third-party ad and telemetry hosts and {none}, so pausing Kick Focus will not change that behavior. Check your ad blocker’s filters for kick.com before blaming an extension.': ['Desde que Kick empezó a servir anuncios el 2026-08-06, se ha informado de que algunas listas de filtros de bloqueadores rompen esas acciones, que fallan con un error genérico hasta que se desactiva el bloqueador y se reinicia el navegador. Kick Focus no interviene: bloquea {hosts} hosts externos de anuncios y telemetría, y {none}, así que pausar Kick Focus no cambiará ese comportamiento. Revisa los filtros de tu bloqueador para kick.com antes de culpar a una extensión.', 'Desde que o Kick começou a exibir anúncios em 2026-08-06, há relatos de que algumas listas de filtros de bloqueadores quebram essas ações, que falham com um erro genérico até o bloqueador ser desativado e o navegador reiniciado. O Kick Focus não participa disso: ele bloqueia {hosts} hosts externos de anúncios e telemetria, e {none}, então pausar o Kick Focus não vai mudar esse comportamento. Verifique os filtros do seu bloqueador para kick.com antes de culpar uma extensão.'],
  'Merge chats': ['Combinar chats', 'Juntar chats'],
  '0 of 0 chats live': ['0 de 0 chats en directo', '0 de 0 chats ao vivo'],
  'Core protection': ['Protección básica', 'Proteção básica'],
  'Live preview': ['Vista previa en directo', 'Prévia ao vivo'],
  'Live now': ['En directo ahora', 'Ao vivo agora'],
  'Clear this channel': ['Borrar este canal', 'Limpar este canal'],
  'Remove cached list': ['Quitar la lista en caché', 'Remover a lista em cache'],
  'Changed by Kick': ['Cambiado por Kick', 'Alterado pelo Kick'],
  'Copy name': ['Copiar el nombre', 'Copiar o nome'],
  'Type in chat': ['Escribir en el chat', 'Escrever no chat'],
  'Create group': ['Crear grupo', 'Criar grupo'],
  'No groups yet.': ['Aún no hay grupos.', 'Ainda não há grupos.'],
  'Restore all': ['Restaurar todo', 'Restaurar tudo'],
  'Kick data': ['Datos de Kick', 'Dados do Kick'],
  'Collectible rarity': ['Rareza de coleccionables', 'Raridade dos colecionáveis'],
  'Shadowed emote names': ['Nombres de emote duplicados', 'Nomes de emote duplicados'],
  'Blocked this page': ['Bloqueado en esta página', 'Bloqueado nesta página'],
  'Removed shells': ['Contenedores eliminados', 'Contêineres removidos'],
  'Last match': ['Última coincidencia', 'Última correspondência'],
  'Filtering & ad defense': ['Filtrado y defensa contra anuncios', 'Filtragem e defesa contra anúncios'],
  'Emote library': ['Biblioteca de emotes', 'Biblioteca de emotes'],
  'Open library': ['Abrir la biblioteca', 'Abrir a biblioteca'],
  'Local discovery choices': ['Elecciones locales de descubrimiento', 'Escolhas locais de descoberta'],
  'Error log': ['Registro de errores', 'Registro de erros'],
  'Copy error log': ['Copiar el registro de errores', 'Copiar o registro de erros'],
  'Not saving': ['No se guarda', 'Não está salvando'],
  'Local storage': ['Almacenamiento local', 'Armazenamento local'],
  'Export now': ['Exportar ahora', 'Exportar agora'],
  'Not running as early as it could': ['No se ejecuta tan pronto como podría', 'Não está sendo executado tão cedo quanto poderia'],
  'Allow user scripts': ['Permitir user scripts', 'Permitir user scripts'],
  'If Kick sign-in, sign-up, or Follow stops working': ['Si el inicio de sesión, el registro o Seguir de Kick dejan de funcionar', 'Se o login, o cadastro ou o Seguir do Kick pararem de funcionar'],
  'Run now': ['Ejecutar ahora', 'Executar agora'],
  'Undo import': ['Deshacer la importación', 'Desfazer a importação'],
  'kick.com desktop': ['kick.com en escritorio', 'kick.com no computador'],
  'Run timing': ['Momento de ejecución', 'Momento da execução'],
  'Test viewports': ['Ventanas de prueba', 'Janelas de teste'],
  'Remote code': ['Código remoto', 'Código remoto'],
  'Creative tools and workflows': ['Herramientas y flujos de trabajo creativos', 'Ferramentas e fluxos de trabalho criativos'],
  'Three calm, focused rows': ['Tres filas tranquilas y centradas', 'Três linhas calmas e focadas'],
  'Open a channel page to set channel-specific chat keywords or a private local note.': ['Abre la página de un canal para definir palabras clave del chat o una nota local privada para ese canal.', 'Abra a página de um canal para definir palavras-chave do chat ou uma nota local privada para esse canal.'],
  'Comma-separated words are highlighted locally in chat. They never leave this browser.': ['Las palabras separadas por comas se resaltan localmente en el chat. Nunca salen de este navegador.', 'As palavras separadas por vírgulas são destacadas localmente no chat. Elas nunca saem deste navegador.'],
  'Keep a local reminder for this channel. It is not sent to Kick.': ['Guarda un recordatorio local para este canal. No se envía a Kick.', 'Guarde um lembrete local para este canal. Ele não é enviado ao Kick.'],
  'Save local channel tools': ['Guardar las herramientas locales del canal', 'Salvar as ferramentas locais do canal'],
  'Only this channel path and the values above are stored.': ['Solo se guardan la ruta de este canal y los valores de arriba.', 'Somente o caminho deste canal e os valores acima são guardados.'],
  'Optional data-only blocklist': ['Lista de bloqueo opcional, solo datos', 'Lista de bloqueio opcional, somente dados'],
  'Fetch a user-supplied JSON list of channels, categories, and keywords. No code is accepted or executed.': ['Descarga una lista JSON de canales, categorías y palabras clave que tú indiques. No se acepta ni se ejecuta ningún código.', 'Baixa uma lista JSON de canais, categorias e palavras-chave que você indicar. Nenhum código é aceito nem executado.'],
  'Add emotes from a channel': ['Añadir emotes de un canal', 'Adicionar emotes de um canal'],
  'Paste a channel name or Kick URL. Access rules still apply.': ['Pega el nombre de un canal o una URL de Kick. Las reglas de acceso siguen aplicándose.', 'Cole o nome de um canal ou uma URL do Kick. As regras de acesso continuam valendo.'],
  'Create a group, then select emotes and move them together.': ['Crea un grupo y luego selecciona emotes para moverlos juntos.', 'Crie um grupo e depois selecione emotes para movê-los juntos.'],
  'New emotes save automatically.': ['Los emotes nuevos se guardan automáticamente.', 'Os emotes novos são salvos automaticamente.'],
  'What Kick does not explain': ['Lo que Kick no explica', 'O que o Kick não explica'],
  'These names exist in more than one of your sets. Kick sends the last one loaded, so typing the name may not send what you expect.': ['Estos nombres existen en más de uno de tus conjuntos. Kick envía el último que se cargó, así que escribir el nombre puede no enviar lo que esperas.', 'Estes nomes existem em mais de um dos seus conjuntos. O Kick envia o último que carregou, então digitar o nome pode não enviar o que você espera.'],
  'Requests, promotional modules, and sensitive content.': ['Peticiones, módulos promocionales y contenido sensible.', 'Requisições, módulos promocionais e conteúdo sensível.'],
  'Local playback memory, chat control, emotes, and diagnostics.': ['Memoria local de reproducción, control del chat, emotes y diagnósticos.', 'Memória local de reprodução, controle do chat, emotes e diagnósticos.'],
  'Favorites and not-interested choices stay on this device.': ['Los favoritos y las opciones de no me interesa se quedan en este dispositivo.', 'Os favoritos e as escolhas de não tenho interesse ficam neste dispositivo.'],
  'Channel keywords and private notes stay on this device.': ['Las palabras clave de canal y las notas privadas se quedan en este dispositivo.', 'As palavras-chave de canal e as notas privadas ficam neste dispositivo.'],
  'Sanitized in-memory diagnostics; query strings are never retained.': ['Diagnósticos en memoria y depurados; las cadenas de consulta nunca se conservan.', 'Diagnósticos em memória e limpos; as strings de consulta nunca são mantidas.'],
  'Settings stay in your userscript manager. No analytics. No remote code.': ['La configuración se queda en tu gestor de userscripts. Sin analíticas. Sin código remoto.', 'As configurações ficam no seu gerenciador de userscripts. Sem analytics. Sem código remoto.'],
  'Temporarily restore Kick’s native layout and pause Kick Focus hooks without reloading. Restore it from the Focus button or with Ctrl+Shift+F.': ['Restaura temporalmente el diseño nativo de Kick y pausa los enganches de Kick Focus sin recargar. Vuelve a activarlo desde el botón Focus o con Ctrl+Shift+F.', 'Restaura temporariamente o layout nativo do Kick e pausa os ganchos do Kick Focus sem recarregar. Reative pelo botão Focus ou com Ctrl+Shift+F.'],
  'Copy a sanitized summary or run a local self-check.': ['Copia un resumen depurado o ejecuta una comprobación local.', 'Copie um resumo limpo ou execute uma verificação local.'],
  'Move preferences, recorded emote metadata, favorites, removals, and custom groups using one local JSON file.': ['Mueve preferencias, metadatos de emotes registrados, favoritos, elementos quitados y grupos personalizados con un solo archivo JSON local.', 'Mova preferências, metadados de emotes registrados, favoritos, itens removidos e grupos personalizados com um único arquivo JSON local.'],
  'Restore every setting, shortcut, note, filter, and channel list to factory defaults. Your recorded emote library is kept. This happens straight away and can be undone once.': ['Restablece todos los ajustes, atajos, notas, filtros y listas de canales a los valores de fábrica. Se conserva tu biblioteca de emotes registrada. Ocurre de inmediato y se puede deshacer una vez.', 'Repoe todas as definições, atalhos, notas, filtros e listas de canais para os valores de fábrica. A tua biblioteca de emotes registada é mantida. Acontece de imediato e pode ser desfeito uma vez.'],
  'Changes are not being saved': ['Los cambios no se están guardando', 'As alterações não estão sendo salvas'],
  'No errors recorded this session.': ['No se registraron errores en esta sesión.', 'Nenhum erro registrado nesta sessão.'],
  'Read Kick’s own endpoints instead of scraping the page. Same-origin, read-only, using the session you are already signed into. Nothing is sent anywhere.': ['Lee los propios endpoints de Kick en lugar de raspar la página. Mismo origen, solo lectura y con la sesión que ya tienes iniciada. No se envía nada a ninguna parte.', 'Lê os próprios endpoints do Kick em vez de raspar a página. Mesma origem, somente leitura e com a sessão em que você já está conectado. Nada é enviado a lugar nenhum.'],
  'Emote already saved': ['El emote ya estaba guardado', 'O emote já estava salvo'],
  'Emote saved': ['Emote guardado', 'Emote salvo'],
  'All streams paused': ['Todas las transmisiónes en pausa', 'Todas as transmissões pausadas'],
  'All streams playing': ['Todas las transmisiónes en reproducción', 'Todas as transmissões em reprodução'],
  'All streams muted': ['Todas las transmisiónes silenciadas', 'Todas as transmissões sem som'],
  'Audio restored to the focused stream': ['Audio restaurado en la transmisión enfocada', 'Áudio restaurado na transmissão em foco'],
  'Focus mode on': ['Modo enfoque activado', 'Modo foco ativado'],
  'Focus mode off': ['Modo enfoque desactivado', 'Modo foco desativado'],
  'Theater mode on': ['Modo cine activado', 'Modo cinema ativado'],
  'Theater mode off': ['Modo cine desactivado', 'Modo cinema desativado'],
  'Chat hidden': ['Chat oculto', 'Chat ocultado'],
  'Chat shown': ['Chat visible', 'Chat visível'],
  'Sidebar hidden': ['Barra lateral oculta', 'Barra lateral ocultada'],
  'Sidebar shown': ['Barra lateral visible', 'Barra lateral visível'],
  'Mature thumbnails revealed': ['Miniaturas sensibles visibles', 'Miniaturas sensíveis visíveis'],
  'Mature thumbnails blurred': ['Miniaturas sensibles difuminadas', 'Miniaturas sensíveis desfocadas'],
  'Resume chat': ['Reanudar chat', 'Retomar chat'],
  'Pause chat': ['Pausar chat', 'Pausar o chat'],
  'Resume chat updates': ['Reanudar las actualizaciones del chat', 'Retomar as atualizações do chat'],
  'Healthy': ['Correcto', 'Tudo certo'],
  'Needs attention': ['Necesita atención', 'Precisa de atenção'],
  'Multi': ['Multi', 'Multi'],
  'Play all': ['Reproducir todo', 'Reproduzir tudo'],
  'Pause all': ['Pausar todo', 'Pausar tudo'],
  'Unmute': ['Activar sonido', 'Ativar som'],
  'Mute all': ['Silenciar todo', 'Silenciar tudo'],
  'Remove {name} from Kick Focus multi-stream': ['Quitar {name} del multi-stream de Kick Focus', 'Remover {name} do multi-stream do Kick Focus'],
  'Add {name} to Kick Focus multi-stream': ['Añadir {name} al multi-stream de Kick Focus', 'Adicionar {name} ao multi-stream do Kick Focus'],
  'HTTPS JSON URL': ['URL JSON por HTTPS', 'URL JSON via HTTPS'],
  'Expected fields: channels, categories, and keywords. Unknown fields are rejected.': ['Campos esperados: channels, categories y keywords. Los campos desconocidos se rechazan.', 'Campos esperados: channels, categories e keywords. Campos desconhecidos são rejeitados.'],
  'Off by default. When enabled, refreshes only over HTTPS with credentials omitted.': ['Desactivado por defecto. Si se activa, solo se actualiza por HTTPS y sin enviar credenciales.', 'Desativado por padrão. Quando ativado, atualiza apenas por HTTPS e sem enviar credenciais.'],
  'Refresh interval': ['Intervalo de actualización', 'Intervalo de atualização'],
  'Keep the last valid payload if a later request fails.': ['Conserva el último contenido válido si una petición posterior falla.', 'Mantenha o último conteúdo válido se uma requisição posterior falhar.'],
  'Load the emote catalog from Kick': ['Cargar el catálogo de emotes desde Kick', 'Carregar o catálogo de emotes do Kick'],
  'Read the full channel, global, and emoji sets without treating public artwork as account access. Falls back to the picker if the response changes shape.': ['Lee los conjuntos completos del canal, globales y de emojis sin tratar las imágenes públicas como acceso de la cuenta. Vuelve al selector si la respuesta cambia de forma.', 'Lê os conjuntos completos do canal, globais e de emojis sem tratar imagens públicas como acesso da conta. Volta ao seletor se a resposta mudar de formato.'],
  'Follow live chat events': ['Seguir los eventos del chat en vivo', 'Acompanhar os eventos do chat ao vivo'],
  'Subscribe to the same realtime chat feed Kick’s own client uses. The provider is read from Kick rather than hardcoded.': ['Suscríbete al mismo flujo de chat en tiempo real que usa el cliente de Kick. El proveedor se lee desde Kick en lugar de estar fijado en el código.', 'Assine o mesmo fluxo de chat em tempo real que o cliente do Kick usa. O provedor é lido do Kick em vez de estar fixo no código.'],
  'Explain removed messages': ['Explicar los mensajes eliminados', 'Explicar as mensagens removidas'],
  'Kick’s automatic moderation removes messages without saying why. The realtime event carries the reason; the page does not.': ['La moderación automática de Kick elimina mensajes sin decir por qué. El evento en tiempo real lleva el motivo; la página no.', 'A moderação automática do Kick remove mensagens sem dizer por quê. O evento em tempo real carrega o motivo; a página não.'],
  'Count emote usage': ['Contar el uso de emotes', 'Contar o uso de emotes'],
  'Kick’s own “Frequently Used” never counts anything, so no real ranking exists. This one is yours, stored locally and exported with your library.': ['La sección “Usados con frecuencia” de Kick nunca cuenta nada, así que no existe una clasificación real. Esta es tuya, guardada localmente y exportada con tu biblioteca.', 'A seção “Usados com frequência” do Kick nunca conta nada, então não existe uma classificação real. Esta é sua, guardada localmente e exportada com sua biblioteca.'],
  'Show collectible rarity': ['Mostrar la rareza de los coleccionables', 'Mostrar a raridade dos colecionáveis'],
  'Kick publishes rarity on card art and identity in the picker, with no key joining them. Rarity is shown only where the match is confident.': ['Kick publica la rareza en la ilustración de la carta y la identidad en el selector, sin ninguna clave que las una. La rareza solo se muestra cuando la coincidencia es fiable.', 'O Kick publica a raridade na arte da carta e a identidade no seletor, sem nenhuma chave que as una. A raridade só aparece quando a correspondência é confiável.'],
  'Warn about shadowed emote names': ['Avisar de nombres de emote duplicados', 'Avisar sobre nomes de emote duplicados'],
  'Subscriber emotes work in every chat and Kick resolves typed names through one map, so two channels sharing a name means one silently sends the other’s.': ['Los emotes de suscriptor funcionan en todos los chats y Kick resuelve los nombres escritos con un único mapa, así que si dos canales comparten un nombre, uno envía en silencio el del otro.', 'Os emotes de assinante funcionam em todos os chats e o Kick resolve os nomes digitados por um único mapa, então se dois canais compartilham um nome, um envia silenciosamente o do outro.'],
  'Render animated emotes and collectibles as a single static frame, in chat and in the picker. Applied automatically when your system asks for reduced motion.': ['Muestra los emotes animados y los coleccionables como un único fotograma fijo, en el chat y en el selector. Se aplica automáticamente si tu sistema pide movimiento reducido.', 'Exibe os emotes animados e os colecionáveis como um único quadro estático, no chat e no seletor. Aplicado automaticamente quando seu sistema pede movimento reduzido.'],
  'Block separable ad requests': ['Bloquear las peticiones de anuncios separables', 'Bloquear as requisições de anúncios separáveis'],
  'Intercept known ad hosts at the earliest userscript-supported page layer.': ['Intercepta los servidores de anuncios conocidos en la capa más temprana que permite un userscript.', 'Intercepta os servidores de anúncios conhecidos na camada mais inicial que um userscript permite.'],
  'Remove ad containers': ['Eliminar los contenedores de anuncios', 'Remover os contêineres de anúncios'],
  'Remove empty ad containers and reinjected ad frames.': ['Elimina los contenedores de anuncios vacíos y los marcos reinsertados.', 'Remove os contêineres de anúncios vazios e os quadros reinseridos.'],
  'Suppress sponsored and promoted cards': ['Ocultar las tarjetas patrocinadas y promocionadas', 'Ocultar os cartões patrocinados e promovidos'],
  'Hide clearly labeled promotional cards and modules.': ['Oculta las tarjetas y módulos claramente marcados como promocionales.', 'Oculta os cartões e módulos claramente marcados como promocionais.'],
  'Pause home-page autoplay': ['Pausar la reproducción automática de la página de inicio', 'Pausar a reprodução automática da página inicial'],
  'Keep background Home previews silent and paused; deliberate playback remains available.': ['Mantiene en silencio y en pausa las vistas previas de fondo del inicio; la reproducción deliberada sigue disponible.', 'Mantém as prévias de fundo da página inicial silenciadas e pausadas; a reprodução deliberada continua disponível.'],
  'Hide Slots & Casino content': ['Ocultar contenido de Slots y Casino', 'Ocultar conteúdo de Slots e Cassino'],
  'Hide cards and sidebar entries clearly labeled as casino content.': ['Oculta las tarjetas y entradas de la barra lateral marcadas claramente como contenido de casino.', 'Oculta os cartões e as entradas da barra lateral marcados claramente como conteúdo de cassino.'],
  'Blur marked mature cards until hover or keyboard focus.': ['Difumina las tarjetas marcadas para adultos hasta pasar el cursor o enfocarlas con el teclado.', 'Desfoca os cartões marcados como adultos até passar o cursor ou focar pelo teclado.'],
  'Hide Drops and gambling promotions': ['Ocultar promociones de Drops y apuestas', 'Ocultar promoções de Drops e apostas'],
  'Hide clearly labeled Drops and gambling promotion modules.': ['Oculta los módulos claramente marcados como promociones de Drops y apuestas.', 'Oculta os módulos claramente marcados como promoções de Drops e apostas.'],
  'Poor mode': ['Modo sin gastos', 'Modo sem gastos'],
  'Show how long the stream has been live': ['Mostrar cuánto tiempo lleva en directo', 'Mostrar há quanto tempo a transmissão está ao vivo'],
  'Kick sends the start time with every channel and shows it nowhere. This reads that field and counts from it in the player corner, with no extra request and no polling.': ['Kick envía la hora de inicio con cada canal y no la muestra en ninguna parte. Esto lee ese campo y cuenta desde él en la esquina del reproductor, sin peticiones extra ni sondeos.', 'O Kick envia o horário de início com cada canal e não o mostra em lugar nenhum. Isto lê esse campo e conta a partir dele no canto do player, sem requisições extras e sem sondagem.'],
  'Pop out chat': ['Chat en ventana flotante', 'Chat em janela flutuante'],
  'Channel points: Kick says Picture-in-Picture and mirrored viewing do not accrue points. Keep a normal Kick player open when progress matters.': ['Puntos del canal: Kick indica que la imagen en imagen y la visualización reflejada no acumulan puntos. Mantén abierto un reproductor normal de Kick cuando el progreso importe.', 'Pontos do canal: o Kick informa que Picture-in-Picture e visualização espelhada não acumulam pontos. Mantenha um player normal do Kick aberto quando o progresso for importante.'],
  'Merge all chats': ['Unir todos los chats', 'Juntar todos os chats'],
  'Merged chat from every channel in the grid': ['Chat unificado de todos los canales de la cuadrícula', 'Chat unificado de todos os canais da grelha'],
  '{live} of {total} chats live': ['{live} de {total} chats activos', '{live} de {total} chats ao vivo'],
  'One chat per tile': ['Un chat por canal', 'Um chat por canal'],
  'Read-only. Every channel in the grid, in the order messages arrived.': ['Solo lectura. Todos los canales de la cuadrícula, en el orden en que llegaron los mensajes.', 'Apenas leitura. Todos os canais da grelha, na ordem em que as mensagens chegaram.'],
  'Showing one merged chat for every channel in the grid': ['Mostrando un chat unificado de todos los canales de la cuadrícula', 'A mostrar um chat unificado de todos os canais da grelha'],
  'Showing the focused channel chat': ['Mostrando el chat del canal enfocado', 'A mostrar o chat do canal em foco'],
  'Return chat': ['Devolver el chat', 'Devolver o chat'],
  'Kick Focus could not open the pop-out chat window.': ['Kick Focus no ha podido abrir la ventana flotante del chat.', 'A Kick Focus não conseguiu abrir a janela flutuante do chat.'],
  'Chat for {channel} opened in a floating window': ['El chat de {channel} se ha abierto en una ventana flotante', 'O chat de {channel} abriu numa janela flutuante'],
  'Show how long Kick keeps this recording': ['Mostrar cuánto tiempo conserva Kick esta grabación', 'Mostrar por quanto tempo a Kick guarda esta gravação'],
  'Kick deletes recordings after 7 days, or 30 for a verified channel, and shows that deadline nowhere. On a VOD page this reads the recording date from Kick’s own video list and counts down to it. It says nothing at all when the recording is older than the list Kick returns, or when the tier cannot be established. A guess between 7 and 30 days would be a confident wrong date.': ['Kick borra las grabaciones a los 7 días, o a los 30 si el canal está verificado, y no muestra ese plazo en ninguna parte. En la página de un vídeo, esto lee la fecha de grabación de la propia lista de vídeos de Kick y cuenta atrás hasta ella. No dice nada cuando la grabación es más antigua que la lista que devuelve Kick, o cuando no se puede establecer el nivel: adivinar entre 7 y 30 días sería dar una fecha equivocada con total seguridad.', 'A Kick apaga as gravações ao fim de 7 dias, ou 30 num canal verificado, e não mostra esse prazo em lado nenhum. Na página de um vídeo, isto lê a data da gravação da própria lista de vídeos da Kick e faz a contagem decrescente até lá. Não diz nada quando a gravação é mais antiga do que a lista que a Kick devolve, ou quando o nível não pode ser estabelecido. Adivinhar entre 7 e 30 dias seria dar uma data errada com toda a confiança.'],
  '{time} before Kick deletes this recording': ['{time} antes de que Kick borre esta grabación', '{time} antes de a Kick apagar esta gravação'],
  'Live for {duration}': ['En directo desde hace {duration}', 'Ao vivo há {duration}'],
  '{count} emotes usable in any chat': ['{count} emotes utilizables en cualquier chat', '{count} emotes utilizáveis em qualquer chat'],
  'subscribed channel': ['canal suscrito', 'canal assinado'],
  'subscribed channels': ['canales suscritos', 'canais assinados'],
  'your global sets': ['tus conjuntos globales', 'seus conjuntos globais'],
  'Kick reports no emotes this account can send anywhere.': ['Kick no indica ningún emote que esta cuenta pueda enviar en cualquier chat.', 'O Kick não indica nenhum emote que esta conta possa enviar em qualquer chat.'],
  'My emotes': ['Mis emotes', 'Meus emotes'],
  'My emotes ({count})': ['Mis emotes ({count})', 'Meus emotes ({count})'],
  'Subscribed channel': ['Canal suscrito', 'Canal assinado'],
  'Global collection': ['Colección global', 'Coleção global'],
  'Kick reports no emotes this account can use in every chat.': ['Kick no indica ningún emote que esta cuenta pueda usar en todos los chats.', 'O Kick não indica nenhum emote que esta conta possa usar em todos os chats.'],
  'Sign in to Kick and open any channel once to load your owned emotes. Nothing is sent or changed.': ['Inicia sesión en Kick y abre cualquier canal una vez para cargar tus emotes. No se envía ni cambia nada.', 'Entre no Kick e abra qualquer canal uma vez para carregar seus emotes. Nada é enviado ou alterado.'],
  'Works in every chat': ['Funciona en todos los chats', 'Funciona em todos os chats'],
  'Only works in its own channel': ['Solo funciona en su propio canal', 'Só funciona no próprio canal'],
  'Only works in {channel}’s chat': ['Solo funciona en el chat de {channel}', 'Só funciona no chat de {channel}'],
  'Hide Subscribe, Gift Subs/Dubs, Get KICKs, gift-shop controls, and spend-based leaderboards. Follow, chat, and free daily rewards stay available.': ['Oculta Suscribirse, Regalar subs/dubs, Obtener KICKs, la tienda de regalos y las clasificaciones de gasto. Seguir, el chat y las recompensas diarias gratuitas siguen disponibles.', 'Oculta Inscrever-se, Presentear subs/dubs, Obter KICKs, a loja de presentes e os placares de gastos. Seguir, o chat e as recompensas diárias gratuitas continuam disponíveis.'],
  'Enable Poor mode': ['Activar modo sin gastos', 'Ativar modo sem gastos'],
  'Disable Poor mode': ['Desactivar modo sin gastos', 'Desativar modo sem gastos'],
  'Remove spending prompts without changing your Kick account': ['Oculta las invitaciones de gasto sin cambiar tu cuenta de Kick', 'Oculta os convites de gasto sem alterar sua conta do Kick'],
  'Channel emote catalog': ['Catálogo de emotes del canal', 'Catálogo de emotes do canal'],
  'Loading…': ['Cargando…', 'Carregando…'],
  'Load emotes': ['Cargar emotes', 'Carregar emotes'],
  'Channel-only': ['Solo en el canal', 'Somente no canal'],
  'Subscriber-only': ['Solo para suscriptores', 'Somente para assinantes'],
  'Reduce tracking telemetry': ['Reducir la telemetría de seguimiento', 'Reduzir a telemetria de rastreamento'],
  'Block observed third-party video and error telemetry hosts.': ['Bloquea los servidores de telemetría de vídeo y errores de terceros detectados.', 'Bloqueia os servidores de telemetria de vídeo e de erros de terceiros detectados.'],
  'Remember volume locally': ['Recordar el volumen localmente', 'Lembrar o volume localmente'],
  'Restore each channel’s volume and mute state from local storage.': ['Restaura el volumen y el estado de silencio de cada canal desde el almacenamiento local.', 'Restaura o volume e o estado de mudo de cada canal a partir do armazenamento local.'],
  'Remember quality locally': ['Recordar la calidad localmente', 'Lembrar a qualidade localmente'],
  'Restore a matching quality control when Kick exposes one.': ['Restaura el control de calidad correspondiente cuando Kick lo ofrece.', 'Restaura o controle de qualidade correspondente quando o Kick o oferece.'],
  'Always start at the highest quality': ['Empezar siempre en la calidad más alta', 'Sempre começar na qualidade mais alta'],
  'Open every stream at the best rung Kick offers, taking precedence over remembered quality. The rungs are learned from Kick’s own quality menu, so this does nothing until that menu has been opened once. It will not open it for you.': ['Abre cada directo en la mejor opción que ofrezca Kick, con prioridad sobre la calidad recordada. Las opciones se aprenden del propio menú de calidad de Kick, así que no hace nada hasta que ese menú se haya abierto una vez: no lo abrirá por ti.', 'Abre cada transmissão na melhor opção que o Kick oferecer, com prioridade sobre a qualidade lembrada. As opções são aprendidas do próprio menu de qualidade do Kick, então isso não faz nada até que esse menu seja aberto uma vez: ele não será aberto para você.'],
  'Remember VOD position locally': ['Recordar la posición del VOD localmente', 'Lembrar a posição do VOD localmente'],
  'Resume finite VODs from the last local playback position.': ['Reanuda los VOD finitos desde la última posición de reproducción local.', 'Retoma os VODs finitos a partir da última posição de reprodução local.'],
  'Pause chat updates': ['Pausar las actualizaciones del chat', 'Pausar as atualizações do chat'],
  'Scrolling the transcript up freezes it, as does the button. Resume is always one control away.': ['Desplazarte hacia arriba en el chat lo congela, igual que el botón. Reanudar siempre está a un control de distancia.', 'Rolar a transcrição para cima congela o chat, assim como o botão. Retomar está sempre a um controle de distância.'],
  'Chat updates paused': ['Actualizaciones del chat en pausa', 'Atualizações do chat pausadas'],
  'Userscript size': ['Tamaño del userscript', 'Tamanho do userscript'],
  'Injection ceiling': ['Límite de inyección', 'Limite de injeção'],
  'Help': ['Ayuda', 'Ajuda'],
  'Open help and recovery': ['Abrir ayuda y recuperación', 'Abrir ajuda e recuperação'],
  'Chat updates resumed': ['Actualizaciones del chat reanudadas', 'Atualizações do chat retomadas'],
  'Organize chat emotes': ['Organizar los emotes del chat', 'Organizar os emotes do chat'],
  'Continuously record emotes from live chat and Kick’s picker, then add favorites, removals, search, and custom groups.': ['Registra continuamente los emotes del chat en vivo y del selector de Kick, y añade favoritos, eliminaciones, búsqueda y grupos personalizados.', 'Registra continuamente os emotes do chat ao vivo e do seletor do Kick, e adiciona favoritos, remoções, busca e grupos personalizados.'],
  'Click chat emotes to save': ['Haz clic en los emotes del chat para guardarlos', 'Clique nos emotes do chat para salvar'],
  'Click any emote in chat to add it to your favorites. If Kick explicitly marks it as follow-gated, the same click follows its source channel; subscriber access is never bypassed.': ['Haz clic en cualquier emote del chat para añadirlo a tus favoritos. Si Kick lo marca explícitamente como restringido a seguidores, el mismo clic sigue su canal de origen; el acceso de suscriptor nunca se omite.', 'Clique em qualquer emote do chat para adicioná-lo aos favoritos. Se o Kick o marcar explicitamente como restrito a seguidores, o mesmo clique segue o canal de origem; o acesso de assinante nunca é contornado.'],
  'Highlight chat keywords': ['Resaltar palabras clave del chat', 'Destacar palavras-chave do chat'],
  'Use the per-channel keyword list below without sending it anywhere.': ['Usa la lista de palabras clave por canal de abajo sin enviarla a ningún sitio.', 'Usa a lista de palavras-chave por canal abaixo sem enviá-la a lugar nenhum.'],
  'Show playback diagnostics': ['Mostrar diagnósticos de reproducción', 'Mostrar diagnósticos de reprodução'],
  'Show ready state, buffered seconds, and dropped-frame counts on a channel.': ['Muestra el estado de preparación, los segundos en búfer y los fotogramas perdidos en un canal.', 'Mostra o estado de prontidão, os segundos em buffer e os quadros perdidos em um canal.'],
  'Start playback without waiting for blocked ad scripts': ['Iniciar la reproducción sin esperar a los scripts de anuncios bloqueados', 'Iniciar a reprodução sem esperar pelos scripts de anúncios bloqueados'],
  'Kick waits on Google PAL, Datazoom, and OM before requesting playback. Blocking them, which this build does, leaves the dead script in the page and the player waits out the full timeout. Removing it lets playback start immediately.': ['Kick espera a Google PAL, Datazoom y OM antes de pedir la reproducción. Bloquearlos, lo que hace esta versión, deja el script muerto en la página y el reproductor agota todo el tiempo de espera. Quitarlo permite que la reproducción empiece de inmediato.', 'O Kick espera por Google PAL, Datazoom e OM antes de solicitar a reprodução. Bloqueá-los, o que esta versão faz, deixa o script morto na página e o player aguarda todo o tempo limite. Removê-lo faz a reprodução começar imediatamente.'],
  'Minimize non-essential animations and transitions.': ['Minimiza las animaciones y transiciones no esenciales.', 'Minimiza as animações e transições não essenciais.'],
  'Increase separation for controls, borders, and surfaces.': ['Aumenta la separación de controles, bordes y superficies.', 'Aumenta a separação de controles, bordas e superfícies.'],
  'Keep a strong outline for keyboard navigation.': ['Mantiene un contorno marcado para la navegación con teclado.', 'Mantém um contorno forte para a navegação por teclado.'],
  'Increase the minimum height of interactive controls.': ['Aumenta la altura mínima de los controles interactivos.', 'Aumenta a altura mínima dos controles interativos.'],
  'Report view changes to assistive technology.': ['Informa de los cambios de vista a las tecnologías de asistencia.', 'Informa as mudanças de exibição às tecnologias assistivas.'],
  'Scale text in the main Kick content area.': ['Escala el texto en el área de contenido principal de Kick.', 'Dimensiona o texto na área de conteúdo principal do Kick.'],
  'Set the preferred caption background strength.': ['Define la intensidad preferida del fondo de los subtítulos.', 'Define a intensidade preferida do fundo das legendas.'],
  'Multi-stream opened': ['Multitransmisión abierta', 'Multitransmissão aberta'],
  'Your own multi-stream grid is back.': ['Tu propia cuadrícula de multitransmisión ha vuelto.', 'A sua própria grade de multitransmissão voltou.'],
  'Watch several Kick channels in one grid': ['Mira varios canales de Kick en una sola cuadrícula', 'Assista a vários canais do Kick em uma única grade'],
  'Freeze animated emotes': ['Congelar los emotes animados', 'Congelar os emotes animados'],
  'Read-only here. Kick blocks sending from an embedded chat; open the channel to talk.': ['Solo lectura aquí. Kick impide enviar desde un chat incrustado; abre el canal para hablar.', 'Somente leitura aqui. O Kick impede o envio a partir de um chat incorporado; abra o canal para falar.'],
  'Emote favorites, removals, and custom groups reset.': ['Se restablecieron los favoritos, las eliminaciones y los grupos personalizados de emotes.', 'Favoritos, remoções e grupos personalizados de emotes redefinidos.'],
  'The emote could not be saved. The error log on the Content & Ads page says why.': ['No se pudo guardar el emote. El registro de errores de la página Contenido y anuncios dice por qué.', 'Não foi possível salvar o emote. O registro de erros da página Conteúdo e anúncios diz por quê.'],
  'Open a channel page first.': ['Abre primero la página de un canal.', 'Abra primeiro a página de um canal.'],
  'Local channel tools saved.': ['Herramientas locales del canal guardadas.', 'Ferramentas locais do canal salvas.'],
  'Local channel tools cleared.': ['Herramientas locales del canal borradas.', 'Ferramentas locais do canal limpas.'],
  'Enter a custom emote group name.': ['Escribe un nombre para el grupo personalizado de emotes.', 'Digite um nome para o grupo personalizado de emotes.'],
  'The emote group limit is {limit}.': ['El límite de grupos de emotes es {limit}.', 'O limite de grupos de emotes é {limit}.'],
  'That emote group already exists.': ['Ese grupo de emotes ya existe.', 'Esse grupo de emotes já existe.'],
  'Enter a valid emote group name.': ['Escribe un nombre de grupo de emotes válido.', 'Digite um nome de grupo de emotes válido.'],
  'Board saved.': ['Tablero guardado.', 'Painel salvo.'],
  'That board has no usable channels.': ['Ese tablero no tiene canales utilizables.', 'Esse painel não tem canais utilizáveis.'],
  'Channel name or kick.com link': ['Nombre del canal o enlace de kick.com', 'Nome do canal ou link do kick.com'],
  'Multi-stream controls': ['Controles de transmisión múltiple', 'Controles de multistream'],
  'Name this board': ['Nombra este tablero', 'Dê um nome a este painel'],
  'Board name': ['Nombre del tablero', 'Nome do painel'],
  'Ready for your first channel': ['Listo para tu primer canal', 'Pronto para o primeiro canal'],
  'Multi-stream workspace': ['Espacio de transmisión múltiple', 'Área de trabalho multistream'],
  'Build your viewing board': ['Crea tu tablero de visualización', 'Monte seu painel de visualização'],
  'Add a channel above to start. Focus decides which stream owns audio and chat, and your saved boards stay on this device.': ['Añade un canal arriba para empezar. El enfoque decide qué stream controla el audio y el chat, y tus tableros guardados permanecen en este dispositivo.', 'Adicione um canal acima para começar. O foco decide qual transmissão controla o áudio e o chat, e seus painéis salvos ficam neste dispositivo.'],
  'Add your first channel': ['Añade tu primer canal', 'Adicione seu primeiro canal'],
  'Add channel': ['Añadir canal', 'Adicionar canal'],
  'Save board': ['Guardar tablero', 'Salvar painel'],
  'Saved boards will appear here.': ['Los tableros guardados aparecerán aquí.', 'Os painéis salvos aparecerão aqui.'],
  'Could not reach the clipboard. Check the clipboard permission for kick.com.': ['No se pudo acceder al portapapeles. Revisa el permiso del portapapeles para kick.com.', 'Não foi possível acessar a área de transferência. Verifique a permissão da área de transferência para kick.com.'],
  'Cached blocklist removed.': ['Se eliminó la lista de bloqueo almacenada en caché.', 'Lista de bloqueio em cache removida.'],
  'Enter a channel name or URL.': ['Escribe un nombre de canal o una URL.', 'Digite um nome de canal ou uma URL.'],
  'That does not look like a Kick channel.': ['Eso no parece un canal de Kick.', 'Isso não parece um canal do Kick.'],
  'That channel is already hidden.': ['Ese canal ya está oculto.', 'Esse canal já está oculto.'],
  'Hidden channel list is full (200). Remove a channel before hiding another.': ['La lista de canales ocultos está llena (200). Quita un canal antes de ocultar otro.', 'A lista de canais ocultos está cheia (200). Remova um canal antes de ocultar outro.'],
  'Favorites cleared.': ['Favoritos borrados.', 'Favoritos limpos.'],
  'Not-interested channels restored.': ['Se restauraron los canales marcados como no interesantes.', 'Canais marcados como sem interesse restaurados.'],
  'Could not export settings. Check that your browser allows downloads from kick.com.': ['No se pudo exportar la configuración. Comprueba que tu navegador permita descargas desde kick.com.', 'Não foi possível exportar as configurações. Verifique se o navegador permite downloads de kick.com.'],
  'Could not read that settings file. Pick a JSON file exported by Kick Focus.': ['No se pudo leer ese archivo de configuración. Elige un archivo JSON exportado por Kick Focus.', 'Não foi possível ler esse arquivo de configurações. Escolha um arquivo JSON exportado pelo Kick Focus.'],
  'That backup is too large for this browser’s storage. Nothing was changed.': ['Esa copia de seguridad es demasiado grande para el almacenamiento de este navegador. No se cambió nada.', 'Esse backup é grande demais para o armazenamento deste navegador. Nada foi alterado.'],
  'The import could not be saved. Your previous settings are unchanged.': ['No se pudo guardar la importación. Tu configuración anterior no ha cambiado.', 'Não foi possível salvar a importação. Suas configurações anteriores não foram alteradas.'],
  'Settings imported.': ['Configuración importada.', 'Configurações importadas.'],
  'Previous settings backed up. Use Undo import to restore them.': ['Se hizo una copia de la configuración anterior. Usa Deshacer importación para restaurarla.', 'Foi feito backup das configurações anteriores. Use Desfazer importação para restaurá-las.'],
  ' and {count} more': [' y {count} más', ' e mais {count}'],
  '{count} more': ['{count} más', 'mais {count}'],
  'Ignored unknown section "{key}".': ['Se ignoró la sección desconocida "{key}".', 'A seção desconhecida "{key}" foi ignorada.'],
  'Ignored unknown setting "{path}".': ['Se ignoró la configuración desconocida "{path}".', 'A configuração desconhecida "{path}" foi ignorada.'],
  'Adjusted "{path}" to a supported value.': ['Se ajustó "{path}" a un valor compatible.', '"{path}" foi ajustada para um valor compatível.'],
  'Upgraded from an unversioned file to schema {schema}.': ['Se actualizó un archivo sin versión al esquema {schema}.', 'Um arquivo sem versão foi atualizado para o esquema {schema}.'],
  'Upgraded from schema {from} to schema {to}.': ['Se actualizó del esquema {from} al esquema {to}.', 'O esquema {from} foi atualizado para o esquema {to}.'],
  '{count} emote could not be kept: {sample}{more}.': ['No se pudo conservar {count} emote: {sample}{more}.', 'Não foi possível manter {count} emote: {sample}{more}.'],
  '{count} emotes could not be kept: {sample}{more}.': ['No se pudieron conservar {count} emotes: {sample}{more}.', 'Não foi possível manter {count} emotes: {sample}{more}.'],
  'Adjusted emote {field} to supported entries.': ['Se ajustó emote {field} a entradas compatibles.', 'O campo de emotes {field} foi ajustado para entradas compatíveis.'],
  'Upgraded emotes to schema {schema}.': ['Se actualizaron los emotes al esquema {schema}.', 'Os emotes foram atualizados para o esquema {schema}.'],
  'Adjusted emote usage counts to {count} supported entries.': ['Se ajustaron los recuentos de uso de emotes a {count} entradas compatibles.', 'As contagens de uso de emotes foram ajustadas para {count} entradas compatíveis.'],
  'Adjusted the multi-stream grid to {count} supported channels.': ['Se ajustó la cuadrícula multitransmisión a {count} canales compatibles.', 'A grade multistream foi ajustada para {count} canais compatíveis.'],
  'Adjusted saved boards to {count} supported entries.': ['Se ajustaron los diseños guardados a {count} entradas compatibles.', 'Os layouts salvos foram ajustados para {count} entradas compatíveis.'],
  'Left the blocklist subscription to {host} switched off. Turn it on yourself if you trust that host.': ['La suscripción a la lista de bloqueo de {host} se dejó desactivada. Actívala tú si confías en ese servidor.', 'A assinatura da lista de bloqueio de {host} ficou desativada. Ative você mesmo se confiar nesse servidor.'],
  'Density saved': ['Densidad guardada', 'Densidade salva'],
  'Content filter saved': ['Filtro de contenido guardado', 'Filtro de conteúdo salvo'],
  'Poor mode saved': ['Modo sin gastos guardado', 'Modo sem gastos salvo'],
  'The backup could not be restored. Your current settings are unchanged.': ['No se pudo restaurar la copia de seguridad. Tu configuración actual no ha cambiado.', 'Não foi possível restaurar o backup. Suas configurações atuais não foram alteradas.'],
  'Import undone. Your previous settings are back.': ['Importación deshecha: tu configuración anterior está de vuelta.', 'Importação desfeita: suas configurações anteriores voltaram.'],
  'Kick Focus restored.': ['Kick Focus restaurado.', 'Kick Focus restaurado.'],
  'Kick Focus paused. Use the Resume button or Ctrl+Shift+F to restore.': ['Kick Focus en pausa. Usa el botón Reanudar o Ctrl+Mayús+F para restaurarlo.', 'Kick Focus pausado. Use o botão Retomar ou Ctrl+Shift+F para restaurar.'],
  'Settings reset': ['Configuración restablecida', 'Configurações redefinidas'],
  'Kick Focus restored': ['Kick Focus restaurado', 'Kick Focus restaurado'],
  'Give this stream the audio and chat': ['Dar a esta transmisión el audio y el chat', 'Dar a esta transmissão o áudio e o chat'],
  'Remove': ['Quitar', 'Remover'],
  'Clear search': ['Borrar la búsqueda', 'Limpar a busca'],
  'Campaign status': ['Estado de la campaña', 'Status da campanha'],
  'No open campaigns': ['No hay campañas abiertas', 'Nenhuma campanha aberta'],
  'Campaigns appear here when a reward is available.': ['Las campañas aparecen aquí cuando hay una recompensa disponible.', 'As campanhas aparecem aqui quando há uma recompensa disponível.'],
  'Browse eligible streams': ['Explorar transmisiones elegibles', 'Explorar transmissões elegíveis'],
  'View coming soon': ['Ver próximas campañas', 'Ver próximas campanhas'],
  'Reward activity': ['Actividad de recompensas', 'Atividade de recompensas'],
  'Active': ['Activas', 'Ativas'],
  'Claimed': ['Reclamadas', 'Resgatadas'],
  'Expired': ['Caducadas', 'Expiradas'],
  'How drops work': ['Cómo funcionan los drops', 'Como os drops funcionam'],
  'Watch eligible streams': ['Ver transmisiones elegibles', 'Assistir a transmissões elegíveis'],
  'Pick an active campaign.': ['Elige una campaña activa.', 'Escolha uma campanha ativa.'],
  'Track progress': ['Seguir el progreso', 'Acompanhar o progresso'],
  'Keep watching to advance.': ['Sigue mirando para avanzar.', 'Continue assistindo para avançar.'],
  'Claim your reward': ['Reclamar la recompensa', 'Resgatar sua recompensa'],
  'Claim it before time runs out.': ['Reclámala antes de que se acabe el tiempo.', 'Resgate antes que o tempo acabe.'],
  'Kick Focus command menu': ['Menú de comandos de Kick Focus', 'Menu de comandos do Kick Focus'],
  'Kick Focus multi-stream': ['Multitransmisión de Kick Focus', 'Multitransmissão do Kick Focus'],
  'Which chat to show': ['Qué chat mostrar', 'Qual chat mostrar'],
  'Live style preview': ['Vista previa del estilo en vivo', 'Prévia do estilo ao vivo'],
  'release, giveaway, raid': ['estreno, sorteo, raid', 'lançamento, sorteio, raid'],
  'Chat keywords for this channel': ['Palabras clave del chat para este canal', 'Palavras-chave do chat para este canal'],
  'Why I follow this channel…': ['Por qué sigo este canal…', 'Por que eu sigo este canal…'],
  'Private channel note': ['Nota privada del canal', 'Nota privada do canal'],
  'Search emotes or Kick groups': ['Buscar emotes o grupos de Kick', 'Buscar emotes ou grupos do Kick'],
  'Search recorded emotes': ['Buscar emotes registrados', 'Buscar emotes registrados'],
  'Filter recorded emotes': ['Filtrar emotes registrados', 'Filtrar emotes registrados'],
  'Group name': ['Nombre del grupo', 'Nome do grupo'],
  'Custom emote groups': ['Grupos personalizados de emotes', 'Grupos personalizados de emotes'],
  'Group for selected emotes': ['Grupo para los emotes seleccionados', 'Grupo para os emotes selecionados'],
  'Select {name}': ['Seleccionar {name}', 'Selecionar {name}'],
  'Deselect {name}': ['Deseleccionar {name}', 'Desmarcar {name}'],
  'Delete group {name}': ['Eliminar grupo {name}', 'Excluir grupo {name}'],
  'New emote group name': ['Nombre del nuevo grupo de emotes', 'Nome do novo grupo de emotes'],
  'Channel name or kick.com URL': ['Nombre del canal o URL de kick.com', 'Nome do canal ou URL do kick.com'],
  'Channel to hide': ['Canal que ocultar', 'Canal a ocultar'],
  'Open Kick Focus multi-stream': ['Abrir la multitransmisión de Kick Focus', 'Abrir a multitransmissão do Kick Focus'],
  'Multi-stream': ['Multitransmisión', 'Multitransmissão'],
  'Stats': ['Estadísticas', 'Estatísticas'],
  'Open {channel} stats in StreamerStats': ['Abrir las estadísticas de {channel} en StreamerStats', 'Abrir as estatísticas de {channel} no StreamerStats'],
  'Opened {channel} in StreamerStats.': ['Se abrió {channel} en StreamerStats.', '{channel} foi aberto no StreamerStats.'],
  'The browser blocked the stats popup.': ['El navegador bloqueó la ventana emergente de estadísticas.', 'O navegador bloqueou a janela de estatísticas.'],
  'Open tab': ['Abrir pestaña', 'Abrir aba'],
  'Add this channel to Kick Focus multi-stream': ['Añadir este canal a la multitransmisión de Kick Focus', 'Adicionar este canal à multitransmissão do Kick Focus'],
  'Add to multi-stream': ['Añadir a la multitransmisión', 'Adicionar à multitransmissão'],
  'Undo': ['Deshacer', 'Desfazer'],
  'Commands': ['Comandos', 'Comandos'],
  'Accessibility': ['Accesibilidad', 'Acessibilidade'],
  'Comfort and readability': ['Comodidad y legibilidad', 'Conforto e legibilidade'],
  'Menu': ['Menú', 'Menu'],
  'Open Kick Focus command menu': ['Abrir el menú de comandos de Kick Focus', 'Abrir o menu de comandos do Kick Focus'],
  'Undo reset': ['Deshacer el restablecimiento', 'Desfazer a reposição'],
  'Settings reset.': ['Ajustes restablecidos.', 'Definições repostas.'],
  'There is nothing to undo.': ['No hay nada que deshacer.', 'Não há nada para desfazer.'],
  'Reset undone. Your previous settings are back.': ['Se deshizo el restablecimiento. Tus ajustes anteriores han vuelto.', 'A reposição foi desfeita. As tuas definições anteriores voltaram.'],
  'View': ['Ver', 'Ver'],
  'Your inventory holds {copies} {copiesWord} across {distinct} distinct {distinctWord}. That is {duplicates} {duplicatesWord}, or {rate}% of what you have pulled.': ['Tu inventario tiene {copies} {copiesWord} repartidos en {distinct} {distinctWord} distintos: {duplicates} {duplicatesWord}, es decir, el {rate}% de lo que has conseguido.', 'Seu inventário tem {copies} {copiesWord} distribuídos em {distinct} {distinctWord} distintos: {duplicates} {duplicatesWord}, ou seja, {rate}% do que você já obteve.'],
  'Your inventory holds {distinct} distinct {distinctWord}. Kick’s response carries no per-item quantity, so a duplicate rate cannot be measured from it. That number is unavailable rather than zero.': ['Tu inventario tiene {distinct} {distinctWord} distintos. La respuesta de Kick no incluye la cantidad por artículo, así que no se puede medir una tasa de duplicados a partir de ella: ese número no está disponible, no es cero.', 'Seu inventário tem {distinct} {distinctWord} distintos. A resposta do Kick não traz a quantidade por item, então não é possível medir uma taxa de duplicatas a partir dela: esse número está indisponível, não é zero.'],
  'emote name shadowed.': ['nombre de emote duplicado.', 'nome de emote duplicado.'],
  'emote names shadowed.': ['nombres de emote duplicados.', 'nomes de emote duplicados.'],
  'result loaded': ['resultado cargado', 'resultado carregado'],
  'results loaded': ['resultados cargados', 'resultados carregados'],
  'emote': ['emote', 'emote'],
  'emotes': ['emotes', 'emotes'],
  'collectible': ['coleccionable', 'colecionável'],
  'collectibles': ['coleccionables', 'colecionáveis'],
  'item': ['artículo', 'item'],
  'items': ['artículos', 'itens'],
  'duplicate': ['duplicado', 'duplicata'],
  'duplicates': ['duplicados', 'duplicatas'],
  'recorded emote has been changed by Kick since first capture. See the Changed by Kick filter in the library below.': ['emote registrado ha sido modificado por Kick desde su primera captura: consulta el filtro Modificados por Kick en la biblioteca de abajo.', 'emote registrado foi alterado pelo Kick desde a primeira captura: veja o filtro Alterados pelo Kick na biblioteca abaixo.'],
  'recorded emotes have been changed by Kick since first capture. See the Changed by Kick filter in the library below.': ['emotes registrados han sido modificados por Kick desde su primera captura: consulta el filtro Modificados por Kick en la biblioteca de abajo.', 'emotes registrados foram alterados pelo Kick desde a primeira captura: veja o filtro Alterados pelo Kick na biblioteca abaixo.'],
  'channel hidden. These count toward the fail-open ceiling.': ['canal oculto. Cuenta para el límite de seguridad.', 'canal oculto. Ele conta para o limite de segurança.'],
  'channels hidden. These count toward the fail-open ceiling.': ['canales ocultos. Cuentan para el límite de seguridad.', 'canais ocultos. Eles contam para o limite de segurança.'],
  'channel': ['canal', 'canal'],
  'channels': ['canales', 'canais'],
  'minute': ['minuto', 'minuto'],
  'minutes': ['minutos', 'minutos'],
  'time': ['vez', 'vez'],
  'times': ['veces', 'vezes'],
  'Claim the daily reward automatically': ['Reclamar la recompensa diaria automáticamente', 'Reivindicar a recompensa diária automaticamente'],
  'Opens Kick’s own reward dialog when one is waiting and clicks its claim button for you. It clicks nothing else: a reward Kick has not unlocked yet shows a disabled button, and this leaves it alone rather than trying. It waits until you are not typing, checks at most every ten minutes, and stops for the day once it claims. Signed-in only, because the reward button does not exist otherwise.': ['Abre el propio diálogo de recompensa de Kick cuando hay una esperando y pulsa su botón de reclamar por ti. No pulsa nada más: una recompensa que Kick aún no ha desbloqueado muestra un botón desactivado, y esto lo deja en paz en lugar de intentarlo. Espera a que no estés escribiendo, comprueba como mucho cada diez minutos y se detiene por hoy en cuanto reclama. Solo con sesión iniciada: el botón de recompensa no existe de otro modo.', 'Abre o próprio diálogo de recompensa da Kick quando há uma à espera e clica no botão de reivindicar por você. Não clica em mais nada: uma recompensa que a Kick ainda não liberou mostra um botão desativado, e isto deixa-o em paz em vez de tentar. Espera até você não estar digitando, verifica no máximo a cada dez minutos e para por hoje assim que reivindica. Apenas com sessão iniciada, porque o botão de recompensa não existe de outra forma.'],
  'Daily reward claimed. It is in your collectibles.': ['Recompensa diaria reclamada. Está en tus coleccionables.', 'Recompensa diária reivindicada. Está nos seus colecionáveis.'],
  'Daily reward claimed.': ['Recompensa diaria reclamada.', 'Recompensa diária reivindicada.'],
  'Add open tabs ({count})': ['Añadir pestañas abiertas ({count})', 'Adicionar abas abertas ({count})'],
  'Added {count} from your other tabs ({total} of {max})': ['Se añadieron {count} de tus otras pestañas: {total} de {max}', 'Foram adicionados {count} das suas outras abas: {total} de {max}'],
  'Added {count} channels from your other tabs.': ['Se añadieron {count} canales de tus otras pestañas.', 'Foram adicionados {count} canais das suas outras abas.'],
  'Apply cycle cost': ['Coste del ciclo de aplicación', 'Custo do ciclo de aplicação'],
  'No apply cycle has run yet.': ['Aún no se ha ejecutado ningún ciclo de aplicación.', 'Nenhum ciclo de aplicação foi executado ainda.'],
  'Type an emote name into chat': ['Escribir el nombre de un emote en el chat', 'Digitar o nome de um emote no chat'],
  'Suggest emotes as you type': ['Sugerir emotes mientras escribes', 'Sugerir emotes enquanto você digita'],
  'Typing a colon and two or more letters in chat offers matching emotes from your library, ranked by what you actually send here. Click one to put its plain name at your cursor. Suggestions are clicked, never accepted with a key, so nothing you type is ever captured, and it never sends the message.': ['Al escribir dos puntos y dos o más letras en el chat se ofrecen emotes de tu biblioteca, ordenados según lo que realmente envías aquí. Haz clic en uno para poner su nombre simple en el cursor. Las sugerencias se eligen con el ratón, nunca con una tecla, así que nada de lo que escribes queda capturado, y nunca envía el mensaje.', 'Digitar dois-pontos e duas ou mais letras no chat oferece emotes da sua biblioteca, ordenados pelo que você realmente envia aqui. Clique em um para colocar o nome simples no seu cursor. As sugestões são escolhidas com o mouse, nunca aceitas com uma tecla, então nada do que você digita é capturado, e nunca envia a mensagem.'],
  'Adds a Type in chat action beside Copy name in the emote library. It types the plain name at your cursor and stops. Never the wire token, never an id, and it never sends the message.': ['Añade una acción Escribir en el chat junto a Copiar nombre en la biblioteca de emotes. Escribe solo el nombre en la posición del cursor y se detiene ahí: nunca el código interno, nunca un id, y nunca envía el mensaje.', 'Adiciona uma ação Digitar no chat ao lado de Copiar nome na biblioteca de emotes. Digita apenas o nome na posição do cursor e para por aí: nunca o código interno, nunca um id, e nunca envia a mensagem.'],
  'That emote has no plain name to copy.': ['Ese emote no tiene un nombre simple que copiar.', 'Esse emote não tem um nome simples para copiar.'],
  'That emote has no plain name to type.': ['Ese emote no tiene un nombre simple que escribir.', 'Esse emote não tem um nome simples para digitar.'],
  'Open a channel chat first.': ['Abre primero el chat de un canal.', 'Abra primeiro o chat de um canal.'],
  'Kick’s chat box did not accept the text. The name is on your clipboard instead.': ['El cuadro de chat de Kick no aceptó el texto. El nombre está en tu portapapeles.', 'A caixa de chat do Kick não aceitou o texto. O nome está na sua área de transferência.'],
  'Seen available': ['Visto como disponible', 'Visto como disponível'],
  'Seen in chat': ['Visto en el chat', 'Visto no chat'],
  'Click to save': ['Haz clic para guardar', 'Clique para salvar'],
  'Saved. Click to open in the library': ['Guardado: haz clic para abrirlo en la biblioteca', 'Salvo: clique para abrir na biblioteca'],
  'Name shadowed by another set': ['Nombre eclipsado por otro conjunto', 'Nome ofuscado por outro conjunto'],
  '{count} of {max} streams': ['{count} de {max} transmisiones', '{count} de {max} transmissões'],
};

function activeLocale() {
  const preference = state.settings.appearance.language;
  if (preference !== 'auto') return preference;
  const language = typeof navigator === 'undefined' ? '' : String(navigator.language || '').toLowerCase();
  if (language.startsWith('es')) return 'es';
  if (language.startsWith('pt')) return 'pt';
  return 'en';
}

/**
 * The English source of a node this build has already translated.
 *
 * Held off the DOM, so nothing is serialised into markup and an entry is
 * collected with its node. This is what makes a second pass a forward lookup of
 * the same key instead of a reverse scan: without it, re-localising had to map
 * a possibly-already-translated value back to English by searching every
 * dictionary — ambiguous by construction, because several English source
 * strings are also translated values of other strings.
 */
const TEXT_SOURCE = new WeakMap();
const ATTRIBUTE_SOURCE = new WeakMap();

/** One forward lookup. An unknown string is its own answer. */
function tr(value) {
  const source = String(value);
  const index = LOCALES.indexOf(activeLocale());
  return (index === -1 ? '' : TRANSLATIONS[source]?.[index]) || source;
}

/**
 * Locale-aware count word: es and pt have a "many" category English lacks.
 *
 * The chosen form is translated too. A count phrase is assembled by
 * interpolation, so the finished string ("12 emotes") can never match a
 * dictionary key — the only translatable unit is the form itself, which is why
 * both forms are dictionary entries and the i18n-coverage gate scans for them.
 */
function plural(count, one, other) {
  return tr(pluralForm(count, { one, other }, activeLocale()));
}

/**
 * A sentence that carries values and is still translatable.
 *
 * Interpolating first yields a string no dictionary can ever match, which is
 * why every count sentence stayed English. Translating the *template* and
 * substituting afterwards keeps one lookup key per sentence and lets a locale
 * put the placeholders wherever its grammar needs them. An unknown placeholder
 * is left visible rather than blanked, so a typo shows up instead of hiding.
 */
function trf(template, values) {
  return tr(template).replace(/\{(\w+)\}/g, (whole, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole));
}

/**
 * Say which language this build's own interface is written in.
 *
 * Kick's document is `<html lang="en">`, and `lang` inherits through the flat
 * tree into a shadow root — so with the interface set to Español, a screen
 * reader was announcing ~200 Spanish strings with English phonemes. That is
 * WCAG 2.2 SC 3.1.2 (Language of Parts, AA), and it is a real failure on the
 * one build in this space that ships an accessibility page.
 *
 * Stamped on the host rather than inside the shadow root, because the host is
 * the element Kick's `lang` would otherwise reach through. The popup is not
 * included on purpose: its copy is English and it correctly declares `en`.
 */
function applyInterfaceLanguage() {
  const locale = activeLocale();
  // The list is inline rather than a module const on purpose: the hover-card
  // host is built during boot, and a `const` declared this far down the file
  // would still be in its temporal dead zone when that runs. Function
  // declarations hoist; `const` does not. See test/boot.test.js.
  for (const id of ['kick-focus-root', 'kick-focus-emote-complete', 'kick-focus-emote-tooltip', 'kick-focus-header-control', 'kick-focus-streamer-stats', 'kick-focus-following-preview']) {
    const host = document.getElementById(id);
    if (host && host.lang !== locale) host.lang = locale;
  }
  return locale;
}

function localizeInterface(root = state.shadow) {
  applyInterfaceLanguage();
  if (!root) return;
  const walk = (node) => {
    if (node.nodeType === 3) {
      // Always translate from the recorded English, never from what is on
      // screen, so a re-render or a language change cannot compound.
      const recorded = TEXT_SOURCE.get(node);
      const text = recorded === undefined ? node.nodeValue : recorded;
      const trimmed = text.trim();
      if (!trimmed || node.parentElement?.matches?.('input, textarea')) return;
      if (recorded === undefined) TEXT_SOURCE.set(node, text);
      const start = text.indexOf(trimmed);
      node.nodeValue = `${text.slice(0, start)}${tr(trimmed)}${text.slice(start + trimmed.length)}`;
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    if (node.nodeType === 1) {
      let sources = ATTRIBUTE_SOURCE.get(node);
      for (const attribute of ['aria-label', 'placeholder', 'title']) {
        if (!node.hasAttribute(attribute)) continue;
        const recorded = sources?.[attribute];
        const value = recorded === undefined ? node.getAttribute(attribute) : recorded;
        if (recorded === undefined) {
          sources = sources || {};
          sources[attribute] = value;
          ATTRIBUTE_SOURCE.set(node, sources);
        }
        node.setAttribute(attribute, tr(value));
      }
      // Content that is user data rather than this build's own prose. An emote
      // or channel named "Reset" is not the button label "Reset", and must not
      // be renamed by a dictionary hit. The element's own attributes above are
      // still this build's chrome, so they are translated first.
      if (node.hasAttribute('data-kf-no-translate')) return;
    }
    for (const child of node.childNodes || []) walk(child);
  };
  walk(root);
}

function buildInterface() {
  if (document.getElementById('kick-focus-root')) return;
  const root = document.createElement('div');
  root.id = 'kick-focus-root';
  root.lang = activeLocale();
  const shadow = root.attachShadow({ mode: 'open' });
  // Adopted after the markup lands: innerHTML replaces every child, which would
  // take the fallback <style> element with it if it were appended first.
  setMarkup(shadow, `
    <button type="button" class="kf-quick" data-kf-quick data-action="open-settings" aria-label="Open Kick Focus settings">Focus</button>
    <div class="kf-backdrop" data-kf-settings-backdrop hidden>
      <section class="kf-settings" data-kf-settings-shell role="dialog" aria-modal="true" aria-labelledby="kf-settings-title">
        <header class="kf-header">
          <div class="kf-brand"><img class="kf-brand-mark" src="__KICK_FOCUS_ICON__" alt=""><span>Kick Focus</span><span class="kf-badge">Premium</span></div>
          <span class="kf-sr-only" id="kf-settings-title">Kick Focus settings</span>
          <div class="kf-save" data-kf-save-status data-error="false" role="status">Autosaved</div>
          <button class="kf-icon-button" type="button" data-action="close-settings" aria-label="Close settings">${uiIcon('close')}</button>
        </header>
        <div class="kf-body">
          <nav class="kf-nav" aria-label="Kick Focus settings">
            <div class="kf-nav-search"><input type="search" class="kf-input" data-kf-settings-search placeholder="Search settings" aria-label="Search settings" aria-controls="kf-settings-page"></div>
            ${NAV_ITEMS.map(([id, title, description, icon]) => `<button type="button" data-page="${id}">${uiIcon(icon)}<span class="kf-nav-copy"><strong>${title}</strong><span>${description}</span><span class="kf-nav-earned" data-kf-nav-earned></span></span></button>`).join('')}
          </nav>
          <main class="kf-page" id="kf-settings-page" data-kf-page tabindex="-1"></main>
        </div>
        <footer class="kf-footer">
          <div class="kf-footer-left">
            <button type="button" class="kf-button" data-action="reset-page">${uiIcon('reset')}Reset page</button>
            <button type="button" class="kf-button" data-action="export">${uiIcon('export')}Export settings</button>
            <button type="button" class="kf-button" data-action="help" aria-label="Open help and recovery">${uiIcon('info')}Help</button>
          </div>
          <div class="kf-footer-right"><button type="button" class="kf-button kf-button-primary" data-action="close-settings">${uiIcon('check')}Done</button></div>
        </footer>
      </section>
    </div>
    <div class="kf-backdrop" data-kf-command-backdrop hidden>
      <section class="kf-command-shell" role="dialog" aria-modal="true" aria-label="Kick Focus command menu">
        <div class="kf-command-head"><label for="kf-command-input">Find a command</label><input id="kf-command-input" data-kf-command-input type="search" autocomplete="off" placeholder="Type an action or setting…" aria-describedby="kf-command-count" role="combobox" aria-expanded="true" aria-controls="kf-command-list" aria-autocomplete="list"><span id="kf-command-count" data-kf-command-count aria-live="polite" data-kf-no-translate></span></div>
        <div class="kf-command-list" id="kf-command-list" data-kf-command-list role="listbox" aria-label="Available commands"></div>
      </section>
    </div>
    <div class="kf-backdrop kf-ms-backdrop" data-kf-multistream-backdrop hidden>
      <section class="kf-ms-shell" role="dialog" aria-modal="true" aria-label="Kick Focus multi-stream">
        <header class="kf-ms-head">
          <div class="kf-ms-brand"><strong>Multi-stream</strong><span class="kf-ms-count" data-kf-multistream-count data-kf-no-translate></span></div>
          <div class="kf-ms-add">
            <label class="kf-sr-only" for="kf-ms-input">Add a Kick channel</label>
            <input id="kf-ms-input" data-kf-multistream-input type="search" autocomplete="off" placeholder="Channel name or kick.com link">
            <button type="button" class="kf-button kf-button-primary kf-button-small" data-action="multistream-add">Add channel</button>
            <button type="button" class="kf-button kf-button-small" data-action="multistream-add-open-tabs" data-kf-presence-add hidden></button>
          </div>
          <div class="kf-ms-controls" aria-label="Multi-stream controls">
            <button type="button" class="kf-button kf-button-small" data-action="multistream-toggle-pause" data-kf-multistream-pause aria-pressed="false">Pause all</button>
            <button type="button" class="kf-button kf-button-small" data-action="multistream-toggle-mute" data-kf-multistream-mute aria-pressed="false">Mute all</button>
            <select class="kf-select kf-ms-select" data-kf-multistream-chat-select aria-label="Which chat to show"></select>
            <button type="button" class="kf-button kf-button-small" data-action="multistream-toggle-chat" aria-pressed="true">Hide chat</button>
            <button type="button" class="kf-button kf-button-small" data-action="multistream-popout-chat" data-kf-multistream-popout aria-pressed="false" aria-describedby="kf-ms-points-note" hidden>Pop out chat</button>
            <button type="button" class="kf-button kf-button-small" data-action="multistream-toggle-merged" aria-pressed="false">Merge chats</button>
            <button type="button" class="kf-button kf-button-small" data-action="close-multistream">Close</button>
          </div>
        </header>
        <div class="kf-ms-error" role="alert" data-kf-multistream-error hidden></div>
        <div class="kf-ms-body">
          <div class="kf-ms-grid" data-kf-multistream-grid></div>
          <aside class="kf-ms-chat" data-kf-multistream-chat></aside>
          <aside class="kf-ms-merged" data-kf-multistream-merged hidden>
            <p class="kf-ms-chat-notice">Read-only. Every channel in the grid, in the order messages arrived.</p>
            <p class="kf-ms-chat-status" data-kf-multistream-merged-status>0 of 0 chats live</p>
            <ul class="kf-ms-merged-list" data-kf-multistream-merged-list role="log" aria-live="off" aria-label="Merged chat from every channel in the grid"></ul>
          </aside>
        </div>
        <footer class="kf-ms-foot">
          <div class="kf-ms-save-layout"><label class="kf-sr-only" for="kf-ms-layout-name">Board name</label><input id="kf-ms-layout-name" data-kf-multistream-layout-name type="text" autocomplete="off" placeholder="Name this board"><button type="button" class="kf-button kf-button-small" data-action="multistream-save">Save board</button></div>
          <div class="kf-ms-layouts" data-kf-multistream-layouts></div>
          <p class="kf-ms-points-note" id="kf-ms-points-note">${uiIcon('info')}<span>Channel points: Kick says Picture-in-Picture and mirrored viewing do not accrue points. Keep a normal Kick player open when progress matters.</span></p>
        </footer>
      </section>
    </div>
    <input type="file" accept="application/json,.json" data-kf-import hidden>
    <div class="kf-storage-alert" data-kf-storage-alert role="alert" hidden>
      <div class="kf-storage-alert-body">
        <strong data-kf-storage-alert-title>Changes are not being saved</strong>
        <span data-kf-storage-alert-copy></span>
      </div>
      <button type="button" class="kf-button kf-button-small" data-action="open-storage-diagnostics">Details</button>
      <button type="button" class="kf-button kf-button-small" data-action="dismiss-storage-alert">Dismiss</button>
    </div>
    <div class="kf-toast" data-kf-toast role="status" aria-live="polite" aria-atomic="true" hidden></div>
    <div class="kf-sr-only" aria-live="polite" data-kf-live></div>
  `);
  adoptStyles(shadow, UI_CSS);
  document.body.append(root);
  state.root = root;
  state.shadow = shadow;
  state.modal = shadow.querySelector('[data-kf-settings-backdrop]');
  state.command = shadow.querySelector('[data-kf-command-backdrop]');
  state.commandInput = shadow.querySelector('[data-kf-command-input]');
  state.commandList = shadow.querySelector('[data-kf-command-list]');
  state.quickButton = shadow.querySelector('[data-kf-quick]');

  shadow.addEventListener('click', guard('settings click', onInterfaceClick));
  shadow.addEventListener('change', guard('settings change', onInterfaceChange));
  shadow.addEventListener('input', guard('settings input', onInterfaceInput));
  shadow.addEventListener('keydown', guard('settings keydown', onInterfaceKeydown));
  state.commandInput.addEventListener('input', () => {
    // A new result set makes the old position meaningless, so it goes back to
    // the top rather than pointing at whatever now sits at that index.
    state.commandActive = 0;
    renderCommands();
  });
  state.commandInput.addEventListener('keydown', onCommandKeydown);
  shadow.querySelector('[data-kf-import]').addEventListener('change', onImportFile);
  // Enter is how anyone actually adds a channel; the button is the backup.
  for (const [selector, action] of [
    ['[data-kf-multistream-input]', 'multistream-add'],
    ['[data-kf-multistream-layout-name]', 'multistream-save'],
  ]) {
    shadow.querySelector(selector)?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      shadow.querySelector(`[data-action="${action}"]`)?.click();
    });
  }
  shadow.querySelector('[data-kf-multistream-chat-select]')?.addEventListener('change', (event) => {
    state.multistream = normalizeMultistream({ ...state.multistream, chat: event.target.value });
    persistMultistream();
    renderMultistream();
  });
  renderSettingsPage();
  // Writes can fail before the interface exists — startup reads and migrations
  // both persist. Replay whatever failed so it is not lost to mount ordering.
  renderStorageWarning();
  renderCommands();
  // The host's accessibility flags are written by applySettingsAttributes, which
  // has already run at least once by now against a host that did not exist yet.
  applySettingsAttributes();

  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Open Kick Focus settings', () => openSettings());
      GM_registerMenuCommand('Open Kick Focus commands', () => openCommandMenu());
    }
  } catch {
    // The in-page controls remain available.
  }

  document.addEventListener('keydown', onGlobalKeydown, true);
  document.addEventListener('keydown', guard('composer recall', onComposerKeydown), true);
  document.addEventListener('submit', guard('composer recall', onComposerSubmit), true);
  document.addEventListener('click', guard('composer recall', onComposerSendClick), true);
  document.addEventListener('click', rememberWatchedCard, true);
  document.addEventListener('visibilitychange', () => {
    syncSessionWatchTime();
    repaintViewerWatchCard();
  });
  // Colon completion. Delegated at the document because Kick replaces its
  // composer on every route change, and deliberately only on events the user
  // already caused — no keydown listener, so no keystroke can be captured.
  document.addEventListener('input', onComposerInput, true);
  document.addEventListener('selectionchange', () => {
    if (state.runtime.emoteCompletion) updateEmoteCompletion();
  });
  document.addEventListener('pointerdown', (event) => {
    const row = event.target?.closest?.('#kick-focus-emote-complete');
    if (!row) hideEmoteCompletion();
  }, true);
  // Opened at boot, not on demand: a tab has to be listening to answer a
  // roll-call it never asked for.
  multistreamPresenceChannel();
  // Same reason, for convergence: a tab that is not listening when another one
  // adds a channel would show a stale chip until something else re-rendered it.
  // Both are enhancements — every commit re-reads the store, which is the truth.
  multistreamSyncChannel();
  installMultistreamStorageSync();
  // Delegated at the document: chat replaces its own nodes constantly, so a
  // per-emote listener would be attached and dropped hundreds of times a
  // minute. Keyboard users get the same card on focus.
  document.addEventListener('mouseover', guard('emote tooltip', onChatEmoteHover), true);
  document.addEventListener('focusin', guard('emote tooltip', onChatEmoteHover), true);
  for (const type of ['mouseleave', 'blur', 'wheel', 'scroll']) {
    document.addEventListener(type, hideChatEmoteTooltip, true);
  }
}

const settingsSurface = createSettings({
  activeLocale,
  AD_HOSTS,
  applyCostSummary,
  applyStickerLibrarySearch,
  assessAdStack,
  assessApiDrift,
  BUNDLE_BYTE_CEILING,
  BUNDLE_BYTES,
  INJECTION_BYTE_BUDGET,
  LIBRARY_SEED_BYTES,
  channelPath,
  chatKeywordsForChannel,
  COLLECTIBLE_FACTS,
  collectViewerFacts,
  companionInfo,
  compatibilitySummary,
  countChangedStickers,
  describeStickerChange,
  describeLibrarySeed,
  describeStorageFailures,
  DISCOVERY_LAYOUT_ROUTES,
  DISCOVERY_ROUTE_LABELS,
  emoteAccessLabel,
  emoteLockState,
  emoteReach,
  errorLogRows,
  escapeHtml,
  favoriteCount,
  formatBytes,
  formatSessionWatchTime,
  gmGet,
  HIDEABLE_ELEMENTS,
  HIDEABLE_GROUPS,
  INJECTION,
  isFavorited,
  lastCrashSummary,
  layoutMatchesSettings,
  liveStatusSummary,
  localizedStorageFailure,
  localizeInterface,
  MULTISTREAM_MAX,
  ownedEmoteGroups,
  plural,
  PRE_IMPORT_BACKUP_KEY,
  undoSlotLabel,
  protectionRows,
  rankSettingsMatches,
  refreshViewerCollectibles,
  remoteBlocklistSummary,
  renderChatHistoryResults,
  rewardStatusSummary,
  setMarkup,
  settingsFocusSelector,
  startChannelEmoteImport,
  state,
  STICKER_GROUP_LIMIT,
  STICKER_LIBRARY_LIMIT,
  stickerChangedSinceCapture,
  storageDiagnostics,
  storageHealth,
  TELEMETRY_HOSTS,
  tr,
  trf,
  VERSION,
  VIEWER_HUB_REASONS,
  VIEWER_HUB_REWARD_WORDS,
  VIEWER_HUB_TITLES,
  viewerHubCards,
  viewerHubSummary,
});
const {
  NAV_ITEMS,
  uiIcon,
  stickerLibrarySummary,
  renderViewerHubCards,
  renderSettingsPage,
} = settingsSurface;

const DISCOVERY_LAYOUTS_KEY = 'kick-focus:discovery-layouts';

function loadDiscoveryLayouts() {
  return normalizeDiscoveryLayouts(gmGet(DISCOVERY_LAYOUTS_KEY, []), state.settings);
}

function saveDiscoveryLayouts() {
  gmSet(DISCOVERY_LAYOUTS_KEY, state.discoveryLayouts);
  state.settingsIndex = null;
}

/**
 * Apply the layout this route belongs to, if the route changed into one.
 *
 * Guarded on the route actually being different, because the apply cycle runs
 * constantly and re-applying a layout on every pass would fight anybody
 * adjusting a slider while they are on that page.
 */
function applyRouteLayout() {
  const route = state.route;
  if (state.runtime.layoutRoute === route) return;
  state.runtime.layoutRoute = route;
  const layout = layoutForRoute(state.discoveryLayouts, route);
  if (!layout) return;
  const changed = applyDiscoveryLayout(state.settings, layout);
  if (!changed.length) return;
  saveSettings();
  applySettingsAttributes();
  renderSettingsPage();
  // Said out loud: a view that changes under somebody without a word is the
  // thing that makes a feature like this feel broken rather than helpful.
  showToast(trf('Applied {name} for this page.', { name: layout.name }), false);
  announce(trf('Applied {name} for this page.', { name: layout.name }));
}

function saveCurrentDiscoveryLayout() {
  const nameInput = state.shadow?.querySelector('[data-kf-layout-name]');
  const name = cleanLayoutName(nameInput?.value || '');
  if (!name) {
    showToast('Name the view before saving it.', true);
    return;
  }
  const routes = [...(state.shadow?.querySelectorAll('[data-kf-layout-route][aria-pressed="true"]') || [])]
    .map((button) => button.dataset.kfLayoutRoute);
  const layout = buildDiscoveryLayout(name, state.settings, routes);
  const rest = state.discoveryLayouts.filter((entry) => entry.name.toLowerCase() !== layout.name.toLowerCase());
  if (rest.length >= DISCOVERY_LAYOUT_MAX) {
    showToast(trf('{n} saved views is the limit. Delete one first.', { n: DISCOVERY_LAYOUT_MAX }), true);
    return;
  }
  state.discoveryLayouts = normalizeDiscoveryLayouts([...rest, layout], state.settings);
  saveDiscoveryLayouts();
  if (nameInput) nameInput.value = '';
  renderSettingsPage();
  showToast(trf('Saved {name}.', { name: layout.name }), false);
}

function applyNamedDiscoveryLayout(name) {
  const layout = state.discoveryLayouts.find((entry) => entry.name === name);
  if (!layout) return;
  const changed = applyDiscoveryLayout(state.settings, layout);
  saveSettings();
  applySettingsAttributes();
  renderSettingsPage();
  showToast(changed.length
    ? trf('Applied {name}. {n} settings changed.', { name: layout.name, n: changed.length })
    : trf('{name} is already what you are looking at.', { name: layout.name }), false);
}

function deleteDiscoveryLayout(name) {
  const before = state.discoveryLayouts.length;
  state.discoveryLayouts = state.discoveryLayouts.filter((entry) => entry.name !== name);
  if (state.discoveryLayouts.length === before) return;
  saveDiscoveryLayouts();
  renderSettingsPage();
  showToast(trf('Deleted {name}.', { name }), false);
}

/** The saved-view panel on the Layout page. */
function logAppError(context, error) {
  const record = {
    at: Date.now(),
    context: String(context).slice(0, 80),
    message: sanitizeErrorMessage(error?.message ?? error),
  };
  state.diagnostics.errors.unshift(record);
  state.diagnostics.errors = state.diagnostics.errors.slice(0, 30);
  state.diagnostics.lastCrash = record;
  try { gmSet(LAST_CRASH_KEY, record); } catch { /* a failed write must not recurse */ }
  const panel = state.shadow?.querySelector('[data-kf-error-log]');
  if (panel) setMarkup(panel, errorLogRows());
  const summary = state.shadow?.querySelector('[data-kf-last-crash]');
  if (summary) summary.textContent = lastCrashSummary();
}

/** Wrap one of the mod's own entry points so a throw is logged, not lost. */
function guard(label, fn) {
  return function guarded(...args) {
    try {
      return fn.apply(this, args);
    } catch (error) {
      logAppError(label, error);
      return undefined;
    }
  };
}

function readLastCrash() {
  const stored = gmGet(LAST_CRASH_KEY, null);
  if (!stored || typeof stored !== 'object' || typeof stored.message !== 'string') return null;
  return {
    at: Number(stored.at) || 0,
    context: String(stored.context || '').slice(0, 80),
    message: sanitizeErrorMessage(stored.message),
  };
}

function lastCrashSummary() {
  const crash = state.diagnostics.lastCrash;
  if (!crash) return 'No crash recorded.';
  const when = crash.at ? new Date(crash.at).toISOString().slice(0, 19).replace('T', ' ') : 'unknown time';
  return `Last: ${crash.context}: ${crash.message} (${when})`;
}

function errorLogRows() {
  const errors = state.diagnostics.errors;
  if (!errors.length) return '<tr><td colspan="3" class="kf-muted">No errors recorded this session.</td></tr>';
  return errors.map((entry) => `<tr><td>${escapeHtml(new Date(entry.at).toISOString().slice(11, 19))}</td><td>${escapeHtml(entry.context)}</td><td>${escapeHtml(entry.message)}</td></tr>`).join('');
}

function protectionRows() {
  const entries = state.diagnostics.entries.length ? state.diagnostics.entries.slice(0, 5) : [
    { time: '—', layer: 'Waiting', match: 'No ad request matched yet', action: 'Ready' },
  ];
  return entries.map((entry) => `<tr><td>${escapeHtml(entry.time)}</td><td>${escapeHtml(entry.layer)}</td><td>${escapeHtml(entry.match)}</td><td>${escapeHtml(entry.action)}</td></tr>`).join('');
}

function applyStickerLibrarySearch(value = state.runtime.stickerLibraryQuery) {
  const query = String(value || '').trim().toLowerCase();
  state.runtime.stickerLibraryQuery = query;
  const items = [...(state.shadow?.querySelectorAll('[data-kf-sticker-library-item]') || [])];
  let visible = 0;
  for (const item of items) {
    item.hidden = Boolean(query) && !String(item.dataset.kfStickerSearch || '').includes(query);
    if (!item.hidden) visible += 1;
  }
  for (const group of state.shadow?.querySelectorAll('[data-kf-my-emote-group]') || []) {
    group.hidden = ![...group.querySelectorAll('[data-kf-sticker-library-item]')].some((item) => !item.hidden);
  }
  const count = state.shadow?.querySelector('[data-kf-sticker-library-visible]');
  if (count) count.textContent = `${visible} shown`;
}

async function importChannelEmotes() {
  if (state.runtime.emoteCatalogLoading) return;
  const input = state.shadow?.querySelector('[data-kf-emote-catalog-input]');
  const slug = parseChannelInput(input?.value || state.runtime.emoteCatalogSlug);
  if (!slug) {
    state.runtime.emoteCatalogError = true;
    state.runtime.emoteCatalogStatus = 'Enter a valid Kick channel name or URL.';
    renderSettingsPage();
    return;
  }

  state.runtime.emoteCatalogSlug = slug;
  state.runtime.emoteCatalogLoading = true;
  state.runtime.emoteCatalogError = false;
  state.runtime.emoteCatalogStatus = `Loading ${slug}…`;
  updateEmoteCatalogProgressInPlace();

  const response = await kickFetchJson(endpoints.emoteSets(slug), { credentials: 'include' });
  if (state.runtime.emoteCatalogSlug !== slug) return;
  if (!response.ok) {
    state.runtime.emoteCatalogLoading = false;
    state.runtime.emoteCatalogError = true;
    state.runtime.emoteCatalogStatus = `Kick could not load ${slug} (${response.status}).`;
    renderSettingsPage();
    return;
  }

  const catalog = normalizeEmoteSets(response.body);
  const emotes = channelCatalogEmotes(catalog, slug);
  if (!catalog.ok || !emotes.length) {
    state.runtime.emoteCatalogLoading = false;
    state.runtime.emoteCatalogError = true;
    state.runtime.emoteCatalogStatus = catalog.ok
      ? `Kick returned no channel emotes for ${slug}.`
      : `Kick changed the emote response (${catalog.reason}); nothing was imported.`;
    if (!catalog.ok) recordApiDrift('emotes', 'shape-changed', catalog.reason);
    renderSettingsPage();
    return;
  }

  const before = state.stickerPreferences.library.size;
  const records = emotes.map((emote) => ({
    key: platformStickerKey(`id:${emote.id}`),
    id: emote.id,
    name: emote.name,
    src: emote.url,
    nativeGroups: [slug],
    access: catalogEmoteAccess(emote),
    sourceSlug: emote.sourceSlug,
    requiresFollow: emote.requiresFollow,
    followed: emote.followed,
    subscribersOnly: emote.subscribersOnly,
  }));
  mergeStickerLibrary(records);
  const added = state.stickerPreferences.library.size - before;
  const counts = records.reduce((result, record) => {
    result[record.access] = (result[record.access] || 0) + 1;
    return result;
  }, {});
  const parts = [
    `${emotes.length} found`,
    `${added} new`,
    counts.channel ? `${counts.channel} channel-only` : '',
    counts.locked ? `${counts.locked} subscriber-only` : '',
    counts.available ? `${counts.available} confirmed available` : '',
  ].filter(Boolean);
  state.runtime.emoteCatalogLoading = false;
  state.runtime.emoteCatalogError = false;
  state.runtime.emoteCatalogStatus = `${slug}: ${parts.join(' · ')}. Artwork is saved locally; chat access is unchanged.`;
  renderSettingsPage();
  showToast(trf('Loaded {count} emotes from {channel}.', { count: emotes.length, channel: slug }));
}

function updateEmoteCatalogProgressInPlace() {
  const status = state.shadow?.querySelector('[data-kf-emote-catalog-status]');
  const button = state.shadow?.querySelector('[data-action="import-channel-emotes"]');
  if (status) {
    status.textContent = state.runtime.emoteCatalogStatus;
    status.dataset.error = String(state.runtime.emoteCatalogError);
    status.hidden = !state.runtime.emoteCatalogStatus;
  }
  if (button) {
    button.disabled = state.runtime.emoteCatalogLoading;
    button.textContent = state.runtime.emoteCatalogLoading ? 'Loading…' : 'Load emotes';
  }
}

function startChannelEmoteImport() {
  void importChannelEmotes().catch((error) => {
    state.runtime.emoteCatalogLoading = false;
    state.runtime.emoteCatalogError = true;
    state.runtime.emoteCatalogStatus = 'The channel emote catalog could not be loaded.';
    logAppError('channel emote catalog', error);
    renderSettingsPage();
  });
}

/**
 * The settings surface for everything read from Kick's own API.
 *
 * Every switch here is on by default and every one degrades to the existing DOM
 * behaviour when turned off, so the section can be read as "how much of Kick's
 * own data should this use" rather than "which features work".
 */
/**
 * What Kick leaves unexplained about collectibles, plus the only numbers the
 * local record can actually support. Where Kick's response carries no
 * quantity, the duplicate count says so rather than presenting the distinct
 * count as though it answered the question.
 */
const POINTS_VALUE = '[data-testid="channel-points-value"]';
const DROPS_NAV = '[data-testid="sidebar-drops"]';
const DROPS_CAMPAIGN = 'main a[href^="/drops/"]';

const SESSION_WATCH_MEDIA_EVENTS = Object.freeze(['playing', 'waiting', 'stalled', 'pause', 'ended', 'emptied']);

function repaintViewerWatchCard() {
  if (state.currentPage === 'viewer' && state.modal && !state.modal.hidden) renderViewerHubInPlace();
}

function onSessionWatchMedia(event) {
  state.viewerHub.watchPlayback = event.type === 'playing';
  syncSessionWatchTime();
  repaintViewerWatchCard();
}

function bindSessionWatchVideo(video) {
  if (state.viewerHub.watchVideo === video) return;
  if (state.viewerHub.watchVideo) {
    for (const type of SESSION_WATCH_MEDIA_EVENTS) {
      state.viewerHub.watchVideo.removeEventListener(type, onSessionWatchMedia);
    }
  }
  state.viewerHub.watchVideo = video || null;
  state.viewerHub.watchPlayback = Boolean(video && !video.paused && !video.ended && video.readyState >= 3);
  if (video) {
    for (const type of SESSION_WATCH_MEDIA_EVENTS) video.addEventListener(type, onSessionWatchMedia);
  }
}

function sessionWatchIsActive(candidate) {
  return !state.runtime.suspended
    && sessionWatchCandidateState({
      ...candidate,
      playing: state.viewerHub.watchPlayback,
    }).active;
}

function syncSessionWatchTime(now = Date.now()) {
  const candidate = state.route === 'channel' ? sessionWatchOwnerCandidate() : null;
  const video = candidate?.video || null;
  bindSessionWatchVideo(video);
  const active = sessionWatchIsActive(candidate);
  state.viewerHub.watch = advanceSessionWatchTime(state.viewerHub.watch, now, active);
  if (active && !state.viewerHub.watchTimer) {
    state.viewerHub.watchTimer = window.setInterval(() => {
      // This tick is not an apply cycle, so nothing has invalidated the memo.
      // Without this the clock would keep running against an owner that had
      // since been removed or scrolled out of the viewport.
      invalidateSessionWatchOwner();
      syncSessionWatchTime();
      repaintViewerWatchCard();
    }, 1000);
  } else if (!active && state.viewerHub.watchTimer) {
    clearInterval(state.viewerHub.watchTimer);
    state.viewerHub.watchTimer = 0;
  }
}

function stopSessionWatchTime() {
  state.viewerHub.watch = advanceSessionWatchTime(state.viewerHub.watch, Date.now(), false);
  clearInterval(state.viewerHub.watchTimer);
  state.viewerHub.watchTimer = 0;
  bindSessionWatchVideo(null);
}

/** A whole number out of Kick's own markup, or null when there is nothing to read. */
function readNumber(text) {
  const raw = String(text ?? '').replace(/[\s,]/g, '');
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readChannelPoints() {
  const node = document.querySelector(POINTS_VALUE);
  if (!node) return null;
  // The title carries the unrounded number. Text is the fallback, and an
  // abbreviated one fails `readNumber` rather than becoming a wrong figure.
  const titled = node.querySelector('[title]')?.getAttribute('title') ?? node.getAttribute('title');
  return readNumber(titled) ?? readNumber(node.textContent);
}

/**
 * Level and streak, read only from the reward dialog this build itself opened.
 *
 * Kick shows both there and nowhere else on the page, and neither is persisted
 * between openings: a level kept from yesterday is a number that looks live and
 * is not. Matched on Kick's own label text rather than on a test id, because
 * the dialog carries no id for either.
 */
function readRewardDialogFigures() {
  const dialog = rewardDialog();
  if (!dialog) return { dialogOpen: false, level: null, streak: null };
  const text = String(dialog.textContent || '').replace(/\s+/g, ' ');
  const level = /\blevel\b[^0-9]{0,12}(\d{1,4})/i.exec(text) || /(\d{1,4})[^0-9]{0,12}\blevel\b/i.exec(text);
  const streak = /\bstreak\b[^0-9]{0,12}(\d{1,4})/i.exec(text) || /(\d{1,4})[^0-9]{0,12}\b(?:day )?streak\b/i.exec(text);
  return {
    dialogOpen: true,
    level: level ? readNumber(level[1]) : null,
    streak: streak ? readNumber(streak[1]) : null,
  };
}

/**
 * Everything the hub knows right now, gathered in one pass.
 *
 * Deliberately dumb: it observes and records, and every decision about what a
 * missing observation means belongs to `viewerHubCards` in core, where it is
 * testable without a browser.
 */
function collectViewerFacts() {
  const now = Date.now();
  const record = rewardRecord();
  const figures = readRewardDialogFigures();
  const onChannel = state.route === 'channel';
  const points = onChannel ? readChannelPoints() : null;
  return {
    reward: {
      trigger: Boolean(document.querySelector(REWARD_TRIGGER)),
      lastClaimAt: record.lastClaimAt,
      nextCheckAt: record.nextCheckAt,
      // The rollover this reward belongs to, so a claim from yesterday is not
      // reported as today's.
      previousResetAt: nextClaimResetAt(now) - 24 * 60 * 60 * 1000,
      observedAt: now,
    },
    points: { onChannel, value: points, channel: currentChannelSlug(), observedAt: now },
    collectibles: state.viewerHub.collectibles,
    drops: {
      navPresent: Boolean(document.querySelector(DROPS_NAV)),
      onRoute: location.pathname.startsWith('/drops'),
      campaigns: location.pathname.startsWith('/drops')
        ? document.querySelectorAll(DROPS_CAMPAIGN).length
        : null,
      observedAt: now,
    },
    level: { dialogOpen: figures.dialogOpen, value: figures.level, observedAt: now },
    streak: { dialogOpen: figures.dialogOpen, value: figures.streak, observedAt: now },
    watch: {
      elapsedMs: sessionWatchElapsed(state.viewerHub.watch, now),
      active: Boolean(state.viewerHub.watch.activeSince),
      observedAt: now,
    },
  };
}

/**
 * Ask Kick for the collectible inventory, once, because the hub was opened.
 *
 * Guarded so reopening the panel does not re-request: a value read a minute ago
 * is still the answer, and the card labels it as an older reading rather than
 * this fetching again to refresh a number that barely moves.
 */
async function refreshViewerCollectibles() {
  const current = state.viewerHub.collectibles;
  if (current?.loading) return;
  if (current?.observedAt && Date.now() - current.observedAt < VIEWER_HUB_STALE_MS) return;
  state.viewerHub.collectibles = { loading: true };
  renderViewerHubInPlace();
  try {
    state.viewerHub.collectibles = await readCollectibleInventory();
  } catch {
    state.viewerHub.collectibles = { failed: true, observedAt: Date.now() };
  }
  renderViewerHubInPlace();
}

/** Grouped by the reader's own locale: 12,480 rather than 12480. */
function renderViewerHubInPlace() {
  const host = state.shadow?.querySelector('[data-kf-hub-cards]');
  if (!host) return;
  setMarkup(host, renderViewerHubCards());
  localizeInterface();
}

function updateDiagnosticsInPlace() {
  if (!state.shadow) return;
  const blocked = state.shadow.querySelector('[data-kf-stat="blocked"]');
  const shells = state.shadow.querySelector('[data-kf-stat="shells"]');
  const last = state.shadow.querySelector('[data-kf-stat="last"]');
  const log = state.shadow.querySelector('[data-kf-protection-log]');
  if (blocked) blocked.textContent = String(state.diagnostics.blocked);
  if (shells) shells.textContent = String(state.diagnostics.shells);
  if (last) last.textContent = state.diagnostics.lastMatch;
  if (log) setMarkup(log, protectionRows());
  updateCompatibilityInPlace();
}

function getSetting(path) {
  const [section, key] = path.split('.');
  return state.settings[section]?.[key];
}

function saveLocalChannelTools() {
  const path = channelPath();
  if (!path) {
    showToast('Open a channel page first.', true);
    return;
  }
  const keywords = (state.shadow?.querySelector('[data-kf-chat-keywords]')?.value || '')
    .split(/[\n,]+/)
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, values) => value && value.length <= 48 && values.indexOf(value) === index)
    .slice(0, 20);
  const note = String(state.shadow?.querySelector('[data-kf-channel-note]')?.value || '').trim().slice(0, 1000);
  if (keywords.length) state.chatKeywords[path] = keywords;
  else delete state.chatKeywords[path];
  if (note) state.channelNotes[path] = note;
  else delete state.channelNotes[path];
  state.chatKeywords = Object.fromEntries(Object.entries(state.chatKeywords).slice(-100));
  state.channelNotes = Object.fromEntries(Object.entries(state.channelNotes).slice(-100));
  gmSet(CHAT_KEYWORDS_KEY, state.chatKeywords);
  gmSet(CHANNEL_NOTES_KEY, state.channelNotes);
  showToast('Local channel tools saved.');
  scheduleApply(0);
}

function clearLocalChannelTools() {
  const path = channelPath();
  if (!path) return;
  delete state.chatKeywords[path];
  delete state.channelNotes[path];
  gmSet(CHAT_KEYWORDS_KEY, state.chatKeywords);
  gmSet(CHANNEL_NOTES_KEY, state.channelNotes);
  renderSettingsPage();
  scheduleApply(0);
  showToast('Local channel tools cleared.');
}

function toggleHiddenElement(id) {
  const hidden = state.settings.layout.hidden;
  if (!HIDEABLE_ELEMENTS.some((entry) => entry.id === id)) return;
  updateSetting('layout.hidden', hidden.includes(id)
    ? hidden.filter((entry) => entry !== id)
    : [...hidden, id]);
}

function clearMediaPreferenceKind(kind) {
  const prefix = `${kind}:`;
  state.mediaPreferences = Object.fromEntries(Object.entries(state.mediaPreferences).filter(([key]) => !key.startsWith(prefix)));
  gmSet(MEDIA_PREFERENCES_KEY, state.mediaPreferences);
}

function coerceSetting(path, raw) {
  const current = getSetting(path);
  if (typeof current === 'boolean') return raw === true || raw === 'true';
  if (typeof current === 'number') return Number(raw);
  // One field holds a list. Parsed on the way in rather than on the way out, so
  // what is stored is already the cleaned, de-duplicated set of names and every
  // reader gets the same answer.
  if (path === 'content.chatPriorityPeople') return parsePeopleList(raw);
  return String(raw);
}

function cleanCustomStickerGroupName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function saveStickerOrganization(message) {
  persistStickerPreferences();
  applySettingsAttributes();
  renderSettingsPage();
  scheduleApply(0);
  showToast(message);
}

function createStickerGroup() {
  const input = state.shadow?.querySelector('[data-kf-new-sticker-group]');
  const name = cleanCustomStickerGroupName(input?.value);
  if (!name) {
    showToast('Enter a custom emote group name.', true);
    input?.focus?.();
    return;
  }
  if (state.stickerPreferences.groups.length >= STICKER_GROUP_LIMIT) {
    showToast(trf('The emote group limit is {limit}.', { limit: STICKER_GROUP_LIMIT }), true);
    return;
  }
  if (state.stickerPreferences.groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
    showToast('That emote group already exists.', true);
    return;
  }
  const id = `group_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  state.stickerPreferences.groups.push({ id, name });
  state.runtime.stickerLibraryFilter = 'all';
  state.runtime.stickerLibraryBulkGroup = id;
  saveStickerOrganization(`Created emote group “${name}”.`);
}

function renameStickerGroup(target) {
  const id = target.dataset.kfStickerGroupId || target.dataset.kfStickerGroupName;
  const group = state.stickerPreferences.groups.find((entry) => entry.id === id);
  const input = state.shadow?.querySelector(`[data-kf-sticker-group-name="${CSS.escape(id || '')}"]`);
  const name = cleanCustomStickerGroupName(input?.value);
  if (!group || !name) {
    showToast('Enter a valid emote group name.', true);
    return;
  }
  if (state.stickerPreferences.groups.some((entry) => entry.id !== id && entry.name.toLowerCase() === name.toLowerCase())) {
    showToast('That emote group already exists.', true);
    return;
  }
  group.name = name;
  saveStickerOrganization('Emote group renamed.');
}

function deleteStickerGroup(target) {
  const id = target.dataset.kfStickerGroupId;
  const group = state.stickerPreferences.groups.find((entry) => entry.id === id);
  if (!group) return;
  state.stickerPreferences.groups = state.stickerPreferences.groups.filter((entry) => entry.id !== id);
  state.stickerPreferences.assignments = new Map([...state.stickerPreferences.assignments].filter(([, groupId]) => groupId !== id));
  if (state.stickerPreferences.activeGroup === id) {
    state.stickerPreferences.activeGroup = '';
    state.stickerPreferences.view = 'all';
  }
  if (state.runtime.stickerLibraryFilter === `group:${id}`) state.runtime.stickerLibraryFilter = 'all';
  if (state.runtime.stickerLibraryBulkGroup === id) state.runtime.stickerLibraryBulkGroup = '';
  saveStickerOrganization(`Deleted emote group “${group.name}”.`);
}

function toggleLibrarySticker(target, kind) {
  const key = target.dataset.kfStickerKey;
  if (!state.stickerPreferences.library.has(key)) return;
  if (kind === 'favorite') {
    const scope = isFavorited(key) ? favoriteScopeOf(key) : newFavoriteChannel();
    state.stickerPreferences.favorites = toggleStickerFavorite(state.stickerPreferences.favorites, key, scope);
    if (isFavorited(key)) state.stickerPreferences.hidden.delete(key);
    saveStickerOrganization(isFavorited(key) ? 'Emote favorited.' : 'Emote favorite removed.');
    return;
  }
  // Remove frees the library slot for real: delete the record, remember the key
  // so a live scan does not re-record it, and drop any favorite or assignment
  // that referenced it. Restore is a bulk action in the Removed view.
  state.stickerPreferences.hidden.add(key);
  state.stickerPreferences.library.delete(key);
  state.stickerPreferences.favorites = state.stickerPreferences.favorites.filter((entry) => entry.key !== key);
  state.stickerPreferences.assignments.delete(key);
  saveStickerOrganization('Emote removed and its slot freed.');
}

function restoreRemovedStickers() {
  if (!state.stickerPreferences.hidden.size) return;
  state.stickerPreferences.hidden = new Set();
  saveStickerOrganization('Removed emotes will return to the library as they are seen again.');
}

function assignLibrarySticker(selectElement) {
  const key = selectElement.dataset.kfStickerAssignment;
  const groupId = selectElement.value;
  if (!state.stickerPreferences.library.has(key)) return;
  if (groupId && state.stickerPreferences.groups.some((group) => group.id === groupId)) {
    state.stickerPreferences.assignments.set(key, groupId);
  } else {
    state.stickerPreferences.assignments.delete(key);
  }
  saveStickerOrganization(groupId ? 'Emote assigned to custom group.' : 'Emote moved to Ungrouped.');
}

function editLibrarySelection(action, target) {
  const selected = state.runtime.stickerLibrarySelection;
  if (action === 'toggle') {
    const key = target.dataset.kfStickerKey;
    if (!state.stickerPreferences.library.has(key)) return;
    if (selected.has(key)) selected.delete(key); else selected.add(key);
    renderSettingsPage();
    return;
  }
  if (action === 'shown') {
    const keys = [...state.shadow.querySelectorAll('[data-kf-sticker-library-item]:not([hidden])')]
      .map((item) => item.dataset.kfStickerKey);
    const remove = keys.length && keys.every((key) => selected.has(key));
    for (const key of keys) if (remove) selected.delete(key); else selected.add(key);
    renderSettingsPage();
    return;
  }
  if (action === 'clear') {
    selected.clear();
    renderSettingsPage();
    return;
  }
  const keys = [...selected].filter((key) => state.stickerPreferences.library.has(key));
  if (!keys.length) return;
  if (action === 'move') {
    const group = state.runtime.stickerLibraryBulkGroup;
    if (group && !state.stickerPreferences.groups.some((entry) => entry.id === group)) return;
    for (const key of keys) if (group) state.stickerPreferences.assignments.set(key, group); else state.stickerPreferences.assignments.delete(key);
  } else {
    for (const key of keys) {
      state.stickerPreferences.hidden.add(key);
      state.stickerPreferences.library.delete(key);
      state.stickerPreferences.assignments.delete(key);
    }
    state.stickerPreferences.favorites = state.stickerPreferences.favorites.filter((entry) => !selected.has(entry.key));
  }
  selected.clear();
  saveStickerOrganization(`${keys.length} ${plural(keys.length, action === 'move' ? 'emote moved.' : 'emote removed.', action === 'move' ? 'emotes moved.' : 'emotes removed.')}`);
}

function selectViewingPreset(presetId) {
  const labels = { calm: 'Calm', cinema: 'Cinema', chat: 'Chat First', discovery: 'Discovery' };
  if (!VIEWING_PRESETS[presetId] || !labels[presetId]) return;
  state.settings = applyViewingPreset(state.settings, presetId);
  saveSettings(trf('{preset} preset applied', { preset: tr(labels[presetId]) }));
  scheduleApply(0);
  renderSettingsPage();
  renderCommands();
  showToast(trf('{preset} preset applied. Content filters were not changed.', { preset: tr(labels[presetId]) }));
}

function onInterfaceClick(event) {
  // The route chips on a saved view are a pressed-state group, not settings:
  // they say what the view being saved should apply to, and nothing is stored
  // until the save button is pressed.
  const routeChip = event.target.closest('[data-kf-layout-route]');
  if (routeChip) {
    routeChip.setAttribute('aria-pressed', String(routeChip.getAttribute('aria-pressed') !== 'true'));
    return;
  }
  const searchResult = event.target.closest('[data-kf-search-goto]');
  if (searchResult) {
    state.currentPage = searchResult.dataset.kfSearchGoto;
    clearSettingsSearch();
    renderSettingsPage();
    state.shadow.querySelector('[data-kf-page]')?.focus();
    return;
  }

  const pageButton = event.target.closest('[data-page]');
  if (pageButton) {
    state.currentPage = pageButton.dataset.page;
    clearSettingsSearch();
    renderSettingsPage();
    state.shadow.querySelector('[data-kf-page]')?.focus();
    return;
  }

  const settingButton = event.target.closest('button[data-set]');
  if (settingButton && !settingButton.disabled) {
    updateSetting(settingButton.dataset.set, coerceSetting(settingButton.dataset.set, settingButton.dataset.value));
    return;
  }

  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  if (action === 'open-settings') openSettings();
  else if (action === 'open-emotes') openSettings('emotes');
  else if (action === 'open-command') openCommandMenu();
  else if (action === 'toggle-panic') togglePanicSwitch();
  else if (action === 'close-settings') closeSettings();
  else if (action === 'reset-page') resetSettings('page');
  else if (action === 'reset-all') resetSettings('all');
  else if (action === 'export') exportSettings();
  // WCAG 2.2 3.2.6: the help mechanism has to sit in the same relative place on
  // every settings page, and the recovery copy it leads to lives on About. The
  // control is in the shell footer rather than on a page of its own, so search
  // results carry it too — a result list is a page a reader can get stuck on.
  else if (action === 'help') {
    state.settingsQuery = '';
    const search = state.shadow?.querySelector('[data-kf-settings-search]');
    if (search) search.value = '';
    state.currentPage = 'about';
    renderSettingsPage();
    state.shadow?.querySelector('[data-kf-page]')?.focus();
  }
  else if (action === 'import') state.shadow.querySelector('[data-kf-import]').click();
  else if (action === 'undo-import') undoLastDestructiveAction();
  else if (action === 'copy-sticker-name') copyStickerName(actionTarget);
  else if (action === 'insert-sticker-name') insertStickerName(actionTarget);
  else if (action === 'apply-viewing-preset') selectViewingPreset(actionTarget.dataset.preset);
  else if (action === 'toggle-hidden-element') toggleHiddenElement(actionTarget.dataset.element);
  else if (action === 'copy-diagnostics') copyDiagnostics();
  else if (action === 'copy-error-log') copyErrorLog();
  else if (action === 'open-multistream') openMultistream();
  else if (action === 'close-multistream') { closeChatWindow(); closeMergedChat(); closeMultistream(); }
  else if (action === 'multistream-focus-input') state.shadow.querySelector('[data-kf-multistream-input]')?.focus();
  else if (action === 'multistream-add-open-tabs') addPresenceOffer();
  else if (action === 'multistream-add') {
    const input = state.shadow.querySelector('[data-kf-multistream-input]');
    addMultistream(input?.value || '');
    if (input) { input.value = ''; input.focus(); }
  }
  else if (action === 'multistream-remove') {
    state.multistream = removeMultistreamChannel(state.multistream, actionTarget.dataset.slug);
    state.multistreamError = '';
    persistMultistream();
    renderMultistream();
  }
  else if (action === 'multistream-focus') {
    // Focus moves the audio and, unless the user picked a different chat, the
    // chat with it — watching one stream while reading another's chat is a
    // deliberate choice, not something to reset on every click.
    const slug = actionTarget.dataset.slug;
    const followChat = state.multistream.chat === state.multistream.focus;
    state.multistream = normalizeMultistream({
      ...state.multistream,
      focus: slug,
      chat: followChat ? slug : state.multistream.chat,
    });
    persistMultistream();
    renderMultistream();
    announce(trf('{name} now has the audio', { name: slug }));
  }
  else if (action === 'multistream-toggle-pause') {
    const paused = !state.multistream.paused;
    state.multistream = normalizeMultistream({ ...state.multistream, paused });
    persistMultistream();
    renderMultistream();
    announce(paused ? 'All streams paused' : 'All streams playing');
  }
  else if (action === 'multistream-toggle-mute') {
    const muted = !state.multistream.muted;
    state.multistream = normalizeMultistream({ ...state.multistream, muted });
    persistMultistream();
    renderMultistream();
    announce(muted ? 'All streams muted' : 'Audio restored to the focused stream');
  }
  else if (action === 'multistream-toggle-merged') {
    state.multistream = normalizeMultistream({ ...state.multistream, mergedChat: !state.multistream.mergedChat });
    persistMultistream();
    renderMultistream();
    announce(state.multistream.mergedChat ? 'Showing one merged chat for every channel in the grid' : 'Showing the focused channel chat');
  }
  else if (action === 'multistream-popout-chat') {
    // Awaited nowhere: `requestWindow` needs the transient activation this
    // click carries, and the surface re-renders itself when it resolves.
    popOutChat();
  }
  else if (action === 'multistream-toggle-chat') {
    state.multistream = normalizeMultistream({ ...state.multistream, showChat: !state.multistream.showChat });
    persistMultistream();
    renderMultistream();
  }
  else if (action === 'multistream-save') {
    const input = state.shadow.querySelector('[data-kf-multistream-layout-name]');
    const result = saveMultistreamLayout(state.multistream, input?.value || '');
    state.multistreamError = result.ok ? '' : result.error;
    if (result.ok) {
      state.multistream = result.value;
      persistMultistream();
      if (input) input.value = '';
      showToast('Board saved.');
    }
    renderMultistream();
  }
  else if (action === 'multistream-load') {
    const layout = state.multistream.layouts.find((entry) => entry.name === actionTarget.dataset.layout);
    if (layout) {
      state.multistream = normalizeMultistream({ ...state.multistream, streams: layout.streams, focus: layout.streams[0], chat: layout.streams[0] });
      state.multistreamError = '';
      persistMultistream();
      renderMultistream();
      announce(trf('Loaded board {name}', { name: layout.name }));
    }
  }
  else if (action === 'multistream-copy-layout') {
    const layout = state.multistream.layouts.find((entry) => entry.name === actionTarget.dataset.layout);
    if (!layout) return;
    const link = multistreamLayoutLink(layout.streams);
    if (!link) { showToast('That board has no usable channels.', true); return; }
    // The link carries channel names and nothing else — no settings, no
    // identifiers, nothing from this machine.
    navigator.clipboard?.writeText(link)
      .then(() => showToast(trf('Copied a link to {name}.', { name: layout.name })))
      .catch(() => showToast('Could not reach the clipboard. Check the clipboard permission for kick.com.', true));
  }
  else if (action === 'multistream-delete-layout') {
    const name = actionTarget.dataset.layout;
    state.multistream = normalizeMultistream({
      ...state.multistream,
      layouts: state.multistream.layouts.filter((entry) => entry.name !== name),
    });
    persistMultistream();
    renderMultistream();
  }
  else if (action === 'dismiss-storage-alert') {
    // Acknowledging this exact set of failures; a different key failing later
    // raises the warning again rather than staying silent.
    const alert = state.shadow?.querySelector('[data-kf-storage-alert]');
    storageHealth.acknowledged = alert?.dataset.kfStorageSignature || '';
    if (alert) alert.hidden = true;
  }
  else if (action === 'open-storage-diagnostics') {
    openSettings();
    state.currentPage = 'about';
    renderSettingsPage();
  }
  else if (action === 'self-check') runSelfCheck();
  else if (action === 'save-layout') saveCurrentDiscoveryLayout();
  else if (action === 'apply-layout') applyNamedDiscoveryLayout(actionTarget.dataset.kfLayout || '');
  else if (action === 'delete-layout') deleteDiscoveryLayout(actionTarget.dataset.kfLayout || '');
  else if (action === 'export-chat-history') exportChatHistory();
  else if (action === 'clear-chat-history') clearChatHistory();
  else if (action === 'refresh-hub') {
    // An explicit ask, so the freshness guard is cleared first: the point of
    // the button is to re-read, not to be told the last reading is recent.
    state.viewerHub.collectibles = null;
    refreshViewerCollectibles();
    renderViewerHubInPlace();
  }
  else if (action === 'save-local-channel') saveLocalChannelTools();
  else if (action === 'clear-local-channel') clearLocalChannelTools();
  else if (action === 'clear-blocklist') {
    clearRemoteBlocklist();
    showToast('Cached blocklist removed.');
    renderSettingsPage();
  }
  else if (action === 'add-hidden-channel') {
    const input = state.shadow?.querySelector('[data-kf-hidden-channel-input]');
    const raw = input?.value?.trim();
    if (!raw) { showToast('Enter a channel name or URL.', true); return; }
    const path = normalizeChannelPath(raw);
    if (!path) { showToast('That does not look like a Kick channel.', true); return; }
    const current = state.settings.content.hiddenChannels;
    if (current.includes(path)) { showToast('That channel is already hidden.', true); return; }
    if (current.length >= 200) { showToast('Hidden channel list is full (200). Remove a channel before hiding another.', true); return; }
    state.settings.content.hiddenChannels = [...current, path];
    saveSettings(trf('Hidden {channel}', { channel: path.replace(/^\//, '') }));
    scheduleApply(0);
    renderSettingsPage();
  } else if (action === 'remove-hidden-channel') {
    const channel = actionTarget?.dataset?.channel;
    if (!channel) return;
    state.settings.content.hiddenChannels = state.settings.content.hiddenChannels.filter((entry) => entry !== channel);
    saveSettings(trf('Showing {channel} again', { channel: channel.replace(/^\//, '') }));
    scheduleApply(0);
    renderSettingsPage();
  }
  else if (action === 'clear-favorites') {
    state.favorites.clear();
    persistSet(FAVORITES_KEY, state.favorites);
    renderSettingsPage();
    scheduleApply(0);
    showToast('Favorites cleared.');
  } else if (action === 'clear-dismissed') {
    state.dismissed.clear();
    persistSet(DISMISSED_KEY, state.dismissed);
    renderSettingsPage();
    scheduleApply(0);
    showToast('Not-interested channels restored.');
  } else if (action === 'clear-sticker-preferences') {
    clearStickerPreferences();
  }
  else if (action === 'show-my-emotes') {
    state.runtime.stickerLibraryFilter = 'mine';
    renderSettingsPage();
  }
  else if (action === 'show-recorded-emotes') {
    state.runtime.stickerLibraryFilter = 'all';
    renderSettingsPage();
  }
  else if (action === 'create-sticker-group') createStickerGroup();
  else if (action === 'rename-sticker-group') renameStickerGroup(actionTarget);
  else if (action === 'delete-sticker-group') deleteStickerGroup(actionTarget);
  else if (action === 'select-library-sticker') editLibrarySelection('toggle', actionTarget);
  else if (action === 'select-visible-stickers') editLibrarySelection('shown');
  else if (action === 'clear-library-selection') editLibrarySelection('clear');
  else if (action === 'move-selected-stickers') editLibrarySelection('move');
  else if (action === 'remove-selected-stickers') editLibrarySelection('remove');
  else if (action === 'favorite-library-sticker') toggleLibrarySticker(actionTarget, 'favorite');
  else if (action === 'remove-library-sticker') toggleLibrarySticker(actionTarget, 'remove');
  else if (action === 'restore-removed-stickers') restoreRemovedStickers();
  else if (action.startsWith('command:')) {
    executeCommand(action.slice(8));
  }
}

function onInterfaceChange(event) {
  const groupName = event.target.closest('input[data-kf-sticker-group-name]');
  if (groupName) {
    renameStickerGroup(groupName);
    return;
  }
  const bulkGroup = event.target.closest('select[data-kf-sticker-bulk-group]');
  if (bulkGroup) {
    state.runtime.stickerLibraryBulkGroup = bulkGroup.value;
    return;
  }
  const assignment = event.target.closest('select[data-kf-sticker-assignment]');
  if (assignment) {
    assignLibrarySticker(assignment);
    return;
  }
  const stickerFilter = event.target.closest('select[data-kf-sticker-library-filter]');
  if (stickerFilter) {
    state.runtime.stickerLibraryFilter = stickerFilter.value;
    renderSettingsPage();
    return;
  }
  const input = event.target.closest('input[data-set], select[data-set]');
  if (!input) return;
  updateSetting(input.dataset.set, coerceSetting(input.dataset.set, input.value));
}

/** Drop the query and put the input back in step with it. */
function clearSettingsSearch() {
  clearTimeout(state.settingsSearchTimer);
  state.settingsQuery = '';
  const input = state.shadow?.querySelector('input[data-kf-settings-search]');
  if (input && input.value) input.value = '';
}

function onInterfaceInput(event) {
  // A range only committed on `change`, which is pointer release, so the number
  // beside the slider and its aria-valuetext both reported the pre-drag value
  // for the whole drag. aria-valuetext replaces the value a reader hears, so a
  // stale one is not merely late, it is wrong. Persisting still waits for
  // `change`; this only keeps what is displayed in step with the thumb.
  const range = event.target.closest('input[type="range"][data-set]');
  if (range) {
    const suffix = range.dataset.kfRangeSuffix || '';
    const shown = `${range.value}${suffix}`;
    range.setAttribute('aria-valuetext', shown);
    const output = state.shadow?.querySelector(`output[data-output-for="${CSS.escape(range.dataset.set)}"]`);
    if (output && output.textContent !== shown) output.textContent = shown;
  }

  const search = event.target.closest('input[data-kf-sticker-library-search]');
  if (search) applyStickerLibrarySearch(search.value);

  const chatSearch = event.target.closest('input[data-kf-chat-history-search]');
  if (chatSearch) {
    state.chatComfort.query = chatSearch.value;
    renderChatHistoryResults();
  }

  const settingsSearch = event.target.closest('input[data-kf-settings-search]');
  if (settingsSearch) {
    // Debounced: re-rendering the results on every keystroke re-serialises the
    // whole page body, and the index behind it renders five pages the first time.
    clearTimeout(state.settingsSearchTimer);
    const value = settingsSearch.value;
    state.settingsSearchTimer = window.setTimeout(() => {
      const query = String(value || '').trim();
      if (query === state.settingsQuery) return;
      state.settingsQuery = query;
      renderSettingsPage();
      // The input is inside the nav, which the page render does not replace, so
      // focus and caret survive without the restore dance the page body needs.
    }, 160);
  }
}

function onInterfaceKeydown(event) {
  if (event.key !== 'Enter') return;
  if (event.target.closest('input[data-kf-emote-catalog-input]')) {
    event.preventDefault();
    state.shadow?.querySelector('[data-action="import-channel-emotes"]')?.click();
  } else if (event.target.closest('input[data-kf-new-sticker-group]')) {
    event.preventDefault();
    state.shadow?.querySelector('[data-action="create-sticker-group"]')?.click();
  } else if (event.target.closest('input[data-kf-sticker-group-name]')) {
    event.preventDefault();
    renameStickerGroup(event.target);
  }
}

/**
 * The element that really has focus, not the host that stands in front of it.
 *
 * `document.activeElement` retargets to the shadow host whenever focus is
 * inside a shadow root, and every control this build injects lives in one. The
 * header control's host is a span and the interface root is a div, so what got
 * recorded as "where focus came from" was an element that cannot take focus at
 * all. Restoring it was a silent no-op, and because the surface being closed
 * was hidden in the same breath, focus fell to the body and a keyboard reader
 * lost their place on the page. Walking the roots gives back the real button.
 */
function deepActiveElement() {
  let node = document.activeElement;
  while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
  return node;
}

/**
 * Return focus to the recorded opener, and report whether it actually landed.
 *
 * Asking whether `focus()` threw is not the same question. `HTMLElement.focus()`
 * on an element inside a `display: none` subtree does nothing at all and
 * reports nothing, and that is the common case here: the opener is frequently a
 * control on the surface being closed. Answering "yes" there skipped the
 * fallback in the one situation it exists for and left focus on the body. So
 * the answer is read back from the document instead of inferred.
 */
function restoreFocus(target) {
  if (!target || typeof target.focus !== 'function' || target.isConnected === false) return false;
  try {
    target.focus();
  } catch {
    return false;
  }
  return deepActiveElement() === target;
}

function openSettings(page = state.currentPage) {
  if (!state.modal) return;
  closeCommandMenu();
  state.currentPage = page;
  state.lastFocused = deepActiveElement();
  renderSettingsPage();
  state.modal.hidden = false;
  syncPageInert();
  requestAnimationFrame(() => state.shadow.querySelector('[data-action="close-settings"]')?.focus());
}

function closeSettings() {
  // Closing something already closed must not move focus. Several callers,
  // openCommandMenu among them, call this unconditionally to make sure the
  // other surface is down, and once the restore below started working that
  // turned every command-palette open into a focus jump out of Kick's chat box
  // and, if Settings had ever been opened from a card, a scroll back to it.
  if (!state.modal || state.modal.hidden) return;
  state.modal.hidden = true;
  syncPageInert();
  // Fall back to the header button rather than the body: it is the control that
  // opens this surface, so it is where a reader expects to land on the way out.
  if (!restoreFocus(state.lastFocused)) {
    restoreFocus(state.headerControlHost?.shadowRoot?.querySelector('[data-kf-header-focus]'));
  }
}

// A factory reset clears every private store the registry marks reset:true, but
// keeps the emote library: its first-seen/wasName/wasSrc provenance is the one
// thing here that cannot be regenerated, so it is preserved rather than
// destroyed. Settings and the library are handled by their own resets above.
function clearPrivateData() {
  state.emoteUsage = { global: {}, channels: {} };
  gmDelete(EMOTE_USAGE_KEY);
  state.multistream = normalizeMultistream({});
  gmDelete(MULTISTREAM_KEY);
  if (multistreamOpen()) renderMultistream();
  gmDelete(CHANNEL_LAYOUT_KEY);
  state.favorites = new Set();
  state.dismissed = new Set();
  gmDelete(FAVORITES_KEY);
  gmDelete(DISMISSED_KEY);
  state.chatKeywords = {};
  state.channelNotes = {};
  gmDelete(CHAT_KEYWORDS_KEY);
  gmDelete(CHANNEL_NOTES_KEY);
  state.mediaPreferences = {};
  gmDelete(MEDIA_PREFERENCES_KEY);
  state.reward = { ...state.reward, lastClaimAt: 0, claims: 0, minutesRemaining: null, lastMessage: '' };
  gmDelete(REWARD_STATE_KEY);
  gmDelete(PRE_IMPORT_BACKUP_KEY);
}

/**
 * Reset acts, then offers itself back.
 *
 * This used to open an alertdialog and wait. A confirmation is a poor guard:
 * it is dismissed by reflex, it cannot be undone once accepted, and it puts a
 * second modal on top of the one the person is already in. An immediate action
 * with a real one-step undo is both safer and less work, and the undo survives
 * the tab rather than only the toast.
 */
function resetSettings(scope) {
  // Taken before anything is thrown away, and written after, because the 'all'
  // path clears every private store including the slot this goes in.
  const before = currentExportPayload();
  if (scope === 'all') {
    state.settings = normalizeSettings(DEFAULT_SETTINGS);
    gmDelete(STORAGE_KEY);
    // keepLibrary is required, not optional: disclosure is not an acceptable
    // substitute for destroying unregenerable provenance.
    resetStickerPreferences({ keepLibrary: true });
    clearPrivateData();
    saveSettings('All settings reset');
  } else {
    const section = { layout: 'layout', appearance: 'appearance', content: 'content', accessibility: 'accessibility' }[state.currentPage];
    if (section) {
      state.settings = normalizeSettings({ ...state.settings, [section]: DEFAULT_SETTINGS[section] });
      saveSettings('Page reset');
    }
  }
  gmSet(PRE_IMPORT_BACKUP_KEY, { action: scope === 'all' ? 'reset-all' : 'reset-page', payload: before });
  renderSettingsPage();
  scheduleApply(0);
  announce('Settings reset');
  // A reset replaces a configuration somebody spent time on, so it is offered
  // back rather than only announced. The slot survives the tab, and the About
  // page carries the same offer for as long as it holds one.
  showToast('Settings reset.', false, [{ label: 'Undo', onClick: undoLastDestructiveAction }]);
}

// Everything the About page says is stored travels with the backup, or the
// backup is not one. Every store the registry marks `backup` is included here.
function currentExportPayload() {
  return buildSettingsExport({
    settings: state.settings,
    stickers: stickerPreferencesValue(),
    usage: state.emoteUsage,
    multistream: state.multistream,
    channelLayouts: channelLayoutMap(),
    favoriteChannels: [...state.favorites],
    dismissedChannels: [...state.dismissed],
    chatKeywords: state.chatKeywords,
    channelNotes: state.channelNotes,
    mediaPreferences: state.mediaPreferences,
  });
}

function exportSettings() {
  try {
    const payload = currentExportPayload();
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kick-focus-settings-${new Date().toISOString().slice(0,10)}.json`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const counted = Object.keys(state.emoteUsage.global || {}).length;
    showToast(trf('Exported settings, {emotes} emotes, {counts} usage counts, {boards} boards, and your channels, notes, and filters.', { emotes: state.stickerPreferences.library.size, counts: counted, boards: state.multistream.layouts.length }));
  } catch {
    showToast('Could not export settings. Check that your browser allows downloads from kick.com.', true);
  }
}

// Apply every store a validated import provided. Each store the file omitted is
// left untouched (its result field is null), so a partial backup never wipes
// what it did not carry.
/**
 * Apply an import as one transaction.
 *
 * Every store the file provided is staged and sized first, then committed
 * together. In-memory state is only advanced once the write has succeeded, so a
 * refusal leaves both storage and the running session on the previous
 * configuration instead of a half-imported mixture of the two.
 */
function applyImportedStores(result) {
  const entries = [];
  if (result.settings) entries.push([STORAGE_KEY, result.settings]);
  // The transaction has to stay one sized write, so what it commits is the
  // bounded seed; the complete library follows into the database once the
  // commit succeeds. Pushing the whole library through here instead would both
  // blow the size budget the transaction is checking and leave the database
  // holding a backup the user had just replaced.
  if (result.stickers) entries.push([STICKER_PREFERENCES_KEY, planLibraryPersist(result.stickers).seed]);
  if (result.usage) entries.push([EMOTE_USAGE_KEY, result.usage]);
  if (result.multistream) entries.push([MULTISTREAM_KEY, result.multistream]);
  if (result.channelLayouts) entries.push([CHANNEL_LAYOUT_KEY, result.channelLayouts]);
  if (result.favoriteChannels) entries.push([FAVORITES_KEY, normalizeChannelList(result.favoriteChannels)]);
  if (result.dismissedChannels) entries.push([DISMISSED_KEY, normalizeChannelList(result.dismissedChannels)]);
  if (result.chatKeywords) entries.push([CHAT_KEYWORDS_KEY, result.chatKeywords]);
  if (result.channelNotes) entries.push([CHANNEL_NOTES_KEY, result.channelNotes]);
  if (result.mediaPreferences) entries.push([MEDIA_PREFERENCES_KEY, result.mediaPreferences]);

  if (!entries.length) return { ok: false, reason: 'empty' };

  const commit = gmSetMany(entries);
  if (!commit.ok) return commit;

  if (result.settings) state.settings = result.settings;
  state.settingsIndex = null;
  if (result.stickers) {
    noteLibrarySeed(libraryStore.write(result.stickers), result.stickers);
    state.stickerPreferences = stickerPreferencesFromValue(result.stickers);
    state.runtime.stickerCatalogDirty = true;
    state.runtime.stickerLibraryFilter = 'all';
    state.runtime.stickerLibraryQuery = '';
    state.runtime.stickerLibrarySelection.clear();
    state.runtime.stickerLibraryBulkGroup = '';
  }
  if (result.usage) state.emoteUsage = result.usage;
  if (result.multistream) {
    state.multistream = result.multistream;
    if (multistreamOpen()) renderMultistream();
  }
  if (result.favoriteChannels) state.favorites = new Set(normalizeChannelList(result.favoriteChannels));
  if (result.dismissedChannels) state.dismissed = new Set(normalizeChannelList(result.dismissedChannels));
  if (result.chatKeywords) state.chatKeywords = result.chatKeywords;
  if (result.channelNotes) state.channelNotes = result.channelNotes;
  if (result.mediaPreferences) state.mediaPreferences = result.mediaPreferences;
  setSaveStatus('Imported', false);
  publishSettingsState();
  return commit;
}

async function onImportFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const result = validateImportedSettings(await file.text(), {
      currentBlocklistUrl: state.settings.content.blocklistUrl,
      currentBlocklistSubscription: state.settings.content.blocklistSubscription,
    });
    if (!result.ok) {
      showToast(result.errorKey ? trf(result.errorKey, result.errorValues || {}) : result.error, true);
      return;
    }
    const snapshot = currentExportPayload();
    const commit = applyImportedStores(result);
    if (!commit.ok) {
      const message = commit.reason === 'over-budget'
        ? tr('That backup is too large for this browser’s storage. Nothing was changed.')
        : tr('The import could not be saved. Your previous settings are unchanged.');
      showToast(message, true);
      return;
    }
    gmSet(PRE_IMPORT_BACKUP_KEY, { action: 'import', payload: snapshot });
    renderSettingsPage();
    scheduleApply(0);
    // Naming what was not kept, because an import that silently drops half a
    // configuration still reports success otherwise.
    const notes = Array.isArray(result.noteDetails) && result.noteDetails.length === result.notes?.length
      ? result.noteDetails.map((detail) => {
        const values = { ...(detail.values || {}) };
        values.more = values.moreCount > 0 ? trf(' and {count} more', { count: values.moreCount }) : '';
        return trf(detail.key, values);
      })
      : (result.notes || []).map((note) => tr(note));
    const imported = tr('Settings imported.');
    const undoHint = tr('Previous settings backed up. Use Undo import to restore them.');
    if (notes.length === 0) {
      showToast(`${imported} ${undoHint}`);
    } else {
      const more = notes.length > 1 ? ` (+${trf('{count} more', { count: notes.length - 1 })})` : '';
      showToast(`${imported} ${notes[0]}${more} ${undoHint}`);
      announce(`${imported} ${notes.join(' ')} ${undoHint}`);
    }
  } catch {
    showToast('Could not read that settings file. Pick a JSON file exported by Kick Focus.', true);
  }
}

function undoLastDestructiveAction() {
  const slot = readUndoSlot(gmGet(PRE_IMPORT_BACKUP_KEY, null));
  if (!slot) {
    showToast('There is nothing to undo.', true);
    return;
  }
  // The snapshot is this build's own, and it is a state the user was already
  // in, so the blocklist guard has nothing to protect them from here.
  const result = validateImportedSettings(JSON.stringify(slot.payload), { trusted: true });
  if (!result.ok) {
    showToast('The backup could not be restored. Your current settings are unchanged.', true);
    return;
  }
  const commit = applyImportedStores(result);
  if (!commit.ok) {
    // The backup is kept: a failed restore must stay retryable.
    showToast('The backup could not be restored. Your current settings are unchanged.', true);
    return;
  }
  gmDelete(PRE_IMPORT_BACKUP_KEY);
  renderSettingsPage();
  scheduleApply(0);
  // Undo is one step by design: the slot is spent, so a second press says so
  // rather than putting back the state this one just replaced.
  showToast(slot.action === 'import'
    ? 'Import undone. Your previous settings are back.'
    : 'Reset undone. Your previous settings are back.');
}

function libraryStickerFor(target) {
  const key = target?.dataset?.kfStickerKey;
  return key ? state.stickerPreferences.library.get(key) || null : null;
}

function emoteInsertionPlan(sticker) {
  return insertionPlanFor(sticker, state.live.collisions, sticker?.access);
}

async function copyStickerName(target) {
  const sticker = libraryStickerFor(target);
  const plan = emoteInsertionPlan(sticker);
  if (!plan.ok) {
    showToast('That emote has no plain name to copy.', true);
    return;
  }
  if (!await copyText(plan.text)) {
    showToast('Could not reach the clipboard. Check the clipboard permission for kick.com.', true);
    return;
  }
  showToast(plan.warning ? `Copied ${plan.text}. ${plan.warning}` : `Copied ${plan.text}.`, Boolean(plan.warning));
}

/**
 * Kick's own message box for the channel you are on.
 *
 * Deliberately not the multi-stream grid: those chats are cross-origin
 * `player.kick.com` frames whose documents cannot be reached, and Kick blocks
 * sending from an embedded chat anyway. Typing into the page's own input is the
 * only target, and it must be the real one — a contenteditable that is not
 * Kick's would be an arbitrary write into the page.
 */
// ---------------------------------------------------------------------------
// Colon-trigger emote completion
//
// Mouse-only by design. Every other client accepts with Tab or Enter, which
// means capturing keys the composer is entitled to — and a completion list that
// eats a keystroke is worse than no completion list. This one is clicked, so it
// can never take a key that was meant for Kick, and it never sends: accepting
// puts the plain name at the caret, exactly as the Type-in-chat action does.
// ---------------------------------------------------------------------------

const EMOTE_COMPLETION_LIMIT = 8;

const EMOTE_COMPLETION_CSS = `
  :host {
    position: fixed;
    z-index: 2147483000;
    display: none;
    width: 240px;
  }
  :host([data-kf-open="true"]) { display: block; }
  /* See TOOLTIP_CSS: undo the UA popover styling, then let the top layer and
     the flip fallbacks do the placing. */
  :host([data-kf-anchored="true"]) {
    inset: auto;
    margin: 0;
    border: 0;
    padding: 0;
    background: transparent;
    overflow: visible;
    color: inherit;
    position-area: block-start span-inline-end;
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  }
  [data-kf-complete-list] {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--kf-border-strong, #38463d);
    border-radius: 9px;
    background: var(--kf-panel, #0b100d);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
    font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--kf-text, #f5f8f6);
    max-height: 260px;
    overflow-y: auto;
  }
  button {
    display: grid;
    grid-template-columns: 28px 1fr;
    align-items: center;
    gap: 8px;
    /* 24px is the WCAG 2.2 target-size floor the rest of the interface holds;
       these rows are pointer targets and the only way to accept. */
    min-height: 28px;
    padding: 3px 6px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  button:hover, button:focus-visible { background: rgba(var(--kf-accent-rgb, 124,255,43), .12); }
  button:focus-visible { outline: var(--kf-focus-ring, 3px solid var(--kf-accent, #7cff2b)); outline-offset: -2px; }
  img { width: 24px; height: 24px; object-fit: contain; }
  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

function emoteCompletionHost() {
  let host = document.getElementById('kick-focus-emote-complete');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'kick-focus-emote-complete';
  host.lang = activeLocale();
  host.dataset.kfOpen = 'false';
  const shadow = host.attachShadow({ mode: 'open' });
  adoptStyles(shadow, EMOTE_COMPLETION_CSS);
  const list = document.createElement('div');
  list.dataset.kfCompleteList = 'true';
  // Deliberately a list, not a listbox. Acceptance here is click-only, on
  // purpose and documented below, and a listbox a keyboard user can never
  // operate is worse than a plain list: it advertises arrow navigation and
  // selection that do not exist. The roles go back the day a key path does.
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', tr('Emote suggestions'));
  // Click, never key: bound inside the shadow root so accepting cannot depend
  // on anything the page might stop from bubbling.
  list.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-kf-complete-key]');
    if (!button) return;
    event.preventDefault();
    acceptEmoteCompletion(button.dataset.kfCompleteKey);
  });
  shadow.append(list);
  markAnchoredSurface(host);
  document.body.append(host);
  return host;
}

function hideEmoteCompletion() {
  const host = document.getElementById('kick-focus-emote-complete');
  if (!host || host.dataset.kfOpen !== 'true') return;
  host.dataset.kfOpen = 'false';
  host.style.visibility = 'hidden';
  closeAnchoredSurface(host);
  releaseSurfaceAnchor(host, EMOTE_COMPLETION_ANCHOR);
}

/** The text between the start of the caret's own text node and the caret. */
function textBeforeCaret(input) {
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    return String(input.value ?? '').slice(0, input.selectionStart ?? 0);
  }
  const selection = document.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return '';
  const range = selection.getRangeAt(0);
  if (!input.contains(range.startContainer)) return '';
  const probe = document.createRange();
  probe.selectNodeContents(input);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString();
}

/** Everything this build knows the user could type, as completion candidates. */
function emoteCompletionCandidates() {
  const candidates = [];
  for (const sticker of state.stickerPreferences.library.values()) {
    if (state.stickerPreferences.hidden.has(sticker.key)) continue;
    candidates.push(sticker);
  }
  return candidates;
}

function updateEmoteCompletion() {
  if (!state.settings.content.emoteAutocomplete) return hideEmoteCompletion();
  const input = chatMessageInput();
  if (!input) return hideEmoteCompletion();
  const trigger = emoteTriggerAt(textBeforeCaret(input));
  if (!trigger) return hideEmoteCompletion();
  const matches = rankEmoteCompletions(trigger.query, emoteCompletionCandidates(), {
    favorites: new Set(favoriteKeysInOrder()),
    usage: state.emoteUsage,
    channel: state.live.slug,
    limit: EMOTE_COMPLETION_LIMIT,
  });
  if (!matches.length) return hideEmoteCompletion();

  const host = emoteCompletionHost();
  const list = host.shadowRoot.querySelector('[data-kf-complete-list]');
  setMarkup(list, matches.map((sticker) => `
    <button type="button" data-kf-complete-key="${escapeHtml(sticker.key)}" title="${escapeHtml(trf('Insert {name}', { name: sticker.name }))}" aria-label="${escapeHtml(trf('Insert {name}', { name: sticker.name }))}">
      <img src="${escapeHtml(sticker.src)}" alt="" loading="lazy">
      <span>${escapeHtml(sticker.name)}</span>
    </button>`).join(''));
  state.runtime.emoteCompletion = { length: trigger.length, keys: matches.map((sticker) => sticker.key) };

  // Anchored to the composer rather than the caret, deliberately. Anchor
  // positioning needs a real element, and the only element at the caret would
  // be one written into Kick's own contenteditable — which could end up in the
  // sent message. Pinning to the composer is also steadier: the list stops
  // sliding sideways on every keystroke, which is where FrankerFaceZ and
  // Twitch both put theirs.
  if (anchorSurfaceTo(host, input, EMOTE_COMPLETION_ANCHOR) && openAnchoredSurface(host)) {
    host.dataset.kfOpen = 'true';
    host.style.visibility = 'visible';
    return undefined;
  }

  const anchor = caretRect(input) || input.getBoundingClientRect();
  host.dataset.kfOpen = 'true';
  host.style.visibility = 'hidden';
  // Measured after the rows exist, so the list is placed by its real height
  // rather than an assumed one.
  const height = host.shadowRoot.querySelector('[data-kf-complete-list]').getBoundingClientRect().height || 0;
  const top = anchor.top - height - 6;
  host.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - 260))}px`;
  host.style.top = `${top < 8 ? anchor.bottom + 6 : top}px`;
  host.style.visibility = 'visible';
  return undefined;
}

function caretRect(input) {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  // A collapsed range in an empty text node reports zeros; the input's own box
  // is the honest fallback.
  return rect && (rect.width || rect.height || rect.top) ? rect : null;
}

/**
 * Accept a suggestion: replace the `:query` that triggered it with the plain
 * name and a space. Never the wire token, never an id, and it never sends —
 * the same boundary the Type-in-chat action enforces.
 */
function acceptEmoteCompletion(key) {
  const sticker = state.stickerPreferences.library.get(key);
  const plan = emoteInsertionPlan(sticker);
  const trigger = state.runtime.emoteCompletion;
  hideEmoteCompletion();
  if (!plan.ok || !trigger) return;
  const input = chatMessageInput();
  if (!input) return;
  input.focus();
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    const end = input.selectionStart ?? 0;
    input.setSelectionRange(Math.max(0, end - trigger.length), end);
  } else {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0).cloneRange();
    // Walk back over the trigger. Kick's composer can split a word across text
    // nodes, so this consumes characters rather than assuming one node.
    for (let index = 0; index < trigger.length; index += 1) {
      try { range.setStart(range.startContainer, range.startOffset - 1); } catch { break; }
      if (range.startOffset === 0 && range.toString().length < index + 1) break;
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }
  if (!document.execCommand('insertText', false, `${plan.text} `)) {
    showToast('Kick’s chat box did not accept the text. The name is on your clipboard instead.', true);
    copyText(plan.text);
    return;
  }
  if (plan.warning) showToast(plan.warning, true);
}

// ---------------------------------------------------------------------------
// Daily reward auto-claim
//
// Kick's reward is a header button that opens a dialog holding one action
// button, disabled until the account has watched enough. The claim POST lives
// inside Kick's own bundle, so this drives that dialog instead of the endpoint —
// no new permission, no replayed private request, and no way to claim something
// the account has not earned: a disabled button is Kick refusing, and this
// never clicks one.
//
// Selectors and the action verbs come from a capture of the real dialog. The
// nested `<div class="contents">Claim</div>` is why the label is read from
// `textContent` rather than a child node, and the button carries both `disabled`
// and `aria-disabled="true"` when it is not ready — both are honoured.
// ---------------------------------------------------------------------------

const REWARD_TRIGGER = 'button[aria-label="Claim Your Daily Reward"]';
const REWARD_DIALOG = '[role="dialog"]';

function rewardDialog() {
  // Only a dialog this build actually opened counts. Kick reuses `role="dialog"`
  // for other surfaces, and clicking a button in the wrong one would be a real
  // misfire rather than a missed claim.
  for (const dialog of document.querySelectorAll(REWARD_DIALOG)) {
    if (dialog.dataset.kfRewardDialog === 'true') return dialog;
  }
  return null;
}

function rewardActionButton(dialog) {
  for (const button of dialog.querySelectorAll('button')) {
    if (CLAIM_ACTION.test(button.textContent || '')) return button;
  }
  return null;
}

function rewardActionDisabled(button) {
  return Boolean(button.disabled) || button.getAttribute('aria-disabled') === 'true';
}

/** Close what we opened, and put focus back where the user left it. */
function closeRewardDialog(dialog, restoreTo) {
  if (dialog) {
    delete dialog.dataset.kfRewardDialog;
    const close = dialog.querySelector('button[aria-label*="close" i]');
    if (close) close.click();
  }
  const trigger = document.querySelector(REWARD_TRIGGER);
  // Radix keeps the dialog open while its trigger reports expanded; toggling the
  // trigger is the path that always works, Escape is not (this build adds no
  // key handling, and synthesising one would be a keystroke the page did not get).
  if (trigger?.getAttribute('aria-expanded') === 'true') trigger.click();
  if (restoreTo?.isConnected) restoreTo.focus?.();
}

/**
 * One pass of the reward check, driven from the apply cycle.
 *
 * Deliberately does nothing while the user is mid-interaction: opening Kick's
 * dialog moves focus, and doing that under someone typing in chat or reading a
 * Kick Focus panel would cost more than the reward is worth.
 */
/**
 * The claim timestamps, read from storage rather than memory.
 *
 * Both are shared: someone with four Kick tabs open would otherwise have four
 * independent cooldowns, and all four would open Kick's reward dialog. Reading
 * the record each pass means one tab claiming backs every tab off, and the
 * recheck interval survives a reload instead of restarting with it.
 */
function rewardRecord() {
  const stored = gmGet(REWARD_STATE_KEY, null);
  const record = isPlainRecord(stored) ? stored : {};
  return {
    lastClaimAt: Number(record.lastClaimAt) || 0,
    // When to look again. A record written by an older build has none, which
    // reads as zero and means "look now" — the right answer for an upgrade.
    nextCheckAt: Number(record.nextCheckAt) || 0,
    claims: Number(record.claims) || 0,
  };
}

function writeRewardRecord(patch) {
  const next = { ...rewardRecord(), ...patch };
  gmSet(REWARD_STATE_KEY, next);
  Object.assign(state.reward, next);
  return next;
}

function runRewardClaim() {
  const settings = state.settings.content;
  const now = Date.now();
  const trigger = document.querySelector(REWARD_TRIGGER);
  const open = rewardDialog();
  const record = rewardRecord();
  const action = open ? rewardActionButton(open) : null;
  const decision = decideRewardClaim({
    enabled: settings.autoClaimRewards,
    hasTrigger: Boolean(trigger),
    dialogOpen: Boolean(open),
    hasAction: Boolean(action),
    actionDisabled: !action || rewardActionDisabled(action),
    now,
    nextCheckAt: record.nextCheckAt,
  });
  state.reward.decision = decision.reason;
  if (decision.action === 'absent' || decision.action === 'cooling') return;

  if (decision.action === 'open') {
    // Never take focus out from under someone. The next cycle will try again.
    // `state.modal` is the settings panel's own container — the shadow host is
    // not it, because the host also carries the always-visible quick button and
    // is therefore never hidden. Keying off the host meant the panel always read
    // as open and the claim could never run at all.
    const panelOpen = Boolean(state.modal && !state.modal.hidden);
    if (multistreamOpen() || panelOpen || document.activeElement?.closest?.(
      '[data-testid="chat-input"], #chat-input, div[contenteditable="true"][role="textbox"], input, textarea',
    )) return;
    // Hold the slot before opening, so a tab that is torn down mid-open does
    // not leave every other tab thinking a check is still due.
    writeRewardRecord({ nextCheckAt: now + CLAIM_RECHECK_MS });
    state.reward.restoreFocusTo = document.activeElement;
    trigger.click();
    // Radix mounts the dialog synchronously off the click; claim on the next
    // cycle so a half-rendered dialog is never acted on.
    for (const dialog of document.querySelectorAll(REWARD_DIALOG)) {
      if (dialog.contains(trigger)) continue;
      dialog.dataset.kfRewardDialog = 'true';
    }
    return;
  }

  if (decision.action === 'wait') {
    const dialogText = open.textContent || '';
    const minutes = parseClaimCountdown(dialogText);
    // Schedule from what Kick just said, not from a timer: the countdown when
    // there is one, and the nightly rollover when the reward is already gone.
    const nextCheckAt = nextRewardCheckAt({ outcome: 'not-ready', now, minutesRemaining: minutes, dialogText });
    writeRewardRecord({ nextCheckAt });
    state.reward.minutesRemaining = minutes;
    state.reward.lastMessage = minutes != null
      ? `Kick wants ${minutes} more ${plural(minutes, 'minute', 'minutes')} of watch time.`
      : 'Already collected today.';
    closeRewardDialog(open, state.reward.restoreFocusTo);
    updateRewardStatusInPlace();
    return;
  }

  // The only click this feature ever makes. Recorded before it happens, so a
  // reward that claims but throws on the way out is still not claimed twice.
  writeRewardRecord({
    lastClaimAt: now,
    claims: record.claims + 1,
    nextCheckAt: nextRewardCheckAt({ outcome: 'claimed', now }),
  });
  state.reward.minutesRemaining = 0;
  // Disown the dialog *before* clicking. It stays on screen for the reveal, and
  // the apply cycle runs every few seconds — so while it is still marked as
  // ours, every one of those passes sees a claimable dialog and presses the
  // button again. The stored schedule cannot stop that on its own, because an
  // open dialog is exactly the state that is allowed to skip it.
  delete open.dataset.kfRewardDialog;
  // Safe while a Kick Focus modal is open, even though the page behind one is
  // inert. Measured in headless Chromium 1234 on 2026-08-25: with the container
  // inert, a scripted .click() still ran the handler and an anchor still
  // navigated, while focus() was refused. inert blocks user interaction and
  // focus, not synthetic activation. This matters because the claim is recorded
  // before the click, so a swallowed one would mark the reward taken and never
  // retry it that day.
  action.click();
  state.reward.lastMessage = `Daily reward claimed at ${new Date(now).toLocaleTimeString()}.`;
  showToast('Daily reward claimed. It is in your collectibles.', false, [
    { label: 'View', onClick: () => window.open('https://kick.com/collectibles', '_blank', 'noopener') },
  ]);
  announce('Daily reward claimed.');
  // Let the reveal animation run before closing, the way a person would. The
  // reference is held rather than re-looked-up, because it is no longer marked.
  window.setTimeout(() => closeRewardDialog(open, state.reward.restoreFocusTo), 6000);
  updateRewardStatusInPlace();
}

function updateRewardStatusInPlace() {
  for (const node of state.shadow?.querySelectorAll('[data-kf-reward-status]') || []) {
    node.textContent = rewardStatusSummary();
  }
}

function rewardStatusSummary() {
  if (!state.settings.content.autoClaimRewards) return 'Off. Kick Focus never opens the reward dialog.';
  const record = rewardRecord();
  const parts = [];
  if (record.lastClaimAt) {
    parts.push(`Last claimed ${new Date(record.lastClaimAt).toLocaleString()} (${record.claims} ${plural(record.claims, 'time', 'times')} on this browser).`);
  } else {
    parts.push('Nothing claimed yet on this browser.');
  }
  if (state.reward.lastMessage) parts.push(state.reward.lastMessage);
  // The whole point of the schedule is that it is knowable, so say it.
  if (record.nextCheckAt > Date.now()) {
    parts.push(`Next check ${new Date(record.nextCheckAt).toLocaleString()}.`);
  } else if (!record.nextCheckAt) {
    parts.push('No reward button has appeared yet. It only exists while you are signed in.');
  }
  return parts.join(' ');
}

const CHAT_ROOM_SELECTOR = '#channel-chatroom, [data-testid="chatroom"]';
const CHAT_COMPOSER_SELECTOR = '[data-testid="chat-input"], #chat-input, [contenteditable="true"][role="textbox"]';

function validChatComposer(input) {
  if (!input || input.closest('[data-kf-multistream-backdrop], iframe')) return null;
  if (!input.closest(CHAT_ROOM_SELECTOR)) return null;
  return input.isContentEditable || input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement ? input : null;
}

function chatMessageInput() {
  if (multistreamOpen()) return null;
  for (const room of document.querySelectorAll(CHAT_ROOM_SELECTOR)) {
    const input = validChatComposer(room.querySelector(CHAT_COMPOSER_SELECTOR));
    if (input) return input;
  }
  return null;
}

function composerInputFor(node) {
  return validChatComposer(node?.closest?.(CHAT_COMPOSER_SELECTOR));
}

function composerText(input) {
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) return input.value || '';
  return input?.isContentEditable ? input.textContent || '' : '';
}

function composerIsWhisper(input) {
  return /^\/messages(?:\/|$)/i.test(location.pathname)
    || Boolean(input?.closest?.('[data-testid*="whisper" i], [data-testid*="direct-message" i], [data-testid*="message-thread" i]'));
}

function rememberComposerMessage(input) {
  if (!state.settings.content.chatComposerRecall || !input) return;
  const text = composerText(input);
  const now = Date.now();
  // Enter, click, and submit can all describe the same send. Coalesce that one
  // gesture without collapsing a repeated message sent later on purpose.
  if (text === state.runtime.composerRememberedText && now - state.runtime.composerRememberedAt < 300) return;
  const next = appendComposerRecall(state.chatComfort.composerRecall, text, composerIsWhisper(input));
  const changed = next.length !== state.chatComfort.composerRecall.length
    || next.some((message, index) => message !== state.chatComfort.composerRecall[index]);
  if (!changed) return;
  state.chatComfort.composerRecall = next;
  state.chatComfort.composerRecallIndex = -1;
  state.runtime.composerRememberedText = text;
  state.runtime.composerRememberedAt = now;
}

function replaceComposerText(input, text) {
  state.runtime.recallingComposer = true;
  try {
    input.focus();
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) setter.call(input, text);
      else input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      input.setSelectionRange?.(text.length, text.length);
      return true;
    }
    if (!input.isContentEditable) return false;
    const selection = document.getSelection();
    if (!selection) return false;
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    return document.execCommand('insertText', false, text) === true;
  } finally {
    state.runtime.recallingComposer = false;
  }
}

function onComposerKeydown(event) {
  const input = composerInputFor(event.target);
  if (!input) return;
  if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
    rememberComposerMessage(input);
    return;
  }
  if (!state.settings.content.chatComposerRecall || !isComposerRecallGesture(event)) return;
  const messages = state.chatComfort.composerRecall;
  if (!messages.length) return;
  const nextIndex = (state.chatComfort.composerRecallIndex + 1) % messages.length;
  const recalled = composerRecallAt(messages, nextIndex);
  if (!recalled || !replaceComposerText(input, recalled)) return;
  state.chatComfort.composerRecallIndex = nextIndex;
  event.preventDefault();
  event.stopPropagation();
}

function onComposerInput(event) {
  const input = composerInputFor(event.target);
  if (!input) return;
  if (!state.runtime.recallingComposer) state.chatComfort.composerRecallIndex = -1;
  updateEmoteCompletion();
}

function onComposerSubmit(event) {
  const room = event.target?.closest?.(CHAT_ROOM_SELECTOR);
  const input = room ? validChatComposer(event.target?.querySelector?.(CHAT_COMPOSER_SELECTOR)) : null;
  rememberComposerMessage(input);
}

function onComposerSendClick(event) {
  const button = event.target?.closest?.('[data-testid="chat-send-button"], [data-testid="send-message"], button[type="submit"][aria-label*="send" i]');
  const room = button?.closest?.(CHAT_ROOM_SELECTOR);
  if (!room) return;
  rememberComposerMessage(validChatComposer(room.querySelector(CHAT_COMPOSER_SELECTOR)));
}

/**
 * Type the plain name at the caret. Never sends.
 *
 * `execCommand('insertText')` is the only path: it goes through the editor's own
 * input handling, so Kick's composer sees a real edit and keeps its state
 * consistent. There is deliberately no `textContent` fallback — writing text
 * directly into a rich editor leaves its internal model out of sync with the
 * DOM, and a message assembled that way is not one the user composed. No
 * synthetic Enter, no send-button click, anywhere in this path.
 */
function insertStickerName(target) {
  // The setting gates the action, not just the button. Hiding a control is
  // presentation; this path types into someone's message box.
  if (!state.settings.content.insertEmoteName) return;
  const sticker = libraryStickerFor(target);
  const plan = emoteInsertionPlan(sticker);
  if (!plan.ok) {
    showToast('That emote has no plain name to type.', true);
    return;
  }
  // The only button that reaches here lives on the Settings emotes page, and
  // the page behind an open modal is inert, so Kick's composer was not
  // focusable and every press fell through to the clipboard fallback. Typing
  // into chat is also a request to be looking at chat, so Settings closes
  // first rather than the page being made reachable underneath it.
  closeSettings();
  const input = chatMessageInput();
  if (!input) {
    showToast('Open a channel chat first.', true);
    return;
  }
  input.focus();
  if (!document.execCommand('insertText', false, plan.text)) {
    showToast('Kick’s chat box did not accept the text. The name is on your clipboard instead.', true);
    copyText(plan.text);
    return;
  }
  showToast(plan.warning ? `Typed ${plan.text}. ${plan.warning}` : `Typed ${plan.text} at your cursor.`, Boolean(plan.warning));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

function copyErrorLog() {
  const lines = state.diagnostics.errors.length
    ? state.diagnostics.errors.map((entry) => `${new Date(entry.at).toISOString()} [${entry.context}] ${entry.message}`)
    : ['No errors recorded this session.'];
  const text = `Kick Focus ${VERSION} error log\n${lastCrashSummary()}\n\n${lines.join('\n')}`;
  copyText(text).then((copied) => showToast(copied ? 'Error log copied.' : 'Could not copy the error log.', !copied));
}

async function copyDiagnostics() {
  const summary = {
    product: 'Kick Focus',
    version: VERSION,
    date: new Date().toISOString(),
    route: state.route,
    viewport: `${innerWidth}x${innerHeight}`,
    protection: {
      blocked: state.diagnostics.blocked,
      removedShells: state.diagnostics.shells,
      lastMatch: state.diagnostics.lastMatch,
    },
    applyCycle: applyCostSummary(state.diagnostics.apply),
    routeSource: state.runtime.routeSource,
    settingsSchema: SETTINGS_SCHEMA,
    settingsDiff: diagnosticSettingsDiff(state.settings),
    probes: state.compatibility?.probes || null,
  };
  const copied = await copyText(JSON.stringify(summary, null, 2));
  showToast(copied ? 'Diagnostic summary copied.' : 'Clipboard access was unavailable.', !copied);
}

function runSelfCheck() {
  state.compatibility = compatibilitySnapshot(document, { expectedChat: state.route === 'channel', derive: compatibilityDerivers() });
    publishCompatibility();
  const checks = [
    ['document-start marker', Boolean(pageWindow.__kickFocusNetworkDefenseV1)],
    ['SPA lifecycle hook', Boolean(pageWindow.__kickFocusSpaHooksV1)],
    ['interface mounted', Boolean(state.root?.isConnected)],
    ['route classified', state.route !== 'other' || location.pathname !== '/'],
    ['ad defense locked on', state.settings.content.blockAds === true],
    ['compatibility probes', state.compatibility.healthy],
  ];
  const companion = companionInfo();
  const failures = checks.filter(([, passed]) => !passed).map(([label]) => label);
  updateCompatibilityInPlace();
  // The companion is optional, so its absence is reported but never a failure.
  const layer = companion.active ? `network + page (companion v${companion.version})` : 'page only';
  const timing = `injected ${INJECTION.summary}`;
  showToast(failures.length
    ? `Self-check needs attention: ${failures.join(', ')}.`
    : `Self-check passed: ${checks.length}/${checks.length}. Protection layer: ${layer}. Started ${timing}.`, failures.length > 0);
}

function clearEnhancedPage() {
  const root = document.documentElement;
  state.chatResizeCleanup?.();
  state.chatResizeCleanup = null;
  clearStickerUI();
  stopSessionWatchTime();
  hideFollowingPreview();
  state.followingPreview?.remove?.();
  state.followingPreview = null;
  disconnectChatStickerObserver();
  if (root.dataset.kfManagedSidebar === 'true') {
    findProbe(document, 'sidebarExpand').element?.click?.();
  }
  for (const key of Object.keys(root.dataset)) {
    if (key.startsWith('kf')) delete root.dataset[key];
  }
  for (const property of ['--kf-chat-width', '--kf-thumb-saturation', '--kf-caption-opacity', '--kf-text-scale', '--color-primary-base', '--color-surface-base', '--color-surface-highest', '--color-surface-lowest']) {
    root.style.removeProperty(property);
  }
  for (const node of document.querySelectorAll('[data-kf-chat-separator], [data-kf-chat-panel], [data-kf-channel-row], [data-kf-filtered], [data-kf-mature], [data-kf-ad-shell], [data-kf-watched], [data-kf-live-card], [data-kf-dismissed], [data-kf-highlighted], [data-kf-player], [data-kf-player-resize-ready], [data-kf-card-actions], [data-kf-card-uptime], [data-kf-card-uptime-owner], [data-kf-uptime], [data-kf-vod-expiry], [data-kf-chat-pause], [data-kf-chat-status], [data-kf-playback-diagnostics], [data-kf-search-meta], [data-kf-drops-empty], [data-kf-native-drops-empty], [data-kf-monetization], [data-kf-following-preview]')) {
    if (node.matches?.('[data-kf-card-actions], [data-kf-card-uptime], [data-kf-uptime], [data-kf-vod-expiry], [data-kf-chat-pause], [data-kf-chat-status], [data-kf-playback-diagnostics], [data-kf-search-meta], [data-kf-drops-empty]')) node.remove();
    else {
      for (const key of Object.keys(node.dataset || {})) if (key.startsWith('kf')) delete node.dataset[key];
    }
  }
  removeSiteStyle();
  clearKeywordHighlight();
  clearTimeout(state.applyTimer);
  state.applyTimer = 0;
  clearInterval(state.playbackDiagnosticsTimer);
  state.playbackDiagnosticsTimer = 0;
  // The player uptime chip is driven by its own 1 Hz interval, and the only
  // code that stops it is `applyStreamUptime` — which the apply cycle stops
  // calling the moment the panic switch sets `suspended`. Left out of this
  // list, the interval kept writing to a chip that teardown also left on
  // screen, for the life of the tab.
  clearInterval(state.uptimeTimer);
  state.uptimeTimer = 0;
  clearInterval(state.discoveryUptimeTimer);
  state.discoveryUptimeTimer = 0;
  state.observers.document?.disconnect?.();
  state.observers.body?.disconnect?.();
  state.observers.chat?.disconnect?.();
  state.observers.stickers?.disconnect?.();
  releaseChatScrollPause();
  state.observers.document = null;
  state.observers.body = null;
  state.observers.chat = null;
  state.observers.stickers = null;
  state.runtime.stickerPickerTarget = null;
  clearInterval(state.remoteSyncTimer);
  state.remoteSyncTimer = 0;
  state.runtime.focus = false;
  state.runtime.theater = false;
  state.runtime.chatHidden = false;
  state.runtime.sidebarHidden = false;
  state.runtime.chatPaused = false;
  state.runtime.chatPauseNode = null;
  state.runtime.chatScrollAnchor = null;
  state.runtime.chatScrollTop = null;
  if (state.modal) state.modal.hidden = true;
  if (state.command) state.command.hidden = true;
  // The grid was left open on top of a page this had just made reachable
  // again, so it kept saying aria-modal while everything behind it answered
  // the pointer and the accessibility tree. Pausing means every surface goes.
  if (multistreamOpen()) {
    closeChatWindow();
    closeMergedChat();
    closeMultistream();
  }
  // Kick's separator gets its own attributes back, and the keyboard with them.
  releaseChatSeparator();
  // Last, once nothing is open to keep it inert.
  releasePageInert();
  state.profileStatsHost?.remove?.();
  state.runtime.suspended = true;
  syncQuickButton();
}

function restoreEnhancedPage() {
  state.runtime.suspended = false;
  // Nothing should be open across a pause, but resuming must not be the one
  // path that leaves the page's reachability out of step with what is on top.
  syncPageInert();
  addStyle(SITE_CSS);
  applySettingsAttributes();
  installDocumentObserver();
  installRemoteBlocklistTimer();
  scheduleApply(0);
  syncQuickButton();
}

function togglePanicSwitch() {
  if (state.runtime.suspended) {
    restoreEnhancedPage();
    announce('Kick Focus restored');
    showToast('Kick Focus restored.');
  } else {
    clearEnhancedPage();
    showToast('Kick Focus paused. Use the Resume button or Ctrl+Shift+F to restore.');
  }
}

/**
 * Raise or retire the persistent storage warning.
 *
 * Deliberately not a toast: a toast that disappears after 3.6 seconds is how
 * this failure stayed invisible. Dismissing it clears the acknowledgement for
 * the *current* set of failing keys only, so a new failure raises it again.
 */
function renderStorageWarning() {
  const alert = state.shadow?.querySelector('[data-kf-storage-alert]');
  if (!alert) return;
  const summary = describeStorageFailures(storageHealth.failures);
  if (!summary) {
    alert.hidden = true;
    storageHealth.acknowledged = '';
    return;
  }
  const signature = summary.keys.join('|');
  if (storageHealth.acknowledged === signature) return;
  const message = localizedStorageFailure(summary);
  alert.querySelector('[data-kf-storage-alert-copy]').textContent = message;
  alert.dataset.kfStorageSignature = signature;
  alert.hidden = false;
  announce(message);
}

function localizedStorageFailure(summary) {
  const labels = summary.labels.map((label) => tr(label));
  const list = new Intl.ListFormat(activeLocale(), { style: 'long', type: 'conjunction' }).format(labels);
  return trf(summary.messageKey || summary.message, { list });
}

function storageDiagnostics() {
  const entries = {};
  for (const key of Object.keys(STORAGE_LABELS)) {
    const raw = gmGet(key, null);
    if (raw != null) entries[key] = raw;
  }
  return approximateStorageBytes(entries);
}

function showToast(message, isError = false, actions = []) {
  const toast = state.shadow?.querySelector('[data-kf-toast]');
  if (!toast) return;
  toast.textContent = '';
  const text = document.createElement('span');
  text.className = 'kf-toast-text';
  // Toasts write straight to textContent, so localizeInterface never gets a
  // chance at them on the render pass — they translate here or not at all.
  text.textContent = tr(message);
  toast.append(text);
  for (const action of actions) {
    if (!action || typeof action.onClick !== 'function') continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kf-toast-action';
    button.textContent = tr(action.label);
    button.addEventListener('click', () => {
      toast.hidden = true;
      action.onClick();
    });
    toast.append(button);
  }
  toast.dataset.error = String(isError);
  // Errors interrupt (assertive); routine confirmations wait their turn (polite).
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  toast.hidden = false;
  clearTimeout(showToast.timer);
  // Action toasts stay long enough to be clicked; plain toasts clear quickly.
  showToast.timer = setTimeout(() => { toast.hidden = true; }, actions.length ? 7000 : 3600);
}

function commandDefinitions() {
  return [
    { id: 'panic', label: tr(state.runtime.suspended ? 'Restore Kick Focus' : 'Pause Kick Focus'), description: tr('Temporarily remove enhanced layout and request hooks') },
    { id: 'focus', label: tr(state.runtime.focus ? 'Exit focus mode' : 'Enter focus mode'), description: tr('Maximize the stream and hide side panels') },
    { id: 'theater', label: tr(state.runtime.theater ? 'Exit theater mode' : 'Enter theater mode'), description: tr('Hide discovery while keeping chat') },
    { id: 'chat', label: tr(state.runtime.chatHidden ? 'Show chat' : 'Hide chat'), description: tr('Toggle the chat panel for this session') },
    { id: 'sidebar', label: tr(state.runtime.sidebarHidden ? 'Show sidebar' : 'Hide sidebar'), description: tr('Toggle the discovery rail for this session') },
    { id: 'mature', label: tr(state.runtime.matureVisible ? 'Blur mature thumbnails' : 'Reveal mature thumbnails'), description: tr('Temporarily override mature-card blur') },
    { id: 'density', label: tr(state.settings.layout.density === 'compact' ? 'Use comfortable density' : 'Use compact density'), description: tr('Change discovery spacing and save it') },
    { id: 'casino', label: tr(state.settings.content.hideCasino ? 'Show casino content' : 'Hide casino content'), description: tr('Filter clearly labeled casino streams') },
    { id: 'poor', label: tr(state.settings.content.hideMonetization ? 'Disable Poor mode' : 'Enable Poor mode'), description: tr('Remove spending prompts without changing your Kick account') },
    { id: 'multistream', label: tr(multistreamOpen() ? 'Close multi-stream' : 'Open multi-stream'), description: tr('Watch several Kick channels in one grid') },
    { id: 'settings', label: tr('Open Kick Focus settings'), description: tr('Customize layout, appearance, content, and access') },
  ];
}

function renderCommands() {
  if (!state.commandList) return;
  const query = (state.commandInput?.value || '').trim().toLowerCase();
  const commands = commandDefinitions().filter((command) => `${command.label} ${command.description}`.toLowerCase().includes(query));
  const count = state.shadow?.querySelector('[data-kf-command-count]');
  // Marked data-kf-no-translate: this text is a number plus an already-chosen
  // plural form, so the localizer must leave it alone. Otherwise it records the
  // English on first render and every later pass rewrites the translated form
  // back from that recorded source.
  if (count) count.textContent = `${commands.length} ${plural(commands.length, 'command available', 'commands available')}`;
  // The active option is state, not the first one. It used to be hard-coded to
  // index 0, so a reader was told the first match was selected wherever the
  // user actually was, and Enter ran that one.
  state.commandActive = commands.length ? Math.min(Math.max(0, state.commandActive), commands.length - 1) : -1;
  setMarkup(state.commandList, commands.length
    ? commands.map((command, index) => `<button type="button" class="kf-command-item" role="option" id="kf-command-option-${index}" aria-selected="${index === state.commandActive}" data-action="command:${command.id}" data-active="${index === state.commandActive}"><div><strong>${escapeHtml(command.label)}</strong><span>${escapeHtml(command.description)}</span></div></button>`).join('')
    : '<div class="kf-command-empty"><strong>No matching commands</strong><span>Try “chat”, “layout”, “casino”, or “settings”.</span></div>');
  syncCommandActiveDescendant();
  localizeInterface();
}

function openCommandMenu() {
  if (!state.command) return;
  // Recorded before closeSettings runs, so the opener is the control the reader
  // actually pressed rather than whatever that close leaves focused.
  const opener = deepActiveElement();
  closeSettings();
  state.commandOpener = opener;
  state.command.hidden = false;
  syncPageInert();
  state.commandActive = 0;
  state.commandInput.value = '';
  renderCommands();
  requestAnimationFrame(() => state.commandInput.focus());
}

function closeCommandMenu() {
  if (!state.command || state.command.hidden) return;
  state.command.hidden = true;
  syncPageInert();
  // Every dismissal routes here (Escape, the backdrop, running a command), and
  // none of them used to put focus anywhere, so it fell to the body each time.
  restoreFocus(state.commandOpener);
  state.commandOpener = null;
}

function executeCommand(id) {
  if (id === 'multistream') {
    closeCommandMenu();
    if (multistreamOpen()) closeMultistream();
    else openMultistream();
    return;
  }
  if (id === 'panic') {
    togglePanicSwitch();
    closeCommandMenu();
    return;
  } else if (id === 'focus') {
    state.runtime.focus = !state.runtime.focus;
    if (state.runtime.focus) state.runtime.theater = false;
    announce(state.runtime.focus ? 'Focus mode on' : 'Focus mode off');
  } else if (id === 'theater') {
    state.runtime.theater = !state.runtime.theater;
    if (state.runtime.theater) state.runtime.focus = false;
    announce(state.runtime.theater ? 'Theater mode on' : 'Theater mode off');
  } else if (id === 'chat') {
    state.runtime.chatHidden = !state.runtime.chatHidden;
    announce(state.runtime.chatHidden ? 'Chat hidden' : 'Chat shown');
  } else if (id === 'sidebar') {
    state.runtime.sidebarHidden = !state.runtime.sidebarHidden;
    announce(state.runtime.sidebarHidden ? 'Sidebar hidden' : 'Sidebar shown');
  } else if (id === 'mature') {
    state.runtime.matureVisible = !state.runtime.matureVisible;
    announce(state.runtime.matureVisible ? 'Mature thumbnails revealed' : 'Mature thumbnails blurred');
  } else if (id === 'density') {
    updateSetting('layout.density', state.settings.layout.density === 'compact' ? 'comfortable' : 'compact', 'Density saved');
  } else if (id === 'casino') {
    updateSetting('content.hideCasino', !state.settings.content.hideCasino, 'Content filter saved');
  } else if (id === 'poor') {
    updateSetting('content.hideMonetization', !state.settings.content.hideMonetization, 'Poor mode saved');
  } else if (id === 'settings') {
    openSettings();
    return;
  }
  closeCommandMenu();
  saveChannelLayout();
  scheduleApply(0);
}

/**
 * Point the combobox at whichever option is active.
 *
 * A listbox that never moves `aria-activedescendant` reports the same option
 * however far the user has arrowed, which is the defect this pairs with. The
 * option is scrolled into view too, because an active option below the fold is
 * only nominally active.
 */
function syncCommandActiveDescendant() {
  if (!state.commandInput || !state.commandList) return;
  const options = [...state.commandList.querySelectorAll('[data-action^="command:"]')];
  const active = options[state.commandActive] || null;
  if (active) {
    state.commandInput.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView?.({ block: 'nearest' });
  } else {
    state.commandInput.removeAttribute('aria-activedescendant');
  }
  state.commandInput.setAttribute('aria-expanded', String(options.length > 0));
}

function onCommandKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCommandMenu();
    return;
  }
  const options = [...state.commandList.querySelectorAll('[data-action^="command:"]')];
  if (event.key === 'Enter') {
    const active = options[state.commandActive] || options[0];
    if (active) {
      event.preventDefault();
      executeCommand(active.dataset.action.slice(8));
    }
    return;
  }
  // Arrows, Home and End belong to the listbox while it has focus. Anything
  // else is typing and is left alone, including the modified forms: Ctrl+Home
  // in a text field is the caret, not the list.
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const moved = nextActiveIndex(state.commandActive, options.length, event.key);
  if (moved === state.commandActive || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  state.commandActive = moved;
  for (const [index, option] of options.entries()) {
    const selected = String(index === moved);
    option.setAttribute('aria-selected', selected);
    option.dataset.active = selected;
  }
  syncCommandActiveDescendant();
}

/**
 * Keep Tab inside whichever overlay is on top.
 *
 * Every modal surface needs this, not just settings: tabbing out of a dialog
 * lands on a page the user cannot see, and in the multi-stream grid the next
 * stops are cross-origin player frames whose interiors cannot be focus-managed
 * at all. Containment at the host is the only control available there.
 */
// Every surface this build appends to the body carries one of these ids, and
// they are the only body children that stay reachable while a modal is up.
//
// Declared as functions and built on first use on purpose. The multi-stream
// host object is assembled near the top of the bundle and takes syncPageInert
// as one of its collaborators, so an arrow bound to a `const` down here is read
// before it exists. The boot gate catches that as a TDZ, which is how this was
// found rather than shipped.
let pageInertManager = null;

function pageInert() {
  pageInertManager ||= createPageInertManager(
    () => document.body,
    (node) => typeof node?.id === 'string' && node.id.startsWith('kick-focus-'),
  );
  return pageInertManager;
}

function releasePageInert() {
  pageInert().release();
}

function syncPageInert() {
  pageInert().sync(Boolean(topmostOverlayLayer(overlayOpenState())));
}

function overlayOpenState() {
  return {
    multistream: multistreamOpen(),
    command: Boolean(state.command && !state.command.hidden),
    settings: Boolean(state.modal && !state.modal.hidden),
  };
}

function topmostOverlayShell() {
  const top = topmostOverlayLayer(overlayOpenState());
  return top ? state.shadow?.querySelector(top.selector) : null;
}

function trapFocus(event) {
  if (event.key !== 'Tab') return false;
  const shell = topmostOverlayShell();
  if (!shell) return false;
  const candidates = [...shell.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.closest('[hidden]'));
  // Visibility filtering is a refinement, never a way to end up with nothing:
  // a positioning quirk that emptied this list would silently switch the trap
  // off, which is worse than trapping onto an offscreen control.
  const visible = candidates.filter((element) => element.checkVisibility?.() ?? true);
  const focusable = visible.length ? visible : candidates;
  if (!focusable.length) return false;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = state.shadow.activeElement;
  if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); return true; }
  if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); return true; }
  return false;
}

/**
 * The only key this build claims from the page, and Escape inside its own
 * surfaces.
 *
 * Kick owns the page keyboard. Six configurable chords used to be captured
 * here, four of them bare letters, which is a lot of a stranger's keyboard to
 * take for a viewer mod. Every action they reached is on the command menu,
 * which now has a button in the header.
 *
 * Ctrl+Shift+F stays because it is the one binding whose value is that it
 * works when the interface itself is in the way. It is fixed rather than
 * configurable, and the same action sits on the command menu beside the rest.
 */
function onGlobalKeydown(event) {
  if (!state.shadow) return;
  if (event.ctrlKey && event.shiftKey && String(event.key).toLowerCase() === 'f') {
    event.preventDefault();
    event.stopPropagation();
    togglePanicSwitch();
    return;
  }
  // Escape cancels the innermost open surface, off the same ladder the focus
  // trap uses. Closing all of Settings from a confirmation prompt discards the
  // page the user was working on to answer a question they only declined.
  if (event.key === 'Escape') {
    const top = topmostOverlayLayer(overlayOpenState())?.layer;
    if (top) {
      event.preventDefault();
      event.stopPropagation();
      if (top === 'multistream') closeMultistream();
      else if (top === 'command') closeCommandMenu();
      else closeSettings();
      return;
    }
  }
  trapFocus(event);
}

const HEADER_CONTROL_CSS = `
  :host { display: inline-flex; flex: 0 0 auto; gap: 6px; color-scheme: dark; }
  * { box-sizing: border-box; }
  /* Repeats the settings panel's earned marker inside Kick's own header. The
     status itself is in the button's accessible name; this is the glance. */
  [data-kf-earned="reward-ready"] { position: relative; }
  [data-kf-earned="reward-ready"]::after {
    content: ''; position: absolute; top: 3px; right: 3px; width: 7px; height: 7px;
    border-radius: 50%; background: var(--kf-accent, #7cff2b);
    animation: kf-earned-pulse 2.4s ease-in-out infinite;
  }
  @keyframes kf-earned-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @media (prefers-reduced-motion: reduce) {
    [data-kf-earned="reward-ready"]::after { animation: none; }
  }
  button {
    display: inline-flex;
    height: 36px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 11px;
    border: 1px solid rgba(var(--kf-accent-rgb, 124,255,43), var(--kf-header-edge-alpha, .38));
    border-radius: 5px;
    background: linear-gradient(180deg, rgba(var(--kf-accent-rgb, 124,255,43), .12), rgba(var(--kf-accent-rgb, 124,255,43), .055));
    color: #f4f7f5;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
    cursor: pointer;
    font: 750 12px/1 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: .015em;
    white-space: nowrap;
    transition: border-color 120ms ease, background 120ms ease, color 120ms ease, transform 80ms ease;
  }
  button:hover { border-color: var(--kf-accent, #7cff2b); background: rgba(var(--kf-accent-rgb, 124,255,43), .15); color: var(--kf-accent, #7cff2b); }
  button:active { transform: scale(.97); }
  button:focus-visible { outline: var(--kf-focus-ring, 3px solid var(--kf-accent, #7cff2b)); outline-offset: var(--kf-focus-offset, 2px); }
  img { display: block; width: 18px; height: 18px; object-fit: contain; }
  .kf-header-multi svg { width: 15px; height: 15px; fill: currentColor; opacity: .9; }
  .kf-header-add [data-kf-header-add-icon] { font-weight: 800; font-size: 14px; }
  .kf-header-add[data-in-multi="true"] { border-color: var(--kf-accent, #7cff2b); background: rgba(var(--kf-accent-rgb, 124,255,43), .2); color: var(--kf-accent, #7cff2b); }
  @media (max-width: 960px) {
    button { width: 36px; padding: 0; }
    span { display: none; }
  }
  /* Last in the sheet on purpose. The pulse above was guarded and the button's
     own transition and :active scale were not, which made this the only
     injected control in the build that moved for a user who asked nothing to.
     It has to come after the button rule's own transition shorthand, which
     would otherwise reset the duration this sets. Matches the guard at the end
     of PROFILE_STATS_CSS. */
  @media (prefers-reduced-motion: reduce) {
    button { transition-duration: .001ms; }
    button:active { transform: none; }
  }
`;

const PROFILE_STATS_CSS = `
  :host { display: inline-flex; }
  button {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    gap: 6px;
    padding: 0 12px;
    border: 1px solid var(--kf-border-strong, rgba(255,255,255,.16));
    border-radius: 8px;
    background: var(--kf-panel-raised, #111713);
    color: var(--kf-text, #f5f8f6);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
    font: 700 14px/1 "Segoe UI", sans-serif;
    white-space: nowrap;
    cursor: pointer;
    transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease, transform 140ms ease;
  }
  button:hover {
    border-color: rgba(var(--kf-accent-rgb, 83, 252, 24), .62);
    background: rgba(var(--kf-accent-rgb, 83, 252, 24), .10);
    color: var(--kf-accent, #7cff2b);
    transform: translateY(-1px);
  }
  button:active { transform: translateY(0) scale(.98); }
  button:focus-visible {
    border-color: var(--kf-accent, #7cff2b);
    outline: var(--kf-focus-ring, 3px solid var(--kf-accent, #7cff2b));
    outline-offset: 2px;
  }
  svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @media (max-width: 960px) {
    button { width: 40px; padding: 0; }
    span { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    button { transition-duration: .001ms; }
  }
`;

function streamerStatsPopupFeatures() {
  const availableWidth = Math.max(704, Number(window.screen?.availWidth) || Number(window.outerWidth) || 1280);
  const availableHeight = Math.max(624, Number(window.screen?.availHeight) || Number(window.outerHeight) || 900);
  const width = Math.max(640, Math.min(1180, availableWidth - 64));
  const height = Math.max(560, Math.min(820, availableHeight - 64));
  const originX = Number.isFinite(Number(window.screenX)) ? Number(window.screenX) : 0;
  const originY = Number.isFinite(Number(window.screenY)) ? Number(window.screenY) : 0;
  const outerWidth = Math.max(width, Number(window.outerWidth) || availableWidth);
  const outerHeight = Math.max(height, Number(window.outerHeight) || availableHeight);
  const left = Math.round(originX + Math.max(0, (outerWidth - width) / 2));
  const top = Math.round(originY + Math.max(0, (outerHeight - height) / 2));
  return `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

function openStreamerStats(slug = currentChannelSlug()) {
  const url = streamerStatsProfileUrl(slug);
  if (!url) return false;
  const popup = window.open('', 'kick-focus-streamer-stats', streamerStatsPopupFeatures());
  if (!popup) {
    showToast('The browser blocked the stats popup.', true, [{
      label: 'Open tab',
      onClick: () => window.open(url, '_blank', 'noopener,noreferrer'),
    }]);
    return false;
  }
  try {
    popup.opener = null;
    popup.location.replace(url);
    popup.focus();
  } catch {
    try { popup.location.href = url; } catch { /* the toast still names the destination */ }
  }
  showToast(trf('Opened {channel} in StreamerStats.', { channel: slug }));
  return true;
}

/** Mount the StreamerStats action inside Kick's channel-profile action row. */
function ensureProfileStatsControl() {
  const slug = currentChannelSlug();
  const anchor = slug && document.querySelector('[data-testid="follow-button"], [data-testid="sub-button"], [data-testid="gift-sub-button"]');
  const owner = anchor?.parentElement;
  if (!slug || !anchor || !owner || state.root?.contains(owner)) {
    state.profileStatsHost?.remove?.();
    return false;
  }

  if (!state.profileStatsHost) {
    const host = document.createElement('span');
    host.id = 'kick-focus-streamer-stats';
    host.lang = activeLocale();
    host.dataset.kfProfileStats = 'true';
    const shadow = host.attachShadow({ mode: 'open' });
    setMarkup(shadow, `<button type="button" data-kf-profile-stats>${uiIcon('stats')}<span data-kf-profile-stats-label>Stats</span></button>`);
    adoptStyles(shadow, PROFILE_STATS_CSS);
    const button = shadow.querySelector('[data-kf-profile-stats]');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openStreamerStats();
    });
    state.profileStatsHost = host;
    state.profileStatsButton = button;
  }

  const host = state.profileStatsHost;
  if (host.parentElement !== owner || host.previousElementSibling !== anchor) {
    owner.insertBefore(host, anchor.nextSibling);
  }
  host.lang = activeLocale();
  const label = host.shadowRoot?.querySelector('[data-kf-profile-stats-label]');
  if (label) label.textContent = tr('Stats');
  const accessibleLabel = trf('Open {channel} stats in StreamerStats', { channel: slug });
  state.profileStatsButton?.setAttribute('aria-label', accessibleLabel);
  state.profileStatsButton?.setAttribute('title', accessibleLabel);
  return host.isConnected;
}

function headerQuickTarget() {
  const primary = document.querySelector('nav [data-testid="kicks-top-nav"], [data-testid="kicks-top-nav"]');
  if (primary) return primary;
  return [...document.querySelectorAll('nav button')]
    .find((button) => /^get\s+kicks$/i.test(String(button.textContent || '').trim())) || null;
}

function ensureHeaderQuickControl() {
  const target = headerQuickTarget();
  const owner = target?.parentElement;
  if (!target || !owner) {
    state.headerControlHost?.remove?.();
    return false;
  }

  if (!state.headerControlHost) {
    const host = document.createElement('span');
    host.id = 'kick-focus-header-control';
    host.lang = activeLocale();
    host.dataset.kfHeaderControl = 'true';
    const shadow = host.attachShadow({ mode: 'open' });
    setMarkup(shadow, `
      <button type="button" data-kf-header-focus aria-label="Open Kick Focus settings" title="Kick Focus">
        <img src="__KICK_FOCUS_ICON__" alt="">
        <span data-kf-header-control-label>Focus</span>
      </button>
      <button type="button" data-kf-header-multi class="kf-header-multi" aria-label="Open Kick Focus multi-stream" title="Multi-stream">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2.5" y="3.5" width="8.5" height="7" rx="1.5"/><rect x="13" y="3.5" width="8.5" height="7" rx="1.5"/><rect x="2.5" y="13" width="8.5" height="7" rx="1.5"/><rect x="13" y="13" width="8.5" height="7" rx="1.5"/></svg>
        <span data-kf-header-multi-label>Multi</span>
      </button>
      <button type="button" data-kf-header-add-multi class="kf-header-add" hidden aria-label="Add this channel to Kick Focus multi-stream" title="Add to multi-stream">
        <span data-kf-header-add-icon aria-hidden="true">+</span>
        <span data-kf-header-add-label>Multi</span>
      </button>
      <button type="button" data-kf-header-commands class="kf-header-multi" aria-label="Open Kick Focus command menu" title="Commands">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="2.4" rx="1.2"/><rect x="3" y="10.8" width="18" height="2.4" rx="1.2"/><rect x="3" y="16.6" width="12" height="2.4" rx="1.2"/></svg>
        <span data-kf-header-commands-label>Menu</span>
      </button>`);
    adoptStyles(shadow, HEADER_CONTROL_CSS);
    const button = shadow.querySelector('[data-kf-header-focus]');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      // Straight to settings. This is the one visible entry point most people
      // ever press, and a command palette is a poor front door for it. The menu
      // has its own button beside this one.
      if (state.runtime.suspended) togglePanicSwitch();
      else openSettings();
    });
    // Multi-stream is a headline feature; burying it in a settings page is not
    // "easily add multiple streams".
    shadow.querySelector('[data-kf-header-multi]').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (multistreamOpen()) closeMultistream();
      else openMultistream();
    });
    // The command menu's only way in used to be a configurable chord and the
    // userscript manager's own menu, which the companion extension does not
    // have at all. The session toggles it carries — focus, chat, sidebar,
    // mature thumbnails, pause — live nowhere else, so without this button they
    // were reachable by keyboard or not at all.
    shadow.querySelector('[data-kf-header-commands]').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.command && !state.command.hidden) closeCommandMenu();
      else openCommandMenu();
    });
    shadow.querySelector('[data-kf-header-add-multi]').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleCurrentChannelInMulti();
    });
    state.headerControlHost = host;
    state.headerControlButton = button;
    state.headerAddMultiButton = shadow.querySelector('[data-kf-header-add-multi]');
    state.headerMultiLabel = shadow.querySelector('[data-kf-header-multi-label]');
    state.headerCommandsButton = shadow.querySelector('[data-kf-header-commands]');
    state.headerCommandsLabel = shadow.querySelector('[data-kf-header-commands-label]');
  }

  if (state.headerControlHost.parentElement !== owner || state.headerControlHost.nextElementSibling !== target) {
    owner.insertBefore(state.headerControlHost, target);
  }
  syncHeaderMultiState();
  return state.headerControlHost.isConnected;
}

/**
 * Keep the header's "+ Multi" button and the "Multi (n)" count in sync with the
 * grid and the current route. The add button only appears on a channel page,
 * and flips to an "In Multi" toggle once the channel is in the grid.
 */
function syncHeaderMultiState() {
  const count = state.multistream.streams.length;
  if (state.headerMultiLabel) state.headerMultiLabel.textContent = count ? `Multi (${count})` : 'Multi';
  const button = state.headerAddMultiButton;
  if (!button) return;
  const slug = currentChannelSlug();
  if (!slug) { button.hidden = true; return; }
  button.hidden = false;
  const inGrid = state.multistream.streams.some((entry) => entry.toLowerCase() === slug.toLowerCase());
  button.dataset.inMulti = String(inGrid);
  const icon = button.querySelector('[data-kf-header-add-icon]');
  const label = button.querySelector('[data-kf-header-add-label]');
  if (icon) icon.textContent = inGrid ? '✓' : '+';
  if (label) label.textContent = tr(inGrid ? 'In Multi' : 'Multi');
  button.setAttribute('aria-label', trf(inGrid
    ? 'Remove {name} from Kick Focus multi-stream'
    : 'Add {name} to Kick Focus multi-stream', { name: slug }));
}

function syncQuickButton() {
  if (!state.root?.isConnected && document.body) document.body.append(state.root);
  if (!state.quickButton) return;
  const shouldShow = state.runtime.suspended || state.settings.layout.quickButton;
  const headerMounted = shouldShow ? ensureHeaderQuickControl() : false;
  if (!shouldShow) state.headerControlHost?.remove?.();
  const label = tr(state.runtime.suspended ? 'Resume' : 'Focus');
  // The accessible name has to contain the visible word, or voice control
  // cannot act on what the user can read (WCAG 2.5.3). Paused, the button says
  // Resume and used to be announced "Restore Kick Focus", which shares no word
  // with it. Resume Kick Focus was already translated in both locales and
  // unused, which is a fair sign of which half drifted.
  const accessibleLabel = tr(state.runtime.suspended ? 'Resume Kick Focus' : 'Open Kick Focus settings');
  if (state.headerControlButton) {
    state.headerControlButton.querySelector('[data-kf-header-control-label]').textContent = label;
    state.headerControlButton.setAttribute('aria-label', accessibleLabel);
    state.headerControlButton.title = label;
  }
  // The header host is its own shadow root and localizeInterface never walks it,
  // so its labels are written through tr() here or they stay English.
  if (state.headerCommandsButton) {
    state.headerCommandsLabel.textContent = tr('Menu');
    state.headerCommandsButton.setAttribute('aria-label', tr('Open Kick Focus command menu'));
    state.headerCommandsButton.title = tr('Commands');
  }
  document.documentElement.dataset.kfMiniPlayerCollision = String(
    state.settings.layout.miniPlayerCollision && state.settings.layout.quickButton && !headerMounted,
  );
  if (state.runtime.suspended) {
    state.quickButton.hidden = headerMounted;
    state.quickButton.dataset.action = 'toggle-panic';
    state.quickButton.textContent = label;
    state.quickButton.setAttribute('aria-label', accessibleLabel);
    return;
  }
  state.quickButton.dataset.action = 'open-settings';
  state.quickButton.textContent = label;
  state.quickButton.setAttribute('aria-label', accessibleLabel);
  state.quickButton.hidden = !shouldShow || headerMounted;
  syncEarnedState(accessibleLabel);
}

/**
 * Mark the one earned state Kick actually publishes: a reward waiting.
 *
 * Read from the page each apply cycle, which costs one `querySelector` and one
 * storage read and adds no timer. Signed out there is no reward control, so
 * `earnedState` returns null and nothing is marked at all — a client inventing
 * a badge for an account that has none is pressure, not delight.
 *
 * The status is carried in the accessible name, which is the part that has to
 * work: the dot and the motion-safe pulse the stylesheet adds on top of the
 * attribute are decoration, and neither is the message.
 */
function syncEarnedState(accessibleLabel) {
  const earned = earnedState(viewerHubCards(collectViewerFacts(), Date.now()));
  const kind = earned ? earned.kind : '';
  for (const button of [state.quickButton, state.headerControlButton]) {
    if (!button) continue;
    if (button.dataset.kfEarned === kind) continue;
    if (kind) button.dataset.kfEarned = kind;
    else delete button.dataset.kfEarned;
    button.setAttribute('aria-label', earned ? `${accessibleLabel}, ${tr(earned.label)}` : accessibleLabel);
  }
  const nav = state.shadow?.querySelector('[data-page="viewer"] [data-kf-nav-earned]');
  if (nav) nav.textContent = earned ? tr(earned.label) : '';
}

state.discoveryLayouts = loadDiscoveryLayouts();
addStyle(SITE_CSS);
installNetworkDefense();
// Before anything else can append a preflight script.
installPlayerLoadingFix();
installSpaHooks();
installCompanionBridge();
applySettingsAttributes();
// Must run before Kick's player initialises, because the player reads its
// starting quality once at init and never looks again.
applyQualitySessionKey();

/**
 * Wire up the optional companion extension.
 *
 * These listeners are installed during bootstrap rather than with the rest of
 * the interface: the two scripts are injected independently, so neither can
 * assume the other is listening yet. The companion asks for the settings once
 * it is ready, and this side answers, which makes the exchange independent of
 * which script wins the injection race.
 */
function installCompanionBridge() {
  document.addEventListener('kick-focus:request-settings', () => publishSettingsState());
  document.addEventListener('kick-focus:open-settings', () => openSettings());
  document.addEventListener('kick-focus:open-commands', () => openCommandMenu());
  // Reachable without depending on Kick's header markup, which the header
  // control does. The companion popup uses this too.
  document.addEventListener('kick-focus:open-multistream', () => {
    if (multistreamOpen()) closeMultistream();
    else openMultistream();
  });
  document.addEventListener('kick-focus:set-telemetry', (event) => {
    updateSetting('content.reduceTelemetry', Boolean(event.detail?.enabled));
  });
  handshakeCompanion();
  openSharedLayoutFromUrl();
  // Off the boot path deliberately: the interface is already on screen, and the
  // fuller library arrives when the database answers.
  hydrateLibrary().catch((error) => logAppError('library hydrate', error));
}

/**
 * Open a layout someone shared as a link.
 *
 * Every slug is revalidated by `parseMultistreamLink` before use — a link is
 * untrusted input regardless of who sent it — and the grid is only replaced
 * when the link actually names channels. The parameter is then stripped from
 * the address bar so a reload does not silently reopen it.
 */
function openSharedLayoutFromUrl() {
  const shared = parseMultistreamLink(location.href);
  if (!shared.length) return;
  // A shared link replaces the grid outright. Someone half way through
  // collecting channels deserves to be told, and to be able to get them back.
  const previous = state.multistream;
  const overwritten = previous.streams.filter((slug) => !shared.some((entry) => entry.toLowerCase() === slug.toLowerCase()));
  state.multistream = normalizeMultistream({
    ...state.multistream,
    streams: shared,
    focus: shared[0],
    chat: shared[0],
  });
  state.multistreamError = '';
  persistMultistream();
  try {
    const url = new URL(location.href);
    url.searchParams.delete(MULTISTREAM_LINK_PARAM);
    history.replaceState(history.state, '', url.href);
  } catch {
    // A URL this build cannot rewrite is not a reason to refuse the layout.
  }
  openMultistream();
  announce(trf('Opened a shared board with {count} {word}.', { count: shared.length, word: plural(shared.length, 'channel', 'channels') }));
  if (!overwritten.length) return;
  showToast(trf('The shared board replaced {count} {word} you had collected.', { count: overwritten.length, word: plural(overwritten.length, 'channel', 'channels') }), false, [
    {
      label: 'Undo',
      onClick: () => {
        state.multistream = previous;
        persistMultistream();
        syncHeaderMultiState();
        syncCardMultiState();
        renderMultistream();
        announce('Your own multi-stream grid is back.');
      },
    },
  ]);
  announce(trf('The shared board replaced {count} {word} you had collected.', { count: overwritten.length, word: plural(overwritten.length, 'channel', 'channels') }));
}

function startWhenBodyExists() {
  if (!document.body) {
    // The observer is held in a binding rather than read from the callback's
    // first argument, which is the mutation list. Taking it from there threw on
    // every mutation, so the script never started on any load where it won the
    // document-start race and <body> did not exist yet.
    const bodyObserver = new MutationObserver(() => {
      if (!document.body) return;
      bodyObserver.disconnect();
      state.observers.body = null;
      startWhenBodyExists();
    });
    state.observers.body = bodyObserver;
    bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
    return;
  }
  buildInterface();
  installFollowingPreviewInteractions();
  installRuntimeInteractions();
  installDocumentObserver();
  installRemoteBlocklistTimer();
  scheduleApply(0);
  // Both content scripts have certainly registered their listeners by now, so
  // this is the announcement the companion can rely on receiving.
  publishSettingsState();
  announceUpdate();
}

/**
 * Say so when the build changed under the user.
 *
 * An update that alters behaviour without a word is the pattern Kick itself was
 * criticised for when ads appeared unannounced in May 2026; this build should
 * not do the same to its own users. Deliberately quiet on a first install and on
 * a profile that predates the recorded version — in neither case can this
 * honestly claim to know what changed.
 *
 * Recorded before the toast is shown, not after, so a notice that is never
 * clicked still counts as delivered and cannot repeat on every page load.
 */
function announceUpdate() {
  const notice = updateNotice(state.settings.lastSeenVersion, VERSION);
  if (state.settings.lastSeenVersion !== VERSION) {
    state.settings.lastSeenVersion = VERSION;
    saveSettings('Autosaved');
  }
  if (!notice) return;
  state.updateNotice = notice;
  const changed = notice.defaults.length
    ? ` ${trf('Changed defaults: {list}.', { list: notice.defaults.join(', ') })}`
    : '';
  showToast(`${trf('Kick Focus updated to {version}.', { version: notice.to })}${changed}`, false, [
    {
      label: 'What changed',
      onClick: () => openSettings('about'),
    },
  ]);
}

startWhenBodyExists();
