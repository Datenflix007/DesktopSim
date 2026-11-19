// Echtes SWI-Prolog (swipl-wasm, WebAssembly) in einem Web Worker.
// Modi: 'toplevel' (interaktives ?- wie swipl), 'goals' (swipl -g … -t halt) und 'table'
// (Abfrage einer Wissensbasis als Tabelle für das Datenbank-Studio).
import { configureIO, post, writeOut, writeErr, status, readLineSync } from './worker-io.js';

const BASE = 'https://cdn.jsdelivr.net/npm/swipl-wasm@8.2.6/dist/swipl/';
const WORK = '/home/student/work';
let swiplPromise = null;
let outBuf = [], errBuf = [];
const decoder = new TextDecoder();
const flushOut = () => {
  if (outBuf.length) { writeOut(decoder.decode(new Uint8Array(outBuf))); outBuf = []; }
  if (errBuf.length) { writeErr(decoder.decode(new Uint8Array(errBuf)).replace(/\[Thread main\] /g, '')); errBuf = []; }
};
let stdinBytes = [], stdinEOF = false;
const encoder = new TextEncoder();

function getSwipl() {
  if (!swiplPromise) {
    swiplPromise = (async () => {
      status('SWI-Prolog wird geladen (WebAssembly, einmalig ca. 4 MB) …');
      const code = await (await fetch(BASE + 'swipl-web.js')).text();
      (0, eval)(code);
      const helper = await (await fetch(new URL('prolog/ds_toplevel.pl', import.meta.url))).text();
      const swipl = await self.SWIPL({
        arguments: ['-q'],
        locateFile: f => BASE + f,
        stdout: c => { if (c === null) return; outBuf.push(c); if (c === 10 || outBuf.length > 4096) flushOut(); },
        stderr: c => { if (c === null) return; errBuf.push(c); if (c === 10 || errBuf.length > 4096) flushOut(); },
        stdin: () => {
          if (!stdinBytes.length) {
            if (stdinEOF) return null;
            flushOut();
            const line = readLineSync();
            if (line === null) { stdinEOF = true; return null; }
            stdinBytes = Array.from(encoder.encode(line));
          }
          return stdinBytes.shift();
        }
      });
      swipl.FS.mkdirTree('/lib/desktopsim');
      swipl.FS.writeFile('/lib/desktopsim/ds_toplevel.pl', helper);
      swipl.prolog.query("consult('/lib/desktopsim/ds_toplevel.pl')").once();
      status('');
      return swipl;
    })();
    swiplPromise.catch(() => { swiplPromise = null; });
  }
  return swiplPromise;
}

function resetDir(FS, dir) {
  const wipe = path => { for (const name of FS.readdir(path)) { if (name === '.' || name === '..') continue; const full = `${path}/${name}`; if (FS.isDir(FS.stat(full).mode)) { wipe(full); FS.rmdir(full); } else FS.unlink(full); } };
  try { wipe(dir); } catch { FS.mkdirTree(dir); }
}
function readTree(FS, dir, prefix = '', out = {}) {
  for (const name of FS.readdir(dir)) {
    if (name === '.' || name === '..') continue;
    const full = `${dir}/${name}`, rel = prefix + name;
    if (FS.isDir(FS.stat(full).mode)) readTree(FS, full, rel + '/', out);
    else { try { out[rel] = new TextDecoder('utf-8', { fatal: true }).decode(FS.readFile(full)); } catch { /* binär: ignorieren */ } }
  }
  return out;
}

const q = (swipl, goal, bindings) => { const r = swipl.prolog.query(goal, bindings).once(); flushOut(); return r; };
/** Prolog-Werte aus swipl-wasm (Atome, Strings, Zahlen) als Text. */
const txt = v => v === null || v === undefined ? '' : typeof v === 'object' ? (Array.isArray(v) ? v.map(txt).join(', ') : String(v.v ?? v.s ?? v.toString?.() ?? '')) : String(v);
const atom = s =>"'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

/** Eine Anfrage wie im SWI-Toplevel beantworten (mit ; für weitere Lösungen). */
function answer(swipl, text, interactive) {
  const it = swipl.prolog.query('ds_query(Q, Out, Det)', { Q: text });
  let halted = false;
  try {
    for (;;) {
      const r = it.next();
      flushOut();
      if (!r.value) { writeOut('false.\n\n'); break; }
      const out = txt(r.value.Out), det = txt(r.value.Det) === 'true' || r.done;
      if (out === '$error') { writeOut('\n'); break; }
      if (det) { writeOut(out + '.\n\n'); break; }
      if (!interactive) { writeOut(out + ' ;\n'); continue; }
      writeOut(out + ' ');
      const reply = readLineSync();
      if (reply === null) { writeOut('.\n\n'); halted = true; break; }
      const key = reply.trim();
      if (key.startsWith(';') || key === 'n' || key === 'r' || key === ' ' || key === 'v') { if (!key.startsWith(';')) writeOut(';\n'); continue; }
      writeOut('.\n\n'); break;
    }
  } finally { try { it.close?.(); } catch { /* ignore */ } }
  return halted;
}

