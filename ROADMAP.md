# Roadmap

Updated: **2026-08-21**

Release history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks incomplete work only.

## Next, ordered by value

Added 2026-08-21 by an engineering and product-quality audit pass. Everything
above P3 here was measured, not guessed; each item names where it was traced to.

- [ ] P2 — Interpolated aria-labels are English in every locale
  Why: the i18n coverage gate's attribute scanner deliberately skips any attribute containing `${`, because a template is not a fixed string. That is the right call for the scanner and the wrong outcome for the strings: roughly 28 accessible names built by interpolation never got a dictionary entry, so a screen reader on Español or Português is read English throughout the emote library, the discovery cards and the grid. Fix shape is `trf('Open {name} artwork', { name })` with the template as the dictionary key, which is the pattern the rest of the build already uses.
  Where: src/runtime.js (card and emote shelf labels), src/settings.mjs (library tile actions), src/multistream.mjs (tile and saved-board actions)

- [ ] P2 — Two accessible names reach the DOM outside every scanner
  Why: `list.setAttribute('aria-label', 'Emote suggestions')` is a `setAttribute` call rather than markup, so no scanner matches it and the string has no entry in either locale. The multi-stream add and remove toasts are template literals for the same reason. Neither is caught by the gate, so both will drift again.
  Where: src/runtime.js (the emote completion list), src/multistream.mjs (the two grid toasts)

- [ ] P2 — "The emote could not be saved." still has no next step
  Why: the other five dead-end error toasts were given one in this pass. This one was deliberately left, because it is a catch-all around any thrown error and any cause written into it would be a guess. It needs either a narrower catch that can name the real failure (storage full, network, Kick markup drift) or a pointer to the About error log.
  Where: src/runtime.js (`handleChatStickerSave`)

- [ ] P2 — The Firefox manifest grants http as well as https
  Why: `*://kick.com/*` and `*://www.kick.com/*` include `http:`, while the MV3 manifest and the Firefox content-script matches are both https-only, so the http half is never exercised. Tightening it to `https://*` would make the install prompt match what the extension actually does. No attack traced; this is permission minimality.
  Where: src/extension/manifest.firefox.json

- [ ] P3 — Five different focus-ring treatments across one product
  Why: the shadow UI uses 3px accent, the nav search 2px accent, the toast action 2px `--text`, and the injected page 2px `--kf-accent`. Separately `.kf-text:focus`, `.kf-textarea:focus` and `.kf-select:focus` set `outline: 0` and substitute a 15%-alpha box-shadow, and their specificity beats the global `:focus-visible` rule, so no text input in the settings panel ever gets the 3px ring. The border-colour change still satisfies 2.4.7, so this is consistency rather than a hard failure. One `--focus-ring` token referenced everywhere would settle it.
  Where: src/runtime.js (`UI_CSS`, `HEADER_CONTROL_CSS`, `SITE_CSS`)

- [ ] P3 — The emote hover card is aria-hidden, so its content is sighted-only
  Why: the tooltip host carries `aria-hidden="true"` and nothing references it from the emote, so the access, reach and ownership lines never reach a screen reader. It fires on `focusin` as well as hover, so keyboard users do see it. The followed-channel preview beside it already does this correctly with a two-way `aria-describedby`, which is the pattern to copy. Lower priority because the most important line it carries, the shadowed-name warning, is also surfaced as prose on the Content page.
  Where: src/runtime.js (`chatEmoteTooltipHost`, `showChatEmoteTooltip`, `hideChatEmoteTooltip`)

- [ ] P3 — A channel-scoped favourite is signalled by an accent ring alone
  Why: scoped tiles get a 50%-alpha 1px inset shadow and nothing else; the pin button gives the scoped and unscoped cases the same `aria-label`, and the `title` that distinguishes them is demoted to a description once `aria-label` is present. So the distinction the code comment says must be obvious is colour-only. Folding the scope into the label and adding a non-colour marker would fix both halves.
  Where: src/runtime.js (the sticker shelf tile and its pin button)

