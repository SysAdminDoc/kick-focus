/**
 * Kick's own API surface, as pure data handling.
 *
 * Everything here is a URL builder, a normaliser, or a join. Nothing in this
 * file performs a request, touches the DOM, or holds state, so all of it is
 * unit-tested against payload shapes captured from the live site on 2026-08-15.
 *
 * Boundaries this module holds to, deliberately:
 *   - Request-free. This module only builds URLs and normalizes data. Runtime
 *     owns the single deliberate Follow mutation used by click-to-save.
 *   - Same-origin, inheriting whatever session the page already has. Nothing
 *     handles, stores or forwards a credential.
 *   - Only endpoints Kick's own client already calls from the page.
 *   - Every normaliser tolerates a changed shape and reports it, because the
 *     one thing certain about an internal API is that it will change.
 */

export const KICK_ORIGIN = 'https://kick.com';
export const KICK_WEB_ORIGIN = 'https://web.kick.com';

/** Emote images are content-addressed by id; the size suffix is Kick's own. */
export function emoteImageUrl(id, size = 'fullsize') {
  return `https://files.kick.com/emotes/${encodeURIComponent(String(id))}/${size}`;
}

export const endpoints = {
  channel: (slug) => `${KICK_ORIGIN}/api/v2/channels/${encodeURIComponent(slug)}`,
  followChannel: (slug) => `${KICK_ORIGIN}/api/v2/channels/${encodeURIComponent(slug)}/follow`,
  /**
   * This account's relationship to one channel: `subscription`, `is_following`,
   * `is_moderator`, `banned`. The only first-party statement of subscription
   * this build has ever had — measured 2026-08-16, it answers 401 to a
   * cookie-only read and 200 to the same read carrying Kick's bearer token.
   */
  channelMe: (slug) => `${KICK_ORIGIN}/api/v2/channels/${encodeURIComponent(slug)}/me`,
  emoteSets: (slug) => `${KICK_ORIGIN}/emotes/${encodeURIComponent(slug)}`,
  chatSettings: (channelId) => `${KICK_WEB_ORIGIN}/api/v1/channels/${encodeURIComponent(channelId)}/chat/settings`,
  chatHistory: (chatroomId) => `${KICK_WEB_ORIGIN}/api/v1/chat/${encodeURIComponent(chatroomId)}/history`,
  collectibles: () => `${KICK_WEB_ORIGIN}/api/v1/gamification/collectibles`,
  /**
   * One channel's recent VODs, and the only way to date one.
   *
   * Keyed by channel **id**, and on **web.kick.com v1** — not the
   * `kick.com/api/v2/channels/{slug}/videos` that also answers. The difference
   * matters and cost a whole pass to find: the v2 list's entries carry a v4
   * `video.uuid` that matches nothing in the page URL, while this list's `id`
   * *is* the v7 UUID at `/{slug}/videos/{uuid}`. Measured 2026-08-18.
   *
   * There is no single-video read to prefer over it: `web.kick.com/api/v1/`
   * `{videos,video,streams}/{uuid}` and `kick.com/api/v1/videos/{uuid}` are all
   * 404, and `stream/{uuid}/playback` is 404 once the VOD is not live. So a
   * recording older than this list's window simply cannot be resolved, and the
   * caller must say nothing rather than guess.
   */
  channelVideos: (channelId) => `${KICK_WEB_ORIGIN}/api/v1/channels/${encodeURIComponent(channelId)}/videos`,
  /**
   * One request for the live state of many channels, instead of N per-channel
   * polls. Kick's own sidebar uses it.
   */
  currentViewers: (ids) => {
    const query = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
      .map((id) => `ids[]=${encodeURIComponent(id)}`)
      .join('&');
    return `${KICK_ORIGIN}/current-viewers?${query}`;
  },
  /**
   * The realtime *broker*, not a realtime connection. It answers with whichever
   * provider is currently in force. See `normalizeRealtimeConnection`.
   */
  realtimeChat: (chatroomId, clientId) =>
    `${KICK_WEB_ORIGIN}/api/v1/realtime/chat/${encodeURIComponent(chatroomId)}/client/${encodeURIComponent(clientId)}/connection`,
};

/**
 * Kick's own embeddable surfaces, verified frameable on 2026-08-15 (200, and
 * neither sends X-Frame-Options nor a frame-ancestors CSP).
 *
 * These are Kick's real player and chat, not a reimplementation: playback,
 * subscriptions, and entitlements all stay Kick's, which is what keeps a
 * multi-stream grid from becoming a workaround for anything.
 */
export function playerEmbedUrl(slug, { muted = true, autoplay = true } = {}) {
  const params = new URLSearchParams({ muted: String(muted), autoplay: String(autoplay) });
  return `https://player.kick.com/${encodeURIComponent(slug)}?${params}`;
}

export function chatEmbedUrl(slug) {
  return `${KICK_ORIGIN}/popout/${encodeURIComponent(slug)}/chat`;
}

/** Kick channel slugs: what the site itself accepts in a path segment. */
export function isValidSlug(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(value);
}

/**
 * Accept whatever a person is most likely to paste: a bare name, a kick.com
 * URL, a URL with query or trailing path, or a name with stray whitespace.
 */
