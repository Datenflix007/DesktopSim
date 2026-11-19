// Einstellungen, Task-Manager, Rechner, Info-Dialog, Ausführen, SQL Studio und Anleitung.
import {getOS,isWindows,homePath,joinPath,pathDisplay} from '../vfs.js';
import {appIcon,lineIcon,osMark} from '../ui/icons.js';
import {escapeHTML as esc} from './classic.js';
import {shellHelp} from '../terminal.js';

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const ACCENTS=['#0067c0','#0078d4','#e74856','#ff8c00','#10893e','#8764b8','#00b7c3','#c239b3','#3584e4','#3daee9'];
const RUNTIMES=[['python','Python 3.14','Pyodide (CPython als WebAssembly)','≈ 10 MB'],['js','JavaScript / Node','JavaScript-Engine des Browsers + Node-Module (fs, readline, path)','eingebaut'],['clang','C / C++','Clang/LLVM 22 → WebAssembly (WASI)','≈ 100 MB'],['java','Java 8','OpenJDK javac + CheerpJ-JVM','≈ 30 MB'],['php','PHP 8.4','php-wasm','≈ 13 MB'],['sqlite','SQLite 3','sql.js (WebAssembly)','≈ 1 MB'],['cs','C#','Ausgabe-Demo (keine .NET-Laufzeit im Browser)','—']];

