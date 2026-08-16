/**
 * Ordered DOM probes for Kick's shell.
 *
 * The site changes utility classes often, so the runtime should anchor on
 * stable ids and data attributes first, then use structural and accessible
 * fallbacks. React props/fibers are deliberately the last probe: they are
 * useful when Kick removes a public marker, but are not treated as a stable
 * public API.
 */

export const LOCATOR_PROBES = Object.freeze({
  main: Object.freeze([
    Object.freeze({ id: 'main-id', selector: '#main-container' }),
    Object.freeze({ id: 'main-testid', selector: '[data-testid="main-container"]' }),
    Object.freeze({ id: 'main-data', selector: '[data-kf-main], [data-kick-main]' }),
    Object.freeze({ id: 'main-element', selector: 'main' }),
  ]),
  sidebar: Object.freeze([
    Object.freeze({ id: 'sidebar-id', selector: '#sidebar-wrapper' }),
    Object.freeze({ id: 'sidebar-testid', selector: '[data-testid="sidebar-wrapper"]' }),
    Object.freeze({ id: 'sidebar-data', selector: '[data-kf-sidebar], [data-kick-sidebar]' }),
    Object.freeze({ id: 'sidebar-owner', selector: '[data-sidebar] [data-testid^="sidebar-"]' }),
  ]),
  sidebarCollapse: Object.freeze([
    Object.freeze({ id: 'sidebar-collapse-testid', selector: '[data-testid="sidebar-collapse"]' }),
    Object.freeze({ id: 'sidebar-expanded-control', selector: '[aria-controls="sidebar-wrapper"][aria-expanded="true"]' }),
    Object.freeze({ id: 'sidebar-collapse-label', selector: '[aria-label="Collapse sidebar"]' }),
  ]),
  sidebarExpand: Object.freeze([
    Object.freeze({ id: 'sidebar-expand-testid', selector: '[data-testid="sidebar-expand"]' }),
    Object.freeze({ id: 'sidebar-collapsed-control', selector: '[aria-controls="sidebar-wrapper"][aria-expanded="false"]' }),
    Object.freeze({ id: 'sidebar-expand-label', selector: '[aria-label="Expand sidebar"]' }),
  ]),
  chatSeparator: Object.freeze([
    Object.freeze({ id: 'chat-resizer-testid', selector: '[data-testid="chat-resizer"], [data-kf-chat-resizer]' }),
    Object.freeze({ id: 'chat-resizer-values', selector: '[role="separator"][aria-valuemin][aria-valuemax]' }),
    Object.freeze({ id: 'chat-resizer-label', selector: '[role="separator"][aria-label*="chat" i]' }),
  ]),
  chatPanel: Object.freeze([
    Object.freeze({ id: 'chat-panel-id', selector: '#channel-chatroom' }),
    Object.freeze({ id: 'chat-panel-testid', selector: '[data-testid="chatroom"], [data-kf-chat-panel]' }),
    Object.freeze({ id: 'chat-messages-owner', selector: '[data-testid="chatroom-messages"], #chatroom-messages' }),
  ]),
  card: Object.freeze([
    Object.freeze({ id: 'card-testid', selector: '[data-testid="livestream-results-card"], [data-testid="stream-card"]' }),
    Object.freeze({ id: 'card-group', selector: '[class*="group/card"]' }),
    Object.freeze({ id: 'card-article', selector: 'article' }),
  ]),

  // Hooks for HIDEABLE_ELEMENTS. Every one of these is route-shaped — the
  // player bar only exists on a channel and the sidebar sections only appear
  // when the account has anything in them — so the live gate reports a
  // fall-through here rather than failing on it.
  //
  // The player bar's own buttons carry `data-testid`, which is the stable hook
  // and always the first probe. The three that do not (quality, share, report)
  // are found through `data-ds-icon`, the design system's icon name: it is
  // language-independent, unlike the `aria-label` beside it, so it keeps
  // working for a user browsing Kick in Spanish. `aria-label` is kept as the
  // last probe for the day an icon is renamed.
  playerPip: Object.freeze([
    Object.freeze({ id: 'pip-testid', selector: '[data-testid="video-player-pip"]' }),
    Object.freeze({ id: 'pip-icon', selector: 'button:has(> svg[data-ds-icon="ViewMiniplayer"])' }),
  ]),
  playerClip: Object.freeze([
    Object.freeze({ id: 'clip-testid', selector: '[data-testid="video-player-clip"]' }),
    Object.freeze({ id: 'clip-icon', selector: 'button:has(svg[data-ds-icon="Clip"])' }),
  ]),
  playerTheatre: Object.freeze([
    Object.freeze({ id: 'theatre-testid', selector: '[data-testid="video-player-theatre-mode"]' }),
    Object.freeze({ id: 'theatre-icon', selector: 'button:has(> svg[data-ds-icon="ViewTheatre"])' }),
  ]),
  playerFullscreen: Object.freeze([
    Object.freeze({ id: 'fullscreen-testid', selector: '[data-testid="video-player-fullscreen"]' }),
    Object.freeze({ id: 'fullscreen-icon', selector: 'button:has(> svg[data-ds-icon^="Fullscreen"])' }),
  ]),
  // No `data-testid` on the gear today, unlike its four neighbours, so the icon
  // name is the first probe rather than a placeholder that would report a
  // fall-through on every single run and train the gate to be ignored.
  playerQuality: Object.freeze([
    Object.freeze({ id: 'quality-icon', selector: 'button[aria-haspopup="menu"]:has(> svg[data-ds-icon="Settings"])' }),
    Object.freeze({ id: 'quality-label', selector: 'button[aria-haspopup="menu"][aria-label*="setting" i]' }),
  ]),
  playerVolume: Object.freeze([
    Object.freeze({ id: 'volume-group', selector: 'div[class*="group/volume"]' }),
    Object.freeze({ id: 'volume-icon-owner', selector: 'div:has(> button > svg[data-ds-icon^="Sound"])' }),
  ]),
  playerShare: Object.freeze([
    Object.freeze({ id: 'share-icon', selector: 'button:has(> svg[data-ds-icon="Share"])' }),
    Object.freeze({ id: 'share-label', selector: 'button[aria-label*="share" i]' }),
  ]),
  playerReport: Object.freeze([
    Object.freeze({ id: 'report-icon', selector: 'button:has(> svg[data-ds-icon="Report"])' }),
    Object.freeze({ id: 'report-label', selector: 'button[aria-label*="report" i]' }),
  ]),

  // The sidebar links are hidden at their list item so the row collapses
  // instead of leaving a gap. The anchor is the fallback: it is the only child
  // of an unstyled `<li>`, so hiding it alone still collapses the row.
  sidebarHome: Object.freeze([
    Object.freeze({ id: 'sidebar-home-item', selector: 'li:has(> [data-testid="sidebar-home"])' }),
    Object.freeze({ id: 'sidebar-home-link', selector: '[data-testid="sidebar-home"]' }),
  ]),
  sidebarBrowse: Object.freeze([
    Object.freeze({ id: 'sidebar-browse-item', selector: 'li:has(> [data-testid="sidebar-browse"])' }),
    Object.freeze({ id: 'sidebar-browse-link', selector: '[data-testid="sidebar-browse"]' }),
  ]),
  sidebarFollowing: Object.freeze([
    Object.freeze({ id: 'sidebar-following-item', selector: 'li:has(> [data-testid="sidebar-following"])' }),
    Object.freeze({ id: 'sidebar-following-link', selector: '[data-testid="sidebar-following"]' }),
  ]),
  sidebarDrops: Object.freeze([
    Object.freeze({ id: 'sidebar-drops-item', selector: 'li:has(> [data-testid="sidebar-drops"])' }),
    Object.freeze({ id: 'sidebar-drops-link', selector: '[data-testid="sidebar-drops"]' }),
  ]),
  // The whole section, heading icon included — hiding only the channel buttons
  // would leave a bare heart or antenna glyph floating above nothing.
  sidebarFollowedChannels: Object.freeze([
    Object.freeze({ id: 'sidebar-followed-section', selector: 'section:has([data-testid^="sidebar-following-channel-"])' }),
    Object.freeze({ id: 'sidebar-followed-buttons', selector: '[data-testid^="sidebar-following-channel-"]' }),
  ]),
  sidebarRecommendedChannels: Object.freeze([
    Object.freeze({ id: 'sidebar-recommended-section', selector: 'section:has([data-testid^="sidebar-recommended-channel-"])' }),
    Object.freeze({ id: 'sidebar-recommended-buttons', selector: '[data-testid^="sidebar-recommended-channel-"]' }),
  ]),

  // Kick's own quality menu. `[role="menuitemradio"]` is what it renders; the
  // rest are older guesses kept so a previous shell still reads.
  qualityOption: Object.freeze([
    Object.freeze({ id: 'quality-menuitemradio', selector: '[role="menuitemradio"]' }),
    Object.freeze({ id: 'quality-data', selector: '[data-quality], [data-resolution]' }),
    Object.freeze({ id: 'quality-legacy', selector: '[data-testid*="quality" i], [aria-label*="quality" i], select[data-kf-quality]' }),
  ]),
});

