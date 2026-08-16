import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AD_HOSTS, TELEMETRY_HOSTS, VERSION } from '../src/core.mjs';

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

const mainWorld = manifest.content_scripts.find((entry) => entry.world === 'MAIN');
const isolated = manifest.content_scripts.find((entry) => entry.world === 'ISOLATED');
const ruleFiles = manifest.declarative_net_request.rule_resources;

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
  ['userscript reports the companion layer', source.includes('kickFocusCompanion')],
  ['extension requests no broad host access', manifest.host_permissions.every((entry) => entry.includes('kick.com'))],
  ['extension loads only local scripts', manifest.content_scripts
    .flatMap((entry) => entry.js)
    .every((file) => !/^(https?:)?\/\//.test(file))],
  ['extension declares no remote code', !('externally_connectable' in manifest)
    && !JSON.stringify(manifest.background).includes('//')],

  // Network rules stay in lockstep with the page-realm blocklist
  ['ad ruleset covers every blocked host', adRules.length === AD_HOSTS.length],
  ['telemetry ruleset covers every telemetry host', telemetryRules.length === TELEMETRY_HOSTS.length],
  ['ad rules block', adRules.every((rule) => rule.action.type === 'block')],
  ['every rule is scoped to kick.com', [...adRules, ...telemetryRules]
    .every((rule) => rule.condition.initiatorDomains?.includes('kick.com'))],
  ['rule ids are unique', new Set([...adRules, ...telemetryRules].map((rule) => rule.id)).size
    === adRules.length + telemetryRules.length],
  ['ads ruleset ships enabled', ruleFiles.find((entry) => entry.id === 'ads')?.enabled === true],
  ['telemetry ruleset ships opt-in', ruleFiles.find((entry) => entry.id === 'telemetry')?.enabled === false],

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
  // The trailing slash matters: without it the lookahead accepts a lookalike
  // host like kick.com.evil.net, and this gate would pass on exfiltration.
  ['every API endpoint stays on kick.com', !/https:\/\/(?!(?:web\.|files\.|ext\.cdn\.)?kick\.com\/)[a-z0-9.-]+\/api\//i.test(source)],
  ['gives High Contrast a real focus outline', source.includes('forced-colors: active')
    && source.includes('outline: 3px solid Highlight')],
  ['page-realm hooks do not announce themselves', source.includes('function disguise(')
    && source.includes('[native code]')],

  // The release manifest drops declarativeNetRequestFeedback to avoid the
  // "Read your browsing history" Chrome warning.  The counter in background.js
  // already degrades — it shows "—" in the popup when the debug API is absent.
  ['release manifest omits the feedback permission', !manifest.permissions.includes('declarativeNetRequestFeedback')],
  ['dev manifest provides the feedback permission', devManifest.permissions.includes('declarativeNetRequestFeedback')],

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
  ['Firefox enumerates every ad and telemetry host', [...AD_HOSTS, ...TELEMETRY_HOSTS]
    .every((host) => firefoxManifest.permissions.some((perm) => perm.includes(host)))],
  ['Firefox declares no data collection', firefoxManifest.browser_specific_settings?.gecko
    ?.data_collection_permissions?.required?.[0] === 'none'],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`Check failed: ${label}`);
  console.log(`OK ${label}`);
}
console.log(`${checks.length} checks passed.`);
