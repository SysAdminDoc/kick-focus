# Roadmap

Updated: **2026-08-21**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next, ordered by value

## Explicitly deferred

- Full mobile-site support; the settings surface still reflows at narrow window sizes
- Publishing to a userscript catalog or extension store without explicit approval

## Research-Driven Additions

Added 2026-08-15 from the research pass recorded in [RESEARCH.md](RESEARCH.md).

### P0

### P1

### P2

### P3

### API and emote-catalog work (added 2026-08-15 from the Kick API + emote tooling research)

Gate for this whole group: do not replay private endpoints or infer entitlement. Data features read endpoints the page already calls, same-origin, inheriting the user's own session, and keep the existing DOM path as fallback. The separately documented click-to-save flow may perform Kick's normal Follow request only after a deliberate click and explicit follow-gate evidence.

## Research-Driven Additions, differential pass

Added 2026-08-15 from the differential research pass recorded in [RESEARCH.md](RESEARCH.md), run against v1.5.0.

### P0

### P1

### P2

### P3

## Research-Driven Additions, 2026-08-16 (v1.9.0 pass)

Added from the exhaustive research recorded in [RESEARCH.md](RESEARCH.md), run against v1.9.0. Continues the R-NN scheme (new here, the prior sections were left empty).

Cross-references to existing "Next" items: R-01 unblocks Next items 1, 4, and 5 (all need a real browser); R-09 supersedes Next item 2 (see inline note there); R-14 pairs with Next item 4. New selector dependencies added by R-06/R-07/R-16/R-19 (chat container, header control, discovery cards) should be registered with Next item 3's DOM-drift snapshots as they land.
Previously-blocked items now actionable: telemetry contradiction (R-08, external evidence now stands in for the multi-hour measurement), stitched-ad observability (R-09, via the player-events path, not the worker wrapper).

### P0, data safety, security, correctness, and the single unblock

### P1, operator demand first, then trust / reliability / accessibility

### P2, quick wins, operator second-wave, platform modernization, dev-experience

### P3, differentiators, larger bets, future-proofing

## Research-Driven Additions, 2026-08-17 (v1.20.0 pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md), run against v1.20.0. Continues the R-NN scheme from R-37.

Cross-references to existing work: R-56's derived-value assertions belong with "Next" item 1's fixture reducer and should land together, not beside each other. Nothing here covers autocomplete reach filtering, that is "Next" item 2 and stays there. R-45 and R-46 are the unblocks for two [Roadmap_Blocked.md](Roadmap_Blocked.md) items whose stated blockers have expired (the repo is public; Firefox 153 is installed); on completion, delete those entries from that file rather than leaving them recorded as blocked.

### P1, trust, accessibility, and two expired blockers

### P2, quick wins, then the 2026 platform

### P3, differentiators and future-proofing

## Research-Driven Additions, 2026-08-19 signed-in viewer pass

Added from the authenticated journey, competitor, accessibility, and platform research recorded in [RESEARCH.md](RESEARCH.md), run against v1.26.0. Continues the R-NN scheme from R-62. The existing “My emotes” Next item remains authoritative and is not duplicated below.

R-62 through R-71 from that pass are no longer listed here: they shipped in v1.27.0–v1.29.0 or were closed in RESEARCH.md (R-70). Auto-update, signed-in live gate, SSAI scrub, predictions payload, keyboard emote completion, and first-run tour remain in [Roadmap_Blocked.md](Roadmap_Blocked.md).

## Research-Driven Additions, 2026-08-20 (v1.31.0 pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md), run against v1.31.0. Continues the R-NN scheme from R-71.

### P0

### P1

### P2

- [ ] P2 — R-83 — Show live duration on discovery cards from data Kick already sent
  Why: sixem/kick-enhancer (v0.1.1, 2026-07-31) shows uptime without opening the stream; Kick Focus only paints uptime on the player (`showUptime`).
  Evidence: https://github.com/sixem/kick-enhancer ; `src/runtime.js` uptime chip vs card taggers.
  Touches: card tagger in `src/runtime.js`, `src/api.mjs` / `current-viewers` if that is the source the page already uses, CSS, live card-slug derived check.
  Acceptance: a live home/browse card that Kick marks LIVE shows a duration or nothing (never a guessed time); compact density still fits; 1440×900 has no card overflow.
  Complexity: M
  Note (2026-08-21, measured): the source exists and is already fetched by the page, so the endpoint half of this is settled. A home load issues `GET https://web.kick.com/api/v1/livestreams/featured?language=en` on its own (request 97 of a cold load), and the answer carries one entry per rendered card — 14 entries against 14 `livestream-results-card` nodes — each with `start_time` as an ISO UTC stamp, alongside `channel`, `category`, `viewer_count` and `thumbnail`. Nothing in the card markup carries a time: a card's only data attribute is `data-testid`, and the string `start_time` appears nowhere in the document. So the join is slug-to-slug against a read the page already makes, not a new request and not a guess. Still open: `/browse` and `/category/*` are served by different lists and were not measured, and per the acceptance a card whose start time is not in hand must show nothing rather than an estimate.
  Implementation note (2026-08-21): the passive fetch/XHR observer, bounded normalizer, exact LIVE-marker join, compact clock, cleanup, and browser geometry gate are implemented. Offline verification passes 357/357. The checkbox remains open until the 1440×900 live gate can run; outbound TCP is currently blocked machine-wide, including Kick and GitHub.

