/**
 * Where the userscript's bytes actually are, region by region.
 *
 * `scripts/check.mjs` enforces one number: the injected footprint against the
 * budget. That number is the cliff, and until it trips nothing says which part
 * of the build is walking toward it. A release adding 12,000 bytes of
 * dictionary and one adding 12,000 bytes of CSS look identical in the log —
 * both print one total — so growth is only ever attributed after the gate
 * fails, by hand, against a file nobody was watching.
 *
 * This measures the shipped artifact instead of the sources, because the
 * artifact is what has a ceiling: comments are gone, CSS is compacted, and the
 * data URIs are inlined, so a source-side count would describe a file nobody
 * installs.
 *
 * Regions are *derived*, never listed. A new `NAME_CSS` template becomes its
 * own region the moment it exists, which is the property that matters: a list
 * would have to be updated by the same person who just added the thing it was
 * supposed to notice.
 */

/** UTF-8 bytes. Never `String.length` — the es and pt dictionaries are ~1,450 non-ASCII characters. */
export function byteLength(value) {
  return Buffer.byteLength(String(value), 'utf8');
}

/**
 * The span of a template literal opened by `declaration`, honouring escapes.
 *
 * Returns `null` rather than guessing when the opener is absent, so a renamed
 * constant reads as a missing region instead of a silently empty one.
 */
function templateSpan(source, declaration) {
  const start = source.indexOf(declaration);
  if (start < 0) return null;
  const open = start + declaration.length;
  let index = open;
  while (index < source.length) {
    const character = source[index];
    if (character === '\\') { index += 2; continue; }
    if (character === '`') return { start, open, close: index, end: index + 1 };
    index += 1;
  }
  return null;
}

/** The span of the object literal opened by `declaration`, by brace depth. */
function objectSpan(source, declaration) {
  const start = source.indexOf(declaration);
  if (start < 0) return null;
  const open = source.indexOf('{', start);
  if (open < 0) return null;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return { start, open, close: index, end: index + 1 };
    }
  }
  return null;
}

/**
 * Every region of the built userscript, largest first, plus the remainder.
 *
 * The remainder is computed by subtraction rather than measured, so the parts
 * always sum to the whole: a region this misses cannot hide, it inflates the
 * line named `remainder` instead.
 */
export function measureRegions(userscript) {
  const source = String(userscript);
  const total = byteLength(source);
  const regions = [];

  for (const match of source.matchAll(/const ([A-Z][A-Z0-9_]*_CSS) = `/g)) {
    const span = templateSpan(source, match[0]);
    if (span) regions.push({ name: match[1], bytes: byteLength(source.slice(span.start, span.end)) });
  }

  const translations = objectSpan(source, 'const TRANSLATIONS = ');
  if (translations) {
    regions.push({ name: 'TRANSLATIONS', bytes: byteLength(source.slice(translations.start, translations.end)) });
  }

  // The two inlined assets. They are single tokens rather than declarations,
  // so they are measured where they sit.
  for (const [name, pattern] of [
    ['ICON_DATA_URI', /data:image\/png;base64,[A-Za-z0-9+/=]+/],
    ['PREVIEW_DATA_URI', /data:image\/jpeg;base64,[A-Za-z0-9+/=]+/],
  ]) {
    const found = pattern.exec(source);
    if (found) regions.push({ name, bytes: byteLength(found[0]) });
  }

  regions.sort((left, right) => right.bytes - left.bytes);
  const counted = regions.reduce((sum, region) => sum + region.bytes, 0);
  regions.push({ name: 'remainder', bytes: total - counted });
  return { total, regions };
}

/**
 * How much a region may grow before the baseline has to be updated with it.
 *
 * 4,000 bytes, against roughly 11,700 bytes of headroom below the injection
 * budget as of 2026-09-05. Small enough that two unremarked growths cannot
 * spend the remaining room, large enough that ordinary work on a feature does
 * not have to touch the baseline. Shrinking is always free.
 */
export const REGION_GROWTH_ALLOWANCE = 4000;

/**
 * Compare a measurement against the committed baseline.
 *
 * A region missing from the baseline is a finding, not a pass: that is what a
 * newly added CSS template looks like, and it is exactly the case the derived
 * region list exists to surface.
 */
export function compareToBaseline(measurement, baseline, allowance = REGION_GROWTH_ALLOWANCE) {
  const previous = new Map((baseline?.regions ?? []).map((region) => [region.name, region.bytes]));
  const failures = [];
  for (const region of measurement.regions) {
    if (!previous.has(region.name)) {
      failures.push(`${region.name} is ${region.bytes.toLocaleString('en-US')} B and is not in the baseline at all; add it in this change`);
      continue;
    }
    const grew = region.bytes - previous.get(region.name);
    if (grew > allowance) {
      failures.push(`${region.name} grew ${grew.toLocaleString('en-US')} B (${previous.get(region.name).toLocaleString('en-US')} → ${region.bytes.toLocaleString('en-US')}), past the ${allowance.toLocaleString('en-US')} B allowance; update the baseline in this change or find the bytes`);
    }
  }
  for (const name of previous.keys()) {
    if (!measurement.regions.some((region) => region.name === name)) {
      failures.push(`${name} is in the baseline but no longer in the artifact; remove it from the baseline in this change`);
    }
  }
  return failures;
}

/**
 * `node scripts/byte-report.mjs` prints the table.
 * `node scripts/byte-report.mjs --write` rewrites the baseline from it.
 *
 * The baseline is generated rather than hand-edited, because a number typed by
 * the person who just grew a region is not evidence of anything.
 */
const { readFile, writeFile } = await import('node:fs/promises');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const selfPath = fileURLToPath(import.meta.url);
// Compare resolved paths rather than building a file: URL by hand. On Windows
// the separator is a backslash, and a hand-built URL differs from the one Node
// produces, so the CLI would never run.
if (process.argv[1] && resolve(process.argv[1]) === selfPath) {
  const here = resolve(dirname(selfPath), '..');
  const artifact = resolve(here, 'dist/kick-focus.user.js');
  const measurement = measureRegions(await readFile(artifact, 'utf8'));
  const width = Math.max(...measurement.regions.map((region) => region.name.length));
  console.log(`dist/kick-focus.user.js — ${measurement.total.toLocaleString('en-US')} bytes`);
  for (const region of measurement.regions) {
    const share = ((region.bytes / measurement.total) * 100).toFixed(1);
    console.log(`  ${region.name.padEnd(width)}  ${String(region.bytes.toLocaleString('en-US')).padStart(9)} B  ${share.padStart(5)}%`);
  }
  if (process.argv.includes('--write')) {
    const baseline = { artifact: 'dist/kick-focus.user.js', total: measurement.total, regions: measurement.regions };
    await writeFile(resolve(here, 'scripts/byte-baseline.json'), `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    console.log('\nWrote scripts/byte-baseline.json');
  }
}
