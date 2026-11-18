// Echtes Java: CheerpJ 4.2 (JVM als WebAssembly/JavaScript, Java 8) + javac aus dem OpenJDK (tools.jar).
// CheerpJ ist für private und schulische Nutzung kostenlos ("Built with CheerpJ").
const LOADER = 'https://cjrtnc.leaningtech.com/4.2/loader.js';
const TOOLS_JAR = 'https://raw.githubusercontent.com/leaningtech/javafiddle/0d847f83f11607623187340e4d12efb494f64e80/static/tools.jar';
const LAUNCHER = `import java.io.*;
import java.lang.reflect.*;
import java.util.Arrays;
public class DSLauncher {
  static native String readLine();
  static native void write(String text, int stream);
  static final class Out extends OutputStream {
    private final ByteArrayOutputStream buf = new ByteArrayOutputStream(); private final int stream;
    Out(int stream) { this.stream = stream; }
    public synchronized void write(int b) { buf.write(b); if (b == 10 || buf.size() > 2048) flush(); }
    public synchronized void write(byte[] b, int off, int len) { buf.write(b, off, len); for (int i = off; i < off + len; i++) if (b[i] == 10) { flush(); return; } if (buf.size() > 2048) flush(); }
    public synchronized void flush() { if (buf.size() == 0) return; try { DSLauncher.write(buf.toString("UTF-8"), stream); } catch (UnsupportedEncodingException e) { DSLauncher.write(buf.toString(), stream); } buf.reset(); }
  }
  static PrintStream out, err;
  public static void main(String[] args) throws Throwable {
    out = new PrintStream(new Out(1), true, "UTF-8"); err = new PrintStream(new Out(2), true, "UTF-8");
    System.setOut(out); System.setErr(err);
    System.setIn(new InputStream() {
      byte[] line = new byte[0]; int pos = 0; boolean eof = false;
      private boolean fill() { if (pos < line.length) return true; if (eof) return false; out.flush(); err.flush(); String l = readLine(); if (l == null) { eof = true; return false; } try { line = l.getBytes("UTF-8"); } catch (Exception e) { line = l.getBytes(); } pos = 0; return line.length > 0 || fill(); }
      public int read() { return fill() ? (line[pos++] & 0xff) : -1; }
      public int read(byte[] b, int off, int len) { if (len == 0) return 0; if (!fill()) return -1; int n = Math.min(len, line.length - pos); System.arraycopy(line, pos, b, off, n); pos += n; return n; }
      public int available() { return line.length - pos; }
    });
    int code = 0;
    try {
      Method m = Class.forName(args[0]).getMethod("main", String[].class);
      m.invoke(null, (Object) Arrays.copyOfRange(args, 1, args.length));
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      err.print("Exception in thread \\"main\\" "); cause.printStackTrace(err); code = 1;
    } catch (NoSuchMethodException e) {
      err.println("Fehler: In der Klasse " + args[0] + " wurde keine main-Methode gefunden. Definieren Sie die main-Methode als:\\n   public static void main(String[] args)"); code = 1;
    } catch (ClassNotFoundException e) {
      err.println("Fehler: Hauptklasse " + args[0] + " konnte nicht gefunden oder geladen werden"); code = 1;
    }
    out.flush(); err.flush();
    System.exit(code);
  }
}
`;

let initPromise = null, io = null, queue = Promise.resolve();

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

async function init(status) {
  if (!initPromise) {
    initPromise = (async () => {
      status('Java wird geladen (CheerpJ-JVM, einmalig) …');
      consoleElement();
      await loadScript(LOADER);
      await self.cheerpjInit({
        status: 'none', version: 8,
        natives: {
          async Java_DSLauncher_readLine() { const line = io ? await io.readLine() : null; return line === null ? null : line.endsWith('\n') ? line : line + '\n'; },
          Java_DSLauncher_write(lib, text, stream) { io?.write(String(text), stream === 2 ? 'stderr' : 'stdout'); }
        }
      });
      // Unsichtbares Display, damit AWT/Swing-Aufrufe nicht ins Leere laufen.
      const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-9999px;width:320px;height:200px'; document.body.append(holder);
      self.cheerpjCreateDisplay(320, 200, holder);
      status('Lade javac (OpenJDK 8 tools.jar, einmalig ca. 18 MB) …');
      const response = await fetch(TOOLS_JAR);
      if (!response.ok) throw Error('tools.jar konnte nicht geladen werden (HTTP ' + response.status + ')');
      self.cheerpOSAddStringFile('/str/tools.jar', new Uint8Array(await response.arrayBuffer()));
      self.cheerpOSAddStringFile('/str/DSLauncher.java', LAUNCHER);
      status('');
    })();
    initPromise.catch(() => { initPromise = null; });
  }
  return initPromise;
}

const serial = task => { const next = queue.then(task, task); queue = next.catch(() => {}); return next; };

/** Kompiliert alle übergebenen .java-Dateien. Gibt {code, classes:[...]} zurück. */
export function compileJava({ files, io: handler }) {
  return serial(async () => {
    await init(handler.status);
    const sources = [];
    for (const [path, content] of Object.entries(files)) {
      if (!/\.java$/i.test(path)) continue;
      const target = `/str/${path.split('/').pop()}`;
      if (sources.includes(target)) continue;
      self.cheerpOSAddStringFile(target, content); sources.push(target);
    }
    if (!sources.length) { handler.write('javac: Fehler: keine Quelldateien\n', 'stderr'); return { code: 2 }; }
    const con = consoleElement(); con.textContent = '';
    handler.status('javac kompiliert …');
    const code = await self.cheerpjRunMain('com.sun.tools.javac.Main', '/str/tools.jar', '-encoding', 'UTF-8', '-d', '/files/', '-cp', '/files/', '/str/DSLauncher.java', ...sources);
    handler.status('');
    const text = con.textContent.replace(/\/str\//g, '');
    if (text.trim()) handler.write(text.endsWith('\n') ? text : text + '\n', code === 0 ? 'stdout' : 'stderr');
    const classes = [...Object.values(files).join('\n').matchAll(/\bclass\s+([A-Za-z_]\w*)/g)].map(m => m[1]);
    return { code, classes };
  });
}

/** Startet eine kompilierte Klasse über den Launcher (interaktives System.in/out). */
export function runJava({ className, args = [], io: handler }) {
  return serial(async () => {
    await init(handler.status);
    io = handler;
    const con = consoleElement(); con.textContent = '';
    try {
      const code = await self.cheerpjRunMain('DSLauncher', '/files/', className, ...args);
      const rest = con.textContent; if (rest.trim()) handler.write(rest, 'stdout');
      return { code };
    } finally { io = null; }
  });
}

export const javaLoaded = () => Boolean(initPromise);
