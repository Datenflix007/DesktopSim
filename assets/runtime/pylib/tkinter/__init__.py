"""tkinter für DesktopSim.

Pyodide enthält kein Tcl/Tk. Dieses Paket bildet die tkinter-API in Python nach und
zeichnet die Fenster als echte Fenster der simulierten Desktop-Oberfläche. Widgets,
Geometriemanager (pack/grid/place), Variablen, Ereignisse, after() und Canvas verhalten
sich wie im Original; die Darstellung übernimmt der Browser.
"""
import sys as _sys
import time as _time
import base64 as _base64
import struct as _struct
import zlib as _zlib
import heapq as _heapq
import traceback as _traceback

import _dsbridge as _b
from tkinter.constants import *

TkVersion = 8.6
TclVersion = 8.6
READABLE = 2
WRITABLE = 4
EXCEPTION = 8
wantobjects = 1


class TclError(Exception):
    pass


class EventType(str):
    pass


_default_root = None
_support_default_root = True
_roots = []
_widgets = {}
_vars = {}
_callbacks = {}
_cb_serial = [0]
_timers = []
_timer_ids = {}
_timer_serial = [0]
_loop = {'depth': 0, 'quit': False, 'seen': False, 'warned': False}
_sizes = {}
_screen = [1280, 800]
_pointer = [0, 0]
_focus = [None]
_bindings = {}      # tag -> {sequence: [func, ...]}
_images = {}
_clipboard = ['']

_ALIASES = {'bg': 'background', 'fg': 'foreground', 'bd': 'borderwidth', 'invcmd': 'invalidcommand',
            'vcmd': 'validatecommand'}


def _alias(key):
    key = key.rstrip('_') if key not in ('from_', 'in_') else key
    return _ALIASES.get(key, key)


def NoDefaultRoot():
    global _support_default_root, _default_root
    _support_default_root = False
    _default_root = None


def _get_default_root(what=None):
    if not _support_default_root:
        raise RuntimeError('No master specified and tkinter is configured to not support default root')
    if _default_root is None:
        if what:
            raise RuntimeError(f'Too early to {what}: no default root window')
        Tk()
    return _default_root


def _register(func):
    for key, value in _callbacks.items():
        if value is func:
            return key
    _cb_serial[0] += 1
    key = 'cb%d' % _cb_serial[0]
    _callbacks[key] = func
    return key


def _report(exc=None):
    print('Exception in Tkinter callback', file=_sys.stderr)
    etype, value, tb = _sys.exc_info()
    frames = [f for f in _traceback.extract_tb(tb) if '/tkinter/' not in f.filename.replace('\\', '/')]
    print('Traceback (most recent call last):', file=_sys.stderr)
    print(''.join(_traceback.format_list(frames)), end='', file=_sys.stderr)
    print(''.join(_traceback.format_exception_only(etype, value)), end='', file=_sys.stderr)


def _safe_call(func, *args):
    try:
        return func(*args)
    except SystemExit:
        raise
    except BaseException:
        root = _default_root
        if root is not None and type(root).report_callback_exception is not Tk.report_callback_exception:
            root.report_callback_exception(*_sys.exc_info())
        else:
            _report()


def _flatten(seq):
    out = []
    for item in seq:
        if isinstance(item, (list, tuple)):
            out.extend(_flatten(item))
        else:
            out.append(item)
    return out


def _font(value):
    if value is None:
        return None
    if hasattr(value, '_spec'):
        return value._spec()
    if isinstance(value, (list, tuple)):
        return [str(v) for v in value]
    return str(value)


def _jsval(key, value):
    """Option für den Browser aufbereiten."""
    if value is None:
        return None
    if callable(value) and not isinstance(value, (Variable, Misc, Image)):
        return {'cb': _register(value)}
    if isinstance(value, Variable):
        return {'var': value._name}
    if isinstance(value, Image):
        return {'img': value.name}
    if isinstance(value, Misc):
        return {'w': value._w}
    if key == 'font':
        return _font(value)
    if isinstance(value, (list, tuple)):
        return [_jsval(None, v) if isinstance(v, (Variable, Image, Misc)) else v for v in value]
    if isinstance(value, (int, float, str, bool)):
        return value
    return str(value)


def _prep(opts):
    return {_alias(k): _jsval(_alias(k), v) for k, v in opts.items()}


# ---------------------------------------------------------------- Variablen
class Variable:
    _default = ''
    _count = 0

    def __init__(self, master=None, value=None, name=None):
        if name is None:
            name = 'PY_VAR%d' % Variable._count
            Variable._count += 1
        self._name = name
        self._master = master
        self._traces = []
        old = _vars.get(name)
        if old is not None and value is None:
            self._value = old._value
            self._traces = old._traces
        else:
            self._value = self._default if value is None else value
        _vars[name] = self
        _b.emit('var', name=name, value=self._export())

    def __str__(self):
        return self._name

    def __repr__(self):
        return '<tkinter.%s object %s>' % (type(self).__name__, self._name)

    def __eq__(self, other):
        return isinstance(other, Variable) and type(self) is type(other) and self._name == other._name

    def __hash__(self):
        return hash(self._name)

    def __del__(self):
        pass

    def _export(self):
        return self._value

    def set(self, value):
        self._value = value
        _b.emit('var', name=self._name, value=self._export())
        self._fire('write')

    initialize = set

    def get(self):
        return self._value

    def _from_js(self, value):
        if value != self._value:
            self._value = value
            self._fire('write')

    def _fire(self, mode):
        for modes, func in list(self._traces):
            if mode in modes or (mode == 'write' and 'w' in modes):
                if isinstance(modes, tuple):
                    _safe_call(func, self._name, '', mode)
                else:
                    _safe_call(func, self._name, '', 'w' if mode == 'write' else mode)

    def trace_add(self, mode, callback):
        modes = (mode,) if isinstance(mode, str) else tuple(mode)
        self._traces.append((modes, callback))
        return _register(callback)

    def trace_remove(self, mode, cbname):
        func = _callbacks.get(cbname)
        self._traces = [t for t in self._traces if t[1] is not func]

    def trace_info(self):
        return [(modes, _register(func)) for modes, func in self._traces]

    def trace_variable(self, mode, callback):
        self._traces.append((mode, callback))
        return _register(callback)

    trace = trace_variable

    def trace_vdelete(self, mode, cbname):
        self.trace_remove(mode, cbname)

    def trace_vinfo(self):
        return [(m, _register(f)) for m, f in self._traces]


class StringVar(Variable):
    _default = ''

    def get(self):
        return '' if self._value is None else str(self._value)


class IntVar(Variable):
    _default = 0

    def get(self):
        value = self._value
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        try:
            return int(str(value).strip())
        except ValueError:
            try:
                return int(float(str(value)))
            except ValueError:
                raise TclError('expected floating-point number but got "%s"' % value) from None


class DoubleVar(Variable):
    _default = 0.0

    def get(self):
        try:
            return float(self._value)
        except (TypeError, ValueError):
            raise TclError('expected floating-point number but got "%s"' % self._value) from None


class BooleanVar(Variable):
    _default = False

    def _export(self):
        return 1 if self._value in (True, 1, '1', 'true', 'yes', 'on') else 0

    def set(self, value):
        super().set(bool(value) if not isinstance(value, str) else value.lower() in ('1', 'true', 'yes', 'on'))

    def get(self):
        value = self._value
        if isinstance(value, str):
            if value.lower() in ('1', 'true', 'yes', 'on'):
                return True
            if value.lower() in ('0', 'false', 'no', 'off', ''):
                return False
            raise TclError('expected boolean value but got "%s"' % value)
        return bool(value)


def getint(s):
    return int(s)


def getdouble(s):
    return float(s)


def getboolean(s):
    return str(s).lower() in ('1', 'true', 'yes', 'on')


# ---------------------------------------------------------------- Ereignisse
class Event:
    def __repr__(self):
        attrs = {k: v for k, v in self.__dict__.items() if v not in ('??', None, '')}
        return '<%s event %s>' % (getattr(self, 'type', '?'), ' '.join('%s=%r' % kv for kv in attrs.items() if kv[0] != 'type'))


_KEY_TYPES = {'Key': 'KeyPress', 'KeyPress': 'KeyPress', 'KeyRelease': 'KeyRelease',
              'Button': 'ButtonPress', 'ButtonPress': 'ButtonPress', 'ButtonRelease': 'ButtonRelease',
              'Motion': 'Motion', 'Enter': 'Enter', 'Leave': 'Leave', 'MouseWheel': 'MouseWheel',
              'Configure': 'Configure', 'FocusIn': 'FocusIn', 'FocusOut': 'FocusOut', 'Destroy': 'Destroy',
              'Map': 'Map', 'Unmap': 'Unmap', 'Visibility': 'Visibility', 'Expose': 'Expose', 'Activate': 'Activate',
              'Deactivate': 'Deactivate'}
_MODS = {'Control': 4, 'Shift': 1, 'Lock': 2, 'Alt': 8, 'Mod1': 8, 'Command': 8, 'Option': 16, 'Meta': 8,
         'B1': 256, 'Button1': 256, 'B2': 512, 'Button2': 512, 'B3': 1024, 'Button3': 1024}


def _parse_seq(seq):
    """'<Control-Shift-KeyPress-a>' -> (type, detail, modmask, count)"""
    if seq.startswith('<<') and seq.endswith('>>'):
        return ('Virtual', seq, 0, 1)
    if not seq.startswith('<'):
        return ('KeyPress', seq, 0, 1)
    parts = seq[1:-1].split('-')
    mask, count, etype, detail = 0, 1, None, None
    for p in parts:
        if p in _MODS:
            mask |= _MODS[p]
        elif p == 'Double':
            count = 2
        elif p == 'Triple':
            count = 3
        elif p in _KEY_TYPES and etype is None and detail is None:
            etype = _KEY_TYPES[p]
        elif p.isdigit() and len(p) == 1 and etype in (None, 'ButtonPress', 'ButtonRelease'):
            etype = etype or 'ButtonPress'
            detail = p
        elif p:
            detail = p
            etype = etype or 'KeyPress'
    return (etype or 'KeyPress', detail, mask, count)


