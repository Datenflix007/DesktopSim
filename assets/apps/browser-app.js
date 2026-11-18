// Webbrowser: virtuelle localhost-Server, lokale Dateien und die freigegebene Datenflix-Webseite.
import {homePath,joinPath,extName} from '../vfs.js';
import {lineIcon,appIcon} from '../ui/icons.js';
import {escapeHTML as esc} from './classic.js';

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const ALLOWED=/^https:\/\/datenflix007\.github\.io(?:\/|$)/i;
// Wird in jede lokale Seite eingefügt: Links und Formulare an das Browserfenster melden.
const BRIDGE=`<script>(()=>{const send=m=>parent.postMessage(Object.assign({__ds:1},m),'*');document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href]');if(!a)return;const h=a.getAttribute('href');if(!h||h.startsWith('#')||h.startsWith('javascript:'))return;e.preventDefault();send({nav:h})},true);document.addEventListener('submit',e=>{const f=e.target;e.preventDefault();const data=new URLSearchParams(new FormData(f)).toString();send({nav:f.getAttribute('action')||'',method:(f.method||'GET').toUpperCase(),body:data})},true);addEventListener('load',()=>send({title:document.title}));})();<\/script>`;

export class BrowserApp{
  browserStyle(){const os=this.currentOS;return os==='winxp'?'ie6':os==='win7'||os==='win8'?'ie9':os.startsWith('win')?'edge':os==='macos'?'safari':os==='unix'?'netscape':'firefox'}
  openBrowser(url,base,customHTML){
    const os=this.currentOS,style=this.browserStyle();
    const w=this.makeWindow('browser',this.appName('browser'),'browser',{width:900,height:600});
    w.content.className=`window-content br br-${style}`;
    const st={history:[],index:-1,title:''};
    const bar=`<div class="br-bar"><button data-b="back" title="Zurück">${lineIcon('back',16)}</button><button data-b="fwd" title="Vorwärts">${lineIcon('forward',16)}</button><button data-b="reload" title="Neu laden">${lineIcon('refresh',15)}</button>${style!=='safari'?`<button data-b="home" title="Startseite">${lineIcon('home',15)}</button>`:''}<label class="br-url"><span class="br-lock">${lineIcon('info',13)}</span><input spellcheck="false" aria-label="Adresse"></label>${style==='ie6'?'<button data-b="go" class="br-go">→ Wechseln zu</button>':''}<button data-b="menu" title="Menü">${lineIcon('menu',16)}</button></div>`;
    if(style==='safari'||style==='firefox'||style==='edge'){w.titleSlot.innerHTML=`<div class="br-tabs"><div class="br-tab on"><span class="br-tab-ico">${appIcon('browser')}</span><span class="br-tab-title">Neuer Tab</span></div><button class="br-newtab" title="Neuer Tab">${lineIcon('plus',14)}</button></div>`;w.element.classList.add('br-tabbed');w.titleSlot.querySelector('.br-newtab').onclick=e=>{e.stopPropagation();this.openBrowser()}}
    w.content.innerHTML=`${style==='ie6'?'<nav class="br-menubar"><span>Datei</span><span>Bearbeiten</span><span>Ansicht</span><span>Favoriten</span><span>Extras</span><span>?</span></nav>':''}${bar}<div class="br-view"></div><div class="br-status"><span class="br-status-text">Fertig</span><span>${style.startsWith('ie')?'Internet | Geschützter Modus: Aktiv':''}</span></div>`;
    const view=$('.br-view',w.content),addr=$('.br-url input',w.content),status=$('.br-status-text',w.content);
    const setTitle=t=>{st.title=t;const name=this.appName('browser');this.updateTitle(w,t?(style==='safari'?t:`${t} – ${name}`):name);const tt=$('.br-tab-title',w.element);if(tt)tt.textContent=t||'Neuer Tab'};
    const show=html=>{view.innerHTML='';const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts allow-forms allow-modals');frame.title='Webseite';frame.referrerPolicy='no-referrer';frame.srcdoc=html;view.append(frame)};
    const page=(title,body,cls='')=>{view.innerHTML=`<div class="br-page ${cls}">${body}</div>`;setTitle(title)};
    const inline=(html,resolve)=>{
      // CSS, JS und Bilder aus dem virtuellen Dateisystem einbetten, damit relative Pfade funktionieren.
      html=html.replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi,tag=>{const href=tag.match(/href=["']([^"']+)["']/i)?.[1];const css=href&&!/^https?:/.test(href)?resolve(href):null;return css!==null&&css!==undefined?`<style>/* ${esc(href)} */\n${css.content}</style>`:tag});
      html=html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,(tag,a,src,b)=>{if(/^https?:/.test(src))return tag;const js=resolve(src);return js?`<script${a}${b}>${js.content.replace(/<\/script>/gi,'<\\/script>')}<\/script>`:tag});
      html=html.replace(/(<img\b[^>]*\bsrc=)["']([^"']+)["']/gi,(m,pre,src)=>{if(/^(https?:|data:)/.test(src))return m;const f=resolve(src);if(!f)return m;const mime=/\.svg$/i.test(src)?'image/svg+xml':/\.png$/i.test(src)?'image/png':'image/jpeg';return`${pre}"${f.enc==='b64'?`data:${mime};base64,${f.content}`:`data:${mime};charset=utf-8,${encodeURIComponent(f.content)}`}"`});
      return /<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,m=>m+BRIDGE):BRIDGE+html;
    };
    const resolveLocal=url=>{
      // Liefert {kind, ...} für localhost, file:// und relative Pfade.
      const m=url.match(/^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?::(\d+))?(\/[^?#]*)?(?:\?([^#]*))?/i);
      if(m)return{kind:'server',port:m[1]||'80',path:m[2]||'/',query:m[3]||''};
      if(url.startsWith('file://'))return{kind:'file',path:decodeURIComponent(url.slice(7))};
      return null;
    };
    const navigate=async(raw,{push=true,method='GET',body=''}={})=>{
      let url=String(raw||'').trim();if(!url)url='about:home';
      if(!/^[a-z]+:/i.test(url)&&!/^(localhost|127\.0\.0\.1)/i.test(url)){if(/^[\w.-]+\.(html?|php|txt|css|js)$/i.test(url)||url.startsWith('/')||url.startsWith('./')||url.startsWith('~')){const p=this.fs.normalize(url,base||joinPath(homePath(os),'Projects'));url='file://'+p}else if(/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(url))url='https://'+url;else url='about:search?q='+encodeURIComponent(url)}
      if(push){st.history=st.history.slice(0,st.index+1);st.history.push(url);st.index++}
      addr.value=url.startsWith('about:home')?'':url;$('[data-b="back"]',w.content).disabled=st.index<=0;$('[data-b="fwd"]',w.content).disabled=st.index>=st.history.length-1;
      $('.br-lock',w.content).innerHTML=url.startsWith('https://')?lineIcon('lock',13):lineIcon('info',13);
      status.textContent='Wird geladen …';w.element.classList.add('loading');
      try{await load(url,method,body)}finally{w.element.classList.remove('loading');status.textContent='Fertig'}
    };
    const load=async(url,method,body)=>{
      if(customHTML!==undefined){const html=customHTML;customHTML=undefined;show(inline(html,()=>null));setTitle('Vorschau');return}
      if(url.startsWith('about:home'))return home();
      if(url.startsWith('about:search')){const q=decodeURIComponent(url.split('q=')[1]||'');return page('Suche',`<h1>${lineIcon('search',22)} Suche: „${esc(q)}“</h1><p>Die Websuche ist in der DesktopSim-Sandbox nicht verfügbar.</p><p>Erreichbar sind: <a data-go="http://localhost:8000">virtuelle localhost-Server</a>, lokale Dateien (<code>file://</code>) und <a data-go="https://datenflix007.github.io/">datenflix007.github.io</a>.</p>`,'br-info'),bindGo()}
      if(ALLOWED.test(url)){view.innerHTML='';const f=document.createElement('iframe');f.setAttribute('sandbox','allow-scripts allow-forms allow-popups allow-modals allow-downloads');f.referrerPolicy='no-referrer';f.title='Datenflix';f.src=url;view.append(f);setTitle('Datenflix');return}
      if(/^https?:\/\//i.test(url)&&!resolveLocal(url)){const host=url.replace(/^https?:\/\//,'').split('/')[0];return page('Fehler',style.startsWith('ie')?`<h1>Die Webseite kann nicht angezeigt werden.</h1><ul><li>Die Webseite „${esc(host)}“ ist in der Lern-Sandbox nicht freigegeben.</li><li>Erlaubt: localhost, lokale Dateien und datenflix007.github.io.</li></ul>`:style==='firefox'?`<h1>Fehler: Gesicherte Verbindung fehlgeschlagen</h1><p>Die Seite <b>${esc(host)}</b> kann in DesktopSim nicht geladen werden, weil der Browser in einer abgeschotteten Lernumgebung läuft.</p><p>Erlaubt: <code>http://localhost:PORT</code>, <code>file://…</code> und <a data-go="https://datenflix007.github.io/">datenflix007.github.io</a>.</p>`:`<h1>Diese Seite ist nicht erreichbar</h1><p><b>${esc(host)}</b> ist in der DesktopSim-Sandbox gesperrt.</p><p class="code">ERR_BLOCKED_BY_CLIENT</p><p>Erlaubt: localhost-Server, lokale Dateien und <a data-go="https://datenflix007.github.io/">datenflix007.github.io</a>.</p>`,'br-error'),bindGo()}
      const loc=resolveLocal(url);
      if(loc?.kind==='server'){
        const sv=this.servers.get(loc.port);
        if(!sv)return page('Fehler',`<h1>${style==='firefox'?'Fehler: Verbindung fehlgeschlagen':'Diese Website ist nicht erreichbar'}</h1><p><b>localhost</b> hat die Verbindung abgelehnt. Auf Port ${esc(loc.port)} läuft kein Server.</p><p>Starte im Terminal zum Beispiel:</p><pre>${os.startsWith('win')?'python':'python3'} -m http.server ${esc(loc.port)}\nphp -S localhost:${esc(loc.port)}</pre><p class="code">ERR_CONNECTION_REFUSED</p>`,'br-error');
        const res=await this.termEngine.programs.serveLocal(sv,loc.path,loc.query,method,body);
        const dir=sv.cwd+loc.path.replace(/\/[^/]*$/,'');
        const resolver=href=>{const clean=href.split(/[?#]/)[0];const p=clean.startsWith('/')?this.fs.normalize('.'+clean,sv.cwd):this.fs.normalize(clean,this.fs.isDir(sv.cwd+loc.path)?sv.cwd+loc.path:dir);return this.fs.locate(p)?.type==='file'?this.fs.locate(p):null};
        if(/html/.test(res.type))show(inline(res.body,resolver));else show(`<pre style="white-space:pre-wrap;font:13px monospace;margin:12px">${esc(res.body)}</pre>`);
        setTitle(res.body.match(/<title>([^<]*)<\/title>/i)?.[1]||`localhost:${loc.port}${loc.path}`);w.base={kind:'server',port:loc.port,path:loc.path};return;
      }
      if(loc?.kind==='file'){
        const node=this.fs.locate(loc.path);if(!node)return page('Fehler',`<h1>Datei nicht gefunden</h1><p>Die Datei <code>${esc(loc.path)}</code> existiert nicht.</p>`,'br-error');
        if(node.type==='dir'){const items=this.fs.list(loc.path);return page(`Index von ${loc.path}`,`<h1>Index von ${esc(loc.path)}</h1><ul class="br-index">${loc.path!=='/'?`<li><a data-go="file://${esc(loc.path.replace(/\/[^/]*$/,'')||'/')}">⬑ Übergeordnetes Verzeichnis</a></li>`:''}${items.map(e=>`<li><a data-go="file://${esc(joinPath(loc.path,e.name))}">${e.type==='dir'?'📁':'📄'} ${esc(e.name)}</a></li>`).join('')}</ul>`),bindGo()}
        const dir=loc.path.replace(/\/[^/]*$/,'');
        if(/\.html?$/i.test(loc.path))show(inline(node.content,href=>{const f=this.fs.locate(this.fs.normalize(href.split(/[?#]/)[0],dir));return f?.type==='file'?f:null}));
        else if(node.enc==='b64'&&/\.(png|jpe?g|gif|svg)$/i.test(loc.path))view.innerHTML=`<div class="br-img"><img alt="" src="data:image/${extName(loc.path).replace('jpg','jpeg')};base64,${node.content}"></div>`;
        else show(`<pre style="white-space:pre-wrap;font:13px monospace;margin:12px">${esc(node.enc?'[Binärdatei]':node.content)}</pre>`);
        setTitle(node.content.match?.(/<title>([^<]*)<\/title>/i)?.[1]||loc.path.split('/').pop());w.base={kind:'file',dir};return;
      }
      return page('Fehler','<h1>Adresse ungültig</h1>','br-error');
    };
    const bindGo=()=>$$('[data-go]',view).forEach(a=>a.onclick=e=>{e.preventDefault();navigate(a.dataset.go)});
    const home=()=>{const servers=[...this.servers.entries()];const brand={ie6:'Willkommen',ie9:'Neuer Tab',edge:'Neuer Tab',firefox:'Neuer Tab',safari:'Startseite',netscape:'Netscape-Startseite'}[style];
      page(brand,`<div class="br-home"><div class="br-home-logo">${appIcon('browser')}</div><label class="br-home-search">${lineIcon('search',18)}<input placeholder="Adresse eingeben, z. B. localhost:8000"></label><div class="br-tiles">${servers.map(([p,s])=>`<button data-go="http://localhost:${p}"><b>localhost:${p}</b><small>${s.kind==='php'?'PHP-Server':'HTTP-Server'} · ${esc(s.cwd.split('/').pop())}</small></button>`).join('')}<button data-go="file://${esc(joinPath(homePath(os),'Projects/index.html'))}"><b>index.html</b><small>Projects (lokal)</small></button><button data-go="https://datenflix007.github.io/"><b>Datenflix</b><small>datenflix007.github.io</small></button><button data-go="file://${esc(joinPath(homePath(os),'Projects'))}"><b>Projects</b><small>Dateien durchsuchen</small></button></div>${servers.length?'':`<p class="br-tip">Tipp: Starte im Terminal <code>${os.startsWith('win')?'python':'python3'} -m http.server 8000</code> im Ordner Projects und öffne <b>localhost:8000</b>.</p>`}</div>`,'br-start');
      bindGo();const s=$('.br-home-search input',view);s.onkeydown=e=>{if(e.key==='Enter')navigate(s.value)};setTitle(brand==='Neuer Tab'?'Neuer Tab':brand)};
    const onMessage=e=>{if(!e.data?.__ds||!view.contains([...view.querySelectorAll('iframe')].find(f=>f.contentWindow===e.source)||null))return;if(e.data.title)setTitle(e.data.title);if(e.data.nav!==undefined){const target=e.data.nav;let next;if(/^https?:|^file:/.test(target))next=target;else if(w.base?.kind==='server'){const basePath=w.base.path.endsWith('/')?w.base.path:w.base.path.replace(/\/[^/]*$/,'/');const abs=target.startsWith('/')?target:new URL(target||w.base.path,'http://x'+basePath).pathname+(target.includes('?')?'?'+target.split('?')[1]:'');next=`http://localhost:${w.base.port}${target===''?w.base.path:abs}`}else if(w.base?.kind==='file')next='file://'+this.fs.normalize(target.split(/[?#]/)[0],w.base.dir);else next=target;if(e.data.method==='GET'&&e.data.body)next+=(next.includes('?')?'&':'?')+e.data.body;navigate(next,{method:e.data.method||'GET',body:e.data.method==='POST'?e.data.body:''})}};
    addEventListener('message',onMessage);w.cleanup=()=>removeEventListener('message',onMessage);
    $$('[data-b]',w.content).forEach(b=>b.onclick=e=>{const a=b.dataset.b;if(a==='back'&&st.index>0){st.index--;navigate(st.history[st.index],{push:false})}if(a==='fwd'&&st.index<st.history.length-1){st.index++;navigate(st.history[st.index],{push:false})}if(a==='reload')navigate(st.history[st.index],{push:false});if(a==='home')navigate('about:home');if(a==='go')navigate(addr.value);if(a==='menu'){const r=b.getBoundingClientRect();this.chrome.contextMenu(r.right-200,r.bottom,[{label:'Neues Fenster',action:()=>this.openBrowser()},{label:'Seitenquelltext anzeigen',action:()=>{const f=$('iframe',view);if(f?.srcdoc){const w2=this.makeWindow('editor','Quelltext: '+(st.title||''),'editor',{width:700,height:480});w2.content.className='window-content src-view';w2.content.innerHTML=`<pre>${esc(f.srcdoc.replace(BRIDGE,''))}</pre>`}}},{sep:true},{label:'Startseite',action:()=>navigate('about:home')}])}});
    addr.addEventListener('keydown',e=>{if(e.key==='Enter')navigate(addr.value)});addr.addEventListener('focus',()=>addr.select());
    w.onServers=()=>{if(st.history[st.index]?.startsWith('about:home'))home()};
    const start=url?(/^(https?:|file:|about:)/.test(url)?url:url.startsWith('/')?'file://'+url:(this.fs.exists(url,base||joinPath(homePath(os),'Projects'))?'file://'+this.fs.normalize(url,base||joinPath(homePath(os),'Projects')):url)):'about:home';
    navigate(start);return w;
  }
}
