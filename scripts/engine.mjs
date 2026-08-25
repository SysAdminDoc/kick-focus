/**
 * Refuse to build or verify on a Node this project does not support.
 *
 * `engines` in package.json is documentation: npm warns and carries on, and
 * nothing at all reads it when a script is run directly. So the range is
 * declared once here, checked against the running interpreter, and enforced by
 * the gates that matter.
 *
 * The range is the Node 24 LTS line. `>=24.19` on its own also admits Node 25,
 * which reached end of life without ever becoming an LTS, and Node 26, which is
 * not the target yet: the suite uses `--experimental-test-tag-filter`, an
 * experimental flag whose behaviour is allowed to change between majors, so
 * "it probably still works" is not something to find out during a release.
 *
 * Widen this deliberately, after running the suite on the new major, rather
 * than by removing the check.
 */
export const SUPPORTED_ENGINE = '>=24.19.0 <25';
const MIN = [24, 19, 0];
const MAX_MAJOR_EXCLUSIVE = 25;

function parse(version) {
  return String(version).replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
}

/** The reason this Node is unsupported, or '' when it is fine. */
export function engineComplaint(version = process.version) {
  const [major, minor, patch] = parse(version);
  if (major >= MAX_MAJOR_EXCLUSIVE) {
    return `Node ${version} is newer than this project supports (${SUPPORTED_ENGINE}). `
      + 'The suite uses an experimental test flag whose behaviour may differ on a newer major. '
      + 'Run the full suite on that version and widen scripts/engine.mjs deliberately, rather than removing this check.';
  }
  const older = major < MIN[0]
    || (major === MIN[0] && minor < MIN[1])
    || (major === MIN[0] && minor === MIN[1] && patch < MIN[2]);
  if (older) {
    return `Node ${version} is older than this project supports (${SUPPORTED_ENGINE}). Install Node 24.19 or newer in the 24 line.`;
  }
  return '';
}

/** Stop here, loudly, when the interpreter is out of range. */
export function requireSupportedEngine() {
  const complaint = engineComplaint();
  if (!complaint) return;
  console.error(complaint);
  process.exit(1);
}