def _match(ev, seq):
    etype, detail, mask, count = _parse_seq(seq)
    if etype == 'Virtual':
        return ev.type == 'Virtual' and ev.detail == seq and (10,)
    if etype != ev.type:
        return False
    if detail is not None:
        if etype in ('ButtonPress', 'ButtonRelease'):
            if str(ev.num) != detail:
                return False
        elif etype in ('KeyPress', 'KeyRelease'):
            if ev.keysym != detail and not (len(detail) == 1 and ev.char == detail):
                return False
    if (ev.state & mask) != mask:
        return False
    if count > 1 and getattr(ev, '_count', 1) < count:
        return False
    return (count, bin(mask).count('1'), 0 if detail is None else 1)


def _bindtags(widget, item_tags=None):
    tags = []
    if item_tags:
        tags.extend(item_tags)
    tags.append(widget._w)
    top = widget.winfo_toplevel()
    if top is not widget:
        tags.append(top._w)
    tags.append('all')
    return tags


def _dispatch_event(widget, ev, item_tags=None):
    for tag in _bindtags(widget, item_tags):
        table = _bindings.get(tag)
        if not table:
            continue
        best, best_score = None, None
        for seq in table:
            score = _match(ev, seq)
            if score and (best_score is None or score > best_score):
                best, best_score = seq, score
        if best is None:
            continue
        for func in list(table[best]):
            result = _safe_call(func, ev)
            if result == 'break':
                return 'break'
    return None


def _make_event(widget, data):
    ev = Event()
    ev.widget = widget
    ev.type = EventType(data.get('type', 'KeyPress'))
    ev.serial = 0
    ev.num = data.get('num', '??')
    ev.x = data.get('x', 0)
    ev.y = data.get('y', 0)
    ev.x_root = data.get('xr', ev.x)
    ev.y_root = data.get('yr', ev.y)
    ev.char = data.get('char', '')
    ev.keysym = data.get('keysym', '??')
    ev.keycode = data.get('keycode', 0)
    ev.keysym_num = data.get('keycode', 0)
    ev.delta = data.get('delta', 0)
    ev.state = data.get('state', 0)
    ev.width = data.get('width', 0)
    ev.height = data.get('height', 0)
    ev.time = int(_time.time() * 1000) & 0x7fffffff
    ev.detail = data.get('detail')
    ev._count = data.get('count', 1)
    return ev


# ---------------------------------------------------------------- Zeitgeber & Ereignisschleife
def _schedule(ms, func, args):
    _timer_serial[0] += 1
    tid = 'after#%d' % _timer_serial[0]
    entry = [_time.monotonic() + max(0, ms) / 1000.0, _timer_serial[0], tid, func, args, True]
    _timer_ids[tid] = entry
    _heapq.heappush(_timers, entry)
    return tid


def _run_timers():
    now = _time.monotonic()
    ran = 0
    while _timers and _timers[0][0] <= now and ran < 200:
        entry = _heapq.heappop(_timers)
        _timer_ids.pop(entry[2], None)
        if entry[5]:
            ran += 1
            _safe_call(entry[3], *entry[4])


def _next_delay():
    while _timers and not _timers[0][5]:
        _heapq.heappop(_timers)
    if not _timers:
        return None
    return max(0, int((_timers[0][0] - _time.monotonic()) * 1000))


def _apply_state(state):
    for name, value in (state.get('v') or {}).items():
        var = _vars.get(name)
        if var is not None:
            var._from_js(value)
    for path, value in (state.get('w') or {}).items():
        widget = _widgets.get(path)
        if widget is not None:
            widget._from_js(value)
    for path, size in (state.get('s') or {}).items():
        _sizes[path] = tuple(size)
    if state.get('screen'):
        _screen[:] = state['screen']
    if state.get('pointer'):
        _pointer[:] = state['pointer']
    if 'focus' in state:
        _focus[0] = state['focus']


def _dispatch(data):
    kind = data.get('t')
    if kind == 'cb':
        func = _callbacks.get(data.get('cb'))
        if func is not None:
            _safe_call(func, *data.get('args', []))
    elif kind == 'ev':
        widget = _widgets.get(data.get('id'))
        if widget is None:
            return
        ev = _make_event(widget, data)
        item_tags = None
        if isinstance(widget, Canvas) and data.get('item'):
            item = widget._items.get(data['item'])
            widget._current = data['item']
            if item:
                item_tags = [('item', data['item'])] + [('tag', t) for t in item['tags']]
                _dispatch_canvas(widget, ev, item_tags)
        if data.get('type') == 'Configure':
            _sizes[widget._w] = (ev.width, ev.height)
        _dispatch_event(widget, ev)
    elif kind == 'close':
        widget = _widgets.get(data.get('id'))
        if widget is None:
            return
        handler = widget._protocols.get('WM_DELETE_WINDOW') if hasattr(widget, '_protocols') else None
        if handler:
            _safe_call(handler)
        else:
            widget.destroy()


def _dispatch_canvas(canvas, ev, item_tags):
    for kind, key in item_tags:
        table = canvas._tag_bindings.get(key if kind == 'tag' else int(key))
        if not table:
            continue
        best, best_score = None, None
        for seq in table:
            score = _match(ev, seq)
            if score and (best_score is None or score > best_score):
                best, best_score = seq, score
        if best:
            for func in list(table[best]):
                if _safe_call(func, ev) == 'break':
                    return


def _process(timeout):
    reply = _b.call('gui.wait', timeout=timeout)
    if not isinstance(reply, dict) or reply.get('error'):
        return False
    _apply_state(reply.get('state') or {})
    for ev in reply.get('events') or []:
        _dispatch(ev)
    return True


def _warn_static():
    if not _loop['warned']:
        _loop['warned'] = True
        print('Hinweis: Ohne Service Worker kann DesktopSim tkinter-Fenster nur anzeigen, nicht bedienen.', file=_sys.stderr)


def mainloop(n=0):
    _loop['seen'] = True
    _b.flush()
    if not _b.can_block():
        _warn_static()
        return
    _loop['depth'] += 1
    try:
        while _roots and not _loop['quit']:
            _run_timers()
            if not _roots or _loop['quit']:
                break
            if not _process(_next_delay()):
                break
    finally:
        _loop['depth'] -= 1
        _loop['quit'] = False
        _b.flush()


def _wait_until(cond):
    _b.flush()
    if not _b.can_block():
        return
    while not cond() and _roots:
        _run_timers()
        if cond():
            break
        if not _process(_next_delay()):
            break


def _atexit():
    """Vom DesktopSim-Starter nach dem Skript aufgerufen."""
    _b.flush()
    if _roots and not _loop['seen'] and _b.can_block():
        mainloop()
    _b.flush()


# ---------------------------------------------------------------- Tcl-Interpreter-Attrappe
class _TkApp:
    def __init__(self, root):
        self._root = root

    def call(self, *args):
        args = _flatten(args)
        if args[:2] == ['tk', 'scaling']:
            return 1.333
        if args and args[0] == 'info' and args[1:2] == ['patchlevel']:
            return '8.6.15'
        if args[:1] == ['wm']:
            return ''
        return ''

    def eval(self, script):
        if 'patchlevel' in script:
            return '8.6.15'
        return ''

    def getvar(self, name):
        v = _vars.get(name)
        return v.get() if v else ''

    def setvar(self, name, value):
        v = _vars.get(name) or StringVar(name=name)
        v.set(value)

    globalgetvar = getvar
    globalsetvar = setvar

    def splitlist(self, value):
        if isinstance(value, (list, tuple)):
            return tuple(value)
        return tuple(str(value).split())

    def getboolean(self, s):
        return getboolean(s)

    def getint(self, s):
        return int(s)

    def getdouble(self, s):
        return float(s)

    def createcommand(self, name, func):
        _callbacks[name] = func

    def deletecommand(self, name):
        _callbacks.pop(name, None)

    def mainloop(self, n=0):
        mainloop(n)

    def quit(self):
        _loop['quit'] = True

    def willdispatch(self):
        pass

    def wantobjects(self, *a):
        return 1


