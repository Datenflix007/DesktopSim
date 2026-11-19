"""turtle für DesktopSim.

Nachbildung des Standardmoduls turtle auf Basis des DesktopSim-tkinter. Koordinaten,
Winkel, Geschwindigkeiten und Animation folgen dem Original (Python 3.14).
"""
import math as _math
import tkinter as TK
import _dsbridge as _b

__all__ = ['ScrolledCanvas', 'TurtleScreen', 'Screen', 'RawTurtle', 'Turtle', 'RawPen', 'Pen', 'Shape', 'Vec2D',
           'Terminator', 'TurtleGraphicsError', 'done', 'mainloop', 'bye', 'exitonclick', 'getscreen', 'getturtle']


class Terminator(Exception):
    """Wird ausgelöst, wenn das Turtle-Fenster geschlossen wurde."""


class TurtleGraphicsError(Exception):
    pass


class Vec2D(tuple):
    def __new__(cls, x, y):
        return tuple.__new__(cls, (x, y))

    def __add__(self, other):
        return Vec2D(self[0] + other[0], self[1] + other[1])

    def __mul__(self, other):
        if isinstance(other, Vec2D):
            return self[0] * other[0] + self[1] * other[1]
        return Vec2D(self[0] * other, self[1] * other)

    def __rmul__(self, other):
        return Vec2D(self[0] * other, self[1] * other)

    def __sub__(self, other):
        return Vec2D(self[0] - other[0], self[1] - other[1])

    def __neg__(self):
        return Vec2D(-self[0], -self[1])

    def __abs__(self):
        return _math.hypot(*self)

    def rotate(self, angle):
        perp = Vec2D(-self[1], self[0])
        angle = _math.radians(angle)
        c, s = _math.cos(angle), _math.sin(angle)
        return Vec2D(self[0] * c + perp[0] * s, self[1] * c + perp[1] * s)

    def __getnewargs__(self):
        return (self[0], self[1])

    def __repr__(self):
        return '(%.2f,%.2f)' % self


_SHAPES = {
    'arrow': ((-10, 0), (10, 0), (0, 10)),
    'turtle': ((0, 16), (-2, 14), (-1, 10), (-4, 7), (-7, 9), (-9, 8), (-6, 5), (-7, 1), (-5, -3), (-8, -6),
               (-6, -8), (-4, -5), (0, -7), (4, -5), (6, -8), (8, -6), (5, -3), (7, 1), (6, 5), (9, 8), (7, 9),
               (4, 7), (1, 10), (2, 14)),
    'circle': tuple((10 * _math.cos(_math.radians(a)), 10 * _math.sin(_math.radians(a))) for a in range(0, 360, 18)),
    'square': ((10, -10), (10, 10), (-10, 10), (-10, -10)),
    'triangle': ((10, -5.77), (0, 11.55), (-10, -5.77)),
    'classic': ((0, 0), (-5, -9), (0, -7), (5, -9)),
    'blank': (),
}


class Shape:
    def __init__(self, type_, data=None):
        self._type = type_
        self._data = data

    def addcomponent(self, poly, fill, outline=None):
        if self._data is None:
            self._data = []
        self._data.append((poly, fill, outline))


_screen = None


def _color(args, mode):
    if not args:
        return None
    if len(args) == 1:
        c = args[0]
    else:
        c = tuple(args)
    if isinstance(c, str):
        if c == '':
            return ''
        try:
            TK._parse_color(c)
        except TK.TclError:
            raise TurtleGraphicsError('bad color string: %s' % c) from None
        return c
    try:
        r, g, b = c
    except (TypeError, ValueError):
        raise TurtleGraphicsError('bad color arguments: %s' % str(c)) from None
    if mode == 1.0:
        if not all(0 <= v <= 1 for v in (r, g, b)):
            raise TurtleGraphicsError('bad color sequence: %s' % str(c))
        r, g, b = (round(255 * v) for v in (r, g, b))
    elif not all(0 <= v <= 255 for v in (r, g, b)):
        raise TurtleGraphicsError('bad color sequence: %s' % str(c))
    return '#%02x%02x%02x' % (int(r), int(g), int(b))


