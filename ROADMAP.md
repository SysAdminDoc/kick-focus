# Roadmap

Updated: **2026-08-21**

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

R-62 through R-71 from that pass are no longer listed here: they shipped in v1.27.0–v1.29.0 or were closed in RESEARCH.md (R-70). Auto-update, signed-in live gate, SSAI scrub, predictions payload, keyboard emote completion, and first-run tour remain in [Roadmap_Blocked.md](Roadmap_Blocked.md).

## Research-Driven Additions, 2026-08-20 (v1.31.0 pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md), run against v1.31.0. Continues the R-NN scheme from R-71.

### P0

### P1

### P2

- [ ] P2 — R-80 — Use Node 24.19 `expectFailure` for red-proofs
  Why: engines already require ≥24.19; CLAUDE.md records losing uncommitted work to `git checkout --` while proving a gate red.
  Evidence: https://nodejs.org/docs/latest-v24.x/api/test.html (`expectFailure`); `package.json` `engines`; CLAUDE.md 2026-08-16 i18n red-proof note.
  Touches: `test/*.test.js` and any `scripts/check.mjs` parser tests that currently sabotage a copy.
  Acceptance: at least the i18n-coverage and one `check.mjs` red probe use `expectFailure` (or an equivalent in-process sabotage) and no test instructions tell an agent to `git checkout` a dirty file.
  Complexity: S

- [ ] P2 — R-84 — Use CSS `contrast-color()` as a fallback next to the existing JS accent check
  Why: `contrast-color()` is Baseline 2026; Kick Focus already rejects too-dark custom accents in JS because MDN documents mid-tone failures, so CSS can mirror the safe pair without replacing the 3:1 gate.
  Evidence: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/contrast-color ; `src/core.mjs` custom-accent contrast helpers.
  Touches: accent token CSS in `src/runtime.js`, keep the JS 3:1 reject path.
  Acceptance: an invalid/too-dark custom accent still falls back to the safe rose; a passing accent still meets 3:1 against the darkest Studio/OLED/Slate surfaces in a unit test.
  Complexity: S

- [ ] P2 — R-85 — Repeat Export / README help on every settings page (WCAG 2.2 3.2.6)
  Why: export, panic, and install-recovery copy live only on About (`renderAboutPage`); 3.2.6 Consistent Help wants the same help mechanism in the same relative place on every settings page.
  Evidence: https://www.w3.org/WAI/WCAG22/Understanding/consistent-help ; `NAV_ITEMS` + `renderAboutPage` in `src/runtime.js`.
  Touches: settings shell in `src/runtime.js` (footer or header action, not a new page), i18n, a live assert that Layout and About both expose the same help/export control.
  Acceptance: every settings page, including search results, shows the same help or export control in the same shell slot; 680-px width does not clip it.
  Complexity: S

- [ ] P2 — R-81 — Read-only active-chatters card from the endpoint Kick’s page already calls
  Why: Kick’s mobile viewer app advertised an active-chatters list in 2026-08-07 press; `web.kick.com/api/v1/channels/{id}/chat/active-chatters` was captured 2026-08-15 as a same-origin GET; Viewer Hub still has no chatters card.
  Evidence: vault Kick API note 2026-08-15; https://win.gg/kick-rolls-out-updates-including-chat-ban-appeals/ ; `src/core.mjs` `VIEWER_HUB_CARDS`.
  Touches: `src/api.mjs` `endpoints` (only after a live channel document is observed requesting it), `src/live.mjs`, Viewer Hub builders, i18n, live API-drift list.
  Acceptance: signed-in channel shows bots/moderators/vips/ogs counts or an unavailable sentence; signed-out is unavailable not zero; if the page no longer calls the URL, the item is closed with that measurement rather than guessed.
  Complexity: M

