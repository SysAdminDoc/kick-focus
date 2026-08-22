import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMultistream, isPlainRecord } from '../src/multistream.mjs';
import { MULTISTREAM_MAX, normalizeMultistream } from '../src/core.mjs';

/**
 * A mini-DOM, only as real as this surface needs.
 *
 * The multi-stream grid is the one place in the project where the *DOM* work is
 * the behaviour under test: which `<iframe>` survives a render decides whether a
 * stream keeps playing, and that cannot be asserted against pure functions in
 * core.mjs alone. Splitting the surface into its own module is what makes this
 * possible — the code below constructs it against a stub host and drives it, so
 * tile reuse, audio focus, suspension and the cross-tab merge are proven here
 * rather than only in the live browser gate.
 *
 * Two browser behaviours are modelled deliberately, because the code depends on
 * them: `dataset.someName` reads and writes the `data-some-name` attribute, and
 * an element's `src` property reflects its `src` attribute (the surface writes
 * one and compares the other).
 */
const camelToKebab = (name) => `data-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

function element(tag = 'div') {
  const attributes = new Map();
  const node = {
    tagName: tag.toUpperCase(),
    children: [],
    parent: null,
    hidden: false,
    textContent: '',
    innerHTML: '',
    className: '',
    title: '',
    value: '',
    disabled: false,
    isIntersecting: true,
    style: { setProperty(name, value) { this[name] = value; } },
    focus() { node.focused = true; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    // Append *moves*, as the DOM does: re-appending a tile that is already in
    // the grid must reorder it, not duplicate it.
    append(...kids) {
      for (const kid of kids) {
        kid.remove();
        kid.parent = node;
        node.children.push(kid);
      }
    },
    remove() {
      if (!node.parent) return;
      node.parent.children = node.parent.children.filter((kid) => kid !== node);
      node.parent = null;
    },
    replaceChildren() { node.children = []; },
    querySelector(selector) { return node.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) {
      const out = [];
      for (const kid of node.children) {
        if (matches(kid, selector)) out.push(kid);
        out.push(...kid.querySelectorAll(selector));
      }
      return out;
    },
  };
  // `src` reflects, the way it does on a real <iframe>: the surface assigns the
  // property when building a tile and compares the attribute when re-pointing
  // one, so a stub without reflection would report every frame as changed.
  Object.defineProperty(node, 'src', {
    get: () => node.getAttribute('src') ?? '',
    set: (value) => node.setAttribute('src', value),
    enumerable: true,
  });
  node.dataset = new Proxy({}, {
    get: (_t, key) => (typeof key === 'string' ? attributes.get(camelToKebab(key)) : undefined),
    set: (_t, key, value) => { attributes.set(camelToKebab(key), String(value)); return true; },
    has: (_t, key) => attributes.has(camelToKebab(key)),
  });
  node.__attributes = attributes;
  return node;
}

function matches(node, selector) {
  return selector.split(',').map((part) => part.trim()).some((part) => {
    const attribute = /^\[([^\]=]+)(?:="([^"]*)")?\]$/.exec(part);
    if (attribute) {
      const [, name, value] = attribute;
      if (!node.__attributes.has(name)) return false;
      return value === undefined || node.__attributes.get(name) === value;
    }
    return node.tagName === part.toUpperCase();
  });
}

function withAttribute(name, tag = 'div') {
  const node = element(tag);
  node.setAttribute(name, '');
  return node;
}

/** The settings-panel markup the surface expects to find already rendered. */
function makeShadow() {
  const backdrop = withAttribute('data-kf-multistream-backdrop');
  backdrop.hidden = true;
  const parts = {
    grid: withAttribute('data-kf-multistream-grid'),
    chat: withAttribute('data-kf-multistream-chat'),
    count: withAttribute('data-kf-multistream-count'),
    error: withAttribute('data-kf-multistream-error'),
    chatSelect: withAttribute('data-kf-multistream-chat-select', 'select'),
    pause: withAttribute('data-kf-multistream-pause', 'button'),
    mute: withAttribute('data-kf-multistream-mute', 'button'),
    layouts: withAttribute('data-kf-multistream-layouts'),
    input: withAttribute('data-kf-multistream-input', 'input'),
    presence: withAttribute('data-kf-presence-add', 'button'),
    popout: withAttribute('data-kf-multistream-popout', 'button'),
    merged: withAttribute('data-kf-multistream-merged'),
    mergedList: withAttribute('data-kf-multistream-merged-list', 'ul'),
  };
  const chatToggle = element('button');
  chatToggle.setAttribute('data-action', 'multistream-toggle-chat');
  const mergedToggle = element('button');
  mergedToggle.setAttribute('data-action', 'multistream-toggle-merged');
  backdrop.append(...Object.values(parts), chatToggle, mergedToggle);
  const shadow = element('div');
  shadow.append(backdrop);
  return { shadow, backdrop, ...parts };
}

function makeHost(overrides = {}) {
  const store = new Map();
  const calls = {
    toasts: [], announced: [], headerSyncs: 0, fetched: [], drift: [],
    focusOpener: null, focusRestored: [],
  };
  const dom = makeShadow();
  const key = 'kick-focus:multistream';
  const state = {
    shadow: dom.shadow,
    lastFocused: null,
    observers: {},
    presence: { channel: null, answers: [], offer: [] },
    settings: { content: { liveEmoteCatalog: true, liveChatEvents: false } },
    multistream: normalizeMultistream(overrides.multistream || {}),
    multistreamError: '',
    multistreamIds: new Map(),
    multistreamLive: new Map(),
    multistreamSuspended: new Set(),
    multistreamSuspensionInstalled: false,
  };
  // This tab's grid is also what it last stored, which is the state every merge
  // starts from: an unpersisted channel is one no other tab could have seen.
  store.set(key, state.multistream);
  const host = {
    state,
    gmGet: (name, fallback) => (store.has(name) ? store.get(name) : fallback),
    gmSet: (name, value) => store.set(name, value),
    MULTISTREAM_KEY: key,
    currentChannelSlug: () => host.__slug,
    // Focus bookkeeping the grid shares with the settings surface. The real
    // pair walks shadow roots; the grid only needs the opener to round-trip.
    deepActiveElement: () => calls.focusOpener,
    restoreFocus: (target) => { calls.focusRestored.push(target); return Boolean(target); },
    tr: (value) => value,
    trf: (template, values) => template.replace(/\{(\w+)\}/g, (_m, key) => String(values[key])),
    escapeHtml: (value) => String(value).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`),
    trustedHTML: (value) => value,
    // The real one prefers Element.setHTML and falls back to the policy; the
    // grid only needs the markup to land, so this writes it the plain way.
    setMarkup: (node, value) => { node.innerHTML = String(value); },
    announce: (message) => calls.announced.push(message),
    showToast: (message, isError = false, actions = []) => calls.toasts.push({ message, isError, actions }),
    syncHeaderMultiState: () => { calls.headerSyncs += 1; },
    kickFetchJson: async (url) => { calls.fetched.push(url); return { ok: false, status: 0 }; },
    recordApiDrift: (endpoint, reason) => calls.drift.push({ endpoint, reason }),
    // The merged-chat connection manager lives in live.mjs; the grid only ever
    // asks it for the current list and reads back what arrived.
    mergedChatEntries: () => host.__mergedEntries,
    syncMergedChat: (slugs) => { host.__mergedSynced.push([...slugs]); },
    closeMergedChat: () => { host.__mergedClosed += 1; },
    __mergedEntries: [],
    __mergedSynced: [],
    __mergedClosed: 0,
    __slug: '',
  };
  Object.assign(host, overrides.host || {});
  return { host, state, store, calls, dom };
}

