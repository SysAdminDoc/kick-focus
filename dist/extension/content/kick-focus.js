/* Kick Focus 1.4.0 — generated from src/. Edit the source, not this file. */
(() => {
'use strict';
if (window.__kickFocusBooted) return;
window.__kickFocusBooted = true;
const VERSION = '1.4.0';
const SETTINGS_SCHEMA = 2;

const DEFAULT_SETTINGS = Object.freeze({
  schema: SETTINGS_SCHEMA,
  layout: Object.freeze({
    sidebar: 'auto',
    chat: 'right',
    chatWidth: 410,
    density: 'comfortable',
    streamStart: 'standard',
    rememberPerChannel: true,
    wideGrid: true,
    stickyTopbar: true,
    quickButton: true,
    showFollowingRail: true,
    showRecommendedRail: true,
    miniPlayerCollision: true,
    playerResizeRecovery: true,
    playerContainVideo: true,
  }),
  appearance: Object.freeze({
    theme: 'studio',
    accent: 'kick',
    language: 'auto',
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
    rememberVolume: true,
    rememberQuality: true,
    rememberVodPosition: true,
    stickyChatPause: false,
    chatHighlights: false,
    organizeChatStickers: true,
    playbackDiagnostics: false,
    blocklistSubscription: false,
    blocklistUrl: '',
    blocklistRefreshHours: 24,
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
  const sourceSchema = Number(source.schema) || 0;
  // v2 aligns the effective defaults with the site redesign. Preserve any
  // clearly intentional custom value, while moving the two old defaults to
  // the new readable desktop baseline for existing installations.
  const sidebar = sourceSchema < 2 && (layout.sidebar == null || layout.sidebar === 'compact')
    ? defaults.layout.sidebar
    : enumValue(layout.sidebar, ['auto', 'compact', 'hidden'], defaults.layout.sidebar);
  const chatWidth = sourceSchema < 2 && (layout.chatWidth == null || Number(layout.chatWidth) === 380)
    ? defaults.layout.chatWidth
    : Math.round(clamp(layout.chatWidth, 320, 520, defaults.layout.chatWidth));

  return {
    schema: SETTINGS_SCHEMA,
    layout: {
      sidebar,
      chat: enumValue(layout.chat, ['right', 'docked', 'hidden'], defaults.layout.chat),
      chatWidth,
      density: enumValue(layout.density, ['comfortable', 'compact'], defaults.layout.density),
      streamStart: enumValue(layout.streamStart, ['standard', 'theater', 'focus'], defaults.layout.streamStart),
      rememberPerChannel: bool(layout.rememberPerChannel, defaults.layout.rememberPerChannel),
      wideGrid: bool(layout.wideGrid, defaults.layout.wideGrid),
      stickyTopbar: bool(layout.stickyTopbar, defaults.layout.stickyTopbar),
      quickButton: bool(layout.quickButton, defaults.layout.quickButton),
      showFollowingRail: bool(layout.showFollowingRail, defaults.layout.showFollowingRail),
      showRecommendedRail: bool(layout.showRecommendedRail, defaults.layout.showRecommendedRail),
      miniPlayerCollision: bool(layout.miniPlayerCollision, defaults.layout.miniPlayerCollision),
      playerResizeRecovery: bool(layout.playerResizeRecovery, defaults.layout.playerResizeRecovery),
      playerContainVideo: bool(layout.playerContainVideo, defaults.layout.playerContainVideo),
    },
    appearance: {
      theme: enumValue(appearance.theme, ['studio', 'oled', 'slate'], defaults.appearance.theme),
      accent: enumValue(appearance.accent, ['kick', 'cyan', 'violet', 'gold'], defaults.appearance.accent),
      language: enumValue(appearance.language, ['auto', 'en', 'es', 'pt'], defaults.appearance.language),
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
      rememberVolume: bool(content.rememberVolume, defaults.content.rememberVolume),
      rememberQuality: bool(content.rememberQuality, defaults.content.rememberQuality),
      rememberVodPosition: bool(content.rememberVodPosition, defaults.content.rememberVodPosition),
      stickyChatPause: bool(content.stickyChatPause, defaults.content.stickyChatPause),
      chatHighlights: bool(content.chatHighlights, defaults.content.chatHighlights),
      organizeChatStickers: bool(content.organizeChatStickers, defaults.content.organizeChatStickers),
      playbackDiagnostics: bool(content.playbackDiagnostics, defaults.content.playbackDiagnostics),
      blocklistSubscription: bool(content.blocklistSubscription, defaults.content.blocklistSubscription),
      blocklistUrl: typeof content.blocklistUrl === 'string' && content.blocklistUrl.length <= 2048 ? content.blocklistUrl.trim() : defaults.content.blocklistUrl,
      blocklistRefreshHours: enumValue(Number(content.blocklistRefreshHours), [6, 12, 24, 72], defaults.content.blocklistRefreshHours),
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
  if (segments[0] === 'following') return 'following';
  if (segments[0] === 'drops') return 'drops';
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
// Ad SDK blocks Kick advertises in its playback payload. Removing them stops
// the player initialising the SDKs at all, rather than blocking their requests
// after the fact. These serve advertising and are always removed.
const PLAYBACK_AD_SDK_KEYS = Object.freeze([
  'google_ads_sdk', 'pal_sdk', 'ima_sdk',
]);

// Analytics rather than advertising. Removing these is a privacy choice, not
// an ad-blocking one, so it follows the telemetry setting instead of being
// forced on everyone.
const PLAYBACK_TELEMETRY_SDK_KEYS = Object.freeze([
  'mux_sdk', 'datazoom_sdk',
]);

// The shape of Kick's ad stack as last confirmed by inspection. When the site
// stops matching this, the ad defences may be aiming at something that no
// longer exists, and silence would look identical to success.
const AD_STACK_BASELINE = Object.freeze({
  date: '2026-08-14',
  playbackSdkKeys: Object.freeze(['google_ads_sdk', 'pal_sdk', 'ima_sdk', 'mux_sdk', 'datazoom_sdk']),
  sessionFlag: 'auto_ads_enabled',
});

/**
 * Compare what was observed against the known ad stack.
 *
 * A zero in the protection log is ambiguous: it means either that nothing was
 * served or that the defences no longer recognise what is being served. This
 * turns the second case into something the user can see.
 */
function assessAdStack(observed = {}) {
  const seenKeys = Array.isArray(observed.playbackSdkKeys) ? observed.playbackSdkKeys : [];
  const sawPlayback = Boolean(observed.sawPlayback);

  if (!sawPlayback) {
    return { status: 'unknown', drifted: false, summary: 'No playback response seen yet on this page.' };
  }

  const known = AD_STACK_BASELINE.playbackSdkKeys;
  const unknownKeys = seenKeys.filter((key) => !known.includes(key));
  const matched = seenKeys.filter((key) => known.includes(key));

  if (unknownKeys.length > 0) {
    return {
      status: 'drifted',
      drifted: true,
      unknownKeys,
      summary: `Kick's playback response carries ad keys this build does not know: ${unknownKeys.join(', ')}.`,
    };
  }
  if (matched.length === 0) {
    return {
      status: 'absent',
      drifted: true,
      unknownKeys: [],
      summary: `No known ad keys were present. Either Kick served no ads, or the ad stack changed since ${AD_STACK_BASELINE.date}.`,
    };
  }
  return {
    status: 'known',
    drifted: false,
    unknownKeys: [],
    summary: `Matches the ad stack confirmed on ${AD_STACK_BASELINE.date}.`,
  };
}

/**
 * Describe how early the script actually started.
 *
 * `@run-at document-start` is a request, not a guarantee: Chromium userscript
 * managers inject through `chrome.userScripts`, which can land after the page's
 * own first scripts, and the "instant injection" modes that fix it are off by
 * default. Rather than claim a timing the script cannot verify, it measures
 * what it found on arrival and reports that.
 */
function describeInjection({ readyState, scriptCount, hasBody } = {}) {
  const scripts = Math.max(0, Number(scriptCount) || 0);
  if (hasBody || readyState === 'complete' || readyState === 'interactive') {
    return { grade: 'late', scripts, summary: 'after the page began rendering' };
  }
  if (scripts > 0) {
    return { grade: 'contended', scripts, summary: `after ${scripts} page script${scripts === 1 ? '' : 's'}` };
  }
  return { grade: 'first', scripts, summary: 'before any page script' };
}

function isPlaybackUrl(rawUrl) {
  const value = String(rawUrl || '');
  // Kick versions this endpoint, so the version segment is not pinned.
  return /\/api\/v\d+\/[^?#]*\/playback(?:[/?#]|$)/.test(value)
    || /\/stream\/[^/?#]+\/playback(?:[/?#]|$)/.test(value);
}

/**
 * Turn off ads in a playback payload.
 *
 * Kick decides client-side ad behaviour from flags in this response: a session
 * flag that enables automatic ads, and per-SDK blocks that tell the player
 * which ad SDKs to bootstrap. Reporting the flag false and removing the SDK
 * blocks stops ad initialisation at its source.
 *
 * This does not remove ads already spliced into the media stream itself; those
 * are stitched server-side and are not described by this payload.
 *
 * Returns the original text unchanged when the payload is not JSON, does not
 * look like a playback response, or already has nothing to disable — callers
 * rely on `changed` to avoid pointlessly rebuilding responses.
 */
function neutralizePlaybackPayload(rawText, options = {}) {
  const text = String(rawText ?? '');
  if (!text) return { changed: false, text, removed: [] };

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { changed: false, text, removed: [] };
  }
  if (!isRecord(payload)) return { changed: false, text, removed: [] };

  const removed = [];
  let changed = false;

  const session = payload.video_session;
  if (isRecord(session) && session.auto_ads_enabled !== false) {
    if ('auto_ads_enabled' in session) {
      session.auto_ads_enabled = false;
      removed.push('auto_ads_enabled');
      changed = true;
    }
  }

  const player = payload.video_player;
  if (isRecord(player)) {
    const targets = options.reduceTelemetry
      ? [...PLAYBACK_AD_SDK_KEYS, ...PLAYBACK_TELEMETRY_SDK_KEYS]
      : PLAYBACK_AD_SDK_KEYS;
    for (const key of targets) {
      if (key in player) {
        delete player[key];
        removed.push(key);
        changed = true;
      }
    }
  }

  if (!changed) return { changed: false, text, removed: [] };
  return { changed: true, text: JSON.stringify(payload), removed };
}

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

const STICKER_PREFERENCES_SCHEMA = 3;

function cleanStickerKeys(input, limit = 2400) {
  if (!Array.isArray(input)) return [];
  const values = [];
  const seen = new Set();
  for (const raw of input) {
    if (typeof raw !== 'string' || raw.length > 320) continue;
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
    if (values.length >= limit) break;
  }
  return values;
}

function cleanStickerText(value, maximum = 80) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function cleanStickerAssetUrl(value) {
  const raw = cleanStickerText(value, 500);
  if (!raw || !/\/emotes\//i.test(raw)) return '';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || (host !== 'kick.com' && !host.endsWith('.kick.com'))) return '';
    url.hash = '';
    return url.href.slice(0, 500);
  } catch {
    return '';
  }
}

function cleanStickerGroups(input) {
  if (!Array.isArray(input)) return [];
  const groups = [];
  const ids = new Set();
  const names = new Set();
  for (const raw of input) {
    if (!isRecord(raw)) continue;
    const id = cleanStickerText(raw.id, 64).replace(/[^a-zA-Z0-9_-]/g, '');
    const name = cleanStickerText(raw.name, 60);
    const normalizedName = name.toLowerCase();
    if (!id || !name || ids.has(id) || names.has(normalizedName)) continue;
    ids.add(id);
    names.add(normalizedName);
    groups.push({ id, name });
    if (groups.length >= 40) break;
  }
  return groups;
}

function cleanStickerAssignments(input, groupIds) {
  if (!Array.isArray(input)) return [];
  const assignments = [];
  const keys = new Set();
  for (const raw of input) {
    if (!isRecord(raw)) continue;
    const key = cleanStickerKeys([raw.key], 1)[0];
    const groupId = cleanStickerText(raw.groupId, 64).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!key || !groupIds.has(groupId) || keys.has(key)) continue;
    keys.add(key);
    assignments.push({ key, groupId });
    if (assignments.length >= 2400) break;
  }
  return assignments;
}

function cleanStickerLibrary(input) {
  if (!Array.isArray(input)) return [];
  const library = [];
  const keys = new Set();
  for (const raw of input) {
    if (!isRecord(raw)) continue;
    const key = cleanStickerKeys([raw.key], 1)[0];
    const name = cleanStickerText(raw.name, 80);
    const src = cleanStickerAssetUrl(raw.src);
    if (!key || !name || !src || keys.has(key)) continue;
    keys.add(key);
    library.push({
      key,
      id: cleanStickerText(raw.id, 120).replace(/[^a-zA-Z0-9_-]/g, ''),
      name,
      src,
      nativeGroups: [...new Set((Array.isArray(raw.nativeGroups) ? raw.nativeGroups : [])
        .map((group) => cleanStickerText(group, 80))
        .filter(Boolean))].slice(0, 20),
      access: enumValue(raw.access, ['available', 'observed', 'locked'], 'available'),
    });
    if (library.length >= 2400) break;
  }
  return library;
}

function normalizeStickerPreferences(input) {
  const source = isRecord(input) ? input : {};
  const hidden = cleanStickerKeys(source.hidden);
  const hiddenSet = new Set(hidden);
  const groups = cleanStickerGroups(source.groups);
  const groupIds = new Set(groups.map((group) => group.id));
  const activeGroup = groupIds.has(source.activeGroup) ? source.activeGroup : '';
  const view = enumValue(source.view, ['all', 'pinned', 'native', 'group'], 'all');
  return {
    schema: STICKER_PREFERENCES_SCHEMA,
    pinned: cleanStickerKeys(source.pinned).filter((key) => !hiddenSet.has(key)),
    hidden,
    view: view === 'group' && !activeGroup ? 'all' : view,
    showHidden: bool(source.showHidden, false),
    activeGroup,
    groups,
    assignments: cleanStickerAssignments(source.assignments, groupIds),
    library: cleanStickerLibrary(source.library),
  };
}

const BLOCKLIST_SCHEMA = 1;

function cleanBlocklistValues(input, normalizer, limit = 500) {
  if (!Array.isArray(input)) return [];
  const values = [];
  for (const raw of input) {
    if (typeof raw !== 'string' || raw.length > 320) continue;
    const value = normalizer(raw);
    if (value && !values.includes(value)) values.push(value);
    if (values.length >= limit) break;
  }
  return values;
}

function normalizeChannelPath(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  try {
    const url = new URL(raw, 'https://kick.com');
    if (url.hostname !== 'kick.com' && !url.hostname.endsWith('.kick.com')) return '';
    return url.pathname.replace(/\/$/, '') || '/';
  } catch {
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return path.replace(/[^a-z0-9/_-]/g, '').replace(/\/$/, '') || '';
  }
}

function normalizeBlocklistPayload(payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  return {
    schema: BLOCKLIST_SCHEMA,
    channels: cleanBlocklistValues(source.channels, normalizeChannelPath),
    categories: cleanBlocklistValues(source.categories, (value) => String(value).trim().toLowerCase().replace(/^\//, '').replace(/\s*&\s*/g, '-').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')),
    keywords: cleanBlocklistValues(source.keywords, (value) => String(value).replace(/\s+/g, ' ').trim().toLowerCase()),
  };
}

/**
 * Validate data-only remote blocklists before they enter settings or storage.
 * Unknown keys, executable-looking fields, and non-string list members are
 * rejected rather than silently merged.
 */
function validateRemoteBlocklist(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'A blocklist must be a JSON object.' };
  }
  const allowed = new Set(['schema', 'channels', 'categories', 'keywords']);
  const unknown = Object.keys(payload).filter((key) => !allowed.has(key));
  if (unknown.length) return { ok: false, error: `Unsupported blocklist field: ${unknown[0]}.` };
  if (payload.schema != null && Number(payload.schema) > BLOCKLIST_SCHEMA) {
    return { ok: false, error: `Blocklist schema ${payload.schema} is newer than this build supports.` };
  }
  for (const key of ['channels', 'categories', 'keywords']) {
    if (payload[key] != null && !Array.isArray(payload[key])) return { ok: false, error: `${key} must be an array.` };
    if (Array.isArray(payload[key]) && payload[key].some((value) => typeof value !== 'string')) return { ok: false, error: `${key} may contain strings only.` };
  }
  const value = normalizeBlocklistPayload(payload);
  const inputCount = ['channels', 'categories', 'keywords'].reduce((sum, key) => sum + (payload[key]?.length || 0), 0);
  const outputCount = value.channels.length + value.categories.length + value.keywords.length;
  if (inputCount > 1500) return { ok: false, error: 'That blocklist exceeds the 1,500-entry safety limit.' };
  if (inputCount > 0 && outputCount === 0) return { ok: false, error: 'The blocklist contains no usable entries.' };
  return { ok: true, value, dropped: inputCount - outputCount };
}

/**
 * Validate a settings file, and account for anything it contains that this
 * build will not keep.
 *
 * Normalisation silently replaces unknown or malformed values with defaults,
 * which means an import can quietly discard part of someone's configuration.
 * The caller gets a list of what was dropped so the interface can say so
 * instead of reporting a clean success.
 */
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
  if (parsed.stickers != null && !isRecord(parsed.stickers)) {
    return { ok: false, error: 'The sticker library must be a JSON object.' };
  }
  if (parsed.stickers?.schema != null && Number(parsed.stickers.schema) > STICKER_PREFERENCES_SCHEMA) {
    return { ok: false, error: `Sticker schema ${parsed.stickers.schema} is newer than this build supports.` };
  }

  const value = normalizeSettings(parsed);
  const stickers = parsed.stickers == null ? null : normalizeStickerPreferences(parsed.stickers);
  const notes = [];
  const sections = ['layout', 'appearance', 'content', 'accessibility', 'shortcuts'];

  for (const key of Object.keys(parsed)) {
    if (key !== 'schema' && key !== 'stickers' && !sections.includes(key)) notes.push(`Ignored unknown section "${key}".`);
  }
  for (const section of sections) {
    const incoming = parsed[section];
    if (!isRecord(incoming)) continue;
    for (const [key, raw] of Object.entries(incoming)) {
      // `in` walks the prototype chain, so an imported "__proto__", "constructor"
      // or "toString" key read as recognised and was silently dropped from the
      // report. normalizeSettings rebuilds from defaults, so this was never a
      // pollution risk — but transparency is the point of this whole function.
      if (!Object.hasOwn(value[section], key)) {
        notes.push(`Ignored unknown setting "${section}.${key}".`);
      } else if (JSON.stringify(value[section][key]) !== JSON.stringify(raw)) {
        notes.push(`Adjusted "${section}.${key}" to a supported value.`);
      }
    }
  }

  const from = parsed.schema == null ? 'an unversioned file' : `schema ${parsed.schema}`;
  if (parsed.schema == null || Number(parsed.schema) < SETTINGS_SCHEMA) {
    notes.unshift(`Upgraded from ${from} to schema ${SETTINGS_SCHEMA}.`);
  }

  if (stickers) {
    const stickerFields = ['pinned', 'hidden', 'groups', 'assignments', 'library'];
    for (const field of stickerFields) {
      if (Array.isArray(parsed.stickers[field]) && parsed.stickers[field].length !== stickers[field].length) {
        notes.push(`Adjusted sticker ${field} to supported entries.`);
      }
    }
    if (parsed.stickers.schema == null || Number(parsed.stickers.schema) < STICKER_PREFERENCES_SCHEMA) {
      notes.push(`Upgraded stickers to schema ${STICKER_PREFERENCES_SCHEMA}.`);
    }
  }

  return { ok: true, value, stickers, notes };
}

// ---------------------------------------------------------------------------
// Storage health
// ---------------------------------------------------------------------------

/**
 * What each persisted key is, in the user's words.
 *
 * A failed write used to be discarded by 12 of 13 call sites, so a full quota
 * lost a curated emote library with no message at all. Naming the data is the
 * difference between "something went wrong" and "your emote library did not
 * save".
 */
const STORAGE_LABELS = {
  'kick-focus:settings': 'settings',
  'kick-focus:sticker-preferences': 'emote library',
  'kick-focus:media-preferences': 'volume and quality memory',
  'kick-focus:chat-keywords': 'chat keyword filters',
  'kick-focus:channel-notes': 'channel notes',
  'kick-focus:channel-layouts': 'per-channel layout',
  'kick-focus:remote-blocklist': 'blocklist cache',
  'kick-focus:emote-usage': 'emote usage counts',
};

function storageLabel(key) {
  return STORAGE_LABELS[key] || String(key || '').replace(/^kick-focus:/, '') || 'data';
}

/**
 * Fold a failed or recovered write into a failure registry.
 *
 * Keyed by storage key so a repeatedly failing library reports once rather than
 * once per keystroke, and a later success clears the entry.
 */
function recordStorageResult(registry, key, ok, at = 0) {
  const next = { ...(registry || {}) };
  if (ok) delete next[key];
  else next[key] = { label: storageLabel(key), at, count: (next[key]?.count || 0) + 1 };
  return next;
}

/**
 * Describe a failure registry for a warning the user has to acknowledge.
 *
 * `quota` is the likely cause when several distinct keys fail together: a denied
 * storage backend fails everything, whereas a single large payload hitting the
 * cap fails only itself.
 */
function describeStorageFailures(registry) {
  const entries = Object.entries(registry || {});
  if (!entries.length) return null;
  const labels = [...new Set(entries.map(([, entry]) => entry.label))].sort();
  const list = labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
  return {
    keys: entries.map(([key]) => key).sort(),
    labels,
    total: entries.reduce((sum, [, entry]) => sum + (entry.count || 0), 0),
    message: `Kick Focus could not save your ${list}. Browser storage is full or blocked, so those changes exist only until you reload.`,
  };
}

/** Approximate on-disk size of the payloads this build owns, for diagnostics. */
function approximateStorageBytes(entries) {
  let total = 0;
  const breakdown = [];
  for (const [key, value] of Object.entries(entries || {})) {
    let bytes = 0;
    try {
      // UTF-16 code units are what a browser quota actually counts.
      bytes = (typeof value === 'string' ? value : JSON.stringify(value) || '').length * 2;
    } catch {
      bytes = 0;
    }
    total += bytes;
    breakdown.push({ key, label: storageLabel(key), bytes });
  }
  breakdown.sort((a, b) => b.bytes - a.bytes);
  return { total, breakdown };
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Ordered DOM probes for Kick's shell.
 *
 * The site changes utility classes often, so the runtime should anchor on
 * stable ids and data attributes first, then use structural and accessible
 * fallbacks. React props/fibers are deliberately the last probe: they are
 * useful when Kick removes a public marker, but are not treated as a stable
 * public API.
 */

const LOCATOR_PROBES = Object.freeze({
  main: Object.freeze([
    Object.freeze({ id: 'main-id', selector: '#main-container' }),
    Object.freeze({ id: 'main-testid', selector: '[data-testid="main-container"]' }),
    Object.freeze({ id: 'main-data', selector: '[data-kf-main], [data-kick-main]' }),
    Object.freeze({ id: 'main-element', selector: 'main' }),
  ]),
  sidebar: Object.freeze([
    Object.freeze({ id: 'sidebar-id', selector: '#sidebar-wrapper' }),
    Object.freeze({ id: 'sidebar-testid', selector: '[data-testid="sidebar-wrapper"]' }),
    Object.freeze({ id: 'sidebar-data', selector: '[data-kf-sidebar], [data-kick-sidebar]' }),
    Object.freeze({ id: 'sidebar-owner', selector: '[data-sidebar] [data-testid^="sidebar-"]' }),
  ]),
  sidebarCollapse: Object.freeze([
    Object.freeze({ id: 'sidebar-collapse-testid', selector: '[data-testid="sidebar-collapse"]' }),
    Object.freeze({ id: 'sidebar-expanded-control', selector: '[aria-controls="sidebar-wrapper"][aria-expanded="true"]' }),
    Object.freeze({ id: 'sidebar-collapse-label', selector: '[aria-label="Collapse sidebar"]' }),
  ]),
  sidebarExpand: Object.freeze([
    Object.freeze({ id: 'sidebar-expand-testid', selector: '[data-testid="sidebar-expand"]' }),
    Object.freeze({ id: 'sidebar-collapsed-control', selector: '[aria-controls="sidebar-wrapper"][aria-expanded="false"]' }),
    Object.freeze({ id: 'sidebar-expand-label', selector: '[aria-label="Expand sidebar"]' }),
  ]),
  chatSeparator: Object.freeze([
    Object.freeze({ id: 'chat-resizer-testid', selector: '[data-testid="chat-resizer"], [data-kf-chat-resizer]' }),
    Object.freeze({ id: 'chat-resizer-values', selector: '[role="separator"][aria-valuemin][aria-valuemax]' }),
    Object.freeze({ id: 'chat-resizer-label', selector: '[role="separator"][aria-label*="chat" i]' }),
  ]),
  chatPanel: Object.freeze([
    Object.freeze({ id: 'chat-panel-id', selector: '#channel-chatroom' }),
    Object.freeze({ id: 'chat-panel-testid', selector: '[data-testid="chatroom"], [data-kf-chat-panel]' }),
    Object.freeze({ id: 'chat-messages-owner', selector: '[data-testid="chatroom-messages"], #chatroom-messages' }),
  ]),
  card: Object.freeze([
    Object.freeze({ id: 'card-testid', selector: '[data-testid="livestream-results-card"], [data-testid="stream-card"]' }),
    Object.freeze({ id: 'card-group', selector: '[class*="group/card"]' }),
    Object.freeze({ id: 'card-article', selector: 'article' }),
  ]),
});

function asRoot(root) {
  return root && typeof root.querySelector === 'function' ? root : null;
}

function safeClosest(node, selector) {
  try {
    return node?.closest?.(selector) || null;
  } catch {
    return null;
  }
}

function reactMetadata(node) {
  if (!node || typeof Object.getOwnPropertyNames !== 'function') return [];
  const names = Object.getOwnPropertyNames(node).filter((name) => /^__react(?:Props|Fiber)\$/.test(name));
  const values = [];
  for (const name of names) {
    try {
      const value = node[name];
      if (value) values.push(value);
    } catch {
      // A framework-owned property may be a throwing getter.
    }
  }
  return values;
}

function hasReactMarker(value, marker, depth = 0) {
  if (depth > 2 || value == null) return false;
  if (typeof value === 'string') return marker.test(value);
  if (typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (marker.test(key) || hasReactMarker(child, marker, depth + 1)) return true;
  }
  return false;
}

function reactProbe(root, kind) {
  const marker = kind === 'chat' ? /chat|message|room/i : /sidebar|navigation|discovery/i;
  let candidates = [];
  try {
    candidates = [...root.querySelectorAll('*')];
  } catch {
    return null;
  }
  for (const node of candidates) {
    if (!reactMetadata(node).some((value) => hasReactMarker(value, marker))) continue;
    if (kind === 'chat') {
      return safeClosest(node, '#channel-chatroom, [data-testid="chatroom"], [data-testid="chatroom-messages"]') || node;
    }
    return safeClosest(node, '#sidebar-wrapper, [data-testid="sidebar-wrapper"], [data-sidebar]') || node;
  }
  return null;
}

/** Return the first matching element and the probe that matched it. */
function findProbe(root, name) {
  const owner = asRoot(root);
  if (!owner) return { element: null, probe: null };
  for (const probe of LOCATOR_PROBES[name] || []) {
    try {
      const element = owner.querySelector(probe.selector);
      if (!element) continue;
      if (name === 'sidebar' && probe.id === 'sidebar-owner') {
        return { element: safeClosest(element, '[data-sidebar]') || element.parentElement || element, probe: probe.id };
      }
      return { element, probe: probe.id };
    } catch {
      // A future selector must not take down the whole apply cycle.
    }
  }
  if (name === 'chatPanel') {
    const element = reactProbe(owner, 'chat');
    if (element) return { element, probe: 'react-chat-anchor' };
  }
  if (name === 'sidebar') {
    const element = reactProbe(owner, 'sidebar');
    if (element) return { element, probe: 'react-sidebar-anchor' };
  }
  return { element: null, probe: null };
}

/** Return every matching element from the first probe that finds any. */
function findAllProbe(root, name) {
  const owner = asRoot(root);
  if (!owner) return { elements: [], probe: null };
  for (const probe of LOCATOR_PROBES[name] || []) {
    try {
      const elements = [...owner.querySelectorAll(probe.selector)];
      if (elements.length) return { elements, probe: probe.id };
    } catch {
      // Keep trying the ordered fallbacks.
    }
  }
  return { elements: [], probe: null };
}

function ownerFromChild(element, fallbackSelector) {
  return safeClosest(element, fallbackSelector) || element.parentElement || element;
}

/**
 * Snapshot the hooks the runtime depends on. `expectedChat` is route-aware so
 * a browse page without an open chat is not reported as a compatibility failure
 * while a channel page without chat is.
 */
function compatibilitySnapshot(root, options = {}) {
  const owner = asRoot(root);
  const main = findProbe(owner, 'main');
  const sidebar = findProbe(owner, 'sidebar');
  const separator = findProbe(owner, 'chatSeparator');
  const panel = findProbe(owner, 'chatPanel');
  const cards = findAllProbe(main.element || owner, 'card');
  const expectedChat = options.expectedChat !== false;
  const required = [
    ['main', Boolean(main.element)],
    ['sidebar', Boolean(sidebar.element)],
    ...(expectedChat ? [['chat', Boolean(separator.element && panel.element)]] : []),
  ];
  return {
    healthy: required.every(([, present]) => present),
    expectedChat,
    main: Boolean(main.element),
    sidebar: Boolean(sidebar.element),
    chat: Boolean(separator.element && panel.element),
    cards: cards.elements.length,
    probes: {
      main: main.probe,
      sidebar: sidebar.probe,
      chatSeparator: separator.probe,
      chatPanel: panel.probe,
      card: cards.probe,
    },
    missing: required.filter(([, present]) => !present).map(([name]) => name),
  };
}

function compatibilitySummary(snapshot) {
  if (!snapshot || snapshot.healthy) {
    return `Shell hooks matched${snapshot?.cards ? `; ${snapshot.cards} stream cards found` : ''}.`;
  }
  return `Compatibility needs attention: missing ${snapshot.missing.join(', ')}.`;
}

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
    chatStickers: null,
  },
  chatStickerScanTimer: 0,
  chatStickerPendingNodes: new Set(),
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

function stickerImageInfo(image, options = {}) {
  if (!image) return null;
  const rawSrc = image.getAttribute('src') || image.getAttribute('data-src') || image.currentSrc || image.src || '';
  if (!/\/emotes\//i.test(rawSrc)) return null;
  const alt = image.getAttribute('alt') || options.name || 'Sticker';
  if (alt.trim().toLowerCase() === 'emotes') return null;
  const rawId = options.id
    || image.dataset.emoteId
    || image.getAttribute('data-emote-id')
    || rawSrc.match(/\/emotes\/(\d+)/i)?.[1]
    || '';
  const id = String(rawId).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  const name = String(alt).replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sticker';
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
    name: button.getAttribute('aria-label') || button.dataset.emoteName || 'Sticker',
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

function mergeStickerLibrary(observed) {
  let changed = false;
  for (const sticker of observed) {
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
    const record = {
      key: sticker.key,
      id: sticker.id,
      name: sticker.name,
      src: sticker.src,
      nativeGroups,
      access,
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
  const firstGroup = state.stickerPreferences.groups[0];
  const groupsTab = firstGroup
    ? `<button type="button" data-kf-sticker-view="group" data-kf-sticker-group="${escapeHtml(state.stickerPreferences.activeGroup || firstGroup.id)}" data-active="${view === 'group'}" aria-pressed="${view === 'group'}">Groups</button>`
    : '<button type="button" data-kf-sticker-manage="true">Groups</button>';
  organizer.innerHTML = `
    <div data-kf-sticker-topline>
      <div><strong>Sticker shelf</strong><span data-kf-sticker-count>${escapeHtml(countLabel)}</span>${unavailableLabel}</div>
      <button type="button" data-kf-sticker-manage="true">Manage</button>
    </div>
    <div data-kf-sticker-toolbar role="group" aria-label="Sticker views and filters">
      <button type="button" data-kf-sticker-view="pinned" data-active="${view === 'pinned'}" aria-pressed="${view === 'pinned'}">Quick (${state.stickerPreferences.pinned.size})</button>
      <button type="button" data-kf-sticker-view="all" data-active="${view === 'all'}" aria-pressed="${view === 'all'}">All (${allVisible.length})</button>
      ${groupsTab}
      <button type="button" data-kf-sticker-view="native" data-active="${view === 'native'}" aria-pressed="${view === 'native'}">Native</button>
      <button type="button" data-kf-sticker-show-hidden="true" aria-pressed="${showHidden}">${showHidden ? 'Hide removed' : 'Removed'}</button>
    </div>
    ${customGroups ? `<div data-kf-sticker-groups><span>Groups</span>${customGroups}<button type="button" data-kf-sticker-manage="true">Edit groups</button></div>` : ''}
    <div data-kf-sticker-note>New Kick stickers save automatically. Pin with ☆, remove with ×, and organize groups from Manage.</div>
    <section data-kf-sticker-quick-shelf="true">
      <div data-kf-sticker-quick-header><strong>Quick favorites</strong><span data-kf-sticker-quick-count>${quickFavorites.length} available · 3 rows</span><button type="button" data-kf-sticker-view="pinned" aria-pressed="${view === 'pinned'}">Edit shelf</button></div>
      ${quickShelf}
    </section>
    <div data-kf-sticker-secondary-actions><button type="button" data-kf-sticker-reset="true">Reset changes</button></div>
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
  state.runtime.stickerCatalogDirty = true;
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
  if (key) {
    const descriptor = state.stickerCatalog.get(key);
    for (const original of descriptor?.originals || []) {
      original.dataset.kfStickerHidden = String(state.stickerPreferences.hidden.has(key));
      original.dataset.kfStickerPinned = String(state.stickerPreferences.pinned.has(key));
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
    applyDropsEnhancements();
    applyMediaMemory();
    applyPlayerResilience();
    applyChatPause();
    observeChatStickerDiscovery();
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
  .kf-sticker-access[data-access="observed"] { border-color: rgba(56,215,208,.58); color: #70e9e3; }
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
          <div class="kf-brand"><img class="kf-brand-mark" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAkElEQVR42u2XSwqAMAxEZ18P4L28/00E3QmKVPOfioHs2sxb5AtcrLVpi3T0LFq8C5ElfguRLX6CqBI/IIYDWNa562EAT8JaEESISyAgFfd+D89gmn+vASzJqgKwiEtiqAGs5WcC8OoBP8C4AOVJmFKG5Y2IohWXDyOKcUyxkFCsZN/dissPE4rTjOI4rTrPd9CSNAqXgFAlAAAAAElFTkSuQmCC" alt=""><span>Kick Focus</span><span class="kf-badge">Premium</span></div>
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
    <div class="kf-storage-alert" data-kf-storage-alert role="alert" hidden>
      <div class="kf-storage-alert-body">
        <strong data-kf-storage-alert-title>Changes are not being saved</strong>
        <span data-kf-storage-alert-copy></span>
      </div>
      <button type="button" class="kf-button kf-button-small" data-action="open-storage-diagnostics">Details</button>
      <button type="button" class="kf-button kf-button-small" data-action="dismiss-storage-alert">Dismiss</button>
    </div>
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
          <img class="kf-preview-image" src="data:image/jpeg;base64,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" alt="">
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
  const observed = library.filter((sticker) => sticker.access === 'observed').length;
  return `${library.length} recorded · ${state.stickerPreferences.pinned.size} favorites · ${state.stickerPreferences.hidden.size} removed · ${state.stickerPreferences.groups.length} custom groups${observed ? ` · ${observed} seen in chat` : ''}${locked ? ` · ${locked} locked-only` : ''}`;
}

function stickerLibraryFilterMatches(sticker, filter) {
  if (filter === 'favorites') return state.stickerPreferences.pinned.has(sticker.key);
  if (filter === 'removed') return state.stickerPreferences.hidden.has(sticker.key);
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
      const favoriteDifference = Number(state.stickerPreferences.pinned.has(right.key)) - Number(state.stickerPreferences.pinned.has(left.key));
      if (favoriteDifference) return favoriteDifference;
      const removedDifference = Number(state.stickerPreferences.hidden.has(left.key)) - Number(state.stickerPreferences.hidden.has(right.key));
      return removedDifference || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
  const filters = [
    ['all', `All recorded (${state.stickerPreferences.library.size})`],
    ['favorites', `Favorites (${state.stickerPreferences.pinned.size})`],
    ['removed', `Removed (${state.stickerPreferences.hidden.size})`],
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
    const favorite = state.stickerPreferences.pinned.has(sticker.key);
    const removed = state.stickerPreferences.hidden.has(sticker.key);
    const groupId = state.stickerPreferences.assignments.get(sticker.key) || '';
    const nativeGroups = sticker.nativeGroups.length ? sticker.nativeGroups.join(', ') : 'Unknown Kick group';
    const searchText = `${sticker.name} ${nativeGroups}`.toLowerCase();
    const accessLabel = sticker.access === 'available' ? 'Seen available' : sticker.access === 'observed' ? 'Seen in chat' : 'Locked only';
    return `<article class="kf-sticker-library-item" data-kf-sticker-library-item data-kf-sticker-search="${escapeHtml(searchText)}" data-removed="${removed}">
      <div class="kf-sticker-library-image"><img src="${escapeHtml(sticker.src)}" alt="${escapeHtml(sticker.name)}" loading="lazy"></div>
      <div class="kf-sticker-library-copy"><strong title="${escapeHtml(sticker.name)}">${escapeHtml(sticker.name)}</strong><small title="${escapeHtml(nativeGroups)}">${escapeHtml(nativeGroups)}</small><span class="kf-sticker-access" data-access="${escapeHtml(sticker.access)}">${accessLabel}</span></div>
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
        <div class="kf-sticker-library-meta"><span data-kf-sticker-library-visible>${library.length} shown</span><span>New stickers from chat and the picker are merged automatically and included in export.</span></div>
        ${cards ? `<div class="kf-sticker-library-grid">${cards}</div>` : `<div class="kf-notice">${state.stickerPreferences.library.size ? 'No recorded stickers match this filter.' : 'Watch chat or open Kick’s sticker picker to begin the library. New stickers are saved whenever Kick exposes them.'}</div>`}
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
        ${row('Pause home-page autoplay', 'Keep background Home previews silent and paused; deliberate playback remains available.', toggle('content.pauseHomeAutoplay', value.pauseHomeAutoplay, { label: 'Pause home-page autoplay' }))}
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
        ${row('Organize chat stickers', 'Continuously record stickers from live chat and Kick’s picker, then add favorites, removals, search, and custom groups.', toggle('content.organizeChatStickers', value.organizeChatStickers, { label: 'Organize chat stickers' }))}
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
      <div class="kf-action-row"><div><h3>Panic switch</h3><p>Temporarily restore Kick’s native layout and pause Kick Focus hooks without reloading. Restore it from the Focus button or with Ctrl+Shift+F.</p></div><button type="button" class="kf-button kf-danger" data-action="toggle-panic">${state.runtime.suspended ? 'Restore Kick Focus' : 'Pause Kick Focus'}</button></div>
      <div class="kf-action-row"><div><h3>Diagnostics</h3><p>Copy a sanitized summary or run a local self-check.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="copy-diagnostics">Copy diagnostic summary</button><button type="button" class="kf-button" data-action="self-check">Run self-check</button></div></div>
      <div class="kf-action-row"><div><h3>Compatibility self-test</h3><p data-kf-compatibility-detail>${escapeHtml(state.compatibility ? `${compatibilitySummary(state.compatibility)} Probes are checked after every route update.` : 'The shell probes will run after the page mounts.')}</p></div><button type="button" class="kf-button" data-action="self-check">Run now</button></div>
      <div class="kf-action-row"><div><h3>Settings portability</h3><p>Move preferences, recorded sticker metadata, favorites, removals, and custom groups using one local JSON file.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="import">Import settings</button><button type="button" class="kf-button" data-action="export">Export settings</button></div></div>
      <div class="kf-action-row"><div><h3>Reset all settings</h3><p>Restore every setting and shortcut to factory defaults.</p></div><button type="button" class="kf-button kf-danger" data-action="reset-all">Reset all settings</button></div>
    </section>
    ${renderStorageHealthPanel()}
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
      state.runtime.stickerCatalogDirty = true;
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
        :host { display: inline-flex; flex: 0 0 auto; color-scheme: dark; }
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
        @media (max-width: 960px) {
          button { width: 36px; padding: 0; }
          span { display: none; }
        }
      </style>
      <button type="button" aria-label="Open Kick Focus command menu" title="Kick Focus">
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAkElEQVR42u2XSwqAMAxEZ18P4L28/00E3QmKVPOfioHs2sxb5AtcrLVpi3T0LFq8C5ElfguRLX6CqBI/IIYDWNa562EAT8JaEESISyAgFfd+D89gmn+vASzJqgKwiEtiqAGs5WcC8OoBP8C4AOVJmFKG5Y2IohWXDyOKcUyxkFCsZN/dissPE4rTjOI4rTrPd9CSNAqXgFAlAAAAAElFTkSuQmCC" alt="">
        <span data-kf-header-control-label>Focus</span>
      </button>`;
    const button = shadow.querySelector('button');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.runtime.suspended) togglePanicSwitch();
      else openCommandMenu();
    });
    state.headerControlHost = host;
    state.headerControlButton = button;
  }

  if (state.headerControlHost.parentElement !== owner || state.headerControlHost.nextElementSibling !== target) {
    owner.insertBefore(state.headerControlHost, target);
  }
  return state.headerControlHost.isConnected;
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

})();
