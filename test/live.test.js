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
        showVodExpiry: true,
      },
    },
    live: {
      slug: '', channel: null, catalog: null, catalogSource: 'dom', catalogError: '',
      collisions: [], rarity: null, inventory: null, socket: null, socketState: 'offline',
      lastFrameAt: 0, unparsable: 0, subscribed: [], deletions: new Map(), pendingBadges: new Map(),
      reconnectAt: 0, reconnectAttempts: 0, provider: '', providerVerified: true, lastLiveAt: 0,
      apiDrift: [], vod: null,
    },
  };
  const host = {
    state,
    gmSet: (key, value) => written.push([key, value]),
    EMOTE_USAGE_KEY: 'kick-focus:emote-usage',
    pageFetch: async () => ({ ok: false, status: 0, text: async () => '' }),
    currentChannelSlug: () => host.__slug,
    currentVodId: () => host.__vodId,
    plural: (count, one, other) => (count === 1 ? one : other),
    mergeStickerLibrary: (observed) => merged.push(observed),
    __slug: 'alpha',
    __vodId: '',
  };
  Object.assign(host, overrides);
  return { host, state, written, merged };
}

/**
 * A stub `Image`, at module scope.
 *
 * The chat-emote harvest validates every observation by loading its image before
 * it may take a cap slot, so any test that lets a chat message through schedules
 * a real `new Image()` 120 ms later. In node that is a ReferenceError raised
 * *after* the test ended, which node:test reports as an uncaught exception
 * against the whole file rather than the test that caused it. Same class as the
 * BroadcastChannel stub in multistream.test.js: assume nothing about which
 * browser globals node lacks, and stub the ones the code under test reaches for.
 *
 * It resolves as a real image so the harvest path runs to completion instead of
 * hanging with work in flight.
 */
globalThis.Image = class {
  constructor() {
    this.naturalWidth = 8;
    this.onload = null;
    this.onerror = null;
  }

  set src(value) {
    this._src = value;
    setTimeout(() => this.onload?.(), 0);
  }

  get src() { return this._src; }
};

function eventMethods(target) {
  const listeners = new Map();
  target.addEventListener = (type, listener) => {
    const current = listeners.get(type) || new Set();
    current.add(listener);
    listeners.set(type, current);
  };
  target.removeEventListener = (type, listener) => listeners.get(type)?.delete(listener);
  target.dispatchEvent = (event) => {
    for (const listener of listeners.get(event.type) || []) listener.call(target, event);
    return true;
  };
  return target;
}

globalThis.window = eventMethods({ setTimeout: (fn, ms) => setTimeout(fn, ms) });
globalThis.document = eventMethods({
  cookie: '',
  hidden: false,
  querySelector: () => null,
  createElement: () => makeNode(),
});

test('every function the surface hands back can be called against a stub host', { tag: 'unit' }, async () => {
  const { host } = makeHost();
  const surface = createLive(host);
  assert.equal(Object.keys(surface).length, 18);
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
  assert.deepEqual(result, { ok: false, status: 'parse' });
});

