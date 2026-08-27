# Design QA, premium interface redesign

## v1.45 daily reward capture

The available reward was exercised once in the signed-in Chrome session at 1920 × 889. The capture covers the enabled Claim state, its immediate disabled transition, the chest animation, roulette, final collectible reveal, streak change from 49 to 50, Share action, and the printed 8:00 PM reset. The reward trigger lost its available video after the click and reopening the dialog showed the claimed state without another Claim action.

Kick mounted the controlled dialog about 83 milliseconds after the trigger click. A separate privacy dialog already occupied the first `[role="dialog"]` position in the document, which explains why the old broad query reported the reward handled without ever seeing it. The repaired flow resolves the trigger's `aria-controls` id, checks the labelled heading, waits through the asynchronous mount, and records success only after Kick shows Share plus its reset line. Closing uses the dialog's own Close control and waits for the Radix state change instead of toggling the trigger again.

The network observation was recorded only as a sanitized contract. Kick issued its claim POST four milliseconds after the visible click, answered in 290 milliseconds, refreshed challenges as `claimed`, and later reported the 50-day streak. The fixture keeps method, route shape, status, timing, and field names. It contains no account id, challenge id, collectible id, credential, cookie, authorization header, or token. Runtime code still drives Kick's visible UI and never calls that private endpoint.

- Full lifecycle comparison: `design/qa/comparison-daily-reward-lifecycle-v1.45.png`
- Ready state: `design/qa/daily-reward-claim-stage-1-v1.45.png`
- Opening state: `design/qa/daily-reward-claim-stage-2-v1.45.png`
- Roulette state: `design/qa/daily-reward-claim-stage-3-v1.45.png`
- Confirmed reveal: `design/qa/daily-reward-claim-reveal-v1.45.png`
- Sanitized state and timing fixture: `test/fixtures/daily-reward-live.json`

## v1.45 emote management pass

The signed-in emote tray was checked in Chrome at 1920 × 889 using Kick's live picker and the account's collectible inventory. At rest, every tile is clear of management controls. Hover and keyboard focus open a measured Favorite, source channel, and Remove menu six pixels beside the tile; it prefers the right, flips left at the chat edge, and stays inside the viewport. Compact rows remain 40 pixels tall, Larger Targets raises each action to 40 pixels, and no state changes the virtualized scroll geometry. Expired subscriber emotes were also checked in Locked as dimmed, disabled tiles that retain their source link while disappearing from Favorites, Recent, All, groups, and suggestions.

Collectible rarity now stays inside the artwork tile as one 13-pixel letter badge in Compact, Balanced, Roomy, and Larger Targets. The full meaning remains in the title. The picker also repaints when the account response finishes, rather than waiting for another interaction. The attached user crop and the final crop were compared at the same 220 × 84 size.

Drag verification moved the first All tile after the third, showed the insertion edge and faded source, suppressed the release click, persisted the new order, then restored the original order. The same command path covers Favorites within one scope and custom groups. Organize mode retains Earlier and Later as the non-drag path.

- Management comparison: `design/qa/comparison-sticker-controls-v1.45.png`
- Rarity comparison: `design/qa/comparison-sticker-rarity-v1.45.png`
- Drag insertion state: `design/qa/sticker-drag-marker-v1.45.png`
- Locked subscriber state: `design/qa/sticker-locked-after-v1.45.png`
- Final picker: `design/screenshots/emote-picker.png`

## v1.44 live compact-shell pass

The signed-in Kick channel page was compared at 1920 × 889 and 1440 × 900 in Chrome. Native Kick reserved 596 pixels for its fixed discovery and chat rails at 1920 pixels wide. Kick Focus leaves a 12-pixel reveal edge on each side, uses a 48-pixel header, and overlays either rail when it is needed. At 1920 × 889, the player grew from 1260 × 709 to 1310 × 737 pixels while the channel row dropped from 92 to 78 pixels. At 1440 × 900, the player remained 1330 × 748 pixels with no horizontal overflow.

The emote pass verified six 24-pixel quick controls, eight 34-pixel compact columns at a 340-pixel chat width, and an open picker that keeps auto-hidden chat revealed. Layout and Content & Ads were also checked at 1440 × 900, along with Studio, OLED, Slate, Reduced Motion, and Larger pointer targets.

