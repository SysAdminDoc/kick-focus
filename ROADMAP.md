# Roadmap

Updated: **2026-09-04**

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

None open.

### P1

- [ ] P1: R-105: Gate route and theme parity with deterministic visual diffs
  Why: Current screenshots cover the visual overhaul, but release QA still depends on manual comparison and cannot catch spacing, overflow, or theme regressions automatically.
  Evidence: design/mockups, design/screenshots, design/qa, scripts/release-checklist.mjs; https://playwright.dev/docs/next/test-snapshots
  Touches: scripts/cdp.mjs, new local visual verifier under scripts, deterministic fixtures, design reference images, package.json
  Acceptance: A dependency-free local command captures Home, channel, settings, emote picker, and multistream in Studio, OLED, and Slate at both supported widths; volatile media and text regions are masked; a browser-canvas pixel comparison emits an inspectable diff and fails above documented per-pixel and changed-area thresholds.
  Note 2026-09-04: the comparison need not run in a browser canvas. `Page.captureScreenshot` emits 8-bit RGBA non-interlaced PNG, which `node:zlib` `inflateSync` over the IDAT chunks decodes in well under a hundred lines, so the diff can be a plain Node step with an inspectable output image. Pin `deviceScaleFactor: 1` through `Emulation.setDeviceMetricsOverride` (this machine is 125% DPI) and inject `*{animation:none!important;transition:none!important}` before capture, or the run is not deterministic. Capture must use Chromium or Chrome for Testing: `--load-extension` was removed from branded Chrome in 137 and `chrome-headless-shell` cannot load extensions at all.
  Complexity: L

- [ ] P1: R-111: Run browser-neutral journey contracts in Chromium and Firefox
  Why: Chromium currently exercises 96 assertions while Firefox runs eight narrower checks, leaving theme, modal, preview, settings, and multistream behavior free to diverge.
  Evidence: scripts/verify-extension.mjs; scripts/verify-firefox.mjs; https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities
  Touches: shared journey-contract module under scripts, both browser verifiers, fixtures, release checklist
  Acceptance: Every browser-neutral route, theme, settings, modal, preview, multistream, storage, and network assertion is defined once and run by both companions; browser-specific exceptions name the API difference and carry a dated reason; a failure in either browser blocks the local release command.
  Complexity: L

### P2

- [x] P2: R-112: Localize popup and extension metadata to the shipped languages
  Why: The page UI supports English, Spanish, and Portuguese, but both manifests and the companion popup remain English-only.
  Evidence: src/runtime.js translations; src/extension/popup.html; src/extension/manifest.json; src/extension/manifest.firefox.json; https://developer.chrome.com/docs/extensions/reference/api/i18n
  Touches: src/extension/_locales/en, es, and pt_BR, both manifests, popup HTML and JS, scripts/check.mjs, companion tests
  Acceptance: Name, description, action title, popup controls, errors, and status text have key-parity in en, es, and pt_BR; the popup sets lang and dir; stored pt remains compatible while document metadata emits pt-BR; packaging fails on a missing or unused key.
  Shipped: Both packages carry the same 55 keys in en, es, and pt_BR. Manifests localize their name, description, and action title. The popup localizes every control, title, status, and error, writes lang and dir, maps stored pt to pt-BR, and the artifact test rejects key drift or dead messages.
  Complexity: M

- [ ] P2: R-114: Extract the emote workspace from runtime behind a host factory
  Why: src/runtime.js is 12,864 lines and the emote picker, library, groups, selection, restore, and completion state now form the largest coherent boundary left in the monolith.
  Evidence: src/runtime.js emote workspace; src/settings.mjs createSettings factory; scripts/build.mjs concatenation order
  Touches: new src/emotes.mjs, src/runtime.js, scripts/build.mjs, scripts/check.mjs, emote and boot tests
  Acceptance: One host-injected factory owns emote rendering and actions; runtime.js loses those implementations rather than gaining wrappers; top-level symbol checks and node --check pass; picker, library, profile workspace, groups, restore, completion, and 2,400-item virtualization retain their current contracts.
  Complexity: L

