/**
 * The signed-in journey matrix, checked for the two properties it promises.
 *
 * The live gate runs logged out, so nothing here can prove Kick renders what
 * the matrix says it renders — only a signed-in run does that, and the gate
 * says so out loud, one skip per journey. What is checkable offline is that the
 * matrix is honest: every journey is read-only, every one says why a session is
 * needed in words somebody can act on, and no entry carries anything personal.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ONLY_ACCOUNT_WRITE, SIGNED_IN_JOURNEYS } from '../scripts/signed-in-journeys.mjs';

const EXPECTED_JOURNEYS = [
  'account-menu', 'daily-reward', 'profile', 'preferences',
  'notifications', 'drops', 'collectibles', 'emote-catalog',
];

test('the matrix covers every signed-in surface this build touches', { tags: ['unit'] }, () => {
  const ids = SIGNED_IN_JOURNEYS.map((journey) => journey.id);
  assert.deepEqual([...ids].sort(), [...EXPECTED_JOURNEYS].sort());
  assert.equal(new Set(ids).size, ids.length, 'two journeys share an id');
});

test('every journey is read-only, and the build has no write it could reach', { tags: ['unit'] }, () => {
  for (const journey of SIGNED_IN_JOURNEYS) {
    assert.equal(journey.mutates, false, `${journey.id} is not declared read-only`);
    for (const read of journey.reads) {
      assert.ok(/^(DOM: |GET )/.test(read), `${journey.id} reads "${read}", which is neither a DOM read nor a GET`);
    }
  }
  // The escape hatch, named so the claim above can be falsified rather than
  // merely asserted: the follow gesture and its undo, reachable from no journey.
  assert.deepEqual([...ONLY_ACCOUNT_WRITE.methods].sort(), ['DELETE', 'POST']);
  assert.deepEqual(ONLY_ACCOUNT_WRITE.journeys, []);
});

test('every journey says why a session is needed, in words somebody can act on', { tags: ['unit'] }, () => {
  for (const journey of SIGNED_IN_JOURNEYS) {
    // The same bar the live gate holds its skip reasons to. A skip nobody can
    // act on is silence with extra steps.
    assert.ok(journey.why.length > 25, `${journey.id} gives a bare reason: "${journey.why}"`);
    assert.ok(/\s/.test(journey.why.trim()), `${journey.id} gives a single word as its reason`);
    assert.ok(journey.route.startsWith('/'), `${journey.id} names ${journey.route}, which is not a path`);
    assert.ok(journey.expects.length > 0, `${journey.id} asserts nothing, so a signed-in run would prove nothing`);
    for (const selector of journey.expects) {
      assert.ok(/[[.#]|,| /.test(selector), `${journey.id} expects "${selector}", which is too broad to mean anything`);
    }
  }
});

test('the matrix carries no account data, only selectors and routes', { tags: ['unit'] }, () => {
  // A matrix is a committed file read for years. Screenshots, balances, display
  // names, chat lines and session tokens have no business in one, and the way
  // that goes wrong is somebody pasting a real capture in "just to be precise".
  const source = readFileSync(resolve('scripts/signed-in-journeys.mjs'), 'utf8');
  const banned = [
    [/data:image\//, 'an inline image'],
    [/\beyJ[\w-]{10,}/, 'something shaped like a JWT'],
    [/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i, 'an email address'],
    [/\bkick-session\b|\bXSRF-TOKEN=/, 'a session cookie'],
    [/\b\d{1,3}(,\d{3})+\b/, 'a formatted balance'],
  ];
  for (const [pattern, what] of banned) {
    assert.ok(!pattern.test(source), `the signed-in matrix contains ${what}`);
  }
});

test('theme contrast verification never writes an operator-owned profile', { tags: ['unit'] }, () => {
  const source = readFileSync(resolve('scripts/verify-extension.mjs'), 'utf8');
  const start = source.indexOf('// Theme tokens have to reach three separate layers');
  const end = source.indexOf('const popupErrors', start);
  assert.ok(start >= 0 && end > start, 'theme verification block not found');
  const sweep = source.slice(start, end);
  assert.ok(!/clear-favorites|choice\.click|data-value=["']studio["']/.test(sweep),
    'theme verification can clear data or persist a replacement theme');
  assert.match(sweep, /document\.documentElement\.dataset\.kfTheme =/,
    'page theme should be applied as a transient DOM token');
  assert.match(sweep, /applyAppearance\(\{ appearance:/,
    'popup theme should be applied without writing extension storage');
});
