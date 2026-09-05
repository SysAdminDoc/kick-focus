/**
 * Remove JavaScript comments from a module's source text.
 *
 * The userscript ships as one injected file, and Violentmonkey's Alternative
 * page mode stops giving it a real `document-start` somewhere around a
 * megabyte. Comments are 21% of the bundled sources, and they are worth more in
 * `src/` — where somebody reads them — than in a generated artifact nobody
 * edits. So the prose stays in the tree and the build drops it.
 *
 * This is a scanner, not a pattern match: a `//` inside a string, a block
 * comment opener inside a template literal's CSS, and a regex literal holding
 * an escaped slash all look exactly like comments to a regex. It tracks four
 * contexts — code, quoted string, template literal (including `${}`
 * interpolation nesting), and regex literal (including character classes) — and
 * strips only in the first.
 *
 * Two details that are behaviour rather than tidiness:
 *
 * - a block comment becomes a newline when it spanned lines and a space when it
 *   did not, because a multi-line comment counts as a line terminator for
 *   automatic semicolon insertion and collapsing it to nothing could join two
 *   statements;
 * - a line whose only content was a comment is dropped rather than left blank,
 *   which is another ~5 KB across the bundle.
 * - indentation and blank lines in code are dropped too. Template content keeps
 *   its whitespace, while generated JavaScript gets the space back for features.
 */

const IDENTIFIER_START = /[A-Za-z_$]/;
const IDENTIFIER_PART = /[\w$]/;

/**
 * Keywords after which a `/` opens a regex rather than dividing.
 *
 * Everything else is decided by the last significant character: an identifier,
 * a number, or a closing bracket means the `/` divides, and any operator or
 * opening bracket means it opens a regex.
 */
const REGEX_AFTER_KEYWORD = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete',
  'void', 'throw', 'case', 'do', 'else', 'yield', 'await',
]);

export function stripComments(source) {
  const lines = [];
  const frames = [{ mode: 'code', braces: 0 }];
  let line = '';
  let literalLine = false;
  let hadComment = false;
  let lastChar = '';
  let lastWord = '';
  let index = 0;

  const inCode = () => frames[frames.length - 1].mode === 'code';

  const emit = (text) => {
    for (const character of text) {
      if (character === '\n') {
        if (!inCode()) literalLine = true;
        if (inCode()) line = literalLine ? line.replace(/[ \t]+$/, '') : line.trim();
        if (line || literalLine) lines.push(line);
        line = '';
        literalLine = false;
        hadComment = false;
        continue;
      }
      if (!inCode()) literalLine = true;
      line += character;
    }
  };

  const scanQuoted = (quote) => {
    let cursor = index + 1;
    while (cursor < source.length) {
      const character = source[cursor];
      if (character === '\\') { cursor += 2; continue; }
      cursor += 1;
      if (character === quote) break;
    }
    return cursor;
  };

  const scanRegex = () => {
    let cursor = index + 1;
    let inClass = false;
    while (cursor < source.length) {
      const character = source[cursor];
      if (character === '\\') { cursor += 2; continue; }
      if (character === '\n') break;
      cursor += 1;
      if (character === '[') inClass = true;
      else if (character === ']') inClass = false;
      else if (character === '/' && !inClass) break;
    }
    while (cursor < source.length && IDENTIFIER_PART.test(source[cursor])) cursor += 1;
    return cursor;
  };

  const opensRegex = () => {
    if (!lastChar) return true;
    if (lastWord) return REGEX_AFTER_KEYWORD.has(lastWord);
    return !/[)\]}]/.test(lastChar) && !IDENTIFIER_PART.test(lastChar);
  };

  while (index < source.length) {
    const frame = frames[frames.length - 1];
    const character = source[index];

    if (frame.mode === 'template') {
      if (character === '\\') { emit(source.slice(index, index + 2)); index += 2; continue; }
      // A CSS template is the one kind of template literal whose block comments
      // are safe to drop: they are inert to the parser and nobody reads a
      // stylesheet out of a generated artifact. They are not cheap either —
      // about 12 KB across the bundle, against an injection ceiling this build
      // sits a few hundred bytes under. Only `NAME_CSS = ` templates qualify,
      // so markup and page-world probe strings, where `/*` can be content, are
      // untouched. Assets are substituted after this pass, so a base64 payload
      // holding `/*` is never in scope here.
      if (frame.css && character === '/' && source[index + 1] === '*') {
        const end = source.indexOf('*/', index + 2);
        const stop = end === -1 ? source.length : end + 2;
        const spanned = source.slice(index, stop).includes('\n');
        index = stop;
        hadComment = true;
        if (spanned) { line = line.replace(/[ \t]+$/, ''); emit('\n'); }
        continue;
      }
      if (character === '`') { frames.pop(); emit(character); index += 1; lastChar = '`'; lastWord = ''; continue; }
      if (character === '$' && source[index + 1] === '{') {
        frames.push({ mode: 'code', braces: 0 });
        emit('${');
        index += 2;
        lastChar = '{';
        lastWord = '';
        continue;
      }
      emit(character);
      index += 1;
      continue;
    }

    if (character === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      line = line.replace(/[ \t]+$/, '');
      hadComment = true;
      continue;
    }

    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      const spanned = source.slice(index, stop).includes('\n');
      const lineEnd = source.indexOf('\n', stop);
      const codeFollowsOnThisLine = source.slice(stop, lineEnd === -1 ? source.length : lineEnd).trim() !== '';
      index = stop;
      hadComment = true;
      // A comment that crossed lines has to leave a line terminator behind, or
      // ASI could join the statements it separated. When nothing but the
      // newline follows it, that newline is already the terminator.
      if (spanned && codeFollowsOnThisLine) { line = line.replace(/[ \t]+$/, ''); emit('\n'); } else if (!spanned) emit(' ');
      continue;
    }

    if (character === '"' || character === "'") {
      const end = scanQuoted(character);
      emit(source.slice(index, end));
      index = end;
      lastChar = character;
      lastWord = '';
      continue;
    }

    if (character === '`') {
      // Read the declaration name straight out of the source rather than from
      // `lastWord`, which the `=` between them has already cleared.
      const declaration = /([A-Za-z_$][\w$]*)\s*=\s*$/.exec(source.slice(Math.max(0, index - 64), index));
      frames.push({ mode: 'template', css: Boolean(declaration && declaration[1].endsWith('_CSS')) });
      emit(character);
      index += 1;
      continue;
    }

    if (character === '/' && opensRegex()) {
      const end = scanRegex();
      emit(source.slice(index, end));
      index = end;
      lastChar = '/';
      lastWord = '';
      continue;
    }

    if (IDENTIFIER_START.test(character)) {
      let end = index;
      while (end < source.length && IDENTIFIER_PART.test(source[end])) end += 1;
      const word = source.slice(index, end);
      emit(word);
      index = end;
      lastChar = word[word.length - 1];
      lastWord = word;
      continue;
    }

    if (character === '{') frame.braces += 1;
    else if (character === '}') {
      if (frame.braces > 0) frame.braces -= 1;
      else if (frames.length > 1) {
        frames.pop();
        emit('}');
        index += 1;
        lastChar = '}';
        lastWord = '';
        continue;
      }
    }

    emit(character);
    index += 1;
    if (!/\s/.test(character)) { lastChar = character; lastWord = ''; }
  }

  if (inCode() && !literalLine) line = line.trim();
  lines.push(line);
  return lines.join('\n');
}

