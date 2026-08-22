import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stripComments } from '../scripts/strip-comments.mjs';

/**
 * The stripper runs over every shipped module, so the interesting cases are the
 * ones where a comment and something that merely looks like one are the same
 * three characters. Each case below appears somewhere in `src/`.
 */

test('a comment is removed and the code around it is not', { tag: 'unit' }, () => {
  assert.equal(stripComments('const a = 1; // why\nconst b = 2;\n'), 'const a = 1;\nconst b = 2;\n');
  assert.equal(stripComments('// whole line\nconst a = 1;\n'), 'const a = 1;\n');
  assert.equal(stripComments('/**\n * prose\n */\nconst a = 1;\n'), 'const a = 1;\n');
});

test('a block comment that spanned lines leaves a line terminator behind', { tag: 'unit' }, () => {
  // Without a break, ASI would join the two statements into `const a = 1 b()`.
  assert.equal(stripComments('const a = 1\n/* note\nnote */\nb()\n'), 'const a = 1\nb()\n');
  assert.equal(stripComments('const a = 1 /* note\nnote */ b()\n'), 'const a = 1\nb()\n');
  assert.equal(stripComments('f(a /* first */, b)\n'), 'f(a  , b)\n');
});

test('generated code loses indentation while template content keeps it', { tag: 'unit' }, () => {
  assert.equal(stripComments('  const a = 1;\n\n    run(a);\n'), 'const a = 1;\nrun(a);\n');
  assert.equal(stripComments('  const view = `\n    <p>kept</p>\n  `;\n'), '  const view = `\n    <p>kept</p>\n  `;\n');
});

test('slashes inside strings and templates are content, not comments', { tag: 'unit' }, () => {
  assert.equal(stripComments("const u = 'https://kick.com/x';\n"), "const u = 'https://kick.com/x';\n");
  assert.equal(stripComments('const q = "a // b";\n'), 'const q = "a // b";\n');
  assert.equal(stripComments('const css = `a { /* keep */ color: red; }`;\n'), 'const css = `a { /* keep */ color: red; }`;\n');
  assert.equal(stripComments('const css = `\n  /* keep */\n  a { b: c }\n`;\n'), 'const css = `\n  /* keep */\n  a { b: c }\n`;\n');
});

test('template interpolation returns to code, and nesting is tracked', { tag: 'unit' }, () => {
  assert.equal(stripComments('const t = `a${ b /* drop */ }c`;\n'), 'const t = `a${ b   }c`;\n');
  assert.equal(stripComments('const t = `${ { x: 1 } } // keep`;\n'), 'const t = `${ { x: 1 } } // keep`;\n');
  assert.equal(stripComments('const t = `${ `${ x }` } // keep`;\n'), 'const t = `${ `${ x }` } // keep`;\n');
  assert.equal(stripComments('const t = `a`; // drop\n'), 'const t = `a`;\n');
});

test('a regex literal survives, including one that contains a slash', { tag: 'unit' }, () => {
  assert.equal(stripComments('const r = /https:\\/\\//; // drop\n'), 'const r = /https:\\/\\//;\n');
  assert.equal(stripComments('const r = /[/]/g;\n'), 'const r = /[/]/g;\n');
  assert.equal(stripComments('x.replace(/a/g, \'b\'); // drop\n'), "x.replace(/a/g, 'b');\n");
  assert.equal(stripComments('return /re/.test(x); // drop\n'), 'return /re/.test(x);\n');
  assert.equal(stripComments('const f = (v) => /re/.test(v);\n'), 'const f = (v) => /re/.test(v);\n');
});

test('division is not mistaken for a regex', { tag: 'unit' }, () => {
  assert.equal(stripComments('const r = a / b; // drop\n'), 'const r = a / b;\n');
  assert.equal(stripComments('const r = (a) / b / c;\n'), 'const r = (a) / b / c;\n');
  assert.equal(stripComments('const r = text.length / budget;\n'), 'const r = text.length / budget;\n');
});

