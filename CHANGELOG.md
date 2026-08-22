# Changelog

All notable changes are documented here. Dates use ISO 8601.

## Unreleased

### Fixed

- The Firefox package asks for Kick over https only. It requested `*://kick.com/*`, which includes an http half that never runs: the content-script matches and the background’s own origin set are both https-only. The ad and telemetry hosts keep both schemes on purpose, because a blocker has to refuse those either way.
- Interface scale now resizes the whole settings surface instead of only its root font size. The panel carries about 120 absolute font sizes and a ladder of fixed control heights, so at 90% or 110% no control ever changed size. It scales with zoom now, which takes the fonts, control heights, padding and dialog chrome together.

## 1.35.0, 2026-08-21

An audit pass. No new features, and every change here closes something that was
measurably wrong rather than something that looked untidy.

### Security

- An imported emote library can no longer point its artwork at an outside origin. The asset cleaner returned any relative path unparsed as long as it did not start with two slashes, but a browser reads a backslash as a slash for a special scheme, so a stored `/\host/emotes/x.png` resolved to `https://host/`. Opening the library then fired one request per emote at whatever origin the file named. Origin is now decided by resolving the value and comparing origins rather than by inspecting the start of the string.

### Fixed

- Importing a settings file exported by this build no longer reports that part of it was ignored. The export carries `lastSeenVersion`, which the importer did not recognise, so a plain round trip accused its own file of holding an unknown section.
- A settings file whose schema stamp is not a number now imports as unversioned instead of silently passing as current. `Number('abc')` is `NaN`, and `NaN` failed both the "too new" refusal and the "upgraded from" note, so a junk stamp cleared both.
- "High-contrast controls" now raises every border it promises to. It shared one attribute with the separate text-contrast setting, and the only rule reading that attribute was a text-shadow on Kick's main element, so it touched no control, border or surface. Sharing the attribute also meant switching either one off did nothing while the other was on. Control edges moved from between 1.15:1 and 2.78:1 up to at least 3.75:1 in all three themes.
- Closing Settings, the multi-stream grid or the command palette returns keyboard focus to the control that opened it. `document.activeElement` reports the shadow host, not the button inside it, so the recorded opener was an element that cannot take focus and the restore did nothing.
- The header Focus and Multi buttons, the Drops call to action, the emote autocomplete popover, the emote hover card, the followed-channel preview, the library tiles and the pop-out chat window all follow the chosen theme and accent. Each carried Studio's palette or Kick green as literals.
- The custom accent gate checks the surfaces an accent is actually drawn on. It sampled three near-black values, described as the darkest per theme, but an accent has its easiest contrast against black; accents that cleared it fell to 2.22:1 on Slate's hover surface.
- The violet accent is lightened on Slate, where it measured 4.01:1 as text against the raised surfaces, under the 4.5:1 that small text needs. Studio and OLED keep the original.
- Shortcut capture no longer traps the keyboard. Tab was swallowed as a shortcut candidate, leaving Escape as the only exit and the Cancel button unreachable, and the row never said so.
- The earned-reward dot draws its separator ring again. It referenced a custom property that this build does not define, and an undefined `var()` with no fallback invalidates the whole shorthand.
- A range slider's readout and its `aria-valuetext` follow the thumb during a drag instead of reporting the pre-drag value until release.
- The discovery card's uptime chip is announced with its label. It carried `aria-label` on a bare `span`, which gets no accessible name, so a screen reader heard the bare duration.
- The companion popup announces its status. It painted "Checking", rewrote the status and both stats after a message round trip, and only the footnote was a live region.
- "Corner radius" now reaches this build's own panel, whose rounded edges all resolved through a fixed ladder. The 7px default renders exactly as before.

### Changed

- Opening the command palette no longer pulls focus out of Kick's chat box. It closes Settings unconditionally to be sure the other surface is down, and once focus restoration started working that turned every open into a focus jump.
- The multi-stream grid keeps its own record of what opened it. It shared one slot with Settings, so opening the grid from a button inside Settings overwrote where Settings had to return to.
- "Clear hidden" is now "Clear not-interested", which is the list it clears. A separate hidden-channel list exists on the Content page, so the old label pointed at the wrong feature.
- "Export library" and "Export all settings" are both "Export settings". All three buttons ran the same full export, and one of them promised a library-only file.
- Five error messages that named a failure and stopped now say what to do next. The import, restore, clipboard, export and hidden-list-full messages each carry a next step.
- The companion popup uses one name for the network layer. It called the same thing the protection state, the network layer, network protection and the ad ruleset within one panel.
- Em and en dashes are gone from user-facing text, and multi-stream counts read the same way everywhere.
- The two dropped-entry import messages say "emote" rather than the internal word "sticker". Both translations already did.
- The header button announces "Resume Kick Focus" while it reads "Resume", so its accessible name contains its visible label.

## 1.34.0, 2026-08-21

### Added

- Live discovery cards now show elapsed stream time beside Kick's own LIVE marker when the page's existing discovery response includes a trustworthy `start_time`. The card stays unchanged when that value is missing or invalid, and Kick Focus makes no extra request to fill it.
- Chat can now sit on the left side of the player. The existing separator stays on the player-facing edge, drags in the expected direction from 320 to 520 px, and switching back to Right restores the original order.
- An optional composer recall keeps the last five public messages sent from the current tab in memory. Shift+Up cycles them, ordinary Arrow Up stays with Kick, whispers are skipped, and a reload clears the list.
- Hovering or focusing a followed channel in the sidebar now opens a compact preview from the image Kick already loaded. It stays inside the viewport, closes on Escape, and becomes a canvas still when Reduced Motion is active.
- The Viewer page now includes a local session watch clock. It counts only active playback in a visible channel tab, pauses with playback or visibility, identifies itself as browser-session-only, and resets on reload without writing a Kick level.

### Fixed

- Paused chat now holds the message you were reading in place while Kick adds messages and recycles older rows. If that message has already left the page, the transcript keeps its current position instead of jumping.
- Spanish and Portuguese now cover import validation, storage failures, save status, shortcut conflicts, and Viewer source notes. The translation gate also catches both branches of a conditional toast instead of missing them.
- The companion popup now follows Studio, OLED, Slate, and the selected accent instead of always rendering with Studio colors. Accent-backed actions choose true black or white text, including mid-gray custom colors that the previous near-black ink left below 4.5 to 1.
- Composer recall now ignores unrelated forms and generic editors outside channel chat. The session watch clock also refuses hidden preload video, while the browser gate proves native sidebar tagging and isolates the system Reduced Motion preference from the in-app setting.

### Changed

- Settings page composition now lives in its own module behind an explicit host boundary. The shipped interface is unchanged, while the page renderers, navigation model, settings search, and their dependencies can now be checked without keeping them inside the main DOM runtime.
- The live browser gate now measures text contrast across OLED and Slate settings, confirmation dialogs, toasts, and the companion popup without writing test settings into a retained browser profile. It also proves that an anonymous run reports every signed-in journey as a skip. Chromium passes 95 of 95 checks at 1440 by 900, and Firefox passes 8 of 8.
- Firefox verification now starts an isolated browser process, subscribes only to the network events it asserts, gives loaded-machine commands a bounded 90 seconds to answer, and retries a transient navigation refusal. Another Firefox harness or an unused log subscription can no longer stall the run.

## 1.33.0, 2026-08-21

### Added

- Every settings page now has a Help control in the footer, next to Export settings, including the search results view. The recovery and troubleshooting copy it opens has always been on the About page, but you had to already know that to find it.
- Scrolling the chat transcript up now freezes it, the same freeze the Pause chat button has always applied. Resume puts you back at the live edge. Kick's own pause-on-scroll has been broken for a while, and this is the setting you already had, reached the way you would expect to reach it.

### Fixed

- If Kick ever moves chat onto its own gateway, the first message this build reads over it marks that transport as working, and diagnostics say so. Until then Pusher is still preferred, and a gateway that opens a socket but never delivers a message still falls back to reading the page.
- Hiding a Kick control now only ever hides the control you named. The search that finds it has ordered fallbacks, so if Kick dropped a test id it would fall through to a looser selector and hide whatever that reached instead. Each hideable control records which selector is allowed to hide it; anything else leaves the control visible.
- Nothing in this build can hide Kick's Request Unban control. A banned reader has no other way back into a chat, so both halves are now checked: the classifier Poor mode hides from refuses every spelling of it, and the live gate fails if Kick put the control on the page and it is not visible.
- Resuming chat left the transcript sitting where it was frozen, which read as Resume doing nothing. It now returns to the newest message.
- The channel fixture and the shell contract said a channel page renders stream cards. It renders none, under any of the three probe shapes. Kick's React payload still serialises the card test id 22 times as script text, which is why the capture script had been calling it a reduction bug rather than drift; the capture now reads markers from the markup and not from inline script.

### Changed

- The emote library's synchronous seed is now bounded by bytes as well as by entry count. 400 ordinary emote records are about 116 KB, but 400 records at every field's ceiling would be 1.3 MB of browser storage sitting beside an injected script that has its own size ceiling. The full library is untouched; only the small copy read at startup is trimmed.
- Where the browser supports it, the text drawn on an accent colour is chosen by the browser rather than by one hardcoded value shared across every accent. The rule that rejects a custom accent too dark to work as a focus ring is unchanged.
- The build checks the userscript's size and the storage it will claim against one ceiling instead of measuring the file alone.
- The live gate reads Kick's Content-Security-Policy from the home and channel documents' own responses and fails if a script policy appears that would refuse the inline injection the Firefox companion depends on. Measured 2026-08-21: neither route serves one.
- The build strips comments from the generated bundles. The userscript is 774,847 bytes instead of 974,585, which moves it from 97% of Violentmonkey's ~1 MB injection ceiling down to 77%. Source comments are untouched; they live in `src/`, which is where anyone reads them.

## 1.32.0, 2026-08-21

### Fixed

