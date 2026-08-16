/* Kick Focus 1.16.0 — generated from src/. Edit the source, not this file. */
(() => {
'use strict';
if (window.__kickFocusBooted) return;
window.__kickFocusBooted = true;
const VERSION = '1.16.0';
const SETTINGS_SCHEMA = 4;

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
    hideMonetization: false,
    reduceTelemetry: true,
    rememberVolume: true,
    rememberQuality: true,
    rememberVodPosition: true,
    stickyChatPause: false,
    chatHighlights: false,
    organizeChatStickers: true,
    clickChatEmotes: true,
    // Off by default: this one types into Kick's chat input. Copying a name to
    // the clipboard needs no permission and always ships; putting characters in
    // someone's message box is an opt-in.
    insertEmoteName: false,
    // Where a newly favorited emote lands. Global by default: changing this
    // under existing users would make favorites vanish when they switch channel.
    favoriteScope: 'global',
    playbackDiagnostics: false,
    hiddenChannels: [],
    blocklistSubscription: false,
    blocklistUrl: '',
    blocklistRefreshHours: 24,
    // Kick's own data, read the way Kick's own client reads it. Same-origin,
    // read-only, inheriting the session the page already has.
    liveEmoteCatalog: true,
    liveChatEvents: true,
    showModerationReasons: true,
    showChatBadges: true,
    countEmoteUsage: true,
    showEmoteRarity: true,
    warnShadowedEmotes: true,
    staticEmotes: false,
    fixPlayerLoading: true,
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

/**
 * Telemetry hosts that must never be hard-cancelled at the network layer.
 *
 * Blocking litix.io (Mux Data) with a cancel/error triggers an unbounded retry
 * storm — uAssets #33860 measured 139,182 of 139,189 blocks on this one host,
 * surfacing to users as #34081 "massive delays entering live streams". The page
 * realm still answers it with an empty 200 (blockedResponse), which the player
 * accepts without retrying, so it stays in TELEMETRY_HOSTS for that strategy but
 * is excluded from the companion's DNR / webRequest cancel set.
 */
const TELEMETRY_NO_CANCEL_HOSTS = Object.freeze(['litix.io']);

/** Telemetry hosts the network layer may hard-cancel without a retry storm. */
function cancellableTelemetryHosts() {
  return TELEMETRY_HOSTS.filter((host) => !TELEMETRY_NO_CANCEL_HOSTS.includes(host));
}

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

/**
 * The key of the shortcut that already uses `candidate`, or '' if none does.
 * README advertises that reassigning a shortcut rejects a duplicate; this is the
 * decision behind that, extracted so it can be tested rather than only reached
 * through the capture handler.
 */
function findShortcutConflict(shortcuts, capturingKey, candidate) {
  if (!isRecord(shortcuts) || typeof candidate !== 'string' || !candidate) return '';
  const wanted = candidate.toLowerCase();
  for (const [key, value] of Object.entries(shortcuts)) {
    if (key === capturingKey) continue;
    if (typeof value === 'string' && value.toLowerCase() === wanted) return key;
  }
  return '';
}

/** How an emote's access level reads to a user, shared by the library and the chat tooltip. */
const EMOTE_ACCESS_LABELS = Object.freeze({
  available: 'Seen available',
  channel: 'Channel-only',
  observed: 'Seen in chat',
  locked: 'Subscriber-only',
});

function emoteAccessLabel(access) {
  return EMOTE_ACCESS_LABELS[access] || EMOTE_ACCESS_LABELS.locked;
}

/**
 * The lines of the hover card for one chat emote.
 *
 * Everything here is already recorded — name, Kick's own set names, access
 * level, first capture, and whether this name is shadowed by another channel's
 * emote. It was only reachable by opening the library manager, so a click-to-
 * save control gave no indication of what it was about to save or whether it
 * had it already.
 *
 * Returns an array of lines so the caller can render each as its own node and
 * never has to parse a delimiter back out. Empty for anything unnamed, which is
 * how a non-emote image ends up with no tooltip at all.
 */
function emoteTooltipText(entry, collisions = [], saved = false) {
  if (!isRecord(entry) || typeof entry.name !== 'string' || !entry.name) return [];
  const lines = [entry.name];
  // A chat-discovered emote's only "set" is the literal string 'Seen in chat',
  // which is also its access label — printing both reads as a stutter.
  const access = emoteAccessLabel(entry.access);
  const sets = (Array.isArray(entry.nativeGroups) ? entry.nativeGroups : [])
    .filter((group) => group && group !== access);
  lines.push(sets.length ? `${sets.join(' · ')} · ${access}` : access);
  if (Number.isFinite(entry.firstSeen) && entry.firstSeen > 0) {
    lines.push(`First seen ${new Date(entry.firstSeen).toISOString().slice(0, 10)}`);
  }
  // Kick resolves a typed name through one map, so a shared name means one
  // channel's emote silently sends the other's. Naming the winner is the whole
  // value of the warning — "shadowed" alone does not say which one you get.
  const collision = (Array.isArray(collisions) ? collisions : [])
    .find((item) => isRecord(item) && item.name === entry.name);
  if (collision) {
    const winner = isRecord(collision.winner) ? collision.winner.setName : '';
    lines.push(winner ? `Name shadowed — typing it sends ${winner}` : 'Name shadowed by another set');
  }
  lines.push(saved ? 'Saved — click to open in the library' : 'Click to save');
  return lines;
}

/**
 * A Kick emote name as it may be typed into chat: the plain token, nothing else.
 *
 * This is the boundary that keeps "use an emote you have seen" from becoming
 * "send an emote you do not own". Kick's wire form is `[emote:<id>:<name>]`,
 * and putting that in the input is an entitlement bypass — so a name carrying
 * a bracket, colon, or whitespace is refused outright rather than sanitised
 * into something that looks close enough.
 */
const PLAIN_EMOTE_NAME = /^[A-Za-z0-9_]{1,64}$/;

/**
 * What may be copied or typed for one recorded emote.
 *
 * Emotes discovered in chat are dead weight outside the library manager: you
 * can see them, but not use them. This makes the *name* available while leaving
 * entitlement exactly where Kick put it — the name is what a user would type by
 * hand, and typing it resolves through Kick's own map or does nothing.
 *
 * `text` is always the plain name. There is no branch that emits an id or a
 * wire token, and nothing here sends anything: the caller inserts at the caret
 * and stops.
 */
function insertionPlanFor(descriptor, collisions = [], access = '') {
  const name = isRecord(descriptor) ? String(descriptor.name ?? '').trim() : '';
  if (!name) return { ok: false, text: '', warning: '', sendable: false, reason: 'unnamed' };
  if (!PLAIN_EMOTE_NAME.test(name)) {
    // A descriptor that already holds a wire token, or a name with characters
    // chat would not treat as one token, is refused rather than repaired.
    return { ok: false, text: '', warning: '', sendable: false, reason: 'not-a-plain-name' };
  }

  // Subscriber-only stays subscriber-only. The name copies — it is public — but
  // the plan says plainly that typing it will not produce the emote, instead of
  // letting the user discover that in a live chat.
  const sendable = access !== 'locked';
  const collision = (Array.isArray(collisions) ? collisions : [])
    .find((item) => isRecord(item) && item.name === name);
  const winner = isRecord(collision?.winner) ? collision.winner.setName : '';
  const warning = !sendable
    ? `${name} is subscriber-only, so typing it will not send the emote.`
    : collision
      ? (winner
        ? `Another set shadows ${name} — typing it sends ${winner}'s emote.`
        : `Another set shadows ${name}, so typing it may send a different emote.`)
      : '';
  return { ok: true, text: name, warning, sendable, reason: '' };
}

/**
 * Where each keyword occurs in one run of text, as non-overlapping spans.
 *
 * Case-insensitive, sorted, and merged where two keywords overlap or touch, so
 * the caller can turn each span straight into a Range without producing nested
 * or duplicate highlights. `limit` caps the total, because a chat that scrolls
 * for hours can accumulate more matches than are worth painting.
 */
function findKeywordSpans(text, keywords, limit = 500) {
  const haystack = typeof text === 'string' ? text.toLowerCase() : '';
  const needles = (Array.isArray(keywords) ? keywords : [])
    .map((keyword) => (typeof keyword === 'string' ? keyword.trim().toLowerCase() : ''))
    .filter(Boolean);
  if (!haystack || !needles.length) return [];
  const spans = [];
  for (const needle of needles) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      spans.push({ start: at, end: at + needle.length });
      from = at + needle.length;
      if (spans.length >= limit * 4) break;
    }
  }
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
    if (merged.length >= limit) break;
  }
  return merged;
}

/**
 * Running cost of the apply cycle, so a regression shows up as a number.
 *
 * Kept as plain deltas rather than `performance.measure` entries: measures land
 * in the page's own performance timeline, where Kick's instrumentation could
 * read them, and this build's rule is that its identity never leaks into page
 * globals. The number is what matters, and it is shown on the About page and
 * carried in the diagnostics copy.
 */
function recordApplyCost(stats, ms) {
  const prior = isRecord(stats) ? stats : {};
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return { ...prior };
  const count = (Number(prior.count) || 0) + 1;
  const total = (Number(prior.total) || 0) + value;
  return {
    count,
    total,
    last: value,
    max: Math.max(Number(prior.max) || 0, value),
    // Recent average over a sliding window, so a slow first paint does not
    // dominate the figure forever.
    recent: [...(Array.isArray(prior.recent) ? prior.recent : []), value].slice(-20),
  };
}

function applyCostSummary(stats) {
  if (!isRecord(stats) || !(Number(stats.count) > 0)) return 'No apply cycle has run yet.';
  const recent = Array.isArray(stats.recent) && stats.recent.length ? stats.recent : [stats.last];
  const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const fmt = (value) => (value >= 10 ? Math.round(value) : Math.round(value * 10) / 10);
  return `${stats.count} runs · last ${fmt(stats.last)} ms · recent avg ${fmt(recentAvg)} ms · max ${fmt(stats.max)} ms`;
}

/**
 * The overlay layers this build can stack, outermost last. The first one that
 * is open is the one on top.
 *
 * The reset alertdialog is nested *inside* the settings shell, which is exactly
 * why this has to be a shared decision: the focus trap scoped itself to the
 * settings shell and let Tab walk the page the dialog was obscuring, while
 * Escape closed all of Settings rather than the prompt the user meant to
 * decline. Tab and Escape now read the same ladder, so they cannot drift again
 * (they already had — the trap ranked the command menu above settings and
 * Escape ranked settings above the command menu).
 */
const OVERLAY_LAYERS = [
  ['multistream', '.kf-ms-shell'],
  ['command', '.kf-command-shell'],
  ['resetConfirm', '.kf-confirm-card'],
  ['settings', '[data-kf-settings-shell]'],
];

/**
 * Which layer owns focus and Escape right now, or null if none is open.
 * `open` maps a layer name to whether it is currently shown.
 */
function topmostOverlayLayer(open) {
  if (!isRecord(open)) return null;
  const found = OVERLAY_LAYERS.find(([layer]) => open[layer] === true);
  return found ? { layer: found[0], selector: found[1] } : null;
}

/**
 * Locale-correct plural selection.
 *
 * English has only one/other, but CLDR 48 gives both es and pt a "many"
 * category, so a hand-built `n === 1 ? word : word + 's'` is wrong in those
 * locales. `forms` maps Intl.PluralRules categories (one/few/many/other/…) to
 * strings; the CLDR category for the count and locale chooses one, falling back
 * to `other`. Intl.PluralRules is Baseline since 2019 and needs no dependency.
 */
function pluralForm(count, forms, locale = 'en') {
  const value = Number(count);
  const source = forms && typeof forms === 'object' ? forms : {};
  let category = 'other';
  try {
    category = new Intl.PluralRules(String(locale || 'en')).select(Number.isFinite(value) ? value : 0);
  } catch {
    category = 'other';
  }
  return source[category] ?? source.other ?? '';
}

/**
 * Strip query strings and long opaque tokens from an error message before it is
 * shown in the diagnostics log or copied, matching the protection log's "query
 * strings are never retained" discipline. Nothing is sent anywhere; this only
 * keeps a local record from carrying a session token or a channel id.
 */
function sanitizeErrorMessage(message, limit = 300) {
  return String(message ?? '')
    .replace(/[?#][^\s'")]*/g, '')          // drop query strings and fragments
    .replace(/[A-Za-z0-9_-]{40,}/g, '…')    // drop long opaque tokens / ids
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

/**
 * A remote blocklist URL is only accepted when it is a well-formed https URL.
 * Validated here, at normalize time, so the value that reaches the privileged
 * companion fetch and the userscript transport can never be a `javascript:`,
 * `data:`, `http:` or otherwise malformed string.
 */
function normalizeBlocklistUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
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
    : enumValue(layout.sidebar, ['auto', 'compact', 'dropdown', 'hidden'], defaults.layout.sidebar);
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
      hideMonetization: bool(content.hideMonetization, defaults.content.hideMonetization),
      reduceTelemetry: bool(content.reduceTelemetry, defaults.content.reduceTelemetry),
      rememberVolume: bool(content.rememberVolume, defaults.content.rememberVolume),
      rememberQuality: bool(content.rememberQuality, defaults.content.rememberQuality),
      rememberVodPosition: bool(content.rememberVodPosition, defaults.content.rememberVodPosition),
      stickyChatPause: bool(content.stickyChatPause, defaults.content.stickyChatPause),
      chatHighlights: bool(content.chatHighlights, defaults.content.chatHighlights),
      organizeChatStickers: bool(content.organizeChatStickers, defaults.content.organizeChatStickers),
      clickChatEmotes: bool(content.clickChatEmotes, defaults.content.clickChatEmotes),
      insertEmoteName: bool(content.insertEmoteName, defaults.content.insertEmoteName),
      favoriteScope: enumValue(content.favoriteScope, ['global', 'channel'], defaults.content.favoriteScope),
      playbackDiagnostics: bool(content.playbackDiagnostics, defaults.content.playbackDiagnostics),
      hiddenChannels: cleanBlocklistValues(content.hiddenChannels, normalizeChannelPath, 200),
      blocklistSubscription: bool(content.blocklistSubscription, defaults.content.blocklistSubscription),
      blocklistUrl: normalizeBlocklistUrl(content.blocklistUrl),
      blocklistRefreshHours: enumValue(Number(content.blocklistRefreshHours), [6, 12, 24, 72], defaults.content.blocklistRefreshHours),
      liveEmoteCatalog: bool(content.liveEmoteCatalog, defaults.content.liveEmoteCatalog),
      liveChatEvents: bool(content.liveChatEvents, defaults.content.liveChatEvents),
      showModerationReasons: bool(content.showModerationReasons, defaults.content.showModerationReasons),
      showChatBadges: bool(content.showChatBadges, defaults.content.showChatBadges),
      countEmoteUsage: bool(content.countEmoteUsage, defaults.content.countEmoteUsage),
      showEmoteRarity: bool(content.showEmoteRarity, defaults.content.showEmoteRarity),
      warnShadowedEmotes: bool(content.warnShadowedEmotes, defaults.content.warnShadowedEmotes),
      staticEmotes: bool(content.staticEmotes, defaults.content.staticEmotes),
      fixPlayerLoading: bool(content.fixPlayerLoading, defaults.content.fixPlayerLoading),
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

/** Keep the strongest known emote access without dereferencing a missing record. */
function preferredStickerAccess(existingAccess, incomingAccess) {
  const accessRank = { observed: 0, locked: 1, channel: 2, available: 3 };
  const incoming = Object.hasOwn(accessRank, incomingAccess) ? incomingAccess : 'locked';
  if (!Object.hasOwn(accessRank, existingAccess)) return incoming;
  return accessRank[existingAccess] >= accessRank[incoming] ? existingAccess : incoming;
}

/**
 * Fold one observation of an emote into its stored record.
 *
 * Kick edits emotes users have already pulled — a 2026-07-24 report of four
 * changed emotes was answered by Kick support with "remastered… clear your
 * cache" — so the local record is the only version a user can check against.
 * `wasName`/`wasSrc` always hold the value at *first* capture, not the previous
 * one, so a rename and a rename-back correctly reads as unchanged.
 *
 * Pure: no clock of its own, so the caller supplies `now` and tests are exact.
 */
function recordStickerObservation(existing, observed, now) {
  const at = cleanCaptureTime(now);
  if (!existing) {
    return { ...observed, firstSeen: at, lastSeen: at };
  }
  // An entry carried over from schema 3 keeps `firstSeen: 0` — unknown. Stamping
  // it with today would claim the emote was first seen now, when in fact it was
  // recorded before this build tracked dates at all.
  const entry = { ...existing, ...observed, firstSeen: cleanCaptureTime(existing.firstSeen), lastSeen: at };

  const originalName = existing.wasName || existing.name;
  if (originalName && originalName !== entry.name) entry.wasName = originalName;
  else delete entry.wasName;

  const originalSrc = existing.wasSrc || existing.src;
  if (originalSrc && originalSrc !== entry.src) entry.wasSrc = originalSrc;
  else delete entry.wasSrc;

  return entry;
}

/** Whether Kick has changed this entry since it was first recorded. */
function stickerChangedSinceCapture(entry) {
  return Boolean(entry?.wasName || entry?.wasSrc);
}

/**
 * Say what changed, in the user's terms. Returns '' when nothing has, so the
 * caller can use it directly as a presence test.
 */
function describeStickerChange(entry) {
  if (!entry) return '';
  const parts = [];
  if (entry.wasName) parts.push(`renamed from "${entry.wasName}"`);
  if (entry.wasSrc) parts.push('artwork replaced');
  if (!parts.length) return '';
  const first = cleanCaptureTime(entry.firstSeen);
  const when = first ? ` since first seen ${new Date(first).toISOString().slice(0, 10)}` : ' since first capture';
  return `Kick has ${parts.join(' and ')}${when}.`;
}

/** How many library entries Kick has edited since they were recorded. */
function countChangedStickers(library) {
  const entries = library instanceof Map ? [...library.values()] : (Array.isArray(library) ? library : []);
  return entries.filter((entry) => stickerChangedSinceCapture(entry)).length;
}

/**
 * Decide which chat badges this build has to draw itself.
 *
 * Kick renders some badges in its own markup but omits the collectible and
 * global ones `badges_v2` carries, so the job is to fill that gap without
 * duplicating what is already on screen. An image URL is the only reliable
 * identity — badge `type` is absent on some entries and `text` is localised —
 * so a badge whose image Kick already drew is skipped, and a badge with no
 * image at all is kept because it cannot be matched and reads as text anyway.
 */
function chatBadgesToRender(badges, drawnImageUrls = []) {
  if (!Array.isArray(badges)) return [];
  const drawn = drawnImageUrls instanceof Set ? drawnImageUrls : new Set(drawnImageUrls);
  const seen = new Set();
  const render = [];
  for (const badge of badges) {
    if (!badge || typeof badge !== 'object') continue;
    const label = badge.text || badge.type;
    if (!label) continue;
    if (badge.image && drawn.has(badge.image)) continue;
    // A payload repeating the same badge must not draw it twice.
    const key = badge.image || `text:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    render.push({ label, image: badge.image || '' });
  }
  return render;
}

/**
 * Accumulated API drift report.
 *
 * Kick removed an endpoint, dropped a header, and changed moderation behaviour
 * inside four weeks, and each was found by a competing client breaking in
 * public. This detects shape changes at the boundary rather than discovering
 * them through breakage; the model is assessAdStack above.
 */
function assessApiDrift(events = []) {
  if (!events.length) {
    return { drifted: false, summary: 'No API shape mismatches this session.' };
  }
  const unique = new Map();
  for (const event of events) {
    const key = `${event.endpoint}:${event.reason}`;
    unique.set(key, event);
  }
  const entries = [...unique.values()];
  const summary = entries.map((e) =>
    `${e.endpoint} — ${e.reason}${e.detail ? ` (${e.detail})` : ''}`
  ).join('; ');
  return {
    drifted: true,
    count: entries.length,
    summary: `${entries.length} API shape change${entries.length === 1 ? '' : 's'}: ${summary}.`,
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

/**
 * Identify a Kick control whose only purpose is spending or spend-based social
 * proof. Inputs are deliberately plain strings so the DOM adapter can stay
 * small and the false-positive boundary can be unit-tested.
 */
function monetizationKind({ text = '', ariaLabel = '', title = '', testId = '' } = {}) {
  const id = String(testId).trim().toLowerCase();
  if (id === 'sub-button') return 'subscribe';
  if (id === 'gift-sub-button' || id === 'gift-shop-button') return 'gift';
  if (id === 'kicks-top-nav' || id === 'get-kicks') return 'currency';

  const label = [text, ariaLabel, title]
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase())
    .find(Boolean) || '';
  if (/^(?:subscribe|subscription)$/.test(label)) return 'subscribe';
  if (/^(?:gift (?:subs?|dubs?|a sub|a subscription)|send a gift)$/.test(label)) return 'gift';
  if (/^(?:get|buy|purchase) kicks?$/.test(label)) return 'currency';
  if (label === 'expand leaderboard' || label === 'gift leaderboard') return 'leaderboard';
  return '';
}

const STICKER_PREFERENCES_SCHEMA = 8;

/**
 * The platform an emote key belongs to.
 *
 * Keys were `id:<id>` or `name:<name>|src:<url>`, which says nothing about
 * where the emote came from. Everything this build records is Kick's, so today
 * that is a constant — but the library, the favorites, the removals and the
 * group assignments are all keyed by the same string, and adding the origin
 * later would mean migrating four stores at once against data that had grown
 * for months. The prefix goes in now, while the migration is small.
 */
const PLATFORM_ID = 'kick';

/** A key written before the prefix existed: the two legacy forms, nothing else. */
const UNPREFIXED_STICKER_KEY = /^(?:id|name):/;

/**
 * Prefix a key with its platform, idempotently.
 *
 * Applied unconditionally rather than gated on the stored schema number, so a
 * store that is half-migrated — an export from an older build imported into a
 * newer one, say — heals instead of splitting into two key spaces. Only the two
 * legacy shapes are rewritten; anything already carrying a platform is left as
 * it is, and an emote whose *name* happens to start with `kick:` is unaffected
 * because a raw key always begins `id:` or `name:`.
 */
function platformStickerKey(key, platformId = PLATFORM_ID) {
  if (typeof key !== 'string' || !key) return '';
  return UNPREFIXED_STICKER_KEY.test(key) ? `${platformId}:${key}` : key;
}

/**
 * Timestamps travel through the settings export, so an imported file can carry
 * anything. Anything not a plausible epoch-millisecond reading is discarded
 * rather than clamped, because a wrong date is worse than no date: the whole
 * point of the record is that the user can trust it.
 */
const EARLIEST_CAPTURE_MS = Date.UTC(2024, 0, 1);

function cleanCaptureTime(value) {
  const time = Number(value);
  if (!Number.isFinite(time) || time < EARLIEST_CAPTURE_MS) return 0;
  // A reading far in the future is a broken clock or a hand-edited file.
  if (time > EARLIEST_CAPTURE_MS + 100 * 365 * 24 * 60 * 60 * 1000) return 0;
  return Math.floor(time);
}

// 360, not 320: a key is built and sliced to 320 before the platform prefix is
// added, so the longest legitimate migrated key is 320 plus the prefix. At 320
// this cap silently dropped the longest name-and-src keys during migration.
const STICKER_KEY_MAX_LENGTH = 360;

function cleanStickerKeys(input, limit = 2400) {
  if (!Array.isArray(input)) return [];
  const values = [];
  const seen = new Set();
  for (const raw of input) {
    if (typeof raw !== 'string' || raw.length > STICKER_KEY_MAX_LENGTH) continue;
    const value = platformStickerKey(raw.trim());
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

const STICKER_LIBRARY_LIMIT = 2400;

/**
 * Evict the recorded library down to `limit` without discarding anything the
 * user acted on. A naive FIFO truncation kept the oldest entries and dropped
 * every NEW one once the cap was hit; this drops the most disposable records
 * instead — `observed` (chat-only) before `locked`, oldest `lastSeen` first —
 * and never evicts an `available` emote or one that is favorited or assigned.
 * Returns the retained list and how many entries were dropped.
 */
function evictStickerLibrary(library, limit = STICKER_LIBRARY_LIMIT, protectedKeys = new Set()) {
  const list = Array.isArray(library) ? library : [...library];
  if (list.length <= limit) return { library: list, evicted: 0 };
  const keep = protectedKeys instanceof Set ? protectedKeys : new Set(protectedKeys);
  const isProtected = (entry) => entry.access === 'available' || keep.has(entry.key);
  const rank = (entry) => (entry.access === 'observed' ? 0 : 1);
  const evictable = list
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !isProtected(entry))
    .sort((a, b) => {
      if (rank(a.entry) !== rank(b.entry)) return rank(a.entry) - rank(b.entry);
      const ageDifference = cleanCaptureTime(a.entry.lastSeen) - cleanCaptureTime(b.entry.lastSeen);
      return ageDifference || a.index - b.index;
    });
  const dropCount = Math.min(list.length - limit, evictable.length);
  const dropped = new Set(evictable.slice(0, dropCount).map(({ index }) => index));
  return { library: list.filter((_, index) => !dropped.has(index)), evicted: dropCount };
}

/**
 * Turn a realtime chat frame's emote list into library observations.
 *
 * These are frame-only: no DOM node corroborated them, and the id came off the
 * wire, so a crafted `[emote:999999:Fake]` token would otherwise let anyone burn
 * a library slot. The caller must validate each src loads as an image before
 * committing it. `urlFn` builds the CDN src from the id (injected so this stays
 * pure and testable). Ids are deduped and both id- and name-derived duplicates
 * collapse to one id-keyed entry.
 */
function observationsFromChatEmotes(emotes, urlFn) {
  if (!Array.isArray(emotes)) return [];
  const out = [];
  const seen = new Set();
  for (const emote of emotes) {
    if (!isRecord(emote)) continue;
    const id = cleanStickerText(emote.id, 64).replace(/[^a-zA-Z0-9_-]/g, '');
    const name = cleanStickerText(emote.name, 80);
    if (!id || !name) continue;
    const key = `id:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const src = cleanStickerAssetUrl(typeof urlFn === 'function' ? urlFn(id) : '');
    if (!src) continue;
    out.push({ key, id, name, src, nativeGroups: ['Seen in chat'], access: 'observed' });
  }
  return out;
}

function cleanStickerLibrary(input, hiddenSet = new Set()) {
  if (!Array.isArray(input)) return [];
  const library = [];
  const keys = new Set();
  for (const raw of input) {
    if (!isRecord(raw)) continue;
    const key = cleanStickerKeys([raw.key], 1)[0];
    const name = cleanStickerText(raw.name, 80);
    const src = cleanStickerAssetUrl(raw.src);
    // A removed key is a slot the user freed; never re-materialise it here.
    if (!key || !name || !src || keys.has(key) || hiddenSet.has(key)) continue;
    keys.add(key);
    const entry = {
      key,
      id: cleanStickerText(raw.id, 120).replace(/[^a-zA-Z0-9_-]/g, ''),
      name,
      src,
      nativeGroups: [...new Set((Array.isArray(raw.nativeGroups) ? raw.nativeGroups : [])
        .map((group) => cleanStickerText(group, 80))
        .filter(Boolean))].slice(0, 20),
      access: enumValue(raw.access, ['available', 'channel', 'observed', 'locked'], 'available'),
      sourceSlug: favoriteScope(raw.sourceSlug),
      requiresFollow: raw.requiresFollow === true,
      followed: raw.followed === true,
      subscribersOnly: raw.subscribersOnly === true,
      // Schema 4. Entries captured before it carry 0, which reads as unknown
      // rather than as a date the record cannot actually support.
      firstSeen: cleanCaptureTime(raw.firstSeen),
      lastSeen: cleanCaptureTime(raw.lastSeen),
    };
    // Only present once Kick has changed the entry under the user, which is
    // the case this record exists to catch — and keeping them optional stops a
    // 2,400-entry library from carrying a duplicate of itself.
    const wasName = cleanStickerText(raw.wasName, 80);
    if (wasName && wasName !== name) entry.wasName = wasName;
    const wasSrc = cleanStickerAssetUrl(raw.wasSrc);
    if (wasSrc && wasSrc !== src) entry.wasSrc = wasSrc;
    library.push(entry);
    // A generous hard ceiling bounds a crafted import; evictStickerLibrary does
    // the real capping and protects the records the user actually acted on.
    if (library.length >= STICKER_LIBRARY_LIMIT * 2) break;
  }
  return library;
}

/**
 * Favorites, scoped and ordered.
 *
 * A favorite is `{ key, channel, order }`. `channel` is a lowercased Kick slug,
 * or `''` for a favorite that follows you everywhere. Order is explicit and
 * per scope, because "frequently used" ranks nothing on Kick and alphabetical
 * is not how anyone reaches for an emote.
 *
 * The emote's own data is not duplicated here — the library already holds a
 * full snapshot per key, so a favorite still renders when its set is not
 * loaded. That is the property that matters, and it costs nothing extra.
 */
const FAVORITES_PER_SCOPE_LIMIT = 60;

function favoriteScope(channel) {
  const slug = String(channel ?? '').trim().toLowerCase();
  return /^[a-z0-9_][a-z0-9_-]{0,63}$/.test(slug) ? slug : '';
}

function cleanStickerFavorites(input, legacyPinned, hiddenSet) {
  const entries = [];
  const seen = new Set();
  const add = (key, channel, order) => {
    const scope = favoriteScope(channel);
    const id = `${scope}\u0000${key}`;
    if (!key || hiddenSet.has(key) || seen.has(id)) return;
    seen.add(id);
    entries.push({ key, channel: scope, order: Number.isFinite(order) ? order : entries.length });
  };

  if (Array.isArray(input)) {
    for (const raw of input) {
      if (!isRecord(raw)) continue;
      const key = cleanStickerKeys([raw.key], 1)[0];
      add(key, raw.channel, Number(raw.order));
    }
  } else {
    // Schema 4 and earlier stored a flat `pinned` array with no scope and no
    // explicit order. Position in that array *was* the order, so it carries
    // over as a global favorite and nothing is lost.
    for (const key of cleanStickerKeys(legacyPinned)) add(key, '', entries.length);
  }

  // Renumber densely per scope so an imported file cannot smuggle sparse or
  // colliding orders past the reorder controls.
  const byScope = new Map();
  for (const entry of entries) {
    const list = byScope.get(entry.channel) || [];
    list.push(entry);
    byScope.set(entry.channel, list);
  }
  const cleaned = [];
  for (const [, list] of byScope) {
    list.sort((left, right) => left.order - right.order);
    list.slice(0, FAVORITES_PER_SCOPE_LIMIT).forEach((entry, index) => {
      cleaned.push({ key: entry.key, channel: entry.channel, order: index });
    });
  }
  return cleaned;
}

/**
 * The keys to show on a channel, in order: that channel's own favorites first,
 * then the global ones it has not already overridden.
 */
function favoritesForChannel(favorites, channel) {
  const list = Array.isArray(favorites) ? favorites : [];
  const scope = favoriteScope(channel);
  const ordered = (wanted) => list
    .filter((entry) => entry.channel === wanted)
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.key);
  const scoped = scope ? ordered(scope) : [];
  const seen = new Set(scoped);
  return [...scoped, ...ordered('').filter((key) => !seen.has(key))];
}

function isStickerFavorite(favorites, key, channel) {
  return favoritesForChannel(favorites, channel).includes(key);
}

/** Add or remove one favorite in one scope, leaving every other scope alone. */
function toggleStickerFavorite(favorites, key, channel) {
  const list = Array.isArray(favorites) ? favorites : [];
  const scope = favoriteScope(channel);
  const present = list.some((entry) => entry.key === key && entry.channel === scope);
  if (present) {
    return renumberFavorites(list.filter((entry) => !(entry.key === key && entry.channel === scope)));
  }
  const inScope = list.filter((entry) => entry.channel === scope).length;
  if (inScope >= FAVORITES_PER_SCOPE_LIMIT) return renumberFavorites(list);
  return renumberFavorites([...list, { key, channel: scope, order: inScope }]);
}

/** Move a favorite within its own scope. `delta` is -1 for earlier, +1 for later. */
function moveStickerFavorite(favorites, key, channel, delta) {
  const list = Array.isArray(favorites) ? favorites : [];
  const scope = favoriteScope(channel);
  const inScope = list
    .filter((entry) => entry.channel === scope)
    .sort((left, right) => left.order - right.order);
  const index = inScope.findIndex((entry) => entry.key === key);
  const target = index + (Number(delta) < 0 ? -1 : 1);
  if (index < 0 || target < 0 || target >= inScope.length) return renumberFavorites(list);
  const reordered = [...inScope];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const rest = list.filter((entry) => entry.channel !== scope);
  return renumberFavorites([...rest, ...reordered.map((entry, order) => ({ ...entry, order }))]);
}

function renumberFavorites(list) {
  return cleanStickerFavorites(list, [], new Set());
}

function normalizeStickerPreferences(input) {
  const source = isRecord(input) ? input : {};
  const hidden = cleanStickerKeys(source.hidden);
  const hiddenSet = new Set(hidden);
  const groups = cleanStickerGroups(source.groups);
  const groupIds = new Set(groups.map((group) => group.id));
  const activeGroup = groupIds.has(source.activeGroup) ? source.activeGroup : '';
  const view = enumValue(source.view, ['all', 'pinned', 'native', 'group'], 'all');
  const favorites = cleanStickerFavorites(source.favorites, source.pinned, hiddenSet);
  const assignments = cleanStickerAssignments(source.assignments, groupIds);
  // Favorited or assigned emotes are protected from eviction: the user filed them.
  const protectedKeys = new Set([
    ...favorites.map((favorite) => favorite.key),
    ...assignments.map((assignment) => assignment.key),
  ]);
  const library = evictStickerLibrary(
    cleanStickerLibrary(source.library, hiddenSet),
    STICKER_LIBRARY_LIMIT,
    protectedKeys,
  ).library;
  return {
    schema: STICKER_PREFERENCES_SCHEMA,
    favorites,
    hidden,
    view: view === 'group' && !activeGroup ? 'all' : view,
    showHidden: bool(source.showHidden, false),
    activeGroup,
    groups,
    assignments,
    library,
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
// Prototype-pollution keys (CVE-2026-21710 class). Every store that writes an
// untrusted key drops these before the assignment, so a hand-edited import can
// never reach `obj['__proto__'] = …`. Settings sections stay safe by rebuild.
const POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Channel-path list (favorites, not-interested), rebuilt with the writer's bound. */
function normalizeChannelList(input, limit = 200) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of input) {
    const path = normalizeChannelPath(raw);
    if (path && !seen.has(path)) { seen.add(path); out.push(path); }
    if (out.length >= limit) break;
  }
  return out;
}

/** Channel notes: path -> note string, rebuilt with the writer's bounds. */
function normalizeChannelNotes(input, limit = 100) {
  if (!isRecord(input)) return {};
  const out = {};
  let count = 0;
  for (const [rawPath, note] of Object.entries(input)) {
    if (POLLUTION_KEYS.has(rawPath)) continue;
    const path = normalizeChannelPath(rawPath);
    if (!path || typeof note !== 'string') continue;
    out[path] = note.slice(0, 1000);
    if (++count >= limit) break;
  }
  return out;
}

/** Chat keyword filters: path -> keyword[], rebuilt with the writer's bounds. */
function normalizeChatKeywords(input, limit = 100) {
  if (!isRecord(input)) return {};
  const out = {};
  let count = 0;
  for (const [rawPath, list] of Object.entries(input)) {
    if (POLLUTION_KEYS.has(rawPath)) continue;
    const path = normalizeChannelPath(rawPath);
    if (!path || !Array.isArray(list)) continue;
    const words = [...new Set(list
      .filter((word) => typeof word === 'string')
      .map((word) => word.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 48))
      .filter(Boolean))].slice(0, 20);
    if (words.length) out[path] = words;
    if (++count >= limit) break;
  }
  return out;
}

/** Per-channel layout: path -> {focus,theater,chatHidden,sidebarHidden} booleans. */
function normalizeChannelLayouts(input, limit = 50) {
  if (!isRecord(input)) return {};
  const out = {};
  let count = 0;
  for (const [rawPath, layout] of Object.entries(input)) {
    if (POLLUTION_KEYS.has(rawPath)) continue;
    const path = normalizeChannelPath(rawPath);
    if (!path || !isRecord(layout)) continue;
    out[path] = {
      focus: bool(layout.focus, false),
      theater: bool(layout.theater, false),
      chatHidden: bool(layout.chatHidden, false),
      sidebarHidden: bool(layout.sidebarHidden, false),
    };
    if (++count >= limit) break;
  }
  return out;
}

/** Volume/quality memory: "kind:path" -> primitive, rebuilt with the writer's bound. */
function normalizeMediaPreferences(input, limit = 240) {
  if (!isRecord(input)) return {};
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(input)) {
    if (POLLUTION_KEYS.has(key)) continue;
    if (!/^[a-z]+:.+/.test(key) || key.length > 200) continue;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
    out[key] = value;
    if (++count >= limit) break;
  }
  return out;
}