The first compact-shell pass reclaimed both rails but left the player shorter than the available viewport. The second pass assigned that height to the player and tightened the channel metadata row. It also corrected the chat overlay layer, the wrapped quick-emote limit selector, and the picker-open pin.

The followed-channel comparison uses the same viewport and row on both sides. The left half enlarges Kick's 75 × 75 sidebar thumbnail. The right half loads the matching 350 × 350 `fullsize.webp` profile asset, keeps the still-canvas path for Reduced Motion, and displays the clean channel name.

- Full shell comparison: `design/qa/comparison-compact-shell-v1.44.png`
- Followed preview comparison, thumbnail on the left and full-resolution asset on the right: `design/qa/comparison-following-preview-v1.44.png`
- Final followed preview: `design/screenshots/following-preview.png`
- Final channel capture: `design/screenshots/compact-channel-layout.png`
- Layout settings: `design/screenshots/settings-layout.png`
- Compact emote settings: `design/screenshots/settings-content-emotes.png`
- Live emote picker: `design/screenshots/emote-picker.png`

## Source of truth

The selected visual direction was continued into one target for every settings-menu page:

- Layout: `design/reimagined/settings-layout-premium.png`
- Appearance: `design/reimagined/settings-appearance-premium.png`
- Content & Ads: `design/reimagined/settings-content-ads-premium.png`
- Accessibility & Shortcuts: `design/reimagined/settings-accessibility-shortcuts-premium.png`
- About: `design/reimagined/settings-about-premium.png`

The implementation is exercised through `test/fixtures/settings-preview.html` at
`http://127.0.0.1:4173/test/fixtures/settings-preview.html`.

## Comparison setup

- Target capture size: 1487 × 1058 pixels, normalized to 1440 × 1024 for comparison.
- Implementation capture size: 1440 × 1024 CSS pixels at DPR 1.
- Comparison viewport: 1440 × 610 CSS pixels, with the normalized target and implementation shown together at equal visual height.
- Responsive evidence: 900 × 800 and 680 × 760 CSS pixels at DPR 1.
- Theme/state: Studio theme, Kick Green accent, Balanced radius, top-of-page state unless noted below.
- Layout was captured in Auto mode to match its target and then restored to Compact.
- Content & Ads uses seven intercepted fixture requests so protection metrics contain realistic local data.
- Accessibility was captured in its default state and again with the larger-target and contrast controls enabled.

## Full-view evidence

- `design/qa/comparison-layout.jpg`
- `design/qa/comparison-appearance.jpg`
- `design/qa/comparison-content.jpg`
- `design/qa/comparison-accessibility.jpg`
- `design/qa/comparison-about.jpg`
- `design/screenshots/settings-appearance-themes.png`
- `design/screenshots/multistream-board.png`
- `design/screenshots/extension-popup.png`
- `design/screenshots/emote-picker.png`
- `design/screenshots/emote-library.png`
- `design/screenshots/profile-stats-button.png`

The retained QA comparisons contain the normalized target and browser implementation in the same frame. The current emote capture comes from the verified v1.45.0 bundle. The compact-shell and layout captures remain tied to v1.44.0, and older feature captures remain tied to the release that introduced them.

## Focused evidence

- Shared shell and Layout controls: `design/qa/focused-layout.png`
- Appearance live preview: `design/qa/focused-appearance-preview.png`
- Accessibility control table: `design/qa/focused-accessibility-table.png`
- Responsive shell: `design/qa/settings-responsive-900.jpg` and `design/qa/settings-responsive-680.jpg`

## Findings and iterations

### Iteration 1, shared shell

The first implementation still read as a card-heavy preferences dialog. The shell was rebuilt around the selected editorial-control direction: matte near-black surfaces, thin structural borders, a 240-pixel navigation rail, uppercase page titles, restrained green emphasis, and aligned footer actions.

### Iteration 2, navigation and behavior

- P1: page containers and navigation buttons both used `data-page`, so delegated navigation consumed setting-control clicks. Current-page styling now uses `data-kf-current-page`; an artifact check guards the boundary.
- P2: changing pages retained the prior page's scroll offset and could clip the new heading. Menu changes now reset the page scroll position.
- P2: the 900-pixel navigation breakpoint obscured labels. Descriptions now collapse while labels remain visible and may wrap cleanly.

### Iteration 3, page fidelity

