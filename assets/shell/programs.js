// Programme, die in allen Shells verfügbar sind: echte Sprachlaufzeiten, Paketmanager, Netzwerk & Spielereien.
import {isWindows,homePath,pathDisplay,joinPath,extName,getOS} from '../vfs.js';
import {simulateCompiled,simulatePython,compileSource,MiniSQL} from '../runtimes.js';

export const INSTALLABLE={
  cowsay:{v:'3.03+dfsg2-8',kb:18.6},sl:{v:'5.02-1+b1',kb:13.2},neofetch:{v:'7.1.0-4',kb:84.1,debian:false},fastfetch:{v:'2.40.4+dfsg-1',kb:512},htop:{v:'3.4.0-2',kb:171},
  figlet:{v:'2.2.5-3+b1',kb:136},fortune:{v:'1:1.99.1-7.3',kb:24,apt:'fortune-mod'},cmatrix:{v:'2.0-6',kb:19.4},lolcat:{v:'100.0.1-3',kb:9.8}
};
const ALREADY=new Set(['python3','python3-pip','gcc','g++','build-essential','nodejs','npm','default-jdk','openjdk-17-jdk','php','php-cli','sqlite3','git','curl','wget','vim','nano','bash','coreutils','python','jdk-openjdk','base-devel','clang','tree','sudo','man-db']);
const C={reset:'\x1b[0m',bold:'\x1b[1m',red:'\x1b[31m',green:'\x1b[32m',yellow:'\x1b[33m',blue:'\x1b[34m',magenta:'\x1b[35m',cyan:'\x1b[36m',gray:'\x1b[90m',white:'\x1b[37m'};
const sleep=(ms,t)=>new Promise(r=>{const id=setTimeout(r,ms);t?.cancelHooks?.add(()=>{clearTimeout(id);r()})});
const CLANG_FLAGS=['-fcolor-diagnostics','-fno-exceptions','-D_WASI_EMULATED_SIGNAL','-D_WASI_EMULATED_PROCESS_CLOCKS','-lwasi-emulated-signal','-lwasi-emulated-process-clocks','-Wl,-z,stack-size=8388608'];
const LANG_NAMES={python:['python','python3','py'],pip:['pip','pip3'],node:['node','nodejs'],npm:['npm','npx'],javac:['javac'],java:['java'],c:['gcc','cc','clang'],cpp:['g++','c++','clang++'],php:['php'],sqlite:['sqlite3','mysql','psql'],dotnet:['dotnet','csc'],git:['git'],curl:['curl','wget'],ssh:['ssh','telnet','scp','ftp'],make:['make','cmake'],editor:['code','ide','gedit','kate','kwrite','mousepad','dtpad','gnome-text-editor'],open:['xdg-open','open','gio'],fun:['fun','matrix','party','byte'],pkg:['apt','apt-get','dpkg','pacman','yay','brew','winget','choco','pkg','pkgutil','snap','flatpak'],fake:['cowsay','sl','figlet','fortune','cmatrix','lolcat'],nslookup:['nslookup','dig','host'],trace:['traceroute'],man:['man']};

export class Programs{
  constructor(engine){this.engine=engine;this.binaries=new Map();this.javaHashes=new Map()}
  get app(){return this.engine.app}
  names(t){const win=isWindows(t.os);const out=[];for(const[k,list]of Object.entries(LANG_NAMES)){if(k==='pkg'){out.push(...(win?['winget']:t.os==='debian'?['apt','apt-get','dpkg']:t.os==='arch'?['pacman']:t.os==='macos'?['brew']:['pkg']));continue}if(k==='fake'){out.push(...list.filter(n=>this.isInstalled(n,t)));continue}if(win&&['ssh','make','nslookup','trace'].includes(k)&&k!=='ssh')continue;if(win&&k==='open')continue;if(!win&&k==='man')continue;out.push(...list.filter(n=>!(win&&['python3','cc','c++','gedit','kate','kwrite','mousepad','dtpad','gnome-text-editor','nodejs'].includes(n))))}if(!win&&this.isInstalled('neofetch',t))out.push('neofetch');return out}
  has(name,t){return this.names(t).includes(name)||(isWindows(t.os)&&['python3','nslookup'].includes(name))}
  pkgKey(t){return'desktopsim-v3-pkgs-'+t.os}
  installed(t){try{return new Set(JSON.parse(localStorage.getItem(this.pkgKey(t))||'[]'))}catch{return new Set()}}
  isInstalled(name,t){if(t.os==='arch'&&name==='fastfetch')return true;return this.installed(t).has(name)}
  setInstalled(t,name,on=true){const s=this.installed(t);on?s.add(name):s.delete(name);try{localStorage.setItem(this.pkgKey(t),JSON.stringify([...s]))}catch{}}
  runtimeIO(ctx){return{write:(text,stream)=>stream==='stderr'?ctx.err(text):ctx.out(text),status:s=>ctx.io.status?.(s),image:src=>ctx.io.image?.(src),readLine:async()=>{const l=await ctx.readLine();return l===null?null:l+'\n'}}}
  async job(ctx,handle){ctx.t.cancelHooks?.add(()=>handle.cancel());const result=await handle.promise;ctx.io.status?.('');return result}
  dirOf(ctx){return ctx.t.cwd}
  apply(ctx,files){if(files&&Object.keys(files).length){this.app.fs.applyChanges(ctx.t.cwd,files);this.app.notifyFiles?.()}}
  async run(name,ctx){
    const k=Object.entries(LANG_NAMES).find(([,l])=>l.includes(name))?.[0]||(name==='python3'?'python':name==='nslookup'?'nslookup':name);
    const fn={python:this.python,pip:this.pip,node:this.node,npm:this.npm,javac:this.javac,java:this.java,c:this.cc,cpp:this.cc,php:this.php,sqlite:this.sqlite3,dotnet:this.dotnet,git:this.git,curl:this.curl,ssh:this.ssh,make:this.make,editor:this.editorProgram,open:this.open,fun:this.fun,pkg:this.packageManager,fake:this.toy,nslookup:this.nslookup,trace:this.traceroute,man:this.man}[k];
    if(!fn)return this.engine.notFound(name,ctx.t,ctx.io);
    return fn.call(this,ctx);
  }

  // ---------- Python ----------
  async python(ctx){
    const args=ctx.args,rt=this.app.runtimes;
    if(args[0]==='--version'||args[0]==='-V'){ctx.out('Python 3.14.2\n');return 0}
    if(args[0]==='-m'){const mod=args[1];if(mod==='http.server')return this.startServer(args[2]||'8000',ctx,'python');if(mod==='pip')return this.pip({...ctx,args:args.slice(2)});if(mod==='venv'){const dir=args[2]||'.venv';ctx.fs.mkdir(joinPath(ctx.fs.normalize(dir,ctx.t.cwd),isWindows(ctx.os)?'Scripts':'bin'),null,true);ctx.fs.write(joinPath(ctx.fs.normalize(dir,ctx.t.cwd),'pyvenv.cfg'),'home = /usr/bin\ninclude-system-site-packages = false\nversion = 3.14.2\n');ctx.fs.write(joinPath(ctx.fs.normalize(dir,ctx.t.cwd),isWindows(ctx.os)?'Scripts/activate.bat':'bin/activate'),'# virtuelle Umgebung (DesktopSim)\n');this.app.notifyFiles?.();return 0}
      const src=`import runpy, sys\nsys.argv=${JSON.stringify([mod,...args.slice(2)])}\nrunpy.run_module(${JSON.stringify(mod)}, run_name='__main__')`;return this.runPython(ctx,{source:src,entry:'__main__.py',args:args.slice(2)})}
    if(args[0]==='-c')return this.runPython(ctx,{source:args[1]||'',entry:'<string>',args:args.slice(2)});
    if(!args.length||args[0]==='-i'&&args.length===1){
      if(!rt){ctx.err('Python-REPL benötigt die Browser-Laufzeit.\n');return 1}
      const banner=`Python 3.14.2 (main, Pyodide/WebAssembly) [Clang 20] on ${isWindows(ctx.os)?'win32':ctx.os==='macos'?'darwin':'linux'}\\nType "help", "copyright", "credits" or "license" for more information.`;
      return this.runPython(ctx,{source:`import code, sys\nsys.ps1 = '>>> '\nsys.ps2 = '... '\ntry:\n    code.interact(banner="${banner}", exitmsg='', local={'__name__':'__main__'})\nexcept SystemExit:\n    pass\n`,entry:'<stdin>'});
    }
    const file=args[0];let source;try{source=ctx.fs.read(file,ctx.t.cwd)}catch{ctx.err(isWindows(ctx.os)?`${ctx.name}: can't open file '${pathDisplay(ctx.os,ctx.fs.normalize(file,ctx.t.cwd))}': [Errno 2] No such file or directory\n`:`${ctx.name}: can't open file '${ctx.fs.normalize(file,ctx.t.cwd)}': [Errno 2] No such file or directory\n`);return 2}
    const rel=ctx.fs.normalize(file,ctx.t.cwd);const entry=rel.startsWith(ctx.t.cwd+'/')?rel.slice(ctx.t.cwd.length+1):rel.split('/').pop();
    return this.runPython(ctx,{source,entry,args:args.slice(1)});
  }
  async runPython(ctx,{source,entry,args=[]}){
    const rt=this.app.runtimes;
    if(!rt){const demo=simulatePython(source);ctx.out(demo.output+'\n');return 0}
    const files=ctx.fs.snapshot(ctx.t.cwd);
    const r=await this.job(ctx,rt.runPython({source,entry,files,args,stdin:ctx.stdin??''},this.runtimeIO(ctx)));
    this.apply(ctx,r.files);
    if(r.fatal&&!r.cancelled){const demo=simulatePython(source);ctx.err(`${C.yellow}Python (Pyodide) konnte nicht geladen werden – vereinfachte Offline-Demo:${C.reset}\n`);ctx.out(demo.output+'\n');return 1}
    if(r.cancelled){ctx.err('\nKeyboardInterrupt\n');return 130}
    return r.code;
  }
  async pip(ctx){
    const[sub,...rest]=ctx.args;
    if(!sub||sub==='--version'||sub==='-V'){ctx.out(`pip 25.2 from /lib/python3.14/site-packages/pip (python 3.14)\n`);return 0}
    if(sub==='list'||sub==='freeze'){const pkgs=[['micropip','0.10.1'],['packaging','25.0'],['pip','25.2'],...(this.pipInstalled||[]).map(p=>[p,'latest'])];ctx.out(sub==='freeze'?pkgs.map(([n,v])=>`${n}==${v}`).join('\n')+'\n':'Package    Version\n---------- -------\n'+pkgs.map(([n,v])=>n.padEnd(10)+' '+v).join('\n')+'\n');return 0}
    if(sub!=='install'){ctx.err(`ERROR: unknown command "${sub}"\n`);return 1}
    const pkgs=rest.filter(a=>!a.startsWith('-'));if(!pkgs.length){ctx.err('ERROR: You must give at least one requirement to install (see "pip help install")\n');return 1}
    if(!this.app.runtimes){ctx.out(`Collecting ${pkgs.join(' ')}\nSuccessfully installed ${pkgs.join(' ')}\n`);return 0}
    for(const p of pkgs)ctx.out(`Collecting ${p}\n`);
    const r=await this.job(ctx,this.app.runtimes.pip(pkgs,this.runtimeIO(ctx)));
    (this.pipInstalled||=[]).push(...pkgs);
    ctx.out(`${C.gray}Hinweis: Pakete stammen aus dem Pyodide-Paketindex bzw. PyPI (reine Python-Wheels) und gelten für diese Sitzung.${C.reset}\n`);return r.code;
  }

  // ---------- JavaScript / Node ----------
  async node(ctx){
    const args=ctx.args,rt=this.app.runtimes;
    if(args[0]==='-v'||args[0]==='--version'){ctx.out('v22.11.0\n');return 0}
    if(args[0]==='-e'||args[0]==='-p'){const code=args[0]==='-p'?`console.log(${args[1]})`:args[1];return this.runJS(ctx,{source:code||'',entry:'[eval]',args:args.slice(2)})}
    if(!args.length){
      if(!rt){ctx.err('Node-REPL benötigt die Browser-Laufzeit.\n');return 1}
      ctx.out('Welcome to Node.js v22.11.0 (DesktopSim: Browser-JavaScript-Engine).\nType ".help" for more information.\n');
      const r=await this.job(ctx,rt.runJS({repl:true,source:'',files:ctx.fs.snapshot(ctx.t.cwd),platform:isWindows(ctx.os)?'win32':ctx.os==='macos'?'darwin':'linux'},this.runtimeIO(ctx)));return r.code;
    }
    const file=/\.(c|m)?js$/.test(args[0])||ctx.fs.exists(args[0],ctx.t.cwd)?args[0]:args[0]+'.js';let source;
    try{source=ctx.fs.read(file,ctx.t.cwd)}catch{ctx.err(`node:internal/modules/cjs/loader:1228\n  throw err;\n  ^\n\nError: Cannot find module '${ctx.fs.normalize(file,ctx.t.cwd)}'\n    at Module._resolveFilename (node:internal/modules/cjs/loader:1225:15)\n    at node:internal/main/run_main_module:28:49 {\n  code: 'MODULE_NOT_FOUND',\n  requireStack: []\n}\n\nNode.js v22.11.0\n`);return 1}
    return this.runJS(ctx,{source,entry:file.split(/[\\/]/).pop(),args:args.slice(1)});
  }
  async runJS(ctx,{source,entry,args=[]}){
    const rt=this.app.runtimes;
    if(!rt){const r=simulateCompiled('js',source);ctx.out((r.output||'')+'\n');return 0}
    const r=await this.job(ctx,rt.runJS({source,entry,args,files:ctx.fs.snapshot(ctx.t.cwd),stdin:ctx.stdin??'',platform:isWindows(ctx.os)?'win32':ctx.os==='macos'?'darwin':'linux'},this.runtimeIO(ctx)));
    this.apply(ctx,r.files);if(r.cancelled)return 130;return r.code;
  }
  async npm(ctx){
    const[sub,...rest]=ctx.args;
    if(ctx.name==='npx'){ctx.err(`npm ERR! could not determine executable to run (DesktopSim: npx lädt keine Pakete aus dem Netz)\n`);return 1}
    if(!sub||sub==='-v'||sub==='--version'){ctx.out(sub?'10.9.0\n':'npm <command>\n\nUsage:\n\nnpm init     erstellt package.json\nnpm install  (Simulation)\nnpm run <script>\nnpm start\n');return 0}
    if(sub==='init'){const pkg={name:ctx.t.cwd.split('/').pop().toLowerCase(),version:'1.0.0',description:'',main:'index.js',scripts:{start:'node index.js',test:'echo "Error: no test specified" && exit 1'},keywords:[],author:'',license:'ISC'};if(!rest.includes('-y')&&!rest.includes('--yes')){ctx.out(`This utility will walk you through creating a package.json file.\n\npackage name: (${pkg.name}) `);const n=await ctx.readLine();if(n)pkg.name=n;ctx.out(`version: (1.0.0) `);await ctx.readLine();ctx.out('entry point: (index.js) ');const e=await ctx.readLine();if(e){pkg.main=e;pkg.scripts.start='node '+e}}const json=JSON.stringify(pkg,null,2);ctx.fs.write('package.json',json+'\n',ctx.t.cwd);ctx.out(`Wrote to ${ctx.fs.normalize('package.json',ctx.t.cwd)}:\n\n${json}\n\n`);this.app.notifyFiles?.();return 0}
    if(sub==='install'||sub==='i'){await sleep(500,ctx.t);ctx.out(`\nadded ${rest.length?rest.length+3:0} packages, and audited ${rest.length?rest.length+4:1} packages in 1s\n\nfound ${C.green}0${C.reset} vulnerabilities\n${C.gray}(DesktopSim: npm-Pakete werden nicht wirklich heruntergeladen – verwende eingebaute Node-Module wie fs, path, readline.)${C.reset}\n`);return 0}
    if(sub==='start'||sub==='run'||sub==='test'){let pkg;try{pkg=JSON.parse(ctx.fs.read('package.json',ctx.t.cwd))}catch{ctx.err(`npm ERR! code ENOENT\nnpm ERR! syscall open\nnpm ERR! path ${ctx.fs.normalize('package.json',ctx.t.cwd)}\nnpm ERR! errno -2\nnpm ERR! enoent Could not read package.json\n`);return 254}const script=pkg.scripts?.[sub==='run'?rest[0]:sub];if(!script){ctx.err(`npm ERR! Missing script: "${sub==='run'?rest[0]:sub}"\n`);return 1}ctx.out(`\n> ${pkg.name}@${pkg.version} ${sub==='run'?rest[0]:sub}\n> ${script}\n\n`);return this.engine.runSource(script,ctx.t,ctx.io)}
    ctx.err(`Unknown command: "${sub}"\n`);return 1;
  }

