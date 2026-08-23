/**
 * Service worker.
 *
 * Owns the declarativeNetRequest rulesets. The "ads" ruleset is always on; the
 * "telemetry" ruleset mirrors the user's Reduce tracking telemetry preference,
 * which is stored by the page-world script and relayed here by the bridge.
 *
 * Every rule is scoped to kick.com initiators. This extension never changes how
 * any other site loads.
 */

const TELEMETRY_RULESET = 'telemetry';
const BADGE_COLOR = '#53fc18';
const BLOCKLIST_APPROVAL_KEY = 'blocklistApproval';
const BLOCKLIST_MAX_BYTES = 512 * 1024;
const BLOCKLIST_TIMEOUT_MS = 8000;

const blockedByTab = new Map();

async function setTelemetryRuleset(enabled) {
  const current = await chrome.declarativeNetRequest.getEnabledRulesets();
  const alreadyOn = current.includes(TELEMETRY_RULESET);
  if (alreadyOn === enabled) return;
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    enabled
      ? { enableRulesetIds: [TELEMETRY_RULESET] }
      : { disableRulesetIds: [TELEMETRY_RULESET] },
  );
}

function paintBadge(tabId) {
  const count = blockedByTab.get(tabId) || 0;
  const text = count === 0 ? '' : count > 999 ? '999+' : String(count);
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR }).catch(() => {});
}

const KICK_ORIGINS = new Set(['https://kick.com', 'https://www.kick.com']);

/**
 * Who is allowed to ask for this.
 *
 * Two privileged primitives sit behind this listener — a cross-origin fetch and
 * a global, persistent ruleset toggle — so every message is checked against the
 * sender the browser reports rather than trusted for having the right shape.
 *
 * The ceiling is worth stating: a compromised renderer can spoof `id` and
 * `origin`, so this defends against *other extensions* and against a message
 * arriving from a frame this extension never injected, not against a browser
 * that is already compromised.
 */
const fromThisExtension = (sender) => sender?.id === chrome.runtime.id;
const senderOrigin = (sender) => {
  if (sender?.origin) return sender.origin;
  try { return sender?.url ? new URL(sender.url).origin : ''; } catch { return ''; }
};
/** The content script on a Kick page. */
const fromKickPage = (sender) => fromThisExtension(sender) && KICK_ORIGINS.has(senderOrigin(sender));
/** The content script, or one of this extension's own pages (the popup). */
// An extension page (the popup). Matched on the URL's scheme rather than its
// origin: `new URL('chrome-extension://…').origin` is not reliable across
// engines — Node returns the string 'null' for non-special schemes — and this
// file is exercised under node:test.
const fromOwnPage = (sender) => fromThisExtension(sender) && /^chrome-extension:\/\//.test(String(sender?.url || ''));
const fromKickPageOrOwnUi = (sender) => fromKickPage(sender) || fromOwnPage(sender);

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

function permissionOrigin(url) {
  try { return `${new URL(url).origin}/*`; } catch { return ''; }
}

async function readBlocklistState() {
  const stored = await chrome.storage.local.get(['settings', BLOCKLIST_APPROVAL_KEY]);
  const candidateUrl = normalizeBlocklistUrl(stored?.settings?.content?.blocklistUrl);
  const approvedUrl = normalizeBlocklistUrl(stored?.[BLOCKLIST_APPROVAL_KEY]?.url);
  const origin = permissionOrigin(approvedUrl);
  const permissionGranted = Boolean(origin) && await chrome.permissions.contains({ origins: [origin] });
  return {
    candidateUrl,
    approvedUrl,
    origin,
    approved: Boolean(candidateUrl && candidateUrl === approvedUrl && permissionGranted),
  };
}

async function approveBlocklist(rawUrl) {
  const url = normalizeBlocklistUrl(rawUrl);
  const stored = await chrome.storage.local.get(['settings', BLOCKLIST_APPROVAL_KEY]);
  const candidateUrl = normalizeBlocklistUrl(stored?.settings?.content?.blocklistUrl);
  if (!url || url !== candidateUrl) throw new Error('The configured feed changed. Reopen the popup.');
  const origin = permissionOrigin(url);
  if (!await chrome.permissions.contains({ origins: [origin] })) throw new Error('Origin permission was not granted.');

  const previousOrigin = permissionOrigin(stored?.[BLOCKLIST_APPROVAL_KEY]?.url);
  await chrome.storage.local.set({
    [BLOCKLIST_APPROVAL_KEY]: { url, origin, approvedAt: Date.now() },
  });
  if (previousOrigin && previousOrigin !== origin) {
    await chrome.permissions.remove({ origins: [previousOrigin] });
  }
  return { url };
}

