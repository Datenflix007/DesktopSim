// Virtuelle Python-Umgebungen (venv) und pip-Paketverwaltung für alle simulierten Systeme.
// Ein venv ist ein echter Ordner im virtuellen Dateisystem (pyvenv.cfg, bin/ bzw. Scripts/,
// site-packages mit *.dist-info). Pakete außerhalb eines venv werden je System gespeichert.
import {isWindows,joinPath as join2,pathDisplay,homePath} from '../vfs.js';
const joinPath=(...parts)=>parts.reduce((a,b)=>join2(a,b));

export const PY_VERSION='3.14.2',PY_SHORT='3.14',PIP_VERSION='25.2';
export const layout=os=>isWindows(os)?{bin:'Scripts',site:'Lib/site-packages',exe:'.exe'}:{bin:'bin',site:`lib/python${PY_SHORT}/site-packages`,exe:''};
export const normName=n=>String(n).toLowerCase().replace(/[-_.]+/g,'-');
const distDir=(name,version)=>`${String(name).replace(/[-.]+/g,'_')}-${version}.dist-info`;

const ACTIVATE_SH=(dir,prompt)=>`# This file must be used with "source bin/activate" *from bash*
# You cannot run it directly

deactivate () {
    # reset old environment variables
    unset VIRTUAL_ENV VIRTUAL_ENV_PROMPT
}

VIRTUAL_ENV="${dir}"
export VIRTUAL_ENV
VIRTUAL_ENV_PROMPT="(${prompt}) "
export VIRTUAL_ENV_PROMPT
PATH="$VIRTUAL_ENV/bin:$PATH"
export PATH
`;
const ACTIVATE_BAT=(dir,prompt)=>`@echo off

rem This file is UTF-8 encoded, so we need to update the current code page while executing it
set "VIRTUAL_ENV=${dir}"
set "VIRTUAL_ENV_PROMPT=(${prompt}) "
set PROMPT=(${prompt}) %PROMPT%
set "PATH=%VIRTUAL_ENV%\\Scripts;%PATH%"
`;
const ACTIVATE_PS1=(prompt)=>`<#
.Synopsis
Activate a Python virtual environment for the current PowerShell session.

.Description
Pushes the python executable for a virtual environment to the front of the
$Env:PATH environment variable and sets the prompt to signify that you are
in a Python virtual environment. Makes use of the command line switches as
well as the \`pyvenv.cfg\` file values present in the virtual environment.
#>
Param(
    [Parameter(Mandatory = $false)]
    [String]
    $VenvDir,
    [Parameter(Mandatory = $false)]
    [String]
    $Prompt = "${prompt}"
)
function global:deactivate ([switch]$NonDestructive) { Remove-Item -Path env:VIRTUAL_ENV -ErrorAction SilentlyContinue }
$env:VIRTUAL_ENV = $VenvDir
`;

