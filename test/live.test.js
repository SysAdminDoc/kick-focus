import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatMessageSelector, createLive } from '../src/live.mjs';

/**
 * The live-data surface, driven without a browser.
 *
 * These paths used to be reachable only by loading the whole bundle: the
 * request deadline, the size ceiling, the drift cap, the CSRF header, and the
 * refusal to count anyone else's messages are all decisions with security or
 * correctness consequences, and none of them had a test that could fail. The
 * host boundary introduced by the split is what makes them assertable here.
 */
function makeNode(overrides = {}) {
  const node = {
    dataset: {},
    className: '',
    textContent: '',
    children: [],
    getAttribute: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    append(...kids) { node.children.push(...kids); },
    prepend(...kids) { node.children.unshift(...kids); },
    replaceWith() {},
    ...overrides,
  };
  return node;
}

function makeHost(overrides = {}) {
  const written = [];
  const merged = [];
  const state = {
    shadow: null,
    currentPage: 'content',
    emoteUsage: {},
    usagePersistTimer: 0,
    stickerPreferences: { library: new Map() },
    settings: {
      content: {
        liveEmoteCatalog: true,
        liveChatEvents: true,
        countEmoteUsage: true,
        showChatBadges: false,
        showModerationReasons: true,
        organizeChatStickers: false,
        warnShadowedEmotes: false,
        showEmoteRarity: false,
      },
    },
    live: {
      slug: '', channel: null, catalog: null, catalogSource: 'dom', catalogError: '',
      collisions: [], rarity: null, inventory: null, socket: null, socketState: 'offline',
      lastFrameAt: 0, unparsable: 0, subscribed: [], deletions: new Map(), pendingBadges: new Map(),
      reconnectAt: 0, reconnectAttempts: 0, provider: '', providerVerified: true, lastLiveAt: 0,
      apiDrift: [],
    },
  };
  const host = {
    state,
    gmSet: (key, value) => written.push([key, value]),
    EMOTE_USAGE_KEY: 'kick-focus:emote-usage',
    pageFetch: async () => ({ ok: false, status: 0, text: async () => '' }),
    currentChannelSlug: () => host.__slug,
    plural: (count, one, other) => (count === 1 ? one : other),
    mergeStickerLibrary: (observed) => merged.push(observed),
    __slug: 'alpha',
  };
  Object.assign(host, overrides);
  return { host, state, written, merged };
}

globalThis.window = { setTimeout: (fn, ms) => setTimeout(fn, ms) };
globalThis.document = {
  cookie: '',
  querySelector: () => null,
  createElement: () => makeNode(),
};

test('every function the surface hands back can be called against a stub host', { tag: 'unit' }, async () => {
  const { host } = makeHost();
  const surface = createLive(host);
  assert.equal(Object.keys(surface).length, 11);
  for (const [name, fn] of Object.entries(surface)) {
    assert.equal(typeof fn, 'function', `${name} is callable`);
  }
  // A ReferenceError here is the whole point of the boundary: a dependency this
  // module forgot to take would resolve out of the bundle scope in the artifact
  // and be invisible until it ran on someone's machine.
  surface.teardownRealtime();
  surface.refreshLiveDiagnostics();
  surface.replayPendingBadges();
  surface.replayPendingDeletions();
  assert.equal(typeof surface.liveStatusSummary(), 'string');
  await surface.refreshLiveChannel();
  await surface.connectRealtime();
});

test('a slow endpoint is abandoned rather than left hanging', { tag: 'unit' }, async () => {
  let aborted = false;
  const { host } = makeHost({
    pageFetch: (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        aborted = true;
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }),
  });
  // Fire the deadline immediately instead of waiting eight seconds for it.
  globalThis.window.setTimeout = (fn) => setTimeout(fn, 0);
  const surface = createLive(host);
  const result = await surface.kickFetchJson('https://kick.com/api/v2/channels/alpha');

  assert.equal(aborted, true, 'the request is actually aborted, not just ignored');
  assert.deepEqual(result, { ok: false, status: 'timeout' });
  globalThis.window.setTimeout = (fn, ms) => setTimeout(fn, ms);
});

test('an oversized body is refused instead of parsed', { tag: 'unit' }, async () => {
  const { host } = makeHost({
    pageFetch: async () => ({ ok: true, status: 200, text: async () => 'x'.repeat(4_000_001) }),
  });
  const surface = createLive(host);
  assert.deepEqual(await surface.kickFetchJson('https://kick.com/api/v2/x'), { ok: false, status: 'oversized' });

  // And a body just under the ceiling still parses.
  const { host: small } = makeHost({
    pageFetch: async () => ({ ok: true, status: 200, text: async () => '{"id":7}' }),
  });
  const ok = await createLive(small).kickFetchJson('https://kick.com/api/v2/x');
  assert.deepEqual(ok, { ok: true, status: 200, body: { id: 7 } });
});

test('malformed JSON is reported as a failure, never thrown at the caller', { tag: 'unit' }, async () => {
  const { host } = makeHost({
    pageFetch: async () => ({ ok: true, status: 200, text: async () => 'not json' }),
  });
  const result = await createLive(host).kickFetchJson('https://kick.com/api/v2/x');
  assert.deepEqual(result, { ok: false, status: 'network' });
});

