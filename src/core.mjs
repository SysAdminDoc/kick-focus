export const VERSION = '1.16.0';
export const SETTINGS_SCHEMA = 4;

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
    // Same reasoning, and the same default: this one puts characters in
    // someone's message box. Mouse-only by design — the list is clicked, never
    // captured from the keyboard, so it cannot swallow a keystroke meant for
    // Kick's own composer.
    emoteAutocomplete: false,
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
export const TELEMETRY_NO_CANCEL_HOSTS = Object.freeze(['litix.io']);

/** Telemetry hosts the network layer may hard-cancel without a retry storm. */
export function cancellableTelemetryHosts() {
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

/**
 * The key of the shortcut that already uses `candidate`, or '' if none does.
 * README advertises that reassigning a shortcut rejects a duplicate; this is the
 * decision behind that, extracted so it can be tested rather than only reached
 * through the capture handler.
 */
export function findShortcutConflict(shortcuts, capturingKey, candidate) {
  if (!isRecord(shortcuts) || typeof candidate !== 'string' || !candidate) return '';
  const wanted = candidate.toLowerCase();
  for (const [key, value] of Object.entries(shortcuts)) {
    if (key === capturingKey) continue;
    if (typeof value === 'string' && value.toLowerCase() === wanted) return key;
  }
  return '';
}

/** How an emote's access level reads to a user, shared by the library and the chat tooltip. */
export const EMOTE_ACCESS_LABELS = Object.freeze({
  available: 'Seen available',
  channel: 'Channel-only',
  observed: 'Seen in chat',
  locked: 'Subscriber-only',
});

export function emoteAccessLabel(access) {
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
export function emoteTooltipText(entry, collisions = [], saved = false) {
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
export function insertionPlanFor(descriptor, collisions = [], access = '') {
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

/** Shortest query worth opening a list for. One letter matches most of a library. */
export const EMOTE_TRIGGER_MIN = 2;

/**
 * The colon trigger immediately before the caret, or null.
 *
 * Anchored to the end of the text and required to follow whitespace or the
 * start of the message, so a colon inside a word — a URL's `https:`, an emoji
 * shortcode someone is mid-way through — is not a trigger.
 */
export function emoteTriggerAt(textBeforeCaret) {
  const source = String(textBeforeCaret ?? '');
  const match = /(?:^|\s):([A-Za-z0-9_]+)$/.exec(source);
  if (!match) return null;
  const query = match[1];
  if (query.length < EMOTE_TRIGGER_MIN) return null;
  // `+ 1` for the colon: what a completion replaces is `:query`, not `query`.
  return { query, length: query.length + 1 };
}

/**
 * Rank emote candidates for a colon query.
 *
 * A name that *starts* with what was typed always outranks one that merely
 * contains it — the single behaviour every client that gets this right shares,
 * and the one Chatterino #1962 is about, where `:pep` surfaced everything with
 * "pep" anywhere before the emote actually named Pepe. After that the order is
 * what the user has shown: favorites, then how often they send it in this
 * channel, then overall, then the shorter name. The final comparison is on the
 * name itself so two otherwise-equal candidates never swap between renders.
 */
export function rankEmoteCompletions(query, candidates, options = {}) {
  const { favorites = new Set(), usage = null, channel = '', limit = 8 } = options;
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return [];
  const channelCounts = (channel && usage?.channels?.[channel]) || {};
  const globalCounts = usage?.global || {};
  const isFavorite = (key) => (favorites instanceof Set ? favorites.has(key) : Boolean(favorites?.has?.(key)));
  const seen = new Set();
  const scored = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const name = isRecord(candidate) && typeof candidate.name === 'string' ? candidate.name : '';
    // Only a name chat would treat as one token can be completed — the same
    // boundary the insertion path enforces, applied before anything is offered.
    if (!name || !PLAIN_EMOTE_NAME.test(name)) continue;
    const at = name.toLowerCase().indexOf(needle);
    if (at === -1) continue;
    const key = typeof candidate.key === 'string' && candidate.key ? candidate.key : name;
    if (seen.has(key)) continue;
    seen.add(key);
    const id = String(candidate.id ?? '');
    scored.push({
      candidate,
      name,
      prefix: at === 0 ? 0 : 1,
      favorite: isFavorite(key) ? 0 : 1,
      channelUse: Number(channelCounts[id]?.count) || 0,
      globalUse: Number(globalCounts[id]?.count) || 0,
    });
  }
  scored.sort((a, b) => a.prefix - b.prefix
    || a.favorite - b.favorite
    || b.channelUse - a.channelUse
    || b.globalUse - a.globalUse
    || a.name.length - b.name.length
    || a.name.localeCompare(b.name));
  return scored.slice(0, Math.max(0, Math.floor(Number(limit)) || 0)).map((entry) => entry.candidate);
}

/**
 * Where each keyword occurs in one run of text, as non-overlapping spans.
 *
 * Case-insensitive, sorted, and merged where two keywords overlap or touch, so
 * the caller can turn each span straight into a Range without producing nested
 * or duplicate highlights. `limit` caps the total, because a chat that scrolls
 * for hours can accumulate more matches than are worth painting.
 */
export function findKeywordSpans(text, keywords, limit = 500) {
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
export function recordApplyCost(stats, ms) {
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

export function applyCostSummary(stats) {
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
export const OVERLAY_LAYERS = [
  ['multistream', '.kf-ms-shell'],
  ['command', '.kf-command-shell'],
  ['resetConfirm', '.kf-confirm-card'],
  ['settings', '[data-kf-settings-shell]'],
];

/**
 * Which layer owns focus and Escape right now, or null if none is open.
 * `open` maps a layer name to whether it is currently shown.
 */
export function topmostOverlayLayer(open) {
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
export function pluralForm(count, forms, locale = 'en') {
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
export function sanitizeErrorMessage(message, limit = 300) {
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
export function normalizeBlocklistUrl(value) {
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
    emoteAutocomplete: bool(content.emoteAutocomplete, defaults.content.emoteAutocomplete),
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

/** Keep the strongest known emote access without dereferencing a missing record. */
export function preferredStickerAccess(existingAccess, incomingAccess) {
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
export function recordStickerObservation(existing, observed, now) {
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
export function stickerChangedSinceCapture(entry) {
  return Boolean(entry?.wasName || entry?.wasSrc);
}

/**
 * Say what changed, in the user's terms. Returns '' when nothing has, so the
 * caller can use it directly as a presence test.
 */
export function describeStickerChange(entry) {
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
export function countChangedStickers(library) {
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
export function chatBadgesToRender(badges, drawnImageUrls = []) {
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
export function assessApiDrift(events = []) {
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

/**
 * Identify a Kick control whose only purpose is spending or spend-based social
 * proof. Inputs are deliberately plain strings so the DOM adapter can stay
 * small and the false-positive boundary can be unit-tested.
 */
export function monetizationKind({ text = '', ariaLabel = '', title = '', testId = '' } = {}) {
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

export const STICKER_PREFERENCES_SCHEMA = 8;

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
export const PLATFORM_ID = 'kick';

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
export function platformStickerKey(key, platformId = PLATFORM_ID) {
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

export const STICKER_LIBRARY_LIMIT = 2400;

/**
 * Evict the recorded library down to `limit` without discarding anything the
 * user acted on. A naive FIFO truncation kept the oldest entries and dropped
 * every NEW one once the cap was hit; this drops the most disposable records
 * instead — `observed` (chat-only) before `locked`, oldest `lastSeen` first —
 * and never evicts an `available` emote or one that is favorited or assigned.
 * Returns the retained list and how many entries were dropped.
 */
export function evictStickerLibrary(library, limit = STICKER_LIBRARY_LIMIT, protectedKeys = new Set()) {
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
export function observationsFromChatEmotes(emotes, urlFn) {
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
export const FAVORITES_PER_SCOPE_LIMIT = 60;

export function favoriteScope(channel) {
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
export function favoritesForChannel(favorites, channel) {
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

export function isStickerFavorite(favorites, key, channel) {
  return favoritesForChannel(favorites, channel).includes(key);
}

/** Add or remove one favorite in one scope, leaving every other scope alone. */
export function toggleStickerFavorite(favorites, key, channel) {
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
export function moveStickerFavorite(favorites, key, channel, delta) {
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

export function normalizeStickerPreferences(input) {
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

export function normalizeChannelPath(value) {
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
// Prototype-pollution keys (CVE-2026-21710 class). Every store that writes an
// untrusted key drops these before the assignment, so a hand-edited import can
// never reach `obj['__proto__'] = …`. Settings sections stay safe by rebuild.
const POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Channel-path list (favorites, not-interested), rebuilt with the writer's bound. */
export function normalizeChannelList(input, limit = 200) {
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
export function normalizeChannelNotes(input, limit = 100) {
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
export function normalizeChatKeywords(input, limit = 100) {
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
export function normalizeChannelLayouts(input, limit = 50) {
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
export function normalizeMediaPreferences(input, limit = 240) {
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
export function buildSettingsExport(sources) {
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
export const USAGE_CHANNEL_LIMIT = 400;

/** The global rollup spans every channel, so it is bounded more loosely — but
 *  bounded: it was previously capped only on read and grew without limit on
 *  write, so a long session persisted an ever-larger map. */
export const USAGE_GLOBAL_LIMIT = 2000;

/**
 * Rebuild a usage store from untrusted input.
 *
 * Counts travel through the settings export, so an imported file can contain
 * anything. Everything is rebuilt from scratch with bounded shapes rather than
 * merged in, and the per-channel cap is enforced here too so a hand-edited file
 * cannot smuggle an unbounded map past the writer that normally trims it.
 */
export function normalizeEmoteUsage(input) {
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

export function recordEmoteUse(counts, { channel, id, name, at = 0 }) {
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
export function rankEmoteUsage(counts, { channel = '', limit = 24 } = {}) {
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
export function recentEmoteUsage(counts, { channel = '', limit = 24 } = {}) {
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
export const EMOTE_WINDOW_SIZE = 240;

/**
 * The slice of a long list worth putting in the DOM, and how much is outside it.
 *
 * Not virtualization: the caller renders `items` plus one spacer above and one
 * below, sized from `before` and `after`, so the scrollbar stays honest and the
 * browser keeps doing the scrolling. A library at the 2400 cap therefore costs
 * one window of nodes rather than 2400, and the arithmetic that decides which
 * window lives here where it can be tested without a browser.
 */
export function visibleWindow(entries, anchor = 0, size = EMOTE_WINDOW_SIZE) {
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
export function unusedEmotes(counts, emotes, { channel = '' } = {}) {
  const used = new Set([
    ...Object.keys(counts?.global || {}),
    ...Object.keys((channel && counts?.channels?.[channel]) || {}),
  ]);
  return (emotes || []).filter((emote) => !used.has(String(emote.id)));
}

// ---------------------------------------------------------------------------
// Multi-stream
// ---------------------------------------------------------------------------

export const MULTISTREAM_SCHEMA = 1;
/**
 * Nine tiles is a hard ceiling, not a preference. Each tile is a real Kick
 * player: an independent HLS decode plus its own socket. Past a 3×3 the grid
 * stops being watchable and starts being a way to melt a laptop, so the limit
 * is enforced in the data rather than suggested in the interface.
 */
export const MULTISTREAM_MAX = 9;
export const MULTISTREAM_LAYOUT_LIMIT = 24;

/** Column count per tile count, chosen so the last row is never a lone tile. */
export function multistreamColumns(count) {
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
export const MULTISTREAM_LINK_PARAM = 'kf-multi';

export function multistreamLayoutLink(streams, origin = 'https://kick.com') {
  const slugs = cleanSlugList(streams);
  if (!slugs.length) return '';
  return `${origin}/?${MULTISTREAM_LINK_PARAM}=${encodeURIComponent(slugs.join(','))}`;
}

/**
 * Read a layout out of a URL. Returns [] for anything unusable, so a malformed
 * or hostile link opens nothing rather than opening something unexpected.
 */
export function parseMultistreamLink(href) {
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
export const PRESENCE_TTL_MS = 30_000;

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
export function cardSlugFromPath(path) {
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

export function mergePresence(entries, now = 0) {
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
export function presenceOffer(present, streams, max = MULTISTREAM_MAX) {
  const have = new Set((Array.isArray(streams) ? streams : []).map((slug) => String(slug).toLowerCase()));
  const room = Math.max(0, max - have.size);
  return (Array.isArray(present) ? present : [])
    .filter((slug) => !have.has(String(slug).toLowerCase()))
    .slice(0, room);
}

export function normalizeMultistream(input) {
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
export function mergeMultistream(stored, current, added = [], removed = []) {
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
export function multistreamTileMuted(value, slug) {
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
export function multistreamTileActive(value, slug, suspended) {
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
export function planMultistreamTiles(existing, wanted) {
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
export function addMultistreamChannel(value, slug) {
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

export function removeMultistreamChannel(value, slug) {
  const state = normalizeMultistream(value);
  const streams = state.streams.filter((entry) => entry.toLowerCase() !== String(slug).toLowerCase());
  // Focus and chat fall through to normalizeMultistream, which re-points them
  // at a surviving stream rather than leaving the grid muted and chatless.
  return normalizeMultistream({ ...state, streams });
}

export function saveMultistreamLayout(value, name) {
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
export const AD_PREFLIGHT_SCRIPTS = Object.freeze([
  { hostname: 'imasdk.googleapis.com', pathname: '/pal/sdkloader/pal.js' },
  { hostname: 'platform.datazoom.io', pathname: '/beacon/v1/config' },
  { sameOrigin: true, pathname: '/om/omweb-v1.js' },
]);

export function isAdPreflightScript(rawUrl, pageOrigin = 'https://kick.com') {
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
export const STORAGE_STORES = Object.freeze([
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

export const STORAGE_LABELS = Object.fromEntries(STORAGE_STORES.map((store) => [store.key, store.label]));

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
export const STORAGE_BUDGET_BYTES = 4 * 1024 * 1024;

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
export function planStorageCommit(entries, budgetBytes = STORAGE_BUDGET_BYTES) {
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
