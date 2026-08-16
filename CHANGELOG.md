# Changelog

All notable changes are documented here. Dates use ISO 8601.

## Unreleased

### Fixed

- **"Reset all settings" now keeps your recorded emote library and actually clears your private data.** It used to do the reverse: it destroyed the library — including the first-seen/rename provenance that cannot be regenerated — while leaving notes, keyword filters, layouts, favorites, not-interested channels, media preferences, usage counts, and multi-stream layouts untouched. A factory reset now clears all of those and preserves the library, and the dialog says so.
- **Export and import now cover every store, so a backup is a real backup.** Export previously omitted per-channel layouts, favorite and not-interested channels, chat keyword filters, channel notes, and media preferences — channel notes had no backup path at all — while the panel promised "the only way to keep these." All of them travel in the export now, import restores every one, and import is non-destructive: it snapshots your current settings first and offers **Undo import**. Malformed and prototype-pollution keys (`__proto__`, `constructor`, `prototype`) are dropped per store, and emote usage counts are bounded on both read and write instead of growing without limit.

- **The companion no longer hard-blocks `litix.io`, which was reintroducing a stream-entry delay.** The page realm answers that telemetry host with an empty 200, which the player accepts, but the companion's network layer was cancelling it outright — the exact block that triggers an unbounded retry storm (documented upstream as "massive delays entering live streams"). It is now excluded from the Chromium DNR and Firefox webRequest cancel sets on both engines, and a gate keeps it out.
- **The recorded emote library no longer silently drops new emotes once it fills up.** At 2,400 entries the old cap kept the *oldest* records and discarded every newly seen emote, and it rewrote the whole ~0.5 MB store on every scan cycle. Now the library evicts the most disposable records first — chat-only (`observed`) before locked, oldest-seen first — and never evicts an emote you have available, favorited, or filed in a custom group, so a full library makes room for a new emote instead of ignoring it. Background merges from chat and the picker are debounced into one write (and flushed when the tab closes) rather than rewriting on every cycle.
- **Removing an emote now frees its library slot.** "Remove" previously only hid the record, so it still counted toward the cap and kept being re-recorded from chat. It now deletes the record, keeps the emote out until you restore it, and the Removed view offers a single "Restore all removed" action.

- **The live extension proof no longer exits 0 when it verified nothing.** A behavioral gate that reports success without a browser is worse than none, so `verify:extension` and `release:check` now fail loudly when Chromium is absent (set `KF_ALLOW_NO_CHROMIUM=1` to downgrade to a skip on a machine that genuinely cannot install one). The matched-rule readback — which needs `declarativeNetRequestFeedback`, a permission the release manifest deliberately omits so Chrome does not warn about browsing history — is now conditional on that permission rather than failing the shipped artifact, with `ERR_BLOCKED_BY_CLIENT` remaining the authoritative block proof. The isolated companion proof was re-run against live Kick: 22/22 checks pass at 1440×900.

### Internal

- Replaced a literal NUL byte in `src/core.mjs` (the favorites-key separator) with a `\u0000` escape. The runtime string is identical, but the source is now plain text, so ripgrep no longer classifies the settings-schema module as binary — restoring the repo's own re-grep-after-edit safeguard.

## 1.9.0 — 2026-08-15

Emote schema 5. Existing favorites migrate without loss.

### Added

- **Emote favorites are now ordered, and can be scoped to one channel.** A favorite you save on a channel appears only there, above your global ones; global favorites still follow you everywhere. Order is explicit and set with the ‹ › controls in the favorites view — Kick's own "Frequently Used" ranks nothing, so this is the only real ordering available. New favorites stay global by default, so nothing you already had moves; the Content settings choose otherwise.

  Favorites keep working when the channel's emote set is not loaded, because the library already stores a full snapshot for every recorded emote.

  Previous versions stored a flat favorites list with no scope. Position in that list *was* the order, so it carries over as your global order with nothing lost.

## 1.8.0 — 2026-08-15

Emote schema 4. Existing libraries migrate without loss.

### Added

