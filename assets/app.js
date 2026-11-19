// DesktopSim – Kern: Startseite, Bootvorgang, Fenstermanager, Desktop und App-Verwaltung.
import {OS_LIST,getOS,isWindows,VFS,homePath,pathDisplay,joinPath,extName,trashPath} from './vfs.js';
import {MiniSQL} from './runtimes.js';
import {GitLearningRepo} from './git.js';
import {TerminalEngine} from './terminal.js';
import {gitCommand} from './shell/programs.js';
import {Runtimes} from './runtime/index.js';
import {DeviceManager} from './apps/tk-app.js';
import {profileFor} from './ui/profiles.js';
import {appIcon,fileIcon,folderIcon,lineIcon,osMark} from './ui/icons.js';
import {Chrome} from './ui/chrome.js';
import {ClassicApps,escapeHTML} from './apps/classic.js';
import {TerminalApp} from './apps/terminal-app.js';
import {FilesApp} from './apps/files-app.js';
import {EditorApps} from './apps/editor-app.js';
import {BrowserApp} from './apps/browser-app.js';
import {SystemApps} from './apps/system-apps.js';
import {IDEApp} from './apps/ide-app.js';
import {WebApps} from './apps/web-apps.js';

export const $=(s,root=document)=>root.querySelector(s);
export const $$=(s,root=document)=>[...root.querySelectorAll(s)];
export const esc=escapeHTML;
const LEGACY_ICONS={python:'ide',branch:'git',sparkle:'fun',game:'game',structure:'structogram',code:'ide',folder:'files',terminal:'terminal',browser:'browser',database:'sql',info:'guide',file:'editor'};
export const APPS=['terminal','files','editor','ide','browser','settings','taskmgr','calc','git','structogram','game','fun','sql','guide','about','trash','computer','docs','home'];
const EXTRA_LABELS={mindmap:'Gruppen-Mindmap',dslab:'DatastructureLab',mdgen:'Markdown Generator',papermaker:'Paper-Maker',git:'Git Graph',structogram:'Struktogramm',game:'OS-Spiel',fun:'Fun Lab',sql:'SQL Studio',guide:'Anleitung',home:'Persönlicher Ordner'};

class DesktopSim{
  constructor(){
    this.desktop=$('#desktop');this.layer=$('#window-layer');this.windows=new Map();this.serial=0;this.z=10;
    this.servers=new Map();this.runtimes=new Runtimes();this.devices=new DeviceManager(this);this.currentOS=null;this.fs=null;this.db=null;this.git=null;this.konami=[];
    this.termEngine=new TerminalEngine(this);this.chrome=new Chrome(this);this.workspace=1;
    this.global=this.loadJSON('desktopsim-v3-global',{quickBoot:false,lastOS:null});
    this.bindGlobal();this.renderLanding();
    const hash=location.hash.match(/os=(\w+)/)?.[1];
    if(hash&&OS_LIST.some(o=>o.id===hash))this.start(hash,{fromHash:true});else this.showLanding();
    setInterval(()=>this.tick(),1000*15);
  }
  // ---------- Speicher ----------
  loadJSON(key,fallback){try{return{...fallback,...(JSON.parse(localStorage.getItem(key))||{})}}catch{return{...fallback}}}
  saveJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
  get settings(){return this._settings||(this._settings=this.loadJSON('desktopsim-v3-settings-'+this.currentOS,{theme:null,wallpaper:0,accent:null,icons:{},firstBootDone:false,psPolicy:null,textScale:1}))}
  getSetting(k){return this.settings[k]}
  setSetting(k,v){this.settings[k]=v;this.saveJSON('desktopsim-v3-settings-'+this.currentOS,this.settings);this.applyAppearance()}
  get profile(){return profileFor(this.currentOS)}
  appName(id){return this.profile.names[id]||EXTRA_LABELS[id]||id}

  // ---------- Startseite ----------
  renderLanding(){
    const groups=[['Windows',['winxp','win7','win8','win10','win11']],['Linux',['debian','arch']],['Apple',['macos']],['Unix',['unix']]];
    $('#landing-os').innerHTML=groups.map(([label,ids])=>`<section class="lp-group"><h3>${label}</h3><div class="lp-cards">${ids.map(id=>{const o=getOS(id);return`<button class="lp-card" type="button" data-boot="${id}"><span class="lp-preview" data-os="${id}"><span class="lpp-wall"></span><span class="lpp-bar"></span><span class="lpp-win"><i></i></span><span class="lpp-mark">${osMark(id)}</span></span><span class="lp-card-body"><strong>${esc(o.label)}</strong><small>${esc(o.subtitle)}</small></span><span class="lp-year">${o.year}</span></button>`}).join('')}</div></section>`).join('');
    $('#landing-os').addEventListener('click',e=>{const b=e.target.closest('[data-boot]');if(b)this.start(b.dataset.boot)});
    $('#landing-continue').addEventListener('click',()=>this.start(this.global.lastOS||'win11'));
    $('#landing-quickboot').checked=Boolean(this.global.quickBoot);
    $('#landing-quickboot').addEventListener('change',e=>{this.global.quickBoot=e.target.checked;this.saveJSON('desktopsim-v3-global',this.global)});
  }
  showLanding(){
    document.body.classList.add('on-landing');$('#landing').hidden=false;$('#landing-close').hidden=!this.currentOS;
    const last=this.global.lastOS;const btn=$('#landing-continue');btn.hidden=!last;if(last)btn.querySelector('span').textContent=`Weiter mit ${getOS(last).label}`;
    $$('.lp-card').forEach(c=>c.classList.toggle('last',c.dataset.boot===last));
    history.replaceState(null,'',location.pathname+location.search);
  }
  hideLanding(){document.body.classList.remove('on-landing');$('#landing').hidden=true}