- Hidden channels, favorites, watched cards, remote blocklists, per-channel layouts, notes, keyword lists, and volume memory now use the same canonical Kick path, so a card whose href is `/xqc/` still matches a stored `/xqc`.
- Importing a stickers-only file no longer resets every other setting to defaults. An empty file is refused. A failed import no longer leaves an Undo button. Factory reset now deletes the pre-import backup.
- Unreadable Kick JSON is reported as a parse failure instead of a network failure, and the catalog status line says so in words.
- Hideable Kick controls are left alone when a fallback selector matches a crowd of nodes instead of one control.
- Copied diagnostics include a settings diff and probe winners. Hidden channel lists appear as counts, not names.
- The emote picker search field and catalog error text follow theme tokens. The About error log empty row uses muted text. The companion Open settings button meets a 44px minimum height.

### Changed

- README now states that Kick's own help disagrees with itself on whether a channel subscription skips in-stream ads, and that this build cannot verify skip.

## 1.31.0, 2026-08-20

### Changed

- **The main Kick theme has a calmer visual hierarchy.** Navigation, route headers, stream grids, tabs, search context, Drops recovery, chat, and sticker tools now share clearer typography, tighter section spacing, quieter borders, and fewer raised surfaces.
- **Stream and category cards no longer look boxed in.** Thumbnails carry the visual weight while titles and metadata sit directly on the page. Hover and keyboard focus remain clear without a shadow lift or bright perimeter.
- **Studio, OLED, and Slate use less surface noise.** Each theme keeps its own depth and temperature while using subtler dividers, compact controls, and restrained selected states.
- **Route-specific references now cover every main surface.** Home, Browse, Category, Following, Drops, Search, and Channel/chat share one graphite-and-lime desktop system while preserving the structure and behavior Kick owns.

### Fixed

- Chat header styling no longer pads the live resize separator. Theater mode keeps the player and both chat layers bounded while resizing.
- Release screenshots now wait for temporary Undo controls to clear before capture.

## 1.30.0, 2026-08-20

### Changed

- **Studio, OLED, and Slate are now complete visual systems.** Each theme changes the page canvas, panel depth, raised controls, borders, hover surfaces, selected states, and muted text. Theme cards preview those layers directly, so choosing a theme is a visual decision instead of a name attached to nearly identical dark backgrounds.
- **The settings center has a stronger desktop hierarchy.** The panel is wider, the header carries only identity and status, navigation descriptions are shorter, and long pages are grouped into layered boards. Appearance starts with four compact directions, followed by distinct theme boards and smaller accent controls. The custom color row stays hidden until Custom is selected.
- **Multi-stream reads as a viewing board now.** Channel entry and playback controls have separate groups, the empty state has one clear action, saved boards live in a compact footer, and the canvas holds its center at narrower desktop sizes. Error, disabled, empty, and populated states share the same hierarchy.
- **The companion popup matches the same system.** Status, counts, controls, disabled actions, focus, and reduced-motion behavior use the same graphite surfaces and restrained green accent.

### Fixed

- Theme selection now restores focus to the exact control after a page re-render. Selecting OLED or Slate no longer leaves Studio with a second focus outline.
- The multi-stream footer no longer consumes the open canvas when its optional error row is hidden.
- The multi-stream empty-state logo is embedded into every built artifact instead of shipping an unresolved placeholder.

## 1.29.0, 2026-08-19

### Added

- **A Viewer page that reads what Kick already tells your account.** Daily reward, channel points, collectibles, Drops, level and streak in one place, and every card says where its number came from and how old the reading is. It reads only: nothing is claimed, changed, or sent anywhere, and the daily reward is still claimed by Kick's own dialog under the setting you already control.
- **Saved views for the discovery pages.** Keep the density, thumbnail size, rails and content filters you like as a named view, and have it applied when you open the pages you picked. Browse can be dense and unfiltered while Home stays calm. It is your own settings applied to what Kick already sent: it changes nothing about what Kick recommends, or the order anything appears in, and the interface does not pretend otherwise.
- **Five chat comfort switches, each independent and each off until you ask.** Message times, people worth noticing, a sound on a mention, hiding one message for yourself, and a search over what this session has seen. The times are Kick's own: it renders a timestamp on every message and hides it behind a CSS variable, so the switch reveals the real send time rather than writing down when this build first saw the message.
- **The session chat search is bounded three ways and never written down.** It holds 400 messages, 200 KB, and one hour, whichever runs out first. It lives in memory, so a reload clears it. Whispers are never recorded. A message a moderator removes leaves the log the moment the deletion arrives, because a local copy of something Kick deleted is exactly the thing not to keep. It leaves the machine only when you press the button that saves it as a file.
- **One quiet marker, for the one thing Kick actually says is waiting.** When a daily reward is there to take, the Focus button and the Viewer tab say so: a dot, a short line of text, and the same words in the button's accessible name. Nothing pulses under Reduced Motion, nothing is signalled by colour alone, and a signed-out page gets no marker at all. There is no streak flourish, no progress bar toward a reward, and no "you are close" copy, because Kick publishes no such state and a client inventing one is pressure rather than delight.
- **A card with no reading says so.** This is the whole design. An empty balance and a balance nobody could read are different things, and showing zero for the second one is a lie a summary tells easily. Signed out, or off a channel, or with the reward dialog closed, each card explains itself in a sentence instead. Cards fail one at a time too, so a collectible read that Kick refuses costs one card and not the page.

### Changed

- **The offline DOM fixtures are read as documents now, not as text.** Each fixture is parsed and run through the same compatibility snapshot the mod takes on every apply cycle, and the suite checks that every shell hook resolves to the probe Kick really serves on that route, and that the values derived from those hooks still come out. The previous check only asserted that a hand-written file contained a list of substrings, so it stayed green while several of those substrings had already vanished from the live site.
- **The live compatibility gate sweeps every route it can reach.** It used to run against the home page alone, which hid two long-standing fall-throughs: a channel page carries no `#main-container`, so the main hook has been resolving through a plain `<main>` for months, and the home page's featured preview resolves the chat panel through its third probe. Home, browse, category, search and a channel are now each opened in turn and compared against a recorded per-route expectation, so a stable hook coming back is reported as clearly as one going away.
- **The signed-in journeys are a matrix the gate reads, not a paragraph somebody wrote.** Account menu, Daily Reward, Profile, Preferences, Notifications, Drops, Collectibles and the authenticated emote catalog each name the route, why it needs a session, and the selectors this build depends on there. Logged out, the run prints one skip per journey saying what a signed-in run would assert, so a release reports what it covered rather than implying it covered everything. Pointing the gate at a profile that is already signed in turns those skips into assertions.
- **The read-only claim is now falsifiable.** Every journey in that matrix reads selectors and counts, never a display name, balance, notification text or chat line, and the offline gate proves the build's only account writes are the follow request behind the click-to-save emote gesture and the unfollow that reverses it. A third one fails the build.
- **Markers Kick no longer serves have been retired, with the reason attached.** `kicks-top-nav`, the `Resize chatroom` label, `search-results`, `channel-player` and the `chatroom` test id all return nothing on the live site and are recorded as retired rather than quietly deleted. Fixture scaffolding that Kick never served, like the button that simulates an incoming chat sticker, is now labelled as scaffolding instead of passing for a real hook.

Maintainer tooling only. The shipped userscript and both companion extensions behave exactly as they did in 1.28.0.

## 1.28.0, 2026-08-19

### Added

- **Channel profiles now open directly in StreamerStats.** A native-sized **Stats** action sits beside Follow on live and offline channel profiles. It validates the current Kick slug, opens the current `streamerstats.com/kick/channels/{channel}` analytics route in a centered 1180×820-or-smaller popup, reuses that popup as you browse channels, and gives a translated new-tab recovery action when the browser blocks popups. StreamerStats sends `X-Frame-Options: DENY`, so an in-page iframe would always fail; the compact popup is the working equivalent.

### Changed

- **The external handoff is explicit and bounded.** No StreamerStats request runs in the background, no permission was added, and no account token or Kick session is sent. The browser visits StreamerStats only after the viewer presses **Stats**, with the public channel slug in the destination URL; the popup severs its opener before navigation.

### Fixed

- **Theater mode now keeps the player and chat inside the available width.** Kick Focus sizes the outer chat column that actually participates in Kick's player/chat split, keeps its inner chatroom matched to that column, and constrains the reclaimed theater row instead of letting chat extend past the viewport.
- **The live chat separator is manually adjustable again.** Dragging Kick's existing separator now changes both chat layers together from 320 to 520 px, updates its accessible value, saves the result, and reports the saved width without replacing Kick's control.
- **Player status chips attach to the visible video.** Kick can keep hidden preload media beside the painted player; uptime, VOD retention, and playback diagnostics now prefer the video with real on-screen geometry instead of disappearing into a hidden media container.

## 1.27.0, 2026-08-19

### Added

- **Four complete viewing presets.** Calm, Cinema, Chat First, and Discovery apply a coherent layout and visual treatment in one click, using the same settings people can still tune individually. They never change content filters, accessibility choices, hidden controls, or the Kick account, and every application reports exactly what happened through the existing toast and autosave path.
- **A contrast-protected custom accent.** The color picker accepts any six-digit color, checks it against the darkest surfaces used by all three themes, and falls back to a safe rose when a value would make focus rings and selected controls disappear. Foreground ink is selected from measured contrast instead of guessed from hue, and the same tokens style Kick and the shadow-root settings interface.
- **A real My Emotes collection.** The account-wide emote catalog is now a dedicated view instead of a number hidden in diagnostics. It shows only emotes Kick says the signed-in account can use in every chat, groups them by subscribed source channel or global collectible set, and keeps the library's search, favorite, local-group, copy, type, artwork, and access controls. A missing signed-in catalog produces instructions, not a false empty inventory.

### Changed

