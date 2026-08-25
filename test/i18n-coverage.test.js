import test, { expectFailure } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISCOVERY_ROUTE_LABELS, EMOTE_ACCESS_LABELS, HIDEABLE_ELEMENTS, HIDEABLE_GROUPS, IMPORT_ERROR_MESSAGES, IMPORT_NOTE_MESSAGES, STORAGE_STORES, VIEWER_HUB_REASONS, VIEWER_HUB_REWARD_WORDS, VIEWER_HUB_TITLES } from '../src/core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Does every string the interface renders have a dictionary entry?
 *
 * `test/i18n.test.js` proves the locales agree with each other and hold no
 * duplicates. It cannot see a string missing from all of them equally, which is
 * exactly what a new untranslated feature looks like — measured 2026-08-15, 78
 * rendered strings had no entry in any locale while that gate stayed green.
 *
 * Settings copy is the blind spot specifically: it reaches the DOM as raw
 * markup and is translated afterwards by `localizeInterface()` looking each
 * visible string up, so a missing entry is indistinguishable from an
 * intentional English string.
 */
/** A single-quoted JS string literal, capturing its contents. */
const STR = "'((?:[^'\\\\]|\\\\.)*)'";
const STR_NC = "'(?:[^'\\\\]|\\\\.)*'";

/**
 * Every surface that puts this build's own copy in front of a user.
 *
 * `row`/`pageHeader`/`tr` were the original three, and covered only settings
 * body copy. Toasts and announcements write straight to `textContent`, and
 * attribute copy never reaches a text node at all, so ~110 strings — every
 * error message, every screen-reader label, every placeholder — sat outside the
 * gate and stayed English in es/pt while it reported full coverage.
 */
