// Echtes SQLite 3 (sql.js/WebAssembly). Jede .db-Datei wird als Binärdatei in IndexedDB gespeichert.
import { idbGet, idbSet } from './store.js';

const SQLJS = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/';
let sqlPromise = null;
const SEED = `CREATE TABLE schueler (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, klasse TEXT, punkte INTEGER);
INSERT INTO schueler (name, klasse, punkte) VALUES ('Alex','8a',86),('Sam','8b',94),('Lina','8a',77),('Robin','9b',91);
CREATE TABLE projekte (id INTEGER PRIMARY KEY AUTOINCREMENT, titel TEXT, sprache TEXT, schueler_id INTEGER REFERENCES schueler(id));
INSERT INTO projekte (titel, sprache, schueler_id) VALUES ('Hallo Welt','Python',1),('Webseite','HTML',2),('Datenbank','SQL',4),('Taschenrechner','Java',2);`;

export function loadSQL() {
  if (!sqlPromise) {
    sqlPromise = new Promise((resolve, reject) => {
      const done = () => self.initSqlJs({ locateFile: f => SQLJS + f }).then(resolve, reject);
      if (self.initSqlJs) return done();
      const s = document.createElement('script'); s.src = SQLJS + 'sql-wasm.js'; s.onload = done; s.onerror = () => reject(Error('SQLite (sql.js) konnte nicht geladen werden.'));
      document.head.append(s);
    });
    sqlPromise.catch(() => { sqlPromise = null; });
  }
  return sqlPromise;
}

/** Eine persistente SQLite-Datenbank (Schlüssel z. B. "debian:/home/student/Projects/demo.db"). */
export class SQLiteDatabase {
  constructor(key, { seed = true } = {}) { this.key = 'sqlite:' + key; this.seed = seed; this.memory = key.startsWith('memory:'); this.db = null; this.headers = true; this.mode = 'box'; }
  async open() {
    if (this.db) return this;
    const SQL = await loadSQL();
    const bytes = this.memory ? null : await idbGet(this.key);
    this.db = bytes ? new SQL.Database(bytes) : new SQL.Database();
    if (!bytes && this.seed) { this.db.exec(SEED); await this.save(); }
    return this;
  }
  get size() { return this.db ? this.db.export().length : 0; }
  async save() { if (this.db && !this.memory) await idbSet(this.key, this.db.export()); }
  async reset() { this.db?.close(); this.db = null; const SQL = await loadSQL(); this.db = new SQL.Database(); if (this.seed) this.db.exec(SEED); await this.save(); }
  /** Führt beliebiges SQL aus, liefert alle Ergebnistabellen. */
  async exec(sql) {
    await this.open();
    const results = this.db.exec(sql);
    const changes = this.db.getRowsModified();
    if (/^\s*(insert|update|delete|create|drop|alter|replace|pragma|begin|commit|vacuum)/im.test(sql)) await this.save();
    return { results: results.map(r => ({ columns: r.columns, rows: r.values })), changes };
  }
  tables() { return this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.map(v => v[0]) || []; }
  schema(table) { const q = table ? `SELECT sql FROM sqlite_master WHERE name='${String(table).replace(/'/g, "''")}'` : "SELECT sql FROM sqlite_master WHERE sql NOT NULL AND name NOT LIKE 'sqlite_%'"; return (this.db.exec(q)[0]?.values || []).map(v => v[0] + ';').join('\n'); }
}

export function formatTable(columns, rows, mode = 'box') {
  const cells = rows.map(r => r.map(v => v === null ? 'NULL' : v instanceof Uint8Array ? `<BLOB ${v.length} B>` : String(v)));
  if (mode === 'list') return [columns.join('|'), ...cells.map(r => r.join('|'))].join('\n');
  if (mode === 'csv') return [columns.join(','), ...cells.map(r => r.map(c => /[,"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(','))].join('\n');
  const widths = columns.map((c, i) => Math.min(40, Math.max(String(c).length, ...cells.map(r => r[i].length))));
  const fit = (s, w, right) => { s = s.length > w ? s.slice(0, w - 1) + '…' : s; return right ? s.padStart(w) : s.padEnd(w); };
  const numeric = columns.map((_, i) => rows.length && rows.every(r => typeof r[i] === 'number' || r[i] === null));
  const line = (l, m, r) => l + widths.map(w => '─'.repeat(w + 2)).join(m) + r;
  const row = r => '│' + r.map((c, i) => ' ' + fit(c, widths[i], numeric[i]) + ' ').join('│') + '│';
  return [line('┌', '┬', '┐'), row(columns.map(String)), line('├', '┼', '┤'), ...cells.map(row), line('└', '┴', '┘')].join('\n');
}
