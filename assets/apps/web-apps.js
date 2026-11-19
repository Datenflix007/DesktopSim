// Web-Apps von datenflix007.github.io als eigenständige Desktop-Programme (ohne Website-Kopfzeile).
// Läuft DesktopSim selbst auf datenflix007.github.io, wird die Seite direkt eingebettet und die
// Kopfzeile per CSS ausgeblendet. Lokal (andere Herkunft) wird die Seite geladen und mit <base>
// als srcdoc eingebettet, damit dieselbe Bereinigung möglich ist.
const BASE = 'https://datenflix007.github.io/';
export const WEB_APPS = {
  mindmap: { title: 'Gruppen-Mindmap', url: BASE + 'mindmap/participant.html', width: 1100, height: 720 },
  dslab: { title: 'DatastructureLab', url: BASE + 'tools/AlgoDatCourse/DatastructureLab.html', width: 1220, height: 780 },
  mdgen: { title: 'Markdown Generator', url: BASE + 'tools/markdownGenerator/', width: 1120, height: 760 },
  papermaker: { title: 'Paper-Maker', url: BASE + 'tools/PaperMaker/', width: 1180, height: 780 }
};

// Entfernt die gemeinsame Website-Kopfzeile, das Feedback-Widget und deren Abstände.
const APP_CSS = `.site-header,[data-site-header],.df-feedback-launch,.df-feedback-backdrop,[data-feedback-widget],footer.site-footer{display:none!important}
body.has-datenflix-shell{padding-top:0!important;margin-top:0!important;--site-header-height:0px!important;--df-header-height:0px!important}
.site-app-header--offset{top:0!important;margin-top:0!important}`;

export class WebApps {
  openWebApp(id) {
    const meta = WEB_APPS[id];
    if (!meta) return null;
    const existing = [...this.windows.values()].find(w => w.kind === 'webapp' && w.webApp === id);
    if (existing) { if (existing.minimized) this.restoreWindow?.(existing); this.focusWindow(existing); return existing; }
    const w = this.makeWindow('webapp', meta.title, id, { width: meta.width, height: meta.height });
    w.webApp = id;
    w.content.className = 'window-content webapp-content';
    w.content.innerHTML = `<div class="webapp-loading"><span class="webapp-spinner"></span><span>${meta.title} wird geladen …</span></div><iframe class="webapp-frame" title="${meta.title}" allow="clipboard-read; clipboard-write; fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    const frame = w.content.querySelector('iframe'), loading = w.content.querySelector('.webapp-loading');
    let fallback = false, timer = null;
    const inject = doc => {
      if (!doc?.documentElement || doc.getElementById('ds-webapp-style')) return;
      const style = doc.createElement('style'); style.id = 'ds-webapp-style'; style.textContent = APP_CSS;
      (doc.head || doc.documentElement).append(style);
    };
    const sameOrigin = () => { try { return Boolean(frame.contentDocument); } catch { return false; } };
    // Möglichst früh einspritzen, damit die Kopfzeile gar nicht erst aufblitzt.
    const watch = () => { clearInterval(timer); let n = 0; timer = setInterval(() => { if (sameOrigin()) inject(frame.contentDocument); if (++n > 200) clearInterval(timer); }, 25); };
    const loadFallback = async () => {
      fallback = true;
      try {
        const res = await fetch(meta.url, { cache: 'no-cache' });
        if (!res.ok) throw Error('HTTP ' + res.status);
        let html = await res.text();
        const head = `<base href="${meta.url}"><style id="ds-webapp-style">${APP_CSS}</style>`;
        html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + head) : head + html;
        frame.removeAttribute('src'); frame.srcdoc = html;
      } catch (e) { offline(e); }
    };
    const offline = e => { loading.hidden = false; loading.innerHTML = `<div class="webapp-error"><b>${meta.title} konnte nicht geladen werden.</b><span>Für diese App ist eine Internetverbindung nötig (${String(e?.message || e || 'Netzwerkfehler')}).</span><button type="button">Erneut versuchen</button></div>`; loading.querySelector('button').onclick = () => { loading.innerHTML = `<span class="webapp-spinner"></span><span>${meta.title} wird geladen …</span>`; start(); }; };
    frame.addEventListener('load', () => {
      if (!fallback && frame.getAttribute('src') && !sameOrigin()) { loadFallback(); return; }
      if (sameOrigin()) inject(frame.contentDocument);
      loading.hidden = true;
      try { const t = frame.contentDocument?.title; if (t && t !== meta.title) this.updateTitle(w, `${meta.title}`); } catch { /* fremde Herkunft */ }
    });
    const start = () => {
      fallback = false;
      if (!navigator.onLine) return offline('offline');
      const here = location.origin === new URL(BASE).origin;
      if (here) { frame.src = meta.url; watch(); }
      else loadFallback();
    };
    start();
    w.cleanup = () => clearInterval(timer);
    return w;
  }
}
