// Terminal-Darstellung mit ANSI-Farben, Zeileneditor, Passwortmodus und Programmeingabe.
const SGR_FG = { 30: 0, 31: 1, 32: 2, 33: 3, 34: 4, 35: 5, 36: 6, 37: 7, 90: 8, 91: 9, 92: 10, 93: 11, 94: 12, 95: 13, 96: 14, 97: 15 };
const MAX_LINES = 4000;

export class TerminalView {
  constructor(root, { completions, onCancel, onEOF, onResize } = {}) {
    this.root = root; this.completions = completions; this.onCancel = onCancel; this.onEOF = onEOF;
    this.style = {}; this.history = []; this.queue = []; this.pending = null; this.busy = false;
    root.classList.add('term');
    root.innerHTML = '<div class="term-scroll" tabindex="-1"><div class="term-lines" aria-live="polite"></div><div class="term-line term-current"><span class="term-cur-text"></span><span class="term-input-wrap"><input class="term-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Terminal-Eingabe"><span class="term-caret" aria-hidden="true"></span></span></div><div class="term-status" hidden></div></div>';
    this.scrollEl = root.querySelector('.term-scroll');
    this.lines = root.querySelector('.term-lines');
    this.current = root.querySelector('.term-cur-text');
    this.inputWrap = root.querySelector('.term-input-wrap');
    this.input = root.querySelector('.term-input');
    this.statusEl = root.querySelector('.term-status');
    this.inputWrap.hidden = true;
    this.bindKeys();
    this.scrollEl.addEventListener('mouseup', () => { if (!getSelection()?.toString()) this.focus(); });
    this.resizeObserver = new ResizeObserver(() => { onResize?.(this.columns()); });
    this.resizeObserver.observe(this.scrollEl);
  }
  columns() { const probe = 8.4; return Math.max(20, Math.floor((this.scrollEl.clientWidth - 24) / (parseFloat(getComputedStyle(this.root).fontSize) * 0.6 || probe))); }
  focus() { if (!this.inputWrap.hidden) this.input.focus({ preventScroll: true }); else this.scrollEl.focus({ preventScroll: true }); }
  dispose() { this.resizeObserver.disconnect(); }