export function parseChannelInput(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  let candidate = text;
  if (/^https?:\/\//i.test(text) || /^(?:www\.)?kick\.com\//i.test(text)) {
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      if (!/(^|\.)kick\.com$/i.test(url.hostname)) return '';
      candidate = url.pathname.replace(/^\//, '').split('/')[0];
    } catch {
      return '';
    }
  }
  candidate = candidate.replace(/^@/, '').split(/[?#/]/)[0];
  return isValidSlug(candidate) ? candidate : '';
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

/** Pusher's documented client handshake. The key never appears in our source. */
export function pusherSocketUrl({ appKey, cluster }, version = '8.6.0') {
  return `wss://ws-${cluster}.pusher.com/app/${appKey}?protocol=7&client=js&version=${version}&flash=false`;
}

/**
 * Kick's own gateway, which speaks the same wire protocol as the hosted Pusher
 * path — same `pusher:subscribe` frames, same `chatrooms.{id}.v2` channel
 * names, same `App\Events\ChatMessageEvent` payloads. Only the handshake
 * differs: a token instead of an app key and cluster.
 *
 * Never contacted from this project. It is registered so a forced migration is
 * an added URL builder rather than a rewrite, and it is marked unverified so
 * nothing claims it works until a live run says so.
 */
export function kickGatewaySocketUrl({ token }) {
  return `wss://websockets.kick.com/viewer/v1/connect?token=${encodeURIComponent(token)}`;
}

/**
 * One entry per realtime provider Kick's broker can name.
 *
 * The split that matters: `socketUrl` and `credentials` are the *transport* and
 * differ per provider, while the frame protocol below is shared because Kick's
 * own gateway reuses Pusher's wire format. Adding a provider is one entry here,
 * not a change to frame parsing or subscription management.
 */
export const REALTIME_TRANSPORTS = Object.freeze({
  PUSHER: Object.freeze({
    id: 'PUSHER',
    label: 'Pusher',
    // Verified by anonymous handshake against the live service on 2026-08-15.
    verified: true,
    credentials(entry) {
      const appKey = entry?.credentials?.app_key;
      const cluster = entry?.credentials?.cluster;
      if (typeof appKey !== 'string' || !appKey) return null;
      if (typeof cluster !== 'string' || !cluster) return null;
      return { appKey, cluster };
    },
    socketUrl: pusherSocketUrl,
  }),
  KICK: Object.freeze({
    id: 'KICK',
    label: 'Kick gateway',
    // Never reached from this project. See "Realtime transport" in README.
    verified: false,
    credentials(entry) {
      const token = entry?.credentials?.token || entry?.credentials?.auth_token;
      if (typeof token !== 'string' || !token) return null;
      return { token };
    },
    socketUrl: kickGatewaySocketUrl,
  }),
});


export function realtimeTransport(provider) {
  return REALTIME_TRANSPORTS[String(provider || '').toUpperCase()] || null;
}

/**
 * Read the broker's answer without assuming Pusher.
 *
 * The response carries an array of connections behind a `provider`
 * discriminator, and Kick's client tracks a `degraded` connection state — a
 * multi-provider failover abstraction it can flip server-side. A build that
 * hardcodes the Pusher app key keeps working right up until it silently does
 * not, so an unrecognised provider must degrade to the DOM path rather than
 * throw or guess.
 *
 * A verified provider is preferred over an unverified one when the broker
 * offers both, so a migration only takes effect once Kick stops offering the
 * path this project has actually run against.
 */
export function normalizeRealtimeConnection(payload) {
  const connections = payload?.data?.connections;
  if (!Array.isArray(connections) || connections.length === 0) {
    return { ok: false, reason: 'no-connections' };
  }
  const known = connections
    .map((entry) => ({ entry, transport: realtimeTransport(entry?.provider) }))
    .filter((candidate) => candidate.transport);
  if (!known.length) {
    const offered = connections.map((entry) => String(entry?.provider || 'unknown'));
    return { ok: false, reason: 'unsupported-provider', offered };
  }
  const chosen = known.find((candidate) => candidate.transport.verified) || known[0];
  const credentials = chosen.transport.credentials(chosen.entry);
  if (!credentials) return { ok: false, reason: 'incomplete-credentials' };
  return {
    ok: true,
    provider: chosen.transport.id,
    transport: chosen.transport,
    verified: chosen.transport.verified,
    ...credentials,
    mode: payload?.data?.mode || 'WEBSOCKET',
  };
}

/**
 * The frame protocol, shared by every transport.
 *
 * Kept apart from the connection method on purpose: this is what a second
 * transport must *not* have to reimplement.
 */
export function realtimeSubscribeFrame(channel) {
  // Public channels need no auth; an empty auth string is what Kick's own
  // client sends for them.
  return JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel } });
}

/**
 * Classify one inbound frame. Returns a `kind` the caller dispatches on, so
 * frame shape knowledge lives here rather than in the socket wiring.
 */
export function parseRealtimeFrame(raw) {
  let frame;
  try {
    frame = JSON.parse(raw);
  } catch {
    // A run of frames we cannot read means Kick changed its payload shape.
    // That is a different problem from silence and deserves to be visible.
    return { kind: 'unparsable' };
  }
  const event = String(frame?.event || '');
  if (event === 'pusher:connection_established') return { kind: 'established', event };
  if (event === 'pusher_internal:subscription_succeeded') return { kind: 'subscription-ack', event };

  let payload = frame?.data;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { return { kind: 'other', event }; }
  }
  if (!payload || typeof payload !== 'object') return { kind: 'other', event };

  if (event.endsWith('ChatMessageEvent')) return { kind: 'chat-message', event, payload };
  if (event.endsWith('MessageDeletedEvent')) return { kind: 'deletion', event, payload };
  return { kind: 'other', event, payload };
}

/**
 * Kick's channel naming is inconsistent by design: `chatrooms.{id}.v2` and
 * `chatroom_{id}` are different channels carrying different events, as are
 * `channel.{id}` and `channel_{id}`. Getting a separator wrong subscribes
 * successfully to a channel that is simply never published to, which looks
 * exactly like a working connection.
 */
export function realtimeChannels({ chatroomId, channelId }) {
  const names = [];
  if (chatroomId) names.push(`chatrooms.${chatroomId}.v2`, `chatroom_${chatroomId}`);
  if (channelId) names.push(`channel.${channelId}`, `channel_${channelId}`);
  return names;
}

/**
 * A dead Kick socket stays `readyState === OPEN` and never fires `close` or
 * `error`, so "connected" is not evidence of anything. Liveness is inferred
 * from inbound traffic, and a run of unparseable frames is treated as Kick
 * having changed shape rather than as noise to swallow.
 */