# ---------------------------------------------------------------- Basisklassen
class Misc:
    _w = '.'
    _kind = 'misc'
    master = None

    def __str__(self):
        return self._w

    def __repr__(self):
        return '<%s.%s object %s>' % (type(self).__module__, type(self).__name__, self._w)

    # Optionen
    def configure(self, cnf=None, **kw):
        if isinstance(cnf, str) and not kw:
            key = _alias(cnf)
            return (key, key, key.capitalize(), None, self._opts.get(key))
        opts = dict(cnf or {})
        opts.update(kw)
        if not opts:
            return {k: (k, k, k.capitalize(), None, v) for k, v in self._opts.items()}
        self._configure(opts)

    config = configure

    def _configure(self, opts):
        clean = {_alias(k): v for k, v in opts.items()}
        if 'menu' in clean and isinstance(clean['menu'], Menu):
            clean['menu']._attached = self
        self._opts.update(clean)
        self._on_config(clean)
        _b.emit('config', id=self._w, opts=_prep(clean))

    def _on_config(self, opts):
        pass

    def cget(self, key):
        key = _alias(key)
        if key in self._opts:
            return self._opts[key]
        return self._defaults().get(key, '')

    def _defaults(self):
        return {}

    def __getitem__(self, key):
        return self.cget(key)

    def __setitem__(self, key, value):
        self.configure({key: value})

    def keys(self):
        return list(set(self._opts) | set(self._defaults()))

    # Bindungen
    def bind(self, sequence=None, func=None, add=None):
        return self._bind(self._w, sequence, func, add)

    def _bind(self, tag, sequence, func, add):
        table = _bindings.setdefault(tag, {})
        if sequence is None:
            return tuple(table)
        if func is None:
            return table.get(sequence)
        if isinstance(func, str):
            return None
        if add and str(add).startswith('+'):
            table.setdefault(sequence, []).append(func)
        else:
            table[sequence] = [func]
        _b.emit('bind', id=tag, seq=sequence)
        return _register(func)

    def unbind(self, sequence, funcid=None):
        table = _bindings.get(self._w, {})
        if funcid and sequence in table:
            func = _callbacks.get(funcid)
            table[sequence] = [f for f in table[sequence] if f is not func]
        else:
            table.pop(sequence, None)

    def bind_all(self, sequence=None, func=None, add=None):
        return self._bind('all', sequence, func, add)

    def unbind_all(self, sequence):
        _bindings.get('all', {}).pop(sequence, None)

    def bind_class(self, className, sequence=None, func=None, add=None):
        return self._bind('all', sequence, func, add)

    def unbind_class(self, className, sequence):
        self.unbind_all(sequence)

    def bindtags(self, tagList=None):
        if tagList is None:
            return tuple(_bindtags(self))

    def event_generate(self, sequence, **kw):
        etype, detail, mask, count = _parse_seq(sequence)
        data = dict(kw)
        data['type'] = etype
        if etype == 'Virtual':
            data['detail'] = sequence
        elif etype in ('ButtonPress', 'ButtonRelease'):
            data.setdefault('num', int(detail or 1))
        elif etype in ('KeyPress', 'KeyRelease'):
            data.setdefault('keysym', detail or '')
            data.setdefault('char', detail if detail and len(detail) == 1 else '')
        data['state'] = mask
        _dispatch_event(self, _make_event(self, data))

    def event_add(self, virtual, *sequences):
        pass

    def event_delete(self, virtual, *sequences):
        pass

    def event_info(self, virtual=None):
        return ()

    # Zeit
    def after(self, ms, func=None, *args):
        if func is None:
            if _b.can_block():
                _b.call('sleep', ms=int(ms))
            else:
                _time.sleep(int(ms) / 1000)
            return None
        return _schedule(int(ms), func, args)

    def after_idle(self, func, *args):
        return _schedule(0, func, args)

    def after_cancel(self, id):
        entry = _timer_ids.pop(id, None)
        if entry:
            entry[5] = False

    def update(self):
        _run_timers()
        _b.flush()
        if _b.can_block() and _roots:
            _process(0)

    def update_idletasks(self):
        _b.flush()

    def mainloop(self, n=0):
        mainloop(n)

    def quit(self):
        _loop['quit'] = True

    def wait_window(self, window=None):
        window = window or self
        _wait_until(lambda: window._w not in _widgets)

    def wait_variable(self, name='PY_VAR'):
        var = name if isinstance(name, Variable) else _vars.get(str(name))
        if var is None:
            return
        changed = [False]
        cb = var.trace_add('write', lambda *a: changed.__setitem__(0, True))
        _wait_until(lambda: changed[0])
        var.trace_remove('write', cb)

    waitvar = wait_variable

    def wait_visibility(self, window=None):
        _b.flush()

    # Fokus & Sonstiges
    def focus_set(self):
        _focus[0] = self._w
        _b.emit('focus', id=self._w)

    focus = focus_set
    focus_force = focus_set

    def focus_get(self):
        return _widgets.get(_focus[0]) if _focus[0] else None

    focus_displayof = focus_get
    focus_lastfor = focus_get

    def tk_focusNext(self):
        return None

    def grab_set(self):
        pass

    grab_set_global = grab_set

    def grab_release(self):
        pass

    def grab_current(self):
        return None

    def grab_status(self):
        return None

    def bell(self, displayof=0):
        _b.emit('bell')

    def clipboard_clear(self, **kw):
        _clipboard[0] = ''

    def clipboard_append(self, string, **kw):
        _clipboard[0] += str(string)
        _b.emit('clipboard', text=_clipboard[0])

    def clipboard_get(self, **kw):
        return _clipboard[0]

    def selection_get(self, **kw):
        return _clipboard[0]

    def option_add(self, pattern, value, priority=None):
        pass

    def option_clear(self):
        pass

    def option_get(self, name, className):
        return ''

    def option_readfile(self, fileName, priority=None):
        pass

    def register(self, func, subst=None, needcleanup=1):
        return _register(func)

    _register = register

    def nametowidget(self, name):
        name = str(name)
        if name in _widgets:
            return _widgets[name]
        if not name.startswith('.'):
            name = (self._w.rstrip('.') + '.' + name) if self._w != '.' else '.' + name
        if name in _widgets:
            return _widgets[name]
        raise KeyError(name)

    _nametowidget = nametowidget

    def getvar(self, name='PY_VAR'):
        v = _vars.get(str(name))
        return v.get() if v else ''

    def setvar(self, name='PY_VAR', value='1'):
        v = _vars.get(str(name)) or StringVar(name=str(name))
        v.set(value)

    def getint(self, s):
        return int(s)

    def getdouble(self, s):
        return float(s)

    def getboolean(self, s):
        return getboolean(s)

    def image_names(self):
        return tuple(_images)

    def image_types(self):
        return ('photo', 'bitmap')

    def destroy(self):
        for child in list(self.children.values()):
            child.destroy()
        if self._w in _widgets:
            ev = _make_event(self, {'type': 'Destroy'})
            _dispatch_event(self, ev)
        _widgets.pop(self._w, None)
        _bindings.pop(self._w, None)
        if self.master is not None and getattr(self.master, 'children', None) is not None:
            for key, value in list(self.master.children.items()):
                if value is self:
                    del self.master.children[key]
        _b.emit('destroy', id=self._w)

    # winfo
    def winfo_children(self):
        return list(self.children.values())

    def winfo_toplevel(self):
        widget = self
        while widget is not None and not isinstance(widget, (Tk, Toplevel)):
            widget = widget.master
        return widget or self

    def winfo_exists(self):
        return 1 if self._w in _widgets else 0

    def winfo_ismapped(self):
        return 1 if self._w in _widgets and getattr(self, '_manager', True) else 0

    winfo_viewable = winfo_ismapped

    def _size(self):
        if self._w not in _sizes and _b.can_block() and _roots:
            _b.flush()
            _process(0)
        return _sizes.get(self._w, (1, 1))

    def winfo_width(self):
        return int(self._size()[0])

    def winfo_height(self):
        return int(self._size()[1])

    winfo_reqwidth = winfo_width
    winfo_reqheight = winfo_height

    def winfo_x(self):
        return int(_sizes.get(self._w, (0, 0, 0, 0))[2:3][0] if len(_sizes.get(self._w, ())) > 2 else 0)

    def winfo_y(self):
        return int(_sizes.get(self._w, (0, 0, 0, 0))[3:4][0] if len(_sizes.get(self._w, ())) > 3 else 0)

    winfo_rootx = winfo_x
    winfo_rooty = winfo_y

    def winfo_screenwidth(self):
        return int(_screen[0])

    def winfo_screenheight(self):
        return int(_screen[1])

    def winfo_vrootwidth(self):
        return int(_screen[0])

    def winfo_vrootheight(self):
        return int(_screen[1])

    def winfo_pointerx(self):
        return int(_pointer[0])

    def winfo_pointery(self):
        return int(_pointer[1])

    def winfo_pointerxy(self):
        return (int(_pointer[0]), int(_pointer[1]))

    def winfo_class(self):
        return type(self).__name__

    def winfo_name(self):
        return self._w.split('.')[-1] or 'tk'

    def winfo_parent(self):
        return self.master._w if self.master else ''

    def winfo_id(self):
        return abs(hash(self._w)) % 100000000

    def winfo_fpixels(self, number):
        return float(str(number).rstrip('pcim') or 0)

    def winfo_pixels(self, number):
        return int(self.winfo_fpixels(number))

    def winfo_rgb(self, color):
        r, g, b = _parse_color(color)
        return (r * 257, g * 257, b * 257)

    def winfo_depth(self):
        return 24

    def winfo_screendepth(self):
        return 24

    def winfo_manager(self):
        return getattr(self, '_manager', '') or ''

    def winfo_geometry(self):
        w, h = self._size()[:2]
        return '%dx%d+0+0' % (w, h)

    def winfo_containing(self, rootX, rootY, displayof=0):
        return None

    # Geometrie-Container
    def pack_propagate(self, flag=None):
        if flag is None:
            return self._opts.get('_propagate', True)
        self._opts['_propagate'] = bool(flag)
        _b.emit('propagate', id=self._w, flag=bool(flag))

    propagate = pack_propagate
    grid_propagate = pack_propagate

    def pack_slaves(self):
        return [w for w in self.children.values() if getattr(w, '_manager', None) == 'pack']

    slaves = pack_slaves

    def grid_slaves(self, row=None, column=None):
        out = [w for w in self.children.values() if getattr(w, '_manager', None) == 'grid']
        if row is not None:
            out = [w for w in out if int(w._ginfo.get('row', 0)) == row]
        if column is not None:
            out = [w for w in out if int(w._ginfo.get('column', 0)) == column]
        return out

    def place_slaves(self):
        return [w for w in self.children.values() if getattr(w, '_manager', None) == 'place']

    def grid_columnconfigure(self, index, cnf={}, **kw):
        opts = dict(cnf)
        opts.update(kw)
        indexes = index if isinstance(index, (list, tuple)) else [index]
        for i in indexes:
            if isinstance(i, Misc):
                i = int(i._ginfo.get('column', 0))
            if i == 'all':
                continue
            _b.emit('gridconf', id=self._w, axis='col', index=int(i), opts=opts)

    columnconfigure = grid_columnconfigure

    def grid_rowconfigure(self, index, cnf={}, **kw):
        opts = dict(cnf)
        opts.update(kw)
        indexes = index if isinstance(index, (list, tuple)) else [index]
        for i in indexes:
            if isinstance(i, Misc):
                i = int(i._ginfo.get('row', 0))
            _b.emit('gridconf', id=self._w, axis='row', index=int(i), opts=opts)

    rowconfigure = grid_rowconfigure

    def grid_size(self):
        cols = rows = 0
        for w in self.grid_slaves():
            cols = max(cols, int(w._ginfo.get('column', 0)) + int(w._ginfo.get('columnspan', 1)))
            rows = max(rows, int(w._ginfo.get('row', 0)) + int(w._ginfo.get('rowspan', 1)))
        return (cols, rows)

    size = grid_size

    def grid_bbox(self, column=None, row=None, col2=None, row2=None):
        return (0, 0, self.winfo_width(), self.winfo_height())

    bbox = grid_bbox

    def grid_anchor(self, anchor=None):
        pass

    def lift(self, aboveThis=None):
        _b.emit('raise', id=self._w)

    tkraise = lift

    def lower(self, belowThis=None):
        pass

    def tk_setPalette(self, *args, **kw):
        pass

    def tk_strictMotif(self, boolean=None):
        return 0


