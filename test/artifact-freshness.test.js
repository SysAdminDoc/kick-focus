import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { assertArtifactFresh, readArtifact } from '../scripts/artifact-freshness.mjs';

/**
 * A throwaway tree shaped like the repo's, with times set by hand so the test
 * does not depend on how fast the disk is.
 */
async function tree({ sourceAt, artifactAt, missing = [] }) {
  const root = await mkdtemp(join(tmpdir(), 'kf-fresh-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await mkdir(join(root, 'scripts'), { recursive: true });
  await mkdir(join(root, 'dist'), { recursive: true });
  const write = async (relative, at) => {
    await writeFile(join(root, relative), 'x', 'utf8');
    await utimes(join(root, relative), new Date(at), new Date(at));
  };
  await write('src/core.mjs', sourceAt);
  await write('scripts/build.mjs', sourceAt);
  for (const relative of ['dist/one.js', 'dist/two.js']) {
    if (missing.includes(relative)) continue;
    await write(relative, typeof artifactAt === 'object' ? artifactAt[relative] : artifactAt);
  }
  return {
    root,
    options: { root, inputs: ['src', 'scripts/build.mjs'], artifacts: ['dist/one.js', 'dist/two.js'] },
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

const T0 = '2026-08-25T10:00:00Z';
const T1 = '2026-08-25T10:00:05Z';

test('a build newer than every source is accepted', { tag: 'unit' }, async () => {
  const { options, cleanup } = await tree({ sourceAt: T0, artifactAt: T1 });
  try {
    await assertArtifactFresh(options);
    assert.equal(await readArtifact('dist/one.js', options), 'x');
  } finally {
    await cleanup();
  }
});

test('a source newer than the build is refused, and the message names both files', { tag: 'unit' }, async () => {
  const { options, cleanup } = await tree({ sourceAt: T1, artifactAt: T0 });
  try {
    await assert.rejects(
      assertArtifactFresh(options),
      (error) => error.message.includes('dist/one.js')
        && error.message.includes('src/core.mjs')
        && error.message.includes('npm run build'),
    );
    // And the guarded read refuses too, rather than handing back stale content.
    await assert.rejects(readArtifact('dist/one.js', options), /npm run build/);
  } finally {
    await cleanup();
  }
});

test('the oldest artifact decides, not the newest', { tag: 'unit' }, async () => {
  // The build writes the userscript first and the companion trees afterwards, so
  // a run that died in between leaves the companions stale while the userscript
  // looks current. Judging by the newest would call that tree fresh.
  const { options, cleanup } = await tree({
    sourceAt: '2026-08-25T10:00:03Z',
    artifactAt: { 'dist/one.js': T1, 'dist/two.js': T0 },
  });
  try {
    await assert.rejects(assertArtifactFresh(options), /dist\/two\.js is older than src\/core\.mjs/);
  } finally {
    await cleanup();
  }
});

test('a build script counts as a source, not only the sources it reads', { tag: 'unit' }, async () => {
  const { options, cleanup } = await tree({ sourceAt: T0, artifactAt: T1 });
  try {
    await assertArtifactFresh(options);
    await utimes(resolve(options.root, 'scripts/build.mjs'), new Date('2026-08-25T10:00:09Z'), new Date('2026-08-25T10:00:09Z'));
    await assert.rejects(assertArtifactFresh(options), /scripts\/build\.mjs/);
  } finally {
    await cleanup();
  }
});

test('an artifact that was never built says so instead of comparing times', { tag: 'unit' }, async () => {
  const { options, cleanup } = await tree({ sourceAt: T0, artifactAt: T1, missing: ['dist/two.js'] });
  try {
    await assert.rejects(assertArtifactFresh(options), /dist\/two\.js has not been built/);
  } finally {
    await cleanup();
  }
});

test('every build input the real build reads is one the guard watches', { tag: 'unit' }, async () => {
  // scripts/zip.mjs was missed on the first pass: build.mjs imports it, so a
  // change there changes the archives while the guard called the tree fresh.
  const build = await readArtifact('scripts/build.mjs', {
    inputs: ['scripts/build.mjs'],
    artifacts: ['scripts/build.mjs'],
  });
  const imported = [...build.matchAll(/from '\.\/([a-z-]+\.mjs)'/g)].map((match) => match[1]);
  assert.ok(imported.length >= 3, 'the import scan found nothing, so it is proving nothing');
  const guard = await readArtifact('scripts/artifact-freshness.mjs', {
    inputs: ['scripts/artifact-freshness.mjs'],
    artifacts: ['scripts/artifact-freshness.mjs'],
  });
  const watched = guard.slice(guard.indexOf('const INPUTS'), guard.indexOf('const ARTIFACTS'));
  for (const file of imported) {
    assert.ok(watched.includes(file), `scripts/${file} is a build input the freshness guard does not watch`);
  }
});

test('no test reads a built file except through the guarded reader', { tag: 'unit' }, async () => {
  // The call sites were added by hand once. This is what stops a test file
  // arriving later and reading dist/ straight, which is the shape of the
  // original defect rather than a new one.
  const dir = resolve(import.meta.dirname);
  const offenders = [];
  for (const entry of await readdir(dir)) {
    // This file's own fixtures name dist/ paths in a throwaway tree, which is
    // not a read of the real build.
    if (!entry.endsWith('.test.js') || entry === 'artifact-freshness.test.js') continue;
    const source = await readFile(join(dir, entry), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      // Naming a built path is fine; reading one without the guard is not.
      if (!line.includes('readFile(') || !line.includes('dist')) continue;
      offenders.push(`${entry}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [], 'a test reads a built file without checking it is the current build');
});