- [ ] P2 — R-82 — Verify the Kick gateway transport when the broker names `KICK`
  Why: `REALTIME_TRANSPORTS.KICK` is registered `verified: false` and never contacted; kick-core (2026-08-09) treats `wss://websockets.kick.com/viewer/v1/connect?token=` as the current path, and a Pusher Authorized Connections flip would drop anonymous chat.
  Evidence: `src/api.mjs` `kickGatewaySocketUrl` / `verified: false`; https://github.com/Pkkls/kick-core ; README realtime section.
  Touches: `src/live.mjs` `connectRealtime`, diagnostics, `scripts/verify-extension.mjs` (skip unless broker returns KICK).
  Acceptance: when the broker offers only KICK, the build either receives a `ChatMessageEvent` and marks the transport verified, or degrades to DOM and reports `unverified-transport-failed`; Pusher remains preferred when both are offered.
  Complexity: M

- [ ] P2 — R-83 — Show live duration on discovery cards from data Kick already sent
  Why: sixem/kick-enhancer (v0.1.1, 2026-07-31) shows uptime without opening the stream; Kick Focus only paints uptime on the player (`showUptime`).
  Evidence: https://github.com/sixem/kick-enhancer ; `src/runtime.js` uptime chip vs card taggers.
  Touches: card tagger in `src/runtime.js`, `src/api.mjs` / `current-viewers` if that is the source the page already uses, CSS, live card-slug derived check.
  Acceptance: a live home/browse card that Kick marks LIVE shows a duration or nothing (never a guessed time); compact density still fits; 1440×900 has no card overflow.
  Complexity: M

- [ ] P2 — R-78 — Extract settings UI from `runtime.js` behind a `host` factory
  Why: `src/runtime.js` is 11,566 lines and 625,776 bytes (~64% of the userscript); settings render/search/import already form a closed boundary the same way `createLive` / `createMultistream` do.
  Evidence: line counts 2026-08-20; `createLive` / `createMultistream` factory pattern in `src/live.mjs` and `src/multistream.mjs`; CLAUDE.md concat-order / unique-top-level-name rules.
  Touches: new `src/settings.mjs` (or similar), `scripts/build.mjs` concat order, `scripts/check.mjs` symbol-definition gate, `test/boot.test.js`.
  Acceptance: settings pages still render in the live gate; bundle `node --check` passes; no duplicate top-level names; `runtime.js` loses the `render*Page` / `NAV_ITEMS` block rather than gaining a wrapper.
  Complexity: L

- [ ] P2 — R-79 — Add `layout.chat = 'left'` without breaking the theater separator
  Why: `layout.chat` only allows `right|docked|hidden` (`src/core.mjs`); 7TV #914, Left Kick, and uKick all ship chat-left, and Kick Focus just finished right-side theater geometry in v1.28.0/v1.31.0.
  Evidence: `enumValue(layout.chat, ['right', 'docked', 'hidden'])`; https://github.com/SevenTV/Extension/issues/914 ; `html[data-kf-chat="right"]` rules in `src/runtime.js` `SITE_CSS`.
  Touches: `src/core.mjs` `DEFAULT_SETTINGS` + `normalizeSettings` + `VIEWING_PRESETS`, `src/runtime.js` chat layout CSS and Layout page segmented control, i18n, `scripts/verify-extension.mjs` theater+drag probes at left.
  Acceptance: Left is selectable, persists, and is reversible; theater still keeps player+chat in viewport; separator drag 320–520 px updates both layers; 1440×900 live theater check passes with chat on the left.
  Complexity: L

### P3

- [ ] P3 — R-86 — Local last-N own composer recall on Shift+Up
  Why: Greasy Fork “Kick Chat History” (2026-08-04) stores the last five *sent* messages and leaves Kick’s ArrowUp alone; Kick Focus session search is incoming-only and off by default.
  Evidence: https://greasyfork.org/en/scripts/by-site/kick.com?sort=total_installs (Kick Chat History); `content.chatHistory` in `src/core.mjs`.
  Touches: `src/runtime.js` composer hooks, a small in-memory ring of this tab’s own sends, i18n, a setting default off.
  Acceptance: Shift+Up cycles only messages this tab sent; whispers are excluded; reload clears the ring; Kick’s ArrowUp is not captured; nothing is written to disk.
  Complexity: M