/** The globals the surface reaches for directly, as the page would provide them. */
globalThis.document = {
  hidden: false,
  documentElement: { lang: 'en' },
  activeElement: null,
  createElement: (tag) => element(tag),
  addEventListener(type, handler) { (this.__listeners[type] ||= []).push(handler); },
  __listeners: {},
};
globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {
  __storage: [],
  addEventListener(type, handler) { if (type === 'storage') globalThis.window.__storage.push(handler); },
};
globalThis.IntersectionObserver = class {
  constructor(callback, options) { this.callback = callback; this.options = options; this.observed = []; }
  observe(node) { this.observed.push(node); }
  disconnect() { this.observed = []; }
};
/**
 * Node ships a real `BroadcastChannel`, and the surface feature-detects it — so
 * without this stub the roll-call opens a genuine channel whose handle keeps the
 * event loop alive and the test process never exits. Stubbing it is also what
 * makes the wire format assertable.
 */
const channels = [];
globalThis.BroadcastChannel = class {
  constructor(name) {
    this.name = name;
    this.posted = [];
    this.listener = null;
    channels.push(this);
  }
  addEventListener(_type, handler) { this.listener = handler; }
  postMessage(message) { this.posted.push(message); }
  close() {}
};

const framesIn = (grid) => grid.querySelectorAll('[data-kf-multistream-tile]')
  .map((tile) => ({ slug: tile.dataset.kfMultistreamTile, frame: tile.querySelector('iframe'), tile }));

