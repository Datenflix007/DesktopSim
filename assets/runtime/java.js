// Echtes Java: CheerpJ 4.2 (JVM als WebAssembly/JavaScript, Java 8) + javac aus dem OpenJDK (tools.jar).
// CheerpJ ist für private und schulische Nutzung kostenlos ("Built with CheerpJ").
//
// Jeder Programmstart lädt die Klassen mit einem eigenen ClassLoader (frische statische Variablen,
// neu übersetzte Klassen werden sofort verwendet). Mehrere Programme können gleichzeitig laufen
// (z. B. Socket-Server und Client). java.net.Socket/ServerSocket werden beim Übersetzen auf das
// virtuelle DesktopSim-Netz umgelenkt, Swing/AWT-Fenster erscheinen in einem eigenen Fenster.
const LOADER = 'https://cjrtnc.leaningtech.com/4.2/loader.js';
const TOOLS_JAR = 'https://raw.githubusercontent.com/leaningtech/javafiddle/0d847f83f11607623187340e4d12efb494f64e80/static/tools.jar';

const RUN_SRC = `package dsnet;
public final class Run {
  public static final InheritableThreadLocal<String> ID = new InheritableThreadLocal<String>();
  public static volatile String lastGui = null;
  public static String id() { String v = ID.get(); return v != null ? v : (lastGui != null ? lastGui : "0"); }
}
`;
const NET_SRC = `package dsnet;
import java.io.*;
import java.net.*;
public final class Net {
  static native String call(String run, String op, String a, int b, int c);
  static String ok(String r, String op) throws IOException {
    if (r == null) throw new SocketException("Netzwerkfehler");
    if (r.startsWith("OK:")) return r.substring(3);
    String[] p = r.split(":", 3);
    String kind = p.length > 1 ? p[1] : "", msg = p.length > 2 ? p[2] : r;
    if (kind.equals("ConnectException")) throw new ConnectException(msg);
    if (kind.equals("BindException")) throw new BindException(msg);
    if (kind.equals("UnknownHostException")) throw new UnknownHostException(msg);
    if (kind.equals("SocketTimeoutException")) throw new SocketTimeoutException(msg);
    throw new SocketException(msg);
  }
  static String req(String op, String a, int b, int c) throws IOException { return ok(call(Run.id(), op, a, b, c), op); }
  static InetAddress local() { try { return InetAddress.getByAddress("localhost", new byte[]{127, 0, 0, 1}); } catch (Exception e) { return null; } }
  static InetAddress any() { try { return InetAddress.getByAddress("0.0.0.0", new byte[]{0, 0, 0, 0}); } catch (Exception e) { return null; } }
}
`;
const SERVER_SRC = `package dsnet;
import java.io.*;
import java.net.*;
public class ServerSocket implements Closeable {
  private String id; private int port = -1; private int timeout = 0; private boolean closed = false;
  public ServerSocket() throws IOException { }
  public ServerSocket(int port) throws IOException { this(port, 50); }
  public ServerSocket(int port, int backlog) throws IOException { listen(port, backlog); }
  public ServerSocket(int port, int backlog, InetAddress bindAddr) throws IOException { listen(port, backlog); }
  private void listen(int p, int backlog) throws IOException { String r = Net.req("listen", "", p, backlog <= 0 ? 50 : backlog); int i = r.indexOf('|'); id = r.substring(0, i); port = Integer.parseInt(r.substring(i + 1)); }
  public void bind(SocketAddress endpoint) throws IOException { bind(endpoint, 50); }
  public void bind(SocketAddress endpoint, int backlog) throws IOException { listen(endpoint == null ? 0 : ((InetSocketAddress) endpoint).getPort(), backlog); }
  public Socket accept() throws IOException {
    if (closed) throw new SocketException("Socket is closed");
    if (id == null) throw new SocketException("Socket is not bound yet");
    String[] p = Net.req("accept", id, timeout, 0).split("\\\\|");
    return new Socket(p[0], Integer.parseInt(p[1]), Integer.parseInt(p[2]));
  }
  public void close() throws IOException { if (!closed && id != null) Net.call(Run.id(), "close", id, 0, 0); closed = true; }
  public boolean isClosed() { return closed; }
  public boolean isBound() { return id != null; }
  public int getLocalPort() { return port; }
  public InetAddress getInetAddress() { return Net.any(); }
  public SocketAddress getLocalSocketAddress() { return new InetSocketAddress(Net.any(), port); }
  public void setSoTimeout(int t) { timeout = t; }
  public int getSoTimeout() { return timeout; }
  public void setReuseAddress(boolean on) { }
  public boolean getReuseAddress() { return true; }
  public void setReceiveBufferSize(int size) { }
  public String toString() { return id == null ? "ServerSocket[unbound]" : "ServerSocket[addr=0.0.0.0/0.0.0.0,localport=" + port + "]"; }
}
`;
const SOCKET_SRC = `package dsnet;
import java.io.*;
import java.net.*;
public class Socket implements Closeable {
  private String id; private int port, localPort; private String host = "localhost"; private int timeout = 0;
  private boolean closed = false, inShut = false, outShut = false;
  private InputStream in; private OutputStream out;
  public Socket() { }
  public Socket(String host, int port) throws UnknownHostException, IOException { connect(host, port, 0); }
  public Socket(InetAddress address, int port) throws IOException { connect(address.getHostAddress(), port, 0); }
  public Socket(String host, int port, InetAddress localAddr, int localPort) throws IOException { connect(host, port, 0); }
  Socket(String id, int remotePort, int localPort) { this.id = id; this.port = remotePort; this.localPort = localPort; this.host = "127.0.0.1"; }
  public void connect(SocketAddress endpoint) throws IOException { connect(endpoint, 0); }
  public void connect(SocketAddress endpoint, int t) throws IOException { InetSocketAddress a = (InetSocketAddress) endpoint; connect(a.getHostString(), a.getPort(), t); }
  private void connect(String h, int p, int t) throws IOException {
    if (p < 0 || p > 65535) throw new IllegalArgumentException("port out of range:" + p);
    String r = Net.req("connect", h == null ? "localhost" : h, p, t);
    int i = r.indexOf('|'); id = r.substring(0, i); localPort = Integer.parseInt(r.substring(i + 1)); port = p; host = h == null ? "localhost" : h;
  }
  public InputStream getInputStream() throws IOException {
    if (closed) throw new SocketException("Socket is closed");
    if (id == null) throw new SocketException("Socket is not connected");
    if (in == null) in = new InputStream() {
      private byte[] buf = new byte[0]; private int pos = 0; private boolean eof = false;
      private boolean fill(int max) throws IOException {
        if (pos < buf.length) return true;
        if (eof || inShut) return false;
        String r = Net.req("recv", id, Math.max(1, max), timeout);
        if (r.length() == 0) { eof = true; return false; }
        buf = r.getBytes("ISO-8859-1"); pos = 0; return true;
      }
      public int read() throws IOException { return fill(8192) ? (buf[pos++] & 0xff) : -1; }
      public int read(byte[] b, int off, int len) throws IOException { if (len == 0) return 0; if (!fill(len)) return -1; int n = Math.min(len, buf.length - pos); System.arraycopy(buf, pos, b, off, n); pos += n; return n; }
      public int available() { return buf.length - pos; }
      public void close() throws IOException { Socket.this.close(); }
    };
    return in;
  }
  public OutputStream getOutputStream() throws IOException {
    if (closed) throw new SocketException("Socket is closed");
    if (id == null) throw new SocketException("Socket is not connected");
    if (out == null) out = new OutputStream() {
      public void write(int b) throws IOException { write(new byte[]{(byte) b}, 0, 1); }
      public void write(byte[] b, int off, int len) throws IOException { if (outShut) throw new SocketException("Socket output is shutdown"); if (len > 0) Net.req("send", id + "\\u0000" + new String(b, off, len, "ISO-8859-1"), 0, 0); }
      public void close() throws IOException { Socket.this.close(); }
    };
    return out;
  }
  public void close() throws IOException { if (!closed && id != null) Net.call(Run.id(), "close", id, 0, 0); closed = true; }
  public void shutdownInput() { inShut = true; }
  public void shutdownOutput() throws IOException { if (id != null) Net.call(Run.id(), "shutdown", id, 0, 0); outShut = true; }
  public boolean isConnected() { return id != null; }
  public boolean isBound() { return id != null; }
  public boolean isClosed() { return closed; }
  public boolean isInputShutdown() { return inShut; }
  public boolean isOutputShutdown() { return outShut; }
  public int getPort() { return port; }
  public int getLocalPort() { return localPort; }
  public InetAddress getInetAddress() { return Net.local(); }
  public InetAddress getLocalAddress() { return Net.local(); }
  public SocketAddress getRemoteSocketAddress() { return new InetSocketAddress(Net.local(), port); }
  public SocketAddress getLocalSocketAddress() { return new InetSocketAddress(Net.local(), localPort); }
  public void setSoTimeout(int t) { timeout = t; }
  public int getSoTimeout() { return timeout; }
  public void setTcpNoDelay(boolean on) { }
  public boolean getTcpNoDelay() { return true; }
  public void setKeepAlive(boolean on) { }
  public void setReuseAddress(boolean on) { }
  public void setSoLinger(boolean on, int linger) { }
  public void setReceiveBufferSize(int size) { }
  public void setSendBufferSize(int size) { }
  public String toString() { return "Socket[addr=" + host + "/127.0.0.1,port=" + port + ",localport=" + localPort + "]"; }
}
`;
const LAUNCHER = `import java.io.*;
import java.lang.reflect.*;
import java.util.*;
public class DSLauncher {
  static native String readLine(String run);
  static native void write(String run, String text, int stream);
  static native void done(String run, int code);
  static final class ExitTrap extends SecurityException { final int code; ExitTrap(int c) { super("System.exit(" + c + ")"); code = c; } }
  static final Map<String, Integer> exits = Collections.synchronizedMap(new HashMap<String, Integer>());
  static final class Out extends OutputStream {
    private final ThreadLocal<ByteArrayOutputStream> bufs = new ThreadLocal<ByteArrayOutputStream>() { protected ByteArrayOutputStream initialValue() { return new ByteArrayOutputStream(); } };
    private final int stream;
    Out(int stream) { this.stream = stream; }
    public void write(int b) { ByteArrayOutputStream buf = bufs.get(); buf.write(b); if (b == 10 || buf.size() > 2048) flush(); }
    public void write(byte[] b, int off, int len) { ByteArrayOutputStream buf = bufs.get(); buf.write(b, off, len); for (int i = off; i < off + len; i++) if (b[i] == 10) { flush(); return; } if (buf.size() > 2048) flush(); }
    public void flush() { ByteArrayOutputStream buf = bufs.get(); if (buf.size() == 0) return; String s; try { s = buf.toString("UTF-8"); } catch (UnsupportedEncodingException e) { s = buf.toString(); } buf.reset(); DSLauncher.write(dsnet.Run.id(), s, stream); }
  }
  static final class In extends InputStream {
    private final ThreadLocal<byte[]> line = new ThreadLocal<byte[]>(); private final ThreadLocal<int[]> pos = new ThreadLocal<int[]>() { protected int[] initialValue() { return new int[]{0, 0}; } };
    private boolean fill() { byte[] l = line.get(); int[] p = pos.get(); if (l != null && p[0] < l.length) return true; if (p[1] == 1) return false; System.out.flush(); System.err.flush(); String s = readLine(dsnet.Run.id()); if (s == null) { p[1] = 1; return false; } try { l = s.getBytes("UTF-8"); } catch (Exception e) { l = s.getBytes(); } line.set(l); p[0] = 0; return l.length > 0 || fill(); }
    public int read() { if (!fill()) return -1; int[] p = pos.get(); return line.get()[p[0]++] & 0xff; }
    public int read(byte[] b, int off, int len) { if (len == 0) return 0; if (!fill()) return -1; byte[] l = line.get(); int[] p = pos.get(); int n = Math.min(len, l.length - p[0]); System.arraycopy(l, p[0], b, off, n); p[0] += n; return n; }
    public int available() { byte[] l = line.get(); return l == null ? 0 : l.length - pos.get()[0]; }
  }
  static final class RunLoader extends ClassLoader {
    RunLoader(ClassLoader parent) { super(parent); }
    protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
      synchronized (getClassLoadingLock(name)) {
        Class<?> c = findLoadedClass(name);
        if (c == null && !name.startsWith("java.") && !name.startsWith("javax.") && !name.startsWith("sun.") && !name.startsWith("dsnet.") && !name.equals("DSLauncher") && !name.startsWith("DSLauncher$")) {
          File f = new File("/files/" + name.replace('.', '/') + ".class");
          if (f.exists()) {
            try { byte[] data = readAll(f); c = defineClass(name, data, 0, data.length); }
            catch (IOException e) { throw new ClassNotFoundException(name, e); }
          }
        }
        if (c == null) c = super.loadClass(name, false);
        if (resolve) resolveClass(c);
        return c;
      }
    }
    public java.net.URL getResource(String name) { File f = new File("/files/" + name); if (f.exists()) { try { return f.toURI().toURL(); } catch (Exception e) { } } return super.getResource(name); }
    public InputStream getResourceAsStream(String name) { File f = new File("/files/" + name); if (f.exists()) { try { return new FileInputStream(f); } catch (Exception e) { } } return super.getResourceAsStream(name); }
    static byte[] readAll(File f) throws IOException { InputStream in = new FileInputStream(f); try { ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n); return o.toByteArray(); } finally { in.close(); } }
  }
  static volatile boolean installed = false;
  static synchronized void install() {
    if (installed) return; installed = true;
    try { System.setOut(new PrintStream(new Out(1), true, "UTF-8")); System.setErr(new PrintStream(new Out(2), true, "UTF-8")); } catch (UnsupportedEncodingException e) { }
    System.setIn(new In());
    try {
      System.setSecurityManager(new SecurityManager() {
        public void checkPermission(java.security.Permission p) { }
        public void checkPermission(java.security.Permission p, Object ctx) { }
        public void checkExit(int status) {
          for (StackTraceElement e : new Throwable().getStackTrace()) if (e.getClassName().equals("java.lang.Runtime") && e.getMethodName().equals("exit")) throw new ExitTrap(status);
        }
      });
    } catch (Throwable t) { }
    Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
      public void uncaughtException(Thread t, Throwable e) {
        Throwable root = e; while (root.getCause() != null && !(root instanceof ExitTrap)) root = root.getCause();
        if (root instanceof ExitTrap) { exits.put(dsnet.Run.id(), ((ExitTrap) root).code); return; }
        System.err.print("Exception in thread \\"" + t.getName() + "\\" "); e.printStackTrace();
      }
    });
  }
  static boolean guiOpen() {
    try {
      Class<?> frame = Class.forName("java.awt.Window");
      Object[] ws = (Object[]) frame.getMethod("getWindows").invoke(null);
      for (Object w : ws) if ((Boolean) frame.getMethod("isDisplayable").invoke(w) && (Boolean) frame.getMethod("isVisible").invoke(w)) return true;
    } catch (Throwable t) { }
    return false;
  }
  public static void main(String[] args) throws Throwable {
    install();
    final String run = args[0];
    final String cls = args[1];
    final boolean gui = "1".equals(args[2]);
    final String[] rest = Arrays.copyOfRange(args, 3, args.length);
    final int[] code = {0};
    final ThreadGroup group = new ThreadGroup("run-" + run);
    if (gui) dsnet.Run.lastGui = run;
    Thread main = new Thread(group, new Runnable() { public void run() {
      dsnet.Run.ID.set(run);
      try {
        RunLoader loader = new RunLoader(DSLauncher.class.getClassLoader());
        Thread.currentThread().setContextClassLoader(loader);
        Method m = Class.forName(cls, true, loader).getMethod("main", String[].class);
        if (!Modifier.isStatic(m.getModifiers())) throw new NoSuchMethodException();
        m.invoke(null, (Object) rest);
      } catch (InvocationTargetException e) {
        Throwable cause = e.getCause();
        if (cause instanceof ExitTrap) { code[0] = ((ExitTrap) cause).code; exits.put(run, code[0]); }
        else { System.err.print("Exception in thread \\"main\\" "); cause.printStackTrace(); code[0] = 1; }
      } catch (NoSuchMethodException e) {
        System.err.println("Fehler: In der Klasse " + cls + " wurde keine main-Methode gefunden. Definieren Sie die main-Methode als:\\n   public static void main(String[] args)"); code[0] = 1;
      } catch (ClassNotFoundException e) {
        System.err.println("Fehler: Hauptklasse " + cls + " konnte nicht gefunden oder geladen werden"); code[0] = 1;
      } catch (Throwable e) { System.err.print("Exception in thread \\"main\\" "); e.printStackTrace(); code[0] = 1; }
      System.out.flush(); System.err.flush();
    } }, "main");
    main.start();
    main.join();
    // Auf weitere Nicht-Daemon-Threads des Programms (z. B. Server-Threads) und offene Fenster warten.
    for (;;) {
      if (exits.containsKey(run)) break;
      Thread[] list = new Thread[group.activeCount() + 8]; int n = group.enumerate(list, true); boolean alive = false;
      for (int i = 0; i < n; i++) if (list[i] != null && list[i].isAlive() && !list[i].isDaemon()) alive = true;
      if (!alive && !(gui && guiOpen())) break;
      Thread.sleep(150);
    }
    Integer exit = exits.remove(run);
    if (gui && run.equals(dsnet.Run.lastGui)) dsnet.Run.lastGui = null;
    System.out.flush(); System.err.flush();
    done(run, exit != null ? exit : code[0]);
  }
}
`;

