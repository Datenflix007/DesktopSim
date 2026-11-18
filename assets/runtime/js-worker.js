// Echte JavaScript-Ausführung (V8/SpiderMonkey des Browsers) mit einer kleinen Node.js-kompatiblen Umgebung.
import { configureIO, post, writeOut, writeErr, readLineSync } from './worker-io.js';

const inspect = (value, depth = 0, seen = new WeakSet()) => {
  if (typeof value === 'string') return depth ? `'${value}'` : value;
  if (typeof value === 'bigint') return value + 'n';
  if (typeof value === 'function') return `[Function: ${value.name || '(anonymous)'}]`;
  if (typeof value === 'symbol' || value === undefined || value === null || typeof value !== 'object') return String(value);
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (seen.has(value)) return '[Circular *1]';
  if (depth > 2) return Array.isArray(value) ? '[Array]' : '[Object]';
  seen.add(value);
  if (Array.isArray(value)) {
    const items = value.slice(0, 100).map(v => inspect(v, depth + 1, seen));
    if (value.length > 100) items.push(`... ${value.length - 100} more items`);
    const flat = `[ ${items.join(', ')} ]`;
    return value.length ? (flat.length > 72 ? `[\n${items.map(i => '  '.repeat(depth + 1) + i).join(',\n')}\n${'  '.repeat(depth)}]` : flat) : '[]';
  }
  if (value instanceof Map) return `Map(${value.size}) { ${[...value].map(([k, v]) => `${inspect(k, depth + 1, seen)} => ${inspect(v, depth + 1, seen)}`).join(', ')} }`;
  if (value instanceof Set) return `Set(${value.size}) { ${[...value].map(v => inspect(v, depth + 1, seen)).join(', ')} }`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return String(value);
  const entries = Object.entries(value).map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`}: ${inspect(v, depth + 1, seen)}`);
  const name = value.constructor && value.constructor !== Object ? value.constructor.name + ' ' : '';
  if (!entries.length) return name + '{}';
  const flat = `${name}{ ${entries.join(', ')} }`;
  return flat.length > 72 ? `${name}{\n${entries.map(e => '  '.repeat(depth + 1) + e).join(',\n')}\n${'  '.repeat(depth)}}` : flat;
};
const format = (...args) => {
  if (typeof args[0] === 'string' && /%[sdifjoOc%]/.test(args[0])) {
    let fmt = args.shift();
    fmt = fmt.replace(/%([sdifjoOc%])/g, (m, k) => {
      if (k === '%') return '%';
      if (!args.length) return m;
      const v = args.shift();
      return k === 's' ? String(v) : k === 'd' || k === 'i' ? String(parseInt(v)) : k === 'f' ? String(parseFloat(v)) : k === 'j' ? JSON.stringify(v) : k === 'c' ? '' : inspect(v, 1);
    });
    args.unshift(fmt);
  }
  return args.map(a => inspect(a)).join(' ');
};

