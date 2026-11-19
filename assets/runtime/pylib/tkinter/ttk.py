"""tkinter.ttk für DesktopSim (thematische Widgets)."""
import tkinter
import _dsbridge as _b
from tkinter import (TclError, Variable, StringVar, _prep, _alias, _register, _vars, Misc)

__version__ = '0.3.1'
__all__ = ['Button', 'Checkbutton', 'Combobox', 'Entry', 'Frame', 'Label', 'Labelframe', 'LabelFrame',
           'Menubutton', 'Notebook', 'Panedwindow', 'PanedWindow', 'Progressbar', 'Radiobutton', 'Scale',
           'Scrollbar', 'Separator', 'Sizegrip', 'Spinbox', 'Style', 'Treeview', 'LabeledScale', 'OptionMenu',
           'tclobjs_to_py', 'setup_master']

_styles = {}
_theme = ['vista']


def tclobjs_to_py(adict):
    return adict


def setup_master(master=None):
    return master or tkinter._get_default_root()


class Style:
    _name = 'ttk::style'

    def __init__(self, master=None):
        self.master = master

    def configure(self, style, query_opt=None, **kw):
        if query_opt is not None:
            return _styles.get(style, {}).get(query_opt)
        if not kw:
            return dict(_styles.get(style, {}))
        _styles.setdefault(style, {}).update(kw)
        _b.emit('style', name=style, opts=_prep(kw))

    def map(self, style, query_opt=None, **kw):
        return {}

    def lookup(self, style, option, state=None, default=None):
        return _styles.get(style, {}).get(option.lstrip('-'), default)

    def layout(self, style, layoutspec=None):
        return []

    def element_create(self, elementname, etype, *args, **kw):
        pass

    def element_names(self):
        return ()

    def element_options(self, elementname):
        return ()

    def theme_create(self, themename, parent=None, settings=None):
        pass

    def theme_settings(self, themename, settings):
        pass

    def theme_names(self):
        return ('winnative', 'clam', 'alt', 'default', 'classic', 'vista', 'xpnative', 'aqua')

    def theme_use(self, themename=None):
        if themename is None:
            return _theme[0]
        _theme[0] = themename
        _b.emit('theme', name=themename)


class Widget(tkinter.Widget):
    _ttk = True

    def state(self, statespec=None):
        current = set(self._opts.get('_states', ()))
        if statespec is None:
            return tuple(current)
        for s in statespec if not isinstance(statespec, str) else statespec.split():
            if s.startswith('!'):
                current.discard(s[1:])
            else:
                current.add(s)
        self._opts['_states'] = tuple(current)
        _b.emit('config', id=self._w, opts={'state': 'disabled' if 'disabled' in current else
                                            ('readonly' if 'readonly' in current else 'normal')})
        return ()

    def instate(self, statespec, callback=None, *args, **kw):
        current = set(self._opts.get('_states', ()))
        if str(self._opts.get('state', '')) == 'disabled':
            current.add('disabled')
        ok = all((s[1:] not in current) if s.startswith('!') else (s in current) for s in statespec)
        if ok and callback:
            return callback(*args, **kw)
        return ok

    def identify(self, x, y):
        return ''


class Button(Widget, tkinter.Button):
    _kind = 'button'

    def invoke(self):
        return tkinter.Button.invoke(self)


class Checkbutton(Widget, tkinter.Checkbutton):
    _kind = 'checkbutton'


class Radiobutton(Widget, tkinter.Radiobutton):
    _kind = 'radiobutton'


class Entry(Widget, tkinter.Entry):
    _kind = 'entry'

    def bbox(self, index):
        return (0, 0, 0, 0)

    def validate(self):
        return True


class Combobox(Entry):
    _kind = 'combobox'

    def _values(self):
        values = self._opts.get('values', ())
        if isinstance(values, str):
            values = values.split()
        return list(values)

    def current(self, newindex=None):
        values = self._values()
        if newindex is None:
            try:
                return values.index(self.get())
            except ValueError:
                return -1
        if not 0 <= int(newindex) < len(values):
            raise TclError('Index %s out of range' % newindex)
        self.set(values[int(newindex)])

    def set(self, value):
        self._text = str(value)
        self._sync()


class Spinbox(Entry):
    _kind = 'spinbox'

    def set(self, value):
        self._text = str(value)
        self._sync()


class Frame(Widget, tkinter.Frame):
    _kind = 'frame'


class Label(Widget, tkinter.Label):
    _kind = 'label'


class Labelframe(Widget, tkinter.LabelFrame):
    _kind = 'labelframe'


LabelFrame = Labelframe


class Menubutton(Widget, tkinter.Menubutton):
    _kind = 'menubutton'