- [ ] P2: R-115: Add bounded native-player stall and live-edge recovery
  Why: Competing player tools expose recovery for sustained stalls and excessive live latency, while Kick Focus currently reports playback state but leaves recovery entirely implicit.
  Evidence: src/runtime.js applyPlaybackDiagnostics; https://github.com/SevenTV/Extension/issues/1250; https://github.com/SevenTV/Extension/pull/1252; https://chromewebstore.google.com/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf
  Touches: src/runtime.js playback diagnostics and controls, src/core.mjs pure recovery decision, settings and translations, tests, live gate
  Acceptance: An opt-in Recover or Return live action appears only after sustained stall or measured latency; it never reloads the page, never acts while paused or on VOD, preserves quality, volume, and mute state, uses cooldown plus bounded backoff, and disables itself after a failed safe attempt with a diagnostic reason.
  Note 2026-09-04: this is the highest measured user demand of anything on this roadmap and should be treated as P1, not P2. The only community sweep with counts behind it ranks player reliability first — stream-switching stalls of five to ten seconds and a sidebar that stops refreshing. Kick's own help centre carries dedicated articles for chat not loading and for stream buffering. Both 7TV citations were re-checked and are still open. The third citation, the Alternate Player Chrome listing, is dead: that extension was archived 2026-03-05 and delisted from the Chrome Web Store 2026-08-28; use https://addons.mozilla.org/en-US/firefox/addon/twitch_5/ instead, which is still served.
  Complexity: L

### P3

- [ ] P3: R-116: Add local per-channel emote artwork suppression
  Why: Large or disruptive emote art is a repeated chat-comfort concern, and 7TV now supports hiding artwork in one channel without deleting the emote identity.
  Evidence: https://github.com/SevenTV/Extension/pull/1247; src/runtime.js chat emote hover card; src/storage.mjs local preference stores
  Touches: src/runtime.js emote rendering and hover card, src/core.mjs bounded channel preference normalization, storage/export, settings, translations, tests
  Acceptance: Hide artwork affects only the current channel, preserves readable emote text and accessible names, stores a bounded local list, can be reversed from the same hover card and settings, and never contacts an external emote provider.
  Complexity: M

- [ ] P3: R-117: Keep native chat usable in native fullscreen
  Why: KickEnhance and OverKick both show demand for chat overlay placement and opacity while watching fullscreen.
  Evidence: https://chromewebstore.google.com/detail/kickenhance/eobmipgghmnbbipfhpemfacnljiflmnj; https://greasyfork.org/en/scripts/587473-overkick-cinematic-chat-overlay
  Touches: src/runtime.js fullscreen lifecycle and styles, src/core.mjs settings normalization, src/settings.mjs, translations, fixtures, live gate
  Acceptance: An opt-in overlay reuses Kick’s native chat inside the active fullscreen element; side, width, and opacity persist; native moderation state and composer accessibility remain intact; Escape remains owned by fullscreen; closing or route change restores the exact original DOM and focus.
  Note 2026-09-04: the KickEnhance citation is wrong and should be dropped — no extension by that name exists on the Chrome Web Store, AMO, Greasyfork, or GitHub. OverKick is the only real precedent, and it has 10 Greasyfork installs, so the demand claim rests on one tiny script. Weigh that before spending an L on it.
  Complexity: L

- [ ] P3: R-118: Add an all-channel private notes index with content search
  Why: Notes are currently channel-bound, so a viewer cannot find a remembered channel by note text; adjacent extension users request a notes index.
  Evidence: src/runtime.js CHANNEL_NOTES_KEY and channel notes; https://github.com/Seldszar/Gumbo/issues/205
  Touches: src/runtime.js notes storage and search surface, src/core.mjs normalization, settings export/import, translations, tests
  Acceptance: A local index lists every channel with a note and searches normalized slug plus note text; results open the channel or edit the note; import, export, reset, and Undo include the index; no note content leaves the browser and an empty index explains how to add the first note.
  Complexity: M

## Research-Driven Additions

### P1, profile comment emote reliability and direct access

