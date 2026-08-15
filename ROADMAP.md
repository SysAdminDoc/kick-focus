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

- [ ] P1 — Strip permissions and version floors that cost users trust
  Why: the shipped manifests request access they do not need, and the declared Node floor endorses an end-of-life runtime.
  Evidence: `src/extension/manifest.json:26` ships `declarativeNetRequestFeedback`, which is unpacked-only for `onRuleMatchedDebug`/`getMatchedRules` yet still triggers the "read your browsing history" warning; `src/extension/manifest.firefox.json` requests `<all_urls>` and `tabs` (tab `status` updates need no permission) and omits `browser_specific_settings.gecko.data_collection_permissions`, mandatory for AMO since 2025-11-03; `package.json` declares `engines.node >= 20`, EOL 2026-04-30 with 3 HIGH CVEs unpatched in that line.
  Touches: `src/extension/manifest.json`, `src/extension/manifest.firefox.json`, `scripts/build.mjs` (dev-only manifest variant), `package.json`.
  Acceptance: the release Chromium manifest drops the feedback permission while a dev variant keeps it; the Firefox manifest enumerates kick.com plus the generated hosts instead of `<all_urls>`, drops `tabs`, and declares `data_collection_permissions: { required: ["none"] }`; `engines.node` is `>=22`; the block counter degrades gracefully where debug feedback is unavailable.
  Complexity: M

- [ ] P1 — Fetch the remote blocklist off the page realm
  Why: the subscription request currently runs as a page-origin `fetch`, so it is subject to CORS (most JSON hosts will simply fail) and is observable and interceptable by Kick's own code.
  Evidence: `src/runtime.js:2424` uses page `fetch`; `src/metadata.txt` grants no `GM_xmlhttpRequest` and declares no `@connect`; the companion never fetches it from the background.
  Touches: `src/metadata.txt`, `src/runtime.js`, `src/extension/background.js`, `src/extension/background.firefox.js`, bridge messaging.
  Acceptance: under a userscript manager the fetch uses `GM_xmlhttpRequest` with an explicit `@connect` allowlist; under a companion it is performed in the background and handed back over the existing bridge; the page-realm path remains only as a last resort and the UI states which was used.
  Complexity: M

