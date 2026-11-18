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
  /** Schickt eine Nachricht und liefert {promise, cancel}. */
  run(message, io) {
    let cancel = () => {};
    const task = () => new Promise(resolve => {
      const worker = this.spawn();
      const channel = 'ch' + Math.random().toString(36).slice(2);
      let done = false;
      const finish = result => {
        if (done) return; done = true;
        worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError);
        if (!this.persistent || result.fatal) this.kill();
        resolve(result);
      };
      const onMessage = async ({ data }) => {
        if (!data || done) return;
        if (data.type === 'out') io.write(data.text, data.stream);
        else if (data.type === 'status') io.status?.(data.text);
        else if (data.type === 'image') io.image?.(data.src);
        else if (data.type === 'stdin-request') { const line = await io.readLine(); if (!done) sendStdin(channel, line); }
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

export class Runtimes {
  constructor() {
    this.python = new WorkerHost('py-worker.js', { persistent: true });
    this.php = new WorkerHost('php-worker.js', { persistent: true });
    this.clang = new WorkerHost('clang-worker.js', { persistent: true });
    this.js = new WorkerHost('js-worker.js');
    this.wasm = new WorkerHost('wasm-worker.js');
    this.state = { python: false, php: false, clang: false, java: false };
    initServiceWorker();
  }
  runPython({ source, entry = 'main.py', files = {}, args = [], stdin = '' }, io) { this.state.python = true; return this.python.run({ type: 'run', source, entry, files, args, stdin }, io); }
  pip(packages, io) { this.state.python = true; return this.python.run({ type: 'pip', packages }, io); }
  runJS({ source, entry = 'main.js', files = {}, args = [], stdin = '', platform = 'linux', repl = false }, io) { return this.js.run({ type: 'run', source, entry, files, args, stdin, platform, repl }, io); }
  runPHP({ source, entry = 'index.php', files = {}, args = [], stdin = '', web = null }, io) { this.state.php = true; return this.php.run({ type: 'run', source, entry, files, args, stdin, web }, io); }
  compileC({ driver = 'clang++', args, files, output }, io) { this.state.clang = true; return this.clang.run({ type: 'compile', driver, args, files, output }, io); }
  warmClang(io) { return this.clang.run({ type: 'warmup' }, io); }
  runWasm({ wasm, name, args = [], files = {}, stdin = '' }, io) { return this.wasm.run({ type: 'run', wasm, name, args, files, stdin }, io); }
  compileJava({ files }, io) { this.state.java = true; return { promise: compileJava({ files, io }), cancel: () => {} }; }
  runJava({ className, args = [] }, io) {
    this.state.java = true;
    let detached = false;
    const guarded = { ...io, write: (t, s) => { if (!detached) io.write(t, s); }, readLine: () => detached ? Promise.resolve(null) : io.readLine() };
    const promise = runJava({ className, args, io: guarded });
    return { promise: Promise.race([promise, new Promise(resolve => { guarded.cancel = resolve; })]), cancel: () => { detached = true; guarded.cancel?.({ code: 130, cancelled: true }); } };
  }
  stopAll() { this.python.kill(); this.php.kill(); this.js.kill(); this.wasm.kill(); }
}
