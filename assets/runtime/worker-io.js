// Gemeinsame Hilfen für alle Laufzeit-Worker.
// Ausgabe: post('out', ...). Eingabe: readLineSync() blockiert per synchronem XHR,
// den der DesktopSim-Service-Worker erst beantwortet, wenn das Terminal eine Zeile sendet.
const BASE = new URL('../../', import.meta.url);
let ioMode = 'buffer';
let channel = '';
let stdinBuffer = [];
let stdinEOF = false;

export function configureIO(options = {}) {
  ioMode = options.ioMode === 'sync' ? 'sync' : 'buffer';
  channel = options.channel || '';
  stdinBuffer = String(options.stdin ?? '').length ? String(options.stdin).split(/(?<=\n)/) : [];
  stdinEOF = false;
}

export function post(type, data = {}) { self.postMessage({ type, ...data }); }
export const writeOut = text => { if (text) post('out', { stream: 'stdout', text: String(text) }); };
export const writeErr = text => { if (text) post('out', { stream: 'stderr', text: String(text) }); };
export const status = text => post('status', { text });

/** Liefert die nächste Eingabezeile inklusive "\n" oder null bei Dateiende. */
export function readLineSync() {
  if (stdinBuffer.length) return stdinBuffer.shift();
  if (stdinEOF || ioMode !== 'sync') return null;
  post('stdin-request', { channel });
  for (let attempt = 0; attempt < 200; attempt++) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', new URL(`__ds_io__/read?ch=${encodeURIComponent(channel)}&n=${Date.now()}${attempt}`, BASE), false);
    try { xhr.send(); } catch { stdinEOF = true; return null; }
    if (xhr.status === 200) return xhr.responseText.endsWith('\n') ? xhr.responseText : xhr.responseText + '\n';
    if (xhr.status === 204) { stdinEOF = true; return null; }
    if (xhr.status !== 202) { stdinEOF = true; return null; }
  }
  stdinEOF = true;
  return null;
}

/** Byteweiser Zugriff für Laufzeiten, die stdin byteweise lesen (WASI, PHP). */
export function createByteReader() {
  let bytes = new Uint8Array(0), offset = 0, eof = false;
  const encoder = new TextEncoder();
  return {
    read(max) {
      if (offset >= bytes.length) {
        if (eof) return null;
        const line = readLineSync();
        if (line === null) { eof = true; return null; }
        bytes = encoder.encode(line); offset = 0;
      }
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + max));
      offset += chunk.length;
      return chunk;
    },
    byte() { const chunk = this.read(1); return chunk ? chunk[0] : null; }
  };
}

/** Flache Dateiliste {relPath: string|Uint8Array} vergleichen und Änderungen ermitteln. */
export function changedFiles(before, after) {
  const changes = {};
  for (const [path, content] of Object.entries(after)) {
    const old = before[path];
    if (old === undefined || (typeof content === 'string' ? content !== old : true)) changes[path] = content;
  }
  return changes;
}
