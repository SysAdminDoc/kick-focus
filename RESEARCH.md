# Research — Kick Focus

Date: 2026-08-14 — replaces all prior research.

## Executive Summary

Kick Focus is a dependency-free, desktop-only Kick.com client mod: layout and focus modes, a five-page settings center, content filters, accessibility controls, and ad defense — now shipping as both a userscript and an optional Manifest V3 companion extension (v1.1.0). Its strongest current shape is being the only project in the space that combines layout control, content filtering, ad defense, and a real settings center; every open-source competitor ships one or two of those pillars, and the one product that ships all four (Kick Augmenter) is closed-source. The highest-value direction is now **ad defense at the layer that actually matters**: Kick launched ads commercially on 2026-08-06, and the ads are server-side stitched into the HLS stream, where no host blocklist — including the companion's new network ruleset — can reach them. The community has already converged on a working technique (rewriting the `/playback` JSON response and scrubbing ad markers from the media manifest) that this project is architecturally well-placed to ship turnkey, because it already owns a document-start fetch/XHR interception layer.

Top opportunities in priority order:

1. Neutralize ads at the `/playback` JSON response (falsify `auto_ads_enabled`, prune the ad SDK blocks) — the only in-page technique that touches stitched ads. *Verified technique, Likely effective.*
2. Scrub `#EXT-X-CUE-OUT`/`#EXT-X-DATERANGE` ad ranges from the HLS manifest, with a mute-and-seek fallback for residual breaks.
3. Silence `litix.io` telemetry without triggering its retry storm — a measured performance bug, not just a privacy preference.
4. Replace CSS/class selectors with React props/fiber anchors (the 7TV Kick technique) — selector churn is the documented #1 killer of Kick extensions.
5. Add a fail-open guard and tighter labels to the content filters; the current regexes hide on substring matches with no ceiling.
6. Persist quality and volume — the single most re-invented feature on the platform and absent here.
7. Player hardening: survive window resize and monitor moves, fix the ultrawide crop, mute home autoplay rather than only pausing it once.
8. Runtime test coverage: `src/runtime.js` is 1,700+ lines with zero direct tests.
9. Ship an ad-stack fingerprint drift alarm so the arms race fails loudly instead of silently.
10. Firefox path for the companion, where Manifest V2 and full userscript capability both survive.

## Product Map

**Core workflows**

- Watch a stream with the discovery rail collapsed and chat sized or hidden (Focus/Theater/Standard, per-channel memory).
- Browse and filter: widened grids, labeled content filters (casino, mature, Drops, promoted), dimmed watched cards.
- Control everything from one in-page settings center (five pages, autosave, import/export, scoped reset, diagnostics) or the `Ctrl+K` command menu.
- Suppress ads and optional telemetry: page-realm interception plus DOM shell removal, and with the companion installed, browser-level request blocking.

**User personas**

- Desktop viewer on a 1440–1920 screen who finds Kick's shell wasteful and its ads intolerable.
- Privacy-minded viewer who wants local-only settings and no remote code (the project ships neither `@require` nor analytics).
- Accessibility-sensitive viewer needing reduced motion, larger targets, text scaling, and visible focus.

**Platforms and distribution**

- Desktop Chromium and Firefox; mobile explicitly out of scope. Verified viewports 1440×900 and 1920×1080.
- Userscript: paste `dist/kick-focus.user.js` into Tampermonkey/Violentmonkey. No publication, no auto-update.
- Companion: unpacked MV3 load from `dist/extension/`, plus a shareable zip. Unsigned by design; no store listing.

**Key integrations and data flows**

- Settings live in the userscript manager's storage, falling back to `localStorage`; the companion mirrors them into `chrome.storage` for its popup.
- Page ↔ companion communication is CustomEvent-based across the MAIN/ISOLATED world boundary, with settings passed as JSON strings (page-world objects are not structured-cloneable from the isolated world).
- Network rules are generated at build time from the same host lists `classifyRequest` uses, so the page and network layers cannot diverge.

## Competitive Landscape

**Kick Augmenter** (closed-source, Chrome Web Store) — the feature-count leader: volume/quality memory, VOD resume and downloads, clip capture and search, hidden viewer-count reveal, chat toolkit, all individually toggleable. *Learn:* the per-feature toggle philosophy and the breadth of player memory features. *Avoid:* closed source and store-only distribution; its Reddit announcement was taken down, so availability is fragile.

**uKick** (Apache-2.0) — the only serious content-filtering competitor: channel/category/tag blocking, chat user filtering, and uniquely **remote JSON blocklist subscriptions with auto-sync**. *Learn:* subscription blocklists are a real differentiator nobody else has. *Avoid:* volume boost to 10× and danmaku are scope sprawl for a focus-oriented tool.

