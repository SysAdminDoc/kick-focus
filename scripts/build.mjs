import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AD_HOSTS, TELEMETRY_HOSTS, cancellableTelemetryHosts, VERSION } from '../src/core.mjs';
import { renderIcon } from './icons.mjs';
import { compactCssTemplates, stripComments } from './strip-comments.mjs';
import { createZip } from './zip.mjs';
import { requireSupportedEngine } from './engine.mjs';

requireSupportedEngine();

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(resolve(root, relative), 'utf8');

const [metadata, core, api, compatibility, storage, live, multistream, settings, runtime, appearancePreview] = await Promise.all([
  read('src/metadata.txt'),
  read('src/core.mjs'),
  read('src/api.mjs'),
  read('src/compatibility.mjs'),
  read('src/storage.mjs'),
  read('src/live.mjs'),
  read('src/multistream.mjs'),
  read('src/settings.mjs'),
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
const bundled = (source) => compactCssTemplates(stripComments(source))
  .replace(/^import\s[\s\S]*?from\s+'[^']*';[^\S\n]*\n/gm, '')
  .replace(/^export\s+/gm, '');

const bundledCore = bundled(core);
const bundledApi = bundled(api);
const bundledCompatibility = bundled(compatibility);
const bundledStorage = bundled(storage);
const bundledLive = bundled(live);
const iconData = `data:image/png;base64,${renderIcon(32).toString('base64')}`;
const previewData = `data:image/jpeg;base64,${appearancePreview.toString('base64')}`;
const bundledMultistream = bundled(multistream)
  .replaceAll('__KICK_FOCUS_ICON__', iconData);
const bundledSettings = bundled(settings)
  .replaceAll('__KICK_FOCUS_PREVIEW__', previewData);
const bundledRuntime = compactCssTemplates(stripComments(runtime))
  .replaceAll('__KICK_FOCUS_ICON__', iconData)
  .replaceAll('__KICK_FOCUS_PREVIEW__', previewData);
// Concat order is the dependency order: everything a module imports must have
// been declared by an earlier entry in this list.
const body = `(() => {\n'use strict';\n${GUARD}${bundledCore}\n${bundledApi}\n${bundledCompatibility}\n${bundledStorage}\n${bundledLive}\n${bundledMultistream}\n${bundledSettings}\n${bundledRuntime}\n})();\n`;

await mkdir(resolve(root, 'dist'), { recursive: true });
/**
 * Tell the artifact how big it is, without changing how big it is.
 *
 * The placeholder is replaced by a space-padded number of exactly the same
 * width, so the length measured before the stamp is still the length after it.
 * Doing it the obvious way — stamp, then measure — would report a number that
 * was already wrong by the width of the difference, and About would be
 * confidently off by a few bytes forever.
 */
const BYTES_PLACEHOLDER = '__KICK_FOCUS_BYTES__';
const stampBytes = (text, bytes) => text.replaceAll(BYTES_PLACEHOLDER, String(bytes).padStart(BYTES_PLACEHOLDER.length));
const unstampedUserscript = `${metadata.replaceAll('__VERSION__', VERSION)}${body}`;
const userscriptBytes = Buffer.byteLength(unstampedUserscript, 'utf8');
const userscript = stampBytes(unstampedUserscript, userscriptBytes);
if (userscript.includes(BYTES_PLACEHOLDER)
  || userscript.length !== unstampedUserscript.length
  || Buffer.byteLength(userscript, 'utf8') !== userscriptBytes) {
  throw new Error('the byte stamp changed the artifact length, so the number it carries is wrong');
}
await writeFile(resolve(root, 'dist/kick-focus.user.js'), userscript, 'utf8');
// Printed every build so the growth trend is visible in the log rather than
// only when the budget gate in check.mjs finally trips. The userscript is the
// one with a real ceiling — see SIZE_BUDGETS there for the number and why.
console.log(`Built dist/kick-focus.user.js (${userscriptBytes.toLocaleString('en-US')} bytes)`);

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
const extensionLocales = ['en', 'es', 'pt_BR'];
for (const directory of ['content', 'rules', 'icons', ...extensionLocales.map((locale) => `_locales/${locale}`)]) {
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
  ['content/kick-focus.js', stampBytes(`/* Kick Focus ${VERSION} — generated from src/. Edit the source, not this file. */\n${body}`, userscript.length)],
  ['rules/ads.json', `${JSON.stringify(ruleset(AD_HOSTS, 1), null, 2)}\n`],
  // litix.io is intentionally excluded from the network-layer cancel set: a
  // hard block there triggers a retry storm. The page realm answers it empty-200.
  ['rules/telemetry.json', `${JSON.stringify(ruleset(cancellableTelemetryHosts(), 1000), null, 2)}\n`],
  ...await Promise.all(extensionLocales.map(async (locale) => (
    [`_locales/${locale}/messages.json`, await read(`src/extension/_locales/${locale}/messages.json`)]
  ))),
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
for (const directory of ['content', 'icons', ...extensionLocales.map((locale) => `_locales/${locale}`)]) {
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
 * The Firefox page bundle is its own file, declared with `world: "MAIN"`.
 *
 * It used to be carried inside the bridge as a JSON string and assigned to a
 * `<script>`'s textContent. That was to avoid the obvious approach,
 * `<script src=runtime.getURL(...)>`, which puts `moz-extension://<uuid>/…`
 * into the page: Firefox's extension UUID is randomised per install and stable
 * for its life, so any script on kick.com could read it as a tracking
 * identifier that survives clearing cookies.
 *
 * A manifest-declared MAIN-world content script avoids both. The browser
 * injects it into the page's realm, so no extension URL enters the page, no
 * `web_accessible_resources` entry is needed, and the page's own CSP does not
 * apply to it — which the inline version did depend on, since kick.com shipping
 * a `script-src` without 'unsafe-inline' would have stopped it loading.
 */
const firefoxBridge = await read('src/extension/bridge.firefox.js');
if (firefoxBridge.includes('__PAGE_BUNDLE__')) {
  throw new Error('The Firefox bridge still carries a __PAGE_BUNDLE__ placeholder; the page bundle is its own file now.');
}

const firefoxFiles = [
  ['manifest.json', firefoxManifest],
  ['background.js', firefoxBackground],
  ['popup.html', await read('src/extension/popup.html')],
  ['popup.js', await read('src/extension/popup.js')],
  ['content/bridge.js', firefoxBridge],
  ['content/kick-focus.js', stampBytes(`/* Kick Focus ${VERSION} — generated from src/. Edit the source, not this file. */\n${body}`, userscript.length)],
  ...await Promise.all(extensionLocales.map(async (locale) => (
    [`_locales/${locale}/messages.json`, await read(`src/extension/_locales/${locale}/messages.json`)]
  ))),
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
