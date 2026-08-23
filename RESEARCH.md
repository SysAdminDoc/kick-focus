# Research — Kick Focus

Date: **2026-08-23** — replaces all prior research. Reviewed v1.38.0 at [commit 0bad103](https://github.com/SysAdminDoc/kick-focus/commit/0bad103).

## Executive Summary

**Verified.** Kick Focus is a desktop-first, local-only Kick.com viewer layer shipped as a userscript plus Chromium and Firefox companions. Its strongest current shape is the premium Studio/OLED/Slate visual system, a broad settings surface, local emote and viewer tools, multistream, bounded Kick API reads, and zero package dependencies (README.md, package.json, design/screenshots/settings-appearance-themes.png). The offline suite passes 379 of 379 tests, but a fresh 2026-08-23 Chromium run passes only 90 of 96 asserted checks; the six failures cover followed-channel previews, Viewer Hub rendering, and a hidden preload video advancing the watch clock (scripts/verify-extension.mjs). The highest-value direction is to restore trust in the shipped release before adding novelty.

Top opportunities, in priority order:

1. **Verified.** Move remote blocklist authorization out of Kick-controlled localStorage and grant only the exact user-approved feed origin; the current bridge accepts a page-selected HTTPS URL while the manifests cannot fetch arbitrary origins (src/extension/bridge.js, src/extension/bridge.firefox.js, src/extension/background.js, src/extension/background.firefox.js, src/extension/manifest.json, src/extension/manifest.firefox.json, [Chrome cross-origin guidance](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)).
2. **Verified.** Reconnect merged-chat channels after close, silence, sleep, or network recovery; the current close path leaves the slug in connections while syncMergedChat opens only absent slugs (src/live.mjs, [StreamNook #170](https://github.com/winters27/StreamNook/issues/170), [Chatterino #7168](https://github.com/Chatterino/chatterino2/pull/7168)).
3. **Verified.** Close the six current Chromium release-gate failures before another release (scripts/verify-extension.mjs, [v1.38.0 release](https://github.com/SysAdminDoc/kick-focus/releases/tag/v1.38.0)).
4. **Verified.** Measure the userscript and synchronous seed as UTF-8 bytes and restore at least 75,000 bytes of injection reserve; the current total is 987,722 bytes, only 12,278 below Violentmonkey’s approximate 1 MB ceiling (scripts/build.mjs, scripts/check.mjs, src/storage.mjs, [Violentmonkey v2.46.0](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0)).
5. **Likely.** Make one local release command refuse red live checks, stale proof, or mismatched artifacts; v1.38.0 is published while current-head Chromium proof is red and README.md still records an older count (scripts/release-checklist.mjs, README.md, [v1.38.0 release](https://github.com/SysAdminDoc/kick-focus/releases/tag/v1.38.0)).
6. **Verified.** Add behavioral coverage for every settings page and deterministic visual diffs across all three themes; src/settings.mjs is 36.36% line-covered and recent visual work spans routes, themes, overlays, and responsive widths (src/settings.mjs, test/settings.test.js, design/screenshots, [Playwright visual comparisons](https://playwright.dev/docs/next/test-snapshots)).
7. **Verified.** Remove custom app shortcuts and confirmation dialogs while preserving normal widget keyboard behavior and reversible reset; both patterns remain first-class product surfaces (src/core.mjs, src/settings.mjs, src/runtime.js).
8. **Verified.** Complete modal inertness and chat-separator keyboard semantics to match the ARIA patterns the UI already claims (src/runtime.js, [APG modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [APG window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)).
9. **Verified.** Replace Firefox inline page injection with Firefox 128 MAIN-world injection, then run browser-neutral journey contracts in both companions (src/extension/bridge.firefox.js, scripts/build.mjs, scripts/verify-firefox.mjs, [Firefox 128 extension update](https://blog.mozilla.org/addons/2024/07/10/manifest-v3-updates-landed-in-firefox-128/)).
10. **Likely.** After the trust work, add bounded player recovery, native fullscreen chat, and a local notes index; all fit the calm-viewing goal without accounts, remote providers, or new permissions ([SevenTV #1250](https://github.com/SevenTV/Extension/issues/1250), [OverKick](https://greasyfork.org/en/scripts/587473-overkick-cinematic-chat-overlay), [Gumbo #205](https://github.com/Seldszar/Gumbo/issues/205)).

Confidence labels used here: **Verified** means measured in this tree or stated by a primary source. **Likely** means several current signals support the conclusion. **Assumption** means a design choice still needs implementation evidence. **Needs live validation** means a real browser, stream, or account is required.

## Product Map

### Core workflows

- **Verified.** View Kick with denser navigation, three dark themes, layout presets, filters, focus mode, reversible hiding, and per-channel layout memory (README.md, src/core.mjs, src/runtime.js).
- **Verified.** Capture, search, group, favorite, restore, and insert emotes locally without treating public artwork as account entitlement (README.md, src/storage.mjs, src/runtime.js).
- **Verified.** Watch up to nine channels in a local board with focused audio, shareable layouts, merged read-only chat, and Document Picture-in-Picture chat (README.md, src/multistream.mjs, src/live.mjs).
- **Verified.** Read account and channel signals only when Kick’s page already exposes or requests them; missing readings remain unknown instead of becoming false zeroes (README.md, src/api.mjs, src/runtime.js).
- **Verified.** Block separable ad hosts and client-side ad flags through page hooks plus companion network rules while leaving server-stitched media alone (README.md, src/runtime.js, src/extension/background.js, src/extension/background.firefox.js).

### User personas

- **Likely.** The primary users are desktop viewers who want less visual noise, power chatters with large emote libraries, multistream viewers, and people who need stronger contrast or reduced motion; these needs map directly to the shipped settings and README workflows (README.md, src/settings.mjs).

### Platforms and distribution

- **Verified.** Distribution is a self-contained userscript, an unpacked Chromium Manifest V3 companion with Chrome 120 as its floor, and a Firefox Manifest V2 companion with Firefox 120 as its floor (src/metadata.txt, src/extension/manifest.json, src/extension/manifest.firefox.json).
- **Verified.** Consumer store publication and automatic update URLs remain operator-gated; full mobile support is explicitly deferred (ROADMAP.md, Roadmap_Blocked.md, [Chrome distribution guidance](https://developer.chrome.com/docs/extensions/how-to/distribute)).

### Key integrations and data flows

- **Verified.** Settings use userscript-manager or extension storage, the emote library uses IndexedDB with a synchronous seed, and imports are schema-normalized with a rollback copy (src/storage.mjs, src/core.mjs, src/runtime.js).
- **Verified.** The page layer reads selected same-origin Kick endpoints and Kick’s realtime broker, while the companion bridge crosses only narrow message types into privileged extension code (src/api.mjs, src/live.mjs, src/extension/bridge.js, src/extension/background.js).
- **Verified.** No analytics, remote executable code, runtime dependency install, or all-site content-script match is present (package.json, src/metadata.txt, src/extension/manifest.json, scripts/check.mjs).

## Competitive Landscape

### StreamNook, Chatterino, and MultiStream

**Verified.** These projects treat closed or silent chat sockets as recoverable state, using watchdogs, backoff, and explicit status rather than a one-shot connection ([StreamNook v8.4.2](https://github.com/winters27/StreamNook/releases/tag/v8.4.2), [Chatterino #7057](https://github.com/Chatterino/chatterino2/issues/7057), [MultiStream v0.18.15](https://github.com/ilanzgx/multistream/releases/tag/v0.18.15)). Kick Focus should copy the bounded recovery model inside its existing connection map. It should avoid one timer per channel and unbounded reconnect loops (src/live.mjs).

### KickLab

**Verified.** KickLab makes multiview and replay controls central instead of hiding them in settings ([KickLab](https://kicklab.app/), [Firefox versions](https://addons.mozilla.org/en-US/firefox/addon/kicklab/versions/)). Kick Focus should keep its board easy to reach and make recovery controls visible in context. It should avoid remote-account coupling and paid-service dependencies because its current value is local, inspectable behavior (README.md, package.json).

### ZenX, WesUtil, Kick Augmenter, and Mo’Kick

**Verified.** Current viewer extensions compete on playback controls, audio handling, live-edge actions, previews, and convenience around Kick’s player ([ZenX](https://chromewebstore.google.com/detail/zenx/dmineakemlfgkkaimlkbejgnmpdbobgh), [WesUtil](https://chromewebstore.google.com/detail/wesutil/igdnndpfofcemcoellnefdflnmcchmle), [Kick Augmenter](https://chromewebstore.google.com/detail/kick-augmenter/hdhpmccblalleagomabbfnpkbcpojfpd), [Mo’Kick](https://addons.mozilla.org/en-US/firefox/addon/mokick/)). Kick Focus should add only bounded recovery that preserves pause, volume, quality, and VOD state. It should avoid quality-entitlement bypasses, recording, and extreme gain.

### 7TV, BetterTTV, and FrankerFaceZ

**Verified.** The mature chat extensions provide strong emote ergonomics and quickly patch host-page drift; 7TV also added per-channel emote artwork suppression, while FrankerFaceZ traced an uptime mutation storm to repeated identical writes ([7TV #1247](https://github.com/SevenTV/Extension/pull/1247), [BetterTTV v7.7.25](https://github.com/night/betterttv/releases/tag/7.7.25), [FrankerFaceZ #1881](https://github.com/FrankerFaceZ/FrankerFaceZ/issues/1881)). Kick Focus should copy local suppression and equality guards. It should not federate third-party providers or send library data off-origin (src/storage.mjs, src/runtime.js).

### KickEnhance and OverKick

**Verified.** Both show demand for chat that remains usable in native fullscreen, with adjustable placement and opacity ([KickEnhance](https://chromewebstore.google.com/detail/kickenhance/eobmipgghmnbbipfhpemfacnljiflmnj), [OverKick](https://greasyfork.org/en/scripts/587473-overkick-cinematic-chat-overlay)). Kick Focus should restyle or rehost Kick’s native chat so moderation state and accessibility remain intact. It should not rebuild a second chat transcript from scraped messages.

### KickAlert and KickKit

**Verified.** These projects package cross-browser live notifications, quick opening, and multistream entry as focused workflows ([KickAlert](https://github.com/segelferd/kick-alert), [KickKit](https://github.com/ensardev/KickKit)). Kick Focus should keep its local board fast to enter. It should avoid background notifications until there is direct user demand because they add permission, lifecycle, and distraction costs.

### Enhancer

**Verified.** Enhancer’s Kick module shows the value of narrow host matching and explicit platform adapters; its issue history also shows how broad route assumptions break unrelated sites ([Enhancer](https://github.com/enhancer-app/enhancer), [Enhancer #133](https://github.com/enhancer-app/enhancer/issues/133)). Kick Focus should continue route probes and browser capability gates. It should not turn its focused codebase into a general streaming plugin platform.

### TwitchAdSolutions

**Verified.** TwitchAdSolutions demonstrates defensive, fail-open handling for a playback-critical and frequently changing host, including rapid rollback when a strategy fails ([v24](https://github.com/pixeltris/TwitchAdSolutions/releases/tag/v24), [issue #497](https://github.com/pixeltris/TwitchAdSolutions/issues/497)). Kick Focus should keep observable failure states and disable a broken intervention instead of retrying playback indefinitely. It should not claim removal of worker-owned or server-stitched media that it cannot inspect (README.md, Roadmap_Blocked.md).

### Gumbo and KickClipsViewer

**Verified.** Gumbo users ask for searchable notes, while KickClipsViewer shows demand for local clip filtering and history ([Gumbo #205](https://github.com/Seldszar/Gumbo/issues/205), [KickClipsViewer v1.3.1](https://github.com/Meiweif/KickClipsViewer/releases/tag/V1.3.1)). A local all-channel note index fits Kick Focus’s existing notes and storage. Clip downloading and remote history do not.

### Previews for TTV and Alternate Player for Twitch

**Verified.** These adjacent tools make preview state, latency, live-edge return, and player recovery visible instead of automatic and silent ([Previews for TTV](https://addons.mozilla.org/en-US/firefox/addon/previews-for-ttv/), [Alternate Player](https://chromewebstore.google.com/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf)). Kick Focus should expose a compact Recover or Return live action only after sustained evidence. It should never reload a page behind the viewer’s back.

## Reported Issues

**Verified.** The public tracker is enabled but has zero open issues, zero closed issues, zero pull requests, and discussions are disabled as of 2026-08-23 ([repository](https://github.com/SysAdminDoc/kick-focus), [issues](https://github.com/SysAdminDoc/kick-focus/issues), [pull requests](https://github.com/SysAdminDoc/kick-focus/pulls)). There are no filed user reports to rank, dismiss, or mark stale.

**Verified.** Local release evidence is not clean: a fresh Chromium run passes 90 of 96 asserted checks, with three preview failures, two Viewer Hub failures, and one watch-clock failure (scripts/verify-extension.mjs). The same run passes chat pause, theme readability, 200% zoom without horizontal overflow, 198 settings-control target checks, a 3.4 ms recent average apply cycle, and a 24 ms recent average 300-message burst, so those areas are not new roadmap work (scripts/verify-extension.mjs).

**Verified.** The highest-severity code-traced defect is independent of the live gate: openMergedChannel keeps a closed slug in connections, and syncMergedChat therefore never opens that channel again (src/live.mjs).

## Security, Privacy, and Reliability

- **Verified.** The companion remote-blocklist bridge reads the approved-looking URL from Kick-owned localStorage, a Kick page can change that storage and trigger the bridge, and both backgrounds accept any HTTPS URL supplied by the bridge (src/extension/bridge.js, src/extension/bridge.firefox.js, src/extension/background.js, src/extension/background.firefox.js). The manifests do not grant arbitrary feed origins, so arbitrary feeds normally fail; granting all HTTPS hosts would convert this into a page-controlled cross-origin body reader ([Chrome cross-origin guidance](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [Extending a Hand to Attackers](https://www.usenix.org/conference/usenixsecurity23/presentation/kim-young-min)).
- **Verified.** The background fetches do not jointly enforce exact URL equality, redirect refusal, JSON MIME, an 8-second timeout, and a 512 KiB pre-return ceiling (src/extension/background.js, src/extension/background.firefox.js). Authorization belongs in extension-owned storage and exact optional host permission.
- **Verified.** The build and storage guards use JavaScript string length rather than UTF-8 byte length; current userscript plus maximum seed is 987,722 UTF-8 bytes (scripts/build.mjs, scripts/check.mjs, src/storage.mjs). This leaves 12,278 bytes under Violentmonkey’s approximate 1 MB Alternative page mode guidance ([Violentmonkey v2.46.0](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0)).
- **Verified.** Merged-chat recovery is absent after either a close event or a silent socket, and sleep, wake, online, and visibility transitions do not repair the dead map entry (src/live.mjs). Competing chat clients now treat this as table-stakes reliability ([StreamNook #170](https://github.com/winters27/StreamNook/issues/170), [Chatterino #7168](https://github.com/Chatterino/chatterino2/pull/7168)).
- **Verified.** The current privacy baseline is strong: no dependencies, no remote code, Kick-only content matches, narrow extension permissions, local data, and Firefox’s required data-collection declaration set to none (package.json, src/metadata.txt, src/extension/manifest.json, src/extension/manifest.firefox.json, scripts/check.mjs).
- **Verified.** IndexedDB and web storage belong to the kick.com origin and may disappear when site data is cleared; imports and local backups remain the correct recovery boundary ([WHATWG Storage](https://storage.spec.whatwg.org/), [MDN storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), src/storage.mjs, src/core.mjs). Requesting persistent storage would apply to all of kick.com, not just Kick Focus.
- **Verified.** Node 24.19 satisfies the current security floor, but package.json accepts unsupported Node 25 because it has no upper bound ([Node 24.19.0](https://nodejs.org/en/blog/release/v24.19.0), [Node release table](https://nodejs.org/en/about/previous-releases), package.json).

## Architecture Assessment

- **Verified.** src/runtime.js is 12,864 lines and 655,729 bytes. src/settings.mjs proved the host-factory extraction pattern works; the emote workspace is the next coherent boundary because it owns picker state, library views, group actions, and rendering (src/runtime.js, src/settings.mjs, scripts/build.mjs).
- **Verified.** test/settings.test.js contains two direct settings tests. A 2026-08-23 coverage run reports src/settings.mjs at 36.36% lines, 37.50% branches, and 11.63% functions while the whole suite remains 88.87%, 85.75%, and 86.58% (test/settings.test.js, src/settings.mjs, package.json).
- **Verified.** The visual system has current references for main shell, settings, emote picker, and multistream, but release QA is a manual comparison with no deterministic masked pixel or geometry diff (design/mockups, design/screenshots, design/qa, scripts/release-checklist.mjs). **Assumption.** Browser-canvas comparison can keep the new gate dependency-free ([Playwright visual comparisons](https://playwright.dev/docs/next/test-snapshots)).
- **Verified.** Chromium exercises 96 assertions while Firefox runs eight narrower checks, so browser-neutral route, theme, modal, preview, and multistream contracts can drift (scripts/verify-extension.mjs, scripts/verify-firefox.mjs).
- **Verified.** Firefox currently embeds the page bundle as inline source to avoid exposing a stable moz-extension URL, which leaves injection dependent on Kick’s CSP posture (src/extension/bridge.firefox.js, scripts/build.mjs, README.md). Firefox 128 supports manifest-declared MAIN-world scripts without that CSP dependency ([Firefox 128 extension update](https://blog.mozilla.org/addons/2024/07/10/manifest-v3-updates-landed-in-firefox-128/)).
- **Verified.** Settings content already supports English, Spanish, and Portuguese, but popup and manifest strings remain English-only (src/runtime.js, src/extension/popup.html, src/extension/popup.js, src/extension/manifest.json, src/extension/manifest.firefox.json, [Chrome i18n](https://developer.chrome.com/docs/extensions/reference/api/i18n)).
- **Verified.** Existing settings normalization, schema migration, transactional import, bounded stores, API fallbacks, compatibility probes, and equality guards are sound foundations; no replacement data layer or framework is justified (src/core.mjs, src/storage.mjs, src/api.mjs, src/compatibility.mjs).

## Rejected Ideas

- **Verified.** Grant https://*/* to make arbitrary companion feeds work: rejected because the current page-controlled bridge would become a general cross-origin read oracle ([Chrome cross-origin guidance](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), src/extension/bridge.js).
- **Verified.** Self-signed CRX as the primary consumer package: rejected because normal Windows and macOS installs require Chrome Web Store signing or managed policy; keep the unpacked ZIP for local refresh ([Chrome distribution guidance](https://developer.chrome.com/docs/extensions/how-to/distribute)).
- **Verified.** Firefox MV3 migration now: rejected because MAIN-world injection is available in Firefox MV2 and blocking webRequest remains useful; Mozilla still promises notice before MV2 removal ([Mozilla MV2/MV3 update](https://blog.mozilla.org/addons/2024/03/13/manifest-v3-manifest-v2-march-2024-update/)).
- **Verified.** Third-party emote federation, a plugin marketplace, cloud sync, or multi-user state: rejected because each adds remote trust, maintenance, or account semantics to a local single-viewer tool ([7TV](https://github.com/SevenTV/Extension), [Enhancer](https://github.com/enhancer-app/enhancer), package.json, README.md).
- **Verified.** Automatic storage persistence: rejected because persistence covers the whole kick.com origin, including Kick’s own data ([WHATWG Storage](https://storage.spec.whatwg.org/), [MDN storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).
- **Needs live validation.** Audio normalization or gain: deferred until the live harness decodes current Kick video and proves MediaElementAudioSource works without cross-origin failure; demand exists, but an unexercised playback path is not release-ready ([ZenX](https://chromewebstore.google.com/detail/zenx/dmineakemlfgkkaimlkbejgnmpdbobgh), [Kick Augmenter](https://chromewebstore.google.com/detail/kick-augmenter/hdhpmccblalleagomabbfnpkbcpojfpd), scripts/verify-extension.mjs).
- **Verified.** VOD chat replay, clip downloads, notification services, moderation automation, mass-ban, deleted-message archives, and quality-entitlement bypasses: rejected because they require new data retention, permissions, creator powers, or policy risk that do not serve the calm local viewer ([Kick moderation guide](https://help.kick.com/en/articles/10162074-moderation-features-guide), [KickClipsViewer](https://github.com/Meiweif/KickClipsViewer/releases/tag/V1.3.1), README.md).
- **Verified.** Worker interception or claims to remove server-stitched ads: rejected because the current page layer cannot observe the IVS worker’s media path and playback-critical intervention has no safe harness (Roadmap_Blocked.md, README.md, [TwitchAdSolutions #506](https://github.com/pixeltris/TwitchAdSolutions/issues/506)).
- **Verified.** A remote disable feed or automatic update channel: rejected for this pass because publication trust remains an explicit operator decision (Roadmap_Blocked.md, [Refined GitHub hotfix design](https://github.com/refined-github/refined-github/blob/main/source/helpers/hotfix.tsx)).
- **Verified.** Full mobile support remains deferred in ROADMAP.md. The current product and QA contract are desktop-first, so this pass does not duplicate that decision (ROADMAP.md, README.md).

## Sources

### Project and Kick

- https://github.com/SysAdminDoc/kick-focus
- https://github.com/SysAdminDoc/kick-focus/issues
- https://github.com/SysAdminDoc/kick-focus/pulls
- https://github.com/SysAdminDoc/kick-focus/releases/tag/v1.38.0
- https://github.com/KickEngineering/KickDevDocs
- https://github.com/KickEngineering/KickDevDocs/issues
- https://github.com/KickEngineering/KickDevDocs/discussions/312
- https://github.com/KickEngineering/KickDevDocs/discussions/214
- https://github.com/KickEngineering/KickDevDocs/blob/main/events/event-types.md
- https://help.kick.com/en/articles/14994494-how-to-use-kick-chat-as-a-viewer
- https://help.kick.com/en/articles/14994226-browser-compatibility-and-recommended-settings-for-kick
- https://help.kick.com/en/articles/10162074-moderation-features-guide
- https://help.kick.com/en/articles/14994597-the-kick-mobile-app-a-viewers-guide

### Direct and commercial competitors

- https://kicklab.app/
- https://addons.mozilla.org/en-US/firefox/addon/kicklab/versions/
- https://github.com/winters27/StreamNook/issues/170
- https://github.com/winters27/StreamNook/releases/tag/v8.4.2
- https://github.com/Chatterino/chatterino2/issues/7057
- https://github.com/Chatterino/chatterino2/pull/7168
- https://github.com/ilanzgx/multistream
- https://github.com/ilanzgx/multistream/releases/tag/v0.18.15
- https://github.com/segelferd/kick-alert
- https://github.com/segelferd/kick-alert/releases/tag/v2.4.0
- https://github.com/ensardev/KickKit
- https://github.com/SevenTV/Extension
- https://github.com/SevenTV/Extension/pull/1247
- https://github.com/night/betterttv/releases/tag/7.7.25
- https://github.com/FrankerFaceZ/FrankerFaceZ/issues/1881
- https://github.com/enhancer-app/enhancer
- https://github.com/enhancer-app/enhancer/issues/133
- https://github.com/pixeltris/TwitchAdSolutions/releases/tag/v24
- https://github.com/pixeltris/TwitchAdSolutions/issues/497
- https://github.com/pixeltris/TwitchAdSolutions/issues/506
- https://github.com/Seldszar/Gumbo/issues/205
- https://github.com/Meiweif/KickClipsViewer/releases/tag/V1.3.1
- https://chromewebstore.google.com/detail/zenx/dmineakemlfgkkaimlkbejgnmpdbobgh
- https://chromewebstore.google.com/detail/wesutil/igdnndpfofcemcoellnefdflnmcchmle
- https://chromewebstore.google.com/detail/kick-augmenter/hdhpmccblalleagomabbfnpkbcpojfpd
- https://addons.mozilla.org/en-US/firefox/addon/mokick/
- https://chromewebstore.google.com/detail/kickenhance/eobmipgghmnbbipfhpemfacnljiflmnj
- https://greasyfork.org/en/scripts/587473-overkick-cinematic-chat-overlay
- https://addons.mozilla.org/en-US/firefox/addon/previews-for-ttv/
- https://chromewebstore.google.com/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf

### Community and ecosystem

- https://greasyfork.org/en/scripts/by-site/kick.com
- https://www.reddit.com/r/browserextensions/comments/1s4zs0h/i_built_kickalert_a_free_chromefirefox_extension/
- https://www.reddit.com/r/KickStreaming/comments/1p0eauv/theres_so_many_websitefunctionalityuseability/
- https://www.reddit.com/r/KickStreaming/comments/14ewoxq
- https://www.reddit.com/r/KickStreaming/comments/14d13ne
- https://www.reddit.com/r/KickStreaming/comments/14dumxy
- https://www.reddit.com/r/KickStreaming/comments/1femv6m
- https://www.reddit.com/r/7TV/comments/1fe02qt
- https://www.reddit.com/r/KickStreaming/comments/1r0xmtb/what_frustrates_you_most_about_live_streaming/
- https://news.ycombinator.com/item?id=36366459
- https://github.com/jupjohn/awesome-twitch-stuff
- https://github.com/juancarlospaco/awesome-streaming-tools
- https://github.com/NextNextStep/awesome-live-streaming
- https://github.com/tucktuckg00se/awesome-video-broadcasting

### Browser, accessibility, and packaging

- https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies
- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- https://developer.chrome.com/docs/extensions/reference/api/storage
- https://developer.chrome.com/docs/extensions/reference/api/i18n
- https://developer.chrome.com/docs/extensions/how-to/distribute
- https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities
- https://blog.mozilla.org/addons/2024/07/10/manifest-v3-updates-landed-in-firefox-128/
- https://blog.mozilla.org/addons/2024/03/13/manifest-v3-manifest-v2-march-2024-update/
- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
- https://html.spec.whatwg.org/multipage/interaction.html#the-inert-attribute
- https://playwright.dev/docs/next/test-snapshots
- https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0
- https://github.com/violentmonkey/violentmonkey/releases/tag/v2.47.0
- https://nodejs.org/en/blog/release/v24.19.0
- https://nodejs.org/en/about/previous-releases
- https://nodejs.org/en/blog/vulnerability/july-2026-security-releases
- https://www.mozilla.org/en-US/security/advisories/mfsa2026-68/

### Storage and security research

- https://storage.spec.whatwg.org/
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://www.usenix.org/conference/usenixsecurity23/presentation/kim-young-min
- https://www.usenix.org/conference/usenixsecurity21/presentation/laperdrix
- https://swag.cispa.saarland/papers/fass2021doublex.pdf
- https://doi.org/10.1145/3460120.3484745
- https://publications.cispa.saarland/3756/1/sp23_domclob.pdf
- https://doi.org/10.1145/3719027.3765117

## Open Questions

**Verified.** None blocks this prioritization. Authenticated viewer validation, userscript-manager cold starts, stitched-ad instrumentation, update publication, prediction payloads, loyalty reads, emote-completion key capture, first-run guidance, and the date-gated Chrome 153 fixture recapture remain explicitly parked in Roadmap_Blocked.md and are not duplicated here.
