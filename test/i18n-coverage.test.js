import test, { expectFailure } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../scripts/strip-comments.mjs';
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

/**
 * What the HTML parser will hand `localizeInterface`, not what the source says.
 *
 * `localizeInterface` reads `node.nodeValue` from parsed markup, so a paragraph
 * written as `Content &amp; Ads` arrives as `Content & Ads`. A scanner that
 * captured the source bytes certified a dictionary key the lookup could never
 * hit, which is the exact failure it was added to catch. JS string literals
 * carry no entities, so decoding is a no-op for every other scanner.
 */
function decodeEntities(value) {
  return String(value)
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&rsquo;', '\u2019')
    .replaceAll('&nbsp;', '\u00a0')
    .replaceAll('&amp;', '&');
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
        const text = decodeEntities(group);
        if (text && !EXEMPT.has(text)) rendered.add(text);
      }
    }
  }

  return { locales, rendered };
}

test('the parser finds the dictionaries and the rendered strings', { tags: ['unit'] }, async () => {
  const { locales, rendered } = await collect();
  // Guard the guard: if these regexes stop matching, every assertion below
  // passes vacuously and the gate becomes decorative.
  assert.ok(Object.keys(locales).length >= 2, 'expected at least two locales');
  for (const [name, keys] of Object.entries(locales)) {
    assert.ok(keys.size > 100, `${name} parsed only ${keys.size} keys — suspect the parser, not the dictionary`);
  }
  assert.ok(rendered.size > 100, `parsed only ${rendered.size} rendered strings — suspect the parser`);
});