export class SystemApps{
  // ---------- Einstellungen ----------
  openSettings(page='personalize'){
    const fam=this.profile.family,os=this.currentOS;
    const w=this.makeWindow('settings',this.appName('settings'),'settings',{width:860,height:560});
    w.content.className=`window-content st st-${fam} st-${os}`;
    const pages=[['personalize','Personalisierung','sun'],['display','Bildschirm','grid'],['runtimes','Programmiersprachen','terminal'],['storage','Speicher & Sicherung','save'],['about','Info','info']];
    const render=()=>{
      const s=this.settings;const body={
        personalize:`<h2>Personalisierung</h2><section><h3>Hintergrund</h3><div class="st-walls">${[0,1,2,3].map(i=>`<button class="st-wall ${String(s.wallpaper||0)===String(i)?'on':''}" data-wall="${i}" data-os="${os}" data-wallpaper="${i}" title="Hintergrund ${i+1}"></button>`).join('')}</div></section><section><h3>Farbmodus</h3><div class="st-seg">${[['default','Standard'],['light','Hell'],['dark','Dunkel']].map(([v,l])=>`<button data-theme="${v}" class="${(s.theme||'default')===v?'on':''}">${l}</button>`).join('')}</div></section><section><h3>Akzentfarbe</h3><div class="st-accents"><button data-accent="" class="${!s.accent?'on':''}" title="Automatisch">A</button>${ACCENTS.map(c=>`<button data-accent="${c}" class="${s.accent===c?'on':''}" style="background:${c}" title="${c}"></button>`).join('')}</div></section>`,
        display:`<h2>Bildschirm</h2><section><h3>Text- und Elementgröße</h3><div class="st-seg">${[[0.9,'90 %'],[1,'100 %'],[1.1,'110 %'],[1.25,'125 %']].map(([v,l])=>`<button data-scale="${v}" class="${Number(s.textScale||1)===v?'on':''}">${l}</button>`).join('')}</div></section><section><h3>Vollbild</h3><p>Blendet die DesktopSim-Leiste aus, damit sich der simulierte Rechner wie ein echter Bildschirm anfühlt.</p><button class="st-btn" data-act="fullscreen">${lineIcon('grid',15)} Vollbild umschalten</button></section><section><h3>Start</h3><label class="st-check"><input type="checkbox" data-quickboot ${this.global.quickBoot?'checked':''}> Schnellstart (Boot- und Anmeldebildschirm überspringen)</label></section>`,
        runtimes:`<h2>Programmiersprachen</h2><p>Diese Laufzeiten führen deinen Code <b>wirklich</b> aus – vollständig im Browser, ohne Server. Sie werden beim ersten Gebrauch geladen und danach zwischengespeichert.</p><table class="st-table"><thead><tr><th>Sprache</th><th>Technik</th><th>Download</th><th>Status</th><th></th></tr></thead><tbody>${RUNTIMES.map(([id,name,tech,size])=>`<tr><td><b>${name}</b></td><td>${tech}</td><td>${size}</td><td class="st-state" data-state="${id}">${this.runtimeState(id)}</td><td>${['python','clang','java','php','sqlite'].includes(id)?`<button class="st-btn sm" data-preload="${id}">Vorladen</button>`:''}</td></tr>`).join('')}</tbody></table><p class="st-note">Java nutzt CheerpJ (Leaning Technologies, „Built with CheerpJ“, kostenlos für private und schulische Nutzung). C++-Exceptions (<code>throw/try</code>) sind in der WebAssembly-Sandbox abgeschaltet.</p><button class="st-btn" data-act="clearcache">${lineIcon('trash',15)} Zwischengespeicherte Laufzeiten löschen</button>`,
        storage:`<h2>Speicher & Sicherung</h2><section><h3>Virtuelles Dateisystem</h3><p>${esc(this.storageInfo())}</p><div class="st-row"><button class="st-btn" data-act="export">${lineIcon('download',15)} Sichern (JSON)</button><button class="st-btn" data-act="import">${lineIcon('upload',15)} Wiederherstellen …</button></div></section><section><h3>Zurücksetzen</h3><p>Setzt Dateien, Datenbanken, installierte Pakete und Git-Daten von ${esc(this.os.label)} zurück.</p><button class="st-btn danger" data-act="reset">${lineIcon('restart',15)} ${esc(this.os.label)} zurücksetzen</button></section>`,
        about:`<h2>Info</h2><div class="st-about"><span class="st-mark">${osMark(os)}</span><div><b>${esc(this.os.label)}</b><p>DesktopSim · interaktives Betriebssystem-Labor</p></div></div><dl class="st-dl"><dt>Gerätename</dt><dd>${isWindows(os)?'DESKTOP-SIM':{debian:'debian-sim',arch:'arch-sim',macos:'Mac',unix:'workstation'}[os]}</dd><dt>Prozessor</dt><dd>Browser vCPU (${navigator.hardwareConcurrency||8} Threads)</dd><dt>Arbeitsspeicher</dt><dd>16 GB (simuliert)</dd><dt>Kernel</dt><dd>${esc(getOS(os).kernel||'')}</dd><dt>Standard-Shell</dt><dd>${esc(this.os.shell)}</dd><dt>Browser</dt><dd>${esc(navigator.userAgent.split(') ').pop().split(' ')[0])}</dd></dl><button class="st-btn" data-act="aboutwin">${lineIcon('info',15)} ${esc(this.appName('about'))}</button>`
      }[page];
      w.content.innerHTML=`<aside class="st-nav"><div class="st-user">${lineIcon('user',30)}<span><b>Student</b><small>Lokales Konto</small></span></div>${pages.map(([id,l,ic])=>`<button data-page="${id}" class="${id===page?'on':''}">${lineIcon(ic,17)} ${l}</button>`).join('')}</aside><main class="st-main">${body}</main>`;
      $$('[data-page]',w.content).forEach(b=>b.onclick=()=>{page=b.dataset.page;render()});
      $$('[data-wall]',w.content).forEach(b=>b.onclick=()=>{this.setSetting('wallpaper',+b.dataset.wall);render()});
      $$('[data-theme]',w.content).forEach(b=>b.onclick=()=>{this.setSetting('theme',b.dataset.theme==='default'?null:b.dataset.theme);render()});
      $$('[data-accent]',w.content).forEach(b=>b.onclick=()=>{this.setSetting('accent',b.dataset.accent||null);render()});
      $$('[data-scale]',w.content).forEach(b=>b.onclick=()=>{this.setSetting('textScale',+b.dataset.scale);render()});
      $('[data-quickboot]',w.content)?.addEventListener('change',e=>{this.global.quickBoot=e.target.checked;this.saveJSON('desktopsim-v3-global',this.global)});
      $$('[data-preload]',w.content).forEach(b=>b.onclick=()=>this.preloadRuntime(b.dataset.preload,$(`[data-state="${b.dataset.preload}"]`,w.content)));
      $$('[data-act]',w.content).forEach(b=>b.onclick=async()=>{const a=b.dataset.act;if(a==='fullscreen')this.toggleFullscreen();if(a==='export')this.exportFiles();if(a==='import')$('#import-input').click();if(a==='reset')this.resetData();if(a==='aboutwin')this.openAbout();if(a==='clearcache'){try{await caches.delete('desktopsim-runtimes-v1')}catch{}this.notify(this.appName('settings'),'Zwischengespeicherte Laufzeiten wurden gelöscht.','settings')}});
    };
    w.refresh=()=>{if(page==='storage')render()};render();return w;
  }
  storageInfo(){let bytes=0;try{bytes=JSON.stringify(this.fs.root).length}catch{}return`${(bytes/1024).toFixed(1).replace('.',',')} KB von 4 MB im Browser-Speicher belegt (localStorage, nur auf diesem Gerät).`}
  runtimeState(id){const s=this.runtimes.state;if(id==='js')return'✓ bereit';if(id==='cs')return'Demo';if(id==='sqlite')return this._sqlLoaded?'✓ geladen':'bei Bedarf';return s[id==='clang'?'clang':id]?'✓ geladen':'bei Bedarf'}
  preloadRuntime(id,cell){
    const io={write:()=>{},status:t=>{if(cell&&t)cell.textContent=t.replace(/^.*?:\s*/,'')},readLine:async()=>null,image:()=>{}};if(cell)cell.textContent='lädt …';
    const done=ok=>{if(cell)cell.textContent=ok?'✓ geladen':'Fehler (Netzwerk?)'};
    if(id==='python')this.runtimes.runPython({source:'pass'},io).promise.then(r=>done(!r.fatal));
    if(id==='php')this.runtimes.runPHP({source:'<?php '},io).promise.then(r=>done(!r.fatal));
    if(id==='clang')this.runtimes.warmClang(io).promise.then(r=>done(!r.fatal));
    if(id==='java')this.runtimes.compileJava({files:{'Warmup.java':'public class Warmup { public static void main(String[] a) {} }'}},io).promise.then(r=>done(r.code===0)).catch(()=>done(false));
    if(id==='sqlite')import('../runtime/sqlite.js').then(m=>m.loadSQL()).then(()=>{this._sqlLoaded=true;done(true)},()=>done(false));
  }

