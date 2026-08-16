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
