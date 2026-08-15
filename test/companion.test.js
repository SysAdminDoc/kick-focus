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
