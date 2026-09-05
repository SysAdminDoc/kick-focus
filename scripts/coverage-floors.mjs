/**
 * Coverage floors, enforced rather than admired.
 *
 * `--experimental-test-coverage` prints a table and exits zero whatever is in
 * it, so a number can fall for months without anything going red. Worse, the
 * table only lists files the suite actually loaded, so a module nothing imports
 * improves the summary by being absent — which is why `test/coverage.test.js`
 * separately requires every source file to be imported or documented.
 *
 * This reads that table back and fails on a floor. Two sets of floors: the
 * whole project, and `src/settings.mjs` on its own, because it owns the main
 * control surface and was measured at 36% lines and 49% branches while the
 * project summary looked healthy. A per-file floor is what stops one large
 * file hiding behind the average.
 *
 * Floors are a ratchet, not a target. Raise them when the real number moves up
 * and stays there; never lower one to make a run pass.
 *
 *   node scripts/coverage-floors.mjs
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const GLOBAL_FLOORS = { lines: 88, branches: 85, functions: 86 };
const FILE_FLOORS = {
  'settings.mjs': { lines: 80, branches: 75, functions: 70 },
};

/**
 * The bundle, judged on its own and in its own run.
 *
 * `src/runtime.js` has no exports, so nothing imports it and it never appeared
 * in the table at all — 58% of the concatenated source, measured by nothing,
 * while the project number above looked healthy. It is not unmeasurable: the
 * eight boot tests already evaluate the built artifact, and naming the script
 * puts it in the report.
 *
 * It cannot share the run with the floors above, because the bundle contains
 * those modules: one run measuring both counts that code twice and the
 * weighted `all files` total then describes neither. Measured 2026-09-05,
 * enabling it in the same run took the project line from 96.09% to 52.83%
 * without a byte of source changing. So the suite runs twice — once as before,
 * once with `KF_COVER_BUNDLE=1` — and the two numbers are judged apart.
 *
 * These floors start at what the boot tests actually reach today. They are a
 * ratchet like the others: the way to move them is to drive more of the
 * runtime from a test, never to lower the number.
 */
const BUNDLE_FLOORS = { lines: 20, branches: 38, functions: 10 };

function run(command, args, env = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env } });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => resolvePromise({ code: code ?? 1, output }));
  });
}

/**
 * One row of Node's coverage table.
 *
 * The table is padded with spaces and separated by pipes, and the file column
 * carries a leading marker, so the row is split rather than matched with one
 * long regex that would silently stop matching the day the format shifts.
 */
function parseRow(line) {
  const cells = line.split('|').map((cell) => cell.trim());
  if (cells.length < 4) return null;
  const name = cells[0].replace(/^[^\w./\\]*/, '').trim();
  const [lines, branches, functions] = cells.slice(1, 4).map(Number);
  if (!name || ![lines, branches, functions].every(Number.isFinite)) return null;
  return { name, lines, branches, functions };
}

const { code, output } = await run(process.execPath, ['--test', '--experimental-test-coverage']);
if (code !== 0) {
  console.error(output.split('\n').filter((line) => /^ℹ (tests|fail)|^✖/.test(line)).slice(0, 12).join('\n'));
  console.error('\nThe suite failed, so coverage was not judged. Fix the tests first.');
  process.exit(code);
}

const rows = output.split('\n').map(parseRow).filter(Boolean);
const all = rows.find((row) => row.name === 'all files');
if (!all) {
  console.error('No coverage summary was produced. Did the report format change?');
  process.exit(1);
}

const failures = [];
const check = (label, row, floors) => {
  for (const metric of ['lines', 'branches', 'functions']) {
    const value = row[metric];
    const floor = floors[metric];
    const ok = value >= floor;
    console.log(`${ok ? 'OK  ' : 'LOW '} ${label} ${metric}: ${value.toFixed(2)}% (floor ${floor}%)`);
    if (!ok) failures.push(`${label} ${metric} is ${value.toFixed(2)}%, below the ${floor}% floor`);
  }
};

check('project', all, GLOBAL_FLOORS);
for (const [file, floors] of Object.entries(FILE_FLOORS)) {
  const row = rows.find((entry) => entry.name.endsWith(file));
  if (!row) {
    failures.push(`${file} is not in the coverage report at all, so its floor cannot be judged`);
    continue;
  }
  check(file, row, floors);
}

// Second run, measuring the built artifact. Separate because the bundle holds
// the same code the modules above do; see BUNDLE_FLOORS.
const bundleRun = await run(process.execPath, ['--test', '--experimental-test-coverage'], { KF_COVER_BUNDLE: '1' });
if (bundleRun.code !== 0) {
  console.error(bundleRun.output.split('\n').filter((line) => /^ℹ (tests|fail)|^✖/.test(line)).slice(0, 12).join('\n'));
  console.error('\nThe suite failed under KF_COVER_BUNDLE, so the bundle was not judged.');
  process.exit(bundleRun.code);
}
const bundleRow = bundleRun.output.split('\n').map(parseRow).filter(Boolean)
  .find((row) => row.name.endsWith('kick-focus.user.js'));
if (!bundleRow) {
  failures.push('the built bundle is not in the coverage report, so its floor cannot be judged; did the boot tests stop naming the script?');
} else {
  check('bundle', bundleRow, BUNDLE_FLOORS);
}

if (failures.length) {
  console.error('\nCoverage fell below a floor:');
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('\nRaise the coverage, not the floor.');
  process.exit(1);
}
console.log('\nEvery coverage floor holds.');