class Wm:
    def _wm_init(self):
        self._protocols = {}
        self._title = ''

    def wm_title(self, string=None):
        if string is None:
            return self._title
        self._title = str(string)
        _b.emit('title', id=self._w, title=self._title)

    title = wm_title

    def wm_geometry(self, newGeometry=None):
        if newGeometry is None:
            w, h = self._size()[:2]
            return '%dx%d+%d+%d' % (w, h, 80, 60)
        import re
        m = re.match(r'^\s*(?:(\d+)x(\d+))?\s*(?:([+-]-?\d+)([+-]-?\d+))?\s*$', str(newGeometry))
        if not m:
            raise TclError('bad geometry specifier "%s"' % newGeometry)
        _b.emit('geometry', id=self._w, w=m.group(1) and int(m.group(1)), h=m.group(2) and int(m.group(2)),
                x=m.group(3) and int(m.group(3)), y=m.group(4) and int(m.group(4)))
        if m.group(1):
            _sizes[self._w] = (int(m.group(1)), int(m.group(2)))
        return ''

    geometry = wm_geometry

    def wm_resizable(self, width=None, height=None):
        if width is None:
            return (1, 1)
        _b.emit('resizable', id=self._w, w=bool(width), h=bool(height if height is not None else width))

    resizable = wm_resizable

    def wm_minsize(self, width=None, height=None):
        if width is None:
            return (1, 1)
        _b.emit('minsize', id=self._w, w=width, h=height)

    minsize = wm_minsize

    def wm_maxsize(self, width=None, height=None):
        if width is None:
            return tuple(_screen)

    maxsize = wm_maxsize

    def wm_protocol(self, name=None, func=None):
        if name is None:
            return tuple(self._protocols)
        if func is None:
            return self._protocols.get(name, '')
        self._protocols[name] = func
        return ''

    protocol = wm_protocol

    def wm_iconbitmap(self, bitmap=None, default=None):
        return ''

    iconbitmap = wm_iconbitmap

    def wm_iconphoto(self, default=False, *args):
        return ''

    iconphoto = wm_iconphoto

    def wm_iconname(self, newName=None):
        return ''

    iconname = wm_iconname

    def wm_state(self, newstate=None):
        if newstate is None:
            return getattr(self, '_state', 'normal')
        self._state = newstate
        _b.emit('wmstate', id=self._w, state=newstate)

    state = wm_state

    def wm_withdraw(self):
        self.wm_state('withdrawn')

    withdraw = wm_withdraw

    def wm_deiconify(self):
        self.wm_state('normal')

    deiconify = wm_deiconify

    def wm_iconify(self):
        self.wm_state('iconic')

    iconify = wm_iconify

    def wm_attributes(self, *args, **kw):
        args = list(args)
        for k, v in kw.items():
            args += ['-' + k, v]
        if len(args) <= 1:
            return ''
        for i in range(0, len(args) - 1, 2):
            key = str(args[i]).lstrip('-')
            _b.emit('wmattr', id=self._w, key=key, value=args[i + 1])
        return ''

    attributes = wm_attributes

    def wm_overrideredirect(self, boolean=None):
        if boolean is None:
            return 0
        _b.emit('wmattr', id=self._w, key='overrideredirect', value=bool(boolean))

    overrideredirect = wm_overrideredirect

    def wm_transient(self, master=None):
        return ''

    transient = wm_transient

    def wm_group(self, pathName=None):
        return ''

    group = wm_group

    def wm_focusmodel(self, model=None):
        return 'passive'

    focusmodel = wm_focusmodel

    def wm_positionfrom(self, who=None):
        return ''

    positionfrom = wm_positionfrom

    def wm_sizefrom(self, who=None):
        return ''

    sizefrom = wm_sizefrom

    def wm_aspect(self, *args):
        return ''

    aspect = wm_aspect

    def wm_frame(self):
        return self._w

    frame = wm_frame

    def wm_client(self, name=None):
        return ''

    client = wm_client


class Tk(Misc, Wm):
    _kind = 'tk'

    def __init__(self, screenName=None, baseName=None, className='Tk', useTk=True, sync=False, use=None):
        global _default_root
        self.master = None
        self.children = {}
        self._opts = {}
        self._wm_init()
        n = sum(1 for r in _roots if isinstance(r, Tk))
        self._w = '.' if not any(r._w == '.' for r in _roots) else '.tk%d' % (n + 1)
        self.tk = _TkApp(self)
        self._title = className.lower() if className != 'Tk' else 'tk'
        _widgets[self._w] = self
        _roots.append(self)
        if _support_default_root and _default_root is None:
            _default_root = self
        _b.emit('window', id=self._w, title=self._title, kind='tk')

    def destroy(self):
        global _default_root
        Misc.destroy(self)
        if self in _roots:
            _roots.remove(self)
        if _default_root is self:
            _default_root = None
            for r in list(_roots):  # Toplevels gehören zur Wurzel
                if isinstance(r, Toplevel):
                    r.destroy()

    def report_callback_exception(self, exc, val, tb):
        _report()

    def readprofile(self, baseName, className):
        pass

    def loadtk(self):
        pass



def Tcl(screenName=None, baseName=None, className='Tk', useTk=False):
    return Tk(screenName, baseName, className, useTk)


class Pack:
    def pack_configure(self, cnf={}, **kw):
        opts = dict(cnf)
        opts.update(kw)
        if 'in_' in opts:
            opts['in'] = opts.pop('in_')
        self._manager = 'pack'
        self._pinfo = opts
        _b.emit('pack', id=self._w, opts=_prep(opts))

    pack = pack_configure

    def pack_forget(self):
        self._manager = None
        _b.emit('forget', id=self._w)

    forget = pack_forget

    def pack_info(self):
        info = {'in': self.master, 'anchor': 'center', 'expand': 0, 'fill': 'none', 'ipadx': 0, 'ipady': 0,
                'padx': 0, 'pady': 0, 'side': 'top'}
        info.update(getattr(self, '_pinfo', {}))
        return info

    info = pack_info


class Place:
    def place_configure(self, cnf={}, **kw):
        opts = dict(cnf)
        opts.update(kw)
        if 'in_' in opts:
            opts['in'] = opts.pop('in_')
        self._manager = 'place'
        self._plinfo = opts
        _b.emit('place', id=self._w, opts=_prep(opts))

    place = place_configure

    def place_forget(self):
        self._manager = None
        _b.emit('forget', id=self._w)

    def place_info(self):
        return dict(getattr(self, '_plinfo', {}))


class Grid:
    def grid_configure(self, cnf={}, **kw):
        opts = dict(getattr(self, '_ginfo', {})) if getattr(self, '_manager', None) == 'grid' else {}
        opts.update(cnf)
        opts.update(kw)
        if 'in_' in opts:
            opts['in'] = opts.pop('in_')
        if 'row' not in opts:
            siblings = [w for w in self.master.children.values() if getattr(w, '_manager', None) == 'grid' and w is not self]
            opts['row'] = max([int(w._ginfo.get('row', 0)) for w in siblings], default=-1) + 1
        self._manager = 'grid'
        self._ginfo = opts
        _b.emit('grid', id=self._w, opts=_prep(opts))

    grid = grid_configure

    def grid_forget(self):
        self._manager = None
        _b.emit('forget', id=self._w)

    grid_remove = grid_forget

    def grid_info(self):
        info = {'in': self.master, 'column': 0, 'row': 0, 'columnspan': 1, 'rowspan': 1, 'ipadx': 0, 'ipady': 0,
                'padx': 0, 'pady': 0, 'sticky': ''}
        info.update(getattr(self, '_ginfo', {}))
        return info

    location = Misc.grid_bbox


class BaseWidget(Misc):
    _kind = 'frame'
    _count = {}

    def __init__(self, master=None, cnf={}, **kw):
        if master is None:
            master = _get_default_root()
        self.master = master
        self.tk = getattr(master, 'tk', None)
        self.children = {}
        self._manager = None
        opts = dict(cnf)
        opts.update(kw)
        name = opts.pop('name', None)
        if not name:
            cls = type(self).__name__.lower()
            key = (master._w, cls)
            BaseWidget._count[key] = BaseWidget._count.get(key, 0) + 1
            count = BaseWidget._count[key]
            name = '!%s%s' % (cls, count if count > 1 else '')
        self._name = name
        self._w = ('.' + name) if master._w == '.' else master._w + '.' + name
        old = master.children.get(name)
        if old is not None:
            old.destroy()
        master.children[name] = self
        self._opts = {_alias(k): v for k, v in opts.items()}
        _widgets[self._w] = self
        self._setup()
        self._create()

    def _setup(self):
        pass

    def _create(self):
        top = self.winfo_toplevel()
        _b.emit('create', id=self._w, kind=self._kind, parent=self.master._w, win=top._w,
                ttk=getattr(self, '_ttk', None), opts=_prep(self._opts))

    def _from_js(self, value):
        pass


class Widget(BaseWidget, Pack, Place, Grid):
    pass


class Toplevel(BaseWidget, Wm):
    _kind = 'toplevel'

    def _setup(self):
        self._wm_init()
        self._title = 'tk'
        _roots.append(self)

    def _create(self):
        _b.emit('window', id=self._w, title=self._title, kind='toplevel', parent=self.master._w, opts=_prep(self._opts))

    def destroy(self):
        Misc.destroy(self)
        if self in _roots:
            _roots.remove(self)


# ---------------------------------------------------------------- Einfache Widgets
class Frame(Widget):
    _kind = 'frame'

    def __init__(self, master=None, cnf={}, **kw):
        kw = dict(cnf, **kw)
        if 'class_' in kw:
            kw.pop('class_')
        Widget.__init__(self, master, kw)


class Label(Widget):
    _kind = 'label'


class Message(Widget):
    _kind = 'message'


class LabelFrame(Widget):
    _kind = 'labelframe'


class PanedWindow(Widget):
    _kind = 'paned'

    def add(self, child, **kw):
        child._manager = 'paned'
        _b.emit('paneadd', id=self._w, child=child._w, opts=_prep(kw))

    def forget(self, child):
        child._manager = None
        _b.emit('forget', id=child._w)

    remove = forget

    def panes(self):
        return [w for w in self.children.values() if getattr(w, '_manager', None) == 'paned']

    def paneconfigure(self, tagOrId, cnf=None, **kw):
        pass

    paneconfig = paneconfigure

    def sash_place(self, index, x, y):
        pass

    def sash_coord(self, index):
        return (0, 0)


class Button(Widget):
    _kind = 'button'

    def invoke(self):
        cmd = self._opts.get('command')
        if cmd and self._opts.get('state') != DISABLED:
            return cmd()

    def flash(self):
        pass


class Checkbutton(Widget):
    _kind = 'checkbutton'

    def _setup(self):
        if self._opts.get('variable') is None:
            self._opts['variable'] = IntVar(name=self._w.replace('.', '_').lstrip('_') or 'cb')
        var = self._opts['variable']
        if not isinstance(var, Variable):
            self._opts['variable'] = _vars.get(str(var)) or StringVar(name=str(var))

    def _on_value(self):
        return self._opts.get('onvalue', 1)

    def select(self):
        self._opts['variable'].set(self._on_value())

    def deselect(self):
        self._opts['variable'].set(self._opts.get('offvalue', 0))

    def toggle(self):
        var = self._opts['variable']
        if str(var.get()) == str(self._on_value()) or var.get() is True:
            self.deselect()
        else:
            self.select()

    def invoke(self):
        self.toggle()
        cmd = self._opts.get('command')
        if cmd:
            return cmd()