/** python -m venv DIR – legt die Ordnerstruktur wie CPython an. */
export function createVenv(fs,dir,os,{prompt=null,systemSite=false,withoutPip=false,clear=false}={}){
  const L=layout(os),display=pathDisplay(os,dir),name=prompt||dir.split('/').pop();
  if(clear&&fs.exists(dir))fs.remove(dir,null,true);
  fs.mkdir(joinPath(dir,L.bin),null,true);fs.mkdir(joinPath(dir,L.site),null,true);
  if(!isWindows(os))fs.mkdir(joinPath(dir,'include/python'+PY_SHORT),null,true);else fs.mkdir(joinPath(dir,'Include'),null,true);
  const home=isWindows(os)?'C:\\Program Files\\Python314':os==='macos'?'/opt/homebrew/opt/python@3.14/bin':'/usr/bin';
  fs.write(joinPath(dir,'pyvenv.cfg'),`home = ${home}\ninclude-system-site-packages = ${systemSite?'true':'false'}\nversion = ${PY_VERSION}\nexecutable = ${home}${isWindows(os)?'\\python.exe':'/python'+PY_SHORT}\ncommand = ${isWindows(os)?home+'\\python.exe':'/usr/bin/python3'} -m venv ${display}\n${prompt?`prompt = '${prompt}'\n`:''}`);
  fs.write(joinPath(dir,'.gitignore'),'# Created by venv; see https://docs.python.org/3/library/venv.html\n*\n');
  const bin=joinPath(dir,L.bin);
  fs.write(joinPath(bin,'activate'),ACTIVATE_SH(isWindows(os)?display.replace(/^C:/,'/c').replace(/\\/g,'/'):display,name));
  fs.write(joinPath(bin,'Activate.ps1'),ACTIVATE_PS1(name));
  if(isWindows(os)){fs.write(joinPath(bin,'activate.bat'),ACTIVATE_BAT(display,name));fs.write(joinPath(bin,'deactivate.bat'),'@echo off\nset VIRTUAL_ENV=\nset VIRTUAL_ENV_PROMPT=\n')}
  else{fs.write(joinPath(bin,'activate.fish'),`# This file must be used with "source <venv>/bin/activate.fish" *from fish*\nset -gx VIRTUAL_ENV "${display}"\n`);fs.write(joinPath(bin,'activate.csh'),`# This file must be used with "source bin/activate.csh" *from csh*.\nsetenv VIRTUAL_ENV "${display}"\n`)}
  const exe=(n)=>fs.write(joinPath(bin,n+L.exe),isWindows(os)?'MZ\u0090 [Python-Starter · DesktopSim]':`#!${display}/bin/python3\n# DesktopSim: verweist auf ${home}/python${PY_SHORT}\n`,null,false,isWindows(os)?{enc:'exe',size:270336}:{mode:0o755});
  for(const n of isWindows(os)?['python','pythonw']:['python','python3','python'+PY_SHORT])exe(n);
  if(!withoutPip){for(const n of isWindows(os)?['pip','pip3','pip'+PY_SHORT]:['pip','pip3','pip'+PY_SHORT])exe(n);writeDist(fs,dir,os,{name:'pip',version:PIP_VERSION,summary:'The PyPA recommended tool for installing Python packages.',homepage:'https://pip.pypa.io/',license:'MIT',requires:[]})}
}
export function venvConfig(fs,dir){try{const text=fs.read(joinPath(dir,'pyvenv.cfg'));const cfg={};for(const l of text.split('\n')){const m=l.match(/^\s*([\w-]+)\s*=\s*(.*?)\s*$/);if(m)cfg[m[1]]=m[2].replace(/^'(.*)'$/,'$1')}return cfg}catch{return null}}
export function isVenv(fs,dir){return Boolean(dir)&&fs.exists(joinPath(dir,'pyvenv.cfg'))}
/** Gehört dieser Pfad zu einem Aktivierungs-/Deaktivierungsskript eines venv? */
export function venvScript(fs,path){
  const m=String(path).match(/^(.*)\/(bin|Scripts)\/(activate|activate\.bat|activate\.fish|activate\.csh|Activate\.ps1|deactivate\.bat|deactivate)$/i);
  if(!m||!isVenv(fs,m[1]))return null;return{venv:m[1],kind:/deactivate/i.test(m[3])?'deactivate':'activate',script:m[3]};
}
/** Starter (python/pip) innerhalb eines venv – z. B. ".venv/bin/python skript.py". */
export function venvLauncher(fs,path){const m=String(path).match(/^(.*)\/(bin|Scripts)\/(python[\d.]*|pythonw|pip[\d.]*)(\.exe)?$/i);if(!m||!isVenv(fs,m[1]))return null;return{venv:m[1],tool:/^pip/i.test(m[3])?'pip':'python'}}
export function promptName(fs,dir){const cfg=venvConfig(fs,dir);return cfg?.prompt||dir.split('/').pop()}
export function activate(t,fs,dir){t.venv={path:dir,name:promptName(fs,dir)};const disp=pathDisplay(t.os,dir);t.vars.VIRTUAL_ENV=disp;t.vars.VIRTUAL_ENV_PROMPT=`(${t.venv.name}) `}
export function deactivate(t){t.venv=null;delete t.vars.VIRTUAL_ENV;delete t.vars.VIRTUAL_ENV_PROMPT}
export function sitePath(os,venv){return venv?joinPath(venv,layout(os).site):isWindows(os)?'/Users/Student/AppData/Roaming/Python/Python314/site-packages':`${homePath(os)}/.local/lib/python${PY_SHORT}/site-packages`}

