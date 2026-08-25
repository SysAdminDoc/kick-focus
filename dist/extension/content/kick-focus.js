/* Kick Focus 1.38.0 — generated from src/. Edit the source, not this file. */
(() => {
'use strict';
if (window.__kickFocusBooted) return;
window.__kickFocusBooted = true;
const VERSION = '1.38.0';
const SETTINGS_SCHEMA = 5;
const VERSION_NOTES = Object.freeze({
'1.38.0': Object.freeze({
summary: 'The profile comment-box emote picker now handles favorites, recent emotes, custom groups, batch moves, removal, recovery, and normal emote insertion in place.',
defaults: Object.freeze([]),
}),
'1.37.0': Object.freeze({
summary: 'Emotes now have a dedicated workspace, visible picker search, and batch controls for creating groups, moving selections, removing entries, and restoring them.',
defaults: Object.freeze([]),
}),
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
'1.36.0': Object.freeze({
summary: 'Interface scale resizes the controls it names, every toast and accessible name is translated, keyboard focus looks the same everywhere, and the build stopped shipping 12 KB of stylesheet comments.',
defaults: Object.freeze([]),
}),
'1.35.0': Object.freeze({
summary: 'High-contrast controls now raise every border, the accent reaches the header buttons and the emote popover, and an imported emote library can no longer point its artwork at an outside origin.',
defaults: Object.freeze([]),
}),
'1.31.0': Object.freeze({
summary: 'The main Kick theme now uses clearer type, quieter borders, tighter spacing, flatter content cards, and more compact route controls.',
defaults: Object.freeze([]),
}),
});
function normalizeVersion(value) {
const raw = String(value ?? '').trim();
return /^\d{1,4}(\.\d{1,4}){0,3}$/.test(raw) ? raw : '';
}
function updateNotice(lastSeen, current = VERSION, notes = VERSION_NOTES) {
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
function diagnosticSettingsDiff(settings) {
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
function rankSettingsMatches(query, entries, limit = 40) {
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
const DEFAULT_SETTINGS = Object.freeze({
schema: SETTINGS_SCHEMA,
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
preferBestQuality: false,
rememberVodPosition: true,
showUptime: true,
showVodExpiry: true,
stickyChatPause: false,
chatHighlights: false,
chatTimestamps: false,
chatPriorityPeople: [],
chatMentionSound: false,
chatHideMessages: false,
chatHistory: false,
chatComposerRecall: false,
organizeChatStickers: true,
clickChatEmotes: true,
insertEmoteName: false,
emoteAutocomplete: false,
autoClaimRewards: false,
favoriteScope: 'global',
playbackDiagnostics: false,
hiddenChannels: [],
blocklistSubscription: false,
blocklistUrl: '',
blocklistRefreshHours: 24,
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
const VIEWING_PRESETS = Object.freeze({
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
const HIDEABLE_ELEMENTS = Object.freeze([
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
const HIDEABLE_GROUPS = Object.freeze([
Object.freeze({ id: 'player', label: 'Player controls' }),
Object.freeze({ id: 'sidebar', label: 'Sidebar' }),
]);
const HIDEABLE_ORDER = new Map(HIDEABLE_ELEMENTS.map((entry, index) => [entry.id, index]));
function normalizeHiddenElements(input) {
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
function qualityRank(label) {
const text = String(label ?? '').trim().toLowerCase();
if (!text) return -1;
if (text === 'auto' || text.startsWith('auto ') || text.startsWith('auto(')) return 0;
const match = text.match(/(\d{3,4})\s*p\s*(\d{2,3})?/);
if (match) return Number(match[1]) * 1000 + Math.min(Number(match[2]) || 30, 999);
const height = QUALITY_ALIAS_HEIGHT.get(text);
return height ? height * 1000 + 30 : -1;
}
function qualitySessionValue(label) {
const rank = qualityRank(label);
if (rank < 0) return '';
if (rank === 0) return '0';
const height = Math.floor(rank / 1000);
return height > 0 && height <= 4320 ? String(height) : '';
}
function bestQualityOption(labels) {
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
const TELEMETRY_NO_CANCEL_HOSTS = Object.freeze(['litix.io']);
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
const CUSTOM_ACCENT_FALLBACK = '#FF5CA8';
const CUSTOM_ACCENT_SURFACES = Object.freeze([
'#000000',
'#18201b', '#171f1a',
'#0e1110', '#111613',
'#1c2934', '#263544',
]);
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
function colorContrastRatio(first, second) {
const a = rgbFromHex(first);
const b = rgbFromHex(second);
if (!a || !b) return 0;
const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
return (lighter + 0.05) / (darker + 0.05);
}
function normalizeCustomAccent(value, fallback = CUSTOM_ACCENT_FALLBACK) {
const parsed = rgbFromHex(value);
const normalizedFallback = rgbFromHex(fallback) ? String(fallback).toUpperCase() : CUSTOM_ACCENT_FALLBACK;
if (!parsed) return normalizedFallback;
  const normalized = `#${[parsed.red, parsed.green, parsed.blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
return CUSTOM_ACCENT_SURFACES.every((surface) => colorContrastRatio(normalized, surface) >= 3)
? normalized
: normalizedFallback;
}
function customAccentTokens(value) {
const hex = normalizeCustomAccent(value);
const rgb = rgbFromHex(hex);
const darkInk = '#000000';
const lightInk = '#FFFFFF';
const onAccent = colorContrastRatio(hex, darkInk) >= colorContrastRatio(hex, lightInk) ? darkInk : lightInk;
  return Object.freeze({ hex, rgb: `${rgb.red}, ${rgb.green}, ${rgb.blue}`, onAccent });
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
function findShortcutConflict(shortcuts, capturingKey, candidate) {
if (!isRecord(shortcuts) || typeof candidate !== 'string' || !candidate) return '';
const wanted = candidate.toLowerCase();
for (const [key, value] of Object.entries(shortcuts)) {
if (key === capturingKey) continue;
if (typeof value === 'string' && value.toLowerCase() === wanted) return key;
}
return '';
}
const EMOTE_ACCESS_LABELS = Object.freeze({
available: 'Seen available',
channel: 'Channel-only',
observed: 'Seen in chat',
locked: 'Subscriber-only',
});
function emoteAccessLabel(access) {
return EMOTE_ACCESS_LABELS[access] || EMOTE_ACCESS_LABELS.locked;
}
const MAX_UPTIME_MS = 14 * 24 * 60 * 60 * 1000;
function formatUptime(startedAt, now = Date.now()) {
if (!Number.isFinite(startedAt) || startedAt <= 0) return '';
const elapsed = now - startedAt;
if (elapsed < 0 || elapsed > MAX_UPTIME_MS) return '';
const total = Math.floor(elapsed / 1000);
const seconds = String(total % 60).padStart(2, '0');
const minutes = total >= 3600 ? String(Math.floor(total / 60) % 60).padStart(2, '0') : String(Math.floor(total / 60));
const hours = Math.floor(total / 3600);
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}
const VOD_RETENTION_DAYS = { verified: 30, unverified: 7 };
const DAY_MS = 24 * 60 * 60 * 1000;
function vodExpiry(startedAt, verified, now = Date.now()) {
if (!Number.isFinite(startedAt) || startedAt <= 0) return null;
if (typeof verified !== 'boolean') return null;
const days = verified ? VOD_RETENTION_DAYS.verified : VOD_RETENTION_DAYS.unverified;
const expiresAt = startedAt + days * DAY_MS;
if (startedAt > now + DAY_MS) return null;
return { expiresAt, remaining: expiresAt - now, days, expired: expiresAt <= now };
}
function formatVodRetention(remaining) {
if (!Number.isFinite(remaining) || remaining <= 0) return '';
const minutes = Math.floor(remaining / 60000);
const hours = Math.floor(minutes / 60);
  if (hours >= 48) return `${Math.floor(hours / 24)}d`;
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(1, minutes)}m`;
}
const MERGED_CHAT_CAP = 300;
function appendMergedMessage(entries, entry, cap = MERGED_CHAT_CAP) {
const list = Array.isArray(entries) ? entries : [];
if (!entry || typeof entry !== 'object') return list;
const slug = typeof entry.slug === 'string' ? entry.slug : '';
const id = typeof entry.id === 'string' ? entry.id : '';
const text = typeof entry.text === 'string' ? entry.text : '';
if (!slug || !text) return list;
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
function dropMergedChannel(entries, slug) {
if (!Array.isArray(entries) || typeof slug !== 'string' || !slug) return Array.isArray(entries) ? entries : [];
return entries.filter((entry) => entry.slug !== slug);
}
function emoteReach(entry) {
if (!isRecord(entry)) return { text: '', channel: '' };
if (entry.usableHere === false) return { text: '', channel: '' };
if (entry.usableEverywhere === true) return { text: 'Works in every chat', channel: '' };
if (entry.usableEverywhere !== false) return { text: '', channel: '' };
const source = typeof entry.sourceSlug === 'string' && entry.sourceSlug ? entry.sourceSlug : '';
return source
? { text: 'Only works in {channel}’s chat', channel: source }
: { text: 'Only works in its own channel', channel: '' };
}
function ownedEmoteGroups(entries) {
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
function emoteTooltipText(entry, collisions = [], saved = false) {
if (!isRecord(entry) || typeof entry.name !== 'string' || !entry.name) return [];
const lines = [entry.name];
const access = emoteAccessLabel(entry.access);
const sets = (Array.isArray(entry.nativeGroups) ? entry.nativeGroups : [])
.filter((group) => group && group !== access);
  lines.push(sets.length ? `${sets.join(' · ')} · ${access}` : access);
const reach = emoteReach(entry);
if (reach.text) lines.push(reach.text.replace('{channel}', reach.channel));
if (Number.isFinite(entry.firstSeen) && entry.firstSeen > 0) {
    lines.push(`First seen ${new Date(entry.firstSeen).toISOString().slice(0, 10)}`);
}
const collision = (Array.isArray(collisions) ? collisions : [])
.find((item) => isRecord(item) && item.name === entry.name);
if (collision) {
const winner = isRecord(collision.winner) ? collision.winner.setName : '';
    lines.push(winner ? `Name shadowed. Typing it sends ${winner}` : 'Name shadowed by another set');
}
lines.push(saved ? 'Saved. Click to open in the library' : 'Click to save');
return lines;
}
const PLAIN_EMOTE_NAME = /^[A-Za-z0-9_]{1,64}$/;
function insertionPlanFor(descriptor, collisions = [], access = '') {
const name = isRecord(descriptor) ? String(descriptor.name ?? '').trim() : '';
if (!name) return { ok: false, text: '', warning: '', sendable: false, reason: 'unnamed' };
if (!PLAIN_EMOTE_NAME.test(name)) {
return { ok: false, text: '', warning: '', sendable: false, reason: 'not-a-plain-name' };
}
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
const CLAIM_ACTION = /^\s*(claim|open|spin|reveal|collect)\b/i;
const CLAIM_COUNTDOWN = /watch\s+(\d+)\s+more\s+minute/i;
const CLAIM_RECHECK_MS = 10 * 60 * 1000;
const CLAIM_RESET_HOUR = 20;
function nextClaimResetAt(now, resetHour = CLAIM_RESET_HOUR) {
const at = new Date(now);
at.setHours(resetHour, 0, 0, 0);
if (at.getTime() <= now) at.setDate(at.getDate() + 1);
return at.getTime();
}
function nextRewardCheckAt(facts = {}) {
const { outcome, now = 0, minutesRemaining = null, dialogText = '', resetHour = CLAIM_RESET_HOUR } = facts;
const reset = nextClaimResetAt(now, resetHour);
if (outcome === 'claimed') return reset;
if (Number.isFinite(minutesRemaining) && minutesRemaining > 0) {
return Math.min(now + (minutesRemaining + 1) * 60_000, reset);
}
if (String(dialogText).trim().length > 0) return reset;
return now + CLAIM_RECHECK_MS;
}
function parseClaimCountdown(text) {
const match = CLAIM_COUNTDOWN.exec(String(text ?? ''));
if (!match) return null;
const minutes = Number(match[1]);
return Number.isFinite(minutes) ? minutes : null;
}
function decideRewardClaim(facts = {}) {
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
if (nextCheckAt > now) return { action: 'cooling', reason: 'not-due' };
return { action: 'open', reason: 'due' };
}
if (!hasAction) return { action: 'wait', reason: 'no-action-button' };
if (actionDisabled) return { action: 'wait', reason: 'not-ready' };
return { action: 'claim', reason: 'ready' };
}
const VIEWER_HUB_CARDS = Object.freeze([
Object.freeze({ id: 'reward', source: 'dom' }),
Object.freeze({ id: 'points', source: 'dom' }),
Object.freeze({ id: 'collectibles', source: 'api' }),
Object.freeze({ id: 'drops', source: 'dom' }),
Object.freeze({ id: 'level', source: 'dom' }),
Object.freeze({ id: 'streak', source: 'dom' }),
Object.freeze({ id: 'watch', source: 'local' }),
]);
const VIEWER_HUB_TITLES = Object.freeze({
reward: 'Daily reward',
points: 'Channel points',
collectibles: 'Collectibles',
drops: 'Drops',
level: 'Level',
streak: 'Streak',
watch: 'Session watch time',
});
const VIEWER_HUB_REASONS = Object.freeze({
'not-read': 'Not read yet on this page.',
anonymous: 'Kick shows this to a signed-in account only.',
'off-channel': 'Open a channel to see its points.',
'off-route': 'Open Drops to count the campaigns waiting.',
'dialog-closed': 'Kick shows this inside the daily reward dialog only.',
'not-shown': 'The reward dialog did not show a figure this time.',
'read-failed': 'Kick did not answer that read. Nothing was changed.',
threw: 'This card could not be built. The rest of the hub is unaffected.',
});
const VIEWER_HUB_REWARD_WORDS = Object.freeze({
claimed: 'Claimed today',
waiting: 'Not ready yet',
available: 'Ready to claim',
});
const VIEWER_HUB_STALE_MS = 60_000;
function sessionWatchCandidateState(candidate = {}) {
const width = Math.max(0, Number.isFinite(Number(candidate.width)) ? Number(candidate.width) : 0);
const height = Math.max(0, Number.isFinite(Number(candidate.height)) ? Number(candidate.height) : 0);
const area = Math.round(width * height);
const priority = Math.max(1, Math.min(9,
Number.isFinite(Number(candidate.playerPriority)) ? Math.floor(Number(candidate.playerPriority)) : 1));
const owner = candidate.route === 'channel'
&& candidate.connected === true
&& candidate.visible === true
&& candidate.intersectsViewport === true
&& candidate.playerSurface === true
&& candidate.preload !== true
&& candidate.preview !== true
&& candidate.background !== true;
return Object.freeze({
owner,
active: owner && candidate.documentVisible === true && candidate.playing === true,
score: owner ? priority * 1_000_000_000 + area : -1,
});
}
function selectSessionWatchOwner(candidates = []) {
let selected = null;
let selectedState = null;
for (const candidate of Array.isArray(candidates) ? candidates : []) {
const nextState = sessionWatchCandidateState(candidate);
if (!nextState.owner) continue;
if (!selectedState
|| nextState.score > selectedState.score
|| (nextState.score === selectedState.score && candidate.current === true && selected.current !== true)) {
selected = candidate;
selectedState = nextState;
}
}
return selected;
}
function advanceSessionWatchTime(record = {}, now = 0, active = false) {
const at = Math.max(0, Number.isFinite(Number(now)) ? Number(now) : 0);
let elapsedMs = Math.max(0, Number.isFinite(Number(record.elapsedMs)) ? Number(record.elapsedMs) : 0);
const activeSince = Math.max(0, Number.isFinite(Number(record.activeSince)) ? Number(record.activeSince) : 0);
if (!active) {
if (activeSince && at >= activeSince) elapsedMs += at - activeSince;
return Object.freeze({ elapsedMs, activeSince: 0 });
}
return Object.freeze({ elapsedMs, activeSince: activeSince || at });
}
function sessionWatchElapsed(record = {}, now = 0) {
const elapsedMs = Math.max(0, Number.isFinite(Number(record.elapsedMs)) ? Number(record.elapsedMs) : 0);
const activeSince = Math.max(0, Number.isFinite(Number(record.activeSince)) ? Number(record.activeSince) : 0);
const at = Math.max(0, Number.isFinite(Number(now)) ? Number(now) : 0);
return Math.round(elapsedMs + (activeSince && at >= activeSince ? at - activeSince : 0));
}
function formatSessionWatchTime(elapsedMs) {
const seconds = Math.max(0, Math.floor((Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : 0) / 1000));
const hours = Math.floor(seconds / 3600);
const minutes = Math.floor((seconds % 3600) / 60);
const remainder = seconds % 60;
return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
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
function freshness(observedAt, now) {
const at = measured(observedAt) || 0;
if (!at) return { observedAt: 0, stale: true };
return { observedAt: at, stale: now - at > VIEWER_HUB_STALE_MS };
}
const BUILDERS = {
reward(fact, now) {
if (!fact) return card('reward', 'dom', 'unavailable', { reason: 'not-read' });
if (fact.loading) return card('reward', 'dom', 'loading');
if (!fact.trigger) return card('reward', 'dom', 'unavailable', { reason: 'anonymous' });
const claimedAt = measured(fact.lastClaimAt);
const nextAt = measured(fact.nextCheckAt);
const rest = freshness(fact.observedAt, now);
const rolledOverAt = measured(fact.previousResetAt) || 0;
if (claimedAt && claimedAt >= rolledOverAt) {
return card('reward', 'dom', 'ready', { value: 'claimed', ...rest });
}
if (nextAt && nextAt > now) return card('reward', 'dom', 'ready', { value: 'waiting', ...rest });
return card('reward', 'dom', 'ready', { value: 'available', ...rest });
},
points(fact, now) {
if (!fact) return card('points', 'dom', 'unavailable', { reason: 'not-read' });
if (fact.loading) return card('points', 'dom', 'loading');
if (!fact.onChannel) return card('points', 'dom', 'unavailable', { reason: 'off-channel' });
const value = measured(fact.value);
if (value === null) return card('points', 'dom', 'unavailable', { reason: 'anonymous' });
return card('points', 'dom', 'ready', { value, channel: String(fact.channel || ''), ...freshness(fact.observedAt, now) });
},
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
drops(fact, now) {
if (!fact) return card('drops', 'dom', 'unavailable', { reason: 'not-read' });
if (fact.loading) return card('drops', 'dom', 'loading');
if (!fact.navPresent) return card('drops', 'dom', 'unavailable', { reason: 'anonymous' });
if (!fact.onRoute) return card('drops', 'dom', 'unavailable', { reason: 'off-route' });
const campaigns = measured(fact.campaigns);
if (campaigns === null) return card('drops', 'dom', 'unavailable', { reason: 'not-read' });
return card('drops', 'dom', 'ready', { value: campaigns, ...freshness(fact.observedAt, now) });
},
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
function viewerHubCards(facts = {}, now = 0) {
return VIEWER_HUB_CARDS.map(({ id, source }) => {
try {
const built = BUILDERS[id](facts[id], now);
if (built.state !== 'ready' && built.value !== null) built.value = null;
return built;
} catch {
return card(id, source, 'error', { reason: 'threw' });
}
});
}
function earnedState(cards = []) {
const reward = (Array.isArray(cards) ? cards : []).find((entry) => entry?.id === 'reward');
if (!reward || reward.state !== 'ready' || reward.value !== 'available') return null;
return { kind: 'reward-ready', label: 'Daily reward ready' };
}
function viewerHubSummary(cards = []) {
const list = Array.isArray(cards) ? cards : [];
return {
ready: list.filter((entry) => entry.state === 'ready').length,
total: list.length,
errors: list.filter((entry) => entry.state === 'error').length,
stale: list.filter((entry) => entry.state === 'ready' && entry.stale).length,
fromDom: list.filter((entry) => entry.state === 'ready' && entry.source === 'dom').map((entry) => entry.id),
fromApi: list.filter((entry) => entry.state === 'ready' && entry.source === 'api').map((entry) => entry.id),
fromLocal: list.filter((entry) => entry.state === 'ready' && entry.source === 'local').map((entry) => entry.id),
};
}
const CHAT_HISTORY_LIMITS = Object.freeze({
rows: 400,
bytes: 200_000,
ageMs: 60 * 60 * 1000,
});
const CHAT_HISTORY_MAX_TEXT = 400;
const COMPOSER_RECALL_LIMIT = 5;
function isComposerRecallGesture(event = {}) {
return event.key === 'ArrowUp'
&& event.shiftKey === true
&& event.altKey !== true
&& event.ctrlKey !== true
&& event.metaKey !== true;
}
function appendComposerRecall(messages = [], value = '', whisper = false) {
const list = (Array.isArray(messages) ? messages : [])
.filter((message) => typeof message === 'string' && message.trim())
.slice(-COMPOSER_RECALL_LIMIT);
const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
if (!text || whisper || /^\/(?:w|whisper|msg|pm)\b/i.test(text)) return list;
return [...list, text].slice(-COMPOSER_RECALL_LIMIT);
}
function composerRecallAt(messages = [], index = 0) {
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
function pruneChatHistory(rows = [], limits = CHAT_HISTORY_LIMITS, now = 0) {
const list = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === 'object');
const fresh = list.filter((row) => Number.isFinite(row.at) && now - row.at <= limits.ageMs);
const capped = fresh.slice(Math.max(0, fresh.length - limits.rows));
while (capped.length > 1 && historyBytes(capped) > limits.bytes) capped.shift();
return capped;
}
function appendChatEntry(rows = [], entry = {}, limits = CHAT_HISTORY_LIMITS, now = 0) {
const list = Array.isArray(rows) ? rows : [];
const id = String(entry.id ?? '').trim();
const text = String(entry.text ?? '').replace(/\s+/g, ' ').trim();
if (!id || !text) return list;
if (entry.whisper === true) return list;
const at = Number.isFinite(entry.at) ? entry.at : now;
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
function dropChatMessage(rows = [], id = '') {
const wanted = String(id ?? '').trim();
if (!wanted) return Array.isArray(rows) ? rows : [];
return (Array.isArray(rows) ? rows : []).filter((row) => row.id !== wanted);
}
function searchChatHistory(rows = [], query = '', limit = 50) {
const needle = String(query ?? '').trim().toLowerCase();
const list = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === 'object');
const matched = needle
? list.filter((row) => String(row.text).toLowerCase().includes(needle)
|| String(row.author).toLowerCase().includes(needle))
: list;
return matched.slice(-limit).reverse();
}
function parsePeopleList(value, max = 40) {
const seen = new Set();
for (const raw of String(value ?? '').split(/[\n,]/)) {
const name = raw.trim().replace(/^@/, '').toLowerCase();
if (!/^[a-z0-9_][a-z0-9_-]{0,63}$/.test(name)) continue;
seen.add(name);
if (seen.size >= max) break;
}
return [...seen];
}
function isPriorityPerson(people = [], author = '') {
const name = String(author ?? '').trim().replace(/^@/, '').toLowerCase();
if (!name) return false;
return (Array.isArray(people) ? people : []).some((entry) => String(entry).toLowerCase() === name);
}
const MENTION_SOUND_GAP_MS = 4000;
function shouldPlayMentionSound(facts = {}) {
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
function formatChatTime(at, locale = undefined) {
if (!Number.isFinite(at)) return '';
try {
return new Date(at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
} catch {
return '';
}
}
function floatingPreviewPosition(anchor = {}, preview = {}, viewport = {}, gap = 12) {
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
function buildChatHistoryExport(rows = [], channel = '') {
const list = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === 'object');
  const header = `Kick Focus chat log for ${channel || 'this session'}, ${list.length} messages`;
  const lines = list.map((row) => `[${formatChatTime(row.at)}] ${row.author || 'unknown'}: ${row.text}`);
return [header, ...lines].join('\n');
}
const DISCOVERY_LAYOUT_KEYS = Object.freeze([
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
const DISCOVERY_LAYOUT_ROUTES = Object.freeze(['home', 'browse', 'category', 'following', 'search']);
const DISCOVERY_ROUTE_LABELS = Object.freeze({
home: 'Home',
browse: 'Browse',
category: 'Category pages',
following: 'Following',
search: 'Search results',
});
const DISCOVERY_LAYOUT_MAX = 12;
const DISCOVERY_LAYOUT_NAME_MAX = 40;
function settingAt(settings, path) {
const [group, key] = String(path).split('.');
const owner = settings && typeof settings === 'object' ? settings[group] : null;
return owner && typeof owner === 'object' ? owner[key] : undefined;
}
function cleanLayoutName(value) {
return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, DISCOVERY_LAYOUT_NAME_MAX);
}
function buildDiscoveryLayout(name, settings, routes = []) {
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
function normalizeDiscoveryLayouts(input, settings) {
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
function layoutForRoute(layouts = [], route = '') {
if (!DISCOVERY_LAYOUT_ROUTES.includes(route)) return null;
return (Array.isArray(layouts) ? layouts : []).find((entry) => entry?.routes?.includes(route)) || null;
}
function applyDiscoveryLayout(settings, layout) {
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
function layoutMatchesSettings(layout, settings) {
if (!layout || typeof layout !== 'object') return false;
const entries = Object.entries(layout.values || {});
if (!entries.length) return false;
return entries.every(([path, value]) => settingAt(settings, path) === value);
}
const EMOTE_TRIGGER_MIN = 2;
function emoteTriggerAt(textBeforeCaret) {
const source = String(textBeforeCaret ?? '');
const match = /(?:^|\s):([A-Za-z0-9_]+)$/.exec(source);
if (!match) return null;
const query = match[1];
if (query.length < EMOTE_TRIGGER_MIN) return null;
return { query, length: query.length + 1 };
}
function completionWouldBounce(entry, channel = '') {
if (!isRecord(entry)) return false;
if (entry.usableHere === false) return true;
if (entry.usableEverywhere !== false) return false;
const source = typeof entry.sourceSlug === 'string' ? entry.sourceSlug : '';
const here = typeof channel === 'string' ? channel : '';
if (!source || !here) return false;
return source.toLowerCase() !== here.toLowerCase();
}
function rankEmoteCompletions(query, candidates, options = {}) {
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
if (!name || !PLAIN_EMOTE_NAME.test(name)) continue;
const at = name.toLowerCase().indexOf(needle);
if (at === -1) continue;
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
const OVERLAY_LAYERS = [
['multistream', '.kf-ms-shell'],
['command', '.kf-command-shell'],
['resetConfirm', '.kf-confirm-card'],
['settings', '[data-kf-settings-shell]'],
];
function topmostOverlayLayer(open) {
if (!isRecord(open)) return null;
const found = OVERLAY_LAYERS.find(([layer]) => open[layer] === true);
return found ? { layer: found[0], selector: found[1] } : null;
}
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
function sanitizeErrorMessage(message, limit = 300) {
return String(message ?? '')
.replace(/[?#][^\s'")]*/g, '')
.replace(/[A-Za-z0-9_-]{40,}/g, '…')
.replace(/\s+/g, ' ')
.trim()
.slice(0, limit);
}
function normalizeBlocklistUrl(value) {
if (typeof value !== 'string' || value.length > 2048) return '';
const trimmed = value.trim();
if (!trimmed) return '';
try {
const url = new URL(trimmed);
if (url.protocol !== 'https:' || url.username || url.password) return '';
url.hash = '';
return url.href;
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
function chatWidthAfterDrag(side, startWidth, startX, currentX) {
const direction = side === 'left' ? 1 : -1;
return Math.round(clamp(
Number(startWidth) + ((Number(currentX) - Number(startX)) * direction),
320,
520,
DEFAULT_SETTINGS.layout.chatWidth,
));
}
function applyViewingPreset(settings, presetId) {
const current = normalizeSettings(settings);
const preset = VIEWING_PRESETS[String(presetId || '')];
if (!preset) return current;
return normalizeSettings({
...current,
layout: { ...current.layout, ...preset.layout },
appearance: { ...current.appearance, ...preset.appearance },
});
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
if (segments[0] === 'settings') return 'settings';
if (segments[0] === 'collectibles') return 'collectibles';
if (segments[0] === 'subscriptions') return 'subscriptions';
if (segments[0] === 'category') return 'category';
if (segments[0] === 'search') return 'search';
if (RESERVED_ROUTES.has(segments[0])) return 'other';
return 'channel';
}
function streamerStatsProfileUrl(slug) {
const channel = String(slug ?? '').trim();
if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(channel)) return '';
  return `https://streamerstats.com/kick/channels/${encodeURIComponent(channel)}`;
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
const APPLY_MAX_WAIT = 500;
function nextApplyDelay(requestedDelay, waitedMs, maxWait = APPLY_MAX_WAIT) {
const requested = Math.max(0, Number(requestedDelay) || 0);
const waited = Math.max(0, Number(waitedMs) || 0);
const remaining = Math.max(0, maxWait - waited);
return Math.min(requested, remaining);
}
const FILTER_MIN_SAMPLE = 8;
const FILTER_MAX_HIDDEN_RATIO = 0.25;
function filterDecision(total, wouldHide, options = {}) {
const sample = Math.max(0, Number(total) || 0);
const hidden = Math.min(sample, Math.max(0, Number(wouldHide) || 0));
const ratio = sample > 0 ? hidden / sample : 0;
if (options.route === 'category') {
return { apply: true, hidden, total: sample, ratio, reason: 'category-route' };
}
if (sample >= FILTER_MIN_SAMPLE && ratio > FILTER_MAX_HIDDEN_RATIO) {
return { apply: false, hidden, total: sample, ratio, reason: 'ratio' };
}
return { apply: true, hidden, total: sample, ratio, reason: 'ok' };
}
const CASINO_CATEGORY_SLUGS = Object.freeze([
'slots', 'casino', 'slots-casino', 'poker', 'sports-betting', 'gambling',
]);
const PLAYBACK_AD_SDK_KEYS = Object.freeze([
'google_ads_sdk', 'pal_sdk', 'ima_sdk',
]);
const PLAYBACK_TELEMETRY_SDK_KEYS = Object.freeze([
'mux_sdk', 'datazoom_sdk',
]);
const AD_STACK_BASELINE = Object.freeze({
date: '2026-08-14',
playbackSdkKeys: Object.freeze(['google_ads_sdk', 'pal_sdk', 'ima_sdk', 'mux_sdk', 'datazoom_sdk']),
sessionFlag: 'auto_ads_enabled',
});
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
function preferredStickerAccess(existingAccess, incomingAccess) {
const accessRank = { observed: 0, locked: 1, channel: 2, available: 3 };
const incoming = Object.hasOwn(accessRank, incomingAccess) ? incomingAccess : 'locked';
if (!Object.hasOwn(accessRank, existingAccess)) return incoming;
return accessRank[existingAccess] >= accessRank[incoming] ? existingAccess : incoming;
}
function recordStickerObservation(existing, observed, now) {
const at = cleanCaptureTime(now);
if (!existing) {
return { ...observed, firstSeen: at, lastSeen: at };
}
const entry = { ...existing, ...observed, firstSeen: cleanCaptureTime(existing.firstSeen), lastSeen: at };
const originalName = existing.wasName || existing.name;
if (originalName && originalName !== entry.name) entry.wasName = originalName;
else delete entry.wasName;
const originalSrc = existing.wasSrc || existing.src;
if (originalSrc && originalSrc !== entry.src) entry.wasSrc = originalSrc;
else delete entry.wasSrc;
return entry;
}
function stickerChangedSinceCapture(entry) {
return Boolean(entry?.wasName || entry?.wasSrc);
}
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
function countChangedStickers(library) {
const entries = library instanceof Map ? [...library.values()] : (Array.isArray(library) ? library : []);
return entries.filter((entry) => stickerChangedSinceCapture(entry)).length;
}
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
    const key = badge.image || `text:${label}`;
if (seen.has(key)) continue;
seen.add(key);
render.push({ label, image: badge.image || '' });
}
return render;
}
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
    `${e.endpoint}: ${e.reason}${e.detail ? ` (${e.detail})` : ''}`
).join('; ');
return {
drifted: true,
count: entries.length,
    summary: `${entries.length} API shape change${entries.length === 1 ? '' : 's'}: ${summary}.`,
};
}
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
return /\/api\/v\d+\/[^?#]*\/playback(?:[/?#]|$)/.test(value)
|| /\/stream\/[^/?#]+\/playback(?:[/?#]|$)/.test(value);
}
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
drops: hasBadges
? badgeMatches(/^(drops?|drops enabled|kick drops)$/)
: /\b(?:kick\s+drops?|drops\s+enabled)\b/.test(normalized),
};
}
function monetizationKind({ text = '', ariaLabel = '', title = '', testId = '' } = {}) {
const id = String(testId).trim().toLowerCase();
if (id === 'sub-button') return 'subscribe';
if (id === 'gift-sub-button' || id === 'gift-shop-button' || id === 'gift-shop-panel') return 'gift';
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
const STICKER_PREFERENCES_SCHEMA = 8;
const PLATFORM_ID = 'kick';
const UNPREFIXED_STICKER_KEY = /^(?:id|name):/;
function platformStickerKey(key, platformId = PLATFORM_ID) {
if (typeof key !== 'string' || !key) return '';
  return UNPREFIXED_STICKER_KEY.test(key) ? `${platformId}:${key}` : key;
}
const EARLIEST_CAPTURE_MS = Date.UTC(2024, 0, 1);
function cleanCaptureTime(value) {
const time = Number(value);
if (!Number.isFinite(time) || time < EARLIEST_CAPTURE_MS) return 0;
if (time > EARLIEST_CAPTURE_MS + 100 * 365 * 24 * 60 * 60 * 1000) return 0;
return Math.floor(time);
}
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
const KICK_ASSET_BASE = 'https://kick.com/';
function cleanStickerAssetUrl(value) {
const raw = cleanStickerText(value, 500);
if (!raw || !/\/emotes\//i.test(raw)) return '';
const rooted = raw.startsWith('/');
if (!rooted && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
let url;
try {
url = new URL(raw, KICK_ASSET_BASE);
} catch {
return '';
}
const host = url.hostname.toLowerCase();
if (url.protocol !== 'https:' || (host !== 'kick.com' && !host.endsWith('.kick.com'))) return '';
url.hash = '';
return rooted && !raw.startsWith('//')
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
if (groups.length >= STICKER_GROUP_LIMIT) break;
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
const STICKER_GROUP_LIMIT = 40;
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
firstSeen: cleanCaptureTime(raw.firstSeen),
lastSeen: cleanCaptureTime(raw.lastSeen),
};
const wasName = cleanStickerText(raw.wasName, 80);
if (wasName && wasName !== name) entry.wasName = wasName;
const wasSrc = cleanStickerAssetUrl(raw.wasSrc);
if (wasSrc && wasSrc !== src) entry.wasSrc = wasSrc;
library.push(entry);
if (library.length >= STICKER_LIBRARY_LIMIT * 2) break;
}
return library;
}
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
for (const key of cleanStickerKeys(legacyPinned)) add(key, '', entries.length);
}
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
const view = enumValue(source.view, ['all', 'pinned', 'recent', 'native', 'group'], 'all');
const favorites = cleanStickerFavorites(source.favorites, source.pinned, hiddenSet);
const assignments = cleanStickerAssignments(source.assignments, groupIds);
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
function observedChannelPath(value) {
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
const POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
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
function normalizeMediaPreferences(input, limit = 240) {
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
const IMPORT_ERROR_MESSAGES = Object.freeze({
invalidJson: 'That file is not valid JSON.',
settingsObject: 'Settings must be a JSON object.',
settingsSchema: 'Settings schema {schema} is newer than this build supports.',
stickerObject: 'The emote library must be a JSON object.',
usageObject: 'The emote usage counts must be a JSON object.',
multistreamObject: 'The multi-stream boards must be a JSON object.',
stickerSchema: 'Emote schema {schema} is newer than this build supports.',
empty: 'That file does not contain Kick Focus settings.',
});
const IMPORT_NOTE_MESSAGES = Object.freeze({
unknownSection: 'Ignored unknown section "{key}".',
unknownSetting: 'Ignored unknown setting "{path}".',
adjustedSetting: 'Adjusted "{path}" to a supported value.',
upgradedUnversioned: 'Upgraded from an unversioned file to schema {schema}.',
upgradedSchema: 'Upgraded from schema {from} to schema {to}.',
droppedSticker: '{count} emote could not be kept: {sample}{more}.',
droppedStickers: '{count} emotes could not be kept: {sample}{more}.',
adjustedEmoteField: 'Adjusted emote {field} to supported entries.',
upgradedEmotes: 'Upgraded emotes to schema {schema}.',
adjustedUsage: 'Adjusted emote usage counts to {count} supported entries.',
adjustedGrid: 'Adjusted the multi-stream grid to {count} supported channels.',
adjustedLayouts: 'Adjusted saved boards to {count} supported entries.',
disarmedBlocklist: 'Left the blocklist subscription to {host} switched off. Turn it on yourself if you trust that host.',
});
function numericSchema(value) {
if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return null;
const parsed = Number(value);
return Number.isNaN(parsed) ? null : parsed;
}
function validateImportedSettings(jsonText, { currentBlocklistUrl = '', trusted = false } = {}) {
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
if (!Object.hasOwn(value[section], key)) {
        const path = `${section}.${key}`;
        addNote(`Ignored unknown setting "${path}".`, IMPORT_NOTE_MESSAGES.unknownSetting, { path });
} else if (JSON.stringify(value[section][key]) !== JSON.stringify(raw)) {
        const path = `${section}.${key}`;
        addNote(`Adjusted "${path}" to a supported value.`, IMPORT_NOTE_MESSAGES.adjustedSetting, { path });
}
}
}
if (!trusted && value.content.blocklistSubscription) {
const incoming = value.content.blocklistUrl;
if (incoming && incoming !== String(currentBlocklistUrl || '')) {
value.content.blocklistSubscription = false;
let host = incoming;
try { host = new URL(incoming).host; } catch { host = incoming; }
addNote(
        `Left the blocklist subscription to ${host} switched off. Turn it on yourself if you trust that host.`,
IMPORT_NOTE_MESSAGES.disarmedBlocklist,
{ host },
);
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
if (Array.isArray(parsed.stickers.library)) {
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
          `${dropped.length} emote${dropped.length === 1 ? '' : 's'} could not be kept: ${sample}${suffix}.`,
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
        `Adjusted saved boards to ${multistream.layouts.length} supported entries.`,
IMPORT_NOTE_MESSAGES.adjustedLayouts,
{ count: multistream.layouts.length },
);
}
}
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
const USAGE_CHANNEL_LIMIT = 400;
const USAGE_GLOBAL_LIMIT = 2000;
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
next.global = trimUsage(next.global, USAGE_GLOBAL_LIMIT);
if (channel) {
const scope = { ...(next.channels[channel] || {}) };
const entry = scope[id] || { name, count: 0, firstAt: at, lastAt: at };
scope[id] = { name: name || entry.name, count: entry.count + 1, firstAt: entry.firstAt || at, lastAt: at };
next.channels[channel] = trimUsage(scope);
}
return next;
}
function trimUsage(scope, limit = USAGE_CHANNEL_LIMIT) {
const entries = Object.entries(scope);
if (entries.length <= limit) return scope;
entries.sort((a, b) => (b[1].count - a[1].count) || (b[1].lastAt - a[1].lastAt));
return Object.fromEntries(entries.slice(0, limit));
}
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
.filter((entry) => entry.lastAt > 0)
.sort((a, b) => (b.lastAt - a.lastAt) || (b.count - a.count) || String(a.id).localeCompare(String(b.id)))
.slice(0, Math.max(0, Math.floor(Number(limit)) || 0));
}
const EMOTE_WINDOW_SIZE = 240;
function visibleWindow(entries, anchor = 0, size = EMOTE_WINDOW_SIZE) {
const list = Array.isArray(entries) ? entries : [];
const count = Math.max(1, Math.floor(Number(size)) || EMOTE_WINDOW_SIZE);
if (list.length <= count) return { start: 0, end: list.length, items: list, before: 0, after: 0 };
const lead = Math.floor(count / 4);
const requested = Math.floor(Number(anchor)) || 0;
const start = Math.min(Math.max(0, requested - lead), list.length - count);
const end = start + count;
return { start, end, items: list.slice(start, end), before: start, after: list.length - end };
}
function unusedEmotes(counts, emotes, { channel = '' } = {}) {
const used = new Set([
...Object.keys(counts?.global || {}),
...Object.keys((channel && counts?.channels?.[channel]) || {}),
]);
return (emotes || []).filter((emote) => !used.has(String(emote.id)));
}
const MULTISTREAM_SCHEMA = 1;
const MULTISTREAM_MAX = 9;
const MULTISTREAM_LAYOUT_LIMIT = 24;
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
const MULTISTREAM_LINK_PARAM = 'kf-multi';
function multistreamLayoutLink(streams, origin = 'https://kick.com') {
const slugs = cleanSlugList(streams);
if (!slugs.length) return '';
  return `${origin}/?${MULTISTREAM_LINK_PARAM}=${encodeURIComponent(slugs.join(','))}`;
}
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
const PRESENCE_TTL_MS = 30_000;
const NON_CHANNEL_SEGMENTS = new Set([
'about', 'api', 'browse', 'categories', 'category', 'clips', 'dashboard', 'drops', 'following',
'help', 'legal', 'messages', 'popout', 'privacy', 'profile', 'search', 'settings', 'shop',
'store', 'subscriptions', 'support', 'terms', 'user', 'video', 'videos', 'wallet',
]);
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
function compactPresence(entries, now = 0) {
const seen = new Map();
for (const entry of Array.isArray(entries) ? entries : []) {
if (!isRecord(entry)) continue;
const slug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
const ts = Number(entry.ts);
if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(slug)) continue;
if (!Number.isFinite(ts) || now - ts > PRESENCE_TTL_MS || ts > now + PRESENCE_TTL_MS) continue;
const key = slug.toLowerCase();
const prior = seen.get(key);
if (!prior || ts > prior.ts) seen.set(key, { slug, ts });
}
return [...seen.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}
function mergePresence(entries, now = 0) {
return compactPresence(entries, now).map((entry) => entry.slug);
}
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
paused: typeof source.paused === 'boolean' ? source.paused : false,
muted: typeof source.muted === 'boolean' ? source.muted : false,
mergedChat: typeof source.mergedChat === 'boolean' ? source.mergedChat : false,
layouts,
};
}
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
function multistreamTileMuted(value, slug) {
const state = value || {};
if (state.paused || state.muted) return true;
return slug !== state.focus;
}
function multistreamTileActive(value, slug, suspended) {
const state = value || {};
if (state.paused) return false;
if (slug === state.focus) return true;
const set = suspended instanceof Set ? suspended : new Set(suspended || []);
return !set.has(slug);
}
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
remove: [...present].filter((slug) => !seen.has(slug)),
};
}
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
const STORAGE_STORES = Object.freeze([
{ key: 'kick-focus:settings', label: 'settings', backup: true, field: 'settings', reset: true },
{ key: 'kick-focus:sticker-preferences', label: 'emote library', backup: true, field: 'stickers', reset: false },
{ key: 'kick-focus:emote-usage', label: 'emote usage counts', backup: true, field: 'usage', reset: true },
{ key: 'kick-focus:multistream', label: 'multi-stream boards', backup: true, field: 'multistream', reset: true },
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
const STORAGE_BUDGET_BYTES = 4 * 1024 * 1024;
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
function recordStorageResult(registry, key, ok, at = 0) {
const next = { ...(registry || {}) };
if (ok) delete next[key];
else next[key] = { label: storageLabel(key), at, count: (next[key]?.count || 0) + 1 };
return next;
}
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
messageKey: 'Kick Focus could not save your {list}. Browser storage is full or blocked, so those changes exist only until you reload.',
};
}
function approximateStorageBytes(entries) {
let total = 0;
const breakdown = [];
for (const [key, value] of Object.entries(entries || {})) {
let bytes = 0;
try {
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
function settingsFocusSelector(element) {
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

const KICK_ORIGIN = 'https://kick.com';
const KICK_WEB_ORIGIN = 'https://web.kick.com';
function emoteImageUrl(id, size = 'fullsize') {
  return `https://files.kick.com/emotes/${encodeURIComponent(String(id))}/${size}`;
}
const endpoints = {
  channel: (slug) => `${KICK_ORIGIN}/api/v2/channels/${encodeURIComponent(slug)}`,
  followChannel: (slug) => `${KICK_ORIGIN}/api/v2/channels/${encodeURIComponent(slug)}/follow`,
  channelMe: (slug) => `${KICK_ORIGIN}/api/v2/channels/${encodeURIComponent(slug)}/me`,
  emoteSets: (slug) => `${KICK_ORIGIN}/emotes/${encodeURIComponent(slug)}`,
  chatSettings: (channelId) => `${KICK_WEB_ORIGIN}/api/v1/channels/${encodeURIComponent(channelId)}/chat/settings`,
  chatHistory: (chatroomId) => `${KICK_WEB_ORIGIN}/api/v1/chat/${encodeURIComponent(chatroomId)}/history`,
  collectibles: () => `${KICK_WEB_ORIGIN}/api/v1/gamification/collectibles`,
  channelVideos: (channelId) => `${KICK_WEB_ORIGIN}/api/v1/channels/${encodeURIComponent(channelId)}/videos`,
currentViewers: (ids) => {
const query = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
      .map((id) => `ids[]=${encodeURIComponent(id)}`)
.join('&');
    return `${KICK_ORIGIN}/current-viewers?${query}`;
},
realtimeChat: (chatroomId, clientId) =>
    `${KICK_WEB_ORIGIN}/api/v1/realtime/chat/${encodeURIComponent(chatroomId)}/client/${encodeURIComponent(clientId)}/connection`,
};
function playerEmbedUrl(slug, { muted = true, autoplay = true } = {}) {
const params = new URLSearchParams({ muted: String(muted), autoplay: String(autoplay) });
  return `https://player.kick.com/${encodeURIComponent(slug)}?${params}`;
}
function chatEmbedUrl(slug) {
  return `${KICK_ORIGIN}/popout/${encodeURIComponent(slug)}/chat`;
}
function isValidSlug(value) {
return typeof value === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(value);
}
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
function pusherSocketUrl({ appKey, cluster }, version = '8.6.0') {
  return `wss://ws-${cluster}.pusher.com/app/${appKey}?protocol=7&client=js&version=${version}&flash=false`;
}
function kickGatewaySocketUrl({ token }) {
  return `wss://websockets.kick.com/viewer/v1/connect?token=${encodeURIComponent(token)}`;
}
const REALTIME_TRANSPORTS = Object.freeze({
PUSHER: Object.freeze({
id: 'PUSHER',
label: 'Pusher',
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
function realtimeSubscribeFrame(channel) {
return JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel } });
}
function parseRealtimeFrame(raw) {
let frame;
try {
frame = JSON.parse(raw);
} catch {
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
function realtimeChannels({ chatroomId, channelId }) {
const names = [];
  if (chatroomId) names.push(`chatrooms.${chatroomId}.v2`, `chatroom_${chatroomId}`);
  if (channelId) names.push(`channel.${channelId}`, `channel_${channelId}`);
return names;
}
const REALTIME_SILENCE_MS = 60_000;
const REALTIME_UNPARSABLE_LIMIT = 20;
function realtimeHealth({ lastFrameAt = 0, unparsable = 0, now = 0, connected = false }) {
if (!connected) return { state: 'offline', healthy: false };
if (unparsable >= REALTIME_UNPARSABLE_LIMIT) {
    return { state: 'unparsable', healthy: false, detail: `${unparsable} consecutive frames could not be read. Kick's payload shape has probably changed.` };
}
if (lastFrameAt && now - lastFrameAt > REALTIME_SILENCE_MS) {
    return { state: 'stale', healthy: false, detail: `No events for ${Math.round((now - lastFrameAt) / 1000)}s. The socket reports open but is not delivering.` };
}
return { state: 'live', healthy: true };
}
function parseKickTimestamp(value) {
if (typeof value !== 'string' || !value) return 0;
const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value.trim())
    ? `${value.trim().replace(' ', 'T')}Z`
: value;
const at = Date.parse(iso);
return Number.isFinite(at) ? at : 0;
}
function isDiscoveryLivestreamUrl(value, base = KICK_ORIGIN) {
try {
const url = new URL(String(value ?? ''), base);
if (!/(^|\.)kick\.com$/i.test(url.hostname)) return false;
return /^\/api\/v\d+\/livestreams(?:\/|$)/i.test(url.pathname);
} catch {
return false;
}
}
function normalizeDiscoveryLiveStarts(payload, limit = 500) {
const cap = Math.max(1, Math.min(500, Number.isFinite(limit) ? Math.floor(limit) : 500));
const starts = new Map();
const queue = [payload];
const seen = new Set();
const maxVisits = Math.max(32, cap * 4);
let visits = 0;
while (queue.length && visits < maxVisits && starts.size < cap) {
const value = queue.shift();
if (!value || typeof value !== 'object' || seen.has(value)) continue;
seen.add(value);
visits += 1;
if (Array.isArray(value)) {
for (const entry of value.slice(0, cap)) {
if (queue.length + seen.size >= maxVisits) break;
queue.push(entry);
}
continue;
}
const slug = value.channel?.slug
|| value.channel?.username
|| value.channel?.user?.username
|| value.channel_slug
|| value.slug;
const startedAt = parseKickTimestamp(value.start_time);
if (isValidSlug(slug) && startedAt) {
const key = slug.toLowerCase();
starts.set(key, Math.max(starts.get(key) || 0, startedAt));
}
for (const key of ['data', 'livestreams', 'streams', 'featured', 'results', 'items']) {
if (queue.length + seen.size >= maxVisits) break;
if (value[key] && typeof value[key] === 'object') queue.push(value[key]);
}
}
return starts;
}
function streamStartFromLinkedData(texts) {
if (!Array.isArray(texts)) return 0;
for (const text of texts) {
let parsed = null;
try {
parsed = JSON.parse(String(text));
} catch {
continue;
}
const nodes = Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [parsed];
for (const node of nodes) {
if (node && typeof node === 'object' && node['@type'] === 'VideoObject') {
const at = parseKickTimestamp(node.uploadDate);
if (at) return at;
}
}
}
return 0;
}
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
livestreamId: Number(livestream?.id) || 0,
followers: Number(payload.followers_count) || 0,
verified: Boolean(payload.verified),
isLive: Boolean(livestream?.is_live),
startedAt: parseKickTimestamp(livestream?.start_time) || parseKickTimestamp(livestream?.created_at),
viewers: Number(livestream?.viewer_count) || 0,
title: typeof livestream?.session_title === 'string' ? livestream.session_title : '',
mature: Boolean(livestream?.is_mature),
language: typeof livestream?.language === 'string' ? livestream.language : '',
categories: Array.isArray(livestream?.categories)
? livestream.categories.map((entry) => String(entry?.slug || '')).filter(Boolean)
: [],
};
}
function normalizeChannelVideos(payload) {
const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : null);
if (!rows) return null;
const videos = [];
for (const row of rows) {
if (!row || typeof row !== 'object') continue;
const id = typeof row.id === 'string' ? row.id : '';
if (!id) continue;
videos.push({
id,
startedAt: parseKickTimestamp(row.start_time),
endedAt: parseKickTimestamp(row.end_time),
durationSeconds: Number(row.duration) || 0,
title: typeof row.title === 'string' ? row.title : '',
status: typeof row.status === 'string' ? row.status : '',
});
}
return videos;
}
function findChannelVideo(videos, id) {
if (!Array.isArray(videos) || typeof id !== 'string' || !id) return null;
return videos.find((video) => video.id === id) || null;
}
const COLLECTIBLE_PREFIX = 'collectibles';
function isCollectibleEmote(name) {
return typeof name === 'string' && name.startsWith(COLLECTIBLE_PREFIX);
}
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
if (label === 'collectibles') return 'collectible';
return 'channel';
}
function emoteEntitlement(source) {
const emote = source && typeof source === 'object' ? source : {};
const value = emote.subscribed ?? emote.is_subscribed ?? emote.subscription
?? emote.entitled ?? emote.unlocked ?? emote.owned;
if (value === true || value === 1 || (value && typeof value === 'object')) return 'granted';
if (value === false || value === 0 || emote.locked === true || emote.is_locked === true) return 'denied';
return 'unknown';
}
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
function catalogEmoteAccess(emote) {
const source = emote && typeof emote === 'object' ? emote : {};
if (source.kind === 'global' || source.kind === 'emoji' || source.kind === 'collectible') return 'available';
const follow = emoteFollowRequirement(source);
if (follow.required && !follow.followed) return 'locked';
if (!source.subscribersOnly && !source.subscribers_only) return 'channel';
return (source.entitlement || emoteEntitlement(source)) === 'granted' ? 'available' : 'locked';
}
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
if (!sets.length) return { ok: false, reason: 'no-sets', sets: [], emotes: [] };
if (!emotes.length) return { ok: false, reason: 'no-emotes', sets, emotes };
return { ok: true, sets, emotes };
}
function applyAccountEntitlement(catalog, { slug = '', authenticated = false, subscribedToChannel = null } = {}) {
if (!catalog?.ok || !Array.isArray(catalog.emotes)) return catalog;
if (!authenticated) return { ...catalog, account: { authenticated: false, ownedSets: [], ownedEmotes: 0 } };
const asked = String(slug || '').toLowerCase();
const ownedSets = new Set();
let ownedEmotes = 0;
const decide = (emote) => {
if (emote.kind !== 'channel') return { entitlement: 'granted', usableEverywhere: true, usableHere: true };
const own = String(emote.sourceSlug || emote.setName || '').toLowerCase() === asked;
if (!own) {
return { entitlement: 'granted', usableEverywhere: true, usableHere: true };
}
if (!emote.subscribersOnly) {
return { entitlement: emote.entitlement, usableEverywhere: false, usableHere: true };
}
if (subscribedToChannel === true) return { entitlement: 'granted', usableEverywhere: true, usableHere: true };
if (subscribedToChannel === false) return { entitlement: 'denied', usableEverywhere: true, usableHere: false };
return { entitlement: emote.entitlement, usableEverywhere: true, usableHere: false };
};
const remap = (emote) => {
const verdict = decide(emote);
const next = { ...emote, ...verdict };
if (verdict.entitlement === 'granted') {
ownedEmotes += 1;
if (next.kind === 'channel' && next.setName) ownedSets.add(next.setName);
}
return next;
};
const emotes = catalog.emotes.map(remap);
  const byKey = new Map(emotes.map((emote) => [`${emote.setId}|${emote.id}`, emote]));
const sets = catalog.sets.map((set) => ({
...set,
    emotes: set.emotes.map((emote) => byKey.get(`${set.id}|${emote.id}`) || emote),
}));
return {
...catalog,
sets,
emotes,
account: { authenticated: true, ownedSets: [...ownedSets].sort(), ownedEmotes },
};
}
function emoteReachLabel(emote, channel = '') {
const source = emote && typeof emote === 'object' ? emote : {};
if (source.usableHere === false) return 'not-yours';
if (source.usableEverywhere) return 'anywhere';
return channel ? 'this-channel' : 'source-channel';
}
function channelCatalogEmotes(catalog, slug) {
if (!catalog?.ok || !Array.isArray(catalog.sets) || !isValidSlug(slug)) return [];
const wanted = String(slug).toLowerCase();
const set = catalog.sets.find((entry) => entry.kind === 'channel'
&& String(entry.name || '').toLowerCase() === wanted);
return Array.isArray(set?.emotes) ? set.emotes : [];
}
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
const entitled = source.subscribed ?? source.is_subscribed ?? source.subscription
?? source.entitled ?? source.unlocked ?? source.owned;
if (entitled === true || entitled === 1 || (entitled && typeof entitled === 'object')) {
return { locked: false, reason: '', unlockUrl: '' };
}
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
const EMOTE_TOKEN = /\[emote:(\d+):([^\]]*)\]/g;
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
function boundedString(value, max) {
return typeof value === 'string' ? value.slice(0, max) : '';
}
function parseEmoteTokens(content) {
const text = boundedString(content, LIMITS.content);
const segments = [];
let index = 0;
EMOTE_TOKEN.lastIndex = 0;
for (const match of text.matchAll(EMOTE_TOKEN)) {
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
color: /^#[0-9a-f]{3,8}$/i.test(String(identity.color || '')) ? String(identity.color) : '',
},
badges: badges.slice(0, LIMITS.badges).map((badge) => ({
type: boundedString(badge?.type || badge?.badge_type, LIMITS.badgeText),
text: boundedString(badge?.text || badge?.name, LIMITS.badgeText),
image: /^https:\/\/[a-z0-9.-]*kick\.com\//i.test(String(badge?.image_url || ''))
? String(badge.image_url).slice(0, LIMITS.url)
: '',
})).filter((badge) => badge.type || badge.text),
};
}
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
const RARITY_ORDER = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);
function rarityRank(rarity) {
const index = RARITY_ORDER.indexOf(String(rarity || '').toLowerCase());
return index < 0 ? -1 : index;
}
function joinToken(name) {
return String(name || '')
    .replace(new RegExp(`^${COLLECTIBLE_PREFIX}`, 'i'), '')
.replace(/[^a-z0-9]/gi, '')
.toLowerCase();
}
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
      if (new RegExp(`(^|[^0-9])${emote.id}([^0-9]|$)`).test(url)) {
confidence = 0.98;
basis = 'emote id in card URL';
} else if (token.length >= 4 && url.replace(/[^a-z0-9]/g, '').includes(token)) {
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
usable: total > 0 && matched.length > 0,
};
}
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
live: true,
});
if (entries.length >= 200) break;
}
return { ok: true, entries };
}
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
const COLLECTIBLE_FACTS = Object.freeze([
Object.freeze({
claim: 'The daily streak does not improve what you get.',
detail: 'Kick support has stated the streak confers no bonus to drop quality or odds. It only tracks consecutive claims. Nothing in the collectibles response carries a streak multiplier either.',
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
followingPreviewControl: Object.freeze([
Object.freeze({
id: 'following-marker-control',
selector: 'a[data-testid^="sidebar-following-channel-"][href], button[data-testid^="sidebar-following-channel-"], [role="link"][data-testid^="sidebar-following-channel-"], [tabindex][data-testid^="sidebar-following-channel-"]',
}),
Object.freeze({
id: 'following-descendant-link',
selector: '[data-testid^="sidebar-following-channel-"] a[href]',
}),
Object.freeze({
id: 'following-descendant-button',
selector: '[data-testid^="sidebar-following-channel-"] button',
}),
Object.freeze({
id: 'following-control-owner',
selector: ':is(a[href], button, [role="link"], [tabindex]):has([data-testid^="sidebar-following-channel-"])',
}),
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
playerPip: Object.freeze([
Object.freeze({ id: 'pip-testid', selector: '[data-testid="video-player-pip"]' }),
Object.freeze({ id: 'pip-icon', selector: 'button:has(> svg[data-ds-icon="ViewMiniplayer"])' }),
]),
playerClip: Object.freeze([
Object.freeze({ id: 'clip-testid', selector: '[data-testid="video-player-clip"]' }),
Object.freeze({ id: 'clip-icon', selector: 'button:has(svg[data-ds-icon="Clip"])' }),
]),
playerTheatre: Object.freeze([
Object.freeze({ id: 'theatre-testid', selector: '[data-testid="video-player-theatre-mode"]' }),
Object.freeze({ id: 'theatre-icon', selector: 'button:has(> svg[data-ds-icon="ViewTheatre"])' }),
]),
playerFullscreen: Object.freeze([
Object.freeze({ id: 'fullscreen-testid', selector: '[data-testid="video-player-fullscreen"]' }),
Object.freeze({ id: 'fullscreen-icon', selector: 'button:has(> svg[data-ds-icon^="Fullscreen"])' }),
]),
playerQuality: Object.freeze([
Object.freeze({ id: 'quality-icon', selector: 'button[aria-haspopup="menu"]:has(> svg[data-ds-icon="Settings"])' }),
Object.freeze({ id: 'quality-label', selector: 'button[aria-haspopup="menu"][aria-label*="setting" i]' }),
]),
playerVolume: Object.freeze([
Object.freeze({ id: 'volume-group', selector: 'div[class*="group/volume"]' }),
Object.freeze({ id: 'volume-icon-owner', selector: 'div:has(> button > svg[data-ds-icon^="Sound"])' }),
]),
playerShare: Object.freeze([
Object.freeze({ id: 'share-icon', selector: 'button:has(> svg[data-ds-icon="Share"])' }),
Object.freeze({ id: 'share-label', selector: 'button[aria-label*="share" i]' }),
]),
playerReport: Object.freeze([
Object.freeze({ id: 'report-icon', selector: 'button:has(> svg[data-ds-icon="Report"])' }),
Object.freeze({ id: 'report-label', selector: 'button[aria-label*="report" i]' }),
]),
sidebarHome: Object.freeze([
Object.freeze({ id: 'sidebar-home-item', selector: 'li:has(> [data-testid="sidebar-home"])' }),
Object.freeze({ id: 'sidebar-home-link', selector: '[data-testid="sidebar-home"]' }),
]),
sidebarBrowse: Object.freeze([
Object.freeze({ id: 'sidebar-browse-item', selector: 'li:has(> [data-testid="sidebar-browse"])' }),
Object.freeze({ id: 'sidebar-browse-link', selector: '[data-testid="sidebar-browse"]' }),
]),
sidebarFollowing: Object.freeze([
Object.freeze({ id: 'sidebar-following-item', selector: 'li:has(> [data-testid="sidebar-following"])' }),
Object.freeze({ id: 'sidebar-following-link', selector: '[data-testid="sidebar-following"]' }),
]),
sidebarDrops: Object.freeze([
Object.freeze({ id: 'sidebar-drops-item', selector: 'li:has(> [data-testid="sidebar-drops"])' }),
Object.freeze({ id: 'sidebar-drops-link', selector: '[data-testid="sidebar-drops"]' }),
]),
sidebarFollowedChannels: Object.freeze([
Object.freeze({ id: 'sidebar-followed-section', selector: 'section:has([data-testid^="sidebar-following-channel-"])' }),
Object.freeze({ id: 'sidebar-followed-buttons', selector: '[data-testid^="sidebar-following-channel-"]' }),
]),
sidebarRecommendedChannels: Object.freeze([
Object.freeze({ id: 'sidebar-recommended-section', selector: 'section:has([data-testid^="sidebar-recommended-channel-"])' }),
Object.freeze({ id: 'sidebar-recommended-buttons', selector: '[data-testid^="sidebar-recommended-channel-"]' }),
]),
qualityOption: Object.freeze([
Object.freeze({ id: 'quality-menuitemradio', selector: '[role="menuitemradio"]' }),
Object.freeze({ id: 'quality-data', selector: '[data-quality], [data-resolution]' }),
Object.freeze({ id: 'quality-legacy', selector: '[data-testid*="quality" i], [aria-label*="quality" i], select[data-kf-quality]' }),
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
function findAllProbe(root, name) {
const owner = asRoot(root);
if (!owner) return { elements: [], probe: null };
for (const probe of LOCATOR_PROBES[name] || []) {
try {
const elements = [...owner.querySelectorAll(probe.selector)];
if (elements.length) return { elements, probe: probe.id };
} catch {
}
}
return { elements: [], probe: null };
}
const HIDEABLE_PROBE_WINNERS = Object.freeze({
playerPip: 'pip-testid',
playerClip: 'clip-testid',
playerTheatre: 'theatre-testid',
playerFullscreen: 'fullscreen-testid',
playerQuality: 'quality-icon',
playerVolume: 'volume-group',
playerShare: 'share-icon',
playerReport: 'report-icon',
sidebarHome: 'sidebar-home-item',
sidebarBrowse: 'sidebar-browse-item',
sidebarFollowing: 'sidebar-following-item',
sidebarDrops: 'sidebar-drops-item',
sidebarFollowedChannels: 'sidebar-followed-section',
sidebarRecommendedChannels: 'sidebar-recommended-section',
});
function findHideableElements(root, name) {
const { elements, probe } = findAllProbe(root, name);
const recorded = HIDEABLE_PROBE_WINNERS[name] || null;
if (!recorded) return { elements: [], probe, recorded, declined: 'unrecorded' };
if (!probe) return { elements: [], probe, recorded, declined: 'absent' };
if (probe !== recorded) return { elements: [], probe, recorded, declined: 'fell-through' };
return { elements, probe, recorded, declined: '' };
}
function ownerFromChild(element, fallbackSelector) {
return safeClosest(element, fallbackSelector) || element.parentElement || element;
}
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
derived: derivedSnapshot(owner, options.derive),
};
}
const DERIVED_EXPECTATIONS = Object.freeze([
Object.freeze({
id: 'cardSlug',
probe: 'card',
claim: 'a card yields a channel slug',
sample: (owner) => findAllProbe(owner, 'card').elements.filter((card) => {
try { return Boolean(card.matches?.('a[href]') || card.querySelector?.('a[href]')); }
catch { return false; }
}),
judge: (value) => typeof value === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(value),
requireAll: false,
}),
Object.freeze({
id: 'playerContainer',
probe: 'video',
claim: 'a player container is an ancestor, never the video element itself',
sample: (owner) => {
try {
return [...owner.querySelectorAll('video')].slice(0, 1);
} catch {
return [];
}
},
judge: (value, source) => Boolean(value)
&& value !== source
&& typeof value.contains === 'function'
&& value.contains(source),
}),
Object.freeze({
id: 'qualityHeight',
probe: 'qualityOption',
claim: 'a quality row yields a plausible height',
sample: (owner) => findAllProbe(owner, 'qualityOption').elements,
judge: (value) => value === 0 || (Number.isFinite(value) && value >= 144 && value <= 4320),
}),
]);
function describeDerived(value) {
if (value === undefined) return 'undefined';
if (value === null) return 'null';
if (typeof value === 'string') return value === '' ? 'an empty string' : JSON.stringify(value.slice(0, 40));
if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.tagName ? `<${String(value.tagName).toLowerCase()}>` : 'an object';
return typeof value;
}
function derivedSnapshot(root, derive = {}) {
const owner = asRoot(root);
const results = [];
for (const expectation of DERIVED_EXPECTATIONS) {
const base = { id: expectation.id, probe: expectation.probe, claim: expectation.claim };
const compute = derive[expectation.id];
if (typeof compute !== 'function') {
results.push({ ...base, outcome: 'unchecked', checked: 0, failed: 0, detail: 'no deriver supplied' });
continue;
}
let sources = [];
try {
sources = owner ? expectation.sample(owner) : [];
} catch {
sources = [];
}
if (!sources.length) {
results.push({ ...base, outcome: 'absent', checked: 0, failed: 0, detail: 'nothing to derive from on this route' });
continue;
}
let failed = 0;
let firstBad = '';
for (const source of sources) {
let value;
try {
value = compute(source);
} catch {
value = undefined;
}
if (expectation.judge(value, source)) continue;
failed += 1;
if (!firstBad) firstBad = describeDerived(value);
}
const requireAll = expectation.requireAll !== false;
const broken = requireAll ? failed > 0 : failed === sources.length;
results.push({
...base,
outcome: broken ? 'broken' : 'ok',
checked: sources.length,
failed,
detail: broken
        ? `${failed} of ${sources.length} resolved but derived ${firstBad}`
        : `${sources.length} checked${failed ? `, ${failed} legitimately yielded nothing` : ''}`,
});
}
return results;
}
function compatibilitySummary(snapshot) {
const broken = (snapshot?.derived || []).filter((entry) => entry.outcome === 'broken');
const derivedNote = broken.length
    ? ` ${broken.map((entry) => `${entry.probe} resolved but ${entry.claim} failed (${entry.detail})`).join('; ')}.`
: '';
if (!snapshot || snapshot.healthy) {
    return `Shell hooks matched${snapshot?.cards ? `; ${snapshot.cards} stream cards found` : ''}.${derivedNote}`;
}
  return `Compatibility needs attention: missing ${snapshot.missing.join(', ')}.${derivedNote}`;
}

const LIBRARY_DB_NAME = 'kick-focus';
const LIBRARY_DB_VERSION = 1;
const LIBRARY_STORE = 'library';
const BLOB_STORE = 'blobs';
const LIBRARY_SEED_LIMIT = 400;
const LIBRARY_SEED_BYTES = 50_000;
const libraryUtf8Encoder = new TextEncoder();
function utf8ByteLength(value) {
return libraryUtf8Encoder.encode(String(value ?? '')).byteLength;
}
const PROVIDER_SCORES = Object.freeze({ indexeddb: 100, localstorage: -1000 });
const isStoredRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const SEED_MARKER = 'librarySeedTotal';
function withoutMarker(value) {
if (!isStoredRecord(value) || !(SEED_MARKER in value)) return value;
const copy = { ...value };
delete copy[SEED_MARKER];
return copy;
}
function planLibraryPersist(value, { seedLimit = LIBRARY_SEED_LIMIT, seedBytes = LIBRARY_SEED_BYTES } = {}) {
const source = isStoredRecord(value) ? withoutMarker(value) : {};
const library = Array.isArray(source.library) ? source.library : [];
const limit = Math.max(0, Math.floor(Number(seedLimit)) || 0);
const ordered = [...library].sort((a, b) => (Number(b?.lastSeen) || 0) - (Number(a?.lastSeen) || 0));
const budget = Math.max(0, Math.floor(Number(seedBytes)) || 0);
const build = (count) => ({ ...source, library: ordered.slice(0, count), [SEED_MARKER]: library.length });
let count = Math.min(limit, ordered.length);
if (budget && utf8ByteLength(JSON.stringify(build(count))) > budget) {
let low = 0;
let high = count;
while (low < high) {
const middle = Math.ceil((low + high) / 2);
if (utf8ByteLength(JSON.stringify(build(middle))) > budget) high = middle - 1;
else low = middle;
}
count = low;
}
return {
full: { ...source, library },
seed: build(count),
truncated: Math.max(0, library.length - count),
};
}
function describeLibrarySeed({ truncated = 0, total = 0 } = {}) {
const dropped = Math.max(0, Math.floor(Number(truncated)) || 0);
const held = Math.max(0, (Math.floor(Number(total)) || 0) - dropped);
if (!dropped) return null;
return {
truncated: dropped,
held,
messageKey: 'The first paint reads {held} of your {total} emotes. The rest load from the database a moment later.',
values: { held, total: held + dropped },
};
}
function isSeedPartial(value) {
if (!isStoredRecord(value)) return false;
const total = Number(value[SEED_MARKER]);
if (!Number.isFinite(total)) return false;
return total > (Array.isArray(value.library) ? value.library.length : 0);
}
function mergeHydratedLibrary(seed, hydrated) {
const base = isStoredRecord(seed) ? seed : {};
if (!isStoredRecord(hydrated)) return withoutMarker(base);
const merged = new Map();
for (const entry of Array.isArray(hydrated.library) ? hydrated.library : []) {
const key = typeof entry?.key === 'string' ? entry.key : '';
if (key) merged.set(key, entry);
}
for (const entry of Array.isArray(base.library) ? base.library : []) {
const key = typeof entry?.key === 'string' ? entry.key : '';
if (!key) continue;
const existing = merged.get(key);
if (!existing || (Number(entry.lastSeen) || 0) >= (Number(existing.lastSeen) || 0)) merged.set(key, entry);
}
return withoutMarker({ ...hydrated, ...base, library: [...merged.values()] });
}
function request(source) {
return new Promise((resolve, reject) => {
source.onsuccess = () => resolve(source.result);
source.onerror = () => reject(source.error || new Error('idb-request-failed'));
});
}
function openLibraryDatabase(factory) {
const idb = factory || globalThis.indexedDB;
if (!idb) return Promise.resolve(null);
return new Promise((resolve) => {
let open;
try {
open = idb.open(LIBRARY_DB_NAME, LIBRARY_DB_VERSION);
} catch {
resolve(null);
return;
}
open.onupgradeneeded = () => {
const db = open.result;
if (!db.objectStoreNames.contains(LIBRARY_STORE)) db.createObjectStore(LIBRARY_STORE);
if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
};
open.onsuccess = () => resolve(open.result);
open.onerror = () => resolve(null);
open.onblocked = () => resolve(null);
});
}
function createLibraryStore(host) {
const {
readFallback,
writeFallback,
indexedDB: factory = null,
seedLimit = LIBRARY_SEED_LIMIT,
onError = () => {},
} = host;
let database = null;
let opened = false;
let queued = null;
let draining = null;
const provider = () => (database ? 'indexeddb' : 'localstorage');
const score = () => PROVIDER_SCORES[provider()];
async function connect() {
if (opened) return database;
opened = true;
database = await openLibraryDatabase(factory);
return database;
}
function readSync() {
return readFallback();
}
async function hydrate() {
const db = await connect();
if (!db) return null;
try {
const transaction = db.transaction(LIBRARY_STORE, 'readonly');
const stored = await request(transaction.objectStore(LIBRARY_STORE).get('preferences'));
if (!isStoredRecord(stored)) return null;
return mergeHydratedLibrary(readFallback(), stored);
} catch (error) {
onError('hydrate', error);
return null;
}
}
function write(value) {
const plan = planLibraryPersist(value, { seedLimit });
const ok = writeFallback(plan.seed);
queued = plan.full;
void flush();
return { ok, truncated: plan.truncated, provider: provider() };
}
function flush() {
if (draining) return draining;
if (queued === null) return Promise.resolve();
draining = drain().finally(() => { draining = null; });
return draining;
}
async function drain() {
const db = await connect();
if (!db) { queued = null; return; }
try {
while (queued !== null) {
const value = queued;
queued = null;
const transaction = db.transaction(LIBRARY_STORE, 'readwrite');
await request(transaction.objectStore(LIBRARY_STORE).put(value, 'preferences'));
}
} catch (error) {
onError('write', error);
queued = null;
}
}
async function putBlob(key, blob) {
const db = await connect();
if (!db || !key) return false;
try {
const transaction = db.transaction(BLOB_STORE, 'readwrite');
await request(transaction.objectStore(BLOB_STORE).put(blob, key));
return true;
} catch (error) {
onError('put-blob', error);
return false;
}
}
async function getBlob(key) {
const db = await connect();
if (!db || !key) return null;
try {
const transaction = db.transaction(BLOB_STORE, 'readonly');
return await request(transaction.objectStore(BLOB_STORE).get(key)) ?? null;
} catch (error) {
onError('get-blob', error);
return null;
}
}
async function clear() {
const db = await connect();
if (!db) return false;
try {
const transaction = db.transaction([LIBRARY_STORE, BLOB_STORE], 'readwrite');
await Promise.all([
request(transaction.objectStore(LIBRARY_STORE).clear()),
request(transaction.objectStore(BLOB_STORE).clear()),
]);
return true;
} catch (error) {
onError('clear', error);
return false;
}
}
return { readSync, hydrate, write, flush, putBlob, getBlob, clear, provider, score };
}

const LIVE_TIMEOUT_MS = 8000;
const LIVE_MAX_BYTES = 4_000_000;
const REALTIME_BACKOFF_MS = [2000, 5000, 15000, 45000];
const MERGED_CHAT_BACKOFF_MS = [2000, 5000, 15000, 45000];
const MERGED_CHAT_SILENCE_MS = 45_000;
const MERGED_CHAT_QUEUE_LIMIT = 2;
const HARVEST_MAX_INFLIGHT = 4;
const HARVEST_NEGATIVE_CAP = 5000;
const HARVEST_TIMEOUT_MS = 8000;
const HARVEST_QUEUE_CAP = 600;
const CHAT_BADGE_WAIT_MS = 30_000;
function chatMessageSelector(id) {
const escaped = CSS.escape(id);
  return `[data-index="${escaped}"], [data-message-id="${escaped}"], [data-chat-entry="${escaped}"]`;
}
function createLive(host) {
const {
state,
gmSet,
EMOTE_USAGE_KEY,
pageFetch,
currentChannelSlug,
currentVodId,
plural,
mergeStickerLibrary,
} = host;
function kickBearerToken() {
const raw = document.cookie.split(';')
.map((part) => part.trim())
.find((part) => part.startsWith('session_token='));
if (!raw) return '';
try {
return decodeURIComponent(raw.slice('session_token='.length));
} catch {
return '';
}
}
function isKickUrl(url) {
try {
const { origin } = new URL(String(url), window.location.href);
return origin === KICK_ORIGIN || origin === KICK_WEB_ORIGIN;
} catch {
return false;
}
}
function describeKickFetchFailure(status) {
if (status === 'parse') return 'returned data this build could not read';
if (status === 'timeout') return 'timed out';
if (status === 'network') return 'could not be reached';
if (status === 'oversized') return 'returned more data than this build will read';
    return `answered ${status}`;
}
async function kickFetchJson(url, { credentials = 'include', signal } = {}) {
const controller = new AbortController();
const forwardAbort = () => controller.abort();
if (signal?.aborted) forwardAbort();
else signal?.addEventListener?.('abort', forwardAbort, { once: true });
const timer = window.setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
let stopAbortWait = () => {};
const aborted = new Promise((_, reject) => {
const onAbort = () => {
const error = new Error('request aborted');
error.name = 'AbortError';
reject(error);
};
stopAbortWait = () => controller.signal.removeEventListener('abort', onAbort);
if (controller.signal.aborted) onAbort();
else controller.signal.addEventListener('abort', onAbort, { once: true });
});
try {
const headers = { accept: 'application/json' };
if (isKickUrl(url)) {
const token = kickBearerToken();
        if (token) headers.authorization = `Bearer ${token}`;
}
const response = await Promise.race([pageFetch(url, {
credentials,
signal: controller.signal,
headers,
}), aborted]);
if (!response.ok) return { ok: false, status: response.status };
const text = await response.text();
if (text.length > LIVE_MAX_BYTES) return { ok: false, status: 'oversized' };
try {
return { ok: true, status: response.status, body: JSON.parse(text) };
} catch {
return { ok: false, status: 'parse' };
}
} catch (error) {
return { ok: false, status: error?.name === 'AbortError' ? 'timeout' : 'network' };
} finally {
clearTimeout(timer);
stopAbortWait();
signal?.removeEventListener?.('abort', forwardAbort);
}
}
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
function recordApiDrift(endpoint, reason, detail = '') {
if (state.live.apiDrift.length >= 50) return;
state.live.apiDrift.push({ endpoint, reason, detail, at: Date.now() });
}
async function refreshLiveChannel() {
const slug = currentChannelSlug();
if (!slug) {
teardownRealtime();
state.live.slug = '';
state.live.channel = null;
return;
}
if (state.live.slug === slug && state.live.channel) {
await refreshVodRetention(slug);
return;
}
teardownRealtime();
state.live.slug = slug;
state.live.channel = null;
state.live.catalog = null;
state.live.catalogSource = 'dom';
state.live.catalogError = '';
state.live.collisions = [];
state.live.rarity = null;
state.live.inventory = null;
state.live.standing = { known: false, subscribed: null, following: null, moderator: null };
state.live.vod = null;
const wantsVodDate = state.settings.content.showVodExpiry && Boolean(currentVodId());
if (!state.settings.content.liveEmoteCatalog && !state.settings.content.liveChatEvents && !wantsVodDate) return;
const channelResponse = await kickFetchJson(endpoints.channel(slug));
if (state.live.slug !== slug) return;
if (!channelResponse.ok) {
      state.live.catalogError = `Kick's channel API ${describeKickFetchFailure(channelResponse.status)}.`;
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
await refreshVodRetention(slug);
if (state.settings.content.liveEmoteCatalog) await refreshEmoteCatalog(slug);
if (state.settings.content.liveChatEvents) connectRealtime();
refreshLiveDiagnostics();
}
async function refreshVodRetention(slug) {
if (!state.settings.content.showVodExpiry) {
state.live.vod = null;
return;
}
const id = currentVodId();
if (!id) {
state.live.vod = null;
return;
}
if (state.live.vod?.id === id) return;
state.live.vod = null;
const channelId = state.live.channel?.id;
if (!channelId) return;
const response = await kickFetchJson(endpoints.channelVideos(channelId));
if (state.live.slug !== slug) return;
if (!response.ok) return;
const videos = normalizeChannelVideos(response.body);
if (!videos) {
recordApiDrift('channel-videos', 'shape-changed');
return;
}
const entry = findChannelVideo(videos, id);
if (!entry || !entry.startedAt) return;
state.live.vod = { id, startedAt: entry.startedAt, title: entry.title };
}
async function readChannelStanding(slug) {
const response = await kickFetchJson(endpoints.channelMe(slug));
if (!response.ok) return { known: false, subscribed: null, following: null, moderator: null };
const body = response.body && typeof response.body === 'object' ? response.body : null;
if (!body) {
recordApiDrift('channel-me', 'shape-changed');
return { known: false, subscribed: null, following: null, moderator: null };
}
return {
known: true,
subscribed: body.subscription != null,
following: body.is_following === true,
moderator: body.is_moderator === true,
};
}
async function refreshEmoteCatalog(slug) {
const [response, standing] = await Promise.all([
kickFetchJson(endpoints.emoteSets(slug), { credentials: 'include' }),
readChannelStanding(slug),
]);
if (state.live.slug !== slug) return;
state.live.standing = standing;
if (!response.ok) {
      state.live.catalogError = `Kick's emote API ${describeKickFetchFailure(response.status)}; using the picker instead.`;
refreshLiveDiagnostics();
return;
}
const parsed = normalizeEmoteSets(response.body);
const catalog = applyAccountEntitlement(parsed, {
slug,
authenticated: standing.known,
subscribedToChannel: standing.known ? standing.subscribed : null,
});
if (!catalog.ok) {
      state.live.catalogError = `Kick's emote payload changed shape (${catalog.reason}); using the picker instead.`;
recordApiDrift('emotes', 'shape-changed', catalog.reason);
refreshLiveDiagnostics();
return;
}
state.live.catalog = catalog;
state.live.catalogSource = 'api';
state.live.catalogError = '';
state.live.collisions = state.settings.content.warnShadowedEmotes ? findShadowedNames(catalog.emotes) : [];
mergeStickerLibrary(catalog.emotes.map((emote) => ({
      key: platformStickerKey(`id:${emote.id}`),
id: emote.id,
name: emote.name,
src: emote.url,
nativeGroups: [emote.setName],
access: catalogEmoteAccess(emote),
sourceSlug: emote.sourceSlug,
requiresFollow: emote.requiresFollow,
followed: emote.followed,
subscribersOnly: emote.subscribersOnly,
usableEverywhere: emote.usableEverywhere,
usableHere: emote.usableHere,
})));
if (state.settings.content.showEmoteRarity) await refreshCollectibleRarity(slug);
refreshLiveDiagnostics();
}
async function refreshCollectibleRarity(slug) {
if (!state.live.catalog?.emotes.some((emote) => emote.collectible)) return;
const response = await kickFetchJson(endpoints.collectibles());
if (state.live.slug !== slug || !response.ok) return;
const cards = Array.isArray(response.body?.data) ? response.body.data
: (Array.isArray(response.body) ? response.body : []);
if (!cards.length) return;
const join = joinCollectibleRarity(cards, state.live.catalog.emotes);
state.live.rarity = join.usable ? join : null;
const inventory = summarizeCollectibleInventory(cards);
state.live.inventory = inventory.ok ? inventory : null;
refreshLiveDiagnostics();
}
async function readCollectibleInventory() {
const response = await kickFetchJson(endpoints.collectibles());
const observedAt = Date.now();
if (!response.ok) {
const denied = response.status === 401 || response.status === 403;
return { denied, failed: !denied, status: response.status, observedAt };
}
const cards = Array.isArray(response.body?.data) ? response.body.data
: (Array.isArray(response.body) ? response.body : null);
if (!cards) {
recordApiDrift('collectibles', 'shape-changed');
return { failed: true, status: 'shape', observedAt };
}
const summary = summarizeCollectibleInventory(cards);
return {
owned: summary.ok ? summary.distinct : 0,
copies: summary.ok ? summary.copies : 0,
observedAt,
};
}
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
try { socket?.close(); } catch {   }
}
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
state.live.subscribed = [];
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
function mergedChatState() {
if (!state.mergedChat) {
state.mergedChat = {
entries: [],
connections: new Map(),
errors: [],
queueTimer: 0,
inflight: 0,
recoveryListeners: null,
};
}
return state.mergedChat;
}
const mergedNow = () => (typeof host.now === 'function' ? host.now() : Date.now());
const mergedRandom = () => (typeof host.random === 'function' ? host.random() : Math.random());
const mergedSetTimeout = (callback, delay) => (typeof host.setTimeout === 'function'
? host.setTimeout(callback, delay)
: window.setTimeout(callback, delay));
const mergedClearTimeout = (timer) => {
if (typeof host.clearTimeout === 'function') host.clearTimeout(timer);
else clearTimeout(timer);
};
function mergedRetryDelay(attempts) {
const base = MERGED_CHAT_BACKOFF_MS[Math.min(Math.max(0, attempts - 1), MERGED_CHAT_BACKOFF_MS.length - 1)];
const jitter = Math.max(0, Math.min(1, Number(mergedRandom()) || 0));
return Math.round(base * (0.8 + (jitter * 0.4)));
}
function noteMergedError(slug, reason) {
const merged = mergedChatState();
merged.errors.push({ slug, reason, at: mergedNow() });
if (merged.errors.length > 40) merged.errors.splice(0, merged.errors.length - 40);
}
function stopMergedSocket(slot) {
const controller = slot.controller;
slot.controller = null;
if (controller) controller.abort();
const finishAttempt = slot.finishAttempt;
if (finishAttempt) finishAttempt();
const socket = slot.socket;
slot.socket = null;
slot.token += 1;
if (!socket) return;
try { socket.close(); } catch {   }
}
function scheduleMergedQueue() {
const merged = mergedChatState();
if (merged.queueTimer) {
mergedClearTimeout(merged.queueTimer);
merged.queueTimer = 0;
}
if (!merged.connections.size) return;
const now = mergedNow();
let dueAt = Number.POSITIVE_INFINITY;
const hasCapacity = merged.inflight < MERGED_CHAT_QUEUE_LIMIT;
for (const slot of merged.connections.values()) {
if (hasCapacity && (slot.status === 'queued' || slot.status === 'waiting')) {
dueAt = Math.min(dueAt, slot.retryAt || now);
} else if (slot.status === 'connecting') {
dueAt = Math.min(dueAt, slot.retryAt || now);
} else if ((slot.status === 'open' || slot.status === 'live') && slot.socket) {
dueAt = Math.min(dueAt, slot.lastFrameAt + MERGED_CHAT_SILENCE_MS);
}
}
if (!Number.isFinite(dueAt)) return;
merged.queueTimer = mergedSetTimeout(runMergedQueue, Math.max(0, dueAt - now));
}
function queueMergedRetry(slot, reason, immediate = false) {
const merged = mergedChatState();
if (merged.connections.get(slot.slug) !== slot) return;
stopMergedSocket(slot);
if (!immediate) slot.attempts += 1;
slot.status = immediate ? 'queued' : 'waiting';
slot.lastError = reason;
slot.retryAt = mergedNow() + (immediate ? 0 : mergedRetryDelay(slot.attempts));
noteMergedError(slot.slug, reason);
scheduleMergedQueue();
}
function bindMergedRecovery() {
const merged = mergedChatState();
if (merged.recoveryListeners) return;
const recover = (event) => recoverMergedChatQueue(event?.type || 'recovery');
const visible = () => {
if (!document.hidden) recoverMergedChatQueue('visibilitychange');
};
window.addEventListener?.('online', recover);
window.addEventListener?.('pageshow', recover);
document.addEventListener?.('visibilitychange', visible);
merged.recoveryListeners = { recover, visible };
}
function unbindMergedRecovery() {
const merged = mergedChatState();
const listeners = merged.recoveryListeners;
if (!listeners) return;
window.removeEventListener?.('online', listeners.recover);
window.removeEventListener?.('pageshow', listeners.recover);
document.removeEventListener?.('visibilitychange', listeners.visible);
merged.recoveryListeners = null;
}
function recoverMergedChatQueue(reason) {
const merged = mergedChatState();
const now = mergedNow();
for (const slot of merged.connections.values()) {
const force = reason === 'online' || reason === 'pageshow';
const stale = slot.lastFrameAt > 0 && now - slot.lastFrameAt >= MERGED_CHAT_SILENCE_MS;
if (!slot.socket || force || stale) queueMergedRetry(slot, reason, true);
}
scheduleMergedQueue();
}
function closeMergedChannel(slug) {
const merged = mergedChatState();
const entry = merged.connections.get(slug);
merged.connections.delete(slug);
if (!entry) return;
entry.cancelled = true;
stopMergedSocket(entry);
merged.entries = dropMergedChannel(merged.entries, slug);
scheduleMergedQueue();
}
function closeMergedChat() {
const merged = mergedChatState();
for (const slug of [...merged.connections.keys()]) closeMergedChannel(slug);
if (merged.queueTimer) mergedClearTimeout(merged.queueTimer);
merged.queueTimer = 0;
merged.entries = [];
merged.errors = [];
unbindMergedRecovery();
}
function onMergedFrame(slug, socket, event) {
const merged = mergedChatState();
const slot = merged.connections.get(slug);
if (!slot || slot.socket !== socket) return;
slot.lastFrameAt = mergedNow();
const frame = parseRealtimeFrame(event.data);
if (frame.kind !== 'unparsable') {
slot.status = 'live';
slot.attempts = 0;
slot.lastError = '';
}
scheduleMergedQueue();
if (frame.kind !== 'chat-message') return;
const message = normalizeChatMessage(frame.payload);
if (!message) return;
merged.entries = appendMergedMessage(merged.entries, {
slug,
id: message.id,
text: message.content,
sender: message.sender?.username || '',
color: message.sender?.color || '',
at: Date.now(),
});
}
async function openMergedChannel(slot) {
const merged = mergedChatState();
const { slug } = slot;
if (merged.connections.get(slug) !== slot || slot.cancelled) return false;
slot.status = 'connecting';
slot.retryAt = mergedNow() + LIVE_TIMEOUT_MS;
slot.token += 1;
const token = slot.token;
const controller = new AbortController();
slot.controller = controller;
const channelResponse = await kickFetchJson(endpoints.channel(slug), { signal: controller.signal });
if (merged.connections.get(slug) !== slot || slot.cancelled || slot.token !== token) return false;
const channel = channelResponse.ok ? normalizeChannel(channelResponse.body) : null;
if (!channel?.chatroomId) {
      queueMergedRetry(slot, `channel credentials ${describeKickFetchFailure(channelResponse.status)}`);
return false;
}
const clientId = crypto.randomUUID();
const response = await kickFetchJson(endpoints.realtimeChat(channel.chatroomId, clientId), { signal: controller.signal });
if (merged.connections.get(slug) !== slot || slot.cancelled || slot.token !== token) return false;
const connection = response.ok ? normalizeRealtimeConnection(response.body) : { ok: false };
if (!connection.ok) {
      queueMergedRetry(slot, `realtime credentials ${describeKickFetchFailure(response.status)}`);
return false;
}
if (slot.controller === controller) slot.controller = null;
let socket;
try {
socket = new WebSocket(connection.transport.socketUrl(connection));
} catch {
queueMergedRetry(slot, 'socket construction failed');
return false;
}
if (merged.connections.get(slug) !== slot || slot.cancelled || slot.token !== token) {
try { socket.close(); } catch {   }
return false;
}
slot.socket = socket;
slot.chatroomId = channel.chatroomId;
slot.channelId = channel.id;
slot.retryAt = mergedNow() + LIVE_TIMEOUT_MS;
return new Promise((resolve) => {
const finishAttempt = () => {
if (slot.finishAttempt !== finishAttempt) return;
slot.finishAttempt = null;
resolve(true);
};
slot.finishAttempt = finishAttempt;
socket.addEventListener('open', () => {
if (mergedChatState().connections.get(slug) !== slot || slot.socket !== socket) return;
slot.status = 'open';
slot.lastFrameAt = mergedNow();
for (const name of realtimeChannels({ chatroomId: channel.chatroomId, channelId: channel.id })) {
socket.send(realtimeSubscribeFrame(name));
}
finishAttempt();
scheduleMergedQueue();
});
socket.addEventListener('message', (event) => onMergedFrame(slug, socket, event));
socket.addEventListener('error', () => {
if (mergedChatState().connections.get(slug) === slot && slot.socket === socket) {
queueMergedRetry(slot, 'socket error');
}
});
socket.addEventListener('close', () => {
const current = mergedChatState().connections.get(slug);
if (current === slot && current.socket === socket) queueMergedRetry(slot, 'socket closed');
});
});
}
function startMergedChannel(slot) {
const merged = mergedChatState();
if (merged.connections.get(slot.slug) !== slot || slot.cancelled || merged.inflight >= MERGED_CHAT_QUEUE_LIMIT) return;
merged.inflight += 1;
openMergedChannel(slot)
.catch(() => queueMergedRetry(slot, 'connection failed'))
.finally(() => {
merged.inflight = Math.max(0, merged.inflight - 1);
scheduleMergedQueue();
});
}
function runMergedQueue() {
const merged = mergedChatState();
merged.queueTimer = 0;
const now = mergedNow();
for (const slot of merged.connections.values()) {
const stalled = (slot.status === 'open' || slot.status === 'live')
&& slot.socket && now - slot.lastFrameAt >= MERGED_CHAT_SILENCE_MS;
const hung = slot.status === 'connecting' && slot.retryAt <= now;
if (stalled || hung) queueMergedRetry(slot, stalled ? 'socket silent' : 'connection timed out');
}
const due = [...merged.connections.values()]
.filter((slot) => !slot.cancelled
&& (slot.status === 'queued' || slot.status === 'waiting')
&& slot.retryAt <= now)
.sort((first, second) => first.retryAt - second.retryAt || first.slug.localeCompare(second.slug));
while (due.length && merged.inflight < MERGED_CHAT_QUEUE_LIMIT) startMergedChannel(due.shift());
scheduleMergedQueue();
}
function syncMergedChat(slugs) {
const merged = mergedChatState();
const wanted = Array.isArray(slugs) ? slugs.filter((slug) => typeof slug === 'string' && slug) : [];
const wantedSet = new Set(wanted);
for (const slug of [...merged.connections.keys()]) {
if (!wantedSet.has(slug)) closeMergedChannel(slug);
}
for (const slug of wanted) {
if (!merged.connections.has(slug)) {
merged.connections.set(slug, {
slug,
socket: null,
status: 'queued',
lastFrameAt: 0,
attempts: 0,
retryAt: mergedNow(),
lastError: '',
token: 0,
cancelled: false,
controller: null,
finishAttempt: null,
});
}
}
if (merged.connections.size) bindMergedRecovery();
scheduleMergedQueue();
return merged;
}
function mergedChatEntries() {
return mergedChatState().entries;
}
function mergedChatChannels() {
return [...mergedChatState().connections.keys()];
}
function mergedChatStatus() {
const slots = [...mergedChatState().connections.values()];
return {
total: slots.length,
live: slots.filter((slot) => slot.status === 'live').length,
connecting: slots.filter((slot) => slot.status === 'queued' || slot.status === 'connecting' || slot.status === 'open').length,
waiting: slots.filter((slot) => slot.status === 'waiting').length,
};
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
state.live.lastLiveAt = Date.now();
refreshLiveDiagnostics();
return;
}
if (frame.kind === 'chat-message') {
if (!state.live.providerVerified) {
state.live.providerVerified = true;
recordApiDrift('realtime', 'unverified-transport-verified', state.live.provider);
refreshLiveDiagnostics();
}
onRealtimeChatMessage(frame.payload);
} else if (frame.kind === 'deletion') onRealtimeDeletion(frame.payload);
}
function onRealtimeChatMessage(payload) {
const settings = state.settings.content;
const wantsHarvest = settings.liveChatEvents && settings.organizeChatStickers;
if (!settings.countEmoteUsage && !settings.showChatBadges && !wantsHarvest) return;
const message = normalizeChatMessage(payload);
if (!message) return;
if (settings.showChatBadges && message.badges.length) queueChatBadges(message);
if (wantsHarvest && message.emotes.length) queueChatEmoteHarvest(message.emotes);
if (!settings.countEmoteUsage || !message.emotes.length) return;
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
else if (!chatEmoteHarvest.negative.has(key) && chatEmoteHarvest.queue.length < HARVEST_QUEUE_CAP) {
chatEmoteHarvest.queue.push(observation);
}
}
chatEmoteHarvest.buffer.clear();
if (known.length) mergeStickerLibrary(known);
pumpChatEmoteHarvest();
}
function pumpChatEmoteHarvest() {
while (chatEmoteHarvest.inflight < HARVEST_MAX_INFLIGHT && chatEmoteHarvest.queue.length) {
const observation = chatEmoteHarvest.queue.shift();
if (chatEmoteHarvest.negative.has(observation.key) || state.stickerPreferences.library.has(observation.key)) continue;
chatEmoteHarvest.inflight += 1;
const image = new Image();
let settled = false;
let timer = 0;
const settle = (ok) => {
if (settled) return;
settled = true;
window.clearTimeout(timer);
image.onload = null;
image.onerror = null;
chatEmoteHarvest.inflight -= 1;
if (ok) mergeStickerLibrary([observation]);
else if (chatEmoteHarvest.negative.size < HARVEST_NEGATIVE_CAP) chatEmoteHarvest.negative.add(observation.key);
pumpChatEmoteHarvest();
};
image.onload = () => settle(image.naturalWidth > 0);
image.onerror = () => settle(false);
timer = window.setTimeout(() => settle(false), HARVEST_TIMEOUT_MS);
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
function onRealtimeDeletion(payload) {
if (!state.settings.content.showModerationReasons) return;
const deletion = normalizeDeletion(payload);
if (!deletion) return;
state.live.deletions.set(deletion.id, deletion);
if (state.live.deletions.size > 300) {
const oldest = state.live.deletions.keys().next().value;
state.live.deletions.delete(oldest);
}
annotateDeletedMessage(deletion);
}
function annotateDeletedMessage(deletion) {
host.forgetChatMessage?.(deletion.id);
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
    parts.push(`Chat events: ${health.state}${via}${health.detail ? `: ${health.detail}` : ''}`);
    if (state.live.rarity) parts.push(`Rarity resolved for ${state.live.rarity.matched.length} of ${state.live.rarity.total} collectibles.`);
    if (state.live.collisions.length) parts.push(`${state.live.collisions.length} ${plural(state.live.collisions.length, 'emote name shadowed.', 'emote names shadowed.')}`);
if (state.live.catalogError) parts.push(state.live.catalogError);
return parts.join(' ');
}
return {
closeMergedChat,
mergedChatChannels,
mergedChatEntries,
mergedChatStatus,
syncMergedChat,
connectRealtime,
kickFetchJson,
liveStatusSummary,
localUsername,
mutateKickChannelFollow,
onRealtimeFrame,
readCollectibleInventory,
recordApiDrift,
refreshLiveChannel,
refreshLiveDiagnostics,
replayPendingBadges,
replayPendingDeletions,
teardownRealtime,
};
}

function isPlainRecord(value) {
return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function createMultistream(host) {
const {
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
kickFetchJson,
recordApiDrift,
mergedChatEntries,
mergedChatStatus,
syncMergedChat,
closeMergedChat,
syncCardMultiState = () => {},
} = host;
let syncChannel = null;
function persistMultistream() {
gmSet(MULTISTREAM_KEY, state.multistream);
}
function commitMultistream(added = [], removed = []) {
state.multistream = mergeMultistream(gmGet(MULTISTREAM_KEY, {}), state.multistream, added, removed);
gmSet(MULTISTREAM_KEY, state.multistream);
if (added.length || removed.length) broadcastMultistream(added, removed);
return state.multistream;
}
function broadcastMultistream(added, removed) {
const channel = multistreamSyncChannel();
if (!channel) return;
try {
channel.postMessage({ type: 'converge', added: [...added], removed: [...removed], ts: Date.now() });
} catch {
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
function installMultistreamStorageSync() {
if (typeof window?.addEventListener !== 'function') return;
window.addEventListener('storage', (event) => {
if (event?.key !== MULTISTREAM_KEY) return;
applyRemoteMultistream();
});
}
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
function multistreamPresenceChannel() {
if (state.presence.channel || typeof BroadcastChannel !== 'function') return state.presence.channel;
try {
const channel = new BroadcastChannel('kick-focus:presence');
channel.addEventListener('message', (event) => {
const message = event?.data;
if (!isPlainRecord(message)) return;
if (message.type === 'who') {
const slug = currentChannelSlug();
if (slug) channel.postMessage({ type: 'here', slug, ts: Date.now() });
return;
}
if (message.type === 'here') {
state.presence.answers = compactPresence(
[...state.presence.answers, { slug: message.slug, ts: message.ts }],
Date.now(),
);
renderPresenceOffer();
}
});
state.presence.channel = channel;
} catch {
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
showToast(trf('Added {count} from your other tabs ({total} of {max})', {
count: offer.length, total: result.streams.length, max: MULTISTREAM_MAX,
}));
announce(trf('Added {count} channels from your other tabs.', { count: offer.length }));
}
function openMultistream() {
const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
if (!backdrop) return;
state.multistreamOpener = deepActiveElement();
backdrop.hidden = false;
commitMultistream();
installMultistreamSuspension();
if (!state.multistream.paused && matchMedia('(prefers-reduced-motion: reduce)').matches) {
state.multistream = normalizeMultistream({ ...state.multistream, paused: true });
}
renderMultistream();
requestMultistreamPresence();
backdrop.querySelector('[data-kf-multistream-input]')?.focus();
announce(tr('Multi-stream opened'));
resolveMultistreamLive().catch(() => {});
}
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
const grid = backdrop.querySelector('[data-kf-multistream-grid]');
if (grid) grid.replaceChildren();
stopMergedChatPaint();
closeMergedChat();
const chat = backdrop.querySelector('[data-kf-multistream-chat]');
if (chat) chat.replaceChildren();
state.observers.multistream?.disconnect?.();
state.observers.multistream = null;
state.multistreamSuspended.clear();
restoreFocus(state.multistreamOpener);
state.multistreamOpener = null;
}
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
function observeMultistreamVisibility(grid) {
state.observers.multistream?.disconnect?.();
if (typeof IntersectionObserver !== 'function') return;
state.observers.multistream = new IntersectionObserver((entries) => {
let changed = false;
for (const entry of entries) {
const slug = entry.target.dataset.kfMultistreamTile;
if (!slug) continue;
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
function refreshMultistreamPlayback() {
const grid = state.shadow?.querySelector('[data-kf-multistream-grid]');
if (grid) applyMultistreamAudio(grid);
}
function multistreamOpen() {
const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
return Boolean(backdrop && !backdrop.hidden);
}
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
frame.src = multistreamTileActive(state.multistream, slug, state.multistreamSuspended)
? playerEmbedUrl(slug, { muted: true, autoplay: true })
: 'about:blank';
        frame.title = `${slug} stream`;
frame.allow = 'autoplay; fullscreen; picture-in-picture';
frame.referrerPolicy = 'origin';
frame.loading = 'eager';
tile.append(frame);
const bar = document.createElement('div');
bar.className = 'kf-ms-bar';
        setMarkup(bar, `
        <button type="button" class="kf-ms-name" data-action="multistream-focus" data-slug="${escapeHtml(slug)}" title="Give this stream the audio and chat">${escapeHtml(slug)}</button>
        <span class="kf-ms-spacer"></span>
        <a class="kf-ms-link" href="/${encodeURIComponent(slug)}" target="_blank" rel="noopener" title="${escapeHtml(trf('Open {name} on Kick', { name: slug }))}">Open</a>
        <button type="button" data-action="multistream-remove" data-slug="${escapeHtml(slug)}" aria-label="${escapeHtml(trf('Remove {name} from the grid', { name: slug }))}">Remove</button>`);
tile.append(bar);
}
tile.dataset.kfMultistreamFocused = String(slug === focus);
ordered.push(tile);
}
for (const stale of existing.values()) stale.remove();
if (ordered.length) {
grid.querySelector('[data-kf-multistream-empty]')?.remove();
for (const tile of ordered) grid.append(tile);
} else if (!grid.querySelector('[data-kf-multistream-empty]')) {
      setMarkup(grid, `<div class="kf-ms-empty-state" data-kf-multistream-empty>
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAkElEQVR42u2XSwqAMAxEZ18P4L28/00E3QmKVPOfioHs2sxb5AtcrLVpi3T0LFq8C5ElfguRLX6CqBI/IIYDWNa562EAT8JaEESISyAgFfd+D89gmn+vASzJqgKwiEtiqAGs5WcC8OoBP8C4AOVJmFKG5Y2IohWXDyOKcUyxkFCsZN/dissPE4rTjOI4rTrPd9CSNAqXgFAlAAAAAElFTkSuQmCC" alt="">
        <span>Multi-stream workspace</span>
        <h2>Build your viewing board</h2>
        <p>Add a channel above to start. Focus decides which stream owns audio and chat, and your saved boards stay on this device.</p>
        <button type="button" class="kf-button kf-button-primary" data-action="multistream-focus-input">Add your first channel</button>
      </div>`);
}
renderMultistreamChat(backdrop, chat, showChat);
renderMergedChat(backdrop);
syncChatWindow();
renderMultistreamControls(backdrop);
applyMultistreamAudio(grid);
observeMultistreamVisibility(grid);
}
function applyMultistreamAudio(grid) {
for (const tile of grid.querySelectorAll('[data-kf-multistream-tile]')) {
const slug = tile.dataset.kfMultistreamTile;
const frame = tile.querySelector('iframe');
if (!frame) continue;
const wanted = multistreamTileActive(state.multistream, slug, state.multistreamSuspended)
? playerEmbedUrl(slug, { muted: multistreamTileMuted(state.multistream, slug), autoplay: true })
: 'about:blank';
if (frame.getAttribute('src') !== wanted) frame.setAttribute('src', wanted);
tile.dataset.kfMultistreamSuspended = String(!multistreamTileActive(state.multistream, slug, state.multistreamSuspended)
&& !state.multistream.paused);
}
}
let chatWindow = null;
function canPopOutChat() {
return typeof window !== 'undefined'
&& typeof window.documentPictureInPicture === 'object'
&& window.documentPictureInPicture !== null
&& typeof window.documentPictureInPicture.requestWindow === 'function';
}
function chatPoppedOut() {
return Boolean(chatWindow && !chatWindow.closed);
}
  const POPOUT_CSS = `
    :root { color-scheme: dark; }
    body { margin: 0; display: flex; flex-direction: column; height: 100vh; background: var(--kf-panel, #0d100e); color: var(--kf-text, #f7f9fa);
      font: 12px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
    p { margin: 0; padding: 6px 8px; background: var(--kf-panel-raised, #151917); border-bottom: 1px solid var(--kf-border, #2a312c); color: var(--kf-text-muted, #a5aea8); font-size: 11px; }
    iframe { flex: 1 1 auto; width: 100%; border: 0; }
  `;
const POPOUT_TOKENS = ['--kf-panel', '--kf-panel-raised', '--kf-border', '--kf-text', '--kf-text-muted'];
function copyThemeTokens(doc) {
try {
const computed = getComputedStyle(document.documentElement);
for (const token of POPOUT_TOKENS) {
const value = computed.getPropertyValue(token).trim();
if (value) doc.documentElement.style.setProperty(token, value);
}
} catch {   }
}
function fillChatWindow(pip, slug) {
const doc = pip.document;
    doc.title = `${slug} chat`;
doc.documentElement.lang = document.documentElement.lang || 'en';
copyThemeTokens(doc);
const style = doc.createElement('style');
style.textContent = POPOUT_CSS;
doc.head.append(style);
const notice = doc.createElement('p');
notice.textContent = tr('Read-only here. Kick blocks sending from an embedded chat; open the channel to talk.');
doc.body.append(notice);
const frame = doc.createElement('iframe');
frame.src = chatEmbedUrl(slug);
frame.dataset.slug = slug;
    frame.title = `${slug} chat`;
frame.referrerPolicy = 'origin';
doc.body.append(frame);
}
function syncChatWindow() {
if (!chatPoppedOut()) return;
const slug = state.multistream.chat;
if (!slug) {
closeChatWindow();
return;
}
const frame = chatWindow.document.querySelector('iframe');
if (!frame) {
fillChatWindow(chatWindow, slug);
return;
}
if (frame.dataset.slug === slug) return;
frame.dataset.slug = slug;
frame.src = chatEmbedUrl(slug);
    frame.title = `${slug} chat`;
    chatWindow.document.title = `${slug} chat`;
}
function closeChatWindow() {
const pip = chatWindow;
chatWindow = null;
try {
if (pip && !pip.closed) pip.close();
} catch {
}
renderMultistream();
}
async function popOutChat() {
if (!canPopOutChat() || !multistreamOpen()) return false;
if (chatPoppedOut()) {
closeChatWindow();
return true;
}
const slug = state.multistream.chat;
if (!slug) return false;
let pip;
try {
pip = await window.documentPictureInPicture.requestWindow({ width: 420, height: 620 });
} catch {
showToast(tr('Kick Focus could not open the pop-out chat window.'), true);
return false;
}
chatWindow = pip;
fillChatWindow(pip, slug);
pip.addEventListener('pagehide', () => {
chatWindow = null;
renderMultistream();
}, { once: true });
renderMultistream();
announce(trf('Chat for {channel} opened in a floating window', { channel: slug }));
return true;
}
let mergedTimer = 0;
let mergedPainted = 0;
function mergedChatOn() {
return Boolean(state.multistream.mergedChat) && multistreamOpen();
}
function stopMergedChatPaint() {
if (!mergedTimer) return;
clearInterval(mergedTimer);
mergedTimer = 0;
}
function paintMergedChat(backdrop) {
const list = backdrop?.querySelector?.('[data-kf-multistream-merged-list]');
if (!list) return;
const statusNode = backdrop.querySelector?.('[data-kf-multistream-merged-status]');
const status = mergedChatStatus();
if (statusNode) statusNode.textContent = trf('{live} of {total} chats live', status);
const entries = mergedChatEntries();
if (entries.length === mergedPainted) return;
mergedPainted = entries.length;
    setMarkup(list, entries.map((entry) => `
      <li class="kf-ms-merged-row">
        <span class="kf-ms-merged-source">${escapeHtml(entry.slug)}</span>
        <span class="kf-ms-merged-who"${entry.color ? ` style="color:${escapeHtml(entry.color)}"` : ''}>${escapeHtml(entry.sender)}</span>
        <span class="kf-ms-merged-text">${escapeHtml(entry.text)}</span>
      </li>`).join(''));
list.scrollTop = list.scrollHeight;
}
function renderMergedChat(backdrop) {
const pane = backdrop?.querySelector?.('[data-kf-multistream-merged]');
if (!pane) return;
const on = mergedChatOn();
backdrop.dataset.kfMultistreamMergedOn = String(on);
pane.hidden = !on;
if (!on) {
stopMergedChatPaint();
closeMergedChat();
mergedPainted = 0;
return;
}
syncMergedChat(state.multistream.streams);
mergedPainted = -1;
paintMergedChat(backdrop);
if (!mergedTimer) {
mergedTimer = setInterval(() => {
const open = backdrop.isConnected !== false && mergedChatOn();
if (!open) {
stopMergedChatPaint();
return;
}
paintMergedChat(backdrop);
}, 250);
}
}
function renderMultistreamChat(backdrop, chat, showChat) {
const host_ = backdrop.querySelector('[data-kf-multistream-chat]');
if (!host_) return;
if (!showChat || !chat) {
host_.replaceChildren();
return;
}
backdrop.dataset.kfMultistreamChatPoppedOut = String(chatPoppedOut());
const current = host_.querySelector('iframe');
if (current?.dataset.slug === chat) return;
host_.replaceChildren();
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
count.textContent = streams.length
? trf('{count} of {max} streams', { count: streams.length, max: MULTISTREAM_MAX })
: tr('Ready for your first channel');
}
const error = backdrop.querySelector('[data-kf-multistream-error]');
if (error) {
error.textContent = state.multistreamError;
error.hidden = !state.multistreamError;
}
const chatSelect = backdrop.querySelector('[data-kf-multistream-chat-select]');
if (chatSelect) {
      setMarkup(chatSelect, streams.map((slug) => `<option value="${escapeHtml(slug)}"${slug === chat ? ' selected' : ''}>${escapeHtml(slug)}</option>`).join(''));
chatSelect.disabled = !streams.length;
}
const pauseToggle = backdrop.querySelector('[data-kf-multistream-pause]');
if (pauseToggle) {
pauseToggle.setAttribute('aria-pressed', String(state.multistream.paused));
pauseToggle.textContent = tr(state.multistream.paused ? 'Play all' : 'Pause all');
pauseToggle.disabled = !streams.length;
}
const muteToggle = backdrop.querySelector('[data-kf-multistream-mute]');
if (muteToggle) {
muteToggle.setAttribute('aria-pressed', String(state.multistream.muted));
muteToggle.textContent = tr(state.multistream.muted ? 'Unmute' : 'Mute all');
muteToggle.disabled = !streams.length || state.multistream.paused;
}
const merged = backdrop.querySelector('[data-action="multistream-toggle-merged"]');
if (merged) {
const on = Boolean(state.multistream.mergedChat);
merged.setAttribute('aria-pressed', String(on));
merged.textContent = on ? tr('One chat per tile') : tr('Merge all chats');
merged.disabled = streams.length < 2;
}
const popout = backdrop.querySelector('[data-kf-multistream-popout]');
if (popout) {
const offered = canPopOutChat() && Boolean(chat) && showChat;
popout.hidden = !offered;
const out = chatPoppedOut();
popout.setAttribute('aria-pressed', String(out));
popout.textContent = out ? tr('Return chat') : tr('Pop out chat');
}
const chatToggle = backdrop.querySelector('[data-action="multistream-toggle-chat"]');
if (chatToggle) {
chatToggle.setAttribute('aria-pressed', String(showChat));
chatToggle.textContent = showChat ? 'Hide chat' : 'Show chat';
}
const savedList = backdrop.querySelector('[data-kf-multistream-layouts]');
if (savedList) {
setMarkup(savedList, layouts.length
? layouts.map((layout) => {
const live = layout.streams.filter((slug) => state.multistreamLive.get(slug.toLowerCase())).length;
const status = state.multistreamLive.size
            ? `<small class="kf-ms-live" data-live="${live > 0}">${live}/${layout.streams.length} live</small>`
            : `<small>${layout.streams.length}</small>`;
          return `<span class="kf-ms-layout"><button type="button" data-action="multistream-load" data-layout="${escapeHtml(layout.name)}" title="${escapeHtml(layout.streams.join(', '))}">${escapeHtml(layout.name)} ${status}</button><button type="button" data-action="multistream-copy-layout" data-layout="${escapeHtml(layout.name)}" aria-label="${escapeHtml(trf('Copy a link to board {name}', { name: layout.name }))}">Copy</button><button type="button" data-action="multistream-delete-layout" data-layout="${escapeHtml(layout.name)}" aria-label="${escapeHtml(trf('Delete board {name}', { name: layout.name }))}">Remove</button></span>`;
}).join('')
: '<span class="kf-ms-empty">Saved boards will appear here.</span>');
}
}
async function refreshMultistreamLive() {
const slugs = [...new Set([
...state.multistream.streams,
...state.multistream.layouts.flatMap((layout) => layout.streams),
].map((slug) => slug.toLowerCase()))];
if (!slugs.length) return;
const ids = slugs.map((slug) => state.multistreamIds.get(slug)).filter(Boolean);
if (!ids.length) return;
const response = await kickFetchJson(endpoints.currentViewers(ids));
if (!response.ok) return;
const status = normalizeCurrentViewers(response.body);
if (!status.ok) {
recordApiDrift('current-viewers', status.reason);
return;
}
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
commitMultistream([slug]);
syncHeaderMultiState();
announce(trf('{name} added to the multi-stream grid', { name: slug }));
}
renderMultistream();
}
function toggleCurrentChannelInMulti() {
const slug = currentChannelSlug();
if (!slug) return;
const inGrid = state.multistream.streams.some((entry) => entry.toLowerCase() === slug.toLowerCase());
if (inGrid) {
const result = commitMultistream([], [slug]);
syncHeaderMultiState();
renderMultistream();
showToast(trf('Removed {name} from the grid ({count} of {max})', { name: slug, count: result.streams.length, max: MULTISTREAM_MAX }), false, [
{ label: 'Undo', onClick: () => { commitMultistream([slug]); syncHeaderMultiState(); renderMultistream(); } },
]);
announce(trf('Removed {name}. Now {count} of {max}.', { name: slug, count: result.streams.length, max: MULTISTREAM_MAX }));
return;
}
if (state.multistream.streams.length >= MULTISTREAM_MAX) {
showToast(trf('The grid is full at {max} of {max}.', { max: MULTISTREAM_MAX }), true);
announce(trf('The grid is full at {max} channels.', { max: MULTISTREAM_MAX }));
return;
}
const result = commitMultistream([slug]);
syncHeaderMultiState();
renderMultistream();
showToast(trf('Added {name} to the grid ({count} of {max})', { name: slug, count: result.streams.length, max: MULTISTREAM_MAX }), false, [
{ label: 'View', onClick: () => openMultistream() },
{ label: 'Undo', onClick: () => { commitMultistream([], [slug]); syncHeaderMultiState(); renderMultistream(); announce(trf('Removed {name} from the grid.', { name: slug })); } },
]);
announce(trf('Added {name}. Now {count} of {max}.', { name: slug, count: result.streams.length, max: MULTISTREAM_MAX }));
}
return {
addMultistream,
canPopOutChat,
mergedChatOn,
renderMergedChat,
chatPoppedOut,
closeChatWindow,
popOutChat,
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

function createSettings(host) {
const {
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
} = host;
const NAV_ITEMS = [
['layout', 'Layout', 'Shell, player, and chat', 'layout'],
['appearance', 'Appearance', 'Theme, color, and scale', 'sliders'],
['content', 'Content & Ads', 'Privacy, filters, and playback', 'shield'],
['emotes', 'Emotes', 'Library, favorites, and groups', 'smile'],
['accessibility', 'Accessibility & Shortcuts', 'Comfort and shortcuts', 'keyboard'],
['viewer', 'Viewer', 'Read-only account signals', 'user'],
['about', 'About', 'Status, privacy, and diagnostics', 'info'],
];
const FEATHER_ICONS = Object.freeze({
layout: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="9" y1="9" x2="21" y2="9"></line>',
sliders: '<line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>',
shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
smile: '<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line>',
keyboard: '<rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="6" y1="8" x2="6" y2="8"></line><line x1="10" y1="8" x2="10" y2="8"></line><line x1="14" y1="8" x2="14" y2="8"></line><line x1="18" y1="8" x2="18" y2="8"></line><line x1="6" y1="12" x2="6" y2="12"></line><line x1="10" y1="12" x2="10" y2="12"></line><line x1="14" y1="12" x2="14" y2="12"></line><line x1="18" y1="12" x2="18" y2="12"></line><line x1="7" y1="16" x2="17" y2="16"></line>',
info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
close: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
reset: '<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-9.5L1 10"></path>',
export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>',
check: '<polyline points="20 6 9 17 4 12"></polyline>',
stats: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
trash: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path>',
folder: '<path d="M3 5h6l2 2h10v12H3z"></path>',
edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"></path>',
plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
});
function uiIcon(name) {
    return `<svg class="kf-icon" aria-hidden="true" viewBox="0 0 24 24">${FEATHER_ICONS[name] || FEATHER_ICONS.info}</svg>`;
}
function selected(value, expected) {
return String(value) === String(expected);
}
const ROW_LABEL = '__KF_ROW_LABEL__';
function segmented(path, current, choices) {
    return `<div class="kf-segmented" role="group" aria-label="${ROW_LABEL}">${choices.map(([value, choiceLabel]) => `<button type="button" data-set="${path}" data-value="${escapeHtml(value)}" aria-pressed="${selected(current, value)}">${escapeHtml(choiceLabel)}</button>`).join('')}</div>`;
}
function toggle(path, current, options = {}) {
const disabled = options.locked ? ' disabled' : '';
const title = options.locked ? ' title="Core protection always stays on"' : '';
const label = options.label ? escapeHtml(options.label) : ROW_LABEL;
    return `<button type="button" class="kf-switch" role="switch" data-set="${path}" data-value="${!current}" aria-checked="${current}" aria-label="${label}"${title}${disabled}>${tr(current ? 'On' : 'Off')}</button>`;
}
function row(title, description, control, options = {}) {
const named = String(control).replaceAll(ROW_LABEL, escapeHtml(title));
    return `<div class="kf-row${options.wide ? ' kf-row-wide' : ''}"><div><h3>${title}${options.locked ? '<span class="kf-lock">Core protection</span>' : ''}</h3><p>${description}</p></div><div class="kf-control">${named}</div></div>`;
}
function range(path, current, minimum, maximum, left, right, suffix = '') {
    const valueText = `${current}${suffix}`;
    return `<div class="kf-range"><span>${escapeHtml(left)}</span><div class="kf-range-wrap"><output data-output-for="${path}">${escapeHtml(current)}${escapeHtml(suffix)}</output><input type="range" min="${minimum}" max="${maximum}" value="${current}" data-set="${path}" data-kf-range-suffix="${escapeHtml(suffix)}" aria-label="${ROW_LABEL}" aria-valuetext="${escapeHtml(valueText)}"></div><span>${escapeHtml(right)}</span></div>`;
}
function selectControl(path, current, choices, label) {
    return `<select class="kf-select" data-set="${escapeHtml(path)}" aria-label="${escapeHtml(label)}">${choices.map(([value, optionLabel]) => `<option value="${escapeHtml(value)}"${selected(current, value) ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`).join('')}</select>`;
}
function hideElementGrid(hidden) {
    return `<div class="kf-hide-grid">${HIDEABLE_GROUPS.map((group) => `<div class="kf-hide-group"><span class="kf-hide-heading">${escapeHtml(tr(group.label))}</span><div class="kf-hide-chips" role="group" aria-label="${escapeHtml(tr(group.label))}">${HIDEABLE_ELEMENTS
.filter((entry) => entry.group === group.id)
      .map((entry) => `<button type="button" class="kf-hide-chip" data-action="toggle-hidden-element" data-element="${escapeHtml(entry.id)}" aria-pressed="${hidden.includes(entry.id)}">${escapeHtml(tr(entry.label))}</button>`)
      .join('')}</div></div>`).join('')}</div>`;
}
function pageHeader(title, description, metaLabel, metaValue) {
    return `<div class="kf-page-header"><div><span class="kf-eyebrow">Kick Focus settings</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><div class="kf-page-meta"><span>${escapeHtml(metaLabel)}</span><strong>${escapeHtml(metaValue)}</strong></div></div>`;
}
function renderDiscoveryLayouts() {
const layouts = state.discoveryLayouts;
    const routeChips = DISCOVERY_LAYOUT_ROUTES.map((route) => `<button type="button" class="kf-chip" data-kf-layout-route="${route}" aria-pressed="false">${escapeHtml(tr(DISCOVERY_ROUTE_LABELS[route]))}</button>`).join('');
const saved = layouts.length
? layouts.map((layout) => {
const active = layoutMatchesSettings(layout, state.settings);
        return `<div class="kf-layout-entry" data-active="${active}">
          <div><strong data-kf-no-translate>${escapeHtml(layout.name)}</strong><span>${layout.routes.length
? escapeHtml(layout.routes.map((route) => tr(DISCOVERY_ROUTE_LABELS[route])).join(' · '))
            : escapeHtml(tr('Applied only when you press it'))}${active ? ` · ${escapeHtml(tr('Currently applied'))}` : ''}</span></div>
          <div class="kf-button-group">
            <button type="button" class="kf-button kf-button-small" data-action="apply-layout" data-kf-layout="${escapeHtml(layout.name)}">Apply</button>
            <button type="button" class="kf-button kf-button-small kf-danger" data-action="delete-layout" data-kf-layout="${escapeHtml(layout.name)}" aria-label="Delete this saved view">✕</button>
          </div>
        </div>`;
}).join('')
      : `<p class="kf-status-note">No saved views yet. Set the page up the way you want it, name it, and save.</p>`;
    return `<section class="kf-subsection">
      <div class="kf-panel">
        <div class="kf-action-row"><div><h3>Saved views</h3><p>Keep the density, thumbnail size, rails, and content filters you like as a named view, and have it applied when you open the pages you chose. It is your own settings, applied to what Kick already sent. It changes nothing about what Kick recommends or the order anything appears in.</p></div></div>
        <div class="kf-row kf-row-wide">
          <div><h3>Save this page as a view</h3><p>Pick the pages it should apply to, or none to keep it manual.</p></div>
          <div class="kf-layout-save">
            <input class="kf-text" type="text" data-kf-layout-name maxlength="40" placeholder="Name this view" aria-label="Name this view">
            <div class="kf-chip-row">${routeChips}</div>
            <button type="button" class="kf-button" data-action="save-layout">Save this view</button>
          </div>
        </div>
        <div class="kf-layout-list">${saved}</div>
      </div>
    </section>`;
}
function renderLayoutPage() {
const value = state.settings.layout;
    return `
      ${pageHeader('Layout', 'Control how Kick is arranged across your desktop.', 'Current setup', `${value.sidebar} sidebar · ${value.chat} chat`)}
      <section class="kf-panel">
        ${row('Sidebar mode', 'Choose how the left discovery rail behaves. Dropdown collapses it to a tab that expands on hover, giving the grid full width. Desktop widths only.', segmented('layout.sidebar', value.sidebar, [['auto','Auto'],['compact','Compact'],['dropdown','Dropdown'],['hidden','Hidden']]))}
        ${row('Chat layout', 'Place chat on either side, float it as a dock, or hide it.', segmented('layout.chat', value.chat, [['right','Right'],['left','Left'],['docked','Docked'],['hidden','Hidden']]))}
        ${row('Chat width', 'Set the width of the live chat column.', range('layout.chatWidth', value.chatWidth, 320, 520, '320 px', '520 px', ' px'), { wide: true })}
        ${row('Content density', 'Adjust spacing and padding across discovery pages.', segmented('layout.density', value.density, [['comfortable','Comfortable'],['compact','Compact']]))}
        ${row('Stream start behavior', 'Choose how each channel opens.', segmented('layout.streamStart', value.streamStart, [['standard','Standard'],['theater','Theater'],['focus','Focus']]))}
        ${row('Remember per-channel layout', 'Keep the last runtime layout for each channel.', toggle('layout.rememberPerChannel', value.rememberPerChannel, { label: 'Remember per-channel layout' }))}
        ${row('Widen browse grids', 'Use reclaimed sidebar space for larger, calmer stream cards.', toggle('layout.wideGrid', value.wideGrid, { label: 'Widen browse grids' }))}
        ${row('Show Following rail', 'Keep the Following discovery rail visible when Kick provides it.', toggle('layout.showFollowingRail', value.showFollowingRail, { label: 'Show Following rail' }))}
        ${row('Show Recommended rail', 'Keep recommended stream rows visible in the main content.', toggle('layout.showRecommendedRail', value.showRecommendedRail, { label: 'Show Recommended rail' }))}
        ${row('Hide Kick’s own controls', 'Switch off the player buttons and sidebar entries you never use. Each one is hidden with styling only. Nothing is clicked or removed, and turning it back on restores it immediately.', hideElementGrid(value.hidden), { wide: true })}
        ${row('Sticky compact top bar', 'Keep search and account controls available while browsing.', toggle('layout.stickyTopbar', value.stickyTopbar, { label: 'Sticky compact top bar' }))}
        ${row('Show quick command button', 'Keep the Focus control beside Get KICKs in Kick’s top header.', toggle('layout.quickButton', value.quickButton, { label: 'Show quick command button' }))}
        ${row('Move mini-player clear of controls', 'Raise Kick’s embedded mini-player only when the Focus control has to use its floating fallback.', toggle('layout.miniPlayerCollision', value.miniPlayerCollision, { label: 'Move mini-player clear of controls' }))}
        ${row('Recover player after resize', 'Re-apply player geometry after a window or monitor change.', toggle('layout.playerResizeRecovery', value.playerResizeRecovery, { label: 'Recover player after resize' }))}
        ${row('Keep ultrawide video uncropped', 'Prefer contained video geometry on wide or moved displays.', toggle('layout.playerContainVideo', value.playerContainVideo, { label: 'Keep ultrawide video uncropped' }))}
      </section>
      ${renderDiscoveryLayouts()}`;
}
function renderAppearancePage() {
const value = state.settings.appearance;
const themes = [
['studio', 'Studio', 'Layered graphite', 'Balanced depth with a quiet green undertone.'],
['oled', 'OLED', 'True black', 'Minimal lift and maximum contrast for dark rooms.'],
['slate', 'Slate', 'Cool graphite', 'Blue-toned surfaces with stronger separation.'],
];
const accents = [['kick','Kick Green'],['cyan','Cyan'],['violet','Violet'],['gold','Gold'],['custom','Custom']];
const presets = [
['calm', 'Calm', 'Roomier cards, quieter live color, and a compact rail.'],
['cinema', 'Cinema', 'OLED surfaces with the player first and chrome tucked away.'],
['chat', 'Chat First', 'A wider docked chat, compact density, and a clearer accent.'],
['discovery', 'Discovery', 'More stream cards, vivid thumbnails, and both discovery rails.'],
];
    return `
      <div class="kf-page-header"><div><span class="kf-eyebrow">Kick Focus settings</span><h2>Appearance</h2><p>Choose a clear visual direction, then tune only what matters to you.</p></div><div class="kf-page-meta kf-page-meta-control"><span>Language</span>${selectControl('appearance.language', value.language, [['auto','Auto'],['en','English'],['es','Español'],['pt','Português']], 'Interface language')}</div></div>
      <div class="kf-appearance-layout">
        <section class="kf-panel kf-appearance-controls">
          <div class="kf-row kf-row-wide"><div><h3>Quick directions</h3><p>Apply a viewing setup without changing filters or account choices.</p></div><div class="kf-preset-grid">${presets.map(([id, label, description]) => `<button type="button" class="kf-preset-card" data-action="apply-viewing-preset" data-preset="${id}"><span>Direction</span><strong>${label}</strong><small>${description}</small></button>`).join('')}</div></div>
          <div class="kf-row kf-row-wide"><div><h3>Theme</h3><p>Each theme changes the full surface hierarchy, not just the page background.</p></div><div class="kf-theme-grid">${themes.map(([id, label, tone, description]) => `<button type="button" class="kf-theme-board" data-set="appearance.theme" data-value="${id}" aria-pressed="${selected(value.theme, id)}"><span class="kf-theme-board-top"><span>${tone}</span><span class="kf-theme-selected">${selected(value.theme, id) ? 'Selected' : ''}</span></span><span class="kf-theme-tones" aria-hidden="true"><i></i><i></i><i></i></span><span class="kf-theme-copy"><strong>${label}</strong><small>${description}</small></span></button>`).join('')}</div></div>
          <div class="kf-row kf-row-wide"><div><h3>Accent color</h3><p>Use one accent for focus, selection, and live state.</p></div><div class="kf-swatch-grid">${accents.map(([id,label]) => `<button type="button" class="kf-accent-chip" data-set="appearance.accent" data-value="${id}" aria-pressed="${selected(value.accent,id)}"><span class="kf-swatch" data-color="${id}" aria-hidden="true"></span><strong>${label}</strong></button>`).join('')}</div></div>
          <div class="kf-row kf-row-wide kf-custom-accent-row" data-visible="${selected(value.accent, 'custom')}"><div><h3>Custom accent</h3><p>Low-contrast choices fall back to a safe rose.</p></div><label class="kf-custom-color"><input type="color" data-set="appearance.customAccent" value="${escapeHtml(value.customAccent)}" aria-label="Custom accent color"><span><strong data-kf-no-translate>${escapeHtml(value.customAccent)}</strong><small>Contrast protected</small></span></label></div>
          ${row('Corner radius', 'Adjust the roundness of enhanced UI.', segmented('appearance.radius', value.radius, [['subtle','Subtle'],['balanced','Balanced'],['rounded','Rounded']]))}
          ${row('Thumbnail treatment', 'Adjust stream-card color intensity.', range('appearance.thumbnail', value.thumbnail, 0, 100, 'Natural', 'Vivid', '%'), { wide: true })}
          ${row('Interface scale', 'Set the size of Kick Focus controls.', segmented('appearance.interfaceScale', value.interfaceScale, [[90,'90%'],[100,'100%'],[110,'110%']]))}
          ${row('Dim watched cards', 'Reduce emphasis on streams you have already opened.', toggle('appearance.dimWatched', value.dimWatched, { label: 'Dim watched cards' }))}
          ${row('Strengthen text contrast', 'Increase legibility on muted surfaces.', toggle('appearance.strongContrast', value.strongContrast, { label: 'Strengthen text contrast' }))}
          ${row('Colorize live indicators', 'Use the selected accent for live-state emphasis.', toggle('appearance.colorizeLive', value.colorizeLive, { label: 'Colorize live indicators' }))}
        </section>
        <aside class="kf-preview" aria-label="Live style preview">
          <div><div class="kf-preview-kicker">Live preview</div><p class="kf-preview-intro">Your current theme, accent, scale, and card treatment.</p></div>
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
            <div class="kf-preview-list"><span>Theme</span><strong>${escapeHtml(themes.find(([id]) => id === value.theme)?.[1] || value.theme)} · ${escapeHtml(value.interfaceScale)}%</strong></div>
          </div>
        </aside>
      </div>`;
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
          ${row('Enable subscription', 'Off by default. When enabled, refreshes only over HTTPS with credentials omitted.', toggle('content.blocklistSubscription', value.blocklistSubscription))}
          ${row('HTTPS JSON URL', 'Expected fields: channels, categories, and keywords. Unknown fields are rejected.', `<input class="kf-text" type="url" data-set="content.blocklistUrl" value="${escapeHtml(value.blocklistUrl)}" placeholder="https://example.com/kick-focus-blocklist.json" aria-label="${ROW_LABEL}">`, { wide: true })}
          ${row('Refresh interval', 'Keep the last valid payload if a later request fails.', segmented('content.blocklistRefreshHours', value.blocklistRefreshHours, [[6,'6 h'],[12,'12 h'],[24,'24 h'],[72,'72 h']]))}
        </div>
        <div class="kf-status-note" data-kf-remote-blocklist data-status="${escapeHtml(state.remoteBlocklist.status)}">${escapeHtml(remoteBlocklistSummary())}</div>
      </section>`;
}
function emoteInventorySummary() {
const account = state.live.catalog?.account;
if (!account?.authenticated) return '';
const sets = account.ownedSets.length;
if (!account.ownedEmotes) return tr('Kick reports no emotes this account can send anywhere.');
const from = sets
      ? `${sets} ${plural(sets, 'subscribed channel', 'subscribed channels')}`
: tr('your global sets');
    return `${trf('{count} emotes usable in any chat', { count: account.ownedEmotes })} · ${from}`;
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
function stickerSeenSummary(sticker) {
if (!sticker.firstSeen) return '';
const day = (time) => new Date(time).toISOString().slice(0, 10);
const first = day(sticker.firstSeen);
const last = sticker.lastSeen ? day(sticker.lastSeen) : '';
    return last && last !== first ? `First seen ${first} · last ${last}` : `First seen ${first}`;
}
function stickerLibraryFilterMatches(sticker, filter) {
if (filter === 'mine') return sticker.access === 'available' && sticker.usableEverywhere === true;
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
function stickerLibraryCard(sticker) {
const favorite = isFavorited(sticker.key);
const removed = state.stickerPreferences.hidden.has(sticker.key);
const groupId = state.stickerPreferences.assignments.get(sticker.key) || '';
const chosen = state.runtime.stickerLibrarySelection.has(sticker.key);
const nativeGroups = sticker.nativeGroups.length ? sticker.nativeGroups.join(', ') : 'Unknown Kick group';
    const searchText = `${sticker.name} ${nativeGroups} ${sticker.sourceSlug || ''}`.toLowerCase();
const accessLabel = emoteAccessLabel(sticker.access);
const reach = emoteReach(sticker);
const reachNote = reach.text ? trf(reach.text, { channel: reach.channel }) : '';
const changeNote = describeStickerChange(sticker);
const seenNote = stickerSeenSummary(sticker);
const lock = sticker.access === 'locked'
? emoteLockState({ ...sticker, locked: true }, sticker.nativeGroups[0] || '')
: { locked: false, reason: '', unlockUrl: '' };
    return `<article class="kf-sticker-library-item" data-kf-sticker-library-item data-kf-sticker-key="${escapeHtml(sticker.key)}" data-kf-sticker-search="${escapeHtml(searchText)}" data-removed="${removed}" data-selected="${chosen}" data-changed="${Boolean(changeNote)}">
      <a class="kf-sticker-library-image" href="${escapeHtml(sticker.src)}" target="_blank" rel="noopener" aria-label="${escapeHtml(trf('Open {name} artwork', { name: sticker.name }))}"><img src="${escapeHtml(sticker.src)}" alt="${escapeHtml(sticker.name)}" loading="lazy"></a>
      <div class="kf-sticker-library-copy"><strong data-kf-no-translate title="${escapeHtml(sticker.name)}">${escapeHtml(sticker.name)}</strong><small title="${escapeHtml(nativeGroups)}">${escapeHtml(nativeGroups)}</small>${seenNote ? `<small title="${escapeHtml(seenNote)}">${escapeHtml(seenNote)}</small>` : ''}<span class="kf-sticker-access" data-access="${escapeHtml(sticker.access)}">${accessLabel}</span>${reachNote ? `<span class="kf-sticker-access kf-sticker-reach" data-reach="${sticker.usableEverywhere ? 'anywhere' : 'local'}">${escapeHtml(reachNote)}</span>` : ''}${changeNote ? `<span class="kf-sticker-changed" title="${escapeHtml(changeNote)}">Changed by Kick</span>` : ''}${lock.locked ? `<small class="kf-sticker-lock">${escapeHtml(lock.reason)}${lock.unlockUrl ? ` <a href="${escapeHtml(lock.unlockUrl)}" target="_blank" rel="noopener">Unlock on Kick</a>` : ''}</small>` : ''}</div>
      <div class="kf-sticker-library-actions">
        <button type="button" class="kf-button kf-button-small${chosen ? ' kf-button-primary' : ''}" data-action="select-library-sticker" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-pressed="${chosen}" aria-label="${escapeHtml(trf(chosen ? 'Deselect {name}' : 'Select {name}', { name: sticker.name }))}">${chosen ? 'Selected' : 'Select'}</button>
        <button type="button" class="kf-button kf-button-small" data-action="copy-sticker-name" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-label="${escapeHtml(trf('Copy the name {name}', { name: sticker.name }))}">Copy name</button>
        ${state.settings.content.insertEmoteName ? `<button type="button" class="kf-button kf-button-small" data-action="insert-sticker-name" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-label="${escapeHtml(trf('Type the name {name} into chat', { name: sticker.name }))}">Type in chat</button>` : ''}
        <button type="button" class="kf-button kf-button-small" data-action="favorite-library-sticker" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-pressed="${favorite}" aria-label="${escapeHtml(trf(favorite ? 'Remove favorite {name}' : 'Favorite {name}', { name: sticker.name }))}">${favorite ? '★ Favorite' : '☆ Favorite'}</button>
        <button type="button" class="kf-button kf-button-small${removed ? '' : ' kf-danger'}" data-action="remove-library-sticker" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-label="${escapeHtml(trf(removed ? 'Restore {name}' : 'Remove {name}', { name: sticker.name }))}">${removed ? 'Restore' : 'Remove'}</button>
        <select class="kf-select" data-kf-sticker-assignment="${escapeHtml(sticker.key)}" aria-label="${escapeHtml(trf('Custom group for {name}', { name: sticker.name }))}">${stickerGroupOptions(groupId)}</select>
      </div>
    </article>`;
}
function renderStickerLibraryManager() {
const filter = state.runtime.stickerLibraryFilter;
const ownedGroups = ownedEmoteGroups([...state.stickerPreferences.library.values()]);
const ownedCount = ownedGroups.reduce((total, group) => total + group.entries.length, 0);
const myEmotesLabel = trf('My emotes ({count})', { count: ownedCount });
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
['mine', myEmotesLabel],
      ['favorites', `Favorites (${favoriteCount()})`],
      ['removed', `Removed (${state.stickerPreferences.hidden.size})`],
      ['changed', `Changed by Kick (${countChangedStickers(state.stickerPreferences.library)})`],
['observed', 'Seen in chat'],
['channel', 'Channel-only'],
['locked', 'Subscriber-only'],
['ungrouped', 'Ungrouped'],
      ...state.stickerPreferences.groups.map((group) => [`group:${group.id}`, group.name]),
];
const chosen = state.runtime.stickerLibrarySelection;
for (const key of chosen) if (!state.stickerPreferences.library.has(key)) chosen.delete(key);
const groupRows = state.stickerPreferences.groups.map((group) => {
const count = [...state.stickerPreferences.assignments.values()].filter((groupId) => groupId === group.id).length;
      return `<div class="kf-sticker-group-row">
        <input class="kf-text" value="${escapeHtml(group.name)}" maxlength="60" data-kf-sticker-group-name="${escapeHtml(group.id)}" aria-label="${escapeHtml(trf('Rename {name}', { name: group.name }))}">
        <span>${count}</span><button type="button" class="kf-button kf-button-small kf-danger" data-action="delete-sticker-group" data-kf-sticker-group-id="${escapeHtml(group.id)}" aria-label="${escapeHtml(trf('Delete group {name}', { name: group.name }))}">Delete</button>
      </div>`;
}).join('');
const cards = library.map(stickerLibraryCard).join('');
const myGroups = filter === 'mine' ? ownedEmoteGroups(library) : [];
    const groupedCards = myGroups.map((group) => `<section class="kf-my-emote-group" data-kf-my-emote-group>
      <header><div><span>${group.source ? 'Subscribed channel' : 'Global collection'}</span><h4 data-kf-no-translate>${escapeHtml(group.label)}</h4></div><strong>${group.entries.length} ${plural(group.entries.length, 'emote', 'emotes')}</strong></header>
      <div class="kf-sticker-library-grid">${group.entries.map(stickerLibraryCard).join('')}</div>
    </section>`).join('');
const inventory = emoteInventorySummary();
const accountKnown = Boolean(state.live.catalog?.account?.authenticated);
const myEmotesEmpty = accountKnown
? 'Kick reports no emotes this account can use in every chat.'
: 'Sign in to Kick and open any channel once to load your owned emotes. Nothing is sent or changed.';
const disabled = chosen.size ? '' : ' disabled';
    return `<section class="kf-emote-manager" data-kf-sticker-library>
      <div class="kf-subsection-header"><div><h3>${filter === 'mine' ? 'My emotes' : 'Library'}</h3><p data-kf-sticker-library-summary>${escapeHtml(stickerLibrarySummary())}</p>${inventory ? `<p class="kf-meta" data-kf-emote-inventory data-kf-no-translate>${escapeHtml(inventory)}</p>` : ''}</div><div class="kf-button-group"><button type="button" class="kf-button kf-button-small${filter === 'mine' ? ' kf-button-primary' : ''}" data-action="show-my-emotes" aria-pressed="${filter === 'mine'}">${escapeHtml(myEmotesLabel)}</button><button type="button" class="kf-button kf-button-small" data-action="export">Export</button><button type="button" class="kf-button kf-button-small" data-action="clear-sticker-preferences">Reset</button></div></div>
      <div class="kf-emote-catalog-browser"><div><h4>Add emotes from a channel</h4><p>Paste a channel name or Kick URL. Access rules still apply.</p></div><div class="kf-emote-catalog-form"><input class="kf-text" value="${escapeHtml(state.runtime.emoteCatalogSlug)}" data-kf-emote-catalog-input placeholder="Channel name or kick.com URL" aria-label="Channel emote catalog"><button type="button" class="kf-button kf-button-primary" data-action="import-channel-emotes"${state.runtime.emoteCatalogLoading ? ' disabled' : ''}>${state.runtime.emoteCatalogLoading ? 'Loading…' : 'Add emotes'}</button></div><p class="kf-emote-catalog-status" data-kf-emote-catalog-status data-error="${state.runtime.emoteCatalogError}"${state.runtime.emoteCatalogStatus ? '' : ' hidden'}>${escapeHtml(state.runtime.emoteCatalogStatus)}</p></div>
      <div class="kf-sticker-library-workspace">
        <aside class="kf-sticker-group-panel" aria-label="Custom emote groups"><div class="kf-sticker-group-heading"><h4>Groups</h4><span data-kf-no-translate>${state.stickerPreferences.groups.length}/${STICKER_GROUP_LIMIT}</span></div><p>Create a group, then select emotes and move them together.</p><div class="kf-sticker-group-builder"><input class="kf-text" maxlength="60" data-kf-new-sticker-group placeholder="Group name" aria-label="New emote group name"><button type="button" class="kf-button kf-button-primary" data-action="create-sticker-group">Create group</button></div>${groupRows ? `<div class="kf-sticker-group-list">${groupRows}</div>` : '<div class="kf-sticker-group-empty">No groups yet.</div>'}</aside>
        <div class="kf-sticker-library-main">
          <div class="kf-sticker-library-controls"><input class="kf-text" type="search" value="${escapeHtml(state.runtime.stickerLibraryQuery)}" data-kf-sticker-library-search placeholder="Search emotes or Kick groups" aria-label="Search recorded emotes"><select class="kf-select" data-kf-sticker-library-filter aria-label="Filter recorded emotes">${filters.map(([value, label]) => `<option value="${escapeHtml(value)}"${selected(filter, value) ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div>
          <div class="kf-sticker-library-bulk" aria-live="polite"><strong>${chosen.size} selected</strong><button type="button" class="kf-button kf-button-small" data-action="select-visible-stickers">Select shown</button><button type="button" class="kf-button kf-button-small" data-action="clear-library-selection"${disabled}>Clear</button><select class="kf-select" data-kf-sticker-bulk-group aria-label="Group for selected emotes"${disabled}>${stickerGroupOptions(state.runtime.stickerLibraryBulkGroup)}</select><button type="button" class="kf-button kf-button-small kf-button-primary" data-action="move-selected-stickers"${disabled}>Move</button><button type="button" class="kf-button kf-button-small kf-danger" data-action="remove-selected-stickers"${disabled}>Remove</button></div>
          <div class="kf-sticker-library-meta"><span data-kf-sticker-library-visible>${library.length} shown</span><span>New emotes save automatically.</span></div>
          ${filter === 'mine' ? (groupedCards || `<div class="kf-notice">${myEmotesEmpty}</div>`) : filter === 'removed' ? `<div class="kf-notice">${state.stickerPreferences.hidden.size} removed. These emotes can return after you restore them and Kick shows them again.${state.stickerPreferences.hidden.size ? ' <button type="button" class="kf-button kf-button-small" data-action="restore-removed-stickers">Restore all</button>' : ''}</div>` : cards ? `<div class="kf-sticker-library-grid">${cards}</div>` : `<div class="kf-notice">${state.stickerPreferences.library.size ? 'No emotes match this view.' : 'Open Kick’s emote picker or watch chat to start the library.'}</div>`}
        </div>
      </div>
    </section>`;
}
function renderEmotesPage() {
    return `${pageHeader('Emotes', 'Find, favorite, remove, and group every emote you have recorded.', 'Library', `${state.stickerPreferences.library.size}/${STICKER_LIBRARY_LIMIT}`)}${renderStickerLibraryManager()}`;
}
function renderCollectiblePanel() {
const inventory = state.live.inventory;
const changed = countChangedStickers(state.stickerPreferences.library);
const observed = inventory
? (inventory.quantityKnown
? trf('Your inventory holds {copies} {copiesWord} across {distinct} distinct {distinctWord}. That is {duplicates} {duplicatesWord}, or {rate}% of what you have pulled.', {
copies: inventory.copies,
copiesWord: plural(inventory.copies, 'collectible', 'collectibles'),
distinct: inventory.distinct,
distinctWord: plural(inventory.distinct, 'item', 'items'),
duplicates: inventory.duplicates,
duplicatesWord: plural(inventory.duplicates, 'duplicate', 'duplicates'),
rate: Math.round(inventory.duplicateRate * 100),
})
: trf('Your inventory holds {distinct} distinct {distinctWord}. Kick’s response carries no per-item quantity, so a duplicate rate cannot be measured from it. That number is unavailable rather than zero.', {
distinct: inventory.distinct,
distinctWord: plural(inventory.distinct, 'collectible', 'collectibles'),
}))
: 'Open a channel with collectibles while signed in to read your own inventory. Nothing is fetched otherwise.';
    return `
      <div class="kf-panel">
        <div class="kf-action-row"><div><h3>What Kick does not explain</h3><p>${escapeHtml(observed)}${changed ? ` ${changed} ${plural(changed, 'recorded emote has been changed by Kick since first capture. See the Changed by Kick filter in the library below.', 'recorded emotes have been changed by Kick since first capture. See the Changed by Kick filter in the library below.')}` : ''}</p></div></div>
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
        ${rarity ? `<div class="kf-panel"><div class="kf-action-row"><div><h3>Collectible rarity</h3><p>Resolved ${rarity.matched.length} of ${rarity.total} collectible emotes. ${rarity.unmatched.length ? `${rarity.unmatched.length} could not be matched confidently and are shown without a rarity. A wrong label is worse than none.` : 'Every collectible in this channel was matched.'}</p></div></div></div>` : ''}
        ${collisions.length ? `<div class="kf-panel"><div class="kf-action-row"><div class="kf-shadow-warning"><h3>Shadowed emote names</h3><p>These names exist in more than one of your sets. Kick sends the last one loaded, so typing the name may not send what you expect.</p>${collisions.slice(0, 12).map((collision) => `<p><code>${escapeHtml(collision.name)}</code> sends <strong>${escapeHtml(collision.winner.setName)}</strong>, shadowing ${escapeHtml(collision.shadowed.map((entry) => entry.setName).join(', '))}</p>`).join('')}${collisions.length > 12 ? `<p>…and ${collisions.length - 12} more.</p>` : ''}</div></div></div>` : ''}
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
          ${row('Block separable ad requests', 'Intercept known ad hosts at the earliest userscript-supported page layer.', toggle('content.blockAds', true, { locked: true }), { locked: true })}
          ${row('Remove ad containers', 'Remove empty ad containers and reinjected ad frames.', toggle('content.removeAdContainers', value.removeAdContainers, { label: 'Remove ad containers' }))}
          ${row('Suppress sponsored and promoted cards', 'Hide clearly labeled promotional cards and modules.', toggle('content.suppressPromoted', value.suppressPromoted))}
          ${row('Pause home-page autoplay', 'Keep background Home previews silent and paused; deliberate playback remains available.', toggle('content.pauseHomeAutoplay', value.pauseHomeAutoplay, { label: 'Pause home-page autoplay' }))}
          ${row('Hide Slots & Casino content', 'Hide cards and sidebar entries clearly labeled as casino content.', toggle('content.hideCasino', value.hideCasino))}
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
        ${value.hiddenChannels.length ? `<div class="kf-channel-list" data-kf-hidden-channel-list>${value.hiddenChannels.map((channel) => `<div class="kf-channel-entry"><span>${escapeHtml(channel.replace(/^\//, ''))}</span><button type="button" class="kf-button kf-button-small kf-danger" data-action="remove-hidden-channel" data-channel="${escapeHtml(channel)}" aria-label="${escapeHtml(trf('Show {name} again', { name: channel.replace(/^\//, '') }))}">✕</button></div>`).join('')}</div>` : '<p class="kf-status-note">No channels hidden. Use the input above or the ✕ action on a card.</p>'}
        <p class="kf-meta">${value.hiddenChannels.length} ${plural(value.hiddenChannels.length, 'channel hidden. These count toward the fail-open ceiling.', 'channels hidden. These count toward the fail-open ceiling.')}</p>
      </div></section>
      <section class="kf-subsection kf-content-section"><div class="kf-subsection-header"><div><h3>Playback & chat</h3><p>Local playback memory, chat control, emotes, and diagnostics.</p></div></div><div class="kf-panel">
          ${row('Remember volume locally', 'Restore each channel’s volume and mute state from local storage.', toggle('content.rememberVolume', value.rememberVolume, { label: 'Remember volume locally' }))}
          ${row('Remember quality locally', 'Restore a matching quality control when Kick exposes one.', toggle('content.rememberQuality', value.rememberQuality, { label: 'Remember quality locally' }))}
          ${row('Always start at the highest quality', 'Open every stream at the best rung Kick offers, taking precedence over remembered quality. The rungs are learned from Kick’s own quality menu, so this does nothing until that menu has been opened once. It will not open it for you.', toggle('content.preferBestQuality', value.preferBestQuality, { label: 'Always start at the highest quality' }))}
          ${row('Remember VOD position locally', 'Resume finite VODs from the last local playback position.', toggle('content.rememberVodPosition', value.rememberVodPosition, { label: 'Remember VOD position locally' }))}
          ${row('Show how long the stream has been live', 'Kick sends the start time with every channel and shows it nowhere. This reads that field and counts from it in the player corner, with no extra request and no polling.', toggle('content.showUptime', value.showUptime))}
          ${row('Show how long Kick keeps this recording', 'Kick deletes recordings after 7 days, or 30 for a verified channel, and shows that deadline nowhere. On a VOD page this reads the recording date from Kick’s own video list and counts down to it. It says nothing at all when the recording is older than the list Kick returns, or when the tier cannot be established. A guess between 7 and 30 days would be a confident wrong date.', toggle('content.showVodExpiry', value.showVodExpiry))}
          ${row('Pause chat updates', 'Scrolling the transcript up freezes it, as does the button. Resume is always one control away.', toggle('content.stickyChatPause', value.stickyChatPause, { label: 'Pause chat updates' }))}
          ${row('Show message times', 'Reveals the timestamp Kick already renders on every message and keeps hidden. It is Kick’s own value, so scrolling back shows when a message was sent rather than when this build first saw it.', toggle('content.chatTimestamps', value.chatTimestamps, { label: 'Show message times' }))}
          ${row('People worth noticing', 'Names you want to catch in a fast chat. Their messages get a marker of their own, separate from keyword highlights. Comma separated, and stored only in your settings.', `<input class="kf-text" type="text" data-set="content.chatPriorityPeople" value="${escapeHtml((value.chatPriorityPeople || []).join(', '))}" placeholder="name, name" aria-label="People worth noticing">`)}
          ${row('Sound on a mention', 'A short tone when a message matches your highlights, comes from someone you listed, or says your name. Synthesised in the browser, so nothing is downloaded. Silent while the tab is in the background, silent for your own messages, and never more than once every few seconds.', toggle('content.chatMentionSound', value.chatMentionSound, { label: 'Sound on a mention' }))}
          ${row('Hide a message for yourself', 'Adds a small dismiss control to each message. It hides that message in your own browser for this session only, changes nothing for anyone else, and offers an undo.', toggle('content.chatHideMessages', value.chatHideMessages, { label: 'Hide a message for yourself' }))}
          ${row('Recall my sent messages', 'Keep the last five messages sent from this tab in memory. Shift+Up cycles them. Whispers are skipped, reload clears them, and ordinary Arrow Up stays with Kick.', toggle('content.chatComposerRecall', value.chatComposerRecall, { label: 'Recall my sent messages' }))}
          ${row('Search this session’s chat', 'Keeps what this tab has seen so you can find it again. It stays in memory, never reaches storage, and is gone on reload. Whispers are never recorded, and a message a moderator removes leaves the log the moment the deletion arrives.', toggle('content.chatHistory', value.chatHistory, { label: 'Search this session’s chat' }))}
          ${value.chatHistory ? `<div class="kf-row kf-row-wide" data-kf-chat-history>
            <div><h3>Session chat log</h3><p>${state.chatComfort.rows.length} ${plural(state.chatComfort.rows.length, 'message held. Capped at 400 messages, 200 KB, and one hour.', 'messages held. Capped at 400 messages, 200 KB, and one hour.')}</p></div>
            <div class="kf-chat-log">
              <input class="kf-text" type="search" data-kf-chat-history-search value="${escapeHtml(state.chatComfort.query)}" placeholder="Search what you have seen" aria-label="Search this session’s chat">
              <div class="kf-button-group"><button type="button" class="kf-button kf-button-small" data-action="export-chat-history">Save as a file</button><button type="button" class="kf-button kf-button-small kf-danger" data-action="clear-chat-history">Clear the log</button></div>
              <div data-kf-chat-history-results></div>
            </div>
          </div>` : ''}
          ${row('Organize chat emotes', 'Continuously record emotes from live chat and Kick’s picker, then add favorites, removals, search, and custom groups.', toggle('content.organizeChatStickers', value.organizeChatStickers, { label: 'Organize chat emotes' }))}
          ${row('Click chat emotes to save', 'Click any emote in chat to add it to your favorites. If Kick explicitly marks it as follow-gated, the same click follows its source channel; subscriber access is never bypassed.', toggle('content.clickChatEmotes', value.clickChatEmotes, { label: 'Click chat emotes to save' }))}
          ${row('Type an emote name into chat', 'Adds a Type in chat action beside Copy name in the emote library. It types the plain name at your cursor and stops. Never the wire token, never an id, and it never sends the message.', toggle('content.insertEmoteName', value.insertEmoteName, { label: 'Type an emote name into chat' }))}
          ${row('Suggest emotes as you type', 'Typing a colon and two or more letters in chat offers matching emotes from your library, ranked by what you actually send here. Click one to put its plain name at your cursor. Suggestions are clicked, never accepted with a key, so nothing you type is ever captured, and it never sends the message.', toggle('content.emoteAutocomplete', value.emoteAutocomplete, { label: 'Suggest emotes as you type' }))}
          ${row('Claim the daily reward automatically', 'Opens Kick’s own reward dialog when one is waiting and clicks its claim button for you. It clicks nothing else: a reward Kick has not unlocked yet shows a disabled button, and this leaves it alone rather than trying. It waits until you are not typing, checks at most every ten minutes, and stops for the day once it claims. Signed-in only, because the reward button does not exist otherwise.', toggle('content.autoClaimRewards', value.autoClaimRewards, { label: 'Claim the daily reward automatically' }))}
          <p class="kf-hint" data-kf-reward-status>${escapeHtml(rewardStatusSummary())}</p>
          ${row('New favorites apply to', 'Global favorites follow you everywhere. Per-channel favorites appear only on the channel you saved them from, above your global ones. Existing favorites are global and are not moved.', segmented('content.favoriteScope', value.favoriteScope, [['global', 'Everywhere'], ['channel', 'This channel']]))}
          ${row('Highlight chat keywords', 'Use the per-channel keyword list below without sending it anywhere.', toggle('content.chatHighlights', value.chatHighlights, { label: 'Highlight chat keywords' }))}
          ${row('Show playback diagnostics', 'Show ready state, buffered seconds, and dropped-frame counts on a channel.', toggle('content.playbackDiagnostics', value.playbackDiagnostics, { label: 'Show playback diagnostics' }))}
          ${row('Start playback without waiting for blocked ad scripts', 'Kick waits on Google PAL, Datazoom, and OM before requesting playback. Blocking them, which this build does, leaves the dead script in the page and the player waits out the full timeout. Removing it lets playback start immediately.', toggle('content.fixPlayerLoading', value.fixPlayerLoading, { label: 'Start playback without waiting for blocked ad scripts' }))}
        </div>
      </section>
      ${renderLiveDataSection(value)}
      <div class="kf-tool-grid">
        <section class="kf-tool-card"><div><h3>Emote library</h3><p data-kf-sticker-library-summary>${escapeHtml(stickerLibrarySummary())}</p></div><button type="button" class="kf-button kf-button-small" data-action="open-emotes">Open library</button></section>
        <section class="kf-tool-card"><div><h3>Local discovery choices</h3><p>Favorites and not-interested choices stay on this device.</p></div><div class="kf-button-group"><button type="button" class="kf-button kf-button-small" data-action="clear-favorites">Clear favorites</button><button type="button" class="kf-button kf-button-small" data-action="clear-dismissed">Clear not-interested</button></div></section>
      </div>
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
          return `<tr class="${conflict ? 'kf-conflict' : ''}"><td>${label}</td><td><span class="kf-shortcut">${capture ? 'Press keys, or Escape to cancel' : escapeHtml(shortcuts[key])}</span></td><td>${conflict ? `<span class="kf-conflict-message">${escapeHtml(state.shortcutError)}</span>` : capture ? 'Listening' : '<span class="kf-active">OK</span>'}</td><td class="kf-table-actions">${conflict ? '<button type="button" class="kf-button kf-button-small" data-action="cancel-shortcut">Cancel</button>' : `<button type="button" class="kf-button kf-button-small" data-shortcut="${key}">${capture ? 'Cancel' : 'Change'}</button>`}</td></tr>`;
        }).join('')}</tbody></table></div>
      </section>`;
}
function renderStorageHealthPanel() {
const report = storageDiagnostics();
const failures = describeStorageFailures(storageHealth.failures);
const failureMessage = failures ? localizedStorageFailure(failures) : '';
const rows = report.breakdown
.filter((entry) => entry.bytes > 0)
      .map((entry) => `<tr><th>${escapeHtml(entry.label)}</th><td data-kf-no-translate>${escapeHtml(formatBytes(entry.bytes))}</td><td>${storageHealth.failures[entry.key] ? '<strong data-error="true">Not saving</strong>' : 'Saved'}</td></tr>`)
.join('');
const seed = describeLibrarySeed(storageHealth.librarySeed);
    return `
      <section class="kf-subsection">
        <div class="kf-panel">
          <div class="kf-action-row"><div><h3>Local storage</h3><p>${failures
            ? `${escapeHtml(failureMessage)}${storageHealth.lastError ? ` ${escapeHtml(tr('The browser reported'))} <strong>${escapeHtml(storageHealth.lastError)}</strong>.` : ''} ${escapeHtml(tr('Exporting now is the only way to keep these changes.'))}`
            : escapeHtml(trf('Kick Focus is using about {size} of browser storage. Nothing has failed to save this session.', { size: formatBytes(report.total) }))}</p>${seed
              ? `<p class="kf-meta">${escapeHtml(trf(seed.messageKey, seed.values))}</p>`
              : ''}</div>${failures ? '<button type="button" class="kf-button kf-button-primary" data-action="export">Export now</button>' : ''}</div>
          ${rows ? `<table class="kf-table"><tbody>${rows}</tbody></table>` : ''}
        </div>
      </section>`;
}
function hubNumber(value) {
return Number(value).toLocaleString();
}
function hubCardValue(card) {
if (card.id === 'reward') return tr(VIEWER_HUB_REWARD_WORDS[card.value] || VIEWER_HUB_REWARD_WORDS.available);
if (card.id === 'watch') return formatSessionWatchTime(card.value);
if (card.id === 'collectibles' && Number.isFinite(card.copies) && card.copies > card.value) {
      return `${hubNumber(card.value)} (${hubNumber(card.copies)})`;
}
return hubNumber(card.value);
}
function hubCardSource(card, now) {
if (card.state !== 'ready') return '';
if (card.source === 'local') return tr('This browser session only');
const source = card.source === 'api' ? tr('From Kick’s API') : tr('Read from the page');
if (!card.stale) return source;
const minutes = Math.max(1, Math.round((now - card.observedAt) / 60_000));
    return `${source} · ${trf('{n} min ago', { n: minutes })}`;
}
function renderViewerHubCards() {
const now = Date.now();
const cards = viewerHubCards(collectViewerFacts(), now);
    return cards.map((card) => `
      <div class="kf-mini-card kf-hub-card" data-kf-hub-card="${card.id}" data-state="${card.state}" data-kf-source="${card.source}">
        <span>${escapeHtml(tr(VIEWER_HUB_TITLES[card.id]))}</span>
        <strong>${card.state === 'ready' ? escapeHtml(hubCardValue(card)) : escapeHtml(tr(card.state === 'loading' ? 'Reading…' : '—'))}</strong>
        <em>${escapeHtml(card.state === 'ready' ? hubCardSource(card, now) : tr(VIEWER_HUB_REASONS[card.reason] || VIEWER_HUB_REASONS['not-read']))}</em>
      </div>`).join('');
}
function renderViewerPage() {
const summary = viewerHubSummary(viewerHubCards(collectViewerFacts(), Date.now()));
    return `
      ${pageHeader('Viewer', 'Account readings and this browser session, in one place. Nothing here is claimed or sent anywhere.', 'Reading', `${summary.ready}/${summary.total}`)}
      <div class="kf-hub-grid" data-kf-hub-cards>${renderViewerHubCards()}</div>
      <section class="kf-panel">
        <div class="kf-action-row"><div><h3>Where these come from</h3><p data-kf-hub-sources>${escapeHtml(hubSourceSummary(summary))}</p></div><button type="button" class="kf-button" data-action="refresh-hub">Read again</button></div>
        <div class="kf-action-row"><div><h3>Nothing is claimed for you here</h3><p>This page reads. The daily reward is still claimed by Kick’s own dialog, and only when you have turned that on under Content &amp; Ads. A card with no reading says so rather than showing a zero, because an empty balance and an unreadable one are not the same thing.</p></div></div>
      </section>`;
}
function hubSourceSummary(summary) {
if (!summary.ready) return 'Nothing has been read yet. Each card above says why.';
const parts = [];
const list = (ids) => new Intl.ListFormat(activeLocale(), { style: 'long', type: 'conjunction' })
.format(ids.map((id) => tr(VIEWER_HUB_TITLES[id])));
if (summary.fromDom.length) parts.push(trf('{items} read from the page', { items: list(summary.fromDom) }));
if (summary.fromApi.length) parts.push(trf('{items} from Kick’s API', { items: list(summary.fromApi) }));
if (summary.fromLocal.length) parts.push(trf('{items} kept in this browser session', { items: list(summary.fromLocal) }));
    const stale = summary.stale ? ` ${trf('{n} showing an older reading.', { n: summary.stale })}` : '';
    const errors = summary.errors ? ` ${trf('{n} could not be built.', { n: summary.errors })}` : '';
    return `${parts.join('; ')}.${stale}${errors}`;
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
        <div class="kf-action-row"><div><h3>If Kick sign-in, sign-up, or Follow stops working</h3><p>Since Kick began serving ads on 2026-08-06, some ad-blocker filter lists have been reported to break those actions, which fail with a generic error until the blocker is disabled and the browser restarted. Kick Focus is not involved: it blocks ${AD_HOSTS.length + TELEMETRY_HOSTS.length} third-party ad and telemetry hosts and <strong>no kick.com host at all</strong>, so pausing Kick Focus will not change that behavior. Check your ad blocker&rsquo;s filters for kick.com before blaming an extension.</p></div></div>
        <div class="kf-action-row"><div><h3>Diagnostics</h3><p>Copy a sanitized summary or run a local self-check.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="copy-diagnostics">Copy diagnostic summary</button><button type="button" class="kf-button" data-action="self-check">Run self-check</button></div></div>
        <div class="kf-action-row"><div><h3>Compatibility self-test</h3><p data-kf-compatibility-detail>${escapeHtml(state.compatibility ? `${compatibilitySummary(state.compatibility)} Probes are checked after every route update.` : 'The shell probes will run after the page mounts.')}</p></div><button type="button" class="kf-button" data-action="self-check">Run now</button></div>
        <div class="kf-action-row"><div><h3>API drift</h3><p data-kf-api-drift>${escapeHtml(assessApiDrift(state.live.apiDrift).summary)}</p></div></div>
        ${state.updateNotice ? `<div class="kf-action-row"><div><h3>What changed in ${escapeHtml(state.updateNotice.to)}</h3><p>${escapeHtml(state.updateNotice.summary || `Updated from ${state.updateNotice.from}.`)}${state.updateNotice.defaults.length ? ` Defaults that moved: ${escapeHtml(state.updateNotice.defaults.join(', '))}.` : ''}</p></div></div>` : ''}
        <div class="kf-action-row"><div><h3>Apply cycle cost</h3><p data-kf-apply-cost data-kf-no-translate>${escapeHtml(tr(applyCostSummary(state.diagnostics.apply)))}</p></div></div>
        <div class="kf-action-row"><div><h3>Settings portability</h3><p>Move preferences, recorded emote metadata, favorites, removals, and custom groups using one local JSON file.</p></div><div class="kf-button-group">${gmGet(PRE_IMPORT_BACKUP_KEY, null) ? `<button type="button" class="kf-button" data-action="undo-import">Undo import</button>` : ''}<button type="button" class="kf-button" data-action="import">Import settings</button><button type="button" class="kf-button" data-action="export">Export settings</button></div></div>
        <div class="kf-action-row"><div><h3>Reset all settings</h3><p>Restore every setting, shortcut, note, filter, and channel list to factory defaults. Your recorded emote library is kept.</p></div><button type="button" class="kf-button kf-danger" data-action="reset-all">Reset all settings</button></div>
      </section>
      ${renderStorageHealthPanel()}
      <section class="kf-subsection"><div class="kf-panel"><table class="kf-table"><tbody><tr><th>Target</th><td>kick.com desktop</td><th>Run timing</th><td>${escapeHtml(INJECTION.summary)}</td></tr><tr><th>Keyboard</th><td>Ctrl+K commands · Alt+K settings</td><th>Test viewports</th><td>1440×900 · 1920×1080</td></tr><tr><th>Version</th><td>${VERSION}</td><th>Remote code</th><td>None</td></tr><tr><th>Userscript size</th><td data-kf-no-translate>${BUNDLE_BYTES ? `${BUNDLE_BYTES.toLocaleString('en-US')} / ${BUNDLE_BYTE_CEILING.toLocaleString('en-US')} bytes` : '—'}</td><th>Injection ceiling</th><td data-kf-no-translate>${BUNDLE_BYTES ? `${(BUNDLE_BYTES + LIBRARY_SEED_BYTES).toLocaleString('en-US')} / ${INJECTION_BYTE_BUDGET.toLocaleString('en-US')} byte gate · ${(BUNDLE_BYTE_CEILING - BUNDLE_BYTES - LIBRARY_SEED_BYTES).toLocaleString('en-US')} byte reserve` : '—'}</td></tr></tbody></table></div></section>`;
}
function focusRestoreKey(element) {
return settingsFocusSelector(element);
}
function settingsSearchIndex() {
if (state.settingsIndex) return state.settingsIndex;
const scratch = document.createElement('div');
const renderers = {
layout: renderLayoutPage,
appearance: renderAppearancePage,
content: renderContentPage,
emotes: renderEmotesPage,
accessibility: renderAccessibilityPage,
viewer: renderViewerPage,
about: renderAboutPage,
};
const index = [];
for (const [id, pageTitle] of NAV_ITEMS) {
const renderer = renderers[id];
if (!renderer) continue;
try {
setMarkup(scratch, renderer());
} catch {
continue;
}
for (const row of scratch.querySelectorAll('.kf-row, .kf-action-row, .kf-subsection-header')) {
const title = row.querySelector('h3')?.textContent?.trim() || '';
if (!title) continue;
const description = row.querySelector('p')?.textContent?.trim() || '';
index.push({
page: id,
pageTitle,
title,
description,
terms: [title, description, tr(title), tr(description)].join('\n'),
});
}
}
state.settingsIndex = index;
return index;
}
function renderSettingsSearchResults(query) {
const matches = rankSettingsMatches(query, settingsSearchIndex());
const header = pageHeader('Search', 'Every page, searched at once.', 'Matches', String(matches.length));
if (!matches.length) {
      return `${header}<section class="kf-panel kf-search-empty"><p>${escapeHtml(trf('Nothing matches “{query}”.', { query }))}</p><p>${escapeHtml(tr('Try a shorter word, or the name of the Kick control you are looking for.'))}</p></section>`;
}
    return `${header}<section class="kf-panel kf-search-results">${matches.map((match) => `
      <button type="button" class="kf-search-result" data-kf-search-goto="${escapeHtml(match.page)}">
        <span class="kf-search-result-copy"><strong>${escapeHtml(match.title)}</strong>${match.description ? `<small>${escapeHtml(match.description)}</small>` : ''}</span>
        <span class="kf-search-result-page">${escapeHtml(match.pageTitle)}</span>
      </button>`).join('')}</section>`;
}
function renderSettingsPage() {
if (!state.shadow) return;
const page = state.shadow.querySelector('[data-kf-page]');
const previousPage = page.dataset.kfCurrentPage;
const active = state.shadow.activeElement;
const focusKey = active && page.contains(active) ? focusRestoreKey(active) : '';
const scrollTop = page.scrollTop;
if (state.settingsQuery) {
setMarkup(page, renderSettingsSearchResults(state.settingsQuery));
page.dataset.kfCurrentPage = 'search';
page.scrollTop = 0;
localizeInterface();
return;
}
const renderer = {
layout: renderLayoutPage,
appearance: renderAppearancePage,
content: renderContentPage,
emotes: renderEmotesPage,
accessibility: renderAccessibilityPage,
viewer: renderViewerPage,
about: renderAboutPage,
}[state.currentPage] || renderLayoutPage;
setMarkup(page, renderer());
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
button.setAttribute('aria-current', !state.settingsQuery && button.dataset.page === state.currentPage ? 'page' : 'false');
}
    state.shadow.querySelector(`[data-page="${state.currentPage}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
const reset = state.shadow.querySelector('[data-action="reset-page"]');
reset.disabled = state.currentPage === 'about' || state.currentPage === 'emotes';
reset.title = tr(reset.disabled ? 'This page has its own reset control' : 'Restore page defaults');
localizeInterface();
if (state.currentPage === 'emotes') applyStickerLibrarySearch();
if (state.currentPage === 'content') renderChatHistoryResults();
if (state.currentPage === 'viewer') refreshViewerCollectibles();
}
return {
NAV_ITEMS,
uiIcon,
stickerLibrarySummary,
renderViewerHubCards,
renderSettingsPage,
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
const REWARD_STATE_KEY = 'kick-focus:reward-claims';
const PAGE_BLOCK_EVENT = 'kick-focus:request-blocked';
const storageHealth = { failures: {}, lastError: '', librarySeed: { truncated: 0, total: 0 } };
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
const STICKER_SEARCH_DEBOUNCE_MS = 120;
const STICKER_USAGE_SECTION_LIMIT = 24;
const STICKER_TILE_HEIGHT = 62;
const STICKER_GRID_GAP = 7;
const STICKER_TILE_MIN_WIDTH = 50;
const STICKER_WINDOW_GUARD_ROWS = 4;
const pageWindow = typeof unsafeWindow === 'object' ? unsafeWindow : window;
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
viewerHub: {
collectibles: null,
watch: { elapsedMs: 0, activeSince: 0 },
watchVideo: null,
watchPlayback: false,
watchTimer: 0,
},
discoveryLayouts: [],
chatComfort: {
rows: [], hidden: new Set(), seen: new Set(), sounded: new Set(), lastSoundAt: 0, query: '',
composerRecall: [], composerRecallIndex: -1,
},
modal: null,
command: null,
commandInput: null,
commandList: null,
quickButton: null,
headerControlHost: null,
headerControlButton: null,
profileStatsHost: null,
profileStatsButton: null,
followingPreview: null,
followingPreviewRow: null,
chatResizeCleanup: null,
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
chatScrollNode: null,
chatScrollHandler: null,
chatScrollLastTop: 0,
chatScrollTop: null,
chatScrollAnchor: null,
chatScrollIgnoreUntil: 0,
chatPauseNode: null,
suspended: false,
routeSource: '',
layoutRoute: '',
applyRunning: false,
applyQueued: false,
followingPreviewInteractions: false,
presenceRequested: false,
stickerGridScrollTop: null,
stickerSearchTimer: 0,
emoteCompletion: null,
recallingComposer: false,
composerRememberedText: '',
composerRememberedAt: 0,
stickerGridAnchor: 0,
stickerLibraryQuery: '',
stickerLibraryFilter: 'all',
stickerLibrarySelection: new Set(),
stickerLibraryBulkGroup: '',
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
shortcutCapture: null,
shortcutError: '',
resetPending: false,
resetOpener: null,
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
updateNotice: null,
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
live: {
slug: '',
channel: null,
catalog: null,
catalogSource: 'dom',
catalogError: '',
collisions: [],
rarity: null,
inventory: null,
standing: { known: false, subscribed: null, following: null, moderator: null },
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
function companionInfo() {
return state.companion?.active
? { active: true, version: state.companion.version }
: { active: false, version: '' };
}
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
try { publishSettingsState(); } catch {   }
}
};
document.addEventListener('kick-focus:companion-pong', handler);
const ping = () => document.dispatchEvent(new CustomEvent('kick-focus:companion-ping', { detail: { nonce } }));
ping();
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
function noteStorageResult(key, ok) {
const before = storageHealth.failures;
const after = recordStorageResult(before, key, ok, Date.now());
if (JSON.stringify(before) === JSON.stringify(after)) return;
storageHealth.failures = after;
renderStorageWarning();
}
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
}
}
function loadSettings() {
return normalizeSettings(gmGet(STORAGE_KEY, DEFAULT_SETTINGS));
}
function saveSettings(message = 'Autosaved') {
state.settingsIndex = null;
clearTimeout(state.saveTimer);
state.saveTimer = window.setTimeout(() => {
const saved = gmSet(STORAGE_KEY, state.settings);
setSaveStatus(saved ? message : 'Could not save', !saved);
publishSettingsState();
}, 80);
}
function publishSettingsState() {
try {
document.dispatchEvent(new CustomEvent('kick-focus:settings-changed', {
detail: { settings: JSON.stringify(state.settings) },
}));
} catch {
}
}
function setSaveStatus(message, isError = false) {
const status = state.shadow?.querySelector('[data-kf-save-status]');
if (!status) return;
status.textContent = tr(message);
status.dataset.error = String(isError);
}
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
function adoptStyles(root, cssText, id = '') {
const sheet = constructedSheet(cssText);
if (sheet && Array.isArray(root?.adoptedStyleSheets)) {
try {
if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
return null;
} catch {
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
} catch {   }
}
state.siteSheet = null;
}
function ensureSiteStyle() {
if (!state.siteSheet || !Array.isArray(document.adoptedStyleSheets)) return;
if (document.adoptedStyleSheets.includes(state.siteSheet)) return;
try {
document.adoptedStyleSheets = [...document.adoptedStyleSheets, state.siteSheet];
} catch {   }
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
}
}
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
}
return wrapper;
}
function installPlayerLoadingFix() {
if (pageWindow.__kickFocusPlayerLoadingV1) return;
pageWindow.__kickFocusPlayerLoadingV1 = true;
pageWindow.addEventListener('error', (event) => {
if (!state.settings.content.fixPlayerLoading || state.runtime.suspended) return;
const script = event.target;
if (!script || script.tagName !== 'SCRIPT') return;
if (!isAdPreflightScript(script.getAttribute('src') || script.src, location.origin)) return;
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
}
};
try {
const nativeFetch = pageWindow.fetch?.bind(pageWindow);
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
request.then((response) => {
if (!response?.ok) return;
response.clone().json().then(noteDiscoveryLiveStarts).catch(() => {});
}).catch(() => {});
}
if (!isPlaybackUrl(rawUrl)) return request;
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
}
}, { once: true });
}
if (!this.__kfRequest?.blocked) return nativeSend.apply(this, args);
report('XHR', this.__kfRequest);
queueMicrotask(() => {
try {
simulateEmptySuccess(this, pageWindow);
} catch {
}
});
return undefined;
}, nativeSend, 'send');
}
} catch {
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
try { this.dispatchEvent(new pageWindow.Event('error')); } catch {   }
});
return undefined;
}
}
return nativeSetAttribute.call(this, name, value);
};
}
} catch {
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
try { this.dataset.kfBlockedSrc = result.label; } catch {   }
report('Element', result);
queueMicrotask(() => {
try { this.dispatchEvent(new pageWindow.Event('error')); } catch {   }
});
return value;
}
return descriptor.set.call(this, value);
},
});
} catch {
}
}
}
function hiddenElementCss() {
return HIDEABLE_ELEMENTS
    .map((entry) => `html[data-kf-hidden~="${entry.id}"] [data-kf-element="${entry.id}"] { display: none !important; }`)
.join('\n    ');
}
const BUNDLE_BYTES = Number('              858418') || 0;
const BUNDLE_BYTE_CEILING = 1000000;
const INJECTION_BYTE_BUDGET = 925000;
const SITE_CSS = `
  :root {


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


  html[data-kf-theme="slate"][data-kf-accent="violet"] { --kf-accent: #ad88ff; --kf-accent-rgb: 173, 136, 255; }



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
      color: var(--kf-text, #f7f9f8) !important;
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
      background: var(--kf-surface-hover, #101612) !important;
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


    [data-kf-uptime] {
      top: 10px !important; left: 10px !important; padding: 4px 7px !important;
      background: rgba(13,16,14,.82) !important; pointer-events: none !important;
      font-variant-numeric: tabular-nums !important; letter-spacing: .02em !important;
      opacity: .92 !important;
    }



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


      grid-auto-rows: 62px !important;
      gap: 7px !important;
      max-height: min(350px, 40vh) !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      scrollbar-gutter: stable !important;
      padding: 8px 2px 5px !important;
    }


    [data-kf-sticker-item] { position: relative !important; min-width: 0 !important; min-height: 62px !important; text-align: center !important; content-visibility: auto !important; contain-intrinsic-size: auto 62px !important; }


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



  html[data-kf-large-targets="true"] :is(button, a, input, select, textarea) { min-height: 40px; }

  html[data-kf-contrast="true"] :is(main, #main-container) :is(p, span, div) { text-shadow: 0 0 .01px currentColor; }



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
    
    html[data-kf-sidebar="dropdown"] [aria-controls="sidebar-wrapper"] { display: none !important; }
    
    html[data-kf-sidebar="dropdown"] :is(main, #main-container) { margin-left: var(--kf-sidebar-dropdown-tab, 34px); }


    html[data-kf-sidebar="dropdown"][data-kf-reduce-motion="true"] #sidebar-wrapper { transition: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    html[data-kf-sidebar="dropdown"] #sidebar-wrapper { transition: none; }
    #kick-focus-following-preview { transition: none !important; transform: none !important; }
  }



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



  img[data-kf-emote-aspect="wide"] { width: auto !important; aspect-ratio: 2 / 1; object-fit: contain; }



  html[data-kf-static-emotes="true"] img[src*="/emotes/" i],
  html[data-kf-static-emotes="true"] img[data-src*="/emotes/" i] {
    animation-play-state: paused !important;
  }
  @media (prefers-reduced-motion: reduce) {
    html[data-kf-reduce-motion="true"] img[src*="/emotes/" i] { animation-play-state: paused !important; }
  }

  
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



  html[data-kf-reduce-motion="true"] *,
  html[data-kf-reduce-motion="true"] *::before,
  html[data-kf-reduce-motion="true"] *::after {
    scroll-behavior: auto !important;
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }

  @media (prefers-reduced-motion: reduce) {
    html[data-kf-route] *,
    html[data-kf-route] *::before,
    html[data-kf-route] *::after {
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
root.dataset.kfContrast = String(appearance.strongContrast);
root.dataset.kfControlContrast = String(accessibility.highContrast);
root.dataset.kfMatureBlur = String(content.blurMature && !state.runtime.matureVisible);
root.dataset.kfPoorMode = String(content.hideMonetization);
root.dataset.kfReduceMotion = String(accessibility.reduceMotion);
root.dataset.kfStaticEmotes = String(content.staticEmotes
|| (accessibility.reduceMotion && matchMedia('(prefers-reduced-motion: reduce)').matches));
root.dataset.kfFocusVisible = String(accessibility.focusVisible);
root.dataset.kfLargeTargets = String(accessibility.largeTargets);
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
function tagMonetizationSurfaces() {
for (const node of document.querySelectorAll('[data-kf-monetization]')) {
delete node.dataset.kfMonetization;
}
if (!state.settings.content.hideMonetization) return;
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
function tagHideableElements() {
const hidden = state.settings.layout.hidden;
if (!hidden.length) return;
for (const entry of HIDEABLE_ELEMENTS) {
if (!hidden.includes(entry.id)) continue;
const { elements } = findHideableElements(document, entry.probe);
if (elements.length === 0 || elements.length > 4) continue;
for (const element of elements) {
if (state.root?.contains(element)) continue;
if (element.dataset.kfElement !== entry.id) element.dataset.kfElement = entry.id;
}
}
}
function tagSignedInRouteChrome() {
if (state.route !== 'settings') return;
const current = location.pathname.replace(/\/$/, '');
for (const link of document.querySelectorAll('main a[href^="/settings/"]')) {
link.dataset.kfSettingsTab = 'true';
let path = '';
try { path = new URL(link.href, location.href).pathname.replace(/\/$/, ''); } catch {   }
link.dataset.kfSettingsActive = String(path === current);
if (path === current) link.setAttribute('aria-current', 'page');
else if (link.getAttribute('aria-current') === 'page') link.removeAttribute('aria-current');
}
}
function chatLayoutOwner(separator, panel) {
const split = separator?.parentElement;
if (split?.contains(panel)) {
const outer = split.parentElement;
if (outer && outer !== document.body && outer.children.length === 1) return outer;
return split;
}
return ownerFromChild(panel, '#channel-chatroom, [data-testid="chatroom"], [data-testid="chatroom-messages"]');
}
function bindChatResizer(separator) {
if (separator.dataset.kfChatResizeBound === 'true') return;
separator.dataset.kfChatResizeBound = 'true';
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
separator.setAttribute('aria-valuenow', String(nextWidth));
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
}), true);
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
separator.setAttribute('aria-valuemin', '320');
separator.setAttribute('aria-valuemax', '520');
separator.setAttribute('aria-valuenow', String(state.settings.layout.chatWidth));
bindChatResizer(separator);
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
function favoriteChannel() {
return favoriteScope(currentChannelSlug());
}
function newFavoriteChannel() {
return state.settings.content.favoriteScope === 'channel' ? favoriteChannel() : '';
}
function favoriteKeysInOrder() {
return favoritesForChannel(state.stickerPreferences.favorites, favoriteChannel());
}
function isFavorited(key) {
return isStickerFavorite(state.stickerPreferences.favorites, key, favoriteChannel());
}
function favoriteCount() {
return favoriteKeysInOrder().length;
}
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
function noteLibrarySeed(result, value) {
storageHealth.librarySeed = {
truncated: Number(result?.truncated) || 0,
total: Array.isArray(value?.library) ? value.library.length : 0,
};
}
async function hydrateLibrary() {
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
const VOLUME_GRACE_MS = 1500;
function readEmoteUsage() {
return normalizeEmoteUsage(gmGet(EMOTE_USAGE_KEY, null));
}
let unhookedFetch = null;
function pageFetch(url, init) {
return unhookedFetch ? unhookedFetch(url, init) : window.fetch(url, init);
}
function currentChannelSlug() {
if (routeKind(location.href) !== 'channel') return '';
const slug = location.pathname.split('/').filter(Boolean)[0] || '';
return /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(slug) ? slug : '';
}
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
if (mode === 'dropdown') {
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
if (video.dataset.kfManualPlayback !== 'true') video.pause();
});
} catch {
}
}
}
function cardContext(node) {
const categories = [];
for (const link of node.querySelectorAll?.('a[href*="/category/"]') || []) {
const slug = (link.getAttribute('href') || '').split('/category/')[1];
if (slug) categories.push(slug.split(/[/?#]/, 1)[0]);
}
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
const slug = cardSlugFromPath(path);
const name = cardLabel(node);
const label = escapeHtml(name);
const inMulti = Boolean(slug) && multistreamHasSlug(slug);
const multiChip = slug
    ? `<button type="button" data-kf-card-action="multi" data-kf-card-slug="${escapeHtml(slug)}" data-kf-card-name="${label}" data-active="${inMulti}" aria-pressed="${inMulti}" aria-label="${escapeHtml(trf(inMulti ? 'Remove {name} from the multi-stream grid' : 'Add {name} to the multi-stream grid', { name }))}" title="${escapeHtml(tr(inMulti ? 'In Multi' : 'Add to Multi'))}">${inMulti ? '⊟' : '⊞'}</button>`
: '';
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
const actions = button.parentElement;
if (actions?.dataset.kfCardSignature) {
actions.dataset.kfCardSignature = actions.dataset.kfCardSignature.replace(
        /:(true|false):([^:]*)$/, `:${inMulti}:$2`,
);
}
const name = button.dataset.kfCardName || '';
button.setAttribute('aria-label', trf(
inMulti ? 'Remove {name} from the multi-stream grid' : 'Add {name} to the multi-stream grid',
{ name },
));
}
}
function handleCardAction(event) {
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
function followingPreviewOwner(row) {
const markerSelector = '[data-testid^="sidebar-following-channel-"]';
if (row?.matches?.(markerSelector)) return row;
const wrapper = row?.closest?.(markerSelector);
if (wrapper) return wrapper;
if (row?.querySelector?.(markerSelector)) return row;
return row?.closest?.('li') || row;
}
function followingPreviewSource(row) {
const owner = followingPreviewOwner(row);
const images = [...(owner?.querySelectorAll?.('img') || [])]
.filter((image) => image.currentSrc || image.getAttribute?.('src'))
.sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
return images[0] || null;
}
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
try { query = new URL(location.href).searchParams.get('query') || ''; } catch {   }
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
try { video.currentTime = saved; } catch {   }
}
}
video.dataset.kfMediaRestored = 'true';
};
const boundAt = Date.now();
const saveVolume = () => {
const elapsed = Date.now() - boundAt;
if (elapsed < VOLUME_GRACE_MS && video.muted) return;
saveMediaPreference('volume', { volume: video.volume, muted: video.muted });
};
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
const QUALITY_SESSION_KEY = 'stream_quality';
const QUALITY_LADDER_KEY = 'ladder:global';
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
function qualityOptionGated(control) {
const label = qualityControlLabel(control);
if (!label) return false;
const full = String(control.textContent || '').replace(/\s+/g, ' ').trim();
return full.replace(/\s+/g, '') !== label.replace(/\s+/g, '');
}
function publishCompatibility() {
const root = document.documentElement;
if (!root || !state.compatibility) return;
const broken = (state.compatibility.derived || []).filter((entry) => entry.outcome === 'broken');
const verdict = broken.length
    ? broken.map((entry) => `${entry.probe}:${entry.id}`).join(' ')
: 'ok';
if (root.dataset.kfDerived !== verdict) root.dataset.kfDerived = verdict;
}
function compatibilityDerivers() {
return {
cardSlug: (card) => cardSlugFromPath(cardPath(card)),
playerContainer: (video) => playerContainerFor(video),
qualityHeight: (control) => (qualityOptionGated(control)
? 0
: Number(qualitySessionValue(qualityControlLabel(control)))),
};
}
function bestKnownQuality() {
const raw = state.mediaPreferences[QUALITY_LADDER_KEY];
return typeof raw === 'string' ? bestQualityOption(raw.split('|')) : '';
}
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
}
}
function recordQualityLadder(controls) {
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
if (qualityOptionGated(control)) continue;
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
const CHAT_SCROLL_PAUSE_DISTANCE = 64;
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
if (Number.isFinite(state.runtime.chatScrollTop) && Math.abs(messages.scrollTop - state.runtime.chatScrollTop) > 0.5) {
state.runtime.chatScrollIgnoreUntil = Date.now() + 80;
messages.scrollTop = state.runtime.chatScrollTop;
}
state.runtime.chatScrollTop = messages.scrollTop;
state.runtime.chatScrollAnchor = captureChatScrollAnchor(messages);
}
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
function armChatScrollPause(messages) {
if (state.runtime.chatScrollNode === messages) return;
releaseChatScrollPause();
state.runtime.chatScrollLastTop = messages.scrollTop;
const handler = () => {
const top = messages.scrollTop;
const previousTop = state.runtime.chatScrollLastTop;
if (Date.now() < state.runtime.chatScrollIgnoreUntil) {
state.runtime.chatScrollLastTop = top;
return;
}
const movedUp = top < previousTop - 2;
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
const src = rawSrc;
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
const STICKER_LAST_SEEN_WRITE_MS = 60 * 60 * 1000;
function sameStickerRecord(a, b) {
const strip = (entry) => { const { lastSeen, ...rest } = entry; return rest; };
return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}
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
window.addEventListener('pagehide', () => { if (stickerPersistTimer) flushStickerPersist(); });
function mergeStickerLibrary(observed) {
let changed = false;
const now = Date.now();
for (const sticker of observed) {
if (state.stickerPreferences.hidden.has(sticker.key)) continue;
const existing = state.stickerPreferences.library.get(sticker.key);
const nativeGroups = [...new Set([...(existing?.nativeGroups || []), ...(sticker.nativeGroups || [])])].slice(0, 20);
const incomingAccess = sticker.available || sticker.access === 'available'
? 'available'
: sticker.access === 'observed'
? 'observed'
: sticker.access === 'channel'
? 'channel'
: 'locked';
const access = preferredStickerAccess(existing?.access, incomingAccess);
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
...(sticker.usableEverywhere === undefined ? {} : { usableEverywhere: sticker.usableEverywhere === true }),
...(sticker.usableHere === undefined ? {} : { usableHere: sticker.usableHere === true }),
}, now);
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
const ANCHORED_ELEMENTS = new Map();
const EMOTE_CARD_ANCHOR = '--kf-emote-card';
const EMOTE_COMPLETION_ANCHOR = '--kf-emote-completion';
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
function markAnchoredSurface(host) {
if (!canAnchorPopover()) return false;
host.setAttribute('popover', 'manual');
host.dataset.kfAnchored = 'true';
return true;
}
function anchorSurfaceTo(host, anchor, name) {
if (host?.dataset?.kfAnchored !== 'true' || !anchor?.style) return false;
const previous = ANCHORED_ELEMENTS.get(name);
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
return false;
}
}
function closeAnchoredSurface(host) {
if (!host || typeof host.hidePopover !== 'function') return;
try {
if (host.matches(':popover-open')) host.hidePopover();
} catch {
}
}
const TOOLTIP_CSS = `
  :host {
    position: fixed;
    z-index: 2147483000;


    pointer-events: none;
    display: none;
    max-width: 280px;
  }
  :host([data-kf-open="true"]) { display: block; }


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
    border: 1px solid var(--kf-border-strong, #59645c);
    border-radius: var(--kf-radius, 7px);
    background: var(--kf-panel-raised, #151917);
    color: var(--kf-text, #f4f7f5);
    box-shadow: 0 10px 28px rgba(0,0,0,.45);
    font: 12px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .card div { white-space: normal; overflow-wrap: anywhere; }
  .card div:first-child { font-weight: 700; }
  .card div + div { color: var(--kf-text-muted, #a5aea8); }
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
if (!key) return;
const sticker = state.stickerPreferences.library.get(key) || chatStickerInfo(image);
const lines = emoteTooltipText(sticker, state.live.collisions, state.stickerPreferences.library.has(key));
if (!lines.length) return;
const { host, card } = chatEmoteTooltipHost();
card.replaceChildren(...lines.map((line, index) => {
const row = document.createElement('div');
row.textContent = index === 0 ? line : tr(line);
if (index > 0 && line.startsWith('Name shadowed')) row.dataset.warn = 'true';
return row;
}));
host.dataset.kfOpen = 'true';
const tooltip = state.chatEmoteTooltip;
if (tooltip) {
setChatEmoteDescription(tooltip.describedImage, false);
tooltip.describedImage = image;
}
setChatEmoteDescription(image, true);
if (anchorSurfaceTo(host, image, EMOTE_CARD_ANCHOR) && openAnchoredSurface(host)) return;
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
function rarityBadge(descriptor) {
if (!state.settings.content.showEmoteRarity || !state.live.rarity) return '';
const match = state.live.rarity.matched.find((entry) => entry.emote.id === descriptor.id);
if (!match) return '';
  return `<span class="kf-rarity" data-rarity="${escapeHtml(match.rarity)}" title="${escapeHtml(trf('Kick rarity, matched by {basis}', { basis: tr(match.basis) }))}">${escapeHtml(match.rarity)}</span>`;
}
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
const favoriteOrder = favoriteKeysInOrder();
const byFavoriteOrder = (left, right) => favoriteOrder.indexOf(left.key) - favoriteOrder.indexOf(right.key);
const unavailableCount = unavailableStickerCount(picker, descriptors);
const byId = new Map();
for (const descriptor of descriptors) {
if (descriptor.id && !byId.has(String(descriptor.id))) byId.set(String(descriptor.id), descriptor);
}
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
favoriteOrder.join(','),
[...state.stickerPreferences.hidden].join(','),
    state.stickerPreferences.groups.map((group) => `${group.id}:${group.name}`).join(','),
    [...state.stickerPreferences.assignments].map(([key, groupId]) => `${key}:${groupId}`).join(','),
].join('\u0001');
if (chrome.dataset.kfStickerSignature === signature) {
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
function stickerGridColumns(grid) {
const width = grid?.clientWidth || 0;
if (!width) return 1;
return Math.max(1, Math.floor((width + STICKER_GRID_GAP) / (STICKER_TILE_MIN_WIDTH + STICKER_GRID_GAP)));
}
function stickerSpacerMarkup(count, columns, side) {
const rows = Math.ceil(Math.max(0, count) / Math.max(1, columns));
if (rows <= 0) return '';
const height = rows * STICKER_TILE_HEIGHT + (rows - 1) * STICKER_GRID_GAP;
  return `<div data-kf-sticker-spacer="${side}" aria-hidden="true" style="height:${height}px"></div>`;
}
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
function bindStickerGridScroll(gridHost) {
gridHost.addEventListener('scroll', (event) => {
const grid = event.target;
if (!grid?.dataset || grid.dataset.kfStickerTotal === undefined) return;
const total = Number(grid.dataset.kfStickerTotal) || 0;
const [start, end] = String(gridHost.dataset.kfStickerWindow || '0-0').split('-').map(Number);
if (end - start >= total) return;
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
function highlightRegistry() {
try {
return typeof Highlight === 'function' && typeof CSS !== 'undefined' && CSS.highlights ? CSS.highlights : null;
} catch {
return null;
}
}
function clearKeywordHighlight() {
try { highlightRegistry()?.delete(KEYWORD_HIGHLIGHT_NAME); } catch {   }
}
function applyChatHighlights() {
const messages = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages');
const registry = highlightRegistry();
if (!messages) {
clearKeywordHighlight();
return;
}
const keywords = state.settings.content.chatHighlights ? chatKeywordsForChannel() : [];
const ranges = [];
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
const CHAT_TIMESTAMP_VAR = '--chatroom-timestamps-display';
const CHAT_AUTHOR_PROBES = ['button[data-prevent-expand="true"]', 'button.font-bold', 'button'];
function chatMessageAuthor(node) {
for (const selector of CHAT_AUTHOR_PROBES) {
const found = node.querySelector?.(selector);
const name = String(found?.textContent || '').trim();
if (name && name.length < 40) return name;
}
return '';
}
function chatMessageText(node, author) {
const raw = String(node.textContent || '').replace(/\s+/g, ' ').trim();
if (!author) return raw;
const at = raw.indexOf(author);
return at === -1 ? raw : raw.slice(at + author.length).replace(/^\s*:\s*/, '').trim();
}
function chatMessageId(node) {
return String(node.dataset?.messageId || node.dataset?.chatEntry || node.dataset?.index || '').trim();
}
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
}
}
function mentionNames() {
const people = state.settings.content.chatPriorityPeople || [];
const own = liveLocalUsername();
return own ? [...people, own] : [...people];
}
function applyChatComfortToMessage(node, { keywordHit, settings, people, own, channel, now }) {
const id = chatMessageId(node);
const author = (people.length > 0 || settings.chatHistory || settings.chatMentionSound)
? chatMessageAuthor(node)
: '';
const priority = people.length > 0 && isPriorityPerson(people, author);
if (people.length > 0) {
if (node.dataset.kfChatPriority !== String(priority)) node.dataset.kfChatPriority = String(priority);
} else if (node.dataset.kfChatPriority) {
delete node.dataset.kfChatPriority;
}
if (settings.chatHideMessages) {
const hidden = id !== '' && state.chatComfort.hidden.has(id);
if (node.dataset.kfChatHidden !== String(hidden)) {
node.dataset.kfChatHidden = String(hidden);
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
function clearChatHistory() {
state.chatComfort.rows = [];
state.chatComfort.seen.clear();
renderChatHistoryResults();
showToast('Session chat log cleared.', false);
}
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
return {
video,
route: state.route,
documentVisible: document.visibilityState !== 'hidden',
connected: Boolean(video?.isConnected),
visible: videoIsVisible(video),
intersectsViewport: width > 0 && height > 0,
playerSurface: channelPlayer || genericPlayer || (width >= 480 && height >= 270),
playerPriority: channelPlayer ? 2 : 1,
preview,
preload,
background: markedBackground || (muted && !channelPlayer),
muted,
playing: Boolean(video && !video.paused && !video.ended && video.readyState >= 3),
width,
height,
current: state.viewerHub.watchVideo === video,
};
}
function sessionWatchOwnerCandidate() {
return selectSessionWatchOwner([...document.querySelectorAll('video')].map(sessionWatchVideoCandidate));
}
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
function fetchBlocklistText(href) {
if (companionInfo().active) {
return new Promise((resolve, reject) => {
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
if (typeof GM_xmlhttpRequest === 'function') {
return new Promise((resolve, reject) => {
GM_xmlhttpRequest({
method: 'GET',
url: href,
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
const scored = [];
for (const node of cardCandidates()) {
delete node.dataset.kfFiltered;
delete node.dataset.kfMature;
delete node.dataset.kfDismissed;
const context = cardContext(node);
const labels = detectContentLabels(node.textContent, context);
const link = node.matches?.('a[href]') ? node : node.querySelector?.('a[href]');
let path = '';
try { path = observedChannelPath(link ? new URL(link.href, location.origin).pathname : ''); } catch {   }
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
function scheduleApply(delay = 50) {
if (state.runtime.suspended) return;
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
function yieldToInput() {
try {
return typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function' ? scheduler.yield() : null;
} catch {
return null;
}
}
async function runApplyCycle() {
if (state.runtime.suspended) return;
if (state.runtime.applyRunning) {
state.runtime.applyQueued = true;
return;
}
state.runtime.applyRunning = true;
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
refreshLiveChannel().catch(() => {});
const resume = yieldToInput();
if (resume) {
elapsed += performance.now() - started;
await resume;
if (state.runtime.suspended) return;
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
if (state.currentPage === 'viewer' && state.modal && !state.modal.hidden) renderViewerHubInPlace();
if (rerun && !state.runtime.suspended) scheduleApply(0);
}
}
function updateApplyCostInPlace() {
const node = state.shadow?.querySelector('[data-kf-apply-cost]');
if (node) node.textContent = tr(applyCostSummary(state.diagnostics.apply));
}
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
const TRUSTED_HTML_POLICY = (() => {
try {
const api = typeof window !== 'undefined' ? window.trustedTypes : undefined;
return typeof api?.createPolicy === 'function'
? api.createPolicy('kick-focus', { createHTML: (value) => value })
: null;
} catch {
return null;
}
})();
function trustedHTML(value) {
return TRUSTED_HTML_POLICY ? TRUSTED_HTML_POLICY.createHTML(String(value)) : value;
}
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
    --surface-0: var(--kf-canvas, #070908);
    --surface-1: var(--kf-panel, #101311);
    --surface-2: var(--kf-panel-raised, #151917);
    --surface-3: var(--kf-panel-high, #1c211e);
    --surface-inset: var(--kf-surface-inset, #0b0e0c);
    --surface-hover: var(--kf-surface-hover, #202621);
    --surface-selected: var(--kf-surface-selected, #182019);
    --surface-danger: #2a1416;
    --border: var(--kf-border, #353b37);
    --border-subtle: color-mix(in srgb, var(--border) 68%, transparent);
    --border-control: color-mix(in srgb, var(--border-strong) 78%, var(--border));
    --border-strong: var(--kf-border-strong, #59645c);
    --text: var(--kf-text, #f4f7f5);
    --text-secondary: var(--kf-text-secondary, #c7cec9);
    --muted: var(--kf-text-muted, #a5aea8);
    --subtle: color-mix(in srgb, var(--muted) 72%, var(--surface-0));
    --on-accent: var(--kf-on-accent, #071004);
    --danger: var(--kf-danger, #ff6258);
    --danger-text: #ffaaa4;
    --warning: var(--kf-warning, #f6b943);
    --success: var(--accent);


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


  .kf-sticker-library-item { min-width: 0; display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 10px; padding: 9px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface-inset); content-visibility: auto; contain-intrinsic-size: auto 86px; }
  .kf-sticker-library-item[data-removed="true"] { opacity: .58; }
  .kf-sticker-library-item[data-selected="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px rgba(var(--accent-rgb),.18); }
  .kf-sticker-library-image { width: 52px; height: 52px; display: grid; place-items: center; padding: 5px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
  .kf-sticker-library-image img { width: 100%; height: 100%; object-fit: contain; }
  .kf-sticker-library-copy { min-width: 0; }
  .kf-sticker-library-copy strong { display: block; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
  .kf-sticker-library-copy small { display: block; overflow: hidden; margin-top: 2px; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .kf-sticker-access { display: inline-flex; margin-top: 5px; padding: 2px 5px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); color: var(--muted); font-size: 9px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }


  .kf-sticker-access[data-access="available"] { border-color: rgba(139,232,92,.55); color: #8be85c; }
  .kf-sticker-access[data-access="channel"] { border-color: rgba(255,190,46,.58); color: #ffcf61; }
  .kf-sticker-access[data-access="observed"] { border-color: rgba(56,215,208,.58); color: #70e9e3; }
  .kf-emote-catalog-browser { display: grid; grid-template-columns: minmax(170px,.7fr) minmax(260px,1.3fr); gap: 12px; align-items: center; margin-bottom: 12px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); }
  .kf-emote-catalog-browser h4 { margin: 0; color: var(--text); font-size: 13px; }
  .kf-emote-catalog-browser p { margin: 2px 0 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
  .kf-emote-catalog-status { grid-column: 1 / -1; }
  .kf-emote-catalog-form { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; }
  .kf-emote-catalog-status[data-error="true"] { color: var(--danger-text); }


  .kf-sticker-changed { display: inline-flex; margin: 5px 0 0 5px; padding: 2px 5px; border: 1px solid rgba(217,139,58,.62); border-radius: 3px; color: #e0a367; font-size: 8px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
  .kf-sticker-library-item[data-changed="true"] { border-color: rgba(217,139,58,.42); }


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


  @media (prefers-reduced-motion: reduce) {
    [data-kf-earned="reward-ready"]::after { animation: none; }
  }

  .kf-layout-save { display: grid; gap: 8px; justify-items: stretch; min-width: 240px; }
  .kf-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .kf-chip { padding: 5px 10px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; background: transparent; font-size: 11px; cursor: pointer; }
  .kf-chip[aria-pressed="true"] { color: var(--accent); border-color: var(--accent); }


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
  .kf-toast-action:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

  
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


    .kf-switch { border: 1px solid CanvasText; }
    .kf-switch[aria-checked="true"] { background: Highlight; }
    [aria-checked="true"], [aria-selected="true"], [aria-pressed="true"], [aria-current="page"] {
      outline: 2px solid Highlight;
      outline-offset: 1px;
    }
  }



  :host :is(button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="option"]) {
    min-width: 24px;
    min-height: 24px;
  }


  :host p a[href], :host small a[href], :host li a[href] { min-width: 0; min-height: 0; }



  :host [data-kf-page] :is(button, a[href], input, select, textarea, [role="switch"]) {
    scroll-margin-block: 72px;
  }



  :host([data-kf-large-targets="true"]) :is(button, a[href], input, select, textarea) { min-height: 40px; }
  :host([data-kf-large-targets="true"]) .kf-switch { min-width: 74px; }
  :host([data-kf-large-targets="true"]) .kf-icon-button { min-width: 40px; }
  :host([data-kf-large-targets="true"]) .kf-ms-bar :is(button, .kf-ms-link) { min-height: 32px; padding: 6px 10px; }


  :host([data-kf-large-targets="true"]) .kf-ms-bar { opacity: 1; }

  :host([data-kf-reduce-motion="true"]) *,
  :host([data-kf-reduce-motion="true"]) *::before,
  :host([data-kf-reduce-motion="true"]) *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }



  .kf-fact-list { margin: 0; padding: 0; display: grid; gap: 10px; }
  .kf-fact { margin: 0; padding: 10px 12px; border-left: 3px solid var(--border-subtle); background: rgba(255,255,255,.02); border-radius: 0 4px 4px 0; }
  .kf-fact dt { margin: 0 0 3px; font-size: 12px; font-weight: 700; }
  .kf-fact dd { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.55; }

  
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
  
  .kf-ms-tile[data-kf-multistream-focused="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }


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


  .kf-ms-merged-source { display: inline-block; margin-right: 6px; padding: 0 5px; border-radius: 4px;
    background: var(--kf-panel-high, #202626); color: var(--kf-accent, #53fc18); font-size: 11px; font-weight: 700; }
  .kf-ms-merged-who { margin-right: 4px; font-weight: 700; }
  .kf-ms-merged-who::after { content: ':'; }


  .kf-ms-backdrop[data-kf-multistream-merged-on="true"] .kf-ms-chat { display: none; }
  .kf-ms-chat { min-width: 0; border-left: 1px solid var(--border); display: grid; grid-template-rows: auto 1fr; }


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
const TRANSLATIONS = {
es: {
'Home': 'Inicio',
'Browse': 'Explorar',
'Following': 'Siguiendo',
'Saved views': 'Vistas guardadas',
'Keep the density, thumbnail size, rails, and content filters you like as a named view, and have it applied when you open the pages you chose. It is your own settings, applied to what Kick already sent. It changes nothing about what Kick recommends or the order anything appears in.': 'Guarda la densidad, el tamaño de miniatura, los raíles y los filtros de contenido que te gustan como una vista con nombre, y aplícala al abrir las páginas que elijas. Son tus propios ajustes aplicados a lo que Kick ya envió. No cambia nada de lo que Kick recomienda ni el orden en que aparece.',
'Save this page as a view': 'Guardar esta página como vista',
'Pick the pages it should apply to, or none to keep it manual.': 'Elige las páginas donde debe aplicarse, o ninguna para dejarla manual.',
'Save this view': 'Guardar esta vista',
'No saved views yet. Set the page up the way you want it, name it, and save.': 'Todavía no hay vistas guardadas. Deja la página como la quieres, ponle nombre y guárdala.',
'Applied only when you press it': 'Se aplica solo cuando la pulsas',
'Currently applied': 'Aplicada ahora',
'Applied {name} for this page.': 'Se aplicó {name} en esta página.',
'{n} saved views is the limit. Delete one first.': 'El límite es {n} vistas guardadas. Borra una primero.',
'Saved {name}.': 'Se guardó {name}.',
'Applied {name}. {n} settings changed.': 'Se aplicó {name}. Cambiaron {n} ajustes.',
'{name} is already what you are looking at.': '{name} es justo lo que estás viendo.',
'Deleted {name}.': 'Se borró {name}.',
'Name the view before saving it.': 'Ponle nombre a la vista antes de guardarla.',
'Delete this saved view': 'Borrar esta vista guardada',
'Name this view': 'Nombre de la vista',
'Category pages': 'Páginas de categoría',
'Search results': 'Resultados de búsqueda',
'Show message times': 'Mostrar la hora de los mensajes',
'Reveals the timestamp Kick already renders on every message and keeps hidden. It is Kick’s own value, so scrolling back shows when a message was sent rather than when this build first saw it.': 'Muestra la marca de hora que Kick ya dibuja en cada mensaje y mantiene oculta. Es el valor de Kick, así que al subir por el chat verás cuándo se envió el mensaje y no cuándo lo vio esta extensión.',
'People worth noticing': 'Personas que quieres notar',
'Names you want to catch in a fast chat. Their messages get a marker of their own, separate from keyword highlights. Comma separated, and stored only in your settings.': 'Nombres que quieres captar en un chat rápido. Sus mensajes reciben una marca propia, distinta de los resaltados por palabra clave. Separados por comas y guardados solo en tus ajustes.',
'Sound on a mention': 'Sonido al mencionarte',
'A short tone when a message matches your highlights, comes from someone you listed, or says your name. Synthesised in the browser, so nothing is downloaded. Silent while the tab is in the background, silent for your own messages, and never more than once every few seconds.': 'Un tono corto cuando un mensaje coincide con tus resaltados, viene de alguien de tu lista o dice tu nombre. Se genera en el navegador, así que no se descarga nada. Callado con la pestaña en segundo plano, callado con tus propios mensajes y nunca más de una vez cada pocos segundos.',
'Hide a message for yourself': 'Ocultar un mensaje solo para ti',
'Adds a small dismiss control to each message. It hides that message in your own browser for this session only, changes nothing for anyone else, and offers an undo.': 'Añade un pequeño control de descarte a cada mensaje. Oculta ese mensaje en tu navegador solo durante esta sesión, no cambia nada para los demás y ofrece deshacer.',
'Recall my sent messages': 'Recordar mis mensajes enviados',
'Keep the last five messages sent from this tab in memory. Shift+Up cycles them. Whispers are skipped, reload clears them, and ordinary Arrow Up stays with Kick.': 'Guarda en memoria los últimos cinco mensajes enviados desde esta pestaña. Mayús+Arriba los recorre. Los susurros se omiten, recargar los borra y Flecha arriba sigue siendo de Kick.',
'Search this session’s chat': 'Buscar en el chat de esta sesión',
'Keeps what this tab has seen so you can find it again. It stays in memory, never reaches storage, and is gone on reload. Whispers are never recorded, and a message a moderator removes leaves the log the moment the deletion arrives.': 'Guarda lo que esta pestaña ha visto para que puedas encontrarlo otra vez. Queda en memoria, nunca llega al almacenamiento y desaparece al recargar. Los susurros no se guardan nunca, y un mensaje que un moderador elimine sale del registro en cuanto llega el borrado.',
'Session chat log': 'Registro del chat de esta sesión',
'Hidden by you': 'Ocultado por ti',
'Hide this message for me': 'Ocultar este mensaje para mí',
'Nothing in this session matches that.': 'Nada de esta sesión coincide con eso.',
'Nothing recorded yet. Open a chat with the switch on.': 'Todavía no hay nada guardado. Abre un chat con la opción activada.',
'Saved {n} messages from this session.': 'Se guardaron {n} mensajes de esta sesión.',
'Message hidden for you. It is still there for everyone else.': 'Mensaje oculto para ti. Sigue ahí para todos los demás.',
'Session chat log cleared.': 'Registro del chat de la sesión borrado.',
'message held. Capped at 400 messages, 200 KB, and one hour.': 'mensaje guardado. Con un tope de 400 mensajes, 200 KB y una hora.',
'messages held. Capped at 400 messages, 200 KB, and one hour.': 'mensajes guardados. Con un tope de 400 mensajes, 200 KB y una hora.',
'name, name': 'nombre, nombre',
'Search what you have seen': 'Busca lo que has visto',
'Save as a file': 'Guardar como archivo',
'Clear the log': 'Borrar el registro',
'Daily reward ready': 'Recompensa diaria lista',
'Viewer': 'Cuenta',
'Account readings and this browser session, in one place. Nothing here is claimed or sent anywhere.': 'Lecturas de la cuenta y esta sesión del navegador, reunidas en un sitio. Aquí no se reclama ni se envía nada.',
'Reading': 'Lecturas',
'Reading…': 'Leyendo…',
'From Kick’s API': 'Desde la API de Kick',
'Read from the page': 'Leído de la página',
'This browser session only': 'Solo esta sesión del navegador',
'{n} min ago': 'hace {n} min',
'Daily reward': 'Recompensa diaria',
'Channel points': 'Puntos del canal',
'Collectibles': 'Coleccionables',
'Drops': 'Drops',
'Level': 'Nivel',
'Streak': 'Racha',
'Session watch time': 'Tiempo visto en esta sesión',
'Not read yet on this page.': 'Todavía no se ha leído en esta página.',
'Kick shows this to a signed-in account only.': 'Kick solo muestra esto a una cuenta con sesión iniciada.',
'Open a channel to see its points.': 'Abre un canal para ver sus puntos.',
'Open Drops to count the campaigns waiting.': 'Abre Drops para contar las campañas pendientes.',
'Kick shows this inside the daily reward dialog only.': 'Kick solo muestra esto dentro del diálogo de la recompensa diaria.',
'The reward dialog did not show a figure this time.': 'Esta vez el diálogo de la recompensa no mostró ninguna cifra.',
'Kick did not answer that read. Nothing was changed.': 'Kick no respondió a esa lectura. No se cambió nada.',
'This card could not be built. The rest of the hub is unaffected.': 'Esta tarjeta no se pudo construir. El resto de la página no se ve afectado.',
'Claimed today': 'Reclamada hoy',
'Not ready yet': 'Todavía no está lista',
'Ready to claim': 'Lista para reclamar',
'Where these come from': 'De dónde salen estos datos',
'Nothing has been read yet. Each card above says why.': 'Todavía no se ha leído nada. Cada tarjeta de arriba explica por qué.',
'Read again': 'Leer otra vez',
'Nothing is claimed for you here': 'Aquí no se reclama nada por ti',
'This page reads. The daily reward is still claimed by Kick’s own dialog, and only when you have turned that on under Content &amp; Ads. A card with no reading says so rather than showing a zero, because an empty balance and an unreadable one are not the same thing.': 'Esta página lee. La recompensa diaria la sigue reclamando el propio diálogo de Kick, y solo si lo has activado en Contenido y anuncios. Una tarjeta sin lectura lo dice en lugar de mostrar un cero, porque un saldo vacío y uno que no se puede leer no son lo mismo.',
'Settings': 'Configuración',
'Autosaved': 'Guardado automático',
'Could not save': 'No se pudo guardar',
'Imported': 'Importado',
'All settings reset': 'Se restablecieron todos los ajustes',
'Page reset': 'Se restableció la página',
'Shortcuts restored': 'Se restauraron los atajos',
'Shortcut saved': 'Atajo guardado',
'Added {name}. Now {count} of {max}.': 'Se añadió {name}. Ahora {count} de {max}.',
'Removed {name}. Now {count} of {max}.': 'Se quitó {name}. Ahora {count} de {max}.',
'Removed {name} from the grid.': 'Se quitó {name} de la cuadrícula.',
'{name} added to the multi-stream grid': '{name} se añadió a la cuadrícula multi-stream',
'The grid is full at {max} of {max}.': 'La cuadrícula está llena con {max} de {max}.',
'The grid is full at {max} channels.': 'La cuadrícula está llena con {max} canales.',
'{name} now has the audio': '{name} tiene ahora el audio',
'Loaded board {name}': 'Se cargó el tablero {name}',
'Copied a link to {name}.': 'Se copió un enlace a {name}.',
'Opened a shared board with {count} {word}.': 'Se abrió un tablero compartido con {count} {word}.',
'The shared board replaced {count} {word} you had collected.': 'El tablero compartido reemplazó {count} {word} que habías reunido.',
'Loaded {count} emotes from {channel}.': 'Se cargaron {count} emotes de {channel}.',
'Kick Focus applied to {route}': 'Kick Focus aplicado a {route}',
'Content filtering suspended: it would have hidden {percent}% of this page.': 'Filtrado de contenido suspendido: habría ocultado el {percent}% de esta página.',
'Exported settings, {emotes} emotes, {counts} usage counts, {boards} boards, and your channels, notes, and filters.': 'Se exportó la configuración, {emotes} emotes, {counts} recuentos de uso, {boards} tableros y tus canales, notas y filtros.',
'The emote was removed, but Kick could not unfollow {channel}.': 'Se eliminó el emote, pero Kick no pudo dejar de seguir a {channel}.',
'Saved {name}, but Kick did not identify the follow-gated source channel.': 'Se guardó {name}, pero Kick no identificó el canal de origen que exige seguirlo.',
'Saved {name}. Following {channel}…': 'Se guardó {name}. Siguiendo a {channel}…',
'Saved {name} locally, but Kick could not follow {channel} ({status}). Sign in or reload the channel and try again.': 'Se guardó {name} en este dispositivo, pero Kick no pudo seguir a {channel} ({status}). Inicia sesión o recarga el canal e inténtalo de nuevo.',
'Open multi-stream': 'Abrir multi-stream',
'Close multi-stream': 'Cerrar multi-stream',
'emote id in card URL': 'el id del emote en la URL de la carta',
'emote name in card URL': 'el nombre del emote en la URL de la carta',
'Use comfortable density': 'Usar densidad cómoda',
'Use compact density': 'Usar densidad compacta',
'Recent': 'Recientes',
'New group': 'Nuevo grupo',
'Save': 'Guardar',
'Rename': 'Cambiar nombre',
'Delete': 'Eliminar',
'Ungrouped': 'Sin grupo',
'Select shown': 'Seleccionar visibles',
'Clear': 'Borrar',
'Earlier': 'Antes',
'Later': 'Después',
'Move': 'Mover',
'Groups': 'Grupos',
'Your emotes': 'Tus emotes',
'Library': 'Biblioteca',
'Favorites': 'Favoritos',
'All': 'Todos',
'Kick': 'Kick',
'Kick groups': 'Grupos de Kick',
'Kick’s original emote groups are shown below.': 'Los grupos de emotes originales de Kick aparecen abajo.',
'No emotes found': 'No se encontraron emotes',
'Try a different search or clear the search field.': 'Prueba otra búsqueda o borra el campo de búsqueda.',
'No favorites yet': 'Aún no hay favoritos',
'Open All and use the star on any emote to keep it here.': 'Abre Todos y usa la estrella de cualquier emote para guardarlo aquí.',
'No recent emotes yet': 'Aún no hay emotes recientes',
'Emotes you send in this channel will appear here.': 'Los emotes que envíes en este canal aparecerán aquí.',
'Create your first group': 'Crea tu primer grupo',
'Use New group above, then select emotes and move them into it.': 'Usa Nuevo grupo arriba, luego selecciona emotes y muévelos allí.',
'This group is empty': 'Este grupo está vacío',
'Choose Organize, select emotes, then move them into this group.': 'Elige Organizar, selecciona emotes y muévelos a este grupo.',
'Try a different search or return to Kick groups.': 'Prueba otra búsqueda o vuelve a los grupos de Kick.',
'{count} selected emote': '{count} emote seleccionado',
'{count} selected emotes': '{count} emotes seleccionados',
'Organize': 'Organizar',
'Remove this-channel favorite {name}': 'Quitar {name} de los favoritos de este canal',
'Emote suggestions': 'Sugerencias de emotes',
'Removed {name} from the grid ({count} of {max})': 'Se quitó {name} de la cuadrícula ({count} de {max})',
'Added {name} to the grid ({count} of {max})': 'Se añadió {name} a la cuadrícula ({count} de {max})',
'Add to Multi': 'Añadir a Multi',
'In Multi': 'En Multi',
'Add {name} to the multi-stream grid': 'Añadir {name} a la cuadrícula multi-stream',
'Remove {name} from the multi-stream grid': 'Quitar {name} de la cuadrícula multi-stream',
'Favorite {name}': 'Marcar {name} como favorito',
'Remove favorite {name}': 'Quitar {name} de favoritos',
'Not interested in {name}': 'No me interesa {name}',
'Restore {name}': 'Restaurar {name}',
'Remove {name}': 'Quitar {name}',
'Restore': 'Restaurar',
'Remove favorite': 'Quitar de favoritos',
'Remove favorite (this channel)': 'Quitar de favoritos (este canal)',
'Use emote {name}': 'Usar el emote {name}',
'Select emote {name}': 'Seleccionar el emote {name}',
'Use {name}': 'Usar {name}',
'{count} in {name}': '{count} en {name}',
'{shown} of {total} available': '{shown} de {total} disponibles',
'{count} available': '{count} disponibles',
', {count} locked by Kick': ', {count} bloqueados por Kick',
'Created {name}. Select emotes, then move them into it.': 'Se creó {name}. Selecciona emotes y luego muévelos ahí.',
'Deleted emote group {name}.': 'Se eliminó el grupo de emotes {name}.',
'Favorited {name}.': 'Se añadió {name} a favoritos.',
'Removed {name} from favorites.': 'Se quitó {name} de favoritos.',
'Restored {name}.': 'Se restauró {name}.',
'Removed {name}.': 'Se quitó {name}.',
'Emote group renamed.': 'Se cambió el nombre del grupo de emotes.',
'Group name restored.': 'Se restauró el nombre del grupo.',
'Emote group restored.': 'Se restauró el grupo de emotes.',
'Favorite order restored.': 'Se restauró el orden de favoritos.',
'Emote group changes restored.': 'Se restauraron los cambios de grupos de emotes.',
'Removed emotes restored.': 'Se restauraron los emotes eliminados.',
'Favorite change restored.': 'Se restauró el cambio de favorito.',
'Emote changes reset.': 'Se restablecieron los cambios de emotes.',
'Favorite moved earlier.': 'El favorito se movió antes.',
'Favorite moved later.': 'El favorito se movió después.',
'Emote moved earlier.': 'El emote se movió antes.',
'Emote moved later.': 'El emote se movió después.',
'emote moved.': 'emote movido.',
'emotes moved.': 'emotes movidos.',
'emote removed.': 'emote eliminado.',
'emotes removed.': 'emotes eliminados.',
'Move selected emotes to group': 'Mover los emotes seleccionados al grupo',
'Emote views': 'Vistas de emotes',
'Kick rarity, matched by {basis}': 'Rareza de Kick, encontrada por {basis}',
'Insert {name}': 'Insertar {name}',
'Open {name} artwork': 'Abrir la imagen de {name}',
'Copy the name {name}': 'Copiar el nombre {name}',
'Type the name {name} into chat': 'Escribir el nombre {name} en el chat',
'Custom group for {name}': 'Grupo personalizado para {name}',
'Rename {name}': 'Cambiar el nombre de {name}',
'Show {name} again': 'Mostrar {name} de nuevo',
'Open {name} on Kick': 'Abrir {name} en Kick',
'Remove {name} from the grid': 'Quitar {name} de la cuadrícula',
'Copy a link to board {name}': 'Copiar un enlace al tablero {name}',
'Delete board {name}': 'Eliminar el tablero {name}',
'Press keys, or Escape to cancel': 'Pulsa las teclas, o Escape para cancelar',
'{preset} preset applied': 'Preajuste {preset} aplicado',
'Hidden {channel}': '{channel} oculto',
'Showing {channel} again': '{channel} vuelve a mostrarse',
'That file is not valid JSON.': 'Ese archivo no contiene JSON válido.',
'Settings must be a JSON object.': 'Los ajustes deben ser un objeto JSON.',
'Settings schema {schema} is newer than this build supports.': 'El esquema de ajustes {schema} es más reciente que el compatible con esta versión.',
'The emote library must be a JSON object.': 'La biblioteca de emotes debe ser un objeto JSON.',
'The emote usage counts must be a JSON object.': 'Los recuentos de uso de emotes deben ser un objeto JSON.',
'The multi-stream boards must be a JSON object.': 'Los diseños de multitransmisión deben ser un objeto JSON.',
'Emote schema {schema} is newer than this build supports.': 'El esquema de emotes {schema} es más reciente que el compatible con esta versión.',
'That file does not contain Kick Focus settings.': 'Ese archivo no contiene ajustes de Kick Focus.',
'settings': 'ajustes',
'emote library': 'biblioteca de emotes',
'emote usage counts': 'recuentos de uso de emotes',
'multi-stream boards': 'diseños de multitransmisión',
'per-channel layout': 'diseño por canal',
'favorite channels': 'canales favoritos',
'not-interested channels': 'canales marcados como no interesantes',
'chat keyword filters': 'filtros de palabras clave del chat',
'channel notes': 'notas de canales',
'volume and quality memory': 'memoria de volumen y calidad',
'blocklist cache': 'caché de la lista de bloqueo',
'watched this session': 'vistos en esta sesión',
'Kick Focus could not save your {list}. Browser storage is full or blocked, so those changes exist only until you reload.': 'Kick Focus no pudo guardar {list}. El almacenamiento del navegador está lleno o bloqueado, por lo que esos cambios solo existirán hasta que recargues.',
'Kick Focus is using about {size} of browser storage. Nothing has failed to save this session.': 'Kick Focus usa unos {size} del almacenamiento del navegador. Nada ha fallado al guardarse en esta sesión.',
'The first paint reads {held} of your {total} emotes. The rest load from the database a moment later.': 'El primer dibujado lee {held} de tus {total} emotes. El resto se carga desde la base de datos un momento después.',
'The browser reported': 'El navegador informó',
'Exporting now is the only way to keep these changes.': 'Exportar ahora es la única forma de conservar estos cambios.',
'{items} read from the page': '{items}, leídos de la página',
'{items} from Kick’s API': '{items}, desde la API de Kick',
'{items} kept in this browser session': '{items}, guardado en esta sesión del navegador',
'{n} showing an older reading.': '{n} con una lectura anterior.',
'{n} could not be built.': 'No se pudieron crear: {n}.',
'{shortcut} is already used by {action}.': '{shortcut} ya lo usa {action}.',
'Added': 'Añadido',
'Removed': 'Eliminado',
'Error log copied.': 'Registro de errores copiado.',
'Could not copy the error log.': 'No se pudo copiar el registro de errores.',
'Diagnostic summary copied.': 'Resumen de diagnóstico copiado.',
'Clipboard access was unavailable.': 'El acceso al portapapeles no estaba disponible.',
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
'This page has its own reset control': 'Esta página tiene su propio control de restablecimiento',
'Restore page defaults': 'Restaurar los valores predeterminados de la página',
'Find a command': 'Buscar un comando',
'Type an action or setting…': 'Escribe una acción o ajuste…',
'Available commands': 'Comandos disponibles',
'No matching commands': 'No hay comandos coincidentes',
'Try “chat”, “layout”, “casino”, or “settings”.': 'Prueba “chat”, “diseño”, “casino” o “configuración”.',
'command available': 'comando disponible',
'commands available': 'comandos disponibles',
'Focus': 'Enfoque',
'Resume': 'Reanudar',
'Resume Kick Focus': 'Reanudar Kick Focus',
'Kick Focus settings': 'Configuración de Kick Focus',
'Layout': 'Diseño',
'Appearance': 'Apariencia',
'Content & Ads': 'Contenido y anuncios',
'Emotes': 'Emotes',
'Find, favorite, remove, and group every emote you have recorded.': 'Busca, marca como favorito, elimina y agrupa todos los emotes registrados.',
'Accessibility & Shortcuts': 'Accesibilidad y atajos',
'About': 'Acerca de',
'Shell, player, and chat': 'Estructura, reproductor y chat',
'Theme, color, and scale': 'Tema, color y escala',
'Privacy, filters, and playback': 'Privacidad, filtros y reproducción',
'Comfort and shortcuts': 'Comodidad y atajos',
'Read-only account signals': 'Datos de cuenta de solo lectura',
'Status, privacy, and diagnostics': 'Estado, privacidad y diagnósticos',
'Control how Kick is arranged across your desktop.': 'Controla cómo se organiza Kick en tu escritorio.',
'Keep the page calm, private, and focused on streams.': 'Mantén la página tranquila, privada y centrada en los streams.',
'Improve comfort and keep core actions within reach.': 'Mejora la comodidad y mantén las acciones principales al alcance.',
'A desktop-first layout and control layer for Kick.': 'Una capa de diseño y control para Kick pensada para escritorio.',
'Language': 'Idioma',
'Auto': 'Automático',
'Sidebar mode': 'Modo de barra lateral',
'Left': 'Izquierda',
'Chat layout': 'Diseño del chat',
'Chat width': 'Ancho del chat',
'Chat width saved.': 'Ancho del chat guardado.',
'Content density': 'Densidad del contenido',
'Stream start behavior': 'Comportamiento al abrir streams',
'Remember per-channel layout': 'Recordar diseño por canal',
'Widen browse grids': 'Ampliar cuadrículas de exploración',
'Show Following rail': 'Mostrar barra de seguidos',
'Show Recommended rail': 'Mostrar barra recomendada',
'Hide Kick’s own controls': 'Ocultar los controles propios de Kick',
'Switch off the player buttons and sidebar entries you never use. Each one is hidden with styling only. Nothing is clicked or removed, and turning it back on restores it immediately.': 'Desactiva los botones del reproductor y las entradas de la barra lateral que nunca usas. Cada uno se oculta solo con estilos: no se pulsa ni se elimina nada, y al reactivarlo vuelve de inmediato.',
'Player controls': 'Controles del reproductor',
'Sidebar': 'Barra lateral',
'Miniplayer': 'Minirreproductor',
'Clip': 'Clip',
'Theater mode': 'Modo cine',
'Fullscreen': 'Pantalla completa',
'Quality menu': 'Menú de calidad',
'Volume': 'Volumen',
'Share': 'Compartir',
'Report': 'Reportar',
'Home link': 'Enlace de Inicio',
'Browse link': 'Enlace de Explorar',
'Following link': 'Enlace de Siguiendo',
'Drops link': 'Enlace de Drops',
'Followed channel list': 'Lista de canales seguidos',
'Recommended channel list': 'Lista de canales recomendados',
'Sticky compact top bar': 'Barra superior compacta fija',
'Show quick command button': 'Mostrar botón de comandos',
'Move mini-player clear of controls': 'Mover el minirreproductor lejos de los controles',
'Recover player after resize': 'Recuperar el reproductor tras cambiar el tamaño',
'Keep ultrawide video uncropped': 'Mantener el video panorámico sin recortar',
'Theme': 'Tema',
'Choose a clear visual direction, then tune only what matters to you.': 'Elige una dirección visual clara y ajusta solo lo que te importe.',
'Quick directions': 'Direcciones rápidas',
'Apply a viewing setup without changing filters or account choices.': 'Aplica una configuración de visualización sin cambiar filtros ni opciones de cuenta.',
'Direction': 'Dirección',
'Each theme changes the full surface hierarchy, not just the page background.': 'Cada tema cambia toda la jerarquía de superficies, no solo el fondo de la página.',
'Layered graphite': 'Grafito en capas',
'Selected': 'Seleccionado',
'Balanced depth with a quiet green undertone.': 'Profundidad equilibrada con un matiz verde discreto.',
'True black': 'Negro real',
'Minimal lift and maximum contrast for dark rooms.': 'Relieve mínimo y contraste máximo para habitaciones oscuras.',
'Cool graphite': 'Grafito frío',
'Blue-toned surfaces with stronger separation.': 'Superficies azuladas con una separación más marcada.',
'Use one accent for focus, selection, and live state.': 'Usa un solo acento para el foco, la selección y el estado en vivo.',
'Low-contrast choices fall back to a safe rose.': 'Las opciones de bajo contraste vuelven a un rosa seguro.',
'Your current theme, accent, scale, and card treatment.': 'Tu tema, acento, escala y tratamiento de tarjetas actuales.',
'Accent color': 'Color de acento',
'Calm': 'Calma',
'Cinema': 'Cine',
'Chat First': 'Chat primero',
'Discovery': 'Descubrimiento',
'Roomier cards, quieter live color, and a compact rail.': 'Tarjetas más amplias, color en vivo más discreto y una barra compacta.',
'OLED surfaces with the player first and chrome tucked away.': 'Superficies OLED con el reproductor primero y los controles apartados.',
'A wider docked chat, compact density, and a clearer accent.': 'Un chat acoplado más ancho, densidad compacta y un acento más claro.',
'More stream cards, vivid thumbnails, and both discovery rails.': 'Más tarjetas de streams, miniaturas intensas y ambas barras de descubrimiento.',
'Custom': 'Personalizado',
'Custom accent': 'Acento personalizado',
'Custom accent color': 'Color de acento personalizado',
'Contrast protected': 'Contraste protegido',
'{preset} preset applied. Content filters were not changed.': 'Se aplicó el preajuste {preset}. Los filtros de contenido no cambiaron.',
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
'Search': 'Buscar',
'Every page, searched at once.': 'Todas las páginas, buscadas a la vez.',
'Try a shorter word, or the name of the Kick control you are looking for.': 'Prueba con una palabra más corta o con el nombre del control de Kick que buscas.',
'Nothing matches “{query}”.': 'Nada coincide con «{query}».',
'Search settings': 'Buscar ajustes',
'Kick Focus updated to {version}.': 'Kick Focus se actualizó a {version}.',
'Changed defaults: {list}.': 'Valores predeterminados que cambiaron: {list}.',
'What changed': 'Qué cambió',
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
'Choose how the left discovery rail behaves. Dropdown collapses it to a tab that expands on hover, giving the grid full width. Desktop widths only.': 'Elige cómo se comporta la barra de descubrimiento izquierda. Desplegable la reduce a una pestaña que se expande al pasar el cursor, dando a la cuadrícula todo el ancho. Solo en anchos de escritorio.',
'Place chat on either side, float it as a dock, or hide it.': 'Coloca el chat a cualquier lado, como panel flotante, u ocúltalo.',
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
'Emote already saved': 'El emote ya estaba guardado',
'Emote saved': 'Emote guardado',
'All streams paused': 'Todas las transmisiónes en pausa',
'All streams playing': 'Todas las transmisiónes en reproducción',
'All streams muted': 'Todas las transmisiónes silenciadas',
'Audio restored to the focused stream': 'Audio restaurado en la transmisión enfocada',
'Focus mode on': 'Modo enfoque activado',
'Focus mode off': 'Modo enfoque desactivado',
'Theater mode on': 'Modo cine activado',
'Theater mode off': 'Modo cine desactivado',
'Chat hidden': 'Chat oculto',
'Chat shown': 'Chat visible',
'Sidebar hidden': 'Barra lateral oculta',
'Sidebar shown': 'Barra lateral visible',
'Mature thumbnails revealed': 'Miniaturas sensibles visibles',
'Mature thumbnails blurred': 'Miniaturas sensibles difuminadas',
'Resume chat': 'Reanudar chat',
'Pause chat': 'Pausar chat',
'Resume chat updates': 'Reanudar las actualizaciones del chat',
'Healthy': 'Correcto',
'Needs attention': 'Necesita atención',
'Multi': 'Multi',
'Play all': 'Reproducir todo',
'Pause all': 'Pausar todo',
'Unmute': 'Activar sonido',
'Mute all': 'Silenciar todo',
'Remove {name} from Kick Focus multi-stream': 'Quitar {name} del multi-stream de Kick Focus',
'Add {name} to Kick Focus multi-stream': 'Añadir {name} al multi-stream de Kick Focus',
'HTTPS JSON URL': 'URL JSON por HTTPS',
'Expected fields: channels, categories, and keywords. Unknown fields are rejected.': 'Campos esperados: channels, categories y keywords. Los campos desconocidos se rechazan.',
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
'Show how long the stream has been live': 'Mostrar cuánto tiempo lleva en directo',
'Kick sends the start time with every channel and shows it nowhere. This reads that field and counts from it in the player corner, with no extra request and no polling.': 'Kick envía la hora de inicio con cada canal y no la muestra en ninguna parte. Esto lee ese campo y cuenta desde él en la esquina del reproductor, sin peticiones extra ni sondeos.',
'Pop out chat': 'Chat en ventana flotante',
'Channel points: Kick says Picture-in-Picture and mirrored viewing do not accrue points. Keep a normal Kick player open when progress matters.': 'Puntos del canal: Kick indica que la imagen en imagen y la visualización reflejada no acumulan puntos. Mantén abierto un reproductor normal de Kick cuando el progreso importe.',
'Merge all chats': 'Unir todos los chats',
'Merged chat from every channel in the grid': 'Chat unificado de todos los canales de la cuadrícula',
'{live} of {total} chats live': '{live} de {total} chats activos',
'One chat per tile': 'Un chat por canal',
'Read-only. Every channel in the grid, in the order messages arrived.': 'Solo lectura. Todos los canales de la cuadrícula, en el orden en que llegaron los mensajes.',
'Showing one merged chat for every channel in the grid': 'Mostrando un chat unificado de todos los canales de la cuadrícula',
'Showing the focused channel chat': 'Mostrando el chat del canal enfocado',
'Return chat': 'Devolver el chat',
'Kick Focus could not open the pop-out chat window.': 'Kick Focus no ha podido abrir la ventana flotante del chat.',
'Chat for {channel} opened in a floating window': 'El chat de {channel} se ha abierto en una ventana flotante',
'Show how long Kick keeps this recording': 'Mostrar cuánto tiempo conserva Kick esta grabación',
'Kick deletes recordings after 7 days, or 30 for a verified channel, and shows that deadline nowhere. On a VOD page this reads the recording date from Kick’s own video list and counts down to it. It says nothing at all when the recording is older than the list Kick returns, or when the tier cannot be established. A guess between 7 and 30 days would be a confident wrong date.': 'Kick borra las grabaciones a los 7 días, o a los 30 si el canal está verificado, y no muestra ese plazo en ninguna parte. En la página de un vídeo, esto lee la fecha de grabación de la propia lista de vídeos de Kick y cuenta atrás hasta ella. No dice nada cuando la grabación es más antigua que la lista que devuelve Kick, o cuando no se puede establecer el nivel: adivinar entre 7 y 30 días sería dar una fecha equivocada con total seguridad.',
'{time} before Kick deletes this recording': '{time} antes de que Kick borre esta grabación',
'Live for {duration}': 'En directo desde hace {duration}',
'{count} emotes usable in any chat': '{count} emotes utilizables en cualquier chat',
'subscribed channel': 'canal suscrito',
'subscribed channels': 'canales suscritos',
'your global sets': 'tus conjuntos globales',
'Kick reports no emotes this account can send anywhere.': 'Kick no indica ningún emote que esta cuenta pueda enviar en cualquier chat.',
'My emotes': 'Mis emotes',
'My emotes ({count})': 'Mis emotes ({count})',
'Subscribed channel': 'Canal suscrito',
'Global collection': 'Colección global',
'Kick reports no emotes this account can use in every chat.': 'Kick no indica ningún emote que esta cuenta pueda usar en todos los chats.',
'Sign in to Kick and open any channel once to load your owned emotes. Nothing is sent or changed.': 'Inicia sesión en Kick y abre cualquier canal una vez para cargar tus emotes. No se envía ni cambia nada.',
'Works in every chat': 'Funciona en todos los chats',
'Only works in its own channel': 'Solo funciona en su propio canal',
'Only works in {channel}’s chat': 'Solo funciona en el chat de {channel}',
'Hide Subscribe, Gift Subs/Dubs, Get KICKs, gift-shop controls, and spend-based leaderboards. Follow, chat, and free daily rewards stay available.': 'Oculta Suscribirse, Regalar subs/dubs, Obtener KICKs, la tienda de regalos y las clasificaciones de gasto. Seguir, el chat y las recompensas diarias gratuitas siguen disponibles.',
'Enable Poor mode': 'Activar modo sin gastos',
'Disable Poor mode': 'Desactivar modo sin gastos',
'Remove spending prompts without changing your Kick account': 'Oculta las invitaciones de gasto sin cambiar tu cuenta de Kick',
'Channel emote catalog': 'Catálogo de emotes del canal',
'Loading…': 'Cargando…',
'Load emotes': 'Cargar emotes',
'Channel-only': 'Solo en el canal',
'Subscriber-only': 'Solo para suscriptores',
'Reduce tracking telemetry': 'Reducir la telemetría de seguimiento',
'Block observed third-party video and error telemetry hosts.': 'Bloquea los servidores de telemetría de vídeo y errores de terceros detectados.',
'Remember volume locally': 'Recordar el volumen localmente',
'Restore each channel’s volume and mute state from local storage.': 'Restaura el volumen y el estado de silencio de cada canal desde el almacenamiento local.',
'Remember quality locally': 'Recordar la calidad localmente',
'Restore a matching quality control when Kick exposes one.': 'Restaura el control de calidad correspondiente cuando Kick lo ofrece.',
'Always start at the highest quality': 'Empezar siempre en la calidad más alta',
'Open every stream at the best rung Kick offers, taking precedence over remembered quality. The rungs are learned from Kick’s own quality menu, so this does nothing until that menu has been opened once. It will not open it for you.': 'Abre cada directo en la mejor opción que ofrezca Kick, con prioridad sobre la calidad recordada. Las opciones se aprenden del propio menú de calidad de Kick, así que no hace nada hasta que ese menú se haya abierto una vez: no lo abrirá por ti.',
'Remember VOD position locally': 'Recordar la posición del VOD localmente',
'Resume finite VODs from the last local playback position.': 'Reanuda los VOD finitos desde la última posición de reproducción local.',
'Pause chat updates': 'Pausar las actualizaciones del chat',
'Scrolling the transcript up freezes it, as does the button. Resume is always one control away.': 'Desplazarte hacia arriba en el chat lo congela, igual que el botón. Reanudar siempre está a un control de distancia.',
'Chat updates paused': 'Actualizaciones del chat en pausa',
'Userscript size': 'Tamaño del userscript',
'Injection ceiling': 'Límite de inyección',
'Help': 'Ayuda',
'Open help and recovery': 'Abrir ayuda y recuperación',
'Chat updates resumed': 'Actualizaciones del chat reanudadas',
'Organize chat emotes': 'Organizar los emotes del chat',
'Continuously record emotes from live chat and Kick’s picker, then add favorites, removals, search, and custom groups.': 'Registra continuamente los emotes del chat en vivo y del selector de Kick, y añade favoritos, eliminaciones, búsqueda y grupos personalizados.',
'Click chat emotes to save': 'Haz clic en los emotes del chat para guardarlos',
'Click any emote in chat to add it to your favorites. If Kick explicitly marks it as follow-gated, the same click follows its source channel; subscriber access is never bypassed.': 'Haz clic en cualquier emote del chat para añadirlo a tus favoritos. Si Kick lo marca explícitamente como restringido a seguidores, el mismo clic sigue su canal de origen; el acceso de suscriptor nunca se omite.',
'Highlight chat keywords': 'Resaltar palabras clave del chat',
'Use the per-channel keyword list below without sending it anywhere.': 'Usa la lista de palabras clave por canal de abajo sin enviarla a ningún sitio.',
'Show playback diagnostics': 'Mostrar diagnósticos de reproducción',
'Show ready state, buffered seconds, and dropped-frame counts on a channel.': 'Muestra el estado de preparación, los segundos en búfer y los fotogramas perdidos en un canal.',
'Start playback without waiting for blocked ad scripts': 'Iniciar la reproducción sin esperar a los scripts de anuncios bloqueados',
'Kick waits on Google PAL, Datazoom, and OM before requesting playback. Blocking them, which this build does, leaves the dead script in the page and the player waits out the full timeout. Removing it lets playback start immediately.': 'Kick espera a Google PAL, Datazoom y OM antes de pedir la reproducción. Bloquearlos, lo que hace esta versión, deja el script muerto en la página y el reproductor agota todo el tiempo de espera. Quitarlo permite que la reproducción empiece de inmediato.',
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
'The emote could not be saved. The error log on the Content & Ads page says why.': 'No se pudo guardar el emote. El registro de errores de la página Contenido y anuncios dice por qué.',
'Open a channel page first.': 'Abre primero la página de un canal.',
'Local channel tools saved.': 'Herramientas locales del canal guardadas.',
'Local channel tools cleared.': 'Herramientas locales del canal borradas.',
'Enter a custom emote group name.': 'Escribe un nombre para el grupo personalizado de emotes.',
'The emote group limit is {limit}.': 'El límite de grupos de emotes es {limit}.',
'That emote group already exists.': 'Ese grupo de emotes ya existe.',
'Enter a valid emote group name.': 'Escribe un nombre de grupo de emotes válido.',
'Board saved.': 'Tablero guardado.',
'That board has no usable channels.': 'Ese tablero no tiene canales utilizables.',
'Channel name or kick.com link': 'Nombre del canal o enlace de kick.com',
'Multi-stream controls': 'Controles de transmisión múltiple',
'Name this board': 'Nombra este tablero',
'Board name': 'Nombre del tablero',
'Ready for your first channel': 'Listo para tu primer canal',
'Multi-stream workspace': 'Espacio de transmisión múltiple',
'Build your viewing board': 'Crea tu tablero de visualización',
'Add a channel above to start. Focus decides which stream owns audio and chat, and your saved boards stay on this device.': 'Añade un canal arriba para empezar. El enfoque decide qué stream controla el audio y el chat, y tus tableros guardados permanecen en este dispositivo.',
'Add your first channel': 'Añade tu primer canal',
'Add channel': 'Añadir canal',
'Save board': 'Guardar tablero',
'Saved boards will appear here.': 'Los tableros guardados aparecerán aquí.',
'Could not reach the clipboard. Check the clipboard permission for kick.com.': 'No se pudo acceder al portapapeles. Revisa el permiso del portapapeles para kick.com.',
'Cached blocklist removed.': 'Se eliminó la lista de bloqueo almacenada en caché.',
'Enter a channel name or URL.': 'Escribe un nombre de canal o una URL.',
'That does not look like a Kick channel.': 'Eso no parece un canal de Kick.',
'That channel is already hidden.': 'Ese canal ya está oculto.',
'Hidden channel list is full (200). Remove a channel before hiding another.': 'La lista de canales ocultos está llena (200). Quita un canal antes de ocultar otro.',
'Favorites cleared.': 'Favoritos borrados.',
'Not-interested channels restored.': 'Se restauraron los canales marcados como no interesantes.',
'Could not export settings. Check that your browser allows downloads from kick.com.': 'No se pudo exportar la configuración. Comprueba que tu navegador permita descargas desde kick.com.',
'Could not read that settings file. Pick a JSON file exported by Kick Focus.': 'No se pudo leer ese archivo de configuración. Elige un archivo JSON exportado por Kick Focus.',
'That backup is too large for this browser’s storage. Nothing was changed.': 'Esa copia de seguridad es demasiado grande para el almacenamiento de este navegador. No se cambió nada.',
'The import could not be saved. Your previous settings are unchanged.': 'No se pudo guardar la importación. Tu configuración anterior no ha cambiado.',
'Settings imported.': 'Configuración importada.',
'Previous settings backed up. Use Undo import to restore them.': 'Se hizo una copia de la configuración anterior. Usa Deshacer importación para restaurarla.',
' and {count} more': ' y {count} más',
'{count} more': '{count} más',
'Ignored unknown section "{key}".': 'Se ignoró la sección desconocida "{key}".',
'Ignored unknown setting "{path}".': 'Se ignoró la configuración desconocida "{path}".',
'Adjusted "{path}" to a supported value.': 'Se ajustó "{path}" a un valor compatible.',
'Upgraded from an unversioned file to schema {schema}.': 'Se actualizó un archivo sin versión al esquema {schema}.',
'Upgraded from schema {from} to schema {to}.': 'Se actualizó del esquema {from} al esquema {to}.',
'{count} emote could not be kept: {sample}{more}.': 'No se pudo conservar {count} emote: {sample}{more}.',
'{count} emotes could not be kept: {sample}{more}.': 'No se pudieron conservar {count} emotes: {sample}{more}.',
'Adjusted emote {field} to supported entries.': 'Se ajustó emote {field} a entradas compatibles.',
'Upgraded emotes to schema {schema}.': 'Se actualizaron los emotes al esquema {schema}.',
'Adjusted emote usage counts to {count} supported entries.': 'Se ajustaron los recuentos de uso de emotes a {count} entradas compatibles.',
'Adjusted the multi-stream grid to {count} supported channels.': 'Se ajustó la cuadrícula multitransmisión a {count} canales compatibles.',
'Adjusted saved boards to {count} supported entries.': 'Se ajustaron los diseños guardados a {count} entradas compatibles.',
'Left the blocklist subscription to {host} switched off. Turn it on yourself if you trust that host.': 'La suscripción a la lista de bloqueo de {host} se dejó desactivada. Actívala tú si confías en ese servidor.',
'Density saved': 'Densidad guardada',
'Content filter saved': 'Filtro de contenido guardado',
'Poor mode saved': 'Modo sin gastos guardado',
'No import to undo.': 'No hay ninguna importación que deshacer.',
'The backup could not be restored. Your current settings are unchanged.': 'No se pudo restaurar la copia de seguridad. Tu configuración actual no ha cambiado.',
'Import undone. Your previous settings are back.': 'Importación deshecha: tu configuración anterior está de vuelta.',
'Kick Focus restored.': 'Kick Focus restaurado.',
'Kick Focus paused. Use the Resume button or Ctrl+Shift+F to restore.': 'Kick Focus en pausa. Usa el botón Reanudar o Ctrl+Mayús+F para restaurarlo.',
'Settings reset': 'Configuración restablecida',
'Kick Focus restored': 'Kick Focus restaurado',
'Give this stream the audio and chat': 'Dar a esta transmisión el audio y el chat',
'Remove': 'Quitar',
'Clear search': 'Borrar la búsqueda',
'Campaign status': 'Estado de la campaña',
'No open campaigns': 'No hay campañas abiertas',
'Campaigns appear here when a reward is available.': 'Las campañas aparecen aquí cuando hay una recompensa disponible.',
'Browse eligible streams': 'Explorar transmisiones elegibles',
'View coming soon': 'Ver próximas campañas',
'Reward activity': 'Actividad de recompensas',
'Active': 'Activas',
'Claimed': 'Reclamadas',
'Expired': 'Caducadas',
'How drops work': 'Cómo funcionan los drops',
'Watch eligible streams': 'Ver transmisiones elegibles',
'Pick an active campaign.': 'Elige una campaña activa.',
'Track progress': 'Seguir el progreso',
'Keep watching to advance.': 'Sigue mirando para avanzar.',
'Claim your reward': 'Reclamar la recompensa',
'Claim it before time runs out.': 'Reclámala antes de que se acabe el tiempo.',
'Kick Focus command menu': 'Menú de comandos de Kick Focus',
'Kick Focus multi-stream': 'Multitransmisión de Kick Focus',
'Which chat to show': 'Qué chat mostrar',
'Live style preview': 'Vista previa del estilo en vivo',
'release, giveaway, raid': 'estreno, sorteo, raid',
'Chat keywords for this channel': 'Palabras clave del chat para este canal',
'Why I follow this channel…': 'Por qué sigo este canal…',
'Private channel note': 'Nota privada del canal',
'Search emotes or Kick groups': 'Buscar emotes o grupos de Kick',
'Search recorded emotes': 'Buscar emotes registrados',
'Filter recorded emotes': 'Filtrar emotes registrados',
'Group name': 'Nombre del grupo',
'Custom emote groups': 'Grupos personalizados de emotes',
'Group for selected emotes': 'Grupo para los emotes seleccionados',
'Select {name}': 'Seleccionar {name}',
'Deselect {name}': 'Deseleccionar {name}',
'Delete group {name}': 'Eliminar grupo {name}',
'New emote group name': 'Nombre del nuevo grupo de emotes',
'Channel name or kick.com URL': 'Nombre del canal o URL de kick.com',
'Channel to hide': 'Canal que ocultar',
'Open Kick Focus multi-stream': 'Abrir la multitransmisión de Kick Focus',
'Multi-stream': 'Multitransmisión',
'Stats': 'Estadísticas',
'Open {channel} stats in StreamerStats': 'Abrir las estadísticas de {channel} en StreamerStats',
'Opened {channel} in StreamerStats.': 'Se abrió {channel} en StreamerStats.',
'The browser blocked the stats popup.': 'El navegador bloqueó la ventana emergente de estadísticas.',
'Open tab': 'Abrir pestaña',
'Add this channel to Kick Focus multi-stream': 'Añadir este canal a la multitransmisión de Kick Focus',
'Add to multi-stream': 'Añadir a la multitransmisión',
'Undo': 'Deshacer',
'View': 'Ver',
'Your inventory holds {copies} {copiesWord} across {distinct} distinct {distinctWord}. That is {duplicates} {duplicatesWord}, or {rate}% of what you have pulled.': 'Tu inventario tiene {copies} {copiesWord} repartidos en {distinct} {distinctWord} distintos: {duplicates} {duplicatesWord}, es decir, el {rate}% de lo que has conseguido.',
'Your inventory holds {distinct} distinct {distinctWord}. Kick’s response carries no per-item quantity, so a duplicate rate cannot be measured from it. That number is unavailable rather than zero.': 'Tu inventario tiene {distinct} {distinctWord} distintos. La respuesta de Kick no incluye la cantidad por artículo, así que no se puede medir una tasa de duplicados a partir de ella: ese número no está disponible, no es cero.',
'emote name shadowed.': 'nombre de emote duplicado.',
'emote names shadowed.': 'nombres de emote duplicados.',
'result loaded': 'resultado cargado',
'results loaded': 'resultados cargados',
'emote': 'emote',
'emotes': 'emotes',
'collectible': 'coleccionable',
'collectibles': 'coleccionables',
'item': 'artículo',
'items': 'artículos',
'duplicate': 'duplicado',
'duplicates': 'duplicados',
'recorded emote has been changed by Kick since first capture. See the Changed by Kick filter in the library below.': 'emote registrado ha sido modificado por Kick desde su primera captura: consulta el filtro Modificados por Kick en la biblioteca de abajo.',
'recorded emotes have been changed by Kick since first capture. See the Changed by Kick filter in the library below.': 'emotes registrados han sido modificados por Kick desde su primera captura: consulta el filtro Modificados por Kick en la biblioteca de abajo.',
'channel hidden. These count toward the fail-open ceiling.': 'canal oculto. Cuenta para el límite de seguridad.',
'channels hidden. These count toward the fail-open ceiling.': 'canales ocultos. Cuentan para el límite de seguridad.',
'channel': 'canal',
'channels': 'canales',
'minute': 'minuto',
'minutes': 'minutos',
'time': 'vez',
'times': 'veces',
'Claim the daily reward automatically': 'Reclamar la recompensa diaria automáticamente',
'Opens Kick’s own reward dialog when one is waiting and clicks its claim button for you. It clicks nothing else: a reward Kick has not unlocked yet shows a disabled button, and this leaves it alone rather than trying. It waits until you are not typing, checks at most every ten minutes, and stops for the day once it claims. Signed-in only, because the reward button does not exist otherwise.': 'Abre el propio diálogo de recompensa de Kick cuando hay una esperando y pulsa su botón de reclamar por ti. No pulsa nada más: una recompensa que Kick aún no ha desbloqueado muestra un botón desactivado, y esto lo deja en paz en lugar de intentarlo. Espera a que no estés escribiendo, comprueba como mucho cada diez minutos y se detiene por hoy en cuanto reclama. Solo con sesión iniciada: el botón de recompensa no existe de otro modo.',
'Daily reward claimed. It is in your collectibles.': 'Recompensa diaria reclamada. Está en tus coleccionables.',
'Daily reward claimed.': 'Recompensa diaria reclamada.',
'Add open tabs ({count})': 'Añadir pestañas abiertas ({count})',
'Added {count} from your other tabs ({total} of {max})': 'Se añadieron {count} de tus otras pestañas: {total} de {max}',
'Added {count} channels from your other tabs.': 'Se añadieron {count} canales de tus otras pestañas.',
'Apply cycle cost': 'Coste del ciclo de aplicación',
'No apply cycle has run yet.': 'Aún no se ha ejecutado ningún ciclo de aplicación.',
'Type an emote name into chat': 'Escribir el nombre de un emote en el chat',
'Suggest emotes as you type': 'Sugerir emotes mientras escribes',
'Typing a colon and two or more letters in chat offers matching emotes from your library, ranked by what you actually send here. Click one to put its plain name at your cursor. Suggestions are clicked, never accepted with a key, so nothing you type is ever captured, and it never sends the message.': 'Al escribir dos puntos y dos o más letras en el chat se ofrecen emotes de tu biblioteca, ordenados según lo que realmente envías aquí. Haz clic en uno para poner su nombre simple en el cursor. Las sugerencias se eligen con el ratón, nunca con una tecla, así que nada de lo que escribes queda capturado, y nunca envía el mensaje.',
'Adds a Type in chat action beside Copy name in the emote library. It types the plain name at your cursor and stops. Never the wire token, never an id, and it never sends the message.': 'Añade una acción Escribir en el chat junto a Copiar nombre en la biblioteca de emotes. Escribe solo el nombre en la posición del cursor y se detiene ahí: nunca el código interno, nunca un id, y nunca envía el mensaje.',
'That emote has no plain name to copy.': 'Ese emote no tiene un nombre simple que copiar.',
'That emote has no plain name to type.': 'Ese emote no tiene un nombre simple que escribir.',
'Open a channel chat first.': 'Abre primero el chat de un canal.',
'Kick’s chat box did not accept the text. The name is on your clipboard instead.': 'El cuadro de chat de Kick no aceptó el texto. El nombre está en tu portapapeles.',
'Seen available': 'Visto como disponible',
'Seen in chat': 'Visto en el chat',
'Click to save': 'Haz clic para guardar',
'Saved. Click to open in the library': 'Guardado: haz clic para abrirlo en la biblioteca',
'Name shadowed by another set': 'Nombre eclipsado por otro conjunto',
'{count} of {max} streams': '{count} de {max} transmisiones',
},
pt: {
'Home': 'Início',
'Browse': 'Explorar',
'Following': 'A seguir',
'Saved views': 'Vistas guardadas',
'Keep the density, thumbnail size, rails, and content filters you like as a named view, and have it applied when you open the pages you chose. It is your own settings, applied to what Kick already sent. It changes nothing about what Kick recommends or the order anything appears in.': 'Guarda a densidade, o tamanho das miniaturas, as barras e os filtros de conteúdo que preferes como uma vista com nome, e aplica-a ao abrir as páginas que escolheres. São as tuas próprias definições aplicadas ao que a Kick já enviou. Não muda nada do que a Kick recomenda nem a ordem em que aparece.',
'Save this page as a view': 'Guardar esta página como vista',
'Pick the pages it should apply to, or none to keep it manual.': 'Escolhe as páginas onde deve aplicar-se, ou nenhuma para a deixar manual.',
'Save this view': 'Guardar esta vista',
'No saved views yet. Set the page up the way you want it, name it, and save.': 'Ainda não há vistas guardadas. Deixa a página como a queres, dá-lhe um nome e guarda.',
'Applied only when you press it': 'Aplica-se apenas quando a carregas',
'Currently applied': 'Aplicada agora',
'Applied {name} for this page.': 'Foi aplicada {name} nesta página.',
'{n} saved views is the limit. Delete one first.': 'O limite é {n} vistas guardadas. Apaga uma primeiro.',
'Saved {name}.': 'Foi guardada {name}.',
'Applied {name}. {n} settings changed.': 'Foi aplicada {name}. Mudaram {n} definições.',
'{name} is already what you are looking at.': '{name} é exatamente o que estás a ver.',
'Deleted {name}.': 'Foi apagada {name}.',
'Name the view before saving it.': 'Dá um nome à vista antes de a guardares.',
'Delete this saved view': 'Apagar esta vista guardada',
'Name this view': 'Nome da vista',
'Category pages': 'Páginas de categoria',
'Search results': 'Resultados da procura',
'Show message times': 'Mostrar a hora das mensagens',
'Reveals the timestamp Kick already renders on every message and keeps hidden. It is Kick’s own value, so scrolling back shows when a message was sent rather than when this build first saw it.': 'Mostra a marca de hora que a Kick já desenha em cada mensagem e mantém escondida. É o valor da própria Kick, por isso ao subir no chat vês quando a mensagem foi enviada e não quando esta extensão a viu.',
'People worth noticing': 'Pessoas que queres notar',
'Names you want to catch in a fast chat. Their messages get a marker of their own, separate from keyword highlights. Comma separated, and stored only in your settings.': 'Nomes que queres apanhar num chat rápido. As mensagens deles recebem uma marca própria, diferente dos destaques por palavra-chave. Separados por vírgulas e guardados apenas nas tuas definições.',
'Sound on a mention': 'Som quando te mencionam',
'A short tone when a message matches your highlights, comes from someone you listed, or says your name. Synthesised in the browser, so nothing is downloaded. Silent while the tab is in the background, silent for your own messages, and never more than once every few seconds.': 'Um tom curto quando uma mensagem corresponde aos teus destaques, vem de alguém da tua lista ou diz o teu nome. É gerado no navegador, por isso nada é transferido. Silencioso com o separador em segundo plano, silencioso nas tuas próprias mensagens e nunca mais do que uma vez a cada poucos segundos.',
'Hide a message for yourself': 'Esconder uma mensagem só para ti',
'Adds a small dismiss control to each message. It hides that message in your own browser for this session only, changes nothing for anyone else, and offers an undo.': 'Adiciona um pequeno controlo de dispensa a cada mensagem. Esconde essa mensagem no teu navegador apenas nesta sessão, não muda nada para os outros e oferece anular.',
'Recall my sent messages': 'Recordar as minhas mensagens enviadas',
'Keep the last five messages sent from this tab in memory. Shift+Up cycles them. Whispers are skipped, reload clears them, and ordinary Arrow Up stays with Kick.': 'Guarda na memória as últimas cinco mensagens enviadas neste separador. Shift+Cima percorre-as. Os sussurros são ignorados, recarregar apaga-as e a Seta para cima continua com o Kick.',
'Search this session’s chat': 'Procurar no chat desta sessão',
'Keeps what this tab has seen so you can find it again. It stays in memory, never reaches storage, and is gone on reload. Whispers are never recorded, and a message a moderator removes leaves the log the moment the deletion arrives.': 'Guarda o que este separador viu para que o possas encontrar outra vez. Fica em memória, nunca chega ao armazenamento e desaparece ao recarregar. Os sussurros nunca são guardados, e uma mensagem que um moderador apague sai do registo assim que a eliminação chega.',
'Session chat log': 'Registo do chat desta sessão',
'Hidden by you': 'Escondido por ti',
'Hide this message for me': 'Esconder esta mensagem para mim',
'Nothing in this session matches that.': 'Nada nesta sessão corresponde a isso.',
'Nothing recorded yet. Open a chat with the switch on.': 'Ainda não há nada guardado. Abre um chat com a opção ligada.',
'Saved {n} messages from this session.': 'Foram guardadas {n} mensagens desta sessão.',
'Message hidden for you. It is still there for everyone else.': 'Mensagem escondida para ti. Continua lá para toda a gente.',
'Session chat log cleared.': 'Registo do chat da sessão apagado.',
'message held. Capped at 400 messages, 200 KB, and one hour.': 'mensagem guardada. Com um limite de 400 mensagens, 200 KB e uma hora.',
'messages held. Capped at 400 messages, 200 KB, and one hour.': 'mensagens guardadas. Com um limite de 400 mensagens, 200 KB e uma hora.',
'name, name': 'nome, nome',
'Search what you have seen': 'Procura o que já viste',
'Save as a file': 'Guardar como ficheiro',
'Clear the log': 'Apagar o registo',
'Daily reward ready': 'Recompensa diária pronta',
'Viewer': 'Conta',
'Account readings and this browser session, in one place. Nothing here is claimed or sent anywhere.': 'Leituras da conta e esta sessão do navegador, reunidas num só lugar. Aqui nada é resgatado ou enviado.',
'Reading': 'Leituras',
'Reading…': 'A ler…',
'From Kick’s API': 'Da API da Kick',
'Read from the page': 'Lido da página',
'This browser session only': 'Apenas esta sessão do navegador',
'{n} min ago': 'há {n} min',
'Daily reward': 'Recompensa diária',
'Channel points': 'Pontos do canal',
'Collectibles': 'Colecionáveis',
'Drops': 'Drops',
'Level': 'Nível',
'Streak': 'Sequência',
'Session watch time': 'Tempo assistido nesta sessão',
'Not read yet on this page.': 'Ainda não foi lido nesta página.',
'Kick shows this to a signed-in account only.': 'A Kick só mostra isto a uma conta com sessão iniciada.',
'Open a channel to see its points.': 'Abre um canal para ver os seus pontos.',
'Open Drops to count the campaigns waiting.': 'Abre Drops para contar as campanhas pendentes.',
'Kick shows this inside the daily reward dialog only.': 'A Kick só mostra isto dentro da janela da recompensa diária.',
'The reward dialog did not show a figure this time.': 'Desta vez a janela da recompensa não mostrou nenhum número.',
'Kick did not answer that read. Nothing was changed.': 'A Kick não respondeu a essa leitura. Nada foi alterado.',
'This card could not be built. The rest of the hub is unaffected.': 'Este cartão não pôde ser construído. O resto da página não é afetado.',
'Claimed today': 'Resgatada hoje',
'Not ready yet': 'Ainda não está pronta',
'Ready to claim': 'Pronta para resgatar',
'Where these come from': 'De onde vêm estes dados',
'Nothing has been read yet. Each card above says why.': 'Ainda não foi lido nada. Cada cartão acima explica porquê.',
'Read again': 'Ler outra vez',
'Nothing is claimed for you here': 'Aqui nada é resgatado por ti',
'This page reads. The daily reward is still claimed by Kick’s own dialog, and only when you have turned that on under Content &amp; Ads. A card with no reading says so rather than showing a zero, because an empty balance and an unreadable one are not the same thing.': 'Esta página lê. A recompensa diária continua a ser resgatada pela própria janela da Kick, e só se tiveres ativado isso em Conteúdo e anúncios. Um cartão sem leitura di-lo em vez de mostrar um zero, porque um saldo vazio e um saldo ilegível não são a mesma coisa.',
'Settings': 'Configurações',
'Autosaved': 'Salvo automaticamente',
'Could not save': 'Não foi possível salvar',
'Imported': 'Importado',
'All settings reset': 'Todas as configurações foram redefinidas',
'Page reset': 'A página foi redefinida',
'Shortcuts restored': 'Atalhos restaurados',
'Shortcut saved': 'Atalho salvo',
'Added {name}. Now {count} of {max}.': '{name} foi adicionado. Agora {count} de {max}.',
'Removed {name}. Now {count} of {max}.': '{name} foi removido. Agora {count} de {max}.',
'Removed {name} from the grid.': '{name} foi removido da grade.',
'{name} added to the multi-stream grid': '{name} foi adicionado à grade multi-stream',
'The grid is full at {max} of {max}.': 'A grade está cheia com {max} de {max}.',
'The grid is full at {max} channels.': 'A grade está cheia com {max} canais.',
'{name} now has the audio': '{name} tem agora o áudio',
'Loaded board {name}': 'Painel {name} carregado',
'Copied a link to {name}.': 'Link para {name} copiado.',
'Opened a shared board with {count} {word}.': 'Foi aberto um painel compartilhado com {count} {word}.',
'The shared board replaced {count} {word} you had collected.': 'O painel compartilhado substituiu {count} {word} que você tinha reunido.',
'Loaded {count} emotes from {channel}.': 'Foram carregados {count} emotes de {channel}.',
'Kick Focus applied to {route}': 'Kick Focus aplicado a {route}',
'Content filtering suspended: it would have hidden {percent}% of this page.': 'Filtragem de conteúdo suspensa: teria ocultado {percent}% desta página.',
'Exported settings, {emotes} emotes, {counts} usage counts, {boards} boards, and your channels, notes, and filters.': 'Foram exportadas as configurações, {emotes} emotes, {counts} contagens de uso, {boards} painéis e seus canais, notas e filtros.',
'The emote was removed, but Kick could not unfollow {channel}.': 'O emote foi removido, mas a Kick não conseguiu deixar de seguir {channel}.',
'Saved {name}, but Kick did not identify the follow-gated source channel.': '{name} foi salvo, mas a Kick não identificou o canal de origem que exige seguir.',
'Saved {name}. Following {channel}…': '{name} foi salvo. Seguindo {channel}…',
'Saved {name} locally, but Kick could not follow {channel} ({status}). Sign in or reload the channel and try again.': '{name} foi salvo neste dispositivo, mas a Kick não conseguiu seguir {channel} ({status}). Entre na sua conta ou recarregue o canal e tente de novo.',
'Open multi-stream': 'Abrir multi-stream',
'Close multi-stream': 'Fechar multi-stream',
'emote id in card URL': 'o id do emote na URL da carta',
'emote name in card URL': 'o nome do emote na URL da carta',
'Use comfortable density': 'Usar densidade confortável',
'Use compact density': 'Usar densidade compacta',
'Recent': 'Recentes',
'New group': 'Novo grupo',
'Save': 'Salvar',
'Rename': 'Renomear',
'Delete': 'Excluir',
'Ungrouped': 'Sem grupo',
'Select shown': 'Selecionar visíveis',
'Clear': 'Limpar',
'Earlier': 'Antes',
'Later': 'Depois',
'Move': 'Mover',
'Groups': 'Grupos',
'Your emotes': 'Seus emotes',
'Library': 'Biblioteca',
'Favorites': 'Favoritos',
'All': 'Todos',
'Kick': 'Kick',
'Kick groups': 'Grupos da Kick',
'Kick’s original emote groups are shown below.': 'Os grupos de emotes originais da Kick aparecem abaixo.',
'No emotes found': 'Nenhum emote encontrado',
'Try a different search or clear the search field.': 'Tente outra busca ou limpe o campo de busca.',
'No favorites yet': 'Ainda não há favoritos',
'Open All and use the star on any emote to keep it here.': 'Abra Todos e use a estrela em qualquer emote para mantê-lo aqui.',
'No recent emotes yet': 'Ainda não há emotes recentes',
'Emotes you send in this channel will appear here.': 'Os emotes que você enviar neste canal aparecerão aqui.',
'Create your first group': 'Crie seu primeiro grupo',
'Use New group above, then select emotes and move them into it.': 'Use Novo grupo acima, depois selecione emotes e mova-os para ele.',
'This group is empty': 'Este grupo está vazio',
'Choose Organize, select emotes, then move them into this group.': 'Escolha Organizar, selecione emotes e mova-os para este grupo.',
'Try a different search or return to Kick groups.': 'Tente outra busca ou volte aos grupos da Kick.',
'{count} selected emote': '{count} emote selecionado',
'{count} selected emotes': '{count} emotes selecionados',
'Organize': 'Organizar',
'Remove this-channel favorite {name}': 'Remover {name} dos favoritos deste canal',
'Emote suggestions': 'Sugestões de emotes',
'Removed {name} from the grid ({count} of {max})': '{name} foi removido da grade ({count} de {max})',
'Added {name} to the grid ({count} of {max})': '{name} foi adicionado à grade ({count} de {max})',
'Add to Multi': 'Adicionar ao Multi',
'In Multi': 'No Multi',
'Add {name} to the multi-stream grid': 'Adicionar {name} à grade multi-stream',
'Remove {name} from the multi-stream grid': 'Remover {name} da grade multi-stream',
'Favorite {name}': 'Marcar {name} como favorito',
'Remove favorite {name}': 'Remover {name} dos favoritos',
'Not interested in {name}': 'Não tenho interesse em {name}',
'Restore {name}': 'Restaurar {name}',
'Remove {name}': 'Remover {name}',
'Restore': 'Restaurar',
'Remove favorite': 'Remover dos favoritos',
'Remove favorite (this channel)': 'Remover dos favoritos (este canal)',
'Use emote {name}': 'Usar o emote {name}',
'Select emote {name}': 'Selecionar o emote {name}',
'Use {name}': 'Usar {name}',
'{count} in {name}': '{count} em {name}',
'{shown} of {total} available': '{shown} de {total} disponíveis',
'{count} available': '{count} disponíveis',
', {count} locked by Kick': ', {count} bloqueados pela Kick',
'Created {name}. Select emotes, then move them into it.': '{name} foi criado. Selecione emotes e depois mova-os para ele.',
'Deleted emote group {name}.': 'O grupo de emotes {name} foi excluído.',
'Favorited {name}.': '{name} foi adicionado aos favoritos.',
'Removed {name} from favorites.': '{name} foi removido dos favoritos.',
'Restored {name}.': '{name} foi restaurado.',
'Removed {name}.': '{name} foi removido.',
'Emote group renamed.': 'O grupo de emotes foi renomeado.',
'Group name restored.': 'O nome do grupo foi restaurado.',
'Emote group restored.': 'O grupo de emotes foi restaurado.',
'Favorite order restored.': 'A ordem dos favoritos foi restaurada.',
'Emote group changes restored.': 'As alterações dos grupos de emotes foram restauradas.',
'Removed emotes restored.': 'Os emotes removidos foram restaurados.',
'Favorite change restored.': 'A alteração de favorito foi restaurada.',
'Emote changes reset.': 'As alterações de emotes foram redefinidas.',
'Favorite moved earlier.': 'O favorito foi movido para antes.',
'Favorite moved later.': 'O favorito foi movido para depois.',
'Emote moved earlier.': 'O emote foi movido para antes.',
'Emote moved later.': 'O emote foi movido para depois.',
'emote moved.': 'emote movido.',
'emotes moved.': 'emotes movidos.',
'emote removed.': 'emote removido.',
'emotes removed.': 'emotes removidos.',
'Move selected emotes to group': 'Mover os emotes selecionados para o grupo',
'Emote views': 'Visualizações de emotes',
'Kick rarity, matched by {basis}': 'Raridade da Kick, encontrada por {basis}',
'Insert {name}': 'Inserir {name}',
'Open {name} artwork': 'Abrir a imagem de {name}',
'Copy the name {name}': 'Copiar o nome {name}',
'Type the name {name} into chat': 'Digitar o nome {name} no chat',
'Custom group for {name}': 'Grupo personalizado para {name}',
'Rename {name}': 'Renomear {name}',
'Show {name} again': 'Mostrar {name} novamente',
'Open {name} on Kick': 'Abrir {name} na Kick',
'Remove {name} from the grid': 'Remover {name} da grade',
'Copy a link to board {name}': 'Copiar um link para o painel {name}',
'Delete board {name}': 'Excluir o painel {name}',
'Press keys, or Escape to cancel': 'Pressione as teclas, ou Escape para cancelar',
'{preset} preset applied': 'Predefinição {preset} aplicada',
'Hidden {channel}': '{channel} oculto',
'Showing {channel} again': '{channel} voltou a ser exibido',
'That file is not valid JSON.': 'Esse arquivo não contém JSON válido.',
'Settings must be a JSON object.': 'As configurações devem ser um objeto JSON.',
'Settings schema {schema} is newer than this build supports.': 'O esquema de configurações {schema} é mais recente do que esta versão aceita.',
'The emote library must be a JSON object.': 'A biblioteca de emotes deve ser um objeto JSON.',
'The emote usage counts must be a JSON object.': 'As contagens de uso de emotes devem ser um objeto JSON.',
'The multi-stream boards must be a JSON object.': 'Os layouts de multistream devem ser um objeto JSON.',
'Emote schema {schema} is newer than this build supports.': 'O esquema de emotes {schema} é mais recente do que esta versão aceita.',
'That file does not contain Kick Focus settings.': 'Esse arquivo não contém configurações do Kick Focus.',
'settings': 'configurações',
'emote library': 'biblioteca de emotes',
'emote usage counts': 'contagens de uso de emotes',
'multi-stream boards': 'layouts de multistream',
'per-channel layout': 'layout por canal',
'favorite channels': 'canais favoritos',
'not-interested channels': 'canais sem interesse',
'chat keyword filters': 'filtros de palavras-chave do chat',
'channel notes': 'notas de canais',
'volume and quality memory': 'memória de volume e qualidade',
'blocklist cache': 'cache da lista de bloqueio',
'watched this session': 'assistidos nesta sessão',
'Kick Focus could not save your {list}. Browser storage is full or blocked, so those changes exist only until you reload.': 'O Kick Focus não conseguiu salvar {list}. O armazenamento do navegador está cheio ou bloqueado, então essas alterações existirão apenas até você recarregar.',
'Kick Focus is using about {size} of browser storage. Nothing has failed to save this session.': 'O Kick Focus usa cerca de {size} do armazenamento do navegador. Nada falhou ao salvar nesta sessão.',
'The first paint reads {held} of your {total} emotes. The rest load from the database a moment later.': 'A primeira pintura lê {held} dos seus {total} emotes. O restante carrega do banco de dados um instante depois.',
'The browser reported': 'O navegador informou',
'Exporting now is the only way to keep these changes.': 'Exportar agora é a única forma de manter essas alterações.',
'{items} read from the page': '{items}, lidos da página',
'{items} from Kick’s API': '{items}, da API da Kick',
'{items} kept in this browser session': '{items}, guardado nesta sessão do navegador',
'{n} showing an older reading.': '{n} com uma leitura anterior.',
'{n} could not be built.': 'Não foi possível criar: {n}.',
'{shortcut} is already used by {action}.': '{shortcut} já é usado por {action}.',
'Added': 'Adicionado',
'Removed': 'Removido',
'Error log copied.': 'Log de erros copiado.',
'Could not copy the error log.': 'Não foi possível copiar o log de erros.',
'Diagnostic summary copied.': 'Resumo de diagnóstico copiado.',
'Clipboard access was unavailable.': 'O acesso à área de transferência não estava disponível.',
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
'This page has its own reset control': 'Esta página tem seu próprio controle de redefinição',
'Restore page defaults': 'Restaurar os padrões da página',
'Find a command': 'Buscar um comando',
'Type an action or setting…': 'Digite uma ação ou configuração…',
'Available commands': 'Comandos disponíveis',
'No matching commands': 'Nenhum comando correspondente',
'Try “chat”, “layout”, “casino”, or “settings”.': 'Tente “chat”, “layout”, “cassino” ou “configurações”.',
'command available': 'comando disponível',
'commands available': 'comandos disponíveis',
'Focus': 'Foco',
'Resume': 'Retomar',
'Resume Kick Focus': 'Retomar Kick Focus',
'Kick Focus settings': 'Configurações do Kick Focus',
'Layout': 'Layout',
'Appearance': 'Aparência',
'Content & Ads': 'Conteúdo e anúncios',
'Emotes': 'Emotes',
'Find, favorite, remove, and group every emote you have recorded.': 'Encontre, favorite, remova e agrupe todos os emotes registrados.',
'Accessibility & Shortcuts': 'Acessibilidade e atalhos',
'About': 'Sobre',
'Shell, player, and chat': 'Estrutura, player e chat',
'Theme, color, and scale': 'Tema, cor e escala',
'Privacy, filters, and playback': 'Privacidade, filtros e reprodução',
'Comfort and shortcuts': 'Conforto e atalhos',
'Read-only account signals': 'Sinais da conta somente para leitura',
'Status, privacy, and diagnostics': 'Status, privacidade e diagnósticos',
'Control how Kick is arranged across your desktop.': 'Controle como o Kick é organizado na sua área de trabalho.',
'Keep the page calm, private, and focused on streams.': 'Mantenha a página calma, privada e focada nas transmissões.',
'Improve comfort and keep core actions within reach.': 'Melhore o conforto e mantenha as ações principais ao alcance.',
'A desktop-first layout and control layer for Kick.': 'Uma camada de layout e controle para Kick pensada para desktop.',
'Language': 'Idioma',
'Auto': 'Automático',
'Sidebar mode': 'Modo da barra lateral',
'Left': 'Esquerda',
'Chat layout': 'Layout do chat',
'Chat width': 'Largura do chat',
'Chat width saved.': 'Largura do chat salva.',
'Content density': 'Densidade do conteúdo',
'Stream start behavior': 'Comportamento ao abrir transmissões',
'Remember per-channel layout': 'Lembrar layout por canal',
'Widen browse grids': 'Ampliar grades de descoberta',
'Show Following rail': 'Mostrar barra de Seguindo',
'Show Recommended rail': 'Mostrar barra de Recomendados',
'Hide Kick’s own controls': 'Ocultar os controles do próprio Kick',
'Switch off the player buttons and sidebar entries you never use. Each one is hidden with styling only. Nothing is clicked or removed, and turning it back on restores it immediately.': 'Desative os botões do player e os itens da barra lateral que você nunca usa. Cada um é ocultado apenas por estilo: nada é clicado ou removido, e ao reativar ele volta imediatamente.',
'Player controls': 'Controles do player',
'Sidebar': 'Barra lateral',
'Miniplayer': 'Minirreprodutor',
'Clip': 'Clipe',
'Theater mode': 'Modo cinema',
'Fullscreen': 'Tela cheia',
'Quality menu': 'Menu de qualidade',
'Volume': 'Volume',
'Share': 'Compartilhar',
'Report': 'Denunciar',
'Home link': 'Link de Início',
'Browse link': 'Link de Explorar',
'Following link': 'Link de Seguindo',
'Drops link': 'Link de Drops',
'Followed channel list': 'Lista de canais seguidos',
'Recommended channel list': 'Lista de canais recomendados',
'Sticky compact top bar': 'Barra superior compacta fixa',
'Show quick command button': 'Mostrar botão de comandos',
'Move mini-player clear of controls': 'Mover miniplayer para longe dos controles',
'Recover player after resize': 'Recuperar player após redimensionar',
'Keep ultrawide video uncropped': 'Manter vídeo ultrawide sem corte',
'Theme': 'Tema',
'Choose a clear visual direction, then tune only what matters to you.': 'Escolha uma direção visual clara e ajuste apenas o que importa para você.',
'Quick directions': 'Direções rápidas',
'Apply a viewing setup without changing filters or account choices.': 'Aplique uma configuração de visualização sem mudar filtros ou opções da conta.',
'Direction': 'Direção',
'Each theme changes the full surface hierarchy, not just the page background.': 'Cada tema muda toda a hierarquia de superfícies, não apenas o fundo da página.',
'Layered graphite': 'Grafite em camadas',
'Selected': 'Selecionado',
'Balanced depth with a quiet green undertone.': 'Profundidade equilibrada com um tom verde discreto.',
'True black': 'Preto real',
'Minimal lift and maximum contrast for dark rooms.': 'Elevação mínima e contraste máximo para ambientes escuros.',
'Cool graphite': 'Grafite frio',
'Blue-toned surfaces with stronger separation.': 'Superfícies azuladas com separação mais forte.',
'Use one accent for focus, selection, and live state.': 'Use um só destaque para foco, seleção e estado ao vivo.',
'Low-contrast choices fall back to a safe rose.': 'Opções de baixo contraste voltam para um rosa seguro.',
'Your current theme, accent, scale, and card treatment.': 'Seu tema, destaque, escala e tratamento de cartões atuais.',
'Accent color': 'Cor de destaque',
'Calm': 'Calmo',
'Cinema': 'Cinema',
'Chat First': 'Chat primeiro',
'Discovery': 'Descoberta',
'Roomier cards, quieter live color, and a compact rail.': 'Cartões mais espaçosos, cor ao vivo mais discreta e uma barra compacta.',
'OLED surfaces with the player first and chrome tucked away.': 'Superfícies OLED com o player em primeiro plano e os controles recolhidos.',
'A wider docked chat, compact density, and a clearer accent.': 'Um chat acoplado mais largo, densidade compacta e um destaque mais claro.',
'More stream cards, vivid thumbnails, and both discovery rails.': 'Mais cartões de transmissão, miniaturas vivas e as duas barras de descoberta.',
'Custom': 'Personalizado',
'Custom accent': 'Destaque personalizado',
'Custom accent color': 'Cor de destaque personalizada',
'Contrast protected': 'Contraste protegido',
'{preset} preset applied. Content filters were not changed.': 'A predefinição {preset} foi aplicada. Os filtros de conteúdo não mudaram.',
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
'Search': 'Pesquisar',
'Every page, searched at once.': 'Todas as páginas, pesquisadas de uma vez.',
'Try a shorter word, or the name of the Kick control you are looking for.': 'Tente uma palavra mais curta ou o nome do controle da Kick que procura.',
'Nothing matches “{query}”.': 'Nada corresponde a “{query}”.',
'Search settings': 'Pesquisar configurações',
'Kick Focus updated to {version}.': 'O Kick Focus foi atualizado para {version}.',
'Changed defaults: {list}.': 'Padrões que mudaram: {list}.',
'What changed': 'O que mudou',
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
'Choose how the left discovery rail behaves. Dropdown collapses it to a tab that expands on hover, giving the grid full width. Desktop widths only.': 'Escolha como a barra lateral de descoberta se comporta. Suspensa reduz a barra a uma aba que se expande ao passar o cursor, dando à grade toda a largura. Apenas em larguras de desktop.',
'Place chat on either side, float it as a dock, or hide it.': 'Coloque o chat em qualquer lado, como painel flutuante, ou oculte-o.',
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
'Emote already saved': 'O emote já estava salvo',
'Emote saved': 'Emote salvo',
'All streams paused': 'Todas as transmissões pausadas',
'All streams playing': 'Todas as transmissões em reprodução',
'All streams muted': 'Todas as transmissões sem som',
'Audio restored to the focused stream': 'Áudio restaurado na transmissão em foco',
'Focus mode on': 'Modo foco ativado',
'Focus mode off': 'Modo foco desativado',
'Theater mode on': 'Modo cinema ativado',
'Theater mode off': 'Modo cinema desativado',
'Chat hidden': 'Chat ocultado',
'Chat shown': 'Chat visível',
'Sidebar hidden': 'Barra lateral ocultada',
'Sidebar shown': 'Barra lateral visível',
'Mature thumbnails revealed': 'Miniaturas sensíveis visíveis',
'Mature thumbnails blurred': 'Miniaturas sensíveis desfocadas',
'Resume chat': 'Retomar chat',
'Pause chat': 'Pausar o chat',
'Resume chat updates': 'Retomar as atualizações do chat',
'Healthy': 'Tudo certo',
'Needs attention': 'Precisa de atenção',
'Multi': 'Multi',
'Play all': 'Reproduzir tudo',
'Pause all': 'Pausar tudo',
'Unmute': 'Ativar som',
'Mute all': 'Silenciar tudo',
'Remove {name} from Kick Focus multi-stream': 'Remover {name} do multi-stream do Kick Focus',
'Add {name} to Kick Focus multi-stream': 'Adicionar {name} ao multi-stream do Kick Focus',
'HTTPS JSON URL': 'URL JSON via HTTPS',
'Expected fields: channels, categories, and keywords. Unknown fields are rejected.': 'Campos esperados: channels, categories e keywords. Campos desconhecidos são rejeitados.',
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
'Show how long the stream has been live': 'Mostrar há quanto tempo a transmissão está ao vivo',
'Kick sends the start time with every channel and shows it nowhere. This reads that field and counts from it in the player corner, with no extra request and no polling.': 'O Kick envia o horário de início com cada canal e não o mostra em lugar nenhum. Isto lê esse campo e conta a partir dele no canto do player, sem requisições extras e sem sondagem.',
'Pop out chat': 'Chat em janela flutuante',
'Channel points: Kick says Picture-in-Picture and mirrored viewing do not accrue points. Keep a normal Kick player open when progress matters.': 'Pontos do canal: o Kick informa que Picture-in-Picture e visualização espelhada não acumulam pontos. Mantenha um player normal do Kick aberto quando o progresso for importante.',
'Merge all chats': 'Juntar todos os chats',
'Merged chat from every channel in the grid': 'Chat unificado de todos os canais da grelha',
'{live} of {total} chats live': '{live} de {total} chats ao vivo',
'One chat per tile': 'Um chat por canal',
'Read-only. Every channel in the grid, in the order messages arrived.': 'Apenas leitura. Todos os canais da grelha, na ordem em que as mensagens chegaram.',
'Showing one merged chat for every channel in the grid': 'A mostrar um chat unificado de todos os canais da grelha',
'Showing the focused channel chat': 'A mostrar o chat do canal em foco',
'Return chat': 'Devolver o chat',
'Kick Focus could not open the pop-out chat window.': 'A Kick Focus não conseguiu abrir a janela flutuante do chat.',
'Chat for {channel} opened in a floating window': 'O chat de {channel} abriu numa janela flutuante',
'Show how long Kick keeps this recording': 'Mostrar por quanto tempo a Kick guarda esta gravação',
'Kick deletes recordings after 7 days, or 30 for a verified channel, and shows that deadline nowhere. On a VOD page this reads the recording date from Kick’s own video list and counts down to it. It says nothing at all when the recording is older than the list Kick returns, or when the tier cannot be established. A guess between 7 and 30 days would be a confident wrong date.': 'A Kick apaga as gravações ao fim de 7 dias, ou 30 num canal verificado, e não mostra esse prazo em lado nenhum. Na página de um vídeo, isto lê a data da gravação da própria lista de vídeos da Kick e faz a contagem decrescente até lá. Não diz nada quando a gravação é mais antiga do que a lista que a Kick devolve, ou quando o nível não pode ser estabelecido. Adivinhar entre 7 e 30 dias seria dar uma data errada com toda a confiança.',
'{time} before Kick deletes this recording': '{time} antes de a Kick apagar esta gravação',
'Live for {duration}': 'Ao vivo há {duration}',
'{count} emotes usable in any chat': '{count} emotes utilizáveis em qualquer chat',
'subscribed channel': 'canal assinado',
'subscribed channels': 'canais assinados',
'your global sets': 'seus conjuntos globais',
'Kick reports no emotes this account can send anywhere.': 'O Kick não indica nenhum emote que esta conta possa enviar em qualquer chat.',
'My emotes': 'Meus emotes',
'My emotes ({count})': 'Meus emotes ({count})',
'Subscribed channel': 'Canal assinado',
'Global collection': 'Coleção global',
'Kick reports no emotes this account can use in every chat.': 'O Kick não indica nenhum emote que esta conta possa usar em todos os chats.',
'Sign in to Kick and open any channel once to load your owned emotes. Nothing is sent or changed.': 'Entre no Kick e abra qualquer canal uma vez para carregar seus emotes. Nada é enviado ou alterado.',
'Works in every chat': 'Funciona em todos os chats',
'Only works in its own channel': 'Só funciona no próprio canal',
'Only works in {channel}’s chat': 'Só funciona no chat de {channel}',
'Hide Subscribe, Gift Subs/Dubs, Get KICKs, gift-shop controls, and spend-based leaderboards. Follow, chat, and free daily rewards stay available.': 'Oculta Inscrever-se, Presentear subs/dubs, Obter KICKs, a loja de presentes e os placares de gastos. Seguir, o chat e as recompensas diárias gratuitas continuam disponíveis.',
'Enable Poor mode': 'Ativar modo sem gastos',
'Disable Poor mode': 'Desativar modo sem gastos',
'Remove spending prompts without changing your Kick account': 'Oculta os convites de gasto sem alterar sua conta do Kick',
'Channel emote catalog': 'Catálogo de emotes do canal',
'Loading…': 'Carregando…',
'Load emotes': 'Carregar emotes',
'Channel-only': 'Somente no canal',
'Subscriber-only': 'Somente para assinantes',
'Reduce tracking telemetry': 'Reduzir a telemetria de rastreamento',
'Block observed third-party video and error telemetry hosts.': 'Bloqueia os servidores de telemetria de vídeo e de erros de terceiros detectados.',
'Remember volume locally': 'Lembrar o volume localmente',
'Restore each channel’s volume and mute state from local storage.': 'Restaura o volume e o estado de mudo de cada canal a partir do armazenamento local.',
'Remember quality locally': 'Lembrar a qualidade localmente',
'Restore a matching quality control when Kick exposes one.': 'Restaura o controle de qualidade correspondente quando o Kick o oferece.',
'Always start at the highest quality': 'Sempre começar na qualidade mais alta',
'Open every stream at the best rung Kick offers, taking precedence over remembered quality. The rungs are learned from Kick’s own quality menu, so this does nothing until that menu has been opened once. It will not open it for you.': 'Abre cada transmissão na melhor opção que o Kick oferecer, com prioridade sobre a qualidade lembrada. As opções são aprendidas do próprio menu de qualidade do Kick, então isso não faz nada até que esse menu seja aberto uma vez: ele não será aberto para você.',
'Remember VOD position locally': 'Lembrar a posição do VOD localmente',
'Resume finite VODs from the last local playback position.': 'Retoma os VODs finitos a partir da última posição de reprodução local.',
'Pause chat updates': 'Pausar as atualizações do chat',
'Scrolling the transcript up freezes it, as does the button. Resume is always one control away.': 'Rolar a transcrição para cima congela o chat, assim como o botão. Retomar está sempre a um controle de distância.',
'Chat updates paused': 'Atualizações do chat pausadas',
'Userscript size': 'Tamanho do userscript',
'Injection ceiling': 'Limite de injeção',
'Help': 'Ajuda',
'Open help and recovery': 'Abrir ajuda e recuperação',
'Chat updates resumed': 'Atualizações do chat retomadas',
'Organize chat emotes': 'Organizar os emotes do chat',
'Continuously record emotes from live chat and Kick’s picker, then add favorites, removals, search, and custom groups.': 'Registra continuamente os emotes do chat ao vivo e do seletor do Kick, e adiciona favoritos, remoções, busca e grupos personalizados.',
'Click chat emotes to save': 'Clique nos emotes do chat para salvar',
'Click any emote in chat to add it to your favorites. If Kick explicitly marks it as follow-gated, the same click follows its source channel; subscriber access is never bypassed.': 'Clique em qualquer emote do chat para adicioná-lo aos favoritos. Se o Kick o marcar explicitamente como restrito a seguidores, o mesmo clique segue o canal de origem; o acesso de assinante nunca é contornado.',
'Highlight chat keywords': 'Destacar palavras-chave do chat',
'Use the per-channel keyword list below without sending it anywhere.': 'Usa a lista de palavras-chave por canal abaixo sem enviá-la a lugar nenhum.',
'Show playback diagnostics': 'Mostrar diagnósticos de reprodução',
'Show ready state, buffered seconds, and dropped-frame counts on a channel.': 'Mostra o estado de prontidão, os segundos em buffer e os quadros perdidos em um canal.',
'Start playback without waiting for blocked ad scripts': 'Iniciar a reprodução sem esperar pelos scripts de anúncios bloqueados',
'Kick waits on Google PAL, Datazoom, and OM before requesting playback. Blocking them, which this build does, leaves the dead script in the page and the player waits out the full timeout. Removing it lets playback start immediately.': 'O Kick espera por Google PAL, Datazoom e OM antes de solicitar a reprodução. Bloqueá-los, o que esta versão faz, deixa o script morto na página e o player aguarda todo o tempo limite. Removê-lo faz a reprodução começar imediatamente.',
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
'The emote could not be saved. The error log on the Content & Ads page says why.': 'Não foi possível salvar o emote. O registro de erros da página Conteúdo e anúncios diz por quê.',
'Open a channel page first.': 'Abra primeiro a página de um canal.',
'Local channel tools saved.': 'Ferramentas locais do canal salvas.',
'Local channel tools cleared.': 'Ferramentas locais do canal limpas.',
'Enter a custom emote group name.': 'Digite um nome para o grupo personalizado de emotes.',
'The emote group limit is {limit}.': 'O limite de grupos de emotes é {limit}.',
'That emote group already exists.': 'Esse grupo de emotes já existe.',
'Enter a valid emote group name.': 'Digite um nome de grupo de emotes válido.',
'Board saved.': 'Painel salvo.',
'That board has no usable channels.': 'Esse painel não tem canais utilizáveis.',
'Channel name or kick.com link': 'Nome do canal ou link do kick.com',
'Multi-stream controls': 'Controles de multistream',
'Name this board': 'Dê um nome a este painel',
'Board name': 'Nome do painel',
'Ready for your first channel': 'Pronto para o primeiro canal',
'Multi-stream workspace': 'Área de trabalho multistream',
'Build your viewing board': 'Monte seu painel de visualização',
'Add a channel above to start. Focus decides which stream owns audio and chat, and your saved boards stay on this device.': 'Adicione um canal acima para começar. O foco decide qual transmissão controla o áudio e o chat, e seus painéis salvos ficam neste dispositivo.',
'Add your first channel': 'Adicione seu primeiro canal',
'Add channel': 'Adicionar canal',
'Save board': 'Salvar painel',
'Saved boards will appear here.': 'Os painéis salvos aparecerão aqui.',
'Could not reach the clipboard. Check the clipboard permission for kick.com.': 'Não foi possível acessar a área de transferência. Verifique a permissão da área de transferência para kick.com.',
'Cached blocklist removed.': 'Lista de bloqueio em cache removida.',
'Enter a channel name or URL.': 'Digite um nome de canal ou uma URL.',
'That does not look like a Kick channel.': 'Isso não parece um canal do Kick.',
'That channel is already hidden.': 'Esse canal já está oculto.',
'Hidden channel list is full (200). Remove a channel before hiding another.': 'A lista de canais ocultos está cheia (200). Remova um canal antes de ocultar outro.',
'Favorites cleared.': 'Favoritos limpos.',
'Not-interested channels restored.': 'Canais marcados como sem interesse restaurados.',
'Could not export settings. Check that your browser allows downloads from kick.com.': 'Não foi possível exportar as configurações. Verifique se o navegador permite downloads de kick.com.',
'Could not read that settings file. Pick a JSON file exported by Kick Focus.': 'Não foi possível ler esse arquivo de configurações. Escolha um arquivo JSON exportado pelo Kick Focus.',
'That backup is too large for this browser’s storage. Nothing was changed.': 'Esse backup é grande demais para o armazenamento deste navegador. Nada foi alterado.',
'The import could not be saved. Your previous settings are unchanged.': 'Não foi possível salvar a importação. Suas configurações anteriores não foram alteradas.',
'Settings imported.': 'Configurações importadas.',
'Previous settings backed up. Use Undo import to restore them.': 'Foi feito backup das configurações anteriores. Use Desfazer importação para restaurá-las.',
' and {count} more': ' e mais {count}',
'{count} more': 'mais {count}',
'Ignored unknown section "{key}".': 'A seção desconhecida "{key}" foi ignorada.',
'Ignored unknown setting "{path}".': 'A configuração desconhecida "{path}" foi ignorada.',
'Adjusted "{path}" to a supported value.': '"{path}" foi ajustada para um valor compatível.',
'Upgraded from an unversioned file to schema {schema}.': 'Um arquivo sem versão foi atualizado para o esquema {schema}.',
'Upgraded from schema {from} to schema {to}.': 'O esquema {from} foi atualizado para o esquema {to}.',
'{count} emote could not be kept: {sample}{more}.': 'Não foi possível manter {count} emote: {sample}{more}.',
'{count} emotes could not be kept: {sample}{more}.': 'Não foi possível manter {count} emotes: {sample}{more}.',
'Adjusted emote {field} to supported entries.': 'O campo de emotes {field} foi ajustado para entradas compatíveis.',
'Upgraded emotes to schema {schema}.': 'Os emotes foram atualizados para o esquema {schema}.',
'Adjusted emote usage counts to {count} supported entries.': 'As contagens de uso de emotes foram ajustadas para {count} entradas compatíveis.',
'Adjusted the multi-stream grid to {count} supported channels.': 'A grade multistream foi ajustada para {count} canais compatíveis.',
'Adjusted saved boards to {count} supported entries.': 'Os layouts salvos foram ajustados para {count} entradas compatíveis.',
'Left the blocklist subscription to {host} switched off. Turn it on yourself if you trust that host.': 'A assinatura da lista de bloqueio de {host} ficou desativada. Ative você mesmo se confiar nesse servidor.',
'Density saved': 'Densidade salva',
'Content filter saved': 'Filtro de conteúdo salvo',
'Poor mode saved': 'Modo sem gastos salvo',
'No import to undo.': 'Não há importação para desfazer.',
'The backup could not be restored. Your current settings are unchanged.': 'Não foi possível restaurar o backup. Suas configurações atuais não foram alteradas.',
'Import undone. Your previous settings are back.': 'Importação desfeita: suas configurações anteriores voltaram.',
'Kick Focus restored.': 'Kick Focus restaurado.',
'Kick Focus paused. Use the Resume button or Ctrl+Shift+F to restore.': 'Kick Focus pausado. Use o botão Retomar ou Ctrl+Shift+F para restaurar.',
'Settings reset': 'Configurações redefinidas',
'Kick Focus restored': 'Kick Focus restaurado',
'Give this stream the audio and chat': 'Dar a esta transmissão o áudio e o chat',
'Remove': 'Remover',
'Clear search': 'Limpar a busca',
'Campaign status': 'Status da campanha',
'No open campaigns': 'Nenhuma campanha aberta',
'Campaigns appear here when a reward is available.': 'As campanhas aparecem aqui quando há uma recompensa disponível.',
'Browse eligible streams': 'Explorar transmissões elegíveis',
'View coming soon': 'Ver próximas campanhas',
'Reward activity': 'Atividade de recompensas',
'Active': 'Ativas',
'Claimed': 'Resgatadas',
'Expired': 'Expiradas',
'How drops work': 'Como os drops funcionam',
'Watch eligible streams': 'Assistir a transmissões elegíveis',
'Pick an active campaign.': 'Escolha uma campanha ativa.',
'Track progress': 'Acompanhar o progresso',
'Keep watching to advance.': 'Continue assistindo para avançar.',
'Claim your reward': 'Resgatar sua recompensa',
'Claim it before time runs out.': 'Resgate antes que o tempo acabe.',
'Kick Focus command menu': 'Menu de comandos do Kick Focus',
'Kick Focus multi-stream': 'Multitransmissão do Kick Focus',
'Which chat to show': 'Qual chat mostrar',
'Live style preview': 'Prévia do estilo ao vivo',
'release, giveaway, raid': 'lançamento, sorteio, raid',
'Chat keywords for this channel': 'Palavras-chave do chat para este canal',
'Why I follow this channel…': 'Por que eu sigo este canal…',
'Private channel note': 'Nota privada do canal',
'Search emotes or Kick groups': 'Buscar emotes ou grupos do Kick',
'Search recorded emotes': 'Buscar emotes registrados',
'Filter recorded emotes': 'Filtrar emotes registrados',
'Group name': 'Nome do grupo',
'Custom emote groups': 'Grupos personalizados de emotes',
'Group for selected emotes': 'Grupo para os emotes selecionados',
'Select {name}': 'Selecionar {name}',
'Deselect {name}': 'Desmarcar {name}',
'Delete group {name}': 'Excluir grupo {name}',
'New emote group name': 'Nome do novo grupo de emotes',
'Channel name or kick.com URL': 'Nome do canal ou URL do kick.com',
'Channel to hide': 'Canal a ocultar',
'Open Kick Focus multi-stream': 'Abrir a multitransmissão do Kick Focus',
'Multi-stream': 'Multitransmissão',
'Stats': 'Estatísticas',
'Open {channel} stats in StreamerStats': 'Abrir as estatísticas de {channel} no StreamerStats',
'Opened {channel} in StreamerStats.': '{channel} foi aberto no StreamerStats.',
'The browser blocked the stats popup.': 'O navegador bloqueou a janela de estatísticas.',
'Open tab': 'Abrir aba',
'Add this channel to Kick Focus multi-stream': 'Adicionar este canal à multitransmissão do Kick Focus',
'Add to multi-stream': 'Adicionar à multitransmissão',
'Undo': 'Desfazer',
'View': 'Ver',
'Your inventory holds {copies} {copiesWord} across {distinct} distinct {distinctWord}. That is {duplicates} {duplicatesWord}, or {rate}% of what you have pulled.': 'Seu inventário tem {copies} {copiesWord} distribuídos em {distinct} {distinctWord} distintos: {duplicates} {duplicatesWord}, ou seja, {rate}% do que você já obteve.',
'Your inventory holds {distinct} distinct {distinctWord}. Kick’s response carries no per-item quantity, so a duplicate rate cannot be measured from it. That number is unavailable rather than zero.': 'Seu inventário tem {distinct} {distinctWord} distintos. A resposta do Kick não traz a quantidade por item, então não é possível medir uma taxa de duplicatas a partir dela: esse número está indisponível, não é zero.',
'emote name shadowed.': 'nome de emote duplicado.',
'emote names shadowed.': 'nomes de emote duplicados.',
'result loaded': 'resultado carregado',
'results loaded': 'resultados carregados',
'emote': 'emote',
'emotes': 'emotes',
'collectible': 'colecionável',
'collectibles': 'colecionáveis',
'item': 'item',
'items': 'itens',
'duplicate': 'duplicata',
'duplicates': 'duplicatas',
'recorded emote has been changed by Kick since first capture. See the Changed by Kick filter in the library below.': 'emote registrado foi alterado pelo Kick desde a primeira captura: veja o filtro Alterados pelo Kick na biblioteca abaixo.',
'recorded emotes have been changed by Kick since first capture. See the Changed by Kick filter in the library below.': 'emotes registrados foram alterados pelo Kick desde a primeira captura: veja o filtro Alterados pelo Kick na biblioteca abaixo.',
'channel hidden. These count toward the fail-open ceiling.': 'canal oculto. Ele conta para o limite de segurança.',
'channels hidden. These count toward the fail-open ceiling.': 'canais ocultos. Eles contam para o limite de segurança.',
'channel': 'canal',
'channels': 'canais',
'minute': 'minuto',
'minutes': 'minutos',
'time': 'vez',
'times': 'vezes',
'Claim the daily reward automatically': 'Reivindicar a recompensa diária automaticamente',
'Opens Kick’s own reward dialog when one is waiting and clicks its claim button for you. It clicks nothing else: a reward Kick has not unlocked yet shows a disabled button, and this leaves it alone rather than trying. It waits until you are not typing, checks at most every ten minutes, and stops for the day once it claims. Signed-in only, because the reward button does not exist otherwise.': 'Abre o próprio diálogo de recompensa da Kick quando há uma à espera e clica no botão de reivindicar por você. Não clica em mais nada: uma recompensa que a Kick ainda não liberou mostra um botão desativado, e isto deixa-o em paz em vez de tentar. Espera até você não estar digitando, verifica no máximo a cada dez minutos e para por hoje assim que reivindica. Apenas com sessão iniciada, porque o botão de recompensa não existe de outra forma.',
'Daily reward claimed. It is in your collectibles.': 'Recompensa diária reivindicada. Está nos seus colecionáveis.',
'Daily reward claimed.': 'Recompensa diária reivindicada.',
'Add open tabs ({count})': 'Adicionar abas abertas ({count})',
'Added {count} from your other tabs ({total} of {max})': 'Foram adicionados {count} das suas outras abas: {total} de {max}',
'Added {count} channels from your other tabs.': 'Foram adicionados {count} canais das suas outras abas.',
'Apply cycle cost': 'Custo do ciclo de aplicação',
'No apply cycle has run yet.': 'Nenhum ciclo de aplicação foi executado ainda.',
'Type an emote name into chat': 'Digitar o nome de um emote no chat',
'Suggest emotes as you type': 'Sugerir emotes enquanto você digita',
'Typing a colon and two or more letters in chat offers matching emotes from your library, ranked by what you actually send here. Click one to put its plain name at your cursor. Suggestions are clicked, never accepted with a key, so nothing you type is ever captured, and it never sends the message.': 'Digitar dois-pontos e duas ou mais letras no chat oferece emotes da sua biblioteca, ordenados pelo que você realmente envia aqui. Clique em um para colocar o nome simples no seu cursor. As sugestões são escolhidas com o mouse, nunca aceitas com uma tecla, então nada do que você digita é capturado, e nunca envia a mensagem.',
'Adds a Type in chat action beside Copy name in the emote library. It types the plain name at your cursor and stops. Never the wire token, never an id, and it never sends the message.': 'Adiciona uma ação Digitar no chat ao lado de Copiar nome na biblioteca de emotes. Digita apenas o nome na posição do cursor e para por aí: nunca o código interno, nunca um id, e nunca envia a mensagem.',
'That emote has no plain name to copy.': 'Esse emote não tem um nome simples para copiar.',
'That emote has no plain name to type.': 'Esse emote não tem um nome simples para digitar.',
'Open a channel chat first.': 'Abra primeiro o chat de um canal.',
'Kick’s chat box did not accept the text. The name is on your clipboard instead.': 'A caixa de chat do Kick não aceitou o texto. O nome está na sua área de transferência.',
'Seen available': 'Visto como disponível',
'Seen in chat': 'Visto no chat',
'Click to save': 'Clique para salvar',
'Saved. Click to open in the library': 'Salvo: clique para abrir na biblioteca',
'Name shadowed by another set': 'Nome ofuscado por outro conjunto',
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
const TEXT_SOURCE = new WeakMap();
const ATTRIBUTE_SOURCE = new WeakMap();
function tr(value) {
const source = String(value);
return TRANSLATIONS[activeLocale()]?.[source] || source;
}
function plural(count, one, other) {
return tr(pluralForm(count, { one, other }, activeLocale()));
}
function trf(template, values) {
return tr(template).replace(/\{(\w+)\}/g, (whole, key) => (
Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole));
}
function applyInterfaceLanguage() {
const locale = activeLocale();
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
  setMarkup(shadow, `
    <button type="button" class="kf-quick" data-kf-quick data-action="open-settings" aria-label="Open Kick Focus settings">Focus</button>
    <div class="kf-backdrop" data-kf-settings-backdrop hidden>
      <section class="kf-settings" data-kf-settings-shell role="dialog" aria-modal="true" aria-labelledby="kf-settings-title">
        <header class="kf-header">
          <div class="kf-brand"><img class="kf-brand-mark" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAkElEQVR42u2XSwqAMAxEZ18P4L28/00E3QmKVPOfioHs2sxb5AtcrLVpi3T0LFq8C5ElfguRLX6CqBI/IIYDWNa562EAT8JaEESISyAgFfd+D89gmn+vASzJqgKwiEtiqAGs5WcC8OoBP8C4AOVJmFKG5Y2IohWXDyOKcUyxkFCsZN/dissPE4rTjOI4rTrPd9CSNAqXgFAlAAAAAElFTkSuQmCC" alt=""><span>Kick Focus</span><span class="kf-badge">Premium</span></div>
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
state.commandInput.addEventListener('input', renderCommands);
state.commandInput.addEventListener('keydown', onCommandKeydown);
shadow.querySelector('[data-kf-import]').addEventListener('change', onImportFile);
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
renderStorageWarning();
renderCommands();
applySettingsAttributes();
try {
if (typeof GM_registerMenuCommand === 'function') {
GM_registerMenuCommand('Open Kick Focus settings', () => openSettings());
GM_registerMenuCommand('Open Kick Focus commands', () => openCommandMenu());
}
} catch {
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
document.addEventListener('input', onComposerInput, true);
document.addEventListener('selectionchange', () => {
if (state.runtime.emoteCompletion) updateEmoteCompletion();
});
document.addEventListener('pointerdown', (event) => {
const row = event.target?.closest?.('#kick-focus-emote-complete');
if (!row) hideEmoteCompletion();
}, true);
multistreamPresenceChannel();
multistreamSyncChannel();
installMultistreamStorageSync();
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
function logAppError(context, error) {
const record = {
at: Date.now(),
context: String(context).slice(0, 80),
message: sanitizeErrorMessage(error?.message ?? error),
};
state.diagnostics.errors.unshift(record);
state.diagnostics.errors = state.diagnostics.errors.slice(0, 30);
state.diagnostics.lastCrash = record;
try { gmSet(LAST_CRASH_KEY, record); } catch {   }
const panel = state.shadow?.querySelector('[data-kf-error-log]');
if (panel) setMarkup(panel, errorLogRows());
const summary = state.shadow?.querySelector('[data-kf-last-crash]');
if (summary) summary.textContent = lastCrashSummary();
}
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
function readNumber(text) {
const raw = String(text ?? '').replace(/[\s,]/g, '');
if (!/^\d+$/.test(raw)) return null;
const value = Number(raw);
return Number.isFinite(value) ? value : null;
}
function readChannelPoints() {
const node = document.querySelector(POINTS_VALUE);
if (!node) return null;
const titled = node.querySelector('[title]')?.getAttribute('title') ?? node.getAttribute('title');
return readNumber(titled) ?? readNumber(node.textContent);
}
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
if (action === 'open-settings') openSettings();
else if (action === 'open-emotes') openSettings('emotes');
else if (action === 'open-command') openCommandMenu();
else if (action === 'toggle-panic') togglePanicSwitch();
else if (action === 'close-settings') closeSettings();
else if (action === 'reset-page') openResetConfirmation('page');
else if (action === 'reset-all') openResetConfirmation('all');
else if (action === 'cancel-reset') closeResetConfirmation();
else if (action === 'confirm-reset') confirmReset();
else if (action === 'export') exportSettings();
else if (action === 'help') {
state.settingsQuery = '';
const search = state.shadow?.querySelector('[data-kf-settings-search]');
if (search) search.value = '';
state.currentPage = 'about';
renderSettingsPage();
state.shadow?.querySelector('[data-kf-page]')?.focus();
}
else if (action === 'import') state.shadow.querySelector('[data-kf-import]').click();
else if (action === 'undo-import') undoImport();
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
state.viewerHub.collectibles = null;
refreshViewerCollectibles();
renderViewerHubInPlace();
}
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
else if (action === 'cancel-shortcut') {
state.shortcutCapture = null;
state.shortcutError = '';
renderSettingsPage();
} else if (action.startsWith('command:')) {
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
function clearSettingsSearch() {
clearTimeout(state.settingsSearchTimer);
state.settingsQuery = '';
const input = state.shadow?.querySelector('input[data-kf-settings-search]');
if (input && input.value) input.value = '';
}
function onInterfaceInput(event) {
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
clearTimeout(state.settingsSearchTimer);
const value = settingsSearch.value;
state.settingsSearchTimer = window.setTimeout(() => {
const query = String(value || '').trim();
if (query === state.settingsQuery) return;
state.settingsQuery = query;
renderSettingsPage();
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
function deepActiveElement() {
let node = document.activeElement;
while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
return node;
}
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
requestAnimationFrame(() => state.shadow.querySelector('[data-action="close-settings"]')?.focus());
}
function closeSettings() {
if (!state.modal || state.modal.hidden) return;
state.modal.hidden = true;
closeResetConfirmation();
state.shortcutCapture = null;
state.shortcutError = '';
if (!restoreFocus(state.lastFocused)) {
restoreFocus(state.headerControlHost?.shadowRoot?.querySelector('[data-kf-header-focus]'));
}
}
function openResetConfirmation(scope) {
state.resetPending = scope;
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
const opener = state.resetOpener;
state.resetOpener = null;
if (opener?.isConnected) {
try { opener.focus(); } catch {   }
} else {
try { state.shadow?.querySelector('[data-kf-page]')?.focus?.(); } catch {   }
}
}
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
function confirmReset() {
const scope = state.resetPending;
if (scope === 'all') {
state.settings = normalizeSettings(DEFAULT_SETTINGS);
gmDelete(STORAGE_KEY);
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
function applyImportedStores(result) {
const entries = [];
if (result.settings) entries.push([STORAGE_KEY, result.settings]);
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
const result = validateImportedSettings(await file.text(), { currentBlocklistUrl: state.settings.content.blocklistUrl });
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
gmSet(PRE_IMPORT_BACKUP_KEY, snapshot);
renderSettingsPage();
scheduleApply(0);
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
function undoImport() {
const backup = gmGet(PRE_IMPORT_BACKUP_KEY, null);
if (!backup) {
showToast('No import to undo.', true);
return;
}
const result = validateImportedSettings(JSON.stringify(backup), { trusted: true });
if (!result.ok) {
showToast('The backup could not be restored. Your current settings are unchanged.', true);
return;
}
const commit = applyImportedStores(result);
if (!commit.ok) {
showToast('The backup could not be restored. Your current settings are unchanged.', true);
return;
}
gmDelete(PRE_IMPORT_BACKUP_KEY);
renderSettingsPage();
scheduleApply(0);
showToast('Import undone. Your previous settings are back.');
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
const EMOTE_COMPLETION_LIMIT = 8;
const EMOTE_COMPLETION_CSS = `
  :host {
    position: fixed;
    z-index: 2147483000;
    display: none;
    width: 240px;
  }
  :host([data-kf-open="true"]) { display: block; }


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
    border: 1px solid var(--kf-border-strong, #2a3a30);
    border-radius: 9px;
    background: var(--kf-panel, #0b100d);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
    font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--kf-text, #f7f9fa);
    max-height: 260px;
    overflow-y: auto;
  }
  button {
    display: grid;
    grid-template-columns: 28px 1fr;
    align-items: center;
    gap: 8px;


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
list.setAttribute('role', 'listbox');
list.setAttribute('aria-label', tr('Emote suggestions'));
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
    <button type="button" role="option" aria-selected="false" data-kf-complete-key="${escapeHtml(sticker.key)}" title="${escapeHtml(trf('Insert {name}', { name: sticker.name }))}">
      <img src="${escapeHtml(sticker.src)}" alt="" loading="lazy">
      <span>${escapeHtml(sticker.name)}</span>
    </button>`).join(''));
state.runtime.emoteCompletion = { length: trigger.length, keys: matches.map((sticker) => sticker.key) };
if (anchorSurfaceTo(host, input, EMOTE_COMPLETION_ANCHOR) && openAnchoredSurface(host)) {
host.dataset.kfOpen = 'true';
host.style.visibility = 'visible';
return undefined;
}
const anchor = caretRect(input) || input.getBoundingClientRect();
host.dataset.kfOpen = 'true';
host.style.visibility = 'hidden';
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
return rect && (rect.width || rect.height || rect.top) ? rect : null;
}
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
const REWARD_TRIGGER = 'button[aria-label="Claim Your Daily Reward"]';
const REWARD_DIALOG = '[role="dialog"]';
function rewardDialog() {
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
function closeRewardDialog(dialog, restoreTo) {
if (dialog) {
delete dialog.dataset.kfRewardDialog;
const close = dialog.querySelector('button[aria-label*="close" i]');
if (close) close.click();
}
const trigger = document.querySelector(REWARD_TRIGGER);
if (trigger?.getAttribute('aria-expanded') === 'true') trigger.click();
if (restoreTo?.isConnected) restoreTo.focus?.();
}
function rewardRecord() {
const stored = gmGet(REWARD_STATE_KEY, null);
const record = isPlainRecord(stored) ? stored : {};
return {
lastClaimAt: Number(record.lastClaimAt) || 0,
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
const panelOpen = Boolean(state.modal && !state.modal.hidden);
if (multistreamOpen() || panelOpen || document.activeElement?.closest?.(
'[data-testid="chat-input"], #chat-input, div[contenteditable="true"][role="textbox"], input, textarea',
)) return;
writeRewardRecord({ nextCheckAt: now + CLAIM_RECHECK_MS });
state.reward.restoreFocusTo = document.activeElement;
trigger.click();
for (const dialog of document.querySelectorAll(REWARD_DIALOG)) {
if (dialog.contains(trigger)) continue;
dialog.dataset.kfRewardDialog = 'true';
}
return;
}
if (decision.action === 'wait') {
const dialogText = open.textContent || '';
const minutes = parseClaimCountdown(dialogText);
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
writeRewardRecord({
lastClaimAt: now,
claims: record.claims + 1,
nextCheckAt: nextRewardCheckAt({ outcome: 'claimed', now }),
});
state.reward.minutesRemaining = 0;
delete open.dataset.kfRewardDialog;
action.click();
  state.reward.lastMessage = `Daily reward claimed at ${new Date(now).toLocaleTimeString()}.`;
showToast('Daily reward claimed. It is in your collectibles.', false, [
{ label: 'View', onClick: () => window.open('https://kick.com/collectibles', '_blank', 'noopener') },
]);
announce('Daily reward claimed.');
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
function insertStickerName(target) {
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
state.profileStatsHost?.remove?.();
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
toast.setAttribute('role', isError ? 'alert' : 'status');
toast.setAttribute('aria-live', isError ? 'assertive' : 'polite');
toast.hidden = false;
clearTimeout(showToast.timer);
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
{ id: 'density', label: tr(state.settings.layout.density === 'compact' ? 'Use comfortable density' : 'Use compact density'), description: tr('Change discovery spacing and save it'), key: 'D' },
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
  if (count) count.textContent = `${commands.length} ${plural(commands.length, 'command available', 'commands available')}`;
setMarkup(state.commandList, commands.length
    ? commands.map((command, index) => `<button type="button" class="kf-command-item" role="option" aria-selected="${index === 0}" data-action="command:${command.id}" data-active="${index === 0}"><div><strong>${escapeHtml(command.label)}</strong><span>${escapeHtml(command.description)}</span></div><span class="kf-shortcut">${escapeHtml(command.key)}</span></button>`).join('')
: '<div class="kf-command-empty"><strong>No matching commands</strong><span>Try “chat”, “layout”, “casino”, or “settings”.</span></div>');
localizeInterface();
}
function openCommandMenu() {
if (!state.command) return;
const opener = deepActiveElement();
closeSettings();
state.commandOpener = opener;
state.command.hidden = false;
state.commandInput.value = '';
renderCommands();
requestAnimationFrame(() => state.commandInput.focus());
}
function closeCommandMenu() {
if (!state.command || state.command.hidden) return;
state.command.hidden = true;
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
if (event.key === 'Tab') return;
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
const labels = {
command: 'Open command menu',
focus: 'Toggle focus mode',
chat: 'Toggle chat',
sidebar: 'Toggle sidebar',
settings: 'Open settings',
mature: 'Reveal mature thumbnails',
};
state.shortcutError = trf('{shortcut} is already used by {action}.', {
shortcut,
action: tr(labels[conflictKey] || conflictKey),
});
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


  [data-kf-earned="reward-ready"] { position: relative; }
  [data-kf-earned="reward-ready"]::after {
    content: ''; position: absolute; top: 3px; right: 3px; width: 7px; height: 7px;
    border-radius: 50%; background: var(--kf-accent, #53fc18);
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
    background: var(--kf-panel-raised, #191e1b);
    color: var(--kf-text, #f4f7f5);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
    font: 700 14px/1 "Segoe UI", sans-serif;
    white-space: nowrap;
    cursor: pointer;
    transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease, transform 140ms ease;
  }
  button:hover {
    border-color: rgba(var(--kf-accent-rgb, 83, 252, 24), .62);
    background: rgba(var(--kf-accent-rgb, 83, 252, 24), .10);
    color: var(--kf-accent, #53fc18);
    transform: translateY(-1px);
  }
  button:active { transform: translateY(0) scale(.98); }
  button:focus-visible {
    border-color: var(--kf-accent, #53fc18);
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
try { popup.location.href = url; } catch {   }
}
showToast(trf('Opened {channel} in StreamerStats.', { channel: slug }));
return true;
}
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
else openSettings();
});
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
const accessibleLabel = tr(state.runtime.suspended ? 'Resume Kick Focus' : 'Open Kick Focus settings');
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
state.quickButton.dataset.action = 'open-settings';
state.quickButton.textContent = label;
state.quickButton.setAttribute('aria-label', accessibleLabel);
state.quickButton.hidden = !shouldShow || headerMounted;
syncEarnedState(accessibleLabel);
}
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
installPlayerLoadingFix();
installSpaHooks();
installCompanionBridge();
applySettingsAttributes();
applyQualitySessionKey();
function installCompanionBridge() {
document.addEventListener('kick-focus:request-settings', () => publishSettingsState());
document.addEventListener('kick-focus:open-settings', () => openSettings());
document.addEventListener('kick-focus:open-commands', () => openCommandMenu());
document.addEventListener('kick-focus:open-multistream', () => {
if (multistreamOpen()) closeMultistream();
else openMultistream();
});
document.addEventListener('kick-focus:set-telemetry', (event) => {
updateSetting('content.reduceTelemetry', Boolean(event.detail?.enabled));
});
handshakeCompanion();
openSharedLayoutFromUrl();
hydrateLibrary().catch((error) => logAppError('library hydrate', error));
}
function openSharedLayoutFromUrl() {
const shared = parseMultistreamLink(location.href);
if (!shared.length) return;
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
publishSettingsState();
announceUpdate();
}
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

})();
