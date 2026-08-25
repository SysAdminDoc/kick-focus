/**
 * Popup.
 *
 * The page-world script owns the settings file. The popup never writes settings
 * directly, because two writers on one key diverge the moment both are used in
 * the same session. It asks the page to change the setting and re-reads the
 * result, so Kick Focus's own settings page stays the single source of truth.
 */

const els = {
  version: document.getElementById('version'),
  networkState: document.getElementById('network-state'),
  title: document.getElementById('network-title'),
  detail: document.getElementById('network-detail'),
  blocked: document.getElementById('blocked'),
  rulesets: document.getElementById('rulesets'),
  telemetry: document.getElementById('telemetry'),
  blocklistState: document.getElementById('blocklist-state'),
  blocklistUrl: document.getElementById('blocklist-url'),
  approveBlocklist: document.getElementById('approve-blocklist'),
  revokeBlocklist: document.getElementById('revoke-blocklist'),
  openSettings: document.getElementById('open-settings'),
  note: document.getElementById('note'),
};

const KICK_HOST = /^https:\/\/(www\.)?kick\.com\//;
const ACCENTS = Object.freeze({
  kick: ['#7cff2b', '124, 255, 43'],
  cyan: ['#38d7d0', '56, 215, 208'],
  violet: ['#9667ff', '150, 103, 255'],
  gold: ['#ffbe2e', '255, 190, 46'],
});

// Firefox exposes the promise-based `browser`; Chromium MV3 promisifies its own
// namespace. Either way this uses promises. Without the shim the Firefox popup
// queried tabs callback-style, got `undefined`, and rendered static defaults
// forever.
const api = globalThis.browser || globalThis.chrome;
const POPUP_LOCALE_FILES = Object.freeze({ en: 'en', es: 'es', 'pt-BR': 'pt_BR' });
let popupMessages = Object.create(null);
let popupLocale = '';

function normalizePopupLocale(value) {
  const locale = String(value || '').trim().replaceAll('_', '-').toLowerCase();
  if (locale === 'pt' || locale.startsWith('pt-')) return 'pt-BR';
  if (locale === 'es' || locale.startsWith('es-')) return 'es';
  return 'en';
}

function preferredPopupLocale(setting = 'auto') {
  if (['en', 'es', 'pt'].includes(setting)) return normalizePopupLocale(setting);
  const browserLocale = api?.i18n?.getMessage?.('@@ui_locale') || globalThis.navigator?.language || 'en';
  return normalizePopupLocale(browserLocale);
}

function t(key, fallback = '') {
  const local = popupMessages?.[key]?.message;
  if (typeof local === 'string' && local) return local;
  const native = api?.i18n?.getMessage?.(key);
  return typeof native === 'string' && native ? native : fallback;
}

function localizePopupDocument() {
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n, node.textContent);
  }
  for (const node of document.querySelectorAll('[data-i18n-title]')) {
    node.title = t(node.dataset.i18nTitle, node.title);
  }
}

async function applyPopupLocale(setting = 'auto') {
  const locale = preferredPopupLocale(setting);
  if (locale !== popupLocale || !Object.keys(popupMessages).length) {
    const directory = POPUP_LOCALE_FILES[locale] || POPUP_LOCALE_FILES.en;
    const relative = `_locales/${directory}/messages.json`;
    const url = api?.runtime?.getURL ? api.runtime.getURL(relative) : new URL(relative, globalThis.location?.href).href;
    popupMessages = await fetch(url).then((response) => {
      if (!response.ok) throw new Error(`locale ${response.status}`);
      return response.json();
    }).catch(() => Object.create(null));
    popupLocale = locale;
  }
  document.documentElement.lang = popupLocale;
  document.documentElement.dir = api?.i18n?.getMessage?.('@@bidi_dir') || 'ltr';
  localizePopupDocument();
}