test('each scanner still matches its own surface, so none can silently go blind', { tags: ['unit'] }, async () => {
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

test('every rendered string has an entry in every locale', { tags: ['unit'] }, async () => {
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

expectFailure('a rendered string with no dictionary entry fails the coverage gate', { tags: ['unit'] }, async () => {
  const missing = untranslated(await collect(await sabotaged("  tr('An untranslated sentence this build would render');")));
  assert.deepEqual(missing, [], `expected the gate to catch it, instead it found ${missing.length}`);
});

expectFailure('a settings row with no dictionary entry fails the coverage gate', { tags: ['unit'] }, async () => {
  const missing = untranslated(await collect(await sabotaged("  row('An untitled row', 'An undescribed row', control);")));
  assert.deepEqual(missing, [], `expected the gate to catch it, instead it found ${missing.length}`);
});

expectFailure('a ternary toast with untranslated literals fails the coverage gate', { tags: ['unit'] }, async () => {
  const missing = untranslated(await collect(await sabotaged(`  showToast(ok
    ? 'An untranslated success'
    : 'An untranslated failure');`)));
  assert.deepEqual(missing, [], `expected the gate to catch it, instead it found ${missing.length}`);
});

expectFailure('an indirect save status with no translation fails the coverage gate', { tags: ['unit'] }, async () => {
  const missing = untranslated(await collect(await sabotaged("  updateSetting('layout.density', nextDensity, 'An untranslated save status');")));
  assert.deepEqual(missing, [], `expected the gate to catch it, instead it found ${missing.length}`);
});

test('an accessible name written by script goes through the translator', { tags: ['unit'] }, async () => {
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

test('no toast or announcement carries prose a dictionary never sees', { tags: ['unit'] }, async () => {
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


/**
 * Copy written where `localizeInterface` will never walk it.
 *
 * `localizeInterface(root = state.shadow)` is only ever called with its
 * default, so it walks the settings shadow root and nothing else — not Kick's
 * document, and not this build's five other shadow roots. Markup written
 * anywhere else has to be translated at write time, or immediately re-set
 * through `tr()`, or it stays English whatever the dictionary holds.
 *
 * That is a different claim from the `markup prose` scanner above, which only
 * proves a key exists. Measured 2026-09-05: the search and Drops surfaces and
 * four strings on the header control all had es and pt entries while rendering
 * English, and every gate in this file was green.
 *
 * Three earlier versions of this gate were wrong in ways worth recording,
 * because each looked correct:
 *
 *  - It required two adjacent words, so `<dt>Active</dt>`, `>View</a>` and
 *    `>Clear</button>` were invisible — five of the fourteen strings the fix
 *    that introduced this gate had just repaired.
 *  - It excluded any function whose text matched /shadow/i, meaning to skip
 *    shadow roots. A `box-shadow` in an inline style, or any identifier
 *    containing the word, silently removed a function from the scan *and* from
 *    the completeness check, so both halves went quiet together.
 *  - Its red probe re-typed the offender pattern instead of sharing it, so
 *    blanking the real pattern left the probe still passing.
 *
 * The rule below is the one the criterion actually states, and it is inverted:
 * every writer is scanned unless it is named as one the walker reaches.
 */
const MARKUP_TEXT = /<(?:h[1-6]|p|span|strong|small|b|li|td|th|dt|dd|button|div|aside|a|summary|label|option)\b[^<>]*>([^<>{}$`]*[A-Za-z]{2,}[^<>{}$`]*)</g;
const MARKUP_ATTRIBUTE = /(?<=\s)(?:aria-label|title|placeholder)="((?:[^"\\$`]|\\.)*[A-Za-z]{2,}(?:[^"\\$`]|\\.)*)"/g;

function topLevelFunctions(source) {
  const lines = source.split('\n');
  const found = [];
  let current = null;
  let depth = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!current) {
      const match = /^function ([A-Za-z0-9_$]+)\(/.exec(line);
      if (match) { current = { name: match[1], text: '' }; depth = 0; }
    }
    if (!current) continue;
    current.text += `${line}\n`;
    for (const character of line) {
      if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
    }
    if (depth === 0 && /^\}/.test(line)) { found.push(current); current = null; }
  }
  return found;
}

/**
 * The only writers whose markup `localizeInterface` walks afterwards.
 *
 * Both write into `state.shadow` itself, so their literals are looked up by
 * the DOM pass and the `markup prose` scanner above is the right gate for
 * them. Everything else that calls `setMarkup` is scanned. Adding a name here
 * is a claim that the walker reaches it, and is the one way copy can be typed
 * literally — which is why the list is two entries long and stays that way.
 */
const WALKED_BY_LOCALIZE = ['buildInterface', 'renderCommands'];

/**
 * Literals a writer puts on screen that no translator will ever see.
 *
 * A literal is acceptable when the same string is handed to `tr()` somewhere
 * in the file, because that is what the surfaces outside the walker do: they
 * paint English on first mount and correct it on the next sync pass. The
 * lookup does not have to be in the same function — the header control is
 * written by `ensureHeaderQuickControl` and re-labelled by `syncQuickButton`
 * and `syncHeaderMultiState` — but it does have to exist. That is exactly what
 * was missing on 2026-09-05: `Multi-stream` and `Open Kick Focus multi-stream`
 * had dictionary entries, sat in the markup, and were passed to `tr()` by
 * nothing, so both rendered English in Spanish and Portuguese.
 */
function untranslatedLiterals(body, lookups) {
  const offenders = [];
  for (const [kind, pattern] of [['text', MARKUP_TEXT], ['attribute', MARKUP_ATTRIBUTE]]) {
    for (const match of body.matchAll(pattern)) {
      const value = match[1].trim();
      if (!value || EXEMPT.has(value) || lookups.has(value)) continue;
      offenders.push(`${kind}: ${value.slice(0, 60)}`);
    }
  }
  return offenders;
}

/** Every string this file actually asks the translator for. */
function translatorLookups(source) {
  const found = new Set();
  for (const pattern of [/\btrf?\(\s*'((?:[^'\\]|\\.)*)'/g, /\btrf?\(\s*[^;'"`]{0,200}\?\s*'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g]) {
    for (const match of source.matchAll(pattern)) {
      for (const value of match.slice(1)) if (value) found.add(value.replaceAll("\\'", "'"));
    }
  }
  return found;
}

function pageDomOffenders(source) {
  const stripped = stripComments(source);
  const lookups = translatorLookups(stripped);
  const writers = topLevelFunctions(stripped)
    .filter((entry) => entry.text.includes('setMarkup(') && !WALKED_BY_LOCALIZE.includes(entry.name));
  return writers.flatMap((writer) => untranslatedLiterals(writer.text, lookups).map((offender) => `${writer.name} ${offender}`));
}

test('no surface outside the translator’s reach carries a bare literal', { tags: ['unit'] }, async () => {
  const offenders = pageDomOffenders(await readFile(resolve(root, 'src/runtime.js'), 'utf8'));
  assert.deepEqual(offenders, [],
    `${offenders.length} string(s) render without a translator: ${offenders.join(' | ')}`);
});

test('the writers exempted from that rule are the ones the walker actually reaches', { tags: ['unit'] }, async () => {
  // The exemption is load-bearing, so it is asserted rather than trusted: each
  // name has to exist and has to write into the settings shadow root.
  const source = stripComments(await readFile(resolve(root, 'src/runtime.js'), 'utf8'));
  const byName = new Map(topLevelFunctions(source).map((entry) => [entry.name, entry.text]));
  for (const name of WALKED_BY_LOCALIZE) {
    const body = byName.get(name);
    assert.ok(body, `${name} is exempted from the page-DOM rule but no longer exists`);
    assert.ok(/setMarkup\((?:shadow|state\.shadow|state\.commandList)\b/.test(body),
      `${name} is exempted as walked by localizeInterface, but does not write into the settings shadow root`);
  }
});

expectFailure('a bare literal outside the translator’s reach fails the gate', { tags: ['unit'] }, () => {
  // Shares MARKUP_TEXT and pageDomOffenders with the test above rather than
  // re-typing them: a probe with its own copy of the pattern goes on passing
  // when the real one is blanked, which is how the first version of this probe
  // proved nothing. Both planted strings are single words, the shape the
  // earlier two-word pattern could not see.
  const planted = [
    'function renderSomething() {',
    '  const host = document.querySelector(\'main\');',
    '  setMarkup(host, `<dd><a href="/x">View</a></dd><button title="Clear">Clear</button>`);',
    '}',
  ].join('\n');
  const offenders = pageDomOffenders(planted);
  assert.deepEqual(offenders, [], `planted literals were not caught: ${offenders.join(' | ')}`);
});

expectFailure('exempting a writer the walker does not reach fails the gate', { tags: ['unit'] }, () => {
  const source = [
    'function notWalked() {',
    '  const host = document.querySelector(\'main\');',
    '  setMarkup(host, `<p>hello</p>`);',
    '}',
  ].join('\n');
  const byName = new Map(topLevelFunctions(source).map((entry) => [entry.name, entry.text]));
  assert.ok(/setMarkup\((?:shadow|state\.shadow|state\.commandList)\b/.test(byName.get('notWalked')),
    'notWalked is exempted as walked by localizeInterface, but does not write into the settings shadow root');
});
