/**
 * The live assertions a release may not go out without.
 *
 * Both browser gates report three outcomes, and a skip is a legitimate answer
 * for a great deal of what they cover: a run is logged out, Kick did not issue
 * a discovery feed on the home route, the composer was not rendered. Counting
 * those as failures would make the gate red for reasons that are not defects.
 *
 * The cost of that tolerance is that a check which stops asserting for a bad
 * reason looks exactly like one that skipped for a good one. v1.38.0 shipped on
 * a run of 90 of 96 for that reason. So the checks with no legitimate reason to
 * skip are named here, and a release refuses to package when one of them is
 * anything but a pass.
 *
 * Kept in its own module, away from the process spawning and the file writes,
 * so the decision can be tested against a synthetic run rather than only
 * observed on a real one.
 */

// Every one of these describes the companion actually loading and running
// against a real Kick page. None can skip for an environmental reason: if the
// page did not render, the gate stops at "reached the real Kick page" and the
// rest fail rather than skip.
export const MANDATORY_CHROMIUM_CHECKS = Object.freeze([
  'extension loaded (its own service worker is running)',
  'service worker reports the built version',
  'ads ruleset enabled at runtime',
  'the worker enables no ruleset the manifest does not declare',
  'kick page target open',
  'exact CSS viewport applied',
  'reached the real Kick page (not a bot wall)',
  'page-world script booted',
  'companion handshake visible to page',
  'kick focus runtime active on page',
]);

export const MANDATORY_FIREFOX_CHECKS = Object.freeze([
  'Firefox WebDriver BiDi session established',
  'the unsigned Manifest V2 package installs as a temporary add-on',
  'reached the real Kick page (not a bot wall)',
  'the page bundle ran in the page world',
  'the bridge advertised the companion to the page',
  'the interface mounted',
  // The one that is the whole reason the Firefox package carries its bundle
  // inline: a moz-extension URL in the page is a per-install identifier that
  // survives clearing cookies.
  'no extension URL reaches the page, in markup or the resource timeline',
]);

/**
 * What is wrong with a run, in the order a reader wants to hear it.
 *
 * `results` is the gate's own `[{ label, outcome }]`. Returns one line per
 * problem and an empty array for a run that may be packaged. A label the run
 * never reported at all is a problem too, and a louder one than a skip: it
 * means the gate stopped early or the assertion was deleted.
 */
export function mandatoryLiveFailures(results, mandatory) {
  const seen = new Map();
  for (const entry of Array.isArray(results) ? results : []) {
    if (entry && typeof entry.label === 'string' && !seen.has(entry.label)) {
      seen.set(entry.label, entry.outcome);
    }
  }
  const problems = [];
  for (const label of mandatory) {
    if (!seen.has(label)) problems.push(`never ran: ${label}`);
    else if (seen.get(label) !== 'pass') problems.push(`${seen.get(label)}: ${label}`);
  }
  return problems;
}
