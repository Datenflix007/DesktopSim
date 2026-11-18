// Persistentes, vollständig virtuelles Dateisystem. Nie Zugriff auf reale Dateien.
export const OS_LIST = [
  {id:'winxp',label:'Windows XP',group:'Windows',subtitle:'Luna · Eingabeaufforderung',year:'2001',shell:'cmd',symbol:'⊞',kernel:'NT 5.1'},
  {id:'win7',label:'Windows 7',group:'Windows',subtitle:'Aero · Eingabeaufforderung',year:'2009',shell:'cmd',symbol:'⊞',kernel:'NT 6.1'},
  {id:'win8',label:'Windows 8',group:'Windows',subtitle:'Metro · Eingabeaufforderung',year:'2012',shell:'cmd',symbol:'⊞',kernel:'NT 6.2'},
  {id:'win10',label:'Windows 10',group:'Windows',subtitle:'Fluent · CMD + PowerShell',year:'2015',shell:'cmd',symbol:'⊞',kernel:'NT 10.0'},
  {id:'win11',label:'Windows 11',group:'Windows',subtitle:'Fluent · PowerShell + CMD',year:'2021',shell:'powershell',symbol:'⊞',kernel:'NT 10.0'},
  {id:'debian',label:'Debian Linux',group:'Linux',subtitle:'GNOME · Bash · apt',year:'2025',shell:'bash',symbol:'◈',kernel:'Linux 6.12'},
  {id:'arch',label:'Arch Linux',group:'Linux',subtitle:'KDE Plasma · Bash · pacman',year:'2026',shell:'bash',symbol:'▲',kernel:'Linux 6.17'},
  {id:'macos',label:'macOS',group:'Apple',subtitle:'Finder · Zsh · brew',year:'2025',shell:'zsh',symbol:'',kernel:'Darwin 25'},
  {id:'unix',label:'Unix / CDE',group:'Unix',subtitle:'Common Desktop · sh',year:'1995',shell:'sh',symbol:'◆',kernel:'SunOS 5.11'}
];
export function getOS(id){return OS_LIST.find(o=>o.id===id)||OS_LIST[4]}
export const isWindows = id => String(id).startsWith('win');
export const homePath = id => isWindows(id)?'/Users/Student':id==='macos'?'/Users/student':'/home/student';
export const trashPath = id => isWindows(id)?'/$Recycle.Bin':id==='macos'?homePath(id)+'/.Trash':homePath(id)+'/.local/share/Trash/files';
export const rootNode = () => ({type:'dir',children:{},mtime:Date.now()});
const SEED_TIME = Date.parse('2026-09-01T08:00:00Z');
const folder = (parent,name) => parent.children[name]||(parent.children[name]={type:'dir',children:{},mtime:SEED_TIME});
const file = (parent,name,content,extra={}) => parent.children[name]={type:'file',content,mtime:SEED_TIME,...extra};
const PROJECT_FILES = {
  'hello.py':`# Python-Beispiel · starte mit: python hello.py\nname = input("Wie heißt du? ")\nfor i in range(3):\n    print(f"Hallo {name}! Runde {i + 1}")\n`,
  'rechner.py':`# Kleiner Rechner mit Funktionen und Fehlerbehandlung\ndef teilen(a, b):\n    return a / b\n\ntry:\n    a = float(input("Zahl a: "))\n    b = float(input("Zahl b: "))\n    print(f"{a} / {b} = {teilen(a, b):.2f}")\nexcept ZeroDivisionError:\n    print("Durch 0 teilen geht nicht!")\nexcept ValueError:\n    print("Bitte eine Zahl eingeben.")\n`,
  'Main.java':`import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.print("Wie heißt du? ");\n        String name = sc.nextLine();\n        System.out.println("Hallo " + name + ", willkommen bei Java!");\n        System.out.println("7 / 2 = " + (7 / 2) + " (Ganzzahldivision)");\n    }\n}\n`,
  'main.cpp':`#include <iostream>\n#include <string>\n#include <vector>\n\nint main() {\n    std::vector<int> zahlen = {4, 8, 15, 16, 23, 42};\n    int summe = 0;\n    for (int z : zahlen) summe += z;\n    std::string name;\n    std::cout << "Name: ";\n    std::cin >> name;\n    std::cout << "Hallo " << name << "! Summe = " << summe << std::endl;\n    return 0;\n}\n`,
  'hello.c':`#include <stdio.h>\n\nint main(void) {\n    int alter;\n    printf("Wie alt bist du? ");\n    scanf("%d", &alter);\n    printf("In 10 Jahren bist du %d.\\n", alter + 10);\n    return 0;\n}\n`,
  'hello.js':`// Echtes JavaScript · starte mit: node hello.js\nconst name = prompt("Wie heißt du?");\nconst zahlen = [3, 1, 4, 1, 5, 9];\nconsole.log(\`Hallo \${name}!\`);\nconsole.log("Sortiert:", [...zahlen].sort((a, b) => a - b));\nconsole.table(zahlen.map(z => ({ zahl: z, quadrat: z * z })));\n`,
  'Program.cs':`using System;\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hallo aus C#!");\n        Console.WriteLine(2 + 3);\n    }\n}\n`,
  'index.php':`<?php\n$name = readline("Wie heißt du? ");\necho "Hallo $name, PHP " . PHP_VERSION . " läuft!\\n";\nfor ($i = 1; $i <= 3; $i++) {\n    echo "Zeile $i\\n";\n}\n`,
  'index.html':`<!doctype html>\n<html lang="de">\n<head><meta charset="UTF-8"><title>Meine erste Webseite</title>\n<style>body{font-family:system-ui;background:#e8f3ff;padding:48px;color:#102743}h1{color:#1264ae}button{padding:10px 15px;border:0;border-radius:8px;background:#1264ae;color:white;cursor:pointer}</style></head>\n<body><h1>Hallo aus DesktopSim!</h1><p>Diese HTML-Datei wird in einer abgeschotteten Vorschau angezeigt.</p><button onclick="document.querySelector('p').textContent='Dein JavaScript läuft im Vorschaufenster!'">Klick mich</button></body>\n</html>\n`,
  'demo.sql':`-- Echte SQLite-Datenbank: sqlite3 demo.db < demo.sql\nSELECT * FROM schueler;\nSELECT name, klasse FROM schueler WHERE klasse = '8a';\nSELECT s.name, p.titel FROM schueler s JOIN projekte p ON p.schueler_id = s.id;\n`,
  'skript.sh':`#!/bin/bash\n# Shell-Skript: chmod +x skript.sh && ./skript.sh\nNAME=$(whoami)\necho "Hallo $NAME, heute ist $(date +%A)."\nfor datei in *.py; do\n  echo "Python-Datei: $datei"\ndone\n`,
  'README.txt':`DesktopSim – Übungsdateien\n\nDiese Programme laufen ECHT im Browser (WebAssembly):\n- Python:      python hello.py          (CPython 3 / Pyodide)\n- JavaScript:  node hello.js            (Browser-JS-Engine)\n- C:           gcc hello.c -o hallo && ./hallo      (Clang/LLVM)\n- C++:         g++ main.cpp -o main && ./main       (Clang/LLVM)\n- Java:        javac Main.java && java Main          (OpenJDK javac + CheerpJ-JVM)\n- PHP:         php index.php            (PHP 8 / php-wasm)\n- SQL:         sqlite3 demo.db          (SQLite 3 / sql.js)\n- HTML:        Browser öffnen oder python -m http.server 8000\n\nBeim ersten Start einer Sprache wird die Laufzeit einmalig geladen und danach zwischengespeichert.\nC# ist eine Ausgabe-Demo (keine .NET-Laufzeit im Browser).\n`
};
const WIN_SYSTEM = ['cmd.exe','notepad.exe','calc.exe','explorer.exe','taskmgr.exe','mspaint.exe','regedit.exe','ipconfig.exe','ping.exe','tasklist.exe','where.exe','whoami.exe','hostname.exe','winver.exe','shutdown.exe'];
export function createSeed(id){
  const root=rootNode(),win=isWindows(id),mac=id==='macos';
  const users=folder(root,win||mac?'Users':'home');
  const person=folder(users,win?'Student':'student');
  for(const name of ['Desktop','Documents','Downloads','Pictures','Music','Videos'])folder(person,name);
  file(person.children.Desktop,'Willkommen.txt','Willkommen bei DesktopSim! Öffne Terminal, Editor oder Dateimanager.');
  file(person.children.Documents,'Notizen.txt','Befehle ausprobieren, Dateibaum erkunden und Programmiersprachen vergleichen.');
  const projects=folder(person,'Projects');
  for(const [name,content] of Object.entries(PROJECT_FILES)) file(projects,name,content,name.endsWith('.sh')?{mode:0o755}:{});
  if(win){
    const w=folder(root,'Windows'),sys=folder(w,'System32');
    for(const exe of WIN_SYSTEM)file(sys,exe,'MZ\u0090 [Windows-Programm · DesktopSim-Platzhalter]',{enc:'exe',size:180000+exe.length*4096});
    file(folder(folder(sys,'drivers'),'etc'),'hosts','127.0.0.1       localhost\n::1             localhost\n');
    folder(w,'Fonts');folder(w,'Temp');
    const pf=folder(root,'Program Files');folder(pf,'Common Files');folder(pf,'Internet Explorer');
    if(id!=='winxp'){folder(root,'ProgramData');folder(folder(person,'AppData'),'Local');}
    folder(root,'$Recycle.Bin');
  }else{
    const etc=folder(root,'etc');
    const pretty={debian:'Debian GNU/Linux 13 (trixie)',arch:'Arch Linux',macos:'macOS 26',unix:'Oracle Solaris 11.4'}[id];
    file(etc,'os-release',`PRETTY_NAME="${pretty}"\nNAME="${pretty.split(' ')[0]}${id==='debian'?' GNU/Linux':''}"\nID=${id}\n${id==='debian'?'VERSION_ID="13"\nVERSION_CODENAME=trixie\n':''}HOME_URL="https://desktopsim.local/"\n`);
    file(etc,'hostname',{debian:'debian-sim',arch:'arch-sim',macos:'Mac',unix:'workstation'}[id]+'\n');
    file(etc,'passwd','root:x:0:0:root:/root:/bin/bash\nstudent:x:1000:1000:Student:/home/student:/bin/bash\n');
    file(etc,'hosts','127.0.0.1\tlocalhost\n::1\tlocalhost\n');
    file(etc,'shells','/bin/sh\n/bin/bash\n/bin/zsh\n');
    const usr=folder(root,'usr');folder(usr,'bin');folder(usr,'lib');folder(usr,'share');folder(usr,'local');
    folder(root,'bin');folder(root,'tmp');const v=folder(root,'var');folder(v,'log');
    file(person,mac?'.zshrc':'.bashrc',mac?'# ~/.zshrc\nexport PATH="/opt/homebrew/bin:$PATH"\nalias ll="ls -la"\n':'# ~/.bashrc\nalias ll="ls -la"\nalias la="ls -A"\nexport EDITOR=nano\n');
    if(!mac)file(person,'.profile','# ~/.profile\n[ -f ~/.bashrc ] && . ~/.bashrc\n');
    if(mac){folder(root,'Applications');folder(root,'System');folder(root,'Volumes');folder(root,'Library');folder(person,'Library');folder(person,'.Trash');}
    else {folder(root,'opt');folder(root,'root');folder(root,'dev');folder(root,'proc');folder(folder(folder(person,'.local'),'share'),'Trash');folder(person.children['.local'].children.share.children.Trash,'files');}
  }
  return root;
}
export function pathDisplay(id,path){
  if(!isWindows(id)) return path;
  return 'C:'+path.replaceAll('/','\\');
}
const clone = v => JSON.parse(JSON.stringify(v));
function mergeSeed(target,seed){for(const [name,node] of Object.entries(seed.children)){const existing=target.children[name];if(!existing)target.children[name]=clone(node);else if(existing.type==='dir'&&node.type==='dir')mergeSeed(existing,node)}}
export class VFS {
  constructor(id){this.id=id;this.home=homePath(id);this.storageKey='desktopsim-v2-fs-'+id;this.root=this.restore();this.listeners=new Set();}
  restore(){try{const raw=localStorage.getItem(this.storageKey);const obj=JSON.parse(raw);if(obj?.type==='dir'&&obj.children){if(!obj.seedV3){mergeSeed(obj,createSeed(this.id));obj.seedV3=true}return obj}}catch{}const seed=createSeed(this.id);seed.seedV3=true;return seed}
  persist(){try{const json=JSON.stringify(this.root);if(json.length>4_000_000)throw Error('Speicherlimit von 4 MB erreicht');localStorage.setItem(this.storageKey,json)}catch(err){throw Error('Speichern nicht möglich: '+err.message)}for(const fn of this.listeners)try{fn()}catch{}}
  onChange(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  reset(){this.root=createSeed(this.id);this.root.seedV3=true;this.persist()}
  normalize(path,cwd=this.home){
    let p=String(path??'').trim().replaceAll('\\','/');
    if(!p||p==='.')return cwd;
    if(p==='~')return this.home;
    if(p.startsWith('~/'))p=this.home+p.slice(1);
    p=p.replace(/^([a-z]):/i,'');
    if(isWindows(this.id)&&/^%userprofile%/i.test(p))p=this.home+p.slice(13);
    const parts=(p.startsWith('/')?p:cwd+'/'+p).split('/');
    const stack=[];
    for(const s of parts){if(!s||s==='.')continue;if(s==='..'){stack.pop();continue;}stack.push(s)}
    return '/'+stack.join('/');
  }
  locate(path,cwd=this.home){
    const p=this.normalize(path,cwd);let node=this.root;
    for(const seg of p.split('/').filter(Boolean)){
      if(node.type!=='dir')return null;
      const key=isWindows(this.id)||this.id==='macos'?Object.keys(node.children).find(k=>k.toLowerCase()===seg.toLowerCase()):(Object.hasOwn(node.children,seg)?seg:undefined);
      node=key!==undefined?node.children[key]:null;
      if(!node)return null;
    }
    return node;
  }
  /** Tatsächliche Groß-/Kleinschreibung eines Pfads (wichtig für Windows/macOS). */
  realPath(path,cwd){const p=this.normalize(path,cwd);let node=this.root,out='';for(const seg of p.split('/').filter(Boolean)){if(node?.type!=='dir')return p;const key=Object.keys(node.children).find(k=>k===seg)??Object.keys(node.children).find(k=>k.toLowerCase()===seg.toLowerCase());if(key===undefined)return p;out+='/'+key;node=node.children[key]}return out||'/'}
  exists(path,cwd){return Boolean(this.locate(path,cwd))}
  isDir(path,cwd){return this.locate(path,cwd)?.type==='dir'}
  sizeOf(node){return node.type==='file'?(node.size??node.content.length):Object.keys(node.children).length}
  list(path,cwd){const node=this.locate(path,cwd);if(!node)throw Error('Datei oder Verzeichnis nicht gefunden');if(node.type!=='dir')throw Error('Kein Verzeichnis');return Object.entries(node.children).map(([name,obj])=>({name,type:obj.type,size:obj.type==='file'?this.sizeOf(obj):0,mtime:obj.mtime||SEED_TIME,mode:obj.mode??(obj.type==='dir'?0o755:0o644),enc:obj.enc||null})).sort((a,b)=>(a.type===b.type?a.name.localeCompare(b.name,'de',{sensitivity:'base'}):a.type==='dir'?-1:1));}
  read(path,cwd){const node=this.locate(path,cwd);if(!node)throw Error('Datei nicht gefunden: '+path);if(node.type!=='file')throw Error('Dies ist ein Verzeichnis');return node.content}
  stat(path,cwd){const node=this.locate(path,cwd);if(!node)throw Error('Nicht gefunden: '+path);return{type:node.type,size:this.sizeOf(node),mtime:node.mtime||SEED_TIME,mode:node.mode??(node.type==='dir'?0o755:0o644),enc:node.enc||null}}
  parentInfo(path,cwd){const p=this.normalize(path,cwd);if(p==='/')throw Error('Das Stammverzeichnis kann nicht geändert werden');const bits=p.split('/');const name=bits.pop();const parent=this.locate(bits.join('/')||'/');if(!parent||parent.type!=='dir')throw Error('Übergeordnetes Verzeichnis nicht gefunden');const insensitive=isWindows(this.id)||this.id==='macos';const oldKey=insensitive?Object.keys(parent.children).find(k=>k.toLowerCase()===name.toLowerCase()):Object.hasOwn(parent.children,name)?name:undefined;return{parent,name,oldKey,path:p}}
  touchDir(parent){parent.mtime=Date.now()}
  mkdir(path,cwd,parents=false){
    if(parents){const p=this.normalize(path,cwd);let cur='';for(const seg of p.split('/').filter(Boolean)){cur+='/'+seg;const n=this.locate(cur);if(n&&n.type!=='dir')throw Error('Kein Verzeichnis: '+cur);if(!n){const{parent,name}=this.parentInfo(cur);parent.children[name]=rootNode();this.touchDir(parent)}}this.persist();return}
    const{parent,name,oldKey}=this.parentInfo(path,cwd);if(oldKey)throw Error('Existiert bereits: '+name);parent.children[name]=rootNode();this.touchDir(parent);this.persist()}
  write(path,content,cwd,append=false,meta={}){const{parent,name,oldKey}=this.parentInfo(path,cwd);const old=oldKey?parent.children[oldKey]:null;if(old&&old.type!=='file')throw Error('Ist ein Verzeichnis');const node={type:'file',content:(append&&old?old.content:'')+String(content),mtime:Date.now()};if(old?.mode!==undefined)node.mode=old.mode;Object.assign(node,meta);if(!meta.enc)delete node.enc;parent.children[oldKey||name]=node;this.touchDir(parent);this.persist()}
  chmod(path,mode,cwd){const node=this.locate(path,cwd);if(!node)throw Error('Nicht gefunden: '+path);node.mode=mode;this.persist()}
  utime(path,cwd){const node=this.locate(path,cwd);if(node){node.mtime=Date.now();this.persist()}}
  remove(path,cwd,recursive=false){const{parent,oldKey}=this.parentInfo(path,cwd);if(!oldKey)throw Error('Nicht gefunden: '+path);const node=parent.children[oldKey];if(node.type==='dir'&&Object.keys(node.children).length&&!recursive)throw Error('Verzeichnis nicht leer');delete parent.children[oldKey];this.touchDir(parent);this.persist()}
  copy(from,to,cwd,recursive=false){const a=this.locate(from,cwd);if(!a)throw Error('Quelle nicht gefunden: '+from);let target=this.normalize(to,cwd);if(this.locate(target)?.type==='dir')target=joinPath(target,this.normalize(from,cwd).split('/').pop());if(a.type==='dir'){if(!recursive)throw Error('Verzeichnis ausgelassen (nutze -r): '+from);if(target.startsWith(this.normalize(from,cwd)+'/'))throw Error('Ordner kann nicht in sich selbst kopiert werden');const{parent,name}=this.parentInfo(target);parent.children[name]=clone(a);this.persist();return}const{parent,name,oldKey}=this.parentInfo(target);parent.children[oldKey||name]={...clone(a),mtime:Date.now()};this.touchDir(parent);this.persist()}
  move(from,to,cwd){const src=this.normalize(from,cwd);const node=this.locate(src);if(!node)throw Error('Quelle nicht gefunden: '+from);let target=this.normalize(to,cwd);if(this.locate(target)?.type==='dir'&&target.toLowerCase()!==src.toLowerCase())target=joinPath(target,src.split('/').pop());if(target.startsWith(src+'/'))throw Error('Ordner kann nicht in sich selbst verschoben werden');const a=this.parentInfo(src);const b=this.parentInfo(target);delete a.parent.children[a.oldKey];if(b.oldKey&&b.parent.children[b.oldKey]&&b.oldKey!==a.oldKey)delete b.parent.children[b.oldKey];b.parent.children[b.name]=node;this.touchDir(a.parent);this.touchDir(b.parent);this.persist()}
  /** In den Papierkorb verschieben. Gibt den Namen im Papierkorb zurück. */
  trash(path,cwd){const src=this.normalize(path,cwd);const bin=trashPath(this.id);if(src.startsWith(bin))return this.remove(src,null,true);this.mkdir(bin,null,true);const base=src.split('/').pop();let name=base,i=1;while(this.locate(joinPath(bin,name)))name=`${base} (${++i})`;this.move(src,joinPath(bin,name));const node=this.locate(joinPath(bin,name));node.origin=src;node.deleted=Date.now();this.persist();return name}
  restoreFromTrash(name){const bin=trashPath(this.id);const node=this.locate(joinPath(bin,name));if(!node)throw Error('Nicht im Papierkorb: '+name);const target=node.origin||joinPath(this.home,name);delete node.origin;delete node.deleted;this.mkdir(target.replace(/\/[^/]*$/,'')||'/',null,true);this.move(joinPath(bin,name),target);return target}
  emptyTrash(){const bin=trashPath(this.id);const node=this.locate(bin);if(node){node.children={};this.persist()}}
  /** Rekursive Momentaufnahme eines Ordners als {relPfad: inhalt} für Programmlaufzeiten. */
  snapshot(dir,{maxFiles=300,maxBytes=3_000_000}={}){const out={};let count=0,bytes=0;const walk=(path,prefix,depth)=>{if(depth>6)return;let entries;try{entries=this.list(path)}catch{return}for(const e of entries){if(count>=maxFiles||bytes>maxBytes)return;if(e.name.startsWith('.')&&e.type==='dir')continue;const full=joinPath(path,e.name);if(e.type==='dir')walk(full,prefix+e.name+'/',depth+1);else{const node=this.locate(full);if(node.enc&&node.enc!=='b64')continue;const content=node.enc==='b64'?{base64:node.content}:node.content;count++;bytes+=node.content.length;out[prefix+e.name]=content}}};walk(this.normalize(dir),'',0);return out}
  /** Von Programmen geänderte Dateien zurückschreiben. */
  applyChanges(dir,files){const written=[];for(const [rel,content] of Object.entries(files||{})){try{const target=this.normalize(rel,dir);this.mkdir(target.replace(/\/[^/]*$/,'')||'/',null,true);if(content&&typeof content==='object'&&'base64' in content)this.write(target,content.base64,null,false,{enc:'b64',size:Math.floor(content.base64.length*3/4)});else this.write(target,content);written.push(rel)}catch{}}return written}
  export(){return{format:'desktopsim-v2',os:this.id,exported:new Date().toISOString(),files:this.root}}
  import(snapshot){if(snapshot?.format!=='desktopsim-v2'||snapshot?.os!==this.id||snapshot?.files?.type!=='dir'||!snapshot?.files?.children)throw Error('Ungültiges Dateisystem oder falsches Betriebssystem');const val=JSON.stringify(snapshot.files);if(val.length>4_000_000)throw Error('Import zu groß');this.root=snapshot.files;this.persist()}
}
export function extName(path){const name=String(path).split('/').pop();return name.includes('.')?name.split('.').pop().toLowerCase():''}
export function joinPath(dir,name){return (dir==='/'?'':dir)+'/'+name}
export function formatSize(bytes,human=true){if(!human)return String(bytes);if(bytes<1024)return bytes+(bytes===1?' Byte':' Bytes');const u=['KB','MB','GB'];let v=bytes,i=-1;do{v/=1024;i++}while(v>=1024&&i<2);return v.toFixed(v<10?1:0).replace('.',',')+' '+u[i]}
