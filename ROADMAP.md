# Roadmap

Updated: **2026-08-18**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next — ordered by value

1. **R-61, the reward probe's ready-claim phase is order-sensitive.** `a ready reward is claimed once` reports `clicks=0` while the phase after it reports `clicks=1` — the click lands one phase late. Seen on viewport 2 on 2026-08-18 and on viewport 1 on the next run of the same build, so it is intermittent rather than viewport-shaped, and it holds the release gate red at `release:check` while every offline gate and all 265 tests pass.
   Diagnosis so far: the probe clears `localStorage['kick-focus:reward-claims']` between phases, but that does not reset the claim scheduler's **in-memory** cooldown (the "checks at most every ten minutes" guard). Phase 2 mounts a ready dialog into a runtime that is still inside that cooldown, does nothing, and phase 3 — one cycle later — claims instead. Waiting for the dialog's enabled button before cycling was tried and did **not** help, which is consistent with the cooldown rather than a DOM race being the cause.
   What is already fixed and should not be re-done: the *countdown* phase was genuinely racy and is fixed (wait for the note text before cycling), and the schedule assertion was time-of-day dependent — capped at the nightly 20:00 rollover, so within an hour of it the countdown branch and the fallback branch are indistinguishable. That check is now split: "a reward Kick has not unlocked is never clicked" is asserted always, and the schedule half skips when the rollover is under an hour away. Both passed on both viewports twice.
   Touches: `scripts/verify-extension.mjs`
   Acceptance: The three reward phases are independent of each other's timing — each either resets the scheduler it depends on or waits for it — and the check names which phase claimed when one does not. No product code changes; this is a probe defect, and the unit tests already cover `nextRewardCheckAt` and `decideRewardClaim`.
   Complexity: M

1. **Automated Kick DOM drift snapshots — capture half.** The *detection* half shipped 2026-08-16: the live gate reads `LOCATOR_PROBES` (the ordered probes the runtime itself uses, so there is no second list to rot) and fails when a route-independent hook falls through to a fallback. It found real drift on its first run — the home page's chat preview has never carried `#channel-chatroom`, so `chatPanel` resolves via `chat-messages-owner`; that is reported, not failed, because it is route-shaped.
   What remains is the maintainer-only reducer: turn a fresh MHTML/live capture into a small sanitized fixture under `test/fixtures/`, so those hand-written shells can be regenerated instead of hand-edited. Needs its own browser session (the live gate's is not reusable as a module) and only covers routes reachable logged out — Drops and the open sticker picker need a session, so their fixtures stay hand-maintained. Raw captures stay ignored (`page_examples/`).

2. **A "my emotes" view.** v1.20.0 established that an authenticated `/emotes/{slug}` read returns every set the account owns, not just the channel being viewed — so one read on any channel is a complete personal inventory, and the library already reports the totals. What remains is the view itself: a list of what the account owns grouped by source channel, independently of where the user is standing. The *other* half of this item shipped 2026-08-18 — the colon-autocomplete now reads the reach data and no longer offers an emote Kick would refuse.

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


