# Kick Focus

[![Version](https://img.shields.io/badge/version-1.11.0-53fc18?style=flat-square)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-desktop%20Chromium%20%7C%20Firefox-171a1c?style=flat-square)](#desktop-support)
[![Dependencies](https://img.shields.io/badge/dependencies-none-9fa6ad?style=flat-square)](package.json)

Kick Focus is a desktop-only userscript that gives [Kick](https://kick.com/) a calmer, more premium, and more controllable layout. It adds a consistent graphite-and-lime site shell, focus and theater modes, compact discovery, a complete settings center, accessibility controls, content filters, and a best-effort document-start ad defense without shipping remote code.

An optional Manifest V3 companion extension adds the one thing a userscript on Chromium can no longer do for itself: blocking ad requests at the browser network layer, before they are sent.

![Kick Focus premium Home direction](design/mockups/kick-home-premium.png)

## What it changes

- Restyles Kick's current semantic desktop shell, navigation, discovery rail, content cards, player, chat, tabs, search results, and empty states with one restrained premium design system.
- Reclaims the permanent discovery rail with Auto, Compact, Dropdown, and Hidden modes; Auto is the default so the live site can choose the appropriate desktop width. Dropdown collapses the rail to a tab that expands on hover or keyboard focus.
- Adds Standard, Theater, and Focus stream layouts, plus Right, Docked, and Hidden chat.
- Widens browse grids and preserves a compact, sticky desktop top bar. Following and Drops are classified as first-class routes instead of being mistaken for channels.
- Adds a searchable command menu (`Ctrl+K`) and configurable keyboard shortcuts.
- Adds Studio, OLED, and Slate surfaces, four accent choices, density, radius, thumbnail, contrast, and text controls.
- Keeps home-page previews silent, blurs marked mature cards, and can filter casino, Drops, sponsored, and promoted content using Kick's own category and badge markup. Filtering suspends itself and says so rather than emptying a page.
- Remembers volume, mute state, quality, and finite VOD position locally with separate privacy toggles; adds favorite and not-interested card actions, configurable Following/Recommended rails, an accessible search summary and clear action, useful Drops-empty guidance, and mini-player collision recovery.
- Adds sticky chat pause with an accessible resume state, per-channel keyword highlights and private notes, optional playback diagnostics, and a panic switch that restores Kick's native page without a reload.
- Continuously records emotes seen in live chat and every emote Kick exposes in the open picker, including locked metadata, with a larger three-row one-click favorites shelf, scroll-stable removals, portable favorites/removals, custom groups, and full JSON export/import from settings. Chat-only discoveries remain availability-unknown, and locked subscriber emotes are never sent without Kick authorization.
- Clears the ad flags out of Kick's `/playback` response before the player reads them, so the ad SDKs are never started, and blocks known ad and optional telemetry requests through early page-realm `fetch`, XHR, beacon, and dynamic-element hooks. A persistent observer removes ad scripts, frames, and containers after reinsertion, and the Content & Ads page warns if Kick's ad stack stops matching what this build knows.
- **Reads Kick's own API instead of scraping the page for it**, read-only and same-origin using the session you are already signed into. The emote catalog loads with real entitlement without the picker being opened; chat events come from whichever realtime provider Kick's own broker names; removed messages say why they were removed, which the page itself discards; emote usage is counted per channel and globally, which Kick does not do at all; collectible rarity is resolved and shown only where the match is confident; wide collectibles render un-squashed; and emote names shadowed across your sets are reported. Every one of these degrades to the previous DOM behaviour if the response changes shape, and each has its own switch.
- **Multi-stream**: up to nine channels in one grid, built on Kick's own embedded player and popout chat, with audio and chat following the focused tile and named layouts you can save. Reachable from the header control, the command menu, or settings.
- **Starts playback without waiting for blocked ad preflight scripts.** Kick waits on Google PAL, Datazoom, and OM before requesting playback, so blocking them — which this build does — otherwise leaves the player sitting out the full timeout.
- Can freeze animated emotes and collectibles to a static frame, applied automatically when your system asks for reduced motion.
- Stores settings and the recorded emote library locally in the userscript manager. There is no analytics, network update code, `@require`, or remote executable code. An optional, off-by-default subscription accepts only user-supplied JSON data containing channels, categories, and keywords.

## Install

1. Install a current desktop userscript manager such as Tampermonkey or Violentmonkey.
2. Open `dist/kick-focus.user.js` in the manager, or create a new userscript and paste that file into the editor.
3. Save it, ensure it is enabled for `https://kick.com/*`, and reload Kick.
4. Use the **Focus** button, press `Ctrl+K`, or choose **Open Kick Focus settings** from the manager menu.

The script is not published or auto-updated. `dist/kick-focus.user.js` is the canonical install artifact in this repository.

On Chromium 138 and later, a userscript manager also needs its **Allow user scripts** toggle enabled on its own entry in `chrome://extensions`. Without it the manager silently runs nothing.

## Install the companion extension (optional)

The companion is unsigned and installs unpacked. It is not published to any store.

1. Run `npm run build` to produce `dist/extension/`.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist/extension/`.
3. Reload Kick. The Content & Ads settings page now reports **Network + page** instead of **Page only**.

`dist/kick-focus-extension-v<version>.zip` is the same package for sharing or for browsers that accept a zip.

### Firefox companion

The build also emits `dist/extension-firefox/` and `dist/kick-focus-firefox-v<version>.zip`. Firefox users can open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/extension-firefox/manifest.json`. This unsigned Manifest V2 package injects the same page bundle through a local web-accessible bridge and blocks the same Kick-initiated hosts.

**Firefox channel limitations:** Temporary add-ons loaded through `about:debugging` are removed on restart. Firefox Release and Beta cannot install unsigned XPIs persistently at all. For a persistent unsigned install, use Firefox Developer Edition, Nightly, or ESR with `xpinstall.signatures.required` set to `false` in `about:config`. This is a Mozilla policy, not a limitation of this project.

![Kick Focus companion popup](design/screenshots/extension-popup.png)

The companion is self-contained: it carries the same page-world script as the userscript, so **install one or the other, not both**. If both are present the first to run claims the page and the second stands down, but only the extension gives you the network layer.

| | Userscript | Companion extension |
| --- | --- | --- |
| Layout, settings, filters, accessibility | Yes | Yes |
| Page-realm ad interception | Yes | Yes |
| Ad requests blocked before they are sent | No | Yes (`declarativeNetRequest`) |
| Guaranteed `document-start` timing | Manager-dependent | Yes |
| Install effort | Paste one file | Load unpacked, survives as a folder |

Every network rule is scoped to `kick.com` initiators, so the companion never changes how any other site loads. The Chromium package requests no host permissions beyond Kick; the Firefox package needs its `webRequest` permission to provide the equivalent blocking layer and still filters by Kick initiator. Both packages contain no remote code.

## Default shortcuts

| Action | Shortcut |
| --- | --- |
| Command menu | `Ctrl+K` |
| Focus mode | `F` |
| Toggle chat | `C` |
| Toggle sidebar | `S` |
| Settings | `Alt+K` |
| Reveal mature thumbnails | `B` |

Plain-letter shortcuts do not fire while typing in an input, textarea, select, or editable chat surface. Conflicting custom shortcuts are rejected with an inline recovery state.

## Ad-defense boundary

Kick Focus is deliberately honest about the userscript boundary:

- `@run-at document-start` starts as early as a userscript manager supports, but another page script can still run first.
- On Chromium Manifest V3, current Tampermonkey versions no longer expose the experimental pre-script `@webRequest` path, and `chrome.userScripts` injection can land after the page's own first scripts. The page-realm hooks are written to be idempotent so they still install when they lose that race.
- **Violentmonkey 2.47.0+** (the first MV3 release, 2026-08-06) does not provide real `document-start` injection under MV3 Chromium unless **Alternative page mode** is enabled in its extension settings. That mode is off by default and limited to approximately 1 MB of injected script. The About page measures actual injection timing and reports it.
- The userscript alone therefore blocks requests it can separate in the page realm and continuously removes ad DOM. It does not claim browser-network control over parser requests that occur first, worker-only requests, or server-side stitched media.
- **The companion extension closes the network gap.** Its `declarativeNetRequest` ruleset refuses the known ad hosts in the browser network stack, which was verified by observing `ERR_BLOCKED_BY_CLIENT` on a Kick-initiated request to `securepubads.g.doubleclick.net` (`npm run verify:extension`).
- **Ads are disabled at their source in the playback response.** Kick gates client-side ad behaviour on flags it sends with each stream; those are rewritten in flight, so the ad SDKs never initialise.
- **Server-side stitched ads remain unverified and out of the current page-layer reach.** Measured on 2026-08-14: the HLS manifest is fetched inside the IVS WASM worker and never appears in page-realm traffic, so the existing page interceptor cannot inspect it. Safe worker-level instrumentation remains in [ROADMAP.md](ROADMAP.md); this project does not claim to remove media bytes it cannot observe.

- **The Firefox companion really does block, as of 1.5.0.** Before that its listener gated on a Chromium-only field, so it cancelled nothing while reporting active rulesets.

This boundary is reflected directly in the Content & Ads settings page and protection log, which report `Network + page` or `Page only` depending on what is actually installed.

## Known limitations

- **Multi-stream chat is read-only.** Kick's popout chat refuses to send from inside an iframe — it answers with a CSRF error by design ([KickDevDocs #262](https://github.com/KickEngineering/KickDevDocs/issues/262)). The grid says so in the panel rather than letting you find out by typing. Kick Focus deliberately does not work around this: it would mean writing to Kick, and this project commits to read-only access below.
- **If Kick sign-in, sign-up, or Follow stops working, check your ad blocker, not this extension.** Since Kick began serving ads on 2026-08-06, ad-blocker filter lists have been reported to break those actions until the blocker is disabled and the browser restarted. Kick Focus blocks eleven third-party ad and telemetry hosts and **no kick.com host at all**, so pausing it will not change that behaviour.

## What this project reads from Kick

Since 1.5.0 Kick Focus calls Kick's own endpoints rather than only scraping the rendered page. The rules it holds to:

- **Read-only.** No endpoint it calls changes anything on Kick.
- **Same-origin, with your own session.** Requests inherit the cookies the page already has. Nothing handles, stores, or transmits a credential, and nothing is sent anywhere but Kick.
- **Only what Kick's own client already calls.** No private or undocumented write paths, no automation, and nothing that bypasses an entitlement.
- **Local only.** Emote usage counts, the library, and multi-stream layouts stay on your machine and travel only through the existing JSON export.
- **Fails back, never fails open.** Every response is validated; an unexpected shape falls back to the DOM path and says so in diagnostics rather than showing an empty surface as success.

Multi-stream embeds Kick's own player and popout chat, so playback, subscriptions, and entitlements remain entirely Kick's.

### Realtime transport

Chat events arrive over whichever realtime provider Kick's own broker names, so no connection key is written in this source. Two providers are registered: the hosted **Pusher** path, which this project has run against, and **Kick's own gateway** (`websockets.kick.com`), which it has not. They share one wire protocol — the same subscribe frames and event payloads — so only the handshake differs, and adding a third is one registry entry rather than a rewrite.

When the broker offers both, the verified one is used. If it ever offers only the gateway, Kick Focus attempts it and reports the transport as unverified; if that connection fails it degrades to reading the page and says so rather than retrying a path it cannot vouch for.

One caveat worth stating plainly, because it is widely reported the other way round: **a cross-origin WebSocket is not blocked by CORS.** The handshake carries an `Origin` header and the server decides; there is no preflight and no `Access-Control-Allow-Origin` requirement. What can actually block the gateway from a page context is the server rejecting the origin, or its Cloudflare front requiring a token the page has not been issued. Which of those applies is untested here, so the userscript build's ability to follow a forced migration remains unproven.

## Credits

- The blocked-preflight fix is adapted from [KickCX/KickFixPlayerLoading](https://github.com/KickCX/KickFixPlayerLoading) (MIT).
- The dropdown sidebar concept comes from the "KICK Dropdown" userstyle by IamKoeda ([userstyles.world/style/29036](https://userstyles.world/style/29036), MIT), rebuilt here on this project's own design tokens.

## Desktop support

- Primary verified viewport: 1440×900
- Secondary verified viewport: 1920×1080
- Authenticated recon routes: Home, Browse, Categories, Category, Following, Drops, Search, and Channel/chat, including the open native emote picker (2026-08-14)
- Isolated companion proof: Chromium 151, logged out, headed and off-screen — 22/22 live checks pass at 1440×900, repeated at 1920×1080 by `release:check` (2026-08-16)
- Mobile is intentionally out of scope.

Kick changes frequently. The most brittle hooks are the sidebar and chat selectors documented in [RESEARCH.md](RESEARCH.md). If the player or chat fails, disable Kick Focus first; Kick’s own help center notes that ad/privacy/script blockers can interfere with playback and chat.

## What it cannot do

- **It cannot remove Kick's in-stream video ads.** Kick serves those through server-side ad insertion (SSAI): they are stitched into the video manifest itself, parsed inside an opaque Amazon IVS WASM worker the page world cannot reach, and the ad opt-out lives in a server-signed playback token. Kick Focus blocks the *separable* ad stack (display and tracking hosts) at the network and page layers and never touches playback. A subscription is the only path Kick offers to change in-stream ads, and even that does not remove them.
- **Installation is manual and unsigned.** Chromium rejects self-hosted `.crx` files on Windows and macOS, so the companion loads via Developer Mode → Load unpacked. The userscript is the artifact that actually reaches most people; install it in Tampermonkey or Violentmonkey. On Chromium a userscript manager needs its own "Allow user scripts" toggle (Chrome 138+), and Violentmonkey's true document-start injection needs its "Alternative page mode" enabled. The Firefox package is unsigned: it runs temporarily via `about:debugging`, or permanently only on Nightly/DevEdition/ESR with signature enforcement off.
- **It reads Kick; it never acts for you.** No automation, no writes, no entitlement changes. Every API surface it reads is one Kick's own client already calls, inheriting your existing session, and every feature degrades to reading the page when it fails.

## Build and verify

No runtime or development dependencies are required beyond Node.js 22+.

```powershell
npm run build              # userscript + dist/extension/ + shareable zip
npm run verify             # offline: artifact checks + core tests
npm run verify:extension   # live: loads the extension in Chromium against Kick
npm run release:check      # offline gate + live 1440×900 and 1920×1080 checks
```

The build concatenates the metadata block, tested pure core, and runtime into `dist/kick-focus.user.js`, then emits the same page-world bundle into both companion packages. The extension network rules are generated from the same host lists the page-realm classifier uses, so the layers cannot drift apart; `npm run verify` fails if they do.

`npm run verify:extension` opens a throwaway Chromium profile, loads the unpacked extension, visits Kick, and asserts that the service worker is running, the rulesets match the manifest's promises, the page world booted and sees the companion, cards are detected, an ad-host request is refused by the network stack, and the popup renders. It needs a Chromium binary — Google Chrome stable will not work, because it ignores `--load-extension` without reporting an error. It finds Playwright's Chromium automatically, or set `CHROME_PATH`.

It runs **headed**, because Kick answers headless browsers with a short JSON error instead of the site; DOM checks are skipped rather than reported as passing when the real page was not reached. `KF_WINDOW_POSITION=x,y` places the outer window, `KF_WINDOW_SIZE=1440,900` applies and asserts the exact CSS viewport at DPR 1, and `KF_HEADLESS=1` restricts the run to the network checks that do not depend on page content.

`npm run release:check` repeats the live proof at both supported desktop sizes and captures `kick-focus-1440x900.png` and `kick-focus-1920x1080.png` in a temporary directory (or `KF_RELEASE_SCREENSHOT_DIR`). Compare those captures with the current design references after each Kick deployment, checking shell geometry, overflow, clipped controls, and player/chat collisions. The command remains useful without Chromium: the offline gate still runs and the live portion reports `SKIP`.

## Repository map

```text
design/mockups/       Selected ImageGen references for Kick routes and settings pages
design/screenshots/   Captured UI, re-taken when the interface changes
dist/                 Installable userscript, unpacked extension, and zip
scripts/              Deterministic build, artifact checks, live proof, release gate
src/core.mjs          Settings, routing, blocklist, storage registry, and validation logic
src/api.mjs           Kick API endpoint shapes, emote/catalog parsing, chat frame normalization
src/compatibility.mjs Shell/selector probes that detect Kick DOM drift
src/runtime.js        Live DOM, layout, settings UI, commands, emote library, and request hooks
src/extension/        Chromium/Firefox manifests, bridges, service workers, popup
test/                 Node test suite (offline gate + vm boot/companion gates)
```

The build concatenates `core.mjs` → `api.mjs` → `compatibility.mjs` → `runtime.js` into one IIFE, in that order.

See [RESEARCH.md](RESEARCH.md) for the dated audit and evidence, [ROADMAP.md](ROADMAP.md) for prioritized follow-up work, and [CHANGELOG.md](CHANGELOG.md) for release history.

Kick Focus is an independent project and is not affiliated with or endorsed by Kick Streaming.
