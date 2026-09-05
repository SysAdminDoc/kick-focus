# Kick Focus research

Date: **2026-09-04**. This document replaces all prior research.

**Baseline caveat, and it matters.** This pass began against v1.45.0 at commit [`5ea2173`](https://github.com/SysAdminDoc/kick-focus/commit/5ea2173) and finished against a working tree that had moved to an in-progress **v1.48.0** — another session shipped v1.46.0 and v1.47.0 and was mid-release while this ran. Every measurement below was re-taken against that working tree on 2026-09-04: `dist/kick-focus.user.js` 886,138 bytes, `src/runtime.js` 13,681 lines and 395 top-level functions. Gate counts are deliberately **not** quoted: a test or check total measured while another session is editing the tree is not that project's state, and the last quiet figures on record are v1.47.0's 477 tests, 215 checks and 94 red probes. Line references are current as of that tree and will drift; the file and function names beside them are the durable part.

Two items this pass had drafted were implemented by that concurrent work before it landed, and were removed rather than filed: build-time compaction of every `_CSS` template, and `aria-expanded` on the emote tile's management control. Both are described under Rejected Ideas so the measurements are not lost.

Confidence labels: **Verified** (measured here, or stated by a primary source), **Likely** (several current signals agree, the size of the win is unmeasured), **Needs live validation** (requires a signed-in account, a live stream, or production DOM).

## Executive Summary

Kick Focus is the most complete viewer-side client mod for Kick that exists, and it is the only one that is open source, dependency-free, read-only, accessible, localized, and shipped as three artifacts from one source. The market leader it competes with, Mo'Kick, has 40,000 Chrome users, is closed source, and its own store reviews from the last week describe a settings panel that renders as "a small thin strip", updates that "broke it cant open any streams", and a verdict of "the WORST UI EVER" ([CWS listing](https://chromewebstore.google.com/detail/mokick-better-kick-for-ev/lhjnnfenfahhjkmcngnocfclechcibkc), reviews dated 2026-09-02 and 2026-09-04). The product problem is solved. What is left is engineering: more than half the source is invisible to the coverage floors, two surfaces render English to Spanish and Portuguese users while a gate reports full coverage, and the byte budget is governed by a cliff rather than a gradient.

Highest-value work, in order:

1. **Translate the search and Drops surfaces.** `applySearchEnhancements` (`src/runtime.js:3718`) and `applyDropsEnhancements` (`src/runtime.js:3755`) write roughly 24 literal English strings into the *page* DOM. `localizeInterface` is only ever called with its default `state.shadow` root (`src/runtime.js:10033`, five call sites), so it never reaches them. Every one of those strings already has a dictionary entry — "Search results" at `:9101`, "Clear search" at `:9839`, "Browse eligible streams" at `:9843`, "How drops work" at `:9849` — so the translations exist and nothing looks them up. The card-action writer 140 lines earlier does it correctly, through `trf()` with the locale in its rebuild signature (`src/runtime.js:3578`), and the header shadow carries a comment stating the exact rule being broken (`src/runtime.js:13446`). R-152.
2. **Make the bundle report coverage.** `src/runtime.js` is 13,681 lines and 395 top-level functions, 57.8% of the concatenated source by line and 59.8% by byte; it contributes nothing to the coverage table and is listed as uncoverable at `test/coverage.test.js:31`. It is not uncoverable: `test/boot.test.js` runs the bundle through `vm.runInNewContext(bundle, context)` (`:173`, `:206`, and six siblings) with no `filename`, and adding one makes Node's reporter include it. Probed 2026-09-04, a bare context already yields 15.80% lines and 0.14% functions for the built userscript. R-153.
3. **Unblock R-55 by naming what to capture.** The Viewer Hub renders Channel points and Level cards (`src/core.mjs:1059`), but `scripts/signed-in-journeys.mjs` has eight journeys and neither is one of them. A signed-in Chrome session did run on 2026-08-27 — `test/fixtures/daily-reward-live.json` is its sanitized output, and `Roadmap_Blocked.md` records the same — so the stated blocker on that file's loyalty items has expired; what is missing is a matrix entry telling the next such run what to look at. R-154.
4. **Govern the byte budget instead of discovering it at the gate.** Headroom is 13,862 bytes after the concurrent compaction work, but the build still prints one total and nothing attributes growth. `TRANSLATIONS` alone is 118,396 bytes of the 886,138-byte artifact, 13.4%, and `SITE_CSS` and `UI_CSS` add 119,500 more. R-155.
5. **Notice a new Kick ad host.** `AD_HOSTS` is eight hand-curated hosts and `TELEMETRY_HOSTS` is three (`src/core.mjs:413`, `:424`); `report()` fires only when a classification is blocked (`src/runtime.js:872`, `:970`, `:989`), so an unrecognized third-party origin is never recorded. Mainstream filter lists still carry no kick.com ad rules, so there is no upstream to inherit from. R-156.
6. **Take the 59-entry probe sweep off the per-mutation hot path.** `compatibilitySnapshot(document, …)` runs 24 probe groups, 59 probe entries and 4 derived expectations inside every apply cycle (`src/runtime.js:7678`). R-157.
7. **Keep the mod's own surfaces legible in Windows High Contrast.** One `forced-colors: active` block exists, at `src/runtime.js:8701`, and it covers text-input focus rings; `UI_CSS` (`src/runtime.js:7949-9102`) carries 21 drawing `box-shadow` declarations that forced-colors suppresses. R-159.
8. **Give the public repo a security contact and a drift-report intake.** R-160.

## Product Map

### Core workflows

| Workflow | Where |
|---|---|
| Watching: dark themes, density, focus mode, auto-hide rails, filters, layout memory, reversible cleanup | `src/core.mjs`, `src/runtime.js`, `src/settings.mjs` |
| Profile comments: anchored native-adjacent picker, insertion through Kick's composer, never submits | `src/runtime.js` emote workspace |
| Emote organization: favorites, recent, groups, drag reorder, Organize mode, Library, provenance, rarity | `src/runtime.js`, `src/settings.mjs`, `src/storage.mjs` |
| Multistream: up to nine channels on Kick's own embeds, focused audio, merged read-only chat, share links | `src/multistream.mjs`, `src/live.mjs` |
| Viewer context and rewards: reads only what the page already has, drives Kick's own reward dialog | `src/api.mjs`, `src/runtime.js` |
| Companion bridge: extension storage, `declarativeNetRequest` rules, one approved blocklist feed | `src/extension/` |

### Users

Desktop Kick viewers who want a calmer page; frequent commenters with large emote collections; multistream viewers; people who need reduced motion, larger targets, or stronger contrast; Spanish and Portuguese speakers.

### Platforms and distribution

Userscript (Tampermonkey, Violentmonkey) plus optional Chromium MV3 and Firefox MV2 companions, all built from one source. Nothing is listed in any store or catalogue; `dist/kick-focus.user.js` is attached to every GitHub release from v1.44.0 onward but the README documents only the copy-and-paste path. Publication and any update channel are operator-gated in `Roadmap_Blocked.md`.

### Data flows

Local only. Zero package dependencies, no analytics, no remote code, Kick-only content matching, a Firefox `data_collection_permissions: ["none"]` declaration. The only outbound non-Kick request is the opt-in blocklist feed, to one HTTPS URL the user types, `anonymous: true`, 8-second timeout, 512 KiB bound, JSON only, redirects refused. The only account writes are the follow behind the click-to-save emote gesture and its undo; `scripts/check.mjs` fails if a third appears.

## Competitive Landscape

**Mo'Kick** — 40,000 Chrome users, 4.6/5 across 105 ratings, 910 Firefox users at 3.55/5. Closed source, no repo. *Learn:* it proves demand for one all-in-one Kick tool at a scale nothing open source has reached. *Avoid:* everything about how it got there. Reviews from 2026-07-28 through 2026-09-04 report severe buffering after an update, windows going transparent, streams that will not open, a settings panel rendering as a thin strip, and a 2★ Firefox reviewer asking whether it is open source. Its chat module is reported to stop Kick's chat loading entirely. Kick Focus's answer already exists: a seven-page settings panel with a search index, a command menu, a panic switch that restores Kick natively without reload, and an artifact gate in the low hundreds of checks. ([CWS](https://chromewebstore.google.com/detail/mokick-better-kick-for-ev/lhjnnfenfahhjkmcngnocfclechcibkc), [AMO](https://addons.mozilla.org/en-US/firefox/addon/mokick/))

**7TV Extension** — 2,000,000 Chrome users, 163,490 Firefox, 467★, 189 open issues. Supports Kick; its last commit, 2026-07-30, is a Kick emote-menu anchor fix, but its last tagged release is v3.1.6 from 2025-03-04, so Kick users run nightly. *Learn:* the per-platform module directory (`src/site/{twitch.tv,kick.com,youtube.com}`) that isolates one site's churn from shared logic. *Avoid:* a picker with no virtualization, and shipping Kick fixes only through untagged nightlies. Open Kick bugs worth reading as a breakage ledger: [#1219](https://github.com/SevenTV/Extension/issues/1219) emotes not showing, [#1204](https://github.com/SevenTV/Extension/issues/1204) works on `www.kick.com` but not `kick.com`, [#811](https://github.com/SevenTV/Extension/issues/811) no emotes in VOD replay. Kick Focus matches both hosts already.

**BetterTTV and FrankerFaceZ** — neither supports Kick, and both refused deliberately. BTTV's maintainer closed the Kick PR on 2023-07-24 and parked demand in a discussion that has 27 upvotes and no comments since 2023-05-13 ([#6112](https://github.com/night/betterttv/issues/6112)). FFZ's Kick issue has been open since 2023-06-22 and a stub site adapter was opened and closed the same day, 2026-04-17 ([#1386](https://github.com/FrankerFaceZ/FrankerFaceZ/issues/1386)). *Learn from FFZ anyway:* settings **profiles** selected by composable context filters (`Channel`, `Category`, `Title`, `TheaterMode`, `Fullscreen`, `Time`), which is the general form of Kick Focus's route-scoped saved views and the basis for R-162. *Learn from BTTV:* `src/watcher.js` turns DOM mutations into semantic events (`chat.message`, `chat.notice_message`) so a markup reshuffle breaks one watcher instead of every feature.

**NipahTV** — 10,000 Chrome users at 4.8/5, 1,281 Firefox, 24★, 68 open issues, no LICENSE file. The closest architectural peer: userscript plus both extensions from one TypeScript source, IndexedDB with versioned migrations, usage-ranked emote search. *Learn:* its commit log is the best public ledger of Kick's private-endpoint churn — `/api/v1/video/:livestream_id` deleted 2026-07-29, header signature changed 2026-07-14, send-message payload changed 2026-07-13, and a March 2026 UI overhaul that broke username detection, replies, chat position and action buttons across four weeks. Budget for a break every four to eight weeks. *Avoid:* shipping without a licence.

**PureKick and the ad-blocker tier** — PureKick 20,000 users, Kick Ad Blocker 10,000, Kick Adblocker 2,000 at **2.6/5**. PureKick's repo now advertises live subtitles, AI dubbing, digital zoom and a "hype meter", so the category leader is becoming a general toolkit. New entrant ClearKick reached 43 daily Firefox users on v1.0.1 (2026-08-08). *Learn:* the 2.6/5 rating is what over-promising on ads costs. One listing states plainly that server-side in-stream video ads cannot be removed by a browser extension. Kick Focus's README already says the same thing; keep saying it.

**kick-third-party-emotes** ([jakubn11](https://github.com/jakubn11/kick-third-party-emotes)) — GPL-3.0, 2★, 59 Greasyfork installs, v2.11.0 on 2026-08-23. BTTV/7TV/FFZ federation, zero-width overlays, favorites, a tab inside Kick's native picker. *Learn:* the native-picker-tab placement. *Avoid:* provider federation — see Rejected Ideas.

**OverKick** ([Kristijan1001](https://github.com/Kristijan1001/OverKick)) — MIT, 0★, 10 installs, 2026-08-20. Cinematic chat overlay, auto-theater, forced quality, followed-channel slide-out. It is the only public precedent for the fullscreen chat overlay in R-117. Note that R-117's other citation, a "KickEnhance" Chrome listing, does not resolve to any extension: no repo, no AMO slug, no Greasyfork entry.

**Greasyfork** — 83 userscripts target kick.com and **none exceeds about 350 installs**. Demand ranks: forced quality (about ten scripts, top one 348 installs), a DGG embed helper (625), a comment scroller (332), a unique-chatter counter (292), daily-reward auto-claim (three scripts, 123/74/24). Layout scripts are marginal: auto-hide 75, ultrawide 73, auto-theater 41, left chat 17. *Read:* the daily-reward and layout work is well-aimed, the userscript tier is genuinely uncontested, and it is also small. **Do not build forced quality.** Kick tiers renditions by channel size, so 1080p often does not exist, and every such script's reviews say it stopped working.

**Multistream** — no extension does it in-page. Every competitor is a separate site: multikick.com, viewgrid.tv (up to 20 streams), multistream.watch. The one GitHub project, `wyvern800/multikick`, is 4★ and dead since 2024-08-09. Kick Focus's board is the single genuinely unoccupied feature it ships.

**Gumbo** ([Seldszar/Gumbo](https://github.com/Seldszar/Gumbo)) — MIT, 185★, 2026-08-30. *Learn:* MV3-correct polling, where the refresh handler reschedules its own `browser.alarms` entry so it survives service-worker death, and a diff-then-notify split so a re-fetch after a restart does not re-notify everything. Kick Focus's companion needs neither today: its blocklist refresh lives in the page realm, so it ticks only while a Kick tab is open, and the service worker's only timer is an 8-second fetch abort that an in-flight request keeps alive.

**Enhancer for YouTube** — 1,000,000 users, 4.66/5 across 12,390 ratings. *Learn:* one long options page of fieldset groups with a sticky sidebar of jump links, and deep-link anchors so in-page UI can open one specific setting. It is the proof that a searchable, categorized settings surface is what lets an all-in-one tool survive its own feature count — the thing Mo'Kick fails at.

**Alternate Player for Twitch** — archived 2026-03-05 and **delisted from the Chrome Web Store 2026-08-28**; 44,613 Firefox users remain. `TwitchAdSolutions` was archived the same day, its maintained fork now at [ryanbr/TwitchAdSolutions](https://github.com/ryanbr/TwitchAdSolutions). *Read:* both are the state of the art in worker-injection HLS rewriting, and both are cautionary. The delisting is the sharpest available datapoint for the operator's standing decision not to publish.

## Reported Issues

The public repository has no open or closed issues, no pull requests, and no discussions as of 2026-09-04 ([issues](https://github.com/SysAdminDoc/kick-focus/issues), [pulls](https://github.com/SysAdminDoc/kick-focus/pulls)); it has 0 stars and discussions are disabled. There is no tracker signal to prioritize from, and no `.github/` directory, `SECURITY.md`, `CONTRIBUTING.md`, or issue template exists, so a user who hits a Kick DOM break has no route to report it in a form the drift gates could consume. R-160.

Defects found by inspection and measurement, re-verified against the working tree on 2026-09-04:

- **Verified.** Roughly 24 user-visible strings on the search and Drops surfaces render English in Spanish and Portuguese, with dictionary entries that nothing reads (`src/runtime.js:3718`, `:3755`, `:3740`, `:3782-3796`).
- **Verified.** The bundle contributes nothing to the coverage table, so the global floor is measured over the importable modules only — the 42% of concatenated source that is not `runtime.js`, plus the build scripts (`test/coverage.test.js:25-31`, `scripts/coverage-floors.mjs`).
- **Verified.** The Viewer Hub's Channel points and Level cards have no signed-in journey, and Level is only read from the reward dialog's own figures (`src/runtime.js:10738`), so it reports "not read yet" unless that dialog is open. Channel points is read from the DOM on a channel route only (`src/runtime.js:10721`).
- **Verified.** A third-party origin that is not already in `AD_HOSTS` or `TELEMETRY_HOSTS` is never recorded anywhere (`src/runtime.js:607` records only blocked and removed).
- **Verified.** Forced-colors handling covers text-input focus rings only (`src/runtime.js:8701`), against 21 drawing `box-shadow` declarations and 3 gradients in `UI_CSS` (25 `box-shadow` occurrences, four of them `none`).
- **Verified.** `design-qa.md:191` still records the v1.42.0 run: 463 tests, 213 checks, 91 probes, 858,234 bytes. The same line reports "91,766 bytes below its injection ceiling", a figure measured against the 950,000 budget rather than the 1,000,000 ceiling (`src/runtime.js:1070-1071`), so it conflates the two numbers the build deliberately keeps apart.
- **Verified.** `R-117`'s KickEnhance citation resolves to no extension.
- **Likely.** `compatibilitySnapshot(document, …)` runs 59 probe entries plus 4 derived expectations inside every apply cycle (`src/runtime.js:7678`), on a page whose mutations debounce at 80 ms. The apply cost is already instrumented (`src/runtime.js:7689`), so the sweep's share is measurable before anything is changed.
- **Needs live validation.** Fixtures carry no capture date. Chrome's two-week stable cadence begins 2026-09-08, four days after this pass, which is the date `Roadmap_Blocked.md`'s R-77 waits on.

## Security, Privacy, and Reliability

The hardening is the strongest part of the codebase and no exploitable finding was identified.

- **DOM injection.** Exactly one `innerHTML` write exists in the tree, `setMarkup`, routed through a non-default Trusted Types policy; `scripts/check.mjs` asserts both facts against each bundle. There is no `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval`, or `new Function` anywhere. 256 `escapeHtml` calls across `src/` cover the untrusted paths.
- **`@connect *`.** One call site, `fetchBlocklistText`, `anonymous: true`, GET, 8-second timeout, behind `normalizeBlocklistUrl` in `src/core.mjs`. An imported settings file cannot arm it: an imported blocklist URL is honoured only when it equals the already-approved one. The wildcard is genuine because the host is user-chosen, but external guidance is uniformly against shipping one, and the README's own stated alternative — dropping `@connect` and letting the manager prompt per host — stays untested only because no manager is installed here. That is the same blocker as the cold-start matrix.
- **Message passing.** `background.js` validates extension id, sender origin against `KICK_ORIGINS`, and `chrome-extension://` scheme for popup-only actions, and refuses a Kick page naming another tab; `background.firefox.js` mirrors it for `moz-extension://`. `bridge.js` does not validate sender, which is sound because no `externally_connectable` is declared and its actions are UI-open events, and it allowlists forged page settings down to five fields. Companion presence uses a nonce round-trip rather than a page-writable attribute.
- **Response bounds.** Both backgrounds consume the blocklist body through a bounded streaming read that cancels the reader mid-stream, which closes the response-allocation gap the 2026-08-23 pass recorded as R-131.
- **Recovery.** Zero empty catch blocks in `src/`. Storage failures land in a per-key registry that surfaces a warning and retires on success; `gmSetMany` rolls back partial failures including keys that did not previously exist; quota is planned before the write. Every observed collection is capped. Three network catches are deliberate fire-and-forget with a DOM fallback, and the blocklist catch sets a `stale`/`error` status rather than swallowing.
- **What is not guarded.** A new Kick ad or telemetry host (R-156), and the mod's own UI under Windows High Contrast (R-159).

## Architecture Assessment

**Build.** No bundler. Each module is comment-stripped, has its `import`/`export` lines deleted, and is concatenated in dependency order into one IIFE, so concat order is the linker and two modules sharing a top-level name is a syntax error in the artifact. The same body string produces all three packages, so they cannot drift. `scripts/strip-comments.mjs` now also carries `compactCss`, which compacts every `NAME_CSS` template while preserving `${}` interpolations and escaped characters — re-measured 2026-09-04, only 47 bytes remain recoverable across all seven sheets, so that lever is spent. Four host-factory extractions exist: `createLibraryStore`, `createLive`, `createMultistream`, `createSettings`. R-114's emote-workspace extraction is the right next one and the precedent is clear.

**Where the bytes are.** In the built artifact: `TRANSLATIONS` 118,396 bytes, `SITE_CSS` 65,623, `UI_CSS` 53,877, the five smaller sheets 4,429. Together that is 27% of 886,138. Headroom is 13,862 bytes against the 950,000-byte injection budget and 63,862 against the 1,000,000-byte ceiling.

**Migration.** Covered and sound: the export payload carries a `schema` stamp, a non-finite stamp reads as unversioned rather than as a version, `upgradedUnversioned` reports the upgrade to the user, and the import validator works from an explicit known-key set. IndexedDB is at `LIBRARY_DB_VERSION = 1` with no upgrade path yet exercised. No new migration work is proposed.

**Test posture.** The gates are unusually good: `check.mjs` runs each of the six extracted copies of `normalizeBlocklistUrl` over a 16-case corpus rather than comparing their text, `csp.mjs` implements real directive precedence and intersection, and `expectFailure` red probes prove gates can fail — and `expectFailure` was confirmed available on Node 24.19.0, against a secondary source claiming it landed later. Two structural holes remain. The first is coverage (R-153). The second is that Chromium owns roughly a hundred journey checks and Firefox eight, which is R-111 and still open.

**Refactor candidates.** The emote workspace is R-114. The settings event delegation is what makes R-147 unwritable today. `installNetworkDefense` is the one place a page-realm mistake is unrecoverable and is worth extracting for its own pure tests before it grows further.

**Documentation.** `design-qa.md`'s verification block is several releases behind (R-161). The README's live proof was current at v1.45.0.

## Rejected Ideas

- **Compact every `_CSS` template at build time.** Drafted this pass, then found implemented in the concurrent v1.48.0 work: `scripts/strip-comments.mjs` gained `compactCss` and the hardcoded `SITE_CSS` regex left `scripts/build.mjs`. Measured before and after — 14,433 bytes were available on 2026-09-04 against v1.45.0, and 47 remain today. Recorded so the lever is not re-investigated.
- **Add `aria-expanded` to the emote tile's action group.** Drafted this pass against a `data-kf-open` group with `role="group"` and no expanded state; the concurrent emote rebuild replaced it with `data-kf-sticker-manage-tile`, which sets `aria-expanded` in its markup and keeps it in sync on patch. Closed by that work.
- **Ship the es/pt dictionary gzipped and base64-encoded, decoded through `DecompressionStream`.** Measured 2026-09-04: it would cut about 67,000 bytes, and English users would never decode. Rejected because Greasy Fork bans minification as well as obfuscation, the README stakes the project's catalogue eligibility on being readable as built, and an opaque blob is exactly what a reviewer cannot audit.
- **Unhook's static-CSS element hiding** (1,000,000 users, 37 KB, `hide_*` keys mirrored as root attributes, zero MutationObserver). Rejected because `tagHideableElements` deliberately refuses to hide when the recorded probe is not the one that won, and when a selector matches more than four nodes. A CSS selector cannot express "which probe won", so adopting the model would trade a fail-safe for a performance win the apply-cost instrument does not say is the bottleneck.
- **7TV's per-site module directory.** Rejected: it exists to isolate three platforms from each other, and Kick Focus targets one site.
- **SponsorBlock's hash-prefix lookup and Return YouTube Dislike's hashcash-per-write.** Both are the correct designs for crowdsourced or synced data without surveillance. Rejected because remote sync and crowdsourced data are themselves rejected below; recorded so a future sync proposal starts from the right primitive instead of inventing one.
- **Forced 1080p / quality forcing.** The single most-implemented Kick userscript feature, about ten scripts on Greasyfork. Rejected: Kick tiers renditions by channel size so the rendition frequently does not exist, and the reviews on every such tool say it stopped working. `rememberQuality` — restoring the choice the user made — already ships and is a different thing.
- **VOD or clip downloading.** A real category (streamlink now ships `kick.py`; kicknosub.com exists) driven by Kick's 7-day unverified / 30-day verified retention. Rejected: it means a media pipeline, and Kick's `/playback` URL is single-use, so it cannot be done without the endpoint replay the project's own contract forbids. The VOD expiry countdown already ships.
- **Chat translation.** Now shipped by a competitor (`Pkkls/kick-chat-translator`, 2026-09-01, four providers, 42 languages). Rejected unchanged: it sends chat text to a remote service, which breaks the no-remote-calls posture the whole product is built on.
- **Third-party emote federation, remote cloud sync, a custom composer, a modal replacement picker, a plugin marketplace, automatic comment sending, full moderation controls, AI captions and generated replies, custom page-wide keyboard shortcuts, SSAI bypass, and entitlement bypass.** All rejected in the 2026-08-23 pass for reasons that still hold.
- **Switching emote discovery to Kick's official API.** Rejected again with fresher evidence: the [docs.kick.com](https://docs.kick.com/) changelog's newest entry is dated 02/12/2025, nothing shipped in all of 2026, there are still no emote, VOD or clip endpoints, [KickDevDocs #323](https://github.com/KickEngineering/KickDevDocs/issues/323) (emotes) has been open since 2025-12-29, [#20](https://github.com/KickEngineering/KickDevDocs/issues/20) (websocket events) is still open, and [#413](https://github.com/KickEngineering/KickDevDocs/issues/413), opened 2026-08-30, confirms public OAuth clients still cannot avoid a `client_secret`.
- **`Element.setHTML()` in place of the Trusted Types passthrough.** Rejected in the 2026-08-20 pass and still: `<base>` is not removed from the sanitizer's allowlist in the shipping engines.

## Sources

### Repository
https://github.com/SysAdminDoc/kick-focus ·
https://github.com/SysAdminDoc/kick-focus/releases ·
https://github.com/SysAdminDoc/kick-focus/issues

### Kick platform and developer surface
https://docs.kick.com/ ·
https://github.com/KickEngineering/KickDevDocs/issues/323 ·
https://github.com/KickEngineering/KickDevDocs/issues/20 ·
https://github.com/KickEngineering/KickDevDocs/issues/413 ·
https://kick.com/terms-of-service ·
https://help.kick.com/en/articles/14994226-browser-compatibility-and-recommended-settings-for-kick ·
https://help.kick.com/en/articles/15638073-why-1080p-may-not-be-available-on-your-channel ·
https://help.kick.com/en/articles/15715119-daily-rewards-on-kick

### Kick client mods
https://chromewebstore.google.com/detail/mokick-better-kick-for-ev/lhjnnfenfahhjkmcngnocfclechcibkc ·
https://addons.mozilla.org/en-US/firefox/addon/mokick/ ·
https://github.com/Xzensi/NipahTV ·
https://github.com/jakubn11/kick-third-party-emotes ·
https://github.com/Kristijan1001/OverKick ·
https://chromewebstore.google.com/detail/purekick-ad-blocker-for-k/mhicbhkhokaocipkioiibmficljoijnf ·
https://addons.mozilla.org/en-US/firefox/addon/clearkick-ad-blocker-for-kick/ ·
https://greasyfork.org/en/scripts/by-site/kick.com ·
https://github.com/topics/kick-tools

### Mature client mods worth learning from
https://github.com/SevenTV/Extension/tree/master/src/site/kick.com ·
https://github.com/SevenTV/Extension/issues/1219 ·
https://github.com/SevenTV/Extension/issues/1250 ·
https://github.com/SevenTV/Extension/pull/1252 ·
https://github.com/SevenTV/Extension/pull/1247 ·
https://github.com/night/betterttv/blob/master/src/watcher.js ·
https://github.com/night/betterttv/issues/6112 ·
https://github.com/FrankerFaceZ/FrankerFaceZ/issues/1386 ·
https://github.com/Seldszar/Gumbo/blob/main/src/background/index.ts ·
https://github.com/besuper/TwitchNoSub ·
https://github.com/ryanbr/TwitchAdSolutions ·
https://github.com/ajayyy/SponsorBlockServer/blob/master/src/utils/hashPrefixTester.ts ·
https://addons.mozilla.org/en-US/firefox/addon/enhancer-for-youtube/

### Userscript managers and extension platforms
https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0 ·
https://github.com/violentmonkey/violentmonkey/releases/tag/v2.48.0 ·
https://www.tampermonkey.net/changelog.php ·
https://developer.chrome.com/docs/extensions/reference/api/userScripts ·
https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline ·
https://developer.chrome.com/docs/extensions/whatsnew ·
https://blog.mozilla.org/addons/2026/07/23/firefox-153-webextensions-api-updates/ ·
https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts ·
https://developer.chrome.com/blog/chrome-two-week-release

### Standards and accessibility
https://www.w3.org/TR/WCAG22/ ·
https://www.w3.org/WAI/ARIA/apg/patterns/grid/ ·
https://www.w3.org/WAI/news/2026-03-03/wcag3 ·
https://webstatus.dev/

### Verification tooling
https://chromedevtools.github.io/devtools-protocol/ ·
https://developer.chrome.com/blog/removing-headless-old-from-chrome ·
https://groups.google.com/a/chromium.org/g/chromium-extensions/c/FxMU1TvxWWg ·
https://developer.mozilla.org/en-US/docs/Web/WebDriver/Reference/BiDi/Modules/webExtension ·
https://nodejs.org/api/test.html

### Security
https://www.waze.com/discuss/t/urgent-two-scripts-were-compromised-on-feb-1/365499 ·
https://www.csoonline.com/article/4215792/trusted-chrome-edge-extensions-weaponized-in-supply-chain-campaign.html

## Open Questions

1. **Needs live validation.** What does Kick render for Channel points and Kick Levels to a signed-in account, and which selectors survive a route change? Nothing can be built for `Roadmap_Blocked.md`'s R-55 until one signed-in run records it, and R-154 exists to tell that run where to look.
2. **Operator decision.** Whether to adopt an install path other than copy-and-paste. Every release since v1.44.0 attaches `kick-focus.user.js`, so one-click install already works from the asset URL, but a manager with no `@updateURL` treats the install URL as its update source, which makes this the same decision as R-24/R-45 rather than a way around it.
3. **Needs live validation.** Whether Kick's help centre still contradicts itself on whether a channel subscription removes ads. It did on 2026-08-21; `help.kick.com` returns 403 to automated fetches from this environment, so it could not be rechecked on 2026-09-04.
4. **Unmeasured.** Reddit's Kick communities are login-walled to every automated path tried on 2026-09-04, so the community-demand ranking still rests on the 2026-07-01 to 2026-08-15 sweep: player reliability first, ad-blocker breakage of signup and follow second, collectibles opacity third, and viewer-side multi-view demand a measured zero.
