/**
 * What each DOM fixture is a fixture *of*, in one place.
 *
 * Three things read this and used to disagree with each other:
 *
 *  - `test/fixtures.test.js` builds a DOM from the fixture and asserts the
 *    ordered probes resolve to the hook recorded here, and that the values the
 *    runtime derives from them come out.
 *  - `scripts/capture-fixture.mjs` regenerates a fixture from the live page and
 *    refuses to write one that lost a marker.
 *  - `scripts/verify-extension.mjs` sweeps the live site route by route and
 *    compares what Kick serves today against `shell` below.
 *
 * The `shell` map is the load-bearing part. "The first probe must win" is not
 * true of Kick and never was: a channel page has no `#main-container` and
 * resolves `main` through the bare `<main>` fallback, which is fine, expected,
 * and exactly the kind of thing a gate should state out loud rather than
 * discover during an outage. So each route records *which* probe is supposed to
 * win, and drift is a change from that — in either direction. A stable id
 * coming back is as interesting as one going away.
 *
 * Every count in the notes below was measured logged out on 2026-08-19 at
 * 1440x900 against Chromium 1234.
 */

/**
 * Attribute-level markers, kept because reduction can silently drop them.
 *
 * `markers` are asserted against the fixture text and must be present on the
 * live page. `synthetic` are scaffolding the fixture invents — a fixture that
 * simulates an incoming chat sticker has to have something to click — and are
 * asserted in the file while never being expected live. `retired` are markers
 * this suite used to assert and Kick no longer serves; they stay recorded, with
 * the reason, so the next person does not re-add them from an old capture.
 */
