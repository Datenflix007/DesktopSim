// Terminal-Fenster mit echter Shell-Engine, OS-typischem Aussehen und (unter Windows 11) Tabs.
import {homePath,joinPath,isWindows} from '../vfs.js';
import {promptParts} from '../terminal.js';
import {TerminalView} from '../ui/terminal-view.js';
import {TERMINAL_THEMES} from '../ui/profiles.js';
import {lineIcon} from '../ui/icons.js';

const BANNERS={
  winxp:{cmd:'Microsoft Windows XP [Version 5.1.2600]\n(C) Copyright 1985-2001 Microsoft Corp.\n\n'},
  win7:{cmd:'Microsoft Windows [Version 6.1.7601]\nCopyright (c) 2009 Microsoft Corporation. Alle Rechte vorbehalten.\n\n',powershell:'Windows PowerShell\nCopyright (C) 2009 Microsoft Corporation. Alle Rechte vorbehalten.\n\n'},
  win8:{cmd:'Microsoft Windows [Version 6.2.9200]\n(c) 2012 Microsoft Corporation. Alle Rechte vorbehalten.\n\n',powershell:'Windows PowerShell\nCopyright (C) 2012 Microsoft Corporation. Alle Rechte vorbehalten.\n\n'},
  win10:{cmd:'Microsoft Windows [Version 10.0.19045.5371]\n(c) Microsoft Corporation. Alle Rechte vorbehalten.\n\n',powershell:'Windows PowerShell\nCopyright (C) Microsoft Corporation. Alle Rechte vorbehalten.\n\nInstallieren Sie die neueste PowerShell für neue Funktionen und Verbesserungen! https://aka.ms/PSWindows\n\n'},
  win11:{cmd:'Microsoft Windows [Version 10.0.26100.2605]\n(c) Microsoft Corporation. Alle Rechte vorbehalten.\n\n',powershell:'Windows PowerShell\nCopyright (C) Microsoft Corporation. Alle Rechte vorbehalten.\n\nInstallieren Sie die neueste PowerShell für neue Funktionen und Verbesserungen! https://aka.ms/PSWindows\n\n'}
};

