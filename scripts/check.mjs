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
const firefoxManifest = await readJson('dist/extension-firefox/manifest.json');
const firefoxContent = await read('dist/extension-firefox/content/kick-focus.js');
const firefoxBridge = await read('dist/extension-firefox/content/bridge.js');
const firefoxBackground = await read('dist/extension-firefox/background.js');

const mainWorld = manifest.content_scripts.find((entry) => entry.world === 'MAIN');
const isolated = manifest.content_scripts.find((entry) => entry.world === 'ISOLATED');
const ruleFiles = manifest.declarative_net_request.rule_resources;

const checks = [
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
  ['labels the sticker shelf as account-authorized', source.includes('New Kick stickers save automatically')
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

  ['reports storage writes that fail instead of losing data', source.includes('noteStorageResult')
    && source.includes('describeStorageFailures')
    && source.includes('data-kf-storage-alert')
    && source.includes('renderStorageHealthPanel')],

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
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`Check failed: ${label}`);
  console.log(`OK ${label}`);
}
console.log(`${checks.length} checks passed.`);