test('stripping is stable, so a second pass changes nothing', { tag: 'unit' }, async () => {
  for (const name of ['src/core.mjs', 'src/api.mjs', 'src/live.mjs', 'src/multistream.mjs', 'src/storage.mjs', 'src/compatibility.mjs', 'src/runtime.js']) {
    const source = await readFile(resolve(name), 'utf8');
    const once = stripComments(source);
    assert.equal(stripComments(once), once, `${name} is not stable under a second strip`);
    assert.ok(once.length < source.length, `${name} lost nothing`);
  }
});

test('nothing a module exports is lost to the strip', { tag: 'unit' }, async () => {
  /**
   * The failure this guards against is a misread regex swallowing a quote: the
   * scanner would then believe it was inside a string for the rest of the file
   * and delete real code as if it were a comment. `node --check` on the built
   * bundle catches the syntax damage; this catches the quieter version where
   * what disappeared still parses.
   */
  for (const name of ['src/core.mjs', 'src/api.mjs', 'src/live.mjs', 'src/multistream.mjs', 'src/storage.mjs', 'src/compatibility.mjs']) {
    const source = await readFile(resolve(name), 'utf8');
    const stripped = stripComments(source);
    const declarations = [...source.matchAll(/^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm)].map((match) => match[1]);
    assert.ok(declarations.length > 0, `${name} exports nothing, so this test proves nothing`);
    for (const declaration of declarations) {
      assert.match(stripped, new RegExp(`(?:^|\\n)export\\s+(?:async\\s+)?(?:function|const|class)\\s+${declaration}\\b`), `${name} lost ${declaration}`);
    }
  }
});

test('the strip removes a fifth of the shipped sources and no more than a third', { tag: 'unit' }, async () => {
  let before = 0;
  let after = 0;
  for (const name of ['src/core.mjs', 'src/api.mjs', 'src/live.mjs', 'src/multistream.mjs', 'src/storage.mjs', 'src/compatibility.mjs', 'src/runtime.js']) {
    const source = await readFile(resolve(name), 'utf8');
    before += source.length;
    after += stripComments(source).length;
  }
  const removed = (before - after) / before;
  // A run that suddenly deletes far more than the measured comment volume is
  // the scanner losing its place, not a docs cleanup.
  assert.ok(removed > 0.15 && removed < 0.33, `strip removed ${Math.round(removed * 100)}% of the sources`);
});

test('a CSS template loses its comments and a markup template keeps its content', { tag: 'unit' }, () => {
  // Comments inside a template literal are string content, not comments, so
  // the scanner leaves them alone by default. For a stylesheet that is 12 KB
  // of developer prose shipped to every reader, against an injection ceiling
  // this build sits under by a few thousand bytes. CSS comments are inert, so
  // a NAME_CSS template is the one place it is safe to drop them.
  const source = [
    'const SITE_CSS = `',
    '  /* a note nobody reads in a generated file */',
    '  .a { color: red; }',
    '  .b { /* inline */ color: blue; }',
    '`;',
    'const SHELL_MARKUP = `',
    '  <p>/* this is content, not a comment */</p>',
    '`;',
    'const PROBE_REPORT = `',
    '  /* a page-world probe string keeps everything */',
    '`;',
  ].join('\n');
  const out = stripComments(source);

  assert.equal(out.includes('a note nobody reads'), false, 'a CSS comment must be dropped');
  assert.equal(out.includes('inline'), false, 'an inline CSS comment must be dropped too');
  assert.ok(out.includes('.a { color: red; }'), 'the rules themselves survive');
  assert.ok(out.includes('.b {  color: blue; }') || out.includes('.b { color: blue; }'),
    'a rule that had an inline comment still parses');

  assert.ok(out.includes('/* this is content, not a comment */'),
    'markup is not a stylesheet; its content is untouched');
  assert.ok(out.includes('a page-world probe string keeps everything'),
    'only NAME_CSS templates qualify');

  // Interpolation inside a CSS template returns to code, and a real comment
  // there is stripped by the ordinary rule rather than this one.
  const interpolated = stripComments('const UI_CSS = `a { b: ${/* gone */ value}; }`;');
  assert.equal(interpolated.includes('gone'), false);
  assert.match(interpolated, /\$\{\s*value\}/, 'the interpolated expression survives the strip');
});