export const REALTIME_SILENCE_MS = 60_000;
export const REALTIME_UNPARSABLE_LIMIT = 20;

export function realtimeHealth({ lastFrameAt = 0, unparsable = 0, now = 0, connected = false }) {
  if (!connected) return { state: 'offline', healthy: false };
  if (unparsable >= REALTIME_UNPARSABLE_LIMIT) {
    return { state: 'unparsable', healthy: false, detail: `${unparsable} consecutive frames could not be read. Kick's payload shape has probably changed.` };
  }
  if (lastFrameAt && now - lastFrameAt > REALTIME_SILENCE_MS) {
    return { state: 'stale', healthy: false, detail: `No events for ${Math.round((now - lastFrameAt) / 1000)}s. The socket reports open but is not delivering.` };
  }
  return { state: 'live', healthy: true };
}

// ---------------------------------------------------------------------------
// Channel identity
// ---------------------------------------------------------------------------

/**
 * Kick's livestream timestamps, as milliseconds, or 0.
 *
 * `created_at` and `start_time` arrive as `2026-08-16 23:53:38` — a space
 * instead of a `T` and no zone marker at all. `new Date()` reads that as
 * *local* time, so a viewer in New York would have seen a stream that started
 * four minutes ago reported as four hours and four minutes. The values are
 * UTC — confirmed against the same channel's `livestream.created_at` and the
 * live viewer's own clock on 2026-08-16 — so the zone is supplied here rather
 * than trusted to the engine's parse of an ambiguous string.
 */
export function parseKickTimestamp(value) {
  if (typeof value !== 'string' || !value) return 0;
  const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value.trim())
    ? `${value.trim().replace(' ', 'T')}Z`
    : value;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? at : 0;
}

/**
 * Whether a request is one of Kick's discovery livestream feeds.
 *
 * The runtime uses this only to observe a response the page already requested.
 * Keeping the boundary here prevents a channel read, VOD list, or third-party
 * URL that happens to contain "livestreams" from becoming discovery metadata.
 */
export function isDiscoveryLivestreamUrl(value, base = KICK_ORIGIN) {
  try {
    const url = new URL(String(value ?? ''), base);
    if (!/(^|\.)kick\.com$/i.test(url.hostname)) return false;
    return /^\/api\/v\d+\/livestreams(?:\/|$)/i.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * Live start times keyed by channel slug from a discovery response.
 *
 * Only `start_time` counts. A row's `created_at` can describe the record rather
 * than the current broadcast, so falling back to it would put a confident but
 * wrong clock on a card. Traversal is limited to Kick's known envelope names
 * and capped, making a changed or hostile response cheap to ignore.
 */
export function normalizeDiscoveryLiveStarts(payload, limit = 500) {
  const cap = Math.max(1, Math.min(500, Number.isFinite(limit) ? Math.floor(limit) : 500));
  const starts = new Map();
  const queue = [payload];
  const seen = new Set();
  const maxVisits = Math.max(32, cap * 4);
  let visits = 0;

  while (queue.length && visits < maxVisits && starts.size < cap) {
    const value = queue.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    visits += 1;

    if (Array.isArray(value)) {
      for (const entry of value.slice(0, cap)) {
        if (queue.length + seen.size >= maxVisits) break;
        queue.push(entry);
      }
      continue;
    }

    const slug = value.channel?.slug
      || value.channel?.username
      || value.channel?.user?.username
      || value.channel_slug
      || value.slug;
    const startedAt = parseKickTimestamp(value.start_time);
    if (isValidSlug(slug) && startedAt) {
      const key = slug.toLowerCase();
      starts.set(key, Math.max(starts.get(key) || 0, startedAt));
    }

    for (const key of ['data', 'livestreams', 'streams', 'featured', 'results', 'items']) {
      if (queue.length + seen.size >= maxVisits) break;
      if (value[key] && typeof value[key] === 'object') queue.push(value[key]);
    }
  }

  return starts;
}

/**
 * A live stream's start time out of the page's own structured data.
 *
 * Kick ships a schema.org `VideoObject` whose `uploadDate` is the stream start,
 * in the same zone-less form as the API's `start_time`. It is in the HTML, so
 * it needs no request — which matters because Kick's bot defence answers 429 to
 * the channel API often enough that a feature depending on that read alone
 * silently does nothing. Measured 2026-08-16: a live channel carries the block;
 * an offline one carries only `ProfilePage`, so its absence is itself the
 * liveness answer.
 *
 * Takes the raw script texts rather than a document, so the parse is testable
 * without a DOM. Kick ships several blocks and not all of them parse — a bad
 * one is skipped rather than treated as the answer.
 */
export function streamStartFromLinkedData(texts) {
  if (!Array.isArray(texts)) return 0;
  for (const text of texts) {
    let parsed = null;
    try {
      parsed = JSON.parse(String(text));
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [parsed];
    for (const node of nodes) {
      if (node && typeof node === 'object' && node['@type'] === 'VideoObject') {
        const at = parseKickTimestamp(node.uploadDate);
        if (at) return at;
      }
    }
  }
  return 0;
}

export function normalizeChannel(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const id = Number(payload.id);
  if (!Number.isFinite(id)) return null;
  const livestream = payload.livestream && typeof payload.livestream === 'object' ? payload.livestream : null;
  return {
    id,
    userId: Number(payload.user_id) || 0,
    slug: typeof payload.slug === 'string' ? payload.slug : '',
    chatroomId: Number(payload.chatroom?.id) || 0,
    // The bulk live-status endpoint keys on the livestream, not the channel, so
    // an offline channel has no id here — which is itself the answer.
    livestreamId: Number(livestream?.id) || 0,
    followers: Number(payload.followers_count) || 0,
    // The retention tier, and the only trustworthy statement of it. The VOD
    // entries carry a `tier` field that reads "unverified" for a channel whose
    // own payload says `verified: true` — measured on xQc, 2026-08-18 — so this
    // is the source and that field is ignored. Kick has returned both a boolean
    // and a record here, hence the coercion rather than a strict compare.
    verified: Boolean(payload.verified),
    isLive: Boolean(livestream?.is_live),
    // Kick returns this and shows it nowhere: its own page has no uptime.
    startedAt: parseKickTimestamp(livestream?.start_time) || parseKickTimestamp(livestream?.created_at),
    viewers: Number(livestream?.viewer_count) || 0,
    title: typeof livestream?.session_title === 'string' ? livestream.session_title : '',
    mature: Boolean(livestream?.is_mature),
    language: typeof livestream?.language === 'string' ? livestream.language : '',
    categories: Array.isArray(livestream?.categories)
      ? livestream.categories.map((entry) => String(entry?.slug || '')).filter(Boolean)
      : [],
  };
}

/**
 * The recent VOD list, reduced to what dating one needs.
 *
 * `start_time` and `end_time` arrive here as zone-declared ISO
 * (`2026-08-18T00:47:57Z`), unlike the zone-less form the livestream payload
 * uses — `parseKickTimestamp` passes a declared zone through untouched, so both
 * go through the same parse and neither is guessed at.
 *
 * The entry's own `tier` is deliberately not carried through. See
 * `normalizeChannel`: it disagrees with the channel's `verified` flag, so
 * reading it would put a wrong retention window on screen.
 */
export function normalizeChannelVideos(payload) {
  const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : null);
  if (!rows) return null;
  const videos = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id) continue;
    videos.push({
      id,
      startedAt: parseKickTimestamp(row.start_time),
      endedAt: parseKickTimestamp(row.end_time),
      durationSeconds: Number(row.duration) || 0,
      title: typeof row.title === 'string' ? row.title : '',
      status: typeof row.status === 'string' ? row.status : '',
    });
  }
  return videos;
}

