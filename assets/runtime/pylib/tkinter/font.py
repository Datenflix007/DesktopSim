"""tkinter.font für DesktopSim."""
NORMAL = 'normal'; ROMAN = 'roman'; BOLD = 'bold'; ITALIC = 'italic'

_named = {}
_counter = [0]


def nametofont(name, root=None):
    if name in _named:
        return _named[name]
    return Font(name=name, family='TkDefaultFont', size=10)


class Font:
    def __init__(self, root=None, font=None, name=None, exists=False, **options):
        self._opts = {'family': 'TkDefaultFont', 'size': 10, 'weight': NORMAL, 'slant': ROMAN, 'underline': 0, 'overstrike': 0}
        if font is not None:
            parts = list(font) if isinstance(font, (list, tuple)) else str(font).split()
            if parts:
                self._opts['family'] = parts[0]
            if len(parts) > 1:
                self._opts['size'] = int(parts[1])
            for p in parts[2:]:
                if p in ('bold', 'normal'):
                    self._opts['weight'] = p
                elif p in ('italic', 'roman'):
                    self._opts['slant'] = p
                elif p == 'underline':
                    self._opts['underline'] = 1
                elif p == 'overstrike':
                    self._opts['overstrike'] = 1
        self._opts.update(options)
        if name is None:
            _counter[0] += 1
            name = 'font%d' % _counter[0]
        self.name = name
        _named[name] = self

    def __str__(self):
        return self.name

    def _spec(self):
        spec = [str(self._opts['family']), str(self._opts['size'])]
        if self._opts['weight'] == BOLD:
            spec.append('bold')
        if self._opts['slant'] == ITALIC:
            spec.append('italic')
        if self._opts['underline']:
            spec.append('underline')
        if self._opts['overstrike']:
            spec.append('overstrike')
        return spec

    def actual(self, option=None, displayof=None):
        return self._opts.get(option) if option else dict(self._opts)

    def cget(self, option):
        return self._opts.get(option)

    __getitem__ = cget

    def __setitem__(self, key, value):
        self._opts[key] = value

    def configure(self, **options):
        if not options:
            return dict(self._opts)
        self._opts.update(options)

    config = configure

    def copy(self):
        return Font(**self._opts)

    def measure(self, text, displayof=None):
        size = abs(int(self._opts['size'])) * (1.333 if int(self._opts['size']) > 0 else 1)
        return int(len(str(text)) * size * (0.62 if self._opts['weight'] != BOLD else 0.68))

    def metrics(self, *options, **kw):
        size = abs(int(self._opts['size'])) * 1.333
        values = {'ascent': int(size * 0.8), 'descent': int(size * 0.25), 'linespace': int(size * 1.25), 'fixed': 0}
        if options:
            return values[options[0]] if len(options) == 1 else tuple(values[o] for o in options)
        return values


def families(root=None, displayof=None):
    return ('Arial', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New', 'DejaVu Sans', 'DejaVu Sans Mono',
            'Georgia', 'Helvetica', 'Segoe UI', 'Times New Roman', 'Verdana')


def names(root=None):
    return tuple(_named)


for _n, _f, _s in (('TkDefaultFont', 'TkDefaultFont', 10), ('TkTextFont', 'TkDefaultFont', 10),
                   ('TkFixedFont', 'TkFixedFont', 10), ('TkHeadingFont', 'TkDefaultFont', 10),
                   ('TkMenuFont', 'TkDefaultFont', 10), ('TkCaptionFont', 'TkDefaultFont', 12),
                   ('TkSmallCaptionFont', 'TkDefaultFont', 8), ('TkIconFont', 'TkDefaultFont', 10),
                   ('TkTooltipFont', 'TkDefaultFont', 8)):
    Font(name=_n, family=_f, size=_s)