- **Appearance starts with decisions, not individual knobs.** Presets are described in plain language above the existing theme, accent, radius, thumbnail, scale, contrast, and live-color controls. The accent grid now reflows five choices cleanly, the custom value stays visible beside its picker, and the layout collapses to one column on narrow windows.
- **Signed-in pages now belong to the same design system.** Profile/Settings, Collectibles, and Subscriptions are classified separately instead of falling into a generic route. Settings tabs gain a reliable current-page marker, forms and focus rings use the selected theme, disabled actions are visibly inert, explanatory copy has a readable measure, and collectible buttons use consistent borders, depth, and focus feedback. Native account controls remain native and no value is changed.
- **Detached viewing no longer hides the channel-points tradeoff.** The multi-stream footer carries Kick's own warning that Picture-in-Picture and mirrored viewing do not accrue channel points, and the popout-chat control points assistive technology to the same note.

## 1.26.0, 2026-08-19

### Changed

- **The offline DOM fixtures can be regenerated from the live site.** They were hand-written and hand-edited, so the day Kick changed its markup they described a version of the site that no longer existed and nothing noticed. A maintainer script now rebuilds one from a real page, keeping only structure, replacing all text, and reducing every URL to its path, and refuses to write a fixture that would weaken the checks reading it. Running it found that several things the fixtures assert are no longer served by Kick at all. Maintainer tooling only: the shipped userscript and both companions are unchanged from 1.25.0.

## 1.25.0, 2026-08-18

### Added

- **The emote suggestions no longer offer emotes that would bounce.** When you are signed in, Kick refuses a subscriber emote you do not own and refuses a free channel emote outside its own channel, the list used to offer both and let you find out by sending. It now reads the entitlement data the library has carried since 1.20.0 and leaves them out. Signed out, nothing changes: an anonymous read genuinely cannot tell an emote you own from one you never will, so nothing is hidden on a guess.
- **Two live checks no longer report defects that were not there.** The reward check declared a claim missing when the page had simply not reached it yet, claiming takes two passes and the first one arms a ten-minute back-off before it clicks, so a stray cycle could leave the check waiting. It now retries within its own phase and reports which pass claimed. The navigation check had the same shape and now waits for the route rather than sleeping a fixed interval.
- **One chat for the whole grid.** "Merge all chats" replaces the single focused-channel chat with every channel in the grid interleaved in the order messages arrived, each line labelled with the channel it came from. It is off by default, one channel's chat with Kick's own emotes and badges is the better read, and it is strictly read-only, with no composer and nothing that can send. Connections are opened per channel and closed when a channel leaves the grid, so removing a tile stops it costing anything; switching back to per-tile chat gives you the same chat you had, without a reload.
- **The multi-stream grid's chat can float above everything in its own window.** A "Pop out chat" control opens the focused channel's chat in an always-on-top window you can keep beside a game or another app. It follows the focused tile, and closing it puts chat straight back in the grid, the grid's own chat is hidden while the window has it rather than torn down, so nothing reloads on the way back and no messages are lost. The control only appears in browsers that can do this; everywhere else the grid behaves exactly as before. Read-only, like the in-grid chat, and it says so.

## 1.24.0, 2026-08-18

### Added

- **Drift detection now checks what a hook is *for*, not just that it matched.** Twice this month a feature stopped working while every check stayed green, both the same shape: the element was found and the value computed from it was not, a stream card that yields no channel name, a player container that turns out to be the video itself. Each of those now declares what it is supposed to produce, and the page records which ones failed, so a break shows up as "the card was found but the channel name was not" instead of silence. A route that simply does not render something is reported as such rather than as a failure.

### Changed

- **A live check no longer reports a defect when the page simply had not finished laying out.** The emote-organizer check captured the grid before its column count settled, so a later legitimate re-render looked like a failure to patch the tile in place. It now waits for the window to stop rebuilding, and says "nothing stable to test" rather than "broken" when it never does.
- **The distribution and listing posture is written down.** A section in the README states the single purpose, that nothing is collected or transmitted, why no remote code ships, why the userscript asks for broad connect permission and what uses it, and which channel each of the three artifacts could be listed on. Nothing is submitted anywhere; this exists so the answers are decided calmly rather than during a review.

## 1.23.0, 2026-08-18

### Added

- **A recording now says how long Kick will keep it.** Kick deletes VODs after 7 days, or 30 for a verified channel, offers no download to anyone including the broadcaster, and shows that deadline nowhere. On a VOD page a small countdown sits in the player corner. It is deliberately silent rather than approximate: if the recording is older than the list Kick returns, or the channel's tier cannot be established, it shows nothing at all, 7 and 30 days are four-fold apart, so a guess would be a confident wrong date rather than a rough one.

### Changed

- **The emote hover card and the completion list now render above everything.** Both used to be placed by hand and rely on winning a stacking contest with Kick's own layers. They now use the browser's top layer, which no page styling can clip or cover, and they position themselves against the emote or the composer rather than by arithmetic this build does itself. On a browser without that capability the previous behaviour is used unchanged. Escape, focus and every keystroke behave exactly as before, the surfaces are opened in the mode that watches no keys and moves no focus, so nothing is taken away from Kick's own composer.
- **The completion list is pinned above the composer instead of following the caret.** It no longer slides sideways as you type, which is where Twitch and FrankerFaceZ both put theirs.

## 1.22.0, 2026-08-18

### Added

- **Search the settings.** Roughly ninety settings live across five pages, and finding one meant knowing which page it was on. A box above the page list searches all of them at once and shows what matched, with the page each setting lives on; clicking a result takes you there. It searches descriptions as well as names, and it matches the English name even when the interface is in Spanish or Portuguese, so a setting someone read about in English is still findable in a translated panel.
- **Kick Focus tells you when it has changed under you.** After an update, one dismissible notice names the new version and offers a link to a short summary on the About page, and any setting whose default moved is called out by name. It stays quiet on a first install and on a profile that predates this feature, in neither case can it honestly claim to know what changed. Kick shipped ads to viewers with no notice in May 2026 and was rightly criticised for it; this build should not do the same thing to its own users.

### Changed

- **Markup now reaches the page through a single checked path.** Every panel this build draws goes through one function, and the build refuses to ship if any surface writes markup on its own. Nothing looks different; it means a future change to how markup is handled is one edit rather than seventeen.

## 1.21.0, 2026-08-18

### Added

- **The live gate can now say "not here" instead of failing.** A check whose subject Kick simply did not render on the route being tested, no video on the home page, an empty emote library on a throwaway profile, used to come back red, which trains people to ignore a red gate. Those are reported as skips that name what was missing and how to cover it, and skips are counted apart from the total so a run that asserted nothing cannot report a perfect score. Run against the Browse page, that turns four failures that were not defects into four honest skips.
- **Every artifact is under a declared size budget.** The userscript has grown about 25 KB a release, and Violentmonkey's Manifest V3 mode only gives true document-start injection below roughly 1 MB, past which injection silently lands late rather than erroring. The build now prints the userscript's size on every run and the gate fails before that ceiling is reached.

- **The live gate now checks that Kick's own endpoints still exist.** Kick removes endpoints without notice, it deleted the one serving video metadata outright in July 2026, which broke another Kick extension on the spot. Drift detection covered Kick's page markup and said nothing about its API, so a removed endpoint would have degraded into a diagnostics counter nobody reads. Each endpoint this build depends on is now read on every live run, and one that has genuinely gone fails the gate by name. An endpoint that answers only for a signed-in session is reported rather than failed, because the gate runs logged out. The list is derived from the module that owns the endpoints, so a new one cannot be added without either a check or a stated reason.
- **The Firefox companion is now proven against a real Firefox.** It had never been executed anywhere: Firefox Release refuses to install unsigned packages permanently, so every claim about the Manifest V2 build rested on reading the code. A new gate drives Firefox over WebDriver BiDi, installs the package as a temporary add-on, and asserts against live Kick that the page bundle runs, the bridge handshake reaches the page, the interface mounts, and, the one only a real browser can answer, that an ad host requested by the Kick page is refused by the browser's own network layer. It joins the release gate and skips cleanly on a machine with no Firefox.

### Fixed

- **Live checks no longer report a working feature as broken.** Each check now waits for the thing it is about instead of looking once and giving up. This build paints on its own schedule, so a single look could miss a control that was about to appear, which is exactly what happened on 2026-08-17, when the discovery-card chips were reported dead while they were working. Nothing about the product was wrong; the check was.

- **The Firefox package no longer hands kick.com a permanent identifier.** It used to inject its page bundle from a `moz-extension://` address, and that address contains a UUID which Firefox generates per install and never changes, so any script on the page could read it as a tracking identifier that survives clearing cookies. The bundle is now carried inside the extension's own bridge and injected as source, the address never reaches the page, and the package no longer marks anything web-accessible. This depends on Kick shipping no Content Security Policy, which it does not; the README says what happens if that changes.
- **Privileged extension messages now check who sent them.** The part of the companion that owns the network rules and the blocklist fetch acted on any message with the right shape. It now refuses anything that is not this extension's own content script on a Kick page, or this extension's own popup.
- **The interface now says which language it is written in.** Kick's page declares English, and that declaration reaches into this build's own panels, so with the interface set to Español or Português a screen reader was announcing every translated string with English phonemes. Each of the four surfaces this build owns, the settings shell, the emote suggestion list, the emote hover card, and the header control, now declares the language it is actually in, and follows the setting when it changes. The companion popup is unchanged and still declares English, because its copy is English.

## 1.20.0, 2026-08-17

### Added

- **Your emotes, stated rather than guessed.** Kick's `/emotes/{slug}` answers differently depending on who is asking. Read anonymously it returns the channel's own artwork, Global and Emojis. Read with the session's bearer token it returns those *plus every channel you subscribe to* and the collectibles you have pulled, measured on one live channel as three sets and 12,566 bytes against thirteen sets and 44,404 bytes. That larger answer is Kick's own statement of what your account may send, which is the explicit entitlement this build has always required and never had. The emote library now uses it: an emote you own reads as available, a subscriber emote from a channel you do not subscribe to is marked denied rather than merely unconfirmed, and a new line at the top of the library says how many emotes you can use in any chat and how many subscribed channels they come from. Kick shows that nowhere, its picker only ever shows the channel you are standing in.
- **Where an emote actually works.** `subscribers_only` is inverted from what its name suggests, and the consequences are what matter: a *free* channel emote is refused everywhere except its own channel (`FOREIGN_CHANNEL_EMOTE_ERROR`), while a subscriber emote you own works in every chat. Both were measured by posting each kind into a real chatroom. Library tiles and the chat hover card now say which one an emote is, "Works in every chat", or "Only works in {channel}'s chat", so a name you type is one that arrives. Where the catalog has not established reach, nothing is claimed.
- **Stream uptime.** Kick sends the start time with every channel and displays it nowhere. A small clock in the player corner counts from it. It costs no request: the value rides along on a payload the mod already reads, and falls back to the stream's start in Kick's own structured data in the page, which also means it still works when Kick's channel API is rate-limiting the tab. On by default; an offline channel and a VOD both show nothing.

