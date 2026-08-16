import test from 'node:test';
import assert from 'node:assert/strict';
import { compatibilitySnapshot, compatibilitySummary, findAllProbe, LOCATOR_PROBES } from '../src/compatibility.mjs';
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
