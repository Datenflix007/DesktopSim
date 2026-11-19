// Echtes CPython 3 (Pyodide/WebAssembly) in einem Web Worker.
// Dazu kommen DesktopSim-Module (pylib/): tkinter & turtle als Fenster der Oberfläche,
// ein virtuelles Netzwerk für socket/select, virtuelle Umgebungen und ein matplotlib-Fenster.
import { configureIO, post, writeOut, writeErr, status, readLineSync, callSync, canBlock } from './worker-io.js';

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
const WORK = '/home/student/work';
const PYLIB = '/lib/desktopsim';
const PYLIB_FILES = ['_dsbridge.py', '_dsnet.py', '_dsenv.py', '_ds_mpl.py', 'turtle.py', 'tkinter/__init__.py',
  'tkinter/__main__.py', 'tkinter/constants.py', 'tkinter/ttk.py', 'tkinter/messagebox.py', 'tkinter/simpledialog.py',
  'tkinter/filedialog.py', 'tkinter/colorchooser.py', 'tkinter/font.py', 'tkinter/scrolledtext.py'];
let pyodidePromise = null, quietLoads = false;
const loadedHere = new Set();
const LOAD_MSG = /^(Loading|Loaded|Didn't find package) [^\n]*\n?$/;

self.dsGuiPost = json => post('gui', { ops: JSON.parse(json) });
self.dsCall = (op, json) => JSON.stringify(callSync(op, JSON.parse(json)));
self.dsCanBlock = () => canBlock();

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      status('Python wird geladen (Pyodide/WebAssembly, einmalig ca. 10 MB) …');
      const mod = await import(PYODIDE_URL + 'pyodide.mjs');
      const py = await mod.loadPyodide({ indexURL: PYODIDE_URL, env: { HOME: '/home/student', MPLBACKEND: 'module://_ds_mpl' } });
      const decoder = new TextDecoder();
      let dropped = false;
      py.setStdout({ write: buf => { const text = decoder.decode(buf, { stream: true }); if (quietLoads && (LOAD_MSG.test(text) || (dropped && text === '\n'))) { dropped = text !== '\n'; return buf.length; } dropped = false; writeOut(text); return buf.length; } });
      py.setStderr({ write: buf => { writeErr(decoder.decode(buf, { stream: true })); return buf.length; } });
      py.setStdin({ stdin: () => readLineSync() ?? undefined, isatty: true });
      const sources = await Promise.all(PYLIB_FILES.map(async f => [f, await (await fetch(new URL('pylib/' + f, import.meta.url))).text()]));
      for (const [f, text] of sources) { py.FS.mkdirTree(`${PYLIB}/${f}`.replace(/\/[^/]*$/, '')); py.FS.writeFile(`${PYLIB}/${f}`, text); }
      py.runPython(`import sys\nsys.path.insert(0, ${JSON.stringify(PYLIB)})\nfor _m in [m for m in list(sys.modules) if m == 'tkinter' or m.startswith('tkinter.') or m == 'turtle']: del sys.modules[_m]\nimport _dsenv\n_dsenv.install_hooks()`);
      return py;
    })();
    pyodidePromise.catch(() => { pyodidePromise = null; });
  }
  return pyodidePromise;
}

