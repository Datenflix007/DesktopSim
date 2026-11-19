"""tkinter.scrolledtext für DesktopSim (die Textfläche scrollt selbst)."""
from tkinter import Text

__all__ = ['ScrolledText']


class ScrolledText(Text):
    def __init__(self, master=None, **kw):
        Text.__init__(self, master, **kw)
        self.frame = self
