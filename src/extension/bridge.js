/**
 * Isolated-world bridge.
 *
 * The page-world script owns every visible behaviour and reads its settings
 * synchronously from localStorage. This bridge only does the three things a
 * page-world script cannot do for itself:
 *
 * 1. Advertise that the companion extension is present, so the settings UI can
 *    report a network-level protection layer instead of claiming one it lacks.
 * 2. Mirror settings into chrome.storage so the popup can read them without
 *    injecting anything.
 * 3. Relay the telemetry preference to the service worker, which owns the
 *    declarativeNetRequest rulesets.
 */

const SETTINGS_KEY = 'kick-focus:settings';
const VERSION = chrome.runtime.getManifest().version;

function markCompanion() {
  const root = document.documentElement;
  if (!root) return false;
  root.dataset.kickFocusCompanion = VERSION;
  return true;
}

// At document_start the documentElement normally exists already. If a browser
// ever schedules this earlier, fall back to the first mutation instead of
// silently never marking the page.
if (!markCompanion()) {
  new MutationObserver((_records, observer) => {
    if (markCompanion()) observer.disconnect();
  }).observe(document, { childList: true, subtree: true });
}

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeBlocklistUrl(raw) {
  try {
    const url = new URL(String(raw || ''));
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

// Reduce whatever the page announced to the fields the popup reads, so a
// forged settings-changed event cannot write arbitrary data into extension
// storage or flip a ruleset through an unvalidated payload. The page-world
// script stays the single source of truth for the settings file itself.
function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const content = raw.content && typeof raw.content === 'object' ? raw.content : {};
  const appearance = raw.appearance && typeof raw.appearance === 'object' ? raw.appearance : {};
  const theme = ['studio', 'oled', 'slate'].includes(appearance.theme) ? appearance.theme : 'studio';
  const accent = ['kick', 'cyan', 'violet', 'gold', 'custom'].includes(appearance.accent) ? appearance.accent : 'kick';
  const customAccent = /^#[\da-f]{6}$/i.test(appearance.customAccent || '') ? appearance.customAccent : '#FF5CA8';
  const blocklistUrl = normalizeBlocklistUrl(content.blocklistUrl);
  return {
    appearance: { theme, accent, customAccent },
    content: {
      reduceTelemetry: Boolean(content.reduceTelemetry),
      ...(blocklistUrl ? { blocklistUrl } : {}),
    },
  };
}

function publish(settings) {
  const sanitized = sanitizeSettings(settings);
  if (!sanitized) return;
  try {
    chrome.storage.local.set({ settings: sanitized, updatedAt: Date.now() });
    chrome.runtime.sendMessage({
      type: 'kick-focus:telemetry-preference',
      enabled: sanitized.content.reduceTelemetry,
    });
  } catch {
    // The service worker may be restarting; the next change re-publishes.
  }
}

publish(readSettings());

// The page world dispatches this at startup and after every settings write. A
// same-page localStorage write does not fire a storage event, so this is the
// only reliable in-tab signal. The event carries the effective settings, which
// matters on a profile that has never saved: storage is empty there, but
// defaults that are switched on still need to reach the network rulesets.
document.addEventListener('kick-focus:settings-changed', (event) => {
  let announced = null;
  try {
    // A string, because page-world objects are not structured-cloneable here.
    const raw = event.detail?.settings;
    if (typeof raw === 'string') announced = JSON.parse(raw);
  } catch {
    // Fall back to storage below.
  }
  publish(announced || readSettings());
});

// Cross-tab writes still arrive through the storage event.
window.addEventListener('storage', (event) => {
  if (event.key === SETTINGS_KEY) publish(readSettings());
});

/**
 * Ask the page for its current settings.
 *
 * The two content scripts are injected independently, so the page's own startup
 * announcement can land before this script is listening. Asking once now and
 * again at DOMContentLoaded makes the exchange survive either injection order;
 * the page answers with the same settings-changed event handled above, so a
 * duplicate answer is harmless.
 */
function requestSettings() {
  document.dispatchEvent(new CustomEvent('kick-focus:request-settings'));
}

requestSettings();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', requestSettings, { once: true });
}

// The page can trigger a refresh, but it cannot choose the privileged request
// target. The background reads an exact URL approved from the extension popup
// and refuses the request if the mirrored page setting no longer matches it.
document.addEventListener('kick-focus:fetch-blocklist', () => {
  const url = normalizeBlocklistUrl(readSettings()?.content?.blocklistUrl);
  if (!url) {
    document.dispatchEvent(new CustomEvent('kick-focus:blocklist-result', {
      detail: JSON.stringify({ ok: false, error: 'no configured blocklist URL' }),
    }));
    return;
  }
  chrome.runtime.sendMessage({ type: 'kick-focus:fetch-blocklist' }, (response) => {
    void chrome.runtime.lastError;
    document.dispatchEvent(new CustomEvent('kick-focus:blocklist-result', {
      detail: JSON.stringify(response || { ok: false, error: 'no response' }),
    }));
  });
});

// Presence handshake: the page proves the companion is really present with a
// live round-trip that echoes a fresh nonce, rather than trusting the
// page-writable <html> dataset attribute that any page script could set.
document.addEventListener('kick-focus:companion-ping', (event) => {
  const nonce = event.detail?.nonce;
  if (typeof nonce !== 'string') return;
  document.dispatchEvent(new CustomEvent('kick-focus:companion-pong', {
    detail: JSON.stringify({ nonce, version: VERSION }),
  }));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'kick-focus:open-settings') {
    document.dispatchEvent(new CustomEvent('kick-focus:open-settings'));
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === 'kick-focus:open-multistream') {
    document.dispatchEvent(new CustomEvent('kick-focus:open-multistream'));
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === 'kick-focus:open-commands') {
    document.dispatchEvent(new CustomEvent('kick-focus:open-commands'));
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === 'kick-focus:set-telemetry') {
    // The page world owns the settings file. Asking it to make the change keeps
    // one writer on the key; the resulting settings-changed event publishes back.
    document.dispatchEvent(new CustomEvent('kick-focus:set-telemetry', {
      detail: { enabled: Boolean(message.enabled) },
    }));
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
