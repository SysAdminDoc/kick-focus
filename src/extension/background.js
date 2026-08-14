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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'kick-focus:telemetry-preference') {
    setTelemetryRuleset(Boolean(message.enabled))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === 'kick-focus:status') {
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

  if (message?.type === 'kick-focus:reset-count') {
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
