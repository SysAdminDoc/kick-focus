/**
 * Release gate for the two supported desktop viewports.
 *
 * The offline artifact/tests run first. If Chromium is available, the live
 * extension proof is then repeated at 1440x900 and 1920x1080 and captures a
 * screenshot for the visual comparison step in the release checklist.
 *
 * The live runs are headed on purpose: several checks measure real layout and
 * real paint. Headed used to mean *on top of whatever the operator was doing*,
 * for the length of two full runs, with no way to stop it but killing the
 * process. So the window is parked off-screen by default. Set
 * KF_WINDOW_POSITION yourself to watch a run.
 */

import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SIGNED_IN_JOURNEYS } from './signed-in-journeys.mjs';
import { MANDATORY_CHROMIUM_CHECKS, MANDATORY_FIREFOX_CHECKS, mandatoryLiveFailures } from './live-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Far enough left of every real display to be off all of them, and the same
// coordinates the repo's own docs use for an unattended run.
const WINDOW_POSITION = process.env.KF_WINDOW_POSITION || '-32000,-32000';
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

/**
 * A skip is a legitimate answer to most of what the live gate covers, so the
 * gate's own exit code tolerates them. The cost is that an assertion which
 * stopped asserting for a bad reason looks exactly like one that skipped for a
 * good one, which is how v1.38.0 shipped on a run of 90 of 96. The checks that
 * cannot skip for an environmental reason are named in live-contract.mjs and
 * are required to pass, at each viewport separately: a summary written to one
 * shared path would only ever describe the last run.
 */
let summaryPath = '';
for (const [label, size, file] of [
  ['primary', '1440,900', 'kick-focus-1440x900.png'],
  ['secondary', '1920,1080', 'kick-focus-1920x1080.png'],
]) {
  console.log(`\nRelease checklist: ${label} viewport ${size.replace(',', '×')}`);
  summaryPath = join(screenshotRoot, `live-summary-${size.replace(',', 'x')}.json`);
  const code = await run(process.execPath, ['scripts/verify-extension.mjs'], {
    KF_WINDOW_SIZE: size,
    KF_SCREENSHOT_PATH: join(screenshotRoot, file),
    KF_SUMMARY_PATH: summaryPath,
    KF_HEADLESS: '',
    KF_WINDOW_POSITION: WINDOW_POSITION,
  });
  if (code !== 0) process.exit(code || 1);
  const viewportSummary = JSON.parse(await readFile(summaryPath, 'utf8'));
  const problems = mandatoryLiveFailures(viewportSummary.results, MANDATORY_CHROMIUM_CHECKS);
  if (problems.length) {
    console.error(`\nThe ${label} viewport did not assert every check a release requires:`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('A release may not be packaged on this run.');
    process.exit(1);
  }
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

/**
 * What the run just did, and did not, cover behind a session.
 *
 * The live gate runs logged out, so the signed-in journeys come back as skips
 * unless the operator pointed it at a profile that is already signed in. A
 * release that does not say which of the two happened reads as though
 * everything was exercised. This prints the matrix either way.
 */
const signedInResults = Array.isArray(summary.results)
  ? summary.results.filter((entry) => entry.label.startsWith('signed-in journey: '))
  : [];
const asserted = signedInResults.filter((entry) => entry.outcome !== 'skip');
console.log(`
Release checklist: signed-in journeys (${asserted.length}/${SIGNED_IN_JOURNEYS.length} asserted by this run)`);
for (const journey of SIGNED_IN_JOURNEYS) {
  const result = signedInResults.find((entry) => entry.label === `signed-in journey: ${journey.title}`);
  const state = !result ? 'NOT RUN' : result.outcome === 'skip' ? 'SKIPPED' : result.outcome.toUpperCase();
  console.log(`  ${state.padEnd(8)} ${journey.title} (${journey.route}) — needs a session because ${journey.why}`);
}
if (asserted.length < SIGNED_IN_JOURNEYS.length) {
  console.log('  Re-run with KF_USER_DATA_DIR pointing at a signed-in Chromium profile to assert these instead of skipping them.');
  console.log('  Every check above is read-only; scripts/check.mjs proves the only account writes in the build are the follow gesture and its undo.');
}

// The Firefox package is a separate engine with its own network layer, and it
// had never been executed anywhere until this gate existed. Skipped rather than
// failed when no Firefox is installed, matching the Chromium gate's contract.
console.log('\nRelease checklist: Firefox companion');
const firefoxSummaryPath = join(screenshotRoot, 'firefox-summary.json');
const firefox = await run(process.execPath, ['scripts/verify-firefox.mjs'], {
  KF_ALLOW_NO_FIREFOX: '1',
  KF_SUMMARY_PATH: firefoxSummaryPath,
});
if (firefox !== 0) process.exit(firefox || 1);
// A machine with no Firefox skips the whole gate, which is the documented
// contract; anything else has to have asserted the package really loaded and
// really kept its extension URL out of the page.
const firefoxSummary = await readFile(firefoxSummaryPath, 'utf8').then(JSON.parse, () => null);
if (firefoxSummary) {
  const problems = mandatoryLiveFailures(firefoxSummary.results, MANDATORY_FIREFOX_CHECKS);
  if (problems.length) {
    console.error('\nThe Firefox run did not assert every check a release requires:');
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('A release may not be packaged on this run.');
    process.exit(1);
  }
} else {
  console.log('  No Firefox summary was written, so this machine has no Firefox and the gate skipped.');
}

console.log(`\nRelease screenshots, when live Kick was reachable: ${screenshotRoot}`);
console.log('Compare both captures with the current design references and inspect for overflow, clipped controls, and changed shell geometry before publishing.');
console.log('The live checks fail the release gate when Chromium is absent (set KF_ALLOW_NO_CHROMIUM=1 to downgrade to a skip); the offline gate above is always authoritative.');
