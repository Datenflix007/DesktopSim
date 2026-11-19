"""Laufzeitumgebung für Python-Programme in DesktopSim.

* virtuelle Umgebungen: in einem aktivierten venv sind nur dort installierte Pakete importierbar
* matplotlib: plt.show() öffnet ein echtes Fenster („Figure 1“)
* PIL.ImageTk funktioniert mit dem DesktopSim-tkinter
* verständlicher Hinweis, wenn Threads gestartet werden
"""
import sys
import importlib.abc
import importlib.machinery

_state = {'strict': False, 'allowed': set(), 'prefix': None}
_ALWAYS = {'pyodide', '_pyodide', 'pyodide_js', 'js', 'micropip', 'packaging', '_dsbridge', '_dsnet', '_dsenv',
           '_ds_mpl', '_ds_imagetk', 'tkinter', 'turtle', '_pytest', 'pip', 'setuptools', '_distutils_hack'}


def _norm(name):
    return str(name).lower().replace('-', '_').replace('.', '_')


_IMPORT_NAMES = {'scikit_learn': ['sklearn'], 'pillow': ['PIL'], 'beautifulsoup4': ['bs4'], 'pyyaml': ['yaml'],
                 'python_dateutil': ['dateutil'], 'opencv_python': ['cv2'], 'scikit_image': ['skimage'],
                 'attrs': ['attr', 'attrs'], 'typing_extensions': ['typing_extensions'], 'pyzmq': ['zmq']}


def _top_names(dist):
    names = set(_IMPORT_NAMES.get(_norm(dist), []))
    names.add(_norm(dist))
    try:
        import importlib.metadata as md
        d = md.distribution(dist)
        top = d.read_text('top_level.txt')
        if top:
            names.update(t.strip() for t in top.split() if t.strip())
        for f in d.files or ():
            parts = str(f).split('/')
            if parts and not parts[0].endswith(('.dist-info', '.data')) and parts[0] != '..':
                names.add(parts[0][:-3] if parts[0].endswith('.py') else parts[0])
    except Exception:
        pass
    return names


def _site(path):
    return bool(path) and 'site-packages' in path


def _from_user_code():
    """True, wenn der Import direkt aus dem Programm der Nutzer stammt (nicht aus einer Bibliothek)."""
    f = sys._getframe(2)
    while f is not None:
        name = f.f_code.co_filename
        if not name.startswith('<frozen') and 'importlib' not in name:
            return not _site(name) and '/lib/python3' not in name
        f = f.f_back
    return True


class _VenvFinder(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if not _state['strict'] or path is not None or '.' in fullname:
            return None
        if fullname in _ALWAYS or fullname in sys.builtin_module_names or fullname in _state['allowed']:
            return None
        spec = importlib.machinery.PathFinder.find_spec(fullname)
        if spec is None or not _site(spec.origin or (list(spec.submodule_search_locations or [''])[0])):
            return None
        if not _from_user_code():
            return None
        raise ModuleNotFoundError("No module named '%s'" % fullname, name=fullname)


_finder = _VenvFinder()


def configure(env):
    """env = {'venv': '/pfad/.venv' | None, 'packages': [...]} – vor jedem Programmstart."""
    env = env or {}
    venv = env.get('venv')
    _state['strict'] = bool(venv)
    allowed = set()
    for dist in env.get('packages') or ():
        allowed.update(_top_names(dist))
    _state['allowed'] = allowed
    _state['prefix'] = venv
    if _finder not in sys.meta_path:
        sys.meta_path.insert(0, _finder)
    if venv:
        for name in list(sys.modules):
            top = name.split('.')[0]
            mod = sys.modules.get(name)
            if top in _ALWAYS or top in allowed or mod is None:
                continue
            if _site(getattr(mod, '__file__', None) or ''):
                del sys.modules[name]
        sys.prefix = sys.exec_prefix = venv
    else:
        sys.prefix = sys.exec_prefix = sys.base_prefix


def install_hooks():
    # matplotlib: eigenes Backend mit Fenster
    import os
    os.environ['MPLBACKEND'] = 'module://_ds_mpl'
    # PIL.ImageTk umleiten
    sys.meta_path.insert(0, _ImageTkFinder())
    # Threads: klare Meldung
    try:
        import threading
        original = threading.Thread.start

        def start(self):
            try:
                return original(self)
            except RuntimeError as exc:
                raise RuntimeError(str(exc) + ' (DesktopSim/Pyodide: Python läuft im Browser ohne Threads – '
                                   'für mehrere Clients select.select oder selectors verwenden)') from None
        threading.Thread.start = start
    except Exception:
        pass


class _ImageTkFinder(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == 'PIL.ImageTk':
            return importlib.machinery.ModuleSpec(fullname, _ImageTkLoader())
        return None


class _ImageTkLoader(importlib.abc.Loader):
    def create_module(self, spec):
        return None

    def exec_module(self, module):
        import io
        import base64
        import tkinter

        class PhotoImage(tkinter.PhotoImage):
            def __init__(self, image=None, size=None, **kw):
                if image is not None and not isinstance(image, str):
                    buf = io.BytesIO()
                    image.save(buf, format='PNG')
                    kw['data'] = base64.b64encode(buf.getvalue()).decode()
                tkinter.PhotoImage.__init__(self, **kw)

            def paste(self, im):
                buf = io.BytesIO()
                im.save(buf, format='PNG')
                self._load(buf.getvalue())

        class BitmapImage(tkinter.BitmapImage):
            pass

        def getimage(photo):
            from PIL import Image
            return Image.open(io.BytesIO(photo._bytes or b''))

        module.PhotoImage = PhotoImage
        module.BitmapImage = BitmapImage
        module.getimage = getimage
