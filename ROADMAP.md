# Roadmap

Updated: **2026-08-19**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next — ordered by value

1. **R-62, the fixtures assert a contract nothing checks, and some of it Kick no longer serves.** Two findings from the reducer that shipped 2026-08-19, in the order they matter.
   **(a) The fixtures have no consumer.** `test/fixtures.test.js` is the only thing that reads `test/fixtures/`, and all it does is assert that each hand-written file contains a list of substrings — a file being checked against a description of itself. No test builds a DOM from a fixture, so `compatibilitySnapshot`, `findProbe` and the derived-value expectations are never exercised offline against a realistic shell. Now that fixtures can be regenerated from the live site, they are worth something: parse each one and assert the probes resolve and the derived values come out, which is the offline half of the live drift gate.
   **(b) The drift gate only runs on one route, so route-shaped fall-throughs are invisible.** Measured live 2026-08-19 logged out: `#main-container` is **1** on home and **0** on a channel, so on every channel page `main` already resolves through a fallback and no gate has ever said so — the live drift check runs against home. Same shape for the chat hooks.
   The markers Kick no longer serves, with live counts: home `[data-testid="kicks-top-nav"]` **0**, `#channel-chatroom` **0** (route-shaped, already known); browse `Resize chatroom` **0**; search `search-results` **0**; channel `#main-container` **0**, `[data-testid="channel-player"]` **0**; chat `[data-testid="chat-resizer"]` **0**, `[data-testid="chatroom"]` **0**, `[data-testid="add-chat-sticker"]` **0**. Of these only `add-chat-sticker` is referenced **nowhere** in `src/` — the rest are live probes that have quietly fallen through to fallbacks. `fixture=/emotes/7001` is synthetic scaffolding the fixture invented and must stay.
   Touches: `test/fixtures.test.js`, `test/fixtures/*.html`, `src/compatibility.mjs`, `scripts/verify-extension.mjs`
   Acceptance: The fixtures are read by a test that actually builds a DOM from them and asserts the probes and derived values resolve, so a regenerated fixture proves something. Every marker is then either confirmed live and kept, or dropped with a one-line note saying why (route-shaped, renamed, or synthetic). The live drift gate reports fall-throughs per route rather than only for the route it happens to load. `capture-fixture.mjs` runs clean on every route it can reach.
   Complexity: M

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

## Research-Driven Additions — 2026-08-19 signed-in viewer pass

Added from the authenticated journey, competitor, accessibility, and platform research recorded in [RESEARCH.md](RESEARCH.md), run against v1.26.0. Continues the R-NN scheme from R-62. The existing “My emotes” Next item remains authoritative and is not duplicated below.

### P0 — prove signed-in behavior without capturing account data

- **R-63 — Authenticated journey evidence.** Extend the manual/live QA matrix to cover account menu, Daily Reward, Profile, Preferences, Notifications, Drops, Collectibles, and the authenticated emote catalog. Store sanitized route/selector expectations rather than screenshots or fixture text containing account identity, balances, chat, or session data. Every check is read-only and partial-data-safe. Acceptance: the release checklist names each signed-in journey, documents which checks require a user session, and proves no account mutation occurs. Complexity: M.

### P1 — coherent viewer personalization

- **R-64 — Viewer Hub.** Add a read-only, progressively enhanced summary for Daily Reward state, active-channel points, Collectibles, Drops, level, and streak. Each card has its own source, freshness, loading, unavailable, and error state; absent data is never rendered as zero. Use established same-origin reads or page-visible state only, do not add polling while the hub is closed, and do not persist level/streak merely for decoration. Acceptance: every card can fail independently, diagnostics identify DOM-derived versus API-derived values, and tests cover partial/anonymous/account-menu-closed states. Complexity: L.
- **R-66 — Signed-in route polish.** Extend route classification and shared styling to Profile/Settings, Drops, Collectibles, Subscriptions, and account-adjacent routes. Improve spacing, hierarchy, focus, empty states, and narrow-window reflow while keeping native Kick account controls visibly native. Acceptance: no native control is hidden accidentally, all seven settings tabs remain reachable, and screenshot comparison passes in every theme. Complexity: M.
- **R-67 — Picture-in-Picture and multiview points disclosure.** Wherever Kick Focus offers popout, Picture-in-Picture, mirroring, or related detached playback, explain that Kick's current help says those modes do not accrue channel points. Keep the copy contextual and non-blocking. Acceptance: disclosure is keyboard/screen-reader reachable, localized, and does not appear on unrelated player controls. Complexity: S.

### P2 — chat comfort, delight, and player utility

- **R-68 — Bounded Chat Comfort module.** Add opt-in timestamps, priority people, mention sound, local per-message hide, and searchable session history. History defaults off, excludes private/whisper content, has row/byte/age caps, exports only through an explicit action, and never retains a remote-deleted message longer than the configured session window. Acceptance: high-volume observer benchmark stays within the apply-cost budget; storage and expiry tests cover cap boundaries; each feature can be enabled independently. Complexity: L.
- **R-69 — Earned-state delight.** Add subtle reward-ready, streak, or collectible-earned treatments only when Kick exposes the real state. Reuse established icons and design tokens; provide text status; disable nonessential motion under Reduced Motion. Do not simulate rewards, randomized wins, or engagement pressure. Acceptance: no animation under Reduced Motion, no status communicated by color alone, and anonymous users see no placeholder gamification. Complexity: S.
- **R-70 — Player utility feasibility gate.** Measure screenshot capture, live-edge recovery, and adaptive catch-up against Kick's current player and existing page-realm hooks before implementing video filters, recording, or downloads. Acceptance: a short design note records browser support, DRM/canvas limits, CPU/memory impact, and whether each utility can remain local and zero-dependency; only proven low-risk utilities advance. Complexity: M.

### P3 — discovery and advanced organization

- **R-71 — Local discovery layouts.** Investigate saved, route-aware discovery views that combine existing density, hidden-channel, category, language, and watched-state controls without creating a second recommendation system. Acceptance: layouts are local, editable through existing settings patterns, and never claim to change Kick's algorithm. Complexity: L.
