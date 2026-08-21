/**
 * Settings presentation behind an explicit page-owned host.
 *
 * The module renders markup and routes the settings pages. Runtime owns the
 * browser state, persistence, network reads, and mutations supplied through
 * host. Keeping those seams explicit lets this surface load and test alone.
 */
export function createSettings(host) {
  const {
    activeLocale,
    AD_HOSTS,
    applyCostSummary,
    applyStickerLibrarySearch,
    assessAdStack,
    assessApiDrift,
    BUNDLE_BYTE_CEILING,
    BUNDLE_BYTES,
    channelPath,
    chatKeywordsForChannel,
    COLLECTIBLE_FACTS,
    collectViewerFacts,
    companionInfo,
    compatibilitySummary,
    countChangedStickers,
    describeStickerChange,
    describeStorageFailures,
    DISCOVERY_LAYOUT_ROUTES,
    DISCOVERY_ROUTE_LABELS,
    emoteAccessLabel,
    emoteLockState,
    emoteReach,
    errorLogRows,
    escapeHtml,
    favoriteCount,
    formatBytes,
    gmGet,
    HIDEABLE_ELEMENTS,
    HIDEABLE_GROUPS,
    INJECTION,
    isFavorited,
    lastCrashSummary,
    layoutMatchesSettings,
    liveStatusSummary,
    localizedStorageFailure,
    localizeInterface,
    MULTISTREAM_MAX,
    ownedEmoteGroups,
    plural,
    PRE_IMPORT_BACKUP_KEY,
    protectionRows,
    rankSettingsMatches,
    refreshViewerCollectibles,
    remoteBlocklistSummary,
    renderChatHistoryResults,
    rewardStatusSummary,
    setMarkup,
    settingsFocusSelector,
    startChannelEmoteImport,
    state,
    STICKER_LIBRARY_LIMIT,
    stickerChangedSinceCapture,
    storageDiagnostics,
    storageHealth,
    TELEMETRY_HOSTS,
    tr,
    trf,
    VERSION,
    VIEWER_HUB_REASONS,
    VIEWER_HUB_REWARD_WORDS,
    VIEWER_HUB_TITLES,
    viewerHubCards,
    viewerHubSummary,
  } = host;

  const NAV_ITEMS = [
    ['layout', 'Layout', 'Shell, player, and chat', 'layout'],
    ['appearance', 'Appearance', 'Theme, color, and scale', 'sliders'],
    ['content', 'Content & Ads', 'Privacy, filters, and playback', 'shield'],
    ['accessibility', 'Accessibility & Shortcuts', 'Comfort and shortcuts', 'keyboard'],
    ['viewer', 'Viewer', 'Read-only account signals', 'user'],
    ['about', 'About', 'Status, privacy, and diagnostics', 'info'],
  ];

  /*
   * Feather Icons v4.29.0 — https://feathericons.com
   * Copyright (c) 2013-2017 Cole Bemis
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   *
   * Paths stay inline so the userscript remains dependency-free.
   */

  const FEATHER_ICONS = Object.freeze({
    layout: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="9" y1="9" x2="21" y2="9"></line>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    keyboard: '<rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="6" y1="8" x2="6" y2="8"></line><line x1="10" y1="8" x2="10" y2="8"></line><line x1="14" y1="8" x2="14" y2="8"></line><line x1="18" y1="8" x2="18" y2="8"></line><line x1="6" y1="12" x2="6" y2="12"></line><line x1="10" y1="12" x2="10" y2="12"></line><line x1="14" y1="12" x2="14" y2="12"></line><line x1="18" y1="12" x2="18" y2="12"></line><line x1="7" y1="16" x2="17" y2="16"></line>',
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    close: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    reset: '<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-9.5L1 10"></path>',
    export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>',
    check: '<polyline points="20 6 9 17 4 12"></polyline>',
    stats: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
  });


  function uiIcon(name) {
    return `<svg class="kf-icon" aria-hidden="true" viewBox="0 0 24 24">${FEATHER_ICONS[name] || FEATHER_ICONS.info}</svg>`;
  }


  function selected(value, expected) {
    return String(value) === String(expected);
  }


  function segmented(path, current, choices) {
    const label = path.split('.').pop().replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase());
    return `<div class="kf-segmented" role="group" aria-label="${escapeHtml(label)}">${choices.map(([value, choiceLabel]) => `<button type="button" data-set="${path}" data-value="${escapeHtml(value)}" aria-pressed="${selected(current, value)}">${escapeHtml(choiceLabel)}</button>`).join('')}</div>`;
  }


  function toggle(path, current, options = {}) {
    const disabled = options.locked ? ' disabled' : '';
    const title = options.locked ? ' title="Core protection always stays on"' : '';
    return `<button type="button" class="kf-switch" role="switch" data-set="${path}" data-value="${!current}" aria-checked="${current}" aria-label="${escapeHtml(options.label || path)}"${title}${disabled}>${tr(current ? 'On' : 'Off')}</button>`;
  }


  function row(title, description, control, options = {}) {
    return `<div class="kf-row${options.wide ? ' kf-row-wide' : ''}"><div><h3>${title}${options.locked ? '<span class="kf-lock">Core protection</span>' : ''}</h3><p>${description}</p></div><div class="kf-control">${control}</div></div>`;
  }


  function range(path, current, minimum, maximum, left, right, suffix = '') {
    // A readable accessible name instead of the dotted setting path, and
    // aria-valuetext so a screen reader hears "70%" rather than a bare "70".
    const label = path.split('.').pop().replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase());
    const valueText = `${current}${suffix}`;
    return `<div class="kf-range"><span>${escapeHtml(left)}</span><div class="kf-range-wrap"><output data-output-for="${path}">${escapeHtml(current)}${escapeHtml(suffix)}</output><input type="range" min="${minimum}" max="${maximum}" value="${current}" data-set="${path}" aria-label="${escapeHtml(label)}" aria-valuetext="${escapeHtml(valueText)}"></div><span>${escapeHtml(right)}</span></div>`;
  }


  function selectControl(path, current, choices, label) {
    return `<select class="kf-select" data-set="${escapeHtml(path)}" aria-label="${escapeHtml(label)}">${choices.map(([value, optionLabel]) => `<option value="${escapeHtml(value)}"${selected(current, value) ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`).join('')}</select>`;
  }

  /**
   * A grid of multi-select chips, one per catalog entry, grouped by surface.
   *
   * `aria-pressed` rather than a checkbox because these are independent
   * on/off actions rather than a form to submit, and the same pattern the rest of
   * this panel already uses for a pressed state.
   */

  function hideElementGrid(hidden) {
    return `<div class="kf-hide-grid">${HIDEABLE_GROUPS.map((group) => `<div class="kf-hide-group"><span class="kf-hide-heading">${escapeHtml(tr(group.label))}</span><div class="kf-hide-chips" role="group" aria-label="${escapeHtml(tr(group.label))}">${HIDEABLE_ELEMENTS
      .filter((entry) => entry.group === group.id)
      .map((entry) => `<button type="button" class="kf-hide-chip" data-action="toggle-hidden-element" data-element="${escapeHtml(entry.id)}" aria-pressed="${hidden.includes(entry.id)}">${escapeHtml(tr(entry.label))}</button>`)
      .join('')}</div></div>`).join('')}</div>`;
  }


  function pageHeader(title, description, metaLabel, metaValue) {
    return `<div class="kf-page-header"><div><span class="kf-eyebrow">Kick Focus settings</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><div class="kf-page-meta"><span>${escapeHtml(metaLabel)}</span><strong>${escapeHtml(metaValue)}</strong></div></div>`;
  }

  // ---------------------------------------------------------------------------
  // Discovery layouts
  //
  // Named snapshots of the settings that decide how a discovery page looks, each
  // optionally tied to the routes it belongs to. Browse can be dense and
  // unfiltered while Home stays calm.
  //
  // Local, and only ever this build's own settings applied to markup Kick has
  // already sent. Nothing here asks Kick for different cards or reorders a rail,
  // and no copy in the interface suggests otherwise.
  // ---------------------------------------------------------------------------


  function renderDiscoveryLayouts() {
    const layouts = state.discoveryLayouts;
    const routeChips = DISCOVERY_LAYOUT_ROUTES.map((route) => `<button type="button" class="kf-chip" data-kf-layout-route="${route}" aria-pressed="false">${escapeHtml(tr(DISCOVERY_ROUTE_LABELS[route]))}</button>`).join('');
    const saved = layouts.length
      ? layouts.map((layout) => {
        const active = layoutMatchesSettings(layout, state.settings);
        return `<div class="kf-layout-entry" data-active="${active}">
          <div><strong data-kf-no-translate>${escapeHtml(layout.name)}</strong><span>${layout.routes.length
            ? escapeHtml(layout.routes.map((route) => tr(DISCOVERY_ROUTE_LABELS[route])).join(' · '))
            : escapeHtml(tr('Applied only when you press it'))}${active ? ` · ${escapeHtml(tr('Currently applied'))}` : ''}</span></div>
          <div class="kf-button-group">
            <button type="button" class="kf-button kf-button-small" data-action="apply-layout" data-kf-layout="${escapeHtml(layout.name)}">Apply</button>
            <button type="button" class="kf-button kf-button-small kf-danger" data-action="delete-layout" data-kf-layout="${escapeHtml(layout.name)}" aria-label="Delete this saved view">✕</button>
          </div>
        </div>`;
      }).join('')
      : `<p class="kf-status-note">No saved views yet. Set the page up the way you want it, name it, and save.</p>`;

    return `<section class="kf-subsection">
      <div class="kf-panel">
        <div class="kf-action-row"><div><h3>Saved views</h3><p>Keep the density, thumbnail size, rails, and content filters you like as a named view, and have it applied when you open the pages you chose. It is your own settings, applied to what Kick already sent. It changes nothing about what Kick recommends or the order anything appears in.</p></div></div>
        <div class="kf-row kf-row-wide">
          <div><h3>Save this page as a view</h3><p>Pick the pages it should apply to, or none to keep it manual.</p></div>
          <div class="kf-layout-save">
            <input class="kf-text" type="text" data-kf-layout-name maxlength="40" placeholder="Name this view" aria-label="Name this view">
            <div class="kf-chip-row">${routeChips}</div>
            <button type="button" class="kf-button" data-action="save-layout">Save this view</button>
          </div>
        </div>
        <div class="kf-layout-list">${saved}</div>
      </div>
    </section>`;
  }


  function renderLayoutPage() {
    const value = state.settings.layout;
    return `
      ${pageHeader('Layout', 'Control how Kick is arranged across your desktop.', 'Current setup', `${value.sidebar} sidebar · ${value.chat} chat`)}
      <section class="kf-panel">
        ${row('Sidebar mode', 'Choose how the left discovery rail behaves. Dropdown collapses it to a tab that expands on hover, giving the grid full width. Desktop widths only.', segmented('layout.sidebar', value.sidebar, [['auto','Auto'],['compact','Compact'],['dropdown','Dropdown'],['hidden','Hidden']]))}
        ${row('Chat layout', 'Place chat on either side, float it as a dock, or hide it.', segmented('layout.chat', value.chat, [['right','Right'],['left','Left'],['docked','Docked'],['hidden','Hidden']]))}
        ${row('Chat width', 'Set the width of the live chat column.', range('layout.chatWidth', value.chatWidth, 320, 520, '320 px', '520 px', ' px'), { wide: true })}
        ${row('Content density', 'Adjust spacing and padding across discovery pages.', segmented('layout.density', value.density, [['comfortable','Comfortable'],['compact','Compact']]))}
        ${row('Stream start behavior', 'Choose how each channel opens.', segmented('layout.streamStart', value.streamStart, [['standard','Standard'],['theater','Theater'],['focus','Focus']]))}
        ${row('Remember per-channel layout', 'Keep the last runtime layout for each channel.', toggle('layout.rememberPerChannel', value.rememberPerChannel, { label: 'Remember per-channel layout' }))}
        ${row('Widen browse grids', 'Use reclaimed sidebar space for larger, calmer stream cards.', toggle('layout.wideGrid', value.wideGrid, { label: 'Widen browse grids' }))}
        ${row('Show Following rail', 'Keep the Following discovery rail visible when Kick provides it.', toggle('layout.showFollowingRail', value.showFollowingRail, { label: 'Show Following rail' }))}
        ${row('Show Recommended rail', 'Keep recommended stream rows visible in the main content.', toggle('layout.showRecommendedRail', value.showRecommendedRail, { label: 'Show Recommended rail' }))}
        ${row('Hide Kick’s own controls', 'Switch off the player buttons and sidebar entries you never use. Each one is hidden with styling only — nothing is clicked or removed, and turning it back on restores it immediately.', hideElementGrid(value.hidden), { wide: true })}
        ${row('Sticky compact top bar', 'Keep search and account controls available while browsing.', toggle('layout.stickyTopbar', value.stickyTopbar, { label: 'Sticky compact top bar' }))}
        ${row('Show quick command button', 'Keep the Focus control beside Get KICKs in Kick’s top header.', toggle('layout.quickButton', value.quickButton, { label: 'Show quick command button' }))}
        ${row('Move mini-player clear of controls', 'Raise Kick’s embedded mini-player only when the Focus control has to use its floating fallback.', toggle('layout.miniPlayerCollision', value.miniPlayerCollision, { label: 'Move mini-player clear of controls' }))}
        ${row('Recover player after resize', 'Re-apply player geometry after a window or monitor change.', toggle('layout.playerResizeRecovery', value.playerResizeRecovery, { label: 'Recover player after resize' }))}
        ${row('Keep ultrawide video uncropped', 'Prefer contained video geometry on wide or moved displays.', toggle('layout.playerContainVideo', value.playerContainVideo, { label: 'Keep ultrawide video uncropped' }))}
      </section>
      ${renderDiscoveryLayouts()}`;
  }


  function renderAppearancePage() {
    const value = state.settings.appearance;
    const themes = [
      ['studio', 'Studio', 'Layered graphite', 'Balanced depth with a quiet green undertone.'],
      ['oled', 'OLED', 'True black', 'Minimal lift and maximum contrast for dark rooms.'],
      ['slate', 'Slate', 'Cool graphite', 'Blue-toned surfaces with stronger separation.'],
    ];
    const accents = [['kick','Kick Green'],['cyan','Cyan'],['violet','Violet'],['gold','Gold'],['custom','Custom']];
    const presets = [
      ['calm', 'Calm', 'Roomier cards, quieter live color, and a compact rail.'],
      ['cinema', 'Cinema', 'OLED surfaces with the player first and chrome tucked away.'],
      ['chat', 'Chat First', 'A wider docked chat, compact density, and a clearer accent.'],
      ['discovery', 'Discovery', 'More stream cards, vivid thumbnails, and both discovery rails.'],
    ];
    return `
      <div class="kf-page-header"><div><span class="kf-eyebrow">Kick Focus settings</span><h2>Appearance</h2><p>Choose a clear visual direction, then tune only what matters to you.</p></div><div class="kf-page-meta kf-page-meta-control"><span>Language</span>${selectControl('appearance.language', value.language, [['auto','Auto'],['en','English'],['es','Español'],['pt','Português']], 'Interface language')}</div></div>
      <div class="kf-appearance-layout">
        <section class="kf-panel kf-appearance-controls">
          <div class="kf-row kf-row-wide"><div><h3>Quick directions</h3><p>Apply a viewing setup without changing filters or account choices.</p></div><div class="kf-preset-grid">${presets.map(([id, label, description]) => `<button type="button" class="kf-preset-card" data-action="apply-viewing-preset" data-preset="${id}"><span>Direction</span><strong>${label}</strong><small>${description}</small></button>`).join('')}</div></div>
          <div class="kf-row kf-row-wide"><div><h3>Theme</h3><p>Each theme changes the full surface hierarchy, not just the page background.</p></div><div class="kf-theme-grid">${themes.map(([id, label, tone, description]) => `<button type="button" class="kf-theme-board" data-set="appearance.theme" data-value="${id}" aria-pressed="${selected(value.theme, id)}"><span class="kf-theme-board-top"><span>${tone}</span><span class="kf-theme-selected">${selected(value.theme, id) ? 'Selected' : ''}</span></span><span class="kf-theme-tones" aria-hidden="true"><i></i><i></i><i></i></span><span class="kf-theme-copy"><strong>${label}</strong><small>${description}</small></span></button>`).join('')}</div></div>
          <div class="kf-row kf-row-wide"><div><h3>Accent color</h3><p>Use one accent for focus, selection, and live state.</p></div><div class="kf-swatch-grid">${accents.map(([id,label]) => `<button type="button" class="kf-accent-chip" data-set="appearance.accent" data-value="${id}" aria-pressed="${selected(value.accent,id)}"><span class="kf-swatch" data-color="${id}" aria-hidden="true"></span><strong>${label}</strong></button>`).join('')}</div></div>
          <div class="kf-row kf-row-wide kf-custom-accent-row" data-visible="${selected(value.accent, 'custom')}"><div><h3>Custom accent</h3><p>Low-contrast choices fall back to a safe rose.</p></div><label class="kf-custom-color"><input type="color" data-set="appearance.customAccent" value="${escapeHtml(value.customAccent)}" aria-label="Custom accent color"><span><strong data-kf-no-translate>${escapeHtml(value.customAccent)}</strong><small>Contrast protected</small></span></label></div>
          ${row('Corner radius', 'Adjust the roundness of enhanced UI.', segmented('appearance.radius', value.radius, [['subtle','Subtle'],['balanced','Balanced'],['rounded','Rounded']]))}
          ${row('Thumbnail treatment', 'Adjust stream-card color intensity.', range('appearance.thumbnail', value.thumbnail, 0, 100, 'Natural', 'Vivid', '%'), { wide: true })}
          ${row('Interface scale', 'Set the size of Kick Focus controls.', segmented('appearance.interfaceScale', value.interfaceScale, [[90,'90%'],[100,'100%'],[110,'110%']]))}
          ${row('Dim watched cards', 'Reduce emphasis on streams you have already opened.', toggle('appearance.dimWatched', value.dimWatched, { label: 'Dim watched cards' }))}
          ${row('Strengthen text contrast', 'Increase legibility on muted surfaces.', toggle('appearance.strongContrast', value.strongContrast, { label: 'Strengthen text contrast' }))}
          ${row('Colorize live indicators', 'Use the selected accent for live-state emphasis.', toggle('appearance.colorizeLive', value.colorizeLive, { label: 'Colorize live indicators' }))}
        </section>
        <aside class="kf-preview" aria-label="Live style preview">
          <div><div class="kf-preview-kicker">Live preview</div><p class="kf-preview-intro">Your current theme, accent, scale, and card treatment.</p></div>
          <div class="kf-preview-surface">
            <header><strong>Kick Focus</strong><span>Browse</span><span>Following</span></header>
            <img class="kf-preview-image" src="__KICK_FOCUS_PREVIEW__" alt="">
            <section class="kf-preview-feature">
              <div class="kf-preview-live">Live now</div>
              <h3>Creative tools and workflows</h3>
              <p>Studio Live · Design & Technology</p>
              <div class="kf-preview-action"><span>2.4K watching</span><b>Follow</b></div>
            </section>
            <div class="kf-preview-list"><span>Recommended</span><strong>Three calm, focused rows</strong></div>
            <div class="kf-preview-list"><span>Theme</span><strong>${escapeHtml(themes.find(([id]) => id === value.theme)?.[1] || value.theme)} · ${escapeHtml(value.interfaceScale)}%</strong></div>
          </div>
        </aside>
      </div>`;
  }

  /**
   * Observability for the mod's own failures. A client mod on a churning site
   * fails silently otherwise. Uncaught errors from the mod's own entry points are
   * captured to a bounded local ring buffer the user can view and copy (sanitized,
   * no query strings), and the last one persists across reload. Nothing is sent.
   */

  function localChannelTools() {
    const path = channelPath();
    if (!path) {
      return '<div class="kf-notice">Open a channel page to set channel-specific chat keywords or a private local note.</div>';
    }
    const keywords = chatKeywordsForChannel().join(', ');
    const note = typeof state.channelNotes[path] === 'string' ? state.channelNotes[path] : '';
    return `
      <section class="kf-panel">
        <div class="kf-row kf-row-wide"><div><h3>Chat keywords for this channel</h3><p>Comma-separated words are highlighted locally in chat. They never leave this browser.</p></div><input class="kf-text" data-kf-chat-keywords value="${escapeHtml(keywords)}" placeholder="release, giveaway, raid" aria-label="Chat keywords for this channel"></div>
        <div class="kf-row kf-row-wide"><div><h3>Private channel note</h3><p>Keep a local reminder for this channel. It is not sent to Kick.</p></div><textarea class="kf-textarea" data-kf-channel-note maxlength="1000" placeholder="Why I follow this channel…" aria-label="Private channel note">${escapeHtml(note)}</textarea></div>
        <div class="kf-action-row"><div><h3>Save local channel tools</h3><p>Only this channel path and the values above are stored.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="clear-local-channel">Clear this channel</button><button type="button" class="kf-button kf-button-primary" data-action="save-local-channel">Save</button></div></div>
      </section>`;
  }


  function remoteBlocklistControls() {
    const value = state.settings.content;
    return `
      <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Optional data-only blocklist</h3><p>Fetch a user-supplied JSON list of channels, categories, and keywords. No code is accepted or executed.</p></div><button type="button" class="kf-button kf-button-small" data-action="clear-blocklist">Remove cached list</button></div>
        <div class="kf-panel">
          ${row('Enable subscription', 'Off by default. When enabled, refreshes only over HTTPS with credentials omitted.', toggle('content.blocklistSubscription', value.blocklistSubscription, { label: 'Enable optional blocklist subscription' }))}
          <div class="kf-row kf-row-wide"><div><h3>HTTPS JSON URL</h3><p>Expected fields: channels, categories, and keywords. Unknown fields are rejected.</p></div><input class="kf-text" type="url" data-set="content.blocklistUrl" value="${escapeHtml(value.blocklistUrl)}" placeholder="https://example.com/kick-focus-blocklist.json" aria-label="Optional blocklist URL"></div>
          ${row('Refresh interval', 'Keep the last valid payload if a later request fails.', segmented('content.blocklistRefreshHours', value.blocklistRefreshHours, [[6,'6 h'],[12,'12 h'],[24,'24 h'],[72,'72 h']]))}
        </div>
        <div class="kf-status-note" data-kf-remote-blocklist data-status="${escapeHtml(state.remoteBlocklist.status)}">${escapeHtml(remoteBlocklistSummary())}</div>
      </section>`;
  }

  /**
   * What this account may actually send, in one line.
   *
   * Kick never states this anywhere: its picker shows the emotes of the channel
   * you are standing in, so the answer to "what do I own" is only reachable by
   * visiting every channel you subscribe to. The authenticated catalog answers it
   * in one read — see `applyAccountEntitlement`.
   */

  function emoteInventorySummary() {
    const account = state.live.catalog?.account;
    if (!account?.authenticated) return '';
    const sets = account.ownedSets.length;
    if (!account.ownedEmotes) return tr('Kick reports no emotes this account can send anywhere.');
    const from = sets
      ? `${sets} ${plural(sets, 'subscribed channel', 'subscribed channels')}`
      : tr('your global sets');
    return `${trf('{count} emotes usable in any chat', { count: account.ownedEmotes })} · ${from}`;
  }


  function stickerLibrarySummary() {
    const library = [...state.stickerPreferences.library.values()];
    const locked = library.filter((sticker) => sticker.access === 'locked').length;
    const channel = library.filter((sticker) => sticker.access === 'channel').length;
    const observed = library.filter((sticker) => sticker.access === 'observed').length;
    const changed = countChangedStickers(library);
    const atCapacity = library.length >= STICKER_LIBRARY_LIMIT;
    return `${library.length} recorded · ${favoriteCount()} favorites · ${state.stickerPreferences.hidden.size} removed · ${state.stickerPreferences.groups.length} custom groups${channel ? ` · ${channel} channel-only` : ''}${observed ? ` · ${observed} seen in chat` : ''}${locked ? ` · ${locked} subscriber-only` : ''}${changed ? ` · ${changed} changed by Kick` : ''}${atCapacity ? ` · full (${STICKER_LIBRARY_LIMIT}); oldest chat-only emotes drop first` : ''}`;
  }

  /** First/last capture in the user's terms; '' for entries recorded before schema 4. */

  function stickerSeenSummary(sticker) {
    if (!sticker.firstSeen) return '';
    const day = (time) => new Date(time).toISOString().slice(0, 10);
    const first = day(sticker.firstSeen);
    const last = sticker.lastSeen ? day(sticker.lastSeen) : '';
    return last && last !== first ? `First seen ${first} · last ${last}` : `First seen ${first}`;
  }


  function stickerLibraryFilterMatches(sticker, filter) {
    if (filter === 'mine') return sticker.access === 'available' && sticker.usableEverywhere === true;
    if (filter === 'favorites') return isFavorited(sticker.key);
    if (filter === 'removed') return state.stickerPreferences.hidden.has(sticker.key);
    if (filter === 'changed') return stickerChangedSinceCapture(sticker);
    if (filter === 'observed') return sticker.access === 'observed';
    if (filter === 'channel') return sticker.access === 'channel';
    if (filter === 'locked') return sticker.access === 'locked';
    if (filter === 'ungrouped') return !state.stickerPreferences.assignments.has(sticker.key);
    if (filter.startsWith('group:')) return state.stickerPreferences.assignments.get(sticker.key) === filter.slice(6);
    return true;
  }


  function stickerGroupOptions(selectedGroup = '') {
    return `<option value="">Ungrouped</option>${state.stickerPreferences.groups.map((group) => `<option value="${escapeHtml(group.id)}"${selected(group.id, selectedGroup) ? ' selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}`;
  }


  function stickerLibraryCard(sticker) {
    const favorite = isFavorited(sticker.key);
    const removed = state.stickerPreferences.hidden.has(sticker.key);
    const groupId = state.stickerPreferences.assignments.get(sticker.key) || '';
    const nativeGroups = sticker.nativeGroups.length ? sticker.nativeGroups.join(', ') : 'Unknown Kick group';
    const searchText = `${sticker.name} ${nativeGroups} ${sticker.sourceSlug || ''}`.toLowerCase();
    // Shared with the chat hover card, so the two cannot describe the same
    // emote differently.
    const accessLabel = emoteAccessLabel(sticker.access);
    // Reach, not ownership — the two are independent, and Kick shows neither.
    const reach = emoteReach(sticker);
    const reachNote = reach.text ? trf(reach.text, { channel: reach.channel }) : '';
    const changeNote = describeStickerChange(sticker);
    const seenNote = stickerSeenSummary(sticker);
    // A greyed tile with no explanation teaches nothing. Nothing here enables
    // or sends anything; it names the reason and links to Kick's own page.
    const lock = sticker.access === 'locked'
      ? emoteLockState({ ...sticker, locked: true }, sticker.nativeGroups[0] || '')
      : { locked: false, reason: '', unlockUrl: '' };
    return `<article class="kf-sticker-library-item" data-kf-sticker-library-item data-kf-sticker-search="${escapeHtml(searchText)}" data-removed="${removed}" data-changed="${Boolean(changeNote)}">
      <div class="kf-sticker-library-image"><img src="${escapeHtml(sticker.src)}" alt="${escapeHtml(sticker.name)}" loading="lazy"></div>
      <div class="kf-sticker-library-copy"><strong data-kf-no-translate title="${escapeHtml(sticker.name)}">${escapeHtml(sticker.name)}</strong><small title="${escapeHtml(nativeGroups)}">${escapeHtml(nativeGroups)}</small>${seenNote ? `<small title="${escapeHtml(seenNote)}">${escapeHtml(seenNote)}</small>` : ''}<span class="kf-sticker-access" data-access="${escapeHtml(sticker.access)}">${accessLabel}</span>${reachNote ? `<span class="kf-sticker-access kf-sticker-reach" data-reach="${sticker.usableEverywhere ? 'anywhere' : 'local'}">${escapeHtml(reachNote)}</span>` : ''}${changeNote ? `<span class="kf-sticker-changed" title="${escapeHtml(changeNote)}">Changed by Kick</span>` : ''}${lock.locked ? `<small class="kf-sticker-lock">${escapeHtml(lock.reason)}${lock.unlockUrl ? ` <a href="${escapeHtml(lock.unlockUrl)}" target="_blank" rel="noopener">Unlock on Kick</a>` : ''}</small>` : ''}</div>
      <div class="kf-sticker-library-actions">
        <a class="kf-button kf-button-small" href="${escapeHtml(sticker.src)}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(sticker.name)} artwork">Open artwork</a>
        <button type="button" class="kf-button kf-button-small" data-action="copy-sticker-name" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-label="Copy the name ${escapeHtml(sticker.name)}">Copy name</button>
        ${state.settings.content.insertEmoteName ? `<button type="button" class="kf-button kf-button-small" data-action="insert-sticker-name" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-label="Type the name ${escapeHtml(sticker.name)} into chat">Type in chat</button>` : ''}
        <button type="button" class="kf-button kf-button-small" data-action="favorite-library-sticker" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Remove favorite' : 'Favorite'} ${escapeHtml(sticker.name)}">${favorite ? '★ Favorite' : '☆ Favorite'}</button>
        <button type="button" class="kf-button kf-button-small${removed ? '' : ' kf-danger'}" data-action="remove-library-sticker" data-kf-sticker-key="${escapeHtml(sticker.key)}" aria-label="${removed ? 'Restore' : 'Remove'} ${escapeHtml(sticker.name)}">${removed ? 'Restore' : 'Remove'}</button>
        <select class="kf-select" data-kf-sticker-assignment="${escapeHtml(sticker.key)}" aria-label="Custom group for ${escapeHtml(sticker.name)}">${stickerGroupOptions(groupId)}</select>
      </div>
    </article>`;
  }


  function renderStickerLibraryManager() {
    const filter = state.runtime.stickerLibraryFilter;
    const ownedGroups = ownedEmoteGroups([...state.stickerPreferences.library.values()]);
    const ownedCount = ownedGroups.reduce((total, group) => total + group.entries.length, 0);
    const myEmotesLabel = trf('My emotes ({count})', { count: ownedCount });
    const library = [...state.stickerPreferences.library.values()]
      .filter((sticker) => stickerLibraryFilterMatches(sticker, filter))
      .sort((left, right) => {
        const favoriteDifference = Number(isFavorited(right.key)) - Number(isFavorited(left.key));
        if (favoriteDifference) return favoriteDifference;
        const removedDifference = Number(state.stickerPreferences.hidden.has(left.key)) - Number(state.stickerPreferences.hidden.has(right.key));
        return removedDifference || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      });
    const filters = [
      ['all', `All recorded (${state.stickerPreferences.library.size})`],
      ['mine', myEmotesLabel],
      ['favorites', `Favorites (${favoriteCount()})`],
      ['removed', `Removed (${state.stickerPreferences.hidden.size})`],
      ['changed', `Changed by Kick (${countChangedStickers(state.stickerPreferences.library)})`],
      ['observed', 'Seen in chat'],
      ['channel', 'Channel-only'],
      ['locked', 'Subscriber-only'],
      ['ungrouped', 'Ungrouped'],
      ...state.stickerPreferences.groups.map((group) => [`group:${group.id}`, group.name]),
    ];
    const groupRows = state.stickerPreferences.groups.map((group) => {
      const count = [...state.stickerPreferences.assignments.values()].filter((groupId) => groupId === group.id).length;
      return `<div class="kf-sticker-group-row">
        <input class="kf-text" value="${escapeHtml(group.name)}" maxlength="60" data-kf-sticker-group-name="${escapeHtml(group.id)}" aria-label="Rename ${escapeHtml(group.name)}">
        <button type="button" class="kf-button kf-button-small" data-action="rename-sticker-group" data-kf-sticker-group-id="${escapeHtml(group.id)}">Save name</button>
        <button type="button" class="kf-button kf-button-small kf-danger" data-action="delete-sticker-group" data-kf-sticker-group-id="${escapeHtml(group.id)}">Delete (${count})</button>
      </div>`;
    }).join('');
    const cards = library.map(stickerLibraryCard).join('');
    const myGroups = filter === 'mine' ? ownedEmoteGroups(library) : [];
    const groupedCards = myGroups.map((group) => `<section class="kf-my-emote-group" data-kf-my-emote-group>
      <header><div><span>${group.source ? 'Subscribed channel' : 'Global collection'}</span><h4 data-kf-no-translate>${escapeHtml(group.label)}</h4></div><strong>${group.entries.length} ${plural(group.entries.length, 'emote', 'emotes')}</strong></header>
      <div class="kf-sticker-library-grid">${group.entries.map(stickerLibraryCard).join('')}</div>
    </section>`).join('');
    const inventory = emoteInventorySummary();
    const accountKnown = Boolean(state.live.catalog?.account?.authenticated);
    const myEmotesEmpty = accountKnown
      ? 'Kick reports no emotes this account can use in every chat.'
      : 'Sign in to Kick and open any channel once to load your owned emotes. Nothing is sent or changed.';
    return `
      <section class="kf-subsection" data-kf-sticker-library>
        <div class="kf-subsection-header"><div><h3>${filter === 'mine' ? 'My emotes' : 'Recorded emote library'}</h3><p data-kf-sticker-library-summary>${escapeHtml(stickerLibrarySummary())}</p>${inventory ? `<p class="kf-meta" data-kf-emote-inventory data-kf-no-translate>${escapeHtml(inventory)}</p>` : ''}</div><div class="kf-button-group"><button type="button" class="kf-button kf-button-small${filter === 'mine' ? ' kf-button-primary' : ''}" data-action="show-my-emotes" aria-pressed="${filter === 'mine'}">${escapeHtml(myEmotesLabel)}</button>${filter === 'mine' ? '<button type="button" class="kf-button kf-button-small" data-action="show-recorded-emotes">All recorded</button>' : ''}<button type="button" class="kf-button kf-button-small" data-action="export">Export all settings</button><button type="button" class="kf-button kf-button-small" data-action="clear-sticker-preferences">Reset organization</button></div></div>
        <div class="kf-sticker-library-shell">
          <div class="kf-emote-catalog-browser">
            <h4>Browse any channel’s emotes</h4>
            <p>Paste a channel name or Kick URL. Artwork is public, but importing it never bypasses chat access: free emotes stay channel-only and subscriber emotes stay locked until Kick confirms your account can use them.</p>
            <div class="kf-emote-catalog-form">
              <input class="kf-text" value="${escapeHtml(state.runtime.emoteCatalogSlug)}" data-kf-emote-catalog-input placeholder="channel or kick.com URL" aria-label="Channel emote catalog">
              <button type="button" class="kf-button kf-button-primary" data-action="import-channel-emotes"${state.runtime.emoteCatalogLoading ? ' disabled' : ''}>${state.runtime.emoteCatalogLoading ? 'Loading…' : 'Load emotes'}</button>
            </div>
            <p class="kf-emote-catalog-status" data-kf-emote-catalog-status data-error="${state.runtime.emoteCatalogError}"${state.runtime.emoteCatalogStatus ? '' : ' hidden'}>${escapeHtml(state.runtime.emoteCatalogStatus)}</p>
          </div>
          <div class="kf-sticker-library-controls">
            <input class="kf-text" type="search" value="${escapeHtml(state.runtime.stickerLibraryQuery)}" data-kf-sticker-library-search placeholder="Search recorded emotes or Kick groups" aria-label="Search recorded emotes">
            <select class="kf-select" data-kf-sticker-library-filter aria-label="Filter recorded emotes">${filters.map(([value, label]) => `<option value="${escapeHtml(value)}"${selected(filter, value) ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>
          </div>
          <div class="kf-sticker-group-builder"><input class="kf-text" maxlength="60" data-kf-new-sticker-group placeholder="New custom group name" aria-label="New emote group name"><button type="button" class="kf-button kf-button-primary" data-action="create-sticker-group">Create group</button></div>
          ${groupRows ? `<div class="kf-sticker-group-list">${groupRows}</div>` : ''}
          <div class="kf-sticker-library-meta"><span data-kf-sticker-library-visible>${library.length} shown</span><span>New emotes from chat and the picker are merged automatically and included in export.</span></div>
          ${filter === 'mine' ? (groupedCards || `<div class="kf-notice">${myEmotesEmpty}</div>`) : filter === 'removed' ? `<div class="kf-notice">Removed emotes are no longer stored, which frees their library slots. ${state.stickerPreferences.hidden.size} ${plural(state.stickerPreferences.hidden.size, 'emote is kept out of the library.', 'emotes are kept out of the library.')}${state.stickerPreferences.hidden.size ? ` <button type="button" class="kf-button kf-button-small" data-action="restore-removed-stickers">Restore all removed</button>` : ''}</div>` : cards ? `<div class="kf-sticker-library-grid">${cards}</div>` : `<div class="kf-notice">${state.stickerPreferences.library.size ? 'No recorded emotes match this filter.' : 'Watch chat or open Kick’s emote picker to begin the library. New emotes are saved whenever Kick exposes them.'}</div>`}
        </div>
      </section>`;
  }


  function renderCollectiblePanel() {
    const inventory = state.live.inventory;
    const changed = countChangedStickers(state.stickerPreferences.library);
    const observed = inventory
      ? (inventory.quantityKnown
        ? trf('Your inventory holds {copies} {copiesWord} across {distinct} distinct {distinctWord} — {duplicates} {duplicatesWord}, or {rate}% of what you have pulled.', {
          copies: inventory.copies,
          copiesWord: plural(inventory.copies, 'collectible', 'collectibles'),
          distinct: inventory.distinct,
          distinctWord: plural(inventory.distinct, 'item', 'items'),
          duplicates: inventory.duplicates,
          duplicatesWord: plural(inventory.duplicates, 'duplicate', 'duplicates'),
          rate: Math.round(inventory.duplicateRate * 100),
        })
        : trf('Your inventory holds {distinct} distinct {distinctWord}. Kick’s response carries no per-item quantity, so a duplicate rate cannot be measured from it — that number is unavailable rather than zero.', {
          distinct: inventory.distinct,
          distinctWord: plural(inventory.distinct, 'collectible', 'collectibles'),
        }))
      : 'Open a channel with collectibles while signed in to read your own inventory. Nothing is fetched otherwise.';
    return `
      <div class="kf-panel">
        <div class="kf-action-row"><div><h3>What Kick does not explain</h3><p>${escapeHtml(observed)}${changed ? ` ${changed} ${plural(changed, 'recorded emote has been changed by Kick since first capture — see the Changed by Kick filter in the library below.', 'recorded emotes have been changed by Kick since first capture — see the Changed by Kick filter in the library below.')}` : ''}</p></div></div>
        <dl class="kf-fact-list">${COLLECTIBLE_FACTS.map((fact) => `<div class="kf-fact"><dt>${escapeHtml(fact.claim)}</dt><dd>${escapeHtml(fact.detail)}</dd></div>`).join('')}</dl>
      </div>`;
  }


  function renderLiveDataSection(value) {
    const collisions = state.live.collisions;
    const rarity = state.live.rarity;
    return `
      <section class="kf-subsection kf-content-section">
        <div class="kf-subsection-header"><div><h3>Kick data</h3><p>Read Kick’s own endpoints instead of scraping the page. Same-origin, read-only, using the session you are already signed into. Nothing is sent anywhere.</p></div></div>
        <div class="kf-panel">
          <div class="kf-status-note" data-kf-live-status>${escapeHtml(liveStatusSummary())}</div>
          ${row('Load the emote catalog from Kick', 'Read the full channel, global, and emoji sets without treating public artwork as account access. Falls back to the picker if the response changes shape.', toggle('content.liveEmoteCatalog', value.liveEmoteCatalog, { label: 'Load the emote catalog from Kick' }))}
          ${row('Follow live chat events', 'Subscribe to the same realtime chat feed Kick’s own client uses. The provider is read from Kick rather than hardcoded.', toggle('content.liveChatEvents', value.liveChatEvents, { label: 'Follow live chat events' }))}
          ${row('Explain removed messages', 'Kick’s automatic moderation removes messages without saying why. The realtime event carries the reason; the page does not.', toggle('content.showModerationReasons', value.showModerationReasons, { label: 'Explain removed messages' }))}
          ${row('Show badges Kick leaves out', 'Kick’s chat payload carries collectible and global badges its own markup omits, leaving a gap where other clients show a badge. A badge image that fails to load is replaced by its name.', toggle('content.showChatBadges', value.showChatBadges, { label: 'Show badges Kick leaves out' }))}
          ${row('Count emote usage', 'Kick’s own “Frequently Used” never counts anything, so no real ranking exists. This one is yours, stored locally and exported with your library.', toggle('content.countEmoteUsage', value.countEmoteUsage, { label: 'Count emote usage' }))}
          ${row('Show collectible rarity', 'Kick publishes rarity on card art and identity in the picker, with no key joining them. Rarity is shown only where the match is confident.', toggle('content.showEmoteRarity', value.showEmoteRarity, { label: 'Show collectible rarity' }))}
          ${row('Warn about shadowed emote names', 'Subscriber emotes work in every chat and Kick resolves typed names through one map, so two channels sharing a name means one silently sends the other’s.', toggle('content.warnShadowedEmotes', value.warnShadowedEmotes, { label: 'Warn about shadowed emote names' }))}
          ${row('Freeze animated emotes', 'Render animated emotes and collectibles as a single static frame, in chat and in the picker. Applied automatically when your system asks for reduced motion.', toggle('content.staticEmotes', value.staticEmotes, { label: 'Freeze animated emotes' }))}
        </div>
        ${renderCollectiblePanel()}
        ${rarity ? `<div class="kf-panel"><div class="kf-action-row"><div><h3>Collectible rarity</h3><p>Resolved ${rarity.matched.length} of ${rarity.total} collectible emotes. ${rarity.unmatched.length ? `${rarity.unmatched.length} could not be matched confidently and are shown without a rarity — a wrong label is worse than none.` : 'Every collectible in this channel was matched.'}</p></div></div></div>` : ''}
        ${collisions.length ? `<div class="kf-panel"><div class="kf-action-row"><div class="kf-shadow-warning"><h3>Shadowed emote names</h3><p>These names exist in more than one of your sets. Kick sends the last one loaded, so typing the name may not send what you expect.</p>${collisions.slice(0, 12).map((collision) => `<p><code>${escapeHtml(collision.name)}</code> — sends <strong>${escapeHtml(collision.winner.setName)}</strong>, shadowing ${escapeHtml(collision.shadowed.map((entry) => entry.setName).join(', '))}</p>`).join('')}${collisions.length > 12 ? `<p>…and ${collisions.length - 12} more.</p>` : ''}</div></div></div>` : ''}
      </section>`;
  }


  function renderContentPage() {
    const value = state.settings.content;
    const companion = companionInfo();
    return `
      ${pageHeader('Content & Ads', 'Keep the page calm, private, and focused on streams.', 'Protection', companion.active ? 'Network + page' : 'Page only')}
      <div class="kf-defense-overview">
        <section class="kf-status-card"><div><h3>Ad defense active</h3><p>${companion.active
          ? `Browser network ruleset plus page hooks and shell cleanup. Companion extension v${escapeHtml(companion.version)}.`
          : 'Document-start page hooks and persistent shell cleanup. Install the companion extension for browser-level blocking.'}</p></div><div class="kf-active">${companion.active ? 'Network + page' : 'Page only'}</div></section>
        <div class="kf-stats"><div class="kf-stat"><span>Blocked this page</span><strong data-kf-stat="blocked">${state.diagnostics.blocked}</strong></div><div class="kf-stat"><span>Removed shells</span><strong data-kf-stat="shells">${state.diagnostics.shells}</strong></div><div class="kf-stat"><span>Last match</span><strong data-kf-stat="last">${escapeHtml(state.diagnostics.lastMatch)}</strong></div></div>
      </div>
      <div class="kf-status-note" data-kf-adstack data-drifted="${assessAdStack(state.adStack).drifted}">${escapeHtml(assessAdStack(state.adStack).summary)}</div>
      <div class="kf-notice" data-kf-filter-notice ${state.filter.suspended ? '' : 'hidden'}>${state.filter.suspended
        ? `Filtering is suspended on this page. It would have hidden ${state.filter.wouldHide} of ${state.filter.total} cards, which usually means Kick changed its labels rather than that the page is really that promotional. Everything is shown.`
        : ''}</div>
      <section class="kf-subsection kf-content-section"><div class="kf-subsection-header"><div><h3>Filtering & ad defense</h3><p>Requests, promotional modules, and sensitive content.</p></div></div><div class="kf-panel">
          ${row('Block separable ad requests', 'Intercept known ad hosts at the earliest userscript-supported page layer.', toggle('content.blockAds', true, { locked: true, label: 'Core ad protection is on' }), { locked: true })}
          ${row('Remove ad containers', 'Remove empty ad containers and reinjected ad frames.', toggle('content.removeAdContainers', value.removeAdContainers, { label: 'Remove ad containers' }))}
          ${row('Suppress sponsored and promoted cards', 'Hide clearly labeled promotional cards and modules.', toggle('content.suppressPromoted', value.suppressPromoted, { label: 'Suppress promoted cards' }))}
          ${row('Pause home-page autoplay', 'Keep background Home previews silent and paused; deliberate playback remains available.', toggle('content.pauseHomeAutoplay', value.pauseHomeAutoplay, { label: 'Pause home-page autoplay' }))}
          ${row('Hide Slots & Casino content', 'Hide cards and sidebar entries clearly labeled as casino content.', toggle('content.hideCasino', value.hideCasino, { label: 'Hide Slots and Casino content' }))}
          ${row('Blur mature thumbnails', 'Blur marked mature cards until hover or keyboard focus.', toggle('content.blurMature', value.blurMature, { label: 'Blur mature thumbnails' }))}
          ${row('Hide Drops and gambling promotions', 'Hide clearly labeled Drops and gambling promotion modules.', toggle('content.hideDropsPromotions', value.hideDropsPromotions, { label: 'Hide Drops and gambling promotions' }))}
          ${row('Poor mode', 'Hide Subscribe, Gift Subs/Dubs, Get KICKs, gift-shop controls, and spend-based leaderboards. Follow, chat, and free daily rewards stay available.', toggle('content.hideMonetization', value.hideMonetization, { label: 'Poor mode' }))}
          ${row('Reduce tracking telemetry', 'Block observed third-party video and error telemetry hosts.', toggle('content.reduceTelemetry', value.reduceTelemetry, { label: 'Reduce tracking telemetry' }))}
        </div>
      </section>
      <section class="kf-subsection kf-content-section"><div class="kf-subsection-header"><div><h3>Hidden channels</h3><p>Hide specific channels from Home, Browse, Following, and Search.</p></div></div><div class="kf-panel">
        <div class="kf-action-row"><div>
          <label class="kf-sr-only" for="kf-hidden-channel-input">Channel to hide</label>
          <div class="kf-channel-input-row">
            <input type="text" id="kf-hidden-channel-input" class="kf-text-input" placeholder="Channel name or kick.com URL" aria-label="Channel to hide" data-kf-hidden-channel-input>
            <button type="button" class="kf-button kf-button-small" data-action="add-hidden-channel">Hide</button>
          </div>
        </div></div>
        ${value.hiddenChannels.length ? `<div class="kf-channel-list" data-kf-hidden-channel-list>${value.hiddenChannels.map((channel) => `<div class="kf-channel-entry"><span>${escapeHtml(channel.replace(/^\//, ''))}</span><button type="button" class="kf-button kf-button-small kf-danger" data-action="remove-hidden-channel" data-channel="${escapeHtml(channel)}" aria-label="Show ${escapeHtml(channel.replace(/^\//, ''))} again">✕</button></div>`).join('')}</div>` : '<p class="kf-status-note">No channels hidden. Use the input above or the ✕ action on a card.</p>'}
        <p class="kf-meta">${value.hiddenChannels.length} ${plural(value.hiddenChannels.length, 'channel hidden. These count toward the fail-open ceiling.', 'channels hidden. These count toward the fail-open ceiling.')}</p>
      </div></section>
      <section class="kf-subsection kf-content-section"><div class="kf-subsection-header"><div><h3>Playback & chat</h3><p>Local playback memory, chat control, emotes, and diagnostics.</p></div></div><div class="kf-panel">
          ${row('Remember volume locally', 'Restore each channel’s volume and mute state from local storage.', toggle('content.rememberVolume', value.rememberVolume, { label: 'Remember volume locally' }))}
          ${row('Remember quality locally', 'Restore a matching quality control when Kick exposes one.', toggle('content.rememberQuality', value.rememberQuality, { label: 'Remember quality locally' }))}
          ${row('Always start at the highest quality', 'Open every stream at the best rung Kick offers, taking precedence over remembered quality. The rungs are learned from Kick’s own quality menu, so this does nothing until that menu has been opened once — it will not open it for you.', toggle('content.preferBestQuality', value.preferBestQuality, { label: 'Always start at the highest quality' }))}
          ${row('Remember VOD position locally', 'Resume finite VODs from the last local playback position.', toggle('content.rememberVodPosition', value.rememberVodPosition, { label: 'Remember VOD position locally' }))}
          ${row('Show how long the stream has been live', 'Kick sends the start time with every channel and shows it nowhere. This reads that field and counts from it in the player corner — no extra request and no polling.', toggle('content.showUptime', value.showUptime, { label: 'Show stream uptime' }))}
          ${row('Show how long Kick keeps this recording', 'Kick deletes recordings after 7 days, or 30 for a verified channel, and shows that deadline nowhere. On a VOD page this reads the recording date from Kick’s own video list and counts down to it. It says nothing at all when the recording is older than the list Kick returns, or when the tier cannot be established — a guess between 7 and 30 days would be a confident wrong date.', toggle('content.showVodExpiry', value.showVodExpiry, { label: 'Show VOD expiry' }))}
          ${row('Pause chat updates', 'Scrolling the transcript up freezes it, as does the button. Resume is always one control away.', toggle('content.stickyChatPause', value.stickyChatPause, { label: 'Pause chat updates' }))}
          ${row('Show message times', 'Reveals the timestamp Kick already renders on every message and keeps hidden. It is Kick’s own value, so scrolling back shows when a message was sent rather than when this build first saw it.', toggle('content.chatTimestamps', value.chatTimestamps, { label: 'Show message times' }))}
          ${row('People worth noticing', 'Names you want to catch in a fast chat. Their messages get a marker of their own, separate from keyword highlights. Comma separated, and stored only in your settings.', `<input class="kf-text" type="text" data-set="content.chatPriorityPeople" value="${escapeHtml((value.chatPriorityPeople || []).join(', '))}" placeholder="name, name" aria-label="People worth noticing">`)}
          ${row('Sound on a mention', 'A short tone when a message matches your highlights, comes from someone you listed, or says your name. Synthesised in the browser, so nothing is downloaded. Silent while the tab is in the background, silent for your own messages, and never more than once every few seconds.', toggle('content.chatMentionSound', value.chatMentionSound, { label: 'Sound on a mention' }))}
          ${row('Hide a message for yourself', 'Adds a small dismiss control to each message. It hides that message in your own browser for this session only, changes nothing for anyone else, and offers an undo.', toggle('content.chatHideMessages', value.chatHideMessages, { label: 'Hide a message for yourself' }))}
          ${row('Recall my sent messages', 'Keep the last five messages sent from this tab in memory. Shift+Up cycles them. Whispers are skipped, reload clears them, and ordinary Arrow Up stays with Kick.', toggle('content.chatComposerRecall', value.chatComposerRecall, { label: 'Recall my sent messages' }))}
          ${row('Search this session’s chat', 'Keeps what this tab has seen so you can find it again. It stays in memory, never reaches storage, and is gone on reload. Whispers are never recorded, and a message a moderator removes leaves the log the moment the deletion arrives.', toggle('content.chatHistory', value.chatHistory, { label: 'Search this session’s chat' }))}
          ${value.chatHistory ? `<div class="kf-row kf-row-wide" data-kf-chat-history>
            <div><h3>Session chat log</h3><p>${state.chatComfort.rows.length} ${plural(state.chatComfort.rows.length, 'message held. Capped at 400 messages, 200 KB, and one hour.', 'messages held. Capped at 400 messages, 200 KB, and one hour.')}</p></div>
            <div class="kf-chat-log">
              <input class="kf-text" type="search" data-kf-chat-history-search value="${escapeHtml(state.chatComfort.query)}" placeholder="Search what you have seen" aria-label="Search this session’s chat">
              <div class="kf-button-group"><button type="button" class="kf-button kf-button-small" data-action="export-chat-history">Save as a file</button><button type="button" class="kf-button kf-button-small kf-danger" data-action="clear-chat-history">Clear the log</button></div>
              <div data-kf-chat-history-results></div>
            </div>
          </div>` : ''}
          ${row('Organize chat emotes', 'Continuously record emotes from live chat and Kick’s picker, then add favorites, removals, search, and custom groups.', toggle('content.organizeChatStickers', value.organizeChatStickers, { label: 'Organize chat emotes' }))}
          ${row('Click chat emotes to save', 'Click any emote in chat to add it to your favorites. If Kick explicitly marks it as follow-gated, the same click follows its source channel; subscriber access is never bypassed.', toggle('content.clickChatEmotes', value.clickChatEmotes, { label: 'Click chat emotes to save' }))}
          ${row('Type an emote name into chat', 'Adds a Type in chat action beside Copy name in the emote library. It types the plain name at your cursor and stops — never the wire token, never an id, and it never sends the message.', toggle('content.insertEmoteName', value.insertEmoteName, { label: 'Type an emote name into chat' }))}
          ${row('Suggest emotes as you type', 'Typing a colon and two or more letters in chat offers matching emotes from your library, ranked by what you actually send here. Click one to put its plain name at your cursor. Suggestions are clicked, never accepted with a key, so nothing you type is ever captured — and it never sends the message.', toggle('content.emoteAutocomplete', value.emoteAutocomplete, { label: 'Suggest emotes as you type' }))}
          ${row('Claim the daily reward automatically', 'Opens Kick’s own reward dialog when one is waiting and clicks its claim button for you. It clicks nothing else: a reward Kick has not unlocked yet shows a disabled button, and this leaves it alone rather than trying. It waits until you are not typing, checks at most every ten minutes, and stops for the day once it claims. Signed-in only — the reward button does not exist otherwise.', toggle('content.autoClaimRewards', value.autoClaimRewards, { label: 'Claim the daily reward automatically' }))}
          <p class="kf-hint" data-kf-reward-status>${escapeHtml(rewardStatusSummary())}</p>
          ${row('New favorites apply to', 'Global favorites follow you everywhere. Per-channel favorites appear only on the channel you saved them from, above your global ones. Existing favorites are global and are not moved.', segmented('content.favoriteScope', value.favoriteScope, [['global', 'Everywhere'], ['channel', 'This channel']]))}
          ${row('Highlight chat keywords', 'Use the per-channel keyword list below without sending it anywhere.', toggle('content.chatHighlights', value.chatHighlights, { label: 'Highlight chat keywords' }))}
          ${row('Show playback diagnostics', 'Show ready state, buffered seconds, and dropped-frame counts on a channel.', toggle('content.playbackDiagnostics', value.playbackDiagnostics, { label: 'Show playback diagnostics' }))}
          ${row('Start playback without waiting for blocked ad scripts', 'Kick waits on Google PAL, Datazoom, and OM before requesting playback. Blocking them — which this build does — leaves the dead script in the page and the player waits out the full timeout. Removing it lets playback start immediately.', toggle('content.fixPlayerLoading', value.fixPlayerLoading, { label: 'Start playback without waiting for blocked ad scripts' }))}
        </div>
      </section>
      ${renderLiveDataSection(value)}
      <div class="kf-tool-grid">
        <section class="kf-tool-card"><div><h3>Emote library</h3><p data-kf-sticker-library-summary>${escapeHtml(stickerLibrarySummary())}</p></div><button type="button" class="kf-button kf-button-small" data-action="export">Export library</button></section>
        <section class="kf-tool-card"><div><h3>Local discovery choices</h3><p>Favorites and not-interested choices stay on this device.</p></div><div class="kf-button-group"><button type="button" class="kf-button kf-button-small" data-action="clear-favorites">Clear favorites</button><button type="button" class="kf-button kf-button-small" data-action="clear-dismissed">Clear hidden</button></div></section>
      </div>
      ${renderStickerLibraryManager()}
      <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Local channel tools</h3><p>Channel keywords and private notes stay on this device.</p></div></div>${localChannelTools()}</section>
      ${remoteBlocklistControls()}
      <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Protection log</h3><p>Sanitized in-memory diagnostics; query strings are never retained.</p></div></div><div class="kf-panel"><table class="kf-table"><thead><tr><th>Time</th><th>Layer</th><th>Match</th><th>Action</th></tr></thead><tbody data-kf-protection-log>${protectionRows()}</tbody></table></div></section>
      <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Error log</h3><p data-kf-last-crash>${escapeHtml(lastCrashSummary())}</p></div><button type="button" class="kf-button kf-button-small" data-action="copy-error-log">Copy error log</button></div><div class="kf-panel"><table class="kf-table"><thead><tr><th>Time</th><th>Where</th><th>Message</th></tr></thead><tbody data-kf-error-log>${errorLogRows()}</tbody></table></div></section>
      <div class="kf-notice">${companion.active
        ? 'The companion extension blocks known ad hosts at the browser network layer. Server-side stitched media is still delivered inside the stream itself.'
        : 'Userscript interception is best-effort and can be bypassed by browser or server-side delivery. Browser-level request guarantees require an extension ruleset.'}</div>`;
  }


  function renderAccessibilityPage() {
    const value = state.settings.accessibility;
    const shortcuts = state.settings.shortcuts;
    const rows = [
      ['command','Open command menu'],['focus','Toggle focus mode'],['chat','Toggle chat'],
      ['sidebar','Toggle sidebar'],['settings','Open settings'],['mature','Reveal mature thumbnails'],
    ];
    return `
      ${pageHeader('Accessibility & Shortcuts', 'Improve comfort and keep core actions within reach.', 'Text scale', `${value.textSize}%`)}
      <section class="kf-panel">
        ${row('Reduce motion', 'Minimize non-essential animations and transitions.', toggle('accessibility.reduceMotion', value.reduceMotion, { label: 'Reduce motion' }))}
        ${row('High-contrast controls', 'Increase separation for controls, borders, and surfaces.', toggle('accessibility.highContrast', value.highContrast, { label: 'High-contrast controls' }))}
        ${row('Always show keyboard focus', 'Keep a strong outline for keyboard navigation.', toggle('accessibility.focusVisible', value.focusVisible, { label: 'Always show keyboard focus' }))}
        ${row('Larger pointer targets', 'Increase the minimum height of interactive controls.', toggle('accessibility.largeTargets', value.largeTargets, { label: 'Larger pointer targets' }))}
        ${row('Announce layout changes', 'Report view changes to assistive technology.', toggle('accessibility.announceChanges', value.announceChanges, { label: 'Announce layout changes' }))}
        ${row('Text size', 'Scale text in the main Kick content area.', segmented('accessibility.textSize', value.textSize, [[90,'90%'],[100,'100%'],[110,'110%'],[120,'120%']]))}
        ${row('Caption background opacity', 'Set the preferred caption background strength.', range('accessibility.captionOpacity', value.captionOpacity, 0, 100, '0%', '100%', '%'), { wide: true })}
      </section>
      <section class="kf-subsection"><div class="kf-subsection-header"><div><h3>Keyboard shortcuts</h3><p>Choose memorable shortcuts that do not conflict.</p></div><button type="button" class="kf-button kf-button-small" data-action="restore-shortcuts">Restore defaults</button></div>
        <div class="kf-panel"><table class="kf-table"><thead><tr><th>Action</th><th>Current shortcut</th><th>Status</th><th class="kf-table-actions">Change</th></tr></thead><tbody>${rows.map(([key,label]) => {
          const conflict = state.shortcutError && state.shortcutCapture === key;
          const capture = state.shortcutCapture === key && !state.shortcutError;
          return `<tr class="${conflict ? 'kf-conflict' : ''}"><td>${label}</td><td><span class="kf-shortcut">${capture ? 'Press keys…' : escapeHtml(shortcuts[key])}</span></td><td>${conflict ? `<span class="kf-conflict-message">${escapeHtml(state.shortcutError)}</span>` : capture ? 'Listening' : '<span class="kf-active">OK</span>'}</td><td class="kf-table-actions">${conflict ? '<button type="button" class="kf-button kf-button-small" data-action="cancel-shortcut">Cancel</button>' : `<button type="button" class="kf-button kf-button-small" data-shortcut="${key}">${capture ? 'Cancel' : 'Change'}</button>`}</td></tr>`;
        }).join('')}</tbody></table></div>
      </section>`;
  }

  /**
   * Report what this build is actually storing, and anything it failed to store.
   *
   * The emote library is by far the largest payload and the one most likely to hit
   * a quota, so its size is worth showing before the write starts failing.
   */

  function renderStorageHealthPanel() {
    const report = storageDiagnostics();
    const failures = describeStorageFailures(storageHealth.failures);
    const failureMessage = failures ? localizedStorageFailure(failures) : '';
    const rows = report.breakdown
      .filter((entry) => entry.bytes > 0)
      .map((entry) => `<tr><th>${escapeHtml(entry.label)}</th><td>${escapeHtml(formatBytes(entry.bytes))}</td><td>${storageHealth.failures[entry.key] ? '<strong data-error="true">Not saving</strong>' : 'Saved'}</td></tr>`)
      .join('');
    return `
      <section class="kf-subsection">
        <div class="kf-panel">
          <div class="kf-action-row"><div><h3>Local storage</h3><p>${failures
            ? `${escapeHtml(failureMessage)}${storageHealth.lastError ? ` ${escapeHtml(tr('The browser reported'))} <strong>${escapeHtml(storageHealth.lastError)}</strong>.` : ''} ${escapeHtml(tr('Exporting now is the only way to keep these changes.'))}`
            : `Kick Focus is using about ${escapeHtml(formatBytes(report.total))} of browser storage. Nothing has failed to save this session.`}</p></div>${failures ? '<button type="button" class="kf-button kf-button-primary" data-action="export">Export now</button>' : ''}</div>
          ${rows ? `<table class="kf-table"><tbody>${rows}</tbody></table>` : ''}
        </div>
      </section>`;
  }

  // ---------------------------------------------------------------------------
  // Viewer hub
  //
  // Reads what Kick is already showing this account and shows it in one place.
  // It writes nothing, claims nothing, and adds no endpoint: five of the six
  // values come off the page, and the sixth is the collectible read this build
  // already makes.
  //
  // Nothing here runs while the hub is closed. The facts are gathered when the
  // page is opened and again on the apply cycle only while it is the page being
  // looked at, which is the difference between a summary and a background poller.
  // ---------------------------------------------------------------------------

  // From a signed-in capture: Kick renders the exact figure in a `title` and an
  // abbreviated one ("1.2K") in the text, so the attribute is read first.

  function hubNumber(value) {
    return Number(value).toLocaleString();
  }


  function hubCardValue(card) {
    if (card.id === 'reward') return tr(VIEWER_HUB_REWARD_WORDS[card.value] || VIEWER_HUB_REWARD_WORDS.available);
    // Distinct collectibles first, total copies in brackets, and only when the
    // two differ — "21 (21)" says nothing that "21" does not.
    if (card.id === 'collectibles' && Number.isFinite(card.copies) && card.copies > card.value) {
      return `${hubNumber(card.value)} (${hubNumber(card.copies)})`;
    }
    return hubNumber(card.value);
  }

  /** The line under each value: where it came from, and how old the reading is. */

  function hubCardSource(card, now) {
    if (card.state !== 'ready') return '';
    const source = card.source === 'api' ? tr('From Kick’s API') : tr('Read from the page');
    if (!card.stale) return source;
    const minutes = Math.max(1, Math.round((now - card.observedAt) / 60_000));
    return `${source} · ${trf('{n} min ago', { n: minutes })}`;
  }


  function renderViewerHubCards() {
    const now = Date.now();
    const cards = viewerHubCards(collectViewerFacts(), now);
    return cards.map((card) => `
      <div class="kf-mini-card kf-hub-card" data-kf-hub-card="${card.id}" data-state="${card.state}">
        <span>${escapeHtml(tr(VIEWER_HUB_TITLES[card.id]))}</span>
        <strong>${card.state === 'ready' ? escapeHtml(hubCardValue(card)) : escapeHtml(tr(card.state === 'loading' ? 'Reading…' : '—'))}</strong>
        <em>${escapeHtml(card.state === 'ready' ? hubCardSource(card, now) : tr(VIEWER_HUB_REASONS[card.reason] || VIEWER_HUB_REASONS['not-read']))}</em>
      </div>`).join('');
  }

  /** Repaint the cards without rebuilding the page, so scroll and focus survive. */

  function renderViewerPage() {
    const summary = viewerHubSummary(viewerHubCards(collectViewerFacts(), Date.now()));
    return `
      ${pageHeader('Viewer', 'What Kick already tells this account, in one place. Nothing here is changed, claimed, or sent anywhere.', 'Reading', `${summary.ready}/${summary.total}`)}
      <div class="kf-hub-grid" data-kf-hub-cards>${renderViewerHubCards()}</div>
      <section class="kf-panel">
        <div class="kf-action-row"><div><h3>Where these come from</h3><p data-kf-hub-sources>${escapeHtml(hubSourceSummary(summary))}</p></div><button type="button" class="kf-button" data-action="refresh-hub">Read again</button></div>
        <div class="kf-action-row"><div><h3>Nothing is claimed for you here</h3><p>This page reads. The daily reward is still claimed by Kick’s own dialog, and only when you have turned that on under Content &amp; Ads. A card with no reading says so rather than showing a zero, because an empty balance and an unreadable one are not the same thing.</p></div></div>
      </section>`;
  }

  /** One sentence naming which values were read off the page and which came from an endpoint. */

  function hubSourceSummary(summary) {
    if (!summary.ready) return 'Nothing has been read yet. Each card above says why.';
    const parts = [];
    const list = (ids) => new Intl.ListFormat(activeLocale(), { style: 'long', type: 'conjunction' })
      .format(ids.map((id) => tr(VIEWER_HUB_TITLES[id])));
    if (summary.fromDom.length) parts.push(trf('{items} read from the page', { items: list(summary.fromDom) }));
    if (summary.fromApi.length) parts.push(trf('{items} from Kick’s API', { items: list(summary.fromApi) }));
    const stale = summary.stale ? ` ${trf('{n} showing an older reading.', { n: summary.stale })}` : '';
    const errors = summary.errors ? ` ${trf('{n} could not be built.', { n: summary.errors })}` : '';
    return `${parts.join('; ')}.${stale}${errors}`;
  }


  function renderAboutPage() {
    return `
      ${pageHeader('About', 'A desktop-first layout and control layer for Kick.', 'Version', VERSION)}
      <div class="kf-about-status"><div class="kf-mini-card"><span>Script health</span><strong>Active</strong></div><div class="kf-mini-card"><span>Site compatibility</span><strong data-kf-compatibility data-error="${String(Boolean(state.compatibility && !state.compatibility.healthy))}">${state.compatibility ? (state.compatibility.healthy ? 'Healthy' : 'Needs attention') : 'Checking…'}</strong></div><div class="kf-mini-card"><span>Protection layer</span><strong>${companionInfo().active ? 'Network + page' : 'Page only'}</strong></div></div>
      <section class="kf-panel">
        <div class="kf-action-row"><div><h3>Data & privacy</h3><p>Settings stay in your userscript manager. No analytics. No remote code.</p></div></div>
        ${companionInfo().active || INJECTION.grade === 'first' ? '' : `<div class="kf-action-row"><div><h3>Not running as early as it could</h3><p>This started ${escapeHtml(INJECTION.summary)}. On Chromium 138 and later a userscript manager needs its own <strong>Allow user scripts</strong> toggle enabled on the browser's extensions page, and its instant-injection mode turned on. Installing the companion extension removes the question entirely.</p></div></div>`}
        <div class="kf-action-row"><div><h3>Multi-stream</h3><p>Watch up to ${MULTISTREAM_MAX} Kick channels in one grid, with audio and chat following whichever you focus. Uses Kick’s own embedded player, so subscriptions and entitlements are unchanged.${state.multistream.streams.length ? ` Currently holding ${state.multistream.streams.length}.` : ''}</p></div><button type="button" class="kf-button" data-action="open-multistream">Open multi-stream</button></div>
        <div class="kf-action-row"><div><h3>Panic switch</h3><p>Temporarily restore Kick’s native layout and pause Kick Focus hooks without reloading. Restore it from the Focus button or with Ctrl+Shift+F.</p></div><button type="button" class="kf-button kf-danger" data-action="toggle-panic">${state.runtime.suspended ? 'Restore Kick Focus' : 'Pause Kick Focus'}</button></div>
        <div class="kf-action-row"><div><h3>If Kick sign-in, sign-up, or Follow stops working</h3><p>Since Kick began serving ads on 2026-08-06, some ad-blocker filter lists have been reported to break those actions, which fail with a generic error until the blocker is disabled and the browser restarted. Kick Focus is not involved: it blocks ${AD_HOSTS.length + TELEMETRY_HOSTS.length} third-party ad and telemetry hosts and <strong>no kick.com host at all</strong>, so pausing Kick Focus will not change that behaviour. Check your ad blocker&rsquo;s filters for kick.com before blaming an extension.</p></div></div>
        <div class="kf-action-row"><div><h3>Diagnostics</h3><p>Copy a sanitized summary or run a local self-check.</p></div><div class="kf-button-group"><button type="button" class="kf-button" data-action="copy-diagnostics">Copy diagnostic summary</button><button type="button" class="kf-button" data-action="self-check">Run self-check</button></div></div>
        <div class="kf-action-row"><div><h3>Compatibility self-test</h3><p data-kf-compatibility-detail>${escapeHtml(state.compatibility ? `${compatibilitySummary(state.compatibility)} Probes are checked after every route update.` : 'The shell probes will run after the page mounts.')}</p></div><button type="button" class="kf-button" data-action="self-check">Run now</button></div>
        <div class="kf-action-row"><div><h3>API drift</h3><p data-kf-api-drift>${escapeHtml(assessApiDrift(state.live.apiDrift).summary)}</p></div></div>
        ${state.updateNotice ? `<div class="kf-action-row"><div><h3>What changed in ${escapeHtml(state.updateNotice.to)}</h3><p>${escapeHtml(state.updateNotice.summary || `Updated from ${state.updateNotice.from}.`)}${state.updateNotice.defaults.length ? ` Defaults that moved: ${escapeHtml(state.updateNotice.defaults.join(', '))}.` : ''}</p></div></div>` : ''}
        <div class="kf-action-row"><div><h3>Apply cycle cost</h3><p data-kf-apply-cost data-kf-no-translate>${escapeHtml(tr(applyCostSummary(state.diagnostics.apply)))}</p></div></div>
        <div class="kf-action-row"><div><h3>Settings portability</h3><p>Move preferences, recorded emote metadata, favorites, removals, and custom groups using one local JSON file.</p></div><div class="kf-button-group">${gmGet(PRE_IMPORT_BACKUP_KEY, null) ? `<button type="button" class="kf-button" data-action="undo-import">Undo import</button>` : ''}<button type="button" class="kf-button" data-action="import">Import settings</button><button type="button" class="kf-button" data-action="export">Export settings</button></div></div>
        <div class="kf-action-row"><div><h3>Reset all settings</h3><p>Restore every setting, shortcut, note, filter, and channel list to factory defaults. Your recorded emote library is kept.</p></div><button type="button" class="kf-button kf-danger" data-action="reset-all">Reset all settings</button></div>
      </section>
      ${renderStorageHealthPanel()}
      <section class="kf-subsection"><div class="kf-panel"><table class="kf-table"><tbody><tr><th>Target</th><td>kick.com desktop</td><th>Run timing</th><td>${escapeHtml(INJECTION.summary)}</td></tr><tr><th>Keyboard</th><td>Ctrl+K commands · Alt+K settings</td><th>Test viewports</th><td>1440×900 · 1920×1080</td></tr><tr><th>Version</th><td>${VERSION}</td><th>Remote code</th><td>None</td></tr><tr><th>Userscript size</th><td data-kf-no-translate>${BUNDLE_BYTES ? `${BUNDLE_BYTES.toLocaleString('en-US')} / ${BUNDLE_BYTE_CEILING.toLocaleString('en-US')} bytes` : '—'}</td><th>Injection ceiling</th><td data-kf-no-translate>${BUNDLE_BYTES ? `${Math.round((BUNDLE_BYTES / BUNDLE_BYTE_CEILING) * 100)}%` : '—'}</td></tr></tbody></table></div></section>`;
  }

  // A stable selector for the focused control, so focus can be restored to the
  // equivalent element after the page's innerHTML is replaced.

  function focusRestoreKey(element) {
    return settingsFocusSelector(element);
  }

  /**
   * Every setting this build renders, as searchable rows.
   *
   * Built by rendering each page into a detached node and reading the real DOM
   * rather than pattern-matching the markup strings — a regex over generated HTML
   * would rot the first time a row gained a wrapper.
   *
   * Each row is indexed under both its English source *and* its translation, which
   * is FrankerFaceZ's trick and the reason its search still works in a localized
   * interface: this build assembles markup in English and translates it afterwards,
   * so an index built from the markup alone would never match what a Spanish or
   * Portuguese user is actually reading.
   *
   * Cached until something invalidates it, because rendering five pages on every
   * keystroke would be the most expensive thing this panel does.
   */

  function settingsSearchIndex() {
    if (state.settingsIndex) return state.settingsIndex;
    const scratch = document.createElement('div');
    const renderers = {
      layout: renderLayoutPage,
      appearance: renderAppearancePage,
      content: renderContentPage,
      accessibility: renderAccessibilityPage,
      viewer: renderViewerPage,
      about: renderAboutPage,
    };
    const index = [];
    for (const [id, pageTitle] of NAV_ITEMS) {
      const renderer = renderers[id];
      if (!renderer) continue;
      try {
        setMarkup(scratch, renderer());
      } catch {
        // A page that cannot render is a bug worth seeing on the page itself, not
        // one worth taking the whole search down with.
        continue;
      }
      for (const row of scratch.querySelectorAll('.kf-row, .kf-action-row, .kf-subsection-header')) {
        const title = row.querySelector('h3')?.textContent?.trim() || '';
        if (!title) continue;
        const description = row.querySelector('p')?.textContent?.trim() || '';
        index.push({
          page: id,
          pageTitle,
          title,
          description,
          terms: [title, description, tr(title), tr(description)].join('\n'),
        });
      }
    }
    state.settingsIndex = index;
    return index;
  }

  /** Results for a query, grouped under the page each setting lives on. */

  function renderSettingsSearchResults(query) {
    const matches = rankSettingsMatches(query, settingsSearchIndex());
    const header = pageHeader('Search', 'Every page, searched at once.', 'Matches', String(matches.length));
    if (!matches.length) {
      return `${header}<section class="kf-panel kf-search-empty"><p>${escapeHtml(trf('Nothing matches “{query}”.', { query }))}</p><p>${escapeHtml(tr('Try a shorter word, or the name of the Kick control you are looking for.'))}</p></section>`;
    }
    return `${header}<section class="kf-panel kf-search-results">${matches.map((match) => `
      <button type="button" class="kf-search-result" data-kf-search-goto="${escapeHtml(match.page)}">
        <span class="kf-search-result-copy"><strong>${escapeHtml(match.title)}</strong>${match.description ? `<small>${escapeHtml(match.description)}</small>` : ''}</span>
        <span class="kf-search-result-page">${escapeHtml(match.pageTitle)}</span>
      </button>`).join('')}</section>`;
  }


  function renderSettingsPage() {
    if (!state.shadow) return;
    const page = state.shadow.querySelector('[data-kf-page]');
    const previousPage = page.dataset.kfCurrentPage;
    // Preserve focus and scroll across the innerHTML replacement, or a keyboard
    // user toggling a setting deep in a page is thrown back to the top on every
    // change and loses their place entirely.
    const active = state.shadow.activeElement;
    const focusKey = active && page.contains(active) ? focusRestoreKey(active) : '';
    const scrollTop = page.scrollTop;
    // A query replaces the page body with results from every page, so the
    // renderer below is skipped entirely while searching.
    if (state.settingsQuery) {
      setMarkup(page, renderSettingsSearchResults(state.settingsQuery));
      page.dataset.kfCurrentPage = 'search';
      page.scrollTop = 0;
      localizeInterface();
      return;
    }
    const renderer = {
      layout: renderLayoutPage,
      appearance: renderAppearancePage,
      content: renderContentPage,
      accessibility: renderAccessibilityPage,
      viewer: renderViewerPage,
      about: renderAboutPage,
    }[state.currentPage] || renderLayoutPage;
    setMarkup(page, renderer());
    page.dataset.kfCurrentPage = state.currentPage;
    page.querySelector('[data-action="import-channel-emotes"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      startChannelEmoteImport();
    });
    state.shadow.querySelector('[data-kf-settings-shell]').dataset.kfCurrentPage = state.currentPage;
    if (previousPage && previousPage !== state.currentPage) {
      page.scrollTop = 0;
    } else {
      page.scrollTop = scrollTop;
      if (focusKey) {
        const restore = page.querySelector(focusKey);
        if (restore) restore.focus({ preventScroll: true });
      }
    }
    for (const button of state.shadow.querySelectorAll('[data-page]')) {
      // While results are showing, no page is the current one.
      button.setAttribute('aria-current', !state.settingsQuery && button.dataset.page === state.currentPage ? 'page' : 'false');
    }
    state.shadow.querySelector(`[data-page="${state.currentPage}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const reset = state.shadow.querySelector('[data-action="reset-page"]');
    reset.disabled = state.currentPage === 'about';
    reset.title = tr(reset.disabled ? 'About has no page settings to reset' : 'Restore page defaults');
    localizeInterface();
    if (state.currentPage === 'content') {
      applyStickerLibrarySearch();
      renderChatHistoryResults();
    }
    // One read, on opening. Nothing is requested while the hub is closed.
    if (state.currentPage === 'viewer') refreshViewerCollectibles();
  }


  return {
    NAV_ITEMS,
    uiIcon,
    stickerLibrarySummary,
    renderViewerHubCards,
    renderSettingsPage,
  };
}
