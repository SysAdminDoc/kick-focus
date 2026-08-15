export const VERSION = '1.4.0';
export const SETTINGS_SCHEMA = 2;

export const DEFAULT_SETTINGS = Object.freeze({
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

export const AD_HOSTS = Object.freeze([
  'imasdk.googleapis.com',
  'pagead2.googlesyndication.com',
  'pubads.g.doubleclick.net',
  'securepubads.g.doubleclick.net',
  'googleads.g.doubleclick.net',
  'partner.googleadservices.com',
  'adservice.google.com',
  'tpc.googlesyndication.com',
]);

export const TELEMETRY_HOSTS = Object.freeze([
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

export function clamp(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export function normalizeShortcut(value, fallback) {
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

export function normalizeSettings(input) {
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

export function routeKind(input) {
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

export function sanitizeDiagnosticUrl(rawUrl) {
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

export function classifyRequest(rawUrl, options = {}) {
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
export const APPLY_MAX_WAIT = 500;

/**
 * Delay before the next apply cycle, given how long work has already waited.
 * Returns 0 once the cap is reached, which converts a starving debounce into a
 * throttle without giving up burst coalescing.
 */
export function nextApplyDelay(requestedDelay, waitedMs, maxWait = APPLY_MAX_WAIT) {
  const requested = Math.max(0, Number(requestedDelay) || 0);
  const waited = Math.max(0, Number(waitedMs) || 0);
  const remaining = Math.max(0, maxWait - waited);
  return Math.min(requested, remaining);
}

// A grid this small can legitimately be mostly filtered; below it the ratio
// test is noise. Above it, hiding this share of a page is far more likely to be
// a labelling mistake than a page that really is mostly casino content.
export const FILTER_MIN_SAMPLE = 8;
export const FILTER_MAX_HIDDEN_RATIO = 0.25;

/**
 * Decide whether filtering may be applied to a grid.
 *
 * Filtering is suspended rather than applied when it would hide most of a page.
 * A filter that empties a grid is indistinguishable from the site being broken,
 * and the user has no way to tell which happened, so the safe failure is to
 * show everything and say so.
 */
export function filterDecision(total, wouldHide, options = {}) {
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
export const CASINO_CATEGORY_SLUGS = Object.freeze([
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
export const AD_STACK_BASELINE = Object.freeze({
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
export function assessAdStack(observed = {}) {
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
export function describeInjection({ readyState, scriptCount, hasBody } = {}) {
  const scripts = Math.max(0, Number(scriptCount) || 0);
  if (hasBody || readyState === 'complete' || readyState === 'interactive') {
    return { grade: 'late', scripts, summary: 'after the page began rendering' };
  }
  if (scripts > 0) {
    return { grade: 'contended', scripts, summary: `after ${scripts} page script${scripts === 1 ? '' : 's'}` };
  }
  return { grade: 'first', scripts, summary: 'before any page script' };
}

export function isPlaybackUrl(rawUrl) {
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
export function neutralizePlaybackPayload(rawText, options = {}) {
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

export function detectContentLabels(text, context = {}) {
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

export const STICKER_PREFERENCES_SCHEMA = 3;

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

export function normalizeStickerPreferences(input) {
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

export const BLOCKLIST_SCHEMA = 1;

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
export function validateRemoteBlocklist(payload) {
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
export function validateImportedSettings(jsonText) {
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
export const STORAGE_LABELS = {
  'kick-focus:settings': 'settings',
  'kick-focus:sticker-preferences': 'emote library',
  'kick-focus:media-preferences': 'volume and quality memory',
  'kick-focus:chat-keywords': 'chat keyword filters',
  'kick-focus:channel-notes': 'channel notes',
  'kick-focus:channel-layouts': 'per-channel layout',
  'kick-focus:remote-blocklist': 'blocklist cache',
  'kick-focus:emote-usage': 'emote usage counts',
};

export function storageLabel(key) {
  return STORAGE_LABELS[key] || String(key || '').replace(/^kick-focus:/, '') || 'data';
}

/**
 * Fold a failed or recovered write into a failure registry.
 *
 * Keyed by storage key so a repeatedly failing library reports once rather than
 * once per keystroke, and a later success clears the entry.
 */
export function recordStorageResult(registry, key, ok, at = 0) {
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
export function describeStorageFailures(registry) {
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
export function approximateStorageBytes(entries) {
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

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}
