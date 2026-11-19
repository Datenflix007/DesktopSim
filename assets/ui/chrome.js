// OS-spezifische Bedienoberflächen: Taskleisten, Startmenüs, Panels, Dock, Boot/Login, Menüs und Benachrichtigungen.
import {getOS,isWindows,homePath,joinPath,trashPath,pathDisplay} from '../vfs.js';
import {appIcon,folderIcon,fileIcon,lineIcon,osMark} from './icons.js';

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const KIND_APP={terminal:'terminal',files:'files',editor:'editor',ide:'ide',browser:'browser',settings:'settings',taskmgr:'taskmgr',calc:'calc',git:'git',structogram:'structogram',game:'game',fun:'fun',sql:'sql',guide:'guide',about:'about',image:'editor',dialog:'about',properties:'about',run:'about'};
const ALL_APPS=['terminal','files','editor','ide','browser','settings','taskmgr','calc','git','structogram','game','fun','sql','mindmap','dslab','mdgen','papermaker','guide'];
const DE_DAYS=['So','Mo','Di','Mi','Do','Fr','Sa'],DE_MON=['Jan.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sept.','Okt.','Nov.','Dez.'];
const pad=n=>String(n).padStart(2,'0');

export class Chrome{
  constructor(app){this.app=app;this.menu=null;this.overview=false}
  get os(){return this.app.currentOS}
  get fam(){return this.app.profile.family}
  get ui(){return $('#shell-ui')}
  get overlay(){return $('#overlay-layer')}
  icon(id,size){return`<span class="ai" style="--s:${size||24}px">${id==='files'||id==='docs'||id==='home'?folderIcon(this.fam==='windows'?'windows':this.fam):appIcon(id,this.fam)}</span>`}
  name(id){return this.app.appName(id)}

  // ---------- Fensterrahmen ----------
  frame(title,icon){
    const ic=`<span class="win-icon">${this.icon(icon,16)}</span>`,t=`<span class="win-title">${esc(title)}</span>`,slot='<div class="win-titleslot"></div>';
    const btn=(a,label,glyph='')=>`<button type="button" class="wb wb-${a}" data-wbtn="${a}" aria-label="${label}" title="${label}">${glyph}</button>`;
    const winGlyph={min:'<svg viewBox="0 0 10 10"><path d="M0 5.5h10" stroke="currentColor"/></svg>',max:'<svg viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" fill="none" stroke="currentColor"/></svg>',close:'<svg viewBox="0 0 10 10"><path d="M0 0l10 10M10 0 0 10" stroke="currentColor"/></svg>'};
    if(this.fam==='mac')return`<header class="win-titlebar"><div class="traffic">${btn('close','Schließen')}${btn('min','Im Dock ablegen')}${btn('max','Vollbild')}</div>${t}${slot}</header>`;
    if(this.fam==='gnome')return`<header class="win-titlebar">${slot}${t}<div class="win-controls">${btn('min','Minimieren',lineIcon('chevronDown',14))}${btn('max','Maximieren',lineIcon('chevronUp',14))}${btn('close','Schließen',lineIcon('close',13))}</div></header>`;
    if(this.fam==='kde')return`<header class="win-titlebar">${ic}${t}${slot}<div class="win-controls">${btn('min','Minimieren',lineIcon('chevronDown',15))}${btn('max','Maximieren',lineIcon('chevronUp',15))}${btn('close','Schließen',lineIcon('close',13))}</div></header>`;
    if(this.fam==='cde')return`<header class="win-titlebar">${btn('menu','Fenstermenü','<i></i>')}${t}${slot}${btn('min','Minimieren','<i></i>')}${btn('max','Maximieren','<i></i>')}</header>`;
    return`<header class="win-titlebar">${ic}${t}${slot}<div class="win-controls">${btn('min','Minimieren',winGlyph.min)}${btn('max','Maximieren',winGlyph.max)}${btn('close','Schließen',winGlyph.close)}</div></header>`;
  }

