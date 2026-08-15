import test from 'node:test';
import assert from 'node:assert/strict';
import { compatibilitySnapshot, compatibilitySummary } from '../src/compatibility.mjs';

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

test('ordered compatibility probes match current and localized shell shapes', () => {
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

test('compatibility self-test is route-aware and names missing hooks', () => {
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
