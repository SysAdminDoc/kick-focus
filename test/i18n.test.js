import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Read the TRANSLATIONS literal out of the source and count *authored* keys.
 *
 * Parsing rather than importing, because a duplicate key is legal JavaScript:
 * the later value silently wins and the object simply has one fewer entry. That
 * is exactly the defect this gate exists to catch, so the evaluated object
 * cannot be the thing we measure.
 */
async function readLocales() {
  const source = await readFile(resolve(root, 'src/runtime.js'), 'utf8');
  const start = source.indexOf('const TRANSLATIONS = {');
  assert.notEqual(start, -1, 'TRANSLATIONS literal not found');

  const locales = new Map();
  let locale = null;
  for (const line of source.slice(start).split('\n')) {
    const localeMatch = line.match(/^ {2}(\w+): \{/);
    if (localeMatch) {
      locale = localeMatch[1];
      locales.set(locale, []);
      continue;
    }
    if (locale && /^ {2}\},?\s*$/.test(line)) {
      locale = null;
      continue;
    }
    if (!locale && /^\};/.test(line)) break;
    if (!locale) continue;
    const entry = line.match(/^ {4}'((?:[^'\\]|\\.)*)':/);
    if (entry) locales.get(locale).push(entry[1]);
  }

  assert.ok(locales.size >= 2, `expected at least two locales, found ${[...locales.keys()].join(', ')}`);
  for (const [locale, keys] of locales) {
    assert.ok(keys.length > 20, `${locale} parsed only ${keys.length} keys — the parser, not the dictionary, is probably wrong`);
  }
  return locales;
}

test('no locale declares the same key twice', { tag: 'unit' }, async () => {
  const locales = await readLocales();
  for (const [locale, keys] of locales) {
    const seen = new Set();
    const duplicates = [];
    for (const key of keys) {
      if (seen.has(key)) duplicates.push(key);
      else seen.add(key);
    }
    assert.deepEqual(
      duplicates,
      [],
      `${locale} declares ${duplicates.join(', ')} more than once — the later value silently overwrites the earlier translation`,
    );
  }
});

test('the translator is forward-only and never renames a language', { tag: 'unit' }, async () => {
  const source = await readFile(resolve(root, 'src/runtime.js'), 'utf8');

  // The reverse map was ambiguous by construction: several English source
  // strings are also translated values of other strings, so mapping a value
  // back to English could land on the wrong key. Lookup is now one forward
  // hit, and the English original is remembered per node instead.
  assert.equal(
    /function canonicalTranslation/.test(source),
    false,
    'canonicalTranslation reintroduces a reverse scan of every dictionary',
  );
  assert.match(source, /const TEXT_SOURCE = new WeakMap\(\)/);
  assert.match(source, /const ATTRIBUTE_SOURCE = new WeakMap\(\)/);

  // A language picker that renames "Português" to "Portugués" is harder to
  // use, not easier. Endonyms must appear the same in every locale.
  for (const endonym of ['English', 'Español', 'Português']) {
    assert.equal(
      source.includes(`    '${endonym}': '`),
      false,
      `a locale translates the language name ${endonym}; language names stay as endonyms`,
    );
  }
});

test('every locale covers the same strings', { tag: 'unit' }, async () => {
  const locales = await readLocales();
  const union = new Set([...locales.values()].flat());
  for (const [locale, keys] of locales) {
    const present = new Set(keys);
    const missing = [...union].filter((key) => !present.has(key));
    assert.deepEqual(
      missing,
      [],
      `${locale} is missing ${missing.length} string(s), starting with: ${missing.slice(0, 5).join(' | ')}`,
    );
  }
});

test('no locale carries a key nothing renders', { tag: 'unit' }, async () => {
  // Dead entries cost nothing at runtime, but they hide which strings are
  // really in use and they are not free in a build that sits against a 1 MB
  // injection ceiling. Two of the twenty-five removed when this gate was
  // written turned out to be the correct wording that the visible UI had
  // drifted away from, which is the more expensive half of the problem.
  const source = await readFile(resolve(root, 'src/runtime.js'), 'utf8');
  const esStart = source.indexOf('  es: {');
  const ptStart = source.indexOf('  pt: {');
  assert.ok(esStart > 0 && ptStart > esStart, 'locale blocks not found');
  const ptEnd = source.indexOf('\n  },\n};', ptStart);
  assert.ok(ptEnd > ptStart, 'end of the pt block not found');

  // Everything that can name a key: the rest of runtime plus every other module
  // whose constants are looked up by value.
  const others = await Promise.all([
    'src/settings.mjs', 'src/multistream.mjs', 'src/core.mjs',
    'src/api.mjs', 'src/live.mjs', 'src/storage.mjs', 'src/compatibility.mjs',
    'test/i18n-coverage.test.js',
  ].map((file) => readFile(resolve(root, file), 'utf8')));
  const usage = source.slice(0, esStart) + source.slice(ptEnd) + others.join('\n');

  const keys = [...source.slice(esStart, ptStart).matchAll(/^ {4}'((?:[^'\\]|\\.)*)':/gm)]
    .map((match) => match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
  assert.ok(keys.length > 100, `parsed only ${keys.length} keys — suspect the parser, not the dictionary`);

  const dead = keys.filter((key) => !usage.includes(key));
  assert.deepEqual(dead, [],
    `${dead.length} dictionary key(s) have no call site, starting with: ${dead.slice(0, 5).map((k) => JSON.stringify(k)).join(' | ')}`);
});
