# Research — Kick Focus

Snapshot: **2026-08-14 authenticated recon; 2026-08-15 isolated companion verification**

Target: **Kick desktop at 1440×900 and 1920×1080**

Project: `C:\Users\--\repos\kick-focus`, branch `main`, no configured Git remote

## Executive summary

Kick Focus 1.4.0 now addresses the current Kick desktop DOM rather than the older wrapper captured by the original implementation. The highest-impact defects were confirmed, not inferred: Following and Drops were classified as channels; most premium site CSS depended on a missing `#main-container`; Home's autoplay guard also cancelled deliberate playback; Search's clear state could repopulate from the URL; and the sticker catalog repeated work during unrelated chat mutations. Those paths are repaired and covered by unit, fixture, artifact, and isolated live-extension checks.

The authenticated native sticker picker exposes global, collectible, channel, and subscriber groups. Kick marks unavailable subscriber buttons disabled. Kick's current help material says subscriber emotes work only while the viewer has an active subscription; the typed name is the lookup token, not an entitlement grant. Kick Focus therefore records locked metadata for organization/export but never enables or sends a disabled sticker.

The site redesign is ImageGen-led on the Kick surfaces requested by the user: Home, Browse, Following, Drops, Category, Search, and Channel/chat. The implementation keeps Kick's real data and interaction model while applying a coherent graphite/charcoal shell, lime accent, clearer tabs, denser cards, a wider chat frame, and a larger three-row sticker shelf. Dynamic stream imagery and live inventory intentionally remain native.

## Project and feature inventory

The active repository ships one source as a userscript, a Chromium Manifest V3 companion, and a Firefox Manifest V2 companion. Nearby Kick repositories were inspected and do not overlap this layout/chat scope. Raw MHTML captures in `page_examples/` remain ignored.

| Feature group | Intended surface | Trigger/lifecycle | 2026-08-15 status |
| --- | --- | --- | --- |
| Premium shell, sidebar, cards, tabs | All covered Kick routes | document start + capped mutation apply + SPA route event | **VERIFIED** on fixtures and isolated live Home; semantic `main` fallback repaired |
| Focus/theater/chat/sidebar layouts | Channel and discovery | settings attributes + stable shell probes | **VERIFIED** by fixtures; authenticated extension journey remains separate-profile work |
| Search context and clear | `/search?query=…` | each apply cycle; click action writes native input event | **VERIFIED**; clear leaves input focused and no longer restores stale text |
| Drops empty guidance | `/drops/*` | only when native empty root exists | **VERIFIED** in the Drops fixture; links are ordinary read-only navigation |
| Card favorites, dismissals, filters | Discovery and sidebar cards | structured card/category/badge scan | **VERIFIED** by fixtures and 27 scored live Home cards; fail-open stayed inactive |
| Home autoplay suppression | `/` | every content-filter pass, once-bound media listeners | **VERIFIED** structurally; background play remains muted/paused and deliberate pointer/keyboard play is allowed |
| Chat pause, keywords, notes, diagnostics | Channel/chat | channel probes + bounded observers | **VERIFIED** by fixtures; no live writes performed |
| Sticker discovery and organizer | Open `#chat-emotes-picker-panel` | picker-specific mutation dirty flag | **VERIFIED** with 143 available + 1 locked fixture stickers and authenticated native-picker recon |
| Sticker persistence/import/export | Settings Content page | local storage/GM storage + schema validation | **VERIFIED** by round-trip unit tests and browser Content-manager handoff |
| Page ad interception and shell removal | All matched pages | document-start fetch/XHR/beacon/element hooks + observer | **VERIFIED** by artifact tests and settled DOM assertion |
| Chromium network blocking | Kick-initiated ad hosts | static MV3 DNR rules | **VERIFIED** live in a disposable profile; natural and probe matches recorded |
| Firefox network blocking | Kick-initiated ad hosts | blocking `webRequest` listener | **PACKAGE-VERIFIED; LIVE UNVERIFIED** pending disposable Firefox run |

## Live surface map

All rows below were inspected in the built-in isolated browser while authenticated on 2026-08-14. Navigation stayed within the existing document for route changes sampled during recon, and the page rerendered asynchronously, so lifecycle support must remain idempotent and mutation-aware.

