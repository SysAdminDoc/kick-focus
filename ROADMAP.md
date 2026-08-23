# Roadmap

Updated: **2026-08-23**

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

## Research-Driven Additions, 2026-08-23 (v1.38.0 pass)

Added from the exhaustive repository, live-browser, competitor, standards, and security research recorded in [RESEARCH.md](RESEARCH.md). Continues the historical R-NN scheme after R-96. Items already shipped or parked in [Roadmap_Blocked.md](Roadmap_Blocked.md) are not repeated.

### P0

- [ ] P0 — R-99: Restore followed-channel previews for hover, focus, still image, and reduced motion
  Why: Three of the six current Chromium failures show that no followed row is tagged and neither the ordinary image nor reduced-motion canvas opens.
  Evidence: scripts/verify-extension.mjs fresh 2026-08-23 run; src/runtime.js following-preview handlers; https://addons.mozilla.org/en-US/firefox/addon/previews-for-ttv/
  Touches: src/runtime.js preview tagging and lifecycle, src/compatibility.mjs probes, scripts/fixture-contract.mjs, scripts/verify-extension.mjs, test fixtures
  Acceptance: The current live sidebar opens an on-screen preview on pointer hover and keyboard focus; Escape closes it and returns focus; Reduced Motion renders one still frame; every preview assertion passes at 1440x900 and 1920x1080 without adding a network permission.
  Complexity: M

- [ ] P0 — R-100: Restore Viewer Hub cards and anonymous earned-state markers
  Why: Two current Chromium assertions fail because the Viewer Hub renders no cards, so both its six-card contract and anonymous-state explanations disappear.
  Evidence: scripts/verify-extension.mjs fresh 2026-08-23 run; src/runtime.js Viewer Hub renderer; src/core.mjs viewer card registry
  Touches: src/runtime.js, src/core.mjs, src/api.mjs only if a verified response shape changed, test fixtures, scripts/verify-extension.mjs
  Acceptance: The live anonymous gate renders all six registered cards; unavailable account readings explain why and never show a false zero; earned-state markers appear only when supported by observed state; fixture and both desktop live checks pass.
  Complexity: M

- [ ] P0 — R-101: Exclude hidden preload video from the local watch clock
  Why: The current live check records a hidden preload advancing the timer while the visible player is paused.
  Evidence: scripts/verify-extension.mjs fresh 2026-08-23 run; src/runtime.js session watch-time functions
  Touches: src/runtime.js playback-owner selection and session timer, src/core.mjs pure eligibility helper, test/core.test.js, scripts/verify-extension.mjs
  Acceptance: Time accrues only when the visible, active channel player is playing in a visible document; paused, hidden, preload, preview, muted-background, and detached non-owner videos add zero; ownership changes do not double-count; unit and live assertions pass.
  Complexity: S

- [ ] P0 — R-102: Enforce the userscript injection budget in UTF-8 bytes with 75 KB reserve
  Why: String length understates the shipped bytes and the userscript plus maximum seed currently totals 987,722 bytes, leaving only 12,278 bytes below Violentmonkey’s approximate 1 MB ceiling.
  Evidence: scripts/build.mjs:80; scripts/check.mjs size budgets; src/storage.mjs LIBRARY_SEED_BYTES; https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0
  Touches: scripts/build.mjs, scripts/check.mjs, src/storage.mjs, test/storage.test.js, package scripts, userscript source size
  Acceptance: Browser code uses TextEncoder byteLength and build code uses Buffer.byteLength for UTF-8; npm run check fails when userscript plus the maximum synchronous seed exceeds 925,000 bytes; the readable unminified artifact passes with at least 75,000 bytes of reserve and reports the same byte count in build, tests, and About.
  Complexity: M

### P1

- [ ] P1 — R-103: Make one local release command refuse red or stale evidence
  Why: v1.38.0 is published while current-head Chromium proof is 90 of 96 and README.md carries an older proof count.
  Evidence: scripts/release-checklist.mjs; scripts/verify-extension.mjs; README.md; https://github.com/SysAdminDoc/kick-focus/releases/tag/v1.38.0
  Touches: scripts/release-checklist.mjs, scripts/verify-extension.mjs, scripts/verify-firefox.mjs, scripts/build.mjs, README.md proof block, release artifacts
  Acceptance: One local command cleans and rebuilds artifacts, requires every mandatory browser-neutral assertion at both desktop viewports, checks the Firefox contract, validates version and proof stamps, and exits nonzero before packaging when any evidence is skipped, failed, or older than the source; no remote CI is added.
  Complexity: M