  // ---------- Task-Manager / Systemmonitor ----------
  openTaskManager(){
    const fam=this.profile.family,os=this.currentOS;
    const w=this.makeWindow('taskmgr',this.appName('taskmgr'),'taskmgr',{width:720,height:500});
    w.content.className=`window-content tm tm-${fam}`;
    const hist={cpu:Array(60).fill(4),mem:Array(60).fill(28)};let tab='proc',sel=null;
    const procs=()=>{const{base,wins}=this.termEngine.procList({os,shell:this.os.shell});return[...wins.map(([n,p,,id])=>({name:this.windows.get(id)?.title||n,exe:n,pid:p,win:id,cpu:(Math.random()*3).toFixed(1),mem:20+(p%90)})),...base.map(([n,p])=>({name:n,exe:n,pid:p,cpu:(Math.random()*.6).toFixed(1),mem:4+(p%40)}))]};
    const graph=(data,color)=>`<svg viewBox="0 0 300 100" preserveAspectRatio="none"><path d="M0 100 ${data.map((v,i)=>`L${i*5} ${100-v}`).join(' ')} L295 100Z" fill="${color}33" stroke="${color}" stroke-width="1.5"/></svg>`;
    const render=()=>{
      const list=procs();
      w.content.innerHTML=`<div class="tm-tabs">${[['proc',fam==='windows'?'Prozesse':'Prozesse'],['perf',fam==='windows'?'Leistung':'Ressourcen']].map(([id,l])=>`<button data-tab="${id}" class="${tab===id?'on':''}">${l}</button>`).join('')}</div>${tab==='proc'?`<div class="tm-table"><div class="tm-row tm-head"><span>Name</span><span>PID</span><span>CPU</span><span>Arbeitsspeicher</span></div>${list.map(p=>`<div class="tm-row ${sel===p.pid?'sel':''}" data-pid="${p.pid}">${p.win?`<span class="tm-app">${appIcon('terminal')}`:'<span>'}${esc(p.name)}</span><span>${p.pid}</span><span>${p.cpu} %</span><span>${p.mem.toFixed?p.mem.toFixed(1):p.mem} MB</span></div>`).join('')}</div><div class="tm-foot"><span>${list.length} Prozesse</span><button data-end ${sel?'':'disabled'}>${fam==='windows'?'Task beenden':fam==='mac'?'Beenden':'Prozess beenden'}</button></div>`:`<div class="tm-perf"><div class="tm-card"><b>CPU</b><span>${hist.cpu.at(-1).toFixed(0)} %</span>${graph(hist.cpu,'#1890ff')}</div><div class="tm-card"><b>Arbeitsspeicher</b><span>${(16*hist.mem.at(-1)/100).toFixed(1)}/16 GB</span>${graph(hist.mem,'#a855f7')}</div><div class="tm-card"><b>Netzwerk</b><span>${(Math.random()*90).toFixed(0)} KBit/s</span>${graph(hist.cpu.map(v=>v/2+Math.random()*8),'#16a34a')}</div><div class="tm-card"><b>Datenträger 0 (C:)</b><span>${(Math.random()*3).toFixed(0)} %</span>${graph(hist.cpu.map(v=>v/3),'#ea580c')}</div></div>`}`;
      $$('[data-tab]',w.content).forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
      $$('[data-pid]',w.content).forEach(r=>{r.onclick=()=>{sel=+r.dataset.pid;render()};r.ondblclick=()=>{const p=list.find(x=>x.pid===+r.dataset.pid);if(p?.win)this.restoreWindow(this.windows.get(p.win))}});
      $('[data-end]',w.content)?.addEventListener('click',()=>{const p=list.find(x=>x.pid===sel);if(!p)return;if(p.win===w.id)return this.closeWindowById(w.id);if(p.win){this.closeWindowById(p.win);sel=null;render()}else this.dialog({title:this.appName('taskmgr'),message:`Der Systemprozess „${p.exe}“ kann nicht beendet werden (Zugriff verweigert).`,icon:'taskmgr'})});
    };
    const timer=setInterval(()=>{hist.cpu.push(Math.max(1,Math.min(95,hist.cpu.at(-1)+(Math.random()-.5)*10+(this.windows.size*0.4))));hist.cpu.shift();hist.mem.push(Math.max(15,Math.min(85,25+this.windows.size*3+Math.random()*4)));hist.mem.shift();if(tab==='perf'||Math.random()<.3)render()},1000);
    w.cleanup=()=>clearInterval(timer);w.refresh=()=>{};render();return w;
  }