- [ ] P3 — R-87 — Following-rail hover preview from Kick’s own thumbnail
  Why: a Greasy Fork script dated 2026-08-09/11 and Mo'Kick both advertise sidebar hover previews; Kick Focus already has card chips and rail hide toggles but no preview.
  Evidence: Greasy Fork Kick Sidebar Stream Thumbnail Preview; Mo'Kick CWS feature list.
  Touches: sidebar tagging in `src/runtime.js`, CSS, Reduced Motion (static frame), live skip when the rail is hidden.
  Acceptance: hovering a followed-rail row shows a preview that stays on-screen; keyboard focus can open and Escape closes it; `prefers-reduced-motion` uses a still thumb; no extra Kick permission.
  Complexity: M

- [ ] P3 — R-88 — Local session watch-time on the Viewer page, labelled as local
  Why: Kick Augmenter and Enhancer both ship watch-time; Kick Levels remain unreadable without the reward dialog, and a local counter must not be presented as Kick’s level.
  Evidence: Kick Augmenter CWS; enhancer.at Kick features; `VIEWER_HUB_REASONS.dialog-closed` in `src/core.mjs`.
  Touches: `src/core.mjs` Viewer Hub card registry, `src/runtime.js`, i18n.
  Acceptance: the card says it is this browser session’s timer; it resets on reload; it never writes a Kick level; signed-out still explains itself.
  Complexity: S

- [ ] P3 — R-89 — Print userscript size percent on About diagnostics
  Why: R-72 can regress without a runtime signal; the build already knows the byte length and the 1 MB budget.
  Evidence: `scripts/check.mjs` `SIZE_BUDGETS`; `renderAboutPage`.
  Touches: `scripts/build.mjs` (stamp bytes), About table, `scripts/check.mjs`.
  Acceptance: About shows `N / 1,000,000 bytes` for the userscript; a unit or artifact test fails if the stamped number disagrees with the built file.
  Complexity: S

## Research-Driven Additions, 2026-08-21 (v1.31.0 differential)

Added from the differential research recorded in [RESEARCH.md](RESEARCH.md), run against unchanged v1.31.0 one day after the 2026-08-20 pass. Continues the R-NN scheme from R-89. Does not duplicate R-72–R-89; see inline notes on R-72 and R-74 above.

### P1

- [ ] P1 — R-96 — Hold a paused transcript with a row anchor instead of a pixel
  Why: `applyChatPause` pins `messages.scrollTop` to one number and restores it from a MutationObserver. Kick's transcript is virtualised and recycles rows out of the top, so the browser's scroll anchoring adjusts `scrollTop` under the pin and the restored number points further down the shortened list each time. Measured on kick.com 2026-08-21 across five live runs: a transcript paused 300px back reached the live edge within 1.5 seconds every time, with the Resume control still showing.
  Evidence: `scripts/verify-extension.mjs` "scrolling chat up enters the paused state" detail line, which reports the held pixel and the distance off the live edge on every run; `src/runtime.js` `applyChatPause` `restoreScroll`; DOM measurement of `#chatroom-messages` (26 rows in the DOM against a scroll height of several thousand pixels, `overflow-y: hidden`, Kick owning `scrollTop`).
  Touches: `src/runtime.js` `applyChatPause` (capture an anchor row from `[data-index]` plus its offset within the viewport rather than a scroll offset, and restore against that row while it is still in the DOM), the live probe's reported numbers, which become assertable once a row anchor holds.
  Acceptance: WHEN chat is paused 300px back on a live channel, THEN after 5 seconds of incoming messages the anchored row SHALL still be within 8px of where it was, and the transcript SHALL still be more than 64px off the live edge; the live probe asserts both instead of only reporting them; when the anchor row is itself recycled out, the pause falls back to the current pixel pin rather than jumping.
  Complexity: M

