# Research — Kick Focus

Date: **2026-08-19** — replaces all prior research.

## Executive summary

Kick Focus v1.26.0 is already a broad, privacy-preserving Kick client mod: roughly 90 settings, three dark themes, four accents, five settings pages, content filters, player memory, local chat tools, a first-party emote library, live entitlement filtering, daily-reward automation, local diagnostics, and a nine-stream on-origin grid. The build has no runtime dependencies, no tracking, no account system, and no third-party emote federation. That posture is more valuable after this pass, not less.

The signed-in investigation changes the product direction in four material ways:

1. **Native Kick gives viewers almost no control.** Its entire Preferences page exposed three category switches in the audited account: Pools/Hot Tubs, Slots/Casino, and VR Chat. Kick Focus should own the calm, legible, personalized viewing layer rather than imitate Kick's sparse account settings.
2. **Kick's viewer progression is fragmented.** Level progress and streak live in the account menu; Daily Rewards use a separate modal; channel points are channel-scoped; collectibles and Drops are separate routes. A read-only, progressively enhanced Viewer Hub is the clearest signed-in opportunity.
3. **The competitive bar moved.** Mo'Kick now reports 40,000 Chrome users and bundles chat history/search/stats, message actions, moderation tools, notes, player filters, recording, downloads, giveaways, and games. PureKick reports 20,000 users and focuses on ad blocking, themes, chat badges, and Drops. Kick Focus cannot win by accumulating the longest feature list. It can win on calm customization, accessibility, transparent limits, local-first data, and a coherent settings experience.
4. **The authenticated emote catalog is the safest high-value data source already in the product.** The current API path returns the account's owned sets and usable-anywhere reach. The next release should turn that data into a real My Emotes view instead of only using it behind autocomplete and diagnostics.

The best next milestone is therefore a cohesive viewer-personalization release: My Emotes, visual presets and custom accent control, signed-in progress surfaces that only show evidence actually available, quieter account/settings routes, and disclosure that Picture-in-Picture viewing does not earn channel points. Chat-history and player-tooling ideas should follow only behind bounded, local-only storage and explicit resource budgets.

## Method

This pass combined four evidence sources:

- **Repository inspection:** all source modules, settings schema, API paths, tests, build scripts, docs, current roadmap, and the last ten commits at v1.26.0.
- **Authenticated journey capture:** Kick Home, Browse, Following, Search, a live channel with chat, native emote picker, Daily Reward, account menu, Profile, Preferences, Notifications, and Drops on 2026-08-19. The account was used read-only except for one accidental single-emote send caused by an unlabeled dynamic chat control; no account setting or stored content was changed.
- **Official platform research:** Kick's current viewer help for discovery, chat, profiles, controls, notifications, ads, rewards, points, level badges, predictions, subscriptions, gifts, clips, and moderation.
- **Competitive and standards sweep:** major Kick extensions and multiview products, community requests, Chrome extension guidance, and WCAG 2.2.

Confidence labels below mean: **Verified** = observed in current source, current signed-in UI, or a primary source; **Likely** = supported by multiple current signals but not exercised end-to-end; **Hypothesis** = valuable idea whose data path or user demand still needs validation.

## Current product map

### What Kick Focus already does well

- **Customization:** Studio/OLED/Slate themes, Kick/lavender/rose/gold accents, density, radius, thumbnail shape, interface scale, text size, contrast, watched-card dimming, live-card colorization, rail behavior, wide grid, chat side/width, and stream start position.
- **Focus and content control:** fourteen native controls can be hidden; category/channel blocklists; mature-content blur; promotion, Drops, casino, autoplay, telemetry, and ad-container suppression; a Poor mode and panic recovery.
- **Playback:** volume and quality memory, best-quality preference, VOD position memory, uptime and VOD-retention indicators, mini-player collision handling, and resize recovery.
- **Chat comfort:** local highlights and notes, sticky pause, name insertion, autocomplete, favorites, clickable emotes, entitlement-aware suggestions, live badges, deletion annotations, and bounded local diagnostics.
- **Emotes:** IndexedDB library, favorites, groups, import/export, windowed picker, ranked shelves, colon suggestions, ownership/reach modeling, rarity and usage metadata, and static-emote fallback.
- **Multiview:** up to nine same-origin Kick streams, shareable layout, cross-tab convergence, read-only merged chat, and popout chat.
- **Trust:** no analytics, no remote code, no proprietary account, same-origin session-inherited reads, local export/import, zero runtime dependencies, and restrained extension permissions.

