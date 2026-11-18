// Führt kompilierte WebAssembly/WASI-Programme aus (C, C++).
import { configureIO, post, writeErr, createByteReader } from './worker-io.js';
import { WasiRuntime } from './wasi.js';

self.onmessage = async ({ data }) => {
  if (data?.type !== 'run') return;
  configureIO(data);
  const decoder = new TextDecoder(), errDecoder = new TextDecoder(), reader = createByteReader();
  let outBuf = '';
  const flush = () => { if (outBuf) { post('out', { stream: 'stdout', text: outBuf }); outBuf = ''; } };
  const wasi = new WasiRuntime({
    args: [data.name || 'a.out', ...(data.args || [])],
    env: { HOME: '/', USER: 'student', LANG: 'de_DE.UTF-8', ...(data.env || {}) },
    files: data.files || {},
    stdin: max => { flush(); return reader.read(max); },
    stdout: bytes => { outBuf += decoder.decode(bytes, { stream: true }); if (outBuf.length > 4096 || outBuf.includes('\n')) flush(); },
    stderr: bytes => { flush(); post('out', { stream: 'stderr', text: errDecoder.decode(bytes, { stream: true }) }); }
  });
  let code;
  try {
    const module = await WebAssembly.compile(data.wasm);
    code = wasi.run(module);
  } catch (error) {
    flush();
    const msg = String(error?.message || error);
    writeErr(/unreachable|out of bounds|call stack/i.test(msg)
      ? `\nProgramm abgestürzt (${msg}).\nMögliche Ursachen: Zugriff außerhalb eines Arrays, Endlosrekursion oder abort().\n`
      : `\nLaufzeitfehler: ${msg}\n`);
    code = 134;
  }
  flush();
  post('done', { code, files: wasi.changedFiles() });
};
post('ready');