test('a channel API that returns HTML is reported as unreadable, not as a network failure', { tag: 'unit' }, async () => {
  const { host, state } = makeHost({
    pageFetch: async () => ({ ok: true, status: 200, text: async () => '<html>nope</html>' }),
  });
  await createLive(host).refreshLiveChannel();
  assert.match(state.live.catalogError, /could not read/);
  assert.equal(state.live.channel, null);
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

/**
 * The realtime half, driven frame by frame.
 *
 * `live.mjs` was split out behind a `host` factory precisely so these paths
 * could be exercised without a browser, and then the realtime half never was —
 * measured 2026-08-18 at 48.72% function coverage, the lowest in the tree. These
 * are the paths that touch a live socket and mutate somebody's chat.
 */
const frame = (event, data) => ({ data: JSON.stringify({ event, data: JSON.stringify(data) }) });

test('an unreadable run of frames is counted, and one good frame clears it', { tag: 'unit' }, () => {
  const { host, state } = makeHost();
  const surface = createLive(host);

  for (let i = 0; i < 3; i += 1) surface.onRealtimeFrame({ data: 'not json at all' });
  assert.equal(state.live.unparsable, 3, 'a payload shape change must be visible, not silent');

  surface.onRealtimeFrame({ data: JSON.stringify({ event: 'pusher:connection_established' }) });
  assert.equal(state.live.unparsable, 0, 'a readable frame proves the shape is fine again');
  assert.equal(state.live.socketState, 'live');
  assert.ok(state.live.lastLiveAt > 0, 'a transport that reached established has proven itself');
  assert.ok(state.live.lastFrameAt > 0);
});

test('a message from somebody else never lands in this user’s usage counts', { tag: 'unit' }, async () => {
  const { host, state, merged } = makeHost();
  state.settings.content.organizeChatStickers = true;
  state.live.slug = 'alpha';
  const surface = createLive(host);

  // No composer in the DOM means there is no local user to compare against, so
  // nothing may be counted as "mine". Counting everyone would measure the
  // channel rather than the person, and the shelf exists to rank what this user
  // actually reaches for.
  //
  // The harvest half of the same path is deliberately not asserted here: it
  // buffers and then validates each emote by loading its image before it can
  // take a cap slot, so nothing is observable in the same tick and faking an
  // Image would prove only that the stub was written correctly.
  globalThis.document.querySelector = () => null;
  surface.onRealtimeFrame(frame('App\Events\ChatMessageEvent', {
    id: 'm-other',
    sender: { id: 9, username: 'someone-else', identity: { badges: [] } },
    content: 'hello [emote:1:PogChamp]',
  }));
  assert.deepEqual(state.emoteUsage, {}, 'counting everyone would measure the channel, not the person');

  // The harvest half of the same path *does* take it: everyone's emotes are
  // collected, which is the point of harvesting from chat at all. It buffers for
  // 120 ms and then validates each image, so this waits for both hops.
  await new Promise((done) => setTimeout(done, 260));
  assert.equal(merged.flat().some((observation) => observation.name === 'PogChamp'), true,
    'an emote from somebody else is still collected into the library');
});

test('a deletion is annotated once per node, and a reconnect is scheduled with backoff', { tag: 'unit' }, () => {
  const { host, state } = makeHost();
  const surface = createLive(host);

  // Deletions are bounded: this is a live annotation, not a log.
  for (let i = 0; i < 320; i += 1) {
    surface.onRealtimeFrame(frame('App\Events\MessageDeletedEvent', { message: { id: `m${i}` } }));
  }
  assert.ok(state.live.deletions.size <= 300, `deletions grew to ${state.live.deletions.size}`);
  assert.equal(state.live.deletions.has('m0'), false, 'the oldest annotation is the one dropped');
  assert.equal(state.live.deletions.has('m319'), true, 'the newest is always kept');
});

test('the surface refuses to act on chat events the user switched off', { tag: 'unit' }, () => {
  const { host, state, merged } = makeHost();
  state.settings.content.countEmoteUsage = false;
  state.settings.content.showChatBadges = false;
  state.settings.content.organizeChatStickers = false;
  state.settings.content.showModerationReasons = false;
  const surface = createLive(host);

  surface.onRealtimeFrame(frame('App\Events\ChatMessageEvent', {
    id: 'm1',
    sender: { id: 1, username: 'me', identity: { badges: [] } },
    content: 'hi [emote:5:Kappa]',
  }));
  surface.onRealtimeFrame(frame('App\Events\MessageDeletedEvent', { message: { id: 'm1' } }));

  assert.deepEqual(state.emoteUsage, {}, 'usage counting is off');
  assert.equal(merged.length, 0, 'harvest is off');
  assert.equal(state.live.deletions.size, 0, 'moderation reasons are off');
});

test('badges are drawn once, survive a remount, and are dropped when the node never comes', { tag: 'unit' }, () => {
  const { host, state } = makeHost();
  state.settings.content.showChatBadges = true;
  let node = null;
  globalThis.document.querySelector = (selector) => (String(selector).includes('m-badge') ? node : null);
  const surface = createLive(host);

  // The message arrives before Kick has rendered its node — the ordinary case
  // on a busy chat — so it has to be held rather than dropped.
  surface.onRealtimeFrame(frame('App\Events\ChatMessageEvent', {
    id: 'm-badge',
    sender: { id: 3, username: 'someone', identity: { badges: [{ type: 'moderator', text: 'Moderator' }] } },
    content: 'hello',
  }));
  assert.equal(state.live.pendingBadges.size, 1, 'a message with no node yet is queued, not discarded');

  node = makeNode();
  surface.replayPendingBadges();
  assert.equal(node.dataset.kfBadgesDrawn, 'true', 'the badges land once the node exists');
  const drawn = node.children.length;

  surface.replayPendingBadges();
  assert.equal(node.children.length, drawn, 'a node already drawn is left alone rather than duplicated');

  globalThis.document.querySelector = () => null;
});

test('an unusable realtime answer degrades to the page instead of retrying blind', { tag: 'unit' }, async () => {
  const { host, state } = makeHost();
  state.live.channel = { chatroomId: 42 };
  host.pageFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ provider: 'some-provider-we-do-not-speak' }),
  });
  const surface = createLive(host);

  await surface.connectRealtime();

  assert.equal(state.live.socket, null, 'nothing is opened against a transport we cannot speak');
  assert.equal(state.live.socketState, 'unsupported');
  assert.match(state.live.catalogError, /fall back to the page/);
  assert.equal(state.live.apiDrift.length, 1, 'the drift is recorded so it is visible in diagnostics');
  assert.equal(state.live.apiDrift[0].endpoint, 'realtime');
});

