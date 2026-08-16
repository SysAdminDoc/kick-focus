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
const PAGE_BLOCK_EVENT = 'kick-focus:request-blocked';

// Declared ahead of `state` because writes can happen while `state` is still in
// its own initializer, and reading a const in its temporal dead zone throws.
const storageHealth = { failures: {}, lastError: '' };
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
  modal: null,
  command: null,
  commandInput: null,
  commandList: null,
  quickButton: null,
  headerControlHost: null,
  headerControlButton: null,
  lastFocused: null,
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
    suspended: false,
    stickerGridScrollTop: null,
    stickerLibraryQuery: '',
    stickerLibraryFilter: 'all',
    stickerPickerTarget: null,
    stickerChatTarget: null,
    stickerCatalogDirty: true,
  },
  diagnostics: {
    blocked: 0,
    shells: 0,
    lastMatch: 'None yet',
    entries: [],
    errors: [],
    lastCrash: readLastCrash(),
  },
  shortcutCapture: null,
  shortcutError: '',
  resetPending: false,
  companion: { active: false, version: '' },
  watched: new Set(readSessionArray(WATCHED_KEY)),
  favorites: new Set(readPersistentArray(FAVORITES_KEY)),
  dismissed: new Set(readPersistentArray(DISMISSED_KEY)),
  mediaPreferences: readPersistentRecord(MEDIA_PREFERENCES_KEY),
  chatKeywords: readPersistentRecord(CHAT_KEYWORDS_KEY),
  channelNotes: readPersistentRecord(CHANNEL_NOTES_KEY),
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
  status.textContent = message;
  status.dataset.error = String(isError);
}