  // ---------- C / C++ ----------
  async cc(ctx){
    const name=ctx.name,cpp=/\+\+$/.test(name),args=ctx.args;const win=isWindows(ctx.os);
    if(args.includes('--version')||args.includes('-v')&&args.length===1){ctx.out(/clang/.test(name)||ctx.os==='macos'?`${ctx.os==='macos'?'Apple ':''}clang version 22.0.0 (YoWASP/LLVM, WebAssembly)\nTarget: wasm32-unknown-wasip1\nThread model: single\nInstalledDir: /usr/bin\n`:`${name} (DesktopSim) 22.0.0 – Clang/LLVM-Backend\nCopyright (C) 2025 Free Software Foundation, Inc. / LLVM Project\nDies ist freie Software; die Kopierbedingungen stehen in den Quellen.\n`);return 0}
    const sources=args.filter(a=>/\.(c|cc|cpp|cxx|c\+\+)$/i.test(a));
    if(!sources.length){ctx.err(`${C.bold}${name}: ${C.red}fatal error:${C.reset}${C.bold} no input files${C.reset}\ncompilation terminated.\n`);return 1}
    for(const s of sources)if(!ctx.fs.exists(s,ctx.t.cwd)){ctx.err(`${C.bold}${name}: ${C.red}error:${C.reset}${C.bold} ${s}: Datei oder Verzeichnis nicht gefunden${C.reset}\n${C.bold}${name}: ${C.red}fatal error:${C.reset}${C.bold} no input files${C.reset}\ncompilation terminated.\n`);return 1}
    const oi=args.indexOf('-o');let out=oi>=0?args[oi+1]:(win?'a.exe':'a.out');if(oi>=0&&!out){ctx.err(`${name}: error: argument to '-o' is missing (expected 1 value)\n`);return 1}
    if(win&&!/\.\w+$/.test(out))out+='.exe';
    const rt=this.app.runtimes;
    if(!rt){const check=compileSource(cpp?'cpp':'c',ctx.fs.read(sources[0],ctx.t.cwd));if(!check.ok){ctx.err(check.message+'\n');return 1}ctx.fs.write(out,ctx.fs.read(sources[0],ctx.t.cwd),ctx.t.cwd,false,{enc:'sim',mode:0o755,lang:cpp?'cpp':'c'});return 0}
    const passthrough=args.filter((a,i)=>!(i===oi||i===oi+1)&&!sources.includes(a)&&!/^-(pthread|fexceptions|static|g\d?|ggdb|march=.*|mtune=.*)$/.test(a));
    if(args.includes('-pthread'))ctx.err(`${C.yellow}warning:${C.reset} -pthread wird in der WebAssembly-Sandbox ignoriert (keine Threads)\n`);
    if(!localStorage.getItem('desktopsim-clang-notice')){ctx.err(`${C.gray}DesktopSim: Der echte Compiler (Clang/LLVM 22, ca. 100 MB) wird beim ersten Mal geladen und danach im Browser zwischengespeichert.${C.reset}\n`);try{localStorage.setItem('desktopsim-clang-notice','1')}catch{}}
    const files=ctx.fs.snapshot(ctx.t.cwd);const outName=out.replace(/\\/g,'/').replace(/^\.\//,'');const outFile='__out_'+outName.split('/').pop();
    const driver=cpp?'clang++':'clang';
    const r=await this.job(ctx,rt.compileC({driver,args:[...sources.map(s=>s.replace(/\\/g,'/')),...passthrough,...CLANG_FLAGS,'-o',outFile],files,output:outFile},{...this.runtimeIO(ctx),write:(text,stream)=>{const clean=text.replace(/__out_/g,'');stream==='stderr'?ctx.err(clean):ctx.out(clean)}}));
    if(r.cancelled)return 130;
    if(!r.wasm){
      const hintThrow=false;
      if(r.fatal){ctx.err(`${C.yellow}Hinweis: Der Compiler konnte nicht geladen werden (Netzwerk?).${C.reset}\n`)}
      if(!cpp&&sources.some(s=>/\.(cc|cpp|cxx)$/i.test(s)))ctx.err(`${C.gray}Tipp: C++-Programme mit g++ statt ${name} übersetzen (sonst fehlt die C++-Standardbibliothek beim Linken).${C.reset}\n`);
      return r.code||1;
    }
    const abs=ctx.fs.normalize(outName,ctx.t.cwd);await this.storeBinary(ctx.os,abs,r.wasm);
    ctx.fs.write(outName,'\0asm',ctx.t.cwd,false,{enc:'wasm',mode:0o755,size:r.wasm.length});this.app.notifyFiles?.();
    return 0;
  }
  async storeBinary(os,abs,bytes){this.binaries.set(os+':'+abs,bytes);try{const{idbSet}=await import('../runtime/store.js');await idbSet('bin:'+os+':'+abs,bytes)}catch{}}
  async loadBinary(os,abs){const k=os+':'+abs;if(this.binaries.has(k))return this.binaries.get(k);try{const{idbGet}=await import('../runtime/store.js');const b=await idbGet('bin:'+k);if(b)this.binaries.set(k,b);return b}catch{return null}}
  async runWasm(ctx,abs,args){
    const bytes=await this.loadBinary(ctx.os,abs);
    if(!bytes){ctx.err(`${ctx.t.shell==='cmd'?'':ctx.t.shell+': '}${ctx.name}: Binärdatei nicht mehr verfügbar – bitte neu kompilieren.\n`);return 126}
    const r=await this.job(ctx,this.app.runtimes.runWasm({wasm:bytes,name:abs.split('/').pop(),args,files:ctx.fs.snapshot(ctx.t.cwd),stdin:ctx.stdin??''},this.runtimeIO(ctx)));
    this.apply(ctx,r.files);if(r.cancelled)return 130;
    if(r.code===134&&!isWindows(ctx.os))ctx.err(`${ctx.t.shell==='zsh'?'zsh: abort':'Abgebrochen (Speicherabzug geschrieben)'}      ${ctx.name}\n`);
    return r.code;
  }

  // ---------- Java ----------
  async javac(ctx){
    const args=ctx.args;if(args.includes('-version')||args.includes('--version')){ctx.out('javac 1.8.0_442\n');return 0}
    const di=args.indexOf('-d');const outDir=di>=0?args[di+1]:'.';const files=args.filter((a,i)=>/\.java$/i.test(a)&&(di<0||i!==di+1));
    if(!files.length){ctx.err('javac: no source files\nUsage: javac <options> <source files>\nuse -help for a list of possible options\n');return 2}
    for(const f of files)if(!ctx.fs.exists(f,ctx.t.cwd)){ctx.err(`javac: file not found: ${f}\nUsage: javac <options> <source files>\nuse -help for a list of possible options\n`);return 2}
    const sources={};for(const f of files)sources[f.split(/[\\/]/).pop()]=ctx.fs.read(f,ctx.t.cwd);
    // Weitere Klassen im selben Ordner automatisch mitübersetzen, wenn sie referenziert werden.
    const text=Object.values(sources).join('\n');for(const e of ctx.fs.list('.',ctx.t.cwd))if(e.type==='file'&&/\.java$/.test(e.name)&&!sources[e.name]&&new RegExp(`\\b${e.name.replace(/\.java$/,'')}\\b`).test(text))sources[e.name]=ctx.fs.read(e.name,ctx.t.cwd);
    if(!this.app.runtimes){for(const f of files){const check=compileSource('java',ctx.fs.read(f,ctx.t.cwd));if(!check.ok){ctx.err(check.message+'\n');return 1}}this.writeClasses(ctx,sources,outDir);return 0}
    const r=await this.job(ctx,this.app.runtimes.compileJava({files:sources},this.runtimeIO(ctx)));
    if(r.code!==0)return 1;
    this.writeClasses(ctx,sources,outDir);return 0;
  }
  writeClasses(ctx,sources,outDir){for(const[file,src]of Object.entries(sources)){const pkg=src.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1];const dir=pkg&&outDir!=='.'?joinPath(ctx.fs.normalize(outDir,ctx.t.cwd),pkg.replaceAll('.','/')):ctx.fs.normalize(outDir,ctx.t.cwd);for(const m of src.matchAll(/^(?:public\s+|final\s+|abstract\s+)*(?:class|interface|enum|record)\s+([A-Za-z_]\w*)/gm)){ctx.fs.mkdir(dir,null,true);ctx.fs.write(joinPath(dir,m[1]+'.class'),src,null,false,{enc:'jclass',size:420+src.length%900,srcName:file});this.javaHashes.set(m[1],hash(src))}}this.app.notifyFiles?.()}
  async java(ctx){
    const args=ctx.args;if(!args.length||args[0]==='-help'){ctx.err('Syntax: java [-options] class [args...]\n           (zum Ausführen einer Klasse)\n   oder  java [-options] -jar jarfile [args...]\n');return 1}
    if(args[0]==='-version'||args[0]==='--version'){ctx.err('openjdk version "1.8.0_442"\nOpenJDK Runtime Environment (build 1.8.0_442-b06, CheerpJ 4.2 WebAssembly)\nOpenJDK 64-Bit Server VM (build 25.442-b06, mixed mode)\n');return 0}
    let i=0;while(args[i]&&/^-(cp|classpath)$/.test(args[i]))i+=2;const target=args[i];const rest=args.slice(i+1);
    if(/\.java$/i.test(target)){if(!ctx.fs.exists(target,ctx.t.cwd)){ctx.err(`Fehler: Datei ${target} nicht gefunden\n`);return 1}const code=await this.javac({...ctx,args:[target],name:'javac'});if(code)return code;return this.runJavaClass(ctx,target.split(/[\\/]/).pop().replace(/\.java$/i,''),rest,true)}
    const cls=target.replace(/\.class$/,'');const node=ctx.fs.locate(cls.replaceAll('.','/')+'.class',ctx.t.cwd);
    if(!node){ctx.err(`Fehler: Hauptklasse ${cls} konnte nicht gefunden oder geladen werden\n${C.gray}Tipp: Zuerst mit »javac ${cls}.java« übersetzen.${C.reset}\n`);return 1}
    return this.runJavaClass(ctx,cls,rest,false,node);
  }
  async runJavaClass(ctx,cls,args,fresh,node){
    const rt=this.app.runtimes;
    if(!rt){const r=simulateCompiled('java',node?.content||'');ctx.out(r.output+'\n');return 0}
    // Falls der zuletzt kompilierte Stand nicht zur .class-Datei passt (z. B. anderer Ordner), still neu übersetzen.
    if(node&&!fresh&&this.javaHashes.get(cls.split('.').pop())!==hash(node.content)){const r=await this.job(ctx,rt.compileJava({files:{[node.srcName||cls+'.java']:node.content}},{...this.runtimeIO(ctx),write:()=>{}}));if(r.code!==0){ctx.err(`Fehler: Klasse ${cls} konnte nicht geladen werden – bitte neu kompilieren.\n`);return 1}this.javaHashes.set(cls.split('.').pop(),hash(node.content))}
    const r=await this.job(ctx,rt.runJava({className:cls,args},this.runtimeIO(ctx)));
    if(r.cancelled){ctx.err('\n^C (Java-Ausgabe abgekoppelt – die JVM läuft im Hintergrund weiter)\n');return 130}
    return r.code;
  }

  // ---------- PHP ----------
  async php(ctx){
    const args=ctx.args;
    if(args[0]==='-v'||args[0]==='--version'){ctx.out('PHP 8.4.1 (cli) (built: Nov 21 2025 10:00:00) (NTS)\nCopyright (c) The PHP Group\nZend Engine v4.4.1, Copyright (c) Zend Technologies\n    (php-wasm / WebAssembly)\n');return 0}
    if(args[0]==='-S'){const port=(args[1]||'localhost:8000').split(':').pop();return this.startServer(port,ctx,'php')}
    if(args[0]==='-r')return this.runPHP(ctx,{source:'<?php '+(args[1]||''),entry:'Standard input code',args:args.slice(2)});
    if(args[0]==='-m'){ctx.out('[PHP Modules]\nCore\ndate\njson\nmbstring\npcre\nsqlite3\nstandard\n\n[Zend Modules]\n\n');return 0}
    const file=args[0];if(!file){ctx.err('Interaktiver Modus (php -a) ist in DesktopSim nicht verfügbar. Nutze php datei.php oder php -r "code".\n');return 1}
    let source;try{source=ctx.fs.read(file,ctx.t.cwd)}catch{ctx.err(`Could not open input file: ${file}\n`);return 1}
    return this.runPHP(ctx,{source,entry:file.split(/[\\/]/).pop(),args:args.slice(1)});
  }
  async runPHP(ctx,{source,entry,args=[],web=null}){
    const rt=this.app.runtimes;
    if(!rt){const r=simulateCompiled('php',source);ctx.out(r.output+'\n');return 0}
    const r=await this.job(ctx,rt.runPHP({source,entry,args,web,files:ctx.fs.snapshot(ctx.t.cwd),stdin:ctx.stdin??''},this.runtimeIO(ctx)));
    this.apply(ctx,r.files);return r.cancelled?130:r.code;
  }

