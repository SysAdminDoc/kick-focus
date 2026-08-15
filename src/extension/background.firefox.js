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

function hostMatches(rawUrl, hosts) {
  try {
    const hostname = new URL(rawUrl).hostname;
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function kickInitiator(initiator) {
  try {
    const hostname = new URL(initiator).hostname;
    return hostname === 'kick.com' || hostname === 'www.kick.com';
  } catch {
    return false;
  }
}

function paintBadge(tabId) {
  const count = blockedByTab.get(tabId) || 0;
  api.browserAction.setBadgeText({ tabId, text: count ? (count > 999 ? '999+' : String(count)) : '' });
  api.browserAction.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
}

function beforeRequest(details) {
  if (!kickInitiator(details.initiator)) return undefined;
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