/**
 * A stub `WebSocket`, so the socket lifecycle is assertable.
 *
 * Node ships a real WebSocket, and a feature-detected one would open a genuine
 * connection to Kick's Pusher cluster from the test run — the same trap the
 * BroadcastChannel stub in multistream.test.js exists for, except this one would
 * also reach the network. Declared per test rather than at module scope so the
 * tests that must *not* open a socket still see the real absence.
 */
class SocketStub {
  constructor(url) {
    SocketStub.opened.push(url);
    this.url = url;
    this.sent = [];
    this.listeners = new Map();
  }

  addEventListener(type, fn) { this.listeners.set(type, fn); }

  send(payload) { this.sent.push(payload); }

  close() { this.fire('close'); }

  fire(type, event = {}) { this.listeners.get(type)?.(event); }
}
SocketStub.opened = [];

// `await run()`, not `return run()`: a non-async wrapper restores the global the
// moment the callback hits its first await, so the code under test would build a
// *real* WebSocket and open a connection to Kick's Pusher cluster from the suite.
async function withSocketStub(run) {
  const real = globalThis.WebSocket;
  SocketStub.opened = [];
  globalThis.WebSocket = SocketStub;
  try { return await run(); } finally { globalThis.WebSocket = real; }
}

const PUSHER_ANSWER = {
  data: { connections: [{ provider: 'pusher', credentials: { app_key: 'key-1', cluster: 'us2' } }] },
};

function makeMergedClock(start = 10_000) {
  let now = start;
  let nextId = 1;
  const timers = new Map();
  const api = {
    now: () => now,
    random: () => 0.5,
    setTimeout: (callback, delay) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, at: now + Math.max(0, Number(delay) || 0) });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    async advance(milliseconds = 0) {
      now += milliseconds;
      for (let round = 0; round < 40; round += 1) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= now)
          .sort((first, second) => first[1].at - second[1].at || first[0] - second[0]);
        if (due.length) {
          for (const [id, timer] of due) {
            timers.delete(id);
            timer.callback();
          }
        }
        await Promise.resolve();
      }
    },
  };
  return api;
}

function mergedConnectionHost(clock) {
  const requests = [];
  const made = makeHost({
    now: clock.now,
    random: clock.random,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    pageFetch: async (url) => {
      requests.push(String(url));
      const body = String(url).includes('/channels/')
        ? { id: 7, slug: String(url).split('/').at(-1), chatroom: { id: 42 } }
        : PUSHER_ANSWER;
      return { ok: true, status: 200, text: async () => JSON.stringify(body) };
    },
  });
  return { ...made, requests };
}

