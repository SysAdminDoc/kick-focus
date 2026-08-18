/**
 * Live proof for the Firefox (Manifest V2) companion.
 *
 * The Chromium gate in verify-extension.mjs drives CDP; Firefox does not speak
 * CDP well enough to load an extension, so this drives **WebDriver BiDi**, which
 * Firefox exposes on `--remote-debugging-port` and which can install an
 * *unsigned temporary* add-on through `webExtension.install`. That is the only
 * way to exercise this package: Firefox Release refuses unsigned XPIs
 * permanently, so the MV2 build had never been executed anywhere.
 *
 * Zero dependencies, like everything else here — Node has WebSocket built in.
 *
 * The load-bearing assertion is the last one. The bridge used to inject the page
 * bundle from a `moz-extension://<uuid>/…` URL, and that UUID is generated per
 * install and never changes, so any script on kick.com could read it as a
 * tracking identifier that survives clearing cookies. The bundle is now carried
 * inside the bridge as source; this proves the address never reaches the page,
 * in a real Firefox, rather than by reading the diff.
 *
 *   node scripts/verify-firefox.mjs [url]
 *
 * Skips rather than fails when no Firefox is installed, matching the Chromium
 * gate's contract so a machine without one can still run the offline suite.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, rm, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = process.argv[2] || 'https://kick.com/';
const PORT = Number(process.env.KF_FIREFOX_PORT || 9333);
const EXTENSION = resolve(root, 'dist/extension-firefox');
const ALLOW_NO_FIREFOX = process.env.KF_ALLOW_NO_FIREFOX === '1';

const CANDIDATES = [
  process.env.FIREFOX_PATH,
  'C:/Program Files/Mozilla Firefox/firefox.exe',
  'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
  '/usr/bin/firefox',
  '/Applications/Firefox.app/Contents/MacOS/firefox',
].filter(Boolean);

async function findFirefox() {
  for (const candidate of CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch { /* try the next one */ }
  }
  return '';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (label, ok, detail = '') => {
  results.push({ label, ok, outcome: ok ? 'pass' : 'fail' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};
const skip = (label, why) => {
  results.push({ label, ok: true, outcome: 'skip' });
  console.log(`SKIP  ${label} — ${why}`);
};

const FIREFOX = await findFirefox();
if (!FIREFOX) {
  console.log(`${ALLOW_NO_FIREFOX ? 'SKIP' : 'FAIL'}  No Firefox found. Install one, or set FIREFOX_PATH.`);
  process.exit(ALLOW_NO_FIREFOX ? 0 : 1);
}

const profile = await mkdtemp(join(tmpdir(), 'kick-focus-firefox-'));
const child = spawn(FIREFOX, [
  '--profile', profile,
  '--remote-debugging-port', String(PORT),
  '--headless',
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk; });
child.stdout.on('data', () => {});

/** Minimal WebDriver BiDi client: one socket, id-matched replies, event log. */
function bidi(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const events = [];
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) {
      events.push(msg);
    }
  });
  let nextId = 1;
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = nextId += 1;
    pending.set(id, (msg) => (msg.error ? rej(new Error(`${method}: ${msg.error} ${msg.message || ''}`)) : res(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`${method}: timed out`)); } }, 45000);
  });
  return { ready, send, events, close: () => ws.close() };
}

/** Wait for the BiDi socket to come up, and read its URL out of the log. */
async function bidiUrl() {
  for (let i = 0; i < 60; i += 1) {
    const match = stderr.match(/WebDriver BiDi listening on (ws:\/\/\S+)/);
    if (match) return match[1];
    await sleep(500);
  }
  return '';
}


/**
 * The per-install UUID Firefox assigns this add-on, read out of the profile.
 *
 * `webExtension.install` returns the add-on id (`kick-focus@sysadmindoc`), which
 * is not what a `moz-extension://` URL is keyed by. Firefox stores the mapping
 * in `prefs.js` under `extensions.webextensions.uuids`.
 */
