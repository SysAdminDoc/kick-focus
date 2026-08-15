/**
 * Kick's own API surface, as pure data handling.
 *
 * Everything here is a URL builder, a normaliser, or a join. Nothing in this
 * file performs a request, touches the DOM, or holds state, so all of it is
 * unit-tested against payload shapes captured from the live site on 2026-08-15.
 *
 * Boundaries this module holds to, deliberately:
 *   - Read-only. No endpoint here mutates anything on Kick.
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
  emoteSets: (slug) => `${KICK_ORIGIN}/emotes/${encodeURIComponent(slug)}`,
  chatSettings: (channelId) => `${KICK_WEB_ORIGIN}/api/v1/channels/${encodeURIComponent(channelId)}/chat/settings`,
  chatHistory: (chatroomId) => `${KICK_WEB_ORIGIN}/api/v1/chat/${encodeURIComponent(chatroomId)}/history`,
  collectibles: () => `${KICK_WEB_ORIGIN}/api/v1/gamification/collectibles`,
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

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

export const SUPPORTED_REALTIME_PROVIDERS = Object.freeze(['PUSHER']);

/**
 * Read the broker's answer without assuming Pusher.
 *
 * The response carries an array of connections behind a `provider`
 * discriminator, and Kick's client tracks a `degraded` connection state — a
 * multi-provider failover abstraction it can flip server-side. A build that
 * hardcodes the Pusher app key keeps working right up until it silently does
 * not, so an unrecognised provider must degrade to the DOM path rather than
 * throw or guess.
 */
export function normalizeRealtimeConnection(payload) {
  const connections = payload?.data?.connections;
  if (!Array.isArray(connections) || connections.length === 0) {
    return { ok: false, reason: 'no-connections' };
  }
  const usable = connections.find((entry) => SUPPORTED_REALTIME_PROVIDERS.includes(entry?.provider));
  if (!usable) {
    const offered = connections.map((entry) => String(entry?.provider || 'unknown'));
    return { ok: false, reason: 'unsupported-provider', offered };
  }
  const appKey = usable.credentials?.app_key;
  const cluster = usable.credentials?.cluster;
  if (typeof appKey !== 'string' || !appKey || typeof cluster !== 'string' || !cluster) {
    return { ok: false, reason: 'incomplete-credentials' };
  }
  return {
    ok: true,
    provider: usable.provider,
    appKey,
    cluster,
    mode: payload?.data?.mode || 'WEBSOCKET',
  };
}

/** Pusher's documented client handshake. The key never appears in our source. */
export function pusherSocketUrl({ appKey, cluster }, version = '8.6.0') {
  return `wss://ws-${cluster}.pusher.com/app/${appKey}?protocol=7&client=js&version=${version}&flash=false`;
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
    return { state: 'unparsable', healthy: false, detail: `${unparsable} consecutive frames could not be read — Kick's payload shape has probably changed.` };
  }
  if (lastFrameAt && now - lastFrameAt > REALTIME_SILENCE_MS) {
    return { state: 'stale', healthy: false, detail: `No events for ${Math.round((now - lastFrameAt) / 1000)}s — the socket reports open but is not delivering.` };
  }
  return { state: 'live', healthy: true };
}