- [ ] P3 — Two emote access badges collide with two accents
  Why: available uses `var(--accent)` while channel is a fixed `#ffcf61` and observed a fixed `#70e9e3`. On the gold accent, available against channel is 1.13:1; on cyan, available against observed is 1.22:1. Meaning is not carried by colour alone (each badge renders a text label), so this degrades the glance rather than the information, which is why it sits at P3.
  Where: src/runtime.js (`[data-access]` rules in `UI_CSS`)

- [ ] P3 — About 26 dead translation keys
  Why: both locales carry entries with no call site left in `src/`, mostly leftovers from the layout-to-board and hidden-to-not-interested renames. They cost nothing at runtime but they hide which strings are really in use, and two of them turned out to be the correct wording that the visible UI had drifted away from. Worth a sweep that removes the dead ones and a gate that keeps them from accumulating.
  Where: src/runtime.js (the es and pt blocks)

- [ ] P3 — The saved multi-stream arrangement is called four things
  Why: the live UI says "board", `STORAGE_STORES` says "multi-stream layouts", two import messages say "layouts", and the grid toasts said "Multi". An incomplete rename. The user-facing half should settle on "board".
  Where: src/core.mjs (`STORAGE_STORES`, `IMPORT_ERROR_MESSAGES`, `IMPORT_NOTE_MESSAGES`), src/multistream.mjs

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

## Research-Driven Additions, differential pass

Added 2026-08-15 from the differential research pass recorded in [RESEARCH.md](RESEARCH.md), run against v1.5.0.

### P0

### P1

### P2

### P3

## Research-Driven Additions, 2026-08-16 (v1.9.0 pass)

Added from the exhaustive research recorded in [RESEARCH.md](RESEARCH.md), run against v1.9.0. Continues the R-NN scheme (new here, the prior sections were left empty).

Cross-references to existing "Next" items: R-01 unblocks Next items 1, 4, and 5 (all need a real browser); R-09 supersedes Next item 2 (see inline note there); R-14 pairs with Next item 4. New selector dependencies added by R-06/R-07/R-16/R-19 (chat container, header control, discovery cards) should be registered with Next item 3's DOM-drift snapshots as they land.
Previously-blocked items now actionable: telemetry contradiction (R-08, external evidence now stands in for the multi-hour measurement), stitched-ad observability (R-09, via the player-events path, not the worker wrapper).

### P0, data safety, security, correctness, and the single unblock

### P1, operator demand first, then trust / reliability / accessibility

### P2, quick wins, operator second-wave, platform modernization, dev-experience

### P3, differentiators, larger bets, future-proofing

## Research-Driven Additions, 2026-08-17 (v1.20.0 pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md), run against v1.20.0. Continues the R-NN scheme from R-37.

Cross-references to existing work: R-56's derived-value assertions belong with "Next" item 1's fixture reducer and should land together, not beside each other. Nothing here covers autocomplete reach filtering, that is "Next" item 2 and stays there. R-45 and R-46 are the unblocks for two [Roadmap_Blocked.md](Roadmap_Blocked.md) items whose stated blockers have expired (the repo is public; Firefox 153 is installed); on completion, delete those entries from that file rather than leaving them recorded as blocked.

### P1, trust, accessibility, and two expired blockers

### P2, quick wins, then the 2026 platform

### P3, differentiators and future-proofing

## Research-Driven Additions, 2026-08-19 signed-in viewer pass

Added from the authenticated journey, competitor, accessibility, and platform research recorded in [RESEARCH.md](RESEARCH.md), run against v1.26.0. Continues the R-NN scheme from R-62. The existing “My emotes” Next item remains authoritative and is not duplicated below.

R-62 through R-71 from that pass are no longer listed here: they shipped in v1.27.0–v1.29.0 or were closed in RESEARCH.md (R-70). Auto-update, signed-in live gate, SSAI scrub, predictions payload, keyboard emote completion, and first-run tour remain in [Roadmap_Blocked.md](Roadmap_Blocked.md).

## Research-Driven Additions, 2026-08-20 (v1.31.0 pass)

Added from the research recorded in [RESEARCH.md](RESEARCH.md), run against v1.31.0. Continues the R-NN scheme from R-71.

### P0

### P1

### P2

### P3
