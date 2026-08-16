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
    esc.ok ? 'prompt closed, settings survived, second Escape closed settings' : esc.why);

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