  // ---------- Rechner ----------
  openCalculator(){
    const w=this.makeWindow('calc',this.appName('calc'),'calc',{width:320,height:470,noResize:true});
    w.content.className=`window-content calc calc-${this.profile.family}`;
    let expr='',display='0',fresh=true;
    const keys=['%','CE','C','⌫','¹⁄ₓ','x²','√','÷','7','8','9','×','4','5','6','−','1','2','3','+','±','0',',','='];
    w.content.innerHTML=`<div class="calc-display"><small class="calc-expr"></small><output>0</output></div><div class="calc-keys">${keys.map(k=>`<button data-k="${k}" class="${/[0-9,±]/.test(k)?'num':k==='='?'eq':'op'}">${k}</button>`).join('')}</div>`;
    const out=$('output',w.content),ex=$('.calc-expr',w.content);
    const num=()=>parseFloat(display.replace(/\./g,'').replace(',','.'))||0;
    const fmt=v=>{if(!isFinite(v))return'Teilen durch 0 nicht möglich';const s=Number(v.toPrecision(14));return s.toLocaleString('de-DE',{maximumFractionDigits:12})};
    const evalExpr=e=>{try{const r=Function(`return (${e.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-')})`)();return r}catch{return NaN}};
    const press=k=>{
      if(/^[0-9]$/.test(k)){display=fresh||display==='0'?k:display+k;fresh=false}
      else if(k===','){if(fresh){display='0,';fresh=false}else if(!display.includes(','))display+=','}
      else if(k==='⌫'){display=display.length>1&&!fresh?display.slice(0,-1):'0'}
      else if(k==='C'){expr='';display='0';fresh=true}else if(k==='CE'){display='0';fresh=true}
      else if(k==='±'){display=fmt(-num())}else if(k==='%'){display=fmt(num()/100)}
      else if(k==='x²'){display=fmt(num()**2);fresh=true}else if(k==='√'){display=fmt(Math.sqrt(num()));fresh=true}else if(k==='¹⁄ₓ'){display=fmt(1/num());fresh=true}
      else if('+−×÷'.includes(k)){expr+=String(num())+k;display=fmt(evalExpr(expr.slice(0,-1)));fresh=true}
      else if(k==='='){const full=expr+String(num());ex.textContent=full.replace(/\./g,',')+' =';display=fmt(evalExpr(full));expr='';fresh=true;out.textContent=display;return}
      ex.textContent=expr.replace(/\./g,',');out.textContent=display;
    };
    $$('[data-k]',w.content).forEach(b=>b.onclick=()=>press(b.dataset.k));
    w.element.addEventListener('keydown',e=>{const map={'*':'×','/':'÷','-':'−','+':'+',Enter:'=','=':'=',Backspace:'⌫',Escape:'C',',':',','.':',','%':'%'};const k=/^[0-9]$/.test(e.key)?e.key:map[e.key];if(k){e.preventDefault();press(k)}});
    w.element.tabIndex=0;setTimeout(()=>w.element.focus(),40);return w;
  }

