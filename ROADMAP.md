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
- Remote analytics or telemetry
- Account automation, moderation writes, or bypassing authentication or sticker/subscription entitlements
- Proxy services, replay of private endpoints, or remote executable code
- Publishing to a userscript catalog or extension store without explicit approval

## Research-Driven Additions

Added 2026-08-15 from the research pass recorded in [RESEARCH.md](RESEARCH.md).

### P0

- [ ] P0 — Make the Firefox companion actually block requests
  Why: it currently cancels nothing — every request short-circuits to "allow" — while the popup reports active rulesets, so the build claims protection it does not provide.
  Evidence: `src/extension/background.firefox.js:38` gates on `details.initiator`, which Firefox does not populate (MDN `webRequest.onBeforeRequest` documents `originUrl`/`documentUrl`); `new URL(undefined)` throws and the `catch` returns `false`.
  Touches: `src/extension/background.firefox.js`, `src/extension/popup.js` (status honesty).
  Acceptance: the listener resolves the initiator from `details.originUrl || details.documentUrl` with `details.initiator` retained as a Chromium fallback; a `blob:`-origin request from the IVS worker is still attributed to Kick rather than dropped by the empty-hostname case; a live Firefox profile records a non-zero block count and a known ad host fails to load.
  Complexity: S

- [ ] P0 — Replace the build gate that enforces the Firefox bug
  Why: the gate asserts the defective field, so it passes because of the bug and would fail on a correct fix — the exact "check that always passes" trap this project has been bitten by before.
  Evidence: `scripts/check.mjs:112` asserts `firefoxBackground.includes('kickInitiator(details.initiator)')`; `test/companion.test.js` contains one test (injection order) and no behavioural coverage of either background script.
  Touches: `scripts/check.mjs`, `test/companion.test.js`.
  Acceptance: the string-inclusion assertion is replaced by a behavioural test that loads the built Firefox background with a stubbed `browser.webRequest`, feeds it Firefox-shaped details (`originUrl` set, `initiator` absent) plus a `blob:` origin, and asserts `{ cancel: true }` for an ad host and `undefined` for a non-Kick initiator.
  Complexity: M

- [ ] P0 — Report storage writes that fail instead of losing data silently
  Why: a curated sticker library, groups, favorites, notes, and the blocklist cache vanish with no message when storage is full or denied — the flagship persistence feature fails invisibly.
  Evidence: `src/runtime.js` — 12 of 13 `gmSet(...)` call sites discard the boolean; only `saveSettings` (`:179`) checks it. No `QuotaExceededError` handling exists anywhere in the tree.
  Touches: `src/runtime.js` (`gmSet` call sites, sticker/media/blocklist persistence), Content & Ads and About diagnostics.
  Acceptance: any failed write surfaces a visible, non-dismissable-until-acknowledged warning naming what was not saved; the About page reports approximate library size; a test simulates a throwing storage backend and asserts the warning path.
  Complexity: M
  Note (2026-08-15): reporting the failure is the floor, but the underlying storage may be the wrong tier. `localStorage` is synchronous and ~5 MB and `storage.local` is quota-capped and JSON-only, while the emote library is the largest local payload and growing. NipahTV runs Dexie/IndexedDB inside the service worker and exposes it to page and userscript contexts through an ES `Proxy` that accumulates the property callstack and marshals it over `runtime.sendMessage` (`src/Database/DatabaseProxy.ts`), so one codepath serves both build targets and schema upgrades are explicit migrations. Consider that before adding more to the current tier.

### P1

- [ ] P1 — Add a grace window before volume memory starts recording
  Why: browser autoplay policy sets `muted = true` immediately after attach, which fires `volumechange` and persists "muted" for that path forever, so the feature eventually locks streams silent.
  Evidence: `src/runtime.js:1645` binds `volumechange` with no delay; `restore()` re-applies the stored `muted` on every later visit. `kick-stream-tweaks` carries a `VOLUME_GRACE_MS` constant for this exact failure.
  Touches: `src/runtime.js` (`bindMediaElement`).
  Acceptance: `volumechange` is ignored for a grace period after binding and any change that only sets `muted=true` within it is discarded; saved volume is additionally reconciled against the live `<video>` on a timer, because some players route audio through a gain node and never fire the event.
  Complexity: S

- [ ] P1 — Prove or replace quality memory
  Why: it very likely does nothing on real Kick, so a shipped toggle promises persistence it does not deliver.
  Evidence: `src/runtime.js:1655-1676` calls `control.click()` on `[data-quality], [data-resolution], [data-testid*="quality" i], [aria-label*="quality" i]` — none of which appear in this project's own verified DOM-contract table; Kick's menu is reported to ignore plain synthetic clicks (needs a full `PointerEvent` sequence), and OverKick instead pins quality by hooking `Storage.prototype` scoped to `sessionStorage['stream_quality']` so the player initializes correctly.
  Touches: `src/runtime.js` (`applyQualityMemory`), Content settings copy.
  Acceptance: a live channel confirms whether the current path ever changes rendered quality; if not, restore via the storage key at player init, keep `[role="menuitemradio"]` menu-driving only as a fallback, and never restore from "what the player had a moment ago" (that is how ad-break downgrades become permanent).
  Complexity: M

