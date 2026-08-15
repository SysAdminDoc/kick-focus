/**
 * Firefox MV2 bridge. The page bundle is injected into the page world through
 * a local web-accessible script because MV2 content scripts are isolated.
 */

const api = globalThis.browser || globalThis.chrome;
const SETTINGS_KEY = 'kick-focus:settings';
const VERSION = api.runtime.getManifest().version;

function markCompanion() {
  const root = document.documentElement;
  if (!root) return false;
  root.dataset.kickFocusCompanion = VERSION;
  return true;
}

function injectPageScript() {
  const script = document.createElement('script');
  script.src = api.runtime.getURL('content/kick-focus.js');
  script.dataset.kickFocusFirefox = 'true';
  (document.head || document.documentElement).append(script);
  script.addEventListener('load', () => script.remove(), { once: true });
}

if (!markCompanion()) {
  new MutationObserver((_records, observer) => {
    if (markCompanion()) {
      observer.disconnect();
      injectPageScript();
    }
  }).observe(document, { childList: true, subtree: true });
} else {
  injectPageScript();
}

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function publish(settings) {
  if (!settings) return;
  try {
    api.storage.local.set({ settings, updatedAt: Date.now() });
    api.runtime.sendMessage({
      type: 'kick-focus:telemetry-preference',
      enabled: Boolean(settings?.content?.reduceTelemetry),
    });
  } catch {
    // The page will announce again when it finishes booting.
  }
}

publish(readSettings());

document.addEventListener('kick-focus:settings-changed', (event) => {
  try {
    const raw = event.detail?.settings;
    publish(typeof raw === 'string' ? JSON.parse(raw) : readSettings());
  } catch {
    publish(readSettings());
  }
});

window.addEventListener('storage', () => publish(readSettings()));

function requestSettings() {
  document.dispatchEvent(new CustomEvent('kick-focus:request-settings'));
}

requestSettings();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', requestSettings, { once: true });

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
    document.dispatchEvent(new CustomEvent('kick-focus:set-telemetry', { detail: { enabled: Boolean(message.enabled) } }));
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