- [ ] P1 — R-104: Cover all seven settings pages behaviorally and enforce coverage floors
  Why: test/settings.test.js has two direct tests and src/settings.mjs is only 36.36% line-covered and 11.63% function-covered despite owning the main control surface.
  Evidence: src/settings.mjs; test/settings.test.js; package.json coverage script; https://nodejs.org/api/cli.html
  Touches: test/settings.test.js, settings fixtures, package.json, src/settings.mjs only for test seams
  Acceptance: Layout, Appearance, Content & Ads, Emotes, Accessibility, Viewer, and About each have render, action, empty/error, persistence, and localization contracts; a settings-focused command enforces at least 80% lines, 75% branches, and 70% functions; global floors start at 88% lines, 85% branches, and 86% functions.
  Complexity: L

- [ ] P1 — R-105: Gate route and theme parity with deterministic visual diffs
  Why: Current screenshots cover the visual overhaul, but release QA still depends on manual comparison and cannot catch spacing, overflow, or theme regressions automatically.
  Evidence: design/mockups, design/screenshots, design/qa, scripts/release-checklist.mjs; https://playwright.dev/docs/next/test-snapshots
  Touches: scripts/cdp.mjs, new local visual verifier under scripts, deterministic fixtures, design reference images, package.json
  Acceptance: A dependency-free local command captures Home, channel, settings, emote picker, and multistream in Studio, OLED, and Slate at both supported widths; volatile media and text regions are masked; a browser-canvas pixel comparison emits an inspectable diff and fails above documented per-pixel and changed-area thresholds.
  Complexity: L

- [ ] P1 — R-106: Remove custom app shortcuts and keep every action visibly reachable
  Why: Kick Focus still captures configurable page-wide shortcuts even though its interaction policy forbids custom shortcuts and Kick owns the page keyboard context.
  Evidence: src/core.mjs shortcuts defaults and normalization; src/settings.mjs Accessibility & Shortcuts page; src/runtime.js onGlobalKeydown; README.md command menu
  Touches: src/core.mjs schema migration, src/settings.mjs navigation and page renderer, src/runtime.js global key handling, translations, README.md, tests
  Acceptance: No Kick Focus action captures a custom page-wide chord or letter; old stored shortcut values migrate away without error; every former action remains available from a visible button, settings, command surface, or userscript-manager menu; Tab, Enter, Space, Escape, arrows, Home, and End remain available where standard widgets require them.
  Complexity: M

- [ ] P1 — R-107: Replace reset confirmations with immediate reset and one-step Undo
  Why: Page and full reset still open an alertdialog, while the product rule requires immediate action with recoverable feedback.
  Evidence: src/runtime.js openResetConfirmation and confirmReset; src/settings.mjs reset actions; src/core.mjs import backup and normalization
  Touches: src/runtime.js reset flow and toast, src/core.mjs snapshot validation, local backup key, translations, settings tests
  Acceptance: Reset page and Reset all act immediately, preserve the emote library, and show a focused status toast with Undo; Undo restores every setting, note, filter, and channel list changed by that reset until the next destructive action or tab close; no reset confirmation dialog remains.
  Complexity: M

- [ ] P1 — R-108: Make the Kick page inert while a modal surface is open
  Why: Settings, command, and multistream overlays declare modal behavior and trap focus, but underlying Kick controls remain interactive and exposed to assistive technology.
  Evidence: src/runtime.js overlay hosts; https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/; https://html.spec.whatwg.org/multipage/interaction.html#the-inert-attribute
  Touches: src/runtime.js modal lifecycle, overlay tests, scripts/verify-extension.mjs
  Acceptance: Opening the first modal snapshots and inerts every body sibling except Kick Focus hosts; nested modals use a reference count; closing the final modal restores each sibling’s exact prior inert state; pointer, Tab, and accessibility-tree checks cannot reach the page behind the modal.
  Complexity: M

- [ ] P1 — R-109: Give the chat separator standard ARIA splitter keyboard behavior
  Why: The separator exposes range ARIA values and pointer drag but cannot receive focus or respond as a splitter.
  Evidence: src/runtime.js bindChatResizer and tagChatPanel; https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
  Touches: src/runtime.js separator binding, src/core.mjs width helper, test/core.test.js, fixtures, scripts/verify-extension.mjs
  Acceptance: The separator has tabindex 0, aria-controls, and readable value text; Left and Right change width in the correct direction for left or right chat, Home selects 320 px, End selects 520 px, settings persist through updateSetting, and pointer behavior remains unchanged.
  Complexity: S

