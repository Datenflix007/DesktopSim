"""matplotlib-Backend für DesktopSim: plt.show() öffnet ein Fenster wie unter TkAgg."""
import io
import base64
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.backend_bases import FigureManagerBase
import _dsbridge as _b


class FigureManager(FigureManagerBase):
    pass


class FigureCanvas(FigureCanvasAgg):
    manager_class = FigureManager


def _png(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=96)
    return buf.getvalue()


def show(*args, block=None, **kwargs):
    import matplotlib.pyplot as plt
    nums = plt.get_fignums()
    if not nums:
        return
    if not _b.can_block():
        return  # Bilder werden nach Programmende im Terminal angezeigt
    import tkinter as tk
    windows = []
    for num in nums:
        fig = plt.figure(num)
        data = _png(fig)
        top = tk.Tk() if not tk._roots else tk.Toplevel()
        label = fig.get_label() or ''
        top.title('Figure %d' % num if not label else label)
        img = tk.PhotoImage(data=base64.b64encode(data).decode())
        bar = tk.Frame(top)
        bar.pack(side='bottom', fill='x')

        def save(fig=fig, num=num):
            name = 'figure_%d.png' % num
            fig.savefig(name)
            status.config(text='Gespeichert: ' + name)
        tk.Button(bar, text='💾 Speichern', command=save).pack(side='left', padx=4, pady=3)
        status = tk.Label(bar, text='')
        status.pack(side='left')
        tk.Label(top, image=img, background='white').pack(fill='both', expand=True)
        top._img = img
        windows.append(top)
    plt.close('all')
    tk.mainloop()