class Scale(Widget, tkinter.Scale):
    _kind = 'scale'

    def _defaults(self):
        return {'from': 0, 'to': 1.0, 'orient': 'horizontal'}

    def get(self, x=None, y=None):
        var = self._opts.get('variable')
        value = var.get() if isinstance(var, Variable) else self._value
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0


class Scrollbar(Widget, tkinter.Scrollbar):
    _kind = 'scrollbar'


class Separator(Widget):
    _kind = 'separator'


class Sizegrip(Widget):
    _kind = 'sizegrip'


class Progressbar(Widget):
    _kind = 'progressbar'

    def _setup(self):
        self._opts.setdefault('value', 0)

    def _sync(self):
        var = self._opts.get('variable')
        if isinstance(var, Variable):
            var.set(self._opts['value'])
        _b.emit('config', id=self._w, opts={'value': self._opts['value']})

    def start(self, interval=None):
        _b.emit('pbstart', id=self._w, interval=interval or 50)

    def stop(self):
        _b.emit('pbstop', id=self._w)

    def step(self, amount=None):
        value = float(self._opts.get('value', 0)) + (1.0 if amount is None else float(amount))
        maximum = float(self._opts.get('maximum', 100))
        if value >= maximum:
            value -= maximum
        self._opts['value'] = value
        self._sync()

    def cget(self, key):
        if key == 'value':
            var = self._opts.get('variable')
            if isinstance(var, Variable):
                return var.get()
        return Widget.cget(self, key)


class Notebook(Widget):
    _kind = 'notebook'

    def _setup(self):
        self._tabs = []
        self._tabopts = {}
        self._current = None

    def _from_js(self, value):
        self._current = value

    def _tabid(self, tab_id):
        if isinstance(tab_id, Misc):
            return tab_id._w
        if isinstance(tab_id, int):
            return self._tabs[tab_id]
        if tab_id in ('current', 'end'):
            return self._current if tab_id == 'current' else None
        return str(tab_id)

    def _push(self):
        _b.emit('nb', id=self._w, tabs=[{'id': t, **{k: tkinter._jsval(k, v) for k, v in self._tabopts[t].items()}}
                                        for t in self._tabs], current=self._current)

    def add(self, child, **kw):
        if child._w not in self._tabs:
            self._tabs.append(child._w)
        self._tabopts.setdefault(child._w, {}).update(kw)
        child._manager = 'notebook'
        if self._current is None:
            self._current = child._w
        self._push()

    def insert(self, pos, child, **kw):
        if child._w in self._tabs:
            self._tabs.remove(child._w)
        index = len(self._tabs) if pos == 'end' else self.index(pos)
        self._tabs.insert(index, child._w)
        self._tabopts.setdefault(child._w, {}).update(kw)
        child._manager = 'notebook'
        self._push()

    def forget(self, tab_id):
        tid = self._tabid(tab_id)
        if tid in self._tabs:
            self._tabs.remove(tid)
        if self._current == tid:
            self._current = self._tabs[0] if self._tabs else None
        self._push()

    def hide(self, tab_id):
        self.tab(tab_id, state='hidden')

    def select(self, tab_id=None):
        if tab_id is None:
            return self._current or ''
        self._current = self._tabid(tab_id)
        self._push()
        ev = tkinter._make_event(self, {'type': 'Virtual', 'detail': '<<NotebookTabChanged>>'})
        tkinter._dispatch_event(self, ev)

    def index(self, tab_id):
        if tab_id == 'end':
            return len(self._tabs)
        tid = self._tabid(tab_id)
        return self._tabs.index(tid) if tid in self._tabs else -1

    def tab(self, tab_id, option=None, **kw):
        tid = self._tabid(tab_id)
        opts = self._tabopts.setdefault(tid, {})
        if option is not None:
            return opts.get(option, '')
        if not kw:
            return dict(opts)
        opts.update(kw)
        self._push()

    def tabs(self):
        return tuple(self._tabs)

    def enable_traversal(self):
        pass


class Panedwindow(Widget, tkinter.PanedWindow):
    _kind = 'paned'

    def insert(self, pos, child, **kw):
        self.add(child, **kw)

    def pane(self, pane, option=None, **kw):
        return {}

    def sashpos(self, index, newpos=None):
        return 0


PanedWindow = Panedwindow


