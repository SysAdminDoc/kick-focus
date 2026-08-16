# Roadmap

Updated: **2026-08-16**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next — ordered by value

1. **Authenticated companion journey at both desktop viewports.** Load the unpacked extension in a throwaway profile that the user signs into directly, then repeat Home → Browse → Following → Drops → Search → Channel/chat at 1440×900 and 1920×1080. The isolated in-app browser supplied authenticated recon, while the extension proof used a separate logged-out profile; session data must never be exported between them.
2. **Worker-level stitched-ad observability.** Prototype a bounded `Worker`-constructor wrapper around the IVS worker and record only manifest/ad-signifier counts. Ship a mitigation only if it can separate ad media without replaying private endpoints, breaking playback, or proxying traffic. The current page-realm fetch/XHR hooks cannot see the worker-owned HLS manifest. (2026-08-15: check the cheaper question first — Chrome documents a request's initiator as the creating document's origin, so the companion's existing `initiatorDomains: ["kick.com"]` rules may already observe worker-initiated segment requests that the page realm cannot. Measure that before building the wrapper. Note also that the AdGuard "stitched-ad redirect rule" reported for 2026-08-14 **does not exist** — see Rejected Ideas in RESEARCH.md — so there is no external rule to copy.) **2026-08-16: R-09 (the page-world player-events path that would have superseded this) was live-probed and CLOSED as infeasible — Kick exposes no page-world IVS player global, instance, or hookable factory (see RESEARCH.md Open Questions #6). This worker wrapper is therefore the only remaining path, and it stays blocked and playback-critical; do not attempt it without a live harness proving it separates ad media without breaking playback.**
3. **Automated Kick DOM drift snapshots.** Add a maintainer-only reducer that turns fresh MHTML/live captures into small, sanitized fixtures and fails when stable probes disappear on Home, Browse, Following, Drops, Search, Category, Channel, or the open sticker picker. Keep raw captures ignored.
4. **Live Firefox companion proof.** Exercise the generated Manifest V2 package in a disposable Firefox profile, proving `webRequestBlocking`, page/bridge handshake, popup state, and current Kick DOM behavior. Firefox requires target and initiator host access for this API, so document the generated destination-host permissions alongside the Kick-initiator runtime guard. The initiator and promise-API popup defects are already fixed; this item is the remaining live behavioral proof.
5. **Userscript-manager cold-start matrix.** Verify current Tampermonkey and Violentmonkey injection timing, storage/export behavior, SPA navigation, and ad-defense diagnostics in isolated profiles. Manager-specific grants cannot be considered live-verified by the direct fixture bundle. (2026-08-15: Violentmonkey 2.47.0 only reached MV3 on 2026-08-06, and its release notes state `@run-at document-start` is **not** real document-start under MV3 Chromium unless "Alternative page mode" is enabled, which is off by default and advisory-limited to ~1 MB of injected script. Test that mode explicitly, both on and off.)

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

- [ ] R-19 — Per-card "+ Multi" chip on discovery surfaces + cross-tab converge + shared-link toast (operator-requested)
  Why: collect channels without opening them, converge adds across tabs, and warn when `?kf-multi=` silently overwrites a mid-collection set. (M4 chip + M5 cross-tab BroadcastChannel convergence + M7 toast; M5 alone is the heavy part.)
  Evidence: phase1b M4/M5/M7 (design-check CONFIRMED-WITH-CONDITIONS) — src/runtime.js:2628-2666,7035-7055; bridge.js:81; src/metadata.txt:10-18.
  Touches: pure `cardSlugFromPath`/`mergePresence` in core.mjs; third button in applyCardActions; BroadcastChannel('kick-focus:multi'); openSharedLayoutFromUrl toast.
  Acceptance: pure slug/merge functions in core.mjs under node:test + hover chip renders active state against state.multistream; BroadcastChannel add/remove ops are set-union idempotent with re-read-on-open covering missed broadcasts (extension builds fully supported via shared localStorage + storage events; userscript gets GM_addValueChangeListener as an ENHANCEMENT not a correctness dependency; kick.com vs www.kick.com origin split handled); shared-link boot shows an overwrite toast.
  Complexity: L

### P3 — differentiators, larger bets, future-proofing

- [ ] R-25 — Colon-trigger autocomplete popup (operator-requested)
  Why: the field-standard #1 emote feature (7TV, KickTalk, NipahTV), missing from KF.
  Evidence: phase1b E6 — Chatterino #1962/#3440 as ready tests; SevenTV ChatInput.vue; uses R-17's insertion backend.
  Touches: pure ranking in core.mjs; popup + native-suggester conflict ladder in runtime.js.
  Acceptance: pure ranking in core.mjs under node:test (prefix>substring; tiebreak favorite/per-channel-usage/global-usage/name-length; Chatterino #1962/#3440 collisions as fixtures); insertion reuses R-17's boundary — plain NAME only, never the wire token, NO auto-send ever; mouse-only click-to-accept is the shipped default — Tab/arrow/Enter capture ships ONLY on explicit operator sign-off (no-new-shortcuts rule).
  Complexity: L

- [ ] R-29 — IndexedDB provider abstraction behind one proxy
  Why: raises the library cap orders of magnitude and adds a blob store + cross-tab sync, with localStorage as the -1000 fallback.
  Evidence: twitch-mods + perf-storage streams — FFZ providers.ts (priority-scored providers, quota-exceeded event, BroadcastChannel); NipahTV Dexie schema (borrow shape only, Dexie is a DEP).
  Touches: ~150-line zero-dep IDB wrapper behind a proxy; separate blob store; BroadcastChannel sync.
  Acceptance: a zero-dep IDB provider fronts library storage with localStorage fallback; migration from the current store is lossless under node:test; Dexie is NOT added.
  Complexity: XL


