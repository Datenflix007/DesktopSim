// Farbige, eigenständig gezeichnete Symbole (keine Marken-Assets). viewBox 48×48.
let gid = 0;
const g = (a, b, dir = 'v') => { const id = 'dsg' + (++gid); return [`url(#${id})`, `<linearGradient id="${id}" x1="0" y1="0" x2="${dir === 'h' ? 1 : 0}" y2="${dir === 'h' ? 0 : 1}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`]; };
const wrap = (body, defs = '') => `<svg viewBox="0 0 48 48" aria-hidden="true" class="app-svg">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;

const FOLDER_COLORS = { windows: ['#ffd76a', '#f0b429', '#e09b16'], gnome: ['#62a0ea', '#3584e4', '#1c71d8'], kde: ['#5bb3f0', '#3daee9', '#1d99f3'], mac: ['#8fd0ff', '#4fb2f6', '#1c8fe0'], cde: ['#e8c87a', '#c9a24c', '#9c7a2e'] };

export function folderIcon(family = 'windows', badge = '') {
  const [a, b, c] = FOLDER_COLORS[family] || FOLDER_COLORS.windows;
  const [back, d1] = g(c, b), [front, d2] = g(a, b);
  return wrap(`<path d="M4 12a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" fill="${back}"/><path d="M4 18a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" fill="${front}"/>${badge}`, d1 + d2);
}

export function fileIcon(name = '', family = 'windows') {
  const ext = String(name).split('.').pop().toLowerCase();
  const map = { py: ['#3776ab', 'PY'], js: ['#d6b400', 'JS'], mjs: ['#d6b400', 'JS'], java: ['#d9532c', 'JAVA'], class: ['#8a4b2a', 'CLS'], c: ['#5c6bc0', 'C'], h: ['#5c6bc0', 'H'], cpp: ['#00599c', 'C++'], cs: ['#68217a', 'C#'], php: ['#777bb4', 'PHP'], html: ['#e44d26', 'HTML'], htm: ['#e44d26', 'HTML'], css: ['#264de4', 'CSS'], sql: ['#c97a00', 'SQL'], db: ['#7a5c00', 'DB'], json: ['#5a6b7d', '{ }'], md: ['#455a64', 'MD'], sh: ['#2e7d32', 'SH'], bat: ['#555', 'BAT'], ps1: ['#2671be', 'PS'], txt: ['#8a96a8', ''], csv: ['#1d7a46', 'CSV'], png: ['#7b3fa0', 'IMG'], jpg: ['#7b3fa0', 'IMG'], exe: ['#3a5a8c', 'EXE'], out: ['#2e7d32', 'BIN'], wasm: ['#654ff0', 'WASM'] };
  const [color, label] = map[ext] || (name && !name.includes('.') ? ['#2e7d32', ''] : ['#8a96a8', '']);
  const [paper, d] = g('#ffffff', '#e8edf4');
  const lines = label ? '' : '<path d="M15 22h18M15 27h18M15 32h12" stroke="#9aa6b6" stroke-width="2" stroke-linecap="round"/>';
  return wrap(`<path d="M10 4h20l10 10v28a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="${paper}" stroke="#b9c3d1"/><path d="M30 4v8a2 2 0 0 0 2 2h8" fill="#dfe5ee" stroke="#b9c3d1"/>${lines}${label ? `<rect x="6" y="26" width="${Math.max(18, label.length * 7 + 8)}" height="13" rx="2.5" fill="${color}"/><text x="${6 + Math.max(18, label.length * 7 + 8) / 2}" y="35.6" font-family="Arial,sans-serif" font-size="8.5" font-weight="700" fill="#fff" text-anchor="middle">${label}</text>` : ''}`, d);
}

