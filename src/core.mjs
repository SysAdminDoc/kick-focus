export const VERSION = '1.34.0';
export const SETTINGS_SCHEMA = 5;

/**
 * What changed, per version, for the notice shown after an update.
 *
 * Only versions worth telling somebody about need an entry; a version absent
 * from here still records itself as seen and simply says nothing. `defaults`
 * names any setting whose default moved, because that is the one kind of change
 * that alters behaviour on a profile nobody touched — the rest a user can find
 * in the changelog if they care.
 */
export const VERSION_NOTES = Object.freeze({
  '1.21.0': Object.freeze({
    summary: 'The live gate waits for what it asserts, the Firefox package no longer leaks a per-install identifier to Kick, and the interface declares the language it is written in.',
    defaults: Object.freeze([]),
  }),
  '1.22.0': Object.freeze({
    summary: 'Markup reaches the page through one checked path, and this notice exists, so an update no longer changes how Kick Focus behaves without saying so.',
    defaults: Object.freeze([]),
  }),
  '1.23.0': Object.freeze({
    summary: 'A recording now says how long Kick will keep it, and the emote card and completion list render above everything instead of competing with Kick for stacking order.',
    defaults: Object.freeze(['Show how long Kick keeps this recording']),
  }),
  '1.24.0': Object.freeze({
    summary: 'Drift detection now checks what a hook is for, not only that it matched. A stream card that stops yielding a channel name is reported instead of quietly taking three features with it.',
    defaults: Object.freeze([]),
  }),
  '1.25.0': Object.freeze({
    summary: 'The grid can merge every channel into one chat or float the focused one in an always-on-top window, and the emote suggestions stop offering emotes Kick would refuse.',
    defaults: Object.freeze([]),
  }),
  '1.27.0': Object.freeze({
    summary: 'Viewing presets, a protected custom accent, My Emotes, calmer signed-in pages, and honest points guidance make Kick easier to personalize without changing the account.',
    defaults: Object.freeze([]),
  }),
  '1.28.0': Object.freeze({
    summary: 'Every channel profile now has a StreamerStats action that opens that channel’s current analytics in a compact popup window.',
    defaults: Object.freeze([]),
  }),
  '1.29.0': Object.freeze({
    summary: 'A read-only Viewer page, five chat comfort switches, and saved discovery views: the daily reward and channel points in one place, message times and a bounded session chat search, and a named layout applied to the pages you choose.',
    defaults: Object.freeze([]),
  }),
  '1.30.0': Object.freeze({
    summary: 'Studio, OLED, and Slate now change the full surface hierarchy. Settings boards, multi-stream, and the companion popup have clearer structure and less visual noise.',
    defaults: Object.freeze([]),
  }),
  '1.32.0': Object.freeze({
    summary: 'Hidden channels, favorites, and volume now match Kick card links that carry a trailing slash. A stickers-only import no longer resets the rest of the profile. Copied diagnostics include a settings diff without channel names.',
    defaults: Object.freeze([]),
  }),
  '1.33.0': Object.freeze({
    summary: 'Scrolling chat up freezes it, every settings page offers help in the same place, and the build is 200 KB smaller so a userscript manager still injects it at page start.',
    defaults: Object.freeze([]),
  }),
  '1.34.0': Object.freeze({
    summary: 'Discovery cards can show a trustworthy live duration, chat can sit on either side, and local viewer tools add private composer recall, sidebar previews, and a browser-session watch clock.',
    defaults: Object.freeze([]),
  }),
  '1.31.0': Object.freeze({
    summary: 'The main Kick theme now uses clearer type, quieter borders, tighter spacing, flatter content cards, and more compact route controls.',
    defaults: Object.freeze([]),
  }),
});

/** A version string this build is willing to store and compare. */
export function normalizeVersion(value) {
  const raw = String(value ?? '').trim();
  return /^\d{1,4}(\.\d{1,4}){0,3}$/.test(raw) ? raw : '';
}

/**
 * Whether to tell the user the build changed under them, and what to say.
 *
 * Silent in both directions that are not an update: a profile with no recorded
 * version is either a first install or one that predates this field, and in
 * neither case can this build honestly claim to know what changed. A downgrade
 * is reported too — running an older build than last time is worth knowing.
 */
export function updateNotice(lastSeen, current = VERSION, notes = VERSION_NOTES) {
  const from = normalizeVersion(lastSeen);
  const to = normalizeVersion(current);
  if (!from || !to || from === to) return null;
  const note = notes?.[to] || null;
  return {
    from,
    to,
    summary: note?.summary || '',
    defaults: Array.isArray(note?.defaults) ? [...note.defaults] : [],
  };
}

/**
 * What a pasted diagnostic dump may include: only keys that differ from
 * defaults, with channel lists and URLs reduced to counts so a shared
 * summary does not name the user's hidden channels.
 */
export function diagnosticSettingsDiff(settings) {
  const current = normalizeSettings(settings);
  const defaults = DEFAULT_SETTINGS;
  const diff = {};
  for (const section of ['layout', 'appearance', 'content', 'accessibility', 'shortcuts']) {
    const now = current[section];
    const base = defaults[section];
    const changed = {};
    for (const key of Object.keys(base)) {
      if (key === 'hiddenChannels') {
        if (now.hiddenChannels.length) changed.hiddenChannels = now.hiddenChannels.length;
        continue;
      }
      if (key === 'blocklistUrl') {
        if (now.blocklistUrl) changed.blocklistUrl = true;
        continue;
      }
      if (JSON.stringify(now[key]) !== JSON.stringify(base[key])) changed[key] = now[key];
    }
    if (Object.keys(changed).length) diff[section] = changed;
  }
  return diff;
}

/**
 * Rank settings against a search query.
 *
 * The shape is FrankerFaceZ's, which is the only implementation in this field
 * that has solved cross-page settings search — no index and no fuzzy matching,
 * just a lowercased term blob per row and a substring test. BetterTTV ships no
 * search at all, so there is no second design to weigh it against.
 *
 * A title match outranks a description-only match, and a title that *starts*
 * with the query outranks one that merely contains it — the same ordering the
 * emote completion uses, and for the same reason: what someone typed the
 * beginning of is what they meant.
 */
export function rankSettingsMatches(query, entries, limit = 40) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (needle.length < 2) return [];
  const scored = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!isRecord(entry)) continue;
    const title = String(entry.title || '').toLowerCase();
    const terms = String(entry.terms || '').toLowerCase();
    const inTitle = title.indexOf(needle);
    const inTerms = terms.indexOf(needle);
    if (inTitle === -1 && inTerms === -1) continue;
    scored.push({
      entry,
      rank: inTitle === 0 ? 0 : inTitle > 0 ? 1 : 2,
      at: inTitle === -1 ? inTerms : inTitle,
    });
  }
  scored.sort((a, b) => a.rank - b.rank
    || a.at - b.at
    || String(a.entry.title).length - String(b.entry.title).length
    || String(a.entry.title).localeCompare(String(b.entry.title)));
  return scored.slice(0, Math.max(0, Math.floor(Number(limit)) || 0)).map((row) => row.entry);
}

