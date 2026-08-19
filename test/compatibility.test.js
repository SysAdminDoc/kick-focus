import test from 'node:test';
import assert from 'node:assert/strict';
import { compatibilitySnapshot, compatibilitySummary, derivedSnapshot, DERIVED_EXPECTATIONS, findAllProbe, LOCATOR_PROBES } from '../src/compatibility.mjs';
import { HIDEABLE_ELEMENTS } from '../src/core.mjs';

class FakeNode {
  constructor({ query = {}, all = {}, parent = null } = {}) {
    this.query = new Map(Object.entries(query));
    this.all = new Map(Object.entries(all));
    this.parentElement = parent;
  }

  querySelector(selector) {
    return this.query.get(selector) || null;
  }

  querySelectorAll(selector) {
    return this.all.get(selector) || [];
  }

  closest() {
    return null;
  }

  contains(node) {
    return node === this || node?.parentElement === this;
  }
}

test('ordered compatibility probes match current and localized shell shapes', { tag: 'unit' }, () => {
  const main = new FakeNode({
    all: {
      '[data-testid="livestream-results-card"], [data-testid="stream-card"]': [new FakeNode()],
    },
  });
  const sidebar = new FakeNode();
  const separator = new FakeNode();
  const panel = new FakeNode();
  const root = new FakeNode({
    query: {
      '#main-container': main,
      '[data-kf-sidebar], [data-kick-sidebar]': sidebar,
      '[role="separator"][aria-valuemin][aria-valuemax]': separator,
      '[data-testid="chatroom"], [data-kf-chat-panel]': panel,
    },
  });

  const snapshot = compatibilitySnapshot(root, { expectedChat: true });
  assert.equal(snapshot.healthy, true);
  assert.equal(snapshot.cards, 1);
  assert.deepEqual(snapshot.missing, []);
  assert.deepEqual(snapshot.probes, {
    main: 'main-id',
    sidebar: 'sidebar-data',
    chatSeparator: 'chat-resizer-values',
    chatPanel: 'chat-panel-testid',
    card: 'card-testid',
  });
});

test('compatibility self-test is route-aware and names missing hooks', { tag: 'unit' }, () => {
  const main = new FakeNode();
  const sidebar = new FakeNode();
  const root = new FakeNode({ query: {
    '#main-container': main,
    '#sidebar-wrapper': sidebar,
  } });

  const browse = compatibilitySnapshot(root, { expectedChat: false });
  assert.equal(browse.healthy, true);

  const channel = compatibilitySnapshot(root, { expectedChat: true });
  assert.equal(channel.healthy, false);
  assert.deepEqual(channel.missing, ['chat']);
  assert.match(compatibilitySummary(channel), /missing chat/);
});

test('every hideable element names a probe that exists and is ordered', { tag: 'unit' }, () => {
  // The catalog stores a probe *name*, so a typo or a renamed hook produces a
  // switch in the settings panel that silently hides nothing at all.
  for (const entry of HIDEABLE_ELEMENTS) {
    const probes = LOCATOR_PROBES[entry.probe];
    assert.ok(Array.isArray(probes), `${entry.id} names probe ${entry.probe}, which LOCATOR_PROBES does not have`);
    assert.ok(probes.length >= 2, `${entry.probe} has no fallback; one Kick rename would end the feature`);
    const ids = probes.map((probe) => probe.id);
    assert.equal(new Set(ids).size, ids.length, `${entry.probe} repeats a probe id`);
    for (const probe of probes) assert.ok(probe.selector, `${entry.probe}/${probe.id} has no selector`);
  }
});

test('a hideable probe resolves through its ordered fallbacks', { tag: 'unit' }, () => {
  const button = new FakeNode();
  const fallback = new FakeNode();

  // Stable hook present: the first probe wins and the fallback is never read.
  const current = new FakeNode({ all: {
    '[data-testid="video-player-pip"]': [button],
    'button:has(> svg[data-ds-icon="ViewMiniplayer"])': [fallback],
  } });
  const matched = findAllProbe(current, 'playerPip');
  assert.deepEqual(matched.elements, [button]);
  assert.equal(matched.probe, 'pip-testid');

  // Kick drops the testid: the icon probe carries the feature, which is the
  // whole point of ordering them.
  const drifted = new FakeNode({ all: {
    'button:has(> svg[data-ds-icon="ViewMiniplayer"])': [fallback],
  } });
  const fellBack = findAllProbe(drifted, 'playerPip');
  assert.deepEqual(fellBack.elements, [fallback]);
  assert.equal(fellBack.probe, 'pip-icon');

  // Nothing on the route: no element, and no throw either.
  assert.deepEqual(findAllProbe(new FakeNode(), 'playerPip'), { elements: [], probe: null });
});


