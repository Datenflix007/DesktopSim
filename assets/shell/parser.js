// Shell-Parser für Bash/Zsh/sh, CMD und PowerShell (bewusster, aber realistischer Teilumfang).
// Wörter bestehen aus Teilen {t, q}: q = 'none' | 'single' | 'double' | 'cmdsub' | 'arith' | 'block'.

export function dialectFor(shell) {
  if (shell === 'cmd') return { kind: 'cmd', escape: '^', singleQuotes: false, comments: false, keywords: false };
  if (shell === 'powershell') return { kind: 'ps', escape: '`', singleQuotes: true, comments: true, keywords: false };
  return { kind: 'unix', escape: '\\', singleQuotes: true, comments: true, keywords: true };
}

export class ParseError extends Error {}

function readBalanced(src, start, open, close) {
  let depth = 0, quote = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === '\\' && quote === '"') { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (src.startsWith(open, i)) { depth++; i += open.length - 1; continue; }
    if (c === close) { depth--; if (depth === 0) return i; }
  }
  throw new ParseError(`Unerwartetes Dateiende: '${close}' fehlt`);
}

export function tokenize(src, dialect) {
  const tokens = [];
  let parts = [], buf = '', started = false;
  const pushBuf = (q = 'none') => { if (buf) { parts.push({ t: buf, q }); buf = ''; } };
  const endWord = () => { pushBuf(); if (started) tokens.push({ type: 'word', parts }); parts = []; started = false; };
  const op = v => { endWord(); tokens.push({ type: 'op', v }); };
  const unix = dialect.kind === 'unix', cmd = dialect.kind === 'cmd', ps = dialect.kind === 'ps';
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === dialect.escape && i + 1 < src.length) {
      if (n === '\n') { i++; continue; }
      if (ps) { const map = { n: '\n', t: '\t', '`': '`', '"': '"', '$': '$' }; buf += map[n] ?? n; }
      else buf += n;
      started = true; i++; continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') { endWord(); continue; }
    if (c === '\n') { op('\n'); continue; }
    if (dialect.comments && c === '#' && !started) { while (i < src.length && src[i] !== '\n') i++; i--; continue; }
    if (c === '|') { if (n === '|') { op('||'); i++; } else op('|'); continue; }
    if (c === '&') {
      if (n === '&') { op('&&'); i++; continue; }
      if (n === '>' && unix) { op('&>'); i++; continue; }
      if (cmd) { op(';'); continue; }
      if (unix) { op('&'); continue; }
    }
    if (c === ';' && !cmd) { op(';'); continue; }
    if (c === '>' || c === '<' || ((c === '2' || c === '1') && n === '>' && !started)) {
      if (c === '<') { op('<'); continue; }
      let fd = '';
      if (c === '2' || c === '1') { fd = c === '2' ? '2' : ''; i++; }
      const append = src[i + 1] === '>';
      if (append) i++;
      if (src[i + 1] === '&' && /[12]/.test(src[i + 2] || '')) { op(fd === '2' ? '2>&1' : '>&2'); i += 2; continue; }
      op(fd + (append ? '>>' : '>')); continue;
    }
    if (c === "'" && dialect.singleQuotes) {
      pushBuf(); const end = src.indexOf("'", i + 1);
      if (end < 0) throw new ParseError("Unerwartetes Dateiende bei der Suche nach passendem »'«");
      parts.push({ t: src.slice(i + 1, end), q: 'single' }); started = true; i = end; continue;
    }
    if (c === '"') {
      pushBuf(); let j = i + 1, text = '';
      for (; j < src.length; j++) {
        const d = src[j];
        if (d === '"') break;
        if (unix && d === '\\' && /["\\$`\n]/.test(src[j + 1] || '')) { text += src[++j]; continue; }
        if (ps && d === '`' && j + 1 < src.length) { const m = { n: '\n', t: '\t' }; text += m[src[j + 1]] ?? src[j + 1]; j++; continue; }
        if ((unix || ps) && d === '$' && src[j + 1] === '(') { const end = readBalanced(src, j + 1, '(', ')'); text += src.slice(j, end + 1); j = end; continue; }
        text += d;
      }
      if (j >= src.length) throw new ParseError('Unerwartetes Dateiende bei der Suche nach passendem »"«');
      parts.push({ t: text, q: 'double' }); started = true; i = j; continue;
    }
    if (unix && c === '$' && n === '(' && src[i + 2] === '(') {
      pushBuf(); const end = src.indexOf('))', i + 3); if (end < 0) throw new ParseError('$(( ohne ))');
      parts.push({ t: src.slice(i + 3, end), q: 'arith' }); started = true; i = end + 1; continue;
    }
    if ((unix || ps) && c === '$' && n === '(') {
      pushBuf(); const end = readBalanced(src, i + 1, '(', ')');
      parts.push({ t: src.slice(i + 2, end), q: 'cmdsub' }); started = true; i = end; continue;
    }
    if (unix && c === '`') {
      pushBuf(); const end = src.indexOf('`', i + 1); if (end < 0) throw new ParseError('Unerwartetes Dateiende: ` fehlt');
      parts.push({ t: src.slice(i + 1, end), q: 'cmdsub' }); started = true; i = end; continue;
    }
    if (ps && c === '{') {
      pushBuf(); const end = readBalanced(src, i, '{', '}');
      parts.push({ t: src.slice(i + 1, end), q: 'block' }); started = true; i = end; continue;
    }
    if (unix && c === '$' && n === '{') {
      const end = src.indexOf('}', i); if (end < 0) throw new ParseError('${ ohne }');
      buf += src.slice(i, end + 1); started = true; i = end; continue;
    }
    buf += c; started = true;
  }
  endWord();
  return tokens;
}

const KEYWORDS = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'until']);
export const wordText = w => w.parts.map(p => p.t).join('');
const isKeyword = (tok, kw) => tok?.type === 'word' && tok.parts.length === 1 && tok.parts[0].q === 'none' && tok.parts[0].t === kw;