export const DEFAULT_SETTINGS = Object.freeze({
  schema: SETTINGS_SCHEMA,
  // Recorded rather than defaulted to VERSION: a fresh profile has seen nothing,
  // and claiming otherwise would announce an update that never happened.
  lastSeenVersion: '',
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
    // Ids from HIDEABLE_ELEMENTS. Empty by default: nothing of Kick's own
    // chrome disappears until someone asks for it by name.
    hidden: [],
    miniPlayerCollision: true,
    playerResizeRecovery: true,
    playerContainVideo: true,
  }),
  appearance: Object.freeze({
    theme: 'studio',
    accent: 'kick',
    customAccent: '#FF5CA8',
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
    // Off by default, and opt-in for the same reason Poor mode is: it spends
    // the user's bandwidth on their behalf. It also learns before it acts —
    // see QUALITY_LADDER_KEY in the runtime.
    preferBestQuality: false,
    rememberVodPosition: true,
    // On: it reads a field Kick already sends with the channel payload and
    // shows it, which is the whole feature. No extra request, no polling.
    showUptime: true,
    showVodExpiry: true,
    stickyChatPause: false,
    chatHighlights: false,
    // Five chat comfort switches, each independent and each off until asked
    // for. The history one is off for a stronger reason than the rest: it is
    // the only one that keeps anything, and what it would keep is other
    // people's messages.
    chatTimestamps: false,
    chatPriorityPeople: [],
    chatMentionSound: false,
    chatHideMessages: false,
    chatHistory: false,
    // The setting persists. The messages never do: runtime keeps only this
    // tab's last five sends in memory and a reload drops them.
    chatComposerRecall: false,
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
    // Acts on the user's behalf, so it is opt-in like the two above. It clicks
    // Kick's own claim button in Kick's own dialog and nothing else — it cannot
    // claim a reward the account has not earned, because a disabled button is
    // Kick refusing and this obeys it.
    autoClaimRewards: false,
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

export const VIEWING_PRESETS = Object.freeze({
  calm: Object.freeze({
    layout: Object.freeze({ sidebar: 'compact', chat: 'right', chatWidth: 410, density: 'comfortable', streamStart: 'standard', wideGrid: true }),
    appearance: Object.freeze({ theme: 'studio', accent: 'cyan', radius: 'balanced', thumbnail: 34, interfaceScale: 100, dimWatched: true, strongContrast: true, colorizeLive: false }),
  }),
  cinema: Object.freeze({
    layout: Object.freeze({ sidebar: 'hidden', chat: 'hidden', density: 'comfortable', streamStart: 'theater', wideGrid: true }),
    appearance: Object.freeze({ theme: 'oled', accent: 'gold', radius: 'subtle', thumbnail: 50, interfaceScale: 100, dimWatched: true, strongContrast: true, colorizeLive: true }),
  }),
  chat: Object.freeze({
    layout: Object.freeze({ sidebar: 'compact', chat: 'docked', chatWidth: 480, density: 'compact', streamStart: 'standard', wideGrid: false }),
    appearance: Object.freeze({ theme: 'slate', accent: 'violet', radius: 'balanced', thumbnail: 46, interfaceScale: 100, dimWatched: false, strongContrast: true, colorizeLive: true }),
  }),
  discovery: Object.freeze({
    layout: Object.freeze({ sidebar: 'auto', chat: 'right', chatWidth: 380, density: 'compact', streamStart: 'standard', wideGrid: true, showFollowingRail: true, showRecommendedRail: true }),
    appearance: Object.freeze({ theme: 'studio', accent: 'kick', radius: 'balanced', thumbnail: 70, interfaceScale: 100, dimWatched: true, strongContrast: true, colorizeLive: true }),
  }),
});

/**
 * Kick's own controls a user may switch off, and the probe each resolves through.
 *
 * Hiding here is CSS only. The element stays in the DOM with its listeners
 * intact and comes back the instant the switch flips — nothing in this feature
 * clicks, removes, or reorders anything Kick rendered, so a hidden control is
 * never a control that stopped working.
 *
 * `probe` names a hook in `LOCATOR_PROBES`, which is what puts these selectors
 * under the same live drift gate as the rest of the shell. They are deliberately
 * *not* written as literals here: a second selector list is a second thing to
 * rot, and this one would rot silently because a control that fails to hide
 * looks exactly like a control the user never switched off.
 */
export const HIDEABLE_ELEMENTS = Object.freeze([
  Object.freeze({ id: 'player-pip', group: 'player', probe: 'playerPip', label: 'Miniplayer' }),
  Object.freeze({ id: 'player-clip', group: 'player', probe: 'playerClip', label: 'Clip' }),
  Object.freeze({ id: 'player-theatre', group: 'player', probe: 'playerTheatre', label: 'Theater mode' }),
  Object.freeze({ id: 'player-fullscreen', group: 'player', probe: 'playerFullscreen', label: 'Fullscreen' }),
  Object.freeze({ id: 'player-quality', group: 'player', probe: 'playerQuality', label: 'Quality menu' }),
  Object.freeze({ id: 'player-volume', group: 'player', probe: 'playerVolume', label: 'Volume' }),
  Object.freeze({ id: 'player-share', group: 'player', probe: 'playerShare', label: 'Share' }),
  Object.freeze({ id: 'player-report', group: 'player', probe: 'playerReport', label: 'Report' }),
  Object.freeze({ id: 'sidebar-home', group: 'sidebar', probe: 'sidebarHome', label: 'Home link' }),
  Object.freeze({ id: 'sidebar-browse', group: 'sidebar', probe: 'sidebarBrowse', label: 'Browse link' }),
  Object.freeze({ id: 'sidebar-following', group: 'sidebar', probe: 'sidebarFollowing', label: 'Following link' }),
  Object.freeze({ id: 'sidebar-drops', group: 'sidebar', probe: 'sidebarDrops', label: 'Drops link' }),
  Object.freeze({ id: 'sidebar-followed-channels', group: 'sidebar', probe: 'sidebarFollowedChannels', label: 'Followed channel list' }),
  Object.freeze({ id: 'sidebar-recommended-channels', group: 'sidebar', probe: 'sidebarRecommendedChannels', label: 'Recommended channel list' }),
]);

/** The groups the settings grid renders, in order, with their headings. */
export const HIDEABLE_GROUPS = Object.freeze([
  Object.freeze({ id: 'player', label: 'Player controls' }),
  Object.freeze({ id: 'sidebar', label: 'Sidebar' }),
]);

const HIDEABLE_ORDER = new Map(HIDEABLE_ELEMENTS.map((entry, index) => [entry.id, index]));

/**
 * Keep only ids this build actually knows how to find, in catalog order.
 *
 * Catalog order rather than the order they were clicked, so the exported value
 * is the same set however it was reached and a diff of two backups is readable.
 * An unknown id is dropped rather than kept: it would otherwise sit in the
 * settings file forever, matching nothing and explaining nothing.
 */
export function normalizeHiddenElements(input) {
  if (!Array.isArray(input)) return [];
  const kept = new Set();
  for (const value of input) {
    const id = typeof value === 'string' ? value.trim() : '';
    if (HIDEABLE_ORDER.has(id)) kept.add(id);
  }
  return [...kept].sort((a, b) => HIDEABLE_ORDER.get(a) - HIDEABLE_ORDER.get(b));
}

const QUALITY_ALIAS_HEIGHT = new Map([
  ['source', 100000],
  ['original', 100000],
  ['best', 100000],
  ['high', 720],
  ['medium', 480],
  ['low', 360],
]);

/**
 * Order Kick's quality labels so the highest one can be picked without knowing
 * the ladder in advance — Kick offers a different set per channel.
 *
 * `Auto` scores 0 on purpose. It is adaptive, so it is the *absence* of a
 * choice rather than a rung on the ladder, and treating it as the top would
 * make "always start at the highest quality" mean "change nothing". Anything
 * unrecognized scores -1 and is never chosen: guessing at an unknown label is
 * how a mod ends up writing a value the player rejects.
 */
export function qualityRank(label) {
  const text = String(label ?? '').trim().toLowerCase();
  if (!text) return -1;
  if (text === 'auto' || text.startsWith('auto ') || text.startsWith('auto(')) return 0;
  const match = text.match(/(\d{3,4})\s*p\s*(\d{2,3})?/);
  if (match) return Number(match[1]) * 1000 + Math.min(Number(match[2]) || 30, 999);
  const height = QUALITY_ALIAS_HEIGHT.get(text);
  return height ? height * 1000 + 30 : -1;
}

/**
 * The value Kick's player reads, which is not the label Kick displays.
 *
 * Measured on a live channel 2026-08-16 by picking each rung and reading the
 * key back: 720p60 writes `720`, 360p writes `360`, 160p writes `160`, and
 * Auto writes `0`. It is the bare height as a string, every time — so writing
 * the menu label into `sessionStorage['stream_quality']`, which is what this
 * build did before, hands the player a value it does not recognize.
 *
 * A rank that decodes to an implausible height is the alias table's synthetic
 * one (`Source`), not a real rung, so it returns '' rather than inventing a
 * number: that rung can still be clicked, it just cannot be pre-seeded.
 */
export function qualitySessionValue(label) {
  const rank = qualityRank(label);
  if (rank < 0) return '';
  if (rank === 0) return '0';
  const height = Math.floor(rank / 1000);
  return height > 0 && height <= 4320 ? String(height) : '';
}

/** The best real option in a list, or '' when the list holds nothing rankable. */
export function bestQualityOption(labels) {
  let best = '';
  let bestRank = 0;
  for (const label of Array.isArray(labels) ? labels : []) {
    const rank = qualityRank(label);
    if (rank > bestRank) {
      bestRank = rank;
      best = String(label).trim();
    }
  }
  return best;
}

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

const CUSTOM_ACCENT_FALLBACK = '#FF5CA8';
const CUSTOM_ACCENT_SURFACES = Object.freeze(['#000000', '#080B09', '#141817']);

function rgbFromHex(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(value || '').trim());
  if (!match) return null;
  const number = Number.parseInt(match[1], 16);
  return {
    red: (number >> 16) & 255,
    green: (number >> 8) & 255,
    blue: number & 255,
  };
}

function relativeLuminance({ red, green, blue }) {
  const linear = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function colorContrastRatio(first, second) {
  const a = rgbFromHex(first);
  const b = rgbFromHex(second);
  if (!a || !b) return 0;
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * A custom accent is a focus indicator and a control boundary, not decoration.
 * WCAG 2.2 requires 3:1 against adjacent colors for those non-text roles, so a
 * valid but too-dark picker value falls back to a known-safe rose rather than
 * quietly making focus and selected states disappear in one of the dark themes.
 */
export function normalizeCustomAccent(value, fallback = CUSTOM_ACCENT_FALLBACK) {
  const parsed = rgbFromHex(value);
  const normalizedFallback = rgbFromHex(fallback) ? String(fallback).toUpperCase() : CUSTOM_ACCENT_FALLBACK;
  if (!parsed) return normalizedFallback;
  const normalized = `#${[parsed.red, parsed.green, parsed.blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  return CUSTOM_ACCENT_SURFACES.every((surface) => colorContrastRatio(normalized, surface) >= 3)
    ? normalized
    : normalizedFallback;
}

export function customAccentTokens(value) {
  const hex = normalizeCustomAccent(value);
  const rgb = rgbFromHex(hex);
  const darkInk = '#000000';
  const lightInk = '#FFFFFF';
  const onAccent = colorContrastRatio(hex, darkInk) >= colorContrastRatio(hex, lightInk) ? darkInk : lightInk;
  return Object.freeze({ hex, rgb: `${rgb.red}, ${rgb.green}, ${rgb.blue}`, onAccent });
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
 * A stream's elapsed time as `h:mm:ss`, or `mm:ss` under an hour.
 *
 * Returns '' for a start that is missing, in the future, or implausibly old, so
 * the caller can use it as a presence test. The ceiling is deliberate: a stale
 * `start_time` on a re-used livestream record would otherwise render a clock
 * counting into the hundreds of hours, which reads as a bug in the mod rather
 * than as bad data from Kick. Fourteen days is well past the longest
 * subathons and far short of a parse error.
 */
export const MAX_UPTIME_MS = 14 * 24 * 60 * 60 * 1000;

export function formatUptime(startedAt, now = Date.now()) {
  if (!Number.isFinite(startedAt) || startedAt <= 0) return '';
  const elapsed = now - startedAt;
  if (elapsed < 0 || elapsed > MAX_UPTIME_MS) return '';
  const total = Math.floor(elapsed / 1000);
  const seconds = String(total % 60).padStart(2, '0');
  const minutes = total >= 3600 ? String(Math.floor(total / 60) % 60).padStart(2, '0') : String(Math.floor(total / 60));
  const hours = Math.floor(total / 3600);
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

/**
 * How long Kick keeps a VOD before deleting it, by the channel's verification.
 *
 * Kick offers no download to anyone — including the broadcaster — and shows
 * this countdown nowhere, which is what makes it worth surfacing at all.
 *
 * `verified` must be a real boolean. Defaulting it would be the whole defect
 * this guards: 7 and 30 are four-fold apart, so a guess is not a smaller
 * version of the right answer, it is a wrong deadline stated confidently. A
 * caller that does not know returns null and the surface stays silent.
 */
export const VOD_RETENTION_DAYS = { verified: 30, unverified: 7 };
const DAY_MS = 24 * 60 * 60 * 1000;

export function vodExpiry(startedAt, verified, now = Date.now()) {
  if (!Number.isFinite(startedAt) || startedAt <= 0) return null;
  if (typeof verified !== 'boolean') return null;
  const days = verified ? VOD_RETENTION_DAYS.verified : VOD_RETENTION_DAYS.unverified;
  const expiresAt = startedAt + days * DAY_MS;
  // A recording dated in the future is Kick's clock disagreeing with the
  // viewer's, not a VOD with extra life; refuse it rather than render it.
  if (startedAt > now + DAY_MS) return null;
  return { expiresAt, remaining: expiresAt - now, days, expired: expiresAt <= now };
}

/**
 * The remaining window as a short label, in the largest unit that stays honest.
 *
 * Days above two, then hours, then minutes — a "7 days left" that silently
 * means 7.9 is fine at that range and misleading at one hour, which is why the
 * unit narrows as the deadline approaches. Returns '' once the window has
 * closed, so the caller can use it as a presence test exactly like
 * `formatUptime`.
 */
export function formatVodRetention(remaining) {
  if (!Number.isFinite(remaining) || remaining <= 0) return '';
  const minutes = Math.floor(remaining / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours >= 48) return `${Math.floor(hours / 24)}d`;
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(1, minutes)}m`;
}

/**
 * The merged multi-channel chat buffer.
 *
 * Ordered by *arrival*, not by any timestamp the sender chose. Nine channels
 * mean nine independent connections whose clocks and latencies differ, and
 * Kick's own message timestamps are zone-less strings written by whichever
 * server took the message — sorting by them would shuffle the reading order
 * for no gain. What a reader wants is the order they would have seen if they
 * were watching all nine, which is arrival order.
 *
 * Capped from the front, because a busy grid produces messages faster than
 * anyone reads them and an uncapped array is a memory leak with a scrollbar.
 */
export const MERGED_CHAT_CAP = 300;

export function appendMergedMessage(entries, entry, cap = MERGED_CHAT_CAP) {
  const list = Array.isArray(entries) ? entries : [];
  if (!entry || typeof entry !== 'object') return list;
  const slug = typeof entry.slug === 'string' ? entry.slug : '';
  const id = typeof entry.id === 'string' ? entry.id : '';
  const text = typeof entry.text === 'string' ? entry.text : '';
  if (!slug || !text) return list;
  // Kick replays recent history on reconnect, so the same message can arrive
  // twice on one channel. Keyed by channel *and* id: two channels can carry the
  // same id and they are different messages.
  if (id && list.some((seen) => seen.id === id && seen.slug === slug)) return list;
  const next = list.concat({
    slug,
    id,
    text,
    sender: typeof entry.sender === 'string' ? entry.sender : '',
    color: typeof entry.color === 'string' ? entry.color : '',
    at: Number.isFinite(entry.at) ? entry.at : 0,
  });
  const limit = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : MERGED_CHAT_CAP;
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** Drop everything from a channel that is no longer in the grid. */
export function dropMergedChannel(entries, slug) {
  if (!Array.isArray(entries) || typeof slug !== 'string' || !slug) return Array.isArray(entries) ? entries : [];
  return entries.filter((entry) => entry.slug !== slug);
}

/**
 * Where an emote can be sent, which is a different question from whether the
 * account owns it — and the one Kick's interface never answers.
 *
 * Measured 2026-08-16 by posting each kind into a real chatroom: a *free*
 * channel emote is refused outside its own channel (`FOREIGN_CHANNEL_EMOTE_-
 * ERROR`), while a subscriber emote the account owns is accepted everywhere.
 * So "channel-only" and "subscriber-only" are not two points on one scale;
 * they are reach and ownership, and a picker that shows only the second leaves
 * users typing an emote that silently never arrives.
 *
 * Returns '' when the catalog has not established reach — an entry recorded
 * from chat alone, or written before this was known. Saying nothing is correct
 * there; a guess would be indistinguishable from a measurement.
 *
 * The channel name is returned separately rather than pasted into the sentence.
 * An interpolated string matches no dictionary entry, which is how a line ends
 * up permanently English while the i18n gate — which only scans fixed literals
 * — stays green.
 */
export function emoteReach(entry) {
  if (!isRecord(entry)) return { text: '', channel: '' };
  // An emote the account cannot send has no useful reach to report. Kick's flag
  // still says "platform-wide", because that is what a subscriber emote is *to
  // a subscriber* — printing it beside "Subscriber-only" told a user who cannot
  // send it at all that it works everywhere. The lock reason is the answer
  // there, and it already says how to unlock it.
  if (entry.usableHere === false) return { text: '', channel: '' };
  if (entry.usableEverywhere === true) return { text: 'Works in every chat', channel: '' };
  if (entry.usableEverywhere !== false) return { text: '', channel: '' };
  const source = typeof entry.sourceSlug === 'string' && entry.sourceSlug ? entry.sourceSlug : '';
  return source
    ? { text: 'Only works in {channel}’s chat', channel: source }
    : { text: 'Only works in its own channel', channel: '' };
}

/**
 * The account-level collection Kick's native picker never assembles.
 *
 * Ownership and reach are both required: an observed free emote may be usable
 * on its own channel without being part of the account's portable collection,
 * while an owned subscriber or collectible emote is available and usable in
 * every chat. Group labels come from the source channel first, then Kick's set
 * name for global/collectible sets. Nothing is invented when both are absent.
 */
export function ownedEmoteGroups(entries) {
  const groups = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!isRecord(entry) || entry.access !== 'available' || entry.usableEverywhere !== true) continue;
    const source = typeof entry.sourceSlug === 'string' ? entry.sourceSlug.trim().toLowerCase() : '';
    const nativeGroup = Array.isArray(entry.nativeGroups)
      ? entry.nativeGroups.find((value) => typeof value === 'string' && value.trim())?.trim() || ''
      : '';
    const label = source || nativeGroup || 'Collectibles & global';
    const key = source ? `channel:${source}` : `set:${label.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { key, label, source, entries: [] });
    groups.get(key).entries.push(entry);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      entries: group.entries.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base' })),
    }))
    .sort((left, right) => {
      if (Boolean(left.source) !== Boolean(right.source)) return left.source ? 1 : -1;
      return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
    });
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
  const reach = emoteReach(entry);
  if (reach.text) lines.push(reach.text.replace('{channel}', reach.channel));
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
    lines.push(winner ? `Name shadowed. Typing it sends ${winner}` : 'Name shadowed by another set');
  }
  lines.push(saved ? 'Saved. Click to open in the library' : 'Click to save');
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
        ? `Another set shadows ${name}. Typing it sends ${winner}'s emote.`
        : `Another set shadows ${name}, so typing it may send a different emote.`)
      : '';
  return { ok: true, text: name, warning, sendable, reason: '' };
}

// ---------------------------------------------------------------------------
// Daily reward claim
//
// Kick's daily reward is a header button that opens a dialog with one action
// button, disabled until enough watch time has accrued. The claim itself is a
// POST from inside Kick's own bundle, so this drives the dialog rather than the
// endpoint: the same rule the rest of this build follows, and the reason the
// feature needs no new permission and can never claim something the account has
// not earned — a disabled button is Kick saying no, and it is obeyed.
//
// The decision is here, where it is testable without a browser. The runtime
// only carries it out.
// ---------------------------------------------------------------------------

/**
 * The reward is a roulette reveal, so its action button is labelled with
 * whichever verb that reward uses.
 */
export const CLAIM_ACTION = /^\s*(claim|open|spin|reveal|collect)\b/i;
const CLAIM_COUNTDOWN = /watch\s+(\d+)\s+more\s+minute/i;

/**
 * Fallback interval, used only when Kick told us nothing usable.
 *
 * Almost every path schedules from real information instead: the dialog's own
 * "Watch N more minutes" countdown, or the nightly reset. Polling on a fixed
 * timer is the thing this deliberately avoids — the apply cycle runs on every
 * route change and every few seconds of DOM churn, and opening Kick's dialog at
 * that rate fights the user for focus to re-read a number that barely moves.
 */
export const CLAIM_RECHECK_MS = 10 * 60 * 1000;

/**
 * The hour the daily reward rolls over, in local time.
 *
 * Observed at 20:00. Watch time then has to accrue before the reward unlocks —
 * about an hour — so waking at the reset and reading the countdown there lands
 * the real attempt near 21:00 without that delay being hardcoded anywhere: the
 * reset schedules the wake-up, and the countdown schedules the claim.
 */
export const CLAIM_RESET_HOUR = 20;

/** The next time the reward rolls over, strictly after `now`. */
export function nextClaimResetAt(now, resetHour = CLAIM_RESET_HOUR) {
  const at = new Date(now);
  at.setHours(resetHour, 0, 0, 0);
  // Already past today's rollover (or exactly on it) — the next one is tomorrow.
  if (at.getTime() <= now) at.setDate(at.getDate() + 1);
  return at.getTime();
}

/**
 * When to look again, given what the dialog just said.
 *
 * Three cases, and only the last one is a timer:
 * - **claimed** — nothing more is coming until the rollover, so sleep to it.
 * - **counted** — Kick published the minutes remaining; wait that long (plus a
 *   minute, so we do not arrive just before it flips) and no longer than the
 *   rollover, which also absorbs a nonsense figure.
 * - **collected** — the dialog rendered, but with no action and no countdown.
 *   That is what an already-taken reward looks like, including one taken by
 *   hand in another tab, so it sleeps to the rollover too rather than
 *   rechecking all day.
 *
 * Anything else — an empty dialog, a shape we do not recognise — is a possible
 * render race, and only that gets the fixed fallback.
 */
export function nextRewardCheckAt(facts = {}) {
  const { outcome, now = 0, minutesRemaining = null, dialogText = '', resetHour = CLAIM_RESET_HOUR } = facts;
  const reset = nextClaimResetAt(now, resetHour);
  if (outcome === 'claimed') return reset;
  if (Number.isFinite(minutesRemaining) && minutesRemaining > 0) {
    return Math.min(now + (minutesRemaining + 1) * 60_000, reset);
  }
  // A dialog with real text but nothing to claim and nothing counting down is
  // a reward that is already gone. An empty one is a race, not an answer.
  if (String(dialogText).trim().length > 0) return reset;
  return now + CLAIM_RECHECK_MS;
}

/** "Watch 54 more minutes to claim" → 54. */
export function parseClaimCountdown(text) {
  const match = CLAIM_COUNTDOWN.exec(String(text ?? ''));
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? minutes : null;
}

/**
 * Decide what the auto-claim should do from observable facts alone.
 *
 * Returns one of:
 * - `absent`   — no reward trigger on the page (logged out, or nothing to claim)
 * - `cooling`  — looked recently; do not reopen the dialog
 * - `wait`     — the dialog is open and the action is disabled: Kick says not yet
 * - `claim`    — the action is present and enabled; clicking it is the whole feature
 *
 * `enabled` is the user's setting. Everything here is deliberately conservative:
 * anything unrecognised resolves to `wait`, never to `claim`.
 */
export function decideRewardClaim(facts = {}) {
  const {
    enabled = false,
    hasTrigger = false,
    dialogOpen = false,
    hasAction = false,
    actionDisabled = true,
    now = 0,
    nextCheckAt = 0,
  } = facts;

  if (!enabled) return { action: 'absent', reason: 'off' };
  if (!hasTrigger) return { action: 'absent', reason: 'no-trigger' };
  if (!dialogOpen) {
    // One timestamp decides this, and it was written from what Kick last said
    // — the countdown, or the rollover. There is no polling interval to tune.
    if (nextCheckAt > now) return { action: 'cooling', reason: 'not-due' };
    return { action: 'open', reason: 'due' };
  }
  if (!hasAction) return { action: 'wait', reason: 'no-action-button' };
  if (actionDisabled) return { action: 'wait', reason: 'not-ready' };
  return { action: 'claim', reason: 'ready' };
}

// ---------------------------------------------------------------------------
// Viewer hub
//
// One read-only summary of what Kick already tells this account, assembled from
// values the page is showing and reads this build already makes. It adds no
// endpoint, claims nothing, and changes nothing.
//
// The whole design is in the card states, and the reason is a failure mode this
// project has hit before: a summary that renders an absent number as zero. A
// viewer with no reward waiting and a viewer whose reward state could not be
// read look identical at that point, and the second one is a lie. So a value
// reaches a card only when it was actually measured, every card carries where
// it came from and when, and "not known" is a state with its own words rather
// than a default.
//
// Cards are independent by construction: each is derived from its own fact,
// inside its own try, so a card that throws becomes one card in `error` and the
// other five still render. That is the difference between a hub and a hub-shaped
// blank page.
//
// The decisions live here, where they are testable without a browser. The
// runtime supplies the facts and turns the returned codes into copy.
// ---------------------------------------------------------------------------

/** The seven cards, in the order they are shown. `source` is where the value comes from. */
export const VIEWER_HUB_CARDS = Object.freeze([
  Object.freeze({ id: 'reward', source: 'dom' }),
  Object.freeze({ id: 'points', source: 'dom' }),
  Object.freeze({ id: 'collectibles', source: 'api' }),
  Object.freeze({ id: 'drops', source: 'dom' }),
  Object.freeze({ id: 'level', source: 'dom' }),
  Object.freeze({ id: 'streak', source: 'dom' }),
  Object.freeze({ id: 'watch', source: 'local' }),
]);

/**
 * The hub's own copy, kept here with the card definitions.
 *
 * In core rather than beside the markup so `test/i18n-coverage.test.js` can see
 * it: these strings reach the DOM through a lookup rather than as literals, and
 * the scanners that read `runtime.js` cannot find a string that is never
 * written there. Same reason the hideable-element labels live in a catalog.
 */
export const VIEWER_HUB_TITLES = Object.freeze({
  reward: 'Daily reward',
  points: 'Channel points',
  collectibles: 'Collectibles',
  drops: 'Drops',
  level: 'Level',
  streak: 'Streak',
  watch: 'Session watch time',
});

/** What a card says instead of a number. One sentence, and it names the cause. */
export const VIEWER_HUB_REASONS = Object.freeze({
  'not-read': 'Not read yet on this page.',
  anonymous: 'Kick shows this to a signed-in account only.',
  'off-channel': 'Open a channel to see its points.',
  'off-route': 'Open Drops to count the campaigns waiting.',
  'dialog-closed': 'Kick shows this inside the daily reward dialog only.',
  'not-shown': 'The reward dialog did not show a figure this time.',
  'read-failed': 'Kick did not answer that read. Nothing was changed.',
  threw: 'This card could not be built. The rest of the hub is unaffected.',
});

/** The reward card has words rather than a number, because the state is not a quantity. */
export const VIEWER_HUB_REWARD_WORDS = Object.freeze({
  claimed: 'Claimed today',
  waiting: 'Not ready yet',
  available: 'Ready to claim',
});

/**
 * How long a reading stays current.
 *
 * Not a polling interval — nothing here polls, and the hub reads only while it
 * is open. This is how long a value may still be *shown* before it is labelled
 * as an old reading, so a number that stopped updating is visibly old instead of
 * quietly wrong.
 */
export const VIEWER_HUB_STALE_MS = 60_000;

/**
 * Advance the in-memory watch clock at one playback boundary.
 *
 * The record deliberately contains no wall-clock start for the browser
 * session itself and is never a storage shape. `activeSince` exists only so a
 * pause, hidden tab, or route change can bank the interval that just ended.
 */
export function advanceSessionWatchTime(record = {}, now = 0, active = false) {
  const at = Math.max(0, Number.isFinite(Number(now)) ? Number(now) : 0);
  let elapsedMs = Math.max(0, Number.isFinite(Number(record.elapsedMs)) ? Number(record.elapsedMs) : 0);
  const activeSince = Math.max(0, Number.isFinite(Number(record.activeSince)) ? Number(record.activeSince) : 0);
  if (!active) {
    if (activeSince && at >= activeSince) elapsedMs += at - activeSince;
    return Object.freeze({ elapsedMs, activeSince: 0 });
  }
  return Object.freeze({ elapsedMs, activeSince: activeSince || at });
}

/** The elapsed value including the interval that is still running. */
export function sessionWatchElapsed(record = {}, now = 0) {
  const elapsedMs = Math.max(0, Number.isFinite(Number(record.elapsedMs)) ? Number(record.elapsedMs) : 0);
  const activeSince = Math.max(0, Number.isFinite(Number(record.activeSince)) ? Number(record.activeSince) : 0);
  const at = Math.max(0, Number.isFinite(Number(now)) ? Number(now) : 0);
  return Math.round(elapsedMs + (activeSince && at >= activeSince ? at - activeSince : 0));
}

/** A clock-like session duration, kept separate from Kick's level vocabulary. */
export function formatSessionWatchTime(elapsedMs) {
  const seconds = Math.max(0, Math.floor((Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** A measured number, or null. `0` is a real answer here and survives; absent does not. */
function measured(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function card(id, source, state, extra = {}) {
  return {
    id,
    source: state === 'ready' ? source : 'none',
    state,
    value: null,
    reason: '',
    observedAt: 0,
    stale: false,
    ...extra,
  };
}

/** Was this reading taken recently enough to show without a caveat? */
function freshness(observedAt, now) {
  const at = measured(observedAt) || 0;
  if (!at) return { observedAt: 0, stale: true };
  return { observedAt: at, stale: now - at > VIEWER_HUB_STALE_MS };
}

const BUILDERS = {
  /**
   * The reward. `trigger` is Kick's own header control: absent means either a
   * signed-out page or a Kick that renamed it, and neither is a reward of zero.
   */
  reward(fact, now) {
    if (!fact) return card('reward', 'dom', 'unavailable', { reason: 'not-read' });
    if (fact.loading) return card('reward', 'dom', 'loading');
    if (!fact.trigger) return card('reward', 'dom', 'unavailable', { reason: 'anonymous' });
    const claimedAt = measured(fact.lastClaimAt);
    const nextAt = measured(fact.nextCheckAt);
    const rest = freshness(fact.observedAt, now);
    // Claimed since the last rollover: the one case where there is nothing to
    // wait for. `resetAt` is passed in rather than recomputed so the caller and
    // this agree about when the day turns over.
    const rolledOverAt = measured(fact.previousResetAt) || 0;
    if (claimedAt && claimedAt >= rolledOverAt) {
      return card('reward', 'dom', 'ready', { value: 'claimed', ...rest });
    }
    if (nextAt && nextAt > now) return card('reward', 'dom', 'ready', { value: 'waiting', ...rest });
    return card('reward', 'dom', 'ready', { value: 'available', ...rest });
  },

  /**
   * Channel points for the channel being watched.
   *
   * Kick renders the exact figure in a `title` and an abbreviated one in the
   * text, so the runtime prefers the attribute. Off a channel there is no
   * control and therefore no number — not a zero balance.
   */
  points(fact, now) {
    if (!fact) return card('points', 'dom', 'unavailable', { reason: 'not-read' });
    if (fact.loading) return card('points', 'dom', 'loading');
    if (!fact.onChannel) return card('points', 'dom', 'unavailable', { reason: 'off-channel' });
    const value = measured(fact.value);
    if (value === null) return card('points', 'dom', 'unavailable', { reason: 'anonymous' });
    return card('points', 'dom', 'ready', { value, channel: String(fact.channel || ''), ...freshness(fact.observedAt, now) });
  },

  /** The account's own collectible inventory. 401/403 is the signed-out answer, not an error. */
  collectibles(fact, now) {
    if (!fact) return card('collectibles', 'api', 'unavailable', { reason: 'not-read' });
    if (fact.loading) return card('collectibles', 'api', 'loading');
    if (fact.denied) return card('collectibles', 'api', 'unavailable', { reason: 'anonymous' });
    if (fact.failed) return card('collectibles', 'api', 'error', { reason: 'read-failed' });
    const owned = measured(fact.owned);
    if (owned === null) return card('collectibles', 'api', 'unavailable', { reason: 'not-read' });
    return card('collectibles', 'api', 'ready', {
      value: owned,
      copies: measured(fact.copies),
      ...freshness(fact.observedAt, now),
    });
  },

  /**
   * Drops. Off the Drops route there is no campaign list to count, so the card
   * says the surface exists and stops there rather than reporting zero
   * campaigns to somebody who simply is not looking at the page.
   */
  drops(fact, now) {
    if (!fact) return card('drops', 'dom', 'unavailable', { reason: 'not-read' });
    if (fact.loading) return card('drops', 'dom', 'loading');
    if (!fact.navPresent) return card('drops', 'dom', 'unavailable', { reason: 'anonymous' });
    if (!fact.onRoute) return card('drops', 'dom', 'unavailable', { reason: 'off-route' });
    const campaigns = measured(fact.campaigns);
    if (campaigns === null) return card('drops', 'dom', 'unavailable', { reason: 'not-read' });
    return card('drops', 'dom', 'ready', { value: campaigns, ...freshness(fact.observedAt, now) });
  },

  /** This browser tab's own playback clock. It is not a Kick level or account reading. */
  watch(fact, now) {
    if (!fact) return card('watch', 'local', 'unavailable', { reason: 'not-read' });
    const value = measured(fact.elapsedMs);
    if (value === null) return card('watch', 'local', 'unavailable', { reason: 'not-read' });
    return card('watch', 'local', 'ready', {
      value: Math.max(0, value),
      active: Boolean(fact.active),
      observedAt: measured(fact.observedAt) || now,
      stale: false,
    });
  },
};

/**
 * Level and streak share a builder because they share a constraint: Kick shows
 * both only inside the reward dialog, and this build opens that dialog on the
 * user's own auto-claim schedule and never for decoration. Outside it there is
 * nothing to read, and neither value is persisted to fill the gap — a level
 * kept from yesterday is a number that looks live and is not.
 */
function fromRewardDialog(id) {
  return (fact, now) => {
    if (!fact) return card(id, 'dom', 'unavailable', { reason: 'not-read' });
    if (fact.loading) return card(id, 'dom', 'loading');
    if (!fact.dialogOpen) return card(id, 'dom', 'unavailable', { reason: 'dialog-closed' });
    const value = measured(fact.value);
    if (value === null) return card(id, 'dom', 'unavailable', { reason: 'not-shown' });
    return card(id, 'dom', 'ready', { value, ...freshness(fact.observedAt, now) });
  };
}

BUILDERS.level = fromRewardDialog('level');
BUILDERS.streak = fromRewardDialog('streak');

/**
 * Build every card from the facts the runtime collected.
 *
 * One card per entry, always, in a fixed order: a hub that drops a card when
 * its source is missing is a hub whose shape changes under the reader, and the
 * missing card is precisely the one worth explaining.
 */
export function viewerHubCards(facts = {}, now = 0) {
  return VIEWER_HUB_CARDS.map(({ id, source }) => {
    try {
      const built = BUILDERS[id](facts[id], now);
      // A value may only ride on a `ready` card. This is the guard for the
      // failure this whole module exists to prevent: an absent reading arriving
      // at the interface as a number.
      if (built.state !== 'ready' && built.value !== null) built.value = null;
      return built;
    } catch {
      // One card's fault is one card's problem.
      return card(id, source, 'error', { reason: 'threw' });
    }
  });
}

/**
 * The one earned state worth marking outside the hub, or null.
 *
 * Deliberately narrow. Kick exposes exactly one thing a client can honestly
 * say is *earned and waiting*: a reward the account has not taken since the
 * rollover, and only because Kick's own control is on the page saying so. Every
 * other candidate is either unknown (a level nobody can read outside a dialog)
 * or a number that does not change (a collectible count).
 *
 * So there is no streak flourish, no progress bar toward a reward, no "you are
 * close" copy, and nothing at all for a signed-out page: with no reward control
 * there is no earned state, and inventing one would be a client pressuring
 * somebody on Kick's behalf. A card in any state but `ready` yields null.
 *
 * The label is the status in words. Whatever paints it may add a dot, a colour,
 * or a motion-safe pulse on top, but the sentence has to stand on its own —
 * colour is not a status and neither is an animation.
 */
export function earnedState(cards = []) {
  const reward = (Array.isArray(cards) ? cards : []).find((entry) => entry?.id === 'reward');
  if (!reward || reward.state !== 'ready' || reward.value !== 'available') return null;
  return { kind: 'reward-ready', label: 'Daily reward ready' };
}

/** How many cards actually have a reading. Used for the hub's own one-line summary. */
export function viewerHubSummary(cards = []) {
  const list = Array.isArray(cards) ? cards : [];
  return {
    ready: list.filter((entry) => entry.state === 'ready').length,
    total: list.length,
    errors: list.filter((entry) => entry.state === 'error').length,
    stale: list.filter((entry) => entry.state === 'ready' && entry.stale).length,
    // Named so diagnostics can say which half of the hub is speaking: a value
    // read off the page and one read from an endpoint fail for different
    // reasons and are worth telling apart when one of them stops arriving.
    fromDom: list.filter((entry) => entry.state === 'ready' && entry.source === 'dom').map((entry) => entry.id),
    fromApi: list.filter((entry) => entry.state === 'ready' && entry.source === 'api').map((entry) => entry.id),
    fromLocal: list.filter((entry) => entry.state === 'ready' && entry.source === 'local').map((entry) => entry.id),
  };
}

// ---------------------------------------------------------------------------
// Chat comfort
//
// Five small things a chat reader wants, each independent of the others and
// each off until asked for: a time beside a message, people worth noticing,
// a sound when something matches, a way to hide one message locally, and a
// search over what this session has seen.
//
// The last one is the one with teeth, and everything below is shaped by it.
// A searchable chat history is one careless decision away from being a
// transcript archive of other people's messages sitting in someone's browser
// forever, so it is bounded three ways at once — rows, bytes, and age — it
// holds only the main chatroom, it never leaves the machine without a
// deliberate action, and a message deleted by a moderator is dropped from it
// the moment that deletion is seen. A record of something Kick removed is
// exactly the thing not to keep.
// ---------------------------------------------------------------------------

/**
 * Three caps, applied together, because each catches what the others miss.
 *
 * Rows bound a quiet channel, bytes bound a channel where every message is a
 * wall of text, and age bounds a session left open overnight — a tab open for
 * eight hours should not still hold what was said in the first hour.
 */
export const CHAT_HISTORY_LIMITS = Object.freeze({
  rows: 400,
  bytes: 200_000,
  ageMs: 60 * 60 * 1000,
});

/** The longest single message worth keeping. Beyond this it is truncated, not dropped. */
export const CHAT_HISTORY_MAX_TEXT = 400;

/** Small by design. This is a composer convenience, not another chat log. */
export const COMPOSER_RECALL_LIMIT = 5;

/** Only the modified gesture belongs to this feature. Plain ArrowUp stays with Kick. */
export function isComposerRecallGesture(event = {}) {
  return event.key === 'ArrowUp'
    && event.shiftKey === true
    && event.altKey !== true
    && event.ctrlKey !== true
    && event.metaKey !== true;
}

/**
 * Keep one local send in a bounded ring. Private-message commands and an
 * explicitly private composer are refused before any text reaches the ring.
 */
export function appendComposerRecall(messages = [], value = '', whisper = false) {
  const list = (Array.isArray(messages) ? messages : [])
    .filter((message) => typeof message === 'string' && message.trim())
    .slice(-COMPOSER_RECALL_LIMIT);
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!text || whisper || /^\/(?:w|whisper|msg|pm)\b/i.test(text)) return list;
  return [...list, text].slice(-COMPOSER_RECALL_LIMIT);
}

/** Newest first and circular, so repeated Shift+Up never falls into an empty state. */
export function composerRecallAt(messages = [], index = 0) {
  const list = (Array.isArray(messages) ? messages : []).filter((message) => typeof message === 'string');
  if (!list.length) return '';
  const offset = Math.abs(Math.trunc(Number(index) || 0)) % list.length;
  return list[list.length - 1 - offset];
}

function historyBytes(rows) {
  let total = 0;
  for (const row of rows) total += (row.text?.length || 0) + (row.author?.length || 0) + 24;
  return total;
}

/**
 * Drop what no longer belongs: too old first, then oldest-first until the row
 * and byte caps are met.
 *
 * Age is applied before the other two on purpose. Trimming by count first can
 * leave an hour-old message in place because the list happened to be short,
 * and "we keep the last 400" is not the promise this makes.
 */
export function pruneChatHistory(rows = [], limits = CHAT_HISTORY_LIMITS, now = 0) {
  const list = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === 'object');
  const fresh = list.filter((row) => Number.isFinite(row.at) && now - row.at <= limits.ageMs);
  const capped = fresh.slice(Math.max(0, fresh.length - limits.rows));
  while (capped.length > 1 && historyBytes(capped) > limits.bytes) capped.shift();
  return capped;
}

/**
 * Record one message, or refuse it.
 *
 * Refusals are the interesting part: no id means nothing can ever delete it
 * again, and a whisper is a private message that has no business in a searchable
 * log at all. Both return the store unchanged rather than storing something
 * this module cannot later honour a deletion for.
 */
export function appendChatEntry(rows = [], entry = {}, limits = CHAT_HISTORY_LIMITS, now = 0) {
  const list = Array.isArray(rows) ? rows : [];
  const id = String(entry.id ?? '').trim();
  const text = String(entry.text ?? '').replace(/\s+/g, ' ').trim();
  if (!id || !text) return list;
  if (entry.whisper === true) return list;
  const at = Number.isFinite(entry.at) ? entry.at : now;
  // Kick recycles message nodes as chat scrolls, so the same id can be offered
  // more than once. The first sighting is the true one.
  if (list.some((row) => row.id === id)) return list;
  const row = {
    id,
    author: String(entry.author ?? '').slice(0, 40),
    text: text.slice(0, CHAT_HISTORY_MAX_TEXT),
    at,
    channel: String(entry.channel ?? '').slice(0, 64),
  };
  return pruneChatHistory([...list, row], limits, Math.max(now, at));
}

/**
 * Forget a message, because Kick did.
 *
 * Called from the same deletion path that already annotates a removed message
 * in the DOM. A history that outlives a moderator's decision is the one thing
 * this feature must never become.
 */
export function dropChatMessage(rows = [], id = '') {
  const wanted = String(id ?? '').trim();
  if (!wanted) return Array.isArray(rows) ? rows : [];
  return (Array.isArray(rows) ? rows : []).filter((row) => row.id !== wanted);
}

/** Newest first, so a search answers with what was just said before what was said an hour ago. */
export function searchChatHistory(rows = [], query = '', limit = 50) {
  const needle = String(query ?? '').trim().toLowerCase();
  const list = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === 'object');
  const matched = needle
    ? list.filter((row) => String(row.text).toLowerCase().includes(needle)
      || String(row.author).toLowerCase().includes(needle))
    : list;
  return matched.slice(-limit).reverse();
}

/** A comma or newline separated list of names, cleaned up and de-duplicated. */
export function parsePeopleList(value, max = 40) {
  const seen = new Set();
  for (const raw of String(value ?? '').split(/[\n,]/)) {
    const name = raw.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_][a-z0-9_-]{0,63}$/.test(name)) continue;
    seen.add(name);
    if (seen.size >= max) break;
  }
  return [...seen];
}

/** Is this message from somebody the reader asked to notice? */
export function isPriorityPerson(people = [], author = '') {
  const name = String(author ?? '').trim().replace(/^@/, '').toLowerCase();
  if (!name) return false;
  return (Array.isArray(people) ? people : []).some((entry) => String(entry).toLowerCase() === name);
}

/** The shortest gap between two sounds. A busy channel must not become a smoke alarm. */
export const MENTION_SOUND_GAP_MS = 4000;

/**
 * Should a sound play for this message?
 *
 * Every condition is a reason somebody would be annoyed if it were missing.
 * Off by default, only for a message that actually matched, never for the
 * reader's own message, silent while the tab is in the background (the browser
 * would queue a pile of them for the moment it is focused), and rate limited.
 */
export function shouldPlayMentionSound(facts = {}) {
  const {
    enabled = false,
    matched = false,
    own = false,
    hidden = false,
    now = 0,
    lastPlayedAt = 0,
  } = facts;
  if (!enabled || !matched || own || hidden) return false;
  return now - lastPlayedAt >= MENTION_SOUND_GAP_MS;
}

/** Local clock, 24-hour, because a chat line has no room for anything longer. */
export function formatChatTime(at, locale = undefined) {
  if (!Number.isFinite(at)) return '';
  try {
    return new Date(at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

/**
 * Place a floating preview beside its rail row without letting it leave the
 * viewport. The right side is preferred because Kick's followed rail normally
 * hugs the left edge; the left side is the fallback for mirrored layouts.
 */
export function floatingPreviewPosition(anchor = {}, preview = {}, viewport = {}, gap = 12) {
  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  const padding = Math.max(0, number(gap, 12));
  const viewportWidth = Math.max(0, number(viewport.width));
  const viewportHeight = Math.max(0, number(viewport.height));
  const previewWidth = Math.max(0, number(preview.width));
  const previewHeight = Math.max(0, number(preview.height));
  const anchorLeft = number(anchor.left);
  const anchorRight = number(anchor.right, anchorLeft + number(anchor.width));
  const anchorTop = number(anchor.top);
  const anchorHeight = Math.max(0, number(anchor.height, number(anchor.bottom) - anchorTop));
  const right = anchorRight + padding;
  const left = anchorLeft - padding - previewWidth;
  const side = right + previewWidth <= viewportWidth - padding || left < padding ? 'right' : 'left';
  const maxLeft = Math.max(padding, viewportWidth - previewWidth - padding);
  const maxTop = Math.max(padding, viewportHeight - previewHeight - padding);
  return Object.freeze({
    left: Math.round(Math.min(maxLeft, Math.max(padding, side === 'right' ? right : left))),
    top: Math.round(Math.min(maxTop, Math.max(padding, anchorTop + (anchorHeight - previewHeight) / 2))),
    side,
  });
}

/**
 * The history as a file the reader asked for, and nothing they did not.
 *
 * Plain text rather than JSON: this is somebody looking for what was said, not
 * a data interchange, and a format nobody can read by accident is a format
 * nobody checks before sharing.
 */
export function buildChatHistoryExport(rows = [], channel = '') {
  const list = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === 'object');
  const header = `Kick Focus chat log for ${channel || 'this session'}, ${list.length} messages`;
  const lines = list.map((row) => `[${formatChatTime(row.at)}] ${row.author || 'unknown'}: ${row.text}`);
  return [header, ...lines].join('\n');
}

// ---------------------------------------------------------------------------
// Discovery layouts
//
// A layout is a named snapshot of the settings that decide how a discovery page
// looks and what it leaves out, plus the routes it belongs to. Browse can be
// dense and unfiltered while Home stays calm, without either being re-tuned by
// hand every time.
//
// It is worth saying plainly what this is not, because the shape invites the
// confusion: it changes nothing about what Kick recommends. Every value here is
// already a setting in this build, applied to markup Kick has already sent. No
// layout reorders a rail, asks Kick for different cards, or knows anything
// about why a card is on the page.
// ---------------------------------------------------------------------------

/**
 * The settings a layout may carry, and nothing else.
 *
 * An explicit list rather than "whatever was in the object": a layout is
 * restored into live settings, so an unbounded key set would be a path from a
 * file somebody imported to any setting in the build.
 */
export const DISCOVERY_LAYOUT_KEYS = Object.freeze([
  'layout.density',
  'layout.wideGrid',
  'layout.showFollowingRail',
  'layout.showRecommendedRail',
  'appearance.thumbnail',
  'appearance.dimWatched',
  'content.hideCasino',
  'content.blurMature',
  'content.hideDropsPromotions',
  'content.suppressPromoted',
]);

/** The discovery routes a layout can belong to. */
export const DISCOVERY_LAYOUT_ROUTES = Object.freeze(['home', 'browse', 'category', 'following', 'search']);

/**
 * What each route is called in the interface.
 *
 * Here rather than beside the markup for the same reason the viewer hub's copy
 * is: these reach the DOM through a lookup keyed by route, so no literal of any
 * of them exists in runtime.js for the translation gate's scanners to find.
 */
export const DISCOVERY_ROUTE_LABELS = Object.freeze({
  home: 'Home',
  browse: 'Browse',
  category: 'Category pages',
  following: 'Following',
  search: 'Search results',
});

/** How many layouts are worth keeping. Past this it is a list nobody reads. */
export const DISCOVERY_LAYOUT_MAX = 12;
export const DISCOVERY_LAYOUT_NAME_MAX = 40;

function settingAt(settings, path) {
  const [group, key] = String(path).split('.');
  const owner = settings && typeof settings === 'object' ? settings[group] : null;
  return owner && typeof owner === 'object' ? owner[key] : undefined;
}

/** A layout's name, cleaned to something that can sit in a list and in a label. */
export function cleanLayoutName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, DISCOVERY_LAYOUT_NAME_MAX);
}

/**
 * Capture the current view as a layout.
 *
 * Only the keys above, only from the settings handed in, and only the routes
 * asked for. A layout with no routes is legal and simply never applies itself —
 * it is a saved view somebody switches to by hand.
 */
export function buildDiscoveryLayout(name, settings, routes = []) {
  const values = {};
  for (const path of DISCOVERY_LAYOUT_KEYS) {
    const value = settingAt(settings, path);
    if (value !== undefined) values[path] = value;
  }
  return {
    name: cleanLayoutName(name) || 'Saved view',
    routes: (Array.isArray(routes) ? routes : []).filter((route) => DISCOVERY_LAYOUT_ROUTES.includes(route)),
    values,
  };
}

/**
 * Clean a stored or imported list of layouts.
 *
 * Every value is checked against the type of the current setting rather than
 * taken as written, so a layout carrying a string where a number belongs is
 * dropped at that key instead of being pushed into live settings — a saved view
 * is a file that round-trips through export and import like everything else
 * here, and it arrives from wherever that file has been.
 */
export function normalizeDiscoveryLayouts(input, settings) {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const name = cleanLayoutName(entry.name);
    if (!name || seen.has(name.toLowerCase())) continue;
    const values = {};
    const source = entry.values && typeof entry.values === 'object' ? entry.values : {};
    for (const path of DISCOVERY_LAYOUT_KEYS) {
      const value = source[path];
      const current = settingAt(settings, path);
      if (value === undefined || current === undefined) continue;
      if (typeof value !== typeof current) continue;
      values[path] = value;
    }
    if (!Object.keys(values).length) continue;
    seen.add(name.toLowerCase());
    out.push({
      name,
      routes: (Array.isArray(entry.routes) ? entry.routes : []).filter((route) => DISCOVERY_LAYOUT_ROUTES.includes(route)),
      values,
    });
    if (out.length >= DISCOVERY_LAYOUT_MAX) break;
  }
  return out;
}

/**
 * The layout to apply on a route, or null.
 *
 * First match wins, and the order is the order the user put them in, so
 * "the one nearer the top" is the answer to two layouts claiming Browse rather
 * than something the reader has to work out.
 */
export function layoutForRoute(layouts = [], route = '') {
  if (!DISCOVERY_LAYOUT_ROUTES.includes(route)) return null;
  return (Array.isArray(layouts) ? layouts : []).find((entry) => entry?.routes?.includes(route)) || null;
}

/**
 * Merge a layout into settings, returning what changed.
 *
 * Returns the paths it actually moved rather than a boolean, because the
 * interface says what happened and "applied Calm" is a weaker sentence than
 * naming the two things that are now different.
 */
export function applyDiscoveryLayout(settings, layout) {
  const changed = [];
  if (!layout || typeof layout !== 'object') return changed;
  for (const path of DISCOVERY_LAYOUT_KEYS) {
    const value = layout.values?.[path];
    if (value === undefined) continue;
    const [group, key] = path.split('.');
    if (!settings?.[group] || settings[group][key] === value) continue;
    settings[group][key] = value;
    changed.push(path);
  }
  return changed;
}

/** Is this layout what the settings currently say? Used to mark the active one. */
export function layoutMatchesSettings(layout, settings) {
  if (!layout || typeof layout !== 'object') return false;
  const entries = Object.entries(layout.values || {});
  if (!entries.length) return false;
  return entries.every(([path, value]) => settingAt(settings, path) === value);
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
/**
 * Will Kick refuse this emote in this channel, as a matter of record?
 *
 * Two refusals were measured against a real chatroom on 2026-08-16 and they are
 * the whole model: `SUBSCRIBERS_ONLY_EMOTE_ERROR` for a subscriber emote the
 * account does not own, and `FOREIGN_CHANNEL_EMOTE_ERROR` for a *free* channel
 * emote used outside its own channel. Offering either is offering something the
 * user will watch bounce.
 *
 * Only positive knowledge filters. An anonymous read cannot answer "can I send
 * this" — it returns the same shape for an emote the account owns and one it
 * never will — so an unknown reach is offered exactly as it is today. Hiding on
 * uncertainty would empty the list for every signed-out user, which is the
 * opposite of the fix.
 */
export function completionWouldBounce(entry, channel = '') {
  if (!isRecord(entry)) return false;
  // Kick says this account cannot send it where it is standing.
  if (entry.usableHere === false) return true;
  // A free channel emote: usable in its own channel and refused everywhere else.
  if (entry.usableEverywhere !== false) return false;
  const source = typeof entry.sourceSlug === 'string' ? entry.sourceSlug : '';
  const here = typeof channel === 'string' ? channel : '';
  if (!source || !here) return false;
  return source.toLowerCase() !== here.toLowerCase();
}

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
    // Nothing that Kick is on record as refusing here. The reach data has been
    // on every catalog record since v1.20.0; this is the ranker finally reading
    // it, so the list stops offering emotes that bounce.
    if (completionWouldBounce(candidate, channel)) continue;
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
    lastSeenVersion: normalizeVersion(source.lastSeenVersion),
    layout: {
      sidebar,
      chat: enumValue(layout.chat, ['right', 'left', 'docked', 'hidden'], defaults.layout.chat),
      chatWidth,
      density: enumValue(layout.density, ['comfortable', 'compact'], defaults.layout.density),
      streamStart: enumValue(layout.streamStart, ['standard', 'theater', 'focus'], defaults.layout.streamStart),
      rememberPerChannel: bool(layout.rememberPerChannel, defaults.layout.rememberPerChannel),
      wideGrid: bool(layout.wideGrid, defaults.layout.wideGrid),
      stickyTopbar: bool(layout.stickyTopbar, defaults.layout.stickyTopbar),
      quickButton: bool(layout.quickButton, defaults.layout.quickButton),
      showFollowingRail: bool(layout.showFollowingRail, defaults.layout.showFollowingRail),
      showRecommendedRail: bool(layout.showRecommendedRail, defaults.layout.showRecommendedRail),
      hidden: normalizeHiddenElements(layout.hidden),
      miniPlayerCollision: bool(layout.miniPlayerCollision, defaults.layout.miniPlayerCollision),
      playerResizeRecovery: bool(layout.playerResizeRecovery, defaults.layout.playerResizeRecovery),
      playerContainVideo: bool(layout.playerContainVideo, defaults.layout.playerContainVideo),
    },
    appearance: {
      theme: enumValue(appearance.theme, ['studio', 'oled', 'slate'], defaults.appearance.theme),
      accent: enumValue(appearance.accent, ['kick', 'cyan', 'violet', 'gold', 'custom'], defaults.appearance.accent),
      customAccent: normalizeCustomAccent(appearance.customAccent, defaults.appearance.customAccent),
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
      preferBestQuality: bool(content.preferBestQuality, defaults.content.preferBestQuality),
      rememberVodPosition: bool(content.rememberVodPosition, defaults.content.rememberVodPosition),
      showUptime: bool(content.showUptime, defaults.content.showUptime),
      showVodExpiry: bool(content.showVodExpiry, defaults.content.showVodExpiry),
      stickyChatPause: bool(content.stickyChatPause, defaults.content.stickyChatPause),
      chatHighlights: bool(content.chatHighlights, defaults.content.chatHighlights),
      chatTimestamps: bool(content.chatTimestamps, defaults.content.chatTimestamps),
      // Parsed rather than trusted: this is the one chat setting a person types
      // into, and the same cleaning runs whether it arrives from the field, an
      // imported file, or a record written by an older build.
      chatPriorityPeople: parsePeopleList(content.chatPriorityPeople),
      chatMentionSound: bool(content.chatMentionSound, defaults.content.chatMentionSound),
      chatHideMessages: bool(content.chatHideMessages, defaults.content.chatHideMessages),
      chatHistory: bool(content.chatHistory, defaults.content.chatHistory),
      chatComposerRecall: bool(content.chatComposerRecall, defaults.content.chatComposerRecall),
      organizeChatStickers: bool(content.organizeChatStickers, defaults.content.organizeChatStickers),
      clickChatEmotes: bool(content.clickChatEmotes, defaults.content.clickChatEmotes),
      insertEmoteName: bool(content.insertEmoteName, defaults.content.insertEmoteName),
    emoteAutocomplete: bool(content.emoteAutocomplete, defaults.content.emoteAutocomplete),
    autoClaimRewards: bool(content.autoClaimRewards, defaults.content.autoClaimRewards),
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

/** Convert a horizontal separator drag into a bounded chat-column width. */
export function chatWidthAfterDrag(side, startWidth, startX, currentX) {
  const direction = side === 'left' ? 1 : -1;
  return Math.round(clamp(
    Number(startWidth) + ((Number(currentX) - Number(startX)) * direction),
    320,
    520,
    DEFAULT_SETTINGS.layout.chatWidth,
  ));
}

export function applyViewingPreset(settings, presetId) {
  const current = normalizeSettings(settings);
  const preset = VIEWING_PRESETS[String(presetId || '')];
  if (!preset) return current;
  return normalizeSettings({
    ...current,
    layout: { ...current.layout, ...preset.layout },
    appearance: { ...current.appearance, ...preset.appearance },
  });
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
  if (segments[0] === 'settings') return 'settings';
  if (segments[0] === 'collectibles') return 'collectibles';
  if (segments[0] === 'subscriptions') return 'subscriptions';
  if (segments[0] === 'category') return 'category';
  if (segments[0] === 'search') return 'search';
  if (RESERVED_ROUTES.has(segments[0])) return 'other';
  return 'channel';
}

/** The current StreamerStats analytics page for a validated Kick channel slug. */
export function streamerStatsProfileUrl(slug) {
  const channel = String(slug ?? '').trim();
  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(channel)) return '';
  return `https://streamerstats.com/kick/channels/${encodeURIComponent(channel)}`;
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
    `${e.endpoint}: ${e.reason}${e.detail ? ` (${e.detail})` : ''}`
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
  if (id === 'gift-sub-button' || id === 'gift-shop-button' || id === 'gift-shop-panel') return 'gift';
  // `kicks-value` is the balance readout in the chat footer, not a control. It
  // survived Poor mode until 2026-08-16 for two reasons: the tagger walked only
  // buttons and links, and the button around it carries no label of its own —
  // its whole text is the number. A balance is the spend prompt without the
  // verb, so it goes with the rest.
  if (id === 'kicks-top-nav' || id === 'get-kicks' || id === 'kicks-value') return 'currency';

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

/** Resolution base for a stored relative asset path. Declared here rather than
 *  reused from `api.mjs` because core is the first chunk in the bundle and has
 *  to load on its own under node:test. */
const KICK_ASSET_BASE = 'https://kick.com/';

/**
 * Pin an emote asset to Kick, deciding origin with the parser rather than a
 * prefix test.
 *
 * A relative path used to be returned unparsed as long as it did not begin
 * `//`. That is not what "relative" means to a browser: for a special scheme
 * the URL parser treats a backslash as a slash, so `/\host/emotes/x.png` is
 * protocol-relative too and resolved to `https://host/emotes/x.png`. An
 * imported library could therefore point every emote at an outside origin, and
 * opening the library would fetch each one — a tracking beacon wearing the
 * shape of a shared emote pack, from the one input this build takes as a file.
 *
 * Same lesson as the CSP reader: an origin is what the parser resolves, never
 * what the string starts with. Resolving against Kick and comparing origins
 * catches `//host` and `/\host` with one rule instead of one guard per spelling.
 */
function cleanStickerAssetUrl(value) {
  const raw = cleanStickerText(value, 500);
  if (!raw || !/\/emotes\//i.test(raw)) return '';
  let url;
  try {
    url = new URL(raw, KICK_ASSET_BASE);
  } catch {
    return '';
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || (host !== 'kick.com' && !host.endsWith('.kick.com'))) return '';
  if (!/\/emotes\//i.test(url.pathname)) return '';
  url.hash = '';
  // A path stays a path, so a stored library keeps working if Kick moves the
  // host it serves assets from.
  return raw.startsWith('/') && !raw.startsWith('//')
    ? `${url.pathname}${url.search}`.slice(0, 500)
    : url.href.slice(0, 500);
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

/**
 * A Kick pathname as the rest of this build stores it: lowercased, no
 * trailing slash, empty for home. Card hrefs, hide lists, favorites, and
 * layout keys all have to agree on this or a `/xqc/` link misses a `/xqc`
 * store entry.
 */
export function observedChannelPath(value) {
  const path = normalizeChannelPath(value);
  return path && path !== '/' ? path : '';
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
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean'
      && !(isRecord(value) && Number.isFinite(value.volume))) continue;
    const split = key.indexOf(':');
    const kind = key.slice(0, split);
    const rest = key.slice(split + 1);
    let nextKey = key;
    if (kind === 'volume' || kind === 'quality' || kind === 'position') {
      const path = observedChannelPath(rest);
      if (!path) continue;
      nextKey = `${kind}:${path}`;
    }
    if (Object.hasOwn(out, nextKey)) continue;
    out[nextKey] = value;
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

export const IMPORT_ERROR_MESSAGES = Object.freeze({
  invalidJson: 'That file is not valid JSON.',
  settingsObject: 'Settings must be a JSON object.',
  settingsSchema: 'Settings schema {schema} is newer than this build supports.',
  stickerObject: 'The emote library must be a JSON object.',
  usageObject: 'The emote usage counts must be a JSON object.',
  multistreamObject: 'The multi-stream layouts must be a JSON object.',
  stickerSchema: 'Emote schema {schema} is newer than this build supports.',
  empty: 'That file does not contain Kick Focus settings.',
});

export const IMPORT_NOTE_MESSAGES = Object.freeze({
  unknownSection: 'Ignored unknown section "{key}".',
  unknownSetting: 'Ignored unknown setting "{path}".',
  adjustedSetting: 'Adjusted "{path}" to a supported value.',
  upgradedUnversioned: 'Upgraded from an unversioned file to schema {schema}.',
  upgradedSchema: 'Upgraded from schema {from} to schema {to}.',
  droppedSticker: '{count} sticker could not be kept: {sample}{more}.',
  droppedStickers: '{count} stickers could not be kept: {sample}{more}.',
  adjustedEmoteField: 'Adjusted emote {field} to supported entries.',
  upgradedEmotes: 'Upgraded emotes to schema {schema}.',
  adjustedUsage: 'Adjusted emote usage counts to {count} supported entries.',
  adjustedGrid: 'Adjusted the multi-stream grid to {count} supported channels.',
  adjustedLayouts: 'Adjusted saved layouts to {count} supported entries.',
});

/**
 * Read a schema stamp a file may have written as anything at all.
 *
 * `Number('abc')` is NaN, and NaN is neither greater nor less than the current
 * schema, so a file stamped with junk slipped past the "too new" refusal *and*
 * the "upgraded from" note and imported as though it were already current. A
 * stamp that is not a finite number is no stamp, so it reads as unversioned and
 * takes the upgrade path every other unstamped file takes. Non-numeric types
 * are rejected before `Number` sees them, because `Number([])` is 0 and
 * `Number(true)` is 1, and neither array nor boolean is a version.
 */
function numericSchema(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateImportedSettings(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(String(jsonText));
  } catch {
    return { ok: false, error: IMPORT_ERROR_MESSAGES.invalidJson, errorKey: IMPORT_ERROR_MESSAGES.invalidJson };
  }
  if (!isRecord(parsed)) return { ok: false, error: IMPORT_ERROR_MESSAGES.settingsObject, errorKey: IMPORT_ERROR_MESSAGES.settingsObject };
  const fileSchema = numericSchema(parsed.schema);
  if (fileSchema != null && fileSchema > SETTINGS_SCHEMA) {
    return {
      ok: false,
      error: `Settings schema ${fileSchema} is newer than this build supports.`,
      errorKey: IMPORT_ERROR_MESSAGES.settingsSchema,
      errorValues: { schema: fileSchema },
    };
  }
  if (parsed.stickers != null && !isRecord(parsed.stickers)) {
    return { ok: false, error: IMPORT_ERROR_MESSAGES.stickerObject, errorKey: IMPORT_ERROR_MESSAGES.stickerObject };
  }
  if (parsed.usage != null && !isRecord(parsed.usage)) {
    return { ok: false, error: IMPORT_ERROR_MESSAGES.usageObject, errorKey: IMPORT_ERROR_MESSAGES.usageObject };
  }
  if (parsed.multistream != null && !isRecord(parsed.multistream)) {
    return { ok: false, error: IMPORT_ERROR_MESSAGES.multistreamObject, errorKey: IMPORT_ERROR_MESSAGES.multistreamObject };
  }
  const stickerSchema = numericSchema(parsed.stickers?.schema);
  if (stickerSchema != null && stickerSchema > STICKER_PREFERENCES_SCHEMA) {
    return {
      ok: false,
      error: `Emote schema ${stickerSchema} is newer than this build supports.`,
      errorKey: IMPORT_ERROR_MESSAGES.stickerSchema,
      errorValues: { schema: stickerSchema },
    };
  }

  const value = normalizeSettings(parsed);
  const stickers = parsed.stickers == null ? null : normalizeStickerPreferences(parsed.stickers);
  const notes = [];
  const noteDetails = [];
  const addNote = (message, key, values = {}, first = false) => {
    const method = first ? 'unshift' : 'push';
    notes[method](message);
    noteDetails[method]({ key, values });
  };
  const sections = ['layout', 'appearance', 'content', 'accessibility', 'shortcuts'];
  const hasSettings = sections.some((section) => isRecord(parsed[section]));
  // `lastSeenVersion` is carried by every export this build writes, because the
  // export spreads the whole settings record. Leaving it out of this set made
  // the app's own file report "Ignored unknown section" against itself on a
  // plain round trip, which is the one place the notes have to be trustworthy.
  const known = new Set(['schema', 'lastSeenVersion', 'stickers', 'usage', 'multistream', 'channelLayouts',
    'favoriteChannels', 'dismissedChannels', 'chatKeywords', 'channelNotes', 'mediaPreferences']);

  for (const key of Object.keys(parsed)) {
    if (!known.has(key) && !sections.includes(key)) {
      addNote(`Ignored unknown section "${key}".`, IMPORT_NOTE_MESSAGES.unknownSection, { key });
    }
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
        const path = `${section}.${key}`;
        addNote(`Ignored unknown setting "${path}".`, IMPORT_NOTE_MESSAGES.unknownSetting, { path });
      } else if (JSON.stringify(value[section][key]) !== JSON.stringify(raw)) {
        const path = `${section}.${key}`;
        addNote(`Adjusted "${path}" to a supported value.`, IMPORT_NOTE_MESSAGES.adjustedSetting, { path });
      }
    }
  }

  if (fileSchema == null || fileSchema < SETTINGS_SCHEMA) {
    if (fileSchema == null) {
      addNote(
        `Upgraded from an unversioned file to schema ${SETTINGS_SCHEMA}.`,
        IMPORT_NOTE_MESSAGES.upgradedUnversioned,
        { schema: SETTINGS_SCHEMA },
        true,
      );
    } else {
      addNote(
        `Upgraded from schema ${fileSchema} to schema ${SETTINGS_SCHEMA}.`,
        IMPORT_NOTE_MESSAGES.upgradedSchema,
        { from: fileSchema, to: SETTINGS_SCHEMA },
        true,
      );
    }
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
        const key = dropped.length === 1 ? IMPORT_NOTE_MESSAGES.droppedSticker : IMPORT_NOTE_MESSAGES.droppedStickers;
        addNote(
          `${dropped.length} sticker${dropped.length === 1 ? '' : 's'} could not be kept: ${sample}${suffix}.`,
          key,
          { count: dropped.length, sample, moreCount: Math.max(0, dropped.length - 5) },
        );
      }
    }
    for (const field of ['favorites', 'hidden', 'groups', 'assignments']) {
      if (Array.isArray(parsed.stickers[field]) && parsed.stickers[field].length !== stickers[field].length) {
        addNote(
          `Adjusted emote ${field} to supported entries.`,
          IMPORT_NOTE_MESSAGES.adjustedEmoteField,
          { field },
        );
      }
    }
    if (stickerSchema == null || stickerSchema < STICKER_PREFERENCES_SCHEMA) {
      addNote(
        `Upgraded emotes to schema ${STICKER_PREFERENCES_SCHEMA}.`,
        IMPORT_NOTE_MESSAGES.upgradedEmotes,
        { schema: STICKER_PREFERENCES_SCHEMA },
      );
    }
  }

  // Usage counts and saved layouts are user-authored data the export promises
  // to carry, so they are validated and reported like everything else rather
  // than passed through or silently dropped.
  const usage = parsed.usage == null ? null : normalizeEmoteUsage(parsed.usage);
  if (usage) {
    const kept = Object.keys(usage.global).length;
    const offered = isRecord(parsed.usage.global) ? Object.keys(parsed.usage.global).length : 0;
    if (offered !== kept) {
      addNote(
        `Adjusted emote usage counts to ${kept} supported entries.`,
        IMPORT_NOTE_MESSAGES.adjustedUsage,
        { count: kept },
      );
    }
  }

  const multistream = parsed.multistream == null ? null : normalizeMultistream(parsed.multistream);
  if (multistream) {
    const offeredStreams = Array.isArray(parsed.multistream.streams) ? parsed.multistream.streams.length : 0;
    if (offeredStreams !== multistream.streams.length) {
      addNote(
        `Adjusted the multi-stream grid to ${multistream.streams.length} supported channels.`,
        IMPORT_NOTE_MESSAGES.adjustedGrid,
        { count: multistream.streams.length },
      );
    }
    const offeredLayouts = Array.isArray(parsed.multistream.layouts) ? parsed.multistream.layouts.length : 0;
    if (offeredLayouts !== multistream.layouts.length) {
      addNote(
        `Adjusted saved layouts to ${multistream.layouts.length} supported entries.`,
        IMPORT_NOTE_MESSAGES.adjustedLayouts,
        { count: multistream.layouts.length },
      );
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

  if (!hasSettings && !stickers && !usage && !multistream
    && channelLayouts == null && favoriteChannels == null && dismissedChannels == null
    && chatKeywords == null && channelNotes == null && mediaPreferences == null) {
    return { ok: false, error: IMPORT_ERROR_MESSAGES.empty, errorKey: IMPORT_ERROR_MESSAGES.empty };
  }

  return {
    ok: true,
    value,
    settings: hasSettings ? value : null,
    stickers, usage, multistream,
    channelLayouts, favoriteChannels, dismissedChannels, chatKeywords, channelNotes, mediaPreferences,
    notes, noteDetails,
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
    // Off by default: one channel's chat, with Kick's own emotes and badges, is
    // the better read. This is for the case the grid exists for — watching
    // several at once and not wanting to miss which one just reacted.
    mergedChat: typeof source.mergedChat === 'boolean' ? source.mergedChat : false,
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
    messageKey: 'Kick Focus could not save your {list}. Browser storage is full or blocked, so those changes exist only until you reload.',
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

/** Build a stable selector for the settings control that owns keyboard focus. */
export function settingsFocusSelector(element) {
  const escape = (value) => String(value).replace(/["\\]/g, '\\$&');
  const setting = element?.getAttribute?.('data-set');
  if (setting != null) {
    const selector = `[data-set="${escape(setting)}"]`;
    const value = element.getAttribute('data-value');
    return value == null ? selector : `${selector}[data-value="${escape(value)}"]`;
  }
  for (const attr of ['data-action', 'data-shortcut', 'data-kf-sticker-key',
    'data-kf-sticker-assignment', 'data-kf-sticker-library-filter', 'data-kf-sticker-library-search',
    'data-kf-emote-catalog-input', 'data-page']) {
    const value = element?.getAttribute?.(attr);
    if (value != null) return `[${attr}="${escape(value)}"]`;
  }
  return '';
}
