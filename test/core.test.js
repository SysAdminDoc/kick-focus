import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  FILTER_MIN_SAMPLE,
  classifyRequest,
  detectContentLabels,
  filterDecision,
  isPlaybackUrl,
  neutralizePlaybackPayload,
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
  assert.deepEqual(detectContentLabels('LIVE Slots & Casino 18+ Sponsored Kick Drops'), {
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

test('structured card evidence outranks prose', () => {
  // The failure this replaces: ordinary titles reading as promotional content.
  const beat = detectContentLabels('DJ set - Drop the beat! | Music', {
    categories: ['music'],
    badges: ['LIVE', 'English', '4.2K'],
  });
  assert.equal(beat.drops, false);
  assert.equal(beat.casino, false);

  const frames = detectContentLabels('fixing dropped frames again', {
    categories: ['just-chatting'],
    badges: ['LIVE'],
  });
  assert.equal(frames.drops, false);

  // Talking about a casino is not being one.
  const talking = detectContentLabels('I lost it all at the casino, story time', {
    categories: ['just-chatting'],
    badges: ['LIVE'],
  });
  assert.equal(talking.casino, false);

  // Kick's own slug is authoritative, whatever the title says.
  const real = detectContentLabels('big wins tonight', {
    categories: ['slots'],
    badges: ['LIVE', '18+'],
  });
  assert.equal(real.casino, true);
  assert.equal(real.mature, true);
});

test('label detection falls back to text only without structured evidence', () => {
  const fallback = detectContentLabels('Slots & Casino 18+', {});
  assert.equal(fallback.casino, true);
  assert.equal(fallback.mature, true);

  // A localized display name still classifies via the slug.
  assert.equal(detectContentLabels('Tragamonedas', { categories: ['slots'] }).casino, true);

  // Badges present but none matching means the card is genuinely unlabelled.
  assert.equal(detectContentLabels('casino talk', { badges: ['LIVE'], categories: ['irl'] }).casino, false);
});

test('the ceiling yields to an explicit category page', () => {
  // Browsing /category/slots with the casino filter on should empty the page:
  // that is the filter working, not a labelling failure.
  const category = filterDecision(24, 24, { route: 'category' });
  assert.equal(category.apply, true);
  assert.equal(category.reason, 'category-route');

  // The same ratio anywhere else still suspends.
  assert.equal(filterDecision(24, 24, { route: 'browse' }).apply, false);
  assert.equal(filterDecision(24, 24).apply, false);
});

test('playback payloads have their ad flags cleared', () => {
  const payload = JSON.stringify({
    playback_url: { live: 'https://stream.kick.com/x.m3u8' },
    video_session: { auto_ads_enabled: true, id: 'abc' },
    video_player: {
      google_ads_sdk: { initiate_sdk: true },
      pal_sdk: { initiate_sdk: true },
      player: { player_name: 'ivs' },
    },
  });

  const result = neutralizePlaybackPayload(payload);
  assert.equal(result.changed, true);
  const parsed = JSON.parse(result.text);
  assert.equal(parsed.video_session.auto_ads_enabled, false);
  assert.equal('google_ads_sdk' in parsed.video_player, false);
  assert.equal('pal_sdk' in parsed.video_player, false);

  // Playback itself must survive untouched, or the stream stops working.
  assert.equal(parsed.playback_url.live, 'https://stream.kick.com/x.m3u8');
  assert.equal(parsed.video_session.id, 'abc');
  assert.equal(parsed.video_player.player.player_name, 'ivs');
});

test('playback rewriting leaves unrelated or clean payloads alone', () => {
  assert.equal(neutralizePlaybackPayload('not json').changed, false);
  assert.equal(neutralizePlaybackPayload('').changed, false);
  assert.equal(neutralizePlaybackPayload('[1,2,3]').changed, false);
  // Already ad-free: nothing to do, so the body is not rebuilt.
  assert.equal(neutralizePlaybackPayload('{"video_session":{"auto_ads_enabled":false}}').changed, false);
  assert.equal(neutralizePlaybackPayload('{"video_player":{"player":{}}}').changed, false);
});

test('playback URLs are recognised across endpoint shapes', () => {
  assert.equal(isPlaybackUrl('https://web.kick.com/api/v1/stream/abc-123/playback'), true);
  assert.equal(isPlaybackUrl('https://web.kick.com/api/v2/channels/x/playback?foo=1'), true);
  assert.equal(isPlaybackUrl('/stream/abc/playback'), true);
  assert.equal(isPlaybackUrl('https://kick.com/api/v1/channels/xqc'), false);
  assert.equal(isPlaybackUrl('https://stream.kick.com/playbackish/x.m3u8'), false);
  assert.equal(isPlaybackUrl(''), false);
});