test('every function the surface hands back can be called against a stub host', { tag: 'unit' }, async () => {
  // The point of the host boundary: a dependency the module forgot to take
  // would resolve out of the bundle scope in the artifact and be invisible,
  // but throws a ReferenceError here. Calling all fifteen is the check.
  const { host, dom } = makeHost({ multistream: { streams: ['alpha'], focus: 'alpha' } });
  const surface = createMultistream(host);
  assert.equal(Object.keys(surface).length, 25);

  dom.backdrop.hidden = false;
  for (const [name, fn] of Object.entries(surface)) {
    assert.equal(typeof fn, 'function', `${name} is callable`);
    await fn(name === 'addMultistream' ? 'beta' : undefined);
  }
});

test('a tile that is still wanted keeps the exact iframe it already had', { tag: 'unit' }, () => {
  const { host, state, dom } = makeHost({ multistream: { streams: ['alpha', 'beta'], focus: 'alpha' } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  surface.renderMultistream();

  const before = framesIn(dom.grid);
  assert.deepEqual(before.map((entry) => entry.slug), ['alpha', 'beta']);

  // A third channel arrives. Replacing an <iframe> restarts its stream, so the
  // two already playing must survive as the same element objects.
  state.multistream = normalizeMultistream({ ...state.multistream, streams: ['alpha', 'beta', 'gamma'] });
  surface.renderMultistream();

  const after = framesIn(dom.grid);
  assert.deepEqual(after.map((entry) => entry.slug), ['alpha', 'beta', 'gamma']);
  assert.equal(after[0].frame, before[0].frame, 'alpha keeps its frame');
  assert.equal(after[1].frame, before[1].frame, 'beta keeps its frame');

  // And a removal drops only the tile that went.
  state.multistream = normalizeMultistream({ ...state.multistream, streams: ['alpha', 'gamma'], focus: 'alpha' });
  surface.renderMultistream();
  const trimmed = framesIn(dom.grid);
  assert.deepEqual(trimmed.map((entry) => entry.slug), ['alpha', 'gamma']);
  assert.equal(trimmed[0].frame, before[0].frame, 'alpha survives the removal untouched');
});

test('exactly one tile carries audio, and pausing unloads every document', { tag: 'unit' }, () => {
  const { host, state, dom } = makeHost({ multistream: { streams: ['alpha', 'beta', 'gamma'], focus: 'beta' } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  surface.renderMultistream();

  const unmuted = framesIn(dom.grid).filter((entry) => entry.frame.getAttribute('src').includes('muted=false'));
  assert.deepEqual(unmuted.map((entry) => entry.slug), ['beta'], 'audio follows focus');

  // Suspending a background tile unloads it; the focused tile is exempt because
  // it is the one being listened to.
  state.multistreamSuspended.add('alpha');
  state.multistreamSuspended.add('beta');
  surface.refreshMultistreamPlayback();
  const bySlug = Object.fromEntries(framesIn(dom.grid).map((entry) => [entry.slug, entry.frame.getAttribute('src')]));
  assert.equal(bySlug.alpha, 'about:blank', 'a suspended background tile is unloaded');
  assert.ok(bySlug.beta.includes('muted=false'), 'the focused tile keeps playing and keeps the audio');

  state.multistream = normalizeMultistream({ ...state.multistream, paused: true });
  surface.refreshMultistreamPlayback();
  const sources = framesIn(dom.grid).map((entry) => entry.frame.getAttribute('src'));
  assert.deepEqual(sources, ['about:blank', 'about:blank', 'about:blank'], 'pausing stops every player');
});

test('a re-render only re-points the frames whose audio actually changed', { tag: 'unit' }, () => {
  const { host, state, dom } = makeHost({ multistream: { streams: ['alpha', 'beta'], focus: 'alpha' } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  surface.renderMultistream();

  const writes = [];
  for (const { slug, frame } of framesIn(dom.grid)) {
    const original = frame.setAttribute;
    frame.setAttribute = (name, value) => { if (name === 'src') writes.push(slug); original.call(frame, name, value); };
  }
  surface.renderMultistream();
  assert.deepEqual(writes, [], 'an unchanged grid rewrites no src, so nothing restarts');

  state.multistream = normalizeMultistream({ ...state.multistream, focus: 'beta' });
  surface.renderMultistream();
  assert.deepEqual(writes.sort(), ['alpha', 'beta'], 'moving focus touches only the two frames that swapped audio');
});

test('a commit merges with what another tab stored rather than overwriting it', { tag: 'unit' }, () => {
  const { host, state, store } = makeHost({ multistream: { streams: ['alpha'] } });
  const surface = createMultistream(host);

  // A second tab added 'beta' after this one booted.
  store.set('kick-focus:multistream', normalizeMultistream({ streams: ['alpha', 'beta'] }));
  const merged = surface.commitMultistream(['gamma']);

  assert.deepEqual([...merged.streams].sort(), ['alpha', 'beta', 'gamma'], "the other tab's channel survives");
  assert.equal(state.multistream, merged);
  assert.deepEqual([...store.get('kick-focus:multistream').streams].sort(), ['alpha', 'beta', 'gamma']);

  // Removal is applied on top of the same re-read, not against a stale view.
  store.set('kick-focus:multistream', normalizeMultistream({ streams: ['alpha', 'beta', 'gamma', 'delta'] }));
  const after = surface.commitMultistream([], ['beta']);
  assert.deepEqual([...after.streams].sort(), ['alpha', 'delta', 'gamma']);
});

test('the roll-call answers with a slug only from a channel page, and offers what is missing', { tag: 'unit' }, () => {
  const { host, state, dom } = makeHost({ multistream: { streams: ['alpha'] } });
  const surface = createMultistream(host);

  host.__slug = '';
  surface.multistreamPresenceChannel();
  const channel = channels.at(-1);
  assert.equal(channel.name, 'kick-focus:presence');
  const { posted } = channel;
  const listener = channel.listener;
  listener({ data: { type: 'who', ts: Date.now() } });
  assert.deepEqual(posted, [], 'a tab that is not on a channel has nothing to report');

  host.__slug = 'zeta';
  listener({ data: { type: 'who', ts: Date.now() } });
  assert.deepEqual(posted.map((message) => message.slug), ['zeta'], 'only the slug goes on the wire');
  assert.deepEqual(Object.keys(posted[0]).sort(), ['slug', 'ts', 'type']);

  // Answers from other tabs become the offer, minus what is already in the grid.
  surface.requestMultistreamPresence();
  const now = Date.now();
  listener({ data: { type: 'here', slug: 'beta', ts: now } });
  listener({ data: { type: 'here', slug: 'alpha', ts: now } });
  listener({ data: { type: 'here', slug: 'beta', ts: now } });
  assert.deepEqual(state.presence.offer, ['beta'], 'already-present and duplicate answers drop out');
  assert.equal(dom.presence.hidden, false);
  assert.equal(dom.presence.textContent, 'Add open tabs (1)');

  // A malformed frame is ignored rather than trusted.
  listener({ data: 'not-a-record' });
  listener({ data: { type: 'here', slug: '../evil', ts: now } });
  assert.deepEqual(state.presence.offer, ['beta']);

  surface.addPresenceOffer();
  assert.deepEqual([...state.multistream.streams].sort(), ['alpha', 'beta']);
});

test('the header toggle adds, removes, and offers an undo for each', { tag: 'unit' }, () => {
  const { host, state, calls } = makeHost();
  const surface = createMultistream(host);
  host.__slug = 'alpha';

  surface.toggleCurrentChannelInMulti();
  assert.deepEqual(state.multistream.streams, ['alpha']);
  assert.equal(calls.headerSyncs, 1);
  assert.match(calls.toasts.at(-1).message, /Added alpha \(1 of 9\)/);

  // Undo removes it again, through the same merge-write path.
  calls.toasts.at(-1).actions.find((action) => action.label === 'Undo').onClick();
  assert.deepEqual(state.multistream.streams, []);

  surface.toggleCurrentChannelInMulti();
  surface.toggleCurrentChannelInMulti();
  assert.deepEqual(state.multistream.streams, [], 'the second press removes what the first added');
  assert.match(calls.toasts.at(-1).message, /Removed alpha from Multi/);

  // A full grid refuses rather than silently dropping a channel.
  state.multistream = normalizeMultistream({
    streams: Array.from({ length: MULTISTREAM_MAX }, (_v, index) => `chan${index}`),
  });
  surface.toggleCurrentChannelInMulti();
  assert.equal(calls.toasts.at(-1).isError, true);
  assert.match(calls.toasts.at(-1).message, /full at 9 of 9/);

  // Off a channel page there is nothing to toggle.
  host.__slug = '';
  const before = calls.toasts.length;
  surface.toggleCurrentChannelInMulti();
  assert.equal(calls.toasts.length, before);
});

test('a typed channel is parsed, and junk is reported instead of added', { tag: 'unit' }, () => {
  const { host, state, dom } = makeHost();
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;

  surface.addMultistream('https://kick.com/alpha/videos');
  assert.deepEqual(state.multistream.streams, ['alpha'], 'a pasted URL resolves to its channel');
  assert.equal(state.multistreamError, '');

  surface.addMultistream('https://example.com/alpha');
  assert.match(state.multistreamError, /Kick channel name or a kick\.com link/);
  assert.deepEqual(state.multistream.streams, ['alpha'], 'an off-platform link adds nothing');
  assert.equal(dom.error.hidden, false);
});

test('closing the grid drops every player document', { tag: 'unit' }, () => {
  const { host, state, dom } = makeHost({ multistream: { streams: ['alpha', 'beta'], focus: 'alpha' } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  surface.renderMultistream();
  assert.equal(framesIn(dom.grid).length, 2);

  surface.closeMultistream();
  assert.equal(dom.backdrop.hidden, true);
  assert.equal(framesIn(dom.grid).length, 0, 'no iframe is left decoding behind a hidden backdrop');
  assert.equal(state.multistreamSuspended.size, 0);
  assert.equal(state.observers.multistream, null);
});

test('an add is broadcast once, and applying it twice lands in the same place', { tag: 'unit' }, () => {
  const { host: a, state: aState, store } = makeHost({ multistream: { streams: ['alpha'] } });
  const surfaceA = createMultistream(a);
  surfaceA.multistreamSyncChannel();
  const sync = channels.at(-1);
  assert.equal(sync.name, 'kick-focus:multi');

  surfaceA.commitMultistream(['beta']);
  assert.deepEqual(sync.posted, [{ type: 'converge', added: ['beta'], removed: [], ts: sync.posted[0].ts }]);

  // A second tab, sharing the same store, hears it.
  const { host: b, state: bState } = makeHost({ multistream: { streams: ['alpha'] } });
  b.gmGet = (name, fallback) => (store.has(name) ? store.get(name) : fallback);
  b.gmSet = (name, value) => store.set(name, value);
  const surfaceB = createMultistream(b);
  surfaceB.multistreamSyncChannel();
  const syncB = channels.at(-1);

  assert.equal(syncB.listener !== null, true);
  syncB.listener({ data: sync.posted[0] });
  assert.deepEqual([...bState.multistream.streams].sort(), ['alpha', 'beta']);

  // Idempotent: the same message again, and a storage event that carries no
  // message at all, both leave it exactly where it was.
  assert.equal(surfaceB.applyRemoteMultistream(['beta'], []), false, 'a repeat changes nothing');
  assert.equal(surfaceB.applyRemoteMultistream(), false);
  assert.deepEqual([...bState.multistream.streams].sort(), ['alpha', 'beta']);

  // The extension build has no shared GM store, so the same convergence has to
  // arrive through a storage event instead. It reaches the same union.
  globalThis.window.__storage.length = 0;
  surfaceB.installMultistreamStorageSync();
  const onStorage = globalThis.window.__storage.at(-1);
  store.set('kick-focus:multistream', normalizeMultistream({ streams: ['alpha', 'beta', 'delta'] }));
  onStorage({ key: 'unrelated' });
  assert.deepEqual([...bState.multistream.streams].sort(), ['alpha', 'beta'], 'another key is not our business');
  onStorage({ key: 'kick-focus:multistream' });
  assert.deepEqual([...bState.multistream.streams].sort(), ['alpha', 'beta', 'delta']);

  // And the receiving tab never writes back, so it cannot echo.
  assert.deepEqual(syncB.posted, []);
  assert.deepEqual([...aState.multistream.streams].sort(), ['alpha', 'beta']);
});

test('a re-read on open picks up what a tab never heard broadcast', { tag: 'unit' }, () => {
  const { host, state, store, dom } = makeHost({ multistream: { streams: ['alpha'] } });
  const surface = createMultistream(host);
  surface.multistreamSyncChannel();
  const sync = channels.at(-1);

  // Another origin — a www.kick.com tab in the userscript build, sharing GM
  // storage but not this BroadcastChannel — added a channel while this tab was
  // not listening. The store is the truth, and opening re-reads it.
  store.set('kick-focus:multistream', normalizeMultistream({ streams: ['alpha', 'gamma'] }));
  surface.openMultistream();

  assert.deepEqual([...state.multistream.streams].sort(), ['alpha', 'gamma']);
  assert.deepEqual(sync.posted, [], 'a re-read is not an op and tells nobody');
  assert.equal(dom.backdrop.hidden, false);
});

test('closing the grid hands focus back to whatever opened it', { tag: 'unit' }, () => {
  // The opener used to be read with document.activeElement, which retargets to
  // the shadow host whenever focus is inside a shadow root. Every control this
  // build injects is in one, and the two hosts are a plain span and a plain
  // div, so the recorded opener could not take focus and the restore was a
  // silent no-op. The grid asks its host for the real element now.
  const { host, calls, state } = makeHost({ multistream: { streams: ['alpha'] } });
  const surface = createMultistream(host);
  const opener = { id: 'header-multi-button', focus() {}, isConnected: true };
  calls.focusOpener = opener;

  surface.openMultistream();
  assert.equal(state.multistreamOpener, opener, 'the real opener is what gets recorded');
  assert.equal(state.lastFocused, null,
    'the grid keeps its own slot, so opening it cannot overwrite where Settings has to return to');

  surface.closeMultistream();
  assert.deepEqual(calls.focusRestored, [opener], 'closing returns focus to it');
  assert.equal(state.multistreamOpener, null, 'and the slot is released');
});

test('the card chip toggles one channel and refuses a full grid', { tag: 'unit' }, () => {
  const painted = [];
  const { host, state, calls } = makeHost({ host: { syncCardMultiState: () => painted.push(true) } });
  const surface = createMultistream(host);

  const added = surface.toggleMultistreamSlug('https://kick.com/alpha/videos');
  assert.deepEqual(added, { ok: true, slug: 'alpha', added: true, streams: ['alpha'] });
  assert.equal(painted.length, 1, 'the chips repaint without waiting for an apply cycle');
  assert.equal(calls.headerSyncs, 1);

  const removed = surface.toggleMultistreamSlug('alpha');
  assert.equal(removed.added, false);
  assert.deepEqual(state.multistream.streams, []);

  assert.deepEqual(surface.toggleMultistreamSlug('https://example.com/alpha'),
    { ok: false, error: 'Enter a Kick channel name or a kick.com link.' });

  state.multistream = normalizeMultistream({
    streams: Array.from({ length: MULTISTREAM_MAX }, (_v, index) => `chan${index}`),
  });
  const full = surface.toggleMultistreamSlug('alpha');
  assert.equal(full.ok, false);
  assert.match(full.error, /full at 9 of 9/);
  // A full grid still lets you take one out.
  assert.equal(surface.toggleMultistreamSlug('chan0').added, false);
});

test('only a plain record is treated as a message payload', { tag: 'unit' }, () => {
  assert.equal(isPlainRecord({ type: 'who' }), true);
  // An array is the one that matters: it is an object, and indexing a message
  // that turned out to be a list would read undefined rather than reject.
  for (const value of [null, undefined, 'who', 42, [], ['who'], () => {}]) {
    assert.equal(isPlainRecord(value), false, `${String(value)} is not a record`);
  }
});


/** A Document Picture-in-Picture stub: a window with its own bare document. */
function makePipWindow() {
  const doc = {
    title: '',
    documentElement: { lang: '' },
    head: element('head'),
    body: element('body'),
    createElement: (tag) => element(tag),
  };
  doc.querySelector = (selector) => doc.body.querySelector(selector);
  const pip = {
    document: doc,
    closed: false,
    __listeners: {},
    addEventListener(type, handler) { (pip.__listeners[type] ||= []).push(handler); },
    close() { pip.closed = true; },
  };
  return pip;
}

async function withPip(run, { deny = false } = {}) {
  const opened = [];
  globalThis.window.documentPictureInPicture = {
    requestWindow: async () => {
      if (deny) throw new Error('denied');
      const pip = makePipWindow();
      opened.push(pip);
      return pip;
    },
  };
  try {
    return await run(opened);
  } finally {
    delete globalThis.window.documentPictureInPicture;
  }
}

const pipFrame = (pip) => pip.document.body.children.find((node) => node.tagName === 'IFRAME');
const gridFrame = (chat) => chat.children.find((node) => node.tagName === 'IFRAME');

test('without a top-layer window API the control is never offered', { tag: 'unit' }, () => {
  const { host, dom } = makeHost({ multistream: { streams: ['alpha'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  assert.equal(surface.canPopOutChat(), false);
  dom.backdrop.hidden = false;
  surface.renderMultistream();
  // Hidden rather than disabled: the grid must look exactly as it does today
  // on an engine that cannot do this at all.
  assert.equal(dom.popout.hidden, true);
  assert.equal(surface.chatPoppedOut(), false);
});

test('popping chat out gives the window its own frame and never moves the grid one', { tag: 'unit' }, async () => {
  const { host, dom } = makeHost({ multistream: { streams: ['alpha', 'beta'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  await withPip(async (opened) => {
    surface.renderMultistream();
    assert.equal(dom.popout.hidden, false, 'the control is offered where the API exists');

    const before = gridFrame(dom.chat);
    assert.ok(before, 'the grid pane has its own chat frame');

    assert.equal(await surface.popOutChat(), true);
    assert.equal(opened.length, 1);
    const pip = opened[0];

    // The window builds a frame of its own...
    const framed = pipFrame(pip);
    assert.ok(framed, 'the window carries an iframe');
    assert.equal(framed.getAttribute('src'), 'https://kick.com/popout/alpha/chat');
    assert.equal(pip.document.title, 'alpha chat');
    // ...and says the same read-only thing the in-grid pane says.
    assert.ok(pip.document.body.children.some((node) => node.tagName === 'P' && /Read-only here/.test(node.textContent)));

    // The measured trap this design exists to avoid: moving the existing frame
    // destroys its browsing context, so the grid's frame must be untouched.
    assert.equal(gridFrame(dom.chat), before, 'the grid keeps the exact frame it had');
    assert.equal(before.parent, dom.chat, 'and it was never re-parented');
    // Hidden, not emptied — that is what makes the return free.
    assert.equal(dom.backdrop.getAttribute('data-kf-multistream-chat-popped-out'), 'true');
    assert.equal(surface.chatPoppedOut(), true);
    assert.equal(dom.popout.getAttribute('aria-pressed'), 'true');
  });
});

test('the popped-out chat follows the focused tile, and only when it changed', { tag: 'unit' }, async () => {
  const { host, state, dom } = makeHost({ multistream: { streams: ['alpha', 'beta'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  await withPip(async (opened) => {
    await surface.popOutChat();
    const pip = opened[0];
    const frame = pipFrame(pip);

    // A render that changes nothing must not re-point the frame: re-assigning
    // the src it already has reloads the chat.
    surface.renderMultistream();
    assert.equal(pipFrame(pip), frame, 'the same element');
    assert.equal(frame.getAttribute('src'), 'https://kick.com/popout/alpha/chat');

    state.multistream = normalizeMultistream({ ...state.multistream, chat: 'beta' });
    surface.renderMultistream();
    assert.equal(pipFrame(pip), frame, 'still the same element, re-pointed rather than rebuilt');
    assert.equal(frame.getAttribute('src'), 'https://kick.com/popout/beta/chat');
    assert.equal(pip.document.title, 'beta chat');
  });
});

test('closing the window returns chat to the grid without losing the tile', { tag: 'unit' }, async () => {
  const { host, dom } = makeHost({ multistream: { streams: ['alpha'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  await withPip(async (opened) => {
    surface.renderMultistream();
    const before = gridFrame(dom.chat);
    await surface.popOutChat();
    const pip = opened[0];

    // The user closing the window is the ordinary path.
    for (const handler of pip.__listeners.pagehide || []) handler();
    assert.equal(surface.chatPoppedOut(), false);
    assert.equal(dom.backdrop.getAttribute('data-kf-multistream-chat-popped-out'), 'false');
    // The tile's chat is the one that was already there — no reload on return.
    assert.equal(gridFrame(dom.chat), before);
    assert.equal(dom.popout.getAttribute('aria-pressed'), 'false');

    // And the control opens again rather than being one-way.
    assert.equal(await surface.popOutChat(), true);
    assert.equal(opened.length, 2);
  });
});

test('a refused window changes nothing and says so', { tag: 'unit' }, async () => {
  const { host, dom, calls } = makeHost({ multistream: { streams: ['alpha'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  await withPip(async () => {
    surface.renderMultistream();
    const before = gridFrame(dom.chat);
    assert.equal(await surface.popOutChat(), false);
    assert.equal(surface.chatPoppedOut(), false);
    assert.equal(gridFrame(dom.chat), before, 'the grid chat is untouched');
    assert.ok(calls.toasts.some((entry) => /pop-out chat window/.test(entry.message)));
  }, { deny: true });
});

test('the second press returns chat rather than opening another window', { tag: 'unit' }, async () => {
  const { host, dom } = makeHost({ multistream: { streams: ['alpha'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  await withPip(async (opened) => {
    await surface.popOutChat();
    assert.equal(await surface.popOutChat(), true);
    assert.equal(opened.length, 1, 'no second window');
    assert.equal(opened[0].closed, true);
    assert.equal(surface.chatPoppedOut(), false);
  });
});


test('the merged view is opt-in, and off leaves the per-tile chat alone', { tag: 'unit' }, () => {
  const { host, dom } = makeHost({ multistream: { streams: ['alpha', 'beta'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  surface.renderMultistream();
  assert.equal(surface.mergedChatOn(), false, 'off by default');
  assert.equal(dom.merged.hidden, true);
  assert.equal(dom.backdrop.getAttribute('data-kf-multistream-merged-on'), 'false');
  assert.deepEqual(host.__mergedSynced, [], 'no connection is opened while it is off');
  assert.ok(dom.chat.children.some((node) => node.tagName === 'IFRAME'), 'the per-tile chat is untouched');
});

test('switching it on opens one feed per channel and labels every line', { tag: 'unit' }, () => {
  const { host, state, dom } = makeHost({ multistream: { streams: ['alpha', 'beta'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  host.__mergedEntries = [
    { slug: 'alpha', id: '1', text: 'first', sender: 'ann', color: '#fff', at: 1 },
    { slug: 'beta', id: '2', text: 'second', sender: 'bo', color: '', at: 2 },
  ];
  state.multistream = normalizeMultistream({ ...state.multistream, mergedChat: true });
  surface.renderMultistream();

  assert.equal(surface.mergedChatOn(), true);
  assert.equal(dom.merged.hidden, false);
  // The connections asked for are exactly the grid's channels.
  assert.deepEqual(host.__mergedSynced.at(-1), ['alpha', 'beta']);
  const painted = dom.mergedList.innerHTML;
  // Arrival order, and every line says where it came from.
  assert.ok(painted.indexOf('first') < painted.indexOf('second'), 'arrival order is preserved');
  assert.match(painted, /kf-ms-merged-source">alpha</);
  assert.match(painted, /kf-ms-merged-source">beta</);
  // Read-only: no composer, no form, nothing that could send.
  assert.ok(!/<(input|textarea|form|button)/i.test(painted), 'the merged pane offers no way to send');
  surface.closeMultistream();
});

test('the merged pane replaces the per-tile chat rather than competing with it', { tag: 'unit' }, () => {
  const { host, state, dom } = makeHost({ multistream: { streams: ['alpha', 'beta'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  state.multistream = normalizeMultistream({ ...state.multistream, mergedChat: true });
  surface.renderMultistream();
  // The CSS hides the per-tile pane off this attribute; the frame stays mounted
  // so switching back costs no reload, exactly as the pop-out does.
  assert.equal(dom.backdrop.getAttribute('data-kf-multistream-merged-on'), 'true');
  assert.ok(dom.chat.children.some((node) => node.tagName === 'IFRAME'), 'the per-tile frame is kept, not torn down');
  surface.closeMultistream();
});

test('closing the grid tears down every merged connection', { tag: 'unit' }, () => {
  const { host, state, dom } = makeHost({ multistream: { streams: ['alpha', 'beta'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  state.multistream = normalizeMultistream({ ...state.multistream, mergedChat: true });
  surface.renderMultistream();
  assert.equal(host.__mergedClosed, 0);
  surface.closeMultistream();
  assert.ok(host.__mergedClosed > 0, 'the sockets go with the grid');
});

test('a channel removed from the grid stops consuming a connection', { tag: 'unit' }, () => {
  const { host, state, dom } = makeHost({ multistream: { streams: ['alpha', 'beta'], focus: 'alpha', chat: 'alpha', showChat: true } });
  const surface = createMultistream(host);
  dom.backdrop.hidden = false;
  state.multistream = normalizeMultistream({ ...state.multistream, mergedChat: true });
  surface.renderMultistream();
  assert.deepEqual(host.__mergedSynced.at(-1), ['alpha', 'beta']);

  state.multistream = normalizeMultistream({ ...state.multistream, streams: ['alpha'] });
  surface.renderMultistream();
  // The sync is what closes it: the surface asks for exactly the grid's list
  // and the connection manager drops the difference.
  assert.deepEqual(host.__mergedSynced.at(-1), ['alpha']);
  surface.closeMultistream();
});