  // ---------- Grundaufbau ----------
  render(){
    const os=this.os,ui=this.ui;this.closeMenus();this.overview=false;this.app.desktop.classList.remove('overview');
    if(this.fam==='windows')ui.innerHTML=`<div class="taskbar" id="taskbar">${this.startButton()}${['win10'].includes(os)?`<label class="tb-search"><span>${lineIcon('search',16)}</span><input placeholder="Zur Suche Text hier eingeben" aria-label="Suche"></label><button class="tb-btn tb-taskview" title="Aktive Anwendungen">${lineIcon('taskview',18)}</button>`:''}${os==='win11'?`<button class="tb-btn tb-search11" title="Suche">${lineIcon('search',19)}</button><button class="tb-btn tb-taskview" title="Aktive Anwendungen">${lineIcon('taskview',19)}</button>`:''}${os==='winxp'?'<div class="tb-quick"></div><span class="tb-sep"></span>':''}<div class="tb-tasks"></div><div class="tb-tray">${os==='winxp'?'':`<button class="tray-btn tray-chevron" title="Ausgeblendete Symbole einblenden">${lineIcon('chevronUp',14)}</button>`}<button class="tray-btn tray-net" title="Netzwerk: Verbunden">${lineIcon('wifi',16)}</button><button class="tray-btn tray-vol" title="Lautsprecher: 60 %">${lineIcon('volume',16)}</button><button class="tray-clock" title=""></button>${os==='win10'?`<button class="tray-btn tray-action" title="Info-Center">${lineIcon('bell',16)}</button>`:''}${['win7','win8','win10','win11'].includes(os)?'<button class="tb-showdesk" title="Desktop anzeigen"></button>':''}</div></div>`;
    else if(this.fam==='gnome')ui.innerHTML=`<div class="topbar"><button class="tp-activities" title="Aktivitäten"><span class="ws-pill"></span><span class="ws-dot"></span></button><button class="tp-clock"></button><div class="tp-right"><button class="tp-status" title="Systemmenü">${lineIcon('wifi',15)}${lineIcon('volume',15)}${lineIcon('battery',17)}</button></div></div><div class="gnome-dash-wrap"><div class="gnome-dash"></div></div><div class="gnome-search"><input placeholder="Suchen" aria-label="Suchen"></div>`;
    else if(this.fam==='kde')ui.innerHTML=`<div class="plasma-panel"><button class="kp-launcher" title="Anwendungsstarter">${osMark('arch')}</button><div class="kp-pager"><button class="on">1</button><button>2</button></div><div class="tb-tasks"></div><div class="kp-tray"><button class="tray-btn" title="Zwischenablage">${lineIcon('paste',15)}</button><button class="tray-btn tray-net" title="Netzwerke">${lineIcon('wifi',16)}</button><button class="tray-btn tray-vol" title="Lautstärke">${lineIcon('volume',16)}</button><button class="tray-btn" title="Benachrichtigungen">${lineIcon('bell',15)}</button><button class="tray-clock"></button><button class="kp-peek" title="Arbeitsfläche anzeigen"></button></div></div>`;
    else if(this.fam==='mac')ui.innerHTML=`<div class="menubar"><button class="mb-logo" title="Systemmenü">${osMark('macos')}</button><button class="mb-app"><b>Finder</b></button><div class="mb-menus"></div><div class="mb-right"><button class="mb-ico" title="Batterie">${lineIcon('battery',19)}</button><button class="mb-ico" title="WLAN">${lineIcon('wifi',16)}</button><button class="mb-ico mb-spot" title="Spotlight">${lineIcon('search',15)}</button><button class="mb-ico mb-cc" title="Kontrollzentrum"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="6" rx="3"/><rect x="3" y="13" width="18" height="6" rx="3"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/></svg></button><button class="tray-clock"></button></div></div><div class="dock-wrap"><div class="dock"></div></div>`;
    else ui.innerHTML=`<div class="frontpanel"><div class="fp-clock"><span class="fp-dial"><i class="h"></i><i class="m"></i></span></div><button class="fp-cal" data-fp="calendar"><b></b><small></small></button><button class="fp-btn" data-fp="files" title="Persönlicher Ordner">${this.icon('home',30)}</button><button class="fp-btn" data-fp="editor" title="Texteditor">${this.icon('editor',30)}</button><button class="fp-btn" data-fp="browser" title="Webbrowser">${this.icon('browser',30)}</button><div class="fp-center"><button class="fp-lock" title="Bildschirm sperren">${lineIcon('lock',14)}</button><div class="fp-ws">${[1,2,3,4].map(n=>`<button data-ws="${n}" class="${n===1?'on':''}">${['Eins','Zwei','Drei','Vier'][n-1]}</button>`).join('')}</div><button class="fp-exit" title="Abmelden">EXIT</button></div><button class="fp-btn" data-fp="terminal" title="Terminal">${this.icon('terminal',30)}</button><button class="fp-btn" data-fp="settings" title="Stilmanager">${this.icon('settings',30)}</button><button class="fp-btn fp-apps" data-fp="apps" title="Anwendungsmanager">${this.icon('ide',30)}</button><button class="fp-btn" data-fp="guide" title="Hilfe">${this.icon('guide',30)}</button><button class="fp-btn" data-fp="trash" title="Papierkorb">${this.icon('trash',30)}</button></div><div class="cde-iconbox"></div>`;
    ui.insertAdjacentHTML('beforeend','<div class="snap-preview" hidden></div><div class="notify-area"></div>');
    this.bind();this.updateTasks();this.tickClock();
  }
  startButton(){const os=this.os;if(os==='winxp')return`<button class="tb-start" title="Klicken Sie hier, um zu beginnen.">${osMark('winxp')}<span>Start</span></button>`;if(os==='win7')return`<button class="tb-start orb" title="Start">${osMark('win7')}</button>`;return`<button class="tb-start" title="Start">${osMark(os)}</button>`}
  bind(){
    const ui=this.ui,app=this.app;
    const on=(sel,fn,ev='click')=>$$(sel,ui).forEach(el=>el.addEventListener(ev,e=>{e.stopPropagation();fn(e,el)}));
    on('.tb-start',(e,el)=>this.toggleLauncher(el));on('.kp-launcher',(e,el)=>this.toggleLauncher(el));on('.mb-logo',(e,el)=>this.appleMenu(el));
    on('.tp-activities',()=>this.toggleOverview());on('.tb-taskview',()=>this.toggleOverview());
    on('.tray-clock,.tp-clock,.fp-cal',(e,el)=>this.calendar(el));on('.tray-net,.tray-vol,.tp-status,.mb-cc,.tray-action',(e,el)=>this.quickSettings(el));
    on('.tray-chevron',(e,el)=>this.popup(el,`<div class="pop-tray">${['sql','git','fun'].map(id=>`<button data-launch="${id}" title="${esc(this.name(id))}">${this.icon(id,18)}</button>`).join('')}</div>`,'tray'));
    on('.tb-showdesk,.kp-peek',()=>app.showDesktop());on('.mb-spot,.tb-search11',()=>this.os==='macos'?this.spotlight():this.toggleLauncher($('.tb-start',ui),true));
    on('.fp-lock',()=>app.power('lock'));on('.fp-exit',()=>app.confirmDialog('Die aktuelle Sitzung wird beendet. Fortfahren?','OK').then(ok=>ok&&app.power('logout')));
    on('[data-fp]',(e,el)=>{const a=el.dataset.fp;if(a==='calendar')return;if(a==='apps')return this.popup(el,this.listMenu(ALL_APPS),'cde-sub');if(a==='files')return app.launch('home');app.launch(a)});
    on('[data-ws]',(e,el)=>this.switchWorkspace(+el.dataset.ws));
    on('.kp-pager button',(e,el)=>{$$('.kp-pager button',ui).forEach(b=>b.classList.toggle('on',b===el))});
    const search=$('.tb-search input',ui);if(search){search.addEventListener('focus',()=>this.toggleLauncher($('.tb-start',ui),true,search));search.addEventListener('input',()=>this.filterLauncher(search.value))}
    const gs=$('.gnome-search input',ui);if(gs)gs.addEventListener('input',()=>this.gnomeSearch(gs.value));
    on('.mb-app',(e,el)=>this.macAppMenu(el));
    // Desktop-Hintergrund
    const desk=app.desktop;if(!desk.dataset.bound){desk.dataset.bound='1';
      desk.addEventListener('pointerdown',e=>{if(!e.target.closest('#overlay-layer,.ctx-menu,.popup,.start-menu'))this.closeMenus();if(e.target===desk||e.target.id==='desktop-icons'||e.target.classList.contains('wallpaper')){$$('.desk-icon.selected').forEach(x=>x.classList.remove('selected'));if(this.overview)this.exitOverview();else this.rubberBand(e)}});
      desk.addEventListener('contextmenu',e=>{if(e.target===desk||e.target.id==='desktop-icons'||e.target.classList.contains('wallpaper')){e.preventDefault();this.app.desktopContextMenu(e.clientX,e.clientY)}else if(!e.target.closest('input,textarea,.term,iframe,[contenteditable]'))e.preventDefault()});
    }
  }
  rubberBand(e){
    if(e.button!==0)return;const desk=this.app.desktop,r=desk.getBoundingClientRect();const band=document.createElement('div');band.className='rubber-band';desk.append(band);const x0=e.clientX,y0=e.clientY;
    const move=ev=>{const x=Math.min(x0,ev.clientX),y=Math.min(y0,ev.clientY),w=Math.abs(ev.clientX-x0),h=Math.abs(ev.clientY-y0);Object.assign(band.style,{left:x-r.left+'px',top:y-r.top+'px',width:w+'px',height:h+'px'});$$('.desk-icon').forEach(ic=>{const b=ic.getBoundingClientRect();ic.classList.toggle('selected',b.right>x&&b.left<x+w&&b.bottom>y&&b.top<y+h)})};
    const up=()=>{band.remove();removeEventListener('pointermove',move);removeEventListener('pointerup',up)};addEventListener('pointermove',move);addEventListener('pointerup',up);
  }

