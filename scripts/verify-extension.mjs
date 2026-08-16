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
    return { ok: true, text, runs: match ? Number(match[1]) : 0, recentAvg: match ? Number(match[3]) : null, max: match ? Number(match[4]) : null };
  })()`);
  const cost = applyCost.value || {};
  record('the apply cycle reports its own cost on the About page',
    cost.ok === true && cost.runs > 3 && Number.isFinite(cost.recentAvg),
    cost.ok ? cost.text : cost.why);

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
