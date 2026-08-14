# Research and visual audit

Snapshot date: **2026-08-14**

Target: **https://kick.com/**

Scope: **desktop only** — 1440×900 primary, 1920×1080 secondary

Auth state: **logged out**

## Project discovery

No existing local userscript or browser extension targeting `kick.com` was found in the workspace or the inspected common repository roots.

Two nearby repositories were explicitly excluded:

- `KickClaim` is an Electron/Node watcher and account-claim utility with its own browser profile, not a site-customization project.
- `StreamKeep` extracts Kick stream/chat data and has a localhost companion extension, not a Kick UI modification.

Neither repository was modified. Kick Focus was scaffolded as the smallest standalone, dependency-free userscript project.

## Method

The live site was inspected in a current Chromium surface on 2026-08-14. The audit used visible 1440×900 captures, accessibility snapshots, live DOM geometry, SPA navigation, and network event capture with cache disabled for baseline channel loads. The secondary 1920×1080 pass validated computed geometry and horizontal overflow.

Audited logged-out surfaces:

1. `/` — Home
2. `/browse` — Browse
3. `/browse/categories` — Categories
4. `/browse/clips` — Clips
5. `/category/just-chatting` — Category detail
6. `/lordkebun` and `/hstikkytokky` — live channel/player/chat
7. search suggestions for “music”
8. `/search?query=music` — search results
9. Log In modal

Authentication, creator dashboard, subscriptions, wallet, and account settings were not entered because no credentials were supplied.

## Live design tokens and structure

Observed Kick tokens on 2026-08-14 included:

- Primary: `#53fc18`
- Surface base/highest/lowest: `#171a1c`, `#232629`, `#0b0b0c`
- Main text / secondary text: `#ffffff`, `#9fa6ad`
- Navbar height: 60 px
- Sidebar expanded/collapsed: 256 px / 56 px

Stable-enough hooks observed across the audited routes:

- `#sidebar-wrapper`
- `#main-container`
- top-level `nav`
- stream/category cards containing `group/card`
- category grids containing `group/grid`
- `[role="separator"][aria-label="Resize chatroom"]`

The site navigates as an SPA and reinserts dynamic content. Kick Focus patches `history.pushState` and `history.replaceState`, listens to `popstate`, and uses a debounced child-list observer. It does not poll.

## Visual audit findings

| Surface | Finding | Severity | Implemented response |
| --- | --- | --- | --- |
| Global shell | The permanent 256 px rail removes too much horizontal space at 1440 px. | High | Compact defaults to Kick’s native 56 px rail; Auto and Hidden remain available. |
| Channel | At 1440 px the baseline split was roughly 256 px discovery + 340 px chat, leaving the player squeezed. | High | Focus and Theater modes, configurable 320–520 px chat, and Docked/Hidden chat. |
| Channel | Player, metadata, recommendations, and chat compete without a fast task-mode switch. | High | `Ctrl+K` command menu and one-key Focus, chat, and sidebar controls. |
| Browse/Home | Card density and available width are not coordinated with sidebar state. | Medium | Auto-fit grids; 310 px cards at 1440 and six 280 px columns at 1920 in the verified browse state. |
| Category | The hero/summary region consumes substantial vertical space before useful choices. | Medium | Denser global spacing and wider grid; deeper hero restructuring stays on the roadmap because its DOM is more volatile. |
| Search | Results lack a persistent count/clear affordance and can compete with mini-player overlays. | Medium | Stronger shared card layout now; dedicated result tools remain on the roadmap. |
| Cards | Mature, casino, promoted, Drops, and autoplay content do not share one user-control surface. | Medium | Central Content & Ads page with persistent filters and a temporary mature reveal. |
| Accessibility | Layout changes have no user-facing shortcut map or assistive announcement layer. | Medium | Visible focus, larger targets, text sizing, reduced motion, announcements, and conflict-checked shortcuts. |
| Settings | No pre-existing Kick Focus settings existed. | High | Five complete ImageGen-led pages implemented in a code-native shadow-root dialog. |

