import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

class EventTargetStub {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener, options = {}) {
    const current = this.listeners.get(type) || [];
    current.push({ listener, once: Boolean(options?.once) });
    this.listeners.set(type, current);
  }

  dispatchEvent(event) {
    const current = [...(this.listeners.get(event.type) || [])];
    for (const entry of current) {
      entry.listener.call(this, event);
      if (entry.once) {
        const remaining = (this.listeners.get(event.type) || []).filter((item) => item.listener !== entry.listener);
        this.listeners.set(event.type, remaining);
      }
    }
    return true;
  }
}

class CustomEventStub {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

function makeEnvironment() {
  const document = new EventTargetStub();
  document.readyState = 'loading';
  document.documentElement = { dataset: {}, append() {} };
  document.head = { append() {} };
  document.createElement = () => {
    const script = new EventTargetStub();
    script.dataset = {};
    script.remove = () => {};
    return script;
  };
  const window = new EventTargetStub();
  const published = [];
  const messages = [];
  const localStorage = {
    value: null,
    getItem() { return this.value; },
    setItem(_key, value) { this.value = String(value); },
  };
  const runtimeMessages = [];
  const chrome = {
    runtime: {
      getManifest: () => ({ version: 'test' }),
      getURL: (path) => `moz-extension://test/${path}`,
      sendMessage: (message) => messages.push(message),
      onMessage: { addListener: (listener) => runtimeMessages.push(listener) },
    },
    storage: {
      local: {
        set: (value) => published.push(value),
      },
    },
  };
  const context = {
    chrome,
    document,
    window,
    localStorage,
    CustomEvent: CustomEventStub,
    MutationObserver: class {},
    console,
    setTimeout,
    clearTimeout,
  };
  context.globalThis = context;
  return { context, document, published, messages, runtimeMessages };
}

async function runBridge(file, pageFirst) {
  const source = await readFile(resolve(root, file), 'utf8');
  const env = makeEnvironment();
  const settings = JSON.stringify({ content: { reduceTelemetry: true } });
  const respondToRequest = () => env.document.dispatchEvent(new CustomEventStub('kick-focus:settings-changed', {
    detail: { settings },
  }));

  if (pageFirst) env.document.addEventListener('kick-focus:request-settings', respondToRequest);
  vm.runInNewContext(source, env.context, { filename: pathToFileURL(resolve(root, file)).href });
  if (!pageFirst) env.document.addEventListener('kick-focus:request-settings', respondToRequest);
  env.document.dispatchEvent(new CustomEventStub('DOMContentLoaded'));

  return { ...env, settings };
}

/**
 * Loads the *built* Firefox background against a stubbed browser API and returns
 * the registered `onBeforeRequest` listener. Built, not source, because the host
 * arrays are injected at build time.
 */
async function loadFirefoxBackground() {
  const source = await readFile(resolve(root, 'dist/extension-firefox/background.js'), 'utf8');
  let listener = null;
  const badges = [];
  const browser = {
    webRequest: { onBeforeRequest: { addListener: (fn) => { listener = fn; } } },
    browserAction: {
      setBadgeText: (value) => badges.push(value),
      setBadgeBackgroundColor: () => {},
    },
    runtime: { onMessage: { addListener: () => {} }, getManifest: () => ({ version: 'test' }) },
    storage: { local: { get: async () => ({}) } },
    tabs: { onRemoved: { addListener: () => {} }, onUpdated: { addListener: () => {} } },
  };
  const context = { browser, console, URL, Map, setTimeout, clearTimeout };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return { listener, badges };
}

test('the Firefox background cancels ad requests from Firefox-shaped details', async () => {
  const { listener, badges } = await loadFirefoxBackground();
  assert.ok(listener, 'no onBeforeRequest listener was registered');

  // Firefox populates originUrl and leaves `initiator` undefined. The whole point:
  // this must not depend on the Chromium-only field.
  assert.equal(
    listener({ url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', originUrl: 'https://kick.com/xqc', tabId: 7 })?.cancel,
    true,
  );

  // documentUrl alone is enough (originUrl is absent on some request types).
  assert.equal(
    listener({ url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', documentUrl: 'https://www.kick.com/', tabId: 7 })?.cancel,
    true,
  );

  // The IVS player runs in a blob: worker; its origin lives in the path.
  assert.equal(
    listener({ url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', originUrl: 'blob:https://kick.com/8f2c-uuid', tabId: 7 })?.cancel,
    true,
  );

  // Chromium's field still works, so one file serves both engines.
  assert.equal(
    listener({ url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', initiator: 'https://kick.com', tabId: 7 })?.cancel,
    true,
  );

  assert.ok(badges.length >= 4, 'blocked requests should paint a badge count');
});

test('the Firefox background leaves other sites and benign requests alone', async () => {
  const { listener } = await loadFirefoxBackground();

  // Not a Kick page — the companion must never change how another site loads.
  assert.equal(listener({ url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', originUrl: 'https://example.com/', tabId: 1 }), undefined);
  // No origin at all (top-level document loads) must not be treated as Kick.
  assert.equal(listener({ url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', tabId: 1 }), undefined);
  // A Kick page requesting Kick's own assets is untouched.
  assert.equal(listener({ url: 'https://files.kick.com/emotes/37226/fullsize', originUrl: 'https://kick.com/xqc', tabId: 1 }), undefined);
});

for (const file of ['src/extension/bridge.js', 'src/extension/bridge.firefox.js']) {
  test(`${file} survives page-first and bridge-first injection`, async () => {
    const pageFirst = await runBridge(file, true);
    const bridgeFirst = await runBridge(file, false);

    for (const result of [pageFirst, bridgeFirst]) {
      assert.equal(result.published.at(-1)?.settings?.content?.reduceTelemetry, true);
      assert.equal(result.messages.at(-1)?.type, 'kick-focus:telemetry-preference');
      assert.equal(result.messages.at(-1)?.enabled, true);
    }
  });
}
