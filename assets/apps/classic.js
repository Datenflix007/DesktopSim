// Bestehende DesktopSim-Apps (Git Graph, Fun Lab, OS-Spiele, Struktogramm) und Code-Hilfen.
import {isWindows,homePath,joinPath} from '../vfs.js';
const $ = (s,root=document)=>root.querySelector(s);
export const escapeHTML = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const svg=(name,size=22)=>{
  const paths={
    terminal:'<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="m6 9 4 3-4 3m7 0h5"/>',
    folder:'<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    file:'<path d="M6 2h8l5 5v14a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v6h5M8 12h8M8 16h8"/>',
    code:'<rect x="2.5" y="3" width="19" height="18" rx="3"/><path d="m9 9-3 3 3 3m6-6 3 3-3 3m-2-7-2 8"/>',
    browser:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 0 0 18M12 3a15 15 0 0 1 0 18"/>',
    database:'<ellipse cx="12" cy="5.5" rx="9" ry="3.5"/><path d="M3 5.5v13c0 2 4 3.5 9 3.5s9-1.5 9-3.5v-13M3 12c0 2 4 3.5 9 3.5s9-1.5 9-3.5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4m0-4h.01"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M4 12a8 8 0 0 1 16 0 8 8 0 0 1-16 0Z"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    windows:'<path d="M3 5 11 4v8H3zm10-1 8-1v9h-8zM3 14h8v7l-8-1zm10 0h8v8l-8-1z"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M4 19h16"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    home:'<path d="m3 11 9-8 9 8v9H3v-9Zm6 9v-7h6v7"/>',
    play:'<path d="m8 5 12 7-12 7Z"/>',
    save:'<path d="M4 3h14l3 3v15H3V3Zm3 0v7h10V3M7 21v-8h10v8"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/>',
    arrow:'<path d="m15 18-6-6 6-6"/>',
    server:'<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h7M11 17h7"/>'
    ,structure:'<path d="M4 3h16v18H4zM4 9h16M4 15h16M12 9v6"/><path d="m7 12 2 1.5L7 15m10-3-2 1.5 2 1.5"/>'
    ,game:'<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M8 12h4m-2-2v4m6-1h.01m2-2h.01M9 3v3m6-3v3"/>'
    ,branch:'<circle cx="6" cy="5" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="6" cy="19" r="2.5"/><path d="M6 7.5v9m2.5-10C10 8 12 8 15.5 8M8.5 18.5c4 0 7.5-1 7.5-7.5"/>'
    ,sparkle:'<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Zm7 12 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15ZM5 16l.6 1.7L7.3 18l-1.7.6L5 20.3l-.6-1.7L2.7 18l1.7-.3L5 16Z"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.file}</svg>`;
};
export const IDE_LANGUAGES={py:'Python',js:'JavaScript',mjs:'JavaScript',html:'HTML',htm:'HTML',css:'CSS',java:'Java',cpp:'C++',c:'C',cs:'C#',php:'PHP',sql:'SQL',json:'JSON',md:'Markdown',txt:'Plain Text'};
const IDE_KEYWORDS={
  py:['and','as','break','class','def','elif','else','False','for','from','if','import','in','None','not','or','print','range','return','True','while'],
  js:['async','await','break','class','const','else','export','false','for','from','function','if','import','let','new','null','return','true','while','console'],
  mjs:['async','await','break','class','const','else','export','false','for','from','function','if','import','let','new','null','return','true','while','console'],
  java:['class','else','false','for','if','import','int','new','null','package','private','public','return','static','String','System','true','void','while'],
  cpp:['auto','bool','char','class','const','double','else','false','float','for','if','include','int','namespace','public','return','std','string','true','using','void','while'],
  c:['char','const','double','else','float','for','if','include','int','long','return','short','sizeof','struct','void','while'],
  cs:['bool','class','Console','else','false','for','if','int','namespace','new','null','public','return','static','string','true','using','void','while'],
  php:['class','echo','else','false','for','function','if','new','null','public','return','true','while'],
  sql:['AS','BY','CREATE','DELETE','DESC','DROP','FROM','GROUP','INSERT','INTO','JOIN','LIMIT','ORDER','SELECT','SET','TABLE','UPDATE','VALUES','WHERE']
};
export const ideSyntaxHTML=(source,extension)=>{
  const text=String(source??''),words=IDE_KEYWORDS[extension]||[];
  if(!words.length)return escapeHTML(text);
  const pattern=new RegExp(`("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')|(//[^\\n]*|#[^\\n]*)|(\\b(?:${words.join('|')})\\b)|(\\b\\d+(?:\\.\\d+)?\\b)`,'g');
  let result='',offset=0,match;
  while((match=pattern.exec(text))){result+=escapeHTML(text.slice(offset,match.index));const cls=match[1]?'token-string':match[2]?'token-comment':match[3]?'token-keyword':'token-number';result+=`<span class="${cls}">${escapeHTML(match[0])}</span>`;offset=pattern.lastIndex}
  return result+escapeHTML(text.slice(offset));
};

const STRUCT_LANGUAGES={python:{label:'Python',extension:'py',brace:false},javascript:{label:'JavaScript',extension:'js',brace:true},java:{label:'Java',extension:'java',brace:true},cs:{label:'C#',extension:'cs',brace:true},cpp:{label:'C++',extension:'cpp',brace:true}};
let structNodeSerial=0;
const structNode=(type,props={})=>({id:`struct-${++structNodeSerial}`,type,children:[],...props});
const structBranch=(label,condition='')=>({label,condition,children:[]});
const structIndent=line=>{const match=String(line).match(/^[\t ]*/)?.[0]||'';return [...match].reduce((sum,char)=>sum+(char==='\t'?2:1),0)};
const stripStructComment=(line,language)=>{
  const python=language==='python';let result='',quote='',escaped=false;
  for(let index=0;index<String(line).length;index++){
    const char=line[index],next=line[index+1];
    if(quote){result+=char;if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue}
    if(char==='"'||char==="'"){quote=char;result+=char;continue}
    if((python&&char==='#')||(!python&&char==='/'&&next==='/'))break;
    result+=char;
  }
  return result.trim();
};
const structClassInfo=(header,language)=>{
  const text=header.trim().replace(/[:{]\s*$/,'').trim();
  if(language==='python'){
    const match=text.match(/^class\s+([A-Za-z_]\w*)(?:\s*\(([^)]*)\))?$/);if(!match)return null;
    return {name:match[1],bases:(match[2]||'').split(',').map(value=>value.trim()).filter(Boolean)};
  }
  const match=text.match(/(?:^|\s)class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$.]*))?(?:\s*:\s*([\w$.,\s]+))?(?:\s+implements\s+([\w$.,\s]+))?/);
  if(!match)return null;
  return {name:match[1],bases:[match[2],match[3],match[4]].filter(Boolean).flatMap(value=>value.split(',')).map(value=>value.trim()).filter(Boolean)};
};
const structFunctionInfo=(header,language)=>{
  const text=header.trim().replace(/[:{]\s*$/,'').trim();
  if(language==='python'){
    const match=text.match(/^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?$/);if(!match)return null;
    return {name:match[1],params:match[2],signature:`${text.replace(/^async\s+/,'')}`};
  }
  let match=text.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/);if(match)return {name:match[1],params:match[2],signature:text};
  match=text.match(/^(?:(?:public|private|protected|internal|static|async|final|virtual|override|abstract|sealed|export|default|inline|constexpr)\s+)*(?:(?:[A-Za-z_$][\w$<>\[\],.?]*|void|int|double|float|boolean|bool|string|String)\s+)?([A-Za-z_$~][\w$]*)\s*\(([^)]*)\)\s*(?:const)?\s*(?:=>)?$/);
  if(!match||/^(if|for|while|switch|catch)$/i.test(match[1]))return null;
  return {name:match[1],params:match[2],signature:text};
};
const structHeaderNode=(header,language)=>{
  const text=header.trim().replace(/[:{]\s*$/,'').trim(),classInfo=structClassInfo(text,language);
  if(classInfo)return structNode('class',{name:classInfo.name,bases:classInfo.bases});
  const isPython=language==='python';
  const matchFor=(pattern)=>text.match(pattern)?.[1]?.trim()||'';
  if(isPython){
    if(/^if\s+/.test(text))return structNode('if',{condition:matchFor(/^if\s+(.+)$/),branches:[structBranch('Ja',matchFor(/^if\s+(.+)$/))]});
    if(/^for\s+/.test(text))return structNode('loop',{loopKind:'for',condition:matchFor(/^for\s+(.+)$/)});
    if(/^while\s+/.test(text))return structNode('loop',{loopKind:'while',condition:matchFor(/^while\s+(.+)$/)});
    if(/^with\s+/.test(text))return structNode('block',{blockKind:'with',condition:matchFor(/^with\s+(.+)$/)});
    if(/^try$/.test(text))return structNode('try',{branches:[structBranch('Versuch')]});
    if(/^match\s+/.test(text))return structNode('switch',{condition:matchFor(/^match\s+(.+)$/),branches:[]});
    const functionInfo=structFunctionInfo(text,language);if(functionInfo)return structNode('function',functionInfo);
    return null;
  }
  if(/^if\s*\(/.test(text))return structNode('if',{condition:matchFor(/^if\s*\((.*)\)$/),branches:[structBranch('Ja',matchFor(/^if\s*\((.*)\)$/))]});
  if(/^for\s*\(/.test(text))return structNode('loop',{loopKind:'for',condition:matchFor(/^for\s*\((.*)\)$/)});
  if(/^while\s*\(/.test(text))return structNode('loop',{loopKind:'while',condition:matchFor(/^while\s*\((.*)\)$/)});
  if(/^do$/.test(text))return structNode('loop',{loopKind:'do',condition:'mindestens einmal'});
  if(/^switch\s*\(/.test(text))return structNode('switch',{condition:matchFor(/^switch\s*\((.*)\)$/),branches:[]});
  if(/^try$/.test(text))return structNode('try',{branches:[structBranch('Versuch')]});
  const functionInfo=structFunctionInfo(text,language);if(functionInfo)return structNode('function',functionInfo);
  return null;
};
const structPrimaryChildren=node=>node.type==='if'||node.type==='try'?node.branches[0].children:node.children;
const structIsElseHeader=(line,language)=>language==='python'?/^(elif\s+.+|else)\s*:?$/.test(line):/^else(?:\s+if\s*\(.*\))?$/.test(line);
const structElseBranch=(line,language)=>{
  const text=line.trim().replace(/[:{]\s*$/,'').trim();
  if(language==='python'&&/^elif\s+/.test(text)){const condition=text.replace(/^elif\s+/,'').trim();return structBranch(`Sonst wenn: ${condition}`,condition)}
  const braceMatch=text.match(/^else\s+if\s*\((.*)\)$/);if(braceMatch)return structBranch(`Sonst wenn: ${braceMatch[1].trim()}`,braceMatch[1].trim());
  return structBranch('Nein');
};
const structCatchBranch=(line,language)=>{
  const text=line.trim().replace(/[:{]\s*$/,'').trim();
  if(/^(finally|final)$/.test(text))return structBranch('Immer ausführen');
  return structBranch(text.replace(/^(except|catch)\s*/,'')||'Fehlerfall');
};
const structBraceTokens=source=>{
  const tokens=[],push=()=>{const value=buffer.trim();if(value)tokens.push(value);buffer='';};let buffer='',quote='',escaped=false,lineComment=false,blockComment=false;
  for(let index=0;index<String(source).length;index++){
    const char=source[index],next=source[index+1];
    if(lineComment){if(char==='\n'){lineComment=false;push()}continue}
    if(blockComment){if(char==='*'&&next==='/'){blockComment=false;index++}continue}
    if(quote){buffer+=char;if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue}
    if(char==='"'||char==="'"||char==='`'){quote=char;buffer+=char;continue}
    if(char==='/'&&next==='/'){lineComment=true;continue}
    if(char==='/'&&next==='*'){blockComment=true;index++;continue}
    if(char==='{'||char==='}'){push();tokens.push(char);continue}
    if(char==='\n'){push();continue}
    buffer+=char;
  }
  push();return tokens;
};
const parsePythonStructure=(source,language='python')=>{
  const root=[],stack=[{indent:-1,children:root}];
  for(const rawLine of String(source).replace(/\r/g,'').split('\n')){
    const line=stripStructComment(rawLine,language);if(!line)continue;const indent=structIndent(rawLine);
    while(stack.length>1&&stack.at(-1).indent>=indent)stack.pop();
    const children=stack.at(-1).children;
    if(structIsElseHeader(line,language)){
      const previous=children.at(-1);if(previous?.type==='if'){
        const branch=structElseBranch(line,language);previous.branches.push(branch);stack.push({indent,children:branch.children});continue;
      }
    }
    if(/^(except\b.*|finally)\s*:?$/.test(line)){
      const previous=children.at(-1);if(previous?.type==='try'){
        const branch=structCatchBranch(line,language);previous.branches.push(branch);stack.push({indent,children:branch.children});continue;
      }
    }
    if(/^case\s+.+\s*:?$/.test(line)){
      const previous=children.at(-1);if(previous?.type==='switch'){
        const branch=structBranch(line.replace(/^case\s+|:\s*$/g,''));previous.branches.push(branch);stack.push({indent,children:branch.children});continue;
      }
    }
    const header=line.endsWith(':')?structHeaderNode(line,language):null;
    const node=header||structNode('statement',{text:line});children.push(node);
    if(header)stack.push({indent,children:structPrimaryChildren(node)});
  }
  return root;
};
const parseBraceStructure=(source,language)=>{
  const root=[],stack=[{node:null,children:root}],tokens=structBraceTokens(source);let pending=null,lastClosed=null;
  for(let index=0;index<tokens.length;index++){
    const token=tokens[index];
    if(token==='{'){if(pending){stack.push({node:pending.node,children:pending.children});pending=null;lastClosed=null}else stack.push({node:null,children:stack.at(-1).children});continue}
    if(token==='}'){if(stack.length>1)lastClosed=stack.pop().node;pending=null;continue}
    const line=token.trim();if(!line)continue;
    if(structIsElseHeader(line,language)&&lastClosed?.type==='if'){
      const branch=structElseBranch(line,language);lastClosed.branches.push(branch);pending={node:lastClosed,children:branch.children};lastClosed=null;continue;
    }
    if(/^(catch\b.*|finally)\s*$/.test(line)&&lastClosed?.type==='try'){
      const branch=structCatchBranch(line,language);lastClosed.branches.push(branch);pending={node:lastClosed,children:branch.children};lastClosed=null;continue;
    }
    const switchNode=[...stack].reverse().find(entry=>entry.node?.type==='switch')?.node;
    if(/^(case\s+.+:|default:)\s*$/.test(line)&&switchNode){
      const branch=structBranch(line.replace(/^(case\s+|default\s*:?)/,'').replace(/:$/,'').trim()||'Standard');switchNode.branches.push(branch);stack.at(-1).children=branch.children;continue;
    }
    const next=tokens[index+1],header=next==='{'?structHeaderNode(line,language):null;
    if(header){stack.at(-1).children.push(header);pending={node:header,children:structPrimaryChildren(header)};lastClosed=null;continue}
    stack.at(-1).children.push(structNode('statement',{text:line.replace(/;\s*$/,'').trim()}));lastClosed=null;
  }
  return root;
};
const parseStructuredCode=(source,language)=>language==='python'?parsePythonStructure(source,language):parseBraceStructure(source,language);
const structFindNode=(nodes,id)=>{
  for(const node of nodes){if(node.id===id)return node;const found=structFindNode(node.children||[],id)||((node.branches||[]).map(branch=>structFindNode(branch.children,id)).find(Boolean));if(found)return found}
  return null;
};
const removeStructNode=(nodes,id)=>{
  const index=nodes.findIndex(node=>node.id===id);if(index>=0){nodes.splice(index,1);return true}
  return nodes.some(node=>removeStructNode(node.children||[],id)||(node.branches||[]).some(branch=>removeStructNode(branch.children,id)));
};
const structCountNodes=nodes=>nodes.reduce((count,node)=>count+1+structCountNodes(node.children||[])+(node.branches||[]).reduce((sum,branch)=>sum+structCountNodes(branch.children),0),0);
const structIndentCode=(code,level)=>String(code||'').split('\n').map(line=>`${'  '.repeat(level)}${line}`).join('\n');
const structCleanStatement=(text,language)=>{const value=String(text||'').trim();if(!value)return language==='python'?'pass':';';return language!=='python'&&!/[;{}]$/.test(value)?`${value};`:value};
const structCodeFromNodes=(nodes,language,level=0)=>nodes.map(node=>{
  const body=structCodeFromNodes(node.children||[],language,level+1)||structIndentCode(structCleanStatement('',language),level+1),py=language==='python';
  if(node.type==='statement')return structIndentCode(structCleanStatement(node.text,language),level);
  if(node.type==='class'){const bases=(node.bases||[]).filter(Boolean);const head=py?`class ${node.name||'NeueKlasse'}${bases.length?`(${bases.join(', ')})`:''}`:`class ${node.name||'NeueKlasse'}${bases[0]?` extends ${bases[0]}`:''}`;return py?`${structIndentCode(head+':',level)}\n${body}`:`${structIndentCode(head+' {',level)}\n${body}\n${structIndentCode('}',level)}`}
  if(node.type==='function'){const signature=py?`def ${node.name||'funktion'}(${node.params||''}):`:(node.signature||`${node.name||'funktion'}(${node.params||''})`)+' {';return py?`${structIndentCode(signature,level)}\n${body}`:`${structIndentCode(signature,level)}\n${body}\n${structIndentCode('}',level)}`}
  if(node.type==='if'){
    return (node.branches||[]).map((branch,index)=>{const branchBody=structCodeFromNodes(branch.children,language,level+1)||structIndentCode(structCleanStatement('',language),level+1);if(py){const head=index===0?`if ${node.condition||'Bedingung'}:`:branch.condition?`elif ${branch.condition}:`:'else:';return `${structIndentCode(head,level)}\n${branchBody}`}const head=index===0?`if (${node.condition||'condition'}) {`:branch.condition?`else if (${branch.condition}) {`:'else {';return `${structIndentCode(head,level)}\n${branchBody}\n${structIndentCode('}',level)}`}).join(py?'\n':' else ');
  }
  if(node.type==='loop'){const head=py?`${node.loopKind==='for'?'for':'while'} ${node.condition||'Bedingung'}:`:`${node.loopKind==='do'?'do':node.loopKind||'while'} (${node.condition||'condition'}) {`;return py?`${structIndentCode(head,level)}\n${body}`:`${structIndentCode(head,level)}\n${body}\n${structIndentCode('}',level)}`}
  if(node.type==='switch'){const branches=node.branches||[];if(py)return branches.map(branch=>`${structIndentCode(`if ${node.condition||'wert'} == ${branch.condition||'wert'}:`,level)}\n${structCodeFromNodes(branch.children,language,level+1)||structIndentCode('pass',level+1)}`).join('\n');return `${structIndentCode(`switch (${node.condition||'wert'}) {`,level)}\n${branches.map(branch=>`${structIndentCode(`case ${branch.condition||'wert'}:`,level+1)}\n${structCodeFromNodes(branch.children,language,level+2)||structIndentCode(';',level+2)}\n${structIndentCode('break;',level+2)}`).join('\n')}\n${structIndentCode('}',level)}`}
  return `${structIndentCode(`${node.blockKind||'try'}${py?':':' {'}`,level)}\n${body}${py?'':`\n${structIndentCode('}',level)}`}`;
}).join('\n');
const structLabel=node=>{
  if(node.type==='statement')return node.text||'Anweisung';if(node.type==='class')return `Klasse ${node.name||'NeueKlasse'}`;if(node.type==='function')return `Methode ${node.name||'funktion'}(${node.params||''})`;if(node.type==='if')return `Wenn ${node.condition||'Bedingung'}`;if(node.type==='loop')return `${node.loopKind==='for'?'Für':'Solange'} ${node.condition||'Bedingung'}`;if(node.type==='switch')return `Auswahl: ${node.condition||'Wert'}`;return `${node.blockKind||node.type}: ${node.condition||''}`.trim();
};
const structClasses=nodes=>nodes.flatMap(node=>[...(node.type==='class'?[node]:[]),...structClasses(node.children||[]),...(node.branches||[]).flatMap(branch=>structClasses(branch.children))]);
const structClassFields=node=>(node.children||[]).filter(child=>child.type==='statement'&&child.text&&!/^(return|throw|break|continue)\b/.test(child.text)).map(child=>child.text);
const structTextForNode=node=>[node.text,node.signature,node.condition,node.params,...(node.children||[]).flatMap(structTextForNode),...(node.branches||[]).flatMap(branch=>branch.children.flatMap(structTextForNode))].filter(Boolean).join(' ');
const structDependencies=(node,classes)=>{
  const text=structTextForNode(node),known=classes.map(item=>item.name).filter(name=>name&&name!==node.name);return known.filter(name=>new RegExp(`\\b(?:new\\s+)?${name}\\b`).test(text));
};
export {parseStructuredCode,structClasses,structCodeFromNodes,structCountNodes};

export class ClassicApps{
  openGitGraph(){
    const projectRoot=joinPath(homePath(this.currentOS),'Projects');const w=this.makeWindow('git','Git Graph · Projects','branch',{width:980,height:630});const state={selected:this.git.headId(),notice:'Lokale Git-Lernsimulation · keine echten Remotes oder Systemprozesse.'};
    w.content.className='window-content git-content';
    const render=()=>{
      const status=this.git.status(),files=this.git.files(this.fs,projectRoot),graph=this.git.graph(),selected=graph.find(commit=>commit.id===state.selected)||status.head;
      w.content.innerHTML=`<div class="git-toolbar"><div>${svg('branch',18)} <strong>Git Graph</strong><span>~/Projects</span></div><div><button type="button" data-git-action="terminal">Terminal</button><button type="button" data-git-action="refresh">↻ Aktualisieren</button></div></div><div class="git-layout"><aside class="git-sidebar"><section><div class="git-section-title">REPOSITORY</div><div class="git-branch-current">${svg('branch',16)} <strong>${escapeHTML(status.branch)}</strong></div><label class="git-label" for="git-branch-select">Branch wechseln</label><select id="git-branch-select" class="git-branch-select">${this.git.branchNames().map(branch=>`<option value="${escapeHTML(branch)}" ${branch===status.branch?'selected':''}>${escapeHTML(branch)}</option>`).join('')}</select><div class="git-new-branch"><input class="git-new-branch-input" aria-label="Neuen Branch anlegen" placeholder="feature/mein-branch"><button type="button" data-git-action="branch">+</button></div></section><section class="git-changes"><div class="git-section-title">STAGING AREA <span>${status.staged.length}</span></div><button type="button" class="git-stage-all" data-git-action="stage-all">+ Alle Dateien stagen</button><div class="git-file-list">${files.map(file=>`<button type="button" class="git-file ${status.staged.includes(file)?'staged':''}" data-git-file="${escapeHTML(file)}"><span>${status.staged.includes(file)?'✓':'+'}</span>${svg('file',14)} ${escapeHTML(file)}</button>`).join('')}</div></section><p class="git-simulation-note">Änderungen werden getrennt je simuliertem Betriebssystem im Browser gespeichert.</p></aside><main class="git-main"><section class="git-graph-panel"><header><div><span class="git-eyebrow">COMMIT-HISTORIE</span><h2>${escapeHTML(status.branch)}</h2></div><span class="git-head-label">HEAD → ${escapeHTML(status.branch)}</span></header><div class="git-graph-list">${graph.map((commit,index)=>`<button type="button" class="git-graph-row branch-${commit.branch.startsWith('feature/')?'feature':'main'} ${commit.id===state.selected?'selected':''}" data-git-commit="${commit.id}"><span class="git-graph-track"><i></i>${index<graph.length-1?'<b></b>':''}</span><span class="git-commit-summary"><strong>${escapeHTML(commit.message)}</strong><small><code>${commit.id}</code> · ${escapeHTML(commit.author.split(' ')[0])} · ${new Date(commit.time).toLocaleDateString('de-DE',{day:'2-digit',month:'short'})}</small></span><span class="git-refs">${commit.refs.map(ref=>`<em class="${ref===status.branch?'head':''}">${escapeHTML(ref)}</em>`).join('')}</span></button>`).join('')}</div></section><section class="git-commit-panel"><div class="git-detail"><span class="git-eyebrow">AUSGEWÄHLTER COMMIT</span><strong>${escapeHTML(selected?.message||'Kein Commit')}</strong><small><code>${escapeHTML(selected?.id||'')}</code> · ${escapeHTML(selected?.author||'')}</small><p>${selected?.files?.length?selected.files.map(file=>`<code>${escapeHTML(file)}</code>`).join(' '):'Keine Dateien'}</p></div><div class="git-commit-form"><label for="git-commit-message">Commit-Nachricht</label><textarea id="git-commit-message" placeholder="z. B. Begrüßung verbessern" ${status.staged.length?'':'disabled'}></textarea><button type="button" data-git-action="commit" ${status.staged.length?'':'disabled'}>${svg('save',15)} ${status.staged.length?`${status.staged.length} Datei(en) committen`:'Zuerst Dateien stagen'}</button></div></section><p class="git-flash" role="status">${escapeHTML(state.notice)}</p></main></div>`;
      w.content.querySelectorAll('[data-git-file]').forEach(button=>button.addEventListener('click',()=>{const file=button.dataset.gitFile;try{if(this.git.status().staged.includes(file))this.git.unstage(file);else this.git.stage([file],this.fs,projectRoot);state.notice=`${file} ${this.git.status().staged.includes(file)?'zur Staging-Area hinzugefügt':'aus der Staging-Area entfernt'}.`;render()}catch(error){state.notice='Fehler: '+error.message;render()}}));
      w.content.querySelectorAll('[data-git-commit]').forEach(button=>button.addEventListener('click',()=>{state.selected=button.dataset.gitCommit;render()}));
      $('.git-branch-select',w.content).addEventListener('change',event=>{try{this.git.switchBranch(event.target.value);state.selected=this.git.headId();state.notice='Zu Branch '+event.target.value+' gewechselt.';render()}catch(error){state.notice='Fehler: '+error.message;render()}});
      w.content.querySelectorAll('[data-git-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.gitAction;try{if(action==='terminal')return this.openTerminal();if(action==='refresh'){state.notice='Ansicht aktualisiert.';return render()}if(action==='stage-all'){this.git.stage(['.'],this.fs,projectRoot);state.notice='Alle Projektdateien befinden sich in der Staging-Area.'}if(action==='branch'){const input=$('.git-new-branch-input',w.content),branch=this.git.createBranch(input.value);this.git.switchBranch(branch);state.selected=this.git.headId();state.notice='Branch '+branch+' angelegt und ausgecheckt.'}if(action==='commit'){const message=$('#git-commit-message',w.content).value,commit=this.git.commit(message);state.selected=commit.id;state.notice='Commit '+commit.id+' erstellt.'}render()}catch(error){state.notice='Fehler: '+error.message;render()}}));
    };
    render();return w;
  }
  startMatrix(){
    if(this.matrixLayer)return;
    const glyphs='01アイウエオカキクケコサシスセソ<>[]{}*+-/';const columns=Math.min(48,Math.max(16,Math.floor(this.desktop.clientWidth/27)));
    const stream=()=>Array.from({length:18+Math.floor(Math.random()*18)},()=>glyphs[Math.floor(Math.random()*glyphs.length)]).join('\n');
    const layer=document.createElement('section');layer.className='matrix-overlay';layer.setAttribute('role','dialog');layer.setAttribute('aria-label','Matrix-Bildschirmschoner');
    layer.innerHTML=`<div class="matrix-streams">${Array.from({length:columns},(_,index)=>`<span class="matrix-stream" style="--left:${(index/(columns-1))*100}%;--delay:-${(Math.random()*7).toFixed(2)}s;--duration:${(5+Math.random()*5).toFixed(2)}s;--size:${10+Math.floor(Math.random()*6)}px">${stream()}</span>`).join('')}</div><div class="matrix-hud"><strong>DESKTOPSIM // MATRIX MODE</strong><button type="button" data-matrix-close>ESC · Beenden</button></div>`;
    layer.querySelector('[data-matrix-close]').addEventListener('click',()=>this.stopMatrix());this.desktop.append(layer);this.matrixLayer=layer;layer.querySelector('[data-matrix-close]').focus();
  }
  stopMatrix(){if(!this.matrixLayer)return;this.matrixLayer.remove();this.matrixLayer=null;}
  launchConfetti(){
    this.stopConfetti();const colors=['#ffd166','#ff6b8f','#64d6ff','#82eab6','#b993ff','#ff9d4a'],layer=document.createElement('div');layer.className='confetti-layer';layer.setAttribute('aria-hidden','true');
    layer.innerHTML=Array.from({length:96},(_,index)=>`<i class="confetti-piece" style="--left:${Math.random()*100}%;--drift:${Math.floor(Math.random()*180-90)}px;--delay:${(Math.random()*0.9).toFixed(2)}s;--duration:${(2.8+Math.random()*2).toFixed(2)}s;--turn:${Math.floor(Math.random()*720-360)}deg;--color:${colors[index%colors.length]}"></i>`).join('');this.desktop.append(layer);this.partyLayer=layer;this.partyTimer=setTimeout(()=>this.stopConfetti(),5600);
  }
  stopConfetti(){clearTimeout(this.partyTimer);this.partyTimer=null;if(this.partyLayer){this.partyLayer.remove();this.partyLayer=null;}}
  toggleByte(){
    if(this.bytePet){this.dismissByte();this.toast('Byte macht eine Pause.');return false}
    const pet=document.createElement('button');pet.type='button';pet.className='byte-pet';pet.setAttribute('aria-label','Byte, der Desktop-Begleiter');pet.innerHTML='<span class="byte-bubble"></span><span class="byte-ears"></span><span class="byte-face"><i></i><i></i><b></b></span><small>BYTE</small>';
    const phrases=['Hallo! Ich bin Byte.', 'Dein Code sieht gut aus.', 'Schon Ctrl+S gedrückt?', 'git status ist immer eine gute Idee.', 'Psst … Konami funktioniert auch hier.'];
    pet.addEventListener('click',()=>{const bubble=$('.byte-bubble',pet);bubble.textContent=phrases[Math.floor(Math.random()*phrases.length)];bubble.classList.add('visible');clearTimeout(this.byteTimer);this.byteTimer=setTimeout(()=>bubble.classList.remove('visible'),3200)});
    this.desktop.append(pet);this.bytePet=pet;setTimeout(()=>pet.click(),120);this.toast('Byte ist auf dem Desktop gelandet. Klicke ihn an!');return true;
  }
  dismissByte(){clearTimeout(this.byteTimer);if(this.bytePet){this.bytePet.remove();this.bytePet=null;}}
  openFunLab(){
    const w=this.makeWindow('fun','Fun Lab · DesktopSim','sparkle',{width:760,height:500});w.content.className='window-content fun-content';
    w.content.innerHTML=`<div class="fun-hero"><div>${svg('sparkle',38)}</div><span class="eyebrow">DESKTOPSIM / SPIELEREIEN</span><h2>Mach den Desktop ein bisschen magisch.</h2><p>Alle Effekte laufen nur im Browser, lassen sich jederzeit beenden und verändern keine Dateien.</p></div><div class="fun-cards"><article class="fun-card matrix-card"><span class="fun-card-icon">01</span><h3>Matrix-Modus</h3><p>Ein animierter Code-Regen als Vollbild-Bildschirmschoner. Mit <kbd>Esc</kbd> schließen.</p><button type="button" data-fun="matrix">Matrix starten</button></article><article class="fun-card party-card"><span class="fun-card-icon">02</span><h3>Konfetti</h3><p>Eine kleine Erfolgsexplosion für gelöste Aufgaben und fertige Commits.</p><button type="button" data-fun="party">Party starten</button></article><article class="fun-card byte-card"><span class="fun-card-icon">03</span><h3>Byte</h3><p>Ein kleiner Desktop-Begleiter mit Tipps. Klick ihn auf dem Desktop an.</p><button type="button" data-fun="byte">${this.bytePet?'Byte wegschicken':'Byte herholen'}</button></article></div><div class="fun-foot">Easter Egg: ↑ ↑ ↓ ↓ ← → ← → B A</div>`;
    w.content.querySelectorAll('[data-fun]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.fun==='matrix')this.startMatrix();if(button.dataset.fun==='party')this.launchConfetti();if(button.dataset.fun==='byte'){this.toggleByte();button.textContent=this.bytePet?'Byte wegschicken':'Byte herholen'}}));return w;
  }
  openGame(){
    if(this.currentOS==='winxp')return this.openSolitaire();
    if(isWindows(this.currentOS))return this.openMinesweeper();
    if(this.currentOS==='macos')return this.openMacGame();
    return this.openSnake();
  }
  openSolitaire(){
    const w=this.makeWindow('game','Solitaire · Windows XP','game',{width:820,height:570});
    const suits=['♠','♥','♦','♣'],names={1:'A',11:'J',12:'Q',13:'K'};
    const label=card=>`${names[card.rank]||card.rank}${card.suit}`;
    const color=card=>(card.suit==='♥'||card.suit==='♦')?'red':'black';
    const state={stock:[],waste:[],foundations:suits.map(()=>[]),tableau:[],selected:null,message:'Lege abwechselnd rote und schwarze Karten ab.'};
    const fresh=()=>{
      let deck=suits.flatMap(suit=>Array.from({length:13},(_,i)=>({suit,rank:i+1,up:false})));for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
      state.tableau=[];let cursor=0;for(let col=0;col<7;col++){state.tableau.push(deck.slice(cursor,cursor+col+1).map((card,i)=>({...card,up:i===col})));cursor+=col+1}state.stock=deck.slice(cursor);state.waste=[];state.foundations=suits.map(()=>[]);state.selected=null;state.message='Neue Runde: Beginne mit den sichtbaren Karten.';
    };
    const sourceCards=()=>{if(!state.selected)return[];const s=state.selected;if(s.area==='waste')return state.waste.length?[state.waste.at(-1)]:[];return state.tableau[s.col].slice(s.index)};
    const clearSource=()=>{const s=state.selected;if(s.area==='waste')state.waste.pop();else{state.tableau[s.col].splice(s.index);const top=state.tableau[s.col].at(-1);if(top&&!top.up)top.up=true;}state.selected=null;};
    const selectTableau=(col,index)=>{const card=state.tableau[col][index];if(!card.up){if(index===state.tableau[col].length-1){card.up=true;state.message='Karte aufgedeckt.'}return;}if(state.selected){if(state.selected.area==='tableau'&&state.selected.col===col&&state.selected.index===index){state.selected=null;state.message='Auswahl aufgehoben.'}else moveTableau(col);return;}state.selected={area:'tableau',col,index};state.message=`${label(card)} ausgewählt.`;};
    const moveTableau=col=>{const moving=sourceCards(),target=state.tableau[col].at(-1);if(!moving.length)return;if(state.selected.area==='tableau'&&state.selected.col===col)return;if((target&&(!target.up||color(target)===color(moving[0])||target.rank!==moving[0].rank+1))||(!target&&moving[0].rank!==13)){state.message='Dort passen nur abwechselnde Farben in absteigender Reihenfolge – auf leer nur ein König.';return;}clearSource();state.tableau[col].push(...moving);state.message='Karten verschoben.';render();};
    const moveFoundation=index=>{const moving=sourceCards(),target=state.foundations[index];if(moving.length!==1)return;if(moving[0].suit!==suits[index]||moving[0].rank!==target.length+1){state.message='Im Fundament wird jede Farbe von Ass bis König aufgebaut.';render();return;}const card=moving[0];clearSource();target.push(card);state.message=`${label(card)} liegt im Fundament.`;if(state.foundations.every(stack=>stack.length===13))state.message='Gewonnen! Alle Karten sind sortiert.';render();};
    const draw=()=>{if(!state.stock.length){if(!state.waste.length){state.message='Keine Karten mehr im Stapel.';render();return;}state.stock=state.waste.reverse().map(card=>({...card,up:false}));state.waste=[];state.message='Ablagestapel zurückgedreht.';render();return;}const card=state.stock.pop();card.up=true;state.waste.push(card);state.selected=null;state.message=`${label(card)} liegt auf dem Ablagestapel.`;render();};
    w.content.className='window-content game-content solitaire-game';
    const render=()=>{
      const cardButton=(card,attrs='')=>`<button type="button" class="sol-card ${card.up?'':'sol-down'} ${card.up?color(card):''}" ${attrs}>${card.up?label(card):'✦'}</button>`;
      w.content.innerHTML=`<div class="game-bar xp-game-bar"><div><strong>Solitaire</strong><span>Windows XP · Klondike</span></div><button data-game-new>Neue Runde</button></div><div class="solitaire-board"><div class="sol-top"><button class="sol-stock ${state.stock.length?'':'empty'}" data-sol-stock aria-label="Karte vom Stapel ziehen">${state.stock.length?'✦':'↻'}</button><div class="sol-waste">${state.waste.length?cardButton(state.waste.at(-1),'data-sol-waste'):'<span> </span>'}</div><div class="sol-spacer"></div>${suits.map((suit,index)=>`<button class="sol-foundation" data-sol-foundation="${index}" aria-label="Fundament ${suit}">${state.foundations[index].length?label(state.foundations[index].at(-1)):suit}</button>`).join('')}</div><div class="sol-tableau">${state.tableau.map((stack,col)=>`<div class="sol-column" style="height:${Math.max(176,stack.length*28+62)}px">${stack.map((card,index)=>cardButton(card,`data-sol-card="${col}:${index}" style="top:${index*27}px"`)).join('')}<button class="sol-target" data-sol-target="${col}" style="top:${stack.length*27+4}px" aria-label="Karten auf Stapel ${col+1} legen"></button></div>`).join('')}</div></div><div class="game-message">${escapeHTML(state.message)}</div>`;
      $('[data-game-new]',w.content).addEventListener('click',()=>{fresh();render()});$('[data-sol-stock]',w.content).addEventListener('click',draw);w.content.querySelectorAll('[data-sol-waste]').forEach(button=>button.addEventListener('click',()=>{state.selected=state.selected?null:{area:'waste'};state.message=state.selected?'Ablagekarte ausgewählt.':'Auswahl aufgehoben.';render()}));w.content.querySelectorAll('[data-sol-card]').forEach(button=>button.addEventListener('click',()=>{const [col,index]=button.dataset.solCard.split(':').map(Number);selectTableau(col,index);render()}));w.content.querySelectorAll('[data-sol-target]').forEach(button=>button.addEventListener('click',()=>moveTableau(+button.dataset.solTarget)));w.content.querySelectorAll('[data-sol-foundation]').forEach(button=>button.addEventListener('click',()=>moveFoundation(+button.dataset.solFoundation)));
    };
    fresh();render();return w;
  }
  openMinesweeper(){
    const w=this.makeWindow('game',`Minesweeper · ${this.os.label}`,'game',{width:590,height:620});const size=9,mines=10;
    const state={cells:[],started:false,over:false,flags:0,message:'Klicke ein Feld. Mit rechter Maustaste markierst du eine Mine.'};
    const reset=()=>{state.cells=Array.from({length:size*size},()=>({mine:false,revealed:false,flag:false,count:0}));state.started=false;state.over=false;state.flags=0;state.message='Klicke ein Feld. Mit rechter Maustaste markierst du eine Mine.'};
    const neighbors=index=>{const x=index%size,y=Math.floor(index/size),out=[];for(let yy=Math.max(0,y-1);yy<=Math.min(size-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(size-1,x+1);xx++)if(xx!==x||yy!==y)out.push(yy*size+xx);return out;};
    const plant=first=>{const safe=new Set([first,...neighbors(first)]);let planted=0;while(planted<mines){const index=Math.floor(Math.random()*state.cells.length);if(safe.has(index)||state.cells[index].mine)continue;state.cells[index].mine=true;planted++;}state.cells.forEach((cell,index)=>cell.count=neighbors(index).filter(n=>state.cells[n].mine).length);state.started=true;};
    const finish=won=>{state.over=true;state.cells.forEach(cell=>{if(cell.mine)cell.revealed=true});state.message=won?'Gewonnen! Alle sicheren Felder sind aufgedeckt.':'Boom! Starte eine neue Runde.';};
    const reveal=index=>{const cell=state.cells[index];if(state.over||cell.flag||cell.revealed)return;if(!state.started)plant(index);const queue=[index];while(queue.length){const current=queue.pop(),item=state.cells[current];if(item.revealed||item.flag)continue;item.revealed=true;if(!item.mine&&item.count===0)neighbors(current).forEach(n=>{if(!state.cells[n].revealed&&!state.cells[n].mine)queue.push(n)});}if(cell.mine)finish(false);else if(state.cells.filter(cell=>!cell.mine).every(cell=>cell.revealed))finish(true);render();};
    const flag=index=>{const cell=state.cells[index];if(state.over||cell.revealed)return;cell.flag=!cell.flag;state.flags+=cell.flag?1:-1;render();};
    w.content.className='window-content game-content mines-game';
    const render=()=>{w.content.innerHTML=`<div class="game-bar mine-game-bar"><div><strong>Minesweeper</strong><span>${escapeHTML(this.os.label)} · 9 × 9</span></div><div class="mine-counter">💣 ${mines-state.flags}</div><button data-game-new>Neue Runde</button></div><div class="mine-board" role="grid">${state.cells.map((cell,index)=>`<button class="mine-cell ${cell.revealed?'revealed':''} ${cell.mine&&cell.revealed?'mine-hit':''}" data-mine-cell="${index}" aria-label="Feld ${index+1}">${cell.revealed?(cell.mine?'✹':cell.count||''):(cell.flag?'⚑':'')}</button>`).join('')}</div><div class="game-message">${escapeHTML(state.message)}</div>`;$('[data-game-new]',w.content).addEventListener('click',()=>{reset();render()});w.content.querySelectorAll('[data-mine-cell]').forEach(button=>{button.addEventListener('click',()=>reveal(+button.dataset.mineCell));button.addEventListener('contextmenu',event=>{event.preventDefault();flag(+button.dataset.mineCell)})});};
    reset();render();return w;
  }
  openSnake(){
    const w=this.makeWindow('game',`Tux-Snake · ${this.os.label}`,'game',{width:560,height:640}),size=14;
    const state={snake:[size*7+6,size*7+5,size*7+4],food:size*4+4,direction:'right',next:'right',score:0,over:false,message:'Pfeiltasten oder Steuertasten nutzen.'};
    const placeFood=()=>{const free=Array.from({length:size*size},(_,i)=>i).filter(i=>!state.snake.includes(i));state.food=free[Math.floor(Math.random()*free.length)]};
    const opposite={left:'right',right:'left',up:'down',down:'up'};
    const step=()=>{if(state.over||!this.windows.has(w.id))return;state.direction=state.next;const head=state.snake[0],x=head%size,y=Math.floor(head/size),next=state.direction==='left'?head-1:state.direction==='right'?head+1:state.direction==='up'?head-size:head+size;if((state.direction==='left'&&x===0)||(state.direction==='right'&&x===size-1)||next<0||next>=size||state.snake.includes(next)){state.over=true;state.message='Game over – starte neu.';render();return;}state.snake.unshift(next);if(next===state.food){state.score++;placeFood();state.message='Lecker! +1 Punkt.'}else state.snake.pop();render();};
    const setDirection=direction=>{if(opposite[direction]!==state.direction)state.next=direction;};
    const restart=()=>{state.snake=[size*7+6,size*7+5,size*7+4];state.food=size*4+4;state.direction='right';state.next='right';state.score=0;state.over=false;state.message='Neue Runde.';render()};
    w.content.className='window-content game-content snake-game';w.element.tabIndex=0;
    const render=()=>{w.content.innerHTML=`<div class="game-bar tux-game-bar"><div><strong>Tux-Snake</strong><span>Terminal-Klassiker · ${escapeHTML(this.os.label)}</span></div><strong>Punkte: ${state.score}</strong><button data-game-new>Neu</button></div><div class="snake-board">${Array.from({length:size*size},(_,index)=>`<span class="snake-cell ${state.snake.includes(index)?(index===state.snake[0]?'snake-head':'snake-body'):index===state.food?'snake-food':''}"></span>`).join('')}</div><div class="snake-controls"><button data-snake="up">↑</button><button data-snake="left">←</button><button data-snake="down">↓</button><button data-snake="right">→</button></div><div class="game-message">${escapeHTML(state.message)}</div>`;$('[data-game-new]',w.content).addEventListener('click',restart);w.content.querySelectorAll('[data-snake]').forEach(button=>button.addEventListener('click',()=>setDirection(button.dataset.snake)));};
    w.element.addEventListener('keydown',event=>{const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(keys[event.key]){event.preventDefault();setDirection(keys[event.key])}});w.cleanup=()=>clearInterval(state.timer);state.timer=setInterval(step,240);render();setTimeout(()=>w.element.focus(),0);return w;
  }
  openMacGame(){
    const w=this.makeWindow('game','Drei gewinnt · macOS','game',{width:510,height:555}),state={cells:Array(9).fill(''),over:false,message:'Du spielst X. Der Mac spielt O.'};
    const wins=[['0','1','2'],['3','4','5'],['6','7','8'],['0','3','6'],['1','4','7'],['2','5','8'],['0','4','8'],['2','4','6']];
    const winner=()=>wins.find(line=>line.every(index=>state.cells[index]&&state.cells[index]===state.cells[line[0]]))?state.cells[wins.find(line=>line.every(index=>state.cells[index]&&state.cells[index]===state.cells[line[0]]))[0]]:'';
    const render=()=>{w.content.innerHTML=`<div class="game-bar mac-game-bar"><div><strong>Drei gewinnt</strong><span>macOS Spielbrett</span></div><button data-game-new>Neue Runde</button></div><div class="mac-grid">${state.cells.map((value,index)=>`<button data-mac-cell="${index}" ${value||state.over?'disabled':''}>${value}</button>`).join('')}</div><div class="game-message">${escapeHTML(state.message)}</div>`;$('[data-game-new]',w.content).addEventListener('click',()=>{state.cells=Array(9).fill('');state.over=false;state.message='Du spielst X. Der Mac spielt O.';render()});w.content.querySelectorAll('[data-mac-cell]').forEach(button=>button.addEventListener('click',()=>{const index=+button.dataset.macCell;if(state.over||state.cells[index])return;state.cells[index]='X';let result=winner();if(result){state.over=true;state.message='Du gewinnst!';render();return;}const free=state.cells.map((value,i)=>value?null:i).filter(i=>i!==null);if(!free.length){state.over=true;state.message='Unentschieden.';render();return;}state.cells[free[Math.floor(Math.random()*free.length)]]='O';result=winner();if(result){state.over=true;state.message='Der Mac gewinnt diese Runde.'}else if(state.cells.every(Boolean)){state.over=true;state.message='Unentschieden.'}render()}));};
    render();return w;
  }
  openStructogram(){
    const w=this.makeWindow('structogram','Struktogramm · Diagrammwerkstatt','structure',{width:1080,height:710});
    const exampleFor=language=>language==='python'?`class Rechnung:
    def __init__(self, werte):
        self.werte = werte

    def summe_positive(self):
        summe = 0
        for wert in self.werte:
            if wert > 0:
                summe = summe + wert
            elif wert == 0:
                print("neutral")
            else:
                print("übersprungen")
        return summe

class PremiumRechnung(Rechnung):
    def anzeigen(self):
        if self.summe_positive() > 10:
            print("Premium")
        else:
            print("Standard")`:`class Rechnung {
  constructor(werte) {
    this.werte = werte;
  }

  summePositive() {
    let summe = 0;
    for (const wert of this.werte) {
      if (wert > 0) {
        summe = summe + wert;
      } else if (wert === 0) {
        console.log("neutral");
      } else {
        console.log("übersprungen");
      }
    }
    return summe;
  }
}

class PremiumRechnung extends Rechnung {
  anzeigen() {
    if (this.summePositive() > 10) {
      console.log("Premium");
    }
  }
}`;
    const state={language:'python',view:'struct',nodes:parseStructuredCode(exampleFor('python'),'python')};
    const nodeField=(node,field,label)=>`<label class="struct-field">${label?`<span>${escapeHTML(label)}</span>`:''}<input data-struct-node="${node.id}" data-struct-field="${field}" value="${escapeHTML(node[field]??'')}"></label>`;
    const childrenHTML=nodes=>nodes.length?nodes.map(nodeHTML).join(''):'<div class="struct-empty">leer</div>';
    const branchHTML=branch=>`<section class="struct-branch"><strong>${escapeHTML(branch.label)}</strong><div class="struct-nested">${childrenHTML(branch.children)}</div></section>`;
    const nodeHTML=node=>{
      const remove=`<button data-struct-remove="${node.id}" title="Block entfernen" aria-label="Block entfernen">×</button>`;
      if(node.type==='statement')return `<article class="struct-node struct-statement"><header><strong>Anweisung</strong>${remove}</header>${nodeField(node,'text','')}</article>`;
      if(node.type==='if')return `<article class="struct-node struct-if"><header><strong>Verzweigung</strong>${remove}</header>${nodeField(node,'condition','Bedingung')}<div class="struct-branches">${node.branches.map(branchHTML).join('')}</div></article>`;
      if(node.type==='loop')return `<article class="struct-node struct-loop"><header><strong>${node.loopKind==='for'?'Zählschleife':'Wiederholung'}</strong>${remove}</header>${nodeField(node,'condition',node.loopKind==='for'?'Schleifenkopf':'Bedingung')}<div class="struct-nested">${childrenHTML(node.children)}</div></article>`;
      if(node.type==='class')return `<article class="struct-node struct-class"><header><strong>Klasse</strong>${remove}</header><div class="struct-scope-fields">${nodeField(node,'name','Name')}${nodeField({...node,bases:(node.bases||[]).join(', ')},'bases','Erbt von')}</div><div class="struct-nested">${childrenHTML(node.children)}</div></article>`;
      if(node.type==='function')return `<article class="struct-node struct-function"><header><strong>Funktion / Methode</strong>${remove}</header><div class="struct-scope-fields">${nodeField(node,'name','Name')}${nodeField(node,'params','Parameter')}</div><div class="struct-nested">${childrenHTML(node.children)}</div></article>`;
      if(node.type==='switch')return `<article class="struct-node struct-switch"><header><strong>Auswahl</strong>${remove}</header>${nodeField(node,'condition','Ausdruck')}<div class="struct-branches">${node.branches.map(branchHTML).join('')||'<div class="struct-empty">keine Fälle</div>'}</div></article>`;
      return `<article class="struct-node struct-try"><header><strong>Fehlerbehandlung</strong>${remove}</header><div class="struct-branches">${node.branches.map(branchHTML).join('')}</div></article>`;
    };
    const flowNodes=nodes=>nodes.map(node=>{
      if(node.type==='if'||node.type==='switch'||node.type==='try')return `<section class="flow-group"><div class="flow-step flow-decision">${escapeHTML(structLabel(node))}</div><div class="flow-branches">${(node.branches||[]).map(branch=>`<div class="flow-branch"><span>${escapeHTML(branch.label)}</span>${flowNodes(branch.children)||'<div class="flow-step flow-empty">weiter</div>'}</div>`).join('')}</div><div class="flow-join">◆ zusammenführen</div></section>`;
      if(node.type==='loop')return `<section class="flow-group flow-loop"><div class="flow-step flow-decision">${escapeHTML(structLabel(node))}</div><div class="flow-loop-body">${flowNodes(node.children)||'<div class="flow-step flow-empty">leer</div>'}</div><div class="flow-loop-back">↺ zurück zur Bedingung</div></section>`;
      if(node.type==='class'||node.type==='function'||node.type==='block')return `<section class="flow-scope"><div class="flow-step flow-scope-head">${escapeHTML(structLabel(node))}</div>${flowNodes(node.children)||'<div class="flow-step flow-empty">leer</div>'}</section>`;
      return `<div class="flow-step flow-process">${escapeHTML(structLabel(node))}</div>`;
    }).join('');
    const flowHTML=()=>`<div class="flowchart" aria-label="Flussdiagramm"><div class="flow-step flow-terminal">Start</div>${flowNodes(state.nodes)||'<div class="flow-step flow-empty">Kein Code</div>'}<div class="flow-step flow-terminal">Ende</div></div>`;
    const umlHTML=()=>{
      const classes=structClasses(state.nodes);if(!classes.length)return '<div class="diagram-empty"><strong>Noch keine Klasse erkannt.</strong><span>Füge eine Klasse ein oder verwende das Beispiel, um ein UML-Klassendiagramm zu erhalten.</span></div>';
      return `<div class="uml-canvas" aria-label="UML-Klassendiagramm">${classes.map(node=>{const fields=structClassFields(node),methods=(node.children||[]).filter(child=>child.type==='function'),dependencies=structDependencies(node,classes),relations=[...(node.bases||[]).map(base=>`△ erbt von ${base}`),...dependencies.filter(name=>!(node.bases||[]).includes(name)).map(name=>`⋯ nutzt ${name}`)];return `<article class="uml-class"><header>«class»<strong>${escapeHTML(node.name||'NeueKlasse')}</strong></header><section><strong>Attribute</strong>${fields.length?`<ul>${fields.map(field=>`<li>− ${escapeHTML(field)}</li>`).join('')}</ul>`:'<small>keine erkannt</small>'}</section><section><strong>Operationen</strong>${methods.length?`<ul>${methods.map(method=>`<li>+ ${escapeHTML(method.name)}(${escapeHTML(method.params||'')})</li>`).join('')}</ul>`:'<small>keine erkannt</small>'}</section>${relations.length?`<footer>${relations.map(relation=>`<span>${escapeHTML(relation)}</span>`).join('')}</footer>`:''}</article>`}).join('')}</div>`;
    };
    const addNode=type=>{
      if(type==='statement')return structNode('statement',{text:state.language==='python'?'neue_anweisung()':'neueAnweisung()'});
      if(type==='if')return structNode('if',{condition:'Bedingung',branches:[structBranch('Ja','Bedingung'),structBranch('Nein')]});
      if(type==='loop')return structNode('loop',{loopKind:'while',condition:'Bedingung'});
      if(type==='function')return structNode('function',{name:'neue_funktion',params:''});
      return structNode('class',{name:'NeueKlasse',bases:[]});
    };
    w.content.className='window-content structogram-content';
    w.content.innerHTML=`<div class="struct-toolbar"><div><strong>Struktogramm- & Diagrammwerkstatt</strong><span>Analysiert verschachtelte Blöcke, Klassen und Methoden lokal im Browser.</span></div><label>Sprache <select data-struct-language>${Object.entries(STRUCT_LANGUAGES).map(([id,info])=>`<option value="${id}">${info.label}</option>`).join('')}</select></label><button data-struct-action="parse">Code analysieren</button><button class="accent-action" data-struct-action="generate">Code erzeugen</button><button data-struct-action="editor">Im Editor öffnen</button></div><div class="struct-workspace"><section class="struct-code-pane"><div class="struct-pane-head"><strong>QUELLCODE</strong><button data-struct-action="example">Verschachteltes Beispiel</button></div><textarea class="struct-code" aria-label="Code für Diagramme">${escapeHTML(exampleFor('python'))}</textarea><p>Python sowie JavaScript, Java, C# und C++: Klassen, Methoden, verschachtelte <code>if</code>/<code>else</code>-Zweige und Schleifen werden als Baum gelesen. Der Parser ist absichtlich lokal und kein vollständiger Compiler.</p></section><section class="struct-diagram-pane"><div class="struct-pane-head"><strong>ANALYSE</strong><span class="struct-status"></span></div><div class="struct-view-tabs" role="tablist" aria-label="Diagrammansicht"><button data-struct-view="struct" role="tab">Struktogramm</button><button data-struct-view="flow" role="tab">Flussdiagramm</button><button data-struct-view="uml" role="tab">UML-Klassen</button></div><div class="struct-add"><span>Manuell ergänzen:</span><button data-struct-add="statement">+ Anweisung</button><button data-struct-add="if">+ Wenn</button><button data-struct-add="loop">+ Schleife</button><button data-struct-add="function">+ Funktion</button><button data-struct-add="class">+ Klasse</button></div><div class="struct-diagram" aria-live="polite"></div></section></div>`;
    const codeArea=$('.struct-code',w.content),diagram=$('.struct-diagram',w.content),language=$('[data-struct-language]',w.content),status=$('.struct-status',w.content),viewButtons=[...w.content.querySelectorAll('[data-struct-view]')];
    const render=()=>{
      status.textContent=`${structCountNodes(state.nodes)} Bausteine · ${structClasses(state.nodes).length} Klassen`;
      viewButtons.forEach(button=>{button.classList.toggle('active',button.dataset.structView===state.view);button.setAttribute('aria-selected',button.dataset.structView===state.view?'true':'false')});
      diagram.innerHTML=state.view==='flow'?flowHTML():state.view==='uml'?umlHTML():`<div class="struct-tree">${state.nodes.length?state.nodes.map(nodeHTML).join(''):'<div class="diagram-empty">Kein Code erkannt.</div>'}</div>`;
      diagram.querySelectorAll('[data-struct-field]').forEach(input=>input.addEventListener('input',()=>{const node=structFindNode(state.nodes,input.dataset.structNode);if(!node)return;if(input.dataset.structField==='bases')node.bases=input.value.split(',').map(value=>value.trim()).filter(Boolean);else node[input.dataset.structField]=input.value;}));
      diagram.querySelectorAll('[data-struct-remove]').forEach(button=>button.addEventListener('click',()=>{removeStructNode(state.nodes,button.dataset.structRemove);render()}));
    };
    viewButtons.forEach(button=>button.addEventListener('click',()=>{state.view=button.dataset.structView;render()}));
    w.content.querySelectorAll('[data-struct-add]').forEach(button=>button.addEventListener('click',()=>{state.nodes.push(addNode(button.dataset.structAdd));state.view='struct';render()}));
    language.addEventListener('change',()=>{codeArea.value=structCodeFromNodes(state.nodes,language.value);state.language=language.value;state.view='struct';render()});
    w.content.querySelectorAll('[data-struct-action]').forEach(button=>button.addEventListener('click',()=>{
      const action=button.dataset.structAction;
      if(action==='parse'){state.nodes=parseStructuredCode(codeArea.value,state.language);state.view='struct';render();this.toast(`${structCountNodes(state.nodes)} Bausteine aus dem Code erkannt`)}
      if(action==='generate'){codeArea.value=structCodeFromNodes(state.nodes,state.language);this.toast('Code aus dem Programmbaum erzeugt')}
      if(action==='example'){codeArea.value=exampleFor(state.language);state.nodes=parseStructuredCode(codeArea.value,state.language);state.view='struct';render();this.toast('Verschachteltes Beispiel geladen')}
      if(action==='editor'){const ext=STRUCT_LANGUAGES[state.language].extension,file=`diagramm-struktur.${ext}`,code=structCodeFromNodes(state.nodes,state.language);this.fs.write(file,code,joinPath(homePath(this.currentOS),'Projects'));this.openEditor(file,joinPath(homePath(this.currentOS),'Projects'));this.toast('Diagramm-Code im Editor geöffnet')}
    }));
    render();return w;
  }
}
