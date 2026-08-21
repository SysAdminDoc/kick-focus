/**
 * Does a set of Content-Security-Policy strings still allow an inline script?
 *
 * The Firefox companion puts the page bundle into the document as an inline
 * `<script>`, deliberately: injecting it from a `moz-extension://` URL would
 * leak a per-install UUID into the page. That works only because Kick serves no
 * script policy. The live gate watches for the day it does, and this is the
 * decision behind that check.
 *
 * Three rules, and getting any of them wrong turns the gate into decoration:
 *
 *  1. **Precedence.** Within one policy the script source list is
 *     `script-src-elem` if present, else `script-src`, else `default-src`. A
 *     policy reading `default-src 'self'; script-src 'self' 'unsafe-inline'`
 *     allows inline scripts — reading the first directive that happens to
 *     appear would call it blocked.
 *  2. **Intersection.** A response may carry several enforcing policies, and
 *     content has to pass *every* one of them. One permissive policy does not
 *     rescue a restrictive sibling. `Headers.get()` joins repeated headers with
 *     a comma, and a single header may itself carry comma-separated policies,
 *     so both spellings split the same way.
 *  3. **`'unsafe-inline'` is inert next to a nonce, a hash, or
 *     `'strict-dynamic'`.** A policy carrying any of those ignores the keyword
 *     entirely, so it blocks the companion however permissive it looks.
 *
 * Report-only policies are not passed here: they enforce nothing. They are
 * worth recording as a warning that the enforcing version is coming, which is
 * the caller's job.
 */

const SCRIPT_DIRECTIVES = ['script-src-elem', 'script-src', 'default-src'];

/** Split header text into individual policies, however they were joined. */
export function splitPolicies(input) {
  return (Array.isArray(input) ? input : [input])
    .filter((value) => typeof value === 'string')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

/** The source list that governs inline scripts for one policy, or null. */
export function scriptDirective(policy) {
  const directives = new Map();
  for (const part of String(policy || '').split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const name = trimmed.split(/\s+/, 1)[0].toLowerCase();
    // First occurrence wins: a repeated directive in one policy is ignored.
    if (!directives.has(name)) directives.set(name, trimmed);
  }
  for (const name of SCRIPT_DIRECTIVES) {
    if (directives.has(name)) return directives.get(name);
  }
  return null;
}

/** Whether one directive's source list would still run an inline script. */
export function directiveAllowsInline(directive) {
  if (!directive) return true;
  const sources = directive.split(/\s+/).slice(1);
  if (!sources.some((source) => /^'unsafe-inline'$/i.test(source))) return false;
  return !sources.some((source) => /^'strict-dynamic'$/i.test(source) || /^'(nonce|sha256|sha384|sha512)-/i.test(source));
}

/**
 * The verdict across every enforcing policy on the response.
 *
 * `blockedBy` names the policies that would refuse, so a failing gate says
 * which rule to argue with rather than only that something changed.
 */
export function inlineScriptVerdict(headerText, metaPolicies = []) {
  const policies = [...splitPolicies(headerText), ...splitPolicies(metaPolicies)];
  const blockedBy = policies.filter((policy) => !directiveAllowsInline(scriptDirective(policy)));
  const governing = policies
    .map((policy) => scriptDirective(policy))
    .filter(Boolean);
  return {
    policies: policies.length,
    governing,
    blockedBy,
    allowed: blockedBy.length === 0,
  };
}
