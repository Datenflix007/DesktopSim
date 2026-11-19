"""tkinter.simpledialog für DesktopSim."""
import _dsbridge as _b
from tkinter import messagebox as _mb, Toplevel, Frame


def _ask(title, prompt, initialvalue=None, show=None):
    reply = _b.call('gui.prompt', title=str(title or ''), message=str(prompt or ''),
                    value='' if initialvalue is None else str(initialvalue), password=bool(show))
    if not isinstance(reply, dict) or reply.get('error'):
        try:
            return input(str(prompt) + ' ')
        except EOFError:
            return None
    return reply.get('value')


def askstring(title, prompt, **kw):
    return _ask(title, prompt, kw.get('initialvalue'), kw.get('show'))


def _ask_number(title, prompt, kind, kw):
    value = kw.get('initialvalue')
    while True:
        text = _ask(title, prompt, value)
        if text is None:
            return None
        try:
            number = kind(text)
        except ValueError:
            _mb.showwarning('Unzulässiger Wert', ('Keine gültige Ganzzahl.' if kind is int else 'Keine gültige Gleitkommazahl.') + '\nBitte erneut versuchen.')
            value = text
            continue
        lo, hi = kw.get('minvalue'), kw.get('maxvalue')
        if lo is not None and number < lo:
            _mb.showwarning('Zu klein', 'Der zulässige Mindestwert ist %s.\nBitte erneut versuchen.' % lo)
            continue
        if hi is not None and number > hi:
            _mb.showwarning('Zu groß', 'Der zulässige Höchstwert ist %s.\nBitte erneut versuchen.' % hi)
            continue
        return number


def askinteger(title, prompt, **kw):
    return _ask_number(title, prompt, int, kw)


def askfloat(title, prompt, **kw):
    return _ask_number(title, prompt, float, kw)


class Dialog(Toplevel):
    def __init__(self, parent, title=None):
        Toplevel.__init__(self, parent)
        if title:
            self.title(title)
        self.result = None
        body = Frame(self)
        self.initial_focus = self.body(body)
        body.pack(padx=5, pady=5)
        self.buttonbox()
        self.wait_window(self)

    def body(self, master):
        pass

    def buttonbox(self):
        from tkinter import Button
        box = Frame(self)
        Button(box, text='OK', width=10, command=self.ok).pack(side='left', padx=5, pady=5)
        Button(box, text='Abbrechen', width=10, command=self.cancel).pack(side='left', padx=5, pady=5)
        box.pack()

    def ok(self, event=None):
        if not self.validate():
            return
        self.apply()
        self.cancel()

    def cancel(self, event=None):
        self.destroy()

    def validate(self):
        return 1

    def apply(self):
        pass


SimpleDialog = Dialog
