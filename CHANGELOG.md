# Changelog

All notable changes are documented here. Dates use ISO 8601.

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