class TurtleScreen:
    _RUNNING = True

    def __init__(self, cv=None, mode='standard', colormode=1.0, delay=10):
        self._root = TK.Tk() if cv is None else cv.winfo_toplevel()
        self._root.title('Python Turtle Graphics')
        self._w, self._h = 640, 560
        self.cv = cv or TK.Canvas(self._root, width=self._w, height=self._h, background='white', highlightthickness=0)
        if cv is None:
            self.cv.pack(fill='both', expand=True)
        self._root.protocol('WM_DELETE_WINDOW', self._closed)
        self._turtles = []
        self._mode = mode
        self._colormode = colormode
        self._delayvalue = delay
        self._tracing = 1
        self._updatecounter = 0
        self._bgcolor = 'white'
        self._world = None
        self._shapes = dict((k, Shape('polygon', v)) for k, v in _SHAPES.items())
        self._key_bindings = {}
        self._alive = True
        _b.flush()

    def _closed(self):
        self._alive = False
        TurtleScreen._RUNNING = False
        try:
            self._root.destroy()
        except Exception:
            pass

    def _check(self):
        if not self._alive or self._root._w not in TK._widgets:
            self._alive = False
            raise Terminator

    # Koordinaten
    def _tocanvas(self, x, y):
        if self._world:
            llx, lly, urx, ury = self._world
            sx = self._w / (urx - llx)
            sy = self._h / (ury - lly)
            return ((x - llx) * sx, self._h - (y - lly) * sy)
        return (self._w / 2 + x, self._h / 2 - y)

    def _fromcanvas(self, cx, cy):
        if self._world:
            llx, lly, urx, ury = self._world
            return (llx + cx * (urx - llx) / self._w, lly + (self._h - cy) * (ury - lly) / self._h)
        return (cx - self._w / 2, self._h / 2 - cy)

    def _scale(self):
        if self._world:
            llx, lly, urx, ury = self._world
            return (self._w / (urx - llx), self._h / (ury - lly))
        return (1.0, 1.0)

    def _sleep(self, ms):
        if ms > 0 and self._tracing:
            _b.call('sleep', ms=int(ms))
            self._check()

    def _anim(self):
        return self._tracing == 1 and self._delayvalue >= 0

    # öffentliche Screen-API
    def bgcolor(self, *args):
        if not args:
            return self._bgcolor
        self._bgcolor = _color(args, self._colormode)
        self.cv.configure(background=self._bgcolor)

    def bgpic(self, picname=None):
        if picname is None:
            return getattr(self, '_bgpic', 'nopic')
        self._bgpic = picname
        if picname == 'nopic':
            return
        img = TK.PhotoImage(file=picname)
        item = self.cv.create_image(self._w / 2, self._h / 2, image=img)
        self.cv.tag_lower(item)

    def title(self, titlestring):
        self._root.title(titlestring)

    def setup(self, width=0.5, height=0.75, startx=None, starty=None):
        sw, sh = TK._screen
        w = int(width * sw) if isinstance(width, float) and width <= 1 else int(width)
        h = int(height * sh) if isinstance(height, float) and height <= 1 else int(height)
        self._w, self._h = max(100, min(w, 1600)), max(100, min(h, 1100))
        self.cv.configure(width=self._w, height=self._h)
        self._root.geometry('%dx%d' % (self._w, self._h))
        for t in self._turtles:
            t._redraw()

    def screensize(self, canvwidth=None, canvheight=None, bg=None):
        if canvwidth is None and canvheight is None and bg is None:
            return (self._w, self._h)
        if bg:
            self.bgcolor(bg)

    def window_width(self):
        return self._w

    def window_height(self):
        return self._h

    def mode(self, mode=None):
        if mode is None:
            return self._mode
        if mode not in ('standard', 'logo', 'world'):
            raise TurtleGraphicsError('No turtle-graphics-mode %s' % mode)
        self._mode = mode
        if mode != 'world':
            self._world = None
        self.reset()

    def setworldcoordinates(self, llx, lly, urx, ury):
        self._mode = 'world'
        self._world = (llx, lly, urx, ury)
        for t in self._turtles:
            t._redraw()

    def colormode(self, cmode=None):
        if cmode is None:
            return self._colormode
        if cmode == 1.0 or cmode == 1:
            self._colormode = 1.0
        elif cmode == 255:
            self._colormode = 255
        else:
            raise TurtleGraphicsError('bad color mode: %s' % cmode)

    def delay(self, delay=None):
        if delay is None:
            return self._delayvalue
        self._delayvalue = int(delay)

    def tracer(self, n=None, delay=None):
        if n is None:
            return self._tracing
        self._tracing = int(n)
        if delay is not None:
            self._delayvalue = int(delay)
        if self._tracing:
            self.update()

    def update(self):
        for t in self._turtles:
            t._update_shape(force=True)
        _b.flush()
        if _b.can_block():
            TK._process(0)
        self._check()

    def clear(self):
        for t in list(self._turtles):
            t._clear_items()
        self._turtles = []
        self.cv.delete('all')
        self.bgcolor('white')
        self._key_bindings = {}

    clearscreen = clear

    def reset(self):
        for t in self._turtles:
            t.reset()

    resetscreen = reset

    def turtles(self):
        return list(self._turtles)

    def getcanvas(self):
        return self.cv

    def getshapes(self):
        return sorted(self._shapes)

    def register_shape(self, name, shape=None):
        if shape is None:
            img = TK.PhotoImage(file=name)
            self._shapes[name] = Shape('image', img)
        elif isinstance(shape, tuple):
            self._shapes[name] = Shape('polygon', shape)
        else:
            self._shapes[name] = shape

    addshape = register_shape

    def onclick(self, fun, btn=1, add=None):
        if fun is None:
            self.cv.unbind('<Button-%s>' % btn)
            return

        def handler(event):
            x, y = self._fromcanvas(event.x, event.y)
            fun(x, y)
        self.cv.bind('<Button-%s>' % btn, handler, add)

    onscreenclick = onclick

    def _key(self, kind, fun, key):
        seq = ('<%s>' % kind) if key is None else '<%s-%s>' % (kind, key)
        if fun is None:
            self._root.unbind(seq)
        else:
            self._root.bind(seq, lambda e: fun())

    def onkey(self, fun, key):
        self._key('KeyRelease', fun, key)

    onkeyrelease = onkey

    def onkeypress(self, fun, key=None):
        self._key('KeyPress', fun, key)

    def listen(self, xdummy=None, ydummy=None):
        self.cv.focus_set()

    def ontimer(self, fun, t=0):
        self._root.after(int(t), fun)

    def textinput(self, title, prompt):
        from tkinter import simpledialog
        return simpledialog.askstring(title, prompt)

    def numinput(self, title, prompt, default=None, minval=None, maxval=None):
        from tkinter import simpledialog
        return simpledialog.askfloat(title, prompt, initialvalue=default, minvalue=minval, maxvalue=maxval)

    def mainloop(self):
        TK.mainloop()

    def done(self):
        TK.mainloop()

    def bye(self):
        self._closed()

    def exitonclick(self):
        def leave(x, y):
            self.bye()
        self.onclick(leave)
        TK.mainloop()

    def save(self, filename, *, overwrite=False):
        raise TurtleGraphicsError('Speichern als PostScript wird in DesktopSim nicht unterstützt.')