const SCANNERS = [
  ['row', new RegExp(`\\brow\\(${STR},\\s*${STR}`, 'g')],
  ['pageHeader', new RegExp(`\\bpageHeader\\(${STR},\\s*${STR}`, 'g')],
  ['tr', new RegExp(`\\btr\\(${STR}`, 'g')],
  ['trf', new RegExp(`\\btrf\\(${STR}`, 'g')],
  // `tr(cond ? 'A' : 'B')` and `trf(cond ? 'A {n}' : 'B {n}', …)`. The two
  // scanners above need a quote straight after the paren, so the whole ternary
  // shape was invisible to them — and that shape is most of the accessible
  // names, where the label depends on the state of the control it sits on.
  ['tr ternary', new RegExp(`\\btrf?\\([^;'"\`]{0,200}\\?\\s*${STR}\\s*:\\s*${STR}`, 'g')],
  // The nested form, for a control with three states rather than two.
  ['tr nested ternary', new RegExp(`\\btrf?\\([^;'"\`]{0,120}\\?\\s*\\([^;'"\`]{0,120}\\?\\s*${STR}\\s*:\\s*${STR}`, 'g')],
  // A ternary handed straight to `announce`, and one assigned to a
  // `textContent` or a `setAttribute` that runs after `localizeInterface` has
  // already walked the tree. Sixteen screen-reader announcements for the
  // product's headline toggles, and ten in-place control labels, sat outside
  // the gate and stayed English in es and pt while it reported full coverage.
  ['announce ternary', new RegExp(`\\bannounce\\([^;]{0,200}\\?\\s*${STR}\\s*:\\s*${STR}`, 'g')],
  ['textContent ternary', new RegExp(`textContent = tr\\([^;]{0,160}\\?\\s*${STR}\\s*:\\s*${STR}`, 'g')],
  ['setAttribute ternary', new RegExp(`setAttribute\\('(?:aria-label|title|placeholder)', tr\\([^;]{0,160}\\?\\s*${STR}\\s*:\\s*${STR}`, 'g')],
  /**
   * Prose written straight into a settings page's markup.
   *
   * The scanners above all read a string handed to a *function*. Settings copy
   * that is typed into an `<h3>` or a `<p>` in a page template is never handed
   * to anything: it reaches the DOM as markup and `localizeInterface` looks the
   * finished text node up afterwards. So a paragraph with no dictionary entry
   * is indistinguishable from an intentional English one, and 33 of them were
   * sitting in Spanish and Portuguese builds untranslated while this gate
   * reported full coverage.
   *
   * Deliberately narrow. It takes only a text node that is entirely literal:
   * no interpolation, no nested element, four or more words. A node carrying a
   * `${…}` is a different bug with a different fix — it can never match a
   * dictionary key at all and has to become a `trf` template — and matching it
   * here would only add an unfixable key.
   */
  ['markup prose', /<(?:h[1-6]|p|span|strong|small|b|li|td|th|button|div|aside|summary)\b[^<>]*>([^<>{}$`]*[a-z][ ][a-z][^<>{}$`]*)</g],
  ['showToast', new RegExp(`\\bshowToast\\(${STR}`, 'g')],
  ['showToast ternary', new RegExp(`\\bshowToast\\([^;?]{0,300}\\?\\s*${STR}\\s*:\\s*${STR}`, 'g')],
  ['save status', new RegExp(`\\b(?:saveSettings|setSaveStatus)\\(${STR}`, 'g')],
  ['update setting status', new RegExp(`\\bupdateSetting\\(${STR_NC},[^;]{0,400}?,\\s*${STR}\\s*\\);`, 'g')],
  ['announce', new RegExp(`\\bannounce\\(${STR}`, 'g')],
  ['toast action label', new RegExp(`\\blabel:\\s*${STR}`, 'g')],
  ['plural form', new RegExp(`\\bplural\\([^,]+,\\s*${STR},\\s*${STR}\\s*\\)`, 'g')],
  // Markup attributes only. The lookbehind requires whitespace before the
  // attribute name, which is what separates `<span aria-label="…">` from the
  // CSS selector `[aria-label="Advertisement"]` used to find Kick's ad shells —
  // that one is a match pattern against Kick's DOM, not copy of ours, and
  // translating it would break ad removal. Interpolated values are skipped:
  // a template is not a fixed string, so there is nothing to look up.
  ['attribute', /(?<=\s)(?:aria-label|title|placeholder)="((?:[^"\\$`]|\\.)*)"/g],
];

/**
 * Strings that are deliberately identical in every language. Each needs a
 * reason — this list is how an untranslated string hides from the gate, so it
 * stays short and never absorbs "we did not get to it yet".
 */
const EXEMPT = new Set([
  'Kick Focus', // The product name. Brand names are not translated, same rule as language endonyms.
  'https://example.com/kick-focus-blocklist.json', // An example URL, not prose.
]);

async function interfaceSource() {
  const [runtime, settings] = await Promise.all([
    readFile(resolve(root, 'src/runtime.js'), 'utf8'),
    readFile(resolve(root, 'src/settings.mjs'), 'utf8'),
  ]);
  return `${runtime}\n${settings}`;
}

async function collect(override = null) {
  const src = override === null ? await interfaceSource() : override;
  const start = src.indexOf('const TRANSLATIONS = {');
  assert.notEqual(start, -1, 'TRANSLATIONS literal not found');
  const block = src.slice(start, src.indexOf('\n};', start));

  // One row per string, keyed by the English original and valued by one entry
  // per language in LOCALES order, so every locale covers the same keys by
  // construction. The per-locale sets are kept because the assertions below
  // report which language is short of what.
  const names = src.match(/const LOCALES = \[([^\]]*)\]/);
  assert.ok(names, 'LOCALES list not found');
  const order = [...names[1].matchAll(/'(\w+)'/g)].map((match) => match[1]);
  const locales = Object.fromEntries(order.map((name) => [name, new Set()]));
  for (const line of block.split('\n')) {
    const keyMatch = line.match(/^ {2}'((?:[^'\\]|\\.)*)': \[/);
    if (keyMatch) for (const name of order) locales[name].add(keyMatch[1]);
  }

  // Copy that reaches the screen from core.mjs rather than from the interface sources.
  // The scanners read runtime.js and settings.mjs, so a string composed in core would otherwise
  // be invisible to this gate — named explicitly instead of widening the scan
  // to a module that is mostly not user-facing prose.
  const rendered = new Set([
    ...Object.values(EMOTE_ACCESS_LABELS),
    // The hide-element grid is generated from the catalog, so its chip labels
    // and group headings never appear as literals in runtime.js for the
    // scanners to find. Adding a catalog entry therefore has to add two
    // dictionary entries, and this is what says so.
    ...HIDEABLE_ELEMENTS.map((entry) => entry.label),
    ...HIDEABLE_GROUPS.map((group) => group.label),
    // The viewer hub's card titles, its "no reading" sentences, and the reward
    // card's three words all reach the DOM through a lookup keyed by card id,
    // so no literal of any of them exists in runtime.js for the scanners.
    ...Object.values(VIEWER_HUB_TITLES),
    ...Object.values(VIEWER_HUB_REASONS),
    ...Object.values(VIEWER_HUB_REWARD_WORDS),
    ...Object.values(IMPORT_ERROR_MESSAGES),
    ...Object.values(IMPORT_NOTE_MESSAGES),
    ...STORAGE_STORES.map((store) => store.label),
    'Kick Focus could not save your {list}. Browser storage is full or blocked, so those changes exist only until you reload.',
    // The seed note is composed in storage.mjs and rendered through
    // `trf(seed.messageKey, …)`, so no literal of it exists in either file
    // the scanners read.
    'The first paint reads {held} of your {total} emotes. The rest load from the database a moment later.',
    // The earned marker's status, which reaches the accessible name through a
    // lookup and never appears as a literal in runtime.js.
    'Daily reward ready',
    // Route names on a saved view, reached through a lookup keyed by route.
    ...Object.values(DISCOVERY_ROUTE_LABELS),
    'Click to save',
    'Saved. Click to open in the library',
    'Name shadowed by another set',
    'No apply cycle has run yet.',
  ]);
  for (const [, pattern] of SCANNERS) {
    for (const match of src.matchAll(pattern)) {
      for (const group of match.slice(1)) {
        if (group && !EXEMPT.has(group)) rendered.add(group);
      }
    }
  }

  return { locales, rendered };
}

test('the parser finds the dictionaries and the rendered strings', { tag: 'unit' }, async () => {
  const { locales, rendered } = await collect();
  // Guard the guard: if these regexes stop matching, every assertion below
  // passes vacuously and the gate becomes decorative.
  assert.ok(Object.keys(locales).length >= 2, 'expected at least two locales');
  for (const [name, keys] of Object.entries(locales)) {
    assert.ok(keys.size > 100, `${name} parsed only ${keys.size} keys — suspect the parser, not the dictionary`);
  }
  assert.ok(rendered.size > 100, `parsed only ${rendered.size} rendered strings — suspect the parser`);
});

test('each scanner still matches its own surface, so none can silently go blind', { tag: 'unit' }, async () => {
  // A scanner whose regex stops matching contributes nothing and takes the
  // strings it used to cover out of the gate without failing anything. Every
  // one of them must find something in the real source.
  const src = await interfaceSource();
  for (const [name, pattern] of SCANNERS) {
    const hits = [...src.matchAll(pattern)].length;
    assert.ok(hits > 0, `the ${name} scanner matched nothing — suspect the regex, not the source`);
  }
  // The attribute scanner must keep telling markup apart from CSS selectors.
  const [, attribute] = SCANNERS.find(([name]) => name === 'attribute');
  const selectorHits = [...'[aria-label="Advertisement"], [title="x"]'.matchAll(attribute)];
  assert.deepEqual(selectorHits, [], 'selector attributes must not be scanned as copy');
  const markupHits = [...'<span aria-label="Real copy">'.matchAll(attribute)].map((m) => m[1]);
  assert.deepEqual(markupHits, ['Real copy'], 'markup attributes must be scanned as copy');
});

const untranslated = ({ locales, rendered }) => {
  const names = Object.keys(locales);
  return [...rendered].filter((value) => names.some((name) => !locales[name].has(value)));
};

test('every rendered string has an entry in every locale', { tag: 'unit' }, async () => {
  const missing = untranslated(await collect());
  assert.deepEqual(
    missing,
    [],
    `${missing.length} rendered string(s) have no dictionary entry, starting with: ${missing.slice(0, 3).map((s) => JSON.stringify(s.slice(0, 60))).join(' | ')}`,
  );
});

/**
 * The gate, proved red without touching the working tree.
 *
 * A coverage gate that has never been seen to fail is indistinguishable from
 * one whose parser quietly stopped matching, and the way this used to be
 * checked was to edit `src/runtime.js`, watch it go red, and put the file back
 * — which is how uncommitted work was lost to a `git checkout --` once already.
 * `expectFailure` inverts the verdict instead: the assertion below genuinely
 * fails, and the run is green because of it. The day the parser goes blind, the
 * assertion starts passing and the runner reports an unexpected pass.
 */
async function sabotaged(insert) {
  const src = await readFile(resolve(root, 'src/runtime.js'), 'utf8');
  const marker = 'const TRANSLATIONS = {';
  return src.replace(marker, `${insert}
${marker}`);
}

expectFailure('a rendered string with no dictionary entry fails the coverage gate', { tag: 'unit' }, async () => {
  const missing = untranslated(await collect(await sabotaged("  tr('An untranslated sentence this build would render');")));
  assert.deepEqual(missing, [], `expected the gate to catch it, instead it found ${missing.length}`);
});

expectFailure('a settings row with no dictionary entry fails the coverage gate', { tag: 'unit' }, async () => {
  const missing = untranslated(await collect(await sabotaged("  row('An untitled row', 'An undescribed row', control);")));
  assert.deepEqual(missing, [], `expected the gate to catch it, instead it found ${missing.length}`);
});

expectFailure('a ternary toast with untranslated literals fails the coverage gate', { tag: 'unit' }, async () => {
  const missing = untranslated(await collect(await sabotaged(`  showToast(ok
    ? 'An untranslated success'
    : 'An untranslated failure');`)));
  assert.deepEqual(missing, [], `expected the gate to catch it, instead it found ${missing.length}`);
});

expectFailure('an indirect save status with no translation fails the coverage gate', { tag: 'unit' }, async () => {
  const missing = untranslated(await collect(await sabotaged("  updateSetting('layout.density', nextDensity, 'An untranslated save status');")));
  assert.deepEqual(missing, [], `expected the gate to catch it, instead it found ${missing.length}`);
});

test('an accessible name written by script goes through the translator', { tag: 'unit' }, async () => {
  // The attribute scanner reads markup, so a name set with setAttribute was
  // invisible to it. That is not only a coverage hole: the emote completion
  // list lives in its own shadow root, which localizeInterface never walks, so
  // a bare literal there could not be translated by the DOM pass either. The
  // rule is therefore stronger than "have an entry" — the call itself has to
  // go through tr() or trf().
  const src = await interfaceSource();
  const bare = [...src.matchAll(new RegExp(String.raw`\bsetAttribute\(\s*'(?:aria-label|title|placeholder)'\s*,\s*(` + STR_NC + ')', 'g'))]
    .map((match) => match[1]);
  assert.deepEqual(bare, [],
    `${bare.length} accessible name(s) are set from a bare literal: ${bare.join(' | ')}`);
});

test('no toast or announcement carries prose a dictionary never sees', { tag: 'unit' }, async () => {
  // A template literal is not a fixed string, so no scanner can look it up and
  // every one of these stayed English in es and pt. Composing from already
  // translated pieces is fine and common, so the rule is about prose: letters
  // outside the placeholders are words somebody wrote, and words have to come
  // from trf() with the template as the key.
  const [runtime, multistream] = await Promise.all([
    readFile(resolve(root, 'src/runtime.js'), 'utf8'),
    readFile(resolve(root, 'src/multistream.mjs'), 'utf8'),
  ]);
  const offenders = [];
  for (const [name, src] of [['runtime.js', runtime], ['multistream.mjs', multistream]]) {
    src.split('\n').forEach((line, index) => {
      const match = /\b(?:showToast|announce)\(`([^`]*)`/.exec(line);
      if (!match) return;
      // Drop the placeholders, including the nested braces of an object literal.
      let bare = match[1];
      let previous;
      do { previous = bare; bare = bare.replace(/\$\{[^{}]*\}/g, ''); } while (bare !== previous);
      bare = bare.replace(/\$\{[\s\S]*\}/g, '');
      if (/[A-Za-z]{3,}/.test(bare)) offenders.push(`${name}:${index + 1} ${match[1].slice(0, 60)}`);
    });
  }
  assert.deepEqual(offenders, [],
    `${offenders.length} toast template(s) hold untranslatable prose: ${offenders.join(' | ')}`);
});