- **Named-channel blocklist.** Specific channels can now be hidden from Home, Browse, Following, and Search through the Content settings. The list is normalized, capped at 200 entries, editable, exportable, and counts toward the fail-open ceiling.
- **The emote library is now a record you can check Kick against.** Each entry keeps a first-seen and last-seen date, and when Kick renames an emote or replaces its artwork the value at first capture is kept and the entry is flagged. Kick changed emotes users had already pulled in July 2026 and answered with "remastered… clear your cache"; a local record is the only version that can show what changed. Entries carried over from the previous schema keep an unknown first-seen date rather than claiming today.
- **The collectible facts Kick leaves unexplained**, each with its basis: the daily streak confers no bonus to drop quality or odds, no drop odds are published anywhere in the responses this build reads, duplicate protection is undocumented, and the collectibles page can disagree with the chat emote set. The duplicate count is measured from your own inventory only when Kick returns a per-item quantity — otherwise it is reported as unavailable rather than shown as zero.
- **Saved layouts are shareable and show who is live.** A layout copies as a kick.com link carrying channel names and nothing else; opening one revalidates every slug through the same rules the grid uses, then strips the parameter so a reload does not silently reopen it. Live status for the grid and every saved layout comes from one bulk request rather than per-channel polling.
- **The badges Kick's own markup omits now render.** Kick's chat payload carries collectible and global badges the legacy array leaves out, so a client reading only the DOM showed a gap. Badges Kick already drew are skipped, and a badge image that fails to load is replaced by its name rather than an empty box.
- **API drift detection.** When a normalizer rejects a payload for a shape reason, the endpoint and reason are recorded, and the About page reports accumulated drift instead of silently falling back.
- **A locked emote now says why it is locked** — subscriber emote, collectible you have not pulled, or a denial Kick gives no reason for — and links to Kick's own unlock path. Nothing is enabled or sent; the link is the only action offered. Entitlement is read across every shape Kick has used, and the default with no signal is unlocked, because the expensive failure is greying out an emote you actually own.

### Changed

- **The realtime transport is now swappable.** Frame parsing and subscription management moved into shared protocol functions and per-provider connection details into a registry, so Kick switching providers is one added entry rather than a rewrite. Kick's own gateway is registered but marked unverified — this project has never contacted it — and a verified provider wins when the broker offers both. An unverified transport that never delivers a frame degrades to reading the page and names itself.
- The README now corrects a widely repeated claim: a cross-origin WebSocket is not blocked by CORS. What can block Kick's gateway from a page context is the server rejecting the origin or its Cloudflare front requiring a token, and which applies remains untested here.
- **Translation is now a single forward lookup.** Every string used to be resolved by scanning all ~250 dictionary entries to map a possibly-already-translated value back to English — ambiguous by construction, since several English sources are also translated values of other strings. The English original is remembered per node instead, so a re-render or a language change translates from the source rather than from what is on screen.
- **Language names are no longer translated.** A picker that renames "Português" to "Portugués" is harder to use, not easier; endonyms now appear the same in every locale.

### Internal

- Tile reuse across multi-stream renders, the single-unmuted-tile rule, and the deletion-annotates-once guard are now covered offline. Replacing an `<iframe>` restarts its stream, so the reuse rule is load-bearing; it was previously asserted only by a headed browser run that `npm run verify` does not execute. The reuse test was verified red against a deliberately broken plan before being trusted.

## 1.7.0 — 2026-08-15

Trust, naming, and diagnostics pass.

### Fixed

- **The Chromium manifest requested "Read your browsing history" for nothing.** `declarativeNetRequestFeedback` is only useful for unpacked installs, which have the API regardless, so the release manifest now omits it. A dev manifest variant is emitted alongside for debugging. The popup already showed a dash when the counter was unavailable.
- **The Firefox manifest requested `<all_urls>` and `tabs` it did not need.** Permissions are now enumerated from the same host lists the page-realm classifier uses, plus kick.com. The `tabs` permission was unused. `data_collection_permissions` is now declared as required by AMO since 2025-11-03.
- **The remote blocklist was fetched from the page realm.** The request is now CORS-free: the companion background fetches it when present, `GM_xmlhttpRequest` when the userscript manager provides it, and the page-realm path remains only as a last resort. The summary states which method was used.

### Added