- P2: the Appearance mock depended on meaningful photographic content while the implementation had a text-only preview. A project-bound studio image is now embedded locally and updates inside the live preview.
- P2: the thumbnail-treatment slider overflowed its column at narrower desktop widths. Its labels and track now use a bounded grid.
- P2: the mobile menu exposed a browser scrollbar and felt unfinished. It now uses a clean horizontal navigation strip with all five pages keyboard- and touch-reachable.

### Iteration 4, theme hierarchy and board cleanup

- P1: Studio, OLED, and Slate changed too few tokens to read as separate themes. Each now owns the page canvas, panel depth, raised controls, borders, hover surfaces, selected state, and muted text. The Appearance page previews those layers directly.
- P1: the multi-stream footer occupied the flexible canvas whenever the optional error row was hidden. Explicit grid rows now keep the body flexible and the footer compact in empty, error, and populated states.
- P2: the Appearance page exposed the custom color row before Custom was selected. It now stays hidden until it is relevant, and the four viewing directions use a compact single row at the primary desktop size.
- P2: settings header copy repeated information already present in the page. The shell now keeps identity, autosave status, and close in the header while the page title owns the content area.
- P2: the companion popup used flatter surfaces and an over-bright disabled primary action. Its cards, disabled state, focus treatment, and reduced-motion behavior now match the main interface.

### Iteration 5, responsive recovery and control consistency

- P0: Settings failed at runtime after its renderer moved into a module because one host helper was not wired through. The host contract now names and tests every renderer dependency.
- P1: a 375-pixel viewport clipped the close and Done controls, while the active horizontal tab could open off-screen. The shell no longer exceeds the viewport and scrolls its current tab into view.
- P2: settings search retained the previous page highlight and reset target. Search now owns a distinct shell state and disables page reset until a result opens.
- P2: reset recovery sat over Done and disappeared after seven seconds. It now remains above the footer until Undo or Dismiss is pressed, without moving focus.
- P2: text controls drew a shadow focus ring while buttons used an outline, and control heights stepped between 32 and 40 pixels. One outline, two height tokens, and a radius scale now govern the settings chrome.
- P2: the compact emote organizer hid the names of its two top actions. Organize and Library stay labelled, then wrap as a full-width row on the narrowest chat rail.

### Iteration 6, companion language parity

- P2: the companion popup and both manifests remained English-only after the main settings surface gained Spanish and Portuguese. The packages now carry matching en, es, and pt_BR catalogs, while a stored pt setting renders with pt-BR document metadata.
- P2: longer Spanish and Portuguese status copy could have crowded the 360-pixel popup. Offline, disabled, and recovery states were rendered at 420 by 620 pixels in both languages. Labels wrap inside their cards without clipping the checkbox, state badge, feed action, or primary button.

### Iteration 7, emote management discovery

- P2: emote management was hidden until hover or focus. Favorite now stays visible at rest with quiet contrast, while Remove appears on hover or focus and remains one direct action away.
- P2: the accessibility target setting enlarged the settings shell but left emote controls at their compact size. Normal emote controls now measure 24 by 24 pixels, Larger pointer targets grows them to 40 by 40 pixels, and the virtualized row geometry follows the 88-pixel tiles.
- P2: the compact organizer had no proof across every theme. Paired reference checks at 1440 and 900 pixels plus a nine-shot Studio, OLED, and Slate matrix at 1440, 900, and 680 pixels found no overlap, clipping, or composer obstruction.

### Iteration 8, visible composer recovery

- P2: optional composer recall still depended on an undisclosed keyboard gesture. The same private five-message ring now has a visible Recall control beside Emotes, disabled until the tab has a public send and labelled with the available count.
- P2: adding another composer action could have squeezed the message field or covered Chat. Enabled and focused states were compared with the previous 1440-pixel reference, then checked at 680 pixels. The input, Recall, Emotes, counter, and Chat action remain separate and readable.
- P2: recall still refuses whispers and unrelated editors, clears on reload, and never writes messages to storage. Arrow Up and every modified form now remain untouched.

### Iteration 9, reset recovery boundary

- P2: full reset deleted the local reward-check record even though its Undo snapshot did not carry that record. Reset now leaves the operational cooldown untouched, so a handled reward cannot look due again after settings are cleared.
- P2: the About page now states what reset clears, what it keeps, and why. The longer copy fits beside the destructive action without crowding the local-storage section below it.

### Iteration 10, release-state verification

