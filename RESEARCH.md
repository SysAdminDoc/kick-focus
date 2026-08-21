# Research — Kick Focus

Date: **2026-08-21** — replaces all prior research. Against **v1.31.0** (HEAD `db23871`, 2026-08-20). Differential pass: the 2026-08-20 inventory still holds; this file records what that pass left open, what was re-measured, and the three items that were not on the backlog.

## Executive Summary

Kick Focus remains a desktop-only, zero-dependency Kick.com client mod. v1.27.0–v1.31.0 already shipped Viewer Hub, My Emotes, chat comfort, saved views, presets/custom accent, StreamerStats popup, and the Studio visual system. The GitHub tracker is still empty (issues on, discussions off, zero issues or PRs ever). Product demand is still inferred from competitors and Kick help, not from filed reports.

The 24 hours after the 2026-08-20 pass were quiet: no competitor commits, no CWS version bumps after 2026-08-18, no Greasy Fork Kick scripts dated 2026-08-20 or 2026-08-21, no Node 24.20. The userscript is still **970,899 / 1,000,000 B**. R-72–R-89 stay the primary backlog; do not re-implement Viewer Hub or chat-left as new work.

Highest-value direction is unchanged: **keep the userscript injectable, keep ads claims honest, then add the layout/chat comforts already queued.** New this pass: hide rules must fail closed when a probe is not the recorded winner, and the 1 MB Violentmonkey ceiling must count the synchronous library seed, not only `dist/kick-focus.user.js`.

Top opportunities, in order (existing IDs first, then this pass):

1. Cut userscript size below 85% of 1 MB (R-72).
2. Gate userscript + seed bytes against the same 1 MB ceiling (R-91).
3. State Kick’s contradictory ads-vs-subscription claims; both articles still live 2026-08-21 (R-73).
4. Keep the CSP live-gate (R-74). GET `/`, `/xqc`, `www.kick.com/`, and `player.kick.com/xqc` had **no** CSP header or meta on 2026-08-21 — discovery is done; the item is now a regression gate.
5. Skip hideable tagging when the winning probe is not the recorded winner (R-90).
6. Pause-on-scroll via `applyChatPause` (R-75); keep Request Unban visible (R-76).
7. Recapture fixtures after Chrome 153 stable (2026-09-08). Chrome 152 is already on early-stable (`152.0.7977.54`, 2026-08-19); majority stable was still 151 on 2026-08-20 (R-77).
8. Chat-left and the settings extract after the size cut (R-78, R-79).

Confidence: **Verified** = measured in this tree or fetched primary source on 2026-08-21. **Likely** = multiple current signals. **Needs live validation** = cannot be closed from this checkout.

## Product Map

### Core workflows

- Calm Kick on desktop: Studio/OLED/Slate, presets, filters, hideable chrome, panic restore.
- Emote work: harvest, IndexedDB library, My Emotes, ranked picker, colon suggestions (click-only).
- Watch several channels: on-origin grid, merged read-only chat, Document PiP chat, shareable `?kf-multi=`.
- Account read-only: Viewer Hub cards that never invent a zero; opt-in daily-reward claim via Kick’s own button.
- Ad defense: page-realm hooks + companion DNR/webRequest for separable hosts; `/playback` ad-flag rewrite; SSAI untouched.

### User personas

1. Calm viewer (noise, promotions, Poor mode).
2. Power chatter (library, My Emotes, chat comfort).
3. Multistream watcher (grid, popout chat).
4. Accessibility-conscious viewer (contrast, targets, motion, scale).

### Platforms and distribution

Userscript + Chromium MV3 unpacked + Firefox MV2 temporary/unsigned. MIT. Node ≥ 24.19. No store listing. No `@downloadURL` (operator-gated). Primary QA: 1440×900 and 1920×1080, live gate logged out.

### Key integrations and data flows

Same-origin Kick reads (`src/api.mjs` `endpoints`). Bearer from the page’s `session_token` cookie on Kick origins only. Realtime via Kick’s broker (verified Pusher; Kick gateway registered `verified: false`). StreamerStats popup is click-only, public slug, `opener` cleared. Remote blocklist is opt-in HTTPS data, not code.

## Competitive Landscape

Quiet 24h: SevenTV/Extension, NipahTV, kick-core, uKick, enhancer-app/enhancer, and KickDevDocs had **zero** commits after 2026-08-20. CWS listings for Mo'Kick 3.1.1, PureKick 10.5, Kick Augmenter 0.0.22, and uKick 2.7.0.7 did not bump after 2026-08-18.

### Mo'Kick

**Verified.** CWS v3.1.1 updated 2026-08-18, ~40,000 users, IAP. Unban-request UX and VOD resume remain the transferable bits. Avoid mass-ban, IAP, recording.

### PureKick

**Verified.** Ad-blocker listing, v10.5 dated 2026-08-17/18. Avoid SSAI-removal claims.

### Kick Augmenter

**Verified.** CWS v0.0.22 dated 2026-08-17. Pause-on-scroll (R-75) and watch-time (R-88) already queued. Audio is **boost**, not a DynamicsCompressor. Avoid “unlock max quality without login.”

