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

function accentInk(hex) {
  const channels = String(hex).match(/[\da-f]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) return '#071004';
  const luminance = channels
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const inkLuminance = (value) => value
    .map((part) => part / 255)
    .map((part) => (part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4))
    .reduce((sum, part, index) => sum + part * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (first, second) => (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  const dark = inkLuminance([7, 16, 4]);
  const light = 1;
  return contrast(luminance, dark) >= contrast(luminance, light) ? '#071004' : '#ffffff';
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
  els.rulesets.textContent = 'Not available';
  els.blocked.textContent = 'Not available';
  els.networkState.dataset.state = 'off';
  els.networkState.textContent = 'Offline';
  els.title.textContent = 'Companion unavailable';
  els.detail.textContent = 'Reload the extension, then reopen this panel.';
  els.telemetry.disabled = true;
  els.openSettings.disabled = true;
  els.telemetry.title = 'Kick Focus could not reach the companion service';
  els.openSettings.title = 'Kick Focus could not reach the companion service';
  els.note.textContent = 'No settings were changed.';
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

  applyAppearance(status.settings);

  els.version.textContent = `v${status?.version ?? ''}`;
  els.rulesets.textContent = String(status?.rulesets?.length ?? 0);
  els.blocked.textContent = status?.countsAvailable ? String(status.blocked ?? 0) : 'Not available';

  const adsOn = status?.rulesets?.includes('ads');
  els.networkState.dataset.state = adsOn ? 'on' : 'off';
  els.networkState.textContent = adsOn ? 'Active' : 'Off';
  els.title.textContent = adsOn ? 'Network layer active' : 'Network layer off';
  els.detail.textContent = adsOn
    ? 'Ad requests are blocked before they are sent.'
    : 'The ad ruleset is not enabled.';

  els.telemetry.checked = Boolean(status?.settings?.content?.reduceTelemetry);
  els.telemetry.disabled = !onKick;
  els.openSettings.disabled = !onKick;
  els.telemetry.title = onKick ? '' : 'Open a Kick tab to change this setting';
  els.openSettings.title = onKick ? '' : 'Open a Kick tab to open settings';

  if (!onKick) {
    els.note.textContent = 'Open a Kick tab to change settings.';
  } else if (!status?.countsAvailable) {
    els.note.textContent = 'Blocked counts need an unpacked install.';
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
  els.note.textContent = 'Updating network protection…';
  const result = await send(tab.id, { type: 'kick-focus:set-telemetry', enabled: wanted });
  if (!result.ok) els.note.textContent = 'Could not reach this Kick tab. Reload it and try again.';
  // Re-read rather than assume: the page is the authority on whether it stuck.
  setTimeout(() => {
    els.telemetry.removeAttribute('aria-busy');
    render();
  }, result.ok ? 150 : 1100);
});

els.openSettings.addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  els.openSettings.disabled = true;
  els.openSettings.textContent = 'Opening settings…';
  const result = await send(tab.id, { type: 'kick-focus:open-settings' });
  if (result.ok) window.close();
  else {
    els.openSettings.disabled = false;
    els.openSettings.textContent = 'Open Kick Focus settings';
    els.note.textContent = 'Could not reach this Kick tab. Reload it and try again.';
  }
});

render().catch(renderUnavailable);
