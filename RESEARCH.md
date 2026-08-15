# Research — Kick Focus

Date: 2026-08-15 — replaces all prior research.

Scope note: a verification-focused pass was written earlier the same day (2026-08-15 00:14). Its verified DOM/route/ad-surface evidence is carried forward below rather than re-derived; this pass adds the competitive, platform, security, and community research that document did not cover, plus a fresh source audit. Repo state at time of writing: v1.4.0, `main`, **no git remote**, working tree **dirty** with coherent in-progress sticker work (schema 2→3, chat-sticker discovery, header quick control) and all gates green (36 tests).

## Executive Summary

Kick Focus is a dependency-free, desktop-only Kick.com client mod shipping three artifacts from one source: a userscript, a Chromium MV3 companion (`declarativeNetRequest`), and a Firefox MV2 companion (`webRequestBlocking`). Its strongest shape is now unusually clear: it is the only project in the Twitch+Kick field that combines route-aware layout, structured-evidence content filtering, playback-level ad neutralization, and a **persistent, exportable emote/sticker library** — and that last capability is, as far as this sweep can establish, unique in the entire field (BetterTTV cannot export by construction, 7TV closed the request). That differentiator arrives at the exact moment 7TV went effectively closed-source and began requesting broad "browsing activity" permissions, which users are publicly refusing. A dependency-free, MIT, no-network, no-analytics mod is the direct counter-position.

The highest-value direction is therefore **not** more features — it is making the three shipped artifacts honest. Two of them currently claim protection they do not deliver.

Top opportunities in priority order:

1. **The Firefox companion blocks nothing.** It gates on `details.initiator`, a Chromium-only field; Firefox provides `originUrl`/`documentUrl`. Every request short-circuits to "allow" while the popup reports active rulesets. *Verified.*
2. **A build gate enforces that bug.** `scripts/check.mjs:112` asserts the source contains `kickInitiator(details.initiator)` — a correct fix fails the gate. *Verified.*
3. **12 of 13 `gmSet` callers ignore failure**, so the sticker library, groups, favorites, notes, and blocklist cache are lost silently when storage is full or denied. *Verified.*
4. **Volume memory poisons itself to muted.** `volumechange` binds with no grace window; autoplay policy forces `muted=true` immediately after attach and that value is persisted per channel. *Verified in code; the failure mode is documented by `kick-stream-tweaks`.*
5. **Quality memory is very likely inert.** It drives a menu with plain `.click()` on selectors that appear nowhere in the project's own verified DOM contract. Two independent sources say Kick reads quality from `sessionStorage` at player init and ignores synthetic plain clicks. *Needs live validation.*
6. **Windows High Contrast has no visible focus on inputs** — `outline: 0` plus a `box-shadow` ring, which `forced-colors` suppresses. *Verified.*
7. **Ship-blocking manifest hygiene**: `declarativeNetRequestFeedback` is unpacked-only yet costs a "read your browsing history" warning; Firefox requests `<all_urls>` and `tabs` it does not need; `engines.node >= 20` endorses a runtime that reached EOL 2026-04-30 with unpatched HIGH CVEs. *Verified.*
8. **Kick's collectibles surface is new, churning, and unserved.** Daily Rewards launched 2026-07-01 (244 items); Kick retroactively mutates emotes users already pulled and the inventory desyncs from chat. A local timestamped snapshot is the only record a user can trust — and this project already owns the persistence layer for it.
9. **Freezing animated emotes** is an explicit, unanswered accessibility request framed as seizure risk, with zero competitors.
10. **The telemetry strategy contradicts itself across layers** — the page realm resolves an empty 200 (storm-safe), while the companion hard-cancels the same host at the network layer, which is the behaviour the community reports as ineffective and CPU-costly.

## Product Map

**Core workflows**
- Watch with a route-aware premium shell: Home, Browse, Categories, Category, Following, Drops, Search, Channel/chat — each with first-class layout rather than a channel fallback.
- Organize the native sticker picker into groups, favorites, and a three-row quick shelf; persist and export/import the whole library.
- Filter discovery by structured evidence (category slug + short badge leaves), with a 25% fail-open ceiling that yields on category routes.
- Suppress ads and optional telemetry across three layers: playback-response rewrite, page-realm request hooks, and browser-level rules from the companion.

**User personas**
- Desktop viewer at 1440–1920 who finds Kick's shell wasteful and its new ads intolerable.
- Collector engaging daily with Daily Rewards, whose inventory Kick mutates under them.
- Privacy-minded user actively fleeing extensions that ask for broad permissions.
- Accessibility-sensitive viewer needing motion, contrast, target-size, and text controls.