### uKick

**Verified.** CWS v2.7.0.7 (2026-07-24). Chat-left still missing here (`layout.chat` is `right|docked|hidden` only). Avoid OpenLapis nativeMessaging.

### 7TV Extension

**Verified.** Last Kick-related commit 2026-07-30 (`fix(kick): emote menu anchor`). Chat-left (#914) still open. Do not federate third-party emotes.

### enhancer (Kick module)

**Verified.** Last Kick commit 2026-08-11 (localized chat latency). Ships stream-latency and local watch-time; no compressor. Playback diagnostics here already show readyState / buffer / dropped frames (`applyPlaybackDiagnostics`).

### Kick public Ads API (missed 2026-08-20)

**Verified.** KickDevDocs commit `61d7e83` 2026-08-19 added [docs.kick.com/apis/ads](https://docs.kick.com/apis/ads.md): creator OAuth `ads:read`/`ads:write` for ad-break create/status/enroll. `ads_blocked` is a **broadcaster** field, not a viewer skip-ads surface. Do not call `api.kick.com` from this build.

### Refined GitHub (adjacent, from 2026-08-20 Astra Deck research)

**Verified.** Remote `broken-features.csv` is a disable-only hotfix channel. For this repo that is the same class as an operator-gated update URL. The ethical local equivalent is: skip a hide/CSS rule when `findAllProbe`’s winner is not the recorded probe for this route (`scripts/fixture-contract.mjs`). A settings-bisect wizard is optional; richer `copyDiagnostics` is the smaller step.

## Reported Issues

Tracker: `SysAdminDoc/kick-focus` — issues enabled, discussions disabled, **zero** open or closed issues, **zero** PRs, 0 stars. `updatedAt` 2026-08-20T05:48:45Z. Absence of reports at this scale is no data, not a clean bill of health.

KickDevDocs #405 (`invalid_scope` / webhooks) closed 2026-08-20 by its author with no staff comment. Not actionable here.

## Security, Privacy, and Reliability

- **CSP, Verified 2026-08-21.** GET `https://kick.com/` (200, 732,405 B) and `https://kick.com/xqc` (200, 751,841 B): no `Content-Security-Policy` header, no Report-Only, no `<meta http-equiv="Content-Security-Policy">`, no CSP substring in the HTML. Same for `https://www.kick.com/` (732,193 B). `https://player.kick.com/xqc` returned 200 with a **1,802 B** body and no CSP — treat that body size as **Needs live validation** (may be a bootstrap or challenge, not the full player document). Firefox companion inline injection is not CSP-blocked on home/channel **today**.
- **Ads copy still one-sided.** `README.md` “What it cannot do” still says a subscription does not remove in-stream ads. Re-fetched 2026-08-21: ads-for-viewers still “No, you won't see ads on channels you're subscribed to”; subscriptions article dated 2026-07-16 still “Subscribing does not remove ads on KICK.” R-73 remains.
- **Hide-rule fall-through.** `tagHideableElements` (`src/runtime.js`) tags whatever `findAllProbe` returns. `findAllProbe` (`src/compatibility.mjs`) takes the **first** probe that matches any node. If Kick drops the recorded test id, a looser fallback can tag the wrong control and `display:none` it. Fail closed: skip tagging unless the winner is the recorded probe for this route.
- **Size budget is incomplete.** `scripts/check.mjs` `SIZE_BUDGETS` checks only the userscript file. Violentmonkey v2.46.0 notes (still current in v2.48.0, CWS 2026-08-18) describe Alternative page mode as ~1 MB of injected script **plus storage/resources**. `LIBRARY_SEED_LIMIT` is 400 (`src/storage.mjs`). A full seed JSON plus 970,899 B of script can already sit over that advisory. Open question #3 from 2026-08-20 is still unconfirmed in VM source; gate the worst case anyway.
- **Diagnostics omit the only local evidence.** `copyDiagnostics` (`src/runtime.js`) writes version, route, viewport, ad-defense counts, apply-cycle cost. It does not include non-default settings or probe winners, so a pasted report cannot answer “which hide chip / filter is on.”
- **No new extension/userscript CVE** dated 2026-08-20 or 2026-08-21 found (closest: CVE-2026-19165, Chrome < 151.0.7922.109, published 2026-08-06).
- **Do not add DNR `modifyHeaders`.** CRXfiltrate (2026-08) still applies.

## Architecture Assessment

- `src/runtime.js` is still 11,566 lines / 625,776 B. Settings extract remains R-78; do not start it until R-72 lands.
- `FIXTURE_CONTRACT.shell` today records only `main` / `sidebar` / `chatSeparator` / `chatPanel` / `card`. Hideable controls (`playerPip`, `sidebarDrops`, …) are not in that map, so a dropped test id can fall through inside `findAllProbe` without failing the live gate. Extend the existing contract; do not invent a second table.
- `copyDiagnostics` / `runSelfCheck` are the report *generator* this empty tracker needs. Expand the JSON; do not add telemetry.
- Test/docs: R-80 (`expectFailure`) and R-73 (ads copy) still open. Extra locales still deferred until the size cut.

## Rejected Ideas

- **Call Kick’s Ads Public API from the viewer layer.** Source: docs.kick.com/apis/ads, 2026-08-19. Creator OAuth; `ads_blocked` is not a viewer entitlement. Contradicts same-origin session-only reads.
- **Remote broken-feature disable feed** (Refined GitHub `hotfix.tsx` / `broken-features.csv`). Source: Astra Deck research 2026-08-20. Same class as `@downloadURL` (Roadmap_Blocked). Local probe-gated skip is the substitute (R-90).
- **Web Audio DynamicsCompressor on the Kick `<video>`.** Source: FFZ #738; Kick field uses gain (uKick, Augmenter), not compression. Enhancer Kick modules have no compressor. Unverifiable in this gate (R-70: automated Chromium never decodes a frame).
- **Volume boost 1–10×.** Same R-70 verification hole; Kick already owns the volume control this build can hide (`player-volume`).
- **7TV/BTTV federation, SSAI/HLS/IVS worker, screenshot/recording, 1080p-without-login, rate-limit bypass, mass-ban, deleted-message archive, plugins, `setHTML()`, companion `userScripts`, DNR `modifyHeaders`, light theme next, extra locales before R-72, official OAuth, danmaku, WCAG 3 retarget.** Unchanged from 2026-08-20; still misfit or blocked.
- **Keyboard emote completion, `@downloadURL`, first-run tour, signed-in live gate, SSAI scrub.** Stay in `Roadmap_Blocked.md`.

## Sources

### This tree

- `README.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `Roadmap_Blocked.md`
- `src/runtime.js` (`tagHideableElements`, `copyDiagnostics`, `applyPlaybackDiagnostics`)
- `src/compatibility.mjs` (`findAllProbe`)
- `src/storage.mjs` (`LIBRARY_SEED_LIMIT`)
- `src/core.mjs` (`HIDEABLE_ELEMENTS`, `layout.chat`)
- `scripts/check.mjs` (`SIZE_BUDGETS`)
- `dist/kick-focus.user.js` (970,899 B, 2026-08-21)

### Kick

- https://help.kick.com/en/articles/15300357-advertising-on-kick-for-viewers
- https://help.kick.com/en/articles/15159735-how-kick-subscriptions-work-for-viewers
- https://help.kick.com/en/articles/15300424-advertising-on-kick-for-streamers
- https://docs.kick.com/apis/ads.md
- https://github.com/KickEngineering/KickDevDocs/commit/61d7e8336fe2bc4bbb7479fa56bf77d5ae4a2fe1
- https://github.com/KickEngineering/KickDevDocs/issues/405

### Competitors and adjacent

- https://chromewebstore.google.com/detail/mokick-better-kick-for-ev/lhjnnfenfahhjkmcngnocfclechcibkc
- https://chromewebstore.google.com/detail/purekick-ad-blocker-for-k/mhicbhkhokaocipkioiibmficljoijnf
- https://chromewebstore.google.com/detail/kick-augmenter/hdhpmccblalleagomabbfnpkbcpojfpd
- https://github.com/berkaygediz/uKick
- https://github.com/SevenTV/Extension/issues/914
- https://github.com/enhancer-app/enhancer
- https://github.com/Pkkls/kick-core
- https://github.com/FrankerFaceZ/FrankerFaceZ/issues/738
- https://greasyfork.org/en/scripts/by-site/kick.com?sort=updated
- https://github.com/refined-github/refined-github/blob/main/source/helpers/hotfix.tsx

### Platform

- https://github.com/violentmonkey/violentmonkey/releases/tag/v2.48.0
- https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0
- https://developer.chrome.com/blog/chrome-two-week-release
- https://chromereleases.googleblog.com/2026/08/
- https://nodejs.org/en/blog/release/v24.19.0
- https://github.com/advisories/GHSA-2865-9gvm-5wwx
- https://blog.7ai.com/crxfiltrate

## Open Questions

1. **Needs live validation.** On a subscribed non-Slots channel, do in-stream ads skip, matching the ads-for-viewers article rather than the 2026-07-16 subscriptions article? Blocks stronger README wording than “Kick’s own articles disagree.”
2. **Needs live validation.** Does Violentmonkey Alternative page mode count GM/`localStorage` seed bytes toward its ~1 MB advisory, or only injected script text? R-91 gates the worst case either way; this question only changes how aggressive the seed cap must be.
3. Which page-visible or already-called same-origin source exposes **level and streak** without opening the reward dialog? Do not add an undocumented endpoint. Still unanswered since 2026-08-19.
4. Does Kick’s page still GET `web.kick.com/api/v1/channels/{id}/chat/active-chatters`? The 2026-08-15 capture said yes; R-81 must re-confirm before adding the URL to `endpoints`.
5. **Needs live validation.** Is the 1,802-byte 2026-08-21 `player.kick.com/xqc` body the real player document or a challenge/bootstrap? Does not block R-74 (companion injects on `kick.com`, not the embed origin).