### Fixed

- **Session-gated reads were being made without the session.** `kickFetchJson` sent cookies and no bearer token, on the recorded belief that these endpoints authenticate by cookie alone. They do not: `/gamification/collectibles` answers **403** to a cookie-only read and 200 with the header, so collectible rarity and the duplicate-rate summary had been degrading for every signed-in user with no error to show for it. Kick's own page reads the same `session_token` cookie and sends it the same way. The header is attached to Kick origins only.
- **A catalog emote that said "available" was filed as subscriber-only.** The library merge read the native picker's `available` flag but not the catalog's own `access`, so everything the catalog reported as usable, every Global and Emoji emote, and now everything the account owns, fell through to the locked branch.
- **Overlays were being appended inside the `<video>` element, where nothing renders.** Kick's video carries `id="video-player"`, and `closest()` tests the element itself first, so the ancestor lookup returned the video. Children of a media element are fallback content and are never drawn. That silently disabled the playback diagnostics panel and the `[data-kf-player] video` contain rule at once. Overlays now resolve to a container that holds the video, preferring one that already establishes a containing block so nothing of Kick's is restyled.
- **Poor mode left two spend surfaces standing.** The KICKs balance in the chat footer and the gift-shop panel are not controls, the balance is a `<span>` whose entire text is a number, and the tagger walked only buttons and links. Both are now identified by test id, which is also why the free channel-points counter sitting directly beside the balance is untouched.

### Changed

- The live gate gained three checks: that a player overlay anchors to a container and never to the video, that the uptime chip agrees with Kick's own start time read as UTC, and that Poor mode reaches the non-control spend surfaces while leaving Follow and channel points alone. The last two skip with a reason rather than failing when the route carries no live channel or no spend surface, so the default home-page run stays honest about what it did not cover.
- The migration check no longer asserts the library's exact size. Home carries a live chat preview and emote discovery is on by default, so a message arriving mid-check legitimately added an entry, making it fail on a busy minute and pass on a quiet one. It now asserts that both imported entries survive and that every stored key carries the platform prefix.

## 1.19.0, 2026-08-16

### Added

- **Switch off Kick's own controls you never use.** A grid on the Layout page turns off eight player controls, miniplayer, clip, theater, fullscreen, the quality gear, volume, share, report, and six sidebar entries: the Home, Browse, Following and Drops links, and the followed and recommended channel lists. Each one is hidden with styling only. Nothing is clicked, nothing is removed from the page, and switching it back on brings it straight back without a reload. The controls are found through the same ordered probe list the rest of the mod uses, so the live gate reports it if Kick renames one of them, rather than the switch quietly hiding nothing.
- **Always start at the highest quality** (off by default). Opens every stream at the best rung Kick offers on that channel, taking precedence over remembered quality. The rungs are learned from Kick's own quality menu rather than hard-coded, because the set differs per channel, so it does nothing until that menu has been opened once, and it will not open the menu for you to get there sooner. A rung Kick has badged as unavailable to your session is never recorded and never selected: signed out, that is the 1080p60 row, and the best rung becomes 720p60.

### Fixed

- **Remembered quality was written in a format the player does not read.** Kick's player takes its starting quality from `sessionStorage['stream_quality']`, which holds the bare height, `720`, `360`, `0` for Auto, but this build wrote the menu's label there instead, so `720p60` went into a key that expects `720`. Measured against a live channel by picking each rung and reading the key back. The menu fallback beside it never fired either: it only clicked a rung when the control was a `<button>`, and Kick renders these as `div[role="menuitemradio"]`.
- **A quality label was read from the whole row rather than the rung.** Signed out, Kick puts a sign-in badge beside the top rung, so the row's text is the rung glued to the badge, which ranks fine and is unusable. The label now comes from the rung's own element, and the badge is what marks the row as one this session may not pick.

## 1.18.2, 2026-08-16

### Changed

- **The daily-reward check now schedules itself from what Kick actually says, instead of polling every ten minutes.** When the dialog reports "Watch 54 more minutes to claim", the next look is in 55 minutes. When the reward has already been collected, by this, or by you in another tab, it sleeps until the 8pm rollover rather than reopening the dialog all day. After claiming, it sleeps to the rollover too. Waking at 8pm and reading the countdown there lands the real attempt near 9pm on its own, without that hour being written down anywhere. Across a day that is about three openings of Kick's dialog instead of over a hundred. The Content & Ads page shows when the next check is due.

### Fixed

- **The reward could be clicked more than once.** Kick's dialog stays on screen for the reveal animation after a claim, and the mod re-checks every few seconds, so for those few seconds it saw a claimable dialog and pressed the button again. It now lets go of the dialog before clicking.

## 1.18.1, 2026-08-16

### Fixed

- **The Focus button now opens settings.** It used to open the command menu, which for signed-in users appeared to do nothing at all. The command menu is unchanged and still on its keyboard shortcut. Nothing asserted that pressing this button did anything, and the check that covers it now only ever reached the floating button, the header one, which is the button signed-in users actually see, was never exercised because Kick only renders its anchor when you are logged in. The gate now supplies that anchor and clicks both.

## 1.18.0, 2026-08-16

### Added

- **Claim Kick's daily reward automatically** (off by default). When a reward is waiting, Kick Focus opens Kick's own reward dialog and clicks its claim button for you, then closes it again and gives you focus back. It clicks nothing else. A reward Kick has not unlocked yet shows a disabled button, and this leaves it alone rather than trying, so it can never claim something the account has not earned. It waits until you are not typing and no Kick Focus panel is open, checks at most once every ten minutes, and stops for the day once it claims. The check is shared across your tabs, so four open Kick tabs do not each open the dialog. Signed-in only: the reward button does not exist otherwise.

## 1.17.0, 2026-08-16

### Added

- **The emote library is no longer limited by `localStorage`.** It is stored in IndexedDB, which holds orders of magnitude more, with a small synchronous copy kept where the page can read it instantly so nothing about startup changed. Browsers that refuse IndexedDB, private windows, some locked-down profiles, keep working exactly as before on that copy alone. Nothing was added to build this: it is about 200 lines and two object stores.
- **Emote suggestions as you type** (off by default). Typing a colon and two or more letters in chat offers matching emotes from your library, ranked by what you actually send in that channel, then overall, with your favorites first and names that *start* with what you typed ahead of names that merely contain it. Click one and its plain name goes in at your cursor, never a wire token, never an id, and it never sends the message. Suggestions are accepted by click only: nothing here listens for a keystroke, so it cannot take a key that was meant for Kick's own composer.
- **Collect a channel into multi-stream straight from a card.** Every stream card on Home, Browse, Following and Search gets a chip that adds it to the grid without opening it, showing whether it is already in there. Category tiles and section links wear the same card markup on Kick and deliberately do not get the chip.
- **Tabs converge.** Adding or removing a channel in one Kick tab now updates the others as it happens, rather than the next time you open the grid. The stored grid remains the single source of truth and is re-read on every change and every open, so tabs that cannot hear each other, a `www.kick.com` tab beside a `kick.com` one, still agree; the live update is a convenience on top, not the mechanism.
- **A shared `?kf-multi=` link now says what it replaced**, with an Undo that puts your own grid back, instead of silently overwriting a set you were part way through collecting.
- **"Most used" and "Recent" shelves in the emote picker.** Two shelves over the usage Kick Focus already counts, one ordered by how often you send an emote, one by how recently, scoped to the channel you are in and falling back to your overall history for anything you have not sent there yet. They are presentational: nothing here sends, repeats, or schedules a send.

### Changed

- **The emote picker stops rendering your whole library at once.** Only the tiles near the viewport are put in the page, with a spacer standing in for the rest so the scrollbar still describes the full library, measured on the live site, 240 tiles in the page instead of 900. Typing in the picker's search now waits for you to stop typing rather than re-filtering on every keystroke, and favoriting or removing an emote updates that one tile instead of rebuilding the grid, so the images already on screen are never re-fetched or re-decoded.

### Internal

- The live gate now fails when Kick's DOM drifts. Each shell hook is found through an ordered list of probes, a stable id first, then structural and accessible fallbacks, and everything keeps working when the first stops matching, which is exactly why it needs catching: it is the early warning and it is otherwise silent. The check reads the same probe list the runtime uses, so there is no second list to fall out of date. It found a real fall-through on its first run.
- The live-data surface is its own module too, the same treatment, and it brought twelve tests to paths that previously had none that could fail: that a slow endpoint is really aborted rather than left hanging, that an oversized or malformed body is refused instead of parsed, that the follow request rejects a junk channel before it reaches the network and decodes Kick's CSRF token rather than forwarding it raw, that recorded API drift is capped, and that a deletion annotation survives chat remounting a message without ever being applied twice.
- The multi-stream grid is its own module. It used to be ~490 lines in the middle of the runtime file, reachable only by running the whole bundle in a browser; it now takes the page's storage, toasts and translation through an explicit boundary, which means the parts that actually matter, that a channel still in the grid keeps the exact `<iframe>` it had, that exactly one tile ever carries audio, that a suspended tile unloads while the focused one never does, and that a second tab's channels survive a write from this one, are proven by tests instead of by inspection. No behaviour changed.
- The build now strips `import` as well as `export`, so a bundled module can declare its real dependencies and still load on its own under the test runner. Two artifact gates cover it: no module syntax may survive into any of the three artifacts, and the export/definition gate now reads the module list from the source tree rather than a hand-written list that a new file would have silently escaped.
- Fixed a duplicate `currentChannelSlug`, two top-level definitions, where the second silently replaced the first for every caller.

