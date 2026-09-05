/**
 * The byte report, checked for the two properties the gate leans on.
 *
 * It exists because `scripts/check.mjs` enforces one number — the injected
 * footprint against the budget — and that number is a cliff. It says nothing
 * until the day it says no, and then somebody has to work out by hand which
 * part of the build spent the room. These tests cover the parts of that
 * measurement a wrong answer would be invisible in: that the regions sum to
 * the whole, and that the comparison actually fails on growth.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareToBaseline, measureRegions, REGION_GROWTH_ALLOWANCE, byteLength } from '../scripts/byte-report.mjs';

test('the parts sum to the whole, so no region can hide in the remainder', { tags: ['unit'] }, () => {
  const source = 'const A_CSS = `body{color:red}`;\nconst TRANSLATIONS = { a: [1, 2] };\nconst other = 1;\n';
  const measurement = measureRegions(source);
  const summed = measurement.regions.reduce((sum, region) => sum + region.bytes, 0);
  assert.equal(summed, measurement.total);
  assert.equal(measurement.total, byteLength(source));
});

test('regions are derived, so a newly added sheet is measured without being listed', { tags: ['unit'] }, () => {
  const before = measureRegions('const A_CSS = `a{}`;\n');
  const after = measureRegions('const A_CSS = `a{}`;\nconst BRAND_NEW_CSS = `b{}`;\n');
  assert.equal(before.regions.some((region) => region.name === 'BRAND_NEW_CSS'), false);
  assert.equal(after.regions.some((region) => region.name === 'BRAND_NEW_CSS'), true);
});

test('a template holding a backtick escape is measured to its real end', { tags: ['unit'] }, () => {
  // A naive scan for the next backtick would stop inside the literal and
  // report a region shorter than it is, which is the direction that hides
  // growth rather than inventing it.
  const source = 'const A_CSS = `a{content:"\\`"}`;\nconst tail = 1;\n';
  const region = measureRegions(source).regions.find((entry) => entry.name === 'A_CSS');
  assert.ok(region.bytes > byteLength('const A_CSS = `a{content:"'),
    `A_CSS measured only ${region.bytes} B, so the escape ended the span early`);
});

test('measuring counts bytes, not characters', { tags: ['unit'] }, () => {
  // The es and pt dictionaries carry about 1,450 non-ASCII characters, and a
  // userscript manager injects bytes. Measuring length here understated the
  // real figure by 1.7 KB the last time it was done that way.
  const source = 'const TRANSLATIONS = { a: ["ñ", "ã"] };\n';
  const region = measureRegions(source).regions.find((entry) => entry.name === 'TRANSLATIONS');
  assert.equal(region.bytes, byteLength('const TRANSLATIONS = { a: ["ñ", "ã"] }'));
  assert.ok(region.bytes > 'const TRANSLATIONS = { a: ["ñ", "ã"] }'.length);
});

test('growth past the allowance fails, and shrinking never does', { tags: ['unit'] }, () => {
  const baseline = { regions: [{ name: 'UI_CSS', bytes: 1000 }] };
  assert.deepEqual(compareToBaseline({ total: 0, regions: [{ name: 'UI_CSS', bytes: 1000 + REGION_GROWTH_ALLOWANCE }] }, baseline), [],
    'growth exactly at the allowance is allowed');
  assert.equal(compareToBaseline({ total: 0, regions: [{ name: 'UI_CSS', bytes: 1001 + REGION_GROWTH_ALLOWANCE }] }, baseline).length, 1,
    'one byte past the allowance is not');
  assert.deepEqual(compareToBaseline({ total: 0, regions: [{ name: 'UI_CSS', bytes: 1 }] }, baseline), [],
    'shrinking is always free');
});

test('a region the baseline has never seen is a finding, not a pass', { tags: ['unit'] }, () => {
  // The case the derived region list exists for: somebody adds a stylesheet,
  // and the point is that nobody has to remember to declare it.
  const failures = compareToBaseline({ total: 0, regions: [{ name: 'NEW_CSS', bytes: 10 }] }, { regions: [] });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /NEW_CSS/);
});

test('a region that left the artifact is also a finding', { tags: ['unit'] }, () => {
  const failures = compareToBaseline({ total: 0, regions: [] }, { regions: [{ name: 'GONE_CSS', bytes: 10 }] });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /GONE_CSS/);
});

test('an empty or missing baseline reports every region rather than passing silently', { tags: ['unit'] }, () => {
  const measurement = { total: 0, regions: [{ name: 'A_CSS', bytes: 1 }, { name: 'B_CSS', bytes: 2 }] };
  assert.equal(compareToBaseline(measurement, undefined).length, 2);
  assert.equal(compareToBaseline(measurement, {}).length, 2);
});