function accentInk(hex) {
  const channels = String(hex).match(/[\da-f]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) return '#000000';
  const luminance = channels
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const inkLuminance = (value) => value
    .map((part) => part / 255)
    .map((part) => (part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4))
    .reduce((sum, part, index) => sum + part * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (first, second) => (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  const dark = inkLuminance([0, 0, 0]);
  const light = 1;
  return contrast(luminance, dark) >= contrast(luminance, light) ? '#000000' : '#ffffff';
}

function applyAppearance(settings) {
  const appearance = settings?.appearance || {};
  const theme = ['studio', 'oled', 'slate'].includes(appearance.theme) ? appearance.theme : 'studio';
  const preset = ACCENTS[appearance.accent] || ACCENTS.kick;
  const custom = appearance.accent === 'custom' && /^#[\da-f]{6}$/i.test(appearance.customAccent || '')
    ? appearance.customAccent
    : '';
  const hex = custom || preset[0];
  const rgb = custom
    ? String(custom).match(/[\da-f]{2}/gi).map((value) => Number.parseInt(value, 16)).join(', ')
    : preset[1];
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-rgb', rgb);
  document.documentElement.style.setProperty('--on-accent', accentInk(hex));
}

function renderUnavailable() {
  els.version.textContent = '';
  els.rulesets.textContent = t('unavailableValue', 'Not available');
  els.blocked.textContent = t('unavailableValue', 'Not available');
  els.networkState.dataset.state = 'off';
  els.networkState.textContent = t('offlineState', 'Offline');
  els.title.textContent = t('companionUnavailable', 'Companion unavailable');
  els.detail.textContent = t('reloadExtension', 'Reload the extension, then reopen this panel.');
  els.telemetry.disabled = true;
  els.approveBlocklist.disabled = true;
  els.revokeBlocklist.hidden = true;
  els.blocklistState.textContent = t('unavailableState', 'Unavailable');
  els.blocklistUrl.textContent = t('serviceUnreachable', 'The companion service could not be reached.');
  els.openSettings.disabled = true;
  els.telemetry.title = t('companionServiceUnavailableTitle', 'Kick Focus could not reach the companion service');
  els.approveBlocklist.title = t('companionServiceUnavailableTitle', 'Kick Focus could not reach the companion service');
  els.openSettings.title = t('companionServiceUnavailableTitle', 'Kick Focus could not reach the companion service');
  els.note.textContent = t('noSettingsChanged', 'No settings were changed.');
  document.body.setAttribute('aria-busy', 'false');
}

async function activeTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function send(tabId, message) {
  return Promise.resolve(api.tabs.sendMessage(tabId, message))
    .then((response) => ({ ok: true, response }))
    .catch(() => ({ ok: false, response: null }));
}

async function render() {
  if (!api?.tabs?.query || !api?.runtime?.sendMessage) {
    renderUnavailable();
    return;
  }
  const tab = await activeTab();
  const onKick = Boolean(tab?.url && KICK_HOST.test(tab.url));

  const status = await Promise.resolve(api.runtime.sendMessage({
    type: 'kick-focus:status',
    tabId: tab?.id ?? -1,
  })).catch(() => null);

  if (!status) {
    renderUnavailable();
    return;
  }

  await applyPopupLocale(status?.settings?.appearance?.locale);
  applyAppearance(status.settings);

  els.version.textContent = `v${status?.version ?? ''}`;
  els.rulesets.textContent = String(status?.rulesets?.length ?? 0);
  els.blocked.textContent = status?.countsAvailable ? String(status.blocked ?? 0) : t('unavailableValue', 'Not available');

  const adsOn = status?.rulesets?.includes('ads');
  els.networkState.dataset.state = adsOn ? 'on' : 'off';
  els.networkState.textContent = adsOn ? t('activeState', 'Active') : t('offState', 'Off');
  els.title.textContent = adsOn ? t('networkActive', 'Network layer active') : t('networkOff', 'Network layer off');
  els.detail.textContent = adsOn
    ? t('adRequestsBlocked', 'Ad requests are blocked before they are sent.')
    : t('adRulesDisabled', 'The ad blocking rules are not enabled.');

  els.telemetry.checked = Boolean(status?.settings?.content?.reduceTelemetry);
  els.telemetry.disabled = !onKick;
  els.openSettings.disabled = !onKick;
  els.telemetry.title = onKick ? '' : t('openKickTabChangeTitle', 'Open a Kick tab to change this setting');
  els.openSettings.title = onKick ? '' : t('openKickTabOpenSettingsTitle', 'Open a Kick tab to open settings');

  const candidateUrl = status?.blocklist?.candidateUrl || '';
  const approvedUrl = status?.blocklist?.approvedUrl || '';
  const approved = Boolean(status?.blocklist?.approved);
  els.blocklistUrl.textContent = candidateUrl || t('configureFeed', 'Set an HTTPS feed in Kick Focus settings.');
  els.blocklistUrl.title = candidateUrl;
  els.blocklistState.textContent = approved
    ? t('approvedState', 'Approved')
    : candidateUrl ? t('approvalNeeded', 'Approval needed') : t('notConfigured', 'Not configured');
  els.approveBlocklist.dataset.url = candidateUrl;
  els.approveBlocklist.disabled = !candidateUrl || approved;
  els.approveBlocklist.textContent = approved ? t('feedApprovedButton', 'Feed approved') : t('approveFeedButton', 'Approve this feed');
  els.approveBlocklist.title = candidateUrl
    ? approved ? t('exactFeedApprovedTitle', 'This exact feed is approved') : t('allowOriginTitle', 'Allow this exact origin and feed URL')
    : t('configureFeedTitle', 'Configure an HTTPS feed in settings first');
  els.revokeBlocklist.hidden = !approvedUrl;
  // Re-enabled here, like every other button this render owns. The click
  // handler disables it and only calls render(), so a failed revoke used to
  // leave it visible and dead to both mouse and keyboard until the popup was
  // closed and reopened.
  els.revokeBlocklist.disabled = false;

  if (!onKick) {
    els.note.textContent = t('openKickTabChange', 'Open a Kick tab to change settings.');
  } else if (!status?.countsAvailable) {
    els.note.textContent = t('countsUnpacked', 'Blocked counts are only available when the extension is loaded unpacked.');
  } else {
    els.note.textContent = '';
  }
  document.body.setAttribute('aria-busy', 'false');
}

els.telemetry.addEventListener('change', async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  const wanted = els.telemetry.checked;
  els.telemetry.disabled = true;
  els.telemetry.setAttribute('aria-busy', 'true');
  els.note.textContent = t('updatingNetwork', 'Updating the network layer…');
  const result = await send(tab.id, { type: 'kick-focus:set-telemetry', enabled: wanted });
  if (!result.ok) els.note.textContent = t('reachTabRetry', 'Could not reach this Kick tab. Reload it and try again.');
  // Re-read rather than assume: the page is the authority on whether it stuck.
  setTimeout(() => {
    els.telemetry.removeAttribute('aria-busy');
    render();
  }, result.ok ? 150 : 1100);
});

els.approveBlocklist.addEventListener('click', async () => {
  const url = els.approveBlocklist.dataset.url || '';
  if (!url) return;
  let origin = '';
  try { origin = `${new URL(url).origin}/*`; } catch { return; }

  els.approveBlocklist.disabled = true;
  els.approveBlocklist.setAttribute('aria-busy', 'true');
  els.note.textContent = t('waitingPermission', 'Waiting for origin permission…');
  const granted = await Promise.resolve(api.permissions.request({ origins: [origin] })).catch(() => false);
  if (!granted) {
    els.approveBlocklist.removeAttribute('aria-busy');
    els.approveBlocklist.disabled = false;
    els.note.textContent = t('permissionNotGranted', 'Feed permission was not granted.');
    return;
  }

  const result = await Promise.resolve(api.runtime.sendMessage({
    type: 'kick-focus:approve-blocklist',
    url,
  })).catch(() => ({ ok: false }));
  if (!result?.ok) {
    await Promise.resolve(api.permissions.remove({ origins: [origin] })).catch(() => false);
  }
  els.approveBlocklist.removeAttribute('aria-busy');
  await render();
  els.note.textContent = result?.ok
    ? t('remoteApproved', 'Remote blocklist feed approved.')
    : t('feedChanged', 'The feed changed before approval. Reopen the popup.');
});

els.revokeBlocklist.addEventListener('click', async () => {
  els.revokeBlocklist.disabled = true;
  els.note.textContent = t('removingPermission', 'Removing feed permission…');
  const result = await Promise.resolve(api.runtime.sendMessage({
    type: 'kick-focus:revoke-blocklist',
  })).catch(() => ({ ok: false }));
  await render();
  els.note.textContent = result?.ok
    ? t('permissionRemoved', 'Remote blocklist permission removed.')
    : t('permissionRemoveFailed', 'Feed permission could not be removed.');
});

els.openSettings.addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  els.openSettings.disabled = true;
  els.openSettings.textContent = t('openingSettings', 'Opening settings…');
  const result = await send(tab.id, { type: 'kick-focus:open-settings' });
  if (result.ok) window.close();
  else {
    els.openSettings.disabled = false;
    els.openSettings.textContent = t('openSettingsButton', 'Open Kick Focus settings');
    els.note.textContent = t('reachTabRetry', 'Could not reach this Kick tab. Reload it and try again.');
  }
});

applyPopupLocale().then(render).catch(renderUnavailable);
