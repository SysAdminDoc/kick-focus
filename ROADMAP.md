# Roadmap

Updated: **2026-08-14**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks only outstanding work.

## P0 — harden the zero-ad boundary

- Add a repeatable cold-load test under installed Tampermonkey and Violentmonkey on current Chrome/Edge and Firefox. (2026-08-14: the extension half exists as `npm run verify:extension`, which measures `before any page script` there. The script now also measures its own injection timing and prints it on the About page, so a manual run under any manager answers the question without tooling — what remains is automating the manager install. Chrome 138+ gates managers behind a per-extension "Allow user scripts" toggle, which the test must set or account for.)

## P1 — protect compatibility

- Replace single chat/sidebar hooks with ordered locator probes and a visible compatibility self-test. (2026-08-14: use React `__reactProps$`/fiber anchors and `data-*`/`id` attributes rather than utility classes or English `aria-label` text, per 7TV's `src/site/kick.com/`; the current chat hook depends on the label "Resize chatroom" and so also breaks under localization.)
- Add a small fixture suite for current Home, Browse, Category, Search, Channel, and chat DOM shapes. (2026-08-14: fixtures should fail the build when a hook stops matching, which is the failure mode that actually ships. Raw material already exists locally in the gitignored `page_examples/` — MHTML captures of Home, Browse, Following, and a live channel. Decode them and render headless rather than committing them; they are 151 MB and Chrome sandboxes `.mhtml` so they cannot simply be opened and scripted.)
- Add a release checklist that re-runs 1440×900 and 1920×1080 screenshot comparison after Kick deployments.
- Verify logged-in account, subscription, and moderation surfaces without altering their controls. (2026-08-14: also unblocks ad validation — subscribers reportedly still received ads during Kick's tests, and all auditing so far is logged-out.)

## P1 — deepen viewer control

- Remember volume, quality, and VOD position with explicit per-feature privacy controls. (2026-08-14: this is the most re-invented feature on the platform — Kick Augmenter, uKick, kickstiny, kick-stream-tweaks and OverKick all ship it, and it is the most frequently requested thing Kick Focus lacks. Evidence: r/uBlockOrigin 1ojzcnu, 1qsdwha; r/Kick 1qxwa2w.)
- Add favorite/not-interested channel controls and configurable recommended/following rails.
- Add search result count, clear action, and mini-player collision handling.

## P2 — chat and playback utilities

- Sticky chat pause with accessible status and full recovery. (2026-08-14: the most-commented open request on NipahTV, so demand is cross-project.)
- Per-channel keyword highlights and local-only user notes.
- Stream latency/buffer diagnostics that remain off by default.

## P3 — reach

- Localize the settings and command menu.
- Add an optional update manifest only if a publication channel is explicitly approved.
- Evaluate an accessible first-run tour after real-user feedback.

## Explicitly deferred

- Mobile layout or mobile claims
- Remote analytics or telemetry
- Account automation, moderation writes, or bypassing authentication/entitlements
- Publishing to a userscript catalog or extension store without explicit approval

## Research-Driven Additions

Added 2026-08-14 from the research pass recorded in [RESEARCH.md](RESEARCH.md).

### P1

- [ ] P1 — Scrub stitched ad ranges from the HLS manifest
  Why: pre-rolls and mid-rolls are spliced into the stream itself, so they survive every layer this project ships, including the new network ruleset.
  Evidence: markers `#EXT-X-CUE-OUT`/`#EXT-X-CUE-IN`, `#EXT-X-DATERANGE ... stitched-ad-break-start/-end`, and segment ids `stitched-ad-<type>-<n>-<durationNs>`; technique documented in Pkkls/kick-ad-blocker and TwitchAdSolutions m3u8 processing.
  Touches: `src/runtime.js` (fetch hook and an `XMLHttpRequest.responseText` property hook — the player re-reads `responseText` across readyState changes, so the scrub must be cached per body).
  Acceptance: manifests delivered to the player carry no ad ranges or their fencing discontinuities, playback continues without stalling, and any residual break falls back to mute-and-seek.
  Complexity: XL
  Blocked on technique, not effort (measured 2026-08-14): the page realm cannot see the manifest at all. On a live channel, zero `.m3u8` requests appear in page-target network events or in `performance.getEntriesByType('resource')`, while two worker targets attach — `https://kick.com/ivs/<ver>/amazon-ivs-wasmworker.min.js` and a `blob:` worker. The existing `fetch`/XHR hooks therefore cannot reach it. Doing this needs a `Worker`-constructor hook that injects into the IVS worker before it runs (the TwitchAdSolutions/vaft technique), and the player is WASM, so confirm the manifest is fetched by JS inside the worker before committing to it. Treat any attempt as playback-critical and gate it behind a setting that is off by default.

- [ ] P1 — Harden the player against resize, monitor moves, and ultrawide
  Why: three widely reported breakages that make the site feel broken — controls vanish on window resize, moving the window to another monitor reloads the stream and resets VOD position, and ultrawide or 2K crops the video and kills hotkeys.
  Evidence: r/Kick 1r2pjvn, r/KickStreaming 1rs5zge, r/Kick 1ux7syc (2026-07).
  Touches: `src/runtime.js` (player container observer), `SITE_CSS`.
  Acceptance: at 21:9 and after a monitor move the video is uncropped, controls stay reachable, and playback position survives; each fix is individually toggleable.
  Complexity: L

- [ ] P1 — Test the runtime and the companion handshake
  Why: the cross-world protocol and the layout runtime have no direct tests, and the v1.1.0 settings-sync race reached a live browser before anything caught it.
  Evidence: `test/core.test.js` imports only from `src/core.mjs`; `src/runtime.js` is 1,700+ lines with no coverage.
  Touches: `test/`, `src/runtime.js` (extract testable helpers), `src/extension/bridge.js`.
  Acceptance: tests cover route and layout application, filter decisions, and the page-to-companion handshake including both injection orders.
  Complexity: L
  Note: shares fixtures with the DOM fixture suite under "protect compatibility"; build that first.

### P2

- [ ] P2 — Optional remote blocklist subscriptions
  Why: the one filtering capability no other Kick project except uKick offers, and the only practical way for filters to keep pace between releases.
  Evidence: uKick ships subscriptions with auto-sync intervals, import/export, and merge.
  Touches: `src/core.mjs` (validation), `src/runtime.js` (fetch and merge), Content settings page, companion dynamic rules.
  Acceptance: off by default; a user-supplied URL is fetched on an explicit interval, validated, merged, and fully removable.
  Complexity: M
  Risk: contradicts the current "no remote configuration" claim in README. Ship only as explicit opt-in, carry data and never executable content, and reword that claim rather than quietly weakening it.

- [ ] P2 — Firefox package for the companion
  Why: Firefox keeps both Manifest V2 and unrestricted userscript capability, making it the platform where the strongest version of this project can exist.
  Evidence: Mozilla's committed MV2 and MV3 support; `browser_specific_settings` is required for Firefox packaging.
  Touches: `src/extension/manifest.json`, `scripts/build.mjs` (per-browser manifest emit), README.
  Acceptance: an unsigned Firefox package loads via `about:debugging`, blocks the same hosts, and the handshake behaves identically.
  Complexity: M

### P3

- [ ] P3 — Panic switch that fully reverts the page
  Why: the documented first troubleshooting step is disabling the entire script, which is heavy-handed when a single hook has broken.
  Evidence: README troubleshooting note; Kick's help centre warns that script blockers interfere with playback and chat.
  Touches: `src/runtime.js` (teardown of styles, attributes, and observers), command menu.
  Acceptance: one command restores Kick's native layout without a reload, and a second restores Kick Focus.
  Complexity: M