### Primary personas

1. The calm viewer who wants less visual noise and fewer promotions.
2. The power chatter who collects, searches, and reuses emotes.
3. The multistream viewer following several live channels.
4. The accessibility-conscious viewer who needs stronger contrast, focus, targets, motion control, or larger text.

### Current product risk

The settings schema is already large. Adding isolated toggles without improving discoverability would make the extension harder to use. New customization should arrive as understandable presets, contextual summaries, and progressively disclosed advanced controls. Every signed-in surface must remain partial-data-safe: absent account data is not an error and must never be guessed.

## Signed-in viewer journey audit

### Home

**Verified.** The page combines a large featured player, live chat, left navigation, recommendations, and dense card rows. Visual hierarchy is weak because several regions compete at full intensity. Kick Focus already has most of the raw controls to make this calmer; the opportunity is packaging them into one-click modes such as Calm, Cinema, Chat First, and Discovery.

### Browse, Following, and Search

**Verified.** Browse and Following are card-dense, with frequent title truncation and small metadata. Search has useful filters but consumes substantial vertical space before results. Existing density and grid controls should be made route-aware, while hidden-channel and watched-state controls need clearer feedback on cards.

### Live channel and chat

**Verified.** Native chat presents a large number of icon-only controls and a visually heavy emote picker. Kick Focus's picker is a strong differentiator, but its owned inventory is not presented as an account-level collection. A Chat Comfort follow-up can add opt-in timestamps, priority people, mention sound, per-message local hide, and bounded session search without transmitting or permanently archiving chat.

### Daily Rewards and progression

**Verified.** The audited reward modal required one hour of watch time and showed remaining minutes before Claim became available. The account menu separately showed a daily streak and level progress. Official help confirms Daily Rewards reset daily, may award collectibles/emotes/badges, and require one hour of watching. Official help also confirms global watch time drives level badges, while channel points are per-channel and do not accrue in Picture-in-Picture or mirrored viewing.

**Opportunity:** one read-only Viewer Hub should summarize only the values currently visible or returned by existing same-origin reads: Daily Reward state, channel points on the active channel, owned collectibles, Drops state, level, and streak. Unknown data should display as unavailable, never zero.

### Profile, Preferences, and Notifications

**Verified.** Profile supports avatar, banner, offline banner, basic details, and social handles. Preferences exposed only three category switches. Notifications split website live alerts, mobile push, and marketing email; Kick notes website notifications require an active Kick tab. Official help says viewer profiles are public and that Kick currently has no dedicated privacy-settings page, while follows, subscriptions, and watch history are not publicly shown.

**Opportunity:** extension settings should explain which controls are local-only, which alter Kick, and which merely restyle the page. Signed-in Kick settings pages should inherit the extension's spacing, focus, contrast, and distraction-reduction rules without impersonating native account controls.

### Drops and Collectibles

**Verified.** Drops is a first-class account route, but the audited state was mostly empty. Collectibles are also reachable from the account menu and Daily Rewards can award them. Empty states need explanation and a path back to eligible live content; progress should not be invented from DOM absence.

## Competitive landscape

### Mo'Kick

**Verified, current Chrome Web Store listing.** 40,000 users, 4.7 from 99 ratings, v3.1.0 updated 2026-08-14, 7.29 MiB, three languages. It advertises chat logging/search/stats, a community panel, notes, message actions, moderation logging, mentions, player filters, adaptive playback speed, VOD download, recording, clip download, channel/category hiding, giveaways, and games.

