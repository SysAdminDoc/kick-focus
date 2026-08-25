/**
 * Refuse to judge a build older than the sources it came from.
 *
 * `npm test` runs `node --test` and nothing else, but a third of the suite
 * reads `dist/`. After any source edit those tests were judging the *previous*
 * build, so they could report green on code that had never been built and red
 * on code that was already fixed. That is worse than no coverage: it is
 * coverage that lies in both directions, and it cost a real debugging session
 * on 2026-08-25 when a fix looked like it had not worked.
 *
 * Called at module scope by every test file that reads `dist/`, so a stale
 * artifact fails that file immediately and by name instead of asserting
 * against it. A fresh clone trips this too, because `dist/` is tracked but
 * generated and a checkout can write it before it writes `src/`; the fix is
 * the same either way, and the message says so.
 */
import { readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Everything the bundle is composed from: the sources themselves, and the two
// scripts that decide how they are composed.
const INPUTS = ['src', 'scripts/build.mjs', 'scripts/strip-comments.mjs', 'scripts/icons.mjs'];
const ARTIFACT = 'dist/kick-focus.user.js';

async function newestInput() {
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
  for (const input of INPUTS) await visit(input);
  return newest;
}

export async function assertArtifactFresh() {
  let built;
  try {
    built = await stat(resolve(root, ARTIFACT));
  } catch {
    throw new Error(`${ARTIFACT} has not been built. Run: npm run build`);
  }
  const newest = await newestInput();
  if (newest.mtimeMs <= built.mtimeMs) return;
  throw new Error(
    `${ARTIFACT} is older than ${newest.path}, so the artifact tests would be judging the previous build. Run: npm run build`,
  );
}
