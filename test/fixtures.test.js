/**
 * The fixtures, read as documents rather than as strings.
 *
 * What this used to be: an assertion that each hand-written file contained a
 * list of substrings — a file checked against a description of itself, which
 * stayed green for months while several of those substrings returned 0 from a
 * live `querySelectorAll`. Nothing built a DOM from a fixture, so `findProbe`,
 * `compatibilitySnapshot` and the derived-value expectations were never
 * exercised offline against a realistic shell.
 *
 * Now each fixture is parsed and run through the same snapshot the runtime
 * takes on every apply cycle, and the result is compared against the probe
 * recorded in `scripts/fixture-contract.mjs` for that route — the same table
 * the live gate sweeps Kick against. So an offline failure here and a live
 * failure there mean the same thing, and a regenerated fixture proves
 * something instead of restating itself.
 *
 * The parser below is deliberately small and deliberately not a browser. It
 * covers what `LOCATOR_PROBES` actually uses: type, id, class, attribute
 * presence and `=`/`^=`/`*=` with the `i` flag, descendant and child
 * combinators, selector lists, and `:has()`. Anything richer than that belongs
 * in the live gate, which has a real engine. Zero dependencies is a project
 * rule, so no jsdom.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compatibilitySnapshot, DERIVED_EXPECTATIONS, LOCATOR_PROBES } from '../src/compatibility.mjs';
import { cardSlugFromPath, qualitySessionValue } from '../src/core.mjs';
import { FIXTURE_CONTRACT, requiredMarkers } from '../scripts/fixture-contract.mjs';

const root = resolve('test/fixtures');
const BASE = 'https://kick.com';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);
const ENTITIES = new Map([['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['#39', "'"], ['apos', "'"], ['nbsp', ' ']]);

const decode = (value) => String(value).replace(/&(#?\w+);/g, (whole, name) => ENTITIES.get(name) ?? whole);

let sequence = 0;

class Element {
  constructor(tag, attributes) {
    this.tagName = tag.toUpperCase();
    this.localName = tag;
    this.attributes = attributes;
    this.children = [];
    this.parentElement = null;
    this.text = '';
    // Document order, so query results come back in the order a browser
    // would return them rather than in whatever order the matcher walked.
    this.order = sequence += 1;
  }

  getAttribute(name) {
    const value = this.attributes.get(name.toLowerCase());
    return value === undefined ? null : value;
  }

  hasAttribute(name) {
    return this.attributes.has(name.toLowerCase());
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  get value() {
    return this.getAttribute('value') || '';
  }

  /** Resolved, like a browser's — `cardPath` reads `link.href`, not the attribute. */
  get href() {
    const raw = this.getAttribute('href');
    if (raw === null) return '';
    try {
      return new URL(raw, BASE).href;
    } catch {
      return '';
    }
  }

  get dataset() {
    const data = {};
    for (const [name, value] of this.attributes) {
      if (!name.startsWith('data-')) continue;
      data[name.slice(5).replace(/-([a-z])/g, (whole, letter) => letter.toUpperCase())] = value;
    }
    return data;
  }

  get textContent() {
    return this.text + this.children.map((child) => child.textContent).join('');
  }

  contains(node) {
    for (let walk = node; walk; walk = walk.parentElement) if (walk === this) return true;
    return false;
  }

  matches(selector) {
    return parseSelectorList(selector).some((steps) => matchesUpward(this, steps, steps.length - 1));
  }

  closest(selector) {
    for (let walk = this; walk; walk = walk.parentElement) if (walk.matches(selector)) return walk;
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const found = new Set();
    for (const steps of parseSelectorList(selector)) for (const node of runSteps([this], steps)) found.add(node);
    return [...found].sort((a, b) => a.order - b.order);
  }
}

function descendants(node, out = []) {
  for (const child of node.children) {
    out.push(child);
    descendants(child, out);
  }
  return out;
}

/* ---------------------------------------------------------------- parsing */

const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'=<>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTRIBUTE = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function attributesOf(source) {
  const attributes = new Map();
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (!attributes.has(name)) attributes.set(name, decode(value));
  }
  return attributes;
}

