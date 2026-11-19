"""tkinter.colorchooser für DesktopSim."""
import _dsbridge as _b
from tkinter import _parse_color


def askcolor(color=None, **options):
    start = '#000000'
    if color:
        try:
            start = '#%02x%02x%02x' % _parse_color(color if isinstance(color, str) else '#%02x%02x%02x' % tuple(color))
        except Exception:
            pass
    reply = _b.call('gui.color', title=str(options.get('title') or 'Farbe'), value=start)
    if not isinstance(reply, dict) or not reply.get('value'):
        return (None, None)
    value = reply['value']
    return (tuple(int(value[i:i + 2], 16) for i in (1, 3, 5)), value)


class Chooser:
    def __init__(self, master=None, **options):
        self.options = options

    def show(self, color=None, **options):
        return askcolor(color, **dict(self.options, **options))