class Treeview(Widget):
    _kind = 'treeview'

    def _setup(self):
        self._nodes = {'': {'children': [], 'text': '', 'values': [], 'open': True, 'tags': [], 'image': ''}}
        self._parent = {}
        self._serial = 0
        self._sel = []
        self._focus = ''
        self._headings = {}
        self._columns_cfg = {}
        self._tagcfg = {}
        self._heading_cbs = {}

    def _from_js(self, value):
        if isinstance(value, dict):
            self._sel = list(value.get('sel', []))
            self._focus = value.get('focus', '')

    def _columns(self):
        cols = self._opts.get('columns', ())
        if isinstance(cols, str):
            cols = cols.split()
        return [str(c) for c in cols]

    def _on_config(self, opts):
        if 'columns' in opts or 'show' in opts or 'displaycolumns' in opts:
            self._push()

    def _push(self):
        def node(iid):
            n = self._nodes[iid]
            return {'iid': iid, 'text': str(n['text']), 'values': [str(v) for v in n['values']], 'open': bool(n['open']),
                    'tags': list(n['tags']), 'children': [node(c) for c in n['children']]}
        show = self._opts.get('show', 'tree headings')
        if isinstance(show, (list, tuple)):
            show = ' '.join(show)
        _b.emit('tree', id=self._w, columns=self._columns(), show=str(show), headings=self._headings,
                cols=self._columns_cfg, tagcfg={k: tkinter._prep(v) for k, v in self._tagcfg.items()},
                rows=[node(c) for c in self._nodes['']['children']], sel=self._sel, focus=self._focus)

    def insert(self, parent, index, iid=None, **kw):
        parent = str(parent)
        if parent not in self._nodes:
            raise TclError('Item %s not found' % parent)
        if iid is None:
            while True:
                self._serial += 1
                iid = 'I%03X' % self._serial
                if iid not in self._nodes:
                    break
        iid = str(iid)
        if iid in self._nodes:
            raise TclError('Item %s already exists' % iid)
        values = kw.get('values', ())
        if isinstance(values, str):
            values = values.split()
        tags = kw.get('tags', ())
        tags = [tags] if isinstance(tags, str) else list(tags)
        self._nodes[iid] = {'children': [], 'text': kw.get('text', ''), 'values': list(values),
                            'open': bool(kw.get('open', False)), 'tags': tags, 'image': kw.get('image', '')}
        self._parent[iid] = parent
        siblings = self._nodes[parent]['children']
        pos = len(siblings) if index in ('end', tkinter.END) else max(0, min(len(siblings), int(index)))
        siblings.insert(pos, iid)
        self._push()
        return iid

    def delete(self, *items):
        for iid in items:
            iid = str(iid)
            if iid not in self._nodes or iid == '':
                continue
            for child in list(self._nodes[iid]['children']):
                self.delete(child)
            parent = self._parent.pop(iid, '')
            if iid in self._nodes[parent]['children']:
                self._nodes[parent]['children'].remove(iid)
            del self._nodes[iid]
            if iid in self._sel:
                self._sel.remove(iid)
        self._push()

    def detach(self, *items):
        self.delete(*items)

    def get_children(self, item=None):
        return tuple(self._nodes[str(item or '')]['children'])

    def set_children(self, item, *newchildren):
        self._nodes[str(item)]['children'] = [str(c) for c in newchildren]
        self._push()

    def exists(self, item):
        return str(item) in self._nodes

    def parent(self, item):
        return self._parent.get(str(item), '')

    def index(self, item):
        item = str(item)
        return self._nodes[self.parent(item)]['children'].index(item)

    def next(self, item):
        sib = self._nodes[self.parent(item)]['children']
        k = sib.index(str(item))
        return sib[k + 1] if k + 1 < len(sib) else ''

    def prev(self, item):
        sib = self._nodes[self.parent(item)]['children']
        k = sib.index(str(item))
        return sib[k - 1] if k > 0 else ''

    def move(self, item, parent, index):
        item, parent = str(item), str(parent)
        old = self._parent.get(item, '')
        self._nodes[old]['children'].remove(item)
        sib = self._nodes[parent]['children']
        pos = len(sib) if index == 'end' else int(index)
        sib.insert(pos, item)
        self._parent[item] = parent
        self._push()

    reattach = move

    def item(self, item, option=None, **kw):
        item = str(item)
        if item not in self._nodes:
            raise TclError('Item %s not found' % item)
        node = self._nodes[item]
        if option is not None:
            value = node.get(option, '')
            return tuple(value) if option in ('values', 'tags') else value
        if not kw:
            return {'text': node['text'], 'image': node['image'], 'values': tuple(node['values']) or '',
                    'open': int(node['open']), 'tags': tuple(node['tags']) or ''}
        for k, v in kw.items():
            if k == 'values' and isinstance(v, str):
                v = v.split()
            if k == 'tags':
                v = [v] if isinstance(v, str) else list(v)
            node[k] = list(v) if k == 'values' else v
        self._push()

    def set(self, item, column=None, value=None):
        node = self._nodes[str(item)]
        cols = self._columns()
        if column is None:
            return {c: (node['values'][i] if i < len(node['values']) else '') for i, c in enumerate(cols)}
        idx = int(column[1:]) - 1 if str(column).startswith('#') else cols.index(str(column))
        if value is None:
            return node['values'][idx] if idx < len(node['values']) else ''
        while len(node['values']) <= idx:
            node['values'].append('')
        node['values'][idx] = value
        self._push()

    def heading(self, column, option=None, **kw):
        column = str(column)
        cfg = self._headings.setdefault(column, {})
        if option is not None:
            return cfg.get(option, '')
        if not kw:
            return dict(cfg)
        for k, v in kw.items():
            if k == 'command' and callable(v):
                cfg['command'] = {'cb': _register(v)}
            else:
                cfg[k] = v if isinstance(v, (str, int, float)) else str(v)
        self._push()

    def column(self, column, option=None, **kw):
        column = str(column)
        cfg = self._columns_cfg.setdefault(column, {})
        if option is not None:
            return cfg.get(option, {'width': 200, 'minwidth': 20, 'stretch': 1, 'anchor': 'w'}.get(option, ''))
        if not kw:
            return dict(cfg)
        cfg.update({k: (v if isinstance(v, (str, int, float, bool)) else str(v)) for k, v in kw.items()})
        self._push()

    def selection(self, selop=None, items=None):
        if selop is None:
            return tuple(self._sel)
        return ()

    def _setsel(self, items):
        self._sel = [str(i) for i in items]
        self._push()
        ev = tkinter._make_event(self, {'type': 'Virtual', 'detail': '<<TreeviewSelect>>'})
        tkinter._dispatch_event(self, ev)

    def _items(self, items):
        if len(items) == 1 and isinstance(items[0], (list, tuple)):
            items = items[0]
        return [str(i) for i in items]

    def selection_set(self, *items):
        self._setsel(self._items(items))

    def selection_add(self, *items):
        self._setsel(self._sel + [i for i in self._items(items) if i not in self._sel])

    def selection_remove(self, *items):
        rm = set(self._items(items))
        self._setsel([i for i in self._sel if i not in rm])

    def selection_toggle(self, *items):
        cur = list(self._sel)
        for i in self._items(items):
            cur.remove(i) if i in cur else cur.append(i)
        self._setsel(cur)

    def focus(self, item=None):
        if item is None:
            return self._focus
        self._focus = str(item)
        self._push()

    def see(self, item):
        pass

    def tag_configure(self, tagname, option=None, **kw):
        cfg = self._tagcfg.setdefault(tagname, {})
        if option is not None:
            return cfg.get(option, '')
        cfg.update(kw)
        self._push()

    def tag_bind(self, tagname, sequence=None, callback=None):
        return self.bind(sequence, callback)

    def tag_has(self, tagname, item=None):
        if item is None:
            return tuple(i for i, n in self._nodes.items() if tagname in n['tags'])
        return tagname in self._nodes[str(item)]['tags']

    def identify_row(self, y):
        return self._focus or (self._sel[0] if self._sel else '')

    def identify_column(self, x):
        return '#0'

    def identify_region(self, x, y):
        return 'cell'

    def identify_element(self, x, y):
        return ''

    def identify(self, component, x, y):
        return self.identify_row(y)

    def bbox(self, item, column=None):
        return ''

    def xview(self, *args):
        return (0.0, 1.0)

    def yview(self, *args):
        return (0.0, 1.0)


class LabeledScale(Frame):
    def __init__(self, master=None, variable=None, from_=0, to=10, **kw):
        Frame.__init__(self, master, **kw)
        self._variable = variable or tkinter.IntVar(value=from_)
        self.label = Label(self, textvariable=self._variable)
        self.label.pack(side='top')
        self.scale = Scale(self, variable=self._variable, from_=from_, to=to)
        self.scale.pack(side='bottom', fill='x')

    value = property(lambda self: self._variable.get(), lambda self, v: self._variable.set(v))


class OptionMenu(Menubutton):
    _kind = 'optionmenu'

    def __init__(self, master, variable, default=None, *values, **kwargs):
        command = kwargs.pop('command', None)
        Menubutton.__init__(self, master, textvariable=variable, values=[str(v) for v in values],
                            command=(lambda v: command(v)) if command else None, **kwargs)
        self._variable = variable
        if default is not None:
            variable.set(default)

    def set_menu(self, default=None, *values):
        self.configure(values=[str(v) for v in values])
        if default is not None:
            self._variable.set(default)