/** The entry a VOD page URL names, or null when it is outside the list. */
export function findChannelVideo(videos, id) {
  if (!Array.isArray(videos) || typeof id !== 'string' || !id) return null;
  return videos.find((video) => video.id === id) || null;
}

// ---------------------------------------------------------------------------
// Emotes
// ---------------------------------------------------------------------------

/**
 * Kick's own marker for a Daily Rewards emote is the name prefix — there is no
 * type field on the emote itself.
 */
export const COLLECTIBLE_PREFIX = 'collectibles';

export function isCollectibleEmote(name) {
  return typeof name === 'string' && name.startsWith(COLLECTIBLE_PREFIX);
}

/**
 * Collectible emotes can be 2:1, and every third-party renderer squashes them
 * square because the rule lives only in Kick's own client. Measure the loaded
 * image rather than trusting the name: the prefix alone is not the rule, and a
 * name-only guess stretches ordinary square collectibles.
 */
export const WIDE_ASPECT_RATIO = 1.2;

export function emoteAspect(name, naturalWidth, naturalHeight) {
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  if (!isCollectibleEmote(name)) return 'square';
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return 'square';
  return width / height > WIDE_ASPECT_RATIO ? 'wide' : 'square';
}

function setKind(name) {
  const label = String(name || '').toLowerCase();
  if (label === 'global') return 'global';
  if (label === 'emojis') return 'emoji';
  // Only an authenticated read carries this set, and it holds the collectibles
  // this account has actually pulled. Without its own kind it parses as a
  // channel named "Collectibles" whose free emotes look channel-local, which is
  // the opposite of true: a pulled collectible is usable in every chat.
  if (label === 'collectibles') return 'collectible';
  return 'channel';
}

/**
 * Explicit entitlement only. The public /emotes/{slug} response normally
 * carries subscribers_only but no ownership signal, so "unknown" must stay
 * distinct from both granted and denied.
 */
function emoteEntitlement(source) {
  const emote = source && typeof source === 'object' ? source : {};
  const value = emote.subscribed ?? emote.is_subscribed ?? emote.subscription
    ?? emote.entitled ?? emote.unlocked ?? emote.owned;
  if (value === true || value === 1 || (value && typeof value === 'object')) return 'granted';
  if (value === false || value === 0 || emote.locked === true || emote.is_locked === true) return 'denied';
  return 'unknown';
}

/**
 * A follow must never be inferred from an ordinary channel emote. Kick's own
 * help says channel emotes are local to that chat; a follow gate is actionable
 * only when the response explicitly carries one of the known gate fields.
 */
export function emoteFollowRequirement(emote, slug = '') {
  const source = emote && typeof emote === 'object' ? emote : {};
  const required = source.requiresFollow === true
    || source.requires_follow === true
    || source.followRequired === true
    || source.follow_required === true
    || source.followersOnly === true
    || source.followers_only === true
    || source.follow_only === true;
  const value = source.followed ?? source.is_following ?? source.following;
  const followed = value === true || value === 1 || Boolean(value && typeof value === 'object');
  const candidate = String(slug || source.sourceSlug || source.slug || source.setName || '').trim();
  return { required, followed, slug: isValidSlug(candidate) ? candidate : '' };
}

/**
 * What an API-only catalog entry may honestly claim before the native picker
 * corroborates it. Public artwork is not proof that the account can send it.
 */
export function catalogEmoteAccess(emote) {
  const source = emote && typeof emote === 'object' ? emote : {};
  if (source.kind === 'global' || source.kind === 'emoji' || source.kind === 'collectible') return 'available';
  const follow = emoteFollowRequirement(source);
  if (follow.required && !follow.followed) return 'locked';
  if (!source.subscribersOnly && !source.subscribers_only) return 'channel';
  return (source.entitlement || emoteEntitlement(source)) === 'granted' ? 'available' : 'locked';
}