/** A root carrying one card, one video inside a container, and two quality rows. */
function derivedRoot() {
  const card = new FakeNode({ query: { 'a[href]': new FakeNode() } });
  const categoryCard = new FakeNode({ query: { 'a[href]': new FakeNode() } });
  const video = new FakeNode();
  const container = new FakeNode();
  video.parentElement = container;
  const rowA = new FakeNode();
  const rowB = new FakeNode();
  const root = new FakeNode({
    query: { '#main-container': new FakeNode() },
    all: {
      '[data-testid="livestream-results-card"], [data-testid="stream-card"]': [card, categoryCard],
      '[role="menuitemradio"]': [rowA, rowB],
      video: [video],
    },
  });
  // findAllProbe walks from the main element when the snapshot calls it, but
  // derivedSnapshot samples from the root it is given.
  root.all.set('[data-testid="livestream-results-card"], [data-testid="stream-card"]', [card, categoryCard]);
  return { root, card, categoryCard, video, container, rows: [rowA, rowB] };
}

test('card loading skeletons are absent, not a broken slug derivation', { tag: 'unit' }, () => {
  const skeleton = new FakeNode();
  const root = new FakeNode({
    all: { '[data-testid="livestream-results-card"], [data-testid="stream-card"]': [skeleton] },
  });
  const result = derivedSnapshot(root, { cardSlug: () => '' }).find((entry) => entry.id === 'cardSlug');
  assert.equal(result.outcome, 'absent');
  assert.equal(result.checked, 0);
});

test('a probe that resolves while its derived value does not is reported as broken', { tag: 'unit' }, () => {
  const { root, card, video, container, rows } = derivedRoot();

  const healthy = derivedSnapshot(root, {
    cardSlug: () => 'somestreamer',
    playerContainer: (node) => (node === video ? container : null),
    qualityHeight: (node) => (rows.includes(node) ? 720 : NaN),
  });
  assert.deepEqual(healthy.map((entry) => [entry.id, entry.outcome]), [
    ['cardSlug', 'ok'], ['playerContainer', 'ok'], ['qualityHeight', 'ok'],
  ]);

  // R-38's exact shape: the card resolves, the slug does not.
  const brokenSlug = derivedSnapshot(root, {
    cardSlug: () => '',
    playerContainer: () => container,
    qualityHeight: () => 720,
  });
  const slug = brokenSlug.find((entry) => entry.id === 'cardSlug');
  assert.equal(slug.outcome, 'broken');
  assert.equal(slug.probe, 'card');
  assert.equal(slug.failed, 2, 'both cards on the fixture failed');
  assert.match(slug.detail, /resolved but derived an empty string/);
});

test('a container that is the video itself is the defect, not a near miss', { tag: 'unit' }, () => {
  const { root, video, container } = derivedRoot();
  // `closest()` matches the element it starts from — the 2026-08-17 bug that
  // killed three features while every probe reported a match.
  const itself = derivedSnapshot(root, {
    cardSlug: () => 'somestreamer',
    playerContainer: (node) => node,
    qualityHeight: () => 720,
  }).find((entry) => entry.id === 'playerContainer');
  assert.equal(itself.outcome, 'broken');
  assert.match(itself.detail, /resolved but derived/);

  const ancestor = derivedSnapshot(root, {
    cardSlug: () => 'somestreamer',
    playerContainer: () => container,
    qualityHeight: () => 720,
  }).find((entry) => entry.id === 'playerContainer');
  assert.equal(ancestor.outcome, 'ok');
});

