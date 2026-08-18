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
  let messageListener = null;
  const badges = [];
  const browser = {
    webRequest: { onBeforeRequest: { addListener: (fn) => { listener = fn; } } },
    browserAction: {
      setBadgeText: (value) => badges.push(value),
      setBadgeBackgroundColor: () => {},
    },
    runtime: {
      id: 'kick-focus@sysadmindoc',
      onMessage: { addListener: (fn) => { messageListener = fn; } },
      getManifest: () => ({ version: 'test' }),
    },
    storage: { local: { get: async () => ({}) } },
    tabs: { onRemoved: { addListener: () => {} }, onUpdated: { addListener: () => {} } },
  };
  const context = { browser, console, URL, Map, setTimeout, clearTimeout, fetch: async () => { throw new Error('no network in tests'); } };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return { listener, badges, messageListener };
}

test('the Firefox background cancels ad requests from Firefox-shaped details', { tag: 'artifact' }, async () => {
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

test('the Firefox background leaves other sites and benign requests alone', { tag: 'artifact' }, async () => {
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

  test(`${file} pins the blocklist fetch to the configured URL, ignoring the event URL`, async () => {
    const source = await readFile(resolve(root, file), 'utf8');
    const env = makeEnvironment();
    env.context.localStorage.value = JSON.stringify({ content: { reduceTelemetry: false, blocklistUrl: 'https://good.example/list.json' } });
    vm.runInNewContext(source, env.context, { filename: pathToFileURL(resolve(root, file)).href });
    env.document.dispatchEvent(new CustomEventStub('kick-focus:fetch-blocklist', { detail: { url: 'https://evil.example/steal' } }));
    const fetchMessage = env.messages.find((message) => message?.type === 'kick-focus:fetch-blocklist');
    assert.ok(fetchMessage, 'a fetch-blocklist message should be sent');
    assert.equal(fetchMessage.url, 'https://good.example/list.json');
  });

  test(`${file} refuses to fetch when no https blocklist URL is configured`, async () => {
    const source = await readFile(resolve(root, file), 'utf8');
    const env = makeEnvironment();
    env.context.localStorage.value = JSON.stringify({ content: { reduceTelemetry: false, blocklistUrl: 'http://insecure/list' } });
    vm.runInNewContext(source, env.context, { filename: pathToFileURL(resolve(root, file)).href });
    env.document.dispatchEvent(new CustomEventStub('kick-focus:fetch-blocklist', { detail: { url: 'https://evil.example/steal' } }));
    assert.ok(!env.messages.some((message) => message?.type === 'kick-focus:fetch-blocklist'), 'no fetch for a non-https configured URL');
  });

  test(`${file} sanitizes announced settings to the popup shape only`, async () => {
    const source = await readFile(resolve(root, file), 'utf8');
    const env = makeEnvironment();
    vm.runInNewContext(source, env.context, { filename: pathToFileURL(resolve(root, file)).href });
    env.document.dispatchEvent(new CustomEventStub('kick-focus:settings-changed', {
      detail: { settings: JSON.stringify({ content: { reduceTelemetry: true, secret: 'x' }, evil: { drop: 1 } }) },
    }));
    const stored = env.published.at(-1)?.settings;
    assert.deepEqual(Object.keys(stored), ['content']);
    assert.deepEqual(Object.keys(stored.content), ['reduceTelemetry']);
    assert.equal(stored.content.reduceTelemetry, true);
  });

  test(`${file} answers a companion presence ping with the same nonce`, async () => {
    const source = await readFile(resolve(root, file), 'utf8');
    const env = makeEnvironment();
    const pongs = [];
    env.document.addEventListener('kick-focus:companion-pong', (event) => pongs.push(event.detail));
    vm.runInNewContext(source, env.context, { filename: pathToFileURL(resolve(root, file)).href });
    env.document.dispatchEvent(new CustomEventStub('kick-focus:companion-ping', { detail: { nonce: 'abc123' } }));
    assert.equal(pongs.length, 1);
    const detail = JSON.parse(pongs[0]);
    assert.equal(detail.nonce, 'abc123');
    assert.equal(detail.version, 'test');
  });
}

/**
 * A privileged message handler that trusts its message's shape and not its
 * sender will act for anything that can reach it. The ceiling is documented in
 * the background itself: a compromised renderer can forge both fields, so this
 * proves the guard rejects other extensions and uninjected frames, not that it
 * survives a compromised browser.
 */
test('the Firefox background refuses privileged messages from a sender it does not know', { tag: 'artifact' }, async () => {
  const { messageListener } = await loadFirefoxBackground();
  assert.ok(messageListener, 'no onMessage listener was registered');

  const ask = (message, sender) => {
    let answer = null;
    messageListener(message, sender, (value) => { answer = value; });
    return answer;
  };
  const own = 'kick-focus@sysadmindoc';

  // The page this extension actually injects into is the only origin allowed to
  // drive the cross-origin fetch or the telemetry toggle.
  // Field-wise, not deepEqual: these objects are built inside the vm realm, so
  // their prototype is not this realm's Object.prototype and a strict deep
  // compare fails on values that are otherwise identical.
  const refused = (answer) => answer?.ok === false && answer?.error === 'refused';
  assert.equal(ask({ type: 'kick-focus:telemetry-preference', enabled: false }, { id: own, url: 'https://kick.com/xqc' })?.ok, true,
    'the content script on a real Kick page must still be served');
  assert.equal(ask({ type: 'kick-focus:telemetry-preference', enabled: false }, { id: own, url: 'https://www.kick.com/' })?.ok, true,
    'the www host is the same site and must still be served');

  for (const [label, sender] of [
    ['another extension', { id: 'evil@example', url: 'https://kick.com/xqc' }],
    ['an off-Kick page', { id: own, url: 'https://evil.example/' }],
    ['a lookalike host', { id: own, url: 'https://kick.com.evil.net/' }],
    ['no sender at all', undefined],
  ]) {
    assert.ok(refused(ask({ type: 'kick-focus:telemetry-preference', enabled: true }, sender)), `telemetry toggle accepted ${label}`);
    assert.ok(refused(ask({ type: 'kick-focus:fetch-blocklist', url: 'https://evil.example/list.txt' }, sender)), `blocklist fetch accepted ${label}`);
  }

  // The popup is one of this extension's own pages and must still work.
  assert.ok(!refused(ask({ type: 'kick-focus:reset-count', tabId: 3 }, { id: own, url: 'moz-extension://abc/popup.html' })),
    'the popup is one of this extension pages and must still be served');
});
