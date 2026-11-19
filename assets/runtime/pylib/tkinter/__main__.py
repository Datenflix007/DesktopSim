"""python -m tkinter: kleines Testfenster wie im Original."""
import tkinter
from tkinter import ttk

root = tkinter.Tk()
root.title('tk')
text = 'Dies ist Tcl/Tk Version %s (DesktopSim-Nachbildung)\nDies sollte ein akzentuiertes e sein: é' % tkinter.TkVersion
tkinter.Label(root, text=text).pack(padx=12, pady=8)
ttk.Button(root, text='Klick mich!', command=lambda: root.title('Danke!')).pack(pady=4)
tkinter.Button(root, text='BEENDEN', command=root.destroy).pack(pady=(0, 10))
root.mainloop()
