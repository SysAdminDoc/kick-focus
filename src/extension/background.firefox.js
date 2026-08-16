/**
 * Firefox MV2 network layer. The host arrays are generated from core.mjs at
 * build time; only requests initiated by Kick pages are eligible to cancel.
 */

const api = globalThis.browser || globalThis.chrome;
const AD_HOSTS = __AD_HOSTS__;
const TELEMETRY_HOSTS = __TELEMETRY_HOSTS__;
const BADGE_COLOR = '#53fc18';
let telemetryEnabled = true;
const blockedByTab = new Map();

/**
 * `blob:` and `filesystem:` URLs carry their real origin in the path, not the
 * hostname — `new URL('blob:https://kick.com/…').hostname` is the empty string.
 * Kick's player runs inside a blob: worker, so without this unwrap every
 * worker-initiated request looks originless and escapes the filter.
 */
function originHostname(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'blob:' || parsed.protocol === 'filesystem:') {
      return originHostname(parsed.pathname);
    }
    return parsed.hostname;
  } catch {
    return '';
  }
}

function hostMatches(rawUrl, hosts) {
  const hostname = originHostname(rawUrl);
  if (!hostname) return false;
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/**
 * Firefox populates `originUrl`/`documentUrl`; `initiator` is Chromium-only and
 * is kept purely as a fallback so one file serves both engines.
 */
function kickInitiator(details) {
  const hostname = originHostname(details?.originUrl || details?.documentUrl || details?.initiator);
  return hostname === 'kick.com' || hostname === 'www.kick.com';
}

function paintBadge(tabId) {
  const count = blockedByTab.get(tabId) || 0;
  api.browserAction.setBadgeText({ tabId, text: count ? (count > 999 ? '999+' : String(count)) : '' });
  api.browserAction.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
}

function beforeRequest(details) {
  if (!kickInitiator(details)) return undefined;
  const blocked = hostMatches(details.url, AD_HOSTS) || (telemetryEnabled && hostMatches(details.url, TELEMETRY_HOSTS));
  if (!blocked) return undefined;
  blockedByTab.set(details.tabId, (blockedByTab.get(details.tabId) || 0) + 1);
  paintBadge(details.tabId);
  return { cancel: true };
}

api.webRequest.onBeforeRequest.addListener(
  beforeRequest,
  { urls: ['<all_urls>'], types: ['script', 'xmlhttprequest', 'image', 'sub_frame', 'ping', 'media', 'font', 'stylesheet', 'websocket', 'other'] },
  ['blocking'],
);

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'kick-focus:telemetry-preference') {
    telemetryEnabled = Boolean(message.enabled);
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === 'kick-focus:status') {
    api.storage.local.get('settings').then((stored) => sendResponse({
      version: api.runtime.getManifest().version,
      rulesets: ['ads', ...(telemetryEnabled ? ['telemetry'] : [])],
      blocked: blockedByTab.get(message.tabId) || 0,
      countsAvailable: true,
      settings: stored?.settings || null,
    }));
    return true;
  }
  if (message?.type === 'kick-focus:fetch-blocklist') {
    const url = String(message.url || '');
    if (!url.startsWith('https://')) {
      sendResponse({ ok: false, error: 'HTTPS required' });
      return true;
    }
    fetch(url, { credentials: 'omit', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => sendResponse({ ok: true, text }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }))
      .finally(() => {});
    return true;
  }

  if (message?.type === 'kick-focus:reset-count') {
    blockedByTab.delete(message.tabId);
    paintBadge(message.tabId);
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

api.tabs.onRemoved.addListener((tabId) => blockedByTab.delete(tabId));
api.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return;
  blockedByTab.delete(tabId);
  paintBadge(tabId);
});
