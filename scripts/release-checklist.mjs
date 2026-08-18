/**
 * Release gate for the two supported desktop viewports.
 *
 * The offline artifact/tests run first. If Chromium is available, the live
 * extension proof is then repeated at 1440x900 and 1920x1080 and captures a
 * screenshot for the visual comparison step in the release checklist.
 */

import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
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

const summaryPath = join(screenshotRoot, 'live-summary.json');
for (const [label, size, file] of [
  ['primary', '1440,900', 'kick-focus-1440x900.png'],
  ['secondary', '1920,1080', 'kick-focus-1920x1080.png'],
]) {
  console.log(`\nRelease checklist: ${label} viewport ${size.replace(',', '×')}`);
  const code = await run(process.execPath, ['scripts/verify-extension.mjs'], {
    KF_WINDOW_SIZE: size,
    KF_SCREENSHOT_PATH: join(screenshotRoot, file),
    KF_SUMMARY_PATH: summaryPath,
    KF_HEADLESS: '',
  });
  if (code !== 0) process.exit(code || 1);
}

/**
 * The README advertises the live-check result, and for two days it advertised a
 * number the gate had already grown past — the one figure a reader uses to judge
 * whether any of this means anything. Nothing owned it, so it drifted silently.
 *
 * A static count of `record(` call sites is not the answer either: some probes
 * sit in route-dependent branches, so the source says 56 where a run says 57.
 * This compares against the run that just happened.
 */
const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
const readme = await readFile(resolve(root, 'README.md'), 'utf8');
const claimed = readme.match(/(\d+)\/(\d+) live checks pass/);
if (!claimed) {
  console.error('README no longer states a live-check result; the release gate cannot verify it.');
  process.exit(1);
}
// Deliberately *not* an exact match against this run's total. How many checks
// assert depends on what Kick rendered — a channel URL exercises probes the home
// page skips, and a rate-limited endpoint read turns one assertion into a skip —
// so pinning the README to one run's arithmetic would make it fail for reasons
// that are not defects, which is the whole failure mode this release just fixed.
//
// What must hold is the claim the number is actually making: that the gate is
// green, and that the README is not advertising a partial pass as a full one.
if (Number(claimed[1]) !== Number(claimed[2])) {
  console.error(`README advertises a partial pass (${claimed[1]}/${claimed[2]}); state a figure where every asserted check passed.`);
  process.exit(1);
}
if (summary.passed !== summary.asserted) {
  console.error(`This run was ${summary.passed}/${summary.asserted}; the README may not claim a clean sweep.`);
  process.exit(1);
}
console.log(`\nREADME claims ${claimed[1]}/${claimed[2]}; this run asserted ${summary.passed}/${summary.asserted}${summary.skipped ? ` with ${summary.skipped} skipped` : ''}. Update the README if the figure has moved.`);

// The Firefox package is a separate engine with its own network layer, and it
// had never been executed anywhere until this gate existed. Skipped rather than
// failed when no Firefox is installed, matching the Chromium gate's contract.
console.log('\nRelease checklist: Firefox companion');
const firefox = await run(process.execPath, ['scripts/verify-firefox.mjs'], { KF_ALLOW_NO_FIREFOX: '1' });
if (firefox !== 0) process.exit(firefox || 1);

console.log(`\nRelease screenshots, when live Kick was reachable: ${screenshotRoot}`);
console.log('Compare both captures with the current design references and inspect for overflow, clipped controls, and changed shell geometry before publishing.');
console.log('The live checks fail the release gate when Chromium is absent (set KF_ALLOW_NO_CHROMIUM=1 to downgrade to a skip); the offline gate above is always authoritative.');