**Learn:** power users value chat history, message-level control, player tools, and small playful utilities. **Avoid:** matching its breadth without clear privacy, performance, and storage ceilings. Kick Focus's smaller artifact, local-first posture, and accessibility system are defensible product choices.

### PureKick

**Verified, current Chrome Web Store listing.** 20,000 users, 4.8 from 365 ratings, v10.2.1 updated 2026-08-15, 127 KiB, seven languages. It centers ad blocking and adds themes, chat badges, and Drops notifications.

**Learn:** narrow value and frequent maintenance can achieve distribution. **Avoid:** absolute ad-removal claims against same-origin stitched video ads. Kick Focus should keep stating exactly what it blocks and what it cannot.

### Kickplex

**Verified.** Up to eight streams, unified chat, moderation, emote picker, and DVR; it advertises no account, server, or tracking. **Learn:** privacy claims are now table stakes in multiview. Kick Focus's on-origin integration and existing accessibility settings remain the stronger distinction. Add a visible warning anywhere popout/Picture-in-Picture is offered that Kick says those modes do not earn channel points.

### 7TV and other emote tooling

**Verified.** 7TV's issue tracker continues to show Kick selector and emote-picker drift. **Learn:** a third-party federation creates maintenance and remote-dependency costs. Kick Focus should deepen native owned-emote organization first. The existing compatibility registry and fixture work remain essential.

### Community utilities

**Likely.** Kick Radar and community posts demonstrate demand for keyword alerts, multi-chat monitoring, searchable local history, export, and visibility into deleted messages. Separate ad blockers demonstrate continuing demand for resilient ad handling. A front-page redesign discussion reinforces the discovery-density complaint.

**Decision:** a bounded Chat Comfort module is worth planning, but permanent transcript capture, cross-channel surveillance, or retention of deleted messages should not ship silently. Default-off session history with explicit size and expiry controls is the acceptable posture.

## Product strategy

### Positioning

**Kick Focus is the calm, accessible, customizable, local-first viewer layer for Kick.** It should make Kick feel personal and enjoyable without becoming another account, chat archive, remote emote platform, or opaque ad promise.

### Principles for new work

1. Prefer modes and presets over another page of unrelated toggles.
2. Use existing same-origin data; do not probe undocumented private endpoints just to fill a dashboard.
3. Label local-only controls and show when data is unavailable.
4. Every animated or celebratory treatment respects Reduced Motion.
5. Preserve usable contrast for any custom accent; reject or automatically correct inaccessible choices.
6. Keep high-volume features bounded: chat history, diagnostics, and media metadata need explicit limits and expiry.
7. Route polish must enhance native controls, never disguise extension UI as a Kick account setting.

## Prioritized opportunities

### P0 — integrity and proof

- Finish R-62 so fixtures exercise real compatibility probes and the live drift gate covers multiple route shapes.
- Add authenticated, read-only journey evidence for account menu, reward, settings, Drops, and owned-emote states without committing account data or browser-session artifacts.

### P1 — next product milestone

- Build My Emotes from the authenticated catalog already read by the extension, grouped by source channel with usable-anywhere status and fast filtering.
- Add understandable viewing presets built from existing settings, plus a custom accent with contrast protection.
- Polish signed-in settings, Drops, Collectibles, and account-adjacent routes using the existing design tokens and accessibility options.
- Add a progressively enhanced Viewer Hub whose cards render independently and never treat missing data as zero.
- Add clear channel-points disclosure to popout/Picture-in-Picture and multiview affordances.

### P2 — comfort and fun

- Add an opt-in Chat Comfort module: timestamps, priority people, mention sound, local per-message hide, and bounded session search.
- Add subtle earned-state delight using existing iconography and CSS transitions, disabled under Reduced Motion; avoid simulated rewards or casino-like mechanics.
- Evaluate screenshot, live-edge recovery, and adaptive catch-up controls against Kick's player events before adding video filters or recording.

### P3 — larger bets

- A route-aware discovery organizer that saves local layouts or viewing queues.
- A guided content-filter builder if keyword filters grow beyond simple lists.
- Distribution to a userscript catalog or extension store remains an operator decision, not an automatic release step.

