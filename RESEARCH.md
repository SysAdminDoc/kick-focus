# Research - Kick Focus

Date: **2026-08-23**. This document replaces all prior research. The product baseline is v1.38.0 plus companion hardening and merged-chat recovery through commit [`e00a20d`](https://github.com/SysAdminDoc/kick-focus/commit/e00a20d).

## Executive Summary

Kick Focus already has a capable profile comment emote workspace. The comment-box picker supports Favorites, Recent, All, native Kick emotes, custom groups, search recovery, group creation and editing, batch organization, per-channel favorite scope, a windowed 2,400-item grid, and insertion through Kick's native composer. The separate Library adds import, rollback, provenance, and broad recovery controls. Rebuilding that surface or adding another provider would make it harder to use without solving its remaining problems (`src/runtime.js:4832-5752`, `src/settings.mjs:430-690`, `src/storage.mjs`, `test/boot.test.js:516-549`).

The primary opportunity is to turn the picker from a compact catalog into a dependable comment-writing tool. Five issues matter most:

1. **Verified. Removed emotes cannot be restored individually from the picker.** A `showHidden` state and handler exist, but no visible control is rendered. After the seven-second Undo expires, the Library offers only Restore all (`src/runtime.js:5052-5055`, `src/runtime.js:5548-5556`, `src/runtime.js:5715-5718`, `src/settings.mjs:502`).
2. **Verified. Picker rerenders can discard focus.** `renderStickerOrganizer()` replaces its controls after most mutations. Only the group-name input has an explicit focus restoration path (`src/runtime.js:4983-5160`, `src/runtime.js:5369-5379`).
3. **Verified. The picker and Library use different destructive-action semantics.** Picker group deletion and batch changes offer Undo. Library group deletion and batch changes do not. Picker Remove hides an emote, while Library Remove deletes it until the next discovery (`src/runtime.js:5433-5542`, `src/runtime.js:10525-10619`).
4. **Verified. Direct live coverage is too shallow for the main workflow.** The browser verifier covers windowing and a favorite patch. Most group, removal, recovery, focus, insertion, and no-submit behavior is checked only through source markers or pure tests (`scripts/verify-extension.mjs:3265-3362`, `test/boot.test.js:516-549`).
5. **Likely. The fastest path to a comment is still one interaction too long.** Mature viewer tools keep favorites and recent emotes close to composition. Kick Focus makes the user open the full picker first ([WesUtil](https://chromewebstore.google.com/detail/wesutil/igdnndpfofcemcoellnefdflnmcchmle), [kick-third-party-emotes](https://github.com/jakubn11/kick-third-party-emotes), [NipahTV](https://github.com/Xzensi/NipahTV)).

The rest of the product is healthy enough to improve rather than replace. On 2026-08-23, the offline suite passed 399 of 399 tests. The verification command passed 194 checks and fired 81 intended red probes. Instrumented coverage was 89.84% for lines, 85.25% for branches, and 87.65% for functions. The fresh Chromium journey passed 89 of 96 checks, while Firefox passed 8 of 8 narrower checks (`package.json`, `scripts/verify-extension.mjs`, `scripts/verify-firefox.mjs`).

Two release risks should land before large additions. The userscript plus maximum synchronous seed consumes 995,215 UTF-8 bytes, leaving 4,785 bytes below Violentmonkey's approximate 1 MB alternative-injection boundary. The build and seed guards currently use JavaScript string length, so their displayed count is 1,703 bytes low for the present artifact (`scripts/build.mjs`, `scripts/check.mjs`, `src/storage.mjs`, [Violentmonkey 2.46.0](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0)). The Chromium journey also has seven current failures in previews, Viewer Hub cards, chat pause geometry, and watch-clock ownership (`scripts/verify-extension.mjs`, `CLAUDE.md`).

Recommended order:

1. Enforce the true UTF-8 package budget and restore release headroom through R-102.
2. Repair current browser-gate failures and make the local release command refuse stale or red evidence through R-99 to R-103.
3. Establish full comment-picker workflow automation through R-122.
4. Unify picker and Library mutations, then preserve focus and comment drafts through R-120 and R-121.
5. Add individual removed-emote recovery through R-119.
6. Prevent stale tabs from overwriting newer emote state through R-123.
7. Add a compact channel-aware favorite shelf beside the native comment workflow through R-124.
8. Make group ordering, richer search, and one-emote assignment direct through R-125 to R-127.
9. Improve the Library return path, narrow-width management affordances, and local diagnostics through R-128 to R-130.
10. Finish the companion's response-size boundary with incremental reads through R-131.

Confidence labels used below:

- **Verified** means measured in this repository, observed in the isolated browser audit, or stated by a primary source.
- **Likely** means multiple current signals support the conclusion, but the exact benefit needs product measurement.
- **Needs live validation** means a signed-in Kick account, active stream, entitlement, or current production DOM is required.

## Product Map

### Product and users

Kick Focus is a desktop-first local viewer layer for Kick.com. It ships as a userscript and as Chromium and Firefox companions. Its main users are viewers who want a calmer page, frequent chatters with large emote collections, multistream viewers, and people who need reduced motion or stronger contrast (`README.md`, `src/settings.mjs`, `src/extension/manifest.json`, `src/extension/manifest.firefox.json`).

The product stores settings, channel notes, filters, viewer state, and emote metadata locally. It has no package dependencies, analytics SDK, account service, or remote executable code (`package.json`, `src/storage.mjs`, `scripts/check.mjs`, `src/metadata.txt`).

### Main workflows

| Workflow | Current behavior | Primary code |
|---|---|---|
| Profile comments | Opens a Kick-native anchored picker, searches local and native emotes, inserts into the existing composer, and never submits | `src/runtime.js:4832-5752` |
| Emote organization | Favorites, Recent, All, custom groups, create, rename, delete, select shown, move, remove, and picker Undo | `src/runtime.js:4983-5542` |
| Full emote Library | Browses, filters, batch edits, imports, restores, and inspects provenance | `src/settings.mjs:430-690`, `src/runtime.js:10380-10620` |
| Discovery and storage | Observes Kick emotes, normalizes descriptors, persists IndexedDB state, and keeps a bounded synchronous seed | `src/storage.mjs`, `src/runtime.js` |
| Viewing | Applies dark themes, density, focus mode, filters, layout memory, and reversible page cleanup | `src/core.mjs`, `src/runtime.js`, `src/settings.mjs` |
| Multistream | Opens up to nine channels with focused audio, board layouts, merged read-only chat, and local sharing | `src/multistream.mjs`, `src/live.mjs` |
| Viewer context | Reads only Kick state already available to the page and keeps unavailable values unknown | `src/api.mjs`, `src/runtime.js` |
| Companion bridge | Handles narrow privileged tasks for extension storage, blocker rules, and a configured feed | `src/extension/bridge.js`, `src/extension/background.js`, Firefox equivalents |

### Profile comment emote flow

The profile comment picker delegates to Kick's existing composer instead of replacing it. This preserves Kick's own focus, moderation, account state, and submit path. Selecting an emote inserts text but does not send the comment (`src/runtime.js:5662-5752`, `scripts/verify-extension.mjs:3265-3362`). This is the correct architecture.

The picker is anchored to the host control and supports native popover behavior where available. Its desktop presentation is polished at 1440 pixels. At 900 pixels it remains usable, but top actions collapse to icon-only controls. Tile Favorite and Remove tools are mostly discoverable on hover or focus. The 680-pixel settings navigation can clip labels and does not provide a strong horizontal-scroll cue (`design/qa/emote-picker-all-v1.38.png`, `design/qa/emote-picker-narrow-v1.38.png`, `design/qa/settings-responsive-680.jpg`).

The full Library is useful for bulk work, but it acts like a destination rather than an extension of the current comment. Its generic Done action does not explicitly return to the comment, restore the original picker state, or promise focus on the native composer (`src/settings.mjs`, `src/runtime.js`).

### Data boundaries

- **Verified.** Emote metadata and user organization are local. Public artwork is not treated as proof of subscription entitlement (`src/storage.mjs`, `src/runtime.js`).
- **Verified.** Import is normalized and keeps a pre-import rollback copy (`src/core.mjs`, `src/storage.mjs`).
- **Verified.** Reset preserves emote provenance rather than erasing discovered identity (`src/core.mjs`, `src/settings.mjs`).
- **Verified.** The 2,400-item picker is windowed, which is appropriate for large local catalogs (`src/runtime.js`, `scripts/verify-extension.mjs:3265-3362`).
- **Verified.** The app supports English, Spanish, and Portuguese inside the main UI. Popup and manifest localization remain incomplete (`src/runtime.js`, `src/extension/popup.html`, both manifests).

### Distribution and support

Chromium uses Manifest V3 and Chrome 120 as its declared floor. Firefox uses Manifest V2 and Firefox 120 as its declared floor. The userscript targets Kick pages through userscript-manager metadata (`src/extension/manifest.json`, `src/extension/manifest.firefox.json`, `src/metadata.txt`). Store publication, automatic updates, and full mobile support remain parked in `Roadmap_Blocked.md`.

## Competitive Landscape

### Kick native product and API

Kick provides channel emotes, subscriber emotes, badges, channel points, rewards, profile comments, and subscription context. Its public developer API does not expose a general viewer emote-library read endpoint, and that omission remains requested in the public tracker ([Kick emotes](https://help.kick.com/en/articles/7139129-how-to-upload-emotes-to-kick), [Kick subscriptions](https://help.kick.com/en/articles/7066931-how-to-subscribe-to-a-kick-creator), [Kick developer docs](https://docs.kick.com/), [kickdevdocs issue 323](https://github.com/KickEngineering/KickDevDocs/issues/323)). Kick Focus should continue observing the first-party page and native composer. It should not switch this workflow to an API that does not provide the required data.

### KickLab

KickLab makes multiview, playback controls, and viewer convenience prominent instead of burying them in configuration ([KickLab](https://kicklab.app/), [KickLab Firefox versions](https://addons.mozilla.org/en-US/firefox/addon/kicklab/versions/)). Kick Focus should learn from its direct entry points. It should keep account services and remote dependencies out of the local emote path.

### WesUtil and kick-third-party-emotes

These extensions emphasize fast access to favorites, recent emotes, and usage-ranked completion near chat ([WesUtil](https://chromewebstore.google.com/detail/wesutil/igdnndpfofcemcoellnefdflnmcchmle), [kick-third-party-emotes](https://github.com/jakubn11/kick-third-party-emotes)). The useful lesson is not another custom chat box. It is a short channel-aware favorites shelf that delegates insertion to Kick's native composer.

### NipahTV

NipahTV proves demand for broader emote availability and integrated chat discovery ([NipahTV](https://github.com/Xzensi/NipahTV)). Kick Focus should copy the low-friction placement and clear source labels. It should not add remote provider federation because local first-party organization is its clearer product boundary.

### 7TV, BetterTTV, and FrankerFaceZ

Mature chat extensions set a high bar for search, favorites, per-channel behavior, keyboard accessibility, and resilience to host changes ([7TV Extension](https://github.com/SevenTV/Extension), [BetterTTV](https://github.com/night/betterttv), [FrankerFaceZ](https://github.com/FrankerFaceZ/FrankerFaceZ)). Their maintenance history also shows the cost of becoming a general emote platform. Kick Focus should adopt predictable ranking, equality guards, and compact access without taking on provider accounts or remote sync.

### Chatterino, Chatty, and Frosty

Dedicated chat clients keep conversation state visible, treat dropped connections as recoverable, and offer mature emote navigation ([Chatterino](https://github.com/Chatterino/chatterino2), [Chatty](https://github.com/chatty/chatty), [Frosty](https://github.com/tommyxchow/frosty)). Kick Focus should copy deterministic state recovery and visible status. It should retain the browser's native comment and moderation surface.

### Enhancer, Mo'Kick, uKick, and Kick Augmenter

These tools compete through small controls around playback, chat, and layout ([Enhancer](https://github.com/enhancer-app/enhancer), [Mo'Kick](https://addons.mozilla.org/en-US/firefox/addon/mokick/), [uKick](https://github.com/ckalgos/uKick), [Kick Augmenter](https://chromewebstore.google.com/detail/kick-augmenter/hdhpmccblalleagomabbfnpkbcpojfpd)). Their breadth validates demand, but also raises route-drift and permission costs. Kick Focus should keep each addition observable, reversible, and host-native.

### Slack, Google Chat, and Microsoft Teams

Workplace messaging products treat emoji and sticker organization as a frequent-message workflow. Search, recent use, favorites, custom collections, and immediate recovery are placed near composition rather than in a distant settings page ([Slack emoji](https://slack.com/help/articles/202931348-Use-emoji-and-reactions), [Google Chat reactions](https://support.google.com/chat/answer/7654371), [Microsoft Teams emoji and GIFs](https://support.microsoft.com/en-us/office/send-an-emoji-gif-or-sticker-in-microsoft-teams-174248c9-e64d-4de1-9f41-3199cc0751ad)). Kick Focus should apply that composition-first model while avoiding stickers, GIF search, and remote content services.

### Awesome lists and adjacent projects

**Likely.** The relevant browser-extension, userscript, Twitch, and streaming-tool indexes contain many focused tools and no common plugin contract that would reduce Kick Focus's integration burden ([awesome-webextension](https://github.com/fregante/Awesome-WebExtensions), [awesome-userscripts](https://github.com/bvolpato/awesome-userscripts), [awesome-twitch-stuff](https://github.com/berstend/awesome-twitch-stuff), [awesome-streaming-tools](https://github.com/streamer-tools/awesome-streaming-tools)). Kick Focus already has the narrower shape. A plugin marketplace or generalized automation layer would add compatibility work without solving the comment-picker gaps.

## Reported Issues

The public repository has no open or closed issues, no pull requests, and no discussions as of 2026-08-23. There is not enough public user-report volume to derive priority from tracker counts ([repository](https://github.com/SysAdminDoc/kick-focus), [issues](https://github.com/SysAdminDoc/kick-focus/issues), [pull requests](https://github.com/SysAdminDoc/kick-focus/pulls)).

The code and browser evidence identify the following defects:

- **Verified.** Seven Chromium journey checks currently fail: three followed-preview checks, two Viewer Hub card checks, chat pause geometry, and active-player ownership for the watch clock (`scripts/verify-extension.mjs`, `CLAUDE.md`).
- **Verified.** The README's published Chromium proof is stale and disagrees with the current local run (`README.md`, `scripts/release-checklist.mjs`).
- **Verified.** Removed-emote recovery is all-or-nothing once picker Undo expires (`src/runtime.js:5052-5055`, `src/settings.mjs:502`).
- **Verified.** Library and picker mutations can produce different recovery outcomes for the same user intent (`src/runtime.js:5433-5542`, `src/runtime.js:10525-10619`).
- **Verified.** Most picker rerenders do not restore the active control (`src/runtime.js:4983-5160`, `src/runtime.js:5369-5379`).
- **Likely.** Two open Kick tabs can overwrite one another because emote changes lack a convergence listener and commit whole normalized state (`src/storage.mjs`, `src/runtime.js`).
- **Verified.** Custom groups can be created and deleted but not reordered. New groups append and deleted groups splice from their current position (`src/runtime.js`, `src/storage.mjs`).
- **Verified.** Assigning one emote to a group still requires entering Organize, selecting the emote, choosing a destination, and pressing Move (`src/runtime.js:5162-5542`).
- **Verified.** Picker search matches the descriptor name. Library search also considers source and grouping context, so identical searches can disagree (`src/runtime.js`, `src/settings.mjs`).
- **Needs live validation.** The latest signed-in profile comment and reply DOM, gift-entitlement states, and route transitions were not available in the isolated fixture audit.

Related client trackers report emote rendering loss after host-page changes, failed catalog refreshes, and reconnect loss. These support recovery tests and last-good local state. They do not justify remote accounts or automatic submission ([7TV issue 1219](https://github.com/SevenTV/Extension/issues/1219), [Chatterino issue 7133](https://github.com/Chatterino/chatterino2/issues/7133), [Chatterino issue 7057](https://github.com/Chatterino/chatterino2/issues/7057)).

## Security, Privacy, and Reliability

### Companion feed authorization

Commit `29f7584` moved feed approval into extension-owned storage, requests one optional origin from the popup, pins each fetch to the exact approved URL, omits credentials, rejects redirects and non-JSON responses, and applies an eight-second timeout in both browsers (`src/extension/background.js`, `src/extension/background.firefox.js`, both manifests, `test/companion.test.js`). This closes R-97 and prevents a Kick page from choosing an arbitrary cross-origin target ([Chrome cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [Chrome optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions), [USENIX extension boundary study](https://www.usenix.org/conference/usenixsecurity23/presentation/kim-young-min)).

One response-bound gap remains. Both backgrounds reject a declared body above 512 KiB, then call `response.arrayBuffer()` and check its size. A server that omits or lies about Content-Length can still force allocation of the complete response before rejection. R-131 replaces that final read with incremental bounded consumption (`src/extension/background.js`, `src/extension/background.firefox.js`, `test/companion.test.js`).

### Emote state integrity

Picker and Library writes should share one command layer. Each mutation needs a version, normalized input, explicit inverse, and equality guard. This addresses inconsistent Undo, stale-tab overwrites, and repeated full-state writes without introducing remote synchronization (`src/runtime.js`, `src/settings.mjs`, `src/storage.mjs`, [WHATWG Storage](https://storage.spec.whatwg.org/)).

Diagnostics should report sanitized counts and state, never emote names or comment drafts. Useful fields are current view, catalog count, favorite count, group count, removed count, storage provider, window range, last successful mutation, and last local error (`src/runtime.js`, `src/storage.mjs`).

### Injection and package limits

The userscript filesystem size is 845,215 UTF-8 bytes and the maximum synchronous seed is 150,000 bytes. Their total is 995,215 bytes. Build output reports 843,512 because it uses string length. Seed planning uses the same faulty unit, so multibyte emote names can exceed the advertised limit (`scripts/build.mjs`, `scripts/check.mjs`, `src/storage.mjs`). R-102 should make all guards byte-accurate and reserve at least 75,000 bytes.

### Privacy baseline

The privacy baseline is strong. There are zero package dependencies, no analytics, no remote code loader, Kick-only content matching, local settings, local emote data, and a Firefox data-collection declaration of none (`package.json`, `src/metadata.txt`, both manifests, `scripts/check.mjs`). A local secret scan found only high-entropy base64 resources inside untracked saved-page fixtures. No tracked secret finding was identified.

## Architecture Assessment

### Build shape

`scripts/build.mjs` concatenates ordered source modules into the userscript and companion bundles. `src/runtime.js` remains the dominant module at 12,880 lines and 656,191 bytes. The factory extraction used by `src/settings.mjs` is the right precedent for R-114, which should move the emote workspace behind a host-injected factory without changing behavior (`scripts/build.mjs`, `src/runtime.js`, `src/settings.mjs`).

R-114 is an enabling refactor, not a prerequisite for every usability fix. Recovery and focus work can land safely if the new mutation commands have pure tests and a narrow host contract. The extraction should then move those commands rather than add wrappers.

### Test posture

The Node suite passes 399 of 399 tests. Overall instrumented coverage is 89.84% for lines, 85.25% for branches, and 87.65% for functions, but `src/settings.mjs` has 36.36% line coverage and 11.63% function coverage. Runtime browser behavior is not represented by that instrumentation (`package.json`, `test/settings.test.js`, coverage output from 2026-08-23).

The comment picker has good pure and static checks for normalization, windowing, and source wiring. It lacks a complete browser journey for create, rename, delete, Undo, select shown, move, remove, restore, search empty state, return from Library, insertion without submission, focus retention, and narrow layout (`scripts/verify-extension.mjs:3265-3362`, `test/boot.test.js:516-549`). This is the first profile-picker roadmap item because it converts the user's main workflow into a release contract.

Chromium owns 96 journey checks. Firefox owns eight narrower checks. Browser-neutral comment-picker contracts should run against both companion builds after R-111 establishes the shared harness (`scripts/verify-extension.mjs`, `scripts/verify-firefox.mjs`).

### Visual audit

The existing v1.38 picker matches the project's dark visual system and reads as part of Kick rather than a replacement product. Group tabs, search, counts, selection state, and primary actions have clear hierarchy at desktop width (`design/qa/emote-picker-all-v1.38.png`, `design/screenshots/emote-picker.png`, `design/screenshots/emote-library.png`).

The audit found four residual design problems:

- Management actions on an emote tile are hidden until hover or focus, which makes organization harder to discover.
- Narrow picker actions collapse to icons. Accessible names remain, but the visible meaning is weaker.
- Settings navigation clips at 1440 pixels in one reference and has a weak overflow cue at 680 pixels.
- Diagnostics display the stale string-length bundle count rather than the UTF-8 size.

These are targeted adjustments. A new design system, modal picker, custom composer, drag-only group ordering, and global keyboard shortcuts would create more problems than they solve.

### Maintenance signals

The codebase contains no production TODO, FIXME, HACK, XXX, deprecated, or unimplemented markers. From 2026-08-17 through 2026-08-23, the project shipped 20 releases, and runtime churn was high. That pace makes local release evidence, visual diffs, and focused workflow contracts more valuable than adding another broad feature surface ([releases](https://github.com/SysAdminDoc/kick-focus/releases), `git log`, `scripts/release-checklist.mjs`).

`package.json` declares no runtime or development dependencies, so no package dependency changelog or package CVE maps directly to this build. Browser, userscript-manager, and Node platform changes remain relevant (`package.json`, [Node releases](https://nodejs.org/en/about/previous-releases), [Chrome releases](https://chromereleases.googleblog.com/), [Mozilla advisories](https://www.mozilla.org/en-US/security/advisories/)).

The category review is complete. Security and response-bound handling map to R-131. Accessibility maps to R-108, R-109, R-121, R-122, and R-129. Localization is already R-112. Diagnostics map to R-130, testing to R-104, R-105, R-111, and R-122, and documentation plus packaging to R-103. Merged-chat resilience was completed at `e00a20d`; local multi-tab resilience maps to R-123. Existing schema normalization and import rollback provide the migration path for R-120 (`ROADMAP.md`, `src/core.mjs`, `src/storage.mjs`). Plugin ecosystems, remote multi-user data, and cloud sync are rejected below. Mobile and store distribution remain deferred in `Roadmap_Blocked.md`.

## Rejected Ideas

- **Third-party emote federation:** rejected because it adds provider accounts, policy drift, remote availability, and new privacy obligations. The first-party local workspace still has direct usability work.
- **Remote cloud sync:** rejected because cross-tab local convergence solves the immediate overwrite risk without creating identity, encryption, retention, and recovery services.
- **A custom comment composer:** rejected because the native composer owns moderation, account state, submission, replies, and accessibility. Kick Focus should only insert.
- **A modal replacement picker:** rejected because the anchored native-adjacent surface preserves comment context and performs well at current widths.
- **A plugin marketplace:** rejected because the project has a focused zero-dependency architecture. A marketplace would expand permissions and compatibility work.
- **Switching emote discovery to the official API:** rejected because no general viewer emote-library endpoint exists ([Kick developer docs](https://docs.kick.com/), [kickdevdocs issue 323](https://github.com/KickEngineering/KickDevDocs/issues/323)).
- **Automatic comment sending or an offline outgoing queue:** rejected because insertion without submission is a deliberate safety boundary.
- **Full moderation and bot controls:** rejected because Kick's native controls already own permissions and enforcement.
- **AI captions, translation, and generated replies:** rejected because they require remote content processing and do not improve emote organization.
- **Custom page-wide keyboard shortcuts:** rejected because they conflict with the host page and the repository's interaction policy. Standard widget keyboard behavior remains required.
- **Remote kill feeds, Web Audio compression, SSAI bypass, and entitlement bypass:** rejected because they increase security or playback risk and weaken product trust.
- **Mobile and store publication in this pass:** deferred in `Roadmap_Blocked.md` until the product's desktop release evidence and distribution decisions are ready.

## Sources

### 1. Official Kick product and help

- https://help.kick.com/en/articles/7139129-how-to-upload-emotes-to-kick
- https://help.kick.com/en/articles/7066931-how-to-subscribe-to-a-kick-creator
- https://help.kick.com/en/articles/7137869-how-to-use-the-kick-chat
- https://help.kick.com/en/articles/7120563-kick-creator-dashboard
- https://help.kick.com/en/articles/8894103-channel-points
- https://help.kick.com/en/articles/10162074-channel-point-rewards
- https://help.kick.com/en/articles/7137837-chat-badges
- https://help.kick.com/en/articles/7137854-browser-support

### 2. Official Kick developer platform

- https://docs.kick.com/
- https://github.com/KickEngineering/KickDevDocs
- https://github.com/KickEngineering/KickDevDocs/issues/323
- https://github.com/KickEngineering/KickDevDocs/issues/84
- https://github.com/KickEngineering/KickDevDocs/issues/110
- https://github.com/KickEngineering/KickDevDocs/issues/315
- https://github.com/KickEngineering/KickDevDocs/issues/352
- https://github.com/KickEngineering/KickDevDocs/issues/390
- https://github.com/KickEngineering/KickDevDocs/issues/403

### 3. Kick viewer and emote tools

- https://kicklab.app/
- https://addons.mozilla.org/en-US/firefox/addon/kicklab/versions/
- https://chromewebstore.google.com/detail/wesutil/igdnndpfofcemcoellnefdflnmcchmle
- https://github.com/Xzensi/NipahTV
- https://github.com/jakubn11/kick-third-party-emotes
- https://github.com/ckalgos/uKick
- https://addons.mozilla.org/en-US/firefox/addon/mokick/
- https://github.com/enhancer-app/enhancer
- https://chromewebstore.google.com/detail/kick-augmenter/hdhpmccblalleagomabbfnpkbcpojfpd

### 4. Mature chat and streaming projects

- https://github.com/SevenTV/Extension
- https://github.com/night/betterttv
- https://github.com/FrankerFaceZ/FrankerFaceZ
- https://github.com/Chatterino/chatterino2
- https://github.com/chatty/chatty
- https://github.com/tommyxchow/frosty
- https://github.com/winters27/StreamNook
- https://github.com/ilanzgx/multistream
- https://github.com/Seldszar/Gumbo
- https://github.com/SevenTV/Extension/issues/1250
- https://github.com/SevenTV/Extension/issues/1219
- https://github.com/Chatterino/chatterino2/issues/7133
- https://github.com/Chatterino/chatterino2/issues/7057

### 5. Adjacent composition products and community

- https://slack.com/help/articles/202931348-Use-emoji-and-reactions
- https://support.google.com/chat/answer/7654371
- https://support.microsoft.com/en-us/office/send-an-emoji-gif-or-sticker-in-microsoft-teams-174248c9-e64d-4de1-9f41-3199cc0751ad
- https://www.reddit.com/r/KickStreaming/
- https://github.com/berstend/awesome-twitch-stuff
- https://github.com/bvolpato/awesome-userscripts
- https://github.com/streamer-tools/awesome-streaming-tools
- https://github.com/fregante/Awesome-WebExtensions

### 6. Accessibility and web standards

- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
- https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- https://html.spec.whatwg.org/multipage/popover.html
- https://storage.spec.whatwg.org/
- https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/read

### 7. Browser extension platforms

- https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- https://developer.chrome.com/docs/extensions/reference/api/permissions
- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- https://developer.chrome.com/docs/extensions/reference/api/storage
- https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities
- https://blog.mozilla.org/addons/2024/07/10/manifest-v3-updates-landed-in-firefox-128/

### 8. Userscript managers and runtime tooling

- https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0
- https://violentmonkey.github.io/api/metadata-block/
- https://www.tampermonkey.net/documentation.php
- https://nodejs.org/en/blog/release/v24.19.0
- https://nodejs.org/en/about/previous-releases
- https://playwright.dev/docs/test-snapshots

### 9. Security research and advisories

- https://www.usenix.org/conference/usenixsecurity23/presentation/kim-young-min
- https://www.usenix.org/conference/usenixsecurity24/presentation/zhang-yue
- https://arxiv.org/abs/1901.03397
- https://arxiv.org/abs/2406.12710
- https://chromereleases.googleblog.com/
- https://www.mozilla.org/en-US/security/advisories/

## Open Questions

1. **Needs live validation.** Does the current signed-in profile comment and reply composer retain the same button ownership, draft model, and focus behavior after client-side route changes?
2. **Needs live validation.** How do subscriber, gifted, follower-only, and unavailable emotes appear in the first-party comment surface, and which states can be observed without inferring entitlement?
3. **Needs live validation.** What is the real userscript-manager overhead once the 150,000-byte synchronous seed is embedded, escaped, and injected under current Violentmonkey and Tampermonkey modes?