## Ad and tracking request map

The baseline channel pass showed that ad capability is separate from core playback:

- Playback metadata contained `video_player.google_ads_sdk`, `video_player.pal_sdk`, and `video_session.auto_ads_enabled`.
- On the sampled 2026-08-14 loads, `lordkebun` returned `auto_ads_enabled: false`; `hstikkytokky` returned `auto_ads_enabled: true`.
- The playback URL itself remained first-party/stream delivery and was deliberately allowed.

Observed separable destinations and surfaces:

| Destination or surface | Observed role | Kick Focus action |
| --- | --- | --- |
| `imasdk.googleapis.com/pal/sdkloader/pal.js` | Google PAL SDK bootstrap | Dynamic script block + DOM removal |
| `securepubads.g.doubleclick.net/tag/js/gpt.js` | Google Publisher Tag bootstrap found in the live DOM | Dynamic script block + DOM removal |
| `pagead2.googlesyndication.com/getconfig/sodar` | Google ads configuration XHR | Fetch/XHR block |
| `pubads.g.doubleclick.net/adsid/integrator.json` | Ads identity integration, including preflight | Fetch/XHR block where page-realm separable |
| `partner.googleadservices.com/gampad/cookie.js` | Ads cookie integration | Fetch/XHR/dynamic-element block |
| `securepubads.g.doubleclick.net/live/pcs/view` | Ads view event | Fetch block |
| `pubads.g.doubleclick.net/pagead/live/interaction/` | Ads interaction event | Fetch block |
| IDs such as `google_ads_*`, `div-gpt-ad`, ad-slot attributes, ad iframes | Ad containers/shells | Immediate CSS suppression + observer removal |
| `*.litix.io`, `browser-intake-datadoghq.com`, `reporting.cdndex.io` | Observed third-party media/error telemetry | Optional page-realm block |

Allowed by design:

- `web.kick.com` session, chat, leaderboard, drops, and playback APIs
- `stream.kick.com` and IVS playback manifests
- Kick realtime/websocket endpoints
- Stripe and reCAPTCHA flows needed by account/payment UI
- OneTrust consent resources

### Before/after evidence

Baseline channel navigation produced requests to PAL, googlesyndication, DoubleClick, and Google Ad Services. After the userscript was activated in the same live page and the app navigated from `/hstikkytokky` to `/lordkebun` through its SPA:

- 58 normal requests were observed.
- 0 ad-domain requests reached the captured network layer.
- Kick Focus reported 7 page-realm blocks.
- Kick Focus removed 2 already-present ad scripts/shells.
- The stream route, player, chat, and the Kick Focus root remained mounted.

The sanitized in-memory log showed the DoubleClick view/interaction endpoints and Litix telemetry being intercepted without retaining query strings.

### Technical boundary

This is a userscript, not a Manifest V3 extension. Violentmonkey documents that `document-start` runs as early as possible but other page scripts may still run first. Tampermonkey documents that its experimental `@webRequest` path is unavailable in Manifest V3 versions 5.2+ on Chrome and derivatives. Chrome’s supported pre-request mechanism is an extension `declarativeNetRequest` ruleset.

Accordingly, the current promise is: **block every observed ad request that is technically separable at the earliest reliable userscript page layer; remove known shells and reinsertion; do not claim control over earlier parser/worker delivery or server-side stitched media.**

## Settings design and parity

There was no existing userscript UI to capture. The live Kick channel screenshot and the selected Focus Canvas direction were therefore used as the visual sources for five complete ImageGen settings destinations:

- `design/mockups/settings-layout.png`
- `design/mockups/settings-appearance.png`
- `design/mockups/settings-content-ads.png`
- `design/mockups/settings-accessibility-shortcuts.png`
- `design/mockups/settings-about.png`

