// Shell-Engine: Bash/Zsh/sh, CMD und PowerShell mit Pipes, Umleitungen, Variablen, Skripten und Exitcodes.
import {getOS,isWindows,homePath,pathDisplay,joinPath,extName,formatSize,trashPath} from './vfs.js';
import {parse,dialectFor,ParseError,wordText,globToRegExp,hasGlob} from './shell/parser.js';
import {venvScript,activate as venvActivate,deactivate as venvDeactivate} from './shell/pyenv.js';
import {Programs,INSTALLABLE} from './shell/programs.js';

const versions={winxp:'5.1.2600',win7:'6.1.7601',win8:'6.2.9200',win10:'10.0.19045.5371',win11:'10.0.26100.2605'};
const unixNames={debian:['Linux','debian-sim','6.12.48+deb13-amd64','#1 SMP PREEMPT_DYNAMIC Debian 6.12.48-1 (2025-09-20)','x86_64','GNU/Linux'],arch:['Linux','arch-sim','6.17.7-arch1-1','#1 SMP PREEMPT_DYNAMIC Sun, 02 Nov 2026 12:00:00 +0000','x86_64','GNU/Linux'],macos:['Darwin','Mac','25.1.0','Darwin Kernel Version 25.1.0: root:xnu-12377/RELEASE_ARM64_T8132','arm64',''],unix:['SunOS','workstation','5.11','11.4.81.193.1','i86pc','i386']};
const MONTHS=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const DAYS=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const C={reset:'\x1b[0m',bold:'\x1b[1m',red:'\x1b[31m',green:'\x1b[32m',yellow:'\x1b[33m',blue:'\x1b[34m',magenta:'\x1b[35m',cyan:'\x1b[36m',gray:'\x1b[90m',bblue:'\x1b[1;34m',bgreen:'\x1b[1;32m',bcyan:'\x1b[1;36m'};
const pad2=n=>String(n).padStart(2,'0');
const sleep=(ms,sig)=>new Promise(r=>{const id=setTimeout(r,ms);if(sig)sig.onCancel=()=>{clearTimeout(id);r()}});
export const hostName=os=>isWindows(os)?'DESKTOP-SIM':{debian:'debian-sim',arch:'arch-sim',macos:'Mac',unix:'workstation'}[os];
const userName=os=>isWindows(os)?'Student':'student';
const modeString=(type,mode)=>(type==='dir'?'d':'-')+[6,3,0].map(s=>{const m=(mode>>s)&7;return (m&4?'r':'-')+(m&2?'w':'-')+(m&1?'x':'-')}).join('');
const lsDate=ms=>{const d=new Date(ms),now=Date.now();const recent=Math.abs(now-ms)<15552000000;return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${recent?pad2(d.getHours())+':'+pad2(d.getMinutes()):' '+d.getFullYear()}`};
const winDate=ms=>{const d=new Date(ms);return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`};
const groupNum=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.');

export function shellHelp(id){return isWindows(id)?`Shell-Befehle · ${getOS(id).label}

Dateien         dir, cd, md, rd, del, copy, move, ren, type, more, tree, attrib
Text            echo, find, findstr, sort, fc       Pipes:  dir | findstr .py
System          ver, systeminfo, ipconfig, ping, tasklist, taskkill, whoami
Variablen       set NAME=Wert, echo %NAME%, set /p NAME=Frage:
Skripte         start.bat ausführen (echo, set /p, pause, rem, if exist)
Programme       python hello.py · node hello.js · php index.php
                javac Main.java  &&  java Main
                gcc hello.c -o hallo  &&  hallo
                g++ main.cpp -o main  &&  main
                sqlite3 demo.db · pip install <paket>
Werkzeuge       notepad, code, explorer, calc, taskmgr, git, winget
Konsole         cls, help, exit${['win10','win11'].includes(id)?', powershell, cmd':''}
${['win10','win11'].includes(id)?`
PowerShell      Get-ChildItem, Set-Location, Get-Content, Set-Content, New-Item,
                Remove-Item, Copy-Item, Write-Host, Read-Host, Get-Process, $x = 5
`:''}
Strg+C bricht ein laufendes Programm ab · Tab vervollständigt · ↑/↓ Verlauf`:
`Shell-Befehle · ${getOS(id).label} (${id==='macos'?'zsh':id==='unix'?'sh':'bash'})

Navigation      pwd, ls -la, cd, cd -, mkdir -p, rmdir, tree, find . -name "*.py"
Dateien         touch, cat, cp -r, mv, rm -r, ln, chmod +x, file, stat, du -sh
Text            echo, printf, head, tail, wc, grep -in, sort, uniq, cut, tr, diff, tee
Pipes           ls | grep py · cat datei | sort | uniq -c · cmd > datei 2>&1
System          uname -a, whoami, id, ps aux, top, kill, df -h, free -h, uptime, date
Variablen       NAME=Wert, echo $NAME, export, env, alias, $(befehl), $((1+2))
Skripte         chmod +x skript.sh && ./skript.sh  ·  if / for / while
Programme       python3 hello.py · node hello.js · php index.php
                javac Main.java && java Main
                gcc hello.c -o hallo && ./hallo · g++ main.cpp -o main && ./main
                sqlite3 demo.db · pip install <paket>
Pakete          ${id==='debian'?'sudo apt install <paket>':id==='arch'?'sudo pacman -S <paket>':id==='macos'?'brew install <paket>':'pkg install <paket>'}   (z. B. cowsay, sl, neofetch)
Werkzeuge       nano, vim, code, ${id==='macos'?'open':'xdg-open'}, git, man <befehl>
Konsole         clear, history, exit · Strg+C abbrechen · Strg+D Eingabeende`;}

export function promptParts(t){
  if(t.sqlMode)return[{text:t.sqlBuffer?'   ...> ':'sqlite> '}];
  if(t.replPrompt)return[{text:t.replPrompt}];
  if(t.venv)return[{text:`(${t.venv.name}) `,cls:'p-venv'},...basePrompt(t)];
  return basePrompt(t);
}
function basePrompt(t){
  const path=pathDisplay(t.os,t.cwd);
  const unixShell=['bash','sh','zsh'].includes(t.shell);
  if(isWindows(t.os)&&unixShell){const home=homePath(t.os);const p=t.cwd===home?'~':t.cwd.startsWith(home+'/')?'~'+t.cwd.slice(home.length):'/c'+t.cwd;return[{text:'Student@DESKTOP-SIM',cls:'p-user'},{text:' MINGW64 ',cls:'p-mingw'},{text:p,cls:'p-path'},{text:'\n$ '}]}
  if(isWindows(t.os))return[{text:(t.shell==='powershell'?'PS ':'')+path+'>'}];
  if(t.shell==='powershell')return[{text:'PS '+path+'> '}];
  const home=homePath(t.os),pretty=t.cwd===home?'~':t.cwd.startsWith(home+'/')?'~'+t.cwd.slice(home.length):path;
  const user=t.admin?'root':'student',host=hostName(t.os);
  if(t.os==='macos')return[{text:`${user}@${host} ${pretty==='~'?'~':pretty.split('/').pop()||'/'} ${t.admin?'#':'%'} `}];
  if(t.os==='unix')return[{text:`${host}:${pretty}${t.admin?'#':'$'} `}];
  if(t.os==='arch')return[{text:`[${user}@${host} ${pretty==='~'?'~':pretty.split('/').pop()||'/'}]${t.admin?'#':'$'} `}];
  return[{text:`${user}@${host}`,cls:t.admin?'p-root':'p-user'},{text:':'},{text:pretty,cls:'p-path'},{text:(t.admin?'#':'$')+' '}];
}
export function promptFor(t){return promptParts(t).map(p=>p.text).join('')}

class ExitShell{constructor(code){this.code=code}}

