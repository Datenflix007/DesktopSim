// Kleine WASI-preview1-Implementierung für von Clang erzeugte Programme.
// Stellt stdin/stdout/stderr, Argumente, Umgebung, Uhr, Zufall und ein In-Memory-Dateisystem
// (vorbelegt mit dem aktuellen Arbeitsverzeichnis) bereit.
const E = { SUCCESS: 0, BADF: 8, EXIST: 20, INVAL: 28, ISDIR: 31, NOENT: 44, NOSYS: 52, NOTDIR: 54, NOTEMPTY: 55, SPIPE: 70 };
export class WasiExit extends Error { constructor(code) { super('exit ' + code); this.code = code; } }

export class WasiRuntime {
  constructor({ args = [], env = {}, files = {}, stdin, stdout, stderr }) {
    this.args = args; this.env = Object.entries(env).map(([k, v]) => `${k}=${v}`);
    this.stdin = stdin; this.stdout = stdout; this.stderr = stderr;
    this.files = new Map(); this.dirs = new Set(['']); this.changed = new Set();
    const enc = new TextEncoder();
    for (const [path, content] of Object.entries(files)) this.putFile(path, typeof content === 'string' ? enc.encode(content) : content, false);
    this.fds = new Map([[0, { kind: 'stdin' }], [1, { kind: 'stdout' }], [2, { kind: 'stderr' }], [3, { kind: 'dir', path: '', preopen: '/' }]]);
    this.nextFd = 4; this.memory = null;
  }
  putFile(path, bytes, mark = true) {
    const parts = path.split('/'); for (let i = 1; i < parts.length; i++) this.dirs.add(parts.slice(0, i).join('/'));
    this.files.set(path, bytes); if (mark) this.changed.add(path);
  }
  resolve(dirFd, rel) {
    const base = this.fds.get(dirFd); if (!base || base.kind !== 'dir') return null;
    const out = base.path ? base.path.split('/') : [];
    for (const s of rel.split('/')) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); }
    return out.join('/');
  }
  get view() { return new DataView(this.memory.buffer); }
  get bytes() { return new Uint8Array(this.memory.buffer); }
  str(ptr, len) { return new TextDecoder().decode(this.bytes.subarray(ptr, ptr + len)); }
  iovs(ptr, count) { const v = this.view, list = []; for (let i = 0; i < count; i++) list.push([v.getUint32(ptr + i * 8, true), v.getUint32(ptr + i * 8 + 4, true)]); return list; }
  writeStrings(list, ptrs, buf) { const v = this.view, b = this.bytes, enc = new TextEncoder(); for (const s of list) { v.setUint32(ptrs, buf, true); ptrs += 4; const e = enc.encode(s + '\0'); b.set(e, buf); buf += e.length; } return E.SUCCESS; }
  sizes(list, countPtr, sizePtr) { const enc = new TextEncoder(); this.view.setUint32(countPtr, list.length, true); this.view.setUint32(sizePtr, list.reduce((n, s) => n + enc.encode(s).length + 1, 0), true); return E.SUCCESS; }
  filestat(ptr, type, size) { const v = this.view; for (let i = 0; i < 64; i += 8) v.setBigUint64(ptr + i, 0n, true); v.setUint8(ptr + 16, type); v.setBigUint64(ptr + 32, BigInt(size), true); }

  imports() {
    const self = this;
    const wasi = {
      args_get: (argv, buf) => self.writeStrings(self.args, argv, buf),
      args_sizes_get: (c, s) => self.sizes(self.args, c, s),
      environ_get: (env, buf) => self.writeStrings(self.env, env, buf),
      environ_sizes_get: (c, s) => self.sizes(self.env, c, s),
      clock_res_get: (id, ptr) => { self.view.setBigUint64(ptr, 1000n, true); return E.SUCCESS; },
      clock_time_get: (id, precision, ptr) => { const ns = id === 0 ? BigInt(Date.now()) * 1000000n : BigInt(Math.round(performance.now() * 1e6)); self.view.setBigUint64(ptr, ns, true); return E.SUCCESS; },
      random_get: (ptr, len) => { crypto.getRandomValues(self.bytes.subarray(ptr, ptr + len)); return E.SUCCESS; },
      sched_yield: () => E.SUCCESS,
      proc_exit: code => { throw new WasiExit(code); },
      proc_raise: () => E.NOSYS,
      poll_oneoff: (inPtr, outPtr, n, neventsPtr) => { self.view.setUint32(neventsPtr, 0, true); return E.SUCCESS; },
      fd_write: (fd, iovs, count, nwritten) => {
        let total = 0; const f = self.fds.get(fd); if (!f) return E.BADF;
        for (const [ptr, len] of self.iovs(iovs, count)) {
          const chunk = self.bytes.slice(ptr, ptr + len); total += len;
          if (f.kind === 'stdout') self.stdout(chunk); else if (f.kind === 'stderr') self.stderr(chunk);
          else if (f.kind === 'file') {
            const old = self.files.get(f.path) || new Uint8Array(0); const pos = f.append ? old.length : f.pos;
            const next = new Uint8Array(Math.max(old.length, pos + chunk.length)); next.set(old); next.set(chunk, pos);
            self.putFile(f.path, next); f.pos = pos + chunk.length;
          } else return E.BADF;
        }
        self.view.setUint32(nwritten, total, true); return E.SUCCESS;
      },
      fd_read: (fd, iovs, count, nread) => {
        const f = self.fds.get(fd); if (!f) return E.BADF; let total = 0;
        for (const [ptr, len] of self.iovs(iovs, count)) {
          let chunk;
          if (f.kind === 'stdin') { chunk = self.stdin(len); if (!chunk || !chunk.length) break; }
          else if (f.kind === 'file') { const data = self.files.get(f.path) || new Uint8Array(0); chunk = data.subarray(f.pos, f.pos + len); f.pos += chunk.length; if (!chunk.length) break; }
          else return E.BADF;
          self.bytes.set(chunk, ptr); total += chunk.length;
          if (chunk.length < len) break;
        }
        self.view.setUint32(nread, total, true); return E.SUCCESS;
      },
      fd_pread: () => E.NOSYS, fd_pwrite: () => E.NOSYS,
      fd_close: fd => { self.fds.delete(fd); return E.SUCCESS; },
      fd_seek: (fd, offset, whence, newPtr) => {
        const f = self.fds.get(fd); if (!f) return E.BADF; if (f.kind !== 'file') return E.SPIPE;
        const size = (self.files.get(f.path) || []).length; const off = Number(offset);
        f.pos = whence === 0 ? off : whence === 1 ? f.pos + off : size + off; self.view.setBigUint64(newPtr, BigInt(f.pos), true); return E.SUCCESS;
      },
      fd_tell: (fd, ptr) => { const f = self.fds.get(fd); if (!f) return E.BADF; self.view.setBigUint64(ptr, BigInt(f.pos || 0), true); return E.SUCCESS; },
      fd_fdstat_get: (fd, ptr) => {
        const f = self.fds.get(fd); if (!f) return E.BADF; const v = self.view;
        v.setUint8(ptr, f.kind === 'dir' ? 3 : f.kind === 'file' ? 4 : 2); v.setUint16(ptr + 2, 0, true);
        v.setBigUint64(ptr + 8, 0xFFFFFFFFn, true); v.setBigUint64(ptr + 16, 0xFFFFFFFFn, true); return E.SUCCESS;
      },
      fd_fdstat_set_flags: () => E.SUCCESS, fd_advise: () => E.SUCCESS, fd_allocate: () => E.SUCCESS, fd_datasync: () => E.SUCCESS, fd_sync: () => E.SUCCESS,
      fd_filestat_get: (fd, ptr) => { const f = self.fds.get(fd); if (!f) return E.BADF; self.filestat(ptr, f.kind === 'dir' ? 3 : f.kind === 'file' ? 4 : 2, f.kind === 'file' ? (self.files.get(f.path) || []).length : 0); return E.SUCCESS; },
      fd_filestat_set_size: (fd, size) => { const f = self.fds.get(fd); if (f?.kind !== 'file') return E.BADF; const old = self.files.get(f.path) || new Uint8Array(0); const next = new Uint8Array(Number(size)); next.set(old.subarray(0, Number(size))); self.putFile(f.path, next); return E.SUCCESS; },
      fd_filestat_set_times: () => E.SUCCESS,
      fd_prestat_get: (fd, ptr) => { const f = self.fds.get(fd); if (!f?.preopen) return E.BADF; self.view.setUint8(ptr, 0); self.view.setUint32(ptr + 4, new TextEncoder().encode(f.preopen).length, true); return E.SUCCESS; },
      fd_prestat_dir_name: (fd, ptr, len) => { const f = self.fds.get(fd); if (!f?.preopen) return E.BADF; self.bytes.set(new TextEncoder().encode(f.preopen).subarray(0, len), ptr); return E.SUCCESS; },
      fd_readdir: (fd, buf, len, cookie, usedPtr) => {
        const f = self.fds.get(fd); if (f?.kind !== 'dir') return E.BADF;
        const pre = f.path ? f.path + '/' : ''; const names = new Map();
        for (const k of self.files.keys()) if (k.startsWith(pre)) { const n = k.slice(pre.length).split('/'); names.set(n[0], n.length > 1 ? 3 : 4); }
        for (const d of self.dirs) if (d && d.startsWith(pre)) { const n = d.slice(pre.length).split('/')[0]; if (n) names.set(n, 3); }
        const entries = [['.', 3], ['..', 3], ...names]; let used = 0; const enc = new TextEncoder();
        for (let i = Number(cookie); i < entries.length; i++) {
          const name = enc.encode(entries[i][0]); const head = new DataView(new ArrayBuffer(24));
          head.setBigUint64(0, BigInt(i + 1), true); head.setBigUint64(8, BigInt(i + 1), true); head.setUint32(16, name.length, true); head.setUint8(20, entries[i][1]);
          const rec = new Uint8Array(24 + name.length); rec.set(new Uint8Array(head.buffer)); rec.set(name, 24);
          const take = Math.min(rec.length, len - used); self.bytes.set(rec.subarray(0, take), buf + used); used += take; if (used >= len) break;
        }
        self.view.setUint32(usedPtr, used, true); return E.SUCCESS;
      },
      fd_renumber: (from, to) => { const f = self.fds.get(from); if (!f) return E.BADF; self.fds.set(to, f); self.fds.delete(from); return E.SUCCESS; },
      path_open: (dirFd, dirflags, pathPtr, pathLen, oflags, rightsBase, rightsInh, fdflags, fdPtr) => {
        const path = self.resolve(dirFd, self.str(pathPtr, pathLen)); if (path === null) return E.BADF;
        const isDir = self.dirs.has(path) && !self.files.has(path);
        if (oflags & 2) { if (isDir) { self.fds.set(self.nextFd, { kind: 'dir', path }); self.view.setUint32(fdPtr, self.nextFd++, true); return E.SUCCESS; } if (!self.files.has(path)) return E.NOENT; return E.NOTDIR; }
        if (isDir) { self.fds.set(self.nextFd, { kind: 'dir', path }); self.view.setUint32(fdPtr, self.nextFd++, true); return E.SUCCESS; }
        const exists = self.files.has(path);
        if (!exists && !(oflags & 1)) return E.NOENT;
        if (exists && (oflags & 4)) return E.EXIST;
        const parent = path.includes('/') ? path.replace(/\/[^/]*$/, '') : '';
        if (!self.dirs.has(parent)) return E.NOENT;
        if (!exists || (oflags & 8)) self.putFile(path, new Uint8Array(0));
        self.fds.set(self.nextFd, { kind: 'file', path, pos: 0, append: Boolean(fdflags & 1) });
        self.view.setUint32(fdPtr, self.nextFd++, true); return E.SUCCESS;
      },
      path_filestat_get: (dirFd, flags, pathPtr, pathLen, ptr) => {
        const path = self.resolve(dirFd, self.str(pathPtr, pathLen)); if (path === null) return E.BADF;
        if (self.files.has(path)) { self.filestat(ptr, 4, self.files.get(path).length); return E.SUCCESS; }
        if (self.dirs.has(path)) { self.filestat(ptr, 3, 0); return E.SUCCESS; } return E.NOENT;
      },
      path_filestat_set_times: () => E.SUCCESS,
      path_create_directory: (dirFd, p, l) => { const path = self.resolve(dirFd, self.str(p, l)); if (self.dirs.has(path) || self.files.has(path)) return E.EXIST; self.dirs.add(path); return E.SUCCESS; },
      path_remove_directory: (dirFd, p, l) => { const path = self.resolve(dirFd, self.str(p, l)); if (!self.dirs.has(path)) return E.NOENT; if ([...self.files.keys()].some(k => k.startsWith(path + '/'))) return E.NOTEMPTY; self.dirs.delete(path); return E.SUCCESS; },
      path_unlink_file: (dirFd, p, l) => { const path = self.resolve(dirFd, self.str(p, l)); if (!self.files.delete(path)) return E.NOENT; self.changed.add(path); return E.SUCCESS; },
      path_rename: (fd1, p1, l1, fd2, p2, l2) => { const a = self.resolve(fd1, self.str(p1, l1)), b = self.resolve(fd2, self.str(p2, l2)); if (!self.files.has(a)) return E.NOENT; self.putFile(b, self.files.get(a)); self.files.delete(a); self.changed.add(a); return E.SUCCESS; },
      path_link: () => E.NOSYS, path_readlink: () => E.NOSYS, path_symlink: () => E.NOSYS,
      sock_accept: () => E.NOSYS, sock_recv: () => E.NOSYS, sock_send: () => E.NOSYS, sock_shutdown: () => E.NOSYS
    };
    return { wasi_snapshot_preview1: wasi };
  }

  run(module) {
    const imports = this.imports();
    // Fehlende Importe (z. B. von seltenen Bibliotheken) mit ENOSYS-Stubs belegen.
    for (const imp of WebAssembly.Module.imports(module)) {
      imports[imp.module] ||= {};
      if (imp.kind === 'function' && !imports[imp.module][imp.name]) imports[imp.module][imp.name] = () => E.NOSYS;
    }
    const instance = new WebAssembly.Instance(module, imports);
    this.memory = instance.exports.memory;
    try { instance.exports._start(); return 0; }
    catch (error) { if (error instanceof WasiExit) return error.code; throw error; }
  }

  changedFiles() {
    const out = {};
    for (const path of this.changed) {
      if (!this.files.has(path)) continue;
      const bytes = this.files.get(path);
      try { out[path] = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { out[path] = { base64: btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')) }; }
    }
    return out;
  }
}