function addStyle(cssText) {
  state.siteStyle?.remove?.();
  const style = document.createElement('style');
  style.id = 'kick-focus-site-style';
  style.dataset.kickFocus = 'true';
  style.textContent = cssText;
  (document.head || document.documentElement).append(style);
  state.siteStyle = style;
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
        if (!isPlaybackUrl(rawUrl)) return nativeFetch(input, init);

        // Playback is first-party and must be delivered, but the ad flags it
        // carries are rewritten on the way through.
        return nativeFetch(input, init).then((response) => {
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
        return nativeOpen.call(this, method, url, ...rest);
      }, nativeOpen, 'open');
      xhrPrototype.send = disguise(function kickFocusSend(...args) {
        if (this.__kfPlayback && nativeText?.get) installPlaybackRewrite(this, nativeText, nativeResponse, report);
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

const SITE_CSS = `
  :root {
    --kf-accent: #7cff2b;
    --kf-accent-rgb: 124, 255, 43;
    --kf-canvas: #080b09;
    --kf-panel: #0d120f;
    --kf-panel-raised: #121814;
    --kf-panel-high: #171e19;
    --kf-border: #29312b;
    --kf-border-strong: #3a453d;
    --kf-text: #f4f7f5;
    --kf-text-muted: #9ba59f;
    --kf-radius: 10px;
    --kf-chat-width: 410px;
    --kf-thumb-saturation: 1.03;
    --kf-caption-opacity: .72;
    --kf-text-scale: 1;
  }

  html[data-kf-accent="cyan"] { --kf-accent: #38d7d0; --kf-accent-rgb: 56, 215, 208; }
  html[data-kf-accent="violet"] { --kf-accent: #9667ff; --kf-accent-rgb: 150, 103, 255; }
  html[data-kf-accent="gold"] { --kf-accent: #ffbe2e; --kf-accent-rgb: 255, 190, 46; }
  html[data-kf-radius="subtle"] { --kf-radius: 7px; }
  html[data-kf-radius="rounded"] { --kf-radius: 18px; }
  html[data-kf-theme="oled"] { --kf-panel: #050606; --kf-panel-raised: #0a0c0d; --kf-border: #24282b; }
  html[data-kf-theme="slate"] { --kf-panel: #141817; --kf-panel-raised: #1b211f; --kf-border: #3a454f; }

  body {
    background: var(--kf-canvas) !important;
    color: var(--kf-text) !important;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
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
      background: rgba(8, 11, 9, .98) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, .22) !important;
    }

    nav form > div > div,
    nav [data-testid="search"]:is(input) {
      border-color: var(--kf-border-strong) !important;
      background: #0b0f0c !important;
    }

    nav form > div > div {
      min-height: 38px !important;
      border-radius: 9px !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.025) !important;
    }

    nav form > div > div:focus-within {
      border-color: rgba(var(--kf-accent-rgb), .72) !important;
      box-shadow: 0 0 0 3px rgba(var(--kf-accent-rgb), .12) !important;
    }

    main,
    #main-container { background: var(--kf-canvas) !important; }

    main > div:first-child:not(#channel-content) {
      width: min(100%, 1536px) !important;
      margin-inline: auto !important;
    }

    main h1,
    main h2,
    main h3 {
      color: var(--kf-text) !important;
      letter-spacing: -.018em !important;
    }

    main h2 { font-weight: 760 !important; }

    #sidebar-wrapper {
      border-right: 1px solid var(--kf-border) !important;
      background: #0a0f0c !important;
      box-shadow: 12px 0 32px rgba(0,0,0,.12) !important;
    }

    #sidebar-wrapper > ul {
      gap: 3px !important;
      padding: 8px 10px 10px !important;
    }

    #sidebar-wrapper a[data-testid^="sidebar-"] {
      min-height: 44px !important;
      border: 1px solid transparent !important;
      border-radius: 9px !important;
      color: #dce2de !important;
    }

    #sidebar-wrapper a[data-testid^="sidebar-"][data-state="active"] {
      border-color: rgba(var(--kf-accent-rgb), .18) !important;
      background: rgba(var(--kf-accent-rgb), .075) !important;
      color: var(--kf-accent) !important;
      box-shadow: inset 2px 0 0 rgba(var(--kf-accent-rgb), .78) !important;
    }

    #sidebar-wrapper a[data-testid^="sidebar-"]:hover {
      border-color: var(--kf-border) !important;
      background: rgba(255,255,255,.045) !important;
    }

    #sidebar-wrapper :is(button, a):focus-visible,
    main :is(button, a, input, select, textarea):focus-visible {
      outline: 2px solid var(--kf-accent) !important;
      outline-offset: 2px !important;
    }

    main [data-testid="livestream-results-card"] {
      gap: 0 !important;
      padding: 0 0 6px !important;
      border: 1px solid transparent !important;
      border-radius: var(--kf-radius) !important;
      background: linear-gradient(180deg, rgba(18,24,20,.82), rgba(10,14,11,.58)) !important;
      overflow: visible !important;
    }

    main [data-testid="livestream-results-card"]:hover,
    main [data-testid="livestream-results-card"]:focus-within {
      border-color: rgba(var(--kf-accent-rgb), .48) !important;
      background: var(--kf-panel-raised) !important;
      box-shadow: 0 12px 28px rgba(0,0,0,.24) !important;
    }

    main [data-testid="media-card-thumbnail"] {
      border: 1px solid var(--kf-border) !important;
      border-radius: var(--kf-radius) !important;
      background: #050806 !important;
      overflow: hidden !important;
    }

    main [data-testid="media-card-thumbnail"] > :is(div, img) {
      border-radius: inherit !important;
    }

    main [data-testid="media-card-thumbnail"] [class*="top-1.5"],
    main [data-testid="media-card-thumbnail"] [class*="bottom-1.5"] {
      border: 1px solid rgba(255,255,255,.12) !important;
      border-radius: 5px !important;
      background: rgba(4,7,5,.9) !important;
      box-shadow: 0 2px 8px rgba(0,0,0,.32) !important;
    }

    main section[class*="grid"] {
      column-gap: 16px !important;
      row-gap: 20px !important;
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

    main :is([role="combobox"], select),
    main button:not([data-kf-card-action]):not([data-kf-sticker-action]) {
      border-radius: 8px !important;
    }

    html[data-kf-route="category"] main > div:first-child,
    html[data-kf-route="categories"] main > div:first-child,
    html[data-kf-route="browse"] main > div:first-child,
    html[data-kf-route="following"] main > div:first-child,
    html[data-kf-route="drops"] main > div:first-child,
    html[data-kf-route="search"] main > div:first-child {
      padding-top: 22px !important;
    }

    html[data-kf-route="channel"] #channel-content {
      gap: 18px !important;
      padding: 18px 24px 28px !important;
      background: var(--kf-canvas) !important;
    }

    html[data-kf-route="channel"] #injected-channel-player {
      border: 1px solid var(--kf-border) !important;
      border-radius: 11px !important;
      box-shadow: 0 18px 44px rgba(0,0,0,.34) !important;
      overflow: hidden !important;
    }

    html[data-kf-route="channel"] #channel-content > :is(div, section, article) {
      border-color: var(--kf-border) !important;
    }

    [data-kf-chat-panel],
    #channel-chatroom {
      border-left: 1px solid var(--kf-border) !important;
      background: #0a0f0c !important;
      box-shadow: -12px 0 32px rgba(0,0,0,.14) !important;
    }

    #channel-chatroom > div > div:first-child {
      border-bottom-color: var(--kf-border) !important;
      background: #0c110e !important;
    }

    #channel-chatroom [data-testid="pinned-message-modal"] > div {
      border-width: 1px !important;
      border-color: var(--kf-border-strong) !important;
      border-radius: 8px !important;
      background: var(--kf-panel-raised) !important;
    }

    #channel-chatroom :is(textarea, input, [contenteditable="true"]) {
      border-radius: 8px !important;
      border-color: var(--kf-border-strong) !important;
      background: #090d0a !important;
    }

    [data-kf-chat-panel], #channel-chatroom { border-left-color: var(--kf-border) !important; background: var(--kf-panel) !important; }

    html[data-kf-sidebar="hidden"] #sidebar-wrapper,
    html[data-kf-focus="true"] #sidebar-wrapper,
    html[data-kf-theater="true"] #sidebar-wrapper { display: none !important; }

    html[data-kf-chat="hidden"] [data-kf-chat-panel],
    html[data-kf-chat="hidden"] [data-kf-chat-separator],
    html[data-kf-focus="true"] [data-kf-chat-panel],
    html[data-kf-focus="true"] [data-kf-chat-separator] { display: none !important; }

    html[data-kf-chat="right"] [data-kf-chat-panel] {
      flex: 0 0 var(--kf-chat-width) !important;
      width: var(--kf-chat-width) !important;
      min-width: 320px !important;
      max-width: 520px !important;
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

    html[data-kf-density="compact"] :is(main, #main-container) section[class*="grid"],
    html[data-kf-density="compact"] :is(main, #main-container) [class*="group/grid"] { gap: 12px !important; }

    html[data-kf-sticky="true"] nav {
      min-height: 56px !important;
      backdrop-filter: none !important;
      background: #0b0e0c !important;
      border-bottom: 1px solid var(--kf-border) !important;
    }

    :is(main, #main-container) { font-size: calc(1rem * var(--kf-text-scale)); }

    :is(main, #main-container) [class*="group/card"] {
      border-radius: var(--kf-radius) !important;
      outline: 1px solid transparent;
      outline-offset: 3px;
      transition: filter 150ms ease, outline-color 150ms ease !important;
    }

    :is(main, #main-container) [class*="group/card"]:hover,
    :is(main, #main-container) [class*="group/card"]:focus-within {
      outline-color: rgba(var(--kf-accent-rgb), .46);
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
      box-shadow: inset 0 2px 0 rgba(var(--kf-accent-rgb), .72);
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
      background: #0d100e !important;
      color: #f7f9fa !important;
      cursor: pointer !important;
      font-size: 11px !important;
      font-weight: 760 !important;
    }

    [data-kf-card-actions] button:hover,
    [data-kf-card-actions] button[data-active="true"] { border-color: var(--kf-accent) !important; color: var(--kf-accent) !important; }

    [data-kf-highlighted="true"] { box-shadow: inset 3px 0 0 var(--kf-accent) !important; background: rgba(var(--kf-accent-rgb), .07) !important; }

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
      background: #0d100e !important;
      color: #f7f9fa !important;
      cursor: pointer !important;
      font-size: 11px !important;
      font-weight: 760 !important;
    }

    [data-kf-chat-status], [data-kf-playback-diagnostics] {
      position: absolute !important;
      z-index: 7 !important;
      border: 1px solid rgba(255,255,255,.18) !important;
      border-radius: 4px !important;
      background: #0d100e !important;
      color: #f7f9fa !important;
      font: 11px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace !important;
    }

    [data-kf-chat-status] { top: 44px !important; right: 8px !important; padding: 5px 8px !important; }
    [data-kf-playback-diagnostics] { right: 12px !important; bottom: 12px !important; padding: 6px 8px !important; pointer-events: none !important; }

    [data-kf-search-meta] {
      box-sizing: border-box !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 18px !important;
      margin: 0 0 14px !important;
      padding: 15px 16px !important;
      border: 1px solid var(--kf-border) !important;
      border-radius: var(--kf-radius) !important;
      background: var(--kf-panel) !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    [data-kf-search-meta] > div { display: flex !important; align-items: baseline !important; flex-wrap: wrap !important; gap: 9px !important; }
    [data-kf-search-meta] strong { color: var(--kf-text) !important; font-size: 20px !important; line-height: 1.25 !important; }
    [data-kf-search-meta] span { color: var(--kf-text-muted) !important; font-size: 12px !important; font-weight: 650 !important; }
    [data-kf-search-meta] button { min-height: 34px !important; padding: 0 11px !important; border: 1px solid var(--kf-border-strong) !important; border-radius: 7px !important; background: var(--kf-panel-raised) !important; color: var(--kf-accent) !important; cursor: pointer !important; font-weight: 720 !important; }

    [data-kf-native-drops-empty="true"] > [data-testid="empty-state-root"] { display: none !important; }
    [data-kf-drops-empty] {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 260px !important;
      gap: 16px !important;
      width: 100% !important;
      margin-top: 8px !important;
    }
    [data-kf-drops-primary], [data-kf-drops-activity], [data-kf-drops-steps] {
      border: 1px solid var(--kf-border) !important;
      border-radius: var(--kf-radius) !important;
      background: linear-gradient(180deg, var(--kf-panel-raised), var(--kf-panel)) !important;
      box-shadow: 0 16px 36px rgba(0,0,0,.18) !important;
    }
    [data-kf-drops-primary] { display: flex !important; min-height: 272px !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; padding: 34px !important; text-align: center !important; }
    [data-kf-drops-eyebrow] { margin-bottom: 10px !important; color: var(--kf-accent) !important; font-size: 11px !important; font-weight: 800 !important; letter-spacing: .08em !important; text-transform: uppercase !important; }
    [data-kf-drops-primary] h3 { margin: 0 !important; color: var(--kf-text) !important; font-size: 24px !important; }
    [data-kf-drops-primary] p { max-width: 520px !important; margin: 8px 0 20px !important; color: var(--kf-text-muted) !important; font-size: 14px !important; line-height: 1.55 !important; }
    [data-kf-drops-actions] { display: flex !important; flex-wrap: wrap !important; justify-content: center !important; gap: 10px !important; }
    [data-kf-drops-actions] a { display: inline-flex !important; min-height: 42px !important; align-items: center !important; justify-content: center !important; padding: 0 15px !important; border: 1px solid var(--kf-border-strong) !important; border-radius: 8px !important; color: var(--kf-text) !important; font-size: 13px !important; font-weight: 760 !important; text-decoration: none !important; }
    [data-kf-drops-actions] a:first-child { border-color: var(--kf-accent) !important; background: var(--kf-accent) !important; color: #071005 !important; }
    [data-kf-drops-activity] { grid-column: 2 !important; grid-row: 1 / span 2 !important; padding: 20px !important; }
    [data-kf-drops-activity] > strong { display: block !important; margin-bottom: 16px !important; font-size: 16px !important; }
    [data-kf-drops-activity] dl { display: grid !important; gap: 0 !important; margin: 0 !important; }
    [data-kf-drops-activity] dl > div { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; min-height: 56px !important; border-bottom: 1px solid var(--kf-border) !important; }
    [data-kf-drops-activity] dt { color: var(--kf-text-muted) !important; font-size: 12px !important; }
    [data-kf-drops-activity] dd { margin: 0 !important; color: var(--kf-text) !important; font-weight: 800 !important; }
    [data-kf-drops-activity] a { color: var(--kf-accent) !important; text-decoration: none !important; }
    [data-kf-drops-steps] { display: grid !important; grid-template-columns: repeat(3, minmax(0,1fr)) !important; gap: 0 !important; margin: 0 !important; padding: 14px 10px !important; list-style: none !important; }
    [data-kf-drops-steps] li { display: flex !important; align-items: center !important; gap: 10px !important; min-height: 70px !important; padding: 8px 16px !important; border-right: 1px solid var(--kf-border) !important; }
    [data-kf-drops-steps] li:last-child { border-right: 0 !important; }
    [data-kf-drops-steps] li > span { display: grid !important; width: 25px !important; height: 25px !important; flex: 0 0 25px !important; place-items: center !important; border-radius: 50% !important; background: var(--kf-accent) !important; color: #071005 !important; font-size: 12px !important; font-weight: 900 !important; }
    [data-kf-drops-steps] strong, [data-kf-drops-steps] small { display: block !important; }
    [data-kf-drops-steps] strong { color: var(--kf-text) !important; font-size: 12px !important; }
    [data-kf-drops-steps] small { margin-top: 3px !important; color: var(--kf-text-muted) !important; font-size: 10px !important; line-height: 1.35 !important; }

    [data-kf-sticker-organizer] {
      margin: 6px 8px 12px !important;
      padding: 10px !important;
      border: 1px solid var(--kf-border) !important;
      border-radius: 9px !important;
      background: #0b100d !important;
      color: #f7f9fa !important;
    }

    #chat-emotes-picker-panel > div[style]:not([style*="max-height: 0"]) {
      max-height: min(720px, 76vh) !important;
      border-top: 1px solid var(--kf-border) !important;
      border-radius: 10px 10px 0 0 !important;
      background: var(--kf-panel) !important;
      box-shadow: 0 -18px 48px rgba(0,0,0,.42) !important;
    }

    #chat-emotes-picker-panel #search-emotes-input { min-height: 40px !important; border-color: var(--kf-border-strong) !important; border-radius: 8px !important; background: #080c09 !important; }

    [data-kf-sticker-topline] { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 10px !important; margin-bottom: 8px !important; }
    [data-kf-sticker-topline] > div { display: flex !important; align-items: baseline !important; flex-wrap: wrap !important; gap: 6px !important; }
    [data-kf-sticker-topline] strong { color: var(--kf-text) !important; font-size: 13px !important; }
    [data-kf-sticker-topline] button { min-height: 28px !important; padding: 0 8px !important; border: 1px solid var(--kf-border-strong) !important; border-radius: 6px !important; background: var(--kf-panel-raised) !important; color: var(--kf-accent) !important; cursor: pointer !important; font-size: 10px !important; font-weight: 760 !important; }

    [data-kf-sticker-toolbar] {
      display: flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 6px !important;
      padding-bottom: 8px !important;
      border-bottom: 1px solid var(--kf-border) !important;
      font-size: 11px !important;
    }

    [data-kf-sticker-count], [data-kf-sticker-note], [data-kf-sticker-locked] { color: rgba(247,249,250,.62) !important; }
    [data-kf-sticker-toolbar] button {
      min-height: 30px !important;
      padding: 0 9px !important;
      border: 1px solid rgba(255,255,255,.18) !important;
      border-radius: 7px !important;
      background: rgba(255,255,255,.05) !important;
      color: inherit !important;
      cursor: pointer !important;
      font: inherit !important;
    }
    [data-kf-sticker-toolbar] button:hover,
    [data-kf-sticker-toolbar] button[data-active="true"] { border-color: rgba(var(--kf-accent-rgb), .62) !important; background: rgba(var(--kf-accent-rgb), .12) !important; color: var(--kf-accent) !important; }
    [data-kf-sticker-groups] { display: flex !important; align-items: center !important; flex-wrap: wrap !important; gap: 5px !important; padding-top: 8px !important; }
    [data-kf-sticker-groups] > span { margin-right: 2px !important; color: var(--kf-text-muted) !important; font-size: 10px !important; font-weight: 760 !important; text-transform: uppercase !important; }
    [data-kf-sticker-groups] button { min-height: 25px !important; padding: 0 7px !important; border: 1px solid var(--kf-border) !important; border-radius: 999px !important; background: rgba(255,255,255,.045) !important; color: #d8dfda !important; cursor: pointer !important; font-size: 9px !important; }
    [data-kf-sticker-groups] button[data-active="true"] { border-color: var(--kf-accent) !important; color: var(--kf-accent) !important; }
    [data-kf-sticker-note] { margin: 5px 0 7px !important; font-size: 10px !important; }
    [data-kf-sticker-quick-shelf] {
      margin: 0 0 9px !important;
      padding: 7px !important;
      border: 1px solid rgba(var(--kf-accent-rgb), .32) !important;
      border-radius: 5px !important;
      background: linear-gradient(180deg, rgba(var(--kf-accent-rgb), .09), rgba(255,255,255,.025)) !important;
    }
    [data-kf-sticker-quick-header] { display: flex !important; align-items: center !important; gap: 7px !important; margin-bottom: 6px !important; }
    [data-kf-sticker-quick-header] strong { color: #f7f9fa !important; font-size: 11px !important; }
    [data-kf-sticker-quick-count] { color: rgba(247,249,250,.58) !important; font-size: 9px !important; }
    [data-kf-sticker-quick-header] button {
      margin-left: auto !important;
      min-height: 23px !important;
      padding: 0 7px !important;
      border: 1px solid rgba(255,255,255,.18) !important;
      border-radius: 4px !important;
      background: rgba(255,255,255,.05) !important;
      color: rgba(247,249,250,.78) !important;
      cursor: pointer !important;
      font-size: 9px !important;
      font-weight: 720 !important;
    }
    [data-kf-sticker-quick-header] button:hover,
    [data-kf-sticker-quick-header] button:focus-visible { border-color: var(--kf-accent) !important; color: var(--kf-accent) !important; }
    [data-kf-sticker-quick-grid] {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)) !important;
      grid-auto-rows: 48px !important;
      gap: 6px !important;
      max-height: 156px !important;
      overflow-y: auto !important;
      scrollbar-gutter: stable !important;
    }
    [data-kf-sticker-quick-item] { min-width: 0 !important; }
    [data-kf-sticker-quick-item] { position: relative !important; }
    [data-kf-sticker-quick-item] button {
      display: grid !important;
      place-items: center !important;
      width: 100% !important;
      height: 48px !important;
      padding: 5px !important;
      border: 1px solid rgba(255,255,255,.13) !important;
      border-radius: 4px !important;
      background: rgba(5,8,6,.76) !important;
      cursor: pointer !important;
    }
    [data-kf-sticker-quick-item] button:hover,
    [data-kf-sticker-quick-item] button:focus-visible { border-color: var(--kf-accent) !important; background: rgba(var(--kf-accent-rgb), .14) !important; }
    [data-kf-sticker-quick-item] img { width: 100% !important; height: 100% !important; object-fit: contain !important; }
    [data-kf-sticker-quick-tools] { position: absolute !important; top: 2px !important; right: 2px !important; z-index: 2 !important; opacity: 0 !important; transition: opacity 100ms ease !important; }
    [data-kf-sticker-quick-item]:hover [data-kf-sticker-quick-tools], [data-kf-sticker-quick-item]:focus-within [data-kf-sticker-quick-tools] { opacity: 1 !important; }
    [data-kf-sticker-quick-tools] button { display: grid !important; width: 20px !important; height: 20px !important; min-height: 20px !important; padding: 0 !important; place-items: center !important; border: 1px solid rgba(255,255,255,.24) !important; border-radius: 5px !important; background: #080c09 !important; color: #f7f9fa !important; cursor: pointer !important; font-size: 12px !important; }
    [data-kf-sticker-quick-tools] button:hover { border-color: var(--kf-accent) !important; color: var(--kf-accent) !important; }
    [data-kf-sticker-quick-empty] { color: rgba(247,249,250,.6) !important; font-size: 10px !important; line-height: 1.35 !important; }
    [data-kf-sticker-grid] {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)) !important;
      gap: 7px !important;
      max-height: min(360px, 42vh) !important;
      overflow: auto !important;
      scrollbar-gutter: stable !important;
      padding: 3px 2px 6px !important;
    }
    [data-kf-sticker-item] { min-width: 0 !important; text-align: center !important; }
    [data-kf-sticker-proxy] {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      aspect-ratio: 1 !important;
      padding: 6px !important;
      border: 1px solid rgba(255,255,255,.12) !important;
      border-radius: 4px !important;
      background: rgba(255,255,255,.045) !important;
      cursor: pointer !important;
    }
    [data-kf-sticker-proxy]:hover, [data-kf-sticker-proxy]:focus-visible { border-color: var(--kf-accent) !important; background: rgba(var(--kf-accent-rgb), .12) !important; }
    [data-kf-sticker-proxy] img { width: 100% !important; height: 100% !important; object-fit: contain !important; }
    [data-kf-sticker-tools] { display: flex !important; justify-content: center !important; gap: 2px !important; margin-top: 2px !important; }
    [data-kf-sticker-tools] button {
      min-width: 20px !important;
      min-height: 20px !important;
      padding: 0 3px !important;
      border: 0 !important;
      border-radius: 4px !important;
      background: transparent !important;
      color: rgba(247,249,250,.65) !important;
      cursor: pointer !important;
      font-size: 13px !important;
      line-height: 1 !important;
    }
    [data-kf-sticker-tools] button:hover, [data-kf-sticker-tools] button:focus-visible { background: rgba(255,255,255,.12) !important; color: var(--kf-accent) !important; }
    [data-kf-sticker-empty] { padding: 10px 2px 4px !important; color: rgba(247,249,250,.62) !important; font-size: 11px !important; }
    [data-kf-sticker-secondary-actions] { display: flex !important; justify-content: flex-end !important; margin: -3px 0 5px !important; }
    [data-kf-sticker-secondary-actions] button { min-height: 24px !important; padding: 0 6px !important; border: 0 !important; background: transparent !important; color: var(--kf-text-muted) !important; cursor: pointer !important; font-size: 9px !important; }
    [data-kf-sticker-secondary-actions] button:hover { color: var(--kf-accent) !important; }
    html[data-kf-sticker-view="all"] #chat-emotes-picker-panel button[data-kf-sticker-key][data-kf-sticker-native="true"],
    html[data-kf-sticker-view="pinned"] #chat-emotes-picker-panel button[data-kf-sticker-key][data-kf-sticker-native="true"],
    html[data-kf-sticker-view="group"] #chat-emotes-picker-panel button[data-kf-sticker-key][data-kf-sticker-native="true"] { display: none !important; }
    html[data-kf-sticker-view="all"] #chat-emotes-picker-panel [data-kf-sticker-native-group],
    html[data-kf-sticker-view="pinned"] #chat-emotes-picker-panel [data-kf-sticker-native-group],
    html[data-kf-sticker-view="group"] #chat-emotes-picker-panel [data-kf-sticker-native-group] { display: none !important; }
    html[data-kf-sticker-view="all"] #chat-emotes-picker-panel [data-kf-sticker-native-list],
    html[data-kf-sticker-view="pinned"] #chat-emotes-picker-panel [data-kf-sticker-native-list],
    html[data-kf-sticker-view="group"] #chat-emotes-picker-panel [data-kf-sticker-native-list] { display: none !important; }
    html[data-kf-sticker-view="all"] #chat-emotes-picker-panel [data-kf-sticker-native-shell],
    html[data-kf-sticker-view="pinned"] #chat-emotes-picker-panel [data-kf-sticker-native-shell],
    html[data-kf-sticker-view="group"] #chat-emotes-picker-panel [data-kf-sticker-native-shell] { display: none !important; }
    #chat-emotes-picker-panel button[data-kf-sticker-hidden="true"][data-kf-sticker-native="true"] { display: none !important; }
    html[data-kf-stickers-show-hidden="true"] #chat-emotes-picker-panel button[data-kf-sticker-hidden="true"][data-kf-sticker-native="true"] { display: flex !important; opacity: .42 !important; }

    html[data-kf-large-targets="true"] :is(button, a, input, select, textarea) { min-height: 40px; }

    html[data-kf-contrast="true"] :is(main, #main-container) :is(p, span, div) { text-shadow: 0 0 .01px currentColor; }

    html[data-kf-focus-visible="true"] :is(button, a, input, select, textarea):focus-visible {
      outline: 3px solid var(--kf-accent) !important;
      outline-offset: 3px !important;
    }

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

  html[data-kf-reduce-motion="true"] *,
  html[data-kf-reduce-motion="true"] *::before,
  html[data-kf-reduce-motion="true"] *::after {
    scroll-behavior: auto !important;
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }

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
  root.dataset.kfMiniPlayerCollision = String(layout.miniPlayerCollision
    && layout.quickButton
    && !state.headerControlHost?.isConnected);
  root.dataset.kfPlayerResize = String(layout.playerResizeRecovery);
  root.dataset.kfPlayerContain = String(layout.playerContainVideo);
  root.dataset.kfTheme = appearance.theme;
  root.dataset.kfAccent = appearance.accent;
  root.dataset.kfRadius = appearance.radius;
  root.dataset.kfDimWatched = String(appearance.dimWatched);
  root.dataset.kfLiveColor = String(appearance.colorizeLive);
  root.dataset.kfContrast = String(appearance.strongContrast || accessibility.highContrast);
  root.dataset.kfMatureBlur = String(content.blurMature && !state.runtime.matureVisible);
  root.dataset.kfReduceMotion = String(accessibility.reduceMotion);
  // An explicit accessibility request framed as seizure risk. The system-level
  // preference turns it on regardless of the switch.
  root.dataset.kfStaticEmotes = String(content.staticEmotes
    || (accessibility.reduceMotion && matchMedia('(prefers-reduced-motion: reduce)').matches));
  root.dataset.kfFocusVisible = String(accessibility.focusVisible);
  root.dataset.kfLargeTargets = String(accessibility.largeTargets);
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

function tagChatPanel() {
  const separator = findProbe(document, 'chatSeparator').element;
  if (!separator) return;
  separator.dataset.kfChatSeparator = 'true';
  let panel = separator.nextElementSibling;
  if (!panel || panel === separator) {
    panel = findProbe(document, 'chatPanel').element;
  }
  if (panel) {
    const owner = ownerFromChild(panel, '#channel-chatroom, [data-testid="chatroom"], [data-testid="chatroom-messages"]');
    owner.dataset.kfChatPanel = 'true';
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
  return stickerPreferencesFromValue(normalizeStickerPreferences(gmGet(STICKER_PREFERENCES_KEY, {})));
}

function persistStickerPreferences() {
  const value = stickerPreferencesValue();
  state.stickerPreferences = stickerPreferencesFromValue(value);
  gmSet(STICKER_PREFERENCES_KEY, value);
  return value;
}

// ---------------------------------------------------------------------------
// Kick live data
//
// Read-only, same-origin requests to endpoints Kick's own client already calls,
// inheriting the session the page already has. Nothing here writes to Kick,
// handles a credential, or runs when the matching setting is off, and every
// path falls back to the existing DOM scraping when it fails.
// ---------------------------------------------------------------------------

const LIVE_TIMEOUT_MS = 8000;
const LIVE_MAX_BYTES = 4_000_000;
const REALTIME_BACKOFF_MS = [2000, 5000, 15000, 45000];
// Long enough to outlast the autoplay-policy mute that fires right after attach.
const VOLUME_GRACE_MS = 1500;

function readEmoteUsage() {
  // Normalize on boot too: the global rollup used to be capped only on read
  // through here-nothing, so a stored oversized map was loaded back whole.
  return normalizeEmoteUsage(gmGet(EMOTE_USAGE_KEY, null));
}

/**
 * Same-origin JSON with a deadline and a size ceiling.
 *
 * `credentials: 'include'` is what makes the session-gated reads (collectibles,
 * the user's own inventory) work at all — those endpoints authenticate with
 * cookies, not bearer tokens, which is exactly why a page context is the only
 * client that can read them and why nothing here ever sees a token.
 */
async function kickFetchJson(url, { credentials = 'include' } = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  try {
    const response = await pageFetch(url, {
      credentials,
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return { ok: false, status: response.status };
    const text = await response.text();
    if (text.length > LIVE_MAX_BYTES) return { ok: false, status: 'oversized' };
    return { ok: true, status: response.status, body: JSON.parse(text) };
  } catch (error) {
    return { ok: false, status: error?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
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

function currentChannelSlug() {
  if (state.route !== 'channel') return '';
  const [slug] = location.pathname.replace(/^\//, '').split('/');
  return /^[A-Za-z0-9_-]{1,64}$/.test(slug || '') ? slug : '';
}

/**
 * Record an API shape mismatch so the About page can report accumulated drift
 * rather than silently falling back. Capped at 50 events per session.
 */
function recordApiDrift(endpoint, reason, detail = '') {
  if (state.live.apiDrift.length >= 50) return;
  state.live.apiDrift.push({ endpoint, reason, detail, at: Date.now() });
}

/**
 * Pull channel identity and the emote catalog for the current channel.
 *
 * The catalog is the point: the organizer otherwise scrapes a lazy-rendered
 * picker, which this project's own research names as its highest-drift surface,
 * while `/emotes/{slug}` returns the same data plus entitlement as structured
 * JSON without the picker ever being opened.
 */
async function refreshLiveChannel() {
  const slug = currentChannelSlug();
  if (!slug) {
    teardownRealtime();
    state.live.slug = '';
    state.live.channel = null;
    return;
  }
  if (state.live.slug === slug && state.live.channel) return;
  teardownRealtime();
  state.live.slug = slug;
  state.live.channel = null;
  state.live.catalog = null;
  state.live.catalogSource = 'dom';
  state.live.catalogError = '';
  state.live.collisions = [];
  state.live.rarity = null;
  state.live.inventory = null;

  if (!state.settings.content.liveEmoteCatalog && !state.settings.content.liveChatEvents) return;

  const channelResponse = await kickFetchJson(endpoints.channel(slug));
  if (state.live.slug !== slug) return; // navigated away mid-flight
  if (!channelResponse.ok) {
    state.live.catalogError = `Kick's channel API answered ${channelResponse.status}.`;
    refreshLiveDiagnostics();
    return;
  }
  state.live.channel = normalizeChannel(channelResponse.body);
  if (!state.live.channel) {
    state.live.catalogError = "Kick's channel payload no longer has the expected shape.";
    recordApiDrift('channel', 'shape-changed');
    refreshLiveDiagnostics();
    return;
  }

  if (state.settings.content.liveEmoteCatalog) await refreshEmoteCatalog(slug);
  if (state.settings.content.liveChatEvents) connectRealtime();
  refreshLiveDiagnostics();
}

async function refreshEmoteCatalog(slug) {
  const response = await kickFetchJson(endpoints.emoteSets(slug), { credentials: 'include' });
  if (state.live.slug !== slug) return;
  if (!response.ok) {
    state.live.catalogError = `Kick's emote API answered ${response.status}; using the picker instead.`;
    refreshLiveDiagnostics();
    return;
  }
  const catalog = normalizeEmoteSets(response.body);
  if (!catalog.ok) {
    // A changed shape must not produce an empty organizer that looks like an
    // account with no emotes. Keep scraping and say why.
    state.live.catalogError = `Kick's emote payload changed shape (${catalog.reason}); using the picker instead.`;
    recordApiDrift('emotes', 'shape-changed', catalog.reason);
    refreshLiveDiagnostics();
    return;
  }
  state.live.catalog = catalog;
  state.live.catalogSource = 'api';
  state.live.catalogError = '';
  state.live.collisions = state.settings.content.warnShadowedEmotes ? findShadowedNames(catalog.emotes) : [];

  // The catalog is the user's real entitlement, so it seeds the library without
  // the picker ever being opened.
  mergeStickerLibrary(catalog.emotes.map((emote) => ({
    key: `id:${emote.id}`,
    id: emote.id,
    name: emote.name,
    src: emote.url,
    nativeGroups: [emote.kind === 'channel' ? emote.setName : emote.setName],
    available: true,
  })));

  if (state.settings.content.showEmoteRarity) await refreshCollectibleRarity(slug);
  refreshLiveDiagnostics();
}

/**
 * Join collectible card art to emote identity.
 *
 * Anonymous sessions get 403 here, which is expected and not an error worth
 * reporting: the whole point is that this is the user's own inventory.
 */
async function refreshCollectibleRarity(slug) {
  if (!state.live.catalog?.emotes.some((emote) => emote.collectible)) return;
  const response = await kickFetchJson(endpoints.collectibles());
  if (state.live.slug !== slug || !response.ok) return;
  const cards = Array.isArray(response.body?.data) ? response.body.data
    : (Array.isArray(response.body) ? response.body : []);
  if (!cards.length) return;
  const join = joinCollectibleRarity(cards, state.live.catalog.emotes);
  state.live.rarity = join.usable ? join : null;
  // The user's own inventory is the only evidence for a duplicate rate, since
  // Kick publishes no odds and documents no duplicate protection.
  const inventory = summarizeCollectibleInventory(cards);
  state.live.inventory = inventory.ok ? inventory : null;
  refreshLiveDiagnostics();
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

function teardownRealtime() {
  clearTimeout(state.live.reconnectAt);
  state.live.reconnectAt = 0;
  const socket = state.live.socket;
  state.live.socket = null;
  state.live.socketState = 'offline';
  state.live.subscribed = [];
  state.live.provider = '';
  state.live.providerVerified = true;
  state.live.lastLiveAt = 0;
  try { socket?.close(); } catch { /* already gone */ }
}

/**
 * Ask Kick which realtime provider is in force, then connect to that.
 *
 * Kick returns connection credentials behind a `provider` discriminator and
 * tracks a degraded state, so it can switch providers server-side. Anything
 * hardcoding the Pusher app key keeps working right up until it silently does
 * not — so the key is never written in this source, and an unrecognised
 * provider degrades to the DOM path rather than guessing.
 */
async function connectRealtime() {
  const channel = state.live.channel;
  if (!channel?.chatroomId || state.live.socket) return;
  const clientId = crypto.randomUUID();
  const response = await kickFetchJson(endpoints.realtimeChat(channel.chatroomId, clientId));
  if (!response.ok || state.live.channel !== channel) return;

  const connection = normalizeRealtimeConnection(response.body);
  if (!connection.ok) {
    state.live.socketState = 'unsupported';
    state.live.catalogError = connection.reason === 'unsupported-provider'
      ? `Kick switched realtime provider to ${connection.offered.join(', ')}; chat features fall back to the page.`
      : 'Kick did not return usable realtime credentials; chat features fall back to the page.';
    recordApiDrift('realtime', connection.reason, connection.offered?.join(', '));
    refreshLiveDiagnostics();
    return;
  }

  state.live.provider = connection.provider;
  state.live.providerVerified = connection.verified;
  let socket;
  try {
    // The transport owns the URL; everything below is protocol, shared by all
    // of them, so a second provider is an entry in REALTIME_TRANSPORTS rather
    // than a second copy of this function.
    socket = new WebSocket(connection.transport.socketUrl(connection));
  } catch {
    state.live.socketState = 'offline';
    return;
  }
  state.live.socket = socket;
  state.live.socketState = 'connecting';
  state.live.unparsable = 0;

  socket.addEventListener('open', () => {
    state.live.socketState = 'open';
    state.live.lastFrameAt = Date.now();
    state.live.reconnectAttempts = 0;
    for (const name of realtimeChannels({ chatroomId: channel.chatroomId, channelId: channel.id })) {
      socket.send(realtimeSubscribeFrame(name));
      state.live.subscribed.push(name);
    }
    refreshLiveDiagnostics();
  });
  socket.addEventListener('message', onRealtimeFrame);
  socket.addEventListener('close', () => {
    if (state.live.socket !== socket) return;
    state.live.socket = null;
    state.live.socketState = 'offline';
    // An unverified transport that never delivered a frame is a migration this
    // build has not been proven against. Retrying it forever would keep chat
    // features broken silently; degrading to the DOM path says so instead.
    if (!state.live.providerVerified && !state.live.lastLiveAt) {
      state.live.socketState = 'unsupported';
      state.live.catalogError = `Kick's ${connection.transport.label} transport did not connect; chat features fall back to the page.`;
      recordApiDrift('realtime', 'unverified-transport-failed', connection.transport.id);
      refreshLiveDiagnostics();
      return;
    }
    scheduleRealtimeReconnect();
  });
  socket.addEventListener('error', () => { state.live.socketState = 'error'; });
}

function scheduleRealtimeReconnect() {
  if (!state.settings.content.liveChatEvents || !currentChannelSlug()) return;
  const delay = REALTIME_BACKOFF_MS[Math.min(state.live.reconnectAttempts, REALTIME_BACKOFF_MS.length - 1)];
  state.live.reconnectAttempts += 1;
  clearTimeout(state.live.reconnectAt);
  state.live.reconnectAt = window.setTimeout(connectRealtime, delay);
}

function onRealtimeFrame(event) {
  state.live.lastFrameAt = Date.now();
  const frame = parseRealtimeFrame(event.data);
  if (frame.kind === 'unparsable') {
    state.live.unparsable += 1;
    refreshLiveDiagnostics();
    return;
  }
  state.live.unparsable = 0;
  if (frame.kind === 'established') {
    state.live.socketState = 'live';
    // Proof this transport actually works, which is what lets an unverified
    // one reconnect normally instead of degrading on its first close.
    state.live.lastLiveAt = Date.now();
    refreshLiveDiagnostics();
    return;
  }
  if (frame.kind === 'chat-message') onRealtimeChatMessage(frame.payload);
  else if (frame.kind === 'deletion') onRealtimeDeletion(frame.payload);
}

function onRealtimeChatMessage(payload) {
  const settings = state.settings.content;
  const wantsHarvest = settings.liveChatEvents && settings.organizeChatStickers;
  if (!settings.countEmoteUsage && !settings.showChatBadges && !wantsHarvest) return;
  const message = normalizeChatMessage(payload);
  if (!message) return;
  if (settings.showChatBadges && message.badges.length) queueChatBadges(message);
  // Harvest every emote seen in chat — everyone's messages, not just the local
  // user's — into the library, each validated by an image load before it can
  // take a cap slot. This is the single biggest untapped collection channel.
  if (wantsHarvest && message.emotes.length) queueChatEmoteHarvest(message.emotes);
  if (!settings.countEmoteUsage || !message.emotes.length) return;
  // Only the local user's own sends are counted. Counting everyone's would
  // measure the channel, not the person, and the shelf exists to rank what
  // *this* user actually reaches for.
  if (!isLocalUser(message.sender)) return;
  const channel = state.live.slug;
  const at = Date.now();
  for (const emote of message.emotes) {
    state.emoteUsage = recordEmoteUse(state.emoteUsage, { channel, id: emote.id, name: emote.name, at });
  }
  queueUsagePersist();
}

/**
 * Harvest emotes seen in realtime chat frames into the library.
 *
 * A frame carries {id,name} for every emote in a message. These are frame-only
 * (no DOM node corroborates them and the id came off the wire), so an unknown
 * emote is committed only after a one-shot Image() load proves the CDN actually
 * serves it — a crafted [emote:999999:Fake] token fails that load and never
 * takes a cap slot. At most a few loads run at once, and a per-session negative
 * cache stops re-attempting an id that already failed. Emotes already in the
 * library skip validation and merge directly to refresh their last-seen date.
 */
const HARVEST_MAX_INFLIGHT = 4;
const HARVEST_NEGATIVE_CAP = 5000;
const chatEmoteHarvest = { buffer: new Map(), negative: new Set(), queue: [], inflight: 0, timer: 0 };

function queueChatEmoteHarvest(emotes) {
  for (const observation of observationsFromChatEmotes(emotes, emoteImageUrl)) {
    if (chatEmoteHarvest.negative.has(observation.key)) continue;
    chatEmoteHarvest.buffer.set(observation.key, observation);
  }
  if (chatEmoteHarvest.buffer.size && !chatEmoteHarvest.timer) {
    chatEmoteHarvest.timer = window.setTimeout(flushChatEmoteHarvest, 120);
  }
}

function flushChatEmoteHarvest() {
  chatEmoteHarvest.timer = 0;
  const known = [];
  for (const [key, observation] of chatEmoteHarvest.buffer) {
    if (state.stickerPreferences.library.has(key)) known.push(observation);
    else if (!chatEmoteHarvest.negative.has(key)) chatEmoteHarvest.queue.push(observation);
  }
  chatEmoteHarvest.buffer.clear();
  // Already-recorded emotes only need their last-seen refreshed — no image round-trip.
  if (known.length) mergeStickerLibrary(known);
  pumpChatEmoteHarvest();
}

function pumpChatEmoteHarvest() {
  while (chatEmoteHarvest.inflight < HARVEST_MAX_INFLIGHT && chatEmoteHarvest.queue.length) {
    const observation = chatEmoteHarvest.queue.shift();
    if (chatEmoteHarvest.negative.has(observation.key) || state.stickerPreferences.library.has(observation.key)) continue;
    chatEmoteHarvest.inflight += 1;
    const image = new Image();
    const settle = (ok) => {
      image.onload = null;
      image.onerror = null;
      chatEmoteHarvest.inflight -= 1;
      if (ok) mergeStickerLibrary([observation]);
      else if (chatEmoteHarvest.negative.size < HARVEST_NEGATIVE_CAP) chatEmoteHarvest.negative.add(observation.key);
      pumpChatEmoteHarvest();
    };
    image.onload = () => settle(image.naturalWidth > 0);
    image.onerror = () => settle(false);
    image.src = observation.src;
  }
}

/**
 * Kick's chat identity payload carries `badges_v2`, which includes the
 * collectible and global badges the legacy array omits entirely — so a client
 * reading only the rendered DOM shows a gap where other clients show a badge.
 *
 * A realtime frame routinely arrives before Kick has rendered the message, so
 * an unrenderable badge set is held briefly and retried on the apply cycle
 * rather than dropped. The map only holds messages still waiting for a node,
 * which is a handful even in a fast chat.
 */
const CHAT_BADGE_WAIT_MS = 30_000;

function queueChatBadges(message) {
  if (renderChatBadges(message)) return;
  state.live.pendingBadges.set(message.id, { message, at: Date.now() });
  if (state.live.pendingBadges.size > 200) {
    const oldest = state.live.pendingBadges.keys().next().value;
    state.live.pendingBadges.delete(oldest);
  }
}

function replayPendingBadges() {
  if (!state.settings.content.showChatBadges || !state.live.pendingBadges.size) return;
  const now = Date.now();
  for (const [id, entry] of state.live.pendingBadges) {
    if (renderChatBadges(entry.message) || now - entry.at > CHAT_BADGE_WAIT_MS) {
      state.live.pendingBadges.delete(id);
    }
  }
}

function chatMessageNode(id) {
  return document.querySelector(`[data-index="${CSS.escape(id)}"], [data-message-id="${CSS.escape(id)}"], [data-chat-entry="${CSS.escape(id)}"]`);
}

/**
 * Render the badges Kick's own markup left out. Returns whether the message
 * node was found, which is what decides between done and retry.
 *
 * Badges already drawn by Kick are skipped by image URL, so this adds to the
 * identity rather than duplicating it. Every value here came through
 * `normalizeChatMessage`, which bounds the strings and accepts an image only
 * as an https URL on a Kick host; nodes are still built with textContent
 * rather than markup.
 */
function renderChatBadges(message) {
  const node = chatMessageNode(message.id);
  if (!node) return false;
  if (node.dataset.kfBadgesDrawn === 'true') return true;
  node.dataset.kfBadgesDrawn = 'true';

  const drawn = new Set([...node.querySelectorAll('img')].map((image) => image.src));
  const missing = chatBadgesToRender(message.badges, drawn);
  if (!missing.length) return true;

  const strip = document.createElement('span');
  strip.className = 'kf-chat-badges';
  strip.dataset.kfChatBadges = 'true';
  for (const badge of missing) {
    if (!badge.image) {
      strip.append(chatBadgeText(badge.label));
      continue;
    }
    const image = document.createElement('img');
    image.className = 'kf-chat-badge';
    image.alt = badge.label;
    image.title = badge.label;
    image.loading = 'lazy';
    // A broken badge image must read as the badge, not as an empty box.
    image.addEventListener('error', () => image.replaceWith(chatBadgeText(badge.label)), { once: true });
    image.src = badge.image;
    strip.append(image);
  }
  node.prepend(strip);
  return true;
}

function chatBadgeText(label) {
  const text = document.createElement('span');
  text.className = 'kf-chat-badge-text';
  text.textContent = label;
  return text;
}

/**
 * The DOM only removes a deleted message, so *why* it went is invisible to every
 * scraping tool. `MessageDeletedEvent` carries it, and Kick's non-disableable AI
 * moderation is among the loudest documented complaints about the platform.
 */
function onRealtimeDeletion(payload) {
  if (!state.settings.content.showModerationReasons) return;
  const deletion = normalizeDeletion(payload);
  if (!deletion) return;
  state.live.deletions.set(deletion.id, deletion);
  // Bounded: this is a live annotation, not a log.
  if (state.live.deletions.size > 300) {
    const oldest = state.live.deletions.keys().next().value;
    state.live.deletions.delete(oldest);
  }
  annotateDeletedMessage(deletion);
}

function annotateDeletedMessage(deletion) {
  const node = document.querySelector(`[data-index="${CSS.escape(deletion.id)}"], [data-message-id="${CSS.escape(deletion.id)}"], [data-chat-entry="${CSS.escape(deletion.id)}"]`);
  if (!node || node.dataset.kfDeletionNoted === 'true') return;
  node.dataset.kfDeletionNoted = 'true';
  node.dataset.kfAiModerated = String(deletion.aiModerated);
  const note = document.createElement('div');
  note.className = 'kf-deletion-note';
  note.dataset.kfDeletionNote = 'true';
  note.textContent = deletion.reason;
  node.append(note);
}

/**
 * A deletion event can arrive before the message it refers to has rendered, and
 * chat virtualisation can remount a node after we annotated it. Re-applying on
 * the apply cycle is cheap and covers both.
 */
function replayPendingDeletions() {
  if (!state.settings.content.showModerationReasons || !state.live.deletions.size) return;
  for (const deletion of state.live.deletions.values()) annotateDeletedMessage(deletion);
}

function isLocalUser(sender) {
  const own = document.querySelector('[data-testid="chat-input"], [contenteditable="true"][role="textbox"]');
  if (!own) return false;
  const username = localUsername();
  if (!username) return false;
  return sender.username.toLowerCase() === username || sender.slug.toLowerCase() === username;
}

function localUsername() {
  const candidate = document.querySelector('[data-testid="user-menu"] [title], [data-testid="username"], header [data-testid="user-avatar"] img[alt]');
  const raw = candidate?.getAttribute('title') || candidate?.getAttribute('alt') || candidate?.textContent || '';
  return String(raw).trim().toLowerCase();
}

function queueUsagePersist() {
  clearTimeout(state.usagePersistTimer);
  state.usagePersistTimer = window.setTimeout(() => {
    gmSet(EMOTE_USAGE_KEY, state.emoteUsage);
  }, 1200);
}

function refreshLiveDiagnostics() {
  if (!state.shadow) return;
  if (state.currentPage === 'content') {
    const target = state.shadow.querySelector('[data-kf-live-status]');
    if (target) target.textContent = liveStatusSummary();
  }
  if (state.currentPage === 'about') {
    const drift = state.shadow.querySelector('[data-kf-api-drift]');
    if (drift) drift.textContent = assessApiDrift(state.live.apiDrift).summary;
  }
}

function liveStatusSummary() {
  const parts = [];
  parts.push(state.live.catalogSource === 'api'
    ? `Emote catalog from Kick's API (${state.live.catalog?.emotes.length || 0} emotes).`
    : 'Emote catalog from the picker.');
  const health = realtimeHealth({
    connected: state.live.socketState === 'live' || state.live.socketState === 'open',
    lastFrameAt: state.live.lastFrameAt,
    unparsable: state.live.unparsable,
    now: Date.now(),
  });
  const via = state.live.provider
    ? ` via ${realtimeTransport(state.live.provider)?.label || state.live.provider}${state.live.providerVerified ? '' : ' (unverified transport)'}`
    : '';
  parts.push(`Chat events: ${health.state}${via}${health.detail ? ` — ${health.detail}` : ''}`);
  if (state.live.rarity) parts.push(`Rarity resolved for ${state.live.rarity.matched.length} of ${state.live.rarity.total} collectibles.`);
  if (state.live.collisions.length) parts.push(`${state.live.collisions.length} emote name${state.live.collisions.length === 1 ? '' : 's'} shadowed.`);
  if (state.live.catalogError) parts.push(state.live.catalogError);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Multi-stream
//
// A grid of Kick's own embedded players and chat, so playback, subscriptions
// and entitlements all stay Kick's. Nothing here reimplements a player or
// works around an entitlement; it arranges surfaces Kick already publishes.
// ---------------------------------------------------------------------------

function persistMultistream() {
  gmSet(MULTISTREAM_KEY, state.multistream);
}

// Re-read, merge, write. The multi-stream store is shared across tabs, so a
// blind write drops channels another tab added since this tab booted. This
// applies this tab's add/remove on top of the latest stored value.
function commitMultistream(added = [], removed = []) {
  state.multistream = mergeMultistream(gmGet(MULTISTREAM_KEY, {}), state.multistream, added, removed);
  gmSet(MULTISTREAM_KEY, state.multistream);
  return state.multistream;
}

function openMultistream() {
  const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
  if (!backdrop) return;
  state.lastFocused = document.activeElement;
  backdrop.hidden = false;
  // Someone asking the system for reduced motion should not be handed nine
  // autoplaying videos. They mount paused with a visible way to start.
  installMultistreamSuspension();
  if (!state.multistream.paused && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.multistream = normalizeMultistream({ ...state.multistream, paused: true });
  }
  renderMultistream();
  backdrop.querySelector('[data-kf-multistream-input]')?.focus();
  announce(tr('Multi-stream opened'));
  // Fire-and-forget: live status is an enhancement, and every path already
  // renders correctly without it.
  resolveMultistreamLive().catch(() => {});
}

/**
 * Resolve channel ids for the grid and every saved layout, then read all of
 * their live states in one request.
 *
 * Identity is looked up once per channel and cached for the session; the live
 * state, which is the part that actually changes, is a single bulk call no
 * matter how many layouts are saved.
 */
async function resolveMultistreamLive() {
  if (!state.settings.content.liveEmoteCatalog && !state.settings.content.liveChatEvents) return;
  const slugs = [...new Set([
    ...state.multistream.streams,
    ...state.multistream.layouts.flatMap((layout) => layout.streams),
  ].map((slug) => slug.toLowerCase()))];
  const unresolved = slugs.filter((slug) => !state.multistreamIds.has(slug)).slice(0, MULTISTREAM_MAX * 3);
  for (const slug of unresolved) {
    const response = await kickFetchJson(endpoints.channel(slug));
    if (!response.ok) continue;
    const channel = normalizeChannel(response.body);
    if (!channel) { recordApiDrift('channel', 'shape-changed'); continue; }
    // An offline channel has no livestream id, which is already the answer and
    // costs nothing to record.
    state.multistreamIds.set(slug, channel.livestreamId);
    state.multistreamLive.set(slug, channel.isLive);
  }
  if (unresolved.length) renderMultistream();
  await refreshMultistreamLive();
}

function closeMultistream() {
  const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
  if (!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  // Blanking the grid drops every embedded player, so closing the surface
  // actually stops the decoding rather than leaving nine streams running.
  const grid = backdrop.querySelector('[data-kf-multistream-grid]');
  if (grid) grid.innerHTML = '';
  const chat = backdrop.querySelector('[data-kf-multistream-chat]');
  if (chat) chat.innerHTML = '';
  state.observers.multistream?.disconnect?.();
  state.observers.multistream = null;
  state.multistreamSuspended.clear();
  state.lastFocused?.focus?.();
}

/**
 * Suspend tiles that are not being watched.
 *
 * A cross-origin embed cannot be paused or quality-capped, so unloading its
 * document is the only control over decode cost — and it is the one that
 * matters, since roughly four to six simultaneous 1080p60 decodes is the
 * realistic ceiling on integrated graphics. The focused tile is exempt: it
 * carries the audio, and cutting what someone is listening to because they
 * switched tabs would cost more than it saves.
 */
function installMultistreamSuspension() {
  if (state.multistreamSuspensionInstalled) return;
  state.multistreamSuspensionInstalled = true;

  document.addEventListener('visibilitychange', () => {
    if (!multistreamOpen()) return;
    if (document.hidden) {
      for (const slug of state.multistream.streams) state.multistreamSuspended.add(slug);
    } else {
      state.multistreamSuspended.clear();
    }
    refreshMultistreamPlayback();
  });
}

/**
 * Watch tiles for visibility. Rebuilt per render because the tile set changes;
 * the observer is cheap and holding a stale one would leak removed nodes.
 */
function observeMultistreamVisibility(grid) {
  state.observers.multistream?.disconnect?.();
  if (typeof IntersectionObserver !== 'function') return;
  state.observers.multistream = new IntersectionObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      const slug = entry.target.dataset.kfMultistreamTile;
      if (!slug) continue;
      // Hidden tabs report everything as non-intersecting; visibilitychange
      // already owns that case, so ignore it here rather than fighting it.
      if (document.hidden) continue;
      const wasSuspended = state.multistreamSuspended.has(slug);
      if (entry.isIntersecting) state.multistreamSuspended.delete(slug);
      else state.multistreamSuspended.add(slug);
      if (wasSuspended !== state.multistreamSuspended.has(slug)) changed = true;
    }
    if (changed) refreshMultistreamPlayback();
  }, { root: grid, threshold: 0.05 });
  for (const tile of grid.querySelectorAll('[data-kf-multistream-tile]')) {
    state.observers.multistream.observe(tile);
  }
}

/** Re-apply playback state without rebuilding the grid. */
function refreshMultistreamPlayback() {
  const grid = state.shadow?.querySelector('[data-kf-multistream-grid]');
  if (grid) applyMultistreamAudio(grid);
}

function multistreamOpen() {
  const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
  return Boolean(backdrop && !backdrop.hidden);
}

/**
 * Rebuild the grid.
 *
 * Tiles are keyed by slug and reused across renders: replacing an `<iframe>`
 * restarts its stream from scratch, so adding a ninth channel must not
 * interrupt the eight already playing.
 */
function renderMultistream() {
  const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
  if (!backdrop || backdrop.hidden) return;
  const grid = backdrop.querySelector('[data-kf-multistream-grid]');
  const { streams, focus, chat, showChat, paused, muted } = state.multistream;

  backdrop.dataset.kfMultistreamShowChat = String(showChat && Boolean(chat));
  backdrop.dataset.kfMultistreamPaused = String(paused);
  void muted;
  backdrop.dataset.kfMultistreamMuted = String(muted);
  grid.style.setProperty('--kf-multistream-columns', String(multistreamColumns(streams.length)));

  const existing = new Map();
  for (const tile of grid.querySelectorAll('[data-kf-multistream-tile]')) {
    existing.set(tile.dataset.kfMultistreamTile, tile);
  }

  // Which tiles survive this render is decided in core, where it is tested
  // without a browser: replacing an iframe restarts its stream, so a channel
  // that is still wanted must keep the exact element it already had.
  const plan = planMultistreamTiles([...existing.keys()], streams);
  const ordered = [];
  for (const slug of plan.order) {
    let tile = existing.get(slug);
    if (tile) {
      existing.delete(slug);
    } else {
      tile = document.createElement('div');
      tile.dataset.kfMultistreamTile = slug;
      tile.className = 'kf-ms-tile';
      const frame = document.createElement('iframe');
      // Every tile starts muted; audio follows focus, so a nine-way grid is
      // never nine simultaneous audio streams. A paused grid mounts with no
      // src at all, which is the only way to stop a cross-origin player.
      frame.src = multistreamTileActive(state.multistream, slug, state.multistreamSuspended)
        ? playerEmbedUrl(slug, { muted: true, autoplay: true })
        : 'about:blank';
      frame.title = `${slug} stream`;
      // Kick playback is Amazon IVS HLS with no DRM, so encrypted-media would
      // be a grant with no function.
      frame.allow = 'autoplay; fullscreen; picture-in-picture';
      frame.referrerPolicy = 'origin';
      frame.loading = 'eager';
      tile.append(frame);
      const bar = document.createElement('div');
      bar.className = 'kf-ms-bar';
      bar.innerHTML = `
        <button type="button" class="kf-ms-name" data-action="multistream-focus" data-slug="${escapeHtml(slug)}" title="Give this stream the audio and chat">${escapeHtml(slug)}</button>
        <span class="kf-ms-spacer"></span>
        <a class="kf-ms-link" href="/${encodeURIComponent(slug)}" target="_blank" rel="noopener" title="Open ${escapeHtml(slug)} on Kick">Open</a>
        <button type="button" data-action="multistream-remove" data-slug="${escapeHtml(slug)}" aria-label="Remove ${escapeHtml(slug)} from the grid" title="Remove">×</button>`;
      tile.append(bar);
    }
    tile.dataset.kfMultistreamFocused = String(slug === focus);
    ordered.push(tile);
  }

  // Anything still in `existing` was removed from the grid.
  for (const stale of existing.values()) stale.remove();
  for (const tile of ordered) grid.append(tile);

  renderMultistreamChat(backdrop, chat, showChat);
  renderMultistreamControls(backdrop);
  applyMultistreamAudio(grid);
  observeMultistreamVisibility(grid);
}

/**
 * Audio follows focus.
 *
 * The embedded player is cross-origin, so its `muted` state cannot be reached
 * from here — the URL is the only control surface. Reloading a frame restarts
 * its stream, so only the two frames whose audio state actually changed are
 * touched, never the whole grid.
 */
function applyMultistreamAudio(grid) {
  for (const tile of grid.querySelectorAll('[data-kf-multistream-tile]')) {
    const slug = tile.dataset.kfMultistreamTile;
    const frame = tile.querySelector('iframe');
    if (!frame) continue;
    // Dropping the document is the only lever a cross-origin embed leaves us:
    // it cannot be paused, quality-capped, or inspected from here.
    const wanted = multistreamTileActive(state.multistream, slug, state.multistreamSuspended)
      ? playerEmbedUrl(slug, { muted: multistreamTileMuted(state.multistream, slug), autoplay: true })
      : 'about:blank';
    if (frame.getAttribute('src') !== wanted) frame.setAttribute('src', wanted);
    tile.dataset.kfMultistreamSuspended = String(!multistreamTileActive(state.multistream, slug, state.multistreamSuspended)
      && !state.multistream.paused);
  }
}

function renderMultistreamChat(backdrop, chat, showChat) {
  const host = backdrop.querySelector('[data-kf-multistream-chat]');
  if (!host) return;
  if (!showChat || !chat) {
    host.innerHTML = '';
    return;
  }
  const current = host.querySelector('iframe');
  if (current?.dataset.slug === chat) return;
  host.innerHTML = '';
  // Kick's popout chat refuses to send from inside an iframe — it throws a
  // CSRF error by design, and only reading works. Saying so is the difference
  // between a limitation and something that looks broken.
  const notice = document.createElement('p');
  notice.className = 'kf-ms-chat-notice';
  notice.textContent = tr('Read-only here. Kick blocks sending from an embedded chat; open the channel to talk.');
  host.append(notice);
  const frame = document.createElement('iframe');
  frame.src = chatEmbedUrl(chat);
  frame.dataset.slug = chat;
  frame.title = `${chat} chat`;
  frame.referrerPolicy = 'origin';
  host.append(frame);
}

function renderMultistreamControls(backdrop) {
  const { streams, chat, showChat, layouts } = state.multistream;
  const count = backdrop.querySelector('[data-kf-multistream-count]');
  if (count) {
    count.textContent = streams.length
      ? `${streams.length} of ${MULTISTREAM_MAX} streams`
      : 'No streams yet — add a channel to start.';
  }
  const error = backdrop.querySelector('[data-kf-multistream-error]');
  if (error) {
    error.textContent = state.multistreamError;
    error.hidden = !state.multistreamError;
  }
  const chatSelect = backdrop.querySelector('[data-kf-multistream-chat-select]');
  if (chatSelect) {
    chatSelect.innerHTML = streams.map((slug) => `<option value="${escapeHtml(slug)}"${slug === chat ? ' selected' : ''}>${escapeHtml(slug)}</option>`).join('');
    chatSelect.disabled = !streams.length;
  }
  const pauseToggle = backdrop.querySelector('[data-kf-multistream-pause]');
  if (pauseToggle) {
    pauseToggle.setAttribute('aria-pressed', String(state.multistream.paused));
    pauseToggle.textContent = state.multistream.paused ? 'Play all' : 'Pause all';
    pauseToggle.disabled = !streams.length;
  }
  const muteToggle = backdrop.querySelector('[data-kf-multistream-mute]');
  if (muteToggle) {
    muteToggle.setAttribute('aria-pressed', String(state.multistream.muted));
    muteToggle.textContent = state.multistream.muted ? 'Unmute' : 'Mute all';
    muteToggle.disabled = !streams.length || state.multistream.paused;
  }
  const chatToggle = backdrop.querySelector('[data-action="multistream-toggle-chat"]');
  if (chatToggle) {
    chatToggle.setAttribute('aria-pressed', String(showChat));
    chatToggle.textContent = showChat ? 'Hide chat' : 'Show chat';
  }
  const savedList = backdrop.querySelector('[data-kf-multistream-layouts]');
  if (savedList) {
    savedList.innerHTML = layouts.length
      ? layouts.map((layout) => {
        // Live counts come from one bulk request for every saved channel, so a
        // shelf of layouts costs the same as a single one.
        const live = layout.streams.filter((slug) => state.multistreamLive.get(slug.toLowerCase())).length;
        const status = state.multistreamLive.size
          ? `<small class="kf-ms-live" data-live="${live > 0}">${live}/${layout.streams.length} live</small>`
          : `<small>${layout.streams.length}</small>`;
        return `<span class="kf-ms-layout"><button type="button" data-action="multistream-load" data-layout="${escapeHtml(layout.name)}" title="${escapeHtml(layout.streams.join(', '))}">${escapeHtml(layout.name)} ${status}</button><button type="button" data-action="multistream-copy-layout" data-layout="${escapeHtml(layout.name)}" aria-label="Copy a link to layout ${escapeHtml(layout.name)}" title="Copy link">🔗</button><button type="button" data-action="multistream-delete-layout" data-layout="${escapeHtml(layout.name)}" aria-label="Delete layout ${escapeHtml(layout.name)}" title="Delete">×</button></span>`;
      }).join('')
      : '<span class="kf-ms-empty">No saved layouts yet.</span>';
  }
}

/**
 * Refresh live status for every channel across the grid and saved layouts in
 * one request. Kick's own sidebar uses this endpoint; per-channel polling for a
 * shelf of layouts would be dozens of requests for the same answer.
 */
async function refreshMultistreamLive() {
  const slugs = [...new Set([
    ...state.multistream.streams,
    ...state.multistream.layouts.flatMap((layout) => layout.streams),
  ].map((slug) => slug.toLowerCase()))];
  if (!slugs.length) return;
  // The endpoint keys on livestream id, so only channels known to have one are
  // asked about; a channel with none is already known to be offline.
  const ids = slugs.map((slug) => state.multistreamIds.get(slug)).filter(Boolean);
  if (!ids.length) return;
  const response = await kickFetchJson(endpoints.currentViewers(ids));
  if (!response.ok) return;
  const status = normalizeCurrentViewers(response.body);
  if (!status.ok) {
    recordApiDrift('current-viewers', status.reason);
    return;
  }
  // Kick returns entries only for channels that are still live, so absence
  // from the response means the stream ended.
  const stillLive = new Set(status.entries.map((entry) => String(entry.id)));
  for (const [slug, id] of state.multistreamIds) {
    if (id) state.multistreamLive.set(slug, stillLive.has(String(id)));
  }
  renderMultistream();
}

function addMultistream(raw) {
  const slug = parseChannelInput(raw);
  if (!slug) {
    state.multistreamError = 'Enter a Kick channel name or a kick.com link.';
    renderMultistream();
    return;
  }
  const result = addMultistreamChannel(state.multistream, slug);
  state.multistreamError = result.ok ? '' : result.error;
  if (result.ok) {
    state.multistream = result.value;
    // Merge-write so a second tab adding a different channel is not clobbered.
    commitMultistream([slug]);
    syncHeaderMultiState();
    announce(`${slug} added to the multi-stream grid`);
  }
  renderMultistream();
}

/**
 * One-click add/remove of the current channel to the multi-stream grid from the
 * header, with feedback. Stays on the page: it never opens the grid or
 * navigates, so a viewer can collect several channels and open them together.
 */
function toggleCurrentChannelInMulti() {
  const slug = currentChannelSlug();
  if (!slug) return;
  const inGrid = state.multistream.streams.some((entry) => entry.toLowerCase() === slug.toLowerCase());
  if (inGrid) {
    const result = commitMultistream([], [slug]);
    syncHeaderMultiState();
    renderMultistream();
    showToast(`Removed ${slug} from Multi — ${result.streams.length} of ${MULTISTREAM_MAX}`, false, [
      { label: 'Undo', onClick: () => { commitMultistream([slug]); syncHeaderMultiState(); renderMultistream(); } },
    ]);
    announce(`Removed ${slug} from multi-stream. Now ${result.streams.length} of ${MULTISTREAM_MAX}.`);
    return;
  }
  if (state.multistream.streams.length >= MULTISTREAM_MAX) {
    showToast(`Multi-stream is full at ${MULTISTREAM_MAX} of ${MULTISTREAM_MAX}.`, true);
    announce(`Multi-stream is full at ${MULTISTREAM_MAX} channels.`);
    return;
  }
  const result = commitMultistream([slug]);
  syncHeaderMultiState();
  renderMultistream();
  showToast(`Added ${slug} — ${result.streams.length} of ${MULTISTREAM_MAX}`, false, [
    { label: 'View', onClick: () => openMultistream() },
    { label: 'Undo', onClick: () => { commitMultistream([], [slug]); syncHeaderMultiState(); renderMultistream(); announce(`Removed ${slug} from multi-stream.`); } },
  ]);
  announce(`Added ${slug} to multi-stream. Now ${result.streams.length} of ${MULTISTREAM_MAX}.`);
}

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
  gmSet(key, [...value].filter((item) => typeof item === 'string').slice(-200));
}

