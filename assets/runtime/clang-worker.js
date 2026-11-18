// Echter C/C++-Compiler: LLVM/Clang 22 als WebAssembly (YoWASP), erzeugt WASI-Programme.
import { post, writeErr, status } from './worker-io.js';

const CLANG_URL = 'https://cdn.jsdelivr.net/npm/@yowasp/clang@22.0.0-git20695-13/gen/bundle.js';
let clangPromise = null;
const getClang = () => {
  if (!clangPromise) { clangPromise = import(CLANG_URL); clangPromise.catch(() => { clangPromise = null; }); }
  return clangPromise;
};
let lastProgress = -1;

self.onmessage = async ({ data }) => {
  if (data?.type === 'warmup') {
    try { const { runClang } = await getClang(); await runClang(null, {}, { fetchProgress: progress }); post('done', { code: 0 }); }
    catch (error) { writeErr(String(error?.message || error) + '\n'); post('done', { code: 1, fatal: true }); }
    return;
  }
  if (data?.type !== 'compile') return;
  const decoder = new TextDecoder();
  try {
    const { runClang } = await getClang();
    const files = {};
    for (const [path, content] of Object.entries(data.files || {})) {
      const parts = path.split('/'); let node = files;
      for (const dir of parts.slice(0, -1)) node = node[dir] ||= {};
      node[parts.at(-1)] = content;
    }
    const args = [data.driver === 'clang' ? 'clang' : 'clang++', ...data.args];
    let result, code = 0;
    try {
      result = await runClang(args, files, {
        stdout: bytes => bytes && post('out', { stream: 'stdout', text: decoder.decode(bytes) }),
        stderr: bytes => bytes && post('out', { stream: 'stderr', text: decoder.decode(bytes) }),
        fetchProgress: progress, decodeASCII: false
      });
    } catch (error) {
      if (typeof error?.code === 'number') { code = error.code || 1; result = error.files; }
      else throw error;
    }
    const output = data.output && result ? data.output.split('/').reduce((node, part) => node?.[part], result) : null;
    post('done', { code, wasm: code === 0 && output instanceof Uint8Array ? output : null });
  } catch (error) {
    writeErr(`clang: Interner Fehler: ${error?.message || error}\n`);
    post('done', { code: 1, fatal: true });
  }
};

function progress({ totalLength, doneLength }) {
  const pct = totalLength ? Math.floor(100 * doneLength / totalLength) : 0;
  if (pct === lastProgress) return;
  lastProgress = pct;
  status(pct >= 100 ? 'Clang/LLVM 22 geladen – kompiliere …' : `Lade Clang/LLVM 22 (einmalig ${(totalLength / 1048576).toFixed(0)} MB): ${pct} %`);
}
post('ready');
