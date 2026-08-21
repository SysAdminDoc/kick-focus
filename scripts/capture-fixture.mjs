/**
 * Maintainer-only: turn a live Kick page into a small sanitized DOM fixture.
 *
 * The hand-written shells under `test/fixtures/` are what the offline shape
 * checks read, and until now they could only be hand-edited — so the day Kick
 * changed its markup, the fixtures said what Kick used to look like and nothing
 * noticed. This regenerates one from the real page.
 *
 * It is deliberately not part of `npm run verify`. It talks to the live site,
 * needs a headed browser, and rewrites files a human should look at.
 *
 *   node scripts/capture-fixture.mjs                 # every reachable route, dry run
 *   node scripts/capture-fixture.mjs home channel    # just these
 *   node scripts/capture-fixture.mjs home --write    # actually replace the fixture
 *
 * Two rules it holds itself to:
 *
 *  1. **It refuses to write a fixture that would fail `test/fixtures.test.js`.**
 *     A regenerated fixture that quietly dropped a marker would turn a real
 *     drift signal into a green test, which is worse than a stale fixture. When
 *     a marker is missing it says which of two things happened, because they
 *     call for opposite responses: the live page carries it and the reduction
 *     lost it (this script's bug, usually the sibling cap), or the live page
 *     does not carry it at all (drift in Kick, or a marker the hand-written
 *     fixture invented and Kick never served).
 *
 *  2. **Nothing personal survives.** Only structural attributes are kept, text
 *     is replaced with a placeholder, and every URL is reduced to its path. The
 *     gate runs logged out, so there is little to leak, but a fixture is a file
 *     that gets committed and read for years.
 *
 * Which routes it can reach, what to keep from each, and the markers a fixture
 * must not lose all come from `scripts/fixture-contract.mjs`. Anything the
 * contract gives no URL is hand-maintained: `drops` and `sticker-scroll` need a
 * session, and `chat` carries scaffolding that simulates an incoming sticker,
 * which a capture of the real page would delete.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { LOCATOR_PROBES } from '../src/compatibility.mjs';
import { CAPTURABLE, FIXTURE_CONTRACT } from './fixture-contract.mjs';

const PORT = Number(process.env.KF_CAPTURE_PORT || 9481);

/**
 * Which routes can be captured, and what to keep from each.
 *
 * Both come from `scripts/fixture-contract.mjs`, so this file, the offline test
 * and the live drift sweep cannot disagree about what a fixture is a fixture
 * of. A contract entry with no `url` is hand-maintained — either it needs a
 * session (`drops`, `sticker-scroll`) or it carries scaffolding a capture would
 * delete (`chat` simulates an incoming sticker, and Kick has no such button).
 */
const ROUTES = Object.fromEntries(CAPTURABLE.map((name) => [name, FIXTURE_CONTRACT[name]]));

/** Attributes a shape check can legitimately depend on. Everything else goes. */
const KEEP_ATTRIBUTES = /^(id|class|role|href|lang|hidden|type|value|data-.*|aria-.*)$/;
/** How many repeats of a list item to keep — two proves "a list", 42 proves nothing. */
const SIBLING_CAP = 2;

async function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = join(homedir(), 'AppData/Local/ms-playwright');
  let entries = [];
  try {
    entries = await readdir(root);
  } catch {
    return null;
  }
  const builds = entries
    .filter((name) => name.startsWith('chromium-') && !name.includes('headless'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const build of builds) {
    for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome']) {
      const candidate = join(root, build, rel);
      try {
        await stat(candidate);
        return candidate;
      } catch {
        // Try the next layout.
      }
    }
  }
  return null;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const rest = async (path) => (await fetch(`http://127.0.0.1:${PORT}${path}`)).json();