  // ---------- Betriebssystem starten ----------
  async start(id,opts={}){
    this.hideLanding();this.setOS(id);
    this.global.lastOS=id;this.saveJSON('desktopsim-v3-global',this.global);
    history.replaceState(null,'','#os='+id);
    await this.chrome.boot(id,{quick:this.global.quickBoot});
    await this.chrome.login(id,{quick:this.global.quickBoot});
    this.bootTime=Date.now();this.desktop.classList.add('ready');
    if(!this.settings.firstBootDone){this.setSetting('firstBootDone',true);setTimeout(()=>this.openGuide(),400);this.notify('Willkommen bei DesktopSim',`${getOS(id).label} ist bereit. Programme laufen echt im Browser – öffne ein Terminal und probiere „cd Projects“ und „${isWindows(id)?'python':'python3'} hello.py“.`,'guide')}
  }
  setOS(id){
    for(const w of [...this.windows.values()])this.destroyWindow(w);
    this.windows.clear();this.servers.clear();this.runtimes.stopAll();this.stopMatrix?.();this.stopConfetti?.();this.dismissByte?.();this.chrome.closeMenus();
    this.currentOS=id;this._settings=null;this.os=getOS(id);this.fs=new VFS(id);this.db=new MiniSQL(id);this.git=new GitLearningRepo(id);this.workspace=1;
    this.fs.onChange(()=>{clearTimeout(this.fsTimer);this.fsTimer=setTimeout(()=>this.notifyFiles(),60)});
    this.desktop.dataset.os=id;this.desktop.dataset.family=this.profile.family;this.desktop.className='desktop';
    document.documentElement.dataset.os=id;
    $('#header-status').textContent=`${this.os.label} · ${this.os.shell==='cmd'?'CMD':this.os.shell==='powershell'?'PowerShell':this.os.shell}`;
    this.applyAppearance();this.chrome.render();this.renderDesktopIcons();
  }
  applyAppearance(){
    const s=this.settings,d=this.desktop;if(!d)return;
    const dark=s.theme?s.theme==='dark':['win11','win10','debian','arch'].includes(this.currentOS)?false:false;
    d.dataset.theme=s.theme||'default';d.classList.toggle('theme-dark',Boolean(s.theme==='dark'));d.classList.toggle('theme-light',Boolean(s.theme==='light'));
    d.dataset.wallpaper=String(s.wallpaper||0);
    if(s.accent)d.style.setProperty('--accent',s.accent);else d.style.removeProperty('--accent');
    d.style.setProperty('--ui-scale',String(s.textScale||1));
    void dark;
  }