/**
 * Assemble the settings export payload from every backup store. Settings are
 * spread at the root (schema/section keys); the rest are nested under their
 * registered field. One shaper so the export and its coverage test cannot drift.
 */
function buildSettingsExport(sources) {
  const source = isRecord(sources) ? sources : {};
  return {
    ...(isRecord(source.settings) ? source.settings : {}),
    stickers: source.stickers ?? null,
    usage: source.usage ?? null,
    multistream: source.multistream ?? null,
    channelLayouts: source.channelLayouts ?? {},
    favoriteChannels: Array.isArray(source.favoriteChannels) ? source.favoriteChannels : [],
    dismissedChannels: Array.isArray(source.dismissedChannels) ? source.dismissedChannels : [],
    chatKeywords: source.chatKeywords ?? {},
    channelNotes: source.channelNotes ?? {},
    mediaPreferences: source.mediaPreferences ?? {},
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
  if (parsed.stickers != null && !isRecord(parsed.stickers)) {
    return { ok: false, error: 'The emote library must be a JSON object.' };
  }
  if (parsed.usage != null && !isRecord(parsed.usage)) {
    return { ok: false, error: 'The emote usage counts must be a JSON object.' };
  }
  if (parsed.multistream != null && !isRecord(parsed.multistream)) {
    return { ok: false, error: 'The multi-stream layouts must be a JSON object.' };
  }
  if (parsed.stickers?.schema != null && Number(parsed.stickers.schema) > STICKER_PREFERENCES_SCHEMA) {
    return { ok: false, error: `Emote schema ${parsed.stickers.schema} is newer than this build supports.` };
  }

  const value = normalizeSettings(parsed);
  const stickers = parsed.stickers == null ? null : normalizeStickerPreferences(parsed.stickers);
  const notes = [];
  const sections = ['layout', 'appearance', 'content', 'accessibility', 'shortcuts'];
  const known = new Set(['schema', 'stickers', 'usage', 'multistream', 'channelLayouts',
    'favoriteChannels', 'dismissedChannels', 'chatKeywords', 'channelNotes', 'mediaPreferences']);

  for (const key of Object.keys(parsed)) {
    if (!known.has(key) && !sections.includes(key)) notes.push(`Ignored unknown section "${key}".`);
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
    // Name which library entries were dropped instead of reporting only a count,
    // because an import that silently loses entries undermines the trust the
    // export/import round-trip exists to provide.
    if (Array.isArray(parsed.stickers.library)) {
      // Both sides in one key space: the normalized library carries platform-
      // prefixed keys, the parsed file may still hold the legacy form, and
      // comparing across the two reported every entry as dropped.
      const keptKeys = new Set(stickers.library.map((entry) => entry.key));
      const dropped = parsed.stickers.library
        .filter((entry) => isRecord(entry) && entry.name && entry.key
          && !keptKeys.has(platformStickerKey(String(entry.key).trim())))
        .map((entry) => String(entry.name).slice(0, 80));
      if (dropped.length) {
        const sample = dropped.slice(0, 5).join(', ');
        const suffix = dropped.length > 5 ? ` and ${dropped.length - 5} more` : '';
        notes.push(`${dropped.length} sticker${dropped.length === 1 ? '' : 's'} could not be kept: ${sample}${suffix}.`);
      }
    }
    for (const field of ['favorites', 'hidden', 'groups', 'assignments']) {
      if (Array.isArray(parsed.stickers[field]) && parsed.stickers[field].length !== stickers[field].length) {
        notes.push(`Adjusted emote ${field} to supported entries.`);
      }
    }
    if (parsed.stickers.schema == null || Number(parsed.stickers.schema) < STICKER_PREFERENCES_SCHEMA) {
      notes.push(`Upgraded emotes to schema ${STICKER_PREFERENCES_SCHEMA}.`);
    }
  }

  // Usage counts and saved layouts are user-authored data the export promises
  // to carry, so they are validated and reported like everything else rather
  // than passed through or silently dropped.
  const usage = parsed.usage == null ? null : normalizeEmoteUsage(parsed.usage);
  if (usage) {
    const kept = Object.keys(usage.global).length;
    const offered = isRecord(parsed.usage.global) ? Object.keys(parsed.usage.global).length : 0;
    if (offered !== kept) notes.push(`Adjusted emote usage counts to ${kept} supported entries.`);
  }

  const multistream = parsed.multistream == null ? null : normalizeMultistream(parsed.multistream);
  if (multistream) {
    const offeredStreams = Array.isArray(parsed.multistream.streams) ? parsed.multistream.streams.length : 0;
    if (offeredStreams !== multistream.streams.length) {
      notes.push(`Adjusted the multi-stream grid to ${multistream.streams.length} supported channels.`);
    }
    const offeredLayouts = Array.isArray(parsed.multistream.layouts) ? parsed.multistream.layouts.length : 0;
    if (offeredLayouts !== multistream.layouts.length) {
      notes.push(`Adjusted saved layouts to ${multistream.layouts.length} supported entries.`);
    }
  }

  // The remaining user-authored stores the export carries. Each is rebuilt from
  // scratch with the same bounds its writer enforces, and `null` when absent so
  // the importer only touches what the file actually provided.
  const channelLayouts = parsed.channelLayouts == null ? null : normalizeChannelLayouts(parsed.channelLayouts);
  const favoriteChannels = parsed.favoriteChannels == null ? null : normalizeChannelList(parsed.favoriteChannels);
  const dismissedChannels = parsed.dismissedChannels == null ? null : normalizeChannelList(parsed.dismissedChannels);
  const chatKeywords = parsed.chatKeywords == null ? null : normalizeChatKeywords(parsed.chatKeywords);
  const channelNotes = parsed.channelNotes == null ? null : normalizeChannelNotes(parsed.channelNotes);
  const mediaPreferences = parsed.mediaPreferences == null ? null : normalizeMediaPreferences(parsed.mediaPreferences);

  return {
    ok: true, value, stickers, usage, multistream,
    channelLayouts, favoriteChannels, dismissedChannels, chatKeywords, channelNotes, mediaPreferences,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Emote usage
// ---------------------------------------------------------------------------

/**
 * Kick's "Frequently Used" tab is a 50-entry MRU whose `timeUsed` is hardcoded
 * to 1 and never incremented, so no real frequency ranking exists anywhere on
 * the platform. Competitors count usage only for third-party providers
 * (7TV/BTTV/FFZ), never for Kick's own emotes.
 *
 * Counts are keyed by emote id, not name: names collide across sets and Kick
 * remaps them, while ids are stable. Storage is per channel plus a global
 * rollup, both local-only and exported with the library.
 */
const USAGE_CHANNEL_LIMIT = 400;

/** The global rollup spans every channel, so it is bounded more loosely — but
 *  bounded: it was previously capped only on read and grew without limit on
 *  write, so a long session persisted an ever-larger map. */
const USAGE_GLOBAL_LIMIT = 2000;

/**
 * Rebuild a usage store from untrusted input.
 *
 * Counts travel through the settings export, so an imported file can contain
 * anything. Everything is rebuilt from scratch with bounded shapes rather than
 * merged in, and the per-channel cap is enforced here too so a hand-edited file
 * cannot smuggle an unbounded map past the writer that normally trims it.
 */
function normalizeEmoteUsage(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const cleanScope = (raw, limit = USAGE_CHANNEL_LIMIT) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const entries = [];
    for (const [id, value] of Object.entries(raw)) {
      if (POLLUTION_KEYS.has(id)) continue;
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) continue;
      if (!value || typeof value !== 'object') continue;
      const count = Number(value.count);
      if (!Number.isFinite(count) || count < 0) continue;
      entries.push([id, {
        name: typeof value.name === 'string' ? value.name.slice(0, 80) : '',
        count: Math.min(Math.floor(count), 1_000_000),
        firstAt: Number.isFinite(Number(value.firstAt)) ? Number(value.firstAt) : 0,
        lastAt: Number.isFinite(Number(value.lastAt)) ? Number(value.lastAt) : 0,
      }]);
    }
    entries.sort((a, b) => (b[1].count - a[1].count) || (b[1].lastAt - a[1].lastAt));
    return Object.fromEntries(entries.slice(0, limit));
  };

  const channels = {};
  const rawChannels = source.channels && typeof source.channels === 'object' ? source.channels : {};
  for (const [channel, scope] of Object.entries(rawChannels)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(channel)) continue;
    const cleaned = cleanScope(scope);
    if (Object.keys(cleaned).length) channels[channel] = cleaned;
    if (Object.keys(channels).length >= 200) break;
  }
  return { global: cleanScope(source.global, USAGE_GLOBAL_LIMIT), channels };
}

function recordEmoteUse(counts, { channel, id, name, at = 0 }) {
  if (!id) return counts || { global: {}, channels: {} };
  const next = {
    global: { ...(counts?.global || {}) },
    channels: { ...(counts?.channels || {}) },
  };
  const globalEntry = next.global[id] || { name, count: 0, firstAt: at, lastAt: at };
  next.global[id] = {
    name: name || globalEntry.name,
    count: globalEntry.count + 1,
    firstAt: globalEntry.firstAt || at,
    lastAt: at,
  };
  // The global rollup was capped only on read, so it grew without bound on write.
  next.global = trimUsage(next.global, USAGE_GLOBAL_LIMIT);
  if (channel) {
    const scope = { ...(next.channels[channel] || {}) };
    const entry = scope[id] || { name, count: 0, firstAt: at, lastAt: at };
    scope[id] = { name: name || entry.name, count: entry.count + 1, firstAt: entry.firstAt || at, lastAt: at };
    next.channels[channel] = trimUsage(scope);
  }
  return next;
}

/** Keep a usage map bounded by dropping the least-used entries. */
function trimUsage(scope, limit = USAGE_CHANNEL_LIMIT) {
  const entries = Object.entries(scope);
  if (entries.length <= limit) return scope;
  entries.sort((a, b) => (b[1].count - a[1].count) || (b[1].lastAt - a[1].lastAt));
  return Object.fromEntries(entries.slice(0, limit));
}

/**
 * Rank emotes by real usage. `channel` scopes to one chat and falls back to the
 * global rollup for anything never used there, so a shelf is useful the first
 * time a channel is opened rather than empty.
 */
function rankEmoteUsage(counts, { channel = '', limit = 24 } = {}) {
  const scope = (channel && counts?.channels?.[channel]) || {};
  const global = counts?.global || {};
  const merged = new Map();
  for (const [id, entry] of Object.entries(global)) {
    merged.set(id, { id, name: entry.name, count: 0, globalCount: entry.count, lastAt: entry.lastAt || 0 });
  }
  for (const [id, entry] of Object.entries(scope)) {
    const current = merged.get(id) || { id, name: entry.name, count: 0, globalCount: 0, lastAt: 0 };
    merged.set(id, { ...current, name: entry.name || current.name, count: entry.count, lastAt: entry.lastAt || current.lastAt });
  }
  return [...merged.values()]
    .sort((a, b) => (b.count - a.count) || (b.globalCount - a.globalCount) || (b.lastAt - a.lastAt))
    .slice(0, limit);
}

/**
 * Emotes ordered by how recently they were sent, newest first.
 *
 * The companion to `rankEmoteUsage`, not a replacement: frequency answers "what
 * do I use", recency answers "what am I using right now", and a shelf built on
 * frequency alone takes weeks to notice that a channel's meta moved on. Same
 * scoping rule as the frequency ranking — the channel's own record wins, and
 * falls back to the global rollup for an emote never sent here.
 *
 * Presentational only. This orders emotes the user already sent by hand; it
 * neither records a use nor sends anything, which is the line that separates a
 * recency shelf from the hold-to-spam, turbo and pyramid features other clients
 * pair it with and this build does not have.
 */
function recentEmoteUsage(counts, { channel = '', limit = 24 } = {}) {
  const scope = (channel && counts?.channels?.[channel]) || {};
  const global = counts?.global || {};
  const merged = new Map();
  for (const [id, entry] of Object.entries(global)) {
    merged.set(id, { id, name: entry.name || '', count: Number(entry.count) || 0, lastAt: Number(entry.lastAt) || 0 });
  }
  for (const [id, entry] of Object.entries(scope)) {
    const current = merged.get(id);
    merged.set(id, {
      id,
      name: entry.name || current?.name || '',
      count: Number(entry.count) || 0,
      lastAt: Number(entry.lastAt) || current?.lastAt || 0,
    });
  }
  return [...merged.values()]
    // An entry with no timestamp is one an import carried without one; it has
    // no place in a list whose whole ordering is the timestamp.
    .filter((entry) => entry.lastAt > 0)
    .sort((a, b) => (b.lastAt - a.lastAt) || (b.count - a.count) || String(a.id).localeCompare(String(b.id)))
    .slice(0, Math.max(0, Math.floor(Number(limit)) || 0));
}

/** How many tiles the organizer grid renders at once, regardless of library size. */
const EMOTE_WINDOW_SIZE = 240;

/**
 * The slice of a long list worth putting in the DOM, and how much is outside it.
 *
 * Not virtualization: the caller renders `items` plus one spacer above and one
 * below, sized from `before` and `after`, so the scrollbar stays honest and the
 * browser keeps doing the scrolling. A library at the 2400 cap therefore costs
 * one window of nodes rather than 2400, and the arithmetic that decides which
 * window lives here where it can be tested without a browser.
 */
function visibleWindow(entries, anchor = 0, size = EMOTE_WINDOW_SIZE) {
  const list = Array.isArray(entries) ? entries : [];
  const count = Math.max(1, Math.floor(Number(size)) || EMOTE_WINDOW_SIZE);
  if (list.length <= count) return { start: 0, end: list.length, items: list, before: 0, after: 0 };
  // Lead margin: start the window a little above the anchor so scrolling back a
  // row does not immediately fall out of it and force a rebuild.
  const lead = Math.floor(count / 4);
  const requested = Math.floor(Number(anchor)) || 0;
  const start = Math.min(Math.max(0, requested - lead), list.length - count);
  const end = start + count;
  return { start, end, items: list.slice(start, end), before: start, after: list.length - end };
}

/** Emotes the user owns but has never sent — the inverse view nothing offers. */
function unusedEmotes(counts, emotes, { channel = '' } = {}) {
  const used = new Set([
    ...Object.keys(counts?.global || {}),
    ...Object.keys((channel && counts?.channels?.[channel]) || {}),
  ]);
  return (emotes || []).filter((emote) => !used.has(String(emote.id)));
}

// ---------------------------------------------------------------------------
// Multi-stream
// ---------------------------------------------------------------------------

const MULTISTREAM_SCHEMA = 1;
/**
 * Nine tiles is a hard ceiling, not a preference. Each tile is a real Kick
 * player: an independent HLS decode plus its own socket. Past a 3×3 the grid
 * stops being watchable and starts being a way to melt a laptop, so the limit
 * is enforced in the data rather than suggested in the interface.
 */
const MULTISTREAM_MAX = 9;
const MULTISTREAM_LAYOUT_LIMIT = 24;

/** Column count per tile count, chosen so the last row is never a lone tile. */
function multistreamColumns(count) {
  const total = Number(count) || 0;
  if (total <= 1) return 1;
  if (total <= 4) return 2;
  if (total <= 6) return 3;
  return 3;
}

function cleanSlugList(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const slugs = [];
  for (const raw of input) {
    const slug = typeof raw === 'string' ? raw.trim() : '';
    if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(slug)) continue;
    const key = slug.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    slugs.push(slug);
    if (slugs.length >= MULTISTREAM_MAX) break;
  }
  return slugs;
}

/**
 * Layout links.
 *
 * Path-style grid URLs are the field's de facto sharing format, but this
 * project runs on kick.com and cannot claim a path there — so the layout rides
 * on a query parameter Kick ignores and Kick Focus reads on boot.
 *
 * The link carries slugs and nothing else: no settings, no identifiers, and no
 * state from the sender's machine. Every slug is revalidated on the way in,
 * because a link is untrusted input no matter who sent it.
 */
const MULTISTREAM_LINK_PARAM = 'kf-multi';

function multistreamLayoutLink(streams, origin = 'https://kick.com') {
  const slugs = cleanSlugList(streams);
  if (!slugs.length) return '';
  return `${origin}/?${MULTISTREAM_LINK_PARAM}=${encodeURIComponent(slugs.join(','))}`;
}

/**
 * Read a layout out of a URL. Returns [] for anything unusable, so a malformed
 * or hostile link opens nothing rather than opening something unexpected.
 */
function parseMultistreamLink(href) {
  let value = '';
  try {
    value = new URL(String(href), 'https://kick.com').searchParams.get(MULTISTREAM_LINK_PARAM) || '';
  } catch {
    return [];
  }
  if (!value || value.length > 1024) return [];
  return cleanSlugList(value.split(','));
}

/** How long a tab's roll-call answer is trusted before it is treated as gone. */
const PRESENCE_TTL_MS = 30_000;

/**
 * Fold roll-call answers into the set of channels open in other tabs.
 *
 * Every answer carries the tab's own timestamp, so an entry expires on its own
 * rather than needing a goodbye message — a tab that is closed, crashed, or
 * simply asleep stops appearing without anything having to notice it left.
 * Slugs are validated exactly as the grid validates them, because an answer
 * arrives over a channel any script on the origin can post to.
 */
/**
 * Path segments Kick uses for its own surfaces. A discovery card links to a
 * channel, but the same markup wraps category tiles and section links, and
 * "browse" is not a channel no matter how channel-shaped the path looks.
 */
const NON_CHANNEL_SEGMENTS = new Set([
  'about', 'api', 'browse', 'categories', 'category', 'clips', 'dashboard', 'drops', 'following',
  'help', 'legal', 'messages', 'popout', 'privacy', 'profile', 'search', 'settings', 'shop',
  'store', 'subscriptions', 'support', 'terms', 'user', 'video', 'videos', 'wallet',
]);

/**
 * The channel a discovery card points at, or '' if it points at anything else.
 *
 * Accepts what a card's `href` actually yields — a path, a path with a query or
 * hash, or a full URL — and refuses a host that is not Kick's, because the
 * return value feeds a grid of embedded players.
 */
function cardSlugFromPath(path) {
  const raw = String(path ?? '').trim();
  if (!raw) return '';
  let rest = raw;
  const absolute = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(raw);
  if (absolute) {
    if (!/(^|\.)kick\.com$/i.test(absolute[1])) return '';
    rest = absolute[2] || '';
  }
  const [first] = rest.split(/[?#]/)[0].split('/').filter(Boolean);
  if (!first || NON_CHANNEL_SEGMENTS.has(first.toLowerCase())) return '';
  return /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(first) ? first : '';
}

function mergePresence(entries, now = 0) {
  const seen = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!isRecord(entry)) continue;
    const slug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
    const ts = Number(entry.ts);
    if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(slug)) continue;
    if (!Number.isFinite(ts) || now - ts > PRESENCE_TTL_MS || ts > now + PRESENCE_TTL_MS) continue;
    const key = slug.toLowerCase();
    // The freshest answer for a slug wins, so two tabs on the same channel
    // count once and the newer timestamp is the one that expires it.
    const prior = seen.get(key);
    if (!prior || ts > prior.ts) seen.set(key, { slug, ts });
  }
  return [...seen.values()].sort((a, b) => a.slug.localeCompare(b.slug)).map((entry) => entry.slug);
}

/**
 * Which of the present channels are worth offering, given what the grid holds.
 * Returns the slugs not already in the grid, capped at the remaining room.
 */
function presenceOffer(present, streams, max = MULTISTREAM_MAX) {
  const have = new Set((Array.isArray(streams) ? streams : []).map((slug) => String(slug).toLowerCase()));
  const room = Math.max(0, max - have.size);
  return (Array.isArray(present) ? present : [])
    .filter((slug) => !have.has(String(slug).toLowerCase()))
    .slice(0, room);
}

function normalizeMultistream(input) {
  const source = isRecord(input) ? input : {};
  const streams = cleanSlugList(source.streams);
  const focusCandidate = typeof source.focus === 'string' ? source.focus : '';
  // Audio follows focus, and focus must name a stream that is actually present
  // or the grid ends up silent with no obvious way to fix it.
  const focus = streams.some((slug) => slug.toLowerCase() === focusCandidate.toLowerCase())
    ? streams.find((slug) => slug.toLowerCase() === focusCandidate.toLowerCase())
    : (streams[0] || '');

  const layouts = [];
  if (Array.isArray(source.layouts)) {
    const names = new Set();
    for (const raw of source.layouts) {
      if (!isRecord(raw)) continue;
      const name = String(raw.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const saved = cleanSlugList(raw.streams);
      if (!name || !saved.length || names.has(name.toLowerCase())) continue;
      names.add(name.toLowerCase());
      layouts.push({ name, streams: saved });
      if (layouts.length >= MULTISTREAM_LAYOUT_LIMIT) break;
    }
  }

  return {
    schema: MULTISTREAM_SCHEMA,
    streams,
    focus,
    chat: streams.some((slug) => slug.toLowerCase() === String(source.chat ?? '').toLowerCase())
      ? streams.find((slug) => slug.toLowerCase() === String(source.chat).toLowerCase())
      : focus,
    showChat: typeof source.showChat === 'boolean' ? source.showChat : true,
    // Nine autoplaying tiles with no way to stop them is a WCAG 2.2.2 failure,
    // and the focused tile's audio is a 1.4.2 failure. These two flags back the
    // pause-all and mute-all controls. `muted` is deliberately separate from
    // `focus`: silencing the grid must not also move the chat panel.
    paused: typeof source.paused === 'boolean' ? source.paused : false,
    muted: typeof source.muted === 'boolean' ? source.muted : false,
    layouts,
  };
}

/**
 * Merge a multi-stream write across tabs without a lost update.
 *
 * A blind `gmSet(state.multistream)` clobbers whatever another tab added since
 * this tab booted. Instead, membership is taken from what is *stored* (the most
 * recent write from any tab), minus this operation's `removed`, plus its
 * `added` — so two tabs adding different channels both survive. Order follows
 * this tab's own arrangement, then its additions, then any stored channels it
 * has not seen yet; focus/chat/pause/mute stay this tab's presentation choice;
 * layouts are a name-keyed union with stored winning a conflict.
 */
function mergeMultistream(stored, current, added = [], removed = []) {
  const base = normalizeMultistream(stored);
  const view = normalizeMultistream(current);
  const lower = (slug) => String(slug).toLowerCase();
  const removeSet = new Set((Array.isArray(removed) ? removed : []).filter((slug) => typeof slug === 'string').map(lower));
  const addList = (Array.isArray(added) ? added : []).filter((slug) => typeof slug === 'string');
  const allowed = new Map();
  for (const slug of [...base.streams, ...addList]) {
    const key = lower(slug);
    if (removeSet.has(key) || allowed.has(key)) continue;
    allowed.set(key, slug);
  }
  const streams = [];
  const placed = new Set();
  for (const slug of [...view.streams, ...addList, ...base.streams]) {
    const key = lower(slug);
    if (!allowed.has(key) || placed.has(key)) continue;
    placed.add(key);
    streams.push(allowed.get(key));
  }
  const layouts = [...base.layouts];
  const names = new Set(base.layouts.map((layout) => layout.name.toLowerCase()));
  for (const layout of view.layouts) {
    if (names.has(layout.name.toLowerCase())) continue;
    names.add(layout.name.toLowerCase());
    layouts.push(layout);
  }
  return normalizeMultistream({
    ...base,
    streams,
    layouts,
    focus: view.focus,
    chat: view.chat,
    showChat: view.showChat,
    paused: view.paused,
    muted: view.muted,
  });
}

/**
 * Should a tile carry audio?
 *
 * Exactly one tile ever does, and only when the grid is neither paused nor
 * muted — so this is the single place the "one unmuted tile" invariant lives.
 */
function multistreamTileMuted(value, slug) {
  const state = value || {};
  if (state.paused || state.muted) return true;
  return slug !== state.focus;
}

/**
 * Should this tile have a player document loaded at all?
 *
 * A cross-origin embed cannot be paused, quality-capped, or inspected from
 * here — `player.kick.com` is a different origin from `kick.com`, it accepts no
 * quality parameter, and its internals are unreachable. Dropping the document
 * is therefore the only lever available over decode cost, and it is a real one:
 * an unloaded tile decodes nothing.
 *
 * The focused tile is never suspended. It is the one carrying audio, and
 * silencing what someone is actively listening to because they scrolled or
 * switched tabs would be worse than the CPU it saves.
 */
function multistreamTileActive(value, slug, suspended) {
  const state = value || {};
  if (state.paused) return false;
  if (slug === state.focus) return true;
  const set = suspended instanceof Set ? suspended : new Set(suspended || []);
  return !set.has(slug);
}

/**
 * Decide which tiles to keep, build, and drop for a render.
 *
 * Replacing an `<iframe>` restarts its stream, so a tile that is still wanted
 * must be reused rather than recreated — adding a tenth channel must not
 * interrupt the nine already playing. Keeping that decision here makes the
 * invariant testable without a browser; the DOM layer only carries it out.
 */
function planMultistreamTiles(existing, wanted) {
  const present = new Set((existing instanceof Set ? [...existing] : (Array.isArray(existing) ? existing : [])));
  const order = Array.isArray(wanted) ? wanted : [];
  const reuse = [];
  const create = [];
  const seen = new Set();
  for (const slug of order) {
    if (typeof slug !== 'string' || !slug || seen.has(slug)) continue;
    seen.add(slug);
    if (present.has(slug)) reuse.push(slug);
    else create.push(slug);
  }
  return {
    order: [...seen],
    reuse,
    create,
    // Anything present but no longer wanted. A tile that is still wanted must
    // never appear here, or the render would tear down a playing stream.
    remove: [...present].filter((slug) => !seen.has(slug)),
  };
}

/**
 * Add a channel, reporting *why* nothing happened rather than failing silently
 * — "I clicked add and nothing appeared" is the whole failure mode here.
 */
function addMultistreamChannel(value, slug) {
  const state = normalizeMultistream(value);
  const cleaned = typeof slug === 'string' ? slug.trim() : '';
  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(cleaned)) {
    return { ok: false, error: 'That is not a Kick channel name.', value: state };
  }
  if (state.streams.some((entry) => entry.toLowerCase() === cleaned.toLowerCase())) {
    return { ok: false, error: `${cleaned} is already in the grid.`, value: state };
  }
  if (state.streams.length >= MULTISTREAM_MAX) {
    return { ok: false, error: `The grid holds ${MULTISTREAM_MAX} streams. Remove one first.`, value: state };
  }
  const streams = [...state.streams, cleaned];
  return { ok: true, value: normalizeMultistream({ ...state, streams, focus: state.focus || cleaned }) };
}