The code-native implementation preserves every modeled control, the left navigation, autosave state, footer actions, reset confirmation, shortcut conflict error/recovery, import validation, diagnostics, and responsive desktop geometry. The 1440×900 implementation was compared directly with the Layout mockup; panel size, hierarchy, spacing, borders, radii, dark surfaces, and single-accent treatment matched closely. Text-only navigation was intentionally used instead of fabricating icon assets.

## Functional verification

Verified on the live site:

- Shadow-root settings dialog and command menu mount without replacing Kick DOM.
- All five settings destinations are reachable and semantically labeled.
- Content toggle autosave and filtering lifecycle.
- Shortcut capture rejects `Ctrl+K` when already assigned and exposes Cancel recovery.
- Reset page opens a scoped confirmation and Cancel restores the prior state.
- Focus mode hides both sidebar and chat while leaving player/top navigation available.
- SPA channel-to-channel and channel-to-browse navigation preserve the userscript root.
- Browse at 1440: native sidebar collapsed to 56 px, four computed 310 px columns.
- Browse at 1920: six computed 280 px columns, no horizontal document overflow.
- Settings at 1920: centered 1080×804 shell, no horizontal page overflow.
- Node build, metadata checks, syntax check, and 6 core tests pass.

## Competitive/community scan

The current market is feature-rich but fragmented:

- **Enhancer** has broad adoption and emphasizes stream latency, attachments, mentions, clips, and watch-time utilities across Twitch and Kick.
- **Kick Augmenter** is a very broad player/chat utility suite: volume and quality memory, VOD resume, rewind, chat pause, favorites, moderation, browse sort, settings portability, and experimental ad softening.
- Community extensions frequently target one narrow pain point: chat moderation/history, chat placement, giveaways, or keyword monitoring.

Kick Focus’s useful differentiation is a cohesive desktop layout system, an ImageGen-led in-page settings center, accessibility controls, command-driven task modes, privacy-local settings, and explicit ad-defense evidence/limitations. Player memory, favorites, and deeper chat utilities are credible follow-ups, but duplicating every competitor feature would dilute the core.

## UNVERIFIED

- A true cold load under a real userscript manager could not be instrumented in the available browser because it does not support persistent pre-navigation script injection. The built artifact has `@run-at document-start`, but cold-start manager timing remains unverified.
- Logged-in account, subscription, wallet, creator dashboard, and moderator flows.
- A naturally delivered visible ad creative or timed mid-roll during the audit window; ad plumbing and requests were observed, but a creative was not waited out.
- Worker-only and server-side stitched ad delivery.
- Firefox/Safari behavior and non-Chromium userscript sandboxes.
- Long-duration playback stability with telemetry reduction enabled.

## Brittle hook watchlist

1. `[role="separator"][aria-label="Resize chatroom"]` and its next sibling identify chat. If Kick changes the accessible label or nesting, Right/Docked/Hidden chat can stop applying.
2. `#sidebar-wrapper` and Kick’s native “Collapse sidebar”/“Expand sidebar” labels drive compact mode.
3. Card filters use `group/card` class fragments plus visible labels. Those are safer than minified class names but still site-owned.

## Sources accessed 2026-08-14

- [Tampermonkey documentation — `@webRequest`](https://www.tampermonkey.net/documentation.php?locale=en&q=webRequest)
- [Violentmonkey metadata — `@run-at`, grants, and injection modes](https://violentmonkey.github.io/api/metadata-block/)
- [Chrome declarativeNetRequest reference](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [Kick browser compatibility and extension troubleshooting](https://help.kick.com/en/articles/14994226-browser-compatibility-and-recommended-settings-for-kick)
- [Enhancer — Chrome Web Store](https://chromewebstore.google.com/detail/enhancer/knaodoefkjbgmmilogebghadhmnphjih)
- [Kick Augmenter — Chrome Web Store](https://chromewebstore.google.com/detail/kick-augmenter/hdhpmccblalleagomabbfnpkbcpojfpd)