const APPS = {
  terminal: () => { const [bg, d] = g('#3b4252', '#161a22'); return wrap(`<rect x="4" y="7" width="40" height="34" rx="5" fill="${bg}"/><rect x="4" y="7" width="40" height="7" rx="5" fill="#ffffff22"/><path d="m11 21 7 5-7 5" fill="none" stroke="#7ee787" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 33h12" stroke="#e6edf3" stroke-width="3" stroke-linecap="round"/>`, d); },
  editor: () => { const [bg, d] = g('#ffffff', '#e5ebf3'); return wrap(`<rect x="9" y="4" width="30" height="40" rx="3" fill="${bg}" stroke="#aab6c6"/><rect x="9" y="4" width="30" height="7" rx="3" fill="#4a8fe0"/><path d="M14 18h20M14 23h20M14 28h20M14 33h13" stroke="#8b98aa" stroke-width="2" stroke-linecap="round"/><path d="m33 30 6-6 4 4-6 6-5 1Z" fill="#f2b23b" stroke="#9a6a10"/>`, d); },
  ide: () => { const [bg, d] = g('#2f8fe6', '#145fb8'); return wrap(`<path d="M34 4 15 21 7 15l-3 2v14l3 2 8-6 19 17 10-5V9Z" fill="${bg}"/><path d="M34 15v18l-12-9Z" fill="#0d3f7a"/><path d="M7 19v10l5-5Z" fill="#0d3f7a"/>`, d); },
  browser: () => { const [bg, d] = g('#4fc3f7', '#1565c0'); return wrap(`<circle cx="24" cy="24" r="19" fill="${bg}"/><path d="M5 24h38M24 5c-6 6-6 32 0 38M24 5c6 6 6 32 0 38M9 14h30M9 34h30" fill="none" stroke="#e3f4ff" stroke-width="2"/>`, d); },
  settings: () => { const [bg, d] = g('#9aa7b8', '#5b6779'); return wrap(`<path d="M21 4h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2Z" fill="${bg}"/><circle cx="24" cy="24" r="7" fill="#eef2f7"/>`, d); },
  taskmgr: () => { const [bg, d] = g('#ffffff', '#e6ecf3'); return wrap(`<rect x="5" y="6" width="38" height="36" rx="4" fill="${bg}" stroke="#a9b5c5"/><path d="M9 33l7-9 6 5 7-12 6 7 5-4" fill="none" stroke="#18a058" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M9 37h30" stroke="#a9b5c5" stroke-width="2"/>`, d); },
  calc: () => { const [bg, d] = g('#53606f', '#2b333d'); return wrap(`<rect x="9" y="4" width="30" height="40" rx="5" fill="${bg}"/><rect x="13" y="8" width="22" height="9" rx="2" fill="#cfe8d6"/>${[0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${13 + c * 8}" y="${21 + r * 7}" width="6" height="5" rx="1.5" fill="${c === 2 ? '#f39c34' : '#9aa6b4'}"/>`).join('')).join('')}`, d); },
  trash: () => { const [bg, d] = g('#e9eef4', '#b8c4d2'); return wrap(`<path d="M12 13h24l-2.5 29a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2Z" fill="${bg}" stroke="#8796a8"/><rect x="9" y="8" width="30" height="5" rx="2" fill="#c9d3df" stroke="#8796a8"/><path d="M19 18v20M24 18v20M29 18v20" stroke="#8796a8" stroke-width="1.6"/>`, d); },
  computer: () => { const [bg, d] = g('#5fb7ff', '#1f6fc8'); return wrap(`<rect x="4" y="7" width="40" height="27" rx="3" fill="#2b3442"/><rect x="7" y="10" width="34" height="21" fill="${bg}"/><path d="M18 34h12l2 6H16Z" fill="#8e9aab"/><rect x="13" y="40" width="22" height="3" rx="1.5" fill="#6b778a"/>`, d); },
  git: () => { const [bg, d] = g('#ff8a5c', '#d1422f'); return wrap(`<rect x="5" y="5" width="38" height="38" rx="9" fill="${bg}"/><circle cx="17" cy="14" r="4" fill="#fff"/><circle cx="17" cy="34" r="4" fill="#fff"/><circle cx="31" cy="20" r="4" fill="#fff"/><path d="M17 18v12M31 24c0 6-14 4-14 6" fill="none" stroke="#fff" stroke-width="2.6"/>`, d); },
  structogram: () => { const [bg, d] = g('#ffc061', '#e07a1f'); return wrap(`<rect x="6" y="6" width="36" height="36" rx="4" fill="#fff" stroke="#c0661a" stroke-width="2"/><rect x="6" y="6" width="36" height="9" rx="4" fill="${bg}"/><path d="M6 15l18 10 18-10M24 25v17M6 33h18" fill="none" stroke="#c0661a" stroke-width="2"/>`, d); },
  game: () => { const [bg, d] = g('#54d39a', '#168a63'); return wrap(`<path d="M10 16h28a7 7 0 0 1 7 8l-2 9a5 5 0 0 1-9 2l-3-4H17l-3 4a5 5 0 0 1-9-2l-2-9a7 7 0 0 1 7-8Z" fill="${bg}"/><path d="M14 22v8M10 26h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="23" r="2.3" fill="#fff"/><circle cx="37" cy="28" r="2.3" fill="#fff"/>`, d); },
  fun: () => { const [bg, d] = g('#f472b6', '#7c3aed'); return wrap(`<rect x="5" y="5" width="38" height="38" rx="10" fill="${bg}"/><path d="m24 11 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#fff"/><circle cx="35" cy="34" r="2.5" fill="#ffe28a"/>`, d); },
  sql: () => { const [bg, d] = g('#ffd54f', '#e2a400'); return wrap(`<ellipse cx="24" cy="11" rx="16" ry="6" fill="${bg}"/><path d="M8 11v26c0 3.3 7.2 6 16 6s16-2.7 16-6V11c0 3.3-7.2 6-16 6S8 14.3 8 11Z" fill="#d79a00"/><path d="M8 20c0 3.3 7.2 6 16 6s16-2.7 16-6M8 29c0 3.3 7.2 6 16 6s16-2.7 16-6" fill="none" stroke="#ffe08a" stroke-width="2"/>`, d); },
  guide: () => { const [bg, d] = g('#5aa2ff', '#2a5bd7'); return wrap(`<circle cx="24" cy="24" r="19" fill="${bg}"/><path d="M18.5 18.5a5.6 5.6 0 1 1 7.8 5.1c-1.6.7-2.3 1.7-2.3 3.4v1.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="24" cy="34" r="2.2" fill="#fff"/>`, d); },
  about: () => { const [bg, d] = g('#7aa7ff', '#3858c8'); return wrap(`<circle cx="24" cy="24" r="19" fill="${bg}"/><path d="M24 21v13" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><circle cx="24" cy="15" r="2.4" fill="#fff"/>`, d); },
  launchpad: () => { const [bg, d] = g('#9aa3b3', '#5f6878'); const cols = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f1c', '#2ec4b6', '#e76f51', '#f4f1de']; let cells = ''; for (let i = 0; i < 9; i++) cells += `<rect x="${11 + (i % 3) * 10}" y="${11 + Math.floor(i / 3) * 10}" width="7" height="7" rx="2" fill="${cols[i]}"/>`; return wrap(`<rect x="4" y="4" width="40" height="40" rx="10" fill="${bg}"/>${cells}`, d); },
  home: () => folderIcon('kde', '<path d="m17 30 7-6 7 6v6h-4v-4h-6v4h-4Z" fill="#fff"/>'),
  docs: () => folderIcon('windows', '<path d="M19 22h10l3 3v11H19Z" fill="#fff" stroke="#c38912"/>'),
  files: fam => folderIcon(fam || 'windows')
};
export function appIcon(id, family) { return (APPS[id] || APPS.editor)(family); }

