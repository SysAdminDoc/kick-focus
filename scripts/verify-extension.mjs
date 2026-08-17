/**
 * Live proof-of-load for the companion extension.
 *
 * Loads dist/extension into a throwaway Chromium profile, opens a real Kick
 * page, and checks that the extension's own service worker is running, that the
 * rulesets are in the state the manifest promises, that the page world booted
 * and can see the companion handshake, and that an ad-host request is refused
 * by the browser network stack.
 *
 * This talks to the live site, so it is deliberately not part of `npm run
 * verify`. Run it with `npm run verify:extension` after a build.
 *
 * Google Chrome stable ignores --load-extension with no visible error; a
 * Chromium build (the one Playwright downloads) still honours it.
 *
 * This runs headed on purpose. Kick answers headless browsers with
 * `{"error": "Request blocked by security policy."}` instead of the site, and
 * every DOM assertion here would pass trivially against that empty body. The
 * network-level checks survive headless because they only depend on the
 * request's origin, but the layout and filtering checks do not.
 *
 *   node scripts/verify-extension.mjs [url]
 *   CHROME_PATH=/path/to/chromium node scripts/verify-extension.mjs
 *   KF_WINDOW_POSITION=5360,0 node scripts/verify-extension.mjs   # off-screen display
 *   KF_HEADLESS=1 node scripts/verify-extension.mjs               # network checks only
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { LOCATOR_PROBES } from '../src/compatibility.mjs';

async function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cacheRoots = [
    join(homedir(), 'AppData/Local/ms-playwright'),
    join(homedir(), '.cache/ms-playwright'),
    join(homedir(), 'Library/Caches/ms-playwright'),
  ];
  for (const root of cacheRoots) {
    let entries;
    try {
      entries = await readdir(root);
    } catch {
      continue;
    }
    const builds = entries
      .filter((name) => name.startsWith('chromium-'))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const build of builds) {
      for (const relative of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const candidate = join(root, build, relative);
        try {
          await stat(candidate);
          return candidate;
        } catch {
          // Try the next layout.
        }
      }
    }
  }
  return null;
}

const CHROME = await findChromium();
if (!CHROME) {
  // A behavioral gate that exits 0 without a browser verifies nothing; that is a
  // failure, not a skip. Downgrade to a skip only when a machine genuinely cannot
  // run Chromium and the caller opts in explicitly.
  const allowSkip = process.env.KF_ALLOW_NO_CHROMIUM === '1';
  console.log(`${allowSkip ? 'SKIP' : 'FAIL'}  No Chromium found. Install one with \`npx playwright install chromium\`, or set CHROME_PATH.`);
  console.log('      Google Chrome stable will not work: it ignores --load-extension.');
  if (allowSkip) {
    console.log('      KF_ALLOW_NO_CHROMIUM=1 is set: treating the missing browser as a soft skip. The live proof did not run.');
    process.exit(0);
  }
  console.error('\nThe live proof cannot verify anything without a browser, so this exits non-zero.');
  console.error('Set KF_ALLOW_NO_CHROMIUM=1 to downgrade to a skip on a machine that truly cannot install Chromium.');
  process.exit(1);
}

const EXT = resolve('dist/extension');
const PORT = Number(process.env.KF_DEBUG_PORT || 9411);
const WINDOW_SIZE = process.env.KF_WINDOW_SIZE || '1440,900';
const [VIEWPORT_WIDTH, VIEWPORT_HEIGHT] = WINDOW_SIZE.split(',').map((value) => Number(value));
if (!Number.isInteger(VIEWPORT_WIDTH) || !Number.isInteger(VIEWPORT_HEIGHT) || VIEWPORT_WIDTH < 1024 || VIEWPORT_HEIGHT < 600) {
  throw new Error(`KF_WINDOW_SIZE must be a desktop CSS viewport such as 1440,900; received ${WINDOW_SIZE}`);
}
const TARGET_URL = process.argv[2] || 'https://kick.com/';
const EXPECTED_VERSION = JSON.parse(
  await (await import('node:fs/promises')).readFile('package.json', 'utf8'),
).version;

console.log(`Chromium: ${CHROME}`);
console.log(`Extension: ${EXT}`);
console.log(`Target: ${TARGET_URL}\n`);

const profile = await mkdtemp(join(tmpdir(), 'kf-verify-'));
const child = spawn(CHROME, [
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${PORT}`,
  `--load-extension=${EXT}`,
  `--disable-extensions-except=${EXT}`,
  ...(process.env.KF_HEADLESS ? ['--headless=new'] : []),
  ...(process.env.KF_WINDOW_POSITION ? [`--window-position=${process.env.KF_WINDOW_POSITION}`] : []),
  '--no-first-run',
  '--no-default-browser-check',
  `--window-size=${WINDOW_SIZE}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

let stderr = '';
child.stderr.on('data', (d) => { stderr += d.toString(); });

/**
 * Chrome 139 removed `--load-extension` and `--disable-extensions-except` from
 * official builds, so this harness only works on a Chromium-for-Testing binary
 * (which is what Playwright ships). On a stock Chrome the flags are ignored
 * silently: the browser starts, the extension never loads, and every check
 * either fails confusingly or attaches to a component extension instead. Say
 * which it is rather than leaving the next person to guess.
 */
function unsupportedBinaryHint() {
  if (/is not supported|Ignoring unsupported/i.test(stderr)) {
    return 'the browser reported the extension-loading flags as unsupported';
  }
  if (/Google\Chrome|Google Chrome(?!.*for Testing)/i.test(CHROME)) {
    return `${CHROME} looks like stock Google Chrome`;
  }
  return '';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

/**
 * A check whose subject Kick did not put on this route.
 *
 * Distinct from a failure on purpose: the default run targets the home page,
 * where there is no Subscribe button and no live channel to time, and a red
 * gate that means "you did not point me at a channel" trains people to ignore
 * it. Distinct from silence too — the run says out loud what it did not cover,
 * and how to cover it. Pass a channel URL to `npm run verify:extension` to
 * turn these into real assertions.
 */
const skip = (label, why) => {
  console.log(`SKIP  ${label} — ${why}`);
};

async function json(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

let nextId = 1;
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const events = [];
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
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
  return {
    ready,
    events,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => ws.close(),
  };
}

async function evaluate(client, expression) {
  const res = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.result?.exceptionDetails) return { error: res.result.exceptionDetails.text };
  return { value: res.result?.result?.value };
}