- [ ] P1 — Give Windows High Contrast a visible focus indicator
  Why: `forced-colors` suppresses `box-shadow`, so text inputs and the command-menu search have no focus indicator at all in High Contrast Mode — a WCAG 2.4.7 failure on a project that ships an accessibility page.
  Evidence: `src/runtime.js` — `.kf-text:focus, .kf-textarea:focus` and `.kf-command-head input:focus` use `outline: 0` plus a `box-shadow` ring; the tree contains no `forced-colors` query (buttons are safe, they use `:focus-visible { outline: 3px solid }`).
  Touches: `src/runtime.js` (`UI_CSS`).
  Acceptance: a `@media (forced-colors: active)` block gives every focusable control a real `outline` using system colors (`Highlight`/`CanvasText`), verified with forced-colors emulation.
  Complexity: S

- [ ] P1 — Gate i18n parity and duplicates in `npm run verify`
  Why: the dictionaries have already drifted and a duplicate key is silently overwriting a translation, with nothing to catch either.
  Evidence: measured 2026-08-15 — `es` declares 127 keys but only 126 are unique (`'Accessibility & Shortcuts'` appears twice, later value wins); one `es`-translated string has no `pt` entry; `scripts/check.mjs` and the test suite check neither.
  Touches: `scripts/check.mjs` or `test/`, `src/runtime.js` (`TRANSLATIONS`).
  Acceptance: the gate fails on a duplicate key in any locale and on any key present in one locale but missing from another, naming the offending strings.
  Complexity: S

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

- [ ] P2 — Offer a static-first mode that freezes animated stickers and emotes
  Why: an explicit, unanswered accessibility request framed as seizure risk, with no competitor shipping it and a CPU win alongside.
  Evidence: r/KickStreaming comment 2026-07-27 ("those animated emotes are maximum seizure fuel… Is an option to turn these things off available yet?"), still unanswered; the project already ships a reduced-motion setting and owns the sticker render path.
  Touches: `src/runtime.js` (sticker rendering, chat surface, `SITE_CSS`), Accessibility settings.
  Acceptance: a setting renders animated stickers/emotes as a static frame in chat and in the picker, is honored automatically when `prefers-reduced-motion: reduce` is set, and is reversible without reload.
  Complexity: M

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

- [ ] P2 — Make the page-realm hooks harder to fingerprint
  Why: the ad defense depends on the page not trivially detecting it, and Kick gained a commercial reason to probe when ads launched 2026-08-06.
  Evidence: `src/runtime.js:399` — `pageWindow.fetch = function kickFocusFetch(...)` leaves `window.fetch.name === 'kickFocusFetch'` and a non-native `toString()`.
  Touches: `src/runtime.js` (`installNetworkDefense`).
  Acceptance: wrapper functions report native-looking `name` and `toString()` output; a page-side probe cannot distinguish the hooked `fetch`/XHR from the originals by those means.
  Complexity: S

- [ ] P2 — State the distribution and timing limits the project actually has
  Why: two constraints materially change whether a user gets any protection, and neither is documented.
  Evidence: Firefox Release and Beta cannot install unsigned XPIs at all (only `about:debugging`, wiped on restart, or Developer Edition/Nightly/ESR with `xpinstall.signatures.required=false`), and AMO signing is excluded by the no-signing policy; Violentmonkey 2.47.0 (MV3, 2026-08-06) does not provide real `document-start` unless "Alternative page mode" is enabled, which is off by default.
  Touches: `README.md`, About settings page.
  Acceptance: the README states the Firefox install reality per channel and the Violentmonkey setting by name; the About page already measures injection timing and links the fix when it reports a late start.
  Complexity: S

- [ ] P2 — Report imported keys the prototype chain hides
  Why: an imported `__proto__`, `constructor`, or `toString` key is silently treated as recognised instead of reported, weakening the import transparency the project deliberately built.
  Evidence: `src/core.mjs:747` uses `if (!(key in value[section]))`, and `in` walks the prototype chain. `normalizeSettings` still rebuilds from defaults, so this is a reporting gap rather than prototype pollution.
  Touches: `src/core.mjs` (`validateImportedSettings`), `test/core.test.js`.
  Acceptance: the check uses `Object.hasOwn`, and a test imports a payload containing `__proto__` and `constructor` keys and asserts both are reported as ignored.
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

- [ ] P1 — Read the realtime provider broker instead of assuming Pusher
  Why: Kick returns connection credentials behind a provider discriminator and tracks a degraded state, so it can switch realtime providers server-side; anything hardcoding the key breaks silently.
  Evidence: verified 2026-08-15 — `GET web.kick.com/api/v1/realtime/chat/{chatroomId}/client/{uuid}/connection` returns `{"connections":[{"credentials":{"app_key":"32cbd69e4b950bf97679","cluster":"us2"},"provider":"PUSHER"}],"mode":"WEBSOCKET"}`, callable anonymously with any UUID.
  Touches: new realtime module in `src/runtime.js`, `src/core.mjs` (response validation).
  Acceptance: the app key is never written in source; an unknown `provider` value degrades to the existing DOM path instead of erroring.
  Complexity: M

