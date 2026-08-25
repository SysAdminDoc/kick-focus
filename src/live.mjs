// ---------------------------------------------------------------------------
// Kick live data
//
// Read-only, same-origin requests to endpoints Kick's own client already calls,
// inheriting the session the page already has. Nothing here writes to Kick,
// handles a credential, or runs when the matching setting is off, and every
// path falls back to the existing DOM scraping when it fails.
//
// Like the multi-stream surface, everything page-owned arrives through `host`
// rather than out of the enclosing bundle scope, so this file loads on its own
// under `node --test`. The build strips the imports below and relies on concat
// order to supply the names.
// ---------------------------------------------------------------------------

import {
  appendMergedMessage,
  assessApiDrift,
  chatBadgesToRender,
  dropMergedChannel,
  observationsFromChatEmotes,
  platformStickerKey,
  recordEmoteUse,
} from './core.mjs';
import {
  KICK_ORIGIN,
  KICK_WEB_ORIGIN,
  applyAccountEntitlement,
  catalogEmoteAccess,
  emoteImageUrl,
  endpoints,
  findShadowedNames,
  joinCollectibleRarity,
  normalizeChannel,
  normalizeChannelVideos,
  findChannelVideo,
  normalizeChatMessage,
  normalizeDeletion,
  normalizeEmoteSets,
  normalizeRealtimeConnection,
  parseRealtimeFrame,
  realtimeChannels,
  realtimeHealth,
  realtimeSubscribeFrame,
  realtimeTransport,
  summarizeCollectibleInventory,
} from './api.mjs';

const LIVE_TIMEOUT_MS = 8000;
const LIVE_MAX_BYTES = 4_000_000;
const REALTIME_BACKOFF_MS = [2000, 5000, 15000, 45000];
const MERGED_CHAT_BACKOFF_MS = [2000, 5000, 15000, 45000];
const MERGED_CHAT_SILENCE_MS = 45_000;
const MERGED_CHAT_QUEUE_LIMIT = 2;

/**
 * Harvest emotes seen in realtime chat frames into the library.
 *
 * A frame carries {id,name} for every emote in a message. These are frame-only
 * (no DOM node corroborates them and the id came off the wire), so an unknown
 * emote is committed only after a one-shot Image() load proves the CDN actually
 * serves it — a crafted [emote:999999:Fake] token fails that load and never
 * takes a cap slot. At most a few loads run at once, and a per-session negative
 * cache stops re-attempting an id that already failed. Emotes already in the
 * library skip validation and merge directly to refresh their last-seen date.
 */
const HARVEST_MAX_INFLIGHT = 4;
const HARVEST_NEGATIVE_CAP = 5000;
/**
 * An image request that neither loads nor errors holds a harvest slot forever.
 * Four of those and the pump's `while` never runs again, so emote harvesting is
 * dead for the rest of the session with nothing to show for it. A captive
 * portal or a throttled CDN is enough. Long enough that a slow but working CDN
 * still counts as a hit.
 */
const HARVEST_TIMEOUT_MS = 8000;
/**
 * A stalled key never reaches `negative`, so every later sighting re-queues it.
 * Every sibling structure here is capped; this one was the gap.
 */
const HARVEST_QUEUE_CAP = 600;

/**
 * Kick's chat identity payload carries `badges_v2`, which includes the
 * collectible and global badges the legacy array omits entirely — so a client
 * reading only the rendered DOM shows a gap where other clients show a badge.
 *
 * A realtime frame routinely arrives before Kick has rendered the message, so
 * an unrenderable badge set is held briefly and retried on the apply cycle
 * rather than dropped. The map only holds messages still waiting for a node,
 * which is a handful even in a fast chat.
 */
const CHAT_BADGE_WAIT_MS = 30_000;

/** The selectors Kick's chat uses to key a rendered message to its id. */
export function chatMessageSelector(id) {
  const escaped = CSS.escape(id);
  return `[data-index="${escaped}"], [data-message-id="${escaped}"], [data-chat-entry="${escaped}"]`;
}

/**
 * Build the live-data surface against a host.
 *
 * `host` supplies the page-owned collaborators: `state`, the storage writer,
 * the unhooked `fetch`, and the two runtime helpers this surface borrows.
 */
