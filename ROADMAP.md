# Roadmap

Updated: **2026-08-18**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next — ordered by value

1. **Automated Kick DOM drift snapshots — capture half.** The *detection* half shipped 2026-08-16: the live gate reads `LOCATOR_PROBES` (the ordered probes the runtime itself uses, so there is no second list to rot) and fails when a route-independent hook falls through to a fallback. It found real drift on its first run — the home page's chat preview has never carried `#channel-chatroom`, so `chatPanel` resolves via `chat-messages-owner`; that is reported, not failed, because it is route-shaped.
   What remains is the maintainer-only reducer: turn a fresh MHTML/live capture into a small sanitized fixture under `test/fixtures/`, so those hand-written shells can be regenerated instead of hand-edited. Needs its own browser session (the live gate's is not reusable as a module) and only covers routes reachable logged out — Drops and the open sticker picker need a session, so their fixtures stay hand-maintained. Raw captures stay ignored (`page_examples/`).

2. **Use the account catalog beyond the current channel.** v1.20.0 established that an authenticated `/emotes/{slug}` read returns every set the account owns, not just the channel being viewed — so one read on any channel is a complete personal inventory. The library now reports the totals. What is not built yet: a "my emotes" view that lists them by source channel independently of where you are standing, and using the same answer to stop the colon-autocomplete from offering an emote that will bounce with `SUBSCRIBERS_ONLY_EMOTE_ERROR` or `FOREIGN_CHANNEL_EMOTE_ERROR`. The reach data is already on each record (`usableEverywhere` / `usableHere`); the suggestion ranker does not read it.

3. **A live-gate pass that runs signed in.** Everything entitlement-related is unit-tested against captured shapes and was measured by hand against a real account, but the live gate runs anonymous, so no automated check exercises the authenticated catalog, `/me`, or the collectibles read that the bearer fix repaired. This needs an operator decision about credentials in a test run before it can be built — see [Roadmap_Blocked.md](Roadmap_Blocked.md), which has carried the same blocker since 2026-08-15 and can now name exactly what it would cover.

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

## Research-Driven Additions — differential pass

Added 2026-08-15 from the differential research pass recorded in [RESEARCH.md](RESEARCH.md), run against v1.5.0.

### P0

### P1

### P2

### P3

## Research-Driven Additions — 2026-08-16 (v1.9.0 pass)

Added from the exhaustive research recorded in [RESEARCH.md](RESEARCH.md), run against v1.9.0. Continues the R-NN scheme (new here — the prior sections were left empty).

Cross-references to existing "Next" items: R-01 unblocks Next items 1, 4, and 5 (all need a real browser); R-09 supersedes Next item 2 (see inline note there); R-14 pairs with Next item 4. New selector dependencies added by R-06/R-07/R-16/R-19 (chat container, header control, discovery cards) should be registered with Next item 3's DOM-drift snapshots as they land.
Previously-blocked items now actionable: telemetry contradiction (R-08 — external evidence now stands in for the multi-hour measurement), stitched-ad observability (R-09 — via the player-events path, not the worker wrapper).

### P0 — data safety, security, correctness, and the single unblock

### P1 — operator demand first, then trust / reliability / accessibility

### P2 — quick wins, operator second-wave, platform modernization, dev-experience

### P3 — differentiators, larger bets, future-proofing

## Research-Driven Additions — 2026-08-17 (v1.20.0 pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md), run against v1.20.0. Continues the R-NN scheme from R-37.

Cross-references to existing work: R-56's derived-value assertions belong with "Next" item 1's fixture reducer and should land together, not beside each other. Nothing here covers autocomplete reach filtering — that is "Next" item 2 and stays there. R-45 and R-46 are the unblocks for two [Roadmap_Blocked.md](Roadmap_Blocked.md) items whose stated blockers have expired (the repo is public; Firefox 153 is installed); on completion, delete those entries from that file rather than leaving them recorded as blocked.

### P1 — trust, accessibility, and two expired blockers

### P2 — quick wins, then the 2026 platform

### P3 — differentiators and future-proofing

- [ ] P3 — R-54, pop the grid's chat out into a real always-on-top window
  Why: Document Picture-in-Picture became cross-engine in 2026, and an always-on-top window rendering arbitrary DOM is the first genuinely new capability available to a multi-stream mod since the Navigation API. The nearest rival moved multi-view past tiles to unified chat and PiP; this answers it on-origin, with Kick's own embeds, and with no new permission.
  Evidence: Document PiP — Chrome 116, Firefox 151 (2026-05-19 release notes: "allows web pages to place content in an always-on-top popup"), not in Safari. No `documentPictureInPicture` anywhere in `src/`. `src/multistream.mjs` already owns tile lifecycle and the single-audio-owner invariant behind a `host` factory.
  **Measured on live Kick in Chrome 151, 2026-08-18 — do not design around moving the existing iframe.** `documentPictureInPicture` is present and `requestWindow()` resolves under a user gesture. But appending an existing `<iframe>` into the PiP document **destroys and reloads its browsing context**: a same-origin frame carrying `window.__marker` read back `{}` immediately after the move, and moving it *back* produced a **different** marker with `loads: 1` — a second fresh document. So a move costs two reloads per pop-out/pop-in cycle, and the grid's chat would lose its connection and scrollback both ways.
  **The design this implies:** leave the grid's chat iframe where it is (hidden while popped out) and give the PiP window its **own** iframe pointed at the same Kick popout-chat URL. That is exactly one extra chat load on pop-out and **none** on return, which is strictly better than moving and also makes "closing the window returns it to the grid without losing the tile" trivially true. Note the PiP document starts with no styles — stylesheets must be copied or adopted into it — and `requestWindow()` requires transient activation, so the live gate must drive a real click (`Input.dispatchMouseEvent`) rather than call it from an evaluate.
  Touches: `src/multistream.mjs`, `src/runtime.js`, `src/core.mjs`, `test/multistream.test.js`, `scripts/verify-extension.mjs`
  Acceptance: Gated behind `'documentPictureInPicture' in window` and off by default; the popped-out chat is the focused tile's, follows focus changes, and closing the window returns it to the grid without losing the tile; exactly one tile still owns audio; the grid behaves as it does today on an engine without the API.
  Complexity: L

- [ ] P3 — R-55, bring the four loyalty systems into one view
  Why: Drops, Daily Rewards, Kick Levels and Channel Points are four disconnected progressions Kick never presents together, and the dominant Drops complaint is simply "did my watch time count and did the claim land". The mod already owns the reward-claim schedule, so the state is half-collected.
  Evidence: help.kick.com/en/articles/15715119 (Daily Rewards: at least 1h/day cumulative across channels, resets daily), /15332522 (Levels: passive, global, off by default, progress reset at launch), /11033027 (Channel Points), about.kick.com Drops campaign pages; Facepunch's support article documents claims taking up to 10 minutes and needing a "Check For Missing Drops" button. Kick Focus already reads the reward countdown and the 20:00 rollover (`src/core.mjs:600`).
  Touches: `src/live.mjs`, `src/runtime.js` (Content & Ads page), `src/core.mjs`, `test/core.test.js`
  Acceptance: One panel shows daily watch progress toward the reward, whether it is unclaimed, global level progress, and per-channel points for the current channel, each reading only endpoints the page already calls and each degrading to nothing when its source is unavailable; nothing claims, spends or votes beyond the existing opt-in reward claim. The Drops half stays out until the authenticated-session blocker clears.
  Complexity: L

## Research-Driven Additions — 2026-08-18 (re-verification pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md), run against an unchanged v1.20.0. Continues the R-NN scheme from R-57.

Two existing items were **edited in place rather than duplicated**: R-38's premise was invalidated and rewritten (the card-actions defect it described does not exist), and R-48 gained FrankerFaceZ's concrete search design so it needs no further research. R-40's acceptance is now unblocked — `release:check` passes 55/55 at both viewports as of 2026-08-18, so nothing but R-38/R-39 stands between HEAD and a release.

### P1 — the drift gate has an API-shaped hole

- [ ] P3 — R-59, one read-only chat across every channel in the grid
  Why: The grid shows nine streams and one chat — the focused tile's — and the two closest multi-stream competitors both went past that to unified cross-channel chat. It is the single named feature gap in the surface Kick Focus otherwise leads on, and it stays inside the read-only boundary.
  Evidence: Kickplex (CWS v1.1.4, 2026-06-09) ships unified tabbed chat with an emote picker and recents alongside DVR rewind; streamgrids.tv keeps chat beside the active stream; viewgrid.tv runs up to 20 streams. Critically, **chat is the field's universal weak point** — there is no good Kick chat embed, so third parties fall back to an unofficial relay (`chat.kick.cx`), while Kick Focus already reads Kick's own realtime chat same-origin per channel through `src/live.mjs` (`connectRealtime` :381) and uses Kick's own popout chat on-origin. The capability is already in the building.
  Touches: `src/live.mjs` (multiple concurrent realtime connections), `src/multistream.mjs`, `src/runtime.js`, `src/core.mjs` (merge and ordering), `test/live.test.js`, `test/multistream.test.js`
  Acceptance: An opt-in merged view interleaves messages from every channel in the grid, each labelled with its source channel, ordered by arrival, capped so a busy grid cannot grow without bound; it is strictly read-only — no composer, no send path, consistent with `README.md:105`; connections are torn down with their tiles and a channel removed from the grid stops consuming one; the existing per-tile chat remains the default. Depends on R-47 (the realtime paths need coverage before they are asked to run nine at once).
  Complexity: L

