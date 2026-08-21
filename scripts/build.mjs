import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AD_HOSTS, TELEMETRY_HOSTS, cancellableTelemetryHosts, VERSION } from '../src/core.mjs';
import { renderIcon } from './icons.mjs';
import { stripComments } from './strip-comments.mjs';
import { createZip } from './zip.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(resolve(root, relative), 'utf8');

const [metadata, core, api, compatibility, storage, live, multistream, runtime, appearancePreview] = await Promise.all([
  read('src/metadata.txt'),
  read('src/core.mjs'),
  read('src/api.mjs'),
  read('src/compatibility.mjs'),
  read('src/storage.mjs'),
  read('src/live.mjs'),
  read('src/multistream.mjs'),
  read('src/runtime.js'),
  readFile(resolve(root, 'src/assets/appearance-preview.jpg')),
]);

// One instance owns the page. Whichever target loads first wins, so having both
// the userscript and the companion extension installed cannot mount two UIs.
const GUARD = `if (window.__kickFocusBooted) return;\nwindow.__kickFocusBooted = true;\n`;

/**
 * Strip the module system, keep the code.
 *
 * The bundle is one function scope, so a name a module imports is already in
 * scope by the time that module's text arrives — the concat order below is what
 * guarantees it. Imports are therefore removed rather than resolved, which is
 * what lets a bundled module declare its real dependencies as `import` and stay
 * loadable on its own under `node --test`, instead of relying on the bundle's
 * hoisting to supply symbols nothing names.
 *
 * check.mjs asserts no `import`/`export` statement survives into the artifact.
 *
 * Comments go too. They are a fifth of the source and the userscript has a real
 * ceiling — see SIZE_BUDGETS in check.mjs — while the artifact is generated and
 * nobody edits it. The prose stays in `src/`, where it is read.
 */
const bundled = (source) => stripComments(source)
  .replace(/^import\s[\s\S]*?from\s+'[^']*';[^\S\n]*\n/gm, '')
  .replace(/^export\s+/gm, '');

const bundledCore = bundled(core);
const bundledApi = bundled(api);
const bundledCompatibility = bundled(compatibility);
const bundledStorage = bundled(storage);
const bundledLive = bundled(live);
const iconData = `data:image/png;base64,${renderIcon(32).toString('base64')}`;
const bundledMultistream = bundled(multistream)
  .replaceAll('__KICK_FOCUS_ICON__', iconData);
const bundledRuntime = stripComments(runtime)
  .replaceAll('__KICK_FOCUS_ICON__', iconData)
  .replaceAll('__KICK_FOCUS_PREVIEW__', `data:image/jpeg;base64,${appearancePreview.toString('base64')}`);
// Concat order is the dependency order: everything a module imports must have
// been declared by an earlier entry in this list.
const body = `(() => {\n'use strict';\n${GUARD}${bundledCore}\n${bundledApi}\n${bundledCompatibility}\n${bundledStorage}\n${bundledLive}\n${bundledMultistream}\n${bundledRuntime}\n})();\n`;

await mkdir(resolve(root, 'dist'), { recursive: true });
const userscript = `${metadata.replaceAll('__VERSION__', VERSION)}${body}`;
await writeFile(resolve(root, 'dist/kick-focus.user.js'), userscript, 'utf8');
// Printed every build so the growth trend is visible in the log rather than
// only when the budget gate in check.mjs finally trips. The userscript is the
// one with a real ceiling — see SIZE_BUDGETS there for the number and why.
console.log(`Built dist/kick-focus.user.js (${userscript.length.toLocaleString('en-US')} bytes)`);

// ---------------------------------------------------------------------------
// Companion extension
// ---------------------------------------------------------------------------

const RESOURCE_TYPES = [
  'script', 'xmlhttprequest', 'image', 'sub_frame', 'ping',
  'media', 'font', 'stylesheet', 'websocket', 'other',
];

