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

- [ ] P2 — Snapshot the collectibles inventory locally
  Why: Kick retroactively changes emotes users already pulled and the collectibles view desyncs from the chat emote set, so a local timestamped record is the only version a user can trust — and this project already owns the persistence and export layer.
  Evidence: r/KickStreaming 2026-07-24 ("Kick changed 4 of the emotes I pulled") corroborated by Kick Support's "remastered… clear your cache" reply; 2026-07-21 inventory desync report; Daily Rewards launched 2026-07-01 with 244 items.
  Touches: `src/runtime.js` (sticker library), `src/core.mjs` (schema), Content & Ads library UI.
  Acceptance: the library records first-seen and last-seen timestamps per sticker and flags entries whose name or asset changed since first capture; the export carries the history; nothing automates claiming and no private endpoint is replayed.
  Complexity: M

- [ ] P2 — Replace the reverse-mapping translator with forward-only keys
  Why: every translated string is resolved by scanning all 252 dictionary entries to map a possibly-already-translated value back to English, and the whole settings DOM is re-walked on every render.
  Evidence: `tr()` → `canonicalTranslation()` in `src/runtime.js`; `localizeInterface()` walks every text node plus `aria-label`, `placeholder`, and `title`; four English source strings are also translated values of other strings, making the reverse map ambiguous by construction.
  Touches: `src/runtime.js` (`TRANSLATIONS`, `tr`, `localizeInterface`, settings render paths).
  Acceptance: markup carries stable keys and lookup is a single forward map with no reverse scan and no double-translation on re-render; the language picker shows endonyms (`Español`, `Português`) in every locale rather than translating language names.
  Complexity: M

### P3

- [ ] P3 — Scope sticker favorites per channel with explicit ordering
  Why: the field's best data model, and it closes four separate long-open requests no competitor has shipped (FFZ custom sort open since 2021, FFZ frequently-used, Xtra per-channel favourites, Chatterino favourites).
  Evidence: NipahTV keys favorites on a compound `[platformId+channelId+emoteHid]` with an `orderIndex` and embeds a full emote snapshot so a favorite survives its set unloading; usage counts are per channel; writes batch through a pending-changes map.
  Touches: `src/core.mjs` (sticker schema — note an uncommitted 2→3 bump is already in flight), `src/runtime.js` (shelf, library manager).
  Acceptance: favorites can be ordered manually, are scoped per channel with a global fallback, and survive the channel's set not being loaded; existing preferences migrate without loss.
  Complexity: L

- [ ] P3 — Explain why a locked sticker is locked
  Why: a dead greyed tile teaches nothing, while a reason plus a legitimate unlock path is the clearest possible signal that the project respects entitlements.
  Evidence: FrankerFaceZ renders a lock icon with a per-kind reason ("Follow to unlock", sub price) and links to the unlock URL, and excludes locked emotes from search; KickTalk normalizes Kick subscription state across roughly six differing response shapes, because a single-shape check produces false negatives — the documented real-world bug class is blocking emotes the user does own.
  Touches: `src/runtime.js` (sticker tile rendering, catalog metadata).
  Acceptance: a locked sticker shows why it is locked and links to Kick's own legitimate unlock path; nothing is ever enabled or sent; entitlement detection tolerates multiple response shapes rather than assuming one.
  Complexity: M

### API and emote-catalog work (added 2026-08-15 from the Kick API + emote tooling research)

Gate for this whole group: the deferred list rules out "replay of private endpoints". These items read endpoints the page already calls, same-origin, read-only, inheriting the user's own session, and every one keeps the existing DOM path as fallback. Settle that boundary before starting.

## Research-Driven Additions — differential pass

Added 2026-08-15 from the differential research pass recorded in [RESEARCH.md](RESEARCH.md), run against v1.5.0.

### P0

### P1

- [ ] P1 — Make the realtime transport swappable before Kick forces it
  Why: the anonymous Pusher path can be switched off by a single vendor toggle, and Kick already runs a replacement gateway speaking the same protocol — so the migration is a question of when, not whether.
  Evidence: Pusher's Authorized Connections feature (out of beta) lets an app owner disconnect clients that never authenticate or join a private/presence channel — exactly our subscription shape. Kick's self-hosted `wss://websockets.kick.com/viewer/v1/connect` is live (Cloudflare-fronted 403 without a token) and speaks the same `pusher:subscribe` / `chatrooms.{id}.v2` / `App\Events\ChatMessageEvent` frames; its token flow is documented in Pkkls/kick-core. The broker's `provider` discriminator and `degraded` state are the migration scaffolding. Hosted Pusher verified still working by anonymous handshake 2026-08-15.
  Touches: `src/api.mjs` (transport selection), `src/runtime.js` (`connectRealtime`, `onRealtimeFrame`), `test/api.test.js`.
  Acceptance: frame parsing and subscription management are separated from the connection method so a second transport is an added function rather than a rewrite; an unsupported provider still degrades to the DOM path and says so. Settle open question 2 in RESEARCH.md — whether the gateway is reachable from a page-world content script at all — because a service-worker-only answer means the userscript build can never follow, and that belongs in the docs.
  Complexity: M

