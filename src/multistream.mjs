// ---------------------------------------------------------------------------
// Multi-stream
//
// A grid of Kick's own embedded players and chat, so playback, subscriptions
// and entitlements all stay Kick's. Nothing here reimplements a player or
// works around an entitlement; it arranges surfaces Kick already publishes.
//
// Everything this surface needs from the page — storage, toasts, translation,
// the shared `state` object — arrives through `host` rather than being read out
// of the enclosing bundle scope. That boundary is the point: it is what lets
// this file load on its own under `node --test` with a stub host, where the
// grid's tile reuse, audio focus and cross-tab merge can be exercised without a
// browser. The build strips the imports below and relies on concat order.
// ---------------------------------------------------------------------------

import {
  MULTISTREAM_MAX,
  addMultistreamChannel,
  mergeMultistream,
  mergePresence,
  multistreamColumns,
  multistreamTileActive,
  multistreamTileMuted,
  normalizeMultistream,
  planMultistreamTiles,
  presenceOffer,
} from './core.mjs';
import {
  chatEmbedUrl,
  endpoints,
  normalizeChannel,
  normalizeCurrentViewers,
  parseChannelInput,
  playerEmbedUrl,
} from './api.mjs';

export function isPlainRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Build the multi-stream surface against a host.
 *
 * `host` supplies the page-owned collaborators: `state`, the GM storage pair,
 * the translation and announcement helpers, and the two live-data functions
 * this surface borrows to resolve channel identity.
 */