- **API drift detection.** When a normalizer rejects a payload for a shape reason, the endpoint and reason are recorded. The About page reports accumulated drift rather than silently falling back, following the ad-stack drift report pattern. Covers the channel, emote, and realtime endpoints.
- **Importing a library now names what was dropped.** A sticker import that loses entries states how many and names up to five, rather than reporting a bare count difference.
- The README now states the Firefox channel limitations (Release and Beta cannot install unsigned XPIs persistently) and the Violentmonkey MV3 timing constraint (real `document-start` requires Alternative page mode, off by default).

### Changed

- **User-facing "sticker" vocabulary renamed to "emote"** throughout settings, translations, toasts, announcements, aria-labels, validation messages, and the README. Kick ships no product called a sticker — its API, chat wire format, and picker DOM all say emote. Internal identifiers and storage keys stay unchanged to preserve existing data without a migration.
- Node engine floor updated to 22+ in the README to match `package.json`.

## 1.6.0 — 2026-08-15

Accessibility, data safety, and hardening pass over everything 1.5.0 shipped.

### Fixed

- **The multi-stream grid had no way to stop it.** Nine autoplaying tiles with no pause-all and the focused tile's audio with no mute-all are WCAG 2.2.2 and 1.4.2 failures — on a build that ships an accessibility page and so invites the standard. Both controls now sit before the grid in tab order, and a system request for reduced motion mounts the grid paused with a visible way to start, since `prefers-reduced-motion` is not accepted as a substitute for a real control. No surveyed competitor implements either.
- **Nine tiles at source quality is more than most hardware can decode.** Tiles now unload when scrolled out of the grid or when the tab is hidden, and resume in place; the focused tile is never suspended because it carries the audio. Per-tile quality capping turned out to be impossible — `player.kick.com` is a different origin, so neither its storage nor its player internals are reachable, and the embed accepts no quality parameter.
- **Most of the interface was untranslated and nothing detected it.** 78 rendered strings had no entry in any locale, so `es` and `pt` users read English for the majority of the settings interface. Roughly two thirds predated 1.5.0. The previous gate could not see it, because checking that locales agree with each other stays true when a string is absent from all of them equally.
- **Export omitted two of the stores it promised to keep.** Emote usage counts and multi-stream layouts were listed in the About storage table but absent from the backup that page tells users to take. Both now round-trip, and import validates and reports them like everything else.
- **Realtime frames were parsed without bounds.** The chat subscription is anonymous and public, so a frame is untrusted input by construction. Content and ids are now truncated, badge and rule arrays capped, sender colours accepted only as hex colours, and badge images only as https URLs on Kick hosts.
- **Only the settings modal contained focus**, so keyboard users tabbed out of the command menu and the multi-stream grid onto a page they could not see — and in the grid the next stops are cross-origin frames that cannot be focus-managed at all.
- Player embeds no longer request `encrypted-media`; Kick playback is Amazon IVS HLS with no DRM.

### Added

- **The two limitations users would otherwise hit blind are now stated.** Multi-stream chat is read-only because Kick's popout chat refuses to send from inside an iframe by design; and if Kick sign-in, sign-up, or Follow stops working, the cause is an ad-blocker filter list rather than this extension — Kick Focus blocks eleven third-party hosts and no kick.com host at all.
- A translation-coverage gate that fails when any rendered string has no dictionary entry, verified red before being trusted.
- The live harness now explains itself when run on a binary that cannot load extensions: Chrome 139 removed the flags it depends on from official builds.

### Changed

- Emote-usage counting moved from `src/api.mjs` to `src/core.mjs`. `core` owns the settings schema and the normalizers guarding import boundaries; `api` owns Kick's endpoints, and usage counts are local storage rather than a Kick surface.

## 1.5.0 — 2026-08-15

Settings schema 3. Existing preferences migrate without loss.

### Fixed

