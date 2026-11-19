"""Virtuelles Netzwerk für Python-Programme in DesktopSim.

Ersetzt socket.socket, select.select und selectors durch Varianten, die über das
DesktopSim-Netz (im Browser) kommunizieren. Server und Client können in zwei Terminals,
in Python und Java gemischt, oder sogar mit dem DesktopSim-Browser (http://localhost:PORT)
sprechen. Erreichbar sind localhost, 127.0.0.1, 0.0.0.0, '' und der eigene Rechnername.
"""
import socket as _socket
import select as _select
import selectors as _selectors
import io as _io
import itertools as _it
import _dsbridge as _b

_real_socket = _socket.socket
_windows = [False]
_hostname = ['desktopsim']
_fds = _it.count(3)
_by_fd = {}


def configure(windows=False, hostname='desktopsim'):
    _windows[0] = bool(windows)
    _hostname[0] = hostname


def _err(reply):
    code = reply.get('error')
    msg = reply.get('message', code)
    win = _windows[0]
    if code == 'ECONNREFUSED':
        if win:
            return ConnectionRefusedError(10061, 'Es konnte keine Verbindung hergestellt werden, da der Zielcomputer die Verbindung verweigerte')
        return ConnectionRefusedError(111, 'Connection refused')
    if code == 'EADDRINUSE':
        if win:
            return OSError(10048, 'Normalerweise darf jede Socketadresse (Protokoll, Netzwerkadresse oder Anschluss) nur jeweils einmal verwendet werden')
        return OSError(98, 'Address already in use')
    if code == 'EADDRNOTAVAIL':
        if win:
            return OSError(10049, 'Die angeforderte Adresse ist in diesem Kontext ungültig')
        return OSError(99, 'Cannot assign requested address')
    if code == 'ETIMEDOUT':
        return TimeoutError('timed out')
    if code == 'EPIPE':
        return BrokenPipeError(32, 'Broken pipe') if not win else ConnectionAbortedError(10053, 'Eine bestehende Verbindung wurde softwaregesteuert durch den Hostcomputer abgebrochen')
    if code == 'ECONNRESET':
        return ConnectionResetError(10054 if win else 104, 'Eine vorhandene Verbindung wurde vom Remotehost geschlossen' if win else 'Connection reset by peer')
    if code == 'ENOTCONN':
        return OSError(10057 if win else 107, 'Transport endpoint is not connected')
    if code == 'EBADF':
        return OSError(10038 if win else 9, 'Bad file descriptor')
    if code == 'EHOSTUNREACH':
        return OSError(10065 if win else 113, 'No route to host')
    if code == 'EGAI':
        if win:
            return _socket.gaierror(11001, 'getaddrinfo failed')
        return _socket.gaierror(-2, 'Name or service not known')
    if code == 'EINVAL':
        return OSError(10022 if win else 22, 'Invalid argument')
    if code in ('nosync', 'eof'):
        return OSError(100, 'Das virtuelle Netzwerk benötigt den DesktopSim-Service-Worker (Seite über http(s) öffnen und neu laden).')
    return OSError(5, str(msg))


def _net(op, **args):
    reply = _b.call('net.' + op, **args)
    if not isinstance(reply, dict):
        raise OSError(5, 'Netzwerkfehler')
    if reply.get('error'):
        raise _err(reply)
    return reply


def _addr(address):
    if isinstance(address, str):
        raise TypeError('%s(): AF_INET address must be tuple, not str' % 'connect')
    host, port = address[0], address[1]
    if not isinstance(port, int):
        raise TypeError("'%s' object cannot be interpreted as an integer" % type(port).__name__)
    if not 0 <= port <= 65535:
        raise OverflowError('connect(): port must be 0-65535.')
    return str(host), int(port)