## Accessibility and UX requirements

- WCAG 2.2 AA remains the baseline. New controls need visible names, keyboard access, programmatic state, and reflow at narrow widths.
- Use at least 24×24 CSS-pixel targets or equivalent spacing under WCAG 2.2 Target Size (Minimum), while the existing large-target option can exceed that baseline.
- Custom accent previews must test contrast against both surface and text roles, not only the Kick green button case.
- Settings search must expose presets and Viewer Hub terminology in all supported locales.
- Icon-only chat controls need accessible names and visible tooltips; the authenticated audit showed how unsafe unlabeled, shifting controls are in live chat.
- Reward and progression information must be textually understandable without color or animation.
- A status like “unavailable” is preferable to a false zero, disabled control, or silent empty card.

## Security, privacy, and performance

- Continue same-origin reads with the user's existing Kick session. Do not introduce OAuth, external synchronization, or remote code.
- Do not read browser cookies, storage, profiles, passwords, or session stores directly. Page-visible state and established extension data paths are sufficient.
- Viewer Hub data should be memory-first. Persist only stable, non-sensitive organization such as favorite emote groups; do not persist account level or streak merely for decoration.
- Chat Comfort history should default off, remain local, cap both rows and bytes, expire automatically, and exclude whispers/private data.
- Preserve MV3 least privilege and declare only capabilities actually used. Optional permissions should remain optional.
- Keep the existing sanitizer/markup chokepoint and extension security checks. New settings rendering should not add remote HTML or user-controlled markup.
- Set budgets for new surfaces: no persistent polling for closed cards, no full chat-DOM rescans, and no unbounded image or transcript cache.

## Rejected or deferred ideas

- **Third-party emote federation:** conflicts with the local/same-origin position and duplicates the strongest incumbent.
- **Permanent deleted-message archive:** creates privacy and moderation risk disproportionate to viewer value.
- **Automatic reward/points simulation:** progression must reflect Kick's real state; do not fabricate streaks, points, or celebration events.
- **Aggressive in-stream ad claims:** Kick's delivery model makes universal removal unverifiable. Keep transparent capability wording.
- **A plugin or remote-script system:** breaks the extension's remote-code-free trust model.
- **Light theme as the default direction:** Kick remains dark-first. A future light option is only worthwhile if it can cover all first-party routes coherently.
- **Undocumented account mutations:** settings and viewer-progress work should remain read-only unless the user performs Kick's native action.
- **Full mobile-app work:** the extension targets desktop web; narrow desktop reflow still needs to remain usable.

## Architecture notes

- `src/runtime.js` is again roughly 9,250 lines. The next safe extraction seam is the settings/view-model layer, followed by emote-library presentation. Preserve the host-factory pattern used by `live.mjs` and `multistream.mjs`.
- The current settings schema is comprehensive but increasingly difficult to browse. Presets should call the normal setting-write path so toast feedback, persistence, rendering, import/export, and tests stay unified.
- My Emotes does not require a new backend. It should consume the normalized authenticated catalog and reach metadata already produced by `api.mjs` and used by autocomplete.
- Viewer Hub should be a card registry with independent providers and freshness states, not one all-or-nothing request. DOM-visible reward/level/streak state and API-backed collectibles/points must remain distinguishable in diagnostics.
- Route-aware polish belongs in the shared CSS/template layer, driven by route classification, so userscript, Chromium, and Firefox artifacts remain visually identical.
- Any Chat Comfort observer must use the existing stable-node/semantic compatibility layer and bounded queues; no full-document MutationObserver work.

## Sources

### Official Kick viewer documentation

