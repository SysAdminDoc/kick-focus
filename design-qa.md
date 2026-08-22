# Design QA, premium interface redesign

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
- Accessibility was captured once in its default state and once while assigning `F` to Open settings to prove the conflict treatment.

## Full-view evidence

- `design/qa/comparison-layout.jpg`
- `design/qa/comparison-appearance.jpg`
- `design/qa/comparison-content.jpg`
- `design/qa/comparison-accessibility.jpg`
- `design/qa/comparison-about.jpg`
- `design/screenshots/settings-appearance-themes.png`
- `design/screenshots/multistream-board.png`
- `design/screenshots/extension-popup.png`

Each retained image contains the normalized target and its browser implementation together in the same comparison frame. Standalone browser captures and normalization intermediates were intentionally excluded from version control.

## Focused evidence

- Shared shell and Layout controls: `design/qa/focused-layout.png`
- Appearance live preview: `design/qa/focused-appearance-preview.png`
- Accessibility shortcut conflict table: `design/qa/focused-accessibility-table.png`
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
- Entered and canceled shortcut capture, and confirmed a duplicate `F` assignment reports a conflict without changing saved settings.
- Opened and canceled Reset confirmation, closed Settings with Done, and reopened it from the Focus command menu.
- Verified the settings shell and populated multi-stream board at 900 and 680 pixels without document-level horizontal overflow.
- Exercised multi-stream empty, invalid-channel, disabled-control, populated-player, and read-only chat states.
- Opened the companion popup without an extension service and verified its unavailable and disabled states remained legible.
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