  // ---------- Globale Bedienung ----------
  bindGlobal(){
    $('#change-os').addEventListener('click',()=>this.showLanding());
    $('#guide-button').addEventListener('click',()=>this.currentOS?this.openGuide():this.showLanding());
    $('#fullscreen-button').addEventListener('click',()=>this.toggleFullscreen());
    $('#landing-close')?.addEventListener('click',()=>{if(this.currentOS)this.hideLanding()});
    $('#import-input').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{this.fs.import(JSON.parse(await f.text()));this.notify('Import','Dateisystem importiert.','files');this.notifyFiles();this.renderDesktopIcons()}catch(err){this.notify('Import fehlgeschlagen',err.message,'about')}e.target.value=''});
    document.addEventListener('fullscreenchange',()=>document.body.classList.toggle('kiosk',Boolean(document.fullscreenElement)));
    document.addEventListener('keydown',e=>{
      if(!this.currentOS||document.body.classList.contains('on-landing'))return;
      if(e.key==='Escape'){this.stopMatrix?.();if(this.chrome.closeMenus()||this.chrome.exitOverview())e.preventDefault();return}
      const k=e.key.toLowerCase();
      if(e.ctrlKey&&e.altKey&&k==='t'){e.preventDefault();this.launch('terminal');return}
      if(e.ctrlKey&&e.shiftKey&&k==='escape'){e.preventDefault();this.launch('taskmgr');return}
      if(e.ctrlKey&&!e.altKey&&!e.shiftKey&&k==='escape'){e.preventDefault();this.chrome.toggleLauncher();return}
      if(e.ctrlKey&&k===' '&&this.currentOS==='macos'){e.preventDefault();this.chrome.spotlight();return}
      if(e.ctrlKey&&e.altKey&&k==='d'){e.preventDefault();this.showDesktop();return}
      if(e.ctrlKey&&e.altKey&&k==='o'){e.preventDefault();this.chrome.toggleOverview();return}
      const seq=['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];this.konami=[...this.konami,k].slice(-10);if(seq.every((x,i)=>this.konami[i]===x)){this.konami=[];this.launchConfetti?.();this.toast('Konami! Party-Modus aktiviert ✨')}
    });
    window.addEventListener('resize',()=>this.keepInBounds());
    // Matrix/Konfetti/Byte stammen aus classic.js und erwarten ein Toast-Fach.
  }
  toggleFullscreen(){const el=document.documentElement;if(document.fullscreenElement)document.exitFullscreen?.();else el.requestFullscreen?.().catch(()=>document.body.classList.toggle('kiosk'))}
  tick(){this.chrome.tickClock()}

  // ---------- Apps starten ----------
  launch(id,opts={}){
    this.chrome.closeMenus();
    switch(id){
      case'terminal':return this.openTerminal(opts.shell);case'files':return this.openFiles(opts.path);case'computer':return this.openFiles(isWindows(this.currentOS)?'/':'/');
      case'docs':return this.openFiles(joinPath(homePath(this.currentOS),'Documents'));case'home':return this.openFiles(homePath(this.currentOS));case'trash':return this.openFiles(trashPath(this.currentOS));
      case'editor':return this.openEditor(opts.path||'',opts.cwd);case'ide':return this.openIDE(opts.path||'',opts.cwd);case'browser':return this.openBrowser(opts.url);
      case'settings':return this.openSettings(opts.page);case'taskmgr':return this.openTaskManager();case'calc':return this.openCalculator();case'about':return this.openAbout();
      case'git':return this.openGitGraph();case'structogram':return this.openStructogram();case'game':return this.openGame();case'fun':return this.openFunLab();case'sql':return this.openSQL();case'guide':return this.openGuide();
      case'mindmap':case'dslab':case'mdgen':case'papermaker':return this.openWebApp(id);
      case'run':return this.openRunDialog();
      case'import':return $('#import-input').click();case'export':return this.exportFiles();
      case'reset':return this.resetData();
      case'lock':return this.power('lock');case'logout':return this.power('logout');case'shutdown':return this.power('shutdown');case'restart':return this.power('restart');case'sleep':return this.power('sleep');
    }
  }
  resetData(){this.confirmDialog(`Alle virtuellen Dateien, Datenbanken, Pakete und Git-Daten von ${this.os.label} zurücksetzen?`,'Zurücksetzen').then(ok=>{if(!ok)return;this.fs.reset();this.db.reset();this.git.reset();try{localStorage.removeItem('desktopsim-v3-pkgs-'+this.currentOS);localStorage.removeItem('desktopsim-v3-settings-'+this.currentOS)}catch{}this._settings=null;this.notifyFiles();this.renderDesktopIcons();this.applyAppearance();this.notify('Zurückgesetzt','Die virtuellen Daten wurden auf den Ausgangszustand gesetzt.','settings')})}
  /** Öffnet einen Pfad mit der passenden App (Doppelklick im Dateimanager, open/start im Terminal). */
  openPath(path,{editor=false}={}){
    const node=this.fs.locate(path);if(!node)return;
    if(node.type==='dir')return this.openFiles(path);
    const ext=extName(path);
    if(!editor&&(ext==='html'||ext==='htm'))return this.openBrowser('file://'+path);
    if(node.enc==='wasm'||(node.enc==='exe'&&!/\.(exe)$/i.test(path)))return this.openTerminal(null,{cwd:path.replace(/\/[^/]*$/,'')||'/',command:(isWindows(this.currentOS)?'':'./')+path.split('/').pop()});
    if(node.enc==='exe')return this.termEngine.programs.runFile(path,this.termEngine.context([path.split('/').pop()],{os:this.currentOS,shell:this.os.shell,cwd:'/',vars:{},aliases:{},history:[]},{out(){},err(){},readLine:async()=>null}));
    if(ext==='bat'||ext==='cmd'||ext==='ps1'||(ext==='sh'&&(node.mode&0o111)))return this.openTerminal(ext==='ps1'?'powershell':null,{cwd:path.replace(/\/[^/]*$/,'')||'/',command:(ext==='sh'?'./':ext==='ps1'?'.\\':'')+path.split('/').pop()});
    if(['py','js','mjs','java','c','cpp','php','cs','sql','json','md','css','h','sh','ps1','bat','cmd','pl','pro'].includes(ext)&&!editor)return this.openIDE(path);
    if(node.enc==='b64'&&/\.(png|jpe?g|gif|svg|webp)$/i.test(path))return this.openImage(path);
    return this.openEditor(path);
  }
  openImage(path){const node=this.fs.locate(path);const w=this.makeWindow('image',path.split('/').pop(),'editor',{width:620,height:480});w.content.className='window-content image-viewer';const mime=/\.png$/i.test(path)?'image/png':/\.svg$/i.test(path)?'image/svg+xml':'image/jpeg';w.content.innerHTML=`<img alt="${esc(path.split('/').pop())}" src="data:${mime};base64,${node.content}">`;return w}

  // ---------- Fenstermanager ----------
  workArea(){return{w:this.layer.clientWidth,h:this.layer.clientHeight}}
  makeWindow(kind,title,icon='editor',preferred={}){
    icon=LEGACY_ICONS[icon]||icon;
    const id=++this.serial,area=this.workArea();
    const width=Math.round(Math.min(preferred.width||760,Math.max(300,area.w-24)));
    const height=Math.round(Math.min(preferred.height||500,Math.max(240,area.h-24)));
    const visible=[...this.windows.values()].filter(w=>!w.minimized).length;
    const offset=(visible%8)*28;
    const left=Math.max(4,Math.min(Math.round((area.w-width)/2-90+offset),area.w-width-4));
    const top=Math.max(4,Math.min(Math.round((area.h-height)/2-50+offset),area.h-height-4));
    const el=document.createElement('section');el.className='sim-window opening';el.dataset.window=id;el.dataset.kind=kind;el.setAttribute('role','dialog');el.setAttribute('aria-label',title);
    el.style.cssText=`width:${width}px;height:${height}px;left:${left}px;top:${top}px;z-index:${++this.z}`;
    el.innerHTML=this.chrome.frame(title,icon)+'<div class="window-content"></div>'+['n','e','s','w','ne','nw','se','sw'].map(d=>`<div class="rh rh-${d}" data-rh="${d}"></div>`).join('');
    this.layer.append(el);
    const win={id,kind,title,icon,element:el,content:$('.window-content',el),titleSlot:$('.win-titleslot',el),minimized:false,maximized:false,snapped:null,restore:{left,top,width,height},workspace:this.workspace,modal:preferred.modal};
    this.windows.set(id,win);
    el.addEventListener('pointerdown',()=>this.focusWindow(win),true);
    $$('[data-wbtn]',el).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const a=b.dataset.wbtn;if(a==='close')this.closeWindowById(id);else if(a==='min')this.minimizeWindow(win);else if(a==='max')this.toggleMax(win);else if(a==='menu')this.chrome.windowMenu(win,b)}));
    if(this.profile.snap&&!preferred.noResize)$('[data-wbtn="max"]',el)?.addEventListener('mouseenter',()=>this.chrome.snapLayouts?.(win));
    this.attachDragging(win);if(!preferred.noResize)this.attachResizing(win);else el.classList.add('fixed-size');
    this.focusWindow(win);this.chrome.updateTasks();
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('opening')));
    return win;
  }
  attachDragging(win){
    const bar=$('.win-titlebar',win.element);let drag=null;
    bar.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.target.closest('button,input,select,a,.win-tab'))return;
      const el=win.element;const area=this.workArea();
      drag={x:e.clientX,y:e.clientY,left:el.offsetLeft,top:el.offsetTop,moved:false,area,fromMax:win.maximized||win.snapped};
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove',e=>{
      if(!drag)return;const el=win.element,dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(!drag.moved&&Math.hypot(dx,dy)<4)return;
      if(!drag.moved){drag.moved=true;el.classList.add('dragging');
        if(drag.fromMax){const ratio=(e.clientX-el.getBoundingClientRect().left)/el.offsetWidth;win.maximized=false;win.snapped=null;el.classList.remove('maximized','snapped');Object.assign(el.style,{width:win.restore.width+'px',height:win.restore.height+'px'});drag.left=e.clientX-this.layer.getBoundingClientRect().left-win.restore.width*ratio;drag.top=0;drag.x=e.clientX;drag.y=e.clientY;this.chrome.updateTasks()}}
      const left=drag.left+e.clientX-drag.x,top=Math.max(0,Math.min(drag.area.h-30,drag.top+e.clientY-drag.y));
      el.style.left=Math.max(-el.offsetWidth+80,Math.min(drag.area.w-80,left))+'px';el.style.top=top+'px';
      if(this.profile.snap){const r=this.layer.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;drag.snap=y<=2?'max':x<=4?'left':x>=r.width-5?'right':null;this.chrome.snapPreview(drag.snap)}
    });
    const end=()=>{if(!drag)return;win.element.classList.remove('dragging');if(drag.snap)this.snapWindow(win,drag.snap);this.chrome.snapPreview(null);drag=null};
    bar.addEventListener('pointerup',end);bar.addEventListener('pointercancel',end);
    bar.addEventListener('dblclick',e=>{if(e.target.closest('button,input,.win-tab'))return;if(this.currentOS==='macos'||!win.element.classList.contains('fixed-size'))this.toggleMax(win)});
  }
  attachResizing(win){
    const el=win.element;
    $$('[data-rh]',el).forEach(h=>{
      let s=null;
      h.addEventListener('pointerdown',e=>{if(e.button!==0||win.maximized)return;e.preventDefault();e.stopPropagation();h.setPointerCapture(e.pointerId);s={x:e.clientX,y:e.clientY,l:el.offsetLeft,t:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight,d:h.dataset.rh};win.snapped=null;el.classList.remove('snapped');el.classList.add('resizing')});
      h.addEventListener('pointermove',e=>{if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y,minW=300,minH=200;let{l,t,w,h:hh}=s;
        if(s.d.includes('e'))w=Math.max(minW,s.w+dx);if(s.d.includes('s'))hh=Math.max(minH,s.h+dy);
        if(s.d.includes('w')){w=Math.max(minW,s.w-dx);l=s.l+(s.w-w)}if(s.d.includes('n')){hh=Math.max(minH,s.h-dy);t=Math.max(0,s.t+(s.h-hh))}
        Object.assign(el.style,{left:l+'px',top:t+'px',width:w+'px',height:hh+'px'})});
      const end=()=>{if(s){s=null;el.classList.remove('resizing');win.restore={left:el.offsetLeft,top:el.offsetTop,width:el.offsetWidth,height:el.offsetHeight};win.onResize?.()}};
      h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
    });
  }
  snapWindow(win,where){
    const el=win.element;if(where==='max'){if(!win.maximized)this.toggleMax(win);return}
    if(!win.maximized&&!win.snapped)win.restore={left:el.offsetLeft,top:el.offsetTop,width:el.offsetWidth,height:el.offsetHeight};
    win.maximized=false;el.classList.remove('maximized');win.snapped=where;el.classList.add('snapped');
    const{w,h}=this.workArea();const quarter=where.length>5;
    Object.assign(el.style,{top:(where.includes('bottom')?h/2:0)+'px',left:(where.includes('right')?w/2:0)+'px',width:w/2+'px',height:(quarter?h/2:h)+'px'});
    this.focusWindow(win);this.chrome.updateTasks();setTimeout(()=>win.onResize?.(),220);
  }
  focusWindow(win){
    if(!win||!this.windows.has(win.id))return;
    win.element.style.zIndex=++this.z;
    for(const other of this.windows.values()){const active=other===win;other.element.classList.toggle('inactive',!active);other.element.classList.toggle('active',active)}
    this.activeWindow=win;this.chrome.onFocus(win);
  }
  destroyWindow(w){try{w.cleanup?.()}catch{}w.element.remove()}
  closeWindowById(id){
    const w=this.windows.get(+id);if(!w)return;
    if(w.beforeClose&&w.beforeClose()===false)return;
    this.windows.delete(+id);w.element.classList.add('closing');
    setTimeout(()=>this.destroyWindow(w),this.currentOS==='winxp'||this.currentOS==='unix'?0:160);
    const next=[...this.windows.values()].filter(x=>!x.minimized&&x.workspace===this.workspace).sort((a,b)=>b.element.style.zIndex-a.element.style.zIndex)[0];
    if(next)this.focusWindow(next);else{this.activeWindow=null;this.chrome.onFocus(null)}
    this.chrome.updateTasks();
  }
  minimizeWindow(w){
    const target=this.chrome.taskButtonRect?.(w);const el=w.element;
    if(target&&this.currentOS!=='winxp'&&this.currentOS!=='unix'){const r=el.getBoundingClientRect();el.style.setProperty('--min-x',`${target.left+target.width/2-(r.left+r.width/2)}px`);el.style.setProperty('--min-y',`${target.top+target.height/2-(r.top+r.height/2)}px`)}
    w.minimized=true;el.classList.add('minimized');
    const next=[...this.windows.values()].filter(x=>!x.minimized&&x!==w&&x.workspace===this.workspace).sort((a,b)=>b.element.style.zIndex-a.element.style.zIndex)[0];
    if(next)this.focusWindow(next);else{this.activeWindow=null;el.classList.add('inactive');this.chrome.onFocus(null)}
    this.chrome.updateTasks();
  }
  restoreWindow(w){w.minimized=false;w.element.classList.remove('minimized');if(w.workspace!==this.workspace)this.chrome.switchWorkspace?.(w.workspace);this.focusWindow(w);this.chrome.updateTasks()}
  toggleMax(w){
    const e=w.element;
    if(!w.maximized){if(!w.snapped)w.restore={left:e.offsetLeft,top:e.offsetTop,width:e.offsetWidth,height:e.offsetHeight};w.maximized=true;w.snapped=null;e.classList.remove('snapped');e.classList.add('maximized')}
    else{w.maximized=false;e.classList.remove('maximized');Object.assign(e.style,{left:w.restore.left+'px',top:w.restore.top+'px',width:w.restore.width+'px',height:w.restore.height+'px'})}
    this.focusWindow(w);this.chrome.updateTasks();setTimeout(()=>w.onResize?.(),220);
  }
  showDesktop(){const visible=[...this.windows.values()].filter(w=>!w.minimized);if(visible.length){this._shown=visible;visible.forEach(w=>{w.minimized=true;w.element.classList.add('minimized')})}else if(this._shown){this._shown.forEach(w=>{w.minimized=false;w.element.classList.remove('minimized')});this._shown=null}this.chrome.updateTasks()}
  keepInBounds(){const{w,h}=this.workArea();for(const win of this.windows.values()){if(win.maximized)continue;const el=win.element;if(win.snapped){this.snapWindow(win,win.snapped);continue}el.style.left=Math.min(el.offsetLeft,Math.max(0,w-120))+'px';el.style.top=Math.min(el.offsetTop,Math.max(0,h-60))+'px'}}
  updateTitle(w,title){w.title=title;const t=$('.win-title',w.element);if(t)t.textContent=title;w.element.setAttribute('aria-label',title);this.chrome.updateTasks();if(this.activeWindow===w)this.chrome.onFocus(w)}
  updateTerminalTitle(t){const w=this.windows.get(t.windowId);if(w&&w.setShellTitle)w.setShellTitle(t);else if(w)this.updateTitle(w,this.terminalTitle(t))}

  // ---------- Desktop-Symbole ----------
  desktopItems(){
    const items=this.profile.desktop.map(id=>({key:'app:'+id,app:id,label:this.appName(id),icon:id==='trash'?(this.trashFull()?'trash-full':'trash'):id}));
    const desk=joinPath(homePath(this.currentOS),'Desktop');
    if(this.profile.family!=='cde'){try{for(const e of this.fs.list(desk))if(!e.name.startsWith('.'))items.push({key:'file:'+e.name,path:joinPath(desk,e.name),label:e.name,type:e.type})}catch{}}
    return items;
  }
  trashFull(){try{return this.fs.list(trashPath(this.currentOS)).length>0}catch{return false}}
  renderDesktopIcons(){
    const box=$('#desktop-icons');const items=this.desktopItems();const fam=this.profile.family;const pos=this.settings.icons||{};
    const cell=fam==='mac'?{w:96,h:98}:fam==='windows'?{w:84,h:92}:{w:96,h:100};
    const rightAlign=fam==='mac';const area={h:Math.max(200,this.desktop.clientHeight-(fam==='windows'?60:fam==='mac'?110:fam==='kde'?70:60))};
    const rows=Math.max(1,Math.floor(area.h/cell.h));let auto=0;
    box.innerHTML=items.map(it=>{let p=pos[it.key];if(!p){p={col:Math.floor(auto/rows),row:auto%rows};auto++}else auto=Math.max(auto,0);const icon=it.app?(it.icon==='trash-full'?appIcon('trash'):(it.app==='files'||it.app==='docs'||it.app==='home'?folderIcon(fam==='windows'?'windows':fam):appIcon(it.app,fam))):it.type==='dir'?folderIcon(fam==='windows'?'windows':fam):fileIcon(it.label,fam);return`<button class="desk-icon" type="button" data-key="${esc(it.key)}" style="${rightAlign?'right':'left'}:${8+p.col*cell.w}px;top:${(fam==='windows'?6:fam==='mac'?8:10)+p.row*cell.h}px"><span class="desk-img">${icon}</span><span class="desk-label">${esc(it.label)}</span></button>`}).join('');
    this.desktopItemsCache=items;this.bindDesktopIcons(cell,rightAlign,rows);
  }
  bindDesktopIcons(cell,rightAlign){
    const box=$('#desktop-icons');const find=key=>this.desktopItemsCache.find(i=>i.key===key);
    const open=it=>{if(!it)return;if(it.app)this.launch(it.app);else this.openPath(it.path)};
    $$('.desk-icon',box).forEach(el=>{
      let drag=null,lastClick=0;
      el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.stopPropagation();if(!e.ctrlKey&&!el.classList.contains('selected'))$$('.desk-icon.selected',box).forEach(x=>x.classList.remove('selected'));el.classList.add('selected');drag={x:e.clientX,y:e.clientY,l:el.offsetLeft,t:el.offsetTop,moved:false};el.setPointerCapture(e.pointerId)});
      el.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;drag.moved=true;el.classList.add('dragging');el.style.left=drag.l+dx+'px';el.style.right='auto';el.style.top=drag.t+dy+'px'});
      el.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;el.classList.remove('dragging');
        if(d.moved){const target=document.elementsFromPoint(e.clientX,e.clientY).find(x=>x!==el&&x.classList?.contains('desk-icon'));const it=find(el.dataset.key);const tgt=target&&find(target.dataset.key);
          if(tgt&&it?.path&&(tgt.app==='trash')){this.fs.trash(it.path);this.renderDesktopIcons();this.notifyFiles();return}
          const col=Math.max(0,Math.round((rightAlign?(box.clientWidth-el.offsetLeft-el.offsetWidth-8):el.offsetLeft-8)/cell.w));const row=Math.max(0,Math.round((el.offsetTop-8)/cell.h));const icons={...(this.settings.icons||{})};for(const[k,v]of Object.entries(icons))if(v.col===col&&v.row===row&&k!==el.dataset.key)delete icons[k];icons[el.dataset.key]={col,row};this.setSetting('icons',icons);this.renderDesktopIcons();return}
        const now=Date.now();if(now-lastClick<450||matchMedia('(pointer: coarse)').matches){open(find(el.dataset.key));lastClick=0}else lastClick=now});
      el.addEventListener('keydown',e=>{if(e.key==='Enter')open(find(el.dataset.key));if(e.key==='Delete'){const it=find(el.dataset.key);if(it?.path){this.fs.trash(it.path);this.renderDesktopIcons()}}if(e.key==='F2')this.renameDesktopItem(find(el.dataset.key))});
      el.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();const it=find(el.dataset.key);$$('.desk-icon.selected',box).forEach(x=>x.classList.remove('selected'));el.classList.add('selected');
        const items=[{label:'Öffnen',bold:true,action:()=>open(it)}];
        if(it.app==='trash')items.push({label:'Papierkorb leeren',disabled:!this.trashFull(),action:()=>{this.fs.emptyTrash();this.renderDesktopIcons();this.notifyFiles()}});
        if(it.path){items.push({sep:true},{label:'Im Terminal öffnen',action:()=>this.openTerminal(null,{cwd:it.type==='dir'?it.path:it.path.replace(/\/[^/]*$/,'')})},{label:'Umbenennen',action:()=>this.renameDesktopItem(it)},{label:this.profile.family==='windows'?'Löschen':'In den Papierkorb verschieben',action:()=>{this.fs.trash(it.path);this.renderDesktopIcons();this.notifyFiles()}})}
        items.push({sep:true},{label:'Eigenschaften',action:()=>this.openProperties(it.path||null,it)});
        this.chrome.contextMenu(e.clientX,e.clientY,items)});
    });
  }
  async renameDesktopItem(it){if(!it?.path)return;const name=await this.promptDialog('Neuer Name:',it.label,'Umbenennen');if(!name||name===it.label)return;try{this.fs.move(it.path,joinPath(it.path.replace(/\/[^/]*$/,''),name));this.renderDesktopIcons();this.notifyFiles()}catch(e){this.notify('Fehler',e.message,'about')}}
  desktopContextMenu(x,y){
    const desk=joinPath(homePath(this.currentOS),'Desktop');const fam=this.profile.family;
    const create=async kind=>{const base=kind==='dir'?(fam==='windows'?'Neuer Ordner':fam==='mac'?'Neuer Ordner':'Neuer Ordner'):(fam==='windows'?'Neues Textdokument.txt':'Neue Datei.txt');let name=base,i=2;while(this.fs.exists(joinPath(desk,name)))name=kind==='dir'?`${base} (${i++})`:base.replace(/(\.txt)$/,` (${i++})$1`);if(kind==='dir')this.fs.mkdir(joinPath(desk,name));else this.fs.write(joinPath(desk,name),'');this.renderDesktopIcons();const it=this.desktopItemsCache.find(x=>x.label===name);setTimeout(()=>this.renameDesktopItem(it),50)};
    const sortIcons=()=>{this.setSetting('icons',{});this.renderDesktopIcons()};
    const menus={
      windows:[{label:'Ansicht',submenu:[{label:'Große Symbole',action:()=>this.desktop.dataset.iconSize='large'},{label:'Mittelgroße Symbole',action:()=>this.desktop.dataset.iconSize='medium'},{label:'Kleine Symbole',action:()=>this.desktop.dataset.iconSize='small'},{sep:true},{label:'Symbole automatisch anordnen',action:sortIcons}]},{label:'Sortieren nach',submenu:[{label:'Name',action:sortIcons},{label:'Größe',action:sortIcons},{label:'Elementtyp',action:sortIcons},{label:'Änderungsdatum',action:sortIcons}]},{label:'Aktualisieren',action:()=>this.renderDesktopIcons()},{sep:true},{label:'Einfügen',disabled:!this.clipboard,action:()=>this.pasteInto(desk)},{sep:true},{label:'Neu',submenu:[{label:'Ordner',icon:'folderPlus',action:()=>create('dir')},{label:'Textdokument',icon:'filePlus',action:()=>create('file')}]},{sep:true},{label:this.currentOS==='winxp'?'Eigenschaften':'Anzeigeeinstellungen',action:()=>this.openSettings('display')},{label:'Anpassen',action:()=>this.openSettings('personalize')},...(['win10','win11'].includes(this.currentOS)?[{sep:true},{label:'Im Terminal öffnen',action:()=>this.openTerminal(null,{cwd:desk})}]:[])],
      gnome:[{label:'Neuer Ordner',action:()=>create('dir')},{label:'Neues Dokument',action:()=>create('file')},{sep:true},{label:'Einfügen',disabled:!this.clipboard,action:()=>this.pasteInto(desk)},{sep:true},{label:'Schreibtisch im Dateimanager öffnen',action:()=>this.openFiles(desk)},{label:'Im Terminal öffnen',action:()=>this.openTerminal(null,{cwd:desk})},{sep:true},{label:'Hintergrund ändern …',action:()=>this.openSettings('personalize')},{label:'Bildschirmeinstellungen',action:()=>this.openSettings('display')}],
      kde:[{label:'Neu erstellen',submenu:[{label:'Ordner …',action:()=>create('dir')},{label:'Textdatei …',action:()=>create('file')}]},{label:'Einfügen',disabled:!this.clipboard,action:()=>this.pasteInto(desk)},{sep:true},{label:'Konsole hier öffnen',action:()=>this.openTerminal(null,{cwd:desk})},{label:'Symbole anordnen',action:sortIcons},{sep:true},{label:'Plasma-Arbeitsfläche einrichten …',action:()=>this.openSettings('personalize')},{label:'Bildschirmeinstellungen',action:()=>this.openSettings('display')}],
      mac:[{label:'Neuer Ordner',action:()=>create('dir')},{sep:true},{label:'Informationen',action:()=>this.openProperties(desk)},{label:'Einfügen',disabled:!this.clipboard,action:()=>this.pasteInto(desk)},{sep:true},{label:'Schreibtischhintergrund ändern …',action:()=>this.openSettings('personalize')},{label:'Aufräumen',action:sortIcons},{label:'Darstellungsoptionen einblenden',action:()=>this.openSettings('display')}],
      cde:[{label:'Arbeitsbereichsmenü',header:true},{label:'Programme',submenu:['terminal','files','editor','ide','browser','calc','git','structogram','game','sql'].map(id=>({label:this.appName(id),action:()=>this.launch(id)}))},{sep:true},{label:'Terminal …',action:()=>this.launch('terminal')},{label:'Dateimanager …',action:()=>this.launch('files')},{label:'Stilmanager …',action:()=>this.launch('settings')},{sep:true},{label:'Arbeitsbereiche aufräumen',action:()=>this.showDesktop()},{label:'Bildschirm sperren',action:()=>this.power('lock')},{label:'Abmelden …',action:()=>this.power('logout')}]
    };
    this.chrome.contextMenu(x,y,menus[fam]||menus.windows);
  }
  pasteInto(dir){const c=this.clipboard;if(!c)return;for(const p of c.paths){try{const name=p.split('/').pop();let target=joinPath(dir,name),i=2;while(this.fs.exists(target)&&c.mode==='copy')target=joinPath(dir,name.replace(/(\.[^.]*)?$/,` - Kopie${i>2?' ('+(i-1)+')':''}$1`)),i++;if(c.mode==='cut')this.fs.move(p,target);else this.fs.copy(p,target,null,true)}catch(e){this.notify('Einfügen fehlgeschlagen',e.message,'files')}}if(c.mode==='cut')this.clipboard=null;this.notifyFiles();this.renderDesktopIcons()}

  // ---------- Dialoge & Benachrichtigungen ----------
  notify(title,body='',icon='about'){this.chrome.notify(title,body,icon)}
  toast(message){this.chrome.notify(this.os?.label||'DesktopSim',message,'about')}
  dialog({title,message,input=null,buttons=[['OK',true]],icon='about'}){
    return new Promise(resolve=>{
      const w=this.makeWindow('dialog',title,icon,{width:420,height:input!==null?200:180,noResize:true,modal:true});w.element.classList.add('dialog-window');
      w.content.className='window-content dialog-content';
      w.content.innerHTML=`<div class="dlg-body"><span class="dlg-icon">${appIcon(icon,this.profile.family)}</span><div class="dlg-text"><p>${esc(message)}</p>${input!==null?`<input class="dlg-input" value="${esc(input)}">`:''}</div></div><div class="dlg-buttons">${buttons.map(([label,val],i)=>`<button type="button" data-i="${i}" class="${i===0?'primary':''}">${esc(label)}</button>`).join('')}</div>`;
      let done=false;const finish=v=>{if(done)return;done=true;this.closeWindowById(w.id);resolve(v)};
      w.beforeClose=()=>{if(!done){done=true;resolve(input!==null?null:false)}return true};
      $$('[data-i]',w.content).forEach(b=>b.addEventListener('click',()=>{const val=buttons[+b.dataset.i][1];finish(val===true&&input!==null?$('.dlg-input',w.content).value:val)}));
      const inp=$('.dlg-input',w.content);if(inp){setTimeout(()=>{inp.focus();inp.select()},60);inp.addEventListener('keydown',e=>{if(e.key==='Enter')finish(inp.value);if(e.key==='Escape')finish(null)})}else setTimeout(()=>$('[data-i="0"]',w.content)?.focus(),60);
    });
  }
  promptDialog(message,value='',title='Eingabe'){return this.dialog({title,message,input:value,buttons:[['OK',true],['Abbrechen',null]]})}
  confirmDialog(message,okLabel='OK'){return this.dialog({title:this.os?.label||'DesktopSim',message,buttons:[[okLabel,true],['Abbrechen',false]],icon:'about'})}
  openProperties(path,item){
    const fs=this.fs;const name=path?path.split('/').pop()||'/':item?.label;const st=path?fs.stat(path):null;
    const w=this.makeWindow('properties',`Eigenschaften von ${name}`,'about',{width:380,height:420,noResize:true});w.content.className='window-content props-content';
    const size=st?.type==='dir'?(()=>{let n=0,c=0;const walk=p=>{for(const e of fs.list(p)){if(e.type==='dir')walk(joinPath(p,e.name));else{n+=e.size;c++}}};try{walk(path)}catch{}return`${n.toLocaleString('de-DE')} Bytes (${c} Dateien)`})():st?`${st.size.toLocaleString('de-DE')} Bytes`:'—';
    w.content.innerHTML=`<div class="props-head"><span>${path?(st.type==='dir'?folderIcon(this.profile.family==='windows'?'windows':this.profile.family):fileIcon(name)):appIcon(item?.app||'about')}</span><strong>${esc(name)}</strong></div><dl class="props-grid"><dt>Typ:</dt><dd>${path?(st.type==='dir'?'Dateiordner':(extName(name).toUpperCase()||'Datei')+'-Datei'):'Verknüpfung'}</dd><dt>Ort:</dt><dd>${esc(path?pathDisplay(this.currentOS,path.replace(/\/[^/]*$/,'')||'/'):'Desktop')}</dd><dt>Größe:</dt><dd>${esc(size)}</dd>${st?`<dt>Geändert:</dt><dd>${new Date(st.mtime).toLocaleString('de-DE')}</dd>${isWindows(this.currentOS)?'':`<dt>Rechte:</dt><dd><code>${(st.mode).toString(8).padStart(4,'0')}</code></dd>`}`:''}</dl><div class="dlg-buttons"><button class="primary" data-ok>OK</button></div>`;
    $('[data-ok]',w.content).addEventListener('click',()=>this.closeWindowById(w.id));return w;
  }

  // ---------- Energie ----------
  async power(action){
    this.chrome.closeMenus();
    if(action==='lock'){await this.chrome.login(this.currentOS,{lock:true});return}
    if(action==='sleep'){await this.chrome.sleep();return}
    for(const w of [...this.windows.values()])this.destroyWindow(w);this.windows.clear();this.chrome.updateTasks();this.servers.clear();this.runtimes.stopAll();
    if(action==='logout'){await this.chrome.shutdownScreen(this.currentOS,'logout');await this.chrome.login(this.currentOS,{});return}
    await this.chrome.shutdownScreen(this.currentOS,action);
    if(action==='restart'){await this.chrome.boot(this.currentOS,{quick:this.global.quickBoot});await this.chrome.login(this.currentOS,{});this.bootTime=Date.now();return}
    this.desktop.classList.remove('ready');this.showLanding();
  }

  // ---------- Hilfen ----------
  notifyFiles(){for(const w of this.windows.values())w.refresh?.();if(this.desktopItemsCache)this.renderDesktopIconsDebounced()}
  renderDesktopIconsDebounced(){clearTimeout(this.iconTimer);this.iconTimer=setTimeout(()=>this.renderDesktopIcons(),80)}
  notifyServers(){for(const w of this.windows.values())w.onServers?.()}
  downloadText(name,content,type='text/plain'){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  exportFiles(){this.downloadText(`DesktopSim-${this.currentOS}-Backup.json`,JSON.stringify(this.fs.export(),null,2),'application/json');this.notify('Export','JSON-Sicherung des virtuellen Dateisystems wird heruntergeladen.','files')}
  gitCommand(ctx){return gitCommand(this,ctx)}
  terminalTitle(t){const sh=t.shell==='powershell'?'Windows PowerShell':t.shell==='cmd'?(isWindows(this.currentOS)?'Eingabeaufforderung':'cmd'):null;if(isWindows(this.currentOS))return sh+(t.admin?' (Administrator)':'');if(this.currentOS==='macos')return`${pathDisplay(this.currentOS,t.cwd).split('/').pop()||'/'} — ${t.shell} — 80×24`;if(this.currentOS==='arch')return`${t.cwd===homePath(this.currentOS)?'~':t.cwd.split('/').pop()} : ${t.shell} — Konsole`;if(this.currentOS==='debian')return`${t.admin?'root':'student'}@debian-sim: ${t.cwd.replace(homePath(this.currentOS),'~')}`;return'Terminal'}
}

function install(target,...mixins){for(const M of mixins)for(const k of Object.getOwnPropertyNames(M.prototype))if(k!=='constructor')Object.defineProperty(target.prototype,k,Object.getOwnPropertyDescriptor(M.prototype,k))}
install(DesktopSim,ClassicApps,TerminalApp,FilesApp,EditorApps,BrowserApp,SystemApps,IDEApp,WebApps);
window.desktopSim=new DesktopSim();
