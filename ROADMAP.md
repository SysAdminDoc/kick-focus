# Roadmap

Updated: **2026-08-22**

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

R-62 through R-71 from that pass are no longer listed here: they shipped from v1.27.0 through v1.29.0 or were closed in RESEARCH.md (R-70). Auto-update, signed-in live gate, SSAI scrub, predictions payload, keyboard emote completion, and first-run tour remain in [Roadmap_Blocked.md](Roadmap_Blocked.md).

## Research-Driven Additions, 2026-08-20 (v1.31.0 pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md), run against v1.31.0. Continues the R-NN scheme from R-71.

### P0

### P1

### P2

### P3
