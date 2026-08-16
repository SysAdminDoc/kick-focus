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
  parseRealtimeFrame,
  pusherSocketUrl,
  kickGatewaySocketUrl,
  realtimeChannels,
  realtimeHealth,
  realtimeSubscribeFrame,
  realtimeTransport,
  emoteLockState,
  catalogEmoteAccess,
  normalizeCurrentViewers,
  summarizeCollectibleInventory,
  COLLECTIBLE_FACTS,
  REALTIME_TRANSPORTS,
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

test('a second realtime transport is an added entry, not a rewrite', () => {
  // The seam: every transport supplies credentials + a URL, and nothing else.
  // Frame parsing and subscription management below are shared by all of them.
  for (const transport of Object.values(REALTIME_TRANSPORTS)) {
    assert.equal(typeof transport.credentials, 'function', `${transport.id} needs credentials()`);
    assert.equal(typeof transport.socketUrl, 'function', `${transport.id} needs socketUrl()`);
    assert.equal(typeof transport.verified, 'boolean', `${transport.id} must state whether it is verified`);
  }

  // Kick's own gateway takes a token where Pusher takes a key and cluster.
  assert.equal(
    kickGatewaySocketUrl({ token: 'abc/123' }),
    'wss://websockets.kick.com/viewer/v1/connect?token=abc%2F123',
  );
  assert.equal(realtimeTransport('kick').id, 'KICK');
  assert.equal(realtimeTransport('pusher').id, 'PUSHER');
  assert.equal(realtimeTransport('ABLY'), null);
  assert.equal(realtimeTransport(undefined), null);

  // Kick's gateway is registered but has never been contacted from this
  // project, so it must not claim to be verified.
  assert.equal(REALTIME_TRANSPORTS.KICK.verified, false);
  assert.equal(REALTIME_TRANSPORTS.PUSHER.verified, true);

  // Broker naming the gateway alone: usable, and flagged unverified.
  const gateway = normalizeRealtimeConnection({
    data: { connections: [{ provider: 'KICK', credentials: { token: 'tok' } }] },
  });
  assert.equal(gateway.ok, true);
  assert.equal(gateway.provider, 'KICK');
  assert.equal(gateway.verified, false);
  assert.equal(gateway.transport.socketUrl(gateway), 'wss://websockets.kick.com/viewer/v1/connect?token=tok');

  // Offered both, the verified one wins: a migration only lands once Kick
  // stops offering the path this build has actually run against.
  const both = normalizeRealtimeConnection({
    data: {
      connections: [
        { provider: 'KICK', credentials: { token: 'tok' } },
        { provider: 'PUSHER', credentials: { app_key: 'k', cluster: 'us2' } },
      ],
    },
  });
  assert.equal(both.provider, 'PUSHER');
  assert.equal(both.verified, true);

  // A known provider with the wrong credential shape is incomplete, not usable.
  assert.equal(
    normalizeRealtimeConnection({ data: { connections: [{ provider: 'KICK', credentials: {} }] } }).reason,
    'incomplete-credentials',
  );
});

test('frame parsing is shared by every transport and classifies by kind', () => {
  // Subscription management is one function, so a new transport reuses it.
  assert.equal(
    realtimeSubscribeFrame('chatrooms.88.v2'),
    '{"event":"pusher:subscribe","data":{"auth":"","channel":"chatrooms.88.v2"}}',
  );

  assert.equal(parseRealtimeFrame('not json').kind, 'unparsable');
  assert.equal(parseRealtimeFrame(JSON.stringify({ event: 'pusher:connection_established' })).kind, 'established');
  assert.equal(parseRealtimeFrame(JSON.stringify({ event: 'pusher_internal:subscription_succeeded' })).kind, 'subscription-ack');

  // Kick double-encodes `data` as a JSON string; both forms must classify.
  const nested = parseRealtimeFrame(JSON.stringify({
    event: 'App\\Events\\ChatMessageEvent',
    data: JSON.stringify({ id: 'm1', content: 'hi' }),
  }));
  assert.equal(nested.kind, 'chat-message');
  assert.equal(nested.payload.id, 'm1');

  const plain = parseRealtimeFrame(JSON.stringify({
    event: 'App\\Events\\MessageDeletedEvent',
    data: { id: 'm2' },
  }));
  assert.equal(plain.kind, 'deletion');
  assert.equal(plain.payload.id, 'm2');

  // Anything else is 'other' rather than throwing or being mistaken for a message.
  assert.equal(parseRealtimeFrame(JSON.stringify({ event: 'App\\Events\\SomethingNew', data: {} })).kind, 'other');
  assert.equal(parseRealtimeFrame(JSON.stringify({ event: 'x', data: 'not json' })).kind, 'other');
  assert.equal(parseRealtimeFrame(JSON.stringify({ event: 'x', data: null })).kind, 'other');
});