export class TerminalEngine{
  constructor(app){this.app=app;this.programs=new Programs(this)}
  get fs(){return this.app.fs}
  ensure(t){
    t.vars??={};t.aliases??=(isWindows(t.os)?{}:{ll:'ls -la',la:'ls -A',l:'ls -CF'});t.history??=[];t.lastCode??=0;t.shellStack??=[];t.jobs??=[];
    t.prevCwd??=t.cwd;t.cols??=90;t.started??=Date.now();
    return t;
  }
  getCommands(t){const set=new Set([...this.builtinNames(t),...this.programs.names(t)]);return[...set].sort()}
  builtinNames(t){
    if(t.sqlMode)return['.tables','.schema','.headers','.mode','.read','.exit','.quit','.help','SELECT','INSERT INTO','UPDATE','DELETE FROM','CREATE TABLE','DROP TABLE'];
    if(isWindows(t.os)&&t.shell==='powershell')return Object.keys(PS_ALIASES).concat(PS_CMDLETS);
    if(isWindows(t.os))return CMD_BUILTINS;
    return UNIX_BUILTINS.concat(Object.keys(t.aliases||{}));
  }
  completions(line,t){
    this.ensure(t);
    const word=line.match(/(?:^|\s)("?[^\s"]*)$/)?.[1]?.replace(/^"/,'')||'';const isFirst=!/\S\s/.test(line.trimStart());
    const sep=word.lastIndexOf('/')>=0||word.lastIndexOf('\\')>=0?Math.max(word.lastIndexOf('/'),word.lastIndexOf('\\')):-1;
    const dir=sep>=0?word.slice(0,sep+1):'',base=word.slice(sep+1);
    let entries=[];try{entries=this.fs.list(dir||'.',t.cwd).filter(e=>!e.name.startsWith('.')||base.startsWith('.')).map(e=>dir+e.name+(e.type==='dir'?(isWindows(t.os)?'\\':'/'):''))}catch{}
    const ci=isWindows(t.os)||t.os==='macos';const match=s=>ci?s.slice(dir.length).toLowerCase().startsWith(base.toLowerCase()):s.slice(dir.length).startsWith(base);
    const cmds=isFirst&&!dir?this.getCommands(t).filter(c=>ci||t.shell==='powershell'?c.toLowerCase().startsWith(base.toLowerCase()):c.startsWith(base)):[];
    return[...new Set([...cmds,...entries.filter(match)])];
  }
  /** Führt eine Eingabezeile aus. Mit t.io wird live gestreamt, sonst wird die Ausgabe gesammelt zurückgegeben. */
  /** Strg+C: laufende Programme, sleep, ping, Server usw. abbrechen. */
  cancel(t){t.cancelled=true;for(const hook of t.cancelHooks||[])try{hook()}catch{}t.cancelHooks?.clear()}
  async execute(raw,t){
    this.ensure(t);
    t.cancelled=false;t.cancelHooks=new Set();
    let collected='';
    const sink=t.io?{out:s=>t.io.write(s,'stdout'),err:s=>t.io.write(s,'stderr')}:{out:s=>{collected+=s},err:s=>{collected+=s}};
    const io={out:sink.out,err:sink.err,stdin:null,readLine:()=>t.io?.readLine?t.io.readLine():Promise.resolve(null),image:src=>t.io?.image?.(src),status:s=>t.io?.status?.(s)};
    try{
      if(t.sqlMode){await this.programs.sqlLine(raw,t,io);return collected.replace(/\n$/,'')}
      if(t.repl){await t.repl(raw,io);return collected.replace(/\n$/,'')}
      const text=String(raw);if(!text.trim())return'';
      const code=await this.runSource(text,t,io);t.lastCode=code;
    }catch(error){
      if(error instanceof ExitShell){if(t.shellStack.length){const prev=t.shellStack.pop();Object.assign(t,prev);this.app.updateTerminalTitle?.(t)}else{t.closed=true;if(t.onExit)t.onExit();else this.app.closeWindowById?.(t.windowId)}}
      else if(error instanceof ParseError){io.err(this.syntaxError(t,error.message));t.lastCode=2}
      else{io.err('Fehler: '+(error?.message||error)+'\n');t.lastCode=1}
    }
    if(collected==='__CLEAR__')return collected;
    return collected.replace(/\n$/,'');
  }
  syntaxError(t,msg){if(t.shell==='powershell')return`${C.red}In Zeile:1 Zeichen:1\n${msg}\n    + CategoryInfo          : ParserError\n    + FullyQualifiedErrorId : ParseError${C.reset}\n`;if(t.shell==='cmd')return msg+'\n';return`${t.shell}: ${msg}\n`}
  async runSource(text,t,io){const ast=parse(text,dialectFor(t.shell));return this.runList(ast,t,io)}
  async runList(list,t,io){let code=0;for(const item of list.items){code=await this.runAndOr(item.andor,t,io);t.lastCode=code;if(t.cancelled)break}return code}
  async runAndOr(node,t,io){let code=await this.runPipeline(node.first,t,io);for(const{op,pipeline}of node.rest){t.lastCode=code;if(t.cancelled)break;if(op==='&&'&&code===0||op==='||'&&code!==0)code=await this.runPipeline(pipeline,t,io)}return code}
  async runPipeline(pl,t,io){
    let code=0;
    if(pl.cmds.length===1)code=await this.runCommand(pl.cmds[0],t,io);
    else{let input=io.stdin;for(let i=0;i<pl.cmds.length;i++){const last=i===pl.cmds.length-1;let buf='';const stageIO=last?{...io,stdin:input}:{...io,stdin:input,piped:true,out:s=>{buf+=s}};code=await this.runCommand(pl.cmds[i],t,stageIO);if(!last)input=buf;if(t.cancelled)break}}
    return pl.bang?(code?0:1):code;
  }
  async withRedirects(redirs,t,io,fn){
    if(!redirs?.length)return fn(io);
    const fs=this.fs;let stdin=io.stdin,outFile=null,errFile=null,errToOut=false,outToErr=false,outBuf='',errBuf='';
    for(const r of redirs){
      if(r.op==='2>&1'){errToOut=true;continue}if(r.op==='>&2'){outToErr=true;continue}
      const target=(await this.expandWord(r.target,t,io)).join(' ');
      const nul=/^(\/dev\/null|nul|\$null)$/i.test(target);
      if(r.op==='<'){try{stdin=fs.read(target,t.cwd)}catch{io.err(this.noSuchFile(t,target));return 1}continue}
      const spec={path:target,append:r.op.endsWith('>>'),nul};
      if(r.op==='2>'||r.op==='2>>')errFile=spec;else if(r.op==='&>'){outFile=spec;errToOut=true}else outFile=spec;
    }
    const sub={...io,stdin};
    if(outFile){sub.out=s=>{outBuf+=s};sub.piped=true}if(errFile)sub.err=s=>{errBuf+=s};
    if(errToOut)sub.err=sub.out;if(outToErr)sub.out=sub.err;
    if(outFile&&!outFile.nul){try{if(!outFile.append||!fs.exists(outFile.path,t.cwd))fs.write(outFile.path,'',t.cwd)}catch(e){io.err(this.redirectError(t,outFile.path,e));return 1}}
    const code=await fn(sub);
    try{
      if(outFile&&!outFile.nul)fs.write(outFile.path,(t.shell==='powershell'?outBuf.replace(/\x1b\[[0-9;]*m/g,''):outBuf),t.cwd,true);
      if(errFile&&!errFile.nul)fs.write(errFile.path,errBuf,t.cwd,errFile.append);
    }catch(e){io.err(this.redirectError(t,outFile?.path||errFile?.path,e));return 1}
    this.app.notifyFiles?.();return code;
  }
  redirectError(t,path,e){return t.shell==='cmd'?'Das System kann den angegebenen Pfad nicht finden.\n':`${t.shell}: ${path}: ${/Verzeichnis/.test(e.message)?'Ist ein Verzeichnis':'Datei oder Verzeichnis nicht gefunden'}\n`}
  async runCommand(cmd,t,io){
    if(cmd.type==='if')return this.withRedirects(cmd.redirs,t,io,async sub=>{for(const c of cmd.clauses){if(await this.runList(c.cond,t,sub)===0)return this.runList(c.body,t,sub)}return cmd.elseBody?this.runList(cmd.elseBody,t,sub):0});
    if(cmd.type==='for')return this.withRedirects(cmd.redirs,t,io,async sub=>{const items=[];for(const w of cmd.items)items.push(...await this.expandWord(w,t,sub));let code=0;for(const v of items){t.vars[cmd.name]=v;code=await this.runList(cmd.body,t,sub);if(t.cancelled)break}return code});
    if(cmd.type==='while')return this.withRedirects(cmd.redirs,t,io,async sub=>{let code=0,guard=0;while(guard++<10000){const c=await this.runList(cmd.cond,t,sub);if(cmd.until?c===0:c!==0)break;code=await this.runList(cmd.body,t,sub);if(t.cancelled)break;if(guard%50===0)await sleep(0)}if(guard>=10000)sub.err('Schleife nach 10000 Durchläufen abgebrochen (Schutz vor Endlosschleifen).\n');return code});
    // PowerShell-Variablenzuweisung: $x = Wert
    if(t.shell==='powershell'&&cmd.words.length){
      const raw=cmd.words.map(wordText);const m=raw[0].match(/^\$([\w:]+)(=(.*))?$/);
      if(m&&(m[2]!==undefined||raw[1]==='='||/^[+\-*]?=$/.test(raw[1]||''))){
        const rest=m[2]!==undefined?[m[3],...raw.slice(1)].filter(Boolean):raw.slice(2);const restWords=m[2]!==undefined?cmd.words.slice(1):cmd.words.slice(2);
        const value=await this.psValue(rest,restWords,t,io);
        const name=m[1].toLowerCase();if(name.startsWith('env:'))t.vars[name.slice(4).toUpperCase()]=value;else t.vars['$'+name]=value;return 0;
      }
    }
    const argv=[];for(const w of cmd.words)argv.push(...await this.expandWord(w,t,io));
    // Bash: VAR=wert Zuweisungen
    if(t.shell!=='cmd'&&t.shell!=='powershell'){
      while(argv.length&&/^[A-Za-z_]\w*=/.test(argv[0])&&cmd.words[0]){const i=argv[0].indexOf('=');t.vars[argv[0].slice(0,i)]=argv[0].slice(i+1);argv.shift()}
      if(!argv.length)return 0;
    }
    if(!argv.length)return this.withRedirects(cmd.redirs,t,io,async()=>0);
    return this.withRedirects(cmd.redirs,t,io,sub=>this.dispatch(argv,t,sub));
  }
  async psValue(rawParts,words,t,io){
    const text=rawParts.join(' ').trim();
    if(/^".*"$|^'.*'$/s.test(text)||(words.length===1&&words[0]?.parts?.length&&words[0].parts.every(p=>p.q==='double'||p.q==='single')))return(await this.expandWord(words[0],t,io)).join(' ');
    if(/^-?\d+(\.\d+)?$/.test(text))return text;
    if(/^[\d\s+\-*/().$\w]+$/.test(text)&&/[+\-*/]/.test(text)){try{const expr=text.replace(/\$(\w+)/g,(_,n)=>Number(t.vars['$'+n.toLowerCase()]??0));if(/^[\d\s+\-*/().]+$/.test(expr))return String(Function(`return (${expr})`)())}catch{}}
    if(/^\$\w+$/.test(text))return t.vars['$'+text.slice(1).toLowerCase()]??'';
    if(/^\$(true|false|null)$/i.test(text))return text.slice(1).toLowerCase()==='null'?'':text.slice(1)==='true'?'True':'False';
    let buf='';const argv=[];for(const w of words)argv.push(...await this.expandWord(w,t,io));
    await this.dispatch(argv,t,{...io,out:s=>{buf+=s}});return buf.replace(/\n+$/,'');
  }
  // ---------- Expansion ----------
  async expandWord(word,t,io){
    const unix=!isWindows(t.os)||t.shell==='bash';const ps=t.shell==='powershell';const cmd=t.shell==='cmd';
    let text='',globbable='',hadUnquotedSub=false,anyQuoted=false;
    for(const part of word.parts){
      let v=part.t;
      if(part.q==='single'||part.q==='block'){anyQuoted=true;text+=v;globbable+=v.replace(/[*?[]/g,'\\$&');continue}
      if(part.q==='cmdsub'){let buf='';await this.runSource(v,t,{...io,stdin:null,out:s=>{buf+=s}});v=buf.replace(/\n+$/,'');if(part.q==='cmdsub')hadUnquotedSub=true;text+=v;globbable+=v;continue}
      if(part.q==='arith'){const r=this.arith(v,t);text+=r;globbable+=r;continue}
      if(part.q==='double'&&!cmd&&!ps&&v.includes('$(('))v=v.replace(/\$\(\(((?:[^()]|\([^()]*\))*)\)\)/g,(_,e)=>this.arith(e,t));
      if(part.q==='double'&&!cmd&&v.includes('$('))v=await this.expandInnerSubs(v,t,io);
      if(cmd)v=this.expandCmdVars(v,t);else if(ps)v=this.expandPsVars(v,t);else v=this.expandUnixVars(v,t,part.q==='none'?()=>{hadUnquotedSub=true}:null);
      v=v.replace(/\u0000/g,'$');
      if(part.q==='double'){anyQuoted=true;text+=v;globbable+=v.replace(/[*?[]/g,'\\$&');continue}
      if(unix&&!ps&&!cmd&&text===''&&(v==='~'||v.startsWith('~/')))v=homePath(t.os)+v.slice(1);
      text+=v;globbable+=v;
    }
    if(!anyQuoted&&!cmd&&!ps&&hasGlob(globbable)){const matches=this.glob(globbable,t);if(matches.length)return matches;if(t.shell==='zsh')throw new ParseError(`no matches found: ${text}`)}
    if(hadUnquotedSub&&!anyQuoted&&!cmd&&!ps)return text.split(/\s+/).filter(Boolean);
    return[text];
  }
  /** $(befehl) innerhalb von "…" ausführen (Variablen werden danach expandiert). */
  async expandInnerSubs(text,t,io){
    let out='';
    for(let i=0;i<text.length;i++){
      if(text[i]==='$'&&text[i+1]==='('&&text[i+2]!=='('){let depth=0,j=i+1;for(;j<text.length;j++){if(text[j]==='(')depth++;else if(text[j]===')'&&--depth===0)break}
        let buf='';await this.runSource(text.slice(i+2,j),t,{...io,stdin:null,piped:true,out:s=>{buf+=s}});out+=buf.replace(/\n+$/,'').replace(/\$/g,'\u0000');i=j;continue}
      out+=text[i];
    }
    return out;
  }
  glob(pattern,t){
    const slash=pattern.lastIndexOf('/');const dirPart=slash>=0?pattern.slice(0,slash+1):'';const base=pattern.slice(slash+1);
    if(hasGlob(dirPart))return[];
    try{const rx=globToRegExp(base.replace(/\\([*?[])/g,'[$1]'),isWindows(t.os)||t.os==='macos');return this.fs.list(dirPart||'.',t.cwd).filter(e=>(!e.name.startsWith('.')||base.startsWith('.'))&&rx.test(e.name)).map(e=>dirPart+e.name)}catch{return[]}
  }
  varValue(name,t){
    const os=t.os;const builtin={HOME:homePath(os),USER:t.admin?'root':userName(os),LOGNAME:userName(os),SHELL:'/bin/'+(os==='macos'?'zsh':os==='unix'?'sh':'bash'),PWD:t.cwd,OLDPWD:t.prevCwd,HOSTNAME:hostName(os),PATH:os==='macos'?'/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin':'/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',LANG:'de_DE.UTF-8',TERM:'xterm-256color',EDITOR:'nano',RANDOM:String(Math.floor(Math.random()*32768)),SECONDS:String(Math.floor((Date.now()-t.started)/1000)),UID:t.admin?'0':'1000'};
    if(name in t.vars)return t.vars[name];if(name in builtin)return builtin[name];return undefined;
  }
  expandUnixVars(v,t,onExpand){
    return v.replace(/\$\{([A-Za-z_]\w*)(?::?([-=+?])([^}]*))?\}|\$\{#([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*|[?$#@*0-9!])/g,(m,name,op,arg,lenName,simple)=>{
      onExpand?.();
      if(lenName)return String((this.varValue(lenName,t)??'').length);
      const n=name||simple;
      if(n==='?')return String(t.lastCode??0);if(n==='$')return '4242';if(n==='!')return '';
      if(n==='#')return String((t.args||[]).length);if(n==='@'||n==='*')return(t.args||[]).join(' ');
      if(/^\d$/.test(n))return n==='0'?(t.scriptName||t.shell):(t.args||[])[+n-1]??'';
      const val=this.varValue(n,t);
      if(op==='-')return val??arg;if(op==='=')return val??(t.vars[n]=arg);if(op==='+')return val!==undefined?arg:'';
      return val??'';
    });
  }
  expandCmdVars(v,t){
    const env=this.winEnv(t);
    return v.replace(/%([0-9])|%~([0-9])|%([^%\s]+)%/g,(m,arg,arg2,name)=>{
      if(arg||arg2)return(t.args||[])[+(arg||arg2)-1]??'';
      const key=Object.keys(env).find(k=>k.toLowerCase()===name.toLowerCase());
      const tv=Object.keys(t.vars).find(k=>k.toLowerCase()===name.toLowerCase());
      if(tv)return t.vars[tv];if(key)return typeof env[key]==='function'?env[key]():env[key];return m;
    });
  }
  winEnv(t){const now=new Date();return{USERNAME:'Student',USERPROFILE:'C:\\Users\\Student',HOMEDRIVE:'C:',HOMEPATH:'\\Users\\Student',COMPUTERNAME:'DESKTOP-SIM',OS:'Windows_NT',SystemRoot:'C:\\Windows',windir:'C:\\Windows',SystemDrive:'C:',TEMP:'C:\\Users\\Student\\AppData\\Local\\Temp',TMP:'C:\\Users\\Student\\AppData\\Local\\Temp',APPDATA:'C:\\Users\\Student\\AppData\\Roaming',LOCALAPPDATA:'C:\\Users\\Student\\AppData\\Local',PROGRAMFILES:'C:\\Program Files',PATH:'C:\\Windows\\system32;C:\\Windows;C:\\Windows\\System32\\Wbem;C:\\Program Files\\Python314;C:\\Program Files\\nodejs;C:\\Program Files\\Git\\cmd',PATHEXT:'.COM;.EXE;.BAT;.CMD;.PS1;.PY',PROCESSOR_ARCHITECTURE:'AMD64',NUMBER_OF_PROCESSORS:'8',COMSPEC:'C:\\Windows\\system32\\cmd.exe',PROMPT:'$P$G',CD:()=>pathDisplay(t.os,t.cwd),DATE:()=>now.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}),TIME:()=>now.toLocaleTimeString('de-DE')+','+pad2(Math.floor(now.getMilliseconds()/10)),RANDOM:()=>String(Math.floor(Math.random()*32768)),ERRORLEVEL:()=>String(t.lastCode||0)}}
  expandPsVars(v,t){
    return v.replace(/\$env:([A-Za-z_]\w*)|\$\{?([A-Za-z_?]\w*)\}?/gi,(m,envName,name)=>{
      if(envName){const env=this.winEnv(t);const key=Object.keys(env).find(k=>k.toLowerCase()===envName.toLowerCase());const tv=t.vars[envName.toUpperCase()];return tv??(key?(typeof env[key]==='function'?env[key]():env[key]):'')}
      const n=name.toLowerCase();
      if(n==='home')return'C:\\Users\\Student';if(n==='pwd')return pathDisplay(t.os,t.cwd);if(n==='true')return'True';if(n==='false')return'False';if(n==='null')return'';
      if(n==='lastexitcode')return String(t.lastCode||0);if(n==='?')return t.lastCode?'False':'True';if(n==='host')return'System.Management.Automation.Internal.Host.InternalHost';
      if(n==='psversiontable')return'@{PSVersion=5.1.26100.2605; PSEdition=Desktop}';
      return t.vars['$'+n]??'';
    });
  }
  arith(expr,t){
    const replaced=expr.replace(/\$?([A-Za-z_]\w*)/g,(_,n)=>String(Number(this.varValue(n,t))||0));
    if(!/^[\d\s+\-*/%()<>=!&|]+$/.test(replaced))return'0';
    try{return String(Math.trunc(Number(Function(`return (${replaced.replace(/\//g,'/')})`)())))}catch{return'0'}
  }
  // ---------- Dispatch ----------
  async dispatch(argv,t,io){
    const win=isWindows(t.os),ps=t.shell==='powershell',cmdShell=t.shell==='cmd';
    if(ps&&argv[0]==='&')argv=argv.slice(1);
    let name=argv[0];
    if(!win&&t.aliases[name]&&!t.noAlias){const expanded=t.aliases[name].split(/\s+/);argv=[...expanded,...argv.slice(1)];name=argv[0]}
    const lower=name.toLowerCase();
    const ctx=this.context(argv,t,io);
    if(lower==='deactivate'&&t.venv){venvDeactivate(t);return 0}
    if(ps){const cmdlet=PS_ALIASES[lower]||PS_CMDLETS.find(c=>c.toLowerCase()===lower);if(cmdlet&&this.ps[cmdlet])return this.ps[cmdlet].call(this,ctx)}
    const unixShell=['bash','sh','zsh'].includes(t.shell);
    if((win&&!unixShell)||cmdShell){
      if(cmdShell||ps){const handler=this.cmd[lower]||this.cmd[lower.replace(/\.exe$/,'')];if(handler&&(cmdShell||PS_PASSTHRU.has(lower.replace(/\.exe$/,''))))return handler.call(this,ctx)}
    }else{const handler=this.unix[name];if(handler)return handler.call(this,ctx)}
    if(this.programs.has(lower.replace(/\.exe$/,''),t))return this.programs.run(lower.replace(/\.exe$/,''),ctx);
    const file=this.resolveExecutable(name,t);if(file)return this.programs.runFile(file,ctx);
    return this.notFound(name,t,io);
  }
  context(argv,t,io){
    const engine=this;
    const ctx={argv,args:argv.slice(1),name:argv[0],t,io,engine,app:this.app,fs:this.fs,os:t.os,win:isWindows(t.os),
      out:s=>io.out(s),err:s=>io.err(s),println:s=>io.out(s+'\n'),stdin:io.stdin,
      readLine:()=>{if(io.stdin!==null&&io.stdin!==undefined){if(ctx._lines===undefined)ctx._lines=String(io.stdin).split(/(?<=\n)/);const l=ctx._lines.shift();return Promise.resolve(l===undefined?null:l.replace(/\r?\n$/,''))}return io.readLine()},
      async input(){if(io.stdin!==null&&io.stdin!==undefined)return String(io.stdin);let all='';for(;;){const l=await io.readLine();if(l===null||t.cancelled)break;all+=l+'\n'}return all},
      flags(spec=''){const set=new Set(),rest=[];for(const a of ctx.args){if(/^-[A-Za-z]+$/.test(a)&&!/^-\d/.test(a))for(const c of a.slice(1))set.add(c);else if(a.startsWith('--'))set.add(a);else rest.push(a)}return{set,rest}},
      abs:p=>engine.fs.normalize(p,t.cwd),
      signal:{cancelled:false,onCancel:null}
    };
    return ctx;
  }
  resolveExecutable(name,t){
    const fs=this.fs,win=(isWindows(t.os)&&!['bash','sh','zsh'].includes(t.shell))||t.shell==='cmd';
    if(win){const exts=['','.exe','.bat','.cmd','.ps1','.com'];for(const ext of exts){const p=name+ext;const node=fs.locate(p,t.cwd);if(node?.type==='file'&&(ext||/\.(exe|bat|cmd|ps1|com|py)$/i.test(name)))return fs.normalize(p,t.cwd)}
      if(/^[A-Za-z]:\\|^\\/.test(name)||name.includes('\\')){const node=fs.locate(name,t.cwd);if(node?.type==='file')return fs.normalize(name,t.cwd)}return null}
    if(name.includes('/')){const node=fs.locate(name,t.cwd);if(node)return fs.normalize(name,t.cwd);return'missing:'+name}
    return null;
  }
  notFound(name,t,io){
    const os=t.os;
    if(t.shell==='powershell'){io.err(`${C.red}${name} : Die Benennung "${name}" wurde nicht als Name eines Cmdlet, einer Funktion, einer Skriptdatei oder eines ausführbaren Programms erkannt. Überprüfen Sie die Schreibweise des Namens, oder ob der Pfad korrekt ist (sofern enthalten), und wiederholen Sie den Vorgang.\nIn Zeile:1 Zeichen:1\n+ ${name}\n+ ${'~'.repeat(name.length)}\n    + CategoryInfo          : ObjectNotFound: (${name}:String) [], CommandNotFoundException\n    + FullyQualifiedErrorId : CommandNotFoundException\n${C.reset}`);return 1}
    if(t.shell==='cmd'){io.err(`Der Befehl "${name}" ist entweder falsch geschrieben oder\nkonnte nicht gefunden werden.\n`);return 9009}
    if(os==='macos'){io.err(`zsh: command not found: ${name}\n`);return 127}
    if(os==='unix'){io.err(`sh: ${name}: nicht gefunden\n`);return 127}
    const pkg=INSTALLABLE[name];
    if(os==='debian'&&pkg){io.err(`Der Befehl »${name}« wurde nicht gefunden, kann aber installiert werden mit:\nsudo apt install ${pkg.apt||name}\n`);return 127}
    if(os==='debian'&&(name==='sl'||name==='ls-'))return 127;
    io.err(`bash: ${name}: Befehl nicht gefunden\n`);
    if(['dir','cls','ipconfig','type','copy','del','md'].includes(name.toLowerCase()))io.err(`${C.gray}Hinweis: »${name}« ist ein Windows-Befehl. Unter Linux heißt er ${({dir:'ls',cls:'clear',ipconfig:'ip a',type:'cat',copy:'cp',del:'rm',md:'mkdir'})[name.toLowerCase()]}.${C.reset}\n`);
    return 127;
  }
  noSuchFile(t,path){if(t.shell==='cmd')return'Das System kann die angegebene Datei nicht finden.\n';if(t.shell==='powershell')return`${C.red}Der Pfad "${pathDisplay(t.os,this.fs.normalize(path,t.cwd))}" kann nicht gefunden werden, da er nicht vorhanden ist.${C.reset}\n`;return`${t.shell}: ${path}: Datei oder Verzeichnis nicht gefunden\n`}
  unixErr(ctx,cmd,path,what='Datei oder Verzeichnis nicht gefunden'){ctx.err(`${cmd}: ${path?`'${path}'`:''}${path?': ':''}${what}\n`);return 1}
  // ---------- Hilfen für Listen ----------
  columns(names,t,colorFor){
    if(!names.length)return'';const width=Math.max(...names.map(n=>n.length))+2;const cols=Math.max(1,Math.floor((t.cols||90)/width));const rows=Math.ceil(names.length/cols);const lines=[];
    for(let r=0;r<rows;r++){let line='';for(let c=0;c<cols;c++){const i=c*rows+r;if(i>=names.length)break;const n=names[i];const last=c===cols-1||(c+1)*rows+r>=names.length;line+=(colorFor?colorFor(n,i):n)+(last?'':' '.repeat(width-n.length))}lines.push(line)}
    return lines.join('\n')+'\n';
  }
  procList(t){
    const base=isWindows(t.os)?[['System',4,'0,1 MB'],['Registry',120,'48,2 MB'],['smss.exe',412,'1,1 MB'],['csrss.exe',612,'5,3 MB'],['wininit.exe',704,'6,9 MB'],['services.exe',788,'10,4 MB'],['lsass.exe',812,'21,6 MB'],['svchost.exe',944,'32,0 MB'],['dwm.exe',1180,'98,5 MB'],['explorer.exe',4512,'142,3 MB']]:
      [['systemd',1],['kthreadd',2],['systemd-journal',312],['systemd-udevd',345],['dbus-daemon',612],['NetworkManager',640],[t.os==='arch'?'plasmashell':t.os==='macos'?'WindowServer':'gnome-shell',1402],[t.os==='macos'?'Finder':'Xwayland',1460],['pipewire',1510]];
    const wins=[...(this.app.windows?.values?.()||[])].map((w,i)=>[w.kind==='terminal'?(isWindows(t.os)?(w.terminal?.shell==='powershell'?'powershell.exe':'cmd.exe'):(t.os==='macos'?'Terminal':t.os==='arch'?'konsole':'gnome-terminal')):w.kind==='files'?(isWindows(t.os)?'explorer.exe':t.os==='macos'?'Finder':'nautilus'):w.kind+(isWindows(t.os)?'.exe':''),5000+w.id*7,'',w.id]);
    return{base,wins};
  }
}

// ======================= Unix-Befehle =======================
const UNIX_BUILTINS=['alias','basename','cal','cat','cd','chmod','chown','clear','cp','cut','date','df','diff','dirname','du','echo','env','exit','export','expr','false','file','find','free','grep','head','help','history','hostname','id','kill','killall','less','ln','logout','ls','lsb_release','man','mkdir','more','mv','nl','printenv','printf','ps','pwd','read','readlink','realpath','reboot','rev','rm','rmdir','sed','seq','shutdown','sleep','sort','source','stat','su','sudo','tail','tee','test','top','touch','tr','tree','true','type','uname','uniq','unalias','unset','uptime','wc','which','whoami','xargs','yes','[','groups','w','who','ip','ifconfig','ping','neofetch','fastfetch','htop','poweroff','hostnamectl','systemctl','journalctl','lsblk','lscpu','sw_vers','pbcopy','say','dmesg','last','passwd','umask','jobs','fg','bg','time','watch','column','nano','vim','vi','sh','bash','zsh'];
TerminalEngine.prototype.unix={
  async help(ctx){ctx.out(shellHelp(ctx.os)+'\n');return 0},
  async man(ctx){return ctx.engine.programs.man(ctx)},
  async clear(ctx){if(ctx.t.io?.clear)ctx.t.io.clear();else ctx.out('__CLEAR__');return 0},
  async history(ctx){if(ctx.args[0]==='-c'){ctx.t.history.length=0;return 0}ctx.out(ctx.t.history.map((v,i)=>`${String(i+1).padStart(5)}  ${v}`).join('\n')+'\n');return 0},
  async exit(ctx){throw new ExitShell(Number(ctx.args[0]??ctx.t.lastCode)||0)},
  async logout(ctx){throw new ExitShell(0)},
  async true(){return 0},async false(){return 1},
  async pwd(ctx){ctx.out(ctx.t.cwd+'\n');return 0},
  async cd(ctx){
    const t=ctx.t;let target=ctx.args[0];
    if(!target||target==='~')target=homePath(t.os);else if(target==='-'){target=t.prevCwd;ctx.out(target+'\n')}
    const path=ctx.fs.normalize(target,t.cwd),node=ctx.fs.locate(path);
    if(!node){ctx.err(`${t.shell==='zsh'?'cd: no such file or directory: '+ctx.args[0]:`${t.shell}: cd: ${ctx.args[0]}: Datei oder Verzeichnis nicht gefunden`}\n`);return 1}
    if(node.type!=='dir'){ctx.err(`${t.shell}: cd: ${ctx.args[0]}: Ist kein Verzeichnis\n`);return 1}
    t.prevCwd=t.cwd;t.cwd=ctx.fs.realPath(path);return 0;
  },
  async ls(ctx){
    const{set,rest}=ctx.flags();const fs=ctx.fs,t=ctx.t;const all=set.has('a'),almost=set.has('A'),long=set.has('l'),human=set.has('h'),one=set.has('1'),classify=set.has('F'),recursive=set.has('R'),byTime=set.has('t'),bySize=set.has('S'),reverse=set.has('r');
    const piped=Boolean(ctx.io.piped);
    const color=!piped&&(ctx.os==='debian'||ctx.os==='arch'||set.has('G')||set.has('--color'));
    const paint=(e)=>{const exec=e.type==='file'&&(e.mode&0o111);const n=e.name+(classify?(e.type==='dir'?'/':exec?'*':''):'');if(!color)return n;if(e.type==='dir')return C.bblue+n+C.reset;if(exec)return C.bgreen+n+C.reset;if(/\.(zip|tar|gz|deb|rpm)$/.test(e.name))return C.red+'\x1b[1m'+n+C.reset;if(/\.(png|jpe?g|gif|svg)$/.test(e.name))return C.magenta+'\x1b[1m'+n+C.reset;return n};
    const targets=rest.length?rest:['.'];let code=0;const outputs=[];
    const listDir=(path,label)=>{
      let entries=fs.list(path,t.cwd);if(!all&&!almost)entries=entries.filter(e=>!e.name.startsWith('.'));
      if(all)entries=[{name:'.',type:'dir',size:4096,mtime:fs.stat(path,t.cwd).mtime,mode:0o755},{name:'..',type:'dir',size:4096,mtime:Date.now()-86400000,mode:0o755},...entries];
      entries.sort((a,b)=>byTime?b.mtime-a.mtime:bySize?b.size-a.size:a.name.replace(/^\./,'').localeCompare(b.name.replace(/^\./,''),'de',{sensitivity:'base'}));if(reverse)entries.reverse();
      if(path==='/usr/bin'||path==='/bin'){const cmds=ctx.engine.getCommands(t).filter(c=>/^[a-z][\w+.-]*$/.test(c)).map(c=>({name:c,type:'file',size:14328+c.length*977,mtime:Date.parse('2026-08-01'),mode:0o755}));entries=[...entries,...cmds].filter((e,i,a)=>a.findIndex(x=>x.name===e.name)===i)}
      let text='';if(label)text+=label+':\n';
      if(long){const total=entries.reduce((n,e)=>n+Math.ceil((e.type==='dir'?4096:e.size)/1024),0);text+=`insgesamt ${total}\n`;const sizes=entries.map(e=>e.type==='dir'?(human?'4,0K':'4096'):human?humanSize(e.size):String(e.size));const w=Math.max(...sizes.map(s=>s.length),1);const group=ctx.os==='macos'?'staff':'student';
        if(ctx.os==='macos')text=text.replace(/^insgesamt/m,'total');
        text+=entries.map((e,i)=>`${modeString(e.type,e.mode)} ${e.type==='dir'?2:1} ${ctx.os==='macos'?'student  '+group+' ':'student '+group+' '} ${sizes[i].padStart(w)} ${lsDate(e.mtime)} ${paint(e)}${e.enc==='wasm'&&!color?'':''}`).join('\n')+(entries.length?'\n':'')}
      else if(one||piped)text+=entries.map(paint).join('\n')+(entries.length?'\n':'');
      else text+=ctx.engine.columns(entries.map(e=>e.name+(classify?(e.type==='dir'?'/':(e.mode&0o111)?'*':''):'')),t,(n,i)=>paint(entries[i]));
      outputs.push(text);
      if(recursive)for(const e of entries)if(e.type==='dir'&&e.name!=='.'&&e.name!=='..')listDir(joinPath(fs.normalize(path,t.cwd),e.name),joinPath(fs.normalize(path,t.cwd),e.name));
    };
    for(const p of targets){const node=fs.locate(p,t.cwd);if(!node){ctx.err(`ls: Zugriff auf '${p}' nicht möglich: Datei oder Verzeichnis nicht gefunden\n`);code=2;continue}
      if(node.type==='file'){const st=fs.stat(p,t.cwd);outputs.push(long?`${modeString('file',st.mode)} 1 student student ${human?humanSize(st.size):st.size} ${lsDate(st.mtime)} ${p}\n`:p+'\n');continue}
      listDir(p,targets.length>1||recursive?(recursive&&p==='.'?'.':p):null)}
    // Pipe-Erkennung: in Pipes eine Datei pro Zeile ausgeben (wie echtes ls)
    ctx.out(outputs.join('\n'));return code;
  },
  async mkdir(ctx){const{set,rest}=ctx.flags();if(!rest.length){ctx.err('mkdir: Fehlender Operand\n„mkdir --help“ gibt weitere Informationen.\n');return 1}let code=0;for(const p of rest){try{if(!set.has('p')&&ctx.fs.exists(p,ctx.t.cwd)){ctx.err(`mkdir: das Verzeichnis »${p}« kann nicht angelegt werden: Die Datei existiert bereits\n`);code=1;continue}ctx.fs.mkdir(p,ctx.t.cwd,set.has('p'));if(set.has('v'))ctx.out(`mkdir: Verzeichnis '${p}' angelegt\n`)}catch(e){ctx.err(`mkdir: das Verzeichnis »${p}« kann nicht angelegt werden: Datei oder Verzeichnis nicht gefunden\n`);code=1}}ctx.app.notifyFiles?.();return code},
  async rmdir(ctx){let code=0;for(const p of ctx.args){try{const node=ctx.fs.locate(p,ctx.t.cwd);if(!node)throw Error('nf');if(node.type!=='dir'){ctx.err(`rmdir: Entfernen von '${p}' fehlgeschlagen: Ist kein Verzeichnis\n`);code=1;continue}ctx.fs.remove(p,ctx.t.cwd,false)}catch(e){ctx.err(`rmdir: Entfernen von '${p}' fehlgeschlagen: ${/nicht leer/.test(e.message)?'Das Verzeichnis ist nicht leer':'Datei oder Verzeichnis nicht gefunden'}\n`);code=1}}ctx.app.notifyFiles?.();return code},
  async touch(ctx){if(!ctx.args.length){ctx.err('touch: Fehlender Dateioperand\n');return 1}for(const p of ctx.args.filter(a=>!a.startsWith('-'))){try{if(ctx.fs.exists(p,ctx.t.cwd))ctx.fs.utime(p,ctx.t.cwd);else ctx.fs.write(p,'',ctx.t.cwd)}catch{ctx.err(`touch: '${p}' kann nicht berührt werden: Datei oder Verzeichnis nicht gefunden\n`);return 1}}ctx.app.notifyFiles?.();return 0},
  async rm(ctx){
    const{set,rest}=ctx.flags();const rec=set.has('r')||set.has('R')||set.has('--recursive'),force=set.has('f');if(!rest.length){if(force)return 0;ctx.err('rm: Fehlender Operand\n');return 1}let code=0;
    for(const p of rest){const node=ctx.fs.locate(p,ctx.t.cwd);if(!node){if(!force){ctx.err(`rm: das Entfernen von '${p}' ist nicht möglich: Datei oder Verzeichnis nicht gefunden\n`);code=1}continue}
      if(ctx.fs.normalize(p,ctx.t.cwd)==='/'){ctx.err("rm: es ist gefährlich, rekursiv auf '/' zu arbeiten\nrm: --no-preserve-root verwenden, um diese Sicherheitsmaßnahme zu umgehen\n");code=1;continue}
      if(node.type==='dir'&&!rec){ctx.err(`rm: das Entfernen von '${p}' ist nicht möglich: Ist ein Verzeichnis\n`);code=1;continue}
      if(set.has('i')){ctx.out(`rm: reguläre Datei '${p}' entfernen? `);const a=await ctx.readLine();if(!/^[yj]/i.test(a||''))continue}
      ctx.fs.remove(p,ctx.t.cwd,true);if(set.has('v'))ctx.out(`'${p}' wurde entfernt\n`)}
    ctx.app.notifyFiles?.();return code;
  },
  async cp(ctx){const{set,rest}=ctx.flags();if(rest.length<2){ctx.err(`cp: Fehlender Zieldatei-Operand hinter '${rest[0]||''}'\n`);return 1}const dest=rest.pop();let code=0;if(rest.length>1&&!ctx.fs.isDir(dest,ctx.t.cwd)){ctx.err(`cp: Ziel '${dest}' ist kein Verzeichnis\n`);return 1}
    for(const src of rest){try{ctx.fs.copy(src,dest,ctx.t.cwd,set.has('r')||set.has('R')||set.has('a'));if(set.has('v'))ctx.out(`'${src}' -> '${dest}'\n`)}catch(e){ctx.err(/ausgelassen/.test(e.message)?`cp: -r nicht angegeben; Verzeichnis '${src}' wird ausgelassen\n`:`cp: Aufruf von stat für '${src}' nicht möglich: Datei oder Verzeichnis nicht gefunden\n`);code=1}}ctx.app.notifyFiles?.();return code},
  async mv(ctx){const{set,rest}=ctx.flags();if(rest.length<2){ctx.err(`mv: Fehlender Zieldatei-Operand hinter '${rest[0]||''}'\n`);return 1}const dest=rest.pop();let code=0;for(const src of rest){try{ctx.fs.move(src,dest,ctx.t.cwd);if(set.has('v'))ctx.out(`umbenannt '${src}' -> '${dest}'\n`)}catch(e){ctx.err(`mv: Aufruf von stat für '${src}' nicht möglich: Datei oder Verzeichnis nicht gefunden\n`);code=1}}ctx.app.notifyFiles?.();return code},
  async ln(ctx){const{rest}=ctx.flags();if(rest.length<2){ctx.err('ln: Fehlender Dateioperand\n');return 1}try{ctx.fs.copy(rest[0],rest[1],ctx.t.cwd,true);ctx.out('');return 0}catch{ctx.err(`ln: Zugriff auf '${rest[0]}' nicht möglich: Datei oder Verzeichnis nicht gefunden\n`);return 1}},
  async cat(ctx){
    const{set,rest}=ctx.flags();const number=set.has('n');let code=0,text='';
    if(!rest.length||rest[0]==='-')text=await ctx.input();
    for(const p of rest.filter(a=>a!=='-')){const node=ctx.fs.locate(p,ctx.t.cwd);if(!node){ctx.err(`cat: ${p}: Datei oder Verzeichnis nicht gefunden\n`);code=1;continue}if(node.type==='dir'){ctx.err(`cat: ${p}: Ist ein Verzeichnis\n`);code=1;continue}text+=node.enc?binaryNoise(node):node.content}
    if(number){let i=0;text=text.replace(/\n$/,'').split('\n').map(l=>`${String(++i).padStart(6)}\t${l}`).join('\n')+'\n'}
    ctx.out(text);return code;
  },
  async less(ctx){return ctx.engine.unix.cat.call(this,ctx)},async more(ctx){return ctx.engine.unix.cat.call(this,ctx)},
  async nl(ctx){const t=await readInputs(ctx,ctx.args);if(t===null)return 1;let i=0;ctx.out(t.replace(/\n$/,'').split('\n').map(l=>l.trim()?`${String(++i).padStart(6)}\t${l}`:'').join('\n')+'\n');return 0},
  async tac(ctx){const t=await readInputs(ctx,ctx.args);if(t===null)return 1;ctx.out(t.replace(/\n$/,'').split('\n').reverse().join('\n')+'\n');return 0},
  async rev(ctx){const t=await readInputs(ctx,ctx.args);if(t===null)return 1;ctx.out(t.replace(/\n$/,'').split('\n').map(l=>[...l].reverse().join('')).join('\n')+'\n');return 0},
  async echo(ctx){let args=ctx.args,nl=true,esc=false;while(args[0]&&/^-[neE]+$/.test(args[0])){if(args[0].includes('n'))nl=false;if(args[0].includes('e'))esc=true;args=args.slice(1)}let s=args.join(' ');if(esc||ctx.os==='macos'&&ctx.t.shell==='zsh')s=unescape(s);ctx.out(s+(nl?'\n':''));return 0},
  async printf(ctx){if(!ctx.args.length){ctx.err('printf: Aufruf: printf FORMAT [ARGUMENT]...\n');return 2}let [fmt,...vals]=ctx.args;fmt=unescape(fmt);let out='',guard=0;do{let used=0;out+=fmt.replace(/%(-?\d*)(?:\.(\d+))?([sdifxc%])/g,(m,w,p,k)=>{if(k==='%')return'%';const v=vals[used++]??'';let s=k==='d'||k==='i'?String(Math.trunc(Number(v)||0)):k==='f'?(Number(v)||0).toFixed(p??6):k==='x'?(Number(v)||0).toString(16):k==='c'?String(v)[0]||'':String(v);const width=Number(w);if(width)s=width<0?s.padEnd(-width):s.padStart(width);return s});vals=vals.slice(used);if(!used)break}while(vals.length&&guard++<100);ctx.out(out);return 0},
  async head(ctx){return headTail(ctx,'head')},async tail(ctx){return headTail(ctx,'tail')},
  async wc(ctx){const{set,rest}=ctx.flags();const files=rest.length?rest:[null];const rows=[];let code=0;for(const f of files){let text;if(f===null)text=await ctx.input();else{try{text=ctx.fs.read(f,ctx.t.cwd)}catch{ctx.err(`wc: ${f}: Datei oder Verzeichnis nicht gefunden\n`);code=1;continue}}const l=(text.match(/\n/g)||[]).length,w=(text.match(/\S+/g)||[]).length,c=new TextEncoder().encode(text).length;const cols=[];if(set.has('l'))cols.push(l);if(set.has('w'))cols.push(w);if(set.has('c')||set.has('m'))cols.push(c);if(!cols.length)cols.push(l,w,c);rows.push([...cols,f??''])}
    const width=Math.max(...rows.flatMap(r=>r.slice(0,-1).map(v=>String(v).length)),1);ctx.out(rows.map(r=>r.slice(0,-1).map(v=>String(v).padStart(files[0]===null&&rows.length===1&&r.length===2?0:width)).join(' ')+(r.at(-1)?' '+r.at(-1):'')).join('\n')+'\n');return code},
  async grep(ctx){
    const args=[...ctx.args];const opts=new Set();let pattern=null;const files=[];
    while(args.length){const a=args.shift();if(a==='-e'){pattern=args.shift();continue}if(/^-[A-Za-z]+$/.test(a)&&pattern===null&&!files.length){for(const c of a.slice(1))opts.add(c);continue}if(a==='--color'||a==='--color=auto')continue;if(pattern===null)pattern=a;else files.push(a)}
    if(pattern===null){ctx.err('Aufruf: grep [OPTION]... MUSTER [DATEI]...\n„grep --help“ gibt weitere Informationen.\n');return 2}
    let rx;try{rx=new RegExp(opts.has('F')?pattern.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'):pattern.replace(/\\([|(){}+?])/g,'$1').replace(/\\</g,'\\b').replace(/\\>/g,'\\b'),opts.has('i')?'gi':'g')}catch{ctx.err('grep: Ungültiger regulärer Ausdruck\n');return 2}
    const color=ctx.os==='debian'||ctx.os==='arch';let found=0;const multi=files.length>1||opts.has('r');
    const scan=(text,label)=>{const lines=text.replace(/\n$/,'').split('\n');let count=0;lines.forEach((line,i)=>{rx.lastIndex=0;const hit=rx.test(line);if(hit===opts.has('v'))return;count++;found++;if(opts.has('c')||opts.has('l')||opts.has('q'))return;const shown=color&&!opts.has('v')?line.replace(rx,m=>`\x1b[1;31m${m}${C.reset}`):line;ctx.out(`${multi?(color?C.magenta+label+C.cyan+':'+C.reset:label+':'):''}${opts.has('n')?(color?C.green+(i+1)+C.cyan+':'+C.reset:(i+1)+':'):''}${shown}\n`)});if(opts.has('c'))ctx.out(`${multi?label+':':''}${count}\n`);if(opts.has('l')&&count)ctx.out(label+'\n')};
    if(!files.length){if(opts.has('r'))files.push('.');else{scan(await ctx.input(),'(Standardeingabe)');return found?0:1}}
    let code=0;const walk=p=>{const node=ctx.fs.locate(p,ctx.t.cwd);if(!node){ctx.err(`grep: ${p}: Datei oder Verzeichnis nicht gefunden\n`);code=2;return}if(node.type==='dir'){if(!opts.has('r')){ctx.err(`grep: ${p}: Ist ein Verzeichnis\n`);return}for(const e of ctx.fs.list(p,ctx.t.cwd))walk(p==='.'?e.name:joinPath(p,e.name));return}if(!node.enc)scan(node.content,p)};
    files.forEach(walk);return code||(found?0:1);
  },
  async sort(ctx){const{set,rest}=ctx.flags();const text=await readInputs(ctx,rest);if(text===null)return 2;let lines=text.replace(/\n$/,'').split('\n');if(!text)lines=[];const key=set.has('k')?null:null;lines.sort(set.has('n')?(a,b)=>parseFloat(a)-parseFloat(b):set.has('f')?(a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}):(a,b)=>a.localeCompare(b,'de'));if(set.has('r'))lines.reverse();if(set.has('u'))lines=lines.filter((l,i)=>lines.indexOf(l)===i);ctx.out(lines.length?lines.join('\n')+'\n':'');return 0},
  async uniq(ctx){const{set,rest}=ctx.flags();const text=await readInputs(ctx,rest);if(text===null)return 1;const lines=text.replace(/\n$/,'').split('\n');const groups=[];for(const l of lines){if(groups.length&&groups.at(-1)[0]===l)groups.at(-1)[1]++;else groups.push([l,1])}ctx.out(groups.filter(g=>set.has('d')?g[1]>1:set.has('u')?g[1]===1:true).map(([l,n])=>set.has('c')?`${String(n).padStart(7)} ${l}`:l).join('\n')+'\n');return 0},
  async cut(ctx){const args=[...ctx.args];let d='\t',f=null,c=null;const files=[];while(args.length){const a=args.shift();if(a.startsWith('-d'))d=a.length>2?a.slice(2):args.shift();else if(a.startsWith('-f'))f=a.length>2?a.slice(2):args.shift();else if(a.startsWith('-c'))c=a.length>2?a.slice(2):args.shift();else files.push(a)}if(!f&&!c){ctx.err('cut: Sie müssen eine Liste von Bytes, Zeichen oder Feldern angeben\n');return 1}const pick=(spec,max)=>{const s=new Set();for(const part of spec.split(',')){const[a,b]=part.split('-');const from=a?+a:1,to=part.includes('-')?(b?+b:max):from;for(let i=from;i<=to;i++)s.add(i)}return[...s].sort((x,y)=>x-y)};const text=await readInputs(ctx,files);if(text===null)return 1;ctx.out(text.replace(/\n$/,'').split('\n').map(l=>{if(c){const ch=[...l];return pick(c,ch.length).map(i=>ch[i-1]??'').join('')}if(!l.includes(d))return l;const parts=l.split(d);return pick(f,parts.length).map(i=>parts[i-1]).filter(v=>v!==undefined).join(d)}).join('\n')+'\n');return 0},
  async tr(ctx){const{set,rest}=ctx.flags();const text=await ctx.input();const expand=s=>unescape(s).replace(/\[:upper:\]/g,'A-Z').replace(/\[:lower:\]/g,'a-z').replace(/\[:digit:\]/g,'0-9').replace(/\[:space:\]/g,' \t\n').replace(/(.)-(.)/g,(m,a,b)=>{let o='';for(let i=a.charCodeAt(0);i<=b.charCodeAt(0);i++)o+=String.fromCharCode(i);return o});const a=[...expand(rest[0]||'')],b=[...expand(rest[1]||'')];if(set.has('d')){ctx.out([...text].filter(ch=>!a.includes(ch)).join(''));return 0}let out=[...text].map(ch=>{const i=a.indexOf(ch);return i<0?ch:(b[Math.min(i,b.length-1)]??ch)}).join('');if(set.has('s'))out=out.replace(new RegExp(`([${(b.length?b:a).join('').replace(/[\]\\^-]/g,'\\$&')}])\\1+`,'g'),'$1');ctx.out(out);return 0},
  async tee(ctx){const{set,rest}=ctx.flags();const text=await ctx.input();for(const f of rest)ctx.fs.write(f,text,ctx.t.cwd,set.has('a'));ctx.out(text);ctx.app.notifyFiles?.();return 0},
  async diff(ctx){const[a,b]=ctx.args.filter(x=>!x.startsWith('-'));let x,y;try{x=ctx.fs.read(a,ctx.t.cwd).split('\n');y=ctx.fs.read(b,ctx.t.cwd).split('\n')}catch{ctx.err(`diff: ${!ctx.fs.exists(a,ctx.t.cwd)?a:b}: Datei oder Verzeichnis nicht gefunden\n`);return 2}const out=diffLines(x,y);ctx.out(out);return out?1:0},
  async find(ctx){
    const args=[...ctx.args];const paths=[];while(args.length&&!args[0].startsWith('-'))paths.push(args.shift());if(!paths.length)paths.push('.');let name=null,iname=null,type=null,maxdepth=99;
    while(args.length){const a=args.shift();if(a==='-name')name=args.shift();else if(a==='-iname')iname=args.shift();else if(a==='-type')type=args.shift();else if(a==='-maxdepth')maxdepth=+args.shift()}
    const rx=name?globToRegExp(name):iname?globToRegExp(iname,true):null;let code=0;
    const walk=(p,depth)=>{const node=ctx.fs.locate(p,ctx.t.cwd);if(!node){ctx.err(`find: ‘${p}’: Datei oder Verzeichnis nicht gefunden\n`);code=1;return}const base=p.split('/').pop();if((!rx||rx.test(base))&&(!type||(type==='d')===(node.type==='dir')))ctx.out(p+'\n');if(node.type==='dir'&&depth<maxdepth)for(const e of ctx.fs.list(p,ctx.t.cwd))walk(p==='/'?'/'+e.name:joinPath(p,e.name),depth+1)};
    for(const p of paths)walk(p,0);return code;
  },
  async tree(ctx){const{set,rest}=ctx.flags();const root=rest[0]||'.';if(!ctx.fs.isDir(root,ctx.t.cwd)){ctx.err(`${root}  [error opening dir]\n`);return 2}let dirs=0,files=0;const color=ctx.os!=='macos'&&ctx.os!=='unix';const lines=[color?C.bblue+root+C.reset:root];const walk=(p,prefix,depth)=>{if(depth>8)return;let entries=ctx.fs.list(p,ctx.t.cwd).filter(e=>set.has('a')||!e.name.startsWith('.'));if(set.has('d'))entries=entries.filter(e=>e.type==='dir');entries.forEach((e,i)=>{const last=i===entries.length-1;lines.push(prefix+(last?'└── ':'├── ')+(e.type==='dir'&&color?C.bblue+e.name+C.reset:(color&&(e.mode&0o111)?C.bgreen+e.name+C.reset:e.name)));if(e.type==='dir'){dirs++;walk(joinPath(ctx.fs.normalize(p,ctx.t.cwd),e.name),prefix+(last?'    ':'│   '),depth+1)}else files++})};walk(root,'',0);ctx.out(lines.slice(0,500).join('\n')+`\n\n${dirs} ${dirs===1?'directory':'directories'}${set.has('d')?'':`, ${files} ${files===1?'file':'files'}`}\n`);return 0},
  async chmod(ctx){const[spec,...files]=ctx.args.filter(a=>a!=='-R');if(!spec||!files.length){ctx.err('chmod: Fehlender Operand\n');return 1}let code=0;for(const f of files){let st;try{st=ctx.fs.stat(f,ctx.t.cwd)}catch{ctx.err(`chmod: Zugriff auf '${f}' nicht möglich: Datei oder Verzeichnis nicht gefunden\n`);code=1;continue}let mode=st.mode;if(/^[0-7]{3,4}$/.test(spec))mode=parseInt(spec,8);else for(const clause of spec.split(',')){const m=clause.match(/^([ugoa]*)([+\-=])([rwx]*)$/);if(!m){ctx.err(`chmod: ungültiger Modus: »${spec}«\n`);return 1}const who=m[1]||'a';let bits=0;for(const p of m[3])bits|=p==='r'?4:p==='w'?2:1;let mask=0;if(/[ua]/.test(who))mask|=bits<<6;if(/[ga]/.test(who))mask|=bits<<3;if(/[oa]/.test(who))mask|=bits;if(m[2]==='+')mode|=mask;else if(m[2]==='-')mode&=~mask;else mode=mask}ctx.fs.chmod(f,mode,ctx.t.cwd)}ctx.app.notifyFiles?.();return code},
  async chown(ctx){if(!ctx.t.admin){ctx.err(`chown: Ändern des Eigentümers von '${ctx.args.at(-1)}': Die Operation ist nicht erlaubt\n`);return 1}return 0},
  async stat(ctx){let code=0;for(const f of ctx.args){let st;try{st=ctx.fs.stat(f,ctx.t.cwd)}catch{ctx.err(`stat: Aufruf von stat für '${f}' nicht möglich: Datei oder Verzeichnis nicht gefunden\n`);code=1;continue}const d=new Date(st.mtime).toISOString().replace('T',' ').replace('Z',' +0000');ctx.out(`  Datei: ${f}\n  Größe: ${st.size}\t\tBlöcke: ${Math.ceil(st.size/512)*8}\tEA Block: 4096\t${st.type==='dir'?'Verzeichnis':st.size?'reguläre Datei':'reguläre leere Datei'}\nGerät: 8/1\tInode: ${1000+f.length*31}\tVerknüpfungen: 1\nZugriff: (${(st.mode).toString(8).padStart(4,'0')}/${modeString(st.type,st.mode)})  Uid: ( 1000/ student)   Gid: ( 1000/ student)\nZugriff: ${d}\nModifiziert: ${d}\nGeändert: ${d}\n`)}return code},
  async file(ctx){for(const f of ctx.args){const node=ctx.fs.locate(f,ctx.t.cwd);if(!node){ctx.out(`${f}: cannot open \`${f}' (No such file or directory)\n`);continue}ctx.out(`${f}: ${describeFile(f,node)}\n`)}return 0},
  async du(ctx){const{set,rest}=ctx.flags();const p=rest[0]||'.';const size=path=>{const node=ctx.fs.locate(path,ctx.t.cwd);if(!node)return 0;if(node.type==='file')return ctx.fs.sizeOf(node);return 4096+Object.keys(node.children).reduce((n,k)=>n+size(joinPath(ctx.fs.normalize(path,ctx.t.cwd),k)),0)};if(!ctx.fs.exists(p,ctx.t.cwd)){ctx.err(`du: Zugriff auf '${p}' nicht möglich: Datei oder Verzeichnis nicht gefunden\n`);return 1}const fmt=b=>set.has('h')?humanSize(b):String(Math.ceil(b/1024));if(!set.has('s')&&ctx.fs.isDir(p,ctx.t.cwd))for(const e of ctx.fs.list(p,ctx.t.cwd).filter(e=>e.type==='dir'))ctx.out(`${fmt(size(joinPath(ctx.fs.normalize(p,ctx.t.cwd),e.name)))}\t${p==='.'?'./'+e.name:joinPath(p,e.name)}\n`);ctx.out(`${fmt(size(p))}\t${p}\n`);return 0},
  async df(ctx){const h=ctx.args.includes('-h');const fmt=k=>h?humanSize(k*1024):String(k);ctx.out(`Dateisystem    ${h?'Größe Benutzt Verf.':'1K-Blöcke  Benutzt Verfügbar'} Verw% Eingehängt auf\n/dev/vda2      ${[61255492,18233104,39878800].map(v=>fmt(v).padStart(h?5:9)).join(' ')}   32% /\ntmpfs          ${[8126436,0,8126436].map(v=>fmt(v).padStart(h?5:9)).join(' ')}    0% /tmp\n/dev/vda1      ${[523248,6220,517028].map(v=>fmt(v).padStart(h?5:9)).join(' ')}    2% /boot/efi\n`);return 0},
  async free(ctx){const h=ctx.args.includes('-h');const mem=performance?.memory;const used=mem?Math.round(mem.usedJSHeapSize/1024):2412300;const v=k=>h?humanSize(k*1024).replace(' ',''):String(k);ctx.out(`               gesamt     benutzt     frei     gemns.  Puffer/Cache verfügbar\nSpeicher:  ${[16252872,used+1800000,9810220,412000,4030352,13650000].map(x=>v(x).padStart(10)).join(' ')}\nAuslager:  ${[2097148,0,2097148].map(x=>v(x).padStart(10)).join(' ')}\n`);return 0},
  async uptime(ctx){const up=Math.floor((Date.now()-(ctx.app.bootTime||ctx.t.started))/60000);const now=new Date();ctx.out(` ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())} up ${up<60?up+' min':Math.floor(up/60)+':'+pad2(up%60)},  1 user,  load average: 0,${String(Math.floor(Math.random()*60)).padStart(2,'0')}, 0,24, 0,11\n`);return 0},
  async whoami(ctx){ctx.out((ctx.t.admin?'root':'student')+'\n');return 0},
  async id(ctx){ctx.out(ctx.t.admin?'uid=0(root) gid=0(root) Gruppen=0(root)\n':ctx.os==='macos'?'uid=501(student) gid=20(staff) groups=20(staff),12(everyone),80(admin)\n':`uid=1000(student) gid=1000(student) Gruppen=1000(student),${ctx.os==='arch'?'998(wheel)':'27(sudo)'},100(users)\n`);return 0},
  async groups(ctx){ctx.out(ctx.os==='arch'?'student wheel users\n':'student sudo users\n');return 0},
  async who(ctx){const d=new Date(ctx.app.bootTime||Date.now());ctx.out(`student  tty2         ${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())} (tty2)\n`);return 0},
  async w(ctx){await ctx.engine.unix.uptime.call(this,ctx);ctx.out('USER     TTY      VON              LOGIN@   IDLE   JCPU   PCPU WHAT\nstudent  tty2     tty2             08:00    0.00s  0.12s  0.01s w\n');return 0},
  async last(ctx){ctx.out('student  tty2         tty2             Mon Nov 16 08:00   still logged in\nreboot   system boot  6.12.48          Mon Nov 16 07:59   still running\n\nwtmp beginnt Mon Nov  2 09:14:01 2026\n');return 0},
  async hostname(ctx){ctx.out(hostName(ctx.os)+'\n');return 0},
  async hostnamectl(ctx){ctx.out(` Static hostname: ${hostName(ctx.os)}\n       Icon name: computer-vm\n         Chassis: vm 🖴\n      Machine ID: 5f2c9d1e8a7b4c3d9e0f1a2b3c4d5e6f\n         Boot ID: a1b2c3d4e5f60718293a4b5c6d7e8f90\n  Virtualization: browser\nOperating System: ${ctx.os==='debian'?'Debian GNU/Linux 13 (trixie)':'Arch Linux'}\n          Kernel: Linux ${unixNames[ctx.os]?.[2]}\n    Architecture: x86-64\n`);return 0},
  async uname(ctx){const{set}=ctx.flags();const u=unixNames[ctx.os];if(set.has('a')){ctx.out(u.filter(Boolean).join(' ')+'\n');return 0}const parts=[];if(set.has('s')||!set.size)parts.push(u[0]);if(set.has('n'))parts.push(u[1]);if(set.has('r'))parts.push(u[2]);if(set.has('v'))parts.push(u[3]);if(set.has('m'))parts.push(u[4]);if(set.has('o'))parts.push(u[5]||u[0]);ctx.out(parts.join(' ')+'\n');return 0},
  async lsb_release(ctx){if(ctx.os==='macos'||ctx.os==='unix')return ctx.engine.notFound('lsb_release',ctx.t,ctx.io);ctx.out(ctx.os==='debian'?'No LSB modules are available.\nDistributor ID:\tDebian\nDescription:\tDebian GNU/Linux 13 (trixie)\nRelease:\t13\nCodename:\ttrixie\n':'LSB Version:\t1.4\nDistributor ID:\tArch\nDescription:\tArch Linux\nRelease:\trolling\nCodename:\tn/a\n');return 0},
  async sw_vers(ctx){if(ctx.os!=='macos')return ctx.engine.notFound('sw_vers',ctx.t,ctx.io);ctx.out('ProductName:\t\tmacOS\nProductVersion:\t\t26.1\nBuildVersion:\t\t25B78\n');return 0},
  async date(ctx){const d=new Date();const f=ctx.args.find(a=>a.startsWith('+'));if(f){ctx.out(f.slice(1).replace(/%([a-zA-Z%])/g,(m,k)=>({Y:d.getFullYear(),m:pad2(d.getMonth()+1),d:pad2(d.getDate()),H:pad2(d.getHours()),M:pad2(d.getMinutes()),S:pad2(d.getSeconds()),A:DAYS[d.getDay()],a:DAYS[d.getDay()].slice(0,2),B:d.toLocaleDateString('de-DE',{month:'long'}),b:MONTHS[d.getMonth()],j:String(Math.ceil((d-new Date(d.getFullYear(),0,1))/864e5)).padStart(3,'0'),s:Math.floor(d/1000),F:`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`,T:`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,'%':'%'})[k]??m)+'\n');return 0}
    ctx.out(`${DAYS[d.getDay()].slice(0,2)} ${String(d.getDate()).padStart(2)}. ${MONTHS[d.getMonth()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} CET ${d.getFullYear()}\n`);return 0},
  async cal(ctx){const d=new Date();const y=d.getFullYear(),m=d.getMonth();const title=d.toLocaleDateString('de-DE',{month:'long',year:'numeric'});let out=title.padStart(Math.floor((20+title.length)/2)).padEnd(20)+'\nMo Di Mi Do Fr Sa So\n';const first=(new Date(y,m,1).getDay()+6)%7;const days=new Date(y,m+1,0).getDate();let line='   '.repeat(first);for(let i=1;i<=days;i++){const s=String(i).padStart(2);line+=(i===d.getDate()?'\x1b[7m'+s+C.reset:s)+' ';if((first+i)%7===0){out+=line.trimEnd()+'\n';line=''}}if(line)out+=line.trimEnd()+'\n';ctx.out(out);return 0},
  async sleep(ctx){const s=parseFloat(ctx.args[0]);if(isNaN(s)){ctx.err('sleep: Fehlender Operand\n');return 1}const sig={};ctx.t.cancelHooks?.add(()=>sig.onCancel?.());await sleep(Math.min(s,600)*1000,sig);return ctx.t.cancelled?130:0},
  async seq(ctx){const n=ctx.args.filter(a=>!a.startsWith('-s')).map(Number);let[a,step,b]=n.length===1?[1,1,n[0]]:n.length===2?[n[0],1,n[1]]:n;const out=[];for(let i=a;step>0?i<=b:i>=b;i+=step){out.push(i);if(out.length>100000)break}ctx.out(out.join('\n')+(out.length?'\n':''));return 0},
  async yes(ctx){const w=ctx.args.join(' ')||'y';ctx.out((w+'\n').repeat(200));ctx.err('yes: nach 200 Zeilen gestoppt (Simulation)\n');return 0},
  async basename(ctx){const[p,suf]=ctx.args;let b=String(p||'').replace(/\/+$/,'').split('/').pop();if(suf&&b.endsWith(suf))b=b.slice(0,-suf.length);ctx.out(b+'\n');return 0},
  async dirname(ctx){const p=String(ctx.args[0]||'').replace(/\/+$/,'');ctx.out((p.includes('/')?p.replace(/\/[^/]*$/,'')||'/':'.')+'\n');return 0},
  async realpath(ctx){for(const p of ctx.args)ctx.out(ctx.fs.normalize(p,ctx.t.cwd)+'\n');return 0},async readlink(ctx){return ctx.engine.unix.realpath.call(this,ctx)},
  async env(ctx){const t=ctx.t;const base=['HOME','USER','LOGNAME','SHELL','PWD','PATH','LANG','TERM','EDITOR','HOSTNAME'];const lines=base.map(k=>`${k}=${ctx.engine.varValue(k,t)}`).concat(Object.entries(t.vars).filter(([k])=>t.exported?.has(k)).map(([k,v])=>`${k}=${v}`));ctx.out(lines.join('\n')+'\n');return 0},
  async printenv(ctx){if(ctx.args[0]){const v=ctx.engine.varValue(ctx.args[0],ctx.t);if(v===undefined)return 1;ctx.out(v+'\n');return 0}return ctx.engine.unix.env.call(this,ctx)},
  async export(ctx){const t=ctx.t;t.exported??=new Set();if(!ctx.args.length||ctx.args[0]==='-p'){for(const[k,v]of Object.entries(t.vars).filter(([k])=>t.exported.has(k)))ctx.out(`declare -x ${k}="${v}"\n`);return 0}for(const a of ctx.args){const i=a.indexOf('=');const k=i<0?a:a.slice(0,i);if(i>=0)t.vars[k]=a.slice(i+1);t.exported.add(k)}return 0},
  async unset(ctx){for(const a of ctx.args)delete ctx.t.vars[a];return 0},
  async set(ctx){ctx.out(Object.entries(ctx.t.vars).map(([k,v])=>`${k}='${v}'`).join('\n')+'\n');return 0},
  async alias(ctx){const t=ctx.t;if(!ctx.args.length){ctx.out(Object.entries(t.aliases).map(([k,v])=>`alias ${k}='${v}'`).join('\n')+'\n');return 0}for(const a of ctx.args){const i=a.indexOf('=');if(i<0){if(t.aliases[a])ctx.out(`alias ${a}='${t.aliases[a]}'\n`);else{ctx.err(`${t.shell}: alias: ${a}: nicht gefunden\n`);return 1}}else t.aliases[a.slice(0,i)]=a.slice(i+1)}return 0},
  async unalias(ctx){for(const a of ctx.args)delete ctx.t.aliases[a];return 0},
  async read(ctx){const args=[...ctx.args];let prompt='';const names=[];while(args.length){const a=args.shift();if(a==='-p')prompt=args.shift()||'';else if(a==='-r'||a==='-s')continue;else names.push(a)}if(prompt)ctx.out(prompt);const line=await ctx.readLine();if(line===null)return 1;const parts=line.split(/\s+/);if(!names.length)names.push('REPLY');names.forEach((n,i)=>{ctx.t.vars[n]=i===names.length-1?parts.slice(i).join(' '):parts[i]??''});return 0},
  async test(ctx){return evalTest(ctx.args,ctx)?0:1},
  async '['(ctx){if(ctx.args.at(-1)!==']'){ctx.err(`${ctx.t.shell}: [: »]« fehlt\n`);return 2}return evalTest(ctx.args.slice(0,-1),ctx)?0:1},
  async expr(ctx){const s=ctx.args.join(' ');if(!/^[\d\s+\-*/%()]+$/.test(s)){ctx.err('expr: Syntaxfehler\n');return 2}const v=Math.trunc(Function(`return (${s.replace(/\//g,'/')})`)());ctx.out(v+'\n');return v===0?1:0},
  async type(ctx){for(const n of ctx.args){if(ctx.t.aliases[n])ctx.out(`${n} ist ein Alias von »${ctx.t.aliases[n]}«\n`);else if(['cd','echo','exit','export','alias','read','test','pwd','history','type','source','set','unset','true','false'].includes(n))ctx.out(`${n} ist eine von der Shell mitgelieferte Funktion.\n`);else if(ctx.engine.getCommands(ctx.t).includes(n))ctx.out(`${n} ist /usr/bin/${n}\n`);else{ctx.err(`${ctx.t.shell}: type: ${n}: Nicht gefunden.\n`);return 1}}return 0},
  async which(ctx){let code=0;for(const n of ctx.args.filter(a=>!a.startsWith('-'))){if(ctx.t.venv&&/^(python3?(\.\d+)?|pip3?(\.\d+)?)$/.test(n)){ctx.out(pathDisplay(ctx.os,ctx.t.venv.path)+'/bin/'+n+'\n');continue}if(ctx.engine.getCommands(ctx.t).includes(n)&&!ctx.t.aliases[n])ctx.out(`${ctx.os==='macos'&&/^(python3|pip3|node|npm|gcc|g\+\+|php|brew|git)$/.test(n)?'/opt/homebrew/bin':'/usr/bin'}/${n}\n`);else if(ctx.t.aliases[n])ctx.out(ctx.os==='macos'?`${n}: aliased to ${ctx.t.aliases[n]}\n`:`/usr/bin/${ctx.t.aliases[n].split(' ')[0]}\n`);else{if(ctx.os==='macos')ctx.out(`${n} not found\n`);code=1}}return code},
  async ps(ctx){const{base,wins}=ctx.engine.procList(ctx.t);const aux=ctx.args.some(a=>/a|x|e/.test(a));if(!aux){ctx.out(`    PID TTY          TIME CMD\n   3120 pts/0    00:00:00 ${ctx.t.shell}\n   ${String(4000+Math.floor(Math.random()*900)).padStart(4)} pts/0    00:00:00 ps\n`);return 0}ctx.out('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n'+[...base.map(([n,p])=>['root',p,n]),...wins.map(([n,p])=>['student',p,n])].map(([u,p,n])=>`${u.padEnd(10)} ${String(p).padStart(5)}  ${(Math.random()*2).toFixed(1)}  ${(Math.random()*3).toFixed(1)} ${String(20000+p*37).padStart(6)} ${String(4000+p*11).padStart(5)} ?        Ss   08:00   0:0${p%10} ${n}`).join('\n')+'\n');return 0},
  async top(ctx){const{base,wins}=ctx.engine.procList(ctx.t);ctx.out(`top - ${new Date().toLocaleTimeString('de-DE')} up 1:12,  1 user,  load average: 0,31, 0,24, 0,11\nTasks: ${base.length+wins.length+180} total,   1 running, ${base.length+wins.length+179} sleeping,   0 stopped,   0 zombie\n%CPU(s):  3,1 us,  1,0 sy,  0,0 ni, 95,6 id,  0,2 wa,  0,0 hi,  0,1 si,  0,0 st\nMiB Spch :  15872,0 total,   9580,3 free,   2311,8 used,   3979,9 buff/cache\nMiB Swap:   2048,0 total,   2048,0 free,      0,0 used.  13560,2 avail Spch\n\n\x1b[7m    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     ZEIT+ BEFEHL           ${C.reset}\n`+[...wins.map(([n,p])=>['student',p,n]),...base.map(([n,p])=>['root',p,n])].map(([u,p,n])=>`${String(p).padStart(7)} ${u.padEnd(9)} 20   0 ${String(200000+p*91).padStart(7)} ${String(30000+p*13).padStart(6)} ${String(12000+p*7).padStart(6)} S ${(Math.random()*4).toFixed(1).padStart(5)} ${(Math.random()*2).toFixed(1).padStart(5)}   0:0${p%10}.${pad2(p%60)} ${n}`).join('\n')+`\n${C.gray}(Momentaufnahme – in der Simulation endet top sofort)${C.reset}\n`);return 0},
  async htop(ctx){if(!ctx.engine.programs.isInstalled('htop',ctx.t))return ctx.engine.notFound('htop',ctx.t,ctx.io);return ctx.engine.unix.top.call(this,ctx)},
  async kill(ctx){const pid=Number(ctx.args.filter(a=>!a.startsWith('-')).pop());const{wins,base}=ctx.engine.procList(ctx.t);const w=wins.find(x=>x[1]===pid);if(w){ctx.app.closeWindowById?.(w[3]);return 0}if(base.some(b=>b[1]===pid)){ctx.err(`${ctx.t.shell}: kill: (${pid}) - Die Operation ist nicht erlaubt\n`);return 1}ctx.err(`${ctx.t.shell}: kill: (${pid}) - Kein passender Prozess gefunden\n`);return 1},
  async killall(ctx){const{wins}=ctx.engine.procList(ctx.t);const hits=wins.filter(w=>w[0]===ctx.args[0]);hits.forEach(w=>ctx.app.closeWindowById?.(w[3]));if(!hits.length){ctx.err(`${ctx.args[0]}: Kein Prozess gefunden\n`);return 1}return 0},
  async jobs(){return 0},async fg(ctx){ctx.err(`${ctx.t.shell}: fg: Aktueller: Kein solcher Job\n`);return 1},async bg(ctx){ctx.err(`${ctx.t.shell}: bg: Aktueller: Kein solcher Job\n`);return 1},
  async umask(ctx){ctx.out('0022\n');return 0},
  async source(ctx){const f=ctx.args[0];if(!f){ctx.err(`${ctx.t.shell}: source: Dateiname als Argument benötigt\nsource: Aufruf: source Dateiname [Argumente]\n`);return 2}const vs=ctx.fs.exists(f,ctx.t.cwd)&&venvScript(ctx.fs,ctx.fs.normalize(f,ctx.t.cwd));if(vs){if(/fish|csh|ps1/i.test(vs.script)){ctx.err(`${ctx.t.shell}: ${f}: Zeile 1: Syntaxfehler – dieses Skript ist für ${/fish/.test(vs.script)?'fish':/csh/.test(vs.script)?'csh':'PowerShell'}.\n`);return 1}if(vs.kind==='deactivate')venvDeactivate(ctx.t);else venvActivate(ctx.t,ctx.fs,vs.venv);return 0}let text;try{text=ctx.fs.read(f,ctx.t.cwd)}catch{ctx.err(`${ctx.t.shell}: ${f}: Datei oder Verzeichnis nicht gefunden\n`);return 1}return ctx.engine.runSource(text,ctx.t,ctx.io)},
  async '.'(ctx){return ctx.engine.unix.source.call(this,ctx)},
  async xargs(ctx){const input=(await ctx.input()).split(/\s+/).filter(Boolean);const cmd=ctx.args.length?ctx.args:['echo'];return ctx.engine.dispatch([...cmd,...input],ctx.t,{...ctx.io,stdin:null})},
  async column(ctx){const text=await ctx.input();const rows=text.replace(/\n$/,'').split('\n').map(l=>l.split(ctx.args.includes('-s')?ctx.args[ctx.args.indexOf('-s')+1]:/\s+/));const w=[];rows.forEach(r=>r.forEach((c,i)=>w[i]=Math.max(w[i]||0,c.length)));ctx.out(rows.map(r=>r.map((c,i)=>c.padEnd(w[i])).join('  ').trimEnd()).join('\n')+'\n');return 0},
  async time(ctx){const t0=performance.now();const code=ctx.args.length?await ctx.engine.dispatch(ctx.args,ctx.t,ctx.io):0;const s=((performance.now()-t0)/1000).toFixed(3);ctx.err(`\nreal\t0m${s.replace('.',',')}s\nuser\t0m0,00${Math.floor(Math.random()*9)}s\nsys\t0m0,00${Math.floor(Math.random()*9)}s\n`);return code},
  async watch(ctx){ctx.err('watch: in der Simulation nicht verfügbar – führe den Befehl direkt aus.\n');return 1},
  async sed(ctx){const args=[...ctx.args];let inplace=false;const files=[];let script=null;while(args.length){const a=args.shift();if(a==='-i')inplace=true;else if(a==='-e')script=args.shift();else if(script===null)script=a;else files.push(a)}const m=script?.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/);if(!m){ctx.err(`sed: -e Ausdruck #1, Zeichen ${script?.length||0}: Unbekannter Befehl\n`);return 1}const rx=new RegExp(m[2],m[4].includes('g')?(m[4].includes('i')?'gi':'g'):m[4].includes('i')?'i':'');const apply=text=>text.split('\n').map(l=>l.replace(rx,m[3].replace(/\\(\d)/g,'$$$1').replace(/&/g,'$$&'))).join('\n');if(!files.length){ctx.out(apply(await ctx.input()));return 0}for(const f of files){let text;try{text=ctx.fs.read(f,ctx.t.cwd)}catch{ctx.err(`sed: ${f} kann nicht gelesen werden: Datei oder Verzeichnis nicht gefunden\n`);return 2}if(inplace)ctx.fs.write(f,apply(text),ctx.t.cwd);else ctx.out(apply(text))}return 0},
  async sudo(ctx){return ctx.engine.programs.sudo(ctx)},async su(ctx){return ctx.engine.programs.su(ctx)},async passwd(ctx){ctx.out('Ändern des Passworts für student.\nAktuelles Passwort: ');await ctx.engine.programs.readPassword(ctx);ctx.err('passwd: Authentifizierungs-Token-Manipulationsfehler (Simulation: Passwörter werden nicht gespeichert)\n');return 1},
  async reboot(ctx){if(!ctx.t.admin&&ctx.os!=='debian'&&ctx.os!=='arch'){ctx.err('reboot: Muss Superuser sein.\n');return 1}ctx.app.power?.('restart');return 0},
  async shutdown(ctx){ctx.out(`Shutdown scheduled for ${new Date(Date.now()+60000).toLocaleString('de-DE')}, use 'shutdown -c' to cancel.\n`);if(ctx.args.includes('now')||ctx.args.includes('-h'))ctx.app.power?.(ctx.args.includes('-r')?'restart':'shutdown');return 0},
  async poweroff(ctx){ctx.app.power?.('shutdown');return 0},
  async systemctl(ctx){const[sub,unit]=ctx.args;if(sub==='status'&&unit){ctx.out(`${C.green}●${C.reset} ${unit}.service - ${unit}\n     Loaded: loaded (/usr/lib/systemd/system/${unit}.service; enabled; preset: enabled)\n     Active: ${C.green}active (running)${C.reset} since ${new Date(ctx.app.bootTime||Date.now()).toLocaleString('de-DE')}\n   Main PID: ${400+unit.length*17} (${unit})\n      Tasks: 3 (limit: 18905)\n     Memory: 4.2M\n`);return 0}if(['start','stop','restart','enable','disable'].includes(sub)){if(!ctx.t.admin){ctx.err(`${C.red}Failed to ${sub} ${unit}.service: Access denied${C.reset}\nSee system logs and 'systemctl status ${unit}.service' for details.\n`);return 1}return 0}if(sub==='poweroff'||sub==='reboot'){ctx.app.power?.(sub==='reboot'?'restart':'shutdown');return 0}ctx.out(`  UNIT                     LOAD   ACTIVE SUB     DESCRIPTION\n  dbus.service             loaded active running D-Bus System Message Bus\n  NetworkManager.service   loaded active running Network Manager\n  ssh.service              loaded active running OpenBSD Secure Shell server\n  systemd-journald.service loaded active running Journal Service\n  ${ctx.os==='arch'?'sddm':'gdm'}.service              loaded active running Display Manager\n\n5 loaded units listed.\n`);return 0},
  async journalctl(ctx){ctx.out(`${new Date().toLocaleString('de-DE')} ${hostName(ctx.os)} systemd[1]: Started session-2.scope - Session 2 of User student.\n${new Date().toLocaleString('de-DE')} ${hostName(ctx.os)} kernel: DesktopSim: browser sandbox ready\n`);return 0},
  async dmesg(ctx){if(!ctx.t.admin&&ctx.os==='debian'){ctx.err('dmesg: Lesen des Kernel-Puffers fehlgeschlagen: Die Operation ist nicht erlaubt\n');return 1}ctx.out('[    0.000000] Linux version '+unixNames[ctx.os]?.[2]+'\n[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz root=/dev/vda2 ro quiet\n[    0.412000] DesktopSim: WebAssembly-Laufzeiten bereit\n[    1.020000] EXT4-fs (vda2): mounted filesystem\n');return 0},
  async lsblk(ctx){ctx.out('NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS\nvda    254:0    0   60G  0 disk \n├─vda1 254:1    0  512M  0 part /boot/efi\n└─vda2 254:2    0 59,5G  0 part /\n');return 0},
  async lscpu(ctx){ctx.out(`Architektur:                 x86_64\n  Modi der CPU:              32-bit, 64-bit\nCPU(s):                      ${navigator?.hardwareConcurrency||8}\nHersteller-ID:               DesktopSim\n  Modellname:                Browser Virtual CPU @ 3.0GHz\nVirtualisierung:             WebAssembly-Sandbox\n`);return 0},
  async ip(ctx){if(ctx.os==='macos')return ctx.engine.notFound('ip',ctx.t,ctx.io);ctx.out(`1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet ${C.magenta}127.0.0.1${C.reset}/8 scope host lo\n2: ${C.cyan}enp0s3${C.reset}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state ${C.green}UP${C.reset} group default qlen 1000\n    link/ether ${C.yellow}08:00:27:4e:66:a1${C.reset} brd ff:ff:ff:ff:ff:ff\n    inet ${C.magenta}192.168.178.42${C.reset}/24 brd 192.168.178.255 scope global dynamic enp0s3\n    inet6 fe80::a00:27ff:fe4e:66a1/64 scope link\n`);return 0},
  async ifconfig(ctx){if(ctx.os==='debian'){ctx.err('bash: ifconfig: Befehl nicht gefunden\n'+C.gray+'Hinweis: Debian nutzt »ip a« (ifconfig gehört zum alten Paket net-tools).'+C.reset+'\n');return 127}ctx.out(`${ctx.os==='macos'?'en0':'enp0s3'}: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 192.168.178.42  netmask 255.255.255.0  broadcast 192.168.178.255\n        ether 08:00:27:4e:66:a1  txqueuelen 1000  (Ethernet)\n        RX packets 18423  bytes 21844512 (20.8 MiB)\n        TX packets 9921  bytes 1288123 (1.2 MiB)\n\nlo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0\n`);return 0},
  async ping(ctx){return ctx.engine.programs.ping(ctx)},
  async neofetch(ctx){return ctx.engine.programs.neofetch(ctx,'neofetch')},async fastfetch(ctx){return ctx.engine.programs.neofetch(ctx,'fastfetch')},
  async pbcopy(ctx){const text=await ctx.input();try{await navigator.clipboard.writeText(text)}catch{}return 0},
  async say(ctx){try{speechSynthesis.speak(new SpeechSynthesisUtterance(ctx.args.join(' ')))}catch{}return 0},
  async nano(ctx){return ctx.engine.programs.openEditorCmd(ctx,'nano')},async vim(ctx){return ctx.engine.programs.openEditorCmd(ctx,'vim')},async vi(ctx){return ctx.engine.programs.openEditorCmd(ctx,'vim')},
  async sh(ctx){return ctx.engine.programs.subshell(ctx,'sh')},async bash(ctx){return ctx.engine.programs.subshell(ctx,'bash')},async zsh(ctx){return ctx.engine.programs.subshell(ctx,'zsh')}
};

// ======================= CMD-Befehle =======================
const CMD_BUILTINS=['assoc','attrib','calc','cd','chdir','cls','cmd','color','copy','date','del','dir','echo','erase','exit','explorer','fc','find','findstr','help','hostname','ipconfig','md','mkdir','more','move','netstat','notepad','path','pause','ping','powershell','rd','ren','rename','rmdir','set','shutdown','sort','start','systeminfo','taskkill','tasklist','taskmgr','time','title','tracert','tree','type','ver','vol','where','whoami','winver','xcopy','cd..','cls','wsl','mspaint','control','code'];
const PS_PASSTHRU=new Set(['ipconfig','ping','hostname','whoami','systeminfo','tasklist','taskkill','notepad','calc','explorer','where','tracert','netstat','shutdown','cmd','powershell','taskmgr','winver','mspaint','control','code','attrib','findstr','tree','wsl','sort','more']);
TerminalEngine.prototype.cmd={
  async help(ctx){ctx.out(shellHelp(ctx.os)+'\n');return 0},
  async cls(ctx){if(ctx.t.io?.clear)ctx.t.io.clear();else ctx.out('__CLEAR__');return 0},
  async exit(ctx){throw new ExitShell(Number(ctx.args.find(a=>/^\d+$/.test(a)))||0)},
  async ver(ctx){ctx.out(`\nMicrosoft Windows [Version ${versions[ctx.os]}]\n`);return 0},
  async winver(ctx){ctx.app.openAbout?.();return 0},
  async 'cd..'(ctx){return ctx.engine.cmd.cd.call(this,{...ctx,args:['..']})},
  async cd(ctx){const t=ctx.t;let arg=ctx.args.filter(a=>a.toLowerCase()!=='/d').join(' ').replace(/^"|"$/g,'');if(!arg){ctx.out(pathDisplay(t.os,t.cwd)+'\n');return 0}if(/^[a-z]:$/i.test(arg)){if(arg.toUpperCase()!=='C:'){ctx.err('Das System kann das angegebene Laufwerk nicht finden.\n');return 1}ctx.out(pathDisplay(t.os,t.cwd)+'\n');return 0}if(/^[d-z]:/i.test(arg)){ctx.err('Das System kann das angegebene Laufwerk nicht finden.\n');return 1}const p=ctx.fs.normalize(arg,t.cwd),node=ctx.fs.locate(p);if(!node){ctx.err('Das System kann den angegebenen Pfad nicht finden.\n');return 1}if(node.type!=='dir'){ctx.err('Der Verzeichnisname ist ungültig.\n');return 1}t.prevCwd=t.cwd;t.cwd=ctx.fs.realPath(p);return 0},
  async chdir(ctx){return ctx.engine.cmd.cd.call(this,ctx)},
  async dir(ctx){
    const t=ctx.t,fs=ctx.fs;const opts=ctx.args.filter(a=>a.startsWith('/')&&a.length<=3).map(a=>a.toLowerCase());let target=ctx.args.filter(a=>!(a.startsWith('/')&&a.length<=3)).join(' ').replace(/^"|"$/g,'')||'.';
    let pattern=null;if(/[*?]/.test(target)){const i=Math.max(target.lastIndexOf('\\'),target.lastIndexOf('/'));pattern=target.slice(i+1);target=i>=0?target.slice(0,i)||'\\':'.'}
    const node=fs.locate(target,t.cwd);if(!node){ctx.out(' Datenträger in Laufwerk C: hat keine Bezeichnung.\n Volumeseriennummer: 7A3C-1F02\n\n');ctx.err('Datei nicht gefunden\n');return 1}
    const bare=opts.includes('/b'),wide=opts.includes('/w');const all=opts.some(o=>o.startsWith('/a'));
    const listOne=(path,header)=>{
      let entries=fs.list(path,t.cwd).filter(e=>all||!e.name.startsWith('$'));if(pattern){const rx=globToRegExp(pattern,true);entries=entries.filter(e=>rx.test(e.name))}
      if(opts.includes('/o')||opts.includes('/on'))entries.sort((a,b)=>a.name.localeCompare(b.name));
      if(bare){ctx.out(entries.map(e=>opts.includes('/s')?pathDisplay(t.os,joinPath(fs.normalize(path,t.cwd),e.name)):e.name).join('\n')+(entries.length?'\n':''));return entries}
      const abs=fs.normalize(path,t.cwd);const files=entries.filter(e=>e.type==='file'),dirs=entries.filter(e=>e.type==='dir');
      let out=header?' Datenträger in Laufwerk C: hat keine Bezeichnung.\n Volumeseriennummer: 7A3C-1F02\n':'';out+=`\n Verzeichnis von ${pathDisplay(t.os,abs)}\n\n`;
      const st=fs.stat(abs);const rows=abs==='/'?entries:[{name:'.',type:'dir',mtime:st.mtime},{name:'..',type:'dir',mtime:st.mtime},...entries];
      if(wide)out+=ctx.engine.columns(rows.map(e=>e.type==='dir'?`[${e.name}]`:e.name),t);
      else out+=rows.map(e=>`${winDate(e.mtime)}    ${e.type==='dir'?'<DIR>          ':groupNum(e.size).padStart(14)+' '}${e.name}`).join('\n')+'\n';
      out+=`${String(files.length).padStart(16)} Datei(en),${groupNum(files.reduce((n,e)=>n+e.size,0)).padStart(15)} Bytes\n`;
      if(!opts.includes('/s'))out+=`${String(dirs.length+(abs==='/'?0:2)).padStart(16)} Verzeichnis(se), 412.316.651.520 Bytes frei\n`;
      ctx.out(out);return entries;
    };
    if(node.type==='file'){ctx.out(` Verzeichnis von ${pathDisplay(t.os,fs.normalize(target,t.cwd).replace(/\/[^/]*$/,''))}\n\n${winDate(fs.stat(target,t.cwd).mtime)}    ${groupNum(fs.stat(target,t.cwd).size).padStart(14)} ${target.split(/[\\/]/).pop()}\n               1 Datei(en)\n`);return 0}
    const entries=listOne(target,!bare);
    if(opts.includes('/s')){const walk=p=>{for(const e of fs.list(p,t.cwd).filter(e=>e.type==='dir')){const sub=joinPath(fs.normalize(p,t.cwd),e.name);listOne(sub,false);walk(sub)}};walk(target)}
    if(pattern&&!entries.length){ctx.err('Datei nicht gefunden\n');return 1}
    return 0;
  },
  async md(ctx){if(!ctx.args.length){ctx.err('Die Syntax des Befehls ist falsch.\n');return 1}let code=0;for(const p of ctx.args){if(ctx.fs.exists(p,ctx.t.cwd)){ctx.err(`Ein Unterverzeichnis oder eine Datei mit dem Namen "${p}" existiert bereits.\n`);code=1;continue}try{ctx.fs.mkdir(p,ctx.t.cwd,true)}catch{ctx.err('Das System kann den angegebenen Pfad nicht finden.\n');code=1}}ctx.app.notifyFiles?.();return code},
  async mkdir(ctx){return ctx.engine.cmd.md.call(this,ctx)},
  async rd(ctx){const rec=ctx.args.some(a=>/^\/s$/i.test(a)),quiet=ctx.args.some(a=>/^\/q$/i.test(a));let code=0;for(const p of ctx.args.filter(a=>!a.startsWith('/'))){const node=ctx.fs.locate(p,ctx.t.cwd);if(!node){ctx.err('Das System kann die angegebene Datei nicht finden.\n');code=2;continue}if(node.type!=='dir'){ctx.err('Der Verzeichnisname ist ungültig.\n');code=1;continue}if(Object.keys(node.children).length&&!rec){ctx.err('Das Verzeichnis ist nicht leer.\n');code=145;continue}if(rec&&!quiet){ctx.out(`${p}, Sind Sie sicher (J/N)? `);const a=await ctx.readLine();if(!/^j/i.test(a||''))continue}ctx.fs.remove(p,ctx.t.cwd,true)}ctx.app.notifyFiles?.();return code},
  async rmdir(ctx){return ctx.engine.cmd.rd.call(this,ctx)},
  async del(ctx){const quiet=ctx.args.some(a=>/^\/q$/i.test(a));const items=ctx.args.filter(a=>!a.startsWith('/'));if(!items.length){ctx.err('Die Syntax des Befehls ist falsch.\n');return 1}let code=0;for(const p of items){if(/[*?]/.test(p)){const i=Math.max(p.lastIndexOf('\\'),p.lastIndexOf('/'));const dir=i>=0?p.slice(0,i)||'\\':'.';const rx=globToRegExp(p.slice(i+1),true);const hits=ctx.fs.list(dir,ctx.t.cwd).filter(e=>e.type==='file'&&rx.test(e.name));if(p.slice(i+1)==='*'||p.slice(i+1)==='*.*'){if(!quiet){ctx.out(`${pathDisplay(ctx.os,ctx.fs.normalize(dir,ctx.t.cwd))}\\*, Sind Sie sicher (J/N)? `);const a=await ctx.readLine();if(!/^j/i.test(a||''))continue}}if(!hits.length){ctx.err(`Konnte ${pathDisplay(ctx.os,ctx.fs.normalize(p,ctx.t.cwd))} nicht finden\n`);code=1}hits.forEach(e=>ctx.fs.remove(joinPath(ctx.fs.normalize(dir,ctx.t.cwd),e.name)));continue}const node=ctx.fs.locate(p,ctx.t.cwd);if(!node){ctx.err(`Konnte ${pathDisplay(ctx.os,ctx.fs.normalize(p,ctx.t.cwd))} nicht finden\n`);code=1;continue}if(node.type==='dir'){ctx.out(`${pathDisplay(ctx.os,ctx.fs.normalize(p,ctx.t.cwd))}\\*, Sind Sie sicher (J/N)? `);const a=await ctx.readLine();if(/^j/i.test(a||''))node.children={},ctx.fs.persist();continue}ctx.fs.remove(p,ctx.t.cwd)}ctx.app.notifyFiles?.();return code},
  async erase(ctx){return ctx.engine.cmd.del.call(this,ctx)},
  async copy(ctx){const items=ctx.args.filter(a=>!a.startsWith('/'));if(items.length<2){if(items.length===1&&ctx.fs.exists(items[0],ctx.t.cwd)){ctx.err('Die Datei kann nicht auf sich selbst kopiert werden.\n        0 Datei(en) kopiert.\n');return 1}ctx.err('Die Syntax des Befehls ist falsch.\n');return 1}try{if(/[*?]/.test(items[0])){const rx=globToRegExp(items[0],true);const hits=ctx.fs.list('.',ctx.t.cwd).filter(e=>e.type==='file'&&rx.test(e.name));hits.forEach(e=>{ctx.out(e.name+'\n');ctx.fs.copy(e.name,items[1],ctx.t.cwd)});ctx.out(`${String(hits.length).padStart(9)} Datei(en) kopiert.\n`)}else{ctx.fs.copy(items[0],items[1],ctx.t.cwd);ctx.out('        1 Datei(en) kopiert.\n')}ctx.app.notifyFiles?.();return 0}catch{ctx.err('Das System kann die angegebene Datei nicht finden.\n');return 1}},
  async xcopy(ctx){const items=ctx.args.filter(a=>!a.startsWith('/'));try{ctx.fs.copy(items[0],items[1],ctx.t.cwd,true);ctx.out(`${items[0]}\n1 Datei(en) kopiert\n`);ctx.app.notifyFiles?.();return 0}catch{ctx.err('Datei nicht gefunden - '+items[0]+'\n0 Datei(en) kopiert\n');return 4}},
  async move(ctx){const items=ctx.args.filter(a=>!a.startsWith('/'));if(items.length<2){ctx.err('Die Syntax des Befehls ist falsch.\n');return 1}try{ctx.fs.move(items[0],items[1],ctx.t.cwd);ctx.out('        1 Datei(en) verschoben.\n');ctx.app.notifyFiles?.();return 0}catch{ctx.err('Das System kann die angegebene Datei nicht finden.\n');return 1}},
  async ren(ctx){if(ctx.args.length<2){ctx.err('Die Syntax des Befehls ist falsch.\n');return 1}if(/[\\/]/.test(ctx.args[1])){ctx.err('Die Syntax des Befehls ist falsch.\n');return 1}const src=ctx.fs.normalize(ctx.args[0],ctx.t.cwd);if(!ctx.fs.exists(src)){ctx.err('Das System kann die angegebene Datei nicht finden.\n');return 1}if(ctx.fs.exists(ctx.args[1],src.replace(/\/[^/]*$/,'')||'/')&&ctx.args[1].toLowerCase()!==src.split('/').pop().toLowerCase()){ctx.err('Eine doppelt vorhandene Datei wurde gefunden, oder die Datei wurde nicht gefunden.\n');return 1}ctx.fs.move(src,joinPath(src.replace(/\/[^/]*$/,'')||'/',ctx.args[1]));ctx.app.notifyFiles?.();return 0},
  async rename(ctx){return ctx.engine.cmd.ren.call(this,ctx)},
  async type(ctx){if(!ctx.args.length){ctx.err('Die Syntax des Befehls ist falsch.\n');return 1}let code=0;for(const p of ctx.args){const node=ctx.fs.locate(p,ctx.t.cwd);if(!node){ctx.err('Das System kann die angegebene Datei nicht finden.\n');code=1;continue}if(node.type==='dir'){ctx.err('Zugriff verweigert\n');code=1;continue}if(ctx.args.length>1)ctx.err(`\n${p}\n\n\n`);ctx.out(node.enc?binaryNoise(node):node.content.endsWith('\n')?node.content:node.content+'\n')}return code},
  async more(ctx){if(ctx.args.length)return ctx.engine.cmd.type.call(this,ctx);ctx.out(await ctx.input());return 0},
  async echo(ctx){const raw=ctx.args.join(' ');if(/^(on|off)$/i.test(raw)){ctx.t.echoOff=raw.toLowerCase()==='off';return 0}if(!ctx.args.length&&ctx.argv[0].toLowerCase()==='echo'){ctx.out(`ECHO ist ${ctx.t.echoOff?'ausgeschaltet (OFF)':'eingeschaltet (ON)'}.\n`);return 0}ctx.out(raw+'\n');return 0},
  async 'echo.'(ctx){ctx.out('\n');return 0},
  async set(ctx){const t=ctx.t;const raw=ctx.args.join(' ');if(!raw){const env=ctx.engine.winEnv(t);ctx.out(Object.entries({...env,...t.vars}).filter(([,v])=>typeof v!=='function').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n')+'\n');return 0}
    if(/^\/p\s/i.test(raw)){const m=raw.slice(3).match(/^"?([^=]+)=(.*?)"?$/);if(!m)return 1;ctx.out(m[2]);const line=await ctx.readLine();if(line!==null&&line!=='')t.vars[m[1].trim()]=line;return 0}
    if(/^\/a\s/i.test(raw)){const m=raw.slice(3).replace(/"/g,'').match(/^([^=]+)=(.*)$/);if(!m){ctx.err('Ungültiger Ausdruck.\n');return 1}const expr=m[2].replace(/[A-Za-z_]\w*/g,n=>Number(t.vars[n]??0));try{t.vars[m[1].trim()]=String(Math.trunc(Function(`return (${expr})`)()))}catch{ctx.err('Ungültiger Ausdruck.\n');return 1}return 0}
    const m=raw.replace(/^"|"$/g,'').match(/^([^=]+)=(.*)$/);if(!m){const hits=Object.entries({...ctx.engine.winEnv(t),...t.vars}).filter(([k,v])=>k.toLowerCase().startsWith(raw.toLowerCase())&&typeof v!=='function');if(!hits.length){ctx.err(`Die Umgebungsvariable "${raw}" ist nicht definiert.\n`);return 1}ctx.out(hits.map(([k,v])=>`${k}=${v}`).join('\n')+'\n');return 0}
    if(m[2]==='')delete t.vars[m[1]];else t.vars[m[1]]=m[2];return 0},
  async path(ctx){ctx.out('PATH='+ctx.engine.winEnv(ctx.t).PATH+'\n');return 0},
  async title(ctx){ctx.app.setTerminalTitle?.(ctx.t,ctx.args.join(' '));return 0},
  async color(ctx){ctx.app.setTerminalColor?.(ctx.t,ctx.args[0]||'07');return 0},
  async pause(ctx){ctx.out('Drücken Sie eine beliebige Taste . . . ');await ctx.readLine();return 0},
  async rem(){return 0},
  async tree(ctx){const t=ctx.t,fs=ctx.fs;const withFiles=ctx.args.some(a=>/^\/f$/i.test(a));const root=ctx.args.filter(a=>!a.startsWith('/')).join(' ')||'.';if(!fs.isDir(root,t.cwd)){ctx.err('Ungültiger Pfad - '+root.toUpperCase()+'\nKeine Unterordner vorhanden\n');return 1}const lines=['Auflistung der Ordnerpfade',`Volumeseriennummer : 7A3C-1F02`,pathDisplay(t.os,fs.normalize(root,t.cwd)).toUpperCase()];let dirs=0;const walk=(p,prefix)=>{const entries=fs.list(p,t.cwd);const ds=entries.filter(e=>e.type==='dir');if(withFiles)entries.filter(e=>e.type==='file').forEach(e=>lines.push(prefix+(ds.length?'│   ':'    ')+e.name));if(withFiles&&entries.some(e=>e.type==='file'))lines.push(prefix+(ds.length?'│':''));ds.forEach((e,i)=>{dirs++;const last=i===ds.length-1;lines.push(prefix+(last?'└───':'├───')+e.name);walk(joinPath(fs.normalize(p,t.cwd),e.name),prefix+(last?'    ':'│   '))})};walk(root,'');if(!dirs&&!withFiles)lines.push('Keine Unterordner vorhanden');ctx.out(lines.slice(0,500).join('\n')+'\n');return 0},
  async attrib(ctx){const p=ctx.args.filter(a=>!/^[+-/]/.test(a))[0]||'*';const rx=globToRegExp(p.split(/[\\/]/).pop(),true);const entries=ctx.fs.list('.',ctx.t.cwd).filter(e=>e.type==='file'&&rx.test(e.name));if(!entries.length){ctx.err(`Datei nicht gefunden - ${p}\n`);return 1}ctx.out(entries.map(e=>`A                    ${pathDisplay(ctx.os,joinPath(ctx.t.cwd,e.name))}`).join('\n')+'\n');return 0},
  async find(ctx){const args=ctx.args.filter(a=>!a.startsWith('/'));const flags=ctx.args.filter(a=>a.startsWith('/')).map(a=>a.toLowerCase());const needle=args.shift();if(needle===undefined){ctx.err('FIND: Falsche Anzahl von Parametern\n');return 2}const ci=flags.includes('/i');const test=l=>ci?l.toLowerCase().includes(needle.toLowerCase()):l.includes(needle);const show=(text,label)=>{const lines=text.replace(/\n$/,'').split('\n').filter(l=>flags.includes('/v')?!test(l):test(l));if(label)ctx.out(`\n---------- ${label.toUpperCase()}${flags.includes('/c')?': '+lines.length:''}\n`);else if(flags.includes('/c'))ctx.out(lines.length+'\n');if(!flags.includes('/c'))ctx.out(lines.map(l=>l+'\n').join(''));return lines.length};if(!args.length){return show(await ctx.input(),null)?0:1}let hits=0;for(const f of args){try{hits+=show(ctx.fs.read(f,ctx.t.cwd),f)}catch{ctx.err(`Datei nicht gefunden - ${f.toUpperCase()}\n`)}}return hits?0:1},
  async findstr(ctx){const args=ctx.args.filter(a=>!a.startsWith('/'));const flags=ctx.args.filter(a=>a.startsWith('/')).map(a=>a.toLowerCase());const pattern=args.shift();if(!pattern){ctx.err('FINDSTR: Falsche Syntax.\n');return 2}const words=pattern.split(' ');const ci=flags.includes('/i');const test=l=>words.some(w=>{if(flags.includes('/r'))try{return new RegExp(w,ci?'i':'').test(l)}catch{return false}return ci?l.toLowerCase().includes(w.toLowerCase()):l.includes(w)});let hits=0;const scan=(text,label)=>{text.replace(/\n$/,'').split('\n').forEach((l,i)=>{if(test(l)===flags.includes('/v'))return;hits++;ctx.out(`${label?label+':':''}${flags.includes('/n')?(i+1)+':':''}${l}\n`)})};if(!args.length)scan(await ctx.input(),null);else{const files=args.flatMap(a=>/[*?]/.test(a)?ctx.fs.list('.',ctx.t.cwd).filter(e=>e.type==='file'&&globToRegExp(a,true).test(e.name)).map(e=>e.name):[a]);for(const f of files){try{scan(ctx.fs.read(f,ctx.t.cwd),files.length>1?f:null)}catch{ctx.err(`FINDSTR: ${f} kann nicht geöffnet werden.\n`)}}}return hits?0:1},
  async sort(ctx){const rev=ctx.args.some(a=>/^\/r$/i.test(a));const files=ctx.args.filter(a=>!a.startsWith('/'));let text;try{text=files.length?ctx.fs.read(files[0],ctx.t.cwd):await ctx.input()}catch{ctx.err('Das System kann die angegebene Datei nicht finden.\n');return 1}const lines=text.replace(/\n$/,'').split('\n').sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));if(rev)lines.reverse();ctx.out(lines.join('\n')+'\n');return 0},
  async fc(ctx){const files=ctx.args.filter(a=>!a.startsWith('/'));let a,b;try{a=ctx.fs.read(files[0],ctx.t.cwd);b=ctx.fs.read(files[1],ctx.t.cwd)}catch{ctx.err(`FC: ${files[0]} kann nicht geöffnet werden - Datei oder Ordner nicht vorhanden\n`);return 2}ctx.out(`Vergleichen der Dateien ${files[0]} und ${files[1].toUpperCase()}\n`);if(a===b){ctx.out('FC: Keine Unterschiede gefunden\n\n');return 0}const x=a.split('\n'),y=b.split('\n');for(let i=0;i<Math.max(x.length,y.length);i++)if(x[i]!==y[i]){ctx.out(`***** ${files[0]}\n${x[i]??''}\n***** ${files[1]}\n${y[i]??''}\n*****\n\n`)}return 1},
  async date(ctx){const d=new Date();if(ctx.args.some(a=>/^\/t$/i.test(a))){ctx.out(d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})+'\n');return 0}ctx.out(`Aktuelles Datum: ${d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}\nGeben Sie das neue Datum ein: (TT-MM-JJ) `);await ctx.readLine();ctx.err('Für die Ausführung dieses Vorgangs fehlen die erforderlichen Berechtigungen.\n');return 1},
  async time(ctx){const d=new Date();if(ctx.args.some(a=>/^\/t$/i.test(a))){ctx.out(d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+'\n');return 0}ctx.out(`Aktuelle Zeit: ${d.toLocaleTimeString('de-DE')},${pad2(Math.floor(d.getMilliseconds()/10))}\nGeben Sie die neue Zeit ein: `);await ctx.readLine();ctx.err('Für die Ausführung dieses Vorgangs fehlen die erforderlichen Berechtigungen.\n');return 1},
  async vol(ctx){ctx.out(' Datenträger in Laufwerk C: hat keine Bezeichnung.\n Volumeseriennummer: 7A3C-1F02\n');return 0},
  async whoami(ctx){ctx.out(ctx.args.includes('/all')||ctx.args.includes('/user')?'\nBENUTZERINFORMATIONEN\n---------------------\n\nBenutzername         SID\n==================== =============================================\ndesktop-sim\\student S-1-5-21-3623811015-3361044348-30300820-1001\n':'desktop-sim\\student\n');return 0},
  async hostname(ctx){ctx.out('DESKTOP-SIM\n');return 0},
  async ipconfig(ctx){const all=ctx.args.some(a=>/^[/-]all$/i.test(a));ctx.out(`\nWindows-IP-Konfiguration\n\n${all?`   Hostname  . . . . . . . . . . . . : DESKTOP-SIM\n   Primäres DNS-Suffix . . . . . . . : \n   Knotentyp . . . . . . . . . . . . : Hybrid\n   IP-Routing aktiviert  . . . . . . : Nein\n\n`:''}Ethernet-Adapter Ethernet:\n\n   Verbindungsspezifisches DNS-Suffix: fritz.box\n${all?'   Beschreibung. . . . . . . . . . . : Intel(R) Ethernet Connection (DesktopSim)\n   Physische Adresse . . . . . . . . : 08-00-27-4E-66-A1\n   DHCP aktiviert. . . . . . . . . . : Ja\n':''}   Verbindungslokale IPv6-Adresse  . : fe80::a00:27ff:fe4e:66a1%12\n   IPv4-Adresse  . . . . . . . . . . : 192.168.178.42\n   Subnetzmaske  . . . . . . . . . . : 255.255.255.0\n   Standardgateway . . . . . . . . . : 192.168.178.1\n${all?'   DNS-Server  . . . . . . . . . . . : 192.168.178.1\n':''}`);return 0},
  async ping(ctx){return ctx.engine.programs.ping(ctx)},
  async tracert(ctx){const host=ctx.args.find(a=>!a.startsWith('-'))||'datenflix007.github.io';ctx.out(`\nRoutenverfolgung zu ${host} [185.199.108.153]\nüber maximal 30 Hops:\n\n`);const hops=[['1','fritz.box [192.168.178.1]'],['8','p3e9bf2a1.dip0.t-ipconnect.de [62.155.242.161]'],['12','f-ed12-i.F.DE.NET.DTAG.DE [217.0.199.42]'],['14','cdn-185-199-108-153.github.com [185.199.108.153]']];for(const[i,[ms,h]]of hops.entries()){await sleep(350);if(ctx.t.cancelled)return 130;ctx.out(`  ${i+1}    ${ms.padStart(2)} ms    ${ms.padStart(2)} ms    ${ms.padStart(2)} ms  ${h}\n`)}ctx.out('\nAblaufverfolgung beendet.\n');return 0},
  async netstat(ctx){ctx.out('\nAktive Verbindungen\n\n  Proto  Lokale Adresse         Remoteadresse          Status\n  TCP    192.168.178.42:50122   185.199.108.153:https  HERGESTELLT\n  TCP    192.168.178.42:50134   151.101.1.229:https    HERGESTELLT\n'+[...ctx.app.servers?.keys?.()||[]].map(p=>`  TCP    127.0.0.1:${p}         0.0.0.0:0              ABHÖREN\n`).join(''));return 0},
  async systeminfo(ctx){const os=getOS(ctx.os);ctx.out(`\nHostname:                                  DESKTOP-SIM\nBetriebssystemname:                        Microsoft ${os.label} ${ctx.os==='winxp'?'Professional':'Pro'}\nBetriebssystemversion:                     ${versions[ctx.os]} Build ${versions[ctx.os].split('.')[2]}\nBetriebssystemhersteller:                  Microsoft Corporation\nBetriebssystemkonfiguration:               Eigenständige Arbeitsstation\nRegistrierter Benutzer:                    Student\nProdukt-ID:                                00330-80000-00000-AA000\nSystemstartzeit:                           ${new Date(ctx.app.bootTime||Date.now()).toLocaleString('de-DE')}\nSystemhersteller:                          DesktopSim\nSystemmodell:                              Browser Virtual Machine\nSystemtyp:                                 ${ctx.os==='winxp'?'X86-based PC':'x64-based PC'}\nProzessor(en):                             1 Prozessor(en) installiert.\n                                           [01]: Browser vCPU ~3000 MHz\nWindows-Verzeichnis:                       C:\\Windows\nSystemgebietsschema:                       de;Deutsch (Deutschland)\nZeitzone:                                  (UTC+01:00) Amsterdam, Berlin, Bern, Rom, Stockholm, Wien\nGesamter physischer Speicher:              16.384 MB\nVerfügbarer physischer Speicher:           9.812 MB\nDomäne:                                    WORKGROUP\nNetzwerkkarte(n):                          1 Netzwerkadapter installiert.\n                                           [01]: Intel(R) Ethernet Connection\n                                                 IP-Adresse(n)\n                                                 [01]: 192.168.178.42\n`);return 0},
  async tasklist(ctx){const{base,wins}=ctx.engine.procList(ctx.t);ctx.out('\nAbbildname                     PID Sitzungsname       Sitz.-Nr. Speichernutzung\n========================= ======== ================ =========== ===============\n'+[...base.map(([n,p,m])=>[n,p,'Services',0,m]),...wins.map(([n,p])=>[n,p,'Console',1,`${(12+p%50)}.${String(p%1000).padStart(3,'0')} K`])].map(([n,p,s,i,m])=>`${n.padEnd(25)} ${String(p).padStart(8)} ${s.padEnd(16)} ${String(i).padStart(11)} ${String(m).padStart(15)}`).join('\n')+'\n');return 0},
  async taskkill(ctx){const args=ctx.args;const im=args.findIndex(a=>/^\/im$/i.test(a)),pi=args.findIndex(a=>/^\/pid$/i.test(a));const{wins,base}=ctx.engine.procList(ctx.t);let hits=[];if(im>=0)hits=wins.filter(w=>w[0].toLowerCase()===String(args[im+1]).toLowerCase());if(pi>=0)hits=wins.filter(w=>w[1]===Number(args[pi+1]));if(!hits.length){const sys=base.find(b=>im>=0&&b[0].toLowerCase()===String(args[im+1]).toLowerCase()||pi>=0&&b[1]===Number(args[pi+1]));ctx.err(sys?`FEHLER: Der Prozess "${sys[0]}" mit PID ${sys[1]} konnte nicht beendet werden.\nUrsache: Zugriff verweigert\n`:`FEHLER: Der Prozess "${args[(im>=0?im:pi)+1]}" wurde nicht gefunden.\n`);return 128}for(const w of hits){ctx.out(`ERFOLGREICH: Der Prozess "${w[0]}" mit PID ${w[1]} wurde beendet.\n`);setTimeout(()=>ctx.app.closeWindowById?.(w[3]),50)}return 0},
  async where(ctx){const n=ctx.args.find(a=>!a.startsWith('/'));if(!n){ctx.err('FEHLER: Ungültige Syntax.\n');return 2}if(ctx.t.venv&&/^(python|pip)(\.exe)?$/i.test(n))ctx.out(pathDisplay(ctx.os,ctx.t.venv.path)+'\\Scripts\\'+n.replace(/\.exe$/i,'')+'.exe\n');const cmds=ctx.engine.programs.names(ctx.t);const local=ctx.fs.list('.',ctx.t.cwd).filter(e=>e.name.toLowerCase().replace(/\.(exe|bat|cmd)$/,'')===n.toLowerCase().replace(/\.(exe|bat|cmd)$/,''));if(local.length){ctx.out(local.map(e=>pathDisplay(ctx.os,joinPath(ctx.t.cwd,e.name))).join('\n')+'\n');return 0}const loc={python:'C:\\Program Files\\Python314\\python.exe',py:'C:\\Windows\\py.exe',node:'C:\\Program Files\\nodejs\\node.exe',git:'C:\\Program Files\\Git\\cmd\\git.exe',gcc:'C:\\msys64\\ucrt64\\bin\\gcc.exe','g++':'C:\\msys64\\ucrt64\\bin\\g++.exe',java:'C:\\Program Files\\Java\\jdk-8\\bin\\java.exe',javac:'C:\\Program Files\\Java\\jdk-8\\bin\\javac.exe',php:'C:\\php\\php.exe',sqlite3:'C:\\sqlite\\sqlite3.exe',code:'C:\\Users\\Student\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd'}[n.toLowerCase()];if(loc&&cmds.includes(n.toLowerCase())){ctx.out(loc+'\n');return 0}if(CMD_BUILTINS.includes(n.toLowerCase())&&['notepad','calc','explorer','hostname','ipconfig','ping','whoami','tasklist','taskkill','where','tracert','netstat','systeminfo','taskmgr','mspaint','winver','findstr','sort','more','tree','attrib','xcopy','shutdown'].includes(n.toLowerCase())){ctx.out(`C:\\Windows\\System32\\${n.toLowerCase()}.exe\n`);return 0}ctx.err('INFORMATION: Es konnten keine Dateien mit dem angegebenen\nMuster gefunden werden.\n');return 1},
  async start(ctx){return ctx.engine.programs.open(ctx)},
  async explorer(ctx){ctx.app.openFiles?.(ctx.args[0]?ctx.fs.normalize(ctx.args[0]==='.'?'.':ctx.args[0],ctx.t.cwd):ctx.t.cwd);return 0},
  async notepad(ctx){return ctx.engine.programs.openEditorCmd(ctx,'notepad')},
  async code(ctx){return ctx.engine.programs.openIDECmd(ctx)},
  async calc(ctx){ctx.app.openCalculator?.();return 0},
  async mspaint(ctx){ctx.app.toast?.('Paint ist in DesktopSim nicht enthalten.');return 0},
  async control(ctx){ctx.app.openSettings?.();return 0},
  async taskmgr(ctx){ctx.app.openTaskManager?.();return 0},
  async shutdown(ctx){const a=ctx.args.map(x=>x.toLowerCase());if(a.includes('/a')){ctx.out('');return 0}if(!a.some(x=>['/s','/r','/l','/p'].includes(x))){ctx.out('Syntax: shutdown [/i | /l | /s | /r | /a | /p] [/t xxx]\n');return 0}ctx.app.power?.(a.includes('/r')?'restart':a.includes('/l')?'logout':'shutdown');return 0},
  async cmd(ctx){return ctx.engine.programs.switchShell(ctx,'cmd')},
  async powershell(ctx){return ctx.engine.programs.switchShell(ctx,'powershell')},
  async wsl(ctx){ctx.out('Das Windows-Subsystem für Linux hat keine installierten Distributionen.\nTipp: In DesktopSim kannst du oben über „System wählen“ direkt Debian oder Arch Linux starten.\n');return 1},
  async assoc(ctx){ctx.out('.bat=batfile\n.cmd=cmdfile\n.exe=exefile\n.html=htmlfile\n.py=Python.File\n.txt=txtfile\n');return 0}
};

// ======================= PowerShell-Cmdlets =======================
const PS_CMDLETS=['Get-ChildItem','Set-Location','Get-Location','Get-Content','Set-Content','Add-Content','Out-File','New-Item','Remove-Item','Copy-Item','Move-Item','Rename-Item','Test-Path','Write-Host','Write-Output','Read-Host','Get-Process','Stop-Process','Get-Service','Get-Date','Get-Command','Get-Help','Clear-Host','Get-History','Select-String','Measure-Object','Sort-Object','Select-Object','Where-Object','ForEach-Object','Get-ComputerInfo','Start-Process','Invoke-WebRequest','Get-Alias','Set-ExecutionPolicy','Get-ExecutionPolicy','Start-Sleep','Get-Random','Get-Member','Format-Table','Format-List','Out-Host','Get-NetIPAddress','Test-Connection','Resolve-Path','Split-Path','Join-Path','Get-Item','Stop-Computer','Restart-Computer','Exit','Get-Variable','Get-Host'];
const PS_ALIASES={ls:'Get-ChildItem',dir:'Get-ChildItem',gci:'Get-ChildItem',cd:'Set-Location',sl:'Set-Location',chdir:'Set-Location',pwd:'Get-Location',gl:'Get-Location',cat:'Get-Content',gc:'Get-Content',type:'Get-Content',ni:'New-Item',mkdir:'New-Item',md:'New-Item',rm:'Remove-Item',del:'Remove-Item',erase:'Remove-Item',rd:'Remove-Item',rmdir:'Remove-Item',ri:'Remove-Item',cp:'Copy-Item',copy:'Copy-Item',cpi:'Copy-Item',mv:'Move-Item',move:'Move-Item',mi:'Move-Item',ren:'Rename-Item',rni:'Rename-Item',echo:'Write-Output',write:'Write-Output',ps:'Get-Process',gps:'Get-Process',kill:'Stop-Process',spps:'Stop-Process',cls:'Clear-Host',clear:'Clear-Host',h:'Get-History',history:'Get-History',sls:'Select-String',measure:'Measure-Object',sort:'Sort-Object',select:'Select-Object',where:'Where-Object','?':'Where-Object',foreach:'ForEach-Object','%':'ForEach-Object',start:'Start-Process',saps:'Start-Process',iwr:'Invoke-WebRequest',curl:'Invoke-WebRequest',wget:'Invoke-WebRequest',gal:'Get-Alias',sleep:'Start-Sleep',gm:'Get-Member',ft:'Format-Table',fl:'Format-List',help:'Get-Help',man:'Get-Help',exit:'Exit',gsv:'Get-Service',gi:'Get-Item',rvpa:'Resolve-Path',gv:'Get-Variable',gcm:'Get-Command'};
const psErr=(ctx,msg,cat='ObjectNotFound',id='PathNotFound')=>{ctx.err(`${C.red}${msg}\nIn Zeile:1 Zeichen:1\n+ ${ctx.argv.join(' ')}\n+ ${'~'.repeat(Math.min(60,ctx.argv.join(' ').length))}\n    + CategoryInfo          : ${cat}: (:) [${ctx.argv[0]}], ItemNotFoundException\n    + FullyQualifiedErrorId : ${id}\n${C.reset}`);return 1};
function psParams(args,positional=[]){const named={},rest=[];for(let i=0;i<args.length;i++){const a=args[i];if(/^-[A-Za-z]+$/.test(a)){const key=a.slice(1).toLowerCase();const next=args[i+1];if(next!==undefined&&!/^-[A-Za-z]+$/.test(next)&&!['recurse','force','name','file','directory','nonewline','wait','list'].includes(key)){named[key]=next;i++}else named[key]=true}else rest.push(a)}positional.forEach((p,i)=>{if(rest[i]!==undefined&&named[p]===undefined)named[p]=rest[i]});return{named,rest}}
TerminalEngine.prototype.ps={
  async 'Get-ChildItem'(ctx){
    const{named,rest}=psParams(ctx.args,['path']);const fs=ctx.fs,t=ctx.t;let path=named.path||named.literalpath||'.';let filter=named.filter||named.include||null;if(/[*?]/.test(path)){const i=Math.max(path.lastIndexOf('\\'),path.lastIndexOf('/'));filter=path.slice(i+1);path=i>=0?path.slice(0,i)||'\\':'.'}
    if(!fs.exists(path,t.cwd))return psErr(ctx,`Get-ChildItem : Der Pfad "${pathDisplay(t.os,fs.normalize(path,t.cwd))}" kann nicht gefunden werden, da er nicht vorhanden ist.`);
    const out=[];const walk=p=>{let entries=fs.list(p,t.cwd).filter(e=>named.force||!e.name.startsWith('.')&&!e.name.startsWith('$'));if(named.file)entries=entries.filter(e=>e.type==='file');if(named.directory)entries=entries.filter(e=>e.type==='dir');const shown=filter?entries.filter(e=>globToRegExp(filter,true).test(e.name)):entries;if(named.name){ctx.out(shown.map(e=>e.name).join('\n')+(shown.length?'\n':''))}else if(shown.length){out.push(`\n    Verzeichnis: ${pathDisplay(t.os,fs.normalize(p,t.cwd))}\n\n\nMode                 LastWriteTime         Length Name\n----                 -------------         ------ ----\n`+shown.map(e=>`${e.type==='dir'?'d-----':'-a----'}        ${winDate(e.mtime).replace('  ','     ')}${e.type==='dir'?'               ':String(e.size).padStart(15)} ${e.name}`).join('\n')+'\n')}if(named.recurse)fs.list(p,t.cwd).filter(e=>e.type==='dir').forEach(e=>walk(joinPath(fs.normalize(p,t.cwd),e.name)))};
    walk(path);if(out.length)ctx.out(out.join('')+'\n\n');return 0;
  },
  async 'Set-Location'(ctx){const{named}=psParams(ctx.args,['path']);const t=ctx.t;const target=named.path||'~';const p=target==='~'?homePath(t.os):ctx.fs.normalize(target,t.cwd);if(!ctx.fs.isDir(p))return psErr(ctx,`Set-Location : Der Pfad "${pathDisplay(t.os,p)}" kann nicht gefunden werden, da er nicht vorhanden ist.`);t.prevCwd=t.cwd;t.cwd=ctx.fs.realPath(p);return 0},
  async 'Get-Location'(ctx){ctx.out(`\nPath\n----\n${pathDisplay(ctx.os,ctx.t.cwd)}\n\n\n`);return 0},
  async 'Get-Content'(ctx){const{named}=psParams(ctx.args,['path']);if(!named.path)return psErr(ctx,'Get-Content : Der Parameter "Path" fehlt.');const node=ctx.fs.locate(named.path,ctx.t.cwd);if(!node||node.type!=='file')return psErr(ctx,`Get-Content : Der Pfad "${pathDisplay(ctx.os,ctx.fs.normalize(named.path,ctx.t.cwd))}" kann nicht gefunden werden, da er nicht vorhanden ist.`);let lines=(node.enc?binaryNoise(node):node.content).replace(/\n$/,'').split('\n');if(named.totalcount||named.head||named.first)lines=lines.slice(0,+(named.totalcount||named.head||named.first));if(named.tail||named.last)lines=lines.slice(-(+(named.tail||named.last)));ctx.out(lines.join('\n')+'\n');return 0},
  async 'Set-Content'(ctx){const{named}=psParams(ctx.args,['path','value']);const value=named.value!==undefined?named.value:await ctx.input();try{ctx.fs.write(named.path,String(value).replace(/\n?$/,'\n'),ctx.t.cwd);ctx.app.notifyFiles?.();return 0}catch{return psErr(ctx,'Set-Content : Ein Teil des Pfades konnte nicht gefunden werden.')}},
  async 'Add-Content'(ctx){const{named}=psParams(ctx.args,['path','value']);try{ctx.fs.write(named.path,String(named.value??await ctx.input()).replace(/\n?$/,'\n'),ctx.t.cwd,true);ctx.app.notifyFiles?.();return 0}catch{return psErr(ctx,'Add-Content : Ein Teil des Pfades konnte nicht gefunden werden.')}},
  async 'Out-File'(ctx){const{named}=psParams(ctx.args,['filepath']);ctx.fs.write(named.filepath,(await ctx.input()).replace(/\x1b\[[0-9;]*m/g,''),ctx.t.cwd,Boolean(named.append));ctx.app.notifyFiles?.();return 0},
  async 'New-Item'(ctx){const{named}=psParams(ctx.args,['path']);const name=named.path&&named.name?joinPath(ctx.fs.normalize(named.path,ctx.t.cwd),named.name):named.path||named.name;if(!name)return psErr(ctx,'New-Item : Der Parameter "Path" fehlt.');const dir=String(named.itemtype||'').toLowerCase()==='directory'||/^(mkdir|md)$/i.test(ctx.argv[0]);if(ctx.fs.exists(name,ctx.t.cwd)&&!named.force)return psErr(ctx,`New-Item : Ein Element mit dem angegebenen Namen ${pathDisplay(ctx.os,ctx.fs.normalize(name,ctx.t.cwd))} ist bereits vorhanden.`,'ResourceExists','DirectoryExist,Microsoft.PowerShell.Commands.NewItemCommand');try{if(dir)ctx.fs.mkdir(name,ctx.t.cwd,true);else ctx.fs.write(name,named.value??'',ctx.t.cwd)}catch{return psErr(ctx,'New-Item : Ein Teil des Pfades konnte nicht gefunden werden.')}const st=ctx.fs.stat(name,ctx.t.cwd);ctx.out(`\n\n    Verzeichnis: ${pathDisplay(ctx.os,ctx.fs.normalize(name,ctx.t.cwd).replace(/\/[^/]*$/,'')||'/')}\n\n\nMode                 LastWriteTime         Length Name\n----                 -------------         ------ ----\n${dir?'d-----':'-a----'}        ${winDate(st.mtime).replace('  ','     ')}${dir?'               ':String(st.size).padStart(15)} ${name.split(/[\\/]/).pop()}\n\n\n`);ctx.app.notifyFiles?.();return 0},
  async 'Remove-Item'(ctx){const{named,rest}=psParams(ctx.args,['path']);const targets=rest.length?rest:[named.path];let code=0;for(const p of targets.filter(Boolean)){const node=ctx.fs.locate(p,ctx.t.cwd);if(!node){code=psErr(ctx,`Remove-Item : Der Pfad "${pathDisplay(ctx.os,ctx.fs.normalize(p,ctx.t.cwd))}" kann nicht gefunden werden, da er nicht vorhanden ist.`);continue}if(node.type==='dir'&&Object.keys(node.children).length&&!named.recurse){ctx.out(`\nBestätigen\nDas Element unter "${pathDisplay(ctx.os,ctx.fs.normalize(p,ctx.t.cwd))}" verfügt über untergeordnete Elemente, und der Recurse-Parameter wurde nicht\nangegeben. Wenn Sie fortfahren, werden alle untergeordneten Elemente mit dem Element entfernt. Möchten Sie den Vorgang\nwirklich fortsetzen?\n[J] Ja  [A] Ja, alle  [N] Nein  [K] Nein, keine  [H] Anhalten  [?] Hilfe (Standard ist "J"): `);const a=await ctx.readLine();if(a&&!/^[jJaA]/.test(a))continue}ctx.fs.remove(p,ctx.t.cwd,true)}ctx.app.notifyFiles?.();return code},
  async 'Copy-Item'(ctx){const{named,rest}=psParams(ctx.args,['path','destination']);try{ctx.fs.copy(named.path||rest[0],named.destination||rest[1],ctx.t.cwd,Boolean(named.recurse));ctx.app.notifyFiles?.();return 0}catch{return psErr(ctx,`Copy-Item : Der Pfad "${named.path||rest[0]}" kann nicht gefunden werden, da er nicht vorhanden ist.`)}},
  async 'Move-Item'(ctx){const{named,rest}=psParams(ctx.args,['path','destination']);try{ctx.fs.move(named.path||rest[0],named.destination||rest[1],ctx.t.cwd);ctx.app.notifyFiles?.();return 0}catch{return psErr(ctx,`Move-Item : Der Pfad "${named.path||rest[0]}" kann nicht gefunden werden, da er nicht vorhanden ist.`)}},
  async 'Rename-Item'(ctx){const{named,rest}=psParams(ctx.args,['path','newname']);const src=ctx.fs.normalize(named.path||rest[0],ctx.t.cwd);if(!ctx.fs.exists(src))return psErr(ctx,`Rename-Item : Das Element unter "${pathDisplay(ctx.os,src)}" kann nicht umbenannt werden, da es nicht vorhanden ist.`);ctx.fs.move(src,joinPath(src.replace(/\/[^/]*$/,'')||'/',named.newname||rest[1]));ctx.app.notifyFiles?.();return 0},
  async 'Test-Path'(ctx){const{named}=psParams(ctx.args,['path']);ctx.out((ctx.fs.exists(named.path,ctx.t.cwd)?'True':'False')+'\n');return 0},
  async 'Get-Item'(ctx){return ctx.engine.ps['Get-ChildItem'].call(this,ctx)},
  async 'Resolve-Path'(ctx){const{named}=psParams(ctx.args,['path']);ctx.out(`\nPath\n----\n${pathDisplay(ctx.os,ctx.fs.normalize(named.path||'.',ctx.t.cwd))}\n\n\n`);return 0},
  async 'Split-Path'(ctx){const{named}=psParams(ctx.args,['path']);const p=String(named.path||'');ctx.out((named.leaf?p.split(/[\\/]/).pop():p.replace(/[\\/][^\\/]*$/,''))+'\n');return 0},
  async 'Join-Path'(ctx){const{named,rest}=psParams(ctx.args,['path','childpath']);ctx.out(`${String(named.path||rest[0]).replace(/[\\/]$/,'')}\\${named.childpath||rest[1]}\n`);return 0},
  async 'Write-Host'(ctx){const{named,rest}=psParams(ctx.args);const colors={black:30,darkblue:34,darkgreen:32,darkcyan:36,darkred:31,darkmagenta:35,darkyellow:33,gray:37,darkgray:90,blue:94,green:92,cyan:96,red:91,magenta:95,yellow:93,white:97};const fg=colors[String(named.foregroundcolor||named.f||'').toLowerCase()];const bg=colors[String(named.backgroundcolor||'').toLowerCase()];const text=rest.join(' ')+(named.object&&named.object!==true?named.object:'');ctx.out((fg||bg?`\x1b[${[fg,bg?bg+10:null].filter(Boolean).join(';')}m${text}${C.reset}`:text)+(named.nonewline?'':'\n'));return 0},
  async 'Write-Output'(ctx){ctx.out(ctx.args.map(a=>a+'\n').join(''));return 0},
  async 'Read-Host'(ctx){const{named,rest}=psParams(ctx.args,['prompt']);ctx.out((named.prompt||rest[0]||'')+': ');const line=await ctx.readLine();if(named.assecurestring)ctx.out('System.Security.SecureString\n');else ctx.out((line??'')+'\n');return 0},
  async 'Get-Process'(ctx){const{base,wins}=ctx.engine.procList(ctx.t);ctx.out('\nHandles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n'+[...base,...wins].map(([n,p])=>`${String(200+p%900).padStart(7)} ${String(10+p%40).padStart(7)} ${String(2000+p*13).padStart(8)} ${String(8000+p*29).padStart(10)} ${(p%17/3).toFixed(2).replace('.',',').padStart(10)} ${String(p).padStart(6)} ${p>4000?' 1':' 0'} ${n.replace(/\.exe$/,'')}`).join('\n')+'\n\n');return 0},
  async 'Stop-Process'(ctx){const{named,rest}=psParams(ctx.args,['id']);const{wins}=ctx.engine.procList(ctx.t);const hits=wins.filter(w=>named.name?w[0].replace(/\.exe$/,'').toLowerCase()===String(named.name).toLowerCase():w[1]===Number(named.id||rest[0]));if(!hits.length)return psErr(ctx,`Stop-Process : Es kann kein Prozess mit dem ${named.name?'Namen "'+named.name+'"':'Bezeichner '+(named.id||rest[0])} gefunden werden.`,'ObjectNotFound','NoProcessFoundForGivenId,Microsoft.PowerShell.Commands.StopProcessCommand');hits.forEach(w=>setTimeout(()=>ctx.app.closeWindowById?.(w[3]),50));return 0},
  async 'Get-Service'(ctx){ctx.out('\nStatus   Name               DisplayName\n------   ----               -----------\nRunning  AudioSrv           Windows-Audio\nRunning  Dhcp               DHCP-Client\nRunning  Dnscache           DNS-Client\nStopped  Fax                Fax\nRunning  LanmanWorkstation  Arbeitsstationsdienst\nRunning  Spooler            Druckwarteschlange\nRunning  WinDefend          Microsoft Defender Antivirus-Dienst\nRunning  wuauserv           Windows Update\n\n');return 0},
  async 'Get-Date'(ctx){const{named}=psParams(ctx.args);const d=new Date();if(named.format){ctx.out(String(named.format).replace(/yyyy/g,d.getFullYear()).replace(/MM/g,pad2(d.getMonth()+1)).replace(/dd/g,pad2(d.getDate())).replace(/HH/g,pad2(d.getHours())).replace(/mm/g,pad2(d.getMinutes())).replace(/ss/g,pad2(d.getSeconds()))+'\n');return 0}ctx.out(`\n${d.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} ${d.toLocaleTimeString('de-DE')}\n\n\n`);return 0},
  async 'Get-Command'(ctx){const{rest}=psParams(ctx.args,['name']);const list=PS_CMDLETS.filter(c=>!rest[0]||globToRegExp(rest[0],true).test(c));ctx.out('\nCommandType     Name                                               Version    Source\n-----------     ----                                               -------    ------\n'+list.map(c=>`Cmdlet          ${c.padEnd(50)} 3.1.0.0    Microsoft.PowerShell.${/Item|Content|Location|Path|ChildItem/.test(c)?'Management':'Utility'}`).join('\n')+'\n\n');return 0},
  async 'Get-Help'(ctx){const n=ctx.args[0];if(n){const c=PS_ALIASES[n.toLowerCase()]||PS_CMDLETS.find(x=>x.toLowerCase()===n.toLowerCase());ctx.out(c?`\nNAME\n    ${c}\n\nÜBERSICHT\n    ${PS_HELP[c]||'Cmdlet von Windows PowerShell 5.1 (DesktopSim-Teilumfang).'}\n\nSYNTAX\n    ${c} [[-Path] <String>] [<CommonParameters>]\n\nALIASE\n    ${Object.entries(PS_ALIASES).filter(([,v])=>v===c).map(([k])=>k).join(', ')||'Keine'}\n\n`:`Get-Help : Für "${n}" wurde keine Hilfe gefunden.\n`);return 0}ctx.out(shellHelp(ctx.os)+'\n');return 0},
  async 'Clear-Host'(ctx){if(ctx.t.io?.clear)ctx.t.io.clear();else ctx.out('__CLEAR__');return 0},
  async 'Get-History'(ctx){ctx.out('\n  Id CommandLine\n  -- -----------\n'+ctx.t.history.map((h,i)=>`${String(i+1).padStart(4)} ${h}`).join('\n')+'\n\n');return 0},
  async 'Select-String'(ctx){const{named,rest}=psParams(ctx.args,['pattern','path']);const rx=new RegExp(named.pattern,named.casesensitive?'':'i');if(named.path){const files=/[*?]/.test(named.path)?ctx.fs.list('.',ctx.t.cwd).filter(e=>e.type==='file'&&globToRegExp(named.path,true).test(e.name)).map(e=>e.name):[named.path];for(const f of files){try{ctx.fs.read(f,ctx.t.cwd).split('\n').forEach((l,i)=>{if(rx.test(l))ctx.out(`\n${f}:${i+1}:${l}`)})}catch{}}ctx.out('\n\n');return 0}(await ctx.input()).split('\n').filter(l=>rx.test(l)).forEach(l=>ctx.out('\n'+l));ctx.out('\n\n');return 0},
  async 'Measure-Object'(ctx){const text=await ctx.input();const{named}=psParams(ctx.args);const lines=text.replace(/\n$/,'').split('\n').filter(l=>l.trim());if(named.line||named.word||named.character){ctx.out(`\nLines Words Characters Property\n----- ----- ---------- --------\n${String(lines.length).padStart(5)} ${String((text.match(/\S+/g)||[]).length).padStart(5)} ${String(text.length).padStart(10)}\n\n`);return 0}ctx.out(`\n\nCount    : ${lines.length}\nAverage  :\nSum      :\nMaximum  :\nMinimum  :\nProperty :\n\n\n`);return 0},
  async 'Sort-Object'(ctx){const{named}=psParams(ctx.args);const lines=(await ctx.input()).replace(/\n$/,'').split('\n').sort((a,b)=>a.localeCompare(b,'de'));if(named.descending)lines.reverse();ctx.out(lines.join('\n')+'\n');return 0},
  async 'Select-Object'(ctx){const{named}=psParams(ctx.args);let lines=(await ctx.input()).replace(/\n$/,'').split('\n');if(named.first)lines=lines.slice(0,+named.first);if(named.last)lines=lines.slice(-named.last);ctx.out(lines.join('\n')+'\n');return 0},
  async 'Where-Object'(ctx){const block=ctx.args.join(' ');const m=block.match(/-(like|match|eq|ne|notlike)\s+["']?([^"']+)["']?/i);const lines=(await ctx.input()).replace(/\n$/,'').split('\n');if(!m){ctx.out(lines.join('\n')+'\n');return 0}const op=m[1].toLowerCase(),v=m[2];const test=l=>op==='like'?globToRegExp(v,true).test(l.trim().split(/\s+/).pop()):op==='notlike'?!globToRegExp(v,true).test(l.trim().split(/\s+/).pop()):op==='match'?new RegExp(v,'i').test(l):op==='eq'?l.trim().toLowerCase().endsWith(v.toLowerCase()):!l.includes(v);ctx.out(lines.filter(l=>/^(Mode|----|\s*$|\s+Verzeichnis)/.test(l)||test(l)).join('\n')+'\n');return 0},
  async 'ForEach-Object'(ctx){ctx.out(await ctx.input());return 0},
  async 'Format-Table'(ctx){ctx.out(await ctx.input());return 0},async 'Format-List'(ctx){ctx.out(await ctx.input());return 0},async 'Out-Host'(ctx){ctx.out(await ctx.input());return 0},
  async 'Get-Member'(ctx){ctx.out('\n   TypeName: System.String\n\nName             MemberType            Definition\n----             ----------            ----------\nLength           Property              int Length {get;}\nToUpper          Method                string ToUpper()\nSplit            Method                string[] Split(...)\n\n');return 0},
  async 'Get-ComputerInfo'(ctx){ctx.out(`\nWindowsProductName           : ${getOS(ctx.os).label} Pro\nWindowsVersion               : ${ctx.os==='win11'?'24H2':'22H2'}\nOsBuildNumber                : ${versions[ctx.os].split('.')[2]}\nCsName                       : DESKTOP-SIM\nCsManufacturer               : DesktopSim\nCsModel                      : Browser Virtual Machine\nCsTotalPhysicalMemory        : 17179869184\nOsLanguage                   : de-DE\nTimeZone                     : (UTC+01:00) Amsterdam, Berlin, Bern, Rom, Stockholm, Wien\n\n`);return 0},
  async 'Start-Process'(ctx){return ctx.engine.programs.open(ctx)},
  async 'Invoke-WebRequest'(ctx){return ctx.engine.programs.curl(ctx)},
  async 'Get-Alias'(ctx){ctx.out('\nCommandType     Name\n-----------     ----\n'+Object.entries(PS_ALIASES).map(([k,v])=>`Alias           ${k} -> ${v}`).join('\n')+'\n\n');return 0},
  async 'Set-ExecutionPolicy'(ctx){const{named,rest}=psParams(ctx.args,['executionpolicy']);const pol=named.executionpolicy||rest[0];if(!pol)return psErr(ctx,'Set-ExecutionPolicy : Der Parameter "ExecutionPolicy" fehlt.');if(!/currentuser/i.test(named.scope||'')&&!ctx.t.admin){return psErr(ctx,'Set-ExecutionPolicy : Der Zugriff auf den Registrierungsschlüssel "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\PowerShell\\1\\ShellIds\\Microsoft.PowerShell" wurde verweigert.\nUm die Ausführungsrichtlinie für den Standardbereich (LocalMachine) zu ändern, starten Sie Windows PowerShell mit der Option "Als Administrator ausführen".\nUm die Ausführungsrichtlinie für den aktuellen Benutzer zu ändern, führen Sie "Set-ExecutionPolicy -Scope CurrentUser" aus.','PermissionDenied','System.UnauthorizedAccessException')}ctx.out('\nÄnderung der Ausführungsrichtlinie\nDie Ausführungsrichtlinie trägt zum Schutz vor nicht vertrauenswürdigen Skripts bei. Wenn Sie die Ausführungsrichtlinie ändern,\nsind Sie möglicherweise den im Hilfethema "about_Execution_Policies" beschriebenen Sicherheitsrisiken ausgesetzt.\nMöchten Sie die Ausführungsrichtlinie ändern?\n[J] Ja  [A] Ja, alle  [N] Nein  [K] Nein, keine  [H] Anhalten  [?] Hilfe (Standard ist "N"): ');const a=await ctx.readLine();if(/^[jJaA]/.test(a||'')){ctx.app.setSetting?.('psPolicy',String(pol));}return 0},
  async 'Get-ExecutionPolicy'(ctx){ctx.out((ctx.app.getSetting?.('psPolicy')||'Restricted')+'\n');return 0},
  async 'Start-Sleep'(ctx){const{named,rest}=psParams(ctx.args,['seconds']);const ms=named.milliseconds?+named.milliseconds:(+(named.seconds||rest[0]||1))*1000;const sig={};ctx.t.cancelHooks?.add(()=>sig.onCancel?.());await sleep(Math.min(ms,600000),sig);return 0},
  async 'Get-Random'(ctx){const{named}=psParams(ctx.args);const min=+(named.minimum||0),max=+(named.maximum||2147483647);ctx.out(Math.floor(min+Math.random()*(max-min))+'\n');return 0},
  async 'Get-NetIPAddress'(ctx){ctx.out('\nIPAddress         : 192.168.178.42\nInterfaceIndex    : 12\nInterfaceAlias    : Ethernet\nAddressFamily     : IPv4\nPrefixLength      : 24\nPrefixOrigin      : Dhcp\n\n');return 0},
  async 'Test-Connection'(ctx){const{named,rest}=psParams(ctx.args,['computername']);const host=named.computername||named.targetname||rest[0]||'localhost';ctx.out('\nSource        Destination     IPV4Address      IPV6Address                              Bytes    Time(ms)\n------        -----------     -----------      -----------                              -----    --------\n');for(let i=0;i<+(named.count||4);i++){await sleep(400);if(ctx.t.cancelled)return 130;ctx.out(`DESKTOP-SIM   ${host.padEnd(15)} 185.199.108.153                                           32       ${12+Math.floor(Math.random()*8)}\n`)}ctx.out('\n');return 0},
  async 'Stop-Computer'(ctx){ctx.app.power?.('shutdown');return 0},async 'Restart-Computer'(ctx){ctx.app.power?.('restart');return 0},
  async Exit(ctx){throw new ExitShell(Number(ctx.args[0])||0)},
  async 'Get-Variable'(ctx){ctx.out('\nName                           Value\n----                           -----\n'+Object.entries(ctx.t.vars).filter(([k])=>k.startsWith('$')).map(([k,v])=>`${k.slice(1).padEnd(30)} ${v}`).join('\n')+'\n\n');return 0},
  async 'Get-Host'(ctx){ctx.out('\nName             : ConsoleHost\nVersion          : 5.1.26100.2605\nCurrentCulture   : de-DE\nCurrentUICulture : de-DE\n\n');return 0}
};
const PS_HELP={'Get-ChildItem':'Ruft die Elemente und untergeordneten Elemente an einem oder mehreren angegebenen Speicherorten ab.','Set-Location':'Legt den aktuellen Arbeitsspeicherort auf einen angegebenen Speicherort fest.','Get-Content':'Ruft den Inhalt des Elements am angegebenen Speicherort ab.','New-Item':'Erstellt ein neues Element.','Remove-Item':'Löscht die angegebenen Elemente.','Write-Host':'Schreibt benutzerdefinierte Ausgaben in einen Host.','Read-Host':'Liest eine Eingabezeile aus der Konsole.'};

// ======================= Hilfsfunktionen =======================
function humanSize(b){if(b<1024)return String(b);const u=['K','M','G'];let v=b,i=-1;do{v/=1024;i++}while(v>=1024&&i<2);return(v<10?v.toFixed(1).replace('.',','):Math.round(v))+u[i]}
function unescape(s){return String(s).replace(/\\(n|t|e|\\|a|r|0[0-7]*|x[0-9a-fA-F]{1,2}|033)/g,(m,k)=>k==='n'?'\n':k==='t'?'\t':k==='e'||k==='033'?'\x1b':k==='\\'?'\\':k==='r'?'\r':k==='a'?'':k[0]==='x'?String.fromCharCode(parseInt(k.slice(1),16)):String.fromCharCode(parseInt(k,8)))}
function binaryNoise(node){if(node.enc==='wasm')return'\0asm\x01\0\0\0\x01\x8c\x01\x16`\x03\x7f\x7f\x7f\x01\x7f`\x01\x7f\0`\x02\x7f\x7f\x01\x7f ... [WebAssembly-Binärdatei]\n';if(node.enc==='jclass')return'\xca\xfe\xba\xbe\0\0\x004\0\x1d\n ... [Java-Bytecode]\n';if(node.enc==='sqlite')return'SQLite format 3\0\x10\0\x01\x01\0@  ... [SQLite-Datenbank]\n';if(node.enc==='exe')return'MZ\x90\0\x03\0\0\0\x04\0\0\0\xff\xff  This program cannot be run in DOS mode.\n';return'[Binärdatei]\n'}
export function describeFile(name,node){if(node.type==='dir')return'directory';if(node.enc==='wasm')return'WebAssembly (wasm) binary module version 0x1 (MVP)';if(node.enc==='jclass')return'compiled Java class data, version 52.0 (Java 1.8)';if(node.enc==='sqlite')return'SQLite 3.x database, last written using SQLite version 3049001';if(node.enc==='exe')return'PE32+ executable (GUI) x86-64, for MS Windows';if(node.enc==='b64')return/\.png$/i.test(name)?'PNG image data':'data';const c=node.content;if(!c.length)return'empty';if(c.startsWith('#!')){const i=c.split('\n')[0];return/python/.test(i)?'Python script, UTF-8 Unicode text executable':`${i.split('/').pop().split(' ')[0]==='bash'?'Bourne-Again shell':'POSIX shell'} script, UTF-8 Unicode text executable`}const ext=extName(name);const kinds={py:'Python script, UTF-8 Unicode text',js:'JavaScript source, UTF-8 Unicode text',html:'HTML document, UTF-8 Unicode text',c:'C source, ASCII text',cpp:'C++ source, ASCII text',h:'C header, ASCII text',java:'Java source, UTF-8 Unicode text',php:'PHP script, UTF-8 Unicode text',json:'JSON text data',md:'Markdown document, UTF-8 Unicode text',sql:'ASCII text',csv:'CSV text'};return kinds[ext]||(/[^\x00-\x7f]/.test(c)?'UTF-8 Unicode text':'ASCII text')}
async function readInputs(ctx,files){if(!files.length)return ctx.input();let text='';for(const f of files){try{text+=ctx.fs.read(f,ctx.t.cwd)}catch{ctx.err(`${ctx.name}: ${f}: Datei oder Verzeichnis nicht gefunden\n`);return null}}return text}
async function headTail(ctx,kind){const args=[...ctx.args];let n=10;const files=[];while(args.length){const a=args.shift();if(a==='-n')n=parseInt(args.shift());else if(/^-n?\d+$/.test(a))n=parseInt(a.replace(/^-n?/,''));else if(a==='-f'){continue}else files.push(a)}const run=(text,label)=>{if(label&&files.length>1)ctx.out(`==> ${label} <==\n`);const lines=text.replace(/\n$/,'').split('\n');ctx.out((kind==='head'?lines.slice(0,n):lines.slice(-n)).join('\n')+'\n')};if(!files.length){run(await ctx.input());return 0}let code=0;for(const f of files){try{run(ctx.fs.read(f,ctx.t.cwd),f)}catch{ctx.err(`${kind}: '${f}' kann nicht zum Lesen geöffnet werden: Datei oder Verzeichnis nicht gefunden\n`);code=1}}return code}
function evalTest(args,ctx){const fs=ctx.fs,t=ctx.t;if(!args.length)return false;if(args[0]==='!')return!evalTest(args.slice(1),ctx);const i=args.findIndex(a=>a==='-a'||a==='-o'||a==='&&'||a==='||');if(i>0){const l=evalTest(args.slice(0,i),ctx),r=evalTest(args.slice(i+1),ctx);return/^-a|&&$/.test(args[i])?l&&r:l||r}if(args.length===1)return args[0]!=='';if(args.length===2){const[op,v]=args;if(op==='-f')return fs.locate(v,t.cwd)?.type==='file';if(op==='-d')return fs.locate(v,t.cwd)?.type==='dir';if(op==='-e')return fs.exists(v,t.cwd);if(op==='-z')return v==='';if(op==='-n')return v!=='';if(op==='-x')return Boolean(fs.locate(v,t.cwd)&&(fs.stat(v,t.cwd).mode&0o111));if(op==='-s')return fs.locate(v,t.cwd)?.type==='file'&&fs.stat(v,t.cwd).size>0;if(op==='-r'||op==='-w')return fs.exists(v,t.cwd);return false}const[a,op,b]=args;const na=Number(a),nb=Number(b);switch(op){case'=':case'==':return a===b;case'!=':return a!==b;case'-eq':return na===nb;case'-ne':return na!==nb;case'-lt':return na<nb;case'-le':return na<=nb;case'-gt':return na>nb;case'-ge':return na>=nb;case'<':return a<b;case'>':return a>b}return false}
function diffLines(a,b){if(a.join('\n')===b.join('\n'))return'';const n=a.length,m=b.length;const dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);let i=0,j=0,out='';const hunks=[];while(i<n||j<m){if(i<n&&j<m&&a[i]===b[j]){i++;j++;continue}const si=i,sj=j;while((i<n||j<m)&&!(i<n&&j<m&&a[i]===b[j])){if(j>=m||(i<n&&dp[i+1][j]>=dp[i][j+1]))i++;else j++}hunks.push([si,i,sj,j])}for(const[a1,a2,b1,b2]of hunks){const r=(x,y)=>x+1===y?String(y):x===y?String(x):`${x+1},${y}`;const op=a1===a2?'a':b1===b2?'d':'c';out+=`${op==='a'?a1:r(a1,a2)}${op}${op==='d'?b1:r(b1,b2)}\n`;for(let k=a1;k<a2;k++)out+=`< ${a[k]}\n`;if(op==='c')out+='---\n';for(let k=b1;k<b2;k++)out+=`> ${b[k]}\n`}return out}
export {C as ANSI,sleep,ExitShell,binaryNoise,humanSize,psErr};
