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
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`Check failed: ${label}`);
  console.log(`OK ${label}`);
}
console.log(`${checks.length} checks passed.`);
