import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emoteAspect,
  endpoints,
  findShadowedNames,
  joinCollectibleRarity,
  normalizeChannel,
  normalizeChatMessage,
  normalizeDeletion,
  normalizeEmoteSets,
  normalizeRealtimeConnection,
  parseEmoteTokens,
  pusherSocketUrl,
  realtimeChannels,
  realtimeHealth,
} from '../src/api.mjs';
import { rankEmoteUsage, recordEmoteUse, unusedEmotes } from '../src/core.mjs';

// Shapes below are from first-hand captures against the live site on 2026-08-15.

test('the realtime broker is read rather than assumed to be Pusher', () => {
  const live = normalizeRealtimeConnection({
    data: {
      connections: [{ credentials: { app_key: '32cbd69e4b950bf97679', cluster: 'us2' }, provider: 'PUSHER' }],
      mode: 'WEBSOCKET',
    },
    message: 'success',
  });
  assert.equal(live.ok, true);
  assert.equal(live.provider, 'PUSHER');
  assert.equal(pusherSocketUrl(live), 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.6.0&flash=false');

  // The whole reason this indirection exists: Kick can switch providers
  // server-side. An unknown one must degrade, never guess or throw.
  const switched = normalizeRealtimeConnection({
    data: { connections: [{ credentials: { app_key: 'x', cluster: 'y' }, provider: 'ABLY' }] },
  });
  assert.equal(switched.ok, false);
  assert.equal(switched.reason, 'unsupported-provider');
  assert.deepEqual(switched.offered, ['ABLY']);

  // Degenerate answers are reported, not thrown.
  assert.equal(normalizeRealtimeConnection({}).reason, 'no-connections');
  assert.equal(normalizeRealtimeConnection({ data: { connections: [] } }).reason, 'no-connections');
  assert.equal(
    normalizeRealtimeConnection({ data: { connections: [{ provider: 'PUSHER', credentials: {} }] } }).reason,
    'incomplete-credentials',
  );
});

test('realtime channel names keep Kick\'s inconsistent separators', () => {
  // Dot and underscore are *different* channels carrying different events.
  // Subscribing to the wrong one succeeds and then never delivers.
  assert.deepEqual(
    realtimeChannels({ chatroomId: 88, channelId: 42 }),
    ['chatrooms.88.v2', 'chatroom_88', 'channel.42', 'channel_42'],
  );
  assert.deepEqual(realtimeChannels({}), []);
});

test('a socket that is open but silent is not reported as healthy', () => {
  assert.equal(realtimeHealth({ connected: false }).state, 'offline');
  assert.equal(realtimeHealth({ connected: true, lastFrameAt: 1000, now: 2000 }).state, 'live');

  // A dead Kick socket stays readyState OPEN and never fires close or error,
  // so silence is the only available signal.
  const stale = realtimeHealth({ connected: true, lastFrameAt: 1000, now: 1000 + 61_000 });
  assert.equal(stale.state, 'stale');
  assert.equal(stale.healthy, false);

  // A run of frames we cannot read means Kick changed shape — distinct from
  // silence, and it needs a different response.
  assert.equal(realtimeHealth({ connected: true, unparsable: 20, now: 1 }).state, 'unparsable');
});

test('emote sets normalize with entitlement, not a disabled attribute', () => {
  const result = normalizeEmoteSets([
    {
      id: 12, name: 'lacobraaa', slug: 'lacobraaa',
      emotes: [
        { id: 5748003, channel_id: 12, name: 'collectiblesGoldenLULW', subscribers_only: true },
        { id: 900, channel_id: 12, name: 'cobraHi', subscribers_only: false },
      ],
    },
    { id: null, name: 'Global', emotes: [{ id: 37226, name: 'KEKW', subscribers_only: false }] },
    { id: null, name: 'Emojis', emotes: [{ id: 1, name: 'smile' }] },
  ]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.sets.map((set) => set.kind), ['channel', 'global', 'emoji']);
  assert.equal(result.emotes.length, 4);

  const golden = result.emotes.find((emote) => emote.name === 'collectiblesGoldenLULW');
  assert.equal(golden.collectible, true);
  assert.equal(golden.url, 'https://files.kick.com/emotes/5748003/fullsize');
  // subscribers_only doubles as Kick's platform-wide usability flag, which is
  // inverted from what the name suggests.
  assert.equal(golden.usableEverywhere, true);
  assert.equal(result.emotes.find((emote) => emote.name === 'cobraHi').usableEverywhere, false);
  assert.equal(result.emotes.find((emote) => emote.name === 'KEKW').usableEverywhere, true);

  // A changed shape reports rather than throwing, so the caller can fall back.
  assert.equal(normalizeEmoteSets(null).ok, false);
  assert.equal(normalizeEmoteSets([]).reason, 'no-sets');
  // Entries missing an id or name are dropped rather than becoming blank tiles,
  // and a set left with nothing usable is a fallback signal, not a success.
  const malformed = normalizeEmoteSets([{ name: 'X', emotes: [{ id: 1 }, { name: 'y' }] }]);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.reason, 'no-emotes');
  assert.equal(malformed.emotes.length, 0);
});