function removeMultistreamChannel(value, slug) {
  const state = normalizeMultistream(value);
  const streams = state.streams.filter((entry) => entry.toLowerCase() !== String(slug).toLowerCase());
  // Focus and chat fall through to normalizeMultistream, which re-points them
  // at a surviving stream rather than leaving the grid muted and chatless.
  return normalizeMultistream({ ...state, streams });
}

function saveMultistreamLayout(value, name) {
  const state = normalizeMultistream(value);
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!clean) return { ok: false, error: 'Name this layout first.', value: state };
  if (!state.streams.length) return { ok: false, error: 'Add at least one stream before saving.', value: state };
  const layouts = [
    { name: clean, streams: state.streams },
    ...state.layouts.filter((layout) => layout.name.toLowerCase() !== clean.toLowerCase()),
  ];
  return { ok: true, value: normalizeMultistream({ ...state, layouts }) };
}

// ---------------------------------------------------------------------------
// Player loading
// ---------------------------------------------------------------------------

/**
 * The advertising preflight scripts Kick waits on before it will request
 * playback.
 *
 * This matters most to a build like this one: `imasdk.googleapis.com` is in our
 * own AD_HOSTS, so blocking PAL is exactly what makes Kick sit through the full
 * preflight timeout before the stream starts. The block is correct; the wait is
 * an artifact of it.
 *
 * Same-origin `/om/omweb-v1.js` is included because other content blockers stop
 * it even though this build does not.
 *
 * Approach adapted from KickCX/KickFixPlayerLoading (MIT).
 */
const AD_PREFLIGHT_SCRIPTS = Object.freeze([
  { hostname: 'imasdk.googleapis.com', pathname: '/pal/sdkloader/pal.js' },
  { hostname: 'platform.datazoom.io', pathname: '/beacon/v1/config' },
  { sameOrigin: true, pathname: '/om/omweb-v1.js' },
]);

function isAdPreflightScript(rawUrl, pageOrigin = 'https://kick.com') {
  if (typeof rawUrl !== 'string' || !rawUrl) return false;
  let url;
  try {
    url = new URL(rawUrl, pageOrigin);
  } catch {
    return false;
  }
  return AD_PREFLIGHT_SCRIPTS.some((entry) => entry.sameOrigin
    ? url.origin === pageOrigin && url.pathname === entry.pathname
    : url.hostname === entry.hostname && url.pathname === entry.pathname);
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
/**
 * Every persistent store the mod owns, in one place, so export coverage,
 * factory reset, and the diagnostics labels cannot drift apart.
 *
 * - `key`    the localStorage / GM key
 * - `label`  the user-facing name (feeds STORAGE_LABELS)
 * - `backup` carried by the settings export/import round-trip
 * - `field`  the export-payload key ('settings' is spread at the root)
 * - `reset`  cleared by "Reset all settings" (a full factory reset)
 *
 * The emote library is deliberately `backup:true, reset:false`: it is the only
 * irreplaceable store (first-seen provenance cannot be regenerated), so a reset
 * keeps it — disclosure is not an acceptable substitute for destroying it.
 */
const STORAGE_STORES = Object.freeze([
  { key: 'kick-focus:settings', label: 'settings', backup: true, field: 'settings', reset: true },
  { key: 'kick-focus:sticker-preferences', label: 'emote library', backup: true, field: 'stickers', reset: false },
  { key: 'kick-focus:emote-usage', label: 'emote usage counts', backup: true, field: 'usage', reset: true },
  { key: 'kick-focus:multistream', label: 'multi-stream layouts', backup: true, field: 'multistream', reset: true },
  { key: 'kick-focus:channel-layouts', label: 'per-channel layout', backup: true, field: 'channelLayouts', reset: true },
  { key: 'kick-focus:favorite-channels', label: 'favorite channels', backup: true, field: 'favoriteChannels', reset: true },
  { key: 'kick-focus:not-interested-channels', label: 'not-interested channels', backup: true, field: 'dismissedChannels', reset: true },
  { key: 'kick-focus:chat-keywords', label: 'chat keyword filters', backup: true, field: 'chatKeywords', reset: true },
  { key: 'kick-focus:channel-notes', label: 'channel notes', backup: true, field: 'channelNotes', reset: true },
  { key: 'kick-focus:media-preferences', label: 'volume and quality memory', backup: true, field: 'mediaPreferences', reset: true },
  { key: 'kick-focus:remote-blocklist', label: 'blocklist cache', backup: false, reset: false },
  { key: 'kick-focus:watched-this-session', label: 'watched this session', backup: false, reset: false },
]);

const STORAGE_LABELS = Object.fromEntries(STORAGE_STORES.map((store) => [store.key, store.label]));

/**
 * How much of the origin's storage one multi-store write may claim.
 *
 * Chromium gives localStorage 10 MB per origin, counted in UTF-16 code units,
 * and Kick itself is a tenant of the same budget. The real hazard is not the
 * ceiling but what happens at it: `kCommitErrorThreshold` is 8, and after eight
 * consecutive commit failures Chromium **deletes the whole origin's storage** —
 * so a run of failing writes does not degrade, it wipes. Sizing a multi-key
 * write before any of it is attempted is what keeps a too-large import from
 * spending those attempts.
 */
const STORAGE_BUDGET_BYTES = 4 * 1024 * 1024;

/**
 * Serialize every store of a multi-key write up front and total its size.
 *
 * The import path used to write nine stores in sequence, so a quota failure on
 * the fourth left a configuration that was half the imported file and half the
 * previous one, with no record of where the seam was. Nothing is written until
 * the whole set is known to serialize and to fit.
 *
 * Returns `{ ok, staged, bytes }`, or `ok:false` with a `reason` of
 * 'unserializable' (naming the `key`) or 'over-budget'. `staged` is empty on
 * failure — there is no partial plan to accidentally commit.
 */
function planStorageCommit(entries, budgetBytes = STORAGE_BUDGET_BYTES) {
  if (!Array.isArray(entries)) return { ok: false, reason: 'unserializable', key: '', staged: [], bytes: 0 };
  const staged = [];
  let bytes = 0;
  for (const entry of entries) {
    const [key, value] = Array.isArray(entry) ? entry : [];
    if (typeof key !== 'string' || !key) return { ok: false, reason: 'unserializable', key: String(key), staged: [], bytes: 0 };
    let serialized;
    try {
      serialized = JSON.stringify(value);
    } catch {
      // A cycle or a BigInt throws here rather than at write time, where half
      // the stores would already be committed.
      return { ok: false, reason: 'unserializable', key, staged: [], bytes: 0 };
    }
    if (serialized === undefined) return { ok: false, reason: 'unserializable', key, staged: [], bytes: 0 };
    bytes += key.length + serialized.length;
    staged.push([key, value]);
  }
  if (bytes > budgetBytes) return { ok: false, reason: 'over-budget', key: '', staged: [], bytes, budgetBytes };
  return { ok: true, reason: '', key: '', staged, bytes, budgetBytes };
}

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
 * Kick's own API surface, as pure data handling.
 *
 * Everything here is a URL builder, a normaliser, or a join. Nothing in this
 * file performs a request, touches the DOM, or holds state, so all of it is
 * unit-tested against payload shapes captured from the live site on 2026-08-15.
 *
 * Boundaries this module holds to, deliberately:
 *   - Request-free. This module only builds URLs and normalizes data. Runtime
 *     owns the single deliberate Follow mutation used by click-to-save.
 *   - Same-origin, inheriting whatever session the page already has. Nothing
 *     handles, stores or forwards a credential.
 *   - Only endpoints Kick's own client already calls from the page.
 *   - Every normaliser tolerates a changed shape and reports it, because the
 *     one thing certain about an internal API is that it will change.
 */

const KICK_ORIGIN = 'https://kick.com';
const KICK_WEB_ORIGIN = 'https://web.kick.com';

/** Emote images are content-addressed by id; the size suffix is Kick's own. */
function emoteImageUrl(id, size = 'fullsize') {
  return `https://files.kick.com/emotes/${encodeURIComponent(String(id))}/${size}`;
}

const endpoints = {
  channel: (slug) => `${KICK_ORIGIN}/api/v2/channels/${encodeURIComponent(slug)}`,
  followChannel: (slug) => `${KICK_ORIGIN}/api/v2/channels/${encodeURIComponent(slug)}/follow`,
  emoteSets: (slug) => `${KICK_ORIGIN}/emotes/${encodeURIComponent(slug)}`,
  chatSettings: (channelId) => `${KICK_WEB_ORIGIN}/api/v1/channels/${encodeURIComponent(channelId)}/chat/settings`,
  chatHistory: (chatroomId) => `${KICK_WEB_ORIGIN}/api/v1/chat/${encodeURIComponent(chatroomId)}/history`,
  collectibles: () => `${KICK_WEB_ORIGIN}/api/v1/gamification/collectibles`,
  /**
   * One request for the live state of many channels, instead of N per-channel
   * polls. Kick's own sidebar uses it.
   */
  currentViewers: (ids) => {
    const query = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
      .map((id) => `ids[]=${encodeURIComponent(id)}`)
      .join('&');
    return `${KICK_ORIGIN}/current-viewers?${query}`;
  },
  /**
   * The realtime *broker*, not a realtime connection. It answers with whichever
   * provider is currently in force. See `normalizeRealtimeConnection`.
   */
  realtimeChat: (chatroomId, clientId) =>
    `${KICK_WEB_ORIGIN}/api/v1/realtime/chat/${encodeURIComponent(chatroomId)}/client/${encodeURIComponent(clientId)}/connection`,
};

/**
 * Kick's own embeddable surfaces, verified frameable on 2026-08-15 (200, and
 * neither sends X-Frame-Options nor a frame-ancestors CSP).
 *
 * These are Kick's real player and chat, not a reimplementation: playback,
 * subscriptions, and entitlements all stay Kick's, which is what keeps a
 * multi-stream grid from becoming a workaround for anything.
 */
function playerEmbedUrl(slug, { muted = true, autoplay = true } = {}) {
  const params = new URLSearchParams({ muted: String(muted), autoplay: String(autoplay) });
  return `https://player.kick.com/${encodeURIComponent(slug)}?${params}`;
}

function chatEmbedUrl(slug) {
  return `${KICK_ORIGIN}/popout/${encodeURIComponent(slug)}/chat`;
}

/** Kick channel slugs: what the site itself accepts in a path segment. */
function isValidSlug(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(value);
}

/**
 * Accept whatever a person is most likely to paste: a bare name, a kick.com
 * URL, a URL with query or trailing path, or a name with stray whitespace.
 */
function parseChannelInput(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  let candidate = text;
  if (/^https?:\/\//i.test(text) || /^(?:www\.)?kick\.com\//i.test(text)) {
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      if (!/(^|\.)kick\.com$/i.test(url.hostname)) return '';
      candidate = url.pathname.replace(/^\//, '').split('/')[0];
    } catch {
      return '';
    }
  }
  candidate = candidate.replace(/^@/, '').split(/[?#/]/)[0];
  return isValidSlug(candidate) ? candidate : '';
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

/** Pusher's documented client handshake. The key never appears in our source. */
function pusherSocketUrl({ appKey, cluster }, version = '8.6.0') {
  return `wss://ws-${cluster}.pusher.com/app/${appKey}?protocol=7&client=js&version=${version}&flash=false`;
}

/**
 * Kick's own gateway, which speaks the same wire protocol as the hosted Pusher
 * path — same `pusher:subscribe` frames, same `chatrooms.{id}.v2` channel
 * names, same `App\Events\ChatMessageEvent` payloads. Only the handshake
 * differs: a token instead of an app key and cluster.
 *
 * Never contacted from this project. It is registered so a forced migration is
 * an added URL builder rather than a rewrite, and it is marked unverified so
 * nothing claims it works until a live run says so.
 */
function kickGatewaySocketUrl({ token }) {
  return `wss://websockets.kick.com/viewer/v1/connect?token=${encodeURIComponent(token)}`;
}

/**
 * One entry per realtime provider Kick's broker can name.
 *
 * The split that matters: `socketUrl` and `credentials` are the *transport* and
 * differ per provider, while the frame protocol below is shared because Kick's
 * own gateway reuses Pusher's wire format. Adding a provider is one entry here,
 * not a change to frame parsing or subscription management.
 */
const REALTIME_TRANSPORTS = Object.freeze({
  PUSHER: Object.freeze({
    id: 'PUSHER',
    label: 'Pusher',
    // Verified by anonymous handshake against the live service on 2026-08-15.
    verified: true,
    credentials(entry) {
      const appKey = entry?.credentials?.app_key;
      const cluster = entry?.credentials?.cluster;
      if (typeof appKey !== 'string' || !appKey) return null;
      if (typeof cluster !== 'string' || !cluster) return null;
      return { appKey, cluster };
    },
    socketUrl: pusherSocketUrl,
  }),
  KICK: Object.freeze({
    id: 'KICK',
    label: 'Kick gateway',
    // Never reached from this project. See "Realtime transport" in README.
    verified: false,
    credentials(entry) {
      const token = entry?.credentials?.token || entry?.credentials?.auth_token;
      if (typeof token !== 'string' || !token) return null;
      return { token };
    },
    socketUrl: kickGatewaySocketUrl,
  }),
});

const SUPPORTED_REALTIME_PROVIDERS = Object.freeze(Object.keys(REALTIME_TRANSPORTS));

function realtimeTransport(provider) {
  return REALTIME_TRANSPORTS[String(provider || '').toUpperCase()] || null;
}

/**
 * Read the broker's answer without assuming Pusher.
 *
 * The response carries an array of connections behind a `provider`
 * discriminator, and Kick's client tracks a `degraded` connection state — a
 * multi-provider failover abstraction it can flip server-side. A build that
 * hardcodes the Pusher app key keeps working right up until it silently does
 * not, so an unrecognised provider must degrade to the DOM path rather than
 * throw or guess.
 *
 * A verified provider is preferred over an unverified one when the broker
 * offers both, so a migration only takes effect once Kick stops offering the
 * path this project has actually run against.
 */
function normalizeRealtimeConnection(payload) {
  const connections = payload?.data?.connections;
  if (!Array.isArray(connections) || connections.length === 0) {
    return { ok: false, reason: 'no-connections' };
  }
  const known = connections
    .map((entry) => ({ entry, transport: realtimeTransport(entry?.provider) }))
    .filter((candidate) => candidate.transport);
  if (!known.length) {
    const offered = connections.map((entry) => String(entry?.provider || 'unknown'));
    return { ok: false, reason: 'unsupported-provider', offered };
  }
  const chosen = known.find((candidate) => candidate.transport.verified) || known[0];
  const credentials = chosen.transport.credentials(chosen.entry);
  if (!credentials) return { ok: false, reason: 'incomplete-credentials' };
  return {
    ok: true,
    provider: chosen.transport.id,
    transport: chosen.transport,
    verified: chosen.transport.verified,
    ...credentials,
    mode: payload?.data?.mode || 'WEBSOCKET',
  };
}

/**
 * The frame protocol, shared by every transport.
 *
 * Kept apart from the connection method on purpose: this is what a second
 * transport must *not* have to reimplement.
 */
function realtimeSubscribeFrame(channel) {
  // Public channels need no auth; an empty auth string is what Kick's own
  // client sends for them.
  return JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel } });
}

/**
 * Classify one inbound frame. Returns a `kind` the caller dispatches on, so
 * frame shape knowledge lives here rather than in the socket wiring.
 */
function parseRealtimeFrame(raw) {
  let frame;
  try {
    frame = JSON.parse(raw);
  } catch {
    // A run of frames we cannot read means Kick changed its payload shape.
    // That is a different problem from silence and deserves to be visible.
    return { kind: 'unparsable' };
  }
  const event = String(frame?.event || '');
  if (event === 'pusher:connection_established') return { kind: 'established', event };
  if (event === 'pusher_internal:subscription_succeeded') return { kind: 'subscription-ack', event };

  let payload = frame?.data;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { return { kind: 'other', event }; }
  }
  if (!payload || typeof payload !== 'object') return { kind: 'other', event };

  if (event.endsWith('ChatMessageEvent')) return { kind: 'chat-message', event, payload };
  if (event.endsWith('MessageDeletedEvent')) return { kind: 'deletion', event, payload };
  return { kind: 'other', event, payload };
}

/**
 * Kick's channel naming is inconsistent by design: `chatrooms.{id}.v2` and
 * `chatroom_{id}` are different channels carrying different events, as are
 * `channel.{id}` and `channel_{id}`. Getting a separator wrong subscribes
 * successfully to a channel that is simply never published to, which looks
 * exactly like a working connection.
 */
function realtimeChannels({ chatroomId, channelId }) {
  const names = [];
  if (chatroomId) names.push(`chatrooms.${chatroomId}.v2`, `chatroom_${chatroomId}`);
  if (channelId) names.push(`channel.${channelId}`, `channel_${channelId}`);
  return names;
}

/**
 * A dead Kick socket stays `readyState === OPEN` and never fires `close` or
 * `error`, so "connected" is not evidence of anything. Liveness is inferred
 * from inbound traffic, and a run of unparseable frames is treated as Kick
 * having changed shape rather than as noise to swallow.
 */
const REALTIME_SILENCE_MS = 60_000;
const REALTIME_UNPARSABLE_LIMIT = 20;

function realtimeHealth({ lastFrameAt = 0, unparsable = 0, now = 0, connected = false }) {
  if (!connected) return { state: 'offline', healthy: false };
  if (unparsable >= REALTIME_UNPARSABLE_LIMIT) {
    return { state: 'unparsable', healthy: false, detail: `${unparsable} consecutive frames could not be read — Kick's payload shape has probably changed.` };
  }
  if (lastFrameAt && now - lastFrameAt > REALTIME_SILENCE_MS) {
    return { state: 'stale', healthy: false, detail: `No events for ${Math.round((now - lastFrameAt) / 1000)}s — the socket reports open but is not delivering.` };
  }
  return { state: 'live', healthy: true };
}

// ---------------------------------------------------------------------------
// Channel identity
// ---------------------------------------------------------------------------

function normalizeChannel(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const id = Number(payload.id);
  if (!Number.isFinite(id)) return null;
  const livestream = payload.livestream && typeof payload.livestream === 'object' ? payload.livestream : null;
  return {
    id,
    userId: Number(payload.user_id) || 0,
    slug: typeof payload.slug === 'string' ? payload.slug : '',
    chatroomId: Number(payload.chatroom?.id) || 0,
    // The bulk live-status endpoint keys on the livestream, not the channel, so
    // an offline channel has no id here — which is itself the answer.
    livestreamId: Number(livestream?.id) || 0,
    followers: Number(payload.followers_count) || 0,
    isLive: Boolean(livestream?.is_live),
    viewers: Number(livestream?.viewer_count) || 0,
    title: typeof livestream?.session_title === 'string' ? livestream.session_title : '',
    mature: Boolean(livestream?.is_mature),
    language: typeof livestream?.language === 'string' ? livestream.language : '',
    categories: Array.isArray(livestream?.categories)
      ? livestream.categories.map((entry) => String(entry?.slug || '')).filter(Boolean)
      : [],
  };
}

// ---------------------------------------------------------------------------
// Emotes
// ---------------------------------------------------------------------------

/**
 * Kick's own marker for a Daily Rewards emote is the name prefix — there is no
 * type field on the emote itself.
 */
const COLLECTIBLE_PREFIX = 'collectibles';

function isCollectibleEmote(name) {
  return typeof name === 'string' && name.startsWith(COLLECTIBLE_PREFIX);
}

/**
 * Collectible emotes can be 2:1, and every third-party renderer squashes them
 * square because the rule lives only in Kick's own client. Measure the loaded
 * image rather than trusting the name: the prefix alone is not the rule, and a
 * name-only guess stretches ordinary square collectibles.
 */
const WIDE_ASPECT_RATIO = 1.2;

function emoteAspect(name, naturalWidth, naturalHeight) {
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  if (!isCollectibleEmote(name)) return 'square';
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return 'square';
  return width / height > WIDE_ASPECT_RATIO ? 'wide' : 'square';
}

function setKind(name) {
  const label = String(name || '').toLowerCase();
  if (label === 'global') return 'global';
  if (label === 'emojis') return 'emoji';
  return 'channel';
}

/**
 * Explicit entitlement only. The public /emotes/{slug} response normally
 * carries subscribers_only but no ownership signal, so "unknown" must stay
 * distinct from both granted and denied.
 */
function emoteEntitlement(source) {
  const emote = source && typeof source === 'object' ? source : {};
  const value = emote.subscribed ?? emote.is_subscribed ?? emote.subscription
    ?? emote.entitled ?? emote.unlocked ?? emote.owned;
  if (value === true || value === 1 || (value && typeof value === 'object')) return 'granted';
  if (value === false || value === 0 || emote.locked === true || emote.is_locked === true) return 'denied';
  return 'unknown';
}

/**
 * A follow must never be inferred from an ordinary channel emote. Kick's own
 * help says channel emotes are local to that chat; a follow gate is actionable
 * only when the response explicitly carries one of the known gate fields.
 */
function emoteFollowRequirement(emote, slug = '') {
  const source = emote && typeof emote === 'object' ? emote : {};
  const required = source.requiresFollow === true
    || source.requires_follow === true
    || source.followRequired === true
    || source.follow_required === true
    || source.followersOnly === true
    || source.followers_only === true
    || source.follow_only === true;
  const value = source.followed ?? source.is_following ?? source.following;
  const followed = value === true || value === 1 || Boolean(value && typeof value === 'object');
  const candidate = String(slug || source.sourceSlug || source.slug || source.setName || '').trim();
  return { required, followed, slug: isValidSlug(candidate) ? candidate : '' };
}

/**
 * What an API-only catalog entry may honestly claim before the native picker
 * corroborates it. Public artwork is not proof that the account can send it.
 */
function catalogEmoteAccess(emote) {
  const source = emote && typeof emote === 'object' ? emote : {};
  if (source.kind === 'global' || source.kind === 'emoji') return 'available';
  const follow = emoteFollowRequirement(source);
  if (follow.required && !follow.followed) return 'locked';
  if (!source.subscribersOnly && !source.subscribers_only) return 'channel';
  return (source.entitlement || emoteEntitlement(source)) === 'granted' ? 'available' : 'locked';
}

/**
 * Turn `/emotes/{slug}` into a flat, deduplicated catalog.
 *
 * Two facts drive the shape here:
 *
 *   - `subscribers_only` is not only an entitlement flag. Kick uses it to mean
 *     "usable in every chat", which is inverted from what the name suggests: a
 *     free channel emote works only in its own channel, while a sub emote
 *     travels everywhere. That is why `global` is derived from it.
 *   - Kick resolves a typed name through one name-keyed map where the last set
 *     loaded wins, so duplicate names across sets are a real collision, not a
 *     display detail. `normalizeEmoteSets` keeps every occurrence so the
 *     collision can be reported; see `findShadowedNames`.
 */
function normalizeEmoteSets(payload) {
  if (!Array.isArray(payload)) return { ok: false, reason: 'not-an-array', sets: [], emotes: [] };
  const sets = [];
  const emotes = [];
  for (const rawSet of payload) {
    if (!rawSet || typeof rawSet !== 'object') continue;
    const kind = setKind(rawSet.name);
    const setName = typeof rawSet.name === 'string' && rawSet.name ? rawSet.name : (rawSet.slug || 'Channel');
    const sourceSlugCandidate = typeof rawSet.slug === 'string' && rawSet.slug ? rawSet.slug : setName;
    const sourceSlug = kind === 'channel' && isValidSlug(sourceSlugCandidate) ? sourceSlugCandidate : '';
    const list = Array.isArray(rawSet.emotes) ? rawSet.emotes : [];
    const normalized = [];
    for (const raw of list) {
      const id = raw?.id;
      const name = raw?.name;
      if ((typeof id !== 'number' && typeof id !== 'string') || typeof name !== 'string' || !name) continue;
      const follow = emoteFollowRequirement({ ...rawSet, ...raw }, sourceSlug);
      const entry = {
        id: String(id),
        name,
        setId: rawSet.id == null ? null : String(rawSet.id),
        setName,
        sourceSlug,
        kind,
        channelId: raw.channel_id == null ? null : String(raw.channel_id),
        // Kick's flag: subscriber emotes are usable platform-wide.
        subscribersOnly: Boolean(raw.subscribers_only),
        requiresFollow: follow.required,
        followed: follow.followed,
        usableEverywhere: kind !== 'channel' || Boolean(raw.subscribers_only),
        entitlement: emoteEntitlement(raw),
        collectible: isCollectibleEmote(name),
        url: emoteImageUrl(id),
      };
      normalized.push(entry);
      emotes.push(entry);
    }
    sets.push({ id: rawSet.id == null ? null : String(rawSet.id), name: setName, kind, emotes: normalized });
  }
  // A catalog with no usable emote is not a catalog — sets full of entries that
  // failed validation mean Kick changed shape, and the caller must fall back to
  // scraping rather than render an empty picker as success.
  if (!sets.length) return { ok: false, reason: 'no-sets', sets: [], emotes: [] };
  if (!emotes.length) return { ok: false, reason: 'no-emotes', sets, emotes };
  return { ok: true, sets, emotes };
}

/**
 * Return only the requested channel's own set from a normalized response.
 * The response also carries Global/Emoji sets (and may eventually carry other
 * account sets), none of which an arbitrary-channel import should duplicate.
 */
function channelCatalogEmotes(catalog, slug) {
  if (!catalog?.ok || !Array.isArray(catalog.sets) || !isValidSlug(slug)) return [];
  const wanted = String(slug).toLowerCase();
  const set = catalog.sets.find((entry) => entry.kind === 'channel'
    && String(entry.name || '').toLowerCase() === wanted);
  return Array.isArray(set?.emotes) ? set.emotes : [];
}

/**
 * Why an emote is unavailable, and where Kick itself lets you unlock it.
 *
 * Entitlement is read across several shapes on purpose. Kick has expressed
 * subscription state in more than one way, and a single-shape check produces
 * *false negatives* — the documented failure is a client greying out emotes the
 * user does own, which is far worse than showing one it cannot confirm. So the
 * default when nothing says otherwise is unlocked, and only an explicit signal
 * locks an entry.
 *
 * Nothing here enables anything or sends anything. It explains, and links to
 * Kick's own page.
 */
function emoteLockState(emote, slug = '') {
  const source = emote && typeof emote === 'object' ? emote : {};
  const channel = String(slug || source.setName || '').trim();
  const follow = emoteFollowRequirement(source, channel);

  if (follow.required && !follow.followed) {
    return {
      locked: true,
      reason: follow.slug
        ? `Follow ${follow.slug} on Kick to use this channel emote.`
        : 'Follow the source channel on Kick to use this channel emote.',
      unlockUrl: follow.slug ? `${KICK_ORIGIN}/${encodeURIComponent(follow.slug)}` : '',
    };
  }

  // Any of these, in any of the shapes seen, means Kick says it is available.
  const entitled = source.subscribed ?? source.is_subscribed ?? source.subscription
    ?? source.entitled ?? source.unlocked ?? source.owned;
  if (entitled === true || entitled === 1 || (entitled && typeof entitled === 'object')) {
    return { locked: false, reason: '', unlockUrl: '' };
  }

  // An explicit denial is the only thing that locks an entry.
  const denied = source.locked === true
    || source.is_locked === true
    || entitled === false || entitled === 0
    || source.access === 'locked';
  if (!denied) return { locked: false, reason: '', unlockUrl: '' };

  if (source.collectible || isCollectibleEmote(source.name)) {
    return {
      locked: true,
      reason: 'A collectible you have not pulled yet. These come from Kick’s daily rewards, not from a purchase.',
      unlockUrl: `${KICK_ORIGIN}/collectibles`,
    };
  }
  if (source.subscribersOnly || source.subscribers_only) {
    return {
      locked: true,
      reason: channel
        ? `Subscriber emote. Subscribing to ${channel} on Kick unlocks it, and it then works in every chat.`
        : 'Subscriber emote. Subscribing to this channel on Kick unlocks it, and it then works in every chat.',
      unlockUrl: channel && isValidSlug(channel) ? `${KICK_ORIGIN}/${encodeURIComponent(channel)}` : '',
    };
  }
  return {
    locked: true,
    reason: 'Kick reports this emote as unavailable to your account, without saying why.',
    unlockUrl: channel && isValidSlug(channel) ? `${KICK_ORIGIN}/${encodeURIComponent(channel)}` : '',
  };
}

/**
 * Which typed names resolve to something other than what the user expects.
 *
 * Sub emotes work in every chat, and Kick matches a typed name against a single
 * name-keyed Map, so two channels shipping `KEKW` means one of them silently
 * sends the other's image. Collisions grow with each subscription, and nothing
 * on Kick surfaces them.
 *
 * "Last loaded wins" is the platform's own resolution order, so the winner is
 * the last occurrence, not the first.
 */
function findShadowedNames(emotes) {
  const byName = new Map();
  for (const emote of emotes || []) {
    const current = byName.get(emote.name) || [];
    current.push(emote);
    byName.set(emote.name, current);
  }
  const collisions = [];
  for (const [name, entries] of byName) {
    if (entries.length < 2) continue;
    const winner = entries.at(-1);
    collisions.push({
      name,
      winner,
      shadowed: entries.slice(0, -1),
      sets: entries.map((entry) => entry.setName),
    });
  }
  return collisions.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Chat events
// ---------------------------------------------------------------------------

/** Kick's chat wire format, e.g. `[emote:37226:KEKW]`. */
const EMOTE_TOKEN = /\[emote:(\d+):([^\]]*)\]/g;

