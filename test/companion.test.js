import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import vm from 'node:vm';
import { colorContrastRatio } from '../src/core.mjs';
import { readArtifact } from '../scripts/artifact-freshness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the popup chooses the higher-contrast ink for a boundary custom accent', async () => {
  const source = await readFile(resolve(root, 'src/extension/popup.js'), 'utf8');
  const start = source.indexOf('function accentInk');
  const end = source.indexOf('function applyAppearance', start);
  assert.ok(start >= 0 && end > start, 'popup accent helper not found');
  for (const [accent, expected] of [['#00884F', '#000000'], ['#787878', '#000000']]) {
    const context = { result: '' };
    vm.runInNewContext(`${source.slice(start, end)}\nresult = accentInk('${accent}');`, context);
    assert.equal(context.result, expected);
    assert.ok(colorContrastRatio(accent, context.result) >= 4.5,
      `${accent} needs readable popup ink, got ${colorContrastRatio(accent, context.result).toFixed(3)}:1`);
  }
});

test('popup and manifest localization has exact key parity in every package', { tags: ['artifact'] }, async () => {
  const locales = ['en', 'es', 'pt_BR'];
  const [popupHtml, popupSource, chromiumManifestSource, firefoxManifestSource] = await Promise.all([
    readFile(resolve(root, 'src/extension/popup.html'), 'utf8'),
    readFile(resolve(root, 'src/extension/popup.js'), 'utf8'),
    readFile(resolve(root, 'src/extension/manifest.json'), 'utf8'),
    readFile(resolve(root, 'src/extension/manifest.firefox.json'), 'utf8'),
  ]);
  const used = new Set([
    ...[...popupHtml.matchAll(/data-i18n(?:-title)?="([A-Za-z0-9_]+)"/g)].map((match) => match[1]),
    ...[...popupSource.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)].map((match) => match[1]),
    ...[...`${chromiumManifestSource}\n${firefoxManifestSource}`.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map((match) => match[1]),
  ]);
  const sourceMessages = await Promise.all(locales.map(async (locale) => (
    JSON.parse(await readFile(resolve(root, `src/extension/_locales/${locale}/messages.json`), 'utf8'))
  )));
  const expected = Object.keys(sourceMessages[0]).sort();
  assert.ok(expected.length >= 50, 'popup locale catalog is unexpectedly small');
  for (const [index, messages] of sourceMessages.entries()) {
    assert.deepEqual(Object.keys(messages).sort(), expected, `${locales[index]} locale keys drifted`);
    assert.ok(Object.values(messages).every((entry) => typeof entry?.message === 'string' && entry.message.trim()),
      `${locales[index]} has an empty message`);
  }
  assert.deepEqual([...used].sort(), expected, 'a popup locale key is missing or unused');

  for (const directory of ['dist/extension', 'dist/extension-firefox']) {
    const manifest = JSON.parse(await readArtifact(`${directory}/manifest.json`));
    assert.equal(manifest.default_locale, 'en');
    assert.equal(manifest.name, '__MSG_extensionName__');
    for (const locale of locales) {
      const packaged = JSON.parse(await readArtifact(`${directory}/_locales/${locale}/messages.json`));
      assert.deepEqual(Object.keys(packaged).sort(), expected, `${directory} omitted ${locale} messages`);
    }
  }
});

test('popup locale normalization keeps stored pt compatible with pt-BR metadata', async () => {
  const source = await readFile(resolve(root, 'src/extension/popup.js'), 'utf8');
  const start = source.indexOf('function normalizePopupLocale');
  const end = source.indexOf('function preferredPopupLocale', start);
  assert.ok(start >= 0 && end > start, 'popup locale normalizer not found');
  const context = { result: null };
  for (const [input, expected] of [['pt', 'pt-BR'], ['pt_PT', 'pt-BR'], ['es-MX', 'es'], ['fr', 'en']]) {
    vm.runInNewContext(`${source.slice(start, end)}\nresult = normalizePopupLocale('${input}');`, context);
    assert.equal(context.result, expected);
  }
  assert.match(source, /document\.documentElement\.lang = popupLocale/);
  assert.match(source, /document\.documentElement\.dir = api\?\.i18n\?\.getMessage\?\.\('@@bidi_dir'\) \|\| 'ltr'/);
});

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
    URL,
    setTimeout,
    clearTimeout,
  };
  context.globalThis = context;
  return { context, document, published, messages, runtimeMessages };
}

