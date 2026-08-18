# Roadmap

Updated: **2026-08-17**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next — ordered by value

1. **Automated Kick DOM drift snapshots — capture half.** The *detection* half shipped 2026-08-16: the live gate reads `LOCATOR_PROBES` (the ordered probes the runtime itself uses, so there is no second list to rot) and fails when a route-independent hook falls through to a fallback. It found real drift on its first run — the home page's chat preview has never carried `#channel-chatroom`, so `chatPanel` resolves via `chat-messages-owner`; that is reported, not failed, because it is route-shaped.
   What remains is the maintainer-only reducer: turn a fresh MHTML/live capture into a small sanitized fixture under `test/fixtures/`, so those hand-written shells can be regenerated instead of hand-edited. Needs its own browser session (the live gate's is not reusable as a module) and only covers routes reachable logged out — Drops and the open sticker picker need a session, so their fixtures stay hand-maintained. Raw captures stay ignored (`page_examples/`).

2. **Use the account catalog beyond the current channel.** v1.20.0 established that an authenticated `/emotes/{slug}` read returns every set the account owns, not just the channel being viewed — so one read on any channel is a complete personal inventory. The library now reports the totals. What is not built yet: a "my emotes" view that lists them by source channel independently of where you are standing, and using the same answer to stop the colon-autocomplete from offering an emote that will bounce with `SUBSCRIBERS_ONLY_EMOTE_ERROR` or `FOREIGN_CHANNEL_EMOTE_ERROR`. The reach data is already on each record (`usableEverywhere` / `usableHere`); the suggestion ranker does not read it.

3. **A live-gate pass that runs signed in.** Everything entitlement-related is unit-tested against captured shapes and was measured by hand against a real account, but the live gate runs anonymous, so no automated check exercises the authenticated catalog, `/me`, or the collectibles read that the bearer fix repaired. This needs an operator decision about credentials in a test run before it can be built — see [Roadmap_Blocked.md](Roadmap_Blocked.md), which has carried the same blocker since 2026-08-15 and can now name exactly what it would cover.

## Explicitly deferred

- Full mobile-site support; the settings surface still reflows at narrow window sizes
- Publishing to a userscript catalog or extension store without explicit approval

## Research-Driven Additions

Added 2026-08-15 from the research pass recorded in [RESEARCH.md](RESEARCH.md).

### P0

### P1

### P2

### P3

### API and emote-catalog work (added 2026-08-15 from the Kick API + emote tooling research)

Gate for this whole group: do not replay private endpoints or infer entitlement. Data features read endpoints the page already calls, same-origin, inheriting the user's own session, and keep the existing DOM path as fallback. The separately documented click-to-save flow may perform Kick's normal Follow request only after a deliberate click and explicit follow-gate evidence.

## Research-Driven Additions — differential pass

Added 2026-08-15 from the differential research pass recorded in [RESEARCH.md](RESEARCH.md), run against v1.5.0.

### P0

### P1

### P2

### P3

## Research-Driven Additions — 2026-08-16 (v1.9.0 pass)

Added from the exhaustive research recorded in [RESEARCH.md](RESEARCH.md), run against v1.9.0. Continues the R-NN scheme (new here — the prior sections were left empty).

Cross-references to existing "Next" items: R-01 unblocks Next items 1, 4, and 5 (all need a real browser); R-09 supersedes Next item 2 (see inline note there); R-14 pairs with Next item 4. New selector dependencies added by R-06/R-07/R-16/R-19 (chat container, header control, discovery cards) should be registered with Next item 3's DOM-drift snapshots as they land.
Previously-blocked items now actionable: telemetry contradiction (R-08 — external evidence now stands in for the multi-hour measurement), stitched-ad observability (R-09 — via the player-events path, not the worker wrapper).

### P0 — data safety, security, correctness, and the single unblock

### P1 — operator demand first, then trust / reliability / accessibility

### P2 — quick wins, operator second-wave, platform modernization, dev-experience

### P3 — differentiators, larger bets, future-proofing

## Research-Driven Additions — 2026-08-17 (v1.20.0 pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md), run against v1.20.0. Continues the R-NN scheme from R-37.

Cross-references to existing work: R-56's derived-value assertions belong with "Next" item 1's fixture reducer and should land together, not beside each other. Nothing here covers autocomplete reach filtering — that is "Next" item 2 and stays there. R-45 and R-46 are the unblocks for two [Roadmap_Blocked.md](Roadmap_Blocked.md) items whose stated blockers have expired (the repo is public; Firefox 153 is installed); on completion, delete those entries from that file rather than leaving them recorded as blocked.

### P0 — the gate is red, and it is right to be

- [ ] P0 — R-38, card actions render nothing on Kick's Home route
  Why: Favourite, Not-interested and the multi chip all hang off one early return, so all three are silently absent on the route most users land on; the drift gate passes because the probe hook resolves and only the value derived from it is gone.
  Evidence: Live gate 2026-08-17 against `https://kick.com/` — `a discovery card can be collected into the grid without opening it — no card chip rendered on this page`, alongside `card detection found Kick cards — 27 cards scored`; the same gate against `https://kick.com/browse` passes with `chip for davooxeneize -> grid ["xqc","davooxeneize"]`. Second instance this month of the silent-death class (`CLAUDE.md` 2026-08-17, `closest()` returning the video).
  Touches: `src/runtime.js` (`applyCardActions` :2257, `cardPath` :2133, `mainCardCandidates` :2246, `cardCandidates` :2168), `src/core.mjs` (`cardSlugFromPath` :2361), `scripts/verify-extension.mjs` (:1370-1410)
  Acceptance: The chip probe reports counts rather than a bare "no chip" — cards found in `main`, how many carried an anchor, how many yielded a slug — and names which stage returned zero. With the cause fixed, both chip checks pass on `https://kick.com/` as they already do on `/browse`, and a check asserts favourite and not-interested render on any discovery route.
  Complexity: M

- [ ] P0 — R-39, give the live gate a real SKIP outcome instead of two conventions
  Why: `record()` has only pass/fail, so route-shaped absence is hand-rolled as SKIP in some probes and returned as a failure in others; the gate is unusable against any target but the default, and `release:check`'s exit code cannot be trusted for a channel or browse URL.
  Evidence: Live gate 2026-08-17 against `https://kick.com/browse` — 50/54, with four failures that are not defects (`library is empty on this profile` twice, `no video on this route`, and the emote-typing check) while the Poor-mode probe on the same run correctly emitted `SKIP … run the gate against a channel URL to assert it`.
  Touches: `scripts/verify-extension.mjs` (`record` :137, every probe returning a `{ok:false, why}` for a missing precondition), `scripts/release-checklist.mjs`
  Acceptance: `record()` takes a third `skip` outcome with a mandatory reason; every probe declares its precondition instead of encoding it in a `why` string; the summary counts pass/fail/skip separately; runs against a channel URL and against `/browse` both exit 0 when nothing is broken, and a real defect on either still exits 1.
  Complexity: M

- [ ] P0 — R-40, release v1.20.0 and make the README's verification claim true again
  Why: v1.20.0 is built, committed and has its zips in `dist/`, but is untagged and unreleased, and the README advertises a live-check result that no longer describes HEAD — the one number a reader uses to judge whether the gate means anything.
  Evidence: `gh release list` latest is v1.19.0 (2026-08-16T23:53:56Z); `git tag` stops at v1.19.0; `README.md:147` claims "51/51 live checks pass at 1440×900 (2026-08-16)" while HEAD runs 54 checks with 2 failing. `CLAUDE.md:9` says `runtime.js` is "~7,990 lines"; it is 9,243.
  Touches: `README.md` (:147), `CLAUDE.md` (:9), `CHANGELOG.md`, tag and GitHub release with all three artifacts
  Acceptance: R-38 and R-39 land first; the live gate is green at both verified viewports; the README's figure matches that run's total and date; v1.20.0 is tagged and released with the userscript and both companion zips attached.
  Complexity: S

### P1 — trust, accessibility, and two expired blockers

- [ ] P1 — R-41, declare the interface's language so assistive technology pronounces it
  Why: Choosing Español or Português localizes the whole settings surface inside Kick's `<html lang="en">`, so a screen reader speaks Spanish and Portuguese with English phonemes — a WCAG 2.2 SC 3.1.2 *Language of Parts* (AA) failure on the one product in this space that ships an accessibility page and measured 326 controls for AA conformance.
  Evidence: `grep -rn "lang=" src/` returns exactly one hit, `src/extension/popup.html:2`; `activeLocale()` (`src/runtime.js:6418`) and `localizeInterface()` (:6472) set no attribute anywhere. WCAG 2.2 SC 3.1.2, Level AA.
  Touches: `src/runtime.js` (`activeLocale` :6418, `localizeInterface` :6472, the shadow host and any toast or announcement node created outside it), `scripts/check.mjs`, `test/i18n-coverage.test.js`
  Acceptance: The Kick Focus root, the shadow host, the toast region and the live region all carry the active locale's tag, updated when the language setting changes; the popup document's `lang` follows the same setting; a live check asserts the attribute matches the selected language after a change, and an artifact gate fails if a new top-level surface is created without one.
  Complexity: S

- [ ] P1 — R-42, stop the Firefox package handing kick.com a per-install identifier
  Why: The MV2 bridge injects the page bundle by `src`, putting `moz-extension://<per-install-UUID>/…` into the DOM where any Kick script can read it; that UUID is randomised per install, stable for its life, and survives cookie clears — a supercookie shipped by a mod that sells privacy.
  Evidence: `src/extension/manifest.firefox.json` `web_accessible_resources: ["content/kick-focus.js"]`; `src/extension/bridge.firefox.js:19-21`. Removing the element on load (:22) does not help — the URL is already in the DOM and in `performance.getEntriesByType('resource')`. MV3's `use_dynamic_url` and Chromium's Aug-2024 resource-UUID randomisation have no MV2 equivalent; the MV3 package is unaffected because it uses `world: "MAIN"` and declares no web-accessible resources.
  Touches: `src/extension/bridge.firefox.js`, `src/extension/manifest.firefox.json`, `scripts/check.mjs`, `README.md`
  Acceptance: The extension URL never enters the page — the bridge reads the bundle text from the extension and injects it inline, `web_accessible_resources` is dropped, and a gate asserts the Firefox manifest declares none. The CSP dependency this creates (Kick ships no CSP today, confirmed 2026-08-17) is stated in the README beside the Firefox install instructions, with the fallback behaviour if that changes.
  Complexity: M

- [ ] P1 — R-43, validate the sender on every runtime message
  Why: Both background scripts act on `fetch-blocklist`, `telemetry-preference` and `reset-count` without checking who sent them; the bridge already fixed its half of this class and the service worker did not.
  Evidence: `src/extension/background.js:33` onwards, `src/extension/background.firefox.js`. GitHub Security Lab names missing `onMessage`/`onMessageExternal` sender validation as one of three canonical extension vulnerability classes. Documented ceiling: a compromised renderer can spoof `MessageSender.id`/`.url`, so this hardens against other extensions, not against a compromised renderer — say so in the comment rather than overclaiming.
  Touches: `src/extension/background.js`, `src/extension/background.firefox.js`, `scripts/check.mjs`, `test/companion.test.js`
  Acceptance: Every handler refuses a message whose `sender.id` is not this extension or whose `sender.origin`/`sender.url` is not a Kick origin; a test drives a forged sender through the built background and asserts refusal; an artifact gate fails if a new message type is handled without passing the guard.
  Complexity: S

- [ ] P1 — R-44, put the artifact under a size budget before it crosses the injection ceiling
  Why: The userscript grows about 25 KB per release and Violentmonkey's MV3 Alternative page mode — the only mode giving real `document-start` on Chromium — is advisory-limited to roughly 1 MB. Crossing it degrades injection timing silently, which is the hardest class of failure this project has to find.
  Evidence: `dist/kick-focus.user.js` by tag — v1.14.0 612,899 B, v1.16.0 637,041 B, v1.17.0 695,234 B, v1.18.0 710,582 B, v1.19.0 738,834 B, HEAD 763,775 B. `README.md:101` records the ~1 MB advisory limit. None of the 159 checks in `scripts/check.mjs` measures a byte count. Greasy Fork's 2 MB cap is the second ceiling.
  Touches: `scripts/check.mjs`, `scripts/build.mjs`, `README.md`
  Acceptance: A gate fails when any artifact exceeds a declared budget and warns within 15% of it; the budget and its source are named in a comment; the build prints each artifact's size so growth is visible per release. Confirm the real Violentmonkey limit when the manager-install blocker clears and adjust the number rather than guessing again.
  Complexity: S

- [ ] P1 — R-45, wire the userscript update channel; the repo is public now
  Why: `Roadmap_Blocked.md` blocks R-24 on "a private raw URL 404s for every installed script, so this cannot be wired until the repo is public". It is public. Without `@updateURL` the userscript — the only artifact that reaches Windows and macOS users unassisted — can never ship a fix to anyone who already installed it.
  Evidence: `gh repo view SysAdminDoc/kick-focus` reports `"visibility":"PUBLIC"` (2026-08-17); `origin` is `https://github.com/SysAdminDoc/kick-focus.git`. Counter-evidence to weigh rather than ignore: every high-confidence 2025–2026 extension compromise was distribution-channel takeover, including the Feb 2025 Greasy Fork inactive-account incident that injected payment-scraping code into two live scripts.
  Touches: `src/metadata.txt`, `scripts/build.mjs`, the Firefox `updates.json`, `README.md`, `Roadmap_Blocked.md` (delete the entry)
  Acceptance: `@downloadURL`/`@updateURL` point at a raw HTTPS URL on a tag, not a moving branch; the Firefox update manifest carries a sha256 `update_hash`; the README states the update channel and how to turn it off; hardware-key 2FA on the GitHub account is confirmed before the URL ships, and the repo is never transferred.
  Complexity: S

- [ ] P1 — R-46, prove the Firefox companion against a real Firefox
  Why: `Roadmap_Blocked.md` blocks the Firefox live proof on "no Firefox installation or profile exists in this checkout". Firefox 153.0 is installed. The MV2 package's blocking listener, the bridge handshake, the popup, and R-42's inline-injection change are all currently unproven anywhere.
  Evidence: `C:\Program Files\Mozilla Firefox\firefox.exe` reports "Mozilla Firefox 153.0" (2026-08-17); Playwright's `firefox-1538` is also present. Firefox 128+ supports WebDriver BiDi `webExtension.install` for temporary unsigned add-ons — the zero-dependency equivalent of the Chromium gate's CDP `Extensions.loadUnpacked`.
  Touches: a Firefox arm of `scripts/verify-extension.mjs` (or a sibling sharing its probes), `package.json` scripts, `README.md`, `Roadmap_Blocked.md` (delete the entry)
  Acceptance: A command installs `dist/extension-firefox/` into a disposable Firefox profile over BiDi and asserts the background page loaded, `webRequestBlocking` cancelled a Kick-initiated ad-host request, the bridge handshake reached the page, the popup rendered live ruleset state, and no `moz-extension://` URL appears in the page DOM or resource timeline. Skips with a reason when no Firefox is found, exactly as the Chromium gate does.
  Complexity: L

- [ ] P1 — R-47, cover the realtime half of `live.mjs`
  Why: The module was extracted behind a `host` factory precisely so it could be tested without a browser, and the realtime paths — the ones that touch a live socket and mutate chat — are the half never driven through it.
  Evidence: `npm run coverage` 2026-08-17: `live.mjs` 57.34% lines / 67.90% branches / 48.72% functions, the lowest in the tree. Uncovered ranges are `connectRealtime` (:381-442), `onRealtimeFrame`/`onRealtimeChatMessage` (:453-496), badge queue, render and replay (:543-606), deletion annotation and replay (:620-650).
  Touches: `test/live.test.js`, `src/live.mjs`
  Acceptance: Tests drive a stub socket through connect, frame dispatch, reconnect scheduling, badge queue-and-replay across a chat remount, and deletion annotation applied exactly once; `live.mjs` function coverage clears 80%; each new test is mutation-verified by breaking the behaviour it claims to pin.
  Complexity: M

### P2 — quick wins, then the 2026 platform

- [ ] P2 — R-48, search the settings
  Why: Roughly 90 settings across five pages with no way to find one by name; the field's reference implementation has had cross-page settings search for years, and it is the one FrankerFaceZ affordance with no Kick Focus equivalent.
  Evidence: `grep -n "settings-search\|searchSettings\|filterSettings" src/runtime.js` returns nothing; `DEFAULT_SETTINGS` (`src/core.mjs:4`) spans five groups; the live gate measured 326 controls across the five pages.
  Touches: `src/runtime.js` (settings shell ~:6760-7400), `src/core.mjs` (a pure matcher over label, description and page), `test/core.test.js`, `test/i18n-coverage.test.js`
  Acceptance: Typing in the settings header filters to matching controls across all five pages with the owning page named on each result, matches description as well as label, works in es and pt against the translated strings, clears back to the full page, and is reachable and operable by keyboard; the matcher is a pure function with its own tests.
  Complexity: M

- [ ] P2 — R-49, say when a VOD expires
  Why: Kick deletes VODs after 7 days (unverified) or 30 (verified), offers no download to anyone including the broadcaster, lets creators delete with one click, and shows a countdown nowhere. This is the largest documented, unserved Kick pain a read-only same-origin client can address.
  Evidence: help.kick.com/en/articles/7112432 (retention tiers and creator deletion); the absence of any download affordance is corroborated by the existence of streamrecorder.io, StreamsCharts' Kick VOD downloader and GREC. The value rides on `GET api/v2/channels/{channel}/videos/latest`, which the page already calls.
  Touches: `src/api.mjs`, `src/live.mjs`, `src/runtime.js`, `src/core.mjs` (expiry maths against `parseKickTimestamp`), `test/api.test.js`, `test/core.test.js`
  Acceptance: A VOD page and the channel VOD list show time remaining before Kick's retention window closes, computed with the same UTC-normalising parse the uptime chip uses; nothing is downloaded, requested extra, or written; the surface says nothing at all when the retention tier cannot be determined rather than guessing 7 or 30; an offline channel and a live channel both render correctly.
  Complexity: M

- [ ] P2 — R-50, show an unresolved prediction against its 24-hour refund deadline
  Why: A prediction that is never resolved auto-refunds after 24 hours and nothing in Kick's UI shows that clock, so points sit locked with no indication of when they return. It is a pure read over an endpoint the page already calls.
  Evidence: help.kick.com/en/articles/11182854 (streamer guide: 24-hour auto-refund, exactly two outcomes, 10–250,000 point stakes); `GET api/v2/channels/{channel}/polls` in the community endpoint catalogue (fb-sean/kick-website-endpoints).
  Touches: `src/api.mjs`, `src/live.mjs`, `src/runtime.js`, `src/core.mjs`, `test/api.test.js`
  Acceptance: An open prediction on the current channel shows its age and time to auto-refund; the surface is read-only and never votes, resolves or refunds; it degrades silently when the endpoint is unavailable or the channel has predictions off; behind its own setting, on by default only if it costs no extra request.
  Complexity: M

- [ ] P2 — R-51, tell the user what changed after an update
  Why: Once R-45 lands the userscript updates itself and behaviour changes with no signal at all — precisely the pattern Kick was criticised for in May 2026 when ads appeared unannounced. The mod should not do to its users what the platform did.
  Evidence: `grep -n "firstRun\|whatsNew\|lastSeenVersion" src/runtime.js src/core.mjs` returns nothing — there is no version-change awareness anywhere. Depends on R-45.
  Touches: `src/core.mjs` (settings schema: last-seen version), `src/runtime.js` (About page and a dismissible notice), `CHANGELOG.md`, `test/core.test.js`
  Acceptance: After the version changes, one dismissible notice names the version and links to the About page's summary of what changed; it appears once, survives nothing being clicked, and never appears on a first install where it would be noise; any setting whose default changed is called out by name.
  Complexity: S

- [ ] P2 — R-52, move the hover card and completion list into the top layer
  Why: Both are positioned by hand inside a shadow tree over Kick's own stacking contexts, the classic source of clipping and z-index fights; `<dialog>` and popover render in the top layer where no host `overflow: hidden` can reach them, and anchor positioning replaces the manual rect maths.
  Evidence: No `<dialog>`, `popover`, `anchor-name` or `position-anchor` anywhere in `src/`. `<dialog>` is Baseline widely available since 2024-09-14; popover Baseline newly 2025-01-27; anchor positioning is cross-engine as of Chrome 125 / Firefox 147 / Safari 26 and reads "limited" only because of `position-anchor` initial-value churn — set it explicitly rather than relying on the initial value.
  Touches: `src/runtime.js` (emote hover card, completion list, settings modal, command menu), `scripts/check.mjs`, `scripts/verify-extension.mjs`
  Acceptance: The hover card and completion list render in the top layer with an explicit `position-anchor`, keeping the existing hand-positioned path as a feature-detected fallback; the live gate asserts neither is clipped when its anchor sits near a viewport edge and inside a scrolling chat container; keyboard and focus behaviour are unchanged.
  Complexity: M

- [ ] P2 — R-53, sanitize markup rather than only vouching for it
  Why: v1.15.0 routes every `innerHTML` write through a Trusted Types policy, which makes the write legal under a future CSP but not safe — the policy's `createHTML` returns its input unchanged. `Element.setHTML()` sanitizes and is now available in both target engines.
  Evidence: No `setHTML` in `src/`. Sanitizer `setHTML()` shipped Chrome 146 and Firefox 148; Trusted Types went Baseline newly on 2026-02-24 with Safari 26, which is what raises the odds Kick turns enforcement on. Known caveat: `<base>` is not removed from the config allowlist in Firefox 148 and pre-153 Chrome (whatwg/html#12664).
  Touches: `src/runtime.js` (`trustedHTML` and its call sites), `scripts/check.mjs`
  Acceptance: `trustedHTML` prefers `setHTML()` where available and falls back to the existing policy; a gate asserts no raw `innerHTML` write bypasses the helper; the settings shell, library, hover card and completion list render identically on an engine with and without the Sanitizer.
  Complexity: M

### P3 — differentiators and future-proofing

- [ ] P3 — R-54, pop the grid's chat out into a real always-on-top window
  Why: Document Picture-in-Picture became cross-engine in 2026, and an always-on-top window rendering arbitrary DOM is the first genuinely new capability available to a multi-stream mod since the Navigation API. The nearest rival moved multi-view past tiles to unified chat and PiP; this answers it on-origin, with Kick's own embeds, and with no new permission.
  Evidence: Document PiP — Chrome 116, Firefox 151 (2026-05-19 release notes: "allows web pages to place content in an always-on-top popup"), not in Safari. No `documentPictureInPicture` anywhere in `src/`. `src/multistream.mjs` already owns tile lifecycle and the single-audio-owner invariant behind a `host` factory.
  Touches: `src/multistream.mjs`, `src/runtime.js`, `src/core.mjs`, `test/multistream.test.js`, `scripts/verify-extension.mjs`
  Acceptance: Gated behind `'documentPictureInPicture' in window` and off by default; the popped-out chat is the focused tile's, follows focus changes, and closing the window returns it to the grid without losing the tile; exactly one tile still owns audio; the grid behaves as it does today on an engine without the API.
  Complexity: L

- [ ] P3 — R-55, bring the four loyalty systems into one view
  Why: Drops, Daily Rewards, Kick Levels and Channel Points are four disconnected progressions Kick never presents together, and the dominant Drops complaint is simply "did my watch time count and did the claim land". The mod already owns the reward-claim schedule, so the state is half-collected.
  Evidence: help.kick.com/en/articles/15715119 (Daily Rewards: at least 1h/day cumulative across channels, resets daily), /15332522 (Levels: passive, global, off by default, progress reset at launch), /11033027 (Channel Points), about.kick.com Drops campaign pages; Facepunch's support article documents claims taking up to 10 minutes and needing a "Check For Missing Drops" button. Kick Focus already reads the reward countdown and the 20:00 rollover (`src/core.mjs:600`).
  Touches: `src/live.mjs`, `src/runtime.js` (Content & Ads page), `src/core.mjs`, `test/core.test.js`
  Acceptance: One panel shows daily watch progress toward the reward, whether it is unclaimed, global level progress, and per-channel points for the current channel, each reading only endpoints the page already calls and each degrading to nothing when its source is unavailable; nothing claims, spends or votes beyond the existing opt-in reward claim. The Drops half stays out until the authenticated-session blocker clears.
  Complexity: L

- [ ] P3 — R-56, assert derived values, not just probe hooks, when Kick drifts
  Why: Two whole feature classes died silently this month with every gate green, both the same shape — a probe resolved and something computed from it did not. Detection currently stops at "the hook matched".
  Evidence: R-38 (a card resolves, `cardSlugFromPath` yields nothing, three chips vanish); `CLAUDE.md` 2026-08-17 (`closest()` returned the `<video>`, three features vanished). `compatibilitySnapshot()` (`src/compatibility.mjs:242`) reports probe ids and fall-throughs only.
  Touches: `src/compatibility.mjs`, `scripts/verify-extension.mjs`, `test/compatibility.test.js`, and "Next" item 1's fixture reducer
  Acceptance: Each probe feeding a derived value declares an expectation for that value — a card yields a channel slug, a player container is not the video, a quality row yields a plausible height — and the live gate fails naming both the probe and the derived value when one resolves and the other does not. Landed with the fixture reducer so the same expectations are checkable offline.
  Complexity: M

- [ ] P3 — R-57, write down the distribution and listing posture before it is needed
  Why: The single-purpose rule is the live risk for a mod bundling layout, ad defence, an emote library and a grid, and the Chrome Web Store's tightened Limited Use and Disclosure rules took effect 2026-08-01 — decisions worth making while nothing is submitted rather than during a review.
  Evidence: developer.chrome.com/blog/cws-policy-updates-2026 (published 2026-07-01, enforcement 2026-08-01); the CWS single-purpose policy; extensionworkshop.com add-on policies (updated 2026-04-30 — `userScripts` restricted to script managers, no remote code); greasyfork.org/en/help/code-rules (no obfuscation or minification, 2 MB cap, update checks capped at once a day, which the current `blocklistRefreshHours: 24` default already satisfies). `@connect *` in `src/metadata.txt:19` is the broadest permission the project asks for.
  Touches: `README.md`, `src/metadata.txt`
  Acceptance: A short section states the single purpose, what is collected and transmitted (nothing), why `@connect *` is requested and what uses it, why the project ships no remote code, and which of the three channels each artifact could be listed on. Narrow `@connect` to the shipped defaults if the blocklist feature tolerates it, and say so if it cannot.
  Complexity: S

