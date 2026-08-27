# Roadmap

Updated: **2026-08-27**

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
  Complexity: L

- [ ] P3: R-118: Add an all-channel private notes index with content search
  Why: Notes are currently channel-bound, so a viewer cannot find a remembered channel by note text; adjacent extension users request a notes index.
  Evidence: src/runtime.js CHANNEL_NOTES_KEY and channel notes; https://github.com/Seldszar/Gumbo/issues/205
  Touches: src/runtime.js notes storage and search surface, src/core.mjs normalization, settings export/import, translations, tests
  Acceptance: A local index lists every channel with a note and searches normalized slug plus note text; results open the channel or edit the note; import, export, reset, and Undo include the index; no note content leaves the browser and an empty index explains how to add the first note.
  Complexity: M

## Research-Driven Additions

### P1, profile comment emote reliability and direct access

- [ ] P1: R-119: Restore removed emotes individually
  Why: The picker stores a showHidden state but renders no control for it. After the seven-second Undo expires, the Library can restore only the entire removed set.
  Evidence: src/runtime.js:5052-5055; src/runtime.js:5548-5556; src/runtime.js:5715-5718; src/settings.mjs:502
  Touches: shared mutation commands from R-120, src/runtime.js picker views and actions, src/settings.mjs Library views, src/storage.mjs normalized hidden state and bounded tombstones, emote tests, browser verifier
  Acceptance: Removing an emote keeps a bounded tombstone with its key and safe last-known display metadata; picker and Library both expose a Removed view with a count; one emote, the current selection, or the shown result set can be restored before rediscovery; each restore changes only removed state, offers Undo, survives reload, and announces a concise status; Restore all remains available but is not the only recovery path; migration tests preserve every existing hidden key.
  Complexity: M

- [ ] P1: R-120: Use one mutation command layer in the picker and Library
  Why: The same create, delete, move, remove, and restore intent currently has different persistence and Undo behavior depending on which surface runs it.
  Evidence: src/runtime.js:5433-5542; src/runtime.js:10525-10619; src/storage.mjs emote-library normalization; RESEARCH.md Competitive Landscape
  Touches: new pure command module or R-114 emote factory, src/runtime.js, src/settings.mjs, src/storage.mjs, unit and property tests
  Acceptance: Create group, rename, delete, reorder, favorite, move, remove, and restore have one normalized command contract and one inverse record; picker and Library produce byte-equivalent persisted state for equivalent actions; every destructive action offers one-step Undo; duplicate and invalid commands are no-ops with a visible status; randomized command sequences preserve schema invariants.
  Complexity: L

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

- [ ] P1: R-124: Add a compact channel-aware favorites shelf above the native comment input
  Why: Frequent commenters should reach their most-used emotes without opening the full catalog, while the native composer must remain the source of truth.
  Evidence: src/runtime.js native composer delegation; https://chromewebstore.google.com/detail/wesutil/igdnndpfofcemcoellnefdflnmcchmle; https://github.com/jakubn11/kick-third-party-emotes; https://github.com/Xzensi/NipahTV
  Touches: src/runtime.js profile composer adapter and shelf, src/core.mjs bounded preference, translations, picker tests, browser verifier
  Acceptance: An opt-in shelf shows current-channel favorites first and fills remaining slots from global favorites in stable order; one activation delegates insertion to the native composer and never sends; the shelf hides when empty, can be collapsed from the same surface, follows route and entitlement changes, has readable names and standard keyboard behavior, and fits without covering host controls at 1440, 900, and 680 pixels.
  Complexity: M

### P2, profile comment emote organization and polish

- [ ] P2: R-125: Let users reorder custom groups without drag-only interaction
  Why: Groups append in creation order and cannot be rearranged, so an active collection can remain behind old groups permanently.
  Evidence: src/runtime.js custom group create and delete paths; src/storage.mjs group normalization; https://www.w3.org/TR/WCAG22/
  Touches: shared mutation commands from R-120, picker and Library group controls, import and export normalization, translations, tests
  Acceptance: Each custom group has visible Move earlier and Move later controls in picker and Library; controls disable at the boundaries, preserve selection, and offer Undo; order survives reload, import, export, and two-tab convergence; pointer use is optional and no drag gesture is required.
  Complexity: S

- [ ] P2: R-126: Search emotes by name, source, native group, and custom group with stable ranking
  Why: Picker search currently matches only the descriptor name while the Library considers more context, so the same catalog can return different results.
  Evidence: src/runtime.js picker filter; src/settings.mjs Library filter; src/storage.mjs normalized descriptor fields; https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
  Touches: shared pure search index and ranker, picker and Library renderers, translations, search tests, performance probe
  Acceptance: Both surfaces normalize the same searchable fields; exact name ranks before prefix, then token, then substring; ties prefer current-profile availability, favorites, recent use, and stable catalog order; custom and native group matches are visibly explained; across 100 deterministic queries over 2,400 fixtures, pure search stays at or below 16 ms at p95 on the supported Node 24 baseline; no remote provider or fuzzy dependency is added.
  Complexity: M

- [ ] P2: R-127: Assign one emote to a group directly from its tile
  Why: Moving a single emote currently requires entering Organize, selecting it, choosing a destination, and pressing Move.
  Evidence: src/runtime.js:5162-5542; design/qa/emote-picker-all-v1.38.png
  Touches: tile management menu, mutation commands from R-120, picker and Library, translations, browser tests
  Acceptance: A visible tile action opens an accessible group menu with current membership; one action moves or removes the emote from a custom group without entering batch mode; the result is announced, offers Undo, retains focus on the tile, and uses the same command as Library and batch organization.
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
