import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineComplaint, SUPPORTED_ENGINE } from '../scripts/engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the supported Node range is the 24 LTS line, at both ends', { tag: 'unit' }, () => {
  // Inside.
  for (const version of ['v24.19.0', '24.19.0', 'v24.19.5', 'v24.20.0', 'v24.99.99']) {
    assert.equal(engineComplaint(version), '', `${version} should be supported`);
  }

  // Too old. The floor is a patch, not a major, because 24.19 is where the
  // test-tag filter this suite depends on behaves as it does.
  for (const version of ['v24.18.9', 'v24.0.0', 'v22.11.0', 'v18.0.0']) {
    const complaint = engineComplaint(version);
    assert.match(complaint, /older than this project supports/, `${version} should be refused as too old`);
    assert.ok(complaint.includes(SUPPORTED_ENGINE), 'the message does not say what is supported');
  }

  // Too new, which is the half a bare `>=24.19` never refused. Node 25 reached
  // end of life without becoming an LTS.
  for (const version of ['v25.0.0', 'v25.6.1', 'v26.0.0', 'v30.1.2']) {
    const complaint = engineComplaint(version);
    assert.match(complaint, /newer than this project supports/, `${version} should be refused as too new`);
    assert.ok(complaint.includes(SUPPORTED_ENGINE), 'the message does not say what is supported');
    // And it must say what to do rather than only that it refused.
    assert.match(complaint, /Run the full suite/);
  }
});

test('the declared engine range and the enforced one are the same range', { tag: 'unit' }, async () => {
  // package.json is what a reader and npm see; scripts/engine.mjs is what
  // actually stops a run. Two copies of a range is how one of them drifts.
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  assert.equal(manifest.engines.node, SUPPORTED_ENGINE);
});

test('the build and every gate refuse an unsupported interpreter', { tag: 'unit' }, async () => {
  // A guard nothing calls is a comment. Each of these is an entry point a
  // release actually goes through.
  for (const script of ['build.mjs', 'check.mjs', 'release-checklist.mjs']) {
    const source = await readFile(resolve(root, 'scripts', script), 'utf8');
    assert.match(source, /requireSupportedEngine\(\)/, `scripts/${script} does not check the interpreter`);
  }
});