let nextId = 1;
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  return {
    ready,
    send(method, params = {}) {
      const id = nextId += 1;
      return new Promise((res) => {
        pending.set(id, res);
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => ws.close(),
  };
}

async function evaluate(client, expression) {
  const res = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) return { error: res.result.exceptionDetails.text };
  return { value: res.result?.result?.value };
}

const REDUCER = `(() => {
  const KEEP_ATTRIBUTES = ${KEEP_ATTRIBUTES};
  const SIBLING_CAP = ${SIBLING_CAP};
  const probeSelectors = ${JSON.stringify([...new Set(Object.values(LOCATOR_PROBES).flat().map((probe) => probe.selector))])};
  const extra = __KEEP__;

  const keep = new Set();
  const markKeep = (node) => {
    for (let walk = node; walk && walk.nodeType === 1; walk = walk.parentElement) keep.add(walk);
  };
  for (const selector of probeSelectors.concat(extra)) {
    let found = [];
    try { found = [...document.querySelectorAll(selector)]; } catch { found = []; }
    // Only the first few of anything repeated: two cards prove a card list.
    for (const node of found.slice(0, SIBLING_CAP)) markKeep(node);
  }
  if (!keep.size) return { ok: false, why: 'nothing on this route matched a probe or a route selector' };

  // Second pass: put back anything the sibling cap dropped that a marker needs.
  // The cap keeps the first two matches of a repeated selector, which is right
  // for proving "this is a list" and wrong when the marker is the fortieth item
  // -- measured 2026-08-19, /category/slots is on the browse page twice and the
  // first pass still lost it. The marker is turned back into a selector and
  // looked up directly, so this costs one query rather than a walk of the DOM.
  const markerSelector = (marker) => {
    let match = /^id="([\w-]+)"$/.exec(marker);
    if (match) return '#' + match[1];
    match = /^([\w-]+)="([^"]+)"$/.exec(marker);
    if (match) return '[' + match[1] + '="' + match[2] + '"]';
    if (marker.startsWith('/')) return '[href*="' + marker + '"]';
    if (/^[\w-]+$/.test(marker)) return '[data-testid*="' + marker + '"], [id*="' + marker + '"]';
    return '';
  };
  for (const marker of __MARKERS__) {
    const selector = markerSelector(marker);
    if (!selector) continue;
    let found = null;
    try { found = document.querySelector(selector); } catch { found = null; }
    if (found) markKeep(found);
  }

  // A URL becomes its path: no query strings, no ids, nothing host-specific.
  const cleanUrl = (value) => {
    try { return new URL(value, location.href).pathname; } catch { return ''; }
  };
  const escape = (value) => String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

  const serialize = (node, depth) => {
    const pad = '  '.repeat(depth);
    const tag = node.tagName.toLowerCase();
    const attributes = [];
    for (const attribute of node.attributes) {
      if (!KEEP_ATTRIBUTES.test(attribute.name)) continue;
      let value = attribute.value;
      if (attribute.name === 'href' || attribute.name === 'src') value = cleanUrl(value);
      // Tailwind-style class soup is most of the byte count and none of the
      // signal; the shape checks only ever match on group/ and a few names.
      if (attribute.name === 'class') {
        value = value.split(/\\s+/).filter((name) => name.includes('group/') || name.includes('chat') || name.includes('grid')).join(' ');
        if (!value) continue;
      }
      attributes.push(' ' + attribute.name + (value === '' ? '' : '="' + escape(value) + '"'));
    }
    const kids = [...node.children].filter((child) => keep.has(child));
    const head = '<' + tag + attributes.join('') + '>';
    if (!kids.length) {
      // Text is replaced, never carried: a fixture must not contain what a
      // stranger typed in chat, and the shape checks never read it.
      const own = node.textContent.trim() ? tag : '';
      return pad + head + (own ? escape(own) : '') + '</' + tag + '>';
    }
    return pad + head + '\\n' + kids.map((child) => serialize(child, depth + 1)).join('\\n') + '\\n' + pad + '</' + tag + '>';
  };

  // Which markers the live page carries, before any reduction. Without this a
  // marker dropped by the sibling cap is indistinguishable from one Kick
  // stopped serving, and reporting the first as the second is a false drift
  // finding — measured 2026-08-19, /category/slots is on the browse page twice
  // and the cap still dropped it.
  //
  // Script text is excluded, and that is the whole point of the clone: Kick
  // ships a React flight payload that serialises component props as text, so a
  // test id belonging to a component the route never mounts is still in the
  // document as characters. Counting those made this script report Kick's own
  // drift as its own bug, the precise confusion this block exists to prevent.
  // Measured on /xqc 2026-08-21: livestream-results-card appears 22 times in
  // inline script and matches 0 elements.
  const markerRoot = document.documentElement.cloneNode(true);
  for (const buried of markerRoot.querySelectorAll('script, style, template, noscript')) buried.remove();
  const liveHtml = markerRoot.outerHTML;
  const live = {};
  for (const marker of __MARKERS__) live[marker] = liveHtml.includes(marker);

  const body = [...document.body.children].filter((child) => keep.has(child));
  const html = '<!doctype html>\\n<html lang="' + (document.documentElement.lang || 'en') + '">\\n  <body>\\n'
    + body.map((child) => serialize(child, 2)).join('\\n') + '\\n  </body>\\n</html>\\n';
  return { ok: true, html, kept: keep.size, live };
})()`;

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const write = process.argv.includes('--write');
const names = requested.length ? requested : Object.keys(ROUTES);
const unknown = names.filter((name) => !ROUTES[name]);
if (unknown.length) {
  console.error(`Unknown route(s): ${unknown.join(', ')}. Known: ${Object.keys(ROUTES).join(', ')}`);
  process.exit(1);
}

const CHROME = await findChromium();
if (!CHROME) {
  console.error('No Chromium found. Install one with `npx playwright install chromium`, or set CHROME_PATH.');
  process.exit(1);
}

const profile = await mkdtemp(join(tmpdir(), 'kf-capture-'));
const child = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  `--window-position=${process.env.KF_WINDOW_POSITION || '-32000,-32000'}`,
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' });

let failures = 0;
try {
  for (let i = 0; i < 60; i += 1) {
    try {
      await rest('/json/version');
      break;
    } catch {
      await sleep(250);
    }
  }
  const target = (await rest('/json/list')).find((entry) => entry.type === 'page');
  const client = cdp(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Runtime.enable');
  await client.send('Page.enable');

  for (const name of names) {
    const route = ROUTES[name];
    await client.send('Page.navigate', { url: route.url });
    // Kick renders client-side; there is no load event worth waiting on.
    await sleep(13000);
    const wantedMarkers = route.markers;
    // replaceAll with a *function*: the placeholder appears more than once, and
    // a string replacement would interpret $& and friends in captured markup.
    const reduced = await evaluate(client, REDUCER
      .replaceAll('__KEEP__', () => JSON.stringify(route.keep))
      .replaceAll('__MARKERS__', () => JSON.stringify(wantedMarkers)));
    const result = reduced.value || { ok: false, why: reduced.error || 'the reducer returned nothing' };
    if (!result.ok) {
      console.log(`FAIL  ${name} — ${result.why}`);
      failures += 1;
      continue;
    }
    const wanted = wantedMarkers;
    const missing = wanted.filter((marker) => !result.html.includes(marker));
    const bytes = result.html.length;
    if (missing.length) {
      // Not written, on purpose — but say *which* of the two this is, because
      // they call for opposite responses. A marker the live page carries and
      // the reduction lost is this script's bug (usually the sibling cap);
      // one the live page does not carry at all is drift in Kick, and blessing
      // a weaker fixture would turn that signal green.
      const dropped = missing.filter((marker) => result.live?.[marker]);
      const gone = missing.filter((marker) => !result.live?.[marker]);
      console.log(`FAIL  ${name} — ${bytes} B, ${result.kept} nodes kept`);
      if (dropped.length) console.log(`      reducer dropped (the live page has these): ${dropped.join(', ')}`);
      if (gone.length) console.log(`      DRIFT — live Kick no longer serves: ${gone.join(', ')}`);
      failures += 1;
      continue;
    }
    console.log(`OK    ${name} — ${bytes} B, ${result.kept} nodes kept, all ${wanted.length} markers present${write ? ' (written)' : ' (dry run)'}`);
    if (write) await writeFile(resolve('test/fixtures', `${name}.html`), result.html, 'utf8');
  }
  client.close();
} finally {
  try {
    spawn('taskkill', ['/F', '/PID', String(child.pid), '/T'], { stdio: 'ignore' });
  } catch {
    // Not Windows, or already gone.
  }
  child.kill();
  await sleep(1000);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

if (!write) console.log('\nDry run. Re-run with --write to replace the fixtures that passed.');
process.exit(failures ? 1 : 0);