- P1: the release gate still expected the old reset confirmation and an obsolete chat-resizer dataset flag. It now drives the immediate reset with persistent Undo and Dismiss, then proves the controller-bound separator through a real drag and restore.
- P2: an off-screen Chromium window throttled sub-second timers, which made otherwise healthy focus, scroll, and search journeys intermittent. The gate now keeps ordinary timer behavior while remaining off-screen and bounds every browser command to 70 seconds.
- P2: Kick serves its ranged chat separator inconsistently between channel loads. The fixture contract treats its absence as valid while still failing if another selector starts winning.

### Iteration 11, visual hierarchy and compact-state recovery

- P1: status colors collapsed warnings, unavailable companion state, and healthy readings into the same green treatment. About now separates healthy, warning, error, and neutral readings, while the companion marks a missing service as unavailable.
- P1: fully rounded status and selection backdrops conflicted with the selected rectangular visual system. Settings, multi-stream, the emote workspace, and the companion now share a 4, 6, 8, and 12-pixel corner scale with compact rectangular labels.
- P1: multi-stream Close could leave the viewport at 1280 pixels. The toolbar now wraps before that point, empty boards hide unavailable actions, and Save board remains disabled until a channel and name exist.
- P2: compact chat could place Focus over the composer or an open emote picker, and narrow settings navigation gave no overflow cue. Focus now avoids those surfaces, and the navigation strip exposes its scroll affordance.
- P2: Commands closed Settings and discarded the current page. It now layers above Settings and returns focus, page state, and scroll position when dismissed.
- P2: focusing a followed channel could scroll the sidebar and immediately dismiss the preview opened by that focus. Focus-driven scroll now repositions the preview after layout settles, while ordinary wheel movement still dismisses it.
- P2: Kick can recycle the held chat row while paused even when the stable pixel remains fixed. The release probe now accepts that documented virtualizer fallback, but still fails a connected-row identity change or more than 8 pixels of drift.

### Residual P3 differences

- Layout uses a live textual Current setup summary instead of the mock's tiny schematic, improving legibility while preserving the same hierarchy.
- Appearance keeps the preview focused on one stream and two setting summaries instead of reproducing the mock's longer Following list; this leaves room for the real controls at typical laptop heights.
- Content & Ads preserves the product's complete settings inventory below the mock's above-the-fold grouping, so the page intentionally continues through scrolling.
- About can show real injection, compatibility, or panic-state notices that were not present in the static target.

No actionable P0, P1, or P2 visual differences remain.

## Functional and responsive verification

- Switched Layout between Auto and Compact and changed chat layout.
- Switched Appearance through Studio, OLED, and Slate, then verified the exact selected control retained focus after every re-render.
- Toggled Organize chat stickers off and on from Content & Ads.
- Confirmed that no page-wide keyboard chord is claimed and every former shortcut action remains on visible controls or the command menu.
- Reset a page, waited past the old timeout, used Undo, dismissed the next recovery toast, closed Settings with Done, and reopened it from the Focus command menu.
- Verified the settings shell and populated multi-stream board at 900 and 680 pixels without document-level horizontal overflow.
- Exercised multi-stream empty, invalid-channel, disabled-control, populated-player, and read-only chat states.
- Opened the packaged companion popup without an extension service in English, Spanish, and Portuguese. Its unavailable and disabled states remained legible with the same card geometry.
- Verified emote Favorite visibility, Remove reachability, 24-pixel normal controls, and 40-pixel Larger pointer targets. Compared Studio, OLED, and Slate at 1440, 900, and 680 pixels.
- Enabled composer recall, verified its disabled empty state, recorded two public sends, cycled both from the visible control, and checked the focused control at 1440 and 680 pixels.
- Scrolled the About page to the destructive section and verified the reset explanation, action alignment, wrapping, and separation from the storage table.
- Ran all seven settings pages at 1440 × 900, 900 × 800, 680 × 760, and 375 × 812. The second pass found a fixed Appearance control column and an oversized protection log at 375 pixels. Appearance now stacks those controls, long request paths wrap inside a fixed table, and the repeated matrix has no clipped page control or page-level horizontal overflow.
- Ran the packaged v1.42.0 companion at 1440 × 900 and 1920 × 1080. Chromium passed 98 of 98 asserted checks at each viewport with 15 documented anonymous-session skips. Firefox passed 8 of 8 asserted checks with one documented popup-navigation skip.
- Compared the final 1440-pixel Home capture beside `design/mockups/kick-home-premium.png` at equal height. The canvas, navigation, featured stream, chat rail, category grid, and Focus entry point stay inside the viewport with no clipped controls or broken spacing.
- Ran 463 tests, 213 artifact checks, and 91 deliberate negative probes. The userscript is 858,234 bytes, leaving 91,766 bytes below its injection ceiling after the library seed allowance.
- Browser console inspection after the final build returned no warnings or errors.