// ---------------------------------------------------------------------------
// Channel identity
// ---------------------------------------------------------------------------

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
    followers: Number(payload.followers_count) || 0,
    isLive: Boolean(livestream?.is_live),
    viewers: Number(livestream?.viewer_count) || 0,
    title: typeof livestream?.session_title === 'string' ? livestream.session_title : '',
    mature: Boolean(livestream?.is_mature),
    language: typeof livestream?.language === 'string' ? livestream.language : '',
    categories: Array.isArray(livestream?.categories)
      ? livestream.categories.map((entry) => String(entry?.slug || '')).filter(Boolean)
      : [],
  };
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
  return 'channel';
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
    const list = Array.isArray(rawSet.emotes) ? rawSet.emotes : [];
    const normalized = [];
    for (const raw of list) {
      const id = raw?.id;
      const name = raw?.name;
      if ((typeof id !== 'number' && typeof id !== 'string') || typeof name !== 'string' || !name) continue;
      const entry = {
        id: String(id),
        name,
        setId: rawSet.id == null ? null : String(rawSet.id),
        setName,
        kind,
        channelId: raw.channel_id == null ? null : String(raw.channel_id),
        // Kick's flag: subscriber emotes are usable platform-wide.
        subscribersOnly: Boolean(raw.subscribers_only),
        usableEverywhere: kind !== 'channel' || Boolean(raw.subscribers_only),
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
 * Split message content into text and emote segments.
 *
 * Kick's rendered DOM gives an `<img>` with an alt attribute; the wire format
 * gives the emote *id*, which is what a usage counter and a rarity join both
 * actually need. A name is not an identity on Kick — see `findShadowedNames`.
 */
export function parseEmoteTokens(content) {
  const text = String(content ?? '');
  const segments = [];
  let index = 0;
  EMOTE_TOKEN.lastIndex = 0;
  for (const match of text.matchAll(EMOTE_TOKEN)) {
    if (match.index > index) segments.push({ type: 'text', value: text.slice(index, match.index) });
    segments.push({ type: 'emote', id: match[1], name: match[2] });
    index = match.index + match[0].length;
  }
  if (index < text.length) segments.push({ type: 'text', value: text.slice(index) });
  return segments;
}

export function normalizeChatMessage(event) {
  const id = event?.id;
  if (!id) return null;
  const sender = event.sender || {};
  const identity = sender.identity || {};
  // badges_v2 supersedes badges: it carries image URLs and covers the global
  // and collectible badges the legacy array omits entirely.
  const badges = Array.isArray(identity.badges_v2) && identity.badges_v2.length
    ? identity.badges_v2
    : (Array.isArray(identity.badges) ? identity.badges : []);
  const segments = parseEmoteTokens(event.content);
  return {
    id: String(id),
    content: String(event.content ?? ''),
    segments,
    emotes: segments.filter((segment) => segment.type === 'emote'),
    createdAt: event.created_at || '',
    sender: {
      id: sender.id == null ? '' : String(sender.id),
      username: String(sender.username || ''),
      slug: String(sender.slug || ''),
      color: String(identity.color || ''),
    },
    badges: badges.map((badge) => ({
      type: String(badge?.type || badge?.badge_type || ''),
      text: String(badge?.text || badge?.name || ''),
      image: String(badge?.image_url || ''),
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
  const id = event?.message?.id ?? event?.id;
  if (!id) return null;
  const rules = Array.isArray(event.violatedRules) ? event.violatedRules : [];
  const labels = rules.map((rule) => RULE_LABELS[String(rule)] || String(rule).replace(/_/g, ' ')).filter(Boolean);
  const aiModerated = Boolean(event.aiModerated);
  let reason = 'Removed by a moderator.';
  if (aiModerated && labels.length) reason = `Removed by Kick's automatic moderation for ${labels.join(', ')}.`;
  else if (aiModerated) reason = "Removed by Kick's automatic moderation.";
  else if (labels.length) reason = `Removed for ${labels.join(', ')}.`;
  return { id: String(id), aiModerated, rules: labels, reason };
}

// ---------------------------------------------------------------------------
// Emote usage
// ---------------------------------------------------------------------------

/**
 * Kick's "Frequently Used" tab is a 50-entry MRU whose `timeUsed` is hardcoded
 * to 1 and never incremented, so no real frequency ranking exists anywhere on
 * the platform. Competitors count usage only for third-party providers
 * (7TV/BTTV/FFZ), never for Kick's own emotes.
 *
 * Counts are keyed by emote id, not name: names collide across sets and Kick
 * remaps them, while ids are stable. Storage is per channel plus a global
 * rollup, both local-only and exported with the library.
 */
export const USAGE_CHANNEL_LIMIT = 400;

export function recordEmoteUse(counts, { channel, id, name, at = 0 }) {
  if (!id) return counts || { global: {}, channels: {} };
  const next = {
    global: { ...(counts?.global || {}) },
    channels: { ...(counts?.channels || {}) },
  };
  const globalEntry = next.global[id] || { name, count: 0, firstAt: at, lastAt: at };
  next.global[id] = {
    name: name || globalEntry.name,
    count: globalEntry.count + 1,
    firstAt: globalEntry.firstAt || at,
    lastAt: at,
  };
  if (channel) {
    const scope = { ...(next.channels[channel] || {}) };
    const entry = scope[id] || { name, count: 0, firstAt: at, lastAt: at };
    scope[id] = { name: name || entry.name, count: entry.count + 1, firstAt: entry.firstAt || at, lastAt: at };
    next.channels[channel] = trimUsage(scope);
  }
  return next;
}

/** Keep the per-channel map bounded by dropping the least-used entries. */
function trimUsage(scope) {
  const entries = Object.entries(scope);
  if (entries.length <= USAGE_CHANNEL_LIMIT) return scope;
  entries.sort((a, b) => (b[1].count - a[1].count) || (b[1].lastAt - a[1].lastAt));
  return Object.fromEntries(entries.slice(0, USAGE_CHANNEL_LIMIT));
}

/**
 * Rank emotes by real usage. `channel` scopes to one chat and falls back to the
 * global rollup for anything never used there, so a shelf is useful the first
 * time a channel is opened rather than empty.
 */
export function rankEmoteUsage(counts, { channel = '', limit = 24 } = {}) {
  const scope = (channel && counts?.channels?.[channel]) || {};
  const global = counts?.global || {};
  const merged = new Map();
  for (const [id, entry] of Object.entries(global)) {
    merged.set(id, { id, name: entry.name, count: 0, globalCount: entry.count, lastAt: entry.lastAt || 0 });
  }
  for (const [id, entry] of Object.entries(scope)) {
    const current = merged.get(id) || { id, name: entry.name, count: 0, globalCount: 0, lastAt: 0 };
    merged.set(id, { ...current, name: entry.name || current.name, count: entry.count, lastAt: entry.lastAt || current.lastAt });
  }
  return [...merged.values()]
    .sort((a, b) => (b.count - a.count) || (b.globalCount - a.globalCount) || (b.lastAt - a.lastAt))
    .slice(0, limit);
}

/** Emotes the user owns but has never sent — the inverse view nothing offers. */
export function unusedEmotes(counts, emotes, { channel = '' } = {}) {
  const used = new Set([
    ...Object.keys(counts?.global || {}),
    ...Object.keys((channel && counts?.channels?.[channel]) || {}),
  ]);
  return (emotes || []).filter((emote) => !used.has(String(emote.id)));
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