try {
  // Wait for the debugging endpoint.
  for (let i = 0; i < 40; i += 1) {
    try { await json('/json/version'); break; } catch { await sleep(250); }
  }

  // 1. Service worker target = proof the extension loaded and MV3 background started.
  //    Chromium ships component extensions (e.g. Gemini) that also use a
  //    background.js, and --disable-extensions-except does not exclude them, so
  //    the worker must be identified by manifest name, not by file name.
  let targets = [];
  let worker = null;
  let swClient = null;
  for (let i = 0; i < 40 && !worker; i += 1) {
    targets = await json('/json/list');
    for (const candidate of targets.filter((t) => t.type === 'service_worker')) {
      const probe = cdp(candidate.webSocketDebuggerUrl);
      await probe.ready;
      await probe.send('Runtime.enable');
      const name = await evaluate(probe, 'chrome.runtime.getManifest().name');
      if (name.value === 'Kick Focus') {
        worker = candidate;
        swClient = probe;
        break;
      }
      probe.close();
    }
    if (!worker) await sleep(500);
  }
  const hint = worker ? '' : unsupportedBinaryHint();
  record(
    'extension loaded (its own service worker is running)',
    Boolean(worker),
    worker?.url || (hint
      ? `${hint}. This gate needs a Chromium-for-Testing build — Chrome 139 removed --load-extension and --disable-extensions-except from official builds. Set CHROME_PATH to Playwright's Chromium.`
      : 'no service worker matching the built extension name'),
  );
  if (!worker) throw new Error('no Kick Focus service worker; extension did not load');

  const extensionId = new URL(worker.url).host;
  const swVersion = await evaluate(swClient, 'chrome.runtime.getManifest().version');
  record('service worker reports the built version', swVersion.value === EXPECTED_VERSION, `v${swVersion.value}`);

  // 2. Rulesets enabled in the running worker, before any page has loaded.
  const rulesets = await evaluate(swClient, 'chrome.declarativeNetRequest.getEnabledRulesets()');
  record('ads ruleset enabled at runtime', Array.isArray(rulesets.value) && rulesets.value.includes('ads'), JSON.stringify(rulesets.value));
  record('telemetry ruleset ships off before any page reports settings', Array.isArray(rulesets.value) && !rulesets.value.includes('telemetry'), JSON.stringify(rulesets.value));

  const ruleCount = await evaluate(swClient, 'chrome.declarativeNetRequest.getAvailableStaticRuleCount()');
  record('static rule budget available', typeof ruleCount.value === 'number', `remaining=${ruleCount.value}`);

  // 3. Load Kick and inspect the page world.
  const created = await (async () => {
    const c = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await c.ready;
    const r = await c.send('Target.createTarget', { url: TARGET_URL });
    c.close();
    return r.result.targetId;
  })();

  await sleep(Number(process.env.KF_SETTLE_MS || 9000));
  targets = await json('/json/list');
  const page = targets.find((t) => t.id === created);
  record('kick page target open', Boolean(page), page?.url);

  const pageClient = cdp(page.webSocketDebuggerUrl);
  await pageClient.ready;
  await pageClient.send('Runtime.enable');
  await pageClient.send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(500);

  const viewport = await evaluate(pageClient, '({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio })');
  const viewportExact = viewport.value?.width === VIEWPORT_WIDTH
    && viewport.value?.height === VIEWPORT_HEIGHT
    && Math.abs(Number(viewport.value?.dpr) - 1) < 0.001;
  record(`exact CSS viewport applied`, viewportExact, JSON.stringify(viewport.value));

  // Kick serves automated browsers a JSON error instead of the site. Every
  // DOM assertion below would pass trivially against that 79-byte body, so the
  // reachability of the real page is established before anything is claimed
  // about it. Without this gate the suite reports a healthy layout for a page
  // that never rendered.
  const bodyText = await evaluate(pageClient, 'document.body ? document.body.innerText.slice(0, 200) : ""');
  const kickShell = await evaluate(pageClient, 'Boolean(document.querySelector("#main-container, #sidebar-wrapper, nav"))');
  const blocked = /Request blocked by security policy/i.test(String(bodyText.value || ''));
  const reachedKick = kickShell.value === true && !blocked;
  record('reached the real Kick page (not a bot wall)', reachedKick,
    blocked ? 'Kick returned "Request blocked by security policy"' : `kick shell present=${kickShell.value}`);

  const booted = await evaluate(pageClient, 'Boolean(window.__kickFocusBooted)');
  record('page-world script booted', booted.value === true);

  const companion = await evaluate(pageClient, 'document.documentElement.dataset.kickFocusCompanion || ""');
  record('companion handshake visible to page', Boolean(companion.value), `v${companion.value}`);

  const mounted = await evaluate(pageClient, 'Boolean(document.querySelector("#kick-focus-root, [data-kf-root]")) || Boolean(window.__kickFocusNetworkDefenseV1)');
  record('kick focus runtime active on page', mounted.value === true);

  // The accessibility settings and the modal focus ladder are about this mod's
  // own chrome, not Kick's markup, so they are proven by driving the real UI
  // rather than by reading source. Both were defects a green offline build
  // reported as healthy: the density/motion settings were written at <html>,
  // where they cannot reach into the shadow root the controls actually live in,
  // and Escape on the reset prompt tore down the whole Settings modal.
  const shadowProbe = await evaluate(pageClient, `(async () => {
    const host = document.getElementById('kick-focus-root');
    if (!host || !host.shadowRoot) return { ok: false, why: 'no shadow host' };
    const shadow = host.shadowRoot;
    const q = (selector) => shadow.querySelector(selector);
    // The apply cycle is throttled, never synchronous — reading the host in the
    // same tick as the click measures the state before the setting landed.
    const settle = () => new Promise((done) => setTimeout(done, 600));
    const read = () => {
      const control = q('.kf-switch');
      return { flag: host.dataset.kfLargeTargets, height: control ? getComputedStyle(control).minHeight : '' };
    };
    q('[data-page="accessibility"]').click();
    await settle();
    const before = read();
    q('[data-set="accessibility.largeTargets"]').click();
    await settle();
    const after = read();
    q('[data-set="accessibility.largeTargets"]').click();
    await settle();
    const restored = read();
    return { ok: true, before, after, restored };
  })()`);
  const density = shadowProbe.value || {};
  record('larger targets restyles the mod own shadow controls, not just Kick markup',
    density.ok === true
      && density.before?.flag === 'false' && density.after?.flag === 'true'
      && density.restored?.flag === 'false'
      && density.before?.height !== density.after?.height
      && density.after?.height === '40px',
    density.ok ? `.kf-switch min-height ${density.before?.height} -> ${density.after?.height} -> ${density.restored?.height}` : density.why);

  // Dynamic copy — toasts, announcements, count phrases — bypasses the render
  // pass that localizes settings markup, so it stayed English in es/pt while
  // the parity gate reported agreement. Driving a real language change proves
  // the tr()/plural() path, not just the presence of dictionary entries.
  const localeProbe = await evaluate(pageClient, `(async () => {
    const host = document.getElementById('kick-focus-root');
    const shadow = host && host.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const settle = () => new Promise((done) => setTimeout(done, 400));
    // The language control only exists once the Appearance page is rendered,
    // and every settings change replaces it — a reference captured once goes
    // detached, where dispatching an event reaches no listener at all.
    const setLanguage = async (value) => {
      shadow.querySelector('[data-page="appearance"]').click();
      await settle();
      const select = shadow.querySelector('[data-set="appearance.language"]');
      if (!select) return false;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      return true;
    };
    if (!(await setLanguage('en'))) return { ok: false, why: 'no language control' };
    const readCount = () => String(shadow.querySelector('[data-kf-command-count]').textContent || '');
    // An empty hidden-channel add is the cheapest deterministic toast that
    // changes nothing: it validates, refuses, and reports.
    const raiseToast = async () => {
      shadow.querySelector('[data-page="content"]').click();
      await settle();
      shadow.querySelector('[data-action="add-hidden-channel"]').click();
      await settle();
      return String(shadow.querySelector('.kf-toast-text')?.textContent || '');
    };
    const sample = async (value) => {
      await setLanguage(value);
      const toast = await raiseToast();
      shadow.querySelector('[data-page="appearance"]').click();
      await settle();
      return { count: readCount(), toast };
    };
    const english = await sample('en');
    const spanish = await sample('es');
    await setLanguage('auto');
    return { ok: true, english, spanish };
  })()`);
  const locale = localeProbe.value || {};
  record('toasts and count phrases follow the language setting, not just settings markup',
    locale.ok === true
      && /commands? available/.test(locale.english?.count || '')
      && /comandos? disponibles?/.test(locale.spanish?.count || '')
      && locale.english?.toast === 'Enter a channel name or URL.'
      && locale.spanish?.toast === 'Escribe un nombre de canal o una URL.',
    locale.ok ? `count "${locale.english?.count}" -> "${locale.spanish?.count}"; toast "${locale.english?.toast}" -> "${locale.spanish?.toast}"` : locale.why);

  // The apply cycle's cost is a diagnostic the About page shows. Reading it here
  // gives every live run a number to compare against the last one, so a
  // regression is visible in the log rather than only in someone's fan noise.
  const applyCost = await evaluate(pageClient, `(async () => {
    const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const settle = () => new Promise((done) => setTimeout(done, 400));
    // Let a few cycles land on top of the ones the page load already caused.
    for (let i = 0; i < 4; i += 1) { document.body.append(document.createComment('kf-poke')); await settle(); }
    shadow.querySelector('[data-kf-quick]').click();
    shadow.querySelector('[data-action="command:settings"]').click();
    shadow.querySelector('[data-page="about"]').click();
    await settle();
    const text = String(shadow.querySelector('[data-kf-apply-cost]')?.textContent || '');
    const match = text.match(/(\\d+) runs · last ([\\d.]+) ms · recent avg ([\\d.]+) ms · max ([\\d.]+) ms/);
    return {
      ok: true, text, runs: match ? Number(match[1]) : 0,
      recentAvg: match ? Number(match[3]) : null, max: match ? Number(match[4]) : null,
      yields: typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function',
    };
  })()`);
  const cost = applyCost.value || {};
  // The cost is a number to compare run over run, and the yield branch must be
  // the one this engine takes — otherwise the split is untested here.
  record('the apply cycle yields to input and reports its own cost',
    cost.ok === true && cost.runs > 3 && Number.isFinite(cost.recentAvg) && cost.yields === true,
    cost.ok ? `${cost.text} | scheduler.yield available=${cost.yields}` : cost.why);

  // WCAG 2.2 target size and reflow, measured rather than reasoned about: both
  // are properties of computed layout at a given density and zoom, which no
  // amount of reading the stylesheet establishes.
  const a11ySizeProbe = await evaluate(pageClient, `(async () => {
    const host = document.getElementById('kick-focus-root');
    const shadow = host && host.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const settle = () => new Promise((done) => setTimeout(done, 400));
    shadow.querySelector('[data-kf-quick]').click();
    shadow.querySelector('[data-action="command:settings"]').click();
    await settle();
    const undersized = [];
    let scanned = 0;
    for (const page of ['layout', 'appearance', 'content', 'accessibility', 'about']) {
      shadow.querySelector('[data-page="' + page + '"]').click();
      await settle();
      for (const node of shadow.querySelectorAll('[data-kf-settings-shell] button, [data-kf-settings-shell] select, [data-kf-settings-shell] [role="switch"]')) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue; // not rendered
        scanned += 1;
        if (rect.width < 24 || rect.height < 24) {
          undersized.push(page + ':' + (node.dataset.action || node.dataset.set || node.className) + '=' + Math.round(rect.width) + 'x' + Math.round(rect.height));
        }
      }
      // 2.4.11: focusing the last control must not leave it under the sticky footer.
      const controls = [...shadow.querySelectorAll('[data-kf-page] button, [data-kf-page] select')];
      const last = controls[controls.length - 1];
      if (last) {
        last.focus();
        await settle();
        const rect = last.getBoundingClientRect();
        const footer = shadow.querySelector('.kf-footer')?.getBoundingClientRect();
        if (footer && rect.bottom > footer.top + 1 && rect.top < footer.bottom) {
          undersized.push(page + ':focus-obscured-by-footer');
        }
      }
    }
    return { ok: true, undersized, scanned };
  })()`);
  const sizes = a11ySizeProbe.value || {};
  // The count is part of the assertion: "no control was too small" is trivially
  // true of no controls, and a selector that stopped matching would report a
  // clean pass forever.
  record('every settings control clears the 24px target minimum and focus is never under the sticky footer',
    sizes.ok === true && sizes.scanned > 40 && Array.isArray(sizes.undersized) && sizes.undersized.length === 0,
    sizes.ok ? `${sizes.scanned} controls measured, ${sizes.undersized.length} violations${sizes.undersized.length ? ': ' + sizes.undersized.slice(0, 4).join(', ') : ''}` : sizes.why);

  // WCAG 2.2 1.4.10 Reflow: 200% zoom must not produce a horizontal scrollbar.
  // Emulated as half the CSS viewport, which is what doubling the zoom does.
  await pageClient.send('Emulation.setDeviceMetricsOverride', {
    width: Math.round(VIEWPORT_WIDTH / 2), height: Math.round(VIEWPORT_HEIGHT / 2),
    deviceScaleFactor: 1, mobile: false,
  });
  const reflow = await evaluate(pageClient, `(() => {
    const shell = document.getElementById('kick-focus-root')?.shadowRoot?.querySelector('[data-kf-settings-shell]');
    const rect = shell?.getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      shellOverflow: rect ? Math.round(rect.width - window.innerWidth) : null,
    };
  })()`);
  const zoom = reflow.value || {};
  record('the interface reflows at 200% zoom without a horizontal scrollbar',
    zoom.documentOverflow <= 0 && zoom.shellOverflow !== null && zoom.shellOverflow <= 0,
    `at ${zoom.viewport}px CSS width: document overflow ${zoom.documentOverflow}px, settings shell overflow ${zoom.shellOverflow}px`);
  await pageClient.send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, deviceScaleFactor: 1, mobile: false,
  });

  // Chromium exposes the Trusted Types API even where no CSP enforces it, so
  // this run takes the policy branch: every innerHTML write in the interface
  // below already went through createHTML. Asserted rather than assumed,
  // because if the branch were not taken the rest of the run would look
  // identical and prove nothing about it.
  // Chromium has the Navigation API, so history must be untouched here — the
  // wrapper's function name used to sit in pushState.toString() for any script
  // to read. And the browser's own event must still drive routing: a real
  // same-document navigation to /browse has to be re-classified.
  const routeProbe = await evaluate(pageClient, `(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 700));
    const before = document.documentElement.dataset.kfRoute || '';
    // Not "is native": Kick's own Sentry instrumentation wraps history exactly
    // as it wraps fetch, so on the live site nobody is outermost. The claim
    // that can be tested is that this build's wrapper is not in the stack.
    const pushNative = !String(history.pushState).includes('kickFocus') && !String(history.replaceState).includes('kickFocus');
    history.pushState(null, '', '/browse');
    await settle();
    const after = document.documentElement.dataset.kfRoute || '';
    history.pushState(null, '', '/');
    await settle();
    return { pushNative, hasNavigationApi: typeof navigation !== 'undefined', before, after, back: document.documentElement.dataset.kfRoute || '' };
  })()`);
  const route = routeProbe.value || {};
  record('history carries no wrapper of ours and a same-document navigation still re-routes through the Navigation API',
    route.hasNavigationApi === true && route.pushNative === true && route.after === 'browse' && route.back !== 'browse',
    `navigation api=${route.hasNavigationApi} history free of this build=${route.pushNative}; route ${route.before} -> ${route.after} -> ${route.back}`);

  // The emote key space gained a platform prefix. The migration has to be
  // lossless against a store written by the previous build, so write one in the
  // legacy shape, reload, and count what survived — a unit test cannot prove
  // the real storage path re-reads and re-writes it correctly.
  // The roll-call only means anything with a second tab actually answering, so
  // open one on a channel and ask from this one. Nothing is stubbed: two real
  // pages, the real BroadcastChannel, the real button.
  const secondTab = await (async () => {
    const c = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await c.ready;
    const r = await c.send('Target.createTarget', { url: 'https://kick.com/xqc' });
    c.close();
    return r.result.targetId;
  })();
  await sleep(9000);
  const presence = await evaluate(pageClient, `(async () => {
    const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const settle = () => new Promise((done) => setTimeout(done, 900));
    shadow.querySelector('[data-action="open-multistream"]')?.click();
    if (shadow.querySelector('[data-kf-multistream-backdrop]')?.hidden !== false) {
      shadow.querySelector('[data-kf-quick]').click();
      shadow.querySelector('[data-action="command:multistream"]')?.click();
    }
    await settle();
    const button = shadow.querySelector('[data-kf-presence-add]');
    const offered = { hidden: button?.hidden, label: String(button?.textContent || ''), title: String(button?.title || '') };
    // Take the offer and confirm the grid actually gained the channel.
    if (button && !button.hidden) button.click();
    await settle();
    const streams = [...shadow.querySelectorAll('[data-kf-multistream-tile]')].length;
    const stored = JSON.parse(localStorage.getItem('kick-focus:multistream') || '{}');
    shadow.querySelector('[data-action="close-multistream"]')?.click();
    return { ok: true, offered, streams, stored: stored.streams || [] };
  })()`);
  const pres = presence.value || { why: presence.error || 'probe returned nothing' };
  record('a second Kick tab answers the roll-call and its channel can be added in one click',
    pres.ok === true && pres.offered?.hidden === false
      && /Add open tabs \(1\)/.test(pres.offered?.label || '')
      && /xqc/i.test(pres.offered?.title || '')
      && Array.isArray(pres.stored) && pres.stored.some((slug) => /^xqc$/i.test(slug)),
    pres.ok ? `offer="${pres.offered?.label}" tabs="${pres.offered?.title}" grid now ${JSON.stringify(pres.stored)}` : pres.why);
  await (async () => {
    const c = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await c.ready;
    await c.send('Target.closeTarget', { targetId: secondTab });
    c.close();
  })();
  // Leave the grid as it was found.
  await evaluate(pageClient, `(() => { localStorage.removeItem('kick-focus:multistream'); return true; })()`);

  // Driven through the real import path rather than by seeding localStorage and
  // reloading: the outgoing page flushes its own in-memory library on pagehide,
  // which overwrites a seeded store before the new page can read it. An old
  // backup is also how a user actually arrives at this migration.
  const migrationProbe = await evaluate(pageClient, `(async () => {
    const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const settle = () => new Promise((done) => setTimeout(done, 700));
    const backup = {
      ...JSON.parse(localStorage.getItem('kick-focus:settings') || '{}'),
      stickers: {
        schema: 7,
        library: [
          { key: 'id:9001', id: '9001', name: 'LegacyOne', src: 'https://files.kick.com/emotes/9001/fullsize', nativeGroups: ['Seen in chat'], access: 'observed', firstSeen: 1, lastSeen: 2 },
          { key: 'id:9002', id: '9002', name: 'LegacyTwo', src: 'https://files.kick.com/emotes/9002/fullsize', nativeGroups: ['Global'], access: 'available', firstSeen: 1, lastSeen: 3 },
        ],
        favorites: [{ key: 'id:9001', channel: '', order: 0 }],
        hidden: ['id:9003'],
        groups: [{ id: 'g1', name: 'Legacy group' }],
        assignments: [{ key: 'id:9002', groupId: 'g1' }],
      },
    };
    const input = shadow.querySelector('[data-kf-import]');
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify(backup)], 'legacy.json', { type: 'application/json' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const stored = JSON.parse(localStorage.getItem('kick-focus:sticker-preferences') || '{}');
    const result = {
      ok: true,
      schema: stored.schema,
      keys: (stored.library || []).map((entry) => entry.key).sort(),
      names: (stored.library || []).map((entry) => entry.name).sort(),
      favorites: (stored.favorites || []).map((entry) => entry.key),
      hidden: stored.hidden || [],
      assignments: (stored.assignments || []).map((entry) => entry.key),
      groups: (stored.groups || []).map((group) => group.id),
    };
    // Undo the import so the profile is left as it was found.
    shadow.querySelector('[data-kf-quick]').click();
    shadow.querySelector('[data-action="command:settings"]').click();
    shadow.querySelector('[data-page="about"]').click();
    await settle();
    shadow.querySelector('[data-action="undo-import"]')?.click();
    await settle();
    return result;
  })()`);
  const m = migrationProbe.value || { why: migrationProbe.error || 'probe returned nothing' };
  const prefixed = (list) => Array.isArray(list) && list.length > 0 && list.every((key) => key.startsWith('kick:'));
  // The claim is that the migration loses nothing, not that the library holds
  // only what was imported. Home carries a live chat preview and emote
  // discovery is on by default, so a message arriving mid-probe legitimately
  // adds an entry — which made an exact-length assertion fail on a busy minute
  // and pass on a quiet one. Both legacy entries must be there, and every key
  // in the store must carry the platform prefix, observations included.
  record('a backup from the previous build migrates to the platform-prefixed key space without loss',
    m.ok === true && m.schema === 8
      && m.names?.includes('LegacyOne') && m.names?.includes('LegacyTwo')
      && m.keys?.includes('kick:id:9001') && m.keys?.includes('kick:id:9002')
      && prefixed(m.keys) && prefixed(m.favorites) && prefixed(m.hidden) && prefixed(m.assignments)
      // The favorite and the assignment must still resolve against the library.
      && m.keys.includes(m.favorites[0]) && m.keys.includes(m.assignments[0])
      && m.groups?.[0] === 'g1',
    m.ok ? `schema=${m.schema} names=${JSON.stringify(m.names)} keys=${JSON.stringify(m.keys)} favorite=${JSON.stringify(m.favorites)} hidden=${JSON.stringify(m.hidden)} assignment=${JSON.stringify(m.assignments)}` : m.why);

  // Keyword highlighting paints matched words from the Custom Highlight
  // registry, writing no node into chat. There is no chat on Home, so drive a
  // real channel route, save a keyword through the real settings control, and
  // stand up a synthetic message list shaped like Kick's — then check that the
  // registry holds the ranges and that the message markup is byte-identical to
  // what was inserted.
  const highlightProbe = await evaluate(pageClient, `(async () => {
    const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const settle = () => new Promise((done) => setTimeout(done, 700));
    history.pushState(null, '', '/kfprobechannel');
    await settle();
    const route = document.documentElement.dataset.kfRoute;
    shadow.querySelector('[data-kf-quick]').click();
    shadow.querySelector('[data-action="command:settings"]').click();
    shadow.querySelector('[data-page="content"]').click();
    await settle();
    const highlightsOn = shadow.querySelector('[data-set="content.chatHighlights"]');
    if (highlightsOn && highlightsOn.getAttribute('aria-checked') !== 'true') { highlightsOn.click(); await settle(); }
    const input = shadow.querySelector('[data-kf-chat-keywords]');
    if (!input) { history.pushState(null, '', '/'); return { ok: false, why: 'no keyword input on ' + route }; }
    input.value = 'giveaway';
    shadow.querySelector('[data-action="save-local-channel"]').click();
    await settle();
    const list = document.createElement('div');
    list.setAttribute('data-testid', 'chatroom-messages');
    const markup = '<div class="group">free GIVEAWAY tonight and another giveaway</div><div class="group">nothing here</div>';
    list.innerHTML = markup;
    // Prepended: applyChatHighlights takes the first match in document order,
    // and on a channel route Kick may have a chat node of its own.
    document.body.prepend(list);
    await settle();
    await settle();
    const boundToProbe = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages') === list;
    const rows = [...list.querySelectorAll('.group')].map((row) => row.dataset.kfHighlighted);
    const highlight = CSS.highlights?.get('kick-focus-keyword');
    const result = {
      ok: true, route, rows, boundToProbe, api: typeof Highlight === 'function' && Boolean(CSS.highlights),
      ranges: highlight ? highlight.size : -1,
      // No node written into the message: strip only the row attribute this
      // build has always set and compare against what was inserted.
      untouched: list.innerHTML.replace(/ data-kf-highlighted="(true|false)"/g, '') === markup,
      painted: highlight ? [...highlight].map((range) => range.toString()) : [],
    };
    list.remove();
    // Clear the keyword while the control that owns it is still rendered.
    input.value = '';
    shadow.querySelector('[data-action="save-local-channel"]')?.click();
    await settle();
    history.pushState(null, '', '/');
    await settle();
    // Whatever happened, the error log names anything the cycle threw.
    shadow.querySelector('[data-page="about"]')?.click();
    await settle();
    result.errors = String(shadow.querySelector('[data-kf-error-log]')?.textContent || '').trim().slice(0, 200);
    return result;
  })()`);
  const hl = highlightProbe.value || { why: highlightProbe.error || 'probe returned nothing' };
  record('keyword matches are painted from the Highlight registry with zero nodes written into chat',
    hl.ok === true && hl.route === 'channel' && hl.api === true
      && Array.isArray(hl.rows) && hl.rows[0] === 'true' && hl.rows[1] === 'false'
      && hl.ranges === 2 && hl.untouched === true
      && Array.isArray(hl.painted) && hl.painted.every((word) => word.toLowerCase() === 'giveaway'),
    hl.ok ? `route=${hl.route} api=${hl.api} boundToProbe=${hl.boundToProbe} rows=${JSON.stringify(hl.rows)} ranges=${hl.ranges} painted=${JSON.stringify(hl.painted)} markup untouched=${hl.untouched}${hl.errors ? ` | error log: ${hl.errors}` : ''}` : hl.why);

  // The site sheet should be adopted, not an element: an element in <head> is
  // the fallback path, and seeing it here would mean the constructed-sheet
  // branch is not the one real Chromium takes.
  const sheetProbe = await evaluate(pageClient, `({
    adopted: (document.adoptedStyleSheets || []).length,
    element: Boolean(document.getElementById('kick-focus-site-style')),
    shadowAdopted: (document.getElementById('kick-focus-root')?.shadowRoot?.adoptedStyleSheets || []).length,
    shadowStyleElements: document.getElementById('kick-focus-root')?.shadowRoot?.querySelectorAll('style').length,
    // The sheet actually applies: the quick button is styled from it.
    styled: getComputedStyle(document.getElementById('kick-focus-root')?.shadowRoot?.querySelector('[data-kf-quick]') || document.body).position,
  })`);
  const sheets = sheetProbe.value || {};
  record('the site and interface stylesheets are constructed and adopted, not <style> elements',
    sheets.adopted >= 1 && sheets.element === false && sheets.shadowAdopted >= 1 && sheets.shadowStyleElements === 0 && sheets.styled === 'fixed',
    `document adopted=${sheets.adopted} fallback element=${sheets.element}; ui shadow adopted=${sheets.shadowAdopted} style elements=${sheets.shadowStyleElements}; quick button position=${sheets.styled}`);

  const ttProbe = await evaluate(pageClient, `({
    api: typeof window.trustedTypes?.createPolicy === 'function',
    enforced: Boolean(window.trustedTypes?.defaultPolicy),
    rendered: Boolean(document.getElementById('kick-focus-root')?.shadowRoot?.querySelector('[data-kf-settings-shell]')),
  })`);
  const tt = ttProbe.value || {};
  record('the interface renders through a Trusted Types policy on an engine that provides one',
    tt.api === true && tt.rendered === true,
    `trustedTypes available=${tt.api}, page enforces a default policy=${tt.enforced}, settings shell rendered=${tt.rendered}`);

  // Typing an emote name reaches into Kick's own composer, so prove against a
  // real contenteditable that the plain name lands at the caret and that
  // nothing in the path submits: no Enter, no send click, no form submit.
  const insertProbe = await evaluate(pageClient, `(async () => {
    const host = document.getElementById('kick-focus-root');
    const shadow = host && host.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const settle = () => new Promise((done) => setTimeout(done, 400));
    const box = document.createElement('div');
    box.setAttribute('contenteditable', 'true');
    box.setAttribute('role', 'textbox');
    box.setAttribute('data-testid', 'chat-input');
    box.style.cssText = 'position:fixed;left:4px;bottom:4px;width:200px;height:32px';
    document.body.append(box);
    const submits = [];
    for (const type of ['keydown', 'keypress', 'submit']) {
      document.addEventListener(type, (event) => {
        if (type === 'submit' || event.key === 'Enter') submits.push(type + ':' + (event.key || ''));
      }, true);
    }
    shadow.querySelector('[data-page="content"]').click();
    await settle();
    // The action is gated by its own setting, not merely by the button being
    // rendered — so turn it on the way a user would.
    const toggle = shadow.querySelector('[data-set="content.insertEmoteName"]');
    if (!toggle) { box.remove(); return { ok: false, why: 'no insert-name setting' }; }
    if (toggle.getAttribute('aria-checked') !== 'true') { toggle.click(); await settle(); }
    // The library lives inside the bundle IIFE, so take a key from a rendered
    // card rather than reaching for a private binding.
    const seeded = shadow.querySelector('[data-action="insert-sticker-name"]');
    if (!seeded) { box.remove(); return { ok: false, why: 'library is empty on this profile' }; }
    seeded.click();
    await settle();
    const typed = box.textContent;
    const toast = String(shadow.querySelector('.kf-toast-text')?.textContent || '');
    box.remove();
    return { ok: true, typed, toast, submits };
  })()`);
  const insert = insertProbe.value || {};
  record('typing an emote name inserts the plain name at the caret and never sends',
    insert.ok === true
      && typeof insert.typed === 'string' && insert.typed.length > 0
      && /^[A-Za-z0-9_]+$/.test(insert.typed)
      && !insert.typed.includes('[emote:')
      && Array.isArray(insert.submits) && insert.submits.length === 0,
    insert.ok ? `typed ${JSON.stringify(insert.typed)}; submit-shaped events ${JSON.stringify(insert.submits)}` : insert.why);

  // The hover card is built from a synthetic annotated image rather than from
  // whatever chat happened to say during the run: the wiring under test is the
  // delegated listener and the clamping, and waiting for a real emote to arrive
  // would make this pass or fail on a stranger's typing.
  const tooltipProbe = await evaluate(pageClient, `(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 300));
    const image = document.createElement('img');
    image.src = 'https://files.kick.com/emotes/000/fullsize';
    image.dataset.kfChatEmoteSave = 'kf-probe-emote';
    image.style.cssText = 'position:fixed;left:4px;top:4px;width:28px;height:28px';
    document.body.append(image);
    const unrelated = document.createElement('img');
    unrelated.src = image.src;
    unrelated.style.cssText = image.style.cssText;
    document.body.append(unrelated);
    const readCard = () => {
      const host = document.getElementById('kick-focus-emote-tooltip');
      if (!host || host.dataset.kfOpen !== 'true') return null;
      const style = getComputedStyle(host);
      return {
        lines: [...host.shadowRoot.querySelectorAll('[data-kf-tooltip-card] div')].map((n) => n.textContent),
        pointerEvents: style.pointerEvents,
        left: parseFloat(style.left),
      };
    };
    // Read synchronously: showChatEmoteTooltip renders in the same tick, and
    // waiting lets the periodic apply cycle clear the affordance out from under
    // the probe, which then looks like the tooltip never opened.
    image.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const shown = readCard();
    unrelated.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const afterUnrelated = readCard();
    await settle();
    image.remove();
    unrelated.remove();
    return { ok: true, shown, afterUnrelated };
  })()`);
  const tip = tooltipProbe.value || {};
  record('the chat emote hover card opens on the save affordance only, and cannot be hovered',
    tip.ok === true
      && Array.isArray(tip.shown?.lines) && tip.shown.lines.length >= 2
      && tip.shown.pointerEvents === 'none'
      && tip.shown.left >= 8
      && tip.afterUnrelated === null,
    tip.ok ? `lines ${JSON.stringify(tip.shown?.lines)}; unrelated image opened nothing` : 'probe failed');

  // The Focus button is the one control most people ever press, and nothing
  // asserted that pressing it did anything at all — the settings panel was only
  // ever opened here through the `kick-focus:open-settings` event, which skips
  // the button entirely. This clicks the real control in Kick's own header.
  const focusButtonProbe = await evaluate(pageClient, `(async () => {
    const settle = (ms = 400) => new Promise((done) => setTimeout(done, ms));
    const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
    const shell = shadow?.querySelector('[data-kf-settings-backdrop]');
    if (!shell) return { ok: false, why: 'no settings backdrop' };
    // Start closed, so "already open" cannot be mistaken for success.
    shadow.querySelector('[data-action="close-settings"]')?.click();
    await settle();
    const before = shell.hidden;

    const floating = shadow.querySelector('[data-kf-quick]');
    if (!floating) return { ok: false, why: 'no floating Focus button' };

    // The header control mounts beside Kick's "Get KICKs" nav, which only
    // exists for a signed-in account — so logged out, only the floating button
    // is ever reachable, and the control the user actually presses would go
    // untested. Supply the anchor so the real header button mounts and gets
    // clicked here too.
    let anchor = document.querySelector('[data-testid="kicks-top-nav"]');
    const synthesised = !anchor;
    if (synthesised) {
      const nav = document.createElement('nav');
      nav.style.cssText = 'position:fixed;left:-3000px;top:0';
      anchor = document.createElement('button');
      anchor.setAttribute('data-testid', 'kicks-top-nav');
      nav.append(anchor);
      document.body.append(nav);
      window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
      await settle();
    }
    const header = document.getElementById('kick-focus-header-control')?.shadowRoot?.querySelector('[data-kf-header-focus]');

    const press = async (button) => {
      shadow.querySelector('[data-action="close-settings"]')?.click();
      await settle();
      const wasHidden = shell.hidden;
      button.click();
      await settle();
      const nowHidden = shell.hidden;
      const command = shadow.querySelector('[data-kf-command-backdrop]')?.hidden === false;
      shadow.querySelector('[data-action="close-settings"]')?.click();
      await settle();
      return { opened: wasHidden === true && nowHidden === false, command };
    };

    const result = { ok: true, before, action: floating.dataset.action, synthesised };
    result.floating = await press(floating);
    result.header = header ? await press(header) : null;
    if (synthesised) { anchor.parentElement?.remove(); window.dispatchEvent(new CustomEvent('kick-focus:routechange')); await settle(); }
    return result;
  })()`);
  const focusButton = focusButtonProbe.value || {};
  record('both Focus buttons open settings, and neither opens the command menu',
    focusButton.ok === true
      && focusButton.floating?.opened === true && focusButton.floating?.command === false
      // The header button is the one that shows for a signed-in account, so it
      // has to be exercised, not merely skipped when Kick did not render it.
      && focusButton.header?.opened === true && focusButton.header?.command === false
      && focusButton.action === 'open-settings',
    focusButton.ok
      ? `floating opened=${focusButton.floating?.opened}, header opened=${focusButton.header?.opened} (anchor ${focusButton.synthesised ? 'supplied' : 'already present'}), command menu never opened, quick action=${focusButton.action}`
      : focusButton.why);

  // Hiding a Kick control, driven the way a user drives it: the chip in the
  // settings panel, not a direct write to the settings store. That is what puts
  // the whole chain under test at once — the click handler, normalization, the
  // tagging pass, and the generated rule — and it is the half a unit test
  // cannot reach, because the tagging pass needs Kick's real sidebar.
  //
  // `sidebar-browse` is the target because every route carries it, signed in or
  // not. The probe restores the previous value in a `finally` so a failure
  // here cannot leave the browse link hidden for the checks that follow.
  const hideProbe = await evaluate(pageClient, `(async () => {
    const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const settle = () => new Promise((done) => setTimeout(done, 700));
    const before = JSON.parse(localStorage.getItem('kick-focus:settings') || '{}');
    // Later probes read controls straight out of the shadow DOM without opening
    // the panel themselves, so whichever settings page is rendered when this
    // finishes is the one they get. Put it back.
    const beforePage = shadow.querySelector('[data-kf-page]')?.dataset.kfCurrentPage || '';
    const target = () => document.querySelector('li:has(> [data-testid="sidebar-browse"])')
      || document.querySelector('[data-testid="sidebar-browse"]');
    if (!target()) return { ok: false, why: 'Kick did not render the browse link on this route' };

    try {
      shadow.querySelector('[data-action="open-settings"]')?.click();
      await settle();
      shadow.querySelector('[data-page="layout"]')?.click();
      await settle();
      const chip = () => shadow.querySelector('[data-action="toggle-hidden-element"][data-element="sidebar-browse"]');
      if (!chip()) return { ok: false, why: 'the hide chip is not on the layout page' };

      const initial = {
        pressed: chip().getAttribute('aria-pressed'),
        display: getComputedStyle(target()).display,
        tagged: target().dataset.kfElement || null,
      };

      chip().click();
      await settle();
      const hidden = {
        pressed: chip().getAttribute('aria-pressed'),
        display: getComputedStyle(target()).display,
        tagged: target().dataset.kfElement || null,
        root: document.documentElement.dataset.kfHidden,
        // Hidden must mean styled out, never taken out: the node stays, so
        // nothing Kick wired to it stops existing.
        stillInDom: Boolean(target()),
        stored: (JSON.parse(localStorage.getItem('kick-focus:settings') || '{}').layout || {}).hidden,
      };

      chip().click();
      await settle();
      const restored = {
        pressed: chip().getAttribute('aria-pressed'),
        display: getComputedStyle(target()).display,
      };
      return { ok: true, initial, hidden, restored };
    } finally {
      localStorage.setItem('kick-focus:settings', JSON.stringify(before));
      window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
      await settle();
      if (beforePage) {
        shadow.querySelector('[data-page="' + beforePage + '"]')?.click();
        await settle();
      }
      shadow.querySelector('[data-action="close-settings"]')?.click();
    }
  })()`);
  const hide = hideProbe.value || {};
  record('a hide chip takes a Kick control out of sight, not out of the page, and gives it back',
    hide.ok === true
      && hide.initial?.display !== 'none'
      && hide.hidden?.display === 'none'
      && hide.hidden?.stillInDom === true
      && hide.hidden?.tagged === 'sidebar-browse'
      && hide.hidden?.pressed === 'true'
      && Array.isArray(hide.hidden?.stored) && hide.hidden.stored.includes('sidebar-browse')
      && String(hide.hidden?.root || '').split(' ').includes('sidebar-browse')
      // Reversible, and reversible without a reload.
      && hide.restored?.display === hide.initial?.display
      && hide.restored?.pressed === 'false',
    hide.ok
      ? `display ${hide.initial?.display} -> ${hide.hidden?.display} -> ${hide.restored?.display}; node kept=${hide.hidden?.stillInDom}, tag=${hide.hidden?.tagged}, stored=${JSON.stringify(hide.hidden?.stored)}`
      : hide.why);

  // Kick DOM drift, measured against the ordered probes the runtime actually
  // uses rather than a second list that would rot separately.
  //
  // Each hook in LOCATOR_PROBES is stable-id first, then structural and
  // accessible fallbacks. Everything keeps working when the first one stops
  // matching — that is what the fallbacks are for — which is exactly why it is
  // worth failing on: it is the early warning, and it is silent otherwise. A
  // hook with nothing matching at all is normal here for the ones this route
  // has no business showing (an expanded sidebar has no expand control), so
  // only a *fallen-through* hook is drift.
  const probeReport = await evaluate(pageClient, `(() => {
    const probes = ${JSON.stringify(LOCATOR_PROBES)};
    const out = {};
    for (const [hook, list] of Object.entries(probes)) {
      out[hook] = list.map((probe) => {
        try { return { id: probe.id, count: document.querySelectorAll(probe.selector).length }; }
        catch { return { id: probe.id, count: -1 }; }
      });
    }
    return out;
  })()`);
  const probes = probeReport.value || {};
  // Only the hooks every Kick route carries can be *required* to match their
  // best probe here. The chat hooks are route-shaped — this gate runs on the
  // home page, where the chat panel is a preview that has never carried
  // `#channel-chatroom` — so a fall-through there is reported, not failed. It
  // is still the number to watch: the day it appears for `main` or `card`, the
  // stable ids went away and the fallbacks are all that is holding the mod up.
  const REQUIRED_HOOKS = new Set(['main', 'sidebar', 'card']);
  const drifted = [];
  const softened = [];
  const winners = [];
  for (const [hook, list] of Object.entries(probes)) {
    const first = list.findIndex((probe) => probe.count > 0);
    if (first === -1) continue; // nothing on this route uses that hook
    winners.push(`${hook}:${list[first].id}`);
    if (first === 0) continue;
    const note = `${hook} fell back to ${list[first].id}; ${list[0].id} matched nothing`;
    if (REQUIRED_HOOKS.has(hook)) drifted.push(note);
    else softened.push(note);
  }
  record('every shell hook Kick shows on all routes matches its most stable probe',
    Object.keys(probes).length > 0 && drifted.length === 0,
    drifted.length
      ? drifted.join(' | ')
      : `${winners.length} hooks: ${winners.join(', ')}${softened.length ? ` | route-shaped fall-through (not a failure): ${softened.join('; ')}` : ''}`);
  record('no shell hook lost every probe it has',
    Object.values(probes).every((list) => list.some((probe) => probe.count >= 0)),
    'a -1 here is a selector Kick made invalid, not merely absent');

  // The library provider against Chromium's real IndexedDB. The pure split and
  // merge are covered by node:test with a stub; what only a browser can answer
  // is whether the database this build opens actually holds the whole record
  // while localStorage holds a bounded seed, and whether the two agree.
  const storeProbe = await evaluate(pageClient, `(async () => {
    const settle = (ms = 600) => new Promise((done) => setTimeout(done, ms));
    await settle();
    const open = () => new Promise((resolve) => {
      const request = indexedDB.open('kick-focus', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    const db = await open();
    if (!db) return { ok: false, why: 'IndexedDB did not open' };
    const stores = [...db.objectStoreNames];
    if (!stores.includes('library')) return { ok: false, why: 'library store missing: ' + JSON.stringify(stores) };
    const record = await new Promise((resolve) => {
      const request = db.transaction('library', 'readonly').objectStore('library').get('preferences');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    const seed = JSON.parse(localStorage.getItem('kick-focus:sticker-preferences') || '{}');
    db.close();
    return {
      ok: true,
      stores,
      stored: Array.isArray(record?.library) ? record.library.length : -1,
      seeded: Array.isArray(seed.library) ? seed.library.length : -1,
      seedTotal: Number(seed.librarySeedTotal),
      favorites: (seed.favorites || []).length,
      storedFavorites: (record?.favorites || []).length,
    };
  })()`);
  const store = storeProbe.value || {};
  record('the emote library is written to IndexedDB with a bounded localStorage seed',
    store.ok === true
      && store.stores?.includes('library') && store.stores?.includes('blobs')
      && store.stored >= 0
      && store.seeded >= 0
      && store.seeded <= 400
      && store.seedTotal === store.stored
      && store.favorites === store.storedFavorites,
    store.ok
      ? `stores ${JSON.stringify(store.stores)}; database holds ${store.stored} entries, seed holds ${store.seeded} of ${store.seedTotal}`
      : store.why);

  // An overlay of ours must land somewhere that renders. Kick's <video> carries
  // `id="video-player"`, and `closest()` tests the element itself first, so the
  // obvious ancestor lookup returns the video — and children of a media element
  // are fallback content that is never drawn. That silently disabled three
  // features at once, and no unit test can see it: it needs Kick's real player
  // markup to reproduce.
  const overlayProbe = await evaluate(pageClient, `(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 700));
    const video = document.querySelector('video');
    if (!video) return { ok: false, why: 'no video on this route' };
    window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
    await settle();
    const tagged = document.querySelector('[data-kf-player]');
    return {
      ok: true,
      videoId: video.id || '',
      // The bug: the tag landing on the video itself. The contain rule is a
      // descendant selector, so it can never match in that case.
      taggedIsVideo: tagged === video,
      taggedTag: tagged ? tagged.tagName : null,
      taggedContainsVideo: Boolean(tagged && tagged !== video && tagged.contains(video)),
      containRuleMatches: document.querySelectorAll('[data-kf-player] video').length,
    };
  })()`);
  const overlay = overlayProbe.value || {};
  record('a player overlay anchors to a container, never to the video element itself',
    overlay.ok === true
      && overlay.taggedIsVideo === false
      && overlay.taggedContainsVideo === true
      && overlay.containRuleMatches >= 1,
    overlay.ok
      ? `video id=${JSON.stringify(overlay.videoId)}; tagged ${overlay.taggedTag}, is the video=${overlay.taggedIsVideo}, contains it=${overlay.taggedContainsVideo}; contain rule matches ${overlay.containRuleMatches}`
      : overlay.why);

  // Uptime, in a tab of its own on a live channel.
  //
  // It needs a channel page and it needs one that is actually live, and by this
  // point the shared page has been navigated back to the home route by earlier
  // probes — which is what the first version of this check reported, correctly,
  // as "no chip on route=home". A separate tab is how the roll-call check
  // solves the same problem, and it leaves every later probe's page untouched.
  //
  // The channel comes from Kick's own live rail rather than a hardcoded name,
  // so the check does not go permanently yellow the day one streamer stops
  // streaming.
  const liveSlugProbe = await evaluate(pageClient, `(() => {
    const links = [...document.querySelectorAll('a[href^="/"]')];
    for (const link of links) {
      const slug = link.getAttribute('href').split('/').filter(Boolean);
      if (slug.length !== 1) continue;
      if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(slug[0])) continue;
      // Kick marks a live rail entry with its own viewer count or LIVE badge.
      if (!/\bLIVE\b|\d/.test(link.textContent || '')) continue;
      return slug[0];
    }
    return '';
  })()`);
  const liveSlug = liveSlugProbe.value || '';

  const uptimeTab = liveSlug ? await (async () => {
    const c = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await c.ready;
    const r = await c.send('Target.createTarget', { url: `https://kick.com/${liveSlug}` });
    c.close();
    return r.result.targetId;
  })() : '';
  if (uptimeTab) await sleep(9000);

  const uptime = uptimeTab ? await (async () => {
    const target = (await json('/json/list')).find((t) => t.id === uptimeTab);
    if (!target?.webSocketDebuggerUrl) return { ok: false, why: 'the uptime tab did not attach' };
    const c = cdp(target.webSocketDebuggerUrl);
    await c.ready;
    try {
      const probe = await evaluate(c, `(async () => {
        const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
        if (!shadow) return { ok: false, why: 'the mod did not mount on the channel tab' };
        const settle = () => new Promise((done) => setTimeout(done, 900));
        const chip = () => document.querySelector('[data-kf-uptime]');

        // The reference comes out of the page rather than the API: Kick's own
        // JSON-LD carries the stream's start as uploadDate, in the same
        // zone-less form, so this needs no request and works signed out — and
        // this browser is one Kick's bot defence answers 429 to. An offline
        // channel carries no VideoObject at all, which is the liveness answer.
        const reference = (() => {
          for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
            try {
              const parsed = JSON.parse(node.textContent);
              const nodes = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
              for (const entry of nodes) {
                if (entry && entry['@type'] === 'VideoObject' && entry.uploadDate) return String(entry.uploadDate);
              }
            } catch { /* Kick ships more than one block; a bad one is not the answer */ }
          }
          return '';
        })();
        if (!reference) return { ok: false, why: 'this channel is not live right now' };
        // Read as UTC, deliberately: that is the claim under test. A build that
        // read it as local time lands whole hours away. (On a machine set to
        // UTC both readings coincide and this cannot fail — the unit test in
        // test/api.test.js is what pins the parse itself.)
        const expected = Math.floor((Date.now() - Date.parse(reference.replace(' ', 'T') + 'Z')) / 1000);
        if (!(expected > 0)) return { ok: false, why: 'this channel is not live right now' };

        const shown = chip();
        if (!shown) return { ok: false, why: 'no uptime chip while the channel is live and the setting is on' };
        const parts = shown.textContent.split(':').map(Number);
        const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
        // Rendered where it can be seen, which appending to a <video> is not.
        const box = shown.getBoundingClientRect();

        let removed = null;
        try {
          shadow.querySelector('[data-action="open-settings"]')?.click();
          await settle();
          shadow.querySelector('[data-page="content"]')?.click();
          await settle();
          // Re-queried each time, never held: changing a setting re-renders the
          // page, so the node clicked first is detached by the second click and
          // that click does nothing at all. Same reason the hide-chip probe
          // above keeps its control behind a function.
          const toggle = () => shadow.querySelector('[data-set="content.showUptime"]');
          if (toggle()) { toggle().click(); await settle(); removed = !chip(); toggle()?.click(); }
        } finally {
          shadow.querySelector('[data-action="close-settings"]')?.click();
        }
        // Poll rather than sleep a fixed beat: the chip comes back on the next
        // apply cycle, which yields to input and is not on a fixed clock.
        let restored = false;
        for (let attempt = 0; attempt < 12 && !restored; attempt += 1) {
          await settle();
          restored = Boolean(chip());
        }
        return { ok: true, text: shown.textContent, seconds, expected, width: Math.round(box.width), height: Math.round(box.height), removed, restored };
      })()`);
      return probe.value || { ok: false, why: probe.error || 'the uptime probe returned nothing' };
    } finally {
      c.close();
      const closer = cdp((await json('/json/version')).webSocketDebuggerUrl);
      await closer.ready;
      await closer.send('Target.closeTarget', { targetId: uptimeTab });
      closer.close();
    }
  })() : { ok: false, why: 'no live channel on the rail to time' };

  if (uptime.ok !== true && /not live right now|no live channel/.test(uptime.why || '')) {
    skip('the uptime chip counts from Kick own start time, read as UTC',
      `${uptime.why}; the check needs a channel that is live at run time`);
  } else record('the uptime chip counts from Kick own start time, read as UTC',
    uptime.ok === true
      // Within a minute of the value computed from Kick's own field. A timezone
      // misparse is off by whole hours and cannot pass this.
      && Math.abs(uptime.seconds - uptime.expected) <= 60
      && uptime.width > 0 && uptime.height > 0
      && uptime.removed === true && uptime.restored === true,
    uptime.ok
      ? `chip reads ${uptime.text} (${uptime.seconds}s) against ${uptime.expected}s from Kick's own page data; ${uptime.width}x${uptime.height}px; hides when switched off=${uptime.removed}, comes back=${uptime.restored}`
      : uptime.why);

  // Poor mode against the two surfaces it used to miss. Both are identified by
  // test id alone and neither is a control — the KICKs balance is a <span>
  // whose whole text is a number, and the gift shop is a panel — so a tagger
  // that walks buttons and links cannot reach either.
  const poorProbe = await evaluate(pageClient, `(async () => {
    const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const settle = () => new Promise((done) => setTimeout(done, 800));
    const before = JSON.parse(localStorage.getItem('kick-focus:settings') || '{}');
    const seen = (id) => document.querySelector('[data-testid="' + id + '"]');
    const present = ['sub-button', 'kicks-value', 'gift-shop-panel'].filter(seen);
    try {
      shadow.querySelector('[data-action="open-settings"]')?.click();
      await settle();
      shadow.querySelector('[data-page="content"]')?.click();
      await settle();
      const toggle = shadow.querySelector('[data-set="content.hideMonetization"]');
      if (!toggle) return { ok: false, why: 'the Poor mode toggle is not on the content page' };
      toggle.click();
      await settle();
      const tagged = Object.fromEntries(present.map((id) => [id, seen(id)?.closest('[data-kf-monetization]')?.dataset.kfMonetization || null]));
      const hidden = Object.fromEntries(present.map((id) => {
        const node = seen(id).closest('[data-kf-monetization]') || seen(id);
        return [id, getComputedStyle(node).display === 'none'];
      }));
      // Free surfaces must survive: Follow, and the channel-points counter that
      // sits directly beside the KICKs balance and reads exactly like it.
      const free = {
        follow: Boolean(document.querySelector('[data-testid="follow-button"]'))
          && !document.querySelector('[data-testid="follow-button"]')?.closest('[data-kf-monetization]'),
        points: !document.querySelector('[data-testid="channel-points-value"]')?.closest('[data-kf-monetization]'),
      };
      toggle.click();
      await settle();
      const restored = Object.fromEntries(present.map((id) => [id, Boolean(seen(id))]));
      return { ok: true, present, tagged, hidden, free, restored };
    } finally {
      localStorage.setItem('kick-focus:settings', JSON.stringify(before));
      window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
      await settle();
      shadow.querySelector('[data-action="close-settings"]')?.click();
    }
  })()`);
  const poor = poorProbe.value || {};
  if (poor.ok === true && poor.present.length === 0) {
    skip('Poor mode reaches the spend surfaces that are not controls, and leaves free ones alone',
      'Kick rendered no spend surface on this route; run the gate against a channel URL to assert it');
  } else record('Poor mode reaches the spend surfaces that are not controls, and leaves free ones alone',
    poor.ok === true
      && poor.present?.length > 0
      // Every surface Kick rendered on this page is both identified and hidden.
      && poor.present.every((id) => poor.tagged?.[id] && poor.hidden?.[id] === true)
      && poor.free?.points === true
      && poor.present.every((id) => poor.restored?.[id] === true),
    poor.ok
      ? `present ${JSON.stringify(poor.present)}; kinds ${JSON.stringify(poor.tagged)}; hidden ${JSON.stringify(poor.hidden)}; free surfaces intact ${JSON.stringify(poor.free)}`
      : poor.why);

  // Colon completion, driven the way a person drives it: turn the setting on,
  // seed a library entry, type into Kick's own composer, click a suggestion.
  // What is under test is that the list appears from a real `input` event, that
  // clicking it puts the plain name at the caret, and — the part that matters
  // most — that nothing about it is keyboard-driven or send-shaped.
  const completeProbe = await evaluate(pageClient, `(async () => {
    const settle = (ms = 400) => new Promise((done) => setTimeout(done, ms));
    const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    // The logged-out home page has no composer of Kick's own, so the probe
    // supplies one carrying the same contract the runtime looks for.
    const input = document.createElement('div');
    input.setAttribute('contenteditable', 'true');
    input.setAttribute('role', 'textbox');
    input.setAttribute('data-testid', 'chat-input');
    input.style.cssText = 'position:fixed;left:4px;bottom:80px;width:240px;height:32px';
    document.body.append(input);
    const submits = [];
    const watch = (event) => { if (event.type === 'submit' || event.key === 'Enter') submits.push(event.type); };
    for (const type of ['submit', 'keydown', 'keypress']) document.addEventListener(type, watch, true);
    const toggle = shadow.querySelector('[data-set="content.emoteAutocomplete"]');
    const wasOn = toggle && toggle.getAttribute('aria-checked') === 'true';
    try {
      if (!toggle) return { ok: false, why: 'autocomplete setting not rendered' };
      if (!wasOn) { toggle.click(); await settle(); }
      // Take a real library name rather than seeding one: the library lives
      // inside the bundle IIFE, and the settings page already renders its keys.
      const seeded = shadow.querySelector('[data-action="copy-sticker-name"], [data-action="insert-sticker-name"]');
      const label = seeded?.getAttribute('aria-label') || '';
      const name = (label.match(/name ([A-Za-z0-9_]+)/) || [])[1];
      if (!name || name.length < 3) return { ok: false, why: 'library is empty on this profile' };

      input.focus();
      document.execCommand('insertText', false, 'hello :' + name.slice(0, 3));
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: name[2], inputType: 'insertText' }));
      await settle();
      const host = document.getElementById('kick-focus-emote-complete');
      const rows = [...(host?.shadowRoot?.querySelectorAll('[data-kf-complete-key]') || [])];
      const opened = host?.dataset.kfOpen === 'true' && rows.length > 0;
      // Every row must clear the pointer-target floor the rest of the UI holds.
      const smallest = rows.length ? Math.min(...rows.map((row) => row.getBoundingClientRect().height)) : 0;
      const chosen = rows[0]?.textContent.trim();
      rows[0]?.click();
      await settle();
      return {
        ok: true,
        name,
        opened,
        chosen,
        labels: rows.map((row) => row.textContent.trim()),
        smallest,
        text: input.textContent || '',
        closed: host?.dataset.kfOpen !== 'true',
        submits,
      };
    } finally {
      for (const type of ['submit', 'keydown', 'keypress']) document.removeEventListener(type, watch, true);
      input.remove();
      if (toggle && !wasOn) toggle.click();
      await settle();
    }
  })()`);
  const complete = completeProbe.value || {};
  record('a colon and two letters offer emotes from the library, accepted by click',
    complete.ok === true
      && complete.opened === true
      && complete.labels?.length > 0
      && complete.text.includes(complete.chosen)
      && !complete.text.includes(`:${String(complete.name).slice(0, 3)}`)
      && !complete.text.includes('[emote:')
      && complete.closed === true,
    complete.ok ? `":${String(complete.name).slice(0, 3)}" offered ${JSON.stringify(complete.labels)}; composer now ${JSON.stringify(complete.text)}` : complete.why);
  record('accepting a suggestion raises no key or submit event on the composer',
    complete.ok === true && Array.isArray(complete.submits) && complete.submits.length === 0
      && complete.smallest >= 24,
    complete.ok ? `events on the composer ${JSON.stringify(complete.submits)}; smallest row ${Math.round(complete.smallest)}px` : complete.why);

  // The chip on a discovery card, and the convergence behind it. Kick's own
  // cards are on screen already, so this uses a real one; the "other tab" is a
  // BroadcastChannel opened from the page, which is exactly what a second tab
  // would be on this origin — the receiving path, the merge, and the chip
  // repaint are all the ones that ship.
  const chipProbe = await evaluate(pageClient, `(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 400));
    const before = JSON.parse(localStorage.getItem('kick-focus:multistream') || '{}');
    try {
      const chip = document.querySelector('[data-kf-card-action="multi"]');
      if (!chip) return { ok: false, why: 'no card chip rendered on this page' };
      const slug = chip.dataset.kfCardSlug;
      const startedActive = chip.dataset.active === 'true';
      if (startedActive) chip.click();
      await settle();
      chip.click();
      await settle();
      const stored = JSON.parse(localStorage.getItem('kick-focus:multistream') || '{}');
      const added = { active: chip.dataset.active, pressed: chip.getAttribute('aria-pressed'), streams: stored.streams || [] };

      // Another tab removes it. Nothing here touches the grid directly.
      const channel = new BroadcastChannel('kick-focus:multi');
      const merged = { ...stored, streams: (stored.streams || []).filter((entry) => entry !== slug) };
      localStorage.setItem('kick-focus:multistream', JSON.stringify(merged));
      channel.postMessage({ type: 'converge', added: [], removed: [slug], ts: Date.now() });
      await settle();
      const live = document.querySelector('[data-kf-card-slug="' + CSS.escape(slug) + '"]');
      const converged = { active: live?.dataset.active, text: live?.textContent };
      channel.close();
      return { ok: true, slug, added, converged };
    } finally {
      localStorage.setItem('kick-focus:multistream', JSON.stringify(before));
      window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
      await settle();
    }
  })()`);
  const chipResult = chipProbe.value || {};
  record('a discovery card can be collected into the grid without opening it',
    chipResult.ok === true
      && chipResult.added?.active === 'true'
      && chipResult.added?.pressed === 'true'
      && Array.isArray(chipResult.added?.streams)
      && chipResult.added.streams.includes(chipResult.slug),
    chipResult.ok ? `chip for ${chipResult.slug} -> grid ${JSON.stringify(chipResult.added.streams)}` : chipResult.why);
  record('another tab removing a channel repaints the chip without a reload',
    chipResult.ok === true && chipResult.converged?.active === 'false' && chipResult.converged?.text === '⊞',
    chipResult.ok ? `after the broadcast the chip reads active=${chipResult.converged?.active}` : chipResult.why);

  // A library at the cap is 2400 tiles, and Kick's own picker needs an account,
  // so the picker is synthesised here: a panel with the shell contract the
  // organizer keys off, filled with enough emote buttons that rendering all of
  // them would be exactly the problem this change removes. What is under test is
  // the organizer's own behaviour against real layout — how many tiles reach the
  // DOM, whether the spacers account for the rest, and whether toggling a
  // favorite rebuilds the window or patches the tile where it stands.
  const organizerProbe = await evaluate(pageClient, `(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 350));
    const TOTAL = 900;
    const panel = document.createElement('div');
    panel.id = 'chat-emotes-picker-panel';
    panel.style.cssText = 'position:fixed;left:-4000px;top:0;width:360px;height:520px;overflow:hidden';
    const scroll = document.createElement('div');
    scroll.className = 'overflow-y-auto';
    scroll.style.cssText = 'width:100%;height:100%';
    panel.append(scroll);
    for (let index = 0; index < TOTAL; index += 1) {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'KfProbe' + index);
      const image = document.createElement('img');
      image.setAttribute('src', 'https://files.kick.com/emotes/' + (700000 + index) + '/fullsize');
      image.setAttribute('alt', 'KfProbe' + index);
      button.append(image);
      scroll.append(button);
    }
    document.body.append(panel);
    try {
      window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
      await settle();
      const organizer = panel.querySelector('[data-kf-sticker-organizer]');
      if (!organizer) return { ok: false, why: 'organizer never rendered' };
      const grid = organizer.querySelector('[data-kf-sticker-grid]');
      if (!grid) return { ok: false, why: 'grid never rendered' };
      const total = Number(grid.dataset.kfStickerTotal) || 0;
      const rendered = grid.querySelectorAll('[data-kf-sticker-item]').length;
      const spacers = [...grid.querySelectorAll('[data-kf-sticker-spacer]')]
        .map((node) => node.getBoundingClientRect().height);
      // Toggle a favorite on the first rendered tile and see what survives.
      const tile = grid.querySelector('[data-kf-sticker-item]');
      const key = tile.dataset.kfStickerKey;
      const before = { tile, grid, state: tile.dataset.kfStickerState };
      tile.querySelector('[data-kf-sticker-action="pin"]').click();
      await settle();
      const afterGrid = panel.querySelector('[data-kf-sticker-grid]');
      const afterTile = afterGrid?.querySelector('[data-kf-sticker-key="' + CSS.escape(key) + '"]');
      const shelves = [...organizer.querySelectorAll('[data-kf-sticker-usage-shelf]')]
        .map((node) => node.getAttribute('data-kf-sticker-usage-shelf'));
      return {
        ok: true,
        total,
        rendered,
        spacers,
        sameGrid: afterGrid === before.grid,
        sameTile: afterTile === before.tile,
        stateChanged: afterTile?.dataset.kfStickerState !== before.state,
        pinned: afterTile?.dataset.kfStickerState,
        shelves,
      };
    } finally {
      panel.remove();
      window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
      await settle();
    }
  })()`);
  const organizerResult = organizerProbe.value || {};
  record('the emote organizer renders a window of a large library and keeps the rest in spacers',
    organizerResult.ok === true
      && organizerResult.total >= 800
      && organizerResult.rendered > 0
      && organizerResult.rendered < organizerResult.total / 2
      && organizerResult.spacers.length > 0
      && organizerResult.spacers.some((height) => height > 100),
    organizerResult.ok
      ? `${organizerResult.rendered} of ${organizerResult.total} tiles in the DOM; spacer heights ${JSON.stringify(organizerResult.spacers.map(Math.round))}`
      : organizerResult.why);
  record('favoriting an emote patches its tile in place instead of rebuilding the window',
    organizerResult.ok === true
      && organizerResult.sameGrid === true
      && organizerResult.sameTile === true
      && organizerResult.stateChanged === true
      && String(organizerResult.pinned).startsWith('true'),
    organizerResult.ok
      ? `grid reused=${organizerResult.sameGrid} tile reused=${organizerResult.sameTile} state now ${organizerResult.pinned}`
      : organizerResult.why);

  // Import now commits every store as one sized transaction instead of ten
  // separate writes, which is a data-loss-shaped change: exercise the real file
  // input rather than trusting that the unit tests covered the wiring.
  const importProbe = await evaluate(pageClient, `(async () => {
    const host = document.getElementById('kick-focus-root');
    const shadow = host && host.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const settle = () => new Promise((done) => setTimeout(done, 600));
    const readSettings = () => localStorage.getItem('kick-focus:settings');
    const before = readSettings();
    if (!before) return { ok: false, why: 'no stored settings to round-trip' };
    const payload = JSON.parse(before);
    // Change one value so a no-op cannot masquerade as a successful import —
    // and take it from the real control, because normalizeSettings drops an
    // accent that is not one of the offered ones and the import would then
    // "succeed" while changing nothing.
    shadow.querySelector('[data-page="appearance"]').click();
    await settle();
    const accents = [...shadow.querySelectorAll('[data-set="appearance.accent"]')].map((node) => node.dataset.value);
    const marker = accents.find((value) => value !== payload.appearance.accent);
    if (!marker) return { ok: false, why: 'no alternative accent offered' };
    payload.appearance.accent = marker;
    // buildSettingsExport spreads the settings at the root; it does not nest
    // them under a "settings" key.
    const file = new File([JSON.stringify(payload)], 'kf.json', { type: 'application/json' });
    const input = shadow.querySelector('[data-kf-import]');
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const applied = JSON.parse(readSettings() || '{}').appearance?.accent;
    const toast = String(shadow.querySelector('.kf-toast-text')?.textContent || '');
    // Undo must put the previous value back from the pre-import backup. The
    // control only renders on About, and only while a backup exists.
    shadow.querySelector('[data-page="about"]').click();
    await settle();
    const undo = shadow.querySelector('[data-action="undo-import"]');
    if (!undo) return { ok: false, why: 'no undo control after import' };
    undo.click();
    await settle();
    const restored = JSON.parse(readSettings() || '{}').appearance?.accent;
    return { ok: true, marker, applied, restored, was: payload.appearance.accent, original: JSON.parse(before).appearance.accent, toast };
  })()`);
  const round = importProbe.value || {};
  record('an import commits as one transaction and Undo puts the previous settings back',
    round.ok === true
      && round.applied === round.marker
      && round.restored === round.original
      && /imported/i.test(round.toast),
    round.ok ? `accent ${round.original} -> ${round.applied} -> ${round.restored}` : round.why);

  const escapeProbe = await evaluate(pageClient, `(() => {
    const host = document.getElementById('kick-focus-root');
    const shadow = host && host.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    const q = (selector) => shadow.querySelector(selector);
    const press = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    const open = () => ({
      settings: q('[data-kf-settings-backdrop]').hidden === false,
      confirm: q('[data-kf-confirm]').hidden === false,
    });
    q('[data-kf-quick]').click();
    q('[data-action="command:settings"]').click();
    if (!open().settings) return { ok: false, why: 'settings did not open' };
    // Land on a page that actually has settings to reset: About disables the
    // control, so leaving the page to whatever ran before makes this pass or
    // fail on probe order rather than on behaviour.
    q('[data-page="layout"]').click();
    q('[data-action="reset-page"]').click();
    const prompted = open();
    const focusedPrompt = shadow.activeElement
      && shadow.activeElement.closest('.kf-confirm-card') !== null;
    press();
    const afterEscape = open();
    press();
    return { ok: true, prompted, focusedPrompt, afterEscape, closed: open() };
  })()`);
  const esc = escapeProbe.value || {};
  record('Escape on the reset prompt cancels only the prompt, leaving Settings open',
    esc.ok === true
      && esc.prompted?.settings === true && esc.prompted?.confirm === true
      && esc.focusedPrompt === true
      && esc.afterEscape?.confirm === false && esc.afterEscape?.settings === true
      && esc.closed?.settings === false,
    esc.ok ? `prompted=${JSON.stringify(esc.prompted)} focusedPrompt=${esc.focusedPrompt} afterEscape=${JSON.stringify(esc.afterEscape)} closed=${JSON.stringify(esc.closed)}` : esc.why);

  // These describe how Kick Focus treats Kick's own markup, so they are only
  // meaningful when Kick's markup is present. Reported as skipped rather than
  // passed when it is not.
  if (reachedKick) {
    const overflow = await evaluate(pageClient, 'document.documentElement.scrollWidth <= window.innerWidth');
    record(`no horizontal document overflow at ${WINDOW_SIZE.replace(',', '×')}`, overflow.value === true);

    const cards = await evaluate(pageClient, 'document.querySelectorAll("[data-kf-live-card]").length');
    record('card detection found Kick cards', Number(cards.value) > 0, `${cards.value} cards scored`);

    // The fail-open ceiling must not fire on an ordinary page. If it does, the
    // labels are over-matching and real content is scored as promotional.
    const suspended = await evaluate(pageClient, 'document.documentElement.dataset.kfFilterSuspended || "unset"');
    record('content filtering did not fail open on a normal page', suspended.value === 'false', `kfFilterSuspended=${suspended.value}`);

    const filtered = await evaluate(pageClient, 'document.querySelectorAll("[data-kf-filtered]").length');
    console.log(`INFO  cards hidden by filters: ${filtered.value} of ${cards.value}`);

    const adShells = await evaluate(pageClient, `document.querySelectorAll(${JSON.stringify([
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
    ].join(','))}).length`);
    record('no ad creative or empty ad shell remains in the Kick DOM', Number(adShells.value) === 0, `${adShells.value} matching nodes`);
  } else {
    console.log('SKIP  layout, card detection, and filter checks need the real Kick DOM');
    console.log('      Run with a non-headless browser, or use the offline DOM fixtures.');
  }

  if (process.env.KF_SCREENSHOT_PATH && reachedKick) {
    const capture = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    if (capture.result?.data) {
      await writeFile(resolve(process.env.KF_SCREENSHOT_PATH), Buffer.from(capture.result.data, 'base64'));
      record(`captured ${WINDOW_SIZE.replace(',', '×')} release screenshot`, true, process.env.KF_SCREENSHOT_PATH);
    } else {
      record(`captured ${WINDOW_SIZE.replace(',', '×')} release screenshot`, false, 'CDP returned no image data');
    }
  }

  // 3b. On a fresh profile nothing has ever been saved, so this proves the
  //     page announced its effective defaults and the worker acted on them.
  //     Reduce tracking telemetry defaults to on, so its ruleset must now be
  //     enabled even though the packaged manifest ships it disabled.
  const syncedRulesets = await evaluate(swClient, 'chrome.declarativeNetRequest.getEnabledRulesets()');
  record('page defaults reached the network rulesets',
    Array.isArray(syncedRulesets.value) && syncedRulesets.value.includes('telemetry'),
    JSON.stringify(syncedRulesets.value));

  // 4. Informational only. Zero matches on a natural load is the expected
  //    result when the page-realm hooks win the race: they stop the ad request
  //    before it is ever issued, leaving the network layer nothing to block.
  //    A channel with no ads running produces zero matches too, so this number
  //    can never be an assertion.
  const matched = await evaluate(swClient, 'chrome.declarativeNetRequest.getMatchedRules({}).then(r => JSON.stringify(r.rulesMatchedInfo.map(m => m.rule)))');
  const parsed = matched.value ? JSON.parse(matched.value) : [];
  console.log(`INFO  DNR matches during natural page load: ${parsed.length}${parsed.length ? ` (${matched.value?.slice(0, 160)})` : ' (page-realm hooks blocked first, or no ads were served)'}`);

  // 5. Direct network proof. An <img> whose src is JavaScript fires onerror
  //    whether or not it was blocked, so the page-side outcome proves nothing.
  //    CDP's loadingFailed errorText is the authority: ERR_BLOCKED_BY_CLIENT
  //    means the browser network stack refused it, which only DNR can do here.
  //    A <link rel=preload> is used because the page-realm hooks patch fetch,
  //    XHR, and setAttribute, and this probe must bypass them to test DNR alone.
  await pageClient.send('Network.enable');
  const before = pageClient.events.length;
  await evaluate(pageClient, `
    (() => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js?kfprobe=1';
      document.head.appendChild(link);
      return true;
    })()`);
  await sleep(4000);

  const probeEvents = pageClient.events.slice(before);
  const sent = probeEvents.filter((e) => e.method === 'Network.requestWillBeSent'
    && e.params?.request?.url?.includes('kfprobe=1'));
  const failedEvents = probeEvents.filter((e) => e.method === 'Network.loadingFailed');
  const blockedByClient = failedEvents.some((e) => e.params?.errorText?.includes('ERR_BLOCKED_BY_CLIENT'));
  record('ad-host probe was blocked by the browser network stack', blockedByClient,
    blockedByClient ? 'ERR_BLOCKED_BY_CLIENT' : `sent=${sent.length} failures=${failedEvents.map((e) => e.params?.errorText).join('|') || 'none'}`);

  // getMatchedRules needs declarativeNetRequestFeedback, which the RELEASE
  // manifest deliberately omits so Chrome does not show "Read your browsing
  // history". The ERR_BLOCKED_BY_CLIENT proof above is the authority; this
  // readback is a bonus that only the dev manifest can grant. Asserting it
  // against the release artifact would fail a gate on an API the shipped
  // extension cannot call by design, so it is conditional on the permission.
  const hasFeedback = await evaluate(swClient, "chrome.runtime.getManifest().permissions.includes('declarativeNetRequestFeedback')");
  if (hasFeedback.value) {
    const matchedAfter = await evaluate(swClient, 'chrome.declarativeNetRequest.getMatchedRules({}).then(r => JSON.stringify(r.rulesMatchedInfo.map(m => m.rule.ruleId)))');
    record('DNR reports the matched rule', Boolean(matchedAfter.value && matchedAfter.value !== '[]'), `rules=${matchedAfter.value}`);
  } else {
    console.log('INFO  DNR matched-rule readback skipped — the release manifest omits declarativeNetRequestFeedback by design; ERR_BLOCKED_BY_CLIENT above is the authoritative block proof.');
  }

  // 6. The popup is real UI; opening it proves it renders and wires up rather
  //    than merely existing as a file in the package.
  const popupId = await (async () => {
    const c = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await c.ready;
    const r = await c.send('Target.createTarget', { url: `chrome-extension://${extensionId}/popup.html` });
    c.close();
    return r.result.targetId;
  })();
  // The daily-reward auto-claim, against a reproduction of Kick's own dialog.
  //
  // The real trigger only exists for a signed-in account and this gate runs
  // logged out, so the markup below is rebuilt from a capture of the live
  // dialog: the nested `<div class="contents">Claim</div>`, the button carrying
  // BOTH `disabled` and `aria-disabled="true"` until ready, and the sibling
  // "Watch N more minutes to claim". What that proves is the whole mechanism —
  // that a disabled reward is left alone, that a ready one is clicked exactly
  // once, and that a claim is not chased again afterwards. What it cannot prove
  // is that Kick's markup still matches the capture; only a signed-in run can.
  const rewardProbe = await evaluate(pageClient, `(async () => {
    const settle = (ms = 500) => new Promise((done) => setTimeout(done, ms));
    const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
    if (!shadow) return { ok: false, why: 'no shadow host' };
    // This runs last, after other checks have moved the panel around, so put it
    // back on the page that owns the setting before reaching for it.
    document.dispatchEvent(new CustomEvent('kick-focus:open-settings'));
    await settle();
    shadow.querySelector('[data-page="content"]')?.click();
    await settle();
    const toggle = shadow.querySelector('[data-set="content.autoClaimRewards"]');
    if (!toggle) return { ok: false, why: 'auto-claim setting not rendered' };
    const wasOn = toggle.getAttribute('aria-checked') === 'true';
    localStorage.removeItem('kick-focus:reward-claims');
    // The claim deliberately refuses to open Kick's dialog while a Kick Focus
    // panel is up — it would take focus from someone reading it. Earlier checks
    // leave the settings panel open, so without closing it here every scenario
    // below would "pass" by never running at all.
    const host = document.getElementById('kick-focus-root');
    const panelWasOpen = Boolean(host) && !host.hidden;
    const closePanel = () => shadow.querySelector('[data-action="close-settings"]')?.click();
    const reopenPanel = () => document.dispatchEvent(new CustomEvent('kick-focus:open-settings'));

    let clicks = 0;
    const mount = (ready) => {
      const trigger = document.createElement('button');
      trigger.setAttribute('aria-label', 'Claim Your Daily Reward');
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.style.cssText = 'position:fixed;left:-3000px;top:0';
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.style.cssText = 'position:fixed;left:-3000px;top:60px';
      dialog.hidden = true;
      const action = document.createElement('button');
      // Exactly as captured: the label is nested, not a direct text child.
      action.innerHTML = '<div class="contents">Claim</div>';
      if (!ready) { action.disabled = true; action.setAttribute('aria-disabled', 'true'); }
      action.addEventListener('click', () => { clicks += 1; });
      const note = document.createElement('p');
      note.textContent = ready ? '' : 'Watch 54 more minutes to claim';
      const close = document.createElement('button');
      close.setAttribute('aria-label', 'Close');
      dialog.append(action, note, close);
      trigger.addEventListener('click', () => {
        const open = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!open));
        dialog.hidden = open;
      });
      document.body.append(trigger, dialog);
      return { trigger, dialog };
    };
    const teardown = (parts) => { parts.trigger.remove(); parts.dialog.remove(); };
    const cycle = async () => {
      // Two cycles: one opens the dialog, the next acts on it.
      // The apply cycle coalesces route changes, so "two dispatches" is not
      // reliably two cycles — and the claim needs one pass to open Kick's
      // dialog and the next to act on it. Four, with room between, is.
      for (let pass = 0; pass < 4; pass += 1) {
        window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
        await settle(450);
      }
    };

    try {
      if (!wasOn) { toggle.click(); await settle(); }
      closePanel();
      await settle();
      // Closing the panel restores focus to whatever had it before, which on
      // the home page can be a header input — and the claim rightly refuses to
      // open a dialog under a focused field. Clear it the way a click on empty
      // page background would.
      document.activeElement?.blur?.();
      await settle(200);
      // Re-read the toggle: changing a setting re-renders the page, so the
      // node captured earlier is detached and reports a stale aria-checked.
      const liveToggle = () => shadow.querySelector('[data-set="content.autoClaimRewards"]');
      const diag = {
        panelShown: Boolean(shadow.querySelector('[data-kf-settings-shell]')?.closest('[hidden]') === null),
        active: document.activeElement?.tagName || null,
        enabled: liveToggle()?.getAttribute('aria-checked'),
      };

      // 1. Not ready: the dialog is opened and read, and nothing is clicked.
      let parts = mount(false);
      await cycle();
      const notReady = { clicks, reached: parts.dialog.dataset.kfRewardDialog === 'true' || parts.trigger.dataset.kfSeen === 'true' };
      // Proof the mechanism actually ran rather than being skipped: the record
      // only exists if the claim opened Kick's dialog.
      // The schedule is the point: "Watch 54 more minutes" has to buy roughly
      // 55 minutes of quiet, not another look in ten.
      const afterNotReady = JSON.parse(localStorage.getItem('kick-focus:reward-claims') || '{}');
      notReady.attempted = Number(afterNotReady.nextCheckAt) > 0;
      notReady.waitMinutes = Math.round((Number(afterNotReady.nextCheckAt) - Date.now()) / 60000);
      teardown(parts);
      localStorage.removeItem('kick-focus:reward-claims');
      await settle();

      // 2. Ready: exactly one click, and the claim is recorded.
      clicks = 0;
      parts = mount(true);
      await cycle();
      const ready = { clicks, stored: JSON.parse(localStorage.getItem('kick-focus:reward-claims') || 'null') };
      // A claim sleeps to the nightly rollover, whatever hour the run happens at.
      ready.nextHour = ready.stored?.nextCheckAt ? new Date(ready.stored.nextCheckAt).getHours() : null;

      // 3. Already claimed: the backoff must stop a second claim.
      clicks = 0;
      await cycle();
      const again = { clicks };
      teardown(parts);

      // 4. Off: a ready reward is left completely alone. Re-query rather than
      // reusing the captured node — changing a setting re-renders the page, so
      // the original is detached and clicking it changes nothing.
      liveToggle()?.click();
      await settle();
      closePanel();
      await settle();
      localStorage.removeItem('kick-focus:reward-claims');
      clicks = 0;
      parts = mount(true);
      await cycle();
      const off = { clicks, opened: parts.trigger.getAttribute('aria-expanded') };
      teardown(parts);

      return { ok: true, diag, notReady, ready, again, off };
    } finally {
      localStorage.removeItem('kick-focus:reward-claims');
      for (const node of document.querySelectorAll('[aria-label="Claim Your Daily Reward"]')) node.remove();
      if (panelWasOpen) { reopenPanel(); await settle(); }
      const restore = shadow.querySelector('[data-set="content.autoClaimRewards"]');
      if (restore?.getAttribute('aria-checked') === 'true' && !wasOn) restore.click();
      await settle();
    }
  })()`);
  const reward = rewardProbe.value || {};
  record('a reward Kick has not unlocked is never clicked, and its countdown sets the next look',
    // `attempted` is what makes this non-vacuous: it proves the claim really
    // opened the dialog and then declined, rather than never running. The wait
    // proves it scheduled from Kick's own "Watch 54 more minutes" rather than
    // from the fallback interval.
    reward.ok === true && reward.notReady?.clicks === 0 && reward.notReady?.attempted === true
      && reward.notReady?.waitMinutes >= 50 && reward.notReady?.waitMinutes <= 56,
    reward.ok ? `dialog opened=${reward.notReady?.attempted}, clicked ${reward.notReady?.clicks} times, next look in ${reward.notReady?.waitMinutes} min` : reward.why);
  record('a ready reward is claimed once and then sleeps to the nightly rollover',
    reward.ok === true && reward.ready?.clicks === 1 && Number(reward.ready?.stored?.lastClaimAt) > 0
      && reward.ready?.nextHour === 20,
    reward.ok ? `clicks=${reward.ready?.clicks}, stored claims=${reward.ready?.stored?.claims}, next check at hour ${reward.ready?.nextHour}` : reward.why);
  record('a reward already claimed is not chased again',
    reward.ok === true && reward.again?.clicks === 0,
    reward.ok ? `second pass clicked ${reward.again?.clicks} times` : reward.why);
  record('with the setting off the reward dialog is never even opened',
    reward.ok === true && reward.off?.clicks === 0 && reward.off?.opened === 'false',
    reward.ok ? `clicks=${reward.off?.clicks}, trigger expanded=${reward.off?.opened}` : reward.why);


  await sleep(2500);
  const popupTarget = (await json('/json/list')).find((t) => t.id === popupId);
  const popupClient = cdp(popupTarget.webSocketDebuggerUrl);
  await popupClient.ready;
  await popupClient.send('Runtime.enable');

  const popupVersion = await evaluate(popupClient, 'document.getElementById("version").textContent');
  record('popup renders and reads the extension version', popupVersion.value === `v${EXPECTED_VERSION}`, String(popupVersion.value));

  const popupStatus = await evaluate(popupClient, 'document.getElementById("network-title").textContent');
  record('popup reports the network layer', popupStatus.value === 'Network layer active', String(popupStatus.value));

  const liveRulesets = await evaluate(swClient, 'chrome.declarativeNetRequest.getEnabledRulesets()');
  const popupRulesets = await evaluate(popupClient, 'document.getElementById("rulesets").textContent');
  record('popup reads live ruleset state',
    popupRulesets.value === String(liveRulesets.value?.length),
    `popup=${popupRulesets.value} worker=${JSON.stringify(liveRulesets.value)}`);

  const popupTelemetry = await evaluate(popupClient, 'document.getElementById("telemetry").checked');
  record('popup reflects the stored telemetry setting', popupTelemetry.value === true, String(popupTelemetry.value));

  const popupErrors = popupClient.events
    .filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => e.params?.exceptionDetails?.text);
  record('popup raised no exceptions', popupErrors.length === 0, popupErrors.join('|') || 'clean');

  popupClient.close();
  swClient.close();
  pageClient.close();

  console.log(`\nExtension id: ${extensionId}`);
  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
  if (failures.length) {
    console.log(`Failed: ${failures.map((f) => f.label).join('; ')}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error('VERIFY ERROR:', error.message);
  console.error(stderr.split('\n').filter((l) => /extension|ERROR|WARN/i.test(l)).slice(0, 12).join('\n'));
  process.exitCode = 1;
} finally {
  child.kill('SIGKILL');
  await sleep(600);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