function channelPath() {
  return state.route === 'channel' ? location.pathname.split(/[?#]/, 1)[0] : '';
}

function cardPath(node) {
  const link = node?.matches?.('a[href]') ? node : node?.querySelector?.('a[href]');
  try {
    const path = link ? new URL(link.href, location.origin).pathname : '';
    return path && path !== '/' ? path : '';
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
  actions.innerHTML = `
    <button type="button" data-kf-card-action="favorite" data-active="${favorite}" aria-label="${favorite ? 'Remove favorite' : 'Favorite'} ${escapeHtml(cardLabel(node))}">${favorite ? '★' : '☆'}</button>
    <button type="button" data-kf-card-action="dismiss" aria-label="${dismissed ? 'Restore' : 'Not interested'} ${escapeHtml(cardLabel(node))}">${dismissed ? '↶' : '×'}</button>`;
}

function handleCardAction(event) {
  const button = event.target.closest?.('[data-kf-card-action]');
  if (!button) return;
  const card = button.closest?.('[data-testid="livestream-results-card"], [data-testid="stream-card"], [class*="group/card"], article');
  const path = cardPath(card);
  if (!path) return;
  event.preventDefault();
  event.stopPropagation();
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
  meta.innerHTML = `<div><strong>${query ? `Search results for “${escapeHtml(query)}”` : 'Search results'}</strong><span>${count} ${count === 1 ? 'result' : 'results'} loaded</span></div>${query ? '<button type="button" data-kf-clear-search aria-label="Clear search">Clear</button>' : ''}`;
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
  enhanced.innerHTML = `
    <div data-kf-drops-primary>
      <span data-kf-drops-eyebrow>Campaign status</span>
      <h3>No open campaigns</h3>
      <p>New campaigns will appear here automatically. Browse eligible streams now or check what is coming next.</p>
      <div data-kf-drops-actions>
        <a href="/browse">Browse eligible streams</a>
        <a href="/drops/coming-soon">View coming soon</a>
      </div>
    </div>
    <aside data-kf-drops-activity aria-label="Reward activity">
      <strong>Reward activity</strong>
      <dl>
        <div><dt>Active campaigns</dt><dd>0</dd></div>
        <div><dt>Claimed rewards</dt><dd><a href="/drops/claimed">View</a></dd></div>
        <div><dt>Expired campaigns</dt><dd><a href="/drops/expired">View</a></dd></div>
      </dl>
    </aside>
    <ol data-kf-drops-steps aria-label="How drops work">
      <li><span>1</span><div><strong>Watch eligible streams</strong><small>Choose a stream with an active campaign.</small></div></li>
      <li><span>2</span><div><strong>Track progress</strong><small>Progress updates while you watch.</small></div></li>
      <li><span>3</span><div><strong>Claim your reward</strong><small>Claim before the campaign ends.</small></div></li>
    </ol>`;
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

function applyQualitySessionKey() {
  if (!state.settings.content.rememberQuality) return;
  const key = mediaPreferenceKey('quality');
  if (!key) return;
  const saved = state.mediaPreferences[key];
  if (!saved || typeof saved !== 'string') return;
  try {
    if (sessionStorage.getItem(QUALITY_SESSION_KEY) === saved) return;
    sessionStorage.setItem(QUALITY_SESSION_KEY, saved);
  } catch {
    // Session storage can be denied; the menu fallback below still applies.
  }
}

function applyQualityMemory() {
  if (!state.settings.content.rememberQuality) return;
  applyQualitySessionKey();
  const key = mediaPreferenceKey('quality');
  if (!key) return;
  const saved = state.mediaPreferences[key];
  // `[role="menuitemradio"]` is what Kick's own quality menu actually renders;
  // the rest are legacy guesses kept only so an older shell still works.
  const controls = document.querySelectorAll('[role="menuitemradio"], [data-quality], [data-resolution], [data-testid*="quality" i], [aria-label*="quality" i], select[data-kf-quality]');
  for (const control of controls) {
    const value = control.value || control.dataset.quality || control.dataset.resolution || control.textContent;
    if (!value) continue;
    if (control.dataset.kfQualityBound !== 'true') {
      control.dataset.kfQualityBound = 'true';
      control.addEventListener('change', () => saveMediaPreference('quality', control.value || control.dataset.quality || control.dataset.resolution || control.textContent.trim()));
      control.addEventListener('click', () => saveMediaPreference('quality', control.value || control.dataset.quality || control.dataset.resolution || control.textContent.trim()));
    }
    if (saved && control.dataset.kfQualityRestored !== 'true' && String(value).toLowerCase() === String(saved).toLowerCase() && control instanceof HTMLElement && control.tagName === 'BUTTON') {
      control.click();
      control.dataset.kfQualityRestored = 'true';
    } else if (saved && control.dataset.kfQualityRestored !== 'true' && control instanceof HTMLSelectElement && [...control.options].some((option) => option.value === saved)) {
      control.value = saved;
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

function applyPlayerResilience() {
  const videos = [...document.querySelectorAll('video')];
  if (state.settings.layout.playerContainVideo) {
    for (const video of videos) {
      const owner = video.closest?.('[data-testid*="player" i], [data-player], [id*="player" i]');
      if (owner) owner.dataset.kfPlayer = 'true';
    }
  }
  if (!state.settings.layout.playerResizeRecovery) return;
  const main = findProbe(document, 'main').element;
  if (main) main.dataset.kfPlayerResizeReady = 'true';
}

function applyChatPause() {
  const panel = findProbe(document, 'chatPanel').element;
  const messages = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages');
  if (!panel || !messages) return;
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
    state.observers.chat?.disconnect?.();
    state.observers.chat = null;
    const previousAriaLive = messages.dataset.kfPreviousAriaLive;
    if (previousAriaLive && previousAriaLive !== '__none__') messages.setAttribute('aria-live', previousAriaLive);
    else messages.removeAttribute('aria-live');
    delete messages.dataset.kfPreviousAriaLive;
    delete owner.dataset.kfChatPaused;
    delete messages.dataset.kfChatPaused;
    return;
  }
  button.textContent = state.runtime.chatPaused ? 'Resume chat' : 'Pause chat';
  button.setAttribute('aria-pressed', String(state.runtime.chatPaused));
  button.setAttribute('aria-label', state.runtime.chatPaused ? 'Resume chat updates' : 'Pause chat updates');
  let status = owner.querySelector?.('[data-kf-chat-status]');
  if (!status) {
    status = document.createElement('div');
    status.dataset.kfChatStatus = 'true';
    status.setAttribute('role', 'status');
    owner.append(status);
  }
  status.textContent = state.runtime.chatPaused ? 'Chat updates paused' : '';
  if (state.runtime.chatPaused) {
    if (!Object.prototype.hasOwnProperty.call(messages.dataset, 'kfPreviousAriaLive')) {
      messages.dataset.kfPreviousAriaLive = messages.getAttribute('aria-live') || '__none__';
    }
    if (!state.observers.chat) {
      const restoreScroll = () => {
        if (Number.isFinite(state.runtime.chatScrollTop)) messages.scrollTop = state.runtime.chatScrollTop;
      };
      state.runtime.chatScrollTop = messages.scrollTop;
      state.observers.chat = new MutationObserver(restoreScroll);
      state.observers.chat.observe(messages, { childList: true, subtree: true, characterData: true });
    }
    messages.setAttribute('aria-live', 'off');
    messages.dataset.kfChatPaused = 'true';
  } else {
    state.observers.chat?.disconnect?.();
    state.observers.chat = null;
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
  const src = rawSrc;
  const key = (id ? `id:${id}` : `name:${name.toLowerCase()}|src:${src}`).slice(0, 320);
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
    const incomingAccess = sticker.available
      ? 'available'
      : sticker.access === 'observed'
        ? 'observed'
        : 'locked';
    const access = existing?.access === 'available' || incomingAccess === 'available'
      ? 'available'
      : existing?.access === 'locked' || incomingAccess === 'locked'
        ? 'locked'
        : 'observed';
    // Nothing here calls Kick. The record is built from what the page and the
    // catalog already showed, so no claim is automated and no endpoint replayed.
    const record = recordStickerObservation(existing, {
      key: sticker.key,
      id: sticker.id,
      name: sticker.name,
      src: sticker.src,
      nativeGroups,
      access,
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

function chatStickerInfo(image) {
  const info = stickerImageInfo(image);
  return info ? { ...info, nativeGroups: ['Seen in chat'], access: 'observed' } : null;
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
      if (sticker) observed.set(sticker.key, sticker);
    }
  }
  if (observed.size) mergeStickerLibrary(observed.values());
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
    return;
  }
  const messages = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages');
  if (!messages) {
    disconnectChatStickerObserver();
    return;
  }
  if (state.runtime.stickerChatTarget === messages && state.observers.chatStickers) return;
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
  return `<span class="kf-rarity" data-rarity="${escapeHtml(match.rarity)}" title="Kick rarity, matched by ${escapeHtml(match.basis)}">${escapeHtml(match.rarity)}</span>`;
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
  const safeKey = escapeHtml(descriptor.key);
  const safeName = escapeHtml(descriptor.name);
  // Reorder controls only where order is visible and means something. Kick
  // ranks nothing, so this is the only place an explicit order exists.
  const ordering = pinned && state.stickerPreferences.view === 'pinned';
  const scope = pinned ? favoriteScopeOf(descriptor.key) : '';
  return `<div data-kf-sticker-item="true" data-kf-sticker-key="${safeKey}" data-kf-sticker-hidden="${hidden}"${scope ? ' data-kf-sticker-scoped="true"' : ''}>
    <button type="button" data-kf-sticker-action="send" data-kf-sticker-key="${safeKey}" class="kf-sticker-proxy" aria-label="Use emote ${safeName}" title="Use ${safeName}"><img src="${escapeHtml(descriptor.src)}" alt="${safeName}" loading="lazy"${emoteImageAttrs(descriptor)}>${rarityBadge(descriptor)}</button>
    <div data-kf-sticker-tools>
      ${ordering ? `<button type="button" data-kf-sticker-action="move-favorite" data-kf-sticker-move="up" data-kf-sticker-key="${safeKey}" aria-label="Move ${safeName} earlier" title="Move earlier">‹</button>
      <button type="button" data-kf-sticker-action="move-favorite" data-kf-sticker-move="down" data-kf-sticker-key="${safeKey}" aria-label="Move ${safeName} later" title="Move later">›</button>` : ''}
      <button type="button" data-kf-sticker-action="pin" data-kf-sticker-key="${safeKey}" aria-pressed="${pinned}" aria-label="${pinned ? 'Remove favorite' : 'Favorite'} ${safeName}" title="${pinned ? `Remove favorite${scope ? ` (this channel)` : ''}` : 'Favorite'}">${pinned ? '★' : '☆'}</button>
      <button type="button" data-kf-sticker-action="hide" data-kf-sticker-key="${safeKey}" aria-label="${hidden ? 'Restore' : 'Remove'} ${safeName}" title="${hidden ? 'Restore' : 'Remove'}">${hidden ? '↶' : '×'}</button>
    </div>
  </div>`;
}

function stickerQuickProxyMarkup(descriptor) {
  const safeKey = escapeHtml(descriptor.key);
  const safeName = escapeHtml(descriptor.name);
  return `<div data-kf-sticker-quick-item="true">
    <button type="button" data-kf-sticker-action="send" data-kf-sticker-key="${safeKey}" aria-label="Use favorite emote ${safeName}" title="Use ${safeName}"><img src="${escapeHtml(descriptor.src)}" alt="${safeName}" loading="lazy"></button>
    <div data-kf-sticker-quick-tools><button type="button" data-kf-sticker-action="pin" data-kf-sticker-key="${safeKey}" aria-label="Remove ${safeName} from quick favorites" title="Remove from quick favorites">×</button></div>
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
  for (const node of document.querySelectorAll('[data-kf-sticker-key], [data-kf-sticker-native-group], [data-kf-sticker-native-list], [data-kf-sticker-native-shell]')) {
    if (node.closest('[data-kf-sticker-organizer]')) continue;
    node.removeAttribute('data-kf-sticker-key');
    node.removeAttribute('data-kf-sticker-hidden');
    node.removeAttribute('data-kf-sticker-pinned');
    node.removeAttribute('data-kf-sticker-native');
    node.removeAttribute('data-kf-sticker-native-group');
    node.removeAttribute('data-kf-sticker-native-list');
    node.removeAttribute('data-kf-sticker-native-shell');
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
  if (!descriptors.length) {
    removeStickerOrganizer();
    return;
  }
  const search = stickerSearchInput(picker);
  if (search && search.dataset.kfStickerSearchBound !== 'true') {
    search.dataset.kfStickerSearchBound = 'true';
    search.addEventListener('input', () => renderStickerOrganizer());
  }
  let organizer = picker.querySelector('[data-kf-sticker-organizer]');
  if (!organizer) {
    organizer = document.createElement('section');
    organizer.dataset.kfStickerOrganizer = 'true';
  }
  if (organizer.parentElement !== scroll) scroll.prepend(organizer);
  const previousGridScrollTop = state.runtime.stickerGridScrollTop;
  state.runtime.stickerGridScrollTop = null;

  const query = String(search?.value || '').trim().toLowerCase();
  const showHidden = state.stickerPreferences.showHidden;
  const matches = (descriptor) => (!query || descriptor.name.toLowerCase().includes(query))
    && (showHidden || !state.stickerPreferences.hidden.has(descriptor.key));
  const allVisible = descriptors.filter(matches);
  // Favorites render in their explicit order, not in picker order — that
  // ordering is the whole point, and the picker's own order is Kick's.
  const favoriteOrder = favoriteKeysInOrder();
  const byFavoriteOrder = (left, right) => favoriteOrder.indexOf(left.key) - favoriteOrder.indexOf(right.key);
  const quickFavorites = descriptors
    .filter((descriptor) => isFavorited(descriptor.key) && !state.stickerPreferences.hidden.has(descriptor.key))
    .sort(byFavoriteOrder);
  const visible = state.stickerPreferences.view === 'pinned'
    ? allVisible.filter((descriptor) => isFavorited(descriptor.key)).sort(byFavoriteOrder)
    : state.stickerPreferences.view === 'group'
      ? allVisible.filter((descriptor) => state.stickerPreferences.assignments.get(descriptor.key) === state.stickerPreferences.activeGroup)
      : allVisible;
  const unavailableCount = unavailableStickerCount(picker, descriptors);
  const signature = [
    state.stickerPreferences.view,
    state.stickerPreferences.activeGroup,
    String(showHidden),
    query,
    descriptors.map((descriptor) => descriptor.key).join(','),
    String(unavailableCount),
    // Order is part of the signature: reordering changes nothing else, so
    // without it the shelf would keep the stale arrangement on screen.
    favoriteKeysInOrder().join(','),
    [...state.stickerPreferences.hidden].join(','),
    state.stickerPreferences.groups.map((group) => `${group.id}:${group.name}`).join(','),
    [...state.stickerPreferences.assignments].map(([key, groupId]) => `${key}:${groupId}`).join(','),
  ].join('\u0001');
  if (organizer.dataset.kfStickerSignature === signature) return;
  organizer.dataset.kfStickerSignature = signature;
  const view = state.stickerPreferences.view;
  const countLabel = `${visible.length} ${plural(visible.length, 'emote', 'emotes')}`;
  const unavailableLabel = unavailableCount
    ? `<span data-kf-sticker-locked>${unavailableCount} locked by Kick</span>`
    : '';
  const quickShelf = quickFavorites.length
    ? `<div data-kf-sticker-quick-grid role="group" aria-label="Three-row one-click favorite emotes">${quickFavorites.map(stickerQuickProxyMarkup).join('')}</div>`
    : '<div data-kf-sticker-quick-empty>Favorite emotes with ☆ to fill up to three rows of one-click shortcuts.</div>';
  const list = view === 'native'
    ? '<div data-kf-sticker-empty>Kick’s native emote groups are shown below.</div>'
    : visible.length
      ? `<div data-kf-sticker-grid>${visible.map(stickerProxyMarkup).join('')}</div>`
      : `<div data-kf-sticker-empty>${view === 'pinned' ? 'Favorite emotes here to build your shelf.' : view === 'group' ? 'No available emotes are assigned to this group.' : 'No emotes match this search.'}</div>`;
  const customGroups = state.stickerPreferences.groups.map((group) => {
    const count = allVisible.filter((descriptor) => state.stickerPreferences.assignments.get(descriptor.key) === group.id).length;
    const active = view === 'group' && state.stickerPreferences.activeGroup === group.id;
    return `<button type="button" data-kf-sticker-view="group" data-kf-sticker-group="${escapeHtml(group.id)}" data-active="${active}" aria-pressed="${active}">${escapeHtml(group.name)} (${count})</button>`;
  }).join('');
  const firstGroup = state.stickerPreferences.groups[0];
  const groupsTab = firstGroup
    ? `<button type="button" data-kf-sticker-view="group" data-kf-sticker-group="${escapeHtml(state.stickerPreferences.activeGroup || firstGroup.id)}" data-active="${view === 'group'}" aria-pressed="${view === 'group'}">Groups</button>`
    : '<button type="button" data-kf-sticker-manage="true">Groups</button>';
  organizer.innerHTML = `
    <div data-kf-sticker-topline>
      <div><strong>Emote shelf</strong><span data-kf-sticker-count>${escapeHtml(countLabel)}</span>${unavailableLabel}</div>
      <button type="button" data-kf-sticker-manage="true">Manage</button>
    </div>
    <div data-kf-sticker-toolbar role="group" aria-label="Emote views and filters">
      <button type="button" data-kf-sticker-view="pinned" data-active="${view === 'pinned'}" aria-pressed="${view === 'pinned'}">Quick (${favoriteCount()})</button>
      <button type="button" data-kf-sticker-view="all" data-active="${view === 'all'}" aria-pressed="${view === 'all'}">All (${allVisible.length})</button>
      ${groupsTab}
      <button type="button" data-kf-sticker-view="native" data-active="${view === 'native'}" aria-pressed="${view === 'native'}">Native</button>
      <button type="button" data-kf-sticker-show-hidden="true" aria-pressed="${showHidden}">${showHidden ? 'Hide removed' : 'Removed'}</button>
    </div>
    ${customGroups ? `<div data-kf-sticker-groups><span>Groups</span>${customGroups}<button type="button" data-kf-sticker-manage="true">Edit groups</button></div>` : ''}
    <div data-kf-sticker-note>New Kick emotes save automatically. Pin with ☆, remove with ×, and organize groups from Manage.</div>
    <section data-kf-sticker-quick-shelf="true">
      <div data-kf-sticker-quick-header><strong>Quick favorites</strong><span data-kf-sticker-quick-count>${quickFavorites.length} available · 3 rows</span><button type="button" data-kf-sticker-view="pinned" aria-pressed="${view === 'pinned'}">Edit shelf</button></div>
      ${quickShelf}
    </section>
    <div data-kf-sticker-secondary-actions><button type="button" data-kf-sticker-reset="true">Reset changes</button></div>
    ${list}`;
  restoreStickerGridScroll(organizer, previousGridScrollTop);
  measureEmoteAspect(organizer);
}

function resetStickerPreferences(options = {}) {
  const keepLibrary = options.keepLibrary === true;
  const library = keepLibrary ? state.stickerPreferences.library : new Map();
  state.runtime.stickerLibraryFilter = 'all';
  state.runtime.stickerLibraryQuery = '';
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
  else gmDelete(STICKER_PREFERENCES_KEY);
}

function clearStickerPreferences() {
  resetStickerPreferences({ keepLibrary: true });
  renderSettingsPage();
  scheduleApply(0);
  showToast('Emote favorites, removals, and custom groups reset.');
}

function handleStickerAction(event) {
  const target = event.target.closest?.('[data-kf-sticker-action], [data-kf-sticker-view], [data-kf-sticker-show-hidden], [data-kf-sticker-reset], [data-kf-sticker-manage]');
  if (!target || !target.closest?.('[data-kf-sticker-organizer]')) return;
  event.preventDefault();
  event.stopPropagation();
  const key = target.dataset.kfStickerKey;
  const action = target.dataset.kfStickerAction;
  if (target.dataset.kfStickerManage) {
    state.currentPage = 'content';
    openSettings();
    return;
  }
  if (action === 'send') {
    const original = state.stickerCatalog.get(key)?.originals?.find((button) => button.isConnected);
    original?.click?.();
    return;
  }
  if ((action === 'pin' || action === 'hide') && key) rememberStickerGridScroll(target);
  if (action === 'pin' && key) {
    // Removing clears whichever scope this channel actually sees it through, so
    // un-favoriting a global from a channel page does not silently do nothing.
    const scope = isFavorited(key) ? favoriteScopeOf(key) : newFavoriteChannel();
    state.stickerPreferences.favorites = toggleStickerFavorite(state.stickerPreferences.favorites, key, scope);
    if (isFavorited(key)) state.stickerPreferences.hidden.delete(key);
    persistStickerPreferences();
    announce(isFavorited(key) ? 'Emote pinned' : 'Emote unpinned');
  } else if (action === 'move-favorite' && key) {
    const earlier = target.dataset.kfStickerMove === 'up';
    state.stickerPreferences.favorites = moveStickerFavorite(
      state.stickerPreferences.favorites,
      key,
      favoriteScopeOf(key),
      earlier ? -1 : 1,
    );
    persistStickerPreferences();
    announce(earlier ? 'Emote moved earlier' : 'Emote moved later');
  } else if (action === 'hide' && key) {
    if (state.stickerPreferences.hidden.has(key)) state.stickerPreferences.hidden.delete(key);
    else {
      state.stickerPreferences.hidden.add(key);
      // Hidden wins over favorited in every scope, or the shelf would keep
      // offering an emote the user just removed.
      state.stickerPreferences.favorites = state.stickerPreferences.favorites.filter((entry) => entry.key !== key);
    }
    persistStickerPreferences();
    announce(state.stickerPreferences.hidden.has(key) ? 'Emote removed' : 'Emote restored');
  } else if (target.dataset.kfStickerView) {
    state.stickerPreferences.view = target.dataset.kfStickerView;
    state.stickerPreferences.activeGroup = target.dataset.kfStickerGroup || state.stickerPreferences.activeGroup;
    persistStickerPreferences();
  } else if (target.dataset.kfStickerShowHidden) {
    state.stickerPreferences.showHidden = !state.stickerPreferences.showHidden;
    persistStickerPreferences();
  } else if (target.dataset.kfStickerReset) {
    resetStickerPreferences({ keepLibrary: true });
    announce('Emote changes reset');
  } else {
    return;
  }
  if (key) {
    const descriptor = state.stickerCatalog.get(key);
    for (const original of descriptor?.originals || []) {
      original.dataset.kfStickerHidden = String(state.stickerPreferences.hidden.has(key));
      original.dataset.kfStickerPinned = String(isFavorited(key));
    }
  }
  applySettingsAttributes();
  scheduleApply(0);
}

function chatKeywordsForChannel() {
  const value = state.chatKeywords[channelPath()];
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, 20) : [];
}

function applyChatHighlights() {
  const messages = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages');
  if (!messages) return;
  const keywords = state.settings.content.chatHighlights ? chatKeywordsForChannel() : [];
  for (const node of messages.querySelectorAll?.('[data-index], [data-message-id], .group') || []) {
    const text = (node.textContent || '').toLowerCase();
    node.dataset.kfHighlighted = String(keywords.some((keyword) => text.includes(keyword.toLowerCase())));
  }
}

function applyPlaybackDiagnostics() {
  const existing = document.querySelector('[data-kf-playback-diagnostics]');
  if (!state.settings.content.playbackDiagnostics || state.route !== 'channel') {
    existing?.remove();
    clearInterval(state.playbackDiagnosticsTimer);
    state.playbackDiagnosticsTimer = 0;
    return;
  }
  const video = document.querySelector('video');
  if (!video) return;
  const owner = video.closest?.('[data-testid*="player" i], [data-player], [id*="player" i]') || video.parentElement;
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
  if (!path) return false;
  const channels = state.settings.content.hiddenChannels;
  if (!channels.length) return false;
  const normalized = path.toLowerCase();
  return channels.some((entry) => normalized === entry);
}

function remoteBlocklistMatches(path, labels, text) {
  const remote = state.remoteBlocklist;
  if (remote.status !== 'ready') return false;
  const normalized = String(text || '').toLowerCase();
  return (path && remote.channels.has(path.toLowerCase()))
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
      const timer = window.setTimeout(() => reject(new Error('companion timeout')), 10000);
      const handler = (event) => {
        window.clearTimeout(timer);
        document.removeEventListener('kick-focus:blocklist-result', handler);
        try {
          const result = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
          if (!result?.ok) throw new Error(result?.error || 'companion fetch failed');
          resolve({ text: result.text, method: 'companion' });
        } catch (error) {
          reject(error);
        }
      };
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
  let url;
  try {
    url = new URL(settings.blocklistUrl);
    if (url.protocol !== 'https:') throw new Error('HTTPS required');
  } catch {
    state.remoteBlocklist.status = 'error';
    updateRemoteBlocklistInPlace();
    return;
  }
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
  for (const node of mainCardCandidates()) applyCardActions(node);

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
    try { path = link ? new URL(link.href, location.origin).pathname : ''; } catch { /* noop */ }
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
    announce(`Content filtering suspended: it would have hidden ${percent}% of this page.`);
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
  status.textContent = state.compatibility.healthy ? 'Healthy' : 'Needs attention';
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
  const now = Date.now();
  if (!state.applyPendingSince) state.applyPendingSince = now;
  const effective = nextApplyDelay(delay, now - state.applyPendingSince);
  clearTimeout(state.applyTimer);
  state.applyTimer = window.setTimeout(() => {
    if (state.runtime.suspended) return;
    try {
    state.applyPendingSince = 0;
    const currentPath = location.pathname;
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
        state.observers.chat?.disconnect?.();
        state.observers.chat = null;
      }
      state.runtime.matureVisible = false;
      announce(`Kick Focus applied to ${state.route}`);
    }
    applySettingsAttributes();
    tagChatPanel();
    removeAdShells();
    applyContentFilters();
    syncNativeSidebar();
    applyRailVisibility();
    applySearchEnhancements();
    applyDropsEnhancements();
    applyMediaMemory();
    applyPlayerResilience();
    applyChatPause();
    observeChatStickerDiscovery();
    // Fire-and-forget: every live path already falls back to the DOM, so a
    // rejected promise here must never interrupt the apply cycle.
    refreshLiveChannel().catch(() => {});
    replayPendingDeletions();
    replayPendingBadges();
    renderStickerOrganizer();
    applyChatHighlights();
    applyPlaybackDiagnostics();
    state.compatibility = compatibilitySnapshot(document, { expectedChat: state.route === 'channel' });
    updateCompatibilityInPlace();
    syncQuickButton();
    } catch (error) {
      logAppError('apply cycle', error);
    }
  }, effective);
}

function installSpaHooks() {
  if (pageWindow.__kickFocusSpaHooksV1) return;
  pageWindow.__kickFocusSpaHooksV1 = true;
  for (const method of ['pushState', 'replaceState']) {
    try {
      const original = pageWindow.history[method];
      pageWindow.history[method] = function kickFocusHistory(...args) {
        const result = original.apply(this, args);
        pageWindow.dispatchEvent(new pageWindow.Event(ROUTE_EVENT));
        return result;
      };
    } catch {
      // Popstate and the document observer still cover navigation.
    }
  }
  pageWindow.addEventListener('popstate', () => pageWindow.dispatchEvent(new pageWindow.Event(ROUTE_EVENT)));
  pageWindow.addEventListener(ROUTE_EVENT, () => scheduleApply(20));
}

function installDocumentObserver() {
  if (state.observers.document) return;
  state.observers.document = new MutationObserver(() => scheduleApply(80));
  state.observers.document.observe(document.documentElement, { childList: true, subtree: true });
}

function installRuntimeInteractions() {
  if (pageWindow.__kickFocusRuntimeInteractionsV1) return;
  pageWindow.__kickFocusRuntimeInteractionsV1 = true;
  document.addEventListener('click', handleCardAction, true);
  document.addEventListener('click', handleSearchAction, true);
  document.addEventListener('click', handleStickerAction, true);
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-kf-chat-pause]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    state.runtime.chatPaused = !state.runtime.chatPaused;
    applySettingsAttributes();
    applyChatPause();
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
    const path = new URL(link.href, location.origin).pathname;
    if (!path || path === '/') return;
    state.watched.add(path);
    const values = [...state.watched].slice(-200);
    sessionStorage.setItem(WATCHED_KEY, JSON.stringify(values));
  } catch {
    // Session-only watched state is an optional enhancement.
  }
}

function channelLayoutMap() {
  const value = gmGet(CHANNEL_LAYOUT_KEY, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function restoreChannelLayout(path) {
  if (!state.settings.layout.rememberPerChannel) return false;
  const saved = channelLayoutMap()[path];
  if (!saved || typeof saved !== 'object') return false;
  state.runtime.focus = Boolean(saved.focus);
  state.runtime.theater = Boolean(saved.theater);
  state.runtime.chatHidden = Boolean(saved.chatHidden);
  state.runtime.sidebarHidden = Boolean(saved.sidebarHidden);
  return true;
}

function saveChannelLayout() {
  if (state.route !== 'channel' || !state.settings.layout.rememberPerChannel) return;
  const map = channelLayoutMap();
  map[location.pathname] = {
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
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = message; });
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
  if (path === 'content.rememberVodPosition' && !state.settings.content.rememberVodPosition) clearMediaPreferenceKind('position');
  if (path === 'content.stickyChatPause' && !state.settings.content.stickyChatPause) {
    state.runtime.chatPaused = false;
    state.observers.chat?.disconnect?.();
    state.observers.chat = null;
  }
  if (path === 'content.blocklistSubscription' && !state.settings.content.blocklistSubscription) clearRemoteBlocklist();
  if (path === 'content.blocklistUrl' && state.remoteBlocklist.source !== state.settings.content.blocklistUrl) clearRemoteBlocklist();
  if (path.startsWith('content.blocklist')) window.setTimeout(() => scheduleRemoteBlocklistSync(true), 0);
  saveSettings(message);
  scheduleApply(0);
  renderSettingsPage();
  renderCommands();
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
    --surface-0: #070908;
    --surface-1: #101311;
    --surface-2: #151917;
    --surface-3: #1c211e;
    --border: #353b37;
    --border-subtle: #272c29;
    --text: #f4f7f5;
    --muted: #929b96;
    --danger: #ff6258;
    --warning: #f6b943;
    --radius: var(--kf-radius, 9px);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.45;
  }

  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }
  button, input { font: inherit; }
  button { color: inherit; }

  .kf-quick {
    position: fixed;
    left: 18px;
    bottom: 18px;
    z-index: 2147483000;
    min-width: 76px;
    height: 38px;
    padding: 0 16px;
    border: 1px solid #3a413d;
    border-radius: 7px;
    background: #111412;
    color: var(--text);
    box-shadow: 0 14px 38px rgba(0,0,0,.5);
    cursor: pointer;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .kf-quick:hover { border-color: var(--accent); color: var(--accent); }

  .kf-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2147483200;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(2, 3, 3, .86);
  }

  .kf-settings {
    position: relative;
    width: min(1000px, calc(100vw - 48px));
    height: min(920px, calc(100vh - 48px));
    min-width: 820px;
    min-height: 660px;
    display: grid;
    grid-template-rows: 88px minmax(0, 1fr) 80px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-1);
    box-shadow: 0 42px 120px rgba(0,0,0,.78);
    color: var(--text);
    font-size: calc(14px * var(--kf-interface-scale, 1));
  }

  .kf-header {
    display: grid;
    grid-template-columns: 240px 1fr auto auto;
    align-items: center;
    gap: 24px;
    padding: 0 24px;
    border-bottom: 1px solid var(--border-subtle);
    background: #121512;
  }
  .kf-brand { display: flex; align-items: center; gap: 9px; min-width: 0; font-size: 16px; font-weight: 820; letter-spacing: -.02em; }
  .kf-brand-mark { width: 28px; height: 28px; display: block; object-fit: contain; }
  .kf-badge { padding: 2px 6px; border: 1px solid rgba(var(--accent-rgb), .68); border-radius: 3px; color: var(--accent); font-size: 9px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
  .kf-title { font-size: 15px; font-weight: 760; }
  .kf-save { display: flex; align-items: center; color: #b7bfba; font-size: 12px; }
  .kf-save::before { content: ''; display: inline-block; width: 8px; height: 8px; margin-right: 8px; border: 1px solid var(--accent); border-radius: 50%; box-shadow: inset 0 0 0 2px #121512; background: var(--accent); }
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
  .kf-icon-button:hover { border-color: var(--border); background: #1a1f1c; }
  .kf-icon { width: 18px; height: 18px; display: block; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

  .kf-body { min-height: 0; display: grid; grid-template-columns: 240px minmax(0, 1fr); }
  .kf-nav { padding: 18px 0; border-right: 1px solid var(--border); background: #0d100e; }
  .kf-nav button {
    position: relative;
    width: 100%;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    align-items: center;
    gap: 13px;
    min-height: 62px;
    padding: 0 24px;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }
  .kf-nav button::before { content: ''; position: absolute; inset: 13px auto 13px 0; width: 3px; background: transparent; }
  .kf-nav button:hover { background: rgba(255,255,255,.025); }
  .kf-nav button[aria-current="page"]::before { background: var(--accent); box-shadow: 0 0 14px rgba(var(--accent-rgb), .35); }
  .kf-nav button[aria-current="page"] { color: #fff; }
  .kf-nav .kf-icon { width: 20px; height: 20px; color: #bbc2be; }
  .kf-nav button[aria-current="page"] .kf-icon { color: var(--accent); }
  .kf-nav-copy { display: grid; gap: 2px; min-width: 0; }
  .kf-nav strong { font-size: 13px; font-weight: 720; }
  .kf-nav span { overflow: hidden; color: var(--muted); font-size: 10px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }

  .kf-page { min-width: 0; overflow: auto; padding: 22px 30px 38px 34px; scrollbar-color: #3a423d transparent; scrollbar-width: thin; }
  .kf-page:focus { outline: 0; }
  .kf-page-header { min-height: 82px; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
  .kf-page-header h2 { margin: 0 0 4px; font-size: 27px; line-height: 1.05; letter-spacing: -.035em; text-transform: uppercase; }
  .kf-page-header p { margin: 0; color: var(--muted); font-size: 12px; }
  .kf-page-meta { display: grid; gap: 3px; min-width: 140px; text-align: right; }
  .kf-page-meta span { color: #747d78; font-size: 9px; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
  .kf-page-meta strong { color: #dce2de; font-size: 11px; font-weight: 700; }
  .kf-page-meta-control { min-width: 118px; justify-items: end; }

  .kf-panel { border: 0; border-radius: 0; background: transparent; overflow: visible; }
  .kf-row {
    min-height: 78px;
    display: grid;
    grid-template-columns: minmax(230px, 1fr) minmax(300px, auto);
    align-items: center;
    gap: 26px;
    padding: 14px 0;
    border-bottom: 1px solid var(--border-subtle);
  }
  .kf-row h3 { margin: 0 0 3px; font-size: 12px; font-weight: 790; letter-spacing: .025em; }
  .kf-row p { max-width: 390px; margin: 0; color: var(--muted); font-size: 11px; line-height: 1.38; }
  .kf-row-wide { grid-template-columns: minmax(210px, .82fr) minmax(340px, 1.18fr); }
  .kf-control { min-width: 300px; display: flex; justify-content: flex-end; }

  .kf-segmented { display: inline-flex; border: 1px solid #444b46; border-radius: 3px; overflow: hidden; background: #0c0f0d; }
  .kf-segmented button {
    min-width: 78px;
    height: 40px;
    padding: 0 13px;
    border: 0;
    border-left: 1px solid #444b46;
    background: transparent;
    color: #d4dad6;
    cursor: pointer;
    font-size: 12px;
    font-weight: 680;
  }
  .kf-segmented button:first-child { border-left: 0; }
  .kf-segmented button[aria-pressed="true"] { background: rgba(var(--accent-rgb), .055); color: #fff; box-shadow: inset 0 0 0 1px var(--accent); }

  .kf-switch {
    width: 42px;
    height: 22px;
    position: relative;
    border: 0;
    border-radius: 999px;
    background: #424944;
    cursor: pointer;
  }
  .kf-switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: left 120ms ease;
  }
  .kf-switch[aria-checked="true"] { background: var(--accent); }
  .kf-switch[aria-checked="true"]::after { left: 23px; background: #071004; }
  .kf-switch:disabled { opacity: .76; cursor: not-allowed; }

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
    border: 1px solid #444b46;
    border-radius: 4px;
    background: #0b0e0c;
    color: var(--text);
  }
  .kf-textarea { min-height: 86px; resize: vertical; }
  .kf-text:focus, .kf-textarea:focus { border-color: var(--accent); outline: 0; box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15); }
  .kf-select { min-width: 118px; height: 32px; padding: 0 28px 0 9px; border: 1px solid #444b46; border-radius: 3px; background: #0b0e0c; color: var(--text); font-size: 11px; }
  .kf-select:focus { border-color: var(--accent); outline: 0; }

  .kf-theme-grid, .kf-swatch-grid { display: grid; grid-template-columns: repeat(4, minmax(76px, 1fr)); gap: 8px; }
  .kf-theme-grid { grid-template-columns: repeat(3, minmax(104px, 1fr)); }
  .kf-choice-card {
    min-height: 86px;
    padding: 11px;
    border: 1px solid #3b423d;
    border-radius: 4px;
    background: #0d100e;
    cursor: pointer;
    text-align: left;
  }
  .kf-choice-card:hover { border-color: #555f58; }
  .kf-choice-card[aria-pressed="true"] { border-color: var(--accent); box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), .15); }
  .kf-choice-card strong { display: block; margin-top: 8px; font-size: 11px; }
  .kf-theme-sample { height: 34px; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 0 8px; border: 1px solid #303632; border-radius: 2px; background: #171b18; color: #9ca59f; font-size: 8px; letter-spacing: .06em; text-transform: uppercase; }
  .kf-theme-sample b { color: var(--accent); font-size: 8px; }
  .kf-swatch { width: 28px; height: 28px; border-radius: 3px; border: 1px solid rgba(255,255,255,.24); }
  .kf-swatch[data-color="kick"] { background: #7cff2b; }
  .kf-swatch[data-color="cyan"] { background: #38d7d0; }
  .kf-swatch[data-color="violet"] { background: #9667ff; }
  .kf-swatch[data-color="gold"] { background: #ffbe2e; }

  .kf-appearance-layout { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(260px, .85fr); gap: 22px; }
  .kf-appearance-controls { min-width: 0; }
  .kf-appearance-controls .kf-row, .kf-appearance-controls .kf-row-wide { min-height: 0; grid-template-columns: 1fr; gap: 7px; padding: 9px 0; }
  .kf-appearance-controls .kf-row:has(.kf-control) { min-height: 56px; grid-template-columns: minmax(150px, 1fr) minmax(190px, auto); align-items: center; gap: 10px; }
  .kf-appearance-controls .kf-row:has(.kf-control) p { max-width: 175px; }
  .kf-appearance-controls .kf-control { width: 190px; min-width: 0; justify-content: flex-end; }
  .kf-appearance-controls .kf-segmented { width: 100%; }
  .kf-appearance-controls .kf-segmented button { min-width: 0; flex: 1; padding-inline: 8px; }
  .kf-appearance-controls .kf-range { grid-template-columns: 38px minmax(90px, 1fr) 34px; gap: 6px; }
  .kf-appearance-controls .kf-choice-card { min-height: 64px; padding: 8px; }
  .kf-appearance-controls .kf-theme-sample { height: 25px; padding-inline: 6px; }
  .kf-appearance-controls .kf-choice-card strong { margin-top: 5px; font-size: 10px; }

  .kf-preview { position: sticky; top: 0; align-self: start; min-width: 0; padding-left: 20px; border-left: 1px solid var(--border); }
  .kf-preview-kicker { color: var(--accent); font-size: 10px; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
  .kf-preview-intro { margin: 3px 0 14px; color: var(--muted); font-size: 10px; }
  .kf-preview-surface { overflow: hidden; border: 1px solid var(--border); border-radius: 4px; background: #0b0e0c; }
  .kf-preview-surface header { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 12px; border-bottom: 1px solid var(--border-subtle); font-size: 9px; }
  .kf-preview-surface header strong { margin-right: auto; color: var(--accent); font-size: 12px; }
  .kf-preview-surface header span { color: var(--muted); }
  .kf-preview-image { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-bottom: 1px solid var(--border-subtle); filter: saturate(var(--kf-thumb-saturation, 1.03)); }
  .kf-preview-feature { padding: 18px 14px; border-bottom: 1px solid var(--border-subtle); }
  .kf-preview-feature h3 { margin: 7px 0 3px; font-size: 15px; line-height: 1.2; }
  .kf-preview-feature p { margin: 0; color: var(--muted); font-size: 10px; }
  .kf-preview-live { display: inline-flex; align-items: center; gap: 7px; color: #dce3de; font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .kf-preview-live::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
  .kf-preview-action { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; color: var(--muted); font-size: 9px; }
  .kf-preview-action b { padding: 7px 10px; border: 1px solid var(--accent); border-radius: 3px; color: var(--accent); font-size: 9px; }
  .kf-preview-list { display: flex; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border-subtle); font-size: 9px; }
  .kf-preview-list:last-child { border-bottom: 0; }
  .kf-preview-list span { color: var(--muted); }
  .kf-preview-list strong { text-align: right; }

  .kf-status-card { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 18px; padding: 18px 0; border-bottom: 1px solid var(--border-subtle); }
  .kf-status-card h3 { margin: 0 0 3px; font-size: 15px; }
  .kf-status-card p { max-width: 520px; margin: 0; color: var(--muted); font-size: 11px; }
  .kf-active { color: var(--accent); font-weight: 800; }
  .kf-stats { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 1px solid var(--border-subtle); }
  .kf-stat { padding: 15px 12px; border-left: 1px solid var(--border-subtle); text-align: left; }
  .kf-stat:first-child { border-left: 0; }
  .kf-stat span { display: block; color: var(--muted); font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
  .kf-stat strong { display: block; margin-top: 4px; color: var(--accent); font-size: 15px; }

  .kf-defense-overview { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr); border-bottom: 1px solid var(--border); }
  .kf-defense-overview .kf-status-card, .kf-defense-overview .kf-stats { border-bottom: 0; }
  .kf-defense-overview .kf-status-card { padding-right: 18px; }
  .kf-defense-overview .kf-status-card > .kf-active { display: none; }
  .kf-defense-overview .kf-stats { border-left: 1px solid var(--border-subtle); }
  .kf-content-section { margin-top: 18px; }
  .kf-content-section .kf-subsection-header { margin-bottom: 0; padding-bottom: 9px; }
  [data-kf-current-page="content"] .kf-row { min-height: 54px; padding: 8px 0; }
  [data-kf-current-page="content"] .kf-row h3 { margin-bottom: 1px; font-size: 11px; }
  [data-kf-current-page="content"] .kf-row p { font-size: 10px; }
  [data-kf-current-page="content"] .kf-subsection { margin-top: 20px; }
  [data-kf-current-page="content"] .kf-status-note { font-size: 10px; }
  .kf-tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 20px; }
  .kf-tool-card { min-height: 92px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 13px; border: 1px solid var(--border); border-radius: 4px; background: #0d100e; }
  .kf-tool-card h3 { margin: 0 0 3px; font-size: 11px; }
  .kf-tool-card p { margin: 0; color: var(--muted); font-size: 10px; }
  .kf-channel-input-row { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 9px; align-items: center; }
  .kf-channel-list { display: grid; gap: 6px; margin-top: 10px; max-height: 280px; overflow: auto; scrollbar-gutter: stable; }
  .kf-channel-entry { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 10px; border: 1px solid var(--border-subtle); border-radius: 4px; background: #0a0d0b; font-size: 13px; }
  .kf-channel-entry span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .kf-sticker-library-shell { padding: 14px; border: 1px solid var(--border); border-radius: 4px; background: #0d100e; }
  .kf-sticker-library-controls { display: grid; grid-template-columns: minmax(220px, 1fr) 180px; gap: 9px; }
  .kf-sticker-library-controls .kf-select { width: 100%; height: 40px; }
  .kf-sticker-group-builder { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 9px; margin-top: 9px; }
  .kf-sticker-group-list { display: grid; gap: 7px; margin-top: 10px; }
  .kf-sticker-group-row { display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; gap: 7px; align-items: center; }
  .kf-sticker-group-row .kf-text { min-height: 34px; padding-block: 6px; }
  .kf-sticker-library-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 13px 0 8px; color: var(--muted); font-size: 10px; }
  .kf-sticker-library-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 470px; overflow: auto; padding-right: 4px; scrollbar-gutter: stable; }
  .kf-sticker-library-item { min-width: 0; display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 10px; padding: 9px; border: 1px solid var(--border-subtle); border-radius: 4px; background: #0a0d0b; }
  .kf-sticker-library-item[data-removed="true"] { opacity: .58; }
  .kf-sticker-library-image { width: 52px; height: 52px; display: grid; place-items: center; padding: 5px; border: 1px solid #343a36; border-radius: 4px; background: #151916; }
  .kf-sticker-library-image img { width: 100%; height: 100%; object-fit: contain; }
  .kf-sticker-library-copy { min-width: 0; }
  .kf-sticker-library-copy strong { display: block; overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .kf-sticker-library-copy small { display: block; overflow: hidden; margin-top: 2px; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
  .kf-sticker-access { display: inline-flex; margin-top: 5px; padding: 2px 5px; border: 1px solid #4b534e; border-radius: 3px; color: #b8c0bb; font-size: 8px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
  .kf-sticker-access[data-access="available"] { border-color: rgba(var(--accent-rgb), .55); color: var(--accent); }
  .kf-sticker-access[data-access="observed"] { border-color: rgba(56,215,208,.58); color: #70e9e3; }
  /* Kick edits emotes users already pulled; the local record is the only copy
     that can prove it, so a changed entry is called out rather than quietly
     overwritten. */
  .kf-sticker-changed { display: inline-flex; margin: 5px 0 0 5px; padding: 2px 5px; border: 1px solid rgba(217,139,58,.62); border-radius: 3px; color: #e0a367; font-size: 8px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
  .kf-sticker-library-item[data-changed="true"] { border-color: rgba(217,139,58,.42); }
  /* A favorite saved for this channel only, so it is obvious why it is not
     on the shelf elsewhere. */
  #chat-emotes-picker-panel [data-kf-sticker-item][data-kf-sticker-scoped="true"] .kf-sticker-proxy {
    box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), .5);
  }
  /* A dead greyed tile teaches nothing; a reason plus Kick's own unlock path
     is the clearest possible signal that entitlements are respected. */
  .kf-sticker-lock { display: block; margin-top: 5px; color: var(--muted); font-size: 9px; line-height: 1.5; white-space: normal; }
  .kf-sticker-lock a { color: var(--accent); }
  .kf-sticker-library-actions { grid-column: 1 / -1; display: grid; grid-template-columns: auto auto minmax(105px, 1fr); gap: 6px; }
  .kf-sticker-library-actions .kf-select { min-width: 0; width: 100%; }

  .kf-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .kf-table th, .kf-table td { padding: 11px 9px; border-bottom: 1px solid var(--border-subtle); text-align: left; vertical-align: middle; }
  .kf-table th { color: #aeb7b1; background: transparent; font-size: 9px; letter-spacing: .07em; text-transform: uppercase; }
  .kf-table tr:last-child td { border-bottom: 0; }
  .kf-table .kf-table-actions { text-align: right; }
  .kf-shortcut { display: inline-flex; min-width: 62px; justify-content: center; padding: 4px 8px; border: 1px solid #434a45; border-radius: 3px; background: #171b18; font-weight: 700; }
  .kf-conflict td { background: rgba(255,98,88,.055); border-top: 1px solid var(--danger); border-bottom: 1px solid var(--danger); }
  .kf-conflict-message { color: var(--danger); font-size: 11px; }

  .kf-status-note { margin-top: 12px; padding: 10px 12px; border-left: 2px solid #4b534e; background: rgba(255,255,255,.018); color: var(--muted); font-size: 11px; }
  .kf-status-note[data-drifted="true"] { border-color: #7b5d20; background: rgba(246,185,67,.065); color: #e7c77e; }
  .kf-notice { margin-top: 12px; padding: 11px 13px; border-left: 2px solid #997326; background: rgba(246,185,67,.055); color: #e7c77e; font-size: 11px; }
  .kf-subsection { margin-top: 26px; }
  .kf-subsection-header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 10px; padding-bottom: 11px; border-bottom: 1px solid var(--border); }
  .kf-subsection h3 { margin: 0; font-size: 13px; letter-spacing: .02em; }
  .kf-subsection p { margin: 2px 0 0; color: var(--muted); font-size: 11px; }

  .kf-about-status { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 18px 0; border-bottom: 1px solid var(--border-subtle); }
  .kf-mini-card { padding: 14px; border: 1px solid var(--border); border-radius: 4px; background: #0d100e; }
  .kf-mini-card span { display: block; color: var(--muted); font-size: 9px; letter-spacing: .07em; text-transform: uppercase; }
  .kf-mini-card strong { display: block; margin-top: 4px; color: var(--accent); }
  .kf-action-row { min-height: 78px; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 22px; padding: 14px 0; border-bottom: 1px solid var(--border-subtle); }
  .kf-action-row h3 { margin: 0 0 3px; font-size: 12px; }
  .kf-action-row p { max-width: 520px; margin: 0; color: var(--muted); font-size: 11px; }
  .kf-danger { border-color: rgba(255,98,88,.65) !important; color: #ff8a82 !important; }

  [data-kf-current-page="accessibility"] { padding-top: 14px; }
  [data-kf-current-page="accessibility"] .kf-page-header { min-height: 70px; padding-bottom: 12px; }
  [data-kf-current-page="accessibility"] .kf-row { min-height: 48px; padding: 6px 0; }
  [data-kf-current-page="accessibility"] .kf-subsection { margin-top: 14px; }
  [data-kf-current-page="accessibility"] .kf-subsection-header { margin-bottom: 0; padding-bottom: 8px; }
  [data-kf-current-page="accessibility"] .kf-table th, [data-kf-current-page="accessibility"] .kf-table td { padding-block: 4px; }
  [data-kf-current-page="accessibility"] .kf-button-small { min-height: 28px; }
  [data-kf-current-page="about"] .kf-action-row { min-height: 70px; padding-block: 11px; }
  [data-kf-current-page="about"] .kf-subsection { margin-top: 18px; }
  [data-kf-current-page="about"] .kf-subsection > .kf-panel { overflow: hidden; border: 1px solid var(--border); border-radius: 4px; }

  .kf-button {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 14px;
    border: 1px solid #414843;
    border-radius: 4px;
    background: #171b18;
    color: var(--text);
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
  }
  .kf-button:hover { border-color: #5a645d; background: #1d221e; }
  .kf-button-primary { border-color: var(--accent); background: var(--accent); color: #071004; }
  .kf-button-primary:hover { background: #91ff55; border-color: #91ff55; }
  .kf-button:disabled { opacity: .38; cursor: not-allowed; }
  .kf-button-small { min-height: 32px; padding-inline: 10px; font-size: 11px; }
  .kf-button .kf-icon { width: 16px; height: 16px; }
  .kf-button-group { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }

  .kf-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 22px; border-top: 1px solid var(--border); background: #121512; }
  .kf-footer-left, .kf-footer-right { display: flex; align-items: center; gap: 10px; }

  .kf-confirm {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    background: rgba(2,3,4,.76);
  }
  .kf-confirm-card { width: 430px; padding: 24px; border: 1px solid var(--border); border-radius: 6px; background: #151917; box-shadow: 0 24px 70px rgba(0,0,0,.62); }
  .kf-confirm-card h2 { margin: 0 0 8px; font-size: 19px; }
  .kf-confirm-card p { margin: 0 0 18px; color: var(--muted); }

  .kf-toast {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2147483500;
    max-width: 430px;
    padding: 11px 14px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: #171c19;
    box-shadow: 0 18px 48px rgba(0,0,0,.5);
    color: var(--text);
  }
  .kf-toast[data-error="true"] { border-color: var(--danger); }
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
  .kf-toast-action:hover { background: var(--accent); color: #0b0f0d; }
  .kf-toast-action:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }

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
    border-radius: 10px;
    background: #2a1416;
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
    border-radius: 7px;
    background: #101411;
    box-shadow: 0 32px 90px rgba(0,0,0,.72);
    color: var(--text);
  }
  .kf-command-head { padding: 14px; border-bottom: 1px solid var(--border); }
  .kf-command-head input {
    width: 100%;
    height: 44px;
    padding: 0 13px;
    border: 1px solid #465057;
    border-radius: 4px;
    background: #0b0e0c;
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
    .kf-select:focus,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible,
    button:focus-visible,
    [tabindex]:focus-visible {
      outline: 3px solid Highlight;
      outline-offset: 2px;
    }
    .kf-panel, .kf-settings-shell, .kf-command-shell { border: 1px solid CanvasText; }
    .kf-storage-alert { border: 2px solid CanvasText; }
    /* Forced colors erase custom backgrounds, so every selected/checked/current
       state needs a system-color marker or "on" looks identical to "off". */
    .kf-switch { border: 1px solid CanvasText; }
    .kf-switch[aria-checked="true"] { background: Highlight; }
    .kf-switch[aria-checked="true"]::after { background: Canvas; }
    [aria-checked="true"], [aria-selected="true"], [aria-pressed="true"], [aria-current="page"] {
      outline: 2px solid Highlight;
      outline-offset: 1px;
    }
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
    border-radius: 999px;
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
    background: var(--surface);
    color: var(--text);
  }
  .kf-ms-head, .kf-ms-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: #121512;
    flex-wrap: wrap;
  }
  .kf-ms-foot { border-bottom: 0; border-top: 1px solid var(--border); }
  .kf-ms-spacer { flex: 1; }
  .kf-ms-count { font-size: 11px; opacity: .75; }
  .kf-ms-head input, .kf-ms-foot input {
    min-width: 220px;
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: #0d0f0d;
    color: var(--text);
    font-size: 12px;
  }
  .kf-ms-head input:focus, .kf-ms-foot input:focus { border-color: var(--accent); outline: 0; box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15); }
  .kf-ms-select { min-height: 32px; font-size: 12px; }
  .kf-ms-error { padding: 8px 14px; border-bottom: 1px solid var(--danger); background: #2a1416; font-size: 12px; }
  .kf-ms-error[hidden] { display: none; }

  .kf-ms-body { display: grid; grid-template-columns: 1fr 0; min-height: 0; }
  .kf-ms-backdrop[data-kf-multistream-show-chat="true"] .kf-ms-body { grid-template-columns: 1fr 340px; }
  .kf-ms-grid {
    display: grid;
    grid-template-columns: repeat(var(--kf-multistream-columns, 1), 1fr);
    gap: 4px;
    padding: 4px;
    min-height: 0;
    align-content: stretch;
  }
  .kf-ms-tile {
    position: relative;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    background: #000;
  }
  /* The focused tile owns the audio, so it has to be obvious which one that is. */
  .kf-ms-tile[data-kf-multistream-focused="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  /* A paused grid still shows which channels it holds, so the layout reads as
     intact rather than empty. */
  .kf-ms-backdrop[data-kf-multistream-paused="true"] .kf-ms-tile::after {
    content: attr(data-kf-multistream-tile) " — paused";
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: #0b0d0b;
    color: var(--text-muted);
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
    opacity: 0;
    transition: opacity .12s ease;
    font-size: 11px;
  }
  .kf-ms-tile:hover .kf-ms-bar, .kf-ms-tile:focus-within .kf-ms-bar { opacity: 1; }
  .kf-ms-bar button, .kf-ms-bar .kf-ms-link {
    border: 1px solid rgba(255,255,255,.25);
    border-radius: 4px;
    background: rgba(0,0,0,.55);
    color: #fff;
    padding: 2px 7px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
  }
  .kf-ms-bar button:hover, .kf-ms-bar .kf-ms-link:hover { border-color: var(--accent); color: var(--accent); }
  .kf-ms-tile[data-kf-multistream-focused="true"] .kf-ms-name { border-color: var(--accent); color: var(--accent); }
  .kf-ms-chat { min-width: 0; border-left: 1px solid var(--border); display: grid; grid-template-rows: auto 1fr; }
  .kf-ms-chat iframe { width: 100%; height: 100%; border: 0; display: block; }
  .kf-ms-chat-notice {
    margin: 0;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    background: #121512;
    color: var(--text-muted);
    font-size: 11px;
  }
  .kf-ms-layouts { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .kf-ms-layout { display: inline-flex; }
  .kf-ms-layout button {
    border: 1px solid var(--border);
    background: #0d0f0d;
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
  .kf-ms-empty { font-size: 11px; opacity: .6; }

  .kf-shadow-warning { display: grid; gap: 6px; }
  .kf-shadow-warning code { font-size: 11px; color: var(--accent); }
  .kf-command-list { max-height: 490px; overflow: auto; padding: 8px; }
  .kf-command-item { width: 100%; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 14px; padding: 12px; border: 0; border-left: 2px solid transparent; border-radius: 2px; background: transparent; text-align: left; cursor: pointer; }
  .kf-command-item:hover, .kf-command-item[data-active="true"] { border-left-color: var(--accent); background: rgba(255,255,255,.035); }
  .kf-command-item strong { display: block; margin-bottom: 2px; }
  .kf-command-item span { color: var(--muted); font-size: 12px; }
  .kf-command-empty { padding: 28px; color: var(--muted); text-align: center; }

  .kf-sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0,0,0,0) !important; white-space: nowrap !important; border: 0 !important; }

  :is(button, input):focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

  @media (max-width: 920px) {
    .kf-settings { width: calc(100vw - 28px); height: calc(100vh - 28px); min-width: 0; min-height: 620px; }
    .kf-header { grid-template-columns: 188px 1fr auto auto; gap: 14px; padding-inline: 18px; }
    .kf-body { grid-template-columns: 188px minmax(0, 1fr); }
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
    .kf-sticker-library-controls, .kf-sticker-group-builder, .kf-sticker-group-row, .kf-sticker-library-grid { grid-template-columns: 1fr; }
    .kf-sticker-library-actions { grid-template-columns: repeat(2, auto); }
    .kf-sticker-library-actions .kf-select { grid-column: 1 / -1; }
  }

  @media (max-width: 700px) {
    .kf-backdrop { padding: 0; }
    .kf-settings { width: 100vw; height: 100vh; min-height: 0; grid-template-rows: 66px minmax(0, 1fr) 68px; border: 0; border-radius: 0; }
    .kf-header { grid-template-columns: 1fr auto auto; padding-inline: 14px; }
    .kf-header .kf-title { display: none; }
    .kf-body { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
    .kf-nav { display: flex; overflow-x: auto; padding: 0; border-right: 0; border-bottom: 1px solid var(--border); scrollbar-width: none; overscroll-behavior-inline: contain; }
    .kf-nav::-webkit-scrollbar { display: none; }
    .kf-nav button { width: auto; min-width: max-content; min-height: 54px; padding-inline: 16px; }
    .kf-nav button::before { inset: auto 14px 0; width: auto; height: 3px; }
    .kf-page { padding: 18px 18px 32px; }
    .kf-page-header { min-height: 72px; }
    .kf-page-header h2 { font-size: 23px; }
    .kf-page-meta { display: none; }
    .kf-theme-grid, .kf-swatch-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .kf-appearance-layout { grid-template-columns: 1fr; }
    .kf-preview { position: static; padding: 18px 0 0; border-top: 1px solid var(--border); border-left: 0; }
    .kf-about-status, .kf-stats { grid-template-columns: 1fr; }
    .kf-mini-card, .kf-stat { border-left: 0; border-top: 1px solid var(--border-subtle); }
    .kf-action-row { grid-template-columns: 1fr; }
    .kf-button-group { justify-content: flex-start; }
    .kf-footer { padding-inline: 14px; }
    .kf-footer [data-action="export"] { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
  }
`;

const NAV_ITEMS = [
  ['layout', 'Layout', 'Structure and positioning', 'layout'],
  ['appearance', 'Appearance', 'Themes, colors, and style', 'sliders'],
  ['content', 'Content & Ads', 'Filter and hide elements', 'shield'],
  ['accessibility', 'Accessibility & Shortcuts', 'Shortcuts and accessibility', 'keyboard'],
  ['about', 'About', 'Version, diagnostics, and privacy', 'info'],
];

/*
 * Feather Icons v4.29.0 — https://feathericons.com
 * Copyright (c) 2013-2017 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Paths stay inline so the userscript remains dependency-free.
 */
const FEATHER_ICONS = Object.freeze({
  layout: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="9" y1="9" x2="21" y2="9"></line>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
  keyboard: '<rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="6" y1="8" x2="6" y2="8"></line><line x1="10" y1="8" x2="10" y2="8"></line><line x1="14" y1="8" x2="14" y2="8"></line><line x1="18" y1="8" x2="18" y2="8"></line><line x1="6" y1="12" x2="6" y2="12"></line><line x1="10" y1="12" x2="10" y2="12"></line><line x1="14" y1="12" x2="14" y2="12"></line><line x1="18" y1="12" x2="18" y2="12"></line><line x1="7" y1="16" x2="17" y2="16"></line>',
  info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
  close: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
  reset: '<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-9.5L1 10"></path>',
  export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>',
  check: '<polyline points="20 6 9 17 4 12"></polyline>',
});

function uiIcon(name) {
  return `<svg class="kf-icon" aria-hidden="true" viewBox="0 0 24 24">${FEATHER_ICONS[name] || FEATHER_ICONS.info}</svg>`;
}

const TRANSLATIONS = {
  es: {
    'Settings': 'Configuración',
    'Autosaved': 'Guardado automático',
    'Close settings': 'Cerrar configuración',
    'Reset page': 'Restablecer página',
    'Export settings': 'Exportar configuración',
    'Done': 'Listo',
    'Reset settings?': '¿Restablecer configuración?',
    'Reset all Kick Focus settings?': '¿Restablecer toda la configuración de Kick Focus?',
    'This restores the defaults for this page.': 'Esto restaura los valores predeterminados de esta página.',
    'Every preference, shortcut, note, filter, and channel list returns to its factory default. Your recorded emote library is kept.': 'Todas las preferencias, atajos, notas, filtros y listas de canales volverán a sus valores de fábrica. Tu biblioteca de emotes registrada se conserva.',
    'Only the settings on this page will return to their defaults.': 'Solo la configuración de esta página volverá a sus valores predeterminados.',
    'Cancel': 'Cancelar',
    'Reset': 'Restablecer',
    'Filter commands…': 'Filtrar comandos…',
    'Open Kick Focus command menu': 'Abrir menú de comandos de Kick Focus',
    'Focus': 'Enfoque',
    'Resume': 'Reanudar',
    'Resume Kick Focus': 'Reanudar Kick Focus',
    'Kick Focus settings': 'Configuración de Kick Focus',
    'Layout': 'Diseño',
    'Structure and positioning': 'Estructura y posición',
    'Appearance': 'Apariencia',
    'Themes, colors, and style': 'Temas, colores y estilo',
    'Content & Ads': 'Contenido y anuncios',
    'Filter and hide elements': 'Filtrar y ocultar elementos',
    'Accessibility & Shortcuts': 'Accesibilidad y atajos',
    'Shortcuts and accessibility': 'Atajos y accesibilidad',
    'About': 'Acerca de',
    'Version, diagnostics, and privacy': 'Versión, diagnósticos y privacidad',
    'Control how Kick is arranged across your desktop.': 'Controla cómo se organiza Kick en tu escritorio.',
    'Choose how the left discovery rail behaves.': 'Elige cómo funciona la barra de descubrimiento izquierda.',
    'Choose the overall surface treatment.': 'Elige el tratamiento general de las superficies.',
    'Set a premium visual style without replacing Kick’s identity.': 'Define un estilo visual premium sin reemplazar la identidad de Kick.',
    'Keep the page calm, private, and focused on streams.': 'Mantén la página tranquila, privada y centrada en los streams.',
    'Improve comfort and keep core actions within reach.': 'Mejora la comodidad y mantén las acciones principales al alcance.',
    'A desktop-first layout and control layer for Kick.': 'Una capa de diseño y control para Kick pensada para escritorio.',
    'Language': 'Idioma',
    'Choose the language for Kick Focus settings and commands.': 'Elige el idioma de la configuración y los comandos de Kick Focus.',
    'Auto': 'Automático',
    // Language names stay as endonyms in every locale: a picker that renames
    // "Português" to "Portugués" is harder to use, not easier.
    'Sidebar mode': 'Modo de barra lateral',
    'Chat layout': 'Diseño del chat',
    'Chat width': 'Ancho del chat',
    'Content density': 'Densidad del contenido',
    'Stream start behavior': 'Comportamiento al abrir streams',
    'Remember per-channel layout': 'Recordar diseño por canal',
    'Widen browse grids': 'Ampliar cuadrículas de exploración',
    'Show Following rail': 'Mostrar barra de seguidos',
    'Show Recommended rail': 'Mostrar barra recomendada',
    'Sticky compact top bar': 'Barra superior compacta fija',
    'Show quick command button': 'Mostrar botón de comandos',
    'Move mini-player clear of controls': 'Mover el minirreproductor lejos de los controles',
    'Recover player after resize': 'Recuperar el reproductor tras cambiar el tamaño',
    'Keep ultrawide video uncropped': 'Mantener el video panorámico sin recortar',
    'Premium stream card preview': 'Vista previa premium de tarjeta de stream',
    'Clear hierarchy, restrained motion, and one consistent accent.': 'Jerarquía clara, movimiento moderado y un solo acento consistente.',
    'Theme': 'Tema',
    'Accent color': 'Color de acento',
    'Corner radius': 'Radio de esquinas',
    'Thumbnail treatment': 'Tratamiento de miniaturas',
    'Interface scale': 'Escala de la interfaz',
    'Dim watched cards': 'Atenuar tarjetas vistas',
    'Strengthen text contrast': 'Aumentar contraste del texto',
    'Colorize live indicators': 'Colorear indicadores en vivo',
    'Ad defense active': 'Defensa contra anuncios activa',
    'Network + page': 'Red + página',
    'Page only': 'Solo página',
    'Local channel tools': 'Herramientas locales del canal',
    'Favorites, not-interested choices, keywords, and notes stay on this device.': 'Favoritos, opciones de no me interesa, palabras clave y notas permanecen en este dispositivo.',
    'Clear favorites': 'Borrar favoritos',
    'Clear not-interested': 'Borrar no me interesa',
    'Protection log': 'Registro de protección',
    'Reduce motion': 'Reducir movimiento',
    'High-contrast controls': 'Controles de alto contraste',
    'Always show keyboard focus': 'Mostrar siempre el foco del teclado',
    'Larger pointer targets': 'Objetivos táctiles más grandes',
    'Announce layout changes': 'Anunciar cambios de diseño',
    'Text size': 'Tamaño del texto',
    'Caption background opacity': 'Opacidad del fondo de subtítulos',
    'Keyboard shortcuts': 'Atajos de teclado',
    'Restore defaults': 'Restaurar valores predeterminados',
    'Action': 'Acción',
    'Current shortcut': 'Atajo actual',
    'Status': 'Estado',
    'Change': 'Cambiar',
    'Script health': 'Estado del script',
    'Site compatibility': 'Compatibilidad del sitio',
    'Protection layer': 'Capa de protección',
    'Data & privacy': 'Datos y privacidad',
    'Diagnostics': 'Diagnósticos',
    'Copy diagnostic summary': 'Copiar resumen de diagnóstico',
    'Run self-check': 'Ejecutar autocomprobación',
    'Compatibility self-test': 'Autocomprobación de compatibilidad',
    'Settings portability': 'Portabilidad de configuración',
    'Import settings': 'Importar configuración',
    'Reset all settings': 'Restablecer toda la configuración',
    'Panic switch': 'Interruptor de emergencia',
    'Pause Kick Focus': 'Pausar Kick Focus',
    'Restore Kick Focus': 'Restaurar Kick Focus',
    'Temporarily remove enhanced layout and request hooks': 'Quita temporalmente el diseño mejorado y los interceptores',
    'Enter focus mode': 'Entrar en modo enfoque',
    'Exit focus mode': 'Salir del modo enfoque',
    'Maximize the stream and hide side panels': 'Maximiza el stream y oculta los paneles laterales',
    'Enter theater mode': 'Entrar en modo teatro',
    'Exit theater mode': 'Salir del modo teatro',
    'Hide discovery while keeping chat': 'Oculta el descubrimiento y conserva el chat',
    'Show chat': 'Mostrar chat',
    'Hide chat': 'Ocultar chat',
    'Toggle the chat panel for this session': 'Alterna el panel de chat durante esta sesión',
    'Show sidebar': 'Mostrar barra lateral',
    'Hide sidebar': 'Ocultar barra lateral',
    'Toggle the discovery rail for this session': 'Alterna la barra de descubrimiento durante esta sesión',
    'Blur mature thumbnails': 'Desenfocar miniaturas maduras',
    'Reveal mature thumbnails': 'Mostrar miniaturas maduras',
    'Temporarily override mature-card blur': 'Anula temporalmente el desenfoque de tarjetas maduras',
    'Use comfortable density': 'Usar densidad cómoda',
    'Use compact density': 'Usar densidad compacta',
    'Change discovery spacing and save it': 'Cambia y guarda el espaciado del descubrimiento',
    'New favorites apply to': 'Los nuevos favoritos se aplican a',
    'Global favorites follow you everywhere. Per-channel favorites appear only on the channel you saved them from, above your global ones. Existing favorites are global and are not moved.': 'Los favoritos globales te acompañan en todas partes. Los favoritos por canal solo aparecen en el canal donde los guardaste, encima de los globales. Los favoritos existentes son globales y no se mueven.',
    'Everywhere': 'En todas partes',
    'This channel': 'Este canal',
    'Show badges Kick leaves out': 'Mostrar insignias que Kick omite',
    'Kick’s chat payload carries collectible and global badges its own markup omits, leaving a gap where other clients show a badge. A badge image that fails to load is replaced by its name.': 'La respuesta del chat de Kick incluye insignias globales y de coleccionables que su propio marcado omite, dejando un hueco donde otros clientes muestran una insignia. Si la imagen no carga, se sustituye por su nombre.',
    'Hidden channels': 'Canales ocultos',
    'Hide specific channels from Home, Browse, Following, and Search.': 'Oculta canales específicos de Inicio, Explorar, Siguiendo y Búsqueda.',
    'No channels hidden. Use the input above or the ✕ action on a card.': 'No hay canales ocultos. Usa el campo de arriba o la acción ✕ en una tarjeta.',
    'Show casino content': 'Mostrar contenido de casino',
    'Hide casino content': 'Ocultar contenido de casino',
    'Filter clearly labeled casino streams': 'Filtra streams marcados claramente como casino',
    'Open Kick Focus settings': 'Abrir configuración de Kick Focus',
    'Customize layout, appearance, content, and access': 'Personaliza el diseño, la apariencia, el contenido y el acceso',
    'No matching commands.': 'No hay comandos coincidentes.',
    'Choose how the left discovery rail behaves. Dropdown collapses it to a tab that expands on hover, giving the grid full width. Desktop widths only.': 'Elige cómo se comporta la barra de descubrimiento izquierda. Desplegable la reduce a una pestaña que se expande al pasar el cursor, dando a la cuadrícula todo el ancho. Solo en anchos de escritorio.',
    'Keep chat on the right, float it as a dock, or hide it.': 'Mantén el chat a la derecha, flotante como panel, u ocúltalo.',
    'Set the width of the live chat column.': 'Define el ancho de la columna del chat en vivo.',
    'Adjust spacing and padding across discovery pages.': 'Ajusta el espaciado y el relleno en las páginas de descubrimiento.',
    'Choose how each channel opens.': 'Elige cómo se abre cada canal.',
    'Keep the last runtime layout for each channel.': 'Conserva el último diseño usado en cada canal.',
    'Use reclaimed sidebar space for larger, calmer stream cards.': 'Usa el espacio recuperado de la barra lateral para tarjetas de directo más grandes y tranquilas.',
    'Keep the Following discovery rail visible when Kick provides it.': 'Mantén visible la barra de canales seguidos cuando Kick la ofrezca.',
    'Keep recommended stream rows visible in the main content.': 'Mantén visibles las filas de directos recomendados en el contenido principal.',
    'Keep search and account controls available while browsing.': 'Mantén disponibles la búsqueda y los controles de cuenta mientras navegas.',
    'Keep the Focus control beside Get KICKs in Kick’s top header.': 'Mantén el control de Focus junto a Get KICKs en la cabecera superior de Kick.',
    'Raise Kick’s embedded mini-player only when the Focus control has to use its floating fallback.': 'Eleva el mini-reproductor integrado de Kick solo cuando el control de Focus deba usar su alternativa flotante.',
    'Re-apply player geometry after a window or monitor change.': 'Vuelve a aplicar la geometría del reproductor tras cambiar de ventana o monitor.',
    'Prefer contained video geometry on wide or moved displays.': 'Prefiere una geometría de vídeo contenida en pantallas anchas o desplazadas.',
    'Adjust the roundness of enhanced UI.': 'Ajusta el redondeo de la interfaz mejorada.',
    'Adjust stream-card color intensity.': 'Ajusta la intensidad de color de las tarjetas de directo.',
    'Set the size of Kick Focus controls.': 'Define el tamaño de los controles de Kick Focus.',
    'Reduce emphasis on streams you have already opened.': 'Reduce el énfasis en los directos que ya has abierto.',
    'Increase legibility on muted surfaces.': 'Aumenta la legibilidad en superficies atenuadas.',
    'Use the selected accent for live-state emphasis.': 'Usa el color de acento elegido para destacar el estado en directo.',
    'Enable subscription': 'Activar suscripción',
    'Off by default. When enabled, refreshes only over HTTPS with credentials omitted.': 'Desactivado por defecto. Si se activa, solo se actualiza por HTTPS y sin enviar credenciales.',
    'Refresh interval': 'Intervalo de actualización',
    'Keep the last valid payload if a later request fails.': 'Conserva el último contenido válido si una petición posterior falla.',
    'Load the emote catalog from Kick': 'Cargar el catálogo de emotes desde Kick',
    'Read the full channel, global, and emoji sets with their real entitlement, instead of scraping the picker. Falls back to the picker if the response changes shape.': 'Lee los conjuntos completos del canal, globales y de emojis con sus permisos reales, en vez de rastrear el selector. Vuelve al selector si la respuesta cambia de forma.',
    'Follow live chat events': 'Seguir los eventos del chat en vivo',
    'Subscribe to the same realtime chat feed Kick’s own client uses. The provider is read from Kick rather than hardcoded.': 'Suscríbete al mismo flujo de chat en tiempo real que usa el cliente de Kick. El proveedor se lee desde Kick en lugar de estar fijado en el código.',
    'Explain removed messages': 'Explicar los mensajes eliminados',
    'Kick’s automatic moderation removes messages without saying why. The realtime event carries the reason; the page does not.': 'La moderación automática de Kick elimina mensajes sin decir por qué. El evento en tiempo real lleva el motivo; la página no.',
    'Count emote usage': 'Contar el uso de emotes',
    'Kick’s own “Frequently Used” never counts anything, so no real ranking exists. This one is yours, stored locally and exported with your library.': 'La sección “Usados con frecuencia” de Kick nunca cuenta nada, así que no existe una clasificación real. Esta es tuya, guardada localmente y exportada con tu biblioteca.',
    'Show collectible rarity': 'Mostrar la rareza de los coleccionables',
    'Kick publishes rarity on card art and identity in the picker, with no key joining them. Rarity is shown only where the match is confident.': 'Kick publica la rareza en la ilustración de la carta y la identidad en el selector, sin ninguna clave que las una. La rareza solo se muestra cuando la coincidencia es fiable.',
    'Warn about shadowed emote names': 'Avisar de nombres de emote duplicados',
    'Subscriber emotes work in every chat and Kick resolves typed names through one map, so two channels sharing a name means one silently sends the other’s.': 'Los emotes de suscriptor funcionan en todos los chats y Kick resuelve los nombres escritos con un único mapa, así que si dos canales comparten un nombre, uno envía en silencio el del otro.',
    'Render animated emotes and collectibles as a single static frame, in chat and in the picker. Applied automatically when your system asks for reduced motion.': 'Muestra los emotes animados y los coleccionables como un único fotograma fijo, en el chat y en el selector. Se aplica automáticamente si tu sistema pide movimiento reducido.',
    'Block separable ad requests': 'Bloquear las peticiones de anuncios separables',
    'Intercept known ad hosts at the earliest userscript-supported page layer.': 'Intercepta los servidores de anuncios conocidos en la capa más temprana que permite un userscript.',
    'Remove ad containers': 'Eliminar los contenedores de anuncios',
    'Remove empty ad containers and reinjected ad frames.': 'Elimina los contenedores de anuncios vacíos y los marcos reinsertados.',
    'Suppress sponsored and promoted cards': 'Ocultar las tarjetas patrocinadas y promocionadas',
    'Hide clearly labeled promotional cards and modules.': 'Oculta las tarjetas y módulos claramente marcados como promocionales.',
    'Pause home-page autoplay': 'Pausar la reproducción automática de la página de inicio',
    'Keep background Home previews silent and paused; deliberate playback remains available.': 'Mantiene en silencio y en pausa las vistas previas de fondo del inicio; la reproducción deliberada sigue disponible.',
    'Hide Slots & Casino content': 'Ocultar contenido de Slots y Casino',
    'Hide cards and sidebar entries clearly labeled as casino content.': 'Oculta las tarjetas y entradas de la barra lateral marcadas claramente como contenido de casino.',
    'Blur marked mature cards until hover or keyboard focus.': 'Difumina las tarjetas marcadas para adultos hasta pasar el cursor o enfocarlas con el teclado.',
    'Hide Drops and gambling promotions': 'Ocultar promociones de Drops y apuestas',
    'Hide clearly labeled Drops and gambling promotion modules.': 'Oculta los módulos claramente marcados como promociones de Drops y apuestas.',
    'Reduce tracking telemetry': 'Reducir la telemetría de seguimiento',
    'Block observed third-party video and error telemetry hosts.': 'Bloquea los servidores de telemetría de vídeo y errores de terceros detectados.',
    'Remember volume locally': 'Recordar el volumen localmente',
    'Restore each channel’s volume and mute state from local storage.': 'Restaura el volumen y el estado de silencio de cada canal desde el almacenamiento local.',
    'Remember quality locally': 'Recordar la calidad localmente',
    'Restore a matching quality control when Kick exposes one.': 'Restaura el control de calidad correspondiente cuando Kick lo ofrece.',
    'Remember VOD position locally': 'Recordar la posición del VOD localmente',
    'Resume finite VODs from the last local playback position.': 'Reanuda los VOD finitos desde la última posición de reproducción local.',
    'Pause chat updates': 'Pausar las actualizaciones del chat',
    'Freeze the visible chat scroll with an accessible resume control.': 'Congela el desplazamiento visible del chat con un control accesible para reanudarlo.',
    'Organize chat emotes': 'Organizar los emotes del chat',
    'Continuously record emotes from live chat and Kick’s picker, then add favorites, removals, search, and custom groups.': 'Registra continuamente los emotes del chat en vivo y del selector de Kick, y añade favoritos, eliminaciones, búsqueda y grupos personalizados.',
    'Highlight chat keywords': 'Resaltar palabras clave del chat',
    'Use the per-channel keyword list below without sending it anywhere.': 'Usa la lista de palabras clave por canal de abajo sin enviarla a ningún sitio.',
    'Show playback diagnostics': 'Mostrar diagnósticos de reproducción',
    'Show ready state, buffered seconds, and dropped-frame counts on a channel.': 'Muestra el estado de preparación, los segundos en búfer y los fotogramas perdidos en un canal.',
    'Start playback without waiting for blocked ad scripts': 'Iniciar la reproducción sin esperar a los scripts de anuncios bloqueados',
    'Kick waits on Google PAL, Datazoom, and OM before requesting playback. Blocking them — which this build does — leaves the dead script in the page and the player waits out the full timeout. Removing it lets playback start immediately.': 'Kick espera a Google PAL, Datazoom y OM antes de pedir la reproducción. Bloquearlos —lo que hace esta versión— deja el script muerto en la página y el reproductor agota todo el tiempo de espera. Quitarlo permite que la reproducción empiece de inmediato.',
    'Minimize non-essential animations and transitions.': 'Minimiza las animaciones y transiciones no esenciales.',
    'Increase separation for controls, borders, and surfaces.': 'Aumenta la separación de controles, bordes y superficies.',
    'Keep a strong outline for keyboard navigation.': 'Mantiene un contorno marcado para la navegación con teclado.',
    'Increase the minimum height of interactive controls.': 'Aumenta la altura mínima de los controles interactivos.',
    'Report view changes to assistive technology.': 'Informa de los cambios de vista a las tecnologías de asistencia.',
    'Scale text in the main Kick content area.': 'Escala el texto en el área de contenido principal de Kick.',
    'Set the preferred caption background strength.': 'Define la intensidad preferida del fondo de los subtítulos.',
    'Multi-stream opened': 'Multitransmisión abierta',
    'Watch several Kick channels in one grid': 'Mira varios canales de Kick en una sola cuadrícula',
    'Freeze animated emotes': 'Congelar los emotes animados',
    'Read-only here. Kick blocks sending from an embedded chat; open the channel to talk.': 'Solo lectura aquí. Kick impide enviar desde un chat incrustado; abre el canal para hablar.',
  },
  pt: {
    'Settings': 'Configurações',
    'Autosaved': 'Salvo automaticamente',
    'Close settings': 'Fechar configurações',
    'Reset page': 'Redefinir página',
    'Export settings': 'Exportar configurações',
    'Done': 'Concluído',
    'Reset settings?': 'Redefinir configurações?',
    'Reset all Kick Focus settings?': 'Redefinir todas as configurações do Kick Focus?',
    'This restores the defaults for this page.': 'Isso restaura os padrões desta página.',
    'Every preference, shortcut, note, filter, and channel list returns to its factory default. Your recorded emote library is kept.': 'Todas as preferências, atalhos, notas, filtros e listas de canais voltam ao padrão de fábrica. Sua biblioteca de emotes registrada é mantida.',
    'Only the settings on this page will return to their defaults.': 'Somente as configurações desta página voltarão aos padrões.',
    'Cancel': 'Cancelar',
    'Reset': 'Redefinir',
    'Filter commands…': 'Filtrar comandos…',
    'Open Kick Focus command menu': 'Abrir menu de comandos do Kick Focus',
    'Focus': 'Foco',
    'Resume': 'Retomar',
    'Resume Kick Focus': 'Retomar Kick Focus',
    'Kick Focus settings': 'Configurações do Kick Focus',
    'Layout': 'Layout',
    'Structure and positioning': 'Estrutura e posicionamento',
    'Appearance': 'Aparência',
    'Themes, colors, and style': 'Temas, cores e estilo',
    'Content & Ads': 'Conteúdo e anúncios',
    'Filter and hide elements': 'Filtrar e ocultar elementos',
    'Accessibility & Shortcuts': 'Acessibilidade e atalhos',
    'Shortcuts and accessibility': 'Atalhos e acessibilidade',
    'About': 'Sobre',
    'Version, diagnostics, and privacy': 'Versão, diagnósticos e privacidade',
    'Control how Kick is arranged across your desktop.': 'Controle como o Kick é organizado na sua área de trabalho.',
    'Choose the overall surface treatment.': 'Escolha o tratamento geral das superfícies.',
    'Set a premium visual style without replacing Kick’s identity.': 'Defina um estilo visual premium sem substituir a identidade do Kick.',
    'Keep the page calm, private, and focused on streams.': 'Mantenha a página calma, privada e focada nas transmissões.',
    'Choose how the left discovery rail behaves.': 'Escolha como a barra lateral de descoberta se comporta.',
    'Improve comfort and keep core actions within reach.': 'Melhore o conforto e mantenha as ações principais ao alcance.',
    'A desktop-first layout and control layer for Kick.': 'Uma camada de layout e controle para Kick pensada para desktop.',
    'Language': 'Idioma',
    'Choose the language for Kick Focus settings and commands.': 'Escolha o idioma das configurações e comandos do Kick Focus.',
    'Auto': 'Automático',
    // Endonyms; see the note in the Spanish dictionary.
    'Sidebar mode': 'Modo da barra lateral',
    'Chat layout': 'Layout do chat',
    'Chat width': 'Largura do chat',
    'Content density': 'Densidade do conteúdo',
    'Stream start behavior': 'Comportamento ao abrir transmissões',
    'Remember per-channel layout': 'Lembrar layout por canal',
    'Widen browse grids': 'Ampliar grades de descoberta',
    'Show Following rail': 'Mostrar barra de Seguindo',
    'Show Recommended rail': 'Mostrar barra de Recomendados',
    'Sticky compact top bar': 'Barra superior compacta fixa',
    'Show quick command button': 'Mostrar botão de comandos',
    'Move mini-player clear of controls': 'Mover miniplayer para longe dos controles',
    'Recover player after resize': 'Recuperar player após redimensionar',
    'Keep ultrawide video uncropped': 'Manter vídeo ultrawide sem corte',
    'Premium stream card preview': 'Prévia premium de cartão de transmissão',
    'Clear hierarchy, restrained motion, and one consistent accent.': 'Hierarquia clara, movimento discreto e um único destaque consistente.',
    'Theme': 'Tema',
    'Accent color': 'Cor de destaque',
    'Corner radius': 'Raio dos cantos',
    'Thumbnail treatment': 'Tratamento das miniaturas',
    'Interface scale': 'Escala da interface',
    'Dim watched cards': 'Atenuar cartões assistidos',
    'Strengthen text contrast': 'Aumentar contraste do texto',
    'Colorize live indicators': 'Colorir indicadores ao vivo',
    'Ad defense active': 'Defesa contra anúncios ativa',
    'Network + page': 'Rede + página',
    'Page only': 'Somente página',
    'Local channel tools': 'Ferramentas locais do canal',
    'Favorites, not-interested choices, keywords, and notes stay on this device.': 'Favoritos, opções de não tenho interesse, palavras-chave e notas ficam neste dispositivo.',
    'Clear favorites': 'Limpar favoritos',
    'Clear not-interested': 'Limpar não tenho interesse',
    'Protection log': 'Registro de proteção',
    'Reduce motion': 'Reduzir movimento',
    'High-contrast controls': 'Controles de alto contraste',
    'Always show keyboard focus': 'Sempre mostrar foco do teclado',
    'Larger pointer targets': 'Alvos de ponteiro maiores',
    'Announce layout changes': 'Anunciar mudanças de layout',
    'Text size': 'Tamanho do texto',
    'Caption background opacity': 'Opacidade do fundo das legendas',
    'Keyboard shortcuts': 'Atalhos de teclado',
    'Restore defaults': 'Restaurar padrões',
    'Action': 'Ação',
    'Current shortcut': 'Atalho atual',
    'Status': 'Status',
    'Change': 'Alterar',
    'Script health': 'Saúde do script',
    'Site compatibility': 'Compatibilidade do site',
    'Protection layer': 'Camada de proteção',
    'Data & privacy': 'Dados e privacidade',
    'Diagnostics': 'Diagnósticos',
    'Copy diagnostic summary': 'Copiar resumo de diagnóstico',
    'Run self-check': 'Executar autoteste',
    'Compatibility self-test': 'Autoteste de compatibilidade',
    'Settings portability': 'Portabilidade das configurações',
    'Import settings': 'Importar configurações',
    'Reset all settings': 'Redefinir todas as configurações',
    'Panic switch': 'Interruptor de emergência',
    'Pause Kick Focus': 'Pausar Kick Focus',
    'Restore Kick Focus': 'Restaurar Kick Focus',
    'Temporarily remove enhanced layout and request hooks': 'Remove temporariamente o layout aprimorado e os interceptadores',
    'Enter focus mode': 'Entrar no modo foco',
    'Exit focus mode': 'Sair do modo foco',
    'Maximize the stream and hide side panels': 'Maximiza a transmissão e oculta os painéis laterais',
    'Enter theater mode': 'Entrar no modo teatro',
    'Exit theater mode': 'Sair do modo teatro',
    'Hide discovery while keeping chat': 'Oculta a descoberta mantendo o chat',
    'Show chat': 'Mostrar chat',
    'Hide chat': 'Ocultar chat',
    'Toggle the chat panel for this session': 'Alterna o painel de chat nesta sessão',
    'Show sidebar': 'Mostrar barra lateral',
    'Hide sidebar': 'Ocultar barra lateral',
    'Toggle the discovery rail for this session': 'Alterna a barra de descoberta nesta sessão',
    'Blur mature thumbnails': 'Desfocar miniaturas maduras',
    'Reveal mature thumbnails': 'Revelar miniaturas maduras',
    'Temporarily override mature-card blur': 'Substitui temporariamente o desfoque de cartões maduros',
    'Use comfortable density': 'Usar densidade confortável',
    'Use compact density': 'Usar densidade compacta',
    'Change discovery spacing and save it': 'Altera e salva o espaçamento da descoberta',
    'New favorites apply to': 'Novos favoritos se aplicam a',
    'Global favorites follow you everywhere. Per-channel favorites appear only on the channel you saved them from, above your global ones. Existing favorites are global and are not moved.': 'Os favoritos globais acompanham você em todos os lugares. Os favoritos por canal aparecem apenas no canal onde foram salvos, acima dos globais. Os favoritos existentes são globais e não são movidos.',
    'Everywhere': 'Em todos os lugares',
    'This channel': 'Este canal',
    'Show badges Kick leaves out': 'Mostrar selos que o Kick omite',
    'Kick’s chat payload carries collectible and global badges its own markup omits, leaving a gap where other clients show a badge. A badge image that fails to load is replaced by its name.': 'A resposta do chat do Kick traz selos globais e de colecionáveis que a própria marcação omite, deixando uma lacuna onde outros clientes mostram um selo. Se a imagem não carregar, ela é substituída pelo nome.',
    'Hidden channels': 'Canais ocultos',
    'Hide specific channels from Home, Browse, Following, and Search.': 'Oculte canais específicos de Início, Explorar, Seguindo e Busca.',
    'No channels hidden. Use the input above or the ✕ action on a card.': 'Nenhum canal oculto. Use o campo acima ou a ação ✕ em um card.',
    'Show casino content': 'Mostrar conteúdo de cassino',
    'Hide casino content': 'Ocultar conteúdo de cassino',
    'Filter clearly labeled casino streams': 'Filtra transmissões claramente marcadas como cassino',
    'Open Kick Focus settings': 'Abrir configurações do Kick Focus',
    'Customize layout, appearance, content, and access': 'Personalize layout, aparência, conteúdo e acesso',
    'No matching commands.': 'Nenhum comando correspondente.',
    'Choose how the left discovery rail behaves. Dropdown collapses it to a tab that expands on hover, giving the grid full width. Desktop widths only.': 'Escolha como a barra lateral de descoberta se comporta. Suspensa reduz a barra a uma aba que se expande ao passar o cursor, dando à grade toda a largura. Apenas em larguras de desktop.',
    'Keep chat on the right, float it as a dock, or hide it.': 'Mantenha o chat à direita, flutuante como painel, ou oculte-o.',
    'Set the width of the live chat column.': 'Defina a largura da coluna do chat ao vivo.',
    'Adjust spacing and padding across discovery pages.': 'Ajuste o espaçamento e o preenchimento nas páginas de descoberta.',
    'Choose how each channel opens.': 'Escolha como cada canal abre.',
    'Keep the last runtime layout for each channel.': 'Mantenha o último layout usado em cada canal.',
    'Use reclaimed sidebar space for larger, calmer stream cards.': 'Use o espaço recuperado da barra lateral para cartões de transmissão maiores e mais calmos.',
    'Keep the Following discovery rail visible when Kick provides it.': 'Mantenha a barra de canais seguidos visível quando o Kick a fornecer.',
    'Keep recommended stream rows visible in the main content.': 'Mantenha as linhas de transmissões recomendadas visíveis no conteúdo principal.',
    'Keep search and account controls available while browsing.': 'Mantenha a busca e os controles de conta disponíveis enquanto navega.',
    'Keep the Focus control beside Get KICKs in Kick’s top header.': 'Mantenha o controle do Focus ao lado de Get KICKs no cabeçalho superior do Kick.',
    'Raise Kick’s embedded mini-player only when the Focus control has to use its floating fallback.': 'Eleve o mini-player integrado do Kick apenas quando o controle do Focus precisar usar sua alternativa flutuante.',
    'Re-apply player geometry after a window or monitor change.': 'Reaplique a geometria do player após uma mudança de janela ou monitor.',
    'Prefer contained video geometry on wide or moved displays.': 'Prefira uma geometria de vídeo contida em telas largas ou deslocadas.',
    'Adjust the roundness of enhanced UI.': 'Ajuste o arredondamento da interface aprimorada.',
    'Adjust stream-card color intensity.': 'Ajuste a intensidade de cor dos cartões de transmissão.',
    'Set the size of Kick Focus controls.': 'Defina o tamanho dos controles do Kick Focus.',
    'Reduce emphasis on streams you have already opened.': 'Reduza o destaque das transmissões que você já abriu.',
    'Increase legibility on muted surfaces.': 'Aumente a legibilidade em superfícies atenuadas.',
    'Use the selected accent for live-state emphasis.': 'Use a cor de destaque escolhida para enfatizar o estado ao vivo.',
    'Enable subscription': 'Ativar assinatura',
    'Off by default. When enabled, refreshes only over HTTPS with credentials omitted.': 'Desativado por padrão. Quando ativado, atualiza apenas por HTTPS e sem enviar credenciais.',
    'Refresh interval': 'Intervalo de atualização',
    'Keep the last valid payload if a later request fails.': 'Mantenha o último conteúdo válido se uma requisição posterior falhar.',
    'Load the emote catalog from Kick': 'Carregar o catálogo de emotes do Kick',
    'Read the full channel, global, and emoji sets with their real entitlement, instead of scraping the picker. Falls back to the picker if the response changes shape.': 'Lê os conjuntos completos do canal, globais e de emojis com suas permissões reais, em vez de raspar o seletor. Volta ao seletor se a resposta mudar de formato.',
    'Follow live chat events': 'Acompanhar os eventos do chat ao vivo',
    'Subscribe to the same realtime chat feed Kick’s own client uses. The provider is read from Kick rather than hardcoded.': 'Assine o mesmo fluxo de chat em tempo real que o cliente do Kick usa. O provedor é lido do Kick em vez de estar fixo no código.',
    'Explain removed messages': 'Explicar as mensagens removidas',
    'Kick’s automatic moderation removes messages without saying why. The realtime event carries the reason; the page does not.': 'A moderação automática do Kick remove mensagens sem dizer por quê. O evento em tempo real carrega o motivo; a página não.',
    'Count emote usage': 'Contar o uso de emotes',
    'Kick’s own “Frequently Used” never counts anything, so no real ranking exists. This one is yours, stored locally and exported with your library.': 'A seção “Usados com frequência” do Kick nunca conta nada, então não existe uma classificação real. Esta é sua, guardada localmente e exportada com sua biblioteca.',
    'Show collectible rarity': 'Mostrar a raridade dos colecionáveis',
    'Kick publishes rarity on card art and identity in the picker, with no key joining them. Rarity is shown only where the match is confident.': 'O Kick publica a raridade na arte da carta e a identidade no seletor, sem nenhuma chave que as una. A raridade só aparece quando a correspondência é confiável.',
    'Warn about shadowed emote names': 'Avisar sobre nomes de emote duplicados',
    'Subscriber emotes work in every chat and Kick resolves typed names through one map, so two channels sharing a name means one silently sends the other’s.': 'Os emotes de assinante funcionam em todos os chats e o Kick resolve os nomes digitados por um único mapa, então se dois canais compartilham um nome, um envia silenciosamente o do outro.',
    'Freeze animated emotes': 'Congelar os emotes animados',
    'Render animated emotes and collectibles as a single static frame, in chat and in the picker. Applied automatically when your system asks for reduced motion.': 'Exibe os emotes animados e os colecionáveis como um único quadro estático, no chat e no seletor. Aplicado automaticamente quando seu sistema pede movimento reduzido.',
    'Block separable ad requests': 'Bloquear as requisições de anúncios separáveis',
    'Intercept known ad hosts at the earliest userscript-supported page layer.': 'Intercepta os servidores de anúncios conhecidos na camada mais inicial que um userscript permite.',
    'Remove ad containers': 'Remover os contêineres de anúncios',
    'Remove empty ad containers and reinjected ad frames.': 'Remove os contêineres de anúncios vazios e os quadros reinseridos.',
    'Suppress sponsored and promoted cards': 'Ocultar os cartões patrocinados e promovidos',
    'Hide clearly labeled promotional cards and modules.': 'Oculta os cartões e módulos claramente marcados como promocionais.',
    'Pause home-page autoplay': 'Pausar a reprodução automática da página inicial',
    'Keep background Home previews silent and paused; deliberate playback remains available.': 'Mantém as prévias de fundo da página inicial silenciadas e pausadas; a reprodução deliberada continua disponível.',
    'Hide Slots & Casino content': 'Ocultar conteúdo de Slots e Cassino',
    'Hide cards and sidebar entries clearly labeled as casino content.': 'Oculta os cartões e as entradas da barra lateral marcados claramente como conteúdo de cassino.',
    'Blur marked mature cards until hover or keyboard focus.': 'Desfoca os cartões marcados como adultos até passar o cursor ou focar pelo teclado.',
    'Hide Drops and gambling promotions': 'Ocultar promoções de Drops e apostas',
    'Hide clearly labeled Drops and gambling promotion modules.': 'Oculta os módulos claramente marcados como promoções de Drops e apostas.',
    'Reduce tracking telemetry': 'Reduzir a telemetria de rastreamento',
    'Block observed third-party video and error telemetry hosts.': 'Bloqueia os servidores de telemetria de vídeo e de erros de terceiros detectados.',
    'Remember volume locally': 'Lembrar o volume localmente',
    'Restore each channel’s volume and mute state from local storage.': 'Restaura o volume e o estado de mudo de cada canal a partir do armazenamento local.',
    'Remember quality locally': 'Lembrar a qualidade localmente',
    'Restore a matching quality control when Kick exposes one.': 'Restaura o controle de qualidade correspondente quando o Kick o oferece.',
    'Remember VOD position locally': 'Lembrar a posição do VOD localmente',
    'Resume finite VODs from the last local playback position.': 'Retoma os VODs finitos a partir da última posição de reprodução local.',
    'Pause chat updates': 'Pausar as atualizações do chat',
    'Freeze the visible chat scroll with an accessible resume control.': 'Congela a rolagem visível do chat com um controle acessível para retomá-la.',
    'Organize chat emotes': 'Organizar os emotes do chat',
    'Continuously record emotes from live chat and Kick’s picker, then add favorites, removals, search, and custom groups.': 'Registra continuamente os emotes do chat ao vivo e do seletor do Kick, e adiciona favoritos, remoções, busca e grupos personalizados.',
    'Highlight chat keywords': 'Destacar palavras-chave do chat',
    'Use the per-channel keyword list below without sending it anywhere.': 'Usa a lista de palavras-chave por canal abaixo sem enviá-la a lugar nenhum.',
    'Show playback diagnostics': 'Mostrar diagnósticos de reprodução',
    'Show ready state, buffered seconds, and dropped-frame counts on a channel.': 'Mostra o estado de prontidão, os segundos em buffer e os quadros perdidos em um canal.',
    'Start playback without waiting for blocked ad scripts': 'Iniciar a reprodução sem esperar pelos scripts de anúncios bloqueados',
    'Kick waits on Google PAL, Datazoom, and OM before requesting playback. Blocking them — which this build does — leaves the dead script in the page and the player waits out the full timeout. Removing it lets playback start immediately.': 'O Kick espera por Google PAL, Datazoom e OM antes de solicitar a reprodução. Bloqueá-los — o que esta versão faz — deixa o script morto na página e o player aguarda todo o tempo limite. Removê-lo faz a reprodução começar imediatamente.',
    'Minimize non-essential animations and transitions.': 'Minimiza as animações e transições não essenciais.',
    'Increase separation for controls, borders, and surfaces.': 'Aumenta a separação de controles, bordas e superfícies.',
    'Keep a strong outline for keyboard navigation.': 'Mantém um contorno forte para a navegação por teclado.',
    'Increase the minimum height of interactive controls.': 'Aumenta a altura mínima dos controles interativos.',
    'Report view changes to assistive technology.': 'Informa as mudanças de exibição às tecnologias assistivas.',
    'Scale text in the main Kick content area.': 'Dimensiona o texto na área de conteúdo principal do Kick.',
    'Set the preferred caption background strength.': 'Define a intensidade preferida do fundo das legendas.',
    'Multi-stream opened': 'Multitransmissão aberta',
    'Watch several Kick channels in one grid': 'Assista a vários canais do Kick em uma única grade',
    'Read-only here. Kick blocks sending from an embedded chat; open the channel to talk.': 'Somente leitura aqui. O Kick impede o envio a partir de um chat incorporado; abra o canal para falar.',
  },
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
  return TRANSLATIONS[activeLocale()]?.[source] || source;
}

/** Locale-aware count word: es and pt have a "many" category English lacks. */
function plural(count, one, other) {
  return pluralForm(count, { one, other }, activeLocale());
}

function localizeInterface(root = state.shadow) {
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
  const shadow = root.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${UI_CSS}</style>
    <button type="button" class="kf-quick" data-kf-quick data-action="open-command" aria-label="Open Kick Focus command menu">Focus</button>
    <div class="kf-backdrop" data-kf-settings-backdrop hidden>
      <section class="kf-settings" data-kf-settings-shell role="dialog" aria-modal="true" aria-labelledby="kf-settings-title">
        <header class="kf-header">
          <div class="kf-brand"><img class="kf-brand-mark" src="__KICK_FOCUS_ICON__" alt=""><span>Kick Focus</span><span class="kf-badge">Premium</span></div>
          <div class="kf-title" id="kf-settings-title">Settings</div>
          <div class="kf-save" data-kf-save-status data-error="false">Autosaved</div>
          <button class="kf-icon-button" type="button" data-action="close-settings" aria-label="Close settings">${uiIcon('close')}</button>
        </header>
        <div class="kf-body">
          <nav class="kf-nav" aria-label="Kick Focus settings">
            ${NAV_ITEMS.map(([id, title, description, icon]) => `<button type="button" data-page="${id}">${uiIcon(icon)}<span class="kf-nav-copy"><strong>${title}</strong><span>${description}</span></span></button>`).join('')}
          </nav>
          <main class="kf-page" data-kf-page tabindex="-1"></main>
        </div>
        <footer class="kf-footer">
          <div class="kf-footer-left">
            <button type="button" class="kf-button" data-action="reset-page">${uiIcon('reset')}Reset page</button>
            <button type="button" class="kf-button" data-action="export">${uiIcon('export')}Export settings</button>
          </div>
          <div class="kf-footer-right"><button type="button" class="kf-button kf-button-primary" data-action="close-settings">${uiIcon('check')}Done</button></div>
        </footer>
        <div class="kf-confirm" data-kf-confirm hidden>
          <div class="kf-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="kf-confirm-title" aria-describedby="kf-confirm-copy">
            <h2 id="kf-confirm-title" data-kf-confirm-title>Reset settings?</h2>
            <p id="kf-confirm-copy" data-kf-confirm-copy>This restores the defaults for this page.</p>
            <div class="kf-button-group">
              <button type="button" class="kf-button" data-action="cancel-reset">Cancel</button>
              <button type="button" class="kf-button kf-danger" data-action="confirm-reset">Reset</button>
            </div>
          </div>
        </div>
      </section>
    </div>
    <div class="kf-backdrop" data-kf-command-backdrop hidden>
      <section class="kf-command-shell" role="dialog" aria-modal="true" aria-label="Kick Focus command menu">
        <div class="kf-command-head"><label class="kf-sr-only" for="kf-command-input">Filter commands</label><input id="kf-command-input" data-kf-command-input type="search" autocomplete="off" placeholder="Filter commands…"></div>
        <div class="kf-command-list" data-kf-command-list role="listbox"></div>
      </section>
    </div>
    <div class="kf-backdrop kf-ms-backdrop" data-kf-multistream-backdrop hidden>
      <section class="kf-ms-shell" role="dialog" aria-modal="true" aria-label="Kick Focus multi-stream">
        <header class="kf-ms-head">
          <strong>Multi-stream</strong>
          <span class="kf-ms-count" data-kf-multistream-count></span>
          <span class="kf-ms-spacer"></span>
          <label class="kf-sr-only" for="kf-ms-input">Add a Kick channel</label>
          <input id="kf-ms-input" data-kf-multistream-input type="search" autocomplete="off" placeholder="Add a channel or paste a kick.com link…">
          <button type="button" class="kf-button kf-button-primary kf-button-small" data-action="multistream-add">Add</button>
          <button type="button" class="kf-button kf-button-small" data-action="multistream-toggle-pause" data-kf-multistream-pause aria-pressed="false">Pause all</button>
          <button type="button" class="kf-button kf-button-small" data-action="multistream-toggle-mute" data-kf-multistream-mute aria-pressed="false">Mute all</button>
          <select class="kf-select kf-ms-select" data-kf-multistream-chat-select aria-label="Which chat to show"></select>
          <button type="button" class="kf-button kf-button-small" data-action="multistream-toggle-chat" aria-pressed="true">Hide chat</button>
          <button type="button" class="kf-button kf-button-small" data-action="close-multistream">Close</button>
        </header>
        <div class="kf-ms-error" role="alert" data-kf-multistream-error hidden></div>
        <div class="kf-ms-body">
          <div class="kf-ms-grid" data-kf-multistream-grid></div>
          <aside class="kf-ms-chat" data-kf-multistream-chat></aside>
        </div>
        <footer class="kf-ms-foot">
          <label class="kf-sr-only" for="kf-ms-layout-name">Layout name</label>
          <input id="kf-ms-layout-name" data-kf-multistream-layout-name type="text" autocomplete="off" placeholder="Name this layout…">
          <button type="button" class="kf-button kf-button-small" data-action="multistream-save">Save layout</button>
          <div class="kf-ms-layouts" data-kf-multistream-layouts></div>
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
  `;
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
  state.commandInput.addEventListener('input', renderCommands);
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

  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Open Kick Focus settings', () => openSettings());
      GM_registerMenuCommand('Open Kick Focus commands', () => openCommandMenu());
    }
  } catch {
    // The in-page controls remain available.
  }

  document.addEventListener('keydown', onGlobalKeydown, true);
  document.addEventListener('click', rememberWatchedCard, true);
}

function selected(value, expected) {
  return String(value) === String(expected);
}

function segmented(path, current, choices) {
  return `<div class="kf-segmented" role="group" aria-label="${escapeHtml(path)}">${choices.map(([value, label]) => `<button type="button" data-set="${path}" data-value="${escapeHtml(value)}" aria-pressed="${selected(current, value)}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

function toggle(path, current, options = {}) {
  const disabled = options.locked ? ' disabled' : '';
  return `<button type="button" class="kf-switch" role="switch" data-set="${path}" data-value="${!current}" aria-checked="${current}" aria-label="${escapeHtml(options.label || path)}"${disabled}></button>`;
}

function row(title, description, control, options = {}) {
  return `<div class="kf-row${options.wide ? ' kf-row-wide' : ''}"><div><h3>${title}${options.locked ? '<span class="kf-lock">Core protection</span>' : ''}</h3><p>${description}</p></div><div class="kf-control">${control}</div></div>`;
}

function range(path, current, minimum, maximum, left, right, suffix = '') {
  // A readable accessible name instead of the dotted setting path, and
  // aria-valuetext so a screen reader hears "70%" rather than a bare "70".
  const label = path.split('.').pop().replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase());
  const valueText = `${current}${suffix}`;
  return `<div class="kf-range"><span>${escapeHtml(left)}</span><div class="kf-range-wrap"><output data-output-for="${path}">${escapeHtml(current)}${escapeHtml(suffix)}</output><input type="range" min="${minimum}" max="${maximum}" value="${current}" data-set="${path}" aria-label="${escapeHtml(label)}" aria-valuetext="${escapeHtml(valueText)}"></div><span>${escapeHtml(right)}</span></div>`;
}

function selectControl(path, current, choices, label) {
  return `<select class="kf-select" data-set="${escapeHtml(path)}" aria-label="${escapeHtml(label)}">${choices.map(([value, optionLabel]) => `<option value="${escapeHtml(value)}"${selected(current, value) ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`).join('')}</select>`;
}

function pageHeader(title, description, metaLabel, metaValue) {
  return `<div class="kf-page-header"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><div class="kf-page-meta"><span>${escapeHtml(metaLabel)}</span><strong>${escapeHtml(metaValue)}</strong></div></div>`;
}

function renderLayoutPage() {
  const value = state.settings.layout;
  return `
    ${pageHeader('Layout', 'Control how Kick is arranged across your desktop.', 'Current setup', `${value.sidebar} sidebar · ${value.chat} chat`)}
    <section class="kf-panel">
      ${row('Sidebar mode', 'Choose how the left discovery rail behaves. Dropdown collapses it to a tab that expands on hover, giving the grid full width. Desktop widths only.', segmented('layout.sidebar', value.sidebar, [['auto','Auto'],['compact','Compact'],['dropdown','Dropdown'],['hidden','Hidden']]))}
      ${row('Chat layout', 'Keep chat on the right, float it as a dock, or hide it.', segmented('layout.chat', value.chat, [['right','Right'],['docked','Docked'],['hidden','Hidden']]))}
      ${row('Chat width', 'Set the width of the live chat column.', range('layout.chatWidth', value.chatWidth, 320, 520, '320 px', '520 px', ' px'), { wide: true })}
      ${row('Content density', 'Adjust spacing and padding across discovery pages.', segmented('layout.density', value.density, [['comfortable','Comfortable'],['compact','Compact']]))}
      ${row('Stream start behavior', 'Choose how each channel opens.', segmented('layout.streamStart', value.streamStart, [['standard','Standard'],['theater','Theater'],['focus','Focus']]))}
      ${row('Remember per-channel layout', 'Keep the last runtime layout for each channel.', toggle('layout.rememberPerChannel', value.rememberPerChannel, { label: 'Remember per-channel layout' }))}
      ${row('Widen browse grids', 'Use reclaimed sidebar space for larger, calmer stream cards.', toggle('layout.wideGrid', value.wideGrid, { label: 'Widen browse grids' }))}
      ${row('Show Following rail', 'Keep the Following discovery rail visible when Kick provides it.', toggle('layout.showFollowingRail', value.showFollowingRail, { label: 'Show Following rail' }))}
      ${row('Show Recommended rail', 'Keep recommended stream rows visible in the main content.', toggle('layout.showRecommendedRail', value.showRecommendedRail, { label: 'Show Recommended rail' }))}
      ${row('Sticky compact top bar', 'Keep search and account controls available while browsing.', toggle('layout.stickyTopbar', value.stickyTopbar, { label: 'Sticky compact top bar' }))}
      ${row('Show quick command button', 'Keep the Focus control beside Get KICKs in Kick’s top header.', toggle('layout.quickButton', value.quickButton, { label: 'Show quick command button' }))}
      ${row('Move mini-player clear of controls', 'Raise Kick’s embedded mini-player only when the Focus control has to use its floating fallback.', toggle('layout.miniPlayerCollision', value.miniPlayerCollision, { label: 'Move mini-player clear of controls' }))}
      ${row('Recover player after resize', 'Re-apply player geometry after a window or monitor change.', toggle('layout.playerResizeRecovery', value.playerResizeRecovery, { label: 'Recover player after resize' }))}
      ${row('Keep ultrawide video uncropped', 'Prefer contained video geometry on wide or moved displays.', toggle('layout.playerContainVideo', value.playerContainVideo, { label: 'Keep ultrawide video uncropped' }))}
    </section>`;
}

function renderAppearancePage() {
  const value = state.settings.appearance;
  const themes = [['studio','Studio'],['oled','OLED'],['slate','Slate']];
  const accents = [['kick','Kick Green'],['cyan','Cyan'],['violet','Violet'],['gold','Gold']];
  return `
    <div class="kf-page-header"><div><h2>Appearance</h2><p>Set a premium visual style without replacing Kick’s identity.</p></div><div class="kf-page-meta kf-page-meta-control"><span>Language</span>${selectControl('appearance.language', value.language, [['auto','Auto'],['en','English'],['es','Español'],['pt','Português']], 'Interface language')}</div></div>
    <div class="kf-appearance-layout">
      <section class="kf-panel kf-appearance-controls">
        <div class="kf-row kf-row-wide"><div><h3>Theme</h3><p>Choose the overall surface treatment.</p></div><div class="kf-theme-grid">${themes.map(([id,label]) => `<button type="button" class="kf-choice-card" data-set="appearance.theme" data-value="${id}" aria-pressed="${selected(value.theme,id)}"><span class="kf-theme-sample" aria-hidden="true"><span>Surface</span><b>Active</b></span><strong>${label}</strong></button>`).join('')}</div></div>
        <div class="kf-row kf-row-wide"><div><h3>Accent color</h3><p>Use one clear accent for highlights and controls.</p></div><div class="kf-swatch-grid">${accents.map(([id,label]) => `<button type="button" class="kf-choice-card" data-set="appearance.accent" data-value="${id}" aria-pressed="${selected(value.accent,id)}"><span class="kf-swatch" data-color="${id}" aria-hidden="true"></span><strong>${label}</strong></button>`).join('')}</div></div>
        ${row('Corner radius', 'Adjust the roundness of enhanced UI.', segmented('appearance.radius', value.radius, [['subtle','Subtle'],['balanced','Balanced'],['rounded','Rounded']]))}
        ${row('Thumbnail treatment', 'Adjust stream-card color intensity.', range('appearance.thumbnail', value.thumbnail, 0, 100, 'Natural', 'Vivid', '%'), { wide: true })}
        ${row('Interface scale', 'Set the size of Kick Focus controls.', segmented('appearance.interfaceScale', value.interfaceScale, [[90,'90%'],[100,'100%'],[110,'110%']]))}
        ${row('Dim watched cards', 'Reduce emphasis on streams you have already opened.', toggle('appearance.dimWatched', value.dimWatched, { label: 'Dim watched cards' }))}
        ${row('Strengthen text contrast', 'Increase legibility on muted surfaces.', toggle('appearance.strongContrast', value.strongContrast, { label: 'Strengthen text contrast' }))}
        ${row('Colorize live indicators', 'Use the selected accent for live-state emphasis.', toggle('appearance.colorizeLive', value.colorizeLive, { label: 'Colorize live indicators' }))}
      </section>
      <aside class="kf-preview" aria-label="Live style preview">
        <div><div class="kf-preview-kicker">Live preview</div><p class="kf-preview-intro">Updates as you tune the controls.</p></div>
        <div class="kf-preview-surface">
          <header><strong>Kick Focus</strong><span>Browse</span><span>Following</span></header>
          <img class="kf-preview-image" src="__KICK_FOCUS_PREVIEW__" alt="">
          <section class="kf-preview-feature">
            <div class="kf-preview-live">Live now</div>
            <h3>Creative tools and workflows</h3>
            <p>Studio Live · Design & Technology</p>
            <div class="kf-preview-action"><span>2.4K watching</span><b>Follow</b></div>
          </section>
          <div class="kf-preview-list"><span>Recommended</span><strong>Three calm, focused rows</strong></div>
          <div class="kf-preview-list"><span>Interface</span><strong>${escapeHtml(value.interfaceScale)}% · ${escapeHtml(value.radius)}</strong></div>
        </div>
      </aside>
    </div>`;
}

/**
 * Observability for the mod's own failures. A client mod on a churning site
 * fails silently otherwise. Uncaught errors from the mod's own entry points are
 * captured to a bounded local ring buffer the user can view and copy (sanitized,
 * no query strings), and the last one persists across reload. Nothing is sent.
 */
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
  if (panel) panel.innerHTML = errorLogRows();
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
  return `Last: ${crash.context} — ${crash.message} (${when})`;
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

function localChannelTools() {
  const path = channelPath();
  if (!path) {
    return '<div class="kf-notice">Open a channel page to set channel-specific chat keywords or a private local note.</div>';
  }
  const keywords = chatKeywordsForChannel().join(', ');
  const note = typeof state.channelNotes[path] === 'string' ? state.channelNotes[path] : '';
  return `
    <section class="kf-panel">
      <div class="kf-row kf-row-wide"><div><h3>Chat keywords for this channel</h3><p>Comma-separated words are highlighted locally in chat. They never leave this browser.</p></div><input class="kf-text" data-kf-chat-keywords value="${escapeHtml(keywords)}" placeholder="release, giveaway, raid" aria-label="Chat keywords for this channel"></div>
      <div class="kf-row kf-row-wide"><div><h3>Private channel note</h3><p>Keep a local reminder for this channel. It is not sent to Kick.</p></div><textarea class="kf-textarea" data-kf-channel-note maxlength="1000" placeholder="Why I follow this channel…" aria-label="Private channel note">${escapeHtml(note)}</textarea></div>
      <div class="kf-action-row"><div><h3>Save local channel tools</h3><p>Only this channel path and the values above are stored.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="clear-local-channel">Clear this channel</button><button type="button" class="kf-button kf-button-primary" data-action="save-local-channel">Save</button></div></div>
    </section>`;
}

function remoteBlocklistControls() {
  const value = state.settings.content;
  return `
    <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Optional data-only blocklist</h3><p>Fetch a user-supplied JSON list of channels, categories, and keywords. No code is accepted or executed.</p></div><button type="button" class="kf-button kf-button-small" data-action="clear-blocklist">Remove cached list</button></div>
      <div class="kf-panel">
        ${row('Enable subscription', 'Off by default. When enabled, refreshes only over HTTPS with credentials omitted.', toggle('content.blocklistSubscription', value.blocklistSubscription, { label: 'Enable optional blocklist subscription' }))}
        <div class="kf-row kf-row-wide"><div><h3>HTTPS JSON URL</h3><p>Expected fields: channels, categories, and keywords. Unknown fields are rejected.</p></div><input class="kf-text" type="url" data-set="content.blocklistUrl" value="${escapeHtml(value.blocklistUrl)}" placeholder="https://example.com/kick-focus-blocklist.json" aria-label="Optional blocklist URL"></div>
        ${row('Refresh interval', 'Keep the last valid payload if a later request fails.', segmented('content.blocklistRefreshHours', value.blocklistRefreshHours, [[6,'6 h'],[12,'12 h'],[24,'24 h'],[72,'72 h']]))}
      </div>
      <div class="kf-status-note" data-kf-remote-blocklist data-status="${escapeHtml(state.remoteBlocklist.status)}">${escapeHtml(remoteBlocklistSummary())}</div>
    </section>`;
}

function stickerLibrarySummary() {
  const library = [...state.stickerPreferences.library.values()];
  const locked = library.filter((sticker) => sticker.access === 'locked').length;
  const observed = library.filter((sticker) => sticker.access === 'observed').length;
  const changed = countChangedStickers(library);
  const atCapacity = library.length >= STICKER_LIBRARY_LIMIT;
  return `${library.length} recorded · ${favoriteCount()} favorites · ${state.stickerPreferences.hidden.size} removed · ${state.stickerPreferences.groups.length} custom groups${observed ? ` · ${observed} seen in chat` : ''}${locked ? ` · ${locked} locked-only` : ''}${changed ? ` · ${changed} changed by Kick` : ''}${atCapacity ? ` · full (${STICKER_LIBRARY_LIMIT}); oldest chat-only emotes drop first` : ''}`;
}

/** First/last capture in the user's terms; '' for entries recorded before schema 4. */
function stickerSeenSummary(sticker) {
  if (!sticker.firstSeen) return '';
  const day = (time) => new Date(time).toISOString().slice(0, 10);
  const first = day(sticker.firstSeen);
  const last = sticker.lastSeen ? day(sticker.lastSeen) : '';
  return last && last !== first ? `First seen ${first} · last ${last}` : `First seen ${first}`;
}

function stickerLibraryFilterMatches(sticker, filter) {
  if (filter === 'favorites') return isFavorited(sticker.key);
  if (filter === 'removed') return state.stickerPreferences.hidden.has(sticker.key);
  if (filter === 'changed') return stickerChangedSinceCapture(sticker);
  if (filter === 'observed') return sticker.access === 'observed';
  if (filter === 'locked') return sticker.access === 'locked';
  if (filter === 'ungrouped') return !state.stickerPreferences.assignments.has(sticker.key);
  if (filter.startsWith('group:')) return state.stickerPreferences.assignments.get(sticker.key) === filter.slice(6);
  return true;
}

function stickerGroupOptions(selectedGroup = '') {
  return `<option value="">Ungrouped</option>${state.stickerPreferences.groups.map((group) => `<option value="${escapeHtml(group.id)}"${selected(group.id, selectedGroup) ? ' selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}`;
}

function renderStickerLibraryManager() {
  const filter = state.runtime.stickerLibraryFilter;
  const library = [...state.stickerPreferences.library.values()]
    .filter((sticker) => stickerLibraryFilterMatches(sticker, filter))
    .sort((left, right) => {
      const favoriteDifference = Number(isFavorited(right.key)) - Number(isFavorited(left.key));
      if (favoriteDifference) return favoriteDifference;
      const removedDifference = Number(state.stickerPreferences.hidden.has(left.key)) - Number(state.stickerPreferences.hidden.has(right.key));
      return removedDifference || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
  const filters = [
    ['all', `All recorded (${state.stickerPreferences.library.size})`],
    ['favorites', `Favorites (${favoriteCount()})`],
    ['removed', `Removed (${state.stickerPreferences.hidden.size})`],
    ['changed', `Changed by Kick (${countChangedStickers(state.stickerPreferences.library)})`],
    ['observed', 'Seen in chat'],
    ['locked', 'Locked-only'],
    ['ungrouped', 'Ungrouped'],
    ...state.stickerPreferences.groups.map((group) => [`group:${group.id}`, group.name]),
  ];
  const groupRows = state.stickerPreferences.groups.map((group) => {
    const count = [...state.stickerPreferences.assignments.values()].filter((groupId) => groupId === group.id).length;
    return `<div class="kf-sticker-group-row">
      <input class="kf-text" value="${escapeHtml(group.name)}" maxlength="60" data-kf-sticker-group-name="${escapeHtml(group.id)}" aria-label="Rename ${escapeHtml(group.name)}">
      <button type="button" class="kf-button kf-button-small" data-action="rename-sticker-group" data-kf-sticker-group-id="${escapeHtml(group.id)}">Save name</button>
      <button type="button" class="kf-button kf-button-small kf-danger" data-action="delete-sticker-group" data-kf-sticker-group-id="${escapeHtml(group.id)}">Delete (${count})</button>
    </div>`;
  }).join('');
  const cards = library.map((sticker) => {
    const favorite = isFavorited(sticker.key);
    const removed = state.stickerPreferences.hidden.has(sticker.key);
    const groupId = state.stickerPreferences.assignments.get(sticker.key) || '';
    const nativeGroups = sticker.nativeGroups.length ? sticker.nativeGroups.join(', ') : 'Unknown Kick group';
    const searchText = `${sticker.name} ${nativeGroups}`.toLowerCase();
    const accessLabel = sticker.access === 'available' ? 'Seen available' : sticker.access === 'observed' ? 'Seen in chat' : 'Locked only';
    const changeNote = describeStickerChange(sticker);
    const seenNote = stickerSeenSummary(sticker);
    // A greyed tile with no explanation teaches nothing. Nothing here enables
    // or sends anything; it names the reason and links to Kick's own page.
    const lock = sticker.access === 'locked'
      ? emoteLockState({ ...sticker, locked: true }, sticker.nativeGroups[0] || '')
      : { locked: false, reason: '', unlockUrl: '' };
    return `<article class="kf-sticker-library-item" data-kf-sticker-library-item data-kf-sticker-search="${escapeHtml(searchText)}" data-removed="${removed}" data-changed="${Boolean(changeNote)}">
      <div class="kf-sticker-library-image"><img src="${escapeHtml(sticker.src)}" alt="${escapeHtml(sticker.name)}" loading="lazy"></div>
      <div class="kf-sticker-library-copy"><strong data-kf-no-translate title="${escapeHtml(sticker.name)}">${escapeHtml(sticker.name)}</strong><small title="${escapeHtml(nativeGroups)}">${escapeHtml(nativeGroups)}</small>${seenNote ? `<small title="${escapeHtml(seenNote)}">${escapeHtml(seenNote)}</small>` : ''}<span class="kf-sticker-access" data-access="${escapeHtml(sticker.access)}">${accessLabel}</span>${changeNote ? `<span class="kf-sticker-changed" title="${escapeHtml(changeNote)}">Changed by Kick</span>` : ''}${lock.locked ? `<small class="kf-sticker-lock">${escapeHtml(lock.reason)}${lock.unlockUrl ? ` <a href="${escapeHtml(lock.unlockUrl)}" target="_blank" rel="noopener">Unlock on Kick</a>` : ''}</small>` : ''}</div>
      <div class="kf-sticker-library-actions">
        <button type="button" class="kf-button kf-button-small" data-action="favorite-library-sticker" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Remove favorite' : 'Favorite'} ${escapeHtml(sticker.name)}">${favorite ? '★ Favorite' : '☆ Favorite'}</button>
        <button type="button" class="kf-button kf-button-small${removed ? '' : ' kf-danger'}" data-action="remove-library-sticker" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-label="${removed ? 'Restore' : 'Remove'} ${escapeHtml(sticker.name)}">${removed ? 'Restore' : 'Remove'}</button>
        <select class="kf-select" data-kf-sticker-assignment="${escapeHtml(sticker.key)}" aria-label="Custom group for ${escapeHtml(sticker.name)}">${stickerGroupOptions(groupId)}</select>
      </div>
    </article>`;
  }).join('');
  return `
    <section class="kf-subsection" data-kf-sticker-library>
      <div class="kf-subsection-header"><div><h3>Recorded emote library</h3><p data-kf-sticker-library-summary>${escapeHtml(stickerLibrarySummary())}</p></div><div class="kf-button-group"><button type="button" class="kf-button kf-button-small" data-action="export">Export all settings</button><button type="button" class="kf-button kf-button-small" data-action="clear-sticker-preferences">Reset organization</button></div></div>
      <div class="kf-sticker-library-shell">
        <div class="kf-sticker-library-controls">
          <input class="kf-text" type="search" value="${escapeHtml(state.runtime.stickerLibraryQuery)}" data-kf-sticker-library-search placeholder="Search recorded emotes or Kick groups" aria-label="Search recorded emotes">
          <select class="kf-select" data-kf-sticker-library-filter aria-label="Filter recorded emotes">${filters.map(([value, label]) => `<option value="${escapeHtml(value)}"${selected(filter, value) ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>
        </div>
        <div class="kf-sticker-group-builder"><input class="kf-text" maxlength="60" data-kf-new-sticker-group placeholder="New custom group name" aria-label="New emote group name"><button type="button" class="kf-button kf-button-primary" data-action="create-sticker-group">Create group</button></div>
        ${groupRows ? `<div class="kf-sticker-group-list">${groupRows}</div>` : ''}
        <div class="kf-sticker-library-meta"><span data-kf-sticker-library-visible>${library.length} shown</span><span>New emotes from chat and the picker are merged automatically and included in export.</span></div>
        ${filter === 'removed' ? `<div class="kf-notice">Removed emotes are no longer stored, which frees their library slots. ${state.stickerPreferences.hidden.size} ${state.stickerPreferences.hidden.size === 1 ? 'emote is' : 'emotes are'} kept out of the library.${state.stickerPreferences.hidden.size ? ` <button type="button" class="kf-button kf-button-small" data-action="restore-removed-stickers">Restore all removed</button>` : ''}</div>` : cards ? `<div class="kf-sticker-library-grid">${cards}</div>` : `<div class="kf-notice">${state.stickerPreferences.library.size ? 'No recorded emotes match this filter.' : 'Watch chat or open Kick’s emote picker to begin the library. New emotes are saved whenever Kick exposes them.'}</div>`}
      </div>
    </section>`;
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
  const count = state.shadow?.querySelector('[data-kf-sticker-library-visible]');
  if (count) count.textContent = `${visible} shown`;
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
function renderCollectiblePanel() {
  const inventory = state.live.inventory;
  const changed = countChangedStickers(state.stickerPreferences.library);
  const observed = inventory
    ? (inventory.quantityKnown
      ? `Your inventory holds ${inventory.copies} collectible${inventory.copies === 1 ? '' : 's'} across ${inventory.distinct} distinct item${inventory.distinct === 1 ? '' : 's'} — ${inventory.duplicates} duplicate${inventory.duplicates === 1 ? '' : 's'}, or ${Math.round(inventory.duplicateRate * 100)}% of what you have pulled.`
      : `Your inventory holds ${inventory.distinct} distinct collectible${inventory.distinct === 1 ? '' : 's'}. Kick’s response carries no per-item quantity, so a duplicate rate cannot be measured from it — that number is unavailable rather than zero.`)
    : 'Open a channel with collectibles while signed in to read your own inventory. Nothing is fetched otherwise.';
  return `
    <div class="kf-panel">
      <div class="kf-action-row"><div><h3>What Kick does not explain</h3><p>${escapeHtml(observed)}${changed ? ` ${changed} recorded emote${changed === 1 ? ' has' : 's have'} been changed by Kick since first capture — see the Changed by Kick filter in the library below.` : ''}</p></div></div>
      <dl class="kf-fact-list">${COLLECTIBLE_FACTS.map((fact) => `<div class="kf-fact"><dt>${escapeHtml(fact.claim)}</dt><dd>${escapeHtml(fact.detail)}</dd></div>`).join('')}</dl>
    </div>`;
}

function renderLiveDataSection(value) {
  const collisions = state.live.collisions;
  const rarity = state.live.rarity;
  return `
    <section class="kf-subsection kf-content-section">
      <div class="kf-subsection-header"><div><h3>Kick data</h3><p>Read Kick’s own endpoints instead of scraping the page. Same-origin, read-only, using the session you are already signed into. Nothing is sent anywhere.</p></div></div>
      <div class="kf-panel">
        <div class="kf-status-note" data-kf-live-status>${escapeHtml(liveStatusSummary())}</div>
        ${row('Load the emote catalog from Kick', 'Read the full channel, global, and emoji sets with their real entitlement, instead of scraping the picker. Falls back to the picker if the response changes shape.', toggle('content.liveEmoteCatalog', value.liveEmoteCatalog, { label: 'Load the emote catalog from Kick' }))}
        ${row('Follow live chat events', 'Subscribe to the same realtime chat feed Kick’s own client uses. The provider is read from Kick rather than hardcoded.', toggle('content.liveChatEvents', value.liveChatEvents, { label: 'Follow live chat events' }))}
        ${row('Explain removed messages', 'Kick’s automatic moderation removes messages without saying why. The realtime event carries the reason; the page does not.', toggle('content.showModerationReasons', value.showModerationReasons, { label: 'Explain removed messages' }))}
        ${row('Show badges Kick leaves out', 'Kick’s chat payload carries collectible and global badges its own markup omits, leaving a gap where other clients show a badge. A badge image that fails to load is replaced by its name.', toggle('content.showChatBadges', value.showChatBadges, { label: 'Show badges Kick leaves out' }))}
        ${row('Count emote usage', 'Kick’s own “Frequently Used” never counts anything, so no real ranking exists. This one is yours, stored locally and exported with your library.', toggle('content.countEmoteUsage', value.countEmoteUsage, { label: 'Count emote usage' }))}
        ${row('Show collectible rarity', 'Kick publishes rarity on card art and identity in the picker, with no key joining them. Rarity is shown only where the match is confident.', toggle('content.showEmoteRarity', value.showEmoteRarity, { label: 'Show collectible rarity' }))}
        ${row('Warn about shadowed emote names', 'Subscriber emotes work in every chat and Kick resolves typed names through one map, so two channels sharing a name means one silently sends the other’s.', toggle('content.warnShadowedEmotes', value.warnShadowedEmotes, { label: 'Warn about shadowed emote names' }))}
        ${row('Freeze animated emotes', 'Render animated emotes and collectibles as a single static frame, in chat and in the picker. Applied automatically when your system asks for reduced motion.', toggle('content.staticEmotes', value.staticEmotes, { label: 'Freeze animated emotes' }))}
      </div>
      ${renderCollectiblePanel()}
      ${rarity ? `<div class="kf-panel"><div class="kf-action-row"><div><h3>Collectible rarity</h3><p>Resolved ${rarity.matched.length} of ${rarity.total} collectible emotes. ${rarity.unmatched.length ? `${rarity.unmatched.length} could not be matched confidently and are shown without a rarity — a wrong label is worse than none.` : 'Every collectible in this channel was matched.'}</p></div></div></div>` : ''}
      ${collisions.length ? `<div class="kf-panel"><div class="kf-action-row"><div class="kf-shadow-warning"><h3>Shadowed emote names</h3><p>These names exist in more than one of your sets. Kick sends the last one loaded, so typing the name may not send what you expect.</p>${collisions.slice(0, 12).map((collision) => `<p><code>${escapeHtml(collision.name)}</code> — sends <strong>${escapeHtml(collision.winner.setName)}</strong>, shadowing ${escapeHtml(collision.shadowed.map((entry) => entry.setName).join(', '))}</p>`).join('')}${collisions.length > 12 ? `<p>…and ${collisions.length - 12} more.</p>` : ''}</div></div></div>` : ''}
    </section>`;
}

function renderContentPage() {
  const value = state.settings.content;
  const companion = companionInfo();
  return `
    ${pageHeader('Content & Ads', 'Keep the page calm, private, and focused on streams.', 'Protection', companion.active ? 'Network + page' : 'Page only')}
    <div class="kf-defense-overview">
      <section class="kf-status-card"><div><h3>Ad defense active</h3><p>${companion.active
        ? `Browser network ruleset plus page hooks and shell cleanup. Companion extension v${escapeHtml(companion.version)}.`
        : 'Document-start page hooks and persistent shell cleanup. Install the companion extension for browser-level blocking.'}</p></div><div class="kf-active">${companion.active ? 'Network + page' : 'Page only'}</div></section>
      <div class="kf-stats"><div class="kf-stat"><span>Blocked this page</span><strong data-kf-stat="blocked">${state.diagnostics.blocked}</strong></div><div class="kf-stat"><span>Removed shells</span><strong data-kf-stat="shells">${state.diagnostics.shells}</strong></div><div class="kf-stat"><span>Last match</span><strong data-kf-stat="last">${escapeHtml(state.diagnostics.lastMatch)}</strong></div></div>
    </div>
    <div class="kf-status-note" data-kf-adstack data-drifted="${assessAdStack(state.adStack).drifted}">${escapeHtml(assessAdStack(state.adStack).summary)}</div>
    <div class="kf-notice" data-kf-filter-notice ${state.filter.suspended ? '' : 'hidden'}>${state.filter.suspended
      ? `Filtering is suspended on this page. It would have hidden ${state.filter.wouldHide} of ${state.filter.total} cards, which usually means Kick changed its labels rather than that the page is really that promotional. Everything is shown.`
      : ''}</div>
    <section class="kf-subsection kf-content-section"><div class="kf-subsection-header"><div><h3>Filtering & ad defense</h3><p>Requests, promotional modules, and sensitive content.</p></div></div><div class="kf-panel">
        ${row('Block separable ad requests', 'Intercept known ad hosts at the earliest userscript-supported page layer.', toggle('content.blockAds', true, { locked: true, label: 'Core ad protection is on' }), { locked: true })}
        ${row('Remove ad containers', 'Remove empty ad containers and reinjected ad frames.', toggle('content.removeAdContainers', value.removeAdContainers, { label: 'Remove ad containers' }))}
        ${row('Suppress sponsored and promoted cards', 'Hide clearly labeled promotional cards and modules.', toggle('content.suppressPromoted', value.suppressPromoted, { label: 'Suppress promoted cards' }))}
        ${row('Pause home-page autoplay', 'Keep background Home previews silent and paused; deliberate playback remains available.', toggle('content.pauseHomeAutoplay', value.pauseHomeAutoplay, { label: 'Pause home-page autoplay' }))}
        ${row('Hide Slots & Casino content', 'Hide cards and sidebar entries clearly labeled as casino content.', toggle('content.hideCasino', value.hideCasino, { label: 'Hide Slots and Casino content' }))}
        ${row('Blur mature thumbnails', 'Blur marked mature cards until hover or keyboard focus.', toggle('content.blurMature', value.blurMature, { label: 'Blur mature thumbnails' }))}
        ${row('Hide Drops and gambling promotions', 'Hide clearly labeled Drops and gambling promotion modules.', toggle('content.hideDropsPromotions', value.hideDropsPromotions, { label: 'Hide Drops and gambling promotions' }))}
        ${row('Reduce tracking telemetry', 'Block observed third-party video and error telemetry hosts.', toggle('content.reduceTelemetry', value.reduceTelemetry, { label: 'Reduce tracking telemetry' }))}
      </div>
    </section>
    <section class="kf-subsection kf-content-section"><div class="kf-subsection-header"><div><h3>Hidden channels</h3><p>Hide specific channels from Home, Browse, Following, and Search.</p></div></div><div class="kf-panel">
      <div class="kf-action-row"><div>
        <label class="kf-sr-only" for="kf-hidden-channel-input">Channel to hide</label>
        <div class="kf-channel-input-row">
          <input type="text" id="kf-hidden-channel-input" class="kf-text-input" placeholder="Channel name or kick.com URL" aria-label="Channel to hide" data-kf-hidden-channel-input>
          <button type="button" class="kf-button kf-button-small" data-action="add-hidden-channel">Hide</button>
        </div>
      </div></div>
      ${value.hiddenChannels.length ? `<div class="kf-channel-list" data-kf-hidden-channel-list>${value.hiddenChannels.map((channel) => `<div class="kf-channel-entry"><span>${escapeHtml(channel.replace(/^\//, ''))}</span><button type="button" class="kf-button kf-button-small kf-danger" data-action="remove-hidden-channel" data-channel="${escapeHtml(channel)}" aria-label="Show ${escapeHtml(channel.replace(/^\//, ''))} again">✕</button></div>`).join('')}</div>` : '<p class="kf-status-note">No channels hidden. Use the input above or the ✕ action on a card.</p>'}
      <p class="kf-meta">${value.hiddenChannels.length} channel${value.hiddenChannels.length === 1 ? '' : 's'} hidden. These count toward the fail-open ceiling.</p>
    </div></section>
    <section class="kf-subsection kf-content-section"><div class="kf-subsection-header"><div><h3>Playback & chat</h3><p>Local playback memory, chat control, emotes, and diagnostics.</p></div></div><div class="kf-panel">
        ${row('Remember volume locally', 'Restore each channel’s volume and mute state from local storage.', toggle('content.rememberVolume', value.rememberVolume, { label: 'Remember volume locally' }))}
        ${row('Remember quality locally', 'Restore a matching quality control when Kick exposes one.', toggle('content.rememberQuality', value.rememberQuality, { label: 'Remember quality locally' }))}
        ${row('Remember VOD position locally', 'Resume finite VODs from the last local playback position.', toggle('content.rememberVodPosition', value.rememberVodPosition, { label: 'Remember VOD position locally' }))}
        ${row('Pause chat updates', 'Freeze the visible chat scroll with an accessible resume control.', toggle('content.stickyChatPause', value.stickyChatPause, { label: 'Pause chat updates' }))}
        ${row('Organize chat emotes', 'Continuously record emotes from live chat and Kick’s picker, then add favorites, removals, search, and custom groups.', toggle('content.organizeChatStickers', value.organizeChatStickers, { label: 'Organize chat emotes' }))}
        ${row('New favorites apply to', 'Global favorites follow you everywhere. Per-channel favorites appear only on the channel you saved them from, above your global ones. Existing favorites are global and are not moved.', segmented('content.favoriteScope', value.favoriteScope, [['global', 'Everywhere'], ['channel', 'This channel']]))}
        ${row('Highlight chat keywords', 'Use the per-channel keyword list below without sending it anywhere.', toggle('content.chatHighlights', value.chatHighlights, { label: 'Highlight chat keywords' }))}
        ${row('Show playback diagnostics', 'Show ready state, buffered seconds, and dropped-frame counts on a channel.', toggle('content.playbackDiagnostics', value.playbackDiagnostics, { label: 'Show playback diagnostics' }))}
        ${row('Start playback without waiting for blocked ad scripts', 'Kick waits on Google PAL, Datazoom, and OM before requesting playback. Blocking them — which this build does — leaves the dead script in the page and the player waits out the full timeout. Removing it lets playback start immediately.', toggle('content.fixPlayerLoading', value.fixPlayerLoading, { label: 'Start playback without waiting for blocked ad scripts' }))}
      </div>
    </section>
    ${renderLiveDataSection(value)}
    <div class="kf-tool-grid">
      <section class="kf-tool-card"><div><h3>Emote library</h3><p data-kf-sticker-library-summary>${escapeHtml(stickerLibrarySummary())}</p></div><button type="button" class="kf-button kf-button-small" data-action="export">Export library</button></section>
      <section class="kf-tool-card"><div><h3>Local discovery choices</h3><p>Favorites and not-interested choices stay on this device.</p></div><div class="kf-button-group"><button type="button" class="kf-button kf-button-small" data-action="clear-favorites">Clear favorites</button><button type="button" class="kf-button kf-button-small" data-action="clear-dismissed">Clear hidden</button></div></section>
    </div>
    ${renderStickerLibraryManager()}
    <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Local channel tools</h3><p>Channel keywords and private notes stay on this device.</p></div></div>${localChannelTools()}</section>
    ${remoteBlocklistControls()}
    <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Protection log</h3><p>Sanitized in-memory diagnostics; query strings are never retained.</p></div></div><div class="kf-panel"><table class="kf-table"><thead><tr><th>Time</th><th>Layer</th><th>Match</th><th>Action</th></tr></thead><tbody data-kf-protection-log>${protectionRows()}</tbody></table></div></section>
    <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Error log</h3><p data-kf-last-crash>${escapeHtml(lastCrashSummary())}</p></div><button type="button" class="kf-button kf-button-small" data-action="copy-error-log">Copy error log</button></div><div class="kf-panel"><table class="kf-table"><thead><tr><th>Time</th><th>Where</th><th>Message</th></tr></thead><tbody data-kf-error-log>${errorLogRows()}</tbody></table></div></section>
    <div class="kf-notice">${companion.active
      ? 'The companion extension blocks known ad hosts at the browser network layer. Server-side stitched media is still delivered inside the stream itself.'
      : 'Userscript interception is best-effort and can be bypassed by browser or server-side delivery. Browser-level request guarantees require an extension ruleset.'}</div>`;
}

function renderAccessibilityPage() {
  const value = state.settings.accessibility;
  const shortcuts = state.settings.shortcuts;
  const rows = [
    ['command','Open command menu'],['focus','Toggle focus mode'],['chat','Toggle chat'],
    ['sidebar','Toggle sidebar'],['settings','Open settings'],['mature','Reveal mature thumbnails'],
  ];
  return `
    ${pageHeader('Accessibility & Shortcuts', 'Improve comfort and keep core actions within reach.', 'Text scale', `${value.textSize}%`)}
    <section class="kf-panel">
      ${row('Reduce motion', 'Minimize non-essential animations and transitions.', toggle('accessibility.reduceMotion', value.reduceMotion, { label: 'Reduce motion' }))}
      ${row('High-contrast controls', 'Increase separation for controls, borders, and surfaces.', toggle('accessibility.highContrast', value.highContrast, { label: 'High-contrast controls' }))}
      ${row('Always show keyboard focus', 'Keep a strong outline for keyboard navigation.', toggle('accessibility.focusVisible', value.focusVisible, { label: 'Always show keyboard focus' }))}
      ${row('Larger pointer targets', 'Increase the minimum height of interactive controls.', toggle('accessibility.largeTargets', value.largeTargets, { label: 'Larger pointer targets' }))}
      ${row('Announce layout changes', 'Report view changes to assistive technology.', toggle('accessibility.announceChanges', value.announceChanges, { label: 'Announce layout changes' }))}
      ${row('Text size', 'Scale text in the main Kick content area.', segmented('accessibility.textSize', value.textSize, [[90,'90%'],[100,'100%'],[110,'110%'],[120,'120%']]))}
      ${row('Caption background opacity', 'Set the preferred caption background strength.', range('accessibility.captionOpacity', value.captionOpacity, 0, 100, '0%', '100%', '%'), { wide: true })}
    </section>
    <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Keyboard shortcuts</h3><p>Choose memorable shortcuts that do not conflict.</p></div><button type="button" class="kf-button kf-button-small" data-action="restore-shortcuts">Restore defaults</button></div>
      <div class="kf-panel"><table class="kf-table"><thead><tr><th>Action</th><th>Current shortcut</th><th>Status</th><th class="kf-table-actions">Change</th></tr></thead><tbody>${rows.map(([key,label]) => {
        const conflict = state.shortcutError && state.shortcutCapture === key;
        const capture = state.shortcutCapture === key && !state.shortcutError;
        return `<tr class="${conflict ? 'kf-conflict' : ''}"><td>${label}</td><td><span class="kf-shortcut">${capture ? 'Press keys…' : escapeHtml(shortcuts[key])}</span></td><td>${conflict ? `<span class="kf-conflict-message">${escapeHtml(state.shortcutError)}</span>` : capture ? 'Listening' : '<span class="kf-active">OK</span>'}</td><td class="kf-table-actions">${conflict ? '<button type="button" class="kf-button kf-button-small" data-action="cancel-shortcut">Cancel</button>' : `<button type="button" class="kf-button kf-button-small" data-shortcut="${key}">${capture ? 'Cancel' : 'Change'}</button>`}</td></tr>`;
      }).join('')}</tbody></table></div>
    </section>`;
}

/**
 * Report what this build is actually storing, and anything it failed to store.
 *
 * The emote library is by far the largest payload and the one most likely to hit
 * a quota, so its size is worth showing before the write starts failing.
 */
function renderStorageHealthPanel() {
  const report = storageDiagnostics();
  const failures = describeStorageFailures(storageHealth.failures);
  const rows = report.breakdown
    .filter((entry) => entry.bytes > 0)
    .map((entry) => `<tr><th>${escapeHtml(entry.label)}</th><td>${escapeHtml(formatBytes(entry.bytes))}</td><td>${storageHealth.failures[entry.key] ? '<strong data-error="true">Not saving</strong>' : 'Saved'}</td></tr>`)
    .join('');
  return `
    <section class="kf-subsection">
      <div class="kf-panel">
        <div class="kf-action-row"><div><h3>Local storage</h3><p>${failures
          ? `${escapeHtml(failures.message)}${storageHealth.lastError ? ` The browser reported <strong>${escapeHtml(storageHealth.lastError)}</strong>.` : ''} Exporting now is the only way to keep these changes.`
          : `Kick Focus is using about ${escapeHtml(formatBytes(report.total))} of browser storage. Nothing has failed to save this session.`}</p></div>${failures ? '<button type="button" class="kf-button kf-button-primary" data-action="export">Export now</button>' : ''}</div>
        ${rows ? `<table class="kf-table"><tbody>${rows}</tbody></table>` : ''}
      </div>
    </section>`;
}

function renderAboutPage() {
  return `
    ${pageHeader('About', 'A desktop-first layout and control layer for Kick.', 'Version', VERSION)}
    <div class="kf-about-status"><div class="kf-mini-card"><span>Script health</span><strong>Active</strong></div><div class="kf-mini-card"><span>Site compatibility</span><strong data-kf-compatibility data-error="${String(Boolean(state.compatibility && !state.compatibility.healthy))}">${state.compatibility ? (state.compatibility.healthy ? 'Healthy' : 'Needs attention') : 'Checking…'}</strong></div><div class="kf-mini-card"><span>Protection layer</span><strong>${companionInfo().active ? 'Network + page' : 'Page only'}</strong></div></div>
    <section class="kf-panel">
      <div class="kf-action-row"><div><h3>Data & privacy</h3><p>Settings stay in your userscript manager. No analytics. No remote code.</p></div></div>
      ${companionInfo().active || INJECTION.grade === 'first' ? '' : `<div class="kf-action-row"><div><h3>Not running as early as it could</h3><p>This started ${escapeHtml(INJECTION.summary)}. On Chromium 138 and later a userscript manager needs its own <strong>Allow user scripts</strong> toggle enabled on the browser's extensions page, and its instant-injection mode turned on. Installing the companion extension removes the question entirely.</p></div></div>`}
      <div class="kf-action-row"><div><h3>Multi-stream</h3><p>Watch up to ${MULTISTREAM_MAX} Kick channels in one grid, with audio and chat following whichever you focus. Uses Kick’s own embedded player, so subscriptions and entitlements are unchanged.${state.multistream.streams.length ? ` Currently holding ${state.multistream.streams.length}.` : ''}</p></div><button type="button" class="kf-button" data-action="open-multistream">Open multi-stream</button></div>
      <div class="kf-action-row"><div><h3>Panic switch</h3><p>Temporarily restore Kick’s native layout and pause Kick Focus hooks without reloading. Restore it from the Focus button or with Ctrl+Shift+F.</p></div><button type="button" class="kf-button kf-danger" data-action="toggle-panic">${state.runtime.suspended ? 'Restore Kick Focus' : 'Pause Kick Focus'}</button></div>
      <div class="kf-action-row"><div><h3>If Kick sign-in, sign-up, or Follow stops working</h3><p>Since Kick began serving ads on 2026-08-06, some ad-blocker filter lists have been reported to break those actions, which fail with a generic error until the blocker is disabled and the browser restarted. Kick Focus is not involved: it blocks ${AD_HOSTS.length + TELEMETRY_HOSTS.length} third-party ad and telemetry hosts and <strong>no kick.com host at all</strong>, so pausing Kick Focus will not change that behaviour. Check your ad blocker&rsquo;s filters for kick.com before blaming an extension.</p></div></div>
      <div class="kf-action-row"><div><h3>Diagnostics</h3><p>Copy a sanitized summary or run a local self-check.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="copy-diagnostics">Copy diagnostic summary</button><button type="button" class="kf-button" data-action="self-check">Run self-check</button></div></div>
      <div class="kf-action-row"><div><h3>Compatibility self-test</h3><p data-kf-compatibility-detail>${escapeHtml(state.compatibility ? `${compatibilitySummary(state.compatibility)} Probes are checked after every route update.` : 'The shell probes will run after the page mounts.')}</p></div><button type="button" class="kf-button" data-action="self-check">Run now</button></div>
      <div class="kf-action-row"><div><h3>API drift</h3><p data-kf-api-drift>${escapeHtml(assessApiDrift(state.live.apiDrift).summary)}</p></div></div>
      <div class="kf-action-row"><div><h3>Settings portability</h3><p>Move preferences, recorded emote metadata, favorites, removals, and custom groups using one local JSON file.</p></div><div class="kf-button-group">${gmGet(PRE_IMPORT_BACKUP_KEY, null) ? `<button type="button" class="kf-button" data-action="undo-import">Undo import</button>` : ''}<button type="button" class="kf-button" data-action="import">Import settings</button><button type="button" class="kf-button" data-action="export">Export settings</button></div></div>
      <div class="kf-action-row"><div><h3>Reset all settings</h3><p>Restore every setting, shortcut, note, filter, and channel list to factory defaults. Your recorded emote library is kept.</p></div><button type="button" class="kf-button kf-danger" data-action="reset-all">Reset all settings</button></div>
    </section>
    ${renderStorageHealthPanel()}
    <section class="kf-subsection"><div class="kf-panel"><table class="kf-table"><tbody><tr><th>Target</th><td>kick.com desktop</td><th>Run timing</th><td>${escapeHtml(INJECTION.summary)}</td></tr><tr><th>Keyboard</th><td>Ctrl+K commands · Alt+K settings</td><th>Test viewports</th><td>1440×900 · 1920×1080</td></tr><tr><th>Version</th><td>${VERSION}</td><th>Remote code</th><td>None</td></tr></tbody></table></div></section>`;
}

// A stable selector for the focused control, so focus can be restored to the
// equivalent element after the page's innerHTML is replaced.
function focusRestoreKey(element) {
  for (const attr of ['data-set', 'data-action', 'data-shortcut', 'data-kf-sticker-key',
    'data-kf-sticker-assignment', 'data-kf-sticker-library-filter', 'data-kf-sticker-library-search', 'data-page']) {
    const value = element.getAttribute(attr);
    if (value != null) return `[${attr}="${value.replace(/["\\]/g, '\\$&')}"]`;
  }
  return '';
}

function renderSettingsPage() {
  if (!state.shadow) return;
  const page = state.shadow.querySelector('[data-kf-page]');
  const previousPage = page.dataset.kfCurrentPage;
  // Preserve focus and scroll across the innerHTML replacement, or a keyboard
  // user toggling a setting deep in a page is thrown back to the top on every
  // change and loses their place entirely.
  const active = state.shadow.activeElement;
  const focusKey = active && page.contains(active) ? focusRestoreKey(active) : '';
  const scrollTop = page.scrollTop;
  const renderer = {
    layout: renderLayoutPage,
    appearance: renderAppearancePage,
    content: renderContentPage,
    accessibility: renderAccessibilityPage,
    about: renderAboutPage,
  }[state.currentPage] || renderLayoutPage;
  page.innerHTML = renderer();
  page.dataset.kfCurrentPage = state.currentPage;
  state.shadow.querySelector('[data-kf-settings-shell]').dataset.kfCurrentPage = state.currentPage;
  if (previousPage && previousPage !== state.currentPage) {
    page.scrollTop = 0;
  } else {
    page.scrollTop = scrollTop;
    if (focusKey) {
      const restore = page.querySelector(focusKey);
      if (restore) restore.focus({ preventScroll: true });
    }
  }
  for (const button of state.shadow.querySelectorAll('[data-page]')) {
    button.setAttribute('aria-current', button.dataset.page === state.currentPage ? 'page' : 'false');
  }
  const reset = state.shadow.querySelector('[data-action="reset-page"]');
  reset.disabled = state.currentPage === 'about';
  localizeInterface();
  if (state.currentPage === 'content') applyStickerLibrarySearch();
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
  if (log) log.innerHTML = protectionRows();
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

function clearMediaPreferenceKind(kind) {
  const prefix = `${kind}:`;
  state.mediaPreferences = Object.fromEntries(Object.entries(state.mediaPreferences).filter(([key]) => !key.startsWith(prefix)));
  gmSet(MEDIA_PREFERENCES_KEY, state.mediaPreferences);
}

function coerceSetting(path, raw) {
  const current = getSetting(path);
  if (typeof current === 'boolean') return raw === true || raw === 'true';
  if (typeof current === 'number') return Number(raw);
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
  if (state.stickerPreferences.groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
    showToast('That emote group already exists.', true);
    return;
  }
  const id = `group_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  state.stickerPreferences.groups.push({ id, name });
  state.runtime.stickerLibraryFilter = 'all';
  saveStickerOrganization(`Created emote group “${name}”.`);
}

function renameStickerGroup(target) {
  const id = target.dataset.kfStickerGroupId;
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

function onInterfaceClick(event) {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) {
    state.currentPage = pageButton.dataset.page;
    state.shortcutCapture = null;
    state.shortcutError = '';
    renderSettingsPage();
    state.shadow.querySelector('[data-kf-page]')?.focus();
    return;
  }

  const settingButton = event.target.closest('button[data-set]');
  if (settingButton && !settingButton.disabled) {
    updateSetting(settingButton.dataset.set, coerceSetting(settingButton.dataset.set, settingButton.dataset.value));
    return;
  }

  const shortcut = event.target.closest('[data-shortcut]');
  if (shortcut) {
    const key = shortcut.dataset.shortcut;
    if (state.shortcutCapture === key) {
      state.shortcutCapture = null;
      state.shortcutError = '';
    } else {
      state.shortcutCapture = key;
      state.shortcutError = '';
    }
    renderSettingsPage();
    return;
  }

  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  if (action === 'open-command') openCommandMenu();
  else if (action === 'toggle-panic') togglePanicSwitch();
  else if (action === 'close-settings') closeSettings();
  else if (action === 'reset-page') openResetConfirmation('page');
  else if (action === 'reset-all') openResetConfirmation('all');
  else if (action === 'cancel-reset') closeResetConfirmation();
  else if (action === 'confirm-reset') confirmReset();
  else if (action === 'export') exportSettings();
  else if (action === 'import') state.shadow.querySelector('[data-kf-import]').click();
  else if (action === 'undo-import') undoImport();
  else if (action === 'copy-diagnostics') copyDiagnostics();
  else if (action === 'copy-error-log') copyErrorLog();
  else if (action === 'open-multistream') openMultistream();
  else if (action === 'close-multistream') closeMultistream();
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
    announce(`${slug} now has the audio`);
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
      showToast('Layout saved.');
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
      announce(`Loaded layout ${layout.name}`);
    }
  }
  else if (action === 'multistream-copy-layout') {
    const layout = state.multistream.layouts.find((entry) => entry.name === actionTarget.dataset.layout);
    if (!layout) return;
    const link = multistreamLayoutLink(layout.streams);
    if (!link) { showToast('That layout has no usable channels.', true); return; }
    // The link carries channel names and nothing else — no settings, no
    // identifiers, nothing from this machine.
    navigator.clipboard?.writeText(link)
      .then(() => showToast(`Copied a link to ${layout.name}.`))
      .catch(() => showToast('Could not reach the clipboard.', true));
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
  else if (action === 'restore-shortcuts') restoreShortcuts();
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
    if (current.length >= 200) { showToast('Hidden channel list is full (200).', true); return; }
    state.settings.content.hiddenChannels = [...current, path];
    saveSettings(`Hidden ${path.replace(/^\//, '')}`);
    scheduleApply(0);
    renderSettingsPage();
  } else if (action === 'remove-hidden-channel') {
    const channel = actionTarget?.dataset?.channel;
    if (!channel) return;
    state.settings.content.hiddenChannels = state.settings.content.hiddenChannels.filter((entry) => entry !== channel);
    saveSettings(`Showing ${channel.replace(/^\//, '')} again`);
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
  else if (action === 'create-sticker-group') createStickerGroup();
  else if (action === 'rename-sticker-group') renameStickerGroup(actionTarget);
  else if (action === 'delete-sticker-group') deleteStickerGroup(actionTarget);
  else if (action === 'favorite-library-sticker') toggleLibrarySticker(actionTarget, 'favorite');
  else if (action === 'remove-library-sticker') toggleLibrarySticker(actionTarget, 'remove');
  else if (action === 'restore-removed-stickers') restoreRemovedStickers();
  else if (action === 'cancel-shortcut') {
    state.shortcutCapture = null;
    state.shortcutError = '';
    renderSettingsPage();
  } else if (action.startsWith('command:')) {
    executeCommand(action.slice(8));
  }
}

function onInterfaceChange(event) {
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

function onInterfaceInput(event) {
  const search = event.target.closest('input[data-kf-sticker-library-search]');
  if (search) applyStickerLibrarySearch(search.value);
}

function openSettings(page = state.currentPage) {
  if (!state.modal) return;
  closeCommandMenu();
  state.currentPage = page;
  state.lastFocused = document.activeElement;
  renderSettingsPage();
  state.modal.hidden = false;
  requestAnimationFrame(() => state.shadow.querySelector('[data-action="close-settings"]')?.focus());
}

function closeSettings() {
  if (!state.modal) return;
  state.modal.hidden = true;
  closeResetConfirmation();
  state.shortcutCapture = null;
  state.shortcutError = '';
  try { state.lastFocused?.focus?.(); } catch { /* noop */ }
}

function openResetConfirmation(scope) {
  state.resetPending = scope;
  const container = state.shadow.querySelector('[data-kf-confirm]');
  const title = state.shadow.querySelector('[data-kf-confirm-title]');
  const copy = state.shadow.querySelector('[data-kf-confirm-copy]');
  title.textContent = scope === 'all' ? tr('Reset all Kick Focus settings?') : `${tr('Reset')} ${tr(NAV_ITEMS.find(([id]) => id === state.currentPage)?.[1] || 'this page')}?`;
  copy.textContent = scope === 'all' ? tr('Every preference, shortcut, note, filter, and channel list returns to its factory default. Your recorded emote library is kept.') : tr('Only the settings on this page will return to their defaults.');
  localizeInterface();
  container.hidden = false;
  container.querySelector('[data-action="cancel-reset"]')?.focus();
}

function closeResetConfirmation() {
  const container = state.shadow?.querySelector('[data-kf-confirm]');
  if (container) container.hidden = true;
  state.resetPending = false;
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
}

function confirmReset() {
  const scope = state.resetPending;
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
      if (section === 'accessibility') state.settings.shortcuts = { ...DEFAULT_SETTINGS.shortcuts };
      saveSettings('Page reset');
    }
  }
  closeResetConfirmation();
  renderSettingsPage();
  scheduleApply(0);
  announce('Settings reset');
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
    showToast(`Exported settings, ${state.stickerPreferences.library.size} emotes, ${counted} usage counts, ${state.multistream.layouts.length} layouts, and your channels, notes, and filters.`);
  } catch {
    showToast('Could not export settings.', true);
  }
}

// Apply every store a validated import provided. Each store the file omitted is
// left untouched (its result field is null), so a partial backup never wipes
// what it did not carry.
function applyImportedStores(result) {
  state.settings = result.value;
  if (result.stickers) {
    state.stickerPreferences = stickerPreferencesFromValue(result.stickers);
    gmSet(STICKER_PREFERENCES_KEY, result.stickers);
    state.runtime.stickerCatalogDirty = true;
    state.runtime.stickerLibraryFilter = 'all';
    state.runtime.stickerLibraryQuery = '';
  }
  if (result.usage) {
    state.emoteUsage = result.usage;
    gmSet(EMOTE_USAGE_KEY, state.emoteUsage);
  }
  if (result.multistream) {
    state.multistream = result.multistream;
    persistMultistream();
    if (multistreamOpen()) renderMultistream();
  }
  if (result.channelLayouts) gmSet(CHANNEL_LAYOUT_KEY, result.channelLayouts);
  if (result.favoriteChannels) {
    state.favorites = new Set(result.favoriteChannels);
    persistSet(FAVORITES_KEY, state.favorites);
  }
  if (result.dismissedChannels) {
    state.dismissed = new Set(result.dismissedChannels);
    persistSet(DISMISSED_KEY, state.dismissed);
  }
  if (result.chatKeywords) {
    state.chatKeywords = result.chatKeywords;
    gmSet(CHAT_KEYWORDS_KEY, state.chatKeywords);
  }
  if (result.channelNotes) {
    state.channelNotes = result.channelNotes;
    gmSet(CHANNEL_NOTES_KEY, state.channelNotes);
  }
  if (result.mediaPreferences) {
    state.mediaPreferences = result.mediaPreferences;
    gmSet(MEDIA_PREFERENCES_KEY, state.mediaPreferences);
  }
  saveSettings('Imported');
}

async function onImportFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const result = validateImportedSettings(await file.text());
    if (!result.ok) {
      showToast(result.error, true);
      return;
    }
    // Non-destructive: snapshot the current configuration before overwriting so
    // the import can be undone, then apply every store the file provided.
    gmSet(PRE_IMPORT_BACKUP_KEY, currentExportPayload());
    applyImportedStores(result);
    renderSettingsPage();
    scheduleApply(0);
    // Naming what was not kept, because an import that silently drops half a
    // configuration still reports success otherwise.
    const notes = result.notes || [];
    const undoHint = ' Previous settings backed up — use Undo import to restore them.';
    if (notes.length === 0) {
      showToast(`Settings imported.${undoHint}`);
    } else {
      showToast(`Settings imported. ${notes[0]}${notes.length > 1 ? ` (+${notes.length - 1} more)` : ''}${undoHint}`);
      announce(`Settings imported. ${notes.join(' ')}${undoHint}`);
    }
  } catch {
    showToast('Could not read that settings file.', true);
  }
}

function undoImport() {
  const backup = gmGet(PRE_IMPORT_BACKUP_KEY, null);
  if (!backup) {
    showToast('No import to undo.', true);
    return;
  }
  const result = validateImportedSettings(JSON.stringify(backup));
  if (!result.ok) {
    showToast('The backup could not be restored.', true);
    return;
  }
  applyImportedStores(result);
  gmDelete(PRE_IMPORT_BACKUP_KEY);
  renderSettingsPage();
  scheduleApply(0);
  showToast('Import undone — your previous settings are back.');
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
    settingsSchema: SETTINGS_SCHEMA,
  };
  const copied = await copyText(JSON.stringify(summary, null, 2));
  showToast(copied ? 'Diagnostic summary copied.' : 'Clipboard access was unavailable.', !copied);
}

function runSelfCheck() {
  state.compatibility = compatibilitySnapshot(document, { expectedChat: state.route === 'channel' });
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

function restoreShortcuts() {
  state.settings = normalizeSettings({ ...state.settings, shortcuts: DEFAULT_SETTINGS.shortcuts });
  state.shortcutCapture = null;
  state.shortcutError = '';
  saveSettings('Shortcuts restored');
  renderSettingsPage();
}

function clearEnhancedPage() {
  const root = document.documentElement;
  clearStickerUI();
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
  for (const node of document.querySelectorAll('[data-kf-chat-separator], [data-kf-chat-panel], [data-kf-filtered], [data-kf-mature], [data-kf-ad-shell], [data-kf-watched], [data-kf-live-card], [data-kf-dismissed], [data-kf-highlighted], [data-kf-player], [data-kf-player-resize-ready], [data-kf-card-actions], [data-kf-chat-pause], [data-kf-chat-status], [data-kf-playback-diagnostics], [data-kf-search-meta], [data-kf-drops-empty], [data-kf-native-drops-empty]')) {
    if (node.matches?.('[data-kf-card-actions], [data-kf-chat-pause], [data-kf-chat-status], [data-kf-playback-diagnostics], [data-kf-search-meta], [data-kf-drops-empty]')) node.remove();
    else {
      for (const key of Object.keys(node.dataset || {})) if (key.startsWith('kf')) delete node.dataset[key];
    }
  }
  state.siteStyle?.remove?.();
  state.siteStyle = null;
  clearTimeout(state.applyTimer);
  state.applyTimer = 0;
  clearInterval(state.playbackDiagnosticsTimer);
  state.playbackDiagnosticsTimer = 0;
  state.observers.document?.disconnect?.();
  state.observers.body?.disconnect?.();
  state.observers.chat?.disconnect?.();
  state.observers.stickers?.disconnect?.();
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
  if (state.modal) state.modal.hidden = true;
  if (state.command) state.command.hidden = true;
  state.runtime.suspended = true;
  syncQuickButton();
}

function restoreEnhancedPage() {
  state.runtime.suspended = false;
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
  alert.querySelector('[data-kf-storage-alert-copy]').textContent = summary.message;
  alert.dataset.kfStorageSignature = signature;
  alert.hidden = false;
  announce(summary.message);
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
  text.textContent = message;
  toast.append(text);
  for (const action of actions) {
    if (!action || typeof action.onClick !== 'function') continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kf-toast-action';
    button.textContent = action.label;
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
    { id: 'panic', label: tr(state.runtime.suspended ? 'Restore Kick Focus' : 'Pause Kick Focus'), description: tr('Temporarily remove enhanced layout and request hooks'), key: 'Ctrl+Shift+F' },
    { id: 'focus', label: tr(state.runtime.focus ? 'Exit focus mode' : 'Enter focus mode'), description: tr('Maximize the stream and hide side panels'), key: state.settings.shortcuts.focus },
    { id: 'theater', label: tr(state.runtime.theater ? 'Exit theater mode' : 'Enter theater mode'), description: tr('Hide discovery while keeping chat'), key: 'T' },
    { id: 'chat', label: tr(state.runtime.chatHidden ? 'Show chat' : 'Hide chat'), description: tr('Toggle the chat panel for this session'), key: state.settings.shortcuts.chat },
    { id: 'sidebar', label: tr(state.runtime.sidebarHidden ? 'Show sidebar' : 'Hide sidebar'), description: tr('Toggle the discovery rail for this session'), key: state.settings.shortcuts.sidebar },
    { id: 'mature', label: tr(state.runtime.matureVisible ? 'Blur mature thumbnails' : 'Reveal mature thumbnails'), description: tr('Temporarily override mature-card blur'), key: state.settings.shortcuts.mature },
    { id: 'density', label: tr(`Use ${state.settings.layout.density === 'compact' ? 'comfortable' : 'compact'} density`), description: tr('Change discovery spacing and save it'), key: 'D' },
    { id: 'casino', label: tr(state.settings.content.hideCasino ? 'Show casino content' : 'Hide casino content'), description: tr('Filter clearly labeled casino streams'), key: 'G' },
    { id: 'multistream', label: tr(multistreamOpen() ? 'Close multi-stream' : 'Open multi-stream'), description: tr('Watch several Kick channels in one grid'), key: '' },
    { id: 'settings', label: tr('Open Kick Focus settings'), description: tr('Customize layout, appearance, content, and access'), key: state.settings.shortcuts.settings },
  ];
}

function renderCommands() {
  if (!state.commandList) return;
  const query = (state.commandInput?.value || '').trim().toLowerCase();
  const commands = commandDefinitions().filter((command) => `${command.label} ${command.description}`.toLowerCase().includes(query));
  state.commandList.innerHTML = commands.length
    ? commands.map((command, index) => `<button type="button" class="kf-command-item" role="option" data-action="command:${command.id}" data-active="${index === 0}"><div><strong>${escapeHtml(command.label)}</strong><span>${escapeHtml(command.description)}</span></div><span class="kf-shortcut">${escapeHtml(command.key)}</span></button>`).join('')
    : '<div class="kf-command-empty">No matching commands.</div>';
  localizeInterface();
}

function openCommandMenu() {
  if (!state.command) return;
  closeSettings();
  state.command.hidden = false;
  state.commandInput.value = '';
  renderCommands();
  requestAnimationFrame(() => state.commandInput.focus());
}

function closeCommandMenu() {
  if (state.command) state.command.hidden = true;
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
  } else if (id === 'settings') {
    openSettings();
    return;
  }
  closeCommandMenu();
  saveChannelLayout();
  scheduleApply(0);
}

function onCommandKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCommandMenu();
  } else if (event.key === 'Enter') {
    const first = state.commandList.querySelector('[data-action^="command:"]');
    if (first) {
      event.preventDefault();
      executeCommand(first.dataset.action.slice(8));
    }
  }
}

function eventShortcut(event) {
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (!['Control','Alt','Shift','Meta'].includes(key)) parts.push(key);
  return parts.join('+');
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
}

/**
 * Keep Tab inside whichever overlay is on top.
 *
 * Every modal surface needs this, not just settings: tabbing out of a dialog
 * lands on a page the user cannot see, and in the multi-stream grid the next
 * stops are cross-origin player frames whose interiors cannot be focus-managed
 * at all. Containment at the host is the only control available there.
 */
function topmostOverlayShell() {
  if (multistreamOpen()) return state.shadow?.querySelector('.kf-ms-shell');
  if (state.command && !state.command.hidden) return state.shadow?.querySelector('.kf-command-shell');
  if (state.modal && !state.modal.hidden) return state.shadow?.querySelector('[data-kf-settings-shell]');
  return null;
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

function onGlobalKeydown(event) {
  if (!state.shadow) return;
  if (event.ctrlKey && event.shiftKey && String(event.key).toLowerCase() === 'f') {
    event.preventDefault();
    event.stopPropagation();
    togglePanicSwitch();
    return;
  }
  if (state.shortcutCapture) {
    if (event.key === 'Escape') {
      event.preventDefault();
      state.shortcutCapture = null;
      state.shortcutError = '';
      renderSettingsPage();
      return;
    }
    const shortcut = eventShortcut(event);
    if (!shortcut) return;
    event.preventDefault();
    event.stopPropagation();
    const conflictKey = findShortcutConflict(state.settings.shortcuts, state.shortcutCapture, shortcut);
    if (conflictKey) {
      state.shortcutError = `${shortcut} is already used by ${conflictKey}.`;
      renderSettingsPage();
      return;
    }
    state.settings = normalizeSettings({ ...state.settings, shortcuts: { ...state.settings.shortcuts, [state.shortcutCapture]: shortcut } });
    state.shortcutCapture = null;
    state.shortcutError = '';
    saveSettings('Shortcut saved');
    renderSettingsPage();
    return;
  }

  if (multistreamOpen() && event.key === 'Escape') {
    event.preventDefault();
    closeMultistream();
    return;
  }
  if (!state.modal.hidden && event.key === 'Escape') {
    event.preventDefault();
    closeSettings();
    return;
  }
  if (trapFocus(event)) return;
  if (!state.command.hidden && event.key === 'Escape') {
    event.preventDefault();
    closeCommandMenu();
    return;
  }

  const shortcut = eventShortcut(event);
  const isGlobalCombo = shortcut === state.settings.shortcuts.command || shortcut === state.settings.shortcuts.settings;
  const actualTarget = event.composedPath?.()[0] || event.target;
  if (isTypingTarget(actualTarget) && !isGlobalCombo) return;
  const action = Object.entries(state.settings.shortcuts).find(([, value]) => value.toLowerCase() === shortcut.toLowerCase())?.[0];
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  if (action === 'command') openCommandMenu();
  else if (action === 'settings') openSettings();
  else executeCommand(action);
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
    host.dataset.kfHeaderControl = 'true';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { display: inline-flex; flex: 0 0 auto; gap: 6px; color-scheme: dark; }
        * { box-sizing: border-box; }
        button {
          display: inline-flex;
          height: 36px;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 11px;
          border: 1px solid rgba(124,255,43,.38);
          border-radius: 5px;
          background: linear-gradient(180deg, rgba(124,255,43,.12), rgba(124,255,43,.055));
          color: #f4f7f5;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
          cursor: pointer;
          font: 750 12px/1 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: .015em;
          white-space: nowrap;
          transition: border-color 120ms ease, background 120ms ease, color 120ms ease, transform 80ms ease;
        }
        button:hover { border-color: #7cff2b; background: rgba(124,255,43,.15); color: #7cff2b; }
        button:active { transform: scale(.97); }
        button:focus-visible { outline: 2px solid #f4f7f5; outline-offset: 2px; }
        img { display: block; width: 18px; height: 18px; object-fit: contain; }
        .kf-header-multi svg { width: 15px; height: 15px; fill: currentColor; opacity: .9; }
        .kf-header-add [data-kf-header-add-icon] { font-weight: 800; font-size: 14px; }
        .kf-header-add[data-in-multi="true"] { border-color: #7cff2b; background: rgba(124,255,43,.2); color: #7cff2b; }
        @media (max-width: 960px) {
          button { width: 36px; padding: 0; }
          span { display: none; }
        }
      </style>
      <button type="button" data-kf-header-focus aria-label="Open Kick Focus command menu" title="Kick Focus">
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
      </button>`;
    const button = shadow.querySelector('[data-kf-header-focus]');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.runtime.suspended) togglePanicSwitch();
      else openCommandMenu();
    });
    // Multi-stream is a headline feature; burying it in a settings page is not
    // "easily add multiple streams".
    shadow.querySelector('[data-kf-header-multi]').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (multistreamOpen()) closeMultistream();
      else openMultistream();
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
  if (label) label.textContent = inGrid ? 'In Multi' : 'Multi';
  button.setAttribute('aria-label', inGrid
    ? `Remove ${slug} from Kick Focus multi-stream`
    : `Add ${slug} to Kick Focus multi-stream`);
}

function syncQuickButton() {
  if (!state.root?.isConnected && document.body) document.body.append(state.root);
  if (!state.quickButton) return;
  const shouldShow = state.runtime.suspended || state.settings.layout.quickButton;
  const headerMounted = shouldShow ? ensureHeaderQuickControl() : false;
  if (!shouldShow) state.headerControlHost?.remove?.();
  const label = tr(state.runtime.suspended ? 'Resume' : 'Focus');
  const accessibleLabel = tr(state.runtime.suspended ? 'Restore Kick Focus' : 'Open Kick Focus command menu');
  if (state.headerControlButton) {
    state.headerControlButton.querySelector('[data-kf-header-control-label]').textContent = label;
    state.headerControlButton.setAttribute('aria-label', accessibleLabel);
    state.headerControlButton.title = label;
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
  state.quickButton.dataset.action = 'open-command';
  state.quickButton.textContent = label;
  state.quickButton.setAttribute('aria-label', accessibleLabel);
  state.quickButton.hidden = !shouldShow || headerMounted;
}

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
  announce(`Opened a shared layout with ${shared.length} ${plural(shared.length, 'channel', 'channels')}.`);
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
  installRuntimeInteractions();
  installDocumentObserver();
  installRemoteBlocklistTimer();
  scheduleApply(0);
  // Both content scripts have certainly registered their listeners by now, so
  // this is the announcement the companion can rely on receiving.
  publishSettingsState();
}

startWhenBodyExists();