async function runBridge(file, pageFirst) {
  const source = await readFile(resolve(root, file), 'utf8');
  const env = makeEnvironment();
  const settings = JSON.stringify({
    appearance: { theme: 'oled', accent: 'custom', customAccent: '#123ABC' },
    content: { reduceTelemetry: true },
  });
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
async function loadBackground(file, options = {}) {
  // Guarded rather than a plain read: these judge the built companion bundles,
  // and the build writes them after the userscript, so a build that died in
  // between would leave them stale while the userscript looked current.
  const source = await readArtifact(file);
  const isFirefox = file.includes('firefox');
  let listener = null;
  let messageListener = null;
  const badges = [];
  const fetches = [];
  const timeouts = [];
  const stored = structuredClone(options.stored || {});
  const granted = new Set(options.granted || []);
  const storage = {
    get: async (keys) => {
      const wanted = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(wanted.filter((key) => key in stored).map((key) => [key, stored[key]]));
    },
    set: async (value) => { Object.assign(stored, value); },
    remove: async (key) => { delete stored[key]; },
  };
  const permissions = {
    contains: async ({ origins = [] }) => origins.every((origin) => granted.has(origin)),
    remove: async ({ origins = [] }) => {
      origins.forEach((origin) => granted.delete(origin));
      return true;
    },
  };
  const runtime = {
    id: isFirefox ? 'kick-focus@sysadmindoc' : 'test-extension-id',
    onMessage: { addListener: (fn) => { messageListener = fn; } },
    getManifest: () => ({ version: 'test' }),
  };
  const tabs = { onRemoved: { addListener: () => {} }, onUpdated: { addListener: () => {} } };
  const browser = {
    webRequest: { onBeforeRequest: { addListener: (fn) => { listener = fn; } } },
    browserAction: {
      setBadgeText: (value) => badges.push(value),
      setBadgeBackgroundColor: () => {},
    },
    runtime,
    storage: { local: storage },
    permissions,
    tabs,
  };
  const chrome = {
    action: {
      setBadgeText: async (value) => { badges.push(value); },
      setBadgeBackgroundColor: async () => {},
    },
    declarativeNetRequest: {
      getEnabledRulesets: async () => ['ads'],
      updateEnabledRulesets: async () => {},
      onRuleMatchedDebug: null,
    },
    runtime,
    storage: { local: storage },
    permissions,
    tabs,
  };
  const fetchImpl = options.fetch || (async () => { throw new Error('no network in tests'); });
  const context = {
    console,
    URL,
    Map,
    AbortController,
    TextDecoder,
    setTimeout: options.immediateTimeout
      ? (callback, milliseconds) => { timeouts.push(milliseconds); callback(); return 1; }
      : (callback, milliseconds) => { timeouts.push(milliseconds); return setTimeout(callback, milliseconds); },
    clearTimeout: options.immediateTimeout ? () => {} : clearTimeout,
    fetch: async (...args) => {
      fetches.push(args);
      return fetchImpl(...args);
    },
  };
  if (isFirefox) context.browser = browser;
  else context.chrome = chrome;
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return { listener, badges, messageListener, fetches, stored, granted, timeouts, runtime };
}

async function loadFirefoxBackground(options = {}) {
  return loadBackground('dist/extension-firefox/background.js', options);
}

async function askBackground(background, message, sender) {
  return new Promise((resolveAnswer) => {
    const keepAlive = background.messageListener(message, sender, resolveAnswer);
    if (keepAlive !== true) resolveAnswer(undefined);
  });
}

/**
 * A response whose body is a stream that never ends.
 *
 * The double above answers `arrayBuffer()` and has no `body`, which is exactly
 * the shape that let a body-size check pass while the whole body was still
 * being allocated first. This one hands out chunks forever and records how many
 * were taken, so "it stopped reading" is measurable rather than assumed.
 */
function endlessResponse(url, { chunkBytes = 64 * 1024 } = {}) {
  const taken = { chunks: 0, cancelled: false };
  const chunk = new TextEncoder().encode('x'.repeat(chunkBytes));
  const headers = new Map([['content-type', 'application/json']]);
  return {
    taken,
    response: {
      ok: true,
      status: 200,
      url,
      redirected: false,
      headers: { get: (name) => headers.get(String(name).toLowerCase()) || null },
      arrayBuffer: async () => { throw new Error('the whole body was read after all'); },
      body: {
        getReader: () => ({
          read: async () => {
            taken.chunks += 1;
            // A guard on the test itself: an unbounded reader would spin here
            // forever and the run would look like a hang rather than a failure.
            if (taken.chunks > 200) throw new Error('the reader never stopped');
            return { done: false, value: chunk };
          },
          cancel: async () => { taken.cancelled = true; },
        }),
      },
    },
  };
}

function jsonResponse(url, text = '{"blocked":[]}', overrides = {}) {
  const bytes = new TextEncoder().encode(text);
  const { headers: headerOverrides = {}, ...responseOverrides } = overrides;
  const headers = new Map(Object.entries({
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(bytes.byteLength),
    ...headerOverrides,
  }).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    ok: true,
    status: 200,
    url,
    redirected: false,
    headers: { get: (name) => headers.get(String(name).toLowerCase()) || null },
    arrayBuffer: async () => bytes.buffer,
    ...responseOverrides,
  };
}

test('the Firefox background cancels ad requests from Firefox-shaped details', { tags: ['artifact'] }, async () => {
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

test('the Firefox background leaves other sites and benign requests alone', { tags: ['artifact'] }, async () => {
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
      assert.deepEqual(
        JSON.parse(JSON.stringify(result.published.at(-1)?.settings?.appearance)),
        { theme: 'oled', accent: 'custom', customAccent: '#123ABC' },
      );
      assert.equal(result.messages.at(-1)?.type, 'kick-focus:telemetry-preference');
      assert.equal(result.messages.at(-1)?.enabled, true);
    }
  });

  test(`${file} lets the page trigger a blocklist refresh without choosing its URL`, async () => {
    const source = await readFile(resolve(root, file), 'utf8');
    const env = makeEnvironment();
    env.context.localStorage.value = JSON.stringify({ content: { reduceTelemetry: false, blocklistUrl: 'https://good.example/list.json' } });
    vm.runInNewContext(source, env.context, { filename: pathToFileURL(resolve(root, file)).href });
    env.document.dispatchEvent(new CustomEventStub('kick-focus:fetch-blocklist', { detail: { url: 'https://evil.example/steal' } }));
    const fetchMessage = env.messages.find((message) => message?.type === 'kick-focus:fetch-blocklist');
    assert.ok(fetchMessage, 'a fetch-blocklist message should be sent');
    assert.deepEqual(Object.keys(fetchMessage), ['type']);
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
      detail: { settings: JSON.stringify({
        appearance: { theme: 'slate', accent: 'violet', customAccent: '#ABCDEF', secret: 'x' },
        content: { reduceTelemetry: true, blocklistUrl: 'https://lists.example/blocked.json#fragment', secret: 'x' },
        evil: { drop: 1 },
      }) },
    }));
    const stored = env.published.at(-1)?.settings;
    assert.deepEqual(Object.keys(stored), ['appearance', 'content']);
    assert.deepEqual(Object.keys(stored.appearance), ['theme', 'accent', 'customAccent']);
    assert.deepEqual(JSON.parse(JSON.stringify(stored.appearance)), {
      theme: 'slate',
      accent: 'violet',
      customAccent: '#ABCDEF',
    });
    assert.deepEqual(Object.keys(stored.content), ['reduceTelemetry', 'blocklistUrl']);
    assert.equal(stored.content.reduceTelemetry, true);
    assert.equal(stored.content.blocklistUrl, 'https://lists.example/blocked.json');
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

for (const browserCase of [
  {
    name: 'Chromium',
    file: 'dist/extension/background.js',
    page: { id: 'test-extension-id', url: 'https://kick.com/xqc' },
    popup: { id: 'test-extension-id', url: 'chrome-extension://abc/popup.html' },
  },
  {
    name: 'Firefox',
    file: 'dist/extension-firefox/background.js',
    page: { id: 'kick-focus@sysadmindoc', url: 'https://kick.com/xqc' },
    popup: { id: 'kick-focus@sysadmindoc', url: 'moz-extension://abc/popup.html' },
  },
]) {
  const approvedUrl = 'https://lists.example/blocked.json';
  const origin = 'https://lists.example/*';
  const approvedStore = {
    settings: { content: { blocklistUrl: approvedUrl } },
    blocklistApproval: { url: approvedUrl, origin, approvedAt: 1 },
  };

  test(`${browserCase.name} fetches only the exact approved JSON feed`, { tags: ['artifact'] }, async () => {
    const background = await loadBackground(browserCase.file, {
      stored: approvedStore,
      granted: [origin],
      fetch: async (url) => jsonResponse(url),
    });
    const answer = await askBackground(background, { type: 'kick-focus:fetch-blocklist' }, browserCase.page);
    assert.equal(answer?.ok, true, answer?.error);
    assert.equal(answer?.text, '{"blocked":[]}');
    assert.equal(background.fetches.length, 1);
    const [url, init] = background.fetches[0];
    assert.equal(url, approvedUrl);
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'error');
    assert.equal(background.timeouts[0], 8000);
  });

  test(`${browserCase.name} refuses page-selected and stale blocklist URLs`, { tags: ['artifact'] }, async () => {
    const selected = await loadBackground(browserCase.file, {
      stored: approvedStore,
      granted: [origin],
      fetch: async (url) => jsonResponse(url),
    });
    const selectedAnswer = await askBackground(selected, {
      type: 'kick-focus:fetch-blocklist',
      url: 'https://evil.example/steal.json',
    }, browserCase.page);
    assert.equal(selectedAnswer?.ok, false);
    assert.match(selectedAnswer?.error || '', /mismatch/i);
    assert.equal(selected.fetches.length, 0);

    const stale = await loadBackground(browserCase.file, {
      stored: {
        ...approvedStore,
        settings: { content: { blocklistUrl: 'https://other.example/new.json' } },
      },
      granted: [origin],
      fetch: async (url) => jsonResponse(url),
    });
    const staleAnswer = await askBackground(stale, { type: 'kick-focus:fetch-blocklist' }, browserCase.page);
    assert.equal(staleAnswer?.ok, false);
    assert.match(staleAnswer?.error || '', /approval/i);
    assert.equal(stale.fetches.length, 0);
  });

  for (const invalid of [
    {
      label: 'redirects',
      response: () => jsonResponse(approvedUrl, '{}', { redirected: true }),
      error: /redirect/i,
    },
    {
      label: 'non-JSON MIME types',
      response: () => jsonResponse(approvedUrl, '{}', { headers: { 'content-type': 'text/plain' } }),
      error: /JSON/i,
    },
    {
      label: 'declared bodies over 512 KiB',
      response: () => jsonResponse(approvedUrl, '{}', { headers: { 'content-length': String(512 * 1024 + 1) } }),
      error: /512 KiB/i,
    },
    {
      label: 'streamed bodies over 512 KiB',
      response: () => jsonResponse(approvedUrl, 'x'.repeat(512 * 1024 + 1), { headers: { 'content-length': '0' } }),
      error: /512 KiB/i,
    },
  ]) {
    test(`${browserCase.name} rejects blocklist ${invalid.label}`, { tags: ['artifact'] }, async () => {
      const background = await loadBackground(browserCase.file, {
        stored: approvedStore,
        granted: [origin],
        fetch: async () => invalid.response(),
      });
      const answer = await askBackground(background, { type: 'kick-focus:fetch-blocklist' }, browserCase.page);
      assert.equal(answer?.ok, false);
      assert.match(answer?.error || '', invalid.error);
    });
  }

  test(`${browserCase.name} stops reading a blocklist at the limit, not after it`, { tags: ['artifact'] }, async () => {
    // A feed can answer with chunked encoding and declare no length at all, and
    // reading the whole body first means an arbitrarily large allocation that
    // is only refused afterwards. 512 KiB in 64 KiB chunks is nine reads: eight
    // to reach the limit and one to cross it.
    const endless = endlessResponse(approvedUrl, { chunkBytes: 64 * 1024 });
    const background = await loadBackground(browserCase.file, {
      stored: approvedStore,
      granted: [origin],
      fetch: async () => endless.response,
    });

    const answer = await askBackground(background, { type: 'kick-focus:fetch-blocklist' }, browserCase.page);
    assert.equal(answer?.ok, false);
    assert.match(answer?.error || '', /512 KiB/i);
    assert.equal(endless.taken.chunks, 9,
      `consumption stopped after ${endless.taken.chunks} chunks, not at the first one past the limit`);
    assert.equal(endless.taken.cancelled, true,
      'the reader was left open, so a refused feed keeps streaming');
  });

  test(`${browserCase.name} reads a streamed blocklist that fits`, { tags: ['artifact'] }, async () => {
    // The bound must not cost the ordinary case: a body that arrives in several
    // chunks has to come back whole, and still decode as strict UTF-8.
    const text = '{"blocked":["one","two"]}';
    const bytes = new TextEncoder().encode(text);
    const halves = [bytes.slice(0, 10), bytes.slice(10)];
    let index = 0;
    const background = await loadBackground(browserCase.file, {
      stored: approvedStore,
      granted: [origin],
      fetch: async () => ({
        ok: true,
        status: 200,
        url: approvedUrl,
        redirected: false,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null) },
        arrayBuffer: async () => { throw new Error('the stream should have been used'); },
        body: {
          getReader: () => ({
            read: async () => (index < halves.length ? { done: false, value: halves[index++] } : { done: true }),
            cancel: async () => {},
          }),
        },
      }),
    });

    const answer = await askBackground(background, { type: 'kick-focus:fetch-blocklist' }, browserCase.page);
    assert.equal(answer?.ok, true, answer?.error);
    assert.equal(answer.text, text, 'a chunked body came back joined wrongly');
  });

  test(`${browserCase.name} aborts blocklist fetches at eight seconds`, { tags: ['artifact'] }, async () => {
    const background = await loadBackground(browserCase.file, {
      stored: approvedStore,
      granted: [origin],
      immediateTimeout: true,
      fetch: async (_url, init) => {
        if (init.signal.aborted) throw new Error('request aborted');
        return jsonResponse(approvedUrl);
      },
    });
    const answer = await askBackground(background, { type: 'kick-focus:fetch-blocklist' }, browserCase.page);
    assert.equal(answer?.ok, false);
    assert.match(answer?.error || '', /aborted/i);
    assert.deepEqual(background.timeouts, [8000]);
  });

  test(`${browserCase.name} accepts exact feed approval only from its popup`, { tags: ['artifact'] }, async () => {
    const settings = { settings: { content: { blocklistUrl: approvedUrl } } };
    const background = await loadBackground(browserCase.file, { stored: settings, granted: [origin] });
    const pageAnswer = await askBackground(background, {
      type: 'kick-focus:approve-blocklist',
      url: approvedUrl,
    }, browserCase.page);
    assert.equal(pageAnswer?.error, 'refused');
    assert.equal(background.stored.blocklistApproval, undefined);

    const mismatch = await askBackground(background, {
      type: 'kick-focus:approve-blocklist',
      url: 'https://lists.example/other.json',
    }, browserCase.popup);
    assert.equal(mismatch?.ok, false);
    assert.equal(background.stored.blocklistApproval, undefined);

    const accepted = await askBackground(background, {
      type: 'kick-focus:approve-blocklist',
      url: approvedUrl,
    }, browserCase.popup);
    assert.equal(accepted?.ok, true, accepted?.error);
    assert.equal(background.stored.blocklistApproval?.url, approvedUrl);
  });
}