function asRoot(root) {
  return root && typeof root.querySelector === 'function' ? root : null;
}

function safeClosest(node, selector) {
  try {
    return node?.closest?.(selector) || null;
  } catch {
    return null;
  }
}

function reactMetadata(node) {
  if (!node || typeof Object.getOwnPropertyNames !== 'function') return [];
  const names = Object.getOwnPropertyNames(node).filter((name) => /^__react(?:Props|Fiber)\$/.test(name));
  const values = [];
  for (const name of names) {
    try {
      const value = node[name];
      if (value) values.push(value);
    } catch {
      // A framework-owned property may be a throwing getter.
    }
  }
  return values;
}

function hasReactMarker(value, marker, depth = 0) {
  if (depth > 2 || value == null) return false;
  if (typeof value === 'string') return marker.test(value);
  if (typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (marker.test(key) || hasReactMarker(child, marker, depth + 1)) return true;
  }
  return false;
}

function reactProbe(root, kind) {
  const marker = kind === 'chat' ? /chat|message|room/i : /sidebar|navigation|discovery/i;
  let candidates = [];
  try {
    candidates = [...root.querySelectorAll('*')];
  } catch {
    return null;
  }
  for (const node of candidates) {
    if (!reactMetadata(node).some((value) => hasReactMarker(value, marker))) continue;
    if (kind === 'chat') {
      return safeClosest(node, '#channel-chatroom, [data-testid="chatroom"], [data-testid="chatroom-messages"]') || node;
    }
    return safeClosest(node, '#sidebar-wrapper, [data-testid="sidebar-wrapper"], [data-sidebar]') || node;
  }
  return null;
}