**Platforms and distribution**
- Userscript (Tampermonkey 5.5.0 / Violentmonkey 2.47.0 / ScriptCat), Chromium MV3 unpacked + zip, Firefox MV2 unpacked + zip. All unsigned by policy.
- **Firefox distribution is materially constrained**: Release and Beta cannot install unsigned XPIs at all. Only `about:debugging` (wiped on restart) or Developer Edition/Nightly/ESR with `xpinstall.signatures.required=false`. AMO unlisted signing is the only permanent Release path and the no-signing policy excludes it.

**Key integrations and data flows**
- Settings and library live in userscript-manager storage, falling back to page-readable `localStorage`; the companion mirrors settings into `chrome.storage` and receives them as a JSON string over a request/response handshake.
- Network rules are generated at build time from `AD_HOSTS`/`TELEMETRY_HOSTS` in `src/core.mjs`, so page and network layers cannot drift; `npm run check` gates the parity.

## Competitive Landscape

**7TV Extension** — the adjacent benchmark for emote menus (provider tabs, favorites, configurable default tab, cross-set search). *Learn:* durable local organization and a Favorites tab that survives set reloads. *Avoid:* its current trajectory is the single best positioning gift available — the extension went effectively closed-source (GitHub releases stop at v3.1.6 while AMO ships v3.1.22) and now requests broad browsing-activity permissions, which users are publicly refusing. Its usage map is declared but dead (`serialize: false`), and import/export was closed unimplemented.

**NipahTV** — the best data model in the field: Dexie compound keys `[platformId+channelId+emoteHid]` with an `orderIndex` for manual ordering and an embedded emote snapshot so a favorite survives its set unloading; usage counts are per channel; writes batch through a pending-changes map. *Learn:* the compound key, the snapshot, and batched writes. *Avoid:* nothing structural; it ships no releases.

