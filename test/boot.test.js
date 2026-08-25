import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import vm from 'node:vm';
import { HIDEABLE_ELEMENTS, STICKER_GROUP_LIMIT, colorContrastRatio } from '../src/core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A stub DOM node that answers every method the boot path calls. It never
 * models real layout — it only has to let the concatenated bundle evaluate its
 * module-level declarations and run its bootstrap without throwing, so a
 * temporal-dead-zone read or a bad const ordering across the four-module concat
 * surfaces here instead of only in the live browser harness.
 */
function fakeNode() {
  const node = {
    nodeType: 1,
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    hidden: false,
    textContent: '',
    innerHTML: '',
    value: '',
    children: [],
    parentElement: null,
    nextElementSibling: null,
    isConnected: false,
    setAttribute() {},
    getAttribute: () => null,
    removeAttribute() {},
    hasAttribute: () => false,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    append() {},
    prepend() {},
    appendChild: (child) => child,
    insertBefore: (child) => child,
    replaceChildren() {},
    remove() {},
    closest: () => null,
    matches: () => false,
    contains: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
    attachShadow: () => fakeNode(),
    focus() {},
    blur() {},
    click() {},
    cloneNode: () => fakeNode(),
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    scrollIntoView() {},
  };
  return node;
}

function makeBootEnvironment(extras = {}) {
  const documentElement = fakeNode();
  const created = [];
  const document = {
    __created: created,
    documentElement,
    head: fakeNode(),
    // Null body sends startWhenBodyExists down its observe-and-wait path, so the
    // bundle bootstraps without needing the entire settings UI stubbed, while
    // still evaluating every module-level declaration and the state init.
    body: null,
    readyState: 'complete',
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    createElement: (tag) => { created.push(String(tag).toLowerCase()); return fakeNode(); },
    createElementNS: () => fakeNode(),
    createTextNode: () => fakeNode(),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    activeElement: null,
  };

  class StubObserver {
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
    unobserve() {}
  }

  class CustomEventStub {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  const storage = () => {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key),
      clear: () => map.clear(),
    };
  };

  const timers = new Set();
  const context = {
    console,
    JSON,
    Math,
    Date,
    URL,
    URLSearchParams,
    Promise,
    Set,
    Map,
    WeakMap,
    Array,
    Object,
    RegExp,
    Intl,
    TextEncoder,
    TextDecoder,
    // Timers exist but never fire: a scheduled apply or reconnect must not run
    // real work against these stubs during the test.
    setTimeout: (fn) => { const id = Symbol('t'); timers.add(id); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    setInterval: () => Symbol('i'),
    clearInterval: () => {},
    requestAnimationFrame: () => Symbol('raf'),
    cancelAnimationFrame: () => {},
    queueMicrotask: () => {},
    MutationObserver: StubObserver,
    IntersectionObserver: StubObserver,
    ResizeObserver: StubObserver,
    CustomEvent: CustomEventStub,
    Event: CustomEventStub,
    Image: class { set src(_v) {} },
    fetch: () => Promise.resolve({ ok: false, status: 0, json: async () => ({}), text: async () => '' }),
    localStorage: storage(),
    sessionStorage: storage(),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    navigator: { userAgent: 'node', language: 'en', languages: ['en'], clipboard: { writeText: async () => {} } },
    history: { replaceState() {}, pushState() {}, state: null },
    location: { href: 'https://kick.com/', pathname: '/', search: '', hash: '', origin: 'https://kick.com', hostname: 'kick.com' },
    CSS: { escape: (value) => String(value) },
    document,
  };
  Object.assign(context, extras);
  const dispatched = [];
  const win = {
    ...context,
    __dispatched: dispatched,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: (event) => { dispatched.push(event?.type); return true; },
    document,
  };
  context.window = win;
  context.self = win;
  context.globalThis = context;
  return context;
}

test('the built bundle boots in a stubbed environment without a TDZ or bad const order', { tag: 'artifact' }, async () => {
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  const context = makeBootEnvironment();
  vm.runInNewContext(bundle, context);
  assert.equal(context.window.__kickFocusBooted, true);
});

test('the built bundle resolves every embedded visual asset', { tag: 'artifact' }, async () => {
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  assert.equal(bundle.includes('__KICK_FOCUS_ICON__'), false, 'icon placeholder survived the build');
  assert.equal(bundle.includes('__KICK_FOCUS_PREVIEW__'), false, 'preview placeholder survived the build');
});

