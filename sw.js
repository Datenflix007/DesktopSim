// DesktopSim Service Worker
// 1) Synchrone Eingabe-Brücke: Laufzeit-Worker (Python, C/C++, PHP, JS) blockieren per
//    synchronem XHR auf /__ds_io__/read, bis das Terminal eine Zeile liefert. Das funktioniert
//    auf GitHub Pages ohne SharedArrayBuffer/COOP/COEP-Header.
// 2) Dauerhafter Cache für große, versionierte Laufzeit-Downloads (Pyodide, PyPI-Wheels, Clang, PHP, SQLite, SWI-Prolog, JDK-Tools).
const RUNTIME_CACHE = 'desktopsim-runtimes-v1';
const CACHE_HOSTS = [
  /^https:\/\/cdn\.jsdelivr\.net\/(?:pyodide\/v\d|npm\/@yowasp\/|npm\/php-wasm@\d|npm\/@php-wasm\/|npm\/swipl-wasm@\d)/,
  /^https:\/\/files\.pythonhosted\.org\/packages\//,
  /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/sql\.js\/\d/,
  /^https:\/\/raw\.githubusercontent\.com\/leaningtech\/javafiddle\/[0-9a-f]{40}\//
];
const waiting = new Map();   // channel -> resolve(Response)
const buffered = new Map();  // channel -> [{data, eof}]

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type !== 'ds-stdin' || typeof msg.channel !== 'string') return;
  const item = { data: msg.eof ? null : String(msg.data ?? ''), eof: Boolean(msg.eof) };
  const resolve = waiting.get(msg.channel);
  if (resolve) { waiting.delete(msg.channel); resolve(respond(item)); }
  else { const queue = buffered.get(msg.channel) || []; queue.push(item); buffered.set(msg.channel, queue); }
});

function respond(item) {
  if (item.eof) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  return new Response(item.data, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.endsWith('/__ds_io__/read')) {
    event.respondWith(readChannel(url.searchParams.get('ch') || ''));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.endsWith('/__ds_io__/ping')) {
    event.respondWith(new Response('pong', { headers: { 'Cache-Control': 'no-store' } }));
    return;
  }
  if (event.request.method === 'GET' && CACHE_HOSTS.some(rx => rx.test(event.request.url))) {
    event.respondWith(cacheFirst(event.request));
  }
});

function readChannel(channel) {
  const queue = buffered.get(channel);
  if (queue?.length) {
    const item = queue.shift();
    if (!queue.length) buffered.delete(channel);
    return Promise.resolve(respond(item));
  }
  return new Promise(resolve => {
    waiting.set(channel, resolve);
    // Browser beenden Fetch-Events nach einigen Minuten; der Worker fragt dann erneut an.
    setTimeout(() => {
      if (waiting.get(channel) === resolve) {
        waiting.delete(channel);
        resolve(new Response('', { status: 202, headers: { 'Cache-Control': 'no-store' } }));
      }
    }, 240000);
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type !== 'opaque') {
    try { await cache.put(request.url, response.clone()); } catch { /* Speicher voll: ohne Cache weiter */ }
  }
  return response;
}