### Changed

- **Keyword matches are highlighted, not just the message.** The words themselves are now painted, and Kick Focus writes nothing into Kick's chat to do it, the browser paints them from a registry, so there is no markup for Kick to reconcile against and nothing to undo when a message scrolls away. Overlapping keywords produce one highlight rather than nested ones.
- **The interface is measurably lighter.** Stylesheets are parsed once and shared by reference instead of being re-parsed for every panel and every panic-switch restore; off-screen emote tiles skip layout and paint entirely; and the work Kick Focus does on each page change is split so a click or keystroke is never stuck behind it. On the live site the per-cycle cost went from 2.6 ms average / 7.6 ms worst case to 1.8 ms / 3.2 ms.
- **Kick Focus no longer replaces the browser's history functions** where the browser can report navigation itself, so nothing of this build is visible on `history.pushState` to any other script on the page.

### Added

- **"Add open tabs" builds a grid from the channels you already have open.** Opening multi-stream asks your other Kick tabs which channel they are on and offers them in one click. It needs no new permission in either build and nothing but a channel name is ever exchanged, a tab you have closed simply stops answering, so the offer is never stale.
- The About page reports what each page-change pass costs, and the figure travels with the diagnostics copy.

### Internal

- Recorded emotes now carry the platform they came from in their key (emote preferences schema 8). Everything is Kick's today, so this changes nothing you can see, it goes in now because the library, favorites, removals, and group assignments all share one key, and adding the origin later would mean migrating four stores at once against data that had grown for months. Existing libraries migrate on load or on import, keeping every entry and every favorite, and a backup from an older build still restores.

## 1.15.0, 2026-08-16

### Changed

- **The settings interface meets WCAG 2.2 AA on target size, focus, and reflow.** Every control now has a 24×24 CSS pixel floor that density and the 90% interface scale cannot shrink it below, focusing a control near the bottom of a page no longer parks it underneath the sticky footer, and the interface reflows at 200% zoom without a horizontal scrollbar. Verified by measurement on the live site, 228 controls across all five settings pages, zero violations.
- **Ready for the day Kick turns on Trusted Types.** Kick currently ships no Content Security Policy, but `require-trusted-types-for 'script'` would make every `innerHTML` write in the page throw, including all of this build's own interface, which would simply stop appearing. Markup now goes through a feature-detected policy of its own. It deliberately does not claim the `default` policy, which would vouch for every other script on the page, Kick's included. Four writes that only cleared a node no longer produce markup at all.

## 1.14.0, 2026-08-16

### Added

- **Recorded emotes can now be used, not just looked at.** Every emote in the library gets Copy name, and an off-by-default setting adds Type in chat, which puts the plain name at your cursor in Kick's own message box. It types the name and nothing else, never Kick's internal `[emote:id:name]` token, never an id, and it never sends the message, so entitlement stays exactly where Kick put it. Subscriber-only and shadowed names say so when you copy or type them, instead of letting you find out in a live chat.
- **Hovering a chat emote tells you what it is before you save it.** A small card names the emote, the Kick set it belongs to, its access level, when you first saw it, and whether it is already in your collection, all of which was recorded but only reachable by opening the library manager. If another channel's emote shadows the name, the card says which one typing that name actually sends. It follows the keyboard too, never intercepts the pointer, and stays on screen near the edges.

### Changed

- **Spanish and Portuguese now cover the copy that actually moves.** Toasts, screen-reader announcements, button labels, placeholders, and every count phrase were written straight to the page and never passed through the translator, so ~90 strings, every error message and every accessible label among them, stayed English no matter the language setting. All of them are translated, and count sentences now read naturally in each language rather than gluing a translated word onto an English sentence.

- **Importing a backup is now all-or-nothing.** An import used to write its ten stores one after another, so a browser storage limit reached part-way left a configuration that was half the imported file and half the old one, with nothing to say where the seam was. The whole set is now sized and checked before anything is written, a refusal explains itself and changes nothing, and Undo import stays available if a restore fails. Userscript builds commit the set in a single batched write on Tampermonkey 5.3+ and Violentmonkey.

### Internal

- The test suite adopts Node's own tooling with no new dependencies: tests are tagged so pure logic can run without a build (`npm run test:unit`), API-shape assertions tolerate Kick adding fields without going quiet about wrong ones, and a coverage gate names any source file no test reaches. That gate immediately found four, `runtime.js` and the three extension entry points were absent from the coverage table entirely, which made the reported percentage look better than it was. Each now states where it is actually covered. jsdom, happy-dom, and Node's built-in localStorage remain deliberately unadopted.

### Fixed

- **Escape cancels the reset prompt instead of tearing down all of Settings.** Answering "no" to a confirmation no longer closes the modal and discards the page you were working on, and the prompt now keeps Tab inside itself rather than letting focus wander the obscured settings behind it. Cancelling returns focus to the control you pressed.
- **"Larger pointer targets" and "Reduce motion" now apply to Kick Focus's own controls.** Both settings only ever restyled Kick's markup: the mod's interface lives in a shadow root that the site-level rules cannot reach, so switches, buttons, and the multi-stream tile bar ignored them. Larger targets also pins the tile bar open, since a pointer-limited user may never trigger its hover reveal.

## 1.13.0, 2026-08-16

### Added

- **Click any chat emote to save it.** Emotes in live chat are now visible keyboard controls: click them or press Enter/Space to add them to the local favorites collection immediately. Dynamically arriving messages get the same treatment, repeated clicks are idempotent, and every new save offers Undo.
- **Follow-gated emotes can complete the whole action in place.** When,and only when,Kick's own emote data explicitly says a source channel follow is required, the save click also performs Kick's normal same-origin Follow request without navigating away. Public artwork never triggers a follow, a missing source is never guessed, subscriber-only access remains locked, failures keep the local save and explain what happened, and Undo can reverse a follow created by that click.

### Changed

- **Premium settings polish across every page and state.** The modal now uses one semantic surface/type/border/radius system, clearer hierarchy, non-color-only On/Off switches and autosave state, stronger focus/hover/pressed/disabled/error treatments, readable command-menu counts and empty states, steadier multi-stream controls, and responsive forms/navigation down to a 375×812 narrow-window check. Studio, OLED, and Slate retain their identity through the same component system.
- **The companion popup now communicates state instead of assuming it.** It starts in an honest checking state, distinguishes Active, Off, and Offline in text, handles an unavailable background service, disables controls with an explanation, and reports busy/failure states for both settings actions.

### Fixed

- A first emote observed in chat no longer throws while the library chooses its access level. The access merge now handles a missing prior record explicitly and has a regression test.
- Settings navigation no longer clips the longest desktop label, long status values no longer force horizontal overflow, and the active mobile section scrolls into view.

### Internal

- Settings migrate to schema 4 for the click-to-save preference; emote preferences migrate to schema 7 for source-channel and explicit follow-gate evidence. The follow decision, follow endpoint, normalization, lock state, access merge, and portable metadata are unit-tested. The full suite is 118/118.

## 1.12.0, 2026-08-16

### Added

- **Poor mode.** One opt-in setting hides Kick's Subscribe, Gift Subs/Dubs, Get KICKs, gift-shop, and spend-leaderboard controls while preserving Follow, chat, and free daily rewards. It keys off the signed-in site's exact control ids/labels rather than broad page text, so a chat message mentioning a gift cannot disappear. The command menu can turn it on or off without adding another keyboard shortcut.
- **Browse any channel's emotes without pretending the art grants access.** Content & Ads → Recorded emote library now accepts a channel name or Kick URL, fetches only that channel's own set on demand, saves the public artwork locally, and reports new, channel-only, and subscriber-only counts. Every card can open its original Kick artwork. The browser never bulk-fetches channels, inserts a wire token, sends chat, follows a channel, or changes account entitlement.

### Fixed

- Public channel emote catalogs no longer masquerade as account entitlement. Kick returns subscriber-only artwork from `/emotes/{slug}` even when it supplies no subscription/ownership field; those entries are now recorded as subscriber-only until the native picker or an explicit API signal proves access. Free channel emotes are recorded as channel-only, while Global and Emoji sets remain available.

### Internal

- Emote preferences migrate losslessly to schema 6, which adds the portable `channel` access state. The catalog-access decision and Poor mode's exact spending-control boundary are pure, unit-tested functions.

## 1.11.0, 2026-08-16

### Added

- **A local error log on the About page.** Kick Focus now captures uncaught errors from its own code, the apply cycle and settings interactions, to a bounded in-session log you can view and copy, with a last-crash summary that persists across reload. Messages are sanitized the same way the protection log is (no query strings or long tokens), and nothing is ever sent anywhere. A client mod on a site that changes as often as Kick should not fail silently.

## 1.10.0, 2026-08-16

Two operator-requested flagship features, collecting emotes straight from chat and one-click multi-stream, on top of a data-safety, security, and verification pass. Existing data migrates without loss.

### Added

- **Add the channel you're watching to multi-stream with one click.** The Kick Focus header control now shows a **+ Multi** button on any channel page. Click it to drop that channel into the grid without leaving the page, collect several as you browse, then open them together. The button flips to **In Multi ✓** once a channel is in the grid (click again to remove it), the header shows a live **Multi (n)** count, and each add pops a toast, "Added xqc, 3 of 9", with **View** and **Undo**. Adds and removes are now merge-safe across tabs: two tabs each adding a different channel no longer clobber each other.
- **Kick Focus now collects emotes straight from chat as they appear.** Every realtime chat message carries the id and name of each emote in it, and until now all of that was discarded except for counting your own sends. With **live chat events** and **organize chat emotes** both on, every emote anyone posts is now recorded in your library automatically, the single biggest source of emotes on a busy channel. A newly seen emote is only saved after its image actually loads from Kick's CDN, so a faked emote token can never take a slot, and emotes already in your library just refresh their last-seen date.