/** Parse a fixture and hand back its `<html>` element, which stands in for the document. */
export function parseFixture(html) {
  const source = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<!doctype[^>]*>/gi, '');
  const documentElement = new Element('html', new Map());
  const stack = [documentElement];
  let cursor = 0;
  TAG.lastIndex = 0;
  let match;
  while ((match = TAG.exec(source))) {
    const [whole, closing, rawTag, rawAttributes, selfClosing] = match;
    const parent = stack[stack.length - 1];
    const between = source.slice(cursor, match.index);
    if (between.trim()) parent.text += decode(between);
    cursor = match.index + whole.length;
    const tag = rawTag.toLowerCase();
    if (closing) {
      // Tolerate a stray close tag rather than unwinding past the root.
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].localName !== tag) continue;
        stack.length = i;
        break;
      }
      continue;
    }
    if (tag === 'html') {
      for (const [name, value] of attributesOf(rawAttributes)) documentElement.attributes.set(name, value);
      continue;
    }
    const element = new Element(tag, attributesOf(rawAttributes));
    element.parentElement = parent;
    parent.children.push(element);
    if (selfClosing || VOID_ELEMENTS.has(tag)) continue;
    if (RAW_TEXT_ELEMENTS.has(tag)) {
      // Script and style bodies are text, not markup: a `<` inside one must not
      // open an element, and the fixtures do carry scripts.
      const end = source.toLowerCase().indexOf(`</${tag}>`, cursor);
      const stop = end === -1 ? source.length : end;
      element.text = source.slice(cursor, stop);
      cursor = stop;
      TAG.lastIndex = cursor;
      continue;
    }
    stack.push(element);
  }
  return documentElement;
}

/* --------------------------------------------------------------- matching */

const selectorCache = new Map();