  // ---------- Ausgabe ----------
  write(text) {
    text = String(text ?? '');
    if (!text) return;
    if (text.length > 200000) text = text.slice(0, 200000) + '\n… (Ausgabe gekürzt)\n';
    const re = /\x1b\[([0-9;?]*)([A-Za-z])|\r\n|\r|\n|\x07|\x08/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) this.appendText(text.slice(last, m.index));
      last = re.lastIndex;
      const tok = m[0];
      if (tok === '\n' || tok === '\r\n') this.newline();
      else if (tok === '\r') { if (text[re.lastIndex] !== '\n') this.current.replaceChildren(); }
      else if (tok === '\x08') { const lastNode = this.current.lastChild; if (lastNode) lastNode.textContent = lastNode.textContent.slice(0, -1); }
      else if (tok === '\x07') { /* Glocke ignorieren */ }
      else this.escape(m[1], m[2]);
    }
    if (last < text.length) this.appendText(text.slice(last));
    this.scrollToEnd();
  }
  escape(params, cmd) {
    if (cmd === 'm') {
      const codes = params === '' ? [0] : params.split(';').map(Number);
      for (let i = 0; i < codes.length; i++) {
        const c = codes[i];
        if (c === 0) this.style = {};
        else if (c === 1) this.style.bold = true; else if (c === 2) this.style.dim = true; else if (c === 3) this.style.italic = true;
        else if (c === 4) this.style.underline = true; else if (c === 7) this.style.inverse = true;
        else if (c === 22) { this.style.bold = false; this.style.dim = false; } else if (c === 23) this.style.italic = false; else if (c === 24) this.style.underline = false; else if (c === 27) this.style.inverse = false;
        else if (c in SGR_FG) this.style.fg = SGR_FG[c];
        else if (c >= 40 && c <= 47) this.style.bg = c - 40; else if (c >= 100 && c <= 107) this.style.bg = c - 92;
        else if (c === 39) delete this.style.fg; else if (c === 49) delete this.style.bg;
        else if ((c === 38 || c === 48) && codes[i + 1] === 5) { const v = codes[i + 2]; this.style[c === 38 ? 'fg' : 'bg'] = v < 16 ? v : this.xterm256(v); i += 2; }
        else if ((c === 38 || c === 48) && codes[i + 1] === 2) { this.style[c === 38 ? 'fg' : 'bg'] = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`; i += 4; }
      }
    } else if (cmd === 'J' && (params === '2' || params === '3')) this.clear(true);
    else if (cmd === 'K') this.current.replaceChildren();
  }
  xterm256(v) { if (v >= 232) { const g = 8 + (v - 232) * 10; return `rgb(${g},${g},${g})`; } v -= 16; const s = [0, 95, 135, 175, 215, 255]; return `rgb(${s[Math.floor(v / 36)]},${s[Math.floor(v / 6) % 6]},${s[v % 6]})`; }
  appendText(str) {
    if (!str) return;
    const s = this.style, keys = Object.keys(s).filter(k => s[k] !== undefined && s[k] !== false);
    if (!keys.length) { const lastNode = this.current.lastChild; if (lastNode?.nodeType === 3) lastNode.data += str; else this.current.append(str); return; }
    const span = document.createElement('span');
    let fg = s.fg, bg = s.bg;
    if (s.inverse) { [fg, bg] = [bg ?? 'bg', fg ?? 'fg']; }
    const color = v => typeof v === 'number' ? `var(--ansi-${v})` : v === 'bg' ? 'var(--term-bg)' : v === 'fg' ? 'var(--term-fg)' : v;
    if (fg !== undefined) span.style.color = color(fg);
    if (bg !== undefined) span.style.backgroundColor = color(bg);
    if (s.bold) span.style.fontWeight = '700'; if (s.dim) span.style.opacity = '.7'; if (s.italic) span.style.fontStyle = 'italic'; if (s.underline) span.style.textDecoration = 'underline';
    if (s.bold && typeof s.fg === 'number' && s.fg < 8 && this.root.dataset.boldBright === 'true') span.style.color = color(s.fg + 8);
    span.textContent = str; this.current.append(span);
  }
  newline() {
    const line = document.createElement('div'); line.className = 'term-line';
    line.append(...this.current.childNodes);
    if (!line.childNodes.length) line.append('​');
    this.lines.append(line);
    if (this.lines.childElementCount > MAX_LINES) for (let i = 0; i < 200; i++) this.lines.firstElementChild?.remove();
  }
  clear(keepCurrent = false) { this.lines.replaceChildren(); if (!keepCurrent) this.current.replaceChildren(); else this.current.replaceChildren(); this.scrollToEnd(); }
  image(src) { this.newline(); const line = document.createElement('div'); line.className = 'term-line term-image'; const img = new Image(); img.src = src; img.alt = 'Grafik-Ausgabe'; img.onload = () => this.scrollToEnd(); line.append(img); this.lines.append(line); this.scrollToEnd(); }
  status(text) { this.statusEl.hidden = !text; this.statusEl.textContent = text || ''; this.scrollToEnd(); }
  scrollToEnd() { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => { this.scrollEl.scrollTop = this.scrollEl.scrollHeight; }); }
  writePrompt(parts) {
    for (const p of parts) { if (!p.cls) { this.appendText(p.text); continue; } const span = document.createElement('span'); span.className = p.cls; span.textContent = p.text; this.current.append(span); }
  }

  // ---------- Eingabe ----------
  /** Wartet auf eine Eingabezeile. opts: {prompt:[{text,cls}], password, shell} */
  readLine(opts = {}) {
    if (opts.prompt) this.writePrompt(opts.prompt);
    return new Promise(resolve => {
      this.pending = { resolve, opts, historyIndex: this.history.length, draft: '' };
      this.inputWrap.hidden = false;
      this.input.type = opts.password ? 'password' : 'text';
      this.root.classList.toggle('term-password', Boolean(opts.password));
      this.input.value = '';
      this.updateCaret();
      this.scrollToEnd();
      if (this.queue.length) { const next = this.queue.shift(); setTimeout(() => this.submit(next), 0); }
      else if (this.root.contains(document.activeElement) || document.activeElement === document.body || this.root.closest('.sim-window.active')) this.focus();
    });
  }
  submit(value) {
    const p = this.pending; if (!p) return;
    this.pending = null;
    if (!p.opts.password) this.appendText(value);
    this.newline();
    this.inputWrap.hidden = true; this.input.value = '';
    if (p.opts.shell && value.trim() && this.history.at(-1) !== value) this.history.push(value);
    p.resolve(value);
  }
  eof() { const p = this.pending; if (!p) return; this.pending = null; this.inputWrap.hidden = true; if (p.opts.shell) { this.newline(); } p.resolve(null); }
  updateCaret() { this.inputWrap.style.setProperty('--chars', String(this.pending?.opts.password ? 0 : this.input.value.length)); }
  bindKeys() {
    const input = this.input;
    input.addEventListener('input', () => this.updateCaret());
    input.addEventListener('paste', event => {
      const text = event.clipboardData?.getData('text') ?? '';
      if (!text.includes('\n')) return;
      event.preventDefault();
      const lines = (input.value.slice(0, input.selectionStart) + text + input.value.slice(input.selectionEnd)).replace(/\r/g, '').split('\n');
      const last = lines.pop();
      this.queue.push(...lines.slice(1));
      if (this.pending) this.submit(lines[0] ?? '');
      input.value = last; this.updateCaret();
    });
    this.root.addEventListener('keydown', event => {
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (ctrl && key === 'c' && !event.shiftKey) {
        if (getSelection()?.toString() && !this.pending) return;
        if (this.pending && input.selectionStart !== input.selectionEnd) return;
        event.preventDefault();
        if (this.pending?.opts.shell) { this.appendText(input.value + '^C'); this.newline(); const p = this.pending; input.value = ''; this.pending = null; this.inputWrap.hidden = true; p.resolve(''); return; }
        this.appendText((this.pending ? input.value : '') + '^C');
        this.onCancel?.();
        if (this.pending) { const p = this.pending; this.pending = null; this.inputWrap.hidden = true; this.newline(); p.resolve(null); }
        return;
      }
      if (event.target !== input) return;
      if (ctrl && key === 'd') { event.preventDefault(); if (!input.value) { if (this.pending?.opts.shell) { this.appendText('exit'); this.submit('exit'); } else this.eof(); } return; }
      if (ctrl && key === 'l') { event.preventDefault(); if (this.pending?.opts.shell) { const keep = [...this.current.childNodes]; this.lines.replaceChildren(); this.current.replaceChildren(...keep); } return; }
      if (ctrl && key === 'u') { event.preventDefault(); input.value = input.value.slice(input.selectionStart); input.setSelectionRange(0, 0); this.updateCaret(); return; }
      if (ctrl && key === 'k') { event.preventDefault(); input.value = input.value.slice(0, input.selectionStart); this.updateCaret(); return; }
      if (ctrl && key === 'w') { event.preventDefault(); const pos = input.selectionStart; const before = input.value.slice(0, pos).replace(/\S+\s*$/, ''); input.value = before + input.value.slice(pos); input.setSelectionRange(before.length, before.length); this.updateCaret(); return; }
      if (ctrl && key === 'a') { event.preventDefault(); input.setSelectionRange(0, 0); return; }
      if (ctrl && key === 'e') { event.preventDefault(); input.setSelectionRange(input.value.length, input.value.length); return; }
      if (event.key === 'Enter') { event.preventDefault(); if (this.pending) this.submit(input.value); return; }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (!this.pending || this.pending.opts.password) return;
        event.preventDefault();
        const p = this.pending; if (p.historyIndex === this.history.length) p.draft = input.value;
        p.historyIndex = Math.max(0, Math.min(this.history.length, p.historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
        input.value = p.historyIndex === this.history.length ? p.draft : this.history[p.historyIndex];
        requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length)); this.updateCaret(); return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        if (!this.pending?.opts.shell || !this.completions) return;
        const before = input.value.slice(0, input.selectionStart), after = input.value.slice(input.selectionStart);
        const options = this.completions(before);
        const word = before.match(/[^\s"]*$/)[0], base = before.slice(0, before.length - word.length);
        const quote = s => /\s/.test(s) ? `"${s}"` : s;
        if (options.length === 1) {
          const done = base + quote(options[0]) + (/[\\/]$/.test(options[0]) ? '' : ' ');
          input.value = done + after; input.setSelectionRange(done.length, done.length);
        } else if (options.length > 1) {
          const common = options.reduce((acc, o) => { let i = 0; while (i < acc.length && i < o.length && acc[i].toLowerCase() === o[i].toLowerCase()) i++; return acc.slice(0, i); });
          if (common.length > word.length) { input.value = base + common + after; }
          else if (this.lastTab === before) { const p = this.pending; const keep = input.value; this.appendText(keep); this.newline(); this.write(options.slice(0, 120).map(o => o.split(/[\\/]/).filter(Boolean).pop() + (/[\\/]$/.test(o) ? '/' : '')).join('  ') + '\n'); this.pending = p; this.writePrompt(p.opts.prompt || []); input.value = keep; }
          this.lastTab = before;
        }
        this.updateCaret(); return;
      }
      this.lastTab = null;
    });
  }
}