class Radiobutton(Widget):
    _kind = 'radiobutton'

    def _setup(self):
        if self._opts.get('variable') is None:
            self._opts['variable'] = StringVar(name='selectedButton')

    def select(self):
        self._opts['variable'].set(self._opts.get('value', ''))

    def deselect(self):
        self._opts['variable'].set('')

    def invoke(self):
        self.select()
        cmd = self._opts.get('command')
        if cmd:
            return cmd()


class Scale(Widget):
    _kind = 'scale'

    def _setup(self):
        self._value = self._opts.get('from', self._opts.get('from_', 0)) or 0
        var = self._opts.get('variable')
        if isinstance(var, Variable):
            try:
                self._value = var.get()
            except TclError:
                pass

    def _defaults(self):
        return {'from': 0, 'to': 100, 'orient': VERTICAL, 'resolution': 1}

    def _from_js(self, value):
        self._value = value

    def get(self):
        var = self._opts.get('variable')
        value = var.get() if isinstance(var, Variable) else self._value
        res = self._opts.get('resolution', 1)
        try:
            value = float(value)
        except (TypeError, ValueError):
            return 0
        if float(res) == int(float(res)) and value == int(value):
            return int(value)
        return value

    def set(self, value):
        self._value = value
        var = self._opts.get('variable')
        if isinstance(var, Variable):
            var.set(value)
        _b.emit('value', id=self._w, value=value)

    def coords(self, value=None):
        return (0, 0)

    def identify(self, x, y):
        return ''


class Scrollbar(Widget):
    _kind = 'scrollbar'

    def set(self, first, last):
        pass

    def get(self):
        return (0.0, 1.0)

    def activate(self, index=None):
        pass

    def delta(self, deltax, deltay):
        return 0.0

    def fraction(self, x, y):
        return 0.0

    def identify(self, x, y):
        return ''


def _index_value(index, length, cursor=None):
    if index in (END, 'end'):
        return length
    if index in (INSERT, 'insert'):
        return length if cursor is None else cursor
    if index in (ANCHOR, 'anchor'):
        return cursor or 0
    try:
        return max(0, min(length, int(index)))
    except (TypeError, ValueError):
        raise TclError('bad entry index "%s"' % index) from None


class Entry(Widget):
    _kind = 'entry'

    def _setup(self):
        var = self._opts.get('textvariable')
        self._text = var.get() if isinstance(var, Variable) else ''
        self._cursor = None

    def _from_js(self, value):
        if isinstance(value, dict):
            self._cursor = value.get('cursor')
            value = value.get('value', '')
        self._text = str(value)

    def _sync(self):
        var = self._opts.get('textvariable')
        if isinstance(var, Variable):
            var.set(self._text)
        else:
            _b.emit('value', id=self._w, value=self._text)

    def get(self):
        var = self._opts.get('textvariable')
        if isinstance(var, Variable):
            return str(var.get())
        return self._text

    def insert(self, index, string):
        if str(self._opts.get('state', NORMAL)) in (DISABLED, 'readonly'):
            return
        self._text = self.get()
        i = _index_value(index, len(self._text), self._cursor)
        self._text = self._text[:i] + str(string) + self._text[i:]
        self._sync()

    def delete(self, first, last=None):
        if str(self._opts.get('state', NORMAL)) in (DISABLED, 'readonly'):
            return
        self._text = self.get()
        a = _index_value(first, len(self._text), self._cursor)
        b = a + 1 if last is None else _index_value(last, len(self._text), self._cursor)
        self._text = self._text[:a] + self._text[b:]
        self._sync()

    def icursor(self, index):
        _b.emit('cursor', id=self._w, index=_index_value(index, len(self.get()), self._cursor))

    def index(self, index):
        return _index_value(index, len(self.get()), self._cursor)

    def select_range(self, start, end):
        _b.emit('selrange', id=self._w, start=self.index(start), end=self.index(end))

    selection_range = select_range

    def select_clear(self):
        pass

    selection_clear = select_clear

    def select_present(self):
        return False

    selection_present = select_present

    def select_from(self, index):
        pass

    def select_to(self, index):
        pass

    def select_adjust(self, index):
        pass

    def xview(self, *args):
        return (0.0, 1.0)

    def xview_moveto(self, fraction):
        pass

    def xview_scroll(self, number, what):
        pass

    def scan_mark(self, x):
        pass

    def scan_dragto(self, x):
        pass


class Spinbox(Entry):
    _kind = 'spinbox'

    def _setup(self):
        Entry._setup(self)
        if not self._text:
            values = self._opts.get('values')
            if values:
                self._text = str((values.split() if isinstance(values, str) else list(values))[0])
            else:
                start = self._opts.get('from', self._opts.get('from_', 0))
                self._text = str(start) if start is not None else ''

    def invoke(self, element):
        pass

    def set(self, value):
        self._text = str(value)
        self._sync()


# ---------------------------------------------------------------- Text
class Text(Widget):
    _kind = 'text'

    def _setup(self):
        self._text = '\n'
        self._cursor = None
        self._sel = None
        self._marks = {}
        self._tags = {}

    def _from_js(self, value):
        if isinstance(value, dict):
            self._cursor = value.get('cursor')
            self._sel = value.get('sel')
            value = value.get('value', '')
        self._text = str(value) + '\n'

    def _offset(self, index):
        index = str(index).strip()
        text = self._text
        import re
        m = re.match(r'^([^\s+-]+(?:\.[^\s+-]+)?)(.*)$', index)
        base, mods = (m.group(1), m.group(2)) if m else (index, '')
        if base == 'end':
            pos = len(text)
        elif base == 'insert':
            pos = len(text) - 1 if self._cursor is None else self._cursor
        elif base in ('sel.first', 'sel.last'):
            if not self._sel:
                raise TclError('text doesn\'t contain any characters tagged with "sel"')
            pos = self._sel[0 if base == 'sel.first' else 1]
        elif base == 'current':
            pos = len(text) - 1
        elif base in self._marks:
            pos = self._marks[base]
        elif re.match(r'^\d+\.(\d+|end)$', base):
            line, col = base.split('.')
            lines = text.split('\n')
            line = int(line)
            if line < 1:
                pos = 0
            elif line > len(lines) - 1:
                pos = len(text)
            else:
                start = sum(len(l) + 1 for l in lines[:line - 1])
                width = len(lines[line - 1])
                pos = start + (width if col == 'end' else min(int(col), width))
        elif base.startswith('@'):
            pos = len(text) - 1
        else:
            try:
                pos = int(float(base))
            except ValueError:
                raise TclError('bad text index "%s"' % index) from None
        for mod in re.findall(r'([+-])\s*(\d+)\s*(c|chars|l|lines|char|line)|\s+(linestart|lineend|wordstart|wordend)', mods):
            sign, num, unit, word = mod
            if word == 'linestart':
                pos = text.rfind('\n', 0, pos) + 1
            elif word == 'lineend':
                end = text.find('\n', pos)
                pos = len(text) if end < 0 else end
            elif word == 'wordstart':
                while pos > 0 and (text[pos - 1].isalnum() or text[pos - 1] == '_'):
                    pos -= 1
            elif word == 'wordend':
                while pos < len(text) and (text[pos].isalnum() or text[pos] == '_'):
                    pos += 1
            elif unit.startswith('c'):
                pos += int(num) if sign == '+' else -int(num)
            else:
                line_start = text.rfind('\n', 0, pos) + 1
                col = pos - line_start
                lines = text.split('\n')
                line_no = text.count('\n', 0, pos) + (int(num) if sign == '+' else -int(num))
                line_no = max(0, min(len(lines) - 1, line_no))
                pos = sum(len(l) + 1 for l in lines[:line_no]) + min(col, len(lines[line_no]))
        return max(0, min(len(text), pos))

    def index(self, index):
        pos = self._offset(index)
        line = self._text.count('\n', 0, pos) + 1
        col = pos - (self._text.rfind('\n', 0, pos) + 1)
        return '%d.%d' % (line, col)

    def _push(self):
        _b.emit('value', id=self._w, value=self._text[:-1])

    def get(self, index1, index2=None):
        a = self._offset(index1)
        b = a + 1 if index2 is None else self._offset(index2)
        return self._text[a:b] if b > a else ''

    def insert(self, index, chars, *args):
        if str(self._opts.get('state', NORMAL)) == DISABLED:
            return
        pos = min(self._offset(index), len(self._text) - 1)
        chars = str(chars)
        for extra in args[1::2]:
            chars += str(extra)
        self._text = self._text[:pos] + chars + self._text[pos:]
        tag = args[0] if args else None
        if tag:
            tags = (tag,) if isinstance(tag, str) else tuple(tag)
            _b.emit('textspan', id=self._w, start=pos, end=pos + len(chars), tags=list(tags))
        self._push()

    def delete(self, index1, index2=None):
        if str(self._opts.get('state', NORMAL)) == DISABLED:
            return
        a = self._offset(index1)
        b = a + 1 if index2 is None else self._offset(index2)
        b = min(b, len(self._text) - 1)
        if b > a:
            self._text = self._text[:a] + self._text[b:]
            self._push()

    def replace(self, index1, index2, chars, *args):
        self.delete(index1, index2)
        self.insert(index1, chars, *args)

    def see(self, index):
        _b.emit('see', id=self._w, pos=self._offset(index))

    def mark_set(self, markName, index):
        pos = self._offset(index)
        self._marks[markName] = pos
        if markName == 'insert':
            self._cursor = pos
            _b.emit('cursor', id=self._w, index=pos)

    def mark_unset(self, *names):
        for n in names:
            self._marks.pop(n, None)

    def mark_names(self):
        return ('insert', 'current') + tuple(self._marks)

    def mark_gravity(self, markName, direction=None):
        return 'right'

    def tag_configure(self, tagName, cnf=None, **kw):
        opts = dict(cnf or {})
        opts.update(kw)
        self._tags.setdefault(tagName, {}).update(opts)
        _b.emit('texttag', id=self._w, tag=tagName, opts=_prep(opts))

    tag_config = tag_configure

    def tag_cget(self, tagName, option):
        return self._tags.get(tagName, {}).get(option, '')

    def tag_add(self, tagName, index1, *args):
        a = self._offset(index1)
        b = self._offset(args[0]) if args else a + 1
        if tagName == 'sel':
            _b.emit('selrange', id=self._w, start=a, end=b)
        else:
            _b.emit('textspan', id=self._w, start=a, end=b, tags=[tagName])

    def tag_remove(self, tagName, index1, index2=None):
        _b.emit('textuntag', id=self._w, tag=tagName)

    def tag_delete(self, *tagNames):
        for t in tagNames:
            self._tags.pop(t, None)
            _b.emit('textuntag', id=self._w, tag=t)

    def tag_names(self, index=None):
        return tuple(self._tags)

    def tag_ranges(self, tagName):
        if tagName == 'sel' and self._sel:
            return (self.index(self._sel[0]), self.index(self._sel[1]))
        return ()

    def tag_bind(self, tagName, sequence, func, add=None):
        return self.bind(sequence, func, add)

    def tag_unbind(self, tagName, sequence, funcid=None):
        pass

    def tag_raise(self, tagName, aboveThis=None):
        pass

    def tag_lower(self, tagName, belowThis=None):
        pass

    def tag_nextrange(self, tagName, index1, index2=None):
        return ()

    def search(self, pattern, index, stopindex=None, forwards=None, backwards=None, exact=None, regexp=None,
               nocase=None, count=None, elide=None):
        start = self._offset(index)
        stop = self._offset(stopindex) if stopindex else len(self._text)
        hay = self._text
        if nocase:
            hay, pattern = hay.lower(), pattern.lower()
        if regexp:
            import re
            m = re.compile(pattern).search(hay, start, stop)
            pos = m.start() if m else -1
            if count is not None and m:
                count.set(m.end() - m.start())
        else:
            pos = hay.rfind(pattern, 0, start) if backwards else hay.find(pattern, start, stop)
            if count is not None and pos >= 0:
                count.set(len(pattern))
        return self.index(pos) if pos >= 0 else ''

    def count(self, index1, index2, *args):
        return (abs(self._offset(index2) - self._offset(index1)),)

    def edit_undo(self):
        _b.emit('textcmd', id=self._w, cmd='undo')

    def edit_redo(self):
        _b.emit('textcmd', id=self._w, cmd='redo')

    def edit_reset(self):
        pass

    def edit_separator(self):
        pass

    def edit_modified(self, arg=None):
        return 0

    def edit(self, *args):
        return ''

    def window_create(self, index, cnf={}, **kw):
        pass

    def image_create(self, index, cnf={}, **kw):
        pass

    def xview(self, *args):
        return (0.0, 1.0)

    def yview(self, *args):
        if args and args[0] == 'end':
            self.see('end')
        return (0.0, 1.0)

    def yview_moveto(self, fraction):
        if fraction >= 1:
            self.see('end')

    def yview_scroll(self, number, what):
        pass

    def xview_moveto(self, fraction):
        pass

    def bbox(self, index):
        return None

    def dlineinfo(self, index):
        return None

    def compare(self, index1, op, index2):
        a, b = self._offset(index1), self._offset(index2)
        return {'<': a < b, '<=': a <= b, '==': a == b, '>=': a >= b, '>': a > b, '!=': a != b}[op]

    def dump(self, index1, index2=None, command=None, **kw):
        return [('text', self.get(index1, index2), index1)]