- [ ] P1 — R-110: Use Firefox MAIN-world injection without inline source
  Why: Firefox 128 supports manifest-declared MAIN-world scripts, removing the current dependence on Kick allowing inline scripts and the build’s duplicated embedded bundle.
  Evidence: src/extension/bridge.firefox.js; src/extension/manifest.firefox.json; scripts/build.mjs; https://blog.mozilla.org/addons/2024/07/10/manifest-v3-updates-landed-in-firefox-128/
  Touches: src/extension/manifest.firefox.json, src/extension/bridge.firefox.js, scripts/build.mjs, scripts/check.mjs, test/companion.test.js, scripts/verify-firefox.mjs, README.md
  Acceptance: Firefox strict_min_version is 128.0; the page bundle is emitted once as content/kick-focus.js with world MAIN at document_start; the isolated bridge stays separate; no inline source or stable moz-extension URL enters the page; a fixture CSP that blocks inline scripts still boots the companion.
  Complexity: M

- [ ] P1 — R-111: Run browser-neutral journey contracts in Chromium and Firefox
  Why: Chromium currently exercises 96 assertions while Firefox runs eight narrower checks, leaving theme, modal, preview, settings, and multistream behavior free to diverge.
  Evidence: scripts/verify-extension.mjs; scripts/verify-firefox.mjs; https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities
  Touches: shared journey-contract module under scripts, both browser verifiers, fixtures, release checklist
  Acceptance: Every browser-neutral route, theme, settings, modal, preview, multistream, storage, and network assertion is defined once and run by both companions; browser-specific exceptions name the API difference and carry a dated reason; a failure in either browser blocks the local release command.
  Complexity: L

### P2

- [ ] P2 — R-112: Localize popup and extension metadata to the shipped languages
  Why: The page UI supports English, Spanish, and Portuguese, but both manifests and the companion popup remain English-only.
  Evidence: src/runtime.js translations; src/extension/popup.html; src/extension/manifest.json; src/extension/manifest.firefox.json; https://developer.chrome.com/docs/extensions/reference/api/i18n
  Touches: src/extension/_locales/en, es, and pt_BR, both manifests, popup HTML and JS, scripts/check.mjs, companion tests
  Acceptance: Name, description, action title, popup controls, errors, and status text have key-parity in en, es, and pt_BR; the popup sets lang and dir; stored pt remains compatible while document metadata emits pt-BR; packaging fails on a missing or unused key.
  Complexity: M

- [ ] P2 — R-113: Restrict the build to the supported Node 24 LTS line
  Why: node >=24.19 also admits end-of-life Node 25, while Node 26 is not yet the project’s LTS target.
  Evidence: package.json engines; https://nodejs.org/en/about/previous-releases; https://nodejs.org/en/blog/release/v24.19.0
  Touches: package.json, scripts/check.mjs, README.md setup text
  Acceptance: The engine range is >=24.19 <25 or equivalent; verify and release checks refuse unsupported majors with a clear message; Node 24.19 and the current Node 24 LTS pass the full suite.
  Complexity: S

- [ ] P2 — R-114: Extract the emote workspace from runtime behind a host factory
  Why: src/runtime.js is 12,864 lines and the emote picker, library, groups, selection, restore, and completion state now form the largest coherent boundary left in the monolith.
  Evidence: src/runtime.js emote workspace; src/settings.mjs createSettings factory; scripts/build.mjs concatenation order
  Touches: new src/emotes.mjs, src/runtime.js, scripts/build.mjs, scripts/check.mjs, emote and boot tests
  Acceptance: One host-injected factory owns emote rendering and actions; runtime.js loses those implementations rather than gaining wrappers; top-level symbol checks and node --check pass; picker, library, profile workspace, groups, restore, completion, and 2,400-item virtualization retain their current contracts.
  Complexity: L

- [ ] P2 — R-115: Add bounded native-player stall and live-edge recovery
  Why: Competing player tools expose recovery for sustained stalls and excessive live latency, while Kick Focus currently reports playback state but leaves recovery entirely implicit.
  Evidence: src/runtime.js applyPlaybackDiagnostics; https://github.com/SevenTV/Extension/issues/1250; https://github.com/SevenTV/Extension/pull/1252; https://chromewebstore.google.com/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf
  Touches: src/runtime.js playback diagnostics and controls, src/core.mjs pure recovery decision, settings and translations, tests, live gate
  Acceptance: An opt-in Recover or Return live action appears only after sustained stall or measured latency; it never reloads the page, never acts while paused or on VOD, preserves quality, volume, and mute state, uses cooldown plus bounded backoff, and disables itself after a failed safe attempt with a diagnostic reason.
  Complexity: L

