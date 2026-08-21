/**
 * Firefox MV2 bridge. MV2 content scripts are isolated, so the page bundle has
 * to be injected — and it is carried here as source rather than loaded from a
 * `moz-extension://` URL. That URL contains a per-install UUID which is stable
 * for the life of the install, so putting it in the page hands kick.com a
 * tracking identifier that survives clearing cookies. The build replaces the
 * placeholder below and refuses to emit a bridge that still contains it.
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

/** Replaced at build time with the page bundle, as a JSON string literal. */
const PAGE_BUNDLE = "__PAGE_BUNDLE__";

function injectPageScript() {
  const script = document.createElement('script');
  // textContent, never src: no extension URL reaches the page, and the browser
  // does not re-parse the text as markup on the way in.
  script.textContent = PAGE_BUNDLE;
  script.dataset.kickFocusFirefox = 'true';
  (document.head || document.documentElement).append(script);
  // An inline script has already run by the time append() returns, so the
  // element can go immediately rather than waiting for a load event that will
  // never fire.
  script.remove();
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

// Reduce whatever the page announced to the fields the popup reads, so a
// forged settings-changed event cannot write arbitrary data into extension
// storage or flip a ruleset through an unvalidated payload.
function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const content = raw.content && typeof raw.content === 'object' ? raw.content : {};
  const appearance = raw.appearance && typeof raw.appearance === 'object' ? raw.appearance : {};
  const theme = ['studio', 'oled', 'slate'].includes(appearance.theme) ? appearance.theme : 'studio';
  const accent = ['kick', 'cyan', 'violet', 'gold', 'custom'].includes(appearance.accent) ? appearance.accent : 'kick';
  const customAccent = /^#[\da-f]{6}$/i.test(appearance.customAccent || '') ? appearance.customAccent : '#FF5CA8';
  return {
    appearance: { theme, accent, customAccent },
    content: { reduceTelemetry: Boolean(content.reduceTelemetry) },
  };
}

function publish(settings) {
  const sanitized = sanitizeSettings(settings);
  if (!sanitized) return;
  try {
    api.storage.local.set({ settings: sanitized, updatedAt: Date.now() });
    api.runtime.sendMessage({
      type: 'kick-focus:telemetry-preference',
      enabled: sanitized.content.reduceTelemetry,
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

// Pinned to the configured blocklist URL from settings, never taken from the
// event, so a forged fetch-blocklist event cannot redirect this privileged fetch.
document.addEventListener('kick-focus:fetch-blocklist', () => {
  const url = readSettings()?.content?.blocklistUrl;
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
    document.dispatchEvent(new CustomEvent('kick-focus:blocklist-result', {
      detail: JSON.stringify({ ok: false, error: 'no configured blocklist URL' }),
    }));
    return;
  }
  api.runtime.sendMessage({ type: 'kick-focus:fetch-blocklist', url }, (response) => {
    document.dispatchEvent(new CustomEvent('kick-focus:blocklist-result', {
      detail: JSON.stringify(response || { ok: false, error: 'no response' }),
    }));
  });
});

// Presence handshake: prove the companion is present with a live nonce
// round-trip rather than a page-writable <html> dataset attribute.
document.addEventListener('kick-focus:companion-ping', (event) => {
  const nonce = event.detail?.nonce;
  if (typeof nonce !== 'string') return;
  document.dispatchEvent(new CustomEvent('kick-focus:companion-pong', {
    detail: JSON.stringify({ nonce, version: VERSION }),
  }));
});

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
