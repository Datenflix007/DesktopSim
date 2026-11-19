// Smoke-Test ohne NPM-Abhängigkeiten: node tests/smoke.mjs
// Prüft Shell-Engine (Bash/Zsh/sh/CMD/PowerShell), Dateisystem, SQL, Git, Skripte und App-Verdrahtung.
// Die echten WebAssembly-Laufzeiten (Python, Clang, Java, PHP, SQLite) laufen nur im Browser;
// in Node greift der Offline-Fallback.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OS_LIST,VFS,homePath,joinPath,trashPath} from '../assets/vfs.js';
import {GitLearningRepo} from '../assets/git.js';
import {MiniSQL,compileSource,simulateCompiled} from '../assets/runtimes.js';
import {TerminalEngine,promptFor} from '../assets/terminal.js';
import {parse,dialectFor} from '../assets/shell/parser.js';

const storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const app={fs:null,db:null,git:null,servers:new Map(),windows:new Map(),notifyFiles(){},toast(){},notify(){}};
const engine=new TerminalEngine(app);
const strip=s=>String(s).replace(/\x1b\[[0-9;]*m/g,'');
const run=async(t,cmd)=>strip(await engine.execute(cmd,t));
const shellFor=os=>({os,shell:OS_LIST.find(o=>o.id===os).shell,cwd:joinPath(homePath(os),'Projects'),history:[]});

// --- Alle Systeme: Grundbefehle, Umleitung, Pipes, SQL, localhost ---
for(const os of OS_LIST){
  app.fs=new VFS(os.id);app.db=new MiniSQL(os.id);app.git=new GitLearningRepo(os.id);app.servers.clear();
  const t=shellFor(os.id),win=os.id.startsWith('win');
  assert.ok(promptFor(t).length>3,os.id+' prompt');
  assert.match(await run(t,win?'dir':'ls'),/hello\.py/,os.id+' list');
  assert.match(await run(t,'whoami'),/student/i,os.id+' whoami');
  const md=await run(t,'mkdir versuch');assert.ok(t.shell==='powershell'?/versuch/.test(md):md==='',os.id+' mkdir');
  assert.equal(await run(t,'cd versuch'),'',os.id+' cd');
  assert.equal(await run(t,'echo test > test.txt'),'',os.id+' redirect');
  assert.equal(app.fs.read('test.txt',t.cwd).trim(),'test',os.id+' file written');
  await run(t,'cd ..');assert.ok(app.fs.exists('versuch/test.txt',t.cwd),os.id+' persisted');
  assert.match(await run(t,win?'type README.txt | findstr Python':'cat README.txt | grep Python'),/Python/,os.id+' pipe');
  assert.match(await run(t,(win?'python':'python3')+' -m http.server 8000'),/8000/,os.id+' server');
  assert.match(await run(t,'curl http://localhost:8000/README.txt'),/Übungsdateien/,os.id+' curl localhost');
  assert.match(await run(t,'sqlite3 demo.db'),/SQLite version/,os.id+' sqlite start');
  assert.match(await run(t,'SELECT * FROM schueler;'),/Alex/,os.id+' sql');
  assert.equal(await run(t,'.exit'),'SQL-Konsole verlassen.');
  if(win)assert.match(await run({...t,shell:'cmd'},'uname -a'),/nicht gefunden|falsch geschrieben/,os.id+' cmd semantics');
  else assert.match(await run(t,'ipconfig'),/not found|nicht gefunden/,os.id+' unix semantics');
}

// --- Bash: Variablen, Kontrollstrukturen, Skripte, Rechte, Exitcodes ---
app.fs=new VFS('debian');app.git=new GitLearningRepo('debian');
const b=shellFor('debian');
assert.equal(await run(b,'X=5; echo $((X*2))'),'10','arithmetic');
assert.equal(await run(b,'for f in *.py; do echo $f; done'),'fenster.py\nhello.py\nrechner.py','for + glob');
assert.equal(await run(b,'if [ -f hello.py ]; then echo ja; else echo nein; fi'),'ja','if test');
assert.equal(await run(b,'ls nichtda 2>/dev/null; echo $?'),'2','exit code');
assert.equal(await run(b,'false || echo fallback'),'fallback','or-list');
assert.equal(await run(b,'echo "Ich bin $(whoami)"'),'Ich bin student','command substitution in quotes');
assert.equal(await run(b,'seq 1 5 | sort -rn | head -n 2'),'5\n4','multi pipe');
assert.match(await run(b,'./skript.sh'),/Python-Datei: hello\.py/,'executable script');
await run(b,'chmod -x skript.sh');assert.match(await run(b,'./skript.sh'),/Keine Berechtigung/,'permission denied');
assert.match(await run(b,'sl'),/sudo apt install sl/,'missing package hint');
assert.match(await run(b,'apt install cowsay'),/Sind Sie Root/,'apt needs root');
assert.match(await run(b,'nichtvorhanden'),/bash: nichtvorhanden: Befehl nicht gefunden/,'not found');
assert.match(await run(b,'git status'),/Auf Branch main/,'git status');
assert.equal(await run(b,'git add hello.py'),'','git add');
assert.match(await run(b,'git commit -m "Python verbessert"'),/Python verbessert/,'git commit');
assert.match(await run(b,'man ls'),/Verzeichnisinhalte auflisten/,'man page');
const moved=app.fs.trash(joinPath(b.cwd,'demo.sql'));assert.ok(app.fs.exists(joinPath(trashPath('debian'),moved)),'trash');app.fs.restoreFromTrash(moved);assert.ok(app.fs.exists('demo.sql',b.cwd),'restore');

// --- zsh-Eigenheiten ---
app.fs=new VFS('macos');const z=shellFor('macos');
assert.match(await run(z,'echo *.xyz'),/no matches found/,'zsh nomatch');
assert.match(await run(z,'sw_vers'),/macOS/,'sw_vers');

// --- CMD & PowerShell ---
app.fs=new VFS('win11');app.git=new GitLearningRepo('win11');
const c={...shellFor('win11'),shell:'cmd'};
assert.equal(await run(c,'set NAME=Max & echo Hallo %NAME%'),'Hallo Max','cmd variables');
assert.match(await run(c,'dir *.py'),/hello\.py[\s\S]*Datei\(en\)/,'cmd dir wildcard');
assert.match(await run(c,'foo'),/ist entweder falsch geschrieben/,'cmd not found');
app.fs.write('start.bat','@echo off\nset /a X=6*7\necho Ergebnis %X%\nif exist hello.py echo gefunden\n',c.cwd);
assert.match(await run(c,'start.bat'),/Ergebnis 42\s+gefunden/,'batch file');
const p=shellFor('win11');
await run(p,'$x = 21');assert.equal(await run(p,'Write-Output "Wert $x"'),'Wert 21','ps variables');
assert.match(await run(p,'Get-ChildItem *.py'),/Mode\s+LastWriteTime[\s\S]*hello\.py/,'ps gci');
assert.match(await run(p,'foo'),/wurde nicht als Name eines Cmdlet/,'ps not found');
app.fs.write('test.ps1','Write-Output "skript"\n',p.cwd);assert.match(await run(p,'.\\test.ps1'),/deaktiviert/,'ps execution policy');

// --- Parser ---
assert.equal(parse('a | b && c; d',dialectFor('bash')).items.length,2,'parser lists');
assert.throws(()=>parse('if true; then echo',dialectFor('bash')),/fi/,'parser errors');

// --- Offline-Fallbacks der Sprachen ---
assert.equal(simulateCompiled('js','console.log("JS", 2 + 3);').output,'JS 5');
assert.equal(compileSource('cpp','int main() { return 0; }').ok,true);

// --- App-Verdrahtung (Quelltextprüfung) ---
const src=async f=>readFile(new URL('../assets/'+f,import.meta.url),'utf8');
const all=(await Promise.all(['app.js','ui/chrome.js','apps/terminal-app.js','apps/files-app.js','apps/editor-app.js','apps/browser-app.js','apps/system-apps.js','apps/classic.js','apps/ide-app.js','apps/tk-app.js','runtime/index.js'].map(src))).join('\n');
for(const needle of ['openTerminal(','openFiles(','openEditor(','openIDE(','openBrowser(','openSettings(','openTaskManager(','openCalculator(','openSQL(','openGitGraph()','openStructogram()','openGame()','openFunLab()','menuXP()','menu7()','menu8()','menu10()','menu11()','menuKDE()','spotlight()','enterOverview()','snapWindow(','compileJava(','compileC(','runPython(','runPHP(','runWasm('])
  assert.ok(all.includes(needle),'wired: '+needle);
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
assert.match(index,/id="landing"/,'landing page');
const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
assert.match(sw,/__ds_io__\/read/,'stdin bridge in service worker');
// --- Virtuelle Umgebungen (venv) auf allen Systemen ---
for(const os of ['debian','macos','win11','win10','arch','unix']){
  app.fs=new VFS(os);const t=shellFor(os);const win=os.startsWith('win');
  assert.equal(await run(t,`${win?'python':'python3'} -m venv .venv`),'',os+' venv created');
  assert.ok(app.fs.exists(joinPath(t.cwd,'.venv/pyvenv.cfg')),os+' pyvenv.cfg');
  assert.ok(app.fs.exists(joinPath(t.cwd,win?'.venv/Scripts/activate.bat':'.venv/bin/activate')),os+' activate script');
  if(t.shell==='powershell'){assert.match(await run(t,'.venv\\Scripts\\Activate.ps1'),/deaktiviert/,os+' venv needs execution policy');t.psBypass=true}
  await run(t,win?(t.shell==='powershell'?'.venv\\Scripts\\Activate.ps1':'.venv\\Scripts\\activate'):'source .venv/bin/activate');
  assert.ok(t.venv,os+' venv active');assert.match(promptFor(t),/^\(\.venv\) /,os+' venv prompt');
  assert.match(await run(t,'pip list'),/pip\s+25\.2/,os+' pip list in venv');
  await run(t,'deactivate');assert.ok(!t.venv,os+' deactivated');assert.doesNotMatch(promptFor(t),/\.venv/,os+' prompt reset');
}
{app.fs=new VFS('debian');const t=shellFor('debian');assert.match(await run(t,'pip install numpy'),/externally-managed-environment/,'PEP 668 on debian');
 await run(t,'python3 -m venv env && . env/bin/activate');assert.match(await run(t,'which python'),/env\/bin\/python/,'which python in venv');
 const g=shellFor('debian');assert.match(await run(g,'./env/bin/activate'),/Keine Berechtigung/,'activate must be sourced');}

// --- Skripte über Systemgrenzen: bash unter Windows, pwsh & wine unter Linux/macOS ---
{app.fs=new VFS('win11');const c={...shellFor('win11'),shell:'cmd'};
 app.fs.write('t.sh','#!/bin/bash\nX=5\necho "bash $((X*2))"\n',c.cwd);
 assert.equal(await run(c,'bash t.sh'),'bash 10','git bash on windows');
 assert.equal(await run(c,'bash -c "echo hi | tr a-z A-Z"'),'HI','bash -c on windows');
 app.fs.write('s.ps1','$n = "Welt"\nWrite-Output "Hallo $n"\n',c.cwd);
 assert.equal(await run(c,'powershell -ExecutionPolicy Bypass -File s.ps1'),'Hallo Welt','powershell -File with bypass');}
for(const os of ['debian','macos','arch']){app.fs=new VFS(os);const t=shellFor(os);
 app.fs.write('s.ps1','$n = "Welt"\nWrite-Output "Hallo $n"\n',t.cwd);assert.equal(await run(t,'pwsh -File s.ps1'),'Hallo Welt',os+' pwsh');
 app.fs.write('s.bat','@echo off\nset X=7\necho Batch %X%\n',t.cwd);assert.match(await run(t,'wine cmd /c s.bat'),/Batch 7/,os+' wine batch');}

// --- Virtuelles Netzwerk und Java-Umleitung ---
{const {VirtualNet}=await import('../assets/runtime/net.js');const net=new VirtualNet();const a={objects:new Set()},b={objects:new Set()};
 assert.ok(net.bind({port:7000},a).ok);const l=net.listen({port:7000},a);assert.ok(l.id,'listen');assert.equal(net.listen({port:7000},a).error,'EADDRINUSE','port in use');
 const acc=net.accept({id:l.id},a);const c=await net.connect({host:'localhost',port:7000},b);const s=await acc;
 net.send({conn:c.conn,data:'ping'});assert.equal((await net.recv({conn:s.conn})).data,'ping','tcp data');
 assert.equal((await net.connect({port:7001},b)).error,'ECONNREFUSED','refused');assert.equal((await net.connect({host:'nirgendwo.invalid',port:1},b)).error,'EGAI','unknown host');
 net.release(b);assert.equal((await net.recv({conn:s.conn})).data,'','eof after close');}
{const {rewriteNet,usesGui}=await import('../assets/runtime/java.js');
 assert.match(rewriteNet('import java.net.ServerSocket;\nimport java.net.Socket;'),/import dsnet\.ServerSocket;\nimport dsnet\.Socket;/,'java socket rewrite');
 assert.match(rewriteNet('import java.net.*;'),/import dsnet\.Socket;/,'java wildcard rewrite');
 assert.doesNotMatch(rewriteNet('catch (java.net.SocketException e)'),/dsnet/,'keep SocketException');
 assert.ok(usesGui('import javax.swing.*;')&&!usesGui('class A{}'),'gui detection');}

// --- Python-Module für tkinter/turtle/socket liegen bei ---
for(const f of ['tkinter/__init__.py','tkinter/ttk.py','tkinter/messagebox.py','turtle.py','_dsnet.py','_dsenv.py','_ds_mpl.py'])
  assert.ok((await readFile(new URL('../assets/runtime/pylib/'+f,import.meta.url),'utf8')).length>200,'pylib '+f);
assert.match(await readFile(new URL('../assets/runtime/prolog/ds_toplevel.pl',import.meta.url),'utf8'),/ds_query/,'prolog toplevel helper');

console.log('PASS: 9 Systeme · venv/pip · bash/pwsh/wine · virtuelles Netz · Bash/Zsh/CMD/PowerShell · Pipes, Skripte, Rechte, Exitcodes · Dateisystem & Papierkorb · SQL · Git · App-Verdrahtung');