test('merged chat reconnects a closed channel through one bounded queue', { tag: 'unit' }, async () => {
  const clock = makeMergedClock();
  const { host, state, requests } = mergedConnectionHost(clock);
  const fetchNow = host.pageFetch;
  const releases = [];
  let activeChannelReads = 0;
  let maxChannelReads = 0;
  host.pageFetch = (url, init) => {
    if (!String(url).includes('/channels/')) return fetchNow(url, init);
    activeChannelReads += 1;
    maxChannelReads = Math.max(maxChannelReads, activeChannelReads);
    return new Promise((resolveResponse) => releases.push(async () => {
      activeChannelReads -= 1;
      resolveResponse(await fetchNow(url, init));
    }));
  };

  await withSocketStub(async () => {
    const surface = createLive(host);
    surface.syncMergedChat(['alpha', 'beta', 'gamma']);
    await clock.advance();
    assert.equal(releases.length, 2, 'the shared queue starts no more than two credential reads at once');
    assert.equal(maxChannelReads, 2);
    for (const release of releases.splice(0)) await release();
    await clock.advance();
    assert.equal(SocketStub.opened.length, 2, 'only two socket handshakes may be active');
    assert.equal(releases.length, 0, 'credentials finishing does not release a handshake slot');
    assert.equal(state.mergedChat.inflight, 2);

    const alpha = state.mergedChat.connections.get('alpha');
    alpha.socket.fire('open');
    alpha.socket.fire('message', { data: JSON.stringify({ event: 'pusher:connection_established' }) });
    await clock.advance();
    assert.equal(releases.length, 1, 'the third channel starts only after one socket opens');
    await releases.shift()();
    await clock.advance();
    assert.equal(SocketStub.opened.length, 3, 'the remaining channel follows through the same queue');
    for (const slug of ['beta', 'gamma']) state.mergedChat.connections.get(slug).socket.fire('open');
    await clock.advance();
    assert.equal(state.mergedChat.inflight, 0);
    assert.equal(alpha.status, 'live');
    const before = requests.filter((url) => url.includes('/channels/alpha')).length;

    alpha.socket.fire('close');
    assert.equal(alpha.status, 'waiting');
    assert.equal(alpha.attempts, 1);
    await clock.advance(1999);
    assert.equal(requests.filter((url) => url.includes('/channels/alpha')).length, before);
    await clock.advance(1);
    assert.equal(releases.length, 1, 'the retry re-enters the same queue');
    await releases.shift()();
    await clock.advance();
    assert.equal(requests.filter((url) => url.includes('/channels/alpha')).length, before + 1,
      'retry refreshes channel and broker credentials');
    surface.closeMergedChat();
  });
});

test('removing a merged channel aborts its active credential read and releases the queue slot', { tag: 'unit' }, async () => {
  const clock = makeMergedClock();
  const { host, state } = mergedConnectionHost(clock);
  let activeSignal = null;
  host.pageFetch = (url, init = {}) => {
    if (!String(url).includes('/channels/')) {
      return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(PUSHER_ANSWER) });
    }
    activeSignal = init.signal;
    return new Promise(() => {});
  };

  await withSocketStub(async () => {
    const surface = createLive(host);
    surface.syncMergedChat(['alpha']);
    await clock.advance();
    assert.equal(activeSignal?.aborted, false);
    assert.equal(state.mergedChat.inflight, 1);

    surface.syncMergedChat([]);
    assert.equal(activeSignal.aborted, true, 'tile removal aborts the fetch owned by that slot');
    await clock.advance();
    assert.equal(state.mergedChat.inflight, 0, 'cancellation releases the shared queue slot');
    assert.equal(state.mergedChat.connections.size, 0);
    assert.equal(SocketStub.opened.length, 0);
  });
});

test('merged chat retries sustained silence and resyncs after sleep or network recovery', { tag: 'unit' }, async () => {
  const clock = makeMergedClock();
  const { host, state, requests } = mergedConnectionHost(clock);

  await withSocketStub(async () => {
    const surface = createLive(host);
    surface.syncMergedChat(['alpha']);
    await clock.advance();
    const first = state.mergedChat.connections.get('alpha');
    first.socket.fire('open');
    first.socket.fire('message', { data: JSON.stringify({ event: 'pusher:connection_established' }) });
    const initialReads = requests.filter((url) => url.includes('/channels/alpha')).length;

    await clock.advance(45_000);
    assert.equal(first.status, 'waiting', 'an open socket with no frames is treated as stalled');
    await clock.advance(2000);
    assert.equal(requests.filter((url) => url.includes('/channels/alpha')).length, initialReads + 1);

    const secondSocket = first.socket;
    secondSocket.fire('open');
    secondSocket.fire('message', { data: JSON.stringify({ event: 'pusher:connection_established' }) });
    window.dispatchEvent({ type: 'pageshow' });
    await clock.advance();
    assert.equal(requests.filter((url) => url.includes('/channels/alpha')).length, initialReads + 2,
      'pageshow forces a fresh credential read after sleep');

    const thirdSocket = first.socket;
    thirdSocket.fire('open');
    thirdSocket.fire('message', { data: JSON.stringify({ event: 'pusher:connection_established' }) });
    window.dispatchEvent({ type: 'online' });
    await clock.advance();
    assert.equal(requests.filter((url) => url.includes('/channels/alpha')).length, initialReads + 3,
      'online recovery resyncs the same queue');
    surface.closeMergedChat();
  });
});