export function createLive(host) {
  const {
    state,
    gmSet,
    EMOTE_USAGE_KEY,
    pageFetch,
    currentChannelSlug,
    currentVodId,
    plural,
    mergeStickerLibrary,
  } = host;

  /**
   * The bearer token Kick's own page sends, read from its own cookie.
   *
   * The belief this replaces — that these endpoints authenticate with cookies
   * and no token is ever involved — was wrong, and wrong silently. Measured
   * 2026-08-16 from a signed-in page: `/gamification/collectibles` answers
   * **403** to a cookie-only read and 200 with the header, so collectible
   * rarity had been degrading for every signed-in user; `/emotes/{slug}`
   * answers with three sets and 12,566 bytes without it and thirteen sets and
   * 44,404 bytes with it. Kick's SPA reads the same `session_token` cookie and
   * sends it the same way — see the `Authorization` on any `search.kick.com`
   * request the page makes.
   *
   * Same-origin only. `kickFetchJson` is called with Kick URLs exclusively and
   * the header is attached under that assumption, so the guard below is what
   * keeps a future caller from handing the token to another host.
   */
  function kickBearerToken() {
    const raw = document.cookie.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('session_token='));
    if (!raw) return '';
    try {
      return decodeURIComponent(raw.slice('session_token='.length));
    } catch {
      return '';
    }
  }

  /** Is this a Kick origin, and therefore an origin its own session may reach? */
  function isKickUrl(url) {
    try {
      const { origin } = new URL(String(url), window.location.href);
      return origin === KICK_ORIGIN || origin === KICK_WEB_ORIGIN;
    } catch {
      return false;
    }
  }

  function describeKickFetchFailure(status) {
    if (status === 'parse') return 'returned data this build could not read';
    if (status === 'timeout') return 'timed out';
    if (status === 'network') return 'could not be reached';
    if (status === 'oversized') return 'returned more data than this build will read';
    return `answered ${status}`;
  }

  /**
   * Same-origin JSON with a deadline and a size ceiling.
   *
   * `credentials: 'include'` carries the session cookie; the bearer header
   * carries the account. Some endpoints need only the first, several need both,
   * and none of them say so — see `kickBearerToken`.
   */
  async function kickFetchJson(url, { credentials = 'include', signal } = {}) {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (signal?.aborted) forwardAbort();
    else signal?.addEventListener?.('abort', forwardAbort, { once: true });
    const timer = window.setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
    let stopAbortWait = () => {};
    const aborted = new Promise((_, reject) => {
      const onAbort = () => {
        const error = new Error('request aborted');
        error.name = 'AbortError';
        reject(error);
      };
      stopAbortWait = () => controller.signal.removeEventListener('abort', onAbort);
      if (controller.signal.aborted) onAbort();
      else controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const headers = { accept: 'application/json' };
      if (isKickUrl(url)) {
        const token = kickBearerToken();
        if (token) headers.authorization = `Bearer ${token}`;
      }
      const response = await Promise.race([pageFetch(url, {
        credentials,
        signal: controller.signal,
        headers,
      }), aborted]);
      if (!response.ok) return { ok: false, status: response.status };
      const text = await response.text();
      if (text.length > LIVE_MAX_BYTES) return { ok: false, status: 'oversized' };
      try {
        return { ok: true, status: response.status, body: JSON.parse(text) };
      } catch {
        return { ok: false, status: 'parse' };
      }
    } catch (error) {
      return { ok: false, status: error?.name === 'AbortError' ? 'timeout' : 'network' };
    } finally {
      clearTimeout(timer);
      stopAbortWait();
      signal?.removeEventListener?.('abort', forwardAbort);
    }
  }

  /**
   * Same-origin account mutation with Kick's own session and CSRF cookie. The
   * only caller is the explicit click-to-save gesture for an emote Kick itself
   * marks follow-gated; ordinary channel emotes never reach this path.
   */
  async function mutateKickChannelFollow(slug, method = 'POST') {
    if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(slug || '')) return { ok: false, status: 'invalid-channel' };
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
    try {
      const headers = { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' };
      const token = document.cookie.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);
      if (token) headers['x-xsrf-token'] = decodeURIComponent(token);
      const response = await pageFetch(endpoints.followChannel(slug), {
        method,
        credentials: 'include',
        headers,
        signal: controller.signal,
      });
      return { ok: response.ok || response.status === 409, status: response.status };
    } catch (error) {
      return { ok: false, status: error?.name === 'AbortError' ? 'timeout' : 'network' };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Record an API shape mismatch so the About page can report accumulated drift
   * rather than silently falling back. Capped at 50 events per session.
   */
  function recordApiDrift(endpoint, reason, detail = '') {
    if (state.live.apiDrift.length >= 50) return;
    state.live.apiDrift.push({ endpoint, reason, detail, at: Date.now() });
  }

  /**
   * Pull channel identity and the emote catalog for the current channel.
   *
   * The catalog avoids depending entirely on a lazy-rendered picker, but its
   * public artwork is not account entitlement. API-only channel entries remain
   * channel-only or locked until the native picker corroborates access.
   */
  async function refreshLiveChannel() {
    const slug = currentChannelSlug();
    if (!slug) {
      teardownRealtime();
      state.live.slug = '';
      state.live.channel = null;
      return;
    }
    if (state.live.slug === slug && state.live.channel) {
      // Same channel, different recording. Opening a VOD from the channel's own
      // list is an SPA navigation that changes only the last path segment, so
      // nothing below re-runs and the retention read has to be reached here or
      // it never happens at all.
      await refreshVodRetention(slug);
      return;
    }
    teardownRealtime();
    state.live.slug = slug;
    state.live.channel = null;
    state.live.catalog = null;
    state.live.catalogSource = 'dom';
    state.live.catalogError = '';
    state.live.collisions = [];
    state.live.rarity = null;
    state.live.inventory = null;
    state.live.standing = { known: false, subscribed: null, following: null, moderator: null };
    state.live.vod = null;

    // The retention chip needs this read too — for the channel's id and its
    // `verified` flag — so it has to be able to ask for it. Still free on a
    // channel page, and free on a VOD when the setting is off: the guard is the
    // route and the setting together, not the setting alone.
    const wantsVodDate = state.settings.content.showVodExpiry && Boolean(currentVodId());
    if (!state.settings.content.liveEmoteCatalog && !state.settings.content.liveChatEvents && !wantsVodDate) return;

    const channelResponse = await kickFetchJson(endpoints.channel(slug));
    if (state.live.slug !== slug) return; // navigated away mid-flight
    if (!channelResponse.ok) {
      state.live.catalogError = `Kick's channel API ${describeKickFetchFailure(channelResponse.status)}.`;
      refreshLiveDiagnostics();
      return;
    }
    state.live.channel = normalizeChannel(channelResponse.body);
    if (!state.live.channel) {
      state.live.catalogError = "Kick's channel payload no longer has the expected shape.";
      recordApiDrift('channel', 'shape-changed');
      refreshLiveDiagnostics();
      return;
    }

    await refreshVodRetention(slug);
    if (state.settings.content.liveEmoteCatalog) await refreshEmoteCatalog(slug);
    if (state.settings.content.liveChatEvents) connectRealtime();
    refreshLiveDiagnostics();
  }

  /**
   * Date the VOD this page is showing, if it is showing one.
   *
   * One read, on a route that has a VOD id, and only when the setting is on —
   * a channel page pays nothing for this. Everything about it degrades to
   * silence: no id, no channel id, a failed read, a changed shape, or an entry
   * simply not in the returned window all leave `state.live.vod` null, and the
   * surface renders nothing rather than guessing a deadline.
   */
  async function refreshVodRetention(slug) {
    if (!state.settings.content.showVodExpiry) {
      state.live.vod = null;
      return;
    }
    const id = currentVodId();
    if (!id) {
      // Left a VOD for a channel page: drop the answer rather than let a stale
      // deadline sit on a different recording.
      state.live.vod = null;
      return;
    }
    if (state.live.vod?.id === id) return;
    state.live.vod = null;
    const channelId = state.live.channel?.id;
    if (!channelId) return;
    const response = await kickFetchJson(endpoints.channelVideos(channelId));
    if (state.live.slug !== slug) return; // navigated away mid-flight
    if (!response.ok) return;
    const videos = normalizeChannelVideos(response.body);
    if (!videos) {
      recordApiDrift('channel-videos', 'shape-changed');
      return;
    }
    const entry = findChannelVideo(videos, id);
    // Not a drift report: Kick returns a bounded window, so a recording older
    // than it is absent by design and there is no single-video read to fall
    // back to. Absent is an answer, and the answer is to say nothing.
    if (!entry || !entry.startedAt) return;
    state.live.vod = { id, startedAt: entry.startedAt, title: entry.title };
  }

  /**
   * This account's standing in one channel, or nulls where Kick will not say.
   *
   * A 401 is the signed-out answer and is not an error: every caller treats a
   * null subscription as "unknown", never as "denied", which is the difference
   * between not knowing and greying out an emote the user owns.
   */
  async function readChannelStanding(slug) {
    const response = await kickFetchJson(endpoints.channelMe(slug));
    if (!response.ok) return { known: false, subscribed: null, following: null, moderator: null };
    const body = response.body && typeof response.body === 'object' ? response.body : null;
    if (!body) {
      recordApiDrift('channel-me', 'shape-changed');
      return { known: false, subscribed: null, following: null, moderator: null };
    }
    return {
      known: true,
      subscribed: body.subscription != null,
      following: body.is_following === true,
      moderator: body.is_moderator === true,
    };
  }

  async function refreshEmoteCatalog(slug) {
    const [response, standing] = await Promise.all([
      kickFetchJson(endpoints.emoteSets(slug), { credentials: 'include' }),
      readChannelStanding(slug),
    ]);
    if (state.live.slug !== slug) return;
    state.live.standing = standing;
    if (!response.ok) {
      state.live.catalogError = `Kick's emote API ${describeKickFetchFailure(response.status)}; using the picker instead.`;
      refreshLiveDiagnostics();
      return;
    }
    const parsed = normalizeEmoteSets(response.body);
    const catalog = applyAccountEntitlement(parsed, {
      slug,
      authenticated: standing.known,
      subscribedToChannel: standing.known ? standing.subscribed : null,
    });
    if (!catalog.ok) {
      // A changed shape must not produce an empty organizer that looks like an
      // account with no emotes. Keep scraping and say why.
      state.live.catalogError = `Kick's emote payload changed shape (${catalog.reason}); using the picker instead.`;
      recordApiDrift('emotes', 'shape-changed', catalog.reason);
      refreshLiveDiagnostics();
      return;
    }
    state.live.catalog = catalog;
    state.live.catalogSource = 'api';
    state.live.catalogError = '';
    state.live.collisions = state.settings.content.warnShadowedEmotes ? findShadowedNames(catalog.emotes) : [];

    // An anonymous read publishes every image and carries no ownership signal,
    // so it seeds the library without claiming subscriber artwork is sendable.
    // An authenticated one is Kick's own account answer and has already been
    // folded in above — see `applyAccountEntitlement`.
    mergeStickerLibrary(catalog.emotes.map((emote) => ({
      key: platformStickerKey(`id:${emote.id}`),
      id: emote.id,
      name: emote.name,
      src: emote.url,
      nativeGroups: [emote.setName],
      access: catalogEmoteAccess(emote),
      sourceSlug: emote.sourceSlug,
      requiresFollow: emote.requiresFollow,
      followed: emote.followed,
      subscribersOnly: emote.subscribersOnly,
      usableEverywhere: emote.usableEverywhere,
      usableHere: emote.usableHere,
    })));

    if (state.settings.content.showEmoteRarity) await refreshCollectibleRarity(slug);
    refreshLiveDiagnostics();
  }

  /**
   * Join collectible card art to emote identity.
   *
   * Anonymous sessions get 403 here, which is expected and not an error worth
   * reporting: the whole point is that this is the user's own inventory.
   */
  async function refreshCollectibleRarity(slug) {
    if (!state.live.catalog?.emotes.some((emote) => emote.collectible)) return;
    const response = await kickFetchJson(endpoints.collectibles());
    if (state.live.slug !== slug || !response.ok) return;
    const cards = Array.isArray(response.body?.data) ? response.body.data
      : (Array.isArray(response.body) ? response.body : []);
    if (!cards.length) return;
    const join = joinCollectibleRarity(cards, state.live.catalog.emotes);
    state.live.rarity = join.usable ? join : null;
    // The user's own inventory is the only evidence for a duplicate rate, since
    // Kick publishes no odds and documents no duplicate protection.
    const inventory = summarizeCollectibleInventory(cards);
    state.live.inventory = inventory.ok ? inventory : null;
    refreshLiveDiagnostics();
  }

  /**
   * The account's own collectible inventory, read once, on request.
   *
   * The viewer hub asks for this when it opens and never on a timer: the read
   * is one GET to the endpoint Kick's own client already calls, and a summary
   * nobody is looking at is not worth a request.
   *
   * The three answers are kept apart because they mean different things to a
   * reader. 401/403 is the signed-out answer and is not a failure. A response
   * whose shape this build does not recognise is a failure, and is recorded as
   * drift. An empty inventory is a *measured zero* and is reported as one — the
   * only case in this file where zero is the honest answer.
   */
  async function readCollectibleInventory() {
    const response = await kickFetchJson(endpoints.collectibles());
    const observedAt = Date.now();
    if (!response.ok) {
      const denied = response.status === 401 || response.status === 403;
      return { denied, failed: !denied, status: response.status, observedAt };
    }
    const cards = Array.isArray(response.body?.data) ? response.body.data
      : (Array.isArray(response.body) ? response.body : null);
    if (!cards) {
      recordApiDrift('collectibles', 'shape-changed');
      return { failed: true, status: 'shape', observedAt };
    }
    const summary = summarizeCollectibleInventory(cards);
    return {
      owned: summary.ok ? summary.distinct : 0,
      copies: summary.ok ? summary.copies : 0,
      observedAt,
    };
  }

  // -------------------------------------------------------------------------
  // Realtime
  // -------------------------------------------------------------------------

  function teardownRealtime() {
    clearTimeout(state.live.reconnectAt);
    state.live.reconnectAt = 0;
    const socket = state.live.socket;
    state.live.socket = null;
    state.live.socketState = 'offline';
    state.live.subscribed = [];
    state.live.provider = '';
    state.live.providerVerified = true;
    state.live.lastLiveAt = 0;
    try { socket?.close(); } catch { /* already gone */ }
  }

  /**
   * Ask Kick which realtime provider is in force, then connect to that.
   *
   * Kick returns connection credentials behind a `provider` discriminator and
   * tracks a degraded state, so it can switch providers server-side. Anything
   * hardcoding the Pusher app key keeps working right up until it silently does
   * not — so the key is never written in this source, and an unrecognised
   * provider degrades to the DOM path rather than guessing.
   */
  async function connectRealtime() {
    const channel = state.live.channel;
    if (!channel?.chatroomId || state.live.socket) return;
    const clientId = crypto.randomUUID();
    const response = await kickFetchJson(endpoints.realtimeChat(channel.chatroomId, clientId));
    if (!response.ok || state.live.channel !== channel) return;

    const connection = normalizeRealtimeConnection(response.body);
    if (!connection.ok) {
      state.live.socketState = 'unsupported';
      state.live.catalogError = connection.reason === 'unsupported-provider'
        ? `Kick switched realtime provider to ${connection.offered.join(', ')}; chat features fall back to the page.`
        : 'Kick did not return usable realtime credentials; chat features fall back to the page.';
      recordApiDrift('realtime', connection.reason, connection.offered?.join(', '));
      refreshLiveDiagnostics();
      return;
    }

    state.live.provider = connection.provider;
    state.live.providerVerified = connection.verified;
    let socket;
    try {
      // The transport owns the URL; everything below is protocol, shared by all
      // of them, so a second provider is an entry in REALTIME_TRANSPORTS rather
      // than a second copy of this function.
      socket = new WebSocket(connection.transport.socketUrl(connection));
    } catch {
      state.live.socketState = 'offline';
      return;
    }
    state.live.socket = socket;
    state.live.socketState = 'connecting';
    state.live.unparsable = 0;

    socket.addEventListener('open', () => {
      state.live.socketState = 'open';
      state.live.lastFrameAt = Date.now();
      state.live.reconnectAttempts = 0;
      // A reconnect goes close -> schedule -> connect without passing through
      // teardownRealtime, which is the only other place this is cleared, so
      // every wifi blip used to append the same names again.
      state.live.subscribed = [];
      for (const name of realtimeChannels({ chatroomId: channel.chatroomId, channelId: channel.id })) {
        socket.send(realtimeSubscribeFrame(name));
        state.live.subscribed.push(name);
      }
      refreshLiveDiagnostics();
    });
    socket.addEventListener('message', onRealtimeFrame);
    socket.addEventListener('close', () => {
      if (state.live.socket !== socket) return;
      state.live.socket = null;
      state.live.socketState = 'offline';
      // An unverified transport that never delivered a frame is a migration this
      // build has not been proven against. Retrying it forever would keep chat
      // features broken silently; degrading to the DOM path says so instead.
      if (!state.live.providerVerified && !state.live.lastLiveAt) {
        state.live.socketState = 'unsupported';
        state.live.catalogError = `Kick's ${connection.transport.label} transport did not connect; chat features fall back to the page.`;
        recordApiDrift('realtime', 'unverified-transport-failed', connection.transport.id);
        refreshLiveDiagnostics();
        return;
      }
      scheduleRealtimeReconnect();
    });
    socket.addEventListener('error', () => { state.live.socketState = 'error'; });
  }

  function scheduleRealtimeReconnect() {
    if (!state.settings.content.liveChatEvents || !currentChannelSlug()) return;
    const delay = REALTIME_BACKOFF_MS[Math.min(state.live.reconnectAttempts, REALTIME_BACKOFF_MS.length - 1)];
    state.live.reconnectAttempts += 1;
    clearTimeout(state.live.reconnectAt);
    state.live.reconnectAt = window.setTimeout(connectRealtime, delay);
  }

  // -------------------------------------------------------------------------
  // Merged chat across the grid
  //
  // One connection per channel, kept entirely apart from `state.live.socket`.
  // That single connection belongs to the channel the tab is standing on and
  // carries the emote harvest, badge queue and deletion handling; reusing it
  // for nine channels would put all of that on messages from channels the user
  // is not viewing. These sockets do one thing: read, label, append.
  //
  // Strictly read-only, like every other chat surface here — there is no send
  // path, and Kick refuses sending from an embedded chat anyway.
  // -------------------------------------------------------------------------

  function mergedChatState() {
    if (!state.mergedChat) {
      state.mergedChat = {
        entries: [],
        connections: new Map(),
        errors: [],
        queueTimer: 0,
        inflight: 0,
        recoveryListeners: null,
      };
    }
    return state.mergedChat;
  }

  const mergedNow = () => (typeof host.now === 'function' ? host.now() : Date.now());
  const mergedRandom = () => (typeof host.random === 'function' ? host.random() : Math.random());
  const mergedSetTimeout = (callback, delay) => (typeof host.setTimeout === 'function'
    ? host.setTimeout(callback, delay)
    : window.setTimeout(callback, delay));
  const mergedClearTimeout = (timer) => {
    if (typeof host.clearTimeout === 'function') host.clearTimeout(timer);
    else clearTimeout(timer);
  };

  function mergedRetryDelay(attempts) {
    const base = MERGED_CHAT_BACKOFF_MS[Math.min(Math.max(0, attempts - 1), MERGED_CHAT_BACKOFF_MS.length - 1)];
    const jitter = Math.max(0, Math.min(1, Number(mergedRandom()) || 0));
    return Math.round(base * (0.8 + (jitter * 0.4)));
  }

  function noteMergedError(slug, reason) {
    const merged = mergedChatState();
    merged.errors.push({ slug, reason, at: mergedNow() });
    if (merged.errors.length > 40) merged.errors.splice(0, merged.errors.length - 40);
  }

  function stopMergedSocket(slot) {
    const controller = slot.controller;
    slot.controller = null;
    if (controller) controller.abort();
    const finishAttempt = slot.finishAttempt;
    if (finishAttempt) finishAttempt();
    const socket = slot.socket;
    slot.socket = null;
    slot.token += 1;
    if (!socket) return;
    try { socket.close(); } catch { /* Already gone. */ }
  }

  function scheduleMergedQueue() {
    const merged = mergedChatState();
    if (merged.queueTimer) {
      mergedClearTimeout(merged.queueTimer);
      merged.queueTimer = 0;
    }
    if (!merged.connections.size) return;

    const now = mergedNow();
    let dueAt = Number.POSITIVE_INFINITY;
    const hasCapacity = merged.inflight < MERGED_CHAT_QUEUE_LIMIT;
    for (const slot of merged.connections.values()) {
      if (hasCapacity && (slot.status === 'queued' || slot.status === 'waiting')) {
        dueAt = Math.min(dueAt, slot.retryAt || now);
      } else if (slot.status === 'connecting') {
        dueAt = Math.min(dueAt, slot.retryAt || now);
      } else if ((slot.status === 'open' || slot.status === 'live') && slot.socket) {
        dueAt = Math.min(dueAt, slot.lastFrameAt + MERGED_CHAT_SILENCE_MS);
      }
    }
    if (!Number.isFinite(dueAt)) return;
    merged.queueTimer = mergedSetTimeout(runMergedQueue, Math.max(0, dueAt - now));
  }

  function queueMergedRetry(slot, reason, immediate = false) {
    const merged = mergedChatState();
    if (merged.connections.get(slot.slug) !== slot) return;
    stopMergedSocket(slot);
    if (!immediate) slot.attempts += 1;
    slot.status = immediate ? 'queued' : 'waiting';
    slot.lastError = reason;
    slot.retryAt = mergedNow() + (immediate ? 0 : mergedRetryDelay(slot.attempts));
    noteMergedError(slot.slug, reason);
    scheduleMergedQueue();
  }

  function bindMergedRecovery() {
    const merged = mergedChatState();
    if (merged.recoveryListeners) return;
    const recover = (event) => recoverMergedChatQueue(event?.type || 'recovery');
    const visible = () => {
      if (!document.hidden) recoverMergedChatQueue('visibilitychange');
    };
    window.addEventListener?.('online', recover);
    window.addEventListener?.('pageshow', recover);
    document.addEventListener?.('visibilitychange', visible);
    merged.recoveryListeners = { recover, visible };
  }

  function unbindMergedRecovery() {
    const merged = mergedChatState();
    const listeners = merged.recoveryListeners;
    if (!listeners) return;
    window.removeEventListener?.('online', listeners.recover);
    window.removeEventListener?.('pageshow', listeners.recover);
    document.removeEventListener?.('visibilitychange', listeners.visible);
    merged.recoveryListeners = null;
  }

  function recoverMergedChatQueue(reason) {
    const merged = mergedChatState();
    const now = mergedNow();
    for (const slot of merged.connections.values()) {
      const force = reason === 'online' || reason === 'pageshow';
      const stale = slot.lastFrameAt > 0 && now - slot.lastFrameAt >= MERGED_CHAT_SILENCE_MS;
      if (!slot.socket || force || stale) queueMergedRetry(slot, reason, true);
    }
    scheduleMergedQueue();
  }

  function closeMergedChannel(slug) {
    const merged = mergedChatState();
    const entry = merged.connections.get(slug);
    merged.connections.delete(slug);
    if (!entry) return;
    entry.cancelled = true;
    stopMergedSocket(entry);
    // The messages go with the connection: a channel removed from the grid must
    // stop occupying the reader's attention as well as the network.
    merged.entries = dropMergedChannel(merged.entries, slug);
    scheduleMergedQueue();
  }

  function closeMergedChat() {
    const merged = mergedChatState();
    for (const slug of [...merged.connections.keys()]) closeMergedChannel(slug);
    if (merged.queueTimer) mergedClearTimeout(merged.queueTimer);
    merged.queueTimer = 0;
    merged.entries = [];
    merged.errors = [];
    unbindMergedRecovery();
  }

  function onMergedFrame(slug, socket, event) {
    const merged = mergedChatState();
    const slot = merged.connections.get(slug);
    if (!slot || slot.socket !== socket) return;
    slot.lastFrameAt = mergedNow();
    const frame = parseRealtimeFrame(event.data);
    if (frame.kind !== 'unparsable') {
      slot.status = 'live';
      slot.attempts = 0;
      slot.lastError = '';
    }
    scheduleMergedQueue();
    if (frame.kind !== 'chat-message') return;
    const message = normalizeChatMessage(frame.payload);
    if (!message) return;
    merged.entries = appendMergedMessage(merged.entries, {
      slug,
      id: message.id,
      text: message.content,
      sender: message.sender?.username || '',
      color: message.sender?.color || '',
      at: Date.now(),
    });
  }

  /**
   * Open one channel's feed. Credentials are fetched on every attempt because
   * the broker response can expire while a tab sleeps.
   */
  async function openMergedChannel(slot) {
    const merged = mergedChatState();
    const { slug } = slot;
    if (merged.connections.get(slug) !== slot || slot.cancelled) return false;
    slot.status = 'connecting';
    slot.retryAt = mergedNow() + LIVE_TIMEOUT_MS;
    slot.token += 1;
    const token = slot.token;
    const controller = new AbortController();
    slot.controller = controller;

    const channelResponse = await kickFetchJson(endpoints.channel(slug), { signal: controller.signal });
    if (merged.connections.get(slug) !== slot || slot.cancelled || slot.token !== token) return false;
    const channel = channelResponse.ok ? normalizeChannel(channelResponse.body) : null;
    if (!channel?.chatroomId) {
      queueMergedRetry(slot, `channel credentials ${describeKickFetchFailure(channelResponse.status)}`);
      return false;
    }

    const clientId = crypto.randomUUID();
    const response = await kickFetchJson(endpoints.realtimeChat(channel.chatroomId, clientId), { signal: controller.signal });
    if (merged.connections.get(slug) !== slot || slot.cancelled || slot.token !== token) return false;
    const connection = response.ok ? normalizeRealtimeConnection(response.body) : { ok: false };
    if (!connection.ok) {
      queueMergedRetry(slot, `realtime credentials ${describeKickFetchFailure(response.status)}`);
      return false;
    }
    if (slot.controller === controller) slot.controller = null;

    let socket;
    try {
      socket = new WebSocket(connection.transport.socketUrl(connection));
    } catch {
      queueMergedRetry(slot, 'socket construction failed');
      return false;
    }
    if (merged.connections.get(slug) !== slot || slot.cancelled || slot.token !== token) {
      try { socket.close(); } catch { /* already gone */ }
      return false;
    }
    slot.socket = socket;
    slot.chatroomId = channel.chatroomId;
    slot.channelId = channel.id;
    slot.retryAt = mergedNow() + LIVE_TIMEOUT_MS;
    return new Promise((resolve) => {
      const finishAttempt = () => {
        if (slot.finishAttempt !== finishAttempt) return;
        slot.finishAttempt = null;
        resolve(true);
      };
      slot.finishAttempt = finishAttempt;
      socket.addEventListener('open', () => {
        if (mergedChatState().connections.get(slug) !== slot || slot.socket !== socket) return;
        slot.status = 'open';
        slot.lastFrameAt = mergedNow();
        for (const name of realtimeChannels({ chatroomId: channel.chatroomId, channelId: channel.id })) {
          socket.send(realtimeSubscribeFrame(name));
        }
        finishAttempt();
        scheduleMergedQueue();
      });
      socket.addEventListener('message', (event) => onMergedFrame(slug, socket, event));
      socket.addEventListener('error', () => {
        if (mergedChatState().connections.get(slug) === slot && slot.socket === socket) {
          queueMergedRetry(slot, 'socket error');
        }
      });
      socket.addEventListener('close', () => {
        const current = mergedChatState().connections.get(slug);
        if (current === slot && current.socket === socket) queueMergedRetry(slot, 'socket closed');
      });
    });
  }

  function startMergedChannel(slot) {
    const merged = mergedChatState();
    if (merged.connections.get(slot.slug) !== slot || slot.cancelled || merged.inflight >= MERGED_CHAT_QUEUE_LIMIT) return;
    merged.inflight += 1;
    openMergedChannel(slot)
      .catch(() => queueMergedRetry(slot, 'connection failed'))
      .finally(() => {
        merged.inflight = Math.max(0, merged.inflight - 1);
        scheduleMergedQueue();
      });
  }

  function runMergedQueue() {
    const merged = mergedChatState();
    merged.queueTimer = 0;
    const now = mergedNow();

    for (const slot of merged.connections.values()) {
      const stalled = (slot.status === 'open' || slot.status === 'live')
        && slot.socket && now - slot.lastFrameAt >= MERGED_CHAT_SILENCE_MS;
      const hung = slot.status === 'connecting' && slot.retryAt <= now;
      if (stalled || hung) queueMergedRetry(slot, stalled ? 'socket silent' : 'connection timed out');
    }

    const due = [...merged.connections.values()]
      .filter((slot) => !slot.cancelled
        && (slot.status === 'queued' || slot.status === 'waiting')
        && slot.retryAt <= now)
      .sort((first, second) => first.retryAt - second.retryAt || first.slug.localeCompare(second.slug));
    while (due.length && merged.inflight < MERGED_CHAT_QUEUE_LIMIT) startMergedChannel(due.shift());
    scheduleMergedQueue();
  }

  /**
   * Match the open connections to the grid, opening and closing the difference.
   *
   * Called on every grid render, so it must be cheap and idempotent when
   * nothing changed — which is why it diffs rather than tearing down and
   * rebuilding.
   */
  function syncMergedChat(slugs) {
    const merged = mergedChatState();
    const wanted = Array.isArray(slugs) ? slugs.filter((slug) => typeof slug === 'string' && slug) : [];
    const wantedSet = new Set(wanted);
    for (const slug of [...merged.connections.keys()]) {
      if (!wantedSet.has(slug)) closeMergedChannel(slug);
    }
    for (const slug of wanted) {
      if (!merged.connections.has(slug)) {
        merged.connections.set(slug, {
          slug,
          socket: null,
          status: 'queued',
          lastFrameAt: 0,
          attempts: 0,
          retryAt: mergedNow(),
          lastError: '',
          token: 0,
          cancelled: false,
          controller: null,
          finishAttempt: null,
        });
      }
    }
    if (merged.connections.size) bindMergedRecovery();
    scheduleMergedQueue();
    return merged;
  }

  function mergedChatEntries() {
    return mergedChatState().entries;
  }

  function mergedChatChannels() {
    return [...mergedChatState().connections.keys()];
  }

  function mergedChatStatus() {
    const slots = [...mergedChatState().connections.values()];
    return {
      total: slots.length,
      live: slots.filter((slot) => slot.status === 'live').length,
      connecting: slots.filter((slot) => slot.status === 'queued' || slot.status === 'connecting' || slot.status === 'open').length,
      waiting: slots.filter((slot) => slot.status === 'waiting').length,
    };
  }

  function onRealtimeFrame(event) {
    state.live.lastFrameAt = Date.now();
    const frame = parseRealtimeFrame(event.data);
    if (frame.kind === 'unparsable') {
      state.live.unparsable += 1;
      refreshLiveDiagnostics();
      return;
    }
    state.live.unparsable = 0;
    if (frame.kind === 'established') {
      state.live.socketState = 'live';
      // Proof this transport actually works, which is what lets an unverified
      // one reconnect normally instead of degrading on its first close.
      state.live.lastLiveAt = Date.now();
      refreshLiveDiagnostics();
      return;
    }
    if (frame.kind === 'chat-message') {
      // A chat frame in the shape this build parses is the only real proof an
      // unverified transport works. The handshake above proves a socket opened,
      // which is why it is enough to let one reconnect — but the reason KICK
      // ships `verified: false` is that nothing here has ever read a message
      // over it, and this is the moment that stops being true. Recorded in the
      // drift list rather than flipped silently: Kick moving the whole build
      // onto a path it had never run against is exactly what somebody reading
      // diagnostics needs to see.
      if (!state.live.providerVerified) {
        state.live.providerVerified = true;
        recordApiDrift('realtime', 'unverified-transport-verified', state.live.provider);
        refreshLiveDiagnostics();
      }
      onRealtimeChatMessage(frame.payload);
    } else if (frame.kind === 'deletion') onRealtimeDeletion(frame.payload);
  }

  function onRealtimeChatMessage(payload) {
    const settings = state.settings.content;
    const wantsHarvest = settings.liveChatEvents && settings.organizeChatStickers;
    if (!settings.countEmoteUsage && !settings.showChatBadges && !wantsHarvest) return;
    const message = normalizeChatMessage(payload);
    if (!message) return;
    if (settings.showChatBadges && message.badges.length) queueChatBadges(message);
    // Harvest every emote seen in chat — everyone's messages, not just the local
    // user's — into the library, each validated by an image load before it can
    // take a cap slot. This is the single biggest untapped collection channel.
    if (wantsHarvest && message.emotes.length) queueChatEmoteHarvest(message.emotes);
    if (!settings.countEmoteUsage || !message.emotes.length) return;
    // Only the local user's own sends are counted. Counting everyone's would
    // measure the channel, not the person, and the shelf exists to rank what
    // *this* user actually reaches for.
    if (!isLocalUser(message.sender)) return;
    const channel = state.live.slug;
    const at = Date.now();
    for (const emote of message.emotes) {
      state.emoteUsage = recordEmoteUse(state.emoteUsage, { channel, id: emote.id, name: emote.name, at });
    }
    queueUsagePersist();
  }

  const chatEmoteHarvest = { buffer: new Map(), negative: new Set(), queue: [], inflight: 0, timer: 0 };

  function queueChatEmoteHarvest(emotes) {
    for (const observation of observationsFromChatEmotes(emotes, emoteImageUrl)) {
      if (chatEmoteHarvest.negative.has(observation.key)) continue;
      chatEmoteHarvest.buffer.set(observation.key, observation);
    }
    if (chatEmoteHarvest.buffer.size && !chatEmoteHarvest.timer) {
      chatEmoteHarvest.timer = window.setTimeout(flushChatEmoteHarvest, 120);
    }
  }

  function flushChatEmoteHarvest() {
    chatEmoteHarvest.timer = 0;
    const known = [];
    for (const [key, observation] of chatEmoteHarvest.buffer) {
      if (state.stickerPreferences.library.has(key)) known.push(observation);
      else if (!chatEmoteHarvest.negative.has(key) && chatEmoteHarvest.queue.length < HARVEST_QUEUE_CAP) {
        chatEmoteHarvest.queue.push(observation);
      }
    }
    chatEmoteHarvest.buffer.clear();
    // Already-recorded emotes only need their last-seen refreshed — no image round-trip.
    if (known.length) mergeStickerLibrary(known);
    pumpChatEmoteHarvest();
  }

  function pumpChatEmoteHarvest() {
    while (chatEmoteHarvest.inflight < HARVEST_MAX_INFLIGHT && chatEmoteHarvest.queue.length) {
      const observation = chatEmoteHarvest.queue.shift();
      if (chatEmoteHarvest.negative.has(observation.key) || state.stickerPreferences.library.has(observation.key)) continue;
      chatEmoteHarvest.inflight += 1;
      const image = new Image();
      let settled = false;
      let timer = 0;
      // Guarded against a second call: the timeout and a late `onload` can both
      // arrive, and decrementing `inflight` twice would let the pump run more
      // requests than the cap allows.
      const settle = (ok) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        chatEmoteHarvest.inflight -= 1;
        if (ok) mergeStickerLibrary([observation]);
        else if (chatEmoteHarvest.negative.size < HARVEST_NEGATIVE_CAP) chatEmoteHarvest.negative.add(observation.key);
        pumpChatEmoteHarvest();
      };
      image.onload = () => settle(image.naturalWidth > 0);
      image.onerror = () => settle(false);
      timer = window.setTimeout(() => settle(false), HARVEST_TIMEOUT_MS);
      image.src = observation.src;
    }
  }

  function queueChatBadges(message) {
    if (renderChatBadges(message)) return;
    state.live.pendingBadges.set(message.id, { message, at: Date.now() });
    if (state.live.pendingBadges.size > 200) {
      const oldest = state.live.pendingBadges.keys().next().value;
      state.live.pendingBadges.delete(oldest);
    }
  }

  function replayPendingBadges() {
    if (!state.settings.content.showChatBadges || !state.live.pendingBadges.size) return;
    const now = Date.now();
    for (const [id, entry] of state.live.pendingBadges) {
      if (renderChatBadges(entry.message) || now - entry.at > CHAT_BADGE_WAIT_MS) {
        state.live.pendingBadges.delete(id);
      }
    }
  }

  function chatMessageNode(id) {
    return document.querySelector(chatMessageSelector(id));
  }

  /**
   * Render the badges Kick's own markup left out. Returns whether the message
   * node was found, which is what decides between done and retry.
   *
   * Badges already drawn by Kick are skipped by image URL, so this adds to the
   * identity rather than duplicating it. Every value here came through
   * `normalizeChatMessage`, which bounds the strings and accepts an image only
   * as an https URL on a Kick host; nodes are still built with textContent
   * rather than markup.
   */
  function renderChatBadges(message) {
    const node = chatMessageNode(message.id);
    if (!node) return false;
    if (node.dataset.kfBadgesDrawn === 'true') return true;
    node.dataset.kfBadgesDrawn = 'true';

    const drawn = new Set([...node.querySelectorAll('img')].map((image) => image.src));
    const missing = chatBadgesToRender(message.badges, drawn);
    if (!missing.length) return true;

    const strip = document.createElement('span');
    strip.className = 'kf-chat-badges';
    strip.dataset.kfChatBadges = 'true';
    for (const badge of missing) {
      if (!badge.image) {
        strip.append(chatBadgeText(badge.label));
        continue;
      }
      const image = document.createElement('img');
      image.className = 'kf-chat-badge';
      image.alt = badge.label;
      image.title = badge.label;
      image.loading = 'lazy';
      // A broken badge image must read as the badge, not as an empty box.
      image.addEventListener('error', () => image.replaceWith(chatBadgeText(badge.label)), { once: true });
      image.src = badge.image;
      strip.append(image);
    }
    node.prepend(strip);
    return true;
  }

  function chatBadgeText(label) {
    const text = document.createElement('span');
    text.className = 'kf-chat-badge-text';
    text.textContent = label;
    return text;
  }

  /**
   * The DOM only removes a deleted message, so *why* it went is invisible to every
   * scraping tool. `MessageDeletedEvent` carries it, and Kick's non-disableable AI
   * moderation is among the loudest documented complaints about the platform.
   */
  function onRealtimeDeletion(payload) {
    if (!state.settings.content.showModerationReasons) return;
    const deletion = normalizeDeletion(payload);
    if (!deletion) return;
    state.live.deletions.set(deletion.id, deletion);
    // Bounded: this is a live annotation, not a log.
    if (state.live.deletions.size > 300) {
      const oldest = state.live.deletions.keys().next().value;
      state.live.deletions.delete(oldest);
    }
    annotateDeletedMessage(deletion);
  }

  function annotateDeletedMessage(deletion) {
    // Before anything is drawn: a session log must not outlive the deletion it
    // just heard about, and the annotation below can return early.
    host.forgetChatMessage?.(deletion.id);
    const node = document.querySelector(chatMessageSelector(deletion.id));
    if (!node || node.dataset.kfDeletionNoted === 'true') return;
    node.dataset.kfDeletionNoted = 'true';
    node.dataset.kfAiModerated = String(deletion.aiModerated);
    const note = document.createElement('div');
    note.className = 'kf-deletion-note';
    note.dataset.kfDeletionNote = 'true';
    note.textContent = deletion.reason;
    node.append(note);
  }

  /**
   * A deletion event can arrive before the message it refers to has rendered, and
   * chat virtualisation can remount a node after we annotated it. Re-applying on
   * the apply cycle is cheap and covers both.
   */
  function replayPendingDeletions() {
    if (!state.settings.content.showModerationReasons || !state.live.deletions.size) return;
    for (const deletion of state.live.deletions.values()) annotateDeletedMessage(deletion);
  }

  function isLocalUser(sender) {
    const own = document.querySelector('[data-testid="chat-input"], [contenteditable="true"][role="textbox"]');
    if (!own) return false;
    const username = localUsername();
    if (!username) return false;
    return sender.username.toLowerCase() === username || sender.slug.toLowerCase() === username;
  }

  function localUsername() {
    const candidate = document.querySelector('[data-testid="user-menu"] [title], [data-testid="username"], header [data-testid="user-avatar"] img[alt]');
    const raw = candidate?.getAttribute('title') || candidate?.getAttribute('alt') || candidate?.textContent || '';
    return String(raw).trim().toLowerCase();
  }

  function queueUsagePersist() {
    clearTimeout(state.usagePersistTimer);
    state.usagePersistTimer = window.setTimeout(() => {
      gmSet(EMOTE_USAGE_KEY, state.emoteUsage);
    }, 1200);
  }

  function refreshLiveDiagnostics() {
    if (!state.shadow) return;
    if (state.currentPage === 'content') {
      const target = state.shadow.querySelector('[data-kf-live-status]');
      if (target) target.textContent = liveStatusSummary();
    }
    if (state.currentPage === 'about') {
      const drift = state.shadow.querySelector('[data-kf-api-drift]');
      if (drift) drift.textContent = assessApiDrift(state.live.apiDrift).summary;
    }
  }

  function liveStatusSummary() {
    const parts = [];
    parts.push(state.live.catalogSource === 'api'
      ? `Emote catalog from Kick's API (${state.live.catalog?.emotes.length || 0} emotes).`
      : 'Emote catalog from the picker.');
    const health = realtimeHealth({
      connected: state.live.socketState === 'live' || state.live.socketState === 'open',
      lastFrameAt: state.live.lastFrameAt,
      unparsable: state.live.unparsable,
      now: Date.now(),
    });
    const via = state.live.provider
      ? ` via ${realtimeTransport(state.live.provider)?.label || state.live.provider}${state.live.providerVerified ? '' : ' (unverified transport)'}`
      : '';
    parts.push(`Chat events: ${health.state}${via}${health.detail ? `: ${health.detail}` : ''}`);
    if (state.live.rarity) parts.push(`Rarity resolved for ${state.live.rarity.matched.length} of ${state.live.rarity.total} collectibles.`);
    if (state.live.collisions.length) parts.push(`${state.live.collisions.length} ${plural(state.live.collisions.length, 'emote name shadowed.', 'emote names shadowed.')}`);
    if (state.live.catalogError) parts.push(state.live.catalogError);
    return parts.join(' ');
  }

  return {
    closeMergedChat,
    mergedChatChannels,
    mergedChatEntries,
    mergedChatStatus,
    syncMergedChat,
    connectRealtime,
    kickFetchJson,
    liveStatusSummary,
    localUsername,
    mutateKickChannelFollow,
    onRealtimeFrame,
    readCollectibleInventory,
    recordApiDrift,
    refreshLiveChannel,
    refreshLiveDiagnostics,
    replayPendingBadges,
    replayPendingDeletions,
    teardownRealtime,
  };
}