/**
 * Rules are generated from the same host lists the page-realm classifier uses,
 * so the two layers cannot drift apart, and are scoped to kick.com initiators:
 * the companion never changes how any other site loads.
 */
function ruleset(hosts, startId) {
  return hosts.map((host, index) => ({
    id: startId + index,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: `||${host}^`,
      initiatorDomains: ['kick.com'],
      resourceTypes: RESOURCE_TYPES,
    },
  }));
}

const extensionRoot = resolve(root, 'dist/extension');
await rm(extensionRoot, { recursive: true, force: true });
for (const directory of ['content', 'rules', 'icons']) {
  await mkdir(resolve(extensionRoot, directory), { recursive: true });
}

const manifest = (await read('src/extension/manifest.json')).replaceAll('__VERSION__', VERSION);
// Dev manifest adds declarativeNetRequestFeedback for onRuleMatchedDebug counter.
// The release manifest omits it so Chrome does not show "Read your browsing history".
const devManifestObj = JSON.parse(manifest);
devManifestObj.permissions.push('declarativeNetRequestFeedback');
const files = [
  ['manifest.json', manifest],
  ['manifest.dev.json', `${JSON.stringify(devManifestObj, null, 2)}\n`],
  ['background.js', await read('src/extension/background.js')],
  ['popup.html', await read('src/extension/popup.html')],
  ['popup.js', await read('src/extension/popup.js')],
  ['content/bridge.js', await read('src/extension/bridge.js')],
  ['content/kick-focus.js', `/* Kick Focus ${VERSION} — generated from src/. Edit the source, not this file. */\n${body}`],
  ['rules/ads.json', `${JSON.stringify(ruleset(AD_HOSTS, 1), null, 2)}\n`],
  // litix.io is intentionally excluded from the network-layer cancel set: a
  // hard block there triggers a retry storm. The page realm answers it empty-200.
  ['rules/telemetry.json', `${JSON.stringify(ruleset(cancellableTelemetryHosts(), 1000), null, 2)}\n`],
];

for (const [name, contents] of files) {
  await writeFile(resolve(extensionRoot, name), contents, 'utf8');
}

for (const size of [16, 32, 48, 128]) {
  await writeFile(resolve(extensionRoot, `icons/icon-${size}.png`), renderIcon(size));
}

console.log(`Built dist/extension/ (${AD_HOSTS.length} ad rules, ${cancellableTelemetryHosts().length} telemetry rules)`);

// Load-unpacked works straight from dist/extension; the archive is for sharing.
async function collectFrom(base, directory = '', prefix = '') {
  const entries = await readdir(resolve(base, directory || '.'), { withFileTypes: true });
  const collected = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) collected.push(...await collectFrom(base, relative, relative));
    else collected.push({ name: relative, data: await readFile(resolve(base, relative)) });
  }
  return collected;
}

const collect = (directory, prefix = '') => collectFrom(extensionRoot, directory, prefix);

// Previous artifacts go before the new one is written, so dist never offers two
// versions of the same package.
for (const entry of await readdir(resolve(root, 'dist'))) {
  if (/^kick-focus-extension-v.*\.zip$/.test(entry)) await rm(resolve(root, 'dist', entry));
}

const archive = resolve(root, `dist/kick-focus-extension-v${VERSION}.zip`);
// manifest.dev.json is a load-unpacked convenience (it adds
// declarativeNetRequestFeedback for the debug counter); it must not ship inside
// the release archive, which would otherwise carry the extra permission.
const archiveFiles = (await collect('')).filter((file) => file.name !== 'manifest.dev.json');
await writeFile(archive, createZip(archiveFiles));
console.log(`Built dist/kick-focus-extension-v${VERSION}.zip`);

// ---------------------------------------------------------------------------
// Firefox companion extension (Manifest V2)
// ---------------------------------------------------------------------------

const firefoxRoot = resolve(root, 'dist/extension-firefox');
await rm(firefoxRoot, { recursive: true, force: true });
for (const directory of ['content', 'icons']) {
  await mkdir(resolve(firefoxRoot, directory), { recursive: true });
}

