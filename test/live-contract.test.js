import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MANDATORY_CHROMIUM_CHECKS,
  MANDATORY_FIREFOX_CHECKS,
  mandatoryLiveFailures,
} from '../scripts/live-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('a run that skipped a check it may not skip cannot be packaged', { tags: ['unit'] }, () => {
  const mandatory = ['loaded', 'booted'];

  assert.deepEqual(
    mandatoryLiveFailures([{ label: 'loaded', outcome: 'pass' }, { label: 'booted', outcome: 'pass' }], mandatory),
    [],
    'a clean run was refused',
  );

  // The failure this exists for: v1.38.0 went out on a run where checks had
  // stopped asserting, and a skip looked exactly like a legitimate one.
  assert.deepEqual(
    mandatoryLiveFailures([{ label: 'loaded', outcome: 'pass' }, { label: 'booted', outcome: 'skip' }], mandatory),
    ['skip: booted'],
  );
  assert.deepEqual(
    mandatoryLiveFailures([{ label: 'loaded', outcome: 'fail' }, { label: 'booted', outcome: 'pass' }], mandatory),
    ['fail: loaded'],
  );

  // A check that never reported at all is the loudest case: the gate stopped
  // early, or the assertion was deleted. Silence must not read as success.
  assert.deepEqual(mandatoryLiveFailures([{ label: 'loaded', outcome: 'pass' }], mandatory), ['never ran: booted']);
  assert.deepEqual(mandatoryLiveFailures([], mandatory), ['never ran: loaded', 'never ran: booted']);
  assert.deepEqual(mandatoryLiveFailures(null, mandatory), ['never ran: loaded', 'never ran: booted']);
  assert.deepEqual(mandatoryLiveFailures([null, 'nonsense', { outcome: 'pass' }], mandatory),
    ['never ran: loaded', 'never ran: booted']);

  // First outcome wins, so a later duplicate label cannot launder an earlier
  // skip into a pass.
  assert.deepEqual(
    mandatoryLiveFailures([
      { label: 'loaded', outcome: 'skip' },
      { label: 'loaded', outcome: 'pass' },
      { label: 'booted', outcome: 'pass' },
    ], mandatory),
    ['skip: loaded'],
  );
});

test('every mandatory live check names an assertion its gate actually makes', { tags: ['unit'] }, async () => {
  // A renamed label would otherwise turn the contract into "never ran" and fail
  // every release for a reason that is not a defect. This is the pairing that
  // keeps the two lists honest with each other.
  const chromium = await readFile(resolve(root, 'scripts/verify-extension.mjs'), 'utf8');
  const firefox = await readFile(resolve(root, 'scripts/verify-firefox.mjs'), 'utf8');

  assert.ok(MANDATORY_CHROMIUM_CHECKS.length >= 8);
  assert.ok(MANDATORY_FIREFOX_CHECKS.length >= 6);
  for (const label of MANDATORY_CHROMIUM_CHECKS) {
    assert.ok(chromium.includes(label), `the Chromium gate no longer makes an assertion labelled: ${label}`);
  }
  for (const label of MANDATORY_FIREFOX_CHECKS) {
    assert.ok(firefox.includes(label), `the Firefox gate no longer makes an assertion labelled: ${label}`);
  }
});

test('the release command applies the contract to both engines and refuses to package', { tags: ['unit'] }, async () => {
  // The decision is unit-tested above; this is the wiring, which can only be
  // observed here without spawning two browsers. Each engine has to be checked
  // and each has to stop the run, and the Chromium check has to sit inside the
  // viewport loop rather than after it: one summary path shared by both runs
  // would only ever describe the second.
  const checklist = await readFile(resolve(root, 'scripts/release-checklist.mjs'), 'utf8');

  assert.match(checklist, /mandatoryLiveFailures\(viewportSummary\.results, MANDATORY_CHROMIUM_CHECKS\)/);
  assert.match(checklist, /mandatoryLiveFailures\(firefoxSummary\.results, MANDATORY_FIREFOX_CHECKS\)/);

  const loop = checklist.slice(
    checklist.indexOf("for (const [label, size, file] of ["),
    checklist.indexOf('const summary = JSON.parse'),
  );
  assert.ok(loop.includes('MANDATORY_CHROMIUM_CHECKS'), 'the viewport loop does not apply the contract per run');
  assert.ok(
    /live-summary-\$\{size\.replace/.test(loop),
    'both viewports write one shared summary, so only the last one is judged',
  );

  // Two refusals, one per engine, and both must exit nonzero.
  assert.equal((checklist.match(/A release may not be packaged on this run\./g) || []).length, 2);
  assert.equal((checklist.match(/process\.exit\(1\);/g) || []).length >= 2, true);

  // And the Firefox gate has to actually write the summary the check reads.
  const firefoxGate = await readFile(resolve(root, 'scripts/verify-firefox.mjs'), 'utf8');
  assert.match(firefoxGate, /process\.env\.KF_SUMMARY_PATH/);
  assert.match(firefoxGate, /results: results\.map\(\(entry\) => \(\{ label: entry\.label, outcome: entry\.outcome \}\)\)/);
});

test('the release command cannot package without having run Firefox', { tags: ['unit'] }, async () => {
  // It used to spawn the Firefox gate with KF_ALLOW_NO_FIREFOX always set and
  // treat a missing summary as a pass, so a machine with no Firefox packaged a
  // release having never executed that package — while the same command refuses
  // a Chromium run that merely skipped a check. That gate is also the only
  // thing that proves the page bundle runs in the page world at all.
  const checklist = await readFile(resolve(root, 'scripts/release-checklist.mjs'), 'utf8');

  assert.ok(!/KF_ALLOW_NO_FIREFOX: '1',/.test(checklist),
    'the Firefox gate is still told unconditionally that a missing Firefox is fine');
  assert.match(checklist, /firefoxOptional \? '1' : ''/);
  // Absent and not asked for is a refusal, with an exit code.
  const tail = checklist.slice(checklist.indexOf('firefoxSummary'));
  assert.match(tail, /never exercised/);
  assert.match(tail, /process\.exit\(1\)/);
  // Asked for, it says what it did not prove rather than going quiet.
  assert.match(tail, /NOT exercised by this run/);
});
