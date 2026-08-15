# Research — Kick Focus

Date: 2026-08-15 — replaces all prior research. Differential pass against v1.5.0 (shipped earlier the same day); the 2026-08-14/15 passes covering the client-mod landscape and Kick's API surface are superseded except where cited.

## Executive Summary

Kick Focus is a desktop-only Kick.com client mod shipping three artifacts from one dependency-free source: a userscript, an MV3 Chromium companion, and an MV2 Firefox companion. v1.5.0 turned it from a DOM scraper into a client that reads Kick's own API — emote catalog, realtime chat, moderation reasons, usage counts, collectible rarity — plus a nine-tile multi-stream grid. Its strongest shape is structural, not featural: **it runs on kick.com's own origin.** Every standalone multi-view website is locked out of chat participation by a documented CSRF wall (KickDevDocs #262), earns its users no watch-time credit, and dies the day Kick ships an anti-embed overlay — the extinction event that killed the Twitch multi-view generation (bhamrick/multitwitch #44). Kick Focus is immune to all three.

The highest-value direction is **making what shipped trustworthy before adding more**. Two independent measurements say so. First, community signal is unambiguous that Kick's problem is reliability, not missing features: stream switching stalls 5–10 s with the sidebar frozen (6+ distinct users, unfixed 12+ days), and adblock filter lists now break account signup and the follow button outright (4 distinct users in one week). Second, v1.5.0's own new surfaces carry gaps the existing gates cannot see — the grid violates WCAG 2.2.2, neither the usage counters nor the saved layouts are covered by export, and the new settings copy joined a pre-existing translation hole that now spans two thirds of the interface.

Top opportunities in priority order:

1. **The multi-stream grid fails WCAG 2.2.2 and 1.4.2** — nine autoplaying tiles with no pause-all, no mute-all, and no reduced-motion gate. No surveyed competitor does this correctly either, so it is both a defect and a differentiator.
2. **Nine tiles at source quality is unusable on the hardware most people own** — ~4–6 simultaneous 1080p60 decodes is the realistic integrated-GPU ceiling. Quality capping turns out to be impossible across the origin boundary (see Rejected Ideas), so unloading unwatched tiles is the whole of the available lever — and nobody in the field does even that.
3. **Most settings copy is untranslated and nothing detects it** — 76 of 112 settings label/description strings have no `es` or `pt` entry. Partly pre-existing, widened by v1.5.0; the i18n gate checks locale *parity*, not source coverage, so it passes throughout.
4. **Export silently omits emote usage counts and multi-stream layouts** — the export/import round-trip is this project's unique differentiator and it no longer covers everything it stores.
5. **Realtime transport is one vendor toggle from dying** — Pusher's Authorized Connections feature disconnects clients that never authenticate; Kick already runs a self-hosted replacement gateway speaking the same wire protocol.
6. **The multi-stream chat panel is read-only by design and does not say so** — Kick's popout chat throws CSRF inside an iframe. Kick Focus can fix this properly where no website can.
7. **Adblock collisions are generating support noise that is not our fault** — users cannot sign up or follow with uBlock enabled, and will blame whatever extension they installed last.
8. **Collectibles transparency is the strongest unmet demand found** — 7+ distinct users confused by useless streaks, undocumented duplicates, opaque odds, and retroactively swapped emotes.
9. **Kick's API is churning faster than before** — an endpoint deleted, the XSRF requirement dropped, moderation behaviour changed, all within four weeks.

### Two corrections to prior conclusions

- **AI-moderation reasons were justified on demand that does not exist.** Earlier notes (including today's v1.5.0 CHANGELOG framing) called Kick's non-disableable AI moderation "among the loudest documented complaints." A dedicated archive sweep of r/KickStreaming, r/Kick, r/LivestreamFail and r/Twitch for 2026-07-01→2026-08-15 found **0–1 distinct complainants**; `aiModerated`, `automod`, and `deleted message` were confirmed real zeros. The feature remains genuinely unique and cheap to keep — the realtime event is already parsed — but it is a *latent* capability, not a demand-driven one, and should not be marketed as answering user outcry. Confidence: Verified (absence).
- **Multi-stream has zero expressed community demand.** Every "multistream" hit in the window is broadcaster-side simulcasting. The observed viewer behaviour is rapid channel-flipping, which the stream-switching stall (opportunity 9 below) serves better than a grid does. The feature was operator-requested and is worth keeping and finishing — but it is a bet, not a response to demand, and the honest ranking puts reliability work above grid features. Confidence: Verified (absence, with the caveat that these are small, low-velocity subs and absolute counts are single-digit).

## Product Map

**Core workflows**
- Restyle and de-clutter Kick's desktop shell across Home / Browse / Following / Drops / Category / Search / Channel, with layout, theme, density, and accessibility controls.
- Block ads and optional telemetry at the earliest layer available, rewrite the `/playback` ad flags before the player reads them, and report honestly which layer is active.
- Organize the emote library — discovered from Kick's API and from live chat — with favorites, groups, removals, and a full JSON export/import round-trip.
- Read Kick's own data for things the page discards: moderation reasons, real usage counts, collectible rarity, shadowed names.
- Watch up to nine channels in one grid on Kick's own embedded player, with audio and chat following the focused tile.

**Personas** — the desktop power viewer who keeps Kick open for hours (primary); the multi-channel follower during large events (secondary, operator-requested); the accessibility-constrained viewer needing reduced motion, high contrast, and static emotes (explicitly served, and the project ships an accessibility page that raises the bar it is held to).

**Platforms and distribution** — Chromium ≥ MV3 and Firefox via unpacked/self-hosted companions, plus Tampermonkey/Violentmonkey for the userscript. Unsigned by design; no store publication. **No git remote configured** — all work is local-only.

**Key integrations and data flows** — same-origin reads of `kick.com/api/v2`, `web.kick.com/api/v1`, and `kick.com/emotes/{slug}` inheriting the page's session; a Pusher WebSocket whose credentials are read from Kick's broker at runtime; `player.kick.com` and `kick.com/popout/{slug}/chat` iframes; local storage only, with export as the sole egress.

## Competitive Landscape

**MultiKick.com** (closed, Cloudflare-gated) — path-based shareable URLs (`/{a}/{b}`), adaptive layout, per-stream quality and audio, 7TV emotes in multi-chat, favorites with live-status indicators. *Learn:* the favorites-with-live-status list is its stickiest feature, and path URLs are the field's de facto sharing standard. *Avoid:* it cannot deliver working chat, watch-time credit, or channel rewards — the structural ceiling of every off-origin viewer.

**LordKnish/StreamGrid** (201★, Electron, active 2026-06) — the OSS leader: drag-reorder, corner-resize, unlimited named presets, JSON layout import/export, **player pooling and lazy loading**, global mute plus per-stream audio. *Learn:* player pooling is the only serious performance engineering in the field; its preset model is the closest analog to ours. *Avoid:* no Kick module at all, and its Twitch integration is permanently hostage to the `parent` parameter (its issues #7, #13).

**ViewGrid** (closed, viewgrid.tv) — up to 20 streams, presets 1/2/4/6/8/12, shareable grid URLs, start-muted-unmute-one — the same audio model Kick Focus chose. *Learn:* explicit grid presets are expected; our automatic column count is less discoverable. *Avoid:* 20 simultaneous streams is a specification, not a usable experience.

**multitwitch.tv / multistre.am** (626★ / 7★, both effectively dead since 2022 and 2016) — *Learn:* their issue trackers are the field's memory. #59 (no quality control, defaults to source, melts CPUs), #51/#52 (chat login broken in iframes), #47/#56 (mute-all and per-stream hotkeys) are the durable complaints. *Avoid:* their fate — #44 records the platform shipping a player update that broke everything overnight. Neither ever added Kick; the niche is genuinely open.

**destinygg/kickstiny** (31★, active through 2026-08) — exists specifically because Kick's embed has no quality selector and no volume slider, and users get stuck at 480p. It reaches the Amazon IVS worker inside the player to control quality (its issue #19). *Learn:* this is the proven route to per-tile quality capping — the single highest-value performance lever available. *Avoid:* its own issue list shows the cost (quality resets after unpause, empty quality lists, transient playback-URL failures needing retry).

**Kickerino** (CarlBraun, desktop + Android + iOS, 8★) — the fastest-moving new entrant: four releases 2026-08-02→13. *Learn:* it is an early-warning system for Kick API churn — it shipped fixes for collectible badges appearing in chat payloads (v1.31), the XSRF requirement being dropped (v1.33), and timeout/ban-delete behaviour changing (v1.34) within days of each. *Avoid:* nothing yet; it is a different product class (standalone client).

**NipahTV** (coasting) — its only release in the window, v1.5.110 (2026-07-29), exists solely because Kick deleted `/api/v1/video/:livestream_id`. *Learn:* Kick removes endpoints without notice; its Dexie/IndexedDB-in-the-service-worker pattern remains the reference for outgrowing `localStorage`. *Avoid:* depending on any single Kick endpoint without a fallback.

**KickTalk** — **dead** (last push 2026-05-15, last release 2025-06-10). Previously cited here as a live reference for normalizing Kick subscription state across response shapes; that lesson stands, the project does not.

**Pkkls suite** (kick-core, kick-ad-blocker, kick-chat-translator, kickbus) — kick-core documents Kick's self-hosted `websockets.kick.com/viewer/v1/connect` gateway and its token flow; kick-ad-blocker ships SSAI detection and an HLS proxy. *Learn:* the realtime migration path and the stitched-ad approach, both ahead of us. *Avoid:* kick-core's README claim that the hosted Pusher key is dead — independently disproven twice, most recently by a live handshake on 2026-08-15.

**ydbilgin/kickflow** (2026-08-07) — preserves deleted and banned chat messages client-side. *Learn:* it is the direct competitor to our moderation-reason feature and validates the capability even though Reddit demand is absent.

## Security, Privacy, and Reliability

**Accessibility defects (the grid is the worst surface in the project)**
- `renderMultistream()` in `src/runtime.js` creates up to nine `<iframe>` tiles with `autoplay=true` and provides no pause-all, no mute-all, and no reduced-motion gate. **WCAG 2.2.2 (Pause, Stop, Hide, Level A)** applies — motion over 5 s, automatic, parallel with other content. **WCAG 1.4.2 (Audio Control)** applies to the focused tile's audio. `prefers-reduced-motion` is explicitly *not* an acceptable substitute for a visible control (w3c/wcag#3766); the project already honours that query for emotes but not for video. A project shipping an accessibility settings page is held to this.
- Focus cannot be managed inside cross-origin player frames, so per-tile host controls plus one global control placed *before* the grid in tab order is the only workable pattern.

**Missing guardrails**
- Realtime payloads are parsed and rendered without treating them as hostile input. `annotateDeletedMessage()` uses `textContent` (safe), but every future consumer of `normalizeChatMessage()` inherits an assumption that Kick's socket is trustworthy. Pusher's own guidance and the anonymous-subscription model say otherwise: any party can publish to a channel they can subscribe to if the app is misconfigured.
- The embed `allow=` list grants `encrypted-media` (`src/runtime.js`, `renderMultistream`). Kick playback is Amazon IVS HLS with no DRM; the grant is unnecessary attack surface. Minimal correct set: `autoplay; fullscreen; picture-in-picture`.
- `referrerPolicy = 'origin'` is correct and should be kept — `no-referrer` is now actively dangerous for player embeds (platforms have begun hard-failing referrer-less embeds). `credentialless` must **not** be adopted: it would anonymize the player and break logged-in playback.

**Data-safety gaps**
- `exportSettings()` (`src/runtime.js:5586`) serializes `{...state.settings, stickers: stickerPreferencesValue()}` — it omits `state.emoteUsage` (`kick-focus:emote-usage`) and `state.multistream` (`kick-focus:multistream`). Both are user-authored data the project promises is portable; the About page's storage table lists them while export drops them. `validateImportedSettings()` has no branch for either.
- Usage counts and layouts are therefore protected by the storage-failure warning but not by the backup mechanism it tells users to run.

**Reliability risks**
- **Realtime is one toggle from dying.** Pusher's Authorized Connections feature (out of beta) lets an app owner disconnect any client that never authenticates or joins a private/presence channel. Kick has not enabled it — verified by anonymous handshake on 2026-08-15 — but the self-hosted `websockets.kick.com/viewer/v1/connect` gateway is live and speaks the same protocol, and the broker's `provider` discriminator plus `degraded` state is migration scaffolding. Our design already degrades to DOM on an unknown provider; what is missing is a transport abstraction so a cutover is a swap, not a rewrite.
- **Kick's API churn accelerated**: `/api/v1/video/:livestream_id` deleted (~2026-07-29), XSRF header requirement dropped (~2026-08-11), timeout/ban-delete behaviour changed (~2026-08-13). Kick Focus is not exposed to any of the three — verified by grep: no XSRF header is sent and no `/api/v1/video/` path is referenced — but the cadence justifies drift detection.
- **Chrome 139 removed `--disable-extensions-except` and `--extensions-on-chrome-urls` from official builds.** `scripts/verify-extension.mjs` depends on the former and survives only because it targets Playwright's Chromium-for-Testing. This is an undocumented load-bearing constraint on the live gate.

## Architecture Assessment

- **`src/runtime.js` is 6,179 lines** and now carries five distinct concerns: site styling, content filtering, the settings UI, the Kick live-data client, and the multi-stream surface. The build concatenates modules with `export` stripped, so extraction is nearly free — `src/multistream.js` and `src/live.js` are the natural seams, and the new "every module export is defined in every bundle" gate already covers any file added to `moduleFiles` in `scripts/check.mjs`.
- **The i18n gate has a coverage hole, and the hole is large.** `test/i18n.test.js` proves every locale declares the same keys with no duplicates, but nothing asserts that a string the UI *renders* has an entry at all. Measured 2026-08-15: **76 of 112** `row()`/`pageHeader()` strings are missing from at least one locale, against 126 keys per locale. Only 2 of 16 `tr()` call-site strings are missing — the gap is concentrated in settings markup that `localizeInterface()` translates by post-render lookup, where a missing entry is indistinguishable from an intentional English string. Much of it predates v1.5.0 (layout, chat, density, appearance copy); v1.5.0 widened it by adding the Kick-data section and multi-stream surface with no dictionary entries at all.
- **`trapFocus` covers only the settings modal** (`src/runtime.js:5984` guards on `state.modal`). The multi-stream backdrop and the command menu are modal surfaces without focus containment.
- **Test gaps:** no test exercises `renderMultistream` tile reuse (the "replacing an iframe restarts the stream" invariant is load-bearing and unasserted), the `applyMultistreamAudio` single-unmuted-tile invariant, or `normalizeDeletion` → `annotateDeletedMessage` DOM behaviour. The live harness asserts all three, but the live harness is not run by `npm run verify`.
- **Docs gap:** README documents the Kick-data contract well but does not state the Firefox install reality per channel, the Violentmonkey "Alternative page mode" requirement, or that multi-stream chat is read-only.

## Rejected Ideas

- **Per-tile quality capping** — settled 2026-08-15 and now closed. `player.kick.com` is a *different origin* from `kick.com`, so the `sessionStorage['stream_quality']` route v1.5.0 uses for the page player cannot reach an embed, and the embed's own document is unreachable for the same reason. destinygg/kickstiny controls quality by scripting the Amazon IVS worker, but it runs on Kick's own page, not inside a cross-origin iframe, so that technique does not transfer. The embed accepts only `muted`, `autoplay`, and `allowfullscreen`. Nothing short of Kick adding a quality parameter makes this possible. What remains achievable — and is now implemented — is unloading tiles nobody is watching, since the host owns the `<iframe>` element even when it cannot see inside it. This also resolves open question 1.
- **Per-tile volume sliders** (MultiKick.com, StreamGrid) — `player.kick.com` exposes only `muted`, `autoplay`, and `allowfullscreen`; there is no volume parameter, and changing the URL restarts the stream. Would require IVS-worker scripting for a marginal gain over audio-follows-focus.
- **Keyboard shortcuts for tile focus/mute** (multitwitch #47/#56, Worsttrumpet/MultiStream-Grid) — the project's conventions prohibit keyboard shortcuts. On-tile controls already cover it.
- **`sandbox` attribute on player embeds** — a working player needs `allow-scripts allow-same-origin`, which restores full origin power; the attribute would only suppress popups. Permission policy (`allow=`) is the real lever.
- **`credentialless` iframes** — anonymizes the frame, breaking logged-in playback and entitlements. Kick does not set `require-corp`, so it buys nothing.
- **Twenty-stream grids** (ViewGrid) — the realistic integrated-GPU ceiling is ~4–6 simultaneous 1080p60 decodes. Nine is already ambitious; raising the cap would be a specification, not a feature.
- **VOD sync controls** (viewsync.net) — meaningful only for synchronized VOD playback, not live grids; absent from every live multi-view tool for that reason.
- **Consuming Kick's official webhook API** (kickbus, KickDevDocs) — server-push only, requires a client secret, and delivers strictly less than the internal surface. Reconfirmed 2026-08-15; unchanged from the prior pass.
- **Marketing the moderation-reason feature as answering user demand** — the demand is not there (see Executive Summary corrections). Keep the feature, drop the claim.
- **Mobile support** — remains explicitly out of scope; the three mobile-app complaints found are outside a desktop extension's reach.

## Sources

Multi-stream ecosystem
- https://multikick.com/ · https://creatortoolslist.com/product/multikick · https://viewgrid.tv/watch/kick · https://multistre.am/
- https://github.com/LordKnish/StreamGrid · https://github.com/bhamrick/multitwitch/issues · https://github.com/destinygg/kickstiny/issues/19 · https://github.com/CxWatcher/CxWatcher.github.io · https://github.com/ilanzgx/multistream

Kick platform
- https://help.kick.com/en/articles/8010826-how-to-embed-your-kick-livestream · https://docs.kick.com/changelog · https://kick.com/collectibles
- https://github.com/KickEngineering/KickDevDocs/issues/262 · /issues/403 · /issues/407
- https://github.com/Xzensi/NipahTV · https://github.com/CarlBraun/Kickerino/releases · https://github.com/Pkkls/kick-core · https://github.com/Pkkls/kick-ad-blocker · https://github.com/ydbilgin/kickflow · https://github.com/retconned/kick-js
- https://www.tubefilter.com/2026/08/11/kick-launches-mid-roll-ads-creator-monetization/ · https://www.netinfluencer.com/kick-opens-to-advertisers-after-three-years-of-creator-first-growth/ · https://help.kick.com/en/articles/16225986-how-to-request-an-unban-from-a-channel-s-chat · https://help.kick.com/en/articles/15715119-daily-rewards-on-kick

Realtime
- https://pusher.com/docs/channels/using_channels/authorized-connections/ · https://pusher.com/blog/authorized-connections-is-out-of-beta/ · https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/ · https://security.snyk.io/package/npm/pusher-js

Browser platform
- https://developer.chrome.com/docs/extensions/whats-new · https://developer.chrome.com/blog/chrome-userscript · https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest · https://developer.chrome.com/blog/autoplay · https://developer.chrome.com/blog/chrome-61-media-updates · https://developer.chrome.com/blog/iframe-credentialless
- https://blog.mozilla.org/addons/2025/10/23/data-collection-consent-changes-for-new-firefox-extensions/ · https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions
- https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0 · /tag/v2.47.1 · https://www.tampermonkey.net/changelog.php
- https://nodejs.org/en/about/previous-releases · https://nodejs.org/en/blog/vulnerability/july-2026-security-releases

Accessibility
- https://github.com/w3c/wcag/issues/3766 · https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html · https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html

Community signal (Arctic Shift archive, 2026-07-01→2026-08-15)
- https://www.reddit.com/r/Kick/comments/1v3pl73/takes_forever_to_switch_to_another_stream/ · https://www.reddit.com/r/KickStreaming/comments/1vk2dfh/ · https://www.reddit.com/r/Kick/comments/1vlt26z/kicking_kick_to_the_kurb/ · https://www.reddit.com/r/KickStreaming/comments/1vjf4kw/ · https://www.reddit.com/r/KickStreaming/comments/1v4xjqa/ · https://www.reddit.com/r/KickStreaming/comments/1uziegl/

## Open Questions

1. **Is Kick's `websockets.kick.com/viewer/v1/connect` gateway reachable from a page-world content script, or only from an extension service worker?** kick-core reports Cloudflare and CORS block page-context access. If true, the userscript build cannot follow a forced transport migration and would fall back to DOM permanently — which changes how much the transport abstraction is worth. Needs live validation.
2. **Which uBlock Origin filter is breaking Kick signup and follow?** Identifying the specific rule determines whether Kick Focus can detect the condition and tell the user what to unblock, or can only disclaim it. Needs live validation with a filtered profile.