test('a locked emote says why, and entitlement tolerates more than one shape', () => {
  // The documented failure mode is the expensive one: greying out an emote the
  // user does own. Every shape Kick has used to say "entitled" must be read.
  for (const owned of [
    { subscribed: true }, { is_subscribed: true }, { entitled: true },
    { unlocked: true }, { owned: true }, { subscription: { id: 4 } }, { subscribed: 1 },
  ]) {
    const state = emoteLockState({ ...owned, locked: true, subscribersOnly: true });
    assert.equal(state.locked, false, `${JSON.stringify(owned)} should read as entitled`);
  }

  // With nothing saying otherwise, the default is unlocked — an unconfirmed
  // emote is shown, never hidden.
  assert.equal(emoteLockState({ name: 'KEKW' }).locked, false);
  assert.equal(emoteLockState({}).locked, false);
  assert.equal(emoteLockState(null).locked, false);
  assert.equal(emoteLockState({ subscribersOnly: true }).locked, false);

  // Only an explicit denial locks, and then it explains and links to Kick.
  const sub = emoteLockState({ locked: true, subscribersOnly: true }, 'xqc');
  assert.equal(sub.locked, true);
  assert.match(sub.reason, /Subscribing to xqc/);
  assert.match(sub.reason, /works in every chat/);
  assert.equal(sub.unlockUrl, 'https://kick.com/xqc');

  // A collectible is not a purchase, and must not be described as one.
  const collectible = emoteLockState({ is_locked: true, name: 'collectiblesGoldenLULW' });
  assert.equal(collectible.locked, true);
  assert.match(collectible.reason, /daily rewards/);
  assert.equal(collectible.unlockUrl, 'https://kick.com/collectibles');

  // Kick denying without a reason is reported as exactly that, not invented.
  const opaque = emoteLockState({ subscribed: false });
  assert.equal(opaque.locked, true);
  assert.match(opaque.reason, /without saying why/);

  // A set name that is not a usable slug yields no link rather than a bad one.
  assert.equal(emoteLockState({ locked: true, subscribersOnly: true }, 'Global Emotes').unlockUrl, '');
  assert.equal(emoteLockState({ access: 'locked' }, '../evil').unlockUrl, '');
});

test('live status for every saved layout comes from one bulk request', () => {
  // Kick's own sidebar reads this endpoint; one call answers for every channel.
  assert.equal(endpoints.currentViewers([7, 8]), 'https://kick.com/current-viewers?ids[]=7&ids[]=8');
  assert.equal(endpoints.currentViewers([7, 7, '']), 'https://kick.com/current-viewers?ids[]=7');

  const status = normalizeCurrentViewers([
    { livestream_id: 7, viewers: 1200 },
    { id: 8, viewer_count: 3 },
  ]);
  assert.equal(status.ok, true);
  assert.equal(status.entries.length, 2);
  assert.equal(status.entries[0].viewers, 1200);
  // Presence in the response is Kick's own signal that a channel is live.
  assert.equal(status.entries[0].live, true);
  assert.equal(status.entries[1].viewers, 3);

  // A `data`-wrapped body is the same answer.
  assert.equal(normalizeCurrentViewers({ data: [{ id: 1 }] }).entries.length, 1);

  // A reshaped payload reports rather than inventing a status, so the caller
  // can record drift instead of showing every channel as offline.
  assert.equal(normalizeCurrentViewers(null).ok, false);
  assert.equal(normalizeCurrentViewers({}).reason, 'not-a-list');
  assert.deepEqual(normalizeCurrentViewers([null, 'x', {}]).entries, []);

  // A live channel exposes the id the bulk endpoint keys on; an offline one
  // has no livestream, which is already the answer.
  const live = normalizeChannel({ id: 5, chatroom: { id: 9 }, livestream: { id: 77, is_live: true } });
  assert.equal(live.livestreamId, 77);
  assert.equal(live.isLive, true);
  assert.equal(normalizeChannel({ id: 5 }).livestreamId, 0);
});