test('the bundle knows its own size, and the number is the file', { tag: 'artifact' }, async () => {
  // About shows this against the 1 MB injection ceiling, so a stale or
  // approximate number is worse than none: it would read as a measurement.
  // The build pads the stamp to the placeholder's exact width for this reason —
  // stamping a number changes the file, unless it cannot.
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  assert.equal(bundle.includes('__KICK_FOCUS_BYTES__'), false, 'byte placeholder survived the build');
  const stamped = bundle.match(/Number\('(\s*\d+)'\)/);
  assert.ok(stamped, 'the bundle carries no byte stamp at all');
  const bytes = Buffer.byteLength(bundle, 'utf8');
  assert.equal(Number(stamped[1]), bytes,
    `the bundle says it is ${Number(stamped[1])} bytes and it is ${bytes}`);
  // And it is still inside the ceiling it is displayed against.
  assert.ok(bytes < 1000000, `the userscript is ${bytes} B, past its injection ceiling`);
});

test('with the Navigation API, route changes come from the browser and history is left untouched', { tag: 'artifact' }, async () => {
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  const listeners = {};
  const navigation = { addEventListener(type, handler) { listeners[type] = handler; } };
  const context = makeBootEnvironment({ navigation });
  const originalPush = context.history.pushState;
  const originalReplace = context.history.replaceState;
  vm.runInNewContext(bundle, context);

  assert.equal(context.window.__kickFocusBooted, true);
  assert.equal(typeof listeners.currententrychange, 'function', 'listens for currententrychange');
  // The whole point: no wrapper around history when the browser reports
  // navigation itself, so nothing of this build shows in pushState.toString().
  assert.equal(context.history.pushState, originalPush, 'pushState is not wrapped');
  assert.equal(context.history.replaceState, originalReplace, 'replaceState is not wrapped');
  // And the browser's event does reach the route pipeline.
  listeners.currententrychange();
  assert.ok(context.window.__dispatched.includes('kick-focus:routechange'), 'currententrychange raises the route event');
});

test('without the Navigation API the history wrapper is the fallback and still fires', { tag: 'artifact' }, async () => {
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  const context = makeBootEnvironment();
  assert.equal(context.navigation, undefined);
  const originalPush = context.history.pushState;
  vm.runInNewContext(bundle, context);
  assert.notEqual(context.history.pushState, originalPush, 'pushState is wrapped as the fallback');
  context.history.pushState(null, '', '/somewhere');
  assert.ok(context.window.__dispatched.includes('kick-focus:routechange'), 'the wrapper raises the route event');
});

test('with constructable stylesheets the site CSS is adopted once and no <style> element is made', { tag: 'artifact' }, async () => {
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  const constructed = [];
  class FakeSheet {
    replaceSync(text) { this.text = String(text); constructed.push(this); }
  }
  const context = makeBootEnvironment({ CSSStyleSheet: FakeSheet });
  context.document.adoptedStyleSheets = [];
  vm.runInNewContext(bundle, context);

  assert.equal(context.window.__kickFocusBooted, true);
  assert.equal(constructed.length, 1, 'the site sheet is parsed exactly once');
  assert.ok(constructed[0].text.length > 10_000, 'the adopted sheet carries the full site CSS');
  // Spread first: the bundle assigns a vm-realm array, whose prototype is not
  // this realm's Array.prototype, and strict deepEqual compares prototypes.
  assert.deepEqual([...context.document.adoptedStyleSheets], constructed, 'the constructed sheet is adopted by the document');
  assert.equal(context.document.__created.filter((tag) => tag === 'style').length, 0,
    'no <style> element is created when the sheet can be adopted');
});

test('without constructable stylesheets the site CSS falls back to a <style> element', { tag: 'artifact' }, async () => {
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  const context = makeBootEnvironment();
  assert.equal(context.CSSStyleSheet, undefined);
  vm.runInNewContext(bundle, context);
  assert.equal(context.window.__kickFocusBooted, true);
  assert.equal(context.document.__created.filter((tag) => tag === 'style').length, 1,
    'exactly one fallback <style> element for the site CSS');
});

