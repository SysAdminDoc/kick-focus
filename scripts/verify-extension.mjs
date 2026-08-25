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
 *   KF_USER_DATA_DIR=/path/to/profile node scripts/verify-extension.mjs   # signed-in journeys
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { LOCATOR_PROBES } from '../src/compatibility.mjs';
import { VIEWER_HUB_CARDS } from '../src/core.mjs';
import { inlineScriptVerdict } from './csp.mjs';
import { CAPTURABLE, FIXTURE_CONTRACT } from './fixture-contract.mjs';
import { SIGNED_IN_JOURNEYS } from './signed-in-journeys.mjs';

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

/**
 * A throwaway profile by default, so a run cannot inherit or leave state.
 *
 * `KF_USER_DATA_DIR` points it at a profile the operator keeps — the only way
 * to give the run a Kick session, which is what turns the signed-in journey
 * matrix from skips into assertions. A profile the operator owns is never
 * deleted afterwards.
 */
const ownedProfile = process.env.KF_USER_DATA_DIR || '';
const profile = ownedProfile || await mkdtemp(join(tmpdir(), 'kf-verify-'));
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
  results.push({ label, ok, detail, outcome: ok ? 'pass' : 'fail' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

/**
 * Route a probe result to the right one of three outcomes.
 *
 * A probe can fail for two entirely different reasons, and collapsing them into
 * one verdict is what made this gate cry wolf: `no video on this route` is the
 * operator pointing it at the home page, while a real defect is the product
 * being broken. A probe says which it means by returning a `skip` field naming
 * what was missing, instead of `{ ok: false, why }`; everything else asserts
 * exactly as before. A skip reason has to be actionable — `scripts/check.mjs`
 * rejects a bare noun, because a skip nobody can act on is just silence.
 */
const recordProbe = (label, probe, ok, detail = '') => {
  if (probe && typeof probe.skip === 'string' && probe.skip) {
    skip(label, probe.skip);
    return;
  }
  record(label, ok, detail);
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
  results.push({ label, ok: true, detail: why, outcome: 'skip' });
  console.log(`SKIP  ${label} — ${why}`);
};

/**
 * The page-world helper every probe uses before reading anything this mod paints.
 *
 * Installed once, into the page, because the probes are evaluated as page-world
 * source. Two behaviours matter and both were learned the hard way:
 *
 * 1. It polls instead of sampling. A probe that reads `querySelector` once races
 *    the apply cycle, which is a capped debounce (`APPLY_MAX_WAIT` = 500 ms in
 *    core.mjs) driven by a MutationObserver — so on a quiet moment the thing
 *    being asserted may simply not be painted yet. On 2026-08-17 exactly that
 *    reported a shipped feature as dead and it was investigated as a P0.
 * 2. It pokes the DOM between polls. `scheduleApply` only runs when something
 *    mutates, so on a page that has gone still, waiting alone can wait forever;
 *    a comment node appended and removed is the cheapest legal mutation.
 *
 * Returns the predicate's truthy value, or null once the budget is spent.
 */
const PAGE_WAIT_HELPER = `window.__kfWait = async function (predicate, options) {
  const timeout = (options && options.timeout) || 8000;
  const interval = (options && options.interval) || 150;
  const deadline = Date.now() + timeout;
  for (;;) {
    let value = null;
    try { value = predicate(); } catch { value = null; }
    if (value) return value;
    if (Date.now() >= deadline) return null;
    const poke = document.createComment('kf-wait');
    document.body.appendChild(poke);
    poke.remove();
    await new Promise((done) => setTimeout(done, interval));
  }
};
window.__kfWaitInstalled = true;`;

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

async function evaluate(client, expression, options = {}) {
  const res = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    // Transient activation, for the one API that refuses without it:
    // `documentPictureInPicture.requestWindow()` throws unless the call is
    // attributable to a user gesture.
    userGesture: options.userGesture === true,
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
  // The shipped default is asserted statically in `scripts/check.mjs`
  // ("telemetry ruleset ships opt-in"), reading the manifest — the only place
  // that claim can be checked without a race. It is deliberately not re-checked
  // here: the target page loads while the worker is still starting, so by the
  // time this runs the mod may already have booted and reported settings that
  // legitimately enable telemetry blocking. A runtime read cannot tell that
  // apart from a wrong default, and a gate that fails for a reason which is not
  // a defect trains people to ignore it. What is honest to assert at runtime is
  // that the worker enables nothing the manifest never declared.
  const declaredRulesets = JSON.parse(await readFile(resolve('dist/extension/manifest.json'), 'utf8'))
    .declarative_net_request.rule_resources.map((entry) => entry.id);
  const undeclared = Array.isArray(rulesets.value) ? rulesets.value.filter((id) => !declaredRulesets.includes(id)) : ['unreadable'];
  record('the worker enables no ruleset the manifest does not declare', undeclared.length === 0,
    `enabled ${JSON.stringify(rulesets.value)} against declared ${JSON.stringify(declaredRulesets)}`);

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

  // Every probe below reads state this mod paints on its own schedule, so the
  // waiter has to exist before any of them run.
  await evaluate(pageClient, PAGE_WAIT_HELPER);
  const waiterReady = await evaluate(pageClient, 'window.__kfWaitInstalled === true');
  record('the probe waiter is installed in the page', waiterReady.value === true);

  // R-87: exercise the document-level hover and focus handlers on the real
  // Kick page. A synthetic followed row is used only when the signed-in rail is
  // genuinely empty. If Kick rendered a native row, that row itself must be
  // tagged or the probe fails. A deliberately hidden rail is a skip because the
  // feature must not punch through the user's layout choice.
  const followingPreviewProbe = await evaluate(pageClient, `(async () => {
    const sidebarProbes = ${JSON.stringify(LOCATOR_PROBES.sidebar)};
    let sidebar = null;
    for (const probe of sidebarProbes) {
      const candidate = document.querySelector(probe.selector);
      if (!candidate) continue;
      sidebar = probe.id === 'sidebar-owner'
        ? candidate.closest('[data-sidebar]') || candidate.parentElement || candidate
        : candidate;
      break;
    }
    if (!sidebar || getComputedStyle(sidebar).display === 'none'
      || document.documentElement.dataset.kfSidebar === 'hidden') {
      return { skip: 'the followed-channel rail is hidden on this run' };
    }
    const ready = await __kfWait(() => document.getElementById('kick-focus-root')?.dataset.kfFollowingPreviewReady === 'true');
    if (!ready) return { ok: false, why: 'the preview interaction lifecycle never reported ready' };
    const settle = (ms = 90) => new Promise((done) => setTimeout(done, ms));
    const nativeMarkers = () => [...sidebar.querySelectorAll('[data-testid^="sidebar-following-channel-"]')];
    let row = await __kfWait(() => sidebar.querySelector('[data-kf-following-preview="true"]'), { timeout: 1200 });
    const nativeMarkerCount = nativeMarkers().length;
    let synthetic = false;
    if (!row && nativeMarkerCount) {
      const marker = nativeMarkers()[0];
      row = marker.matches('a[href], button, [role="link"], [tabindex]')
        ? marker
        : marker.querySelector('a[href], button, [role="link"], [tabindex]')
          || marker.closest('a[href], button, [role="link"], [tabindex]');
      if (!row) return { ok: false, why: nativeMarkerCount + ' native followed row(s) rendered without a usable control' };
    }
    if (!row) {
      synthetic = true;
      row = document.createElement('button');
      row.type = 'button';
      row.dataset.testid = 'sidebar-following-channel-kf-probe';
      row.dataset.kfLivePreviewProbe = 'true';
      row.setAttribute('aria-label', 'Preview geometry probe');
      row.style.cssText = 'display:flex;width:200px;height:42px;align-items:center';
      const image = document.createElement('img');
      image.alt = '';
      image.width = 160;
      image.height = 90;
      image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#152019"/><rect x="12" y="12" width="70" height="66" rx="8" fill="#53fc18"/></svg>');
      row.append(image);
      sidebar.append(row);
      await image.decode().catch(() => {});
    }
    if (!row) return { ok: false, why: 'a visible followed row exposed no preview control' };
    row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    await __kfWait(() => document.getElementById('kick-focus-following-preview')?.dataset.kfOpen === 'true', { timeout: 2500 });
    const host = document.getElementById('kick-focus-following-preview');
    const hoverBox = host?.getBoundingClientRect();
    const hoverOpen = host?.dataset.kfOpen === 'true' && host.hidden === false;
    const onScreen = Boolean(hoverBox)
      && hoverBox.left >= 0 && hoverBox.top >= 0
      && hoverBox.right <= innerWidth && hoverBox.bottom <= innerHeight;
    const sourceExisting = host?.dataset.kfSource === 'existing-image';
    row.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    row.focus();
    row.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: document.body }));
    await settle();
    const focusOpen = host?.dataset.kfOpen === 'true' && row.getAttribute('aria-describedby')?.includes(host.id);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    row.dispatchEvent(escape);
    await settle(30);
    return {
      ok: true,
      synthetic,
      nativeMarkers: nativeMarkerCount,
      tagged: row.dataset.kfFollowingPreview === 'true',
      hoverOpen,
      focusOpen,
      focusReturned: document.activeElement === row,
      escapePrevented: escape.defaultPrevented,
      escapeClosed: host?.hidden === true && host?.dataset.kfOpen !== 'true',
      onScreen,
      sourceExisting,
      width: Math.round(hoverBox?.width || 0),
      height: Math.round(hoverBox?.height || 0),
    };
  })()`);
  const followingPreview = followingPreviewProbe.value || {};
  recordProbe('followed-channel preview opens by hover and focus, stays on-screen, and Escape closes it', followingPreview,
    followingPreview.ok === true && followingPreview.tagged === true
      && followingPreview.hoverOpen === true && followingPreview.focusOpen === true
      && followingPreview.focusReturned === true
      && followingPreview.escapePrevented === true && followingPreview.escapeClosed === true
      && followingPreview.onScreen === true && followingPreview.sourceExisting === true
      && followingPreview.width > 0 && followingPreview.height > 0,
    followingPreview.ok
      ? `${followingPreview.synthetic ? 'synthetic empty-rail fallback' : `${followingPreview.nativeMarkers} native row(s)`}, tagged=${followingPreview.tagged}, ${followingPreview.width}x${followingPreview.height}px, hover=${followingPreview.hoverOpen}, focus=${followingPreview.focusOpen}, focus returned=${followingPreview.focusReturned}, Escape=${followingPreview.escapeClosed}, on-screen=${followingPreview.onScreen}`
      : followingPreview.why);

  if (!followingPreview.skip) {
    await pageClient.send('Emulation.setEmulatedMedia', { features: [] });
    const ordinaryFollowingPreviewProbe = await evaluate(pageClient, `(async () => {
      const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
      const row = document.querySelector('[data-kf-live-preview-probe], [data-kf-following-preview="true"]');
      if (!shadow || !row) return { ok: false, why: 'the preview controls disappeared before the motion-preference pass' };
      const settle = (ms = 160) => new Promise((done) => setTimeout(done, ms));
      shadow.querySelector('[data-kf-quick]')?.click();
      await settle();
      shadow.querySelector('[data-page="accessibility"]')?.click();
      await settle();
      const control = shadow.querySelector('[data-set="accessibility.reduceMotion"]');
      if (!control) return { ok: false, why: 'the Reduced Motion control is unavailable' };
      const restoreReducedMotion = control.getAttribute('aria-checked') === 'true';
      if (restoreReducedMotion) { control.click(); await settle(450); }
      shadow.querySelector('[data-action="close-settings"]')?.click();
      row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
      await settle();
      const host = document.getElementById('kick-focus-following-preview');
      return {
        ok: true,
        restoreReducedMotion,
        open: host?.dataset.kfOpen === 'true',
        imageMode: host?.dataset.kfStatic === 'false'
          && host.querySelector('img')?.hidden === false
          && host.querySelector('canvas')?.hidden === true,
      };
    })()`);
    const ordinaryFollowingPreview = ordinaryFollowingPreviewProbe.value || {};
    record('followed-channel preview uses its ordinary image when neither motion preference is enabled',
      ordinaryFollowingPreview.ok === true && ordinaryFollowingPreview.open === true
        && ordinaryFollowingPreview.imageMode === true,
      ordinaryFollowingPreview.ok
        ? `open=${ordinaryFollowingPreview.open}, ordinary image=${ordinaryFollowingPreview.imageMode}`
        : ordinaryFollowingPreview.why);
    await pageClient.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    const reducedFollowingPreviewProbe = await evaluate(pageClient, `(async () => {
      const row = document.querySelector('[data-kf-live-preview-probe], [data-kf-following-preview="true"]');
      if (!row) return { ok: false, why: 'the followed row disappeared before the reduced-motion pass' };
      row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
      await new Promise((done) => setTimeout(done, 100));
      const host = document.getElementById('kick-focus-following-preview');
      const result = {
        ok: true,
        open: host?.dataset.kfOpen === 'true',
        staticFrame: host?.dataset.kfStatic === 'true'
          && host.querySelector('canvas')?.hidden === false
          && host.querySelector('img')?.hidden === true,
      };
      if (${ordinaryFollowingPreview.restoreReducedMotion === true}) {
        const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
        shadow?.querySelector('[data-kf-quick]')?.click();
        await new Promise((done) => setTimeout(done, 160));
        shadow?.querySelector('[data-page="accessibility"]')?.click();
        await new Promise((done) => setTimeout(done, 160));
        const control = shadow?.querySelector('[data-set="accessibility.reduceMotion"]');
        if (control?.getAttribute('aria-checked') !== 'true') control?.click();
        await new Promise((done) => setTimeout(done, 450));
        shadow?.querySelector('[data-action="close-settings"]')?.click();
      }
      document.querySelector('[data-kf-live-preview-probe]')?.remove();
      return result;
    })()`);
    await pageClient.send('Emulation.setEmulatedMedia', { features: [] });
    const reducedFollowingPreview = reducedFollowingPreviewProbe.value || {};
    record('followed-channel preview uses a canvas still under prefers-reduced-motion',
      reducedFollowingPreview.ok === true && reducedFollowingPreview.open === true
        && reducedFollowingPreview.staticFrame === true,
      reducedFollowingPreview.ok
        ? `open=${reducedFollowingPreview.open}, static canvas=${reducedFollowingPreview.staticFrame}`
        : reducedFollowingPreview.why);
  }

  // R-83: a discovery clock is useful only if it comes from data Kick already
  // sent, stays paired with Kick's own LIVE marker, and fits the card. The
  // source boundary is proved offline. This live half proves the derived value
  // and its geometry at the exact desktop viewport established above.
  const discoveryUptimeProbe = await evaluate(pageClient, `(async () => {
    if (location.pathname !== '/') return { skip: 'this run did not target the home discovery route' };
    const feedReads = performance.getEntriesByType('resource').filter((entry) => {
      const parts = new URL(entry.name, location.origin).pathname.split('/').filter(Boolean);
      return parts[0] === 'api' && /^v[0-9]+$/i.test(parts[1] || '') && parts[2] === 'livestreams';
    });
    const cardSelector = '[data-testid="livestream-results-card"], [data-testid="stream-card"], [class*="group/card"]';
    const exactLive = (card) => [...card.querySelectorAll('span, [class*="badge"], [data-testid*="badge"], [data-testid*="live"]')]
      .find((node) => !node.closest('[data-kf-card-uptime]') && (node.textContent || '').trim().toLowerCase() === 'live');
    const eligible = () => [...document.querySelectorAll(cardSelector)].filter((card) => {
      const href = card.querySelector('a[href]')?.getAttribute('href') || '';
      let url = null;
      try { url = new URL(href, location.origin); } catch { return false; }
      const parts = url.pathname.split('/').filter(Boolean);
      const host = url.hostname.toLowerCase();
      return (host === 'kick.com' || host.endsWith('.kick.com')) && parts.length === 1 && exactLive(card);
    });
    const chip = await __kfWait(() => document.querySelector('[data-kf-card-uptime]'), { timeout: 10000 });
    if (!feedReads.length) return { skip: 'Kick did not issue a discovery livestream feed on the home route' };
    if (!eligible().length) return { skip: 'Kick rendered no live discovery card with a channel destination' };
    if (!chip) return { ok: false, why: 'Kick issued a live discovery feed and rendered live cards, but no duration appeared' };

    const card = chip.closest('[data-kf-card-uptime-owner]');
    const liveBadge = card && exactLive(card);
    const shownParts = String(chip.textContent || '').split(':').map(Number);
    const shownSeconds = shownParts.length === 3
      ? shownParts[0] * 3600 + shownParts[1] * 60 + shownParts[2]
      : shownParts[0] * 60 + shownParts[1];
    const startedAt = Number(chip.dataset.kfCardUptimeStart);
    const expectedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const chipBox = chip.getBoundingClientRect();
    const cardBox = card?.getBoundingClientRect();
    const style = getComputedStyle(chip);
    const contained = Boolean(cardBox)
      && chipBox.left >= cardBox.left - 1 && chipBox.right <= cardBox.right + 1
      && chipBox.top >= cardBox.top - 1 && chipBox.bottom <= cardBox.bottom + 1;
    const pageFits = document.documentElement.scrollWidth <= window.innerWidth + 1;
    return {
      ok: true,
      text: chip.textContent,
      slug: chip.dataset.kfCardUptimeSlug || '',
      startedAt,
      shownSeconds,
      expectedSeconds,
      hasLiveBadge: Boolean(liveBadge),
      adjacent: chip.previousElementSibling === liveBadge,
      width: Math.round(chipBox.width),
      height: Math.round(chipBox.height),
      fontSize: parseFloat(style.fontSize),
      contained,
      pageFits,
      feedReads: feedReads.length,
      eligible: eligible().length,
    };
  })()`);
  const discoveryUptime = discoveryUptimeProbe.value || {};
  recordProbe('live discovery cards show a feed-backed duration without overflowing at 1440x900', discoveryUptime,
    discoveryUptime.ok === true
      && discoveryUptime.slug
      && Number.isFinite(discoveryUptime.startedAt) && discoveryUptime.startedAt > 0
      && Number.isFinite(discoveryUptime.shownSeconds)
      && Math.abs(discoveryUptime.shownSeconds - discoveryUptime.expectedSeconds) <= 65
      && discoveryUptime.hasLiveBadge === true && discoveryUptime.adjacent === true
      && discoveryUptime.width > 0 && discoveryUptime.height >= 16 && discoveryUptime.height <= 22
      && discoveryUptime.fontSize >= 11
      && discoveryUptime.contained === true && discoveryUptime.pageFits === true,
    discoveryUptime.ok
      ? `${discoveryUptime.slug} reads ${discoveryUptime.text}, ${Math.abs(discoveryUptime.shownSeconds - discoveryUptime.expectedSeconds)}s from its observed start; ${discoveryUptime.width}x${discoveryUptime.height}px at ${discoveryUptime.fontSize}px; ${discoveryUptime.feedReads} feed read(s), ${discoveryUptime.eligible} eligible card(s), contained=${discoveryUptime.contained}, page fits=${discoveryUptime.pageFits}`
      : discoveryUptime.why);

  // R-88/R-101: stand up a visible owner on a channel-shaped route and drive
  // every playback boundary. Larger preview and muted-background videos must
  // not steal ownership, a replacement owner must accrue once, and hidden or
  // detached media must leave the clock parked. The storage assertion is the
  // reload contract: there is no record a fresh page could restore.
  const sessionWatchProbe = await evaluate(pageClient, `(async () => {
    const host = document.getElementById('kick-focus-root');
    const shadow = await __kfWait(() => host && host.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
    const settle = (ms = 120) => new Promise((done) => setTimeout(done, ms));
    const beforePath = location.pathname;
    const video = document.createElement('video');
    video.dataset.kfSessionWatchProbe = 'true';
    video.style.cssText = 'position:fixed;inset:80px auto auto 240px;width:640px;height:360px;visibility:visible';
    let playing = true;
    Object.defineProperty(video, 'paused', { configurable: true, get: () => !playing });
    Object.defineProperty(video, 'ended', { configurable: true, get: () => false });
    Object.defineProperty(video, 'readyState', { configurable: true, get: () => 4 });
    document.body.prepend(video);
    const preview = document.createElement('video');
    preview.className = 'player-preview';
    preview.style.cssText = 'position:fixed;inset:40px auto auto 120px;width:960px;height:540px;visibility:visible';
    Object.defineProperty(preview, 'paused', { configurable: true, get: () => false });
    Object.defineProperty(preview, 'ended', { configurable: true, get: () => false });
    Object.defineProperty(preview, 'readyState', { configurable: true, get: () => 4 });
    const background = document.createElement('video');
    background.className = 'background-video';
    background.muted = true;
    background.style.cssText = 'position:fixed;inset:20px auto auto 80px;width:1080px;height:608px;visibility:visible';
    Object.defineProperty(background, 'paused', { configurable: true, get: () => false });
    Object.defineProperty(background, 'ended', { configurable: true, get: () => false });
    Object.defineProperty(background, 'readyState', { configurable: true, get: () => 4 });
    const replacement = document.createElement('video');
    replacement.style.cssText = 'position:fixed;inset:100px auto auto 280px;width:720px;height:405px;visibility:visible';
    let replacementPlaying = true;
    Object.defineProperty(replacement, 'paused', { configurable: true, get: () => !replacementPlaying });
    Object.defineProperty(replacement, 'ended', { configurable: true, get: () => false });
    Object.defineProperty(replacement, 'readyState', { configurable: true, get: () => 4 });
    const preload = document.createElement('video');
    preload.className = 'preload-video';
    preload.style.cssText = 'display:none;width:640px;height:360px';
    Object.defineProperty(preload, 'paused', { configurable: true, get: () => false });
    Object.defineProperty(preload, 'ended', { configurable: true, get: () => false });
    Object.defineProperty(preload, 'readyState', { configurable: true, get: () => 4 });
    const detached = document.createElement('video');
    Object.defineProperty(detached, 'paused', { configurable: true, get: () => false });
    Object.defineProperty(detached, 'ended', { configurable: true, get: () => false });
    Object.defineProperty(detached, 'readyState', { configurable: true, get: () => 4 });
    const clockSeconds = (value) => String(value || '').split(':').reduce((total, part) => total * 60 + Number(part), 0);
    try {
      history.pushState({}, '', '/xqc');
      const route = await __kfWait(() => document.documentElement.dataset.kfRoute === 'channel');
      if (!route) return { ok: false, why: 'the synthetic channel route never reached the runtime' };
      video.dispatchEvent(new Event('playing'));
      await settle(1350);
      shadow.querySelector('[data-kf-quick]')?.click();
      await settle(250);
      shadow.querySelector('[data-page="viewer"]')?.click();
      await settle(250);
      const card = shadow.querySelector('[data-kf-hub-card="watch"]');
      const first = String(card?.querySelector('strong')?.textContent || '').trim();
      const source = String(card?.querySelector('em')?.textContent || '').trim();
      const localSource = card?.dataset.kfSource === 'local';
      playing = false;
      video.dispatchEvent(new Event('waiting'));
      await settle(1250);
      const paused = String(shadow.querySelector('[data-kf-hub-card="watch"] strong')?.textContent || '').trim();
      document.body.prepend(preview, background);
      preview.dispatchEvent(new Event('playing'));
      background.dispatchEvent(new Event('playing'));
      await settle(1250);
      const nonOwner = String(shadow.querySelector('[data-kf-hub-card="watch"] strong')?.textContent || '').trim();
      video.remove();
      document.body.prepend(replacement);
      replacement.dispatchEvent(new Event('playing'));
      await settle(1350);
      const swapped = String(shadow.querySelector('[data-kf-hub-card="watch"] strong')?.textContent || '').trim();
      replacementPlaying = false;
      replacement.dispatchEvent(new Event('waiting'));
      await settle(100);
      const swapBoundary = String(shadow.querySelector('[data-kf-hub-card="watch"] strong')?.textContent || '').trim();
      await settle(1250);
      const swappedPaused = String(shadow.querySelector('[data-kf-hub-card="watch"] strong')?.textContent || '').trim();
      replacement.remove();
      document.body.prepend(preload);
      preload.dispatchEvent(new Event('playing'));
      detached.dispatchEvent(new Event('playing'));
      await settle(1250);
      const hiddenPreload = String(shadow.querySelector('[data-kf-hub-card="watch"] strong')?.textContent || '').trim();
      const storageKeys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)]
        .filter((key) => key.startsWith('kick-focus:') && /watch|session/i.test(key));
      shadow.querySelector('[data-action="close-settings"]')?.click();
      return {
        ok: true,
        first,
        paused,
        nonOwner,
        swapped,
        swapBoundary,
        swapSeconds: clockSeconds(swapBoundary) - clockSeconds(nonOwner),
        boundarySeconds: clockSeconds(swapBoundary) - clockSeconds(swapped),
        swappedPaused,
        hiddenPreload,
        source,
        localSource,
        storageKeys,
      };
    } finally {
      video.remove();
      preview.remove();
      background.remove();
      replacement.remove();
      preload.remove();
      detached.remove();
      history.pushState({}, '', beforePath || '/');
    }
  })()`);
  const sessionWatch = sessionWatchProbe.value || {};
  record('Viewer labels a playback-gated watch clock as browser-session-only and stores nothing',
    sessionWatch.ok === true && /^\d+:\d{2}(?::\d{2})?$/.test(sessionWatch.first || '')
      && sessionWatch.first !== '0:00' && sessionWatch.paused === sessionWatch.first
      && sessionWatch.nonOwner === sessionWatch.paused
      && sessionWatch.swapSeconds >= 1 && sessionWatch.swapSeconds <= 2
      && sessionWatch.boundarySeconds >= 0 && sessionWatch.boundarySeconds <= 1
      && sessionWatch.swappedPaused === sessionWatch.swapBoundary
      && sessionWatch.hiddenPreload === sessionWatch.swappedPaused
      && sessionWatch.localSource === true && /session|sesión|sessão/i.test(sessionWatch.source || '')
      && Array.isArray(sessionWatch.storageKeys) && sessionWatch.storageKeys.length === 0,
    sessionWatch.ok
      ? `playing=${sessionWatch.first}, paused=${sessionWatch.paused}, preview/background=${sessionWatch.nonOwner}, owner swap=+${sessionWatch.swapSeconds}s (boundary +${sessionWatch.boundarySeconds}s), swap paused=${sessionWatch.swappedPaused}, hidden/detached=${sessionWatch.hiddenPreload}, source="${sessionWatch.source}", storage=${JSON.stringify(sessionWatch.storageKeys)}`
      : sessionWatch.why);

  // The accessibility settings and the modal focus ladder are about this mod's
  // own chrome, not Kick's markup, so they are proven by driving the real UI
  // rather than by reading source. Both were defects a green offline build
  // reported as healthy: the density/motion settings were written at <html>,
  // where they cannot reach into the shadow root the controls actually live in,
  // and Escape on the reset prompt tore down the whole Settings modal.
  const shadowProbe = await evaluate(pageClient, `(async () => {
    const host = document.getElementById('kick-focus-root');
    if (!await __kfWait(() => host && host.shadowRoot)) return { ok: false, why: 'the settings shadow host never appeared' };
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
    const shadow = await __kfWait(() => host && host.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
    // Every host this build owns, so a translated surface that forgot to say
    // which language it is in shows up here rather than in a screen reader.
    const hostLangs = () => ['kick-focus-root', 'kick-focus-emote-complete', 'kick-focus-emote-tooltip', 'kick-focus-header-control', 'kick-focus-streamer-stats']
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((host) => host.id + '=' + (host.getAttribute('lang') || ''));
    const sample = async (value) => {
      await setLanguage(value);
      const toast = await raiseToast();
      shadow.querySelector('[data-page="appearance"]').click();
      await settle();
      return { count: readCount(), toast, langs: hostLangs() };
    };
    const english = await sample('en');
    const spanish = await sample('es');
    await setLanguage('auto');
    return { ok: true, english, spanish, pageLang: document.documentElement.lang || '' };
  })()`);
  const locale = localeProbe.value || {};
  // Kick's document declares English and `lang` inherits through the flat tree
  // into a shadow root, so a translated host that says nothing is announced
  // with English phonemes — WCAG 2.2 SC 3.1.2 (AA).
  record('every host this build owns declares the language it is written in',
    locale.ok === true
      && Array.isArray(locale.english?.langs) && locale.english.langs.length > 0
      && locale.english.langs.every((entry) => entry.endsWith('=en'))
      && Array.isArray(locale.spanish?.langs) && locale.spanish.langs.length > 0
      && locale.spanish.langs.every((entry) => entry.endsWith('=es')),
    locale.ok
      ? `page is lang=${JSON.stringify(locale.pageLang)}; ours in English ${JSON.stringify(locale.english.langs)}, in Spanish ${JSON.stringify(locale.spanish.langs)}`
      : locale.why);
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
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
    const shadow = await __kfWait(() => host && host.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
  // R-85, WCAG 2.2 3.2.6 Consistent Help: the same help mechanism, in the same
  // relative place, on every settings page — measured at 680px CSS width, where
  // the footer has the least room to keep four controls on one row. Search
  // results are included on purpose: a result list is a page a reader can get
  // stuck on, and it is the one that used to have no way out but the nav.
  await pageClient.send('Emulation.setDeviceMetricsOverride', {
    width: 680, height: VIEWPORT_HEIGHT, deviceScaleFactor: 1, mobile: false,
  });
  const helpProbe = await evaluate(pageClient, `(async () => {
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
    const settle = (ms = 400) => new Promise((done) => setTimeout(done, ms));
    shadow.querySelector('[data-kf-quick]').click();
    shadow.querySelector('[data-action="command:settings"]').click();
    await settle();
    const shell = shadow.querySelector('[data-kf-settings-shell]');
    const pages = [...shadow.querySelectorAll('.kf-nav [data-page]')].map((button) => button.dataset.page);
    const seen = [];
    const measure = (where) => {
      const help = shadow.querySelector('[data-action="help"]');
      const exportControl = shadow.querySelector('[data-action="export"]');
      const rect = help?.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      seen.push({
        where,
        help: Boolean(help),
        export: Boolean(exportControl),
        // Same relative place: both live in the footer's left group, and help
        // follows export. Order is what 3.2.6 is actually about.
        slot: help?.parentElement?.className || '',
        after: help && exportControl ? (exportControl.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 : false,
        clipped: rect ? Math.round(rect.right - shellRect.right) > 0 || Math.round(rect.width) === 0 : true,
      });
    };
    for (const page of pages) {
      shadow.querySelector('[data-page="' + page + '"]').click();
      await settle();
      measure(page);
    }
    // And the search results page, which is not in the nav.
    const search = shadow.querySelector('[data-kf-settings-search]');
    search.value = 'chat';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(700);
    measure('search-results');
    // The control has to work from there, not merely be present.
    shadow.querySelector('[data-action="help"]').click();
    await settle(600);
    const landed = shadow.querySelector('[data-kf-settings-shell]')?.dataset.kfCurrentPage || '';
    const queryCleared = String(shadow.querySelector('[data-kf-settings-search]')?.value || '') === '';
    shadow.querySelector('[data-action="close-settings"]')?.click();
    return { ok: true, seen, landed, queryCleared };
  })()`);
  const help = helpProbe.value || { why: helpProbe.error || 'the probe returned nothing' };
  const helpGaps = (help.seen || []).filter((entry) => !entry.help || !entry.export || !entry.after || entry.clipped);
  record('every settings page offers the same help control, in the same place, at 680px',
    help.ok === true
      && (help.seen || []).length > 3
      && helpGaps.length === 0
      && help.landed === 'about'
      && help.queryCleared === true,
    help.ok
      ? `${help.seen.length} pages measured, ${helpGaps.length} without it${helpGaps.length ? ': ' + helpGaps.map((entry) => entry.where).join(', ') : ''}; from search results it lands on ${help.landed} and clears the query=${help.queryCleared}`
      : help.why);

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
    const routeNow = () => document.documentElement.dataset.kfRoute || '';
    const before = routeNow();
    // Not "is native": Kick's own Sentry instrumentation wraps history exactly
    // as it wraps fetch, so on the live site nobody is outermost. The claim
    // that can be tested is that this build's wrapper is not in the stack.
    const pushNative = !String(history.pushState).includes('kickFocus') && !String(history.replaceState).includes('kickFocus');

    history.pushState(null, '', '/browse');
    // Waited for, not slept at. The route is painted by the apply cycle, which
    // is a capped debounce driven by a MutationObserver — and on a still page
    // nothing reschedules it, so a fixed sleep is a coin flip that lands
    // differently under release-gate load than it does on a quiet run.
    // \`__kfWait\` pokes the DOM between polls, which is the whole reason it
    // exists. Measured 2026-08-18: this check failed at 1920x1080 and passed at
    // 1440x900 in the same release run, with both invariants holding.
    const after = await __kfWait(() => (routeNow() === 'browse' ? 'browse' : null), { timeout: 8000 }) || routeNow();
    const landed = location.pathname;

    history.pushState(null, '', '/');
    const back = await __kfWait(() => {
      const route = routeNow();
      return route && route !== 'browse' ? route : null;
    }, { timeout: 8000 }) || routeNow();
    const returned = location.pathname;

    return { pushNative, hasNavigationApi: typeof navigation !== 'undefined', before, after, back, landed, returned };
  })()`);
  const route = routeProbe.value || {};
  // Split deliberately. The wrapper claim is about this build's own code and is
  // answerable whatever Kick's router does, so a routing hiccup must not be
  // able to skip it — which is what the single combined check allowed.
  record('history carries no wrapper of ours',
    route.hasNavigationApi === true && route.pushNative === true,
    `navigation api=${route.hasNavigationApi}, history free of this build=${route.pushNative}`);
  // The URL is pushed by this probe, so it always changes — unless Kick's own
  // router put it back, which is the one case where there was no same-document
  // navigation left to re-classify and nothing to conclude.
  const urlHeld = route.landed === '/browse';
  recordProbe('a same-document navigation re-routes through the Navigation API',
    urlHeld ? route : { skip: `Kick's router moved the URL off /browse to ${route.landed} before it could be observed, so no same-document navigation stood to be re-classified` },
    route.after === 'browse' && route.back !== 'browse',
    `route ${route.before} -> ${route.after} -> ${route.back}; url ${route.landed} -> ${route.returned}`);

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
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
  // R-54: chat in an always-on-top window. The claim that only a browser can
  // answer is that the grid's own chat frame is still the same element after
  // the pop-out — moving it would silently reload Kick's chat, which is the
  // measured trap this design exists to avoid.
  const pipProbe = await evaluate(pageClient, `(async () => {
    if (!('documentPictureInPicture' in window)) return { skip: 'this engine has no Document Picture-in-Picture, so the grid keeps its chat inline' };
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { skip: 'the mod did not mount, so the grid could not be opened' };
    const settle = () => new Promise((done) => setTimeout(done, 900));
    try {
      shadow.querySelector('[data-action="open-multistream"]')?.click();
      await settle();
      const backdrop = shadow.querySelector('[data-kf-multistream-backdrop]');
      if (!backdrop || backdrop.hidden !== false) return { skip: 'the multi-stream grid did not open on this route' };

      const input = shadow.querySelector('[data-kf-multistream-input]');
      if (input) { input.value = 'xqc'; shadow.querySelector('[data-action="multistream-add"]')?.click(); await settle(); }
      const pane = shadow.querySelector('[data-kf-multistream-chat]');
      const before = pane?.querySelector('iframe');
      if (!before) return { skip: 'the grid rendered no chat frame to keep' };

      const button = () => shadow.querySelector('[data-kf-multistream-popout]');
      if (!button() || button().hidden) return { skip: 'the pop-out control was not offered on this run' };
      button().click();
      await settle();
      await settle();

      const opened = Boolean(documentPictureInPicture.window);
      const framedSrc = opened ? String(documentPictureInPicture.window.document.querySelector('iframe')?.src || '') : '';
      const after = pane.querySelector('iframe');
      const hidden = backdrop.dataset.kfMultistreamChatPoppedOut;

      // And back, which must cost nothing.
      if (opened) documentPictureInPicture.window.close();
      await settle();
      const restored = pane.querySelector('iframe');

      return {
        ok: true,
        opened,
        framedSrc,
        // The whole point: same element object, before and after, both ways.
        gridFrameKept: after === before,
        gridFrameRestored: restored === before,
        paneHidden: hidden,
        returned: backdrop.dataset.kfMultistreamChatPoppedOut,
      };
    } finally {
      shadow.querySelector('[data-action="close-multistream"]')?.click();
      await settle();
    }
  })()`, { userGesture: true });
  const pip = pipProbe.value || {};
  recordProbe('chat pops out into a top-layer window without disturbing the grid frame', pip,
    pip.ok === true
      && pip.opened === true
      && /\/popout\/[^/]+\/chat/.test(pip.framedSrc)
      && pip.gridFrameKept === true
      && pip.gridFrameRestored === true
      && pip.paneHidden === 'true'
      && pip.returned === 'false',
    pip.ok
      ? `window carried ${JSON.stringify(pip.framedSrc)}; grid frame kept=${pip.gridFrameKept} restored=${pip.gridFrameRestored}; pane hidden=${pip.paneHidden} -> ${pip.returned}`
      : pip.why);

  // R-59: the merged view. Asserted structurally rather than on traffic — how
  // many messages two live channels happen to produce in a few seconds is not a
  // property of this build, and a check that depends on strangers typing is the
  // sampled-once defect in another costume.
  const mergedProbe = await evaluate(pageClient, `(async () => {
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { skip: 'the mod did not mount, so the grid could not be opened' };
    const settle = () => new Promise((done) => setTimeout(done, 900));
    try {
      shadow.querySelector('[data-action="open-multistream"]')?.click();
      await settle();
      const backdrop = shadow.querySelector('[data-kf-multistream-backdrop]');
      if (!backdrop || backdrop.hidden !== false) return { skip: 'the multi-stream grid did not open on this route' };

      const input = shadow.querySelector('[data-kf-multistream-input]');
      for (const slug of ['xqc', 'trainwreckstv']) {
        if (!input) break;
        input.value = slug;
        shadow.querySelector('[data-action="multistream-add"]')?.click();
        await settle();
      }
      const toggle = () => shadow.querySelector('[data-action="multistream-toggle-merged"]');
      if (!toggle()) return { skip: 'the merged-chat control is not in this build' };
      const offDefault = toggle().getAttribute('aria-pressed');

      toggle().click();
      await settle();
      const pane = shadow.querySelector('[data-kf-multistream-merged]');
      const list = shadow.querySelector('[data-kf-multistream-merged-list]');
      const on = {
        paneShown: pane?.hidden === false,
        attr: backdrop.dataset.kfMultistreamMergedOn,
        status: shadow.querySelector('[data-kf-multistream-merged-status]')?.textContent?.trim() || '',
        // The read-only boundary, asserted against the rendered pane rather
        // than the source: nothing here may take input or submit.
        composer: pane ? pane.querySelectorAll('input, textarea, form, button').length : -1,
        role: list?.getAttribute('role') || '',
        // The per-tile frame must survive being hidden, exactly as it does for
        // the pop-out, so switching back costs no reload.
        tileFrameKept: Boolean(shadow.querySelector('[data-kf-multistream-chat] iframe')),
      };

      // Back to per-tile, which must restore the same frame.
      toggle().click();
      await settle();
      const off = {
        paneHidden: shadow.querySelector('[data-kf-multistream-merged]')?.hidden !== false,
        attr: backdrop.dataset.kfMultistreamMergedOn,
        tileFrameKept: Boolean(shadow.querySelector('[data-kf-multistream-chat] iframe')),
      };
      return { ok: true, offDefault, on, off };
    } finally {
      shadow.querySelector('[data-action="close-multistream"]')?.click();
      await settle();
      localStorage.removeItem('kick-focus:multistream');
    }
  })()`);
  const mergedView = mergedProbe.value || {};
  recordProbe('merged chat is opt-in, read-only, and gives the per-tile chat back', mergedView,
    mergedView.ok === true
      && mergedView.offDefault === 'false'
      && mergedView.on?.paneShown === true
      && mergedView.on?.attr === 'true'
      && mergedView.on?.composer === 0
      && mergedView.on?.role === 'log'
      && /^\d+ of \d+ chats live$/.test(mergedView.on?.status || '')
      && mergedView.on?.tileFrameKept === true
      && mergedView.off?.paneHidden === true
      && mergedView.off?.attr === 'false'
      && mergedView.off?.tileFrameKept === true,
    mergedView.ok
      ? `off by default=${mergedView.offDefault}; on: pane=${mergedView.on?.paneShown} status="${mergedView.on?.status}" sendable controls=${mergedView.on?.composer} tile frame kept=${mergedView.on?.tileFrameKept}; back off: pane hidden=${mergedView.off?.paneHidden} tile frame kept=${mergedView.off?.tileFrameKept}`
      : mergedView.why);

  // Leave the grid as it was found.
  await evaluate(pageClient, `(() => { localStorage.removeItem('kick-focus:multistream'); return true; })()`);

  // Driven through the real import path rather than by seeding localStorage and
  // reloading: the outgoing page flushes its own in-memory library on pagehide,
  // which overwrites a seeded store before the new page can read it. An old
  // backup is also how a user actually arrives at this migration.
  const migrationProbe = await evaluate(pageClient, `(async () => {
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
    if (!input) { history.pushState(null, '', '/'); return { skip: 'the chat-keyword control is not rendered on route ' + route }; }
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
  recordProbe('keyword matches are painted from the Highlight registry with zero nodes written into chat', hl,
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
    const shadow = await __kfWait(() => host && host.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
    if (!seeded) { box.remove(); return { skip: 'the library is empty on this throwaway profile; run the gate against a channel URL so chat fills it' }; }
    seeded.click();
    await settle();
    const typed = box.textContent;
    const toast = String(shadow.querySelector('.kf-toast-text')?.textContent || '');
    box.remove();
    return { ok: true, typed, toast, submits };
  })()`);
  const insert = insertProbe.value || {};
  recordProbe('typing an emote name inserts the plain name at the caret and never sends', insert,
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
      const rect = host.getBoundingClientRect();
      return {
        lines: [...host.shadowRoot.querySelectorAll('[data-kf-tooltip-card] div')].map((n) => n.textContent),
        pointerEvents: style.pointerEvents,
        // The rect, not the computed \`left\`: on the top-layer path nothing sets
        // an inset at all, so \`left\` reads \`auto\` and the old numeric read
        // would have gone NaN the moment the anchored path engaged.
        left: rect.left,
        onScreen: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
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
      && tip.shown.onScreen === true
      && tip.afterUnrelated === null,
    tip.ok ? `lines ${JSON.stringify(tip.shown?.lines)}; unrelated image opened nothing` : 'probe failed');

  // R-52: the hover card in the top layer, measured under the two conditions
  // that break a hand-positioned surface — an anchor hard against a viewport
  // edge, and an anchor inside a container that clips its overflow. The card
  // must escape the container and still land wholly on screen.
  const topLayerProbe = await evaluate(pageClient, `(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 300));
    const supported = typeof HTMLElement.prototype.showPopover === 'function'
      && CSS.supports('position-area: block-start')
      && CSS.supports('position-try-fallbacks: flip-block');
    if (!supported) return { skip: 'this engine has no anchored top layer, so the hand-positioned path is the one under test' };

    // A chat-shaped container: scrolls, clips, and sits near the bottom-right.
    const scroller = document.createElement('div');
    scroller.style.cssText = 'position:fixed;right:8px;bottom:8px;width:280px;height:180px;overflow:auto;contain:paint';
    const filler = document.createElement('div');
    filler.style.cssText = 'height:400px;padding-top:12px';
    const image = document.createElement('img');
    image.src = 'https://files.kick.com/emotes/000/fullsize';
    image.dataset.kfChatEmoteSave = 'kf-probe-top-layer';
    image.style.cssText = 'display:block;width:28px;height:28px;margin-left:8px';
    filler.append(image);
    scroller.append(filler);
    document.body.append(scroller);
    try {
      image.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      const host = document.getElementById('kick-focus-emote-tooltip');
      if (!host || host.dataset.kfOpen !== 'true') return { ok: false, why: 'the hover card did not open on the probe emote' };
      const card = host.getBoundingClientRect();
      const box = scroller.getBoundingClientRect();
      const anchor = image.getBoundingClientRect();
      return {
        ok: true,
        // In the top layer at all: this is what makes clipping impossible,
        // rather than a z-index this build merely expects to win.
        topLayer: host.matches(':popover-open'),
        anchored: host.dataset.kfAnchored === 'true',
        // Resolved through the anchor, not left parked in a corner — the exact
        // shape the tree-scope trap produces.
        positionAnchor: host.style.getPropertyValue('position-anchor'),
        anchorName: image.style.getPropertyValue('anchor-name'),
        // Escapes the clipping container...
        escapesContainer: card.top < box.top - 1 || card.left < box.left - 1,
        // ...and is still wholly on screen at the far corner of the viewport.
        onScreen: card.left >= 0 && card.top >= 0 && card.right <= innerWidth && card.bottom <= innerHeight,
        // Placed against its own anchor rather than the viewport's corner.
        tracksAnchor: Math.abs(card.left - anchor.left) < 40,
        card: { top: Math.round(card.top), left: Math.round(card.left), right: Math.round(card.right), bottom: Math.round(card.bottom) },
        container: { top: Math.round(box.top), left: Math.round(box.left) },
        viewport: { w: innerWidth, h: innerHeight },
      };
    } finally {
      scroller.remove();
      await settle();
    }
  })()`);
  const layer = topLayerProbe.value || {};
  recordProbe('the hover card renders in the top layer, escaping a clipping container at a viewport edge', layer,
    layer.ok === true
      && layer.topLayer === true
      && layer.anchored === true
      && layer.escapesContainer === true
      && layer.onScreen === true,
    layer.ok ? `card ${JSON.stringify(layer.card)} vs container ${JSON.stringify(layer.container)} in ${layer.viewport?.w}x${layer.viewport?.h}` : layer.why);
  recordProbe('the hover card resolves its anchor rather than silently parking in a corner', layer,
    layer.ok === true
      && layer.positionAnchor === '--kf-emote-card'
      && layer.anchorName === '--kf-emote-card'
      && layer.tracksAnchor === true,
    layer.ok ? `position-anchor ${JSON.stringify(layer.positionAnchor)} on the host, anchor-name ${JSON.stringify(layer.anchorName)} on the emote` : layer.why);

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

  // Kick's live channel markup puts the resizer and chatroom inside two nested
  // wrappers. The outer wrapper is the flex item beside the player; sizing only
  // the inner chatroom overflows that column and leaves the visible separator
  // unable to change the forced width. Recreate that exact shape, enter Theater
  // mode through the shipped control, and drag the real separator binding.
  const chatLayoutProbe = await evaluate(pageClient, `(async () => {
    const settle = (ms = 650) => new Promise((done) => setTimeout(done, ms));
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
    const beforeUrl = location.pathname + location.search + location.hash;
    const beforeState = history.state;
    const originalChat = (JSON.parse(localStorage.getItem('kick-focus:settings') || '{}').layout || {}).chat || 'right';
    const setChat = async (value) => {
      shadow.querySelector('[data-action="open-settings"]')?.click();
      await settle(180);
      shadow.querySelector('[data-page="layout"]')?.click();
      await settle(180);
      const control = shadow.querySelector('[data-set="layout.chat"][data-value="' + value + '"]');
      if (!control) return false;
      control.click();
      await settle();
      const selected = shadow.querySelector('[data-set="layout.chat"][data-value="' + value + '"]')?.getAttribute('aria-pressed') === 'true';
      shadow.querySelector('[data-action="close-settings"]')?.click();
      await settle(180);
      return selected && document.documentElement.dataset.kfChat === value;
    };
    const row = document.createElement('div');
    const player = document.createElement('main');
    const outer = document.createElement('div');
    const split = document.createElement('div');
    const separator = document.createElement('div');
    const panel = document.createElement('div');
    row.style.cssText = 'position:fixed;left:-3000px;top:0;width:1000px;height:600px;display:flex;overflow:auto';
    player.style.cssText = 'flex:1 1 auto;min-width:0';
    split.style.cssText = 'position:relative;display:flex;height:100%';
    separator.setAttribute('role', 'separator');
    separator.setAttribute('aria-label', 'Resize chatroom');
    separator.setAttribute('aria-orientation', 'vertical');
    separator.setAttribute('aria-valuemin', '280');
    separator.setAttribute('aria-valuemax', '420');
    separator.setAttribute('aria-valuenow', '340');
    separator.setAttribute('data-testid', 'chat-resizer');
    panel.id = 'channel-chatroom';
    panel.style.height = '100%';
    split.append(separator, panel);
    outer.append(split);
    row.append(player, outer);
    document.body.prepend(row);
    let initialWidth = 410;
    let initialTheater = false;
    try {
      const leftSelected = await setChat('left');
      if (!leftSelected) return { ok: false, why: 'Left was not selectable from the Layout page' };
      const leftStored = (JSON.parse(localStorage.getItem('kick-focus:settings') || '{}').layout || {}).chat === 'left';
      history.pushState({}, '', '/kf-layout-probe');
      window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
      await settle();
      initialWidth = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--kf-chat-width'), 10) || 410;
      initialTheater = document.documentElement.dataset.kfTheater === 'true';
      const ownerTagged = outer.dataset.kfChatPanel === 'true';
      const innerTagged = panel.dataset.kfChatPanel === 'true';
      const bound = separator.dataset.kfChatResizeBound === 'true';
      const splitTagged = split.dataset.kfChatSplit === 'true';
      const before = { owner: outer.getBoundingClientRect().width, inner: panel.getBoundingClientRect().width };
      const leftRects = {
        owner: outer.getBoundingClientRect(),
        player: player.getBoundingClientRect(),
        separator: separator.getBoundingClientRect(),
        panel: panel.getBoundingClientRect(),
      };
      const placedLeft = leftRects.owner.right <= leftRects.player.left + 1;
      const separatorOnPlayerEdge = leftRects.separator.left >= leftRects.panel.right - 2;

      if (!initialTheater) {
        shadow.querySelector('[data-kf-quick]')?.click();
        shadow.querySelector('[data-action="command:theater"]')?.click();
        await settle();
      }
      const theater = document.documentElement.dataset.kfTheater === 'true';
      const expected = Math.min(520, initialWidth + 70);
      const startX = separator.getBoundingClientRect().left;
      separator.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 91, isPrimary: true, button: 0, clientX: startX }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 91, isPrimary: true, button: 0, clientX: startX + 70 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 91, isPrimary: true, button: 0, clientX: startX + 70 }));
      await settle(180);
      const dragged = {
        owner: Math.round(outer.getBoundingClientRect().width),
        inner: Math.round(panel.getBoundingClientRect().width),
        aria: Number(separator.getAttribute('aria-valuenow')),
        css: Number.parseInt(document.documentElement.style.getPropertyValue('--kf-chat-width'), 10),
      };
      const bounded = row.scrollWidth <= row.clientWidth;

      const restoreX = separator.getBoundingClientRect().left;
      separator.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 92, isPrimary: true, button: 0, clientX: restoreX }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 92, isPrimary: true, button: 0, clientX: restoreX - (expected - initialWidth) }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 92, isPrimary: true, button: 0, clientX: restoreX - (expected - initialWidth) }));
      const rightSelected = await setChat('right');
      const rightRects = { owner: outer.getBoundingClientRect(), player: player.getBoundingClientRect() };
      const restoredRight = rightSelected && rightRects.owner.left >= rightRects.player.right - 1;
      if (!initialTheater) {
        shadow.querySelector('[data-kf-quick]')?.click();
        shadow.querySelector('[data-action="command:theater"]')?.click();
      }
      await settle(180);
      return {
        ok: true, leftSelected, leftStored, ownerTagged, innerTagged, splitTagged, bound,
        placedLeft, separatorOnPlayerEdge, restoredRight, before, theater, expected, dragged, bounded,
      };
    } finally {
      await setChat(originalChat);
      row.remove();
      history.replaceState(beforeState, '', beforeUrl);
      window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
      await settle();
    }
  })()`);
  const chatLayout = chatLayoutProbe.value || {};
  record('Left chat is selectable, reversible, and keeps Theater resize geometry bounded',
    chatLayout.ok === true
      && chatLayout.leftSelected === true && chatLayout.leftStored === true
      && chatLayout.ownerTagged === true && chatLayout.innerTagged === false && chatLayout.splitTagged === true
      && chatLayout.bound === true && chatLayout.placedLeft === true
      && chatLayout.separatorOnPlayerEdge === true && chatLayout.restoredRight === true
      && chatLayout.theater === true && chatLayout.bounded === true
      && Math.abs(chatLayout.before?.owner - chatLayout.before?.inner) <= 1
      && Math.abs(chatLayout.dragged?.owner - chatLayout.expected) <= 1
      && Math.abs(chatLayout.dragged?.inner - chatLayout.expected) <= 1
      && chatLayout.dragged?.aria === chatLayout.expected
      && chatLayout.dragged?.css === chatLayout.expected,
    chatLayout.ok
      ? `left selected/stored=${chatLayout.leftSelected}/${chatLayout.leftStored}; owner ${chatLayout.before?.owner}px / inner ${chatLayout.before?.inner}px; dragged both to ${chatLayout.dragged?.owner}px (aria ${chatLayout.dragged?.aria}, css ${chatLayout.dragged?.css}); left=${chatLayout.placedLeft}, separator edge=${chatLayout.separatorOnPlayerEdge}, restored right=${chatLayout.restoredRight}, bounded=${chatLayout.bounded}`
      : chatLayout.why);

  const composerRecallProbe = await evaluate(pageClient, `(async () => {
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
    const settle = (ms = 350) => new Promise((done) => setTimeout(done, ms));
    const beforePage = shadow.querySelector('[data-kf-page]')?.dataset.kfCurrentPage || '';
    const stored = JSON.parse(localStorage.getItem('kick-focus:settings') || '{}');
    const initiallyEnabled = stored.content?.chatComposerRecall === true;
    const setEnabled = async (wanted) => {
      shadow.querySelector('[data-action="open-settings"]')?.click();
      await settle(120);
      shadow.querySelector('[data-page="content"]')?.click();
      await settle(120);
      const control = shadow.querySelector('[data-set="content.chatComposerRecall"]');
      if (!control) return false;
      if ((control.getAttribute('aria-checked') === 'true') !== wanted) control.click();
      await settle();
      shadow.querySelector('[data-action="close-settings"]')?.click();
      return (JSON.parse(localStorage.getItem('kick-focus:settings') || '{}').content || {}).chatComposerRecall === wanted;
    };
    const chat = document.createElement('div');
    chat.id = 'channel-chatroom';
    chat.style.cssText = 'position:fixed;left:-3000px;top:0';
    const input = document.createElement('textarea');
    input.setAttribute('data-testid', 'chat-input');
    const emotes = document.createElement('button');
    emotes.type = 'button';
    emotes.setAttribute('aria-label', 'Emotes');
    chat.append(input, emotes);
    document.body.prepend(chat);
    const type = (value) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const key = (keyName, shiftKey = false) => {
      const event = new KeyboardEvent('keydown', { key: keyName, shiftKey, bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      return event.defaultPrevented;
    };
    try {
      if (!await setEnabled(true)) return { ok: false, why: 'the recall setting did not persist from its Content page control' };
      type('first local send'); key('Enter');
      type('second local send'); key('Enter');
      type('/w friend private'); key('Enter');
      type('not sent from unrelated form');
      const unrelatedForm = document.createElement('form');
      unrelatedForm.innerHTML = '<input type="search"><button type="submit">Search</button>';
      document.body.append(unrelatedForm);
      unrelatedForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      const unrelatedEditor = document.createElement('div');
      unrelatedEditor.contentEditable = 'true';
      unrelatedEditor.setAttribute('role', 'textbox');
      unrelatedEditor.textContent = 'not sent from unrelated editor';
      document.body.append(unrelatedEditor);
      unrelatedEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      unrelatedForm.remove();
      unrelatedEditor.remove();
      type('draft stays');
      const plainPrevented = key('ArrowUp');
      const plainValue = input.value;
      const recall = chat.querySelector('[data-kf-composer-recall]');
      const controlVisible = Boolean(recall?.getClientRects().length);
      const controlEnabled = recall?.disabled === false;
      const controlText = recall?.textContent?.trim() || '';
      const controlLabel = recall?.getAttribute('aria-label') || '';
      recall?.click();
      const first = input.value;
      recall?.click();
      const second = input.value;
      recall?.click();
      const third = input.value;
      await setEnabled(false);
      const removedWhenDisabled = !chat.querySelector('[data-kf-composer-recall]');
      type('disabled draft');
      const disabledPrevented = key('ArrowUp', true);
      return {
        ok: true, plainPrevented, plainValue, controlVisible, controlEnabled, controlText, controlLabel,
        first, second, third, removedWhenDisabled,
        disabledPrevented, disabledValue: input.value,
      };
    } finally {
      await setEnabled(initiallyEnabled);
      chat.remove();
      if (beforePage) {
        shadow.querySelector('[data-action="open-settings"]')?.click();
        await settle(120);
        shadow.querySelector('[data-page="' + beforePage + '"]')?.click();
        shadow.querySelector('[data-action="close-settings"]')?.click();
      }
    }
  })()`);
  const composerRecall = composerRecallProbe.value || {};
  record('composer recall cycles only this tab own public sends from a visible control',
    composerRecall.ok === true
      && composerRecall.plainPrevented === false && composerRecall.plainValue === 'draft stays'
      && composerRecall.controlVisible === true && composerRecall.controlEnabled === true
      && composerRecall.controlText === 'Recall' && composerRecall.controlLabel.includes('2')
      && composerRecall.first === 'second local send'
      && composerRecall.second === 'first local send'
      && composerRecall.third === 'second local send'
      && composerRecall.removedWhenDisabled === true
      && composerRecall.disabledPrevented === false && composerRecall.disabledValue === 'disabled draft',
    composerRecall.ok
      ? `control=${composerRecall.controlVisible}/${composerRecall.controlEnabled}/${JSON.stringify(composerRecall.controlText)}, plain=${composerRecall.plainPrevented}/${JSON.stringify(composerRecall.plainValue)}, recalls=${JSON.stringify([composerRecall.first, composerRecall.second, composerRecall.third])}, removed=${composerRecall.removedWhenDisabled}, disabled=${composerRecall.disabledPrevented}/${JSON.stringify(composerRecall.disabledValue)}`
      : composerRecall.why);

  // StreamerStats refuses framing with X-Frame-Options: DENY, so the profile
  // action must open a real popup. Supply a stable channel action row and stub
  // window.open so this proves the URL, placement, security handoff, and popup
  // feature string without opening an external site during the release gate.
  const statsButtonProbe = await evaluate(pageClient, `(async () => {
    const settle = (ms = 650) => new Promise((done) => setTimeout(done, ms));
    const beforeUrl = location.pathname + location.search + location.hash;
    const beforeState = history.state;
    const beforeOpen = window.open;
    const row = document.createElement('div');
    row.style.cssText = 'position:fixed;left:-3000px;top:0;display:flex';
    const follow = document.createElement('button');
    follow.setAttribute('data-testid', 'follow-button');
    follow.textContent = 'Follow';
    row.append(follow);
    document.body.prepend(row);
    try {
      history.pushState({}, '', '/xqc');
      window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
      const host = await __kfWait(() => document.getElementById('kick-focus-streamer-stats'));
      if (!host) return { ok: false, why: 'profile stats control never mounted' };
      const button = host.shadowRoot?.querySelector('[data-kf-profile-stats]');
      if (!button) return { ok: false, why: 'profile stats button missing from its host' };
      const opened = {};
      const popup = {
        opener: window,
        location: { replace(url) { opened.url = url; } },
        focus() { opened.focused = true; },
      };
      window.open = (url, name, features) => {
        opened.initial = url;
        opened.name = name;
        opened.features = features;
        return popup;
      };
      button.click();
      await settle(50);
      return {
        ok: true,
        label: button.textContent.trim(),
        aria: button.getAttribute('aria-label'),
        sameRow: host.parentElement === row,
        opened,
        openerCleared: popup.opener === null,
      };
    } finally {
      window.open = beforeOpen;
      row.remove();
      history.replaceState(beforeState, '', beforeUrl);
      window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
      await settle();
    }
  })()`);
  const statsButton = statsButtonProbe.value || {};
  record('the channel profile Stats button opens the exact StreamerStats profile in a centered popup',
    statsButton.ok === true
      && statsButton.label === 'Stats'
      && statsButton.aria === 'Open xqc stats in StreamerStats'
      && statsButton.sameRow === true
      && statsButton.opened?.initial === ''
      && statsButton.opened?.name === 'kick-focus-streamer-stats'
      && statsButton.opened?.url === 'https://streamerstats.com/kick/channels/xqc'
      && /(?:^|,)popup=yes(?:,|$)/.test(statsButton.opened?.features || '')
      && /(?:^|,)resizable=yes(?:,|$)/.test(statsButton.opened?.features || '')
      && /(?:^|,)scrollbars=yes(?:,|$)/.test(statsButton.opened?.features || '')
      && statsButton.opened?.focused === true
      && statsButton.openerCleared === true,
    statsButton.ok
      ? `label=${JSON.stringify(statsButton.label)}, aria=${JSON.stringify(statsButton.aria)}, same row=${statsButton.sameRow}, popup=${JSON.stringify(statsButton.opened)}, opener cleared=${statsButton.openerCleared}`
      : statsButton.why);

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
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
  // uses rather than a second list that would rot separately, and measured on
  // every route rather than on whichever one this run happened to open.
  //
  // The old shape of this check was "the first probe must win, except for the
  // hooks we softened". That is not true of Kick and never was: a channel page
  // has no `#main-container`, so `main` has been resolving through the bare
  // `<main>` fallback on every channel since before this gate existed, and the
  // gate said nothing because it only ever ran on home. Measured 2026-08-19,
  // the same was true of the chat separator on a channel and of the chat panel
  // on home.
  //
  // So each route records which probe is *supposed* to win, in
  // `scripts/fixture-contract.mjs` beside the offline fixture expectations, and
  // drift is any change from that — in either direction. A stable id coming
  // back matters as much as one going away, and both are one line of output
  // instead of a silent fall-through.
  const PROBE_REPORT = `(async () => {
    const settle = (ms) => new Promise((done) => setTimeout(done, ms));
    const probes = ${JSON.stringify(LOCATOR_PROBES)};
    const out = {};
    for (const [hook, list] of Object.entries(probes)) {
      out[hook] = list.map((probe) => {
        try { return { id: probe.id, count: document.querySelectorAll(probe.selector).length }; }
        catch { return { id: probe.id, count: -1 }; }
      });
    }
    // The mod's own verdict on the values derived from those hooks, polled
    // rather than sampled: this tab was opened seconds ago and the apply cycle
    // publishes the attribute on its own schedule.
    let derived = null;
    for (let i = 0; i < 40 && !derived; i += 1) {
      derived = document.documentElement.dataset.kfDerived || null;
      if (!derived) await settle(300);
    }
    return { out, derived, route: location.pathname };
  })()`;

  /** Open one route in its own tab, read the probe report, close it again. */
  const sweepRoute = async (url) => {
    const opener = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await opener.ready;
    const targetId = (await opener.send('Target.createTarget', { url })).result.targetId;
    opener.close();
    await sleep(Number(process.env.KF_ROUTE_SETTLE_MS || 11000));
    const entry = (await json('/json/list')).find((candidate) => candidate.id === targetId);
    let report = { error: 'the route tab never opened' };
    if (entry) {
      const client = cdp(entry.webSocketDebuggerUrl);
      await client.ready;
      await client.send('Runtime.enable');
      report = await evaluate(client, PROBE_REPORT);
      client.close();
    }
    const closer = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await closer.ready;
    await closer.send('Target.closeTarget', { targetId });
    closer.close();
    return report.value || { why: report.error || 'the probe report returned nothing' };
  };

  for (const name of CAPTURABLE) {
    const contract = FIXTURE_CONTRACT[name];
    const swept = await sweepRoute(contract.url);
    if (!swept.out) {
      record(`Kick's shell on ${name} matches what the fixture contract records`, false, swept.why);
      continue;
    }
    const winners = {};
    const fellBack = [];
    const invalid = [];
    for (const [hook, list] of Object.entries(swept.out)) {
      if (list.some((probe) => probe.count === -1)) invalid.push(hook);
      const first = list.findIndex((probe) => probe.count > 0);
      winners[hook] = first === -1 ? null : list[first].id;
      // Reported for the hooks the contract does not pin — player controls,
      // sidebar sections — where a fall-through is worth saying out loud and
      // not worth failing on. The pinned five are already named in full below,
      // so repeating them here would read as a warning about the expectation
      // that was just confirmed.
      if (first > 0 && !(hook in contract.shell)) fellBack.push(`${hook}->${list[first].id}`);
    }
    // An optional hook is one Kick renders on this route only sometimes, and
    // its absence is not drift. A different probe winning still is: that is the
    // test id going away and a looser selector picking up something else.
    const optional = new Set(contract.optional || []);
    const changed = Object.entries(contract.shell)
      .filter(([hook, expected]) => winners[hook] !== expected && !(optional.has(hook) && winners[hook] === null))
      .map(([hook, expected]) => `${hook}: contract says ${expected || 'absent'}, Kick serves ${winners[hook] || 'absent'}`);
    const notRendered = [...optional].filter((hook) => winners[hook] === null);
    record(`Kick's shell on ${name} matches what the fixture contract records`,
      changed.length === 0,
      changed.length
        ? `${changed.join('; ')} — update scripts/fixture-contract.mjs and test/fixtures/${name}.html together`
        : `${Object.entries(contract.shell).map(([hook, probe]) => `${hook}:${probe || 'absent'}`).join(', ')}`
        + `${notRendered.length ? ` | optional and not rendered this run: ${notRendered.join(', ')}` : ''}`
        + `${fellBack.length ? ` | route-shaped fall-through (not a failure): ${fellBack.join(', ')}` : ''}`);
    record(`no shell hook on ${name} lost every probe it has`, invalid.length === 0,
      invalid.length ? `invalid selectors: ${invalid.join(', ')}` : 'every selector Kick still accepts as a selector');
    // R-56 per route: a hook matching says nothing about whether the value
    // computed from it survived, and twice in one month a whole feature class
    // died with every probe green. The mod publishes its own verdict on
    // `html[data-kf-derived]`, built from the derivers the apply cycle uses.
    recordProbe(`every probe that feeds a derived value still produces one on ${name}`,
      swept.derived ? {} : { skip: `the mod published no compatibility verdict on ${contract.url}` },
      swept.derived === 'ok',
      swept.derived === 'ok' ? 'nothing broken' : `resolved but derived nothing: ${swept.derived} (probe:derivedValue)`);
  }

  // R-82: which realtime transport Kick's broker is actually handing out.
  //
  // REALTIME_TRANSPORTS.KICK is registered verified: false because nothing in
  // this project has ever read a message over it, and the build prefers Pusher
  // while Kick still offers it. That preference is a unit test; what only a
  // live run can answer is what the broker says today, and whether the day it
  // stops offering Pusher has arrived. Asserting KICK works would mean
  // asserting a migration that has not happened, so this reports what was
  // offered and skips the verification half until it has.
  const brokerProbe = await evaluate(pageClient, `(async () => {
    const channel = await fetch('https://kick.com/api/v2/channels/xqc', { credentials: 'include', headers: { accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : null).catch(() => null);
    const chatroom = channel?.chatroom?.id;
    if (!chatroom) return { ok: false, why: 'the channel read did not answer with a chatroom id' };
    const response = await fetch('https://web.kick.com/api/v1/realtime/chat/' + chatroom + '/client/00000000-0000-4000-8000-000000000000/connection', {
      credentials: 'include', headers: { accept: 'application/json' },
    }).catch(() => null);
    if (!response) return { ok: false, why: 'the realtime broker could not be reached' };
    if (!response.ok) return { ok: true, status: response.status, offered: [] };
    const payload = await response.json().catch(() => null);
    const connections = payload?.data?.connections;
    return {
      ok: true,
      status: response.status,
      // Provider names only. No token, no app key, nothing from the credentials.
      offered: Array.isArray(connections) ? connections.map((entry) => String(entry?.provider || 'unknown')) : [],
      mode: String(payload?.data?.mode || ''),
    };
  })()`);
  const broker = brokerProbe.value || { why: brokerProbe.error || 'the probe returned nothing' };
  const offered = (broker.offered || []).map((name) => name.toUpperCase());
  const onlyKick = offered.length > 0 && offered.every((name) => name === 'KICK');
  recordProbe('the realtime broker still offers the transport this build has run against',
    onlyKick
      ? { skip: `the broker now offers only ${offered.join(', ')}, which no run has yet read a chat frame over; connect once against a live chatroom and record whether a ChatMessageEvent arrives before treating that transport as verified` }
      : {},
    broker.ok === true && offered.includes('PUSHER'),
    broker.ok
      ? `HTTP ${broker.status}, providers offered: ${offered.join(', ') || 'none'}${broker.mode ? ` (mode ${broker.mode})` : ''}`
      : broker.why);

  /**
   * R-74: whether Kick's own CSP would still let the companion inject.
   *
   * The Firefox companion puts the page bundle in the document as an inline
   * script element, deliberately, because injecting it from a moz-extension URL
   * leaks a per-install UUID into the page. That works only because Kick serves
   * no script policy. The day it does, Firefox users lose the whole build with
   * no error anyone would connect to Kick.
   *
   * Read from the navigation response itself, over CDP, rather than from a
   * second fetch of the same URL. A re-fetch carries Sec-Fetch-Dest: empty, and
   * edge middleware routinely attaches CSP only to document requests, so a
   * policy that blocks the companion could be served all day while the probe
   * reported a confident "no CSP". The tab opens blank, Network is enabled, and
   * only then does it navigate, which is what makes the document response
   * observable at all.
   *
   * The verdict is scripts/csp.mjs, unit-tested: directive precedence and the
   * intersection across several enforcing policies are both easy to get
   * backwards, and getting them backwards is what turns this into decoration.
   */
  const readDocumentCsp = async (url) => {
    const opener = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await opener.ready;
    const targetId = (await opener.send('Target.createTarget', { url: 'about:blank' })).result.targetId;
    opener.close();
    const entry = (await json('/json/list')).find((candidate) => candidate.id === targetId);
    let reading = { measured: false, why: 'the CSP tab never opened' };
    if (entry) {
      const client = cdp(entry.webSocketDebuggerUrl);
      await client.ready;
      await client.send('Runtime.enable');
      await client.send('Network.enable');
      await client.send('Page.navigate', { url });
      await sleep(9000);
      const documents = client.events.filter((event) => event.method === 'Network.responseReceived'
        && event.params?.type === 'Document'
        && String(event.params?.response?.url || '').startsWith('https://kick.com'));
      const response = documents[documents.length - 1]?.params?.response;
      const header = (name) => Object.entries(response?.headers || {})
        .filter(([key]) => key.toLowerCase() === name)
        .map(([, value]) => value);
      // The meta form binds the same document and is invisible to the response.
      const meta = await evaluate(client, `(() => {
        const nodes = [...document.querySelectorAll('meta[http-equiv]')]
          .filter((node) => String(node.httpEquiv).toLowerCase().startsWith('content-security-policy'));
        return {
          enforcing: nodes.filter((node) => !String(node.httpEquiv).toLowerCase().endsWith('report-only')).map((node) => String(node.content || '')),
          reporting: nodes.filter((node) => String(node.httpEquiv).toLowerCase().endsWith('report-only')).map((node) => String(node.content || '')),
          landed: location.href,
        };
      })()`);
      client.close();
      reading = response
        ? {
          measured: true,
          status: response.status,
          landed: meta.value?.landed || response.url,
          enforcing: header('content-security-policy'),
          reporting: header('content-security-policy-report-only'),
          meta: meta.value || { enforcing: [], reporting: [] },
        }
        : { measured: false, why: `no document response was observed for ${url}` };
    }
    const closer = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await closer.ready;
    await closer.send('Target.closeTarget', { targetId });
    closer.close();
    return reading;
  };

  // The document loaded or it did not. There is no third answer here, so this
  // is a record and never a skip: an unmeasured CSP is the same blind spot the
  // check exists to close.
  for (const [routeName, routeUrl] of [['home', 'https://kick.com/'], ['channel', FIXTURE_CONTRACT.channel.url]]) {
    const reading = await readDocumentCsp(routeUrl);
    const verdict = reading.measured
      ? inlineScriptVerdict(reading.enforcing, reading.meta.enforcing)
      : { allowed: false, policies: 0, governing: [], blockedBy: [] };
    const reportOnly = reading.measured ? [...reading.reporting, ...reading.meta.reporting].length : 0;
    const shape = verdict.policies === 0
      ? 'no enforcing Content-Security-Policy on the document response or in its markup'
      : `${verdict.policies} enforcing polic${verdict.policies === 1 ? 'y' : 'ies'}, script source ${verdict.governing.join(' | ') || 'ungoverned'}`;
    const refused = verdict.blockedBy.length
      ? ` -- the Firefox companion injects the page bundle inline and ${verdict.blockedBy.join(' | ')} refuses it`
      : '';
    record(`Kick's ${routeName} document still lets the companion inject`,
      reading.measured === true && verdict.allowed === true,
      reading.measured
        ? `HTTP ${reading.status} for ${reading.landed}: ${shape}${refused}${reportOnly ? `; ${reportOnly} report-only policy recorded` : ''}`
        : `CSP unmeasured: ${reading.why}`);
  }

  // R-68: what a busy chat costs, measured rather than reasoned about.
  //
  // The comfort switches all ride the pass that already walks chat once per
  // apply cycle, which is the whole reason they were built that way — but "it
  // reuses the existing walk" is a claim, and a channel doing 300 messages a
  // minute is where a claim like that stops being true. So all five go on, a
  // burst of rows lands in Kick's own message container, and the apply cycle is
  // timed with them there.
  //
  // The budget: the apply cycle already reports its own recent average, and the
  // gate already asserts that number exists. 120 ms is the line here — well
  // above what a healthy cycle costs on this page and well below the point at
  // which a reader would feel chat stutter, so it fails on a real regression
  // rather than on a busy machine.
  const chatBench = await evaluate(pageClient, `(async () => {
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
    const settle = (ms = 500) => new Promise((done) => setTimeout(done, ms));
    const messages = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages');
    if (!messages) return { skip: 'Kick rendered no chat message list on this route; run the gate against a channel URL to measure it' };

    // Every switch on at once, through the same controls a person would use.
    shadow.querySelector('[data-kf-quick]').click();
    shadow.querySelector('[data-action="command:settings"]').click();
    shadow.querySelector('[data-page="content"]').click();
    await settle();
    const switches = ['content.chatTimestamps', 'content.chatMentionSound', 'content.chatHideMessages', 'content.chatHistory'];
    for (const path of switches) {
      const control = shadow.querySelector('[data-set="' + path + '"]');
      if (control && control.getAttribute('aria-checked') !== 'true') control.click();
      await settle(150);
    }
    const on = switches.filter((path) => shadow.querySelector('[data-set="' + path + '"]')?.getAttribute('aria-checked') === 'true');
    shadow.querySelector('[data-action="close-settings"]')?.click();
    await settle();

    // 300 rows shaped like Kick's own: an indexed wrapper, an author button,
    // and a text run.
    const burst = document.createElement('div');
    burst.dataset.kfBench = 'true';
    for (let i = 0; i < 300; i += 1) {
      const row = document.createElement('div');
      row.dataset.index = 'kfbench' + i;
      row.className = 'group';
      const author = document.createElement('button');
      author.dataset.preventExpand = 'true';
      author.textContent = 'bench' + (i % 12);
      const text = document.createElement('span');
      text.textContent = 'benchmark message ' + i + ' with enough words in it to be a realistic line of chat';
      row.append(author, text);
      burst.append(row);
    }
    messages.append(burst);

    // Time the cycle with the rows in place. A mutation is what schedules one,
    // and the cost the mod publishes is what the gate already reads elsewhere.
    const started = performance.now();
    window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
    await settle(1500);
    const elapsed = performance.now() - started;
    const marked = document.querySelectorAll('[data-kf-bench] [data-kf-chat-hide]').length;
    const hideControls = marked;
    // The cost line only exists on the About page, so go and read it there
    // rather than off a page that never renders it.
    shadow.querySelector('[data-kf-quick]').click();
    shadow.querySelector('[data-action="command:settings"]').click();
    shadow.querySelector('[data-page="about"]').click();
    await settle();
    const cost = String(shadow.querySelector('[data-kf-apply-cost]')?.textContent || '');
    shadow.querySelector('[data-action="close-settings"]')?.click();
    const recent = /recent avg ([\\d.]+) ms/.exec(cost);

    burst.remove();
    await settle(600);
    return {
      ok: true,
      on: on.length,
      marked,
      hideControls,
      recentAvgMs: recent ? Number(recent[1]) : null,
      wallMs: Math.round(elapsed),
    };
  })()`);
  const bench = chatBench.value || {};
  recordProbe('a 300-message burst with every chat comfort switch on stays inside the apply budget',
    bench,
    bench.ok === true
      && bench.on === 4
      && bench.marked >= 300
      && bench.hideControls >= 300
      && Number.isFinite(bench.recentAvgMs) && bench.recentAvgMs < 120,
    bench.ok
      ? `${bench.on}/4 switches on; ${bench.marked} rows marked and ${bench.hideControls} dismiss controls added; recent avg ${bench.recentAvgMs} ms, wall ${bench.wallMs} ms`
      : bench.why);

  // R-75: scrolling the transcript up enters the paused state the button owns.
  //
  // Only a browser can answer this. The trigger is a real scroll event on
  // Kick's own list, the arming decision is made from that list's measured
  // distance from the bottom, and the thing being asserted is that the position
  // the reader scrolled to is still there afterwards — which is the whole point
  // of pausing and the part a unit test cannot see, because it needs layout.
  const scrollPause = await evaluate(pageClient, `(async () => {
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
    const settle = (ms = 500) => new Promise((done) => setTimeout(done, ms));
    const messages = document.querySelector('[data-testid="chatroom-messages"], #chatroom-messages');
    if (!messages) return { skip: 'Kick rendered no chat message list on this route; run the gate against a channel URL to assert pause-on-scroll' };

    const setSwitch = async (path, on) => {
      shadow.querySelector('[data-kf-quick]').click();
      shadow.querySelector('[data-action="command:settings"]').click();
      shadow.querySelector('[data-page="content"]').click();
      await settle();
      const control = shadow.querySelector('[data-set="' + path + '"]');
      if (control && (control.getAttribute('aria-checked') === 'true') !== on) control.click();
      await settle(300);
      const now = shadow.querySelector('[data-set="' + path + '"]')?.getAttribute('aria-checked');
      shadow.querySelector('[data-action="close-settings"]')?.click();
      await settle(300);
      return now;
    };
    const armed = await setSwitch('content.stickyChatPause', true);
    if (armed !== 'true') return { ok: false, why: 'the Pause chat updates switch would not go on' };

    // Kick's own transcript, unmodified, and that is deliberate. It is a
    // virtualised list: 26 rows in the DOM against a scroll height of several
    // thousand pixels, overflow-y hidden, and Kick's virtualiser owning
    // scrollTop. Appending rows to it — which an earlier version of this probe
    // did, to guarantee something to scroll — breaks the spacer arithmetic, and
    // the virtualiser then fights every scroll assignment for the rest of the
    // run. Whatever backlog the live channel has is what gets scrolled.
    await settle(900);
    // The control the mod appends, and the element it hangs it on. Read from
    // the document rather than guessed at, so this cannot drift from whatever
    // the runtime decided the chat owner was.
    const control = () => document.querySelector('[data-kf-chat-pause]');
    const read = () => ({
      paused: control()?.parentElement?.dataset.kfChatPaused,
      label: String(control()?.textContent || ''),
    });
    if (!await __kfWait(() => control())) {
      await setSwitch('content.stickyChatPause', false);
      return { skip: 'the chat panel probe resolved nothing on this route, so no pause control was mounted; run the gate against a channel URL to assert pause-on-scroll' };
    }
    const scrollable = messages.scrollHeight - messages.clientHeight;
    if (scrollable < 400) {
      await setSwitch('content.stickyChatPause', false);
      return { skip: 'Kick chat on this route has no backlog to scroll back through, only ' + scrollable + 'px of range; run the gate against a busier channel to assert pause-on-scroll' };
    }

    // Land at the bottom, live and unpaused, which is where a reader starts.
    // A transcript already scrolled back is the condition under test, so it has
    // to be ruled out before the scroll that is supposed to cause it.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (read().paused === 'true') { control().click(); await settle(600); }
      messages.scrollTop = messages.scrollHeight;
      messages.dispatchEvent(new Event('scroll'));
      await settle(600);
      const distance = messages.scrollHeight - messages.scrollTop - messages.clientHeight;
      if (read().paused === 'false' && distance <= 2) break;
    }
    const before = read();

    // Establish direction explicitly. A scrollTop assignment normally queues a
    // scroll event, but Chromium may coalesce it with Kick's own live-edge
    // correction. Dispatching the event here exercises the exact passive
    // listener a wheel movement reaches without relying on that scheduling.
    const landed = Math.max(0, messages.scrollTop - 300);
    messages.scrollTop = landed;
    messages.dispatchEvent(new Event('scroll'));
    await __kfWait(() => read().paused === 'true', { timeout: 3000 });
    await settle(300);
    const after = { ...read(), top: Math.round(messages.scrollTop) };

    const viewport = messages.getBoundingClientRect();
    const visible = (node) => {
      const rect = node.getBoundingClientRect();
      return rect.height > 0
        && rect.bottom > viewport.top
        && rect.top < viewport.bottom
        && String(node.textContent || '').trim().length > 0;
    };
    const identified = [...messages.querySelectorAll('[data-index], [data-message-id], [data-chat-entry], [role="listitem"], article, .group')]
      .filter(visible);
    const painted = [];
    if (!identified.length && typeof document.elementsFromPoint === 'function') {
      for (const ratio of [0.2, 0.5, 0.8]) {
        const x = Math.min(viewport.right - 4, viewport.left + viewport.width * ratio);
        for (let y = viewport.top + 8; y < viewport.bottom - 4; y += 24) {
          const owners = [];
          for (const hit of document.elementsFromPoint(x, y)) {
            if (!messages.contains(hit)) continue;
            for (let node = hit; node && node !== messages; node = node.parentElement) {
              const rect = node.getBoundingClientRect();
              if (rect.height >= 16
                && rect.height <= Math.max(240, viewport.height * 0.45)
                && rect.width >= viewport.width * 0.5
                && String(node.textContent || '').trim().length > 0) owners.push({ node, rect });
            }
          }
          owners.sort((a, b) => a.rect.height - b.rect.height || b.rect.width - a.rect.width);
          if (owners[0] && !painted.includes(owners[0].node)) painted.push(owners[0].node);
        }
      }
    }
    const rows = (identified.length ? identified : painted)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const chosen = rows.find((node) => node.getBoundingClientRect().top >= viewport.top) || rows[0] || null;
    const rowSignature = (node) => {
      if (!node) return '';
      const stable = node.getAttribute('data-message-id') || node.getAttribute('data-index') || node.getAttribute('data-chat-entry') || '';
      const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
      return (stable ? 'id:' + stable + '|' : 'text:') + text;
    };
    const anchor = chosen ? {
      node: chosen,
      signature: rowSignature(chosen),
      offset: chosen.getBoundingClientRect().top - viewport.top,
    } : null;
    const anchorRowCount = rows.length;
    const anchorSignature = anchor?.signature || '';
    const anchorStart = anchor?.offset ?? null;

    // Five seconds gives a busy channel enough time to append and recycle rows.
    // The same visible row must stay in place while it remains mounted, and the
    // transcript must remain outside the pause-on-scroll threshold.
    await settle(5000);
    const held = Math.round(messages.scrollTop);
    const pixelDrift = Math.round(Math.abs(held - after.top) * 10) / 10;
    const heldDistance = Math.round(messages.scrollHeight - messages.scrollTop - messages.clientHeight);
    const anchorEnd = anchor?.node?.isConnected
      ? anchor.node.getBoundingClientRect().top - messages.getBoundingClientRect().top
      : null;
    const anchorEndSignature = anchor?.node?.isConnected ? rowSignature(anchor.node) : '';
    const anchorSame = Boolean(anchorSignature) && anchorEndSignature === anchorSignature;
    const anchorDrift = anchorStart === null || anchorEnd === null
      ? null
      : Math.round(Math.abs(anchorEnd - anchorStart) * 10) / 10;

    control()?.click();
    await settle(700);
    const resumed = read();

    const off = await setSwitch('content.stickyChatPause', false);
    await settle(400);
    const cleared = { button: Boolean(control()) };
    return { ok: true, before, after, held, pixelDrift, heldDistance, landed: Math.round(landed), anchorRowCount, anchorSignature, anchorEndSignature, anchorSame, anchorStart, anchorEnd, anchorDrift, resumed, off, cleared };
  })()`);
  const scroll = scrollPause.value || { why: scrollPause.error || 'the probe returned nothing' };
  recordProbe('scrolling chat up enters the paused state, and Resume leaves it',
    scroll,
    scroll.ok === true
      && scroll.before?.paused === 'false'
      && scroll.after?.paused === 'true'
      && /Resume chat/.test(scroll.after?.label || '')
      && scroll.anchorSame === true
      && Number.isFinite(scroll.anchorDrift)
      && scroll.anchorDrift <= 8
      && scroll.heldDistance > 64
      && scroll.resumed?.paused === 'false'
      && /Pause chat/.test(scroll.resumed?.label || '')
      && scroll.cleared?.button === false,
    scroll.ok
      ? `paused ${scroll.before?.paused} -> ${scroll.after?.paused} -> ${scroll.resumed?.paused}; button "${scroll.before?.label}" -> "${scroll.after?.label}" -> "${scroll.resumed?.label}"; anchor rows ${scroll.anchorRowCount}, same message=${scroll.anchorSame}, drift ${scroll.anchorDrift}px, pixel drift ${scroll.pixelDrift}px, held ${scroll.held}px against ${scroll.landed}px, still ${scroll.heldDistance}px off the live edge; switch off removes the control=${scroll.cleared?.button === false}`
      : scroll.why);

  // R-76: a banned reader's way back into a chat, still on screen.
  //
  // Kick shipped Unban Request around 2026-08-07. It replaces the composer for
  // someone who has been banned, and it is the only route back — so it is the
  // one chat control where "this build restyled it into invisibility" would
  // cost somebody their access rather than annoy them. Poor mode hides what the
  // monetization classifier tags, and `test/core.test.js` proves none of the
  // unban spellings classify; this is the other half, measured rather than
  // reasoned: if Kick put the control in this document, it is visible.
  //
  // A run against a chat this account is not banned in has nothing to assert,
  // and says so with the selector, rather than passing quietly.
  const unbanProbe = await evaluate(pageClient, `(() => {
    const selector = '[data-testid*="unban" i], [data-testid*="ban-request" i]';
    // Copy has to *ask* for an unban, not merely contain the word. A channel
    // titled "EVERYONE UNBANNED" put the substring into this build's own card
    // chips, and an earlier version of this probe reported three of them as
    // Kick's control — a check that matches the wrong node passes for the wrong
    // reason, which is worse than not having it.
    const ASKS = /\\b(request|appeal|submit)\\b[^.]{0,24}\\bunban\\b|\\bunban\\b[^.]{0,24}\\b(request|appeal)\\b/i;
    const ours = (node) => Boolean(node.closest('[data-kf-card-actions]')) || node.closest('#kick-focus-root') !== null;
    const byAttribute = [...document.querySelectorAll(selector)];
    const byCopy = [...document.querySelectorAll('button, a, [role="button"]')]
      .filter((node) => ASKS.test(String(node.textContent || '').replace(/\\s+/g, ' '))
        || ASKS.test(String(node.getAttribute('aria-label') || '')));
    const found = [...new Set([...byAttribute, ...byCopy])].filter((node) => !ours(node));
    if (!found.length) return { skip: 'this account is not banned in the chat on this route, so Kick rendered no unban control to keep reachable; the check asserts ' + selector + ' and any control whose copy asks for an unban' };
    const seen = found.map((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        how: node.dataset.testid || node.getAttribute('aria-label') || String(node.textContent || '').trim().slice(0, 40),
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        area: Math.round(rect.width) * Math.round(rect.height),
        // The tag Poor mode keys its display:none off. Present here would mean
        // the classifier reached a control it must never reach.
        monetization: node.closest('[data-kf-monetization]') ? 'tagged' : '',
      };
    });
    return { ok: true, seen };
  })()`);
  const unban = unbanProbe.value || { why: unbanProbe.error || 'the probe returned nothing' };
  const unbanHidden = (unban.seen || []).filter((node) => node.display === 'none' || node.visibility === 'hidden' || node.opacity === 0 || node.area === 0 || node.monetization);
  recordProbe("Kick's Request Unban control is still reachable under this build's CSS",
    unban,
    unban.ok === true && unbanHidden.length === 0,
    unban.ok
      ? `${unban.seen.length} unban control(s): ${unban.seen.map((node) => `"${node.how}" display=${node.display} area=${node.area}px²${node.monetization ? ' MONETIZATION-TAGGED' : ''}`).join('; ')}`
      : unban.why);

  // The viewer hub, on the one thing only a browser can answer: that an absent
  // reading reaches the screen as words rather than as a number.
  //
  // Logged out, which is the interesting case — Kick renders no reward control,
  // no points control and no Drops entry, and answers the collectible read with
  // 403 — so every card here should be explaining itself. A digit in any of
  // them is the exact defect this feature was built to avoid: an unread value
  // rendered as zero, which reads as "you have none".
  const hubProbe = await evaluate(pageClient, `(async () => {
    const expectedCardIds = ${JSON.stringify(VIEWER_HUB_CARDS.map(({ id }) => id))};
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
    const settle = (ms = 500) => new Promise((done) => setTimeout(done, ms));
    shadow.querySelector('[data-kf-quick]').click();
    shadow.querySelector('[data-action="command:settings"]').click();
    shadow.querySelector('[data-page="viewer"]')?.click();
    await settle();
    const cards = await __kfWait(() => {
      const found = [...shadow.querySelectorAll('[data-kf-hub-card]')];
      return found.length === expectedCardIds.length
        && found.every((card, index) => card.dataset.kfHubCard === expectedCardIds[index])
        ? found
        : null;
    }, { timeout: 8000 });
    if (!cards) {
      const found = [...shadow.querySelectorAll('[data-kf-hub-card]')].map((card) => card.dataset.kfHubCard);
      return {
        ok: false,
        why: 'expected ' + expectedCardIds.join(', ') + ' in registry order; found ' + (found.join(', ') || 'no cards'),
      };
    }
    // Give the collectible read time to answer, so the loading state is not
    // what gets measured.
    await settle(2500);
    const read = [...shadow.querySelectorAll('[data-kf-hub-card]')].map((card) => ({
      id: card.dataset.kfHubCard,
      state: card.dataset.state,
      value: String(card.querySelector('strong')?.textContent || '').trim(),
      explained: String(card.querySelector('em')?.textContent || '').trim().length > 0,
    }));
    const sources = String(shadow.querySelector('[data-kf-hub-sources]')?.textContent || '').trim();
    // The earned marker, which must not exist at all on an anonymous page.
    const quick = shadow.querySelector('[data-kf-quick]');
    const marked = [...shadow.querySelectorAll('[data-kf-earned]')].map((node) => node.dataset.kfEarned);
    const navEarned = String(shadow.querySelector('[data-page="viewer"] [data-kf-nav-earned]')?.textContent || '');
    shadow.querySelector('[data-action="close-settings"]')?.click();
    return { ok: true, read, sources, marked, navEarned, quickLabel: String(quick?.getAttribute('aria-label') || '') };
  })()`);
  const hub = hubProbe.value || {};
  const hubCards = hub.read || [];
  const numeric = hubCards.filter((card) => card.state !== 'ready' && /[0-9]/.test(card.value));
  const unexplained = hubCards.filter((card) => !card.explained);
  record('the viewer hub renders every card, and an unread one shows words rather than a zero',
    hub.ok === true
      && hubCards.length === VIEWER_HUB_CARDS.length
      && hubCards.every((card, index) => card.id === VIEWER_HUB_CARDS[index].id)
      && numeric.length === 0
      && unexplained.length === 0
      && String(hub.sources || '').length > 0,
    hub.ok
      ? `${hubCards.map((card) => `${card.id}=${card.state}:${JSON.stringify(card.value)}`).join(' ')}`
        + `${numeric.length ? ` | showed a number with no reading: ${numeric.map((card) => card.id).join(', ')}` : ''}`
        + `${unexplained.length ? ` | explained nothing: ${unexplained.map((card) => card.id).join(', ')}` : ''}`
      : hub.why);

  // R-69: nothing is marked as earned for an account that has none.
  //
  // Logged out there is no reward control on the page, so there is no earned
  // state to publish, and a client that invented a badge here would be applying
  // engagement pressure on Kick's behalf rather than reporting something.
  record('an anonymous page carries no earned-state marker anywhere',
    hub.ok === true
      && Array.isArray(hub.marked) && hub.marked.length === 0
      && String(hub.navEarned || '') === ''
      && !/reward/i.test(hub.quickLabel || ''),
    hub.ok
      ? `marked ${JSON.stringify(hub.marked)}, nav note ${JSON.stringify(hub.navEarned)}, quick button labelled ${JSON.stringify(hub.quickLabel)}`
      : hub.why);

  // The journeys only a session can reach.
  //
  // This gate runs logged out on purpose: it needs no credentials, cannot
  // damage an account, and is safe to run anywhere. What that used to cost is
  // that everything behind a session was covered by a manual pass whose result
  // lived in one line of README prose, which is not evidence. So the matrix in
  // `scripts/signed-in-journeys.mjs` names each journey, and this either
  // asserts it or says out loud that it did not — one line per journey either
  // way, so a release states what was exercised rather than implying all of it
  // was.
  //
  // Point the gate at a profile that is already signed in
  // (`KF_USER_DATA_DIR=/path/to/profile`) to turn the skips into assertions.
  // No check here writes anything: the expectations are selector reads, and
  // `scripts/check.mjs` proves the build's only account write is the follow
  // request behind the click-to-save gesture, which is none of these journeys.
  const sessionProbe = await evaluate(pageClient, `(async () => {
    try {
      // The per-account read this build already declares. 200 means a session,
      // 401/403 means anonymous, and nothing new is requested to find out.
      const response = await fetch('https://kick.com/api/v2/channels/xqc/me', {
        credentials: 'include', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000),
      });
      return { status: response.status };
    } catch { return { status: 'network' }; }
  })()`);
  const sessionStatus = sessionProbe.value?.status ?? 'unreadable';
  const signedIn = sessionStatus === 200;
  record('this run knows whether it has a Kick session', sessionStatus !== 'unreadable',
    `the per-account read answered ${sessionStatus}, so the signed-in matrix runs ${signedIn ? 'as assertions' : 'as skips'}`);

  for (const journey of SIGNED_IN_JOURNEYS) {
    const label = `signed-in journey: ${journey.title}`;
    if (!signedIn) {
      skip(label, `${journey.why}; run with KF_USER_DATA_DIR pointing at a signed-in profile to assert ${journey.expects.join(' and ')} on ${journey.route}`);
      continue;
    }
    const opener = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await opener.ready;
    const targetId = (await opener.send('Target.createTarget', { url: `https://kick.com${journey.route}` })).result.targetId;
    opener.close();
    await sleep(Number(process.env.KF_ROUTE_SETTLE_MS || 11000));
    const entry = (await json('/json/list')).find((candidate) => candidate.id === targetId);
    let seen = { why: 'the journey tab never opened' };
    if (entry) {
      const client = cdp(entry.webSocketDebuggerUrl);
      await client.ready;
      await client.send('Runtime.enable');
      const probe = await evaluate(client, `(() => {
        const expects = ${JSON.stringify(journey.expects)};
        // Counts only. Nothing is read out of these nodes: no display name, no
        // balance, no notification text, nothing a committed log should carry.
        const counts = expects.map((selector) => {
          try { return [selector, document.querySelectorAll(selector).length]; }
          catch { return [selector, -1]; }
        });
        return { ok: true, counts, landed: location.pathname, mounted: Boolean(document.getElementById('kick-focus-root')) };
      })()`);
      seen = probe.value || { why: probe.error || 'the journey probe returned nothing' };
      client.close();
    }
    const closer = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await closer.ready;
    await closer.send('Target.closeTarget', { targetId });
    closer.close();
    const missing = (seen.counts || []).filter(([, count]) => count < 1).map(([selector]) => selector);
    // Landing somewhere else means Kick bounced the route, which for these is
    // the session expiring mid-run rather than the expectation being wrong.
    const bounced = seen.ok && seen.landed !== journey.route && !journey.route.startsWith('/x');
    recordProbe(label,
      bounced ? { skip: `Kick redirected ${journey.route} to ${seen.landed}, so this run's session no longer reaches it` } : {},
      seen.ok === true && seen.mounted === true && missing.length === 0,
      seen.ok
        ? `mounted on ${seen.landed}; ${(seen.counts || []).map(([selector, count]) => `${count}x ${selector}`).join('; ')}`
      : seen.why);
  }
  const journeyOutcomes = results
    .filter((entry) => entry.label.startsWith('signed-in journey:'))
    .map((entry) => entry.outcome);
  record('signed-in journey coverage never turns an unavailable session into a pass',
    journeyOutcomes.length === SIGNED_IN_JOURNEYS.length
      && (signedIn || journeyOutcomes.every((outcome) => outcome === 'skip')),
    signedIn
      ? `${journeyOutcomes.filter((outcome) => outcome === 'pass').length} asserted, ${journeyOutcomes.filter((outcome) => outcome === 'skip').length} redirected or unavailable`
      : `${journeyOutcomes.filter((outcome) => outcome === 'skip').length}/${SIGNED_IN_JOURNEYS.length} reported as skips`);

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
    if (!video) return { skip: 'Kick rendered no video on this route; run the gate against a channel URL to assert it' };
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
  recordProbe('a player overlay anchors to a container, never to the video element itself', overlay,
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
    // The waiter lives in the page, so a second tab needs its own copy.
    await evaluate(c, PAGE_WAIT_HELPER);
    try {
      const probe = await evaluate(c, `(async () => {
        const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
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

  // R-49: the VOD retention chip, on a real recording. This needs its own tab
  // on a `/{slug}/videos/{uuid}` route, and the reference value is recomputed
  // in the page from Kick's own list, so a wrong retention tier or a timezone
  // misparse cannot pass — both are off by whole days.
  const vodTab = await (async () => {
    const found = await evaluate(pageClient, `(async () => {
      try {
        const res = await fetch('https://web.kick.com/api/v1/channels/668/videos', { credentials: 'include', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) return '';
        const body = await res.json();
        const rows = Array.isArray(body) ? body : (body && body.data) || [];
        return rows.length ? 'xqc/videos/' + rows[0].id : '';
      } catch { return ''; }
    })()`);
    const path = found.value || '';
    if (!path) return { id: '', why: "Kick did not answer the VOD list for this browser, so there is no recording to date" };
    const c = cdp((await json('/json/version')).webSocketDebuggerUrl);
    await c.ready;
    const r = await c.send('Target.createTarget', { url: `https://kick.com/${path}` });
    c.close();
    return { id: r.result.targetId, path };
  })();
  if (vodTab.id) await sleep(10000);

  const vod = vodTab.id ? await (async () => {
    const target = (await json('/json/list')).find((t) => t.id === vodTab.id);
    if (!target?.webSocketDebuggerUrl) return { ok: false, why: 'the VOD tab did not attach' };
    const c = cdp(target.webSocketDebuggerUrl);
    await c.ready;
    await evaluate(c, PAGE_WAIT_HELPER);
    try {
      const probe = await evaluate(c, `(async () => {
        const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
        if (!shadow) return { skip: 'the mod did not mount on the VOD tab, so there was nothing to ask' };
        const uuid = location.pathname.split('/').filter(Boolean)[2] || '';

        // Recompute the expected window from Kick's own two reads, so this
        // asserts a derived value rather than merely that a chip exists.
        let startedAt = 0;
        let verified = null;
        try {
          const list = await fetch('https://web.kick.com/api/v1/channels/668/videos', { credentials: 'include', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) }).then((r) => r.json());
          const rows = Array.isArray(list) ? list : (list && list.data) || [];
          const entry = rows.find((row) => row && row.id === uuid);
          if (entry) startedAt = Date.parse(entry.start_time);
          const channel = await fetch('https://kick.com/api/v2/channels/xqc', { credentials: 'include', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) }).then((r) => r.json());
          verified = Boolean(channel && channel.verified);
        } catch { /* leave the reference unknown */ }
        if (!startedAt || verified === null) return { skip: 'Kick rate-limited the reference reads on this run, so there is nothing to check the chip against' };

        const days = verified ? 30 : 7;
        const expectedMs = startedAt + days * 86400000 - Date.now();

        // Establish the precondition rather than inherit it. Sixty probes run
        // against this profile before this one, several of them importing and
        // undoing whole settings payloads, so "the default is on" is not a
        // safe assumption by the time the tab opens.
        const settle = () => new Promise((done) => setTimeout(done, 900));
        const toggle = () => shadow.querySelector('[data-set="content.showVodExpiry"]');
        try {
          shadow.querySelector('[data-action="open-settings"]')?.click();
          await settle();
          shadow.querySelector('[data-page="content"]')?.click();
          await settle();
          // A precondition that could not be established is a skip, not a
          // defect in the feature: this runs after sixty probes against one
          // profile, and a settings shell that will not open in a degraded tab
          // says nothing about whether a recording gets dated.
          if (!toggle()) return { skip: 'the settings shell did not offer the VOD expiry control in this tab, so the chip could not be put under test' };
          if (toggle().getAttribute('aria-checked') !== 'true') { toggle().click(); await settle(); }
        } finally {
          shadow.querySelector('[data-action="close-settings"]')?.click();
        }

        const chip = await __kfWait(() => document.querySelector('[data-kf-vod-expiry]'), { timeout: 20000 });
        if (!chip) {
          // Say which precondition was missing rather than only that the chip
          // was absent: the surface needs a player box to hang from, and a
          // background tab that never started playback has none.
          const video = document.querySelector('video');
          const settings = (() => { try { return JSON.parse(localStorage.getItem('kick-focus:settings') || '{}').content || {}; } catch { return {}; } })();
          // This reads the *stored* blob, which legitimately omits a key the
          // profile has never written; the effective value is the normalised
          // default. Reported anyway because a stored false is the one case
          // that explains an absent chip.
          return { ok: false, why: 'no retention chip: video=' + Boolean(video)
            + ' storedSetting=' + JSON.stringify(settings.showVodExpiry)
            + ' liveReads=' + settings.liveEmoteCatalog
            + ' uptimeChip=' + Boolean(document.querySelector('[data-kf-uptime]'))
            + ' entryInList=true verified=' + verified };
        }
        const box = chip.getBoundingClientRect();

        // And the silence half, which is the part worth getting right: with the
        // setting off the chip must be gone, not merely hidden.
        let removed = false;
        try {
          shadow.querySelector('[data-action="open-settings"]')?.click();
          await settle();
          shadow.querySelector('[data-page="content"]')?.click();
          await settle();
          // Re-queried each time: changing a setting re-renders the page, so a
          // held reference points at a detached node by the second click.
          if (toggle()) { toggle().click(); await settle(); removed = !document.querySelector('[data-kf-vod-expiry]'); toggle()?.click(); }
        } finally {
          shadow.querySelector('[data-action="close-settings"]')?.click();
        }
        return {
          ok: true,
          text: chip.textContent,
          label: chip.getAttribute('aria-label') || '',
          expectedDays: Math.floor(expectedMs / 86400000),
          verified,
          days,
          width: Math.round(box.width),
          height: Math.round(box.height),
          removed,
        };
      })()`);
      return probe.value || { ok: false, why: probe.error || 'the VOD probe returned nothing' };
    } finally {
      c.close();
      const closer = cdp((await json('/json/version')).webSocketDebuggerUrl);
      await closer.ready;
      await closer.send('Target.closeTarget', { targetId: vodTab.id });
      closer.close();
    }
  })() : { skip: vodTab.why };

  recordProbe('a VOD says how long Kick will keep it, computed from Kick own date and tier', vod,
    vod.ok === true
      // The label must agree with the window recomputed from Kick's own two
      // reads. A wrong tier is off by 23 days and a zone misparse by hours.
      && vod.text === (vod.expectedDays >= 2 ? `${vod.expectedDays}d` : vod.text)
      && vod.expectedDays >= 0
      && vod.width > 0 && vod.height > 0
      && vod.removed === true,
    vod.ok
      ? `chip reads ${JSON.stringify(vod.text)} against ${vod.expectedDays}d computed from Kick's own start time and verified=${vod.verified} (${vod.days}-day tier); ${vod.width}x${vod.height}px; hides when switched off=${vod.removed}`
      : vod.why);

  // Poor mode against the two surfaces it used to miss. Both are identified by
  // test id alone and neither is a control — the KICKs balance is a <span>
  // whose whole text is a number, and the gift shop is a panel — so a tagger
  // that walks buttons and links cannot reach either.
  const poorProbe = await evaluate(pageClient, `(async () => {
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
      if (!name || name.length < 3) return { skip: 'the library is empty on this throwaway profile; run the gate against a channel URL so chat fills it' };

      input.focus();
      document.execCommand('insertText', false, 'hello :' + name.slice(0, 3));
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: name[2], inputType: 'insertText' }));
      await settle();
      const host = document.getElementById('kick-focus-emote-complete');
      const rows = [...(host?.shadowRoot?.querySelectorAll('[data-kf-complete-key]') || [])];
      const opened = host?.dataset.kfOpen === 'true' && rows.length > 0;
      // Read before the accepting click, which closes the list.
      const anchoredList = host?.dataset.kfAnchored === 'true';
      const topLayer = anchoredList ? host.matches(':popover-open') : null;
      const listRect = host?.getBoundingClientRect();
      const listOnScreen = Boolean(listRect) && listRect.left >= 0 && listRect.top >= 0
        && listRect.right <= innerWidth && listRect.bottom <= innerHeight;
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
        anchoredList,
        topLayer,
        listOnScreen,
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
  recordProbe('a colon and two letters offer emotes from the library, accepted by click', complete,
    complete.ok === true
      && complete.opened === true
      && complete.labels?.length > 0
      && complete.text.includes(complete.chosen)
      && !complete.text.includes(`:${String(complete.name).slice(0, 3)}`)
      && !complete.text.includes('[emote:')
      && complete.closed === true,
    complete.ok ? `":${String(complete.name).slice(0, 3)}" offered ${JSON.stringify(complete.labels)}; composer now ${JSON.stringify(complete.text)}` : complete.why);
  recordProbe('accepting a suggestion raises no key or submit event on the composer', complete,
    complete.ok === true && Array.isArray(complete.submits) && complete.submits.length === 0
      && complete.smallest >= 24,
    complete.ok ? `events on the composer ${JSON.stringify(complete.submits)}; smallest row ${Math.round(complete.smallest)}px` : complete.why);
  // R-52 again, for the other surface: on an engine with a top layer the list
  // is in it, and either way it lands wholly on screen.
  recordProbe('the completion list opens in the top layer, wholly on screen', complete,
    complete.ok === true
      && complete.listOnScreen === true
      && (complete.anchoredList === true ? complete.topLayer === true : complete.topLayer === null),
    complete.ok ? `anchored ${complete.anchoredList}, in the top layer ${complete.topLayer}, on screen ${complete.listOnScreen}` : complete.why);

  // The chip on a discovery card, and the convergence behind it. Kick's own
  // cards are on screen already, so this uses a real one; the "other tab" is a
  // BroadcastChannel opened from the page, which is exactly what a second tab
  // would be on this origin — the receiving path, the merge, and the chip
  // repaint are all the ones that ship.
  const chipProbe = await evaluate(pageClient, `(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 400));
    const before = JSON.parse(localStorage.getItem('kick-focus:multistream') || '{}');
    try {
      const chip = await __kfWait(() => document.querySelector('[data-kf-card-action="multi"]'));
      if (!chip) {
        // Say which stage produced nothing, so the next reader does not have to
        // guess between "Kick changed its cards" and "we never painted".
        const main = document.querySelector('#main-container') || document;
        const cards = [...main.querySelectorAll('[data-testid="livestream-results-card"], [data-testid="stream-card"]')];
        const withAnchor = cards.filter((card) => card.matches('a[href]') || card.querySelector('a[href]')).length;
        const withActions = cards.filter((card) => card.querySelector('[data-kf-card-actions]')).length;
        if (!cards.length) return { skip: 'Kick rendered no discovery cards on this route' };
        if (!withAnchor) return { skip: 'Kick kept discovery cards in loading-skeleton state; rendered count: ' + cards.length };
        return { ok: false, why: 'no chip after waiting: ' + cards.length + ' cards in main, ' + withAnchor + ' carrying an anchor, ' + withActions + ' carrying our action row' };
      }
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
  recordProbe('a discovery card can be collected into the grid without opening it', chipResult,
    chipResult.ok === true
      && chipResult.added?.active === 'true'
      && chipResult.added?.pressed === 'true'
      && Array.isArray(chipResult.added?.streams)
      && chipResult.added.streams.includes(chipResult.slug),
    chipResult.ok ? `chip for ${chipResult.slug} -> grid ${JSON.stringify(chipResult.added.streams)}` : chipResult.why);
  recordProbe('another tab removing a channel repaints the chip without a reload', chipResult,
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
      // Wait for the window to stop rebuilding before capturing what should
      // survive. The grid re-renders whenever its signature changes, and the
      // signature carries the column count — which is measured from layout, so
      // it legitimately changes once more after the first paint. Capturing the
      // node before that settles compares the click against a grid that was
      // already replaced for reasons that are not the click. Measured
      // 2026-08-18: a run under release-gate load reported spacer heights
      // [45533] where a settled run reports [9101], and the patch check failed.
      let stableGrid = grid;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const first = panel.querySelector('[data-kf-sticker-grid]');
        await settle();
        const second = panel.querySelector('[data-kf-sticker-grid]');
        if (first && first === second) { stableGrid = second; break; }
        stableGrid = second || stableGrid;
      }
      if (!stableGrid) return { skip: 'the organizer grid never stopped rebuilding, so there was no stable window to patch' };

      // Toggle a favorite on the first rendered tile and see what survives.
      const tile = stableGrid.querySelector('[data-kf-sticker-item]');
      if (!tile) return { skip: 'the settled window rendered no tile to favorite' };
      const key = tile.dataset.kfStickerKey;
      const before = { tile, grid: stableGrid, state: tile.dataset.kfStickerState };
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
  recordProbe('the emote organizer renders a window of a large library and keeps the rest in spacers', organizerResult,
    organizerResult.ok === true
      && organizerResult.total >= 800
      && organizerResult.rendered > 0
      && organizerResult.rendered < organizerResult.total / 2
      && organizerResult.spacers.length > 0
      && organizerResult.spacers.some((height) => height > 100),
    organizerResult.ok
      ? `${organizerResult.rendered} of ${organizerResult.total} tiles in the DOM; spacer heights ${JSON.stringify(organizerResult.spacers.map(Math.round))}`
      : organizerResult.why);
  recordProbe('favoriting an emote patches its tile in place instead of rebuilding the window', organizerResult,
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
    const shadow = await __kfWait(() => host && host.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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

  const escapeProbe = await evaluate(pageClient, `(async () => {
    const host = document.getElementById('kick-focus-root');
    const shadow = await __kfWait(() => host && host.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
    // The interaction checks intentionally raise Undo toasts. Capture the
    // resting page after those transient controls have cleared so release
    // screenshots document the product, not the test harness.
    await sleep(7500);
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
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
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
      // Wait for the countdown to be readable before letting the claim cycle
      // look at it. Reading the dialog before its note is in the tree takes the
      // "text but no countdown" branch, which schedules to the nightly reset --
      // 108 minutes on one 2026-08-18 run against 55 on another, same build.
      await __kfWait(() => (parts.dialog.textContent.includes('54 more minutes') ? true : null), { timeout: 5000 });
      await cycle();
      const notReady = { clicks, reached: parts.dialog.dataset.kfRewardDialog === 'true' || parts.trigger.dataset.kfSeen === 'true' };
      // Proof the mechanism actually ran rather than being skipped: the record
      // only exists if the claim opened Kick's dialog.
      // The schedule is the point: "Watch 54 more minutes" has to buy roughly
      // 55 minutes of quiet, not another look in ten.
      const afterNotReady = JSON.parse(localStorage.getItem('kick-focus:reward-claims') || '{}');
      notReady.attempted = Number(afterNotReady.nextCheckAt) > 0;
      notReady.waitMinutes = Math.round((Number(afterNotReady.nextCheckAt) - Date.now()) / 60000);
      // The schedule is capped at the nightly rollover, so within an hour of it
      // the countdown branch and the fallback branch produce the same number and
      // this check cannot tell them apart. Reported so a run near 20:00 skips
      // rather than passing for the wrong reason.
      const reset = new Date();
      reset.setHours(reset.getHours() >= 20 ? 44 : 20, 0, 0, 0);
      notReady.minutesToReset = Math.round((reset.getTime() - Date.now()) / 60000);
      teardown(parts);
      localStorage.removeItem('kick-focus:reward-claims');
      await settle();

      // 2. Ready: exactly one click, and the claim is recorded.
      //
      // Not a plain cycle(). The claim needs two passes — one to open Kick's
      // dialog and one to act on it — and the *open* pass arms a ten-minute
      // cooldown in storage *before* it clicks, so any apply cycle that fires
      // between phases leaves this one cooling and the click lands in phase 3
      // instead. That is what clicks=0 here and clicks=1 below was, on
      // 2026-08-18, and it is a property of the schedule rather than of a race:
      // the cooldown is read fresh from storage on every pass, so clearing it
      // on every pass makes this phase independent of what came before.
      //
      // Only while nothing has been claimed. After the claim, the record *is*
      // the thing under test and wiping it would destroy the evidence.
      clicks = 0;
      parts = mount(true);
      let readyPasses = 0;
      for (; readyPasses < 8 && clicks === 0; readyPasses += 1) {
        localStorage.removeItem('kick-focus:reward-claims');
        window.dispatchEvent(new CustomEvent('kick-focus:routechange'));
        await settle(450);
      }
      const ready = { clicks, passes: readyPasses, stored: JSON.parse(localStorage.getItem('kick-focus:reward-claims') || 'null') };
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
  // Two separate claims. That nothing was clicked is about this build's own
  // restraint and is answerable at any hour; that the *schedule* came from
  // Kick's countdown is not, because the schedule is capped at the nightly
  // rollover and within an hour of it both branches give the same answer.
  record('a reward Kick has not unlocked is never clicked',
    reward.ok === true && reward.notReady?.clicks === 0 && reward.notReady?.attempted === true,
    reward.ok ? `dialog opened=${reward.notReady?.attempted}, clicked ${reward.notReady?.clicks} times` : reward.why);
  const capped = Number(reward.notReady?.minutesToReset) <= 60;
  recordProbe('the countdown Kick shows sets the next look, not the fallback interval',
    capped
      ? { skip: `the nightly rollover is ${reward.notReady?.minutesToReset} min away, so the cap makes the countdown branch and the fallback indistinguishable` }
      : reward,
    reward.ok === true && reward.notReady?.waitMinutes >= 50 && reward.notReady?.waitMinutes <= 56,
    reward.ok ? `next look in ${reward.notReady?.waitMinutes} min, rollover in ${reward.notReady?.minutesToReset} min` : reward.why);
  record('a ready reward is claimed once and then sleeps to the nightly rollover',
    reward.ok === true && reward.ready?.clicks === 1 && Number(reward.ready?.stored?.lastClaimAt) > 0
      && reward.ready?.nextHour === 20 && reward.again?.clicks === 0,
    reward.ok ? `claimed on pass ${reward.ready?.passes} of 8: clicks=${reward.ready?.clicks}, stored claims=${reward.ready?.stored?.claims}, next check at hour ${reward.ready?.nextHour}; second pass clicked ${reward.again?.clicks}` : reward.why);
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

  // Theme tokens have to reach three separate layers: the page, this build's
  // shadow-root dialogs, and the extension popup. Source inspection proves the
  // variables exist but not that nested text resolves against the right
  // surface, so each non-default theme is measured at runtime.
  const storedPageTheme = await evaluate(pageClient, 'document.documentElement.dataset.kfTheme || "studio"');
  const originalPageTheme = ['studio', 'oled', 'slate'].includes(storedPageTheme.value)
    ? storedPageTheme.value
    : 'studio';
  for (const theme of ['oled', 'slate']) {
    const pageTheme = await evaluate(pageClient, `(async () => {
      const host = document.getElementById('kick-focus-root');
      const shadow = await __kfWait(() => host && host.shadowRoot);
      if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
      const settle = (ms = 500) => new Promise((done) => setTimeout(done, ms));
      const channels = (value) => (String(value).match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
      const luminance = (value) => channels(value)
        .map((part) => part / 255)
        .map((part) => part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4)
        .reduce((sum, part, index) => sum + part * [0.2126, 0.7152, 0.0722][index], 0);
      const contrast = (front, back) => {
        const values = [luminance(front), luminance(back)].sort((a, b) => b - a);
        return Math.round(((values[0] + 0.05) / (values[1] + 0.05)) * 100) / 100;
      };
      const measure = (textNode, surfaceNode) => {
        if (!textNode || !surfaceNode) return null;
        const textStyle = getComputedStyle(textNode);
        const surfaceStyle = getComputedStyle(surfaceNode);
        const box = surfaceNode.getBoundingClientRect();
        return {
          ratio: contrast(textStyle.color, surfaceStyle.backgroundColor),
          color: textStyle.color,
          background: surfaceStyle.backgroundColor,
          visible: box.width > 0 && box.height > 0 && box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
        };
      };
      document.dispatchEvent(new CustomEvent('kick-focus:open-settings'));
      await settle();
      shadow.querySelector('[data-page="appearance"]')?.click();
      await settle();
      // Apply the visual token directly. Clicking the setting here writes the
      // operator's profile, which makes a verification run destructive when
      // KF_USER_DATA_DIR points at a real signed-in profile.
      document.documentElement.dataset.kfTheme = '${theme}';
      await settle(700);
      const shell = shadow.querySelector('[data-kf-settings-shell]');
      const heading = shadow.querySelector('.kf-page-header h2');
      const shellMetric = measure(heading, shell);
      shadow.querySelector('[data-action="reset-page"]')?.click();
      await settle(250);
      const confirm = shadow.querySelector('.kf-confirm-card');
      const title = confirm?.querySelector('h2');
      const copy = confirm?.querySelector('p');
      const dialogTitle = measure(title, confirm);
      const dialogCopy = measure(copy, confirm);
      shadow.querySelector('[data-action="cancel-reset"]')?.click();
      // Exercise the real toast path without changing storage: submitting the
      // empty hidden-channel field is validation only.
      shadow.querySelector('[data-page="content"]')?.click();
      await settle(250);
      const invalidChannel = shadow.querySelector('[data-action="add-hidden-channel"]');
      const channelInput = shadow.querySelector('[data-kf-hidden-channel-input]');
      if (!invalidChannel || !channelInput) return { ok: false, why: 'the validation toast control is unavailable' };
      channelInput.value = '';
      invalidChannel.click();
      await settle(250);
      // Rendering and validation can coincide with a scheduled apply from an
      // earlier journey. Reassert only the transient visual token before the
      // final sample so the profile remains untouched.
      document.documentElement.dataset.kfTheme = '${theme}';
      const toast = shadow.querySelector('[data-kf-toast]');
      return {
        ok: true,
        theme: document.documentElement.dataset.kfTheme,
        shell: shellMetric,
        dialogTitle,
        dialogCopy,
        toast: measure(toast?.querySelector('.kf-toast-text'), toast),
      };
    })()`);
    await sleep(500);
    const popupTheme = await evaluate(popupClient, `(async () => {
      // This exercises the same validated appearance function render() calls
      // without writing synthetic settings into extension storage.
      applyAppearance({ appearance: { theme: '${theme}', accent: 'custom', customAccent: '#787878' } });
      const channels = (value) => (String(value).match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
      const luminance = (value) => channels(value)
        .map((part) => part / 255)
        .map((part) => part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4)
        .reduce((sum, part, index) => sum + part * [0.2126, 0.7152, 0.0722][index], 0);
      const contrast = (front, back) => {
        const values = [luminance(front), luminance(back)].sort((a, b) => b - a);
        return Math.round(((values[0] + 0.05) / (values[1] + 0.05)) * 100) / 100;
      };
      const measure = (textNode, surfaceNode) => {
        const textStyle = getComputedStyle(textNode);
        const surfaceStyle = getComputedStyle(surfaceNode);
        return contrast(textStyle.color, surfaceStyle.backgroundColor);
      };
      const title = document.getElementById('network-title');
      const card = title.closest('.card');
      const note = document.getElementById('note');
      const button = document.getElementById('open-settings');
      return {
        theme: document.documentElement.dataset.theme,
        title: measure(title, card),
        note: measure(note, document.body),
        button: measure(button, button),
      };
    })()`);
    const pageSample = pageTheme.value || {};
    const popupSample = popupTheme.value || {};
    const pageMetrics = [pageSample.shell, pageSample.dialogTitle, pageSample.dialogCopy, pageSample.toast];
    record(`${theme === 'oled' ? 'OLED' : 'Slate'} keeps settings, nested dialogs, toasts, and the popup readable`,
      pageSample.ok === true
        && pageSample.theme === theme
        && pageMetrics.every((metric) => metric?.ratio >= 4.5 && metric.visible === true)
        && popupSample.theme === theme
        && popupSample.title >= 4.5 && popupSample.note >= 4.5 && popupSample.button >= 4.5,
      pageSample.ok
        ? `page contrast ${pageMetrics.map((metric) => metric?.ratio).join('/')}; popup contrast ${popupSample.title}/${popupSample.note}/${popupSample.button} with boundary custom accent; popup theme=${popupSample.theme}`
        : pageSample.why);
  }
  await evaluate(pageClient, `(async () => {
    const shadow = document.getElementById('kick-focus-root')?.shadowRoot;
    document.documentElement.dataset.kfTheme = '${originalPageTheme}';
    shadow?.querySelector('[data-action="close-settings"]')?.click();
  })()`);
  await sleep(300);
  await evaluate(popupClient, 'render()');
  if (process.env.KF_POPUP_SCREENSHOT_PATH) {
    const popupHeight = await evaluate(popupClient, 'Math.ceil((document.getElementById("note")?.getBoundingClientRect().bottom || document.body.getBoundingClientRect().bottom) + 18)');
    await popupClient.send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: Math.max(1, Number(popupHeight.value) || 600),
      deviceScaleFactor: 1,
      mobile: false,
    });
    const capture = await popupClient.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    });
    if (capture.result?.data) {
      await writeFile(resolve(process.env.KF_POPUP_SCREENSHOT_PATH), Buffer.from(capture.result.data, 'base64'));
      record('captured the companion popup screenshot', true, process.env.KF_POPUP_SCREENSHOT_PATH);
    } else {
      record('captured the companion popup screenshot', false, 'CDP returned no image data');
    }
  }

  const popupErrors = popupClient.events
    .filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => e.params?.exceptionDetails?.text);
  record('popup raised no exceptions', popupErrors.length === 0, popupErrors.join('|') || 'clean');

  /**
   * The update notice: silent on a fresh profile, spoken after a version change.
   *
   * The silent half is the one worth asserting. This gate always runs on a
   * throwaway profile, so the notice must not fire here — a build that greets
   * every first install with "updated to X" is worse than one that says nothing,
   * and it is the easy way to get this wrong.
   */
  const updateNotice = await evaluate(pageClient, `(async () => {
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
    const toastText = () => String(shadow.querySelector('.kf-toast-text')?.textContent || '');
    const onFirstRun = toastText();

    // What the profile recorded, and what it would do if that were older.
    const stored = JSON.parse(localStorage.getItem('kick-focus:settings') || '{}');
    return {
      ok: true,
      quietOnFirstRun: !/updated to|actualiz|atualizado/i.test(onFirstRun),
      firstRunToast: onFirstRun.slice(0, 80),
      recorded: stored.lastSeenVersion || '',
    };
  })()`);
  const notice = updateNotice.value || {};
  recordProbe('a first install is not greeted as an update, and the version is recorded', notice,
    notice.ok === true
      && notice.quietOnFirstRun === true
      && /^\d+\.\d+\.\d+$/.test(String(notice.recorded || '')),
    notice.ok
      ? `recorded ${JSON.stringify(notice.recorded)}; first-run toast ${JSON.stringify(notice.firstRunToast)}`
      : notice.why);


  /**
   * Settings search, driven through the real panel.
   *
   * The interesting assertions are the ones a unit test cannot make: that the
   * index is built from what the pages actually render, that a result carries
   * you to the page the setting lives on, and that an English key still finds a
   * row while the interface is in Spanish — the property FrankerFaceZ's design
   * exists for, and the one this build would lose by indexing only its markup.
   */
  const search = await evaluate(pageClient, `(async () => {
    const shadow = await __kfWait(() => document.getElementById('kick-focus-root')?.shadowRoot);
    if (!shadow) return { ok: false, why: 'the settings shadow host never appeared' };
    const settle = () => new Promise((done) => setTimeout(done, 420));
    shadow.querySelector('[data-kf-quick]').click();
    await settle();
    const input = shadow.querySelector('input[data-kf-settings-search]');
    if (!input) return { ok: false, why: 'the settings search input is not rendered' };

    const type = async (value) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      return [...shadow.querySelectorAll('[data-kf-search-goto]')];
    };

    // A word that appears on more than one page, so a single-page filter would
    // look like it worked.
    const hits = await type('chat');
    const pages = [...new Set(hits.map((row) => row.dataset.kfSearchGoto))];
    const smallest = hits.length ? Math.min(...hits.map((row) => row.getBoundingClientRect().height)) : 0;

    const oneLetter = await type('c');
    const nonsense = await type('zzzqqq');
    const emptyShown = Boolean(shadow.querySelector('.kf-search-empty'));

    // An English key while the interface is in Spanish.
    await type('');
    // The language control lives on the Appearance page, so get there first —
    // clearing the query returns to whichever page was current, not to it.
    shadow.querySelector('[data-page="appearance"]')?.click();
    await settle();
    const select = shadow.querySelector('[data-set="appearance.language"]');
    let bilingual = -1;
    if (select) {
      select.value = 'es';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      bilingual = (await type('theme')).length;
      select.value = 'auto';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    }

    // A result navigates to the page that setting lives on, and clears itself.
    await type('chat');
    const target = shadow.querySelector('[data-kf-search-goto]');
    const wanted = target?.dataset.kfSearchGoto || '';
    target?.click();
    await settle();
    const landedOn = shadow.querySelector('[data-kf-page]')?.dataset.kfCurrentPage || '';
    const inputCleared = shadow.querySelector('input[data-kf-settings-search]')?.value === '';
    shadow.querySelector('[data-action="close-settings"]')?.click();

    return {
      ok: true,
      matches: hits.length,
      pages: pages.length,
      smallest,
      oneLetter: oneLetter.length,
      nonsense: nonsense.length,
      emptyShown,
      bilingual,
      wanted,
      landedOn,
      inputCleared,
    };
  })()`);
  const found = search.value || {};
  recordProbe('settings search spans every page, and a result goes where the setting lives', found,
    found.ok === true
      && found.matches > 1 && found.pages > 1
      && found.smallest >= 24
      && found.oneLetter === 0 && found.nonsense === 0 && found.emptyShown === true
      && found.bilingual > 0
      && Boolean(found.wanted) && found.landedOn === found.wanted && found.inputCleared === true,
    found.ok
      ? `"chat" matched ${found.matches} rows across ${found.pages} pages (smallest ${Math.round(found.smallest)}px); one letter ${found.oneLetter}, nonsense ${found.nonsense} with an empty state; an English key in Spanish matched ${found.bilingual}; a result went to ${found.landedOn} and cleared the box`
      : found.why);


  /**
   * Do the endpoints this build reads still exist?
   *
   * The drift gate covers Kick's DOM and says nothing about its API, and Kick
   * removes endpoints without notice — it deleted `/api/v1/video/:livestream_id`
   * outright in July 2026, which broke a competitor's VOD pages on the spot. A
   * gone endpoint currently degrades quietly into a diagnostics counter nobody
   * reads.
   *
   * Read from the page so each request carries the session and origin the mod's
   * own reads do. 404 and 410 fail: that is Kick saying the route no longer
   * exists. 401, 403 and 429 are reported and not failed — this gate runs logged
   * out and Kick rate-limits it, which is why the uptime chip has a page-data
   * fallback in the first place.
   */
  const PROBED_ENDPOINTS = ['channel', 'emoteSets', 'chatSettings', 'collectibles', 'currentViewers', 'channelVideos'];
  // Excluded on purpose, with the reason, so the coverage check below stays honest.
  const UNPROBED_ENDPOINTS = {
    followChannel: 'a write; probing it would follow a channel on the operator behalf',
    chatHistory: 'needs a chatroom id this gate does not always have',
    realtimeChat: 'the realtime broker; exercised by the socket path instead',
    channelMe: 'answers only for a signed-in session, and this gate runs logged out',
  };
  const liveness = await evaluate(pageClient, `(async () => {
    const slug = 'xqc';
    let channelId = 0;
    let channelStatus = 0;
    try {
      const response = await fetch('https://kick.com/api/v2/channels/' + slug, { credentials: 'include', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      channelStatus = response.status;
      if (response.ok) {
        const body = await response.json();
        channelId = body?.id || 0;
      }
    } catch { channelStatus = 'network'; }
    const urls = [
      ['channel', 'https://kick.com/api/v2/channels/' + slug],
      ['emoteSets', 'https://kick.com/emotes/' + slug],
      ['collectibles', 'https://web.kick.com/api/v1/gamification/collectibles'],
    ];
    if (channelId) {
      urls.push(['chatSettings', 'https://web.kick.com/api/v1/channels/' + channelId + '/chat/settings']);
      urls.push(['currentViewers', 'https://kick.com/current-viewers?ids[]=' + channelId]);
      urls.push(['channelVideos', 'https://web.kick.com/api/v1/channels/' + channelId + '/videos']);
    }
    const seen = [];
    for (const [name, url] of urls) {
      try {
        const response = await fetch(url, { credentials: 'include', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
        seen.push({ name, status: response.status });
      } catch { seen.push({ name, status: 'network' }); }
    }
    return JSON.stringify({ channelStatus, channelId, seen });
  })()`);
  const endpointState = JSON.parse(liveness.value || '{}');
  const seenEndpoints = endpointState.seen || [];
  const goneEndpoints = seenEndpoints.filter((entry) => entry.status === 404 || entry.status === 410);
  const gatedEndpoints = seenEndpoints.filter((entry) => [401, 403, 429].includes(entry.status));
  if (!seenEndpoints.length) {
    skip('every endpoint this build reads still answers',
      `Kick answered ${endpointState.channelStatus} to the channel read, so no endpoint could be probed; re-run when the tab is not rate-limited`);
  } else {
    record('every endpoint this build reads still answers',
      goneEndpoints.length === 0,
      goneEndpoints.length
        ? `gone: ${goneEndpoints.map((entry) => `${entry.name}=${entry.status}`).join(', ')}`
        : `${seenEndpoints.map((entry) => `${entry.name}=${entry.status}`).join(' ')}${gatedEndpoints.length ? ` | auth or rate-limited, not a failure: ${gatedEndpoints.map((entry) => entry.name).join(', ')}` : ''}`);
  }

  // Derived from the module that owns the endpoints, not hand-listed beside it:
  // a second list would rot silently, which is the same reason the drift probes
  // read LOCATOR_PROBES rather than a copy.
  const apiSource = await readFile(resolve('src/api.mjs'), 'utf8');
  const declaredEndpoints = [...apiSource.matchAll(/^ {2}(\w+): \(/gm)].map((match) => match[1]);
  const unaccounted = declaredEndpoints.filter((name) => !PROBED_ENDPOINTS.includes(name) && !(name in UNPROBED_ENDPOINTS));
  record('the endpoint liveness list still accounts for everything api.mjs declares',
    declaredEndpoints.length > 0 && unaccounted.length === 0,
    unaccounted.length
      ? `api.mjs declares ${unaccounted.join(', ')} with neither a probe nor a stated reason`
      : `${PROBED_ENDPOINTS.length} probed, ${Object.keys(UNPROBED_ENDPOINTS).length} excluded with reasons, ${declaredEndpoints.length} declared`);


  popupClient.close();
  swClient.close();
  pageClient.close();

  console.log(`\nExtension id: ${extensionId}`);
  const failures = results.filter((r) => r.outcome === 'fail');
  const skipped = results.filter((r) => r.outcome === 'skip');
  const asserted = results.filter((r) => r.outcome !== 'skip');
  // Skips are counted apart from the total on purpose: folding them into the
  // numerator would let a run that asserted nothing report a perfect score.
  console.log(`\n${asserted.length - failures.length}/${asserted.length} checks passed${skipped.length ? `, ${skipped.length} skipped` : ''}.`);
  if (skipped.length) console.log(`Skipped: ${skipped.map((s) => s.label).join('; ')}`);
  if (failures.length) {
    console.log(`Failed: ${failures.map((f) => f.label).join('; ')}`);
    process.exitCode = 1;
  }
  // Written so the release gate can compare the README's advertised figure
  // against the run that actually happened. A number no gate owns drifts: the
  // README claimed 51/51 for two days after the gate had grown past it.
  if (process.env.KF_SUMMARY_PATH) {
    await writeFile(process.env.KF_SUMMARY_PATH, JSON.stringify({
      passed: asserted.length - failures.length,
      asserted: asserted.length,
      skipped: skipped.length,
      // Labels and outcomes only, so the release checklist can report which
      // signed-in journeys this run actually asserted. No detail strings: those
      // carry counts and route text, and this file is written to a directory an
      // operator may well share.
      results: results.map((entry) => ({ label: entry.label, outcome: entry.outcome })),
    }), 'utf8');
  }
} catch (error) {
  console.error('VERIFY ERROR:', error.message);
  console.error(stderr.split('\n').filter((l) => /extension|ERROR|WARN/i.test(l)).slice(0, 12).join('\n'));
  process.exitCode = 1;
} finally {
  child.kill('SIGKILL');
  await sleep(600);
  if (!ownedProfile) await rm(profile, { recursive: true, force: true }).catch(() => {});
}
