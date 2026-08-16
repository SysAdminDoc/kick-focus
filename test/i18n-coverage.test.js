import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  ['showToast', new RegExp(`\\bshowToast\\(${STR}`, 'g')],
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

async function collect() {
  const src = await readFile(resolve(root, 'src/runtime.js'), 'utf8');
  const start = src.indexOf('const TRANSLATIONS = {');
  assert.notEqual(start, -1, 'TRANSLATIONS literal not found');
  const block = src.slice(start, src.indexOf('\n};', start));

  const locales = {};
  let current = null;
  for (const line of block.split('\n')) {
    const localeMatch = line.match(/^ {2}(\w+): \{/);
    if (localeMatch) { current = localeMatch[1]; locales[current] = new Set(); continue; }
    if (!current) continue;
    const keyMatch = line.match(/^ {4}'((?:[^'\\]|\\.)*)':/);
    if (keyMatch) locales[current].add(keyMatch[1]);
  }

  const rendered = new Set();
  for (const [, pattern] of SCANNERS) {
    for (const match of src.matchAll(pattern)) {
      for (const group of match.slice(1)) {
        if (group && !EXEMPT.has(group)) rendered.add(group);
      }
    }
  }

  return { locales, rendered };
}

test('the parser finds the dictionaries and the rendered strings', async () => {
  const { locales, rendered } = await collect();
  // Guard the guard: if these regexes stop matching, every assertion below
  // passes vacuously and the gate becomes decorative.
  assert.ok(Object.keys(locales).length >= 2, 'expected at least two locales');
  for (const [name, keys] of Object.entries(locales)) {
    assert.ok(keys.size > 100, `${name} parsed only ${keys.size} keys — suspect the parser, not the dictionary`);
  }
  assert.ok(rendered.size > 100, `parsed only ${rendered.size} rendered strings — suspect the parser`);
});

test('each scanner still matches its own surface, so none can silently go blind', async () => {
  // A scanner whose regex stops matching contributes nothing and takes the
  // strings it used to cover out of the gate without failing anything. Every
  // one of them must find something in the real source.
  const src = await readFile(resolve(root, 'src/runtime.js'), 'utf8');
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

test('every rendered string has an entry in every locale', async () => {
  const { locales, rendered } = await collect();
  const names = Object.keys(locales);
  const missing = [...rendered].filter((s) => names.some((n) => !locales[n].has(s)));
  assert.deepEqual(
    missing,
    [],
    `${missing.length} rendered string(s) have no dictionary entry, starting with: ${missing.slice(0, 3).map((s) => JSON.stringify(s.slice(0, 60))).join(' | ')}`,
  );
});
