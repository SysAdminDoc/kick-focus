# Roadmap

Updated: **2026-08-18**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next — ordered by value

1. **R-62, the fixtures assert a Kick shell contract that live Kick no longer serves.** The reducer that shipped 2026-08-19 (`node scripts/capture-fixture.mjs`) compares each fixture's markers against the live page, and found that `test/fixtures.test.js` is green while asserting markup Kick has stopped emitting. Measured on live Kick 2026-08-19, logged out, with the count from a direct `querySelectorAll`:
   - **home** — `[data-testid="kicks-top-nav"]` **0**; `#channel-chatroom` **0** (already known to be route-shaped: home's chat preview never carried it).
   - **browse** — `Resize chatroom` **0** (the resizer's aria-label is worded differently or gone).
   - **search** — `search-results` **0**, while `[data-testid="search"]` is **2**.
   - **channel** — `#main-container` **0** (it is **1** on home, so this is route-shaped, not a rename); `[data-testid="channel-player"]` **0**.
   - **chat** — `[data-testid="chat-resizer"]` **0**, `[data-testid="chatroom"]` **0**, `[data-testid="add-chat-sticker"]` **0**, while `[data-testid="chatroom-messages"]` is **2** and `[role="separator"][aria-valuemin]` is **2**.
   Each needs a per-marker judgement that is not mechanical, which is why this is recorded rather than fixed in the same pass: is the marker something the runtime still depends on (then `LOCATOR_PROBES` needs a new fallback and the live drift gate should be failing on it), something route-shaped (then the fixture asserting it is simply wrong), or scaffolding the hand-written fixture invented and Kick never served? `fixture=/emotes/7001` in `chat` is definitely the third — it is a synthetic emote URL, and the reducer correctly reports it as absent from the live page while it must stay in the fixture.
   Touches: `test/fixtures.test.js`, `test/fixtures/*.html`, possibly `src/compatibility.mjs`
   Acceptance: Every marker is either confirmed against live Kick and kept, or removed with a one-line note saying why (route-shaped, renamed, or synthetic). Any marker that turns out to be a hook the runtime still needs gains a `LOCATOR_PROBES` entry so the live drift gate covers it. `capture-fixture.mjs` then runs clean on every route it can reach.
   Complexity: M

2. **R-63, the fixture reducer's sibling cap can drop a marker that exists.** `SIBLING_CAP = 2` keeps the first two matches of any repeated selector, so a marker further down the list is lost — measured 2026-08-19: `/category/slots` is on the browse page **twice** and the reduction still dropped it. The script reports this correctly ("reducer dropped (the live page has these)") rather than calling it drift, so it misleads nobody, but browse cannot be regenerated until it is fixed.
   Touches: `scripts/capture-fixture.mjs`
   Acceptance: The reduction keeps whatever a marker needs — either by raising the cap for selectors whose matches differ from one another, or by adding the marker's own element to the keep set — and `capture-fixture.mjs browse` reports no dropped markers.
   Complexity: S

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