export function parse(src, dialect) {
  const tokens = tokenize(src, dialect);
  let pos = 0;
  const peek = () => tokens[pos];
  const isSep = t => t?.type === 'op' && (t.v === ';' || t.v === '\n' || t.v === '&');
  const skipSeps = () => { while (isSep(peek())) pos++; };
  const expectKw = kw => { skipSeps(); if (!isKeyword(peek(), kw)) throw new ParseError(`Syntaxfehler: »${kw}« erwartet${peek() ? ` statt »${peek().type === 'op' ? peek().v : wordText(peek())}«` : ' (Dateiende)'}`); pos++; };

  function parseList(stops = []) {
    const items = [];
    skipSeps();
    while (pos < tokens.length) {
      if (dialect.keywords && stops.some(s => isKeyword(peek(), s))) break;
      const andor = parseAndOr(stops);
      const sep = peek();
      items.push({ andor, background: sep?.type === 'op' && sep.v === '&' });
      if (isSep(sep)) skipSeps(); else if (pos < tokens.length && !(dialect.keywords && stops.some(s => isKeyword(peek(), s)))) throw new ParseError(`Syntaxfehler in der Nähe von »${sep.type === 'op' ? sep.v : wordText(sep)}«`);
    }
    return { type: 'list', items };
  }
  function parseAndOr(stops) {
    const first = parsePipeline(stops), rest = [];
    while (peek()?.type === 'op' && (peek().v === '&&' || peek().v === '||')) {
      const op = tokens[pos++].v;
      while (peek()?.type === 'op' && peek().v === '\n') pos++;
      rest.push({ op, pipeline: parsePipeline(stops) });
    }
    return { first, rest };
  }
  function parsePipeline(stops) {
    let bang = false;
    if (dialect.kind === 'unix' && isKeyword(peek(), '!')) { bang = true; pos++; }
    const cmds = [parseCommand(stops)];
    while (peek()?.type === 'op' && peek().v === '|') { pos++; while (peek()?.type === 'op' && peek().v === '\n') pos++; cmds.push(parseCommand(stops)); }
    return { cmds, bang };
  }
  function parseCommand(stops) {
    const t = peek();
    if (dialect.keywords && t?.type === 'word') {
      if (isKeyword(t, 'if')) {
        pos++; const clauses = []; let elseBody = null;
        const cond = parseList(['then']); expectKw('then'); const body = parseList(['elif', 'else', 'fi']); clauses.push({ cond, body });
        while (isKeyword(peek(), 'elif')) { pos++; const c = parseList(['then']); expectKw('then'); clauses.push({ cond: c, body: parseList(['elif', 'else', 'fi']) }); }
        if (isKeyword(peek(), 'else')) { pos++; elseBody = parseList(['fi']); }
        expectKw('fi'); return { type: 'if', clauses, elseBody, redirs: parseRedirs() };
      }
      if (isKeyword(t, 'for')) {
        pos++; const v = peek(); if (v?.type !== 'word') throw new ParseError('Syntaxfehler: Variablenname nach »for« erwartet'); pos++;
        const items = [];
        if (isKeyword(peek(), 'in')) { pos++; while (peek()?.type === 'word' && !isKeyword(peek(), 'do')) items.push(tokens[pos++]); }
        expectKw('do'); const body = parseList(['done']); expectKw('done');
        return { type: 'for', name: wordText(v), items, body, redirs: parseRedirs() };
      }
      if (isKeyword(t, 'while') || isKeyword(t, 'until')) {
        const until = isKeyword(t, 'until'); pos++;
        const cond = parseList(['do']); expectKw('do'); const body = parseList(['done']); expectKw('done');
        return { type: 'while', until, cond, body, redirs: parseRedirs() };
      }
      if (['then', 'elif', 'else', 'fi', 'do', 'done'].some(k => isKeyword(t, k))) throw new ParseError(`Syntaxfehler beim unerwarteten Symbol »${wordText(t)}«`);
    }
    const words = [], redirs = [];
    while (pos < tokens.length) {
      const tok = peek();
      if (tok.type === 'op') {
        if (['>', '>>', '<', '2>', '2>>', '&>'].includes(tok.v)) { pos++; const target = peek(); if (target?.type !== 'word') throw new ParseError(`Syntaxfehler beim unerwarteten Symbol »${target?.v ?? 'newline'}«`); pos++; redirs.push({ op: tok.v, target }); continue; }
        if (tok.v === '2>&1' || tok.v === '>&2') { pos++; redirs.push({ op: tok.v }); continue; }
        break;
      }
      if (dialect.keywords && words.length === 0 && stops.some(s => isKeyword(tok, s))) break;
      words.push(tok); pos++;
    }
    if (!words.length && !redirs.length) throw new ParseError(`Syntaxfehler beim unerwarteten Symbol »${peek()?.type === 'op' ? peek().v : 'newline'}«`);
    return { type: 'simple', words, redirs };
  }
  function parseRedirs() {
    const redirs = [];
    while (peek()?.type === 'op' && ['>', '>>', '<', '2>', '2>>', '&>'].includes(peek().v)) { const op = tokens[pos++].v; redirs.push({ op, target: tokens[pos++] }); }
    return redirs;
  }
  const list = parseList([]);
  if (pos < tokens.length) throw new ParseError(`Syntaxfehler beim unerwarteten Symbol »${wordText(peek()) || peek().v}«`);
  return list;
}

/** Glob-Muster (*, ?, [abc]) in einen regulären Ausdruck übersetzen. */
export function globToRegExp(pattern, insensitive = false) {
  let rx = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') rx += '[^/]*';
    else if (c === '?') rx += '[^/]';
    else if (c === '[') { const end = pattern.indexOf(']', i + 1); if (end > i) { rx += '[' + pattern.slice(i + 1, end).replace(/^!/, '^').replace(/\\/g, '\\\\') + ']'; i = end; } else rx += '\\['; }
    else rx += c.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return new RegExp('^' + rx + '$', insensitive ? 'i' : '');
}
export const hasGlob = s => /[*?]|\[[^\]]+\]/.test(s);
