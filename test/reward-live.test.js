import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const capture = JSON.parse(await readFile(new URL('fixtures/daily-reward-live.json', import.meta.url), 'utf8'));

test('the daily reward fixture preserves the one-shot live contract without account data', { tags: ['unit'] }, () => {
  assert.equal(capture.trigger.mountDelayMs, 83);
  assert.match(capture.trigger.availableMedia, /reward-available-CTA\.webm$/);
  assert.equal(capture.dialog.identity.relationship, 'trigger aria-controls equals dialog id');
  assert.equal(capture.dialog.ready.action, 'Claim');
  assert.equal(capture.dialog.claimed.action, 'Share');
  assert.equal(capture.dialog.claimed.streakDelta, 1);
  assert.equal(capture.network.claim.method, 'POST');
  assert.equal(capture.network.claim.requestBody, null);
  assert.equal(capture.network.claim.status, 200);
  assert.equal(capture.network.claim.durationMs, 290);
  assert.equal(capture.dialog.unrelatedDialogObserved, true);
  assert.deepEqual(capture.privacy, {
    credentialsRecorded: false,
    authorizationHeadersRecorded: false,
    cookiesRecorded: false,
    accountIdentifiersRedacted: true,
  });

  const serialized = JSON.stringify(capture);
  assert.doesNotMatch(serialized, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.doesNotMatch(serialized, /gamification\/users\/\d+/i);
});

test('the shipped auto-claim implements every live contract signal', { tags: ['artifact'] }, async () => {
  const runtime = await readFile(new URL('src/runtime.js', root), 'utf8');
  assert.match(runtime, /trigger\.getAttribute\('aria-controls'\)/);
  assert.match(runtime, /document\.getElementById\(dialogId\)/);
  assert.match(runtime, /rewardDialogIdentity\(dialog\)/);
  assert.match(runtime, /REWARD_DIALOG_RETRY_MS = 120/);
  assert.match(runtime, /REWARD_CLAIM_CONFIRM_RETRY_MS = 250/);
  assert.match(runtime, /reward-available-CTA\./);
  assert.ok(runtime.includes('/daily\\s+reward\\s+resets?\\s+at/i'));
  assert.ok(runtime.includes('/^\\s*share\\s*$/i'));
  assert.match(runtime, /claimStartedAt/);
  assert.match(runtime, /claimClickedAt/);
  assert.match(runtime, /action\.click\(\);\s*\n\s*scheduleRewardClaim\(REWARD_CLAIM_CONFIRM_RETRY_MS\)/);
  assert.doesNotMatch(runtime.slice(runtime.indexOf('const REWARD_TRIGGER ='), runtime.indexOf('function chatMessageInput')), /\bfetch\(|XMLHttpRequest|kickFetchJson\(/);
});