## Main Kick theme, v1.31.0

### Source of truth

One route-specific target was created for each main Kick surface. The shared direction called for a graphite canvas, readable 14 to 16 pixel type, compact navigation, text-and-underline tabs, borderless content cards, restrained green accents, and one clear surface per functional group. It explicitly excluded gradients, glass effects, nested cards, excessive pills, tiny labels, and decorative outlines.

- Home: `design/mockups/kick-home-premium.png`
- Browse: `design/mockups/kick-browse-premium.png`
- Category: `design/mockups/kick-category-premium.png`
- Following: `design/mockups/kick-following-premium.png`
- Drops: `design/mockups/kick-drops-premium.png`
- Search: `design/mockups/kick-search-premium.png`
- Channel and chat: `design/mockups/kick-channel-chat-premium.png`

### Comparison setup

- Target images: 1536 × 1024 pixels.
- Live implementation: 1440 × 900 CSS pixels at DPR 1.
- Normalization: the Home target was scaled to 1440 × 960 and cropped from the top to 1440 × 900.
- State: Studio theme, anonymous Kick Home route, natural live content.
- Full comparison: `design/qa/comparison-main-home-v1.31.jpg`.
- Focused chat comparison: `design/qa/focused-main-chat-v1.31.jpg`.
- Final live capture: `design/qa/main-home-implementation-1440-final.png`.
- Wide live capture: `design/qa/main-home-implementation-1920-final.png`.

### Findings and iterations

#### Iteration 1, visual system

- P1: outlines were doing the work of spacing on cards, panels, tabs, and controls. Stream and category cards now rely on image crop, type, and whitespace. Native tabs use text with an active underline.
- P1: 9 to 12 pixel labels weakened the hierarchy in the organizer, picker, search summary, and Drops recovery UI. Core metadata now sits at 12 to 14 pixels, with body copy and controls at 14 to 15 pixels.
- P2: the theme palette had too many close panel layers and visible perimeters. Studio, OLED, and Slate now use quieter borders, deeper canvases, and fewer raised surfaces.
- P2: route headers and empty states repeated explanatory copy. Search and Drops now use shorter labels, compact section spacing, and one clear action when an action exists.

#### Iteration 2, live parity

- P1: the first live capture showed the featured chat header and controls retaining rounded glass treatment. The header, chat controls, and Home blur surfaces were flattened into the same matte system as the route targets.
- P1: the first chat-header selector was broad enough to pad the live resize separator. It was narrowed to the actual `#channel-chatroom` header before release.
- P2: the featured stream and grid were still visually heavier than the target. Their shadows, gradients, card perimeters, and hover lift were removed while thumbnail focus feedback was kept.

### Final verification

- `npm run verify`: 182 artifact checks passed, 76 negative probes fired as expected, and 324 tests passed.
- Live Chromium gate: 88 of 88 checks passed at 1440 × 900 after the layout change. The packaged v1.31.0 extension passed 88 of 88 again at 1920 × 1080. Nine account-only journeys were skipped because the throwaway profile was anonymous.
- Chat resize proof: the 410-pixel chat owner and 409-pixel inner surface moved together to 480 pixels with no row overflow.
- The final live capture has no document-level horizontal overflow, no surviving ad shell, and no actionable P0, P1, or P2 visual mismatch in the implemented theme system.

final result: passed

## Emote picker density and rail layout, v1.43.0

### Comparison setup

- The v1.42.0 reference and v1.43.0 browser capture were rendered from the same `sticker-scroll.html` fixture at 1280 by 720, then placed together in one comparison frame.
- The fixture kept the same 430-pixel chat rail, 143-emote catalog, selected theme, composer, and page content on both sides.

### Findings

