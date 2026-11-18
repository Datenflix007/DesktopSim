// Echtes CPython 3 (Pyodide/WebAssembly) in einem Web Worker.
import { configureIO, post, writeOut, writeErr, status, readLineSync } from './worker-io.js';

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
const WORK = '/home/student/work';
let pyodidePromise = null;

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      status('Python wird geladen (Pyodide/WebAssembly, einmalig ca. 10 MB) …');
      const mod = await import(PYODIDE_URL + 'pyodide.mjs');
      const py = await mod.loadPyodide({ indexURL: PYODIDE_URL, env: { HOME: '/home/student', MPLBACKEND: 'AGG' } });
      const decoder = new TextDecoder();
      py.setStdout({ write: buf => { writeOut(decoder.decode(buf, { stream: true })); return buf.length; } });
      py.setStderr({ write: buf => { writeErr(decoder.decode(buf, { stream: true })); return buf.length; } });
      py.setStdin({ stdin: () => readLineSync() ?? undefined, isatty: true });
      return py;
    })();
    pyodidePromise.catch(() => { pyodidePromise = null; });
  }
  return pyodidePromise;
}

function resetDir(py, dir) {
  const FS = py.FS;
  const wipe = path => {
    for (const name of FS.readdir(path)) {
      if (name === '.' || name === '..') continue;
      const full = `${path}/${name}`;
      if (FS.isDir(FS.stat(full).mode)) { wipe(full); FS.rmdir(full); } else FS.unlink(full);
    }
  };
  try { wipe(dir); } catch { FS.mkdirTree(dir); }
}

function writeTree(py, dir, files) {
  for (const [rel, content] of Object.entries(files || {})) {
    const full = `${dir}/${rel}`;
    py.FS.mkdirTree(full.replace(/\/[^/]*$/, ''));
    py.FS.writeFile(full, content);
  }
}

function readTree(py, dir, prefix = '', out = {}) {
  for (const name of py.FS.readdir(dir)) {
    if (name === '.' || name === '..' || name === '__pycache__') continue;
    const full = `${dir}/${name}`, rel = prefix + name;
    if (py.FS.isDir(py.FS.stat(full).mode)) readTree(py, full, rel + '/', out);
    else {
      const bytes = py.FS.readFile(full);
      let text = null;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { /* binär */ }
      out[rel] = text ?? { base64: btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')) };
    }
  }
  return out;
}

const RUNNER = `
import sys, os, traceback, runpy
def __ds_run(path, argv):
    sys.argv = [path] + list(argv)
    code = 0
    try:
        runpy.run_path(path, run_name='__main__')
    except SystemExit as exc:
        code = exc.code if isinstance(exc.code, int) else (0 if exc.code is None else 1)
        if exc.code is not None and not isinstance(exc.code, int):
            print(exc.code, file=sys.stderr)
    except KeyboardInterrupt:
        print('KeyboardInterrupt', file=sys.stderr); code = 130
    except BaseException:
        etype, value, tb = sys.exc_info()
        frames = [f for f in traceback.extract_tb(tb) if not f.filename.startswith('/lib/') and f.filename != '<exec>' and 'runpy' not in f.filename]
        print('Traceback (most recent call last):', file=sys.stderr)
        print(''.join(traceback.format_list(frames)), end='', file=sys.stderr)
        print(''.join(traceback.format_exception_only(etype, value)), end='', file=sys.stderr)
        code = 1
    finally:
        sys.stdout.flush(); sys.stderr.flush()
    return code

def __ds_figures():
    out = []
    if 'matplotlib.pyplot' in sys.modules:
        import io, base64
        plt = sys.modules['matplotlib.pyplot']
        for num in plt.get_fignums():
            buf = io.BytesIO(); plt.figure(num).savefig(buf, format='png', dpi=90, bbox_inches='tight')
            out.append(base64.b64encode(buf.getvalue()).decode())
        plt.close('all')
    return out
`;

self.onmessage = async ({ data }) => {
  if (data?.type !== 'run' && data?.type !== 'pip') return;
  configureIO(data);
  try {
    const py = await getPyodide();
    if (data.type === 'pip') {
      await py.loadPackage('micropip');
      const micropip = py.pyimport('micropip');
      for (const name of data.packages) {
        status(`Installiere ${name} …`);
        try { await micropip.install(name); writeOut(`Successfully installed ${name}\n`); }
        catch (error) { writeErr(`ERROR: Could not install ${name}: ${String(error.message || error).split('\n').pop()}\n`); }
      }
      post('done', { code: 0, files: {} });
      return;
    }
    status('');
    resetDir(py, WORK);
    writeTree(py, WORK, data.files);
    const entry = data.entry || 'main.py';
    if (data.source !== undefined) py.FS.writeFile(`${WORK}/${entry}`, data.source);
    const before = readTree(py, WORK);
    py.FS.chdir(WORK);
    try { await py.loadPackagesFromImports(py.FS.readFile(`${WORK}/${entry}`, { encoding: 'utf8' }), { messageCallback: msg => status(msg), errorCallback: () => {} }); }
    catch { /* unbekannte Pakete: Python meldet ModuleNotFoundError selbst */ }
    py.runPython(RUNNER);
    const code = py.globals.get('__ds_run')(`${WORK}/${entry}`, py.toPy(data.args || []));
    const figures = py.globals.get('__ds_figures')().toJs();
    for (const png of figures) post('image', { src: 'data:image/png;base64,' + png });
    const after = readTree(py, WORK), files = {};
    for (const [path, content] of Object.entries(after)) {
      const old = before[path];
      if (old === undefined || JSON.stringify(old) !== JSON.stringify(content)) files[path] = content;
    }
    post('done', { code: Number(code) || 0, files });
  } catch (error) {
    writeErr(String(error?.message || error) + '\n');
    post('done', { code: 1, files: {}, fatal: true });
  }
};
post('ready');