/**
 * Collapse generated stylesheet templates without touching markup templates.
 *
 * The source stays readable. Only NAME_CSS template literals qualify, using
 * the same declaration rule as the comment scanner above. CSS strings and
 * JavaScript interpolations are copied exactly, since whitespace can be data
 * in either one.
 */
export function compactCssTemplates(source) {
  const compactCss = (css) => {
    let output = '';
    let pendingSpace = false;
    let quote = '';

    const interpolationEnd = (start) => {
      let depth = 1;
      let cursor = start + 2;
      let string = '';
      while (cursor < css.length && depth > 0) {
        const character = css[cursor];
        if (string) {
          if (character === '\\') cursor += 2;
          else {
            if (character === string) string = '';
            cursor += 1;
          }
          continue;
        }
        if (character === '"' || character === "'" || character === '`') {
          string = character;
          cursor += 1;
          continue;
        }
        if (character === '{') depth += 1;
        else if (character === '}') depth -= 1;
        cursor += 1;
      }
      return cursor;
    };

    const trimBefore = new Set(['{', '}', ';', ',', '>', '~', '=', '!', ')', ']']);
    const trimAfter = new Set(['{', '}', ';', ',', '>', '~', '=', ':', '(', '[']);
    for (let index = 0; index < css.length; index += 1) {
      const character = css[index];
      if (quote) {
        output += character;
        if (character === '\\' && index + 1 < css.length) output += css[++index];
        else if (character === quote) quote = '';
        continue;
      }
      if (character === '"' || character === "'") {
        if (pendingSpace && output && !trimAfter.has(output.at(-1))) output += ' ';
        pendingSpace = false;
        quote = character;
        output += character;
        continue;
      }
      if (character === '$' && css[index + 1] === '{') {
        if (pendingSpace && output && !trimAfter.has(output.at(-1))) output += ' ';
        pendingSpace = false;
        const end = interpolationEnd(index);
        output += css.slice(index, end);
        index = end - 1;
        continue;
      }
      if (/\s/.test(character)) {
        pendingSpace = true;
        continue;
      }
      if (trimBefore.has(character)) {
        output = output.replace(/\s+$/, '');
        pendingSpace = false;
      } else if (pendingSpace && output && !trimAfter.has(output.at(-1))) {
        output += ' ';
        pendingSpace = false;
      } else {
        pendingSpace = false;
      }
      output += character;
    }
    return output.trim().replace(/;}/g, '}');
  };

  return source.replace(
    /(\b(?:const|let|var)\s+[A-Za-z_$][\w$]*_CSS\s*=\s*`)([\s\S]*?)(`)/g,
    (_, open, css, close) => `${open}${compactCss(css)}${close}`,
  );
}