- **The Firefox companion blocked nothing.** Its request listener gated on `details.initiator`, which only Chromium populates, so `new URL(undefined)` threw and every request short-circuited to "allow" while the popup reported active rulesets. It now reads Gecko's `originUrl`/`documentUrl` with `initiator` kept as a Chromium fallback. `blob:` and `filesystem:` URLs carry their origin in the path rather than the hostname, so the player's worker requests were escaping the filter regardless.
- **The build gate asserted the defective field name**, so it passed because of that bug and would have failed on the fix. Replaced with a behavioural test that runs the built background against a stubbed browser API using Firefox-shaped request details.
- **`src/api.mjs` was never in the shipped bundle.** The build computed it and then omitted it from the concatenation, so every live feature would have thrown `ReferenceError` on first use. A new gate requires every module export to be *defined* in all three bundles, derives the symbol list from each module's own exports, and was verified red against a deliberately re-broken build.
- **Failed storage writes lost data silently.** Twelve of thirteen persistence call sites discarded the result, so a full or denied storage backend dropped the emote library, channel notes, keyword filters, and layout memory with no message. Failures now raise a warning that stays until acknowledged, and About reports what each payload costs.
- **Volume memory eventually locked streams silent.** Autoplay policy sets `muted = true` immediately after attach, and the resulting event persisted "muted" for that channel forever. A grace window discards mute-only changes, and a timer reconciles against the live element for players that route audio through a gain node and never fire the event.
- **Quality memory was very likely inert**, driving a menu with plain clicks on selectors that appear nowhere in this project's verified DOM contract. Kick's player reads `stream_quality` from session storage once at init, so that is now written during bootstrap, with the menu kept as a fallback.
- Windows High Contrast had no visible focus indicator on text inputs or the command search, because `forced-colors` suppresses `box-shadow`. A WCAG 2.4.7 failure on a build that ships an accessibility page.
- Imported settings containing `__proto__`, `constructor`, or `toString` were treated as recognised and went unreported, because `in` walks the prototype chain.
- A duplicate `es` dictionary key was silently discarding a translation, and `pt` was missing a string. A new gate parses the source rather than importing it, because a duplicate key is legal JavaScript and the evaluated object cannot show what was overwritten.

### Added

- **Kick's own API, read instead of scraped.** A new module covering the realtime broker, emote catalog, chat events, and collectibles — read-only, same-origin, using the session the page already has. Every normaliser reports a changed shape rather than throwing, and every path falls back to the existing DOM scraping.
  - The emote catalog loads without the picker ever being opened, carrying real entitlement rather than a `disabled` attribute.
  - Chat events come from whichever realtime provider Kick's broker names, so no key is written in this source and a provider switch degrades instead of breaking.
  - **Removed messages now say why they were removed.** The page discards that; the realtime event carries it.
  - **Emote usage is counted** per channel and globally. Kick's own "Frequently Used" hardcodes its counter and ranks nothing.
  - **Collectible rarity is resolved.** Kick publishes rarity on card art and identity in the picker with no key joining them, so the join is evidence-scored and stays silent below a confidence floor — a mislabelled Mythic is worse than no label.
  - Wide collectibles render at their measured aspect instead of squashed square.
  - Shadowed emote names are reported with the set Kick will actually send.
- **Multi-stream.** Up to nine channels in one grid, built on Kick's own embedded player and popout chat so playback, subscriptions, and entitlements are unchanged. Audio and chat follow the focused tile, layouts save by name, and closing the grid stops every player.
- **Playback no longer waits on blocked ad preflight scripts.** Kick waits on Google PAL, Datazoom, and OM before requesting playback; blocking them — which this build does — left the dead script in the page and the player sat out the full timeout.
- **Dropdown sidebar mode**, collapsing the discovery rail to a tab that expands on hover or keyboard focus.
- Animated emotes and collectibles can be frozen to a static frame, honoured automatically under reduced motion.
- The page-realm hooks no longer identify themselves through `name` or `toString`.

### Credits