| Surface | URL pattern and material state | Project behavior | Status |
| --- | --- | --- | --- |
| Home | `/`; personalized hero/rails and live cards | premium shell, rails, autoplay guard, card tools | **VERIFIED** |
| Browse | `/browse`; Livestreams/Categories/Clips tabs, language/sort, grid | wide grid, tabs/cards, filters | **VERIFIED** |
| Categories | `/browse/categories` | category-card grid | **VERIFIED** |
| Category | `/category/<slug>` | category identity header + stream list | **VERIFIED** |
| Following | `/following`; Live Channels/Categories/Channels tabs | first-class route styling and rails | **CHANGED then repaired**; previously classified as channel |
| Drops | `/drops/campaigns`; Campaigns/Coming soon/Claimed/Expired; empty state sampled | first-class route and useful empty guidance | **CHANGED then repaired**; previously classified as channel |
| Search | `/search?query=<term>`; All/Livestreams/Channels/Categories | result count, query context, clear action | **CHANGED then repaired**; current search control is the global nav input |
| Channel/chat | `/<channel>`; player, channel content, live chat, open sticker picker | player/chat geometry, chat utilities, sticker shelf | **VERIFIED** |

The separate unpacked-extension profile reached real Kick rather than the bot wall on 2026-08-15 at both 1440×900 and 1920×1080. It was intentionally not given the authenticated session, because session export is prohibited.

## DOM, route, and data contract

| Contract | Consumer | Context | Status and stability |
| --- | --- | --- | --- |
| semantic `main`, then `#main-container` fallback | site layout, cards, route enhancements | discovery/search/category | **CHANGED / VERIFIED**; semantic element is current and more durable |
| `#sidebar-wrapper` | sidebar mode and rail scanning | all primary routes | **VERIFIED**, medium risk if Kick replaces the shell |
| `[data-testid="search"]` with ARIA/type fallbacks | Search context/clear | top nav and Search route | **VERIFIED**, low-to-medium risk |
| `[data-testid="livestream-results-card"]` and `[data-testid="media-card-thumbnail"]` | card styling/actions/filtering | Browse/Search/Following/category | **VERIFIED**, preferred stable test markers |
| `a[href^="/category/"]` and short badge leaves | content labels | stream cards | **VERIFIED**; avoids localized prose and false positives |
| `#injected-channel-player`, `#channel-content`, `#channel-chatroom` | channel layout and diagnostics | channel | **VERIFIED**, medium risk |
| `#chat-emotes-picker-panel` and disabled native buttons | sticker catalog/organizer | authenticated, picker open | **VERIFIED**, high-value/high-drift surface |
| History API + `popstate` + `kick-focus:routechange` | SPA lifecycle | all routes | **VERIFIED**; capped apply prevents mutation starvation |
| `/api/v*/…/playback` or `/stream/…/playback` | playback-ad payload rewrite | channel startup | **VERIFIED historically on 2026-08-14**; undocumented and high risk |
| `kick-focus:*` local keys | settings, media, favorites, notes, stickers | local profile | **VERIFIED**; companion bridge serializes settings as JSON across worlds |

Kick appears to be a hydrated/client-routed application: initial shell markup exists, History API changes do not replace the document, and route content arrives and rerenders after navigation. This is an evidence-based architecture inference, not a framework guarantee. No required open shadow root was found in Kick's content; Kick Focus itself uses one open shadow root to isolate its settings UI. Stripe and advertising/measurement frames are cross-origin and are never inspected for private content.

## Advertising surface and request map

| Placement/path | DOM or data hook | Host/endpoint, initiator, type, timing | Current control and proof |
| --- | --- | --- | --- |
| Google Publisher Tag bootstrap | `script[src*="securepubads.g.doubleclick.net"]`; possible GPT slots | `securepubads.g.doubleclick.net`, Kick initiator, script, cold/route load | MV3 rule 4 + page element hook + shell remover. Direct live probe returned `ERR_BLOCKED_BY_CLIENT`; no matching node remained after settle |
| Google ad request/creative path | GPT/Google ad slots and iframes | `pagead2.googlesyndication.com`, `pubads/googleads*.doubleclick.net`, `tpc.googlesyndication.com`, Kick initiator, script/XHR/frame/image | Eight generated DNR rules. Natural live load matched rule 2; ruleset/source parity is build-gated |
| Client-side video ad SDKs | playback JSON `auto_ads_enabled`, `google_ads_sdk`, `pal_sdk`, `ima_sdk` | first-party versioned playback response, then Google IMA hosts, channel startup | fetch/XHR response rewrite disables the flag and removes SDK blocks before player initialization; companion also blocks IMA host requests |
| Native sponsored/promoted cards | stable card plus Kick's own short badges | first-party card payload/DOM, route render | suppressed at render time only when structured evidence says promoted; transport is not claimed blocked because it is inseparable from the content response |
| Ad/measurement frames | iframe/script resource inventory included Google OMID-related resources | third-party frame/script, player/ad lifecycle | known ad frames removed by source selector; ordinary Stripe account/payment frames are preserved |
| Telemetry, not advertising | no ad-shaped DOM | `litix.io`, `browser-intake-datadoghq.com`, `reporting.cdndex.io` | separate optional ruleset, enabled by the default privacy setting after page settings arrive |
| Server-stitched media | no page DOM hook; HLS fetch lives in IVS WASM/blob workers | media worker, channel playback | **UNVERIFIED / not claimed removed**; existing page hooks cannot observe the manifest |