class socket:
    """Socket im DesktopSim-Netz (TCP und UDP, IPv4)."""

    def __init__(self, family=_socket.AF_INET, type=_socket.SOCK_STREAM, proto=0, fileno=None):
        self.family = family
        self.type = type
        self.proto = proto
        self._fd = next(_fds)
        self._timeout = _socket.getdefaulttimeout()
        self._kind = 'new'
        self._id = None
        self._local = None
        self._remote = None
        self._closed = False
        self._shut_wr = False
        self._backlog = 0
        _by_fd[self._fd] = self

    def __repr__(self):
        state = '[closed]' if self._closed else ''
        info = 'fd=%d, family=%s, type=%s, proto=%d' % (-1 if self._closed else self._fd, self.family, self.type, self.proto)
        if self._local:
            info += ', laddr=%r' % (self._local,)
        if self._remote:
            info += ', raddr=%r' % (self._remote,)
        return '<socket.socket %s%s>' % (state, info)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def __del__(self):
        pass

    def _check(self):
        if self._closed:
            raise _err({'error': 'EBADF'})

    def _tm(self):
        return -1 if self._timeout is None else int(self._timeout * 1000)

    def fileno(self):
        return -1 if self._closed else self._fd

    def setsockopt(self, *args):
        pass

    def getsockopt(self, level, option, buflen=None):
        return 0

    def setblocking(self, flag):
        self._timeout = None if flag else 0.0

    def getblocking(self):
        return self._timeout != 0.0

    def settimeout(self, value):
        if value is not None and value < 0:
            raise ValueError('Timeout value out of range')
        self._timeout = value

    def gettimeout(self):
        return self._timeout

    def bind(self, address):
        self._check()
        host, port = _addr(address)
        r = _net('bind', host=host, port=port, udp=self.type == _socket.SOCK_DGRAM, fd=self._fd)
        self._local = (r['host'], r['port'])
        if self.type == _socket.SOCK_DGRAM:
            self._id = r['id']
            self._kind = 'udp'

    def listen(self, backlog=128):
        self._check()
        if not self._local:
            self.bind(('0.0.0.0', 0))
        r = _net('listen', host=self._local[0], port=self._local[1], backlog=backlog)
        self._id = r['id']
        self._kind = 'listen'

    def accept(self):
        self._check()
        if self._kind != 'listen':
            raise _err({'error': 'EINVAL'})
        r = _net('accept', id=self._id, timeout=self._tm())
        conn = socket(self.family, self.type, self.proto)
        conn._id = r['conn']
        conn._kind = 'conn'
        conn._local = tuple(r['local'])
        conn._remote = tuple(r['remote'])
        return conn, tuple(r['remote'])

    def connect(self, address):
        self._check()
        host, port = _addr(address)
        if self.type == _socket.SOCK_DGRAM:
            self._remote = (host, port)
            return
        r = _net('connect', host=host, port=port, timeout=self._tm(),
                 local=list(self._local) if self._local else None)
        self._id = r['conn']
        self._kind = 'conn'
        self._local = tuple(r['local'])
        self._remote = tuple(r['remote'])

    def connect_ex(self, address):
        try:
            self.connect(address)
            return 0
        except OSError as exc:
            return exc.errno or 1

    def _data(self, data):
        if isinstance(data, str):
            raise TypeError("a bytes-like object is required, not 'str'")
        return bytes(data).decode('latin-1')

    def send(self, data, flags=0):
        self._check()
        if self.type == _socket.SOCK_DGRAM:
            if not self._remote:
                raise _err({'error': 'ENOTCONN'})
            return self.sendto(data, self._remote)
        if self._kind != 'conn':
            raise _err({'error': 'ENOTCONN'})
        payload = self._data(data)
        _net('send', conn=self._id, data=payload)
        return len(payload)

    def sendall(self, data, flags=0):
        self.send(data, flags)
        return None

    def sendto(self, data, flags_or_address, address=None):
        self._check()
        address = flags_or_address if address is None else address
        host, port = _addr(address)
        if self._kind != 'udp':
            self.bind(('0.0.0.0', 0))
        payload = self._data(data)
        _net('sendto', id=self._id, host=host, port=port, data=payload)
        return len(payload)

    def recv(self, bufsize, flags=0):
        self._check()
        if self.type == _socket.SOCK_DGRAM:
            return self.recvfrom(bufsize)[0]
        if self._kind != 'conn':
            raise _err({'error': 'ENOTCONN'})
        if bufsize < 0:
            raise ValueError('negative buffersize in recv')
        r = _net('recv', conn=self._id, max=int(bufsize), timeout=self._tm())
        return r['data'].encode('latin-1')

    def recv_into(self, buffer, nbytes=0, flags=0):
        data = self.recv(nbytes or len(buffer))
        buffer[:len(data)] = data
        return len(data)

    def recvfrom(self, bufsize, flags=0):
        self._check()
        if self._kind != 'udp':
            raise _err({'error': 'EINVAL'})
        r = _net('recvfrom', id=self._id, max=int(bufsize), timeout=self._tm())
        return r['data'].encode('latin-1'), tuple(r['from'])

    def shutdown(self, how):
        if self._kind == 'conn' and how in (_socket.SHUT_WR, _socket.SHUT_RDWR):
            _net('shutdown', conn=self._id)
            self._shut_wr = True

    def close(self):
        if self._closed:
            return
        self._closed = True
        _by_fd.pop(self._fd, None)
        if self._id is not None:
            try:
                _b.call('net.close', id=self._id)
            except Exception:
                pass

    def detach(self):
        self._closed = True
        return self._fd

    def getsockname(self):
        if self._local:
            return self._local
        return ('0.0.0.0', 0)

    def getpeername(self):
        if not self._remote:
            raise _err({'error': 'ENOTCONN'})
        return self._remote

    def makefile(self, mode='r', buffering=None, *, encoding=None, errors=None, newline=None):
        raw = _SocketIO(self, mode)
        binary = 'b' in mode
        reading = 'r' in mode
        writing = 'w' in mode or 'a' in mode
        if buffering is None:
            buffering = -1
        if buffering < 0:
            buffering = _io.DEFAULT_BUFFER_SIZE
        if buffering == 0:
            if not binary:
                raise ValueError('unbuffered streams must be binary')
            return raw
        if reading and writing:
            buffer = _io.BufferedRWPair(raw, raw, buffering)
        elif reading:
            buffer = _io.BufferedReader(raw, buffering)
        else:
            buffer = _io.BufferedWriter(raw, buffering)
        if binary:
            return buffer
        text = _io.TextIOWrapper(buffer, encoding, errors, newline, line_buffering=writing)
        text.mode = mode
        return text

    def dup(self):
        return self

    @property
    def timeout(self):
        return self._timeout