/**
 * Bounds for anything arriving over the realtime socket.
 *
 * The subscription is anonymous and public, so a frame is untrusted input by
 * construction — not because Kick is hostile, but because nothing about the
 * transport guarantees otherwise. Every consumer of these normalizers inherits
 * whatever assumption is set here, so the bounds live at the boundary rather
 * than at each call site.
 */
const LIMITS = Object.freeze({
  id: 128,
  content: 2000,
  username: 80,
  color: 32,
  segments: 200,
  badges: 24,
  badgeText: 60,
  rules: 12,
  url: 400,
});

/** Coerce to a bounded string; anything else becomes empty rather than throwing. */
function boundedString(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/**
 * Split message content into text and emote segments.
 *
 * Kick's rendered DOM gives an `<img>` with an alt attribute; the wire format
 * gives the emote *id*, which is what a usage counter and a rarity join both
 * actually need. A name is not an identity on Kick — see `findShadowedNames`.
 */
function parseEmoteTokens(content) {
  const text = boundedString(content, LIMITS.content);
  const segments = [];
  let index = 0;
  EMOTE_TOKEN.lastIndex = 0;
  for (const match of text.matchAll(EMOTE_TOKEN)) {
    // A message crafted to be thousands of tokens must not become thousands of
    // nodes downstream.
    if (segments.length >= LIMITS.segments) break;
    if (match.index > index) segments.push({ type: 'text', value: text.slice(index, match.index) });
    segments.push({ type: 'emote', id: match[1].slice(0, LIMITS.id), name: match[2].slice(0, LIMITS.username) });
    index = match.index + match[0].length;
  }
  if (index < text.length && segments.length < LIMITS.segments) {
    segments.push({ type: 'text', value: text.slice(index) });
  }
  return segments;
}

function normalizeChatMessage(event) {
  if (!event || typeof event !== 'object') return null;
  const id = event.id;
  if (!id || (typeof id !== 'string' && typeof id !== 'number')) return null;
  const sender = event.sender || {};
  const identity = sender.identity || {};
  // badges_v2 supersedes badges: it carries image URLs and covers the global
  // and collectible badges the legacy array omits entirely.
  const badges = Array.isArray(identity.badges_v2) && identity.badges_v2.length
    ? identity.badges_v2
    : (Array.isArray(identity.badges) ? identity.badges : []);
  const segments = parseEmoteTokens(event.content);
  return {
    id: String(id).slice(0, LIMITS.id),
    content: boundedString(event.content, LIMITS.content),
    segments,
    emotes: segments.filter((segment) => segment.type === 'emote'),
    createdAt: boundedString(event.created_at, LIMITS.id),
    sender: {
      id: sender.id == null ? '' : String(sender.id).slice(0, LIMITS.id),
      username: boundedString(sender.username, LIMITS.username),
      slug: boundedString(sender.slug, LIMITS.username),
      // A colour goes straight into a style, so it is restricted to shapes CSS
      // can only read as a colour — never an arbitrary attacker-chosen string.
      color: /^#[0-9a-f]{3,8}$/i.test(String(identity.color || '')) ? String(identity.color) : '',
    },
    badges: badges.slice(0, LIMITS.badges).map((badge) => ({
      type: boundedString(badge?.type || badge?.badge_type, LIMITS.badgeText),
      text: boundedString(badge?.text || badge?.name, LIMITS.badgeText),
      // Only https URLs on Kick's own CDNs; a javascript: or data: image URL
      // has no legitimate reason to arrive here.
      image: /^https:\/\/[a-z0-9.-]*kick\.com\//i.test(String(badge?.image_url || ''))
        ? String(badge.image_url).slice(0, LIMITS.url)
        : '',
    })).filter((badge) => badge.type || badge.text),
  };
}

/** Kick's own rule slugs, as they appear in `violatedRules`. */
const RULE_LABELS = {
  bullying: 'bullying',
  harassment: 'harassment',
  hate_speech: 'hate speech',
  hateful_conduct: 'hateful conduct',
  spam: 'spam',
  self_harm: 'self-harm',
  sexual_content: 'sexual content',
  violence: 'violence',
};

/**
 * Why a message disappeared.
 *
 * `MessageDeletedEvent` carries `{aiModerated, violatedRules}`, but the DOM only
 * removes the node — so every DOM-scraping tool can see *that* a message went
 * and none can see *why*. Kick's non-disableable AI moderation is among the
 * loudest documented complaints about the platform, and this is the only place
 * the reason is exposed at all.
 */
function normalizeDeletion(event) {
  if (!event || typeof event !== 'object') return null;
  const id = event.message?.id ?? event.id;
  if (!id || (typeof id !== 'string' && typeof id !== 'number')) return null;
  const rules = Array.isArray(event.violatedRules) ? event.violatedRules.slice(0, LIMITS.rules) : [];
  const labels = rules
    .map((rule) => RULE_LABELS[String(rule)] || String(rule).slice(0, LIMITS.badgeText).replace(/_/g, ' '))
    .filter(Boolean);
  const aiModerated = Boolean(event.aiModerated);
  let reason = 'Removed by a moderator.';
  if (aiModerated && labels.length) reason = `Removed by Kick's automatic moderation for ${labels.join(', ')}.`;
  else if (aiModerated) reason = "Removed by Kick's automatic moderation.";
  else if (labels.length) reason = `Removed for ${labels.join(', ')}.`;
  return { id: String(id).slice(0, LIMITS.id), aiModerated, rules: labels, reason };
}

// ---------------------------------------------------------------------------
// Collectible rarity
// ---------------------------------------------------------------------------

const RARITY_ORDER = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);

function rarityRank(rarity) {
  const index = RARITY_ORDER.indexOf(String(rarity || '').toLowerCase());
  return index < 0 ? -1 : index;
}

/** Strip the marketing prefix and casing so a name can be matched in a URL. */
function joinToken(name) {
  return String(name || '')
    .replace(new RegExp(`^${COLLECTIBLE_PREFIX}`, 'i'), '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

/**
 * Join collectible card art to emote identity.
 *
 * Kick exposes rarity only on the card (`{id: uuid, card_url, owned, rarity}`,
 * no name) and identity only in the picker (`{id: int, name}`, no rarity). The
 * two payloads share no key, which is why no client anywhere can currently tell
 * a user what rarity an emote they own is.
 *
 * There is therefore no exact join, only evidence. Each strategy carries its own
 * confidence, and anything below `minConfidence` is returned as unmatched with
 * no label attached: a mislabelled Mythic is strictly worse than no label, and
 * this join is the one place in the project where being wrong is worse than
 * being silent.
 */
const RARITY_MIN_CONFIDENCE = 0.75;

function joinCollectibleRarity(cards, emotes, { minConfidence = RARITY_MIN_CONFIDENCE } = {}) {
  const collectibles = (emotes || []).filter((emote) => emote.collectible);
  const matched = [];
  const unmatched = [];
  const claimed = new Set();

  for (const emote of collectibles) {
    const token = joinToken(emote.name);
    let best = null;

    for (const card of cards || []) {
      if (!card || claimed.has(card.id)) continue;
      const url = String(card.card_url || '').toLowerCase();
      if (!url) continue;

      let confidence = 0;
      let basis = '';
      // Strongest: the card art is addressed by the emote's own id.
      if (new RegExp(`(^|[^0-9])${emote.id}([^0-9]|$)`).test(url)) {
        confidence = 0.98;
        basis = 'emote id in card URL';
      } else if (token.length >= 4 && url.replace(/[^a-z0-9]/g, '').includes(token)) {
        // Weaker: the name appears in the asset path. Short tokens match by
        // accident far too easily, hence the length floor.
        confidence = 0.85;
        basis = 'emote name in card URL';
      }
      if (confidence && (!best || confidence > best.confidence)) best = { card, confidence, basis };
    }

    if (best && best.confidence >= minConfidence && rarityRank(best.card.rarity) >= 0) {
      claimed.add(best.card.id);
      matched.push({
        emote,
        rarity: String(best.card.rarity).toLowerCase(),
        rank: rarityRank(best.card.rarity),
        owned: Boolean(best.card.owned),
        confidence: best.confidence,
        basis: best.basis,
      });
    } else {
      unmatched.push(emote);
    }
  }

  const total = collectibles.length;
  return {
    matched,
    unmatched,
    total,
    coverage: total ? matched.length / total : 0,
    // The caller renders rarity only when this is true; otherwise the tab looks
    // exactly as it does today.
    usable: total > 0 && matched.length > 0,
  };
}

/**
 * Bulk live status, as Kick's own sidebar reads it.
 *
 * One request answers for every channel in the grid and every saved layout, so
 * a shelf of layouts costs what a single channel would. A channel absent from
 * the response is offline by Kick's own convention — it only returns entries
 * for channels that are live — so absence is treated as offline rather than
 * unknown, and a reshaped payload reports rather than inventing a status.
 */
function normalizeCurrentViewers(payload) {
  const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : null);
  if (!list) return { ok: false, reason: 'not-a-list' };
  const entries = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const id = raw.livestream_id ?? raw.id ?? raw.channel_id;
    if (id == null) continue;
    const viewers = Number(raw.viewers ?? raw.viewer_count ?? raw.count);
    entries.push({
      id: String(id).slice(0, LIMITS.id),
      viewers: Number.isFinite(viewers) && viewers >= 0 ? Math.floor(viewers) : 0,
      // Presence in this response is Kick's own signal that a channel is live.
      live: true,
    });
    if (entries.length >= 200) break;
  }
  return { ok: true, entries };
}

/**
 * Summarise the user's own collectible inventory.
 *
 * Kick publishes no drop odds and documents no duplicate protection, so the
 * only trustworthy duplicate figure is the one the user's own inventory shows.
 * Whether it shows one at all depends on Kick returning a per-card quantity,
 * which is read tolerantly across the names it might use — and when no card
 * carries one, `quantityKnown` is false and the caller must say the number is
 * unavailable rather than present `distinct` as if it were the whole story.
 */
function summarizeCollectibleInventory(cards) {
  const list = (Array.isArray(cards) ? cards : []).filter((card) => card && typeof card === 'object');
  if (!list.length) return { ok: false, reason: 'no-cards' };

  let copies = 0;
  let quantityKnown = false;
  for (const card of list) {
    const raw = card.quantity ?? card.count ?? card.amount ?? card.owned;
    const value = Math.floor(Number(raw));
    if (Number.isFinite(value) && value >= 1) {
      copies += value;
      quantityKnown = true;
    } else {
      // No quantity on this card: it is still one copy, so the total stays a
      // lower bound rather than becoming a guess.
      copies += 1;
    }
  }

  const distinct = list.length;
  const duplicates = quantityKnown ? Math.max(0, copies - distinct) : 0;
  return {
    ok: true,
    distinct,
    copies,
    duplicates,
    quantityKnown,
    duplicateRate: quantityKnown && copies > 0 ? duplicates / copies : 0,
  };
}

/**
 * What Kick does not explain about collectibles, stated only where a source
 * exists. Every line is either something Kick has published, something Kick
 * support has said, or an absence that can be verified by looking.
 */
const COLLECTIBLE_FACTS = Object.freeze([
  Object.freeze({
    claim: 'The daily streak does not improve what you get.',
    detail: 'Kick support has stated the streak confers no bonus to drop quality or odds — it only tracks consecutive claims. Nothing in the collectibles response carries a streak multiplier either.',
  }),
  Object.freeze({
    claim: 'Kick does not publish drop odds.',
    detail: 'No rarity probability appears in any response this build reads, and none is documented. Any odds you have seen quoted are someone else’s estimate, not Kick’s figure.',
  }),
  Object.freeze({
    claim: 'Duplicate protection is undocumented.',
    detail: 'Kick has never stated whether a drop can repeat an item you already own. The count below is what your own inventory shows, which is the only evidence available.',
  }),
  Object.freeze({
    claim: 'The collectibles page and your chat emote set can disagree.',
    detail: 'They are served by different endpoints and are reported to fall out of sync. The emote set is the one chat actually accepts, so trust that when they differ.',
  }),
  Object.freeze({
    claim: 'Kick can change an emote you already pulled.',
    detail: 'Reported in July 2026 and answered by Kick support with “remastered… clear your cache”. Your local library records the name and artwork at first capture, so a changed entry is flagged rather than quietly replaced.',
  }),
]);

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

// ---------------------------------------------------------------------------
// Kick live data
//
// Read-only, same-origin requests to endpoints Kick's own client already calls,
// inheriting the session the page already has. Nothing here writes to Kick,
// handles a credential, or runs when the matching setting is off, and every
// path falls back to the existing DOM scraping when it fails.
//
// Like the multi-stream surface, everything page-owned arrives through `host`
// rather than out of the enclosing bundle scope, so this file loads on its own
// under `node --test`. The build strips the imports below and relies on concat
// order to supply the names.
// ---------------------------------------------------------------------------


const LIVE_TIMEOUT_MS = 8000;
const LIVE_MAX_BYTES = 4_000_000;
const REALTIME_BACKOFF_MS = [2000, 5000, 15000, 45000];

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

/** The selectors Kick's chat uses to key a rendered message to its id. */
function chatMessageSelector(id) {
  const escaped = CSS.escape(id);
  return `[data-index="${escaped}"], [data-message-id="${escaped}"], [data-chat-entry="${escaped}"]`;
}

/**
 * Build the live-data surface against a host.
 *
 * `host` supplies the page-owned collaborators: `state`, the storage writer,
 * the unhooked `fetch`, and the two runtime helpers this surface borrows.
 */
