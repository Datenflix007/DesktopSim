"""tkinter.messagebox für DesktopSim – Dialoge erscheinen als Fenster der Oberfläche."""
import _dsbridge as _b

ERROR = 'error'; INFO = 'info'; QUESTION = 'question'; WARNING = 'warning'
ABORTRETRYIGNORE = 'abortretryignore'; OK = 'ok'; OKCANCEL = 'okcancel'; RETRYCANCEL = 'retrycancel'
YESNO = 'yesno'; YESNOCANCEL = 'yesnocancel'
ABORT = 'abort'; RETRY = 'retry'; IGNORE = 'ignore'; CANCEL = 'cancel'; YES = 'yes'; NO = 'no'

_LABELS = {'ok': 'OK', 'cancel': 'Abbrechen', 'yes': 'Ja', 'no': 'Nein', 'retry': 'Wiederholen',
           'abort': 'Abbrechen', 'ignore': 'Ignorieren'}
_TYPES = {OK: ['ok'], OKCANCEL: ['ok', 'cancel'], YESNO: ['yes', 'no'], YESNOCANCEL: ['yes', 'no', 'cancel'],
          RETRYCANCEL: ['retry', 'cancel'], ABORTRETRYIGNORE: ['abort', 'retry', 'ignore']}


class Message:
    command = None

    def __init__(self, master=None, **options):
        self.master = master
        self.options = options

    def show(self, **options):
        opts = dict(self.options)
        opts.update(options)
        return _show(opts.get('title'), opts.get('message'), opts.get('icon', INFO), opts.get('type', OK),
                     opts.get('detail'), opts.get('default'))


def _show(title=None, message=None, icon=INFO, type=OK, detail=None, default=None):
    buttons = _TYPES.get(type, ['ok'])
    text = '' if message is None else str(message)
    if detail:
        text += '\n\n' + str(detail)
    reply = _b.call('gui.dialog', title=str(title or 'tk'), message=text, icon=icon,
                    buttons=[[_LABELS[b], b] for b in buttons], default=default)
    if not isinstance(reply, dict) or reply.get('error'):
        print('[%s] %s' % (title or icon, text))
        return buttons[0]
    value = reply.get('value')
    return value if value in buttons else (buttons[-1] if len(buttons) > 1 else buttons[0])


def showinfo(title=None, message=None, **options):
    return _show(title, message, INFO, OK, options.get('detail'))


def showwarning(title=None, message=None, **options):
    return _show(title, message, WARNING, OK, options.get('detail'))


def showerror(title=None, message=None, **options):
    return _show(title, message, ERROR, OK, options.get('detail'))


def askquestion(title=None, message=None, **options):
    return _show(title, message, QUESTION, options.get('type', YESNO), options.get('detail'))


def askokcancel(title=None, message=None, **options):
    return _show(title, message, QUESTION, OKCANCEL, options.get('detail')) == OK


def askyesno(title=None, message=None, **options):
    return _show(title, message, QUESTION, YESNO, options.get('detail')) == YES


def askyesnocancel(title=None, message=None, **options):
    s = _show(title, message, QUESTION, YESNOCANCEL, options.get('detail'))
    return None if s == CANCEL else s == YES


def askretrycancel(title=None, message=None, **options):
    return _show(title, message, WARNING, RETRYCANCEL, options.get('detail')) == RETRY