export const FIXTURE_CONTRACT = Object.freeze({
  home: Object.freeze({
    url: 'https://kick.com/',
    keep: Object.freeze(['[data-testid="livestream-results-card"]', '[data-testid="livestream-results-card"] a[href]']),
    expectedChat: false,
    shell: Object.freeze({
      main: 'main-id',
      sidebar: 'sidebar-id',
      chatSeparator: null,
      // Home carries a chat message list without the channel chatroom id around
      // it — the featured-stream preview. The panel hook therefore resolves
      // through its third probe here and only here, which is why this is
      // written down rather than treated as a failure.
      chatPanel: 'chat-messages-owner',
      card: 'card-testid',
    }),
    derived: Object.freeze({ cardSlug: 'ok', playerContainer: 'absent', channelPlayer: 'absent', qualityHeight: 'absent' }),
    markers: Object.freeze(['id="main-container"', 'id="sidebar-wrapper"', 'livestream-results-card']),
    synthetic: Object.freeze({}),
    retired: Object.freeze({
      'data-testid="kicks-top-nav"': 'renamed: 0 live 2026-08-19, and nothing in src/ reads it',
      'channel-chatroom': 'route-shaped: only a channel page carries the chatroom id',
    }),
  }),

  browse: Object.freeze({
    url: 'https://kick.com/browse',
    keep: Object.freeze([
      '[data-testid="livestream-results-card"]',
      '[data-testid="livestream-results-card"] a[href]',
      'a[href*="/category/"]',
    ]),
    expectedChat: false,
    followingPreview: 'following-marker-control',
    shell: Object.freeze({
      main: 'main-id', sidebar: 'sidebar-id', chatSeparator: null, chatPanel: null, card: 'card-testid',
    }),
    derived: Object.freeze({ cardSlug: 'ok', playerContainer: 'absent', channelPlayer: 'absent', qualityHeight: 'absent' }),
    markers: Object.freeze(['id="main-container"', 'id="sidebar-wrapper"', 'livestream-results-card', '/category/slots']),
    synthetic: Object.freeze({}),
    retired: Object.freeze({
      'Resize chatroom': 'renamed: 0 live 2026-08-19; browse serves no chat separator at all now',
    }),
  }),

  category: Object.freeze({
    url: 'https://kick.com/category/just-chatting',
    keep: Object.freeze([
      '[data-testid="livestream-results-card"]',
      '[data-testid="livestream-results-card"] a[href]',
      'a[href*="/category/"]',
    ]),
    expectedChat: false,
    shell: Object.freeze({
      main: 'main-id', sidebar: 'sidebar-id', chatSeparator: null, chatPanel: null, card: 'card-testid',
    }),
    derived: Object.freeze({ cardSlug: 'ok', playerContainer: 'absent', channelPlayer: 'absent', qualityHeight: 'absent' }),
    markers: Object.freeze(['id="main-container"', 'id="sidebar-wrapper"', 'livestream-results-card', 'category/just-chatting']),
    synthetic: Object.freeze({}),
    retired: Object.freeze({}),
  }),

  search: Object.freeze({
    url: 'https://kick.com/search?query=kick',
    keep: Object.freeze([
      '[data-testid="search"]',
      '[data-testid="livestream-results-card"]',
      '[data-testid="livestream-results-card"] a[href]',
    ]),
    expectedChat: false,
    shell: Object.freeze({
      main: 'main-id', sidebar: 'sidebar-id', chatSeparator: null, chatPanel: null, card: 'card-testid',
    }),
    derived: Object.freeze({ cardSlug: 'ok', playerContainer: 'absent', channelPlayer: 'absent', qualityHeight: 'absent' }),
    markers: Object.freeze(['id="main-container"', 'id="sidebar-wrapper"', 'data-testid="search"', 'livestream-results-card']),
    synthetic: Object.freeze({}),
    retired: Object.freeze({
      'search-results': 'renamed: 0 live 2026-08-19; results render as ordinary stream cards',
    }),
  }),

  channel: Object.freeze({
    url: 'https://kick.com/xqc',
    keep: Object.freeze([
      '#channel-chatroom',
      '[role="separator"][aria-valuemin]',
      'video',
    ]),
    expectedChat: true,
    shell: Object.freeze({
      // No `#main-container` on a channel — measured 0 — so the bare element is
      // the hook, and the runtime's `:is(main, #main-container)` rules already
      // assume as much. Recorded rather than required so the gate stops reading
      // as "everything is fine" on the one route where it never was.
      main: 'main-element',
      sidebar: 'sidebar-id',
      chatSeparator: 'chat-resizer-values',
      chatPanel: 'chat-panel-id',
      card: 'card-testid',
    }),
    /**
     * Hooks Kick renders on this route only sometimes.
     *
     * Measured on /xqc twice on 2026-08-21 with 12 seconds of settle: zero
     * cards of any probe shape, confirmed independently in a second browser.
     * Measured again the same day: `card-testid` present. The recommendation
     * rail a channel carries is conditional, and a contract that records one
     * fixed answer per route cannot say so — it either fails on the runs with
     * no rail or blesses a fall-through on the runs with one.
     *
     * Optional means absence is not drift. A *different* probe winning still
     * is, which is the case that matters: that is Kick dropping the test id and
     * a looser selector picking up something else.
     */
    // The separator is conditional too. One logged-out /xqc load omitted it
    // while a fresh capture minutes later served two ranged separators. Either
    // absence is valid; a different winning probe is still drift.
    optional: Object.freeze(['card', 'chatSeparator']),
    derived: Object.freeze({ cardSlug: 'absent', playerContainer: 'ok', channelPlayer: 'ok', qualityHeight: 'absent' }),
    markers: Object.freeze(['id="sidebar-wrapper"', 'channel-chatroom', 'chatroom-messages', 'aria-valuemin']),
    synthetic: Object.freeze({}),
    retired: Object.freeze({
      'id="main-container"': 'route-shaped: 0 live on a channel 2026-08-19; the channel shell uses a bare <main>',
      'data-testid="channel-player"': 'renamed: 0 live 2026-08-19; the player is found through its <video>',
    }),
  }),

  // No `url`: this one is hand-maintained. It is the same route as `channel`,
  // reduced around chat, plus scaffolding that simulates an incoming sticker —
  // and a live capture would delete exactly that scaffolding, which is the
  // whole reason the file exists.
  chat: Object.freeze({
    url: '',
    keep: Object.freeze([]),
    expectedChat: true,
    shell: Object.freeze({
      main: 'main-element',
      sidebar: 'sidebar-id',
      chatSeparator: 'chat-resizer-values',
      chatPanel: 'chat-panel-id',
      card: null,
    }),
    derived: Object.freeze({ cardSlug: 'absent', playerContainer: 'absent', channelPlayer: 'absent', qualityHeight: 'absent' }),
    markers: Object.freeze(['id="sidebar-wrapper"', 'channel-chatroom', 'chatroom-messages', 'aria-valuemin']),
    synthetic: Object.freeze({
      'fixture=/emotes/7001': 'a chat emote with a known id, so the harvest path has something to read',
      'add-chat-sticker': 'the button that simulates an incoming sticker; Kick has no such control',
    }),
    retired: Object.freeze({
      'data-testid="chat-resizer"': 'renamed: 0 live 2026-08-19; the separator is found by its aria values',
      'data-testid="chatroom"': 'renamed: 0 live 2026-08-19; the chatroom id is what Kick serves',
    }),
  }),

  // Needs a session with campaigns in it, so it cannot be captured logged out.
  drops: Object.freeze({
    url: '',
    keep: Object.freeze([]),
    expectedChat: false,
    shell: Object.freeze({
      main: 'main-element', sidebar: 'sidebar-id', chatSeparator: null, chatPanel: null, card: null,
    }),
    derived: Object.freeze({ cardSlug: 'absent', playerContainer: 'absent', channelPlayer: 'absent', qualityHeight: 'absent' }),
    markers: Object.freeze(['data-testid="sidebar-drops"', 'Drops &amp; rewards', 'data-testid="empty-state-root"', '/drops/coming-soon']),
    synthetic: Object.freeze({}),
    retired: Object.freeze({}),
  }),

  // The emote picker has to be open, which needs a session. The reduced fixture
  // keeps the surrounding channel composer so placement and the full click
  // journey can be checked without carrying another signed-in page capture.
  'sticker-scroll': Object.freeze({
    url: '',
    keep: Object.freeze([]),
    expectedChat: true,
    shell: null,
    derived: null,
    markers: Object.freeze([
      'chat-emotes-picker-panel', 'data-testid="sticker-scroll"', 'data-testid="native-sticker-shell"',
      'data-testid="native-sticker-list"', 'data-testid="chat-input"', 'data-testid="chat-send"', 'dataset.emoteId', 'overflow-y-auto',
    ]),
    synthetic: Object.freeze({
      'dataset.emoteId': 'the panel is driven by a script in the fixture, which reads the id off the button',
    }),
    retired: Object.freeze({}),
  }),
});

/** Fixtures a logged-out capture can reach, in the order they are swept. */
export const CAPTURABLE = Object.freeze(
  Object.entries(FIXTURE_CONTRACT).filter(([, entry]) => Boolean(entry.url)).map(([name]) => name),
);

/** Everything the fixture file must contain: live markers plus its own scaffolding. */
export function requiredMarkers(name) {
  const entry = FIXTURE_CONTRACT[name];
  if (!entry) return [];
  return [...entry.markers, ...Object.keys(entry.synthetic)];
}