- The preflight approach is adapted from [KickCX/KickFixPlayerLoading](https://github.com/KickCX/KickFixPlayerLoading) (MIT).
- The dropdown sidebar concept comes from the "KICK Dropdown" userstyle by IamKoeda ([userstyles.world/style/29036](https://userstyles.world/style/29036), MIT), rebuilt here on this project's own tokens.

## 1.4.0 — 2026-08-15

### Fixed

- Removing or pinning a sticker now preserves the grouped shelf's nested scroll position instead of jumping back to the first row.
- Following and Drops URLs now resolve to their own route kinds instead of silently receiving channel-only behavior.
- Premium site styling now targets Kick's current semantic `<main>` shell and stable card, player, chat, and navigation markers rather than depending on the retired `#main-container` wrapper.
- Clearing the search summary no longer restores the old query from the URL while the live search input is empty.
- Explicit pointer or keyboard playback on a Home preview is no longer immediately paused by the autoplay guard; background autoplay remains silent and paused.
- Live visual verification now applies an exact CSS viewport before measuring or capturing; the old `--window-size`-only path mislabeled browser outer-window dimensions as 1440×900/1920×1080 viewports.

### Added

- A compact three-row Quick favorites shelf for keeping substantially more one-click chat stickers visible at once.
- Chat sticker organization with a local grouped shelf, pinned favorites, removable stickers, search-aware views, native-group fallback, and independent reset controls.
- A persistent sticker library continuously merges every enabled or locked sticker Kick exposes, records native groups, supports custom group assignment in settings, and round-trips the complete catalog and configuration through JSON export/import.
- Seven ImageGen-led Kick-site references for Home, Browse, Following, Drops, Category, Search, and Channel/chat, saved in `design/mockups/` and implemented as one graphite, charcoal, and Kick-lime desktop system.
- Route-specific Search context and a useful Drops empty state with direct, non-mutating navigation to eligible streams, upcoming campaigns, and reward activity.
- The live extension gate now asserts that known ad creatives and empty ad shells are absent from the settled Kick DOM in addition to proving browser-level request blocking.

### Changed

- Enlarged the organized sticker shelf, excluded Kick-disabled subscriber stickers from its usable catalog, and kept locked stickers visible in the native groups for clarity.
- Reimagined all five settings pages with a premium matte shell, clearer page hierarchy, responsive navigation, an embedded live appearance preview, and browser-backed visual parity checks.
- Restyled the current Kick desktop shell, nav search, sidebar states, stream cards, route tabs, player/chat frame, and sticker picker with denser geometry and stronger hierarchy at 1440×900 and 1920×1080.
- The default sidebar mode is Auto and the default chat width is 410 px; schema-1 settings migrate without overwriting explicit custom values.
- Sticker catalog rescans are now mutation-driven instead of repeating on every chat apply cycle, reducing work on high-volume channels.

### Security

- Subscriber-only stickers are cataloged for organization and export but stay unavailable unless Kick marks them enabled. Copying a sticker name is not treated as an entitlement bypass.

## 1.3.0 — 2026-08-14

### Added

- Ordered shell locator probes now prefer Kick's ids and data markers, fall back through structural and accessible anchors, and expose a visible compatibility self-test on the About page.
- Committed lightweight Home, Browse, Category, Search, Channel, and localized chat fixtures with build-gating shape tests, without adding the large MHTML captures to history.
- Viewer controls now remember volume, mute state, quality, and finite VOD position locally with independent privacy toggles, and add favorite, not-interested, search-count, rail, and mini-player collision controls.
- Chat and playback utilities now include sticky pause with full `aria-live` recovery, local per-channel keyword highlights and notes, opt-in diagnostics, and independently toggleable player resize/ultrawide recovery.
- Optional data-only blocklist subscriptions accept only validated HTTPS JSON channels, categories, and keywords, with cached payload recovery and complete removal.
- Firefox now has an unsigned Manifest V2 companion package with a local page-world bridge and Kick-scoped `webRequest` blocking that mirrors the Chromium companion.
- Settings and the command menu support browser-language auto detection plus English, Spanish, and Portuguese selections.
- The release checklist repeats live proof at 1440×900 and 1920×1080 and captures screenshots for visual comparison after Kick deployments.

### Changed

- Added a panic switch that tears down Kick Focus styles, page markers, observers, request hooks, and overlays without a reload, then restores the enhanced page on demand.
- The README now distinguishes the default no-remote-code posture from the explicit, user-supplied data-only blocklist opt-in.

### Known limitations

- Browser-manager cold-start timing, authenticated surfaces, Safari, worker-only delivery, and server-side stitched ads remain unverified. The Firefox companion is package- and handshake-tested but still needs a live Firefox profile for end-to-end verification.

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
