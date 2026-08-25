/**
 * Firefox bridge, in the isolated world.
 *
 * The page bundle is no longer injected from here. It is a second content
 * script declared in the manifest with `world: "MAIN"`, which Firefox runs in
 * the page's own realm at document_start, so this file no longer carries a copy
 * of the whole bundle as a string.
 *
 * Two things that must stay true either way, and are why the obvious approach
 * was never used: a `<script src=runtime.getURL(...)>` puts
 * `moz-extension://<uuid>/…` into the page, and Firefox's extension UUID is
 * randomised per install and stable for its life, so any script on kick.com
 * could read it as a tracking identifier that survives clearing cookies. And an
 * inline `textContent` script depends on kick.com continuing to ship no CSP. A
 * declared MAIN-world script needs neither: the browser injects it, so no URL
 * enters the page and the page's CSP does not apply to it.
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

// The companion marker still has to land, and at document_start there may be
// no documentElement yet to put it on.
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

// Must answer exactly as core.mjs `normalizeBlocklistUrl` does, including the
// length cap; scripts/check.mjs runs both over one corpus and compares.
function normalizeBlocklistUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
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

// The page can trigger a refresh, but the exact request target is owned by an
// approval created in the popup and enforced by the background.
document.addEventListener('kick-focus:fetch-blocklist', () => {
  const url = normalizeBlocklistUrl(readSettings()?.content?.blocklistUrl);
  if (!url) {
    document.dispatchEvent(new CustomEvent('kick-focus:blocklist-result', {
      detail: JSON.stringify({ ok: false, error: 'no configured blocklist URL' }),
    }));
    return;
  }
  api.runtime.sendMessage({ type: 'kick-focus:fetch-blocklist' }, (response) => {
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