- [ ] P1: R-120: Use one mutation command layer in the picker and Library
  Why: The same create, delete, move, remove, and restore intent currently has different persistence and Undo behavior depending on which surface runs it.
  Evidence: src/runtime.js:5433-5542; src/runtime.js:10525-10619; src/storage.mjs emote-library normalization; RESEARCH.md Competitive Landscape
  Touches: new pure command module or R-114 emote factory, src/runtime.js, src/settings.mjs, src/storage.mjs, unit and property tests
  Acceptance: Create group, rename, delete, reorder, favorite, move, remove, and restore have one normalized command contract and one inverse record; picker and Library produce byte-equivalent persisted state for equivalent actions; every destructive action offers one-step Undo; duplicate and invalid commands are no-ops with a visible status; randomized command sequences preserve schema invariants.
  Complexity: L
  Shipped 2026-09-05, partially: every emote mutation in the picker now goes through `mutateStickerOrganization`, which takes one full snapshot and restores it, so there is one inverse record instead of nine. `commitPickerStickerChange()` call sites went from 29 to 8 and the only hand-written Undo left in the emote paths is the one inside that helper. This fixed two defects the per-site inverses had: favouriting an emote also clears its removed state, and the Undo captured only `favorites`, so it put the star back and left the emote visible; and reordering a favourite, restoring a single removed emote, and renaming a group offered no Undo at all. The snapshot also carries the organizer's own mode now (bulk destination, group editor, selection), because a batch command clears the selection and an Undo that restored the data but not the mode had not undone what the user saw. `scripts/check.mjs` asserts the snapshot and its inverse name the same fields and that there is exactly one restore call site, with three red probes; sabotaging one restored field turns it red.
  Still open, and why this item is not deleted: byte-equivalence between picker and Library for equivalent actions is not asserted by any test; the no-op guards added for a same-group assign, a same-name rename and a zero-distance drag return silently rather than reporting a visible status; and there is no randomized command-sequence test over the schema invariants.

- [ ] P1: R-121: Preserve focus, draft text, selection, and caret through picker rerenders
  Why: Most picker changes rebuild the organizer controls and lose the active element. A comment-writing tool must not interrupt the draft around it.
  Evidence: src/runtime.js:4983-5160; src/runtime.js:5369-5379; https://www.w3.org/WAI/ARIA/apg/patterns/grid/; https://www.w3.org/TR/WCAG22/
  Touches: src/runtime.js render and native-composer adapter, picker state, browser fixtures, accessibility checks
  Acceptance: Before a rerender, the picker captures a stable control key plus native draft value, selection range, and composer identity; after create, rename, delete, favorite, move, remove, restore, scope, and view changes, focus returns to the equivalent control or a documented nearby fallback; the draft and caret are byte-for-byte unchanged until an emote is intentionally inserted; focus remains visible at 1440, 900, and 680 pixels.
  Complexity: M

- [ ] P1: R-122: Make the full profile comment emote journey a browser release contract
  Why: Current live coverage checks windowing, the outboard action menu, one favorite update, and drag-to-reorder, but not the full group, recovery, focus, return, or safe-insertion paths that define the feature.
  Evidence: scripts/verify-extension.mjs organizer journey; test/boot.test.js emote shelf contracts; design/qa/sticker-drag-marker-v1.45.png; design/qa/emote-picker-narrow-v1.38.png
  Touches: scripts/verify-extension.mjs, shared Firefox journey work from R-111, deterministic profile fixtures, release checklist, design references
  Acceptance: Automated journeys cover open and close, create, rename, delete and Undo, favorite and reorder, Select shown, move, remove, individual restore, empty search recovery, Library return, insert without submit, outside click, route change, and reduced motion; the suite runs desktop and narrow states at 1440, 900, and 680 pixels; every state asserts focus, accessible name, persisted result, draft preservation, and zero submit events; supported signed-in live checks run when account state is available.
  Complexity: L

- [ ] P1: R-123: Converge emote edits across open Kick tabs
  Why: Whole-state writes without a convergence listener let an older tab erase newer favorites or group edits made elsewhere.
  Evidence: src/storage.mjs library commit path; src/runtime.js picker commits; https://developer.chrome.com/docs/extensions/reference/api/storage; https://storage.spec.whatwg.org/
  Touches: src/storage.mjs versioned mutation log or merge layer, userscript and companion storage listeners, picker and Library refresh, two-context tests
  Acceptance: Each committed command carries a stable writer ID, per-writer sequence, and command ID; userscript and companion modes observe external changes without reload; concurrent favorites and edits to different groups converge; a stale writer cannot erase a newer change; a true same-field conflict follows one documented deterministic rule and reports it locally; two-tab tests cover reconnect and tab closure.
  Complexity: L

