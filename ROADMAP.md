# Roadmap

Updated: **2026-08-15**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next — ordered by value

1. **Authenticated companion journey at both desktop viewports.** Load the unpacked extension in a throwaway profile that the user signs into directly, then repeat Home → Browse → Following → Drops → Search → Channel/chat at 1440×900 and 1920×1080. The isolated in-app browser supplied authenticated recon, while the extension proof used a separate logged-out profile; session data must never be exported between them.
2. **Worker-level stitched-ad observability.** Prototype a bounded `Worker`-constructor wrapper around the IVS worker and record only manifest/ad-signifier counts. Ship a mitigation only if it can separate ad media without replaying private endpoints, breaking playback, or proxying traffic. The current page-realm fetch/XHR hooks cannot see the worker-owned HLS manifest. (2026-08-15: check the cheaper question first — Chrome documents a request's initiator as the creating document's origin, so the companion's existing `initiatorDomains: ["kick.com"]` rules may already observe worker-initiated segment requests that the page realm cannot. Measure that before building the wrapper. Note also that the AdGuard "stitched-ad redirect rule" reported for 2026-08-14 **does not exist** — see Rejected Ideas in RESEARCH.md — so there is no external rule to copy.)
3. **Automated Kick DOM drift snapshots.** Add a maintainer-only reducer that turns fresh MHTML/live captures into small, sanitized fixtures and fails when stable probes disappear on Home, Browse, Following, Drops, Search, Category, Channel, or the open sticker picker. Keep raw captures ignored.
4. **Live Firefox companion proof.** Exercise the generated Manifest V2 package in a disposable Firefox profile, proving `webRequestBlocking`, page/bridge handshake, popup state, and current Kick DOM behavior. Firefox requires target and initiator host access for this API, so document the `<all_urls>` warning alongside the Kick-initiator runtime guard. (2026-08-15: this proof will fail as written — the initiator guard reads a Chromium-only field. Land the P0 fix below first, or this item just rediscovers it.)
5. **Userscript-manager cold-start matrix.** Verify current Tampermonkey and Violentmonkey injection timing, storage/export behavior, SPA navigation, and ad-defense diagnostics in isolated profiles. Manager-specific grants cannot be considered live-verified by the direct fixture bundle. (2026-08-15: Violentmonkey 2.47.0 only reached MV3 on 2026-08-06, and its release notes state `@run-at document-start` is **not** real document-start under MV3 Chromium unless "Alternative page mode" is enabled, which is off by default and advisory-limited to ~1 MB of injected script. Test that mode explicitly, both on and off.)

## Explicitly deferred

- Mobile layout or mobile claims
- Publishing to a userscript catalog or extension store without explicit approval

## Research-Driven Additions

Added 2026-08-15 from the research pass recorded in [RESEARCH.md](RESEARCH.md).

### P0

### P1

### P2

### P3

- [ ] P3 — Scope sticker favorites per channel with explicit ordering
  Why: the field's best data model, and it closes four separate long-open requests no competitor has shipped (FFZ custom sort open since 2021, FFZ frequently-used, Xtra per-channel favourites, Chatterino favourites).
  Evidence: NipahTV keys favorites on a compound `[platformId+channelId+emoteHid]` with an `orderIndex` and embeds a full emote snapshot so a favorite survives its set unloading; usage counts are per channel; writes batch through a pending-changes map.
  Touches: `src/core.mjs` (sticker schema — note an uncommitted 2→3 bump is already in flight), `src/runtime.js` (shelf, library manager).
  Acceptance: favorites can be ordered manually, are scoped per channel with a global fallback, and survive the channel's set not being loaded; existing preferences migrate without loss.
  Complexity: L

### API and emote-catalog work (added 2026-08-15 from the Kick API + emote tooling research)

Gate for this whole group: the deferred list rules out "replay of private endpoints". These items read endpoints the page already calls, same-origin, read-only, inheriting the user's own session, and every one keeps the existing DOM path as fallback. Settle that boundary before starting.

## Research-Driven Additions — differential pass

Added 2026-08-15 from the differential research pass recorded in [RESEARCH.md](RESEARCH.md), run against v1.5.0.

### P0

### P1

### P2

### P3

