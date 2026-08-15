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

  // The three helpers that put user-facing copy on screen.
  const rendered = new Set();
  for (const m of src.matchAll(/\brow\('((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'/g)) {
    rendered.add(m[1]);
    rendered.add(m[2]);
  }
  for (const m of src.matchAll(/\bpageHeader\('((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'/g)) {
    rendered.add(m[1]);
    rendered.add(m[2]);
  }
  for (const m of src.matchAll(/\btr\('((?:[^'\\]|\\.)*)'/g)) rendered.add(m[1]);

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