- [ ] P2: R-126: Search emotes by name, source, native group, and custom group with stable ranking
  Why: Picker search currently matches only the descriptor name while the Library considers more context, so the same catalog can return different results.
  Evidence: src/runtime.js picker filter; src/settings.mjs Library filter; src/storage.mjs normalized descriptor fields; https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
  Touches: shared pure search index and ranker, picker and Library renderers, translations, search tests, performance probe
  Acceptance: Both surfaces normalize the same searchable fields; exact name ranks before prefix, then token, then substring; ties prefer current-profile availability, favorites, recent use, and stable catalog order; custom and native group matches are visibly explained; across 100 deterministic queries over 2,400 fixtures, pure search stays at or below 16 ms at p95 on the supported Node 24 baseline; no remote provider or fuzzy dependency is added.
  Complexity: M

- [ ] P2: R-128: Give the Library an explicit Back to comment return path
  Why: Opening Library from the picker loses the sense of a temporary detour because the destination offers only a generic Done action.
  Evidence: src/runtime.js picker Library action; src/settings.mjs Library shell; design/screenshots/emote-library.png
  Touches: picker launch context, settings navigation, native composer adapter, focus restoration tests
  Acceptance: Library opened from a profile comment shows Back to comment as its primary exit; returning restores the route, picker view, search, group, scroll window, and focus at the native comment control; if the original composer no longer exists, the action becomes Done and reports that the page changed; opening Library from normal settings keeps the existing settings return path.
  Complexity: S

- [x] P2: R-129: Keep emote management affordances discoverable at every supported width
  Why: Tile actions rely on hover or focus and narrow top actions become icon-only, which hides organization from pointer and touchpad users who have not learned the surface.
  Evidence: design/qa/emote-picker-all-v1.38.png; design/qa/emote-picker-narrow-v1.38.png; design/qa/settings-responsive-680.jpg; visual audit on 2026-08-23
  Touches: picker and Library styles, action labels or overflow menu, settings navigation overflow cue, visual references, browser geometry checks
  Acceptance: Every tile has one visible management affordance at rest; Favorite and Remove remain reachable in one additional activation at most; narrow top actions use labels where they fit and a named overflow menu otherwise; controls are at least 24 by 24 CSS pixels normally and 40 by 40 when Larger targets is enabled; nothing clips or covers the native composer; screenshot comparison passes at 1440, 900, and 680 pixels in Studio, OLED, and Slate.
  Shipped 2026-08-25: Favorite stays visible at rest and Remove remains directly reachable on hover or focus. Browser geometry measured 24-pixel normal controls and 40-pixel Larger pointer targets, with matching virtual-grid rows. Paired reference checks and a nine-shot theme and width matrix verified the native composer and organizer at 1440, 900, and 680 pixels in Studio, OLED, and Slate. A follow-up made the organizer respond to its own rail width and added Compact, Balanced, and Roomy densities plus Short, Medium, and Tall shelf heights.
  Complexity: S

- [ ] P2: R-130: Add a private emote workspace self-check and diagnostics block
  Why: Current diagnostics cannot distinguish a missing picker anchor, stale catalog, failed storage provider, bad window range, or mutation conflict without inspecting code.
  Evidence: src/runtime.js diagnostics and picker state; src/storage.mjs providers and seed; src/settings.mjs About diagnostics
  Touches: sanitized diagnostic adapter, About self-check, picker status, copy-diagnostics output, tests
  Acceptance: Diagnostics report picker anchor found, active view, catalog count, favorite count, group count, removed count, storage provider, current grid window, state revision, and last mutation result; they never include emote names, channel notes, comment text, or account identifiers; Run self-check validates open, storage round-trip, search index, and native insertion adapter without changing the draft; Copy diagnostics remains local and readable.
  Complexity: M

### P2, companion response hardening


## Audit, 2026-08-25

Found during a full-repository audit. Everything the audit fixed is in
[CHANGELOG.md](CHANGELOG.md); these are the items it did not.

### P1


### P2