function createFS(files) {
  const store = new Map(Object.entries(files || {}).map(([k, v]) => [norm(k), String(v)]));
  const dirs = new Set(['']);
  for (const key of store.keys()) { const parts = key.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/')); }
  function norm(p) { const out = []; for (const s of String(p).replace(/\\/g, '/').replace(/^\.\//, '').split('/')) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); } return out.join('/'); }
  const enoent = (op, p) => Object.assign(new Error(`ENOENT: no such file or directory, ${op} '${p}'`), { code: 'ENOENT' });
  const fs = {
    existsSync: p => store.has(norm(p)) || dirs.has(norm(p)),
    readFileSync: (p, enc) => { const k = norm(p); if (!store.has(k)) throw enoent('open', p); return store.get(k); },
    writeFileSync: (p, data) => { store.set(norm(p), String(data)); fs.__changed.add(norm(p)); },
    appendFileSync: (p, data) => { const k = norm(p); store.set(k, (store.get(k) || '') + String(data)); fs.__changed.add(k); },
    readdirSync: p => { const k = norm(p), pre = k ? k + '/' : ''; const names = new Set(); for (const key of [...store.keys(), ...dirs]) if (key.startsWith(pre) && key !== k) names.add(key.slice(pre.length).split('/')[0]); if (!dirs.has(k)) throw enoent('scandir', p); return [...names].filter(Boolean).sort(); },
    mkdirSync: p => { dirs.add(norm(p)); },
    unlinkSync: p => { const k = norm(p); if (!store.delete(k)) throw enoent('unlink', p); },
    statSync: p => { const k = norm(p); if (store.has(k)) return { isFile: () => true, isDirectory: () => false, size: store.get(k).length }; if (dirs.has(k)) return { isFile: () => false, isDirectory: () => true, size: 0 }; throw enoent('stat', p); },
    __changed: new Set(), __store: store
  };
  fs.promises = Object.fromEntries(['readFile', 'writeFile', 'appendFile', 'readdir', 'mkdir', 'unlink', 'stat'].map(n => [n, async (...a) => fs[n + 'Sync'](...a)]));
  for (const n of ['readFile', 'writeFile', 'appendFile', 'readdir', 'mkdir', 'unlink', 'stat']) fs[n] = (...a) => { const cb = typeof a.at(-1) === 'function' ? a.pop() : () => {}; try { const r = fs[n + 'Sync'](...a); setTimeout(() => cb(null, r)); } catch (e) { setTimeout(() => cb(e)); } };
  return fs;
}

self.onmessage = async ({ data }) => {
  if (data?.type !== 'run') return;
  configureIO(data);
  const fs = createFS(data.files);
  let pending = 0, exitCode = 0, finished = false;
  const finish = code => { if (finished) return; finished = true; const files = {}; for (const k of fs.__changed) if (fs.__store.has(k)) files[k] = fs.__store.get(k); post('done', { code, files }); };
  class ExitSignal { constructor(code) { this.code = code; } }
  const timers = new Map();
  const wrapTimer = (fn, repeat) => (cb, ms, ...args) => {
    pending++;
    const id = fn(() => { try { cb(...args); } catch (e) { report(e); } finally { if (!repeat) { timers.delete(id); pending--; settle(); } } }, ms);
    timers.set(id, true); return id;
  };
  const clearTimer = id => { if (timers.delete(id)) { clearTimeout(id); clearInterval(id); pending--; settle(); } };
  const report = error => {
    if (error instanceof ExitSignal) { exitCode = error.code; finish(exitCode); return; }
    const stack = String(error?.stack || error).split('\n').filter(l => !/js-worker\.js|worker-io\.js/.test(l)).join('\n').replace(/blob:[^\s)]+|eval at[^)]*\)/g, data.entry || 'main.js');
    writeErr(`${stack.startsWith(String(error?.name)) ? '' : 'Uncaught '}${stack}\n`); exitCode = 1;
  };
  let settleTimer = null;
  const settle = () => { clearTimeout(settleTimer); settleTimer = setTimeout(() => { if (pending <= 0) finish(exitCode); }, 30); };

  const out = (...a) => writeOut(format(...a) + '\n');
  const err = (...a) => writeErr(format(...a) + '\n');
  const counts = {}, timeLabels = {};
  const console = {
    log: out, info: out, debug: out, warn: err, error: err, trace: (...a) => err('Trace:', ...a),
    dir: v => out(v), table: rows => {
      const list = Array.isArray(rows) ? rows : Object.values(rows || {});
      const cols = [...new Set(list.flatMap(r => (r && typeof r === 'object') ? Object.keys(r) : ['Values']))];
      const table = list.map((r, i) => [String(i), ...cols.map(c => (r && typeof r === 'object') ? inspect(r[c], 1) : c === 'Values' ? inspect(r, 1) : '')]);
      const head = ['(index)', ...cols], widths = head.map((h, i) => Math.max(h.length, ...table.map(r => r[i].length)));
      const line = (l, m, r) => l + widths.map(w => '─'.repeat(w + 2)).join(m) + r;
      const row = cells => '│' + cells.map((c, i) => ' ' + c.padEnd(widths[i]) + ' ').join('│') + '│';
      writeOut([line('┌', '┬', '┐'), row(head), line('├', '┼', '┤'), ...table.map(row), line('└', '┴', '┘')].join('\n') + '\n');
    },
    count: (l = 'default') => out(`${l}: ${counts[l] = (counts[l] || 0) + 1}`),
    time: (l = 'default') => { timeLabels[l] = performance.now(); },
    timeEnd: (l = 'default') => out(`${l}: ${(performance.now() - (timeLabels[l] || 0)).toFixed(3)}ms`),
    assert: (c, ...a) => { if (!c) err('Assertion failed:', ...a); }, clear: () => {}, group: out, groupEnd: () => {}
  };
  const readline = {
    createInterface: () => {
      const listeners = { line: [], close: [] };
      const rl = {
        question: (prompt, cb) => { writeOut(prompt); const line = readLineSync(); setTimeout(() => line === null ? listeners.close.forEach(f => f()) : cb(line.replace(/\r?\n$/, ''))); },
        on: (ev, fn) => { (listeners[ev] ||= []).push(fn); if (ev === 'line') pump(); return rl; },
        close: () => { listeners.close.forEach(f => f()); }, setPrompt: () => {}, prompt: () => {},
        [Symbol.asyncIterator]: async function* () { let line; while ((line = readLineSync()) !== null) yield line.replace(/\r?\n$/, ''); }
      };
      let pumping = false;
      const pump = () => { if (pumping) return; pumping = true; pending++; setTimeout(function next() { const line = readLineSync(); if (line === null) { listeners.close.forEach(f => f()); pending--; settle(); return; } listeners.line.forEach(f => f(line.replace(/\r?\n$/, ''))); setTimeout(next); }); };
      return rl;
    }
  };
  readline.promises = { createInterface: () => ({ question: async prompt => { writeOut(prompt); return (readLineSync() ?? '').replace(/\r?\n$/, ''); }, close: () => {} }) };
  const path = { join: (...p) => p.join('/').replace(/\/+/g, '/'), resolve: (...p) => '/' + p.join('/').replace(/^\/+/, ''), basename: (p, ext) => { const b = String(p).split('/').pop(); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; }, dirname: p => String(p).replace(/\/[^/]*$/, '') || '.', extname: p => (String(p).match(/\.[^./]*$/) || [''])[0], sep: '/' };
  const process = {
    argv: ['node', '/home/student/' + (data.entry || 'main.js'), ...(data.args || [])], env: { USER: 'student', HOME: '/home/student', ...(data.env || {}) },
    platform: data.platform || 'linux', version: 'v22.11.0 (DesktopSim-Browser-Engine)', versions: { node: '22.11.0' },
    exit: code => { throw new ExitSignal(code ?? 0); }, cwd: () => '/home/student', exitCode: 0,
    stdout: { write: s => { writeOut(String(s)); return true; } }, stderr: { write: s => { writeErr(String(s)); return true; } },
    stdin: { on: () => {}, setEncoding: () => {} }, nextTick: (fn, ...a) => queueMicrotask(() => fn(...a)), hrtime: { bigint: () => BigInt(Math.round(performance.now() * 1e6)) },
    memoryUsage: () => ({ heapUsed: 0 }), on: () => {}
  };
  const util = { format, inspect: v => inspect(v), promisify: fn => (...a) => new Promise((res, rej) => fn(...a, (e, r) => e ? rej(e) : res(r))) };
  const modules = { fs, 'node:fs': fs, 'fs/promises': fs.promises, readline, 'node:readline': readline, 'readline/promises': readline.promises, path, 'node:path': path, util, 'node:util': util, os: { EOL: '\n', platform: () => process.platform, cpus: () => [{ model: 'DesktopSim vCPU' }], hostname: () => 'desktopsim' }, process,
    'readline-sync': { question: q => { writeOut(q || ''); return (readLineSync() ?? '').replace(/\r?\n$/, ''); }, questionInt: q => { writeOut(q || ''); return parseInt(readLineSync() ?? '0'); } } };
  const require = name => { const local = name.replace(/^\.\//, ''); if (modules[name]) return modules[name]; if (fs.existsSync(local) || fs.existsSync(local + '.js')) { const src = fs.readFileSync(fs.existsSync(local) ? local : local + '.js'); const m = { exports: {} }; new Function('require', 'module', 'exports', 'console', 'process', src)(require, m, m.exports, console, process); return m.exports; } throw Object.assign(new Error(`Cannot find module '${name}'`), { code: 'MODULE_NOT_FOUND' }); };
  const prompt = (q = '') => { writeOut(q + ' '); const l = readLineSync(); return l === null ? null : l.replace(/\r?\n$/, ''); };

  if (data.repl) {
    Object.assign(globalThis, { console, require, process, prompt, module: { exports: {} } });
    let buffer = '';
    for (;;) {
      writeOut(buffer ? '... ' : '> ');
      const line = readLineSync();
      if (line === null) { writeOut('\n'); break; }
      const text = line.replace(/\r?\n$/, '');
      if (!buffer && text.trim() === '.exit') break;
      if (!buffer && text.trim() === '.help') { writeOut('.break    Sometimes you get stuck, this gets you out\n.exit     Exit the REPL\n.help     Print this help message\n'); continue; }
      buffer += (buffer ? '\n' : '') + text;
      const code = buffer.replace(/^\s*(let|const)\s+/gm, 'var ');
      try {
        const result = (0, eval)(code);
        buffer = '';
        const value = result instanceof Promise ? await result : result;
        if (!/^\s*(var|function|class)\b/.test(code)) writeOut(inspect(value, 1) + '\n');
        else writeOut('undefined\n');
      } catch (error) {
        if (error instanceof SyntaxError && /end of input|Unexpected end|missing \)|unterminated/i.test(error.message)) continue;
        buffer = '';
        if (error instanceof ExitSignal) break;
        writeErr('Uncaught ' + (error?.name ? `${error.name}: ${error.message}` : inspect(error)) + '\n');
      }
    }
    finish(0); return;
  }
  // ES-Modul-Importe in require() übersetzen (Teilmenge) und export entfernen.
  let source = String(data.source ?? '');
  source = source.replace(/^\s*import\s+(\w+)\s*(?:,\s*\{([^}]*)\})?\s+from\s+['"]([^'"]+)['"];?/gm, (_, def, named, mod) => `const ${def} = require('${mod}');${named ? ` const {${named.replace(/\s+as\s+/g, ': ')}} = require('${mod}');` : ''}`)
    .replace(/^\s*import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/gm, "const $1 = require('$2');")
    .replace(/^\s*import\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"];?/gm, (_, named, mod) => `const {${named.replace(/\s+as\s+/g, ': ')}} = require('${mod}');`)
    .replace(/^\s*export\s+default\s+/gm, 'module.exports = ').replace(/^\s*export\s+(?=(const|let|var|function|class|async)\b)/gm, '');
  if (/^#!/.test(source)) source = '//' + source;
  const module = { exports: {} };
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction('require', 'module', 'exports', '__filename', '__dirname', 'process', 'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'prompt', 'global', 'globalThis', 'Buffer', `"use strict";\n${source}\n//# sourceURL=${data.entry || 'main.js'}`);
    const fakeGlobal = Object.create(globalThis);
    await fn(require, module, module.exports, '/home/student/' + (data.entry || 'main.js'), '/home/student', process, console, wrapTimer(setTimeout, false), wrapTimer(setInterval, true), clearTimer, clearTimer, prompt, fakeGlobal, fakeGlobal, { from: s => new TextEncoder().encode(String(s)) });
  } catch (error) { report(error); }
  settle();
};
self.addEventListener('unhandledrejection', e => { writeErr('Uncaught (in promise) ' + (e.reason?.stack || e.reason) + '\n'); });
post('ready');