function toplevel(swipl) {
  let buffer = '';
  for (;;) {
    writeOut(buffer ? '|    ' : '?- ');
    const line = readLineSync();
    if (line === null) { writeOut('\n'); return 0; }
    buffer += (buffer ? '\n' : '') + line.replace(/\n$/, '');
    const trimmed = buffer.replace(/%.*$/gm, '').trim();
    if (!trimmed) { buffer = ''; continue; }
    if (!/\.\s*$/.test(trimmed)) continue;
    const query = buffer; buffer = '';
    if (/^halt\s*(\(\s*\d+\s*\))?\s*\.\s*$/.test(trimmed)) return Number(trimmed.match(/\d+/)?.[0] || 0);
    if (answer(swipl, query, true)) return 0;
  }
}

self.onmessage = async ({ data }) => {
  if (data?.type !== 'run') return;
  configureIO(data);
  stdinBytes = []; stdinEOF = false;
  try {
    const swipl = await getSwipl();
    const FS = swipl.FS;
    resetDir(FS, WORK);
    for (const [rel, content] of Object.entries(data.files || {})) {
      if (typeof content !== 'string') continue;
      const full = `${WORK}/${rel}`; FS.mkdirTree(full.replace(/\/[^/]*$/, '')); FS.writeFile(full, content);
    }
    FS.chdir(WORK);
    q(swipl, "working_directory(_, '" + WORK + "/')");
    // frische Wissensbasis: alle Benutzerprädikate entfernen
    q(swipl, "forall((current_predicate(user:N/A), functor(H,N,A), \\+ sub_atom(N,0,3,_,ds_), \\+ predicate_property(user:H, imported_from(_)), \\+ predicate_property(user:H, multifile), \\+ predicate_property(user:H, thread_local), ( predicate_property(user:H, file(F)), ( sub_atom(F,0,_,_,'/home/student/work') ; sub_atom(F,0,_,_,'/tmp/ds_') ) ; predicate_property(user:H, dynamic), \\+ predicate_property(user:H, file(_)) )), catch(abolish(user:N/A), _, true))");
    const before = readTree(FS, WORK);
    let code = 0;
    if (data.mode === 'table') {
      FS.writeFile('/tmp/ds_kb.pl', data.kb || '');
      q(swipl, "ds_consult('/tmp/ds_kb.pl')");
      const preds = q(swipl, 'ds_predicates(L), format(string(S), "~w", [L])');
      let result = { names: [], rows: [] }, error = null;
      const query = String(data.query || '').trim().replace(/\.\s*$/, '');
      if (query) {
        const it = swipl.prolog.query('catch(ds_table(Q, Names, Rows), E, (ds_report(E), Names = [], Rows = "$error"))', { Q: query });
        const r = it.next(); try { it.close?.(); } catch { /* ignore */ }
        flushOut();
        const rows = r.value?.Rows;
        if (r.value && txt(rows) !== '$error') result = { names: (r.value.Names || []).map(txt), rows: (rows || []).map(row => row.map(txt)) };
        else error = 'Fehler in der Anfrage';
      }
      post('done', { code: 0, files: {}, table: result, error, predicates: txt(preds?.S) });
      return;
    }
    for (const file of data.consult || []) q(swipl, `ds_consult(${atom(file)})`);
    if (data.mode === 'goals' || data.goals?.length) {
      for (const goal of data.goals || []) {
        if (/^halt\b/.test(goal.trim())) break;
        const r = swipl.prolog.query(`catch((${goal}), E, (print_message(error, E), fail))`).once();
        flushOut();
        if (!r.success) { writeErr(`Warning: goal (${goal}) failed\n`); code = 1; break; }
      }
    }
    if (data.mode !== 'goals') {
      if (data.banner) q(swipl, "current_prolog_flag(version, V), Ma is V // 10000, Mi is V // 100 mod 100, P is V mod 100, format('Welcome to SWI-Prolog (WebAssembly, version ~w.~w.~w)~nSWI-Prolog comes with ABSOLUTELY NO WARRANTY. This is free software.~nPlease run ?- license. for legal details.~n~nFor online help and background, visit https://www.swi-prolog.org~nFor built-in help, use ?- help(Topic). or ?- apropos(Word).~n~n', [Ma, Mi, P])");
      code = toplevel(swipl);
    }
    flushOut();
    const after = readTree(FS, WORK), files = {};
    for (const [path, content] of Object.entries(after)) if (before[path] !== content) files[path] = content;
    post('done', { code, files });
  } catch (error) {
    flushOut();
    writeErr(String(error?.message || error) + '\n');
    post('done', { code: 1, files: {}, fatal: true });
  }
};
post('ready');