- [ ] P2: R-147: Give the settings panel action and persistence contracts
  Why: R-104 asked for render, action, empty/error, persistence and localization contracts per page and delivered render, empty/error and localization. The two missing ones cannot be written against `createSettings`, which is a pure renderer: the click path is `onInterfaceClick` in src/runtime.js, which has no imports and is only ever concatenated, so no test can call it. An adversarial review named this on 2026-08-25 and it is a fair reading of the criterion.
  Where: src/runtime.js `onInterfaceClick` and `updateSetting`; test/settings.test.js; scripts/verify-extension.mjs
  Acceptance: Pressing a control on each of the seven pages runs the action it declares and, for a setting, the value is read back from storage afterwards. Either extract the click routing behind a host factory the way `createSettings` and `createMultistream` already are, so it can be driven offline, or add the coverage to the live gate where a real click exists. Whichever is chosen, a missing handler for a rendered `data-action` must fail rather than do nothing.
  Complexity: M

- [x] P2: R-148: Make the reset Undo reachable for longer than seven seconds
  Why: R-107's criterion says "a focused status toast with Undo". The toast is `role="status"` with `aria-live="polite"` and is never focused, and its Undo button is removed by a 7,000 ms timer. After a *page* reset the only other Undo is on the About page, so a keyboard or screen-reader user has seven seconds to reach a polite live region, or has to navigate to a different settings page to find the offer again. Moving focus to a toast unprompted is its own accessibility problem, so this is a design decision rather than a one-line fix.
  Where: src/runtime.js `showToast` (the 7,000 ms action timeout) and `resetSettings`; src/settings.mjs About page undo button
  Acceptance: After any reset, the Undo is reachable by keyboard without racing a timer. The action toast either persists until dismissed or acted on, or the offer appears on the page that was just reset rather than only on About. Whatever is chosen must not move focus without the user asking.
  Shipped: The action toast persists until Undo or Dismiss is pressed, sits above the settings footer, and leaves focus where the reset began.
  Complexity: S

- [x] P2: R-149: Include the reward record in the reset snapshot, or stop clearing it
  Why: `clearPrivateData` deletes `REWARD_STATE_KEY` (`lastClaimAt`, `claims`) on a full reset, and `currentExportPayload` does not carry it, so the Undo written beside that reset cannot put it back. R-107's criterion lists settings, notes, filters and channel lists rather than this. It is still state a reset destroys with no way back, which is the thing the undo exists to prevent.
  Where: src/runtime.js `clearPrivateData`, `currentExportPayload`, the store registry in src/core.mjs, and the import validation that has to accept a new section
Acceptance: Either the reward record travels with the export payload, so import, export and Undo all round-trip it, or the reset leaves it alone and says why. Adding it means the import validator and the About page's store list have to know about it too.
Shipped 2026-08-25: Full reset now leaves the local reward-check record untouched. The About page explains that the record prevents reset from making a handled reward appear due again, while settings, notes, filters, channel lists, usage, layouts, and boards still reset and remain covered by Undo.
Complexity: S

- [x] P2: R-150: Keep every settings page inside the 375-pixel phone viewport
  Why: The second responsive audit measured two gaps that spot screenshots missed. Appearance kept its desktop control column and the Content protection log let long request paths widen its table, so both pages clipped their right edge.
  Where: src/runtime.js narrow settings rules; test/boot.test.js artifact contracts; design-qa.md responsive matrix
  Acceptance: Every settings page has zero document overflow and no control outside its page at 375 by 812 pixels. Appearance stacks its control column, protection-log paths wrap inside a fixed table, and the same checks stay clean at 680, 900, and 1440 pixels.
  Shipped 2026-08-25: Appearance now stacks the affected rows below 430 pixels. Content keeps all four protection-log columns inside the page and wraps long matches. A full seven-page matrix passed at 1440, 900, 680, and 375 pixels.
  Complexity: S

