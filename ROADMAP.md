# Roadmap

Updated: **2026-08-18**

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

### P1 — trust, accessibility, and two expired blockers

### P2 — quick wins, then the 2026 platform

- [ ] P2 — R-49, say when a VOD expires
  Why: Kick deletes VODs after 7 days (unverified) or 30 (verified), offers no download to anyone including the broadcaster, lets creators delete with one click, and shows a countdown nowhere. Still the largest documented, unserved Kick pain a read-only client can address.
  Evidence: help.kick.com/en/articles/7112432 (retention tiers). **The mechanism this item originally named does not exist — measured on live Kick 2026-08-18, do not repeat it.** A VOD page at `/{slug}/videos/{uuid}` carries **no `VideoObject`** in its linked data (only `Organization` and `WebSite`), so there is no in-page recording date; `GET /api/v1/video/{id}` is **404** (Kick deleted it in July 2026, first-hand confirmation of the NipahTV breakage); `GET /api/v2/channels/{slug}/videos/latest` is **404**. What *does* answer is `GET /api/v2/channels/{slug}/videos` — 200, 25 entries carrying `created_at` in the zone-less form `parseKickTimestamp` already handles, plus a nested `video.uuid`. The unsolved step is the join: the UUID in the page URL (`01a01256-da48-7d57-…`, v7-shaped) matches **no field of any entry**, including `video.uuid` (`39484bbd-…`, v4-shaped). `verified` for the retention tier is available on the channel read and reliable (measured 200/true for a verified channel).
  Touches: `src/api.mjs` (a `verified` field on `normalizeChannel`, and whatever endpoint solves the join), `src/live.mjs`, `src/runtime.js`, `src/core.mjs`, `test/api.test.js`, `test/core.test.js`
  Acceptance: Start by solving the join — find how a VOD page URL identifies its entry, or abandon the item. Then: a VOD page shows time remaining before Kick's retention window closes, computed with the same UTC-normalising parse the uptime chip uses; nothing is downloaded or written; the surface says nothing at all when the tier or the date cannot be determined rather than guessing 7 or 30. The channel VOD list is **out of reach separately** — its cards carry only localized relative text ("· 1 day ago") with no `<time datetime>`, so per-card dates are not machine-readable.
  Complexity: M

- [ ] P2 — R-50, show an unresolved prediction against its 24-hour refund deadline
  Why: A prediction that is never resolved auto-refunds after 24 hours and nothing in Kick's UI shows that clock, so points sit locked with no indication of when they return. It is a pure read over an endpoint the page already calls.
  Evidence: help.kick.com/en/articles/11182854 (streamer guide: 24-hour auto-refund, exactly two outcomes, 10–250,000 point stakes); `GET api/v2/channels/{channel}/polls` in the community endpoint catalogue (fb-sean/kick-website-endpoints).
  Touches: `src/api.mjs`, `src/live.mjs`, `src/runtime.js`, `src/core.mjs`, `test/api.test.js`
  Acceptance: An open prediction on the current channel shows its age and time to auto-refund; the surface is read-only and never votes, resolves or refunds; it degrades silently when the endpoint is unavailable or the channel has predictions off; behind its own setting, on by default only if it costs no extra request.
  Complexity: M

- [ ] P2 — R-52, move the hover card and completion list into the top layer
  Why: Both are positioned by hand inside a shadow tree over Kick's own stacking contexts, the classic source of clipping and z-index fights; `<dialog>` and popover render in the top layer where no host `overflow: hidden` can reach them, and anchor positioning replaces the manual rect maths.
  Evidence: No `<dialog>`, `popover`, `anchor-name` or `position-anchor` anywhere in `src/`. `<dialog>` is Baseline widely available since 2024-09-14; popover Baseline newly 2025-01-27; anchor positioning is cross-engine as of Chrome 125 / Firefox 147 / Safari 26 and reads "limited" only because of `position-anchor` initial-value churn — set it explicitly rather than relying on the initial value.
  Touches: `src/runtime.js` (emote hover card, completion list, settings modal, command menu), `scripts/check.mjs`, `scripts/verify-extension.mjs`
  Acceptance: The hover card and completion list render in the top layer with an explicit `position-anchor`, keeping the existing hand-positioned path as a feature-detected fallback; the live gate asserts neither is clipped when its anchor sits near a viewport edge and inside a scrolling chat container; keyboard and focus behaviour are unchanged.
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

## Research-Driven Additions — 2026-08-18 (re-verification pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md), run against an unchanged v1.20.0. Continues the R-NN scheme from R-57.

Two existing items were **edited in place rather than duplicated**: R-38's premise was invalidated and rewritten (the card-actions defect it described does not exist), and R-48 gained FrankerFaceZ's concrete search design so it needs no further research. R-40's acceptance is now unblocked — `release:check` passes 55/55 at both viewports as of 2026-08-18, so nothing but R-38/R-39 stands between HEAD and a release.

### P1 — the drift gate has an API-shaped hole

- [ ] P3 — R-59, one read-only chat across every channel in the grid
  Why: The grid shows nine streams and one chat — the focused tile's — and the two closest multi-stream competitors both went past that to unified cross-channel chat. It is the single named feature gap in the surface Kick Focus otherwise leads on, and it stays inside the read-only boundary.
  Evidence: Kickplex (CWS v1.1.4, 2026-06-09) ships unified tabbed chat with an emote picker and recents alongside DVR rewind; streamgrids.tv keeps chat beside the active stream; viewgrid.tv runs up to 20 streams. Critically, **chat is the field's universal weak point** — there is no good Kick chat embed, so third parties fall back to an unofficial relay (`chat.kick.cx`), while Kick Focus already reads Kick's own realtime chat same-origin per channel through `src/live.mjs` (`connectRealtime` :381) and uses Kick's own popout chat on-origin. The capability is already in the building.
  Touches: `src/live.mjs` (multiple concurrent realtime connections), `src/multistream.mjs`, `src/runtime.js`, `src/core.mjs` (merge and ordering), `test/live.test.js`, `test/multistream.test.js`
  Acceptance: An opt-in merged view interleaves messages from every channel in the grid, each labelled with its source channel, ordered by arrival, capped so a busy grid cannot grow without bound; it is strictly read-only — no composer, no send path, consistent with `README.md:105`; connections are torn down with their tiles and a channel removed from the grid stops consuming one; the existing per-tile chat remains the default. Depends on R-47 (the realtime paths need coverage before they are asked to run nine at once).
  Complexity: L

