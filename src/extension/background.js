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
      sendResponse({
        version: chrome.runtime.getManifest().version,
        rulesets,
        blocked: blockedByTab.get(message.tabId) || 0,
        // Reported so the popup can show whether the counter is trustworthy:
        // onRuleMatchedDebug only exists for unpacked installs.
        countsAvailable: Boolean(chrome.declarativeNetRequest.onRuleMatchedDebug),
        settings: stored?.settings || null,
      });
    })();
    return true;
  }

  if (message?.type === 'kick-focus:fetch-blocklist') {
    if (!fromKickPage(sender)) { sendResponse({ ok: false, error: 'refused' }); return true; }
    const url = String(message.url || '');
    if (!url.startsWith('https://')) {
      sendResponse({ ok: false, error: 'HTTPS required' });
      return true;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    fetch(url, { credentials: 'omit', cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => sendResponse({ ok: true, text }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }))
      .finally(() => clearTimeout(timeout));
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