/**
 * Turn `/emotes/{slug}` into a flat, deduplicated catalog.
 *
 * Two facts drive the shape here:
 *
 *   - `subscribers_only` is not only an entitlement flag. Kick uses it to mean
 *     "usable in every chat", which is inverted from what the name suggests: a
 *     free channel emote works only in its own channel, while a sub emote
 *     travels everywhere. That is why `global` is derived from it.
 *   - Kick resolves a typed name through one name-keyed map where the last set
 *     loaded wins, so duplicate names across sets are a real collision, not a
 *     display detail. `normalizeEmoteSets` keeps every occurrence so the
 *     collision can be reported; see `findShadowedNames`.
 */
export function normalizeEmoteSets(payload) {
  if (!Array.isArray(payload)) return { ok: false, reason: 'not-an-array', sets: [], emotes: [] };
  const sets = [];
  const emotes = [];
  for (const rawSet of payload) {
    if (!rawSet || typeof rawSet !== 'object') continue;
    const kind = setKind(rawSet.name);
    const setName = typeof rawSet.name === 'string' && rawSet.name ? rawSet.name : (rawSet.slug || 'Channel');
    const sourceSlugCandidate = typeof rawSet.slug === 'string' && rawSet.slug ? rawSet.slug : setName;
    const sourceSlug = kind === 'channel' && isValidSlug(sourceSlugCandidate) ? sourceSlugCandidate : '';
    const list = Array.isArray(rawSet.emotes) ? rawSet.emotes : [];
    const normalized = [];
    for (const raw of list) {
      const id = raw?.id;
      const name = raw?.name;
      if ((typeof id !== 'number' && typeof id !== 'string') || typeof name !== 'string' || !name) continue;
      const follow = emoteFollowRequirement({ ...rawSet, ...raw }, sourceSlug);
      const entry = {
        id: String(id),
        name,
        setId: rawSet.id == null ? null : String(rawSet.id),
        setName,
        sourceSlug,
        kind,
        channelId: raw.channel_id == null ? null : String(raw.channel_id),
        // Kick's flag: subscriber emotes are usable platform-wide.
        subscribersOnly: Boolean(raw.subscribers_only),
        requiresFollow: follow.required,
        followed: follow.followed,
        usableEverywhere: kind !== 'channel' || Boolean(raw.subscribers_only),
        entitlement: emoteEntitlement(raw),
        collectible: isCollectibleEmote(name),
        url: emoteImageUrl(id),
      };
      normalized.push(entry);
      emotes.push(entry);
    }
    sets.push({ id: rawSet.id == null ? null : String(rawSet.id), name: setName, kind, emotes: normalized });
  }
  // A catalog with no usable emote is not a catalog — sets full of entries that
  // failed validation mean Kick changed shape, and the caller must fall back to
  // scraping rather than render an empty picker as success.
  if (!sets.length) return { ok: false, reason: 'no-sets', sets: [], emotes: [] };
  if (!emotes.length) return { ok: false, reason: 'no-emotes', sets, emotes };
  return { ok: true, sets, emotes };
}

/**
 * Fold this account's own entitlement into a normalized catalog.
 *
 * Measured against Kick on 2026-08-16, reading `/emotes/xqc` twice from the
 * same page: a cookie-only read returned three sets (the channel, Global,
 * Emojis) and 12,566 bytes. The same read carrying Kick's bearer token returned
 * thirteen sets and 44,404 bytes — the nine extra channel sets were every
 * channel this account subscribes to, each one entirely `subscribers_only`,
 * plus a Collectibles set of the collectibles it had pulled.
 *
 * So the authenticated response *is* Kick's own answer to "what may this
 * account send", which is the explicit entitlement this build has always
 * required and never had. A set Kick returns for a channel other than the one
 * asked about is returned because the account owns it; that is a statement,
 * not an inference from artwork.
 *
 * Two server refusals, both measured by sending into a real chatroom, fix the
 * other half of the model:
 *
 *   - `SUBSCRIBERS_ONLY_EMOTE_ERROR` — a subscriber emote from a channel this
 *     account does not subscribe to is refused, in that channel's own chat and
 *     everywhere else alike.
 *   - `FOREIGN_CHANNEL_EMOTE_ERROR` — a *free* channel emote is refused
 *     anywhere but its own channel.
 *
 * Which is Kick's inverted `subscribers_only` stated as consequences: a free
 * channel emote is local, an owned subscriber emote is global.
 *
 * Anonymous catalogs are returned untouched. Entitlement is never invented for
 * a reader Kick did not recognise.
 */
export function applyAccountEntitlement(catalog, { slug = '', authenticated = false, subscribedToChannel = null } = {}) {
  if (!catalog?.ok || !Array.isArray(catalog.emotes)) return catalog;
  if (!authenticated) return { ...catalog, account: { authenticated: false, ownedSets: [], ownedEmotes: 0 } };

  const asked = String(slug || '').toLowerCase();
  const ownedSets = new Set();
  let ownedEmotes = 0;

  const decide = (emote) => {
    // Global, Emojis, and the collectibles this account has pulled.
    if (emote.kind !== 'channel') return { entitlement: 'granted', usableEverywhere: true, usableHere: true };
    const own = String(emote.sourceSlug || emote.setName || '').toLowerCase() === asked;
    if (!own) {
      // A set for another channel, in a response Kick only serves to its owner.
      return { entitlement: 'granted', usableEverywhere: true, usableHere: true };
    }
    if (!emote.subscribersOnly) {
      // Free, and therefore local to this channel — usable here, nowhere else.
      return { entitlement: emote.entitlement, usableEverywhere: false, usableHere: true };
    }
    if (subscribedToChannel === true) return { entitlement: 'granted', usableEverywhere: true, usableHere: true };
    if (subscribedToChannel === false) return { entitlement: 'denied', usableEverywhere: true, usableHere: false };
    return { entitlement: emote.entitlement, usableEverywhere: true, usableHere: false };
  };

  const remap = (emote) => {
    const verdict = decide(emote);
    const next = { ...emote, ...verdict };
    if (verdict.entitlement === 'granted') {
      ownedEmotes += 1;
      if (next.kind === 'channel' && next.setName) ownedSets.add(next.setName);
    }
    return next;
  };

  const emotes = catalog.emotes.map(remap);
  const byKey = new Map(emotes.map((emote) => [`${emote.setId}|${emote.id}`, emote]));
  const sets = catalog.sets.map((set) => ({
    ...set,
    emotes: set.emotes.map((emote) => byKey.get(`${set.id}|${emote.id}`) || emote),
  }));
  return {
    ...catalog,
    sets,
    emotes,
    account: { authenticated: true, ownedSets: [...ownedSets].sort(), ownedEmotes },
  };
}