- [ ] P1 — Source the emote catalog from the API, keeping DOM as fallback
  Why: the organizer scrapes a lazy-rendered picker, which the project's own research calls its highest-drift surface, and the API supplies the same data plus entitlement as structured JSON.
  Evidence: verified 2026-08-15 — `GET kick.com/emotes/{slug}` (anonymous, same-origin) returns channel/`Global`/`Emojis` sets, each emote `{id, channel_id, name, subscribers_only}`; images at `files.kick.com/emotes/{id}/fullsize`. The picker additionally renders Recent and Collectibles groups the per-channel endpoint does not carry, so DOM remains required for the user's own inventory.
  Touches: `src/runtime.js` (sticker/emote catalog), `src/core.mjs` (catalog normalization + tests).
  Acceptance: the catalog populates without opening the picker; entitlement comes from `subscribers_only` rather than a `disabled` attribute; a failed or changed response falls back to DOM scraping and says so in diagnostics.
  Complexity: L

- [ ] P1 — Rename the "sticker" vocabulary to "emote"
  Why: Kick ships no product called a sticker — its API path, chat wire format and picker DOM all say emote — so the current wording breaks the match between this UI and the one users are looking at.
  Evidence: `kick.com/emotes/{slug}`, chat tokens `[emote:5748003:collectiblesGoldenLULW]` captured live 2026-08-15, and Kick's own picker container `#chat-emotes-picker-panel`.
  Touches: `README.md`, settings copy in `src/runtime.js`, `TRANSLATIONS`, storage keys (migrate, do not rename in place), `scripts/check.mjs` gate strings.
  Acceptance: user-facing text says emote; stored keys either stay or migrate with a schema bump; no gate still asserts the old wording.
  Complexity: M

- [ ] P2 — Resolve collectible emotes to their rarity
  Why: Kick exposes rarity only on card art and emote identity only in the picker, and the two payloads share no key — so no user anywhere can currently tell what rarity an emote they own is.
  Evidence: `GET web.kick.com/api/v1/gamification/collectibles` returns cards `{id (uuid), card_url, owned, rarity, type}` with no name; the picker's Collectibles group carries `{id (int), name}` with no rarity. Endpoint existence verified 2026-08-15 by discriminating 403 (auth-gated) from 404 on a nonsense sibling path. Collectible emotes are name-prefixed `collectibles*`.
  Touches: `src/runtime.js` (collectibles group), `src/core.mjs` (join + confidence scoring).
  Acceptance: collectible tiles show rarity and drop odds derived from the challenge drop table; when join confidence falls the tab renders exactly as it does today rather than showing a wrong rarity — a mislabelled Mythic is worse than no label.
  Complexity: L

- [ ] P2 — Count real emote usage, per channel and globally
  Why: Kick's own "Frequently Used" tab is a 50-entry MRU whose `timeUsed` is hardcoded to 1 and never incremented, so no ranking exists; competitors track usage only for third-party emote providers, never Kick-native ones.
  Evidence: Kick's store writer `emoteAddToRecent(name, id)` sets `timeUsed: 1` unconditionally; NipahTV and jakubn11/kick-third-party-emotes both track usage but only for 7TV/BTTV/FFZ.
  Touches: `src/runtime.js` (send path observation, favorites shelf ordering), `src/core.mjs` (counter schema).
  Acceptance: a true frequency ranking exists per channel and globally, ordering the quick shelf, with a "never used" view; counts are local-only and exportable with the library.
  Complexity: M

- [ ] P2 — Render wide collectible emotes at their real aspect
  Why: collectible emotes can be 2:1 and every third-party renderer squashes them square, because the aspect rule lives only in Kick's own client.
  Evidence: Kick's `useCollectibleEmoteAspect` renders at double width when the name starts with `collectibles` and `naturalWidth/naturalHeight > 1.2`; KickTalk, HeatSync, 7TV and the overlay projects all render square.
  Touches: `src/runtime.js` (emote tile rendering, `SITE_CSS`).
  Acceptance: wide collectibles render un-squashed in the organizer and quick shelf, measured from the loaded image rather than assumed from the name alone.
  Complexity: S

- [ ] P3 — Warn when emote names shadow each other
  Why: sub emotes are usable in every chat, Kick resolves typed names through one name-keyed map where the last set loaded wins, so two channels shipping the same name means one silently sends the other's.
  Evidence: Kick's composer `registerNodeTransform` matches a typed name against a single `Map` keyed by emote name; `subscribers_only` doubles as the platform-wide "usable everywhere" flag, so collisions grow with each subscription.
  Touches: `src/runtime.js` (catalog merge), organizer UI.
  Acceptance: the organizer reports which names are shadowed in the current chat and which set wins; nothing is auto-renamed or blocked.
  Complexity: S
