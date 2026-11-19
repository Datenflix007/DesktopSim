// Virtuelles Netzwerk (TCP/UDP über localhost) für alle Programme in DesktopSim.
// Python (socket), Java (java.net.Socket/ServerSocket) und der DesktopSim-Browser teilen sich
// dieselben Ports. Daten werden als Latin-1-Zeichenketten (1 Zeichen = 1 Byte) übertragen.
const LOCAL = new Set(['localhost', '127.0.0.1', '0.0.0.0', '', '::1', 'ip6-localhost', '::']);

export class VirtualNet {
  constructor(hostname = () => 'desktopsim') {
    this.hostname = hostname;
    this.serial = 0;
    this.listeners = new Map();   // port -> listener
    this.udp = new Map();         // port -> udp socket
    this.objects = new Map();     // id -> listener | conn | udp
    this.nextEphemeral = 49152;
    this.watchers = new Set();
  }
  onChange(fn) { this.watchers.add(fn); return () => this.watchers.delete(fn); }
  changed() { for (const fn of this.watchers) try { fn(); } catch { /* ignore */ } }
  isLocal(host) { host = String(host ?? '').toLowerCase(); return LOCAL.has(host) || host.startsWith('127.') || host === String(this.hostname()).toLowerCase(); }
  resolve(host) {
    if (this.isLocal(host)) return true;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(String(host))) return 'unreachable';
    return false;
  }
  ephemeral() { for (let i = 0; i < 16000; i++) { const p = this.nextEphemeral++; if (this.nextEphemeral > 65000) this.nextEphemeral = 49152; if (!this.listeners.has(p) && !this.udp.has(p)) return p; } return 0; }
  id(prefix) { return prefix + (++this.serial); }
  /** Wartet, bis check() etwas liefert oder die Zeit abläuft (timeout<0 = unbegrenzt). */
  wait(obj, check, timeout) {
    const now = check();
    if (now !== undefined) return Promise.resolve(now);
    if (timeout === 0) return Promise.resolve({ error: 'ETIMEDOUT' });
    return new Promise(resolve => {
      let timer = null;
      const waiter = () => { const r = check(); if (r === undefined) return false; clearTimeout(timer); resolve(r); return true; };
      obj.waiters.add(waiter);
      if (timeout > 0) timer = setTimeout(() => { obj.waiters.delete(waiter); resolve({ error: 'ETIMEDOUT' }); }, timeout);
    });
  }
  wake(obj) { if (!obj) return; for (const w of [...obj.waiters]) if (w()) obj.waiters.delete(w); this.wakeSelect(); }
  wakeSelect() { for (const w of [...(this.selectWaiters || [])]) if (w()) this.selectWaiters.delete(w); }

  // ---------- Operationen (owner = Sitzung, damit beim Programmende aufgeräumt wird)
  bind({ host = '', port = 0, udp = false }, owner) {
    const r = this.resolve(host);
    if (r !== true) return { error: 'EADDRNOTAVAIL' };
    port = Number(port) || 0;
    if (udp) {
      if (port && this.udp.has(port)) return { error: 'EADDRINUSE' };
      port ||= this.ephemeral();
      const sock = { kind: 'udp', id: this.id('u'), port, queue: [], waiters: new Set(), owner };
      this.udp.set(port, sock); this.objects.set(sock.id, sock); owner?.objects.add(sock.id); this.changed();
      return { ok: true, id: sock.id, host: host || '0.0.0.0', port };
    }
    if (port && this.listeners.has(port)) return { error: 'EADDRINUSE' };
    return { ok: true, host: host || '0.0.0.0', port: port || this.ephemeral() };
  }
  listen({ host = '', port, backlog = 128 }, owner, label = 'python') {
    port = Number(port);
    if (this.listeners.has(port)) return { error: 'EADDRINUSE' };
    const l = { kind: 'listen', id: this.id('l'), host: host || '0.0.0.0', port, backlog: [], max: backlog, waiters: new Set(), owner, label };
    this.listeners.set(port, l); this.objects.set(l.id, l); owner?.objects.add(l.id); this.changed();
    return { ok: true, id: l.id };
  }
  async accept({ id, timeout = -1 }, owner) {
    const l = this.objects.get(id);
    if (!l || l.kind !== 'listen' || l.closed) return { error: 'EBADF' };
    const r = await this.wait(l, () => l.closed ? { error: 'EBADF' } : l.backlog.length ? l.backlog.shift() : undefined, timeout);
    if (r.error) return r;
    r.conn.owner = owner; owner?.objects.add(r.conn.id);
    return { conn: r.conn.id, local: [r.conn.local[0], r.conn.local[1]], remote: [r.conn.remote[0], r.conn.remote[1]] };
  }
  /** Verbindung herstellen; liefert die Client-Seite. */
  async connect({ host = 'localhost', port, timeout = -1, local = null }, owner) {
    const r = this.resolve(host);
    if (r === false) return { error: 'EGAI' };
    if (r === 'unreachable') return timeout > 0 ? new Promise(res => setTimeout(() => res({ error: 'ETIMEDOUT' }), Math.min(timeout, 3000))) : { error: 'EHOSTUNREACH' };
    const l = this.listeners.get(Number(port));
    if (!l || l.closed) return { error: 'ECONNREFUSED' };
    const clientPort = local?.[1] || this.ephemeral();
    const a = { kind: 'conn', id: this.id('c'), buf: '', eof: false, closed: false, waiters: new Set(), owner, local: ['127.0.0.1', clientPort], remote: ['127.0.0.1', Number(port)] };
    const b = { kind: 'conn', id: this.id('c'), buf: '', eof: false, closed: false, waiters: new Set(), owner: null, local: ['127.0.0.1', Number(port)], remote: ['127.0.0.1', clientPort] };
    a.peer = b; b.peer = a;
    this.objects.set(a.id, a); this.objects.set(b.id, b); owner?.objects.add(a.id);
    l.backlog.push({ conn: b }); this.wake(l); this.changed();
    return { conn: a.id, local: a.local, remote: a.remote, connObj: a };
  }
  send({ conn, data }) {
    const c = this.objects.get(conn);
    if (!c || c.closed) return { error: 'EBADF' };
    if (c.shutWr) return { error: 'EPIPE' };
    const p = c.peer;
    if (!p || p.closed) return { error: 'EPIPE' };
    p.buf += String(data ?? ''); c.sent = (c.sent || 0) + String(data ?? '').length;
    this.wake(p);
    return { ok: true, n: String(data ?? '').length };
  }
  recv({ conn, max = 65536, timeout = -1 }) {
    const c = this.objects.get(conn);
    if (!c || c.closed) return Promise.resolve({ error: 'EBADF' });
    return this.wait(c, () => {
      if (c.buf.length) { const data = c.buf.slice(0, Math.max(1, max)); c.buf = c.buf.slice(data.length); return { data }; }
      if (c.eof || !c.peer || c.peer.closed) return { data: '' };
      return undefined;
    }, timeout);
  }
  shutdown({ conn }) {
    const c = this.objects.get(conn); if (!c) return { error: 'EBADF' };
    c.shutWr = true; if (c.peer) { c.peer.eof = true; this.wake(c.peer); }
    return { ok: true };
  }
  sendto({ id, host, port, data }) {
    const s = this.objects.get(id);
    if (!s) return { error: 'EBADF' };
    const r = this.resolve(host);
    if (r === false) return { error: 'EGAI' };
    const target = this.udp.get(Number(port));
    if (target && r === true) { target.queue.push({ data: String(data ?? ''), from: ['127.0.0.1', s.port] }); this.wake(target); }
    return { ok: true };
  }
  recvfrom({ id, max = 65536, timeout = -1 }) {
    const s = this.objects.get(id);
    if (!s) return Promise.resolve({ error: 'EBADF' });
    return this.wait(s, () => s.queue.length ? (m => ({ data: m.data.slice(0, max), from: m.from }))(s.queue.shift()) : undefined, timeout);
  }
  readable(obj) {
    if (!obj) return true;
    if (obj.kind === 'listen') return obj.closed || obj.backlog.length > 0;
    if (obj.kind === 'conn') return obj.closed || obj.buf.length > 0 || obj.eof || !obj.peer || obj.peer.closed;
    if (obj.kind === 'udp') return obj.queue.length > 0;
    return false;
  }
  select({ ids = [], timeout = -1 }) {
    const check = () => { const ready = ids.filter(i => this.readable(this.objects.get(i))); return ready.length ? { ready } : undefined; };
    const now = check();
    if (now) return Promise.resolve(now);
    if (timeout === 0) return Promise.resolve({ ready: [] });
    this.selectWaiters ||= new Set();
    return new Promise(resolve => {
      let timer = null;
      const waiter = () => { const r = check(); if (!r) return false; clearTimeout(timer); resolve(r); return true; };
      this.selectWaiters.add(waiter);
      if (timeout > 0) timer = setTimeout(() => { this.selectWaiters.delete(waiter); resolve({ ready: [] }); }, timeout);
    });
  }
  close({ id }) {
    const o = this.objects.get(id);
    if (!o) return { ok: true };
    o.closed = true; this.objects.delete(id);
    if (o.kind === 'listen') { if (this.listeners.get(o.port) === o) this.listeners.delete(o.port); for (const p of o.backlog) this.close({ id: p.conn.id }); }
    if (o.kind === 'udp' && this.udp.get(o.port) === o) this.udp.delete(o.port);
    if (o.kind === 'conn' && o.peer) { o.peer.eof = true; this.wake(o.peer); }
    this.wake(o); this.changed();
    return { ok: true };
  }
  /** Alle Sockets eines beendeten Programms schließen. */
  release(owner) { for (const id of [...(owner?.objects || [])]) this.close({ id }); }
  /** Liste offener Ports (für netstat/ss und die IDE). */
  ports() {
    const out = [];
    for (const l of this.listeners.values()) out.push({ proto: 'tcp', port: l.port, host: l.host, state: 'LISTEN', label: l.label || l.owner?.label || '' });
    for (const o of this.objects.values()) if (o.kind === 'conn' && !o.closed) out.push({ proto: 'tcp', port: o.local[1], host: '127.0.0.1', state: 'ESTABLISHED', remote: o.remote, label: o.owner?.label || '' });
    for (const u of this.udp.values()) out.push({ proto: 'udp', port: u.port, host: '0.0.0.0', state: '', label: u.owner?.label || '' });
    return out;
  }
  hasListener(port) { return this.listeners.has(Number(port)); }
  /** Rohe HTTP-Anfrage an einen Socket-Server (für den DesktopSim-Browser). */
  async httpRequest(port, raw, timeout = 8000) {
    const c = await this.connect({ host: 'localhost', port, timeout }, null);
    if (c.error) return { error: c.error };
    this.send({ conn: c.conn, data: raw });
    let response = '';
    const deadline = Date.now() + timeout;
    for (;;) {
      const left = deadline - Date.now();
      if (left <= 0) break;
      const r = await this.recv({ conn: c.conn, timeout: left });
      if (r.error || r.data === '') break;
      response += r.data;
      const head = response.indexOf('\r\n\r\n');
      if (head >= 0) { const m = response.slice(0, head).match(/content-length:\s*(\d+)/i); if (m && response.length - head - 4 >= Number(m[1])) break; }
    }
    this.close({ id: c.conn });
    return { response };
  }
  /** Dispatcher für Aufrufe aus Laufzeiten: op = 'bind' | 'listen' | ... */
  call(op, args, owner, label) {
    switch (op) {
      case 'bind': return this.bind(args, owner);
      case 'listen': return this.listen(args, owner, label);
      case 'accept': return this.accept(args, owner);
      case 'connect': return this.connect(args, owner).then(r => { delete r.connObj; return r; });
      case 'send': return this.send(args);
      case 'recv': return this.recv(args);
      case 'shutdown': return this.shutdown(args);
      case 'sendto': return this.sendto(args);
      case 'recvfrom': return this.recvfrom(args);
      case 'select': return this.select(args);
      case 'close': return this.close(args);
      default: return { error: 'EINVAL', message: 'unbekannte Netzwerkoperation ' + op };
    }
  }
}