test('shadowed emote names name the winner Kick will actually send', () => {
  const { emotes } = normalizeEmoteSets([
    { id: 1, name: 'channelA', emotes: [{ id: 10, name: 'KEKW', subscribers_only: true }] },
    { id: 2, name: 'channelB', emotes: [{ id: 20, name: 'KEKW', subscribers_only: true }] },
    { id: null, name: 'Global', emotes: [{ id: 30, name: 'LULW' }] },
  ]);
  const collisions = findShadowedNames(emotes);
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].name, 'KEKW');
  // Kick resolves through one name-keyed Map where the last set loaded wins.
  assert.equal(collisions[0].winner.id, '20');
  assert.equal(collisions[0].shadowed[0].id, '10');
  assert.deepEqual(collisions[0].sets, ['channelA', 'channelB']);
});

test('chat wire tokens are parsed to ids, because names are not identities', () => {
  const segments = parseEmoteTokens('hey [emote:37226:KEKW] nice [emote:5748003:collectiblesGoldenLULW]');
  assert.deepEqual(segments, [
    { type: 'text', value: 'hey ' },
    { type: 'emote', id: '37226', name: 'KEKW' },
    { type: 'text', value: ' nice ' },
    { type: 'emote', id: '5748003', name: 'collectiblesGoldenLULW' },
  ]);
  assert.deepEqual(parseEmoteTokens(''), []);
  assert.deepEqual(parseEmoteTokens('plain'), [{ type: 'text', value: 'plain' }]);
  // The regex is module-level; repeated calls must not resume from lastIndex.
  assert.equal(parseEmoteTokens('[emote:1:a]').length, 1);
  assert.equal(parseEmoteTokens('[emote:1:a]').length, 1);
});

test('chat messages prefer badges_v2 and survive a missing identity', () => {
  const message = normalizeChatMessage({
    id: 'abc', content: 'gg [emote:37226:KEKW]', created_at: '2026-08-15T00:00:00Z',
    sender: {
      id: 5, username: 'Someone', slug: 'someone',
      identity: {
        color: '#53fc18',
        badges: [{ type: 'subscriber', text: 'Subscriber' }],
        badges_v2: [{ name: 'OG', badge_type: 'og', image_url: 'https://ext.cdn.kick.com/chat/badges/og.svg' }],
      },
    },
  });
  assert.equal(message.emotes.length, 1);
  assert.equal(message.emotes[0].id, '37226');
  // badges_v2 carries image URLs and covers badges the legacy array omits.
  assert.equal(message.badges.length, 1);
  assert.equal(message.badges[0].type, 'og');
  assert.equal(message.badges[0].image, 'https://ext.cdn.kick.com/chat/badges/og.svg');

  const legacy = normalizeChatMessage({ id: 'd', content: 'hi', sender: { id: 1, identity: { badges: [{ type: 'vip', text: 'VIP' }] } } });
  assert.equal(legacy.badges[0].type, 'vip');
  assert.equal(normalizeChatMessage({}), null);
});