/** Return the first matching element and the probe that matched it. */
export function findProbe(root, name) {
  const owner = asRoot(root);
  if (!owner) return { element: null, probe: null };
  for (const probe of LOCATOR_PROBES[name] || []) {
    try {
      const element = owner.querySelector(probe.selector);
      if (!element) continue;
      if (name === 'sidebar' && probe.id === 'sidebar-owner') {
        return { element: safeClosest(element, '[data-sidebar]') || element.parentElement || element, probe: probe.id };
      }
      return { element, probe: probe.id };
    } catch {
      // A future selector must not take down the whole apply cycle.
    }
  }
  if (name === 'chatPanel') {
    const element = reactProbe(owner, 'chat');
    if (element) return { element, probe: 'react-chat-anchor' };
  }
  if (name === 'sidebar') {
    const element = reactProbe(owner, 'sidebar');
    if (element) return { element, probe: 'react-sidebar-anchor' };
  }
  return { element: null, probe: null };
}

/** Return every matching element from the first probe that finds any. */
export function findAllProbe(root, name) {
  const owner = asRoot(root);
  if (!owner) return { elements: [], probe: null };
  for (const probe of LOCATOR_PROBES[name] || []) {
    try {
      const elements = [...owner.querySelectorAll(probe.selector)];
      if (elements.length) return { elements, probe: probe.id };
    } catch {
      // Keep trying the ordered fallbacks.
    }
  }
  return { elements: [], probe: null };
}

function ownerFromChild(element, fallbackSelector) {
  return safeClosest(element, fallbackSelector) || element.parentElement || element;
}

/**
 * Snapshot the hooks the runtime depends on. `expectedChat` is route-aware so
 * a browse page without an open chat is not reported as a compatibility failure
 * while a channel page without chat is.
 */
export function compatibilitySnapshot(root, options = {}) {
  const owner = asRoot(root);
  const main = findProbe(owner, 'main');
  const sidebar = findProbe(owner, 'sidebar');
  const separator = findProbe(owner, 'chatSeparator');
  const panel = findProbe(owner, 'chatPanel');
  const cards = findAllProbe(main.element || owner, 'card');
  const expectedChat = options.expectedChat !== false;
  const required = [
    ['main', Boolean(main.element)],
    ['sidebar', Boolean(sidebar.element)],
    ...(expectedChat ? [['chat', Boolean(separator.element && panel.element)]] : []),
  ];
  return {
    healthy: required.every(([, present]) => present),
    expectedChat,
    main: Boolean(main.element),
    sidebar: Boolean(sidebar.element),
    chat: Boolean(separator.element && panel.element),
    cards: cards.elements.length,
    probes: {
      main: main.probe,
      sidebar: sidebar.probe,
      chatSeparator: separator.probe,
      chatPanel: panel.probe,
      card: cards.probe,
    },
    missing: required.filter(([, present]) => !present).map(([name]) => name),
  };
}

export function compatibilitySummary(snapshot) {
  if (!snapshot || snapshot.healthy) {
    return `Shell hooks matched${snapshot?.cards ? `; ${snapshot.cards} stream cards found` : ''}.`;
  }
  return `Compatibility needs attention: missing ${snapshot.missing.join(', ')}.`;
}
