// Echtes PHP 8.4 (php-wasm) in einem Web Worker.
import { configureIO, post, writeErr, status, createByteReader } from './worker-io.js';

const PHP_URL = 'https://cdn.jsdelivr.net/npm/php-wasm@0.2.0/PhpWeb.mjs';
const WORK = '/home/student/work';
let php = null, binary = null, reader = null, used = false;
let outBytes = [], errBytes = [], scriptName = 'index.php', lineDone = false;
const decoder = new TextDecoder(), errDecoder = new TextDecoder();
const clean = text => text.replaceAll('php-wasm run script', scriptName);
const flushOut = () => { if (outBytes.length) { post('out', { stream: 'stdout', text: clean(decoder.decode(new Uint8Array(outBytes), { stream: true })) }); outBytes = []; } };
const flushErr = () => { if (errBytes.length) { post('out', { stream: 'stderr', text: clean(errDecoder.decode(new Uint8Array(errBytes), { stream: true })) }); errBytes = []; } };

async function getPHP() {
  if (php && !used) return php;
  if (php && used) { await php.refresh(); binary = await php.binary; used = false; return php; }
  status('PHP 8.4 wird geladen (WebAssembly, einmalig ca. 13 MB) …');
  // Der Web-Build von php-wasm referenziert beim Laden document/window (nur für SDL/Canvas genutzt).
  if (typeof self.document === 'undefined') {
    const noop = () => {}, el = () => ({ style: {}, addEventListener: noop, removeEventListener: noop });
    self.window = self;
    self.document = { addEventListener: noop, removeEventListener: noop, getElementById: () => null, querySelector: () => null, createElement: el, body: el(), documentElement: el(), currentScript: null };
  }
  const { PhpWeb } = await import(PHP_URL);
  php = new PhpWeb({
    version: '8.4', autoTransaction: false,
    // Nach einem Zeilenende einmal null liefern, damit fgets() die Zeile sofort zurückgibt
    // statt blockierend weitere Bytes für seinen Puffer anzufordern.
    stdin: () => { flushOut(); if (lineDone) { lineDone = false; return null; } const b = reader ? reader.byte() : null; if (b === 10) lineDone = true; return b; },
    stdout: byte => { outBytes.push(byte); if (byte === 10 || outBytes.length > 4096) flushOut(); },
    stderr: byte => { errBytes.push(byte); if (byte === 10) flushErr(); }
  });
  binary = await php.binary;
  status('');
  return php;
}

function mkdirp(FS, dir) { let cur = ''; for (const part of dir.split('/').filter(Boolean)) { cur += '/' + part; if (!FS.analyzePath(cur).exists) FS.mkdir(cur); } }
function snapshot(FS, dir, prefix = '', out = {}) {
  for (const name of FS.readdir(dir)) {
    if (name === '.' || name === '..') continue;
    const full = `${dir}/${name}`;
    if (FS.isDir(FS.stat(full).mode)) snapshot(FS, full, prefix + name + '/', out);
    else out[prefix + name] = FS.readFile(full, { encoding: 'utf8' });
  }
  return out;
}

self.onmessage = async ({ data }) => {
  if (data?.type !== 'run') return;
  configureIO(data);
  reader = createByteReader();
  try {
    const runtime = await getPHP();
    const FS = binary.FS;
    try { const rm = p => { for (const n of FS.readdir(p)) { if (n === '.' || n === '..') continue; const f = `${p}/${n}`; if (FS.isDir(FS.stat(f).mode)) { rm(f); FS.rmdir(f); } else FS.unlink(f); } }; if (FS.analyzePath(WORK).exists) rm(WORK); } catch { /* leer */ }
    mkdirp(FS, WORK);
    for (const [rel, content] of Object.entries(data.files || {})) { mkdirp(FS, `${WORK}/${rel}`.replace(/\/[^/]*$/, '')); FS.writeFile(`${WORK}/${rel}`, content); }
    FS.chdir(WORK);
    const before = snapshot(FS, WORK);
    used = true;
    let source = String(data.source ?? '');
    const argv = [data.entry || 'index.php', ...(data.args || [])];
    const prelude = `<?php $argv = ${JSON.stringify(argv)}; $argc = ${argv.length}; $_SERVER['argv'] = $argv; $_SERVER['argc'] = $argc; $_SERVER['SCRIPT_NAME'] = $argv[0]; chdir('${WORK}');`
      + ` if (!defined('STDIN')) define('STDIN', fopen('php://stdin', 'r')); if (!defined('STDOUT')) define('STDOUT', fopen('php://stdout', 'w')); if (!defined('STDERR')) define('STDERR', fopen('php://stderr', 'w'));`
      + ` function __ds_readline($prompt = '') { echo $prompt; if (ob_get_level()) ob_flush(); flush(); $line = fgets(STDIN); return $line === false ? false : rtrim($line, "\\r\\n"); } ?>`;
    // php-wasm enthält eine readline-Erweiterung, die im Worker blockiert – auf die eigene Funktion umleiten.
    source = source.replace(/\breadline\s*\(/g, '__ds_readline(');
    scriptName = data.entry || 'index.php';
    if (data.web) {
      const req = data.web;
      source = `<?php $_SERVER['REQUEST_METHOD'] = ${JSON.stringify(req.method || 'GET')}; $_SERVER['REQUEST_URI'] = ${JSON.stringify(req.uri || '/')}; $_SERVER['HTTP_HOST'] = 'localhost'; parse_str(${JSON.stringify(req.query || '')}, $_GET); parse_str(${JSON.stringify(req.body || '')}, $_POST); $_REQUEST = array_merge($_GET, $_POST); ?>` + source;
    }
    const code = await runtime.run(prelude + source);
    flushOut(); flushErr();
    const after = snapshot(FS, WORK), files = {};
    for (const [k, v] of Object.entries(after)) if (before[k] !== v) files[k] = v;
    post('done', { code: Number(code) || 0, files });
  } catch (error) {
    flushOut(); flushErr();
    writeErr(`php: ${error?.message || error}\n`);
    php = null; post('done', { code: 1, fatal: true, files: {} });
  }
};
post('ready');
