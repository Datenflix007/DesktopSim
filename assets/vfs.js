// Persistentes, vollständig virtuelles Dateisystem. Nie Zugriff auf reale Dateien.
export const OS_LIST = [
  {id:'winxp',label:'Windows XP',group:'Windows',subtitle:'Luna · Eingabeaufforderung',year:'2001',shell:'cmd',symbol:'⊞'},
  {id:'win7',label:'Windows 7',group:'Windows',subtitle:'Aero · Eingabeaufforderung',year:'2009',shell:'cmd',symbol:'⊞'},
  {id:'win8',label:'Windows 8',group:'Windows',subtitle:'Metro · Eingabeaufforderung',year:'2012',shell:'cmd',symbol:'⊞'},
  {id:'win10',label:'Windows 10',group:'Windows',subtitle:'Fluent · CMD + PowerShell',year:'2015',shell:'cmd',symbol:'⊞'},
  {id:'win11',label:'Windows 11',group:'Windows',subtitle:'Fluent · PowerShell + CMD',year:'2021',shell:'powershell',symbol:'⊞'},
  {id:'debian',label:'Debian Linux',group:'Linux',subtitle:'GNOME · Bash · apt',year:'2026',shell:'bash',symbol:'◈'},
  {id:'arch',label:'Arch Linux',group:'Linux',subtitle:'KDE Plasma · Bash · pacman',year:'2026',shell:'bash',symbol:'▲'},
  {id:'macos',label:'macOS',group:'Apple',subtitle:'Finder · Zsh · brew',year:'2026',shell:'zsh',symbol:'●'},
  {id:'unix',label:'Unix / CDE',group:'Unix',subtitle:'Common Desktop · sh',year:'1995',shell:'sh',symbol:'◆'}
];
export function getOS(id){return OS_LIST.find(o=>o.id===id)||OS_LIST[4]}
export const isWindows = id => id.startsWith('win');
export const homePath = id => isWindows(id)?'/Users/Student':id==='macos'?'/Users/student':'/home/student';
export const rootNode = () => ({type:'dir',children:{}});
const folder = (parent,name) => parent.children[name]={type:'dir',children:{}};
const file = (parent,name,content) => parent.children[name]={type:'file',content};
const PROJECT_FILES = {
  'hello.py':`# Python-Beispiel · starte mit: python hello.py\nname = "DesktopSim"\nfor i in range(3):\n    print(f"Hallo aus {name}! Runde {i + 1}")\n`,
  'Main.java':`public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hallo aus Java!");\n        System.out.println(2 + 3);\n    }\n}\n`,
  'main.cpp':`#include <iostream>\n\nint main() {\n    int zahl = 2 + 3;\n    std::cout << "Hallo aus C++: " << zahl << std::endl;\n    return 0;\n}\n`,
  'hello.c':`#include <stdio.h>\n\nint main(void) {\n    printf("Hallo aus C: %d\\n", 2 + 3);\n    return 0;\n}\n`,
  'hello.js':`const name = "DesktopSim";\nconsole.log("Hallo aus JavaScript", name);\nconsole.log(2 + 3);\n`,
  'Program.cs':`using System;\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hallo aus C#!");\n        Console.WriteLine(2 + 3);\n    }\n}\n`,
  'index.php':`<?php\n$name = "DesktopSim";\necho "Hallo aus PHP!";\necho $name;\n?>\n`,
  'index.html':`<!doctype html>\n<html lang="de">\n<head><meta charset="UTF-8"><title>Meine erste Webseite</title>\n<style>body{font-family:system-ui;background:#e8f3ff;padding:48px;color:#102743}h1{color:#1264ae}button{padding:10px 15px;border:0;border-radius:8px;background:#1264ae;color:white;cursor:pointer}</style></head>\n<body><h1>Hallo aus DesktopSim!</h1><p>Diese HTML-Datei wird in einer abgeschotteten Vorschau angezeigt.</p><button onclick="document.querySelector('p').textContent='Dein JavaScript läuft im Vorschaufenster!'">Klick mich</button></body>\n</html>\n`,
  'demo.sql':`-- In der Datenbank-Konsole ausführen:\nSELECT * FROM schueler;\nSELECT name, klasse FROM schueler WHERE klasse = '8a';\nINSERT INTO schueler (name, klasse, punkte) VALUES ('Mira', '9b', 92);\n`,
  'README.txt':`DesktopSim – Übungsdateien\n\nStarte ein Terminal und probiere:\n- Windows: dir, cd Projects, type README.txt, ipconfig\n- Linux/macOS: ls -la, cd Projects, cat README.txt, uname -a\n- Python: python hello.py (echtes Pyodide/WebAssembly bei Internet)\n- Java: javac Main.java && java Main [Quelltextprüfung + Ausgaben-Demo]\n- C++: g++ main.cpp -o hallo && ./hallo [Quelltextprüfung + Ausgaben-Demo]\n- C: gcc hello.c -o hallo && ./hallo [Quelltextprüfung + Ausgaben-Demo]\n- JavaScript: node hello.js [Ausgaben-Demo]\n- C#: dotnet run Program.cs [Ausgaben-Demo]\n- PHP: php index.php [Ausgaben-Demo]\n- HTML: Browser öffnen; Server: python -m http.server 8000\n- SQL: sqlite3 demo.db; SELECT * FROM schueler;\n\nWichtig: Alle Dateien, Ports und Programme sind virtuell. GitHub Pages kann keinen nativen javac/g++ starten.\n`
};
export function createSeed(id){
  const root=rootNode();
  const users=folder(root,isWindows(id)?'Users':id==='macos'?'Users':'home');
  const person=folder(users,isWindows(id)?'Student':'student');
  const desktop=folder(person,isWindows(id)?'Desktop':'Desktop');
  file(desktop,'Willkommen.txt','Willkommen bei DesktopSim! Öffne Terminal, Editor oder Dateimanager.');
  const docs=folder(person,isWindows(id)?'Documents':'Documents');
  file(docs,'Notizen.txt','Befehle ausprobieren, Dateibaum erkunden und Programmiersprachen vergleichen.');
  const projects=folder(person,'Projects');
  for(const [name,content] of Object.entries(PROJECT_FILES)) file(projects,name,content);
  if(isWindows(id)){
    const w=folder(root,'Windows');folder(w,'System32');
    folder(root,'Program Files');
  }else{
    const etc=folder(root,'etc');file(etc,'os-release',`NAME="${getOS(id).label}"\nID=${id}\n`);
    const usr=folder(root,'usr');folder(usr,'bin');folder(root,'tmp');folder(root,'var');
    if(id==='macos'){folder(root,'Applications');folder(root,'System');folder(root,'Volumes')}
    else {folder(root,'opt');}
  }
  return root;
}
export function pathDisplay(id,path){
  if(!isWindows(id)) return path;
  return 'C:'+path.replaceAll('/','\\');
}
export class VFS {
  constructor(id){this.id=id;this.home=homePath(id);this.storageKey='desktopsim-v2-fs-'+id;this.root=this.restore();}
  restore(){try{const raw=localStorage.getItem(this.storageKey);const obj=JSON.parse(raw);if(obj?.type==='dir'&&obj.children)return obj;}catch{}return createSeed(this.id)}
  persist(){try{const json=JSON.stringify(this.root);if(json.length>2_000_000)throw Error('Speicherlimit von 2 MB erreicht');localStorage.setItem(this.storageKey,json)}catch(err){throw Error('Speichern nicht möglich: '+err.message)}}
  reset(){this.root=createSeed(this.id);this.persist()}
  normalize(path,cwd=this.home){
    let p=String(path??'').trim().replaceAll('\\','/');
    if(!p||p==='.')return cwd;
    if(p==='~')return this.home;
    if(p.startsWith('~/'))p=this.home+p.slice(1);
    p=p.replace(/^([a-z]):/i,'');
    const parts=(p.startsWith('/')?p:cwd+'/'+p).split('/');
    const stack=[];
    for(const s of parts){if(!s||s==='.')continue;if(s==='..'){stack.pop();continue;}stack.push(s)}
    return '/'+stack.join('/');
  }
  locate(path,cwd=this.home){
    const p=this.normalize(path,cwd);let node=this.root;
    for(const seg of p.split('/').filter(Boolean)){
      if(node.type!=='dir')return null;
      const key=isWindows(this.id)?Object.keys(node.children).find(k=>k.toLowerCase()===seg.toLowerCase()):seg;
      node=key?node.children[key]:null;
      if(!node)return null;
    }
    return node;
  }
  exists(path,cwd){return Boolean(this.locate(path,cwd))}
  list(path,cwd){const node=this.locate(path,cwd);if(!node)throw Error('Datei oder Verzeichnis nicht gefunden');if(node.type!=='dir')throw Error('Kein Verzeichnis');return Object.entries(node.children).map(([name,obj])=>({name,type:obj.type,size:obj.type==='file'?obj.content.length:0})).sort((a,b)=>(a.type===b.type?a.name.localeCompare(b.name):a.type==='dir'?-1:1));}
  read(path,cwd){const node=this.locate(path,cwd);if(!node)throw Error('Datei nicht gefunden: '+path);if(node.type!=='file')throw Error('Dies ist ein Verzeichnis');return node.content}
  parentInfo(path,cwd){const p=this.normalize(path,cwd);if(p==='/')throw Error('Das Stammverzeichnis kann nicht geändert werden');const bits=p.split('/');const name=bits.pop();const parent=this.locate(bits.join('/')||'/');if(!parent||parent.type!=='dir')throw Error('Übergeordnetes Verzeichnis nicht gefunden');const oldKey=isWindows(this.id)?Object.keys(parent.children).find(k=>k.toLowerCase()===name.toLowerCase()):Object.hasOwn(parent.children,name)?name:undefined;return{parent,name,oldKey,path:p}}
  mkdir(path,cwd){const{parent,name,oldKey}=this.parentInfo(path,cwd);if(oldKey)throw Error('Existiert bereits: '+name);parent.children[name]=rootNode();this.persist()}
  write(path,content,cwd,append=false){const{parent,name,oldKey}=this.parentInfo(path,cwd);if(oldKey&&parent.children[oldKey].type!=='file')throw Error('Ist ein Verzeichnis');const old=oldKey?parent.children[oldKey].content:'';parent.children[oldKey||name]={type:'file',content:(append?old:'')+String(content)};this.persist()}
  remove(path,cwd,recursive=false){const{parent,oldKey}=this.parentInfo(path,cwd);if(!oldKey)throw Error('Nicht gefunden: '+path);const node=parent.children[oldKey];if(node.type==='dir'&&Object.keys(node.children).length&&!recursive)throw Error('Verzeichnis nicht leer');delete parent.children[oldKey];this.persist()}
  copy(from,to,cwd){const a=this.locate(from,cwd);if(!a)throw Error('Quelle nicht gefunden');if(a.type==='dir')throw Error('Kopieren von Ordnern ist hier nicht implementiert');this.write(to,a.content,cwd)}
  move(from,to,cwd){const contents=this.read(from,cwd);this.write(to,contents,cwd);this.remove(from,cwd)}
  export(){return{format:'desktopsim-v2',os:this.id,exported:new Date().toISOString(),files:this.root}}
  import(snapshot){if(snapshot?.format!=='desktopsim-v2'||snapshot?.os!==this.id||snapshot?.files?.type!=='dir'||!snapshot?.files?.children)throw Error('Ungültiges Dateisystem oder falsches Betriebssystem');const val=JSON.stringify(snapshot.files);if(val.length>2_000_000)throw Error('Import zu groß');this.root=snapshot.files;this.persist()}
}
export function extName(path){return path.split('.').pop()?.toLowerCase()||''}
export function joinPath(dir,name){return (dir==='/'?'':dir)+'/'+name}