- [x] P2: R-137: Normalize the control geometry the panel renders
  Why: Controls that sit in the same `.kf-control` column are 32, 36, 38 and 40 pixels tall (`.kf-switch`, `.kf-select`, `.kf-icon-button`, `.kf-button`), which reads as jitter down the right edge of every settings page. Eight radius literals bypass the Corner radius setting: `.kf-toast` and `.kf-toast-action` at 4px, `.kf-icon-button` at 5px, the About panel at 4px, the emote completion list and rows at 9px and 6px, and the two injected header buttons at 5px and 8px. Those two buttons also disagree on height, weight and font size while sitting in the same Kick chrome. Two focus treatments coexist: `outline: var(--focus-ring)` on the nav search, and `outline: 0` plus a box-shadow ring on `.kf-text`, `.kf-textarea`, `.kf-select`, and both multi-stream inputs.
  Where: src/runtime.js UI_CSS around 7289-7500, 7769, 7819-7831, 11555-11573, 12598-12645
  Acceptance: One control height scale, every radius through `--kf-radius` or a token derived from it, one focus treatment, and the two injected buttons sharing a declaration.
  Found and fixed 2026-08-25: the test named "one focus treatment, defined once and used everywhere" scanned only for `outline: 0` written on a `:focus` selector line. `.kf-command-head input` set `outline: 0` in its base rule and received only a box-shadow on focus, so it slipped past a test whose name said it could not. The revised contract reads every base rule and rejects shadow-only focus rings as well.
  Shipped: Settings uses 40 and 32 pixel control tokens, every adjustable corner reads from the radius scale, text controls use the shared outline, and both injected header actions share one base declaration. The artifact test now rejects base outline suppression, shadow-only focus rings, fixed settings radii, and drift between the two injected controls.
  Complexity: M

### P3


## Research-Driven Additions, 2026-09-04 (v1.45.0 to v1.48.0 pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md). The pass began against v1.45.0 (`5ea2173`) and every item below was re-verified against the in-progress v1.48.0 working tree on 2026-09-04, because another session shipped v1.46.0 and v1.47.0 while it ran. Line references are current as of that tree and will drift; the file and function names beside them are the durable part. Continues the R-NN scheme from R-150.

**Two drafted items are not here because that concurrent work implemented them first, and their IDs are retired so nobody reuses them.** R-151 would have asked for build-time compaction of every `_CSS` template; `scripts/strip-comments.mjs` now carries `compactCss` and the hardcoded `SITE_CSS` regex has left `scripts/build.mjs`, leaving 47 recoverable bytes across all seven sheets. R-158 would have asked for `aria-expanded` on the emote tile's action group; the emote rebuild replaced that group with `data-kf-sticker-manage-tile`, which declares `aria-expanded` and keeps it in sync on patch. Both are recorded under Rejected Ideas in [RESEARCH.md](RESEARCH.md) so the measurements survive.

Cross-references to existing work: R-153 is what makes R-147's central claim measurable, because a coverage figure for the bundle is the only way to show whether `onInterfaceClick` is reached at all. R-154 is the missing precondition for [Roadmap_Blocked.md](Roadmap_Blocked.md)'s R-55, whose stated blocker — no signed-in session — expired when the daily-reward fixture was captured on 2026-08-27; on completion, move R-55 back here rather than leaving it recorded as blocked. Inline notes were added above to R-105, R-115, and R-117.

### P1

- [ ] P2: R-156: Surface unrecognized third-party origins in the protection log
  Why: The ad and telemetry host lists are eleven hand-curated entries with no upstream to inherit from, because mainstream filter lists still carry no kick.com ad rules. `report()` fires only when a classification is blocked, so a request to a Kick ad host nobody has added yet is classified allowed and then discarded. The protection log can therefore only ever show what the build already knew.
  Evidence: src/core.mjs:413 AD_HOSTS and :424 TELEMETRY_HOSTS; src/core.mjs:2444 the blocked branch of classifyRequest; src/runtime.js:872, :970 and :989 gate reporting on the blocked flag; src/runtime.js:607 recordProtection caps at 20 entries
  Touches: src/runtime.js network hooks and diagnostics, src/core.mjs classification, src/settings.mjs protection log, translations, tests
  Acceptance: A bounded tally records the origin only — never a path, query, or fragment — of third-party requests that are neither Kick's own hosts nor already classified; the protection log shows them under a distinct "Seen, not blocked" heading with counts; the list is capped, cleared by reset, and never sent anywhere; a fixture carrying a novel ad-shaped origin makes it appear, and one carrying only Kick's own hosts leaves the section empty rather than showing a zero row.
  Complexity: M