test('the popup requests only the configured feed origin from optional permissions', async () => {
  const [popupSource, chromiumManifestSource, firefoxManifestSource] = await Promise.all([
    readFile(resolve(root, 'src/extension/popup.js'), 'utf8'),
    readFile(resolve(root, 'src/extension/manifest.json'), 'utf8'),
    readFile(resolve(root, 'src/extension/manifest.firefox.json'), 'utf8'),
  ]);
  const chromiumManifest = JSON.parse(chromiumManifestSource);
  const firefoxManifest = JSON.parse(firefoxManifestSource);
  assert.match(popupSource, /permissions\.request\(\{ origins: \[origin\] \}\)/);
  assert.ok(!popupSource.includes("permissions.request({ origins: ['https://*/*']"));
  assert.deepEqual(chromiumManifest.optional_host_permissions, ['https://*/*']);
  assert.deepEqual(firefoxManifest.optional_permissions, ['https://*/*']);
  assert.ok(chromiumManifest.host_permissions.every((entry) => entry.includes('kick.com')));
  assert.ok(!firefoxManifest.permissions.includes('https://*/*'));
});

/**
 * A privileged message handler that trusts its message's shape and not its
 * sender will act for anything that can reach it. The ceiling is documented in
 * the background itself: a compromised renderer can forge both fields, so this
 * proves the guard rejects other extensions and uninjected frames, not that it
 * survives a compromised browser.
 */
test('the Firefox background refuses privileged messages from a sender it does not know', { tags: ['artifact'] }, async () => {
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