class _SocketIO(_io.RawIOBase):
    def __init__(self, sock, mode):
        super().__init__()
        self._sock = sock
        self._mode = mode

    def readinto(self, b):
        data = self._sock.recv(len(b))
        b[:len(data)] = data
        return len(data)

    def write(self, b):
        return self._sock.send(b)

    def readable(self):
        return 'r' in self._mode

    def writable(self):
        return 'w' in self._mode or 'a' in self._mode

    def fileno(self):
        return self._sock.fileno()


def create_connection(address, timeout=_socket._GLOBAL_DEFAULT_TIMEOUT, source_address=None, *, all_errors=False):
    s = socket()
    if timeout is not _socket._GLOBAL_DEFAULT_TIMEOUT:
        s.settimeout(timeout)
    if source_address:
        s.bind(source_address)
    s.connect(address)
    return s


def create_server(address, *, family=_socket.AF_INET, backlog=None, reuse_port=False, dualstack_ipv6=False):
    s = socket(family)
    s.bind(address)
    s.listen(backlog or 128)
    return s


_LOCAL = ('localhost', '127.0.0.1', '0.0.0.0', '', '::1', 'ip6-localhost')


def gethostname():
    return _hostname[0]


def gethostbyname(name):
    if name in _LOCAL or name == _hostname[0] or str(name).startswith('127.'):
        return '127.0.0.1' if name != _hostname[0] else '127.0.1.1'
    parts = str(name).split('.')
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        return name
    raise _err({'error': 'EGAI'})


def gethostbyname_ex(name):
    return (name, [], [gethostbyname(name)])


def gethostbyaddr(ip):
    if ip.startswith('127.') or ip in ('::1', 'localhost'):
        return ('localhost', [], [ip])
    raise _socket.herror(1, 'Unknown host')


def getfqdn(name=''):
    return name or _hostname[0]


def getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    ip = gethostbyname(host if host is not None else 'localhost')
    port = int(port or 0)
    types = [type] if type else [_socket.SOCK_STREAM, _socket.SOCK_DGRAM]
    return [(_socket.AF_INET, t, 6 if t == _socket.SOCK_STREAM else 17, '', (ip, port)) for t in types]