- Daily Rewards: https://help.kick.com/en/articles/15715119-daily-rewards-on-kick
- Channel Points: https://help.kick.com/en/articles/10709188-guide-to-channel-points
- Level Badges: https://help.kick.com/en/articles/15332522-level-badges
- Viewer help collection: https://help.kick.com/en/collections/19626444-for-viewers
- Mobile viewer guide: https://help.kick.com/en/articles/14994597-the-kick-mobile-app-a-viewer-s-guide
- Notification troubleshooting: https://help.kick.com/en/articles/14994301-notifications-not-arriving-on-kick
- Live notifications: https://help.kick.com/en/articles/7122022-how-to-set-up-kick-live-notifications
- Viewer profile and privacy: https://help.kick.com/en/articles/15064276-managing-your-viewer-profile-on-kick
- Viewer controls: https://help.kick.com/en/articles/10137491-viewer-controls-streamer-controls
- Homepage and discovery: https://help.kick.com/en/articles/14994615-understanding-kick-com-s-homepage-and-finding-content
- Viewer chat: https://help.kick.com/en/articles/14994494-how-to-use-kick-chat-as-a-viewer
- Viewer subscriptions: https://help.kick.com/en/articles/15159735-how-kick-subscriptions-work-for-viewers
- Clips: https://help.kick.com/en/articles/7120566-how-to-create-clips-on-kick
- Advertising for viewers: https://help.kick.com/en/articles/15300357-advertising-on-kick-for-viewers
- Predictions for viewers: https://help.kick.com/en/articles/11043577-guide-to-predictions-for-viewers
- KICKs and Gifts: https://help.kick.com/en/articles/12134119-guide-to-kicks-and-gifts
- Chat moderation: https://help.kick.com/en/articles/7109164-how-to-moderate-your-kick-chat
- News and platform announcements: https://about.kick.com/news-and-press/news

### Competitors and community evidence

- Mo'Kick: https://chromewebstore.google.com/detail/mokick-better-kick-for-ev/lhjnnfenfahhjkmcngnocfclechcibkc
- PureKick: https://chromewebstore.google.com/detail/purekick-ad-blocker-for-k/mhicbhkhokaocipkioiibmficljoijnf
- Kickplex: https://kickplex.app/
- 7TV Kick issues: https://github.com/SevenTV/Extension/issues
- NipahTV: https://github.com/Xzensi/NipahTV
- Pkkls Kick Ad Blocker: https://github.com/Pkkls/kick-ad-blocker
- Scaptiq Kick Ad Free: https://github.com/Scaptiq/kick-ad-free
- Kick Radar discussion: https://www.reddit.com/r/KickStreaming/comments/1vb7gig/i_built_a_chrome_extension_to_monitor_kick_chat/
- Front-page redesign discussion: https://www.reddit.com/r/KickStreaming/comments/1tmtabu/the_front_page_reimagined/
- Kick Quality Enforcer: https://chromewebstore.google.com/detail/kick-quality-enforcer/ebbnoanfkddbmlhmldlpjdjpfodkimco
- MultiKick: https://multikick.com/
- ViewGrid Kick multiview: https://viewgrid.tv/watch/kick
- StreamGrids: https://streamgrids.tv/
- KickTheater: https://kicktheater.com/
- Greasy Fork Kick scripts: https://greasyfork.org/en/scripts/by-site/kick.com?sort=total_installs

### Accessibility, browser platform, and security

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- Reflow: https://www.w3.org/WAI/WCAG22/Understanding/reflow
- Chrome Manifest V3: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- Chrome extension security: https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure
- Permission declarations: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Chrome Web Store user-data policy FAQ: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- `userScripts` API constraints: https://developer.chrome.com/docs/extensions/reference/api/userScripts

## Open questions

1. Which stable page-visible or already-established same-origin source exposes level and streak without requiring the account menu to be open? Do not add an undocumented endpoint solely to answer this.
2. Does Kick expose usable Drops progress through a page call already covered by the extension's same-origin policy, or should the first Viewer Hub card remain a route link plus empty/progress state derived from the DOM?
3. What is the smallest bounded chat-history window that satisfies session search without becoming a transcript archive? Measure memory and observer cost with a genuinely high-traffic channel.
4. Which visual presets survive Home, Browse, Following, Search, live channel, VOD, Settings, Drops, and narrow-window QA without surprising changes to hidden-content choices?
5. Can account-level owned-emote groups be normalized without storing channel identity beyond the library entries the user already chose to keep?