  // ---------- Taskleiste / Dock ----------
  groups(){
    const wins=[...this.app.windows.values()].filter(w=>w.kind!=='dialog'||true);const pinned=this.app.profile.pinned;const map=new Map();
    for(const id of pinned)map.set(id,{app:id,wins:[],pinned:true});
    for(const w of wins){const id=KIND_APP[w.kind]||w.kind;if(!map.has(id))map.set(id,{app:id,wins:[],pinned:false});map.get(id).wins.push(w)}
    return[...map.values()];
  }
  updateTasks(){
    const ui=this.ui;if(!ui)return;const app=this.app,active=app.activeWindow;
    const tasks=$('.tb-tasks',ui);
    if(tasks&&this.os==='winxp'){
      $('.tb-quick',ui).innerHTML=this.app.profile.pinned.map(id=>`<button class="tb-ql" data-launch="${id}" title="${esc(this.name(id))}">${this.icon(id,18)}</button>`).join('');
      tasks.innerHTML=[...app.windows.values()].map(w=>`<button class="tb-task ${w===active&&!w.minimized?'active':''}" data-win="${w.id}" title="${esc(w.title)}">${this.icon(KIND_APP[w.kind]||'about',16)}<span>${esc(w.title)}</span></button>`).join('');
    }else if(tasks){
      tasks.innerHTML=this.groups().map(g=>`<button class="tb-app ${g.wins.length?'running':''} ${g.wins.length>1?'multi':''} ${g.wins.includes(active)&&!active?.minimized?'active':''}" data-app="${g.app}" title="${esc(g.wins.length===1?g.wins[0].title:this.name(g.app))}">${this.icon(g.app,this.os==='win7'?30:this.fam==='kde'?28:24)}${this.os==='win10'||this.os==='win7'?'':''}</button>`).join('');
    }
    const dock=$('.dock',ui);
    if(dock){const groups=this.groups();dock.innerHTML=`<button class="dock-item" data-app="files" title="Finder">${this.icon('files',52)}<i class="${groups.find(g=>g.app==='files')?.wins.length?'on':''}"></i></button><button class="dock-item" data-launchpad title="Programme"><span class="ai" style="--s:52px">${appIcon('launchpad')}</span></button>${groups.filter(g=>g.app!=='files').map(g=>`<button class="dock-item" data-app="${g.app}" title="${esc(this.name(g.app))}">${this.icon(g.app,52)}<i class="${g.wins.length?'on':''}"></i></button>`).join('')}<span class="dock-sep"></span><button class="dock-item" data-app="trash" title="Papierkorb">${this.icon('trash',52)}</button>`;this.dockMagnify(dock)}
    const dash=$('.gnome-dash',ui);
    if(dash){dash.innerHTML=this.groups().map(g=>`<button class="dash-item" data-app="${g.app}" title="${esc(this.name(g.app))}">${this.icon(g.app,46)}<i class="${g.wins.length?'on':''}"></i></button>`).join('')+`<span class="dash-sep"></span><button class="dash-item dash-grid" data-appgrid title="Anwendungen anzeigen">${lineIcon('apps',26)}</button>`}
    const iconbox=$('.cde-iconbox',ui);
    if(iconbox)iconbox.innerHTML=[...app.windows.values()].filter(w=>w.minimized&&w.workspace===app.workspace).map(w=>`<button class="cde-icon" data-win="${w.id}">${this.icon(KIND_APP[w.kind]||'about',34)}<span>${esc(w.title.slice(0,18))}</span></button>`).join('');
    $$('[data-win]',ui).forEach(b=>b.onclick=e=>{e.stopPropagation();const w=app.windows.get(+b.dataset.win);if(!w)return;if(w===app.activeWindow&&!w.minimized)app.minimizeWindow(w);else app.restoreWindow(w)});
    $$('[data-app]',ui).forEach(b=>{b.onclick=e=>{e.stopPropagation();this.clickApp(b.dataset.app,b)};b.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();this.jumpList(b.dataset.app,b)}});
    $$('[data-launch]',ui).forEach(b=>b.onclick=e=>{e.stopPropagation();app.launch(b.dataset.launch)});
    $$('[data-launchpad]',ui).forEach(b=>b.onclick=e=>{e.stopPropagation();this.appGrid()});
    $$('[data-appgrid]',ui).forEach(b=>b.onclick=e=>{e.stopPropagation();this.appGrid()});
    $$('[data-win]',ui).forEach(b=>b.oncontextmenu=e=>{e.preventDefault();const w=app.windows.get(+b.dataset.win);if(w)this.contextMenu(e.clientX,e.clientY,[{label:'Wiederherstellen',action:()=>app.restoreWindow(w)},{label:'Minimieren',action:()=>app.minimizeWindow(w)},{label:'Maximieren',action:()=>{app.restoreWindow(w);if(!w.maximized)app.toggleMax(w)}},{sep:true},{label:'Schließen',bold:true,action:()=>app.closeWindowById(w.id)}])});
    if(this.overview)this.layoutOverview();
  }
  clickApp(id,btn){
    const app=this.app;const g=this.groups().find(x=>x.app===id);const wins=g?.wins.filter(w=>w.workspace===app.workspace||this.fam!=='cde')||[];
    if(id==='trash'&&!wins.length)return app.launch('trash');
    if(!wins.length){this.bounce(btn);return app.launch(id)}
    if(this.overview){this.exitOverview();app.restoreWindow(wins.at(-1));return}
    if(wins.length===1){const w=wins[0];if(w===app.activeWindow&&!w.minimized&&this.fam!=='mac')app.minimizeWindow(w);else app.restoreWindow(w);return}
    this.popup(btn,`<div class="pop-windows">${wins.map(w=>`<button data-pick="${w.id}">${this.icon(id,18)}<span>${esc(w.title)}</span></button>`).join('')}</div>`,'windows');
    $$('[data-pick]',this.overlay).forEach(b=>b.onclick=()=>{this.closeMenus();app.restoreWindow(app.windows.get(+b.dataset.pick))});
  }
  bounce(btn){if(this.fam!=='mac'||!btn)return;btn.classList.remove('bounce');void btn.offsetWidth;btn.classList.add('bounce');setTimeout(()=>btn.classList.remove('bounce'),1300)}
  jumpList(id,btn){const g=this.groups().find(x=>x.app===id);const items=[{label:this.name(id),header:true},{label:this.fam==='mac'?'Neues Fenster':'Neues Fenster öffnen',action:()=>this.app.launch(id)}];if(g?.wins.length)items.push({sep:true},{label:g.wins.length>1?'Alle Fenster schließen':'Fenster schließen',action:()=>g.wins.forEach(w=>this.app.closeWindowById(w.id))});if(this.fam==='mac'&&g?.wins.length)items.push({label:'Beenden',action:()=>g.wins.forEach(w=>this.app.closeWindowById(w.id))});const r=btn.getBoundingClientRect();this.contextMenu(r.left,r.top,items,{above:this.fam!=='gnome'})}
  taskButtonRect(w){const ui=this.ui;const el=$(`[data-win="${w.id}"]`,ui)||$(`[data-app="${KIND_APP[w.kind]||w.kind}"]`,ui);return el?.getBoundingClientRect()}
  dockMagnify(dock){if(dock.dataset.mag)return;dock.dataset.mag='1';dock.addEventListener('mousemove',e=>{for(const it of $$('.dock-item',dock)){const r=it.getBoundingClientRect();const d=Math.abs(e.clientX-(r.left+r.width/2));it.style.setProperty('--mag',String(Math.max(1,1.55-d/170)))}});dock.addEventListener('mouseleave',()=>$$('.dock-item',dock).forEach(it=>it.style.setProperty('--mag','1')))}
  onFocus(win){
    if(this.fam==='mac'){const name=win?this.name(KIND_APP[win.kind]||'files'):'Finder';$('.mb-app b',this.ui).textContent=name;$('.mb-menus',this.ui).innerHTML=['Ablage','Bearbeiten','Darstellung','Gehe zu','Fenster','Hilfe'].map(m=>`<button data-mm="${m}">${m}</button>`).join('');$$('[data-mm]',this.ui).forEach(b=>b.onclick=e=>{e.stopPropagation();this.macMenu(b.dataset.mm,b)})}
    this.updateTasks();
  }
  switchWorkspace(n){const app=this.app;app.workspace=n;$$('[data-ws]',this.ui).forEach(b=>b.classList.toggle('on',+b.dataset.ws===n));for(const w of app.windows.values())w.element.classList.toggle('other-ws',w.workspace!==n);this.updateTasks()}

  // ---------- Uhr & Kalender ----------
  tickClock(){
    const ui=this.ui;if(!ui)return;const d=new Date(),t=`${pad(d.getHours())}:${pad(d.getMinutes())}`,date=`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
    const clock=$('.tray-clock',ui);
    if(clock){if(this.os==='winxp')clock.textContent=t;else if(this.fam==='windows')clock.innerHTML=`<span>${t}</span><span>${date}</span>`;else if(this.fam==='kde')clock.innerHTML=`<span>${t}</span><span>${pad(d.getDate())}.${pad(d.getMonth()+1)}.${String(d.getFullYear()).slice(2)}</span>`;else if(this.fam==='mac')clock.textContent=`${DE_DAYS[d.getDay()]}. ${d.getDate()}. ${DE_MON[d.getMonth()]}  ${t}`;clock.title=d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
    const gc=$('.tp-clock',ui);if(gc)gc.textContent=`${DE_DAYS[d.getDay()]}. ${d.getDate()}. ${DE_MON[d.getMonth()].replace('.','')}  ${t}`;
    const cal=$('.fp-cal',ui);if(cal){$('b',cal).textContent=d.getDate();$('small',cal).textContent=DE_MON[d.getMonth()].replace('.','').toUpperCase()}
    const dial=$('.fp-dial',ui);if(dial){$('.h',dial).style.transform=`rotate(${(d.getHours()%12)*30+d.getMinutes()/2}deg)`;$('.m',dial).style.transform=`rotate(${d.getMinutes()*6}deg)`}
  }
  calendar(anchor){
    const d=new Date(),y=d.getFullYear(),m=d.getMonth();const first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
    let cells='';for(let i=0;i<first;i++)cells+='<span></span>';for(let i=1;i<=days;i++)cells+=`<span class="${i===d.getDate()?'today':''}">${i}</span>`;
    this.popup(anchor,`<div class="pop-cal"><div class="cal-time">${pad(d.getHours())}:${pad(d.getMinutes())}<small>${d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</small></div><div class="cal-month">${d.toLocaleDateString('de-DE',{month:'long',year:'numeric'})}</div><div class="cal-grid">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<b>${x}</b>`).join('')}${cells}</div>${this.fam==='gnome'?'<div class="cal-notes">Keine Benachrichtigungen</div>':''}</div>`,'calendar');
  }
  quickSettings(anchor){
    const toggles=[['wifi','WLAN',true],['bluetooth','Bluetooth',false],['airplane','Flugmodus',false],['moon','Nachtlicht',false]];
    const dark=this.app.desktop.classList.contains('theme-dark');
    this.popup(anchor,`<div class="pop-qs"><div class="qs-grid">${toggles.map(([ic,l,on])=>`<button class="qs-tile ${on?'on':''}" data-qs>${lineIcon(ic,18)}<span>${l}</span></button>`).join('')}<button class="qs-tile ${dark?'on':''}" data-dark>${lineIcon('moon',18)}<span>Dunkler Modus</span></button></div><label class="qs-slider">${lineIcon('sun',16)}<input type="range" value="80" aria-label="Helligkeit"></label><label class="qs-slider">${lineIcon('volume',16)}<input type="range" value="60" aria-label="Lautstärke"></label><div class="qs-foot"><span>${lineIcon('battery',18)} 100 %</span><span><button data-qs-settings title="Einstellungen">${lineIcon('menu',16)}</button><button data-qs-lock title="Sperren">${lineIcon('lock',16)}</button><button data-qs-power title="Ein/Aus">${lineIcon('power',16)}</button></span></div></div>`,'quick');
    $$('[data-qs]',this.overlay).forEach(b=>b.onclick=()=>b.classList.toggle('on'));
    $('[data-dark]',this.overlay).onclick=e=>{const on=!this.app.desktop.classList.contains('theme-dark');this.app.setSetting('theme',on?'dark':'light');e.currentTarget.classList.toggle('on',on)};
    $('[data-qs-settings]',this.overlay).onclick=()=>this.app.launch('settings');$('[data-qs-lock]',this.overlay).onclick=()=>this.app.power('lock');
    $('[data-qs-power]',this.overlay).onclick=e=>this.powerMenu(e.currentTarget);
  }
  powerMenu(anchor){const r=anchor.getBoundingClientRect();const items=this.fam==='windows'?[{label:'Energie sparen',icon:'moon',action:()=>this.app.power('sleep')},{label:'Herunterfahren',icon:'power',action:()=>this.app.power('shutdown')},{label:'Neu starten',icon:'restart',action:()=>this.app.power('restart')}]:[{label:'Bereitschaft',icon:'moon',action:()=>this.app.power('sleep')},{label:'Neu starten …',icon:'restart',action:()=>this.app.power('restart')},{label:'Ausschalten …',icon:'power',action:()=>this.app.power('shutdown')},{sep:true},{label:'Abmelden …',icon:'user',action:()=>this.app.power('logout')}];this.contextMenu(r.left,r.top,items,{above:this.fam==='windows'||this.fam==='kde',keep:true})}

  // ---------- Startmenüs ----------
  toggleLauncher(anchor,focusSearch=false,externalInput=null){
    if(this.menu?.kind==='launcher'){this.closeMenus();return}
    if(this.fam==='gnome')return this.toggleOverview();
    if(this.fam==='mac')return this.spotlight();
    if(this.fam==='cde')return this.popup($('.fp-apps',this.ui),this.listMenu(ALL_APPS),'cde-sub');
    anchor=anchor||$('.tb-start,.kp-launcher',this.ui);
    const html=this.os==='winxp'?this.menuXP():this.os==='win7'?this.menu7():this.os==='win8'?this.menu8():this.os==='win10'?this.menu10():this.os==='win11'?this.menu11():this.menuKDE();
    const el=this.popup(anchor,html,'launcher');if(!el)return;
    $$('.tb-start,.kp-launcher',this.ui).forEach(b=>b.classList.add('pressed'));
    $$('[data-launch]',el).forEach(b=>b.onclick=()=>{this.closeMenus();this.app.launch(b.dataset.launch)});
    $$('[data-power]',el).forEach(b=>b.onclick=e=>{e.stopPropagation();if(b.dataset.power==='menu')return this.powerMenu(b);this.closeMenus();this.app.power(b.dataset.power)});
    $$('[data-open]',el).forEach(b=>b.onclick=()=>{this.closeMenus();this.app.openPath(b.dataset.open)});
    $$('[data-desktop]',el).forEach(b=>b.onclick=()=>this.closeMenus());
    $$('[data-allapps]',el).forEach(b=>b.onclick=e=>{e.stopPropagation();el.classList.toggle('show-all')});
    $$('[data-cat]',el).forEach(b=>b.onmouseenter=b.onclick=()=>{$$('[data-cat]',el).forEach(x=>x.classList.toggle('on',x===b));this.renderKdeCat(el,b.dataset.cat)});
    if(this.fam==='kde')this.renderKdeCat(el,'fav');
    const input=$('.lm-search input',el);
    if(input){input.oninput=()=>this.filterLauncher(input.value);input.onkeydown=e=>{if(e.key==='Enter'){const first=$('.lm-results [data-launch],.lm-results [data-open]',el);first?.click()}};if(focusSearch||this.os==='win7'||this.fam==='kde')setTimeout(()=>input.focus(),30)}
    if(externalInput){this.externalSearch=externalInput}
  }
  appButtons(ids,size=26,cls='lm-app'){return ids.map(id=>`<button class="${cls}" data-launch="${id}">${this.icon(id,size)}<span>${esc(this.name(id))}</span></button>`).join('')}
  places(){const h=homePath(this.os);return[['docs','Documents'],['Pictures','Pictures'],['Music','Music'],['Downloads','Downloads']].map(([k,f])=>[k==='docs'?this.name('docs'):{Pictures:'Bilder',Music:'Musik',Downloads:'Downloads'}[f],joinPath(h,f)])}
  searchResults(q){
    q=q.trim().toLowerCase();if(!q)return'';const apps=[...ALL_APPS,'about','trash'].filter(id=>this.name(id).toLowerCase().includes(q)||id.includes(q));
    const files=[];const walk=(p,depth)=>{if(depth>5||files.length>8)return;try{for(const e of this.app.fs.list(p)){if(e.name.startsWith('.'))continue;const full=joinPath(p,e.name);if(e.name.toLowerCase().includes(q))files.push([e,full]);if(e.type==='dir')walk(full,depth+1)}}catch{}};walk(homePath(this.os),0);
    const cmd=['cmd','powershell','terminal','bash','konsole'].some(c=>c.startsWith(q))?`<button data-launch="terminal">${this.icon('terminal',22)}<span>${esc(this.name('terminal'))}<small>Befehlszeile</small></span></button>`:'';
    return`<div class="lm-results">${apps.length||cmd?`<h4>${this.fam==='kde'?'Anwendungen':'Apps'}</h4>${cmd}${apps.map(id=>`<button data-launch="${id}">${this.icon(id,22)}<span>${esc(this.name(id))}</span></button>`).join('')}`:''}${files.length?`<h4>Dateien</h4>${files.map(([e,full])=>`<button data-open="${esc(full)}">${e.type==='dir'?folderIcon(this.fam==='windows'?'windows':this.fam):fileIcon(e.name)}<span>${esc(e.name)}<small>${esc(pathDisplay(this.os,full.replace(/\/[^/]*$/,'')))}</small></span></button>`).join('')}`:''}${!apps.length&&!files.length&&!cmd?'<p class="lm-none">Keine Ergebnisse</p>':''}</div>`;
  }
  filterLauncher(q){
    if(this.menu?.kind!=='launcher'){if(q)this.toggleLauncher(null,false);else return}
    const el=this.menu?.el;if(!el)return;const box=$('.lm-search-results',el);if(!box)return;box.innerHTML=this.searchResults(q);el.classList.toggle('searching',Boolean(q.trim()));
    $$('[data-launch]',box).forEach(b=>b.onclick=()=>{this.closeMenus();this.app.launch(b.dataset.launch)});$$('[data-open]',box).forEach(b=>b.onclick=()=>{this.closeMenus();this.app.openPath(b.dataset.open)});
  }
  menuXP(){const left=['browser','terminal','files','ide','editor','calc','git','structogram','game','sql'];return`<div class="start-menu sm-xp"><div class="smxp-head"><span class="smxp-pic">${lineIcon('user',30)}</span><b>Student</b></div><div class="smxp-body"><div class="smxp-left">${this.appButtons(left.slice(0,2),32,'lm-app big')}<hr>${this.appButtons(left.slice(2),24)}<hr><button class="smxp-all" data-allapps>Alle Programme <span>▶</span></button><div class="smxp-allapps">${this.appButtons(ALL_APPS,18)}</div></div><div class="smxp-right">${this.places().map(([l,p],i)=>`<button data-open="${esc(p)}"><span>${folderIcon('windows')}</span><b>${i===0?'Eigene Dateien':'Eigene '+l}</b></button>`).join('')}<hr><button data-launch="computer"><span>${appIcon('computer')}</span><b>Arbeitsplatz</b></button><hr><button data-launch="settings"><span>${appIcon('settings')}</span>Systemsteuerung</button><button data-launch="guide"><span>${appIcon('guide')}</span>Hilfe und Support</button><button data-launch="run"><span>${appIcon('terminal')}</span>Ausführen …</button></div></div><div class="smxp-foot"><button data-power="logout">${lineIcon('user',18)} Abmelden</button><button data-power="shutdown" class="off">${lineIcon('power',18)} Ausschalten</button></div></div>`}
  menu7(){return`<div class="start-menu sm-7"><div class="sm7-left"><div class="lm-pinned">${this.appButtons(['browser','terminal','files','ide','editor','calc','git','game'],28)}</div><div class="lm-search-results"></div><button class="sm7-all" data-allapps>▶ Alle Programme</button><div class="sm7-allapps">${this.appButtons(ALL_APPS,18)}</div><label class="lm-search"><input placeholder="Programme/Dateien durchsuchen">${lineIcon('search',15)}</label></div><div class="sm7-right"><span class="sm7-pic">${lineIcon('user',34)}</span><button data-launch="home">Student</button>${this.places().map(([l,p])=>`<button data-open="${esc(p)}">${esc(l)}</button>`).join('')}<button data-launch="game">Spiele</button><button data-launch="computer">Computer</button><hr><button data-launch="settings">Systemsteuerung</button><button data-launch="taskmgr">Task-Manager</button><button data-launch="guide">Hilfe und Support</button><button data-launch="run">Ausführen …</button><div class="sm7-power"><button data-power="shutdown">Herunterfahren</button><button data-power="menu" class="sm7-arrow">▶</button></div></div></div>`}
  menu8(){const tiles=[['browser','wide','#2672ec'],['files','','#d24726'],['terminal','','#1e1e1e'],['ide','wide','#2d89ef'],['git','','#e3572b'],['game','','#00a300'],['calc','','#603cba'],['sql','','#e3a21a'],['structogram','','#da532c'],['settings','','#7e3878'],['fun','wide','#b91d47'],['editor','','#00aba9'],['guide','','#2b5797'],['taskmgr','','#1e7145']];return`<div class="start-menu sm-8"><div class="sm8-head"><h1>Start</h1><span class="sm8-user">Student ${lineIcon('user',30)}</span><div class="sm8-actions"><button data-power="menu" title="Ein/Aus">${lineIcon('power',18)}</button><button title="Suchen" data-allapps>${lineIcon('search',18)}</button></div></div><div class="lm-search-results"></div><div class="sm8-tiles">${tiles.map(([id,size,color])=>`<button class="tile ${size}" style="--tile:${color}" data-launch="${id}">${this.icon(id,size?44:40)}<span>${esc(this.name(id))}</span></button>`).join('')}<button class="tile" style="--tile:#3a3a3a" data-desktop><span class="sm8-desktop">Desktop</span></button></div><label class="lm-search"><input placeholder="Apps durchsuchen"></label></div>`}
  menu10(){const sorted=[...ALL_APPS].sort((a,b)=>this.name(a).localeCompare(this.name(b),'de'));let letter='';const list=sorted.map(id=>{const l=this.name(id)[0].toUpperCase();const head=l!==letter?`<h5>${letter=l}</h5>`:'';return head+`<button class="lm-app" data-launch="${id}">${this.icon(id,24)}<span>${esc(this.name(id))}</span></button>`}).join('');const tiles=[['browser','w'],['files',''],['terminal',''],['ide','w'],['git',''],['game',''],['calc',''],['sql',''],['settings',''],['structogram','']];return`<div class="start-menu sm-10"><div class="sm10-rail"><button title="Erweitern">${lineIcon('menu',18)}</button><span></span><button data-launch="home" title="Student">${lineIcon('user',18)}</button><button data-launch="docs" title="Dokumente">${lineIcon('paste',18)}</button><button data-launch="settings" title="Einstellungen">${appIcon('settings')}</button><button data-power="menu" title="Ein/Aus">${lineIcon('power',18)}</button></div><div class="sm10-list"><div class="lm-search-results"></div>${list}</div><div class="sm10-tiles"><h5>Produktivität und Lernen</h5><div class="sm10-grid">${tiles.map(([id,w])=>`<button class="tile ${w?'wide':''}" data-launch="${id}">${this.icon(id,34)}<span>${esc(this.name(id))}</span></button>`).join('')}</div></div></div>`}
  menu11(){const recent=[];const proj=joinPath(homePath(this.os),'Projects');try{for(const e of this.app.fs.list(proj).filter(e=>e.type==='file').sort((a,b)=>b.mtime-a.mtime).slice(0,6))recent.push(e)}catch{}return`<div class="start-menu sm-11"><label class="lm-search">${lineIcon('search',16)}<input placeholder="Hier eingeben, um zu suchen"></label><div class="lm-search-results"></div><div class="sm11-main"><div class="sm11-headrow"><b>Angeheftet</b><button data-allapps>Alle Apps ›</button></div><div class="sm11-pinned">${this.appButtons(['browser','files','terminal','ide','editor','settings','calc','taskmgr','git','structogram','game','sql','fun','guide','about'],32,'lm-app')}</div><div class="sm11-headrow"><b>Empfohlen</b><button>Weitere ›</button></div><div class="sm11-recent">${recent.map(e=>`<button data-open="${esc(joinPath(proj,e.name))}">${fileIcon(e.name)}<span>${esc(e.name)}<small>${new Date(e.mtime).toLocaleDateString('de-DE')}</small></span></button>`).join('')}</div></div><div class="sm11-all">${[...ALL_APPS].sort((a,b)=>this.name(a).localeCompare(this.name(b),'de')).map(id=>`<button class="lm-app" data-launch="${id}">${this.icon(id,24)}<span>${esc(this.name(id))}</span></button>`).join('')}</div><div class="sm11-foot"><button data-launch="home">${lineIcon('user',20)} Student</button><button data-power="menu" title="Ein/Aus">${lineIcon('power',18)}</button></div></div>`}
  menuKDE(){return`<div class="start-menu sm-kde"><div class="kde-head"><span class="kde-avatar">${lineIcon('user',24)}</span><b>Student</b><label class="lm-search"><input placeholder="Suchen …"></label></div><div class="lm-search-results"></div><div class="kde-body"><div class="kde-cats"><button data-cat="fav" class="on">${lineIcon('star',16)} Favoriten</button><button data-cat="all">${lineIcon('apps',16)} Alle Anwendungen</button><button data-cat="dev">${appIcon('ide')} Entwicklung</button><button data-cat="sys">${appIcon('settings')} System</button><button data-cat="util">${appIcon('calc')} Dienstprogramme</button><button data-cat="games">${appIcon('game')} Spiele</button><button data-cat="help">${appIcon('guide')} Hilfe</button></div><div class="kde-apps"></div></div><div class="kde-foot"><button data-launch="home">${lineIcon('home',16)} Orte</button><span></span><button data-power="sleep">${lineIcon('moon',16)} Standby</button><button data-power="restart">${lineIcon('restart',16)} Neu starten</button><button data-power="shutdown">${lineIcon('power',16)} Herunterfahren</button><button data-power="logout">${lineIcon('user',16)}</button></div></div>`}
  renderKdeCat(el,cat){const map={fav:['browser','files','terminal','ide','editor','settings','taskmgr','calc','git','game'],all:[...ALL_APPS].sort((a,b)=>this.name(a).localeCompare(this.name(b),'de')),dev:['ide','terminal','git','structogram','sql','editor'],sys:['terminal','files','settings','taskmgr','about'],util:['calc','editor','fun'],games:['game','fun'],help:['guide','about']};const box=$('.kde-apps',el);if(!box)return;box.innerHTML=this.appButtons(map[cat]||map.fav,32,cat==='fav'?'lm-app tile-ish':'lm-app');$$('[data-launch]',box).forEach(b=>b.onclick=()=>{this.closeMenus();this.app.launch(b.dataset.launch)})}
  listMenu(ids){return`<div class="pop-list">${ids.map(id=>`<button data-launch="${id}">${this.icon(id,20)}<span>${esc(this.name(id))}</span></button>`).join('')}</div>`}

  // ---------- macOS ----------
  appleMenu(anchor){const r=anchor.getBoundingClientRect();this.contextMenu(r.left,r.bottom+2,[{label:'Über diesen Mac',action:()=>this.app.launch('about')},{sep:true},{label:'Systemeinstellungen …',action:()=>this.app.launch('settings')},{label:'App Store …',disabled:true},{sep:true},{label:'Benutzte Objekte',submenu:ALL_APPS.slice(0,6).map(id=>({label:this.name(id),action:()=>this.app.launch(id)}))},{sep:true},{label:'Sofort beenden …',action:()=>this.app.launch('taskmgr')},{sep:true},{label:'Ruhezustand',action:()=>this.app.power('sleep')},{label:'Neustart …',action:()=>this.app.power('restart')},{label:'Ausschalten …',action:()=>this.app.power('shutdown')},{sep:true},{label:'Bildschirm sperren',action:()=>this.app.power('lock')},{label:'„Student“ abmelden …',action:()=>this.app.power('logout')}],{menubar:true})}
  macAppMenu(anchor){const w=this.app.activeWindow;const name=$('.mb-app b',this.ui).textContent;const r=anchor.getBoundingClientRect();this.contextMenu(r.left,r.bottom+2,[{label:`Über ${name}`,action:()=>this.app.launch('about')},{sep:true},{label:'Einstellungen …',action:()=>this.app.launch('settings')},{sep:true},{label:`${name} ausblenden`,action:()=>w&&this.app.minimizeWindow(w)},{sep:true},{label:`${name} beenden`,disabled:!w,action:()=>w&&this.app.closeWindowById(w.id)}],{menubar:true})}
  macMenu(name,anchor){const app=this.app,w=app.activeWindow;const r=anchor.getBoundingClientRect();const h=homePath(this.os);const menus={Ablage:[{label:'Neues Finder-Fenster',action:()=>app.launch('files')},{label:'Neues Terminal-Fenster',action:()=>app.launch('terminal')},{sep:true},{label:'Fenster schließen',disabled:!w,action:()=>w&&app.closeWindowById(w.id)}],Bearbeiten:[{label:'Widerrufen',action:()=>document.execCommand('undo')},{sep:true},{label:'Ausschneiden',action:()=>document.execCommand('cut')},{label:'Kopieren',action:()=>document.execCommand('copy')},{label:'Alles auswählen',action:()=>document.execCommand('selectAll')}],Darstellung:[{label:'Dunkles Erscheinungsbild',action:()=>app.setSetting('theme',app.desktop.classList.contains('theme-dark')?'light':'dark')},{label:'Vollbild',action:()=>w&&app.toggleMax(w)}],'Gehe zu':[{label:'Schreibtisch',action:()=>app.openFiles(joinPath(h,'Desktop'))},{label:'Dokumente',action:()=>app.openFiles(joinPath(h,'Documents'))},{label:'Benutzerordner',action:()=>app.openFiles(h)},{label:'Programme',action:()=>this.appGrid()},{label:'Dienstprogramme',action:()=>app.openFiles('/Applications')}],Fenster:[{label:'Im Dock ablegen',disabled:!w,action:()=>w&&app.minimizeWindow(w)},{label:'Zoomen',disabled:!w,action:()=>w&&app.toggleMax(w)},{sep:true},...[...app.windows.values()].map(x=>({label:(x===w?'✓ ':'   ')+x.title,action:()=>app.restoreWindow(x)}))],Hilfe:[{label:'DesktopSim-Anleitung',action:()=>app.launch('guide')},{label:'Tastaturkurzbefehle',action:()=>app.openGuide()}]};this.contextMenu(r.left,r.bottom+2,menus[name]||[],{menubar:true})}
  spotlight(){
    if(this.menu?.kind==='spotlight'){this.closeMenus();return}
    const el=this.popupCentered(`<div class="spotlight"><label>${lineIcon('search',22)}<input placeholder="Spotlight-Suche" aria-label="Spotlight"></label><div class="lm-search-results"></div></div>`,'spotlight');
    const input=$('input',el);setTimeout(()=>input.focus(),20);
    input.oninput=()=>{const box=$('.lm-search-results',el);box.innerHTML=this.searchResults(input.value);$$('[data-launch]',box).forEach(b=>b.onclick=()=>{this.closeMenus();this.app.launch(b.dataset.launch)});$$('[data-open]',box).forEach(b=>b.onclick=()=>{this.closeMenus();this.app.openPath(b.dataset.open)})};
    input.onkeydown=e=>{if(e.key==='Enter')$('.lm-search-results button',el)?.click()};
  }
  appGrid(){
    if(this.menu?.kind==='appgrid'){this.closeMenus();return}
    const el=this.popupCentered(`<div class="app-grid ag-${this.fam}">${this.fam==='mac'?'<label class="ag-search"><input placeholder="Suchen"></label>':''}<div class="ag-items">${[...ALL_APPS,'about','calc'].filter((v,i,a)=>a.indexOf(v)===i).map(id=>`<button data-launch="${id}">${this.icon(id,64)}<span>${esc(this.name(id))}</span></button>`).join('')}</div></div>`,'appgrid');
    el.classList.add('fullscreen');el.onclick=e=>{if(e.target===el||e.target.classList.contains('app-grid'))this.closeMenus()};
    $$('[data-launch]',el).forEach(b=>b.onclick=e=>{e.stopPropagation();this.closeMenus();this.exitOverview();this.app.launch(b.dataset.launch)});
    const s=$('.ag-search input',el);if(s){setTimeout(()=>s.focus(),30);s.oninput=()=>$$('[data-launch]',el).forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(s.value.toLowerCase()))}
  }

  // ---------- Übersicht (Aktivitäten / Taskansicht / Mission Control) ----------
  toggleOverview(){if(this.overview)this.exitOverview();else this.enterOverview()}
  enterOverview(){this.closeMenus();this.overview=true;this.app.desktop.classList.add('overview');if(this.fam==='gnome'){const s=$('.gnome-search input',this.ui);s.value='';setTimeout(()=>s.focus(),50)}this.layoutOverview()}
  exitOverview(){if(!this.overview)return false;this.overview=false;this.app.desktop.classList.remove('overview');for(const w of this.app.windows.values()){w.element.style.transform='';w.element.onclick=null;w.element.classList.remove('ov')}$('.gnome-results',this.ui)?.remove();return true}
  layoutOverview(){
    const wins=[...this.app.windows.values()].filter(w=>!w.minimized&&w.workspace===this.app.workspace);const L=this.app.layer.getBoundingClientRect();
    const n=wins.length;if(!n)return;const cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols);const pad=40,top=this.fam==='gnome'?40:20,bottom=this.fam==='gnome'?110:30;const cw=(L.width-pad*2)/cols,ch=(L.height-top-bottom)/rows;
    wins.forEach((w,i)=>{const el=w.element;const r={x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight};if(w.maximized){r.x=0;r.y=0;r.w=L.width;r.h=L.height}const s=Math.min(1,(cw-30)/r.w,(ch-40)/r.h);const cx=pad+(i%cols)*cw+cw/2,cy=top+Math.floor(i/cols)*ch+ch/2;el.classList.add('ov');el.style.transform=`translate(${cx-(r.x+r.w/2)}px,${cy-(r.y+r.h/2)}px) scale(${s})`;el.onclick=e=>{e.stopPropagation();e.preventDefault();this.exitOverview();this.app.focusWindow(w)}});
  }
  gnomeSearch(q){let box=$('.gnome-results',this.ui);if(!q.trim()){box?.remove();return}if(!box){box=document.createElement('div');box.className='gnome-results';this.ui.append(box)}box.innerHTML=this.searchResults(q);$$('[data-launch]',box).forEach(b=>b.onclick=()=>{this.exitOverview();this.app.launch(b.dataset.launch)});$$('[data-open]',box).forEach(b=>b.onclick=()=>{this.exitOverview();this.app.openPath(b.dataset.open)});$('.gnome-search input',this.ui).onkeydown=e=>{if(e.key==='Enter')$('button',box)?.click()}}

  // ---------- Popups & Kontextmenüs ----------
  popup(anchor,html,kind){
    if(this.menu?.kind===kind&&this.menu.anchor===anchor){this.closeMenus();return null}
    this.closeMenus();const el=document.createElement('div');el.className=`popup popup-${kind} fam-${this.fam}`;el.innerHTML=html;this.overlay.append(el);
    const d=this.app.desktop.getBoundingClientRect(),r=anchor?.getBoundingClientRect?.()||{left:d.left+10,top:d.bottom-50,width:40,height:40,bottom:d.bottom};
    const w=el.offsetWidth,h=el.offsetHeight;let left,top;
    const centered=kind==='launcher'&&(this.os==='win11'||this.os==='win8');
    if(this.os==='win8'&&kind==='launcher'){left=0;top=0;el.classList.add('fullscreen')}
    else if(centered){left=(d.width-w)/2;top=d.height-h-62}
    else if(this.fam==='mac'||this.fam==='gnome'||(this.fam==='cde'&&kind!=='cde-sub')){left=Math.min(r.left-d.left+r.width/2-w/2,d.width-w-8);top=this.fam==='cde'?r.top-d.top-h-6:r.bottom-d.top+6}
    else{left=kind==='launcher'?(this.os==='winxp'?0:this.fam==='kde'?r.left-d.left:4):Math.min(r.left-d.left+r.width/2-w/2,d.width-w-8);top=r.top-d.top-h-(this.os==='winxp'&&kind==='launcher'?0:8)}
    if(kind==='calendar'||kind==='quick'){if(this.fam==='windows'||this.fam==='kde'){left=d.width-w-(this.fam==='kde'?12:10);top=r.top-d.top-h-10}}
    el.style.left=Math.max(4,left)+'px';el.style.top=Math.max(this.fam==='mac'?28:4,top)+'px';
    this.menu={el,kind,anchor};requestAnimationFrame(()=>el.classList.add('open'));
    $$('[data-launch]',el).forEach(b=>{if(!b.onclick)b.onclick=()=>{this.closeMenus();this.app.launch(b.dataset.launch)}});
    return el;
  }
  popupCentered(html,kind){this.closeMenus();const el=document.createElement('div');el.className=`popup popup-${kind} fam-${this.fam} centered`;el.innerHTML=html;this.overlay.append(el);this.menu={el,kind};requestAnimationFrame(()=>el.classList.add('open'));return el}
  closeMenus(){let closed=false;if(this.menu){this.menu.el.remove();this.menu=null;closed=true}$$('.ctx-menu',this.overlay).forEach(m=>{m.remove();closed=true});$$('.tb-start,.kp-launcher',this.ui||document).forEach(b=>b.classList.remove('pressed'));$$('.popup',this.overlay).forEach(m=>m.remove());return closed}
  contextMenu(x,y,items,opts={}){
    if(!opts.keep)this.closeMenus();else $$('.ctx-menu',this.overlay).forEach(m=>m.remove());
    const d=this.app.desktop.getBoundingClientRect();
    const build=(list,px,py,level=0)=>{
      const m=document.createElement('div');m.className=`ctx-menu fam-${this.fam} os-${this.os}`;m.dataset.level=level;m.setAttribute('role','menu');
      m.innerHTML=list.map((it,i)=>it.sep?'<hr>':it.header?`<div class="ctx-head">${esc(it.label)}</div>`:`<button type="button" role="menuitem" data-i="${i}" class="${it.bold?'bold':''} ${it.submenu?'has-sub':''}" ${it.disabled?'disabled':''}>${it.icon?`<span class="ctx-ico">${lineIcon(it.icon,15)}</span>`:'<span class="ctx-ico"></span>'}<span>${esc(it.label)}</span>${it.shortcut?`<kbd>${esc(it.shortcut)}</kbd>`:''}${it.submenu?'<span class="ctx-arrow">▸</span>':''}</button>`).join('');
      this.overlay.append(m);const w=m.offsetWidth,h=m.offsetHeight;let left=px-d.left,top=opts.above&&level===0?py-d.top-h-4:py-d.top;
      if(left+w>d.width-4)left=level?left-w*2+4:d.width-w-4;if(top+h>d.height-4)top=Math.max(4,d.height-h-4);if(top<4)top=4;m.style.left=left+'px';m.style.top=top+'px';
      $$('button[data-i]',m).forEach(b=>{const it=list[+b.dataset.i];
        b.addEventListener('mouseenter',()=>{$$(`.ctx-menu[data-level="${level+1}"]`,this.overlay).forEach(s=>s.remove());if(it.submenu&&!it.disabled){const r=b.getBoundingClientRect();build(it.submenu,r.right-2,r.top-4,level+1)}});
        b.addEventListener('click',e=>{e.stopPropagation();if(it.submenu)return;this.closeMenus();it.action?.()})});
      return m;
    };
    build(items,x,y);
  }
  windowMenu(win,btn){const r=btn.getBoundingClientRect();this.contextMenu(r.left,r.bottom,[{label:'Wiederherstellen',action:()=>{if(win.maximized)this.app.toggleMax(win)}},{label:'Verschieben',disabled:true},{label:'Größe',disabled:true},{label:'Minimieren',action:()=>this.app.minimizeWindow(win)},{label:'Maximieren',action:()=>{if(!win.maximized)this.app.toggleMax(win)}},{label:'Nach unten',action:()=>{win.element.style.zIndex=1}},{sep:true},{label:'Schließen',shortcut:'Alt+F4',action:()=>this.app.closeWindowById(win.id)}])}
  snapPreview(where){const el=$('.snap-preview',this.ui);if(!el)return;if(!where){el.hidden=true;return}const L=this.app.layer;el.hidden=false;Object.assign(el.style,{left:L.offsetLeft+(where==='right'?L.clientWidth/2:0)+'px',top:L.offsetTop+'px',width:(where==='max'?L.clientWidth:L.clientWidth/2)+'px',height:L.clientHeight+'px'})}
  snapLayouts(win){
    if(this.os!=='win11'||win.element.classList.contains('fixed-size'))return;const btn=$('[data-wbtn="max"]',win.element);clearTimeout(this.snapTimer);
    this.snapTimer=setTimeout(()=>{if(!btn.matches(':hover'))return;const el=this.popup(btn,`<div class="snap-layouts"><div class="sl"><button data-snap="left"></button><button data-snap="right"></button></div><div class="sl"><button data-snap="left"></button><div class="sl-col"><button data-snap="top-right"></button><button data-snap="bottom-right"></button></div></div><div class="sl q"><button data-snap="top-left"></button><button data-snap="top-right"></button><button data-snap="bottom-left"></button><button data-snap="bottom-right"></button></div></div>`,'snap');if(!el)return;const r=btn.getBoundingClientRect(),d=this.app.desktop.getBoundingClientRect();el.style.left=Math.min(r.left-d.left-110,d.width-el.offsetWidth-6)+'px';el.style.top=r.bottom-d.top+6+'px';$$('[data-snap]',el).forEach(b=>b.onclick=()=>{this.closeMenus();this.app.snapWindow(win,b.dataset.snap)});el.addEventListener('mouseleave',()=>this.closeMenus())},550);
  }

  // ---------- Benachrichtigungen ----------
  notify(title,body,icon='about'){
    const area=$('.notify-area',this.ui);if(!area)return;const n=document.createElement('div');n.className=`notice fam-${this.fam} os-${this.os}`;
    n.innerHTML=`<span class="notice-ico">${this.icon(icon,this.fam==='mac'?34:28)}</span><div><b>${esc(title)}</b><p>${esc(body)}</p></div><button class="notice-x" aria-label="Schließen">×</button>`;
    area.append(n);requestAnimationFrame(()=>n.classList.add('in'));const close=()=>{n.classList.remove('in');setTimeout(()=>n.remove(),300)};$('.notice-x',n).onclick=close;setTimeout(close,6500);
    while(area.children.length>3)area.firstElementChild.remove();
  }

  // ---------- Boot, Anmeldung, Herunterfahren ----------
  screen(){const s=$('#system-screen');s.hidden=false;s.className=`system-screen os-${this.os} fam-${this.fam}`;return s}
  hideScreen(){const s=$('#system-screen');s.classList.add('fade');setTimeout(()=>{s.hidden=true;s.className='system-screen';s.innerHTML=''},350)}
  skippable(ms,s){return new Promise(resolve=>{const done=()=>{clearTimeout(t);s.removeEventListener('click',done);removeEventListener('keydown',done);resolve()};const t=setTimeout(done,ms);s.addEventListener('click',done);addEventListener('keydown',done)})}
  async boot(id,{quick}={}){
    const s=this.screen();if(quick){s.innerHTML='';await wait(50);return}
    const os=id,label=getOS(id).label;
    if(os==='winxp'){s.innerHTML=`<div class="boot-xp"><div class="bx-logo">${osMark('winxp')}<span>Windows<sup>XP</sup></span></div><div class="bx-bar"><i></i></div><small>DesktopSim · simulierter Start</small></div>`;await this.skippable(3200,s)}
    else if(os==='win7'){s.innerHTML=`<div class="boot-7"><div class="b7-orb"><i></i><i></i><i></i><i></i></div><p>Windows wird gestartet</p></div>`;await this.skippable(3200,s)}
    else if(isWindows(os)){s.innerHTML=`<div class="boot-10"><span class="b10-logo">${osMark(os)}</span><div class="spinner-dots">${'<i></i>'.repeat(5)}</div></div>`;await this.skippable(2800,s)}
    else if(os==='macos'){s.innerHTML=`<div class="boot-mac"><span class="bm-logo">${osMark('macos')}</span><div class="bm-bar"><i></i></div></div>`;await this.skippable(2600,s)}
    else{
      const lines=os==='unix'?['SunOS Release 5.11 Version 11.4.81.193.1 64-bit','Copyright (c) 1983, 2025, Oracle and/or its affiliates.','Hostname: workstation','Configuring devices.','Loading smf(7) service descriptions: 214/214','NIS domain name is desktopsim.local','','workstation console login: CDE wird gestartet …']:['[    0.000000] Linux version '+(os==='arch'?'6.17.7-arch1-1':'6.12.48+deb13-amd64'),...['Mounting /boot/efi','Started Journal Service','Reached target Local File Systems','Starting Network Manager...','Started Network Manager','Reached target Network','Started Login Service','Started Accounts Service','Started D-Bus System Message Bus','Starting '+(os==='arch'?'Simple Desktop Display Manager':'GNOME Display Manager')+'...','Started '+(os==='arch'?'Simple Desktop Display Manager':'GNOME Display Manager')].map(l=>`[  <b>OK</b>  ] ${l}.`)];
      if(os!=='unix'){s.innerHTML=`<div class="grub"><div class="grub-title">GNU GRUB  version 2.12</div><div class="grub-box"><div class="sel">*${os==='arch'?'Arch Linux':'Debian GNU/Linux'}</div><div>${os==='arch'?' Advanced options for Arch Linux':' Erweiterte Optionen für Debian GNU/Linux'}</div><div> UEFI Firmware Settings</div></div><p>Verwenden Sie die Tasten ↑ und ↓, um einen Eintrag auszuwählen.<br>Der markierte Eintrag wird in 1 s automatisch ausgeführt.</p></div>`;await this.skippable(1400,s)}
      s.innerHTML='<pre class="bootlog"></pre>';const pre=$('pre',s);let skip=false;const stop=()=>skip=true;s.addEventListener('click',stop,{once:true});
      for(const l of lines){if(skip)break;pre.innerHTML+=esc(l).replace('&lt;b&gt;','<b>').replace('&lt;/b&gt;','</b>')+'\n';await wait(120+Math.random()*120)}
      await wait(skip?0:350);
    }
  }
  async login(id,{quick,lock}={}){
    const s=this.screen();const os=id;const d=new Date();const time=`${pad(d.getHours())}:${pad(d.getMinutes())}`;const date=d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
    if(quick&&!lock){this.hideScreen();return}
    const avatar=`<span class="lg-avatar">${lineIcon('user',os==='winxp'?34:56)}</span>`;
    const pw=(ph='Kennwort')=>`<form class="lg-form"><input type="password" placeholder="${ph}" aria-label="${ph}" autocomplete="off"><button type="submit" aria-label="Anmelden">${lineIcon('chevronRight',18)}</button></form>`;
    const views={
      winxp:`<div class="login-xp"><div class="lx-top"></div><div class="lx-mid"><div class="lx-left"><div class="lx-logo">${osMark('winxp')}<span>Windows<sup>XP</sup></span></div><p>Klicken Sie auf Ihren Benutzernamen, um sich anzumelden.</p></div><div class="lx-right"><button class="lx-user" data-login>${avatar}<b>Student</b></button></div></div><div class="lx-bottom"><button data-off>${lineIcon('power',18)} Computer ausschalten</button><small>Nach der Anmeldung können Sie dem Computer weitere Benutzer hinzufügen.</small></div></div>`,
      win7:`<div class="login-7">${avatar}<b>Student</b>${pw()}<button class="lg-off" data-off>${lineIcon('power',18)}</button><span class="lg-brand">Windows 7 · DesktopSim</span></div>`,
      cde:`<div class="login-cde"><div class="lc-box"><h2>Willkommen auf workstation</h2><label>Bitte geben Sie Ihren Benutzernamen ein<input value="student" readonly></label><form class="lg-form"><label>Kennwort<input type="password" autocomplete="off"></label><div class="lc-btns"><button type="submit">OK</button><button type="button">Neu starten</button><button type="button" data-off>Optionen</button><button type="button">Hilfe</button></div></form></div><span class="lc-brand">Common Desktop Environment</span></div>`,
      gnome:`<div class="login-gdm"><div class="lg-top"><span></span><b>${DE_DAYS[d.getDay()]}. ${d.getDate()}. ${DE_MON[d.getMonth()]} ${time}</b><span>${lineIcon('wifi',15)}${lineIcon('volume',15)}${lineIcon('power',15)}</span></div><div class="lg-center">${avatar}<b>Student</b>${pw('Passwort')}</div><span class="lg-brand">debian</span></div>`,
      kde:`<div class="login-sddm"><div class="ls-clock">${time}<small>${date}</small></div><div class="lg-center">${avatar}<b>Student</b>${pw('Passwort')}</div><div class="ls-actions"><button>${lineIcon('moon',18)}<small>Standby</small></button><button data-restart>${lineIcon('restart',18)}<small>Neu starten</small></button><button data-off>${lineIcon('power',18)}<small>Herunterfahren</small></button></div></div>`,
      mac:`<div class="login-mac"><div class="lm-clock"><small>${date}</small>${time}</div><div class="lg-center">${avatar}<b>Student</b>${pw('Passwort eingeben')}<small class="lm-hint">${lock?'Touch ID oder Passwort eingeben':'Klicke oder drücke Enter (beliebiges Passwort)'}</small></div></div>`,
      lock10:`<div class="lock-10"><div class="l10-clock">${time}<small>${date}</small></div><span class="l10-hint">Klicken oder Taste drücken zum Entsperren</span></div>`,
      login10:`<div class="login-10">${avatar}<b>Student</b>${pw(os==='win11'||os==='win10'?'PIN oder Kennwort':'Kennwort')}<span class="lg-tools"><button>${lineIcon('wifi',18)}</button><button data-off>${lineIcon('power',18)}</button></span></div>`
    };
    const fam=this.fam;const key=os==='winxp'?'winxp':os==='win7'?'win7':isWindows(os)?'lock10':fam;
    s.innerHTML=views[key];s.classList.add('login');
    if(key==='lock10'){await new Promise(r=>{const go=()=>{s.removeEventListener('click',go);removeEventListener('keydown',go);r()};s.addEventListener('click',go);addEventListener('keydown',go)});s.innerHTML=views.login10}
    await new Promise(resolve=>{
      const finish=()=>{this.hideScreen();resolve()};
      const form=$('.lg-form',s);if(form){const input=$('input[type=password]',form);setTimeout(()=>input?.focus(),80);form.onsubmit=async e=>{e.preventDefault();s.classList.add('busy');if(isWindows(os)&&os!=='winxp'){s.insertAdjacentHTML('beforeend',`<div class="welcome-msg"><div class="spinner-dots">${'<i></i>'.repeat(5)}</div>Willkommen</div>`);await wait(lock?300:900)}finish()}}
      $$('[data-login]',s).forEach(b=>b.onclick=async()=>{b.classList.add('chosen');await wait(500);finish()});
      $$('[data-off]',s).forEach(b=>b.onclick=e=>{e.preventDefault();this.hideScreen();this.app.desktop.classList.remove('ready');this.app.showLanding();resolve()});
      $$('[data-restart]',s).forEach(b=>b.onclick=e=>{e.preventDefault();this.app.power('restart');resolve()});
    });
  }
  async shutdownScreen(id,action){
    const s=this.screen();const os=id;const msg=action==='restart'?'Wird neu gestartet':action==='logout'?'Abmelden':'Wird heruntergefahren';
    if(os==='winxp')s.innerHTML=`<div class="shut-xp"><div class="lx-top"></div><div class="lx-mid"><div class="lx-logo">${osMark('winxp')}<span>Windows<sup>XP</sup></span></div><p>${action==='logout'?'Abmeldung …':action==='restart'?'Windows wird neu gestartet …':'Windows wird heruntergefahren …'}</p></div><div class="lx-bottom"></div></div>`;
    else if(isWindows(os))s.innerHTML=`<div class="shut-10"><div class="spinner-dots">${'<i></i>'.repeat(5)}</div><p>${msg}</p></div>`;
    else if(os==='macos'||os==='unix')s.innerHTML='<div class="shut-black"></div>';
    else s.innerHTML=`<pre class="bootlog">${['Stopping User Manager for UID 1000...','Stopped target Graphical Interface.','Stopping '+(os==='arch'?'Simple Desktop Display Manager':'GNOME Display Manager')+'...','Stopped Network Manager.','Unmounted /home.','Reached target System '+(action==='restart'?'Reboot':'Power Off')+'.'].map(l=>`[  <b>OK</b>  ] ${l}`).join('\n')}</pre>`;
    await wait(action==='logout'?700:1500);s.innerHTML='<div class="shut-black"></div>';await wait(350);
  }
  async sleep(){const s=this.screen();s.innerHTML='<div class="shut-black sleep"><small>Ruhezustand · klicken zum Aufwecken</small></div>';await new Promise(r=>{const go=()=>{s.removeEventListener('click',go);removeEventListener('keydown',go);r()};s.addEventListener('click',go);addEventListener('keydown',go)});if(this.fam!=='cde')await this.login(this.os,{lock:true});else this.hideScreen()}
}