export function createMultistream(host) {
  const {
    state,
    gmGet,
    gmSet,
    MULTISTREAM_KEY,
    currentChannelSlug,
    tr,
    trf,
    escapeHtml,
    trustedHTML,
    setMarkup,
    announce,
    showToast,
    syncHeaderMultiState,
    kickFetchJson,
    recordApiDrift,
    syncCardMultiState = () => {},
  } = host;

  let syncChannel = null;

  function persistMultistream() {
    gmSet(MULTISTREAM_KEY, state.multistream);
  }

  // Re-read, merge, write. The multi-stream store is shared across tabs, so a
  // blind write drops channels another tab added since this tab booted. This
  // applies this tab's add/remove on top of the latest stored value.
  function commitMultistream(added = [], removed = []) {
    state.multistream = mergeMultistream(gmGet(MULTISTREAM_KEY, {}), state.multistream, added, removed);
    gmSet(MULTISTREAM_KEY, state.multistream);
    // A no-op commit is a deliberate re-read (on open, or after a storage
    // event) and has nothing to tell anyone.
    if (added.length || removed.length) broadcastMultistream(added, removed);
    return state.multistream;
  }

  /**
   * Converge the other tabs.
   *
   * The store is the truth and every commit re-reads it, so this is a nudge,
   * not the mechanism — which is what makes the origin split survivable.
   * `BroadcastChannel` and `localStorage` are both scoped to one origin, while
   * the userscript's GM storage is shared across `kick.com` and `www.kick.com`;
   * tabs that cannot hear each other therefore still converge the next time
   * either one opens the grid, rather than diverging silently.
   */
  function broadcastMultistream(added, removed) {
    const channel = multistreamSyncChannel();
    if (!channel) return;
    try {
      channel.postMessage({ type: 'converge', added: [...added], removed: [...removed], ts: Date.now() });
    } catch {
      // The next re-read still picks this up.
    }
  }

  function multistreamSyncChannel() {
    if (syncChannel || typeof BroadcastChannel !== 'function') return syncChannel;
    try {
      syncChannel = new BroadcastChannel('kick-focus:multi');
      syncChannel.addEventListener('message', (event) => {
        const message = event?.data;
        if (!isPlainRecord(message) || message.type !== 'converge') return;
        applyRemoteMultistream(message.added, message.removed);
      });
    } catch {
      syncChannel = null;
    }
    return syncChannel;
  }

  /**
   * Fold another tab's add/remove into this one.
   *
   * The op is re-derived from storage rather than trusted off the wire, and the
   * same union runs in every tab, so applying a message twice — or applying one
   * that this tab already saw through a storage event — lands in the same place.
   * Nothing is written back, because the tab that sent it already did.
   */
  function applyRemoteMultistream(added = [], removed = []) {
    const addList = (Array.isArray(added) ? added : []).filter((slug) => typeof slug === 'string');
    const removeList = (Array.isArray(removed) ? removed : []).filter((slug) => typeof slug === 'string');
    const next = mergeMultistream(gmGet(MULTISTREAM_KEY, {}), state.multistream, addList, removeList);
    if (JSON.stringify(next.streams) === JSON.stringify(state.multistream.streams)) return false;
    state.multistream = next;
    syncHeaderMultiState();
    syncCardMultiState();
    renderMultistream();
    renderPresenceOffer();
    return true;
  }

  /**
   * The extension build stores in `localStorage`, which raises `storage` in
   * every other tab on the origin. That makes convergence work even where
   * `BroadcastChannel` does not, and costs one listener.
   */
  function installMultistreamStorageSync() {
    if (typeof window?.addEventListener !== 'function') return;
    window.addEventListener('storage', (event) => {
      if (event?.key !== MULTISTREAM_KEY) return;
      applyRemoteMultistream();
    });
  }

  /** Add or remove one channel, from wherever the gesture came from. */
  function toggleMultistreamSlug(raw) {
    const slug = parseChannelInput(raw);
    if (!slug) return { ok: false, error: 'Enter a Kick channel name or a kick.com link.' };
    const inGrid = state.multistream.streams.some((entry) => entry.toLowerCase() === slug.toLowerCase());
    if (!inGrid && state.multistream.streams.length >= MULTISTREAM_MAX) {
      return { ok: false, error: `Multi-stream is full at ${MULTISTREAM_MAX} of ${MULTISTREAM_MAX}.` };
    }
    const result = inGrid ? commitMultistream([], [slug]) : commitMultistream([slug]);
    syncHeaderMultiState();
    syncCardMultiState();
    renderMultistream();
    return { ok: true, slug, added: !inGrid, streams: result.streams };
  }

  /**
   * Ask the other tabs which channel they are on, and collect the answers.
   *
   * Zero new permissions: `BroadcastChannel` is same-origin by construction, so
   * this reaches other kick.com tabs and nothing else, in both the userscript and
   * the extension builds. Request/response rather than a maintained roster —
   * there is no join or leave message to miss, a tab that has gone simply does
   * not answer, and every answer carries its own timestamp so a stale one expires
   * on its own. Nothing but a channel slug is ever put on the wire.
   */
  function multistreamPresenceChannel() {
    if (state.presence.channel || typeof BroadcastChannel !== 'function') return state.presence.channel;
    try {
      const channel = new BroadcastChannel('kick-focus:presence');
      channel.addEventListener('message', (event) => {
        const message = event?.data;
        if (!isPlainRecord(message)) return;
        if (message.type === 'who') {
          // Answer only from a channel page; nothing else has a slug to report.
          const slug = currentChannelSlug();
          if (slug) channel.postMessage({ type: 'here', slug, ts: Date.now() });
          return;
        }
        if (message.type === 'here') {
          state.presence.answers.push({ slug: message.slug, ts: message.ts });
          renderPresenceOffer();
        }
      });
      state.presence.channel = channel;
    } catch {
      // No cross-tab roll-call; every other multi-stream path is unaffected.
    }
    return state.presence.channel;
  }

  function requestMultistreamPresence() {
    const channel = multistreamPresenceChannel();
    if (!channel) return;
    state.presence.answers = [];
    renderPresenceOffer();
    try {
      channel.postMessage({ type: 'who', ts: Date.now() });
    } catch {
      // The offer simply stays empty.
    }
  }

  function renderPresenceOffer() {
    const button = state.shadow?.querySelector('[data-kf-presence-add]');
    if (!button) return;
    const present = mergePresence(state.presence.answers, Date.now());
    const offer = presenceOffer(present, state.multistream.streams, MULTISTREAM_MAX);
    state.presence.offer = offer;
    button.hidden = offer.length === 0;
    button.textContent = trf('Add open tabs ({count})', { count: offer.length });
    button.title = offer.join(', ');
  }

  function addPresenceOffer() {
    const offer = state.presence.offer.slice();
    if (!offer.length) return;
    const result = commitMultistream(offer, []);
    renderMultistream();
    renderPresenceOffer();
    showToast(trf('Added {count} from your other tabs — {total} of {max}', {
      count: offer.length, total: result.streams.length, max: MULTISTREAM_MAX,
    }));
    announce(trf('Added {count} channels from your other tabs.', { count: offer.length }));
  }

  function openMultistream() {
    const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
    if (!backdrop) return;
    state.lastFocused = document.activeElement;
    backdrop.hidden = false;
    // Re-read on open. A tab that was asleep, on the other origin, or simply
    // not listening when another one added a channel picks it up here — which
    // is why the broadcast can be an enhancement rather than a dependency.
    commitMultistream();
    // Someone asking the system for reduced motion should not be handed nine
    // autoplaying videos. They mount paused with a visible way to start.
    installMultistreamSuspension();
    if (!state.multistream.paused && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      state.multistream = normalizeMultistream({ ...state.multistream, paused: true });
    }
    renderMultistream();
    // Asked on open rather than kept up to date in the background: the answer is
    // only ever looked at here, and a standing roster would mean every tab
    // chattering for a list nobody is reading.
    requestMultistreamPresence();
    backdrop.querySelector('[data-kf-multistream-input]')?.focus();
    announce(tr('Multi-stream opened'));
    // Fire-and-forget: live status is an enhancement, and every path already
    // renders correctly without it.
    resolveMultistreamLive().catch(() => {});
  }

  /**
   * Resolve channel ids for the grid and every saved layout, then read all of
   * their live states in one request.
   *
   * Identity is looked up once per channel and cached for the session; the live
   * state, which is the part that actually changes, is a single bulk call no
   * matter how many layouts are saved.
   */
  async function resolveMultistreamLive() {
    if (!state.settings.content.liveEmoteCatalog && !state.settings.content.liveChatEvents) return;
    const slugs = [...new Set([
      ...state.multistream.streams,
      ...state.multistream.layouts.flatMap((layout) => layout.streams),
    ].map((slug) => slug.toLowerCase()))];
    const unresolved = slugs.filter((slug) => !state.multistreamIds.has(slug)).slice(0, MULTISTREAM_MAX * 3);
    for (const slug of unresolved) {
      const response = await kickFetchJson(endpoints.channel(slug));
      if (!response.ok) continue;
      const channel = normalizeChannel(response.body);
      if (!channel) { recordApiDrift('channel', 'shape-changed'); continue; }
      // An offline channel has no livestream id, which is already the answer and
      // costs nothing to record.
      state.multistreamIds.set(slug, channel.livestreamId);
      state.multistreamLive.set(slug, channel.isLive);
    }
    if (unresolved.length) renderMultistream();
    await refreshMultistreamLive();
  }

  function closeMultistream() {
    const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
    if (!backdrop || backdrop.hidden) return;
    backdrop.hidden = true;
    // Blanking the grid drops every embedded player, so closing the surface
    // actually stops the decoding rather than leaving nine streams running.
    const grid = backdrop.querySelector('[data-kf-multistream-grid]');
    if (grid) grid.replaceChildren();
    const chat = backdrop.querySelector('[data-kf-multistream-chat]');
    if (chat) chat.replaceChildren();
    state.observers.multistream?.disconnect?.();
    state.observers.multistream = null;
    state.multistreamSuspended.clear();
    state.lastFocused?.focus?.();
  }

  /**
   * Suspend tiles that are not being watched.
   *
   * A cross-origin embed cannot be paused or quality-capped, so unloading its
   * document is the only control over decode cost — and it is the one that
   * matters, since roughly four to six simultaneous 1080p60 decodes is the
   * realistic ceiling on integrated graphics. The focused tile is exempt: it
   * carries the audio, and cutting what someone is listening to because they
   * switched tabs would cost more than it saves.
   */
  function installMultistreamSuspension() {
    if (state.multistreamSuspensionInstalled) return;
    state.multistreamSuspensionInstalled = true;

    document.addEventListener('visibilitychange', () => {
      if (!multistreamOpen()) return;
      if (document.hidden) {
        for (const slug of state.multistream.streams) state.multistreamSuspended.add(slug);
      } else {
        state.multistreamSuspended.clear();
      }
      refreshMultistreamPlayback();
    });
  }

  /**
   * Watch tiles for visibility. Rebuilt per render because the tile set changes;
   * the observer is cheap and holding a stale one would leak removed nodes.
   */
  function observeMultistreamVisibility(grid) {
    state.observers.multistream?.disconnect?.();
    if (typeof IntersectionObserver !== 'function') return;
    state.observers.multistream = new IntersectionObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const slug = entry.target.dataset.kfMultistreamTile;
        if (!slug) continue;
        // Hidden tabs report everything as non-intersecting; visibilitychange
        // already owns that case, so ignore it here rather than fighting it.
        if (document.hidden) continue;
        const wasSuspended = state.multistreamSuspended.has(slug);
        if (entry.isIntersecting) state.multistreamSuspended.delete(slug);
        else state.multistreamSuspended.add(slug);
        if (wasSuspended !== state.multistreamSuspended.has(slug)) changed = true;
      }
      if (changed) refreshMultistreamPlayback();
    }, { root: grid, threshold: 0.05 });
    for (const tile of grid.querySelectorAll('[data-kf-multistream-tile]')) {
      state.observers.multistream.observe(tile);
    }
  }

  /** Re-apply playback state without rebuilding the grid. */
  function refreshMultistreamPlayback() {
    const grid = state.shadow?.querySelector('[data-kf-multistream-grid]');
    if (grid) applyMultistreamAudio(grid);
  }

  function multistreamOpen() {
    const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
    return Boolean(backdrop && !backdrop.hidden);
  }

  /**
   * Rebuild the grid.
   *
   * Tiles are keyed by slug and reused across renders: replacing an `<iframe>`
   * restarts its stream from scratch, so adding a ninth channel must not
   * interrupt the eight already playing.
   */
  function renderMultistream() {
    const backdrop = state.shadow?.querySelector('[data-kf-multistream-backdrop]');
    if (!backdrop || backdrop.hidden) return;
    const grid = backdrop.querySelector('[data-kf-multistream-grid]');
    const { streams, focus, chat, showChat, paused, muted } = state.multistream;

    backdrop.dataset.kfMultistreamShowChat = String(showChat && Boolean(chat));
    backdrop.dataset.kfMultistreamPaused = String(paused);
    backdrop.dataset.kfMultistreamMuted = String(muted);
    grid.style.setProperty('--kf-multistream-columns', String(multistreamColumns(streams.length)));

    const existing = new Map();
    for (const tile of grid.querySelectorAll('[data-kf-multistream-tile]')) {
      existing.set(tile.dataset.kfMultistreamTile, tile);
    }

    // Which tiles survive this render is decided in core, where it is tested
    // without a browser: replacing an iframe restarts its stream, so a channel
    // that is still wanted must keep the exact element it already had.
    const plan = planMultistreamTiles([...existing.keys()], streams);
    const ordered = [];
    for (const slug of plan.order) {
      let tile = existing.get(slug);
      if (tile) {
        existing.delete(slug);
      } else {
        tile = document.createElement('div');
        tile.dataset.kfMultistreamTile = slug;
        tile.className = 'kf-ms-tile';
        const frame = document.createElement('iframe');
        // Every tile starts muted; audio follows focus, so a nine-way grid is
        // never nine simultaneous audio streams. A paused grid mounts with no
        // src at all, which is the only way to stop a cross-origin player.
        frame.src = multistreamTileActive(state.multistream, slug, state.multistreamSuspended)
          ? playerEmbedUrl(slug, { muted: true, autoplay: true })
          : 'about:blank';
        frame.title = `${slug} stream`;
        // Kick playback is Amazon IVS HLS with no DRM, so encrypted-media would
        // be a grant with no function.
        frame.allow = 'autoplay; fullscreen; picture-in-picture';
        frame.referrerPolicy = 'origin';
        frame.loading = 'eager';
        tile.append(frame);
        const bar = document.createElement('div');
        bar.className = 'kf-ms-bar';
        setMarkup(bar, `
        <button type="button" class="kf-ms-name" data-action="multistream-focus" data-slug="${escapeHtml(slug)}" title="Give this stream the audio and chat">${escapeHtml(slug)}</button>
        <span class="kf-ms-spacer"></span>
        <a class="kf-ms-link" href="/${encodeURIComponent(slug)}" target="_blank" rel="noopener" title="Open ${escapeHtml(slug)} on Kick">Open</a>
        <button type="button" data-action="multistream-remove" data-slug="${escapeHtml(slug)}" aria-label="Remove ${escapeHtml(slug)} from the grid" title="Remove">×</button>`);
        tile.append(bar);
      }
      tile.dataset.kfMultistreamFocused = String(slug === focus);
      ordered.push(tile);
    }

    // Anything still in `existing` was removed from the grid.
    for (const stale of existing.values()) stale.remove();
    for (const tile of ordered) grid.append(tile);

    renderMultistreamChat(backdrop, chat, showChat);
    renderMultistreamControls(backdrop);
    applyMultistreamAudio(grid);
    observeMultistreamVisibility(grid);
  }

  /**
   * Audio follows focus.
   *
   * The embedded player is cross-origin, so its `muted` state cannot be reached
   * from here — the URL is the only control surface. Reloading a frame restarts
   * its stream, so only the two frames whose audio state actually changed are
   * touched, never the whole grid.
   */
  function applyMultistreamAudio(grid) {
    for (const tile of grid.querySelectorAll('[data-kf-multistream-tile]')) {
      const slug = tile.dataset.kfMultistreamTile;
      const frame = tile.querySelector('iframe');
      if (!frame) continue;
      // Dropping the document is the only lever a cross-origin embed leaves us:
      // it cannot be paused, quality-capped, or inspected from here.
      const wanted = multistreamTileActive(state.multistream, slug, state.multistreamSuspended)
        ? playerEmbedUrl(slug, { muted: multistreamTileMuted(state.multistream, slug), autoplay: true })
        : 'about:blank';
      if (frame.getAttribute('src') !== wanted) frame.setAttribute('src', wanted);
      tile.dataset.kfMultistreamSuspended = String(!multistreamTileActive(state.multistream, slug, state.multistreamSuspended)
        && !state.multistream.paused);
    }
  }

  function renderMultistreamChat(backdrop, chat, showChat) {
    const host_ = backdrop.querySelector('[data-kf-multistream-chat]');
    if (!host_) return;
    if (!showChat || !chat) {
      host_.replaceChildren();
      return;
    }
    const current = host_.querySelector('iframe');
    if (current?.dataset.slug === chat) return;
    host_.replaceChildren();
    // Kick's popout chat refuses to send from inside an iframe — it throws a
    // CSRF error by design, and only reading works. Saying so is the difference
    // between a limitation and something that looks broken.
    const notice = document.createElement('p');
    notice.className = 'kf-ms-chat-notice';
    notice.textContent = tr('Read-only here. Kick blocks sending from an embedded chat; open the channel to talk.');
    host_.append(notice);
    const frame = document.createElement('iframe');
    frame.src = chatEmbedUrl(chat);
    frame.dataset.slug = chat;
    frame.title = `${chat} chat`;
    frame.referrerPolicy = 'origin';
    host_.append(frame);
  }

  function renderMultistreamControls(backdrop) {
    const { streams, chat, showChat, layouts } = state.multistream;
    const count = backdrop.querySelector('[data-kf-multistream-count]');
    if (count) {
      // Same rule as the command count: composed text on a node that outlives the
      // render, so it translates here and the localizer is told to skip it.
      count.textContent = streams.length
        ? trf('{count} of {max} streams', { count: streams.length, max: MULTISTREAM_MAX })
        : tr('No streams yet — add a channel to start.');
    }
    const error = backdrop.querySelector('[data-kf-multistream-error]');
    if (error) {
      error.textContent = state.multistreamError;
      error.hidden = !state.multistreamError;
    }
    const chatSelect = backdrop.querySelector('[data-kf-multistream-chat-select]');
    if (chatSelect) {
      setMarkup(chatSelect, streams.map((slug) => `<option value="${escapeHtml(slug)}"${slug === chat ? ' selected' : ''}>${escapeHtml(slug)}</option>`).join(''));
      chatSelect.disabled = !streams.length;
    }
    const pauseToggle = backdrop.querySelector('[data-kf-multistream-pause]');
    if (pauseToggle) {
      pauseToggle.setAttribute('aria-pressed', String(state.multistream.paused));
      pauseToggle.textContent = state.multistream.paused ? 'Play all' : 'Pause all';
      pauseToggle.disabled = !streams.length;
    }
    const muteToggle = backdrop.querySelector('[data-kf-multistream-mute]');
    if (muteToggle) {
      muteToggle.setAttribute('aria-pressed', String(state.multistream.muted));
      muteToggle.textContent = state.multistream.muted ? 'Unmute' : 'Mute all';
      muteToggle.disabled = !streams.length || state.multistream.paused;
    }
    const chatToggle = backdrop.querySelector('[data-action="multistream-toggle-chat"]');
    if (chatToggle) {
      chatToggle.setAttribute('aria-pressed', String(showChat));
      chatToggle.textContent = showChat ? 'Hide chat' : 'Show chat';
    }
    const savedList = backdrop.querySelector('[data-kf-multistream-layouts]');
    if (savedList) {
      setMarkup(savedList, layouts.length
        ? layouts.map((layout) => {
          // Live counts come from one bulk request for every saved channel, so a
          // shelf of layouts costs the same as a single one.
          const live = layout.streams.filter((slug) => state.multistreamLive.get(slug.toLowerCase())).length;
          const status = state.multistreamLive.size
            ? `<small class="kf-ms-live" data-live="${live > 0}">${live}/${layout.streams.length} live</small>`
            : `<small>${layout.streams.length}</small>`;
          return `<span class="kf-ms-layout"><button type="button" data-action="multistream-load" data-layout="${escapeHtml(layout.name)}" title="${escapeHtml(layout.streams.join(', '))}">${escapeHtml(layout.name)} ${status}</button><button type="button" data-action="multistream-copy-layout" data-layout="${escapeHtml(layout.name)}" aria-label="Copy a link to layout ${escapeHtml(layout.name)}" title="Copy link">🔗</button><button type="button" data-action="multistream-delete-layout" data-layout="${escapeHtml(layout.name)}" aria-label="Delete layout ${escapeHtml(layout.name)}" title="Delete">×</button></span>`;
        }).join('')
        : '<span class="kf-ms-empty">No saved layouts yet.</span>');
    }
  }

  /**
   * Refresh live status for every channel across the grid and saved layouts in
   * one request. Kick's own sidebar uses this endpoint; per-channel polling for a
   * shelf of layouts would be dozens of requests for the same answer.
   */
  async function refreshMultistreamLive() {
    const slugs = [...new Set([
      ...state.multistream.streams,
      ...state.multistream.layouts.flatMap((layout) => layout.streams),
    ].map((slug) => slug.toLowerCase()))];
    if (!slugs.length) return;
    // The endpoint keys on livestream id, so only channels known to have one are
    // asked about; a channel with none is already known to be offline.
    const ids = slugs.map((slug) => state.multistreamIds.get(slug)).filter(Boolean);
    if (!ids.length) return;
    const response = await kickFetchJson(endpoints.currentViewers(ids));
    if (!response.ok) return;
    const status = normalizeCurrentViewers(response.body);
    if (!status.ok) {
      recordApiDrift('current-viewers', status.reason);
      return;
    }
    // Kick returns entries only for channels that are still live, so absence
    // from the response means the stream ended.
    const stillLive = new Set(status.entries.map((entry) => String(entry.id)));
    for (const [slug, id] of state.multistreamIds) {
      if (id) state.multistreamLive.set(slug, stillLive.has(String(id)));
    }
    renderMultistream();
  }

  function addMultistream(raw) {
    const slug = parseChannelInput(raw);
    if (!slug) {
      state.multistreamError = 'Enter a Kick channel name or a kick.com link.';
      renderMultistream();
      return;
    }
    const result = addMultistreamChannel(state.multistream, slug);
    state.multistreamError = result.ok ? '' : result.error;
    if (result.ok) {
      state.multistream = result.value;
      // Merge-write so a second tab adding a different channel is not clobbered.
      commitMultistream([slug]);
      syncHeaderMultiState();
      announce(`${slug} added to the multi-stream grid`);
    }
    renderMultistream();
  }

  /**
   * One-click add/remove of the current channel to the multi-stream grid from the
   * header, with feedback. Stays on the page: it never opens the grid or
   * navigates, so a viewer can collect several channels and open them together.
   */
  function toggleCurrentChannelInMulti() {
    const slug = currentChannelSlug();
    if (!slug) return;
    const inGrid = state.multistream.streams.some((entry) => entry.toLowerCase() === slug.toLowerCase());
    if (inGrid) {
      const result = commitMultistream([], [slug]);
      syncHeaderMultiState();
      renderMultistream();
      showToast(`Removed ${slug} from Multi — ${result.streams.length} of ${MULTISTREAM_MAX}`, false, [
        { label: 'Undo', onClick: () => { commitMultistream([slug]); syncHeaderMultiState(); renderMultistream(); } },
      ]);
      announce(`Removed ${slug} from multi-stream. Now ${result.streams.length} of ${MULTISTREAM_MAX}.`);
      return;
    }
    if (state.multistream.streams.length >= MULTISTREAM_MAX) {
      showToast(`Multi-stream is full at ${MULTISTREAM_MAX} of ${MULTISTREAM_MAX}.`, true);
      announce(`Multi-stream is full at ${MULTISTREAM_MAX} channels.`);
      return;
    }
    const result = commitMultistream([slug]);
    syncHeaderMultiState();
    renderMultistream();
    showToast(`Added ${slug} — ${result.streams.length} of ${MULTISTREAM_MAX}`, false, [
      { label: 'View', onClick: () => openMultistream() },
      { label: 'Undo', onClick: () => { commitMultistream([], [slug]); syncHeaderMultiState(); renderMultistream(); announce(`Removed ${slug} from multi-stream.`); } },
    ]);
    announce(`Added ${slug} to multi-stream. Now ${result.streams.length} of ${MULTISTREAM_MAX}.`);
  }

  return {
    addMultistream,
    addPresenceOffer,
    applyRemoteMultistream,
    closeMultistream,
    commitMultistream,
    installMultistreamStorageSync,
    multistreamOpen,
    multistreamPresenceChannel,
    multistreamSyncChannel,
    openMultistream,
    persistMultistream,
    refreshMultistreamLive,
    refreshMultistreamPlayback,
    renderMultistream,
    renderPresenceOffer,
    requestMultistreamPresence,
    resolveMultistreamLive,
    toggleCurrentChannelInMulti,
    toggleMultistreamSlug,
  };
}