function createLive(host) {
  const {
    state,
    gmSet,
    EMOTE_USAGE_KEY,
    pageFetch,
    currentChannelSlug,
    plural,
    mergeStickerLibrary,
  } = host;

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
   * Same-origin account mutation with Kick's own session and CSRF cookie. The
   * only caller is the explicit click-to-save gesture for an emote Kick itself
   * marks follow-gated; ordinary channel emotes never reach this path.
   */
  async function mutateKickChannelFollow(slug, method = 'POST') {
    if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(slug || '')) return { ok: false, status: 'invalid-channel' };
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
    try {
      const headers = { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' };
      const token = document.cookie.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);
      if (token) headers['x-xsrf-token'] = decodeURIComponent(token);
      const response = await pageFetch(endpoints.followChannel(slug), {
        method,
        credentials: 'include',
        headers,
        signal: controller.signal,
      });
      return { ok: response.ok || response.status === 409, status: response.status };
    } catch (error) {
      return { ok: false, status: error?.name === 'AbortError' ? 'timeout' : 'network' };
    } finally {
      clearTimeout(timer);
    }
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
   * The catalog avoids depending entirely on a lazy-rendered picker, but its
   * public artwork is not account entitlement. API-only channel entries remain
   * channel-only or locked until the native picker corroborates access.
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

    // The endpoint publishes every image but normally carries no ownership
    // signal. Seed the library without claiming that subscriber artwork is
    // sendable; the native picker can still upgrade a confirmed tile later.
    mergeStickerLibrary(catalog.emotes.map((emote) => ({
      key: platformStickerKey(`id:${emote.id}`),
      id: emote.id,
      name: emote.name,
      src: emote.url,
      nativeGroups: [emote.kind === 'channel' ? emote.setName : emote.setName],
      access: catalogEmoteAccess(emote),
      sourceSlug: emote.sourceSlug,
      requiresFollow: emote.requiresFollow,
      followed: emote.followed,
      subscribersOnly: emote.subscribersOnly,
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

  // -------------------------------------------------------------------------
  // Realtime
  // -------------------------------------------------------------------------

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
    return document.querySelector(chatMessageSelector(id));
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
    const node = document.querySelector(chatMessageSelector(deletion.id));
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
    if (state.live.collisions.length) parts.push(`${state.live.collisions.length} ${plural(state.live.collisions.length, 'emote name shadowed.', 'emote names shadowed.')}`);
    if (state.live.catalogError) parts.push(state.live.catalogError);
    return parts.join(' ');
  }

  return {
    connectRealtime,
    kickFetchJson,
    liveStatusSummary,
    mutateKickChannelFollow,
    onRealtimeFrame,
    recordApiDrift,
    refreshLiveChannel,
    refreshLiveDiagnostics,
    replayPendingBadges,
    replayPendingDeletions,
    teardownRealtime,
  };
}

// ---------------------------------------------------------------------------
// Multi-stream
//
// A grid of Kick's own embedded players and chat, so playback, subscriptions
// and entitlements all stay Kick's. Nothing here reimplements a player or
// works around an entitlement; it arranges surfaces Kick already publishes.
//
// Everything this surface needs from the page — storage, toasts, translation,
// the shared `state` object — arrives through `host` rather than being read out
// of the enclosing bundle scope. That boundary is the point: it is what lets
// this file load on its own under `node --test` with a stub host, where the
// grid's tile reuse, audio focus and cross-tab merge can be exercised without a
// browser. The build strips the imports below and relies on concat order.
// ---------------------------------------------------------------------------


function isPlainRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Build the multi-stream surface against a host.
 *
 * `host` supplies the page-owned collaborators: `state`, the GM storage pair,
 * the translation and announcement helpers, and the two live-data functions
 * this surface borrows to resolve channel identity.
 */
function createMultistream(host) {
  const {
    state,
    gmGet,
    gmSet,
    MULTISTREAM_KEY,
    currentChannelSlug,
    tr,
    trf,
    escapeHtml,
    trustedHTML,
    announce,
    showToast,
    syncHeaderMultiState,
    kickFetchJson,
    recordApiDrift,
    syncCardMultiState = () => {},
  } = host;

  let syncChannel = null;

  function persistMultistream() {
    gmSet(MULTISTREAM_KEY, state.multistream);
  }

  // Re-read, merge, write. The multi-stream store is shared across tabs, so a
  // blind write drops channels another tab added since this tab booted. This
  // applies this tab's add/remove on top of the latest stored value.
  function commitMultistream(added = [], removed = []) {
    state.multistream = mergeMultistream(gmGet(MULTISTREAM_KEY, {}), state.multistream, added, removed);
    gmSet(MULTISTREAM_KEY, state.multistream);
    // A no-op commit is a deliberate re-read (on open, or after a storage
    // event) and has nothing to tell anyone.
    if (added.length || removed.length) broadcastMultistream(added, removed);
    return state.multistream;
  }

  /**
   * Converge the other tabs.
   *
   * The store is the truth and every commit re-reads it, so this is a nudge,
   * not the mechanism — which is what makes the origin split survivable.
   * `BroadcastChannel` and `localStorage` are both scoped to one origin, while
   * the userscript's GM storage is shared across `kick.com` and `www.kick.com`;
   * tabs that cannot hear each other therefore still converge the next time
   * either one opens the grid, rather than diverging silently.
   */
  function broadcastMultistream(added, removed) {
    const channel = multistreamSyncChannel();
    if (!channel) return;
    try {
      channel.postMessage({ type: 'converge', added: [...added], removed: [...removed], ts: Date.now() });
    } catch {
      // The next re-read still picks this up.
    }
  }

  function multistreamSyncChannel() {
    if (syncChannel || typeof BroadcastChannel !== 'function') return syncChannel;
    try {
      syncChannel = new BroadcastChannel('kick-focus:multi');
      syncChannel.addEventListener('message', (event) => {
        const message = event?.data;
        if (!isPlainRecord(message) || message.type !== 'converge') return;
        applyRemoteMultistream(message.added, message.removed);
      });
    } catch {
      syncChannel = null;
    }
    return syncChannel;
  }

  /**
   * Fold another tab's add/remove into this one.
   *
   * The op is re-derived from storage rather than trusted off the wire, and the
   * same union runs in every tab, so applying a message twice — or applying one
   * that this tab already saw through a storage event — lands in the same place.
   * Nothing is written back, because the tab that sent it already did.
   */
  function applyRemoteMultistream(added = [], removed = []) {
    const addList = (Array.isArray(added) ? added : []).filter((slug) => typeof slug === 'string');
    const removeList = (Array.isArray(removed) ? removed : []).filter((slug) => typeof slug === 'string');
    const next = mergeMultistream(gmGet(MULTISTREAM_KEY, {}), state.multistream, addList, removeList);
    if (JSON.stringify(next.streams) === JSON.stringify(state.multistream.streams)) return false;
    state.multistream = next;
    syncHeaderMultiState();
    syncCardMultiState();
    renderMultistream();
    renderPresenceOffer();
    return true;
  }

  /**
   * The extension build stores in `localStorage`, which raises `storage` in
   * every other tab on the origin. That makes convergence work even where
   * `BroadcastChannel` does not, and costs one listener.
   */
  function installMultistreamStorageSync() {
    if (typeof window?.addEventListener !== 'function') return;
    window.addEventListener('storage', (event) => {
      if (event?.key !== MULTISTREAM_KEY) return;
      applyRemoteMultistream();
    });
  }

  /** Add or remove one channel, from wherever the gesture came from. */
  function toggleMultistreamSlug(raw) {
    const slug = parseChannelInput(raw);
    if (!slug) return { ok: false, error: 'Enter a Kick channel name or a kick.com link.' };
    const inGrid = state.multistream.streams.some((entry) => entry.toLowerCase() === slug.toLowerCase());
    if (!inGrid && state.multistream.streams.length >= MULTISTREAM_MAX) {
      return { ok: false, error: `Multi-stream is full at ${MULTISTREAM_MAX} of ${MULTISTREAM_MAX}.` };
    }
    const result = inGrid ? commitMultistream([], [slug]) : commitMultistream([slug]);
    syncHeaderMultiState();
    syncCardMultiState();
    renderMultistream();
    return { ok: true, slug, added: !inGrid, streams: result.streams };
  }

  /**
   * Ask the other tabs which channel they are on, and collect the answers.
   *
   * Zero new permissions: `BroadcastChannel` is same-origin by construction, so
   * this reaches other kick.com tabs and nothing else, in both the userscript and
   * the extension builds. Request/response rather than a maintained roster —
   * there is no join or leave message to miss, a tab that has gone simply does
   * not answer, and every answer carries its own timestamp so a stale one expires
   * on its own. Nothing but a channel slug is ever put on the wire.
   */
  function multistreamPresenceChannel() {
    if (state.presence.channel || typeof BroadcastChannel !== 'function') return state.presence.channel;
    try {
      const channel = new BroadcastChannel('kick-focus:presence');
      channel.addEventListener('message', (event) => {
        const message = event?.data;
        if (!isPlainRecord(message)) return;
        if (message.type === 'who') {
          // Answer only from a channel page; nothing else has a slug to report.
          const slug = currentChannelSlug();
          if (slug) channel.postMessage({ type: 'here', slug, ts: Date.now() });
          return;
        }
        if (message.type === 'here') {
          state.presence.answers.push({ slug: message.slug, ts: message.ts });
          renderPresenceOffer();
        }
      });
      state.presence.channel = channel;
    } catch {
      // No cross-tab roll-call; every other multi-stream path is unaffected.
    }
    return state.presence.channel;
  }

  function requestMultistreamPresence() {
    const channel = multistreamPresenceChannel();
    if (!channel) return;
    state.presence.answers = [];
    renderPresenceOffer();
    try {
      channel.postMessage({ type: 'who', ts: Date.now() });
    } catch {
      // The offer simply stays empty.
    }
  }

  function renderPresenceOffer() {
    const button = state.shadow?.querySelector('[data-kf-presence-add]');
    if (!button) return;
    const present = mergePresence(state.presence.answers, Date.now());
    const offer = presenceOffer(present, state.multistream.streams, MULTISTREAM_MAX);
    state.presence.offer = offer;
    button.hidden = offer.length === 0;
    button.textContent = trf('Add open tabs ({count})', { count: offer.length });
    button.title = offer.join(', ');
  }

  function addPresenceOffer() {
    const offer = state.presence.offer.slice();
    if (!offer.length) return;
    const result = commitMultistream(offer, []);
    renderMultistream();
    renderPresenceOffer();
    showToast(trf('Added {count} from your other tabs — {total} of {max}', {
      count: offer.length, total: result.streams.length, max: MULTISTREAM_MAX,
    }));
    announce(trf('Added {count} channels from your other tabs.', { count: offer.length }));
  }

  function openMultistream() {
    const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
    if (!backdrop) return;
    state.lastFocused = document.activeElement;
    backdrop.hidden = false;
    // Re-read on open. A tab that was asleep, on the other origin, or simply
    // not listening when another one added a channel picks it up here — which
    // is why the broadcast can be an enhancement rather than a dependency.
    commitMultistream();
    // Someone asking the system for reduced motion should not be handed nine
    // autoplaying videos. They mount paused with a visible way to start.
    installMultistreamSuspension();
    if (!state.multistream.paused && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      state.multistream = normalizeMultistream({ ...state.multistream, paused: true });
    }
    renderMultistream();
    // Asked on open rather than kept up to date in the background: the answer is
    // only ever looked at here, and a standing roster would mean every tab
    // chattering for a list nobody is reading.
    requestMultistreamPresence();
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
    if (grid) grid.replaceChildren();
    const chat = backdrop.querySelector('[data-kf-multistream-chat]');
    if (chat) chat.replaceChildren();
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
        bar.innerHTML = trustedHTML(`
        <button type="button" class="kf-ms-name" data-action="multistream-focus" data-slug="${escapeHtml(slug)}" title="Give this stream the audio and chat">${escapeHtml(slug)}</button>
        <span class="kf-ms-spacer"></span>
        <a class="kf-ms-link" href="/${encodeURIComponent(slug)}" target="_blank" rel="noopener" title="Open ${escapeHtml(slug)} on Kick">Open</a>
        <button type="button" data-action="multistream-remove" data-slug="${escapeHtml(slug)}" aria-label="Remove ${escapeHtml(slug)} from the grid" title="Remove">×</button>`);
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
    const host_ = backdrop.querySelector('[data-kf-multistream-chat]');
    if (!host_) return;
    if (!showChat || !chat) {
      host_.replaceChildren();
      return;
    }
    const current = host_.querySelector('iframe');
    if (current?.dataset.slug === chat) return;
    host_.replaceChildren();
    // Kick's popout chat refuses to send from inside an iframe — it throws a
    // CSRF error by design, and only reading works. Saying so is the difference
    // between a limitation and something that looks broken.
    const notice = document.createElement('p');
    notice.className = 'kf-ms-chat-notice';
    notice.textContent = tr('Read-only here. Kick blocks sending from an embedded chat; open the channel to talk.');
    host_.append(notice);
    const frame = document.createElement('iframe');
    frame.src = chatEmbedUrl(chat);
    frame.dataset.slug = chat;
    frame.title = `${chat} chat`;
    frame.referrerPolicy = 'origin';
    host_.append(frame);
  }

  function renderMultistreamControls(backdrop) {
    const { streams, chat, showChat, layouts } = state.multistream;
    const count = backdrop.querySelector('[data-kf-multistream-count]');
    if (count) {
      // Same rule as the command count: composed text on a node that outlives the
      // render, so it translates here and the localizer is told to skip it.
      count.textContent = streams.length
        ? trf('{count} of {max} streams', { count: streams.length, max: MULTISTREAM_MAX })
        : tr('No streams yet — add a channel to start.');
    }
    const error = backdrop.querySelector('[data-kf-multistream-error]');
    if (error) {
      error.textContent = state.multistreamError;
      error.hidden = !state.multistreamError;
    }
    const chatSelect = backdrop.querySelector('[data-kf-multistream-chat-select]');
    if (chatSelect) {
      chatSelect.innerHTML = trustedHTML(streams.map((slug) => `<option value="${escapeHtml(slug)}"${slug === chat ? ' selected' : ''}>${escapeHtml(slug)}</option>`).join(''));
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
      savedList.innerHTML = trustedHTML(layouts.length
        ? layouts.map((layout) => {
          // Live counts come from one bulk request for every saved channel, so a
          // shelf of layouts costs the same as a single one.
          const live = layout.streams.filter((slug) => state.multistreamLive.get(slug.toLowerCase())).length;
          const status = state.multistreamLive.size
            ? `<small class="kf-ms-live" data-live="${live > 0}">${live}/${layout.streams.length} live</small>`
            : `<small>${layout.streams.length}</small>`;
          return `<span class="kf-ms-layout"><button type="button" data-action="multistream-load" data-layout="${escapeHtml(layout.name)}" title="${escapeHtml(layout.streams.join(', '))}">${escapeHtml(layout.name)} ${status}</button><button type="button" data-action="multistream-copy-layout" data-layout="${escapeHtml(layout.name)}" aria-label="Copy a link to layout ${escapeHtml(layout.name)}" title="Copy link">🔗</button><button type="button" data-action="multistream-delete-layout" data-layout="${escapeHtml(layout.name)}" aria-label="Delete layout ${escapeHtml(layout.name)}" title="Delete">×</button></span>`;
        }).join('')
        : '<span class="kf-ms-empty">No saved layouts yet.</span>');
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

  return {
    addMultistream,
    addPresenceOffer,
    applyRemoteMultistream,
    closeMultistream,
    commitMultistream,
    installMultistreamStorageSync,
    multistreamOpen,
    multistreamPresenceChannel,
    multistreamSyncChannel,
    openMultistream,
    persistMultistream,
    refreshMultistreamLive,
    refreshMultistreamPlayback,
    renderMultistream,
    renderPresenceOffer,
    requestMultistreamPresence,
    resolveMultistreamLive,
    toggleCurrentChannelInMulti,
    toggleMultistreamSlug,
  };
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
    routeSource: '',
    applyRunning: false,
    presenceRequested: false,
    stickerGridScrollTop: null,
    stickerSearchTimer: 0,
    // Index of the first tile the grid should render around. The organizer
    // renders a window rather than the whole library, so this is what moves.
    stickerGridAnchor: 0,
    stickerLibraryQuery: '',
    stickerLibraryFilter: 'all',
    emoteCatalogSlug: '',
    emoteCatalogStatus: '',
    emoteCatalogError: false,
    emoteCatalogLoading: false,
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
    apply: {},
  },
  shortcutCapture: null,
  shortcutError: '',
  resetPending: false,
  resetOpener: null,
  chatEmoteTooltip: null,
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
    --kf-text-secondary: #c7cec9;
    --kf-surface-inset: #090d0a;
    --kf-surface-hover: #202621;
    --kf-on-accent: #071004;
    --kf-danger: #ff6258;
    --kf-warning: #f6b943;
    --kf-radius: 10px;
    --kf-chat-width: 410px;
    --kf-thumb-saturation: 1.03;
    --kf-caption-opacity: .72;
    --kf-text-scale: 1;
  }

  html[data-kf-accent="cyan"] { --kf-accent: #38d7d0; --kf-accent-rgb: 56, 215, 208; }
  html[data-kf-accent="violet"] { --kf-accent: #9667ff; --kf-accent-rgb: 150, 103, 255; }
  html[data-kf-accent="gold"] { --kf-accent: #ffbe2e; --kf-accent-rgb: 255, 190, 46; }
  html[data-kf-radius="subtle"] { --kf-radius: 6px; }
  html[data-kf-radius="rounded"] { --kf-radius: 12px; }
  html[data-kf-theme="oled"] { --kf-canvas: #000; --kf-panel: #050606; --kf-panel-raised: #0a0c0d; --kf-panel-high: #101313; --kf-border: #24282b; --kf-border-strong: #3a4143; }
  html[data-kf-theme="slate"] { --kf-canvas: #0e1110; --kf-panel: #141817; --kf-panel-raised: #1b211f; --kf-panel-high: #222926; --kf-border: #3a454f; --kf-border-strong: #53616c; }

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
      border-radius: 10px !important;
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
      background: var(--kf-surface-inset) !important;
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
      background: var(--kf-surface-inset) !important;
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

    html[data-kf-poor-mode="true"] [data-kf-monetization] { display: none !important; }

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
      font-size: 11px !important;
      font-weight: 760 !important;
    }

    [data-kf-card-actions] button:hover,
    [data-kf-card-actions] button[data-active="true"] { border-color: var(--kf-accent) !important; color: var(--kf-accent) !important; }

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
      /* Fixed rows are what let one spacer stand in for a known number of them.
         The values here are mirrored by STICKER_TILE_HEIGHT/STICKER_GRID_GAP. */
      grid-auto-rows: 62px !important;
      gap: 7px !important;
      max-height: min(360px, 42vh) !important;
      overflow: auto !important;
      scrollbar-gutter: stable !important;
      padding: 3px 2px 6px !important;
    }
    /* The picker grid scrolls inside a capped height and can hold hundreds of
       tiles. Skipping layout and paint for the off-screen ones is what keeps
       opening it cheap; the intrinsic size holds the scroll height steady. */
    [data-kf-sticker-item] { min-width: 0 !important; text-align: center !important; content-visibility: auto !important; contain-intrinsic-size: auto 62px !important; }
    /* Stands in for the rows outside the rendered window, so the scrollbar
       still describes the whole library. Spans every column, draws nothing. */
    [data-kf-sticker-spacer] { grid-column: 1 / -1 !important; pointer-events: none !important; }
    [data-kf-sticker-usage-shelf] { margin-top: 8px !important; }
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
    outline: 3px solid var(--kf-accent) !important;
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
  for (const control of document.querySelectorAll('button, a, [role="button"]')) {
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

const liveSurface = createLive({
  state,
  gmSet,
  EMOTE_USAGE_KEY,
  pageFetch,
  currentChannelSlug,
  plural,
  mergeStickerLibrary,
});
const {
  kickFetchJson,
  liveStatusSummary,
  mutateKickChannelFollow,
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
  tr,
  trf,
  escapeHtml,
  trustedHTML,
  announce,
  showToast,
  syncHeaderMultiState,
  syncCardMultiState,
  kickFetchJson,
  recordApiDrift,
});
const {
  addMultistream,
  addPresenceOffer,
  closeMultistream,
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
  // Collect a channel without opening it. Category tiles and section links wear
  // the same markup as channel cards, so the chip appears only where the card
  // actually points at a channel.
  const slug = cardSlugFromPath(path);
  const label = escapeHtml(cardLabel(node));
  const inMulti = Boolean(slug) && multistreamHasSlug(slug);
  const multiChip = slug
    ? `<button type="button" data-kf-card-action="multi" data-kf-card-slug="${escapeHtml(slug)}" data-active="${inMulti}" aria-pressed="${inMulti}" aria-label="${inMulti ? 'Remove' : 'Add'} ${label} ${inMulti ? 'from' : 'to'} the multi-stream grid" title="${inMulti ? 'In Multi' : 'Add to Multi'}">${inMulti ? '⊟' : '⊞'}</button>`
    : '';
  // Rebuilt only when what it renders changed. The apply cycle runs these over
  // every card on a discovery page, and replacing the buttons each time both
  // wasted the work and quietly detached the node under anyone mid-click.
  const signature = `${favorite}:${dismissed}:${slug}:${inMulti}:${label}`;
  if (actions.dataset.kfCardSignature === signature) return;
  actions.dataset.kfCardSignature = signature;
  actions.innerHTML = trustedHTML(`
    <button type="button" data-kf-card-action="favorite" data-active="${favorite}" aria-label="${favorite ? 'Remove favorite' : 'Favorite'} ${label}">${favorite ? '★' : '☆'}</button>
    ${multiChip}
    <button type="button" data-kf-card-action="dismiss" aria-label="${dismissed ? 'Restore' : 'Not interested'} ${label}">${dismissed ? '↶' : '×'}</button>`);
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
    button.title = inMulti ? 'In Multi' : 'Add to Multi';
    // The container's signature has to move with it, or the next apply cycle
    // would see a stale stamp and rebuild the buttons this just patched.
    const actions = button.parentElement;
    if (actions?.dataset.kfCardSignature) {
      actions.dataset.kfCardSignature = actions.dataset.kfCardSignature.replace(
        /:(true|false):([^:]*)$/, `:${inMulti}:$2`,
      );
    }
    const label = button.getAttribute('aria-label') || '';
    button.setAttribute('aria-label', inMulti
      ? label.replace(/^Add /, 'Remove ').replace(/ to the multi-stream grid$/, ' from the multi-stream grid')
      : label.replace(/^Remove /, 'Add ').replace(/ from the multi-stream grid$/, ' to the multi-stream grid'));
  }
}

function handleCardAction(event) {
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
    showToast(`${result.added ? 'Added' : 'Removed'} ${result.slug} — ${total} of ${MULTISTREAM_MAX}`, false, [
      { label: 'View', onClick: () => openMultistream() },
      { label: 'Undo', onClick: () => { toggleMultistreamSlug(result.slug); } },
    ]);
    announce(`${result.added ? 'Added' : 'Removed'} ${result.slug}. Now ${total} of ${MULTISTREAM_MAX}.`);
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
  meta.innerHTML = trustedHTML(`<div><strong>${query ? `Search results for “${escapeHtml(query)}”` : 'Search results'}</strong><span>${count} ${plural(count, 'result loaded', 'results loaded')}</span></div>${query ? '<button type="button" data-kf-clear-search aria-label="Clear search">Clear</button>' : ''}`);
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
  enhanced.innerHTML = trustedHTML(`
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
    const incomingAccess = sticker.available
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
  .card {
    padding: 8px 10px;
    border: 1px solid #59645c;
    border-radius: 8px;
    background: #151917;
    color: #f4f7f5;
    box-shadow: 0 10px 28px rgba(0,0,0,.45);
    font: 12px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .card div { white-space: normal; overflow-wrap: anywhere; }
  .card div:first-child { font-weight: 700; }
  .card div + div { color: #a5aea8; }
  .card div[data-warn="true"] { color: #f6b943; }
`;

function chatEmoteTooltipHost() {
  if (state.chatEmoteTooltip?.host?.isConnected) return state.chatEmoteTooltip;
  const host = document.createElement('div');
  host.id = 'kick-focus-emote-tooltip';
  host.setAttribute('aria-hidden', 'true');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = trustedHTML('<div class="card" data-kf-tooltip-card></div>');
  adoptStyles(shadow, TOOLTIP_CSS);
  document.body.append(host);
  state.chatEmoteTooltip = { host, card: shadow.querySelector('[data-kf-tooltip-card]') };
  return state.chatEmoteTooltip;
}

function hideChatEmoteTooltip() {
  const tooltip = state.chatEmoteTooltip;
  if (tooltip?.host) tooltip.host.dataset.kfOpen = 'false';
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
  // Clamped after the card is measurable, so a wide entry near an edge is
  // pulled back on screen instead of being cut off by the viewport.
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
  // The state stamp is what lets a favorite toggle patch this tile in place
  // instead of re-serialising the window it sits in.
  return `<div data-kf-sticker-item="true" data-kf-sticker-key="${safeKey}" data-kf-sticker-hidden="${hidden}" data-kf-sticker-state="${pinned}:${hidden}"${scope ? ' data-kf-sticker-scoped="true"' : ''}>
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
    // Debounced: every keystroke used to re-filter and re-serialise the whole
    // library, so typing a five-letter name rebuilt the grid five times.
    search.addEventListener('input', () => {
      clearTimeout(state.runtime.stickerSearchTimer);
      state.runtime.stickerSearchTimer = window.setTimeout(() => {
        state.runtime.stickerSearchTimer = 0;
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

  // Usage counts are keyed by Kick's emote id; the organizer is keyed by
  // storage key, so the two shelves are a lookup rather than a second store.
  const byId = new Map();
  for (const descriptor of descriptors) {
    if (descriptor.id && !byId.has(String(descriptor.id))) byId.set(String(descriptor.id), descriptor);
  }
  // Presentational, over counts this build already records: these two shelves
  // order emotes the user sent by hand. Nothing here sends, repeats, or
  // schedules a send — the hold-to-spam, turbo and pyramid features other
  // clients pair with a Most Used shelf are deliberately absent.
  const fromUsage = (ranked) => ranked
    .map((entry) => byId.get(String(entry.id)))
    .filter((descriptor) => descriptor && !state.stickerPreferences.hidden.has(descriptor.key))
    .slice(0, STICKER_USAGE_SECTION_LIMIT);
  const usageDepth = STICKER_USAGE_SECTION_LIMIT * 3;
  const mostUsed = fromUsage(rankEmoteUsage(state.emoteUsage, { channel: state.live.slug, limit: usageDepth }));
  const recent = fromUsage(recentEmoteUsage(state.emoteUsage, { channel: state.live.slug, limit: usageDepth }));

  const chrome = organizer.querySelector('[data-kf-sticker-chrome]');
  const gridHost = organizer.querySelector('[data-kf-sticker-grid-host]');
  const view = state.stickerPreferences.view;

  // The chrome and the grid carry separate signatures. Toggling one favorite
  // changes a toolbar count and a shelf, both cheap; re-serialising a library
  // at the 2400 cap to show it is not, and the split is what stops that.
  const signature = [
    view,
    state.stickerPreferences.activeGroup,
    String(showHidden),
    query,
    String(visible.length),
    String(allVisible.length),
    quickFavorites.map((descriptor) => descriptor.key).join(','),
    mostUsed.map((descriptor) => descriptor.key).join(','),
    recent.map((descriptor) => descriptor.key).join(','),
    String(unavailableCount),
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
    restoreStickerGridScroll(organizer, previousGridScrollTop);
    return;
  }
  chrome.dataset.kfStickerSignature = signature;
  const countLabel = `${visible.length} ${plural(visible.length, 'emote', 'emotes')}`;
  const unavailableLabel = unavailableCount
    ? `<span data-kf-sticker-locked>${unavailableCount} locked by Kick</span>`
    : '';
  const quickShelf = quickFavorites.length
    ? `<div data-kf-sticker-quick-grid role="group" aria-label="Three-row one-click favorite emotes">${quickFavorites.map(stickerQuickProxyMarkup).join('')}</div>`
    : '<div data-kf-sticker-quick-empty>Favorite emotes with ☆ to fill up to three rows of one-click shortcuts.</div>';
  const usageShelf = (entries, label, hint) => (entries.length
    ? `<section data-kf-sticker-usage-shelf="${label.toLowerCase().replace(/\s+/g, '-')}">
      <div data-kf-sticker-quick-header><strong>${escapeHtml(label)}</strong><span>${escapeHtml(hint)}</span></div>
      <div data-kf-sticker-quick-grid role="group" aria-label="${escapeHtml(label)} emotes">${entries.map(stickerQuickProxyMarkup).join('')}</div>
    </section>`
    : '');
  const customGroups = state.stickerPreferences.groups.map((group) => {
    const count = allVisible.filter((descriptor) => state.stickerPreferences.assignments.get(descriptor.key) === group.id).length;
    const active = view === 'group' && state.stickerPreferences.activeGroup === group.id;
    return `<button type="button" data-kf-sticker-view="group" data-kf-sticker-group="${escapeHtml(group.id)}" data-active="${active}" aria-pressed="${active}">${escapeHtml(group.name)} (${count})</button>`;
  }).join('');
  const firstGroup = state.stickerPreferences.groups[0];
  const groupsTab = firstGroup
    ? `<button type="button" data-kf-sticker-view="group" data-kf-sticker-group="${escapeHtml(state.stickerPreferences.activeGroup || firstGroup.id)}" data-active="${view === 'group'}" aria-pressed="${view === 'group'}">Groups</button>`
    : '<button type="button" data-kf-sticker-manage="true">Groups</button>';
  chrome.innerHTML = trustedHTML(`
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
    ${usageShelf(mostUsed, 'Most used', `top ${mostUsed.length} you send`)}
    ${usageShelf(recent, 'Recent', 'newest first')}
    <div data-kf-sticker-secondary-actions><button type="button" data-kf-sticker-reset="true">Reset changes</button></div>`);
  renderStickerGrid(gridHost, visible, view);
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
    setStickerGridHost(gridHost, 'native', '<div data-kf-sticker-empty>Kick’s native emote groups are shown below.</div>');
    return;
  }
  if (!visible.length) {
    const message = view === 'pinned' ? 'Favorite emotes here to build your shelf.'
      : view === 'group' ? 'No available emotes are assigned to this group.'
        : 'No emotes match this search.';
    setStickerGridHost(gridHost, `empty:${view}`, `<div data-kf-sticker-empty>${message}</div>`);
    return;
  }
  const grid = gridHost.querySelector('[data-kf-sticker-grid]');
  const columns = stickerGridColumns(grid);
  const slice = visibleWindow(visible, state.runtime.stickerGridAnchor);
  const signature = [view, String(visible.length), String(columns), String(slice.start), String(slice.end),
    slice.items.map((descriptor) => descriptor.key).join(',')].join('');
  if (gridHost.dataset.kfStickerGridSignature === signature) {
    // Same tiles, possibly different state on one of them.
    patchStickerTileStates(gridHost);
    return;
  }
  const scrollTop = Number.isFinite(grid?.scrollTop) ? grid.scrollTop : null;
  gridHost.dataset.kfStickerGridSignature = signature;
  gridHost.dataset.kfStickerWindow = `${slice.start}-${slice.end}`;
  gridHost.innerHTML = trustedHTML(`<div data-kf-sticker-grid data-kf-sticker-total="${visible.length}">${
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
  gridHost.innerHTML = trustedHTML(markup);
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
    const name = tile.querySelector('img')?.getAttribute('alt') || 'emote';
    const pin = tile.querySelector('[data-kf-sticker-action="pin"]');
    if (pin) {
      pin.setAttribute('aria-pressed', String(pinned));
      pin.textContent = pinned ? '★' : '☆';
      pin.setAttribute('aria-label', `${pinned ? 'Remove favorite' : 'Favorite'} ${name}`);
      pin.title = pinned ? 'Remove favorite' : 'Favorite';
    }
    const hide = tile.querySelector('[data-kf-sticker-action="hide"]');
    if (hide) {
      hide.textContent = hidden ? '↶' : '×';
      hide.setAttribute('aria-label', `${hidden ? 'Restore' : 'Remove'} ${name}`);
      hide.title = hidden ? 'Restore' : 'Remove';
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
  // Straight to the organizer rather than through the apply cycle: a toggle
  // changes the chrome and one tile, and renderStickerOrganizer now patches
  // that tile in place instead of re-serialising the whole window.
  renderStickerOrganizer();
  scheduleApply(0);
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
      showToast(`The emote was removed, but Kick could not unfollow ${unfollowSlug}.`, true);
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
        showToast(`Saved ${sticker.name}, but Kick did not identify the follow-gated source channel.`, true);
        return;
      }
      showToast(`Saved ${sticker.name}. Following ${follow.slug}…`);
      const result = await mutateKickChannelFollow(follow.slug, 'POST');
      if (!result.ok) {
        showToast(`Saved ${sticker.name} locally, but Kick could not follow ${follow.slug} (${result.status}). Sign in or reload the channel and try again.`, true);
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
    showToast('The emote could not be saved.', true);
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
  for (const node of messages.querySelectorAll?.('[data-index], [data-message-id], .group') || []) {
    const text = node.textContent || '';
    const hit = keywords.length > 0 && findKeywordSpans(text, keywords, 1).length > 0;
    node.dataset.kfHighlighted = String(hit);
    if (hit && registry && ranges.length < KEYWORD_RANGE_LIMIT) collectKeywordRanges(node, keywords, ranges);
  }
  if (!registry) return;
  try {
    if (ranges.length) registry.set(KEYWORD_HIGHLIGHT_NAME, new Highlight(...ranges));
    else registry.delete(KEYWORD_HIGHLIGHT_NAME);
  } catch (error) {
    logAppError('keyword highlight', error);
  }
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
  // interleave writes to the same DOM. The pending timer reschedules anyway.
  if (state.runtime.suspended || state.runtime.applyRunning) return;
  state.runtime.applyRunning = true;
  let elapsed = 0;
  let started = performance.now();
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
    ensureSiteStyle();
    applySettingsAttributes();
    tagChatPanel();
    tagMonetizationSurfaces();
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

    const resume = yieldToInput();
    if (resume) {
      elapsed += performance.now() - started;
      await resume;
      // The panic switch, a route change, or a teardown can all land during the
      // yield. Re-read rather than trusting what was true a task ago.
      if (state.runtime.suspended) return;
      started = performance.now();
    }

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
  } finally {
    state.runtime.applyRunning = false;
    state.diagnostics.apply = recordApplyCost(state.diagnostics.apply, elapsed + (performance.now() - started));
    updateApplyCostInPlace();
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
  state.observers.document = new MutationObserver(() => scheduleApply(80));
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
    --surface-0: var(--kf-canvas, #070908);
    --surface-1: var(--kf-panel, #101311);
    --surface-2: var(--kf-panel-raised, #151917);
    --surface-3: var(--kf-panel-high, #1c211e);
    --surface-inset: #0b0e0c;
    --surface-hover: #202621;
    --surface-selected: #182019;
    --surface-danger: #2a1416;
    --border: var(--kf-border, #353b37);
    --border-subtle: #29302b;
    --border-control: #48524b;
    --border-strong: var(--kf-border-strong, #59645c);
    --text: var(--kf-text, #f4f7f5);
    --text-secondary: #c7cec9;
    --muted: var(--kf-text-muted, #a5aea8);
    --subtle: #7f8882;
    --on-accent: #071004;
    --danger: #ff6258;
    --danger-text: #ffaaa4;
    --warning: #f6b943;
    --success: var(--accent);
    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 10px;
    --radius: var(--kf-radius, 10px);
    --shadow-dialog: 0 42px 120px rgba(0,0,0,.78);
    --shadow-control: 0 10px 28px rgba(0,0,0,.28);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.45;
  }

  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }
  button, input, select, textarea { font: inherit; }
  button { color: inherit; }
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
    box-shadow: var(--shadow-dialog);
    color: var(--text);
    font-size: calc(14px * var(--kf-interface-scale, 1));
  }

  .kf-header {
    display: grid;
    grid-template-columns: 252px 1fr auto auto;
    align-items: center;
    gap: 24px;
    padding: 0 24px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-2);
  }
  .kf-brand { display: flex; align-items: center; gap: 9px; min-width: 0; font-size: 16px; font-weight: 820; letter-spacing: -.02em; }
  .kf-brand-mark { width: 28px; height: 28px; display: block; object-fit: contain; }
  .kf-badge { padding: 2px 6px; border: 1px solid rgba(var(--accent-rgb), .68); border-radius: 3px; color: var(--accent); font-size: 9px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
  .kf-title { font-size: 15px; font-weight: 760; }
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

  .kf-body { min-height: 0; display: grid; grid-template-columns: 252px minmax(0, 1fr); }
  .kf-nav { padding: 18px 10px; border-right: 1px solid var(--border); background: var(--surface-0); }
  .kf-nav button {
    position: relative;
    width: 100%;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    align-items: center;
    gap: 13px;
    min-height: 62px;
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

  .kf-page { min-width: 0; overflow-x: hidden; overflow-y: auto; padding: 26px 34px 40px 38px; scrollbar-color: var(--border-control) transparent; scrollbar-width: thin; }
  .kf-page:focus { outline: 0; }
  .kf-page-header { min-height: 90px; display: flex; align-items: center; justify-content: space-between; gap: 28px; padding-bottom: 22px; border-bottom: 1px solid var(--border); }
  .kf-page-header h2 { margin: 2px 0 5px; font-size: 28px; line-height: 1.08; letter-spacing: -.035em; }
  .kf-page-header p { max-width: 560px; margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
  .kf-eyebrow { display: block; color: var(--accent); font-size: 10px; font-weight: 850; letter-spacing: .12em; text-transform: uppercase; }
  .kf-page-meta { display: grid; gap: 3px; min-width: 140px; text-align: right; }
  .kf-page-meta span { color: var(--subtle); font-size: 10px; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
  .kf-page-meta strong { color: var(--text-secondary); font-size: 12px; font-weight: 740; }
  .kf-page-meta-control { min-width: 118px; justify-items: end; }

  .kf-panel { border: 0; border-radius: 0; background: transparent; overflow: visible; }
  .kf-row {
    min-height: 82px;
    display: grid;
    grid-template-columns: minmax(230px, 1fr) minmax(300px, auto);
    align-items: center;
    gap: 26px;
    padding: 14px 0;
    border-bottom: 1px solid var(--border-subtle);
  }
  .kf-row h3 { margin: 0 0 4px; color: var(--text); font-size: 13px; font-weight: 780; letter-spacing: .01em; }
  .kf-row p { max-width: 420px; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
  .kf-row-wide { grid-template-columns: minmax(210px, .82fr) minmax(340px, 1.18fr); }
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
  .kf-text:focus, .kf-textarea:focus { border-color: var(--accent); outline: 0; box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15); }
  .kf-select { min-width: 118px; height: 36px; padding: 0 28px 0 10px; border: 1px solid var(--border-control); border-radius: var(--radius-md); background: var(--surface-inset); color: var(--text); font-size: 12px; }
  .kf-select:hover { border-color: var(--border-strong); }
  .kf-select:focus { border-color: var(--accent); outline: 0; box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15); }

  .kf-theme-grid, .kf-swatch-grid { display: grid; grid-template-columns: repeat(4, minmax(76px, 1fr)); gap: 8px; }
  .kf-theme-grid { grid-template-columns: repeat(3, minmax(104px, 1fr)); }
  .kf-choice-card {
    min-height: 86px;
    padding: 11px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    cursor: pointer;
    text-align: left;
  }
  .kf-choice-card:hover { border-color: var(--border-strong); background: var(--surface-hover); transform: translateY(-1px); box-shadow: var(--shadow-control); }
  .kf-choice-card:active { transform: translateY(0); box-shadow: none; }
  .kf-choice-card[aria-pressed="true"] { border-color: var(--accent); background: var(--surface-selected); box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), .18); }
  .kf-choice-card strong { display: block; margin-top: 8px; font-size: 11px; }
  .kf-theme-sample { height: 34px; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 0 8px; border: 1px solid #303632; border-radius: 2px; background: #171b18; color: #9ca59f; font-size: 8px; letter-spacing: .06em; text-transform: uppercase; }
  .kf-choice-card[data-value="oled"] .kf-theme-sample { border-color: #292e30; background: #000; }
  .kf-choice-card[data-value="slate"] .kf-theme-sample { border-color: #4a5660; background: #1b211f; }
  .kf-theme-sample b { color: var(--accent); font-size: 8px; }
  .kf-swatch { width: 28px; height: 28px; border-radius: 3px; border: 1px solid rgba(255,255,255,.24); }
  .kf-swatch[data-color="kick"] { background: #7cff2b; }
  .kf-swatch[data-color="cyan"] { background: #38d7d0; }
  .kf-swatch[data-color="violet"] { background: #9667ff; }
  .kf-swatch[data-color="gold"] { background: #ffbe2e; }

  .kf-appearance-layout { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(260px, .85fr); gap: 22px; }
  .kf-appearance-controls { min-width: 0; }
  .kf-appearance-controls .kf-row, .kf-appearance-controls .kf-row-wide { min-height: 0; grid-template-columns: 1fr; gap: 8px; padding: 11px 0; }
  .kf-appearance-controls .kf-row:has(.kf-control) { min-height: 64px; grid-template-columns: minmax(160px, 1fr) minmax(190px, auto); align-items: center; gap: 12px; }
  .kf-appearance-controls .kf-row:has(.kf-control) p { max-width: 200px; }
  .kf-appearance-controls .kf-control { width: 190px; min-width: 0; justify-content: flex-end; }
  .kf-appearance-controls .kf-segmented { width: 100%; }
  .kf-appearance-controls .kf-segmented button { min-width: 0; flex: 1; padding-inline: 8px; }
  .kf-appearance-controls .kf-range { grid-template-columns: 38px minmax(90px, 1fr) 34px; gap: 6px; }
  .kf-appearance-controls .kf-choice-card { min-height: 64px; padding: 8px; }
  .kf-appearance-controls .kf-theme-sample { height: 25px; padding-inline: 6px; }
  .kf-appearance-controls .kf-choice-card strong { margin-top: 6px; font-size: 11px; }

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
  .kf-content-section .kf-subsection-header { margin-bottom: 0; padding-bottom: 9px; }
  [data-kf-current-page="content"] .kf-row { min-height: 64px; padding: 10px 0; }
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
  .kf-channel-entry { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 10px; border: 1px solid var(--border-subtle); border-radius: 4px; background: #0a0d0b; font-size: 13px; }
  .kf-channel-entry span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .kf-sticker-library-shell { padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-inset); }
  .kf-sticker-library-controls { display: grid; grid-template-columns: minmax(220px, 1fr) 180px; gap: 9px; }
  .kf-sticker-library-controls .kf-select { width: 100%; height: 40px; }
  .kf-sticker-group-builder { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 9px; margin-top: 9px; }
  .kf-sticker-group-list { display: grid; gap: 7px; margin-top: 10px; }
  .kf-sticker-group-row { display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; gap: 7px; align-items: center; }
  .kf-sticker-group-row .kf-text { min-height: 34px; padding-block: 6px; }
  .kf-sticker-library-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 13px 0 8px; color: var(--muted); font-size: 10px; }
  .kf-sticker-library-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 470px; overflow: auto; padding-right: 4px; scrollbar-gutter: stable; }
  /* The library scrolls inside a fixed height, so most of its cards are off
     screen at any moment. content-visibility lets the browser skip layout and
     paint for those entirely; contain-intrinsic-size supplies the height it
     would have had, so the scrollbar stays honest and does not jump as cards
     are rendered. Unsupported engines ignore both and render as before. */
  .kf-sticker-library-item { min-width: 0; display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 10px; padding: 9px; border: 1px solid var(--border-subtle); border-radius: 4px; background: #0a0d0b; content-visibility: auto; contain-intrinsic-size: auto 86px; }
  .kf-sticker-library-item[data-removed="true"] { opacity: .58; }
  .kf-sticker-library-image { width: 52px; height: 52px; display: grid; place-items: center; padding: 5px; border: 1px solid #343a36; border-radius: 4px; background: #151916; }
  .kf-sticker-library-image img { width: 100%; height: 100%; object-fit: contain; }
  .kf-sticker-library-copy { min-width: 0; }
  .kf-sticker-library-copy strong { display: block; overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .kf-sticker-library-copy small { display: block; overflow: hidden; margin-top: 2px; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
  .kf-sticker-access { display: inline-flex; margin-top: 5px; padding: 2px 5px; border: 1px solid #4b534e; border-radius: 3px; color: #b8c0bb; font-size: 8px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
  .kf-sticker-access[data-access="available"] { border-color: rgba(var(--accent-rgb), .55); color: var(--accent); }
  .kf-sticker-access[data-access="channel"] { border-color: rgba(255,190,46,.58); color: #ffcf61; }
  .kf-sticker-access[data-access="observed"] { border-color: rgba(56,215,208,.58); color: #70e9e3; }
  .kf-emote-catalog-browser { display: grid; gap: 8px; margin-bottom: 12px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); }
  .kf-emote-catalog-browser h4 { margin: 0; color: var(--text); font-size: 12px; }
  .kf-emote-catalog-browser p { margin: 0; color: var(--muted); font-size: 10px; line-height: 1.45; }
  .kf-emote-catalog-form { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; }
  .kf-emote-catalog-status[data-error="true"] { color: #ff8d86; }
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
  .kf-table th { color: var(--text-secondary); background: transparent; font-size: 10px; letter-spacing: .07em; text-transform: uppercase; }
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
  .kf-mini-card { padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-inset); }
  .kf-mini-card span { display: block; color: var(--muted); font-size: 9px; letter-spacing: .07em; text-transform: uppercase; }
  .kf-mini-card strong { display: block; margin-top: 4px; color: var(--accent); }
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
  .kf-button-small { min-height: 32px; padding-inline: 10px; font-size: 11px; }
  .kf-button .kf-icon { width: 16px; height: 16px; }
  .kf-button-group { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }

  .kf-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 22px; border-top: 1px solid var(--border); background: var(--surface-2); }
  .kf-footer-left, .kf-footer-right { display: flex; align-items: center; gap: 10px; }

  .kf-confirm {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    background: rgba(2,3,4,.76);
  }
  .kf-confirm-card { width: min(430px, calc(100vw - 32px)); padding: 24px; border: 1px solid var(--border-strong); border-radius: var(--radius-lg); background: var(--surface-2); box-shadow: var(--shadow-dialog); }
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
    background: var(--surface-0);
    color: var(--text);
  }
  .kf-ms-head, .kf-ms-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
    flex-wrap: wrap;
  }
  .kf-ms-foot { border-bottom: 0; border-top: 1px solid var(--border); }
  .kf-ms-spacer { flex: 1; }
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
  .kf-ms-head input:focus, .kf-ms-foot input:focus { border-color: var(--accent); outline: 0; box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .15); }
  .kf-ms-select { min-height: 32px; font-size: 12px; }
  .kf-ms-error { padding: 9px 14px; border-bottom: 1px solid var(--danger); background: var(--surface-danger); color: var(--danger-text); font-size: 12px; }
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
    border-radius: var(--radius-md);
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
  .kf-ms-chat { min-width: 0; border-left: 1px solid var(--border); display: grid; grid-template-rows: auto 1fr; }
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
  .kf-ms-empty { font-size: 11px; opacity: .6; }

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

  :is(button, input, select, textarea):focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

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
    .kf-control { width: 100%; }
    .kf-segmented { width: 100%; }
    .kf-segmented button { min-width: 0; flex: 1 1 0; padding-inline: 7px; }
    .kf-range { grid-template-columns: 42px minmax(120px, 1fr) 42px; }
    .kf-channel-input-row, .kf-emote-catalog-form { grid-template-columns: 1fr; }
    .kf-theme-grid, .kf-swatch-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .kf-appearance-layout { grid-template-columns: 1fr; }
    .kf-preview { position: static; padding: 18px 0 0; border-top: 1px solid var(--border); border-left: 0; }
    .kf-about-status, .kf-stats { grid-template-columns: 1fr; }
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
    'On': 'Activado',
    'Off': 'Desactivado',
    'Core protection always stays on': 'La protección principal permanece siempre activada',
    'About has no page settings to reset': 'Acerca de no tiene ajustes de página para restablecer',
    'Restore page defaults': 'Restaurar los valores predeterminados de la página',
    'Filter commands…': 'Filtrar comandos…',
    'Find a command': 'Buscar un comando',
    'Type an action or setting…': 'Escribe una acción o ajuste…',
    'Available commands': 'Comandos disponibles',
    'No matching commands': 'No hay comandos coincidentes',
    'Try “chat”, “layout”, “casino”, or “settings”.': 'Prueba “chat”, “diseño”, “casino” o “configuración”.',
    'command available': 'comando disponible',
    'commands available': 'comandos disponibles',
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
    'Read the full channel, global, and emoji sets without treating public artwork as account access. Falls back to the picker if the response changes shape.': 'Lee los conjuntos completos del canal, globales y de emojis sin tratar las imágenes públicas como acceso de la cuenta. Vuelve al selector si la respuesta cambia de forma.',
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
    'Poor mode': 'Modo sin gastos',
    'Hide Subscribe, Gift Subs/Dubs, Get KICKs, gift-shop controls, and spend-based leaderboards. Follow, chat, and free daily rewards stay available.': 'Oculta Suscribirse, Regalar subs/dubs, Obtener KICKs, la tienda de regalos y las clasificaciones de gasto. Seguir, el chat y las recompensas diarias gratuitas siguen disponibles.',
    'Enable Poor mode': 'Activar modo sin gastos',
    'Disable Poor mode': 'Desactivar modo sin gastos',
    'Remove spending prompts without changing your Kick account': 'Oculta las invitaciones de gasto sin cambiar tu cuenta de Kick',
    'Browse any channel’s emotes': 'Explorar los emotes de cualquier canal',
    'Paste a channel name or Kick URL. Artwork is public, but importing it never bypasses chat access: free emotes stay channel-only and subscriber emotes stay locked until Kick confirms your account can use them.': 'Pega un nombre de canal o una URL de Kick. Las imágenes son públicas, pero importarlas nunca evita el acceso del chat: los emotes gratuitos siguen siendo solo del canal y los de suscriptor permanecen bloqueados hasta que Kick confirme que tu cuenta puede usarlos.',
    'channel or kick.com URL': 'canal o URL de kick.com',
    'Channel emote catalog': 'Catálogo de emotes del canal',
    'Loading…': 'Cargando…',
    'Load emotes': 'Cargar emotes',
    'Open artwork': 'Abrir imagen',
    'Channel-only': 'Solo en el canal',
    'Subscriber-only': 'Solo para suscriptores',
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
    'Click chat emotes to save': 'Haz clic en los emotes del chat para guardarlos',
    'Click any emote in chat to add it to your favorites. If Kick explicitly marks it as follow-gated, the same click follows its source channel; subscriber access is never bypassed.': 'Haz clic en cualquier emote del chat para añadirlo a tus favoritos. Si Kick lo marca explícitamente como restringido a seguidores, el mismo clic sigue su canal de origen; el acceso de suscriptor nunca se omite.',
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
    'Your own multi-stream grid is back.': 'Tu propia cuadrícula de multitransmisión ha vuelto.',
    'Watch several Kick channels in one grid': 'Mira varios canales de Kick en una sola cuadrícula',
    'Freeze animated emotes': 'Congelar los emotes animados',
    'Read-only here. Kick blocks sending from an embedded chat; open the channel to talk.': 'Solo lectura aquí. Kick impide enviar desde un chat incrustado; abre el canal para hablar.',
    'Emote favorites, removals, and custom groups reset.': 'Se restablecieron los favoritos, las eliminaciones y los grupos personalizados de emotes.',
    'The emote could not be saved.': 'No se pudo guardar el emote.',
    'Open a channel page first.': 'Abre primero la página de un canal.',
    'Local channel tools saved.': 'Herramientas locales del canal guardadas.',
    'Local channel tools cleared.': 'Herramientas locales del canal borradas.',
    'Enter a custom emote group name.': 'Escribe un nombre para el grupo personalizado de emotes.',
    'That emote group already exists.': 'Ese grupo de emotes ya existe.',
    'Enter a valid emote group name.': 'Escribe un nombre de grupo de emotes válido.',
    'Layout saved.': 'Diseño guardado.',
    'That layout has no usable channels.': 'Ese diseño no tiene canales utilizables.',
    'Could not reach the clipboard.': 'No se pudo acceder al portapapeles.',
    'Cached blocklist removed.': 'Se eliminó la lista de bloqueo almacenada en caché.',
    'Enter a channel name or URL.': 'Escribe un nombre de canal o una URL.',
    'That does not look like a Kick channel.': 'Eso no parece un canal de Kick.',
    'That channel is already hidden.': 'Ese canal ya está oculto.',
    'Hidden channel list is full (200).': 'La lista de canales ocultos está llena (200).',
    'Favorites cleared.': 'Favoritos borrados.',
    'Not-interested channels restored.': 'Se restauraron los canales marcados como no interesantes.',
    'Could not export settings.': 'No se pudo exportar la configuración.',
    'Could not read that settings file.': 'No se pudo leer ese archivo de configuración.',
    'No import to undo.': 'No hay ninguna importación que deshacer.',
    'The backup could not be restored.': 'No se pudo restaurar la copia de seguridad.',
    'Import undone — your previous settings are back.': 'Importación deshecha: tu configuración anterior está de vuelta.',
    'Kick Focus restored.': 'Kick Focus restaurado.',
    'Kick Focus paused. Use the Resume button or Ctrl+Shift+F to restore.': 'Kick Focus en pausa. Usa el botón Reanudar o Ctrl+Mayús+F para restaurarlo.',
    'Emote changes reset': 'Cambios de emotes restablecidos',
    'Settings reset': 'Configuración restablecida',
    'Kick Focus restored': 'Kick Focus restaurado',
    'Give this stream the audio and chat': 'Dar a esta transmisión el audio y el chat',
    'Remove': 'Quitar',
    'Copy link': 'Copiar enlace',
    'Delete': 'Eliminar',
    'Clear search': 'Borrar la búsqueda',
    'Reward activity': 'Actividad de recompensas',
    'How drops work': 'Cómo funcionan los drops',
    'Move earlier': 'Mover antes',
    'Move later': 'Mover después',
    'Remove from quick favorites': 'Quitar de los favoritos rápidos',
    'Three-row one-click favorite emotes': 'Emotes favoritos de un clic en tres filas',
    'Emote views and filters': 'Vistas y filtros de emotes',
    'Kick Focus command menu': 'Menú de comandos de Kick Focus',
    'Kick Focus multi-stream': 'Multitransmisión de Kick Focus',
    'Add a channel or paste a kick.com link…': 'Añade un canal o pega un enlace de kick.com…',
    'Which chat to show': 'Qué chat mostrar',
    'Name this layout…': 'Ponle nombre a este diseño…',
    'Live style preview': 'Vista previa del estilo en vivo',
    'release, giveaway, raid': 'estreno, sorteo, raid',
    'Chat keywords for this channel': 'Palabras clave del chat para este canal',
    'Why I follow this channel…': 'Por qué sigo este canal…',
    'Private channel note': 'Nota privada del canal',
    'Optional blocklist URL': 'URL de lista de bloqueo opcional',
    'Search recorded emotes or Kick groups': 'Buscar emotes registrados o grupos de Kick',
    'Search recorded emotes': 'Buscar emotes registrados',
    'Filter recorded emotes': 'Filtrar emotes registrados',
    'New custom group name': 'Nombre del nuevo grupo personalizado',
    'New emote group name': 'Nombre del nuevo grupo de emotes',
    'Channel name or kick.com URL': 'Nombre del canal o URL de kick.com',
    'Channel to hide': 'Canal que ocultar',
    'Open Kick Focus multi-stream': 'Abrir la multitransmisión de Kick Focus',
    'Multi-stream': 'Multitransmisión',
    'Add this channel to Kick Focus multi-stream': 'Añadir este canal a la multitransmisión de Kick Focus',
    'Add to multi-stream': 'Añadir a la multitransmisión',
    'Undo': 'Deshacer',
    'View': 'Ver',
    'Enable optional blocklist subscription': 'Activar la suscripción opcional a la lista de bloqueo',
    'Core ad protection is on': 'La protección principal contra anuncios está activada',
    'Suppress promoted cards': 'Ocultar las tarjetas promocionadas',
    'Hide Slots and Casino content': 'Ocultar el contenido de Slots y Casino',
    'Your inventory holds {copies} {copiesWord} across {distinct} distinct {distinctWord} — {duplicates} {duplicatesWord}, or {rate}% of what you have pulled.': 'Tu inventario tiene {copies} {copiesWord} repartidos en {distinct} {distinctWord} distintos: {duplicates} {duplicatesWord}, es decir, el {rate}% de lo que has conseguido.',
    'Your inventory holds {distinct} distinct {distinctWord}. Kick’s response carries no per-item quantity, so a duplicate rate cannot be measured from it — that number is unavailable rather than zero.': 'Tu inventario tiene {distinct} {distinctWord} distintos. La respuesta de Kick no incluye la cantidad por artículo, así que no se puede medir una tasa de duplicados a partir de ella: ese número no está disponible, no es cero.',
    'emote name shadowed.': 'nombre de emote duplicado.',
    'emote names shadowed.': 'nombres de emote duplicados.',
    'result loaded': 'resultado cargado',
    'results loaded': 'resultados cargados',
    'emote': 'emote',
    'emotes': 'emotes',
    'emote is kept out of the library.': 'emote se mantiene fuera de la biblioteca.',
    'emotes are kept out of the library.': 'emotes se mantienen fuera de la biblioteca.',
    'collectible': 'coleccionable',
    'collectibles': 'coleccionables',
    'item': 'artículo',
    'items': 'artículos',
    'duplicate': 'duplicado',
    'duplicates': 'duplicados',
    'recorded emote has been changed by Kick since first capture — see the Changed by Kick filter in the library below.': 'emote registrado ha sido modificado por Kick desde su primera captura: consulta el filtro Modificados por Kick en la biblioteca de abajo.',
    'recorded emotes have been changed by Kick since first capture — see the Changed by Kick filter in the library below.': 'emotes registrados han sido modificados por Kick desde su primera captura: consulta el filtro Modificados por Kick en la biblioteca de abajo.',
    'channel hidden. These count toward the fail-open ceiling.': 'canal oculto. Cuenta para el límite de seguridad.',
    'channels hidden. These count toward the fail-open ceiling.': 'canales ocultos. Cuentan para el límite de seguridad.',
    'channel': 'canal',
    'channels': 'canales',
    'Add open tabs ({count})': 'Añadir pestañas abiertas ({count})',
    'Added {count} from your other tabs — {total} of {max}': 'Se añadieron {count} de tus otras pestañas: {total} de {max}',
    'Added {count} channels from your other tabs.': 'Se añadieron {count} canales de tus otras pestañas.',
    'Apply cycle cost': 'Coste del ciclo de aplicación',
    'No apply cycle has run yet.': 'Aún no se ha ejecutado ningún ciclo de aplicación.',
    'Type an emote name into chat': 'Escribir el nombre de un emote en el chat',
    'Adds a Type in chat action beside Copy name in the emote library. It types the plain name at your cursor and stops — never the wire token, never an id, and it never sends the message.': 'Añade una acción Escribir en el chat junto a Copiar nombre en la biblioteca de emotes. Escribe solo el nombre en la posición del cursor y se detiene ahí: nunca el código interno, nunca un id, y nunca envía el mensaje.',
    'That emote has no plain name to copy.': 'Ese emote no tiene un nombre simple que copiar.',
    'That emote has no plain name to type.': 'Ese emote no tiene un nombre simple que escribir.',
    'Open a channel chat first.': 'Abre primero el chat de un canal.',
    'Kick’s chat box did not accept the text. The name is on your clipboard instead.': 'El cuadro de chat de Kick no aceptó el texto. El nombre está en tu portapapeles.',
    'Seen available': 'Visto como disponible',
    'Seen in chat': 'Visto en el chat',
    'Click to save': 'Haz clic para guardar',
    'Saved — click to open in the library': 'Guardado: haz clic para abrirlo en la biblioteca',
    'Name shadowed by another set': 'Nombre eclipsado por otro conjunto',
    'No streams yet — add a channel to start.': 'Aún no hay transmisiones: añade un canal para empezar.',
    '{count} of {max} streams': '{count} de {max} transmisiones',
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
    'On': 'Ativado',
    'Off': 'Desativado',
    'Core protection always stays on': 'A proteção principal permanece sempre ativada',
    'About has no page settings to reset': 'Sobre não tem configurações de página para redefinir',
    'Restore page defaults': 'Restaurar os padrões da página',
    'Filter commands…': 'Filtrar comandos…',
    'Find a command': 'Buscar um comando',
    'Type an action or setting…': 'Digite uma ação ou configuração…',
    'Available commands': 'Comandos disponíveis',
    'No matching commands': 'Nenhum comando correspondente',
    'Try “chat”, “layout”, “casino”, or “settings”.': 'Tente “chat”, “layout”, “cassino” ou “configurações”.',
    'command available': 'comando disponível',
    'commands available': 'comandos disponíveis',
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
    'Read the full channel, global, and emoji sets without treating public artwork as account access. Falls back to the picker if the response changes shape.': 'Lê os conjuntos completos do canal, globais e de emojis sem tratar imagens públicas como acesso da conta. Volta ao seletor se a resposta mudar de formato.',
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
    'Poor mode': 'Modo sem gastos',
    'Hide Subscribe, Gift Subs/Dubs, Get KICKs, gift-shop controls, and spend-based leaderboards. Follow, chat, and free daily rewards stay available.': 'Oculta Inscrever-se, Presentear subs/dubs, Obter KICKs, a loja de presentes e os placares de gastos. Seguir, o chat e as recompensas diárias gratuitas continuam disponíveis.',
    'Enable Poor mode': 'Ativar modo sem gastos',
    'Disable Poor mode': 'Desativar modo sem gastos',
    'Remove spending prompts without changing your Kick account': 'Oculta os convites de gasto sem alterar sua conta do Kick',
    'Browse any channel’s emotes': 'Explorar os emotes de qualquer canal',
    'Paste a channel name or Kick URL. Artwork is public, but importing it never bypasses chat access: free emotes stay channel-only and subscriber emotes stay locked until Kick confirms your account can use them.': 'Cole um nome de canal ou uma URL do Kick. As imagens são públicas, mas importá-las nunca contorna o acesso do chat: os emotes gratuitos continuam restritos ao canal e os de assinante permanecem bloqueados até o Kick confirmar que sua conta pode usá-los.',
    'channel or kick.com URL': 'canal ou URL do kick.com',
    'Channel emote catalog': 'Catálogo de emotes do canal',
    'Loading…': 'Carregando…',
    'Load emotes': 'Carregar emotes',
    'Open artwork': 'Abrir imagem',
    'Channel-only': 'Somente no canal',
    'Subscriber-only': 'Somente para assinantes',
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
    'Click chat emotes to save': 'Clique nos emotes do chat para salvar',
    'Click any emote in chat to add it to your favorites. If Kick explicitly marks it as follow-gated, the same click follows its source channel; subscriber access is never bypassed.': 'Clique em qualquer emote do chat para adicioná-lo aos favoritos. Se o Kick o marcar explicitamente como restrito a seguidores, o mesmo clique segue o canal de origem; o acesso de assinante nunca é contornado.',
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
    'Your own multi-stream grid is back.': 'A sua própria grade de multitransmissão voltou.',
    'Watch several Kick channels in one grid': 'Assista a vários canais do Kick em uma única grade',
    'Read-only here. Kick blocks sending from an embedded chat; open the channel to talk.': 'Somente leitura aqui. O Kick impede o envio a partir de um chat incorporado; abra o canal para falar.',
    'Emote favorites, removals, and custom groups reset.': 'Favoritos, remoções e grupos personalizados de emotes redefinidos.',
    'The emote could not be saved.': 'Não foi possível salvar o emote.',
    'Open a channel page first.': 'Abra primeiro a página de um canal.',
    'Local channel tools saved.': 'Ferramentas locais do canal salvas.',
    'Local channel tools cleared.': 'Ferramentas locais do canal limpas.',
    'Enter a custom emote group name.': 'Digite um nome para o grupo personalizado de emotes.',
    'That emote group already exists.': 'Esse grupo de emotes já existe.',
    'Enter a valid emote group name.': 'Digite um nome de grupo de emotes válido.',
    'Layout saved.': 'Layout salvo.',
    'That layout has no usable channels.': 'Esse layout não tem canais utilizáveis.',
    'Could not reach the clipboard.': 'Não foi possível acessar a área de transferência.',
    'Cached blocklist removed.': 'Lista de bloqueio em cache removida.',
    'Enter a channel name or URL.': 'Digite um nome de canal ou uma URL.',
    'That does not look like a Kick channel.': 'Isso não parece um canal do Kick.',
    'That channel is already hidden.': 'Esse canal já está oculto.',
    'Hidden channel list is full (200).': 'A lista de canais ocultos está cheia (200).',
    'Favorites cleared.': 'Favoritos limpos.',
    'Not-interested channels restored.': 'Canais marcados como sem interesse restaurados.',
    'Could not export settings.': 'Não foi possível exportar as configurações.',
    'Could not read that settings file.': 'Não foi possível ler esse arquivo de configurações.',
    'No import to undo.': 'Não há importação para desfazer.',
    'The backup could not be restored.': 'Não foi possível restaurar o backup.',
    'Import undone — your previous settings are back.': 'Importação desfeita: suas configurações anteriores voltaram.',
    'Kick Focus restored.': 'Kick Focus restaurado.',
    'Kick Focus paused. Use the Resume button or Ctrl+Shift+F to restore.': 'Kick Focus pausado. Use o botão Retomar ou Ctrl+Shift+F para restaurar.',
    'Emote changes reset': 'Alterações de emotes redefinidas',
    'Settings reset': 'Configurações redefinidas',
    'Kick Focus restored': 'Kick Focus restaurado',
    'Give this stream the audio and chat': 'Dar a esta transmissão o áudio e o chat',
    'Remove': 'Remover',
    'Copy link': 'Copiar link',
    'Delete': 'Excluir',
    'Clear search': 'Limpar a busca',
    'Reward activity': 'Atividade de recompensas',
    'How drops work': 'Como os drops funcionam',
    'Move earlier': 'Mover para antes',
    'Move later': 'Mover para depois',
    'Remove from quick favorites': 'Remover dos favoritos rápidos',
    'Three-row one-click favorite emotes': 'Emotes favoritos de um clique em três linhas',
    'Emote views and filters': 'Visualizações e filtros de emotes',
    'Kick Focus command menu': 'Menu de comandos do Kick Focus',
    'Kick Focus multi-stream': 'Multitransmissão do Kick Focus',
    'Add a channel or paste a kick.com link…': 'Adicione um canal ou cole um link do kick.com…',
    'Which chat to show': 'Qual chat mostrar',
    'Name this layout…': 'Dê um nome a este layout…',
    'Live style preview': 'Prévia do estilo ao vivo',
    'release, giveaway, raid': 'lançamento, sorteio, raid',
    'Chat keywords for this channel': 'Palavras-chave do chat para este canal',
    'Why I follow this channel…': 'Por que eu sigo este canal…',
    'Private channel note': 'Nota privada do canal',
    'Optional blocklist URL': 'URL de lista de bloqueio opcional',
    'Search recorded emotes or Kick groups': 'Buscar emotes registrados ou grupos do Kick',
    'Search recorded emotes': 'Buscar emotes registrados',
    'Filter recorded emotes': 'Filtrar emotes registrados',
    'New custom group name': 'Nome do novo grupo personalizado',
    'New emote group name': 'Nome do novo grupo de emotes',
    'Channel name or kick.com URL': 'Nome do canal ou URL do kick.com',
    'Channel to hide': 'Canal a ocultar',
    'Open Kick Focus multi-stream': 'Abrir a multitransmissão do Kick Focus',
    'Multi-stream': 'Multitransmissão',
    'Add this channel to Kick Focus multi-stream': 'Adicionar este canal à multitransmissão do Kick Focus',
    'Add to multi-stream': 'Adicionar à multitransmissão',
    'Undo': 'Desfazer',
    'View': 'Ver',
    'Enable optional blocklist subscription': 'Ativar a assinatura opcional da lista de bloqueio',
    'Core ad protection is on': 'A proteção principal contra anúncios está ativada',
    'Suppress promoted cards': 'Ocultar os cards promovidos',
    'Hide Slots and Casino content': 'Ocultar o conteúdo de Slots e Cassino',
    'Your inventory holds {copies} {copiesWord} across {distinct} distinct {distinctWord} — {duplicates} {duplicatesWord}, or {rate}% of what you have pulled.': 'Seu inventário tem {copies} {copiesWord} distribuídos em {distinct} {distinctWord} distintos: {duplicates} {duplicatesWord}, ou seja, {rate}% do que você já obteve.',
    'Your inventory holds {distinct} distinct {distinctWord}. Kick’s response carries no per-item quantity, so a duplicate rate cannot be measured from it — that number is unavailable rather than zero.': 'Seu inventário tem {distinct} {distinctWord} distintos. A resposta do Kick não traz a quantidade por item, então não é possível medir uma taxa de duplicatas a partir dela: esse número está indisponível, não é zero.',
    'emote name shadowed.': 'nome de emote duplicado.',
    'emote names shadowed.': 'nomes de emote duplicados.',
    'result loaded': 'resultado carregado',
    'results loaded': 'resultados carregados',
    'emote': 'emote',
    'emotes': 'emotes',
    'emote is kept out of the library.': 'emote é mantido fora da biblioteca.',
    'emotes are kept out of the library.': 'emotes são mantidos fora da biblioteca.',
    'collectible': 'colecionável',
    'collectibles': 'colecionáveis',
    'item': 'item',
    'items': 'itens',
    'duplicate': 'duplicata',
    'duplicates': 'duplicatas',
    'recorded emote has been changed by Kick since first capture — see the Changed by Kick filter in the library below.': 'emote registrado foi alterado pelo Kick desde a primeira captura: veja o filtro Alterados pelo Kick na biblioteca abaixo.',
    'recorded emotes have been changed by Kick since first capture — see the Changed by Kick filter in the library below.': 'emotes registrados foram alterados pelo Kick desde a primeira captura: veja o filtro Alterados pelo Kick na biblioteca abaixo.',
    'channel hidden. These count toward the fail-open ceiling.': 'canal oculto. Ele conta para o limite de segurança.',
    'channels hidden. These count toward the fail-open ceiling.': 'canais ocultos. Eles contam para o limite de segurança.',
    'channel': 'canal',
    'channels': 'canais',
    'Add open tabs ({count})': 'Adicionar abas abertas ({count})',
    'Added {count} from your other tabs — {total} of {max}': 'Foram adicionados {count} das suas outras abas: {total} de {max}',
    'Added {count} channels from your other tabs.': 'Foram adicionados {count} canais das suas outras abas.',
    'Apply cycle cost': 'Custo do ciclo de aplicação',
    'No apply cycle has run yet.': 'Nenhum ciclo de aplicação foi executado ainda.',
    'Type an emote name into chat': 'Digitar o nome de um emote no chat',
    'Adds a Type in chat action beside Copy name in the emote library. It types the plain name at your cursor and stops — never the wire token, never an id, and it never sends the message.': 'Adiciona uma ação Digitar no chat ao lado de Copiar nome na biblioteca de emotes. Digita apenas o nome na posição do cursor e para por aí: nunca o código interno, nunca um id, e nunca envia a mensagem.',
    'That emote has no plain name to copy.': 'Esse emote não tem um nome simples para copiar.',
    'That emote has no plain name to type.': 'Esse emote não tem um nome simples para digitar.',
    'Open a channel chat first.': 'Abra primeiro o chat de um canal.',
    'Kick’s chat box did not accept the text. The name is on your clipboard instead.': 'A caixa de chat do Kick não aceitou o texto. O nome está na sua área de transferência.',
    'Seen available': 'Visto como disponível',
    'Seen in chat': 'Visto no chat',
    'Click to save': 'Clique para salvar',
    'Saved — click to open in the library': 'Salvo: clique para abrir na biblioteca',
    'Name shadowed by another set': 'Nome ofuscado por outro conjunto',
    'No streams yet — add a channel to start.': 'Ainda não há transmissões: adicione um canal para começar.',
    '{count} of {max} streams': '{count} de {max} transmissões',
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
  // Adopted after the markup lands: innerHTML replaces every child, which would
  // take the fallback <style> element with it if it were appended first.
  shadow.innerHTML = trustedHTML(`
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
        <div class="kf-command-head"><label for="kf-command-input">Find a command</label><input id="kf-command-input" data-kf-command-input type="search" autocomplete="off" placeholder="Type an action or setting…" aria-describedby="kf-command-count"><span id="kf-command-count" data-kf-command-count aria-live="polite" data-kf-no-translate></span></div>
        <div class="kf-command-list" data-kf-command-list role="listbox" aria-label="Available commands"></div>
      </section>
    </div>
    <div class="kf-backdrop kf-ms-backdrop" data-kf-multistream-backdrop hidden>
      <section class="kf-ms-shell" role="dialog" aria-modal="true" aria-label="Kick Focus multi-stream">
        <header class="kf-ms-head">
          <strong>Multi-stream</strong>
          <span class="kf-ms-count" data-kf-multistream-count data-kf-no-translate></span>
          <span class="kf-ms-spacer"></span>
          <label class="kf-sr-only" for="kf-ms-input">Add a Kick channel</label>
          <input id="kf-ms-input" data-kf-multistream-input type="search" autocomplete="off" placeholder="Add a channel or paste a kick.com link…">
          <button type="button" class="kf-button kf-button-primary kf-button-small" data-action="multistream-add">Add</button>
          <button type="button" class="kf-button kf-button-small" data-action="multistream-add-open-tabs" data-kf-presence-add hidden></button>
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
  document.addEventListener('click', rememberWatchedCard, true);
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

function selected(value, expected) {
  return String(value) === String(expected);
}

function segmented(path, current, choices) {
  const label = path.split('.').pop().replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase());
  return `<div class="kf-segmented" role="group" aria-label="${escapeHtml(label)}">${choices.map(([value, choiceLabel]) => `<button type="button" data-set="${path}" data-value="${escapeHtml(value)}" aria-pressed="${selected(current, value)}">${escapeHtml(choiceLabel)}</button>`).join('')}</div>`;
}

function toggle(path, current, options = {}) {
  const disabled = options.locked ? ' disabled' : '';
  const title = options.locked ? ' title="Core protection always stays on"' : '';
  return `<button type="button" class="kf-switch" role="switch" data-set="${path}" data-value="${!current}" aria-checked="${current}" aria-label="${escapeHtml(options.label || path)}"${title}${disabled}>${tr(current ? 'On' : 'Off')}</button>`;
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
  return `<div class="kf-page-header"><div><span class="kf-eyebrow">Kick Focus settings</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><div class="kf-page-meta"><span>${escapeHtml(metaLabel)}</span><strong>${escapeHtml(metaValue)}</strong></div></div>`;
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
    <div class="kf-page-header"><div><span class="kf-eyebrow">Kick Focus settings</span><h2>Appearance</h2><p>Set a premium visual style without replacing Kick’s identity.</p></div><div class="kf-page-meta kf-page-meta-control"><span>Language</span>${selectControl('appearance.language', value.language, [['auto','Auto'],['en','English'],['es','Español'],['pt','Português']], 'Interface language')}</div></div>
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
          <img class="kf-preview-image" src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGiEcFxgfGRQUHScdHyIjJSUlFhwpLCgkKyEkJST/2wBDAQYGBgkICREJCREkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCT/wAARCAEOAeADASIAAhEBAxEB/8QAHAAAAgMBAQEBAAAAAAAAAAAAAgMAAQQFBgcI/8QATxAAAQMCAwMIBgcEBwcCBwAAAQACAwQREiExBUFRBhMiMmFxgbEjM3KRocEUQlJic4LRJDRj8AclNUSSorIVFjZDU8LhRfEmVHSDo7PS/8QAGgEAAwEBAQEAAAAAAAAAAAAAAAECAwQFBv/EADMRAQEAAgEDAwEGBQMFAQAAAAABAhEDEiExBEFR8AUTMmFxkRQigaHBscLRFTNDUvHh/9oADAMBAAIRAxEAPwD8rybu5DuRy7u5CeqiBW5WdAoeqFD1QgIeqoeqFD1VD1QgIeqFDoFD1Ao7QICz1grHrFR6wRNF5rICoxcSdyYGfsZf98BSmZiE3Y0nzTwz+pi/+KB8CptVjHc5gQbR5NXt0iw/5wvS0r8O3uXQGV6Fw+AXnq52Gt5MO4Nj/wBQXZhkttzlpnbFRu8guHLvP6f7nfj2v9f9rt7EqLRf0fX0ZO//APYF7GknxU20je9tqNPxK+ebImws5E59Sd/+sL1VJX/s21Gg3P8AtFp+JXFzY/X9a7OHLt9fEVyocyWZgGp2tHf4L5fyiohg2pOBa1eWfAlfQtr1GOpiuf8A1SPLxC8htxofsvauWu1f+0rf0tuOmPqZ1beHmjMUr2HVuSXwXU2zT83tGuAHUkt8SuZwXqY3c28rKaulBRQKKkorVBXZARRRRARRRRARUrUQFKlapARWoBdGGZIBaiItshQEUUVhARQBWAiDUANlAEYaiDUAvCphTcKvAgFBtldkzAphQC7KWTMKhagy7KsKPLihLm8UEqyqyvGOCEu7EBFYCG5RNzCAqyiKyqyApUiVWQFKK7KrIBk2gQHqpk4yalnqBKHUPVCt3VCo9UK3dQJko9UKz1AqPUCs9QICHqBR3VaofVhR/Vb3IC3ddqZC29WGoSLSs8PNaIW/1kB3eSVqsYugbdtZ2Rn5poH/AMPu/GHzVbNHQr/w3fNW3/h5/wCMPms75/ZpPH7uvtEjn+ThGoaz/U1dGGU/7Z5VfepnD4Bciud09gHgG+bVsbJh2ryhP2oHA+4Ln12+vl0S/wA318Ols2bCzkrY9SZx/wAy7NPW4YtpNBsTXA/ErzOzpcuT+fVmP+oLaagsG0LH+9g/ErDPDd+vlvx56n18OxtKo/aoQNf9oRk+9ef2lKHbN2kNSdpg/BbNo1BZUg721THLkVsl6KuF9a1rvgnxY+C5MvLHt2MGt2077MrfNy4M8eCQjgAV6HbBxTbbPF7D8XLlV0Q+kTdkbT5Ls4r219ezi5Z339e7njcoNyu1sPco3d4rdgpuoRoWDMdyOyAAhCmISEAKtRRARRRUgIqVqDMoBkTLrQ2PJVTsuVsEXRU2rkc+RiSQtsrNVle3VOJsKRAKrZo2hMltCNrVRaQ3JRoPakZgbxsiGAakIGxjfb3oub7P8qWz0hewdqrnBuaVCLDf8AgIHZ77oDTFFzkePMXF7KCEEkZrTSxXp2eyFYj9I4W3qdr6WR8YEbrAggLLhPFy6U0XoJb2yG9c8NH3fAEpypsKI7veqITiOx3usluH8kqkhIVKz4b1SZIjjHRQJsQ6CAiqyOyqyABSyuylkANlVkdlVkAU+gQHqBHPoEB9X4pQ0d1Qrf1Gqn9VqKTqMTIJ6gUPUCjuoFHerCAh9WFbx0GKOHomopRaKPtCAN49PF4ea0xi217d3kkyi1TB+XzT25bZPePJRfDSL2d1Nofhn5q2/wDDz/xgh2f1a8fwz81TT/ULh/GCm+f2VPH7ttY7p7G7A3zatgfbam3L74T5BYavrbHvwHm1aHOw7Q2z2xEfALLXb6+Wsvf6+GqhdZmxDwlJ/wAy0yy9CvI31IPxKwUZtFsk3/5h/wBSdNJ0a0fxx5qLO/18tMb2+vho2tN6aTslY5c6qkxUtWBvqGn4Ju05Dzs9zoWFYpXkxVI3YwVWGPZOeXem7RdidtbO98B+LlkqwHTzn+C35J1aeltADeG+ZWeU3kl7YW/JaYz6/Zllfr92J0ecfsX+CWwdXuK2BlzH+Df4BJYzOPtYT8FrKxsKY3q+yVaZGz1f4ZPmgsqSFVZHZVZALIVIyEJCAFRWqQEVsFyhTIxmgNtK3Nbwzo6LHTblvaeissm2HhimZqscjV0ZgLFYZAqxqcmW3STWNQ26SexqpEU5vQ8VI2A/+yZILMz4hSIYsjY91z5KdqkHhIGeIeICA4d5afElaBFYZNP+ADzSZMr3JHfIB5JSrsKLeDT4M/VAQRfre8BGSCPqHxLlRadzTpuj/VNDr0TB9Gj7WhXzfpX5bwrox+zxE/ZCeQOcf7TR8Flb3bSdmKcBtPLrfTI2XLubZ38XhdaqH7NObXz4XXJA4A/ljV4oyAS37nvJQnPT4NTSHcJPeAlO7fi9XGYSDY9behP85oiBxb8Sq/nIJkH3LRTi8aTn26LRTD0em9AiFqGycQllqIAWVWR2VWTIFlLIsKqyAlQMmoD6vxTKnRqWfVDvSng75SXRquT1bFJhZrFJPVsTJTvVhRw9EO9W8eiao4egae39UBbx+zt70VR6iHu/RVIP2Vnf+qKp9RB3fokY5/3mD8vmnt/tg948kmb96g/L5pwP9cu/nco9lxdAMq/2HfNC3+wX/jBXQG3072HfNC3+w3/ihHv+xzx+7VVuz2T2AeYT5DfaO1r74z5BZal1zswcAPMJ7jev2r+GfILPXb6+Wm+/18G0r/Q7KF/+YfNMmdlW/jDzWaBxEWzOx5802Z3Rrj/FHmps7/XyqXt9fCbRfifUHsZ8lnl9VU94KbXH0lR7DD5JEulWPuNKvGdk5XulQbvq+2MHzSn+sPbCPkmSZvm7YQfNBrI3tgVRFAzMw/gn5IGN9Vb/AKRTom3+j/gn5IIm9GH8FycJKaPFzf8A9O8+aRhWyjHSit/8s5JDFWKKRhQ4VoLEJYqSQQUJCeWIC1AIIQ2TiEBCAAJsQzSwEyPVAbqc2Wxpy1WKHULUHWCzrXEEpvcLHJvWmQ6rM8pwqSB0wtLGpDR0x3rUwJ1MSUWive2Y32VQyM0xC/4hPkimB5rI7xw+aXHKxozdY9soHkpXPLSGBwvhHhE53mlOa4XsJB+RrfNUZ4yOlJEe973JZliN7GPwhJ8ylIdsRzjoSfGYDySyWEaxk97nIy+2nO/lia1QudmLT+LgFUS7FIP2WI6dAaJhIErx2t8lkhrYI6ZjHvOINtpfOyEbSgD3k4j1Tp2LPVaSzR1SD9GmzAz+1h+K4zi3fg/NKT5LdNtCOWOSLC4XvnluWEOdpjAzaMmDerxmkZXYOhuMXg0lSx3X8I1YLnNJ5x+QJy71TmdO2J5GIDM9ipCiHW+v8AhLTfMHfq5W1rThuL3HFVYWGQ0KZBtr1dOK1Ug9F4rOLWOQ6oWqkIMNrWt8UU4IhARmm4VRakZWFVhTcKrCjZaKsqITcKEhPY0XUDEG4c0DmkQjvTQFQKEdQJx0I/FVL6pidI0SsA0LdEuduGGNGzl2F/qWqPH7O3v/AFUf6hqj/wB3b3/qgxSfurO/9UVT+7wd36IZP3Vnf+qKp/d4O5KGKb95g/L5pw/tc/zuSZv3mD8vmntz2uf53JKiqL+++wfmqZ/Ycn4oV0Rt9N9g/NU3+xH/AIoS9xPBtRrs3uHmE4/vu0s/qHySaj/07w+Sa4/tu0fYPkpX9f2HCRzOzex581cz+jXfijzKTCfR0AP2z5q5TZlcP4o8ylrue+318GVx6dV+E35Jcv8Ae+2FqDasro5HlptiDGnK9xZJL5HY/S48bcJu3d4K8ceyMspK0uHTf204+aBnrIr74CliaUuJLGH0eDIkZcUcb3Dm5HxOwxxlhsQUdNLri4Bc0vbE5DDbDB+C5SCZjXU4dibzbHNccJ36KQljRADIzoxva7PQ7k9DcMohZ8PbTO80QYipGnFT4Re1O4HsN0ZY4DQjvCcTWdzLIC1aCEDmqks5agc1PLUDggMxCAhPIS3BAJRs1QkImhAaYjmLLTiyWaNOByUVpFPKzuzTXJLinCoW9cd61MWVnXHetbEURJgDFYi4ulMYwaMb7k2U9C3akjJIzbuG427AAhMnG/8AiCl77h/hVZjQfAJGFzxuI/xKicjmL2PaicT227CEBJzHS0P1k0hJ+fkhP1u4IiNdd/kht1u4JhN5/P5K/reLfJTefz+SoWxDvb5ICo+o7uP1u1ESA+/R6w39iGMXYcjodG9qPPF1XdbgBuQRbcJw5sy70O4ZjQ7kxgc4sDQ65OQvqumdiCia07TnMDyD6FgxPHtbgnCchuhufqha6L1Wu9OlpaFgDmzTNa4WGINJy7L3VQQxxM6E8b/eD8UWUSiLVWFOazEEQjUbaaZ8CrAtYhur5gpdSuliwFA5q3OgsNEiSOycqbGZotkUsNsSmR+kaeIS7Xcdy025lg8EVg9padELbHTRWchZTQp0bXxhgNiEM0ZZTNB4/qmtFkVg5pa7RTvSpkzSfukff+qKp/d4O5VKLUrOGL9VdT+7wdyqNBT/ALzD4eacP7WP87kmf94h8PNObltY/wA7kvY4Gi0rfYPzVt/sV/4gVUelZ7J+app/qd/4gQJ4NnP7h4fJNJvV7RI/6Z8kif8AuPh8k4ZVO0Af+mfJJU8iafQbO9s+aGb1dcf4o81GC8OzvbPmpN6raH4o8ylDK2sbvd+TyQtOAjOxtkVe1Ou/uZ5InMvE14tfIGyvHwx5PIoGtmks4kMa27neap0jJZSAC1t7AcArkIhiEW8nE8j4BZnG5yyCqTaIOS7XkaJZKvES2yFVDSw4BGyaWPqSyN7nFAogNAr6kCxlLvaaD5hEK+T60VO7vjt5ELKjDCcxog9tQqmOBxUzMt7XuHndOjpmTsc8Me1rRmQ8G3vCy08T5sQYMt5O4LSanmoyyIkM0tvJ3lTfyTcr7Fy0sbIucL5AN12g39x+SxOCbM6+WmiBw1QrHfuSQo3VEQhCDPjOSZfJJYUwHJSqKcUophKWUQKj6471qYVkYemO9amIoiS9TxShpqmynoJIzSMQIPE+Kqw4KKuebE4FwudQLXv70BTsNuqD4EoScsm8dyPnmSxAOwtkHeLjyQE5HIWzTLanb8uPkoT1u4KEDPx8lV+t4IC75n8yg6w72+SltfzKADF4t8kBGAc0b/ZPmjyDza3WPkpF6h3snzTXi8hv9o+SDjTsx7aKE1xA51nRhB3G2bvDd3rDLWyyOe9zy5zsiSUysfhhihv1WD45rCMyU8fksvhLI4wToUNwE6EXGQ1IF00x0KInm2h5zK6cNKXnILmxFriQwg4dbbl6jk22OrlbBKQH7u1cvNl0zbr4cZldEQ7Le7RpTTsh4HVX0nZnJIyMB5u/gtlTyRLIz0PgvNvrJvT0Z6Ts+Pz0JYDcLj1pEZLd69xythj2YTELGQ7huXg5wS4ucbld/p8uubcPPj0XTFGcJuFcoyuNCksdbenYgY811vOUBlYe9WC0a5lDcuGWTVbbaNF1JCDlJXGOIu3nJFYRsLis8svORAdt0TueM2kh/ZGd/wCqudwdBC0agZpZeSwN3BQAlWvZsrw+WNw+qB5pjZ2Cr+kPv3eCQGm4B3r0vJnlltDkuHU9NR7GqGuNyK3ZkFS7Pg6RpPhdTb8HL37vP08zI+fxE+kBAt4pjWf1dJEHtc8HHhF9N69nH/SttOfnee2HyPeADbFyfpR5NC89tLb8+0GVNU+h2VTGWwApKNkLQNDYNFh2pb/Jeu3lzZjcUXh8k/8AvVf+GfILNIb/AETsI+ScD+01v4Z8kwJrvQ7PH3z5qSutBtAHXnR5oQfRUHtnzVTH0dcP4o80pBtW0+u8a5M8k2F3NhmWoFvcqnZz1S9n8Np+CJrmmnZcuxNYA0fNVPhnnGeSwuGuvoCeKUjc3K4QLSJRRRRMIoNVEcQa51nA+CQU5tsrJkQaGuNzfRNhiDmEh5GWdhdSmhYQ9z7EAWF+KnZbNkf+yxtZZmIFxA92qzFxDm56J0kBwgtIIyGSRY3IOpRiUATcLRRSB8bmvZG92IhuKNp+JCQ5vRKZQxOlY8NuLPNzwVK9nQhhZJFJLLS0wijtciKxN9wsRcpMraWM5UtO64uLF4/7tUNTVYAyGIlrGZix+t9rvyWV0rnkucbuOp4pQptpDqbfRR+Erx80QNJ9ajd+WoI8wVkD1eNPUVutJZRO/u8ze6oB/wCxRlFTzOa1jJwXEAXlb/8AykNJPErqQsioYmVE8cshfGXRMIwNdqLknUXvpw3IskTlnYznYrGAPMhaL2s54vqb7tMljeGMle1hJa02ud601W0ZqpzXTSOfhAa0HQAbh2LE03c8/eKmzsfHb7rl6qW1HLfBkQM96SMX2mXUxqIvDWklKBcHYgbO1J4BRxJJuQQ05WHWKPmy2NxLxci5yQRbM3A2Ay3Jh0NhuO9BCBiF3EdHcLpha0NJ52TQ/UQIA7/HyV/a8EQgkcAbnPs7Ff0aU3z4IABqe5yg63i3yRmme0FxLiBe9tbJYGeYm1G5ANhHoHeyfNNcLvPtHyWVshYwgCQZfNEZHE29KTc+SNHKKtN5PAeSyt3p0pLmNOeljdIBsU8fCam9TEeJVkKgMkyWxxad69Nyd2rT7PYw1JLCHXDt4XnC27O1MY8SRgG+IHW6jPCZzVXx53C7j9Dclv6X+S9DSMbtWreToHMhcT4iybyh/pt5J1MDodl1EheRYPfC4e7JfnqZrhE06ArGXFrgQdM1wT7M4r33Xd/1HkntHsNu7fjrZ5HsLnlxuXO1K87LOXklJbWEn0gBHEJpDXi7SCF28fHMJqOPPkud3WJpTQ7oEIGx3T2Q9FXWFsUxjn66J+FsTblBzrIhbUrPPK6Q8Ap1amS0U03OMDR3pICvAQ3EmFo+jAgdK+fxVTs0kCRhZiOiKVuCGNwPXUd+6N7/ANVdR+7Q9yD0Ko9fD3DzTDntI/zuS6j10PcPNHf+sL/zogw0x9eOw/Nek5SU0cPIjktMxoa6aKqxkDNxFQQLrzVN/eO4/Neo5SPDuQPJQb2trG//AJwfmsuT8WP6/wCK04/w5fp/mPNSH917x8k29qmsH8M+STJpSntHyRk/tNV7B8lqzWD6Ki7HHzUkN2Vx/iDzQNN4qT2z5q5D0K32x5og21sP7c4/wW+SytPomHfYJuK1Y4/wm+SRH6tvcEYzvSy8RDwQ2RkKWWiAWVWTGsuDmjihdKcLW5lGwQoMjqmSQuju0tOSFrbC+SNg+ncbEEgBa6gMjwiNlhYY8t+9YGHmxj1cTl+q0CcvaGE249qixNE+MGJsjXXvlYZWSh6xpJvay30kMU8rIyXNL8sZPRB7Vkc0sLmuBBBI8RqiVMpMnRY8XsbK9nPDOe1vd3ccsh71HtxRuLuCzwvwuk9pVpc8LdqVV1ZzVYSqUsFNgi554bzjWdrknCbaZKNcWpE2mB7ZHc05z2udgYQD07Z3+fZdMkqHTRMa8HWwN8rJuxNsybNe+8cU0RY70UguLkWuDuP6K/osVTGJYXuc6MEvhFrht9WgnPtCzt1e7HK6vdzWi4z70AIDnbhfemPOoAtndSOtloy50RDXE6loPmrvhvgF+bcrnuSXuJ9GLgnW9sgmT1zqxuKURh7frBgBd3280kAdTXe5w39inS9iiZc4iMh1f1Ry3Ebs9ygcLbggmcObdYhIewYDZ5PS6o0WhzpC0lzpsIByxhZoeu7TQappwWPU8RdFONLZS5jSXSDIcFfOWPWfbvSGv6I7ld0tHtcrrxEai291lkHdvH11okIwOvYd4uswc37m76qcKq+rpu+12q8rno7z9ZUcNtW6cFLj7uvBNI2kWw4bA78SU5tkbcOWbNdCCmwU8s4dzbGkNGZ0A8UBnvlmqBstP0YZ3c3I26N1YijaM2Yz7VkyKjBOmnaga4tcbGy1CSDR7XNH3XXSqgxmd3M3cwAAXFtyWzMlcXNA7FmevYT7FrInbLZVNpsVTLGyNvMtBbcZE2Gfcbr0+1+Q23YKdxNJs57LdeKgh08G3XNfVY46jpnpcst18nRxPLDkV06/YU9K5xdbXcLLnGEsXRjlMu8c+WFx7UXOtb2oHVDnAgZBJV7k9I0vVE25VNaTuRWIIzsUAbXWyIRFptcZhXiBFpG27VC10QuDdp3qSC84osA3G6qY+giHBE+xAcEDzkE4cop3Xkj7APNGDatvut8kl18TUYJ52+4IPa6c+vtwXc2zKX8kNhx39W6qy4XkaVw4OiXkalez5Pw009DRfTQyVj3TtbisQOk29x4rm9TyfdyZ63r/AIrTC9sp+X+Y8bIbim7LfJHrUVPsfJdiTk9NJVMZgdHA2YtD7ZuG6w7k6bYAdNO8mOkpI2dKoeS5zzbgn/FcfjadV59p9FS+181ch6FZ7Y80UnNAwNhc58YkOFzhYkX1tuQydSr9sea6Ik15tUOP8NqCLONvcqlPpXfhtRQ+rb3KsR7LtdS3YrtmjDXDf2JpDZrQSM7D3lQSyOa5uLK2bSje0StxMFg3o2sg5rC4XI7bcEgOnqAxrmSXdfTPRJeGuNw21tyjhYm2Y3FE5pcy5NuxPRFklwvwTGG9yBa2/ghtkB70cYw52uUBupi8ERsebEXNimTBsg6TsmNyO/x7UqlwsjdI/U5rNzjiXOxWzvYaFRJ3Zyd1Si7HnFkAbFY2deTvWt7nGNxPA5LJGLvf4K/driYM0bGHCXHJo81I7NN3XAGuS1GmxYebHRtctBue8otNmMwe1rDGxoAzc0ZnXVA4DJ2DCLAWB17VumoA1lw4G4y4g8MlnbTPJc52eDUHUJSxJLHZW6LXHffIBdTZ7muljfGAXQgnpCwI33I7LrlMZ0rnRa344oA3FlK3FYi1s0sp7Izm+xddJTGe1NzgicbtElsTew21WSqBa9zQO3JXI842m192Q1Tah8GeFrmjCAA7J3bdF7dmmGOoxsvhNtUxhDBla/tEK44nOiLmltg4CxcBfWyfK+FtOyF0PNVMTnY33dd4O47svmirhOO+p/zlBI67DZ1/zXV84Tq//MUMhu3rX/NdENITYuOK2n1rJpdlk8kH+IEmNxGKxtc/aATcZsczb2mlIRWIi9i7fvCpzpCDcu+CE78gVNb9EeJ7UwIulAJubXPkhDn8TbJWW3bZsYvnniur5iQWJjtmPJLcIsOdY5nT5q8RxanUobWGfD5qx1vEpgTLvLWg9IrZNtHm2NpogOaiGQO929x7VkiyOP7LLpJzKIFl7nm5N1YQ2yU0CZIdVo2fTmrrYYAbGSRrL95VwBraOeRzQSSGNvuOpWzYkgo4qqs0cyMtYfvFRll2ul4495t19pvqdubaM0E8scclWKaA4iAMLciPh719G5AcqnP5L00Er3mWnL4Xl5uTY3HwK+cQE0dPsSME4m1Bmd7Rt/4WnZFadn7R2hSBxEbn88zxXBzcczw6fj/47+Hk6M+r5/8Ar0/K2ip9oF9RABHLqbaOXzuqjwSOa5uEhetm2k6RpBdkuFtJjJ7nfxV+n3hNVPqNZXceZtYXRNb0cR0VyW5tpChI5m29d7z1v6BFj2qTvL3C7bGyklnNY7irlBDgRnkkSudxRYHDMb0bXuYzM3YVMAewG2ZS3BzGYTe25APZheMHuKW5uA2KGxDAQd6txx2ulokLhccUQtitqqc1oIRtIY/FvQEjeLkEJ7ZX04ikilIcCTbgkRPDXaXujkLd1wVNx2JXoYuUjnNibZ73gWvv7bFVtCriq3vbUxVHNtZdsMLgB3uPFeeDnjCWOsRvWqCZ7DJYnnC2/OA5rknpccb1YxXV8kSuhcYDBG6NmM2a43OvFC8dCr9seaP0kjaZ0mZLznbXNE9hDK0cHjzXZO0Z3ObLnFpHfhtVwj0be5MrIsEj/wAJhQROayNgc5oNs7kKoeGW4YwdiYxhDiCMTjkAhEsAN+caO4qxV07GkNls86uDT8EU+7QXNDWwRDGAbntKdHQMmBuQ0js1WKKtpYxcYy8fdH6oxthhwtZA8uGQ6Qz81Nl9ispk2z5I7tcwC3DMf+EkU78GK1nM6wP2eK0ivrHA2oHWcLG7iL/AIT9LfHf6K0PJ3nK3+JOb92fXj75RiDdwFrpsbMxewG+6b9F2gR1KaMdjAfkUQoa7XnwPZZ/4TtTefj/9ipJC97rC4OltwQNgl3RyO7mFHLHWxDpVk/g4j5rJIHHrTSu73FOXTTjuOU/lrS+knwm0UlyLZi3ms0BjhdJz0T5CRlhfax9yUGBtyCcxbVQm2iGmmgVkYv8As1xwMh/RMZtbmQ7m6ZrcQs70j8/isF1R6pQG4bbkD7CnhHZd9v8AUjdth5jw/RafECbGxIsd1ifiuUPW+KaloalaTtGS1hBSNHZEPmgdtCVxuWU5P4Lf0WcoSmejn1cs1mv5sNvfoxtFvcFKiUOIkDSXA5uIFie5JbqEZaHCyQMpKiaISc04Yn9EtLA4EHv0SsJaTe99Dqid0YwLjJLxHg33pgYceJ/xFC7pgWJJvxuoHHh/mVkkjeLdt0jSMkX7+I+aI533+DUDXnDYA27Bn4qyTY9F3iAgRR3qjof53qsQUJHFMLvbhv1V4ze18rjLNDcceKsHPUahLQVcEeA81N/id6hFsjwU1PiUEM9GAcXH4BJTp7NIYPqi3ilNFyiAVrBCUZQsbjeG8SmDZXYYIoe957z/AOFrjHoaen/6jsb+4LE0c/PwxG3cFvpxjnke0XDQGNUXwvFsq6hz6mlO5jye5DVT4K2CoB6wMbvks1RznPw3YTmqqQ/6OQ4ODm5i44LOYxrcr3dAVZxkEpck17rFzty140IR4r70TAutzD6sd6g6neijs5uA+CtzA2O29bufYzGwRNJd3KnTC4yS74tTkNFC6+iWikaDMWtaWtATZR9IiFwAVgueKvG4ZXKNGd9HeBh1Vc2/QDTUqMqXNyK0CQlobh13pbsIoNa055lGGEG7W4k10bGjE3MjUKAkHO7AUtp2WC5oyACrXrLd9AifT/SHPs29geJSHUjSLwyYu9G04ZzLwzhq3UezzK4uxWaW20Oq1bEoGy1BbKcxwXrto7PpthULKqrY8xuOEBgub2vnwU2uL1frLx5Tiwn818PJxbHJhgaXOxRPLiQNU47IxioFnnniDww5rW/lPSxkGKkhcw8akX9wC1wcstjAASUTgbZ4ZsXuGFHVXNlx+t8zD+8/X5cyTZAlDi6M3LAzXhvS4+TERPq3nvcV9Lp9n7IfTxzuqoWskYHgE3IBF8wE1rNgxC/P4+xrCl95J5rx8ftT1N/l4+PK/pK+cw8l2Ysqdp7xda4+TBFi2BotoQwL3T9qbEpmk83I7hewv8Vkk5V7OjBMdHd24Fx/RT99j8i8/wBo5/8Ajs/Wyf618v5Q0f0KtMdrERA6W1uuVs2AzV9PGMy6VjQO8rv8s9oO2ptd1Q6JkDXRNa0DTIFefoZnU1ZBK0kOjka5pG4g3WuN3NvqPSzk/h5M/wAWn1CHkjPIfVn3LdHyHltd7cI4nJeUl5Y7anBbJVVD2+24eVliftmpkvzrHSe1I75lZ9V+Hz+P2X6zP8XLJ+kt/wCHuXcm6Gnd6erpY7a4pWj5pb4OTkNxJtWly+wS7yC8Oyuv1aNpPYb/ACUfXtaOlTxg/efZLeXw3w+wc7+Pmv8ASa/5aeU1Tshz8Gz53S8SYy0fFeaLAdZG/FdaVkwZHLLBTwxSmzJHvIa7x0T4dlVM4cebpehjuGY33LMyBYWvbMbjxVy173pvT8fp8Jh1b/X6jgYWb5D4BV6EfVe7xsvVxbKpWOLZObdnYObHYOBbcOs5wOuRFr7xda4Nl0bbGWlZYhpydnmN1m2OeYN7EXGoR1VteXjnu8O6RlwGQEjtuVT3CQBlmR5722X0FlNBgYY4YACdAzFc5EAXJ7RmD2i4zF/NSMfFTOhjIa7EyUNFgSNC0XAHaCO0Jys/4jHLti8JFQuLhI2eBtjcEvAWtlLVP0micOwF3kF7B8VVRc5K+PZ0EcfTI565w6i1mfErBLtakqWtbIXw2yLY5w48bnCT3aJ7PDml7PPfQpze7C+32YH/AKKDZtQ9hcKB5aNSRh8105YXOYfoQrHkjruhcG9ueXYvPzPrnOwSvnFjocVghrjnMvHd1TyenZBHPNQSxRyGzHk2a49h3ozsGJou9+DvusUW3q+GL6NLPJNBfEY3Elt116Pagq2Oc30bGkBrZQ0m1u3UJWZezTG4+8c9+x6Y9WqBI4EJR2PCP71/luu5/tFrMhHTX4lgQHaYdrFCDxbko3mvWDhHZA+rIXf/AGilSbOlhcbRl2WRDV3ZKjELyXA9pZ+ehc7ovefZGLyVTLL3K44+zgsgfazmEHickX0WVwOFmLueCu2GtjBu5p9ohKdPRtN3OjJ+4L+SfUmYT3cv6DNbOF/uQGleL3jePBdF9fTj1bJCe02CS/aUliGtY34lOWpuOPyxiGzhcHU7lQhbhJvmB8019VPL15HEe4KCY4C2wsOzendpKfFduIZq44cJMhtZoujElmAF3ZZXUlrY2sZcYhiN9US+wjK43NzvVs0JQ6owLBUSickIJbex7FCogCikdEcTTYprKyUH6pvxaEtsT3mwW2k2XzuLnKykpiBf07nNv3WBUZZYzvVSX2C2tnaWycxFYZA4DY/FBLtB0nWhiHG1/wBVuqNnveWQwzbOcMyDFP1shlmubPSTQuIeG/lcD5KMMsclXqkMbtBwaAImWA7UP0l75WucbNvoNFmsQcwiDswtOmJ6qNjmltnDPiqcTdVa2hUwkKmYcypoEVhZDZBoooAja0lIbU1l10tnUZ2hNgdUMhDG3GIE37BYLJGy3eunsmCTFjYDcm11nnlqbRljlnLMfKqeOKnntUEizrEW1HFd142RWxmCOGXFh6DjYWXP2w2CKESTC774ThIuFzYNqGJ4wu6Hcs8crnNxhy+k67Llbufm7GwqJlYZdnVQBbDJzgeO3K3dvX0nZvI3ZDqTnXUkLnYQNDu35lfNYto7HpGOngq6htQ7VrYz81th/pBqqKExxVErxuEsbf1XJz8fNyfgunq+lw4cJfvZK9Dyhqp9lUNS6leGNgYcLQLAbl47lAJjQxTyTSvmeBzkheenlvGll1KLb9XyhZJDKyjwS3jcC1xJv4rnbapKum2aaaeJz44iBHUMOWHQBw1v2rTiwuGpfJ88xzsuLy+t1UHrVAQzIplJE6oqGRxgue8hrQN5K745dPc0ta9sEbS52TGj4J4qZndSNxXVg2NNFG1pMfRaBkBmstTBLzrozSVBa3R7HAg+AN15H8tvZ1/w+U9nI2hRurXMdI90RZexDgCsf0N8ZOHaridwIutlRDTtc7nTJEfvRuHxIWJ1NTvuI6u/YHBdXHjNeWOXD8xgrIqiSQtmmhmI0L228kmOmmDm9GnsDrjIHktslHzepxd6VzdtLBdOOvZMx6ZqQ8RSEdKqgIO5sbnH4kJkdHEdZ6hw4NaxnyusYlLEba1zeCf6J6W9tDSHWB8n4kznfDRY9rTO2ayKSjpaaNod0zzTT3DNWNpC1iMuw2WSpZDUgh75S3gX3TgDTbYomux/R5aSXpFzqR92uJ3FjtB2ArZHtiQtJ+kU9SwBuWIwygtORAdkXZ7rrmO2VTkAskcL8Up2y9zZh4hPTm+5ntf8vRwV9RMRh2fVAudYNbHYC172cSARe5tuNyLLXTw7UOboKYZHozVA48GXIPEXzXl6SCso3h0NS1ttxuQfBbhNXP8AWbSlaDuiaG/FExT9xfn+3/69I2iqiMT6uhpt/o6Uv331kd8kqom2awYa3b07nMOJojkZGGnjaNt/ivPGlpnWdO6WYjfLISnQPo43ehgjv9xmJVqKnDPe2/2/002iu2AHB9PQ1FdI3JpMbpN/3ynt2tXNyoNlClHFz2x/BoWZtXNboQPA4vIaEiXawZ16qmjPBt3lHZc4cPeNT27WqiTNVU0J+5GXn3lFHQCFh5+pfI4m5e8gLjy7di052plPZZg+CxP2w4kuZTxA/afd5+KW2smnoXvpG9DnGyHg1pd5LPLzBHSpbD7TyGhcB+06yQWM7gODclnLi83cS48SbpaVMnZlkomk3kgHZGC8/os5rKVnUjmf3kNHwzXOvYZqucO4I0XU2ur3Z4IYmdtsR+KB9ZUvFnTPtwGQ+CyYndvuVYjvT1B1U4vAzNyfegM1zYBP2dSNrZSx1VBTAC+KZ1ge5dWLkzTyXw7RgkP3JY/1U3KTycxt8OKBlcqwDqGld7/dKUg4HTOA3hgd5FF9CrqNoaHtsP8AqQkJfeT2VOO+7gc3I4ZNJVGKRoza4Z8F6Azzf86mppe1hslyTU9jioJh7LrqfvMvhX3ePy4cLQ55DhdoFyTuCXNIZHudx8lu2jPFhEUMZjxZuvquaTcrTHv3ZZTXZbRc9yInJU0WCpx3KkqUaoFdtEAQmkadcwtDNrVjRb6RJbgcx8VlOpQqbjL5hy2eGuXaVTPbnHMdYWHo2jyCQZnHgO4IOKpOYyeILlb5Xe+pUCpRMhqF9xZCphQSXUCsNKMADNARjbpzGEpbXDuTGyPB6IU0tG2DGOsRiHFes5NUbqimhNPCJCTmd115EzCSMtLLO4rqcn+UUmyfRku5u98iufnwyyw/l8uj02WOOX83h9P2hyXp66hY3aMEMbR0r2svne3KPk7s6V0dOTUPGoabAJnKXllNXRClpZHtjI6RvqvKtaXZkrm9H6bkxm87/R0ep5+PesJ/VsiqKBryXbPxjhzjgurRVXJ2R452gdEe12IfFcAFoBAzUAvuXdlxy+9/dx48txvt+z2LhVsbzmzYo2RXu0sF0VdFtd+zWtfLK5s2TgdLLz2ydr1Gy5muBLovrMJysvqFBX0W0NnxTdCRlurwXDzdXFrtuO/gmHN+VfMW8nQTm94PCy6myeS83PNfAWtkbmHEOuPgvcTV1PACGxRtG6zQsJ2sS/IuslPU8lnhp/Dcc8mQ7DnYwGSrLSBo260GnLGWc57yPrOKzu2oQM3X8Up20WuaT81lOu+V6wx8LmdhuA4BcqqEElxI2N/e0FNnrrXFgFhfUh2twOxdOGNYZ5Rnko6G5wxgH7l2+SQ6iYb4ZJm97r+ae+cDS/iUozA6ldGMYZWMz9nPPVqAfaZ+iS/Z9U3QxPHY4jzWwzNHahfUtYOk5rR2my0m2V05zoKlmsD/AMpBSnPLOs2Rve0rc/atMwG8zSeDASs0m24vqxSv9pwaPhdVNouimy4jYYifZKbHFPIbNif45LM/bVQQQxsUfaG4j8brNLW1M4tJPI4cMWXuTS6rojF66eGI8CblLNZRx6zTyn7gwj5LkBWM0aDpHasTfVUcd/tSHEUp+2Kx+QlDBwYAFisrRoCkmklN5JHv9pxKEKBWmFXso27r2Clrp1BS1NW8x00Ekzt4Y0k2QRWmZOSIPb3L0n+5m2K5okfFFC3c18gBHgEibkLtaIX/AGd3dJ/4Uy/Jzu4DyCMig14rqTcmtqRa02L2XArHJsysh69LM38pT3D1We3er03uULHsNi1w7wqzG8pkIe0UJcVA48VXFANYXAXabHsyTY9p1kGTKqdvYJHD5rOx5AsLIice4AhLR7a27drwLOnMg4SNa7zCdT7XlkcQ+GAtAu4hpafgVyiLFPJ5qAMGRf0nd25LUOWgmkMjnOJuXH4JbRcqE3KJoyVRK7oFZOSpAQbyrbor0adUI4ICyqARHVUNSgK4qlapARRRRANDQiDbK2EWUzTQrRUACc1CQAhabpHobmXGRVNc9uhRsBTWxCQEjUJGWxxBucwmTTwvaGsBvvVPic1pc0jLUJEZGIkpaB5ewgAtt2oCwfVOSpxuhCeiXfDlayttjq6ygdxF1OjqEwIhlusV2uTe1pKOR1MHnm36dhXFbnoQO9FGXslY7LI6hRnjMpqr487hluPXz10lzeQ2WcV5acj8Vzqiuhb1pW6aXusb9qRN6oc7uyXNjxfk7MuX83oPpxOZKo118rkrzT9ryHqMaO/NIftCokyMpHs5LScLO8z0ctYM7kDvKxybUibcGVvhmuCXudm4kntKpaTjkZXkrqv2uwE4Wvd35JD9rzG+FrG+F1gCNsT3aNKvURcjH1tRJrM63AZJJNzmbntTW0xOrgO5GKdg1uU09TNdEGPdo0rQMLdGgK8SC2QIHbyAr5po1JKc2N7+q0kKzTu+sQPiguuTzSLNG5VuTHMDeJRTtGGMRt1B0S2OuEFDcJraWV24N7ynMoDfM4uwGyNxXVGQOKNkUkmjSV0BSNZnzEg7dUJazQiQd4U9RxiMZjJa61xwK0UG0q7ZwL6CeaEnJxjNr96VPYSOsSR2q6PEWODSMyn7FNutBy527Bkapsg4SRtPyWhvL6ud66lpn9rcTfIrkPY9g6bGm/HNKMQOsbT3JdqqWvQs5aU8g9LRStPFkgPmEX+8ez5j66aL24/0K8tLAW3Lcxw4JSfTFddew+mUVRk2qpn9jjY/FKkoKeXP6Oxw4st8l5S6KIyB3oy6/wB3VHSXU779j07jkXs781jn2E9uJzJoyODuisjdoVsWXPS24Oz80M1dPUZvcT3JyDcMhphZzXtBcDbIq30rWtcWgggKqK4Dna3K0dPjbxU291SbjAxoe8X0GZ7kEjy8lx3o3Ax84O3ClKohGi5RKmb1aZBOqm9TeoNUBdyBa6jSQU9rQaYuIabX71GtiDQDhJsL52sls9EB2ZNgVGutfIFNwRZ3JPs5oXNYNMfiEbGgEi2lvFCrNtypMkUUUQBh5GimMkaoFY0QWltzPFS2Z3KMyIKj3XN0GYySxzWqCQNN1hvcprHPjYXEZI2WmmVwe0u0CzYxmA0W4oXOJjvfMnRFGzE2yQWAbZZhTwQEGJ2pRc8HAi3imNL0UvbtCAPAFiiBFkEmHe0q2vtrkqBsULg5+WQSAHHM2VJgiG8+5EGMG73pnskXOmaMRvO63em4raZKYkFugEHF3uRCOMdveoCXGwzPYmNp5HbsPehNy15qg5rdAAoHXKc2lb9Z5PcExsMbdGZ8TmltneXGMrA51g0E9wTm0srszZveVsghmnOCGN7zwY2/kujT8na2Y+kDYR943PuCXVpz8nrMcPxWRxW0kY6znO7skxrGM6sYHbqV66i5GxnpSull8QwfqurDsKkoxcCKLubc+9Z3kjy+X7Y4pdS7eFh2bW1WccD8P2nZD4rYzkzNkZX3G8RtJ+K9XPPRw35tvOOHC5XKqNrVWYiYGBR95b4Rh6z1HN/28dMkXJunj6QDSf4uZ92iOTZbGDSE23YQFiqKmrkJL55B+ewXMmlDSTzzi7sN/il3vu7uL0nNld8mTrvpYWZGiz4h5CwzMpWesbIw9jgVzzVygWJLh3lJfKXjpYgqxwvvXp8fDMY2vkw5QSOc3g4JRqai1hE0DuWJ2FjSWnPtS21EgFsVx2rSYN5qCncXSuJFimUbnNY6zA7Pes7343EkWujgxWIZiv2K9dijVjeTfAO5Vjdww+CjYZTm+QjsWiGmL82NJ7SlMT6oSxksmnvKyVcXNTFt73zXoaajYT0y57uDRksHKCnMZhkwhtwW2CrUhbtcddLZYBjdZox3tdc1dbk89vPyxuAOJtx4IDpQU7BfFZxOZvuRc3ELtwNB7FswwtblHh7QUiSIAmxDuyyDZn08TgRzbc+xY5aVrb4QR3FbZA5t7iw0CQ5paCRmjQ25FbHzbh97NZl0NosuxruBssCIQmDJWqZoQrIQAHVTQqyqOl0BrpJS0OYGBw1T+ci3wt9yyUkohma8i7dCOxdkGnkv0W+9Z5XVa4TcYMVOfqFvcVAyJ2kjh4rW6mgeMoyO4pD6Fm5zh4JTKH00p9ODmHB3eAlOpr/Vb5JponjquugdFKzcVUqbPyIdTkDoj4qhA77J96cOd3XKhe8atIT2nTJuUGilslAqSsA2UOZUOYVX0QFtBvYap1QSAI1KePEUEx9I7O6XufsAnQcE+O0hGF2ErOEV0002RpBLX58CgwCyITXFnJ4fC8AYbHigMtmqxYI5ow12WiBrHHd70Fau6l0Qi4u9yMMYN1+9CblCtTkjbE87rd6YDwyCbFTzTH0cb39wS2i8miW04+s/3JrYox9W/et8GxZ3eteyMd+I/BdKl5PxE9JskvecI9w/VTcnHyeswx81wm3GQFuwLbT7IragXbA5rftP6I+K9VS7LhgF8LIPZZb4prjSwZySB3aTdR1vN5PtPfbjjg0vJaWQ+lmHdG2/xK7FHyYp4+tC1xG+V1/homO2zEwWiAtx/wDdZ5NtyuFg4NHalba48+X1XL+TuRUUFOyxcA0fVGQ+CGTaNJTC0YuewXXmZdqPIN3k95WN+0Xm5xBR02s8Ps7PO7zr0lVt5waWsLG+a49TtgkHE5zvFciasc65Jusjqlxvmqxwel6f7Owx9nTk2qBfCXNdxusEu0Kl17Tn3rMZDvKS5+K+QVzCPW4eGY+DJJHvze8nvSri2/wQX4X8FRcftKtOvGCBG5xUuTvBQYgqxZaWTWYRYZ4fFC1kbtQAOKUXAdqFzrpyDbTGylDs8b/JdSB+zQGtkbM0by0FcG54lW2R7eq9w7ignqIYdjTOGCrc08JNFuioozcskjnaNBG8eS8b9KmtYvxD7wv5qCpt9Ro7WkhE2fZ7KSobG0s5t0duLbLj7YP0ikcRY4CHLBBtiohybUzNHAnEE2Tajqlj2ytgeXNIuBhKA5K17LkMVbGb6nD71kRRuwPa4biCmT1rZjh1QulxZ38VnD7i5uAc9MlMVxkRZAMMu66XI5vD3JTncUJeN+qACphbJC8C9yLjvXF3rthxJ1XLrYuamJA6LswgEtyKNLRtN2oCihGhCIoQbHJAW06rowS44R0rWyN1zRqtNI6xc3jmlZ2VjdVqLTukCmGQaSfFQDsTGutwWbSFY5m/XVGaW2ZBWgkuBtYeCS+M62BRKC+fcPqgKvpB3tQvFtUF+xUnbOMwpkAqByUurZLGVwq3qkTeCDNZJha5JOZUJupuQE0RYXHcUN7aI2uJQVWIuJCJrWt4lQLXFs9z2c454DewXKKyyz13tZw4qAFxsASeAWxtLC3RpcfvH9FqhYQOiQ0cGiynbDLmk7xhj2fUPzLMA4vNlth2S0j0khd2MFviVpYwN6wxeKa2qjiJaIr+KW65M+fO/hXBsuNtsMDWn7T8z8V0GUNgMcrSOC5ztpSnoNAA7kl1S517udfsUd3Llhy5+a7JkpqfIjEUB2vhFoWloHauKah2lyhM7gEaE9JL+Lu6r9rSvvjcfBZXVbHHPXtWEyE5pRmKcxdGHpsZ4ja+p4Jf0nXcsmPJC550JT02x4Y0PmO51ksy5Z5pJdZCXXT01x44N7770DjkgJOqAuKcjbHFZ7EBJUugJTayLKHFbeqJKFNcWXcENyoog0UsoogJZSyl1AUBSitUgIooogLVKxoVAgNEdW5gAEj2/ELQ2vedQ13a3IrnqkB1WVrXZEg9jtUYnY7sK5OM78+9E2Rw0OnFAdMyAHVIqWiVlt4zCzCoNlDOUAm1sipporecRvvQoC7qKlEBE2B2GRp7bJaKIYntHagR0mkkWsms7h4pLSW5prXBxtZZVvBvB0I04LM+TXULSQCL3NlnmGFLE6zuN0N/FEUslaRk/9k=" alt="">
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
  if (panel) panel.innerHTML = trustedHTML(errorLogRows());
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
  const channel = library.filter((sticker) => sticker.access === 'channel').length;
  const observed = library.filter((sticker) => sticker.access === 'observed').length;
  const changed = countChangedStickers(library);
  const atCapacity = library.length >= STICKER_LIBRARY_LIMIT;
  return `${library.length} recorded · ${favoriteCount()} favorites · ${state.stickerPreferences.hidden.size} removed · ${state.stickerPreferences.groups.length} custom groups${channel ? ` · ${channel} channel-only` : ''}${observed ? ` · ${observed} seen in chat` : ''}${locked ? ` · ${locked} subscriber-only` : ''}${changed ? ` · ${changed} changed by Kick` : ''}${atCapacity ? ` · full (${STICKER_LIBRARY_LIMIT}); oldest chat-only emotes drop first` : ''}`;
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
  if (filter === 'channel') return sticker.access === 'channel';
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
    ['channel', 'Channel-only'],
    ['locked', 'Subscriber-only'],
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
    // Shared with the chat hover card, so the two cannot describe the same
    // emote differently.
    const accessLabel = emoteAccessLabel(sticker.access);
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
        <a class="kf-button kf-button-small" href="${escapeHtml(sticker.src)}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(sticker.name)} artwork">Open artwork</a>
        <button type="button" class="kf-button kf-button-small" data-action="copy-sticker-name" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-label="Copy the name ${escapeHtml(sticker.name)}">Copy name</button>
        ${state.settings.content.insertEmoteName ? `<button type="button" class="kf-button kf-button-small" data-action="insert-sticker-name" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-label="Type the name ${escapeHtml(sticker.name)} into chat">Type in chat</button>` : ''}
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
        <div class="kf-emote-catalog-browser">
          <h4>Browse any channel’s emotes</h4>
          <p>Paste a channel name or Kick URL. Artwork is public, but importing it never bypasses chat access: free emotes stay channel-only and subscriber emotes stay locked until Kick confirms your account can use them.</p>
          <div class="kf-emote-catalog-form">
            <input class="kf-text" value="${escapeHtml(state.runtime.emoteCatalogSlug)}" data-kf-emote-catalog-input placeholder="channel or kick.com URL" aria-label="Channel emote catalog">
            <button type="button" class="kf-button kf-button-primary" data-action="import-channel-emotes"${state.runtime.emoteCatalogLoading ? ' disabled' : ''}>${state.runtime.emoteCatalogLoading ? 'Loading…' : 'Load emotes'}</button>
          </div>
          <p class="kf-emote-catalog-status" data-kf-emote-catalog-status data-error="${state.runtime.emoteCatalogError}"${state.runtime.emoteCatalogStatus ? '' : ' hidden'}>${escapeHtml(state.runtime.emoteCatalogStatus)}</p>
        </div>
        <div class="kf-sticker-library-controls">
          <input class="kf-text" type="search" value="${escapeHtml(state.runtime.stickerLibraryQuery)}" data-kf-sticker-library-search placeholder="Search recorded emotes or Kick groups" aria-label="Search recorded emotes">
          <select class="kf-select" data-kf-sticker-library-filter aria-label="Filter recorded emotes">${filters.map(([value, label]) => `<option value="${escapeHtml(value)}"${selected(filter, value) ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>
        </div>
        <div class="kf-sticker-group-builder"><input class="kf-text" maxlength="60" data-kf-new-sticker-group placeholder="New custom group name" aria-label="New emote group name"><button type="button" class="kf-button kf-button-primary" data-action="create-sticker-group">Create group</button></div>
        ${groupRows ? `<div class="kf-sticker-group-list">${groupRows}</div>` : ''}
        <div class="kf-sticker-library-meta"><span data-kf-sticker-library-visible>${library.length} shown</span><span>New emotes from chat and the picker are merged automatically and included in export.</span></div>
        ${filter === 'removed' ? `<div class="kf-notice">Removed emotes are no longer stored, which frees their library slots. ${state.stickerPreferences.hidden.size} ${plural(state.stickerPreferences.hidden.size, 'emote is kept out of the library.', 'emotes are kept out of the library.')}${state.stickerPreferences.hidden.size ? ` <button type="button" class="kf-button kf-button-small" data-action="restore-removed-stickers">Restore all removed</button>` : ''}</div>` : cards ? `<div class="kf-sticker-library-grid">${cards}</div>` : `<div class="kf-notice">${state.stickerPreferences.library.size ? 'No recorded emotes match this filter.' : 'Watch chat or open Kick’s emote picker to begin the library. New emotes are saved whenever Kick exposes them.'}</div>`}
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
  showToast(`Loaded ${emotes.length} emotes from ${slug}.`);
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
function renderCollectiblePanel() {
  const inventory = state.live.inventory;
  const changed = countChangedStickers(state.stickerPreferences.library);
  const observed = inventory
    ? (inventory.quantityKnown
      ? trf('Your inventory holds {copies} {copiesWord} across {distinct} distinct {distinctWord} — {duplicates} {duplicatesWord}, or {rate}% of what you have pulled.', {
        copies: inventory.copies,
        copiesWord: plural(inventory.copies, 'collectible', 'collectibles'),
        distinct: inventory.distinct,
        distinctWord: plural(inventory.distinct, 'item', 'items'),
        duplicates: inventory.duplicates,
        duplicatesWord: plural(inventory.duplicates, 'duplicate', 'duplicates'),
        rate: Math.round(inventory.duplicateRate * 100),
      })
      : trf('Your inventory holds {distinct} distinct {distinctWord}. Kick’s response carries no per-item quantity, so a duplicate rate cannot be measured from it — that number is unavailable rather than zero.', {
        distinct: inventory.distinct,
        distinctWord: plural(inventory.distinct, 'collectible', 'collectibles'),
      }))
    : 'Open a channel with collectibles while signed in to read your own inventory. Nothing is fetched otherwise.';
  return `
    <div class="kf-panel">
      <div class="kf-action-row"><div><h3>What Kick does not explain</h3><p>${escapeHtml(observed)}${changed ? ` ${changed} ${plural(changed, 'recorded emote has been changed by Kick since first capture — see the Changed by Kick filter in the library below.', 'recorded emotes have been changed by Kick since first capture — see the Changed by Kick filter in the library below.')}` : ''}</p></div></div>
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
        ${row('Load the emote catalog from Kick', 'Read the full channel, global, and emoji sets without treating public artwork as account access. Falls back to the picker if the response changes shape.', toggle('content.liveEmoteCatalog', value.liveEmoteCatalog, { label: 'Load the emote catalog from Kick' }))}
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
        ${row('Poor mode', 'Hide Subscribe, Gift Subs/Dubs, Get KICKs, gift-shop controls, and spend-based leaderboards. Follow, chat, and free daily rewards stay available.', toggle('content.hideMonetization', value.hideMonetization, { label: 'Poor mode' }))}
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
      <p class="kf-meta">${value.hiddenChannels.length} ${plural(value.hiddenChannels.length, 'channel hidden. These count toward the fail-open ceiling.', 'channels hidden. These count toward the fail-open ceiling.')}</p>
    </div></section>
    <section class="kf-subsection kf-content-section"><div class="kf-subsection-header"><div><h3>Playback & chat</h3><p>Local playback memory, chat control, emotes, and diagnostics.</p></div></div><div class="kf-panel">
        ${row('Remember volume locally', 'Restore each channel’s volume and mute state from local storage.', toggle('content.rememberVolume', value.rememberVolume, { label: 'Remember volume locally' }))}
        ${row('Remember quality locally', 'Restore a matching quality control when Kick exposes one.', toggle('content.rememberQuality', value.rememberQuality, { label: 'Remember quality locally' }))}
        ${row('Remember VOD position locally', 'Resume finite VODs from the last local playback position.', toggle('content.rememberVodPosition', value.rememberVodPosition, { label: 'Remember VOD position locally' }))}
        ${row('Pause chat updates', 'Freeze the visible chat scroll with an accessible resume control.', toggle('content.stickyChatPause', value.stickyChatPause, { label: 'Pause chat updates' }))}
        ${row('Organize chat emotes', 'Continuously record emotes from live chat and Kick’s picker, then add favorites, removals, search, and custom groups.', toggle('content.organizeChatStickers', value.organizeChatStickers, { label: 'Organize chat emotes' }))}
        ${row('Click chat emotes to save', 'Click any emote in chat to add it to your favorites. If Kick explicitly marks it as follow-gated, the same click follows its source channel; subscriber access is never bypassed.', toggle('content.clickChatEmotes', value.clickChatEmotes, { label: 'Click chat emotes to save' }))}
        ${row('Type an emote name into chat', 'Adds a Type in chat action beside Copy name in the emote library. It types the plain name at your cursor and stops — never the wire token, never an id, and it never sends the message.', toggle('content.insertEmoteName', value.insertEmoteName, { label: 'Type an emote name into chat' }))}
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
      <div class="kf-action-row"><div><h3>Apply cycle cost</h3><p data-kf-apply-cost data-kf-no-translate>${escapeHtml(tr(applyCostSummary(state.diagnostics.apply)))}</p></div></div>
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
    'data-kf-sticker-assignment', 'data-kf-sticker-library-filter', 'data-kf-sticker-library-search',
    'data-kf-emote-catalog-input', 'data-page']) {
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
  page.innerHTML = trustedHTML(renderer());
  page.dataset.kfCurrentPage = state.currentPage;
  page.querySelector('[data-action="import-channel-emotes"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    startChannelEmoteImport();
  });
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
  state.shadow.querySelector(`[data-page="${state.currentPage}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const reset = state.shadow.querySelector('[data-action="reset-page"]');
  reset.disabled = state.currentPage === 'about';
  reset.title = tr(reset.disabled ? 'About has no page settings to reset' : 'Restore page defaults');
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
  if (log) log.innerHTML = trustedHTML(protectionRows());
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
  else if (action === 'copy-sticker-name') copyStickerName(actionTarget);
  else if (action === 'insert-sticker-name') insertStickerName(actionTarget);
  else if (action === 'copy-diagnostics') copyDiagnostics();
  else if (action === 'copy-error-log') copyErrorLog();
  else if (action === 'open-multistream') openMultistream();
  else if (action === 'close-multistream') closeMultistream();
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

function onInterfaceKeydown(event) {
  if (event.key !== 'Enter' || !event.target.closest('input[data-kf-emote-catalog-input]')) return;
  event.preventDefault();
  state.shadow?.querySelector('[data-action="import-channel-emotes"]')?.click();
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
  // Where focus came from, so cancelling returns the user to the control they
  // pressed rather than to the top of the dialog's container.
  state.resetOpener = state.shadow.activeElement || null;
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
  // The opener can be inside the settings page, which a following render
  // replaces; renderSettingsPage re-restores by key from there, so handing
  // focus back here is correct in both cases.
  const opener = state.resetOpener;
  state.resetOpener = null;
  if (opener?.isConnected) {
    try { opener.focus(); } catch { /* noop */ }
  } else {
    try { state.shadow?.querySelector('[data-kf-page]')?.focus?.(); } catch { /* noop */ }
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
/**
 * Apply an import as one transaction.
 *
 * Every store the file provided is staged and sized first, then committed
 * together. In-memory state is only advanced once the write has succeeded, so a
 * refusal leaves both storage and the running session on the previous
 * configuration instead of a half-imported mixture of the two.
 */
function applyImportedStores(result) {
  const trimmedSet = (values) => [...new Set(values)].filter((item) => typeof item === 'string').slice(-200);
  const entries = [[STORAGE_KEY, result.value]];
  if (result.stickers) entries.push([STICKER_PREFERENCES_KEY, result.stickers]);
  if (result.usage) entries.push([EMOTE_USAGE_KEY, result.usage]);
  if (result.multistream) entries.push([MULTISTREAM_KEY, result.multistream]);
  if (result.channelLayouts) entries.push([CHANNEL_LAYOUT_KEY, result.channelLayouts]);
  if (result.favoriteChannels) entries.push([FAVORITES_KEY, trimmedSet(result.favoriteChannels)]);
  if (result.dismissedChannels) entries.push([DISMISSED_KEY, trimmedSet(result.dismissedChannels)]);
  if (result.chatKeywords) entries.push([CHAT_KEYWORDS_KEY, result.chatKeywords]);
  if (result.channelNotes) entries.push([CHANNEL_NOTES_KEY, result.channelNotes]);
  if (result.mediaPreferences) entries.push([MEDIA_PREFERENCES_KEY, result.mediaPreferences]);

  const commit = gmSetMany(entries);
  if (!commit.ok) return commit;

  state.settings = result.value;
  if (result.stickers) {
    state.stickerPreferences = stickerPreferencesFromValue(result.stickers);
    state.runtime.stickerCatalogDirty = true;
    state.runtime.stickerLibraryFilter = 'all';
    state.runtime.stickerLibraryQuery = '';
  }
  if (result.usage) state.emoteUsage = result.usage;
  if (result.multistream) {
    state.multistream = result.multistream;
    if (multistreamOpen()) renderMultistream();
  }
  if (result.favoriteChannels) state.favorites = new Set(trimmedSet(result.favoriteChannels));
  if (result.dismissedChannels) state.dismissed = new Set(trimmedSet(result.dismissedChannels));
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
    const result = validateImportedSettings(await file.text());
    if (!result.ok) {
      showToast(result.error, true);
      return;
    }
    // Non-destructive: snapshot the current configuration before overwriting so
    // the import can be undone, then apply every store the file provided.
    gmSet(PRE_IMPORT_BACKUP_KEY, currentExportPayload());
    const commit = applyImportedStores(result);
    if (!commit.ok) {
      showToast(commit.reason === 'over-budget'
        ? 'That backup is too large for this browser’s storage. Nothing was changed.'
        : 'The import could not be saved. Your previous settings are unchanged.', true);
      return;
    }
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
  const commit = applyImportedStores(result);
  if (!commit.ok) {
    // The backup is kept: a failed restore must stay retryable.
    showToast('The backup could not be restored.', true);
    return;
  }
  gmDelete(PRE_IMPORT_BACKUP_KEY);
  renderSettingsPage();
  scheduleApply(0);
  showToast('Import undone — your previous settings are back.');
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
    showToast('Could not reach the clipboard.', true);
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
function chatMessageInput() {
  if (multistreamOpen()) return null;
  const input = document.querySelector('[data-testid="chat-input"], #chat-input, div[contenteditable="true"][role="textbox"]');
  if (!input || input.closest('[data-kf-multistream-backdrop], iframe')) return null;
  return input.isContentEditable || input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement ? input : null;
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
  for (const node of document.querySelectorAll('[data-kf-chat-separator], [data-kf-chat-panel], [data-kf-filtered], [data-kf-mature], [data-kf-ad-shell], [data-kf-watched], [data-kf-live-card], [data-kf-dismissed], [data-kf-highlighted], [data-kf-player], [data-kf-player-resize-ready], [data-kf-card-actions], [data-kf-chat-pause], [data-kf-chat-status], [data-kf-playback-diagnostics], [data-kf-search-meta], [data-kf-drops-empty], [data-kf-native-drops-empty], [data-kf-monetization]')) {
    if (node.matches?.('[data-kf-card-actions], [data-kf-chat-pause], [data-kf-chat-status], [data-kf-playback-diagnostics], [data-kf-search-meta], [data-kf-drops-empty]')) node.remove();
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
    { id: 'panic', label: tr(state.runtime.suspended ? 'Restore Kick Focus' : 'Pause Kick Focus'), description: tr('Temporarily remove enhanced layout and request hooks'), key: 'Ctrl+Shift+F' },
    { id: 'focus', label: tr(state.runtime.focus ? 'Exit focus mode' : 'Enter focus mode'), description: tr('Maximize the stream and hide side panels'), key: state.settings.shortcuts.focus },
    { id: 'theater', label: tr(state.runtime.theater ? 'Exit theater mode' : 'Enter theater mode'), description: tr('Hide discovery while keeping chat'), key: 'T' },
    { id: 'chat', label: tr(state.runtime.chatHidden ? 'Show chat' : 'Hide chat'), description: tr('Toggle the chat panel for this session'), key: state.settings.shortcuts.chat },
    { id: 'sidebar', label: tr(state.runtime.sidebarHidden ? 'Show sidebar' : 'Hide sidebar'), description: tr('Toggle the discovery rail for this session'), key: state.settings.shortcuts.sidebar },
    { id: 'mature', label: tr(state.runtime.matureVisible ? 'Blur mature thumbnails' : 'Reveal mature thumbnails'), description: tr('Temporarily override mature-card blur'), key: state.settings.shortcuts.mature },
    { id: 'density', label: tr(`Use ${state.settings.layout.density === 'compact' ? 'comfortable' : 'compact'} density`), description: tr('Change discovery spacing and save it'), key: 'D' },
    { id: 'casino', label: tr(state.settings.content.hideCasino ? 'Show casino content' : 'Hide casino content'), description: tr('Filter clearly labeled casino streams'), key: 'G' },
    { id: 'poor', label: tr(state.settings.content.hideMonetization ? 'Disable Poor mode' : 'Enable Poor mode'), description: tr('Remove spending prompts without changing your Kick account'), key: '' },
    { id: 'multistream', label: tr(multistreamOpen() ? 'Close multi-stream' : 'Open multi-stream'), description: tr('Watch several Kick channels in one grid'), key: '' },
    { id: 'settings', label: tr('Open Kick Focus settings'), description: tr('Customize layout, appearance, content, and access'), key: state.settings.shortcuts.settings },
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
  state.commandList.innerHTML = trustedHTML(commands.length
    ? commands.map((command, index) => `<button type="button" class="kf-command-item" role="option" data-action="command:${command.id}" data-active="${index === 0}"><div><strong>${escapeHtml(command.label)}</strong><span>${escapeHtml(command.description)}</span></div><span class="kf-shortcut">${escapeHtml(command.key)}</span></button>`).join('')
    : '<div class="kf-command-empty"><strong>No matching commands</strong><span>Try “chat”, “layout”, “casino”, or “settings”.</span></div>');
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
function resetConfirmationOpen() {
  const container = state.shadow?.querySelector('[data-kf-confirm]');
  return Boolean(container && !container.hidden);
}

function overlayOpenState() {
  return {
    multistream: multistreamOpen(),
    command: Boolean(state.command && !state.command.hidden),
    resetConfirm: resetConfirmationOpen(),
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
      else if (top === 'resetConfirm') closeResetConfirmation();
      else closeSettings();
      return;
    }
  }
  if (trapFocus(event)) return;

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

const HEADER_CONTROL_CSS = `
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
`;

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
    shadow.innerHTML = trustedHTML(`
      <button type="button" data-kf-header-focus aria-label="Open Kick Focus command menu" title="Kick Focus">
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAkElEQVR42u2XSwqAMAxEZ18P4L28/00E3QmKVPOfioHs2sxb5AtcrLVpi3T0LFq8C5ElfguRLX6CqBI/IIYDWNa562EAT8JaEESISyAgFfd+D89gmn+vASzJqgKwiEtiqAGs5WcC8OoBP8C4AOVJmFKG5Y2IohWXDyOKcUyxkFCsZN/dissPE4rTjOI4rTrPd9CSNAqXgFAlAAAAAElFTkSuQmCC" alt="">
        <span data-kf-header-control-label>Focus</span>
      </button>
      <button type="button" data-kf-header-multi class="kf-header-multi" aria-label="Open Kick Focus multi-stream" title="Multi-stream">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2.5" y="3.5" width="8.5" height="7" rx="1.5"/><rect x="13" y="3.5" width="8.5" height="7" rx="1.5"/><rect x="2.5" y="13" width="8.5" height="7" rx="1.5"/><rect x="13" y="13" width="8.5" height="7" rx="1.5"/></svg>
        <span data-kf-header-multi-label>Multi</span>
      </button>
      <button type="button" data-kf-header-add-multi class="kf-header-add" hidden aria-label="Add this channel to Kick Focus multi-stream" title="Add to multi-stream">
        <span data-kf-header-add-icon aria-hidden="true">+</span>
        <span data-kf-header-add-label>Multi</span>
      </button>`);
    adoptStyles(shadow, HEADER_CONTROL_CSS);
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
  announce(`Opened a shared layout with ${shared.length} ${plural(shared.length, 'channel', 'channels')}.`);
  if (!overwritten.length) return;
  showToast(`Shared layout replaced ${overwritten.length} ${plural(overwritten.length, 'channel', 'channels')} you had collected.`, false, [
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
  announce(`The shared layout replaced ${overwritten.length} ${plural(overwritten.length, 'channel', 'channels')} you had collected.`);
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