// Firefox host permissions are generated from the same host lists that drive
// the page-realm classifier, replacing the former <all_urls> with enumerated
// hosts so the install prompt names only the sites the extension touches.
const generatedHostPerms = [...AD_HOSTS, ...cancellableTelemetryHosts()]
  .map((host) => `*://*.${host}/*`);
const firefoxManifestRaw = (await read('src/extension/manifest.firefox.json')).replaceAll('__VERSION__', VERSION);
const firefoxManifestObj = JSON.parse(firefoxManifestRaw.replace(
  /\s*"__GENERATED_HOST_PERMISSIONS__"/,
  generatedHostPerms.map((p) => `\n    ${JSON.stringify(p)}`).join(','),
));
const firefoxManifest = `${JSON.stringify(firefoxManifestObj, null, 2)}\n`;
const firefoxBackground = (await read('src/extension/background.firefox.js'))
  .replace('__AD_HOSTS__', JSON.stringify(AD_HOSTS))
  .replace('__TELEMETRY_HOSTS__', JSON.stringify(cancellableTelemetryHosts()));
/**
 * The Firefox bridge carries the page bundle as a string rather than fetching it.
 *
 * MV2 content scripts are isolated, so the page bundle has to be injected — and
 * the obvious way, a `<script src=runtime.getURL(...)>`, puts
 * `moz-extension://<uuid>/…` into the page. Firefox's extension UUID is
 * randomised per install and stable for its life, so any script on kick.com
 * could read it as a tracking identifier that survives clearing cookies. That is
 * a supercookie shipped by a build whose whole posture is privacy.
 *
 * Embedding the source and assigning it to `textContent` means the extension's
 * URL never enters the page, and it lets `web_accessible_resources` be dropped
 * altogether. `JSON.stringify` does the escaping, so nothing in the bundle —
 * backslashes, backticks, `${`, or a literal `</script>` — can break out.
 * Assigning to `textContent` rather than `innerHTML` also means the browser
 * never re-parses the text as markup.
 */
const firefoxBridge = (await read('src/extension/bridge.firefox.js'))
  // A replacer *function*, not a string: the bundle contains `$&`, `` $` `` and
  // `$'` sequences, and String.replace would interpret those in a replacement
  // string and splice pieces of the file into itself.
  .replace('"__PAGE_BUNDLE__"', () => JSON.stringify(`/* Kick Focus ${VERSION} — generated from src/. Edit the source, not this file. */\n${body}`));
if (firefoxBridge.includes('__PAGE_BUNDLE__')) {
  throw new Error('Firefox bridge still carries the __PAGE_BUNDLE__ placeholder — the page script would be empty.');
}

const firefoxFiles = [
  ['manifest.json', firefoxManifest],
  ['background.js', firefoxBackground],
  ['popup.html', await read('src/extension/popup.html')],
  ['popup.js', await read('src/extension/popup.js')],
  ['content/bridge.js', firefoxBridge],
];

for (const [name, contents] of firefoxFiles) {
  await writeFile(resolve(firefoxRoot, name), contents, 'utf8');
}

for (const size of [16, 32, 48, 128]) {
  await writeFile(resolve(firefoxRoot, `icons/icon-${size}.png`), renderIcon(size));
}

console.log(`Built dist/extension-firefox/ (${AD_HOSTS.length} ad hosts, ${cancellableTelemetryHosts().length} telemetry hosts)`);

for (const entry of await readdir(resolve(root, 'dist'))) {
  if (/^kick-focus-firefox-v.*\.zip$/.test(entry)) await rm(resolve(root, 'dist', entry));
}

const firefoxArchive = resolve(root, `dist/kick-focus-firefox-v${VERSION}.zip`);
await writeFile(firefoxArchive, createZip(await collectFrom(firefoxRoot)));
console.log(`Built dist/kick-focus-firefox-v${VERSION}.zip`);