  // ---------- SQLite ----------
  async sqlite3(ctx){
    const t=ctx.t,args=ctx.args.filter(a=>!a.startsWith('-'));
    if(ctx.args.includes('-version')||ctx.args.includes('--version')){ctx.out('3.49.1 2025-02-18 13:38:58 (sql.js / WebAssembly)\n');return 0}
    if(ctx.name!=='sqlite3')ctx.err(`${C.gray}${ctx.name} ist in DesktopSim nicht installiert – es wird sqlite3 gestartet.${C.reset}\n`);
    const file=args[0]||null;const abs=file?ctx.fs.normalize(file,t.cwd):null;
    const db=await this.openDatabase(ctx,abs);if(!db)return 1;
    if(abs&&!ctx.fs.exists(abs))ctx.fs.write(abs,'',null,false,{enc:'sqlite',size:8192});this.app.notifyFiles?.();
    const sqlArg=args[1];
    if(sqlArg){await this.sqlExec(db,sqlArg,ctx);return 0}
    if(ctx.stdin!==null&&ctx.stdin!==undefined){await this.sqlExec(db,ctx.stdin,ctx);return 0}
    t.sqlMode=true;t.sqlDb=db;t.sqlBuffer='';
    ctx.out(`SQLite version 3.49.1 2025-02-18 13:38:58\nEnter ".help" for usage hints.\n${abs?'':'Connected to a transient in-memory database.\nUse ".open FILENAME" to reopen on a persistent database.\n'}`);
    return 0;
  }
  async openDatabase(ctx,abs){
    try{const{SQLiteDatabase}=await import('../runtime/sqlite.js');if(!this.app.runtimes)throw Error('no runtime');const db=new SQLiteDatabase(abs?ctx.os+':'+abs:'memory:'+Math.random(),{seed:!abs||/demo\.db$/i.test(abs)});ctx.io.status?.('SQLite wird geladen …');await db.open();ctx.io.status?.('');db.headers=true;db.mode='box';return db}
    catch(e){ctx.io.status?.('');if(this.app.runtimes)ctx.err(`${C.yellow}SQLite (sql.js) nicht erreichbar – vereinfachte Lern-SQL-Engine wird verwendet.${C.reset}\n`);const mini=this.app.db||new MiniSQL(ctx.os);return{mini,headers:true,mode:'box',async exec(sql){const r=mini.run(sql);return{results:r.columns.length?[{columns:r.columns,rows:r.rows.map(row=>r.columns.map(c=>row[c]))}]:[],changes:0,message:r.message}},tables(){return Object.keys(mini.tables)},schema(){return Object.entries(mini.tables).map(([k,v])=>`CREATE TABLE ${k} (${v.columns.join(', ')});`).join('\n')}}}
  }
  async sqlExec(db,sql,ctx){
    const{formatTable}=await import('../runtime/sqlite.js').catch(()=>({formatTable:null}));
    try{const res=await db.exec(sql);for(const r of res.results){if(!r.rows.length&&db.mode!=='box')continue;ctx.out((formatTable?formatTable(db.headers||db.mode==='box'?r.columns:[],r.rows,db.mode):r.rows.map(x=>x.join('|')).join('\n')).replace(/^\n/,'')+'\n')}return true}
    catch(e){const m=String(e.message||e);ctx.err(/syntax error|incomplete input|unrecognized token/.test(m)?`Parse error: ${m}\n`:`Runtime error: ${m}\n`);return false}
  }
  async sqlLine(raw,t,io){
    const ctx=this.engine.context(['sqlite3'],t,io);const line=String(raw);const db=t.sqlDb;
    if(!t.sqlBuffer&&line.trim().startsWith('.')){
      const[cmd,...a]=line.trim().split(/\s+/);
      if(cmd==='.exit'||cmd==='.quit'){t.sqlMode=false;t.sqlDb=null;io.out('SQL-Konsole verlassen.');return}
      if(cmd==='.tables'){const list=db?.tables?.()||[];io.out(list.join('  ')+'\n');return}
      if(cmd==='.schema'){io.out((db?.schema?.(a[0])||'')+'\n');return}
      if(cmd==='.headers'){db.headers=a[0]==='on';return}
      if(cmd==='.mode'){if(['box','column','table','list','csv','markdown'].includes(a[0]))db.mode=a[0]==='column'||a[0]==='table'||a[0]==='markdown'?'box':a[0];else io.err(`Error: mode should be one of: box column csv list table markdown\n`);return}
      if(cmd==='.read'){try{await this.sqlExec(db,this.app.fs.read(a[0],t.cwd),ctx)}catch{io.err(`Error: cannot open "${a[0]}"\n`)}return}
      if(cmd==='.databases'){io.out('main: '+(t.sqlDb?'':'')+'\n');return}
      if(cmd==='.help'){io.out('.databases               List names and files of attached databases\n.exit ?CODE?             Exit this program with return-code CODE\n.headers on|off          Turn display of headers on or off\n.help ?-all? ?PATTERN?   Show help text for PATTERN\n.mode MODE ?OPTIONS?     Set output mode (box, list, csv, …)\n.quit                    Stop interpreting input stream, exit if primary.\n.read FILE               Read input from FILE or command output\n.schema ?PATTERN?        Show the CREATE statements matching PATTERN\n.tables ?TABLE?          List names of tables matching LIKE pattern TABLE\n');return}
      io.err(`Error: unknown command or invalid arguments:  "${cmd.slice(1)}". Enter ".help" for help\n`);return;
    }
    t.sqlBuffer=(t.sqlBuffer?t.sqlBuffer+'\n':'')+line;
    if(!/;\s*$/.test(t.sqlBuffer))return;
    const sql=t.sqlBuffer;t.sqlBuffer='';
    if(db.mini){try{const r=db.mini.run(sql);io.out((r.message||'OK')+(r.columns.length?'\n'+r.columns.join(' | ')+'\n'+r.rows.map(row=>r.columns.map(c=>row[c]??'NULL').join(' | ')).join('\n'):'')+'\n')}catch(e){io.out('SQL error: '+e.message+'\n')}return}
    await this.sqlExec(db,sql,ctx);
  }