### Security

- **The companion bridge is no longer an open channel for a page to abuse.** A script on kick.com could previously make the companion fetch any HTTPS URL and read the body back, write arbitrary data into extension storage, and toggle the telemetry ruleset through an unvalidated payload, and the "network protection active" claim was read from a page-writable `<html>` attribute anything could set. Now the blocklist fetch is pinned to your configured URL (never a URL supplied in the event), announced settings are reduced to the one field the popup reads before anything is stored, the blocklist URL is validated as a well-formed `https:` URL when settings are saved, and companion presence is proven by a live nonce round-trip instead of a page-set attribute.
- **The userscript no longer sends your cookies when fetching a remote blocklist.** `GM_xmlhttpRequest` now runs anonymously, so a blocklist URL on any host cannot receive your credentials for that host.

### Fixed

- **"Reset all settings" now keeps your recorded emote library and actually clears your private data.** It used to do the reverse: it destroyed the library, including the first-seen/rename provenance that cannot be regenerated, while leaving notes, keyword filters, layouts, favorites, not-interested channels, media preferences, usage counts, and multi-stream layouts untouched. A factory reset now clears all of those and preserves the library, and the dialog says so.
- **Export and import now cover every store, so a backup is a real backup.** Export previously omitted per-channel layouts, favorite and not-interested channels, chat keyword filters, channel notes, and media preferences, channel notes had no backup path at all, while the panel promised "the only way to keep these." All of them travel in the export now, import restores every one, and import is non-destructive: it snapshots your current settings first and offers **Undo import**. Malformed and prototype-pollution keys (`__proto__`, `constructor`, `prototype`) are dropped per store, and emote usage counts are bounded on both read and write instead of growing without limit.

- **Accessibility fixes across the settings surface.** Toggling a setting deep in a page no longer throws keyboard focus and scroll back to the top, both are preserved across the re-render. Toasts now announce through a live region (errors interrupt as `role="alert"`, confirmations wait politely). Sliders expose `aria-valuetext` (so a screen reader hears "70%", not a bare "70") and a readable name instead of a dotted setting path. In Windows High Contrast / forced-colors mode, switches, the current page tab, and other selected states now show a system-color marker instead of looking identical to their "off" state.
- **The Firefox companion popup now shows live data instead of static defaults.** The Chromium promise-API popup was copied verbatim into the Firefox package, where the callback-style tab query returned nothing, so the popup never read the active tab. It now uses the `browser`-or-`chrome` namespace so it works on both engines. The release Chromium zip also no longer bundles the dev-only `manifest.dev.json`, which would have shipped an extra permission.
- **The companion no longer hard-blocks `litix.io`, which was reintroducing a stream-entry delay.** The page realm answers that telemetry host with an empty 200, which the player accepts, but the companion's network layer was cancelling it outright, the exact block that triggers an unbounded retry storm (documented upstream as "massive delays entering live streams"). It is now excluded from the Chromium DNR and Firefox webRequest cancel sets on both engines, and a gate keeps it out.
- **The recorded emote library no longer silently drops new emotes once it fills up.** At 2,400 entries the old cap kept the *oldest* records and discarded every newly seen emote, and it rewrote the whole ~0.5 MB store on every scan cycle. Now the library evicts the most disposable records first, chat-only (`observed`) before locked, oldest-seen first, and never evicts an emote you have available, favorited, or filed in a custom group, so a full library makes room for a new emote instead of ignoring it. Background merges from chat and the picker are debounced into one write (and flushed when the tab closes) rather than rewriting on every cycle.
- **Removing an emote now frees its library slot.** "Remove" previously only hid the record, so it still counted toward the cap and kept being re-recorded from chat. It now deletes the record, keeps the emote out until you restore it, and the Removed view offers a single "Restore all removed" action.

- **The live extension proof no longer exits 0 when it verified nothing.** A behavioral gate that reports success without a browser is worse than none, so `verify:extension` and `release:check` now fail loudly when Chromium is absent (set `KF_ALLOW_NO_CHROMIUM=1` to downgrade to a skip on a machine that genuinely cannot install one). The matched-rule readback, which needs `declarativeNetRequestFeedback`, a permission the release manifest deliberately omits so Chrome does not warn about browsing history, is now conditional on that permission rather than failing the shipped artifact, with `ERR_BLOCKED_BY_CLIENT` remaining the authoritative block proof. The isolated companion proof was re-run against live Kick: 22/22 checks pass at 1440×900.

### Internal

- Pluralization now goes through a locale-correct `Intl.PluralRules` helper instead of a hand-built `n === 1 ? word : word + "s"` rule, which is wrong for Spanish and Portuguese (both have a "many" category English lacks). Count words route through a `plural()` helper keyed to the active locale, ready for the remaining dynamic-copy localization pass.
- The artifact checks no longer pass vacuously. The DNR and content-script gates now fail on an empty host list or a broad `<all_urls>` match instead of an empty `.every()` reporting success, a shared exfiltration regex is proven to catch an off-origin API call and a lookalike host, and seven red probes assert each de-vacuumed gate can actually fire. The keyboard-shortcut conflict rejection the README advertises is extracted to a pure function and tested, and `normalizeShortcut` is covered.
- A boot-execution gate now runs the concatenated bundle in a stubbed environment and asserts it bootstraps without a temporal-dead-zone read or bad const ordering across the four-module concat, a class of failure that previously passed every offline gate and surfaced only in the live browser harness. A companion red test injects a mis-ordered const and asserts the gate catches it.
- The emote-preferences migration from every historical schema (1 through 5) to the current schema is now covered by a test that asserts favorites, custom groups, assignments, and Kick-edit provenance survive the upgrade losslessly, the highest-risk previously untested area, which the reset/backup changes above all touch.
- Replaced a literal NUL byte in `src/core.mjs` (the favorites-key separator) with a `\u0000` escape. The runtime string is identical, but the source is now plain text, so ripgrep no longer classifies the settings-schema module as binary, restoring the repo's own re-grep-after-edit safeguard.

## 1.9.0, 2026-08-15

Emote schema 5. Existing favorites migrate without loss.

### Added

- **Emote favorites are now ordered, and can be scoped to one channel.** A favorite you save on a channel appears only there, above your global ones; global favorites still follow you everywhere. Order is explicit and set with the ‹ › controls in the favorites view, Kick's own "Frequently Used" ranks nothing, so this is the only real ordering available. New favorites stay global by default, so nothing you already had moves; the Content settings choose otherwise.

  Favorites keep working when the channel's emote set is not loaded, because the library already stores a full snapshot for every recorded emote.

  Previous versions stored a flat favorites list with no scope. Position in that list *was* the order, so it carries over as your global order with nothing lost.

## 1.8.0, 2026-08-15

Emote schema 4. Existing libraries migrate without loss.

### Added

- **Named-channel blocklist.** Specific channels can now be hidden from Home, Browse, Following, and Search through the Content settings. The list is normalized, capped at 200 entries, editable, exportable, and counts toward the fail-open ceiling.
- **The emote library is now a record you can check Kick against.** Each entry keeps a first-seen and last-seen date, and when Kick renames an emote or replaces its artwork the value at first capture is kept and the entry is flagged. Kick changed emotes users had already pulled in July 2026 and answered with "remastered… clear your cache"; a local record is the only version that can show what changed. Entries carried over from the previous schema keep an unknown first-seen date rather than claiming today.
- **The collectible facts Kick leaves unexplained**, each with its basis: the daily streak confers no bonus to drop quality or odds, no drop odds are published anywhere in the responses this build reads, duplicate protection is undocumented, and the collectibles page can disagree with the chat emote set. The duplicate count is measured from your own inventory only when Kick returns a per-item quantity, otherwise it is reported as unavailable rather than shown as zero.
- **Saved layouts are shareable and show who is live.** A layout copies as a kick.com link carrying channel names and nothing else; opening one revalidates every slug through the same rules the grid uses, then strips the parameter so a reload does not silently reopen it. Live status for the grid and every saved layout comes from one bulk request rather than per-channel polling.
- **The badges Kick's own markup omits now render.** Kick's chat payload carries collectible and global badges the legacy array leaves out, so a client reading only the DOM showed a gap. Badges Kick already drew are skipped, and a badge image that fails to load is replaced by its name rather than an empty box.
- **API drift detection.** When a normalizer rejects a payload for a shape reason, the endpoint and reason are recorded, and the About page reports accumulated drift instead of silently falling back.
- **A locked emote now says why it is locked**, subscriber emote, collectible you have not pulled, or a denial Kick gives no reason for, and links to Kick's own unlock path. Nothing is enabled or sent; the link is the only action offered. Entitlement is read across every shape Kick has used, and the default with no signal is unlocked, because the expensive failure is greying out an emote you actually own.

### Changed

- **The realtime transport is now swappable.** Frame parsing and subscription management moved into shared protocol functions and per-provider connection details into a registry, so Kick switching providers is one added entry rather than a rewrite. Kick's own gateway is registered but marked unverified, this project has never contacted it, and a verified provider wins when the broker offers both. An unverified transport that never delivers a frame degrades to reading the page and names itself.
- The README now corrects a widely repeated claim: a cross-origin WebSocket is not blocked by CORS. What can block Kick's gateway from a page context is the server rejecting the origin or its Cloudflare front requiring a token, and which applies remains untested here.
- **Translation is now a single forward lookup.** Every string used to be resolved by scanning all ~250 dictionary entries to map a possibly-already-translated value back to English, ambiguous by construction, since several English sources are also translated values of other strings. The English original is remembered per node instead, so a re-render or a language change translates from the source rather than from what is on screen.
- **Language names are no longer translated.** A picker that renames "Português" to "Portugués" is harder to use, not easier; endonyms now appear the same in every locale.

### Internal

- Tile reuse across multi-stream renders, the single-unmuted-tile rule, and the deletion-annotates-once guard are now covered offline. Replacing an `<iframe>` restarts its stream, so the reuse rule is load-bearing; it was previously asserted only by a headed browser run that `npm run verify` does not execute. The reuse test was verified red against a deliberately broken plan before being trusted.

