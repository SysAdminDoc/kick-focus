/* Kick Focus 1.1.0 — generated from src/. Edit the source, not this file. */
(() => {
'use strict';
if (window.__kickFocusBooted) return;
window.__kickFocusBooted = true;
const VERSION = '1.1.0';
const SETTINGS_SCHEMA = 1;

const DEFAULT_SETTINGS = Object.freeze({
  schema: SETTINGS_SCHEMA,
  layout: Object.freeze({
    sidebar: 'compact',
    chat: 'right',
    chatWidth: 380,
    density: 'comfortable',
    streamStart: 'standard',
    rememberPerChannel: true,
    wideGrid: true,
    stickyTopbar: true,
    quickButton: true,
  }),
  appearance: Object.freeze({
    theme: 'studio',
    accent: 'kick',
    radius: 'balanced',
    thumbnail: 55,
    interfaceScale: 100,
    dimWatched: true,
    strongContrast: true,
    colorizeLive: true,
  }),
  content: Object.freeze({
    blockAds: true,
    removeAdContainers: true,
    suppressPromoted: true,
    pauseHomeAutoplay: true,
    hideCasino: false,
    blurMature: true,
    hideDropsPromotions: true,
    reduceTelemetry: true,
  }),
  accessibility: Object.freeze({
    reduceMotion: true,
    highContrast: true,
    focusVisible: true,
    largeTargets: false,
    announceChanges: true,
    textSize: 100,
    captionOpacity: 72,
  }),
  shortcuts: Object.freeze({
    command: 'Ctrl+K',
    focus: 'F',
    chat: 'C',
    sidebar: 'S',
    settings: 'Alt+K',
    mature: 'B',
  }),
});

const AD_HOSTS = Object.freeze([
  'imasdk.googleapis.com',
  'pagead2.googlesyndication.com',
  'pubads.g.doubleclick.net',
  'securepubads.g.doubleclick.net',
  'googleads.g.doubleclick.net',
  'partner.googleadservices.com',
  'adservice.google.com',
  'tpc.googlesyndication.com',
]);

const TELEMETRY_HOSTS = Object.freeze([
  'litix.io',
  'browser-intake-datadoghq.com',
  'reporting.cdndex.io',
]);

const RESERVED_ROUTES = new Set([
  'about', 'api', 'auth', 'browse', 'categories', 'community-guidelines',
  'creator-dashboard', 'dashboard', 'dmca', 'download', 'help', 'legal',
  'privacy', 'search', 'settings', 'subscriptions', 'terms', 'wallet',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function clamp(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function normalizeShortcut(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value
    .trim()
    .replace(/\s+/g, '')
    .split('+')
    .filter(Boolean)
    .map((part) => part.length === 1 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join('+');
  return cleaned.length > 0 && cleaned.length <= 32 ? cleaned : fallback;
}

function normalizeSettings(input) {
  const source = isRecord(input) ? input : {};
  const layout = isRecord(source.layout) ? source.layout : {};
  const appearance = isRecord(source.appearance) ? source.appearance : {};
  const content = isRecord(source.content) ? source.content : {};
  const accessibility = isRecord(source.accessibility) ? source.accessibility : {};
  const shortcuts = isRecord(source.shortcuts) ? source.shortcuts : {};
  const defaults = clone(DEFAULT_SETTINGS);

  return {
    schema: SETTINGS_SCHEMA,
    layout: {
      sidebar: enumValue(layout.sidebar, ['auto', 'compact', 'hidden'], defaults.layout.sidebar),
      chat: enumValue(layout.chat, ['right', 'docked', 'hidden'], defaults.layout.chat),
      chatWidth: Math.round(clamp(layout.chatWidth, 320, 520, defaults.layout.chatWidth)),
      density: enumValue(layout.density, ['comfortable', 'compact'], defaults.layout.density),
      streamStart: enumValue(layout.streamStart, ['standard', 'theater', 'focus'], defaults.layout.streamStart),
      rememberPerChannel: bool(layout.rememberPerChannel, defaults.layout.rememberPerChannel),
      wideGrid: bool(layout.wideGrid, defaults.layout.wideGrid),
      stickyTopbar: bool(layout.stickyTopbar, defaults.layout.stickyTopbar),
      quickButton: bool(layout.quickButton, defaults.layout.quickButton),
    },
    appearance: {
      theme: enumValue(appearance.theme, ['studio', 'oled', 'slate'], defaults.appearance.theme),
      accent: enumValue(appearance.accent, ['kick', 'cyan', 'violet', 'gold'], defaults.appearance.accent),
      radius: enumValue(appearance.radius, ['subtle', 'balanced', 'rounded'], defaults.appearance.radius),
      thumbnail: Math.round(clamp(appearance.thumbnail, 0, 100, defaults.appearance.thumbnail)),
      interfaceScale: enumValue(Number(appearance.interfaceScale), [90, 100, 110], defaults.appearance.interfaceScale),
      dimWatched: bool(appearance.dimWatched, defaults.appearance.dimWatched),
      strongContrast: bool(appearance.strongContrast, defaults.appearance.strongContrast),
      colorizeLive: bool(appearance.colorizeLive, defaults.appearance.colorizeLive),
    },
    content: {
      // Core ad blocking is deliberately not user-disableable in this zero-ad build.
      blockAds: true,
      removeAdContainers: bool(content.removeAdContainers, defaults.content.removeAdContainers),
      suppressPromoted: bool(content.suppressPromoted, defaults.content.suppressPromoted),
      pauseHomeAutoplay: bool(content.pauseHomeAutoplay, defaults.content.pauseHomeAutoplay),
      hideCasino: bool(content.hideCasino, defaults.content.hideCasino),
      blurMature: bool(content.blurMature, defaults.content.blurMature),
      hideDropsPromotions: bool(content.hideDropsPromotions, defaults.content.hideDropsPromotions),
      reduceTelemetry: bool(content.reduceTelemetry, defaults.content.reduceTelemetry),
    },
    accessibility: {
      reduceMotion: bool(accessibility.reduceMotion, defaults.accessibility.reduceMotion),
      highContrast: bool(accessibility.highContrast, defaults.accessibility.highContrast),
      focusVisible: bool(accessibility.focusVisible, defaults.accessibility.focusVisible),
      largeTargets: bool(accessibility.largeTargets, defaults.accessibility.largeTargets),
      announceChanges: bool(accessibility.announceChanges, defaults.accessibility.announceChanges),
      textSize: enumValue(Number(accessibility.textSize), [90, 100, 110, 120], defaults.accessibility.textSize),
      captionOpacity: Math.round(clamp(accessibility.captionOpacity, 0, 100, defaults.accessibility.captionOpacity)),
    },
    shortcuts: Object.fromEntries(Object.entries(defaults.shortcuts).map(([key, fallback]) => [
      key,
      normalizeShortcut(shortcuts[key], fallback),
    ])),
  };
}

function routeKind(input) {
  let pathname = '/';
  try {
    pathname = new URL(input, 'https://kick.com').pathname;
  } catch {
    pathname = String(input || '/').split(/[?#]/, 1)[0] || '/';
  }
  const segments = pathname.toLowerCase().split('/').filter(Boolean);
  if (segments.length === 0) return 'home';
  if (segments[0] === 'browse' && segments[1] === 'categories') return 'categories';
  if (segments[0] === 'browse' && segments[1] === 'clips') return 'clips';
  if (segments[0] === 'browse') return 'browse';
  if (segments[0] === 'category') return 'category';
  if (segments[0] === 'search') return 'search';
  if (RESERVED_ROUTES.has(segments[0])) return 'other';
  return 'channel';
}

function matchesHost(hostname, domains) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function sanitizeDiagnosticUrl(rawUrl) {
  try {
    const url = new URL(rawUrl, 'https://kick.com');
    const safePath = url.pathname
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/ig, ':id')
      .replace(/\b[0-9a-f]{24,}\b/ig, ':id')
      .replace(/\/\d{6,}(?=\/|$)/g, '/:id');
    return `${url.hostname}${safePath}`.slice(0, 160);
  } catch {
    return '[unparseable URL]';
  }
}

function classifyRequest(rawUrl, options = {}) {
  let url;
  try {
    url = new URL(rawUrl, 'https://kick.com');
  } catch {
    return { blocked: false, category: 'invalid', label: '[invalid URL]' };
  }

  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
    return { blocked: false, category: 'local', label: url.protocol };
  }

  if (matchesHost(url.hostname, AD_HOSTS)) {
    return { blocked: true, category: 'advertising', label: sanitizeDiagnosticUrl(url.href) };
  }

  if (options.reduceTelemetry && matchesHost(url.hostname, TELEMETRY_HOSTS)) {
    return { blocked: true, category: 'telemetry', label: sanitizeDiagnosticUrl(url.href) };
  }

  return { blocked: false, category: 'allowed', label: sanitizeDiagnosticUrl(url.href) };
}

// Kick's live pages mutate continuously — player, chat, viewer counts. A plain
// debounce is reset by every one of those mutations and therefore never fires,
// so the debounce is capped: once work has been waiting this long it runs, no
// matter how busy the page still is.
const APPLY_MAX_WAIT = 500;

/**
 * Delay before the next apply cycle, given how long work has already waited.
 * Returns 0 once the cap is reached, which converts a starving debounce into a
 * throttle without giving up burst coalescing.
 */
function nextApplyDelay(requestedDelay, waitedMs, maxWait = APPLY_MAX_WAIT) {
  const requested = Math.max(0, Number(requestedDelay) || 0);
  const waited = Math.max(0, Number(waitedMs) || 0);
  const remaining = Math.max(0, maxWait - waited);
  return Math.min(requested, remaining);
}

// A grid this small can legitimately be mostly filtered; below it the ratio
// test is noise. Above it, hiding this share of a page is far more likely to be
// a labelling mistake than a page that really is mostly casino content.
const FILTER_MIN_SAMPLE = 8;
const FILTER_MAX_HIDDEN_RATIO = 0.25;

/**
 * Decide whether filtering may be applied to a grid.
 *
 * Filtering is suspended rather than applied when it would hide most of a page.
 * A filter that empties a grid is indistinguishable from the site being broken,
 * and the user has no way to tell which happened, so the safe failure is to
 * show everything and say so.
 */
function filterDecision(total, wouldHide, options = {}) {
  const sample = Math.max(0, Number(total) || 0);
  const hidden = Math.min(sample, Math.max(0, Number(wouldHide) || 0));
  const ratio = sample > 0 ? hidden / sample : 0;

  // On a category page the user asked for exactly one kind of content, so a
  // page that is entirely that kind is the expected result rather than
  // evidence of a labelling mistake. Suspending here would quietly overrule
  // the filter the user turned on.
  if (options.route === 'category') {
    return { apply: true, hidden, total: sample, ratio, reason: 'category-route' };
  }

  if (sample >= FILTER_MIN_SAMPLE && ratio > FILTER_MAX_HIDDEN_RATIO) {
    return { apply: false, hidden, total: sample, ratio, reason: 'ratio' };
  }
  return { apply: true, hidden, total: sample, ratio, reason: 'ok' };
}

// Kick's own category slugs. Language-independent and far more reliable than
// the displayed name, which is localized and appears inside stream titles.
const CASINO_CATEGORY_SLUGS = Object.freeze([
  'slots', 'casino', 'slots-casino', 'poker', 'sports-betting', 'gambling',
]);

/**
 * Classify a card.
 *
 * Structured evidence wins: a category slug and Kick's own short badge
 * elements say what a card is, while the card's full text merely mentions
 * things. Matching prose is what made "Drop the beat" read as a Drops
 * promotion and any title mentioning a casino read as gambling.
 *
 * The text heuristics remain, but only as a fallback for a signal that has no
 * structured evidence available — never to override it.
 *
 * @param {string} text Full card text, used only for fallback.
 * @param {{categories?: string[], badges?: string[]}} [context] Structured
 *   evidence read from the card: category slugs and short badge texts.
 */
function detectContentLabels(text, context = {}) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const categories = (Array.isArray(context.categories) ? context.categories : [])
    .map((value) => String(value || '').toLowerCase().trim())
    .filter(Boolean);
  const badges = (Array.isArray(context.badges) ? context.badges : [])
    .map((value) => String(value || '').toLowerCase().trim())
    .filter(Boolean);

  const hasCategories = categories.length > 0;
  const hasBadges = badges.length > 0;
  const badgeMatches = (pattern) => badges.some((badge) => pattern.test(badge));

  return {
    casino: hasCategories
      ? categories.some((slug) => CASINO_CATEGORY_SLUGS.includes(slug))
      : /\b(slots?\s*(?:&|and)\s*casino|casino|gambling)\b/.test(normalized),
    mature: hasBadges
      ? badgeMatches(/^18\+$/) || badgeMatches(/^mature/)
      : /(^|\s)18\+(?:\s|$)/.test(normalized) || /mature\s+(?:content|viewers?)/.test(normalized),
    promoted: hasBadges
      ? badgeMatches(/^(sponsored|promoted|advertisement|ad)$/)
      : /\b(sponsored|promoted|advertisement)\b/.test(normalized),
    // Never bare "drops": it is an ordinary English word in stream titles.
    drops: hasBadges
      ? badgeMatches(/^(drops?|drops enabled|kick drops)$/)
      : /\b(?:kick\s+drops?|drops\s+enabled)\b/.test(normalized),
  };
}

function validateImportedSettings(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(String(jsonText));
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!isRecord(parsed)) return { ok: false, error: 'Settings must be a JSON object.' };
  if (parsed.schema != null && Number(parsed.schema) > SETTINGS_SCHEMA) {
    return { ok: false, error: `Settings schema ${parsed.schema} is newer than this build supports.` };
  }
  return { ok: true, value: normalizeSettings(parsed) };
}

const STORAGE_KEY = 'kick-focus:settings';
const CHANNEL_LAYOUT_KEY = 'kick-focus:channel-layouts';
const WATCHED_KEY = 'kick-focus:watched-this-session';
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
const state = {
  settings: loadSettings(),
  currentPage: 'layout',
  route: routeKind(location.href),
  root: null,
  shadow: null,
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
  casinoPaths: new Set(),
  filter: {
    suspended: false,
    hidden: 0,
    wouldHide: 0,
    total: 0,
  },
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
  try {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(cssText);
      return;
    }
  } catch {
    // Fall through to a regular style element.
  }
  const style = document.createElement('style');
  style.id = 'kick-focus-critical-style';
  style.textContent = cssText;
  (document.head || document.documentElement).append(style);
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
        const rawUrl = typeof input === 'string' || input instanceof URL ? input : input?.url;
        const result = classify(rawUrl);
        if (result.blocked) {
          report('Fetch', result);
          return blockedResponse(pageWindow);
        }
        return nativeFetch(input, init);
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
      xhrPrototype.open = function kickFocusOpen(method, url, ...rest) {
        this.__kfRequest = classify(url);
        return nativeOpen.call(this, method, url, ...rest);
      };
      xhrPrototype.send = function kickFocusSend(...args) {
        if (!this.__kfRequest?.blocked) return nativeSend.apply(this, args);
        report('XHR', this.__kfRequest);
        queueMicrotask(() => {
          try {
            this.dispatchEvent(new pageWindow.Event('error'));
            this.dispatchEvent(new pageWindow.Event('loadend'));
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
    --kf-panel: #111517;
    --kf-panel-raised: #171c1f;
    --kf-border: #343b40;
    --kf-radius: 12px;
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
  html[data-kf-theme="slate"] { --kf-panel: #15191f; --kf-panel-raised: #1d232a; --kf-border: #3a454f; }

  @media (min-width: 1024px) {
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

    html[data-kf-density="compact"] #main-container section[class*="grid"],
    html[data-kf-density="compact"] #main-container [class*="group/grid"] { gap: 12px !important; }

    html[data-kf-sticky="true"] nav {
      min-height: 56px !important;
      backdrop-filter: blur(14px) !important;
      background: rgba(8, 10, 11, .94) !important;
      border-bottom: 1px solid rgba(255,255,255,.08) !important;
    }

    #main-container { font-size: calc(1rem * var(--kf-text-scale)); }

    #main-container [class*="group/card"] {
      border-radius: var(--kf-radius) !important;
      transition: transform 150ms ease, filter 150ms ease, box-shadow 150ms ease !important;
    }

    #main-container [class*="group/card"]:hover,
    #main-container [class*="group/card"]:focus-within {
      transform: translateY(-2px);
      box-shadow: 0 14px 36px rgba(0,0,0,.30);
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
    [data-kf-ad-shell="true"] { display: none !important; }

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
  const separator = document.querySelector('[role="separator"][aria-label="Resize chatroom"]');
  if (!separator) return;
  separator.dataset.kfChatSeparator = 'true';
  let panel = separator.nextElementSibling;
  if (!panel || panel === separator) {
    panel = [...separator.parentElement.children].find((child) => child !== separator && child.querySelector?.('[aria-label*="chat" i], textarea, [contenteditable="true"]'));
  }
  if (panel) panel.dataset.kfChatPanel = 'true';
}

function syncNativeSidebar() {
  if (state.runtime.sidebarHidden || state.runtime.focus || state.runtime.theater) return;
  const mode = state.settings.layout.sidebar;
  const collapse = document.querySelector('button[aria-label="Collapse sidebar"]');
  const expand = document.querySelector('button[aria-label="Expand sidebar"]');
  if (mode === 'compact' && collapse) {
    document.documentElement.dataset.kfManagedSidebar = 'true';
    collapse.click();
  } else if (mode === 'auto' && expand && document.documentElement.dataset.kfManagedSidebar === 'true') {
    delete document.documentElement.dataset.kfManagedSidebar;
    expand.click();
  }
}

function cardCandidates() {
  return document.querySelectorAll([
    '#main-container [class*="group/card"]',
    '#main-container article',
    '#sidebar-wrapper button',
    '#sidebar-wrapper a',
  ].join(','));
}

/**
 * Read the structured evidence a card carries: Kick's category slug, and its
 * short badge texts. Both are far stronger signals than the card's prose, and
 * the slug survives localization.
 */
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

function applyContentFilters() {
  const settings = state.settings.content;

  // Decide first, apply second. Filtering is scored across the whole grid so a
  // run that would hide most of the page can be suspended before anything
  // disappears.
  const scored = [];
  for (const node of cardCandidates()) {
    delete node.dataset.kfFiltered;
    delete node.dataset.kfMature;
    const labels = detectContentLabels(node.textContent, cardContext(node));
    const link = node.matches?.('a[href]') ? node : node.querySelector?.('a[href]');
    let path = '';
    try { path = link ? new URL(link.href, location.origin).pathname : ''; } catch { /* noop */ }
    if (labels.casino && path) state.casinoPaths.add(path);
    if (path && state.casinoPaths.has(path)) labels.casino = true;
    node.dataset.kfWatched = String(Boolean(path && state.watched.has(path)));
    node.dataset.kfLiveCard = String(/(^|\s)live(?:\s|$)/i.test(node.textContent || ''));
    const hide = (settings.hideCasino && labels.casino)
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

  if (settings.pauseHomeAutoplay && state.route === 'home') {
    for (const video of document.querySelectorAll('video[autoplay]:not([data-kf-autoplay-handled])')) {
      video.dataset.kfAutoplayHandled = 'true';
      try { video.pause(); } catch { /* noop */ }
    }
  }
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
  const now = Date.now();
  if (!state.applyPendingSince) state.applyPendingSince = now;
  const effective = nextApplyDelay(delay, now - state.applyPendingSince);
  clearTimeout(state.applyTimer);
  state.applyTimer = window.setTimeout(() => {
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
      }
      state.runtime.matureVisible = false;
      announce(`Kick Focus applied to ${state.route}`);
    }
    applySettingsAttributes();
    tagChatPanel();
    removeAdShells();
    applyContentFilters();
    syncNativeSidebar();
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
  const observer = new MutationObserver(() => scheduleApply(80));
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function rememberWatchedCard(event) {
  const actualTarget = event.composedPath?.()[0] || event.target;
  const link = actualTarget.closest?.('#main-container [class*="group/card"] a[href], #sidebar-wrapper a[href]');
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
  saveSettings(message);
  scheduleApply(0);
  renderSettingsPage();
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
    --surface-0: #080a0b;
    --surface-1: #101416;
    --surface-2: #171c1f;
    --surface-3: #20262a;
    --border: #343b40;
    --text: #f7f9fa;
    --muted: #aab2b8;
    --danger: #ff6258;
    --warning: #f6b943;
    --radius: var(--kf-radius, 12px);
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
    min-width: 72px;
    height: 40px;
    padding: 0 15px;
    border: 1px solid rgba(var(--accent-rgb), .58);
    border-radius: 999px;
    background: #111516;
    color: var(--text);
    box-shadow: 0 12px 32px rgba(0,0,0,.46);
    cursor: pointer;
    font-weight: 760;
    letter-spacing: .01em;
  }
  .kf-quick:hover { border-color: var(--accent); background: #171d1f; }

  .kf-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2147483200;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(2, 3, 4, .80);
  }

  .kf-settings {
    width: min(1080px, calc(100vw - 48px));
    height: min(804px, calc(100vh - 48px));
    min-width: 960px;
    min-height: 680px;
    display: grid;
    grid-template-rows: 72px minmax(0, 1fr) 72px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-1);
    box-shadow: 0 36px 100px rgba(0,0,0,.70);
    color: var(--text);
    font-size: calc(14px * var(--kf-interface-scale, 1));
  }

  .kf-header {
    display: grid;
    grid-template-columns: 260px 1fr auto auto;
    align-items: center;
    gap: 22px;
    padding: 0 18px 0 24px;
    border-bottom: 1px solid var(--border);
    background: #13181b;
  }
  .kf-brand { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 800; }
  .kf-badge { padding: 2px 7px; border-radius: 5px; background: var(--accent); color: #071004; font-size: 10px; font-weight: 900; text-transform: uppercase; }
  .kf-title { font-size: 18px; font-weight: 760; }
  .kf-save { color: #b9c1c6; font-size: 13px; }
  .kf-save::before { content: ''; display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: var(--accent); }
  .kf-save[data-error="true"] { color: var(--danger); }
  .kf-save[data-error="true"]::before { background: var(--danger); }

  .kf-icon-button {
    width: 40px;
    height: 40px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: var(--surface-3);
    color: var(--text);
    cursor: pointer;
    font-size: 22px;
    line-height: 1;
  }
  .kf-icon-button:hover { border-color: var(--border); background: #2a3136; }

  .kf-body { min-height: 0; display: grid; grid-template-columns: 274px minmax(0, 1fr); }
  .kf-nav { padding: 18px 14px; border-right: 1px solid var(--border); background: #0d1113; }
  .kf-nav button {
    width: 100%;
    display: grid;
    gap: 2px;
    padding: 12px 14px;
    margin-bottom: 5px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }
  .kf-nav button:hover { background: rgba(255,255,255,.035); }
  .kf-nav button[aria-current="page"] { border-color: var(--accent); background: rgba(var(--accent-rgb), .055); }
  .kf-nav strong { font-size: 14px; }
  .kf-nav span { color: var(--muted); font-size: 12px; }

  .kf-page { min-width: 0; overflow: auto; padding: 22px 26px 30px; scrollbar-color: #445057 transparent; }
  .kf-page-header { margin-bottom: 16px; }
  .kf-page-header h2 { margin: 0 0 3px; font-size: 22px; line-height: 1.2; }
  .kf-page-header p { margin: 0; color: var(--muted); }

  .kf-panel { border: 1px solid var(--border); border-radius: 10px; background: #121719; overflow: hidden; }
  .kf-row {
    min-height: 64px;
    display: grid;
    grid-template-columns: minmax(250px, 1fr) auto;
    align-items: center;
    gap: 20px;
    padding: 12px 15px;
    border-top: 1px solid #2b3236;
  }
  .kf-row:first-child { border-top: 0; }
  .kf-row h3 { margin: 0 0 2px; font-size: 14px; font-weight: 720; }
  .kf-row p { margin: 0; color: var(--muted); font-size: 12px; }
  .kf-row-wide { grid-template-columns: 1fr; gap: 9px; }
  .kf-control { min-width: 250px; display: flex; justify-content: flex-end; }

  .kf-segmented { display: inline-flex; border: 1px solid var(--border); border-radius: 7px; overflow: hidden; background: #0d1012; }
  .kf-segmented button {
    min-width: 72px;
    height: 36px;
    padding: 0 12px;
    border: 0;
    border-left: 1px solid var(--border);
    background: transparent;
    color: #d5dade;
    cursor: pointer;
  }
  .kf-segmented button:first-child { border-left: 0; }
  .kf-segmented button[aria-pressed="true"] { background: rgba(var(--accent-rgb), .14); color: var(--text); box-shadow: inset 0 0 0 1px var(--accent); }

  .kf-switch {
    width: 42px;
    height: 24px;
    position: relative;
    border: 0;
    border-radius: 999px;
    background: #465057;
    cursor: pointer;
  }
  .kf-switch::after {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: left 120ms ease;
  }
  .kf-switch[aria-checked="true"] { background: var(--accent); }
  .kf-switch[aria-checked="true"]::after { left: 22px; background: #071004; }
  .kf-switch:disabled { opacity: .76; cursor: not-allowed; }

  .kf-lock { display: inline-block; margin-left: 7px; padding: 2px 6px; border-radius: 5px; background: rgba(var(--accent-rgb), .12); color: var(--accent); font-size: 10px; font-weight: 800; text-transform: uppercase; }

  .kf-range { display: grid; grid-template-columns: 48px minmax(220px, 1fr) 48px; align-items: center; gap: 10px; width: 100%; }
  .kf-range span { color: var(--muted); font-size: 11px; }
  .kf-range span:last-child { text-align: right; }
  .kf-range-wrap { position: relative; display: grid; gap: 4px; }
  .kf-range output { justify-self: center; min-width: 52px; padding: 2px 7px; border-radius: 5px; background: #2a3136; color: var(--text); text-align: center; font-size: 11px; }
  .kf-range input { width: 100%; accent-color: var(--accent); }

  .kf-theme-grid, .kf-swatch-grid { display: grid; grid-template-columns: repeat(4, minmax(92px, 1fr)); gap: 10px; }
  .kf-theme-grid { grid-template-columns: repeat(3, minmax(125px, 1fr)); }
  .kf-choice-card {
    min-height: 88px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #0e1214;
    cursor: pointer;
    text-align: left;
  }
  .kf-choice-card[aria-pressed="true"] { border-color: var(--accent); box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), .25); }
  .kf-choice-card strong { display: block; margin-top: 9px; }
  .kf-theme-sample { display: grid; grid-template-columns: 24px 1fr; gap: 7px; height: 32px; padding: 5px; border-radius: 4px; background: #1b2124; }
  .kf-theme-sample::before { content: ''; border-radius: 2px; background: var(--accent); opacity: .7; }
  .kf-theme-sample::after { content: ''; border-radius: 2px; background: #556168; }
  .kf-swatch { width: 32px; height: 32px; border-radius: 7px; border: 1px solid rgba(255,255,255,.25); }
  .kf-swatch[data-color="kick"] { background: #7cff2b; }
  .kf-swatch[data-color="cyan"] { background: #38d7d0; }
  .kf-swatch[data-color="violet"] { background: #9667ff; }
  .kf-swatch[data-color="gold"] { background: #ffbe2e; }

  .kf-preview { margin-top: 14px; display: grid; grid-template-columns: 160px 1fr; gap: 14px; padding: 13px; border: 1px solid var(--border); border-radius: 9px; background: #0c1012; }
  .kf-preview-media { min-height: 86px; border-radius: 7px; background: #232a2e; display: grid; place-items: center; color: var(--accent); font-weight: 900; letter-spacing: .06em; }
  .kf-preview h3 { margin: 5px 0 5px; font-size: 15px; }
  .kf-preview p { margin: 0; color: var(--muted); font-size: 12px; }

  .kf-status-card { display: grid; grid-template-columns: 1fr auto; gap: 14px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: #151b1e; }
  .kf-status-card h3 { margin: 0 0 3px; font-size: 17px; }
  .kf-status-card p { margin: 0; color: var(--muted); }
  .kf-active { color: var(--accent); font-weight: 800; }
  .kf-stats { margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
  .kf-stat { padding: 11px; border-left: 1px solid var(--border); background: #101416; text-align: center; }
  .kf-stat:first-child { border-left: 0; }
  .kf-stat span { display: block; color: var(--muted); font-size: 11px; }
  .kf-stat strong { display: block; margin-top: 3px; color: var(--accent); font-size: 16px; }

  .kf-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .kf-table th, .kf-table td { padding: 8px 10px; border-bottom: 1px solid #2a3135; text-align: left; vertical-align: middle; }
  .kf-table th { color: #cfd5d9; background: #20262a; font-size: 11px; }
  .kf-table tr:last-child td { border-bottom: 0; }
  .kf-table .kf-table-actions { text-align: right; }
  .kf-shortcut { display: inline-flex; min-width: 58px; justify-content: center; padding: 4px 8px; border: 1px solid #465057; border-radius: 5px; background: #20262a; font-weight: 700; }
  .kf-conflict td { background: rgba(255,98,88,.055); border-top: 1px solid var(--danger); border-bottom: 1px solid var(--danger); }
  .kf-conflict-message { color: var(--danger); font-size: 11px; }

  .kf-notice { margin-top: 12px; padding: 11px 13px; border: 1px solid #7b5d20; border-radius: 8px; background: rgba(246,185,67,.065); color: #e7c77e; font-size: 12px; }
  .kf-subsection { margin-top: 18px; }
  .kf-subsection-header { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .kf-subsection h3 { margin: 0; font-size: 16px; }
  .kf-subsection p { margin: 2px 0 0; color: var(--muted); font-size: 12px; }

  .kf-about-hero { display: flex; align-items: center; gap: 18px; margin-bottom: 20px; }
  .kf-about-hero h2 { margin: 0 0 4px; font-size: 27px; }
  .kf-about-hero p { margin: 0; color: var(--muted); }
  .kf-about-status { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .kf-mini-card { padding: 14px; border: 1px solid var(--border); border-radius: 9px; background: #121719; }
  .kf-mini-card span { display: block; color: var(--muted); font-size: 11px; }
  .kf-mini-card strong { display: block; margin-top: 4px; color: var(--accent); }
  .kf-action-row { min-height: 72px; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 18px; padding: 13px 15px; border-top: 1px solid #2b3236; }
  .kf-action-row:first-child { border-top: 0; }
  .kf-action-row h3 { margin: 0 0 2px; font-size: 14px; }
  .kf-action-row p { margin: 0; color: var(--muted); font-size: 12px; }
  .kf-danger { border-color: rgba(255,98,88,.65) !important; color: #ff8a82 !important; }

  .kf-button {
    min-height: 38px;
    padding: 0 14px;
    border: 1px solid #414a50;
    border-radius: 7px;
    background: #242b2f;
    color: var(--text);
    cursor: pointer;
    font-weight: 680;
  }
  .kf-button:hover { border-color: #5a666d; background: #2d353a; }
  .kf-button-primary { border-color: var(--accent); background: var(--accent); color: #071004; }
  .kf-button-primary:hover { background: #91ff55; border-color: #91ff55; }
  .kf-button:disabled { opacity: .38; cursor: not-allowed; }
  .kf-button-small { min-height: 30px; padding-inline: 10px; font-size: 12px; }
  .kf-button-group { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }

  .kf-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 20px; border-top: 1px solid var(--border); background: #13181b; }
  .kf-footer-left, .kf-footer-right { display: flex; align-items: center; gap: 10px; }

  .kf-confirm {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    background: rgba(2,3,4,.76);
  }
  .kf-confirm-card { width: 430px; padding: 22px; border: 1px solid var(--border); border-radius: 11px; background: #151a1d; box-shadow: 0 24px 70px rgba(0,0,0,.62); }
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
    border-radius: 8px;
    background: #1b2225;
    box-shadow: 0 18px 48px rgba(0,0,0,.5);
    color: var(--text);
  }
  .kf-toast[data-error="true"] { border-color: var(--danger); }

  .kf-command-shell {
    width: min(560px, calc(100vw - 48px));
    max-height: min(620px, calc(100vh - 80px));
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: #111618;
    box-shadow: 0 32px 90px rgba(0,0,0,.72);
    color: var(--text);
  }
  .kf-command-head { padding: 12px; border-bottom: 1px solid var(--border); }
  .kf-command-head input {
    width: 100%;
    height: 44px;
    padding: 0 13px;
    border: 1px solid #465057;
    border-radius: 8px;
    background: #0b0e10;
    color: var(--text);
    outline: 0;
  }
  .kf-command-head input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15); }
  .kf-command-list { max-height: 490px; overflow: auto; padding: 7px; }
  .kf-command-item { width: 100%; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 14px; padding: 11px 12px; border: 0; border-radius: 7px; background: transparent; text-align: left; cursor: pointer; }
  .kf-command-item:hover, .kf-command-item[data-active="true"] { background: #22292d; }
  .kf-command-item strong { display: block; margin-bottom: 2px; }
  .kf-command-item span { color: var(--muted); font-size: 12px; }
  .kf-command-empty { padding: 28px; color: var(--muted); text-align: center; }

  .kf-sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0,0,0,0) !important; white-space: nowrap !important; border: 0 !important; }

  :is(button, input):focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
  }
`;

const NAV_ITEMS = [
  ['layout', 'Layout', 'Structure and positioning'],
  ['appearance', 'Appearance', 'Themes, colors, and style'],
  ['content', 'Content & Ads', 'Filter and hide elements'],
  ['accessibility', 'Accessibility & Shortcuts', 'Shortcuts and accessibility'],
  ['about', 'About', 'Version, diagnostics, and privacy'],
];

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
          <div class="kf-brand"><span>Kick Focus</span><span class="kf-badge">Premium</span></div>
          <div class="kf-title" id="kf-settings-title">Settings</div>
          <div class="kf-save" data-kf-save-status data-error="false">Autosaved</div>
          <button class="kf-icon-button" type="button" data-action="close-settings" aria-label="Close settings">×</button>
        </header>
        <div class="kf-body">
          <nav class="kf-nav" aria-label="Kick Focus settings">
            ${NAV_ITEMS.map(([id, title, description]) => `<button type="button" data-page="${id}"><strong>${title}</strong><span>${description}</span></button>`).join('')}
          </nav>
          <main class="kf-page" data-kf-page tabindex="-1"></main>
        </div>
        <footer class="kf-footer">
          <div class="kf-footer-left">
            <button type="button" class="kf-button" data-action="reset-page">Reset page</button>
            <button type="button" class="kf-button" data-action="export">Export settings</button>
          </div>
          <div class="kf-footer-right"><button type="button" class="kf-button kf-button-primary" data-action="close-settings">Done</button></div>
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

function renderLayoutPage() {
  const value = state.settings.layout;
  return `
    <div class="kf-page-header"><h2>Layout</h2><p>Control how Kick is arranged across your desktop.</p></div>
    <section class="kf-panel">
      ${row('Sidebar mode', 'Choose how the left discovery rail behaves.', segmented('layout.sidebar', value.sidebar, [['auto','Auto'],['compact','Compact'],['hidden','Hidden']]))}
      ${row('Chat layout', 'Keep chat on the right, float it as a dock, or hide it.', segmented('layout.chat', value.chat, [['right','Right'],['docked','Docked'],['hidden','Hidden']]))}
      ${row('Chat width', 'Set the width of the live chat column.', range('layout.chatWidth', value.chatWidth, 320, 520, '320 px', '520 px', ' px'), { wide: true })}
      ${row('Content density', 'Adjust spacing and padding across discovery pages.', segmented('layout.density', value.density, [['comfortable','Comfortable'],['compact','Compact']]))}
      ${row('Stream start behavior', 'Choose how each channel opens.', segmented('layout.streamStart', value.streamStart, [['standard','Standard'],['theater','Theater'],['focus','Focus']]))}
      ${row('Remember per-channel layout', 'Keep the last runtime layout for each channel.', toggle('layout.rememberPerChannel', value.rememberPerChannel, { label: 'Remember per-channel layout' }))}
      ${row('Widen browse grids', 'Use reclaimed sidebar space for larger, calmer stream cards.', toggle('layout.wideGrid', value.wideGrid, { label: 'Widen browse grids' }))}
      ${row('Sticky compact top bar', 'Keep search and account controls available while browsing.', toggle('layout.stickyTopbar', value.stickyTopbar, { label: 'Sticky compact top bar' }))}
      ${row('Show quick command button', 'Keep the Focus control available in the lower-left corner.', toggle('layout.quickButton', value.quickButton, { label: 'Show quick command button' }))}
    </section>`;
}

function renderAppearancePage() {
  const value = state.settings.appearance;
  const themes = [['studio','Studio'],['oled','OLED'],['slate','Slate']];
  const accents = [['kick','Kick Green'],['cyan','Cyan'],['violet','Violet'],['gold','Gold']];
  return `
    <div class="kf-page-header"><h2>Appearance</h2><p>Set a premium visual style without replacing Kick’s identity.</p></div>
    <section class="kf-panel">
      <div class="kf-row kf-row-wide"><div><h3>Theme</h3><p>Choose the overall surface treatment.</p></div><div class="kf-theme-grid">${themes.map(([id,label]) => `<button type="button" class="kf-choice-card" data-set="appearance.theme" data-value="${id}" aria-pressed="${selected(value.theme,id)}"><span class="kf-theme-sample" aria-hidden="true"></span><strong>${label}</strong></button>`).join('')}</div></div>
      <div class="kf-row kf-row-wide"><div><h3>Accent color</h3><p>Use one clear accent for highlights and controls.</p></div><div class="kf-swatch-grid">${accents.map(([id,label]) => `<button type="button" class="kf-choice-card" data-set="appearance.accent" data-value="${id}" aria-pressed="${selected(value.accent,id)}"><span class="kf-swatch" data-color="${id}" aria-hidden="true"></span><strong>${label}</strong></button>`).join('')}</div></div>
      ${row('Corner radius', 'Adjust the roundness of enhanced UI.', segmented('appearance.radius', value.radius, [['subtle','Subtle'],['balanced','Balanced'],['rounded','Rounded']]))}
      ${row('Thumbnail treatment', 'Adjust stream-card color intensity.', range('appearance.thumbnail', value.thumbnail, 0, 100, 'Natural', 'Vivid', '%'), { wide: true })}
      ${row('Interface scale', 'Set the size of Kick Focus controls.', segmented('appearance.interfaceScale', value.interfaceScale, [[90,'90%'],[100,'100%'],[110,'110%']]))}
      ${row('Dim watched cards', 'Reduce emphasis on streams you have already opened.', toggle('appearance.dimWatched', value.dimWatched, { label: 'Dim watched cards' }))}
      ${row('Strengthen text contrast', 'Increase legibility on muted surfaces.', toggle('appearance.strongContrast', value.strongContrast, { label: 'Strengthen text contrast' }))}
      ${row('Colorize live indicators', 'Use the selected accent for live-state emphasis.', toggle('appearance.colorizeLive', value.colorizeLive, { label: 'Colorize live indicators' }))}
    </section>
    <div class="kf-preview" aria-label="Live style preview"><div class="kf-preview-media">LIVE</div><div><h3>Premium stream card preview</h3><p>Clear hierarchy, restrained motion, and one consistent accent.</p></div></div>`;
}

function protectionRows() {
  const entries = state.diagnostics.entries.length ? state.diagnostics.entries.slice(0, 5) : [
    { time: '—', layer: 'Waiting', match: 'No ad request matched yet', action: 'Ready' },
  ];
  return entries.map((entry) => `<tr><td>${escapeHtml(entry.time)}</td><td>${escapeHtml(entry.layer)}</td><td>${escapeHtml(entry.match)}</td><td>${escapeHtml(entry.action)}</td></tr>`).join('');
}

function renderContentPage() {
  const value = state.settings.content;
  const companion = companionInfo();
  return `
    <div class="kf-page-header"><h2>Content & Ads</h2><p>Keep the page calm, private, and focused on streams.</p></div>
    <section class="kf-status-card"><div><h3>Ad defense active</h3><p>${companion.active
      ? `Browser network ruleset plus page hooks and shell cleanup. Companion extension v${escapeHtml(companion.version)}.`
      : 'Document-start page hooks and persistent shell cleanup. Install the companion extension for browser-level blocking.'}</p></div><div class="kf-active">${companion.active ? 'Network + page' : 'Page only'}</div></section>
    <div class="kf-stats"><div class="kf-stat"><span>Blocked this page</span><strong data-kf-stat="blocked">${state.diagnostics.blocked}</strong></div><div class="kf-stat"><span>Removed shells</span><strong data-kf-stat="shells">${state.diagnostics.shells}</strong></div><div class="kf-stat"><span>Last match</span><strong data-kf-stat="last">${escapeHtml(state.diagnostics.lastMatch)}</strong></div></div>
    <div class="kf-notice" data-kf-filter-notice ${state.filter.suspended ? '' : 'hidden'}>${state.filter.suspended
      ? `Filtering is suspended on this page. It would have hidden ${state.filter.wouldHide} of ${state.filter.total} cards, which usually means Kick changed its labels rather than that the page is really that promotional. Everything is shown.`
      : ''}</div>
    <section class="kf-panel kf-subsection">
      ${row('Block separable ad requests', 'Intercept known ad hosts at the earliest userscript-supported page layer.', toggle('content.blockAds', true, { locked: true, label: 'Core ad protection is on' }), { locked: true })}
      ${row('Remove ad containers', 'Remove empty ad containers and reinjected ad frames.', toggle('content.removeAdContainers', value.removeAdContainers, { label: 'Remove ad containers' }))}
      ${row('Suppress sponsored and promoted cards', 'Hide clearly labeled promotional cards and modules.', toggle('content.suppressPromoted', value.suppressPromoted, { label: 'Suppress promoted cards' }))}
      ${row('Pause home-page autoplay', 'Pause autoplaying previews once; manual playback remains available.', toggle('content.pauseHomeAutoplay', value.pauseHomeAutoplay, { label: 'Pause home-page autoplay' }))}
      ${row('Hide Slots & Casino content', 'Hide cards and sidebar entries clearly labeled as casino content.', toggle('content.hideCasino', value.hideCasino, { label: 'Hide Slots and Casino content' }))}
      ${row('Blur mature thumbnails', 'Blur marked mature cards until hover or keyboard focus.', toggle('content.blurMature', value.blurMature, { label: 'Blur mature thumbnails' }))}
      ${row('Hide Drops and gambling promotions', 'Hide clearly labeled Drops and gambling promotion modules.', toggle('content.hideDropsPromotions', value.hideDropsPromotions, { label: 'Hide Drops and gambling promotions' }))}
      ${row('Reduce tracking telemetry', 'Block observed third-party video and error telemetry hosts.', toggle('content.reduceTelemetry', value.reduceTelemetry, { label: 'Reduce tracking telemetry' }))}
    </section>
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
    <div class="kf-page-header"><h2>Accessibility & Shortcuts</h2><p>Improve comfort and keep core actions within reach.</p></div>
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
    <div class="kf-about-hero"><div><h2>Kick Focus <span style="color:var(--muted);font-weight:500">${VERSION}</span></h2><p>A desktop-first layout and control layer for Kick.</p></div></div>
    <div class="kf-about-status"><div class="kf-mini-card"><span>Script health</span><strong>Active</strong></div><div class="kf-mini-card"><span>Site compatibility</span><strong>Verified 2026-08-14</strong></div><div class="kf-mini-card"><span>Protection layer</span><strong>Best-effort userscript</strong></div></div>
    <section class="kf-panel">
      <div class="kf-action-row"><div><h3>Data & privacy</h3><p>Settings stay in your userscript manager. No analytics. No remote code.</p></div></div>
      <div class="kf-action-row"><div><h3>Diagnostics</h3><p>Copy a sanitized summary or run a local self-check.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="copy-diagnostics">Copy diagnostic summary</button><button type="button" class="kf-button" data-action="self-check">Run self-check</button></div></div>
      <div class="kf-action-row"><div><h3>Settings portability</h3><p>Move your preferences using a local JSON file.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="import">Import settings</button><button type="button" class="kf-button" data-action="export">Export settings</button></div></div>
      <div class="kf-action-row"><div><h3>Reset all settings</h3><p>Restore every setting and shortcut to factory defaults.</p></div><button type="button" class="kf-button kf-danger" data-action="reset-all">Reset all settings</button></div>
    </section>
    <section class="kf-subsection"><div class="kf-panel"><table class="kf-table"><tbody><tr><th>Target</th><td>kick.com desktop</td><th>Run timing</th><td>document-start</td></tr><tr><th>Keyboard</th><td>Ctrl+K commands · Alt+K settings</td><th>Test viewports</th><td>1440×900 · 1920×1080</td></tr><tr><th>Version</th><td>${VERSION}</td><th>Remote code</th><td>None</td></tr></tbody></table></div></section>`;
}

function renderSettingsPage() {
  if (!state.shadow) return;
  const page = state.shadow.querySelector('[data-kf-page]');
  const renderer = {
    layout: renderLayoutPage,
    appearance: renderAppearancePage,
    content: renderContentPage,
    accessibility: renderAccessibilityPage,
    about: renderAboutPage,
  }[state.currentPage] || renderLayoutPage;
  page.innerHTML = renderer();
  for (const button of state.shadow.querySelectorAll('[data-page]')) {
    button.setAttribute('aria-current', button.dataset.page === state.currentPage ? 'page' : 'false');
  }
  const reset = state.shadow.querySelector('[data-action="reset-page"]');
  reset.disabled = state.currentPage === 'about';
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
}

function getSetting(path) {
  const [section, key] = path.split('.');
  return state.settings[section]?.[key];
}

function coerceSetting(path, raw) {
  const current = getSetting(path);
  if (typeof current === 'boolean') return raw === true || raw === 'true';
  if (typeof current === 'number') return Number(raw);
  return String(raw);
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
  else if (action === 'cancel-shortcut') {
    state.shortcutCapture = null;
    state.shortcutError = '';
    renderSettingsPage();
  } else if (action.startsWith('command:')) {
    executeCommand(action.slice(8));
  }
}

function onInterfaceChange(event) {
  const input = event.target.closest('input[data-set]');
  if (!input) return;
  updateSetting(input.dataset.set, coerceSetting(input.dataset.set, input.value));
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
  title.textContent = scope === 'all' ? 'Reset all Kick Focus settings?' : `Reset ${NAV_ITEMS.find(([id]) => id === state.currentPage)?.[1] || 'this page'}?`;
  copy.textContent = scope === 'all' ? 'Every preference and shortcut will return to its factory default.' : 'Only the settings on this page will return to their defaults.';
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
    const blob = new Blob([`${JSON.stringify(state.settings, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kick-focus-settings-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Settings exported.');
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
    saveSettings('Imported');
    renderSettingsPage();
    scheduleApply(0);
    showToast('Settings imported.');
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
  const checks = [
    ['document-start marker', Boolean(pageWindow.__kickFocusNetworkDefenseV1)],
    ['SPA lifecycle hook', Boolean(pageWindow.__kickFocusSpaHooksV1)],
    ['interface mounted', Boolean(state.root?.isConnected)],
    ['route classified', state.route !== 'other' || location.pathname !== '/'],
    ['ad defense locked on', state.settings.content.blockAds === true],
  ];
  const companion = companionInfo();
  const failures = checks.filter(([, passed]) => !passed).map(([label]) => label);
  // The companion is optional, so its absence is reported but never a failure.
  const layer = companion.active ? `network + page (companion v${companion.version})` : 'page only';
  showToast(failures.length
    ? `Self-check needs attention: ${failures.join(', ')}.`
    : `Self-check passed: ${checks.length}/${checks.length}. Protection layer: ${layer}.`, failures.length > 0);
}

function restoreShortcuts() {
  state.settings = normalizeSettings({ ...state.settings, shortcuts: DEFAULT_SETTINGS.shortcuts });
  state.shortcutCapture = null;
  state.shortcutError = '';
  saveSettings('Shortcuts restored');
  renderSettingsPage();
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
    { id: 'focus', label: state.runtime.focus ? 'Exit focus mode' : 'Enter focus mode', description: 'Maximize the stream and hide side panels', key: state.settings.shortcuts.focus },
    { id: 'theater', label: state.runtime.theater ? 'Exit theater mode' : 'Enter theater mode', description: 'Hide discovery while keeping chat', key: 'T' },
    { id: 'chat', label: state.runtime.chatHidden ? 'Show chat' : 'Hide chat', description: 'Toggle the chat panel for this session', key: state.settings.shortcuts.chat },
    { id: 'sidebar', label: state.runtime.sidebarHidden ? 'Show sidebar' : 'Hide sidebar', description: 'Toggle the discovery rail for this session', key: state.settings.shortcuts.sidebar },
    { id: 'mature', label: state.runtime.matureVisible ? 'Blur mature thumbnails' : 'Reveal mature thumbnails', description: 'Temporarily override mature-card blur', key: state.settings.shortcuts.mature },
    { id: 'density', label: `Use ${state.settings.layout.density === 'compact' ? 'comfortable' : 'compact'} density`, description: 'Change discovery spacing and save it', key: 'D' },
    { id: 'casino', label: state.settings.content.hideCasino ? 'Show casino content' : 'Hide casino content', description: 'Filter clearly labeled casino streams', key: 'G' },
    { id: 'settings', label: 'Open Kick Focus settings', description: 'Customize layout, appearance, content, and access', key: state.settings.shortcuts.settings },
  ];
}

function renderCommands() {
  if (!state.commandList) return;
  const query = (state.commandInput?.value || '').trim().toLowerCase();
  const commands = commandDefinitions().filter((command) => `${command.label} ${command.description}`.toLowerCase().includes(query));
  state.commandList.innerHTML = commands.length
    ? commands.map((command, index) => `<button type="button" class="kf-command-item" role="option" data-action="command:${command.id}" data-active="${index === 0}"><div><strong>${escapeHtml(command.label)}</strong><span>${escapeHtml(command.description)}</span></div><span class="kf-shortcut">${escapeHtml(command.key)}</span></button>`).join('')
    : '<div class="kf-command-empty">No matching commands.</div>';
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
  if (id === 'focus') {
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
  if (state.quickButton) state.quickButton.hidden = !state.settings.layout.quickButton;
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
      startWhenBodyExists();
    });
    bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
    return;
  }
  buildInterface();
  installDocumentObserver();
  scheduleApply(0);
  // Both content scripts have certainly registered their listeners by now, so
  // this is the announcement the companion can rely on receiving.
  publishSettingsState();
}

startWhenBodyExists();

})();
