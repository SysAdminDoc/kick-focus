import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readArtifact } from '../scripts/artifact-freshness.mjs';
import { stripComments } from '../scripts/strip-comments.mjs';
import { directiveAllowsInline, inlineScriptVerdict, scriptDirective, splitPolicies } from '../scripts/csp.mjs';

/**
 * Every case below is a shape a real response can carry. The first version of
 * this decision read the first directive that textually matched anywhere across
 * the concatenated policies, which got four of these wrong — three of them by
 * reporting that inline scripts were still allowed when they were not, which is
 * the failure that would let the Firefox companion die silently.
 */

test('no policy means nothing is blocking an inline script', { tags: ['unit'] }, () => {
  assert.equal(inlineScriptVerdict(null).allowed, true);
  assert.equal(inlineScriptVerdict('').allowed, true);
  assert.equal(inlineScriptVerdict(null).policies, 0);
  // A policy that says nothing about scripts governs nothing here.
  assert.equal(inlineScriptVerdict("img-src 'self'; frame-ancestors 'none'").allowed, true);
});

test('the script source list is chosen by precedence, not by position', { tags: ['unit'] }, () => {
  assert.equal(scriptDirective("default-src 'self'; script-src 'self' 'unsafe-inline'"), "script-src 'self' 'unsafe-inline'");
  assert.equal(scriptDirective("script-src 'unsafe-inline'; script-src-elem 'nonce-r4nd0m'"), "script-src-elem 'nonce-r4nd0m'");
  assert.equal(scriptDirective("default-src 'self'"), "default-src 'self'");
  assert.equal(scriptDirective("style-src 'self'"), null);
  // A repeated directive in one policy: the first wins, per the spec.
  assert.equal(scriptDirective("script-src 'unsafe-inline'; script-src 'none'"), "script-src 'unsafe-inline'");
});

test('the most common real layout is read correctly', { tags: ['unit'] }, () => {
  // default-src restrictive, script-src permissive. The browser runs the inline
  // script; an implementation that reads default-src first calls this blocked.
  const verdict = inlineScriptVerdict("default-src 'self'; script-src 'self' 'unsafe-inline'");
  assert.equal(verdict.allowed, true);
  assert.deepEqual(verdict.blockedBy, []);
});

test("'unsafe-inline' is inert beside a nonce, a hash, or strict-dynamic", { tags: ['unit'] }, () => {
  assert.equal(directiveAllowsInline("script-src 'unsafe-inline'"), true);
  assert.equal(directiveAllowsInline("script-src 'unsafe-inline' 'nonce-r4nd0m'"), false);
  assert.equal(directiveAllowsInline("script-src 'unsafe-inline' 'sha256-abc123'"), false);
  assert.equal(directiveAllowsInline("script-src 'unsafe-inline' 'strict-dynamic'"), false);
  assert.equal(directiveAllowsInline("script-src 'self'"), false);
  assert.equal(directiveAllowsInline("script-src 'none'"), false);
  // script-src-elem overrides a permissive script-src.
  assert.equal(inlineScriptVerdict("script-src 'unsafe-inline'; script-src-elem 'nonce-r4nd0m'").allowed, false);
});

test('content must pass every enforcing policy, not just one of them', { tags: ['unit'] }, () => {
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

test('policies are split the same way however they were joined', { tags: ['unit'] }, () => {
  assert.deepEqual(splitPolicies("a 'b', c 'd'"), ["a 'b'", "c 'd'"]);
  assert.deepEqual(splitPolicies(["a 'b'", "c 'd'"]), ["a 'b'", "c 'd'"]);
  assert.deepEqual(splitPolicies([null, '', '  ']), []);
  assert.deepEqual(splitPolicies(undefined), []);
});

test('a policy that blocks inline scripts no longer stops the Firefox companion', { tags: ['artifact'] }, async () => {
  // The Firefox package used to inject its page bundle as an inline script, so
  // the day kick.com shipped a script-src without 'unsafe-inline' its whole page
  // layer would have stopped loading, silently. The bundle is a declared
  // MAIN-world content script now: Firefox injects it into the page's realm and
  // the page's policy does not apply to it.
  //
  // What can be checked here is that the dependency is gone rather than merely
  // unlikely to bite. Under a policy this build would once have died on, there
  // is nothing left for it to block.
  const hostile = 'script-src \'self\'; object-src \'none\'';
  assert.equal(inlineScriptVerdict(hostile).allowed, false, 'the fixture policy does not actually block inline scripts');

  const manifest = JSON.parse(await readArtifact('dist/extension-firefox/manifest.json'));
  const bridge = await readArtifact('dist/extension-firefox/content/bridge.js');
  const bundle = await readArtifact('dist/extension-firefox/content/kick-focus.js');

  const main = manifest.content_scripts.find((entry) => entry.world === 'MAIN');
  assert.ok(main, 'the page bundle is not declared as a MAIN-world content script');
  assert.deepEqual(main.js, ['content/kick-focus.js']);
  assert.equal(main.run_at, 'document_start');
  assert.ok(bundle.includes('data-kf-settings-shell'), 'the declared file is not the page bundle');

  // Nothing the policy could refuse: no inline script is created, and no
  // extension URL is handed to the page either, which is the other half of why
  // this package does not simply use a script src.
  // Comments stripped first: this file explains at length why a script src and
  // an inline script are both wrong, and those words are not code.
  const code = stripComments(bridge);
  assert.ok(!/createElement\(\s*['"]script['"]\s*\)/.test(code), 'the bridge still builds a script element');
  assert.ok(!/\.textContent\s*=/.test(code), 'the bridge still writes script text');
  assert.ok(!/\.src\s*=/.test(code), 'the bridge still sets a script src');
  assert.ok(!/getURL\s*\(/.test(code), 'the bridge still hands the page an extension URL');
  assert.equal('web_accessible_resources' in manifest, false);
});
