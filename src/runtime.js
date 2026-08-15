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
const PAGE_BLOCK_EVENT = 'kick-focus:request-blocked';
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
  },
  diagnostics: {
    blocked: 0,
    shells: 0,
    lastMatch: 'None yet',
    entries: [],
  },
  shortcutCapture: null,
  shortcutError: '',
  resetPending: false,
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
  },
  mediaBound: new WeakSet(),
  mediaSaveTimers: new WeakMap(),
  playbackDiagnosticsTimer: 0,
  remoteSyncTimer: 0,
  remoteSyncInFlight: false,
};

/**
 * The companion extension marks the document from its isolated world. Its
 * presence means ad requests are blocked at the browser network layer before
 * they are sent, rather than only at the page layer this script can reach.
 */
function companionInfo() {
  const version = document.documentElement?.dataset?.kickFocusCompanion || '';
  return { active: Boolean(version), version };
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

function gmSet(key, value) {
  try {
    if (typeof GM_setValue === 'function') GM_setValue(key, value);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
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
    if (nativeFetch) {
      pageWindow.fetch = function kickFocusFetch(input, init) {
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
      };
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

      xhrPrototype.open = function kickFocusOpen(method, url, ...rest) {
        this.__kfRequest = state.runtime.suspended ? { blocked: false } : classify(url);
        this.__kfPlayback = !state.runtime.suspended && isPlaybackUrl(url);
        return nativeOpen.call(this, method, url, ...rest);
      };
      xhrPrototype.send = function kickFocusSend(...args) {
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
      };
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
    --kf-panel: #0d100e;
    --kf-panel-raised: #151917;
    --kf-border: #303632;
    --kf-radius: 9px;
    --kf-chat-width: 380px;
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

  body { background: #080a09 !important; }

  @media (min-width: 1024px) {
    #main-container { background: #090b0a !important; }
    #sidebar-wrapper { border-right: 1px solid var(--kf-border) !important; background: var(--kf-panel) !important; }
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

    html[data-kf-wide-grid="true"] #main-container section[class*="grid"],
    html[data-kf-wide-grid="true"] #main-container [class*="group/grid"] {
      grid-template-columns: repeat(auto-fit, minmax(min(272px, 100%), 1fr)) !important;
      gap: 20px !important;
    }

    html[data-kf-following-rail="false"] #main-container [data-testid*="following" i],
    html[data-kf-following-rail="false"] #main-container [data-kf-following-rail],
    html[data-kf-recommended-rail="false"] #main-container [data-testid*="recommended" i],
    html[data-kf-recommended-rail="false"] #main-container [data-kf-recommended-rail] { display: none !important; }

    html[data-kf-density="compact"] #main-container section[class*="grid"],
    html[data-kf-density="compact"] #main-container [class*="group/grid"] { gap: 12px !important; }

    html[data-kf-sticky="true"] nav {
      min-height: 56px !important;
      backdrop-filter: none !important;
      background: #0b0e0c !important;
      border-bottom: 1px solid var(--kf-border) !important;
    }

    #main-container { font-size: calc(1rem * var(--kf-text-scale)); }

    #main-container [class*="group/card"] {
      border-radius: var(--kf-radius) !important;
      outline: 1px solid transparent;
      outline-offset: 3px;
      transition: filter 150ms ease, outline-color 150ms ease !important;
    }

    #main-container [class*="group/card"]:hover,
    #main-container [class*="group/card"]:focus-within {
      outline-color: rgba(var(--kf-accent-rgb), .46);
    }

    #main-container [class*="group/card"] img {
      filter: saturate(var(--kf-thumb-saturation));
      transition: filter 160ms ease, opacity 160ms ease !important;
    }

    html[data-kf-dim-watched="true"] #main-container [data-kf-watched="true"] {
      opacity: .64;
      filter: grayscale(.14);
    }

    html[data-kf-live-color="true"] #main-container [data-kf-live-card="true"] {
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

    [data-kf-search-meta] { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; margin: 0 0 14px !important; color: var(--kf-accent) !important; font-size: 13px !important; font-weight: 720 !important; }
    [data-kf-search-meta] button { min-height: 30px !important; padding: 0 10px !important; border: 1px solid var(--kf-border) !important; border-radius: 4px !important; background: var(--kf-panel) !important; color: inherit !important; cursor: pointer !important; }

    [data-kf-sticker-organizer] {
      margin: 4px 10px 10px !important;
      padding: 8px 0 10px !important;
      border-bottom: 1px solid rgba(255,255,255,.12) !important;
      color: #f7f9fa !important;
    }

    [data-kf-sticker-toolbar] {
      display: flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 5px !important;
      font-size: 11px !important;
    }

    [data-kf-sticker-toolbar] strong { margin-right: 2px !important; color: var(--kf-accent) !important; font-size: 12px !important; }
    [data-kf-sticker-count], [data-kf-sticker-note], [data-kf-sticker-locked] { color: rgba(247,249,250,.62) !important; }
    [data-kf-sticker-locked] { margin-left: auto !important; }
    [data-kf-sticker-toolbar] button {
      min-height: 28px !important;
      padding: 0 7px !important;
      border: 1px solid rgba(255,255,255,.18) !important;
      border-radius: 4px !important;
      background: rgba(255,255,255,.05) !important;
      color: inherit !important;
      cursor: pointer !important;
      font: inherit !important;
    }
    [data-kf-sticker-toolbar] button:hover,
    [data-kf-sticker-toolbar] button[data-active="true"] { border-color: var(--kf-accent) !important; color: var(--kf-accent) !important; }
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
    [data-kf-sticker-quick-empty] { color: rgba(247,249,250,.6) !important; font-size: 10px !important; line-height: 1.35 !important; }
    [data-kf-sticker-grid] {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)) !important;
      gap: 7px !important;
      max-height: min(320px, 38vh) !important;
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
    html[data-kf-sticker-view="all"] #chat-emotes-picker-panel button[data-kf-sticker-key][data-kf-sticker-native="true"],
    html[data-kf-sticker-view="pinned"] #chat-emotes-picker-panel button[data-kf-sticker-key][data-kf-sticker-native="true"],
    html[data-kf-sticker-view="group"] #chat-emotes-picker-panel button[data-kf-sticker-key][data-kf-sticker-native="true"] { display: none !important; }
    html[data-kf-sticker-view="all"] #chat-emotes-picker-panel [data-kf-sticker-native-group],
    html[data-kf-sticker-view="pinned"] #chat-emotes-picker-panel [data-kf-sticker-native-group],
    html[data-kf-sticker-view="group"] #chat-emotes-picker-panel [data-kf-sticker-native-group] { display: none !important; }
    #chat-emotes-picker-panel button[data-kf-sticker-hidden="true"][data-kf-sticker-native="true"] { display: none !important; }
    html[data-kf-stickers-show-hidden="true"] #chat-emotes-picker-panel button[data-kf-sticker-hidden="true"][data-kf-sticker-native="true"] { display: flex !important; opacity: .42 !important; }

    html[data-kf-large-targets="true"] :is(button, a, input, select, textarea) { min-height: 40px; }

    html[data-kf-contrast="true"] #main-container :is(p, span, div) { text-shadow: 0 0 .01px currentColor; }

    html[data-kf-focus-visible="true"] :is(button, a, input, select, textarea):focus-visible {
      outline: 3px solid var(--kf-accent) !important;
      outline-offset: 3px !important;
    }

    html[data-kf-focus="true"] #main-container {
      width: 100% !important;
      max-width: none !important;
    }

    html[data-kf-route="category"] #main-container > div:first-child {
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
  root.dataset.kfMiniPlayerCollision = String(layout.miniPlayerCollision && layout.quickButton);
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
    studio: ['#171a1c', '#232629', '#0b0b0c'],
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