async function revokeBlocklist() {
  const stored = await chrome.storage.local.get(BLOCKLIST_APPROVAL_KEY);
  const origin = permissionOrigin(stored?.[BLOCKLIST_APPROVAL_KEY]?.url);
  await chrome.storage.local.remove(BLOCKLIST_APPROVAL_KEY);
  if (origin) await chrome.permissions.remove({ origins: [origin] });
}

async function fetchApprovedBlocklist(requestedUrl) {
  const state = await readBlocklistState();
  const requestUrl = normalizeBlocklistUrl(requestedUrl);
  if (!state.approved) throw new Error('Blocklist feed approval is required.');
  if (requestedUrl && requestUrl !== state.approvedUrl) throw new Error('Blocklist URL mismatch.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BLOCKLIST_TIMEOUT_MS);
  try {
    const response = await fetch(state.approvedUrl, {
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (response.redirected || normalizeBlocklistUrl(response.url) !== state.approvedUrl) {
      throw new Error('Redirected blocklist responses are refused.');
    }
    const mime = String(response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (mime !== 'application/json' && !mime.endsWith('+json')) throw new Error('A JSON response is required.');
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > BLOCKLIST_MAX_BYTES) {
      throw new Error('Blocklist exceeds 512 KiB.');
    }
    const body = await response.arrayBuffer();
    if (body.byteLength > BLOCKLIST_MAX_BYTES) throw new Error('Blocklist exceeds 512 KiB.');
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'kick-focus:telemetry-preference') {
    if (!fromKickPage(sender)) { sendResponse({ ok: false, error: 'refused' }); return true; }
    setTelemetryRuleset(Boolean(message.enabled))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === 'kick-focus:status') {
    if (!fromKickPageOrOwnUi(sender)) { sendResponse({ ok: false, error: 'refused' }); return true; }
    (async () => {
      const rulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
      const stored = await chrome.storage.local.get('settings');
      const blocklist = await readBlocklistState();
      sendResponse({
        version: chrome.runtime.getManifest().version,
        rulesets,
        blocked: blockedByTab.get(message.tabId) || 0,
        // Reported so the popup can show whether the counter is trustworthy:
        // onRuleMatchedDebug only exists for unpacked installs.
        countsAvailable: Boolean(chrome.declarativeNetRequest.onRuleMatchedDebug),
        settings: stored?.settings || null,
        blocklist,
      });
    })();
    return true;
  }

  if (message?.type === 'kick-focus:fetch-blocklist') {
    if (!fromKickPage(sender)) { sendResponse({ ok: false, error: 'refused' }); return true; }
    fetchApprovedBlocklist(message.url)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === 'kick-focus:approve-blocklist') {
    if (!fromOwnPage(sender)) { sendResponse({ ok: false, error: 'refused' }); return true; }
    approveBlocklist(message.url)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === 'kick-focus:revoke-blocklist') {
    if (!fromOwnPage(sender)) { sendResponse({ ok: false, error: 'refused' }); return true; }
    revokeBlocklist()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === 'kick-focus:reset-count') {
    if (!fromKickPageOrOwnUi(sender)) { sendResponse({ ok: false, error: 'refused' }); return true; }
    blockedByTab.delete(message.tabId);
    paintBadge(message.tabId);
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

// Available for unpacked installs only, which is how this extension is meant to
// be loaded. When absent the extension still blocks; only the counter is blind.
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const tabId = info?.request?.tabId;
    if (typeof tabId !== 'number' || tabId < 0) return;
    blockedByTab.set(tabId, (blockedByTab.get(tabId) || 0) + 1);
    paintBadge(tabId);
  });
}

chrome.tabs.onRemoved.addListener((tabId) => blockedByTab.delete(tabId));

// changeInfo.url is only populated with the "tabs" permission, which this
// extension deliberately does not request, so the reset keys off status alone.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return;
  blockedByTab.delete(tabId);
  paintBadge(tabId);
});