  // ---------- Dateien ausführen ----------
  async runFile(path,ctx){
    const fs=ctx.fs,t=ctx.t,win=isWindows(t.os);
    if(path.startsWith('missing:')){ctx.err(`${t.shell==='zsh'?'zsh: no such file or directory: '+ctx.name:`${t.shell}: ${ctx.name}: Datei oder Verzeichnis nicht gefunden`}\n`);return 127}
    const node=fs.locate(path);
    if(node.type==='dir'){ctx.err(`${t.shell}: ${ctx.name}: Ist ein Verzeichnis\n`);return 126}
    if(!win&&!(node.mode&0o111)){ctx.err(`${t.shell==='zsh'?`zsh: permission denied: ${ctx.name}`:`${t.shell}: ${ctx.name}: Keine Berechtigung`}\n${C.gray}Tipp: Ausführbar machen mit »chmod +x ${ctx.name.replace(/^\.\//,'')}«.${C.reset}\n`);return 126}
    if(node.enc==='wasm')return this.runWasm(ctx,path,ctx.args);
    if(node.enc==='sim'){const r=simulateCompiled(node.lang,node.content);ctx.out(r.output+'\n');return 0}
    if(node.enc==='exe'){const n=path.split('/').pop().toLowerCase().replace(/\.exe$/,'');const map={notepad:()=>this.app.openEditor?.(),calc:()=>this.app.openCalculator?.(),explorer:()=>this.app.openFiles?.(),taskmgr:()=>this.app.openTaskManager?.(),cmd:()=>this.app.openTerminal?.(),winver:()=>this.app.openAbout?.()};if(map[n])map[n]();else if(this.engine.cmd[n])return this.engine.cmd[n].call(this.engine,ctx);return 0}
    const ext=extName(path);const content=node.content;
    if(win){
      if(ext==='bat'||ext==='cmd')return this.runBatch(ctx,content,path);
      if(ext==='ps1'){const policy=this.app.getSetting?.('psPolicy')||'Restricted';if(t.shell!=='powershell'){return this.engine.runSource(content,{...t},ctx.io)}if(/restricted|allsigned/i.test(policy)){ctx.err(`${C.red}${ctx.name} : Die Datei "${pathDisplay(t.os,path)}" kann nicht geladen werden, da die Ausführung von Skripts auf diesem System deaktiviert ist. Weitere Informationen finden Sie unter "about_Execution_Policies" (https:/go.microsoft.com/fwlink/?LinkID=135170).\nIn Zeile:1 Zeichen:1\n+ ${ctx.name}\n+ ${'~'.repeat(ctx.name.length)}\n    + CategoryInfo          : Sicherheitsfehler: (:) [], PSSecurityException\n    + FullyQualifiedErrorId : UnauthorizedAccess${C.reset}\n${C.gray}Tipp: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned${C.reset}\n`);return 1}const saved=t.args;t.args=ctx.args;try{return await this.engine.runSource(content,t,ctx.io)}finally{t.args=saved}}
      if(ext==='py')return this.python({...ctx,args:[path,...ctx.args],name:'python'});
      if(ext==='js')return this.node({...ctx,args:[path,...ctx.args],name:'node'});
      return this.open({...ctx,args:[path]});
    }
    const first=content.split('\n')[0];
    if(first.startsWith('#!')){const interp=first.slice(2).trim().split(/\s+/);const prog=(interp[0].split('/').pop()==='env'?interp[1]:interp[0].split('/').pop())||'sh';
      if(/^python/.test(prog))return this.python({...ctx,args:[path,...ctx.args],name:'python3'});
      if(prog==='node')return this.node({...ctx,args:[path,...ctx.args],name:'node'});
      if(prog==='php')return this.php({...ctx,args:[path,...ctx.args],name:'php'});}
    return this.runScript(ctx,content,path);
  }
  async runScript(ctx,content,path){
    const t=ctx.t;const saved={vars:{...t.vars},cwd:t.cwd,args:t.args,scriptName:t.scriptName,prevCwd:t.prevCwd};
    t.args=ctx.args;t.scriptName=path.split('/').pop();
    try{return await this.engine.runSource(content.replace(/^#!.*\n/,''),t,ctx.io)}
    catch(e){if(e?.constructor?.name==='ExitShell')return e.code;if(e?.constructor?.name==='ParseError'){ctx.err(`${path.split('/').pop()}: ${e.message}\n`);return 2}throw e}
    finally{Object.assign(t,saved)}
  }
  async runBatch(ctx,content,path){
    const t=ctx.t;const lines=content.replace(/\r/g,'').split('\n');const labels={};lines.forEach((l,i)=>{const m=l.trim().match(/^:(\w+)/);if(m)labels[m[1].toLowerCase()]=i});
    const saved={args:t.args,echoOff:t.echoOff};t.args=ctx.args;t.echoOff=false;let code=0,guard=0;
    try{
      for(let i=0;i<lines.length&&guard++<5000;i++){
        if(t.cancelled){ctx.err('^C\nBatchvorgang abbrechen (J/N)? J\n');return 130}
        let line=lines[i].trim();if(!line||line.startsWith(':')||/^rem(\s|$)/i.test(line))continue;
        const silent=line.startsWith('@');if(silent)line=line.slice(1).trim();
        if(/^echo\s+(off|on)$/i.test(line)){t.echoOff=/off/i.test(line);continue}
        if(!t.echoOff&&!silent)ctx.out(`\n${pathDisplay(t.os,t.cwd)}>${line}\n`);
        const go=line.match(/^goto\s+:?(\w+)/i);if(go){if(go[1].toLowerCase()==='eof')break;const target=labels[go[1].toLowerCase()];if(target===undefined){ctx.err('Die Sprungmarke wurde nicht gefunden.\n');return 1}i=target;continue}
        if(/^exit\s*\/b/i.test(line)){code=Number(line.split(/\s+/)[2])||0;break}
        const ifm=line.match(/^if\s+(not\s+)?(exist\s+("[^"]+"|\S+)|errorlevel\s+(\d+)|(\S+)\s*(==|equ|neq|lss|leq|gtr|geq)\s*(\S+))\s+(.*)$/i);
        if(ifm){const expand=s=>this.engine.expandCmdVars(s,t).replace(/^"|"$/g,'');let cond;if(ifm[3])cond=ctx.fs.exists(expand(ifm[3]),t.cwd);else if(ifm[4])cond=(t.lastCode||0)>=+ifm[4];else{const a=expand(ifm[5]),b=expand(ifm[7]),op=ifm[6].toLowerCase();const na=Number(a),nb=Number(b);cond=op==='=='||op==='equ'?a===b:op==='neq'?a!==b:op==='lss'?na<nb:op==='leq'?na<=nb:op==='gtr'?na>nb:na>=nb}if(ifm[1])cond=!cond;
          let rest=ifm[8];const elseM=rest.match(/^\((.*)\)\s*else\s*\((.*)\)$/i);if(elseM)rest=cond?elseM[1]:elseM[2];else if(!cond)continue;rest=rest.replace(/^\(|\)$/g,'');
          const gm=rest.match(/^goto\s+:?(\w+)/i);if(gm){if(gm[1].toLowerCase()==='eof')break;i=labels[gm[1].toLowerCase()]??i;continue}
          code=await this.engine.runSource(rest,t,ctx.io);continue}
        code=await this.engine.runSource(line,t,ctx.io);t.lastCode=code;
      }
      if(!t.echoOff)ctx.out('\n');
    }finally{t.args=saved.args;t.echoOff=saved.echoOff}
    return code;
  }

  // ---------- Shells ----------
  async switchShell(ctx,shell){
    const t=ctx.t;
    if(shell==='powershell'&&ctx.os==='winxp'){return this.engine.notFound('powershell',t,ctx.io)}
    if(ctx.args.some(a=>/^[-/]c(ommand)?$/i.test(a))){const i=ctx.args.findIndex(a=>/^[-/]c(ommand)?$/i.test(a));const saved=t.shell;t.shell=shell;try{return await this.engine.runSource(ctx.args.slice(i+1).join(' '),t,ctx.io)}finally{t.shell=saved}}
    t.shellStack.push({shell:t.shell});t.shell=shell;this.app.updateTerminalTitle?.(t);
    const psVer={win7:'2.0',win8:'3.0'}[ctx.os];
    ctx.out(shell==='cmd'?`Microsoft Windows [Version ${({winxp:'5.1.2600',win7:'6.1.7601',win8:'6.2.9200',win10:'10.0.19045.5371',win11:'10.0.26100.2605'})[ctx.os]}]\n(c) Microsoft Corporation. Alle Rechte vorbehalten.\n\n`:`Windows PowerShell\nCopyright (C) ${psVer?'2009':''}Microsoft Corporation. Alle Rechte vorbehalten.\n${psVer?'':'\nInstallieren Sie die neueste PowerShell für neue Funktionen und Verbesserungen! https://aka.ms/PSWindows\n'}\n`);
    return 0;
  }
  async subshell(ctx,shell){
    const t=ctx.t;
    if(shell==='zsh'&&(ctx.os==='debian'||ctx.os==='unix'))return this.engine.notFound('zsh',t,ctx.io);
    if(ctx.args[0]==='-c')return this.engine.runSource(ctx.args[1]||'',t,ctx.io);
    if(ctx.args[0]){let content;try{content=ctx.fs.read(ctx.args[0],t.cwd)}catch{ctx.err(`${shell}: ${ctx.args[0]}: Datei oder Verzeichnis nicht gefunden\n`);return 127}return this.runScript({...ctx,args:ctx.args.slice(1)},content,ctx.fs.normalize(ctx.args[0],t.cwd))}
    t.shellStack.push({shell:t.shell,admin:t.admin});t.shell=shell;if(ctx.os==='macos'&&shell==='bash')ctx.out('\nThe default interactive shell is now zsh.\nTo update your account to use zsh, please run `chsh -s /bin/zsh`.\nFor more details, please visit https://support.apple.com/kb/HT208050.\n');return 0;
  }
  async readPassword(ctx){return ctx.io.readLine({password:true})}
  async sudo(ctx){
    const t=ctx.t;
    if(isWindows(ctx.os)){ctx.err(ctx.os==='win11'?'Sudo ist auf diesem Computer deaktiviert. Um es zu aktivieren, wechseln Sie in der Einstellungen-App zur Seite „Für Entwickler“.\n':`"sudo" ist entweder falsch geschrieben oder\nkonnte nicht gefunden werden.\n`);return 1}
    if(!ctx.args.length){ctx.err('usage: sudo -h | -K | -k | -V\nusage: sudo [-ABbEHknPS] [-g group] [-h host] [-p prompt] [-u user] command [arg ...]\n');return 1}
    if(ctx.args[0]==='-k'){t.sudoUntil=0;return 0}
    if(!t.admin&&!(t.sudoUntil>Date.now())){
      for(let attempt=0;attempt<3;attempt++){
        ctx.out(ctx.os==='macos'||ctx.os==='unix'?'Password:':ctx.os==='arch'?'[sudo] password for student: ':'[sudo] Passwort für student: ');
        const pw=await this.readPassword(ctx);ctx.out('\n');
        if(pw===null||t.cancelled)return 1;
        if(pw.length){t.sudoUntil=Date.now()+300000;break}
        ctx.err(ctx.os==='arch'||ctx.os==='macos'?'Sorry, try again.\n':'Entschuldigung, versuchen Sie es noch einmal.\n');
        if(attempt===2){ctx.err(`sudo: 3 ${ctx.os==='debian'?'falsche Passworteingaben':'incorrect password attempts'}\n`);return 1}
      }
    }
    let args=ctx.args.filter((a,i)=>!(a==='-u'||ctx.args[i-1]==='-u'));
    if(args[0]==='-i'||args[0]==='-s'||args[0]==='su'&&!args[1]){t.shellStack.push({shell:t.shell,admin:t.admin,cwd:t.cwd});t.admin=true;if(args[0]==='-i')t.cwd='/root';return 0}
    if(args[0]==='brew'&&ctx.os==='macos'){ctx.err('Error: Running Homebrew as root is extremely dangerous and no longer supported.\nAs Homebrew does not drop privileges on installation you would be giving all\nbuild scripts full access to your system.\n');return 1}
    const prev=t.admin;t.admin=true;
    try{return await this.engine.dispatch(args,t,ctx.io)}finally{t.admin=prev}
  }
  async su(ctx){const t=ctx.t;ctx.out(ctx.os==='debian'?'Passwort: ':'Password: ');const pw=await this.readPassword(ctx);ctx.out('\n');if(!pw){ctx.err(ctx.os==='debian'?'su: Fehler bei der Authentifizierung\n':'su: Authentication failure\n');return 1}t.shellStack.push({shell:t.shell,admin:t.admin,cwd:t.cwd});t.admin=true;if(ctx.args.includes('-')||ctx.args.includes('-l'))t.cwd='/root';return 0}

  // ---------- Paketmanager ----------
  async packageManager(ctx){
    const t=ctx.t,os=ctx.os,name=ctx.name;const valid={apt:'debian','apt-get':'debian',dpkg:'debian',pacman:'arch',yay:'arch',brew:'macos',pkg:'unix',pkgutil:'unix',winget:'win',choco:'win',snap:'debian',flatpak:'debian'}[name];
    if(!valid||(valid==='win'?!isWindows(os):valid!==os)){return this.engine.notFound(name,t,ctx.io)}
    if(name==='winget')return this.winget(ctx);
    if(name==='dpkg'){if(ctx.args[0]==='-l'){ctx.out('Gewünscht=Unbekannt/Installieren/R=Entfernen/P=Vollständig Löschen/Halten\n| Status=Nicht/Installiert/Config/U=Entpackt/halb konFiguriert/\n||/ Name           Version        Architektur  Beschreibung\n+++-==============-==============-============-=================================\nii  bash           5.2.37-2       amd64        GNU Bourne Again SHell\nii  gcc            4:14.2.0-1     amd64        GNU C compiler\nii  python3        3.13.5-1       amd64        interactive high-level object-oriented language\n'+[...this.installed(t)].map(p=>`ii  ${p.padEnd(14)} ${(INSTALLABLE[p]?.v||'1.0').padEnd(14)} amd64        ${p}\n`).join(''));return 0}ctx.err('dpkg: Fehler: benötige eine Aktionsoption\n');return 2}
    if(name==='snap'||name==='flatpak'){ctx.err(`${name}: In der Simulation nicht verfügbar – nutze »sudo apt install«.\n`);return 1}
    const args=ctx.args;const sub=(name==='pacman'||name==='yay')?(args[0]||''):args[0];const pkgs=args.slice(1).filter(a=>!a.startsWith('-'));
    if(os==='debian')return this.apt(ctx,sub,pkgs,args.includes('-y'));
    if(os==='arch')return this.pacman(ctx,args);
    if(os==='macos')return this.brew(ctx,sub,pkgs);
    if(!t.admin){ctx.err('pkg: Für diese Aktion sind Root-Rechte erforderlich.\n');return 1}
    if(sub==='install'){for(const p of pkgs){if(!INSTALLABLE[p]){ctx.err(`pkg install: Die folgenden Muster stimmen mit keinem Paket überein:\n        ${p}\n`);return 1}ctx.out(`           Packages to install:     1\n            Services to change:     0\n       Create boot environment:    No\n\nDOWNLOAD                                PKGS         FILES    XFER (MB)   SPEED\nCompleted                                1/1         12/12      0.1/0.1  1.2M/s\n\nPHASE                                          ITEMS\nInstalling new actions                         20/20\nUpdating package state database                 Done\n`);this.setInstalled(t,p)}return 0}
    ctx.out(`pkg: Unterbefehle: install, uninstall, list\n`);return 0;
  }
  async apt(ctx,sub,pkgs,yes){
    const t=ctx.t,out=s=>ctx.out(s);const step=ms=>sleep(ms,t);
    const lock=()=>{ctx.err(`E: Sperre /var/lib/dpkg/lock-frontend konnte nicht geöffnet werden. - open (13: Keine Berechtigung)\nE: Sperre für dpkg-Oberfläche (/var/lib/dpkg/lock-frontend) konnte nicht erhalten werden. Sind Sie Root?\n`);return 100};
    if(!sub||sub==='--help'){out('apt 3.0.3 (amd64)\nAufruf: apt [Optionen] Befehl\n\nHäufig benutzte Befehle:\n  list - Pakete basierend auf dem Paketnamen auflisten\n  search - in Paketbeschreibungen suchen\n  show - Paketdetails anzeigen\n  install - Pakete installieren\n  remove - Pakete entfernen\n  update - Liste verfügbarer Pakete aktualisieren\n  upgrade - System durch Installation/Aktualisierung von Paketen aktualisieren\n');return 0}
    if(sub==='update'){if(!t.admin){ctx.out('Paketlisten werden gelesen… Fertig\n');ctx.err('E: Sperre /var/lib/apt/lists/lock konnte nicht geöffnet werden. - open (13: Keine Berechtigung)\nE: Sperre des Verzeichnisses /var/lib/apt/lists/ nicht möglich\n');return 100}for(const l of['OK:1 http://deb.debian.org/debian trixie InRelease','OK:2 http://deb.debian.org/debian trixie-updates InRelease','OK:3 http://security.debian.org/debian-security trixie-security InRelease']){await step(250);out(l+'\n')}await step(300);out('Paketlisten werden gelesen… Fertig\nAbhängigkeitsbaum wird aufgebaut… Fertig\nStatusinformationen werden eingelesen… Fertig\nAlle Pakete sind aktuell.\n');return 0}
    if(sub==='upgrade'||sub==='full-upgrade'){if(!t.admin)return lock();await step(400);out('Paketlisten werden gelesen… Fertig\nAbhängigkeitsbaum wird aufgebaut… Fertig\nStatusinformationen werden eingelesen… Fertig\nPaketaktualisierung (Upgrade) wird berechnet… Fertig\n0 aktualisiert, 0 neu installiert, 0 zu entfernen und 0 nicht aktualisiert.\n');return 0}
    if(sub==='list'){out('Auflistung… Fertig\n'+[...this.installed(t)].map(p=>`${C.green}${p}${C.reset}/stable,now ${INSTALLABLE[p]?.v||'1.0'} amd64 [installiert]\n`).join('')+(ctx.args.includes('--installed')?'':Object.keys(INSTALLABLE).filter(p=>!this.isInstalled(p,t)).map(p=>`${C.green}${p}${C.reset}/stable ${INSTALLABLE[p].v} amd64\n`).join('')));return 0}
    if(sub==='search'){const q=pkgs[0]||'';out('Sortierung… Fertig\nVolltextsuche… Fertig\n'+Object.keys(INSTALLABLE).filter(p=>p.includes(q)).map(p=>`${C.green}${p}${C.reset}/stable ${INSTALLABLE[p].v} amd64\n  ${p} (DesktopSim-Paket)\n\n`).join(''));return 0}
    if(sub==='show'){const p=pkgs[0];if(!INSTALLABLE[p]&&!ALREADY.has(p)){ctx.err(`N: Paket ${p} kann nicht gefunden werden\nE: Es wurden keine Pakete gefunden\n`);return 100}out(`Package: ${p}\nVersion: ${INSTALLABLE[p]?.v||'1.0'}\nPriority: optional\nSection: games\nMaintainer: Debian Developers\nInstalled-Size: ${INSTALLABLE[p]?.kb||100} kB\nDescription: ${p}\n`);return 0}
    if(sub==='install'||sub==='remove'||sub==='purge'){
      if(!pkgs.length){ctx.out('Paketlisten werden gelesen… Fertig\n');return 0}
      if(!t.admin)return lock();
      await step(200);out('Paketlisten werden gelesen… Fertig\n');await step(200);out('Abhängigkeitsbaum wird aufgebaut… Fertig\n');await step(150);out('Statusinformationen werden eingelesen… Fertig\n');
      if(sub!=='install'){const present=pkgs.filter(p=>this.isInstalled(p,t));if(!present.length){out(`Paket »${pkgs[0]}« ist nicht installiert, wird also auch nicht entfernt.\n0 aktualisiert, 0 neu installiert, 0 zu entfernen und 0 nicht aktualisiert.\n`);return 0}out(`Die folgenden Pakete werden ENTFERNT:\n  ${present.join(' ')}\n0 aktualisiert, 0 neu installiert, ${present.length} zu entfernen und 0 nicht aktualisiert.\n`);if(!yes){out('Möchten Sie fortfahren? [J/n] ');const a=await ctx.readLine();if(a&&!/^[jy]/i.test(a)){out('Abbruch.\n');return 1}}for(const p of present){await step(250);out(`Entfernen von ${p} (${INSTALLABLE[p]?.v||'1.0'}) …\n`);this.setInstalled(t,p,false)}return 0}
      const unknown=pkgs.filter(p=>!INSTALLABLE[p]&&!ALREADY.has(p)&&!Object.values(INSTALLABLE).some(v=>v.apt===p));
      if(unknown.length){ctx.err(`${C.red}E: ${C.reset}Paket ${unknown[0]} kann nicht gefunden werden.\n`);return 100}
      const map=p=>Object.entries(INSTALLABLE).find(([k,v])=>v.apt===p)?.[0]||p;
      const fresh=pkgs.map(map).filter(p=>INSTALLABLE[p]&&!this.isInstalled(p,t));
      for(const p of pkgs.map(map).filter(p=>!fresh.includes(p)))out(`${INSTALLABLE[p]?.apt||p} ist schon die neueste Version (${INSTALLABLE[p]?.v||'1.0'}).\n`);
      if(!fresh.length){out('0 aktualisiert, 0 neu installiert, 0 zu entfernen und 0 nicht aktualisiert.\n');return 0}
      if(fresh.includes('neofetch')){ctx.err(`${C.red}E: ${C.reset}Paket neofetch hat keinen Installationskandidaten (in Debian 13 entfernt – nutze fastfetch).\n`);return 100}
      const kb=fresh.reduce((n,p)=>n+INSTALLABLE[p].kb,0);
      out(`Die folgenden NEUEN Pakete werden installiert:\n  ${fresh.map(p=>INSTALLABLE[p].apt||p).join(' ')}\n0 aktualisiert, ${fresh.length} neu installiert, 0 zu entfernen und 0 nicht aktualisiert.\nEs müssen ${kb.toFixed(1).replace('.',',')} kB an Archiven heruntergeladen werden.\nNach dieser Operation werden ${(kb*4.1).toFixed(1).replace('.',',')} kB Plattenplatz zusätzlich benutzt.\n`);
      if(fresh.length>1&&!yes){out('Möchten Sie fortfahren? [J/n] ');const a=await ctx.readLine();if(a&&!/^[jy]/i.test(a)){out('Abbruch.\n');return 1}}
      for(const[i,p]of fresh.entries()){await step(300);out(`Holen:${i+1} http://deb.debian.org/debian trixie/main amd64 ${INSTALLABLE[p].apt||p} amd64 ${INSTALLABLE[p].v} [${INSTALLABLE[p].kb.toFixed(1).replace('.',',')} kB]\n`)}
      out(`Es wurden ${kb.toFixed(1).replace('.',',')} kB in 0 s geholt (${Math.round(300+Math.random()*900)} kB/s).\n`);
      for(const p of fresh){await step(180);out(`Vormals nicht ausgewähltes Paket ${INSTALLABLE[p].apt||p} wird gewählt.\n(Lese Datenbank ... 152634 Dateien und Verzeichnisse sind derzeit installiert.)\nVorbereitung zum Entpacken von .../${INSTALLABLE[p].apt||p}_${INSTALLABLE[p].v}_amd64.deb ...\nEntpacken von ${INSTALLABLE[p].apt||p} (${INSTALLABLE[p].v}) ...\n`)}
      for(const p of fresh){await step(200);out(`${INSTALLABLE[p].apt||p} (${INSTALLABLE[p].v}) wird eingerichtet ...\n`);this.setInstalled(t,p)}
      out('Trigger für man-db (2.13.1-1) werden verarbeitet ...\n');return 0;
    }
    ctx.err(`E: Ungültige Operation ${sub}\n`);return 100;
  }
  async pacman(ctx,args){
    const t=ctx.t,out=s=>ctx.out(s);const op=args[0]||'';const pkgs=args.slice(1).filter(a=>!a.startsWith('-'));const bar=(label,pct=100)=>`${label.padEnd(50)} [${'#'.repeat(Math.round(pct/100*22)).padEnd(22,'-')}] ${String(pct).padStart(3)}%\n`;
    if(!op||op==='-h'){out('usage:  pacman <operation> [...]\noperations:\n    pacman {-h --help}\n    pacman {-V --version}\n    pacman {-Q --query}    [options] [package(s)]\n    pacman {-R --remove}   [options] <package(s)>\n    pacman {-S --sync}     [options] [package(s)]\n');return 0}
    if(op==='-V'){out(' .--.                  Pacman v7.0.0 - libalpm v15.0.0\n/ _.-\' .-.  .-.  .-.   Copyright (C) 2006-2024 Pacman Development Team\n\\  \'-. \'-\'  \'-\'  \'-\'   Copyright (C) 2002-2006 Judd Vinet\n \'--\'\n');return 0}
    if(/^-Q/.test(op)){out(['bash 5.2.037-5','gcc 15.2.1+r22-1','python 3.13.7-1','nodejs 24.11.0-1','fastfetch 2.55.0-1',...[...this.installed(t)].map(p=>`${p} ${INSTALLABLE[p]?.v||'1.0'}`)].map(l=>l+'\n').join(''));return 0}
    if(/^-Ss/.test(op)){out(Object.keys(INSTALLABLE).filter(p=>p.includes(pkgs[0]||'')).map(p=>`${C.magenta}extra/${C.reset}${C.bold}${p}${C.reset} ${C.green}${INSTALLABLE[p].v}${C.reset}\n    ${p}\n`).join(''));return 0}
    if(!t.admin){ctx.err('error: you cannot perform this operation unless you are root.\n');return 1}
    if(/^-Sy+u?$/.test(op)&&!pkgs.length){out(':: Synchronizing package databases...\n');for(const r of['core','extra']){await sleep(300,t);out(` ${r.padEnd(32)} ${String(r==='core'?117:7.8).padStart(5)} KiB  ${(500+Math.random()*900).toFixed(0)} KiB/s 00:00 [######################] 100%\n`)}if(op.includes('u'))out(':: Starting full system upgrade...\n there is nothing to do\n');return 0}
    if(/^-R/.test(op)){const present=pkgs.filter(p=>this.isInstalled(p,t));if(!present.length){ctx.err(`error: target not found: ${pkgs[0]}\n`);return 1}out(`checking dependencies...\n\nPackages (${present.length}) ${present.map(p=>`${p}-${INSTALLABLE[p]?.v}`).join('  ')}\n\n:: Do you want to remove these packages? [Y/n] `);const a=await ctx.readLine();if(a&&!/^y/i.test(a))return 1;for(const p of present){await sleep(200,t);out(bar(`(1/1) removing ${p}`));this.setInstalled(t,p,false)}return 0}
    if(/^-S/.test(op)){
      const unknown=pkgs.filter(p=>!INSTALLABLE[p]&&!ALREADY.has(p));if(unknown.length){ctx.err(`error: target not found: ${unknown[0]}\n`);return 1}
      const fresh=pkgs.filter(p=>INSTALLABLE[p]&&!this.isInstalled(p,t));for(const p of pkgs.filter(p=>!fresh.includes(p)))out(`warning: ${p}-${INSTALLABLE[p]?.v||'1.0'} is up to date -- reinstalling\n`);if(!fresh.length)return 0;
      const kb=fresh.reduce((n,p)=>n+INSTALLABLE[p].kb,0);
      out(`resolving dependencies...\nlooking for conflicting packages...\n\nPackages (${fresh.length}) ${fresh.map(p=>`${p}-${INSTALLABLE[p].v}`).join('  ')}\n\nTotal Download Size:   ${(kb/1024).toFixed(2)} MiB\nTotal Installed Size:  ${(kb*4/1024).toFixed(2)} MiB\n\n:: Proceed with installation? [Y/n] `);
      if(!args.includes('--noconfirm')){const a=await ctx.readLine();if(a&&!/^y/i.test(a))return 1}else out('\n');
      out(':: Retrieving packages...\n');for(const p of fresh){await sleep(300,t);out(` ${(p+'-'+INSTALLABLE[p].v+'-x86_64').padEnd(30)} ${String(INSTALLABLE[p].kb).padStart(6)} KiB  ${(800+Math.random()*1200).toFixed(0)} KiB/s 00:00 [######################] 100%\n`)}
      for(const s of['checking keys in keyring','checking package integrity','loading package files','checking for file conflicts','checking available disk space']){await sleep(120,t);out(bar(`(${fresh.length}/${fresh.length}) ${s}`))}
      out(':: Processing package changes...\n');for(const[i,p]of fresh.entries()){await sleep(200,t);out(bar(`(${i+1}/${fresh.length}) installing ${p}`));this.setInstalled(t,p)}
      out(':: Running post-transaction hooks...\n(1/1) Arming ConditionNeedsUpdate...\n');return 0;
    }
    ctx.err(`error: invalid option '${op}'\n`);return 1;
  }
  async brew(ctx,sub,pkgs){
    const t=ctx.t,out=s=>ctx.out(s);
    if(!sub){out('Example usage:\n  brew search TEXT|/REGEX/\n  brew info [FORMULA|CASK...]\n  brew install FORMULA|CASK...\n  brew update\n  brew upgrade [FORMULA|CASK...]\n  brew uninstall FORMULA|CASK...\n  brew list [FORMULA|CASK...]\n');return 0}
    if(sub==='--version'){out('Homebrew 4.6.3\n');return 0}
    if(sub==='list'){out(['python@3.14','node','gcc','openjdk','php','sqlite','git',...this.installed(t)].join('\n')+'\n');return 0}
    if(sub==='update'){await sleep(500,t);out('==> Updating Homebrew...\nAlready up-to-date.\n');return 0}
    if(sub==='install'){for(const p of pkgs){if(ALREADY.has(p)||['python','node','openjdk','sqlite'].includes(p)){out(`${C.yellow}Warning:${C.reset} ${p} is already installed and up-to-date.\nTo reinstall, run:\n  brew reinstall ${p}\n`);continue}if(!INSTALLABLE[p]){ctx.err(`${C.yellow}Warning:${C.reset} No available formula with the name "${p}".\n==> Searching for similarly named formulae and casks...\n${C.red}Error:${C.reset} No formulae or casks found for ${p}.\n`);return 1}
      out(`${C.blue}==>${C.reset} ${C.bold}Downloading https://ghcr.io/v2/homebrew/core/${p}/manifests/${INSTALLABLE[p].v}${C.reset}\n`);await sleep(400,t);out(`${'#'.repeat(72)} 100.0%\n${C.blue}==>${C.reset} ${C.bold}Fetching ${p}${C.reset}\n${C.blue}==>${C.reset} ${C.bold}Downloading https://ghcr.io/v2/homebrew/core/${p}/blobs/sha256:${Math.random().toString(16).slice(2,14)}${C.reset}\n`);await sleep(400,t);out(`${'#'.repeat(72)} 100.0%\n${C.blue}==>${C.reset} ${C.bold}Pouring ${p}--${INSTALLABLE[p].v}.arm64_tahoe.bottle.tar.gz${C.reset}\n🍺  /opt/homebrew/Cellar/${p}/${INSTALLABLE[p].v}: ${12+p.length} files, ${(INSTALLABLE[p].kb*4).toFixed(1)}KB\n${C.blue}==>${C.reset} ${C.bold}Running \`brew cleanup ${p}\`...${C.reset}\n`);this.setInstalled(t,p)}return 0}
    if(sub==='uninstall'||sub==='remove'){for(const p of pkgs){if(!this.isInstalled(p,t)){ctx.err(`Error: No such keg: /opt/homebrew/Cellar/${p}\n`);return 1}out(`Uninstalling /opt/homebrew/Cellar/${p}/${INSTALLABLE[p].v}... (${12+p.length} files, ${(INSTALLABLE[p].kb*4).toFixed(1)}KB)\n`);this.setInstalled(t,p,false)}return 0}
    if(sub==='search'){out(`${C.blue}==>${C.reset} ${C.bold}Formulae${C.reset}\n`+Object.keys(INSTALLABLE).filter(p=>p.includes(pkgs[0]||'')).join('\n')+'\n');return 0}
    ctx.err(`Error: Unknown command: brew ${sub}\n`);return 1;
  }
  async winget(ctx){
    const[sub,...rest]=ctx.args;const out=s=>ctx.out(s);
    if(!sub){out('Windows-Paket-Manager v1.11.430\nCopyright (c) Microsoft Corporation. Alle Rechte vorbehalten.\n\nDas WinGet-Befehlszeilenprogramm ermöglicht die Installation von Anwendungen und anderen Paketen über die Befehlszeile.\n\nVerwendung: winget  [<Befehl>] [<Optionen>]\n\nDie folgenden Befehle sind verfügbar:\n  install    Installiert das angegebene Paket\n  search     Suchen und Anzeigen grundlegender Informationen zu Paketen\n  list       Installierte Pakete anzeigen\n  upgrade    Zeigt verfügbare Upgrades an und führt sie aus.\n');return 0}
    if(sub==='list'){out('Name                     ID                         Version\n----------------------------------------------------------------\nPython 3.14              Python.Python.3.14         3.14.0\nNode.js                  OpenJS.NodeJS.LTS          22.11.0\nGit                      Git.Git                    2.51.0\nMicrosoft Visual Studio Code Microsoft.VisualStudioCode 1.105.0\n');return 0}
    if(sub==='search'){out(`Name           ID                   Version  Quelle\n--------------------------------------------------\n${rest[0]}          ${rest[0]}.${rest[0]}           1.0.0    winget\n`);return 0}
    if(sub==='install'){const id=rest.filter(a=>!a.startsWith('-')).join(' ');if(!id){ctx.err('Das Argument "query" ist erforderlich.\n');return 1}out(`Gefunden ${id} [${id}] Version 1.0.0\nDiese Anwendung wird von ihrem Besitzer an Sie lizenziert.\nMicrosoft ist nicht verantwortlich und erteilt keine Lizenzen für Pakete von Drittanbietern.\nHerunterladen https://example.invalid/${id}-setup.exe\n`);for(let p=0;p<=10;p++){await sleep(120,ctx.t);ctx.out(`\r  ${'█'.repeat(p*3).padEnd(30,'▒')}  ${(p*2.4).toFixed(1)} MB / 24.0 MB`)}out('\nDer Installer-Hash wurde erfolgreich überprüft\nPaketinstallation wird gestartet...\nErfolgreich installiert\n'+`${C.gray}(Simulation – es wird keine echte Software installiert)${C.reset}\n`);return 0}
    out('Kein verfügbares Upgrade gefunden.\n');return 0;
  }

  // ---------- Netzwerk ----------
  resolveHost(host){const h=String(host).toLowerCase();if(/^(localhost|127\.0\.0\.1|::1)$/.test(h))return'127.0.0.1';if(/^\d+\.\d+\.\d+\.\d+$/.test(h))return h;const known={'google.com':'142.250.185.78','www.google.com':'142.250.185.68','datenflix007.github.io':'185.199.108.153','github.com':'140.82.121.4','wikipedia.org':'185.15.59.224','de.wikipedia.org':'185.15.59.224','fritz.box':'192.168.178.1','router':'192.168.178.1'};if(known[h])return known[h];if(!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h))return null;let x=0;for(const c of h)x=(x*31+c.charCodeAt(0))>>>0;return`${93+x%60}.${x>>8&255}.${x>>16&255}.${1+(x>>24)%250}`}
  async ping(ctx){
    const t=ctx.t,win=isWindows(ctx.os);const args=ctx.args;const host=args.filter((a,i)=>!a.startsWith('-')&&!/^-[cnw]$/.test(args[i-1]||'')).pop();
    if(!host){ctx.err(win?'\nSyntax: ping [-t] [-a] [-n Anzahl] [-l Größe] Zielname\n':'ping: Ziel-IP-Adresse benötigt\n');return win?1:2}
    const ip=this.resolveHost(host);
    if(!ip){ctx.err(win?`Ping-Anforderung konnte Host "${host}" nicht finden. Überprüfen Sie den Namen, und versuchen Sie es erneut.\n`:`ping: ${host}: Name oder Dienst nicht bekannt\n`);return win?1:2}
    const ci=args.indexOf(win?'-n':'-c');let count=ci>=0?+args[ci+1]:win&&!args.includes('-t')?4:Infinity;const times=[];const local=ip==='127.0.0.1';const rnd=()=>local?0.04+Math.random()*0.05:12+Math.random()*9;
    ctx.out(win?`\nPing wird ausgeführt für ${host===ip?ip:`${host} [${ip}]`} mit 32 Bytes Daten:\n`:`PING ${host} (${ip}) 56(84) bytes of data.\n`);
    for(let i=1;i<=count&&i<=60;i++){if(i>1)await sleep(1000,t);if(t.cancelled)break;const ms=rnd();times.push(ms);ctx.out(win?`Antwort von ${ip}: Bytes=32 Zeit${local?'<1ms':'='+Math.round(ms)+'ms'} TTL=${local?128:57}\n`:`64 bytes from ${host===ip?ip:`${host} (${ip})`}: icmp_seq=${i} ttl=${local?64:57} time=${ms.toFixed(local?3:1)} ms\n`)}
    if(t.cancelled&&win)ctx.out('^C\n');else if(t.cancelled)ctx.out('^C\n');
    const n=times.length,min=Math.min(...times),max=Math.max(...times),avg=times.reduce((a,b)=>a+b,0)/(n||1);
    ctx.out(win?`\nPing-Statistik für ${ip}:\n    Pakete: Gesendet = ${n}, Empfangen = ${n}, Verloren = 0\n    (0% Verlust),\nCa. Zeitangaben in Millisek.:\n    Minimum = ${Math.round(min)}ms, Maximum = ${Math.round(max)}ms, Mittelwert = ${Math.round(avg)}ms\n`:`\n--- ${host} ping statistics ---\n${n} packets transmitted, ${n} received, 0% packet loss, time ${Math.max(0,n-1)*1000+3}ms\nrtt min/avg/max/mdev = ${[min,avg,max,(max-min)/2].map(v=>v.toFixed(3)).join('/')} ms\n`);
    t.cancelled=false;return 0;
  }
  async nslookup(ctx){const host=ctx.args.find(a=>!a.startsWith('-'));const ip=this.resolveHost(host||'');if(!host){ctx.err('Syntax: nslookup <name>\n');return 1}if(!ip){ctx.err(`** server can't find ${host}: NXDOMAIN\n`);return 1}ctx.out(`Server:\t\t192.168.178.1\nAddress:\t192.168.178.1#53\n\nNon-authoritative answer:\nName:\t${host}\nAddress: ${ip}\n`);return 0}
  async traceroute(ctx){const host=ctx.args[0]||'datenflix007.github.io';const ip=this.resolveHost(host);ctx.out(`traceroute to ${host} (${ip}), 30 hops max, 60 byte packets\n`);for(const[i,h]of['fritz.box (192.168.178.1)','p3e9bf2a1.dip0.t-ipconnect.de (62.155.242.161)','f-ed12-i.F.DE.NET.DTAG.DE (217.0.199.42)',`${host} (${ip})`].entries()){await sleep(400,ctx.t);if(ctx.t.cancelled)return 130;const ms=(3+i*4+Math.random()*3).toFixed(3);ctx.out(` ${i+1}  ${h}  ${ms} ms  ${ms} ms  ${ms} ms\n`)}return 0}
  async curl(ctx){
    const args=ctx.args;const ps=ctx.t.shell==='powershell';const wget=ctx.name==='wget';
    const url=args.find(a=>/^(https?:\/\/|localhost|127\.0\.0\.1)/i.test(a))||args.filter(a=>!a.startsWith('-')).pop();
    if(!url){ctx.err(wget?'wget: URL fehlt\nAufruf: wget [OPTION]... [URL]...\n':"curl: try 'curl --help' or 'curl --manual' for more information\n");return 2}
    const oi=args.findIndex(a=>a==='-o'||a==='-O'||a==='-OutFile'||a==='-outfile');let outFile=oi>=0?(args[oi]==='-O'?url.split('/').pop()||'index.html':args[oi+1]):wget?(url.split('/').pop()||'index.html'):null;
    let body,status=200,type='text/html';
    const local=url.match(/^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?::(\d+))?(\/[^\s?#]*)?(\?[^\s#]*)?/i);
    if(local){const port=local[1]||'80';const sv=this.app.servers?.get(port);if(!sv){ctx.err(ps?`${C.red}Invoke-WebRequest : Es kann keine Verbindung mit dem Remoteserver hergestellt werden.${C.reset}\n`:wget?`--${new Date().toISOString().slice(0,19).replace('T',' ')}--  ${url}\nVerbindungsaufbau zu localhost (localhost)|127.0.0.1|:${port} … fehlgeschlagen: Verbindungsaufbau abgelehnt.\n`:`curl: (7) Failed to connect to localhost port ${port} after 0 ms: Couldn't connect to server\n`);return 7}
      const res=await this.serveLocal(sv,local[2]||'/',local[3]?.slice(1)||'');body=res.body;status=res.status;type=res.type}
    else{try{const r=await fetch(url,{mode:'cors'});status=r.status;type=r.headers.get('content-type')||'';body=await r.text()}catch{ctx.err(ps?`${C.red}Invoke-WebRequest : Die Anfrage wurde vom Browser blockiert (CORS) oder der Server ist nicht erreichbar.${C.reset}\n`:`curl: (6) Could not resolve host: ${url.replace(/^https?:\/\//,'').split('/')[0]}\n${C.gray}(DesktopSim: externe Seiten sind nur abrufbar, wenn sie CORS erlauben, z. B. GitHub Pages.)${C.reset}\n`);return 6}}
    if(ps){ctx.out(`\n\nStatusCode        : ${status}\nStatusDescription : ${status===200?'OK':'Not Found'}\nContent           : ${body.slice(0,180).replace(/\n/g,' ')}...\nRawContentLength  : ${body.length}\n\n\n`);if(outFile){ctx.fs.write(outFile,body,ctx.t.cwd);this.app.notifyFiles?.()}return 0}
    if(args.includes('-I')||args.includes('--head')){ctx.out(`HTTP/1.1 ${status} ${status===200?'OK':'Not Found'}\nContent-Type: ${type}\nContent-Length: ${body.length}\nDate: ${new Date().toUTCString()}\n\n`);return 0}
    if(outFile){ctx.fs.write(outFile,body,ctx.t.cwd);this.app.notifyFiles?.();if(wget)ctx.out(`--${new Date().toISOString().slice(0,19).replace('T',' ')}--  ${url}\nHTTP-Anforderung gesendet, auf Antwort wird gewartet … ${status} ${status===200?'OK':'Not Found'}\nLänge: ${body.length} [${type.split(';')[0]}]\nWird in »${outFile}« gespeichert.\n\n${outFile.padEnd(20)} 100%[===================>] ${String(body.length).padStart(6)}  --.-KB/s    in 0s\n\n»${outFile}« gespeichert [${body.length}/${body.length}]\n`);else if(!args.includes('-s'))ctx.err(`  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100  ${String(body.length).padStart(5)}  100  ${String(body.length).padStart(5)}    0     0   ${String(body.length*9).padStart(5)}      0 --:--:-- --:--:-- --:--:--  ${body.length*9}\n`);return 0}
    ctx.out(body.slice(0,60000)+(body.endsWith('\n')?'':'\n'));return status>=400&&args.includes('-f')?22:0;
  }
  async ssh(ctx){const host=ctx.args.find(a=>!a.startsWith('-'))||'';if(!host){ctx.err('usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] destination [command]\n');return 255}await sleep(1500,ctx.t);ctx.err(`${ctx.name}: connect to host ${host.split('@').pop()} port ${ctx.name==='telnet'?23:22}: Network is unreachable\n${C.gray}(DesktopSim läuft in einer Browser-Sandbox ohne direkte Netzwerkverbindungen.)${C.reset}\n`);return 255}
  async make(ctx){if(!ctx.fs.exists('Makefile',ctx.t.cwd)&&!ctx.fs.exists('makefile',ctx.t.cwd)){ctx.err(`make: *** Es wurden keine Ziele angegeben und keine »make«-Steuerdatei gefunden.  Schluss.\n`);return 2}const mk=ctx.fs.read(ctx.fs.exists('Makefile',ctx.t.cwd)?'Makefile':'makefile',ctx.t.cwd);const target=ctx.args[0];const rules={};let cur=null;for(const line of mk.split('\n')){const m=line.match(/^([\w.-]+)\s*:(.*)$/);if(m){cur=m[1];rules[cur]={deps:m[2].trim().split(/\s+/).filter(Boolean),cmds:[]};continue}if(cur&&/^\t/.test(line))rules[cur].cmds.push(line.trim())}const first=target||Object.keys(rules)[0];const run=async(name,seen=new Set())=>{if(seen.has(name))return 0;seen.add(name);const r=rules[name];if(!r){if(ctx.fs.exists(name,ctx.t.cwd))return 0;ctx.err(`make: *** Keine Regel vorhanden, um das Ziel »${name}« zu erstellen.  Schluss.\n`);return 2}for(const d of r.deps){const c=await run(d,seen);if(c)return c}for(const c of r.cmds){const silent=c.startsWith('@');const cmd=silent?c.slice(1):c;if(!silent)ctx.out(cmd+'\n');const code=await this.engine.runSource(cmd,ctx.t,ctx.io);if(code){ctx.err(`make: *** [Makefile: ${name}] Fehler ${code}\n`);return 2}}return 0};return run(first)}
  async dotnet(ctx){
    const args=ctx.args;if(args[0]==='--version'){ctx.out('8.0.404 (DesktopSim-Ausgabedemo)\n');return 0}
    if(args[0]==='new'){ctx.fs.write('Program.cs','Console.WriteLine("Hello, World!");\n',ctx.t.cwd);ctx.out('Die Vorlage "Konsolen-App" wurde erfolgreich erstellt.\n');this.app.notifyFiles?.();return 0}
    const file=args.find(a=>/\.cs$/i.test(a))||(ctx.name==='csc'?args[0]:'Program.cs');let src;try{src=ctx.fs.read(file,ctx.t.cwd)}catch{ctx.err(`Fehler: ${file} wurde nicht gefunden.\n`);return 1}
    const r=simulateCompiled('cs',src);if(r.error){ctx.err(r.error+'\n');return 1}ctx.out(r.output+'\n');ctx.err(`${C.gray}[C#: Ausgabe-Demo – im Browser steht keine .NET-Laufzeit zur Verfügung]${C.reset}\n`);return 0;
  }
  async startServer(port,ctx,kind){
    if(!/^\d{2,5}$/.test(port)||+port>65535){ctx.err('Ungültiger Port\n');return 1}
    if(this.app.servers?.has(port)){ctx.err(kind==='php'?`[${new Date().toUTCString()}] Failed to listen on localhost:${port} (reason: Address already in use)\n`:`OSError: [Errno 98] Address already in use\n`);return 1}
    this.app.servers?.set(port,{cwd:ctx.t.cwd,os:ctx.os,kind,log:[]});this.app.toast?.(`Virtueller Webserver auf localhost:${port} gestartet`);this.app.notifyServers?.();
    ctx.out(kind==='php'?`[${new Date().toUTCString()}] PHP 8.4.1 Development Server (http://localhost:${port}) started\n`:`Serving HTTP on 0.0.0.0 port ${port} (http://0.0.0.0:${port}/) ...\n`);
    ctx.err(`${C.gray}Öffne im DesktopSim-Browser http://localhost:${port} · Strg+C beendet den Server.${C.reset}\n`);
    const sv=this.app.servers.get(port);sv.print=s=>ctx.out(s);
    if(!ctx.t.io)return 0; // nicht-interaktiv (Tests): Server läuft weiter, Befehl kehrt zurück
    await new Promise(resolve=>ctx.t.cancelHooks.add(resolve));
    this.app.servers.delete(port);this.app.notifyServers?.();
    ctx.out(kind==='php'?'':`\nKeyboard interrupt received, exiting.\n`);return 0;
  }

  /** Virtueller HTTP-Server: liefert {status, type, body} für eine Anfrage an localhost. */
  async serveLocal(sv,path='/',query='',method='GET',body=''){
    const fs=this.app.fs;const clean=decodeURIComponent(String(path).split('?')[0]||'/');let target=fs.normalize('.'+clean,sv.cwd);
    const log=status=>{const line=sv.kind==='php'?`[${new Date().toUTCString()}] 127.0.0.1:${50000+Math.floor(Math.random()*9999)} [${status}]: ${method} ${path}\n`:`127.0.0.1 - - [${new Date().toLocaleString('en-GB').replace(',','')}] "${method} ${path} HTTP/1.1" ${status} -\n`;sv.print?.(line)};
    if(!target.startsWith(sv.cwd)){log(403);return{status:403,type:'text/html',body:'<h1>403 Forbidden</h1>'}}
    let node=fs.locate(target);
    if(node?.type==='dir'){const idx=['index.php','index.html','index.htm'].find(n=>fs.locate(joinPath(target,n))&&(n.endsWith('.php')?sv.kind==='php':true));if(idx){target=joinPath(target,idx);node=fs.locate(target)}else if(sv.kind!=='php'){const items=fs.list(target).map(e=>`<li><a href="${(clean.endsWith('/')?clean:clean+'/')+encodeURIComponent(e.name)}${e.type==='dir'?'/':''}">${e.name}${e.type==='dir'?'/':''}</a></li>`).join('');log(200);return{status:200,type:'text/html',body:`<!DOCTYPE HTML>\n<html lang="en">\n<head><meta charset="utf-8"><title>Directory listing for ${clean}</title></head>\n<body>\n<h1>Directory listing for ${clean}</h1>\n<hr>\n<ul>\n${items}\n</ul>\n<hr>\n</body>\n</html>\n`}}}
    if(!node||node.type!=='file'){log(404);return{status:404,type:'text/html',body:sv.kind==='php'?`<!doctype html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested resource <code class="url">${clean}</code> was not found on this server.</p></body></html>`:`<!DOCTYPE HTML>\n<html lang="en">\n<head><meta charset="utf-8"><title>Error response</title></head>\n<body>\n<h1>Error response</h1>\n<p>Error code: 404</p>\n<p>Message: File not found.</p>\n</body>\n</html>\n`}}
    const ext=extName(target);const types={html:'text/html',htm:'text/html',css:'text/css',js:'text/javascript',json:'application/json',txt:'text/plain',py:'text/x-python',svg:'image/svg+xml',png:'image/png'};
    if(ext==='php'&&sv.kind==='php'){let out='';const io={write:(text,stream)=>{if(stream==='stdout')out+=text;else out+=text},status:()=>{},readLine:async()=>null};
      if(!this.app.runtimes){log(200);return{status:200,type:'text/html',body:simulateCompiled('php',node.content).output}}
      const r=await this.app.runtimes.runPHP({source:node.content,entry:target.split('/').pop(),files:fs.snapshot(sv.cwd),web:{method,uri:path+(query?'?'+query:''),query,body}},io).promise;this.app.fs.applyChanges(sv.cwd,r.files||{});log(200);return{status:200,type:'text/html',body:out}}
    log(200);return{status:200,type:types[ext]||'application/octet-stream',body:node.content,enc:node.enc};
  }

  // ---------- Werkzeuge ----------
  async editorProgram(ctx){if(['code','ide'].includes(ctx.name))return this.openIDECmd(ctx);return this.openEditorCmd(ctx,ctx.name)}
  async openEditorCmd(ctx,kind){const file=ctx.args.find(a=>!a.startsWith('-')&&!a.startsWith('+'));this.app.openEditor?.(file||'',ctx.t.cwd,{flavor:kind});if(['nano','vim','vi'].includes(kind))ctx.out(`${C.gray}[${kind} öffnet im Editor-Fenster: ${file||'neue Datei'}]${C.reset}\n`);return 0}
  async openIDECmd(ctx){const file=ctx.args.find(a=>!a.startsWith('-'));if(ctx.args.includes('--version')||ctx.args.includes('-v')){ctx.out('1.105.0\nDesktopSim IDE\nx64\n');return 0}this.app.openIDE?.(file&&file!=='.'?file:'',ctx.t.cwd);return 0}
  async open(ctx){
    const args=ctx.args.filter(a=>!/^(-a|-e|\/b|\/wait|\/min|\/max)$/i.test(a)&&!/^-filepath$/i.test(a));let target=(args[0]||'').replace(/^"|"$/g,'');if(ctx.name==='start'&&args.length>1&&args[0]==='')target=args[1];
    if(!target){if(ctx.name==='start'){this.app.openTerminal?.();return 0}ctx.err(`Usage: ${ctx.name} [-e] [-a <application>] [filenames]\n`);return 1}
    if(/^https?:\/\//i.test(target)){this.app.openBrowser?.(target);return 0}
    const known={notepad:()=>this.app.openEditor?.(),calc:()=>this.app.openCalculator?.(),'calculator':()=>this.app.openCalculator?.(),cmd:()=>this.app.openTerminal?.(),powershell:()=>this.app.openTerminal?.('powershell'),explorer:()=>this.app.openFiles?.(),finder:()=>this.app.openFiles?.(),'system settings':()=>this.app.openSettings?.(),code:()=>this.app.openIDE?.(),'ms-settings:':()=>this.app.openSettings?.(),taskmgr:()=>this.app.openTaskManager?.()};
    const key=target.toLowerCase().replace(/\.exe$/,'').replace(/^-a\s*/,'');if(ctx.argv.includes('-a')&&known[key]){known[key]();return 0}if(known[key]&&!ctx.fs.exists(target,ctx.t.cwd)){known[key]();return 0}
    const node=ctx.fs.locate(target,ctx.t.cwd);if(!node){ctx.err(ctx.name==='open'?`The file ${ctx.fs.normalize(target,ctx.t.cwd)} does not exist.\n`:ctx.name==='start'?`Das System kann die Datei "${target}" nicht finden.\n`:`gio: file://${ctx.fs.normalize(target,ctx.t.cwd)}: Fehler beim Holen der Informationen für Datei »${ctx.fs.normalize(target,ctx.t.cwd)}«: Datei oder Verzeichnis nicht gefunden\n`);return 1}
    this.app.openPath?.(ctx.fs.normalize(target,ctx.t.cwd),{editor:ctx.argv.includes('-e')});return 0;
  }
  async fun(ctx){const n=ctx.name;if(n==='fun')this.app.openFunLab?.();if(n==='matrix')this.app.startMatrix?.();if(n==='party')this.app.launchConfetti?.();if(n==='byte'){const on=this.app.toggleByte?.();ctx.out(on?'Byte ist auf dem Desktop. Klicke ihn an!\n':'Byte macht eine Pause.\n');return 0}ctx.out(n==='matrix'?'Matrix-Modus aktiv. Mit Esc beenden.\n':n==='party'?'Party-Modus gestartet ✨\n':'Fun Lab geöffnet.\n');return 0}
  async toy(ctx){
    const n=ctx.name;if(!this.isInstalled(n,ctx.t))return this.engine.notFound(n,ctx.t,ctx.io);
    if(n==='cowsay'){const text=ctx.args.filter(a=>!a.startsWith('-')).join(' ')||(await ctx.input()).trim()||'Muh!';const lines=wrap(text,38);const w=Math.max(...lines.map(l=>l.length));const bubble=lines.length===1?[`< ${lines[0]} >`]:lines.map((l,i)=>`${i===0?'/':i===lines.length-1?'\\':'|'} ${l.padEnd(w)} ${i===0?'\\':i===lines.length-1?'/':'|'}`);ctx.out(` ${'_'.repeat(w+2)}\n${bubble.join('\n')}\n ${'-'.repeat(w+2)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||\n`);return 0}
    if(n==='fortune'){const q=['Wer A sagt, muss nicht B sagen. Er kann auch erkennen, dass A falsch war. – Bertolt Brecht','Talk is cheap. Show me the code. – Linus Torvalds','Es ist nicht zu wenig Zeit, die wir haben, sondern zu viel, die wir nicht nutzen. – Seneca','Programs must be written for people to read. – Harold Abelson','Der Computer ist nur so klug wie die Person, die davor sitzt.','First, solve the problem. Then, write the code. – John Johnson'];ctx.out(q[Math.floor(Math.random()*q.length)]+'\n');return 0}
    if(n==='lolcat'){const text=ctx.args.length?ctx.fs.read(ctx.args[0],ctx.t.cwd):await ctx.input();const cols=[31,33,32,36,34,35];let i=0;ctx.out([...text].map(ch=>ch==='\n'?(i+=3,ch):`\x1b[${cols[Math.floor(i++/2)%6]}m${ch}`).join('')+C.reset);return 0}
    if(n==='cmatrix'){this.app.startMatrix?.();return 0}
    if(n==='figlet'){ctx.out(bigText(ctx.args.join(' ')||'Hallo'));return 0}
    if(n==='sl'){const train=['      ====        ________                ___________ ','  _D _|  |_______/        \\__I_I_____===__|_________| ','   |(_)---  |   H\\________/ |   |        =|___ ___|   ','   /     |  |   H  |  |     |   |         ||_| |_||   ','  |      |  |   H  |__--------------------| [___] |   ','  | ________|___H__/__|_____/[][]~\\_______|       |   ','  |/ |   |-----------I_____I [][] []  D   |=======|__ ','__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ',' |/-=|___|=    ||    ||    ||    |_____/~\\___/        ','  \\_/      \\O=====O=====O=====O_/      \\_/            '];const width=Math.min(ctx.t.cols||90,110);for(let x=width;x>-60;x-=4){if(ctx.t.cancelled)break;ctx.out('\x1b[2J\x1b[H'+train.map(l=>x>=0?' '.repeat(x)+l.slice(0,Math.max(0,width-x)):l.slice(-x)).join('\n')+'\n');await sleep(60,ctx.t)}ctx.out('\x1b[2J\x1b[H');return 0}
    return 0;
  }
  async neofetch(ctx,tool){
    const t=ctx.t,os=ctx.os;if(tool==='neofetch'&&!this.isInstalled('neofetch',t)||tool==='fastfetch'&&!this.isInstalled('fastfetch',t))return this.engine.notFound(tool,t,ctx.io);
    const logos={debian:[`       _,met$$$$$gg.`,`    ,g$$$$$$$$$$$$$$$P.`,`  ,g$$P"     """Y$$.".`,` ,$$P'              \`$$$.`,`',$$P       ,ggs.     \`$$b:`,`\`d$$'     ,$P"'   .    $$$`,` $$P      d$'     ,    $$P`,` $$:      $$.   -    ,d$$'`,` $$;      Y$b._   _,d$P'`,` Y$$.    \`.\`"Y$$$$P"'`,` \`$$b      "-.__`,`  \`Y$$b`,`   \`Y$$.`,`     \`$$b.`,`       \`Y$$b.`,`         \`"Y$b._`,`             \`""""`],arch:[`                  -\``,`                 .o+\``,`                \`ooo/`,`               \`+oooo:`,`              \`+oooooo:`,`              -+oooooo+:`,`            \`/:-:++oooo+:`,`           \`/++++/+++++++:`,`          \`/++++++++++++++:`,`         \`/+++ooooooooooooo/\``,`        ./ooosssso++osssssso+\``,`       .oossssso-\`\`\`\`/ossssss+\``,`      -osssssso.      :ssssssso.`,`     :osssssss/        osssso+++.`,`    /ossssssss/        +ssssooo/-`,`  \`/ossssso+/:-        -:/+osssso+-`,` \`+sso+:-\`                 \`.-/+oso:`,`\`++:.                           \`-/+/`],macos:[`                    'c.`,`                 ,xNMM.`,`               .OMMMMo`,`               OMMM0,`,`     .;loddo:' loolloddol;.`,`   cKMMMMMMMMMMNWMMMMMMMMMM0:`,` .KMMMMMMMMMMMMMMMMMMMMMMMWd.`,` XMMMMMMMMMMMMMMMMMMMMMMMX.`,`;MMMMMMMMMMMMMMMMMMMMMMMM:`,`:MMMMMMMMMMMMMMMMMMMMMMMM:`,`.MMMMMMMMMMMMMMMMMMMMMMMMX.`,` kMMMMMMMMMMMMMMMMMMMMMMMMWd.`,` .XMMMMMMMMMMMMMMMMMMMMMMMMMMk`,`  .XMMMMMMMMMMMMMMMMMMMMMMMMK.`,`    kMMMMMMMMMMMMMMMMMMMMMMd`,`     ;KMMMMMMMWXXWMMMMMMMk.`,`       .cooc,.    .,coo:.`],unix:[`   _____ ____`,`  / ___// __ \\`,`  \\__ \\/ / / /`,` ___/ / /_/ /`,`/____/\\____/`]};
    const color={debian:'\x1b[1;31m',arch:'\x1b[1;36m',macos:'\x1b[1;32m',unix:'\x1b[1;33m'}[os];const logo=logos[os]||logos.debian;
    const up=Math.floor((Date.now()-(this.app.bootTime||Date.now()))/60000);const user=`${t.admin?'root':'student'}@${{debian:'debian-sim',arch:'arch-sim',macos:'Mac',unix:'workstation'}[os]}`;
    const info=[`${color}${user}${C.reset}`,'-'.repeat(user.length),...[['OS',{debian:'Debian GNU/Linux 13 (trixie) x86_64',arch:'Arch Linux x86_64',macos:'macOS Tahoe 26.1 arm64',unix:'Oracle Solaris 11.4 i86pc'}[os]],['Host','DesktopSim Browser-VM'],['Kernel',{debian:'Linux 6.12.48+deb13-amd64',arch:'Linux 6.17.7-arch1-1',macos:'Darwin 25.1.0',unix:'SunOS 5.11'}[os]],['Uptime',up<60?`${up} mins`:`${Math.floor(up/60)} hours, ${up%60} mins`],['Packages',{debian:'1842 (dpkg)',arch:'912 (pacman)',macos:'64 (brew)',unix:'731 (pkg)'}[os]],['Shell',t.shell+' '+({bash:'5.2.37',zsh:'5.9',sh:'5.2'}[t.shell]||'')],['Resolution',`${screen?.width||1920}x${screen?.height||1080}`],['DE',{debian:'GNOME 48',arch:'KDE Plasma 6.5',macos:'Aqua',unix:'CDE 2.3'}[os]],['Terminal',{debian:'gnome-terminal',arch:'konsole',macos:'Apple_Terminal',unix:'dtterm'}[os]],['CPU',`Browser vCPU (${navigator?.hardwareConcurrency||8}) @ 3.00 GHz`],['Memory',`${(2.3+Math.random()).toFixed(2)} GiB / 15.50 GiB`],['Locale','de_DE.UTF-8']].map(([k,v])=>`${color}${k}${C.reset}: ${v}`),'',[40,41,42,43,44,45,46,47].map(c=>`\x1b[${c}m   `).join('')+C.reset];
    const w=Math.max(...logo.map(l=>l.length))+3;const rows=Math.max(logo.length,info.length);let out='';for(let i=0;i<rows;i++)out+=`${color}${(logo[i]||'').padEnd(w)}${C.reset}${info[i]||''}\n`;ctx.out(out);return 0;
  }
  async man(ctx){
    const name=ctx.args.filter(a=>!/^\d$/.test(a))[0];if(!name){ctx.err(ctx.os==='debian'?'Welche Handbuchseite wollen Sie?\nZ.B. versuchen Sie »man man«.\n':'What manual page do you want?\nFor example, try \'man man\'.\n');return 1}
    const page=MAN[name];if(!page){ctx.err(ctx.os==='debian'?`Kein Handbucheintrag für ${name} vorhanden\n`:`No manual entry for ${name}\n`);return 16}
    const up=name.toUpperCase()+'(1)';ctx.out(`${up}${' '.repeat(Math.max(2,64-up.length*2))}Benutzerbefehle${' '.repeat(8)}${up}\n\n${C.bold}BEZEICHNUNG${C.reset}\n       ${name} - ${page[0]}\n\n${C.bold}ÜBERSICHT${C.reset}\n       ${C.bold}${name}${C.reset} ${page[1]}\n\n${C.bold}BESCHREIBUNG${C.reset}\n${page[2].split('\n').map(l=>'       '+l).join('\n')}\n\n${page[3]?`${C.bold}BEISPIELE${C.reset}\n${page[3].split('\n').map(l=>'       '+l).join('\n')}\n\n`:''}DesktopSim                         2026                          ${up}\n`);return 0;
  }
  async git(ctx){return this.app.gitCommand?this.app.gitCommand(ctx):gitCommand(this.app,ctx)}
}

function wrap(text,w){const words=String(text).split(/\s+/);const lines=[];let cur='';for(const word of words){if((cur+' '+word).trim().length>w){if(cur)lines.push(cur);cur=word}else cur=(cur+' '+word).trim()}if(cur)lines.push(cur);return lines.length?lines:['']}
function hash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h}
const FONT={A:[' █ ','█ █','███','█ █','█ █'],B:['██ ','█ █','██ ','█ █','██ '],C:[' ██','█  ','█  ','█  ',' ██'],D:['██ ','█ █','█ █','█ █','██ '],E:['███','█  ','██ ','█  ','███'],F:['███','█  ','██ ','█  ','█  '],G:[' ██','█  ','█ █','█ █',' ██'],H:['█ █','█ █','███','█ █','█ █'],I:['███',' █ ',' █ ',' █ ','███'],J:['  █','  █','  █','█ █',' █ '],K:['█ █','██ ','█  ','██ ','█ █'],L:['█  ','█  ','█  ','█  ','███'],M:['█   █','██ ██','█ █ █','█   █','█   █'],N:['█  █','██ █','█ ██','█  █','█  █'],O:[' █ ','█ █','█ █','█ █',' █ '],P:['██ ','█ █','██ ','█  ','█  '],Q:[' █ ','█ █','█ █','██ ',' ██'],R:['██ ','█ █','██ ','█ █','█ █'],S:[' ██','█  ',' █ ','  █','██ '],T:['███',' █ ',' █ ',' █ ',' █ '],U:['█ █','█ █','█ █','█ █','███'],V:['█ █','█ █','█ █','█ █',' █ '],W:['█   █','█   █','█ █ █','██ ██','█   █'],X:['█ █','█ █',' █ ','█ █','█ █'],Y:['█ █','█ █',' █ ',' █ ',' █ '],Z:['███','  █',' █ ','█  ','███'],' ':['  ','  ','  ','  ','  '],'!':['█','█','█',' ','█'],'0':['███','█ █','█ █','█ █','███'],'1':[' █','██',' █',' █',' █'],'2':['██ ','  █',' █ ','█  ','███'],'3':['██ ','  █',' █ ','  █','██ ']};
function bigText(s){const chars=[...s.toUpperCase()].map(c=>FONT[c]||FONT[' ']);return[0,1,2,3,4].map(r=>chars.map(c=>c[r]).join(' ')).join('\n')+'\n'}
const MAN={
  ls:['Verzeichnisinhalte auflisten','[OPTION]... [DATEI]...','Listet Informationen über die DATEIen auf (standardmäßig das aktuelle Verzeichnis).\n-a  auch versteckte Einträge (beginnend mit .) anzeigen\n-l  langes Listenformat (Rechte, Besitzer, Größe, Datum)\n-h  Größen menschenlesbar (1K, 234M)\n-R  Unterverzeichnisse rekursiv auflisten\n-t  nach Änderungszeit sortieren','ls -la\nls -lh ~/Projects'],
  cd:['das Arbeitsverzeichnis wechseln','[VERZEICHNIS]','Wechselt in VERZEICHNIS. Ohne Argument ins Home-Verzeichnis, »cd -« zurück ins vorherige, »cd ..« eine Ebene nach oben.','cd ~/Projects\ncd ..'],
  pwd:['den Namen des aktuellen Arbeitsverzeichnisses ausgeben','','Gibt den vollständigen Pfad des aktuellen Verzeichnisses aus.',''],
  mkdir:['Verzeichnisse anlegen','[OPTION]... VERZEICHNIS...','Legt VERZEICHNIS(se) an, falls sie noch nicht existieren.\n-p  übergeordnete Verzeichnisse bei Bedarf mit anlegen\n-v  für jedes angelegte Verzeichnis eine Meldung ausgeben','mkdir -p schule/informatik'],
  rm:['Dateien oder Verzeichnisse entfernen','[OPTION]... DATEI...','Entfernt DATEIen endgültig (kein Papierkorb!).\n-r  Verzeichnisse rekursiv entfernen\n-f  nie nachfragen, nicht existierende Dateien ignorieren\n-i  vor jedem Entfernen nachfragen','rm -r alter_ordner'],
  cp:['Dateien und Verzeichnisse kopieren','[OPTION]... QUELLE ZIEL','Kopiert QUELLE nach ZIEL.\n-r  Verzeichnisse rekursiv kopieren\n-v  ausführlich','cp hello.py backup.py'],
  mv:['Dateien verschieben oder umbenennen','[OPTION]... QUELLE ZIEL','Benennt QUELLE in ZIEL um oder verschiebt sie in ein Verzeichnis.','mv alt.txt neu.txt'],
  cat:['Dateien verketten und auf der Standardausgabe ausgeben','[OPTION]... [DATEI]...','Gibt den Inhalt der DATEIen aus. Ohne DATEI wird die Standardeingabe gelesen (Ende mit Strg+D).\n-n  alle Zeilen nummerieren','cat README.txt\ncat a.txt b.txt > beide.txt'],
  grep:['Zeilen ausgeben, die auf ein Muster passen','[OPTION...] MUSTER [DATEI...]','Durchsucht DATEIen nach Zeilen, die auf das MUSTER (regulärer Ausdruck) passen.\n-i  Groß-/Kleinschreibung ignorieren\n-n  Zeilennummern anzeigen\n-v  nicht passende Zeilen ausgeben\n-r  rekursiv suchen\n-c  nur Anzahl ausgeben','grep -n print hello.py\nls | grep .py'],
  chmod:['Zugriffsrechte von Dateien ändern','MODUS DATEI...','Ändert die Rechte (r=lesen, w=schreiben, x=ausführen) für Besitzer (u), Gruppe (g) und andere (o).\nOktal: 7=rwx, 6=rw-, 5=r-x, 4=r--','chmod +x skript.sh\nchmod 755 skript.sh'],
  echo:['eine Textzeile ausgeben','[-neE] [TEXT]...','Gibt TEXT aus. -n unterdrückt den Zeilenumbruch, -e wertet Escape-Sequenzen wie \\n aus.','echo "Hallo $USER"\necho Text > datei.txt'],
  sudo:['einen Befehl als anderer Benutzer (root) ausführen','BEFEHL','Führt BEFEHL mit Administratorrechten aus. Fragt nach dem Passwort des Benutzers (in DesktopSim: beliebiges Passwort).','sudo apt install cowsay'],
  apt:['Paketverwaltung für Debian','[OPTIONEN] BEFEHL','update – Paketlisten aktualisieren\ninstall PAKET – Paket installieren\nremove PAKET – Paket entfernen\nsearch TEXT – Pakete suchen','sudo apt update\nsudo apt install cowsay'],
  python3:['Interpreter für die Programmiersprache Python','[-c BEFEHL | -m MODUL | DATEI] [ARG]...','Ohne Argumente startet die interaktive Python-Shell (beenden mit exit() oder Strg+D). In DesktopSim läuft echtes CPython 3.14 als WebAssembly (Pyodide).','python3 hello.py\npython3 -m http.server 8000'],
  gcc:['GNU-Projekt C- und C++-Compiler','[-o AUSGABE] [OPTIONEN] DATEI...','Übersetzt C-Quelltext in ein ausführbares Programm. In DesktopSim wird echtes Clang/LLVM 22 verwendet; das Ergebnis ist WebAssembly.\n-o  Name der Ausgabedatei (Standard: a.out)\n-Wall alle Warnungen\n-O2 optimieren','gcc hello.c -o hallo\n./hallo'],
  'g++':['GNU-Projekt C++-Compiler','[-o AUSGABE] [OPTIONEN] DATEI...','Wie gcc, aber mit C++-Standardbibliothek (iostream, string, vector …). Hinweis: Exceptions (throw/try) sind in der WebAssembly-Sandbox deaktiviert.','g++ main.cpp -o main\n./main'],
  javac:['Java-Compiler','[OPTIONEN] DATEI.java...','Übersetzt Java-Quelltext in Bytecode (.class). In DesktopSim läuft das echte javac aus OpenJDK 8 in der CheerpJ-JVM.','javac Main.java\njava Main'],
  java:['Java-Anwendung starten','[OPTIONEN] KLASSE [ARG]...','Startet die main-Methode der KLASSE in der Java Virtual Machine (CheerpJ, Java 8).','java Main'],
  ssh:['OpenSSH-Client','[BENUTZER@]HOST','Baut eine verschlüsselte Verbindung zu einem entfernten Rechner auf. In der Browser-Sandbox nicht möglich.',''],
  ping:['ICMP ECHO_REQUEST an Netzwerk-Hosts senden','[-c ANZAHL] ZIEL','Prüft, ob ein Rechner erreichbar ist, und misst die Antwortzeit. Unter Linux läuft ping, bis Strg+C gedrückt wird.','ping -c 4 datenflix007.github.io'],
  man:['eine Oberfläche für die System-Referenzhandbücher','[SEITE]','Zeigt die Handbuchseite zu einem Befehl.','man ls'],
  nano:['ein kleiner, freundlicher Texteditor','[DATEI]','In DesktopSim öffnet nano den grafischen Editor.',''],
  sort:['Zeilen von Textdateien sortieren','[OPTION]... [DATEI]...','-r umgekehrt, -n numerisch, -u nur eindeutige Zeilen','sort namen.txt\nls | sort -r'],
  wc:['Zeilen, Wörter und Bytes zählen','[OPTION]... [DATEI]...','-l Zeilen, -w Wörter, -c Bytes','wc -l hello.py'],
  head:['den ersten Teil von Dateien ausgeben','[-n ANZAHL] [DATEI]...','Gibt die ersten 10 (bzw. ANZAHL) Zeilen aus.','head -n 3 hello.py'],
  tail:['den letzten Teil von Dateien ausgeben','[-n ANZAHL] [DATEI]...','Gibt die letzten 10 (bzw. ANZAHL) Zeilen aus.','tail -n 3 hello.py'],
  find:['nach Dateien in einer Verzeichnishierarchie suchen','[PFAD] [-name MUSTER] [-type f|d]','Durchsucht PFAD rekursiv.','find . -name "*.py"'],
  git:['das dumme Inhalts-Tracking-Werkzeug','BEFEHL [ARGS]','status, add, commit -m, log, branch, switch, diff (DesktopSim-Lernsimulation)','git add hello.py\ngit commit -m "Erster Commit"']
};
MAN.python=MAN.python3;MAN.clang=MAN.gcc;MAN['clang++']=MAN['g++'];

export function gitCommand(app,ctx){
  const repo=app.git,args=ctx.args,sub=(args[0]||'').toLowerCase(),rest=args.slice(1);
  if(!repo){ctx.err('git: Lernumgebung nicht verfügbar\n');return 1}
  if(!sub||sub==='help'||sub==='--help'){ctx.out('Verwendung: git [--version] [--help] <Befehl> [<Argumente>]\n\nHäufig verwendete Git-Befehle:\n   init       Leeres Git-Repository erstellen\n   status     Status des Arbeitsverzeichnisses anzeigen\n   add        Dateiinhalte zum Commit vormerken\n   commit     Änderungen in das Repository eintragen\n   log        Commit-Historie anzeigen\n   branch     Branches anzeigen, erstellen\n   switch     Branches wechseln\n   diff       Änderungen anzeigen\n   graph      Git Graph öffnen (DesktopSim)\n');return 0}
  if(sub==='--version'||sub==='version'){ctx.out('git version 2.51.0\n');return 0}
  try{
    if(sub==='status'){const s=repo.status();ctx.out(`Auf Branch ${s.branch}\n${s.staged.length?`Zum Commit vorgemerkte Änderungen:\n  (benutzen Sie "git restore --staged <Datei>..." zum Entfernen aus der Staging-Area)\n${s.staged.map(f=>`\t${C.green}neue Datei:     ${f}${C.reset}`).join('\n')}\n`:'nichts zu committen, Arbeitsverzeichnis unverändert\n'}`);return 0}
    if(sub==='add'){if(!rest.length){ctx.err('Nichts spezifiziert, nichts hinzugefügt.\nhint: Vielleicht wollten Sie sagen \'git add .\'?\n');return 1}repo.stage(rest,app.fs,ctx.t.cwd);return 0}
    if(sub==='restore'&&rest[0]==='--staged'){if(!rest[1]){ctx.err('fatal: Sie müssen mindestens einen Pfad angeben.\n');return 128}repo.unstage(rest[1]);return 0}
    if(sub==='commit'){const mi=rest.indexOf('-m');if(mi<0){ctx.err('Aborting commit due to empty commit message.\n'+C.gray+'(DesktopSim: nutze git commit -m "Nachricht")'+C.reset+'\n');return 1}const c=repo.commit(rest.slice(mi+1).join(' '));ctx.out(`[${repo.status().branch} ${c.id}] ${c.message}\n ${c.files.length} file${c.files.length===1?'':'s'} changed, ${c.files.length*12} insertions(+)\n`);return 0}
    if(sub==='log'){const one=rest.includes('--oneline');ctx.out(repo.log().map((c,i)=>one?`${C.yellow}${c.id}${C.reset}${i===0?` (${C.cyan}HEAD -> ${C.green}${repo.status().branch}${C.reset})`:''} ${c.message}`:`${C.yellow}commit ${c.id}${C.reset}${i===0?` (${C.cyan}HEAD -> ${C.green}${repo.status().branch}${C.reset}${C.yellow})${C.reset}`:''}\nAuthor: ${c.author}\nDate:   ${new Date(c.time).toString().slice(0,24)} +0100\n\n    ${c.message}\n`).join('\n')+'\n');return 0}
    if(sub==='branch'){if(!rest[0]){ctx.out(repo.branchNames().map(b=>b===repo.status().branch?`* ${C.green}${b}${C.reset}`:`  ${b}`).join('\n')+'\n');return 0}repo.createBranch(rest[0]);return 0}
    if(sub==='switch'||sub==='checkout'){const create=rest[0]==='-c'||rest[0]==='-b';const b=create?rest[1]:rest[0];if(!b){ctx.err(`fatal: fehlender Branch- oder Commit-Parameter\n`);return 128}if(create)repo.createBranch(b);repo.switchBranch(b);ctx.err(create?`Zu neuem Branch '${b}' gewechselt\n`:`Zu Branch '${b}' gewechselt\n`);return 0}
    if(sub==='diff'){const s=repo.status().staged;ctx.out(s.map(f=>`${C.bold}diff --git a/${f} b/${f}${C.reset}\n${C.cyan}@@ -1 +1 @@${C.reset}\n${C.green}+ Lernänderung für ${f}${C.reset}\n`).join(''));return 0}
    if(sub==='graph'||sub==='gui'){app.openGitGraph?.();return 0}
    if(sub==='init'){ctx.out(`Leeres Git-Repository in ${pathDisplay(ctx.os,ctx.t.cwd)}/.git/ initialisiert\n`);return 0}
    if(sub==='push'||sub==='pull'||sub==='clone'||sub==='fetch'){ctx.err(`fatal: Konnte nicht vom Remote-Repository lesen.\n\nBitte stellen Sie sicher, dass die korrekten Zugriffsrechte bestehen\nund das Repository existiert.\n${C.gray}(DesktopSim: Git ist eine lokale Lernsimulation ohne Remotes.)${C.reset}\n`);return 128}
    ctx.err(`git: '${sub}' ist kein Git-Befehl. Siehe 'git --help'.\n`);return 1;
  }catch(e){ctx.err(`fatal: ${e.message}\n`);return 128}
}
