import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AD_HOSTS, TELEMETRY_HOSTS, TELEMETRY_NO_CANCEL_HOSTS, cancellableTelemetryHosts, STORAGE_STORES, buildSettingsExport, normalizeBlocklistUrl, VERSION } from '../src/core.mjs';
import { LIBRARY_SEED_BYTES } from '../src/storage.mjs';
import { ONLY_ACCOUNT_WRITE, SIGNED_IN_JOURNEYS } from './signed-in-journeys.mjs';

const exportProbe = buildSettingsExport({
  settings: { probe: 1 }, stickers: 1, usage: 1, multistream: 1, channelLayouts: 1,
  favoriteChannels: [1], dismissedChannels: [1], chatKeywords: 1, channelNotes: 1, mediaPreferences: 1,
});

const read = (relative) => readFile(resolve(relative), 'utf8');
const readJson = async (relative) => JSON.parse(await read(relative));

const source = await read('dist/kick-focus.user.js');
const manifest = await readJson('dist/extension/manifest.json');
const packageJson = await readJson('package.json');
const content = await read('dist/extension/content/kick-focus.js');
const bridge = await read('dist/extension/content/bridge.js');
const adRules = await readJson('dist/extension/rules/ads.json');
const telemetryRules = await readJson('dist/extension/rules/telemetry.json');
const devManifest = await readJson('dist/extension/manifest.dev.json');
const firefoxManifest = await readJson('dist/extension-firefox/manifest.json');
const firefoxBridge = await read('dist/extension-firefox/content/bridge.js');
/**
 * The Firefox page bundle, recovered from the string the bridge carries.
 *
 * It is no longer a file — shipping it as one meant injecting it from a
 * moz-extension:// URL, which leaked a per-install UUID into the page. Parsing
 * it back out keeps every bundle gate below covering the Firefox artifact, and
 * proves the embedded copy is a complete, valid bundle rather than a truncated
 * or mis-escaped one.
 */
const firefoxBundleLiteral = firefoxBridge.match(/^const PAGE_BUNDLE = (".*");$/m)?.[1] || '';
const firefoxContent = firefoxBundleLiteral ? JSON.parse(firefoxBundleLiteral) : '';
const firefoxHasSeparateBundle = await stat(resolve('dist/extension-firefox/content/kick-focus.js')).then(() => true, () => false);
const firefoxBackground = await read('dist/extension-firefox/background.js');
const background = await read('dist/extension/background.js');
const popup = await read('dist/extension/popup.js');
const extensionZip = await readFile(resolve(`dist/kick-focus-extension-v${VERSION}.zip`));

const mainWorld = manifest.content_scripts.find((entry) => entry.world === 'MAIN');
const isolated = manifest.content_scripts.find((entry) => entry.world === 'ISOLATED');
const ruleFiles = manifest.declarative_net_request.rule_resources;

// The trailing slash matters: without it the lookahead accepts a lookalike host
// like kick.com.evil.net, and the gate would pass on exfiltration.
const EXFIL_REGEX = /https:\/\/(?!(?:web\.|files\.|ext\.cdn\.)?kick\.com\/)[a-z0-9.-]+\/api\//i;

// A content-script match pattern must be an https (or *) URL whose host is
// kick.com or a subdomain of it — never <all_urls>, a bare *, or a lookalike
// like kick.com.evil.net. The final `/` after the host is what rejects the
// lookalike (kick.com.evil.net has no slash immediately after "com").
const KICK_MATCH_PATTERN = /^(https|\*):\/\/((\*|[a-z0-9-]+)\.)?kick\.com\//i;
const contentScriptsScoped = (entries) => entries.length > 0 && entries.every((entry) =>
  Array.isArray(entry.matches) && entry.matches.length > 0
  && entry.matches.every((pattern) => KICK_MATCH_PATTERN.test(pattern)));

/**
 * Every symbol a source module exports must be *defined* in every built bundle.
 *
 * `src/api.mjs` once shipped entirely missing: the build computed the bundle
 * string and then forgot to interpolate it. Every check still passed, because
 * `source.includes('playerEmbedUrl')` matches the call site in runtime.js just
 * as happily as the definition, and the unit tests import the module directly
 * rather than through the bundle. So this looks for the definition, and derives
 * the list from the source instead of a hand-maintained one — a module added
 * later is covered without anyone remembering to add it here.
 */