test('the duplicate rate is measured, or reported as unavailable — never guessed', () => {
  // Kick returning a quantity is the only thing that makes duplicates knowable.
  const counted = summarizeCollectibleInventory([
    { id: 1, quantity: 3 },
    { id: 2, quantity: 1 },
  ]);
  assert.equal(counted.quantityKnown, true);
  assert.equal(counted.distinct, 2);
  assert.equal(counted.copies, 4);
  assert.equal(counted.duplicates, 2);
  assert.equal(counted.duplicateRate, 0.5);

  // The field name is read tolerantly, because this is an internal API.
  for (const field of ['quantity', 'count', 'amount', 'owned']) {
    const summary = summarizeCollectibleInventory([{ id: 1, [field]: 2 }]);
    assert.equal(summary.quantityKnown, true, `${field} should be read as a quantity`);
    assert.equal(summary.duplicates, 1, `${field} should yield one duplicate`);
  }

  // No quantity anywhere: duplicates are unknown, and must not read as zero
  // duplicates out of N — that would be a claim the payload cannot support.
  const unknown = summarizeCollectibleInventory([{ id: 1 }, { id: 2 }]);
  assert.equal(unknown.quantityKnown, false);
  assert.equal(unknown.distinct, 2);
  assert.equal(unknown.duplicates, 0);
  assert.equal(unknown.duplicateRate, 0);

  // A card without a quantity still counts as the one copy it must be.
  const mixed = summarizeCollectibleInventory([{ id: 1, quantity: 3 }, { id: 2 }]);
  assert.equal(mixed.copies, 4);
  assert.equal(mixed.duplicates, 2);

  // Junk never produces a summary to render.
  assert.equal(summarizeCollectibleInventory([]).ok, false);
  assert.equal(summarizeCollectibleInventory(undefined).ok, false);
  assert.equal(summarizeCollectibleInventory([null, 'x', 7]).ok, false);

  // Nonsense quantities are ignored rather than inflating the count.
  const junk = summarizeCollectibleInventory([{ id: 1, quantity: -5 }, { id: 2, quantity: 'many' }]);
  assert.equal(junk.quantityKnown, false);
  assert.equal(junk.copies, 2);

  // Every stated fact carries its own detail; an unsourced claim is worse than
  // silence on a page whose whole purpose is that Kick explains none of this.
  assert.ok(COLLECTIBLE_FACTS.length >= 4);
  for (const fact of COLLECTIBLE_FACTS) {
    assert.ok(fact.claim && fact.detail, 'a fact needs both a claim and its basis');
  }
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

test('emote sets keep access honest when the public catalog carries no entitlement', () => {
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
  assert.equal(golden.entitlement, 'unknown');
  assert.equal(catalogEmoteAccess(golden), 'locked');
  assert.equal(result.emotes.find((emote) => emote.name === 'cobraHi').usableEverywhere, false);
  assert.equal(catalogEmoteAccess(result.emotes.find((emote) => emote.name === 'cobraHi')), 'channel');
  assert.equal(result.emotes.find((emote) => emote.name === 'KEKW').usableEverywhere, true);
  assert.equal(catalogEmoteAccess(result.emotes.find((emote) => emote.name === 'KEKW')), 'available');

  // An explicit ownership signal may upgrade a subscriber emote. The live
  // /emotes/{slug} response observed on 2026-08-16 supplies no such field, so
  // subscriber-only artwork defaults to browseable-but-locked.
  const entitled = normalizeEmoteSets([{ id: 12, name: 'lacobraaa', emotes: [
    { id: 2, name: 'Owned', subscribers_only: true, subscribed: true },
    { id: 3, name: 'Denied', subscribers_only: true, subscribed: false },
  ] }]).emotes;
  assert.equal(entitled[0].entitlement, 'granted');
  assert.equal(catalogEmoteAccess(entitled[0]), 'available');
  assert.equal(entitled[1].entitlement, 'denied');
  assert.equal(catalogEmoteAccess(entitled[1]), 'locked');

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