### P3

- [ ] P3 — R-116: Add local per-channel emote artwork suppression
  Why: Large or disruptive emote art is a repeated chat-comfort concern, and 7TV now supports hiding artwork in one channel without deleting the emote identity.
  Evidence: https://github.com/SevenTV/Extension/pull/1247; src/runtime.js chat emote hover card; src/storage.mjs local preference stores
  Touches: src/runtime.js emote rendering and hover card, src/core.mjs bounded channel preference normalization, storage/export, settings, translations, tests
  Acceptance: Hide artwork affects only the current channel, preserves readable emote text and accessible names, stores a bounded local list, can be reversed from the same hover card and settings, and never contacts an external emote provider.
  Complexity: M

- [ ] P3 — R-117: Keep native chat usable in native fullscreen
  Why: KickEnhance and OverKick both show demand for chat overlay placement and opacity while watching fullscreen.
  Evidence: https://chromewebstore.google.com/detail/kickenhance/eobmipgghmnbbipfhpemfacnljiflmnj; https://greasyfork.org/en/scripts/587473-overkick-cinematic-chat-overlay
  Touches: src/runtime.js fullscreen lifecycle and styles, src/core.mjs settings normalization, src/settings.mjs, translations, fixtures, live gate
  Acceptance: An opt-in overlay reuses Kick’s native chat inside the active fullscreen element; side, width, and opacity persist; native moderation state and composer accessibility remain intact; Escape remains owned by fullscreen; closing or route change restores the exact original DOM and focus.
  Complexity: L

- [ ] P3 — R-118: Add an all-channel private notes index with content search
  Why: Notes are currently channel-bound, so a viewer cannot find a remembered channel by note text; adjacent extension users request a notes index.
  Evidence: src/runtime.js CHANNEL_NOTES_KEY and channel notes; https://github.com/Seldszar/Gumbo/issues/205
  Touches: src/runtime.js notes storage and search surface, src/core.mjs normalization, settings export/import, translations, tests
  Acceptance: A local index lists every channel with a note and searches normalized slug plus note text; results open the channel or edit the note; import, export, reset, and Undo include the index; no note content leaves the browser and an empty index explains how to add the first note.
  Complexity: M

## Research-Driven Additions

### P1, profile comment emote reliability and direct access

- [ ] P1: R-119 - Restore removed emotes individually
  Why: The picker stores a showHidden state but renders no control for it. After the seven-second Undo expires, the Library can restore only the entire removed set.
  Evidence: src/runtime.js:5052-5055; src/runtime.js:5548-5556; src/runtime.js:5715-5718; src/settings.mjs:502
  Touches: shared mutation commands from R-120, src/runtime.js picker views and actions, src/settings.mjs Library views, src/storage.mjs normalized hidden state and bounded tombstones, emote tests, browser verifier
  Acceptance: Removing an emote keeps a bounded tombstone with its key and safe last-known display metadata; picker and Library both expose a Removed view with a count; one emote, the current selection, or the shown result set can be restored before rediscovery; each restore changes only removed state, offers Undo, survives reload, and announces a concise status; Restore all remains available but is not the only recovery path; migration tests preserve every existing hidden key.
  Complexity: M

- [ ] P1: R-120 - Use one mutation command layer in the picker and Library
  Why: The same create, delete, move, remove, and restore intent currently has different persistence and Undo behavior depending on which surface runs it.
  Evidence: src/runtime.js:5433-5542; src/runtime.js:10525-10619; src/storage.mjs emote-library normalization; RESEARCH.md Competitive Landscape
  Touches: new pure command module or R-114 emote factory, src/runtime.js, src/settings.mjs, src/storage.mjs, unit and property tests
  Acceptance: Create group, rename, delete, reorder, favorite, move, remove, and restore have one normalized command contract and one inverse record; picker and Library produce byte-equivalent persisted state for equivalent actions; every destructive action offers one-step Undo; duplicate and invalid commands are no-ops with a visible status; randomized command sequences preserve schema invariants.
  Complexity: L

