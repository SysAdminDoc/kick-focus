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

  const names = source.match(/const LOCALES = \[([^\]]*)\]/);
  assert.ok(names, 'LOCALES list not found');
  const order = [...names[1].matchAll(/'(\w+)'/g)].map((match) => match[1]);
  assert.ok(order.length >= 2, `expected at least two locales, found ${order.join(', ')}`);

  // One row per string now, so a key can only be declared once per row and the
  // per-locale lists are built by position rather than by block. A duplicate
  // key is still legal JavaScript with the later value silently winning, which
  // is why this parses the literal instead of importing it.
  const locales = new Map(order.map((name) => [name, []]));
  for (const line of source.slice(start).split('\n')) {
    if (/^\};/.test(line)) break;
    const entry = line.match(/^ {2}'((?:[^'\\]|\\.)*)': \[(.*)\],$/);
    if (!entry) continue;
    const values = [...entry[2].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
    assert.equal(values.length, order.length,
      `${entry[1]} carries ${values.length} translations for ${order.length} locales`);
    order.forEach((name, index) => {
      // An empty string is no translation at all, and would render as blank
      // rather than falling back to English.
      assert.notEqual(values[index], '', `${name} has an empty translation for ${entry[1]}`);
      locales.get(name).push(entry[1]);
    });
  }

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
      source.includes(`  '${endonym}': [`),
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
  const start = source.indexOf('const TRANSLATIONS = {');
  assert.ok(start > 0, 'TRANSLATIONS literal not found');
  const end = source.indexOf('\n};', start);
  assert.ok(end > start, 'end of the dictionary not found');

  // Everything that can name a key: the rest of runtime plus every other module
  // whose constants are looked up by value.
  const others = await Promise.all([
    'src/settings.mjs', 'src/multistream.mjs', 'src/core.mjs',
    'src/api.mjs', 'src/live.mjs', 'src/storage.mjs', 'src/compatibility.mjs',
    'test/i18n-coverage.test.js',
  ].map((file) => readFile(resolve(root, file), 'utf8')));
  const usage = source.slice(0, start) + source.slice(end) + others.join('\n');

  const keys = [...source.slice(start, end).matchAll(/^ {2}'((?:[^'\\]|\\.)*)': \[/gm)]
    .map((match) => match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
  assert.ok(keys.length > 100, `parsed only ${keys.length} keys — suspect the parser, not the dictionary`);

  // A whole string, never a substring. Plain `includes` kept short keys alive
  // on any longer string that happened to contain them: 'Delete' was certified
  // by `Delete (${count})`, which never matches the key and renders in English,
  // and one key was kept alive by being the prefix of a longer sentence that
  // had replaced it on screen. A key is live when it appears as a complete
  // quoted literal, or as the complete text of a markup node.
  const live = (key) => {
    const quoted = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    // A key whose text node the parser will decode is written entity-encoded in
    // the markup. The dictionary has to hold the decoded form, because that is
    // what `localizeInterface` looks up, so the search for a call site has to
    // look for the encoded one.
    const markup = key.replaceAll('&', '&amp;');
    return usage.includes(`'${quoted}'`)
      || usage.includes(`\`${key}\``)
      || usage.includes(`>${key}<`)
      || usage.includes(`>${markup}<`)
      // A label that follows an inline icon: `${uiIcon('reset')}Reset page<`.
      // The text node is still the whole key; what precedes it is the close of
      // an interpolation rather than a tag.
      || usage.includes(`}${key}<`)
      || usage.includes(`}${markup}<`)
      || usage.includes(`"${key}"`);
  };
  const dead = keys.filter((key) => !live(key));
  assert.deepEqual(dead, [],
    `${dead.length} dictionary key(s) have no call site, starting with: ${dead.slice(0, 5).map((k) => JSON.stringify(k)).join(' | ')}`);
});

test('the shipped dictionary resolves, in the shape the translator reads', { tag: 'artifact' }, async () => {
  // Evaluated from the artifact rather than imported, because the shape and the
  // lookup have to agree in the file a user actually installs. When the two
  // per-locale maps were collapsed into one row per string, a parser that only
  // read the source would have gone on passing over an artifact that resolved
  // nothing.
  const src = await readFile(resolve(root, 'dist/kick-focus.user.js'), 'utf8');
  const localesAt = src.indexOf('const LOCALES = [');
  const dictAt = src.indexOf('const TRANSLATIONS = {');
  assert.ok(localesAt > 0 && dictAt > localesAt, 'the dictionary literal is not in the artifact');
  const literal = src.slice(localesAt, src.indexOf('\n};', dictAt) + 3);
  // eslint-disable-next-line no-new-func
  const { LOCALES, TRANSLATIONS } = new Function(`${literal}; return { LOCALES, TRANSLATIONS };`)();

  const tr = (value, locale) => {
    const source = String(value);
    const index = LOCALES.indexOf(locale);
    return (index === -1 ? '' : TRANSLATIONS[source]?.[index]) || source;
  };

  assert.ok(LOCALES.length >= 2, `only ${LOCALES.length} locale(s) shipped`);
  assert.ok(Object.keys(TRANSLATIONS).length > 500, 'the shipped dictionary is far smaller than the source');

  // Every row carries one non-empty value per locale. A blank would render as
  // nothing rather than falling back to English, which is the failure mode a
  // positional array introduces and a per-locale map could not have.
  for (const [key, row] of Object.entries(TRANSLATIONS)) {
    assert.ok(Array.isArray(row) && row.length === LOCALES.length,
      `${JSON.stringify(key)} carries ${row?.length} values for ${LOCALES.length} locales`);
    row.forEach((value, index) => {
      assert.ok(typeof value === 'string' && value.trim(),
        `${JSON.stringify(key)} has no ${LOCALES[index]} translation`);
    });
  }

  assert.equal(tr('Home', 'es'), 'Inicio');
  assert.equal(tr('Home', 'pt'), 'Início');
  // English is not a row: it is the key, so it falls through unchanged.
  assert.equal(tr('Home', 'en'), 'Home');
  assert.equal(tr('Not a key at all', 'es'), 'Not a key at all');
  // A locale nobody ships falls through rather than resolving by position.
  assert.equal(tr('Home', 'fr'), 'Home');
});