- [ ] P2: R-157: Take the compatibility probe sweep off the per-mutation hot path
  Why: `runApplyCycle` runs `compatibilitySnapshot` over the whole document — 24 probe groups, 59 probe entries and 4 derived expectations — on every debounced mutation batch, on a page whose player, chat and viewer counts mutate continuously. Probe winners change on a route change or a Kick deploy, not every 80 milliseconds. The apply cost is already measured and shown, so the improvement is provable rather than asserted.
  Evidence: src/runtime.js:7678 inside the apply cycle and src/runtime.js:12702 on boot; src/runtime.js:7689 recordApplyCost; src/compatibility.mjs LOCATOR_PROBES and DERIVED_EXPECTATIONS, counted 2026-09-04
  Touches: src/runtime.js apply cycle and compatibility publishing, src/core.mjs scheduling decision, test/core.test.js, scripts/check.mjs
  Acceptance: First, measure — record the sweep's own share of a cycle on a channel fixture and on live Kick, and if it is not a material fraction, close this item with that number rather than changing the scheduling. If it is: the full sweep runs on route change, on boot, on a bounded low-frequency interval, and on demand from the settings self-check; every other apply cycle either skips it or runs a cheap subset that names which probes it revalidated; a mid-session Kick change is still noticed within the documented interval, proven by a test that removes a marker between cycles; the published verdict is never a stale snapshot from a previous route; and the recorded apply cost drops by a stated margin against the current build on the same fixture.
  Complexity: M

- [ ] P2: R-159: Keep the mod's own surfaces legible in Windows High Contrast
  Why: One `forced-colors: active` block exists and it covers text-input focus rings. UI_CSS carries 21 drawing box-shadow declarations (25 occurrences, four of them `none`) and 3 gradients, and forced-colors suppresses box-shadow, so every separator, ring and elevation cue drawn that way disappears while everything around it is repainted in system colours. The build ships an accessibility page and four contrast settings, which makes this the one accessibility mode it claims nothing about.
  Evidence: src/runtime.js:8701 the single forced-colors block; counted 2026-09-04 in the UI_CSS range src/runtime.js:7949-9102 — 25 box-shadow occurrences of which 21 draw, and 3 linear-gradients; https://www.w3.org/TR/WCAG22/
  Touches: src/runtime.js UI_CSS, src/settings.mjs, scripts/check.mjs, scripts/verify-extension.mjs
  Acceptance: Every visual boundary the panel, picker, toasts, command menu and multistream board draw only as a shadow has a forced-colors counterpart using a system colour keyword; selected, pressed and disabled states stay distinguishable without relying on custom colour; a check fails when a new shadow-only boundary is added with no forced-colors rule beside it; and the browser gate captures the settings shell and picker with forced-colors emulated and asserts no control loses its edge.
  Complexity: M

- [ ] P2: R-160: Publish a security contact and a drift-report intake
  Why: The repository is public with issues enabled and has no `.github/` directory, `SECURITY.md`, `CONTRIBUTING.md`, or issue template. The whole product position is trust — no remote code, read-only, local-only — and the one thing a user cannot do is report either a vulnerability or a Kick DOM break in a form the drift gates could consume. The About page already produces a sanitized diagnostics block and a compatibility self-test summary, so the intake exists; nothing asks for it.
  Evidence: no .github directory in the tree; zero issues, pull requests and discussions as of 2026-09-04; the settings Compatibility self-test row in src/settings.mjs; the copy-diagnostics action in src/runtime.js; README.md Distribution and listing posture
  Touches: new SECURITY.md, new .github/ISSUE_TEMPLATE files, README.md
  Acceptance: `SECURITY.md` names a disclosure address, what is in scope, and the fact that no server or account exists to attack; a bug template asks for browser and version, userscript manager and version, build version, route, and the two blocks the About page already produces, and says in the form that both are sanitized; the templates add no GitHub Actions workflow; and the README links both from the sections a reader reaches first.
  Complexity: S

