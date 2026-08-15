# Changelog

All notable changes are documented here. Dates use ISO 8601.

## Unreleased

### Added

- Ordered shell locator probes now prefer Kick's ids and data markers, fall back through structural and accessible anchors, and expose a visible compatibility self-test on the About page.
- Committed lightweight Home, Browse, Category, Search, Channel, and localized chat fixtures with build-gating shape tests, without adding the large MHTML captures to history.

## 1.2.0 — 2026-08-14

### Fixed

- A blocked `XMLHttpRequest` reported an error to the caller, which invites telemetry clients to retry and is how blocking one endpoint turns into a request loop. Blocked requests now answer with an empty success, matching what the `fetch` path already did. Measured over five minutes on a live channel: telemetry attempts flat, total requests steady at roughly 54 per minute with no acceleration, and uninterrupted playback.
- Kick Focus never started at all on any load where it won the `document-start` race. The observer that waits for `<body>` read the observer from its callback's first argument, which is the mutation list, so it threw on every mutation and the interface, apply cycle, and filters were never reached. It worked only when injection landed late enough that `<body>` already existed.
- Layout, filtering, ad-shell removal, chat detection, and sidebar sync stopped running after first paint on any busy page. The apply cycle was debounced with no maximum wait, and Kick mutates its DOM faster than the debounce window, so every mutation reset the timer and the work never ran. The delay is now capped, so a continuously changing page still gets serviced. Confirmed against live Kick: card detection went from 0 to 24 on `/browse`.

### Changed

- Analytics SDK blocks in the playback response (`mux_sdk`, `datazoom_sdk`) now follow the Reduce tracking telemetry setting instead of being removed unconditionally. Removing analytics is a privacy choice, not ad blocking, and `datazoom_sdk` was previously stripped from everyone regardless of the setting. Advertising SDKs are still always removed.
- Content labels are read from Kick's own markup — the category slug and short badge elements — instead of matching prose anywhere in a card. "Drop the beat" no longer reads as a Drops promotion and a stream mentioning a casino is no longer classified as gambling. Text matching remains only as a fallback for signals with no structured evidence, and the slug also makes classification work in every language.

### Added

- Ads are now disabled at their source. Kick decides client-side ad behaviour from flags in its `/playback` response, so that response is rewritten in flight: the automatic-ads session flag is reported false and the `google_ads_sdk`, `pal_sdk`, and `datazoom_sdk` blocks are removed before the player sees them. Covers both `fetch` and `XMLHttpRequest`, with the result cached per response body because the player re-reads it as the request progresses. Verified on a live channel — all three SDK blocks cleared, playback unaffected. Ads stitched into the video stream itself are still delivered; no page-level change can remove those.
- Importing settings now names anything it could not keep — values adjusted to a supported range, unknown settings, unknown sections, and upgrades from an unversioned or older file — instead of reporting a clean success while silently dropping part of a configuration.
- The About page explains the Chromium "Allow user scripts" toggle when the script started later than it should have, so the most common "it stopped working" case is answerable without leaving the browser. Hidden when injection was already first or the companion is installed.
- The Content & Ads page now reports whether Kick's ad stack still looks the way this build expects, and warns when it does not. A silent zero in the protection log previously looked identical to a clean page and to defences aiming at something that no longer exists. It found real drift on first run: Kick's playback response carries a `mux_sdk` block this build did not know about.
- The About page now reports when the script actually started, measured from what the page already contained, instead of claiming `document-start`. Chromium managers inject through `chrome.userScripts` and can land after the page's own scripts, so the timing is no longer asserted without evidence. Under the companion extension it reports `before any page script`. The Protection layer card and self-check also report the real layer rather than a fixed string.
- Home-page previews are now silenced rather than paused once. The complaint is about sound on arrival, and Kick restarts previews and inserts new ones as the page lives, so a single pass missed anything added later. Each preview is muted and held muted through a `play` listener, so a preview the site restarts is still silent. Verified by forcing every preview to unmute and play: all stayed muted and paused. Manual playback and other routes are untouched.
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
