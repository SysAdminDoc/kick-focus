/**
 * Release gate for the two supported desktop viewports.
 *
 * The offline artifact/tests run first. If Chromium is available, the live
 * extension proof is then repeated at 1440x900 and 1920x1080 and captures a
 * screenshot for the visual comparison step in the release checklist.
 */

import { mkdir, mkdtemp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const screenshotRoot = resolve(process.env.KF_RELEASE_SCREENSHOT_DIR || await mkdtemp(join(tmpdir(), 'kick-focus-release-')));
await mkdir(screenshotRoot, { recursive: true });

function run(command, args, env = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolvePromise(code ?? (signal ? 1 : 0)));
  });
}

console.log('Release checklist: offline verification');
const build = await run(process.execPath, ['scripts/build.mjs']);
if (build !== 0) process.exit(build || 1);
const offline = await run(process.execPath, ['scripts/check.mjs']);
if (offline !== 0) process.exit(offline || 1);
const tests = await run(process.execPath, ['--test']);
if (tests !== 0) process.exit(tests || 1);

for (const [label, size, file] of [
  ['primary', '1440,900', 'kick-focus-1440x900.png'],
  ['secondary', '1920,1080', 'kick-focus-1920x1080.png'],
]) {
  console.log(`\nRelease checklist: ${label} viewport ${size.replace(',', '×')}`);
  const code = await run(process.execPath, ['scripts/verify-extension.mjs'], {
    KF_WINDOW_SIZE: size,
    KF_SCREENSHOT_PATH: join(screenshotRoot, file),
    KF_HEADLESS: '',
  });
  if (code !== 0) process.exit(code || 1);
}

console.log(`\nRelease screenshots, when live Kick was reachable: ${screenshotRoot}`);
console.log('Compare both captures with the current design references and inspect for overflow, clipped controls, and changed shell geometry before publishing.');
console.log('If Chromium is unavailable, the live checks print SKIP; the offline gate above still remains authoritative.');
