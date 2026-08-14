import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VERSION } from '../src/core.mjs';

const file = resolve('dist/kick-focus.user.js');
const source = await readFile(file, 'utf8');
const checks = [
  ['metadata starts at byte zero', source.startsWith('// ==UserScript==')],
  ['version is synchronized', source.includes(`// @version      ${VERSION}`)],
  ['runs at document-start', source.includes('// @run-at       document-start')],
  ['targets Kick HTTPS', source.includes('// @match        https://kick.com/*')],
  ['contains no remote code dependency', !/@require\s|@resource\s/i.test(source)],
  ['ships settings UI', source.includes('data-kf-settings-shell')],
  ['ships SPA lifecycle hook', source.includes('kick-focus:routechange')],
  ['ships ad request classification', source.includes('classifyRequest')],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`Check failed: ${label}`);
  console.log(`OK ${label}`);
}