### P2

- [ ] P2 — Make saved layouts shareable and show who is live
  Why: path-style layout URLs are the field's de facto sharing format, and live-status on saved layouts is the stickiest feature of the closest competitor.
  Evidence: MultiKick.com builds grids from `multikick.com/{a}/{b}` and pairs favorites with live indicators; ViewGrid ships shareable grid URLs; multitwitch#49 asked for URL-driven functions. `kick.com/current-viewers?ids[]=` returns bulk live status in one anonymous request (verified 2026-08-15), so the status half is nearly free.
  Touches: `src/runtime.js` (multi-stream layout UI), `src/api.mjs` (`endpoints.currentViewers`), `src/core.mjs` (layout serialization).
  Acceptance: a layout can be copied as a link and restored from one, validating every slug before use; saved layouts show which channels are live from a single bulk request rather than per-channel polling.
  Complexity: M

- [ ] P2 — Surface the collectible facts Kick leaves unexplained
  Why: this is the strongest unmet demand the community sweep found, and the project already holds the data.
  Evidence: 7+ distinct users 2026-07-18 to 2026-08-09 confused or burned — the daily streak confers nothing (confirmed by a quoted Kick support reply), duplicate protection is undocumented, drop odds are opaque, unlock state desyncs between the collectibles page and the chat emote set, and Kick retroactively changed already-pulled emotes. Extends the existing "Snapshot the collectibles inventory locally" item rather than replacing it: that one records history, this one explains the mechanics.
  Touches: `src/runtime.js` (collectibles surface), `src/core.mjs`.
  Acceptance: the collectibles view states what the streak does and does not do, shows observed duplicate rate from the user's own local history, and flags entries whose name or asset changed since first capture; nothing is claimed that the local record cannot support.
  Complexity: M

- [ ] P2 — Render collectible badges now that chat payloads carry them
  Why: Kick added collectible badges to chat identity payloads, and clients that ignore them render gaps where other clients show a badge.
  Evidence: Kickerino v1.29 (2026-08-02) fixed collectible-emote download freezes and v1.31 (2026-08-08) shipped a collectible-badges appearance fix — two releases in a week driven by the change. `normalizeChatMessage` in `src/api.mjs` already prefers `badges_v2` and captures `image_url`, so the data is parsed but nothing renders it.
  Touches: `src/runtime.js` (chat surface), `src/api.mjs`.
  Acceptance: badges present in `badges_v2` render in the chat surface at their correct size, including collectible and global badges the legacy array omits; a missing or broken badge image degrades to text rather than an empty box.
  Complexity: S

- [ ] P2 — Split the multi-stream and live-data surfaces out of `src/runtime.js`
  Why: the file is 6,179 lines carrying five unrelated concerns, and the two newest are the most testable and least entangled.
  Evidence: `src/runtime.js` now holds site styling, content filtering, the settings UI, the Kick live-data client, and the multi-stream surface. The build concatenates with `export` stripped, so extraction costs nothing at runtime, and the bundle-completeness gate in `scripts/check.mjs` covers any file added to its `moduleFiles` list.
  Touches: new `src/multistream.js` and `src/live.js`, `scripts/build.mjs`, `scripts/check.mjs`.
  Acceptance: both surfaces move without behaviour change, the new files are covered by the bundle-export gate, and `npm run verify` plus the live harness both stay green — a green build alone does not prove a refactor equivalent.
  Complexity: M

### P3

- [ ] P3 — Test the multi-stream invariants that only the live harness currently checks
  Why: three load-bearing behaviours are asserted only by a headed browser run that `npm run verify` does not execute.
  Evidence: tile reuse across renders (replacing an `<iframe>` restarts its stream), the single-unmuted-tile rule in `applyMultistreamAudio`, and `normalizeDeletion` to `annotateDeletedMessage` have no offline coverage; `test/companion.test.js` shows the pattern for running built code against stubs.
  Touches: `test/`, possibly `src/runtime.js` for testability seams.
  Acceptance: offline tests assert that adding a channel does not recreate existing tiles, that exactly one tile is ever unmuted, and that a deletion annotates the right node once; they fail if any invariant is broken.
  Complexity: M