test('a deleted message explains why, which no DOM scraper can see', () => {
  const ai = normalizeDeletion({ message: { id: 'm1' }, aiModerated: true, violatedRules: ['bullying'] });
  assert.equal(ai.aiModerated, true);
  assert.deepEqual(ai.rules, ['bullying']);
  assert.match(ai.reason, /automatic moderation for bullying/);

  // Unknown rule slugs are shown, not dropped — Kick adds them without notice.
  assert.match(normalizeDeletion({ id: 'm2', aiModerated: true, violatedRules: ['brand_new_rule'] }).reason, /brand new rule/);

  // A human moderator deletion must not be attributed to the AI.
  const human = normalizeDeletion({ message: { id: 'm3' } });
  assert.equal(human.aiModerated, false);
  assert.equal(human.reason, 'Removed by a moderator.');
  assert.equal(normalizeDeletion({}), null);
});

test('usage counting produces the ranking Kick itself does not have', () => {
  let counts = { global: {}, channels: {} };
  for (let i = 0; i < 3; i += 1) counts = recordEmoteUse(counts, { channel: 'xqc', id: '37226', name: 'KEKW', at: i });
  counts = recordEmoteUse(counts, { channel: 'xqc', id: '900', name: 'cobraHi', at: 9 });
  counts = recordEmoteUse(counts, { channel: 'other', id: '900', name: 'cobraHi', at: 10 });

  // Kick's own "Frequently Used" hardcodes timeUsed to 1 and never increments;
  // this is a real count.
  assert.equal(counts.global['37226'].count, 3);
  assert.equal(counts.global['900'].count, 2);
  assert.equal(counts.channels.xqc['37226'].count, 3);
  assert.equal(counts.channels.other['900'].count, 1);

  const ranked = rankEmoteUsage(counts, { channel: 'xqc' });
  assert.equal(ranked[0].id, '37226');
  assert.equal(ranked[0].count, 3);

  // A channel never visited still gets a useful shelf from the global rollup
  // rather than an empty one.
  const fresh = rankEmoteUsage(counts, { channel: 'never-seen' });
  assert.equal(fresh.length, 2);
  assert.equal(fresh.every((entry) => entry.count === 0), true);
  assert.equal(fresh[0].id, '37226');

  // The inverse view: owned but never sent.
  const owned = [{ id: '37226' }, { id: '900' }, { id: '555' }];
  assert.deepEqual(unusedEmotes(counts, owned).map((entry) => entry.id), ['555']);

  // A write with no id must not corrupt the store.
  assert.equal(recordEmoteUse(counts, { channel: 'xqc' }), counts);
});

test('rarity is joined on evidence and stays silent when the evidence is weak', () => {
  const { emotes } = normalizeEmoteSets([{
    id: 1, name: 'chan',
    emotes: [
      { id: 5748003, name: 'collectiblesGoldenLULW' },
      { id: 5748004, name: 'collectiblesNeonPog' },
      { id: 5748005, name: 'collectiblesUnknownOne' },
      { id: 900, name: 'cobraHi' },
    ],
  }]);

  const cards = [
    // Strongest evidence: the card art is addressed by the emote's own id.
    { id: 'uuid-a', card_url: 'https://files.kick.com/collectibles/5748003/card.png', owned: true, rarity: 'mythic' },
    // Weaker: the name appears in the asset path.
    { id: 'uuid-b', card_url: 'https://files.kick.com/collectibles/neonpog-front.png', owned: false, rarity: 'rare' },
    // No relationship to anything we hold.
    { id: 'uuid-c', card_url: 'https://files.kick.com/collectibles/somethingelse.png', owned: true, rarity: 'legendary' },
  ];

  const join = joinCollectibleRarity(cards, emotes);
  assert.equal(join.total, 3, 'non-collectible emotes are not candidates');
  assert.equal(join.matched.length, 2);

  const golden = join.matched.find((entry) => entry.emote.name === 'collectiblesGoldenLULW');
  assert.equal(golden.rarity, 'mythic');
  assert.equal(golden.basis, 'emote id in card URL');
  assert.equal(golden.owned, true);
  assert.equal(join.matched.find((entry) => entry.emote.name === 'collectiblesNeonPog').basis, 'emote name in card URL');

  // The one with no evidence gets no label at all. A mislabelled Mythic is
  // worse than no label, so this must never fall through to a leftover card.
  assert.deepEqual(join.unmatched.map((entry) => entry.name), ['collectiblesUnknownOne']);
  assert.equal(join.usable, true);

  // Raising the bar past the name-in-URL strategy drops that match cleanly.
  const strict = joinCollectibleRarity(cards, emotes, { minConfidence: 0.95 });
  assert.equal(strict.matched.length, 1);
  assert.equal(strict.unmatched.length, 2);

  // No cards at all is the anonymous case: render exactly as today.
  const none = joinCollectibleRarity([], emotes);
  assert.equal(none.usable, false);
  assert.equal(none.coverage, 0);
});

