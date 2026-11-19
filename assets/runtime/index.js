// Zentrale Verwaltung der echten Laufzeiten (Python, JavaScript, C/C++, PHP, Java, SQLite).
// Ein "io"-Objekt verbindet ein Programm mit Terminal, Editor oder IDE:
//   io.write(text, 'stdout'|'stderr'), io.status(text), io.image(src), io.readLine() -> Promise<string|null>
import { compileJava, runJava } from './java.js';

const here = path => new URL(path, import.meta.url);
let swState = null;

export function initServiceWorker() {
  if (swState) return swState;
  swState = (async () => {
    if (!('serviceWorker' in navigator) || !self.isSecureContext) return false;
    try {
      await navigator.serviceWorker.register(here('../../sw.js'), { scope: here('../../').pathname });
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => { navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }); setTimeout(resolve, 4000); });
      }
      return Boolean(navigator.serviceWorker.controller);
    } catch { return false; }
  })();
  return swState;
}

function sendStdin(channel, line) {
  const target = navigator.serviceWorker?.controller;
  target?.postMessage(line === null ? { type: 'ds-stdin', channel, eof: true } : { type: 'ds-stdin', channel, data: line });
}

class WorkerHost {
  constructor(file, { persistent = false } = {}) { this.file = file; this.persistent = persistent; this.worker = null; this.queue = Promise.resolve(); }
  spawn() { if (!this.worker) this.worker = new Worker(here(this.file), { type: 'module', name: this.file }); return this.worker; }
  kill() { this.worker?.terminate(); this.worker = null; }
  get busy() { return this.running > 0; }
  /** Schickt eine Nachricht und liefert {promise, cancel}. */
  run(message, io) {
    let cancel = () => {};
    this.running = (this.running || 0) + 1;
    const task = () => new Promise(resolve => {
      const worker = this.spawn();
      const channel = 'ch' + Math.random().toString(36).slice(2);
      let done = false;
      const finish = result => {
        if (done) return; done = true;
        worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError);
        if (!this.persistent || result.fatal) this.kill();
        this.running--;
        resolve(result);
      };
      const onMessage = async ({ data }) => {
        if (!data || done) return;
        if (data.type === 'out') io.write(data.text, data.stream);
        else if (data.type === 'status') io.status?.(data.text);
        else if (data.type === 'image') io.image?.(data.src);
        else if (data.type === 'gui') io.gui?.(data.ops);
        else if (data.type === 'stdin-request') { const line = await io.readLine(); if (!done) sendStdin(channel, line); }
        else if (data.type === 'call') {
          let reply;
          try { reply = io.call ? await io.call(data.op, data.args || {}) : { error: 'unsupported' }; }
          catch (error) { reply = { error: String(error?.message || error) }; }
          if (!done) sendStdin(channel, JSON.stringify(reply ?? null));
        }
        else if (data.type === 'done') finish(data);
      };
      const onError = event => { event.preventDefault?.(); io.write(`Laufzeitfehler im Worker: ${event.message || 'Modul konnte nicht geladen werden (Netzwerk/CDN?)'}\n`, 'stderr'); finish({ code: 1, fatal: true }); };
      worker.addEventListener('message', onMessage); worker.addEventListener('error', onError);
      cancel = () => { if (done) return; sendStdin(channel, null); this.kill(); finish({ code: 130, cancelled: true }); };
      initServiceWorker().then(sync => { if (!done) worker.postMessage({ ...message, channel, ioMode: sync ? 'sync' : 'buffer' }); });
    });
    const promise = this.queue.then(task, task);
    this.queue = promise.catch(() => {});
    return { promise, cancel: () => cancel() };
  }
}

