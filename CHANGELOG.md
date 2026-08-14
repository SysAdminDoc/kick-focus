# Changelog

All notable changes are documented here. Dates use ISO 8601.

## Unreleased

### Fixed

- Layout, filtering, ad-shell removal, chat detection, and sidebar sync stopped running after first paint on any busy page. The apply cycle was debounced with no maximum wait, and Kick mutates its DOM faster than the debounce window, so every mutation reset the timer and the work never ran. The delay is now capped, so a continuously changing page still gets serviced. Confirmed against live Kick: card detection went from 0 to 24 on `/browse`.

### Added

- Content filtering now fails open. When filters would hide more than a quarter of a grid of eight or more cards, nothing is hidden and the Content & Ads page explains why — a filter that empties a page is indistinguishable from the site being broken.
- `npm run verify:extension` refuses to report DOM results when it did not reach the real site. Kick serves headless browsers a short JSON error, against which every layout assertion passed trivially; the suite now runs headed and gates those checks on Kick's own markup being present.

## 1.1.0 — 2026-08-14

### Added

- Optional Manifest V3 companion extension (`dist/extension/`, plus a shareable zip) that blocks known ad hosts at the browser network layer with `declarativeNetRequest`, which a Chromium userscript can no longer do for itself.
- Isolated-world bridge, service worker, and popup showing live protection state, enabled rulesets, per-tab block count, and a telemetry toggle.
- Companion handshake: the settings page and self-check now report `Network + page` or `Page only` based on what is actually installed, instead of describing a layer that may not be there.
- `npm run verify:extension`, a live proof-of-load that drives Chromium against Kick and asserts network-level blocking, page-world boot, and popup render.
- Generated extension icons and a dependency-free zip writer, keeping the project free of runtime and build dependencies.

### Changed

- The build emits both targets from one source, and generates the extension's network rules from the same host lists the page-realm classifier uses, so the layers cannot diverge.
- `npm run verify` grew from 8 to 27 checks, now covering version parity across `package.json`, the manifest, and the userscript metadata, plus rule/blocklist parity and extension shape.

### Fixed

- Both targets now refuse to boot twice, so having the userscript and the companion installed together no longer mounts two interfaces.
- Settings reached the companion only after the user changed something, leaving defaults that are on (such as Reduce tracking telemetry) disagreeing with the network rulesets on a fresh profile. The page now announces its effective settings, and the companion asks for them, so the exchange no longer depends on which script is injected first.

## 1.0.0 — 2026-08-14

### Added

- Initial desktop-only Kick Focus userscript.
- Premium Focus Canvas layout direction and five settings-page mockups.
- Layout, Appearance, Content & Ads, Accessibility & Shortcuts, and About pages.
- Focus/Theater modes, compact/hidden sidebar, right/docked/hidden chat, chat width, grid density, and per-channel layout memory.
- Command menu, configurable shortcuts, conflict recovery, autosave, scoped/all reset confirmation, and JSON import/export.
- Theme/accent/radius/thumbnail/text/motion/contrast controls.
- Mature, casino, Drops, promoted-content, autoplay, and telemetry controls.
- Best-effort document-start ad request interception, DOM-shell cleanup, and sanitized in-memory protection log.
- SPA route handling and reinsertion-resistant DOM observer.
- Dependency-free build, artifact validation, and core test suite.

### Verified

- Logged-out Home, Browse, Categories, Clips, Category, Channel, search, and Log In surfaces.
- 1440×900 primary and 1920×1080 secondary desktop geometry.
- Live channel-to-channel and channel-to-browse SPA journeys.
- Patched SPA ad pass with zero observed ad-domain network requests, seven blocked page calls, and two removed ad scripts/shells.

### Known limitations

- Browser-manager cold-start timing, authenticated surfaces, Firefox/Safari, worker-only delivery, and server-side stitched ads remain unverified.