Cold-load extension proof on 2026-08-15 reached the real Kick shell, scored 27 cards, had no horizontal overflow, kept filter fail-open inactive, recorded natural DNR ad matches, and blocked a Kick-initiated securepubads probe before load. The verifier now also asserts zero known ad creative/shell nodes after the apply cycle. A clean load cannot prove every geography/account/campaign variant, so worker-only and server-stitched delivery remain explicit roadmap work.

Chrome's current DNR documentation confirms that static rules are packaged through `declarative_net_request`, can be toggled at runtime, and block before a request is made. Firefox uses `webRequest.onBeforeRequest` with `blocking`; MDN notes that both target and initiator access matter, which is why the generated Firefox package requests broad host access while enforcing a Kick-initiator guard in code.

## Sticker entitlement and organizer findings

The authenticated picker contained usable global/collectible/channel stickers and disabled subscriber stickers. The native button state is the authorization source. Kick's official documentation says the emote name is what a viewer types, but also says subscriber emotes can only be used by active subscribers and stop working when that subscription lapses. Therefore:

- copying or pasting a name does not create the server-side/account entitlement;
- synthesizing clicks or removing `disabled` would be a misleading UI bypass and was rejected;
- locked records may be cataloged, searched, grouped, and exported, but they are excluded from sendable and quick-favorite results;
- newly exposed stickers merge automatically while the picker is open;
- a picker-scoped dirty flag avoids rescanning all stickers on every unrelated chat mutation.

Browser fixture evidence: 143 available stickers plus one locked record were cataloged; 24 favorites produced a 156 px three-row shelf with 21 immediately visible shortcuts at seven columns; removing adjacent Sticker 80 and Sticker 81 kept the nested grid at `scrollTop=955` both times; adding Sticker 145 increased the catalog without reopening the picker; Manage opened the Content-page library.

## ImageGen design system and parity

Each prompt used the corresponding current Kick screenshot as its labeled reference, specified a 1440×900 desktop product UI, preserved real route semantics, and requested the same graphite canvas, charcoal panels, restrained lime accent, compact 56 px navigation, readable sidebar, dense cards, and clear mouse/keyboard states.

| Kick surface | Selected mockup | Implemented direction |
| --- | --- | --- |
| Home | `design/mockups/kick-home-premium.png` | premium shell, hero/card hierarchy, sidebar/chat framing |
| Browse | `design/mockups/kick-browse-premium.png` | dense four-column discovery, filter/tab treatment |
| Following | `design/mockups/kick-following-premium.png` | live-first tabs and followed-channel hierarchy |
| Drops | `design/mockups/kick-drops-premium.png` | campaign status layout and useful empty recovery |
| Category | `design/mockups/kick-category-premium.png` | identity header, metadata, stream grid |
| Search | `design/mockups/kick-search-premium.png` | visible query/count context and grouped result shell |
| Channel/chat | `design/mockups/kick-channel-chat-premium.png` | cinema player, 410 px chat, larger grouped sticker tray |

Generated images are references only; the functional UI is HTML/CSS/JavaScript. Direct comparison used the same-view Drops fixture/reference pair and the 1440×900 live Home/reference pair. Dynamic content composition differs, but shell geometry, panel hierarchy, color, borders, card treatment, tabs, and chat/sticker density follow the selected system. The isolated extension screenshots at both target desktop sizes showed no horizontal overflow or clipped core shell.

The five pre-existing settings mockups remain the source of truth for the settings shell and were regression-smoked after the site work:

| Settings page | Key material states | Mockup |
| --- | --- | --- |
| Layout | sidebar/chat modes, width, density, per-channel memory, reset/save | `design/mockups/settings-layout.png` |
| Appearance | Studio/OLED/Slate, accent, radius, thumbnails, live preview | `design/mockups/settings-appearance.png` |
| Content & Ads | filters, ad status/log, playback/chat, sticker library/groups/import data | `design/mockups/settings-content-ads.png` |
| Accessibility & Shortcuts | motion, contrast, focus, targets, text/captions, conflicts | `design/mockups/settings-accessibility-shortcuts.png` |
| About | compatibility, timing/layer diagnostics, export/import, panic/recovery | `design/mockups/settings-about.png` |

There is no light theme; Studio, OLED, and Slate are intentionally dark desktop surfaces. Focus, hover, disabled, conflict, saved, warning, confirmation, and panic-recovery states are code-native.

## Competitive and user evidence

