/**
 * Firefox MV2 network layer. The host arrays are generated from core.mjs at
 * build time; only requests initiated by Kick pages are eligible to cancel.
 */

const api = globalThis.browser || globalThis.chrome;
const AD_HOSTS = __AD_HOSTS__;
const TELEMETRY_HOSTS = __TELEMETRY_HOSTS__;
const BADGE_COLOR = '#53fc18';
const BLOCKLIST_APPROVAL_KEY = 'blocklistApproval';
const BLOCKLIST_MAX_BYTES = 512 * 1024;
// Written from the constant, so raising the cap cannot leave the refusal
// naming a limit that is no longer the limit.
const BLOCKLIST_TOO_LARGE = `Blocklist exceeds ${Math.round(BLOCKLIST_MAX_BYTES / 1024)} KiB.`;
const BLOCKLIST_TIMEOUT_MS = 8000;
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

const KICK_ORIGINS = new Set(['https://kick.com', 'https://www.kick.com']);

/**
 * Who is allowed to ask for this.
 *
 * A cross-origin fetch and the telemetry toggle sit behind this listener, so
 * every message is checked against the sender the browser reports rather than
 * trusted for having the right shape. Firefox does not always populate
 * `sender.origin`, so `sender.url` is the fallback.
 *
 * The ceiling: a compromised renderer can spoof both fields, so this defends
 * against other extensions and against frames this extension never injected,
 * not against a browser that is already compromised.
 */
const fromThisExtension = (sender) => sender?.id === api.runtime.id;
const senderOrigin = (sender) => {
  if (sender?.origin) return sender.origin;
  try { return sender?.url ? new URL(sender.url).origin : ''; } catch { return ''; }
};
const fromKickPage = (sender) => fromThisExtension(sender) && KICK_ORIGINS.has(senderOrigin(sender));
// An extension page (the popup). Matched on the URL's scheme rather than its
// origin: `new URL('moz-extension://…').origin` is the string 'null' in Node,
// which is where this file's guard is tested.
const fromOwnPage = (sender) => fromThisExtension(sender) && /^moz-extension:\/\//.test(String(sender?.url || ''));
const fromKickPageOrOwnUi = (sender) => fromKickPage(sender) || fromOwnPage(sender);

/**
 * Which tab a message is allowed to be about.
 *
 * A Kick page speaks for itself and nothing else: it used to pass `tabId` in the
 * body, so a content script on any Kick tab could read or reset another Kick
 * tab's blocked counter and clear its badge. The popup is the only caller that
 * legitimately names a tab other than its own, and it is not a Kick page.
 */
const tabIdFor = (message, sender) => (fromKickPage(sender)
  ? sender?.tab?.id
  : message?.tabId);

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

function permissionOrigin(url) {
  try { return `${new URL(url).origin}/*`; } catch { return ''; }
}

async function readBlocklistState() {
  const stored = await api.storage.local.get(['settings', BLOCKLIST_APPROVAL_KEY]);
  const candidateUrl = normalizeBlocklistUrl(stored?.settings?.content?.blocklistUrl);
  const approvedUrl = normalizeBlocklistUrl(stored?.[BLOCKLIST_APPROVAL_KEY]?.url);
  const origin = permissionOrigin(approvedUrl);
  const permissionGranted = Boolean(origin) && await api.permissions.contains({ origins: [origin] });
  return {
    candidateUrl,
    approvedUrl,
    origin,
    approved: Boolean(candidateUrl && candidateUrl === approvedUrl && permissionGranted),
  };
}

async function approveBlocklist(rawUrl) {
  const url = normalizeBlocklistUrl(rawUrl);
  const stored = await api.storage.local.get(['settings', BLOCKLIST_APPROVAL_KEY]);
  const candidateUrl = normalizeBlocklistUrl(stored?.settings?.content?.blocklistUrl);
  if (!url || url !== candidateUrl) throw new Error('The configured feed changed. Reopen the popup.');
  const origin = permissionOrigin(url);
  if (!await api.permissions.contains({ origins: [origin] })) throw new Error('Origin permission was not granted.');

  const previousOrigin = permissionOrigin(stored?.[BLOCKLIST_APPROVAL_KEY]?.url);
  await api.storage.local.set({
    [BLOCKLIST_APPROVAL_KEY]: { url, origin, approvedAt: Date.now() },
  });
  if (previousOrigin && previousOrigin !== origin) {
    await api.permissions.remove({ origins: [previousOrigin] });
  }
  return { url };
}

async function revokeBlocklist() {
  const stored = await api.storage.local.get(BLOCKLIST_APPROVAL_KEY);
  const origin = permissionOrigin(stored?.[BLOCKLIST_APPROVAL_KEY]?.url);
  await api.storage.local.remove(BLOCKLIST_APPROVAL_KEY);
  if (origin) await api.permissions.remove({ origins: [origin] });
}

/**
 * Read a response, and stop reading at the limit rather than after it.
 *
 * The Content-Length precheck above is an optimisation, not a guarantee: a feed
 * can answer with chunked encoding and declare no length at all, and
 * `response.arrayBuffer()` then allocates the whole thing before anything gets
 * to object to its size. A hostile or broken feed could hand a service worker
 * an arbitrarily large buffer and be refused only afterwards.
 *
 * So the body is read chunk by chunk and the reader is cancelled as soon as the
 * running total passes the limit — no later than the first chunk that crosses
 * it. Decoding happens only once the bounded read has finished, and stays
 * fatal, so invalid UTF-8 is still an error rather than replacement characters.
 *
 * Falls back to the whole-body read when a response has no stream, which is the
 * case in some test doubles and older embeddings; the size check still applies.
 */
async function readBoundedBody(response) {
  const decode = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!response.body || typeof response.body.getReader !== 'function') {
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > BLOCKLIST_MAX_BYTES) throw new Error(BLOCKLIST_TOO_LARGE);
    return decode(body);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || !value.byteLength) continue;
      total += value.byteLength;
      if (total > BLOCKLIST_MAX_BYTES) throw new Error(BLOCKLIST_TOO_LARGE);
      chunks.push(value);
    }
  } finally {
    // Releases the connection on the refusal path as well as the success path,
    // so an endless feed is not left streaming into a cancelled request.
    try { await reader.cancel(); } catch { /* already closed */ }
  }
  const body = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.byteLength;
  }
  return decode(body);
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
      throw new Error(BLOCKLIST_TOO_LARGE);
    }
    return await readBoundedBody(response);
  } finally {
    clearTimeout(timeout);
  }
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'kick-focus:telemetry-preference') {
    if (!fromKickPage(sender)) { sendResponse({ ok: false, error: 'refused' }); return true; }
    telemetryEnabled = Boolean(message.enabled);
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === 'kick-focus:status') {
    if (!fromKickPageOrOwnUi(sender)) { sendResponse({ ok: false, error: 'refused' }); return true; }
    (async () => {
      const stored = await api.storage.local.get('settings');
      const blocklist = await readBlocklistState();
      sendResponse({
        version: api.runtime.getManifest().version,
        rulesets: ['ads', ...(telemetryEnabled ? ['telemetry'] : [])],
        blocked: blockedByTab.get(tabIdFor(message, sender)) || 0,
        countsAvailable: true,
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
    blockedByTab.delete(tabIdFor(message, sender));
    paintBadge(tabIdFor(message, sender));
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
