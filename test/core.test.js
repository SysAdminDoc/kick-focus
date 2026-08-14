import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  FILTER_MIN_SAMPLE,
  classifyRequest,
  detectContentLabels,
  filterDecision,
  nextApplyDelay,
  normalizeSettings,
  routeKind,
  sanitizeDiagnosticUrl,
  validateImportedSettings,
} from '../src/core.mjs';

test('normalization clamps values and keeps core ad defense enabled', () => {
  const value = normalizeSettings({
    layout: { chatWidth: 900, sidebar: 'wild' },
    content: { blockAds: false },
    accessibility: { captionOpacity: -5 },
  });
  assert.equal(value.layout.chatWidth, 520);
  assert.equal(value.layout.sidebar, DEFAULT_SETTINGS.layout.sidebar);
  assert.equal(value.content.blockAds, true);
  assert.equal(value.accessibility.captionOpacity, 0);
});

test('route classifier covers every audited desktop surface', () => {
  assert.equal(routeKind('https://kick.com/'), 'home');
  assert.equal(routeKind('/browse'), 'browse');
  assert.equal(routeKind('/browse/categories'), 'categories');
  assert.equal(routeKind('/browse/clips'), 'clips');
  assert.equal(routeKind('/category/just-chatting'), 'category');
  assert.equal(routeKind('/search?query=music'), 'search');
  assert.equal(routeKind('/lordkebun'), 'channel');
  assert.equal(routeKind('/creator-dashboard'), 'other');
});

test('ad hosts and optional telemetry are separated from first-party playback', () => {
  assert.equal(classifyRequest('https://imasdk.googleapis.com/pal/sdkloader/pal.js').category, 'advertising');
  assert.equal(classifyRequest('https://pubads.g.doubleclick.net/adsid/integrator.json').blocked, true);
  assert.equal(classifyRequest('https://4g1csfd6d0egt72a3mo5kgi77.litix.io/', { reduceTelemetry: true }).category, 'telemetry');
  assert.equal(classifyRequest('https://4g1csfd6d0egt72a3mo5kgi77.litix.io/', { reduceTelemetry: false }).blocked, false);
  assert.equal(classifyRequest('https://web.kick.com/api/v1/stream/123/playback', { reduceTelemetry: true }).blocked, false);
});

test('diagnostic URLs never preserve query strings or long identifiers', () => {
  const value = sanitizeDiagnosticUrl('https://web.kick.com/api/v1/stream/01a00174-9260-7c4d-958b-e555d56d4566/playback?token=secret');
  assert.equal(value, 'web.kick.com/api/v1/stream/:id/playback');
  assert.equal(value.includes('secret'), false);
});

test('content labels distinguish casino, mature, promoted, and drops surfaces', () => {
  assert.deepEqual(detectContentLabels('LIVE Slots & Casino 18+ Sponsored Drops'), {
    casino: true,
    mature: true,
    promoted: true,
    drops: true,
  });
});

test('settings import reports malformed and future schemas', () => {
  assert.equal(validateImportedSettings('{oops').ok, false);
  assert.match(validateImportedSettings('{"schema":99}').error, /newer/);
  assert.equal(validateImportedSettings('{"layout":{"chatWidth":410}}').value.layout.chatWidth, 410);
});

test('filtering fails open when it would hide most of a grid', () => {
  // A grid that is mostly promotional is far more likely to be a labelling
  // change than the truth, so nothing is hidden and the caller is told why.
  const suspended = filterDecision(12, 7);
  assert.equal(suspended.apply, false);
  assert.equal(suspended.reason, 'ratio');
  assert.equal(suspended.hidden, 7);
  assert.equal(suspended.total, 12);

  // Ordinary filtering is untouched.
  assert.equal(filterDecision(12, 2).apply, true);

  // Exactly at the ceiling still applies; only exceeding it suspends.
  assert.equal(filterDecision(12, 3).apply, true);
  assert.equal(filterDecision(12, 4).apply, false);
});

test('filter ceiling ignores samples too small to judge', () => {
  // A channel page may legitimately show two cards, both filtered.
  assert.equal(filterDecision(FILTER_MIN_SAMPLE - 1, FILTER_MIN_SAMPLE - 1).apply, true);
  assert.equal(filterDecision(0, 0).apply, true);
  assert.equal(filterDecision(1, 1).apply, true);
});

test('filter decision tolerates nonsense counts', () => {
  assert.equal(filterDecision(-3, 5).apply, true);
  assert.equal(filterDecision(10, 999).apply, false);
  assert.equal(filterDecision(undefined, undefined).apply, true);
  assert.equal(filterDecision(10, 999).hidden, 10);
});

test('apply delay is capped so a busy page cannot starve the work', () => {
  // Fresh request: the caller's debounce is honoured.
  assert.equal(nextApplyDelay(80, 0), 80);

  // Under continuous mutations the wait shrinks and eventually hits zero, which
  // is what stops Kick's constantly-changing DOM from resetting the timer forever.
  assert.equal(nextApplyDelay(80, 450), 50);
  assert.equal(nextApplyDelay(80, 500), 0);
  assert.equal(nextApplyDelay(80, 9000), 0);

  // A shorter request is never lengthened.
  assert.equal(nextApplyDelay(0, 0), 0);
  assert.equal(nextApplyDelay(10, 100), 10);
  assert.equal(nextApplyDelay(undefined, undefined), 0);
});
