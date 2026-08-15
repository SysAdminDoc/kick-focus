# Design QA — Premium settings redesign

## Source of truth

The selected ImageGen direction was continued into one target for every settings-menu page:

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

Each retained image contains the normalized ImageGen target and its browser implementation together in the same comparison frame. Standalone browser captures and normalization intermediates were intentionally excluded from version control.

## Focused evidence

- Shared shell and Layout controls: `design/qa/focused-layout.png`
- Appearance live preview: `design/qa/focused-appearance-preview.png`
- Accessibility shortcut conflict table: `design/qa/focused-accessibility-table.png`
- Responsive shell: `design/qa/settings-responsive-900.jpg` and `design/qa/settings-responsive-680.jpg`

## Findings and iterations

### Iteration 1 — shared shell

The first implementation still read as a card-heavy preferences dialog. The shell was rebuilt around the selected editorial-control direction: matte near-black surfaces, thin structural borders, a 240-pixel navigation rail, uppercase page titles, restrained green emphasis, and aligned footer actions.

### Iteration 2 — navigation and behavior

- P1: page containers and navigation buttons both used `data-page`, so delegated navigation consumed setting-control clicks. Current-page styling now uses `data-kf-current-page`; an artifact check guards the boundary.
- P2: changing pages retained the prior page's scroll offset and could clip the new heading. Menu changes now reset the page scroll position.
- P2: the 900-pixel navigation breakpoint obscured labels. Descriptions now collapse while labels remain visible and may wrap cleanly.

### Iteration 3 — page fidelity

- P2: the Appearance mock depended on meaningful photographic content while the implementation had a text-only preview. A project-bound ImageGen studio image is now embedded locally and updates inside the live preview.
- P2: the thumbnail-treatment slider overflowed its column at narrower desktop widths. Its labels and track now use a bounded grid.
- P2: the mobile menu exposed a browser scrollbar and felt unfinished. It now uses a clean horizontal navigation strip with all five pages keyboard- and touch-reachable.

### Residual P3 differences

- Layout uses a live textual Current setup summary instead of the mock's tiny schematic, improving legibility while preserving the same hierarchy.
- Appearance keeps the preview focused on one stream and two setting summaries instead of reproducing the mock's longer Following list; this leaves room for the real controls at typical laptop heights.
- Content & Ads preserves the product's complete settings inventory below the mock's above-the-fold grouping, so the page intentionally continues through scrolling.
- About can show real injection, compatibility, or panic-state notices that were not present in the static target.

No actionable P0, P1, or P2 visual differences remain.

## Functional and responsive verification

- Switched Layout between Auto and Compact and changed chat layout.
- Switched Appearance between OLED and Studio, changed the interface language, and verified the generated preview remained fitted.
- Toggled Organize chat stickers off and on from Content & Ads.
- Entered and canceled shortcut capture, and confirmed a duplicate `F` assignment reports a conflict without changing saved settings.
- Opened and canceled Reset confirmation, closed Settings with Done, and reopened it from the Focus command menu.
- Verified the 900-pixel two-column shell and 680-pixel horizontal-menu shell without document-level horizontal overflow.
- Browser console inspection after the final build returned no warnings or errors.

final result: passed