**FrankerFaceZ** — the canonical locked-emote implementation: locked emotes are not clickable, render a lock icon plus a per-kind *reason* ("Follow to unlock"), are excluded from search results, and offer a subscribe link that converts the dead tile into a legitimate path. *Learn:* the reason string and unlock affordance. *Avoid:* nothing; its open requests (custom sort #971 since 2021, frequently-used #1640) are opportunities.

**BetterTTV** — frequently-used and per-channel sets. *Learn:* per-channel frequency. *Avoid:* its export limitation is instructive — the maintainer states the emote menu is a separate embedded project, so settings export is structurally impossible (#3660). This is precisely the constraint Kick Focus does not have.

**KickTalk** — the Kick-native entitlement precedent, matching this project's model exactly: `__allowUse: !emote?.subscribers_only || allowSubscriberEmotes`, rendering sub-only emotes without enabling them. *Learn:* its subscription normalizer handles ~6 different response shapes because Kick's API is inconsistent; a single-shape check produces false negatives. The documented real-world bug class across clients is blocking emotes the user *does* own (frosty #514, Chatterino #7027/#7133) — not the reverse.

**OverKick** — the strongest Kick player technique found: it pins quality by hooking `Storage.prototype` scoped to `sessionStorage['stream_quality']`, so the player *initializes* at the right quality with no menu interaction, immune to ad-break resets. It also defeats tab-blur downscaling by overriding `visibilityState`, while carefully caching the real getter and never auto-resuming a user-initiated pause. *Learn:* both techniques. *Avoid:* its `document.querySelector('video')` trap — hover-preview thumbnails are `<video>` elements too.

**kick-stream-tweaks** — documents the friction of the menu-driving approach this project currently uses: Kick's menu ignores plain `.click()` and needs a full `PointerEvent` sequence; quality items are `[role="menuitemradio"]`; and it carries a `VOLUME_GRACE_MS` constant specifically because autoplay-policy muting otherwise persists "muted" forever. *Learn:* the grace window, urgently.

**uKick** — the only other remote-blocklist implementation. *Learn:* it requests host permission per subscription origin at add time rather than holding broad access. *Avoid:* its validation is literally `Array.isArray(data)` — no schema, no caps, no versioning, no backoff, failures collapse to a boolean. Kick Focus's validator is already far stronger; do not regress toward this.

**uBlock Origin / AdGuard list conventions** — the actual standard to follow if the subscription format is extended: a metadata header parsed from the first 1024 bytes (`! Title:`, `! Expires:`, `! Last-Modified:`), a publisher-declared `Expires` the client clamps, and `Diff-Path` + `Diff-Expires` for differential updates validated by digest. Interop lesson: emit both diff keys or clients silently fall back.

**Kick Augmenter** (closed, the perceived feature leader) — ships **no emote or sticker features at all** (v0.0.21, 2026-08-04). *Learn:* its VOD-resume UX bar is a seekbar marker with hover timestamp preview. *Avoid:* nothing to fear here; the sticker space is open.

**KickAlert** — direct Following-page competitor using the same "MIT, zero dependencies" positioning, with channel groups and favorites. *Learn:* the positioning is not unique; the sticker library is what differentiates.

## Security, Privacy, and Reliability

**Defects found (all with file paths)**

- `src/extension/background.firefox.js:38` — `if (!kickInitiator(details.initiator)) return undefined;`. Firefox does not populate `initiator` (MDN documents `originUrl`/`documentUrl`); `new URL(undefined)` throws, the `catch` returns `false`, and **every request is allowed**. The popup meanwhile reports `rulesets: ['ads','telemetry']` and `countsAvailable: true` (`background.firefox.js:58-66`), so the UI asserts protection that does not exist. Second-order trap: `new URL('blob:https://kick.com/…').hostname === ''`, so a naive `originUrl` fix still misses worker/blob-originated requests. *Verified: code + MDN.*
- `scripts/check.mjs:112` — the gate asserts `firefoxBackground.includes('kickInitiator(details.initiator)')`, so it passes *because* of the bug and fails on a correct fix. Same family as the project's own documented "checks that always pass" trap. *Verified.*
- `src/runtime.js` — 12 of 13 `gmSet(...)` call sites discard the boolean result; only `saveSettings` (`:179`) checks it. The sticker library (up to 2,400 records), groups, assignments, favorites, per-channel layouts, watched set, notes, media preferences, and the remote-blocklist cache therefore fail **silently** on quota or denied storage. There is no `QuotaExceededError` handling anywhere in the tree. *Verified.*
- `src/runtime.js:1645` — `video.addEventListener('volumechange', saveVolume)` with no grace window. Autoplay policy sets `muted = true` shortly after attach, firing `volumechange`, which persists `{muted:true}` for that path; `restore()` then re-applies it on every later visit. *Verified in code; failure mode documented externally.*
- `src/runtime.js:1655-1676` (`applyQualityMemory`) — restores by calling `control.click()` on `[data-quality], [data-resolution], [data-testid*="quality" i], [aria-label*="quality" i]`. None of these appear in the project's own verified DOM-contract table, Kick's menu is reported to ignore plain synthetic clicks, and a menu item cannot be clicked while the menu is closed. *Needs live validation — but treat as inert until proven.*
- `src/core.mjs:747` — `if (!(key in value[section]))` walks the prototype chain, so an imported `__proto__`/`constructor`/`toString` key is silently treated as known instead of reported. `normalizeSettings` still rebuilds from defaults, so this is a reporting gap, not pollution. Use `Object.hasOwn`. *Verified.*
- `src/runtime.js:399` — `pageWindow.fetch = function kickFocusFetch(...)` leaves `window.fetch.name === 'kickFocusFetch'` and a non-native `toString()`, making the hook trivially fingerprintable now that Kick has a commercial reason to probe. *Verified.*
- `src/extension/manifest.json:26` — `declarativeNetRequestFeedback` is **unpacked-only** (`onRuleMatchedDebug`/`getMatchedRules` debug feedback is ignored for packed installs) yet still triggers the "read your browsing history" install warning. Pure cost in the shipped manifest. *Verified.*
- `src/extension/manifest.firefox.json` — requests `<all_urls>` and `tabs`. The blocking listener genuinely needs host access for both target and initiator, but the minimal correct set is kick.com plus the 11 generated hosts; `tabs` is unnecessary because `onRemoved`/`onUpdated` `status` is unprivileged. Also missing `browser_specific_settings.gecko.data_collection_permissions`, mandatory for AMO submissions since 2025-11-03 and extended to all extensions during H1 2026. *Verified against the manifest.*
- `src/extension/bridge.firefox.js:19` — injects via `script.src = runtime.getURL(...)`, which is **async by spec**, so Kick's bundle can capture `fetch` first. The Chromium build's `world: MAIN` content script has no such gap. kick.com sent no CSP header as of 2026-08-15, so inlining the source is available — but that tradeoff should be deliberate, since inlining breaks the moment Kick adds a policy and `src=` does not.
- `package.json` — `engines: { "node": ">=20" }`. Node 20 reached EOL 2026-04-30 and received no fixes in the 2026-07-29 security release (3 HIGH). Build-time only and zero npm dependencies, so real risk is low, but the declared floor is wrong. *Verified.*

**Contradiction across layers.** `blockedResponse` resolves a 200 with `{}` and `simulateEmptySuccess` does the same for XHR — deliberately storm-safe, matching the community's `no-fetch-if` fix. But `reduceTelemetry` defaults **true**, which enables the companion's telemetry ruleset, and a network-layer cancel wins the race over a page-layer resolve. Installing the companion therefore silently replaces the storm-safe strategy with the exact hard-block the community reports as ineffective and CPU-costly. A prior 5-minute measurement on 2026-08-14 showed flat request counts with no acceleration, so this is *not* reproduced here. *Needs live validation over a long session before changing the default.*

**Missing guardrails**
- No storage-pressure surface: nothing reports how large the sticker library has grown or that a write failed.
- No behavioural test for either background script; Firefox coverage is string-inclusion assertions over the built bundle, and `test/companion.test.js` contains one test (injection order).
- The blocklist fetch uses page `fetch`, so it is subject to CORS and observable by the page. There is no `GM_xmlhttpRequest`/`@connect` path and the companion does not fetch it from the background.

**Recovery and rollback**
- Settings schema 2 migrates schema-1 defaults while preserving explicit values, and import fails closed on newer schemas with an explanation — good.
- Sticker import/export round-trips with schema validation and reports dropped entries. This is the differentiator; it deserves an availability diff ("14 stickers no longer available in this channel") on import.

## Architecture Assessment

- **`src/runtime.js` is ~4,650 lines** and now spans network hooks, layout, filtering, media memory, the sticker organizer, the settings UI, i18n, and diagnostics. The build concatenates, so splitting costs nothing at runtime. The settings UI and the sticker organizer are each self-contained enough to become modules; the i18n table is a third.
- **i18n is structurally fragile.** `tr()` calls `canonicalTranslation()`, which reverse-maps a possibly-already-translated value back to English by scanning **all 252 dictionary entries**; `localizeInterface()` then walks every text node plus three attributes on every settings render. Measured: `es` declares 127 keys but only 126 are unique — `'Accessibility & Shortcuts'` is duplicated, and the later value silently wins; one string translated in `es` has no `pt` entry. Nothing in `npm run verify` checks parity or duplicates. A forward-only key map (`data-i18n` keys) removes both the cost and the ambiguity.
- **The language picker localizes language names** (`'Português': 'Portugués'` under `es`), instead of using endonyms. Standard practice is to render each option in its own language so a user stranded in the wrong locale can still find theirs.
- **The telemetry blocklist is host-granularity only** (`matchesHost` in `src/core.mjs`). AdGuard's shipped Kick tracking rules are **path-scoped** (`||d26yk4zpyhjeeq.cloudfront.net/*/tracking/`), and that host also serves media — so the current model cannot adopt them without either breaking playback or extending to path matching.
- **Test and documentation gaps**: no behavioural coverage of `background.js`/`background.firefox.js`; no i18n gate; no storage-failure test; the README does not state that Violentmonkey on MV3 Chromium does not give real `document-start` by default, nor that Firefox Release cannot install the unsigned package.

## Rejected Ideas

- **"AdGuard shipped a stitched-ad redirect rule for Kick on 2026-08-14, so DNR can kill live SSAI ads."** Investigated and **did not verify**. Issue #237440 is real and closed completed, but the rules actually in `master` are two *tracking* rules (`||d26yk4zpyhjeeq.cloudfront.net/*/tracking/`, `||kick.com/*&loaderVersion=`, both in `SpywareFilter/sections/specific.txt`). There is no `/tm/*/asset_*.ts`, no `redirect=noopmp4-1s`, and no kick rule in `BaseFilter/sections/specific.txt`. Do not re-chase this without re-reading the filter files first.
- **Third-party emote provider ingestion (7TV/BTTV/FFZ into Kick)** — external APIs, a separate entitlement model, and high maintenance; the only existing implementation has ~51 installs. Contradicts the no-network stance.
- **Any subscriber-emote entitlement bypass** — prohibited, and unanimously against field precedent; FFZ, KickTalk and NipahTV all render-without-enabling.
- **Supporting GreasePanda / Tweeks** — low-traction, single-author managers with marketplace/cloud-sync models; added supply-chain surface for negligible reach.
- **AMO unlisted signing to reach Firefox Release** — the only permanent Release-channel path, and excluded by the project's no-signing policy. State the constraint in the README instead.
- **Drops/collectibles *automation*** (auto-claim) — existing scripts do this via a private gamification API, but automation of account actions is explicitly deferred by this project. A read-only local inventory snapshot is not.
- **Following-sidebar thumbnail previews** — someone shipped this on 2026-08-11; low differentiation for the effort.

## Sources

**Platform and standards**
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeRequest
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
- https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- https://developer.chrome.com/docs/extensions/reference/permissions-list
- https://blog.mozilla.org/addons/2024/03/13/manifest-v3-manifest-v2-march-2024-update/
- https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
- https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/
- https://wiki.mozilla.org/Add-ons/Extension_Signing
- https://bugzilla.mozilla.org/show_bug.cgi?id=1745818
- https://nodejs.org/en/blog/vulnerability/july-2026-security-releases
- https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0
- https://github.com/violentmonkey/violentmonkey/releases/tag/v2.47.0
- https://www.tampermonkey.net/changelog.php

**Competitors**
- https://github.com/FrankerFaceZ/FrankerFaceZ/blob/master/src/sites/twitch-twilight/modules/chat/emote_menu.jsx
- https://github.com/FrankerFaceZ/FrankerFaceZ/issues/971
- https://github.com/night/betterttv/issues/3660
- https://github.com/SevenTV/Extension/issues/694
- https://github.com/seventv/extension/releases
- https://github.com/Xzensi/NipahTV
- https://github.com/KickTalkOrg/KickTalk
- https://github.com/Kristijan1001/OverKick
- https://github.com/ebayybe/kick-stream-tweaks
- https://github.com/berkaygediz/uKick
- https://github.com/pixeltris/TwitchAdSolutions/issues/156
- https://github.com/yt-dlp/yt-dlp/issues/17284
- https://github.com/gorhill/uBlock/wiki/Dashboard:-Filter-lists

**Kick platform**
- https://about.kick.com/news-and-press/12-kick-goes-live-with-ads-the-direct-line-to-gen-z-brands-have-been-looking-for
- https://help.kick.com/en/articles/15715119-daily-rewards-on-kick
- https://help.kick.com/en/articles/15159735-how-kick-subscriptions-work-for-viewers
- https://github.com/AdguardTeam/AdguardFilters/issues/237440

**Community signal** (sentiment, not fact)
- https://old.reddit.com/r/Kick/comments/1vet977/what_kick_shipped_in_july/
- https://old.reddit.com/r/KickStreaming/comments/1v4xjqa/
- https://old.reddit.com/r/KickStreaming/comments/1v2pys7/
- https://old.reddit.com/r/KickStreaming/comments/1ayc299/
- https://old.reddit.com/r/KickStreaming/comments/1vjf4kw/anyone_has_a_clue_what_this_does/
- https://old.reddit.com/r/7TV/comments/1tlii8d/the_new_7tv_version_is_terrible_for_me/
- https://old.reddit.com/r/Kick/comments/1ux7syc/streams_are_all_zoomed_in/
- https://old.reddit.com/r/KickStreaming/comments/1vmjrfi/kick_website_is_not_loading/
- https://old.reddit.com/r/Kick/comments/1v5q7bs/can_i_block_a_streamer_so_i_dont_see_their/
- https://old.reddit.com/r/uBlockOrigin/comments/1tm85mt/ads_on_kickcom/
- https://old.reddit.com/r/Kick/comments/1vlt26z/kicking_kick_to_the_kurb/

## Open Questions

1. Does the Chromium companion's `initiatorDomains: ["kick.com"]` actually match **worker-initiated** segment requests? Chrome documents the initiator as the creating document's origin, which implies yes — and if so the network layer can observe media the page-realm hooks provably cannot, changing the approach to stitched-ad work from a `Worker`-constructor prototype to a measurement question. *Needs live validation; do not ship a redirect on this assumption.*
2. Does Kick still read stream quality from `sessionStorage` at player init, and under which key? Two independent community sources say yes; this decides whether quality memory should abandon menu-driving entirely.
3. Over a multi-hour session with the companion installed, does hard-cancelling `litix.io` at the network layer produce the retry storm the community reports? A 5-minute 2026-08-14 measurement did not reproduce it. This decides whether the telemetry ruleset should defer to the page-realm resolve.
4. Is there a stable, read-only path for Daily Rewards / collectibles inventory, and how often does it change shape? Existing third-party scripts drive a private gamification API; a read-only snapshot is only worth building if it can fail loudly without touching player or chat.