  // ---------- Info ----------
  openAbout(){
    const os=this.currentOS,o=getOS(os),fam=this.profile.family;
    const w=this.makeWindow('about',this.appName('about'),'about',{width:fam==='mac'?300:460,height:fam==='mac'?380:360,noResize:true});
    w.content.className=`window-content about about-${fam} about-${os}`;
    const ver={winxp:'Version 2002 (Build 2600.xpsp_sp3)',win7:'Version 6.1 (Build 7601: Service Pack 1)',win8:'Version 6.2 (Build 9200)',win10:'Version 22H2 (Betriebssystembuild 19045.5371)',win11:'Version 24H2 (Betriebssystembuild 26100.2605)',debian:'Debian GNU/Linux 13 (trixie) · GNOME 48',arch:'Arch Linux (rolling) · KDE Plasma 6.5',macos:'Version 26.1',unix:'Solaris 11.4 · CDE 2.3'}[os];
    w.content.innerHTML=fam==='mac'?`<div class="ab-mac"><span class="ab-logo">${osMark('macos')}</span><h2>macOS</h2><p>${ver}</p><dl><dt>Chip</dt><dd>Browser vCPU</dd><dt>Speicher</dt><dd>16 GB</dd><dt>Seriennummer</dt><dd>DESKTOPSIM01</dd></dl><button class="st-btn" data-ok>Weitere Infos …</button><small>DesktopSim-Nachbildung · keine Apple-Software</small></div>`:`<div class="ab-head"><span class="ab-logo">${osMark(os)}</span><b>${esc(o.label)}</b></div><div class="ab-body"><p>${fam==='windows'?'Microsoft Windows':esc(o.label)}<br>${ver}</p><p>${fam==='windows'?'Dieses Produkt ist eine Lern-Simulation von DesktopSim und lizenziert für:<br><b>Student</b>':'Simuliert von DesktopSim im Browser.'}</p><p class="ab-small">Echte Laufzeiten: Python (Pyodide), JavaScript, C/C++ (Clang/LLVM), Java (OpenJDK javac + CheerpJ – Built with CheerpJ), PHP (php-wasm), SQLite (sql.js).</p></div><div class="dlg-buttons"><button class="primary" data-ok>OK</button></div>`;
    $('[data-ok]',w.content).onclick=()=>this.closeWindowById(w.id);return w;
  }
  openRunDialog(){
    const w=this.makeWindow('run','Ausführen','terminal',{width:420,height:210,noResize:true});w.element.classList.add('dialog-window');w.content.className='window-content dialog-content';
    w.content.innerHTML=`<div class="dlg-body"><span class="dlg-icon">${appIcon('terminal')}</span><div class="dlg-text"><p>Geben Sie den Namen eines Programms, Ordners, Dokuments oder einer Internetressource an.</p><label class="run-row">Öffnen: <input class="dlg-input" value="cmd"></label></div></div><div class="dlg-buttons"><button class="primary" data-ok>OK</button><button data-cancel>Abbrechen</button><button data-browse>Durchsuchen …</button></div>`;
    const input=$('.dlg-input',w.content);setTimeout(()=>{input.focus();input.select()},40);
    const go=()=>{const v=input.value.trim();this.closeWindowById(w.id);const map={cmd:()=>this.openTerminal('cmd'),powershell:()=>this.openTerminal(os4ps(this.currentOS)),notepad:()=>this.openEditor(),calc:()=>this.openCalculator(),explorer:()=>this.openFiles(),taskmgr:()=>this.openTaskManager(),control:()=>this.openSettings(),winver:()=>this.openAbout(),code:()=>this.openIDE(),'.':()=>this.openFiles(homePath(this.currentOS))};const fn=map[v.toLowerCase().replace(/\.exe$/,'')];if(fn)return fn();if(/^https?:\/\//.test(v))return this.openBrowser(v);const p=this.fs.normalize(v,homePath(this.currentOS));if(this.fs.exists(p))return this.openPath(p);this.dialog({title:v,message:`„${v}“ wurde nicht gefunden. Vergewissern Sie sich, dass der Name richtig eingegeben wurde, und wiederholen Sie den Vorgang.`,icon:'about'})};
    $('[data-ok]',w.content).onclick=go;$('[data-cancel]',w.content).onclick=()=>this.closeWindowById(w.id);$('[data-browse]',w.content).onclick=async()=>{const p=await this.filePicker({mode:'open'});if(p){input.value=pathDisplay(this.currentOS,p);input.focus()}};
    input.onkeydown=e=>{if(e.key==='Enter')go();if(e.key==='Escape')this.closeWindowById(w.id)};return w;
  }

  // ---------- SQL Studio (echtes SQLite) + Prolog als Datenbank (echtes SWI-Prolog) ----------
  openSQL(mode='sql'){
    const os=this.currentOS;const dbPath=joinPath(homePath(os),'Projects/demo.db');const kbPath=joinPath(homePath(os),'Projects/wissensbasis.pl');
    const w=this.makeWindow('sql','SQL Studio · demo.db','sql',{width:960,height:600});w.content.className='window-content sqls';
    const SQL_EX=[['Alle Schüler','SELECT * FROM schueler;'],['Filtern & sortieren',"SELECT name, punkte FROM schueler\nWHERE klasse = '8a'\nORDER BY punkte DESC;"],['Gruppieren','SELECT klasse, COUNT(*) AS anzahl, ROUND(AVG(punkte),1) AS schnitt\nFROM schueler GROUP BY klasse;'],['JOIN','SELECT s.name, p.titel, p.sprache\nFROM schueler s\nJOIN projekte p ON p.schueler_id = s.id;'],['Einfügen',"INSERT INTO schueler (name, klasse, punkte)\nVALUES ('Mira', '9b', 92);"],['Neue Tabelle','CREATE TABLE notizen (\n  id INTEGER PRIMARY KEY,\n  text TEXT NOT NULL,\n  erstellt TEXT DEFAULT CURRENT_TIMESTAMP\n);']];
    const PL_EX=[['Alle Schüler','schueler(Id, Name, Klasse, Punkte).'],['Filtern (8a, > 80)',"schueler(_, Name, '8a', P), P > 80."],['Verknüpfen (JOIN)','schueler(Id, Name, _, _), projekte(_, Titel, Sprache, Id).'],['Regel: gut/1','gut(Name).'],['Zählen','aggregate_all(count, schueler(_,_,_,_), Anzahl).'],['Durchschnitt',"aggregate_all(bag(P), schueler(_,_,_,P), L), sum_list(L, S), length(L, N), Schnitt is S / N."],['Sortieren',"findall(P-N, schueler(_,N,_,P), L), msort(L, Sortiert)."],['Ja/Nein-Frage',"schueler(_, 'Sam', _, _)."]];
    const DEFAULT_KB=`% Wissensbasis (SWI-Prolog) – Fakten sind die "Datensätze" einer Prolog-Datenbank.\n% schueler(Id, Name, Klasse, Punkte).\nschueler(1, 'Alex', '8a', 86).\nschueler(2, 'Sam', '8b', 94).\nschueler(3, 'Lina', '8a', 77).\nschueler(4, 'Robin', '9b', 91).\n\n% projekte(Id, Titel, Sprache, SchuelerId).\nprojekte(1, 'Hallo Welt', 'Python', 1).\nprojekte(2, 'Webseite', 'HTML', 2).\nprojekte(3, 'Datenbank', 'SQL', 4).\nprojekte(4, 'Taschenrechner', 'Java', 2).\n\n% Regeln leiten neues Wissen ab (wie eine VIEW in SQL).\ngut(Name) :- schueler(_, Name, _, Punkte), Punkte >= 90.\nteam(A, B) :- schueler(_, A, K, _), schueler(_, B, K, _), A @< B.\n`;
    w.content.innerHTML=`<div class="sqls-bar"><b>${appIcon('sql')} <span class="sqls-title">demo.db</span></b><span class="sqls-mode"><button data-mode="sql">SQL</button><button data-mode="prolog">Prolog</button></span><span class="sqls-engine">verbinde …</span><span class="sp"></span><button data-import hidden>Tabellen → Fakten</button><button data-save hidden>Speichern</button><button data-run class="primary">${lineIcon('play',14)} Ausführen <kbd>Strg+Enter</kbd></button></div><div class="sqls-main"><aside class="sqls-tables"><h4 class="sqls-list-head">Tabellen</h4><div class="sqls-list"></div><h4>Beispiele</h4><div class="sqls-ex"></div></aside><section class="sqls-work"><textarea class="sqls-kb" spellcheck="false" hidden></textarea><textarea class="sqls-editor" spellcheck="false">SELECT * FROM schueler;</textarea><div class="sqls-msg"></div><div class="sqls-result"></div></section></div>`;
    const editor=$('.sqls-editor',w.content),kbBox=$('.sqls-kb',w.content),result=$('.sqls-result',w.content),msg=$('.sqls-msg',w.content),list=$('.sqls-list',w.content),engine=$('.sqls-engine',w.content),exBox=$('.sqls-ex',w.content);
    let db=null,current=mode,sqlText=editor.value,plQuery=PL_EX[0][1];
    const table=(cols,rows)=>`<table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td class="${v===null?'null':typeof v==='number'||/^-?\d+(\.\d+)?$/.test(v)?'num':''}">${v===null?'NULL':esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const tables=async()=>{if(!db)return;const names=db.tables();list.innerHTML=names.map(n=>`<button data-t="${esc(n)}">${lineIcon('grid',14)} ${esc(n)}</button>`).join('')||'<small>keine</small>';$$('[data-t]',list).forEach(b=>b.onclick=()=>{editor.value=`SELECT * FROM ${b.dataset.t} LIMIT 100;`;run()})};
    const runSQL=async()=>{if(!db)return;const t0=performance.now();try{const r=await db.exec(editor.value);const last=r.results.at(-1);const ms=(performance.now()-t0).toFixed(1);if(last){msg.className='sqls-msg ok';msg.textContent=`${last.rows.length} Zeile(n) · ${ms} ms`;result.innerHTML=table(last.columns,last.rows)}else{msg.className='sqls-msg ok';msg.textContent=`Ausgeführt · ${r.changes??0} Zeile(n) geändert · ${ms} ms`;result.innerHTML=''}tables();if(!this.fs.exists(dbPath))this.fs.write(dbPath,'',null,false,{enc:'sqlite',size:8192})}catch(e){msg.className='sqls-msg err';msg.textContent=String(e.message||e);result.innerHTML=''}};
    const loadKB=()=>{try{return this.fs.read(kbPath)}catch{return DEFAULT_KB}};
    const saveKB=()=>{try{this.fs.write(kbPath,kbBox.value);this.notifyFiles()}catch(e){this.notify('SQL Studio',e.message,'sql')}};
    const runProlog=async()=>{
      if(!this.runtimes){msg.className='sqls-msg err';msg.textContent='Prolog benötigt die Browser-Laufzeit.';return}
      saveKB();msg.className='sqls-msg';msg.textContent='SWI-Prolog arbeitet …';const t0=performance.now();let errText='',outText='';
      const io={write:(t,s)=>{if(s==='stderr')errText+=t;else outText+=t},status:s=>{if(s)msg.textContent=s},readLine:async()=>null};
      const r=await this.runtimes.runProlog({mode:'table',kb:kbBox.value,query:editor.value},io).promise;
      engine.textContent='SWI-Prolog (WebAssembly)';
      const preds=String(r.predicates||'').replace(/^\[|\]$/g,'').split(/,(?![^(]*\))/).map(x=>x.trim()).filter(Boolean);
      list.innerHTML=preds.map(p=>{const m=p.match(/^(.+)\/(\d+)-(\d+)$/);if(!m)return'';const[,n,a,c]=m;return`<button data-p="${esc(n)}" data-a="${a}">${lineIcon('grid',14)} ${esc(n)}/${a} <small>${c}</small></button>`}).join('')||'<small>keine</small>';
      $$('[data-p]',list).forEach(b=>b.onclick=()=>{const n=+b.dataset.a;editor.value=`${b.dataset.p}(${Array.from({length:n},(_,i)=>String.fromCharCode(65+i)).join(', ')}).`;runProlog()});
      const ms=(performance.now()-t0).toFixed(0);const warn=errText.replace(/\x1b\[[0-9;]*m/g,'').trim();
      if(r.fatal){msg.className='sqls-msg err';msg.textContent='SWI-Prolog konnte nicht geladen werden (Netzwerk/CDN?).';result.innerHTML='';return}
      if(r.error||(!r.table&&warn)){msg.className='sqls-msg err';msg.textContent=warn||String(r.error);result.innerHTML='';return}
      const t=r.table||{names:[],rows:[]};const out=outText.trim()?`<pre class="sqls-out">${esc(outText)}</pre>`:'';
      if(!t.names.length){msg.className='sqls-msg '+(t.rows.length?'ok':'err');msg.textContent=(t.rows.length?'true.':'false.')+` · ${ms} ms`+(warn?' · '+warn.split('\n')[0]:'');result.innerHTML=out}
      else{msg.className='sqls-msg ok';msg.textContent=`${t.rows.length} Lösung(en) · ${ms} ms`+(warn?' · '+warn.split('\n')[0]:'');result.innerHTML=t.rows.length?table(t.names,t.rows)+out:`<p class="sqls-none">false.</p>`+out}
    };
    const importFacts=async()=>{if(!db?.exec)return;let text='\n% --- aus demo.db übernommen ('+new Date().toLocaleString('de-DE')+') ---\n';for(const n of db.tables()){const r=await db.exec(`SELECT * FROM "${n.replace(/"/g,'""')}";`);const t=r.results[0];if(!t)continue;const name=n.toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/^([^a-z])/,'t_$1');text+=`% ${name}(${t.columns.map(c=>c[0].toUpperCase()+c.slice(1)).join(', ')}).\n`;const kbHas=new RegExp(`^${name}\\(`,'m').test(kbBox.value);if(kbHas)text+=`% (Fakten zu ${name}/${t.columns.length} gibt es schon – Duplikate werden übersprungen)\n`;for(const row of t.rows){const fact=`${name}(${row.map(v=>v===null?'null':typeof v==='number'?String(v):`'${String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}'`).join(', ')}).`;if(!kbBox.value.includes(fact))text+=fact+'\n'}}kbBox.value+=text;saveKB();msg.className='sqls-msg ok';msg.textContent='SQL-Tabellen wurden als Prolog-Fakten an die Wissensbasis angehängt.';runProlog()};
    const examples=()=>{const ex=current==='sql'?SQL_EX:PL_EX;exBox.innerHTML=ex.map(([l,q])=>`<button data-q="${esc(q)}">${esc(l)}</button>`).join('');$$('[data-q]',exBox).forEach(b=>b.onclick=()=>{editor.value=b.dataset.q;run()})};
    const setMode=m=>{if(current==='sql')sqlText=editor.value;else plQuery=editor.value;current=m;$$('[data-mode]',w.content).forEach(b=>b.classList.toggle('on',b.dataset.mode===m));const pl=m==='prolog';kbBox.hidden=!pl;$('[data-import]',w.content).hidden=!pl;$('[data-save]',w.content).hidden=!pl;$('.sqls-list-head',w.content).textContent=pl?'Prädikate':'Tabellen';$('.sqls-title',w.content).textContent=pl?'wissensbasis.pl':'demo.db';this.updateTitle(w,pl?'SQL Studio · Prolog · wissensbasis.pl':'SQL Studio · demo.db');editor.value=pl?plQuery:sqlText;editor.classList.toggle('pl',pl);result.innerHTML='';msg.textContent='';examples();if(pl){if(!kbBox.value)kbBox.value=loadKB();engine.textContent='SWI-Prolog (WebAssembly)';runProlog()}else{engine.textContent=db?.label||'SQLite 3 (sql.js / WebAssembly)';tables();runSQL()}};
    const run=()=>current==='sql'?runSQL():runProlog();
    (async()=>{try{const{SQLiteDatabase}=await import('../runtime/sqlite.js');db=await new SQLiteDatabase(os+':'+dbPath).open();db.label='SQLite 3 (sql.js / WebAssembly)';this._sqlLoaded=true}catch{const mini=this.db;db={label:'Offline: vereinfachte Lern-SQL-Engine',exec:async sql=>{const r=mini.run(sql);return{results:r.columns.length?[{columns:r.columns,rows:r.rows.map(x=>r.columns.map(c=>x[c]))}]:[],changes:0}},tables:()=>Object.keys(mini.tables)}}setMode(current)})();
    $('[data-run]',w.content).onclick=run;$('[data-import]',w.content).onclick=importFacts;$('[data-save]',w.content).onclick=()=>{saveKB();msg.className='sqls-msg ok';msg.textContent='wissensbasis.pl gespeichert.'};
    $$('[data-mode]',w.content).forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
    for(const box of[editor,kbBox])box.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&box===kbBox){e.preventDefault();saveKB()}if(e.key==='Tab'){e.preventDefault();document.execCommand('insertText',false,current==='sql'?'  ':'    ')}});
    return w;
  }

  // ---------- Anleitung ----------
  openGuide(){
    const os=this.currentOS,win=isWindows(os),py=win?'python':'python3';
    const w=this.makeWindow('guide',`Anleitung · ${this.os.label}`,'guide',{width:820,height:600});w.content.className='window-content guide-content';
    const ex=win?['dir','cd Projects',`${py} hello.py`,'node hello.js','g++ main.cpp -o main && main','javac Main.java && java Main','php index.php','sqlite3 demo.db']:['ls -la','cd Projects',`${py} hello.py`,'node hello.js','g++ main.cpp -o main && ./main','javac Main.java && java Main','php index.php','sqlite3 demo.db'];
    const bash=!win;
    w.content.innerHTML=`<div class="guide-intro"><div class="eyebrow">DESKTOPSIM · ${esc(this.os.label.toUpperCase())}</div><h2>So funktioniert dein simulierter Rechner</h2><p>Fenster lassen sich verschieben, an allen Kanten vergrößern und ${this.profile.snap?'an den Bildschirmrand andocken':'maximieren'}. Rechtsklick öffnet Kontextmenüs – auf dem Desktop, im Dateimanager und im Terminal.</p></div><div class="guide-sections">
      <article><h3>01 · Erste Befehle</h3><p>Ein Klick öffnet ein Terminal mit dem Befehl (Enter drücken zum Ausführen):</p><div class="guide-chips">${ex.map(c=>`<button data-example="${esc(c)}"><code>${esc(c)}</code></button>`).join('')}</div></article>
      <article><h3>02 · Echte Programmiersprachen</h3><ul><li><b>Python 3.14</b> (Pyodide): <code>input()</code> fragt interaktiv im Terminal, Dateien werden ins virtuelle Dateisystem geschrieben. <b>tkinter</b> und <b>turtle</b> öffnen echte Fenster, <code>plt.show()</code> zeigt Diagramme, <b>socket</b>/<code>select</code> funktionieren über ein virtuelles Netz (Server und Client in zwei Terminals). Virtuelle Umgebungen: <code>${py} -m venv .venv</code>, aktivieren (<code>${win?'.venv\\Scripts\\activate':'source .venv/bin/activate'}</code>), dann <code>pip install numpy</code>.</li><li><b>C/C++</b>: echtes Clang/LLVM 22 übersetzt in WebAssembly – mit <code>cin</code>, <code>scanf</code>, Dateien und echten Compilerfehlern.</li><li><b>Java</b>: echtes <code>javac</code> (OpenJDK 8) und eine JVM (CheerpJ) – <code>Scanner</code> funktioniert interaktiv, <b>Swing/AWT</b> erscheint in einem Fenster, <code>Socket</code>/<code>ServerSocket</code> sprechen mit Python-Programmen.</li><li><b>SWI-Prolog</b>: <code>swipl familie.pl</code> im Terminal oder SQL Studio → <b>Prolog</b> als Datenbank (SQL-Tabellen lassen sich als Fakten übernehmen).</li><li><b>Skripte</b> laufen auf jedem System: <code>bash skript.sh</code> (unter Windows Git Bash), <code>pwsh -File skript.ps1</code> unter Linux/macOS, <code>wine cmd /c start.bat</code> für Batch-Dateien.</li><li><b>JavaScript</b>: echte JS-Engine mit <code>console</code>, <code>prompt()</code>, <code>require('fs')</code>, <code>readline</code>.</li><li><b>PHP 8.4</b> und <b>SQLite 3</b> laufen ebenfalls echt. C# ist nur eine Ausgabe-Demo.</li></ul><p>Beim ersten Start einer Sprache wird die Laufzeit einmalig geladen. <b>Strg+C</b> bricht laufende Programme ab, <b>Strg+D</b> beendet die Eingabe.</p></article>
      <article><h3>03 · Shell wie im Original</h3><p>${bash?`Pipes und Umleitungen: <code>ls | grep py</code>, <code>cat hello.py | wc -l</code>, <code>echo hi > datei.txt</code>. Variablen, <code>$(befehl)</code>, <code>if</code>/<code>for</code>/<code>while</code>, Skripte mit <code>chmod +x skript.sh && ./skript.sh</code>. Programme installieren: <code>${os==='debian'?'sudo apt install cowsay':os==='arch'?'sudo pacman -S cowsay':os==='macos'?'brew install cowsay':'pkg install cowsay'}</code> (Passwort: beliebig).`:`CMD: <code>dir | findstr .py</code>, <code>set NAME=Max</code> und <code>echo %NAME%</code>, Batch-Dateien mit <code>set /p</code>, <code>pause</code>, <code>if</code> und <code>goto</code>.${['win7','win8','win10','win11'].includes(os)?' PowerShell: <code>Get-ChildItem</code>, <code>$x = 5</code>, <code>Write-Host "Hi" -ForegroundColor Green</code>, <code>Read-Host</code>. Skripte (.ps1) brauchen erst <code>Set-ExecutionPolicy -Scope CurrentUser RemoteSigned</code> – wie in echt.':''}`}</p></article>
      <article><h3>04 · Webentwicklung</h3><p>Starte im Ordner Projects <code>${py} -m http.server 8000</code> oder <code>php -S localhost:8000</code> und öffne im ${esc(this.appName('browser'))} <b>localhost:8000</b>. Links, Formulare und eingebundenes CSS/JS aus dem virtuellen Dateisystem funktionieren; PHP-Seiten werden echt ausgeführt.</p></article>
      <article><h3>05 · Tastenkürzel</h3><ul><li><kbd>Strg</kbd>+<kbd>Esc</kbd> ${this.profile.family==='gnome'?'Aktivitäten':this.profile.family==='mac'?'Spotlight':'Startmenü'}</li><li><kbd>Strg</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd> neues Terminal</li><li><kbd>Strg</kbd>+<kbd>Umschalt</kbd>+<kbd>Esc</kbd> ${esc(this.appName('taskmgr'))}</li><li><kbd>Strg</kbd>+<kbd>Alt</kbd>+<kbd>D</kbd> Desktop anzeigen · <kbd>Strg</kbd>+<kbd>Alt</kbd>+<kbd>O</kbd> Fensterübersicht</li><li>Terminal: <kbd>Tab</kbd> vervollständigt, <kbd>↑</kbd>/<kbd>↓</kbd> Verlauf, <kbd>Strg</kbd>+<kbd>L</kbd> leeren</li></ul></article>
      <article><h3>06 · Befehlsreferenz</h3><pre>${esc(shellHelp(os))}</pre></article>
      <article><h3>07 · Daten & Datenschutz</h3><p>Alles bleibt in diesem Browser (localStorage/IndexedDB), getrennt je System. Sicherung über ${esc(this.appName('settings'))} → Speicher. Laufzeiten werden von CDNs (jsDelivr, cdnjs, CheerpJ, GitHub) geladen; dein Code wird nicht an Server geschickt.</p></article>
    </div>`;
    $$('[data-example]',w.content).forEach(b=>b.onclick=()=>{const t=this.openTerminal(null,{cwd:joinPath(homePath(os),'Projects')});setTimeout(()=>{const input=t.content.querySelector('.term-input');if(input){input.value=b.dataset.example.replace(/^cd Projects$/,'cd .');input.focus()}},120)});
    return w;
  }
}
function os4ps(os){return['win7','win8','win10','win11'].includes(os)?'powershell':'cmd'}