def _readable(s):
    return s if isinstance(s, socket) else _by_fd.get(s if isinstance(s, int) else s.fileno())


def select(rlist, wlist, xlist, timeout=None):
    socks = [(_readable(s), s) for s in rlist]
    ids = [x._id for x, _ in socks if x is not None and x._id is not None]
    if not ids:
        if timeout:
            _b.call('sleep', ms=int(timeout * 1000))
        return [], list(wlist), []
    r = _net('select', ids=ids, timeout=-1 if timeout is None else int(timeout * 1000))
    ready = set(r.get('ready', []))
    return [orig for x, orig in socks if x is not None and x._id in ready], list(wlist), []


class DefaultSelector(_selectors.BaseSelector):
    """Selector für das DesktopSim-Netz (wird von socketserver & Co. verwendet)."""

    def __init__(self):
        self._map = {}

    def register(self, fileobj, events, data=None):
        fd = fileobj if isinstance(fileobj, int) else fileobj.fileno()
        key = _selectors.SelectorKey(fileobj, fd, events, data)
        self._map[fd] = key
        return key

    def unregister(self, fileobj):
        fd = fileobj if isinstance(fileobj, int) else fileobj.fileno()
        return self._map.pop(fd)

    def modify(self, fileobj, events, data=None):
        self.unregister(fileobj)
        return self.register(fileobj, events, data)

    def select(self, timeout=None):
        readers = [k for k in self._map.values() if k.events & _selectors.EVENT_READ]
        writers = [k for k in self._map.values() if k.events & _selectors.EVENT_WRITE]
        ready = []
        if writers:
            ready.extend((k, _selectors.EVENT_WRITE) for k in writers)
            timeout = 0
        socks = {k.fd: _by_fd.get(k.fd) for k in readers}
        ids = {s._id: fd for fd, s in socks.items() if s is not None and s._id is not None}
        if ids:
            r = _net('select', ids=list(ids), timeout=-1 if timeout is None else int(max(0, timeout) * 1000))
            for i in r.get('ready', []):
                key = self._map.get(ids.get(i))
                if key:
                    ready.append((key, _selectors.EVENT_READ))
        elif timeout:
            _b.call('sleep', ms=int(timeout * 1000))
        return ready

    def close(self):
        self._map.clear()

    def get_map(self):
        return self._map


_CONSTANTS = {'SOL_SOCKET': 1, 'SO_REUSEADDR': 2, 'SO_TYPE': 3, 'SO_ERROR': 4, 'SO_BROADCAST': 6, 'SO_SNDBUF': 7,
              'SO_RCVBUF': 8, 'SO_KEEPALIVE': 9, 'SO_LINGER': 13, 'SO_REUSEPORT': 15, 'SO_RCVTIMEO': 20, 'SO_SNDTIMEO': 21,
              'IPPROTO_IP': 0, 'IPPROTO_TCP': 6, 'IPPROTO_UDP': 17, 'TCP_NODELAY': 1, 'SHUT_RD': 0, 'SHUT_WR': 1,
              'SHUT_RDWR': 2, 'SOMAXCONN': 128, 'INADDR_ANY': 0, 'INADDR_LOOPBACK': 0x7f000001, 'MSG_PEEK': 2,
              'MSG_DONTWAIT': 64, 'AF_UNSPEC': 0, 'AI_PASSIVE': 1}


def install(windows=False, hostname='desktopsim'):
    configure(windows, hostname)
    for name, value in _CONSTANTS.items():
        if not hasattr(_socket, name):
            setattr(_socket, name, value)
    _socket.socket = socket
    _socket.SocketType = socket
    _socket.create_connection = create_connection
    _socket.create_server = create_server
    _socket.gethostname = gethostname
    _socket.gethostbyname = gethostbyname
    _socket.gethostbyname_ex = gethostbyname_ex
    _socket.gethostbyaddr = gethostbyaddr
    _socket.getfqdn = getfqdn
    _socket.getaddrinfo = getaddrinfo
    _select.select = select
    _selectors.DefaultSelector = DefaultSelector
    _selectors.SelectSelector = DefaultSelector
    _selectors.PollSelector = DefaultSelector
    try:
        import socketserver
        socketserver._ServerSelector = DefaultSelector
    except Exception:
        pass
