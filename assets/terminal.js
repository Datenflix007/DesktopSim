import {getOS,isWindows,homePath,pathDisplay,joinPath} from './vfs.js';
import {simulateCompiled,simulatePython} from './runtimes.js';
const versions={winxp:'5.1.2600',win7:'6.1.7601',win8:'6.2.9200',win10:'10.0.19045',win11:'10.0.26100'};
const unixNames={debian:'Linux debian-sim 6.12.0-amd64 x86_64 GNU/Linux',arch:'Linux arch-sim 6.12.0-arch1-1 x86_64 GNU/Linux',macos:'Darwin mac-sim 24.0.0 arm64',unix:'SunOS workstation 5.11 i86pc'};
const cmdNames=['help','cls','dir','cd','md','mkdir','rd','rmdir','del','erase','copy','move','ren','rename','type','echo','tree','ver','systeminfo','ipconfig','ping','where','whoami','hostname','date','time','set','start','notepad','python','py','java','javac','dotnet','php','sqlite3','curl','history','exit','powershell','cmd','winget'];
const unixCmds=['help','clear','ls','pwd','cd','mkdir','rmdir','touch','rm','cp','mv','cat','echo','tree','uname','whoami','hostname','date','history','which','find','grep','head','tail','wc','ps','ping','curl','ifconfig','ip','export','printenv','env','open','nano','vim','python','python3','java','javac','dotnet','php','sqlite3','sudo','chmod','man'];
function tokenize(s){const arr=[];let token='',q=null,esc=false,started=false;for(const c of s){if(esc){token+=c;started=true;esc=false;continue}if(q){if(c===q){q=null}else token+=c;continue}if(c==='"'||c==="'"){q=c;started=true;continue}if(/\s/.test(c)){if(started){arr.push(token);token='';started=false}continue}token+=c;started=true;}if(started)arr.push(token);return arr;}
const basename=p=>p.replaceAll('\\','/').split('/').pop();
const table = (columns, rows) => {
  if(!columns.length)return'';const cols=columns.map(String);const widths=cols.map(c=>Math.min(36,Math.max(c.length,...rows.map(r=>String(r[c]??'NULL').length))));
  const format=row=>'| '+cols.map((c,i)=>String(row[c]??'NULL').slice(0,36).padEnd(Math.min(widths[i],36))).join(' | ')+' |';
  return [format(Object.fromEntries(cols.map(c=>[c,c]))),'+-'+widths.map(w=>'-'.repeat(Math.min(w,36))).join('-+-')+'-+',...rows.map(format)].join('\n');
};
function expandEnv(s,os){const vars={HOME:homePath(os),USER:isWindows(os)?'Student':'student',USERNAME:'Student',COMPUTERNAME:'DESKTOP-SIM',PATH:'/usr/bin:/bin',TEMP:'/tmp'};return isWindows(os)?s.replace(/%([\w]+)%/g,(_,n)=>vars[n.toUpperCase()]??''):s.replace(/\$([A-Za-z_]\w*)/g,(_,n)=>vars[n]??'')}
export function shellHelp(id){return isWindows(id)?`EINGABEAUFFORDERUNG · ${getOS(id).label}

Dateien           dir, cd, md, rd, del, copy, move, ren, type, tree
System            ver, systeminfo, ipconfig, ping, whoami, hostname
Bearbeitung       notepad <datei>, echo Text > <datei>
Programmieren     python hello.py, javac Main.java, java Main
                  dotnet run Program.cs, php index.php
Webserver         python -m http.server 8000, curl localhost:8000
Datenbank         sqlite3 demo.db  →  SELECT * FROM schueler;
Konsole           cls, help, history, exit
${['win10','win11'].includes(id)?'Shellwechsel       powershell / cmd\nPowerShell         Get-ChildItem, Get-Content, Get-Location, Clear-Host\n':''}
Tipp: Alle Dateien befinden sich virtuell in C:\\Users\\Student\\Projects.
Nur Simulation · keine echten Systemeingriffe.`:
`SHELL · ${getOS(id).label}

Navigation        pwd, ls -la, cd, mkdir, rmdir, tree
Dateien           touch, cat, cp, mv, rm, head, tail, grep, find
System            uname -a, whoami, hostname, date, ps, ifconfig
Editor            nano <datei>, vim <datei>
Programmieren     python3 hello.py, javac Main.java, java Main
                  dotnet run Program.cs, php index.php
Webserver         python3 -m http.server 8000, curl localhost:8000
Datenbank         sqlite3 demo.db  →  SELECT * FROM schueler;
Pakete            ${id==='debian'?'apt / apt-get':id==='arch'?'pacman':id==='macos'?'brew':'pkginfo'} (Demomodus)
Konsole           clear, history, help, exit

Tipp: Alle Übungen liegen in ~/Projects.
Nur Simulation · keine echten Systemeingriffe.`;}
export function promptFor(t){if(t.sqlMode)return 'sqlite> ';const path=pathDisplay(t.os,t.cwd);if(isWindows(t.os))return(t.shell==='powershell'?'PS ':'')+path+'>';const host=t.os==='macos'?'Mac':t.os==='arch'?'arch':t.os==='unix'?'workstation':'debian';const pretty=path.startsWith(homePath(t.os))?'~'+path.slice(homePath(t.os).length):path;return t.os==='macos'?`student@${host} ${pretty} % `:`student@${host}:${pretty}${t.admin?'#':'$'} `;}
export class TerminalEngine{
  constructor(app){this.app=app}
  getCommands(t){return t.sqlMode?['.exit','.tables','SELECT','INSERT','UPDATE','DELETE','CREATE TABLE']:isWindows(t.os)?[...cmdNames,'Get-ChildItem','Get-Content','Get-Location','Set-Location','Get-Help','Clear-Host']:unixCmds.concat(t.os==='debian'?['apt','apt-get']:t.os==='arch'?['pacman']:t.os==='macos'?['brew']:['pkginfo'])}
  completions(part,t){const start=part.replace(/^.*\s/,'');let dirs=[];try{const path=start.includes('/')||start.includes('\\')?start.replace(/[\\/][^\\/]*$/,''):'.';dirs=this.app.fs.list(path,t.cwd).map(e=>e.name+(e.type==='dir'?(isWindows(t.os)?'\\':'/') :''))}catch{}return this.getCommands(t).concat(dirs).filter(c=>c.toLowerCase().startsWith(basename(start).toLowerCase()));}
  async execute(raw,t){raw=raw.trim();if(!raw)return'';
    if(t.sqlMode){if(/^\.(?:exit|quit)$/i.test(raw)){t.sqlMode=false;return'SQL-Konsole verlassen.'}if(raw==='.help')return'Benutze SQL (SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, DROP TABLE), .tables, .exit';try{const out=this.app.db.run(raw);return(out.message||'OK')+(out.columns.length?'\n'+table(out.columns,out.rows):'')}catch(e){return'SQL error: '+e.message}}
    // Verkettung mit && für Lernbeispiele
    if(raw.includes(' && ')){let results=[];for(const segment of raw.split(/\s+&&\s+/)){let out=await this.single(segment,t);if(out==='__CLEAR__')return out;results.push(out);if(String(out).startsWith('Fehler:')||String(out).startsWith('Nicht gefunden'))break;}return results.filter(Boolean).join('\n')}
    return this.single(raw,t);
  }
  async single(line,t){const fs=this.app.fs,os=t.os,win=isWindows(os);let redir=line.match(/^echo(?:\s+|\.)(.*?)\s*(>>|>)\s*(\S+)$/i);
    if(redir){try{fs.write(redir[3],expandEnv(redir[1].trim(),os)+'\n',t.cwd,redir[2]==='>>');this.app.notifyFiles();return''}catch(e){return'Fehler: '+e.message}}
    const parts=tokenize(line);if(!parts.length)return'';let command=parts[0].toLowerCase(),args=parts.slice(1);const arg=args.join(' ');
    if(command==='sudo'){if(win)return"'sudo' ist nicht als Befehl erkannt.";if(!args.length)return'usage: sudo command';return this.single(args.join(' '),{...t,admin:true})}
    const ps={"get-childitem":'dir','gci':'dir','ls':'ls','get-location':'pwd','gl':'pwd','set-location':'cd','sl':'cd','get-content':'cat','gc':'cat','clear-host':'clear','get-date':'date','get-help':'help','get-process':'ps','new-item':'touch','remove-item':'rm','copy-item':'cp','move-item':'mv','invoke-webrequest':'curl'};
    if(t.shell==='powershell'&&ps[command])command=ps[command];
    // Native Befehlsfamilien pro OS/Shell trennen. Die Simulation ist keine Unix-Shell in CMD.
    const cmdBlocked=new Set('ls pwd cat touch rm cp mv head tail wc grep uname ps ifconfig ip export printenv env which chmod sudo open nano vim vi clear python3'.split(' '));
    const psBlocked=new Set('head tail wc grep uname ifconfig ip export printenv env chmod sudo nano vim vi python3'.split(' '));
    const unixBlocked=new Set('cls md rd del erase copy move ren rename type ver systeminfo ipconfig where notepad cmd powershell winget start set tasklist py'.split(' '));
    if(win&&(t.shell==='cmd'?cmdBlocked:psBlocked).has(command))return `'${parts[0]}' ist auf ${t.shell} nicht als Befehl verfügbar. Nutze "help" für Beispiele.`;
    if(!win&&(unixBlocked.has(command)||(command==='open'&&os!=='macos')||(command==='ip'&&os==='macos')))return `${t.shell}: command not found: ${parts[0]}`;
    if(win&&['apt','apt-get','pacman','brew','pkginfo'].includes(command))return `'${parts[0]}' ist auf ${getOS(os).label} nicht verfügbar.`;
    if(command==='help'||command==='man'||command==='?')return shellHelp(os);
    if(command==='history')return t.history.map((v,i)=>`${String(i+1).padStart(3)}  ${v}`).join('\n')||'(Noch keine Befehle)';
    if(['cls','clear'].includes(command))return'__CLEAR__';
    if(command==='exit'){if(this.app.closeWindowById) this.app.closeWindowById(t.windowId);return''}
    if(command==='cmd'||command==='powershell'){
      if(!win)return`${command}: command not found`;
      if(command==='powershell'&&!['win10','win11'].includes(os))return'PowerShell ist in diesem Profil nicht verfügbar.';
      t.shell=command;this.app.updateTerminalTitle(t);return`Microsoft ${command==='cmd'?'Windows [Eingabeaufforderung]':'PowerShell'} · simuliert`;
    }
    if(command==='cd'||command==='chdir'||command==='sl'){
      if(!args.length)return win?pathDisplay(os,t.cwd):t.cwd;
      const target=fs.normalize(arg,t.cwd),obj=fs.locate(target);
      if(!obj)return win?'Das System kann den angegebenen Pfad nicht finden.':'cd: no such file or directory: '+arg;
      if(obj.type!=='dir')return'Fehler: kein Verzeichnis';t.cwd=target;return'';
    }
    if(command==='pwd')return pathDisplay(os,t.cwd);
    if(['ls','dir'].includes(command)){
      const path=args.find(a=>!a.startsWith('-')&&!a.startsWith('/'))||'.';try{
        const entries=fs.list(path,t.cwd);if(win&&command==='dir'){const lines=[` Verzeichnis von ${pathDisplay(os,fs.normalize(path,t.cwd))}`,''];for(const e of entries)lines.push(`  ${e.type==='dir'?'<DIR>       ':String(e.size).padStart(11)}  ${e.name}`);return lines.concat(['',` ${entries.filter(e=>e.type==='file').length} Datei(en)`]).join('\n');}
        if(args.includes('-l')||args.includes('-la')||args.includes('-al'))return['total '+entries.length,...entries.map(e=>`${e.type==='dir'?'drwxr-xr-x':'-rw-r--r--'}  student  ${String(e.size).padStart(6)}  ${e.name}`)].join('\n');return entries.map(e=>e.name+(e.type==='dir'?'/':'')).join('    ')||'(leer)';
      }catch(e){return'Fehler: '+e.message}
    }
    if(command==='tree'){
      const lines=[pathDisplay(os,fs.normalize(arg||'.',t.cwd))];const descend=(path,level)=>{if(level>7)return;try{const entries=fs.list(path);for(let i=0;i<entries.length;i++){const e=entries[i];const last=i===entries.length-1;lines.push(' '.repeat(level*3)+(last?'└── ':'├── ')+e.name);if(e.type==='dir')descend(joinPath(path,e.name),level+1)}}catch{}};descend(fs.normalize(arg||'.',t.cwd),0);return lines.slice(0,300).join('\n');
    }
    if(['mkdir','md'].includes(command)){if(!arg)return'Usage: mkdir <ordner>';try{fs.mkdir(arg,t.cwd);this.app.notifyFiles();return''}catch(e){return'Fehler: '+e.message}}
    if(['touch','new-item'].includes(command)){if(!arg)return'Usage: touch <datei>';try{if(!fs.exists(arg,t.cwd))fs.write(arg,'',t.cwd);this.app.notifyFiles();return''}catch(e){return'Fehler: '+e.message}}
    if(['rmdir','rd','rm','del','erase'].includes(command)){
      const items=args.filter(v=>!v.startsWith('-')&&v!=='/s'&&v!=='/q');if(!items.length)return'Usage: rm <datei>';
      const recursive=args.some(a=>['-r','-rf','-fr','/s','/q'].includes(a.toLowerCase()));
      try{for(const item of items)fs.remove(item,t.cwd,recursive);this.app.notifyFiles();return''}catch(e){return'Fehler: '+e.message}
    }
    if(['cp','copy','mv','move','ren','rename'].includes(command)){
      if(args.length<2)return`Usage: ${command} <quelle> <ziel>`;try{if(['cp','copy'].includes(command))fs.copy(args[0],args[1],t.cwd);else fs.move(args[0],args[1],t.cwd);this.app.notifyFiles();return''}catch(e){return'Fehler: '+e.message}
    }
    if(['cat','type','more','head','tail','grep','wc'].includes(command)){
      const filename=args.find(a=>!a.startsWith('-')&&a!=='-n');if(!filename)return`Usage: ${command} <datei>`;
      try{
        if(command==='grep'){if(args.length<2)return'grep <muster> <datei>';const src=fs.read(args[1],t.cwd);return src.split('\n').filter(x=>x.toLowerCase().includes(args[0].toLowerCase())).join('\n')}
        const contents=fs.read(filename,t.cwd);if(command==='head')return contents.split('\n').slice(0,10).join('\n');if(command==='tail')return contents.split('\n').slice(-10).join('\n');if(command==='wc')return`${contents.split('\n').length} ${contents.trim().split(/\s+/).length} ${contents.length} ${filename}`;return contents;
      }catch(e){return'Fehler: '+e.message}
    }
    if(command==='echo')return expandEnv(arg,os);
    if(command==='find'){try{const path=args[0]||'.';const items=fs.list(path,t.cwd);return items.map(e=>joinPath(fs.normalize(path,t.cwd),e.name)).join('\n')}catch(e){return'Fehler: '+e.message}}
    if(command==='whoami')return win?'desktop-sim\\Student':'student';
    if(command==='hostname')return win?'DESKTOP-SIM':os==='macos'?'Mac':os==='arch'?'arch-sim':os==='unix'?'workstation':'debian-sim';
    if(command==='ver')return win?`Microsoft Windows [Version ${versions[os]}] (simuliert)`:'ver: command not found';
    if(command==='uname')return win?'uname: command not found':args.includes('-a')?unixNames[os]:os==='macos'?'Darwin':os==='unix'?'SunOS':'Linux';
    if(command==='systeminfo')return `Host: ${win?'DESKTOP-SIM':'workstation'}\nBetriebssystem: ${getOS(os).label}\nShell: ${t.shell}\nMaschine: Browser-Sandbox (kein echter Rechner)\nVirtueller Benutzer: Student`;
    if(['ipconfig','ifconfig','ip'].includes(command))return win?`Windows-IP-Konfiguration (DEMO)\n\nEthernet-Adapter LAN:\n IPv4-Adresse . . . . . : 192.0.2.10\n Subnetzmaske . . . . . : 255.255.255.0\n Standardgateway  . . . : 192.0.2.1\n\nBeispieladressen; kein Zugriff auf echte Netzwerkkarten.`:`eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST> mtu 1500\n    inet 192.0.2.10 netmask 255.255.255.0\n    simulation / no real network adapter`;
    if(command==='ping')return`PING ${arg||'localhost'} (192.0.2.1): 56 data bytes\n64 bytes from 192.0.2.1: icmp_seq=1 ttl=64 time=1.0 ms\n\n--- Demo-Ping: kein echter Netzwerkverkehr ---`;
    if(command==='date'||command==='time')return new Date().toLocaleString('de-DE',{dateStyle:'full',timeStyle:'medium'});
    if(['set','env','printenv','export'].includes(command))return`HOME=${homePath(os)}\nUSER=student\nSHELL=${t.shell}\nDESKTOPSIM=1 (simuliert)`;
    if(command==='ps'||command==='tasklist')return`PID  PROZESS\n1    Browser-Sandbox\n2    Virtueller Desktop\n3    ${t.shell} (dieses Fenster)`;
    if(command==='where'||command==='which')return args[0]?this.getCommands(t).some(c=>c.toLowerCase()===args[0].toLowerCase())?(win?'C:\\Windows\\System32\\':'/usr/bin/')+args[0]:'INFO: Programm nicht gefunden':'Usage: which <befehl>';
    if(command==='chmod')return'chmod: Dateirechte sind hier nur visualisiert (Demomodus).';
    if(['apt','apt-get','pacman','brew','winget','pkginfo'].includes(command)){
      const valid=command.startsWith('apt')&&os==='debian'||command==='pacman'&&os==='arch'||command==='brew'&&os==='macos'||command==='winget'&&['win10','win11'].includes(os)||command==='pkginfo'&&os==='unix';
      return valid?`[Paketmanager-Demo] ${command} ${arg}\nKeine echte Installation: GitHub Pages stellt keinen Paketmanager bereit.`:`${command}: auf ${getOS(os).label} nicht verfügbar.`;
    }
    if(['nano','vim','vi','notepad','code','edit'].includes(command)){this.app.openEditor(arg||'hello.py',t.cwd);return'Editor geöffnet: '+(arg||'hello.py')}
    if(command==='start'||command==='open'){
      const path=arg||'.';if(/\.html?$/i.test(path)){this.app.openBrowser(path,t.cwd);return'HTML-Vorschau geöffnet.'}
      if(fs.locate(path,t.cwd)?.type==='dir'){this.app.openFiles(fs.normalize(path,t.cwd));return'Dateimanager geöffnet.'}
      this.app.openEditor(path,t.cwd);return'Editor geöffnet.';
    }
    if(['python','python3','py'].includes(command)){
      if(args[0]==='-m'&&args[1]==='http.server')return this.startServer(args[2]||'8000',t);
      if(!args[0]||args[0]==='--version'||args[0]==='-V')return'Python 3 (Pyodide / WebAssembly bei Verbindung; sonst eingeschränkte Demo)';
      try{const code=fs.read(args[0],t.cwd);return await this.runPython(code)}catch(e){return'Fehler: '+e.message}
    }
    if(command==='javac'){if(!arg)return'Usage: javac <datei.java>';try{fs.read(arg,t.cwd);t.compiled=arg;return`[Java-Demo] ${basename(arg)} geprüft. Kein echter Java-Compiler.`}catch(e){return'Fehler: '+e.message}}
    if(command==='java'){const file=args[0]?.endsWith('.java')?args[0]:(args[0]||'Main')+'.java';try{return this.compiled('java',fs.read(file,t.cwd))}catch(e){return'Fehler: '+e.message}}
    if(command==='dotnet'){const file=args.find(a=>a.toLowerCase().endsWith('.cs'))||'Program.cs';try{return this.compiled('cs',fs.read(file,t.cwd))}catch(e){return'Fehler: '+e.message}}
    if(command==='php'){
      if(args[0]==='-S')return this.startServer(args[1]?.split(':').pop()||'8000',t);
      try{return this.compiled('php',fs.read(args[0]||'index.php',t.cwd))}catch(e){return'Fehler: '+e.message}
    }
    if(command==='sqlite3'||command==='mysql'||command==='psql'){t.sqlMode=true;return`SQL-Lernkonsole · ${command} ${arg}\nVerbunden mit einer virtuellen Browser-Datenbank.\nTabellen: schueler, projekte | .tables | .exit`}
    if(command==='curl'||command==='wget'||command==='iwr'){
      const match=arg.match(/(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?::(\d+))?(\/[^\s]*)?/i);
      if(!match)return'Nur localhost wird in der Simulation unterstützt. Es wird kein externer HTTP-Request ausgeführt.';
      const port=match[1]||'8000',server=this.app.servers.get(port);if(!server)return`curl: (7) Verbindung zu localhost:${port} fehlgeschlagen (kein virtueller Server gestartet)`;
      try{const name=match[2]?.slice(1)||'index.html';return fs.read(joinPath(server.cwd,name),t.cwd).slice(0,12000)}catch(e){return'HTTP/1.1 404 Not Found: '+e.message}
    }
    return win?`'${parts[0]}' ist entweder falsch geschrieben oder konnte nicht gefunden werden.\nNutze "help" für unterstützte Befehle.`:`${t.shell}: command not found: ${parts[0]}\nNutze "help" für unterstützte Befehle.`;
  }
  compiled(lang,src){const result=simulateCompiled(lang,src);return(result.output||'')+'\n\n['+result.detail+']'}
  async runPython(code){try{const result=await this.app.python.run(code);return result||'[Python ausgeführt · keine Ausgabe]'}catch(e){const demo=simulatePython(code);return`Pyodide konnte nicht gestartet werden: ${e.message}\n${demo.detail}\n${demo.output}`}}
  startServer(port,t){if(!/^\d{2,5}$/.test(port)||+port>65535)return'Ungültiger Port';this.app.servers.set(port,{cwd:t.cwd,os:t.os});this.app.toast(`Virtueller Webserver auf localhost:${port} gestartet`);return`Serving HTTP on localhost port ${port} (virtuell) ...\nÖffne den DesktopSim-Browser und rufe http://localhost:${port} auf.\nKein echter TCP-Port wird geöffnet.`}
}