**Pkkls/kick-ad-blocker** (MIT, MV3) — the closest thing to a reference implementation of Kick ad blocking: DNR host blocking, frozen `googletag`/`google.ima` stubs at document_start, DOM cleanup, and — the important part — `/playback` flag falsification plus m3u8 scrubbing in both `fetch` and an `XMLHttpRequest.responseText` property hook. *Learn:* the whole layered technique, and its "layer 5" fingerprint check that detects ad-stack changes loudly. *Avoid:* nothing significant; this is the model to follow.

**7TV** (source-available, 466★) — supports Kick first-party. Its `src/site/kick.com/` reads `__reactProps$` off chat nodes and anchors on `data-*`/`id` attributes rather than utility classes. *Learn:* the React-props/fiber anchoring pattern and patched-node marking with a WeakMap of bindings. *Avoid:* its fragility signal — its Kick issue tracker is dominated by selector-breakage reports, including "works on `www.kick.com` but not `kick.com`", which is exactly why Kick Focus matches both hosts.

**NipahTV** (24★, no license) — the reference Kick chat extension; emote menu, fuzzy search, mod commands. Its `Sites/` vs `Core/` split lets it target Kick and Twitch from one codebase, and it ships extension and userscript from one build. *Learn:* the dual-target build is the proven escape hatch if store distribution ever matters. *Avoid:* the unlicensed status, and its 68 open issues suggest breadth outrunning maintenance.

**Enhancer** (MIT, 123★, most active) — multi-platform, Twitch-first: watch-time tracking, chat attachments, enhanced mentions, stream latency display. *Learn:* stream latency with click-to-refresh is a cheap, well-liked diagnostic. *Avoid:* spreading across platforms; Kick support is visibly the junior partner.

**sixem/kick-enhancer** (userscript, active 2026-08) — the most direct overlap: unhide viewer counts, remove discovery/recommended sections, hide gambling streams, stop front-page autoplay. *Learn:* decluttering demand is real and this is the nearest competitor to Kick Focus's layout pillar. *Avoid:* unlicensed, single-maintainer, 1★ — no distribution advantage to defend against.

**OverKick / kickenhance / Left Kick** (single-purpose) — transparent OLED-safe resizable chat overlay, fullscreen chat overlay, chat-on-the-left. Each exists because Kick's fullscreen chat shrinks the video and chat placement is fixed. *Learn:* these three validate that chat placement and overlay are worth owning properly; OverKick also advertises "Force 1080p" as a headline feature. *Avoid:* shipping them as disconnected one-offs.

**TwitchAdSolutions / vaft** (Twitch analog) — hooks the `Worker` constructor to inject m3u8 processing before the player's worker runs, detects the `stitched` signifier, and rotates to backup playlists. *Learn:* the worker-hook technique as insurance if Kick moves manifest fetching into a worker. *Avoid:* the backup-stream rotation itself — Kick's playback JSON exposes a single `playback_url.live`, so there is no equivalent clean stream to swap to.

**FrankerFaceZ / BetterTTV** (Twitch analogs) — fiber-walking to find React components by shape rather than module ID, and a full in-page control center with profiles. *Learn:* FFZ's component-shape matching survived Twitch's webpack renumbering, which is the same class of problem Kick's Tailwind churn creates; BTTV's settings component inventory maps closely onto what Kick Focus already built. *Avoid:* FFZ's CDN-loader architecture — it ships remote code, which contradicts this project's no-remote-code stance.

## Security, Privacy, and Reliability

**Bugs and risks found**

- **Content filters have no fail-open ceiling** (`src/runtime.js`, `applyContentFilters`). A label match hides a card with no cap on how much of a grid can disappear. A mislabelled page or a Kick copy change could empty the browse grid silently, and the user has no signal that filtering — rather than Kick — produced an empty page.
- **Content labels match too loosely** (`src/core.mjs`, `detectContentLabels`). `\b(?:kick\s+)?drops?\b` matches any card whose text contains "drop" as a word ("Drop the beat", "dropped frames"), and the casino pattern matches any occurrence of "casino" in a title. Both hide cards on substring evidence with no allowlist and no user-visible reason.
- **Casino paths are sticky and never expire** (`src/runtime.js`, `state.casinoPaths`). Once a channel is seen with a casino label it stays filtered for the session even after it changes category — correct for a gambling filter, but undocumented and unreachable from the UI.
- **`litix.io` blocking may trigger a retry storm.** Community reports describe thousands of blocked fetches per minute once Mux telemetry is blocked, tanking CPU. Kick Focus blocks this host by default (`reduceTelemetry` defaults to on), so the project may be shipping the storm rather than the fix. *Needs live validation over a long session.*
- **Settings fall back to page-readable `localStorage`** when GM APIs are absent (`gmGet`/`gmSet`). Under the companion extension that is always the case, so Kick itself can read and write Kick Focus settings. Low severity, but it should be a documented choice rather than an accident.
- **No settings migration path.** `validateImportedSettings` rejects newer schemas but there is no upgrade routine for older ones; `normalizeSettings` silently resets unknown shapes to defaults.