/** Pakete der aktiven Umgebung in diesem Worker bereitstellen (micropip: Pyodide-Index, sonst PyPI). */
async function ensurePackages(py, names) {
  const missing = (names || []).filter(n => !loadedHere.has(n.toLowerCase()));
  if (!missing.length) return;
  await py.loadPackage('micropip');
  const micropip = py.pyimport('micropip');
  for (const name of missing) {
    status(`Lade Paket ${name} …`);
    try { await micropip.install(name); loadedHere.add(name.toLowerCase()); }
    catch (error) { writeErr(`WARNING: ${name} konnte nicht geladen werden: ${String(error.message || error).split('\n').pop()}\n`); }
  }
  status('');
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

def __ds_prepare(env_json, windows, hostname):
    import json, _dsenv, _dsnet
    _dsenv.configure(json.loads(env_json))
    _dsnet.install(windows, hostname)

def __ds_cleanup(work):
    if 'tkinter' in sys.modules:
        try:
            sys.modules['tkinter']._atexit()
        except BaseException:
            traceback.print_exc()
    import _dsbridge
    _dsbridge.flush()
    for name in list(sys.modules):
        mod = sys.modules.get(name)
        file = getattr(mod, '__file__', None) or ''
        if name in ('tkinter', 'turtle', '_ds_mpl') or name.startswith('tkinter.') or file.startswith(work):
            del sys.modules[name]

def __ds_pip_info(names_json):
    import json, re, importlib.metadata as md
    try:
        from packaging.requirements import Requirement
    except Exception:
        Requirement = None
    out = {}
    todo = list(json.loads(names_json))
    while todo:
        n = todo.pop()
        key = re.sub(r'[-_.]+', '-', n).lower()
        if key in out:
            continue
        try:
            d = md.distribution(n)
        except Exception:
            continue
        meta = d.metadata
        reqs = []
        for r in d.requires or []:
            name = re.match(r'\\s*([A-Za-z0-9][A-Za-z0-9._-]*)', r)
            if not name:
                continue
            if Requirement is not None:
                try:
                    req = Requirement(r)
                    if req.marker is not None and not req.marker.evaluate({'extra': ''}):
                        continue
                except Exception:
                    if 'extra ==' in r:
                        continue
            elif 'extra ==' in r:
                continue
            reqs.append(name.group(1))
        out[key] = {'name': meta['Name'] or n, 'version': d.version, 'summary': meta.get('Summary') or '',
                    'homepage': meta.get('Home-page') or '', 'author': meta.get('Author') or meta.get('Author-email') or '',
                    'license': meta.get('License') or meta.get('License-Expression') or '', 'requires': reqs, 'requested': False}
        todo.extend(reqs)
    return json.dumps(list(out.values()))

def __ds_check(path):
    import json
    src = open(path, encoding='utf-8').read()
    try:
        compile(src, path, 'exec')
        return '[]'
    except SyntaxError as e:
        return json.dumps([{'line': e.lineno or 1, 'col': e.offset or 1, 'msg': '%s: %s' % (type(e).__name__, e.msg)}])

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
  if (!['run', 'pip', 'check'].includes(data?.type)) return;
  configureIO(data);
  try {
    const py = await getPyodide();
    py.runPython(RUNNER);
    quietLoads = true;
    const env = data.env || {};
    if (data.type === 'pip') {
      await py.loadPackage('micropip');
      const micropip = py.pyimport('micropip');
      const ok = [], failed = [];
      for (const spec of data.packages) {
        status(`Installiere ${spec} …`);
        try { await micropip.install(spec); const name = spec.replace(/[<>=!~ ;\[].*$/, ''); ok.push(name); loadedHere.add(name.toLowerCase()); }
        catch (error) { failed.push(spec); writeErr(`ERROR: Could not find a version that satisfies the requirement ${spec} (from versions: none)\nERROR: No matching distribution found for ${spec}\n\x1b[90m(${String(error.message || error).split('\n').filter(Boolean).pop()})\x1b[0m\n`); }
      }
      status('');
      const info = JSON.parse(py.globals.get('__ds_pip_info')(JSON.stringify(ok)));
      const norm = n => n.toLowerCase().replace(/[-_.]+/g, '-');
      for (const item of info) item.requested = ok.some(n => norm(n) === norm(item.name));
      quietLoads = false;
      post('done', { code: failed.length ? 1 : 0, files: {}, installed: info, failed });
      return;
    }
    status('');
    resetDir(py, WORK);
    writeTree(py, WORK, data.files);
    const entry = data.entry || 'main.py';
    if (data.source !== undefined) py.FS.writeFile(`${WORK}/${entry}`, data.source);
    if (data.type === 'check') {
      const problems = JSON.parse(py.globals.get('__ds_check')(`${WORK}/${entry}`));
      post('done', { code: 0, files: {}, problems });
      return;
    }
    const before = readTree(py, WORK);
    py.FS.chdir(WORK);
    if (env.packages?.length) await ensurePackages(py, env.packages);
    if (!env.venv) {
      try { await py.loadPackagesFromImports(py.FS.readFile(`${WORK}/${entry}`, { encoding: 'utf8' }), { messageCallback: msg => status(msg), errorCallback: () => {} }); }
      catch { /* unbekannte Pakete: Python meldet ModuleNotFoundError selbst */ }
    }
    status('');
    quietLoads = false;
    py.globals.get('__ds_prepare')(JSON.stringify(env), Boolean(env.windows), env.hostname || 'desktopsim');
    const code = py.globals.get('__ds_run')(`${WORK}/${entry}`, py.toPy(data.args || []));
    py.globals.get('__ds_cleanup')(WORK);
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