// ---------- Pakete ----------
const globalKey=os=>'desktopsim-v3-pip-'+os;
export function globalPackages(os){try{return JSON.parse(localStorage.getItem(globalKey(os))||'{}')}catch{return{}}}
function saveGlobal(os,map){try{localStorage.setItem(globalKey(os),JSON.stringify(map))}catch{}}
export function listPackages(fs,os,venv){
  if(!venv){return Object.values(globalPackages(os))}
  const site=joinPath(venv,layout(os).site);let entries=[];try{entries=fs.list(site)}catch{return[]}
  const out=[];for(const e of entries){const m=e.name.match(/^(.+)-([^-]+)\.dist-info$/);if(!m||e.type!=='dir')continue;let meta={};try{meta=parseMeta(fs.read(joinPath(site,e.name,'METADATA')))}catch{}out.push({name:meta.Name||m[1].replace(/_/g,'-'),version:meta.Version||m[2],summary:meta.Summary||'',homepage:meta['Home-page']||'',author:meta.Author||'',license:meta.License||'',requires:(meta.requires||[])})}
  return out.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
}
function parseMeta(text){const meta={requires:[]};for(const l of text.split('\n')){const m=l.match(/^([\w-]+):\s?(.*)$/);if(!m)continue;if(m[1]==='Requires-Dist')meta.requires.push(m[2].split(/[\s;<>=!~(\[]/)[0]);else meta[m[1]]=m[2]}return meta}
export function findPackage(fs,os,venv,name){return listPackages(fs,os,venv).find(p=>normName(p.name)===normName(name))}
export function writeDist(fs,venv,os,info){
  if(!venv){const map=globalPackages(os);map[normName(info.name)]={name:info.name,version:info.version,summary:info.summary||'',homepage:info.homepage||'',author:info.author||'',license:info.license||'',requires:info.requires||[]};saveGlobal(os,map);return}
  removeDist(fs,venv,os,info.name);
  const dir=joinPath(venv,layout(os).site,distDir(info.name,info.version));fs.mkdir(dir,null,true);
  fs.write(joinPath(dir,'METADATA'),`Metadata-Version: 2.4\nName: ${info.name}\nVersion: ${info.version}\nSummary: ${info.summary||''}\nHome-page: ${info.homepage||''}\nAuthor: ${info.author||''}\nLicense: ${info.license||''}\n${(info.requires||[]).map(r=>`Requires-Dist: ${r}\n`).join('')}`);
  fs.write(joinPath(dir,'INSTALLER'),'pip\n');
  if(info.requested)fs.write(joinPath(dir,'REQUESTED'),'');
}
export function removeDist(fs,venv,os,name){
  if(!venv){const map=globalPackages(os);delete map[normName(name)];saveGlobal(os,map);return}
  const site=joinPath(venv,layout(os).site);try{for(const e of fs.list(site)){const m=e.name.match(/^(.+)-([^-]+)\.dist-info$/);if(m&&normName(m[1])===normName(name))fs.remove(joinPath(site,e.name),null,true)}}catch{}
}
export function requiredBy(fs,os,venv,name){return listPackages(fs,os,venv).filter(p=>(p.requires||[]).some(r=>normName(r)===normName(name))).map(p=>p.name)}

/** PEP 668: System-Python unter Debian/Arch/macOS lässt pip install ohne venv nicht zu. */
export function externallyManaged(os){
  const hint={debian:['apt install','python3-xyz'],arch:['pacman -S','python-xyz'],macos:['brew install','xyz']}[os];if(!hint)return null;
  const venvCmd=os==='macos'?'python3 -m venv path/to/venv':'python3 -m venv path/to/venv';
  return `\x1b[1;31merror\x1b[0m: \x1b[1mexternally-managed-environment\x1b[0m

\x1b[31m×\x1b[0m This environment is externally managed
\x1b[31m╰─>\x1b[0m To install Python packages system-wide, try ${hint[0]}
    ${hint[1]}, where xyz is the package you are trying to
    install.

    If you wish to install a non-${os==='macos'?'brew':os==='arch'?'Arch':'Debian'}-packaged Python package,
    create a virtual environment using ${venvCmd}.
    Then use path/to/venv/bin/python and path/to/venv/bin/pip. Make
    sure you have ${os==='debian'?'python3-full':'python'} installed.

\x1b[35mnote\x1b[0m: If you believe this is a mistake, please contact your Python installation or OS distribution provider. You can override this, at the risk of breaking your Python installation or OS, by passing --break-system-packages.
\x1b[36mhint\x1b[0m: See PEP 668 for the detailed specification.
`;
}
