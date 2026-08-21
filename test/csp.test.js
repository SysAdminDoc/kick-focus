import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directiveAllowsInline, inlineScriptVerdict, scriptDirective, splitPolicies } from '../scripts/csp.mjs';

/**
 * Every case below is a shape a real response can carry. The first version of
 * this decision read the first directive that textually matched anywhere across
 * the concatenated policies, which got four of these wrong — three of them by
 * reporting that inline scripts were still allowed when they were not, which is
 * the failure that would let the Firefox companion die silently.
 */

test('no policy means nothing is blocking an inline script', { tag: 'unit' }, () => {
  assert.equal(inlineScriptVerdict(null).allowed, true);
  assert.equal(inlineScriptVerdict('').allowed, true);
  assert.equal(inlineScriptVerdict(null).policies, 0);
  // A policy that says nothing about scripts governs nothing here.
  assert.equal(inlineScriptVerdict("img-src 'self'; frame-ancestors 'none'").allowed, true);
});

test('the script source list is chosen by precedence, not by position', { tag: 'unit' }, () => {
  assert.equal(scriptDirective("default-src 'self'; script-src 'self' 'unsafe-inline'"), "script-src 'self' 'unsafe-inline'");
  assert.equal(scriptDirective("script-src 'unsafe-inline'; script-src-elem 'nonce-r4nd0m'"), "script-src-elem 'nonce-r4nd0m'");
  assert.equal(scriptDirective("default-src 'self'"), "default-src 'self'");
  assert.equal(scriptDirective("style-src 'self'"), null);
  // A repeated directive in one policy: the first wins, per the spec.
  assert.equal(scriptDirective("script-src 'unsafe-inline'; script-src 'none'"), "script-src 'unsafe-inline'");
});

test('the most common real layout is read correctly', { tag: 'unit' }, () => {
  // default-src restrictive, script-src permissive. The browser runs the inline
  // script; an implementation that reads default-src first calls this blocked.
  const verdict = inlineScriptVerdict("default-src 'self'; script-src 'self' 'unsafe-inline'");
  assert.equal(verdict.allowed, true);
  assert.deepEqual(verdict.blockedBy, []);
});

test("'unsafe-inline' is inert beside a nonce, a hash, or strict-dynamic", { tag: 'unit' }, () => {
  assert.equal(directiveAllowsInline("script-src 'unsafe-inline'"), true);
  assert.equal(directiveAllowsInline("script-src 'unsafe-inline' 'nonce-r4nd0m'"), false);
  assert.equal(directiveAllowsInline("script-src 'unsafe-inline' 'sha256-abc123'"), false);
  assert.equal(directiveAllowsInline("script-src 'unsafe-inline' 'strict-dynamic'"), false);
  assert.equal(directiveAllowsInline("script-src 'self'"), false);
  assert.equal(directiveAllowsInline("script-src 'none'"), false);
  // script-src-elem overrides a permissive script-src.
  assert.equal(inlineScriptVerdict("script-src 'unsafe-inline'; script-src-elem 'nonce-r4nd0m'").allowed, false);
});

test('content must pass every enforcing policy, not just one of them', { tag: 'unit' }, () => {
  // Repeated headers, which Headers.get() hands back comma-joined.
  const joined = inlineScriptVerdict("default-src 'self', script-src 'unsafe-inline'");
  assert.equal(joined.policies, 2);
  assert.equal(joined.allowed, false, 'the restrictive sibling still blocks');
  assert.deepEqual(joined.blockedBy, ["default-src 'self'"]);

  // A header that allows and a meta that does not: the intersection blocks.
  const mixed = inlineScriptVerdict("script-src 'unsafe-inline'", ["script-src 'nonce-r4nd0m'"]);
  assert.equal(mixed.allowed, false);
  assert.equal(mixed.blockedBy.length, 1);

  // Both permissive: allowed, and both are reported as governing.
  const both = inlineScriptVerdict("script-src 'unsafe-inline'", ["default-src 'unsafe-inline'"]);
  assert.equal(both.allowed, true);
  assert.equal(both.governing.length, 2);
});

test('policies are split the same way however they were joined', { tag: 'unit' }, () => {
  assert.deepEqual(splitPolicies("a 'b', c 'd'"), ["a 'b'", "c 'd'"]);
  assert.deepEqual(splitPolicies(["a 'b'", "c 'd'"]), ["a 'b'", "c 'd'"]);
  assert.deepEqual(splitPolicies([null, '', '  ']), []);
  assert.deepEqual(splitPolicies(undefined), []);
});
