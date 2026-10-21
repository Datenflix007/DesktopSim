// SQL-Lernengine (echte Datenänderungen, bewusster SQL-Teilumfang) und Demo-Ausgaben weiterer Sprachen.
const keyFor = os => `desktopsim-v2-db-${os}`;
function seedDB(){return{
  schueler:{columns:['id','name','klasse','punkte'],rows:[{id:1,name:'Alex',klasse:'8a',punkte:86},{id:2,name:'Sam',klasse:'8b',punkte:94},{id:3,name:'Lina',klasse:'8a',punkte:77},{id:4,name:'Robin',klasse:'9b',punkte:91}]},
  projekte:{columns:['id','titel','sprache'],rows:[{id:1,titel:'Hallo Welt',sprache:'Python'},{id:2,titel:'Webseite',sprache:'HTML'},{id:3,titel:'Datenbank',sprache:'SQL'}]}
}}
function splitCSV(s){let out=[],buf='',quote=null;for(let i=0;i<s.length;i++){const c=s[i];if(quote){buf+=c;if(c===quote){if(s[i+1]===quote){buf+=s[++i]}else quote=null}}else if(c==='\''||c==='"'){quote=c;buf+=c}else if(c===','){out.push(buf.trim());buf=''}else buf+=c;}out.push(buf.trim());return out;}
function sqlValue(raw){raw=String(raw).trim();if(/^null$/i.test(raw))return null;if(/^true$/i.test(raw))return true;if(/^false$/i.test(raw))return false;if(/^[-+]?\d+(\.\d+)?$/.test(raw))return Number(raw);if((raw.startsWith("'")&&raw.endsWith("'"))||(raw.startsWith('"')&&raw.endsWith('"')))return raw.slice(1,-1).replaceAll("''", "'").replaceAll('""','"');throw Error(`Nicht unterstützter Wert: ${raw}`)}
const ident = s => String(s).replace(/^[`"\[]|[`"\]]$/g,'').trim().toLowerCase();
function statementSplit(raw){const stmts=[];let buf='',quote=null;for(let i=0;i<raw.length;i++){let c=raw[i];if(quote){buf+=c;if(c===quote){if(raw[i+1]===quote){buf+=raw[++i]}else quote=null}continue;}if(c==="'"||c==='"'){quote=c;buf+=c;continue;}if(c===';'){if(buf.trim())stmts.push(buf.trim());buf='';}else buf+=c;}if(buf.trim())stmts.push(buf.trim());return stmts;}
export class MiniSQL {
  constructor(os){this.os=os;this.key=keyFor(os);try{this.tables=JSON.parse(localStorage.getItem(this.key))||seedDB()}catch{this.tables=seedDB()}}
  save(){localStorage.setItem(this.key,JSON.stringify(this.tables))}
  reset(){this.tables=seedDB();this.save()}
  find(name){const key=Object.keys(this.tables).find(k=>k.toLowerCase()===ident(name));if(!key)throw Error('Tabelle nicht gefunden: '+name);return [key,this.tables[key]]}
  where(rows,clause){if(!clause)return [...rows];const conditions=clause.split(/\s+AND\s+/i);return rows.filter(row=>conditions.every(cond=>{
    const m=cond.trim().match(/^([\w`"\[\]]+)\s*(=|!=|<>|>=|<=|>|<|LIKE)\s*(.+)$/i);if(!m)throw Error('WHERE-Bedingung wird nicht unterstützt: '+cond);
    const key=Object.keys(row).find(k=>k.toLowerCase()===ident(m[1]));if(!key)throw Error('Unbekannte Spalte: '+m[1]);const a=row[key],b=sqlValue(m[3]),op=m[2].toUpperCase();
    if(op==='LIKE')return new RegExp('^'+String(b).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replaceAll('%','.*').replaceAll('_','.')+'$','i').test(String(a));
    const x=typeof a==='number'?Number(a):String(a);const y=typeof a==='number'?Number(b):String(b);
    return op==='='?String(a)===String(b):op==='!='||op==='<>'?String(a)!==String(b):op==='>'?x>y:op==='<'?x<y:op==='>='?x>=y:x<=y;
  }))}
  run(raw){const clean=raw.split('\n').filter(s=>!s.trim().startsWith('--')).join('\n');let last={message:'Keine SQL-Anweisung',columns:[],rows:[]};for(const sql of statementSplit(clean)){last=this.one(sql)}return last;}
  one(sql){sql=sql.trim();let m;
    if(/^(SHOW\s+TABLES|\.tables)$/i.test(sql))return{message:'Tabellen',columns:['tabelle'],rows:Object.keys(this.tables).map(t=>({tabelle:t}))};
    if((m=sql.match(/^(?:DESCRIBE|DESC|PRAGMA\s+TABLE_INFO)\s+([\w]+)$/i))){const[,table]=this.find(m[1]);return{message:'Spalten',columns:['spalte'],rows:table.columns.map(spalte=>({spalte}))}}
    if((m=sql.match(/^CREATE\s+TABLE\s+(\w+)\s*\(([^)]+)\)$/i))){const name=ident(m[1]);if(this.tables[name])throw Error('Tabelle existiert bereits');const columns=splitCSV(m[2]).map(v=>ident(v.split(/\s+/)[0]));this.tables[name]={columns,rows:[]};this.save();return{message:'Tabelle erstellt: '+name,columns:[],rows:[]}}
    if((m=sql.match(/^DROP\s+TABLE\s+(\w+)$/i))){const[k]=this.find(m[1]);delete this.tables[k];this.save();return{message:'Tabelle gelöscht: '+k,columns:[],rows:[]}}
    if((m=sql.match(/^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\((.+)\)$/is))){const[,t]=this.find(m[1]);const cols=splitCSV(m[2]).map(ident),values=splitCSV(m[3]).map(sqlValue);if(cols.length!==values.length)throw Error('Spaltenanzahl und Werte stimmen nicht überein');const row=Object.fromEntries(t.columns.map(c=>[c,null]));for(let i=0;i<cols.length;i++){if(!t.columns.includes(cols[i]))throw Error('Unbekannte Spalte: '+cols[i]);row[cols[i]]=values[i]}if(t.columns.includes('id')&&row.id===null)row.id=Math.max(0,...t.rows.map(r=>Number(r.id)||0))+1;t.rows.push(row);this.save();return{message:'1 Zeile eingefügt',columns:[],rows:[]}}
    if((m=sql.match(/^UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i))){const[,t]=this.find(m[1]);const updates=splitCSV(m[2]).map(v=>{const a=v.match(/^([\w]+)\s*=\s*(.+)$/);if(!a)throw Error('Ungültige SET-Syntax');const col=ident(a[1]);if(!t.columns.includes(col))throw Error('Unbekannte Spalte: '+col);return[col,sqlValue(a[2])]});const rows=this.where(t.rows,m[3]);for(const row of rows)for(const[c,v]of updates)row[c]=v;this.save();return{message:`${rows.length} Zeile(n) aktualisiert`,columns:[],rows:[]}}
    if((m=sql.match(/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+))?$/i))){const[,t]=this.find(m[1]);const rows=this.where(t.rows,m[2]);t.rows=t.rows.filter(r=>!rows.includes(r));this.save();return{message:`${rows.length} Zeile(n) gelöscht`,columns:[],rows:[]}}
    if((m=sql.match(/^SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?$/i))){
      const[,t]=this.find(m[2]);let rows=this.where(t.rows,m[3]);if(m[4]){const col=ident(m[4]);if(!t.columns.includes(col))throw Error('Unbekannte ORDER-BY-Spalte');rows.sort((a,b)=>typeof a[col]==='number'?a[col]-b[col]:String(a[col]).localeCompare(String(b[col])));if(m[5]?.toUpperCase()==='DESC')rows.reverse();}if(m[6])rows=rows.slice(0,Number(m[6]));
      if(/^COUNT\s*\(\s*\*\s*\)(?:\s+AS\s+\w+)?$/i.test(m[1])){const as=m[1].match(/\s+AS\s+(\w+)/i)?.[1]||'COUNT(*)';return{message:'1 Zeile',columns:[as],rows:[{[as]:rows.length}]}}
      const cols=m[1].trim()==='*'?t.columns:splitCSV(m[1]).map(ident);for(const c of cols)if(!t.columns.includes(c))throw Error('Unbekannte Spalte: '+c);
      return{message:`${rows.length} Zeile(n)`,columns:cols,rows:rows.map(row=>Object.fromEntries(cols.map(c=>[c,row[c]])))};
    }
    throw Error('SQL-Anweisung nicht unterstützt. Beispiele: SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, DROP TABLE.');
  }
}
function literal(s,vars={}){
  s=String(s).trim();if(s in vars)return vars[s];
  const variableArithmetic=s.match(/^([a-z_]\w*)\s*([+-])\s*(\d+)$/i);
  if(variableArithmetic&&variableArithmetic[1] in vars)return Number(vars[variableArithmetic[1]])+(variableArithmetic[2]==='+'?1:-1)*Number(variableArithmetic[3]);
  if(/^[-+]?\d+(?:\.\d+)?(?:\s*[+*/-]\s*[-+]?\d+(?:\.\d+)?)*$/.test(s)){
    const parts=s.match(/\d+(?:\.\d+)?|[+*/-]/g)||[];let acc=Number(parts[0]);for(let i=1;i<parts.length;i+=2){const n=Number(parts[i+1]);acc=parts[i]==='+'?acc+n:parts[i]==='-'?acc-n:parts[i]==='*'?acc*n:acc/n}return acc;
  }
  if(/^f["']/.test(s))return s.slice(2,-1).replace(/\{([^}]+)\}/g,(_,expr)=>String(literal(expr,vars)));
  if(/^".*"$|^'.*'$/.test(s))return s.slice(1,-1).replace(/\$([a-z_]\w*)/gi,(_,k)=>vars[k]??'$'+k);
  if(s.startsWith('$')&&s.slice(1) in vars)return vars[s.slice(1)];
  if(s.includes(' . ')||s.includes(' + '))return s.split(/\s+[.+]\s+/).map(item=>literal(item,vars)).join('');
  return s;
}
function findPrints(code,regex,vars){const result=[];let m;while((m=regex.exec(code))!==null){result.push(String(literal(m[1],vars)));if(result.length>=80)break;}return result}
// Keine Java-/C#-/PHP-Laufzeit: nur gut sichtbare, begrenzte Ausgabe-Simulation.
export function simulateCompiled(language,source){
  const configs={
    java:{regex:/System\.out\.println\s*\(([^;\n]*)\)\s*;/g,label:'Java / System.out.println'},
    cs:{regex:/Console\.WriteLine\s*\(([^;\n]*)\)\s*;/g,label:'C# / Console.WriteLine'},
    php:{regex:/\becho\s+([^;\n]+)\s*;/g,label:'PHP / echo'}
  };const cfg=configs[language];if(!cfg)throw Error('Nicht unterstützte Sprache');
  const vars={};const clean=source.replace(/<\?php/gi,'').replace(/\?>/g,'');
  const declarations=/(?:^|[;\n])\s*(?:(?:String|string|int|var)\s+|\$)([a-z_]\w*)\s*=\s*([^;\n]+)\s*;/gi;
  for(const m of clean.matchAll(declarations))vars[m[1]]=literal(m[2],vars);
  const lines=findPrints(source,cfg.regex,vars);
  return{simulation:true,output:lines.length?lines.join('\n'):'[Demo] Keine unterstützte Ausgabefunktion erkannt.',detail:`Ausgabe-Simulator: ${cfg.label}. Kein echter Compiler und keine vollständige Sprachausführung.`};
}
export function simulatePython(source){
  const lines=[];const vars={};const code=source.split('\n');let loop=null;
  for(const row of code){
    let m;
    if((m=row.match(/^for\s+(\w+)\s+in\s+range\((\d+)\)\s*:/))){loop={var:m[1],times:Math.min(100,Number(m[2]))};continue;}
    if(loop&&/^\s+print\((.*)\)\s*$/.test(row)){
      const expr=row.trim().match(/^print\((.*)\)$/)[1];for(let i=0;i<loop.times;i++){vars[loop.var]=i;lines.push(String(literal(expr,vars)))}loop=null;continue;
    }
    if((m=row.match(/^\s*([a-z_]\w*)\s*=\s*(.+)$/i)))vars[m[1]]=literal(m[2],vars);
    else if((m=row.match(/^\s*print\s*\((.*)\)\s*$/)))lines.push(String(literal(m[1],vars)));
  }
  return{simulation:true,output:lines.length?lines.join('\n'):'[Demo] Bitte Pyodide laden, um vollständiges Python auszuführen.',detail:'Offline-Demomodus (einfache Zuweisungen, for-range und print).'};
}
export class PythonRuntime{
  constructor(){this.worker=null;this.pending=new Map();this.nextId=1;this.loaded=false;this.loading=false}
  ensure(){if(this.worker)return;this.loading=true;this.worker=new Worker(new URL('./python-worker.js',import.meta.url),{type:'module'});this.worker.onmessage=e=>{
    if(e.data?.ready){this.loaded=true;this.loading=false;return}
    if(e.data?.initError){this.loading=false;for(const p of this.pending.values())p.reject(Error(e.data.initError));this.pending.clear();this.terminate();return}
    const p=this.pending.get(e.data?.id);if(p){this.pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.output||'');}
  };this.worker.onerror=e=>{for(const p of this.pending.values())p.reject(Error('Python kann nicht geladen werden (Netzwerk/CDN).'));this.pending.clear();this.terminate()}}
  run(source){this.ensure();return new Promise((resolve,reject)=>{const id=this.nextId++;this.pending.set(id,{resolve,reject});this.worker.postMessage({id,source})})}
  terminate(){this.worker?.terminate();this.worker=null;this.loaded=false;this.loading=false;for(const p of this.pending.values())p.reject(Error('Python-Ausführung gestoppt'));this.pending.clear()}
}
