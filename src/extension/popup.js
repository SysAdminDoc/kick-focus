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
  dot: document.getElementById('network-dot'),
  title: document.getElementById('network-title'),
  detail: document.getElementById('network-detail'),
  blocked: document.getElementById('blocked'),
  rulesets: document.getElementById('rulesets'),
  telemetry: document.getElementById('telemetry'),
  openSettings: document.getElementById('open-settings'),
  note: document.getElementById('note'),
};

const KICK_HOST = /^https:\/\/(www\.)?kick\.com\//;

// Firefox exposes the promise-based `browser`; Chromium MV3 promisifies its own
// namespace. Either way this uses promises. Without the shim the Firefox popup
// queried tabs callback-style, got `undefined`, and rendered static defaults
// forever.
const api = globalThis.browser || globalThis.chrome;

async function activeTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function send(tabId, message) {
  return Promise.resolve(api.tabs.sendMessage(tabId, message)).catch(() => null);
}

async function render() {
  const tab = await activeTab();
  const onKick = Boolean(tab?.url && KICK_HOST.test(tab.url));

  const status = await api.runtime.sendMessage({
    type: 'kick-focus:status',
    tabId: tab?.id ?? -1,
  });

  els.version.textContent = `v${status?.version ?? ''}`;
  els.rulesets.textContent = String(status?.rulesets?.length ?? 0);
  els.blocked.textContent = status?.countsAvailable ? String(status.blocked ?? 0) : '—';

  const adsOn = status?.rulesets?.includes('ads');
  els.dot.dataset.state = adsOn ? 'on' : 'off';
  els.title.textContent = adsOn ? 'Network layer active' : 'Network layer off';
  els.detail.textContent = adsOn
    ? 'Ad requests are blocked before they are sent.'
    : 'The ad ruleset is not enabled.';

  els.telemetry.checked = Boolean(status?.settings?.content?.reduceTelemetry);
  els.telemetry.disabled = !onKick;
  els.openSettings.disabled = !onKick;

  if (!onKick) {
    els.note.textContent = 'Open a Kick tab to change settings.';
  } else if (!status?.countsAvailable) {
    els.note.textContent = 'Blocked counts need an unpacked install.';
  } else {
    els.note.textContent = '';
  }
}

els.telemetry.addEventListener('change', async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  const wanted = els.telemetry.checked;
  els.telemetry.disabled = true;
  await send(tab.id, { type: 'kick-focus:set-telemetry', enabled: wanted });
  // Re-read rather than assume: the page is the authority on whether it stuck.
  setTimeout(render, 150);
});

els.openSettings.addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  await send(tab.id, { type: 'kick-focus:open-settings' });
  window.close();
});

render();