- [ ] P1 — R-96 — Hold a paused transcript with a row anchor instead of a pixel
  Why: `applyChatPause` pins `messages.scrollTop` to one number and restores it from a MutationObserver. Kick's transcript is virtualised and recycles rows out of the top, so the browser's scroll anchoring adjusts `scrollTop` under the pin and the restored number points further down the shortened list each time. Measured on kick.com 2026-08-21 across five live runs: a transcript paused 300px back reached the live edge within 1.5 seconds every time, with the Resume control still showing.
  Evidence: `scripts/verify-extension.mjs` "scrolling chat up enters the paused state" detail line, which reports the held pixel and the distance off the live edge on every run; `src/runtime.js` `applyChatPause` `restoreScroll`; DOM measurement of `#chatroom-messages` (26 rows in the DOM against a scroll height of several thousand pixels, `overflow-y: hidden`, Kick owning `scrollTop`).
  Touches: `src/runtime.js` `applyChatPause` (capture an anchor row from `[data-index]` plus its offset within the viewport rather than a scroll offset, and restore against that row while it is still in the DOM), the live probe's reported numbers, which become assertable once a row anchor holds.
  Acceptance: WHEN chat is paused 300px back on a live channel, THEN after 5 seconds of incoming messages the anchored row SHALL still be within 8px of where it was, and the transcript SHALL still be more than 64px off the live edge; the live probe asserts both instead of only reporting them; when the anchor row is itself recycled out, the pause falls back to the current pixel pin rather than jumping.
  Complexity: M

- [ ] P1 — R-90 — Skip hideable tagging when the winning probe is not the recorded winner for this route
  Why: `tagHideableElements` stamps `data-kf-element` on whatever `findAllProbe` returns, and `findAllProbe` takes the first probe that matches any node, so a dropped Kick test id can fall through to a looser selector and `display:none` the wrong control.
  Evidence: `src/runtime.js` `tagHideableElements`; `src/compatibility.mjs` `findAllProbe` (`pip-testid` then `pip-icon`, same pattern for the other hideables); `scripts/fixture-contract.mjs` `shell` map (covers main/sidebar/chat/card only — hideable hooks are absent today); Refined GitHub hotfix *effect* without a remote feed (RESEARCH.md 2026-08-21).
  Touches: `scripts/fixture-contract.mjs` (add a `hideable` winner map per route, or extend `shell`), `src/runtime.js` `tagHideableElements`, `test/fixtures.test.js`, live skip when the control is absent on this route.
  Acceptance: if the recorded probe for that hideable id on this route is absent or a different probe won, the node is left visible and untagged; a synthetic fixture with a fallback match fails the test unless tagging is skipped; default `layout.hidden` still queries nothing.
  Complexity: M
  Note (2026-08-21 audit): tagging now skips when a hideable probe matches 0 or more than 4 nodes, which stops a crowd match. The recorded-winner map this item asked for is still missing.

### P2

## Audit leftovers, 2026-08-21

Incomplete work found in the v1.32.0 audit that was not already R-72–R-91. R-73 (README ads copy) and R-92 (diagnostic settingsDiff + probes) shipped in that pass and were removed from the incomplete list.

### P2

- [ ] P2 — R-93 — Translate core-originated import and storage errors, and catch ternary toasts
  Why: es/pt users still see English for import failures, save-status chips, shortcut rebind copy, and Viewer source sentences. `test/i18n-coverage.test.js` only scans `showToast('literal')`, so `showToast(cond ? 'a' : 'b')` and template toasts never enter the dictionary.
  Evidence: `src/core.mjs` `validateImportedSettings` / `describeStorageFailures`; `src/runtime.js` `onImportFile`, `setSaveStatus`, shortcut rebind; `test/i18n-coverage.test.js` `SCANNERS`.
  Touches: `TRANSLATIONS` in `src/runtime.js`, the i18n scanner, and a size trade against R-72.
  Acceptance: every import/reset/save-status string has es and pt entries; the scanner fails if a ternary showToast literal is added without a dictionary key; userscript stays under the 1 MB budget.
  Complexity: M

- [ ] P2 — R-94 — Live-gate OLED/Slate nested surfaces and the signed-in / Firefox gates
  Why: this audit traced settings, About, import, popup, and all three theme tokens in source, but did not run `verify:extension` against OLED and Slate nested overlays, a signed-in session, or Firefox.
  Evidence: CLAUDE.md live-gate notes; `src/extension/popup.html` is Studio-token only; `npm run verify:firefox` and signed-in journeys.
  Touches: `scripts/verify-extension.mjs` optional theme sweep, `scripts/verify-firefox.mjs`, signed-in matrix.
  Acceptance: OLED and Slate settings dialogs, toasts, and the companion popup remain readable at 1440x900; Firefox 8/8 still holds; signed-in skips stay skips rather than false passes.
  Complexity: M

