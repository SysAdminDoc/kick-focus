import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import vm from 'node:vm';

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

function makeBootEnvironment() {
  const documentElement = fakeNode();
  const document = {
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
    createElement: () => fakeNode(),
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
  const win = {
    ...context,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
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