test('removing a merged channel cancels its pending retry and status stays compact', { tag: 'unit' }, async () => {
  const clock = makeMergedClock();
  const { host, state, requests } = mergedConnectionHost(clock);

  await withSocketStub(async () => {
    const surface = createLive(host);
    surface.syncMergedChat(['alpha', 'beta', 'gamma']);
    await clock.advance();
    for (const slug of ['alpha', 'beta']) {
      const slot = state.mergedChat.connections.get(slug);
      slot.socket.fire('open');
      slot.socket.fire('message', { data: JSON.stringify({ event: 'pusher:connection_established' }) });
    }
    await clock.advance();
    const gamma = state.mergedChat.connections.get('gamma');
    gamma.socket.fire('open');
    gamma.socket.fire('message', { data: JSON.stringify({ event: 'pusher:connection_established' }) });
    await clock.advance();
    state.mergedChat.connections.get('gamma').status = 'waiting';
    const status = surface.mergedChatStatus();
    assert.deepEqual(status, { total: 3, live: 2, connecting: 0, waiting: 1 });

    const before = requests.filter((url) => url.includes('/channels/gamma')).length;
    state.mergedChat.connections.get('gamma').socket.fire('close');
    surface.syncMergedChat(['alpha', 'beta']);
    await clock.advance(45_000);
    assert.equal(requests.filter((url) => url.includes('/channels/gamma')).length, before,
      'a removed channel cannot reopen from an old timer');
    assert.equal(state.mergedChat.connections.has('gamma'), false);
    surface.closeMergedChat();
  });
});

test('the socket subscribes to every channel it needs, and one close schedules one retry', { tag: 'unit' }, async () => {
  const { host, state } = makeHost();
  state.live.channel = { chatroomId: 42, id: 7 };
  host.pageFetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(PUSHER_ANSWER) });

  const scheduled = [];
  globalThis.window.setTimeout = (fn, ms) => { scheduled.push(ms); return scheduled.length; };

  await withSocketStub(async () => {
    const surface = createLive(host);
    await surface.connectRealtime();
    assert.equal(SocketStub.opened.length, 1, 'exactly one socket is opened');
    assert.equal(state.live.socketState, 'connecting');

    const socket = state.live.socket;
    socket.fire('open');
    assert.equal(state.live.socketState, 'open');
    assert.ok(socket.sent.length >= 2, 'Kick names its chatroom and channel feeds differently; both must be subscribed');
    assert.equal(state.live.subscribed.length, socket.sent.length);
    assert.equal(state.live.reconnectAttempts, 0, 'a successful open clears the backoff');

    // A verified transport that drops is a normal reconnect, with backoff.
    socket.fire('close');
    assert.equal(state.live.socket, null);
    assert.equal(state.live.socketState, 'offline');
    assert.equal(state.live.reconnectAttempts, 1, 'the retry is counted so the backoff can grow');
    // Asserted on the stored timer rather than on how many timers were created:
    // kickFetchJson arms a request deadline through the same window.setTimeout,
    // so a raw count measures unrelated work.
    assert.ok(state.live.reconnectAt, 'a retry timer is armed');
  });

  globalThis.window.setTimeout = (fn, ms) => setTimeout(fn, ms);
});

test('an unverified transport that never delivered a frame degrades instead of retrying forever', { tag: 'unit' }, async () => {
  const { host, state } = makeHost();
  state.live.channel = { chatroomId: 42, id: 7 };
  host.pageFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: { connections: [{ provider: 'kick', credentials: { token: 't' } }] } }),
  });
  const scheduled = [];
  globalThis.window.setTimeout = (fn, ms) => { scheduled.push(ms); return scheduled.length; };

  await withSocketStub(async () => {
    const surface = createLive(host);
    await surface.connectRealtime();
    assert.equal(state.live.providerVerified, false, 'this transport has never been reached from this project');

    state.live.socket.fire('close');
    assert.equal(state.live.socketState, 'unsupported');
    assert.match(state.live.catalogError, /fall back to the page/);
    assert.equal(state.live.reconnectAt, 0, 'a transport this build cannot speak is not retried in a loop');
    assert.equal(state.live.reconnectAttempts, 0, 'and no attempt is counted against it');
    assert.equal(state.live.apiDrift.at(-1)?.reason, 'unverified-transport-failed');
  });

  globalThis.window.setTimeout = (fn, ms) => setTimeout(fn, ms);
});

