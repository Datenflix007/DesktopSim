// Lokale Git-Lernsimulation. Sie verwaltet ausschließlich Metadaten im Browser,
// niemals ein echtes Repository, Remote oder einen Systemprozess.
const clone=value=>JSON.parse(JSON.stringify(value));
const initialState=()=>({
  currentBranch:'main',sequence:1,staged:[],
  branches:{main:'8d7b3fe','feature/struktur':'6c1d9a4'},
  commits:[
    {id:'84a1f0c',parent:null,branch:'main',message:'Projekt angelegt',author:'Student <student@desktopsim.local>',time:'2026-10-01T09:00:00.000Z',files:['README.txt']},
    {id:'4b2ac7e',parent:'84a1f0c',branch:'main',message:'Python-Beispiel ergänzt',author:'Student <student@desktopsim.local>',time:'2026-10-03T10:20:00.000Z',files:['hello.py']},
    {id:'6c1d9a4',parent:'4b2ac7e',branch:'feature/struktur',message:'Ablauf als Struktogramm geplant',author:'Student <student@desktopsim.local>',time:'2026-10-05T13:45:00.000Z',files:['README.txt']},
    {id:'8d7b3fe',parent:'4b2ac7e',branch:'main',message:'Willkommen-Programm verbessert',author:'Student <student@desktopsim.local>',time:'2026-10-06T08:15:00.000Z',files:['hello.py','index.html']}
  ]
});

export class GitLearningRepo{
  constructor(os){this.os=os;this.storageKey='desktopsim-v2-git-'+os;this.data=this.restore()}
  restore(){try{const stored=JSON.parse(localStorage.getItem(this.storageKey));if(stored?.branches&&Array.isArray(stored.commits)&&stored.currentBranch)return stored}catch{}return initialState()}
  persist(){try{localStorage.setItem(this.storageKey,JSON.stringify(this.data))}catch{}}
  reset(){this.data=initialState();this.persist()}
  branchNames(){return Object.keys(this.data.branches).sort((a,b)=>a===this.data.currentBranch?-1:b===this.data.currentBranch?1:a.localeCompare(b))}
  headId(branch=this.data.currentBranch){return this.data.branches[branch]}
  head(branch=this.data.currentBranch){return this.data.commits.find(commit=>commit.id===this.headId(branch))||null}
  files(fs,cwd){return fs.list(cwd).filter(entry=>entry.type==='file').map(entry=>entry.name)}
  stage(names,fs,cwd){
    const available=this.files(fs,cwd),wanted=names.includes('.')?available:names;
    if(!wanted.length)throw Error('Bitte mindestens eine Datei angeben.');
    const missing=wanted.filter(name=>!available.includes(name));if(missing.length)throw Error('Datei nicht gefunden: '+missing[0]);
    this.data.staged=[...new Set([...this.data.staged,...wanted])].sort();this.persist();return wanted.length;
  }
  unstage(name){this.data.staged=this.data.staged.filter(file=>file!==name);this.persist()}
  commit(message){
    const text=String(message??'').trim();if(!text)throw Error('Bitte eine Commit-Nachricht angeben.');
    if(!this.data.staged.length)throw Error('Keine Änderungen in der Staging-Area. Nutze zuerst git add <datei>.');
    const id=(Date.now().toString(36)+(this.data.sequence++).toString(36)).slice(-7).padStart(7,'0');
    const commit={id,parent:this.headId(),branch:this.data.currentBranch,message:text.slice(0,110),author:'Student <student@desktopsim.local>',time:new Date().toISOString(),files:[...this.data.staged]};
    this.data.commits.push(commit);this.data.branches[this.data.currentBranch]=id;this.data.staged=[];this.persist();return commit;
  }
  createBranch(name){
    const branch=String(name??'').trim();if(!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch)||branch.endsWith('/'))throw Error('Ungültiger Branchname.');
    if(this.data.branches[branch])throw Error('Branch existiert bereits: '+branch);
    this.data.branches[branch]=this.headId();this.persist();return branch;
  }
  switchBranch(name){if(!this.data.branches[name])throw Error('Branch nicht gefunden: '+name);this.data.currentBranch=name;this.persist();return name}
  log(branch=this.data.currentBranch){
    const commits=[];let current=this.head(branch),seen=new Set();
    while(current&&!seen.has(current.id)){commits.push(current);seen.add(current.id);current=current.parent?this.data.commits.find(commit=>commit.id===current.parent):null}
    return commits;
  }
  graph(){return [...this.data.commits].reverse().map(commit=>({...commit,refs:this.branchNames().filter(branch=>this.data.branches[branch]===commit.id)}))}
  status(){return{branch:this.data.currentBranch,staged:[...this.data.staged],head:this.head()}}
}