## 1.7.0, 2026-08-15

Trust, naming, and diagnostics pass.

### Fixed

- **The Chromium manifest requested "Read your browsing history" for nothing.** `declarativeNetRequestFeedback` is only useful for unpacked installs, which have the API regardless, so the release manifest now omits it. A dev manifest variant is emitted alongside for debugging. The popup already showed a dash when the counter was unavailable.
- **The Firefox manifest requested `<all_urls>` and `tabs` it did not need.** Permissions are now enumerated from the same host lists the page-realm classifier uses, plus kick.com. The `tabs` permission was unused. `data_collection_permissions` is now declared as required by AMO since 2025-11-03.
- **The remote blocklist was fetched from the page realm.** The request is now CORS-free: the companion background fetches it when present, `GM_xmlhttpRequest` when the userscript manager provides it, and the page-realm path remains only as a last resort. The summary states which method was used.

### Added

- **API drift detection.** When a normalizer rejects a payload for a shape reason, the endpoint and reason are recorded. The About page reports accumulated drift rather than silently falling back, following the ad-stack drift report pattern. Covers the channel, emote, and realtime endpoints.
- **Importing a library now names what was dropped.** A sticker import that loses entries states how many and names up to five, rather than reporting a bare count difference.
- The README now states the Firefox channel limitations (Release and Beta cannot install unsigned XPIs persistently) and the Violentmonkey MV3 timing constraint (real `document-start` requires Alternative page mode, off by default).

### Changed

- **User-facing "sticker" vocabulary renamed to "emote"** throughout settings, translations, toasts, announcements, aria-labels, validation messages, and the README. Kick ships no product called a sticker, its API, chat wire format, and picker DOM all say emote. Internal identifiers and storage keys stay unchanged to preserve existing data without a migration.
- Node engine floor updated to 22+ in the README to match `package.json`.

## 1.6.0, 2026-08-15

Accessibility, data safety, and hardening pass over everything 1.5.0 shipped.

### Fixed

- **The multi-stream grid had no way to stop it.** Nine autoplaying tiles with no pause-all and the focused tile's audio with no mute-all are WCAG 2.2.2 and 1.4.2 failures, on a build that ships an accessibility page and so invites the standard. Both controls now sit before the grid in tab order, and a system request for reduced motion mounts the grid paused with a visible way to start, since `prefers-reduced-motion` is not accepted as a substitute for a real control. No surveyed competitor implements either.
- **Nine tiles at source quality is more than most hardware can decode.** Tiles now unload when scrolled out of the grid or when the tab is hidden, and resume in place; the focused tile is never suspended because it carries the audio. Per-tile quality capping turned out to be impossible, `player.kick.com` is a different origin, so neither its storage nor its player internals are reachable, and the embed accepts no quality parameter.
- **Most of the interface was untranslated and nothing detected it.** 78 rendered strings had no entry in any locale, so `es` and `pt` users read English for the majority of the settings interface. Roughly two thirds predated 1.5.0. The previous gate could not see it, because checking that locales agree with each other stays true when a string is absent from all of them equally.
- **Export omitted two of the stores it promised to keep.** Emote usage counts and multi-stream layouts were listed in the About storage table but absent from the backup that page tells users to take. Both now round-trip, and import validates and reports them like everything else.
- **Realtime frames were parsed without bounds.** The chat subscription is anonymous and public, so a frame is untrusted input by construction. Content and ids are now truncated, badge and rule arrays capped, sender colours accepted only as hex colours, and badge images only as https URLs on Kick hosts.
- **Only the settings modal contained focus**, so keyboard users tabbed out of the command menu and the multi-stream grid onto a page they could not see, and in the grid the next stops are cross-origin frames that cannot be focus-managed at all.
- Player embeds no longer request `encrypted-media`; Kick playback is Amazon IVS HLS with no DRM.

### Added

- **The two limitations users would otherwise hit blind are now stated.** Multi-stream chat is read-only because Kick's popout chat refuses to send from inside an iframe by design; and if Kick sign-in, sign-up, or Follow stops working, the cause is an ad-blocker filter list rather than this extension, Kick Focus blocks eleven third-party hosts and no kick.com host at all.
- A translation-coverage gate that fails when any rendered string has no dictionary entry, verified red before being trusted.
- The live harness now explains itself when run on a binary that cannot load extensions: Chrome 139 removed the flags it depends on from official builds.

### Changed

- Emote-usage counting moved from `src/api.mjs` to `src/core.mjs`. `core` owns the settings schema and the normalizers guarding import boundaries; `api` owns Kick's endpoints, and usage counts are local storage rather than a Kick surface.

## 1.5.0, 2026-08-15

Settings schema 3. Existing preferences migrate without loss.

### Fixed

- **The Firefox companion blocked nothing.** Its request listener gated on `details.initiator`, which only Chromium populates, so `new URL(undefined)` threw and every request short-circuited to "allow" while the popup reported active rulesets. It now reads Gecko's `originUrl`/`documentUrl` with `initiator` kept as a Chromium fallback. `blob:` and `filesystem:` URLs carry their origin in the path rather than the hostname, so the player's worker requests were escaping the filter regardless.
- **The build gate asserted the defective field name**, so it passed because of that bug and would have failed on the fix. Replaced with a behavioural test that runs the built background against a stubbed browser API using Firefox-shaped request details.
- **`src/api.mjs` was never in the shipped bundle.** The build computed it and then omitted it from the concatenation, so every live feature would have thrown `ReferenceError` on first use. A new gate requires every module export to be *defined* in all three bundles, derives the symbol list from each module's own exports, and was verified red against a deliberately re-broken build.
- **Failed storage writes lost data silently.** Twelve of thirteen persistence call sites discarded the result, so a full or denied storage backend dropped the emote library, channel notes, keyword filters, and layout memory with no message. Failures now raise a warning that stays until acknowledged, and About reports what each payload costs.
- **Volume memory eventually locked streams silent.** Autoplay policy sets `muted = true` immediately after attach, and the resulting event persisted "muted" for that channel forever. A grace window discards mute-only changes, and a timer reconciles against the live element for players that route audio through a gain node and never fire the event.
- **Quality memory was very likely inert**, driving a menu with plain clicks on selectors that appear nowhere in this project's verified DOM contract. Kick's player reads `stream_quality` from session storage once at init, so that is now written during bootstrap, with the menu kept as a fallback.
- Windows High Contrast had no visible focus indicator on text inputs or the command search, because `forced-colors` suppresses `box-shadow`. A WCAG 2.4.7 failure on a build that ships an accessibility page.
- Imported settings containing `__proto__`, `constructor`, or `toString` were treated as recognised and went unreported, because `in` walks the prototype chain.
- A duplicate `es` dictionary key was silently discarding a translation, and `pt` was missing a string. A new gate parses the source rather than importing it, because a duplicate key is legal JavaScript and the evaluated object cannot show what was overwritten.

### Added

- **Kick's own API, read instead of scraped.** A new module covering the realtime broker, emote catalog, chat events, and collectibles, read-only, same-origin, using the session the page already has. Every normaliser reports a changed shape rather than throwing, and every path falls back to the existing DOM scraping.
  - The emote catalog loads without the picker ever being opened, carrying real entitlement rather than a `disabled` attribute.
  - Chat events come from whichever realtime provider Kick's broker names, so no key is written in this source and a provider switch degrades instead of breaking.
  - **Removed messages now say why they were removed.** The page discards that; the realtime event carries it.
  - **Emote usage is counted** per channel and globally. Kick's own "Frequently Used" hardcodes its counter and ranks nothing.
  - **Collectible rarity is resolved.** Kick publishes rarity on card art and identity in the picker with no key joining them, so the join is evidence-scored and stays silent below a confidence floor, a mislabelled Mythic is worse than no label.
  - Wide collectibles render at their measured aspect instead of squashed square.
  - Shadowed emote names are reported with the set Kick will actually send.
- **Multi-stream.** Up to nine channels in one grid, built on Kick's own embedded player and popout chat so playback, subscriptions, and entitlements are unchanged. Audio and chat follow the focused tile, layouts save by name, and closing the grid stops every player.
- **Playback no longer waits on blocked ad preflight scripts.** Kick waits on Google PAL, Datazoom, and OM before requesting playback; blocking them, which this build does, left the dead script in the page and the player sat out the full timeout.
- **Dropdown sidebar mode**, collapsing the discovery rail to a tab that expands on hover or keyboard focus.
- Animated emotes and collectibles can be frozen to a static frame, honoured automatically under reduced motion.
- The page-realm hooks no longer identify themselves through `name` or `toString`.

### Credits