# ---------------------------------------------------------------- Listbox
class Listbox(Widget):
    _kind = 'listbox'

    def _setup(self):
        self._items = []
        self._sel = []
        self._colors = {}
        var = self._opts.get('listvariable')
        if isinstance(var, Variable):
            self._items = self._from_var(var.get())
            var.trace_add('write', lambda *a: self._var_changed())

    def _from_var(self, value):
        if isinstance(value, (list, tuple)):
            return [str(v) for v in value]
        value = str(value).strip()
        if value.startswith('(') and value.endswith(')'):
            import ast
            try:
                return [str(v) for v in ast.literal_eval(value)]
            except Exception:
                pass
        return value.split() if value else []

    def _var_changed(self):
        self._items = self._from_var(self._opts['listvariable'].get())
        self._push()

    def _from_js(self, value):
        self._sel = list(value or [])

    def _push(self):
        _b.emit('lb', id=self._w, items=self._items, sel=self._sel, colors=self._colors)

    def _index(self, index):
        if index in (END, 'end'):
            return len(self._items)
        if index in (ACTIVE, 'active', ANCHOR, 'anchor'):
            return self._sel[0] if self._sel else 0
        if isinstance(index, str) and index.startswith('@'):
            return 0
        return int(index)

    def insert(self, index, *elements):
        i = self._index(index)
        for offset, e in enumerate(elements):
            self._items.insert(i + offset, str(e) if not isinstance(e, (list, tuple)) else ' '.join(map(str, e)))
        self._sel = [s + len(elements) if s >= i else s for s in self._sel]
        self._push()

    def delete(self, first, last=None):
        a = self._index(first)
        b = a if last is None else min(self._index(last), len(self._items) - 1)
        if a > b:
            return
        del self._items[a:b + 1]
        self._sel = [s if s < a else s - (b - a + 1) for s in self._sel if not (a <= s <= b)]
        self._push()

    def get(self, first, last=None):
        if last is None:
            i = self._index(first)
            if 0 <= i < len(self._items):
                return self._items[i]
            return ''
        a, b = self._index(first), self._index(last)
        return tuple(self._items[a:b + 1])

    def size(self):
        return len(self._items)

    def curselection(self):
        return tuple(self._sel)

    def selection_set(self, first, last=None):
        a = self._index(first)
        b = a if last is None else min(self._index(last), len(self._items) - 1)
        mode = self._opts.get('selectmode', BROWSE)
        if mode in (BROWSE, SINGLE):
            self._sel = [b]
        else:
            self._sel = sorted(set(self._sel) | set(range(a, b + 1)))
        self._push()

    select_set = selection_set

    def selection_clear(self, first, last=None):
        a = self._index(first)
        b = a if last is None else self._index(last)
        self._sel = [s for s in self._sel if not (a <= s <= b)]
        self._push()

    select_clear = selection_clear

    def selection_includes(self, index):
        return self._index(index) in self._sel

    select_includes = selection_includes

    def selection_anchor(self, index):
        pass

    select_anchor = selection_anchor

    def activate(self, index):
        pass

    def see(self, index):
        _b.emit('see', id=self._w, pos=self._index(index))

    def nearest(self, y):
        return max(0, min(len(self._items) - 1, int(y) // 18))

    def index(self, index):
        return self._index(index)

    def itemconfigure(self, index, cnf=None, **kw):
        opts = dict(cnf or {})
        opts.update(kw)
        self._colors.setdefault(str(self._index(index)), {}).update({_alias(k): v for k, v in opts.items()})
        self._push()

    itemconfig = itemconfigure

    def itemcget(self, index, option):
        return self._colors.get(str(self._index(index)), {}).get(_alias(option), '')

    def bbox(self, index):
        return (0, self._index(index) * 18, 100, 18)

    def xview(self, *args):
        return (0.0, 1.0)

    def yview(self, *args):
        return (0.0, 1.0)

    def yview_moveto(self, fraction):
        pass

    def yview_scroll(self, number, what):
        pass


# ---------------------------------------------------------------- Menüs
class Menu(Widget):
    _kind = 'menu'

    def _setup(self):
        self._entries = []
        self._attached = None

    def _push(self):
        items = []
        for e in self._entries:
            item = {k: _jsval(k, v) for k, v in e.items()}
            items.append(item)
        _b.emit('menu', id=self._w, items=items)

    def add(self, itemType, cnf={}, **kw):
        entry = dict(cnf)
        entry.update(kw)
        entry['type'] = itemType
        self._entries.append(entry)
        self._push()

    def add_command(self, cnf={}, **kw):
        self.add('command', cnf, **kw)

    def add_cascade(self, cnf={}, **kw):
        self.add('cascade', cnf, **kw)

    def add_checkbutton(self, cnf={}, **kw):
        kw = dict(cnf, **kw)
        if kw.get('variable') is None:
            kw['variable'] = IntVar()
        self.add('checkbutton', kw)

    def add_radiobutton(self, cnf={}, **kw):
        self.add('radiobutton', cnf, **kw)

    def add_separator(self, cnf={}, **kw):
        self.add('separator', cnf, **kw)

    def insert(self, index, itemType, cnf={}, **kw):
        entry = dict(cnf)
        entry.update(kw)
        entry['type'] = itemType
        self._entries.insert(self._index(index), entry)
        self._push()

    def insert_command(self, index, cnf={}, **kw):
        self.insert(index, 'command', cnf, **kw)

    def insert_separator(self, index, cnf={}, **kw):
        self.insert(index, 'separator', cnf, **kw)

    def insert_cascade(self, index, cnf={}, **kw):
        self.insert(index, 'cascade', cnf, **kw)

    def _index(self, index):
        if index in (END, 'end', 'last'):
            return len(self._entries)
        if isinstance(index, int):
            return index
        for i, e in enumerate(self._entries):
            if e.get('label') == index:
                return i
        try:
            return int(index)
        except ValueError:
            raise TclError('bad menu entry index "%s"' % index) from None

    def index(self, index):
        i = self._index(index)
        return None if not self._entries else min(i, len(self._entries) - 1)

    def delete(self, index1, index2=None):
        a = self._index(index1)
        b = a if index2 is None else min(self._index(index2), len(self._entries) - 1)
        del self._entries[a:b + 1]
        self._push()

    def entryconfigure(self, index, cnf=None, **kw):
        entry = self._entries[self._index(index)]
        if not kw and not cnf:
            return {k: (k, '', '', '', v) for k, v in entry.items()}
        entry.update(cnf or {})
        entry.update(kw)
        self._push()

    entryconfig = entryconfigure

    def entrycget(self, index, option):
        return self._entries[self._index(index)].get(option, '')

    def type(self, index):
        return self._entries[self._index(index)]['type']

    def invoke(self, index):
        entry = self._entries[self._index(index)]
        cmd = entry.get('command')
        if cmd:
            return cmd()

    def post(self, x, y):
        _b.emit('popup', id=self._w, x=x, y=y)

    def tk_popup(self, x, y, entry=''):
        self.post(x, y)

    def unpost(self):
        pass

    def activate(self, index):
        pass

    def yposition(self, index):
        return 0

    def xposition(self, index):
        return 0


class Menubutton(Widget):
    _kind = 'menubutton'


class OptionMenu(Menubutton):
    _kind = 'optionmenu'

    def __init__(self, master, variable, value=None, *values, **kwargs):
        command = kwargs.pop('command', None)
        self._choices = [v for v in ((value,) + values) if v is not None]
        self._command = command
        Menubutton.__init__(self, master, textvariable=variable, values=list(map(str, self._choices)),
                            command=(lambda v: command(v)) if command else None)
        self._variable = variable
        if value is not None and not variable.get():
            variable.set(value)
        self['menu'] = Menu(self, tearoff=0)

    def __getitem__(self, name):
        return self.cget(name)

    def destroy(self):
        Menubutton.destroy(self)


# ---------------------------------------------------------------- Bilder
def _png_size(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return _struct.unpack('>II', data[16:24])
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return _struct.unpack('<HH', data[6:10])
    if data[:2] == b'\xff\xd8':
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xC0, 0xC1, 0xC2):
                h, w = _struct.unpack('>HH', data[i + 5:i + 9])
                return (w, h)
            length = _struct.unpack('>H', data[i + 2:i + 4])[0]
            i += 2 + length
    return (0, 0)


def _mime(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return 'image/png'
    if data[:3] == b'GIF':
        return 'image/gif'
    if data[:2] == b'\xff\xd8':
        return 'image/jpeg'
    if data.lstrip()[:4] in (b'<svg', b'<?xm'):
        return 'image/svg+xml'
    return 'image/png'


def _encode_png(width, height, rows):
    raw = b''.join(b'\x00' + bytes(row) for row in rows)

    def chunk(tag, payload):
        return _struct.pack('>I', len(payload)) + tag + payload + _struct.pack('>I', _zlib.crc32(tag + payload) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', _struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) +
            chunk(b'IDAT', _zlib.compress(raw, 6)) + chunk(b'IEND', b''))


_NAMED = {'white': (255, 255, 255), 'black': (0, 0, 0), 'red': (255, 0, 0), 'green': (0, 255, 0), 'blue': (0, 0, 255),
          'yellow': (255, 255, 0), 'cyan': (0, 255, 255), 'magenta': (255, 0, 255), 'orange': (255, 165, 0),
          'purple': (160, 32, 240), 'gray': (190, 190, 190), 'grey': (190, 190, 190), 'pink': (255, 192, 203),
          'brown': (165, 42, 42), 'lightblue': (173, 216, 230), 'lightgreen': (144, 238, 144),
          'darkgreen': (0, 100, 0), 'darkblue': (0, 0, 139), 'navy': (0, 0, 128), 'gold': (255, 215, 0),
          'violet': (238, 130, 238), 'silver': (192, 192, 192), 'lime': (0, 255, 0), 'darkred': (139, 0, 0),
          'lightgray': (211, 211, 211), 'lightgrey': (211, 211, 211), 'darkgray': (169, 169, 169),
          'turquoise': (64, 224, 208), 'salmon': (250, 128, 114), 'beige': (245, 245, 220), 'skyblue': (135, 206, 235)}


def _parse_color(color):
    c = str(color).strip().lower().replace(' ', '')
    if c.startswith('#'):
        h = c[1:]
        if len(h) == 3:
            return tuple(int(x * 2, 16) for x in h)
        if len(h) == 6:
            return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
        if len(h) == 12:
            return tuple(int(h[i:i + 2], 16) for i in (0, 4, 8))
    if c in _NAMED:
        return _NAMED[c]
    if c.startswith(('gray', 'grey')) and c[4:].isdigit():
        v = round(int(c[4:]) * 2.55)
        return (v, v, v)
    raise TclError('unknown color name "%s"' % color)


class Image:
    _last_id = 0

    def __init__(self, imgtype, name=None, cnf={}, master=None, **kw):
        if name is None:
            Image._last_id += 1
            name = 'pyimage%d' % Image._last_id
        self.name = name
        self.tk = None
        _images[name] = self

    def __str__(self):
        return self.name

    def __del__(self):
        pass

    def configure(self, **kw):
        pass

    config = configure

    def __setitem__(self, key, value):
        self.configure(**{key: value})

    def __getitem__(self, key):
        return self.cget(key)

    def cget(self, key):
        return ''

    def type(self):
        return 'photo'

    def width(self):
        return self._w

    def height(self):
        return self._h


class PhotoImage(Image):
    def __init__(self, name=None, cnf={}, master=None, **kw):
        Image.__init__(self, 'photo', name, cnf, master)
        opts = dict(cnf)
        opts.update(kw)
        self._w = int(opts.get('width') or 0)
        self._h = int(opts.get('height') or 0)
        self._pixels = None
        self._bytes = None
        self._scale = (1, 1)
        if opts.get('file'):
            with open(opts['file'], 'rb') as fh:
                self._load(fh.read())
        elif opts.get('data'):
            data = opts['data']
            if isinstance(data, str):
                try:
                    data = _base64.b64decode(data)
                except Exception:
                    data = data.encode('latin-1')
            self._load(data)
        else:
            self._push()

    def _load(self, data):
        self._bytes = bytes(data)
        w, h = _png_size(self._bytes)
        self._w, self._h = self._w or w, self._h or h
        self._push()

    def _ensure_pixels(self):
        if self._pixels is None:
            self._pixels = [bytearray(max(1, self._w) * 4) for _ in range(max(1, self._h))]

    def _push(self):
        if self._pixels is not None:
            data = _encode_png(max(1, self._w), max(1, self._h), self._pixels)
            src = 'data:image/png;base64,' + _base64.b64encode(data).decode()
        elif self._bytes:
            src = 'data:%s;base64,%s' % (_mime(self._bytes), _base64.b64encode(self._bytes).decode())
        else:
            src = ''
        _b.emit('image', name=self.name, src=src, w=int(self._w * self._scale[0]), h=int(self._h * self._scale[1]))

    def width(self):
        return int(self._w * self._scale[0])

    def height(self):
        return int(self._h * self._scale[1])

    def blank(self):
        self._pixels = None
        self._bytes = None
        self._push()

    def cget(self, option):
        return {'width': self._w, 'height': self._h}.get(option, '')

    def configure(self, **kw):
        if 'file' in kw or 'data' in kw:
            self.__init__(name=self.name, **kw)

    config = configure

    def copy(self):
        img = PhotoImage(width=self._w, height=self._h)
        img._bytes = self._bytes
        img._pixels = [bytearray(r) for r in self._pixels] if self._pixels else None
        img._scale = self._scale
        img._push()
        return img

    def zoom(self, x, y=''):
        img = self.copy()
        y = x if y == '' else y
        img._scale = (self._scale[0] * x, self._scale[1] * y)
        img._push()
        return img

    def subsample(self, x, y=''):
        img = self.copy()
        y = x if y == '' else y
        img._scale = (self._scale[0] / x, self._scale[1] / y)
        img._push()
        return img

    def put(self, data, to=None):
        self._ensure_pixels()
        if isinstance(data, str) and not data.strip().startswith('{'):
            rows = [[data]]
        elif isinstance(data, str):
            import re
            rows = [r.split() for r in re.findall(r'\{([^}]*)\}', data)]
        else:
            rows = [list(r) if isinstance(r, (list, tuple)) else str(r).split() for r in data]
        x0, y0 = 0, 0
        fill = None
        if to:
            to = tuple(to)
            x0, y0 = int(to[0]), int(to[1])
            if len(to) == 4:
                fill = (int(to[2]), int(to[3]))
        if fill and len(rows) == 1 and len(rows[0]) == 1:
            rows = [[rows[0][0]] * (fill[0] - x0) for _ in range(fill[1] - y0)]
        for dy, row in enumerate(rows):
            for dx, color in enumerate(row):
                x, y = x0 + dx, y0 + dy
                if 0 <= x < self._w and 0 <= y < self._h:
                    r, g, b = _parse_color(color)
                    self._pixels[y][x * 4:x * 4 + 4] = bytes((r, g, b, 255))
        self._push()

    def get(self, x, y):
        if self._pixels is None:
            return (0, 0, 0)
        p = self._pixels[int(y)][int(x) * 4:int(x) * 4 + 3]
        return tuple(p)

    def transparency_get(self, x, y):
        return self._pixels is not None and self._pixels[int(y)][int(x) * 4 + 3] == 0

    def transparency_set(self, x, y, boolean):
        self._ensure_pixels()
        self._pixels[int(y)][int(x) * 4 + 3] = 0 if boolean else 255
        self._push()

    def write(self, filename, format=None, from_coords=None):
        if self._pixels is not None:
            data = _encode_png(max(1, self._w), max(1, self._h), self._pixels)
        else:
            data = self._bytes or b''
        with open(filename, 'wb') as fh:
            fh.write(data)

    def data(self, format=None, from_coords=None):
        return ''


class BitmapImage(Image):
    def __init__(self, name=None, cnf={}, master=None, **kw):
        Image.__init__(self, 'bitmap', name, cnf, master)
        self._w = self._h = 16

    def type(self):
        return 'bitmap'


def image_names():
    return tuple(_images)


def image_types():
    return ('photo', 'bitmap')


# ---------------------------------------------------------------- Canvas
class Canvas(Widget):
    _kind = 'canvas'

    def _setup(self):
        self._items = {}
        self._order = []
        self._next = 1
        self._tag_bindings = {}
        self._current = None

    def _defaults(self):
        return {'width': 378, 'height': 265, 'background': ''}

    def _create(self):
        Widget._create(self)

    def _new(self, itemtype, args, kw):
        coords = []
        rest = []
        for a in args:
            if isinstance(a, dict):
                kw = dict(a, **kw)
            elif isinstance(a, (list, tuple)):
                coords.extend(float(v) for v in _flatten(a))
            else:
                coords.append(float(a))
        item_id = self._next
        self._next += 1
        tags = kw.pop('tags', kw.pop('tag', ()))
        tags = (tags,) if isinstance(tags, str) else tuple(tags or ())
        opts = {_alias(k): v for k, v in kw.items()}
        self._items[item_id] = {'type': itemtype, 'coords': coords, 'opts': opts, 'tags': list(map(str, tags))}
        self._order.append(item_id)
        if itemtype == 'window' and isinstance(opts.get('window'), Misc):
            opts['window']._manager = 'canvas'
        _b.emit('citem', id=self._w, item=item_id, type=itemtype, coords=coords, opts=_prep(opts),
                tags=self._items[item_id]['tags'])
        return item_id

    def create_line(self, *args, **kw):
        return self._new('line', args, kw)

    def create_rectangle(self, *args, **kw):
        return self._new('rectangle', args, kw)

    def create_oval(self, *args, **kw):
        return self._new('oval', args, kw)

    def create_polygon(self, *args, **kw):
        return self._new('polygon', args, kw)

    def create_arc(self, *args, **kw):
        return self._new('arc', args, kw)

    def create_text(self, *args, **kw):
        return self._new('text', args, kw)

    def create_image(self, *args, **kw):
        return self._new('image', args, kw)

    def create_window(self, *args, **kw):
        return self._new('window', args, kw)

    def create_bitmap(self, *args, **kw):
        return self._new('rectangle', args, {'outline': '', 'tags': kw.get('tags', ())})

    def _find(self, tag):
        if tag is None:
            return []
        if isinstance(tag, int):
            return [tag] if tag in self._items else []
        tag = str(tag)
        if tag.isdigit():
            return [int(tag)] if int(tag) in self._items else []
        if tag == 'all':
            return list(self._order)
        if tag == 'current':
            return [self._current] if self._current in self._items else []
        return [i for i in self._order if tag in self._items[i]['tags']]

    def coords(self, tagOrId, *args):
        ids = self._find(tagOrId)
        if not ids:
            return []
        if not args:
            return list(self._items[ids[0]]['coords'])
        coords = [float(v) for v in _flatten(args)]
        for i in ids[:1]:
            self._items[i]['coords'] = coords
            _b.emit('ccoords', id=self._w, item=i, coords=coords)

    def move(self, tagOrId, xAmount, yAmount):
        for i in self._find(tagOrId):
            c = self._items[i]['coords']
            for k in range(0, len(c) - 1, 2):
                c[k] += xAmount
                c[k + 1] += yAmount
            _b.emit('ccoords', id=self._w, item=i, coords=c)

    def moveto(self, tagOrId, x='', y=''):
        for i in self._find(tagOrId):
            box = self.bbox(i)
            if box:
                self.move(i, (float(x) - box[0]) if x != '' else 0, (float(y) - box[1]) if y != '' else 0)

    def delete(self, *args):
        for tag in args:
            for i in self._find(tag):
                self._items.pop(i, None)
                if i in self._order:
                    self._order.remove(i)
                _b.emit('cdelete', id=self._w, item=i)

    def itemconfigure(self, tagOrId, cnf=None, **kw):
        opts = dict(cnf or {})
        opts.update(kw)
        ids = self._find(tagOrId)
        if not opts:
            return {k: (k, '', '', '', v) for k, v in self._items[ids[0]]['opts'].items()} if ids else {}
        clean = {_alias(k): v for k, v in opts.items()}
        if 'tags' in clean:
            tags = clean.pop('tags')
            for i in ids:
                self._items[i]['tags'] = [tags] if isinstance(tags, str) else list(map(str, tags))
        for i in ids:
            self._items[i]['opts'].update(clean)
            _b.emit('cconfig', id=self._w, item=i, opts=_prep(clean))

    itemconfig = itemconfigure

    def itemcget(self, tagOrId, option):
        ids = self._find(tagOrId)
        return self._items[ids[0]]['opts'].get(_alias(option), '') if ids else ''

    def type(self, tagOrId):
        ids = self._find(tagOrId)
        return self._items[ids[0]]['type'] if ids else None

    def gettags(self, tagOrId):
        ids = self._find(tagOrId)
        tags = list(self._items[ids[0]]['tags']) if ids else []
        if ids and ids[0] == self._current:
            tags.append('current')
        return tuple(tags)

    def addtag_withtag(self, newtag, tagOrId):
        for i in self._find(tagOrId):
            if newtag not in self._items[i]['tags']:
                self._items[i]['tags'].append(str(newtag))

    def addtag_all(self, newtag):
        self.addtag_withtag(newtag, 'all')

    def addtag(self, *args):
        if len(args) >= 3 and args[1] == 'withtag':
            self.addtag_withtag(args[0], args[2])

    def dtag(self, tagOrId, tagToDelete=None):
        tagToDelete = tagToDelete if tagToDelete is not None else tagOrId
        for i in self._find(tagOrId):
            self._items[i]['tags'] = [t for t in self._items[i]['tags'] if t != tagToDelete]

    def find_all(self):
        return tuple(self._order)

    def find_withtag(self, tagOrId):
        return tuple(self._find(tagOrId))

    def _box(self, i):
        item = self._items[i]
        c = item['coords']
        if not c:
            return None
        if item['type'] in ('text', 'image', 'window'):
            x, y = c[0], c[1]
            if item['type'] == 'text':
                font = item['opts'].get('font')
                size = 12
                if isinstance(font, (list, tuple)) and len(font) > 1:
                    size = abs(int(font[1]))
                elif hasattr(font, 'actual'):
                    size = abs(int(font.actual('size')))
                lines = str(item['opts'].get('text', '')).split('\n')
                w = max(len(l) for l in lines) * size * 0.62
                h = len(lines) * size * 1.35
            elif item['type'] == 'image':
                img = item['opts'].get('image')
                img = _images.get(str(img)) if not isinstance(img, Image) else img
                w, h = (img.width(), img.height()) if img else (0, 0)
            else:
                w, h = float(item['opts'].get('width', 50)), float(item['opts'].get('height', 20))
            anchor = str(item['opts'].get('anchor', 'center'))
            x0 = x - w / 2 if anchor in ('center', 'n', 's') else (x if 'w' in anchor else x - w)
            y0 = y - h / 2 if anchor in ('center', 'e', 'w') else (y if 'n' in anchor else y - h)
            return (x0, y0, x0 + w, y0 + h)
        xs, ys = c[0::2], c[1::2]
        pad = float(item['opts'].get('width', 1) or 1) / 2
        return (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad)

    def bbox(self, *args):
        boxes = [self._box(i) for tag in args for i in self._find(tag)]
        boxes = [b for b in boxes if b]
        if not boxes:
            return None
        return (int(min(b[0] for b in boxes)), int(min(b[1] for b in boxes)),
                int(round(max(b[2] for b in boxes))), int(round(max(b[3] for b in boxes))))

    def find_overlapping(self, x1, y1, x2, y2):
        out = []
        for i in self._order:
            b = self._box(i)
            if b and b[0] <= x2 and b[2] >= x1 and b[1] <= y2 and b[3] >= y1:
                out.append(i)
        return tuple(out)

    def find_enclosed(self, x1, y1, x2, y2):
        out = []
        for i in self._order:
            b = self._box(i)
            if b and b[0] >= x1 and b[2] <= x2 and b[1] >= y1 and b[3] <= y2:
                out.append(i)
        return tuple(out)

    def find_closest(self, x, y, halo=None, start=None):
        best, dist = None, None
        for i in self._order:
            b = self._box(i)
            if not b:
                continue
            dx = max(b[0] - x, 0, x - b[2])
            dy = max(b[1] - y, 0, y - b[3])
            d = dx * dx + dy * dy
            if dist is None or d <= dist:
                best, dist = i, d
        return (best,) if best is not None else ()

    def find_above(self, tagOrId):
        ids = self._find(tagOrId)
        if not ids:
            return ()
        k = self._order.index(ids[-1])
        return (self._order[k + 1],) if k + 1 < len(self._order) else ()

    def find_below(self, tagOrId):
        ids = self._find(tagOrId)
        if not ids:
            return ()
        k = self._order.index(ids[0])
        return (self._order[k - 1],) if k > 0 else ()

    def tag_bind(self, tagOrId, sequence=None, func=None, add=None):
        key = int(tagOrId) if isinstance(tagOrId, int) or str(tagOrId).isdigit() else str(tagOrId)
        table = self._tag_bindings.setdefault(key, {})
        if func is None:
            return table.get(sequence)
        if add and str(add).startswith('+'):
            table.setdefault(sequence, []).append(func)
        else:
            table[sequence] = [func]
        _b.emit('bind', id=self._w, seq=sequence)
        return _register(func)

    def tag_unbind(self, tagOrId, sequence, funcid=None):
        key = int(tagOrId) if isinstance(tagOrId, int) or str(tagOrId).isdigit() else str(tagOrId)
        self._tag_bindings.get(key, {}).pop(sequence, None)

    def tag_raise(self, tagOrId, aboveThis=None):
        ids = self._find(tagOrId)
        for i in ids:
            self._order.remove(i)
        if aboveThis is not None and self._find(aboveThis):
            k = self._order.index(self._find(aboveThis)[-1]) + 1
            self._order[k:k] = ids
        else:
            self._order.extend(ids)
        _b.emit('corder', id=self._w, order=self._order)

    lift = tkraise = tag_raise

    def tag_lower(self, tagOrId, belowThis=None):
        ids = self._find(tagOrId)
        for i in ids:
            self._order.remove(i)
        if belowThis is not None and self._find(belowThis):
            k = self._order.index(self._find(belowThis)[0])
            self._order[k:k] = ids
        else:
            self._order[0:0] = ids
        _b.emit('corder', id=self._w, order=self._order)

    lower = tag_lower

    def scale(self, tagOrId, xOrigin, yOrigin, xScale, yScale):
        for i in self._find(tagOrId):
            c = self._items[i]['coords']
            for k in range(0, len(c) - 1, 2):
                c[k] = xOrigin + (c[k] - xOrigin) * xScale
                c[k + 1] = yOrigin + (c[k + 1] - yOrigin) * yScale
            _b.emit('ccoords', id=self._w, item=i, coords=c)

    def canvasx(self, screenx, gridspacing=None):
        return float(screenx)

    def canvasy(self, screeny, gridspacing=None):
        return float(screeny)

    def xview(self, *args):
        return (0.0, 1.0)

    def yview(self, *args):
        return (0.0, 1.0)

    def xview_moveto(self, fraction):
        pass

    def yview_moveto(self, fraction):
        pass

    def xview_scroll(self, number, what):
        pass

    def yview_scroll(self, number, what):
        pass

    def scan_mark(self, x, y):
        pass

    def scan_dragto(self, x, y, gain=10):
        pass

    def focus(self, *args):
        self.focus_set()

    def postscript(self, cnf={}, **kw):
        return '%!PS-Adobe-3.0 EPSF-3.0\n%% DesktopSim: PostScript-Export wird nicht unterstützt\n'

    def select_clear(self):
        pass

    def icursor(self, *args):
        pass

    def dchars(self, *args):
        pass

    def insert(self, *args):
        pass


Image.__module__ = __name__

__all__ = [name for name in globals() if not name.startswith('_') and name not in ('sys', 'time')]