7TV's current official changelog is the strongest adjacent benchmark. Its current Kick support includes an emote menu, autocomplete, favorites via Alt-click, a Favorites tab, default-tab selection, import/export backup, cross-tab search, lazy loading, and fixes for channel switching and scroll failures. The useful lessons for Kick Focus are durable local organization, fast scoped observation, search that reaches the right group, and obvious backup/recovery. Kick Focus's differentiator is that those ideas are applied to Kick's native account-authorized sticker catalog without importing a separate emote provider or remote executable code.

Recent public 7TV reports complain about unreliable loading and search fragmentation; these are sentiment signals rather than verified product facts. They reinforce two decisions already made here: the organizer stays useful when native groups rerender, and the catalog is cached locally and exportable.

| Candidate | Evidence and hook | Impact / effort / risk | Disposition |
| --- | --- | --- | --- |
| Persistent native sticker library + groups | authenticated picker DOM; 7TV favorites/backup parity | 5 / M / medium DOM drift | **Now — shipped** |
| Three-row quick shelf with scroll-stable removal | repeated-removal user report; picker button proxies | 5 / S / low | **Now — shipped** |
| Premium current-route shell | seven live route screenshots + semantic `main`/test IDs | 5 / L / medium drift | **Now — shipped** |
| Drops/search recovery context | native empty root and global search input | 4 / S / low | **Now — shipped** |
| Authenticated unpacked-extension matrix | separate-profile browser boundary | 4 / M / low privacy if handoff is direct | **Next** |
| Worker HLS observability | observed IVS worker targets | 4 / L / high playback risk | **Next, research only** |
| Third-party 7TV/BTTV provider ingestion | external APIs and separate entitlement model | 2 / XL / high maintenance/privacy | **Rejected** |
| Subscriber-emote entitlement bypass | disabled native state and account authorization | prohibited / misleading | **Rejected** |

## Security, privacy, and reliability

- The project contains no remote executable code, analytics, plaintext credentials, or session export.
- Chromium network rules are limited by Kick initiator and use generated host lists. Firefox needs `<all_urls>` for `webRequest` target access, but the listener returns no block unless the initiator is Kick.
- In a bare userscript/fixture environment, storage falls back to page-readable `localStorage`; userscript-manager storage remains preferred. This is a documented low-severity privacy boundary, not a secret store.
- Settings schema 2 migrates schema-1 sidebar/chat defaults while preserving explicit values. Future schemas fail closed on import with an explanation.
- Filtering uses structured category/badge evidence and a 25% fail-open ceiling on grids of eight or more, so selector drift is visible instead of silently emptying discovery.
- Critical probes and ad-stack shape surface in the About/Content diagnostics. The highest-drift remaining assumption is `#chat-emotes-picker-panel` plus the native disabled-button semantics.

## Verification summary

- `npm run build` produced synchronized 1.4.0 userscript, Chromium, Firefox, and zip artifacts.
- Node unit suite covers settings migration, explicit Following/Drops routing, filter boundaries, playback rewrites, sticker normalization and full library import/export.
- Fixture suite covers Home, Browse, Category, Search, Channel, localized chat, Drops, settings preview, and the 144-sticker stress surface.
- Browser journeys verified Search context/clear/focus/no overflow, Drops empty recovery, sticker auto-discovery, three-row capacity, adjacent removals with zero scroll delta, and Manage → Content library.
- Isolated live Chromium extension runs passed at exact DPR-1 CSS viewports of 1440×900 and 1920×1080 with real Kick DOM, no horizontal overflow, 27/41 cards detected, active companion handshake, natural DNR matches, explicit `ERR_BLOCKED_BY_CLIENT`, clean popup, and no popup exceptions.

## Sources (accessed 2026-08-15)

### Primary platform and Kick sources

- https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeRequest
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest
- https://help.kick.com/en/articles/7113467-how-to-add-or-edit-kick-emotes
- https://help.kick.com/en/articles/15159735-how-kick-subscriptions-work-for-viewers
- https://help.kick.com/en/articles/15715119-daily-rewards-on-kick

### Competitors and community signals

- https://github.com/SevenTV/Extension/blob/master/CHANGELOG.md
- https://github.com/night/betterttv
- https://github.com/FrankerFaceZ/FrankerFaceZ
- https://www.reddit.com/r/7TV/comments/1tlii8d/the_new_7tv_version_is_terrible_for_me/
- https://www.reddit.com/r/7TV/comments/1u4y268/7tv_takes_multiple_page_refreshes_almost_every/

## Open questions

1. Does the authenticated ad path differ when the unpacked companion is active? Authenticated recon and live companion proof were intentionally performed in separate isolated profiles.
2. Can the IVS worker be observed safely without altering playback, and does its manifest carry a stable stitched-ad signifier? No mitigation should ship before that is answered.
3. Does the generated Firefox package block current Kick requests end-to-end in Firefox 120+ without breaking player or chat?
4. How often does Kick replace the native sticker picker rather than mutate it in place? A sanitized drift-capture workflow is the next maintainability improvement.