- [ ] P1: R-121 - Preserve focus, draft text, selection, and caret through picker rerenders
  Why: Most picker changes rebuild the organizer controls and lose the active element. A comment-writing tool must not interrupt the draft around it.
  Evidence: src/runtime.js:4983-5160; src/runtime.js:5369-5379; https://www.w3.org/WAI/ARIA/apg/patterns/grid/; https://www.w3.org/TR/WCAG22/
  Touches: src/runtime.js render and native-composer adapter, picker state, browser fixtures, accessibility checks
  Acceptance: Before a rerender, the picker captures a stable control key plus native draft value, selection range, and composer identity; after create, rename, delete, favorite, move, remove, restore, scope, and view changes, focus returns to the equivalent control or a documented nearby fallback; the draft and caret are byte-for-byte unchanged until an emote is intentionally inserted; focus remains visible at 1440, 900, and 680 pixels.
  Complexity: M

- [ ] P1: R-122 - Make the full profile comment emote journey a browser release contract
  Why: Current live coverage checks windowing and one favorite update but not the group, recovery, focus, return, or safe-insertion paths that define the feature.
  Evidence: scripts/verify-extension.mjs:3265-3362; test/boot.test.js:516-549; design/qa/emote-picker-all-v1.38.png; design/qa/emote-picker-narrow-v1.38.png
  Touches: scripts/verify-extension.mjs, shared Firefox journey work from R-111, deterministic profile fixtures, release checklist, design references
  Acceptance: Automated journeys cover open and close, create, rename, delete and Undo, favorite and reorder, Select shown, move, remove, individual restore, empty search recovery, Library return, insert without submit, outside click, route change, and reduced motion; the suite runs desktop and narrow states at 1440, 900, and 680 pixels; every state asserts focus, accessible name, persisted result, draft preservation, and zero submit events; supported signed-in live checks run when account state is available.
  Complexity: L

- [ ] P1: R-123 - Converge emote edits across open Kick tabs
  Why: Whole-state writes without a convergence listener let an older tab erase newer favorites or group edits made elsewhere.
  Evidence: src/storage.mjs library commit path; src/runtime.js picker commits; https://developer.chrome.com/docs/extensions/reference/api/storage; https://storage.spec.whatwg.org/
  Touches: src/storage.mjs versioned mutation log or merge layer, userscript and companion storage listeners, picker and Library refresh, two-context tests
  Acceptance: Each committed command carries a stable writer ID, per-writer sequence, and command ID; userscript and companion modes observe external changes without reload; concurrent favorites and edits to different groups converge; a stale writer cannot erase a newer change; a true same-field conflict follows one documented deterministic rule and reports it locally; two-tab tests cover reconnect and tab closure.
  Complexity: L

- [ ] P1: R-124 - Add a compact channel-aware favorites shelf above the native comment input
  Why: Frequent commenters should reach their most-used emotes without opening the full catalog, while the native composer must remain the source of truth.
  Evidence: src/runtime.js native composer delegation; https://chromewebstore.google.com/detail/wesutil/igdnndpfofcemcoellnefdflnmcchmle; https://github.com/jakubn11/kick-third-party-emotes; https://github.com/Xzensi/NipahTV
  Touches: src/runtime.js profile composer adapter and shelf, src/core.mjs bounded preference, translations, picker tests, browser verifier
  Acceptance: An opt-in shelf shows current-channel favorites first and fills remaining slots from global favorites in stable order; one activation delegates insertion to the native composer and never sends; the shelf hides when empty, can be collapsed from the same surface, follows route and entitlement changes, has readable names and standard keyboard behavior, and fits without covering host controls at 1440, 900, and 680 pixels.
  Complexity: M

### P2, profile comment emote organization and polish

- [ ] P2: R-125 - Let users reorder custom groups without drag-only interaction
  Why: Groups append in creation order and cannot be rearranged, so an active collection can remain behind old groups permanently.
  Evidence: src/runtime.js custom group create and delete paths; src/storage.mjs group normalization; https://www.w3.org/TR/WCAG22/
  Touches: shared mutation commands from R-120, picker and Library group controls, import and export normalization, translations, tests
  Acceptance: Each custom group has visible Move earlier and Move later controls in picker and Library; controls disable at the boundaries, preserve selection, and offer Undo; order survives reload, import, export, and two-tab convergence; pointer use is optional and no drag gesture is required.
  Complexity: S