async function extensionUuid(addonId) {
  if (!addonId) return '';
  for (let i = 0; i < 20; i += 1) {
    try {
      const prefs = await readFile(join(profile, 'prefs.js'), 'utf8');
      const line = prefs.match(/user_pref\("extensions\.webextensions\.uuids",\s*"(.*)"\);/);
      if (line) {
        const map = JSON.parse(line[1].replace(/\\"/g, '"'));
        if (map[addonId]) return map[addonId];
      }
    } catch { /* the pref file is written lazily */ }
    await sleep(500);
  }
  return '';
}

let client = null;
try {
  const url = await bidiUrl();
  if (!url) throw new Error('Firefox never reported a WebDriver BiDi endpoint');
  client = bidi(`${url}/session`);
  await client.ready;

  await client.send('session.new', { capabilities: { alwaysMatch: {} } });
  await client.send('session.subscribe', { events: ['log.entryAdded', 'network.beforeRequestSent', 'network.responseCompleted', 'network.fetchError'] });
  record('Firefox WebDriver BiDi session established', true, url);

  // An unsigned MV2 package installs as a *temporary* add-on, which is the only
  // route Firefox Release allows and the reason this gate can exist at all.
  const installed = await client.send('webExtension.install', {
    extensionData: { type: 'path', path: EXTENSION },
  });
  record('the unsigned Manifest V2 package installs as a temporary add-on', Boolean(installed?.extension), installed?.extension || '');

  const tree = await client.send('browsingContext.getTree', {});
  const context = tree?.contexts?.[0]?.context;
  if (!context) throw new Error('no browsing context');

  await client.send('browsingContext.navigate', { context, url: TARGET, wait: 'complete' });
  await sleep(6000);

  const evaluate = async (expression) => {
    const res = await client.send('script.evaluate', {
      expression,
      target: { context },
      awaitPromise: true,
      resultOwnership: 'none',
      userActivation: false,
    });
    if (res?.type === 'exception') return { error: res.exceptionDetails?.text || 'exception' };
    return { value: res?.result?.value };
  };

  const reached = await evaluate('Boolean(document.querySelector("#main-container, [data-testid=\\"main-container\\"], main"))');
  const onKick = reached.value === true;
  record('reached the real Kick page (not a bot wall)', onKick, `kick shell present=${reached.value}`);

  const booted = await evaluate('Boolean(window.__kickFocusBooted)');
  record('the page bundle ran in the page world', booted.value === true);

  const companion = await evaluate('document.documentElement.dataset.kickFocusCompanion || ""');
  record('the bridge advertised the companion to the page', Boolean(companion.value), `v${companion.value}`);

  const mounted = await evaluate('Boolean(document.getElementById("kick-focus-root"))');
  record('the interface mounted', mounted.value === true);

  // The whole point of carrying the bundle inside the bridge. A per-install UUID
  // in the page is a tracking identifier that outlives cookie clearing, so this
  // checks the two places it could still surface: the DOM, and the resource
  // timeline, which records a src= load even after the element is removed.
  const leak = await evaluate(`(() => {
    const inMarkup = document.documentElement.outerHTML.includes('moz-extension://');
    const scripts = [...document.querySelectorAll('script')].map((s) => s.src).filter(Boolean);
    const timed = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.startsWith('moz-extension://'));
    return JSON.stringify({
      inMarkup,
      scriptSrcs: scripts.filter((s) => s.startsWith('moz-extension://')).length,
      timed: timed.length,
      sample: timed[0] || '',
    });
  })()`);
  const leaked = JSON.parse(leak.value || '{}');
  record('no extension URL reaches the page, in markup or the resource timeline',
    leaked.inMarkup === false && leaked.scriptSrcs === 0 && leaked.timed === 0,
    `markup=${leaked.inMarkup} script src=${leaked.scriptSrcs} resource entries=${leaked.timed}${leaked.sample ? ` e.g. ${leaked.sample}` : ''}`);

  // webRequestBlocking is the MV2 network layer and the one capability the
  // Chromium build gets from declarativeNetRequest instead. Firefox only
  // cancels for a Kick initiator, so this has to be requested from the page.
  if (onKick) {
    // A <link rel=preload>, not fetch(): the page-realm hooks patch fetch, XHR
    // and setAttribute, and answer a blocked host with an empty 200. A probe
    // that goes through them measures the page layer and says nothing about
    // webRequest — which is the only thing this gate exists to prove. The same
    // reasoning is why the Chromium gate uses a preload for its DNR proof.
    const before = client.events.length;
    const PROBE = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js?kfprobe=1';
    await evaluate(`(() => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = ${JSON.stringify(PROBE)};
      document.head.appendChild(link);
      return true;
    })()`);
    await sleep(5000);
    const probeEvents = client.events.slice(before).filter((e) => String(e.params?.request?.url || '').includes('securepubads'));
    const failed = probeEvents.filter((e) => e.method === 'network.fetchError');
    const completed = probeEvents.filter((e) => e.method === 'network.responseCompleted');
    record('an ad host preloaded by the Kick page is refused by the network layer',
      failed.length > 0 && completed.length === 0,
      failed.length
        ? `fetchError: ${failed.map((e) => e.params?.errorText || 'blocked').join('|')}`
        : `seen ${probeEvents.length} events for the probe, ${completed.length} completed`);
  } else {
    skip('an ad host preloaded by the Kick page is refused by the network layer',
      'the run never reached a real Kick page, so no Kick-initiated request could be made');
  }

  // The popup is its own document. It regressed once by using a Chromium-only
  // promise API and rendered static defaults on Firefox forever.
  // The popup is its own document, and WebDriver BiDi will not navigate a tab to
  // a `moz-extension://` URL — "Navigation to … is not allowed in this context".
  // So this cannot be asserted from out here, and it is reported as a skip
  // rather than quietly dropped. What it would have covered is already held by
  // two other gates: check.mjs asserts the popup uses the browser-or-chrome
  // shim (the defect that once made the Firefox popup render static defaults
  // forever), and the Chromium gate drives the same popup document live.
  const uuid = await extensionUuid(installed?.extension || '');
  skip('the popup renders live state rather than static defaults',
    `WebDriver BiDi refuses to navigate to moz-extension://${uuid || '<uuid>'}/popup.html; covered by the shim gate in check.mjs and by the Chromium popup checks`);

  const failures = results.filter((r) => r.outcome === 'fail');
  const skipped = results.filter((r) => r.outcome === 'skip');
  const asserted = results.filter((r) => r.outcome !== 'skip');
  console.log(`\n${asserted.length - failures.length}/${asserted.length} checks passed${skipped.length ? `, ${skipped.length} skipped` : ''}.`);
  if (failures.length) {
    console.log(`Failed: ${failures.map((f) => f.label).join('; ')}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error('VERIFY ERROR:', error.message);
  console.error(stderr.split('\n').filter((l) => /error|warn|bidi/i.test(l)).slice(0, 10).join('\n'));
  process.exitCode = 1;
} finally {
  client?.close();
  child.kill('SIGKILL');
  await sleep(600);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