/** Split on a character that is not inside brackets or parentheses. */
function splitTop(source, separator) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const character of source) {
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    if (character === separator && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** One complex selector as ordered steps, each a combinator plus a compound. */
function parseComplex(source) {
  const steps = [];
  let combinator = ' ';
  let current = '';
  let depth = 0;
  const push = () => {
    if (current.trim()) steps.push({ combinator, compound: parseCompound(current.trim()) });
    current = '';
  };
  for (let i = 0; i < source.length; i += 1) {
    const character = source[i];
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    if (depth === 0 && (character === '>' || /\s/.test(character))) {
      const next = character === '>' ? '>' : ' ';
      if (current.trim()) {
        push();
        combinator = next;
      } else if (next === '>') {
        combinator = '>';
      }
      continue;
    }
    current += character;
  }
  push();
  return steps;
}

function parseSelectorList(selector) {
  const cached = selectorCache.get(selector);
  if (cached) return cached;
  const parsed = splitTop(selector, ',').map(parseComplex);
  selectorCache.set(selector, parsed);
  return parsed;
}

const ATTRIBUTE_SELECTOR = /^\[([\w-]+)(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*(i)?\]/i;

function parseCompound(source) {
  const parts = [];
  let rest = source;
  while (rest) {
    if (rest.startsWith(':has(')) {
      let depth = 0;
      let end = -1;
      for (let i = 4; i < rest.length; i += 1) {
        if (rest[i] === '(') depth += 1;
        if (rest[i] === ')') {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) throw new Error(`unbalanced :has() in ${source}`);
      parts.push({ kind: 'has', value: parseSelectorList(rest.slice(5, end)) });
      rest = rest.slice(end + 1);
      continue;
    }
    const attribute = ATTRIBUTE_SELECTOR.exec(rest);
    if (attribute) {
      parts.push({
        kind: 'attribute',
        name: attribute[1].toLowerCase(),
        operator: attribute[2] || '',
        value: attribute[3] ?? attribute[4] ?? attribute[5] ?? '',
        insensitive: Boolean(attribute[6]),
      });
      rest = rest.slice(attribute[0].length);
      continue;
    }
    const simple = /^(?:#([\w-]+)|\.([\w-]+)|([*]|[a-zA-Z][\w-]*))/.exec(rest);
    if (!simple) throw new Error(`unsupported selector fragment: ${rest} (in ${source})`);
    if (simple[1]) parts.push({ kind: 'id', value: simple[1] });
    else if (simple[2]) parts.push({ kind: 'class', value: simple[2] });
    else if (simple[3] !== '*') parts.push({ kind: 'type', value: simple[3].toLowerCase() });
    rest = rest.slice(simple[0].length);
  }
  return parts;
}

function attributeMatches(node, part) {
  const raw = node.getAttribute(part.name);
  if (raw === null) return false;
  if (!part.operator) return true;
  const actual = part.insensitive ? raw.toLowerCase() : raw;
  const wanted = part.insensitive ? part.value.toLowerCase() : part.value;
  if (part.operator === '=') return actual === wanted;
  if (part.operator === '^=') return actual.startsWith(wanted);
  if (part.operator === '$=') return actual.endsWith(wanted);
  if (part.operator === '*=') return actual.includes(wanted);
  if (part.operator === '~=') return actual.split(/\s+/).includes(wanted);
  throw new Error(`unsupported attribute operator ${part.operator}`);
}

function matchCompound(node, compound) {
  for (const part of compound) {
    if (part.kind === 'type' && node.localName !== part.value) return false;
    if (part.kind === 'id' && node.id !== part.value) return false;
    if (part.kind === 'class' && !node.className.split(/\s+/).includes(part.value)) return false;
    if (part.kind === 'attribute' && !attributeMatches(node, part)) return false;
    if (part.kind === 'has' && !part.value.some((steps) => runSteps([node], steps).length)) return false;
  }
  return true;
}

/** Walk a parsed selector left to right from a starting set, as a browser scopes `:has()`. */
function runSteps(start, steps) {
  let current = start;
  for (const step of steps) {
    const next = [];
    const seen = new Set();
    for (const node of current) {
      for (const candidate of step.combinator === '>' ? node.children : descendants(node)) {
        if (seen.has(candidate) || !matchCompound(candidate, step.compound)) continue;
        seen.add(candidate);
        next.push(candidate);
      }
    }
    current = next;
    if (!current.length) return [];
  }
  return current;
}

/** Right-to-left match with backtracking, which is what `matches()`/`closest()` need. */
function matchesUpward(node, steps, index) {
  if (!matchCompound(node, steps[index].compound)) return false;
  if (index === 0) return true;
  const combinator = steps[index].combinator;
  if (combinator === '>') {
    return Boolean(node.parentElement) && matchesUpward(node.parentElement, steps, index - 1);
  }
  for (let walk = node.parentElement; walk; walk = walk.parentElement) {
    if (matchesUpward(walk, steps, index - 1)) return true;
  }
  return false;
}

/* -------------------------------------------------------------- derivers */

/**
 * The three derivers, mirroring `compatibilityDerivers()` in `src/runtime.js`.
 *
 * They cannot be imported: `runtime.js` is concatenated into the bundle and has
 * no exports, which is the same reason `DERIVED_EXPECTATIONS` takes the deriver
 * from its caller. The pure halves (`cardSlugFromPath`, `qualitySessionValue`)
 * are the real ones out of core; only the DOM reading around them is restated.
 */
const qualityControlLabel = (control) => [...control.querySelectorAll('span')]
  .map((span) => span.textContent.trim()).filter(Boolean).join(' ');

const qualityOptionGated = (control) => {
  const label = qualityControlLabel(control);
  if (!label) return false;
  return String(control.textContent || '').replace(/\s+/g, '') !== label.replace(/\s+/g, '');
};

const DERIVERS = {
  cardSlug: (card) => {
    const link = card.matches('a[href]') ? card : card.querySelector('a[href]');
    if (!link) return '';
    const path = new URL(link.href, BASE).pathname;
    return cardSlugFromPath(path && path !== '/' ? path : '');
  },
  playerContainer: (video) => {
    const start = video.parentElement;
    if (!start) return null;
    return start.closest('[data-testid*="player" i], [data-player], [id*="player" i]') || start;
  },
  qualityHeight: (control) => (qualityOptionGated(control)
    ? 0
    : Number(qualitySessionValue(qualityControlLabel(control)))),
};

/* ----------------------------------------------------------------- tests */

const fixtureSource = (name) => readFileSync(resolve(root, `${name}.html`), 'utf8');

for (const [name, entry] of Object.entries(FIXTURE_CONTRACT)) {
  test(`fixture ${name} keeps every marker it is supposed to carry`, { tag: 'unit' }, () => {
    const html = fixtureSource(name);
    for (const marker of requiredMarkers(name)) assert.ok(html.includes(marker), `${name} fixture lost ${marker}`);
  });

  test(`fixture ${name} carries nothing Kick has stopped serving`, { tag: 'unit' }, () => {
    // The other direction, and the one that let this suite rot: a marker Kick
    // dropped stays plausible forever unless something says it is gone. Each
    // entry here was measured at 0 on the live route, with the reason recorded.
    const html = fixtureSource(name);
    for (const [marker, why] of Object.entries(entry.retired)) {
      assert.ok(!html.includes(marker), `${name} fixture still carries the retired marker ${marker} — ${why}`);
    }
  });

  if (!entry.shell) continue;

  test(`fixture ${name} resolves the shell hooks the live route resolves`, { tag: 'unit' }, () => {
    const document = parseFixture(fixtureSource(name));
    const snapshot = compatibilitySnapshot(document, { expectedChat: entry.expectedChat, derive: DERIVERS });
    assert.deepEqual(snapshot.probes, { ...entry.shell },
      `${name} fixture resolves a different probe than ${entry.url || 'the live route'} does`);
    assert.equal(snapshot.healthy, true, `${name} fixture is missing ${snapshot.missing.join(', ')}`);
    if (entry.shell.card) assert.ok(snapshot.cards > 0, `${name} fixture resolved a card probe but found no cards`);
  });

  test(`fixture ${name} still yields the values derived from those hooks`, { tag: 'unit' }, () => {
    const document = parseFixture(fixtureSource(name));
    const snapshot = compatibilitySnapshot(document, { expectedChat: entry.expectedChat, derive: DERIVERS });
    for (const result of snapshot.derived) {
      assert.equal(result.outcome, entry.derived[result.id],
        `${name}: ${result.id} came out ${result.outcome} (${result.detail}), not ${entry.derived[result.id]}`);
    }
  });
}

test('the contract names a real probe for every hook it records', { tag: 'unit' }, () => {
  const derivedIds = DERIVED_EXPECTATIONS.map((expectation) => expectation.id);
  for (const [name, entry] of Object.entries(FIXTURE_CONTRACT)) {
    if (entry.shell) {
      for (const [hook, probe] of Object.entries(entry.shell)) {
        assert.ok(LOCATOR_PROBES[hook], `${name} records hook ${hook}, which LOCATOR_PROBES does not have`);
        if (probe === null) continue;
        assert.ok(LOCATOR_PROBES[hook].some((candidate) => candidate.id === probe),
          `${name} expects ${hook} to resolve to ${probe}, which is not one of its probes`);
      }
      assert.deepEqual(Object.keys(entry.derived).sort(), [...derivedIds].sort(),
        `${name} does not record an outcome for every derived expectation`);
    }
    // A retired marker with no reason is how the next capture puts it back.
    for (const [marker, why] of Object.entries(entry.retired)) {
      assert.ok(why.length > 20, `${name} retires ${marker} without saying why`);
    }
    for (const [marker, why] of Object.entries(entry.synthetic)) {
      assert.ok(why.length > 20, `${name} calls ${marker} synthetic without saying what it is for`);
    }
  }
});

test('the fixture parser resolves the selector shapes the probes actually use', { tag: 'unit' }, () => {
  // The parser is the thing every assertion above trusts, so it is checked
  // against the selector features `LOCATOR_PROBES` relies on rather than left
  // to be validated by the fixtures it parses.
  const document = parseFixture(`<!doctype html><html lang="en"><body>
    <div data-sidebar="true"><span data-testid="sidebar-following-channel-4">a</span></div>
    <ul><li><a data-testid="sidebar-home" href="/">Home</a></li><li><span>no</span></li></ul>
    <button aria-haspopup="menu" aria-label="Open SETTINGS menu"><svg data-ds-icon="Settings"></svg></button>
    <div class="group/volume other"><button><svg data-ds-icon="SoundOn"></svg></button></div>
    <script>const markup = "<div id='not-real'></div>";</script>
    <img src="/x.png" alt="left open">
  </body></html>`);

  assert.equal(document.querySelectorAll('[data-sidebar] [data-testid^="sidebar-"]').length, 1);
  assert.equal(document.querySelectorAll('li:has(> [data-testid="sidebar-home"])').length, 1);
  assert.equal(document.querySelectorAll('button[aria-haspopup="menu"]:has(> svg[data-ds-icon="Settings"])').length, 1);
  assert.equal(document.querySelectorAll('button[aria-haspopup="menu"][aria-label*="setting" i]').length, 1);
  assert.equal(document.querySelectorAll('div[class*="group/volume"]').length, 1);
  assert.equal(document.querySelectorAll('div:has(> button > svg[data-ds-icon^="Sound"])').length, 1);
  // A `<div>` written inside a script string is text, and an unclosed void
  // element must not swallow the rest of the document.
  assert.equal(document.querySelectorAll('#not-real').length, 0);
  assert.equal(document.querySelectorAll('img[alt]').length, 1);

  const link = document.querySelector('a[href]');
  assert.equal(link.href, 'https://kick.com/');
  assert.equal(link.closest('ul').localName, 'ul');
  assert.equal(link.matches('li > a[data-testid="sidebar-home"]'), true);
  assert.equal(document.querySelector('ul').contains(link), true);
});