- [ ] P1 — Resolve the telemetry strategy contradiction between layers
  Why: the two layers implement opposite strategies, and installing the companion silently replaces the storm-safe one with a hard cancel.
  Evidence: `blockedResponse` and `simulateEmptySuccess` in `src/runtime.js` resolve an empty 200 (matching the community's `no-fetch-if` fix), while `reduceTelemetry` defaults true and enables a companion ruleset that cancels the same hosts at the network layer, where a cancel wins the race. A 5-minute measurement on 2026-08-14 did not reproduce the reported retry storm.
  Touches: `src/extension/background.js` rulesets, `src/core.mjs` `TELEMETRY_HOSTS`, Content settings copy.
  Acceptance: a multi-hour session with the companion installed records request counts for the telemetry hosts and CPU behaviour; whichever strategy is kept is applied consistently across both layers, and the settings copy states which one is in effect.
  Complexity: M

### P2

- [ ] P2 — Snapshot the collectibles inventory locally
  Why: Kick retroactively changes emotes users already pulled and the collectibles view desyncs from the chat emote set, so a local timestamped record is the only version a user can trust — and this project already owns the persistence and export layer.
  Evidence: r/KickStreaming 2026-07-24 ("Kick changed 4 of the emotes I pulled") corroborated by Kick Support's "remastered… clear your cache" reply; 2026-07-21 inventory desync report; Daily Rewards launched 2026-07-01 with 244 items.
  Touches: `src/runtime.js` (sticker library), `src/core.mjs` (schema), Content & Ads library UI.
  Acceptance: the library records first-seen and last-seen timestamps per sticker and flags entries whose name or asset changed since first capture; the export carries the history; nothing automates claiming and no private endpoint is replayed.
  Complexity: M

- [ ] P2 — Report availability changes when a sticker library is imported
  Why: the export/import round-trip is this project's unique differentiator in the Twitch+Kick field, and an import that silently drops unavailable entries undermines exactly the trust it exists to provide.
  Evidence: no other project exports an emote library — BetterTTV states it is structurally impossible (#3660) and 7TV closed the request (#694); `src/core.mjs:763` currently reports only array-length differences.
  Touches: `src/core.mjs` (`validateImportedSettings` sticker path), Content & Ads import UI.
  Acceptance: import states how many stickers are no longer available in the current account/channel and names a sample, rather than reporting a bare count difference.
  Complexity: S

- [ ] P2 — Add a named-channel blocklist for discovery surfaces
  Why: a distinct, explicitly unmet want — users ask to hide specific promoted channels, which the existing promoted/gambling filters do not address because those key on content labels, not identity.
  Evidence: r/Kick 2026-07-24 ("There's a few streamers that Kick promotes hard that I would just rather not see"), answered as not natively possible; the remote blocklist schema already carries a `channels` array that only remote subscriptions can populate.
  Touches: `src/core.mjs` (local blocklist alongside the remote one), `src/runtime.js` (`applyContentFilters`), Content settings.
  Acceptance: a channel can be hidden from Home, Browse, Following and Search from a card action, the list is editable and exportable, and hidden entries count toward the existing fail-open ceiling.
  Complexity: M

- [ ] P2 — Replace the reverse-mapping translator with forward-only keys
  Why: every translated string is resolved by scanning all 252 dictionary entries to map a possibly-already-translated value back to English, and the whole settings DOM is re-walked on every render.
  Evidence: `tr()` → `canonicalTranslation()` in `src/runtime.js`; `localizeInterface()` walks every text node plus `aria-label`, `placeholder`, and `title`; four English source strings are also translated values of other strings, making the reverse map ambiguous by construction.
  Touches: `src/runtime.js` (`TRANSLATIONS`, `tr`, `localizeInterface`, settings render paths).
  Acceptance: markup carries stable keys and lookup is a single forward map with no reverse scan and no double-translation on re-render; the language picker shows endonyms (`Español`, `Português`) in every locale rather than translating language names.
  Complexity: M

- [ ] P2 — State the distribution and timing limits the project actually has
  Why: two constraints materially change whether a user gets any protection, and neither is documented.
  Evidence: Firefox Release and Beta cannot install unsigned XPIs at all (only `about:debugging`, wiped on restart, or Developer Edition/Nightly/ESR with `xpinstall.signatures.required=false`), and AMO signing is excluded by the no-signing policy; Violentmonkey 2.47.0 (MV3, 2026-08-06) does not provide real `document-start` unless "Alternative page mode" is enabled, which is off by default.
  Touches: `README.md`, About settings page.
  Acceptance: the README states the Firefox install reality per channel and the Violentmonkey setting by name; the About page already measures injection timing and links the fix when it reports a late start.
  Complexity: S

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

- [ ] P1 — Rename the "sticker" vocabulary to "emote"
  Why: Kick ships no product called a sticker — its API path, chat wire format and picker DOM all say emote — so the current wording breaks the match between this UI and the one users are looking at.
  Evidence: `kick.com/emotes/{slug}`, chat tokens `[emote:5748003:collectiblesGoldenLULW]` captured live 2026-08-15, and Kick's own picker container `#chat-emotes-picker-panel`.
  Touches: `README.md`, settings copy in `src/runtime.js`, `TRANSLATIONS`, storage keys (migrate, do not rename in place), `scripts/check.mjs` gate strings.
  Acceptance: user-facing text says emote; stored keys either stay or migrate with a schema bump; no gate still asserts the old wording.
  Complexity: M

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

- [ ] P1 — Say that multi-stream chat is read-only, or make it writable
  Why: Kick's popout chat refuses to send from inside an iframe, so the grid's chat panel looks broken rather than limited — and Kick Focus is the only tool positioned to fix it properly.
  Evidence: KickDevDocs#262 (2025-09-28, closed without staff response) documents that the chat popout throws a CSRF error on login and send inside an iframe — "lacks iframe support by design"; read-only works. bhamrick/multitwitch#51 and #52 are the same failure a platform earlier. Because Kick Focus runs on kick.com's own origin, it can compose and send through the page's own session — the structural advantage every standalone multi-view site lacks.
  Touches: `src/runtime.js` (multi-stream chat panel), `README.md`.
  Acceptance: the chat panel states plainly that sending is unavailable in the embed, or a same-origin composer sends through the page's own session; either way the limitation is never left for the user to discover by failing.
  Complexity: M

- [ ] P1 — Detect the adblock collision and say it is not ours
  Why: since ads launched, filter lists break Kick's own signup and follow actions, and the last extension a user installed gets the blame.
  Evidence: four distinct users in one week (2026-08-09 to 2026-08-15, r/KickStreaming and r/Kick) report signup, follow, and sign-in failing with "Unknown error" until uBlock Origin is disabled *and* the browser restarted; one abandoned the platform. Attributed by users to Kick's new trackers, not to deliberate adblock detection. Kick Focus does not block those hosts — `AD_HOSTS` and `TELEMETRY_HOSTS` in `src/core.mjs` contain none of them — which is precisely why the disclaimer is honest.
  Touches: `src/runtime.js` (diagnostics, Content & Ads page), `README.md`.
  Acceptance: when a Kick account action fails in a way consistent with the known collision, the interface states that Kick Focus does not block the hosts involved and names what to check; the README carries the same note. Settle open question 3 in RESEARCH.md — which filter rule is responsible — before naming a specific fix, and disclaim only what is verified.
  Complexity: S

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

- [ ] P2 — Detect Kick API drift instead of discovering it through breakage
  Why: Kick removed an endpoint, dropped a header requirement, and changed moderation behaviour inside four weeks, and each was found by a competing client breaking in public.
  Evidence: NipahTV v1.5.110 (2026-07-29) exists solely because `/api/v1/video/:livestream_id` was deleted; Kickerino shipped fixes for collectible badges appearing in chat payloads (v1.31, 2026-08-08), the XSRF requirement being dropped (v1.33, 2026-08-11), and timeout/ban-delete behaviour changing (v1.34, 2026-08-13). Kick Focus is exposed to none of the three — verified by grep, no XSRF header is sent and no `/api/v1/video/` path is referenced — but has no mechanism to notice the next one.
  Touches: `src/api.mjs` (response validation), `src/runtime.js` (diagnostics), `scripts/`.
  Acceptance: when a normalizer rejects a payload for a shape reason, diagnostics record which endpoint and which field, and the About page reports accumulated drift rather than silently falling back; the existing `assessAdStack` drift report is the model.
  Complexity: M

- [ ] P2 — Render collectible badges now that chat payloads carry them
  Why: Kick added collectible badges to chat identity payloads, and clients that ignore them render gaps where other clients show a badge.
  Evidence: Kickerino v1.29 (2026-08-02) fixed collectible-emote download freezes and v1.31 (2026-08-08) shipped a collectible-badges appearance fix — two releases in a week driven by the change. `normalizeChatMessage` in `src/api.mjs` already prefers `badges_v2` and captures `image_url`, so the data is parsed but nothing renders it.
  Touches: `src/runtime.js` (chat surface), `src/api.mjs`.
  Acceptance: badges present in `badges_v2` render in the chat surface at their correct size, including collectible and global badges the legacy array omits; a missing or broken badge image degrades to text rather than an empty box.
  Complexity: S

- [ ] P2 — Pin the live harness to its Chromium requirement
  Why: the flags the live gate depends on no longer exist in official Chrome builds, and the next person to run it on the wrong binary will get a confusing failure rather than a clear one.
  Evidence: Chrome 139 (2025-06-30) removed `--extensions-on-chrome-urls` and `--disable-extensions-except` from official builds; `scripts/verify-extension.mjs` passes the latter and survives only because it targets Playwright's Chromium-for-Testing. Compounding it, `--disable-extensions-except` never excluded component extensions anyway — already recorded in `CLAUDE.md`.
  Touches: `scripts/verify-extension.mjs`, `CLAUDE.md`, `README.md`.
  Acceptance: the harness detects a binary that ignores the flag and fails with a message naming the requirement, instead of attaching to the wrong extension or reporting a vacuous pass.
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