test('under enforced Trusted Types the bundle takes its own policy, never the default', { tag: 'artifact' }, async () => {
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  const created = [];
  // A strict environment: policies are handed out by name, and creating one
  // called 'default' would vouch for every other script on the page — Kick's
  // included — which this build must never do.
  const trustedTypes = {
    createPolicy(name, rules) {
      created.push(name);
      if (name === 'default') throw new Error('the default policy must not be claimed');
      return { createHTML: (value) => ({ trusted: true, value: rules.createHTML(value) }) };
    },
  };
  const context = makeBootEnvironment({ trustedTypes });
  vm.runInNewContext(bundle, context);

  assert.equal(context.window.__kickFocusBooted, true, 'enforcement must not stop the build from booting');
  assert.deepEqual(created, ['kick-focus'], 'exactly one policy, under this build’s own name');
});

test('a page without Trusted Types boots without reaching for the API', { tag: 'artifact' }, async () => {
  // Feature-detected, never version-sniffed: today kick.com ships no CSP at
  // all, so the absent case is the one that actually runs.
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  const context = makeBootEnvironment();
  assert.equal(context.trustedTypes, undefined);
  vm.runInNewContext(bundle, context);
  assert.equal(context.window.__kickFocusBooted, true);
});

test('the adopted sheet carries one hide rule per catalog entry', { tag: 'artifact' }, async () => {
  // The rules are generated at runtime from HIDEABLE_ELEMENTS, so the bundle
  // source only holds the generator — grepping it proves nothing. This runs it
  // and reads the stylesheet that actually reached the document, which is the
  // only place a catalog entry with a switch and no CSS behind it shows up.
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  const constructed = [];
  class FakeSheet {
    replaceSync(text) { this.text = String(text); constructed.push(this); }
  }
  const context = makeBootEnvironment({ CSSStyleSheet: FakeSheet });
  context.document.adoptedStyleSheets = [];
  vm.runInNewContext(bundle, context);

  const css = constructed[0].text;
  const rules = [...css.matchAll(/html\[data-kf-hidden~="([a-z0-9-]+)"\] \[data-kf-element="([a-z0-9-]+)"\]/g)];
  assert.deepEqual(
    rules.map((match) => match[1]),
    HIDEABLE_ELEMENTS.map((entry) => entry.id),
    'every hideable element needs its own rule, in catalog order',
  );
  for (const [, hiddenId, elementId] of rules) {
    assert.equal(hiddenId, elementId, 'the root token and the element tag must be the same id or the rule matches nothing');
  }

  // Red probe: the assertion above must still be able to fail. Drop one rule
  // from a copy of the same stylesheet and confirm the comparison notices —
  // otherwise a regex that stopped matching would report perfect coverage.
  const withoutOne = css.replace(rules[0][0], 'html[data-kf-nothing]');
  const remaining = [...withoutOne.matchAll(/html\[data-kf-hidden~="([a-z0-9-]+)"\]/g)].map((match) => match[1]);
  assert.notDeepEqual(remaining, HIDEABLE_ELEMENTS.map((entry) => entry.id), 'the gate cannot detect a missing rule');
});

test('a mis-ordered const in the bundle is caught by the boot gate (red test)', { tag: 'artifact' }, async () => {
  const bundle = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  // Inject a temporal-dead-zone read right after the boot guard: a const is read
  // before its declaration. A correct bundle never does this; this proves the
  // boot gate above would fail loudly if a future edit introduced one.
  const marker = 'window.__kickFocusBooted = true;';
  assert.ok(bundle.includes(marker), 'boot guard marker not found in bundle');
  const broken = bundle.replace(marker, `${marker}\nvoid KF_TDZ_PROBE;\nconst KF_TDZ_PROBE = 1;`);
  const context = makeBootEnvironment();
  assert.throws(() => vm.runInNewContext(broken, context), /KF_TDZ_PROBE|before initialization/);
});