- [ ] P2 — R-78 — Extract settings UI from `runtime.js` behind a `host` factory
  Why: `src/runtime.js` is 11,566 lines and 625,776 bytes (~64% of the userscript); settings render/search/import already form a closed boundary the same way `createLive` / `createMultistream` do.
  Evidence: line counts 2026-08-20; `createLive` / `createMultistream` factory pattern in `src/live.mjs` and `src/multistream.mjs`; CLAUDE.md concat-order / unique-top-level-name rules.
  Touches: new `src/settings.mjs` (or similar), `scripts/build.mjs` concat order, `scripts/check.mjs` symbol-definition gate, `test/boot.test.js`.
  Acceptance: settings pages still render in the live gate; bundle `node --check` passes; no duplicate top-level names; `runtime.js` loses the `render*Page` / `NAV_ITEMS` block rather than gaining a wrapper.
  Complexity: L
  Implementation note (2026-08-21): settings page composition now lives in `src/settings.mjs` behind an explicit `createSettings(host)` boundary. `runtime.js` no longer declares `NAV_ITEMS` or any top-level `render*Page` function, the build and i18n scanner cover the new module, and the offline gate passes 359/359 with 184 artifact checks and 80 red probes. The checkbox remains open until the settings-page live gate can run; outbound TCP is currently blocked machine-wide.

- [ ] P2 — R-79 — Add `layout.chat = 'left'` without breaking the theater separator
  Why: `layout.chat` only allows `right|docked|hidden` (`src/core.mjs`); 7TV #914, Left Kick, and uKick all ship chat-left, and Kick Focus just finished right-side theater geometry in v1.28.0/v1.31.0.
  Evidence: `enumValue(layout.chat, ['right', 'docked', 'hidden'])`; https://github.com/SevenTV/Extension/issues/914 ; `html[data-kf-chat="right"]` rules in `src/runtime.js` `SITE_CSS`.
  Touches: `src/core.mjs` `DEFAULT_SETTINGS` + `normalizeSettings` + `VIEWING_PRESETS`, `src/runtime.js` chat layout CSS and Layout page segmented control, i18n, `scripts/verify-extension.mjs` theater+drag probes at left.
  Acceptance: Left is selectable, persists, and is reversible; theater still keeps player+chat in viewport; separator drag 320–520 px updates both layers; 1440×900 live theater check passes with chat on the left.
  Complexity: L
  Implementation note (2026-08-21): Left is a normalized, persisted Layout option with Spanish and Portuguese labels. The chat owner moves before the player, its split reverses so the separator stays on the player-facing edge, and shared drag math grows the column in the correct direction on either side while preserving the 320–520 px bounds. The live probe now selects Left through the UI, checks persistence, Theater containment, both rendered chat layers, drag state, and reversal to Right. Offline verification passes 360/360 with 185 artifact checks and 80 red probes. The checkbox remains open until the 1440×900 live gate can run; outbound TCP is currently blocked machine-wide.

### P3

- [ ] P3 — R-86 — Local last-N own composer recall on Shift+Up
  Why: Greasy Fork “Kick Chat History” (2026-08-04) stores the last five *sent* messages and leaves Kick’s ArrowUp alone; Kick Focus session search is incoming-only and off by default.
  Evidence: https://greasyfork.org/en/scripts/by-site/kick.com?sort=total_installs (Kick Chat History); `content.chatHistory` in `src/core.mjs`.
  Touches: `src/runtime.js` composer hooks, a small in-memory ring of this tab’s own sends, i18n, a setting default off.
  Acceptance: Shift+Up cycles only messages this tab sent; whispers are excluded; reload clears the ring; Kick’s ArrowUp is not captured; nothing is written to disk.
  Complexity: M

- [ ] P3 — R-87 — Following-rail hover preview from Kick’s own thumbnail
  Why: a Greasy Fork script dated 2026-08-09/11 and Mo'Kick both advertise sidebar hover previews; Kick Focus already has card chips and rail hide toggles but no preview.
  Evidence: Greasy Fork Kick Sidebar Stream Thumbnail Preview; Mo'Kick CWS feature list.
  Touches: sidebar tagging in `src/runtime.js`, CSS, Reduced Motion (static frame), live skip when the rail is hidden.
  Acceptance: hovering a followed-rail row shows a preview that stays on-screen; keyboard focus can open and Escape closes it; `prefers-reduced-motion` uses a still thumb; no extra Kick permission.
  Complexity: M

- [ ] P3 — R-88 — Local session watch-time on the Viewer page, labelled as local
  Why: Kick Augmenter and Enhancer both ship watch-time; Kick Levels remain unreadable without the reward dialog, and a local counter must not be presented as Kick’s level.
  Evidence: Kick Augmenter CWS; enhancer.at Kick features; `VIEWER_HUB_REASONS.dialog-closed` in `src/core.mjs`.
  Touches: `src/core.mjs` Viewer Hub card registry, `src/runtime.js`, i18n.
  Acceptance: the card says it is this browser session’s timer; it resets on reload; it never writes a Kick level; signed-out still explains itself.
  Complexity: S
