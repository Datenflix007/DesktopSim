// Darstellung der tkinter-/turtle-Fenster von Python-Programmen (und Geräte-Sitzungen für Laufzeiten).
// Python schickt Befehle (create/config/pack/grid/canvas …), DesktopSim baut daraus echte Fenster der
// simulierten Oberfläche. Die Anordnung folgt den Tk-Geometriemanagern (Packer-Algorithmus, Grid, Place).
import {VirtualNet} from '../runtime/net.js';
import {homePath,isWindows,pathDisplay} from '../vfs.js';

const SVG='http://www.w3.org/2000/svg';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const CONTAINERS=new Set(['tk','toplevel','frame','labelframe','paned','notebook']);
const SYS_COLORS={systembuttonface:'#f0f0f0',systemwindow:'#ffffff',systemwindowtext:'#000000',systembuttontext:'#000000',systemhighlight:'#0078d7',systemhighlighttext:'#ffffff',systemwindowframe:'#646464',systemmenu:'#f0f0f0',systemdisabledtext:'#6d6d6d',systemtransparent:'transparent'};

export function tkColor(c){
  if(c===undefined||c===null)return null;c=String(c).trim();if(c==='')return'transparent';
  const k=c.toLowerCase().replace(/\s+/g,'');if(SYS_COLORS[k])return SYS_COLORS[k];
  const g=k.match(/^gr[ae]y(\d{1,3})$/);if(g){const v=Math.round(Math.min(100,+g[1])*2.55);return`rgb(${v},${v},${v})`}
  if(/^#[0-9a-f]{12}$/i.test(c))return'#'+c.slice(1,3)+c.slice(5,7)+c.slice(9,11);
  if(/^[a-z]+\d$/.test(k))return k.replace(/\d$/,'');
  return k.startsWith('#')?c:k;
}
export function tkFont(spec,base=13){
  if(spec===undefined||spec===null||spec==='')return null;
  let parts;
  if(Array.isArray(spec))parts=spec.map(String);
  else{const s=String(spec);parts=[];const re=/\{([^}]*)\}|(\S+)/g;let m;while((m=re.exec(s)))parts.push(m[1]??m[2])}
  let family=parts[0]||'TkDefaultFont',size=parts[1]!==undefined?Number(parts[1]):NaN;const flags=new Set(parts.slice(Number.isNaN(size)?1:2).map(x=>x.toLowerCase()));
  if(Number.isNaN(size)&&parts[1]&&/bold|italic/.test(parts[1]))flags.add(parts[1]);
  const px=Number.isNaN(size)||size===0?base:size<0?-size:Math.round(size*4/3);
  const fam={tkdefaultfont:'var(--tk-font)',tktextfont:'var(--tk-font)',tkheadingfont:'var(--tk-font)',tkmenufont:'var(--tk-font)',tkcaptionfont:'var(--tk-font)',tkfixedfont:'ui-monospace,Consolas,"DejaVu Sans Mono",monospace',courier:'"Courier New",Courier,monospace',helvetica:'Helvetica,Arial,sans-serif',times:'"Times New Roman",Times,serif',fixed:'monospace',terminal:'monospace',system:'system-ui'}[family.toLowerCase()]||`"${family.replace(/"/g,'')}",var(--tk-font)`;
  return{css:`${flags.has('italic')?'italic ':''}${flags.has('bold')?'700 ':''}${px}px ${fam}`,deco:[flags.has('underline')?'underline':'',flags.has('overstrike')?'line-through':''].filter(Boolean).join(' '),px};
}
const num=(v,d=0)=>{if(v===undefined||v===null||v==='')return d;const n=parseFloat(v);if(Number.isNaN(n))return d;const u=String(v).trim().slice(-1);return u==='c'?n*37.8:u==='m'?n*3.78:u==='i'?n*96:u==='p'?n*4/3:n};
const pad2=v=>Array.isArray(v)?[num(v[0]),num(v[1]??v[0])]:[num(v),num(v)];
const KEYSYMS={Enter:'Return',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',' ':'space',Escape:'Escape',Backspace:'BackSpace',Tab:'Tab',Delete:'Delete',Shift:'Shift_L',Control:'Control_L',Alt:'Alt_L',Meta:'Super_L',PageUp:'Prior',PageDown:'Next',Home:'Home',End:'End',Insert:'Insert',CapsLock:'Caps_Lock','+':'plus','-':'minus',',':'comma','.':'period','/':'slash',':':'colon',';':'semicolon','!':'exclam','?':'question','@':'at','#':'numbersign',$:'dollar','%':'percent','^':'asciicircum','&':'ampersand','*':'asterisk','(':'parenleft',')':'parenright',_:'underscore','=':'equal','[':'bracketleft',']':'bracketright','{':'braceleft','}':'braceright','\\':'backslash','|':'bar','"':'quotedbl',"'":'apostrophe','<':'less','>':'greater','`':'grave','~':'asciitilde','ä':'adiaeresis','ö':'odiaeresis','ü':'udiaeresis','Ä':'Adiaeresis','Ö':'Odiaeresis','Ü':'Udiaeresis','ß':'ssharp'};
const CHARS={Enter:'\r',Tab:'\t',Backspace:'\b',Escape:'\x1b',Delete:'\x7f'};
const seqType=seq=>{if(seq.startsWith('<<'))return'Virtual';if(!seq.startsWith('<'))return'KeyPress';const p=seq.slice(1,-1).split('-');if(p.some(x=>/^(Key|KeyPress)$/.test(x)))return'KeyPress';if(p.includes('KeyRelease'))return'KeyRelease';if(p.includes('ButtonRelease'))return'ButtonRelease';if(p.includes('Motion'))return'Motion';if(p.some(x=>/^(Button|ButtonPress|Double|Triple)$/.test(x))||p.some(x=>/^[1-5]$/.test(x)))return'ButtonPress';for(const t of['Enter','Leave','MouseWheel','Configure','FocusIn','FocusOut'])if(p.includes(t))return t;return'KeyPress'};

/** Sammelt Fenster, Netzwerk und Dialoge eines laufenden Programms. */
export class DeviceManager{
  constructor(app){this.app=app;this.net=new VirtualNet(()=>this.hostname());this.sessions=new Set()}
  hostname(){const os=this.app.currentOS;return isWindows(os)?'DESKTOP-SIM':({debian:'debian-sim',arch:'arch-sim',macos:'Mac',unix:'workstation'})[os]||'desktopsim'}
  session(opts={}){const s=new DeviceSession(this,opts);this.sessions.add(s);return s}
}

export class DeviceSession{
  constructor(mgr,{label='python',cwd='/',work='/home/student/work'}={}){this.mgr=mgr;this.app=mgr.app;this.label=label;this.cwd=cwd;this.work=work;this.objects=new Set();this.host=null;this.closed=false}
  get gui(){if(!this.host)this.host=new TkHost(this.app,this);return this.host}
  ops(list){if(!this.closed)this.gui.apply(list)}
  mapPath(p){if(!p)return'';if(p===this.cwd)return this.work;if(p.startsWith(this.cwd+'/'))return this.work+p.slice(this.cwd.length);return pathDisplay(this.app.currentOS,p)}
  async call(op,args={}){
    const app=this.app;
    if(op.startsWith('net.'))return this.mgr.net.call(op.slice(4),args,this,this.label);
    if(op==='sleep')return new Promise(r=>setTimeout(()=>r({ok:true}),Math.max(0,Math.min(60000,Number(args.ms)||0))));
    if(op==='gui.wait')return this.gui.wait(args.timeout);
    if(op==='gui.dialog'){const icon={error:'about',warning:'about',question:'about'}[args.icon]||'about';const v=await app.dialog({title:args.title||'tk',message:args.message||'',buttons:(args.buttons||[['OK','ok']]).map(([l,v])=>[l,v]),icon});return{value:v===false?(args.buttons?.at(-1)?.[1]??'ok'):v}}
    if(op==='gui.prompt'){const v=await app.promptDialog(args.message||'',args.value||'',args.title||'Eingabe');return{value:v}}
    if(op==='gui.file'){const mode=args.mode==='save'?'save':args.mode==='dir'?'dir':'open';const p=await app.filePicker({mode,start:this.cwd,name:args.initialfile||''});if(!p)return{value:''};let path=p;if(mode==='save'&&args.defaultextension&&!/\.[^/]+$/.test(path))path+=args.defaultextension.startsWith('.')?args.defaultextension:'.'+args.defaultextension;return{value:this.mapPath(path)}}
    if(op==='gui.color')return this.gui.colorDialog(args);
    return{error:'unsupported'};
  }
  close(){if(this.closed)return;this.closed=true;this.mgr.net.release(this);this.host?.closeAll();this.mgr.sessions.delete(this)}
}

class TkHost{
  constructor(app,session){
    this.app=app;this.session=session;this.widgets=new Map();this.windows=new Map();this.vars=new Map();this.varUsers=new Map();this.images=new Map();this.bound=new Map();this.styles=new Map();
    this.events=[];this.waiter=null;this.dirtyVars={};this.dirtyWidgets={};this.dirtySizes={};this.pointer=[0,0];this.focus=null;this.layoutQueued=new Set();
    this.fam=app.profile?.family||'windows';
  }
  // ---------- Ereignis-Warteschlange ----------
  push(ev){if(ev.type==='Motion'){const last=this.events.at(-1);if(last&&last.type==='Motion'&&last.id===ev.id){this.events[this.events.length-1]=ev;return}}this.events.push(ev);this.release()}
  release(){if(this.waiter&&this.events.length){const w=this.waiter;this.waiter=null;clearTimeout(w.timer);w.resolve(this.batch())}}
  batch(){const events=this.events;this.events=[];const state={v:this.dirtyVars,w:this.dirtyWidgets,s:this.dirtySizes,screen:[Math.round(innerWidth),Math.round(innerHeight)],pointer:this.pointer,focus:this.focus};this.dirtyVars={};this.dirtyWidgets={};this.dirtySizes={};return{events,state}}
  wait(timeout){
    this.flushLayout();
    if(this.events.length||!this.windows.size)return Promise.resolve(this.windows.size?this.batch():{events:[{t:'close',id:'.'}],state:{}});
    return new Promise(resolve=>{const w={resolve,timer:null};if(this.waiter){clearTimeout(this.waiter.timer);this.waiter.resolve(this.batch())}this.waiter=w;if(timeout!==null&&timeout!==undefined&&timeout>=0)w.timer=setTimeout(()=>{if(this.waiter===w){this.waiter=null;resolve(this.batch())}},Math.min(timeout,600000))});
  }
  setVar(name,value,fromUser=false){this.vars.set(name,value);if(fromUser)this.dirtyVars[name]=value;for(const id of this.varUsers.get(name)||[]){const r=this.widgets.get(id);if(r)this.syncVar(r)}}
  useVar(rec,name){if(!name)return;if(!this.varUsers.has(name))this.varUsers.set(name,new Set());this.varUsers.get(name).add(rec.id)}
  varOf(rec,key){const v=rec.opts[key];return v&&typeof v==='object'&&'var'in v?v.var:null}
  cbOf(v){return v&&typeof v==='object'&&v.cb?v.cb:null}
  fire(cb,args=[]){if(cb)this.push({t:'cb',cb,args})}
  hasBinding(rec,type){const top=rec.win;for(const tag of[rec.id,top,'all']){const set=this.bound.get(tag);if(set)for(const s of set)if(seqType(s)===type)return true}if(rec.kind==='canvas'&&this.bound.get(rec.id))return[...this.bound.get(rec.id)].some(s=>seqType(s)===type);return false}

  // ---------- Befehle aus Python ----------
  apply(ops){
    for(const op of ops){try{this.op(op)}catch(e){console.warn('tk op',op.op,e)}}
    this.scheduleLayout();
  }
  op(o){
    const rec=this.widgets.get(o.id);
    switch(o.op){
      case'window':return this.createWindow(o);
      case'create':return this.createWidget(o);
      case'config':if(rec){Object.assign(rec.opts,o.opts);this.render(rec,o.opts);this.dirty(rec)}return;
      case'pack':case'grid':case'place':if(rec)this.manage(rec,o.op,o.opts||{});return;
      case'forget':if(rec){this.unmanage(rec);this.dirty(rec)}return;
      case'paneadd':{const c=this.widgets.get(o.child);if(c&&rec){this.unmanage(c);c.manager='paned';c.mopts=o.opts||{};c.master=rec.id;rec.slaves.push(c.id);c.el.style.display='';this.dirty(rec)}return}
      case'propagate':if(rec){rec.propagate=o.flag;this.dirty(rec)}return;
      case'gridconf':if(rec){const t=o.axis==='col'?rec.cols:rec.rows;t[o.index]={...(t[o.index]||{}),...o.opts};this.dirty(rec)}return;
      case'destroy':return this.destroy(o.id);
      case'title':{const w=this.windows.get(o.id);if(w){w.title=o.title;this.app.updateTitle(w.win,o.title||'tk')}return}
      case'geometry':{const w=this.windows.get(o.id);if(w){if(o.w){w.fixed=[o.w,o.h];w.auto=false;this.resizeWindow(w,o.w,o.h)}if(o.x!=null&&o.y!=null){const el=w.win.element;el.style.left=Math.max(0,+o.x)+'px';el.style.top=Math.max(0,+o.y)+'px'}}return}
      case'resizable':{const w=this.windows.get(o.id);if(w)w.win.element.classList.toggle('fixed-size',!o.w&&!o.h);return}
      case'minsize':return;
      case'wmstate':{const w=this.windows.get(o.id);if(!w)return;if(o.state==='withdrawn')w.win.element.style.display='none';else{w.win.element.style.display='';if(o.state==='iconic')this.app.minimizeWindow?.(w.win);if(o.state==='zoomed'&&!w.win.maximized)this.app.toggleMax?.(w.win)}return}
      case'wmattr':{const w=this.windows.get(o.id);if(!w)return;if(o.key==='fullscreen'&&o.value&&!w.win.maximized)this.app.toggleMax?.(w.win);if(o.key==='topmost'&&o.value)w.win.element.style.zIndex=99990;if(o.key==='alpha')w.win.element.style.opacity=o.value;return}
      case'raise':{const w=this.windows.get(o.id);if(w)this.app.focusWindow(w.win);return}
      case'var':return this.setVar(o.name,o.value);
      case'bind':{if(!this.bound.has(o.id))this.bound.set(o.id,new Set());this.bound.get(o.id).add(o.seq);return}
      case'focus':if(rec){this.focus=o.id;setTimeout(()=>(rec.input||rec.el).focus?.({preventScroll:true}),0)}return;
      case'value':if(rec)this.setValue(rec,o.value);return;
      case'cursor':if(rec?.input?.setSelectionRange)try{rec.input.setSelectionRange(o.index,o.index)}catch{}return;
      case'selrange':if(rec?.input?.setSelectionRange)try{rec.input.focus();rec.input.setSelectionRange(o.start,o.end)}catch{}return;
      case'see':if(rec?.kind==='text'&&rec.input){rec.input.scrollTop=rec.input.scrollHeight*(o.pos/Math.max(1,rec.input.value.length))}else if(rec?.kind==='listbox')rec.el.children[o.pos]?.scrollIntoView({block:'nearest'});return;
      case'textspan':case'texttag':case'textuntag':case'textcmd':return;
      case'lb':if(rec){rec.items=o.items;rec.sel=o.sel||[];rec.colors=o.colors||{};this.renderList(rec);this.dirty(rec)}return;
      case'tree':if(rec){rec.tree=o;this.renderTree(rec);this.dirty(rec)}return;
      case'nb':if(rec){rec.tabs=o.tabs;rec.current=o.current;this.renderNotebook(rec);this.dirty(rec)}return;
      case'menu':if(rec){rec.items=o.items;for(const w of this.windows.values())if(w.menu===o.id)this.renderMenubar(w)}return;
      case'popup':return this.popupMenu(o.id,o.x,o.y);
      case'image':this.images.set(o.name,{src:o.src,w:o.w,h:o.h});for(const r of this.widgets.values())if(r.imgName===o.name||r.kind==='canvas'){this.render(r,{});if(r.kind==='canvas')this.refreshCanvasImages(r,o.name);this.dirty(r)}return;
      case'citem':if(rec)this.canvasItem(rec,o);return;
      case'ccoords':if(rec){const it=rec.items.get(o.item);if(it){it.coords=o.coords;this.drawItem(rec,it)}}return;
      case'cconfig':if(rec){const it=rec.items.get(o.item);if(it){Object.assign(it.opts,o.opts);this.drawItem(rec,it)}}return;
      case'cdelete':if(rec){const it=rec.items.get(o.item);if(it){it.el?.remove();rec.items.delete(o.item);if(it.type==='window'){const c=this.widgets.get(it.opts.window?.w);if(c)c.el.style.display='none'}}}return;
      case'corder':if(rec){for(const i of o.order){const it=rec.items.get(i);if(it?.el)rec.svg.append(it.el)}}return;
      case'pbstart':if(rec){clearInterval(rec.pbTimer);rec.pbTimer=setInterval(()=>{rec.opts.value=((+rec.opts.value||0)+1)%(+rec.opts.maximum||100);this.render(rec,{value:rec.opts.value})},o.interval||50)}return;
      case'pbstop':if(rec)clearInterval(rec.pbTimer);return;
      case'style':this.styles.set(o.name,{...(this.styles.get(o.name)||{}),...o.opts});for(const r of this.widgets.values())if(r.ttk)this.render(r,{});return;
      case'theme':return;
      case'bell':try{const ctx=new AudioContext();const osc=ctx.createOscillator();osc.frequency.value=880;osc.connect(ctx.destination);osc.start();setTimeout(()=>{osc.stop();ctx.close()},90)}catch{}return;
      case'clipboard':navigator.clipboard?.writeText(o.text).catch(()=>{});return;
    }
  }

  // ---------- Fenster ----------
  createWindow(o){
    const app=this.app;const win=app.makeWindow('pyapp',o.title||'tk','python',{width:320,height:220});
    win.content.className=`window-content tk-content tk-fam-${this.fam}`;
    win.content.innerHTML='<nav class="tk-menubar" hidden></nav><div class="tk-root" tabindex="-1"></div>';
    const root=win.content.querySelector('.tk-root');
    const rec=this.newRecord(o.id,o.kind==='tk'?'tk':'toplevel',null,o.id,o.opts||{});rec.el=root;rec.el.dataset.tk=o.id;
    const w={id:o.id,win,root:rec,auto:true,fixed:null,menu:null,title:o.title};this.windows.set(o.id,w);
    win.beforeClose=()=>{if(this.session.closed||!this.windows.has(o.id))return true;this.push({t:'close',id:o.id});return false};
    win.onResize=()=>{w.auto=false;this.layoutWindow(w)};
    this.attachEvents(w);this.render(rec,rec.opts);
    return w;
  }
  resizeWindow(w,cw,ch){
    const el=w.win.element,content=w.win.content;if(w.win.maximized)return;
    const extraW=el.offsetWidth-content.clientWidth,extraH=el.offsetHeight-content.clientHeight;
    const mb=w.win.content.querySelector('.tk-menubar');const mbh=mb&&!mb.hidden?mb.offsetHeight:0;
    el.style.width=Math.max(120,Math.round(cw+extraW))+'px';el.style.height=Math.max(60,Math.round(ch+extraH+mbh))+'px';
    w.win.restore={left:el.offsetLeft,top:el.offsetTop,width:el.offsetWidth,height:el.offsetHeight};
  }
  closeAll(){for(const r of this.widgets.values())clearInterval(r.pbTimer);for(const w of[...this.windows.values()]){this.windows.delete(w.id);this.app.closeWindowById(w.win.id)}this.widgets.clear();if(this.waiter){const wt=this.waiter;this.waiter=null;wt.resolve({events:[{t:'close',id:'.'}],state:{}})}}
  destroy(id){
    const rec=this.widgets.get(id);if(!rec)return;
    for(const c of[...this.widgets.values()])if(c.parent===id)this.destroy(c.id);
    clearInterval(rec.pbTimer);this.unmanage(rec);
    if(this.windows.has(id)){const w=this.windows.get(id);this.windows.delete(id);this.app.closeWindowById(w.win.id)}else rec.el?.remove();
    this.widgets.delete(id);this.bound.delete(id);
  }
  newRecord(id,kind,parent,win,opts){const rec={id,kind,parent,win,opts:{...opts},slaves:[],cols:{},rows:{},manager:null,mopts:{},propagate:true,master:null,items:new Map(),ttk:false};this.widgets.set(id,rec);return rec}

  // ---------- Widgets ----------
  createWidget(o){
    const w=this.windows.get(o.win);if(!w)return;
    const rec=this.newRecord(o.id,o.kind,o.parent,o.win,o.opts||{});rec.ttk=Boolean(o.ttk);
    const el=this.build(rec);el.dataset.tk=o.id;el.classList.add('tkw','tk-'+o.kind);if(rec.ttk)el.classList.add('ttk');el.style.display='none';
    rec.el=el;w.root.el.append(el);
    this.render(rec,rec.opts);
  }
  build(rec){
    const k=rec.kind,o=rec.opts;let el;
    const make=(tag,cls='')=>{const e=document.createElement(tag);if(cls)e.className=cls;return e};
    switch(k){
      case'button':el=make('button');el.type='button';el.addEventListener('click',()=>{if(rec.opts.state==='disabled')return;this.fire(this.cbOf(rec.opts.command))});break;
      case'checkbutton':el=make('label');el.innerHTML='<input type="checkbox"><span class="tk-txt"></span>';rec.input=el.firstChild;rec.input.addEventListener('change',()=>{const name=this.varOf(rec,'variable');const on=rec.opts.onvalue??1,off=rec.opts.offvalue??0;if(name)this.setVar(name,rec.input.checked?on:off,true);this.fire(this.cbOf(rec.opts.command))});break;
      case'radiobutton':el=make('label');el.innerHTML='<input type="radio"><span class="tk-txt"></span>';rec.input=el.firstChild;rec.input.addEventListener('change',()=>{const name=this.varOf(rec,'variable');if(name)this.setVar(name,rec.opts.value??'',true);this.fire(this.cbOf(rec.opts.command))});break;
      case'entry':case'spinbox':case'combobox':{
        if(k==='combobox'){el=make('div');el.innerHTML=`<input><datalist id="dl-${rec.id.replace(/\W/g,'_')}${Date.now()}"></datalist>`;rec.input=el.firstChild;rec.input.setAttribute('list',el.lastChild.id);rec.select=make('select');el.append(rec.select);rec.select.addEventListener('change',()=>{rec.input.value=rec.select.value;onInput();this.push({t:'ev',id:rec.id,type:'Virtual',detail:'<<ComboboxSelected>>'})});rec.input.addEventListener('change',()=>{if((rec.opts.values||[]).map(String).includes(rec.input.value))this.push({t:'ev',id:rec.id,type:'Virtual',detail:'<<ComboboxSelected>>'})})}
        else if(k==='spinbox'){el=make('div');el.innerHTML='<input><span class="tk-spin"><button type="button" tabindex="-1">▲</button><button type="button" tabindex="-1">▼</button></span>';rec.input=el.firstChild;const[up,down]=el.querySelectorAll('button');const step=d=>{const vals=rec.opts.values;let v;if(vals&&vals.length){const list=Array.isArray(vals)?vals.map(String):String(vals).split(/\s+/);let i=list.indexOf(rec.input.value);i=Math.max(0,Math.min(list.length-1,(i<0?0:i)+d));v=list[i]}else{const inc=num(rec.opts.increment,1),lo=num(rec.opts.from,0),hi=num(rec.opts.to,100);let n=(parseFloat(rec.input.value)||0)+d*inc;if(n>hi)n=rec.opts.wrap?lo:hi;if(n<lo)n=rec.opts.wrap?hi:lo;v=Number.isInteger(inc)&&Number.isInteger(lo)?String(Math.round(n)):String(+n.toFixed(6))}rec.input.value=v;onInput();this.fire(this.cbOf(rec.opts.command))};up.onclick=()=>step(1);down.onclick=()=>step(-1)}
        else{el=make('input');rec.input=el}
        rec.input.spellcheck=false;
        const onInput=()=>{const name=this.varOf(rec,'textvariable');if(name)this.setVar(name,rec.input.value,true);this.dirtyWidgets[rec.id]={value:rec.input.value,cursor:rec.input.selectionStart}};
        rec.input.addEventListener('input',onInput);rec.input.addEventListener('keyup',()=>{this.dirtyWidgets[rec.id]={value:rec.input.value,cursor:rec.input.selectionStart}});
        break}
      case'text':el=make('textarea');rec.input=el;el.spellcheck=false;el.addEventListener('input',()=>{this.dirtyWidgets[rec.id]={value:el.value,cursor:el.selectionStart,sel:el.selectionStart!==el.selectionEnd?[el.selectionStart,el.selectionEnd]:null}});el.addEventListener('select',()=>{this.dirtyWidgets[rec.id]={value:el.value,cursor:el.selectionStart,sel:[el.selectionStart,el.selectionEnd]}});el.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();document.execCommand('insertText',false,'\t')}});break;
      case'listbox':el=make('div');el.tabIndex=0;rec.items=[];rec.sel=[];el.addEventListener('pointerdown',e=>{const row=e.target.closest('[data-i]');if(!row||rec.opts.state==='disabled')return;const i=+row.dataset.i;const mode=rec.opts.selectmode||'browse';if(mode==='multiple')rec.sel=rec.sel.includes(i)?rec.sel.filter(x=>x!==i):[...rec.sel,i];else if(mode==='extended'&&(e.ctrlKey||e.metaKey))rec.sel=rec.sel.includes(i)?rec.sel.filter(x=>x!==i):[...rec.sel,i];else if(mode==='extended'&&e.shiftKey&&rec.sel.length){const a=rec.sel[0];rec.sel=[];for(let x=Math.min(a,i);x<=Math.max(a,i);x++)rec.sel.push(x)}else rec.sel=[i];this.renderList(rec);this.dirtyWidgets[rec.id]=rec.sel;this.push({t:'ev',id:rec.id,type:'Virtual',detail:'<<ListboxSelect>>'})});
        el.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown'].includes(e.key)||!rec.items.length)return;e.preventDefault();const cur=rec.sel[0]??-1;const i=Math.max(0,Math.min(rec.items.length-1,cur+(e.key==='ArrowUp'?-1:1)));rec.sel=[i];this.renderList(rec);el.children[i]?.scrollIntoView({block:'nearest'});this.dirtyWidgets[rec.id]=rec.sel;this.push({t:'ev',id:rec.id,type:'Virtual',detail:'<<ListboxSelect>>'})});break;
      case'scale':el=make('div');el.innerHTML='<span class="tk-scale-label"></span><span class="tk-scale-val"></span><input type="range">';rec.input=el.querySelector('input');rec.input.addEventListener('input',()=>{const v=this.scaleValue(rec);el.querySelector('.tk-scale-val').textContent=this.fmtScale(rec,v);const name=this.varOf(rec,'variable');if(name)this.setVar(name,v,true);this.dirtyWidgets[rec.id]=v;this.fire(this.cbOf(rec.opts.command),[this.fmtScale(rec,v)])});break;
      case'canvas':el=make('div');rec.svg=document.createElementNS(SVG,'svg');rec.svg.setAttribute('class','tk-svg');el.append(rec.svg);el.tabIndex=0;break;
      case'scrollbar':el=make('div');el.innerHTML='<i></i>';break;
      case'separator':case'sizegrip':el=make('div');break;
      case'progressbar':el=make('div');el.innerHTML='<i></i>';break;
      case'menubutton':case'optionmenu':el=make('select');el.addEventListener('change',()=>{const name=this.varOf(rec,'textvariable');if(name)this.setVar(name,el.value,true);this.fire(this.cbOf(rec.opts.command),[el.value])});break;
      case'notebook':el=make('div');el.innerHTML='<div class="tk-tabs"></div><div class="tk-nb-body"></div>';rec.tabs=[];break;
      case'treeview':el=make('div');el.tabIndex=0;el.innerHTML='<table><thead></thead><tbody></tbody></table>';
        el.addEventListener('pointerdown',e=>{const h=e.target.closest('[data-head]');if(h){const cb=rec.tree?.headings?.[h.dataset.head]?.command;if(cb?.cb)this.fire(cb.cb);return}const row=e.target.closest('[data-iid]');if(!row)return;if(e.target.closest('.tv-tog')){const n=this.findNode(rec,row.dataset.iid);if(n){n.open=!n.open;this.renderTree(rec)}return}const iid=row.dataset.iid;let sel=rec.tree.sel||[];const mode=rec.opts.selectmode||'extended';if(mode==='extended'&&(e.ctrlKey||e.metaKey))sel=sel.includes(iid)?sel.filter(x=>x!==iid):[...sel,iid];else sel=[iid];rec.tree.sel=sel;rec.tree.focus=iid;this.renderTree(rec);this.dirtyWidgets[rec.id]={sel,focus:iid};this.push({t:'ev',id:rec.id,type:'Virtual',detail:'<<TreeviewSelect>>'})});break;
      case'paned':case'frame':case'labelframe':el=make('div');if(k==='labelframe'){rec.legend=make('span','tk-legend');el.append(rec.legend)}break;
      case'message':case'label':default:el=make('div');
    }
    return el;
  }
  render(rec,changed){
    const o=rec.opts,el=rec.el,k=rec.kind;if(!el)return;
    const style=rec.ttk?{...(this.styles.get('.'+this.ttkClass(k))||{}),...(this.styles.get(o.style)||{})}:{};
    const font=tkFont(o.font??style.font);const target=rec.input&&!['checkbutton','radiobutton','scale'].includes(k)?rec.input:el;
    if(font){el.style.font=font.css;if(target!==el)target.style.font=font.css;el.style.textDecoration=font.deco}
    const bg=tkColor(o.background??style.background),fg=tkColor(o.foreground??style.foreground);
    if(bg){(k==='tk'||k==='toplevel'?el.parentElement:el).style.background=bg;if(rec.input&&['entry','text','spinbox','combobox'].includes(k))rec.input.style.background=bg;if(k==='canvas')el.style.background=bg}
    if(fg){el.style.color=fg;if(rec.input)rec.input.style.color=fg}
    if(o.insertbackground&&rec.input)rec.input.style.caretColor=tkColor(o.insertbackground);
    const bd=o.borderwidth!==undefined?num(o.borderwidth):null;const relief=o.relief;
    if(bd!==null||relief){const r=relief||(k==='button'?'raised':'flat');const w=bd??(['button','entry','text','listbox'].includes(k)?2:0);el.style.border=r==='flat'||w===0?'0':`${w}px ${({raised:'outset',sunken:'inset',groove:'groove',ridge:'ridge',solid:'solid'})[r]||'solid'} ${r==='solid'?'#000':'#aaa'}`}
    if(o.highlightthickness!==undefined&&num(o.highlightthickness)>0&&o.highlightbackground)el.style.outline=`${num(o.highlightthickness)}px solid ${tkColor(o.highlightbackground)}`;
    if(o.cursor)el.style.cursor={hand2:'pointer',hand1:'pointer',arrow:'default',xterm:'text',watch:'wait',cross:'crosshair',crosshair:'crosshair',fleur:'move',plus:'cell',circle:'not-allowed'}[o.cursor]||'default';
    const disabled=o.state==='disabled';
    const img=o.image?.img||(typeof o.image==='string'&&o.image?o.image:null);rec.imgName=img;
    const textOf=()=>{const tv=this.varOf(rec,'textvariable');if(tv)this.useVar(rec,tv);return tv?String(this.vars.get(tv)??''):String(o.text??'')};
    const setContent=(node)=>{
      const text=textOf();const image=img&&this.images.get(img);const compound=o.compound||'none';
      const u=o.underline!==undefined&&+o.underline>=0?+o.underline:-1;
      const t=u>=0&&u<text.length?esc(text.slice(0,u))+'<u>'+esc(text[u])+'</u>'+esc(text.slice(u+1)):esc(text);
      if(image&&(compound==='none'||!text))node.innerHTML=`<img src="${image.src}" width="${image.w}" height="${image.h}" alt="">`;
      else if(image){const i=`<img src="${image.src}" width="${image.w}" height="${image.h}" alt="">`;node.innerHTML=compound==='left'?i+' '+t:compound==='right'?t+' '+i:compound==='top'?i+'<br>'+t:compound==='bottom'?t+'<br>'+i:i;node.classList.toggle('tk-compound',true)}
      else node.innerHTML=t;
    };
    const width=o.width!==undefined?num(o.width):null,height=o.height!==undefined?num(o.height):null;
    rec.reqW=null;rec.reqH=null;
    const placed=[el.style.width,el.style.height];if(!CONTAINERS.has(k)){el.style.width='';el.style.height=''}
    switch(k){
      case'label':case'message':case'button':{setContent(el);if(k==='button')el.disabled=disabled;else el.classList.toggle('disabled',disabled);
        const hasImg=img&&this.images.get(img);const ch=font?font.px*0.6:7.5;
        if(width)el.style.width=hasImg?width+'px':`calc(${Math.abs(width)}ch + ${k==='button'?14:4}px)`;else el.style.width='';
        if(height)el.style.height=hasImg?height+'px':`${height*1.3+(k==='button'?0.6:0)}em`;else el.style.height='';
        if(o.wraplength||k==='message'){el.style.whiteSpace='pre-wrap';el.style.maxWidth=(num(o.wraplength)||(k==='message'?ch*40:0))+'px'}
        el.style.justifyContent=({w:'flex-start',e:'flex-end',nw:'flex-start',sw:'flex-start',ne:'flex-end',se:'flex-end'})[o.anchor]||'center';
        el.style.textAlign=o.justify||'center';
        const[px,py]=[o.padx!==undefined?num(o.padx):null,o.pady!==undefined?num(o.pady):null];if(px!==null)el.style.paddingInline=px+'px';if(py!==null)el.style.paddingBlock=py+'px';
        if(k==='button'&&(o.activebackground||o.activeforeground)){el.style.setProperty('--tk-active-bg',tkColor(o.activebackground)||'');el.style.setProperty('--tk-active-fg',tkColor(o.activeforeground)||'')}
        break}
      case'checkbutton':case'radiobutton':{setContent(el.querySelector('.tk-txt'));rec.input.disabled=disabled;const name=this.varOf(rec,'variable');if(name){this.useVar(rec,name);if(k==='radiobutton')rec.input.name='tkr'+name}if(o.indicatoron===0||o.indicatoron===false)el.classList.add('tk-toggle');if(o.selectcolor)el.style.setProperty('--tk-select',tkColor(o.selectcolor));this.syncVar(rec);if(width)el.style.width=`calc(${width}ch + 26px)`;break}
      case'entry':case'spinbox':case'combobox':{
        const name=this.varOf(rec,'textvariable');if(name){this.useVar(rec,name);this.syncVar(rec)}
        rec.input.type=o.show?'password':'text';rec.input.disabled=disabled;rec.input.readOnly=o.state==='readonly';rec.input.style.textAlign=o.justify==='right'?'right':o.justify==='center'?'center':'left';
        el.style.width=`calc(${width??20}ch + ${k==='entry'?8:28}px)`;
        if(k==='combobox'){const vals=(Array.isArray(o.values)?o.values:String(o.values??'').split(/\s+/).filter(Boolean)).map(String);el.querySelector('datalist').innerHTML=vals.map(v=>`<option value="${esc(v)}">`).join('');rec.select.innerHTML=`<option value="" hidden></option>`+vals.map(v=>`<option${v===rec.input.value?' selected':''}>${esc(v)}</option>`).join('');el.classList.toggle('readonly',o.state==='readonly');rec.select.disabled=disabled}
        if(k==='spinbox'&&!rec.input.value&&!name){const vals=o.values;rec.input.value=vals?(Array.isArray(vals)?vals:String(vals).split(/\s+/))[0]??'':String(o.from??0)}
        break}
      case'text':{rec.input.disabled=false;rec.input.readOnly=disabled;rec.input.wrap=o.wrap==='none'?'off':'soft';rec.input.style.whiteSpace=o.wrap==='none'?'pre':'pre-wrap';const ch=width??80,ln=height??24;el.style.width=`calc(${ch}ch + 10px)`;el.style.height=`calc(${ln}*1.25em + 8px)`;break}
      case'listbox':{const ch=width??20,ln=height??10;el.style.width=`calc(${ch||20}ch + 6px)`;el.style.height=`calc(${ln}*1.35em + 4px)`;const lv=this.varOf(rec,'listvariable');if(lv)this.useVar(rec,lv);if(o.selectbackground)el.style.setProperty('--tk-select',tkColor(o.selectbackground));this.renderList(rec);break}
      case'scale':{const from=num(o.from??o.from_,0),to=num(o.to,rec.ttk?1:100),res=num(o.resolution,rec.ttk?0:1);const orient=o.orient||(rec.ttk?'horizontal':'vertical');rec.input.min=Math.min(from,to);rec.input.max=Math.max(from,to);rec.input.step=res>0?res:'any';rec.input.disabled=disabled;el.classList.toggle('vertical',orient==='vertical');const len=num(o.length,100);el.style.setProperty('--tk-len',len+'px');el.querySelector('.tk-scale-label').textContent=o.label??'';el.querySelector('.tk-scale-val').hidden=o.showvalue===0||o.showvalue===false||rec.ttk;rec.flip=orient==='vertical'?from<to:from>to;const name=this.varOf(rec,'variable');if(name){this.useVar(rec,name);this.syncVar(rec)}else if(changed.from!==undefined||changed.to!==undefined||!rec.inited){this.setScale(rec,from)}rec.inited=true;break}
      case'canvas':{const w=width??378,h=height??265;rec.canvasW=w;rec.canvasH=h;el.style.width=w+'px';el.style.height=h+'px';if(!bg&&!rec.bgSet)el.style.background=rec.ttk?'':'var(--tk-bg)';if(bg)rec.bgSet=true;const hl=o.highlightthickness;el.style.boxShadow=hl===0||hl==='0'?'none':'';break}
      case'frame':case'tk':case'toplevel':case'labelframe':case'paned':{
        if(k==='labelframe'&&rec.legend){rec.legend.textContent=o.text??'';if(o.labelanchor)rec.legend.dataset.anchor=o.labelanchor}
        const[px,py]=o.padding!==undefined?pad2(Array.isArray(o.padding)?o.padding:String(o.padding).split(/\s+/)):[num(o.padx),num(o.pady)];rec.pad=[px,py];
        if(k==='tk'||k==='toplevel'){if(o.menu?.w)this.attachMenu(rec,o.menu.w);if(bg){el.style.background=bg;el.parentElement.style.background=bg}}
        break}
      case'progressbar':{const max=num(o.maximum,100),val=num(o.value,0);el.querySelector('i').style.width=Math.max(0,Math.min(100,val/max*100))+'%';const len=num(o.length,100);const vert=o.orient==='vertical';el.classList.toggle('vertical',vert);el.style.width=(vert?14:len)+'px';el.style.height=(vert?len:14)+'px';el.classList.toggle('indeterminate',o.mode==='indeterminate');break}
      case'scrollbar':el.classList.toggle('horizontal',o.orient==='horizontal');break;
      case'separator':el.classList.toggle('vertical',o.orient==='vertical');break;
      case'menubutton':case'optionmenu':{const name=this.varOf(rec,'textvariable');if(name)this.useVar(rec,name);const vals=(o.values||[]).map(String);const cur=name?String(this.vars.get(name)??''):String(o.text??'');el.innerHTML=(vals.includes(cur)?'':`<option>${esc(cur)}</option>`)+vals.map(v=>`<option${v===cur?' selected':''}>${esc(v)}</option>`).join('');el.disabled=disabled;if(width)el.style.width=`calc(${width}ch + 30px)`;break}
      case'treeview':{const ln=height??10;el.style.height=`calc(${ln}*1.6em + 2.2em)`;if(rec.tree)this.renderTree(rec);break}
      case'notebook':if(width)el.style.width=width+'px';if(height)el.style.height=height+'px';break;
    }
    if(width!==null&&CONTAINERS.has(k)){rec.reqW=width}if(height!==null&&CONTAINERS.has(k)){rec.reqH=height}
    if(!CONTAINERS.has(k)){rec.natW=el.style.width;rec.natH=el.style.height;if(rec.box){el.style.width=placed[0];el.style.height=placed[1]}}
    this.dirty(rec);
  }
  ttkClass(k){return({button:'TButton',label:'TLabel',entry:'TEntry',frame:'TFrame',checkbutton:'TCheckbutton',radiobutton:'TRadiobutton',combobox:'TCombobox',labelframe:'TLabelframe',scale:'TScale',progressbar:'TProgressbar',treeview:'Treeview',notebook:'TNotebook',spinbox:'TSpinbox'})[k]||k}
  syncVar(rec){
    const k=rec.kind;
    if(k==='checkbutton'){const name=this.varOf(rec,'variable');if(name){const v=this.vars.get(name);rec.input.checked=String(v)===String(rec.opts.onvalue??1)||v===true}rec.el.classList.toggle('on',rec.input.checked)}
    else if(k==='radiobutton'){const name=this.varOf(rec,'variable');if(name){rec.input.checked=String(this.vars.get(name))===String(rec.opts.value??'')}rec.el.classList.toggle('on',rec.input.checked)}
    else if(['entry','spinbox','combobox'].includes(k)){const name=this.varOf(rec,'textvariable');if(name){const v=String(this.vars.get(name)??'');if(rec.input.value!==v)rec.input.value=v;if(rec.select)rec.select.value=v}}
    else if(k==='scale'){const name=this.varOf(rec,'variable');if(name)this.setScale(rec,Number(this.vars.get(name))||0)}
    else if(k==='listbox'){const lv=this.varOf(rec,'listvariable');if(lv){const v=this.vars.get(lv);rec.items=Array.isArray(v)?v.map(String):String(v??'').replace(/^\(|\)$/g,'').split(/,\s*|\s+/).map(s=>s.replace(/^['"]|['"]$/g,'')).filter(Boolean);this.renderList(rec)}}
    else if(['label','button','message'].includes(k)||k==='menubutton'||k==='optionmenu')this.render(rec,{});
    this.dirty(rec);
  }
  setValue(rec,value){
    if(rec.kind==='text'){rec.input.value=String(value);rec.input.scrollTop=rec.input.scrollHeight}
    else if(rec.kind==='scale')this.setScale(rec,Number(value)||0);
    else if(rec.input){rec.input.value=String(value);if(rec.select)rec.select.value=String(value)}
  }
  scaleValue(rec){const v=Number(rec.input.value);const min=Number(rec.input.min),max=Number(rec.input.max);return rec.flip?min+max-v:v}
  setScale(rec,v){const min=Number(rec.input.min),max=Number(rec.input.max);rec.input.value=rec.flip?min+max-v:v;rec.el.querySelector('.tk-scale-val').textContent=this.fmtScale(rec,v)}
  fmtScale(rec,v){const res=num(rec.opts.resolution,1);if(res>=1&&Number.isInteger(res))return String(Math.round(v));const d=Math.max(0,-Math.floor(Math.log10(res||0.01)));return v.toFixed(d)}
  renderList(rec){const colors=rec.colors||{};rec.el.innerHTML=(rec.items||[]).map((t,i)=>{const c=colors[i]||{};return`<div data-i="${i}" class="${rec.sel?.includes(i)?'sel':''}" style="${c.background?`background:${tkColor(c.background)};`:''}${c.foreground?`color:${tkColor(c.foreground)}`:''}">${esc(t)||'&nbsp;'}</div>`}).join('');rec.el.classList.toggle('disabled',rec.opts.state==='disabled')}
  findNode(rec,iid){const walk=list=>{for(const n of list){if(n.iid===iid)return n;const r=walk(n.children||[]);if(r)return r}return null};return walk(rec.tree?.rows||[])}
  renderTree(rec){
    const t=rec.tree;if(!t)return;const show=String(t.show||'tree headings');const tree=show.includes('tree'),heads=show.includes('headings');
    const cols=t.columns||[];const cfg=c=>t.cols?.[c]||{};const hd=c=>t.headings?.[c]||{};
    const width=c=>cfg(c).width?`width:${num(cfg(c).width)}px;`:'';const align=c=>{const a=cfg(c).anchor;return a==='e'?'right':a==='center'?'center':'left'};
    const head=heads?`<tr>${tree?`<th data-head="#0" style="${width('#0')}">${esc(hd('#0').text||'')}</th>`:''}${cols.map(c=>`<th data-head="${esc(c)}" style="${width(c)}text-align:${hd(c).anchor==='e'?'right':hd(c).anchor==='w'?'left':'center'}">${esc(hd(c).text??c)}</th>`).join('')}</tr>`:'';
    let body='';const sel=new Set(t.sel||[]);
    const walk=(nodes,depth)=>{for(const n of nodes){const tagStyle=(n.tags||[]).map(g=>t.tagcfg?.[g]).filter(Boolean).reduce((a,c)=>({...a,...c}),{});const st=`${tagStyle.background?`background:${tkColor(tagStyle.background)};`:''}${tagStyle.foreground?`color:${tkColor(tagStyle.foreground)};`:''}${tagStyle.font?`font:${tkFont(tagStyle.font).css};`:''}`;
      body+=`<tr data-iid="${esc(n.iid)}" class="${sel.has(n.iid)?'sel':''}" style="${st}">${tree?`<td style="padding-left:${6+depth*16}px">${n.children?.length?`<span class="tv-tog">${n.open?'▾':'▸'}</span>`:'<span class="tv-tog"></span>'}${esc(n.text)}</td>`:''}${cols.map((c,i)=>`<td style="text-align:${align(c)}">${esc(n.values?.[i]??'')}</td>`).join('')}</tr>`;if(n.open&&n.children?.length)walk(n.children,depth+1)}};
    walk(t.rows||[],0);rec.el.querySelector('thead').innerHTML=head;rec.el.querySelector('tbody').innerHTML=body;
  }
  renderNotebook(rec){
    const bar=rec.el.querySelector('.tk-tabs');bar.innerHTML=(rec.tabs||[]).filter(t=>t.state!=='hidden').map(t=>`<button type="button" data-tab="${esc(t.id)}" class="${t.id===rec.current?'on':''}" ${t.state==='disabled'?'disabled':''}>${esc(t.text??'')}</button>`).join('');
    bar.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{rec.current=b.dataset.tab;this.dirtyWidgets[rec.id]=rec.current;this.renderNotebook(rec);this.dirty(rec);this.push({t:'ev',id:rec.id,type:'Virtual',detail:'<<NotebookTabChanged>>'})});
    for(const t of rec.tabs||[]){const c=this.widgets.get(t.id);if(c){if(c.manager!=='notebook'){this.unmanage(c);c.manager='notebook';c.master=rec.id;rec.slaves.push(c.id)}c.mopts={...t}}}
  }
  // ---------- Menüs ----------
  attachMenu(rootRec,menuId){const w=this.windows.get(rootRec.id);if(!w)return;w.menu=menuId;this.renderMenubar(w)}
  menuItems(menuId){const m=this.widgets.get(menuId);if(!m)return[];return(m.items||[]).filter(i=>i.type!=='tearoff').map(i=>{
    if(i.type==='separator')return{sep:true};
    const label=(i.type==='checkbutton'?(String(this.vars.get(i.variable?.var))===String(i.onvalue??1)?'✓ ':'   '):i.type==='radiobutton'?(String(this.vars.get(i.variable?.var))===String(i.value??i.label)?'● ':'   '):'')+(i.label??'');
    if(i.type==='cascade')return{label,submenu:this.menuItems(i.menu?.w)};
    return{label,shortcut:i.accelerator,disabled:i.state==='disabled',action:()=>{if(i.type==='checkbutton'&&i.variable?.var){const on=String(this.vars.get(i.variable.var))===String(i.onvalue??1);this.setVar(i.variable.var,on?(i.offvalue??0):(i.onvalue??1),true)}if(i.type==='radiobutton'&&i.variable?.var)this.setVar(i.variable.var,i.value??i.label,true);this.fire(this.cbOf(i.command))}}})}
  renderMenubar(w){const bar=w.win.content.querySelector('.tk-menubar');const m=this.widgets.get(w.menu);if(!m){bar.hidden=true;return}bar.hidden=false;bar.innerHTML=(m.items||[]).map((i,n)=>i.type==='separator'?'':`<button type="button" data-m="${n}">${esc(i.label??'')}</button>`).join('');
    bar.querySelectorAll('[data-m]').forEach(b=>b.onclick=e=>{e.stopPropagation();const item=m.items[+b.dataset.m];const r=b.getBoundingClientRect();if(item.type==='cascade')this.app.chrome.contextMenu(r.left,r.bottom,this.menuItems(item.menu?.w));else this.fire(this.cbOf(item.command))});this.scheduleLayout(w.id)}
  popupMenu(id,x,y){const items=this.menuItems(id);if(items.length)this.app.chrome.contextMenu(x,y,items)}

  // ---------- Canvas ----------
  canvasItem(rec,o){const it={id:o.item,type:o.type,coords:o.coords,opts:o.opts||{},tags:o.tags||[],el:null};rec.items.set(o.item,it);this.drawItem(rec,it)}
  refreshCanvasImages(rec,name){for(const it of rec.items.values())if(it.type==='image'&&(it.opts.image?.img||it.opts.image)===name)this.drawItem(rec,it)}
  drawItem(rec,it){
    const o=it.opts,c=it.coords||[];const svg=rec.svg;
    if(it.type==='window'){this.dirty(rec);return}
    const tag={line:'polyline',rectangle:'rect',oval:'ellipse',polygon:'polygon',arc:'path',text:'text',image:'image'}[it.type];if(!tag)return;
    let el=it.el;if(!el||el.tagName!==tag){const fresh=document.createElementNS(SVG,tag);if(el)el.replaceWith(fresh);else svg.append(fresh);el=it.el=fresh;el.dataset.item=it.id}
    const hidden=o.state==='hidden';el.style.display=hidden?'none':'';
    const color=(v,d)=>v===undefined?d:(v===''?'none':tkColor(v));
    const width=num(o.width,1);const dash=o.dash?(Array.isArray(o.dash)?o.dash.join(' '):String(o.dash).replace(/[-.,_]/g,m=>({'-':'6 3 ','.':'2 3 ',',':'4 3 ','_':'8 3 '})[m])):'';
    const set=(k,v)=>{if(v===null||v===undefined)el.removeAttribute(k);else el.setAttribute(k,v)};
    if(it.type==='line'){set('points',pairs(c));set('fill','none');set('stroke',color(o.fill,'#000'));set('stroke-width',width);set('stroke-linecap',o.capstyle==='round'?'round':o.capstyle==='projecting'?'square':'butt');set('stroke-linejoin',o.joinstyle||'round');set('stroke-dasharray',dash||null);
      if(o.arrow&&o.arrow!=='none'){const id=this.arrowMarker(rec,color(o.fill,'#000'));set('marker-end',['last','both'].includes(o.arrow)?`url(#${id})`:null);set('marker-start',['first','both'].includes(o.arrow)?`url(#${id}s)`:null)}
      if(o.smooth&&o.smooth!=='0'&&c.length>=6){const p=[];for(let i=0;i<c.length;i+=2)p.push([c[i],c[i+1]]);let d=`M${p[0][0]},${p[0][1]}`;for(let i=1;i<p.length-1;i++){const mx=(p[i][0]+p[i+1][0])/2,my=(p[i][1]+p[i+1][1])/2;d+=` Q${p[i][0]},${p[i][1]} ${i===p.length-2?p[i+1][0]:mx},${i===p.length-2?p[i+1][1]:my}`}const path=document.createElementNS(SVG,'path');for(const a of el.getAttributeNames())if(a!=='points')path.setAttribute(a,el.getAttribute(a));path.setAttribute('d',d);el.replaceWith(path);it.el=path}}
    else if(it.type==='rectangle'){const[x1,y1,x2,y2]=c;set('x',Math.min(x1,x2));set('y',Math.min(y1,y2));set('width',Math.abs(x2-x1));set('height',Math.abs(y2-y1));set('fill',color(o.fill,'none'));set('stroke',color(o.outline,'#000'));set('stroke-width',width);set('stroke-dasharray',dash||null)}
    else if(it.type==='oval'){const[x1,y1,x2,y2]=c;set('cx',(x1+x2)/2);set('cy',(y1+y2)/2);set('rx',Math.abs(x2-x1)/2);set('ry',Math.abs(y2-y1)/2);set('fill',color(o.fill,'none'));set('stroke',color(o.outline,'#000'));set('stroke-width',width);set('stroke-dasharray',dash||null)}
    else if(it.type==='polygon'){set('points',pairs(c));set('fill',color(o.fill,'#000'));set('stroke',color(o.outline,'none'));set('stroke-width',width);set('stroke-linejoin','round')}
    else if(it.type==='arc'){const[x1,y1,x2,y2]=c;const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;const start=num(o.start,0),ext=num(o.extent,90);const a0=-start*Math.PI/180,a1=-(start+ext)*Math.PI/180;const p0=[cx+rx*Math.cos(a0),cy+ry*Math.sin(a0)],p1=[cx+rx*Math.cos(a1),cy+ry*Math.sin(a1)];const large=Math.abs(ext)>180?1:0,sweep=ext>0?0:1;let d=`M${p0} A${rx},${ry} 0 ${large} ${sweep} ${p1}`;const style=o.style||'pieslice';if(style==='pieslice')d=`M${cx},${cy} L${p0} A${rx},${ry} 0 ${large} ${sweep} ${p1} Z`;else if(style==='chord')d+=' Z';if(Math.abs(ext)>=360)d=`M${cx-rx},${cy} a${rx},${ry} 0 1 0 ${2*rx},0 a${rx},${ry} 0 1 0 ${-2*rx},0`;set('d',d);set('fill',style==='arc'?'none':color(o.fill,'none'));set('stroke',color(o.outline,'#000'));set('stroke-width',width)}
    else if(it.type==='text'){const f=tkFont(o.font)||tkFont('TkDefaultFont');el.style.font=f.css;if(f.deco)el.style.textDecoration=f.deco;const a=String(o.anchor||'center');const lines=String(o.text??'').split('\n');const lh=f.px*1.2;const total=lh*lines.length;set('fill',color(o.fill,'#000'));set('text-anchor',a.includes('w')?'start':a.includes('e')?'end':'middle');const just=o.justify||'left';let y0=a.includes('n')?c[1]:a.includes('s')?c[1]-total:c[1]-total/2;el.innerHTML='';lines.forEach((l,i)=>{const ts=document.createElementNS(SVG,'tspan');ts.setAttribute('x',c[0]);ts.setAttribute('y',y0+lh*i+f.px*0.95);ts.textContent=l||' ';el.append(ts)});if(lines.length>1&&just!=='left'){}set('dominant-baseline',null);if(o.angle)set('transform',`rotate(${-num(o.angle)} ${c[0]} ${c[1]})`)}
    else if(it.type==='image'){const name=o.image?.img||o.image;const img=this.images.get(name);if(!img){set('href',null);return}const a=String(o.anchor||'center');const x=a.includes('w')?c[0]:a.includes('e')?c[0]-img.w:c[0]-img.w/2,y=a.includes('n')?c[1]:a.includes('s')?c[1]-img.h:c[1]-img.h/2;set('href',img.src);set('x',x);set('y',y);set('width',img.w);set('height',img.h);set('preserveAspectRatio','none')}
  }
  arrowMarker(rec,color){const id=`tka${rec.id.replace(/\W/g,'')}${String(color).replace(/\W/g,'')}`;if(!rec.svg.querySelector('#'+CSS.escape(id))){let defs=rec.svg.querySelector('defs');if(!defs){defs=document.createElementNS(SVG,'defs');rec.svg.prepend(defs)}defs.insertAdjacentHTML('beforeend',`<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker><marker id="${id}s" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`)}return id}
  colorDialog({title,value}){return new Promise(resolve=>{const w=this.app.makeWindow('dialog',title||'Farbe','python',{width:280,height:170,noResize:true,modal:true});w.element.classList.add('dialog-window');w.content.className='window-content dialog-content';w.content.innerHTML=`<div class="dlg-body"><input type="color" class="tk-colorpick" value="${esc(value||'#000000')}"></div><div class="dlg-buttons"><button class="primary" data-ok>OK</button><button data-no>Abbrechen</button></div>`;let done=false;const fin=v=>{if(done)return;done=true;this.app.closeWindowById(w.id);resolve({value:v})};w.beforeClose=()=>{if(!done){done=true;resolve({value:null})}return true};w.content.querySelector('[data-ok]').onclick=()=>fin(w.content.querySelector('input').value);w.content.querySelector('[data-no]').onclick=()=>fin(null)})}

  // ---------- Geometrie ----------
  manage(rec,kind,opts){
    this.unmanage(rec);
    const masterId=opts.in?.w||rec.parent;const master=this.widgets.get(masterId);if(!master)return;
    rec.manager=kind;rec.mopts=opts;rec.master=masterId;master.slaves.push(rec.id);rec.el.style.display='';this.dirty(master);
  }
  unmanage(rec){if(rec.master){const m=this.widgets.get(rec.master);if(m)m.slaves=m.slaves.filter(x=>x!==rec.id);this.dirty(m||rec)}rec.manager=null;rec.master=null;if(rec.el&&!this.windows.has(rec.id))rec.el.style.display='none'}
  dirty(rec){if(rec)this.layoutQueued.add(rec.win)}
  scheduleLayout(win){if(win)this.layoutQueued.add(win);if(this.layoutTimer)return;this.layoutTimer=requestAnimationFrame(()=>{this.layoutTimer=null;this.flushLayout()})}
  flushLayout(){if(this.layoutTimer){cancelAnimationFrame(this.layoutTimer);this.layoutTimer=null}const wins=[...this.layoutQueued];this.layoutQueued.clear();for(const id of wins){const w=this.windows.get(id);if(w)this.layoutWindow(w)}}
  layoutWindow(w){
    const root=w.root;this.reqCache=new Map();
    const req=this.req(root);
    if(w.auto&&!w.win.maximized&&!w.win.snapped){const[cw,ch]=w.fixed||[Math.max(req[0],1),Math.max(req[1],1)];this.resizeWindow(w,cw,ch)}
    const box=root.el.parentElement;const mb=box.querySelector('.tk-menubar');const top=mb&&!mb.hidden?mb.offsetHeight:0;
    const W=box.clientWidth,H=box.clientHeight-top;root.el.style.top=top+'px';
    root.el.style.width=W+'px';root.el.style.height=H+'px';
    this.arrange(root,0,0,W,H,true);
    const key=root.id;const prev=w.size;if(!prev||prev[0]!==W||prev[1]!==H){w.size=[W,H];this.dirtySizes[key]=[W,H];if(this.hasBinding(root,'Configure'))this.push({t:'ev',id:root.id,type:'Configure',width:W,height:H})}
  }
  inner(rec){const k=rec.kind;let[l,t,r,b]=[0,0,0,0];const bd=rec.opts.borderwidth!==undefined?num(rec.opts.borderwidth):(k==='labelframe'?2:0);l=t=r=b=bd;if(k==='labelframe'){t+=rec.legend?.offsetHeight?rec.legend.offsetHeight-2:12;l+=2;r+=2;b+=2}if(k==='notebook'){const bar=rec.el.querySelector('.tk-tabs');t+=bar.offsetHeight+1;l+=1;r+=1;b+=1}const[px,py]=rec.pad||[0,0];return[l+px,t+py,r+px,b+py]}
  measure(rec){
    const st=rec.el.style;const keep=[st.width,st.height,st.display];if(st.display==='none')st.display='';
    st.width=rec.natW||'';st.height=rec.natH||'';
    const r=[Math.ceil(rec.el.offsetWidth),Math.ceil(rec.el.offsetHeight)];
    st.width=keep[0];st.height=keep[1];st.display=keep[2];return r;
  }
  req(rec){
    if(this.reqCache.has(rec.id))return this.reqCache.get(rec.id);
    let size;
    if(CONTAINERS.has(rec.kind)||rec.kind==='canvas'){
      const[l,t,r,b]=this.inner(rec);
      const slaves=rec.slaves.map(id=>this.widgets.get(id)).filter(Boolean);
      let w=0,h=0;
      if(rec.kind==='canvas'){w=rec.canvasW;h=rec.canvasH}
      else if(rec.kind==='notebook'||rec.kind==='paned'){for(const s of slaves){const q=this.req(s);if(rec.kind==='paned'&&rec.opts.orient!=='vertical'){w+=q[0];h=Math.max(h,q[1])}else if(rec.kind==='paned'){h+=q[1];w=Math.max(w,q[0])}else{w=Math.max(w,q[0]);h=Math.max(h,q[1])}}w+=l+r;h+=t+b;if(rec.kind==='notebook')w=Math.max(w,rec.el.querySelector('.tk-tabs').scrollWidth+2)}
      else{
        const pack=slaves.filter(s=>s.manager==='pack'),grid=slaves.filter(s=>s.manager==='grid');
        if(pack.length){let width=0,height=0,maxW=0,maxH=0;for(const s of pack){const q=this.req(s);const[px,py]=this.padOf(s);const ipx=num(s.mopts.ipadx)*2,ipy=num(s.mopts.ipady)*2;const side=s.mopts.side||'top';if(side==='top'||side==='bottom'){maxW=Math.max(maxW,q[0]+px+ipx+width);height+=q[1]+py+ipy}else{maxH=Math.max(maxH,q[1]+py+ipy+height);width+=q[0]+px+ipx}}w=Math.max(maxW,width);h=Math.max(maxH,height)}
        if(grid.length){const g=this.gridDims(rec,grid);w=Math.max(w,g.cw.reduce((a,b)=>a+b,0));h=Math.max(h,g.rh.reduce((a,b)=>a+b,0))}
        if(rec.kind==='labelframe'&&rec.legend)w=Math.max(w,rec.legend.offsetWidth+12);
        w+=l+r;h+=t+b;
        if(!pack.length&&!grid.length||rec.propagate===false){if(rec.reqW!==null&&rec.reqW!==undefined)w=num(rec.reqW);if(rec.reqH!==null&&rec.reqH!==undefined)h=num(rec.reqH);if(!pack.length&&!grid.length&&rec.reqW==null&&rec.kind!=='tk'&&rec.kind!=='toplevel')w=Math.max(w,1);if(!pack.length&&!grid.length&&(rec.kind==='tk'||rec.kind==='toplevel')&&!slaves.length){w=w||200;h=h||200}}
      }
      size=[w,h];
    }else size=this.measure(rec);
    this.reqCache.set(rec.id,size);return size;
  }
  padOf(s){const[a,b]=pad2(s.mopts.padx??0);const[c,d]=pad2(s.mopts.pady??0);return[a+b,c+d,a,c]}
  gridDims(rec,grid){
    const cw=[],rh=[];const span=[];
    for(const s of grid){const q=this.req(s);const c=+(s.mopts.column??0),r=+(s.mopts.row??0),cs=+(s.mopts.columnspan??1),rs=+(s.mopts.rowspan??1);const[px,py]=this.padOf(s);const w=q[0]+px+num(s.mopts.ipadx)*2,h=q[1]+py+num(s.mopts.ipady)*2;if(cs===1)cw[c]=Math.max(cw[c]||0,w);if(rs===1)rh[r]=Math.max(rh[r]||0,h);span.push([c,r,cs,rs,w,h]);cw[c+cs-1]??=0;rh[r+rs-1]??=0}
    for(const[c,r,cs,rs,w,h]of span){if(cs>1){const have=cw.slice(c,c+cs).reduce((a,b)=>a+(b||0),0);if(w>have)for(let i=c;i<c+cs;i++)cw[i]=(cw[i]||0)+(w-have)/cs}if(rs>1){const have=rh.slice(r,r+rs).reduce((a,b)=>a+(b||0),0);if(h>have)for(let i=r;i<r+rs;i++)rh[i]=(rh[i]||0)+(h-have)/rs}}
    for(let i=0;i<cw.length;i++){cw[i]=Math.max(cw[i]||0,num(rec.cols[i]?.minsize));if(rec.cols[i]?.uniform){}}for(let i=0;i<rh.length;i++)rh[i]=Math.max(rh[i]||0,num(rec.rows[i]?.minsize));
    for(const[i,c]of Object.entries(rec.cols))if(+i>=cw.length&&num(c.minsize))cw[+i]=num(c.minsize);for(const[i,r]of Object.entries(rec.rows))if(+i>=rh.length&&num(r.minsize))rh[+i]=num(r.minsize);
    for(let i=0;i<cw.length;i++)cw[i]??=0;for(let i=0;i<rh.length;i++)rh[i]??=0;
    return{cw,rh};
  }
  place(rec,x,y,w,h){const st=rec.el.style;st.left=Math.round(x)+'px';st.top=Math.round(y)+'px';st.width=Math.max(0,Math.round(w))+'px';st.height=Math.max(0,Math.round(h))+'px';st.display='';rec.box=[x,y,w,h];const prev=rec.lastSize;if(!prev||Math.round(prev[0])!==Math.round(w)||Math.round(prev[1])!==Math.round(h)){rec.lastSize=[w,h];this.dirtySizes[rec.id]=[Math.round(w),Math.round(h),Math.round(x),Math.round(y)];if(this.hasBinding(rec,'Configure')&&!this.windows.has(rec.id))this.push({t:'ev',id:rec.id,type:'Configure',width:Math.round(w),height:Math.round(h)})}}
  arrange(rec,x,y,W,H,isRoot=false){
    if(!isRoot)this.place(rec,x,y,W,H);else rec.box=[0,0,W,H];
    const ox=isRoot?0:x,oy=isRoot?0:y;
    if(!CONTAINERS.has(rec.kind)&&rec.kind!=='canvas')return;
    const[l,t,r,b]=this.inner(rec);const cx=ox+l,cy=oy+t,cW=Math.max(0,W-l-r),cH=Math.max(0,H-t-b);
    const slaves=rec.slaves.map(id=>this.widgets.get(id)).filter(Boolean);
    if(rec.kind==='canvas'){for(const it of rec.items.values()){if(it.type!=='window')continue;const c=this.widgets.get(it.opts.window?.w);if(!c)continue;const q=this.req(c);const w=it.opts.width?num(it.opts.width):q[0],h=it.opts.height?num(it.opts.height):q[1];const a=String(it.opts.anchor||'center');const px=a.includes('w')?it.coords[0]:a.includes('e')?it.coords[0]-w:it.coords[0]-w/2,py=a.includes('n')?it.coords[1]:a.includes('s')?it.coords[1]-h:it.coords[1]-h/2;c.el.style.zIndex=2;this.arrange(c,ox+px,oy+py,w,h)}return}
    if(rec.kind==='notebook'){for(const s of slaves){const vis=s.id===rec.current;if(vis)this.arrange(s,cx,cy,cW,cH);else s.el.style.display='none'}return}
    if(rec.kind==='paned'){const vert=rec.opts.orient==='vertical';const reqs=slaves.map(s=>this.req(s));const total=reqs.reduce((a,q)=>a+(vert?q[1]:q[0]),0);const weights=slaves.map(s=>num(s.mopts.weight,0));const tw=weights.reduce((a,b)=>a+b,0);const extra=(vert?cH:cW)-total-(slaves.length-1)*4;let pos=vert?cy:cx;slaves.forEach((s,i)=>{const base=vert?reqs[i][1]:reqs[i][0];const size=base+(tw?extra*weights[i]/tw:(i===slaves.length-1?extra:0));if(vert){this.arrange(s,cx,pos,cW,Math.max(0,size));pos+=size+4}else{this.arrange(s,pos,cy,Math.max(0,size),cH);pos+=size+4}});return}
    // pack
    const pack=slaves.filter(s=>s.manager==='pack');
    let cavX=cx,cavY=cy,cavW=cW,cavH=cH;
    pack.forEach((s,i)=>{
      const q=this.req(s);const side=s.mopts.side||'top';const[px,py,pl,pt]=this.padOf(s);const ipx=num(s.mopts.ipadx)*2,ipy=num(s.mopts.ipady)*2;
      const expand=s.mopts.expand===true||s.mopts.expand===1||s.mopts.expand==='1'||s.mopts.expand==='yes'||s.mopts.expand==='true';
      let fW,fH,fX,fY;
      if(side==='top'||side==='bottom'){fW=cavW;fH=q[1]+py+ipy;if(expand)fH+=this.expansion(pack.slice(i),cavH,'y');fH=Math.min(fH,cavH);cavH-=fH;fX=cavX;if(side==='top'){fY=cavY;cavY+=fH}else fY=cavY+cavH}
      else{fH=cavH;fW=q[0]+px+ipx;if(expand)fW+=this.expansion(pack.slice(i),cavW,'x');fW=Math.min(fW,cavW);cavW-=fW;fY=cavY;if(side==='left'){fX=cavX;cavX+=fW}else fX=cavX+cavW}
      const fill=String(s.mopts.fill||'none');let w=q[0]+ipx,h=q[1]+ipy;
      if(fill==='x'||fill==='both'||w>fW-px)w=fW-px;if(fill==='y'||fill==='both'||h>fH-py)h=fH-py;
      const a=String(s.mopts.anchor||'center');const fx=fX+pl,fy=fY+pt,aw=fW-px,ah=fH-py;
      const x2=a.includes('w')?fx:a.includes('e')?fx+aw-w:fx+(aw-w)/2,y2=a.includes('n')?fy:a.includes('s')?fy+ah-h:fy+(ah-h)/2;
      this.arrange(s,x2,y2,Math.max(0,w),Math.max(0,h));
    });
    // grid
    const grid=slaves.filter(s=>s.manager==='grid');
    if(grid.length){const{cw,rh}=this.gridDims(rec,grid);const dist=(sizes,conf,avail)=>{const total=sizes.reduce((a,b)=>a+b,0);const weights=sizes.map((_,i)=>num(conf[i]?.weight,0));const tw=weights.reduce((a,b)=>a+b,0);const extra=avail-total;if(tw>0)return sizes.map((s,i)=>Math.max(num(conf[i]?.minsize),s+extra*weights[i]/tw));return sizes};const cws=dist(cw,rec.cols,cW),rhs=dist(rh,rec.rows,cH);
      const offX=cws.reduce((a,b)=>a+b,0)<cW&&!Object.values(rec.cols).some(c=>num(c.weight))?(cW-cws.reduce((a,b)=>a+b,0))/2:0,offY=rhs.reduce((a,b)=>a+b,0)<cH&&!Object.values(rec.rows).some(r=>num(r.weight))?(cH-rhs.reduce((a,b)=>a+b,0))/2:0;
      const at=(arr,i)=>arr.slice(0,i).reduce((a,b)=>a+b,0);
      for(const s of grid){const q=this.req(s);const c=+(s.mopts.column??0),r=+(s.mopts.row??0),cs=+(s.mopts.columnspan??1),rs=+(s.mopts.rowspan??1);const[px,py,pl,pt]=this.padOf(s);const ipx=num(s.mopts.ipadx)*2,ipy=num(s.mopts.ipady)*2;
        const X=cx+offX*(rec.kind==='tk'||rec.kind==='toplevel'?0:0)+at(cws,c)+pl,Y=cy+at(rhs,r)+pt,CW=at(cws,c+cs)-at(cws,c)-px,CH=at(rhs,r+rs)-at(rhs,r)-py;
        const sticky=String(s.mopts.sticky||'').toLowerCase().replace(/[^nsew]/g,'');let w=Math.min(q[0]+ipx,CW),h=Math.min(q[1]+ipy,CH);if(sticky.includes('e')&&sticky.includes('w'))w=CW;if(sticky.includes('n')&&sticky.includes('s'))h=CH;
        const x2=sticky.includes('w')?X:sticky.includes('e')?X+CW-w:X+(CW-w)/2,y2=sticky.includes('n')?Y:sticky.includes('s')?Y+CH-h:Y+(CH-h)/2;this.arrange(s,x2,y2,Math.max(0,w),Math.max(0,h))}}
    // place
    for(const s of slaves.filter(s=>s.manager==='place')){const m=s.mopts;const q=this.req(s);const w=(m.width!==undefined?num(m.width):m.relwidth!==undefined?0:q[0])+num(m.relwidth)*cW,h=(m.height!==undefined?num(m.height):m.relheight!==undefined?0:q[1])+num(m.relheight)*cH;let X=cx+num(m.x)+num(m.relx)*cW,Y=cy+num(m.y)+num(m.rely)*cH;const a=String(m.anchor||'nw');if(a.includes('e'))X-=w;else if(!a.includes('w'))X-=w/2;if(a.includes('s'))Y-=h;else if(!a.includes('n'))Y-=h/2;s.el.style.zIndex=3;this.arrange(s,X,Y,w,h)}
  }
  expansion(rest,cavity,axis){
    let min=cavity,numExpand=0;
    for(const s of rest){const q=this.req(s);const[px,py]=this.padOf(s);const side=s.mopts.side||'top';const vertical=side==='top'||side==='bottom';const exp=s.mopts.expand===true||s.mopts.expand===1||s.mopts.expand==='1'||s.mopts.expand==='yes'||s.mopts.expand==='true';
      const child=axis==='y'?q[1]+py+num(s.mopts.ipady)*2:q[0]+px+num(s.mopts.ipadx)*2;
      if((axis==='y')===vertical){cavity-=child;if(exp)numExpand++}else if(numExpand){const cur=(cavity-child)/numExpand;if(cur<min)min=cur}}
    if(numExpand){const cur=cavity/numExpand;if(cur<min)min=cur}else return 0;
    return Math.max(0,min);
  }

  // ---------- Eingaben ----------
  attachEvents(w){
    const root=w.root.el;const winId=w.id;
    const target=e=>{const el=e.target.closest?.('[data-tk]');const rec=el&&this.widgets.get(el.dataset.tk);return rec||w.root};
    const coords=(rec,e)=>{const r=rec.el.getBoundingClientRect();return{x:Math.round(e.clientX-r.left),y:Math.round(e.clientY-r.top),xr:Math.round(e.screenX),yr:Math.round(e.screenY)}};
    const mods=e=>(e.shiftKey?1:0)|(e.ctrlKey?4:0)|(e.altKey?8:0)|(e.metaKey?8:0)|(e.buttons&1?256:0)|(e.buttons&4?512:0)|(e.buttons&2?1024:0);
    const itemOf=e=>{const it=e.target.closest?.('[data-item]');return it?+it.dataset.item:null};
    const mouse=(type,e,extra={})=>{const rec=target(e);this.pointer=[Math.round(e.screenX),Math.round(e.screenY)];if(!this.hasBinding(rec,type))return;this.push({t:'ev',id:rec.id,type,...coords(rec,e),state:mods(e),item:rec.kind==='canvas'?itemOf(e):null,...extra})};
    root.addEventListener('pointerdown',e=>{const rec=target(e);if(!e.target.closest('input,textarea,select,button,[tabindex="0"]'))root.focus({preventScroll:true});this.focus=rec.id;const t=rec.kind==='canvas'||rec===w.root?rec:null;if(t&&!e.target.closest('input,textarea,select'))t.el.focus?.({preventScroll:true});mouse('ButtonPress',e,{num:e.button===2?3:e.button===1?2:1,count:e.detail||1})});
    root.addEventListener('pointerup',e=>mouse('ButtonRelease',e,{num:e.button===2?3:e.button===1?2:1}));
    root.addEventListener('pointermove',e=>mouse('Motion',e));
    root.addEventListener('contextmenu',e=>{const rec=target(e);if(this.hasBinding(rec,'ButtonPress'))e.preventDefault()});
    root.addEventListener('wheel',e=>{const rec=target(e);if(!this.hasBinding(rec,'MouseWheel'))return;e.preventDefault();this.push({t:'ev',id:rec.id,type:'MouseWheel',...coords(rec,e),delta:e.deltaY<0?120:-120,state:mods(e)})},{passive:false});
    root.addEventListener('pointerover',e=>{const rec=target(e);if(rec.lastOver)return;if(this.hasBinding(rec,'Enter'))this.push({t:'ev',id:rec.id,type:'Enter',...coords(rec,e)})});
    root.addEventListener('pointerout',e=>{const rec=target(e);if(e.relatedTarget&&rec.el.contains(e.relatedTarget))return;if(this.hasBinding(rec,'Leave'))this.push({t:'ev',id:rec.id,type:'Leave',...coords(rec,e)})});
    const key=(type,e)=>{const el=document.activeElement?.closest?.('[data-tk]');const rec=(el&&root.contains(el)&&this.widgets.get(el.dataset.tk))||w.root;if(!this.hasBinding(rec,type))return;const keysym=KEYSYMS[e.key]??(e.key.length===1?e.key:e.key);const ch=CHARS[e.key]??(e.key.length===1?e.key:'');
      const inInput=e.target.closest('input,textarea');if(!inInput&&(e.key.startsWith('Arrow')||e.key===' '||e.key==='Tab'))e.preventDefault();
      this.push({t:'ev',id:rec.id,type,keysym,char:ch,keycode:e.keyCode,state:mods(e),x:0,y:0});setTimeout(()=>{if(rec.input)this.dirtyWidgets[rec.id]={value:rec.input.value,cursor:rec.input.selectionStart}},0)};
    root.addEventListener('keydown',e=>{if(e.repeat&&!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)&&e.key.length>1)return;key('KeyPress',e)});
    root.addEventListener('keyup',e=>key('KeyRelease',e));
    root.addEventListener('focusin',e=>{const el=e.target.closest?.('[data-tk]');if(el){this.focus=el.dataset.tk;const rec=this.widgets.get(el.dataset.tk);if(rec&&this.hasBinding(rec,'FocusIn'))this.push({t:'ev',id:rec.id,type:'FocusIn'})}});
    root.addEventListener('focusout',e=>{const el=e.target.closest?.('[data-tk]');const rec=el&&this.widgets.get(el.dataset.tk);if(rec&&this.hasBinding(rec,'FocusOut'))this.push({t:'ev',id:rec.id,type:'FocusOut'})});
    root.addEventListener('dblclick',e=>{const rec=target(e);if(this.hasBinding(rec,'ButtonPress'))this.push({t:'ev',id:rec.id,type:'ButtonPress',num:1,count:2,...coords(rec,e),state:mods(e),item:rec.kind==='canvas'?itemOf(e):null})});
    setTimeout(()=>root.focus({preventScroll:true}),80);
  }
}
function pairs(c){const out=[];for(let i=0;i+1<c.length;i+=2)out.push(`${c[i]},${c[i+1]}`);return out.join(' ')}