let initPromise = null, compileQueue = Promise.resolve(), runSerial = 0;
const runs = new Map();   // runId -> {io, resolve}
let display = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (self.cheerpjInit) return resolve();
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(Error('CheerpJ konnte nicht geladen werden (Netzwerk).')); document.head.append(s);
  });
}
function consoleElement() {
  let el = document.getElementById('console');
  if (!el) { el = document.createElement('pre'); el.id = 'console'; el.setAttribute('aria-hidden', 'true'); el.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;overflow:hidden'; document.body.append(el); }
  return el;
}
const ioOf = run => runs.get(String(run))?.io;

async function netCall(run, op, a, b, c) {
  const io = ioOf(run);
  if (!io?.call) return 'ERR:SocketException:Netzwerk nicht verfügbar';
  const win = Boolean(io.windows);
  const fail = (r, port) => {
    const e = r.error;
    if (e === 'ECONNREFUSED') return `ERR:ConnectException:${win ? 'Connection refused: connect' : 'Connection refused (Connection refused)'}`;
    if (e === 'EADDRINUSE') return `ERR:BindException:${win ? 'Address already in use: JVM_Bind' : 'Address already in use (Bind failed)'}`;
    if (e === 'EGAI') return `ERR:UnknownHostException:${a}`;
    if (e === 'ETIMEDOUT') return op === 'connect' ? 'ERR:SocketTimeoutException:connect timed out' : op === 'accept' ? 'ERR:SocketTimeoutException:Accept timed out' : 'ERR:SocketTimeoutException:Read timed out';
    if (e === 'EPIPE') return `ERR:SocketException:${win ? 'Software caused connection abort: socket write error' : 'Broken pipe (Write failed)'}`;
    if (e === 'EHOSTUNREACH') return 'ERR:NoRouteToHostException:No route to host';
    if (e === 'EBADF') return 'ERR:SocketException:Socket closed';
    return `ERR:SocketException:${r.message || e}`;
  };
  const t = n => n > 0 ? n : -1;
  if (op === 'listen') { const bind = await io.call('net.bind', { host: '', port: b }); if (bind.error) return fail(bind); const r = await io.call('net.listen', { host: '', port: bind.port, backlog: c }); return r.error ? fail(r) : `OK:${r.id}|${bind.port}`; }
  if (op === 'accept') { const r = await io.call('net.accept', { id: a, timeout: t(b) }); return r.error ? fail(r) : `OK:${r.conn}|${r.remote[1]}|${r.local[1]}`; }
  if (op === 'connect') { const r = await io.call('net.connect', { host: a, port: b, timeout: t(c) }); return r.error ? fail(r) : `OK:${r.conn}|${r.local[1]}`; }
  if (op === 'send') { const i = a.indexOf('\u0000'); const r = await io.call('net.send', { conn: a.slice(0, i), data: a.slice(i + 1) }); return r.error ? fail(r) : 'OK:'; }
  if (op === 'recv') { const r = await io.call('net.recv', { conn: a, max: b, timeout: t(c) }); return r.error ? fail(r) : 'OK:' + r.data; }
  if (op === 'close') { await io.call('net.close', { id: a }); return 'OK:'; }
  if (op === 'shutdown') { await io.call('net.shutdown', { conn: a }); return 'OK:'; }
  return 'ERR:SocketException:unbekannt';
}

async function init(status) {
  if (!initPromise) {
    initPromise = (async () => {
      status('Java wird geladen (CheerpJ-JVM, einmalig) …');
      consoleElement();
      await loadScript(LOADER);
      await self.cheerpjInit({
        status: 'none', version: 8,
        natives: {
          async Java_DSLauncher_readLine(lib, run) { const io = ioOf(run); const line = io ? await io.readLine() : null; return line === null ? null : line.endsWith('\n') ? line : line + '\n'; },
          Java_DSLauncher_write(lib, run, text, stream) { ioOf(run)?.write(String(text), stream === 2 ? 'stderr' : 'stdout'); },
          Java_DSLauncher_done(lib, run, code) { const r = runs.get(String(run)); if (r) { runs.delete(String(run)); r.resolve({ code }); } },
          async Java_dsnet_Net_call(lib, run, op, a, b, c) { try { return await netCall(run, op, a, b, c); } catch (e) { return 'ERR:SocketException:' + (e?.message || e); } }
        }
      });
      // Display für AWT/Swing; wird für GUI-Programme in ein DesktopSim-Fenster verschoben.
      const holder = document.createElement('div'); holder.className = 'java-display'; holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:560px';
      document.body.append(holder);
      self.cheerpjCreateDisplay(-1, -1, holder);
      display = holder;
      status('Lade javac (OpenJDK 8 tools.jar, einmalig ca. 18 MB) …');
      const response = await fetch(TOOLS_JAR);
      if (!response.ok) throw Error('tools.jar konnte nicht geladen werden (HTTP ' + response.status + ')');
      self.cheerpOSAddStringFile('/str/tools.jar', new Uint8Array(await response.arrayBuffer()));
      self.cheerpOSAddStringFile('/str/DSLauncher.java', LAUNCHER);
      self.cheerpOSAddStringFile('/str/Run.java', RUN_SRC);
      self.cheerpOSAddStringFile('/str/Net.java', NET_SRC);
      self.cheerpOSAddStringFile('/str/Socket.java', SOCKET_SRC);
      self.cheerpOSAddStringFile('/str/ServerSocket.java', SERVER_SRC);
      status('Bereite Java-Laufzeit vor …');
      const con = consoleElement(); con.textContent = '';
      const code = await self.cheerpjRunMain('com.sun.tools.javac.Main', '/str/tools.jar', '-encoding', 'UTF-8', '-nowarn', '-d', '/files/', '/str/Run.java', '/str/Net.java', '/str/Socket.java', '/str/ServerSocket.java', '/str/DSLauncher.java');
      if (code !== 0) throw Error('Java-Starter konnte nicht übersetzt werden: ' + con.textContent);
      status('');
    })();
    initPromise.catch(() => { initPromise = null; });
  }
  return initPromise;
}

const serialCompile = task => { const next = compileQueue.then(task, task); compileQueue = next.catch(() => {}); return next; };

/** java.net.Socket/ServerSocket auf das DesktopSim-Netz umlenken (Zeilennummern bleiben gleich). */
export function rewriteNet(src) {
  if (!/java\.net/.test(src)) return src;
  return src
    .replace(/^(\s*)import\s+java\.net\.(ServerSocket|Socket)\s*;/gm, '$1import dsnet.$2;')
    .replace(/^(\s*)import\s+java\.net\.\*\s*;/gm, '$1import java.net.*; import dsnet.Socket; import dsnet.ServerSocket;')
    .replace(/\bjava\.net\.(ServerSocket|Socket)\b(?!\w)/g, 'dsnet.$1');
}
export const usesGui = src => /\b(javax\.swing|java\.awt)\b|\bJFrame\b|\bJOptionPane\b/.test(src);

/** Kompiliert alle übergebenen .java-Dateien. Gibt {code, classes:[...]} zurück. */
export function compileJava({ files, io: handler }) {
  return serialCompile(async () => {
    await init(handler.status);
    const sources = [];
    let net = false;
    for (const [path, content] of Object.entries(files)) {
      if (!/\.java$/i.test(path)) continue;
      const target = `/str/${path.split('/').pop()}`;
      if (sources.includes(target)) continue;
      const rewritten = rewriteNet(content);
      if (rewritten !== content) net = true;
      self.cheerpOSAddStringFile(target, rewritten); sources.push(target);
    }
    if (!sources.length) { handler.write('javac: Fehler: keine Quelldateien\n', 'stderr'); return { code: 2 }; }
    const con = consoleElement(); con.textContent = '';
    handler.status('javac kompiliert …');
    const code = await self.cheerpjRunMain('com.sun.tools.javac.Main', '/str/tools.jar', '-encoding', 'UTF-8', '-nowarn', '-d', '/files/', '-cp', '/files/', ...sources);
    handler.status('');
    const text = con.textContent.replace(/\/str\//g, '').replace(/dsnet\.(ServerSocket|Socket)/g, 'java.net.$1');
    if (text.trim()) handler.write(text.endsWith('\n') ? text : text + '\n', code === 0 ? 'stdout' : 'stderr');
    const classes = [...Object.values(files).join('\n').matchAll(/\bclass\s+([A-Za-z_]\w*)/g)].map(m => m[1]);
    return { code, classes, net };
  });
}

/** GUI-Fenster für Swing/AWT bereitstellen (falls das Programm Fenster öffnet). */
function attachDisplay(host) {
  if (!display || !host) return () => {};
  const previous = display.parentElement;
  display.style.cssText = 'position:relative;width:100%;height:100%';
  host.append(display);
  return () => { display.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:560px'; document.body.append(display); };
}

/** Startet eine kompilierte Klasse über den Launcher (interaktives System.in/out). */
export async function runJava({ className, args = [], io: handler, gui = false, guiHost = null }) {
  await compileQueue;
  await init(handler.status);
  const run = String(++runSerial);
  const con = consoleElement();
  const detach = gui ? attachDisplay(guiHost?.()) : () => {};
  try {
    return await new Promise(resolve => {
      runs.set(run, { io: handler, resolve });
      self.cheerpjRunMain('DSLauncher', '/files/', run, className, gui ? '1' : '0', ...args).then(code => {
        // Falls die JVM ohne Rückmeldung endet (sollte nicht passieren):
        setTimeout(() => { const r = runs.get(run); if (r) { runs.delete(run); const rest = con.textContent; if (rest.trim()) handler.write(rest, 'stdout'); r.resolve({ code: code ?? 0 }); } }, 400);
      }, error => { const r = runs.get(run); if (r) { runs.delete(run); handler.write(String(error?.message || error) + '\n', 'stderr'); r.resolve({ code: 1 }); } });
    });
  } finally { detach(); }
}

export const javaLoaded = () => Boolean(initPromise);