def Screen():
    global _screen
    if _screen is None or not _screen._alive:
        if _screen is not None and not TurtleScreen._RUNNING:
            TurtleScreen._RUNNING = True
        _screen = TurtleScreen()
    return _screen


_Screen = TurtleScreen


class ScrolledCanvas(TK.Canvas):
    def __init__(self, master, width=500, height=350, canvwidth=600, canvheight=500):
        TK.Canvas.__init__(self, master, width=width, height=height)


class RawTurtle:
    screens = []

    def __init__(self, canvas=None, shape='classic', undobuffersize=1000, visible=True):
        if isinstance(canvas, TurtleScreen):
            self.screen = canvas
        else:
            self.screen = Screen()
        self.screen._turtles.append(self)
        self._shape = shape
        self._items = []
        self._stamps = []
        self._shape_item = None
        self._line_item = None
        self._line_points = []
        self._fill_item = None
        self._fill_points = None
        self._poly = None
        self._init_state(visible)
        self._update_shape(force=True)

    def _init_state(self, visible=True):
        self._x = 0.0
        self._y = 0.0
        self._heading = 0.0 if self.screen._mode != 'logo' else 0.0
        self._pendown = True
        self._pensize = 1
        self._pencolor = 'black'
        self._fillcolor = 'black'
        self._pencolor_raw = 'black'
        self._fillcolor_raw = 'black'
        self._speed = 3
        self._visible = visible
        self._stretch = (1.0, 1.0, 1)
        self._tilt = 0.0
        self._degrees = 360.0

    # ----- Hilfen
    def _angle_to_internal(self, angle):
        return angle * 360.0 / self._degrees

    def _abs_heading(self):
        return self._heading if self.screen._mode != 'logo' else 90 - self._heading

    def _cv(self, x=None, y=None):
        return self.screen._tocanvas(self._x if x is None else x, self._y if y is None else y)

    def _shape_poly(self):
        shape = self.screen._shapes.get(self._shape)
        if shape is None or shape._type != 'polygon':
            return None
        poly = shape._data or ()
        h = _math.radians(self._abs_heading() + self._tilt)
        e0, e1 = _math.cos(h), _math.sin(h)
        sw, sl, _ = self._stretch
        cx, cy = self._cv()
        pts = []
        for x, y in poly:
            x, y = x * sw, y * sl
            wx = e1 * x + e0 * y
            wy = -e0 * x + e1 * y
            pts.extend((cx + wx, cy - wy))
        return pts

    def _update_shape(self, force=False):
        cv = self.screen.cv
        if not force and not self.screen._anim():
            return
        if not self._visible:
            if self._shape_item:
                cv.itemconfigure(self._shape_item, state='hidden')
            return
        shape = self.screen._shapes.get(self._shape)
        if shape is not None and shape._type == 'image':
            x, y = self._cv()
            if self._shape_item is None:
                self._shape_item = cv.create_image(x, y, image=shape._data, tags=('turtle',))
            else:
                cv.coords(self._shape_item, x, y)
                cv.itemconfigure(self._shape_item, image=shape._data, state='normal')
            cv.tag_raise(self._shape_item)
            return
        pts = self._shape_poly()
        if not pts:
            return
        outline_w = self._stretch[2]
        if self._shape_item is None:
            self._shape_item = cv.create_polygon(pts, fill=self._fillcolor or '', outline=self._pencolor or 'black',
                                                 width=outline_w, tags=('turtle',))
        else:
            cv.coords(self._shape_item, pts)
            cv.itemconfigure(self._shape_item, fill=self._fillcolor or '', outline=self._pencolor or 'black',
                             state='normal', width=outline_w)
            cv.tag_raise(self._shape_item)

    def _redraw(self):
        self._update_shape(force=True)

    def _pen_line(self, x0, y0, x1, y1):
        cv = self.screen.cv
        a = self._cv(x0, y0)
        b = self._cv(x1, y1)
        if self._line_item is not None and len(self._line_points) < 128 and self._line_points[-2:] == list(a):
            self._line_points.extend(b)
            cv.coords(self._line_item, self._line_points)
        else:
            self._line_points = list(a) + list(b)
            self._line_item = cv.create_line(self._line_points, fill=self._pencolor or 'black', width=self._pensize,
                                             capstyle='round', joinstyle='round')
            self._items.append(self._line_item)
        if self._shape_item is not None:
            cv.tag_raise(self._shape_item)

    def _break_line(self):
        self._line_item = None
        self._line_points = []

    def _goto(self, x, y):
        self.screen._check()
        x0, y0 = self._x, self._y
        if self._fill_points is not None:
            self._fill_points.append((x, y))
        if self._poly is not None:
            self._poly.append((x, y))
        anim = self.screen._anim() and self._speed > 0
        if anim:
            dist = _math.hypot(x - x0, y - y0)
            sx, sy = self.screen._scale()
            dist *= max(sx, sy)
            nhops = 1 + int(dist / (3 * (1.1 ** self._speed) * self._speed))
            nhops = min(nhops, 60)
            line_started = False
            for i in range(1, nhops + 1):
                nx = x0 + (x - x0) * i / nhops
                ny = y0 + (y - y0) * i / nhops
                if self._pendown:
                    if not line_started:
                        self._pen_line(x0, y0, nx, ny)
                        line_started = True
                    else:
                        self._line_points[-2:] = list(self._cv(nx, ny))
                        self.screen.cv.coords(self._line_item, self._line_points)
                self._x, self._y = nx, ny
                self._update_shape()
                self.screen._sleep(self.screen._delayvalue)
        else:
            if self._pendown:
                self._pen_line(x0, y0, x, y)
            self._x, self._y = x, y
            self._update_shape()
        self._x, self._y = float(x), float(y)
        if self._fill_item is not None:
            self._update_fill()

    def _rotate(self, angle):
        self.screen._check()
        angle = self._angle_to_internal(angle)
        if self.screen._anim() and self._speed > 0 and self._visible:
            anglevel = 3.0 * self._speed
            steps = 1 + int(abs(angle) / anglevel)
            start = self._heading
            for i in range(1, steps + 1):
                self._heading = (start + angle * i / steps) % 360
                self._update_shape()
                self.screen._sleep(self.screen._delayvalue)
        self._heading = (self._heading + angle) % 360
        self._update_shape()

    # ----- Bewegung
    def forward(self, distance):
        h = _math.radians(self._abs_heading())
        self._goto(self._x + distance * _math.cos(h), self._y + distance * _math.sin(h))

    fd = forward

    def back(self, distance):
        self.forward(-distance)

    bk = backward = back

    def right(self, angle):
        self._rotate(-angle if self.screen._mode != 'logo' else angle)

    rt = right

    def left(self, angle):
        self._rotate(angle if self.screen._mode != 'logo' else -angle)

    lt = left

    def goto(self, x, y=None):
        if y is None:
            x, y = x
        self._goto(float(x), float(y))

    setpos = setposition = goto

    def teleport(self, x=None, y=None, *, fill_gap=False):
        pen = self._pendown
        self._pendown = False
        self._break_line()
        self._goto(self._x if x is None else x, self._y if y is None else y)
        self._pendown = pen

    def setx(self, x):
        self._goto(float(x), self._y)

    def sety(self, y):
        self._goto(self._x, float(y))

    def setheading(self, to_angle):
        target = self._angle_to_internal(to_angle)
        diff = (target - self._heading + 180) % 360 - 180
        self._rotate(diff * self._degrees / 360.0)

    seth = setheading

    def home(self):
        self.goto(0, 0)
        self.setheading(0)

    def circle(self, radius, extent=None, steps=None):
        speed = self._speed
        if extent is None:
            extent = self._degrees
        full = self._angle_to_internal(extent)
        if steps is None:
            frac = abs(full) / 360
            steps = 1 + int(min(11 + abs(radius) / 6.0, 59.0) * frac)
        w = 1.0 * full / steps
        w2 = 0.5 * w
        length = 2.0 * radius * _math.sin(_math.radians(w2))
        if radius < 0:
            length, w, w2 = -length, -w, -w2
        if self._speed > 0:
            self._speed = min(10, self._speed + 2) if steps > 20 else self._speed
        self._heading = (self._heading + w2) % 360
        for _ in range(steps):
            h = _math.radians(self._abs_heading())
            self._goto(self._x + length * _math.cos(h), self._y + length * _math.sin(h))
            self._heading = (self._heading + w) % 360
        self._heading = (self._heading - w2) % 360
        self._speed = speed
        self._update_shape()

    def dot(self, size=None, *color):
        if size is None or isinstance(size, (str, tuple)):
            if size is not None:
                color = (size,) + color
            size = max(self._pensize + 4, 2 * self._pensize)
        c = _color(color, self.screen._colormode) if color else self._pencolor
        x, y = self._cv()
        r = size / 2.0
        item = self.screen.cv.create_oval(x - r, y - r, x + r, y + r, fill=c, outline='')
        self._items.append(item)
        self._break_line()
        if self._shape_item:
            self.screen.cv.tag_raise(self._shape_item)

    def stamp(self):
        pts = self._shape_poly()
        if not pts:
            return None
        item = self.screen.cv.create_polygon(pts, fill=self._fillcolor or '', outline=self._pencolor or 'black')
        self._stamps.append(item)
        self._items.append(item)
        return item

    def clearstamp(self, stampid):
        if stampid in self._stamps:
            self._stamps.remove(stampid)
            self.screen.cv.delete(stampid)

    def clearstamps(self, n=None):
        stamps = self._stamps if n is None else (self._stamps[:n] if n >= 0 else self._stamps[n:])
        for s in list(stamps):
            self.clearstamp(s)

    def undo(self):
        pass

    def setundobuffer(self, size):
        pass

    def undobufferentries(self):
        return 0

    # ----- Zustand
    def speed(self, speed=None):
        speeds = {'fastest': 0, 'fast': 10, 'normal': 6, 'slow': 3, 'slowest': 1}
        if speed is None:
            return self._speed
        if speed in speeds:
            speed = speeds[speed]
        elif 0.5 < speed < 10.5:
            speed = int(round(speed))
        else:
            speed = 0
        self._speed = speed

    def position(self):
        return Vec2D(round(self._x, 10) + 0.0, round(self._y, 10) + 0.0)

    pos = position

    def xcor(self):
        return round(self._x, 10) + 0.0

    def ycor(self):
        return round(self._y, 10) + 0.0

    def heading(self):
        return round(self._heading * self._degrees / 360.0, 10) % self._degrees

    def towards(self, x, y=None):
        if y is None:
            if isinstance(x, RawTurtle):
                x, y = x._x, x._y
            else:
                x, y = x
        angle = _math.degrees(_math.atan2(y - self._y, x - self._x)) % 360
        if self.screen._mode == 'logo':
            angle = (90 - angle) % 360
        return round(angle * self._degrees / 360.0, 10)

    def distance(self, x, y=None):
        if y is None:
            if isinstance(x, RawTurtle):
                x, y = x._x, x._y
            else:
                x, y = x
        return _math.hypot(x - self._x, y - self._y)

    def degrees(self, fullcircle=360.0):
        self._degrees = float(fullcircle)

    def radians(self):
        self._degrees = 2 * _math.pi

    def pendown(self):
        self._pendown = True

    pd = down = pendown

    def penup(self):
        self._pendown = False
        self._break_line()

    pu = up = penup

    def isdown(self):
        return self._pendown

    def pensize(self, width=None):
        if width is None:
            return self._pensize
        self._pensize = width
        self._break_line()

    width = pensize

    def pen(self, pen=None, **pendict):
        if pen is None and not pendict:
            return {'shown': self._visible, 'pendown': self._pendown, 'pencolor': self._pencolor_raw,
                    'fillcolor': self._fillcolor_raw, 'pensize': self._pensize, 'speed': self._speed,
                    'resizemode': 'noresize', 'stretchfactor': self._stretch[:2], 'outline': self._stretch[2], 'tilt': self._tilt}
        settings = dict(pen or {})
        settings.update(pendict)
        for key, value in settings.items():
            if key == 'shown':
                self.showturtle() if value else self.hideturtle()
            elif key == 'pendown':
                self.pendown() if value else self.penup()
            elif key == 'pencolor':
                self.pencolor(value)
            elif key == 'fillcolor':
                self.fillcolor(value)
            elif key == 'pensize':
                self.pensize(value)
            elif key == 'speed':
                self.speed(value)

    def pencolor(self, *args):
        if not args:
            return self._pencolor_raw
        self._pencolor = _color(args, self.screen._colormode)
        self._pencolor_raw = args[0] if len(args) == 1 else tuple(args)
        self._break_line()
        self._update_shape()

    def fillcolor(self, *args):
        if not args:
            return self._fillcolor_raw
        self._fillcolor = _color(args, self.screen._colormode)
        self._fillcolor_raw = args[0] if len(args) == 1 else tuple(args)
        self._update_shape()

    def color(self, *args):
        if not args:
            return (self._pencolor_raw, self._fillcolor_raw)
        if len(args) == 1:
            self.pencolor(args[0])
            self.fillcolor(args[0])
        elif len(args) == 2:
            self.pencolor(args[0])
            self.fillcolor(args[1])
        elif len(args) == 3:
            self.pencolor(*args)
            self.fillcolor(*args)
        else:
            raise TurtleGraphicsError('bad color arguments: %s' % str(args))

    def filling(self):
        return self._fill_points is not None

    def begin_fill(self):
        self._fill_points = [(self._x, self._y)]
        self._fill_item = self.screen.cv.create_polygon(0, 0, 0, 0, fill='', outline='')
        self._items.append(self._fill_item)
        self._break_line()

    def _update_fill(self):
        if self._fill_item is not None and len(self._fill_points) > 2 and self.screen._anim():
            pts = [c for p in self._fill_points for c in self._cv(*p)]
            self.screen.cv.coords(self._fill_item, pts)

    def end_fill(self):
        if self._fill_points is None:
            return
        if len(self._fill_points) > 2:
            pts = [c for p in self._fill_points for c in self._cv(*p)]
            self.screen.cv.coords(self._fill_item, pts)
            self.screen.cv.itemconfigure(self._fill_item, fill=self._fillcolor, outline='')
        self._fill_points = None
        self._fill_item = None
        self._break_line()

    def begin_poly(self):
        self._poly = [(self._x, self._y)]

    def end_poly(self):
        pass

    def get_poly(self):
        return tuple(self._poly or ())

    def _clear_items(self):
        cv = self.screen.cv
        for item in self._items:
            cv.delete(item)
        self._items = []
        self._stamps = []
        self._break_line()

    def clear(self):
        self._clear_items()

    def reset(self):
        self._clear_items()
        self._init_state(self._visible)
        self._update_shape(force=True)

    def write(self, arg, move=False, align='left', font=('Arial', 8, 'normal')):
        anchor = {'left': 'sw', 'center': 's', 'right': 'se'}.get(align, 'sw')
        x, y = self._cv()
        item = self.screen.cv.create_text(x, y, text=str(arg), anchor=anchor, fill=self._pencolor, font=font)
        self._items.append(item)
        if move:
            size = abs(int(font[1])) if isinstance(font, (list, tuple)) and len(font) > 1 else 8
            self._x += len(str(arg)) * size * 0.75
            self._update_shape()

    def showturtle(self):
        self._visible = True
        self._update_shape(force=True)

    st = showturtle

    def hideturtle(self):
        self._visible = False
        if self._shape_item is not None:
            self.screen.cv.itemconfigure(self._shape_item, state='hidden')

    ht = hideturtle

    def isvisible(self):
        return self._visible

    def shape(self, name=None):
        if name is None:
            return self._shape
        if name not in self.screen._shapes:
            raise TurtleGraphicsError('There is no shape named %s' % name)
        self._shape = name
        if self._shape_item is not None:
            self.screen.cv.delete(self._shape_item)
            self._shape_item = None
        self._update_shape(force=True)

    def resizemode(self, rmode=None):
        return 'noresize' if rmode is None else None

    def shapesize(self, stretch_wid=None, stretch_len=None, outline=None):
        if stretch_wid is None and stretch_len is None and outline is None:
            return self._stretch
        sw = self._stretch[0] if stretch_wid is None else stretch_wid
        sl = sw if stretch_len is None and stretch_wid is not None else (self._stretch[1] if stretch_len is None else stretch_len)
        ol = self._stretch[2] if outline is None else outline
        self._stretch = (sw, sl, ol)
        self._update_shape(force=True)

    turtlesize = shapesize

    def shearfactor(self, shear=None):
        return 0.0

    def tilt(self, angle):
        self._tilt = (self._tilt + angle) % 360
        self._update_shape(force=True)

    def settiltangle(self, angle):
        self._tilt = angle % 360
        self._update_shape(force=True)

    def tiltangle(self, angle=None):
        if angle is None:
            return self._tilt
        self.settiltangle(angle)

    def shapetransform(self, t11=None, t12=None, t21=None, t22=None):
        return (1.0, 0.0, 0.0, 1.0)

    def clone(self):
        t = Turtle(shape=self._shape, visible=self._visible)
        t.penup()
        t.goto(self._x, self._y)
        t._heading = self._heading
        t._pendown = self._pendown
        t.pencolor(self._pencolor_raw)
        t.fillcolor(self._fillcolor_raw)
        t._pensize = self._pensize
        t._speed = self._speed
        t._update_shape(force=True)
        return t

    def getturtle(self):
        return self

    getpen = getturtle

    def getscreen(self):
        return self.screen

    def _item_bind(self, seq, fun, add):
        if self._shape_item is None:
            self._update_shape(force=True)

        def handler(event):
            x, y = self.screen._fromcanvas(event.x, event.y)
            fun(x, y)
        self.screen.cv.tag_bind(self._shape_item, seq, handler, add)

    def onclick(self, fun, btn=1, add=None):
        self._item_bind('<Button-%s>' % btn, fun, add)

    def onrelease(self, fun, btn=1, add=None):
        self._item_bind('<ButtonRelease-%s>' % btn, fun, add)

    def ondrag(self, fun, btn=1, add=None):
        def handler(event):
            x, y = self.screen._fromcanvas(event.x, event.y)
            fun(x, y)
        self.screen.cv.bind('<B%s-Motion>' % btn, handler, add)