- [ ] P2: R-161: Bring design-qa.md's verification block up to the shipped release
  Why: It records the v1.42.0 run — 463 tests, 213 checks, 91 probes, 858,234 bytes — while the project has shipped v1.43.0 through v1.47.0 since. The same line reports 91,766 bytes below the injection ceiling, a figure measured against the 950,000 budget rather than the 1,000,000 ceiling, so it conflates the two numbers the build deliberately keeps apart. The file's own v1.45 sections above it are current, which makes the stale block read as if it were too.
  Evidence: design-qa.md:191; src/runtime.js:1070-1071 the two distinct constants; dist/kick-focus.user.js measured 886,138 bytes on 2026-09-04, 13,862 below the 950,000 budget and 63,862 below the 1,000,000 ceiling after the 50,000-byte seed allowance
  Touches: design-qa.md
  Acceptance: The verification block states the shipped release's counts and byte figures, names budget and ceiling as two separate numbers with the seed allowance shown, and dates the run; nothing in the file attributes a v1.42.0 measurement to the current build.
  Complexity: S

- [ ] P2: R-163: Declare the language of the composer emote dock
  Why: `renderComposerEmoteDock` writes its label, empty state and accessible names into Kick's own document and translates all of them at write time, but it never sets `lang` on the dock. Kick's document is `lang="en"`, so a Spanish or Portuguese label inherits English and a screen reader announces it with English pronunciation — the same WCAG 2.2 SC 3.1.2 failure the search and Drops surfaces just fixed. Found 2026-09-05 while landing R-152.
  Evidence: src/runtime.js renderComposerEmoteDock; src/runtime.js applyInterfaceLanguage stamps `lang` on the six shadow hosts and does not reach page-DOM surfaces
  Touches: src/runtime.js renderComposerEmoteDock, test/i18n-coverage.test.js
  Acceptance: The dock element carries `lang` set to the active locale, it is updated when the language changes (the locale is already in its signature), and the page-DOM gate asserts that every surface it classifies as a page-DOM writer declares a language.
  Complexity: S

- [ ] P2: R-164: Cover the search meta and Drops empty state with a real render
  Why: Neither surface has a single behavioral assertion anywhere — no fixture test, no live-gate check, no artifact contract. R-152 could only be verified statically, so the markup could stop mounting, mount into the wrong container, or lose its Clear control and every gate would stay green. `test/fixtures/drops.html` and `test/fixtures/search.html` already exist and are unused by these paths.
  Evidence: grep for `applySearchEnhancements`, `applyDropsEnhancements`, `kf-search-meta` and `kf-drops-empty` across test/ and scripts/verify-extension.mjs returns only the i18n gate added on 2026-09-05
  Touches: test/fixtures.test.js or a boot-level render, test/fixtures/search.html, test/fixtures/drops.html, scripts/verify-extension.mjs
  Acceptance: A test renders both surfaces against their fixtures and asserts the mounted node, its container, the result count, the Clear control's presence only when a query exists, and that switching the interface language changes the rendered text; the Drops assertions cover the empty state only, since that is the only state the enhancer claims.
  Complexity: M

### P3

- [ ] P3: R-162: Scope saved views by channel, category, and player state
  Why: Saved views are named snapshots applied per route, so a viewer who wants a wide chat on one channel and a hidden chat on another has to switch by hand. FrankerFaceZ solves the general problem with settings profiles selected by a composable filter tree over Channel, Category, Title, TheaterMode, Fullscreen and Time, which is one mechanism instead of a scoping flag per feature. Kick Focus already has the storage, the normalization and the per-route application; what it lacks is the predicate.
  Evidence: README.md saved views; src/core.mjs channelLayouts and its 50-entry cap; src/core.mjs observedChannelPath; https://github.com/FrankerFaceZ/FrankerFaceZ (src/settings/filters.ts, src/settings/profile.ts)
  Touches: src/core.mjs a pure predicate evaluator and its normalization, src/runtime.js view application, src/settings.mjs the editor, import and export, translations, tests
  Acceptance: A saved view carries an optional condition built from route, channel slug, category slug, theater or fullscreen state, and multistream versus solo, combined with all-of and any-of and a single negation; evaluation is pure, total, and cannot throw on a malformed stored condition; the most specific matching view wins under one documented and tested rule, and ties resolve deterministically; the editor states in words which condition is active and why a view did or did not apply; conditions round-trip through import, export and reset; and randomized condition trees preserve the schema invariants.
  Complexity: L