/** Mehrere Python-Prozesse gleichzeitig (z. B. Socket-Server und Client in zwei Terminals). */
class WorkerPool {
  constructor(file, { max = 6 } = {}) { this.file = file; this.max = max; this.hosts = []; }
  pick() {
    const idle = this.hosts.find(h => !h.busy);
    if (idle) return idle;
    if (this.hosts.length < this.max) { const h = new WorkerHost(this.file, { persistent: true }); this.hosts.push(h); return h; }
    return this.hosts[0];
  }
  run(message, io) {
    const host = this.pick();
    const handle = host.run(message, io);
    // Überzählige Worker nach Programmende wieder freigeben (nur einer bleibt warm).
    handle.promise.then(() => setTimeout(() => this.trim(), 30000));
    return handle;
  }
  trim() { for (const h of this.hosts.slice(1)) if (!h.busy) { h.kill(); this.hosts.splice(this.hosts.indexOf(h), 1); } }
  kill() { for (const h of this.hosts) h.kill(); this.hosts = []; }
}

export class Runtimes {
  constructor() {
    this.python = new WorkerPool('py-worker.js');
    this.prolog = new WorkerPool('prolog-worker.js', { max: 4 });
    this.php = new WorkerHost('php-worker.js', { persistent: true });
    this.clang = new WorkerHost('clang-worker.js', { persistent: true });
    this.js = new WorkerHost('js-worker.js');
    this.wasm = new WorkerHost('wasm-worker.js');
    this.state = { python: false, php: false, clang: false, java: false, prolog: false };
    initServiceWorker();
  }
  runPython({ source, entry = 'main.py', files = {}, args = [], stdin = '', env = null, check = false }, io) { this.state.python = true; return this.python.run({ type: check ? 'check' : 'run', source, entry, files, args, stdin, env }, io); }
  pip(packages, io, env = null) { this.state.python = true; return this.python.run({ type: 'pip', packages, env }, io); }
  /** SWI-Prolog: Datei konsultieren und Toplevel/Ziele ausführen (mode 'toplevel' | 'goals' | 'table'). */
  runProlog({ files = {}, consult = [], goals = [], mode = 'toplevel', query = '', kb = '', limit = 500, stdin = '', banner = false }, io) { this.state.prolog = true; return this.prolog.run({ type: 'run', files, consult, goals, mode, query, kb, limit, stdin, banner }, io); }
  runJS({ source, entry = 'main.js', files = {}, args = [], stdin = '', platform = 'linux', repl = false }, io) { return this.js.run({ type: 'run', source, entry, files, args, stdin, platform, repl }, io); }
  runPHP({ source, entry = 'index.php', files = {}, args = [], stdin = '', web = null }, io) { this.state.php = true; return this.php.run({ type: 'run', source, entry, files, args, stdin, web }, io); }
  compileC({ driver = 'clang++', args, files, output }, io) { this.state.clang = true; return this.clang.run({ type: 'compile', driver, args, files, output }, io); }
  warmClang(io) { return this.clang.run({ type: 'warmup' }, io); }
  runWasm({ wasm, name, args = [], files = {}, stdin = '' }, io) { return this.wasm.run({ type: 'run', wasm, name, args, files, stdin }, io); }
  compileJava({ files }, io) { this.state.java = true; return { promise: compileJava({ files, io }), cancel: () => {} }; }
  runJava({ className, args = [], gui = false, guiHost = null }, io) {
    this.state.java = true;
    let detached = false;
    const guarded = { ...io, write: (t, s) => { if (!detached) io.write(t, s); }, readLine: () => detached ? Promise.resolve(null) : io.readLine(), call: (op, a) => detached ? Promise.resolve({ error: 'EBADF' }) : (io.call ? io.call(op, a) : Promise.resolve({ error: 'unsupported' })) };
    const promise = runJava({ className, args, gui, guiHost, io: guarded });
    return { promise: Promise.race([promise, new Promise(resolve => { guarded.cancel = resolve; })]), cancel: () => { detached = true; guarded.cancel?.({ code: 130, cancelled: true }); } };
  }
  stopAll() { this.python.kill(); this.prolog.kill(); this.php.kill(); this.js.kill(); this.wasm.kill(); }
}