RawPen = RawTurtle


class Turtle(RawTurtle):
    _pen = None
    _screen = None

    def __init__(self, shape='classic', undobuffersize=1000, visible=True):
        RawTurtle.__init__(self, Screen(), shape=shape, undobuffersize=undobuffersize, visible=visible)


Pen = Turtle


def getturtle():
    if Turtle._pen is None or Turtle._pen not in Screen()._turtles:
        Turtle._pen = Turtle()
    return Turtle._pen


getpen = getturtle


def getscreen():
    return Screen()


def done():
    if _screen is not None and _screen._alive:
        _screen.mainloop()


mainloop = done


def bye():
    if _screen is not None:
        _screen.bye()


def exitonclick():
    Screen().exitonclick()


def write_docstringdict(filename='turtle_docstringdict'):
    pass


_TURTLE_METHODS = ['back', 'backward', 'begin_fill', 'begin_poly', 'bk', 'circle', 'clear', 'clearstamp',
                   'clearstamps', 'clone', 'color', 'degrees', 'distance', 'dot', 'down', 'end_fill', 'end_poly',
                   'fd', 'fillcolor', 'filling', 'forward', 'get_poly', 'getpen', 'goto', 'heading', 'hideturtle',
                   'home', 'ht', 'isdown', 'isvisible', 'left', 'lt', 'onclick', 'ondrag', 'onrelease', 'pd', 'pen',
                   'pencolor', 'pendown', 'pensize', 'penup', 'pos', 'position', 'pu', 'radians', 'right',
                   'reset', 'resizemode', 'rt', 'seth', 'setheading', 'setpos', 'setposition', 'settiltangle',
                   'setundobuffer', 'setx', 'sety', 'shape', 'shapesize', 'shapetransform', 'shearfactor',
                   'showturtle', 'speed', 'st', 'stamp', 'teleport', 'tilt', 'tiltangle', 'towards', 'turtlesize',
                   'undo', 'undobufferentries', 'up', 'width', 'write', 'xcor', 'ycor']
_SCREEN_METHODS = ['addshape', 'bgcolor', 'bgpic', 'clearscreen', 'colormode', 'delay', 'getcanvas', 'getshapes',
                   'listen', 'mode', 'numinput', 'onkey', 'onkeypress', 'onkeyrelease', 'onscreenclick', 'ontimer',
                   'register_shape', 'resetscreen', 'screensize', 'setup', 'setworldcoordinates', 'textinput',
                   'title', 'tracer', 'turtles', 'update', 'window_height', 'window_width']


def _make_turtle_function(name):
    def func(*args, **kw):
        return getattr(getturtle(), name)(*args, **kw)
    func.__name__ = name
    return func


def _make_screen_function(name):
    def func(*args, **kw):
        return getattr(Screen(), name)(*args, **kw)
    func.__name__ = name
    return func


for _name in _TURTLE_METHODS:
    globals()[_name] = _make_turtle_function(_name)
    __all__.append(_name)
for _name in _SCREEN_METHODS:
    globals()[_name] = _make_screen_function(_name)
    __all__.append(_name)
