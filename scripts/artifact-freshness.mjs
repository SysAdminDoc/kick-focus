/**
 * Refuse to judge a build older than the sources it came from.
 *
 * `npm test` used to run `node --test` and nothing else, but a third of the
 * suite reads `dist/`. After any source edit those tests were judging the
 * *previous* build, so they could report green on code that had never been
 * built and red on code that was already fixed. That is worse than no
 * coverage: it lies in both directions, and it cost a real debugging session
 * on 2026-08-25 when a fix looked like it had not worked.
 *
 * The check hangs off the read rather than off module scope. A guard at module
 * scope throws while the file is still loading, which takes the *unit* tests in
 * that file down with it — `--experimental-test-tag-filter` chooses which tests
 * run, not which files load. `npm run test:unit` is meant to work without a
 * build at all, and on a fresh clone `dist/` is checked out before `src/`, so
 * module scope was the one place this must not live.
 *
 * A fresh clone still trips it on the artifact tests, which is correct and the
 * message says what to do.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Everything the build reads: the sources, and the scripts that decide how they
// are composed. scripts/zip.mjs belongs here because build.mjs imports it and
// the archives are artifacts the tests can read.
const INPUTS = ['src', 'scripts/build.mjs', 'scripts/strip-comments.mjs', 'scripts/icons.mjs', 'scripts/zip.mjs', 'scripts/engine.mjs', 'scripts/byte-report.mjs'];

// Every built file the suite judges. The userscript is written first and the
// companion trees afterwards, so a build that dies in between leaves the
// extensions stale while the userscript looks current. The oldest one decides.
const ARTIFACTS = [
  'dist/kick-focus.user.js',
  'dist/extension/background.js',
  'dist/extension-firefox/background.js',
];

async function newestInput(root, inputs) {
  let newest = { path: '', mtimeMs: 0 };
  const visit = async (relative) => {
    const absolute = resolve(root, relative);
    const info = await stat(absolute);
    if (info.isDirectory()) {
      for (const entry of await readdir(absolute)) await visit(join(relative, entry));
      return;
    }
    // Reported with forward slashes so the message reads the same on every
    // platform and matches how the repo's own docs spell these paths.
    if (info.mtimeMs > newest.mtimeMs) newest = { path: relative.replaceAll('\\', '/'), mtimeMs: info.mtimeMs };
  };
  for (const input of inputs) await visit(input);
  return newest;
}

async function oldestArtifact(root, artifacts) {
  let oldest = { path: '', mtimeMs: Infinity };
  for (const relative of artifacts) {
    let info;
    try {
      info = await stat(resolve(root, relative));
    } catch {
      throw new Error(`${relative} has not been built. Run: npm run build`);
    }
    if (info.mtimeMs < oldest.mtimeMs) oldest = { path: relative, mtimeMs: info.mtimeMs };
  }
  return oldest;
}

export async function assertArtifactFresh({ root = repoRoot, inputs = INPUTS, artifacts = ARTIFACTS } = {}) {
  const built = await oldestArtifact(root, artifacts);
  const newest = await newestInput(root, inputs);
  if (newest.mtimeMs <= built.mtimeMs) return;
  throw new Error(
    `${built.path} is older than ${newest.path}, so the artifact tests would be judging the previous build. Run: npm run build`,
  );
}

/**
 * Read a built file, having first refused to read a stale one.
 *
 * Every artifact-tagged test goes through here rather than through `readFile`
 * directly, so the guard cannot be forgotten by a test that arrives later.
 */
export async function readArtifact(relative, options) {
  await assertArtifactFresh(options);
  return readFile(resolve(options?.root ?? repoRoot, relative), 'utf8');
}