/**
 * Return only the requested channel's own set from a normalized response.
 * The response also carries Global/Emoji sets (and may eventually carry other
 * account sets), none of which an arbitrary-channel import should duplicate.
 */
export function channelCatalogEmotes(catalog, slug) {
  if (!catalog?.ok || !Array.isArray(catalog.sets) || !isValidSlug(slug)) return [];
  const wanted = String(slug).toLowerCase();
  const set = catalog.sets.find((entry) => entry.kind === 'channel'
    && String(entry.name || '').toLowerCase() === wanted);
  return Array.isArray(set?.emotes) ? set.emotes : [];
}

/**
 * Why an emote is unavailable, and where Kick itself lets you unlock it.
 *
 * Entitlement is read across several shapes on purpose. Kick has expressed
 * subscription state in more than one way, and a single-shape check produces
 * *false negatives* — the documented failure is a client greying out emotes the
 * user does own, which is far worse than showing one it cannot confirm. So the
 * default when nothing says otherwise is unlocked, and only an explicit signal
 * locks an entry.
 *
 * Nothing here enables anything or sends anything. It explains, and links to
 * Kick's own page.
 */
export function emoteLockState(emote, slug = '') {
  const source = emote && typeof emote === 'object' ? emote : {};
  const channel = String(slug || source.setName || '').trim();
  const follow = emoteFollowRequirement(source, channel);

  if (follow.required && !follow.followed) {
    return {
      locked: true,
      reason: follow.slug
        ? `Follow ${follow.slug} on Kick to use this channel emote.`
        : 'Follow the source channel on Kick to use this channel emote.',
      unlockUrl: follow.slug ? `${KICK_ORIGIN}/${encodeURIComponent(follow.slug)}` : '',
    };
  }

  // Any of these, in any of the shapes seen, means Kick says it is available.
  const entitled = source.subscribed ?? source.is_subscribed ?? source.subscription
    ?? source.entitled ?? source.unlocked ?? source.owned;
  if (entitled === true || entitled === 1 || (entitled && typeof entitled === 'object')) {
    return { locked: false, reason: '', unlockUrl: '' };
  }

  // An explicit denial is the only thing that locks an entry.
  const denied = source.locked === true
    || source.is_locked === true
    || entitled === false || entitled === 0
    || source.access === 'locked';
  if (!denied) return { locked: false, reason: '', unlockUrl: '' };

  if (source.collectible || isCollectibleEmote(source.name)) {
    return {
      locked: true,
      reason: 'A collectible you have not pulled yet. These come from Kick’s daily rewards, not from a purchase.',
      unlockUrl: `${KICK_ORIGIN}/collectibles`,
    };
  }
  if (source.subscribersOnly || source.subscribers_only) {
    return {
      locked: true,
      reason: channel
        ? `Subscriber emote. Subscribing to ${channel} on Kick unlocks it, and it then works in every chat.`
        : 'Subscriber emote. Subscribing to this channel on Kick unlocks it, and it then works in every chat.',
      unlockUrl: channel && isValidSlug(channel) ? `${KICK_ORIGIN}/${encodeURIComponent(channel)}` : '',
    };
  }
  return {
    locked: true,
    reason: 'Kick reports this emote as unavailable to your account, without saying why.',
    unlockUrl: channel && isValidSlug(channel) ? `${KICK_ORIGIN}/${encodeURIComponent(channel)}` : '',
  };
}

/**
 * Which typed names resolve to something other than what the user expects.
 *
 * Sub emotes work in every chat, and Kick matches a typed name against a single
 * name-keyed Map, so two channels shipping `KEKW` means one of them silently
 * sends the other's image. Collisions grow with each subscription, and nothing
 * on Kick surfaces them.
 *
 * "Last loaded wins" is the platform's own resolution order, so the winner is
 * the last occurrence, not the first.
 */
export function findShadowedNames(emotes) {
  const byName = new Map();
  for (const emote of emotes || []) {
    const current = byName.get(emote.name) || [];
    current.push(emote);
    byName.set(emote.name, current);
  }
  const collisions = [];
  for (const [name, entries] of byName) {
    if (entries.length < 2) continue;
    const winner = entries.at(-1);
    collisions.push({
      name,
      winner,
      shadowed: entries.slice(0, -1),
      sets: entries.map((entry) => entry.setName),
    });
  }
  return collisions.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Chat events
// ---------------------------------------------------------------------------

/** Kick's chat wire format, e.g. `[emote:37226:KEKW]`. */
const EMOTE_TOKEN = /\[emote:(\d+):([^\]]*)\]/g;

/**
 * Bounds for anything arriving over the realtime socket.
 *
 * The subscription is anonymous and public, so a frame is untrusted input by
 * construction — not because Kick is hostile, but because nothing about the
 * transport guarantees otherwise. Every consumer of these normalizers inherits
 * whatever assumption is set here, so the bounds live at the boundary rather
 * than at each call site.
 */
const LIMITS = Object.freeze({
  id: 128,
  content: 2000,
  username: 80,
  color: 32,
  segments: 200,
  badges: 24,
  badgeText: 60,
  rules: 12,
  url: 400,
});

