"""tkinter.filedialog für DesktopSim – nutzt den Dateidialog des simulierten Systems."""
import _dsbridge as _b


def _pick(mode, **options):
    filetypes = options.get('filetypes') or ()
    reply = _b.call('gui.file', mode=mode, title=str(options.get('title') or ''),
                    initialdir=str(options.get('initialdir') or ''), initialfile=str(options.get('initialfile') or ''),
                    defaultextension=str(options.get('defaultextension') or ''),
                    filetypes=[[str(a), str(b)] for a, b in filetypes] if filetypes else [])
    if not isinstance(reply, dict) or reply.get('error'):
        return ''
    return reply.get('value') or ''


def askopenfilename(**options):
    return _pick('open', **options)


def askopenfilenames(**options):
    path = _pick('open', **options)
    return (path,) if path else ()


def asksaveasfilename(**options):
    return _pick('save', **options)


def askdirectory(**options):
    return _pick('dir', **options)


def askopenfile(mode='r', **options):
    path = askopenfilename(**options)
    return open(path, mode) if path else None


def askopenfiles(mode='r', **options):
    return [open(p, mode) for p in askopenfilenames(**options)]


def asksaveasfile(mode='w', **options):
    path = asksaveasfilename(**options)
    return open(path, mode) if path else None


class FileDialog:
    def __init__(self, master, title=None):
        self.master, self.title = master, title

    def go(self, dir_or_file='.', pattern='*', default='', key=None):
        return askopenfilename(title=self.title)


class LoadFileDialog(FileDialog):
    pass


class SaveFileDialog(FileDialog):
    def go(self, dir_or_file='.', pattern='*', default='', key=None):
        return asksaveasfilename(title=self.title, initialfile=default)


class Open:
    def __init__(self, master=None, **options):
        self.options = options

    def show(self, **options):
        return askopenfilename(**dict(self.options, **options))


class SaveAs(Open):
    def show(self, **options):
        return asksaveasfilename(**dict(self.options, **options))


class Directory(Open):
    def show(self, **options):
        return askdirectory(**dict(self.options, **options))