- P1: Organize mode responded to the browser viewport, not the chat rail. A 430-pixel rail inside a wide page kept the two-column batch toolbar and broke its labels into narrow fragments. The organizer is now a size container, and its controls stack against the rail width itself.
- P2: Search, the two-line summary, and the five tabs used too much vertical space before the first emote. The summary is now one clipped line with its full value available on hover, controls use the selected density, and Compact fits eight emotes across instead of seven.
- P2: One fixed tile size and one grid cap forced the same tradeoff on every viewer. Content & Ads now exposes Compact, Balanced, and Roomy density plus Short, Medium, and Tall height independently.
- P2: Favorite ordering controls occupied space while they could do nothing. They now appear only for one selected favorite, while Clear appears after the first selection.

### Verification

- Exercised All, Favorites, Groups, Organize, empty, disabled, one-selected, and favorite-order states in the in-app browser.
- Switched between Studio, OLED, and Slate. The same hierarchy, borders, selected states, and focus treatment remained visible in each theme.
- Changed from Compact and Medium to Roomy and Tall through the rendered settings controls, closed Settings, and confirmed the picker updated without a reload.
- The default release screenshot at `design/screenshots/emote-picker.png` was recaptured from the v1.43.0 bundle. The paired comparison showed less picker chrome, one additional column, and no lost action.
- `npm test` passed all 464 tests after the settings schema, grid geometry, container behavior, localization, and rendering checks were updated.
- The packaged v1.43.0 companions passed 97 of 97 asserted Chromium checks at both 1440 by 900 and 1920 by 1080 with 15 documented skips. Firefox passed 8 of 8 with one documented popup-navigation skip.

final result: passed

## Emote workspace, v1.37.0

### Comparison setup

- Baseline and final captures use the same 1440 × 900 CSS viewport at DPR 1.
- The isolated `sticker-scroll.html` fixture supplied 143 picker emotes, including one locked entry. The recorded library state supplied realistic artwork and access labels.
- `design/qa/comparison-emote-picker-v1.37.png` places the old and final picker together.
- `design/qa/comparison-emote-library-v1.37.png` does the same for group management.
- Final standalone captures are `design/screenshots/emote-picker.png` and `design/screenshots/emote-library.png`.
- Narrow checks are recorded in `design/qa/emote-responsive-900-v1.37.png` and `design/qa/emote-responsive-680-v1.37.png`.

### Findings

- P1: Manage opened Content & Ads at its top. The emote manager was several screens below unrelated controls. Emotes now has a navigation entry, and Open library lands there directly.
- P1: custom picker views hid the native shell that owned search. Search now stays above the organizer while native groups and tabs remain hidden until Native is selected.
- P1: group assignment worked one card at a time. The library now supports card selection, Select shown, a shared group target, batch Move, batch Remove, and Clear.
- P2: an empty quick shelf consumed most of the picker header. It is now one compact explanatory row. Most used and Recent stay with the favorites editing view.
- P2: library metadata sat at 8 to 11 pixels and repeated an Open artwork button on every card. Names and metadata are larger, the artwork itself is the link, and selection has a visible accent boundary plus `aria-pressed`.

### Functional verification

- Searched the picker and reduced 143 entries to one result without losing input focus.
- Filled the 24-entry quick shelf from the fixture and confirmed every favorite had a one-click action and removal label.
- Created a group, selected two cards, moved both together, and confirmed both direct group selectors updated.
- Renamed the group with Enter, then deleted it and confirmed its assignments returned to Ungrouped.
- Removed one selected emote, opened Removed, restored the list, and confirmed the removed count returned to zero.
- Compared the picker and manager before and after in paired images. No clipping, broken alignment, incorrect radii, or actionable P0, P1, or P2 visual defect remains at the audited viewport.
- Rechecked the library at 900 × 800 and 680 × 760. The narrow layout stacks channel import and batch actions, keeps the footer reachable, and turns settings navigation into a clean horizontal strip. The mobile search box was removed from that strip after it compressed and overlapped page labels in the first narrow capture.
- `npm run verify` passed 379 tests, 189 artifact checks, and 81 deliberate negative probes. Firefox passed 8 of 8 live checks with its popup check skipped by WebDriver BiDi.
- The broader Chromium live gate reached Kick and passed 90 of 97 available checks. Its first three failures, all in the unrelated followed-channel preview probe, reproduced against untouched v1.36.0. The emote workflow above was exercised in the isolated browser fixture so those live-page failures couldn't hide a result here.

final result: passed