test('the follow mutation refuses a junk channel before it reaches the network', { tag: 'unit' }, async () => {
  const attempts = [];
  const { host } = makeHost({
    pageFetch: async (url, init) => { attempts.push({ url, init }); return { ok: true, status: 200 }; },
  });
  const surface = createLive(host);

  for (const bad of ['', '../admin', 'a'.repeat(65), '-leading', 'has space']) {
    assert.deepEqual(await surface.mutateKickChannelFollow(bad), { ok: false, status: 'invalid-channel' });
  }
  assert.deepEqual(attempts, [], 'nothing invalid was ever sent');

  // A real slug goes out with Kick's own CSRF header, taken from the cookie.
  globalThis.document.cookie = 'foo=1; XSRF-TOKEN=abc%2Fdef; bar=2';
  assert.deepEqual(await surface.mutateKickChannelFollow('alpha'), { ok: true, status: 200 });
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].init.headers['x-xsrf-token'], 'abc/def', 'the token is decoded, not passed raw');
  assert.equal(attempts[0].init.method, 'POST');
  assert.equal(attempts[0].init.credentials, 'include');
  globalThis.document.cookie = '';

  // Already-following answers 409, which is success for this gesture.
  const { host: conflict } = makeHost({ pageFetch: async () => ({ ok: false, status: 409 }) });
  assert.deepEqual(await createLive(conflict).mutateKickChannelFollow('alpha'), { ok: true, status: 409 });
});

test('drift is accumulated up to a cap rather than growing without bound', { tag: 'unit' }, () => {
  const { host, state } = makeHost();
  const surface = createLive(host);
  for (let index = 0; index < 60; index += 1) surface.recordApiDrift('channel', 'shape-changed', String(index));
  assert.equal(state.live.apiDrift.length, 50, 'a session cannot be flooded through this list');
  assert.equal(state.live.apiDrift.at(-1).detail, '49');
});

test('the status line names the source, the transport, and the reason it fell back', { tag: 'unit' }, () => {
  const { host, state } = makeHost();
  const surface = createLive(host);
  assert.match(surface.liveStatusSummary(), /Emote catalog from the picker\./);

  state.live.catalogSource = 'api';
  state.live.catalog = { emotes: [{ id: 1 }, { id: 2 }] };
  state.live.collisions = ['one'];
  assert.match(surface.liveStatusSummary(), /API \(2 emotes\)/);
  assert.match(surface.liveStatusSummary(), /1 emote name shadowed\./, 'singular for one collision');

  state.live.collisions = ['one', 'two'];
  assert.match(surface.liveStatusSummary(), /2 emote names shadowed\./);

  state.live.catalogError = 'Kick answered 503.';
  assert.match(surface.liveStatusSummary(), /Kick answered 503\.$/);
});

test('a message selector escapes the id it was handed', { tag: 'unit' }, () => {
  globalThis.CSS = { escape: (value) => String(value).replace(/["\\]/g, (c) => `\\${c}`) };
  const selector = chatMessageSelector('a"b');
  assert.equal(selector.includes('a\\"b'), true, 'the quote is escaped, not closing the attribute');
  assert.equal(selector.split(',').length, 3, 'all three id attributes Kick uses are covered');
});

test('a route with no channel tears the socket down instead of leaving it open', { tag: 'unit' }, async () => {
  let closed = false;
  const { host, state } = makeHost();
  host.__slug = '';
  state.live.slug = 'alpha';
  state.live.socket = { close() { closed = true; } };
  state.live.socketState = 'live';
  state.live.reconnectAttempts = 3;

  await createLive(host).refreshLiveChannel();
  assert.equal(closed, true);
  assert.equal(state.live.socket, null);
  assert.equal(state.live.socketState, 'offline');
  assert.equal(state.live.slug, '');
  assert.equal(state.live.channel, null);
});

test('a channel whose payload changed shape falls back and says so', { tag: 'unit' }, async () => {
  const { host, state } = makeHost({
    pageFetch: async () => ({ ok: true, status: 200, text: async () => '{"unexpected":true}' }),
  });
  await createLive(host).refreshLiveChannel();

  assert.equal(state.live.channel, null, 'nothing is invented from an unrecognised payload');
  assert.match(state.live.catalogError, /no longer has the expected shape/);
  assert.deepEqual(state.live.apiDrift.map((entry) => [entry.endpoint, entry.reason]), [['channel', 'shape-changed']]);
});

test('with both live settings off, the channel read is never made', { tag: 'unit' }, async () => {
  const requests = [];
  const { host, state } = makeHost({ pageFetch: async (url) => { requests.push(url); return { ok: false, status: 0 }; } });
  state.settings.content.liveEmoteCatalog = false;
  state.settings.content.liveChatEvents = false;

  await createLive(host).refreshLiveChannel();
  assert.deepEqual(requests, [], 'a setting that is off costs no request');
  assert.equal(state.live.slug, 'alpha', 'the route is still tracked');
});

test('a deletion is annotated once, bounded, and replayed onto a remounted node', { tag: 'unit' }, () => {
  globalThis.CSS = { escape: (value) => String(value) };
  let node = makeNode();
  globalThis.document.querySelector = () => node;

  const { host, state } = makeHost();
  const surface = createLive(host);
  const frame = { kind: 'deletion', payload: { id: 'm1' } };

  // Drive it the way a socket frame would, so the parse boundary is included.
  surface.onRealtimeFrame({ data: JSON.stringify({ event: 'App\\Events\\MessageDeletedEvent', data: JSON.stringify({ message: { id: 'm1' } }) }) });
  const annotated = state.live.deletions.size === 1;
  assert.equal(annotated, true, 'the deletion was recorded from the frame');
  assert.equal(node.dataset.kfDeletionNoted, 'true');
  const noteCount = node.children.length;

  // Replaying does not double-annotate the same node...
  surface.replayPendingDeletions();
  assert.equal(node.children.length, noteCount, 'an already-noted message is left alone');

  // ...but a remounted node picks the note back up.
  node = makeNode();
  surface.replayPendingDeletions();
  assert.equal(node.dataset.kfDeletionNoted, 'true', 'chat virtualisation cannot lose the annotation');
  void frame;

  globalThis.document.querySelector = () => null;
});