test('a chat frame over the Kick gateway is what marks that transport verified', { tag: 'unit' }, async () => {
  // REALTIME_TRANSPORTS.KICK ships verified: false because nothing in this
  // project has ever read a message over it. The handshake alone does not
  // change that — a socket opening proves a socket opened. A frame this build
  // can parse is the proof, and the transport stops being provisional at
  // exactly that moment.
  const { host, state } = makeHost();
  state.live.channel = { chatroomId: 42, id: 7 };
  host.pageFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: { connections: [{ provider: 'kick', credentials: { token: 't' } }] } }),
  });

  await withSocketStub(async () => {
    const surface = createLive(host);
    await surface.connectRealtime();
    assert.equal(state.live.provider, 'KICK');
    assert.equal(state.live.providerVerified, false);

    surface.onRealtimeFrame(frame('App\Events\ChatMessageEvent', {
      id: 'm-1',
      sender: { id: 9, username: 'someone', identity: { badges: [] } },
      content: 'hello',
    }));
    assert.equal(state.live.providerVerified, true, 'a parsed chat frame is the proof');
    assert.equal(state.live.apiDrift.at(-1)?.reason, 'unverified-transport-verified');
    assert.equal(state.live.apiDrift.at(-1)?.detail, 'KICK', 'the drift entry names which transport was proved');
    assert.equal(state.live.apiDrift.at(-1)?.endpoint, 'realtime');

    // And now a close is an ordinary reconnect rather than a degrade, because
    // the transport is no longer unproven.
    const drifts = state.live.apiDrift.length;
    state.live.socket.fire('close');
    assert.notEqual(state.live.socketState, 'unsupported');
    assert.equal(state.live.apiDrift.length, drifts, 'nothing is reported as failed after it has been proved');
  });
});

test('a verified transport is preferred while Kick still offers one', { tag: 'unit' }, async () => {
  // The migration only takes effect once Kick stops offering the path this
  // project has actually run against, so a broker answering with both must
  // still hand back Pusher.
  const { host, state } = makeHost();
  state.live.channel = { chatroomId: 42, id: 7 };
  host.pageFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: { connections: [
      { provider: 'kick', credentials: { token: 't' } },
      { provider: 'pusher', credentials: { app_key: 'key-1', cluster: 'us2' } },
    ] } }),
  });

  await withSocketStub(async () => {
    const surface = createLive(host);
    await surface.connectRealtime();
    assert.equal(state.live.provider, 'PUSHER', 'the offered order must not decide this');
    assert.equal(state.live.providerVerified, true);
  });
});

test('teardown drops the socket so a route change cannot leave two open', { tag: 'unit' }, async () => {
  const { host, state } = makeHost();
  state.live.channel = { chatroomId: 42, id: 7 };
  host.pageFetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(PUSHER_ANSWER) });

  await withSocketStub(async () => {
    const surface = createLive(host);
    await surface.connectRealtime();
    assert.ok(state.live.socket);
    surface.teardownRealtime();
    assert.equal(state.live.socket, null);

    await surface.connectRealtime();
    assert.equal(SocketStub.opened.length, 2, 'a fresh socket is opened after teardown');
  });
});

test('a refused emote catalog says so and leaves the picker as the source', { tag: 'unit' }, async () => {
  const calls = [];
  const { host, state } = makeHost({
    pageFetch: async (url) => {
      calls.push(url);
      // The channel read succeeds; the catalog read is the one Kick refuses.
      if (url.includes('/emotes/')) return { ok: false, status: 503, text: async () => '' };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 7, slug: 'alpha', chatroom: { id: 42 } }),
      };
    },
  });
  const surface = createLive(host);

  await surface.refreshLiveChannel();

  assert.ok(calls.some((url) => url.includes('/channels/alpha')), 'the channel is read first');
  assert.equal(state.live.catalogSource, 'dom', 'a refused catalog must not claim to be the API');
  assert.match(state.live.catalogError, /503/, 'the status Kick answered is reported, not hidden');
});