export class TerminalApp{
  applyTerminalTheme(el,shell){
    const name=this.profile.terminalTheme,th=TERMINAL_THEMES[name];
    const ps=shell==='powershell'&&th.psBg;
    el.style.setProperty('--term-bg',ps?th.psBg:th.bg);el.style.setProperty('--term-fg',ps?th.psFg:th.fg);
    el.style.setProperty('--term-font',th.font);el.style.setProperty('--term-size',th.size+'px');
    th.palette.forEach((c,i)=>el.style.setProperty('--ansi-'+i,c));
    el.dataset.cursor=th.cursor;el.dataset.boldBright=String(Boolean(th.boldBright));el.dataset.termTheme=name;
  }
  openTerminal(shell,opts={}){
    const os=this.currentOS;shell=shell||this.os.shell;
    const tabs=os==='win11';
    const w=this.makeWindow('terminal',this.appName('terminal'),'terminal',{width:isWindows(os)?740:720,height:isWindows(os)?440:450});
    w.content.className='window-content terminal-window';w.element.classList.add('terminal-frame');
    w.sessions=[];w.activeSession=null;
    if(tabs){w.element.classList.add('wt');w.titleSlot.innerHTML='<div class="wt-tabs"></div><button class="wt-new" title="Neue Registerkarte">'+lineIcon('plus',14)+'</button><button class="wt-drop" title="Profil wählen">'+lineIcon('chevronDown',14)+'</button>';
      w.titleSlot.querySelector('.wt-new').onclick=e=>{e.stopPropagation();this.addTerminalSession(w,'powershell')};
      w.titleSlot.querySelector('.wt-drop').onclick=e=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();this.chrome.contextMenu(r.left,r.bottom,[{label:'Windows PowerShell',action:()=>this.addTerminalSession(w,'powershell')},{label:'Eingabeaufforderung',action:()=>this.addTerminalSession(w,'cmd')},{sep:true},{label:'Einstellungen',action:()=>this.openSettings()}])}}
    else if(this.profile.family==='gnome'){w.titleSlot.innerHTML='<button class="hb-btn" title="Neues Fenster">'+lineIcon('plus',16)+'</button>';w.titleSlot.firstChild.onclick=e=>{e.stopPropagation();this.openTerminal()}}
    w.setShellTitle=t=>{const title=this.terminalTitle(t);if(tabs){const s=w.sessions.find(x=>x.t===t);if(s)s.tab.querySelector('span').textContent=title;if(w.activeSession?.t===t)this.updateTitle(w,title)}else this.updateTitle(w,title);this.applyTerminalTheme(w.sessions.find(s=>s.t===t)?.root||w.content,t.shell)};
    w.cleanup=()=>{for(const s of w.sessions){s.closed=true;this.termEngine.cancel(s.t);s.view.dispose()}};
    w.onResize=()=>w.sessions.forEach(s=>s.t.cols=s.view.columns());
    this.addTerminalSession(w,shell,opts);
    return w;
  }
  addTerminalSession(w,shell,opts={}){
    const os=this.currentOS,home=homePath(os);
    const root=document.createElement('div');root.className='term-host';w.content.append(root);
    const t={windowId:w.id,os,shell,cwd:opts.cwd||home,history:[],admin:false};
    const view=new TerminalView(root,{completions:line=>this.termEngine.completions(line,t),onCancel:()=>this.termEngine.cancel(t),onResize:cols=>{t.cols=cols}});
    this.applyTerminalTheme(root,shell);
    const session={t,view,root,closed:false};w.sessions.push(session);
    t.io={write:s=>view.write(s),readLine:o=>view.readLine({password:o?.password}),clear:()=>view.clear(),image:src=>view.image(src),status:s=>view.status(s)};
    view.history=t.history;
    t.onExit=()=>this.closeTerminalSession(w,session);
    if(w.element.classList.contains('wt')){const tab=document.createElement('button');tab.className='win-tab';tab.innerHTML=`${lineIcon('terminal',14)}<span>${this.terminalTitle(t)}</span><i title="Registerkarte schließen">×</i>`;w.titleSlot.querySelector('.wt-tabs').append(tab);session.tab=tab;tab.onclick=e=>{e.stopPropagation();if(e.target.tagName==='I')this.closeTerminalSession(w,session);else this.activateSession(w,session)}}
    root.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();const sel=getSelection()?.toString();this.chrome.contextMenu(e.clientX,e.clientY,[{label:'Kopieren',shortcut:'Strg+Umschalt+C',disabled:!sel,action:()=>navigator.clipboard?.writeText(sel)},{label:'Einfügen',shortcut:'Strg+Umschalt+V',action:async()=>{try{const text=await navigator.clipboard.readText();const input=root.querySelector('.term-input');input.focus();document.execCommand('insertText',false,text)}catch{}}},{label:'Alles auswählen',action:()=>{const r=document.createRange();r.selectNodeContents(root.querySelector('.term-lines'));getSelection().removeAllRanges();getSelection().addRange(r)}},{sep:true},{label:'Leeren',action:()=>view.clear()},{label:isWindows(os)?'Neues Fenster':'Neues Terminal',action:()=>this.openTerminal(t.shell,{cwd:t.cwd})}])});
    this.activateSession(w,session);
    const banner=BANNERS[os]?.[shell];if(banner)view.write(banner);
    if(os==='macos'){const last=new Date(Date.now()-3600e3*5);view.write(`Last login: ${last.toDateString().replace(/ \d{4}$/,'')} ${last.toTimeString().slice(0,8)} on ttys000\n`)}
    this.runTerminalLoop(w,session,opts.command);
    return session;
  }
  activateSession(w,session){for(const s of w.sessions){s.root.hidden=s!==session;s.tab?.classList.toggle('active',s===session)}w.activeSession=session;this.updateTitle(w,this.terminalTitle(session.t));setTimeout(()=>session.view.focus(),30)}
  closeTerminalSession(w,session){
    session.closed=true;this.termEngine.cancel(session.t);session.view.dispose();session.root.remove();session.tab?.remove();
    w.sessions=w.sessions.filter(s=>s!==session);
    if(!w.sessions.length){if(this.windows.has(w.id))this.closeWindowById(w.id)}else this.activateSession(w,w.sessions.at(-1));
  }
  async runTerminalLoop(w,session,initial){
    const{t,view}=session;
    if(initial){view.writePrompt(promptParts(t));view.write(initial+'\n');t.history.push(initial);await this.termEngine.execute(initial,t);w.setShellTitle(t)}
    while(!session.closed&&this.windows.has(w.id)){
      const line=await view.readLine({prompt:promptParts(t),shell:true});
      if(session.closed)return;
      if(line===null)continue;
      if(!line.trim())continue;
      if(t.history.at(-1)!==line)t.history.push(line);
      w.element.classList.add('busy');
      try{await this.termEngine.execute(line,t)}catch(e){view.write('Fehler: '+(e?.message||e)+'\n')}
      w.element.classList.remove('busy');view.status('');
      if(session.closed)return;
      w.setShellTitle(t);
    }
  }
  /** Öffnet ein Terminal und führt dort einen Befehl aus (IDE, Editor, Dateimanager). */
  openTerminalWithCommand(command,cwd){return this.openTerminal(null,{cwd:cwd||joinPath(homePath(this.currentOS),'Projects'),command})}
}