test('wide collectibles are measured, never guessed from the name', () => {
  // Kick renders at double width only when the name is prefixed AND the loaded
  // image is actually wide. Either alone squashes or stretches something.
  assert.equal(emoteAspect('collectiblesWide', 112, 56), 'wide');
  assert.equal(emoteAspect('collectiblesSquare', 56, 56), 'square');
  assert.equal(emoteAspect('KEKW', 112, 56), 'square');
  // An image that has not loaded yet has zero dimensions; do not call it wide.
  assert.equal(emoteAspect('collectiblesWide', 0, 0), 'square');
  assert.equal(emoteAspect('collectiblesWide', undefined, undefined), 'square');
});

test('endpoints are same-origin, read-only, and encode their inputs', () => {
  assert.equal(endpoints.emoteSets('la cobra/../x'), 'https://kick.com/emotes/la%20cobra%2F..%2Fx');
  assert.equal(endpoints.chatHistory(88), 'https://web.kick.com/api/v1/chat/88/history');
  assert.equal(endpoints.realtimeChat(88, 'uuid'), 'https://web.kick.com/api/v1/realtime/chat/88/client/uuid/connection');
  // Bulk live status in one request instead of N per-channel polls.
  assert.equal(endpoints.currentViewers([1, 2, 2, '']), 'https://kick.com/current-viewers?ids[]=1&ids[]=2');

  for (const url of [endpoints.channel('x'), endpoints.emoteSets('x'), endpoints.collectibles(), endpoints.chatHistory(1)]) {
    assert.match(url, /^https:\/\/(web\.)?kick\.com\//, 'every endpoint must stay on Kick');
  }
});

test('channel identity survives an offline or reshaped payload', () => {
  const live = normalizeChannel({
    id: 42, user_id: 7, slug: 'lacobraaa', chatroom: { id: 88 }, followers_count: 1234,
    livestream: { is_live: true, viewer_count: 900, session_title: 'hi', is_mature: false, language: 'en', categories: [{ slug: 'slots' }] },
  });
  assert.equal(live.chatroomId, 88);
  assert.equal(live.isLive, true);
  assert.deepEqual(live.categories, ['slots']);

  // Offline channels carry livestream: null — a very common crash shape.
  const offline = normalizeChannel({ id: 42, chatroom: { id: 88 }, livestream: null });
  assert.equal(offline.isLive, false);
  assert.equal(offline.viewers, 0);
  assert.equal(normalizeChannel(null), null);
  assert.equal(normalizeChannel({ slug: 'x' }), null, 'an id-less payload is not a channel');
});

test('channel input accepts whatever a person is likely to paste', async () => {
  const { parseChannelInput, playerEmbedUrl, chatEmbedUrl, isValidSlug } = await import('../src/api.mjs');
  assert.equal(parseChannelInput('xqc'), 'xqc');
  assert.equal(parseChannelInput('  @xQc  '), 'xQc');
  assert.equal(parseChannelInput('https://kick.com/xqc'), 'xqc');
  assert.equal(parseChannelInput('https://www.kick.com/xqc?foo=1'), 'xqc');
  assert.equal(parseChannelInput('kick.com/xqc/videos'), 'xqc');

  // A lookalike host must not be read as a Kick channel.
  assert.equal(parseChannelInput('https://kick.com.evil.net/xqc'), '');
  assert.equal(parseChannelInput('https://twitch.tv/xqc'), '');
  assert.equal(parseChannelInput(''), '');
  assert.equal(parseChannelInput('has spaces'), '');

  assert.equal(isValidSlug('-leading-dash'), false);
  assert.equal(isValidSlug('a'.repeat(65)), false);

  // Kick's real player and chat, so playback and entitlements stay Kick's.
  assert.match(playerEmbedUrl('xqc'), /^https:\/\/player\.kick\.com\/xqc\?/);
  assert.match(playerEmbedUrl('xqc', { muted: false }), /muted=false/);
  assert.equal(chatEmbedUrl('xqc'), 'https://kick.com/popout/xqc/chat');
});

test('realtime frames are treated as untrusted input', () => {
  // The socket is an anonymous public subscription, so nothing about the
  // transport guarantees the shape or size of what arrives.

  // Oversized content is truncated rather than passed on whole.
  const huge = normalizeChatMessage({ id: 'a', content: 'x'.repeat(50_000), sender: { id: 1 } });
  assert.ok(huge.content.length <= 2000);

  // A message crafted to be thousands of emote tokens must not become
  // thousands of nodes downstream.
  const spam = normalizeChatMessage({ id: 'b', content: '[emote:1:a]'.repeat(5000), sender: { id: 1 } });
  assert.ok(spam.segments.length <= 200, `segments=${spam.segments.length}`);

  // A colour goes straight into a style, so only real colours survive.
  const styled = normalizeChatMessage({ id: 'c', sender: { id: 1, identity: { color: 'red; background:url(//evil)' } } });
  assert.equal(styled.sender.color, '');
  assert.equal(normalizeChatMessage({ id: 'd', sender: { id: 1, identity: { color: '#53fc18' } } }).sender.color, '#53fc18');

  // Badge images must be Kick https URLs; a javascript: or data: URL is dropped
  // while the badge itself still renders.
  const badged = normalizeChatMessage({
    id: 'e',
    sender: { id: 1, identity: { badges_v2: [
      { name: 'OG', badge_type: 'og', image_url: 'javascript:alert(1)' },
      { name: 'Sub', badge_type: 'subscriber', image_url: 'https://ext.cdn.kick.com/chat/badges/sub.svg' },
    ] } },
  });
  assert.equal(badged.badges[0].image, '');
  assert.equal(badged.badges[0].type, 'og');
  assert.equal(badged.badges[1].image, 'https://ext.cdn.kick.com/chat/badges/sub.svg');

  // An unbounded badge array is capped.
  const manyBadges = normalizeChatMessage({
    id: 'f',
    sender: { id: 1, identity: { badges_v2: Array.from({ length: 500 }, () => ({ badge_type: 'x', name: 'y' })) } },
  });
  assert.ok(manyBadges.badges.length <= 24);

  // Junk in the id position is rejected outright instead of stringified.
  for (const bad of [null, undefined, {}, [], { id: {} }, { id: [] }]) {
    assert.equal(normalizeChatMessage(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
  for (const bad of [null, undefined, {}, { id: {} }]) {
    assert.equal(normalizeDeletion(bad), null);
  }

  // Deletion rule lists are bounded and unknown slugs are shown, not dropped.
  const flooded = normalizeDeletion({ id: 'g', aiModerated: true, violatedRules: Array.from({ length: 400 }, (_, i) => `rule_${i}`) });
  assert.ok(flooded.rules.length <= 12);

  // Nothing above throws on a prototype-polluting payload.
  const polluted = JSON.parse('{"id":"h","content":"hi","__proto__":{"pwned":true},"sender":{"id":1}}');
  assert.equal(normalizeChatMessage(polluted).content, 'hi');
  assert.equal(({}).pwned, undefined);
});