// Schlanke Liniensymbole für Werkzeugleisten.
const LINES = {
  back: '<path d="m15 18-6-6 6-6"/>', forward: '<path d="m9 18 6-6-6-6"/>', up: '<path d="M12 19V5m-6 6 6-6 6 6"/>', refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  home: '<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  play: '<path d="m7 4 13 8-13 8Z"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>', save: '<path d="M5 3h12l4 4v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 0v6h9V3M7 21v-7h10v7"/>',
  power: '<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>', volume: '<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  battery: '<rect x="2.5" y="7" width="17" height="10" rx="2"/><rect x="5" y="9.5" width="10" height="5" rx="1" fill="currentColor"/><path d="M21.5 10.5v3"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>', chevronUp: '<path d="m6 15 6-6 6 6"/>', chevronRight: '<path d="m9 6 6 6-6 6"/>', taskview: '<rect x="3" y="6" width="8" height="12" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/>',
  apps: '<circle cx="5" cy="5" r="1.6"/><circle cx="12" cy="5" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="12" cy="19" r="1.6"/><circle cx="19" cy="19" r="1.6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>', cut: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16 19 4M16 16 5 4"/>', paste: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/>',
  rename: '<path d="M4 20h4L19 9l-4-4L4 16Z"/>', folderPlus: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M12 11v5M9.5 13.5h5"/>', filePlus: '<path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M12 11v6M9 14h6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>', upload: '<path d="M12 21V9m-5 5 5-5 5 5M4 4h16"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>', terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>', sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>', restart: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/>',
  bluetooth: '<path d="m7 7 10 10-5 4V3l5 4L7 17"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', airplane: '<path d="M10 3h2l3 7h5a1 1 0 0 1 0 3h-5l-3 7h-2l1.5-7H7l-2 2H3l1-3.5L3 8h2l2 2h4.5Z"/>'
};
export function lineIcon(name, size = 18) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINES[name] || LINES.info}</svg>`; }

// Logos der Systeme als neutrale, eigene Zeichen (keine Originallogos).
export function osMark(id) {
  if (id === 'winxp') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8.5" height="8.5" rx="1.5" fill="#ef6b3a"/><rect x="12.5" y="3" width="8.5" height="8.5" rx="1.5" fill="#79b83a"/><rect x="3" y="12.5" width="8.5" height="8.5" rx="1.5" fill="#3a9be8"/><rect x="12.5" y="12.5" width="8.5" height="8.5" rx="1.5" fill="#f2bf2f"/></svg>';
  if (id.startsWith('win')) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h8.5v8.5H3ZM12.5 3H21v8.5h-8.5ZM3 12.5h8.5V21H3ZM12.5 12.5H21V21h-8.5Z" fill="currentColor"/></svg>';
  if (id === 'arch') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 21.5 21 12 16.2 2.5 21Z" fill="currentColor"/></svg>';
  if (id === 'debian') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 3.2c-5 0-8.6 3.7-8.6 8.4 0 4.3 3.3 8 7.7 8.2-3.3-1.2-5.2-4-5.2-7.2 0-3.6 2.8-6.2 6-6.2 2.8 0 5 2.1 5 4.7 0 2.2-1.6 3.9-3.6 3.9-1.5 0-2.7-1.1-2.7-2.6 0-1.2.9-2.1 2.1-2.1" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>';
  if (id === 'macos') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="currentColor"/></svg>';
}
