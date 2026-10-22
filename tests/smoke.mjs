// Keine zusätzlichen NPM-Abhängigkeiten. Start: node tests/smoke.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OS_LIST,VFS,homePath,pathDisplay,joinPath} from '../assets/vfs.js';
import {GitLearningRepo} from '../assets/git.js';
import {MiniSQL,compileSource,simulateCompiled,simulatePython} from '../assets/runtimes.js';
import {TerminalEngine,promptFor} from '../assets/terminal.js';
const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,val)=>storage.set(key,String(val)),removeItem:key=>storage.delete(key)};
const state={fs:null,db:null,git:null,servers:new Map(),python:{run:async()=>''},toast:()=>{},notifyFiles:()=>{},updateTerminalTitle:()=>{},openEditor:()=>{},openIDE:()=>{},openGitGraph:()=>{},openFunLab:()=>{},startMatrix:()=>{},launchConfetti:()=>{},toggleByte:()=>true,openBrowser:()=>{},openFiles:()=>{},openSQL:()=>{}};
const engine=new TerminalEngine(state);state.termEngine=engine;
for(const os of OS_LIST){
  state.fs=new VFS(os.id);state.db=new MiniSQL(os.id);state.servers.clear();
  const cwd=joinPath(homePath(os.id),'Projects');
  const shell={os:os.id,shell:os.shell,cwd,sqlMode:false,history:[],admin:false};
  assert.ok(state.fs.read('hello.py',cwd).includes('print'),os.id+' demo file');
  assert.ok(promptFor(shell).length>5,os.id+' prompt');
  assert.ok((await engine.execute(os.id.startsWith('win')?'dir':'ls -la',shell)).includes('hello.py'),os.id+' list');
  assert.ok((await engine.execute('whoami',shell)).toLowerCase().includes('student'),os.id+' whoami');
  assert.equal(await engine.execute('mkdir versuch',shell),'',os.id+' mkdir');
  assert.equal(await engine.execute('cd versuch',shell),'',os.id+' cd');
  assert.equal(await engine.execute('echo test > test.txt',shell),'',os.id+' redirect');
  assert.equal(state.fs.read('test.txt',shell.cwd),'test\n',os.id+' file write');
  assert.equal(await engine.execute('cd ..',shell),'',os.id+' cd parent');
  assert.ok(state.fs.exists('versuch/test.txt',shell.cwd),os.id+' file persists');
  assert.ok((await engine.execute('python -m http.server 8000',shell)).includes('virtuell'),os.id+' server');
  assert.ok((await engine.execute('curl http://localhost:8000',shell)).includes('404')===false,os.id+' simulated curl');
  assert.ok((await engine.execute('sqlite3 demo.db',shell)).includes('SQL-Lernkonsole'),os.id+' SQL start');
  assert.ok((await engine.execute('SELECT * FROM schueler;',shell)).includes('Alex'),os.id+' SQL terminal');
  assert.equal(await engine.execute('.exit',shell),'SQL-Konsole verlassen.');
  if(os.id.startsWith('win'))assert.ok((await engine.execute('uname -a',shell)).includes('nicht als Befehl'),os.id+' CMD semantics');
  else assert.ok((await engine.execute('ipconfig',shell)).includes('command not found'),os.id+' Unix semantics');
}
let db=new MiniSQL('debian');
let res=db.run("SELECT name, punkte FROM schueler WHERE punkte >= 90 ORDER BY punkte DESC;");
assert.deepEqual(res.rows.map(r=>r.name),['Sam','Robin'],'comparison and sorting');
res=db.run("INSERT INTO schueler (name, klasse, punkte) VALUES ('Mira', '9b', 92);");assert.ok(res.message.includes('eingefügt'));
res=db.run("UPDATE schueler SET punkte = 98 WHERE name = 'Mira';");assert.equal(res.message,'1 Zeile(n) aktualisiert');
res=db.run("SELECT COUNT(*) AS n FROM schueler WHERE punkte >= 90;");assert.equal(res.rows[0].n,3);
res=db.run("DELETE FROM schueler WHERE name = 'Mira';");assert.equal(res.message,'1 Zeile(n) gelöscht');
res=db.run('CREATE TABLE haustiere (id INTEGER, name TEXT);');assert.ok(res.message.includes('erstellt'));
assert.equal(db.run('SHOW TABLES').rows.length,3);
assert.equal(simulateCompiled('php','<?php $name = "Ada"; echo $name; ?>').output,'Ada');
assert.equal(simulateCompiled('java','class Main { void run() { System.out.println(2 + 3); } }').output,'5');
assert.equal(simulateCompiled('cs','class Program { static void Main() { Console.WriteLine("Hallo"); } }').output,'Hallo');
assert.equal(simulateCompiled('cpp','int main() { std::cout << "C++ " << 2 + 3 << std::endl; }').output,'C++ 5');
assert.equal(simulateCompiled('c','int main(void) { printf("C %d\\n", 2 + 3); }').output,'C 5\n');
assert.equal(simulateCompiled('js','console.log("JS", 2 + 3);').output,'JS 5');
assert.equal(compileSource('cpp','int main() { return 0; }').ok,true);
assert.equal(compileSource('cpp','std::cout << "kein Einstieg";').ok,false);
assert.ok(simulatePython('for i in range(3):\n    print("Hi")').output.split('\n').length===3);
state.fs=new VFS('debian');state.fs.write('persist.txt','ok',homePath('debian'));
assert.equal(new VFS('debian').read('persist.txt',homePath('debian')),'ok');
state.fs=new VFS('debian');state.db=new MiniSQL('debian');state.servers.clear();
state.git=new GitLearningRepo('debian');
const compilerShell={os:'debian',shell:'bash',cwd:joinPath(homePath('debian'),'Projects'),sqlMode:false,history:[],admin:false};
assert.match(await engine.execute('git status',compilerShell),/On branch main/,'git status');
assert.match(await engine.execute('git add hello.py',compilerShell),/Staging-Area/,'git add');
assert.match(await engine.execute('git commit -m "Python Hallo verbessern"',compilerShell),/Python Hallo verbessern/,'git commit');
assert.match(await engine.execute('git log --oneline',compilerShell),/Python Hallo verbessern/,'git log');
assert.match(await engine.execute('git branch feature/test',compilerShell),/erstellt/,'git branch');
assert.match(await engine.execute('git switch feature/test',compilerShell),/gewechselt/,'git switch');
assert.equal(state.git.status().branch,'feature/test','git branch state');
assert.ok(state.git.graph().some(commit=>commit.refs.includes('feature/test')),'git graph branch reference');
let funEffect=null;state.startMatrix=()=>funEffect='matrix';state.launchConfetti=()=>funEffect='party';state.toggleByte=()=>{funEffect='byte';return true};
assert.equal(await engine.execute('matrix',compilerShell),'Matrix-Modus aktiv. Mit Esc beenden.','matrix terminal command');
assert.equal(funEffect,'matrix','matrix effect started');
assert.equal(await engine.execute('party',compilerShell),'Party-Modus gestartet ✨','party terminal command');
assert.equal(funEffect,'party','confetti effect started');
assert.equal(await engine.execute('byte',compilerShell),'Byte ist auf dem Desktop. Klicke ihn an!','byte terminal command');
assert.equal(funEffect,'byte','desktop companion toggled');
let openedIDE=null;state.openIDE=(file,cwd)=>openedIDE={file,cwd};
assert.equal(await engine.execute('ide main.cpp',compilerShell),'IDE geöffnet: main.cpp','IDE terminal command');
assert.deepEqual(openedIDE,{file:'main.cpp',cwd:compilerShell.cwd},'IDE receives terminal file and path');
assert.equal(await engine.execute('code hello.py',compilerShell),'IDE geöffnet: hello.py','code alias opens IDE');
assert.match(await engine.execute('g++ main.cpp -o hallo',compilerShell),/Build-Artefakt/,'g++ build');
assert.match(await engine.execute('./hallo',compilerShell),/Hallo aus C\+\+: 5/,'g++ run');
assert.match(await engine.execute('clang++ main.cpp -o clang-hallo',compilerShell),/Build-Artefakt/,'clang++ build');
assert.match(await engine.execute('./clang-hallo',compilerShell),/Hallo aus C\+\+: 5/,'clang++ run');
assert.match(await engine.execute('gcc hello.c -o c-hallo',compilerShell),/Build-Artefakt/,'gcc build');
assert.match(await engine.execute('./c-hallo',compilerShell),/Hallo aus C: 5/,'gcc run');
assert.match(await engine.execute('javac Main.java',compilerShell),/Klassendatei/,'javac build');
assert.match(await engine.execute('java Main',compilerShell),/Hallo aus Java/,'java run');
assert.match(await engine.execute('node hello.js',compilerShell),/Hallo aus JavaScript DesktopSim/,'node run');
state.fs=new VFS('win11');state.db=new MiniSQL('win11');state.servers.clear();
const compilerWindowsShell={os:'win11',shell:'cmd',cwd:joinPath(homePath('win11'),'Projects'),sqlMode:false,history:[],admin:false};
assert.match(await engine.execute('g++ main.cpp -o hallo',compilerWindowsShell),/hallo\.exe/,'Windows g++ build');
assert.match(await engine.execute('hallo.exe',compilerWindowsShell),/Hallo aus C\+\+: 5/,'Windows executable run');
state.fs.write('broken.cpp','std::cout << "kein Einstieg";',compilerWindowsShell.cwd);
assert.match(await engine.execute('g++ broken.cpp -o kaputt',compilerWindowsShell),/Einstiegspunkt/,'compiler error feedback');
const appSource=await readFile(new URL('../assets/app.js',import.meta.url),'utf8');
const ideHelperSource=appSource.slice(appSource.indexOf('const escapeHTML'),appSource.indexOf('\n\nclass DesktopSim'));
const highlightIDE=Function(`${ideHelperSource};return ideSyntaxHTML;`)();
const highlightedPython=highlightIDE('def hallo():\n  # Kommentar\n  print("Hallo")','py');
assert.match(highlightedPython,/token-keyword[^>]*>def/,'IDE highlights Python keywords');
assert.match(highlightedPython,/token-comment[^>]*># Kommentar/,'IDE highlights comments');
assert.match(highlightedPython,/token-string[^>]*>&quot;Hallo&quot;/,'IDE highlights strings safely');
const structHelperSource=appSource.slice(appSource.indexOf('const STRUCT_LANGUAGES'),appSource.indexOf('\n\nclass DesktopSim'));
const {parseStructuredCode,structClasses,structCodeFromNodes,structCountNodes}=Function(`${structHelperSource};return {parseStructuredCode,structClasses,structCodeFromNodes,structCountNodes};`)();
const nestedPython=parseStructuredCode(`class Rechnung:
    def summe(self, werte):
        for wert in werte:
            if wert > 0:
                print(wert)
            elif wert == 0:
                print("neutral")
            else:
                print("ignoriert")

class PremiumRechnung(Rechnung):
    def anzeigen(self):
        return Rechnung()`, 'python');
assert.equal(structClasses(nestedPython).length,2,'Python classes are retained for UML');
const pythonLoop=nestedPython[0].children[0].children[0];
assert.equal(pythonLoop.type,'loop','nested Python loop is retained');
assert.equal(pythonLoop.children[0].type,'if','nested Python decision is retained');
assert.equal(pythonLoop.children[0].branches.length,3,'Python elif and else branches are retained');
assert.match(structCodeFromNodes(nestedPython,'python'),/elif wert == 0:/,'nested Python tree can be generated again');
const nestedJavaScript=parseStructuredCode(`class Rechnung {
  summe(werte) {
    for (const wert of werte) {
      if (wert > 0) {
        speichern(wert);
      } else {
        speichern(0);
      }
    }
  }
}
class PremiumRechnung extends Rechnung {
  anzeigen() { return new Rechnung(); }
}`, 'javascript');
assert.equal(structClasses(nestedJavaScript).length,2,'JavaScript classes are retained for UML');
assert.ok(structCountNodes(nestedJavaScript)>=8,'brace parser retains nested JavaScript blocks');
assert.equal(nestedJavaScript[0].children[0].children[0].type,'loop','nested JavaScript loop is retained');
assert.equal(nestedJavaScript[0].children[0].children[0].children[0].branches.length,2,'JavaScript else branch is retained');
assert.match(structCodeFromNodes(nestedJavaScript,'javascript'),/class PremiumRechnung extends Rechnung/,'class inheritance can be generated again');
assert.match(appSource,/openStructogram\(\)/,'Struktogramm-App registered');
assert.match(appSource,/openIDE\(file='hello\.py'/,'IDE-App registered');
assert.match(appSource,/ideSyntaxHTML/,'IDE syntax highlighting layer registered');
assert.match(appSource,/class="ide-shell"/,'VS-Code-like IDE shell registered');
assert.match(appSource,/openGitGraph\(\)/,'Git Graph-App registered');
assert.match(appSource,/git-graph-row/,'Git commit graph UI registered');
assert.match(appSource,/openFunLab\(\)/,'Fun Lab registered');
assert.match(appSource,/matrix-overlay/,'Matrix screensaver registered');
assert.match(appSource,/Konami! Party-Modus/,'Konami Easter Egg registered');
assert.match(appSource,/Code aus dem Programmbaum erzeugt/,'Struktogramm code generation wired');
assert.match(appSource,/Flussdiagramm/,'flowchart view registered');
assert.match(appSource,/UML-Klassen/,'UML class diagram view registered');
assert.match(appSource,/https:\\\/\\\/datenflix007\\\.github\\\.io/,'Datenflix browser allowlist wired');
assert.match(appSource,/allow-scripts allow-forms allow-popups/,'External page stays sandboxed');
assert.match(appSource,/openSolitaire\(\)/,'Windows XP Solitaire registered');
assert.match(appSource,/openMinesweeper\(\)/,'Windows Minesweeper registered');
assert.match(appSource,/openSnake\(\)/,'Unix game registered');
assert.match(appSource,/openMacGame\(\)/,'macOS game registered');
assert.match(appSource,/foundations\.every\(stack=>stack\.length===13\)/,'Solitaire win condition wired');
assert.match(appSource,/plant\(index\)/,'Minesweeper safe first click wired');
console.log('PASS: 9 Betriebssysteme, OS-Kommandos, Dateisystem, SQL, Sprach-Demos, Compiler-Lernumgebung, IDE, Git Graph, Fun Lab, Persistenz, UI-Integrationen und OS-Spiele.');