- [ ] P2: R-126 - Search emotes by name, source, native group, and custom group with stable ranking
  Why: Picker search currently matches only the descriptor name while the Library considers more context, so the same catalog can return different results.
  Evidence: src/runtime.js picker filter; src/settings.mjs Library filter; src/storage.mjs normalized descriptor fields; https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
  Touches: shared pure search index and ranker, picker and Library renderers, translations, search tests, performance probe
  Acceptance: Both surfaces normalize the same searchable fields; exact name ranks before prefix, then token, then substring; ties prefer current-profile availability, favorites, recent use, and stable catalog order; custom and native group matches are visibly explained; across 100 deterministic queries over 2,400 fixtures, pure search stays at or below 16 ms at p95 on the supported Node 24 baseline; no remote provider or fuzzy dependency is added.
  Complexity: M

- [ ] P2: R-127 - Assign one emote to a group directly from its tile
  Why: Moving a single emote currently requires entering Organize, selecting it, choosing a destination, and pressing Move.
  Evidence: src/runtime.js:5162-5542; design/qa/emote-picker-all-v1.38.png
  Touches: tile management menu, mutation commands from R-120, picker and Library, translations, browser tests
  Acceptance: A visible tile action opens an accessible group menu with current membership; one action moves or removes the emote from a custom group without entering batch mode; the result is announced, offers Undo, retains focus on the tile, and uses the same command as Library and batch organization.
  Complexity: M

- [ ] P2: R-128 - Give the Library an explicit Back to comment return path
  Why: Opening Library from the picker loses the sense of a temporary detour because the destination offers only a generic Done action.
  Evidence: src/runtime.js picker Library action; src/settings.mjs Library shell; design/screenshots/emote-library.png
  Touches: picker launch context, settings navigation, native composer adapter, focus restoration tests
  Acceptance: Library opened from a profile comment shows Back to comment as its primary exit; returning restores the route, picker view, search, group, scroll window, and focus at the native comment control; if the original composer no longer exists, the action becomes Done and reports that the page changed; opening Library from normal settings keeps the existing settings return path.
  Complexity: S

- [ ] P2: R-129 - Keep emote management affordances discoverable at every supported width
  Why: Tile actions rely on hover or focus and narrow top actions become icon-only, which hides organization from pointer and touchpad users who have not learned the surface.
  Evidence: design/qa/emote-picker-all-v1.38.png; design/qa/emote-picker-narrow-v1.38.png; design/qa/settings-responsive-680.jpg; visual audit on 2026-08-23
  Touches: picker and Library styles, action labels or overflow menu, settings navigation overflow cue, visual references, browser geometry checks
  Acceptance: Every tile has one visible management affordance at rest; Favorite and Remove remain reachable in one additional activation at most; narrow top actions use labels where they fit and a named overflow menu otherwise; controls are at least 24 by 24 CSS pixels normally and 40 by 40 when Larger targets is enabled; nothing clips or covers the native composer; screenshot comparison passes at 1440, 900, and 680 pixels in Studio, OLED, and Slate.
  Complexity: S

- [ ] P2: R-130 - Add a private emote workspace self-check and diagnostics block
  Why: Current diagnostics cannot distinguish a missing picker anchor, stale catalog, failed storage provider, bad window range, or mutation conflict without inspecting code.
  Evidence: src/runtime.js diagnostics and picker state; src/storage.mjs providers and seed; src/settings.mjs About diagnostics
  Touches: sanitized diagnostic adapter, About self-check, picker status, copy-diagnostics output, tests
  Acceptance: Diagnostics report picker anchor found, active view, catalog count, favorite count, group count, removed count, storage provider, current grid window, state revision, and last mutation result; they never include emote names, channel notes, comment text, or account identifiers; Run self-check validates open, storage round-trip, search index, and native insertion adapter without changing the draft; Copy diagnostics remains local and readable.
  Complexity: M

### P2, companion response hardening

- [ ] P2: R-131 - Stop blocklist downloads at 512 KiB while reading
  Why: Commit 29f7584 rejects a declared oversized response and checks the final ArrayBuffer, but a feed with no reliable Content-Length can still allocate the complete body before the limit is enforced.
  Evidence: src/extension/background.js fetchApprovedBlocklist; src/extension/background.firefox.js fetchApprovedBlocklist; test/companion.test.js streamed-body cases; https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/read
  Touches: both companion background fetchers, shared transport tests, built extension artifacts
  Acceptance: Both backgrounds read response chunks, cancel the reader as soon as cumulative bytes exceed 512 KiB, and decode valid UTF-8 only after the bounded read succeeds; the existing Content-Length precheck remains; a test with an endless or oversized chunk source proves consumption stops no later than the first chunk beyond the limit; timeout, MIME, redirect, and exact-URL behavior stay unchanged.
  Complexity: S
