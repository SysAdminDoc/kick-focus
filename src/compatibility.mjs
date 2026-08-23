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
  // The stable shape puts the followed-channel test id on the control. Keep
  // wrapper and owner shapes as ordered fallbacks so a markup change becomes
  // visible without turning an unrelated sidebar control into a preview target.
  followingPreviewControl: Object.freeze([
    Object.freeze({
      id: 'following-marker-control',
      selector: 'a[data-testid^="sidebar-following-channel-"][href], button[data-testid^="sidebar-following-channel-"], [role="link"][data-testid^="sidebar-following-channel-"], [tabindex][data-testid^="sidebar-following-channel-"]',
    }),
    Object.freeze({
      id: 'following-descendant-link',
      selector: '[data-testid^="sidebar-following-channel-"] a[href]',
    }),
    Object.freeze({
      id: 'following-descendant-button',
      selector: '[data-testid^="sidebar-following-channel-"] button',
    }),
    Object.freeze({
      id: 'following-control-owner',
      selector: ':is(a[href], button, [role="link"], [tabindex]):has([data-testid^="sidebar-following-channel-"])',
    }),
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

/**
 * Which probe is allowed to hand a hideable control to `display: none`.
 *
 * `findAllProbe` returns the first probe that matches anything, which is right
 * for reading the shell and wrong for hiding: if Kick drops a test id, the
 * search falls through to the looser selector beside it — an icon name, an
 * `aria-label` substring — and whatever that happens to match gets hidden
 * instead. The user asked for one control to go away and a different one does,
 * with nothing anywhere saying so.
 *
 * So each hook records the probe that is actually supposed to win, and tagging
 * is skipped when a different one did. The fallbacks stay in `LOCATOR_PROBES`
 * because they are still what the live gate measures drift against; they are
 * just not licensed to hide anything until somebody records that they should.
 *
 * Every entry below is the hook's stable selector — Kick's own `data-testid`,
 * or for the four player controls that carry none, the design system's
 * language-independent `data-ds-icon`. Measured anonymously on kick.com/ and
 * kick.com/xqc, 2026-08-21: every hook that resolved at all resolved through
 * exactly this probe, on both routes. `playerReport`, `sidebarDrops` and
 * `sidebarFollowedChannels` resolved on neither, so their entry is the stable
 * selector rather than an observation — which fails closed, not open.
 *
 * A hook that legitimately resolves differently on one route belongs here as a
 * per-route exception. None does today, and inventing the shape before there is
 * a second case to put in it would be recording a guess.
 */
export const HIDEABLE_PROBE_WINNERS = Object.freeze({
  playerPip: 'pip-testid',
  playerClip: 'clip-testid',
  playerTheatre: 'theatre-testid',
  playerFullscreen: 'fullscreen-testid',
  playerQuality: 'quality-icon',
  playerVolume: 'volume-group',
  playerShare: 'share-icon',
  playerReport: 'report-icon',
  sidebarHome: 'sidebar-home-item',
  sidebarBrowse: 'sidebar-browse-item',
  sidebarFollowing: 'sidebar-following-item',
  sidebarDrops: 'sidebar-drops-item',
  sidebarFollowedChannels: 'sidebar-followed-section',
  sidebarRecommendedChannels: 'sidebar-recommended-section',
});

/**
 * The elements a hideable id may hide, which is none unless the recorded probe
 * is the one that won.
 *
 * Returns why it declined rather than an empty result, so a fall-through is
 * something the diagnostics can report instead of a feature that quietly stops
 * working.
 */
export function findHideableElements(root, name) {
  const { elements, probe } = findAllProbe(root, name);
  const recorded = HIDEABLE_PROBE_WINNERS[name] || null;
  if (!recorded) return { elements: [], probe, recorded, declined: 'unrecorded' };
  if (!probe) return { elements: [], probe, recorded, declined: 'absent' };
  if (probe !== recorded) return { elements: [], probe, recorded, declined: 'fell-through' };
  return { elements, probe, recorded, declined: '' };
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
    // Reported beside `healthy` rather than folded into it. `healthy` has always
    // meant "the shell hooks this build hangs off are present", and other code
    // and the user-facing message key off that; a derived value breaking is a
    // different and narrower statement, so it gets its own field instead of
    // changing what an existing one means.
    derived: derivedSnapshot(owner, options.derive),
  };
}

/**
 * Probes whose real product is not the element but something computed from it.
 *
 * Two whole feature classes died silently in one month, both this exact shape:
 * a probe resolved, the value derived from it did not, and every gate stayed
 * green because every gate stopped at "the hook matched". A card resolved while
 * `cardSlugFromPath` yielded nothing and three chips vanished; `closest()`
 * returned the `<video>` itself, so a container that was supposed to be an
 * ancestor was the element, and three more features vanished.
 *
 * Each entry pairs a probe with the claim the runtime actually depends on. The
 * deriver is supplied by the caller rather than imported, because these helpers
 * live in `runtime.js` — which is concatenated *after* this module — and that
 * keeps the expectations checkable offline against a fixture with stubs.
 */
export const DERIVED_EXPECTATIONS = Object.freeze([
  Object.freeze({
    id: 'cardSlug',
    probe: 'card',
    claim: 'a card yields a channel slug',
    // Loading skeletons already carry the card test id but have no destination
    // yet. They are nothing to derive from, not evidence that slug derivation
    // broke. Judge only cards whose channel/category anchor has arrived.
    sample: (owner) => findAllProbe(owner, 'card').elements.filter((card) => {
      try { return Boolean(card.matches?.('a[href]') || card.querySelector?.('a[href]')); }
      catch { return false; }
    }),
    judge: (value) => typeof value === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(value),
    // Only a clean sweep counts. A discovery page mixes channel cards with
    // category cards, and `cardSlugFromPath` returns '' for a category on
    // purpose — so "some cards yield nothing" is the normal state of the home
    // page, not drift. The defect this exists for was total: every card on the
    // page resolved and not one produced a slug, and three chips vanished.
    requireAll: false,
  }),
  Object.freeze({
    id: 'playerContainer',
    probe: 'video',
    claim: 'a player container is an ancestor, never the video element itself',
    sample: (owner) => {
      try {
        return [...owner.querySelectorAll('video')].slice(0, 1);
      } catch {
        return [];
      }
    },
    // The precise defect: `closest()` matches the element it starts from, so a
    // container that is the video is not a near miss, it is the bug.
    judge: (value, source) => Boolean(value)
      && value !== source
      && typeof value.contains === 'function'
      && value.contains(source),
  }),
  Object.freeze({
    id: 'qualityHeight',
    probe: 'qualityOption',
    claim: 'a quality row yields a plausible height',
    sample: (owner) => findAllProbe(owner, 'qualityOption').elements,
    // 0 is Auto and is a real answer. Anything outside the range of a rung a
    // player could actually offer means the label was read wrong — which is how
    // a menu badge once got glued to the rung and written to Kick's own key.
    judge: (value) => value === 0 || (Number.isFinite(value) && value >= 144 && value <= 4320),
  }),
]);

function describeDerived(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value === '' ? 'an empty string' : JSON.stringify(value.slice(0, 40));
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.tagName ? `<${String(value.tagName).toLowerCase()}>` : 'an object';
  return typeof value;
}

/**
 * Check every derived value whose deriver the caller supplied.
 *
 * Three outcomes, deliberately, and for the same reason the live gate has
 * three: `absent` means Kick rendered nothing to derive from on this route,
 * which is not a defect — only `broken` is. `unchecked` means no deriver was
 * passed, so this says nothing either way rather than quietly passing.
 */
export function derivedSnapshot(root, derive = {}) {
  const owner = asRoot(root);
  const results = [];
  for (const expectation of DERIVED_EXPECTATIONS) {
    const base = { id: expectation.id, probe: expectation.probe, claim: expectation.claim };
    const compute = derive[expectation.id];
    if (typeof compute !== 'function') {
      results.push({ ...base, outcome: 'unchecked', checked: 0, failed: 0, detail: 'no deriver supplied' });
      continue;
    }
    let sources = [];
    try {
      sources = owner ? expectation.sample(owner) : [];
    } catch {
      sources = [];
    }
    if (!sources.length) {
      results.push({ ...base, outcome: 'absent', checked: 0, failed: 0, detail: 'nothing to derive from on this route' });
      continue;
    }
    let failed = 0;
    let firstBad = '';
    for (const source of sources) {
      let value;
      try {
        value = compute(source);
      } catch {
        value = undefined;
      }
      if (expectation.judge(value, source)) continue;
      failed += 1;
      if (!firstBad) firstBad = describeDerived(value);
    }
    const requireAll = expectation.requireAll !== false;
    const broken = requireAll ? failed > 0 : failed === sources.length;
    results.push({
      ...base,
      outcome: broken ? 'broken' : 'ok',
      checked: sources.length,
      failed,
      detail: broken
        ? `${failed} of ${sources.length} resolved but derived ${firstBad}`
        : `${sources.length} checked${failed ? `, ${failed} legitimately yielded nothing` : ''}`,
    });
  }
  return results;
}

export function compatibilitySummary(snapshot) {
  const broken = (snapshot?.derived || []).filter((entry) => entry.outcome === 'broken');
  // Named by probe *and* by derived value: "card resolved, slug did not" is the
  // sentence that would have saved a research pass, and "card" alone is not.
  const derivedNote = broken.length
    ? ` ${broken.map((entry) => `${entry.probe} resolved but ${entry.claim} failed (${entry.detail})`).join('; ')}.`
    : '';
  if (!snapshot || snapshot.healthy) {
    return `Shell hooks matched${snapshot?.cards ? `; ${snapshot.cards} stream cards found` : ''}.${derivedNote}`;
  }
  return `Compatibility needs attention: missing ${snapshot.missing.join(', ')}.${derivedNote}`;
}