**Fixed during this pass (v1.1.0)**

- Double-boot when userscript and companion are both installed — both bundles now share a `__kickFocusBooted` guard.
- The companion never learned about defaults that are on, so a fresh profile ran with `reduceTelemetry` enabled in the UI but its network ruleset disabled. Root cause was an injection-order race compounded by page-world objects failing to cross into the isolated world; settings now travel as JSON strings over a request/response handshake.

**Missing guardrails**

- No drift alarm on the ad stack. When Kick changes its ad plumbing, the protection log will simply stop recording matches, which reads identically to "no ads were served".
- No compatibility self-test that fails loudly when the chat or sidebar hooks stop matching; the current self-check verifies the script's own markers, not that its selectors still find anything.
- The badge counter depends on `onRuleMatchedDebug`, which exists only for unpacked installs. The popup reports this honestly, but there is no packed-install fallback.

**Recovery and rollback needs**

- Disabling Kick Focus should be the first troubleshooting step and is documented, but there is no in-UI panic switch that reverts all DOM/CSS changes without a reload.
- Import validation is good; export has no schema version pinning beyond `schema`, so a future rename loses data silently.

## Architecture Assessment

**Module and boundary improvements**

- `src/runtime.js` is 1,694 lines spanning network hooks, layout, filtering, settings UI rendering, command menu, and shortcuts. The settings UI (roughly `renderLayoutPage` through `renderAboutPage`, plus `onInterfaceClick`/`onInterfaceChange`) is a self-contained concern that should become its own module; the build already concatenates, so splitting costs nothing at runtime.
- **Selector strategy is the biggest architectural risk.** Chat detection hangs on `[role="separator"][aria-label="Resize chatroom"]` and sidebar handling on `#sidebar-wrapper` plus Kick's own English labels — the label dependency also breaks under localization. Adopt the 7TV approach: a central selector registry with ordered fallbacks, React `__reactProps$`/fiber anchors where structure is stable, and `data-*`/`id` anchors over utility classes.
- The page↔companion protocol is now three CustomEvents and a dataset flag. It works, but it is undocumented and untested; it deserves a single named module on both sides with the event names as shared constants.

**Refactor candidates**

- `src/core.mjs` `detectContentLabels` — replace substring regexes with anchored label extraction from known badge elements, keeping the text heuristic as a fallback.
- `src/runtime.js` `applyContentFilters` — add the fail-open ceiling, and record what was hidden so the UI can say so.
- `scripts/check.mjs` — good coverage now (27 checks), but it asserts artifact shape, not behavior. It cannot catch a selector that no longer matches Kick.

**Test and documentation gaps**

- Six tests, all against `src/core.mjs`. Zero coverage of `src/runtime.js`, the settings UI, the SPA lifecycle, or the companion bridge. A jsdom or fixture-driven suite over saved Kick DOM snapshots would catch the failure mode that actually happens (Kick ships a redesign). Raw material is already on disk: `page_examples/` holds MHTML captures of Home, Browse, Following, and a live channel. It is gitignored as of 2026-08-14 — 151 MB, and stale captures mislead — so the fixture work should decode and reduce them to small committed snapshots rather than depending on the originals.
- `npm run verify:extension` now provides live proof for the extension, but nothing equivalent exists for the userscript under a real manager — cold-start injection timing remains unverified.
- The repository has no `CLAUDE.md` working-notes file, and `.gitignore` omits the usual agent-artifact entries.

## Rejected Ideas

- **Third-party emote support (7TV/BTTV/FFZ)** — table stakes for chat tools, but it is a different product; NipahTV, 7TV, and jakubn11 all do it well and it would double the maintenance surface. *(Source: GitHub sweep.)*
- **Proxy-based ad stripping (TTV LOL PRO model)** — requires operating servers, contradicts the no-remote-code and privacy-local stance. *(Source: platform research.)*
- **Backup-stream rotation on ad detection (vaft model)** — Kick's playback JSON exposes a single `playback_url.live`, so there is no alternate player-type token to swap to. *(Source: platform research.)*
- **Replacing Kick's player entirely (Alternate Player model)** — enormous surface, breaks with every IVS SDK change, and does not solve stitched ads anyway. *(Source: platform research.)*
- **Desktop chat client** — KickTalk and Kickerino already occupy this, and it is not a site mod. *(Source: GitHub sweep.)*
- **Danmaku / bullet chat** — uKick and Kick Comment Scroller cover it; it contradicts a focus-oriented product. *(Source: GitHub sweep.)*
- **Publishing to Chrome Web Store** — MV3 review plus the ad-blocking behavior invites removal risk, and the project explicitly ships unsigned and unpublished. Revisit only on explicit instruction.
- **Using Kick's official dev API (dev.kick.com)** — OAuth 2.1 with webhook push, designed for server-side bots; it cannot serve a page-realm client mod. The site's own private endpoints and Pusher socket remain the practical route. *(Source: docs.kick.com.)*
- **Cross-user features (shared block lists, username colors visible to other users)** — kcik proved the network-effect model dies with the project, and it would require a backend. *(Source: GitHub sweep.)*