/** Coerce to a bounded string; anything else becomes empty rather than throwing. */
function boundedString(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/**
 * Split message content into text and emote segments.
 *
 * Kick's rendered DOM gives an `<img>` with an alt attribute; the wire format
 * gives the emote *id*, which is what a usage counter and a rarity join both
 * actually need. A name is not an identity on Kick — see `findShadowedNames`.
 */
export function parseEmoteTokens(content) {
  const text = boundedString(content, LIMITS.content);
  const segments = [];
  let index = 0;
  EMOTE_TOKEN.lastIndex = 0;
  for (const match of text.matchAll(EMOTE_TOKEN)) {
    // A message crafted to be thousands of tokens must not become thousands of
    // nodes downstream.
    if (segments.length >= LIMITS.segments) break;
    if (match.index > index) segments.push({ type: 'text', value: text.slice(index, match.index) });
    segments.push({ type: 'emote', id: match[1].slice(0, LIMITS.id), name: match[2].slice(0, LIMITS.username) });
    index = match.index + match[0].length;
  }
  if (index < text.length && segments.length < LIMITS.segments) {
    segments.push({ type: 'text', value: text.slice(index) });
  }
  return segments;
}

export function normalizeChatMessage(event) {
  if (!event || typeof event !== 'object') return null;
  const id = event.id;
  if (!id || (typeof id !== 'string' && typeof id !== 'number')) return null;
  const sender = event.sender || {};
  const identity = sender.identity || {};
  // badges_v2 supersedes badges: it carries image URLs and covers the global
  // and collectible badges the legacy array omits entirely.
  const badges = Array.isArray(identity.badges_v2) && identity.badges_v2.length
    ? identity.badges_v2
    : (Array.isArray(identity.badges) ? identity.badges : []);
  const segments = parseEmoteTokens(event.content);
  return {
    id: String(id).slice(0, LIMITS.id),
    content: boundedString(event.content, LIMITS.content),
    segments,
    emotes: segments.filter((segment) => segment.type === 'emote'),
    createdAt: boundedString(event.created_at, LIMITS.id),
    sender: {
      id: sender.id == null ? '' : String(sender.id).slice(0, LIMITS.id),
      username: boundedString(sender.username, LIMITS.username),
      slug: boundedString(sender.slug, LIMITS.username),
      // A colour goes straight into a style, so it is restricted to shapes CSS
      // can only read as a colour — never an arbitrary attacker-chosen string.
      color: /^#[0-9a-f]{3,8}$/i.test(String(identity.color || '')) ? String(identity.color) : '',
    },
    badges: badges.slice(0, LIMITS.badges).map((badge) => ({
      type: boundedString(badge?.type || badge?.badge_type, LIMITS.badgeText),
      text: boundedString(badge?.text || badge?.name, LIMITS.badgeText),
      // Only https URLs on Kick's own CDNs; a javascript: or data: image URL
      // has no legitimate reason to arrive here.
      image: /^https:\/\/[a-z0-9.-]*kick\.com\//i.test(String(badge?.image_url || ''))
        ? String(badge.image_url).slice(0, LIMITS.url)
        : '',
    })).filter((badge) => badge.type || badge.text),
  };
}

/** Kick's own rule slugs, as they appear in `violatedRules`. */
const RULE_LABELS = {
  bullying: 'bullying',
  harassment: 'harassment',
  hate_speech: 'hate speech',
  hateful_conduct: 'hateful conduct',
  spam: 'spam',
  self_harm: 'self-harm',
  sexual_content: 'sexual content',
  violence: 'violence',
};

/**
 * Why a message disappeared.
 *
 * `MessageDeletedEvent` carries `{aiModerated, violatedRules}`, but the DOM only
 * removes the node — so every DOM-scraping tool can see *that* a message went
 * and none can see *why*. Kick's non-disableable AI moderation is among the
 * loudest documented complaints about the platform, and this is the only place
 * the reason is exposed at all.
 */
export function normalizeDeletion(event) {
  if (!event || typeof event !== 'object') return null;
  const id = event.message?.id ?? event.id;
  if (!id || (typeof id !== 'string' && typeof id !== 'number')) return null;
  const rules = Array.isArray(event.violatedRules) ? event.violatedRules.slice(0, LIMITS.rules) : [];
  const labels = rules
    .map((rule) => RULE_LABELS[String(rule)] || String(rule).slice(0, LIMITS.badgeText).replace(/_/g, ' '))
    .filter(Boolean);
  const aiModerated = Boolean(event.aiModerated);
  let reason = 'Removed by a moderator.';
  if (aiModerated && labels.length) reason = `Removed by Kick's automatic moderation for ${labels.join(', ')}.`;
  else if (aiModerated) reason = "Removed by Kick's automatic moderation.";
  else if (labels.length) reason = `Removed for ${labels.join(', ')}.`;
  return { id: String(id).slice(0, LIMITS.id), aiModerated, rules: labels, reason };
}

// ---------------------------------------------------------------------------
// Collectible rarity
// ---------------------------------------------------------------------------

export const RARITY_ORDER = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);

function rarityRank(rarity) {
  const index = RARITY_ORDER.indexOf(String(rarity || '').toLowerCase());
  return index < 0 ? -1 : index;
}

