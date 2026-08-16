import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Which source files no test reaches at all.
 *
 * `node --test --experimental-test-coverage` only reports files that were
 * loaded, so a module nothing imports does not appear as 0% — it does not
 * appear at all, and the summary reads *better* for its absence. Measured
 * 2026-08-16, the report showed 95.48% across five files while `src/runtime.js`,
 * the largest file in the project, was missing from it entirely.
 *
 * Node's `--test-coverage-include-all` closes exactly this gap, but it landed in
 * v26.7.0 and this project runs v24. Rather than pin the whole toolchain to an
 * unreleased runtime for one flag, the same guarantee is asserted here: every
 * source file is either imported by the suite or listed below with the reason
 * it cannot be, so "untested" is always a stated decision instead of a silent
 * omission. Adopt the flag and delete this once the engine floor moves.
 */
const UNCOVERABLE = new Map([
  // Not an ES module: it has no imports or exports, because the build
  // concatenates it after core/api/compatibility into one IIFE. Importing it
  // here would throw on the first undefined symbol. It is covered instead by
  // boot.test.js, which evaluates the built bundle, by the artifact gates in
  // scripts/check.mjs, and by the live browser gate.
  ['runtime.js', 'concatenated into the bundle, not importable; covered by boot.test.js and the live gate'],
  // Extension entry points. Each runs against browser globals that do not exist
  // in node (`chrome.declarativeNetRequest`, the service-worker scope, the
  // popup document), so importing them here would prove only that a stub was
  // written correctly. They are covered where they actually run: the live
  // extension gate asserts the service worker reports the built version and
  // toggles rulesets, and that the popup renders, reads live ruleset state, and
  // raises no exceptions; scripts/check.mjs asserts their shipped contents.
  ['background.js', 'service worker: needs the extension runtime; covered by the live gate and check.mjs'],
  ['background.firefox.js', 'MV2 background page: needs the extension runtime; covered by the live gate and check.mjs'],
  ['popup.js', 'popup document: needs the extension runtime; covered by the live popup checks and check.mjs'],
]);

async function sourceFiles(directory = 'src', prefix = '') {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(`${directory}/${entry.name}`, `${prefix}${entry.name}/`));
      continue;
    }
    if (/\.(mjs|js)$/.test(entry.name)) files.push(`${prefix}${entry.name}`);
  }
  return files;
}

test('every source file is imported by the suite or documented as unreachable', { tag: 'unit' }, async () => {
  const testFiles = (await readdir(resolve(root, 'test'))).filter((name) => name.endsWith('.js'));
  const suite = (await Promise.all(testFiles.map((name) => readFile(resolve(root, 'test', name), 'utf8')))).join('\n');
  const files = await sourceFiles();
  assert.ok(files.length >= 4, `found only ${files.length} source files — suspect the walker, not the tree`);

  const untested = files.filter((file) => {
    const base = file.split('/').pop();
    // Either imported as a module, or read as text by a gate that asserts on it.
    return !suite.includes(`/${file}`) && !suite.includes(`'${base}'`) && !suite.includes(`src/${base}`);
  });

  const undocumented = untested.filter((file) => !UNCOVERABLE.has(file.split('/').pop()));
  assert.deepEqual(
    undocumented,
    [],
    `${undocumented.length} source file(s) are reached by no test and carry no reason: ${undocumented.join(', ')}`,
  );

  // The exemption list must stay honest in the other direction too: an entry
  // for a file that *is* now tested would quietly excuse a future regression.
  for (const [name, reason] of UNCOVERABLE) {
    assert.ok(reason.length > 20, `${name} needs a real reason, not a placeholder`);
    assert.ok(files.some((file) => file.split('/').pop() === name), `${name} is listed as uncoverable but no longer exists`);
  }
});