## Sources

**Competitors (OSS)**
- https://github.com/Pkkls/kick-ad-blocker
- https://github.com/berkaygediz/uKick
- https://github.com/sixem/kick-enhancer
- https://github.com/SevenTV/Extension
- https://github.com/Xzensi/NipahTV
- https://github.com/enhancer-app/enhancer · https://docs.enhancer.at/features/kick/
- https://github.com/destinygg/kickstiny
- https://github.com/chadium/kcik
- https://github.com/KickTalkOrg/KickTalk
- https://github.com/jakubn11/kick-third-party-emotes
- https://github.com/ebayybe/kick-stream-tweaks

**Competitors (closed)**
- https://chromewebstore.google.com/detail/kick-augmenter/hdhpmccblalleagomabbfnpkbcpojfpd

**Adjacent-domain technique**
- https://github.com/pixeltris/TwitchAdSolutions · https://deepwiki.com/pixeltris/TwitchAdSolutions/5.3-m3u8-processing-and-ad-detection
- https://github.com/FrankerFaceZ/FrankerFaceZ
- https://github.com/night/betterttv
- https://github.com/Anarios/return-youtube-dislike

**Platform and standards**
- https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- https://github.com/Tampermonkey/tampermonkey/issues/2209
- https://www.tampermonkey.net/changelog.php
- https://violentmonkey.github.io/posts/inject-into-context/
- https://violentmonkey.github.io/api/metadata-block/

**Kick platform**
- https://about.kick.com/news-and-press/12-kick-goes-live-with-ads-the-direct-line-to-gen-z-brands-have-been-looking-for
- https://docs.kick.com/getting-started/scopes · https://github.com/KickEngineering/KickDevDocs
- https://help.kick.com/en/articles/14994226-browser-compatibility-and-recommended-settings-for-kick
- https://github.com/Bukk94/KickLib · https://github.com/fb-sean/kick-website-endpoints

**Community signal** (sentiment, not fact)
- https://old.reddit.com/r/uBlockOrigin/comments/1uh81lp/kickcom_hammering_ublock_literally_thousands/
- https://old.reddit.com/r/uBlockOrigin/comments/1tm85mt/ads_on_kickcom/
- https://old.reddit.com/r/Kick/comments/1u10md5/the_only_reason_i_came_to_kick_was_because_it_had/
- https://old.reddit.com/r/Kick/comments/1ux7syc/streams_are_all_zoomed_in/
- https://old.reddit.com/r/Kick/comments/1r2pjvn/kick_website_is_terrible/
- https://old.reddit.com/r/Kick/comments/1uzr9e6/why_tf_when_i_open_kick_theres_always_a_stream/
- https://old.reddit.com/r/KickStreaming/comments/1rs5zge/is_there_a_way_to_watch_kick_streams_without/
- https://old.reddit.com/r/uBlockOrigin/comments/1ojzcnu/kick_dot_com_reminds_volume_and_stream_quality/
- https://old.reddit.com/r/Kick/comments/1v5q7bs/can_i_block_a_streamer_so_i_dont_see_their/
- https://old.reddit.com/r/KickStreaming/comments/1rr4z9f/i_got_tired_of_kicks_fullscreen_chat_shrinking/

## Open Questions

1. Does blocking `litix.io` on a long Kick session provoke the retry storm the community reports, or does Kick Focus's page-realm block (which returns a synthetic response rather than failing) already avoid it? This decides whether `reduceTelemetry` should stay on by default. *Needs live validation: one multi-hour session with request counting.*
2. Is Kick's HLS manifest fetched from the page realm or from inside the IVS player's worker? This determines whether manifest scrubbing needs the `Worker`-constructor hook or only the existing `fetch`/XHR hooks. *Needs live validation on a channel with ads enabled.*
3. Does an authenticated session change the ad path (subscribers reportedly still received ads during testing)? All auditing to date is logged-out, so the ad-facing work is unvalidated for the accounts most likely to notice.