- The preflight approach is adapted from [KickCX/KickFixPlayerLoading](https://github.com/KickCX/KickFixPlayerLoading) (MIT).
- The dropdown sidebar concept comes from the "KICK Dropdown" userstyle by IamKoeda ([userstyles.world/style/29036](https://userstyles.world/style/29036), MIT), rebuilt here on this project's own tokens.

## 1.4.0, 2026-08-15

### Fixed

- Removing or pinning a sticker now preserves the grouped shelf's nested scroll position instead of jumping back to the first row.
- Following and Drops URLs now resolve to their own route kinds instead of silently receiving channel-only behavior.
- Premium site styling now targets Kick's current semantic `<main>` shell and stable card, player, chat, and navigation markers rather than depending on the retired `#main-container` wrapper.
- Clearing the search summary no longer restores the old query from the URL while the live search input is empty.
- Explicit pointer or keyboard playback on a Home preview is no longer immediately paused by the autoplay guard; background autoplay remains silent and paused.
- Live visual verification now applies an exact CSS viewport before measuring or capturing; the old `--window-size`-only path mislabeled browser outer-window dimensions as 1440×900/1920×1080 viewports.

### Added

- A compact three-row Quick favorites shelf for keeping substantially more one-click chat stickers visible at once.
- Chat sticker organization with a local grouped shelf, pinned favorites, removable stickers, search-aware views, native-group fallback, and independent reset controls.
- A persistent sticker library continuously merges every enabled or locked sticker Kick exposes, records native groups, supports custom group assignment in settings, and round-trips the complete catalog and configuration through JSON export/import.
- Seven Kick-site references for Home, Browse, Following, Drops, Category, Search, and Channel/chat, saved in `design/mockups/` and implemented as one graphite, charcoal, and Kick-lime desktop system.
- Route-specific Search context and a useful Drops empty state with direct, non-mutating navigation to eligible streams, upcoming campaigns, and reward activity.
- The live extension gate now asserts that known ad creatives and empty ad shells are absent from the settled Kick DOM in addition to proving browser-level request blocking.

### Changed

- Enlarged the organized sticker shelf, excluded Kick-disabled subscriber stickers from its usable catalog, and kept locked stickers visible in the native groups for clarity.
- Reimagined all five settings pages with a premium matte shell, clearer page hierarchy, responsive navigation, an embedded live appearance preview, and browser-backed visual parity checks.
- Restyled the current Kick desktop shell, nav search, sidebar states, stream cards, route tabs, player/chat frame, and sticker picker with denser geometry and stronger hierarchy at 1440×900 and 1920×1080.
- The default sidebar mode is Auto and the default chat width is 410 px; schema-1 settings migrate without overwriting explicit custom values.
- Sticker catalog rescans are now mutation-driven instead of repeating on every chat apply cycle, reducing work on high-volume channels.

### Security

- Subscriber-only stickers are cataloged for organization and export but stay unavailable unless Kick marks them enabled. Copying a sticker name is not treated as an entitlement bypass.

## 1.3.0, 2026-08-14

### Added

- Ordered shell locator probes now prefer Kick's ids and data markers, fall back through structural and accessible anchors, and expose a visible compatibility self-test on the About page.
- Committed lightweight Home, Browse, Category, Search, Channel, and localized chat fixtures with build-gating shape tests, without adding the large MHTML captures to history.
- Viewer controls now remember volume, mute state, quality, and finite VOD position locally with independent privacy toggles, and add favorite, not-interested, search-count, rail, and mini-player collision controls.
- Chat and playback utilities now include sticky pause with full `aria-live` recovery, local per-channel keyword highlights and notes, opt-in diagnostics, and independently toggleable player resize/ultrawide recovery.
- Optional data-only blocklist subscriptions accept only validated HTTPS JSON channels, categories, and keywords, with cached payload recovery and complete removal.
- Firefox now has an unsigned Manifest V2 companion package with a local page-world bridge and Kick-scoped `webRequest` blocking that mirrors the Chromium companion.
- Settings and the command menu support browser-language auto detection plus English, Spanish, and Portuguese selections.
- The release checklist repeats live proof at 1440×900 and 1920×1080 and captures screenshots for visual comparison after Kick deployments.

### Changed

- Added a panic switch that tears down Kick Focus styles, page markers, observers, request hooks, and overlays without a reload, then restores the enhanced page on demand.
- The README now distinguishes the default no-remote-code posture from the explicit, user-supplied data-only blocklist opt-in.

### Known limitations

- Browser-manager cold-start timing, authenticated surfaces, Safari, worker-only delivery, and server-side stitched ads remain unverified. The Firefox companion is package- and handshake-tested but still needs a live Firefox profile for end-to-end verification.

## 1.2.0, 2026-08-14

### Fixed

- A blocked `XMLHttpRequest` reported an error to the caller, which invites telemetry clients to retry and is how blocking one endpoint turns into a request loop. Blocked requests now answer with an empty success, matching what the `fetch` path already did. Measured over five minutes on a live channel: telemetry attempts flat, total requests steady at roughly 54 per minute with no acceleration, and uninterrupted playback.
- Kick Focus never started at all on any load where it won the `document-start` race. The observer that waits for `<body>` read the observer from its callback's first argument, which is the mutation list, so it threw on every mutation and the interface, apply cycle, and filters were never reached. It worked only when injection landed late enough that `<body>` already existed.
- Layout, filtering, ad-shell removal, chat detection, and sidebar sync stopped running after first paint on any busy page. The apply cycle was debounced with no maximum wait, and Kick mutates its DOM faster than the debounce window, so every mutation reset the timer and the work never ran. The delay is now capped, so a continuously changing page still gets serviced. Confirmed against live Kick: card detection went from 0 to 24 on `/browse`.

### Changed

- Analytics SDK blocks in the playback response (`mux_sdk`, `datazoom_sdk`) now follow the Reduce tracking telemetry setting instead of being removed unconditionally. Removing analytics is a privacy choice, not ad blocking, and `datazoom_sdk` was previously stripped from everyone regardless of the setting. Advertising SDKs are still always removed.
- Content labels are read from Kick's own markup, the category slug and short badge elements, instead of matching prose anywhere in a card. "Drop the beat" no longer reads as a Drops promotion and a stream mentioning a casino is no longer classified as gambling. Text matching remains only as a fallback for signals with no structured evidence, and the slug also makes classification work in every language.

### Added

- Ads are now disabled at their source. Kick decides client-side ad behaviour from flags in its `/playback` response, so that response is rewritten in flight: the automatic-ads session flag is reported false and the `google_ads_sdk`, `pal_sdk`, and `datazoom_sdk` blocks are removed before the player sees them. Covers both `fetch` and `XMLHttpRequest`, with the result cached per response body because the player re-reads it as the request progresses. Verified on a live channel, all three SDK blocks cleared, playback unaffected. Ads stitched into the video stream itself are still delivered; no page-level change can remove those.
- Importing settings now names anything it could not keep, values adjusted to a supported range, unknown settings, unknown sections, and upgrades from an unversioned or older file, instead of reporting a clean success while silently dropping part of a configuration.
- The About page explains the Chromium "Allow user scripts" toggle when the script started later than it should have, so the most common "it stopped working" case is answerable without leaving the browser. Hidden when injection was already first or the companion is installed.
- The Content & Ads page now reports whether Kick's ad stack still looks the way this build expects, and warns when it does not. A silent zero in the protection log previously looked identical to a clean page and to defences aiming at something that no longer exists. It found real drift on first run: Kick's playback response carries a `mux_sdk` block this build did not know about.
- The About page now reports when the script actually started, measured from what the page already contained, instead of claiming `document-start`. Chromium managers inject through `chrome.userScripts` and can land after the page's own scripts, so the timing is no longer asserted without evidence. Under the companion extension it reports `before any page script`. The Protection layer card and self-check also report the real layer rather than a fixed string.
- Home-page previews are now silenced rather than paused once. The complaint is about sound on arrival, and Kick restarts previews and inserts new ones as the page lives, so a single pass missed anything added later. Each preview is muted and held muted through a `play` listener, so a preview the site restarts is still silent. Verified by forcing every preview to unmute and play: all stayed muted and paused. Manual playback and other routes are untouched.
- Content filtering now fails open. When filters would hide more than a quarter of a grid of eight or more cards, nothing is hidden and the Content & Ads page explains why, a filter that empties a page is indistinguishable from the site being broken.
- `npm run verify:extension` refuses to report DOM results when it did not reach the real site. Kick serves headless browsers a short JSON error, against which every layout assertion passed trivially; the suite now runs headed and gates those checks on Kick's own markup being present.

## 1.1.0, 2026-08-14

### Added

- Optional Manifest V3 companion extension (`dist/extension/`, plus a shareable zip) that blocks known ad hosts at the browser network layer with `declarativeNetRequest`, which a Chromium userscript can no longer do for itself.
- Isolated-world bridge, service worker, and popup showing live protection state, enabled rulesets, per-tab block count, and a telemetry toggle.
- Companion handshake: the settings page and self-check now report `Network + page` or `Page only` based on what is actually installed, instead of describing a layer that may not be there.
- `npm run verify:extension`, a live proof-of-load that drives Chromium against Kick and asserts network-level blocking, page-world boot, and popup render.
- Generated extension icons and a dependency-free zip writer, keeping the project free of runtime and build dependencies.

### Changed

- The build emits both targets from one source, and generates the extension's network rules from the same host lists the page-realm classifier uses, so the layers cannot diverge.
- `npm run verify` grew from 8 to 27 checks, now covering version parity across `package.json`, the manifest, and the userscript metadata, plus rule/blocklist parity and extension shape.

### Fixed

- Both targets now refuse to boot twice, so having the userscript and the companion installed together no longer mounts two interfaces.
- Settings reached the companion only after the user changed something, leaving defaults that are on (such as Reduce tracking telemetry) disagreeing with the network rulesets on a fresh profile. The page now announces its effective settings, and the companion asks for them, so the exchange no longer depends on which script is injected first.

## 1.0.0, 2026-08-14

### Added

- Initial desktop-only Kick Focus userscript.
- Premium Focus Canvas layout direction and five settings-page mockups.
- Layout, Appearance, Content & Ads, Accessibility & Shortcuts, and About pages.
- Focus/Theater modes, compact/hidden sidebar, right/docked/hidden chat, chat width, grid density, and per-channel layout memory.
- Command menu, configurable shortcuts, conflict recovery, autosave, scoped/all reset confirmation, and JSON import/export.
- Theme/accent/radius/thumbnail/text/motion/contrast controls.
- Mature, casino, Drops, promoted-content, autoplay, and telemetry controls.
- Best-effort document-start ad request interception, DOM-shell cleanup, and sanitized in-memory protection log.
- SPA route handling and reinsertion-resistant DOM observer.
- Dependency-free build, artifact validation, and core test suite.

### Verified

- Logged-out Home, Browse, Categories, Clips, Category, Channel, search, and Log In surfaces.
- 1440×900 primary and 1920×1080 secondary desktop geometry.
- Live channel-to-channel and channel-to-browse SPA journeys.
- Patched SPA ad pass with zero observed ad-domain network requests, seven blocked page calls, and two removed ad scripts/shells.

### Known limitations

- Browser-manager cold-start timing, authenticated surfaces, Firefox/Safari, worker-only delivery, and server-side stitched ads remain unverified.