test('the high-contrast control setting raises every border it promises to raise', { tag: 'artifact' }, async () => {
  // The setting says "Increase separation for controls, borders, and surfaces".
  // It used to share one attribute with the text-contrast setting and style
  // nothing but a text-shadow, so the promise was unmet and the two toggles
  // were not independent. Every control edge in this build resolves through
  // --kf-border or --kf-border-strong, so raising those two per theme is what
  // makes the words true. WCAG 1.4.11 asks 3:1 of a control boundary.
  const source = await readFile(resolve(root, 'src/runtime.js'), 'utf8');

  // The two settings must not collapse back into one attribute.
  assert.match(source, /root\.dataset\.kfContrast = String\(appearance\.strongContrast\);/);
  assert.match(source, /root\.dataset\.kfControlContrast = String\(accessibility\.highContrast\);/);

  const readPair = (selector) => {
    const at = source.indexOf(selector);
    assert.notEqual(at, -1, `missing rule for ${selector}`);
    const block = source.slice(at, source.indexOf('}', at));
    const border = /--kf-border:\s*(#[0-9a-f]{6})/i.exec(block);
    const strong = /--kf-border-strong:\s*(#[0-9a-f]{6})/i.exec(block);
    assert.ok(border && strong, `${selector} must raise both border tokens`);
    return { border: border[1], strong: strong[1] };
  };

  // Surfaces a control edge is drawn against, per theme.
  const THEMES = [
    ['html[data-kf-control-contrast="true"] {', ['#171e19', '#080b09', '#0b100d']],
    ['html[data-kf-control-contrast="true"][data-kf-theme="oled"] {', ['#0a0c0d', '#000000', '#030404']],
    ['html[data-kf-control-contrast="true"][data-kf-theme="slate"] {', ['#1c2934', '#0f161d']],
  ];
  for (const [selector, surfaces] of THEMES) {
    const tokens = readPair(selector);
    for (const surface of surfaces) {
      for (const edge of [tokens.border, tokens.strong]) {
        const ratio = colorContrastRatio(edge.toUpperCase(), surface.toUpperCase());
        assert.ok(ratio >= 3,
          `${selector} ${edge} on ${surface} is ${ratio.toFixed(2)}:1, under the 3:1 a control boundary needs`);
      }
    }
  }
});

test('every preset accent is readable as text on every theme surface', { tag: 'artifact' }, async () => {
  // The four preset accents were never contrast-checked; only a custom accent
  // was. --kf-accent is used as text at 11px and 14px (the toast action and the
  // merged-chat channel label), and violet measured 4.01:1 on Slate's raised
  // surfaces, under the 4.5:1 AA asks of small text. The shipped "chat" viewing
  // preset is slate plus violet, so that is a pairing people land on.
  const source = await readFile(resolve(root, 'src/runtime.js'), 'utf8');

  const accentFor = (theme, accent) => {
    const scoped = new RegExp(
      String.raw`html\[data-kf-theme="${theme}"\]\[data-kf-accent="${accent}"\][^{]*\{[^}]*--kf-accent:\s*(#[0-9a-f]{6})`, 'i');
    const plain = new RegExp(
      String.raw`html\[data-kf-accent="${accent}"\][^{]*\{[^}]*--kf-accent:\s*(#[0-9a-f]{6})`, 'i');
    return (scoped.exec(source) || plain.exec(source))?.[1];
  };

  // The lightest surface --kf-accent is drawn on as text, per theme.
  const SURFACES = { studio: '#18201B', oled: '#0E1110', slate: '#263544' };
  for (const [theme, surface] of Object.entries(SURFACES)) {
    for (const accent of ['cyan', 'violet', 'gold']) {
      const hex = accentFor(theme, accent);
      assert.ok(hex, `no --kf-accent found for ${accent} on ${theme}`);
      const ratio = colorContrastRatio(hex.toUpperCase(), surface);
      assert.ok(ratio >= 4.5,
        `${accent} on ${theme} is ${ratio.toFixed(2)}:1 against ${surface}, under the 4.5:1 small text needs`);
    }
  }
});

test('interface scale reaches the whole settings surface, not just its font size', { tag: 'artifact' }, async () => {
  // The setting says "Set the size of Kick Focus controls". It used to be read
  // in one declaration, the root font-size, while the surface carried about 120
  // absolute font sizes and a ladder of fixed control heights, so no control
  // ever changed size. zoom scales the used value of everything inside.
  const source = await readFile(resolve(root, 'src/runtime.js'), 'utf8');

  // EVERY .kf-settings block, not only the first. The responsive overrides are
  // where this went wrong: they restate width and height in viewport units, a
  // media query still evaluates against the real viewport, and zoom multiplies
  // whatever they resolve to. An earlier version of this gate read one block
  // and stayed green while the 110% dialog hung 68px off the right edge.
  const blocks = [...source.matchAll(/\.kf-settings\s*\{([^}]*)\}/g)].map((match) => match[1]);
  assert.ok(blocks.length >= 3, `expected the base rule and its overrides, found ${blocks.length}`);

  assert.match(blocks[0], /zoom:\s*var\(--kf-interface-scale, 1\);/,
    'the settings surface must scale with zoom');
  assert.doesNotMatch(blocks[0], /font-size:\s*calc\([^)]*--kf-interface-scale/,
    'scaling the root font size as well as zooming would apply the scale twice');

  // Any length that decides how much room the dialog takes has to be divided
  // by the scale, in every block that sets one.
  const SCALED = ['width', 'height', 'min-width', 'min-height'];
  for (const [index, block] of blocks.entries()) {
    for (const property of SCALED) {
      const declaration = new RegExp(String.raw`(?:^|[;{\s])${property}:\s*([^;]+)`).exec(block);
      if (!declaration) continue;
      const value = declaration[1];
      // A floor of zero, or a value in no unit that grows, needs no division.
      if (/^\s*(0|auto|none)\s*$/.test(value)) continue;
      assert.match(value, /\/ var\(--kf-interface-scale, 1\)/,
        `block ${index}: ${property} is "${value.trim()}", which zoom will multiply without dividing it first`);
    }
  }

  // The scale still has to be written somewhere for any of this to run.
  assert.match(source, /setProperty\('--kf-interface-scale', String\(appearance\.interfaceScale \/ 100\)\)/);
});

test('one focus treatment, defined once and used everywhere', { tag: 'artifact' }, async () => {
  // There were five: 3px accent in the settings panel, 2px accent on the nav
  // search and the injected page, 2px plain text on a toast action, and on
  // every text input an outline of 0 with a box-shadow instead. That last one
  // out-specified the global rule, so no text input in the panel ever showed a
  // ring at all.
  const source = await readFile(resolve(root, 'src/runtime.js'), 'utf8');

  assert.match(source, /--kf-focus-ring:\s*3px solid var\(--kf-accent\);/,
    'the focus ring must be defined once on the page root');

  // Windows High Contrast is the one place that must not use the token: it
  // suppresses box-shadow and needs the system Highlight colour instead.
  const literalRings = source.split('\n')
    .map((line, index) => [index + 1, line])
    .filter(([, line]) => /outline:\s*\d+px\s+solid/.test(line))
    // Two exceptions, both deliberate: Windows High Contrast needs the system
    // Highlight colour because it suppresses box-shadow, and the chat emote
    // save affordance holds a transparent outline so its colour can transition
    // in rather than the ring popping into existence.
    .filter(([, line]) => !line.includes('Highlight') && !line.includes('transparent'));
  assert.deepEqual(literalRings.map(([n]) => n), [],
    `focus rings still written as a literal at line(s) ${literalRings.map(([n, l]) => `${n}: ${l.trim()}`).join(' | ')}`);

  // And no rule may take the outline away on focus and leave only a shadow.
  // `.kf-page` is the one exception: it is tabindex="-1" and is focused only
  // by script, to move a screen reader onto the page a reader just navigated
  // to, so it is never tabbed to and a ring around the whole scroll region
  // would be noise rather than feedback.
  const suppressed = source.split('\n')
    .filter((line) => /:focus[^{]*\{[^}]*outline:\s*0/.test(line))
    .filter((line) => !line.includes('.kf-page:focus'));
  assert.deepEqual(suppressed, [],
    `a focus rule still removes its outline: ${suppressed.map((l) => l.trim()).join(' | ')}`);
});

test('the emote shelf is styled by the sheet that can actually reach it', { tag: 'artifact' }, async () => {
  // The shelf is built into Kick's own emote picker, in the light DOM, so
  // SITE_CSS is the only stylesheet that reaches it: UI_CSS is adopted into a
  // shadow root. Two rules had drifted onto the wrong side of that line. The
  // channel-scoped favorite marker sat in UI_CSS and could never match, and
  // the tile itself was emitted with a class while SITE_CSS keys it on an
  // attribute, so the send button had no styling at all.
  const source = await readFile(resolve(root, 'src/runtime.js'), 'utf8');
  const siteStart = source.indexOf('const SITE_CSS = `');
  const uiStart = source.indexOf('const UI_CSS = `');
  assert.ok(siteStart > 0 && uiStart > siteStart, 'stylesheet boundaries not found');
  const site = source.slice(siteStart, source.indexOf('\n`;', siteStart));
  const ui = source.slice(uiStart, source.indexOf('\n`;', uiStart));

  assert.match(site, /\[data-kf-sticker-scoped="true"\]/,
    'the scoped-favorite marker must live in the sheet injected into the page');
  assert.doesNotMatch(ui, /data-kf-sticker-scoped/,
    'a shadow-root sheet cannot style a tile in Kick own panel');

  const organizerStart = site.indexOf('[data-kf-sticker-organizer]');
  const beforeOrganizer = site.slice(0, organizerStart);
  const cssDepth = (beforeOrganizer.match(/\{/g) || []).length - (beforeOrganizer.match(/\}/g) || []).length;
  assert.equal(cssDepth, 0,
    'composer emote styles must not be trapped inside the desktop-only media query');
  assert.match(site, /@media \(max-width: 1023px\)[\s\S]*\[data-kf-sticker-batch\] \{ grid-template-columns: 1fr/,
    'the composer batch actions must stack when the chat rail is narrow');
  assert.match(site, /\[data-kf-sticker-grid\][\s\S]*overflow-x: hidden !important/,
    'the compact emote grid must never expose a horizontal scrollbar');
  assert.match(site, /\[data-kf-sticker-scroll\][^}]*overflow-x: hidden !important/,
    'Kick own scroll shell must not expose a horizontal scrollbar around the organizer');

  // The tile markup and the rule that styles it must agree on the selector.
  assert.match(source, /<button type="button" data-kf-sticker-action="send"[^>]*data-kf-sticker-proxy/,
    'the shelf send button must carry the attribute SITE_CSS styles');
  assert.doesNotMatch(source, /class="kf-sticker-proxy"/,
    'nothing styles that class; the attribute is what SITE_CSS keys on');
});

test('emote organization has a direct route, visible search, and batch controls', { tag: 'artifact' }, async () => {
  const runtime = await readFile(resolve(root, 'src/runtime.js'), 'utf8');
  const settings = await readFile(resolve(root, 'src/settings.mjs'), 'utf8');

  assert.match(settings, /\['emotes', 'Emotes', 'Library, favorites, and groups'/,
    'the library needs a first-class settings destination');
  assert.match(runtime, /openSettings\('emotes'\)/,
    'the picker Manage action must land on the library itself');
  assert.match(runtime, /function stickerOrganizerAnchor/,
    'the custom shelf must mount after Kick full search row, not inside its input wrapper');
  assert.match(runtime, /organizerAnchor\.after\(organizer\)/,
    'the custom shelf must keep Kick own search visible above it');
  for (const control of ['data-kf-sticker-organize', 'data-kf-sticker-group-create', 'data-kf-sticker-batch-move', 'data-kf-sticker-batch-remove']) {
    assert.ok(runtime.includes(control), `${control} is missing from the composer picker`);
  }
  for (const flow of ['savePickerStickerGroup', 'deletePickerStickerGroup', 'editPickerStickerSelection']) {
    assert.ok(runtime.includes(`function ${flow}`), `${flow} is missing from the composer picker`);
  }
  assert.match(runtime, /Try a different search or clear the search field\./,
    'searching an empty group must explain how to recover');
  assert.match(runtime, /const signature = \[\s*activeLocale\(\),\s*view,/,
    'changing the interface language must invalidate the composer chrome');
  for (const action of ['select-library-sticker', 'select-visible-stickers', 'move-selected-stickers', 'remove-selected-stickers']) {
    assert.ok(settings.includes(`data-action="${action}"`), `${action} is missing from the library`);
  }
  assert.match(settings, /aria-live="polite"/,
    'batch selection status must be announced');
  assert.match(runtime, /input\[data-kf-sticker-group-name\]/,
    'group renames must save when the field changes');
  // Reads the constant rather than spelling the number: the literal used to
  // appear six times, including inside the toast that reports it and inside
  // that toast's two translations.
  assert.equal(STICKER_GROUP_LIMIT, 40, 'the shipped group limit moved without this test noticing');
  assert.match(runtime, /groups\.length >= STICKER_GROUP_LIMIT/,
    'the UI must stop cleanly at the stored group limit');
  assert.ok(!/groups\.length >= 40/.test(runtime), 'a bare 40 is back beside the named limit');
  assert.match(runtime, /renameStickerGroup\(event\.target\)/,
    'Enter must commit a group rename directly');
});

test('an emote observed in the page is cleaned before it can become an href', { tag: 'artifact' }, async () => {
  const runtime = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  // The library card renders sticker.src as an href and escapeHtml does not stop
  // a scheme, so the persist-time cleaner has to run at the moment the value is
  // read out of Kick's DOM, not only on the way to storage.
  const info = runtime.slice(runtime.indexOf('function stickerImageInfo'), runtime.indexOf('function stickerButtonInfo'));
  assert.ok(info.length > 200, 'stickerImageInfo was not found in the artifact');
  assert.match(info, /const src = cleanStickerAssetUrl\(rawSrc\)/,
    'stickerImageInfo stores the raw DOM value rather than a cleaned URL');
  assert.match(info, /if \(!src\) return null/, 'a rejected URL must drop the observation, not record an empty one');
});

test('the chat emote harvest queue is capped at its only push site', { tag: 'artifact' }, async () => {
  const runtime = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  // A stalled key never reaches the negative set, so every later sighting
  // re-queues it. The cap is the backstop, and it lives inside a closure with
  // no seam a unit test can reach, so this pins the push site instead: one
  // push, guarded by the named constant. Nothing is lost when it trips, because
  // a dropped observation is re-buffered the next time that emote is sent.
  const pushes = [...runtime.matchAll(/chatEmoteHarvest\.queue\.push\(/g)].length;
  assert.equal(pushes, 1, `the harvest queue has ${pushes} push sites; the cap guards one`);
  assert.match(runtime, /chatEmoteHarvest\.queue\.length < HARVEST_QUEUE_CAP\)?\s*\{?\s*chatEmoteHarvest\.queue\.push\(/,
    'the harvest queue push is not guarded by HARVEST_QUEUE_CAP');
  assert.match(runtime, /HARVEST_QUEUE_CAP = \d+/, 'HARVEST_QUEUE_CAP is not a named constant');
});

test('the memoised playback owner is invalidated everywhere it can go stale', { tag: 'artifact' }, async () => {
  const runtime = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  // Measuring the owner walks every video ancestor through getComputedStyle, and
  // four callers ask for it inside one apply cycle, so the answer is cached for
  // the length of a cycle. Every path that can outlive that cycle has to clear
  // it, or the watch clock keeps counting against a video that is gone.
  const invalidations = [...runtime.matchAll(/invalidateSessionWatchOwner\(\)/g)].length;
  assert.ok(invalidations >= 4,
    `only ${invalidations} references to invalidateSessionWatchOwner; the cycle start, the yield, the timer tick and the declaration are all required`);
  // The one-second watch tick is not an apply cycle and must clear it itself.
  assert.match(runtime, /invalidateSessionWatchOwner\(\);\s*syncSessionWatchTime\(\);/,
    'the watch timer tick does not invalidate the owner before reading it');
});

test('the emote hover card is described to a screen reader, not hidden from one', { tag: 'artifact' }, async () => {
  // The host carried aria-hidden="true" and nothing referenced it, so the
  // access, reach, ownership and shadowing lines were sighted-only. It opens on
  // focusin as well as hover, so keyboard readers could see it and not hear it.
  const source = await readFile(resolve(root, 'src/runtime.js'), 'utf8');
  const host = source.slice(source.indexOf('function chatEmoteTooltipHost'));
  const block = host.slice(0, host.indexOf('\n}'));

  assert.doesNotMatch(block, /aria-hidden/, 'the card must not be hidden from assistive technology');
  assert.match(block, /setAttribute\('role', 'tooltip'\)/, 'the card needs a role that says what it is');

  // Two-way, like the followed-channel preview beside it: one card is reused
  // for every emote, so whoever opens it has to claim it and give it back.
  assert.match(source, /function setChatEmoteDescription/);
  for (const state of ['true', 'false']) {
    assert.ok(source.includes(`setChatEmoteDescription(image, ${state})`)
      || source.includes(`setChatEmoteDescription(tooltip.describedImage, ${state})`),
    `nothing sets the description to ${state}`);
  }
  assert.match(source, /tooltip\.describedImage = null;/, 'hiding the card must release the reference');
});