function stickerPreferencesFromValue(value) {
  return {
    pinned: new Set(value.pinned),
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
    pinned: [...preferences.pinned],
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

function readRemoteBlocklist() {
  const stored = gmGet(REMOTE_BLOCKLIST_KEY, null);
  const result = validateRemoteBlocklist(stored?.payload);
  if (!stored || !result.ok || typeof stored.source !== 'string') {
    return { source: '', fetchedAt: 0, attemptedAt: 0, channels: new Set(), categories: new Set(), keywords: new Set(), status: 'off' };
  }
  return {
    source: stored.source,
    fetchedAt: Number(stored.fetchedAt) || 0,
    attemptedAt: Number(stored.attemptedAt) || 0,
    channels: new Set(result.value.channels),
    categories: new Set(result.value.categories),
    keywords: new Set(result.value.keywords),
    status: 'ready',
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
      if (!video.paused) video.pause();
      if (video.dataset.kfAutoplayHandled === 'true') continue;
      video.dataset.kfAutoplayHandled = 'true';
      video.addEventListener('play', () => {
        // Leave manual playback alone: only the home rail is silenced, and only
        // while the setting is on.
        if (state.route !== 'home' || !state.settings.content.pauseHomeAutoplay) return;
        video.muted = true;
        video.pause();
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
  const input = main.querySelector?.('[data-testid="search"], input[type="search"]');
  let meta = existing;
  if (!meta) {
    meta = document.createElement('div');
    meta.dataset.kfSearchMeta = 'true';
    meta.setAttribute('role', 'status');
    const anchor = main.querySelector?.('h1, h2, [data-testid="search-results"]') || main.firstElementChild;
    if (anchor?.parentElement) anchor.parentElement.insertBefore(meta, anchor);
    else main.prepend(meta);
  }
  meta.innerHTML = `<span>${count} ${count === 1 ? 'result' : 'results'}</span>${input?.value ? '<button type="button" data-kf-clear-search aria-label="Clear search">Clear</button>' : ''}`;
}

function handleSearchAction(event) {
  const button = event.target.closest?.('[data-kf-clear-search]');
  if (!button) return;
  const main = findProbe(document, 'main').element;
  const input = main?.querySelector?.('[data-testid="search"], input[type="search"]');
  if (!input) return;
  event.preventDefault();
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  scheduleApply(0);
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
  const saveVolume = () => saveMediaPreference('volume', { volume: video.volume, muted: video.muted });
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

function applyQualityMemory() {
  if (!state.settings.content.rememberQuality) return;
  const key = mediaPreferenceKey('quality');
  if (!key) return;
  const saved = state.mediaPreferences[key];
  const controls = document.querySelectorAll('[data-quality], [data-resolution], [data-testid*="quality" i], [aria-label*="quality" i], select[data-kf-quality]');
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

function stickerButtonInfo(button, options = {}) {
  if (button.closest?.('[data-kf-sticker-organizer]')) return null;
  if (!options.includeUnavailable && stickerButtonUnavailable(button)) return null;
  const image = button.querySelector('img[src*="/emotes/" i], img[data-src*="/emotes/" i]');
  if (!image) return null;
  const rawSrc = image.getAttribute('src') || image.getAttribute('data-src') || image.currentSrc || image.src || '';
  if (!/\/emotes\//i.test(rawSrc)) return null;
  const alt = image.getAttribute('alt') || button.getAttribute('aria-label') || button.dataset.emoteName || 'Sticker';
  if (alt.trim().toLowerCase() === 'emotes') return null;
  const src = rawSrc;
  const rawId = button.dataset.emoteId
    || image.dataset.emoteId
    || button.getAttribute('data-emote-id')
    || image.getAttribute('data-emote-id')
    || rawSrc.match(/\/emotes\/(\d+)/i)?.[1]
    || '';
  const id = String(rawId).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  const name = String(alt).replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sticker';
  const key = (id ? `id:${id}` : `name:${name.toLowerCase()}|src:${src}`).slice(0, 320);
  return { key, id, name, src, button };
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
  for (const label of picker.querySelectorAll('[id^="emote-picker-section-name-"]')) {
    const group = stickerNativeGroup(label, picker);
    if (!group) continue;
    group.dataset.kfStickerNativeGroup = 'true';
    const name = String(label.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!name) continue;
    for (const button of group.querySelectorAll('button')) {
      if (stickerButtonInfo(button, { includeUnavailable: true })) groupsByButton.set(button, name);
    }
  }
  return groupsByButton;
}

function mergeStickerLibrary(observed) {
  let changed = false;
  for (const sticker of observed) {
    const existing = state.stickerPreferences.library.get(sticker.key);
    const nativeGroups = [...new Set([...(existing?.nativeGroups || []), ...sticker.nativeGroups])].slice(0, 20);
    const record = {
      key: sticker.key,
      id: sticker.id,
      name: sticker.name,
      src: sticker.src,
      nativeGroups,
      access: existing?.access === 'available' || sticker.available ? 'available' : 'locked',
    };
    if (!existing || JSON.stringify(existing) !== JSON.stringify(record)) {
      state.stickerPreferences.library.set(sticker.key, record);
      changed = true;
    }
  }
  if (!changed) return false;
  persistStickerPreferences();
  for (const summary of state.shadow?.querySelectorAll('[data-kf-sticker-library-summary]') || []) {
    summary.textContent = stickerLibrarySummary();
  }
  return true;
}

function disconnectStickerObserver() {
  state.observers.stickers?.disconnect?.();
  state.observers.stickers = null;
  state.runtime.stickerPickerTarget = null;
}

function observeStickerPicker(picker) {
  if (state.runtime.stickerPickerTarget === picker && state.observers.stickers) return;
  disconnectStickerObserver();
  state.runtime.stickerPickerTarget = picker;
  state.observers.stickers = new MutationObserver((mutations) => {
    if (mutations.every((mutation) => mutation.target.closest?.('[data-kf-sticker-organizer]'))) return;
    scheduleApply(35);
  });
  state.observers.stickers.observe(picker, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['alt', 'aria-disabled', 'disabled', 'src', 'data-src', 'data-emote-id'],
  });
}

function stickerDescriptors(picker) {
  for (const node of picker.querySelectorAll('[data-kf-sticker-key], [data-kf-sticker-native-group]')) {
    if (node.closest('[data-kf-sticker-organizer]')) continue;
    node.removeAttribute('data-kf-sticker-key');
    node.removeAttribute('data-kf-sticker-hidden');
    node.removeAttribute('data-kf-sticker-pinned');
    node.removeAttribute('data-kf-sticker-native');
    node.removeAttribute('data-kf-sticker-native-group');
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
    const pinned = state.stickerPreferences.pinned.has(descriptor.key);
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

function stickerProxyMarkup(descriptor) {
  const pinned = state.stickerPreferences.pinned.has(descriptor.key);
  const hidden = state.stickerPreferences.hidden.has(descriptor.key);
  const safeKey = escapeHtml(descriptor.key);
  const safeName = escapeHtml(descriptor.name);
  return `<div data-kf-sticker-item="true" data-kf-sticker-key="${safeKey}" data-kf-sticker-hidden="${hidden}">
    <button type="button" data-kf-sticker-action="send" data-kf-sticker-key="${safeKey}" class="kf-sticker-proxy" aria-label="Use sticker ${safeName}" title="Use ${safeName}"><img src="${escapeHtml(descriptor.src)}" alt="${safeName}" loading="lazy"></button>
    <div data-kf-sticker-tools>
      <button type="button" data-kf-sticker-action="pin" data-kf-sticker-key="${safeKey}" aria-pressed="${pinned}" aria-label="${pinned ? 'Remove favorite' : 'Favorite'} ${safeName}" title="${pinned ? 'Remove favorite' : 'Favorite'}">${pinned ? '★' : '☆'}</button>
      <button type="button" data-kf-sticker-action="hide" data-kf-sticker-key="${safeKey}" aria-label="${hidden ? 'Restore' : 'Remove'} ${safeName}" title="${hidden ? 'Restore' : 'Remove'}">${hidden ? '↶' : '×'}</button>
    </div>
  </div>`;
}

function stickerQuickProxyMarkup(descriptor) {
  const safeKey = escapeHtml(descriptor.key);
  const safeName = escapeHtml(descriptor.name);
  return `<div data-kf-sticker-quick-item="true">
    <button type="button" data-kf-sticker-action="send" data-kf-sticker-key="${safeKey}" aria-label="Use favorite sticker ${safeName}" title="Use ${safeName}"><img src="${escapeHtml(descriptor.src)}" alt="${safeName}" loading="lazy"></button>
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
  for (const node of document.querySelectorAll('[data-kf-sticker-key], [data-kf-sticker-native-group]')) {
    if (node.closest('[data-kf-sticker-organizer]')) continue;
    node.removeAttribute('data-kf-sticker-key');
    node.removeAttribute('data-kf-sticker-hidden');
    node.removeAttribute('data-kf-sticker-pinned');
    node.removeAttribute('data-kf-sticker-native');
    node.removeAttribute('data-kf-sticker-native-group');
  }
  delete document.documentElement.dataset.kfStickerView;
  delete document.documentElement.dataset.kfStickersShowHidden;
  state.stickerCatalog = new Map();
}

function renderStickerOrganizer() {
  const picker = stickerPicker();
  if (!picker) {
    disconnectStickerObserver();
    state.stickerCatalog = new Map();
    return;
  }
  observeStickerPicker(picker);
  const descriptors = stickerDescriptors(picker);
  if (!state.settings.content.organizeChatStickers) {
    clearStickerUI();
    return;
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
  const quickFavorites = descriptors.filter((descriptor) => state.stickerPreferences.pinned.has(descriptor.key)
    && !state.stickerPreferences.hidden.has(descriptor.key));
  const visible = state.stickerPreferences.view === 'pinned'
    ? allVisible.filter((descriptor) => state.stickerPreferences.pinned.has(descriptor.key))
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
    [...state.stickerPreferences.pinned].join(','),
    [...state.stickerPreferences.hidden].join(','),
    state.stickerPreferences.groups.map((group) => `${group.id}:${group.name}`).join(','),
    [...state.stickerPreferences.assignments].map(([key, groupId]) => `${key}:${groupId}`).join(','),
  ].join('\u0001');
  if (organizer.dataset.kfStickerSignature === signature) return;
  organizer.dataset.kfStickerSignature = signature;
  const view = state.stickerPreferences.view;
  const countLabel = `${visible.length} ${visible.length === 1 ? 'sticker' : 'stickers'}`;
  const unavailableLabel = unavailableCount
    ? `<span data-kf-sticker-locked>${unavailableCount} locked by Kick</span>`
    : '';
  const quickShelf = quickFavorites.length
    ? `<div data-kf-sticker-quick-grid role="group" aria-label="Three-row one-click favorite stickers">${quickFavorites.map(stickerQuickProxyMarkup).join('')}</div>`
    : '<div data-kf-sticker-quick-empty>Favorite stickers with ☆ to fill up to three rows of one-click shortcuts.</div>';
  const list = view === 'native'
    ? '<div data-kf-sticker-empty>Kick’s native sticker groups are shown below.</div>'
    : visible.length
      ? `<div data-kf-sticker-grid>${visible.map(stickerProxyMarkup).join('')}</div>`
      : `<div data-kf-sticker-empty>${view === 'pinned' ? 'Favorite stickers here to build your shelf.' : view === 'group' ? 'No available stickers are assigned to this group.' : 'No stickers match this search.'}</div>`;
  const customGroups = state.stickerPreferences.groups.map((group) => {
    const count = allVisible.filter((descriptor) => state.stickerPreferences.assignments.get(descriptor.key) === group.id).length;
    const active = view === 'group' && state.stickerPreferences.activeGroup === group.id;
    return `<button type="button" data-kf-sticker-view="group" data-kf-sticker-group="${escapeHtml(group.id)}" data-active="${active}" aria-pressed="${active}">${escapeHtml(group.name)} (${count})</button>`;
  }).join('');
  organizer.innerHTML = `
    <div data-kf-sticker-toolbar>
      <strong>Sticker shelf</strong>
      <span data-kf-sticker-count>${escapeHtml(countLabel)}</span>
      <button type="button" data-kf-sticker-view="pinned" data-active="${view === 'pinned'}" aria-pressed="${view === 'pinned'}">Favorites (${state.stickerPreferences.pinned.size})</button>
      <button type="button" data-kf-sticker-view="all" data-active="${view === 'all'}" aria-pressed="${view === 'all'}">All available (${allVisible.length})</button>
      ${customGroups}
      <button type="button" data-kf-sticker-view="native" data-active="${view === 'native'}" aria-pressed="${view === 'native'}">Native groups</button>
      <button type="button" data-kf-sticker-show-hidden="true" aria-pressed="${showHidden}">${showHidden ? 'Hide removed' : 'Show removed'}</button>
      <button type="button" data-kf-sticker-reset="true">Reset changes</button>
      ${unavailableLabel}
    </div>
    <div data-kf-sticker-note>New Kick stickers are saved automatically. Favorite with ☆ for a one-click shortcut, remove with ×, and manage custom groups in Kick Focus settings.</div>
    <section data-kf-sticker-quick-shelf="true">
      <div data-kf-sticker-quick-header><strong>Quick favorites</strong><span data-kf-sticker-quick-count>${quickFavorites.length} available · 3 rows</span><button type="button" data-kf-sticker-view="pinned" aria-pressed="${view === 'pinned'}">Manage</button></div>
      ${quickShelf}
    </section>
    ${list}`;
  restoreStickerGridScroll(organizer, previousGridScrollTop);
}

function resetStickerPreferences(options = {}) {
  const keepLibrary = options.keepLibrary === true;
  const library = keepLibrary ? state.stickerPreferences.library : new Map();
  state.runtime.stickerLibraryFilter = 'all';
  state.runtime.stickerLibraryQuery = '';
  state.stickerPreferences = {
    pinned: new Set(),
    hidden: new Set(),
    view: 'all',
    showHidden: false,
    activeGroup: '',
    groups: [],
    assignments: new Map(),
    library,
  };
  if (keepLibrary) persistStickerPreferences();
  else gmDelete(STICKER_PREFERENCES_KEY);
}

function clearStickerPreferences() {
  resetStickerPreferences({ keepLibrary: true });
  renderSettingsPage();
  scheduleApply(0);
  showToast('Sticker favorites, removals, and custom groups reset.');
}

function handleStickerAction(event) {
  const target = event.target.closest?.('[data-kf-sticker-action], [data-kf-sticker-view], [data-kf-sticker-show-hidden], [data-kf-sticker-reset]');
  if (!target || !target.closest?.('[data-kf-sticker-organizer]')) return;
  event.preventDefault();
  event.stopPropagation();
  const key = target.dataset.kfStickerKey;
  const action = target.dataset.kfStickerAction;
  if (action === 'send') {
    const original = state.stickerCatalog.get(key)?.originals?.find((button) => button.isConnected);
    original?.click?.();
    return;
  }
  if ((action === 'pin' || action === 'hide') && key) rememberStickerGridScroll(target);
  if (action === 'pin' && key) {
    if (state.stickerPreferences.pinned.has(key)) state.stickerPreferences.pinned.delete(key);
    else {
      state.stickerPreferences.pinned.add(key);
      state.stickerPreferences.hidden.delete(key);
    }
    persistStickerPreferences();
    announce(state.stickerPreferences.pinned.has(key) ? 'Sticker pinned' : 'Sticker unpinned');
  } else if (action === 'hide' && key) {
    if (state.stickerPreferences.hidden.has(key)) state.stickerPreferences.hidden.delete(key);
    else {
      state.stickerPreferences.hidden.add(key);
      state.stickerPreferences.pinned.delete(key);
    }
    persistStickerPreferences();
    announce(state.stickerPreferences.hidden.has(key) ? 'Sticker removed' : 'Sticker restored');
  } else if (target.dataset.kfStickerView) {
    state.stickerPreferences.view = target.dataset.kfStickerView;
    state.stickerPreferences.activeGroup = target.dataset.kfStickerGroup || state.stickerPreferences.activeGroup;
    persistStickerPreferences();
  } else if (target.dataset.kfStickerShowHidden) {
    state.stickerPreferences.showHidden = !state.stickerPreferences.showHidden;
    persistStickerPreferences();
  } else if (target.dataset.kfStickerReset) {
    resetStickerPreferences({ keepLibrary: true });
    announce('Sticker changes reset');
  } else {
    return;
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
  if (remote.status === 'ready') return `Active: ${remote.channels.size} channels, ${remote.categories.size} categories, and ${remote.keywords.size} keywords. Last checked ${new Date(remote.fetchedAt).toLocaleString()}.`;
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
  state.remoteBlocklist = { source: '', fetchedAt: 0, attemptedAt: 0, channels: new Set(), categories: new Set(), keywords: new Set(), status: 'off' };
  updateRemoteBlocklistInPlace();
  scheduleApply(0);
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
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  fetch(url.href, { credentials: 'omit', cache: 'no-store', signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((text) => {
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
      };
      gmSet(REMOTE_BLOCKLIST_KEY, { source: url.href, fetchedAt: state.remoteBlocklist.fetchedAt, payload });
      recordProtection('Blocklist', { category: 'local', label: `validated ${payload.channels.length + payload.categories.length + payload.keywords.length} entries` });
      scheduleApply(0);
    })
    .catch(() => {
      state.remoteBlocklist.status = sameSource && state.remoteBlocklist.fetchedAt ? 'stale' : 'error';
      updateRemoteBlocklistInPlace();
    })
    .finally(() => {
      window.clearTimeout(timeout);
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
    const labels = detectContentLabels(node.textContent, cardContext(node));
    const link = node.matches?.('a[href]') ? node : node.querySelector?.('a[href]');
    let path = '';
    try { path = link ? new URL(link.href, location.origin).pathname : ''; } catch { /* noop */ }
    if (labels.casino && path) state.casinoPaths.add(path);
    if (path && state.casinoPaths.has(path)) labels.casino = true;
    node.dataset.kfWatched = String(Boolean(path && state.watched.has(path)));
    node.dataset.kfLiveCard = String(/(^|\s)live(?:\s|$)/i.test(node.textContent || ''));
    node.dataset.kfDismissed = String(Boolean(path && state.dismissed.has(path)));
    const remoteBlocked = remoteBlocklistMatches(path, cardContext(node), node.textContent);
    const hide = remoteBlocked
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
    applyMediaMemory();
    applyPlayerResilience();
    applyChatPause();
    renderStickerOrganizer();
    applyChatHighlights();
    applyPlaybackDiagnostics();
    state.compatibility = compatibilitySnapshot(document, { expectedChat: state.route === 'channel' });
    updateCompatibilityInPlace();
    syncQuickButton();
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
    'Every preference and shortcut will return to its factory default.': 'Todas las preferencias y atajos volverán a sus valores de fábrica.',
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
    'English': 'Inglés',
    'Español': 'Español',
    'Português': 'Portugués',
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
    'Accessibility & Shortcuts': 'Accesibilidad y atajos',
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
    'Show casino content': 'Mostrar contenido de casino',
    'Hide casino content': 'Ocultar contenido de casino',
    'Filter clearly labeled casino streams': 'Filtra streams marcados claramente como casino',
    'Open Kick Focus settings': 'Abrir configuración de Kick Focus',
    'Customize layout, appearance, content, and access': 'Personaliza el diseño, la apariencia, el contenido y el acceso',
    'No matching commands.': 'No hay comandos coincidentes.',
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
    'Every preference and shortcut will return to its factory default.': 'Todas as preferências e atalhos voltarão ao padrão de fábrica.',
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
    'Improve comfort and keep core actions within reach.': 'Melhore o conforto e mantenha as ações principais ao alcance.',
    'A desktop-first layout and control layer for Kick.': 'Uma camada de layout e controle para Kick pensada para desktop.',
    'Language': 'Idioma',
    'Choose the language for Kick Focus settings and commands.': 'Escolha o idioma das configurações e comandos do Kick Focus.',
    'Auto': 'Automático',
    'English': 'Inglês',
    'Español': 'Espanhol',
    'Português': 'Português',
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
    'Show casino content': 'Mostrar conteúdo de cassino',
    'Hide casino content': 'Ocultar conteúdo de cassino',
    'Filter clearly labeled casino streams': 'Filtra transmissões claramente marcadas como cassino',
    'Open Kick Focus settings': 'Abrir configurações do Kick Focus',
    'Customize layout, appearance, content, and access': 'Personalize layout, aparência, conteúdo e acesso',
    'No matching commands.': 'Nenhum comando correspondente.',
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

function canonicalTranslation(value) {
  const text = String(value);
  for (const dictionary of Object.values(TRANSLATIONS)) {
    for (const [source, translated] of Object.entries(dictionary)) {
      if (translated === text) return source;
    }
  }
  return text;
}

function tr(value) {
  const source = canonicalTranslation(value);
  return TRANSLATIONS[activeLocale()]?.[source] || source;
}

function localizeInterface(root = state.shadow) {
  if (!root) return;
  const walk = (node) => {
    if (node.nodeType === 3) {
      const text = node.nodeValue;
      const trimmed = text.trim();
      if (!trimmed || node.parentElement?.matches?.('input, textarea')) return;
      const start = text.indexOf(trimmed);
      node.nodeValue = `${text.slice(0, start)}${tr(trimmed)}${text.slice(start + trimmed.length)}`;
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    if (node.nodeType === 1) {
      for (const attribute of ['aria-label', 'placeholder', 'title']) {
        if (node.hasAttribute(attribute)) node.setAttribute(attribute, tr(node.getAttribute(attribute)));
      }
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
    <input type="file" accept="application/json,.json" data-kf-import hidden>
    <div class="kf-toast" data-kf-toast hidden></div>
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

  shadow.addEventListener('click', onInterfaceClick);
  shadow.addEventListener('change', onInterfaceChange);
  shadow.addEventListener('input', onInterfaceInput);
  state.commandInput.addEventListener('input', renderCommands);
  state.commandInput.addEventListener('keydown', onCommandKeydown);
  shadow.querySelector('[data-kf-import]').addEventListener('change', onImportFile);
  renderSettingsPage();
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
  return `<div class="kf-range"><span>${escapeHtml(left)}</span><div class="kf-range-wrap"><output data-output-for="${path}">${escapeHtml(current)}${escapeHtml(suffix)}</output><input type="range" min="${minimum}" max="${maximum}" value="${current}" data-set="${path}" aria-label="${escapeHtml(path)}"></div><span>${escapeHtml(right)}</span></div>`;
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
      ${row('Sidebar mode', 'Choose how the left discovery rail behaves.', segmented('layout.sidebar', value.sidebar, [['auto','Auto'],['compact','Compact'],['hidden','Hidden']]))}
      ${row('Chat layout', 'Keep chat on the right, float it as a dock, or hide it.', segmented('layout.chat', value.chat, [['right','Right'],['docked','Docked'],['hidden','Hidden']]))}
      ${row('Chat width', 'Set the width of the live chat column.', range('layout.chatWidth', value.chatWidth, 320, 520, '320 px', '520 px', ' px'), { wide: true })}
      ${row('Content density', 'Adjust spacing and padding across discovery pages.', segmented('layout.density', value.density, [['comfortable','Comfortable'],['compact','Compact']]))}
      ${row('Stream start behavior', 'Choose how each channel opens.', segmented('layout.streamStart', value.streamStart, [['standard','Standard'],['theater','Theater'],['focus','Focus']]))}
      ${row('Remember per-channel layout', 'Keep the last runtime layout for each channel.', toggle('layout.rememberPerChannel', value.rememberPerChannel, { label: 'Remember per-channel layout' }))}
      ${row('Widen browse grids', 'Use reclaimed sidebar space for larger, calmer stream cards.', toggle('layout.wideGrid', value.wideGrid, { label: 'Widen browse grids' }))}
      ${row('Show Following rail', 'Keep the Following discovery rail visible when Kick provides it.', toggle('layout.showFollowingRail', value.showFollowingRail, { label: 'Show Following rail' }))}
      ${row('Show Recommended rail', 'Keep recommended stream rows visible in the main content.', toggle('layout.showRecommendedRail', value.showRecommendedRail, { label: 'Show Recommended rail' }))}
      ${row('Sticky compact top bar', 'Keep search and account controls available while browsing.', toggle('layout.stickyTopbar', value.stickyTopbar, { label: 'Sticky compact top bar' }))}
      ${row('Show quick command button', 'Keep the Focus control available in the lower-left corner.', toggle('layout.quickButton', value.quickButton, { label: 'Show quick command button' }))}
      ${row('Move mini-player clear of controls', 'Raise Kick’s embedded mini-player when it would overlap the Focus button.', toggle('layout.miniPlayerCollision', value.miniPlayerCollision, { label: 'Move mini-player clear of controls' }))}
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
  return `${library.length} recorded · ${state.stickerPreferences.pinned.size} favorites · ${state.stickerPreferences.hidden.size} removed · ${state.stickerPreferences.groups.length} custom groups${locked ? ` · ${locked} locked-only` : ''}`;
}

function stickerLibraryFilterMatches(sticker, filter) {
  if (filter === 'favorites') return state.stickerPreferences.pinned.has(sticker.key);
  if (filter === 'removed') return state.stickerPreferences.hidden.has(sticker.key);
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
      const favoriteDifference = Number(state.stickerPreferences.pinned.has(right.key)) - Number(state.stickerPreferences.pinned.has(left.key));
      if (favoriteDifference) return favoriteDifference;
      const removedDifference = Number(state.stickerPreferences.hidden.has(left.key)) - Number(state.stickerPreferences.hidden.has(right.key));
      return removedDifference || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
  const filters = [
    ['all', `All recorded (${state.stickerPreferences.library.size})`],
    ['favorites', `Favorites (${state.stickerPreferences.pinned.size})`],
    ['removed', `Removed (${state.stickerPreferences.hidden.size})`],
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
    const favorite = state.stickerPreferences.pinned.has(sticker.key);
    const removed = state.stickerPreferences.hidden.has(sticker.key);
    const groupId = state.stickerPreferences.assignments.get(sticker.key) || '';
    const nativeGroups = sticker.nativeGroups.length ? sticker.nativeGroups.join(', ') : 'Unknown Kick group';
    const searchText = `${sticker.name} ${nativeGroups}`.toLowerCase();
    return `<article class="kf-sticker-library-item" data-kf-sticker-library-item data-kf-sticker-search="${escapeHtml(searchText)}" data-removed="${removed}">
      <div class="kf-sticker-library-image"><img src="${escapeHtml(sticker.src)}" alt="${escapeHtml(sticker.name)}" loading="lazy"></div>
      <div class="kf-sticker-library-copy"><strong title="${escapeHtml(sticker.name)}">${escapeHtml(sticker.name)}</strong><small title="${escapeHtml(nativeGroups)}">${escapeHtml(nativeGroups)}</small><span class="kf-sticker-access" data-access="${escapeHtml(sticker.access)}">${sticker.access === 'available' ? 'Seen available' : 'Locked only'}</span></div>
      <div class="kf-sticker-library-actions">
        <button type="button" class="kf-button kf-button-small" data-action="favorite-library-sticker" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Remove favorite' : 'Favorite'} ${escapeHtml(sticker.name)}">${favorite ? '★ Favorite' : '☆ Favorite'}</button>
        <button type="button" class="kf-button kf-button-small${removed ? '' : ' kf-danger'}" data-action="remove-library-sticker" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-label="${removed ? 'Restore' : 'Remove'} ${escapeHtml(sticker.name)}">${removed ? 'Restore' : 'Remove'}</button>
        <select class="kf-select" data-kf-sticker-assignment="${escapeHtml(sticker.key)}" aria-label="Custom group for ${escapeHtml(sticker.name)}">${stickerGroupOptions(groupId)}</select>
      </div>
    </article>`;
  }).join('');
  return `
    <section class="kf-subsection" data-kf-sticker-library>
      <div class="kf-subsection-header"><div><h3>Recorded sticker library</h3><p data-kf-sticker-library-summary>${escapeHtml(stickerLibrarySummary())}</p></div><div class="kf-button-group"><button type="button" class="kf-button kf-button-small" data-action="export">Export all settings</button><button type="button" class="kf-button kf-button-small" data-action="clear-sticker-preferences">Reset organization</button></div></div>
      <div class="kf-sticker-library-shell">
        <div class="kf-sticker-library-controls">
          <input class="kf-text" type="search" value="${escapeHtml(state.runtime.stickerLibraryQuery)}" data-kf-sticker-library-search placeholder="Search recorded stickers or Kick groups" aria-label="Search recorded stickers">
          <select class="kf-select" data-kf-sticker-library-filter aria-label="Filter recorded stickers">${filters.map(([value, label]) => `<option value="${escapeHtml(value)}"${selected(filter, value) ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>
        </div>
        <div class="kf-sticker-group-builder"><input class="kf-text" maxlength="60" data-kf-new-sticker-group placeholder="New custom group name" aria-label="New sticker group name"><button type="button" class="kf-button kf-button-primary" data-action="create-sticker-group">Create group</button></div>
        ${groupRows ? `<div class="kf-sticker-group-list">${groupRows}</div>` : ''}
        <div class="kf-sticker-library-meta"><span data-kf-sticker-library-visible>${library.length} shown</span><span>New picker stickers are merged automatically and included in export.</span></div>
        ${cards ? `<div class="kf-sticker-library-grid">${cards}</div>` : `<div class="kf-notice">${state.stickerPreferences.library.size ? 'No recorded stickers match this filter.' : 'Open Kick’s sticker picker once to begin the library. New stickers will be saved whenever Kick exposes them.'}</div>`}
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
        ${row('Pause home-page autoplay', 'Pause autoplaying previews once; manual playback remains available.', toggle('content.pauseHomeAutoplay', value.pauseHomeAutoplay, { label: 'Pause home-page autoplay' }))}
        ${row('Hide Slots & Casino content', 'Hide cards and sidebar entries clearly labeled as casino content.', toggle('content.hideCasino', value.hideCasino, { label: 'Hide Slots and Casino content' }))}
        ${row('Blur mature thumbnails', 'Blur marked mature cards until hover or keyboard focus.', toggle('content.blurMature', value.blurMature, { label: 'Blur mature thumbnails' }))}
        ${row('Hide Drops and gambling promotions', 'Hide clearly labeled Drops and gambling promotion modules.', toggle('content.hideDropsPromotions', value.hideDropsPromotions, { label: 'Hide Drops and gambling promotions' }))}
        ${row('Reduce tracking telemetry', 'Block observed third-party video and error telemetry hosts.', toggle('content.reduceTelemetry', value.reduceTelemetry, { label: 'Reduce tracking telemetry' }))}
      </div>
    </section>
    <section class="kf-subsection kf-content-section"><div class="kf-subsection-header"><div><h3>Playback & chat</h3><p>Local playback memory, chat control, stickers, and diagnostics.</p></div></div><div class="kf-panel">
        ${row('Remember volume locally', 'Restore each channel’s volume and mute state from local storage.', toggle('content.rememberVolume', value.rememberVolume, { label: 'Remember volume locally' }))}
        ${row('Remember quality locally', 'Restore a matching quality control when Kick exposes one.', toggle('content.rememberQuality', value.rememberQuality, { label: 'Remember quality locally' }))}
        ${row('Remember VOD position locally', 'Resume finite VODs from the last local playback position.', toggle('content.rememberVodPosition', value.rememberVodPosition, { label: 'Remember VOD position locally' }))}
        ${row('Pause chat updates', 'Freeze the visible chat scroll with an accessible resume control.', toggle('content.stickyChatPause', value.stickyChatPause, { label: 'Pause chat updates' }))}
        ${row('Organize chat stickers', 'Continuously record Kick’s picker, then add favorites, removals, search, and custom groups.', toggle('content.organizeChatStickers', value.organizeChatStickers, { label: 'Organize chat stickers' }))}
        ${row('Highlight chat keywords', 'Use the per-channel keyword list below without sending it anywhere.', toggle('content.chatHighlights', value.chatHighlights, { label: 'Highlight chat keywords' }))}
        ${row('Show playback diagnostics', 'Show ready state, buffered seconds, and dropped-frame counts on a channel.', toggle('content.playbackDiagnostics', value.playbackDiagnostics, { label: 'Show playback diagnostics' }))}
      </div>
    </section>
    <div class="kf-tool-grid">
      <section class="kf-tool-card"><div><h3>Sticker library</h3><p data-kf-sticker-library-summary>${escapeHtml(stickerLibrarySummary())}</p></div><button type="button" class="kf-button kf-button-small" data-action="export">Export library</button></section>
      <section class="kf-tool-card"><div><h3>Local discovery choices</h3><p>Favorites and not-interested choices stay on this device.</p></div><div class="kf-button-group"><button type="button" class="kf-button kf-button-small" data-action="clear-favorites">Clear favorites</button><button type="button" class="kf-button kf-button-small" data-action="clear-dismissed">Clear hidden</button></div></section>
    </div>
    ${renderStickerLibraryManager()}
    <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Local channel tools</h3><p>Channel keywords and private notes stay on this device.</p></div></div>${localChannelTools()}</section>
    ${remoteBlocklistControls()}
    <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Protection log</h3><p>Sanitized in-memory diagnostics; query strings are never retained.</p></div></div><div class="kf-panel"><table class="kf-table"><thead><tr><th>Time</th><th>Layer</th><th>Match</th><th>Action</th></tr></thead><tbody data-kf-protection-log>${protectionRows()}</tbody></table></div></section>
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

function renderAboutPage() {
  return `
    ${pageHeader('About', 'A desktop-first layout and control layer for Kick.', 'Version', VERSION)}
    <div class="kf-about-status"><div class="kf-mini-card"><span>Script health</span><strong>Active</strong></div><div class="kf-mini-card"><span>Site compatibility</span><strong data-kf-compatibility data-error="${String(Boolean(state.compatibility && !state.compatibility.healthy))}">${state.compatibility ? (state.compatibility.healthy ? 'Healthy' : 'Needs attention') : 'Checking…'}</strong></div><div class="kf-mini-card"><span>Protection layer</span><strong>${companionInfo().active ? 'Network + page' : 'Page only'}</strong></div></div>
    <section class="kf-panel">
      <div class="kf-action-row"><div><h3>Data & privacy</h3><p>Settings stay in your userscript manager. No analytics. No remote code.</p></div></div>
      ${companionInfo().active || INJECTION.grade === 'first' ? '' : `<div class="kf-action-row"><div><h3>Not running as early as it could</h3><p>This started ${escapeHtml(INJECTION.summary)}. On Chromium 138 and later a userscript manager needs its own <strong>Allow user scripts</strong> toggle enabled on the browser's extensions page, and its instant-injection mode turned on. Installing the companion extension removes the question entirely.</p></div></div>`}
      <div class="kf-action-row"><div><h3>Panic switch</h3><p>Temporarily restore Kick’s native layout and pause Kick Focus hooks without reloading. Restore it from the Focus button or with Ctrl+Shift+F.</p></div><button type="button" class="kf-button kf-danger" data-action="toggle-panic">${state.runtime.suspended ? 'Restore Kick Focus' : 'Pause Kick Focus'}</button></div>
      <div class="kf-action-row"><div><h3>Diagnostics</h3><p>Copy a sanitized summary or run a local self-check.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="copy-diagnostics">Copy diagnostic summary</button><button type="button" class="kf-button" data-action="self-check">Run self-check</button></div></div>
      <div class="kf-action-row"><div><h3>Compatibility self-test</h3><p data-kf-compatibility-detail>${escapeHtml(state.compatibility ? `${compatibilitySummary(state.compatibility)} Probes are checked after every route update.` : 'The shell probes will run after the page mounts.')}</p></div><button type="button" class="kf-button" data-action="self-check">Run now</button></div>
      <div class="kf-action-row"><div><h3>Settings portability</h3><p>Move preferences, recorded sticker metadata, favorites, removals, and custom groups using one local JSON file.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="import">Import settings</button><button type="button" class="kf-button" data-action="export">Export settings</button></div></div>
      <div class="kf-action-row"><div><h3>Reset all settings</h3><p>Restore every setting and shortcut to factory defaults.</p></div><button type="button" class="kf-button kf-danger" data-action="reset-all">Reset all settings</button></div>
    </section>
    <section class="kf-subsection"><div class="kf-panel"><table class="kf-table"><tbody><tr><th>Target</th><td>kick.com desktop</td><th>Run timing</th><td>${escapeHtml(INJECTION.summary)}</td></tr><tr><th>Keyboard</th><td>Ctrl+K commands · Alt+K settings</td><th>Test viewports</th><td>1440×900 · 1920×1080</td></tr><tr><th>Version</th><td>${VERSION}</td><th>Remote code</th><td>None</td></tr></tbody></table></div></section>`;
}

function renderSettingsPage() {
  if (!state.shadow) return;
  const page = state.shadow.querySelector('[data-kf-page]');
  const previousPage = page.dataset.kfCurrentPage;
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
  if (previousPage && previousPage !== state.currentPage) page.scrollTop = 0;
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
    showToast('Enter a custom sticker group name.', true);
    input?.focus?.();
    return;
  }
  if (state.stickerPreferences.groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
    showToast('That sticker group already exists.', true);
    return;
  }
  const id = `group_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  state.stickerPreferences.groups.push({ id, name });
  state.runtime.stickerLibraryFilter = 'all';
  saveStickerOrganization(`Created sticker group “${name}”.`);
}

function renameStickerGroup(target) {
  const id = target.dataset.kfStickerGroupId;
  const group = state.stickerPreferences.groups.find((entry) => entry.id === id);
  const input = state.shadow?.querySelector(`[data-kf-sticker-group-name="${CSS.escape(id || '')}"]`);
  const name = cleanCustomStickerGroupName(input?.value);
  if (!group || !name) {
    showToast('Enter a valid sticker group name.', true);
    return;
  }
  if (state.stickerPreferences.groups.some((entry) => entry.id !== id && entry.name.toLowerCase() === name.toLowerCase())) {
    showToast('That sticker group already exists.', true);
    return;
  }
  group.name = name;
  saveStickerOrganization('Sticker group renamed.');
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
  saveStickerOrganization(`Deleted sticker group “${group.name}”.`);
}

function toggleLibrarySticker(target, kind) {
  const key = target.dataset.kfStickerKey;
  if (!state.stickerPreferences.library.has(key)) return;
  if (kind === 'favorite') {
    if (state.stickerPreferences.pinned.has(key)) state.stickerPreferences.pinned.delete(key);
    else {
      state.stickerPreferences.pinned.add(key);
      state.stickerPreferences.hidden.delete(key);
    }
    saveStickerOrganization(state.stickerPreferences.pinned.has(key) ? 'Sticker favorited.' : 'Sticker favorite removed.');
    return;
  }
  if (state.stickerPreferences.hidden.has(key)) state.stickerPreferences.hidden.delete(key);
  else {
    state.stickerPreferences.hidden.add(key);
    state.stickerPreferences.pinned.delete(key);
  }
  saveStickerOrganization(state.stickerPreferences.hidden.has(key) ? 'Sticker removed from the shelf.' : 'Sticker restored.');
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
  saveStickerOrganization(groupId ? 'Sticker assigned to custom group.' : 'Sticker moved to Ungrouped.');
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
  else if (action === 'copy-diagnostics') copyDiagnostics();
  else if (action === 'self-check') runSelfCheck();
  else if (action === 'restore-shortcuts') restoreShortcuts();
  else if (action === 'save-local-channel') saveLocalChannelTools();
  else if (action === 'clear-local-channel') clearLocalChannelTools();
  else if (action === 'clear-blocklist') {
    clearRemoteBlocklist();
    showToast('Cached blocklist removed.');
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
  copy.textContent = scope === 'all' ? tr('Every preference and shortcut will return to its factory default.') : tr('Only the settings on this page will return to their defaults.');
  localizeInterface();
  container.hidden = false;
  container.querySelector('[data-action="cancel-reset"]')?.focus();
}

function closeResetConfirmation() {
  const container = state.shadow?.querySelector('[data-kf-confirm]');
  if (container) container.hidden = true;
  state.resetPending = false;
}

function confirmReset() {
  const scope = state.resetPending;
  if (scope === 'all') {
    state.settings = normalizeSettings(DEFAULT_SETTINGS);
    gmDelete(STORAGE_KEY);
    resetStickerPreferences();
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

function exportSettings() {
  try {
    const payload = { ...state.settings, stickers: stickerPreferencesValue() };
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
    showToast(`Settings and ${state.stickerPreferences.library.size} recorded stickers exported.`);
  } catch {
    showToast('Could not export settings.', true);
  }
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
    state.settings = result.value;
    if (result.stickers) {
      state.stickerPreferences = stickerPreferencesFromValue(result.stickers);
      gmSet(STICKER_PREFERENCES_KEY, result.stickers);
      state.runtime.stickerLibraryFilter = 'all';
      state.runtime.stickerLibraryQuery = '';
    }
    saveSettings('Imported');
    renderSettingsPage();
    scheduleApply(0);
    // Naming what was not kept, because an import that silently drops half a
    // configuration still reports success otherwise.
    const notes = result.notes || [];
    if (notes.length === 0) {
      showToast('Settings imported.');
    } else {
      showToast(`Settings imported. ${notes[0]}${notes.length > 1 ? ` (+${notes.length - 1} more)` : ''}`);
      announce(`Settings imported. ${notes.join(' ')}`);
    }
  } catch {
    showToast('Could not read that settings file.', true);
  }
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
  if (root.dataset.kfManagedSidebar === 'true') {
    findProbe(document, 'sidebarExpand').element?.click?.();
  }
  for (const key of Object.keys(root.dataset)) {
    if (key.startsWith('kf')) delete root.dataset[key];
  }
  for (const property of ['--kf-chat-width', '--kf-thumb-saturation', '--kf-caption-opacity', '--kf-text-scale', '--color-primary-base', '--color-surface-base', '--color-surface-highest', '--color-surface-lowest']) {
    root.style.removeProperty(property);
  }
  for (const node of document.querySelectorAll('[data-kf-chat-separator], [data-kf-chat-panel], [data-kf-filtered], [data-kf-mature], [data-kf-ad-shell], [data-kf-watched], [data-kf-live-card], [data-kf-dismissed], [data-kf-highlighted], [data-kf-player], [data-kf-player-resize-ready], [data-kf-card-actions], [data-kf-chat-pause], [data-kf-chat-status], [data-kf-playback-diagnostics], [data-kf-search-meta]')) {
    if (node.matches?.('[data-kf-card-actions], [data-kf-chat-pause], [data-kf-chat-status], [data-kf-playback-diagnostics], [data-kf-search-meta]')) node.remove();
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

function showToast(message, isError = false) {
  const toast = state.shadow?.querySelector('[data-kf-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.error = String(isError);
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 3600);
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

function trapFocus(event) {
  if (event.key !== 'Tab' || state.modal.hidden) return false;
  const shell = state.shadow.querySelector('[data-kf-settings-shell]');
  const focusable = [...shell.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((element) => !element.closest('[hidden]'));
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
    const conflict = Object.entries(state.settings.shortcuts).find(([key, value]) => key !== state.shortcutCapture && value.toLowerCase() === shortcut.toLowerCase());
    if (conflict) {
      state.shortcutError = `${shortcut} is already used by ${conflict[0]}.`;
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

  if (!state.modal.hidden && event.key === 'Escape') {
    event.preventDefault();
    closeSettings();
    return;
  }
  if (!state.modal.hidden && trapFocus(event)) return;
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

function syncQuickButton() {
  if (!state.root?.isConnected && document.body) document.body.append(state.root);
  if (!state.quickButton) return;
  if (state.runtime.suspended) {
    state.quickButton.hidden = false;
    state.quickButton.dataset.action = 'toggle-panic';
    state.quickButton.textContent = tr('Resume');
    state.quickButton.setAttribute('aria-label', tr('Restore Kick Focus'));
    return;
  }
  state.quickButton.dataset.action = 'open-command';
  state.quickButton.textContent = tr('Focus');
  state.quickButton.setAttribute('aria-label', tr('Open Kick Focus command menu'));
  state.quickButton.hidden = !state.settings.layout.quickButton;
}

addStyle(SITE_CSS);
installNetworkDefense();
installSpaHooks();
installCompanionBridge();
applySettingsAttributes();

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
  document.addEventListener('kick-focus:set-telemetry', (event) => {
    updateSetting('content.reduceTelemetry', Boolean(event.detail?.enabled));
  });
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
