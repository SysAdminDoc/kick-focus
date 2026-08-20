import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import vm from 'node:vm';
import { HIDEABLE_ELEMENTS } from '../src/core.mjs';

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