/** Strip the marketing prefix and casing so a name can be matched in a URL. */
function joinToken(name) {
  return String(name || '')
    .replace(new RegExp(`^${COLLECTIBLE_PREFIX}`, 'i'), '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

/**
 * Join collectible card art to emote identity.
 *
 * Kick exposes rarity only on the card (`{id: uuid, card_url, owned, rarity}`,
 * no name) and identity only in the picker (`{id: int, name}`, no rarity). The
 * two payloads share no key, which is why no client anywhere can currently tell
 * a user what rarity an emote they own is.
 *
 * There is therefore no exact join, only evidence. Each strategy carries its own
 * confidence, and anything below `minConfidence` is returned as unmatched with
 * no label attached: a mislabelled Mythic is strictly worse than no label, and
 * this join is the one place in the project where being wrong is worse than
 * being silent.
 */
export const RARITY_MIN_CONFIDENCE = 0.75;

export function joinCollectibleRarity(cards, emotes, { minConfidence = RARITY_MIN_CONFIDENCE } = {}) {
  const collectibles = (emotes || []).filter((emote) => emote.collectible);
  const matched = [];
  const unmatched = [];
  const claimed = new Set();

  for (const emote of collectibles) {
    const token = joinToken(emote.name);
    let best = null;

    for (const card of cards || []) {
      if (!card || claimed.has(card.id)) continue;
      const url = String(card.card_url || '').toLowerCase();
      if (!url) continue;

      let confidence = 0;
      let basis = '';
      // Strongest: the card art is addressed by the emote's own id.
      if (new RegExp(`(^|[^0-9])${emote.id}([^0-9]|$)`).test(url)) {
        confidence = 0.98;
        basis = 'emote id in card URL';
      } else if (token.length >= 4 && url.replace(/[^a-z0-9]/g, '').includes(token)) {
        // Weaker: the name appears in the asset path. Short tokens match by
        // accident far too easily, hence the length floor.
        confidence = 0.85;
        basis = 'emote name in card URL';
      }
      if (confidence && (!best || confidence > best.confidence)) best = { card, confidence, basis };
    }

    if (best && best.confidence >= minConfidence && rarityRank(best.card.rarity) >= 0) {
      claimed.add(best.card.id);
      matched.push({
        emote,
        rarity: String(best.card.rarity).toLowerCase(),
        rank: rarityRank(best.card.rarity),
        owned: Boolean(best.card.owned),
        confidence: best.confidence,
        basis: best.basis,
      });
    } else {
      unmatched.push(emote);
    }
  }

  const total = collectibles.length;
  return {
    matched,
    unmatched,
    total,
    coverage: total ? matched.length / total : 0,
    // The caller renders rarity only when this is true; otherwise the tab looks
    // exactly as it does today.
    usable: total > 0 && matched.length > 0,
  };
}

/**
 * Bulk live status, as Kick's own sidebar reads it.
 *
 * One request answers for every channel in the grid and every saved layout, so
 * a shelf of layouts costs what a single channel would. A channel absent from
 * the response is offline by Kick's own convention — it only returns entries
 * for channels that are live — so absence is treated as offline rather than
 * unknown, and a reshaped payload reports rather than inventing a status.
 */
export function normalizeCurrentViewers(payload) {
  const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : null);
  if (!list) return { ok: false, reason: 'not-a-list' };
  const entries = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const id = raw.livestream_id ?? raw.id ?? raw.channel_id;
    if (id == null) continue;
    const viewers = Number(raw.viewers ?? raw.viewer_count ?? raw.count);
    entries.push({
      id: String(id).slice(0, LIMITS.id),
      viewers: Number.isFinite(viewers) && viewers >= 0 ? Math.floor(viewers) : 0,
      // Presence in this response is Kick's own signal that a channel is live.
      live: true,
    });
    if (entries.length >= 200) break;
  }
  return { ok: true, entries };
}

/**
 * Summarise the user's own collectible inventory.
 *
 * Kick publishes no drop odds and documents no duplicate protection, so the
 * only trustworthy duplicate figure is the one the user's own inventory shows.
 * Whether it shows one at all depends on Kick returning a per-card quantity,
 * which is read tolerantly across the names it might use — and when no card
 * carries one, `quantityKnown` is false and the caller must say the number is
 * unavailable rather than present `distinct` as if it were the whole story.
 */
export function summarizeCollectibleInventory(cards) {
  const list = (Array.isArray(cards) ? cards : []).filter((card) => card && typeof card === 'object');
  if (!list.length) return { ok: false, reason: 'no-cards' };

  let copies = 0;
  let quantityKnown = false;
  for (const card of list) {
    const raw = card.quantity ?? card.count ?? card.amount ?? card.owned;
    const value = Math.floor(Number(raw));
    if (Number.isFinite(value) && value >= 1) {
      copies += value;
      quantityKnown = true;
    } else {
      // No quantity on this card: it is still one copy, so the total stays a
      // lower bound rather than becoming a guess.
      copies += 1;
    }
  }

  const distinct = list.length;
  const duplicates = quantityKnown ? Math.max(0, copies - distinct) : 0;
  return {
    ok: true,
    distinct,
    copies,
    duplicates,
    quantityKnown,
    duplicateRate: quantityKnown && copies > 0 ? duplicates / copies : 0,
  };
}

/**
 * What Kick does not explain about collectibles, stated only where a source
 * exists. Every line is either something Kick has published, something Kick
 * support has said, or an absence that can be verified by looking.
 */
export const COLLECTIBLE_FACTS = Object.freeze([
  Object.freeze({
    claim: 'The daily streak does not improve what you get.',
    detail: 'Kick support has stated the streak confers no bonus to drop quality or odds. It only tracks consecutive claims. Nothing in the collectibles response carries a streak multiplier either.',
  }),
  Object.freeze({
    claim: 'Kick does not publish drop odds.',
    detail: 'No rarity probability appears in any response this build reads, and none is documented. Any odds you have seen quoted are someone else’s estimate, not Kick’s figure.',
  }),
  Object.freeze({
    claim: 'Duplicate protection is undocumented.',
    detail: 'Kick has never stated whether a drop can repeat an item you already own. The count below is what your own inventory shows, which is the only evidence available.',
  }),
  Object.freeze({
    claim: 'The collectibles page and your chat emote set can disagree.',
    detail: 'They are served by different endpoints and are reported to fall out of sync. The emote set is the one chat actually accepts, so trust that when they differ.',
  }),
  Object.freeze({
    claim: 'Kick can change an emote you already pulled.',
    detail: 'Reported in July 2026 and answered by Kick support with “remastered… clear your cache”. Your local library records the name and artwork at first capture, so a changed entry is flagged rather than quietly replaced.',
  }),
]);
