# Roadmap

Updated: **2026-08-14**

## Shipped in 1.0.0

- Desktop SPA lifecycle for audited public routes
- Compact/hidden discovery, configurable chat, Focus and Theater modes
- Widened browse/category grids and calmer card presentation
- Searchable command menu and editable, conflict-checked shortcuts
- Five-page premium settings UI with autosave, reset, import/export, and diagnostics
- Appearance and accessibility controls
- Labeled content filters and one-time home autoplay pause
- Document-start page-realm ad/telemetry hooks and persistent ad-shell cleanup
- Dependency-free build, syntax/artifact checks, and core tests

## P0 — harden the zero-ad boundary

- Add an optional Manifest V3 companion extension with a minimal `declarativeNetRequest` ruleset for the observed Google ad domains. Keep the userscript fully usable without it and show the active protection layer in settings.
- Add a repeatable cold-load test under installed Tampermonkey and Violentmonkey on current Chrome/Edge and Firefox.
- Add worker-target network capture and a longer timed mid-roll observation run.

## P1 — protect compatibility

- Replace single chat/sidebar hooks with ordered locator probes and a visible compatibility self-test.
- Add a small fixture suite for current Home, Browse, Category, Search, Channel, and chat DOM shapes.
- Add a release checklist that re-runs 1440×900 and 1920×1080 screenshot comparison after Kick deployments.
- Verify logged-in account, subscription, and moderation surfaces without altering their controls.

## P1 — deepen viewer control

- Remember volume, quality, and VOD position with explicit per-feature privacy controls.
- Add favorite/not-interested channel controls and configurable recommended/following rails.
- Add search result count, clear action, and mini-player collision handling.

## P2 — chat and playback utilities

- Sticky chat pause with accessible status and full recovery.
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