test('an implausible quality height fails, and Auto does not', { tag: 'unit' }, () => {
  const { root } = derivedRoot();
  const run = (qualityHeight) => derivedSnapshot(root, {
    cardSlug: () => 'somestreamer',
    playerContainer: (node) => node.parentElement,
    qualityHeight,
  }).find((entry) => entry.id === 'qualityHeight');

  assert.equal(run(() => 0).outcome, 'ok', 'Auto is a real answer');
  assert.equal(run(() => 1080).outcome, 'ok');
  // A label read together with its entitlement badge decodes to nonsense; that
  // is what got written into Kick's own session key once.
  assert.equal(run(() => NaN).outcome, 'broken');
  assert.equal(run(() => 12).outcome, 'broken');
  assert.equal(run(() => 99999).outcome, 'broken');
  assert.equal(run(() => '720').outcome, 'broken', 'a string is not a height');
});

test('nothing to derive from is absent, and no deriver is unchecked — neither is a defect', { tag: 'unit' }, () => {
  const empty = new FakeNode();
  const absent = derivedSnapshot(empty, { cardSlug: () => '', playerContainer: () => null, qualityHeight: () => NaN });
  assert.deepEqual([...new Set(absent.map((entry) => entry.outcome))], ['absent'],
    'a route that renders none of these must not be reported as broken');

  const unchecked = derivedSnapshot(derivedRoot().root, {});
  assert.deepEqual([...new Set(unchecked.map((entry) => entry.outcome))], ['unchecked'],
    'no deriver says nothing either way rather than quietly passing');
});

test('the summary names both the probe and the derived value', { tag: 'unit' }, () => {
  const { root, container } = derivedRoot();
  const withBreak = compatibilitySnapshot(root, {
    expectedChat: false,
    derive: { cardSlug: () => '', playerContainer: () => container, qualityHeight: () => 720 },
  });
  const withoutBreak = compatibilitySnapshot(root, {
    expectedChat: false,
    derive: { cardSlug: () => 'somestreamer', playerContainer: () => container, qualityHeight: () => 720 },
  });
  // The invariant, asserted as a comparison rather than a fixed value: `healthy`
  // has always meant "the shell hooks are present" and a broken derived value
  // must not silently redefine it.
  assert.equal(withBreak.healthy, withoutBreak.healthy);
  assert.equal(withBreak.derived.find((entry) => entry.id === 'cardSlug').outcome, 'broken');
  assert.equal(withoutBreak.derived.find((entry) => entry.id === 'cardSlug').outcome, 'ok');
  const snapshot = withBreak;
  const summary = compatibilitySummary(snapshot);
  assert.match(summary, /card resolved but a card yields a channel slug failed/);
});

test('every declared expectation names a probe and can judge', { tag: 'unit' }, () => {
  assert.ok(DERIVED_EXPECTATIONS.length >= 3);
  for (const expectation of DERIVED_EXPECTATIONS) {
    assert.ok(expectation.id && expectation.probe && expectation.claim, 'an expectation must say what it checks');
    assert.equal(typeof expectation.sample, 'function');
    assert.equal(typeof expectation.judge, 'function');
  }
});


test('a category card yielding no channel slug is normal, not drift', { tag: 'unit' }, () => {
  const { root, card, container } = derivedRoot();
  // A discovery page mixes channel cards with category cards, and
  // `cardSlugFromPath` returns '' for a category on purpose. Only a clean
  // sweep is the defect R-38 actually was.
  const mixed = derivedSnapshot(root, {
    cardSlug: (node) => (node === card ? 'somestreamer' : ''),
    playerContainer: () => container,
    qualityHeight: () => 720,
  }).find((entry) => entry.id === 'cardSlug');
  assert.equal(mixed.outcome, 'ok');
  assert.equal(mixed.failed, 1);
  assert.match(mixed.detail, /1 legitimately yielded nothing/);

  const sweep = derivedSnapshot(root, {
    cardSlug: () => '',
    playerContainer: () => container,
    qualityHeight: () => 720,
  }).find((entry) => entry.id === 'cardSlug');
  assert.equal(sweep.outcome, 'broken', 'every card failing is the defect');
  assert.equal(sweep.failed, 2);
});

test('a single bad player container is broken even among many', { tag: 'unit' }, () => {
  const { root } = derivedRoot();
  // Unlike cards, there is no legitimate reason for a container to be the
  // video, so this expectation tolerates nothing.
  const entry = derivedSnapshot(root, {
    cardSlug: () => 'somestreamer',
    playerContainer: (node) => node,
    qualityHeight: () => 720,
  }).find((entry) => entry.id === 'playerContainer');
  assert.equal(entry.outcome, 'broken');
});
