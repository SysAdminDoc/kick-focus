# Roadmap

Updated: **2026-08-15**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next — ordered by value

1. **Authenticated companion journey at both desktop viewports.** Load the unpacked extension in a throwaway profile that the user signs into directly, then repeat Home → Browse → Following → Drops → Search → Channel/chat at 1440×900 and 1920×1080. The isolated in-app browser supplied authenticated recon, while the extension proof used a separate logged-out profile; session data must never be exported between them.
2. **Worker-level stitched-ad observability.** Prototype a bounded `Worker`-constructor wrapper around the IVS worker and record only manifest/ad-signifier counts. Ship a mitigation only if it can separate ad media without replaying private endpoints, breaking playback, or proxying traffic. The current page-realm fetch/XHR hooks cannot see the worker-owned HLS manifest. (2026-08-15: check the cheaper question first — Chrome documents a request's initiator as the creating document's origin, so the companion's existing `initiatorDomains: ["kick.com"]` rules may already observe worker-initiated segment requests that the page realm cannot. Measure that before building the wrapper. Note also that the AdGuard "stitched-ad redirect rule" reported for 2026-08-14 **does not exist** — see Rejected Ideas in RESEARCH.md — so there is no external rule to copy.) **2026-08-16: SUPERSEDED by R-09 — the IVS Web Player SDK emits first-party `AD_BREAK_STARTED/ENDED` events, a clean read-only path to ad-break state without touching the worker. Do R-09 instead of the wrapper.**
3. **Automated Kick DOM drift snapshots.** Add a maintainer-only reducer that turns fresh MHTML/live captures into small, sanitized fixtures and fails when stable probes disappear on Home, Browse, Following, Drops, Search, Category, Channel, or the open sticker picker. Keep raw captures ignored.
4. **Live Firefox companion proof.** Exercise the generated Manifest V2 package in a disposable Firefox profile, proving `webRequestBlocking`, page/bridge handshake, popup state, and current Kick DOM behavior. Firefox requires target and initiator host access for this API, so document the `<all_urls>` warning alongside the Kick-initiator runtime guard. (2026-08-15: this proof will fail as written — the initiator guard reads a Chromium-only field. Land the P0 fix below first, or this item just rediscovers it.) **2026-08-16 corrections: the Firefox `initiator` fix already landed in v1.5.0 (commit 9626411) — that inline note is stale. Also, this proof will find the popup dead on arrival (R-14: the Chromium promise-API `popup.js` is copied verbatim into the Firefox zip). Unblocked by R-01 (install Chromium/Firefox); coordinate with R-14.**
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

### API and emote-catalog work (added 2026-08-15 from the Kick API + emote tooling research)

Gate for this whole group: the deferred list rules out "replay of private endpoints". These items read endpoints the page already calls, same-origin, read-only, inheriting the user's own session, and every one keeps the existing DOM path as fallback. Settle that boundary before starting.

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

- [ ] R-05 — Harden every privileged fetch/transport path (bridge forgery, ruleset/storage write, spoofable "protection", cookie-leaking blocklist fetch)
  Why: any kick.com page script can drive a privileged arbitrary-HTTPS fetch and read the body, permanently disable the telemetry ruleset via unvalidated JSON, and spoof the "network protection active" claim; separately the userscript blocklist transport sends ambient cookies to any host and accepts any URL string with no scheme check.
  Evidence: phase0-memo #5,#6,#7 + §5B (adopt HIGH) — src/extension/bridge.js:106-115,48-59; background.js:60-77,35-41; runtime.js:173-176,3748-3760; src/core.mjs:211 (blocklistUrl, no scheme check); src/metadata.txt:19 (`@connect *`).
  Touches: bridge.js/bridge.firefox.js, background.js/background.firefox.js, companionInfo() in runtime.js, fetchBlocklist GM_xmlhttpRequest path in runtime.js; blocklistUrl normalize in core.mjs; settings schema.
  Acceptance: fetch-blocklist pinned to the configured blocklistUrl only; settings-changed payloads validated against the existing schema before any storage/ruleset write; companion presence proven by round-trip not by `<html>` dataset; GM_xmlhttpRequest sends `anonymous:true` (no ambient cookies); blocklistUrl is https-scheme-validated at normalize time in core.mjs under node:test; guards covered via the companion.test.js vm pattern.
  Complexity: L

### P1 — operator demand first, then trust / reliability / accessibility

- [ ] R-06 — Realtime chat-emote harvest (operator-requested)
  Why: the operator's "scan chats to collect emotes" — realtime frames carry `.emotes [{id,name}]` per message then discard them; mergeStickerLibrary is never called from the realtime path.
  Evidence: phase1b E3 (design-check CONFIRMED-WITH-CONDITIONS) — src/runtime.js:1916-1937,3089-3131; src/api.mjs:21,517-534; depends on R-02.
  Touches: pure `observationsFromChatEmotes(emotes,urlFn)` in core.mjs; ~6 lines in onRealtimeChatMessage (runtime.js:1920) + the gate at the early-return runtime.js:1922.
  Acceptance: pure function in core.mjs under node:test + gate in check.mjs — gated behind existing `liveChatEvents && organizeChatStickers` (NO new toggle), feeds the existing 120ms chatStickerPending buffer, and frame-only (never DOM-corroborated) entries commit ONLY after a one-shot Image() load succeeds (~4 in flight, per-session negative cache) so crafted `[emote:999999:Fake]` tokens can't burn cap slots; also merges id-keyed and name-keyed entries. Must land on top of R-02 (cap fix) — a node:test proves a full library evicts an observed entry rather than dropping the new one.
  Complexity: S

- [ ] R-07 — One-click "Add to Multi" from channel pages + feedback (operator-requested)
  Why: the operator's "one-click Multi from video page" — the only add flow today is a typed panel input, and persistMultistream has a deterministic lost-update race in two-tab use.
  Evidence: phase1b M1/M2/M3 (design-check CONFIRMED-WITH-CONDITIONS) — src/runtime.js:6884-6989,2461-2476,2125-2127; src/core.mjs:1402-1416,1415.
  Touches: pure `mergeMultistream(stored,current,added,removed)` in core.mjs; ensureHeaderQuickControl/syncQuickButton in runtime.js; showToast action-button param; announce().
  Acceptance: pure merge in core.mjs under node:test (all two-tab interleavings; persist RE-READS-MERGES-WRITES, no boot-snapshot clobber) + third header button visible when `route==='channel'` → addMultistream(slug) → "In Multi ✓", STAYS ON PAGE (never auto-opens grid, never navigates), live "Multi (n)" badge + named toast "Added xqc — 3 of 9" with [View]/[Undo] and announce() for SR.
  Complexity: M

- [ ] R-34 — Test the existing emote-schema 1→5 migration paths
  Why: STICKER_PREFERENCES_SCHEMA has migrated four times and no test or dimension ever read a migration path — the memo's named highest-risk unexamined area, and R-02/R-03/R-04 all touch this data.
  Evidence: phase0-memo §4 (coverage gaps) — src/core.mjs migration paths under normalizeStickerPreferences / schema handling.
  Touches: extract each documented 1→2…4→5 migration step into a pure function if not already; test/core.test.js.
  Acceptance: a node:test loads a fixture at each historical schema version and asserts the 1→5 upgrade is lossless (favorites, groups, provenance preserved); a deliberately corrupted intermediate makes it fail.
  Complexity: M

- [ ] R-09 — IVS player ad-break observability (supersedes "Next" item 2)
  Why: the IVS Web Player SDK emits first-party AD_BREAK_STARTED/ENDED, AD_CREATIVE_STARTED, AD_TIME_UPDATE — authoritative read-only ad-break state without touching the manifest or WASM worker.
  Evidence: ads-ssai stream — aws.github.io amazon-ivs-player-docs PlayerEventType/AdBreak; supersedes ROADMAP "Next" item 2.
  Touches: runtime.js player-instance discovery + read-only listener; a countdown/"ad break" indicator in the UI.
  Acceptance: a read-only listener attaches to Kick's own player instance and drives an "ad break" countdown indicator; observes only (never scrubs, never opts out via the signed JWT); NEEDS LIVE VALIDATION that the player instance is page-world reachable — if it is not, record the finding in RESEARCH.md and close the item rather than reaching into the worker.
  Complexity: M (optimistic — evaporates to S-doc if the player instance proves page-world-unreachable)

- [ ] R-10 — Add a boot-execution gate that actually runs runtime.js
  Why: no offline gate executes the product — a TDZ read or bad const ordering across the four-module concat passes every offline gate and surfaces only in the (currently unrun) live harness.
  Evidence: phase0-memo #2 — package.json:9; test/companion.test.js:89-128; src/runtime.js:39-166,7057-7083.
  Touches: new test using the companion.test.js `vm.runInNewContext` + stub pattern against the built bundle.
  Acceptance: a node:test boots the concatenated bundle in vm with hand-written stubs and asserts it reaches its boot marker; a deliberately mis-ordered const makes the test fail (expectFailure).
  Complexity: M

- [ ] R-11 — i18n correctness + coverage
  Why: the hand-built "1 emote / N emotes" plural is wrong in es AND pt (CLDR 48 gives both a "many" category), ~83 strings are never translated, and showToast writes textContent without localizing so ~30 toasts stay English.
  Evidence: phase0-memo #15 — src/runtime.js:5376-5386,4091,6661-6669; test/i18n-coverage.test.js:39-49; a11y-i18n stream (CLDR 48, Intl.PluralRules Baseline since 2019).
  Touches: Intl.PluralRules in the plural helper; localize showToast/announce/attribute literals; extend i18n-coverage gate scanner.
  Acceptance: pure plural helper uses Intl.PluralRules (verified against es/pt "many" under node:test); i18n-coverage gate scans toast/announce/attribute literals (not just row()/pageHeader()/tr()) and fails on the missing ~83 strings until translated.
  Complexity: M

- [ ] R-12 — Fix the accessibility regressions the audit enumerated on a product that ships an accessibility page
  Why: whole-page innerHTML replacement drops focus/scroll on every toggle; forced-colors erases every selected state; toasts have no live region; the reset dialog's focus trap escapes into obscured content; sliders lack aria-valuetext; the "larger targets"/"reduce motion" settings are inert for the mod's own controls.
  Evidence: phase0-memo #3,#18,#19,#26,#27,#28,#29 — src/runtime.js:4119,5965-5968,4611-4630,5482-5483,6661-6669,3528,5427-5436,6786-6798,5540-5553,6352-6360,4306-4314,1296,1266,1236.
  Touches: preserve focus/scroll via the existing rememberStickerGridScroll pattern; forced-colors state rules in UI_CSS; role/aria-live on toast + save nodes reusing the sr-only region at runtime.js:5483; reset alertdialog trapFocus scope + Escape handling; slider aria-valuetext + real accessible names; make largeTargets/reduceMotion CSS actually key the mod's own controls.
  Acceptance: toggling a setting deep in a page keeps focus and scroll position; forced-colors shows which switch/theme/accent/page is selected; toasts announce via a live region (errors as role="alert"); the reset dialog traps focus to itself and Escape cancels only the dialog; sliders expose aria-valuetext and non-dotted names; largeTargets/reduceMotion visibly affect `.kf-switch`/`.kf-ms-bar`; a fixture or node:test asserts the aria wiring.
  Complexity: L

- [ ] R-13 — De-vacuum the verification story (empty-list gates, unfireable exfil gates, ungated matches, untested shortcuts)
  Why: ~11 DNR gates pass on an empty host list, both "stays on kick.com" exfil gates match 0 against the template-interpolated bundle, content_scripts[].matches is gated on neither manifest, and normalizeShortcut has zero tests while README:85 advertises conflict rejection.
  Evidence: phase0-memo #17,#20,#21 — scripts/check.mjs:119,127-135,264-267,273-275,329-331,366-367; the missingExports pattern at check.mjs:36-47; src/core.mjs:131-141,232-235; README.md:85.
  Touches: check.mjs gate inputs derived from source; adopt node:test expectFailure for red-verification; test/core.test.js shortcut coverage.
  Acceptance: DNR gates fail on an empty AD_HOSTS/telemetry list; a synthetic off-origin `fetch(\`${EVIL}/api/v1/log\`)` fails the exfil gate; a `matches:["<all_urls>"]` manifest fails a gate; normalizeShortcut conflict rejection is tested; each rewritten gate has an expectFailure red-test proving it can fire.
  Complexity: M

- [ ] R-14 — Make the Firefox popup work and keep the dev manifest out of the release zip (pairs with "Next" item 4)
  Why: the build copies the Chromium promise-API popup.js verbatim into the Firefox zip so `chrome.tabs.query` returns undefined and the popup shows static defaults forever; manifest.dev.json is also zipped into the release archive; the live gate calls a feedback-gated API the release manifest can't grant.
  Evidence: phase0-memo #9,#10 — src/extension/popup.js:25,42,88; scripts/build.mjs:72-76,117,148; verify-extension.mjs:71,346,377-378.
  Touches: Firefox popup shim (browser||chrome + callback alias); build.mjs zip tree exclusion; the release manifest's feedback-gated API usage; cross-reference "Next" item 4's live Firefox proof.
  Acceptance: a Firefox-target popup gate asserts the shim is used and the popup renders live counts; the release zip contains no manifest.dev.json; the live gate does not call an API the release manifest cannot grant.
  Complexity: M

### P2 — quick wins, operator second-wave, platform modernization, dev-experience

- [ ] R-35 — Split the multi-stream and live-data surfaces out of `src/runtime.js` (unblocked 2026-08-16)
  Why: was in Roadmap_Blocked.md solely because its acceptance needs the live harness AND no Chromium existed here; Chromium is now installed and `verify:extension` passes 22/22 live, so the blocker is lifted. `src/runtime.js` is ~6,651 lines; moving ~1,500 across the concat boundary is exactly the change the api.mjs-went-missing trap exists for.
  Evidence: former Roadmap_Blocked P2 entry; CLAUDE.md concat-order + `source.includes` gotchas; build.mjs:11-29 concat order core→api→compatibility→runtime.
  Touches: extract multi-stream + live-data into a new bundled module inserted in the correct concat position in build.mjs; keep every export reachable under `node --test` (not just in the hoisted bundle).
  Acceptance: `npm run verify` green AND `npm run verify:extension` green after the move (a green offline build alone does not prove a refactor equivalent); no symbol asserted only by `source.includes`; bundle parses under `node --check`.
  Complexity: L

- [ ] R-33 — Add a failure-observability surface (log + last-crash)
  Why: no dimension could find any way failures surface — no log surface, no crash file — though the project's own conventions require one; a client mod on a churning site fails silently today.
  Evidence: phase0-memo §4 (coverage gaps: "no log surface, no crash file, and the project's own convention requires one"); the About page already carries a "protection log"/"diagnostics" surface to extend.
  Touches: a bounded in-memory ring buffer + a "Diagnostics" panel on the About page; a stored last-error record; window 'error'/'unhandledrejection' capture scoped to the mod's own frames.
  Acceptance: uncaught errors from the mod's own code are captured to a bounded local log the user can view and copy (sanitized, no query strings — matching the existing protection-log discipline); a last-crash summary persists across reload; nothing is sent anywhere.
  Complexity: M

- [ ] R-16 — In-chat emote tooltips + favorite-from-chat (operator-requested)
  Why: KF enhances nothing about emotes in the stream today though name/set/access/first-seen/collision data is already held.
  Evidence: phase1b E4 — src/runtime.js:1762,3216; FrankerFaceZ #110; BTTV #5925.
  Touches: pure `emoteTooltipText(entry,collisions)` in core.mjs; delegated mouseover + singleton tooltip + star toggle in runtime.js.
  Acceptance: pure function in core.mjs under node:test + delegated tooltip shows name·set·access·shadow-warning with a star-to-favorite toggle; filters by CDN host files.kick.com so 7TV-injected imgs are ignored; tooltip is pointer-events:none and position-clamped.
  Complexity: M

- [ ] R-17 — Make chat-'observed' emotes usable: copy-name first, gated name-insert second (operator-requested)
  Why: observed emotes are dead weight outside the library manager; users want to use them without an entitlement bypass.
  Evidence: phase1b E5 (design-check CONFIRMED-WITH-CONDITIONS) — src/runtime.js:2716-2717,5811,6249-6258; src/api.mjs:481-482; README.md:105,114.
  Touches: pure `insertionPlanFor(descriptor,collisions,access)` in core.mjs; clipboard copy + focus/caret/execCommand in runtime.js; off-by-default setting.
  Acceptance: pure function in core.mjs under node:test — inserts the plain NAME only (never the `[emote:id:name]` wire token or id — that is an entitlement bypass), NO auto-send ever (no synthetic Enter, no send-button click, never targets multi-stream embedded chat), insertion via `execCommand('insertText')` with NO raw textContent fallback, warns on shadowed names; copy-name ships unconditionally, insert-into-input behind an off-by-default setting.
  Complexity: M

- [ ] R-18 — Picker "Most Used"/recent sections + organizer scale pass (operator-requested)
  Why: 7TV/BTTV ship recency/frequency sections KF lacks, and full innerHTML rebuilds break down before the 2400 cap does — urgent once R-06 inflates the library. (Two independent features: presentational Most-Used, and the organizer windowing pass.)
  Evidence: phase1b E7/E8 — src/runtime.js:3443,3472-3529,5688-5767; SevenTV discussion #379; FFZ emote_menu.jsx.
  Touches: pure top-N-with-recency + `visibleWindow(entries,anchor,size)` in core.mjs; section IntersectionObserver + placeholders, ~120ms debounced search, in-place dataset patch, content-visibility + loading=lazy in runtime.js.
  Acceptance: pure ordering/window functions in core.mjs under node:test — presentational over existing usage counts, EXCLUDES hold-to-spam/turbo/pyramid; organizer renders a window (not full 2400) with placeholder swap (NOT full virtualization) and debounced search, toggles patch in place rather than full-rebuild.
  Complexity: L

- [ ] R-19 — Per-card "+ Multi" chip on discovery surfaces + cross-tab converge + shared-link toast (operator-requested)
  Why: collect channels without opening them, converge adds across tabs, and warn when `?kf-multi=` silently overwrites a mid-collection set. (M4 chip + M5 cross-tab BroadcastChannel convergence + M7 toast; M5 alone is the heavy part.)
  Evidence: phase1b M4/M5/M7 (design-check CONFIRMED-WITH-CONDITIONS) — src/runtime.js:2628-2666,7035-7055; bridge.js:81; src/metadata.txt:10-18.
  Touches: pure `cardSlugFromPath`/`mergePresence` in core.mjs; third button in applyCardActions; BroadcastChannel('kick-focus:multi'); openSharedLayoutFromUrl toast.
  Acceptance: pure slug/merge functions in core.mjs under node:test + hover chip renders active state against state.multistream; BroadcastChannel add/remove ops are set-union idempotent with re-read-on-open covering missed broadcasts (extension builds fully supported via shared localStorage + storage events; userscript gets GM_addValueChangeListener as an ENHANCEMENT not a correctness dependency; kick.com vs www.kick.com origin split handled); shared-link boot shows an overwrite toast.
  Complexity: L

- [ ] R-20 — Platform modernization that removes code / improves perf (both engines)
  Why: constructable adoptedStyleSheets, Navigation API, Custom Highlight API, content-visibility and scheduler.yield delete re-parsing, history monkey-patching, DOM writes and long tasks — all Baseline on both target engines.
  Evidence: web-platform + perf-storage streams — adoptedStyleSheets (Baseline 2025-09-27), Navigation API (2026-01-13/FF147), Custom Highlight API (2026-03-24), content-visibility (2025-09-15, 232ms→30ms), scheduler.yield (Chrome 129/FF142).
  Touches: shadow-root CSS injection; the MutationObserver/URL-polling apply cycle; search highlight; emote grid rendering.
  Acceptance: CSS is adopted once per shadow root (may drop `!important` armor where the adopted sheet wins ties); route changes read from the Navigation API with history monkey-patching removed; search highlights write zero nodes into Kick's tree; all features are feature-detected (never version-sniffed) so the Firefox artifact degrades cleanly; a before/after perf.measure shows the apply-cycle cost drop.
  Complexity: L

- [ ] R-21 — Storage durability + batch writes
  Why: not a quota problem (library is 10–30% of Chrome's 10MB budget) but two silent-total-loss threats (kCommitErrorThreshold=8 wipes the origin; 400-day stale-bucket deletion) and per-emote synchronous writes are the jank source.
  Evidence: perf-storage stream — Chromium dom_storage_constants.h (kCommitErrorThreshold=8, kLocalStorageStaleBucketCutoffInDays=400); FFZ #1026; GM_setValues/GM_getValues batch APIs (Tampermonkey 5.3+/Violentmonkey).
  Touches: transactional import (stage→validate total serialized size→commit) in core.mjs/runtime.js; batch GM_setValues/GM_getValues in the userscript storage path.
  Acceptance: import is transactional under node:test (a mid-write quota failure leaves the prior state intact, never half-applied); the userscript build writes via GM_setValues batch rather than per-emote setValue.
  Complexity: M

- [ ] R-22 — Adopt stable zero-dep node:test upgrades
  Why: Node 22/24 shipped partialDeepStrictEqual, snapshots, test tags and coverage-include-all that raise the testing floor without a single package.
  Evidence: testing stream — assert.partialDeepStrictEqual (v24/v22.17), --experimental-test-tag-filter (v24.19/v26.2), --test-coverage-include-all (v26.7.0), expectFailure (v24.14.0).
  Touches: existing test suite assertions; a tag split for offline vs live-browser gates; coverage config.
  Acceptance: API-drift assertions use partialDeepStrictEqual (tolerant of added fields); offline and live-browser gates are tag-separated in one suite; coverage-include-all runs and exposes wholly-untested files; jsdom/happy-dom and Node's built-in localStorage are explicitly NOT adopted.
  Complexity: M

- [ ] R-23 — Document what the project cannot and should not claim (and fix the doc drift)
  Why: SSAI cannot be client-removed, the legal posture has newly-explicit conflicts, the Firefox/userscript install realities are unstated, and CLAUDE.md/README have drifted from the code.
  Evidence: kick-platform + ads-ssai + distribution streams + phase0-memo §5H — aws:ads-opt-out in signed JWT; Kick Developer Terms + consumer ToS; BGH I ZR 131/23 (2025-07-31); CLAUDE.md:7,9,11 (Node floor, "~4,650 lines" vs 6,651, missing api.mjs); README.md:138,162-173.
  Touches: README.md, CLAUDE.md.
  Acceptance: README states forcefully that SSAI is not client-removable, documents the ToS/Developer-Terms/BGH exposure (esp. full-shell restyle vs §69c UrhG), and records the Firefox unsigned-XPI reality + Violentmonkey "Alternative page mode"; CLAUDE.md line count/Node floor/build description are corrected and the README repo map lists api.mjs and compatibility.mjs; README:138's live-proof claim is corrected (see R-01).
  Complexity: S

- [ ] R-24 — Establish a remote + stable HTTPS URL so the userscript can auto-update (operator-gated)
  Why: the userscript is the only artifact reaching Windows/macOS users but cannot auto-update because there is no git remote → no @downloadURL/@updateURL.
  Evidence: distribution stream — Greasy Fork @version+@downloadURL; Firefox update_hash sha256; conflicts with the ROADMAP "no publication without explicit approval" deferral.
  Touches: git remote; src/metadata.txt (@version/@downloadURL/@updateURL); Firefox updates.json update_hash.
  Acceptance: OPERATOR-GATED — on explicit approval only, a stable raw HTTPS URL is wired into @downloadURL/@updateURL and a manager detects a version bump; Firefox self-hosted updates.json carries a sha256 update_hash. Do not publish without approval.
  Complexity: M

### P3 — differentiators, larger bets, future-proofing

- [ ] R-25 — Colon-trigger autocomplete popup (operator-requested)
  Why: the field-standard #1 emote feature (7TV, KickTalk, NipahTV), missing from KF.
  Evidence: phase1b E6 — Chatterino #1962/#3440 as ready tests; SevenTV ChatInput.vue; uses R-17's insertion backend.
  Touches: pure ranking in core.mjs; popup + native-suggester conflict ladder in runtime.js.
  Acceptance: pure ranking in core.mjs under node:test (prefix>substring; tiebreak favorite/per-channel-usage/global-usage/name-length; Chatterino #1962/#3440 collisions as fixtures); insertion reuses R-17's boundary — plain NAME only, never the wire token, NO auto-send ever; mouse-only click-to-accept is the shipped default — Tab/arrow/Enter capture ships ONLY on explicit operator sign-off (no-new-shortcuts rule).
  Complexity: L

- [ ] R-26 — Cross-channel emote browser tab (operator-requested)
  Why: genuinely uncontested space on Kick; public GET kick.com/emotes/{slug} already exists.
  Evidence: phase1b E9 — src/api.mjs endpoint class; NipahTV roadmap-only; external cpwemotes.co.uk / kickstats.com/emotes.
  Touches: on-demand fetch + local cache in runtime.js; entitlement-aware locked labels; per-channel-scoped Multi pickers.
  Acceptance: browsing one channel's emotes on demand, cached locally, with locked/observed labels; insertion stays entitlement-gated (reuses R-17 boundary — plain name only, no auto-send); no bulk pre-fetch.
  Complexity: M

- [ ] R-27 — "Add open tabs (n)" roll-call (operator-requested)
  Why: tabs-to-grid UX with zero permissions in both builds.
  Evidence: phase1b M6 — BroadcastChannel request/response; after R-19.
  Touches: pure `mergePresence(entries,now)` in core.mjs; BC roll-call in runtime.js.
  Acceptance: pure function in core.mjs under node:test + a BC request collects each open tab's slug into a one-click "Add open tabs (n)" offer with stale entries expiring by ts; zero new permissions.
  Complexity: M

- [ ] R-28 — Kick Drops read-only viewer panel
  Why: a fully-documented first-party surface nobody surfaces read-only; MSI 2026/Riot partnership is a demand driver.
  Evidence: kick-platform + kick-mods streams — docs.kick.com /drops routes (/campaigns, /coming-soon, /claimed, Inventory).
  Touches: read-only Drops fetch + panel in runtime.js.
  Acceptance: a panel shows the user's own Drops campaigns/progress read-only with no auto-claim path anywhere in the code; NEEDS LIVE VALIDATION that a read-only Drops endpoint is reachable with the user's session — if it is not, record the finding in RESEARCH.md and close the item.
  Complexity: M

- [ ] R-29 — IndexedDB provider abstraction behind one proxy
  Why: raises the library cap orders of magnitude and adds a blob store + cross-tab sync, with localStorage as the -1000 fallback.
  Evidence: twitch-mods + perf-storage streams — FFZ providers.ts (priority-scored providers, quota-exceeded event, BroadcastChannel); NipahTV Dexie schema (borrow shape only, Dexie is a DEP).
  Touches: ~150-line zero-dep IDB wrapper behind a proxy; separate blob store; BroadcastChannel sync.
  Acceptance: a zero-dep IDB provider fronts library storage with localStorage fallback; migration from the current store is lossless under node:test; Dexie is NOT added.
  Complexity: XL

- [ ] R-30 — platformId key-prefix forward-compat on the emote schema
  Why: NipahTV independently converged on KF's schema-5 with a platformId prefix KF lacks.
  Evidence: twitch-mods stream — NipahTV Database.ts keyed `[platformId+channelId+emoteHid]`.
  Touches: emote schema keys + migration in core.mjs; bind to the next STICKER_PREFERENCES_SCHEMA bump (and R-34's migration test harness).
  Acceptance: the emote key schema carries a platformId prefix with a tested migration from the current keys; bound to the next schema bump.
  Complexity: M

- [ ] R-31 — Trusted Types resilience
  Why: Trusted Types reached Baseline 2026-02; a future require-trusted-types-for 'script' on kick.com turns every page-world innerHTML into a TypeError.
  Evidence: security stream — MDN require-trusted-types-for; kick.com currently ships no CSP (Mozilla Observatory D/30, scan 2026-08-16).
  Touches: a feature-detected Trusted Types policy routing all page-world innerHTML writes.
  Acceptance: innerHTML writes route through a policy when Trusted Types is enforced (feature-detected), verified by a node:test that stubs a strict TT environment.
  Complexity: M

- [ ] R-32 — Close remaining WCAG 2.2 AA gaps on the mod's own chrome
  Why: density controls can drive icon buttons under 24px, sticky/floating chrome can obscure focus, and 80 absolute-px font sizes threaten 200%-zoom reflow.
  Evidence: a11y-i18n stream — WCAG 2.2 2.5.8 Target Size (24×24, mouse-inclusive), 2.4.11 Focus Not Obscured, 1.4.10 Reflow.
  Touches: density/target-size CSS; focus-scroll for sticky chrome; relative font units in UI_CSS.
  Acceptance: all icon buttons stay ≥24×24 CSS px at every density; focused controls are never obscured by sticky chrome; the UI reflows without horizontal scroll at 200% zoom.
  Complexity: M