async function missingExports(moduleFile, bundle) {
  const moduleSource = await read(moduleFile);
  const missing = [];
  for (const match of moduleSource.matchAll(/^export\s+(?:async\s+)?(function|const|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    const [, kind, name] = match;
    const defined = kind === 'function'
      ? new RegExp(`(?:^|\\n)(?:async\\s+)?function\\s+${name}\\b`).test(bundle)
      : new RegExp(`(?:^|\\n)${kind}\\s+${name}\\b`).test(bundle);
    if (!defined) missing.push(name);
  }
  return missing;
}

const bundleTargets = [['dist/kick-focus.user.js', source], ['dist/extension/content/kick-focus.js', content], ['dist/extension-firefox/content/kick-focus.js', firefoxContent]];
// Read from the tree, not hand-listed: the promise above — that a module added
// later is covered without anyone remembering this file — is only true if the
// list is derived. It was hand-written, so src/multistream.mjs would have been
// bundled and checked by nothing.
const moduleFiles = (await readdir(resolve('src')))
  .filter((name) => name.endsWith('.mjs'))
  .map((name) => `src/${name}`);
const settingsModuleSource = await read('src/settings.mjs');
const runtimeModuleSource = await read('src/runtime.js');
const bundleGaps = [];
for (const [bundleName, bundleSource] of bundleTargets) {
  for (const moduleFile of moduleFiles) {
    const missing = await missingExports(moduleFile, bundleSource);
    if (missing.length) bundleGaps.push(`${bundleName} is missing ${missing.length} export(s) from ${moduleFile}: ${missing.slice(0, 6).join(', ')}`);
  }
}

/**
 * Which accessibility flags a bundle keys off the shadow **host**.
 *
 * The mod's own chrome lives in a shadow root, so the site rules written at
 * `html[data-kf-...]` cannot reach it — "larger targets" and "reduce motion"
 * styled Kick's controls and left ours alone. `:host-context()` would cross the
 * boundary, but Firefox has never implemented it and the build ships a Firefox
 * artifact, so only `:host([...])` counts here. The `(` immediately after
 * `:host` is what rejects `:host-context(`.
 */
const hostKeyedAccessibility = (bundle) =>
  new Set([...String(bundle).matchAll(/:host\(\[data-kf-(large-targets|reduce-motion)="true"\]\)/g)].map((match) => match[1]));
const shadowAccessibilityWired = (bundle) => {
  const flags = hostKeyedAccessibility(bundle);
  return flags.has('large-targets') && flags.has('reduce-motion');
};

/**
 * Every backup store must be read out of the import result inside
 * `applyImportedStores`. Derived from the registry rather than a hand-listed
 * set of `gmSet(...)` lines: the previous version named the exact write calls,
 * so restructuring the function into one staged transaction broke the gate
 * without anything actually going missing, and a store added later was never
 * covered at all. `settings` arrives as `result.settings`, which is null when
 * the file omitted every settings section so a stickers-only import cannot
 * wipe the live profile.
 */
const importBody = (() => {
  const start = source.indexOf('function applyImportedStores');
  return start === -1 ? '' : source.slice(start, source.indexOf('\n}', start));
})();
const importGapsIn = (body) => STORAGE_STORES
  .filter((store) => store.backup)
  .map((store) => (store.field === 'settings' ? 'result.settings' : `result.${store.field}`))
  .filter((reference) => !String(body).includes(reference));
const importGaps = importGapsIn(importBody);

/**
 * No module syntax may survive into a bundle.
 *
 * The build strips `import`/`export` and leans on concat order to supply the
 * names instead, which is what lets a bundled module declare real imports and
 * still load standalone under node:test. If a strip ever misses — a multi-line
 * import, a double-quoted specifier, a new `export {}` form — the artifact gets
 * an `import` statement inside a function body, which is a SyntaxError the
 * moment a browser parses it. `node --check` catches it for the userscript; this
 * catches it for all three artifacts and names which one.
 */
const MODULE_SYNTAX = /^(?:import|export)\s/m;
const withModuleSyntax = (bundle) => MODULE_SYNTAX.test(bundle);
const leakedModuleSyntax = bundleTargets.filter(([, bundleSource]) => withModuleSyntax(bundleSource)).map(([name]) => name);

/**
 * What the organizer's render signature actually accounts for.
 *
 * Reordering favorites, removing an emote, and reassigning a group each change
 * nothing else about the shelf, so a signature that omits one of them leaves the
 * stale arrangement on screen. This used to be asserted as
 * `source.includes('favoriteKeysInOrder().join')` — a literal call site, which
 * broke the moment that value was computed once and reused, without anything
 * actually going missing. Read the signature array and check what is in it.
 */
const ORGANIZER_SIGNATURE_TERMS = [/favoriteOrder|favoriteKeysInOrder/, /hidden/, /assignments/, /groups/];
function organizerSignatureCovers(bundle) {
  const start = bundle.indexOf('const signature = [');
  if (start === -1) return false;
  // The array's own closing bracket starts a line; `[...set].join(',')` inside
  // an entry does not, and matching that one truncated the body before the last
  // two terms — so the gate passed on a signature it had never finished reading.
  const rest = bundle.slice(start);
  const close = /\n\s*\]\.join\(/.exec(rest);
  if (!close) return false;
  const body = rest.slice(0, close.index);
  return ORGANIZER_SIGNATURE_TERMS.every((term) => term.test(body));
}

/**
 * The organizer renders a window, and its spacer arithmetic agrees with the CSS.
 *
 * A library at the cap is 2400 tiles; what goes in the DOM is one window plus a
 * spacer standing in for the rows above and below it. The spacer's height is
 * computed in JS from a tile height and gap that are *written in the CSS*, so
 * changing the stylesheet without the constants would leave the scrollbar
 * describing a library of the wrong size — silently, and only past the first
 * screenful. This gate is what ties the two together.
 */
const organizerWindows = (bundle) => /visibleWindow\(visible,/.test(bundle)
  && bundle.includes('data-kf-sticker-spacer')
  && bundle.includes('stickerSpacerMarkup');
const spacerMathMatchesCss = (bundle) => {
  const height = /const STICKER_TILE_HEIGHT = (\d+);/.exec(bundle)?.[1];
  const gap = /const STICKER_GRID_GAP = (\d+);/.exec(bundle)?.[1];
  const minWidth = /const STICKER_TILE_MIN_WIDTH = (\d+);/.exec(bundle)?.[1];
  if (!height || !gap || !minWidth) return false;
  return new RegExp(`grid-auto-rows: ${height}px`).test(bundle)
    && new RegExp(`\\[data-kf-sticker-grid\\][\\s\\S]{0,400}?gap: ${gap}px`).test(bundle)
    && new RegExp(`\\[data-kf-sticker-grid\\][\\s\\S]{0,400}?minmax\\(${minWidth}px, 1fr\\)`).test(bundle);
};
/** Typing must be one render, not one per keystroke. */
const organizerDebouncesSearch = (bundle) =>
  /addEventListener\('input'[\s\S]{0,400}?STICKER_SEARCH_DEBOUNCE_MS/.test(bundle);
/** A favorite toggle must patch its tile, not re-serialise the window. */
const organizerPatchesInPlace = (bundle) => /function patchStickerTileStates/.test(bundle)
  && /patchStickerTileStates\(gridHost\)/.test(bundle)
  && bundle.includes('data-kf-sticker-state="${pinned}:${hidden}"');

/**
 * Cross-tab convergence must stay a nudge, never the mechanism.
 *
 * `BroadcastChannel` and `localStorage` are scoped to one origin while the
 * userscript's GM storage is not, so a `www.kick.com` tab and a `kick.com` tab
 * can share a store without hearing each other. That is survivable only because
 * the store is re-read on every commit and on open; a design that applied
 * broadcasts to an in-memory grid instead would diverge silently. These assert
 * the re-reads exist and that a receiving tab never writes back — which is what
 * stops two tabs echoing an op at each other.
 */
const convergenceRereads = (bundle) =>
  /function commitMultistream[\s\S]{0,400}?mergeMultistream\(gmGet\(MULTISTREAM_KEY/.test(bundle)
  && /function openMultistream[\s\S]{0,600}?commitMultistream\(\);/.test(bundle)
  && /function applyRemoteMultistream[\s\S]{0,600}?mergeMultistream\(gmGet\(MULTISTREAM_KEY/.test(bundle);
const remoteApplyNeverWrites = (bundle) => {
  const start = bundle.indexOf('function applyRemoteMultistream');
  if (start === -1) return false;
  const nextFunction = bundle.indexOf('\nfunction ', start + 9);
  const body = bundle.slice(start, nextFunction === -1 ? bundle.length : nextFunction);
  return !/gmSet\(|broadcastMultistream\(/.test(body);
};

/**
 * The completion list is clicked, never keyed, and never sends.
 *
 * Every other client accepts a completion with Tab or Enter, which means
 * capturing keys the composer is entitled to. This build's rule is that it adds
 * no keyboard shortcut, so the list must carry no key listener of its own — and
 * accepting must go through the same plain-name insertion boundary as the
 * Type-in-chat action, with no form submit or Enter synthesis anywhere near it.
 */
const completionIsMouseOnly = (bundle) => {
  const start = bundle.indexOf('function acceptEmoteCompletion');
  const open = bundle.indexOf('function emoteCompletionHost');
  if (start === -1 || open === -1) return false;
  const region = bundle.slice(Math.min(start, open), Math.max(start, open) + 3000);
  return !/addEventListener\('key(down|up|press)'/.test(region)
    && !/requestSubmit|\.submit\(|key: 'Enter'|which: 13|keyCode: 13/.test(region)
    && /insertText', false, `\$\{plan\.text\} `/.test(bundle)
    && /emoteInsertionPlan\(sticker\)/.test(region);
};

/**
 * No two bundled modules may declare the same top-level name.
 *
 * Every module's text lands in one function scope, so two files each declaring
 * `const isRecord` produce a SyntaxError in the artifact — from a change that
 * looks entirely local and passes its own module's tests. `node --check` finds
 * it for the userscript, but only after the build; naming both files is faster
 * and says which two collided.
 */
async function topLevelCollisions(files) {
  const owners = new Map();
  const clashes = [];
  for (const file of files) {
    const text = await read(file);
    const names = new Set();
    for (const match of text.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      names.add(match[1]);
    }
    for (const name of names) {
      if (owners.has(name)) clashes.push(`${name} in ${owners.get(name)} and ${file}`);
      else owners.set(name, file);
    }
  }
  return clashes;
}
const nameClashes = await topLevelCollisions([...moduleFiles, 'src/runtime.js']);

/**
 * The auto-claim clicks Kick's button and nothing else.
 *
 * Three properties make this safe, and all three are worth failing on. It must
 * drive the DOM rather than the claim endpoint (which lives inside Kick's own
 * bundle — replaying it would be exactly the private-endpoint replay this
 * project refuses). It must treat both `disabled` and `aria-disabled` as a
 * refusal, because Kick sets both and honouring one is honouring neither. And
 * it must only act inside a dialog this build itself opened, since `role=dialog`
 * is reused across the site and clicking an action button in the wrong one is a
 * misfire rather than a missed reward.
 */
function rewardClaimRegion(bundle) {
  const start = bundle.indexOf('const REWARD_TRIGGER =');
  const end = bundle.indexOf('function chatMessageInput', start);
  return start === -1 || end === -1 ? '' : bundle.slice(start, end);
}
const rewardClaimIsSafe = (bundle) => {
  const region = rewardClaimRegion(bundle);
  if (!region) return false;
  return /\.disabled\)?\s*\|\|\s*.*aria-disabled/.test(region)
    && region.includes('decideRewardClaim({')
    && region.includes("dialog.dataset.kfRewardDialog === 'true'")
    // The dialog must be disowned before the click, or the apply cycle presses
    // the same button again for as long as the reveal is on screen.
    && /delete open\.dataset\.kfRewardDialog;\s*\n\s*action\.click\(\)/.test(region)
    // No network of any kind in the claim path.
    && !/\bfetch\(|XMLHttpRequest|pageFetch\(|kickFetchJson\(/.test(region);
};
/** It must be opt-in, like every other feature that acts on the user's behalf. */
const rewardClaimIsOptIn = (bundle) => /autoClaimRewards: false/.test(bundle)
  && /enabled: settings\.autoClaimRewards/.test(bundle);

/** Any `innerHTML =` in a shipped bundle that is not handed to the policy. */
const bareHTMLWrite = /\.innerHTML\s*=(?!\s*trustedHTML\()/g;
/**
 * Markup reaches the DOM through exactly one function.
 *
 * There must be exactly one `innerHTML =` left in a bundle — the write inside
 * `setMarkup` — and every other surface must reach it through that helper. Counting rather than pattern-matching the call sites is
 * deliberate: the fifteenth surface someone adds is the one that will assign
 * directly, and a count catches that without naming every caller.
 */
const directHTMLWrites = (bundle) => (bundle.match(/\.innerHTML\s*=/g) || []).length;

const unroutedHTML = bundleTargets
  .filter(([, bundleSource]) => bareHTMLWrite.test(bundleSource) && (bareHTMLWrite.lastIndex = 0) === 0)
  .map(([name]) => name);

/**
 * The live gate's own outcome discipline, asserted offline.
 *
 * Two defects this guards, both measured 2026-08-17: a probe that samples the
 * page once races the apply cycle and reported a shipped feature as dead, and a
 * probe that treats "Kick put nothing here on this route" as a failure produced
 * four red results on `/browse` that were not defects. Neither is visible to any
 * other gate, because the live gate is the thing being checked.
 */
const liveGate = await read('scripts/verify-extension.mjs');
/** A shadow-host read that reaches a verdict without waiting for the host. */
const unwaitedShadowReads = (source) => {
  const reads = source.match(/shadowRoot;?\n\s*if \(!shadow\)/g) || [];
  return reads.filter((read) => !read.includes('__kfWait')).length;
};
const skipReasonsAreActionable = (source) => {
  const reasons = [...source.matchAll(/\{\s*skip:\s*'([^']+)'/g)].map((m) => m[1]);
  // A skip has to say what was missing; a bare noun trains people to ignore it.
  return reasons.length > 0 && reasons.every((reason) => reason.length > 25);
};

/**
 * Every top-level host this build creates must declare the interface language.
 *
 * Kick's document is `<html lang="en">` and `lang` inherits through the flat
 * tree into a shadow root, so a translated surface that does not say otherwise
 * is announced with English phonemes — WCAG 2.2 SC 3.1.2 (AA). There are five
 * hosts and it is the *sixth* one, added later by someone who did not know
 * this, that the gate exists to catch.
 */
const hostsDeclareLanguage = (bundle) => {
  const declared = [...bundle.matchAll(/(\w+)\.id = '(kick-focus-[a-z-]+)';\n\s*\1\.lang = /g)].map((m) => m[2]);
  const created = [...bundle.matchAll(/\w+\.id = '(kick-focus-[a-z-]+)';/g)].map((m) => m[1]);
  return created.length >= 4 && created.every((id) => declared.includes(id));
};

/**
 * Every privileged message type checks its sender before acting.
 *
 * The listener owns a cross-origin fetch and a persistent ruleset toggle, so a
 * handler that trusts the message's shape and not its sender will act for
 * anything that can reach it. The gate is written against the *next* message
 * type somebody adds, which is the one that will forget.
 */
const everyMessageChecksSender = (background) => {
  // Line-based rather than one multiline regex: the thing being asserted is
  // "the line after the handler opens is the guard", and saying that directly
  // is easier to read than escaping newlines into a pattern.
  const lines = background.split('\n');
  const opens = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /if \(message\?\.type === '[^']+'\) \{/.test(line));
  return opens.length >= 4
    && opens.every(({ index }) => /^\s*if \(!from\w+\(sender\)\)/.test(lines[index + 1] || ''));
};

/**
 * How large each shipped artifact may get, and why that number.
 *
 * The userscript is the one with a real ceiling. Violentmonkey 2.47.0+ is the
 * first MV3 release, and it only gives true `document-start` injection in
 * "Alternative page mode", which its own release notes describe as limited to
 * roughly 1 MB of injected script. Crossing that does not error — injection
 * silently lands late, which is the hardest class of failure this project has.
 * Greasy Fork's 2 MB cap is the second, looser ceiling.
 *
 * Growth is real: the userscript went 612,899 B at v1.14.0 to 765,227 B here,
 * about 25 KB a release. The budget exists so that trend fails a gate before it
 * fails a user, and the warning band makes it visible a few releases out.
 *
 * The Firefox bridge is deliberately larger — it carries the page bundle as a
 * string so no extension URL reaches the page — and is not injected by a
 * userscript manager, so the 1 MB rule does not apply to it.
 */
/**
 * The two anchored surfaces resolve their anchor, and keep the path that does
 * not need one.
 *
 * Anchor names are tree-scoped, and this build's surfaces live in shadow roots
 * whose hosts sit in the document tree. A `position-anchor` written into one of
 * those shadow stylesheets resolves against the shadow tree, where a name set
 * on a page element does not exist. Measured in Chrome 151 on 2026-08-18: that
 * spelling does not throw and does not warn — it simply does not anchor, and
 * the surface lands in the corner of the viewport. The only correct place for
 * it is an inline style on the host, which shares the document tree with the
 * anchor, so a colon-form `position-anchor` surviving into a bundle is the
 * defect. `CSS.supports()` arguments are stripped first, since the feature
 * detect legitimately names the property in that form.
 */
const anchoredSurfacesResolve = (bundle) => {
  const withoutDetects = bundle.replace(/CSS\.supports\('[^']*'\)/g, '');
  if (/position-anchor\s*:/.test(withoutDetects)) return false;
  if (!/setProperty\('position-anchor', name\)/.test(bundle)) return false;
  // Counted without the detects for the same reason they are stripped above:
  // `canAnchorPopover` names the property legitimately, and it is not a rule.
  const flips = (withoutDetects.match(/position-try-fallbacks:/g) || []).length;
  const anchoredHosts = (bundle.match(/:host\(\[data-kf-anchored="true"\]\)/g) || []).length;
  // Every anchored host declares its own flips: a surface that opts into the
  // top layer without them cannot come back on screen at a viewport edge.
  return flips >= 2 && flips === anchoredHosts;
};

/**
 * Every anchor-positioning property this build leans on is feature-detected.
 *
 * The names churned during standardisation — `inset-area` became
 * `position-area`, `position-try-options` became `position-try-fallbacks` — and
 * Chrome 151 answers false for both older spellings. An undetected property
 * does not fail loudly; it drops out of the cascade, and the surface is placed
 * by whatever is left.
 */
const anchorPropertiesAreDetected = (bundle) => {
  const start = bundle.indexOf('function canAnchorPopover');
  if (start === -1) return false;
  const region = bundle.slice(start, start + 1200);
  return ['anchor-name', 'position-anchor', 'position-area', 'position-try-fallbacks']
    .every((property) => region.includes(`CSS.supports('${property}:`))
    && /showPopover/.test(region)
    && !region.includes('inset-area')
    && !region.includes('position-try-options');
};

/**
 * A surface in the top layer is `manual`, and still knows how to place itself.
 *
 * An `auto` popover installs a close watcher: Escape would be consumed here
 * instead of reaching Kick's composer, and any outside click would light-dismiss
 * — which for a card sitting under the cursor means fighting the click that was
 * meant for chat. R-52's acceptance is that keyboard and focus behaviour are
 * unchanged, and `manual` is what delivers it. The hand-positioned path stays
 * for engines without a top layer, so both surfaces must still compute one.
 */
const anchoredSurfacesAreManual = (bundle) =>
  /setAttribute\('popover', 'manual'\)/.test(bundle)
  && !/'popover', 'auto'|popover="auto"/.test(bundle)
  && /host\.style\.left = /.test(bundle)
  && /host\.style\.top = /.test(bundle);

/**
 * Every declared derived expectation actually has a deriver behind it.
 *
 * The rot this guards is quiet by construction: `derivedSnapshot` reports an
 * expectation with no deriver as `unchecked`, which is neither a pass nor a
 * failure, so adding an expectation and forgetting to wire it produces a check
 * that never checks anything and never says so.
 */
const derivedExpectationsAreWired = (bundle) => {
  const start = bundle.indexOf('DERIVED_EXPECTATIONS = Object.freeze([');
  const end = bundle.indexOf('function describeDerived', start === -1 ? 0 : start);
  if (start === -1 || end === -1) return false;
  const declared = [...bundle.slice(start, end).matchAll(/id: '([A-Za-z][\w]*)'/g)].map((match) => match[1]);
  if (declared.length < 3) return false;
  const derivers = bundle.indexOf('function compatibilityDerivers');
  if (derivers === -1) return false;
  const region = bundle.slice(derivers, derivers + 1000);
  return declared.every((id) => region.includes(`${id}:`));
};

/**
 * The verdict is published everywhere the snapshot is taken.
 *
 * The live gate reads `html[data-kf-derived]` rather than reaching into the
 * bundle, so a snapshot taken without publishing it is a snapshot no gate can
 * see. Counted rather than pattern-matched: the third call site someone adds is
 * the one that will forget.
 */
const compatibilityVerdictIsPublished = (bundle) => {
  const taken = (bundle.match(/state\.compatibility = compatibilitySnapshot\(/g) || []).length;
  const published = (bundle.match(/publishCompatibility\(\);/g) || []).length;
  return taken > 0 && published === taken;
};

/**
 * No source file carries a stray control byte.
 *
 * Written after one cost an afternoon on 2026-08-18: a scripted edit collapsed
 * `\b` into a literal U+0008 inside a gate's own regex, so the gate silently
 * matched nothing. It is invisible in a diff, in a terminal, and in most
 * editors — the only thing that catches it is looking for it. Tabs, newlines
 * and carriage returns are the only ones allowed.
 */
const CONTROL_BYTE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const withControlBytes = (files) => files
  .filter(([, text]) => CONTROL_BYTE.test(text))
  .map(([name, text]) => `${name} at byte ${text.search(CONTROL_BYTE)}`);

/**
 * The chat pop-out builds its own frame and never moves the grid's.
 *
 * Measured in Chrome 151 on 2026-08-18: appending an existing `<iframe>` into a
 * Document PiP document destroys and recreates its browsing context, and moving
 * it back does it again — two chat reloads per cycle, and the grid's tile loses
 * its connection and scrollback both ways. The whole design rests on the window
 * getting a frame of its own while the grid's stays mounted and merely hidden,
 * and nothing about that is obvious from reading the code, so it is gated.
 */
const popOutBuildsItsOwnFrame = (bundle) => {
  const start = bundle.indexOf('function fillChatWindow');
  if (start === -1) return false;
  const region = bundle.slice(start, start + 1200);
  // Its own element, created against the pop-out's document...
  if (!/createElement\('iframe'\)/.test(region)) return false;
  // ...and never the grid's, which is the only frame reachable through that
  // attribute. Reaching for it here is the move this exists to forbid.
  return !region.includes('data-kf-multistream-chat');
};

/**
 * The window is closed, not merely forgotten, and the pane is hidden, not emptied.
 *
 * `replaceChildren()` on the chat pane while popped out would unmount the grid's
 * frame, which is the same reload by another route.
 */
const popOutReturnsWithoutReload = (bundle) =>
  /kfMultistreamChatPoppedOut = String\(chatPoppedOut\(\)\)/.test(bundle)
  && /data-kf-multistream-chat-popped-out="true"\]/.test(bundle)
  && /addEventListener\('pagehide'/.test(bundle);

/**
 * The merged chat is read-only, structurally.
 *
 * Every other chat surface in this project is read-only because Kick refuses
 * sending from an embedded chat; this one is read-only because it is *built*
 * from a WebSocket read and has nowhere to send to. That is easy to lose the
 * day someone adds a composer to the pane, so the row template is checked for
 * anything that could take input or submit, and the merged path is checked for
 * a send.
 */
const mergedChatIsReadOnly = (bundle) => {
  const start = bundle.indexOf('function paintMergedChat');
  if (start === -1) return false;
  const region = bundle.slice(start, start + 1400);
  if (/<(input|textarea|form|button)\b/i.test(region)) return false;
  // The sockets carry subscribe frames and nothing else. A send anywhere in the
  // merged path is the failure this exists to catch.
  const open = bundle.indexOf('async function openMergedChannel');
  if (open === -1) return false;
  const next = bundle.indexOf('function startMergedChannel', open);
  const socketRegion = bundle.slice(open, next > open ? next : open + 4000);
  const sends = socketRegion.match(/\.send\(/g) || [];
  return sends.length === 1 && /socket\.send\(realtimeSubscribeFrame\(name\)\)/.test(socketRegion);
};

/**
 * A channel that leaves the grid stops costing a connection.
 *
 * Nine sockets are nine sockets; one left open for a tile nobody is watching is
 * a leak the user cannot see. The sync diffs against the grid's own list, and
 * closing a channel drops its messages with it.
 */
const mergedChatFollowsTheGrid = (bundle) =>
  /function syncMergedChat\(slugs\)/.test(bundle)
  && /if \(!wantedSet\.has\(slug\)\) closeMergedChannel\(slug\)/.test(bundle)
  && /dropMergedChannel\(merged\.entries, slug\)/.test(bundle);

const SIZE_BUDGETS = [
  ['dist/kick-focus.user.js', source, 1_000_000, 'Violentmonkey MV3 Alternative page mode, ~1 MB of injected script'],
  ['dist/extension/content/kick-focus.js', content, 1_500_000, 'no injection ceiling; tracked so growth stays visible'],
  ['dist/extension-firefox/content/bridge.js', firefoxBridge, 1_500_000, 'carries the page bundle inline; no injection ceiling'],
];
const byteLength = (value) => (typeof value === 'string'
  ? Buffer.byteLength(value, 'utf8')
  : value.length);
const overBudgetIn = (budgets) => budgets
  .filter(([, text, budget]) => byteLength(text) > budget)
  .map(([name, text, budget, why]) => `${name} is ${byteLength(text)} B, over its ${budget} B budget (${why})`);
const overBudget = overBudgetIn(SIZE_BUDGETS);
for (const [name, text, budget] of SIZE_BUDGETS) {
  const used = byteLength(text) / budget;
  if (used > 0.85 && used <= 1) {
    console.log(`WARN ${name} is at ${Math.round(used * 100)}% of its ${budget} B budget`);
  }
}

/**
 * The userscript plus what it will put in storage, against the same ceiling.
 *
 * Violentmonkey's Alternative page mode advisory is injected script *and*
 * storage, not the file alone — so a file cut that lands comfortably under a
 * megabyte can still cross the line once the emote library's synchronous seed
 * is written beside it. `LIBRARY_SEED_BYTES` is what makes this exact rather
 * than an estimate: `planLibraryPersist` trims the seed until its JSON fits
 * that budget, so it is a ceiling the runtime enforces, not a guess about how
 * big a library gets.
 */
const INJECTION_CEILING = 1_000_000;
const INJECTION_BUDGET = 925_000;
/**
 * Bytes, not characters.
 *
 * This used to measure `String.prototype.length`, which counts UTF-16 code
 * units, and then print the answer with a B after it. The bundle carries about
 * 1,450 non-ASCII characters — the accented halves of the Spanish and
 * Portuguese dictionaries, curly quotes, and the star and arrow glyphs on the
 * shelf — and every one of them is two or three bytes on the wire. The gap had
 * reached 1.7 KB, which is the difference between reporting room to spare and
 * being over the line. A userscript manager injects bytes.
 */
const injectionFootprint = (userscript, seedBudget) => byteLength(userscript) + seedBudget;
const overInjectionBudget = (userscript, seedBudget) => injectionFootprint(userscript, seedBudget) > INJECTION_BUDGET;
const footprint = injectionFootprint(source, LIBRARY_SEED_BYTES);
const injectionReserve = INJECTION_CEILING - footprint;
console.log(`INFO userscript ${byteLength(source).toLocaleString('en-US')} B + library seed budget ${LIBRARY_SEED_BYTES.toLocaleString('en-US')} B = ${footprint.toLocaleString('en-US')} B; ${injectionReserve.toLocaleString('en-US')} B reserved below the ${INJECTION_CEILING.toLocaleString('en-US')} B injection ceiling`);

const sourceFiles = await Promise.all(
  [...moduleFiles, 'src/runtime.js', 'scripts/check.mjs', 'scripts/build.mjs', 'scripts/verify-extension.mjs', 'scripts/verify-firefox.mjs']
    .map(async (name) => [name, await read(name)]),
);
const controlByteFiles = withControlBytes(sourceFiles);

/**
 * Every request this build sends with a method other than GET.
 *
 * The signed-in journey matrix claims each of its journeys is read-only, and a
 * claim in a comment is worth nothing. This is the falsifiable half: find every
 * non-GET request in the shipped bundle and insist the only ones are the follow
 * request behind the click-to-save gesture and the unfollow that undoes it.
 *
 * Two spellings are counted, because the build carries both: a literal
 * `method: 'POST'`, and a `method` shorthand fed by a parameter defaulting to
 * POST. The literal sweep is filtered to real HTTP verbs — `method` is also the
 * name of a field recording *how* the remote blocklist was fetched, and
 * `method: 'companion'` is not a request.
 *
 * A third write appearing in either shape fails this, which is the point. It
 * should be a decision somebody makes on purpose, not a diff nobody noticed.
 */
const HTTP_VERBS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

const accountWrites = (bundle) => {
  const literals = [...bundle.matchAll(/method:\s*'(\w+)'/g)]
    .map((match) => match[1].toUpperCase())
    .filter((method) => HTTP_VERBS.has(method) && method !== 'GET' && method !== 'HEAD');
  const shorthand = [...bundle.matchAll(/async function (\w+)\([^)]*method = '(\w+)'/g)]
    .filter((match) => HTTP_VERBS.has(match[2].toUpperCase()) && match[2].toUpperCase() !== 'GET')
    .map((match) => match[1]);
  return { literals, shorthand };
};

/** The follow write, and the unfollow that reverses it, and nothing else. */
const onlyWritesAreTheFollowGesture = (bundle) => {
  const { literals, shorthand } = accountWrites(bundle);
  if (literals.length > 0) return false;
  if (shorthand.length !== 1 || shorthand[0] !== 'mutateKickChannelFollow') return false;
  // One definition plus exactly two call sites.
  if ([...bundle.matchAll(/mutateKickChannelFollow\(/g)].length !== 3) return false;
  // The follow: reached only after the emote's own follow requirement is read.
  const follow = bundle.indexOf("mutateKickChannelFollow(follow.slug, 'POST')");
  if (follow < 0) return false;
  const beforeFollow = bundle.slice(Math.max(0, follow - 900), follow);
  if (!beforeFollow.includes('emoteFollowRequirement(') || !beforeFollow.includes('follow.required')) return false;
  // The unfollow: reached only from the undo of that same save.
  const undo = bundle.indexOf("mutateKickChannelFollow(unfollowSlug, 'DELETE')");
  if (undo < 0) return false;
  return bundle.slice(Math.max(0, undo - 600), undo).includes('undoChatStickerSave');
};

/**
 * The body of **every** `@media (<query>)` block in a stylesheet, by brace
 * matching rather than by regex.
 *
 * Every, not the first: SITE_CSS carries two `(min-width: 1024px)` blocks, and
 * a gate that read only the first reported green while a focus outline sat in
 * the second. Nested blocks are counted, so a `:is()` or a nested at-rule
 * cannot end a region early.
 */
const mediaBlockBodies = (css, query) => {
  const bodies = [];
  const needle = `@media ${query}`;
  let from = 0;
  for (;;) {
    const head = css.indexOf(needle, from);
    if (head === -1) return bodies;
    const open = css.indexOf('{', head);
    if (open === -1) return bodies;
    let depth = 0;
    let close = -1;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) { close = i; break; }
      }
    }
    if (close === -1) return bodies;
    bodies.push(css.slice(open + 1, close));
    from = close;
  }
};

/**
 * An accessibility setting must not be conditional on viewport width. Layout
 * rules may be; a focus outline and a touch target may not.
 */
const ACCESSIBILITY_ATTRIBUTES = [
  'data-kf-large-targets',
  'data-kf-contrast',
  'data-kf-control-contrast',
  'data-kf-focus-visible',
];
const widthGatedAccessibility = (css, query = '(min-width: 1024px)') => {
  const bodies = mediaBlockBodies(css, query);
  return ACCESSIBILITY_ATTRIBUTES.filter((attribute) => bodies.some((body) => body.includes(attribute)));
};
const gatedAccessibility = widthGatedAccessibility(source);

/**
 * Do all five copies of the blocklist URL rule actually agree?
 *
 * The old gate asserted each file contained the string
 * `function normalizeBlocklistUrl`, which is a spelling check: core's copy
 * accepted `https://user:pass@host/x#f` and the four extension copies rejected
 * it for months underneath a green build. Each copy is extracted by brace
 * matching, evaluated, and run over one corpus beside the real exported
 * function, and any disagreement names the input.
 */
const extractFunction = (text, name) => {
  const head = text.indexOf(`function ${name}(`);
  if (head === -1) return '';
  const open = text.indexOf('{', head);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(head, i + 1);
    }
  }
  return '';
};

const BLOCKLIST_URL_CORPUS = [
  'https://example.com/list.json',
  'https://example.com/list.json#fragment',
  'https://user:pass@example.com/list.json',
  'https://user@example.com/list.json',
  'https://:pass@example.com/list.json',
  'http://example.com/list.json',
  'ftp://example.com/list.json',
  'javascript:alert(1)',
  'data:application/json,{}',
  'file:///etc/passwd',
  '  https://example.com/list.json  ',
  '',
  'not a url',
  `https://example.com/${'a'.repeat(2100)}`,
  'https://example.com/list.json?a=1&b=2',
  'HTTPS://EXAMPLE.COM/List.JSON',
];

// The source files, not the built ones: the Firefox bridge carries the whole
// page bundle inline as a string literal, so a search of the artifact finds
// core's copy inside that string before it finds the bridge's own.
const blocklistUrlCopies = await Promise.all([
  'src/extension/background.js',
  'src/extension/background.firefox.js',
  'src/extension/bridge.js',
  'src/extension/bridge.firefox.js',
].map(async (name) => [name, await read(name)])).then((entries) => entries.map(([name, text]) => {
  const body = extractFunction(text, 'normalizeBlocklistUrl');
  // eslint-disable-next-line no-new-func
  const fn = body ? new Function(`${body}; return normalizeBlocklistUrl;`)() : null;
  return [name, fn];
}));

const blocklistUrlDisagreements = blocklistUrlCopies.flatMap(([name, fn]) => {
  if (typeof fn !== 'function') return [`${name} has no readable normalizeBlocklistUrl`];
  return BLOCKLIST_URL_CORPUS
    .filter((input) => fn(input) !== normalizeBlocklistUrl(input))
    .map((input) => `${name} answers ${JSON.stringify(fn(input))} where core answers ${JSON.stringify(normalizeBlocklistUrl(input))} for ${JSON.stringify(input.slice(0, 60))}`);
});

// A rule that accepts everything would make the comparison above vacuous.
const blocklistUrlRefusals = BLOCKLIST_URL_CORPUS.filter((input) => normalizeBlocklistUrl(input) === '').length;

/**
 * A reduced-motion guard has to come after the rules it overrides.
 *
 * `transition-duration: .001ms` inside a media query loses to a later
 * `transition:` shorthand at the same specificity, because the shorthand resets
 * the longhand. A guard written above the button rule reads as present and does
 * nothing, which is worse than a missing one: it looks handled.
 *
 * Each injected shadow stylesheet is taken as a whole and asked two things:
 * does it guard motion at all, and does its last guard come after its last
 * transition.
 */
const motionSheets = [...source.matchAll(/const (\w*_CSS) = `([\s\S]*?)`;/g)]
  .map((match) => [match[1], match[2]]);

const unguardedMotion = motionSheets.flatMap(([name, css]) => {
  const transitions = [...css.matchAll(/\btransition:/g)].map((match) => match.index);
  if (!transitions.length) return [];
  const guards = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)/g)].map((match) => match.index);
  if (!guards.length) return [`${name} animates and never mentions prefers-reduced-motion`];
  if (Math.max(...guards) < Math.max(...transitions)) {
    return [`${name} guards motion before its last transition, so the shorthand wins`];
  }
  return [];
});

const checks = [
  [`every stylesheet that animates guards motion, after the rules it overrides${unguardedMotion.length ? `: ${unguardedMotion.join('; ')}` : ''}`,
    unguardedMotion.length === 0 && motionSheets.length >= 4],
  [`every copy of the blocklist URL rule answers the same${blocklistUrlDisagreements.length ? `: ${blocklistUrlDisagreements[0]}` : ''}`,
    blocklistUrlDisagreements.length === 0 && blocklistUrlRefusals >= 9],
  ['the shared blocklist URL rule refuses credentials and drops the fragment',
    normalizeBlocklistUrl('https://user:pass@example.com/list.json') === ''
    && normalizeBlocklistUrl('https://example.com/list.json#frag') === 'https://example.com/list.json'],
  [`no accessibility setting is gated on viewport width${gatedAccessibility.length ? `: ${gatedAccessibility.join(', ')}` : ''}`,
    gatedAccessibility.length === 0
    // And the rules are present at all, so deleting them is not a way to pass.
    && ACCESSIBILITY_ATTRIBUTES.every((attribute) => source.includes(`html[${attribute}="true"]`))],
  ['every account write in every bundle is the follow gesture or the undo that reverses it',
    bundleTargets.every(([, bundleSource]) => onlyWritesAreTheFollowGesture(bundleSource))],
  ['every signed-in journey the live gate names is declared read-only, with a reason a session is needed',
    SIGNED_IN_JOURNEYS.length >= 8
    && SIGNED_IN_JOURNEYS.every((journey) => journey.mutates === false && journey.why.length > 25 && journey.expects.length > 0)
    && ONLY_ACCOUNT_WRITE.journeys.length === 0],
  ['the live gate reads the signed-in matrix rather than a list of its own',
    liveGate.includes('SIGNED_IN_JOURNEYS') && /for \(const journey of SIGNED_IN_JOURNEYS\)/.test(liveGate)],
  ['the live Viewer Hub gate reads the card registry rather than a stale count',
    liveGate.includes("import { VIEWER_HUB_CARDS } from '../src/core.mjs'")
    && liveGate.includes('hubCards.length === VIEWER_HUB_CARDS.length')
    && !liveGate.includes('found.length === 6')],
  [`every artifact is inside its size budget${overBudget.length ? `: ${overBudget.join('; ')}` : ''}`, overBudget.length === 0],
  ['every privileged Chromium message type checks its sender', everyMessageChecksSender(background)],
  ['every privileged Firefox message type checks its sender', everyMessageChecksSender(firefoxBackground)],
  ['every top-level host declares the interface language',
    bundleTargets.every(([, bundleSource]) => hostsDeclareLanguage(bundleSource))],
  ['the live gate waits for the shadow host rather than sampling it',
    /const shadow = await __kfWait\(/.test(liveGate) && unwaitedShadowReads(liveGate) === 0],
  ['the live gate installs its page-world waiter before any probe reads painted state',
    liveGate.indexOf('PAGE_WAIT_HELPER)') > 0
    && liveGate.indexOf('PAGE_WAIT_HELPER)') < liveGate.indexOf('await __kfWait(')],
  ['the live gate can skip as well as pass and fail, and counts skips apart',
    /outcome: 'skip'/.test(liveGate) && /r\.outcome === 'fail'/.test(liveGate)
    && /checks passed\$\{skipped\.length/.test(liveGate)],
  ['every live-gate skip reason names what was missing', skipReasonsAreActionable(liveGate)],
  // The detail goes in the label, not the value: this loop treats any truthy
  // value as a pass, so `gaps.length === 0 || gaps.join()` would report success
  // precisely when there were gaps.
  [`every module export is defined in every bundle${bundleGaps.length ? ` — ${bundleGaps.join(' | ')}` : ''}`, bundleGaps.length === 0],
  [`every src/*.mjs module is checked against the bundles (${moduleFiles.length})`, moduleFiles.length >= 4],
  [`no two bundled modules declare the same top-level name${nameClashes.length ? ` — ${nameClashes.slice(0, 4).join(' | ')}` : ''}`,
    nameClashes.length === 0],
  [`no import/export statement survives into a bundle${leakedModuleSyntax.length ? ` — ${leakedModuleSyntax.join(', ')}` : ''}`, leakedModuleSyntax.length === 0],
  // Userscript artifact
  ['metadata starts at byte zero', source.startsWith('// ==UserScript==')],
  ['version is synchronized', source.includes(`// @version      ${VERSION}`)],
  ['runs at document-start', source.includes('// @run-at       document-start')],
  ['targets Kick HTTPS', source.includes('// @match        https://kick.com/*')],
  ['contains no remote code dependency', !/@require\s|@resource\s/i.test(source)],
  ['ships settings UI', source.includes('data-kf-settings-shell')],
  ['chat-left is a first-class setting with mirrored separator geometry',
    source.includes("chat: enumValue(layout.chat, ['right', 'left', 'docked', 'hidden']")
    && source.includes("['left','Left']")
    && source.includes('html[data-kf-chat="left"] [data-kf-chat-panel]')
    && source.includes('chatWidthAfterDrag(state.settings.layout.chat')],
  ['composer recall is opt-in, session-only, and leaves plain ArrowUp to Kick', (() => {
    const start = source.indexOf('function rememberComposerMessage');
    const end = source.indexOf('function insertStickerName', start);
    const region = start >= 0 && end > start ? source.slice(start, end) : '';
    return source.includes('chatComposerRecall: false')
      && source.includes("document.addEventListener('keydown', guard('composer recall', onComposerKeydown), true)")
      && region.includes('validChatComposer')
      && region.includes('closest?.(CHAT_ROOM_SELECTOR)')
      && region.includes('isComposerRecallGesture(event)')
      && !/gm(?:Set|Delete)|localStorage|sessionStorage/.test(region);
  })()],
  ['followed-channel previews reuse existing images, clamp on-screen, and freeze under reduced motion', (() => {
    const start = source.indexOf('function followingPreviewOwner');
    const end = source.indexOf('function applySearchEnhancements', start);
    const region = start >= 0 && end > start ? source.slice(start, end) : '';
    return region.includes("querySelectorAll?.('img')")
      && region.includes("findAllProbe(sidebar, 'followingPreviewControl')")
      && region.includes('function followingPreviewOwner')
      && region.includes("findAllProbe(sidebar, 'followingPreviewControl').elements")
      && region.includes("row.dataset.kfFollowingPreview = 'true'")
      && source.includes('if (followingPreviewMutation(mutations))')
      && source.includes("root.dataset.kfFollowingPreviewReady = 'true'")
      && region.includes('floatingPreviewPosition(')
      && region.includes("matchMedia('(prefers-reduced-motion: reduce)').matches")
      && region.includes('snapshotFollowingThumbnail(source, canvas)')
      && region.includes("event.key !== 'Escape'")
      && source.includes("document.addEventListener('focusin', guard('following preview', onFollowingPreviewEnter), true)")
      && source.includes('#kick-focus-following-preview')
      && !/\bfetch\s*\(|GM_xmlhttpRequest|XMLHttpRequest/.test(region);
  })()],
  ['session watch time is tab-local, playback-gated, and never presented as a Kick level', (() => {
    const start = source.indexOf('const SESSION_WATCH_MEDIA_EVENTS');
    const end = source.indexOf('function readNumber', start);
    const region = start >= 0 && end > start ? source.slice(start, end) : '';
    return source.includes("Object.freeze({ id: 'watch', source: 'local' })")
      && source.includes("watch: { elapsedMs: 0, activeSince: 0 }")
      && source.includes("'Session watch time'")
      && source.includes("'This browser session only'")
      && region.includes("state.route === 'channel'")
      && source.includes("documentVisible: document.visibilityState !== 'hidden'")
      && source.includes('visible: videoIsVisible(video)')
      && source.includes('function sessionWatchOwnerCandidate()')
      && region.includes('sessionWatchCandidateState({')
      && region.includes('state.viewerHub.watchPlayback')
      && !/gm(?:Set|Delete)|localStorage|sessionStorage|\bfetch\s*\(/.test(region);
  })()],
  ['settings page composition lives behind an explicit factory instead of runtime wrappers',
    settingsModuleSource.includes('export function createSettings(host)')
    && ['renderLayoutPage', 'renderAppearancePage', 'renderContentPage', 'renderAccessibilityPage', 'renderViewerPage', 'renderAboutPage']
      .every((name) => settingsModuleSource.includes(`function ${name}(`))
    && !/^function render[A-Za-z]+Page\b/m.test(runtimeModuleSource)
    && !/^const NAV_ITEMS\b/m.test(runtimeModuleSource)
    && runtimeModuleSource.includes('const settingsSurface = createSettings({')],
  // Constructed sheets are parsed once and adopted by reference; a <style>
  // written into a shadow root's innerHTML is re-tokenised and re-parsed on
  // every rebuild. The template must not carry the sheet, and every root must
  // adopt through the one feature-detected path.
  // The roll-call must stay a request/response over a same-origin channel with
  // nothing but a slug on the wire, and must need no new permission.
  ['the cross-tab roll-call is same-origin, slug-only, and permission-free',
    bundleTargets.every(([, bundleSource]) => bundleSource.includes("new BroadcastChannel('kick-focus:presence')")
      && bundleSource.includes('function mergePresence')
      && bundleSource.includes("message.type === 'who'")
      && bundleSource.includes("channel.postMessage({ type: 'here', slug, ts: Date.now() })"))],
  ['the companion still requests no tabs permission for the roll-call',
    !JSON.stringify(manifest).includes('"tabs"') && !JSON.stringify(firefoxManifest).includes('"tabs"')],
  // The library, favorites, removals and group assignments are all keyed by the
  // same string. Migrating them anywhere but the one shared cleaner would move
  // some and not others, and a favorite would stop matching its library entry.
  ['emote keys are platform-prefixed through the one shared cleaner',
    bundleTargets.every(([, bundleSource]) => bundleSource.includes('function platformStickerKey')
      && bundleSource.includes('const value = platformStickerKey(raw.trim())')
      // Generated prefixed at the source too, or a fresh observation would miss
      // every stored entry and record a duplicate beside it.
      && !/key: `id:\$\{emote\.id\}`/.test(bundleSource))],
  // The apply cycle yields between its visible half and its bookkeeping half,
  // and must refuse to interleave with itself across that yield.
  ['the apply cycle yields to input and cannot re-enter across the yield',
    bundleTargets.every(([, bundleSource]) => bundleSource.includes('function yieldToInput')
      && bundleSource.includes("typeof scheduler.yield === 'function'")
      && bundleSource.includes('state.runtime.applyRunning = true')
      && bundleSource.includes('state.runtime.applyQueued = true')
      && bundleSource.includes('if (rerun && !state.runtime.suspended) scheduleApply(0)')
      // Re-checked after the await, because the panic switch can land mid-yield.
      && /await resume;[\s\S]{0,240}state\.runtime\.suspended\) return;/.test(bundleSource))],
  // Off-screen emote tiles skip layout and paint; the intrinsic size keeps the
  // scroll height honest so the bar does not jump as cards render.
  ['off-screen emote tiles are skipped with a stated intrinsic size',
    bundleTargets.every(([, bundleSource]) => (bundleSource.match(/content-visibility: auto/g) || []).length >= 2
      && (bundleSource.match(/contain-intrinsic-size:/g) || []).length >= 2)],
  // Keyword highlighting must paint from the registry, never by wrapping words
  // in nodes: a <mark> inside Kick's chat is something React reconciles against
  // and something this build then has to undo.
  ['keyword highlights are painted from the registry, never written into the chat tree',
    bundleTargets.every(([, bundleSource]) => bundleSource.includes('new Highlight(...ranges)')
      && bundleSource.includes('::highlight(kick-focus-keyword)')
      && bundleSource.includes('function findKeywordSpans')
      && !/createElement\('mark'\)/.test(bundleSource))],
  // Route changes come from the browser where it can report them; the history
  // wrapper is only ever the fallback, so it must live inside that branch.
  ['route changes are read from the Navigation API with the history wrapper as fallback only',
    bundleTargets.every(([, bundleSource]) => bundleSource.includes("navigation.addEventListener('currententrychange'")
      && /if \(navigation && typeof navigation\.addEventListener === 'function'\) \{[\s\S]{0,300}\} else \{[\s\S]{0,200}pushState/.test(bundleSource))],
  ['stylesheets are constructed once and adopted, not re-parsed from innerHTML',
    bundleTargets.every(([, bundleSource]) => bundleSource.includes('function adoptStyles')
      && bundleSource.includes('CSSStyleSheet.prototype.replaceSync')
      && !bundleSource.includes('<style>${UI_CSS}</style>')
      && (bundleSource.match(/adoptStyles\(shadow, /g) || []).length >= 3
      && bundleSource.includes('function ensureSiteStyle'))],
  // If kick.com ever sends `require-trusted-types-for 'script'`, a bare
  // innerHTML write throws and this build's interface stops rendering. Every
  // write must go through the policy, and the policy must never be 'default',
  // which would vouch for every other script on the page.
  [`exactly one innerHTML write survives, inside setMarkup${bundleTargets.map(([name, bundleSource]) => `${name}=${directHTMLWrites(bundleSource)}`).filter((entry) => !entry.endsWith('=1')).join(', ')}`,
    bundleTargets.every(([, bundleSource]) => directHTMLWrites(bundleSource) === 1)],
  [`every innerHTML write is policy-routed${unroutedHTML.length ? ` — ${unroutedHTML.length} bare in ${unroutedHTML[0]}` : ''}`,
    unroutedHTML.length === 0 && bundleTargets.every(([, bundleSource]) => bundleSource.includes("createPolicy('kick-focus'")
      && !/createPolicy\(\s*['"]default['"]/.test(bundleSource))],
  // Typing an emote name must stay a name. The wire form `[emote:id:name]` is
  // entitlement, and no path here may compose one, fall back to writing raw
  // text into Kick's editor, or send anything.
  ['emote name insertion stays a plain name, never sends, and has no raw-text fallback',
    bundleTargets.every(([, bundleSource]) => bundleSource.includes('function insertionPlanFor')
      && bundleSource.includes("execCommand('insertText', false, plan.text)")
      && bundleSource.includes('const PLAIN_EMOTE_NAME')
      && !/\[emote:\$\{/.test(bundleSource)
      && !/insertStickerName[\s\S]{0,1200}?(key:\s*'Enter'|click\(\)|form\.submit)/.test(bundleSource))],
  // The hover card must stay keyed to the save affordance and stay out of the
  // pointer's way: a card that can be hovered fights the emote for the hover,
  // and one keyed on "any image in chat" annotates unrelated injected content.
  ['the chat emote hover card is delegated, key-scoped, and never a pointer target',
    bundleTargets.every(([, bundleSource]) => bundleSource.includes('function emoteTooltipText')
      && bundleSource.includes("closest?.('[data-kf-chat-emote-save]')")
      && bundleSource.includes('pointer-events: none')
      && /host\.style\.left = /.test(bundleSource))],
  // An import writes ten stores. Committing them one at a time is how a quota
  // ceiling produces a configuration that is half the file and half the old
  // one, so the import must go through the staged path, not bare per-key sets.
  ['import commits every store as one sized transaction',
    bundleTargets.every(([, bundleSource]) => bundleSource.includes('function gmSetMany')
      && bundleSource.includes('planStorageCommit(entries)')
      && /const commit = applyImportedStores\(result\)/.test(bundleSource))],
  ['the userscript batches multi-store writes through GM_setValues',
    source.includes("typeof GM_setValues === 'function'") && source.includes('// @grant        GM_setValues')],
  ['larger targets and reduce motion reach the mod own shadow controls in every bundle',
    bundleTargets.every(([, bundleSource]) => shadowAccessibilityWired(bundleSource))],
  ['the shadow host is actually stamped with those flags',
    bundleTargets.every(([, bundleSource]) => bundleSource.includes('uiHost.dataset.kfLargeTargets')
      && bundleSource.includes('uiHost.dataset.kfReduceMotion'))],
  ['ships Poor mode with exact spending-control tagging', source.includes('data-kf-poor-mode')
    && source.includes('data-kf-monetization')
    && source.includes("id === 'poor'")],
  ['ships the read-only cross-channel emote browser', source.includes('data-kf-emote-catalog-input')
    && source.includes('import-channel-emotes')
    && source.includes('channelCatalogEmotes')
    && source.includes('Open {name} artwork')
    && source.includes('rel="noopener"')],
  // Hiding is styling only. A `.remove()`, a `.click()`, or a `hidden = true`
  // reached from this feature would take a Kick control out of service instead
  // of out of sight, which is a different promise from the one the panel makes.
  ['hides Kick controls from the catalog, with styling and nothing else',
    source.includes('function hiddenElementCss')
    && source.includes('function tagHideableElements')
    && source.includes('data-kf-hidden~=')
    && source.includes("toggle-hidden-element")
    && !/tagHideableElements[\s\S]{0,600}?\.(remove|click)\(\)/.test(source)],
  // The whole point of learning the ladder is not guessing at it. A resolution
  // literal in the quality path is that guess coming back.
  ['starts at the highest quality only from labels Kick was seen to offer',
    source.includes('function recordQualityLadder')
    && source.includes('function bestKnownQuality')
    && source.includes('function desiredQuality')
    && source.includes("const QUALITY_LADDER_KEY = 'ladder:global'")
    && !/(?:QUALITY_LADDER_KEY|bestKnownQuality)[\s\S]{0,400}?['"]\d{3,4}p/.test(source)],
  // The player reads a bare height; the menu shows a label. Writing the label
  // into the session key is the defect this build shipped before 1.19.0.
  ['seeds the player session key through the measured height mapping, not the label',
    source.includes('function qualitySessionValue')
    && /sessionStorage\.setItem\(QUALITY_SESSION_KEY, value\)/.test(source)
    && /const value = qualitySessionValue\(desiredQuality\(\)\)/.test(source)],
  // An anonymous session sees 1080p60 badged "Login required"; its textContent
  // is "1080p60Login required" and the rung is not one this session may pick.
  ['never records or clicks a quality rung Kick badged as unavailable',
    source.includes('function qualityOptionGated')
    && source.includes('function qualityControlLabel')
    && /controls\.filter\(\(control\) => !qualityOptionGated\(control\)\)/.test(source)
    && /if \(qualityOptionGated\(control\)\) continue;/.test(source)
    // The badge copy is translated; the structure is not. Matching the words
    // would work in English only.
    && !/Login required/.test(source)],
  ['keeps page state separate from navigation actions', source.includes('dataset.kfCurrentPage')
    && !source.includes('page.dataset.page =')],
  ['mounts the Focus control beside Get KICKs', source.includes('ensureHeaderQuickControl')
    && source.includes('data-testid="kicks-top-nav"')
    && source.includes('data-kf-header-control')],
  ['preserves sticker shelf scroll across organizer rerenders', source.includes('restoreStickerGridScroll')
    && source.includes('rememberStickerGridScroll')],
  ['collapses Kick native sticker chrome outside the Native view', source.includes('data-kf-sticker-native-list')
    && source.includes('data-kf-sticker-native-shell')
    && source.includes("nativeList.dataset.kfStickerNativeList = 'true'")
    && source.includes("shell.dataset.kfStickerNativeShell = 'true'")],
  ['separates available emotes from Kick-locked ones', source.includes("trf('{count} available'")
    && source.includes("trf(', {count} locked by Kick'")
    && source.includes('max-height: min(640px, calc(100vh - 132px))')
    && source.includes('stickerButtonUnavailable')],
  ['persists and exports the complete sticker library', source.includes('mergeStickerLibrary')
    && source.includes('observeStickerPicker')
    && source.includes('observeChatStickerDiscovery')
    && source.includes("nativeGroups: ['Seen in chat']")
    && source.includes('renderStickerLibraryManager')
    && source.includes('stickers: stickerPreferencesValue()')],
  ['captures the mod own failures to a local, sanitized error log', source.includes('function logAppError')
    && source.includes('function guard(')
    && source.includes("logAppError('apply cycle'")
    && source.includes('data-kf-error-log')
    && source.includes('LAST_CRASH_KEY')],
  ['settings a11y: focus and scroll survive re-render, toasts announce, sliders are labelled', source.includes('function focusRestoreKey')
    && source.includes('restore.focus({ preventScroll: true })')
    && source.includes('role="status" aria-live="polite"')
    && source.includes("setAttribute('role', isError ? 'alert' : 'status')")
    && source.includes('aria-valuetext=')
    && source.includes('.kf-switch[aria-checked="true"] { background: Highlight; }')],
  ['pluralization is locale-correct via Intl.PluralRules, not a hand n===1 rule', source.includes('function pluralForm')
    && source.includes('new Intl.PluralRules')
    && source.includes('function plural(')],
  ['one-click add-to-multi is race-safe and lives in the header', source.includes('function mergeMultistream')
    && source.includes('function commitMultistream')
    && source.includes('function toggleCurrentChannelInMulti')
    && source.includes('data-kf-header-add-multi')
    && source.includes('function syncHeaderMultiState')],
  ['harvests emotes from realtime chat frames, image-validated before they take a slot', source.includes('function observationsFromChatEmotes')
    && source.includes('function queueChatEmoteHarvest')
    && source.includes('settings.liveChatEvents && settings.organizeChatStickers')
    && source.includes('new Image()')
    && source.includes('chatEmoteHarvest.negative')],
  ['caps the emote library without dropping new or acted-on records', source.includes('function evictStickerLibrary')
    && source.includes('function queueStickerPersist')
    && source.includes('if (state.stickerPreferences.hidden.has(sticker.key)) continue')
    && source.includes('state.stickerPreferences.library.delete(key)')],
  ['export payload covers every registered backup store', STORAGE_STORES.filter((store) => store.backup)
    .every((store) => (store.field === 'settings' ? ('probe' in exportProbe) : (store.field in exportProbe)))],
  [`import restores every backup store${importGaps.length ? ` — missing ${importGaps.join(', ')}` : ''}`,
    source.includes('function applyImportedStores') && importGaps.length === 0],
  ['import drops prototype-pollution keys and is non-destructive', source.includes('POLLUTION_KEYS')
    && source.includes('PRE_IMPORT_BACKUP_KEY')
    && source.includes('function undoImport')],
  ['reset keeps the emote library and clears every private store', source.includes('resetStickerPreferences({ keepLibrary: true })')
    && source.includes('function clearPrivateData')
    && source.includes('gmDelete(CHANNEL_NOTES_KEY)')
    && source.includes('gmDelete(EMOTE_USAGE_KEY)')],
  // R-97: privileged transport hardening. The page may trigger a refresh, but
  // it never supplies the background request target.
  ['blocklist fetch target is owned by extension approval, not the page event', bridge.includes("sendMessage({ type: 'kick-focus:fetch-blocklist' }")
    && firefoxBridge.includes("sendMessage({ type: 'kick-focus:fetch-blocklist' }")
    && !bridge.includes("type: 'kick-focus:fetch-blocklist', url")
    && !firefoxBridge.includes("type: 'kick-focus:fetch-blocklist', url")
    && background.includes('candidateUrl === approvedUrl')
    && firefoxBackground.includes('candidateUrl === approvedUrl')],
  ['blocklist transport rejects redirects, non-JSON, oversized bodies, and eight-second stalls', [background, firefoxBackground].every((file) => file.includes("redirect: 'error'")
    && file.includes("mime !== 'application/json'")
    && file.includes('BLOCKLIST_MAX_BYTES = 512 * 1024')
    && file.includes('BLOCKLIST_TIMEOUT_MS = 8000')
    && file.includes('response.arrayBuffer()'))],
  ['popup gesture requests one feed origin and stores one exact URL', popup.includes('permissions.request({ origins: [origin] })')
    && popup.includes("type: 'kick-focus:approve-blocklist'")
    && background.includes('[BLOCKLIST_APPROVAL_KEY]: { url, origin, approvedAt: Date.now() }')
    && firefoxBackground.includes('[BLOCKLIST_APPROVAL_KEY]: { url, origin, approvedAt: Date.now() }')],
  ['bridge sanitizes announced settings before storing them', bridge.includes('function sanitizeSettings')
    && firefoxBridge.includes('function sanitizeSettings')],
  ['companion presence is a live nonce round-trip, not a page-set attribute', source.includes('function handshakeCompanion')
    && source.includes("'kick-focus:companion-pong'")
    && bridge.includes("'kick-focus:companion-ping'")
    && firefoxBridge.includes("'kick-focus:companion-ping'")],
  ['userscript blocklist transport omits ambient cookies', source.includes('anonymous: true')],
  ['blocklist URL is https-validated at normalize time', source.includes('function normalizeBlocklistUrl')
    && source.includes('normalizeBlocklistUrl(content.blocklistUrl)')],
  ['offers direct favorites, recent, all, group, and Kick views', source.includes("tab('pinned', tr('Favorites')")
    && source.includes("tab('recent', tr('Recent')")
    && source.includes("tab('all', tr('All')")
    && source.includes('data-kf-sticker-view="group"')
    && source.includes("tab('native', tr('Kick'))")],
  ['styles the current semantic Kick shell', source.includes(':is(main, #main-container)')
    && source.includes('[data-testid="livestream-results-card"]')
    && source.includes('#channel-chatroom')],
  ['ships route-specific search and Drops recovery', source.includes('applySearchEnhancements')
    && source.includes('applyDropsEnhancements')
    && source.includes('data-kf-drops-empty')],
  ['lets explicit home preview playback override autoplay suppression', source.includes("video.dataset.kfManualPlayback = 'true'")
    && source.includes("if (video.dataset.kfManualPlayback !== 'true') video.pause()")],
  ['embeds the local product icon', source.includes('data:image/png;base64,') && !source.includes('__KICK_FOCUS_ICON__')],
  ['embeds the local appearance preview', source.includes('data:image/jpeg;base64,') && !source.includes('__KICK_FOCUS_PREVIEW__')],
  ['ships SPA lifecycle hook', source.includes('kick-focus:routechange')],
  ['ships ad request classification', source.includes('classifyRequest')],
  ['guards against double boot', source.includes('__kickFocusBooted')],

  // Version parity across every artifact that states one
  ['package.json version matches', packageJson.version === VERSION],
  ['manifest version matches', manifest.version === VERSION],

  // Extension shape
  ['manifest is v3', manifest.manifest_version === 3],
  ['page world script runs at document_start', mainWorld?.run_at === 'document_start'],
  ['page world script is the built bundle', content.includes('data-kf-settings-shell')],
  ['bridge runs in the isolated world', isolated?.run_at === 'document_start'],
  ['bridge advertises the companion', bridge.includes('kickFocusCompanion')],
  ['userscript reports the companion layer', source.includes("'kick-focus:companion-ping'")],
  ['extension requests no broad host access', manifest.host_permissions.every((entry) => entry.includes('kick.com'))],
  ['extension declares broad HTTPS access as optional only', manifest.optional_host_permissions?.length === 1
    && manifest.optional_host_permissions[0] === 'https://*/*'
    && !manifest.host_permissions.includes('https://*/*')],
  ['extension loads only local scripts', manifest.content_scripts
    .flatMap((entry) => entry.js)
    .every((file) => !/^(https?:)?\/\//.test(file))],
  ['extension declares no remote code', !('externally_connectable' in manifest)
    && !JSON.stringify(manifest.background).includes('//')],

  // Network rules stay in lockstep with the page-realm blocklist. Each gate
  // also asserts the list is non-empty, so an emptied host list fails loudly
  // instead of passing an every()/length gate vacuously.
  ['ad ruleset covers every blocked host', AD_HOSTS.length > 0 && adRules.length === AD_HOSTS.length],
  ['telemetry ruleset covers every cancellable telemetry host', cancellableTelemetryHosts().length > 0 && telemetryRules.length === cancellableTelemetryHosts().length],
  ['litix.io is never hard-cancelled at the network layer (retry-storm host)', TELEMETRY_NO_CANCEL_HOSTS.every((host) =>
    !telemetryRules.some((rule) => rule.condition.urlFilter?.includes(host))
    && !adRules.some((rule) => rule.condition.urlFilter?.includes(host))
    && !firefoxBackground.includes(host))],
  ['ad rules block', adRules.length > 0 && adRules.every((rule) => rule.action.type === 'block')],
  ['every rule is scoped to kick.com', [...adRules, ...telemetryRules].length > 0 && [...adRules, ...telemetryRules]
    .every((rule) => rule.condition.initiatorDomains?.includes('kick.com'))],
  ['content scripts match only kick.com, never a broad pattern', contentScriptsScoped(manifest.content_scripts)],
  ['rule ids are unique', new Set([...adRules, ...telemetryRules].map((rule) => rule.id)).size
    === adRules.length + telemetryRules.length],
  ['ads ruleset ships enabled', ruleFiles.find((entry) => entry.id === 'ads')?.enabled === true],
  ['telemetry ruleset ships opt-in', ruleFiles.find((entry) => entry.id === 'telemetry')?.enabled === false],

  // Favorites are ordered and scoped. The shelf must render them in the stored
  // order rather than the picker's, or the ordering controls do nothing
  // visible; and the order has to be part of the render signature.
  ['the reward auto-claim drives Kick’s dialog, never a claim endpoint', rewardClaimIsSafe(source)],
  ['the reward auto-claim is off until it is turned on', rewardClaimIsOptIn(source)],
  // The scheduling is the difference between a well-behaved feature and one
  // that opens Kick's dialog a hundred times a day, so it is asserted rather
  // than left to whoever edits this next.
  ['the reward re-check is scheduled from Kick’s countdown and the nightly rollover',
    /nextRewardCheckAt\(\{ outcome: 'claimed'/.test(source)
    && /nextRewardCheckAt\(\{ outcome: 'not-ready'[\s\S]{0,120}?minutesRemaining/.test(source)
    && /function nextClaimResetAt/.test(source)
    && /CLAIM_RESET_HOUR = 20/.test(source)],
  ['the library is stored behind a provider with a synchronous fallback',
    source.includes('createLibraryStore({') && source.includes('readFallback:') && source.includes('writeFallback:')
    && /function readStickerPreferences[\s\S]{0,200}?libraryStore\.readSync\(\)/.test(source)
    && /function persistStickerPreferences[\s\S]{0,300}?libraryStore\.write\(/.test(source)],
  ['blobs are a separate object store from the library record',
    source.includes("LIBRARY_STORE = 'library'") && source.includes("BLOB_STORE = 'blobs'")
    && !/objectStore\(LIBRARY_STORE\)\.put\(blob/.test(source)],
  ['hydration is off the boot path and localStorage remains the floor',
    /hydrateLibrary\(\)\.catch\(/.test(source) && source.includes('localstorage: -1000')],
  // The word appears in a source comment explaining why it is not used, so this
  // looks for an actual dependency: a manifest entry, or a bare-specifier import
  // (every import in this tree is relative, and the build strips those).
  ['no storage dependency was added',
    !packageJson.dependencies && !packageJson.devDependencies
    && !/(?:^|\n)\s*import\s[^\n]*from\s+['"][^.'"][^'"]*['"]/.test(await read('src/storage.mjs'))],
  ['every library write goes through the provider, including an import',
    /entries\.push\(\[STICKER_PREFERENCES_KEY, planLibraryPersist\(/.test(source)
    && /libraryStore\.write\(result\.stickers\)/.test(source)
    && /libraryStore\.clear\(\)/.test(source)],
  ['emote completion is accepted by click only and never sends', completionIsMouseOnly(source)],
  [`no source file carries a stray control byte${controlByteFiles.length ? `: ${controlByteFiles.join('; ')}` : ''}`, controlByteFiles.length === 0],
  ['the merged chat offers no way to send, and its sockets only subscribe', mergedChatIsReadOnly(source)],
  ['a channel removed from the grid stops consuming a merged connection', mergedChatFollowsTheGrid(source)],
  ['merged chat recovery is bounded, sleep-aware, and summarized once', source.includes('MERGED_CHAT_QUEUE_LIMIT = 2')
    && source.includes('MERGED_CHAT_SILENCE_MS = 45_000')
    && source.includes('slot.controller = controller')
    && source.includes('slot.finishAttempt = finishAttempt')
    && source.includes("kickFetchJson(endpoints.channel(slug), { signal: controller.signal })")
    && source.includes("addEventListener?.('online'")
    && source.includes("addEventListener?.('pageshow'")
    && source.includes("addEventListener?.('visibilitychange'")
    && source.includes('data-kf-multistream-merged-status')],
  ['the chat pop-out builds its own frame instead of moving the grid one', popOutBuildsItsOwnFrame(source)],
  ['the chat pane is hidden while popped out, and the window is closed on return', popOutReturnsWithoutReload(source)],
  ['every declared derived expectation has a deriver behind it', derivedExpectationsAreWired(source)],
  ['the compatibility verdict is published wherever the snapshot is taken', compatibilityVerdictIsPublished(source)],
  ['anchored surfaces resolve their anchor in the document tree, and declare their flips', anchoredSurfacesResolve(source)],
  ['every anchor-positioning property is feature-detected under its current name', anchorPropertiesAreDetected(source)],
  ['anchored surfaces are manual popovers and keep a hand-positioned fallback', anchoredSurfacesAreManual(source)],
  ['emote completion is off until it is turned on', source.includes('emoteAutocomplete: false')],
  ['discovery cards carry a multi chip, only where the card is a channel',
    source.includes('data-kf-card-action="multi"') && source.includes('cardSlugFromPath(path)')
    && source.includes('function syncCardMultiState')],
  ['discovery card uptime observes Kick’s existing feed without making another request',
    /const request = nativeFetch\(input, init\);[\s\S]{0,500}?isDiscoveryLivestreamUrl\(rawUrl[\s\S]{0,500}?response\.clone\(\)\.json\(\)[\s\S]{0,500}?return request;/.test(source)
    && source.includes('normalizeDiscoveryLiveStarts(payload)')
    && source.includes('data-kf-card-uptime')
    && source.includes(".trim().toLowerCase() === 'live'")],
  ['cross-tab convergence re-reads the store rather than trusting the wire', convergenceRereads(source)],
  ['a tab applying another tab’s change never writes back or re-broadcasts', remoteApplyNeverWrites(source)],
  ['a shared link says what it replaced and offers it back',
    // The sentence moved from "Shared layout replaced" to "The shared board
    // replaced" when the user-facing name settled on board, and again when it
    // became a translation template. What the gate is for is unchanged: the
    // toast has to name what it took away and the undo has to be offered.
    /The shared board replaced \{count\} \{word\} you had collected\./.test(source)
      && /Your own multi-stream grid is back\./.test(source)],
  ['the organizer grid renders a bounded window with spacers, not the whole library', organizerWindows(source)],
  ['spacer arithmetic agrees with the grid CSS it stands in for', spacerMathMatchesCss(source)],
  ['organizer search is debounced rather than firing on every keystroke', organizerDebouncesSearch(source)],
  ['a favorite or removal patches its tile instead of rebuilding the window', organizerPatchesInPlace(source)],
  ['the picker offers a Recent view over recorded usage',
    source.includes('recentEmoteUsage(state.emoteUsage')
    && source.includes("view === 'recent'")
    && source.includes("tab('recent', tr('Recent')")],
  ['favorites are scoped per channel and explicitly ordered',
    source.includes('favoritesForChannel')
    && source.includes('toggleStickerFavorite')
    && source.includes('moveStickerFavorite')
    && source.includes('byFavoriteOrder')
    && organizerSignatureCovers(source)
    && source.includes('data-kf-sticker-batch-reorder="up"')],

  // A locked tile must explain itself and link to Kick's own unlock path —
  // and must never enable anything. The link is the only action offered.
  ['a locked emote says why and links to Kick own unlock path',
    source.includes('emoteLockState')
    && source.includes('kf-sticker-lock')
    && source.includes('Unlock on Kick')
    && source.includes('/collectibles')],

  // Replacing an iframe restarts its stream, so tile reuse is decided by a
  // core function that is tested without a browser rather than inline here.
  // A deletion must annotate its node once: the guard is what stops chat
  // virtualisation from stacking a second note on every apply cycle.
  ['multi-stream invariants are decided where they can be tested offline',
    source.includes('planMultistreamTiles')
    && source.includes('multistreamTileMuted')
    && source.includes("node.dataset.kfDeletionNoted === 'true'")],

  // A reverse scan of 252 entries per string, on every text node, on every
  // render — and ambiguous, because some English sources are also translated
  // values. Lookup is one forward hit against a remembered original.
  ['translation is a forward lookup with no reverse scan',
    source.includes('const TEXT_SOURCE = new WeakMap()')
    && source.includes('const ATTRIBUTE_SOURCE = new WeakMap()')
    && !source.includes('function canonicalTranslation')],

  // A shared link is untrusted input, so it must go back through the same slug
  // validation the grid uses rather than being spread into state directly.
  ['layouts are shareable as links and revalidated on the way in',
    source.includes('multistreamLayoutLink')
    && source.includes('parseMultistreamLink')
    && source.includes('multistream-copy-layout')
    && source.includes('openSharedLayoutFromUrl')],
  // One bulk call, not one per channel: a shelf of saved layouts must not turn
  // into dozens of requests for the same answer.
  ['saved layouts read live status from one bulk request',
    source.includes('endpoints.currentViewers')
    && source.includes('normalizeCurrentViewers')
    && source.includes('kf-ms-live')],

  // Kick publishes no drop odds and documents no duplicate protection. The
  // duplicate figure must therefore be measured or declared unavailable — the
  // one thing it must never be is inferred.
  ['states the collectible facts Kick leaves unexplained without inventing any',
    source.includes('COLLECTIBLE_FACTS')
    && source.includes('summarizeCollectibleInventory')
    && source.includes('kf-fact-list')
    && source.includes('quantityKnown')
    && source.includes('cannot be measured')],

  // Kick edits emotes users already pulled, so the local record is the only
  // copy that can prove it. Timestamps and the prior value must both survive.
  ['snapshots the emote library with first-seen, last-seen, and what Kick changed',
    source.includes('recordStickerObservation')
    && source.includes('describeStickerChange')
    && source.includes('countChangedStickers')
    && source.includes('kf-sticker-changed')
    && source.includes('wasName')],

  // The degradation path is the point: an unreachable badge image must read as
  // the badge's name, never as an empty box.
  ['renders the chat badges Kick omits and degrades a broken image to text',
    source.includes('chatBadgesToRender')
    && source.includes('kf-chat-badge')
    && source.includes('chatBadgeText')
    && source.includes("image.addEventListener('error'")],

  ['ships a named-channel blocklist for discovery surfaces', source.includes('localChannelBlocked')
    && source.includes('data-kf-hidden-channel-input')
    && source.includes('add-hidden-channel')
    && source.includes('remove-hidden-channel')],

  ['API drift is recorded and reported on the About page', source.includes('recordApiDrift')
    && source.includes('assessApiDrift')
    && source.includes('data-kf-api-drift')],

  ['blocklist fetch prefers a CORS-free transport', source.includes('fetchBlocklistText')
    && source.includes('GM_xmlhttpRequest')
    && source.includes('kick-focus:fetch-blocklist')
    && source.includes('kick-focus:blocklist-result')],

  ['reports storage writes that fail instead of losing data', source.includes('noteStorageResult')
    && source.includes('describeStorageFailures')
    && source.includes('data-kf-storage-alert')
    && source.includes('renderStorageHealthPanel')],

  ['restores quality where the player actually reads it', source.includes("const QUALITY_SESSION_KEY = 'stream_quality'")
    && source.includes('applyQualitySessionKey')
    && source.includes('[role="menuitemradio"]')],
  ['volume memory ignores the autoplay-policy mute', source.includes('VOLUME_GRACE_MS')
    && source.includes('elapsed < VOLUME_GRACE_MS && video.muted')],

  ['releases the player from blocked ad preflight scripts', source.includes('installPlayerLoadingFix')
    && source.includes('isAdPreflightScript')
    && source.includes('/pal/sdkloader/pal.js')
    // Capture phase is mandatory: resource errors do not bubble.
    && source.includes("pageWindow.addEventListener('error'")],

  ['ships a multi-stream grid built on Kick own embeds', source.includes('data-kf-multistream-grid')
    && source.includes('playerEmbedUrl')
    && source.includes('chatEmbedUrl')
    && source.includes('normalizeMultistream')
    // Audio follows focus: a nine-tile grid must never be nine audio streams.
    && source.includes('applyMultistreamAudio')],
  // Every framed URL must be a Kick origin. The trailing slash matters, or a
  // lookalike host such as player.kick.com.evil.net would satisfy the lookahead.
  // WCAG 2.2.2 and 1.4.2: autoplaying tiles need a visible, keyboard-reachable
  // way to stop them, and prefers-reduced-motion is not a substitute for one.
  ['multi-stream can be paused and muted as a whole', source.includes('data-kf-multistream-pause')
    && source.includes('data-kf-multistream-mute')
    && source.includes('multistreamTileMuted')
    && source.includes("matchMedia('(prefers-reduced-motion: reduce)').matches")],
  // A cross-origin embed cannot be paused or quality-capped, so unloading its
  // document is the only control over decode cost that exists.
  ['states the limitations users would otherwise hit blind', source.includes('kf-ms-chat-notice')
    && source.includes('Kick blocks sending from an embedded chat')
    && source.includes('no kick.com host at all')],
  ['focus is contained in whichever overlay is on top', source.includes('function topmostOverlayShell')
    && source.includes('kf-ms-shell')
    && source.includes('kf-command-shell')
    && !source.includes('if (!state.modal.hidden && trapFocus(event)) return;')],
  ['multi-stream suspends tiles nobody is watching', source.includes('multistreamTileActive')
    && source.includes('installMultistreamSuspension')
    && source.includes('observeMultistreamVisibility')
    && source.includes("document.addEventListener('visibilitychange'")],
  ['player embeds request no permission they do not use', source.includes("frame.allow = 'autoplay; fullscreen; picture-in-picture'")
    && !source.includes('picture-in-picture; encrypted-media')],
  ['multi-stream embeds only Kick origins', source.includes('https://player.kick.com/')
    && !/https:\/\/(?!(?:player\.|web\.|files\.|ext\.cdn\.)?kick\.com\/)[a-z0-9.-]+\/(?:popout|embed)\//i.test(source)],

  ['offers a hover-expanding dropdown sidebar mode', source.includes('data-kf-sidebar="dropdown"')
    && source.includes('[aria-controls="sidebar-wrapper"]')
    && source.includes('min-width: 1280px')
    // A panel that slides out under the pointer must honour reduced motion.
    && source.includes('prefers-reduced-motion: reduce')],
  ['multi-stream is reachable without opening settings', source.includes('data-kf-header-multi')
    && source.includes('kf-header-multi')],

  ['export carries every store the About page lists', source.includes('usage: state.emoteUsage')
    && source.includes('multistream: state.multistream')
    && source.includes('normalizeEmoteUsage')],

  // Kick's own data, read read-only and same-origin
  ['reads the realtime provider from Kick instead of hardcoding it',
    source.includes('normalizeRealtimeConnection')
    && source.includes('endpoints.realtimeChat')
    // The app key must never be written in this source; it is read at runtime.
    && !source.includes('32cbd69e4b950bf97679')],
  // The transport (URL + credentials) is the only per-provider part. If the
  // socket wiring ever inlines a subscribe frame or a JSON.parse of a frame
  // again, a second provider becomes a rewrite instead of a registry entry.
  ['realtime transport is swappable without touching the frame protocol',
    source.includes('REALTIME_TRANSPORTS')
    && source.includes('connection.transport.socketUrl(connection)')
    && source.includes('realtimeSubscribeFrame')
    && source.includes('parseRealtimeFrame')
    && !source.includes("event: 'pusher:subscribe', data: { auth: '', channel: name }")],
  // An unverified transport must never be described as working.
  ['an unverified realtime transport degrades and says so',
    source.includes('providerVerified')
    && source.includes('unverified-transport-failed')
    && source.includes('(unverified transport)')],
  ['sources the emote catalog from the API but keeps the DOM fallback',
    source.includes('refreshEmoteCatalog')
    && source.includes('normalizeEmoteSets')
    && source.includes("state.live.catalogSource = 'api'")
    && source.includes('observeStickerPicker')],
  // The realtime subscription is anonymous and public, so frames are untrusted
  // input by construction and the bounds belong at the boundary.
  ['realtime frames are bounded before use', source.includes('function boundedString')
    && source.includes('const LIMITS = Object.freeze(')
    && source.includes('/^#[0-9a-f]{3,8}$/i.test')],
  ['explains removed messages the DOM cannot', source.includes('normalizeDeletion')
    && source.includes('annotateDeletedMessage')
    && source.includes('kf-deletion-note')],
  ['counts real emote usage', source.includes('recordEmoteUse')
    && source.includes('kick-focus:emote-usage')],
  ['shows collectible rarity only when the join is confident', source.includes('joinCollectibleRarity')
    && source.includes('rarityBadge')
    && source.includes('state.live.rarity = join.usable ? join : null')],
  ['renders wide collectibles at their measured aspect', source.includes('measureEmoteAspect')
    && source.includes('data-kf-emote-aspect="wide"')],
  ['every API endpoint stays on kick.com', !EXFIL_REGEX.test(source)],
  ['gives High Contrast a real focus outline', source.includes('forced-colors: active')
    && source.includes('outline: 3px solid Highlight')],
  ['page-realm hooks do not announce themselves', source.includes('function disguise(')
    && source.includes('[native code]')],

  // The release manifest drops declarativeNetRequestFeedback to avoid the
  // "Read your browsing history" Chrome warning.  The counter in background.js
  // already degrades — it shows "—" in the popup when the debug API is absent.
  ['release manifest omits the feedback permission', !manifest.permissions.includes('declarativeNetRequestFeedback')],
  ['dev manifest provides the feedback permission', devManifest.permissions.includes('declarativeNetRequestFeedback')],
  ['release zip excludes the dev manifest', !extensionZip.toString('latin1').includes('manifest.dev.json')],
  ['popup uses the browser-or-chrome shim so the Firefox popup renders live', popup.includes('globalThis.browser || globalThis.chrome')
    && popup.includes('api.tabs.query')
    && popup.includes('api.runtime.sendMessage')
    && !popup.includes('chrome.tabs.query')],

  // Firefox companion shape
  ['Firefox manifest version matches', firefoxManifest.version === VERSION],
  ['Firefox manifest is v2', firefoxManifest.manifest_version === 2],
  ['Firefox manifest has a stable extension id', firefoxManifest.browser_specific_settings?.gecko?.id === 'kick-focus@sysadmindoc'],
  ['Firefox background is local and non-persistent', firefoxManifest.background?.scripts?.includes('background.js')
    && firefoxManifest.background?.persistent === false],
  ['Firefox requests the blocking permission', firefoxManifest.permissions?.includes('webRequestBlocking')],
  ['Firefox content bridge runs at document_start', firefoxManifest.content_scripts?.[0]?.run_at === 'document_start'],
  // The Firefox package used to inject its page bundle from a moz-extension://
  // URL, which put a per-install UUID into kick.com's DOM — a supercookie any
  // script on the page could read, on a build that sells privacy. The bundle is
  // now carried inside the bridge, so these three assert the leak stays closed.
  ['Firefox manifest exposes no web-accessible resource',
    !('web_accessible_resources' in firefoxManifest)],
  ['Firefox bridge carries the page bundle rather than fetching it',
    firefoxBridge.includes('data-kf-settings-shell') && firefoxBridge.includes('script.textContent = PAGE_BUNDLE')],
  ['Firefox bridge never puts an extension URL in the page',
    !/getURL\(\s*['"]content\//.test(firefoxBridge) && !/script\.src\s*=/.test(firefoxBridge)],
  ['Firefox package ships no separate page bundle to leak', !firefoxHasSeparateBundle],
  ['Firefox network layer uses blocking listeners', firefoxBackground.includes('onBeforeRequest')
    && firefoxBackground.includes("['blocking']")
    && firefoxBackground.includes('return { cancel: true }')],
  // Behaviour, not spelling: `test/companion.test.js` runs this background against a
  // stubbed browser API with Firefox-shaped details. A gate asserting the field name
  // is what previously kept the Chromium-only `details.initiator` bug alive.
  ['Firefox network layer reads the Gecko initiator fields', firefoxBackground.includes('details?.originUrl')
    && firefoxBackground.includes('details?.documentUrl')],
  ['Firefox host lists are generated', !firefoxBackground.includes('__AD_HOSTS__')
    && !firefoxBackground.includes('__TELEMETRY_HOSTS__')],
  ['Firefox requests no broad host access', !firefoxManifest.permissions.includes('<all_urls>')],
  ['Firefox declares broad HTTPS access as optional only', firefoxManifest.optional_permissions?.length === 1
    && firefoxManifest.optional_permissions[0] === 'https://*/*'
    && !firefoxManifest.permissions.includes('https://*/*')],
  ['Firefox does not request the tabs permission', !firefoxManifest.permissions.includes('tabs')],
  // The install prompt should name what the extension does, not a superset of
  // it. Kick is reached over https everywhere else in this package — the
  // content-script matches and the background's own origin set are both
  // https-only — so a `*://` here asked for an http half that never runs. The
  // ad and telemetry hosts keep their `*://` on purpose: a blocker has to
  // refuse those over either scheme.
  // Both halves, and neither may be empty. In MV2 a content-script match
  // grants host access as surely as a permission does, and [].every() is true,
  // so a version of this that only filtered permissions passed just as well
  // when both Kick entries were deleted outright.
  ['Firefox asks for Kick over https only', (() => {
    const kickPermissions = firefoxManifest.permissions
      .filter((perm) => perm.endsWith('://kick.com/*') || perm.endsWith('://www.kick.com/*'));
    const matches = firefoxManifest.content_scripts.flatMap((entry) => entry.matches);
    return kickPermissions.length === 2 && matches.length >= 2
      && [...kickPermissions, ...matches].every((pattern) => pattern.startsWith('https://'));
  })()],
  ['Firefox enumerates every ad and cancellable telemetry host', [...AD_HOSTS, ...cancellableTelemetryHosts()]
    .every((host) => firefoxManifest.permissions.some((perm) => perm.includes(host)))],
  ['Firefox does not request host access for the never-cancel telemetry host', TELEMETRY_NO_CANCEL_HOSTS
    .every((host) => !firefoxManifest.permissions.some((perm) => perm.includes(host)))],
  ['Firefox declares no data collection', firefoxManifest.browser_specific_settings?.gecko
    ?.data_collection_permissions?.required?.[0] === 'none'],
];

// Red probes: crafted-bad inputs each de-vacuumed gate must reject. If a gate
// ever becomes vacuous (passes on empty/hostile input), its probe returns true
// and this fails — the gate's proof that it can actually fire.
const redProbes = [
  ['the motion gate finds the stylesheets it is supposed to read', motionSheets.length >= 4],
  ['the width-gate probe would catch a focus outline moved back inside the desktop block',
    widthGatedAccessibility('a{b:c}@media (min-width: 1024px){ html[data-kf-focus-visible="true"] :is(button):focus-visible { outline: 1px } }')
      .join() === 'data-kf-focus-visible'],
  // The blind spot the first version of this gate had: SITE_CSS carries two
  // (min-width: 1024px) blocks and it only ever read the first one.
  ['the width-gate probe reads every desktop block, not only the first',
    widthGatedAccessibility('@media (min-width: 1024px){ .a { color: red } } @media (min-width: 1024px){ html[data-kf-large-targets="true"] { min-height: 40px } }')
      .join() === 'data-kf-large-targets'],
  // Brace matching, not a substring search: a rule *after* the block must read
  // as outside it, and a nested block must not end the region early.
  ['the width-gate probe reads a rule after the desktop block as outside it',
    widthGatedAccessibility('@media (min-width: 1024px){ .a { color: red } } html[data-kf-large-targets="true"] { min-height: 40px }').length === 0],
  ['the width-gate probe survives a nested block inside the desktop block',
    widthGatedAccessibility('@media (min-width: 1024px){ @supports (a:b) { .a { color: red } } } html[data-kf-contrast="true"] { color: red }').length === 0],
  ['the width-gate probe reports nothing when the stylesheet has no such block',
    widthGatedAccessibility('.a { color: red }').length === 0],
  ['size budget would reject an artifact one byte over',
    overBudgetIn([['a.js', 'x'.repeat(11), 10, 'test']]).length === 1],
  ['size budget accepts an artifact exactly at its budget',
    overBudgetIn([['a.js', 'x'.repeat(10), 10, 'test']]).length === 0],
  ['size budget accepts the real artifacts', overBudgetIn(SIZE_BUDGETS).length === 0],
  // Both halves of the sum, because either one alone is the blind spot the
  // gate exists to close: a file that fits until its storage is counted, and a
  // seed budget nobody would notice growing beside a small file.
  ['injection ceiling would catch a userscript that only fits without its storage',
    overInjectionBudget({ length: 900_000 }, 50_000)],
  ['injection ceiling would catch an oversized seed beside a tiny userscript',
    overInjectionBudget({ length: 2_000 }, 1_200_000)],
  // A multi-byte string is the case the old measurement got wrong: 400,000
  // three-byte characters are 1.2 MB on the wire and 400,000 code units in
  // memory, so counting characters called this comfortably inside the ceiling.
  ['injection ceiling would catch a bundle that only fits when counted as characters',
    overInjectionBudget('あ'.repeat(400_000), 0)],
  ['injection ceiling accepts a userscript and seed that fit together',
    !overInjectionBudget({ length: 875_000 }, 50_000)],
  ['injection ceiling accepts the userscript plus its library seed budget',
    !overInjectionBudget(source, LIBRARY_SEED_BYTES)],
  ['sender gate would catch a handler that acts before checking',
    !everyMessageChecksSender([
      "if (message?.type === 'a') {", '    if (!fromKickPage(sender)) { return; }',
      "if (message?.type === 'b') {", '    if (!fromKickPage(sender)) { return; }',
      "if (message?.type === 'c') {", '    if (!fromKickPage(sender)) { return; }',
      "if (message?.type === 'd') {", '    doTheThing();',
    ].join('\n'))],
  ['sender gate accepts the real Chromium background', everyMessageChecksSender(background)],
  ['markup gate would catch a surface that assigns innerHTML directly',
    directHTMLWrites('node.innerHTML = trustedHTML(m);\npanel.innerHTML = x;') === 2],
  ['markup gate accepts the real bundle', directHTMLWrites(source) === 1],
  ['host-language gate would catch a fifth host that declares no language',
    !hostsDeclareLanguage("a.id = 'kick-focus-root';\n  a.lang = x;\nb.id = 'kick-focus-emote-complete';\n  b.lang = x;\nc.id = 'kick-focus-emote-tooltip';\n  c.lang = x;\nd.id = 'kick-focus-header-control';\n  d.lang = x;\ne.id = 'kick-focus-new-panel';\n  e.append(y);")],
  ['host-language gate accepts the real bundle', hostsDeclareLanguage(source)],
  ['live-gate waiter gate would catch a probe that samples the shadow host once',
    unwaitedShadowReads("const shadow = document.getElementById('x')?.shadowRoot;\n    if (!shadow) return {};") === 1],
  ['live-gate waiter gate accepts the real gate', unwaitedShadowReads(liveGate) === 0],
  ['skip-reason gate would reject a bare noun',
    !skipReasonsAreActionable("return { skip: 'no video' };")],
  ['ad-ruleset gate would reject an empty ad list', !(0 > 0 && [].length === 0)],
  ['content-scripts gate would reject <all_urls>', !contentScriptsScoped([{ matches: ['<all_urls>'] }])],
  ['content-scripts gate would reject an off-kick host', !contentScriptsScoped([{ matches: ['*://*.evil.net/*'] }])],
  ['content-scripts gate would reject an empty matches list', !contentScriptsScoped([{ matches: [] }])],
  ['exfil gate would catch an off-origin api call', EXFIL_REGEX.test('fetch(`https://evil.example/api/v1/log`)')],
  ['exfil gate would catch a lookalike host', EXFIL_REGEX.test('https://kick.com.evil.net/api/v1/log')],
  ['shadow-a11y gate would reject a bundle with no host-keyed rules', !shadowAccessibilityWired('')],
  ['reward gate would catch a claim that posted to an endpoint',
    !rewardClaimIsSafe("const REWARD_TRIGGER = 'x';\nawait kickFetchJson('/api/v1/claim');\nfunction chatMessageInput() {}")],
  ['reward gate would catch a claim that ignored aria-disabled',
    !rewardClaimIsSafe("const REWARD_TRIGGER = 'x';\nif (!button.disabled) button.click();\ndecideRewardClaim({});\nfunction chatMessageInput() {}")],
  ['reward gate would catch a claim on a dialog this build did not open',
    !rewardClaimIsSafe("const REWARD_TRIGGER = 'x';\ndocument.querySelector('[role=dialog]').click();\ndecideRewardClaim({});\nfunction chatMessageInput() {}")],
  ['reward gate would catch a claim that leaves the dialog claimable behind it',
    !rewardClaimIsSafe("const REWARD_TRIGGER = 'x';\nif (b.disabled || b.getAttribute('aria-disabled')) return;\ndecideRewardClaim({});\ndialog.dataset.kfRewardDialog === 'true';\naction.click();\nfunction chatMessageInput() {}")],
  ['mouse-only gate would catch a completion list that captures Enter',
    !completionIsMouseOnly("function emoteCompletionHost() { list.addEventListener('keydown', accept); }\nfunction acceptEmoteCompletion() {}")],
  ['mouse-only gate would catch a completion that submits the message',
    !completionIsMouseOnly('function emoteCompletionHost() {}\nfunction acceptEmoteCompletion() { form.requestSubmit(); }')],
  ['convergence gate would reject a broadcast applied straight to memory',
    !convergenceRereads('function applyRemoteMultistream(added) { state.multistream.streams.push(...added); }')],
  ['echo gate would catch a receiving tab that writes back',
    !remoteApplyNeverWrites('function applyRemoteMultistream(a, r) {\n    state.multistream = merge(a, r);\n    gmSet(MULTISTREAM_KEY, state.multistream);\n  }')],
  ['echo gate accepts a receiving tab that only re-reads',
    remoteApplyNeverWrites('function applyRemoteMultistream(a, r) {\n    state.multistream = mergeMultistream(gmGet(MULTISTREAM_KEY, {}), state.multistream, a, r);\n  }')],
  ['window gate would reject an organizer that renders the whole list',
    !organizerWindows("gridHost.innerHTML = trustedHTML(visible.map(stickerProxyMarkup).join(''));")],
  ['spacer-math gate would catch CSS drifting from the constants',
    !spacerMathMatchesCss('const STICKER_TILE_HEIGHT = 62;\nconst STICKER_GRID_GAP = 7;\nconst STICKER_TILE_MIN_WIDTH = 50;\n[data-kf-sticker-grid] { grid-auto-rows: 80px; gap: 7px; grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); }')],
  ['spacer-math gate accepts constants that match the CSS',
    spacerMathMatchesCss('const STICKER_TILE_HEIGHT = 62;\nconst STICKER_GRID_GAP = 7;\nconst STICKER_TILE_MIN_WIDTH = 50;\n[data-kf-sticker-grid] { grid-auto-rows: 62px; gap: 7px; grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); }')],
  ['debounce gate would catch a search that re-renders on every keystroke',
    !organizerDebouncesSearch("search.addEventListener('input', () => renderStickerOrganizer());")],
  ['in-place gate would catch a toggle that rebuilds the grid',
    !organizerPatchesInPlace('function renderStickerGrid() { gridHost.innerHTML = build(); }')],
  ['organizer-signature gate would catch a signature that forgot favorite order',
    !organizerSignatureCovers("const signature = [\n  view,\n  hidden,\n  assignments,\n  groups,\n].join('x');")],
  ['organizer-signature gate would catch a missing signature entirely',
    !organizerSignatureCovers('const other = [favoriteOrder, hidden, assignments, groups];')],
  ['organizer-signature gate reads past an inner [...set].join inside the array',
    organizerSignatureCovers("const signature = [\n  favoriteOrder.join(','),\n  [...hidden].join(','),\n  assignments,\n  groups,\n].join('x');")],
  ['module-syntax gate would catch a surviving import',
    withModuleSyntax("'use strict';\nimport { x } from './core.mjs';\nconst y = 1;\n")],
  ['module-syntax gate would catch a surviving export',
    withModuleSyntax("'use strict';\nexport function x() {}\n")],
  ['module-syntax gate accepts a stripped bundle',
    !withModuleSyntax("'use strict';\nfunction x() {}\nconst y = 'import { a } from b';\n")],
  // The two new gates are negative assertions, which are the ones that pass for
  // the wrong reason. Prove each notices the thing it exists to forbid.
  ['hide-elements gate would catch a control being removed rather than styled',
    /tagHideableElements[\s\S]{0,600}?\.(remove|click)\(\)/
      .test('function tagHideableElements() {\n  for (const e of list) e.remove()\n}')],
  ['hide-elements gate accepts a tag-only pass',
    !/tagHideableElements[\s\S]{0,600}?\.(remove|click)\(\)/
      .test('function tagHideableElements() {\n  for (const e of list) e.dataset.kfElement = id\n}')],
  ['quality gate would catch a hard-coded resolution beside the ladder',
    /(?:QUALITY_LADDER_KEY|bestKnownQuality)[\s\S]{0,400}?['"]\d{3,4}p/
      .test("const QUALITY_LADDER_KEY = 'ladder:global';\nconst fallback = '1080p60';")],
  ['quality gate accepts a ladder read with no literal rung',
    !/(?:QUALITY_LADDER_KEY|bestKnownQuality)[\s\S]{0,400}?['"]\d{3,4}p/
      .test("const QUALITY_LADDER_KEY = 'ladder:global';\nreturn bestQualityOption(raw.split('|'));")],
  ['trusted-types gate would catch a bare innerHTML write',
    /\.innerHTML\s*=(?!\s*trustedHTML\()/.test('node.innerHTML = `<b>x</b>`;')],
  ['trusted-types gate accepts a policy-routed write',
    !/\.innerHTML\s*=(?!\s*trustedHTML\()/.test('node.innerHTML = trustedHTML(`<b>x</b>`);')],
  // The import-coverage gate is derived from the registry, so prove it reports
  // gaps rather than vacuously agreeing with whatever the function happens to
  // contain — an empty body must come back as every store missing.
  ['import-coverage gate would report an applyImportedStores that reads nothing',
    importGapsIn('').length === STORAGE_STORES.filter((store) => store.backup).length],
  // Firefox has never implemented :host-context(), so a rule written that way
  // would style Chromium and silently skip the Firefox artifact.
  ['shadow-a11y gate would reject :host-context, which Firefox does not implement',
    !shadowAccessibilityWired(':host-context([data-kf-large-targets="true"]) button{} :host-context([data-kf-reduce-motion="true"]) * {}')],
  // The site-level rules are not a substitute: they cannot cross the shadow
  // boundary, which is the entire defect this gate exists to catch.
  ['shadow-a11y gate would reject the site-level rules alone',
    !shadowAccessibilityWired('html[data-kf-large-targets="true"] button{} html[data-kf-reduce-motion="true"] *{}')],
  // The tree-scope trap is invisible at runtime — no throw, no warning, the
  // surface simply parks in the corner — so the gate for it has to be proven.
  ['anchor gate would catch a position-anchor declared in a shadow stylesheet',
    !anchoredSurfacesResolve("const CSS_TEXT = ':host { position-anchor: --kf-emote-card; }';\nhost.style.setProperty('position-anchor', name);")],
  ['anchor gate would catch an anchored host with no flip fallbacks',
    !anchoredSurfacesResolve("host.style.setProperty('position-anchor', name);\n':host([data-kf-anchored=\"true\"]) { position-area: block-start; }'")],
  ['anchor gate would catch an anchor set on the host by any means but an inline style',
    !anchoredSurfacesResolve('host.dataset.positionAnchor = name;\nposition-try-fallbacks: flip-block;\nposition-try-fallbacks: flip-block;')],
  ['feature-detect gate would catch the pre-standardisation property names',
    !anchorPropertiesAreDetected("function canAnchorPopover() { return CSS.supports('inset-area: block-start') && CSS.supports('position-try-options: flip-block') && HTMLElement.prototype.showPopover; }")],
  ['popover gate would catch an auto popover, which would eat Escape',
    !anchoredSurfacesAreManual("host.setAttribute('popover', 'auto');\nhost.style.left = x;\nhost.style.top = y;")],
  ['popover gate would catch the hand-positioned fallback being dropped',
    !anchoredSurfacesAreManual("host.setAttribute('popover', 'manual');")],
  ['derived gate would catch an expectation declared with no deriver',
    !derivedExpectationsAreWired("DERIVED_EXPECTATIONS = Object.freeze([{ id: 'cardSlug' },{ id: 'playerContainer' },{ id: 'qualityHeight' },{ id: 'newThing' }]); function describeDerived(){} function compatibilityDerivers() { return { cardSlug: 1, playerContainer: 2, qualityHeight: 3 }; }")],
  ['derived gate accepts a fully wired set',
    derivedExpectationsAreWired("DERIVED_EXPECTATIONS = Object.freeze([{ id: 'cardSlug' },{ id: 'playerContainer' },{ id: 'qualityHeight' }]); function describeDerived(){} function compatibilityDerivers() { return { cardSlug: 1, playerContainer: 2, qualityHeight: 3 }; }")],
  ['publish gate would catch a snapshot taken without publishing it',
    !compatibilityVerdictIsPublished('state.compatibility = compatibilitySnapshot(a); state.compatibility = compatibilitySnapshot(b); publishCompatibility();')],
  ['publish gate accepts every snapshot being published',
    compatibilityVerdictIsPublished('state.compatibility = compatibilitySnapshot(a); publishCompatibility(); state.compatibility = compatibilitySnapshot(b); publishCompatibility();')],
  ['control-byte gate would catch a backspace hidden in a regex',
    withControlBytes([['fake.mjs', ['const re = /', String.fromCharCode(8), 'name/g;'].join('')]]).length === 1],
  ['control-byte gate accepts tabs and newlines',
    withControlBytes([['fake.mjs', ['const a = 1;', String.fromCharCode(10), String.fromCharCode(9), 'const b = 2;', String.fromCharCode(13)].join('')]]).length === 0],
  ['account-write gate would catch a literal write added anywhere in the bundle',
    !onlyWritesAreTheFollowGesture(`async function mutateKickChannelFollow(slug, method = 'POST') {}
fetch(url, { method: 'PUT' });`)],
  ['account-write gate would catch the follow being called without reading the emote requirement',
    !onlyWritesAreTheFollowGesture(`async function mutateKickChannelFollow(slug, method = 'POST') {}
mutateKickChannelFollow(follow.slug, 'POST');
mutateKickChannelFollow(unfollowSlug, 'DELETE');`)],
  ['account-write gate accepts the real bundle', onlyWritesAreTheFollowGesture(source)],
  ['derived gates accept the real bundle',
    derivedExpectationsAreWired(source) && compatibilityVerdictIsPublished(source)],
  ['pop-out gate would catch the grid frame being moved into the window',
    !popOutBuildsItsOwnFrame("function fillChatWindow(pip, slug) { const frame = host_.querySelector('[data-kf-multistream-chat] iframe'); pip.document.body.append(frame); }")],
  ['pop-out gate would catch a window built with no frame at all',
    !popOutBuildsItsOwnFrame("function fillChatWindow(pip, slug) { pip.document.body.append(notice); }")],
  ['pop-out gate accepts a window that creates its own frame',
    popOutBuildsItsOwnFrame("function fillChatWindow(pip, slug) { const frame = doc.createElement('iframe'); frame.src = chatEmbedUrl(slug); doc.body.append(frame); }")],
  ['pop-out return gate would catch the pane being emptied instead of hidden',
    !popOutReturnsWithoutReload("host_.replaceChildren();")],
  ['pop-out gates accept the real bundle',
    popOutBuildsItsOwnFrame(source) && popOutReturnsWithoutReload(source)],
  ['merged-chat gate would catch a composer added to the pane',
    !mergedChatIsReadOnly("function paintMergedChat(b) { setMarkup(list, '<li><input class=\"say\"></li>'); }\nasync function openMergedChannel(s) { socket.send(realtimeSubscribeFrame(name)); }")],
  ['merged-chat gate would catch a second send on the merged socket',
    !mergedChatIsReadOnly("function paintMergedChat(b) { setMarkup(list, '<li>x</li>'); }\nasync function openMergedChannel(s) { socket.send(realtimeSubscribeFrame(name)); socket.send(chatFrame(text)); }")],
  ['merged-chat gate accepts a subscribe-only reader',
    mergedChatIsReadOnly("function paintMergedChat(b) { setMarkup(list, '<li>x</li>'); }\nasync function openMergedChannel(s) { socket.send(realtimeSubscribeFrame(name)); }")],
  ['merged-chat gates accept the real bundle',
    mergedChatIsReadOnly(source) && mergedChatFollowsTheGrid(source)],
  // The live gate itself must be the real thing on this machine, not a skip.
  ['anchor gates accept the real bundle',
    anchoredSurfacesResolve(source) && anchorPropertiesAreDetected(source) && anchoredSurfacesAreManual(source)],
  ['content-scripts gate accepts the real manifest', contentScriptsScoped(manifest.content_scripts)],
  ['shadow-a11y gate accepts the real bundle', shadowAccessibilityWired(source)],
];
for (const [label, fires] of redProbes) {
  if (!fires) throw new Error(`Red probe failed (gate is vacuous): ${label}`);
}

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`Check failed: ${label}`);
  console.log(`OK ${label}`);
}
console.log(`${checks.length} checks passed; ${redProbes.length} red probes fired.`);
