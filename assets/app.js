import {OS_LIST,getOS,isWindows,VFS,homePath,pathDisplay,joinPath,extName} from './vfs.js';
import {MiniSQL,PythonRuntime,simulateCompiled} from './runtimes.js';
import {TerminalEngine,promptFor,shellHelp} from './terminal.js';

const $ = (s,root=document)=>root.querySelector(s);
const escapeHTML = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(name,size=22)=>{
  const paths={
    terminal:'<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="m6 9 4 3-4 3m7 0h5"/>',
    folder:'<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    file:'<path d="M6 2h8l5 5v14a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v6h5M8 12h8M8 16h8"/>',
    code:'<rect x="2.5" y="3" width="19" height="18" rx="3"/><path d="m9 9-3 3 3 3m6-6 3 3-3 3m-2-7-2 8"/>',
    browser:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 0 0 18M12 3a15 15 0 0 1 0 18"/>',
    database:'<ellipse cx="12" cy="5.5" rx="9" ry="3.5"/><path d="M3 5.5v13c0 2 4 3.5 9 3.5s9-1.5 9-3.5v-13M3 12c0 2 4 3.5 9 3.5s9-1.5 9-3.5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4m0-4h.01"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M4 12a8 8 0 0 1 16 0 8 8 0 0 1-16 0Z"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    windows:'<path d="M3 5 11 4v8H3zm10-1 8-1v9h-8zM3 14h8v7l-8-1zm10 0h8v8l-8-1z"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M4 19h16"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    home:'<path d="m3 11 9-8 9 8v9H3v-9Zm6 9v-7h6v7"/>',
    play:'<path d="m8 5 12 7-12 7Z"/>',
    save:'<path d="M4 3h14l3 3v15H3V3Zm3 0v7h10V3M7 21v-8h10v8"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/>',
    arrow:'<path d="m15 18-6-6 6-6"/>',
    server:'<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h7M11 17h7"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.file}</svg>`;
};
const ACTIONS=[{id:'terminal',label:'Terminal',detail:'Neue Konsole'},{id:'files',label:'Dateimanager',detail:'Virtuelle Ordner'},{id:'editor',label:'Code-Editor',detail:'Dateien bearbeiten'},{id:'browser',label:'Webbrowser',detail:'localhost / HTML'},{id:'sql',label:'SQL Studio',detail:'SQL-Abfragen'},{id:'guide',label:'Anleitung',detail:'Befehle & Übungen'}];

class DesktopSim{
  constructor(){
    this.desktop=$('#desktop');this.layer=$('#window-layer');this.windows=new Map();this.serial=0;this.z=10;
    this.servers=new Map();this.python=new PythonRuntime();this.currentOS='win11';this.fs=null;this.db=null;
    this.termEngine=new TerminalEngine(this);
    this.bindUI();this.drawOSPicker();
    let stored;try{stored=localStorage.getItem('desktopsim-v2-last-os')}catch{}
    this.setOS(OS_LIST.some(o=>o.id===stored)?stored:'win11',false);
    if(stored)this.hidePicker();else this.showPicker();
  }
  bindUI(){
    $('#change-os').addEventListener('click',()=>this.showPicker());
    $('#close-picker').addEventListener('click',()=>this.hidePicker());
    $('#guide-button').addEventListener('click',()=>this.openGuide());
    $('#export-button').addEventListener('click',()=>this.exportFiles());
    $('#os-picker').addEventListener('click',e=>{if(e.target.id==='os-picker')this.hidePicker()});
    $('#import-input').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{this.fs.import(JSON.parse(await f.text()));this.toast('Dateisystem importiert');this.notifyFiles()}catch(err){alert('Import fehlgeschlagen: '+err.message)}e.target.value=''});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#start-menu').classList.add('hidden');return}if((e.ctrlKey||e.metaKey)&&e.altKey&&e.key.toLowerCase()==='t'){e.preventDefault();this.openTerminal()}});
    this.desktop.addEventListener('pointerdown',e=>{if(!e.target.closest('.start-menu, .start-trigger, .task-launch'))$('#start-menu').classList.add('hidden')});
    window.addEventListener('resize',()=>this.keepInBounds());
  }
  drawOSPicker(){const groupNames=[...new Set(OS_LIST.map(o=>o.group))];$('#os-grid').innerHTML=groupNames.map(group=>`<div class="os-group"><div class="os-group-label">${escapeHTML(group)}</div><div class="os-options">${OS_LIST.filter(o=>o.group===group).map(o=>`<button class="os-option" data-choice="${o.id}" type="button"><span class="os-option-icon ${o.id}">${escapeHTML(o.symbol)}</span><span class="os-option-body"><strong>${escapeHTML(o.label)}</strong><small>${escapeHTML(o.subtitle)}</small></span><span class="os-option-year">${o.year}</span></button>`).join('')}</div></div>`).join('');$('#os-grid').addEventListener('click',e=>{const el=e.target.closest('[data-choice]');if(!el)return;this.setOS(el.dataset.choice,true);this.hidePicker()})}
  showPicker(){$('#os-picker').classList.remove('hidden');$('#close-picker').hidden=false;$('#os-grid').querySelectorAll('.os-option').forEach(b=>b.classList.toggle('active',b.dataset.choice===this.currentOS))}
  hidePicker(){$('#os-picker').classList.add('hidden')}
  setOS(id,boot=true){
    for(const win of this.windows.values())win.element.remove();this.windows.clear();this.servers.clear();this.python.terminate();
    this.currentOS=id;this.os=getOS(id);this.fs=new VFS(id);this.db=new MiniSQL(id);this.desktop.dataset.os=id;
    $('#header-status').textContent=`${this.os.label} · ${this.os.shell.toUpperCase()} · Browser-Sandbox`;
    try{localStorage.setItem('desktopsim-v2-last-os',id)}catch{}
    this.renderDesktopIcons();this.renderTaskbar();this.renderMacMenu();this.renderStartMenu();
    if(boot){this.toast(`${this.os.label} gestartet · Oberfläche wird simuliert`);this.openTerminal()}
  }
  renderMacMenu(){const menu=$('#mac-menu');menu.hidden=this.currentOS!=='macos';if(this.currentOS==='macos')menu.innerHTML=`<strong class="apple-symbol">●</strong><strong>Finder</strong><span>File</span><span>Edit</span><span>View</span><span>Window</span><span class="mac-menu-clock" id="mac-time"></span>`;}
  renderDesktopIcons(){
    $('#desktop-icons').innerHTML=ACTIONS.map(a=>`<button class="desktop-icon" type="button" data-action="${a.id}" aria-label="${escapeHTML(a.label)} öffnen"><span class="icon-tile tile-${a.id}">${svg(a.id==='files'?'folder':a.id==='editor'?'code':a.id==='guide'?'info':a.id==='sql'?'database':a.id==='browser'?'browser':'terminal',30)}</span><span class="desktop-label">${escapeHTML(a.label)}</span></button>`).join('');
    $('#desktop-icons').querySelectorAll('.desktop-icon').forEach(el=>{let last=0;el.addEventListener('click',()=>{const now=Date.now();if(now-last<480||matchMedia('(pointer: coarse)').matches)this.launch(el.dataset.action);last=now;})});
  }
  launch(action){$('#start-menu').classList.add('hidden');switch(action){case'terminal':return this.openTerminal();case'files':return this.openFiles();case'editor':return this.openEditor();case'browser':return this.openBrowser();case'sql':return this.openSQL();case'guide':return this.openGuide();case'import':$('#import-input').click();break;case'export':this.exportFiles();break;case'reset':if(confirm(`Virtuelle Dateien und SQL-Daten für ${this.os.label} wirklich zurücksetzen?`)){this.fs.reset();this.db.reset();this.notifyFiles();this.toast('Virtuelle Daten zurückgesetzt')}break;case'newterminal':return this.openTerminal();}}
  renderTaskbar(){
    const wins=[...this.windows.values()];const isMac=this.currentOS==='macos';
    const openButtons=wins.map(w=>`<button class="task-window ${w.minimized?'task-minimized':''}" type="button" data-activate="${w.id}" title="${escapeHTML(w.title)}"><span>${svg(w.icon,17)}</span><span class="task-window-label">${escapeHTML(w.title)}</span></button>`).join('');
    const quick=ACTIONS.slice(0,5).map(a=>`<button type="button" class="task-launch" data-launch="${a.id}" title="${escapeHTML(a.label)}">${svg(a.id==='files'?'folder':a.id==='editor'?'code':a.id==='sql'?'database':a.id,23)}</button>`).join('');
    $('#taskbar').innerHTML=`<button type="button" class="start-trigger" title="Menü öffnen"><span class="start-symbol">${isMac?'◉':this.currentOS==='unix'?'◆':this.currentOS==='arch'?'▲':this.currentOS==='debian'?'◈':'⊞'}</span><span class="start-text">${this.currentOS==='winxp'?'Start':''}</span></button><div class="task-divider"></div><div class="quick-launch">${quick}</div><div class="running-tasks">${openButtons}</div><div class="task-tray"><span class="tray-status" title="Rein virtueller Rechner">◉</span><span id="task-clock" class="task-clock"></span></div>`;
    const bar=$('#taskbar');$('.start-trigger',bar).addEventListener('click',e=>{e.stopPropagation();$('#start-menu').classList.toggle('hidden')});
    bar.querySelectorAll('[data-launch]').forEach(b=>b.addEventListener('click',()=>this.launch(b.dataset.launch)));
    bar.querySelectorAll('[data-activate]').forEach(b=>b.addEventListener('click',()=>{const w=this.windows.get(+b.dataset.activate);if(!w)return;if(w.minimized){w.minimized=false;w.element.classList.remove('minimized')}this.focusWindow(w)}));
    this.tickClock();
  }
  tickClock(){const txt=new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});const t=$('#task-clock');if(t)t.textContent=txt;const mt=$('#mac-time');if(mt)mt.textContent=txt;}
  renderStartMenu(){const menu=$('#start-menu');const windows8=this.currentOS==='win8';menu.className='start-menu hidden'+(windows8?' metro-menu':'');menu.innerHTML=`<div class="start-heading"><span class="start-avatar">${svg('code',25)}</span><span><strong>DesktopSim</strong><small>${escapeHTML(this.os.label)} · Student</small></span></div><div class="start-menu-list">${ACTIONS.map(a=>`<button type="button" data-menu-action="${a.id}">${svg(a.id==='files'?'folder':a.id==='editor'?'code':a.id==='guide'?'info':a.id==='sql'?'database':a.id,21)}<span>${escapeHTML(a.label)}</span><small>${escapeHTML(a.detail)}</small></button>`).join('')}</div><div class="start-menu-bottom"><button data-menu-action="import">⇧ Import</button><button data-menu-action="export">⇩ Export</button><button data-menu-action="reset">↺ Zurücksetzen</button></div>`;menu.querySelectorAll('[data-menu-action]').forEach(b=>b.addEventListener('click',()=>this.launch(b.dataset.menuAction)))}
  toast(message){const n=$('#desktop-notice');n.textContent=message;n.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>n.classList.remove('visible'),3700)}
  makeWindow(kind,title,icon='file',preferred={}){
    const id=++this.serial,deskW=this.desktop.clientWidth,deskH=this.desktop.clientHeight;
    const width=Math.min(preferred.width||730,Math.max(290,deskW-30));
    const height=Math.min(preferred.height||480,Math.max(260,deskH-85));
    const offset=(this.windows.size%7)*32;
    const left=Math.max(8,Math.min(125+offset,deskW-width-8));const top=Math.max(this.currentOS==='macos'?40:12,Math.min(45+offset,deskH-height-55));
    const el=document.createElement('section');el.className='sim-window';el.dataset.window=id;el.setAttribute('role','dialog');el.setAttribute('aria-label',title);
    el.style.cssText=`width:${width}px;height:${height}px;left:${left}px;top:${top}px;z-index:${++this.z}`;
    el.innerHTML=`<div class="window-titlebar"><div class="window-dots"><button type="button" data-wbtn="close" aria-label="Schließen"></button><button type="button" data-wbtn="min" aria-label="Minimieren"></button><button type="button" data-wbtn="max" aria-label="Maximieren"></button></div><span class="title-app-icon">${svg(icon,16)}</span><span class="window-title">${escapeHTML(title)}</span><div class="window-controls"><button type="button" data-wbtn="min" title="Minimieren">—</button><button type="button" data-wbtn="max" title="Maximieren">□</button><button type="button" data-wbtn="close" title="Schließen">×</button></div></div><div class="window-content"></div>`;
    this.layer.append(el);const win={id,kind,title,icon,element:el,content:$('.window-content',el),minimized:false,maximized:false,restore:{left,top,width,height}};
    this.windows.set(id,win);
    el.addEventListener('pointerdown',()=>this.focusWindow(win));
    el.querySelectorAll('[data-wbtn]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const a=b.dataset.wbtn;if(a==='close')this.closeWindowById(id);if(a==='min')this.minimizeWindow(win);if(a==='max')this.toggleMax(win)}));
    this.attachDragging(win);this.focusWindow(win);this.renderTaskbar();return win;
  }
  attachDragging(win){const bar=$('.window-titlebar',win.element);let drag=null;
    bar.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button')||win.maximized)return;drag={x:e.clientX,y:e.clientY,left:win.element.offsetLeft,top:win.element.offsetTop};bar.setPointerCapture(e.pointerId);e.preventDefault()});
    bar.addEventListener('pointermove',e=>{if(!drag)return;const deskW=this.desktop.clientWidth,deskH=this.desktop.clientHeight,el=win.element;el.style.left=Math.max(0,Math.min(deskW-70,drag.left+e.clientX-drag.x))+'px';el.style.top=Math.max(this.currentOS==='macos'?28:0,Math.min(deskH-80,drag.top+e.clientY-drag.y))+'px'});
    const end=()=>drag=null;bar.addEventListener('pointerup',end);bar.addEventListener('lostpointercapture',end);
    bar.addEventListener('dblclick',e=>{if(!e.target.closest('button'))this.toggleMax(win)});
  }
  closeWindowById(id){const w=this.windows.get(+id);if(!w)return;w.element.remove();this.windows.delete(+id);this.renderTaskbar()}
  focusWindow(w){w.element.style.zIndex=++this.z;w.element.classList.remove('inactive');for(const other of this.windows.values())if(other!==w)other.element.classList.add('inactive')}
  minimizeWindow(w){w.minimized=true;w.element.classList.add('minimized');this.renderTaskbar()}
  toggleMax(w){const e=w.element;if(!w.maximized){w.restore={left:e.offsetLeft,top:e.offsetTop,width:e.offsetWidth,height:e.offsetHeight};w.maximized=true;e.classList.add('maximized');}else{w.maximized=false;e.classList.remove('maximized');Object.assign(e.style,{left:w.restore.left+'px',top:w.restore.top+'px',width:w.restore.width+'px',height:w.restore.height+'px'})}this.focusWindow(w)}
  keepInBounds(){for(const w of this.windows.values()){if(w.maximized)continue;w.element.style.left=Math.min(w.element.offsetLeft,Math.max(0,this.desktop.clientWidth-100))+'px';w.element.style.top=Math.min(w.element.offsetTop,Math.max(0,this.desktop.clientHeight-90))+'px'}}
  updateTitle(w,title){w.title=title;$('.window-title',w.element).textContent=title;this.renderTaskbar()}
  updateTerminalTitle(t){const w=this.windows.get(t.windowId);if(w)this.updateTitle(w,`${t.shell==='powershell'?'PowerShell':t.shell==='cmd'?'Eingabeaufforderung':t.shell} · ${this.os.label}`)}
  openTerminal(){
    const w=this.makeWindow('terminal',`${this.os.shell==='cmd'?'Eingabeaufforderung':this.os.shell==='powershell'?'PowerShell':this.os.shell} · ${this.os.label}`,'terminal',{width:760,height:490});
    const t={windowId:w.id,os:this.currentOS,shell:this.os.shell,cwd:joinPath(homePath(this.currentOS),'Projects'),sqlMode:false,history:[],historyIndex:0,admin:false};w.terminal=t;
    w.content.className='window-content terminal-content';w.content.innerHTML=`<div class="terminal-toolbar"><span class="terminal-connection"><span class="dot-live"></span> ${escapeHTML(this.os.label)} <span class="muted">/ ${escapeHTML(this.os.shell)}</span></span><div><button type="button" data-terminal-new title="Weiteres Terminal">${svg('plus',15)} <span>Neues Fenster</span></button><button type="button" data-terminal-stop title="Python-Ausführung unterbrechen">Stop Python</button><button type="button" data-terminal-clear>Leeren</button></div></div><div class="terminal-scroll" tabindex="0" aria-label="Terminal-Ausgabe"><div class="terminal-lines"></div><form class="terminal-input-row" autocomplete="off"><label class="terminal-prompt"></label><input class="terminal-input" aria-label="Befehl eingeben" autocapitalize="off" spellcheck="false" autocorrect="off"><button class="terminal-run" aria-label="Befehl ausführen" type="submit">↵</button></form></div><div class="terminal-foot">↑↓ Verlauf <span>·</span> Tab vervollständigen <span>·</span> Ctrl+L leeren <span>·</span> <strong>help</strong> zeigt alle Befehle</div>`;
    const input=$('.terminal-input',w.content),form=$('.terminal-input-row',w.content),lines=$('.terminal-lines',w.content),scroll=$('.terminal-scroll',w.content),lab=$('.terminal-prompt',w.content);
    const sync=()=>{lab.textContent=promptFor(t);scroll.scrollTop=scroll.scrollHeight;};
    const append=(value,kind='normal')=>{if(!value)return;const p=document.createElement('pre');p.className='terminal-line '+kind;p.textContent=String(value).slice(0,50000);lines.append(p);scroll.scrollTop=scroll.scrollHeight;};
    append(`DesktopSim · ${this.os.label} · ${t.shell}\nDies ist eine Browser-Simulation, keine echte Betriebssystem-Shell.\nTippe "help" für unterstützte Befehle.`, 'intro');sync();
    form.addEventListener('submit',async e=>{e.preventDefault();if(input.disabled)return;const cmd=input.value;const executed=promptFor(t);input.value='';if(!cmd.trim()){sync();return}t.history.push(cmd);t.historyIndex=t.history.length;append(executed+' '+cmd,'command');input.disabled=true;const working=document.createElement('pre');working.className='terminal-line processing';working.textContent='Befehl wird verarbeitet …';lines.append(working);scroll.scrollTop=scroll.scrollHeight;
      try{const result=await this.termEngine.execute(cmd,t);working.remove();if(result==='__CLEAR__')lines.innerHTML='';else append(result,'output');this.notifyFiles()}catch(err){working.remove();append('Fehler: '+err.message,'error')}finally{input.disabled=false;sync();input.focus()}
    });
    input.addEventListener('keydown',e=>{if(e.key==='ArrowUp'){e.preventDefault();if(t.history.length){t.historyIndex=Math.max(0,t.historyIndex-1);input.value=t.history[t.historyIndex]||''}}if(e.key==='ArrowDown'){e.preventDefault();t.historyIndex=Math.min(t.history.length,t.historyIndex+1);input.value=t.history[t.historyIndex]||''}if(e.key==='Tab'){e.preventDefault();const options=this.termEngine.completions(input.value,t);if(options.length===1)input.value=input.value.replace(/[^\s]*$/,options[0]);else if(options.length>1)append(options.slice(0,20).join('  '),'muted')}if(e.ctrlKey&&e.key.toLowerCase()==='l'){e.preventDefault();lines.innerHTML=''}});
    $('[data-terminal-new]',w.content).addEventListener('click',()=>this.openTerminal());
    $('[data-terminal-clear]',w.content).addEventListener('click',()=>{lines.innerHTML='';input.focus()});
    $('[data-terminal-stop]',w.content).addEventListener('click',()=>{this.python.terminate();this.toast('Python-Worker gestoppt')});
    scroll.addEventListener('click',e=>{if(!e.target.closest('button'))input.focus()});setTimeout(()=>input.focus(),50);return w;
  }
  openFiles(initial){
    const w=this.makeWindow('files',`Dateimanager · ${this.os.label}`,'folder',{width:780,height:490});const state={path:initial||homePath(this.currentOS),selected:null};
    w.content.className='window-content file-manager';
    const render=()=>{let items=[];try{items=this.fs.list(state.path)}catch{state.path=homePath(this.currentOS);items=this.fs.list(state.path)}
      const favorites=[['Home',homePath(this.currentOS)],['Desktop',joinPath(homePath(this.currentOS),'Desktop')],['Dokumente',joinPath(homePath(this.currentOS),'Documents')],['Projekte',joinPath(homePath(this.currentOS),'Projects')],['Root', '/']];
      w.content.innerHTML=`<div class="file-toolbar"><button data-file-nav="up" title="Übergeordneter Ordner">←</button><button data-file-nav="home" title="Home">${svg('home',16)}</button><input class="file-address" aria-label="Dateipfad" value="${escapeHTML(pathDisplay(this.currentOS,state.path))}"><button data-file-nav="go">Öffnen</button><button data-file-op="folder">+ Ordner</button><button data-file-op="new">+ Datei</button></div><div class="file-main"><aside class="file-sidebar"><strong>Orte</strong>${favorites.map(([name,path])=>`<button data-go="${escapeHTML(path)}" class="${path===state.path?'selected':''}">${svg(path==='/'?'server':'folder',16)}${escapeHTML(name)}</button>`).join('')}</aside><div class="file-body"><div class="file-column-head"><span>Name</span><span>Typ</span><span>Größe</span></div><div class="file-rows">${items.map(item=>`<button type="button" class="file-row ${state.selected===item.name?'selected':''}" data-entry="${escapeHTML(item.name)}" data-entry-type="${item.type}"><span>${svg(item.type==='dir'?'folder':'file',22)}${escapeHTML(item.name)}</span><span>${item.type==='dir'?'Ordner':extName(item.name).toUpperCase()+'-Datei'}</span><span>${item.type==='dir'?'–':item.size+' B'}</span></button>`).join('')||'<div class="file-empty">Dieser Ordner ist leer.</div>'}</div></div></div><div class="file-status"><span>${items.length} Element(e) · ${escapeHTML(pathDisplay(this.currentOS,state.path))}</span><div><button data-file-op="edit">Öffnen</button><button data-file-op="delete">Löschen</button><button data-file-op="download">Download</button></div></div>`;
      const nav=v=>{state.path=this.fs.normalize(v,state.path);state.selected=null;render()};
      w.content.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.go)));
      w.content.querySelectorAll('[data-entry]').forEach(b=>{b.addEventListener('click',()=>{state.selected=b.dataset.entry;w.content.querySelectorAll('.file-row').forEach(r=>r.classList.toggle('selected',r===b))});b.addEventListener('dblclick',()=>{if(b.dataset.entryType==='dir')nav(joinPath(state.path,b.dataset.entry));else this.openEditor(b.dataset.entry,state.path)})});
      w.content.querySelectorAll('[data-file-nav]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.fileNav;if(a==='up')nav('..');else if(a==='home')nav(homePath(this.currentOS));else nav($('.file-address',w.content).value)}));
      $('.file-address',w.content).addEventListener('keydown',e=>{if(e.key==='Enter')nav(e.target.value)});
      w.content.querySelectorAll('[data-file-op]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.fileOp;try{if(a==='folder'){const n=prompt('Ordnername:');if(n)this.fs.mkdir(joinPath(state.path,n))}if(a==='new'){const n=prompt('Dateiname (z. B. test.py):');if(n)this.fs.write(joinPath(state.path,n),'')}if(a==='edit'){if(!state.selected)return this.toast('Bitte Datei auswählen');const target=joinPath(state.path,state.selected);if(this.fs.locate(target)?.type==='dir')return nav(target);this.openEditor(target)}if(a==='delete'){if(!state.selected)return this.toast('Bitte Eintrag auswählen');if(confirm(`${state.selected} wirklich löschen?`)){this.fs.remove(joinPath(state.path,state.selected),null,true);state.selected=null}}if(a==='download'){if(!state.selected)return this.toast('Bitte Datei auswählen');this.downloadText(state.selected,this.fs.read(joinPath(state.path,state.selected)))}render();this.notifyFiles()}catch(e){this.toast(e.message)}}));
    };w.refresh=render;render();return w;
  }
  openEditor(file='hello.py',cwd=joinPath(homePath(this.currentOS),'Projects')){
    const full=this.fs.normalize(file,cwd);const w=this.makeWindow('editor',`Editor · ${full.split('/').pop()}`,'code',{width:780,height:560});const ext=extName(full);
    let code='';try{code=this.fs.read(full)}catch{code=ext==='py'?'print("Hallo Welt!")\n':ext==='html'?'<!doctype html>\n<h1>Hallo Welt!</h1>\n':''}
    w.content.className='window-content editor-content';
    w.content.innerHTML=`<div class="editor-toolbar"><span class="editor-filename">${svg('file',17)} <span>${escapeHTML(pathDisplay(this.currentOS,full))}</span></span><div><button type="button" data-editor="save">${svg('save',16)} Speichern</button><button type="button" data-editor="run" class="accent-action">${svg('play',16)} ${ext==='html'?'Vorschau':'Ausführen'}</button></div></div><div class="editor-layout"><div class="editor-input-wrap"><div class="editor-language">${escapeHTML(ext.toUpperCase())} <span>UTF-8 · DesktopSim</span></div><textarea class="editor-text" spellcheck="false" aria-label="Quelltext bearbeiten"></textarea></div><div class="editor-output"><div class="editor-output-title">AUSGABE <button type="button" data-editor="clear">Leeren</button></div><pre class="editor-result">Datei ändern und „Ausführen“ wählen.\nPython nutzt Pyodide (Internet beim ersten Start).\nJava / C# / PHP: Ausgaben-Demo.</pre></div></div>`;
    const area=$('.editor-text',w.content),out=$('.editor-result',w.content);area.value=code;
    const save=()=>{this.fs.write(full,area.value);this.notifyFiles();this.toast('Gespeichert: '+full.split('/').pop())};
    w.content.querySelectorAll('[data-editor]').forEach(b=>b.addEventListener('click',async()=>{const action=b.dataset.editor;if(action==='clear')return out.textContent='';if(action==='save'){try{save()}catch(e){out.textContent=e.message}return;}if(action==='run'){b.disabled=true;out.textContent='Wird ausgeführt …';try{if(ext==='html'||ext==='htm'){this.openBrowser(full,null,area.value);out.textContent='HTML-Vorschau im Browserfenster geöffnet (Sandbox).'}else if(ext==='py'){out.textContent=await this.termEngine.runPython(area.value)}else if(ext==='sql'){const data=this.db.run(area.value);out.textContent=data.message+(data.columns.length?'\n'+data.columns.join(' | ')+'\n'+data.rows.map(r=>data.columns.map(c=>r[c]).join(' | ')).join('\n'):'')}else if(['java','cs','php'].includes(ext)){const res=simulateCompiled(ext==='cs'?'cs':ext,area.value);out.textContent=res.output+'\n\n'+res.detail}else out.textContent='Für diesen Dateityp gibt es keinen Ausführungsmodus. Speichern und im Dateimanager öffnen.';}catch(e){out.textContent='Fehler: '+e.message}finally{b.disabled=false}}}));
    area.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();try{save()}catch(err){out.textContent=err.message}}if(e.key==='Tab'){e.preventDefault();const s=area.selectionStart;area.setRangeText('  ',s,area.selectionEnd,'end')}});return w;
  }
  openBrowser(path,base,customHTML){
    const w=this.makeWindow('browser','Browser · localhost','browser',{width:780,height:560});w.content.className='window-content browser-content';
    w.content.innerHTML=`<div class="browser-toolbar"><button data-browser="back" aria-label="Startseite">⌂</button><button data-browser="refresh" aria-label="Neu laden">↻</button><input class="browser-address" aria-label="Adresse" spellcheck="false" value="${escapeHTML(path||'http://localhost:8000')}"><button data-browser="go">Öffnen →</button></div><div class="browser-area"></div><div class="browser-status">Virtueller Browser · keine realen externen Aufrufe · HTML läuft in einer Sandbox</div>`;
    const addr=$('.browser-address',w.content),view=$('.browser-area',w.content);
    const landing=`<div class="browser-welcome"><div class="welcome-globe">${svg('browser',48)}</div><h2>Dein lokaler Webbrowser</h2><p>HTML-Dateien aus dem virtuellen Dateisystem anzeigen oder einen simulierten localhost-Server besuchen.</p><code>python -m http.server 8000</code><p>Öffne danach <strong>http://localhost:8000</strong>. Alternativ <strong>index.html</strong> direkt als Datei aufrufen.</p><button data-sample="open">Beispiel-Webseite öffnen</button></div>`;
    const navigate=()=>{
      const target=addr.value.trim();view.innerHTML='';let html=null;
      if(customHTML!==undefined){html=customHTML;customHTML=undefined}
      else if(target.startsWith('about:')||!target){view.innerHTML=landing;view.querySelector('[data-sample]')?.addEventListener('click',()=>{addr.value='index.html';navigate()});return;}
      else if(/^(https?:\/\/)?(localhost|127\.0\.0\.1)/i.test(target)){
        const m=target.match(/^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?::(\d+))?(\/[^?#]*)?/i);const port=m?.[1]||'8000',sv=this.servers.get(port);
        if(!sv){view.innerHTML=`<div class="browser-error"><h2>Verbindung abgelehnt</h2><p>Auf localhost:${escapeHTML(port)} läuft kein virtueller Server.</p><code>python -m http.server ${escapeHTML(port)}</code></div>`;return;}
        try{html=this.fs.read(joinPath(sv.cwd,m?.[2]?.slice(1)||'index.html'))}catch(e){view.innerHTML='<div class="browser-error"><h2>404 – Datei nicht gefunden</h2><p>'+escapeHTML(e.message)+'</p></div>';return;}
      }else{
        try{html=this.fs.read(target,base||joinPath(homePath(this.currentOS),'Projects'))}catch(e){view.innerHTML=`<div class="browser-error"><h2>Adresse nicht verfügbar</h2><p>Externe Webseiten werden aus Sicherheitsgründen nicht geöffnet. Nutze <code>localhost:8000</code> oder eine virtuelle HTML-Datei.</p><small>${escapeHTML(e.message)}</small></div>`;return;}
      }
      // allow-scripts erlaubt lokales HTML/JS; ohne allow-same-origin ist ein Zugriff auf DesktopSim ausgeschlossen.
      const iframe=document.createElement('iframe');iframe.setAttribute('sandbox','allow-scripts');iframe.title='HTML-Vorschau in isolierter Sandbox';iframe.referrerPolicy='no-referrer';iframe.srcdoc=String(html).slice(0,300_000);view.append(iframe);
    };
    w.content.querySelectorAll('[data-browser]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.browser==='back')addr.value='about:home';navigate()}));addr.addEventListener('keydown',e=>{if(e.key==='Enter')navigate()});if(!path)addr.value='about:home';navigate();return w;
  }
  openSQL(){
    const w=this.makeWindow('sql','SQL Studio · virtuelles SQLite','database',{width:800,height:570});w.content.className='window-content sql-content';const presets=[['Alle Datensätze','SELECT * FROM schueler;'],['Filtern',"SELECT name, punkte FROM schueler WHERE klasse = '8a' ORDER BY punkte DESC;"],['Zählen','SELECT COUNT(*) AS anzahl FROM schueler;'],['Neue Tabelle','CREATE TABLE notizen (id INTEGER, text TEXT);']];
    w.content.innerHTML=`<div class="sql-heading"><div><strong>SQL Playground</strong><span>Browser-Datenbank · echter Datenzustand, begrenzter SQL-Dialekt</span></div><button class="accent-action" data-sql-run>${svg('play',16)} Abfrage starten</button></div><div class="sql-examples">${presets.map(([name,query],i)=>`<button data-sql-preset="${i}">${escapeHTML(name)}</button>`).join('')}</div><textarea class="sql-editor" aria-label="SQL-Abfrage" spellcheck="false">SELECT * FROM schueler;</textarea><div class="sql-result-meta">ERGEBNIS <span class="sql-message">Bereit</span></div><div class="sql-result"></div><div class="sql-footer">Unterstützt: SELECT · WHERE · AND · LIKE · ORDER BY · LIMIT · COUNT · INSERT · UPDATE · DELETE · CREATE/DROP TABLE</div>`;
    const edit=$('.sql-editor',w.content),result=$('.sql-result',w.content),message=$('.sql-message',w.content);
    w.content.querySelectorAll('[data-sql-preset]').forEach(b=>b.addEventListener('click',()=>edit.value=presets[+b.dataset.sqlPreset][1]));
    $('[data-sql-run]',w.content).addEventListener('click',()=>{try{const res=this.db.run(edit.value);message.textContent=res.message;if(!res.columns.length){result.innerHTML=`<div class="sql-empty">${escapeHTML(res.message)}</div>`;return}result.innerHTML=`<table><thead><tr>${res.columns.map(c=>`<th>${escapeHTML(c)}</th>`).join('')}</tr></thead><tbody>${res.rows.map(r=>`<tr>${res.columns.map(c=>`<td>${escapeHTML(r[c]===null?'NULL':r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>`}catch(e){message.textContent='Fehler';result.innerHTML=`<div class="sql-error">${escapeHTML(e.message)}</div>`}});
    $('[data-sql-run]',w.content).click();return w;
  }
  openGuide(){
    const w=this.makeWindow('guide',`Hilfe · ${this.os.label}`,'info',{width:780,height:570});w.content.className='window-content guide-content';
    const win=isWindows(this.currentOS);const commands=win?['dir','cd Projects','type hello.py','python hello.py','ipconfig','sqlite3 demo.db']:['ls -la','cd ~/Projects','cat hello.py','python3 hello.py','uname -a','sqlite3 demo.db'];
    w.content.innerHTML=`<div class="guide-intro"><div class="eyebrow">DESKTOPSIM / LERNMODUS</div><h2>Entdecke ${escapeHTML(this.os.label)}</h2><p>Eine interaktive Übungsumgebung für Desktop-Navigation, Kommandozeile, Dateisysteme und Programmierung.</p></div><div class="guide-sections"><article><h3>01 · Erste Befehle</h3><p>Klicke auf ein Beispiel, um ein neues Terminal mit dem eingegebenen Befehl zu öffnen.</p><div class="guide-chips">${commands.map(c=>`<button type="button" data-example="${escapeHTML(c)}"><code>${escapeHTML(c)}</code> ↗</button>`).join('')}</div></article><article><h3>02 · Dateien und Programme</h3><p>Im Dateimanager liegen unter <code>${escapeHTML(pathDisplay(this.currentOS,joinPath(homePath(this.currentOS),'Projects')))}</code> Beispiele für Python, Java, C#, PHP, HTML und SQL. Im Editor kannst du sie anpassen und ausprobieren.</p></article><article><h3>03 · Simulierter localhost</h3><p>Starte in der Konsole <code>${win?'python':'python3'} -m http.server 8000</code> und öffne im Browser <code>http://localhost:8000</code>. Es wird <strong>kein echter Server und kein echter Netzwerkport</strong> gestartet.</p></article><article><h3>04 · Was läuft wirklich?</h3><ul><li>Virtuelles Dateisystem: echte Bearbeitung von Simulationdateien mit Speicherung im Browser.</li><li>SQL: eigene kleine SQL-Lernengine mit Tabellen und dauerhaften Änderungen; kein vollständiges SQLite.</li><li>HTML/CSS/JavaScript: echte Darstellung/Ausführung in einem isolierten Vorschau-iframe.</li><li>Python: echte Ausführung über Pyodide/WebAssembly, sobald der externe Download gelingt; offline nur vereinfachte Demo.</li><li>Java, C# und PHP: <strong>Ausgaben-Simulation</strong> (kein JVM-, .NET- oder PHP-Interpreter).</li><li>System-, Netzwerk- und Paketmanagerbefehle: sichere Beispiele, keine echten OS-Aktionen.</li></ul></article><article><h3>05 · Terminal-Referenz</h3><pre>${escapeHTML(shellHelp(this.currentOS))}</pre></article><article><h3>06 · Tastatur und Datenschutz</h3><p>↑ / ↓ = Verlauf · Tab = Vervollständigung · Ctrl+L = Terminal leeren · Ctrl+S = Editor speichern · Ctrl+Alt+T = neues Terminal.</p><p>Daten liegen ausschließlich im <code>localStorage</code> dieses Browsers und sind pro Betriebssystem getrennt. Import/Export ist über JSON möglich. GitHub Pages benötigt keinen Servercode.</p></article></div>`;
    w.content.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>this.openTerminalWithCommand(b.dataset.example)));return w;
  }
  openTerminalWithCommand(command){const w=this.openTerminal();const input=$('.terminal-input',w.content);input.value=command;input.focus()}
  notifyFiles(){for(const w of this.windows.values())if(w.kind==='files')w.refresh?.()}
  downloadText(name,content,type='text/plain'){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  exportFiles(){this.downloadText(`DesktopSim-${this.currentOS}-Backup.json`,JSON.stringify(this.fs.export(),null,2),'application/json');this.toast('JSON-Backup vorbereitet')}
}

new DesktopSim();