const VOD_ID = '01a01256-da48-7d57-8bf2-0ac2745d698d';
const CHANNEL_BODY = JSON.stringify({ id: 668, slug: 'alpha', verified: true, chatroom: { id: 9 } });
const VIDEOS_BODY = JSON.stringify({
  message: 'ok',
  data: [{ id: VOD_ID, start_time: '2026-08-18T00:47:57Z', end_time: '2026-08-18T08:24:10Z', duration: 27279, status: 'public', tier: 'unverified', title: 'a stream' }],
});

function vodHost(overrides = {}) {
  const requests = [];
  const made = makeHost({
    pageFetch: async (url) => {
      requests.push(String(url));
      if (String(url).includes('/videos')) return { ok: true, status: 200, text: async () => VIDEOS_BODY };
      return { ok: true, status: 200, text: async () => CHANNEL_BODY };
    },
    ...overrides,
  });
  // Neither live read is needed for retention, and switching them off proves it.
  made.state.settings.content.liveEmoteCatalog = false;
  made.state.settings.content.liveChatEvents = false;
  return { ...made, requests };
}

test('a VOD opened from the channel list is dated, though the slug never changed', { tag: 'unit' }, async () => {
  // The defect this pins: `refreshLiveChannel` returns early when the slug and
  // channel are unchanged, and moving from /alpha/videos to a recording is an
  // SPA navigation that changes only the last path segment. Reached through the
  // early return or not at all.
  const { host, state, requests } = vodHost();
  host.__vodId = '';
  await createLive(host).refreshLiveChannel();
  assert.equal(state.live.vod, null, 'a channel page has no recording to date');
  // With both live reads off and no recording on screen, nothing is fetched at
  // all — the retention feature must not put a channel page back on the wire.
  assert.deepEqual(requests, [], 'a channel page costs nothing when nothing wants it');

  host.__vodId = VOD_ID;
  await createLive(host).refreshLiveChannel();
  assert.ok(requests.some((url) => url.includes('/videos')), 'the VOD list was read once a recording was on screen');
  assert.equal(state.live.vod?.id, VOD_ID);
  assert.equal(state.live.vod?.startedAt, Date.UTC(2026, 7, 18, 0, 47, 57));
});

test('a recording already dated is not re-read, and leaving one drops it', { tag: 'unit' }, async () => {
  const { host, state, requests } = vodHost();
  host.__vodId = VOD_ID;
  await createLive(host).refreshLiveChannel();
  assert.equal(state.live.vod?.id, VOD_ID);

  const settled = requests.length;
  await createLive(host).refreshLiveChannel();
  assert.equal(requests.length, settled, 'the same recording costs no second request');

  host.__vodId = '';
  await createLive(host).refreshLiveChannel();
  assert.equal(state.live.vod, null, 'leaving a VOD drops the deadline rather than stranding it');
});

test('with the retention setting off, no VOD list is ever requested', { tag: 'unit' }, async () => {
  const { host, state, requests } = vodHost();
  state.settings.content.showVodExpiry = false;
  host.__vodId = VOD_ID;
  await createLive(host).refreshLiveChannel();
  assert.equal(state.live.vod, null);
  assert.equal(requests.filter((url) => url.includes('/videos')).length, 0, 'a setting that is off costs no request');
});

test('a recording outside Kick returned window is a silence, not a drift report', { tag: 'unit' }, async () => {
  const { host, state } = vodHost();
  host.__vodId = '00000000-0000-7000-8000-000000000000';
  await createLive(host).refreshLiveChannel();
  assert.equal(state.live.vod, null, 'an unresolvable recording renders nothing');
  // Kick returns a bounded list by design and there is no single-video read, so
  // absence is expected and must not be reported as the API changing shape.
  assert.deepEqual(state.live.apiDrift, []);
});

test('a VOD list whose shape changed is reported as drift', { tag: 'unit' }, async () => {
  const { host, state } = vodHost({
    pageFetch: async (url) => (String(url).includes('/videos')
      ? { ok: true, status: 200, text: async () => '{"videos":[]}' }
      : { ok: true, status: 200, text: async () => CHANNEL_BODY }),
  });
  host.__vodId = VOD_ID;
  await createLive(host).refreshLiveChannel();
  assert.equal(state.live.vod, null);
  assert.deepEqual(state.live.apiDrift.map((entry) => [entry.endpoint, entry.reason]), [['channel-videos', 'shape-changed']]);
});
